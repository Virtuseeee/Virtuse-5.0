#!/usr/bin/env python3
"""Build funds-vs-bitcoin.html (EN) and sk/fondy-vs-bitcoin.html (SK).

usage: python3 build_fvb.py            (texts: en.json / sk.json next to this file)

Data: data/funds-vs-bitcoin.json, written by funds-build/build.py. Every number on the page
comes from that file. This script renders the default view (second pillar, 10 years, EUR 10,000)
and the full tables, so crawlers and no-JS readers get the same figures; /funds-vs-bitcoin.js
re-renders from the same file and adds the steps, slider, chart, cards, search and sorting.

Redesign 2026-11-18 (handover HANDOVER-claude-fondy-vs-bitcoin-redesign-2026-11-18.md):
question hero, three steps, cards before the table, chart higher with an amount slider,
property cards, cost comparison. Still a comparison of public figures: no grades, no ranking
as the default order, no verdict colours, visible disclaimer, missing values in words with a
reason (never estimated). Also maintains the sitemap block FVB:START/END.
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
FEE_INDEX = {'en': '/bitcoin-fee-index/', 'sk': '/sk/bitcoin-index-poplatkov/'}
JS_V = '8'
DATA_URL = '/data/funds-vs-bitcoin.json'
DATA = json.load(open(os.path.join(SITE, 'data', 'funds-vs-bitcoin.json')))
P2 = DATA['investmentFunds']
GROUPS = {
    'pillar': DATA['funds'],
    'fund': [f for f in P2['funds'] if not f['type'].startswith('etf')],
    'etf': [f for f in P2['funds'] if f['type'].startswith('etf')],
}
TYPE_ORDER = {'pillar': ['bond_guaranteed', 'equity', 'index', 'mixed', 'innovative'],
              'fund': ['equity', 'mixed', 'bond', 'real-estate'], 'etf': ['etf-equity', 'etf-bond']}
USD_ONLY = 'Emitent zverejňuje výnos tohto ETF len v amerických dolároch'
NO_TABLE = 'Správa emitenta tabuľku výkonnosti neobsahuje'
esc = html.escape

CSS = '''<style>
.page-fvb .wrap{overflow-x:clip}
.fvb-hero{text-align:center;padding-top:8px}
.fvb-hero h1{font-size:clamp(44px,9vw,104px);line-height:.98;letter-spacing:-.035em;margin:10px 0 14px}
.fvb-hero h1 .h1-grey{display:block;font-size:clamp(20px,3.2vw,32px);letter-spacing:-.01em;line-height:1.25;margin-top:16px}
.fvb-hero .sp-lead{max-width:720px;margin-left:auto;margin-right:auto}
.fvb-nums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-width:900px;margin:28px auto 0}
.fvb-num{border:1px solid var(--line);border-radius:18px;background:var(--card);padding:18px 16px;text-align:left;min-height:132px}
.fvb-num .k{font:600 12px var(--sans);color:var(--muted);text-transform:none}
.fvb-num .v{display:block;font:700 clamp(28px,4.2vw,44px)/1.05 var(--sans);letter-spacing:-.02em;margin:8px 0 6px;font-variant-numeric:tabular-nums;color:var(--text)}
.fvb-num.btc .v{color:var(--btc-orange,#f7931a)}
.fvb-num .v.rng{font-size:clamp(20px,2.1vw,26px);line-height:1.2;margin-top:14px}
.fvb-ends{min-height:118px}
.fvb-end .k,.fvb-fee .k,.fvb-num .k{font:600 12px var(--sans);letter-spacing:0;text-transform:none;color:var(--muted)}
.fvb-num .s{font-size:12px;color:var(--muted);line-height:1.45}
.fvb-notice{max-width:860px;margin:20px auto 0;padding:12px 16px;border:1px solid var(--line-strong);border-radius:12px;background:var(--card);font-size:13px;line-height:1.6;color:var(--muted);text-align:left}
.fvb-notice b{color:var(--text);font-weight:600}
.fvb-notice a{color:var(--text)}
.fvb-asof{font-size:13px;color:var(--muted);margin:14px auto 0;max-width:760px;line-height:1.55}
.fvb-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.fvb-step{border:1px solid var(--line);border-radius:18px;background:var(--card);padding:16px}
.fvb-step h3{font:600 13px var(--sans);color:var(--muted);margin:0 0 12px;display:flex;align-items:center;gap:8px}
.fvb-step h3 i{font-style:normal;display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;border:1px solid var(--line-strong);color:var(--text);font-size:12px}
.fvb-chips{display:flex;flex-wrap:wrap;gap:8px}
.fvb-chip{appearance:none;border:1px solid var(--line-strong);background:transparent;color:var(--text);border-radius:999px;padding:8px 14px;font:500 14px var(--sans);cursor:pointer;display:inline-flex;align-items:center;gap:8px;min-height:40px}
.fvb-chip small{font:600 11px var(--mono);color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:1px 7px}
.fvb-chip[aria-pressed=true]{background:var(--text);color:var(--bg,#08090a);border-color:var(--text)}
.fvb-chip[aria-pressed=true] small{color:inherit;border-color:currentColor;opacity:.75}
.fvb-chip:focus-visible,.fvb-tog:focus-visible{outline:2px solid var(--text);outline-offset:2px}
.fvb-amt{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:2px 0 8px}
.fvb-amt output{font:700 26px var(--sans);font-variant-numeric:tabular-nums;color:var(--text)}
.fvb-amt span{font-size:12px;color:var(--muted)}
.fvb-range{width:100%;accent-color:#f7931a;height:28px}
.fvb-tog{appearance:none;border:1px solid var(--line-strong);background:transparent;color:var(--muted);border-radius:999px;padding:6px 12px;font:500 13px var(--sans);cursor:pointer;min-height:34px}
.fvb-tog[aria-pressed=true]{color:var(--text);border-color:var(--text)}
.fvb-togs{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.fvb-date{margin:14px 0 0;font-size:13px;line-height:1.55;color:var(--muted);border-left:3px solid var(--line-strong);padding:2px 0 2px 12px}
.fvb-date b{color:var(--text);font-weight:600}
.fvb-chartbox{position:relative;border:1px solid var(--line);border-radius:18px;background:var(--card);padding:14px 10px 8px}
.fvb-chart{display:block;width:100%;height:380px}
.fvb-chart .grid{stroke:rgba(255,255,255,.07);stroke-width:1}
.fvb-chart .ax{fill:var(--muted);font:500 11px var(--mono)}
.fvb-chart .ln{fill:none;stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
.fvb-chart .ln.fund{stroke:#8b949e;opacity:.55}
.fvb-chart .ln.fund.hi{stroke:#e6edf3;opacity:1;stroke-width:2.5}
.fvb-chart .ln.btc{stroke:#f7931a;stroke-width:2.5}
.fvb-chart .ln.inv{stroke:#e6edf3;stroke-dasharray:4 4;opacity:.6}
.fvb-chart .xh{stroke:rgba(255,255,255,.35);stroke-width:1;stroke-dasharray:3 3}
.fvb-chart .bar{fill:#8b949e;opacity:.6}
.fvb-chart .bar.btc{fill:#f7931a;opacity:1}
.fvb-chart .bl{fill:var(--text);font:500 12px var(--sans)}
.fvb-chart .bv{fill:var(--muted);font:600 11px var(--mono)}
.fvb-tip{position:absolute;pointer-events:none;background:#1c1c1c;border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.5;color:var(--text);min-width:180px;max-width:280px;z-index:3;display:none}
.fvb-tip b{display:block;font:600 11px var(--mono);color:var(--muted);margin-bottom:4px}
.fvb-tip div{display:flex;justify-content:space-between;gap:14px}
.fvb-legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--muted);margin:0 0 10px}
.fvb-legend i{display:inline-block;width:14px;height:3px;border-radius:2px;vertical-align:middle;margin-right:6px}
.fvb-ends{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
.fvb-end{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:var(--card)}
.fvb-end .k{font-size:12px;color:var(--muted)}
.fvb-end .v{display:block;font:700 30px/1.1 var(--sans);font-variant-numeric:tabular-nums;margin-top:6px;color:var(--text)}
.fvb-end.btc .v{color:var(--btc-orange,#f7931a)}
.fvb-end .s{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.45}
.fvb-ctrl{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:0 0 14px}
.fvb-ctrl input[type=search]{flex:1 1 220px;min-width:0;background:var(--card);color:var(--text);border:1px solid var(--line-strong);border-radius:999px;padding:10px 16px;font:500 14px var(--sans)}
.fvb-ctrl select{background:var(--card);color:var(--text);border:1px solid var(--line-strong);border-radius:999px;padding:9px 12px;font:500 13px var(--sans);max-width:100%}
.fvb-count{font-size:12px;color:var(--muted)}
.fvb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.fvb-card{border:1px solid var(--line);border-radius:18px;background:var(--card);padding:16px;display:flex;flex-direction:column;gap:10px;min-width:0}
.fvb-card.btc{border-color:rgba(247,147,26,.45)}
.fvb-card h3{font:600 16px/1.3 var(--sans);margin:0;color:var(--text);overflow-wrap:anywhere}
.fvb-card.btc h3{color:var(--btc-orange,#f7931a)}
.fvb-card .m{font-size:12px;color:var(--muted);margin:3px 0 0;overflow-wrap:anywhere}
.fvb-card .r{font:700 32px/1 var(--sans);font-variant-numeric:tabular-nums;color:var(--text)}
.fvb-card .r small{display:block;font:500 12px var(--sans);color:var(--muted);margin-top:6px}
.fvb-card .r.miss{font:500 14px/1.45 var(--sans);color:var(--muted)}
.fvb-card dl{margin:0;display:grid;gap:6px;font-size:13px}
.fvb-card dl div{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:6px}
.fvb-card dt{color:var(--muted)}
.fvb-card dd{margin:0;text-align:right;color:var(--text);font-variant-numeric:tabular-nums}
.fvb-card .src{font-size:12px;color:var(--muted);margin:auto 0 0;line-height:1.5}
.fvb-card .src a{color:var(--text)}
.fvb-empty{color:var(--muted);font-size:14px;padding:16px 0}
.fvb-props{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.fvb-prop{border:1px solid var(--line);border-radius:18px;background:var(--card);padding:16px}
.fvb-prop h3{font:600 17px/1.3 var(--sans);margin:0 0 10px}
.fvb-prop dl{margin:0;display:grid;gap:8px;font-size:13px;line-height:1.5}
.fvb-prop dt{color:var(--muted);font-weight:600;font-size:12px}
.fvb-prop dd{margin:0;color:var(--text)}
.fvb-prop dd.btc{color:var(--text)}
.fvb-fees{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.fvb-fee{border:1px solid var(--line);border-radius:18px;background:var(--card);padding:16px}
.fvb-fee .k{font-size:12px;color:var(--muted);font-weight:600}
.fvb-fee .v{display:block;font:700 26px/1.15 var(--sans);margin:8px 0;color:var(--text);font-variant-numeric:tabular-nums}
.fvb-fee p{font-size:13px;line-height:1.55;color:var(--muted);margin:0}
.fvb-fee a{color:var(--text)}
.fvb-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--card);-webkit-overflow-scrolling:touch}
.fvb-table{border-collapse:separate;border-spacing:0;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
.fvb-table caption{text-align:left;font:600 15px var(--sans);color:var(--text);padding:14px 12px 4px}
.fvb-table th,.fvb-table td{padding:10px 12px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
.fvb-table thead th{font:600 12px var(--sans);color:var(--muted);background:var(--card);white-space:normal;min-width:84px;vertical-align:bottom}
.fvb-table thead th button{all:unset;cursor:pointer}
.fvb-table thead th button:focus-visible{outline:2px solid var(--text);outline-offset:2px}
.fvb-table thead th[aria-sort=ascending] button::after{content:" \\2191"}
.fvb-table thead th[aria-sort=descending] button::after{content:" \\2193"}
.fvb-table th.fvb-f,.fvb-table td.fvb-f{text-align:left;position:sticky;left:0;background:var(--card);z-index:1;min-width:220px;white-space:normal}
.fvb-table thead th.fvb-f{z-index:2}
.fvb-table td.fvb-f b{display:block;color:var(--text);font-weight:600;line-height:1.35}
.fvb-table td.fvb-f span{font-size:12px;color:var(--muted)}
.fvb-table td.fvb-t{text-align:left;color:var(--muted);font-size:13px;white-space:normal;min-width:110px}
.fvb-table td.fvb-x{text-align:center;color:var(--muted);font-size:13px;white-space:normal}
.fvb-table td .miss{color:var(--muted);font-size:12px;text-decoration:underline dotted;cursor:help}
.fvb-table tbody.fvb-ref td{border-bottom:2px solid var(--line-strong)}
.fvb-table tbody.fvb-ref td.fvb-f b{color:var(--btc-orange,#f7931a)}
.fvb-table tbody tr:last-child td{border-bottom:0}
.fvb-table tbody.fvb-ref tr:last-child td{border-bottom:2px solid var(--line-strong)}
.fvb-table td.fvb-d{text-align:left;font-size:13px}
.fvb-table td.fvb-d a{color:var(--text)}
.fvb-table td.fvb-d span{display:block;font-size:11px;color:var(--muted)}
.fvb-note{font-size:12px;color:var(--muted);margin:12px 0 0;line-height:1.6;max-width:860px}
.fvb-sub{margin:30px 0 10px;font:600 18px var(--sans)}
.fvb-text p{color:var(--muted);font-size:15px;line-height:1.65;max-width:860px;margin:0 0 12px}
.fvb-text p b{color:var(--text);font-weight:600}
.fvb-text ul{color:var(--muted);font-size:14px;line-height:1.6;max-width:860px;padding-left:20px}
.fvb-text li{margin:0 0 6px}
.fvb-text li a{color:var(--muted)}
.fvb-legal{max-width:860px;border-left:3px solid var(--line-strong);margin:8px 0 6px;padding:4px 0 4px 16px;color:var(--text);font-size:14px;line-height:1.6}
.fvb-legal-src{font-size:12px;color:var(--muted);margin:0 0 12px}
.page-fvb .vb-cc.fvb-cc-flow{position:relative;left:auto;right:auto;bottom:auto;top:auto;width:auto;max-width:760px;max-height:none;margin:12px auto 18px;z-index:5;box-shadow:none}
@media (max-width:900px){.fvb-steps{grid-template-columns:1fr}.fvb-chart{height:320px}}
@media (max-width:640px){.fvb-nums{grid-template-columns:1fr;gap:8px}.fvb-num{min-height:0;padding:14px}.fvb-ends{grid-template-columns:1fr}
.fvb-table{font-size:13px}.fvb-table th,.fvb-table td{padding:8px 9px}.fvb-table th.fvb-f,.fvb-table td.fvb-f{min-width:150px}.fvb-table td.fvb-f span{font-size:11px}
.fvb-table td.fvb-t,.fvb-table th.fvb-t{display:none}.fvb-chart{height:260px}.fvb-notice{margin:16px 0 0}.fvb-cards{grid-template-columns:1fr}}
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
    neg = v < 0 and float(s) != 0
    return ('−' if neg else '') + ip + (('.' if L == 'en' else ',') + fp if fp else '')


def pct(v, L, d=1):
    return num(v * 100, L, d) + (' %' if L in C.PCT_SPACE else '%')


def eur(v, L):
    s = num(v, L, 0)
    return '€' + s if L == 'en' else s + ' €'


EN_M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
SK_GEN = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra']
SK_NOM = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december']


def date_str(iso, L):
    """'6 November 2026' / '6 novembra 2026' (house rule: no dotted ordinals)"""
    y, m, d = (int(x) for x in iso.split('-'))
    return '%d %s %d' % (d, (EN_M if L == 'en' else SK_GEN)[m - 1], y)


def month_str(ym, L):
    y, m = ym.split('-')[:2]
    return '%s %s' % ((EN_M if L == 'en' else SK_NOM)[int(m) - 1], y)


def reason(o, L):
    o = o or {}
    return o.get('reasonEn', '') if L == 'en' else o.get('reason', '')


def miss(o, L, t):
    return '<span class="miss" title="%s">%s</span>' % (esc(reason(o, L)), t['miss'])


def cell(o, L, t, d=1):
    if o is None or o.get('value') is None:
        return '<td>%s</td>' % miss(o, L, t)
    return '<td>%s</td>' % pct(o['value'], L, d)


def usd_only(f):
    r = (f.get('return1y') or {}).get('reason', '')
    return f.get('return1y', {}).get('value') is None and (r.startswith(USD_ONLY) or r.startswith(NO_TABLE))


def ref_date(fs):
    ds = [f['asOf'] for f in fs]
    return max(set(ds), key=lambda d: (ds.count(d), d))


def btc_for(g):
    """Bitcoin object for a group: phase 1 on the ADSS date, phase 2 on the group's most common report date"""
    if g == 'pillar':
        return DATA['bitcoin'], DATA['asOf']
    d = ref_date(GROUPS[g])
    return P2['bitcoin'][d], d


