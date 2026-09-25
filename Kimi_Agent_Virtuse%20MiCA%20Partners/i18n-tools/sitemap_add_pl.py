#!/usr/bin/env python3
"""Add Polish to sitemap.xml in one pass.

Every <url> group that already lists an es/<page> alternate and has a
pl/<page> file on disk gets:
  * a hreflang="pl" alternate after the hreflang="es" one, in every block
    of that group;
  * a new <url> block for pl/<page> (a copy of the es/<page> block with
    the <loc> and <lastmod> swapped), inserted right after it.
Idempotent: a block that already carries hreflang="pl" is left alone.

Usage: python3 i18n-tools/sitemap_add_pl.py
"""
import datetime
import os
import re
import xml.dom.minidom

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(ROOT, "sitemap.xml")
DOMAIN = "https://virtuse.com"

BLOCK = re.compile(r"  <url>\n.*?  </url>\n", re.S)
ES_ALT = re.compile(r'( *)<xhtml:link rel="alternate" hreflang="es" href="%s/es/([^"]+)"/>\n' % re.escape(DOMAIN))


def main():
    s = open(SITEMAP, encoding="utf-8").read()
    today = datetime.date.today().isoformat()
    stats = {"alternates": 0, "blocks": 0}

    def fix(m):
        block = m.group(0)
        if 'hreflang="pl"' in block:
            return block
        alt = ES_ALT.search(block)
        if not alt or not os.path.exists(os.path.join(ROOT, "pl", alt.group(2))):
            return block
        page = alt.group(2)
        pl_line = '%s<xhtml:link rel="alternate" hreflang="pl" href="%s/pl/%s"/>\n' % (alt.group(1), DOMAIN, page)
        block = block[:alt.end()] + pl_line + block[alt.end():]
        stats["alternates"] += 1
        if "<loc>%s/es/%s</loc>" % (DOMAIN, page) in block:
            pl_block = block.replace("<loc>%s/es/%s</loc>" % (DOMAIN, page), "<loc>%s/pl/%s</loc>" % (DOMAIN, page))
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
