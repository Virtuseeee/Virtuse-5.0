#!/usr/bin/env python3
"""
audit_parity.py — one reusable pass for every bug this project has now
found TWICE (once on sk/, once on cs/) because each language folder is a
static, hand-copied snapshot: a fix made in one language's own <style>
block never reaches any other language's copy of the same page.

Run this against every remaining language BEFORE it's asked for by name,
not after — that's the whole point. It captures every specific pattern
discovered while fixing sk/ and cs/ this session:

  1. .nav-cta padding/font-size drift (old 10px24px/14px base rule, or an
     override missing padding/font-size entirely) vs the sitewide
     7px14px/12px standard.
  2. The mobile-drawer specificity gap: a desktop
     `.nav-links a:not(.lang-opt) { font-size:13px; ... }` rule
     (specificity 0,2,1) silently beating the mobile drawer's own
     `.nav-links a { font-size:19px; ... }` rule (0,1,1) because the
     drawer rule never got the same :not(.lang-opt) qualifier — CSS
     resolves specificity before source order, so the drawer shrinks to
     desktop size regardless of which rule appears later in the file.
  3. bots.html-shaped pages: leftover .hero-bg/.hero-grid orange glow +
     orange hero highlight span (removed on EN's bots.html rounds ago,
     never propagated), invisible .partner-features li::before bullet
     dots (missing display:flex + border-radius so the pseudo-element's
     width/height never take effect), and the page's own 0.88rem/500
     mobile .nav-links a size (should be 13px/400 like everywhere else).
  4. Brief link relativity: a bare href="news.html" inside a one-level-
     deep language folder resolves to the wrong, nonexistent
     <lang>/news.html; an absolute staging.virtuse.com or virtuse.com
     link works but doesn't share localStorage/theme state with the
     rest of the site. Both get rewritten to the relative ../news.html.
  5. index.html's mobile-drawer background still hardcoded to the old
     navy #0d1421/#0a0f1a gradient stops instead of var(--dark)/
     var(--dark-lighter).

Anything that needs actual translated text (the About-page dek-split
headings, the Brief CTA rename, a full tax.html-style legacy-template
port) is NOT auto-fixed here — those need a human/agent decision per
language. Instead this script REPORTS which pages still look legacy so
that work can be scoped up front instead of discovered by accident.

Usage:
    python3 audit_parity.py <lang>              # report only, no writes
    python3 audit_parity.py <lang> --fix        # apply the mechanical fixes
    python3 audit_parity.py <lang> --fix --pages about.html,bots.html

<lang> is a folder name under the site root (uk, de, ru, es, fr, ...).
Pages are matched against the corresponding EN top-level file so the
script can skip pages EN itself doesn't have (e.g. no fear-greed.html
translated for that language).
"""

import argparse
import glob
import os
import re
import sys

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAV_CTA_BASE_OLD = """  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;"""
NAV_CTA_BASE_NEW = """  padding: 7px 14px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;"""

NAV_CTA_OVERRIDE_OLD = '.nav-cta { background: var(--btc-orange, #f7931a); color: #0d0902; }'
NAV_CTA_OVERRIDE_NEW = '.nav-cta { background: var(--btc-orange, #f7931a); color: #0d0902; padding: 7px 14px; font-size: 12px; }'

MOBILE_DRAWER_ANCHOR_RE = re.compile(
    r'([ \t]*)\.nav-links a \{\n'
    r'(\s*display: flex;\n'
    r'\s*align-items: center;\n'
    r'\s*gap: 14px;)'
)

BOTS_NAV_LINKS_OLD = """    .nav-links a {
      padding: 6px 14px;
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--muted);
      border-radius: var(--radius-sm);
      transition: all 0.2s;
      white-space: nowrap;
    }"""
BOTS_NAV_LINKS_NEW = """    .nav-links a {
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 400;
      color: var(--muted);
      border-radius: var(--radius-sm);
      transition: all 0.2s;
      white-space: nowrap;
    }"""

BOTS_PARTNER_FEATURES_RE = re.compile(
    r'( {4})\.partner-features li \{\n'
    r'\s*font-size: 0\.82rem;\n'
    r'\s*color: var\(--text\);\n'
    r'\s*padding: 4px 0;\n'
    r'\s*\n'
    r'\s*\n'
    r'\s*gap: 8px;\n'
    r'\s*\}\n'
    r'\n'
    r'\s*\.partner-features li::before \{\n'
    r'\s*content: \'\';\n'
    r"\s*width: 5px; height: 5px;\n"
    r'\s*background: var\((--orange|--text)\);\n'
    r'\s*\n'
    r'\s*flex-shrink: 0;\n'
    r'\s*\}'
)

