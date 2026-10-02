#!/bin/bash
# Production leg only (steps 3-4) of deploy_seo_phase12.sh: main and gh-pages
# are already pushed (f3e6f34 / f5fe2a7). Uploads the 231 site files changed
# in cf8fc1d..f3e6f34 and md5-checks them on virtuse.com.
# If this Mac can't resolve ftp.virtuse.com, it connects by IP instead.
set -uo pipefail
cd "$(dirname "$0")"
SITE="Kimi_Agent_Virtuse%20MiCA%20Partners"
LIST=/private/tmp/seo_phase12_files.txt
BATCH=/private/tmp/seo_phase12.sftp
IP=212.57.32.128

git diff --name-only --diff-filter=AM cf8fc1d f3e6f34 -- "$SITE" | sed "s#^$SITE/##" | grep -v -E '^i18n-tools/|\.md$' > "$LIST"
echo "== $(wc -l < "$LIST" | tr -d ' ') files to upload"

HOST=ftp.virtuse.com
if ! host -W 5 "$HOST" >/dev/null 2>&1 && ! dscacheutil -q host -a name "$HOST" | grep -q ip_address; then
  echo "   (this Mac can't resolve $HOST right now, connecting to $IP)"; HOST=$IP
fi

read -r -p "FTP/SFTP username [virtuse.com]: " FTPUSER
FTPUSER=${FTPUSER:-virtuse.com}

echo "== 3/4 production (sftp $FTPUSER@$HOST, asks for the password)"
# Works whether the account's home is the domain root (has public_html/)
# or public_html itself: "-cd" is allowed to fail.
{ echo "pwd"; echo "-cd public_html"; echo "pwd"; echo "ls index.html"
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
