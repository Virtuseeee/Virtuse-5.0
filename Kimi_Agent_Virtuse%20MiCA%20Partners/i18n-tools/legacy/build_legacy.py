#!/usr/bin/env python3
"""Port the old-template pages (dashboards, FAQ, legal) onto the design-v2 shell.

usage: python3 build_legacy.py [PAGE ...] [--lang en,sk,...]   (default: every page below, every language that has it)

Keeps each page's own content and chart script; replaces the old shell:
  head      -> v2common.head() (site-v2.css, fonts, VB_I18N); CSP = old page's CSP + homepage CSP,
               then csp_tight drops optional origins the page does not use
  nav       -> v2 nav from the language's homepage (Learn current for the Bitcoin Data pages)
  hero      -> .buy-hero2 (h1 + .sp-lead)
  sub-nav   -> neutral link row (.bd-links.lg-sub), current page marked
  newsletter-> v2 Brief card (v2common.brief, strings from bitcoin-data/<lang>.json)
  footer    -> v2 footer; scripts -> site-v2.js & co.; anime.js, the old menu / dropdown /
               nav-CTA / Brief-form scripts are dropped
  CSS       -> the page's old inline CSS + styles.css, every selector prefixed with `.legacy`
               (old body / html / nav / footer rules can no longer touch the v2 shell);
               :root variables move onto .legacy, --text-dim raised to the v2 muted colour

Re-running on an already ported page rebuilds from the copy kept in legacy/src/<lang>/<page>
(written on the first run), so the result does not depend on how often it runs.
v2 content in a source copy: markup between <!-- V2:AFTER-LEGACY --> and <!-- /V2:AFTER-LEGACY -->
goes after the .legacy wrapper (v2 styles only, no legacy CSS), and <style data-v2> blocks go into
<head> unprefixed. btc-monthly-returns.html uses both (i18n-tools/btc-returns/build_returns.py).
Audit 2026-10-15: code.md P1-1, design.md P1-1.
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import v2common as C

PAGES = ['faq.html', 'fear-greed.html', 'ma-200w.html', 'rainbow-chart.html', 'root-cycles.html', 'btc-dominance.html',
         'trading-volume.html', 'asset-returns.html', 'btc-monthly-returns.html',
         'privacy-policy.html', 'terms-and-conditions.html', 'aml-compliance.html']
DATA_PAGES = set(PAGES[1:9])            # live under Learn > Bitcoin Data
LANGS = ['en', 'sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru']
CSS_VERSION = '7'
DATA_CSS_VERSION, DATA_JS_VERSION = '15', '8'   # Bitcoin Data v3 accent system (handover 2026-10-25)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'bitcoin-data'))
from build_bitcoin_data import CHART_ACC     # each data page carries the accent of its card on the hub
SRC = os.path.join(HERE, 'src')
TEXT_DIM = '#9aa3ad'                    # v2 muted text (old #484f58 was ~2.2:1)

SHELL_JS = ('LANGUAGE DROPDOWN', 'typeof anime', 'navHamburger', '.nav-cta', 'workers.dev/subscribe')


# ---------------------------------------------------------------- CSS prefixing
def _blocks(css):
    """Split CSS into top-level (prelude, body) pairs; comments removed."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        out.append((prelude, css[j + 1:k - 1]))
        i = k
    return out


def _prefix_sel(sel):
    sel = sel.strip()
    if not sel:
        return None
    if re.fullmatch(r'(html|body|:root)(\s*,\s*(html|body|:root))*', sel):
        return None                                   # shell globals: dropped
    sel = re.sub(r'^(html|body)\b\s*', '', sel)       # "body.x .y" -> ".x .y"
    return '.legacy ' + sel if sel else '.legacy'


def prefix_css(css, roots):
    out = []
    for prelude, body in _blocks(css):
        if prelude.startswith('@media') or prelude.startswith('@supports'):
            inner = prefix_css(body, roots)
            if inner.strip():
                out.append('%s{%s}' % (prelude, inner))
        elif prelude.startswith('@'):                 # @keyframes, @font-face: unchanged
            out.append('%s{%s}' % (prelude, body))
        else:
            if re.fullmatch(r'\s*:root\s*', prelude):
                roots.append(body.strip())
                continue
            sels = [s for s in (_prefix_sel(x) for x in prelude.split(',')) if s]
            if sels:
                out.append('%s{%s}' % (','.join(sels), body.strip()))
    return '\n'.join(out)


V2_AFTER = re.compile(r'\s*<!-- V2:AFTER-LEGACY -->(.*?)<!-- /V2:AFTER-LEGACY -->', re.S)
V2_STYLE = re.compile(r'<style data-v2>.*?</style>\n?', re.S)


