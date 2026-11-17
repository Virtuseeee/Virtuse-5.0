#!/usr/bin/env python3
"""Build funds-vs-bitcoin.html (EN) and sk/fondy-vs-bitcoin.html (SK).

usage: python3 build_fvb.py            (texts: en.json / sk.json next to this file)

Data: data/funds-vs-bitcoin.json, written by funds-build/build.py (ADSS, NBS, Eurostat, CoinMetrics, ECB).
Every number on the page comes from that file. The table is rendered here, so crawlers and
no-JS readers get the same figures; /funds-vs-bitcoin.js re-renders it from the same file
and adds the filters, sorting and the chart.

Rules from the handover (2026-11-17): no grades, no ranking as the default order, no
red/green verdict colours, same metrics for Bitcoin and the funds, visible disclaimer,
n/a with a reason instead of estimates. Also maintains the sitemap block FVB:START/END.
"""
import datetime, html, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
import build_fee_index as F
C, B, SITE, ORIGIN = F.C, F.B, F.SITE, F.ORIGIN
LANGS = ['en', 'sk']
PAGES = {'en': '/funds-vs-bitcoin.html', 'sk': '/sk/fondy-vs-bitcoin.html'}
FILES = {'en': 'funds-vs-bitcoin.html', 'sk': os.path.join('sk', 'fondy-vs-bitcoin.html')}
JS_V = '1'
DATA_URL = '/data/funds-vs-bitcoin.json'
DATA = json.load(open(os.path.join(SITE, 'data', 'funds-vs-bitcoin.json')))
TYPES = ['bond_guaranteed', 'equity', 'index', 'mixed', 'innovative']
esc = html.escape

