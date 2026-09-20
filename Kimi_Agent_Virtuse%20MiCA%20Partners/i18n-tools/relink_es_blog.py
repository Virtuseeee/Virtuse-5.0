#!/usr/bin/env python3
"""
One-time fixup, run exactly once after es/blog.html is created: flips every
es/*.html page's "Blog" links (nav item, and any hub/homepage blog teaser
link) from the temporary `../blog.html` (pointing at the English blog,
used while es/blog.html didn't exist yet) to the self-referencing
`blog.html` (resolves to the sibling es/blog.html).

Deliberately separate from relink_es.py, which only relinks page-to-page
nav links and explicitly excludes blog.html from its own glob -- see its
own docstring. This script only ever touches the literal string
`../blog.html`, so re-running it after this is a harmless no-op.
"""
import glob
import os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ES_DIR = os.path.join(CONTENT_DIR, "es")

pages = sorted(
    p for p in glob.glob(os.path.join(ES_DIR, "*.html"))
    if os.path.basename(p) != "blog.html"
)

total_changes = 0
for path in pages:
    with open(path, encoding="utf-8") as f:
        s = f.read()
    orig = s
    s = s.replace('href="../blog.html"', 'href="blog.html"')
    if s != orig:
        n = orig.count('href="../blog.html"')
        with open(path, "w", encoding="utf-8") as f:
            f.write(s)
        print(f"{os.path.basename(path)}: rewrote {n} blog link(s)")
        total_changes += 1

print(f"\nDone. {total_changes} files changed.")
