#!/usr/bin/env python3
"""
Add the CS option to a page that's already wired for EN/SK/UK: inserts
hreflang="cs" into the root English page and its sk/ and uk/ siblings, and
extends all three pages' language switcher (mobile pill list + desktop
dropdown) with a new CS entry. Idempotent -- skips a file that already has
hreflang="cs".

Structural note (read before copying this for language #5): this is NOT a
straight copy of wire_uk_into_existing.py's desktop-switcher logic. That
script targeted the OLD 3-pill `.lang-switch.nav-lang-switch` row, because
at the time it ran, dropdown_retrofit.py hadn't converted the desktop
switcher to the compact dropdown yet (that conversion happened *after*
UK was wired in, preserving the by-then-3-pill EN/SK/UA row into the
dropdown). Since dropdown_retrofit.py has already run by the time Czech
is being added, every real page's desktop switcher is `.lang-menu-panel`,
not the old pill markup -- so this script targets that instead. If a 5th
language is added after this one, the situation is unchanged (dropdown
stays the dropdown), so this version's approach is the one to keep
copying, not wire_uk_into_existing.py's.

This is the "extend every language switcher site-wide" step described in
TRANSLATION-SYSTEM.md's "Adding the next language" section, applied to
Czech. Run once per page, AFTER cs/<page>.html has been scaffolded (see
scaffold_cs.py) and after sitemap_add_cs.py.

Usage: python3 wire_cs_into_existing.py <page.html>
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CS_FLAG = "🇨🇿"


def add_hreflang(s, page, cs_href):
    if 'hreflang="cs"' in s:
        return s, False
    cs_line = f'<link rel="alternate" hreflang="cs" href="https://staging.virtuse.com/{cs_href}">\n'
    marker = f'<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}">\n'
    if marker not in s:
        print("  WARNING: x-default hreflang line not found, hreflang(cs) NOT inserted")
        return s, False
    return s.replace(marker, cs_line + marker, 1), True


def add_switch_option(s, cs_link_href):
    changed = False

    # mobile li block (unchanged pill-list markup since the SK rollout)
    li_pat = re.compile(
        r'(<div class="lang-switch" role="navigation" aria-label="[^"]*">\n'
        r'(?:.*\n)*?)(      </div>\n    </li>)'
    )
    def li_sub(m):
        nonlocal changed
        block = m.group(1)
        if 'lang="cs"' in block:
            return m.group(0)
        changed = True
        new_a = f'        <a href="{cs_link_href}" class="lang-opt" lang="cs"><span class="lang-flag">{CS_FLAG}</span>CS</a>\n'
        return block + new_a + m.group(2)
    s = li_pat.sub(li_sub, s, count=1)

    # desktop switcher: the compact dropdown's .lang-menu-panel (NOT the
    # old .lang-switch.nav-lang-switch pill row -- see module docstring)
    panel_pat = re.compile(
        r'(<div class="lang-menu-panel" id="langMenuPanel" role="menu">\n'
        r'(?:.*\n)*?)(      </div>\n)'
    )
    def panel_sub(m):
        nonlocal changed
        block = m.group(1)
        if 'lang="cs"' in block:
            return m.group(0)
        changed = True
        new_a = f'        <a href="{cs_link_href}" class="lang-opt" lang="cs" role="menuitem"><span class="lang-flag">{CS_FLAG}</span>CS</a>\n'
        return block + new_a + m.group(2)
    s = panel_pat.sub(panel_sub, s, count=1)

    return s, changed


def process(path, page, cs_href_for_hreflang, cs_link_href):
    if not os.path.exists(path):
        print(f"  skip (not found): {path}")
        return
    with open(path, encoding="utf-8") as f:
        s = f.read()
    if 'hreflang="cs"' in s:
        print(f"  already wired: {path}")
        return
    s, hl_changed = add_hreflang(s, page, cs_href_for_hreflang)
    s, sw_changed = add_switch_option(s, cs_link_href)
    if not (hl_changed or sw_changed):
        print(f"  WARNING: nothing changed in {path} -- check patterns by hand (maybe still on the old pill switcher?)")
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"  wired: {path} (hreflang={hl_changed}, switch={sw_changed})")


def main():
    page = sys.argv[1]
    print(f"Wiring CS option into existing EN/SK/UK pages for {page}:")
    process(os.path.join(CONTENT_DIR, page), page, f"cs/{page}", f"cs/{page}")
    process(os.path.join(CONTENT_DIR, "sk", page), page, f"cs/{page}", f"../cs/{page}")
    process(os.path.join(CONTENT_DIR, "uk", page), page, f"cs/{page}", f"../cs/{page}")


if __name__ == "__main__":
    main()