CSS = '''<style>
.page-fvb .buy-hero2 h1 .h1-grey{display:block}
.fvb-notice{max-width:860px;margin:22px auto 0;padding:12px 16px;border:1px solid var(--line-strong);border-radius:12px;background:var(--card);font-size:13px;line-height:1.6;color:var(--muted);text-align:left}
.fvb-notice b{color:var(--text);font-weight:600}
.fvb-notice a{color:var(--text)}
.fvb-asof{font-size:13px;color:var(--muted);margin-top:16px;text-align:center}
.fvb-ctrl{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;margin:0 0 14px}
.fvb-ctrl .seg{margin:0;flex-wrap:wrap}
.fvb-ctrl label{font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:8px}
.fvb-ctrl select{background:var(--card);color:var(--text);border:1px solid var(--line-strong);border-radius:8px;padding:6px 10px;font:500 13px var(--sans)}
.fvb-ctrl .fvb-reset{background:none;border:1px solid var(--line);border-radius:999px;color:var(--muted);font:500 12px var(--sans);padding:5px 12px;cursor:pointer}
.fvb-ctrl .fvb-count{font-size:12px;color:var(--muted)}
.fvb-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--card)}
.fvb-table{border-collapse:separate;border-spacing:0;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
.fvb-table th,.fvb-table td{padding:10px 12px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
.fvb-table thead th{font:600 12px var(--sans);color:var(--muted);background:var(--card);white-space:normal;min-width:84px;vertical-align:bottom}
.fvb-table thead th button{all:unset;cursor:pointer}
.fvb-table thead th button:focus-visible{outline:2px solid var(--text);outline-offset:2px}
.fvb-table thead th[aria-sort=ascending] button::after{content:" \\2191"}
.fvb-table thead th[aria-sort=descending] button::after{content:" \\2193"}
.fvb-table th.fvb-f,.fvb-table td.fvb-f{text-align:left;position:sticky;left:0;background:var(--card);z-index:1;min-width:230px;white-space:normal}
.fvb-table thead th.fvb-f{z-index:2}
.fvb-table td.fvb-f b{display:block;color:var(--text);font-weight:600;line-height:1.35}
.fvb-table td.fvb-f span{font-size:12px;color:var(--muted)}
.fvb-table td.fvb-t{text-align:left;color:var(--muted);font-size:13px;white-space:normal;min-width:110px}
.fvb-table tbody.fvb-ref td{border-bottom:2px solid var(--line-strong)}
.fvb-table tbody.fvb-ref td.fvb-f b{color:var(--btc-orange,#f7931a)}
.fvb-table tbody tr:last-child td{border-bottom:0}
.fvb-table tbody.fvb-ref tr:last-child td{border-bottom:2px solid var(--line-strong)}
.fvb-table abbr{text-decoration:underline dotted;cursor:help;color:var(--muted)}
.fvb-note{font-size:12px;color:var(--muted);margin:14px 0 0;line-height:1.6;max-width:860px}
.fvb-chartbox{position:relative;border:1px solid var(--line);border-radius:14px;background:var(--card);padding:14px 10px 8px}
.fvb-chart{display:block;width:100%;height:360px}
.fvb-chart .grid{stroke:rgba(255,255,255,.07);stroke-width:1}
.fvb-chart .ax{fill:var(--muted);font:500 11px var(--mono)}
.fvb-chart .ln{fill:none;stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
.fvb-chart .ln.fund{stroke:#8b949e;opacity:.55}
.fvb-chart .ln.fund.hi{stroke:#e6edf3;opacity:1;stroke-width:2.5}
.fvb-chart .ln.btc{stroke:#f7931a;stroke-width:2.5}
.fvb-chart .xh{stroke:rgba(255,255,255,.35);stroke-width:1;stroke-dasharray:3 3}
.fvb-tip{position:absolute;pointer-events:none;background:#1c1c1c;border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.5;color:var(--text);min-width:180px;max-width:280px;z-index:3;display:none}
.fvb-tip b{display:block;font:600 11px var(--mono);color:var(--muted);margin-bottom:4px}
.fvb-tip div{display:flex;justify-content:space-between;gap:14px}
.fvb-legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--muted);margin:0 0 10px}
.fvb-legend i{display:inline-block;width:14px;height:3px;border-radius:2px;vertical-align:middle;margin-right:6px}
.fvb-text p{color:var(--muted);font-size:15px;line-height:1.65;max-width:860px;margin:0 0 12px}
.fvb-text p b{color:var(--text);font-weight:600}
.fvb-text ul{color:var(--muted);font-size:14px;line-height:1.6;max-width:860px;padding-left:20px}
.fvb-text li{margin:0 0 6px}
.fvb-text li a{color:var(--muted)}
.fvb-legal{max-width:860px;border-left:3px solid var(--line-strong);margin:8px 0 6px;padding:4px 0 4px 16px;color:var(--text);font-size:14px;line-height:1.6}
.fvb-legal-src{font-size:12px;color:var(--muted);margin:0 0 12px}
@media (max-width:900px){.fvb-chart{height:300px}}
@media (max-width:600px){.fvb-table{font-size:13px}.fvb-table th,.fvb-table td{padding:8px 9px}.fvb-table th.fvb-f,.fvb-table td.fvb-f{min-width:150px}.fvb-table td.fvb-f span{font-size:11px}.fvb-table td.fvb-t,.fvb-table th.fvb-t{display:none}.fvb-chart{height:240px}.fvb-notice{margin:18px 0 0}}
</style>
'''


def num(v, L, d=1):
    s = '%.*f' % (d, abs(v))
    ip, _, fp = s.partition('.')
    if L == 'en':
        ip = format(int(ip), ',')
    else:
        g = ''
        while len(ip) > 3:
            g = ' ' + ip[-3:] + g; ip = ip[:-3]
        ip = ip + g
    return ('-' if v < 0 else '') + ip + (('.' if L == 'en' else ',') + fp if fp else '')


def pct(v, L, d=1):
    return num(v * 100, L, d) + (' %' if L in C.PCT_SPACE else '%')