def infl_for(g, y):
    """inflation p.a. for the window: phase 1 from the data file; phase 2 implied by Bitcoin's nominal and real return
    on the same window ((1+nom)/(1+real) - 1, both official-source figures in the data file)"""
    if g == 'pillar':
        return DATA['inflation']['pa']['%dy' % y]['value']
    b, _ = btc_for(g)
    return (1 + b['return%dy' % y]['value']) / (1 + b['real%dy' % y]['value']) - 1


def type_label(f, t):
    return t['type_' + f['type'].replace('-', '_')]


def fee_line(f, g, L, t):
    if g == 'pillar':
        mf = f['managementFee']
        if mf.get('value') is not None:
            return t['fee_statute_line'].replace('{v}', '<a href="%s" target="_blank" rel="noopener">%s</a>' % (esc(mf['source']), pct(mf['value'], L)))
        return t['fee_cap_line'].replace('{v}', pct(f['managementFeeCap']['value'], L))
    oc, en = f['ongoingCosts'], f['entryCostMax']
    s = t['fee_oc_line'].replace('{v}', pct(oc['value'], L, 2)) if oc.get('value') is not None else t['miss']
    if en.get('value') is not None:
        s += ', ' + t['fee_entry_line'].replace('{v}', pct(en['value'], L, 2))
    return s


