#!/usr/bin/env python3
"""Build <lang>/index.html from the new English homepage + <lang>.json.

usage: python3 build_lang.py sk [cs de ...]      (writes into the site checkout)

Keeps each language's own head tags (lang, title, description, Open Graph,
Twitter, canonical, og:locale, JSON-LD) from its current index.html, so SEO
metadata stays as it is today; everything else comes from the English page.
"""
import json, os, re, sys
import html as html_mod
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from strings import segments, apply

SITE = os.environ.get('VIRTUSE_SITE') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

LOCALE = {'sk': 'sk-SK', 'cs': 'cs-CZ', 'de': 'de-DE', 'fr': 'fr-FR', 'es': 'es-ES', 'pl': 'pl-PL', 'hu': 'hu-HU', 'uk': 'uk-UA', 'ru': 'ru-RU'}
PCT_SPACE = {'sk', 'cs', 'de', 'fr', 'es'}
FLAG = {'sk': '&#127480;&#127472;', 'cs': '&#127464;&#127487;', 'de': '&#127465;&#127466;', 'fr': '&#127467;&#127479;', 'es': '&#127466;&#127480;',
        'pl': '&#127477;&#127473;', 'hu': '&#127469;&#127482;', 'uk': '&#127482;&#127462;', 'ru': '&#127479;&#127482;'}
CODE = {'uk': 'UA'}
NAME = {'sk': 'Slovenčina', 'cs': 'Čeština', 'de': 'Deutsch', 'fr': 'Français', 'es': 'Español', 'pl': 'Polski', 'hu': 'Magyar', 'uk': 'Українська', 'ru': 'Русский'}
GUIDES = {  # tax, fee index, dca, sell vs borrow, inheritance
    'sk': ['bitcoin-dane', 'bitcoin-index-poplatkov', 'bitcoin-dca-kalkulacka', 'bitcoin-predat-alebo-pozicat', 'bitcoin-dedicstvo'],
    'cs': ['bitcoin-dane', 'bitcoin-index-poplatku', 'bitcoin-dca-kalkulacka', 'bitcoin-prodat-nebo-pujcit', 'bitcoin-dedictvi'],
    'de': ['bitcoin-steuern', 'bitcoin-gebuehrenindex', 'bitcoin-dca-rechner', 'bitcoin-verkaufen-oder-beleihen', 'bitcoin-erbrecht'],
    'fr': ['bitcoin-fiscalite', 'bitcoin-indice-frais', 'bitcoin-calculateur-dca', 'bitcoin-vendre-ou-emprunter', 'bitcoin-succession'],
    'es': ['bitcoin-impuestos', 'bitcoin-indice-comisiones', 'bitcoin-calculadora-dca', 'bitcoin-vender-o-pedir-prestado', 'bitcoin-herencia'],
    'pl': ['bitcoin-podatki', 'bitcoin-indeks-oplat', 'bitcoin-kalkulator-dca', 'bitcoin-sprzedac-czy-pozyczyc', 'bitcoin-dziedziczenie'],
    'hu': ['bitcoin-adozas', 'bitcoin-dijindex', 'bitcoin-dca-kalkulator', 'bitcoin-eladas-vagy-hitel', 'bitcoin-orokles'],
    'uk': ['bitcoin-podatky', 'bitcoin-indeks-komisii', 'bitcoin-kalkuliator-dca', 'bitcoin-prodaty-chy-pozychyty', 'bitcoin-spadshchyna'],
    'ru': ['bitcoin-nalogi', 'bitcoin-indeks-komissiy', 'bitcoin-kalkulyator-dca', 'bitcoin-prodat-ili-zanyat', 'bitcoin-nasledstvo'],
}
EN_GUIDES = ['bitcoin-tax', 'bitcoin-fee-index', 'bitcoin-dca-calculator', 'sell-vs-borrow-bitcoin', 'bitcoin-inheritance']
IN_EN = {'de': 'auf Englisch', 'fr': 'en anglais', 'es': 'en inglés', 'pl': 'po angielsku', 'hu': 'angol nyelven', 'uk': 'англійською', 'ru': 'на английском'}
BRIEF_EN = {'sk': 'v angličtine', 'cs': 'v angličtině', 'de': 'auf Englisch', 'fr': 'en anglais', 'es': 'en inglés',
            'pl': 'po angielsku', 'hu': 'angol nyelven', 'uk': 'англійською', 'ru': 'на английском'}
