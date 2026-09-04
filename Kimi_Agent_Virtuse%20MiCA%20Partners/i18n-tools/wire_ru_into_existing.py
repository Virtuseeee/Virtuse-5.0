#!/usr/bin/env python3
"""
Add the RU option to a page that's already wired for EN/SK/UK/CS: inserts
hreflang="ru" into the root English page and its sk/, uk/, cs/ siblings,
and extends all four pages' language switcher (mobile pill list + desktop
dropdown) with a new RU entry. Idempotent -- skips a file that already has
hreflang="ru".

Adapted from wire_cs_into_existing.py (see i18n-tools/README.md "Adding
the next language"): targets the compact .lang-menu-panel dropdown (not
the old .lang-switch.nav-lang-switch pill row), same as the CS version --
every real page has had the dropdown since dropdown_retrofit.py / the CS
rollout, so there's no fallback path needed here.

Run once per page, AFTER ru/<page>.html has been scaffolded (see
scaffold_ru.py) and after sitemap_add_ru.py.

Usage: python3 wire_ru_into_existing.py <page.html>
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RU_FLAG = "🇷🇺"


def add_hreflang(s, page, ru_href):
    if 'hreflang="ru"' in s:
        return s, False
    ru_line = f'<link rel="alternate" hreflang="ru" href="https://staging.virtuse.com/{ru_href}">\n'
    marker = f'<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}">\n'
    if marker not in s:
        print("  WARNING: x-default hreflang line not found, hreflang(ru) NOT inserted")
        return s, False
    return s.replace(marker, ru_line + marker, 1), True


def add_switch_option(s, ru_link_href):
    changed = False

    # mobile li block
    li_pat = re.compile(
        r'(<div class="lang-switch" role="navigation" aria-label="[^"]*">\n'
        r'(?:.*\n)*?)(      </div>\n    </li>)'
    )
    def li_sub(m):
        nonlocal changed
        block = m.group(1)
        if 'lang="ru"' in block:
            return m.group(0)
        changed = True
        new_a = f'        <a href="{ru_link_href}" class="lang-opt" lang="ru"><span class="lang-flag">{RU_FLAG}</span>RU</a>\n'
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
        if 'lang="ru"' in block:
            return m.group(0)
        changed = True
        new_a = f'        <a href="{ru_link_href}" class="lang-opt" lang="ru" role="menuitem"><span class="lang-flag">{RU_FLAG}</span>RU</a>\n'
        return block + new_a + m.group(2)
    s = panel_pat.sub(panel_sub, s, count=1)

    return s, changed


def process(path, page, ru_href_for_hreflang, ru_link_href):
    if not os.path.exists(path):
        print(f"  skip (not found): {path}")
        return
    with open(path, encoding="utf-8") as f:
        s = f.read()
    if 'hreflang="ru"' in s:
        print(f"  already wired: {path}")
        return
    s, hl_changed = add_hreflang(s, page, ru_href_for_hreflang)
    s, sw_changed = add_switch_option(s, ru_link_href)
    if not (hl_changed or sw_changed):
        print(f"  WARNING: nothing changed in {path} -- check patterns by hand")
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"  wired: {path} (hreflang={hl_changed}, switch={sw_changed})")


def main():
    page = sys.argv[1]
    print(f"Wiring RU option into existing EN/SK/UK/CS pages for {page}:")
    process(os.path.join(CONTENT_DIR, page), page, f"ru/{page}", f"ru/{page}")
    process(os.path.join(CONTENT_DIR, "sk", page), page, f"ru/{page}", f"../ru/{page}")
    process(os.path.join(CONTENT_DIR, "uk", page), page, f"ru/{page}", f"../ru/{page}")
    process(os.path.join(CONTENT_DIR, "cs", page), page, f"ru/{page}", f"../ru/{page}")


if __name__ == "__main__":
    main()
