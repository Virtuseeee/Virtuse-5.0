#!/bin/bash
# Deploy the site files changed in a commit range to all three static targets:
# push main, sync gh-pages (staging), sftp to production, then md5-check
# production AND staging. Ends with "DEPLOY OK" only when every file matches.
#
#   bash deploy_site.sh <from-commit> [to-commit, default HEAD]
#   DRY_RUN=1 bash deploy_site.sh <from> [to]   # show files + sftp batch, change nothing
#   LOGIN_ONLY=1 bash deploy_site.sh <from>     # only test the SFTP login
#
# Run it from anywhere: it cds to its own folder (the repo root).
# What it guards against (all happened before 2026-10-07):
#   - origin/main has newer commits      -> stops before anything is pushed
#   - wrong SFTP login / password        -> checked FIRST, before main is pushed
#   - a put that fails without an error  -> sftp runs in batch mode (-b): any
#                                           failed command aborts the upload
#   - an upload that silently did nothing -> md5 of every file on production;
#                                           mismatches are re-uploaded once,
#                                           then the script fails loudly
#   - old hashed assets left behind      -> files deleted in the range are
#                                           removed from gh-pages and production
# The password is typed once (an SSH control connection is reused for the
# upload, the retry and the deletions). The Worker is deployed separately:
# bash deploy_worker.sh (see DEPLOY.md).
# After DEPLOY OK it pings IndexNow (Bing & co.) with the indexable pages of the
# range (seo-ops/indexnow.py); a failed ping never changes the deploy result.
set -uo pipefail
cd "$(dirname "$0")"
SITE="Kimi_Agent_Virtuse%20MiCA%20Partners"
FROM=$(git rev-parse "${1:?usage: deploy_site.sh <from-commit> [to-commit]}") || exit 1
TO=$(git rev-parse "${2:-HEAD}") || exit 1
TMP=$(mktemp -d /private/tmp/deploy_site.XXXXXX)
LIST=$TMP/files.txt; DEL=$TMP/deleted.txt; BATCH=$TMP/upload.sftp
WT=/private/tmp/gh-pages-seo
IP=212.57.32.128
CP=$TMP/ctl   # SSH control socket
DRY=${DRY_RUN:-}

fail() { echo; echo "!! $*"; echo "!! DEPLOY NOT COMPLETE"; exit 1; }
cleanup() { [ -S "$CP" ] && ssh -o ControlPath="$CP" -O exit x 2>/dev/null; rm -rf "$TMP"; }
trap cleanup EXIT

git fetch -q origin || fail "git fetch failed"
if [ -n "$(git rev-list HEAD..origin/main)" ]; then
  fail "origin/main has $(git rev-list --count HEAD..origin/main) newer commit(s). Nothing was pushed or uploaded. Merge them first (git pull --rebase)."
fi
git diff --name-only --no-renames --diff-filter=AM "$FROM" "$TO" -- "$SITE" | sed "s#^$SITE/##" | grep -v -E '^i18n-tools/|\.md$' > "$LIST" || true
git diff --name-only --no-renames --diff-filter=D "$FROM" "$TO" -- "$SITE" | sed "s#^$SITE/##" | grep -v -E '^i18n-tools/|\.md$' > "$DEL" || true
N=$(wc -l < "$LIST" | tr -d ' '); ND=$(wc -l < "$DEL" | tr -d ' ')
echo "== $N site files to upload, $ND to delete, range ${FROM:0:7}..${TO:0:7}"
[ "$N" -gt 0 ] || [ "$ND" -gt 0 ] || { echo "nothing to deploy"; exit 0; }
for f in $(cat "$LIST"); do [ -f "$SITE/$f" ] || fail "$f is in the range but missing in the working tree (checked out a different commit?)"; done
if [ "$ND" -gt 0 ]; then
  echo "   will delete:"; sed 's/^/     /' "$DEL"
  if grep -qv '^concierge-assets/' "$DEL" && [ -z "$DRY" ]; then
    read -r -p "   Some deletions are not old concierge-assets. Delete them on staging and production too? [y/N] " a </dev/tty
    [ "$a" = y ] || fail "stopped, nothing pushed or uploaded"
  fi
fi

# sftp batch: -mkdir every parent folder (put can't create folders; "-" ignores
# "already exists"), put every file, -rm the deleted ones.
{ echo "cd public_html"
  while IFS= read -r f; do d=$(dirname "$f"); while [ "$d" != "." ]; do echo "$d"; d=$(dirname "$d"); done; done < "$LIST" \
    | sort -u | awk '{ print length, $0 }' | sort -n | cut -d' ' -f2- | while IFS= read -r d; do echo "-mkdir \"$d\""; done
  while IFS= read -r f; do echo "put \"$f\" \"$f\""; done < "$LIST"
  while IFS= read -r f; do echo "-rm \"$f\""; done < "$DEL"; } > "$BATCH"
