#!/usr/bin/env python3
"""Add hreflang alternates to an existing sitemap <url> entry and insert the
sk/ counterpart entry right after it. Usage: python3 sitemap_add.py <page.html>
"""
import sys, re

SITEMAP = "/Users/rasvas/Library/CloudStorage/OneDrive-VirtuseWealthManagement,a.s/Virtu AI/Kimi_Agent_Virtuse%20MiCA%20Partners/sitemap.xml"

page = sys.argv[1]
with open(SITEMAP, encoding="utf-8") as f:
    s = f.read()

pat = re.compile(
    r'  <url>\n'
    r'    <loc>https://staging\.virtuse\.com/' + re.escape(page) + r'</loc>\n'
    r'    <lastmod>[\d-]+</lastmod>\n'
    r'    <changefreq>(\w+)</changefreq>\n'
    r'    <priority>([\d.]+)</priority>\n'
    r'  </url>\n'
)
m = pat.search(s)
if not m:
    print("PATTERN NOT FOUND for", page)
    sys.exit(1)

changefreq, priority = m.group(1), m.group(2)
en_block = (
    f'  <url>\n'
    f'    <loc>https://staging.virtuse.com/{page}</loc>\n'
    f'    <lastmod>2026-08-23</lastmod>\n'
    f'    <changefreq>{changefreq}</changefreq>\n'
    f'    <priority>{priority}</priority>\n'
    f'    <xhtml:link rel="alternate" hreflang="en" href="https://staging.virtuse.com/{page}"/>\n'
    f'    <xhtml:link rel="alternate" hreflang="sk" href="https://staging.virtuse.com/sk/{page}"/>\n'
    f'    <xhtml:link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}"/>\n'
    f'  </url>\n'
)
sk_block = (
    f'  <url>\n'
    f'    <loc>https://staging.virtuse.com/sk/{page}</loc>\n'
    f'    <lastmod>2026-08-23</lastmod>\n'
    f'    <changefreq>{changefreq}</changefreq>\n'
    f'    <priority>{priority}</priority>\n'
    f'    <xhtml:link rel="alternate" hreflang="en" href="https://staging.virtuse.com/{page}"/>\n'
    f'    <xhtml:link rel="alternate" hreflang="sk" href="https://staging.virtuse.com/sk/{page}"/>\n'
    f'    <xhtml:link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}"/>\n'
    f'  </url>\n'
)
s = s[:m.start()] + en_block + sk_block + s[m.end():]
with open(SITEMAP, "w", encoding="utf-8") as f:
    f.write(s)
print("Updated sitemap for", page)