LD_DESC = {  # JSON-LD Organization/WebSite description
    'sk': 'Nekustodiálny hub pre služby zamerané výhradne na Bitcoin. Virtuse nikdy nedrží vaše kľúče.',
    'cs': 'Nekustodiální hub pro služby zaměřené výhradně na Bitcoin. Virtuse nikdy nedrží vaše klíče.',
    'pl': 'Niepowierniczy hub usług wyłącznie dla Bitcoina. Virtuse nigdy nie przechowuje Państwa kluczy.',
    'de': 'Non-Custodial-Hub für reine Bitcoin-Dienste. Virtuse verwahrt nie Ihre Schlüssel.',
    'fr': 'Hub non dépositaire de services 100 % Bitcoin. Virtuse ne détient jamais vos clés.',
    'es': 'Hub no custodial de servicios solo para Bitcoin. Virtuse nunca custodia sus claves.',
    'hu': 'Nem letétkezelő hub kizárólag Bitcoin-szolgáltatásokhoz. A Virtuse soha nem őrzi a kulcsait.',
    'uk': 'Некастодіальний хаб сервісів лише для Біткоїна. Virtuse ніколи не зберігає ваші ключі.',
    'ru': 'Некастодиальный хаб сервисов только для Биткоина. Virtuse никогда не хранит ваши ключи.',
}
HEAD_FIX = {'pl': [('Kupuj, kop, pożyczaj i zabezpieczaj Bitcoin przez 22 sprawdzonych partnerów.', 'Zakup, kopanie, pożyczki i zabezpieczenie Bitcoina u 22 sprawdzonych partnerów.')],
            'hu': [('Bitcoin hub:', 'Bitcoin-hub:'), ('Bitcoin vásárlás', 'Bitcoin-vásárlás')]}
SHORT_CTA = {'fr': 'Partenaires'}
LANGS = ['en', 'sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru']


def one(s, a, b, n=1):
    c = s.count(a)
    if c != n:
        sys.exit('expected %d x %r, found %d' % (n, a[:90], c))
    return s.replace(a, b)


def num(n, L):
    """Group digits the local way (space or dot), as the translators do."""
    if L == 'es' and n < 10000:
        return str(n)   # RAE: four-digit numbers are not grouped (es-ES toLocaleString agrees)
    sep = '.' if L in ('de', 'es') else ' '
    s = str(n)
    out = ''
    while len(s) > 3:
        out = sep + s[-3:] + out
        s = s[:-3]
    return s + out


def localise_numbers(html, L):
    """Number-only text nodes the string list skipped: euros, percents."""
    body = html.index('<body')
    head, body_html = html[:body], html[body:]
    pct = ' %' if L in PCT_SPACE else '%'

    def fix(t):
        t2 = re.sub(r'€([\d,]+)', lambda m: num(int(m.group(1).replace(',', '')), L) + ' €', t)
        t2 = re.sub(r'(\d+)\.(\d+)%', lambda m: m.group(1) + ',' + m.group(2) + pct, t2)
        t2 = re.sub(r'(?<![\d,])(\d+)%', lambda m: m.group(1) + pct, t2)
        return t2

    def repl(m):
        inner = m.group(2)
        if re.fullmatch(r'\s*[€\d.,%\s]+\s*', inner) and re.search(r'\d', inner):
            return m.group(1) + fix(inner) + m.group(3)
        return m.group(0)
    # only text directly between tags, outside scripts/styles
    parts = re.split(r'(<script\b.*?</script>|<style\b.*?</style>)', body_html, flags=re.S)
    for i in range(0, len(parts), 2):
        parts[i] = re.sub(r'(>)([^<>]*)(<)', repl, parts[i])
    return head + ''.join(parts)


def js_lit(s, q):
    return s.replace('\\', '\\\\').replace(q, '\\' + q)


