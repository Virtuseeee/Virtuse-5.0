#!/usr/bin/env python3
"""
Add the UK option to a page that's already wired for EN/SK: inserts
hreflang="uk" into both the root English page and its sk/ sibling, and
extends both pages' .lang-switch (nav + mobile) from a 2-option EN/SK pill
to a 3-option EN/SK/UK row. Idempotent -- skips a file that already has
hreflang="uk".

This is the "extend every .lang-switch block site-wide" step described in
TRANSLATION-SYSTEM.md's "Adding a second language later" section, applied
to UK. Run once per page, AFTER uk/<page>.html has been scaffolded (see
scaffold_uk.py) and after sitemap_add_uk.py.

Usage: python3 wire_uk_into_existing.py <page.html>
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

UK_FLAG = "🇺🇦"


def add_hreflang(s, page, uk_href):
    if f'hreflang="uk"' in s:
        return s, False
    uk_line = f'<link rel="alternate" hreflang="uk" href="https://staging.virtuse.com/{uk_href}">\n'
    # insert right before the x-default line
    marker = f'<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}">\n'
    if marker not in s:
        print("  WARNING: x-default hreflang line not found, hreflang(uk) NOT inserted")
        return s, False
    return s.replace(marker, uk_line + marker, 1), True


def add_switch_option(s, uk_link_href, aria_label_word):
    changed = False
    # mobile li block: insert new <a> right before the closing </div>\n    </li>
    li_pat = re.compile(
        r'(<div class="lang-switch" role="navigation" aria-label="[^"]*">\n'
        r'(?:.*\n)*?)(      </div>\n    </li>)'
    )
    def li_sub(m):
        nonlocal changed
        block = m.group(1)
        if 'lang="uk"' in block:
            return m.group(0)
        changed = True
        new_a = f'        <a href="{uk_link_href}" class="lang-opt" lang="uk"><span class="lang-flag">{UK_FLAG}</span>UA</a>\n'
        return block + new_a + m.group(2)
    s = li_pat.sub(li_sub, s, count=1)

    # desktop nav div block
    nav_pat = re.compile(
        r'(<div class="lang-switch nav-lang-switch" role="navigation" aria-label="[^"]*">\n'
        r'(?:.*\n)*?)(  </div>\n)'
    )
    def nav_sub(m):
        nonlocal changed
        block = m.group(1)
        if 'lang="uk"' in block:
            return m.group(0)
        changed = True
        new_a = f'    <a href="{uk_link_href}" class="lang-opt" lang="uk"><span class="lang-flag">{UK_FLAG}</span>UA</a>\n'
        return block + new_a + m.group(2)
    s = nav_pat.sub(nav_sub, s, count=1)

    return s, changed


def process(path, page, uk_href_for_hreflang, uk_link_href, label):
    if not os.path.exists(path):
        print(f"  skip (not found): {path}")
        return
    with open(path, encoding="utf-8") as f:
        s = f.read()
    if 'hreflang="uk"' in s:
        print(f"  already wired: {path}")
        return
    s, hl_changed = add_hreflang(s, page, uk_href_for_hreflang)
    s, sw_changed = add_switch_option(s, uk_link_href, label)
    if not (hl_changed or sw_changed):
        print(f"  WARNING: nothing changed in {path} -- check patterns by hand")
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"  wired: {path} (hreflang={hl_changed}, switch={sw_changed})")


def main():
    page = sys.argv[1]
    print(f"Wiring UK option into existing EN/SK pages for {page}:")
    process(os.path.join(CONTENT_DIR, page), page, f"uk/{page}", f"uk/{page}", "EN")
    process(os.path.join(CONTENT_DIR, "sk", page), page, f"uk/{page}", f"../uk/{page}", "SK")


if __name__ == "__main__":
    main()
