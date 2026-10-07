#!/bin/bash
# Deploy the Cloudflare Worker (virtuse-newsletter) from origin/main, never
# from this folder's working tree, then check the live Worker.
#
#   bash deploy_worker.sh            # deploy origin/main
#   DRY_RUN=1 bash deploy_worker.sh  # build + test + wrangler --dry-run only
#
# Why from origin/main: the OneDrive folder's checkout has lagged behind
# origin several times; deploying from it would have rolled live routes back
# (/send, /wp/*). This script makes a throwaway git worktree of origin/main,
# runs the tests, deploys with the commit stamped into GET /version, and then
# checks that /version shows that commit and the public routes still answer.
# Needs: `npx wrangler login` once on this Mac (Cloudflare account access).
set -uo pipefail
cd "$(dirname "$0")"
W=https://virtuse-newsletter.virtuse-ai.workers.dev
fail() { echo; echo "!! $*"; echo "!! WORKER DEPLOY NOT COMPLETE"; exit 1; }

git fetch -q origin || fail "git fetch failed"
SHA=$(git rev-parse origin/main)
if ! git diff --quiet origin/main -- cloudflare-worker email 'Kimi_Agent_Virtuse%20MiCA%20Partners/data/partner-checklists.json' 2>/dev/null; then
  echo "   note: this folder's cloudflare-worker/ or email/ differs from origin/main."
  echo "   Only what is pushed to origin/main gets deployed. Push first if you meant to deploy local changes."
fi

TMP=$(mktemp -d /private/tmp/deploy_worker.XXXXXX)
trap 'git worktree remove --force "$TMP/wt" >/dev/null 2>&1; rm -rf "$TMP"' EXIT
git worktree add -q --detach "$TMP/wt" "$SHA" || fail "could not create a worktree of origin/main"
cd "$TMP/wt/cloudflare-worker"
echo "== 1/4 install + test (origin/main ${SHA:0:7})"
npm ci --no-audit --no-fund >/dev/null || fail "npm ci failed"
npm test 2>&1 | tail -n 12 | grep -E "^# (pass|fail)"
npm test >/dev/null 2>&1 || fail "Worker tests fail on origin/main, not deploying"
git diff --quiet -- src/checklists.js \
  || fail "src/checklists.js is out of date with data/partner-checklists.json on origin/main. Run node build.mjs in cloudflare-worker/, commit src/checklists.js, push, re-run."

if [ -n "${DRY_RUN:-}" ]; then
  BUILD_COMMIT=$SHA node build.mjs && npx wrangler deploy --dry-run --outdir "$TMP/dry" | tail -n 3
  echo "== DRY RUN OK, nothing deployed"; exit 0
fi

echo "== 2/4 wrangler deploy"
BUILD_COMMIT=$SHA node build.mjs || fail "build failed"
npx wrangler deploy || fail "wrangler deploy failed (logged in? npx wrangler login)"

echo "== 3/4 live version"
live=
for i in 1 2 3 4 5 6; do
  live=$(curl -s --max-time 10 "$W/version?nc=$RANDOM" | sed -n 's/.*"commit":"\([^"]*\)".*/\1/p')
  [ "$live" = "$SHA" ] && break; sleep 5
done
[ "$live" = "$SHA" ] || fail "GET /version shows '$live', expected $SHA"
echo "   /version = ${SHA:0:7}"

echo "== 4/4 live routes"
bad=0
check() {  # name, expected code, curl args...
  local name=$1 want=$2; shift 2
  local got; got=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$@")
  if [ "$got" = "$want" ]; then echo "   ok   $name ($got)"; else echo "   FAIL $name: $got, expected $want"; bad=$((bad+1)); fi
}
check "OPTIONS /subscribe from virtuse.com" 200 -X OPTIONS -H "Origin: https://virtuse.com" -H "Access-Control-Request-Method: POST" "$W/subscribe"
check "POST /send bad payload" 400 -X POST -H "Origin: https://virtuse.com" -H "Content-Type: application/json" --data '{"kind":"nope"}' "$W/send"
check "GET /pulse.json" 200 "$W/pulse.json"
check "GET /wp/wp-json/" 200 "$W/wp/wp-json/"
check "GET /wp/wp-login.php (blocked)" 404 "$W/wp/wp-login.php"
[ "$bad" -eq 0 ] || fail "$bad live check(s) failed. Roll back in the Cloudflare dashboard (Workers > virtuse-newsletter > Deployments) or npx wrangler rollback"
echo
echo "== WORKER DEPLOY OK: ${SHA:0:7} is live"