def eur(v, L):
    s = num(v, L, 0)
    return '€' + s if L == 'en' else s + ' €'


EN_M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
SK_GEN = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra']
SK_NOM = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december']


def date_str(iso, L):
    """'6 November 2026' / '6 novembra 2026' (house rule: no dotted ordinals in Slovak)"""
    y, m, d = (int(x) for x in iso.split('-'))
    return '%d %s %d' % (d, (EN_M if L == 'en' else SK_GEN)[m - 1], y)


def month_str(ym, L):
    y, m = ym.split('-')[:2]
    return '%s %s' % ((EN_M if L == 'en' else SK_NOM)[int(m) - 1], y)


def cell(o, L, t, kind='pct'):
    if o is None or o.get('value') is None:
        reason = (o or {}).get('reason', '')
        return '<td><abbr title="%s">%s</abbr></td>' % (esc(reason), t['na'])
    v = o['value']
    return '<td>%s</td>' % pct(v, L)


def fee_cell(f, L, t):
    if f['managementFeeCap'].get('value') is None:
        return '<td><abbr title="%s">%s</abbr></td>' % (esc(f['managementFee'].get('reason', '')), t['na'])
    return '<td><abbr title="%s">%s</abbr></td>' % (esc(f['managementFee'].get('reason', '')), t['fee_cap'].replace('{v}', pct(f['managementFeeCap']['value'], L)))


def row(f, L, t, btc=False):
    name = 'Bitcoin' if btc else esc(f['name'])
    sub = t['btc_sub'] if btc else esc(f['company'])
    ty = t['type_bitcoin'] if btc else t['type_' + f['type']]
    attrs = '' if btc else ' data-id="%s" data-type="%s" data-company="%s"' % (f['id'], f['type'], esc(f['company']))
    h = '<tr%s><td class="fvb-f"><b>%s</b><span>%s</span></td><td class="fvb-t">%s</td>' % (attrs, name, sub, ty)
    for y in (1, 5, 10):
        h += cell(f['return%dy' % y], L, t)
    h += cell(f['maxDrawdown10y'], L, t) + cell(f['volatility10y'], L, t) + fee_cell(f, L, t)
    return h + '</tr>'


def table(L, t):
    cols = [('name', 'col_fund', 'fvb-f'), ('type', 'col_type', 'fvb-t'), ('r1', 'col_1y', ''), ('r5', 'col_5y', ''), ('r10', 'col_10y', ''),
            ('dd', 'col_dd', ''), ('vol', 'col_vol', ''), ('fee', 'col_fee', '')]
    h = '<thead><tr>' + ''.join('<th scope="col" class="%s" data-k="%s"><button type="button">%s</button></th>' % (c, k, t[lab]) for k, lab, c in cols) + '</tr></thead>'
    h += '<tbody class="fvb-ref">%s</tbody>' % row(DATA['bitcoin'], L, t, True)
    h += '<tbody id="fvbRows">' + ''.join(row(f, L, t) for f in DATA['funds']) + '</tbody>'
    return h


