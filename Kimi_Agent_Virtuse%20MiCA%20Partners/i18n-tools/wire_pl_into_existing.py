#!/usr/bin/env python3
"""Add the PL option to every existing page that already offers ES.

For each .html file in the root and in sk/ uk/ cs/ ru/ de/ fr/ es/:
  * every language-switcher anchor for ES (desktop dropdown, mobile
    dropdown, blog hero pills) gets a PL sibling right after it, with
    the href derived from the ES one;
  * the hreflang="es" <link> gets a hreflang="pl" line after it.
Both happen only when the Polish counterpart file actually exists, so a
page with no pl/ sibling is left alone. Idempotent: a switcher block that
already has lang="pl" is skipped.

Unlike the per-page wire_<lang>_into_existing.py scripts this walks the
whole site in one pass, because the redesign has two .lang-menu panels
per page (desktop + mobile) and the per-page scripts only knew the old
mobile pill row.

Usage: python3 i18n-tools/wire_pl_into_existing.py [--dry-run]
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDERS = ["", "sk", "uk", "cs", "ru", "de", "fr", "es"]

ES_A = re.compile(r'(?P<indent>[ \t]*)(?P<a><a (?P<pre>[^>]*?)href="(?P<href>[^"]*)" class="lang-opt(?: active)?" lang="es"'
                  r'(?P<rest>[^>]*)><span class="lang-flag">🇪🇸</span>ES</a>)')
ES_LINK = re.compile(r'(?P<indent>[ \t]*)<link rel="alternate" hreflang="es" href="https://virtuse\.com/(?P<path>[^"]*)">\n')


def pl_href(es_href, folder):
    if folder == "es" and "/" not in es_href:
        return "../pl/" + es_href
    new, n = re.subn(r"(^|/)es/", r"\1pl/", es_href, count=1)
    return new if n else None


def exists(href, folder):
    path = href.split("?")[0].split("#")[0]
    if path.endswith("/"):
        path += "index.html"
    return os.path.exists(os.path.normpath(os.path.join(ROOT, folder, path)))


def process(folder, name, dry):
    path = os.path.join(ROOT, folder, name)
    s = open(path, encoding="utf-8").read()
    if 'lang="es"' not in s and 'hreflang="es"' not in s:
        return None
    added = {"switch": 0, "hreflang": 0}

    def sub_a(m):
        # Skip if a PL option already follows this ES one.
        tail = s[m.end():m.end() + 300]
        if 'lang="pl"' in tail.split("</div>")[0]:
            return m.group(0)
        href = pl_href(m.group("href"), folder)
        if not href or not exists(href, folder):
            return m.group(0)
        added["switch"] += 1
        new = ('<a %shref="%s" class="lang-opt" lang="pl"%s><span class="lang-flag">🇵🇱</span>PL</a>'
               % (m.group("pre"), href, m.group("rest")))
        return m.group(0) + "\n" + m.group("indent") + new

    s2 = ES_A.sub(sub_a, s)

    def sub_link(m):
        if 'hreflang="pl"' in s:
            return m.group(0)
        pl_path, n = re.subn(r"(^|/)es(/|$)", r"\1pl\2", m.group("path"), count=1)
        if not n or not exists(pl_path, ""):
            return m.group(0)
        added["hreflang"] += 1
        return m.group(0) + '%s<link rel="alternate" hreflang="pl" href="https://virtuse.com/%s">\n' % (
            m.group("indent"), pl_path)

    s2 = ES_LINK.sub(sub_link, s2)
    if s2 != s and not dry:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(s2)
    return added


def main():
    dry = "--dry-run" in sys.argv
    total = {"files": 0, "switch": 0, "hreflang": 0}
    for folder in FOLDERS:
        d = os.path.join(ROOT, folder)
        for name in sorted(os.listdir(d)):
            if not name.endswith(".html"):
                continue
            r = process(folder, name, dry)
            if not r or not (r["switch"] or r["hreflang"]):
                continue
            total["files"] += 1
            total["switch"] += r["switch"]
            total["hreflang"] += r["hreflang"]
            print("%-34s switch %d  hreflang %d" % (os.path.join(folder, name), r["switch"], r["hreflang"]))
    print("TOTAL", total, "(dry run)" if dry else "")


if __name__ == "__main__":
    main()
