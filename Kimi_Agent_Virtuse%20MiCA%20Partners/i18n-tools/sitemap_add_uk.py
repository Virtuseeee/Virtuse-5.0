#!/usr/bin/env python3
"""
Add uk/<page> to sitemap.xml: inserts hreflang="uk" into every existing
<url> block for this page (the EN root entry, and the sk/ entry if it
exists), then appends a new <url> block for uk/<page> with the full set of
alternates. Generalized version of sitemap_add.py for a 3rd+ language --
see i18n-tools/README.md "Adding language #2".

Usage: python3 sitemap_add_uk.py <page.html>
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(CONTENT_DIR, "sitemap.xml")

page = sys.argv[1]
with open(SITEMAP, encoding="utf-8") as f:
    s = f.read()

# Match any <url>...</url> block whose <loc> ends with /<page>, regardless
# of language-folder prefix (root, sk/, ...).
block_pat = re.compile(
    r'  <url>\n'
    r'    <loc>https://staging\.virtuse\.com/([\w./-]*?)' + re.escape(page) + r'</loc>\n'
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

if any('hreflang="uk"' in m.group(0) for m in matches):
    print("Already has uk entry for", page)
    sys.exit(0)

has_sk = any(m.group(1) == "sk/" for m in matches)
changefreq, priority = matches[0].group(2), matches[0].group(3)

uk_hreflang_line = f'    <xhtml:link rel="alternate" hreflang="uk" href="https://staging.virtuse.com/uk/{page}"/>\n'

def insert_uk_line(block_text):
    marker = f'    <xhtml:link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}"/>\n'
    if marker not in block_text:
        return block_text
    return block_text.replace(marker, uk_hreflang_line + marker, 1)

# Rebuild the file: walk matches in order, patch each block in place, and
# after the LAST matched block insert the brand-new uk/<page> block.
out = []
last_end = 0
for m in matches:
    out.append(s[last_end:m.start()])
    out.append(insert_uk_line(m.group(0)))
    last_end = m.end()
out.append(s[last_end:])
s = "".join(out)

alt_lines = [
    f'    <xhtml:link rel="alternate" hreflang="en" href="https://staging.virtuse.com/{page}"/>\n',
]
if has_sk:
    alt_lines.append(f'    <xhtml:link rel="alternate" hreflang="sk" href="https://staging.virtuse.com/sk/{page}"/>\n')
alt_lines.append(uk_hreflang_line)
alt_lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}"/>\n')

uk_block = (
    f'  <url>\n'
    f'    <loc>https://staging.virtuse.com/uk/{page}</loc>\n'
    f'    <lastmod>2026-08-24</lastmod>\n'
    f'    <changefreq>{changefreq}</changefreq>\n'
    f'    <priority>{priority}</priority>\n'
    + "".join(alt_lines) +
    f'  </url>\n'
)

# Re-find insertion point: right after the last block for this page.
matches2 = list(block_pat.finditer(s))
insert_at = matches2[-1].end()
s = s[:insert_at] + uk_block + s[insert_at:]

with open(SITEMAP, "w", encoding="utf-8") as f:
    f.write(s)
print("Updated sitemap for uk/" + page, "(sk sibling found)" if has_sk else "(no sk sibling)")