if [ -n "$DRY" ]; then echo "== DRY RUN: files"; cat "$LIST"; echo "== DRY RUN: sftp batch"; cat "$BATCH"; exit 0; fi

# ---- 1/5 login first, so a wrong login stops before anything is pushed ----
HOST=${SFTP_HOST:-ftp.virtuse.com}
if [ "$HOST" = ftp.virtuse.com ] && ! host -W 5 "$HOST" >/dev/null 2>&1 && ! dscacheutil -q host -a name "$HOST" | grep -q ip_address; then
  echo "   (this Mac can't resolve $HOST right now, connecting to $IP)"; HOST=$IP
fi
# Default login: the User set for this host in ~/.ssh/config, if any
# (ssh -G falls back to the local account name when none is set).
CFGUSER=$(ssh -G "$HOST" 2>/dev/null | awk '$1=="user"{print $2; exit}')
[ -n "$CFGUSER" ] && [ "$CFGUSER" != "$(id -un)" ] || CFGUSER=admin.virtuse.com
if [ -n "${SFTP_USER:-}" ]; then FTPUSER=$SFTP_USER
else read -r -p "FTP/SFTP username [$CFGUSER]: " FTPUSER </dev/tty; FTPUSER=${FTPUSER:-$CFGUSER}; fi
PORT=${SFTP_PORT:-222}
COMMON=(-o ControlPath="$CP" -o ConnectTimeout=20 -o ServerAliveInterval=15 ${SSH_EXTRA:-})
SSHOPT=(-P "$PORT" "${COMMON[@]}")
echo "== 1/5 SFTP login $FTPUSER@$HOST (asks for the password once)"
# Keep one authenticated connection open (ssh -N opens no shell, so it also
# works on SFTP-only accounts); every sftp call below reuses it.
MUX=
if ssh -p "$PORT" "${COMMON[@]}" -o ControlMaster=yes -o ControlPersist=1800 -fN "$FTPUSER@$HOST" \
   && ssh -o ControlPath="$CP" -O check x 2>/dev/null; then
  MUX=1
  OUT=$(echo pwd | sftp "${SSHOPT[@]}" -o ControlMaster=no -b - "$FTPUSER@$HOST" 2>&1)
else
  echo "   (could not keep a connection open; checking the login with sftp, it asks again)"
  OUT=$(echo pwd | sftp "${SSHOPT[@]}" -o ControlMaster=no "$FTPUSER@$HOST" 2>&1)
fi
echo "$OUT" | grep -q "Remote working directory" \
  || fail "SFTP login failed, nothing was pushed or uploaded. Check the login in WebAdmin (virtuse.com > Hosting > FTP a súbory > FTP účty). sftp said: $(echo "$OUT" | tail -2 | tr '\n' ' ')"
if [ -n "$MUX" ]; then echo "   login OK (connection kept open for this deploy)"
else echo "   login OK (sftp will ask for the password again for each step)"; fi
[ -n "${LOGIN_ONLY:-}" ] && { echo "== LOGIN_ONLY: login works, nothing pushed or uploaded"; exit 0; }

# Run an sftp batch file. With the control connection: batch mode, any failed
# command aborts with a non-zero exit. Without it (password prompt needed,
# which batch mode forbids): read stdin and treat any error line as failure.
run_sftp() {
  local b=$1 out
  if [ -n "$MUX" ]; then
    (cd "$SITE" && sftp "${SSHOPT[@]}" -o ControlMaster=no -b "$b" "$FTPUSER@$HOST")
  else
    out=$(cd "$SITE" && sftp "${SSHOPT[@]}" -o ControlMaster=no "$FTPUSER@$HOST" < "$b" 2>&1); local rc=$?
    # mkdir of an existing folder and rm of a missing file are expected errors
    echo "$out" | grep -E "Couldn't|No such file|Permission denied|[Ff]ailure|not found" \
      | grep -v -E "^sftp> |Couldn't create directory|Couldn't (remove|delete)" && return 1
    return $rc
  fi
}

# md5 of each listed file on a host vs the working tree; prints mismatches,
# writes them to $2. 4 requests at a time (more time out on Webglobe).
md5_check() {  # $1 list, $2 out-file, $3 base url, $4 extra curl args
  : > "$2"
  while IFS= read -r f; do printf '%s\0' "$f"; done < "$1" | \
    xargs -0 -P 4 -I{} bash -c 'l=$(md5 -q "$0/$1"); r=$(curl -s --max-time 60 $3 "$2/$1?nocache=$RANDOM$RANDOM" | md5 -q); [ "$l" = "$r" ] || echo "$1"' "$SITE" {} "$3" "$4" >> "$2"
  sort -o "$2" "$2"
}

