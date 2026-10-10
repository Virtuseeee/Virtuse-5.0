#!/usr/bin/env python3
"""Build buy-bitcoin.html (design v2) for one or more languages.

usage: python3 build_buy.py en [sk cs ...]
Texts: <lang>.json next to this file (keys as in en.json). Nav, footer and script
messages come from that language's homepage (<lang>/index.html, i18n-tools/home/<lang>.json),
head metadata (title, description, hreflang, canonical, JSON-LD) from the page itself.
"""
import html as html_mod, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'home'))
import build_lang as B

# partners in published-fee order (same order in the hero table and the cards)
PARTNERS = [
    dict(id='21bitcoin', name='21bitcoin', logo='logo-21bitcoin-app.png', cls='', pct=0, url='https://21bitcoin.app.link/invite/?code=VIRTUSE'),
    dict(id='bybit', name='ByBit EU', logo='logo-bybit.png', cls='dark', pct=0.25, url='https://partner.bybit.eu/b/VIRTUSE'),
    dict(id='kraken', name='Kraken', logo='logo-kraken.png', cls='cover', pct=0.8, url='https://proinvite.kraken.com/9f1e/lj72d37e'),
    dict(id='invity', name='Invity', logo='logo-invity.svg', cls='pad', pct=None, url='https://invity.onelink.me/yIY4/j44d7awx'),
    dict(id='cryptocom', name='Crypto.com', logo='logo-crypto-com.png', cls='', pct=None, url='https://cryptocom.sjv.io/gRVPor'),
]
ARROW = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
OUT = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12l8-8M5 4h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
CUBE = '<div class="cube-stage var-purpose"><div class="cube-scene"><div class="cube"><div class="cube-face front"></div><div class="cube-face back"></div><div class="cube-face right"></div><div class="cube-face left"></div><div class="cube-face top"></div><div class="cube-face bottom"></div></div></div></div>'
FLAGS = {'sk': '&#127480;&#127472;', 'cz': '&#127464;&#127487;', 'de': '&#127465;&#127466;'}
PCT_SPACE = {'sk', 'cs', 'de', 'fr', 'es'}
EEA = {'en': 'EEA', 'sk': 'EHP', 'cs': 'EHP', 'pl': 'EOG', 'de': 'EWR', 'fr': 'EEE', 'es': 'EEE', 'hu': 'EGT', 'uk': 'ЄЕП', 'ru': 'ЕЭЗ'}


def pct(v, L):
    s = ('%g' % v)
    if L != 'en':
        s = s.replace('.', ',')
    return s + (' %' if L in PCT_SPACE else '%')


def eur(n, L):
    if L == 'en':
        return '€' + format(int(round(n)), ',')
    return B.num(int(round(n)), L) + ' €'