def card(f, g, L, t, y=10):
    """one fund card for the default view (JS renders the same markup)"""
    o = f['return%dy' % y]
    if o.get('value') is not None:
        r = '<p class="r">%s<small>%s</small></p>' % (pct(o['value'], L), t['ret_lab_%d' % y])
    elif usd_only(f):
        r = '<p class="r miss" title="%s">%s</p>' % (esc(reason(o, L)), t['usd_only'])
    else:
        r = '<p class="r miss">%s</p>' % esc(t['card_miss'].replace('{y}', t['hz%d' % y]) + ' ' + reason(o, L))
    dl = ''
    if f.get('maxDrawdown10y', {}).get('value') is not None:
        dl += '<div><dt>%s</dt><dd>%s</dd></div>' % (t['card_dd'], pct(f['maxDrawdown10y']['value'], L))
    dl += '<div><dt>%s</dt><dd>%s</dd></div>' % (t['card_fee'], fee_line(f, g, L, t))
    if g == 'pillar':
        src = '<a href="%s" target="_blank" rel="noopener">%s</a> · %s' % (esc(f['unitValue']['source']), t['src_adss'], t['asof_short'].replace('{d}', date_str(DATA['asOf'], L)))
    else:
        src = '<a href="%s" target="_blank" rel="noopener">%s</a> · <a href="%s" target="_blank" rel="noopener">%s</a> · %s' % (
            esc(f['kidUrl']), t['src_kid'], esc(f['factsheetUrl']), t['src_report'], t['asof_short'].replace('{d}', date_str(f['asOf'], L)))
    return '<article class="fvb-card" data-id="%s"><header><h3>%s</h3><p class="m">%s · %s</p></header>%s<dl>%s</dl><p class="src">%s</p></article>' % (
        esc(f['id']), esc(f['name']), esc(f['company']), type_label(f, t), r, dl, src)


