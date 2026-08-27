#!/usr/bin/env python3
"""
Retroactive fixup: pages were translated in batches, so each page's nav/
footer links to pages that didn't have a uk/ counterpart *yet* were
correctly left pointing at the English original (`../page.html`). Once
another page gets its uk/ counterpart, those links should point at the
sibling Ukrainian page instead (`page.html`). This rewrites all of them in
one pass -- run once after a batch of pages is complete (see relink_sk.py,
this is the same fixup for the uk/ rollout).

Excludes: the page's own `../<self>.html` (that's the intentional EN
language-switcher link, must keep pointing at root) and blog.html
(deliberately not part of uk/, no Ukrainian WordPress category exists yet
-- see TRANSLATION-SYSTEM.md's "Known gap").
"""
import glob
import os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UK_DIR = os.path.join(CONTENT_DIR, "uk")

pages = sorted(
    os.path.splitext(os.path.basename(p))[0]
    for p in glob.glob(os.path.join(UK_DIR, "*.html"))
)

total_changes = 0
for page in pages:
    path = os.path.join(UK_DIR, f"{page}.html")
    with open(path, encoding="utf-8") as f:
        s = f.read()
    orig = s
    for other in pages:
        if other == page:
            continue  # never touch the self-referential EN switcher link
        s = s.replace(f'href="../{other}.html"', f'href="{other}.html"')
    if s != orig:
        with open(path, "w", encoding="utf-8") as f:
            f.write(s)
        print(f"{page}.html: rewrote links")
        total_changes += 1

print(f"\nDone. {total_changes} files changed.")
