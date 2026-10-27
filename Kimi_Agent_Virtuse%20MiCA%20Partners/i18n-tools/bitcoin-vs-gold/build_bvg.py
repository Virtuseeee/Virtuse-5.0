#!/usr/bin/env python3
"""Build bitcoin-vs-gold.html (Bitcoin vs gold, silver and commodities; design v2) in 10 languages.

usage: python3 build_bvg.py [en sk ...]       (texts: <lang>.json next to this file)

Data: data/bitcoin-vs-commodities.json, rebuilt daily by commodities-build/build.mjs
(GitHub Action). The tables are rendered here from that file (USD), so crawlers and
no-JS readers see real numbers; /bitcoin-vs-gold.js then re-renders everything from
the live JSON (raw.githubusercontent first, the local copy as fallback), adds the
charts and the EUR view. Strings the script needs are the "c_*" keys, inlined as JSON.
Also maintains the page's <url> block in sitemap.xml (markers BVG:START/END).
Also writes /bitcoin-vs-gold/embed/ (EN, the returns table for other sites' iframes; no GTM, no
cookie banner, noindex) which re-renders from the same live JSON, so it stays current without
a rebuild. The server .htaccess lets only the embed paths be framed by other sites.
"""
import datetime, html, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
import build_fee_index as F
C, B, SITE, ORIGIN = F.C, F.B, F.SITE, F.ORIGIN
LANGS = ['en', 'sk', 'cs', 'uk', 'ru', 'de', 'fr', 'es', 'pl', 'hu']
PAGE = 'bitcoin-vs-gold.html'
JS_V = '2'
RAW = 'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/bitcoin-vs-commodities.json'
DATA = json.load(open(os.path.join(SITE, 'data', 'bitcoin-vs-commodities.json')))
ASSETS = [a['id'] for a in DATA['assets']]
# chart colours: Bitcoin orange (brand), the rest stepped for the dark surface and
# validated with the dataviz palette checker in this legend order (adjacent pairs pass)
COLORS = {'btc': '#f7931a', 'silver': '#3987e5', 'gold': '#c98500', 'basket': '#199e70', 'oil': '#9085e9', 'copper': '#e66767', 'platinum': '#008300'}
LEGEND = ['btc', 'silver', 'gold', 'basket', 'oil', 'copper', 'platinum']
DEFAULT_ON = ['btc', 'gold', 'silver', 'basket']
AMOUNT = 10000
EMBED = 'bitcoin-vs-gold/embed/'
EMBED_COLS = ['ytd', 'y1', 'y5', 'y10']
# alt text = what the image shows (sk image in Slovak, the shared image in English)
OG_ALT = {'en': 'Virtuse: Bitcoin vs Gold, Silver & Oil. Returns by year, updated daily.',
          'sk': 'Virtuse: Bitcoin vs. zlato, striebro a ropa. Výnosy po rokoch, denne aktualizované.'}
esc = html.escape

