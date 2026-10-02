#!/bin/bash
# SEO plan, phases 1 + 2: push main, sync the changed site files to gh-pages
# (staging), upload them to production over sftp, then md5-check production.
# Run from Terminal on the Mac:  bash ~/Virtuse-5.0/deploy_seo_phase12.sh
set -euo pipefail
cd "$(dirname "$0")"
SITE="Kimi_Agent_Virtuse%20MiCA%20Partners"
LIST=/private/tmp/seo_phase12_files.txt
BATCH=/private/tmp/seo_phase12.sftp
WT=/private/tmp/gh-pages-seo

git fetch origin
BASE=$(git merge-base HEAD origin/main)
git diff --name-only --diff-filter=AM "$BASE" HEAD -- "$SITE" | sed "s#^$SITE/##" | grep -v -E '^i18n-tools/|\.md$' > "$LIST"
echo "== $(wc -l < "$LIST" | tr -d ' ') site files changed since origin/main"

echo "== 1/4 push main"
git push origin HEAD:main

echo "== 2/4 staging (gh-pages)"
git worktree prune
if [ -d "$WT" ]; then git -C "$WT" checkout -q --detach origin/gh-pages
else git worktree add -q --detach "$WT" origin/gh-pages; fi
while IFS= read -r f; do
  mkdir -p "$WT/$(dirname "$f")"; cp "$SITE/$f" "$WT/$f"; git -C "$WT" add -- "$f"
done < "$LIST"
if git -C "$WT" diff --cached --quiet; then echo "   gh-pages already up to date"
else
  git -C "$WT" commit -q -m "SEO phases 1+2: meta description + schema.org JSON-LD on hub pages"
  git -C "$WT" push origin HEAD:gh-pages
fi

echo "== 3/4 production (sftp, asks for the password)"
while IFS= read -r f; do echo "put \"$f\" \"public_html/$f\""; done < "$LIST" > "$BATCH"
(cd "$SITE" && sftp -P 222 virtuse.com@ftp.virtuse.com < "$BATCH")

echo "== 4/4 md5 check on virtuse.com"
ok=0; bad=0
while IFS= read -r f; do
  l=$(md5 -q "$SITE/$f")
  r=$(curl -s "https://virtuse.com/$f?nocache=$(date +%s)" | md5 -q)
  if [ "$l" = "$r" ]; then ok=$((ok+1)); else bad=$((bad+1)); echo "   DIFFERENT: $f"; fi
done < "$LIST"
echo "== production: $ok OK, $bad different"