HERO_BG_GRID_MARKUP_RE = re.compile(
    r'([ \t]*)<section class="hero">\n'
    r'\s*<div class="hero-bg"></div>\n'
    r'\s*<div class="hero-grid"></div>\n'
    r'(\s*<div class="hero-content animate">)'
)

HERO_BG_GRID_CSS_RE = re.compile(
    r'[ \t]*\.hero-bg \{\n(?:.*\n)*?[ \t]*\}\n'
    r'\n'
    r'[ \t]*\.hero-grid \{\n(?:.*\n)*?[ \t]*\}\n'
    r'\n'
    r'([ \t]*\.hero-content \{)'
)

HERO_SPAN_ORANGE_RE = re.compile(r'<span style="color:var\(--orange\)">([^<]*)</span>')

INDEX_MOBILE_GRADIENT_OLD = 'linear-gradient(180deg, #0d1421 0%, #0a0f1a 55%, #0d1421 100%);'
INDEX_MOBILE_GRADIENT_NEW = 'linear-gradient(180deg, var(--dark) 0%, var(--dark-lighter) 55%, var(--dark) 100%);'

LEGACY_MARKERS = ['.eu-card', '.how-icon.orange', 'class="how-card"', '.value-icon {', '.vet-icon {']


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def write(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)


def report(msg, findings):
    findings.append(msg)


def fix_nav_cta(path, content, findings, apply):
    changed = False
    if NAV_CTA_BASE_OLD in content:
        report(f"{path}: nav-cta base rule still 10px24px/14px", findings)
        if apply:
            content = content.replace(NAV_CTA_BASE_OLD, NAV_CTA_BASE_NEW, 1)
            changed = True
    if NAV_CTA_OVERRIDE_OLD in content and NAV_CTA_OVERRIDE_NEW not in content:
        report(f"{path}: nav-cta override missing padding/font-size", findings)
        if apply:
            content = content.replace(NAV_CTA_OVERRIDE_OLD, NAV_CTA_OVERRIDE_NEW, 1)
            changed = True
    return content, changed


def fix_mobile_drawer_specificity(path, content, findings, apply):
    matches = list(MOBILE_DRAWER_ANCHOR_RE.finditer(content))
    if len(matches) != 1:
        return content, False
    has_conflict = '.nav-links a:not(.lang-opt) {' in content or '.nav-links a:not(.lang-opt){' in content
    if not has_conflict:
        return content, False
    report(f"{path}: mobile drawer .nav-links a missing :not(.lang-opt), desktop rule will win", findings)
    if not apply:
        return content, False
    m = matches[0]
    content = content[:m.start()] + m.group(1) + '.nav-links a:not(.lang-opt) {\n' + m.group(2) + content[m.end():]
    return content, True


def fix_bots_page(path, content, findings, apply):
    changed = False
    m = HERO_BG_GRID_MARKUP_RE.search(content)
    if m:
        report(f"{path}: leftover .hero-bg/.hero-grid markup", findings)
        if apply:
            content = content[:m.start()] + m.group(1) + '<section class="hero">\n' + m.group(2) + content[m.end():]
            changed = True

    m2 = HERO_BG_GRID_CSS_RE.search(content)
    if m2:
        report(f"{path}: leftover .hero-bg/.hero-grid CSS", findings)
        if apply:
            content = content[:m2.start()] + m2.group(1) + content[m2.end():]
            changed = True

    m3 = HERO_SPAN_ORANGE_RE.search(content)
    if m3:
        report(f"{path}: hero highlight span still var(--orange)", findings)
        if apply:
            content = content[:m3.start()] + f'<span style="color:var(--text)">{m3.group(1)}</span>' + content[m3.end():]
            changed = True

    m4 = BOTS_PARTNER_FEATURES_RE.search(content)
    if m4:
        report(f"{path}: partner-features bullet missing display:flex/border-radius (invisible dot)", findings)
        if apply:
            indent = m4.group(1)
            new_block = (
                f"{indent}.partner-features li {{\n"
                f"{indent}  font-size: 0.82rem;\n"
                f"{indent}  color: var(--text);\n"
                f"{indent}  padding: 4px 0;\n"
                f"{indent}  display: flex;\n"
                f"{indent}  align-items: center;\n"
                f"{indent}  gap: 8px;\n"
                f"{indent}}}\n\n"
                f"{indent}.partner-features li::before {{\n"
                f"{indent}  content: '';\n"
                f"{indent}  width: 5px; height: 5px;\n"
                f"{indent}  background: var(--text);\n"
                f"{indent}  border-radius: 50%;\n"
                f"{indent}  flex-shrink: 0;\n"
                f"{indent}}}"
            )
            content = content[:m4.start()] + new_block + content[m4.end():]
            changed = True

    if BOTS_NAV_LINKS_OLD in content:
        report(f"{path}: bots-style .nav-links a still 0.88rem/500", findings)
        if apply:
            content = content.replace(BOTS_NAV_LINKS_OLD, BOTS_NAV_LINKS_NEW, 1)
            changed = True

    return content, changed


