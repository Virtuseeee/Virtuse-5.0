#!/bin/zsh
# Compare files in the gh-pages worktree with what a host serves.
# Usage: verify_md5.sh <host> <listfile>   e.g. verify_md5.sh staging.virtuse.com /tmp/fr_files.txt
# listfile: one site-relative path per line (e.g. fr/concierge.html).
W=/private/tmp/gh-pages-wt3; HOST=$1; ok=0; bad=0
while read -r rel; do [ -z "$rel" ] && continue
  l=$(md5 -q "$W/$rel"); r=$(curl -s -H 'Cache-Control: no-cache' "https://$HOST/$rel?cb=$RANDOM$RANDOM" | md5 -q)
  if [ "$l" = "$r" ]; then ok=$((ok+1)); else bad=$((bad+1)); echo "MISMATCH $rel"; fi
done < "$2"; echo "$HOST: $ok match, $bad mismatch"