CSS = '''<style>
.page-bvg .buy-hero2 h1 .h1-grey{display:block}
.bvg-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 20px;margin-top:22px;font-size:13px;color:var(--muted)}
.bvg-bar .bd-cur{vertical-align:middle;margin-left:8px}
.bvg-bar .bd-cur button{font-size:12px;padding:4px 10px}
.bvg-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--card)}
.bvg-table{border-collapse:separate;border-spacing:0;width:100%;font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap}
.bvg-table th,.bvg-table td{padding:10px 12px;text-align:right;border-bottom:1px solid var(--line)}
.bvg-table thead th{font:600 12px var(--sans);color:var(--muted);background:var(--card);position:sticky;top:0;cursor:pointer;user-select:none}
.bvg-table thead th.on{color:var(--text)}
.bvg-table thead th.on::after{content:" ↓";color:var(--muted)}
.bvg-table th.bvg-a,.bvg-table td.bvg-a{text-align:left;position:sticky;left:0;background:var(--card);z-index:1;min-width:180px;cursor:default}
.bvg-table thead th.bvg-a{z-index:2}
.bvg-table td.bvg-a b{display:block;color:var(--text);font-weight:600}
.bvg-table td.bvg-a span{font-size:12px;color:var(--muted)}
.bvg-table tr.bvg-btc td.bvg-a b{color:var(--btc-orange,#f7931a)}
.bvg-table td.bvg-p{color:var(--muted)}
.bvg-table td.bvg-pa{color:var(--muted);font-size:12px}
.bvg-table tbody tr:last-child td{border-bottom:0}
.bvg-table tfoot td{color:var(--muted);font-size:12px;font-weight:600}
.bvg-table tfoot td.bvg-a{font-weight:500}
.bvg-table tfoot tr:last-child td{border-bottom:0}
.bvg-table td.bvg-y{min-width:64px}
.bvg-note{font-size:12px;color:var(--muted);margin:14px 0 0;line-height:1.6;max-width:860px}
.bvg-note a{color:var(--muted)}
.bvg-ctrl{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;margin-bottom:14px}
.bvg-ctrl .seg{margin:0}
.bvg-legend{display:flex;flex-wrap:wrap;gap:6px 10px;margin:0}
.bvg-legend button{display:inline-flex;align-items:center;gap:7px;background:none;border:1px solid var(--line);border-radius:999px;padding:5px 12px 5px 8px;color:var(--text);font:500 13px var(--sans);cursor:pointer}
.bvg-legend button i{width:10px;height:10px;border-radius:50%;background:var(--c);flex:none}
.bvg-legend button[aria-pressed=false]{color:var(--muted)}
.bvg-legend button[aria-pressed=false] i{background:transparent;box-shadow:inset 0 0 0 2px var(--c)}
.bvg-hint{font-size:12px;color:var(--muted);margin:0 0 10px}
.bvg-chartbox{position:relative;border:1px solid var(--line);border-radius:14px;background:var(--card);padding:14px 10px 8px}
.bvg-chart{display:block;width:100%;height:340px}
.bvg-chart .grid{stroke:rgba(255,255,255,.07);stroke-width:1}
.bvg-chart .ax{fill:var(--muted);font:500 11px var(--mono)}
.bvg-chart .ln{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
.bvg-chart .lbl{font:600 11px var(--sans);paint-order:stroke;stroke:#141414;stroke-width:3px;stroke-linejoin:round}
.bvg-chart .xh{stroke:rgba(255,255,255,.35);stroke-width:1;stroke-dasharray:3 3}
.bvg-chart .dot{stroke:#141414;stroke-width:2}
.bvg-tip{position:absolute;pointer-events:none;background:#1c1c1c;border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.5;color:var(--text);min-width:150px;z-index:3;display:none}
.bvg-tip b{display:block;font:600 11px var(--mono);color:var(--muted);margin-bottom:4px}
.bvg-tip div{display:flex;justify-content:space-between;gap:14px}
.bvg-tip i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.bvg-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.bvg-tiles .bd-v{font-size:30px}
.bvg-tiles .bd-v small{font-size:14px;color:var(--muted);font-weight:500;margin-left:4px}
.bvg-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,360px);gap:16px;align-items:start}
.bvg-two .bvg-wrap{overflow:visible}
.bvg-two .bvg-table th,.bvg-two .bvg-table td{position:static}
.bvg-method p{color:var(--muted);font-size:15px;line-height:1.65;max-width:860px;margin:0 0 12px}
.bvg-method .bd-links{margin-top:6px}
.pos{color:#b8f0c8}.neg{color:#ffc4c4}
@media (max-width:900px){.bvg-two{grid-template-columns:1fr}.bvg-tiles{grid-template-columns:1fr 1fr}.bvg-chart{height:280px}}
@media (max-width:600px){.bvg-table{font-size:13px}.bvg-table th,.bvg-table td{padding:8px 9px}.bvg-table th.bvg-a,.bvg-table td.bvg-a{min-width:120px}.bvg-table td.bvg-a span{display:none}.bvg-tiles .bd-v{font-size:22px}.bvg-chart{height:240px}}
</style>
'''


def dec(L):
    return '.' if L == 'en' else ','


def group(s, L):
    """thousands grouping of an integer string"""
    if L == 'en':
        return format(int(s), ',')
    if L == 'es' and int(s) < 10000:
        return s
    sep = '.' if L in ('de', 'es') else ' '
    out = ''
    while len(s) > 3:
        out = sep + s[-3:] + out
        s = s[:-3]
    return s + out


def num(v, L, d=0):
    s = '%.*f' % (d, abs(v))
    ip, _, fp = s.partition('.')
    return ('-' if v < 0 else '') + group(ip, L) + (dec(L) + fp if fp else '')


def pct(v, L):
    if v is None:
        return '–'
    p = v * 100
    s = num(p, L, 1 if abs(p) < 100 else 0)
    return s + (' %' if L in C.PCT_SPACE else '%')