def btc_card(g, L, t, y=10):
    b, d = btc_for(g)
    o = b['return%dy' % y]
    dl = ''
    if g == 'pillar':
        dl += '<div><dt>%s</dt><dd>%s</dd></div>' % (t['card_dd'], pct(b['maxDrawdown10y']['value'], L))
    dl += '<div><dt>%s</dt><dd>%s</dd></div>' % (t['card_fee'], t['btc_fee'])
    return ('<article class="fvb-card btc"><header><h3>Bitcoin</h3><p class="m">%s</p></header><p class="r">%s<small>%s</small></p><dl>%s</dl>'
            '<p class="src"><a href="%s" target="_blank" rel="noopener">CoinMetrics</a> · %s</p></article>') % (
        t['btc_ref'], pct(o['value'], L), t['ret_lab_%d' % y], dl, esc(b['price']['source']), t['asof_short'].replace('{d}', date_str(d, L)))


def nums(g, L, t, y=10):
    b, d = btc_for(g)
    vs = [f['return%dy' % y]['value'] for f in GROUPS[g] if f['return%dy' % y].get('value') is not None]
    rng = t['range'].replace('{a}', pct(min(vs), L)).replace('{b}', pct(max(vs), L)) if vs else t['miss']
    return ('<div class="fvb-num btc"><span class="k">%s</span><span class="v" id="fvbNumB">%s</span><span class="s" id="fvbNumBs">%s</span></div>'
            '<div class="fvb-num"><span class="k" id="fvbNumGk">%s</span><span class="v rng" id="fvbNumG">%s</span><span class="s" id="fvbNumGs">%s</span></div>'
            '<div class="fvb-num"><span class="k">%s</span><span class="v" id="fvbNumI">%s</span><span class="s" id="fvbNumIs">%s</span></div>') % (
        t['num_btc'], pct(b['return%dy' % y]['value'], L), t['ret_lab_%d' % y] + ', ' + t['asof_short'].replace('{d}', date_str(d, L)),
        t['num_grp_pillar'], rng, t['num_grp_s'].replace('{n}', str(len(vs))).replace('{t}', str(len(GROUPS[g]))) + ' ' + t['ret_lab_%d' % y],
        t['num_infl'], pct(infl_for(g, y), L), t['num_infl_s_%d' % y])


