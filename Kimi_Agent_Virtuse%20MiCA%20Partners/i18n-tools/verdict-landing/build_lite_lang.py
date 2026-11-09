# -*- coding: utf-8 -*-
"""Verdict Lite in Russian and Ukrainian: <lang>/verdict.html from the English page.

Head and closing scripts come from sk/verdict.html (paths for a language folder),
header and footer from <lang>/treasury.html, the page itself from verdict.html
with texts from lite.<lang>.json. Fails if an English text has no translation.
Also keeps the language menu and hreflang of all four Verdict pages in step.
Legal pages exist in EN and SK only, so privacy and withdrawal links stay English.

Usage (from the site folder): python3 i18n-tools/verdict-landing/build_lite_lang.py"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(SITE, 'i18n-tools', 'home'))
from strings import apply

LANGS = {
  'ru': {'title': 'Verdict: проверьте свой план по Биткоину за 3 минуты | Virtuse',
         'desc': 'Укажите сбережения, цели и опасения. Сразу получите оценку из 100, уровень и 3 самых больших пробела. Lite-оценка бесплатна. Не инвестиционная консультация.',
         'locale': 'ru_RU', 'label': 'Русский',
         'patch': {'<li>Your <b>3 areas to improve</b> first</li>': '<li><b>3 области для улучшения</b> в первую очередь</li>'},
         'fees': 'bitcoin-indeks-komissiy', 'dca': 'bitcoin-kalkulyator-dca', 'heirs': 'bitcoin-nasledstvo', 'tax': 'bitcoin-nalogi', 'svb': 'bitcoin-prodat-ili-zanyat'},
  'uk': {'title': 'Verdict: перевірте свій план щодо Біткоїна за 3 хвилини | Virtuse',
         'desc': 'Вкажіть заощадження, цілі та побоювання. Одразу отримайте оцінку зі 100, рівень і 3 найбільші прогалини. Lite-оцінка безкоштовна. Не інвестиційна консультація.',
         'locale': 'uk_UA', 'label': 'Українська',
         'patch': {'<li>Your <b>3 areas to improve</b> first</li>': '<li><b>3 сфери для покращення</b> насамперед</li>'},
         'fees': 'bitcoin-indeks-komisii', 'dca': 'bitcoin-kalkuliator-dca', 'heirs': 'bitcoin-spadshchyna', 'tax': 'bitcoin-podatky', 'svb': 'bitcoin-prodaty-chy-pozychyty'},
}
MENU = [('en', 'English'), ('sk', 'Slovenčina'), ('ru', 'Русский'), ('uk', 'Українська')]
HREFLANG = '\n'.join('<link rel="alternate" hreflang="%s" href="https://virtuse.com/%sverdict.html">' % (L, '' if L == 'en' else L + '/') for L, _ in MENU) + \
           '\n<link rel="alternate" hreflang="x-default" href="https://virtuse.com/verdict.html">'
STAY_EN = ('/privacy-policy.html', '/withdrawal.html', '/terms-and-conditions.html')

def read(p): return open(os.path.join(SITE, p), encoding='utf8').read()
def write(p, s): open(os.path.join(SITE, p), 'w', encoding='utf8').write(s)

def set_menus(s, cur):
    def href(L):
        if L == cur: return 'verdict.html'
        if cur == 'en': return L + '/verdict.html'
        return '../verdict.html' if L == 'en' else '../%s/verdict.html' % L
    panel = ''.join('<a href="%s" class="lang-opt%s" lang="%s" hreflang="%s" role="menuitem">%s</a>' % (href(L), ' active' if L == cur else '', L, L, n) for L, n in MENU)
    s, n1 = re.subn(r'(<div class="lang-menu-panel" role="menu">).*?(</div>)', lambda m: m.group(1) + panel + m.group(2), s, count=1, flags=re.S)
    foot = ''.join('<a href="%s" hreflang="%s"%s>%s</a>' % (href(L), L, ' aria-current="page"' if L == cur else '', n) for L, n in MENU)
    s, n2 = re.subn(r'(<nav class="footer-langs" aria-label="[^"]*">).*?(</nav>)', lambda m: m.group(1) + foot + m.group(2), s, count=1, flags=re.S)
    assert n1 == 1 and n2 == 1, cur
    return s

def set_hreflang(s):
    s = re.sub(r'(?:<link rel="alternate" hreflang="[^"]+" href="[^"]*verdict\.html">\n?)+', HREFLANG + '\n', s, count=1)
    assert 'hreflang="uk"' in s
    return s

def localise_href(L, cfg, href):
    if not href.startswith('/') or href.startswith(STAY_EN): return href
    slugs = {'/bitcoin-fee-index/': 'fees', '/bitcoin-dca-calculator/': 'dca', '/bitcoin-inheritance/': 'heirs', '/bitcoin-tax/': 'tax', '/sell-vs-borrow-bitcoin/': 'svb'}
    path = href.split('?')[0].split('#')[0]
    if path in slugs: return '/%s/%s/' % (L, cfg[slugs[path]]) + href[len(path):]
    if path.endswith(('.css', '.js', '.jpg', '.png', '.webp', '.mp4')): return href
    disk = path.lstrip('/') + ('index.html' if path.endswith('/') else '')
    return '/' + L + href if os.path.exists(os.path.join(SITE, L, disk)) else href

def build(L, cfg, en, sk):
    tr = json.load(open(os.path.join(HERE, 'lite.%s.json' % L), encoding='utf8'))
    chrome = read(L + '/treasury.html')
    # Head and tail: Slovak page, for the language-folder paths
    head = sk[:sk.index('<body')]
    head = head.replace('<html lang="sk">', '<html lang="%s">' % L).replace('https://virtuse.com/sk/verdict.html"', 'https://virtuse.com/%s/verdict.html"' % L, 2).replace('content="sk_SK"', 'content="%s"' % cfg['locale'])
    head = set_hreflang(head)
    head = re.sub(r'<title>.*?</title>', '<title>' + cfg['title'] + '</title>', head, count=1)
    for k in ('name="description"', 'property="og:description"', 'name="twitter:description"'):
        head = re.sub(r'(<meta ' + k + r' content=")[^"]*', lambda m: m.group(1) + cfg['desc'], head, count=1)
    for k in ('property="og:title"', 'name="twitter:title"'):
        head = re.sub(r'(<meta ' + k + r' content=")[^"]*', lambda m: m.group(1) + cfg['title'], head, count=1)
    # Header and footer: this language's chrome, Tools as the current group
    nav = re.search(r'<header class="nav">.*?</header>', chrome, re.S).group(0)
    nav = re.sub(r' aria-current="[^"]*"', '', nav).replace('<div class="nav-group current" id="', '<div class="nav-group" id="').replace('<div class="nav-group" id="ng-tools">', '<div class="nav-group current" id="ng-tools">')
    foot = re.search(r'<footer class="footer-main">.*?</footer>', chrome, re.S).group(0)
    # The page, translated
    a = en.index('<main'); b = en.index('<footer', a)
    main = en[a:b]
    for x, y in cfg['patch'].items():
        assert main.count(x) == 1, x; main = main.replace(x, y)
    x = '<li>A <b>3-step plan for this week</b></li>'; assert main.count(x) == 1
    main = main.replace(x, '<li><b>3-step plan for this week</b></li>')
    tr['3-step plan for this week'] = tr.pop('3-step plan for this week', None) or {'ru': 'План из 3 шагов на эту неделю', 'uk': 'План із 3 кроків на цей тиждень'}[L]
    main, missing = apply('<body>' + main, tr); main = main[len('<body>'):]
    real = sorted({m for m in missing if re.search(r'[A-Za-z]{2}', m)})
    if real: sys.exit('%s: untranslated: %r' % (L, real[:8]))
    main = re.sub(r'€(\d[\d,]*)', lambda m: m.group(1).replace(',', ' ') + ' €', main)
    main = re.sub(r'\bhref="(/[^"]*)"', lambda m: 'href="%s"' % localise_href(L, cfg, m.group(1)), main)
    t = '<track kind="captions" src="/media/verdict-promo-en-v2.vtt" srclang="en" label="English">'; assert main.count(t) == 1, 'track'
    main = main.replace(t, '<track kind="captions" src="/media/verdict-promo-en-v2-%s.vtt" srclang="%s" label="%s" default>' % (L, L, cfg['label']))
    tail = sk[sk.index('</footer>') + len('</footer>'):]
    body = re.search(r'<body[^>]*>', sk).group(0)
    write(L + '/verdict.html', set_menus(head + body + '\n' + nav + '\n' + main + foot + tail, L))
    print('built', L)

en = read('verdict.html'); sk = read('sk/verdict.html')
for L, cfg in LANGS.items(): build(L, cfg, en, sk)
for p, L in (('verdict.html', 'en'), ('sk/verdict.html', 'sk')):
    write(p, set_hreflang(set_menus(read(p), L)))