def na_list(L, t):
    """every n/a value with its reason (Slovak reasons come from the data file; EN gets a short English line)"""
    EN = {
        'managementFee': 'actual management fee from the fund statute not checked in this round; the legal cap is shown',
        'return5y': 'the fund started in 2025, ADSS does not publish a 5-year return',
        'return10y': 'the fund started in 2025, ADSS does not publish a 10-year return',
        'real5y': 'no nominal 5-year return', 'real10y': 'no nominal 10-year return',
        'maxDrawdown10y': 'the NBS unit-value series starts in August 2025, too short for 10 years',
        'volatility10y': 'the NBS unit-value series starts in August 2025, too short for 10 years',
        'btc_managementFee': 'Bitcoin is not a fund; buying, selling and storage costs depend on the provider and cannot be stated as one verified figure',
        'btc_managementFeeCap': 'Bitcoin is not a fund, there is no legal cap',
        'btc_performanceFee': 'Bitcoin is not a fund'}
    LAB = {'en': {'managementFee': 'actual management fee', 'managementFeeCap': 'legal fee cap', 'performanceFee': 'performance fee',
                  'return5y': '5-year return', 'return10y': '10-year return', 'real5y': '5-year return after inflation',
                  'real10y': '10-year return after inflation', 'maxDrawdown10y': 'largest drawdown, 10 years', 'volatility10y': 'volatility, 10 years'},
           'sk': {'managementFee': 'skutočný poplatok za správu', 'managementFeeCap': 'zákonný strop poplatku', 'performanceFee': 'poplatok za zhodnotenie',
                  'return5y': 'výnos za 5 rokov', 'return10y': 'výnos za 10 rokov', 'real5y': 'výnos po inflácii za 5 rokov',
                  'real10y': 'výnos po inflácii za 10 rokov', 'maxDrawdown10y': 'najväčší prepad za 10 rokov', 'volatility10y': 'volatilita za 10 rokov'}}
    items, fee_funds = [], []
    for f in [DATA['bitcoin']] + DATA['funds']:
        btc = f['id'] == 'btc'
        for k, v in f.items():
            if isinstance(v, dict) and v.get('status') == 'n/a':
                if k == 'managementFee' and not btc:
                    fee_funds.append(f['name']); continue
                reason = v['reason'] if L == 'sk' else EN[('btc_' if btc else '') + k]
                items.append('<li><b>%s</b>, %s: %s</li>' % ('Bitcoin' if btc else esc(f['name']), LAB[L][k], esc(reason.rstrip('.'))))
    if fee_funds:
        reason = DATA['funds'][0]['managementFee']['reason'] if L == 'sk' else EN['managementFee']
        lead = 'Všetkých %d fondov' % len(fee_funds) if L == 'sk' else 'All %d funds' % len(fee_funds)
        items.append('<li><b>%s</b>, %s: %s</li>' % (lead, LAB[L]['managementFee'], esc(reason.rstrip('.'))))
    return '<ul>%s</ul>' % ''.join(items)


def sources(L, t):
    return '<ul>%s</ul>' % ''.join('<li><a href="%s" target="_blank" rel="noopener">%s</a>, %s</li>' % (
        esc(s['url']), esc(s['label']), t['src_asof'].replace('{d}', date_str(s['asOf'], L) if len(s['asOf']) == 10 else month_str(s['asOf'], L)))
        for s in DATA['sources'])


