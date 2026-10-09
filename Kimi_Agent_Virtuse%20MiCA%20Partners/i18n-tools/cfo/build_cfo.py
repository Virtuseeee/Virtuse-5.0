#!/usr/bin/env python3
"""Build <lang>/cfo.html from the English cfo.html + <lang>.json (this folder).

usage: python3 build_cfo.py sk [cs de ...]
Shares helpers and language tables with ../home/build_lang.py.
"""
import html as html_mod, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'home'))
from strings import apply
import build_lang as B

SITE = B.SITE
TITLE = "Virtuse CFO: Your AI CFO for Bitcoin | Virtuse"
DESC = "Virtuse CFO reads your exchange export in your browser and shows what your Bitcoin buying really cost. Free audit planned from 1 November 2026."
JS = [" · read locally", "Open menu", "Close menu", "Please enter a valid email address.", "Sending...",
      "You're on the list. We'll email you once, when the free audit opens.", "Something went wrong. Please try again.",
      "Network error. Please try again."]
OG_LOCALE = {'sk': 'sk_SK', 'cs': 'cs_CZ', 'de': 'de_DE', 'fr': 'fr_FR', 'es': 'es_ES', 'pl': 'pl_PL', 'hu': 'hu_HU', 'uk': 'uk_UA', 'ru': 'ru_RU'}


def build(L):
    one = B.one
    en = open(os.path.join(SITE, 'cfo.html')).read()
    tr = json.load(open(os.path.join(HERE, L + '.json')))

    h, missing = apply(en, tr)
    missing = [m for m in missing if re.search(r'[A-Za-z]', m)]
    if missing:
        sys.exit('%s: untranslated strings: %r' % (L, missing[:5]))

    # head
    title, desc = tr[TITLE], tr[DESC].replace('"', '&quot;')
    h = one(h, '<html lang="en">', '<html lang="%s">' % L)
    h = one(h, '<title>%s</title>' % TITLE, '<title>%s</title>' % title)
    h = one(h, '<meta name="description" content="%s">' % DESC, '<meta name="description" content="%s">' % desc)
    h = one(h, '<meta property="og:title" content="%s">' % TITLE, '<meta property="og:title" content="%s">' % title.replace('"', '&quot;'))
    h = one(h, '<meta property="og:description" content="%s">' % DESC, '<meta property="og:description" content="%s">\n<meta property="og:locale" content="%s">' % (desc, OG_LOCALE[L]))
    h = one(h, 'href="https://virtuse.com/cfo.html"', 'href="https://virtuse.com/%s/cfo.html"' % L)
    h = one(h, 'content="https://virtuse.com/cfo.html"', 'content="https://virtuse.com/%s/cfo.html"' % L)
    h = re.sub(r'href="(favicon[^"]*|apple-touch-icon\.png)"', r'href="../\1"', h)

    # language menu: each language's CFO page
    i = h.index('<div class="lang-menu-panel"'); j = h.index('</div>', i)
    seg = h[i:j]
    seg = seg.replace('href="index.html"', 'href="../cfo.html"')
    seg = re.sub(r'href="(sk|cs|de|fr|es|pl|hu|uk|ru)/index\.html"', r'href="../\1/cfo.html"', seg)
    seg = seg.replace('href="../%s/cfo.html"' % L, 'href="cfo.html"')
    seg = seg.replace('class="lang-opt active"', 'class="lang-opt"')
    seg = re.sub(r'(<a href="cfo\.html" class="lang-opt)"', r'\1 active"', seg)
    h = h[:i] + seg + h[j:]
    h = one(h, '<span aria-hidden="true">&#127468;&#127463;</span><span class="lang-code">EN</span>',
            '<span aria-hidden="true">%s</span><span class="lang-code">%s</span>' % (B.FLAG[L], B.CODE.get(L, L.upper())))
    h = one(h, '<a class="logo" href="/"', '<a class="logo" href="index.html"')

    # relative links: same file in this folder, else one level up
    def fix_url(m):
        attr, url = m.group(1), m.group(2)
        if re.match(r'(https?:|mailto:|#|data:|\.\./|/)', url) or url in ('index.html', 'cfo.html'):
            return m.group(0)
        path = re.split(r'[?#]', url)[0]
        if L == 'sk' and path == 'blog.html':
            return '%s="../blog-sk.html%s"' % (attr, url[len(path):])
        if os.path.exists(os.path.join(SITE, L, path)):
            return m.group(0)
        return '%s="../%s"' % (attr, url)
    b = h.index('<body')
    h = h[:b] + re.sub(r'\b(href|src)="([^"]+)"', fix_url, h[b:])
    for en_slug, slug in zip(B.EN_GUIDES, B.GUIDES[L]):
        h = h.replace('href="/%s/"' % en_slug, 'href="/%s/%s/"' % (L, slug))

    # scripts
    loc = B.LOCALE[L]
    h = one(h, "toLocaleString('en-IE')", "toLocaleString('%s')" % loc)
    h = one(h, '<div class="big">€<span id="over">341</span>', '<div class="big"><span id="over">341</span>&nbsp;€')
    h = one(h, "b.textContent = audit ? 'New' : 'Soon';", "b.textContent = audit ? '%s' : '%s';" % (B.js_lit(tr['New'], "'"), B.js_lit(tr['Soon'], "'")))
    for key in JS:
        v = html_mod.unescape(tr[key])
        for q in ("'", '"'):
            h = h.replace(q + B.js_lit(key, q) + q, q + B.js_lit(v, q) + q)
    h = one(h, "source: 'cfo_page' })", "source: 'cfo_page', lang: '%s' })" % L)
    h = one(h, '</head>', '<style>.spot, .tiles > * { min-width: 0; } .tile h3, .plan h3 { hyphens: auto; overflow-wrap: break-word; }\n'
            '@media (max-width: 400px) { .nav-cta { font-size: 12px; padding: 8px 10px; } .btn { white-space: normal; text-align: center; } }'
            '@media (max-width: 359px) { .nav-cta { white-space: normal; line-height: 1.15; text-align: center; max-width: 104px; padding: 6px 8px; } }</style>\n</head>')
    h = B.localise_numbers(h, L)

    for bad in ('<html lang="en"', "'en-IE'", 'Your AI CFO for Bitcoin |'):
        if bad in h:
            sys.exit('%s: leftover %s' % (L, bad))
    out = os.environ.get('OUT') or os.path.join(SITE, L)
    open(os.path.join(out, 'cfo.html'), 'w').write(h)
    print('%s: written %d bytes' % (L, len(h)))


if __name__ == '__main__':
    for L in sys.argv[1:]:
        build(L)
