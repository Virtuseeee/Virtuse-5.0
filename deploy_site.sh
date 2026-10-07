#!/bin/bash
# Deploy the site files changed in a commit range: push main, sync gh-pages
# (staging), sftp to production, md5-check production.
#   bash ~/Virtuse-5.0/deploy_site.sh <from-commit> [to-commit, default HEAD]
# Stops before anything is pushed if origin/main has commits this Mac lacks
# (otherwise the upload would overwrite newer production files).
set -uo pipefail
cd "$(dirname "$0")"
SITE="Kimi_Agent_Virtuse%20MiCA%20Partners"
FROM=${1:?usage: deploy_site.sh <from-commit> [to-commit]}
TO=$(git rev-parse "${2:-HEAD}")
LIST=/private/tmp/deploy_site_files.txt
BATCH=/private/tmp/deploy_site.sftp
WT=/private/tmp/gh-pages-seo
IP=212.57.32.128

git fetch -q origin || { echo "!! git fetch failed"; exit 1; }
if [ -n "$(git rev-list HEAD..origin/main)" ]; then
  echo "!! origin/main has $(git rev-list --count HEAD..origin/main) newer commit(s). Nothing was pushed or uploaded."
  echo "   Tell Claude, so they get merged first."; exit 1
fi
git diff --name-only --no-renames --diff-filter=AM "$FROM" "$TO" -- "$SITE" | sed "s#^$SITE/##" | grep -v -E '^i18n-tools/|\.md$' > "$LIST" || true
N=$(wc -l < "$LIST" | tr -d ' ')
echo "== $N site files in ${FROM:0:7}..${TO:0:7}"
[ "$N" -gt 0 ] || { echo "nothing to deploy"; exit 0; }

echo "== 1/4 push main"
git push origin HEAD:main || { echo "!! push failed"; exit 1; }

echo "== 2/4 staging (gh-pages)"
git worktree prune
if [ -d "$WT" ]; then git -C "$WT" checkout -q --detach origin/gh-pages; git -C "$WT" pull -q origin gh-pages 2>/dev/null
else git fetch -q origin gh-pages && git worktree add -q --detach "$WT" origin/gh-pages; fi
git -C "$WT" fetch -q origin gh-pages && git -C "$WT" checkout -q --detach origin/gh-pages
while IFS= read -r f; do mkdir -p "$WT/$(dirname "$f")"; cp "$SITE/$f" "$WT/$f"; git -C "$WT" add -- "$f"; done < "$LIST"
if git -C "$WT" diff --cached --quiet; then echo "   gh-pages already up to date"
else git -C "$WT" commit -q -m "Sync from main ${TO:0:7}: $(git log -1 --format=%s "$TO")" && git -C "$WT" push origin HEAD:gh-pages || { echo "!! gh-pages push failed"; exit 1; }; fi

HOST=ftp.virtuse.com
if ! host -W 5 "$HOST" >/dev/null 2>&1 && ! dscacheutil -q host -a name "$HOST" | grep -q ip_address; then
  echo "   (this Mac can't resolve $HOST right now, connecting to $IP)"; HOST=$IP
fi
# Default login: the User set for this host in ~/.ssh/config, if any
# (ssh -G falls back to the local account name when none is set).
CFGUSER=$(ssh -G "$HOST" 2>/dev/null | awk '$1=="user"{print $2; exit}')
[ -n "$CFGUSER" ] && [ "$CFGUSER" != "$(id -un)" ] || CFGUSER=admin.virtuse.com
read -r -p "FTP/SFTP username [$CFGUSER]: " FTPUSER </dev/tty
FTPUSER=${FTPUSER:-$CFGUSER}
echo "== 3/4 production (sftp $FTPUSER@$HOST, asks for the password)"
{ echo "-cd public_html"; echo "pwd"
  # sftp put can't create folders: -mkdir every parent dir first (the "-"
  # ignores "already exists").
  while IFS= read -r f; do d=$(dirname "$f"); while [ "$d" != "." ]; do echo "$d"; d=$(dirname "$d"); done; done < "$LIST" \
    | sort -u | awk '{ print length, $0 }' | sort -n | cut -d' ' -f2- | while IFS= read -r d; do echo "-mkdir \"$d\""; done
  while IFS= read -r f; do echo "put \"$f\" \"$f\""; done < "$LIST"; } > "$BATCH"
(cd "$SITE" && sftp -P 222 "$FTPUSER@$HOST" < "$BATCH") || { echo "!! sftp failed"; exit 1; }

echo "== 4/4 md5 check on virtuse.com"
ok=0; bad=0
while IFS= read -r f; do
  l=$(md5 -q "$SITE/$f")
  r=$(curl -s --resolve virtuse.com:443:$IP "https://virtuse.com/$f?nocache=$(date +%s)" | md5 -q)
  if [ "$l" = "$r" ]; then ok=$((ok+1)); else bad=$((bad+1)); echo "   DIFFERENT: $f"; fi
done < "$LIST"
echo "== production: $ok OK, $bad different"
