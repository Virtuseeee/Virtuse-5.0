#!/usr/bin/env python3
"""Add hreflang tags + nav language switcher to the ROOT English page,
pointing at its sk/ counterpart. Usage: python3 wire_root.py <page.html>
"""
import sys, re

CONTENT_DIR = "/Users/rasvas/Library/CloudStorage/OneDrive-VirtuseWealthManagement,a.s/Virtu AI/Kimi_Agent_Virtuse%20MiCA%20Partners"

page = sys.argv[1]
path = f"{CONTENT_DIR}/{page}"
with open(path, encoding="utf-8") as f:
    s = f.read()

if 'hreflang="sk"' in s:
    print("Already wired:", page)
    sys.exit(0)

hreflang = (
    f'<link rel="alternate" hreflang="en" href="https://staging.virtuse.com/{page}">\n'
    f'<link rel="alternate" hreflang="sk" href="https://staging.virtuse.com/sk/{page}">\n'
    f'<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}">\n'
)
old_link = '<link rel="shortcut icon" href="favicon.ico">\n'
if old_link not in s:
    print("shortcut icon line not found for", page)
    sys.exit(1)
s = s.replace(old_link, old_link + hreflang, 1)

lang_block_li = (
    f'    <li class="nav-links-lang-item">\n'
    f'      <div class="lang-switch" role="navigation" aria-label="Page language">\n'
    f'        <a href="{page}" class="lang-opt active" lang="en"><span class="lang-flag">🇬🇧</span>EN</a>\n'
    f'        <a href="sk/{page}" class="lang-opt" lang="sk"><span class="lang-flag">🇸🇰</span>SK</a>\n'
    f'      </div>\n'
    f'    </li>\n'
)
nav_switch_div = (
    f'  <div class="lang-switch nav-lang-switch" role="navigation" aria-label="Page language">\n'
    f'    <a href="{page}" class="lang-opt active" lang="en"><span class="lang-flag">🇬🇧</span>EN</a>\n'
    f'    <a href="sk/{page}" class="lang-opt" lang="sk"><span class="lang-flag">🇸🇰</span>SK</a>\n'
    f'  </div>\n'
)
old_tail = '  </ul>\n  <button class="nav-cta">Get Started</button>\n</nav>'
new_tail = lang_block_li + f'  </ul>\n{nav_switch_div}  <button class="nav-cta">Get Started</button>\n</nav>'
if old_tail in s:
    s = s.replace(old_tail, new_tail, 1)
else:
    print("WARNING: nav tail pattern not found for", page, "- lang switch NOT inserted")

with open(path, "w", encoding="utf-8") as f:
    f.write(s)
print("Wired root page:", page)
