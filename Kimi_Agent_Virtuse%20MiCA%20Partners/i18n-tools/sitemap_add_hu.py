#!/usr/bin/env python3
"""Add Hungarian to sitemap.xml in one pass.

Every <url> group that already lists a pl/<page> alternate and has a
hu/<page> file on disk gets:
  * a hreflang="hu" alternate after the hreflang="pl" one, in every block
    of that group;
  * a new <url> block for hu/<page> (a copy of the pl/<page> block with
    the <loc> and <lastmod> swapped), inserted right after it.
Idempotent: a block that already carries hreflang="hu" is left alone.

Usage: python3 i18n-tools/sitemap_add_hu.py
"""
import datetime
import os
import re
import xml.dom.minidom

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(ROOT, "sitemap.xml")
DOMAIN = "https://virtuse.com"

BLOCK = re.compile(r"  <url>\n.*?  </url>\n", re.S)
ES_ALT = re.compile(r'( *)<xhtml:link rel="alternate" hreflang="pl" href="%s/pl/([^"]+)"/>\n' % re.escape(DOMAIN))


def main():
    s = open(SITEMAP, encoding="utf-8").read()
    today = datetime.date.today().isoformat()
    stats = {"alternates": 0, "blocks": 0}

    def fix(m):
        block = m.group(0)
        if 'hreflang="hu"' in block:
            return block
        alt = ES_ALT.search(block)
        if not alt or not os.path.exists(os.path.join(ROOT, "hu", alt.group(2))):
            return block
        page = alt.group(2)
        pl_line = '%s<xhtml:link rel="alternate" hreflang="hu" href="%s/hu/%s"/>\n' % (alt.group(1), DOMAIN, page)
        block = block[:alt.end()] + pl_line + block[alt.end():]
        stats["alternates"] += 1
        if "<loc>%s/pl/%s</loc>" % (DOMAIN, page) in block:
            pl_block = block.replace("<loc>%s/pl/%s</loc>" % (DOMAIN, page), "<loc>%s/hu/%s</loc>" % (DOMAIN, page))
            pl_block = re.sub(r"<lastmod>[\d-]+</lastmod>", "<lastmod>%s</lastmod>" % today, pl_block)
            stats["blocks"] += 1
            return block + pl_block
        return block

    s = BLOCK.sub(fix, s)
    xml.dom.minidom.parseString(s.encode("utf-8"))  # must stay well-formed
    with open(SITEMAP, "w", encoding="utf-8") as fh:
        fh.write(s)
    print(stats)


if __name__ == "__main__":
    main()
