#!/usr/bin/env python3
"""
Retroactive fixup: pages were translated in batches, so each page's nav/
footer links to pages that didn't have a sk/ counterpart *yet* were
correctly left pointing at the English original (`../page.html`). Once
every page has a sk/ counterpart, those links should point at the sibling
Slovak page instead (`page.html`). This rewrites all of them in one pass,
run once after a batch of pages is complete.

Excludes: the page's own `../<self>.html` (that's the intentional EN
language-switcher link, must keep pointing at root) and
blog.html/blog-sk.html/article.html (deliberately not part of sk/, see
TRANSLATION-SYSTEM.md).
"""
import glob
import os
import re

SK_DIR = "/Users/rasvas/Library/CloudStorage/OneDrive-VirtuseWealthManagement,a.s/Virtu AI/Kimi_Agent_Virtuse%20MiCA%20Partners/sk"

pages = sorted(
    os.path.splitext(os.path.basename(p))[0]
    for p in glob.glob(os.path.join(SK_DIR, "*.html"))
)

total_changes = 0
for page in pages:
    path = os.path.join(SK_DIR, f"{page}.html")
    with open(path, encoding="utf-8") as f:
        s = f.read()
    orig = s
    for other in pages:
        if other == page:
            continue  # never touch the self-referential EN switcher link
        s = s.replace(f'href="../{other}.html"', f'href="{other}.html"')
    if s != orig:
        changed = sum(
            1 for a, b in zip(orig.split('href="'), s.split('href="')) if a != b
        )
        with open(path, "w", encoding="utf-8") as f:
            f.write(s)
        print(f"{page}.html: rewrote links")
        total_changes += 1

print(f"\nDone. {total_changes} files changed.")