def date_line(g, L, t):
    b, d = btc_for(g)
    if g == 'pillar':
        return t['date_pillar'].replace('{d}', date_str(d, L)).replace('{p}', eur(b['price']['value'], L))
    return t['date_p2'].replace('{d}', date_str(d, L)).replace('{p}', eur(b['price']['value'], L))


# ---------------- full tables ("all numbers") ----------------
def t1_row(f, L, t, btc=False):
    name = 'Bitcoin' if btc else esc(f['name'])
    sub = t['btc_ref'] if btc else esc(f['company'])
    ty = t['type_bitcoin'] if btc else type_label(f, t)
    h = '<tr%s><td class="fvb-f"><b>%s</b><span>%s</span></td><td class="fvb-t">%s</td>' % (
        '' if btc else ' data-id="%s"' % f['id'], name, sub, ty)
    for y in (1, 5, 10):
        h += cell(f['return%dy' % y], L, t)
    h += cell(f['maxDrawdown10y'], L, t) + cell(f['volatility10y'], L, t)
    if btc:
        h += '<td>%s</td>' % t['btc_fee_short']
    elif f['managementFee'].get('value') is not None:
        h += '<td><a href="%s" target="_blank" rel="noopener" title="%s">%s</a></td>' % (
            esc(f['managementFee']['source']), esc(f['managementFee']['sourceLabelEn' if L == 'en' else 'sourceLabel']), pct(f['managementFee']['value'], L))
    else:
        h += cell(f['managementFee'], L, t)
    return h + '</tr>'


T1_COLS = [('name', 'col_fund', 'fvb-f'), ('type', 'col_type', 'fvb-t'), ('r1', 'col_1y', ''), ('r5', 'col_5y', ''), ('r10', 'col_10y', ''),
           ('dd', 'col_dd', ''), ('vol', 'col_vol', ''), ('fee', 'col_fee', '')]
T2_COLS = [('name', 'col_fund', 'fvb-f'), ('type', 'col_type', 'fvb-t'), ('r1', 'col_1y', ''), ('r5', 'col_5y', ''), ('r10', 'col_10y', ''),
           ('oc', 'col_oc', ''), ('entry', 'col_entry', ''), ('exit', 'col_exit', ''), ('docs', 'col_docs', 'fvb-d')]


def thead(cols, t):
    return '<thead><tr>' + ''.join(
        ('<th scope="col" class="%s" data-k="%s"><button type="button">%s</button></th>' if k != 'docs' else '<th scope="col" class="%s" data-k="%s">%s</th>') % (c, k, t[lab])
        for k, lab, c in cols) + '</tr></thead>'


def table1(L, t):
    h = '<caption>%s</caption>' % t['t1_cap'].replace('{d}', date_str(DATA['asOf'], L))
    h += thead(T1_COLS, t)
    h += '<tbody class="fvb-ref">%s</tbody>' % t1_row(DATA['bitcoin'], L, t, True)
    return h + '<tbody id="fvbT1Rows">' + ''.join(t1_row(f, L, t) for f in DATA['funds']) + '</tbody>'


def t2_row(f, L, t, btc=None):
    if btc:
        b, d = btc
        h = '<tr><td class="fvb-f"><b>Bitcoin</b><span>%s</span></td><td class="fvb-t">%s</td>' % (
            t['btc_ref'] + ', ' + t['asof_short'].replace('{d}', date_str(d, L)), t['type_bitcoin'])
        for y in (1, 5, 10):
            h += cell(b['return%dy' % y], L, t)
        nb = '<td class="fvb-x">%s</td>' % t['btc_fee_short']
        return h + nb * 3 + '<td class="fvb-d"><a href="%s" target="_blank" rel="noopener">CoinMetrics</a></td></tr>' % esc(b['price']['source'])
    h = '<tr data-id="%s"><td class="fvb-f"><b>%s</b><span>%s · %s</span></td><td class="fvb-t">%s</td>' % (
        f['id'], esc(f['name']), esc(f['company']), f['isin'], type_label(f, t))
    if usd_only(f):
        h += '<td class="fvb-x" colspan="3" title="%s">%s</td>' % (esc(reason(f['return1y'], L)), t['usd_only'])
    else:
        for y in (1, 5, 10):
            h += cell(f['return%dy' % y], L, t)
    h += cell(f['ongoingCosts'], L, t, 2) + cell(f['entryCostMax'], L, t, 2) + cell(f['exitCost'], L, t, 2)
    h += '<td class="fvb-d"><a href="%s" target="_blank" rel="noopener">%s</a> · <a href="%s" target="_blank" rel="noopener">%s</a><span>%s</span></td>' % (
        esc(f['kidUrl']), t['src_kid'], esc(f['factsheetUrl']), t['src_report'], t['asof_short'].replace('{d}', date_str(f['asOf'], L)))
    return h + '</tr>'


def table2(L, t):
    h = '<caption>%s</caption>' % t['t2_cap']
    h += thead(T2_COLS, t)
    h += '<tbody class="fvb-ref">%s</tbody>' % t2_row(None, L, t, btc=btc_for('fund'))
    return h + '<tbody id="fvbT2Rows">' + ''.join(t2_row(f, L, t) for f in P2['funds']) + '</tbody>'


# ---------------- property and fee cards ----------------
def props(L, t):
    dd = [f['maxDrawdown10y']['value'] for f in DATA['funds'] if f['maxDrawdown10y'].get('value') is not None]
    rows = []
    for k in ('guar', 'access', 'tax', 'super', 'dd'):
        cells = []
        for who in ('pillar', 'p2', 'btc'):
            v = t['prop_%s_%s' % (k, who)]
            v = v.replace('{a}', pct(max(dd), L)).replace('{b}', pct(min(dd), L)).replace('{btc}', pct(DATA['bitcoin']['maxDrawdown10y']['value'], L))
            cells.append('<dt>%s</dt><dd>%s</dd>' % (t['who_' + who], v))
        rows.append('<article class="fvb-prop"><h3>%s</h3><dl>%s</dl></article>' % (t['prop_' + k], ''.join(cells)))
    return ''.join(rows)