def money(v, L, ccy, d=0):
    s = num(v, L, d)
    sym = '$' if ccy == 'USD' else '€'
    return sym + s if L == 'en' else s + ' ' + sym


def cls(v):
    return '' if v is None else (' class="pos"' if v >= 0 else ' class="neg"')


def tint(v):
    if v is None:
        return ''
    k = min(abs(v) / 0.4, 1)
    a = 0.10 + 0.32 * k
    c = '46,160,90' if v >= 0 else '210,60,60'
    return ' style="background:rgba(%s,%.2f);color:%s"' % (c, a, '#b8f0c8' if v >= 0 else '#ffc4c4')


def asset_cell(a, t, L):
    tk = a['ticker'] if a['id'] != 'btc' else 'BTC-USD'
    sub = t['c_via'].replace('{t}', tk) if a['id'] != 'btc' else 'BTC-USD'
    return '<td class="bvg-a"><b>%s</b><span>%s</span></td>' % (t['c_a_' + a['id']], sub)


def returns_table(t, L):
    cols = [('ytd', 'c_col_ytd'), ('y1', 'c_col_1y'), ('y5', 'c_col_5y'), ('y10', 'c_col_10y')]
    h = '<thead><tr><th class="bvg-a">%s</th><th data-sort="price">%s</th>' % (t['c_col_asset'], t['c_col_price'])
    for k, lab in cols:
        h += '<th data-sort="%s" class="%s">%s</th>' % (k, 'on' if k == 'ytd' else '', t[lab])
        if k in ('y5', 'y10'):
            h += '<th data-sort="%sPa">%s</th>' % (k, t['c_pa'])
    h += '<th data-sort="since">%s</th></tr></thead><tbody>' % t['c_col_since']
    rows = sorted(DATA['assets'], key=lambda a: -(a['periods']['ytd']['usd'] if a['periods']['ytd']['usd'] is not None else -9))
    for a in rows:
        h += '<tr class="%s">%s' % ('bvg-btc' if a['id'] == 'btc' else '', asset_cell(a, t, L))
        sp = a.get('spot')
        if sp:
            unit = t.get('c_u_' + sp['unit'], '')
            h += '<td class="bvg-p">%s%s</td>' % (money(sp['usd'], L, 'USD', 2 if sp['usd'] < 100 else 0), esc(unit))
        else:
            h += '<td class="bvg-p">–</td>'
        for k, _ in cols:
            p = a['periods'][k]
            h += '<td%s>%s</td>' % (tint(p['usd']), pct(p['usd'], L))
            if k in ('y5', 'y10'):
                h += '<td class="bvg-pa">%s</td>' % pct(p.get('usdPa'), L)
        h += '<td%s>%s</td></tr>' % (tint(a['cumulative']['usd']), pct(a['cumulative']['usd'], L))
    return h + '</tbody>'


def yearly_table(t, L):
    years = DATA['years']
    h = '<thead><tr><th class="bvg-a">%s</th>' % t['c_col_asset']
    for y in years:
        h += '<th class="bvg-y">%s</th>' % (('%d %s' % (y, t['c_ytd_short'])) if y == DATA['ytdYear'] else y)
    h += '</tr></thead><tbody>'
    for a in DATA['assets']:
        h += '<tr class="%s">%s' % ('bvg-btc' if a['id'] == 'btc' else '', asset_cell(a, t, L))
        for y in years:
            v = a['annual'][str(y)]['usd']
            h += '<td%s>%s</td>' % (tint(v), pct(v, L))
        h += '</tr>'
    h += '</tbody><tfoot>'
    for lab, best in ((t['c_best'], True), (t['c_worst'], False)):
        h += '<tr><td class="bvg-a">%s</td>' % lab
        for y in years:
            vals = [(a['annual'][str(y)]['usd'], a) for a in DATA['assets'] if a['annual'][str(y)]['usd'] is not None]
            pick = (max if best else min)(vals, key=lambda x: x[0])[1]
            h += '<td>%s</td>' % t['c_a_' + pick['id']]
        h += '</tr>'
    return h + '</tfoot>'