# ---- 2/5 main ----
echo "== 2/5 push main"
git push origin HEAD:main || fail "push to main failed, nothing uploaded"

# ---- 3/5 staging ----
echo "== 3/5 staging (gh-pages)"
git worktree prune
if [ ! -d "$WT/.git" ] && [ ! -f "$WT/.git" ]; then rm -rf "$WT"; git fetch -q origin gh-pages && git worktree add -q --detach "$WT" origin/gh-pages || fail "gh-pages worktree"; fi
git -C "$WT" fetch -q origin gh-pages && git -C "$WT" checkout -q --detach origin/gh-pages || fail "gh-pages checkout"
while IFS= read -r f; do mkdir -p "$WT/$(dirname "$f")"; cp "$SITE/$f" "$WT/$f"; git -C "$WT" add -- "$f"; done < "$LIST"
while IFS= read -r f; do [ -e "$WT/$f" ] && git -C "$WT" rm -q -- "$f"; done < "$DEL"
if git -C "$WT" diff --cached --quiet; then echo "   gh-pages already up to date"
else git -C "$WT" commit -q -m "Sync from main ${TO:0:7}: $(git log -1 --format=%s "$TO")" && git -C "$WT" push -q origin HEAD:gh-pages || fail "gh-pages push failed"; fi

# ---- 4/5 production ----
echo "== 4/5 production upload ($N files, $ND deletions)"
run_sftp "$BATCH" || fail "sftp upload stopped with an error (see above). Re-run the same command; files already uploaded are just overwritten."
echo "   checking md5 on virtuse.com…"
md5_check "$LIST" "$TMP/bad.txt" "https://virtuse.com" "--resolve virtuse.com:443:$IP"
if [ -s "$TMP/bad.txt" ]; then
  echo "   $(wc -l < "$TMP/bad.txt" | tr -d ' ') file(s) differ, uploading them again:"; sed 's/^/     /' "$TMP/bad.txt"
  { echo "cd public_html"; while IFS= read -r f; do echo "put \"$f\" \"$f\""; done < "$TMP/bad.txt"; } > "$TMP/retry.sftp"
  run_sftp "$TMP/retry.sftp" || fail "retry upload stopped with an error"
  sleep 3; md5_check "$TMP/bad.txt" "$TMP/bad2.txt" "https://virtuse.com" "--resolve virtuse.com:443:$IP"
  [ -s "$TMP/bad2.txt" ] && fail "production still differs after a retry:$(sed 's/^/ /' "$TMP/bad2.txt" | tr '\n' ' ')"
fi
for f in $(cat "$DEL"); do
  c=$(curl -s -o /dev/null -w '%{http_code}' --resolve virtuse.com:443:$IP "https://virtuse.com/$f?nocache=$RANDOM")
  [ "$c" = 200 ] && fail "$f should be deleted but production still serves it"
done
echo "   production: $N/$N match"

# ---- 5/5 staging check (GitHub Pages rebuilds in 1-5 min) ----
echo "== 5/5 checking md5 on staging.virtuse.com (waits up to 8 min for GitHub Pages)"
cp "$LIST" "$TMP/stg.txt"
for i in 1 2 3 4 5 6 7 8 9; do
  md5_check "$TMP/stg.txt" "$TMP/stgbad.txt" "https://staging.virtuse.com" "-H Cache-Control:no-cache"
  [ -s "$TMP/stgbad.txt" ] || break
  cp "$TMP/stgbad.txt" "$TMP/stg.txt"; [ "$i" -lt 9 ] && { echo "   $(wc -l < "$TMP/stg.txt" | tr -d ' ') not updated yet, waiting 60 s"; sleep 60; }
done
[ -s "$TMP/stgbad.txt" ] && fail "staging still differs after 8 min (production is fine):$(sed 's/^/ /' "$TMP/stgbad.txt" | head -20 | tr '\n' ' ')"
echo
echo "== DEPLOY OK: ${FROM:0:7}..${TO:0:7}, $N files on main, staging and production (md5), $ND deleted"

# ---- IndexNow (Bing, Yandex, Seznam, …): changed pages get recrawled sooner ----
if [ -f seo-ops/indexnow.py ]; then
  echo "== IndexNow"
  python3 seo-ops/indexnow.py --range "$FROM" "$TO" | sed 's/^/   /' || echo "   (IndexNow ping failed; the deploy itself is complete)"
fi
