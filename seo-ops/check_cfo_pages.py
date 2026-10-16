#!/usr/bin/env python3
"""SEO / head check of the 10 Virtuse CFO pages against the CFO + Verdict handover
(2026-10-15). Read-only.

    python3 seo-ops/check_cfo_pages.py            # files in the repo
    python3 seo-ops/check_cfo_pages.py --staging  # https://staging.virtuse.com (as served)
    python3 seo-ops/check_cfo_pages.py --live     # https://virtuse.com

Checks per page: head order vb-consent snippet -> /cookie-consent.js -> GTM loader
(GTM-KXX4Q6WH exactly once, with the staging guard; GTM-M4C5VRD never; no GTM
<noscript> iframe), /partner-click.js loaded; robots noindex until the launch;
canonical = the page's own virtuse.com URL; hreflang for all 10 languages + x-default
pointing at the cfo pages once the page is indexable (docs/LAUNCH-CFO.md); title <= 60 and description <= 155 characters; no
"[CENA]", "Layer 2" or a visible "{{REPORT_PRICE}}"; footer "© 2018–2026 Virtuse Wealth Management, a.s.";
Tools item "Virtuse CFO · Verdict"; the #verdict and #pricing anchors. Site-wide: no
link to verdict.html, cfo pages not in sitemap.xml while noindex.
"""
import glob, html as H, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'Kimi_Agent_Virtuse%20MiCA%20Partners')
LANGS = ['en', 'sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru']
MODE = 'staging' if '--staging' in sys.argv else 'live' if '--live' in sys.argv else 'repo'
BASE = {'staging': 'https://staging.virtuse.com', 'live': 'https://virtuse.com'}.get(MODE)


def path(l):
    return 'cfo.html' if l == 'en' else f'{l}/cfo.html'


def get(rel):
    if MODE == 'repo':
        return open(os.path.join(SITE, rel), encoding='utf-8').read()
    req = urllib.request.Request(f'{BASE}/{rel}?cb=check', headers={'User-Agent': 'virtuse-cfo-check', 'Cache-Control': 'no-cache'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8')


def visible(s):
    s = re.sub(r'<(script|style)\b.*?</\1>', ' ', s, flags=re.S)
    return H.unescape(re.sub(r'<[^>]+>', ' ', s))


def check(l):
    s = get(path(l))
    head = s[:s.index('</head>')]
    bad = []
    def pos(pat):
        m = re.search(pat, head)
        return m.start() if m else -1
    order = [('vb-consent snippet', pos(r"gtag\('consent',\s*'default'")),
             ('/cookie-consent.js', pos(r'src="/cookie-consent\.js"')),
             ('GTM loader', pos(r"GTM-KXX4Q6WH"))]
    for name, p in order:
        if p < 0:
            bad.append(f'{name} missing in <head>')
    ps = [p for _, p in order]
    if all(p >= 0 for p in ps) and ps != sorted(ps):
        bad.append('head order is not consent -> cookie-consent.js -> GTM')
    if s.count('GTM-KXX4Q6WH') != 1:
        bad.append(f'GTM-KXX4Q6WH {s.count("GTM-KXX4Q6WH")} times')
    if 'GTM-M4C5VRD' in s:
        bad.append('old GTM-M4C5VRD present')
    if re.search(r'<noscript>\s*<iframe[^>]*googletagmanager', s):
        bad.append('GTM noscript iframe')
    if "staging.virtuse.com" not in head:
        bad.append('GTM loader without the staging guard')
    if '/partner-click.js' not in s:
        bad.append('/partner-click.js not loaded')
    robots = re.search(r'<meta name="robots" content="([^"]*)"', head)
    if not robots or 'noindex' not in robots.group(1):
        bad.append(f'robots = {robots.group(1) if robots else None} (noindex until the launch)')
    own = 'https://virtuse.com/' + path(l)
    can = re.search(r'<link rel="canonical" href="([^"]*)"', head)
    if not can or can.group(1) != own:
        bad.append(f'canonical {can.group(1) if can else None} != {own}')
    # hreflang comes with the launch (docs/LAUNCH-CFO.md): required once the page is indexable
    alts = dict(re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', head))
    want = {x: 'https://virtuse.com/' + path(x) for x in LANGS}
    want['x-default'] = 'https://virtuse.com/cfo.html'
    miss = [k for k, v in want.items() if alts.get(k) != v]
    if miss and robots and 'noindex' not in robots.group(1):
        bad.append(f'hreflang missing/wrong: {miss}')
    title = H.unescape((re.search(r'<title>(.*?)</title>', head, re.S) or [None, ''])[1]).strip()
    desc = H.unescape((re.search(r'<meta name="description" content="([^"]*)"', head) or [None, ''])[1])
    if not title or len(title) > 60:
        bad.append(f'title {len(title)} chars: {title!r}')
    if not desc or len(desc) > 155:
        bad.append(f'description {len(desc)} chars')
    text = visible(s)
    for needle in ('[CENA]', 'Layer 2', '{{REPORT_PRICE}}'):
        if needle.lower() in text.lower():
            bad.append(f'visible text contains {needle!r}')
    if '© 2018–2026 Virtuse Wealth Management, a.s.' not in H.unescape(s):
        bad.append('footer copyright changed')
    if 'Virtuse CFO · Verdict' not in s:
        bad.append('Tools item still "Virtuse CFO" (run i18n-tools/apply_cfo_verdict_nav.py --with-cfo)')
    for anchor in ('verdict', 'pricing'):
        if f'id="{anchor}"' not in s:
            bad.append(f'no #{anchor} anchor')
    return title, desc, bad


def main():
    fails = 0
    for l in LANGS:
        try:
            title, desc, bad = check(l)
        except Exception as e:
            title, desc, bad = '', '', [f'cannot read: {e}']
        fails += bool(bad)
        print(f'{l:3} {"OK  " if not bad else "FAIL"} {title}')
        for b in bad:
            print(f'      - {b}')
    sm = get('sitemap.xml')
    listed = [l for l in LANGS if f'https://virtuse.com/{path(l)}<' in sm]
    if listed:
        print(f'sitemap lists noindex cfo pages: {listed}'); fails += 1
    if MODE == 'repo':
        links = [os.path.relpath(p, SITE) for p in glob.glob(os.path.join(SITE, '**', '*.html'), recursive=True)
                 if not os.path.relpath(p, SITE).startswith('i18n-tools') and re.search(r'href="[^"]*verdict\.html', open(p, encoding='utf-8').read())]
        if links:
            print(f'pages linking verdict.html: {links[:10]}'); fails += 1
    print(f'{MODE}: {len(LANGS) - min(fails, len(LANGS))}/{len(LANGS)} cfo pages OK' if not fails else f'{MODE}: problems found')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
