#!/usr/bin/env python3
"""Load partner-capture.js (step 2: registration steps by email after a partner
click) on every category page, right after the partner-click.js tag.

Category pages = pages that load partner-click.js, except news.html (the Brief
desk's page with a single partner ad). Idempotent; --check only counts.
"""
import glob, os, sys

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CLICK = '<script src="/partner-click.js" defer></script>'
TAG = '<script src="/partner-capture.js" defer></script>'
SKIP = {'news.html'}

changed = present = 0
for path in sorted(glob.glob(os.path.join(SITE, '*.html')) + glob.glob(os.path.join(SITE, '*', '*.html'))):
    rel = os.path.relpath(path, SITE)
    if rel in SKIP:
        continue
    text = open(path, encoding='utf-8').read()
    if CLICK not in text:
        continue
    if TAG in text:
        present += 1
        continue
    assert text.count(CLICK) == 1, rel
    changed += 1
    if '--check' not in sys.argv:
        open(path, 'w', encoding='utf-8').write(text.replace(CLICK, CLICK + '\n' + TAG))
print(f'{changed} pages {"to change" if "--check" in sys.argv else "changed"}, {present} already had it')