def fix_brief_links(path, content, findings, apply, depth):
    prefix = '../' * depth
    changed = False
    n_abs_prod = content.count('https://virtuse.com/news.html')
    n_abs_staging = content.count('https://staging.virtuse.com/news.html')
    n_bare = content.count('href="news.html')
    if n_abs_prod or n_abs_staging or n_bare:
        report(f"{path}: Brief link not relative (abs-prod={n_abs_prod}, abs-staging={n_abs_staging}, bare-href={n_bare})", findings)
        if apply:
            content = content.replace('https://staging.virtuse.com/news.html', f'{prefix}news.html')
            content = content.replace('https://virtuse.com/news.html', f'{prefix}news.html')
            content = content.replace('href="news.html', f'href="{prefix}news.html')
            changed = True
    return content, changed


def fix_index_gradient(path, content, findings, apply):
    if INDEX_MOBILE_GRADIENT_OLD not in content:
        return content, False
    report(f"{path}: mobile drawer gradient still literal navy hex", findings)
    if not apply:
        return content, False
    content = content.replace(INDEX_MOBILE_GRADIENT_OLD, INDEX_MOBILE_GRADIENT_NEW, 1)
    return content, True


def check_legacy_markers(path, content, findings):
    hits = [m for m in LEGACY_MARKERS if m in content]
    if hits:
        report(f"{path}: LOOKS LEGACY (needs a full manual port like sk/tax.html got) -- markers: {hits}", findings)


def process_file(path, findings, apply, depth):
    content = read(path)
    orig = content
    basename = os.path.basename(path)

    content, c1 = fix_nav_cta(path, content, findings, apply)
    content, c2 = fix_mobile_drawer_specificity(path, content, findings, apply)
    content, c3 = fix_bots_page(path, content, findings, apply)
    content, c4 = fix_brief_links(path, content, findings, apply, depth)
    c5 = False
    if basename == 'index.html':
        content, c5 = fix_index_gradient(path, content, findings, apply)
    check_legacy_markers(path, content, findings)

    if apply and content != orig:
        write(path, content)
        return True
    return False


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('lang', help='language folder name, e.g. uk, de, ru, es, fr')
    ap.add_argument('--fix', action='store_true', help='apply fixes (default: report only)')
    ap.add_argument('--pages', help='comma-separated list of filenames to restrict to, e.g. bots.html,about.html')
    args = ap.parse_args()

    lang_dir = os.path.join(SITE_ROOT, args.lang)
    if not os.path.isdir(lang_dir):
        sys.exit(f"No such language folder: {lang_dir}")

    if args.pages:
        wanted = set(args.pages.split(','))
        files = sorted(f for f in glob.glob(os.path.join(lang_dir, '*.html')) if os.path.basename(f) in wanted)
    else:
        files = sorted(glob.glob(os.path.join(lang_dir, '*.html')))

    findings = []
    changed_files = []
    for path in files:
        rel = os.path.relpath(path, SITE_ROOT)
        if process_file(path, findings, args.fix, depth=1):
            changed_files.append(rel)

    print(f"Scanned {len(files)} files in {args.lang}/\n")
    if findings:
        for f in findings:
            print(" -", f)
    else:
        print("No known bug patterns found.")

    if args.fix:
        print(f"\nModified {len(changed_files)} files:")
        for f in changed_files:
            print("  ", f)
    else:
        print("\n(report only -- re-run with --fix to apply)")


if __name__ == '__main__':
    main()
