#!/usr/bin/env python3
"""
Add es/<page> to sitemap.xml: inserts hreflang="es" into every existing
<url> block for this page (the EN root entry, and the sk/, uk/, cs/,
ru/, de/, fr/ entries if they exist), then appends a new <url> block for
es/<page> with the full set of alternates. Adapted from sitemap_add_fr.py
for the 8th language -- see i18n-tools/README.md "Adding the next
language".

Uses the current canonical domain (virtuse.com, not staging.virtuse.com
-- see the 2026-09-15 CLAUDE.md entry "SEO canonicals repointed").

Usage: python3 sitemap_add_es.py <page.html>
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(CONTENT_DIR, "sitemap.xml")
DOMAIN = "https://virtuse.com"

page = sys.argv[1]
with open(SITEMAP, encoding="utf-8") as f:
    s = f.read()

# Match any <url>...</url> block whose <loc> ends with /<page>, regardless
# of language-folder prefix (root, sk/, uk/, cs/, ru/, de/, fr/, ...).
block_pat = re.compile(
    r'  <url>\n'
    r'    <loc>https://virtuse\.com/([\w./-]*?)' + re.escape(page) + r'</loc>\n'
    r'    <lastmod>[\d-]+</lastmod>\n'
    r'    <changefreq>(\w+)</changefreq>\n'
    r'    <priority>([\d.]+)</priority>\n'
    r'(?:    <xhtml:link[^\n]*\n)*'
    r'  </url>\n'
)

matches = list(block_pat.finditer(s))
if not matches:
    print("PATTERN NOT FOUND for", page)
    sys.exit(1)

if any('hreflang="es"' in m.group(0) for m in matches):
    print("Already has es entry for", page)
    sys.exit(0)

has_sk = any(m.group(1) == "sk/" for m in matches)
has_uk = any(m.group(1) == "uk/" for m in matches)
has_cs = any(m.group(1) == "cs/" for m in matches)
has_ru = any(m.group(1) == "ru/" for m in matches)
has_de = any(m.group(1) == "de/" for m in matches)
has_fr = any(m.group(1) == "fr/" for m in matches)
changefreq, priority = matches[0].group(2), matches[0].group(3)

es_hreflang_line = f'    <xhtml:link rel="alternate" hreflang="es" href="{DOMAIN}/es/{page}"/>\n'

def insert_es_line(block_text):
    marker = f'    <xhtml:link rel="alternate" hreflang="x-default" href="{DOMAIN}/{page}"/>\n'
    if marker not in block_text:
        return block_text
    return block_text.replace(marker, es_hreflang_line + marker, 1)

# Rebuild the file: walk matches in order, patch each block in place, and
# after the LAST matched block insert the brand-new es/<page> block.
out = []
last_end = 0
for m in matches:
    out.append(s[last_end:m.start()])
    out.append(insert_es_line(m.group(0)))
    last_end = m.end()
out.append(s[last_end:])
s = "".join(out)

alt_lines = [
    f'    <xhtml:link rel="alternate" hreflang="en" href="{DOMAIN}/{page}"/>\n',
]
if has_sk:
    alt_lines.append(f'    <xhtml:link rel="alternate" hreflang="sk" href="{DOMAIN}/sk/{page}"/>\n')
if has_uk:
    alt_lines.append(f'    <xhtml:link rel="alternate" hreflang="uk" href="{DOMAIN}/uk/{page}"/>\n')
if has_cs:
    alt_lines.append(f'    <xhtml:link rel="alternate" hreflang="cs" href="{DOMAIN}/cs/{page}"/>\n')
if has_ru:
    alt_lines.append(f'    <xhtml:link rel="alternate" hreflang="ru" href="{DOMAIN}/ru/{page}"/>\n')
if has_de:
    alt_lines.append(f'    <xhtml:link rel="alternate" hreflang="de" href="{DOMAIN}/de/{page}"/>\n')
if has_fr:
    alt_lines.append(f'    <xhtml:link rel="alternate" hreflang="fr" href="{DOMAIN}/fr/{page}"/>\n')
alt_lines.append(es_hreflang_line)
alt_lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{DOMAIN}/{page}"/>\n')

import datetime
today = datetime.date.today().isoformat()

es_block = (
    f'  <url>\n'
    f'    <loc>{DOMAIN}/es/{page}</loc>\n'
    f'    <lastmod>{today}</lastmod>\n'
    f'    <changefreq>{changefreq}</changefreq>\n'
    f'    <priority>{priority}</priority>\n'
    + "".join(alt_lines) +
    f'  </url>\n'
)

# Re-find insertion point: right after the last block for this page.
matches2 = list(block_pat.finditer(s))
insert_at = matches2[-1].end()
s = s[:insert_at] + es_block + s[insert_at:]

with open(SITEMAP, "w", encoding="utf-8") as f:
    f.write(s)
print("Updated sitemap for es/" + page, f"(sk: {has_sk}, uk: {has_uk}, cs: {has_cs}, ru: {has_ru}, de: {has_de}, fr: {has_fr})")