def ratio_table(t, L):
    years = DATA['years']
    g, s = DATA['ratio']['gold']['yearEnd'], DATA['ratio']['silver']['yearEnd']
    h = '<thead><tr><th class="bvg-a">%s</th><th>%s</th><th>%s</th></tr></thead><tbody>' % (t['c_r_year'], t['c_r_gold'], t['c_r_silver'])
    for y in reversed(years):
        lab = ('%d %s' % (y, t['c_ytd_short'])) if y == DATA['ytdYear'] else str(y)
        h += '<tr><td class="bvg-a">%s</td><td>%s</td><td>%s</td></tr>' % (lab, num(g[str(y)], L, 1), num(s[str(y)], L, 0))
    return h + '</tbody>'


def date_str(iso, L):
    return F.date_str(iso, L)


def legend(t):
    return ''.join('<button type="button" data-id="%s" aria-pressed="%s" style="--c:%s"><i></i>%s</button>' % (
        i, 'true' if i in DEFAULT_ON else 'false', COLORS[i], t['c_a_' + i]) for i in LEGEND)


def build(L):
    t = {k: v for k, v in json.load(open(os.path.join(TOOLS, 'bitcoin-data', L + '.json'))).items() if k.startswith('b_') or k == 'email'}
    t.update(json.load(open(os.path.join(HERE, L + '.json'))))
    loc = '/' if L == 'en' else '/%s/' % L
    page = loc + PAGE
    shell = os.path.join(SITE, PAGE if L == 'en' else os.path.join(L, PAGE))
    alts = [(x, ('/' if x == 'en' else '/%s/' % x) + PAGE) for x in LANGS] + [('x-default', '/' + PAGE)]
    amt = money(AMOUNT, L, 'USD')
    faq = [(t['q%d' % i], t['a%d' % i]) for i in range(1, 10) if 'q%d' % i in t]   # q1..q4 in every language, more where a language has them
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [
        F.crumbs_ld([(t['crumb_home'], loc), (t['crumb_data'], loc + 'bitcoin-data.html'), (t['crumb_page'], page)]),
        {'@type': 'Dataset', 'name': t['ds_name'], 'description': t['ds_desc'], 'url': ORIGIN + page,
         'dateModified': DATA['asOf'], 'temporalCoverage': '2016-01-01/..',
         'variableMeasured': ['Bitcoin', 'Gold', 'Silver', 'WTI crude oil', 'Copper', 'Platinum', 'Commodities basket', 'BTC/gold ratio', 'BTC/silver ratio'],
         'creator': {'@id': ORIGIN + '/#org'}, 'isAccessibleForFree': True, 'inLanguage': L,
         'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': ORIGIN + '/data/bitcoin-vs-commodities.json'}]},
        F.faq_ld([(F.plain(q), F.plain(a)) for q, a in faq])]}
    # OG image: own Slovak image, every other language the English one (og/README in i18n-tools/bitcoin-vs-gold/og)
    og_file = 'bitcoin-vs-gold-sk.jpg' if L == 'sk' else 'bitcoin-vs-gold.jpg'
    assert os.path.exists(os.path.join(SITE, 'og', og_file)), og_file
    out = F.head(L, t['title'], t['description'], page, alts, ld, og_alt=OG_ALT['sk' if L == 'sk' else 'en'], title_max=60,
                 og_image=ORIGIN + '/og/' + og_file)
    out = out.replace("connect-src 'self'", "connect-src 'self' https://raw.githubusercontent.com", 1)
    out = out.replace('</head>', CSS + '</head>', 1)
    nav, foot = F.chrome(L, lambda x: ('/' if x == 'en' else '/%s/' % x) + PAGE)
    nav = nav.replace('<div class="nav-group current" id="ng-services">', '<div class="nav-group" id="ng-services">')
    nav = nav.replace('<div class="nav-group" id="ng-learn">', '<div class="nav-group current" id="ng-learn">')
    nav = re.sub(r'(<a href="%sbitcoin-data\.html")' % re.escape(loc), r'\1 aria-current="page"', nav, count=1)

    def page_url(p):
        return loc + p if L == 'en' or os.path.exists(os.path.join(SITE, L, p)) else '/' + p
    faq_html = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (
        ' open' if i == 0 else '', esc(q).replace('&#x27;', "'"), a.replace('href="buy-bitcoin.html"', 'href="%s"' % page_url('buy-bitcoin.html'))) for i, (q, a) in enumerate(faq))
    rel = [(page_url('asset-returns.html'), 'rel_assets'), (page_url('bitcoin-data.html'), 'rel_data'), (page_url('btc-monthly-returns.html'), 'rel_monthly'),
           (page_url('stacking.html'), 'rel_stack'), (page_url('retirement-calculator.html'), 'rel_retire'), (page_url('buy-bitcoin.html'), 'rel_buy')]
    rcards = ''.join('<a class="gcard" href="%s"><b>%s</b><span>%s</span></a>' % (u, t[x + '_t'], t[x + '_p']) for u, x in rel)

    strings = {k: v for k, v in t.items() if k.startswith('c_')}
    cfg = {'raw': RAW, 'local': loc + 'data/bitcoin-vs-commodities.json' if L == 'en' else '/data/bitcoin-vs-commodities.json',
           'lang': L, 'locale': B.LOCALE.get(L, 'en-US'), 'pctSpace': L in C.PCT_SPACE, 'colors': COLORS, 'legend': LEGEND, 'on': DEFAULT_ON, 'amount': AMOUNT}
    asof = t['c_asof'].replace('{d}', date_str(DATA['asOf'], L))
    g, s = DATA['ratio']['gold'], DATA['ratio']['silver']
    btc = next(a for a in DATA['assets'] if a['id'] == 'btc'); gold = next(a for a in DATA['assets'] if a['id'] == 'gold')
    tiles = ''.join('<div class="bd-m" data-k="%s"><span class="bd-l">%s</span><b class="bd-v">%s</b></div>' % (k, lab, val) for k, lab, val in (
        ('rgold', t['c_t_gold'], '%s<small>%s</small>' % (num(g['current'], L, 1), t['c_oz'])),
        ('rsilver', t['c_t_silver'], '%s<small>%s</small>' % (num(s['current'], L, 0), t['c_oz'])),
        ('pbtc', t['c_t_btc'], money(btc['spot']['usd'], L, 'USD')),
        ('pgold', t['c_t_goldp'], '%s<small>%s</small>' % (money(gold['spot']['usd'], L, 'USD'), t['c_per_oz']))))

    out += '''<body class="page-buy page-data page-bvg no-split">
{nav}

<main class="wrap bd-v3 bd-acc-yellow" id="top">

  <!-- 1. HERO -->
  <div class="buy-hero2 pf-hero">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <p class="sp-lead">{lead}</p>
    <div class="bvg-bar"><span id="bvgAsOf">{asof}</span><span>{ccy}<span class="bd-cur" role="group" aria-label="USD / EUR"><button type="button" data-cur="USD" class="on">USD</button><button type="button" data-cur="EUR">EUR</button></span></span></div>
  </div>
  <noscript><p class="pf-noscript">{noscript}</p></noscript>

  <!-- 2. RETURNS -->
  <section id="returns">
    <div class="sec-head one"><div class="sec-copy"><h2>{rh2a} <span>{rh2b}</span></h2></div></div>
    <p class="bvg-hint">{sort_hint}</p>
    <div class="bvg-wrap"><table class="bvg-table" id="bvgTable">{rtable}</table></div>
    <p class="bvg-note">{rnote}</p>
  </section>

  <!-- 3. CALENDAR YEARS -->
  <section id="yearly">
    <div class="sec-head one"><div class="sec-copy"><h2>{yh2a} <span>{yh2b}</span></h2></div></div>
    <div class="bvg-wrap"><table class="bvg-table" id="bvgYears">{ytable}</table></div>
    <p class="bvg-note">{ynote}</p>
  </section>

  <!-- 4. GROWTH CHART -->
  <section id="growth">
    <div class="sec-head one"><div class="sec-copy"><h2>{gh2a} <span>{gh2b}</span></h2></div></div>
    <div class="bvg-ctrl"><span class="seg" role="group" id="bvgRange"><button type="button" class="seg-btn" data-r="1">{r1}</button><button type="button" class="seg-btn" data-r="5">{r5}</button><button type="button" class="seg-btn on" data-r="10">{r10}</button></span><div class="bvg-legend" id="bvgLegend">{legend}</div></div>
    <p class="bvg-hint">{legend_hint}</p>
    <div class="bvg-chartbox"><svg class="bvg-chart" id="bvgGrowth" role="img" aria-label="{garia}"></svg><div class="bvg-tip" id="bvgTip1"></div></div>
    <p class="bvg-note">{gnote}</p>
  </section>

  <!-- 5. BTC/GOLD RATIO -->
  <section id="ratio">
    <div class="sec-head one"><div class="sec-copy"><h2>{xh2a} <span>{xh2b}</span></h2></div></div>
    <p class="sp-lead" style="margin:-20px 0 22px">{xlead}</p>
    <div class="bvg-tiles">{tiles}</div>
    <div class="bvg-two">
      <div class="bvg-chartbox"><svg class="bvg-chart" id="bvgRatio" role="img" aria-label="{xaria}"></svg><div class="bvg-tip" id="bvgTip2"></div></div>
      <div class="bvg-wrap"><table class="bvg-table" id="bvgRatioTable">{xtable}</table></div>
    </div>
    <p class="bvg-note">{yearend} {xnote}</p>
  </section>

  <!-- 6. FAQ -->
  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{qh2a} <span>{qh2b}</span></h2></div></div>
    {faq}
  </section>

  <!-- 7. METHODOLOGY -->
  <section id="methodology" class="bvg-method">
    <div class="sec-head one"><div class="sec-copy"><h2>{mh2a} <span>{mh2b}</span></h2></div></div>
    <p>{m1}</p>
    <p>{m2}</p>
    <p>{m3}</p>
    <p class="bd-links"><a href="{assets_url}">{m_link_assets} →</a> · <a href="{data_url}">{m_link_data} →</a></p>
  </section>

  <!-- 7b. EMBED -->
  {embed}

  <!-- 8. BRIEF -->
  {brief}

  <!-- 9. RELATED -->
  <section id="related">
    <div class="sec-head one"><div class="sec-copy"><h2>{relh2a} <span>{relh2b}</span></h2></div></div>
    <div class="gcards">{rcards}</div>
    <p class="tx-fine fi-disc">{disclaimer}</p>
  </section>

  {foot}
</main>

<script type="application/json" id="bvg-i18n">{i18n}</script>
<script type="application/json" id="bvg-cfg">{cfg}</script>
'''.format(nav=nav, eyebrow=t['eyebrow'], h1=t['h1'], h1g=t['h1_grey'], lead=t['lead'], asof=asof, ccy=t['ccy_label'], noscript=t['noscript'],
           rh2a=t['returns_h2_a'], rh2b=t['returns_h2_b'], sort_hint=t['c_sort_hint'], rtable=returns_table(t, L), rnote=t['returns_note'],
           yh2a=t['yearly_h2_a'], yh2b=t['yearly_h2_b'], ytable=yearly_table(t, L), ynote=t['yearly_note'],
           gh2a=t['growth_h2_a'].replace('{amt}', amt), gh2b=t['growth_h2_b'], r1=t['c_r_1y'], r5=t['c_r_5y'], r10=t['c_r_10y'], legend=legend(t),
           legend_hint=t['c_legend_hint'], garia=esc(t['c_growth_aria'].replace('{amt}', amt)), gnote=t['growth_note'],
           xh2a=t['ratio_h2_a'], xh2b=t['ratio_h2_b'], xlead=t['ratio_lead'], tiles=tiles, xaria=esc(t['c_ratio_aria']), xtable=ratio_table(t, L),
           yearend=t['c_year_end'], xnote=t['ratio_note'], qh2a=t['faq_h2_a'], qh2b=t['faq_h2_b'], faq=faq_html,
           mh2a=t['method_h2_a'], mh2b=t['method_h2_b'], m1=t['method_p1'], m2=t['method_p2'], m3=t['method_p3'],
           assets_url=page_url('asset-returns.html'), m_link_assets=t['method_link_assets'], data_url=page_url('bitcoin-data.html'), m_link_data=t['method_link_data'],
           embed=embed_section(L, page), brief=F.brief_card(L, t, 'bvg_brief'), relh2a=t['rel_h2_a'], relh2b=t['rel_h2_b'], rcards=rcards, disclaimer=t['disclaimer'], foot=foot,
           i18n=json.dumps(strings, ensure_ascii=False).replace('</', '<\\/'), cfg=json.dumps(cfg).replace('</', '<\\/'))
    # Bitcoin Data v3 accent system (handover 2026-10-25): accent = this page's card on the hub; newer site-v2 css/js
    sc = C.scripts('/')   # css/js cache-busters: one sitewide value, set in C.finalize (speed.py)
    out += sc.replace('<script src="/site-v2.js', '<script src="/bitcoin-vs-gold.js?v=%s" defer></script>\n<script src="/site-v2.js' % JS_V, 1)
    F.check_text(out, L)
    open(shell, 'w').write(C.finalize(out, shell))
    print('%-34s %6d bytes' % (page, len(out)))