def fee_pillar_v(L, t):
    v = sorted({f['managementFee']['value'] for f in DATA['funds'] if f['managementFee'].get('value') is not None})
    if not v:
        return t['fee_pillar_v'].replace('{v}', pct(0.004, L))
    s = pct(v[0], L) if len(v) == 1 else t['range'].replace('{a}', pct(v[0], L)).replace('{b}', pct(v[-1], L))
    return t['fee_pillar_v2'].replace('{v}', s)


def fees(L, t):
    def rng(fs, k, d=2):
        v = [f[k]['value'] for f in fs if f[k].get('value') is not None]
        return t['range'].replace('{a}', pct(min(v), L, d)).replace('{b}', pct(max(v), L, d))
    law = [s for s in DATA['sources'] if s.get('id') == 'law'][0]['url']
    cards = [
        (t['fee_pillar_k'], fee_pillar_v(L, t), t['fee_pillar_p'].replace('{law}', esc(law)).replace('{n}', str(sum(1 for f in DATA['funds'] if f['managementFee'].get('value') is not None))).replace('{t}', str(len(DATA['funds'])))),
        (t['fee_fund_k'], rng(GROUPS['fund'], 'ongoingCosts'), t['fee_fund_p'].replace('{e}', rng(GROUPS['fund'], 'entryCostMax'))),
        (t['fee_etf_k'], rng(GROUPS['etf'], 'ongoingCosts'), t['fee_etf_p']),
        (t['fee_btc_k'], t['btc_fee'], t['fee_btc_p'].replace('{href}', FEE_INDEX[L])),
    ]
    return ''.join('<article class="fvb-fee"><span class="k">%s</span><span class="v">%s</span><p>%s</p></article>' % c for c in cards)


# ---------------- missing values, sources ----------------
def na_list(L, t):
    LAB = {k[4:]: v for k, v in t.items() if k.startswith('lab_')}
    items = []
    for f in [DATA['bitcoin']] + DATA['funds']:
        btc = f['id'] == 'btc'
        for k, v in f.items():
            if isinstance(v, dict) and v.get('status') == 'n/a' and k != 'managementFee' or (btc and k == 'managementFee'):
                items.append('<li><b>%s</b>, %s: %s</li>' % ('Bitcoin' if btc else esc(f['name']), LAB[k], esc(reason(v, L).rstrip('.'))))
    nf = [f for f in DATA['funds'] if f['managementFee'].get('value') is None]
    for f in nf:
        items.append('<li><b>%s</b>, %s: %s</li>' % (esc(f['name']), LAB['managementFee'], esc(reason(f['managementFee'], L).rstrip('.'))))
    groups = {}
    for f in P2['funds']:
        for k in ('return1y', 'return5y', 'return10y', 'performanceFee'):
            o = f[k]
            if o.get('status') == 'n/a':
                r = reason(o, L)
                r = re.sub(r'(started on|vznikol) \d+ \S+ \d{4}', r'\1 ' + ('later' if L == 'en' else 'neskôr'), r)
                groups.setdefault((r, LAB[k]), []).append(f['id'])
    merged = {}
    for (r, lab), ids in groups.items():
        merged.setdefault((r, tuple(ids)), []).append(lab)
    for (r, ids), labs in merged.items():
        names = ', '.join(esc(f['name']) for f in P2['funds'] if f['id'] in ids)
        items.append('<li><b>%s</b>, %s: %s</li>' % (names, ', '.join(labs), esc(r.rstrip('.'))))
    items.append('<li><b>%s</b>, %s: %s</li>' % (t['na_allp2'].replace('{n}', str(len(P2['funds']))), t['lab_dd_vol'],
                                                 esc(reason(P2['funds'][0]['maxDrawdown10y'], L).rstrip('.'))))
    return '<ul>%s</ul>' % ''.join(items)


def sources(L, t):
    out = []
    for s in DATA['sources']:
        lab = s.get('labelEn') if L == 'en' else s['label']
        when = date_str(s['asOf'], L) if len(s['asOf']) == 10 else month_str(s['asOf'], L)
        if s['url'].startswith('#'):
            out.append('<li><a href="#all">%s</a>, %s</li>' % (esc(lab), t['src_asof'].replace('{d}', when)))
        else:
            out.append('<li><a href="%s" target="_blank" rel="noopener">%s</a>, %s</li>' % (esc(s['url']), esc(lab), t['src_asof'].replace('{d}', when)))
    return '<ul>%s</ul>' % ''.join(out)