def build(L):
    en = open(os.path.join(SITE, 'index.html')).read()
    old = open(os.path.join(SITE, L, 'index.html')).read()
    tr = json.load(open(os.environ.get('TR') or os.path.join(HERE, L + '.json')))

    # 1. text + attributes
    h, missing = apply(en, tr)
    real_missing = [m for m in missing if re.search(r'[A-Za-z]', m)]
    if real_missing:
        sys.exit('%s: untranslated strings: %r' % (L, real_missing[:5]))

    # 2. head: this language's own metadata
    h = one(h, '<html lang="en">', re.search(r'<html lang="[^"]+">', old).group(0))
    for pat in [r'<title>.*?</title>', r'<meta name="description" content="[^"]*">',
                r'<meta property="og:title" content="[^"]*">', r'<meta property="og:description" content="[^"]*">',
                r'<meta property="og:url" content="[^"]*">', r'<meta property="og:locale" content="[^"]*">',
                r'<meta name="twitter:title" content="[^"]*">', r'<meta name="twitter:description" content="[^"]*">',
                r'<link rel="canonical" href="[^"]*">',
                r'<script type="application/ld\+json"[^>]*>.*?</script>']:
        new = re.search(pat, old, re.S)
        if not new:
            sys.exit('%s: old page has no %s' % (L, pat))
        h, k = re.subn(pat, lambda m: new.group(0), h, count=1, flags=re.S)
        if k != 1:
            sys.exit('%s: new page has no %s' % (L, pat))
    h = one(h, '<script src="lang-detect.js"></script>', '<script src="../lang-detect.js"></script>')
    h = re.sub(r'href="(favicon[^"]*|apple-touch-icon\.png)"', r'href="../\1"', h)

    # 3. language menus (nav + footer): EN -> ../, others -> ../xx/, this one -> index.html
    def fix_lang_links(seg):
        seg = re.sub(r'href="index\.html"', 'href="../index.html"', seg)
        seg = re.sub(r'href="(sk|cs|de|fr|es|pl|hu|uk|ru)/index\.html"', r'href="../\1/index.html"', seg)
        seg = seg.replace('href="../%s/index.html"' % L, 'href="index.html"')
        return seg
    for start, end in [('<div class="lang-menu-panel"', '</div>'), ('<nav class="footer-langs"', '</nav>')]:
        i = h.index(start); j = h.index(end, i)
        seg = fix_lang_links(h[i:j])
        if 'lang-menu-panel' in start:
            seg = seg.replace('class="lang-opt active"', 'class="lang-opt"')
            seg = re.sub(r'(<a href="index\.html" class="lang-opt)"', r'\1 active"', seg)
        else:
            seg = seg.replace(' aria-current="page"', '')
            seg = re.sub(r'(<a href="index\.html" hreflang="%s")' % L, r'\1 aria-current="page"', seg)
        h = h[:i] + seg + h[j:]
    h = one(h, '<span aria-hidden="true">&#127468;&#127463;</span><span class="lang-code">EN</span>',
            '<span aria-hidden="true">%s</span><span class="lang-code">%s</span>' % (FLAG[L], CODE.get(L, L.upper())))
    h = one(h, '<a class="logo" href="/"', '<a class="logo" href="index.html"')

    # 4. every other relative link/src: same file in this folder, else one level up
    def fix_url(m):
        attr, url = m.group(1), m.group(2)
        if re.match(r'(https?:|mailto:|#|data:|\.\./|/)', url) or url == 'index.html':
            return m.group(0)
        path = re.split(r'[?#]', url)[0]
        if L == 'sk' and path == 'blog.html':
            return '%s="../blog-sk.html%s"' % (attr, url[len(path):])
        if os.path.exists(os.path.join(SITE, L, path)):
            return m.group(0)
        return '%s="../%s"' % (attr, url)
    b = h.index('<body')
    h = h[:b] + re.sub(r'\b(href|src)="([^"]+)"', fix_url, h[b:])
    for en_slug, slug in zip(EN_GUIDES, GUIDES[L]):
        h = h.replace('href="/%s/"' % en_slug, 'href="/%s/%s/"' % (L, slug))

    # 5. scripts: paths, language, number and date formats, messages
    loc = LOCALE[L]
    h = one(h, "fetch('news/issues.json'", "fetch('../news/issues.json'")
    h = one(h, "document.getElementById('briefIssue').href = 'article.html?slug=' + encodeURIComponent(iss.slug);",
            "document.getElementById('briefIssue').href = '../article.html?slug=' + encodeURIComponent(iss.slug) + '&lang=%s';" % L)
    h = one(h, "body: JSON.stringify({ email: email, hp: hp, lang: 'en' })", "body: JSON.stringify({ email: email, hp: hp, lang: '%s' })" % L)
    h = h.replace('data-consultation-lang="en"', 'data-consultation-lang="%s"' % L)
    h = one(h, "function fmt(n) { return '€' + Math.round(n).toLocaleString('en-IE'); }",
            "function fmt(n) { return Math.round(n).toLocaleString('%s') + '\\u00a0€'; }" % loc)
    h = one(h, "out.textContent = m.toLocaleString('en-IE');", "out.textContent = m.toLocaleString('%s');" % loc)
    h = one(h, "Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('en-IE')", "Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('%s')" % loc)
    h = one(h, "document.getElementById('btcLast').textContent = '€' + Math.round(last).toLocaleString('en-IE');",
            "document.getElementById('btcLast').textContent = Math.round(last).toLocaleString('%s') + '\\u00a0€';" % loc)
    h = one(h, "(chg >= 0 ? '+' : '') + chg.toFixed(1) + '%'",
            "(chg >= 0 ? '+' : '') + chg.toFixed(1).replace('.', ',') + '%s'" % ('\\u00a0%' if L in PCT_SPACE else '%'))
    h = one(h, "var when = dt.getUTCDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getUTCMonth()] + ' ' + dt.getUTCFullYear();",
            "var when = dt.toLocaleDateString('%s', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });" % loc)
    h = one(h, '<div class="amount">€<span id="amtOut">500</span>', '<div class="amount"><span id="amtOut">500</span>&nbsp;€')
    for key in ["Open menu", "Close menu", "Cover image: ", "Please enter a valid email address.", "You're in. Brief goes out Monday.",
                "Something went wrong. Please try again.", "Network error. Please try again.",
                "You're on the list. We'll email you once, when the free audit opens.", "Sending...", "Latest Brief · ", " min"]:
        v = html_mod.unescape(tr[key])  # set via textContent / alt, so no entities
        for q in ("'", '"'):
            lit = q + js_lit(key, q) + q
            h = h.replace(lit, q + js_lit(v, q) + q)
    if L in IN_EN:  # calls outside SK/CS/EN run in English (decision 2026-10-07)
        h, k = re.subn(r'(data-consultation-trigger data-consultation-lang="%s">[^<]*</button>)\.</p>' % L, r'\1 (%s).</p>' % IN_EN[L], h)
        if k != 1:
            sys.exit('%s: consultation line not found' % L)
    h = one(h, "b.textContent = audit ? 'New' : 'Soon';", "b.textContent = audit ? '%s' : '%s';" % (js_lit(tr['New'], "'"), js_lit(tr['Soon'], "'")))
    # longer labels than English: let them fit on small phones
    h = one(h, '</head>', '<style>.spot, .shelf6 > * { min-width: 0; } .spot h3 { hyphens: auto; overflow-wrap: break-word; }\n@media (max-width: 400px) { .nav-cta { font-size: 12px; padding: 8px 10px; } .btn { white-space: normal; text-align: center; } }@media (max-width: 359px) { .nav-cta { white-space: normal; line-height: 1.15; text-align: center; max-width: 104px; padding: 6px 8px; } }</style>\n</head>')
    # the Brief is published in English: say so after the headline (static + script)
    h, k = re.subn(r'(<h3 id="briefTitle">)([^<]*)(</h3>)', lambda m: m.group(1) + m.group(2) + ' (%s)' % BRIEF_EN[L] + m.group(3), h)
    if k != 1:
        sys.exit('%s: briefTitle not found' % L)
    h = one(h, "document.getElementById('briefTitle').textContent = iss.title;",
            "document.getElementById('briefTitle').textContent = iss.title + ' (%s)';" % js_lit(BRIEF_EN[L], "'"))
    h = h.replace('"description": "Non-custodial hub for Bitcoin-only services. Virtuse never holds your keys."',
                  '"description": ' + json.dumps(LD_DESC[L], ensure_ascii=False))
    for a, b2 in HEAD_FIX.get(L, []):
        h = h.replace(a, b2)
    if L in SHORT_CTA:  # long nav button label: short form on the smallest phones
        h, k = re.subn(r'(<a class="nav-cta"[^>]*>)([^<]+)(</a>)', lambda m: m.group(1) + '<span class="cta-full">' + m.group(2) + '</span><span class="cta-short">' + SHORT_CTA[L] + '</span>' + m.group(3), h)
        if k != 1:
            sys.exit('%s: nav-cta not found' % L)
        h = one(h, '</head>', '<style>.cta-short { display: none; } @media (max-width: 359px) { .cta-full { display: none; } .cta-short { display: inline; } }</style>\n</head>')
    h = localise_numbers(h, L)

    # 6. sanity
    for bad in ('<html lang="en"', "'en-IE'", "lang: 'en'"):
        if bad in h:
            sys.exit('%s: leftover %s' % (L, bad))
    out = os.environ.get('OUT') or os.path.join(SITE, L)
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, 'index.html'), 'w').write(h)
    print('%s: written %d bytes' % (L, len(h)))


if __name__ == '__main__':
    for L in sys.argv[1:]:
        build(L)