def embed_section(L, page):
    """'For journalists and sites' block with the iframe code; wording shared with the Fee Index page."""
    ft = json.load(open(os.path.join(TOOLS, 'fee-index', L + '.json')))
    code = esc('<iframe src="%s/%s" title="Bitcoin vs gold, silver and oil: returns (Virtuse)" width="100%%" height="460" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>\n'
               '<p>Source: <a href="%s%s">Virtuse, Bitcoin vs gold, silver and oil</a></p>' % (ORIGIN, EMBED, ORIGIN, page))
    return '''<section id="embed" class="qa fi-press">
    <details><summary>{sum}</summary>
      <h3>{eh}</h3>
      <p>{intro}</p>
      <pre class="fi-code">{code}</pre>
      <p class="fi-btns"><a class="tlink" href="/{embed}">{btn} →</a></p>
    </details>
  </section>'''.format(sum=ft['press_sum'], eh=ft['embed_h'], intro=ft['embed_intro'], code=code, embed=EMBED, btn=ft['btn_embed'])


def embed_rows(t):
    rows = sorted(DATA['assets'], key=lambda a: -(a['periods']['ytd']['usd'] if a['periods']['ytd']['usd'] is not None else -9))
    return ''.join('<tr%s><td class="a">%s</td>%s</tr>' % (
        ' class="btc"' if a['id'] == 'btc' else '', t['c_a_' + a['id']],
        ''.join('<td%s>%s</td>' % (tint(a['periods'][k]['usd']), pct(a['periods'][k]['usd'], 'en')) for k in EMBED_COLS)) for a in rows)