def only_langs(seg):
    """keep only the languages this page exists in (handover 4.3: the other entries pointed at the English page)"""
    return re.sub(r'<a [^>]*hreflang="(?!en"|sk")[a-z]{2}"[^>]*>.*?</a>', '', seg, flags=re.S)


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
                              'Largest drawdown 10 years', 'Volatility 10 years', 'Management fee legal cap',
                              'Ongoing costs per year (key information document)', 'Entry charge maximum', 'Exit charge'],
         'creator': {'@id': ORIGIN + '/#org'}, 'isAccessibleForFree': True, 'inLanguage': L,
         'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': ORIGIN + DATA_URL}]},
        F.faq_ld([(F.plain(q), F.plain(a)) for q, a in faq])]}
    out = F.head(L, t['title'], t['description'], page, alts, ld, og_alt=t['og_alt'], title_max=60)
    out = out.replace('</head>', CSS + '</head>', 1)
    nav, foot = F.chrome(L, lambda x: PAGES.get(x, PAGES['en']), comma=False)
    nav = nav.replace('<div class="nav-group current" id="ng-services">', '<div class="nav-group" id="ng-services">')
    nav = nav.replace('<div class="nav-group" id="ng-learn">', '<div class="nav-group current" id="ng-learn">')
    i = nav.index('<div class="lang-menu-panel"'); j = nav.index('</div>', i)
    nav = nav[:i] + only_langs(nav[i:j]) + nav[j:]
    i = foot.index('<nav class="footer-langs"'); j = foot.index('</nav>', i)
    foot = foot[:i] + only_langs(foot[i:j]) + foot[j:]

    def page_url(p):
        return loc + p if L == 'en' or os.path.exists(os.path.join(SITE, L, p)) else '/' + p
    faq_html = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (
        ' open' if i == 0 else '', esc(q).replace('&#x27;', "'"), esc(a).replace('&#x27;', "'")) for i, (q, a) in enumerate(faq))
    rel = [(page_url('btc-monthly-returns.html'), 'rel_monthly'), (page_url('retirement-calculator.html'), 'rel_retire'), (page_url('ma-200w.html'), 'rel_wma')]
    rcards = ''.join('<a class="gcard" href="%s"><b>%s</b><span>%s</span></a>' % (u, t[x + '_t'], esc(t[x + '_p']).replace('&#x27;', "'")) for u, x in rel)
    gchips = ''.join('<button type="button" class="fvb-chip" data-g="%s" aria-pressed="%s">%s <small>%d</small></button>' % (
        g, 'true' if g == 'pillar' else 'false', t['grp_' + g], len(GROUPS[g])) for g in ('pillar', 'fund', 'etf'))
    hchips = ''.join('<button type="button" class="fvb-chip" data-y="%d" aria-pressed="%s">%s</button>' % (
        y, 'true' if y == 10 else 'false', t['hz%d' % y]) for y in (1, 5, 10))
    tchips = '<button type="button" class="fvb-chip" data-t="all" aria-pressed="true">%s <small>%d</small></button>' % (t['type_all'], len(GROUPS['pillar'])) + ''.join(
        '<button type="button" class="fvb-chip" data-t="%s" aria-pressed="false">%s <small>%d</small></button>' % (
            k, t['type_' + k], sum(1 for f in GROUPS['pillar'] if f['type'] == k)) for k in TYPE_ORDER['pillar'])
    companies = '<option value="">%s</option>' % t['company_all'] + ''.join(
        '<option>%s</option>' % esc(c) for c in sorted({f['company'] for f in GROUPS['pillar']}))
    cards = btc_card('pillar', L, t) + ''.join(card(f, 'pillar', L, t) for f in GROUPS['pillar'])
    strings = {k: v for k, v in t.items() if k.startswith(('c_', 'type_', 'grp_', 'hz', 'pred_', 'ch_', 'ret_lab_', 'num_', 'date_', 'fee_', 'card_', 'chart_', 'end_', 'lab_'))
               or k in ('miss', 'usd_only', 'btc_fee', 'btc_fee_short', 'btc_ref', 'range', 'asof_short', 'src_adss', 'src_kid', 'src_report',
                        'company_all', 'type_bitcoin', 'count')}
    cfg = {'data': DATA_URL, 'lang': L, 'locale': 'en-GB' if L == 'en' else 'sk-SK', 'pctSpace': L in C.PCT_SPACE,
           'amount': 10000, 'monthly': 100, 'types': TYPE_ORDER}
    legal = esc(DATA['legalNotice']['text'])
    b0, _ = btc_for('pillar')

    out += '''<body class="page-buy page-data page-fvb no-split">
{nav}

<main class="wrap bd-v3 bd-acc-blue" id="top">
  <div id="fvbCcSlot"></div>
  <div class="buy-hero2 pf-hero fvb-hero">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <p class="sp-lead">{lead}</p>
    <div class="fvb-nums" aria-live="polite">{nums}</div>
    <p class="fvb-notice" role="note"><b>{notice}</b> <a href="#notice">{notice_more} →</a></p>
  </div>
  <noscript><p class="pf-noscript">{noscript}</p></noscript>

  <section id="steps" aria-label="{steps_aria}">
    <div class="fvb-steps">
      <div class="fvb-step"><h3><i>1</i>{s1}</h3><div class="fvb-chips" role="group" aria-label="{s1}" id="fvbGroup">{gchips}</div></div>
      <div class="fvb-step"><h3><i>2</i>{s2}</h3><div class="fvb-chips" role="group" aria-label="{s2}" id="fvbHorizon">{hchips}</div></div>
      <div class="fvb-step"><h3><i>3</i>{s3}</h3>
        <div class="fvb-amt"><output id="fvbAmtOut" for="fvbAmt">{amt0}</output><span id="fvbAmtLab">{amt_once}</span></div>
        <input class="fvb-range" type="range" id="fvbAmt" min="1000" max="100000" step="1000" value="10000" aria-label="{s3}">
        <div class="fvb-togs" role="group" aria-label="{s3}" id="fvbMode"><button type="button" class="fvb-tog" data-m="once" aria-pressed="true">{m_once}</button><button type="button" class="fvb-tog" data-m="monthly" aria-pressed="false">{m_monthly}</button></div>
      </div>
    </div>
    <p class="fvb-date" id="fvbDate" aria-live="polite">{date0}</p>
  </section>

  <section id="chart">
    <div class="sec-head one"><div class="sec-copy"><h2 id="fvbChartH">{ch_h0}</h2></div></div>
    <p class="fvb-legend"><span><i style="background:#f7931a"></i>Bitcoin</span><span><i style="background:#8b949e"></i>{ch_funds}</span><span id="fvbScale">{ch_log}</span></p>
    <div class="fvb-chartbox"><svg class="fvb-chart" id="fvbChart" role="img" aria-label="{caria}"></svg><div class="fvb-tip" id="fvbTip"></div></div>
    <div class="fvb-ends" id="fvbEnds" aria-live="polite"></div>
    <p class="fvb-note" id="fvbChartNote">{cnote}</p>
  </section>

  <section id="cards">
    <div class="sec-head one"><div class="sec-copy"><h2>{cards_h2a} <span>{cards_h2b}</span></h2></div></div>
    <p class="sp-lead" style="margin:-20px 0 22px">{cards_lead}</p>
    <div class="fvb-ctrl">
      <input type="search" id="fvbQ" placeholder="{q_ph}" aria-label="{q_ph}" autocomplete="off">
      <select id="fvbCompany" aria-label="{f_company}">{companies}</select>
    </div>
    <div class="fvb-ctrl">
      <div class="fvb-chips" role="group" aria-label="{f_type}" id="fvbType">{tchips}</div>
    </div>
    <div class="fvb-ctrl">
      <button type="button" class="fvb-tog" id="fvbFull" aria-pressed="false">{full}</button>
      <span class="fvb-togs" role="group" aria-label="{f_mode}" id="fvbRet" style="margin:0"><button type="button" class="fvb-tog" data-r="nominal" aria-pressed="true">{mode_nominal}</button><button type="button" class="fvb-tog" data-r="real" aria-pressed="false">{mode_real}</button></span>
      <span class="fvb-count" id="fvbCount" aria-live="polite">{count0}</span>
    </div>
    <div class="fvb-cards" id="fvbCards">{cards}</div>
  </section>

  <section id="context">
    <div class="sec-head one"><div class="sec-copy"><h2>{ctx_h2a} <span>{ctx_h2b}</span></h2></div></div>
    <p class="sp-lead" style="margin:-20px 0 22px">{ctx_lead}</p>
    <div class="fvb-props">{props}</div>
  </section>

  <section id="fees">
    <div class="sec-head one"><div class="sec-copy"><h2>{fees_h2a} <span>{fees_h2b}</span></h2></div></div>
    <p class="sp-lead" style="margin:-20px 0 22px">{fees_lead}</p>
    <div class="fvb-fees">{fees}</div>
  </section>

  <section id="all">
    <div class="sec-head one"><div class="sec-copy"><h2>{all_h2a} <span>{all_h2b}</span></h2></div></div>
    <p class="sp-lead" style="margin:-20px 0 22px">{all_lead}</p>
    <div class="fvb-wrap"><table class="fvb-table" id="fvbT1">{table1}</table></div>
    <p class="fvb-note">{t1_note}</p>
    <div class="fvb-wrap" style="margin-top:22px"><table class="fvb-table" id="fvbT2">{table2}</table></div>
    <p class="fvb-note">{t2_note}</p>
  </section>

  <section id="methodology" class="fvb-text">
    <div class="sec-head one"><div class="sec-copy"><h2>{mh2a} <span>{mh2b}</span></h2></div></div>
    {mparas}
    <h3 id="missing">{nah}</h3>
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
'''.format(nav=nav, eyebrow=t['eyebrow'], h1=t['h1'], h1g=t['h1_grey'], lead=t['lead'], nums=nums('pillar', L, t),
           notice=t['notice'], notice_more=t['notice_more'], noscript=t['noscript'], steps_aria=t['steps_aria'],
           s1=t['s1'], s2=t['s2'], s3=t['s3'], gchips=gchips, hchips=hchips, amt0=eur(10000, L), amt_once=t['amt_once'],
           m_once=t['m_once'], m_monthly=t['m_monthly'], date0=date_line('pillar', L, t),
           ch_h0=t['chart_h_once'].replace('{a}', eur(10000, L)).replace('{p}', t['pred_10']), ch_funds=t['ch_funds'], ch_log=t['ch_log'],
           caria=esc(t['ch_aria']), cnote=t['chart_note_pillar'],
           cards_h2a=t['cards_h2a'], cards_h2b=t['cards_h2b'], cards_lead=t['cards_lead'], q_ph=t['q_ph'], f_company=t['f_company'],
           companies=companies, f_type=t['f_type'], tchips=tchips, full=t['full'], f_mode=t['f_mode'],
           mode_nominal=t['mode_nominal'], mode_real=t['mode_real'],
           count0=t['count'].replace('{n}', str(len(GROUPS['pillar']))).replace('{t}', str(len(GROUPS['pillar']))), cards=cards,
           ctx_h2a=t['ctx_h2a'], ctx_h2b=t['ctx_h2b'], ctx_lead=t['ctx_lead'], props=props(L, t),
           fees_h2a=t['fees_h2a'], fees_h2b=t['fees_h2b'], fees_lead=t['fees_lead'], fees=fees(L, t),
           all_h2a=t['all_h2a'], all_h2b=t['all_h2b'], all_lead=t['all_lead'], table1=table1(L, t), table2=table2(L, t),
           t1_note=esc(t['t1_note']).replace('&#x27;', "'"), t2_note=esc(t['t2_note']).replace('&#x27;', "'"),
           mh2a=t['m_h2a'], mh2b=t['m_h2b'], mparas='\n    '.join('<p>%s</p>' % t['m%d' % i] for i in range(1, 20) if 'm%d' % i in t),
           nah=t['na_h'], nalead=t['na_lead'], nalist=na_list(L, t), src_h=t['src_h'], sources=sources(L, t),
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
