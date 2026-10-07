#!/usr/bin/env python3
"""Swap the Google Tag Manager container ID on every site page.

  swap_gtm.py OLD NEW            e.g. swap_gtm.py GTM-M4C5VRD GTM-KXX4Q6WH
  swap_gtm.py OLD NEW --check    count only, change nothing

Walks every .html file under the site folder (pages, module shells, story
pages, the blog template in i18n-tools/). A file that mentions OLD must
mention it exactly once (the GTM loader); anything else stops the run before
a single file is written. Run it again after building pages from an old copy.
Rollback = the same command with OLD and NEW swapped.
"""
import os
import re
import sys

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ID = re.compile(r'^GTM-[A-Z0-9]{6,10}$')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--check' in sys.argv
    if len(args) != 2 or not all(ID.match(a) for a in args) or args[0] == args[1]:
        sys.exit(__doc__)
    old, new = args
    hits, bad = [], []
    for root, dirs, files in os.walk(SITE):
        dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules')]
        for name in files:
            if not name.endswith('.html'):
                continue
            path = os.path.join(root, name)
            text = open(path, encoding='utf-8').read()
            n = text.count(old)
            if n == 1:
                hits.append((path, text))
            elif n > 1:
                bad.append(f'{os.path.relpath(path, SITE)}: {n}x')
    if bad:
        sys.exit('stopped, nothing written; expected one occurrence per file:\n  ' + '\n  '.join(bad))
    print(f'{len(hits)} files with {old}')
    if check:
        return
    for path, text in hits:
        open(path, 'w', encoding='utf-8').write(text.replace(old, new))
    print(f'{len(hits)} files now use {new}')


if __name__ == '__main__':
    main()
