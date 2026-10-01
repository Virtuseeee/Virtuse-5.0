#!/usr/bin/env python3
"""Give every hub page a <meta name="description">.

Most hub pages (EN and all nine translations) only carried og:description
and twitter:description; search engines read name="description". This
copies each page's own og:description (already in the page language) into
a name="description" tag placed right after <title>. Pages that already
have one, or have no og:description, are left alone and reported.

Covers the top-level .html files of the root and of every language folder
(not the generated SEO subfolders or story pages, which have their own).

Usage: python3 i18n-tools/add_meta_description.py [--dry-run]
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDERS = ["", "sk", "uk", "cs", "ru", "de", "fr", "es", "pl", "hu"]

OG = re.compile(r'<meta property="og:description" content="([^"]*)">')
TITLE = re.compile(r"(<title>[^<]*</title>\n)")


def main():
    dry = "--dry-run" in sys.argv
    added, skipped = 0, []
    for folder in FOLDERS:
        d = os.path.join(ROOT, folder)
        for name in sorted(os.listdir(d)):
            if not name.endswith(".html"):
                continue
            path = os.path.join(d, name)
            s = open(path, encoding="utf-8").read()
            rel = os.path.join(folder, name)
            if 'name="description"' in s:
                continue
            og = OG.search(s)
            if not og:
                skipped.append(rel + " (no og:description)")
                continue
            tag = '<meta name="description" content="%s">\n' % og.group(1)
            s2, n = TITLE.subn(lambda m: m.group(1) + tag, s, count=1)
            if not n:
                skipped.append(rel + " (no <title> line)")
                continue
            added += 1
            if not dry:
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(s2)
    print("added: %d%s" % (added, " (dry run)" if dry else ""))
    for x in skipped:
        print("  skipped:", x)


if __name__ == "__main__":
    main()