def build_embed():
    """EN table for other sites' iframes. Static numbers for no-JS readers, then the inline
    script re-renders from the live JSON (raw.githubusercontent first, the site copy as fallback)."""
    t = json.load(open(os.path.join(HERE, 'en.json')))
    cfg = {'src': [RAW, '/data/bitcoin-vs-commodities.json'], 'cols': EMBED_COLS, 'months': F.MONTHS['en'],
           'names': {a: t['c_a_' + a] for a in ASSETS}}
    utm = '?utm_source=embed&amp;utm_medium=referral&amp;utm_campaign=bitcoin_vs_gold'
    head_cells = ''.join('<th>%s</th>' % t[c] for c in ('c_col_ytd', 'c_col_1y', 'c_col_5y', 'c_col_10y'))
    out = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' https://raw.githubusercontent.com; img-src 'self'; base-uri 'none'; form-action 'none'">
<title>Bitcoin vs gold, silver and oil: returns (embed)</title>
<meta name="description" content="Embeddable Virtuse table: total return of Bitcoin, gold, silver, oil, copper, platinum and a commodities basket, year to date, 1, 5 and 10 years. Updated daily. Attribution required.">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="{origin}/{embed}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
body {{ margin: 0; background: #08090a; color: #e6edf3; font: 14px/1.5 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
.w {{ padding: 16px; }}
h1 {{ font-size: 16px; margin: 0 0 4px; }}
p {{ margin: 0 0 10px; color: #8b949e; font-size: 12px; }}
.tw {{ overflow-x: auto; margin-bottom: 10px; }}
table {{ width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: right; padding: 7px 7px; border-bottom: 1px solid rgba(255,255,255,.08); white-space: nowrap; }}
th {{ color: #8b949e; font-weight: 600; font-size: 12px; }}
th.a, td.a {{ text-align: left; white-space: normal; min-width: 90px; }}
@media (max-width: 480px) {{ body {{ font-size: 13px; }} .w {{ padding: 12px; }} th, td {{ padding: 6px 5px; }} }}
@media (max-width: 360px) {{ body {{ font-size: 12px; }} .w {{ padding: 10px; }} th, td {{ padding: 5px 3px; }} th.a, td.a {{ min-width: 72px; }} }}
tr.btc td.a {{ color: #f7931a; font-weight: 600; }}
a {{ color: #f7931a; }}
</style>
</head>
<body>
<div class="w">
  <h1>Bitcoin vs gold, silver and oil: total return</h1>
  <p>Total return in USD, distributions reinvested. <span id="asof">Data as of {date}</span>.</p>
  <div class="tw"><table><thead><tr><th class="a">{asset}</th>{head}</tr></thead><tbody id="rows">{rows}</tbody></table></div>
  <p>Source: <a href="{origin}/bitcoin-vs-gold.html{utm}" target="_blank" rel="noopener">Virtuse, Bitcoin vs gold, silver and oil</a>. Updated daily. Past performance does not guarantee future results. Not investment advice.</p>
</div>
<script>
(function () {{
  var C = {cfg};
  function pct(v) {{
    if (v == null) return '\u2013';
    var p = v * 100, d = Math.abs(p) < 100 ? 1 : 0;
    return p.toLocaleString('en-US', {{ minimumFractionDigits: d, maximumFractionDigits: d }}) + '%';
  }}
  function tint(td, v) {{
    if (v == null) return;
    var k = Math.min(Math.abs(v) / 0.4, 1), a = 0.10 + 0.32 * k;
    td.style.background = 'rgba(' + (v >= 0 ? '46,160,90' : '210,60,60') + ',' + a.toFixed(2) + ')';
    td.style.color = v >= 0 ? '#b8f0c8' : '#ffc4c4';
  }}
  function render(d) {{
    var tb = document.getElementById('rows'), rows = d.assets.slice().sort(function (x, y) {{
      var a = x.periods.ytd.usd, b = y.periods.ytd.usd;
      return (b == null ? -9 : b) - (a == null ? -9 : a);
    }});
    tb.textContent = '';
    rows.forEach(function (r) {{
      if (!C.names[r.id]) return;
      var tr = document.createElement('tr'), td = document.createElement('td');
      if (r.id === 'btc') tr.className = 'btc';
      td.className = 'a'; td.textContent = C.names[r.id]; tr.appendChild(td);
      C.cols.forEach(function (k) {{
        var c = document.createElement('td'), v = r.periods[k] ? r.periods[k].usd : null;
        c.textContent = pct(v); tint(c, v); tr.appendChild(c);
      }});
      tb.appendChild(tr);
    }});
    var p = d.asOf.split('-');
    document.getElementById('asof').textContent = 'Data as of ' + (+p[2]) + ' ' + C.months[+p[1] - 1] + ' ' + p[0];
  }}
  (function next(i) {{
    if (i >= C.src.length) return;
    fetch(C.src[i], {{ cache: 'no-cache' }}).then(function (r) {{ if (!r.ok) throw new Error(r.status); return r.json(); }})
      .then(render).catch(function () {{ next(i + 1); }});
  }})(0);
}})();
</script>
</body>
</html>
'''.format(origin=ORIGIN, embed=EMBED, date=date_str(DATA['asOf'], 'en'), asset=t['c_col_asset'], head=head_cells, rows=embed_rows(t),
           utm=utm, cfg=json.dumps(cfg).replace('</', '<\\/'))
    F.check_text(out, 'bvg embed')
    F.write(EMBED + 'index.html', out)


def sitemap():
    """One <url> per language with all 10 hreflang alternates, inside its own markers
    (before TOOLS). lastmod = last content change (git), today for uncommitted changes."""
    sys.path.insert(0, os.path.join(os.path.dirname(SITE), 'seo-ops'))
    from sitemap_lastmod import lastmod_for
    sm = os.path.join(SITE, 'sitemap.xml'); s = open(sm, encoding='utf-8').read()
    today = datetime.date.today().isoformat()
    url = lambda l: ORIGIN + ('/' if l == 'en' else '/%s/' % l) + PAGE
    old = re.search(r'<!-- BVG:START -->.*?<!-- BVG:END -->\n', s, re.S)
    prev = dict(re.findall(r'<loc>([^<]+)</loc>\n    <lastmod>([^<]+)</lastmod>', old.group(0))) if old else {}
    alts = ''.join('\n    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (l, url(l)) for l in LANGS)
    alts += '\n    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>' % url('en')
    rows = ['<!-- BVG:START -->']
    for l in LANGS:
        u = url(l)
        rows.append('  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.6</priority>%s\n  </url>' % (
            u, lastmod_for(PAGE if l == 'en' else '%s/%s' % (l, PAGE)) or prev.get(u, today), alts))
    rows.append('<!-- BVG:END -->\n')
    block = '\n'.join(rows)
    n = s[:old.start()] + block + s[old.end():] if old else s.replace('<!-- TOOLS:START -->', block + '<!-- TOOLS:START -->', 1)
    if n != s:
        open(sm, 'w', encoding='utf-8').write(n); print('updated sitemap.xml')


def main():
    langs = sys.argv[1:] or LANGS
    for L in langs:
        if os.path.exists(os.path.join(HERE, L + '.json')):
            build(L)
        else:
            print('%s: no strings yet, skipped' % L)
    if not sys.argv[1:]:
        build_embed()
    sitemap()


if __name__ == '__main__':
    main()
