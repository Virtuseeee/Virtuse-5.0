#!/usr/bin/env python3
"""
Add the FR option to a page that's already wired for EN/SK/UK/CS/RU/DE:
inserts hreflang="fr" into the root English page and its sk/, uk/, cs/,
ru/, de/ siblings, and extends all six pages' language switcher (mobile
pill list + desktop dropdown) with a new FR entry. Idempotent -- skips a
file that already has hreflang="fr".

Adapted from wire_de_into_existing.py (see i18n-tools/README.md "Adding
the next language"): targets the compact .lang-menu-panel dropdown, same
as every version since dropdown_retrofit.py -- no fallback path needed.

Run once per page, AFTER fr/<page>.html has been scaffolded (see
scaffold_fr.py) and after sitemap_add_fr.py.

Usage: python3 wire_fr_into_existing.py <page.html>
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FR_FLAG = "🇫🇷"


def add_hreflang(s, page, fr_href):
    if 'hreflang="fr"' in s:
        return s, False
    fr_line = f'<link rel="alternate" hreflang="fr" href="https://staging.virtuse.com/{fr_href}">\n'
    marker = f'<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}">\n'
    if marker not in s:
        print("  WARNING: x-default hreflang line not found, hreflang(fr) NOT inserted")
        return s, False
    return s.replace(marker, fr_line + marker, 1), True


def add_switch_option(s, fr_link_href):
    changed = False

    # mobile li block
    li_pat = re.compile(
        r'(<div class="lang-switch" role="navigation" aria-label="[^"]*">\n'
        r'(?:.*\n)*?)(      </div>\n    </li>)'
    )
    def li_sub(m):
        nonlocal changed
        block = m.group(1)
        if 'lang="fr"' in block:
            return m.group(0)
        changed = True
        new_a = f'        <a href="{fr_link_href}" class="lang-opt" lang="fr"><span class="lang-flag">{FR_FLAG}</span>FR</a>\n'
        return block + new_a + m.group(2)
    s = li_pat.sub(li_sub, s, count=1)

    # desktop switcher: the compact dropdown's .lang-menu-panel
    panel_pat = re.compile(
        r'(<div class="lang-menu-panel" id="langMenuPanel" role="menu">\n'
        r'(?:.*\n)*?)(      </div>\n)'
    )
    def panel_sub(m):
        nonlocal changed
        block = m.group(1)
        if 'lang="fr"' in block:
            return m.group(0)
        changed = True
        new_a = f'        <a href="{fr_link_href}" class="lang-opt" lang="fr" role="menuitem"><span class="lang-flag">{FR_FLAG}</span>FR</a>\n'
        return block + new_a + m.group(2)
    s = panel_pat.sub(panel_sub, s, count=1)

    return s, changed


def process(path, page, fr_href_for_hreflang, fr_link_href):
    if not os.path.exists(path):
        print(f"  skip (not found): {path}")
        return
    with open(path, encoding="utf-8") as f:
        s = f.read()
    if 'hreflang="fr"' in s:
        print(f"  already wired: {path}")
        return
    s, hl_changed = add_hreflang(s, page, fr_href_for_hreflang)
    s, sw_changed = add_switch_option(s, fr_link_href)
    if not (hl_changed or sw_changed):
        print(f"  WARNING: nothing changed in {path} -- check patterns by hand")
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"  wired: {path} (hreflang={hl_changed}, switch={sw_changed})")


def main():
    page = sys.argv[1]
    print(f"Wiring FR option into existing EN/SK/UK/CS/RU/DE pages for {page}:")
    process(os.path.join(CONTENT_DIR, page), page, f"fr/{page}", f"fr/{page}")
    process(os.path.join(CONTENT_DIR, "sk", page), page, f"fr/{page}", f"../fr/{page}")
    process(os.path.join(CONTENT_DIR, "uk", page), page, f"fr/{page}", f"../fr/{page}")
    process(os.path.join(CONTENT_DIR, "cs", page), page, f"fr/{page}", f"../fr/{page}")
    process(os.path.join(CONTENT_DIR, "ru", page), page, f"fr/{page}", f"../fr/{page}")
    process(os.path.join(CONTENT_DIR, "de", page), page, f"fr/{page}", f"../fr/{page}")


if __name__ == "__main__":
    main()