def legacy_css(old):
    css = '\n'.join(re.findall(r'<style\b(?![^>]*data-v2)[^>]*>(.*?)</style>', old, re.S))
    styles = open(os.path.join(C.SITE, 'styles.css')).read() if '/styles.css' in old or 'styles.css' in old else ''
    roots = []
    body = prefix_css(styles + '\n' + css, roots)
    vars_ = ';'.join(r.rstrip(';') for r in roots)
    # old navy palette -> v2 neutral surfaces (same values as index.html / site-v2.css)
    v2 = ('--dark:#08090a;--dark-lighter:#0e0e0e;--dark-card:#141414;--dark-card-hover:#1c1c1c;'
          '--bg:#08090a;--card:#141414;--border:rgba(255,255,255,0.06);--border-hover:rgba(255,255,255,0.12)')
    return '<style>\n.legacy{%s;%s;--text-dim:%s}\n%s\n%s</style>\n' % (vars_, v2, TEXT_DIM, body, NEUTRAL)


# Orange stays where it means Bitcoin (BTC price, BTC row, chart tooltip); navigation and decoration
# accents go neutral like the v2 pages (design audit P1-1: "active states and sub-nav pills are orange").
NEUTRAL = """.legacy .sec-label{color:var(--text-muted);background:rgba(255,255,255,.05)}
.legacy details[open]{border-color:rgba(255,255,255,.14)}
.legacy summary:hover{color:var(--text)}
.legacy summary::after{color:var(--text-muted)}
.legacy .faq-answer a,.legacy .credit-text-name a{color:var(--text);text-decoration:underline;text-underline-offset:3px}
.legacy .chart-panel h3 .ico{color:var(--text-muted)}
.legacy .credit-badge{background:rgba(255,255,255,.05);color:var(--text)}
.legacy .credit-link:hover{border-color:rgba(255,255,255,.3);color:var(--text)}
.lg-sub{text-align:center;max-width:860px;margin:4px auto 8px;line-height:1.9}
.lg-sub a[aria-current]{color:var(--text);font-weight:600;text-decoration:none}
.lg-sub a{white-space:nowrap}
@media (max-width:600px){.legacy .credit-link{white-space:normal;max-width:100%}}
@media (max-width:700px){.wrap .legacy.legacy > section,.wrap .legacy.legacy > div{padding-left:0;padding-right:0}}  /* main.wrap already pads the sides */
"""


# ---------------------------------------------------------------- CSP union
CSP_RE = re.compile(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)">')


def csp_union(a, b):
    def parse(s):
        d = {}
        for part in s.split(';'):
            toks = part.split()
            if toks:
                d.setdefault(toks[0], [])
                for t in toks[1:]:
                    if t not in d[toks[0]]:
                        d[toks[0]].append(t)
        return d
    A, B_ = parse(a), parse(b)
    for k, v in B_.items():
        A.setdefault(k, [])
        for t in v:
            if t not in A[k]:
                A[k].append(t)
    return '; '.join(' '.join([k] + v) for k, v in A.items())


# ---------------------------------------------------------------- page parts
def section(old, start_re, end_marker):
    m = re.search(start_re, old)
    return m


def hero_v2(old):
    m = re.search(r'<section class="hero">(.*?)</section>', old, re.S)
    if not m:
        raise SystemExit('no hero')
    h = m.group(1)
    h = re.sub(r'<span class="highlight">', '<span>', h)
    h = h.replace('class="hero-desc"', 'class="sp-lead"')
    return '<div class="buy-hero2 lg-hero">%s</div>' % h.strip(), m.end()


def subnav_v2(old, page):
    m = re.search(r'<div class="subnav-wrap">\s*<nav class="subnav"([^>]*)>(.*?)</nav>\s*</div>', old, re.S)
    if not m:
        return '', None
    links = []
    for a in re.finditer(r'<a href="([^"]*)"([^>]*)>(.*?)</a>', m.group(2), re.S):
        label = re.sub(r'^\s*&#9670;\s*', '', a.group(3)).strip()
        cur = ' aria-current="page"' if 'active' in a.group(2) else ''
        links.append('<a href="%s"%s>%s</a>' % (a.group(1), cur, label))
    return '<nav class="bd-links lg-sub"%s>%s</nav>' % (m.group(1), ' · '.join(links)), m.end()