def build(L):
    t = {k: v for k, v in json.load(open(os.path.join(TOOLS, 'bitcoin-data', L + '.json'))).items() if k.startswith('b_') or k == 'email'}
    t.update(json.load(open(os.path.join(HERE, L + '.json'))))
    assert len(t['title']) <= 60, (L, len(t['title']))
    assert 140 <= len(t['description']) <= 155, (L, len(t['description']))   # 155 = sitewide cap in F.head
    loc = '/' if L == 'en' else '/%s/' % L
    page = PAGES[L]
    shell = os.path.join(SITE, FILES[L])
    alts = [('en', PAGES['en']), ('sk', PAGES['sk']), ('x-default', PAGES['en'])]
    faq = [(t['q%d' % i], t['a%d' % i]) for i in range(1, 10) if 'q%d' % i in t]
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [
        F.crumbs_ld([(t['crumb_home'], loc), (t['crumb_data'], loc + 'bitcoin-data.html'), (t['crumb_page'], page)]),
        {'@type': 'Dataset', 'name': t['ds_name'], 'description': t['ds_desc'], 'url': ORIGIN + page,
         'dateModified': DATA['asOf'], 'temporalCoverage': '%s/%s' % (DATA['weeks'][0], DATA['asOf']),
         'variableMeasured': ['Return 1 year', 'Return 5 years per year', 'Return 10 years per year', 'Return after inflation',
                              'Largest drawdown 10 years', 'Volatility 10 years', 'Management fee cap'],
         'creator': {'@id': ORIGIN + '/#org'}, 'isAccessibleForFree': True, 'inLanguage': L,
         'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': ORIGIN + DATA_URL}]},
        F.faq_ld([(F.plain(q), F.plain(a)) for q, a in faq])]}
    out = F.head(L, t['title'], t['description'], page, alts, ld, og_alt=t['og_alt'], title_max=60)
    out = out.replace('</head>', CSS + '</head>', 1)
    nav, foot = F.chrome(L, lambda x: PAGES.get(x, '/' + 'funds-vs-bitcoin.html'), comma=False)
    nav = nav.replace('<div class="nav-group current" id="ng-services">', '<div class="nav-group" id="ng-services">')
    nav = nav.replace('<div class="nav-group" id="ng-learn">', '<div class="nav-group current" id="ng-learn">')

    def page_url(p):
        return loc + p if L == 'en' or os.path.exists(os.path.join(SITE, L, p)) else '/' + p
    faq_html = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (
        ' open' if i == 0 else '', esc(q).replace('&#x27;', "'"), esc(a).replace('&#x27;', "'")) for i, (q, a) in enumerate(faq))
    rel = [(page_url('btc-monthly-returns.html'), 'rel_monthly'), (page_url('retirement-calculator.html'), 'rel_retire'), (page_url('ma-200w.html'), 'rel_wma')]
    rcards = ''.join('<a class="gcard" href="%s"><b>%s</b><span>%s</span></a>' % (u, t[x + '_t'], esc(t[x + '_p']).replace('&#x27;', "'")) for u, x in rel)
    types = ''.join('<button type="button" class="seg-btn%s" data-type="%s" aria-pressed="%s">%s</button>' % (
        ' on' if k == 'all' else '', k, 'true' if k == 'all' else 'false', t['type_' + k]) for k in ['all'] + TYPES)
    companies = '<option value="">%s</option>' % t['company_all'] + ''.join(
        '<option>%s</option>' % esc(c) for c in sorted({f['company'] for f in DATA['funds']}))
    asof = t['asof'].replace('{d}', date_str(DATA['asOf'], L)).replace('{p}', eur(DATA['bitcoin']['price']['value'], L)).replace(
        '{m}', month_str(DATA['inflation']['lastMonth'], L))
    strings = {k: v for k, v in t.items() if k.startswith('c_') or k.startswith('type_') or k in ('na', 'ch_log', 'ch_lin', 'ch_btc')}
    cfg = {'data': DATA_URL, 'lang': L, 'locale': 'en-GB' if L == 'en' else 'sk-SK', 'pctSpace': L in C.PCT_SPACE, 'amount': 10000}
    legal = esc(DATA['legalNotice']['text'])

    out += '''<body class="page-buy page-data page-fvb no-split">
{nav}

<main class="wrap bd-v3 bd-acc-blue" id="top">

  <div class="buy-hero2 pf-hero">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <p class="sp-lead">{lead}</p>
    <p class="fvb-notice" role="note"><b>{notice}</b> <a href="#notice">{notice_more} →</a></p>
    <p class="fvb-asof">{asof}</p>
  </div>
  <noscript><p class="pf-noscript">{noscript}</p></noscript>

  <section id="table">
    <div class="sec-head one"><div class="sec-copy"><h2>{th2a} <span>{th2b}</span></h2></div></div>
    <p class="sp-lead" style="margin:-20px 0 22px">{tlead}</p>
    <div class="fvb-ctrl" id="fvbCtrl" hidden>
      <span class="seg" role="group" aria-label="{f_type}" id="fvbType">{types}</span>
      <label>{f_company} <select id="fvbCompany">{companies}</select></label>
      <span class="seg" role="group" aria-label="{f_mode}" id="fvbMode"><button type="button" class="seg-btn on" data-mode="nominal" aria-pressed="true">{mode_nominal}</button><button type="button" class="seg-btn" data-mode="real" aria-pressed="false">{mode_real}</button></span>
      <button type="button" class="fvb-reset" id="fvbReset">{sort_reset}</button>
      <span class="fvb-count" id="fvbCount" aria-live="polite"></span>
    </div>
    <div class="fvb-wrap"><table class="fvb-table" id="fvbTable">{table}</table></div>
    <p class="fvb-note">{tnote}</p>
  </section>

  <section id="chart">
    <div class="sec-head one"><div class="sec-copy"><h2>{ch2a} <span>{ch2b}</span></h2></div></div>
    <p class="sp-lead" style="margin:-20px 0 22px">{clead}</p>
    <div class="fvb-ctrl"><span class="seg" role="group" id="fvbRange"><button type="button" class="seg-btn" data-r="1" aria-pressed="false">{r1}</button><button type="button" class="seg-btn" data-r="5" aria-pressed="false">{r5}</button><button type="button" class="seg-btn on" data-r="10" aria-pressed="true">{r10}</button></span></div>
    <p class="fvb-legend"><span><i style="background:#f7931a"></i>{ch_btc}</span><span><i style="background:#8b949e"></i>{ch_funds}</span><span id="fvbScale">{ch_log}</span></p>
    <div class="fvb-chartbox"><svg class="fvb-chart" id="fvbChart" role="img" aria-label="{caria}"></svg><div class="fvb-tip" id="fvbTip"></div></div>
    <p class="fvb-note">{cnote}</p>
  </section>

  <section id="context" class="fvb-text">
    <div class="sec-head one"><div class="sec-copy"><h2>{xh2a} <span>{xh2b}</span></h2></div></div>
    <p>{x1}</p>
    <p>{x2}</p>
    <p>{x3}</p>
    <p>{x4}</p>
  </section>

  <section id="methodology" class="fvb-text">
    <div class="sec-head one"><div class="sec-copy"><h2>{mh2a} <span>{mh2b}</span></h2></div></div>
    <p>{m1}</p>
    <p>{m2}</p>
    <p>{m3}</p>
    <p>{m4}</p>
    <p>{m5}</p>
    <p>{m6}</p>
    <h3 id="na">{nah2a} {nah2b}</h3>
    <p>{nalead}</p>
    {nalist}
    <h3>{src_h}</h3>
    {sources}
    <p class="bd-links"><a href="{data_url}">{data_link} →</a></p>
  </section>

  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{qh2a} <span>{qh2b}</span></h2></div></div>
    {faq}
  </section>

  <section id="notice" class="fvb-text">
    <div class="sec-head one"><div class="sec-copy"><h2>{dh2a}</h2></div></div>
    <p>{d1}</p>
    <p>{d2}</p>
    <blockquote class="fvb-legal" lang="sk">{legal}</blockquote>
    <p class="fvb-legal-src"><a href="{legal_url}" target="_blank" rel="noopener">{legal_src}</a></p>
  </section>

  {brief}

  <section id="related">
    <div class="sec-head one"><div class="sec-copy"><h2>{relh2a} <span>{relh2b}</span></h2></div></div>
    <div class="gcards">{rcards}</div>
  </section>

  {foot}
</main>

<script type="application/json" id="fvb-i18n">{i18n}</script>
<script type="application/json" id="fvb-cfg">{cfg}</script>
'''.format(nav=nav, eyebrow=t['eyebrow'], h1=t['h1'], h1g=t['h1_grey'], lead=t['lead'], notice=t['notice'], notice_more=t['notice_more'],
           asof=asof, noscript=t['noscript'], th2a=t['tbl_h2a'], th2b=t['tbl_h2b'], tlead=t['tbl_lead'], f_type=t['f_type'], types=types,
           f_company=t['f_company'], companies=companies, f_mode=t['f_mode'], mode_nominal=t['mode_nominal'], mode_real=t['mode_real'],
           sort_reset=t['sort_reset'], table=table(L, t), tnote=esc(t['tbl_note']).replace('&#x27;', "'"),
           ch2a=t['ch_h2a'], ch2b=t['ch_h2b'], clead=t['ch_lead'], r1=t['r1'], r5=t['r5'], r10=t['r10'], ch_btc=t['ch_btc'], ch_funds=t['ch_funds'],
           ch_log=t['ch_log'], caria=esc(t['ch_aria']), cnote=t['ch_note'],
           xh2a=t['ctx_h2a'], xh2b=t['ctx_h2b'], x1=t['ctx_p1'], x2=t['ctx_p2'], x3=t['ctx_p3'], x4=t['ctx_p4'],
           mh2a=t['m_h2a'], mh2b=t['m_h2b'], m1=t['m1'], m2=t['m2'], m3=t['m3'], m4=t['m4'], m5=t['m5'], m6=t['m6'],
           nah2a=t['na_h2a'], nah2b=t['na_h2b'], nalead=t['na_lead'], nalist=na_list(L, t), src_h=t['src_h'], sources=sources(L, t),
           data_url=DATA_URL, data_link=t['data_link'], qh2a=t['faq_h2a'], qh2b=t['faq_h2b'], faq=faq_html,
           dh2a=t['disc_h2a'], d1=t['disc_p1'], d2=t['disc_p2'], legal=legal, legal_url=esc(DATA['legalNotice']['source']), legal_src=t['legal_src'],
           brief=F.brief_card(L, t, 'fvb_brief'), relh2a=t['rel_h2a'], relh2b=t['rel_h2b'], rcards=rcards, foot=foot,
           i18n=json.dumps(strings, ensure_ascii=False).replace('</', '<\\/'), cfg=json.dumps(cfg).replace('</', '<\\/'))
    sc = C.scripts('/')
    out += sc.replace('<script src="/site-v2.js', '<script src="/funds-vs-bitcoin.js?v=%s" defer></script>\n<script src="/site-v2.js' % JS_V, 1)
    F.check_text(out, L)
    open(shell, 'w').write(C.finalize(out, shell))
    print('%-34s %6d bytes' % (FILES[L], len(out)))