def build(L):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    t = lambda k: T[k]
    pre = '' if L == 'en' else L + '/'
    page_path = os.path.join(SITE, pre + 'buy-bitcoin.html')
    home_path = os.path.join(SITE, pre + 'index.html')
    old = open(page_path).read()
    home = open(home_path).read()

    # ---------- head: page metadata, shared styles ----------
    head = old[:old.index('</head>')]
    head = re.sub(r'<style\b.*?</style>\s*', '', head, flags=re.S)
    head = re.sub(r'<link rel="(?:stylesheet|preconnect)"[^>]*>\s*', '', head)
    head = re.sub(r'<script src="https://cdn\.jsdelivr\.net/npm/animejs[^>]*></script>\s*', '', head)
    head = re.sub(r'<script>if \(!window\.matchMedia\(\'\(prefers-reduced-motion: reduce\)\'\)\.matches\) document\.documentElement\.classList\.add\(\'anim\'\);</script>\s*', '', head)
    head = re.sub(r'<meta name="vb-cfo-stage"[^>]*>\s*', '', head)
    head = re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">',
                  lambda m: re.search(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', home).group(0), head)
    root = '' if L == 'en' else '../'
    i18n = ''
    if L != 'en':
        H = json.load(open(os.path.join(os.path.dirname(HERE), 'home', L + '.json')))
        keys = {'openMenu': 'Open menu', 'closeMenu': 'Close menu', 'soon': 'Soon', 'new': 'New', 'latestBrief': 'Latest Brief · ',
                'min': ' min', 'coverImage': 'Cover image: ', 'badEmail': 'Please enter a valid email address.', 'sending': 'Sending...',
                'subscribed': "You're in. Brief goes out Monday.", 'error': 'Something went wrong. Please try again.', 'netError': 'Network error. Please try again.'}
        obj = {k: html_mod.unescape(H[v]) for k, v in keys.items()}
        obj['briefLangNote'] = ' (%s)' % B.BRIEF_EN[L]
        i18n = '<script>window.VB_I18N = %s;</script>\n' % json.dumps(obj, ensure_ascii=False)
    head = head.rstrip() + '\n<meta name="vb-cfo-stage" content="wait">\n' \
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' \
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap">\n' \
        '<link rel="stylesheet" href="%ssite-v2.css?v=2">\n' % root + \
        "<script>if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('anim');</script>\n" + i18n + '</head>\n'

    # ---------- nav + footer from this language's homepage ----------
    nav = home[home.index('<header class="nav">'):home.index('</header>') + len('</header>')]
    nav = re.sub(r'<a class="logo" href="[^"]*"', '<a class="logo" href="index.html"', nav)
    nav = nav.replace('<a href="buy-bitcoin.html">', '<a href="buy-bitcoin.html" aria-current="page">', 1)
    nav = nav.replace('<div class="nav-group" id="ng-services">', '<div class="nav-group current" id="ng-services">')

    def lang_panel(seg):
        seg = re.sub(r'href="((?:\.\./)?(?:[a-z]{2}/)?)index\.html"', r'href="\1buy-bitcoin.html"', seg)
        return seg
    i = nav.index('<div class="lang-menu-panel"'); j = nav.index('</div>', i)
    nav = nav[:i] + lang_panel(nav[i:j]) + nav[j:]
    foot = home[home.index('<footer class="footer-main">'):home.index('</footer>') + len('</footer>')]
    i = foot.index('<nav class="footer-langs"'); j = foot.index('</nav>', i)
    foot = foot[:i] + lang_panel(foot[i:j]) + foot[j:]

    call_suffix = (' (%s)' % B.IN_EN[L]) if L in B.IN_EN else ''

    # ---------- hero table ----------
    rows = []
    for k, p in enumerate(PARTNERS):
        pid = p['id']
        cheapest = ' best' if k == 0 else ''
        more = ' hc-more' if k >= 3 else ''
        if p['pct'] is None:
            fee = '<span class="hc-fee na">%s</span>' % t('fee_site')
            yr = '<span class="yr na">–</span>'
            data = ''
        else:
            fee = '<span class="hc-fee">%s</span>' % pct(p['pct'], L)
            yr = '<span class="yr">%s</span>' % eur(500 * 12 * p['pct'] / 100, L)
            data = ' data-pct="%g"' % p['pct']
        rows.append('<div class="row hc-row%s%s"%s><span class="hc-name"><img src="%s%s" alt="" width="28" height="28" class="%s" loading="lazy"><span><b>%s</b><small>%s</small></span></span>%s%s<a class="hc-get" href="%s" target="_blank" rel="noopener noreferrer" aria-label="%s">%s %s</a></div>'
                    % (cheapest, more, data, root, p['logo'], p['cls'], p['name'], t('pr_%s_product' % pid), fee, yr, p['url'], t('pr_%s_get' % pid), t('get'), ARROW))
    hero_card = '''<div class="hcard" id="feeRows">
        <div class="hc-slider">
          <label for="amt">{amt_label}</label>
          <div class="amount">{amt_html} <small>{per_month}</small></div>
          <input type="range" id="amt" min="50" max="5000" step="50" value="500">
          <div class="range-ends"><span>{e50}</span><span>{e5000}</span></div>
        </div>
        <div class="row head hc-row"><span>{col_partner}</span><span>{col_fee}</span><span class="yr">{col_year}</span><span></span></div>
        {rows}
        <button type="button" class="hc-toggle" id="hcToggle" aria-expanded="false" data-less="{show_less}">{show_all}</button>
        <p class="hc-lowest"><i></i>{lowest}</p>
      </div>'''.format(amt_label=t('amt_label'), per_month=t('per_month'),
                      amt_html=('€<span id="amtOut">500</span>' if L == 'en' else '<span id="amtOut">500</span>&nbsp;€'),
                      e50=eur(50, L), e5000=eur(5000, L), col_partner=t('col_partner'), col_fee=t('col_fee'), col_year=t('col_year'),
                      rows='\n        '.join(rows), show_all=t('show_all'), show_less=t('show_less'), lowest=t('lowest'))

    diff_line = t('diff_line')
    for a, b in (('€48', eur(48, L)), ('€6,000', eur(6000, L))):
        diff_line = diff_line.replace(a, b)
    diff = '''<div class="diff hc-diff">
        <div class="diff-txt">
          <span>{diff_label}</span>
          <b class="diff-big" id="diff10">{e480}</b>
          <em>{diff_line}</em>
        </div>
        <svg class="save-chart" viewBox="0 0 220 96" aria-hidden="true">
          <defs><linearGradient id="saveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7931a" stop-opacity=".45"/><stop offset="1" stop-color="#f7931a" stop-opacity="0"/></linearGradient></defs>
          <path d="M8 80 L200 12 L200 80 Z" fill="url(#saveFill)"/>
          <path d="M8 80 L200 12" stroke="#f7931a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
          <path d="M8 80 L200 58.75" stroke="#f2c94c" stroke-width="1.4" stroke-dasharray="3 3" fill="none"/>
          <path d="M8 80 L200 80" stroke="#3fb950" stroke-width="2" fill="none" stroke-linecap="round"/>
          <circle cx="200" cy="12" r="3.5" fill="#f7931a"/>
          <text x="8" y="94">{y0}</text><text x="200" y="94" text-anchor="end">{y10}</text>
          <text x="194" y="8" text-anchor="end" id="saveEnd">{e480}</text>
        </svg>
      </div>'''.format(diff_label=t('diff_label'), e480=eur(480, L), diff_line=diff_line, y0=t('year0'), y10=t('year10'))

    dca = '/%s%s/' % (pre, B.GUIDES[L][2]) if L != 'en' else '/bitcoin-dca-calculator/'
    fidx = '/%s%s/' % (pre, B.GUIDES[L][1]) if L != 'en' else '/bitcoin-fee-index/'

    logos = ''.join('<img src="%s%s" alt="%s" width="22" height="22" class="%s" loading="lazy">' % (root, p['logo'], p['name'], p['cls']) for p in PARTNERS)
    trust = '''<div class="trust-strip">
    <span><b>5</b> {tp}</span><span><b>{zero}</b> {tl}</span><span><b>{eea}</b> {te}</span>
    <span class="ts-logos">{logos}</span>
  </div>'''.format(tp=t('trust_partners'), zero=pct(0, L), tl=t('trust_lowest'), te=t('trust_eea'), eea=EEA[L], logos=logos)

    # ---------- partner cards ----------
    cards = []
    for p in PARTNERS:
        pid = p['id']
        badge = pct(p['pct'], L) if p['pct'] is not None else t('fee_badge_site')
        feats = ''.join('<li>%s</li>' % t('pr_%s_f%d' % (pid, n)) for n in range(1, 5))
        cards.append('''      <article class="pcard2" id="p-{pid}">
        <span class="pc-badge{na}">{badge}</span>
        <div class="pc-head"><img src="{root}{logo}" alt="{name}" class="{cls}" width="48" height="48" loading="lazy"><div><h3>{name}</h3><div class="pc-lic">{lic}</div></div></div>
        <details class="pc-more" open><summary>{details}</summary>
          <p>{body}</p>
          <ul class="pc-feats">{feats}</ul>
        </details>
        <div class="pc-cta"><a href="{url}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">{get} {out}</a></div>
      </article>'''.format(pid=pid, na='' if p['pct'] is not None else ' na', badge=badge, root=root, logo=p['logo'], name=p['name'], cls=p['cls'],
                           lic=t('pr_%s_lic' % pid), details=t('details'), body=t('pr_%s_body' % pid), feats=feats, url=p['url'],
                           get=t('pr_%s_get' % pid), out=OUT))
    cards.append('''      <a class="pcard2 pc-finder" href="concierge.html?utm_source=concierge&amp;utm_medium=buy_grid">
        <h3>{h}</h3><p>{p}</p><span class="pc-finder-cta">{c} {a}</span>
      </a>'''.format(h=t('finder_h'), p=t('finder_p'), c=t('finder_cta'), a=ARROW))

    steps = ''.join('''      <div class="how-log-item">
        <div class="how-log-marker"><span class="how-log-dot"></span></div>
        <div class="how-log-body">
          <span class="how-log-num">{step} 0{n}</span>
          <h3>{tt}</h3>
          <p>{pp}</p>
        </div>
      </div>
'''.format(step=t('step'), n=n, tt=t('s%d_t' % n), pp=t('s%d_p' % n)) for n in range(1, 5))

    countries = ''.join('<a class="gcard" href="/buy-bitcoin/%s/"><span class="gflag" aria-hidden="true">%s</span><b>%s</b><span>%s</span></a>'
                        % (slug, FLAGS[c], t('g_' + c), t('g_desc')) for c, slug in (('sk', 'slovakia'), ('cz', 'czechia'), ('de', 'germany')))

    brief = '''<section id="brief">
    <div class="sec-head one"><div class="sec-copy"><h2>{h2a} <span>{h2b}</span></h2></div></div>
    <div class="brief brief-slim">
      <a class="issue issue-slim" id="briefIssue" data-root="{root}" href="{root}article.html?slug=bitcoin-beat-the-war-november-still-gets-a-vote{langq}">
        <div class="issue-body">
          <span class="k" id="briefMeta">{latest}</span>
          <h3 id="briefTitle">Bitcoin Beat the War. November Still Gets a Vote.{note}</h3>
          <p id="briefExcerpt"></p>
          <span class="more">{read}</span>
        </div>
      </a>
      <div class="signup">
        <div class="btc-spark" id="btcSpark" hidden>
          <div class="btc-top"><span>BTC / EUR · 90 d</span><b id="btcLast"></b><em id="btcChg"></em></div>
          <svg viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="btcFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7931a" stop-opacity=".35"/><stop offset="1" stop-color="#f7931a" stop-opacity="0"/></linearGradient></defs><path id="btcArea" fill="url(#btcFill)"/><path id="btcLine" fill="none" stroke="#f7931a" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </div>
        <h3>{gh} <span>{free}</span></h3>
        <p>{gp}</p>
        <form class="brief-form" id="briefForm" data-brief-form data-source="buy_brief" novalidate>
          <label for="email" style="position:absolute;left:-9999px">{email}</label>
          <input id="email" name="email" type="email" placeholder="{email}" autocomplete="email" required>
          <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button class="btn btn-ghost" type="submit">{btn}</button>
        </form>
        <div class="brief-msg" id="briefMsg" aria-live="polite"></div>
        <div class="fine">{fine} <a href="{root}news.html?utm_source=brief&amp;utm_medium=buy" style="color:var(--muted)">{all}</a></div>
      </div>
    </div>
  </section>'''.format(h2a=t('b_h2_a'), h2b=t('b_h2_b'), root=root, langq=('&amp;lang=' + L) if L != 'en' else '', latest=t('b_latest'),
                       note=(' (%s)' % B.BRIEF_EN[L]) if L != 'en' else '', read=t('b_read'), gh=t('b_get_h'), free=t('b_free'), gp=t('b_get_p'),
                       email=t('email'), btn=t('b_btn'), fine=t('b_fine'), all=t('b_all'))

    body = '''<body class="page-buy">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO: headline + live comparison of all 5 partners -->
  <div class="buy-hero">
    <div class="bh-copy">
      <div class="eyebrow"><i></i>{eyebrow}</div>
      <h1>{h1a} <span class="grad">{h1g}</span>{h1b}</h1>
      <p class="bh-sub">{sub}</p>
      <p class="bh-lead">{lead}</p>
      <div class="bh-ctas">
        <a class="btn btn-orange" href="#partners">{cta}</a>
        <a class="tlink" href="stacking.html?utm_source=stacking&amp;utm_medium=widget">{plan} {arrow}</a>
      </div>
      <p class="alt bh-talk">{talk} <button type="button" class="link-btn" data-consultation-trigger data-consultation-lang="{L}">{call}</button>{suffix}.</p>
    </div>
    <div class="bh-table">
      {hero_card}
      {diff}
      <p class="src hc-src">{src} <a href="{fidx}">{fee_index}</a></p>
      <p class="cat-note hc-earn">{earn}</p>
    </div>
  </div>
  {trust}

  <!-- 2. PARTNERS -->
  <section id="partners">
    <div class="sec-head one"><div class="sec-copy"><h2>{ph2a} <span>{ph2b}</span></h2></div></div>
    <div class="pgrid pgrid3">
{cards}
    </div>
    <p class="cat-note">{earn}</p>
  </section>

  <!-- 3. HOW IT WORKS -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log how-log-4">
{steps}    </div>
  </section>

  <!-- 4. COUNTRY GUIDES -->
  <section id="guides">
    <div class="sec-head one"><div class="sec-copy"><h2>{gh2a} <span>{gh2b}</span></h2></div></div>
    <div class="gcards">{countries}</div>
    <p class="tools-line">{tools_label} <a href="{dca}">{tool_dca}</a> · <a href="{fidx}">{tool_index}</a></p>
  </section>

  <!-- 5. BRIEF -->
  {brief}

  {foot}
</main>

<script src="{root}site-v2.js?v=2" defer></script>
<script src="{root}consultation-widget.js?v=20261007b" defer></script>
<script src="{root}concierge-launcher.js" defer></script>
</body>
</html>
'''.format(nav=nav, eyebrow=t('eyebrow'), h1a=t('h1_a'), h1g=t('h1_grad'), h1b=(t('h1_b') if t('h1_b')[:1] in '.!?' else ' ' + t('h1_b')), sub=t('sub'), lead=t('lead'), cta=t('cta'),
           plan=t('plan'), arrow=ARROW, talk=t('talk'), L=L, call=t('call'), suffix=call_suffix, cube=CUBE, hero_card=hero_card, diff=diff,
           src=t('src'), fidx=fidx, fee_index=t('fee_index'), earn=t('earn'), trust=trust, ph2a=t('p_h2_a'), ph2b=t('p_h2_b'),
           cards='\n'.join(cards), hh2a=t('h_h2_a'), hh2b=t('h_h2_b'), steps=steps, gh2a=t('g_h2_a'), gh2b=t('g_h2_b'),
           countries=countries, tools_label=t('tools_label'), dca=dca, tool_dca=t('tool_dca'), tool_index=t('tool_index'),
           brief=brief, foot=foot, root=root)

    out = head + body
    # relative links in the body: same file in this folder, else one level up
    if L != 'en':
        def fix(m):
            attr, url = m.group(1), m.group(2)
            if re.match(r'(https?:|mailto:|#|data:|\.\./|/)', url):
                return m.group(0)
            path = re.split(r'[?#]', url)[0]
            if L == 'sk' and path == 'blog.html':
                return '%s="../blog-sk.html%s"' % (attr, url[len(path):])
            if os.path.exists(os.path.join(SITE, L, path)):
                return m.group(0)
            return '%s="../%s"' % (attr, url)
        b = out.index('<body')
        out = out[:b] + re.sub(r'\b(href|src)="([^"]+)"', fix, out[b:])
    open(page_path, 'w').write(out)
    print('%s: %d bytes' % (L, len(out)))


if __name__ == '__main__':
    for L in sys.argv[1:]:
        build(L)