def build(L, page):
    page_path, home_path, root = C.paths(L, page)
    src_copy = os.path.join(SRC, L, page)
    if os.path.exists(src_copy):
        old = open(src_copy).read()
    else:
        old = open(page_path).read()
        if 'class="footer-main"' not in old or '<nav class="nav">' not in old:
            raise SystemExit('%s/%s: not an old-template page and no source copy' % (L, page))
        os.makedirs(os.path.dirname(src_copy), exist_ok=True)
        open(src_copy, 'w').write(old)
    home = open(home_path).read()
    T = json.load(open(os.path.join(os.path.dirname(HERE), 'bitcoin-data', L + '.json')))

    data = page in DATA_PAGES
    head = C.head(L, old, home, root, DATA_CSS_VERSION if data else CSS_VERSION)
    old_csp, home_csp = CSP_RE.search(old).group(1), CSP_RE.search(home).group(1)
    head = CSP_RE.sub(lambda m: '<meta http-equiv="Content-Security-Policy" content="%s">' % csp_union(old_csp, home_csp), head, 1)
    head = head.replace('</head>\n', legacy_css(old) + ''.join(V2_STYLE.findall(old)) + '</head>\n')

    nav, foot = C.chrome(home, page)
    nav = nav.replace('<div class="nav-group current" id="ng-services">', '<div class="nav-group" id="ng-services">')
    if page in DATA_PAGES:
        nav = nav.replace('<div class="nav-group" id="ng-learn">', '<div class="nav-group current" id="ng-learn">')

    hero, after_hero = hero_v2(old)
    main_cls = 'wrap'
    if data:
        # eyebrow = the section name ("Bitcoin Data"), same words as on Bitcoin vs gold; dot in the page accent
        label = json.load(open(os.path.join(os.path.dirname(HERE), 'bitcoin-vs-gold', L + '.json')))['eyebrow'].split(' · ')[0]
        hero = hero.replace('<div class="buy-hero2 lg-hero">', '<div class="buy-hero2 lg-hero"><div class="eyebrow"><i></i>%s</div>' % label, 1)
        main_cls = 'wrap bd-v3 bd-sub bd-acc-' + CHART_ACC[page]
    sub, after_sub = subnav_v2(old, page)
    start = max(after_hero, after_sub or 0)
    end = old.index('<section class="newsletter">')
    content = old[start:end].strip()
    content = re.sub(r'^\s*<!-- =+ [^>]*-->\s*$', '', content, flags=re.M).strip()
    after = V2_AFTER.search(content)
    content = V2_AFTER.sub('', content).strip()
    after = '\n  ' + V2_STYLE.sub('', after.group(1)).strip() + '\n' if after else ''

    page_js = []
    tail = old[old.index('</footer>'):]
    for m in re.finditer(r'<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>', tail, re.S):
        if 'json' in m.group(1) or any(k in m.group(2) for k in SHELL_JS):
            continue
        page_js.append('<script%s>%s</script>' % (m.group(1), m.group(2)))
    # page scripts placed inside the body before the footer (rare) stay where they are, inside content

    body_tag = re.search(r'<body[^>]*>', old).group(0)
    out = head + body_tag + '\n' + nav + '\n\n<main class="%s" id="top">\n  ' % main_cls + hero + '\n  ' + sub + \
        '\n  <div class="legacy">\n' + content + '\n  </div>\n' + after + '\n  ' + C.brief(L, lambda k: T[k], root, 'legacy_' + page.split('.')[0].replace('-', '_')) + \
        '\n</main>\n\n' + foot + '\n' + '\n'.join(page_js) + '\n' + C.scripts(root, DATA_JS_VERSION if data else '7')
    out = C.fix_links(L, out)
    # fear-greed / trading-volume exist in 7 languages only: a language-menu entry for a missing
    # translation goes to that language's Bitcoin Data page instead of a 404.
    def lang_fallback(m):
        url = m.group(2)
        target = os.path.normpath(os.path.join(os.path.dirname(page_path), url))
        if os.path.exists(target):
            return m.group(0)
        return '%s="%s"' % (m.group(1), url[:-len(page)] + 'bitcoin-data.html')
    out = re.sub(r'\b(href)="((?:\.\./)?(?:[a-z]{2}/)?' + re.escape(page) + ')"', lang_fallback, out)
    out = C.finalize(out, page_path)
    open(page_path, 'w').write(out)
    return len(out)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--lang')]
    langs = LANGS
    for a in sys.argv[1:]:
        if a.startswith('--lang'):
            langs = a.split('=', 1)[1].split(',')
    pages = args or PAGES
    n = 0
    for p in pages:
        for L in langs:
            if os.path.exists(C.paths(L, p)[0]) or os.path.exists(os.path.join(SRC, L, p)):
                build(L, p); n += 1
    print('ported %d pages' % n)