def sitemap():
    sys.path.insert(0, os.path.join(os.path.dirname(SITE), 'seo-ops'))
    from sitemap_lastmod import lastmod_for
    sm = os.path.join(SITE, 'sitemap.xml'); s = open(sm, encoding='utf-8').read()
    today = datetime.date.today().isoformat()
    old = re.search(r'<!-- FVB:START -->.*?<!-- FVB:END -->\n', s, re.S)
    prev = dict(re.findall(r'<loc>([^<]+)</loc>\n    <lastmod>([^<]+)</lastmod>', old.group(0))) if old else {}
    alts = ''.join('\n    <xhtml:link rel="alternate" hreflang="%s" href="%s%s"/>' % (l, ORIGIN, PAGES[l]) for l in LANGS)
    alts += '\n    <xhtml:link rel="alternate" hreflang="x-default" href="%s%s"/>' % (ORIGIN, PAGES['en'])
    rows = ['<!-- FVB:START -->']
    for l in LANGS:
        u = ORIGIN + PAGES[l]
        rows.append('  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>%s\n  </url>' % (
            u, lastmod_for(FILES[l]) or prev.get(u, today), alts))
    rows.append('<!-- FVB:END -->\n')
    block = '\n'.join(rows)
    n = s[:old.start()] + block + s[old.end():] if old else s.replace('<!-- BVG:START -->', block + '<!-- BVG:START -->', 1)
    if n != s:
        open(sm, 'w', encoding='utf-8').write(n); print('updated sitemap.xml')


def main():
    for L in sys.argv[1:] or LANGS:
        build(L)
    sitemap()


if __name__ == '__main__':
    main()
