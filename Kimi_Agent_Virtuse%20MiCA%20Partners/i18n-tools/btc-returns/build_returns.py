#!/usr/bin/env python3
"""Bitcoin returns by month and by year (EN, design v2), from the heatmap's own data.

usage: python3 build_returns.py            build everything
       python3 build_returns.py --monthly  only when a month has closed since the last build
                                           (the daily GitHub Action; between builds btc-returns.js
                                           keeps the numbers current in the browser)

Writes
  /bitcoin-returns/<month>/   12 pages: average, median, share of years higher, best and worst
                              year, year-by-year table, bar chart, rank against the other months
  /bitcoin-returns/<year>/    2011 to the running year (YTD): monthly returns, start and end price,
                              max drawdown, best and worst month, comparison with the year before
  /bitcoin-returns/           noindex redirect to the heatmap
  btc-monthly-returns.html    the heatmap page gets the title, a best/worst-month block, link grids
                              to every month and year page, 5 FAQ and JSON-LD (Dataset, FAQPage,
                              BreadcrumbList); edited in i18n-tools/legacy/src/en/ and rebuilt with
                              build_legacy.py
  sitemap.xml                 block BTC-RETURNS:START/END (indexable pages only) + the hub's lastmod

Data: data/btc-monthly-returns.json (btc-monthly-build/build.mjs, daily). Every number and every
data sentence comes from /btc-returns.js, run here in Node and again in the browser, so the pages
and the heatmap use one set of return rules. A page with fewer than 3 complete data points is
noindex and left out of the sitemap.
"""
import calendar, datetime, html, json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
sys.path.insert(0, os.path.join(TOOLS, 'legacy'))
import build_fee_index as F
import build_legacy
C, SITE, ORIGIN = F.C, F.SITE, F.ORIGIN
REPO = os.path.dirname(SITE)
JS_V = '2'
DATA_FILE = os.path.join(SITE, 'data', 'btc-monthly-returns.json')
HUB = 'btc-monthly-returns.html'
HUB_SRC = os.path.join(TOOLS, 'legacy', 'src', 'en', HUB)
STATE = os.path.join(HERE, 'state.json')   # last complete month of the last build (not deployed: i18n-tools/)
esc = html.escape

CSS = '''<style>
.page-vbr .buy-hero2{padding-bottom:8px}
.vbr-crumbs{font-size:13px;color:var(--muted);margin-bottom:6px}
.vbr-crumbs a{color:var(--muted);text-underline-offset:3px}
.vbr-crumbs a:hover{color:var(--text)}
.vbr{margin-top:8px}
.vbr-asof{font-size:13px;color:var(--muted);margin:0 0 14px;text-align:center}
.vbr-tiles{grid-template-columns:repeat(5,1fr);margin-bottom:22px}
.vbr-tiles .bd-v{font-size:26px}
.vbr-tiles .bd-v a{color:inherit;text-decoration:none}
.vbr-tiles .bd-v a:hover{text-decoration:underline;text-underline-offset:4px}
.vbr-sub{font-size:13px;color:var(--muted)}
.vbr-obs{font-size:17px;line-height:1.65;color:var(--text);max-width:860px;margin:0 0 12px}
.vbr-note{font-size:12px;color:var(--muted);line-height:1.6;max-width:860px;margin:10px 0 0}
.vbr-chartbox{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:14px 10px 6px;margin:22px 0 8px}
.vbr-chart{display:block;width:100%;height:auto}
.vbr-chart .grid{stroke:rgba(255,255,255,.07);stroke-width:1}
.vbr-chart .zero{stroke:rgba(255,255,255,.28);stroke-width:1}
.vbr-chart .ax{fill:#9aa3ad;font:500 12px var(--mono)}
.vbr-chart .cut{fill:#e6edf3;font:600 12px var(--mono)}
.vbr-chart rect.up{fill:rgb(46,160,90)}
.vbr-chart rect.dn{fill:rgb(210,60,60)}
.vbr-chart rect.cur{opacity:.45}
.vbr-h{font-size:28px;font-weight:700;line-height:1.2;letter-spacing:-.01em;margin:44px 0 16px}
.vbr-h span,.vbr-h3 span{color:var(--muted);font-weight:500}
.vbr-h3{font-size:20px;font-weight:650;margin:34px 0 14px}
.vbr-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--card);max-width:860px}
.vbr-table{border-collapse:separate;border-spacing:0;width:100%;font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap}
.vbr-table th,.vbr-table td{padding:9px 12px;text-align:right;border-bottom:1px solid var(--line)}
.vbr-table thead th{font:600 12px var(--sans);color:var(--muted)}
.vbr-table th.vbr-a,.vbr-table td.vbr-a{text-align:left}
.vbr-table td.vbr-a a{color:var(--text);text-underline-offset:3px}
.vbr-table td.vbr-a span{font-size:12px;color:var(--muted);margin-left:4px}
.vbr-table tbody tr:last-child td{border-bottom:0}
.vbr-table td.vbr-r{min-width:78px}
.vbr-table tr.vbr-me td{font-weight:700;color:var(--text)}
.vbr-table tr.vbr-me td:first-child{box-shadow:inset 3px 0 0 var(--orange)}
.vbr-table tr.vbr-cur td,.vbr-table tr.vbr-fut td{color:var(--muted)}
.vbr-table tr.vbr-tot td{font-weight:700;border-top:1px solid var(--line-strong)}
.vbr-pn{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;max-width:860px;margin:28px 0 0;font-size:15px;font-weight:600}
.vbr-pn a{color:var(--text);text-underline-offset:3px}
.vbr-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.vbr-cards.vbr-years{grid-template-columns:repeat(8,1fr)}
.vbr-card{background:var(--card);border:1px solid transparent;border-radius:12px;padding:12px 14px;display:grid;gap:3px;text-decoration:none;transition:background .2s,border-color .2s}
.vbr-card:hover{background:var(--card-hover);border-color:var(--line-strong)}
.vbr-card b{color:var(--text);font-size:15px}
.vbr-card span{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
.vbr-card span.pos{color:#b8f0c8}.vbr-card span.neg{color:#ffc4c4}
.vbr-hub{max-width:1200px;margin:0 auto;padding:8px 0 24px}
.vbr-hub .sec-head{margin-bottom:22px}
.vbr-hub .vbr-tiles{grid-template-columns:repeat(4,1fr)}
@media (max-width:900px){.vbr-tiles,.vbr-hub .vbr-tiles{grid-template-columns:1fr 1fr}.vbr-cards{grid-template-columns:repeat(3,1fr)}.vbr-cards.vbr-years{grid-template-columns:repeat(4,1fr)}}
@media (max-width:600px){.vbr-chart .ax,.vbr-chart .cut{font-size:21px}.vbr-tiles .bd-v{font-size:20px}.vbr-obs{font-size:16px}.vbr-h{font-size:23px}.vbr-table{font-size:13px}.vbr-table th,.vbr-table td{padding:8px 9px}.vbr-cards{grid-template-columns:1fr 1fr}.vbr-cards.vbr-years{grid-template-columns:repeat(3,1fr)}}
</style>
'''

RELATED = [
    ('/btc-monthly-returns.html', 'Monthly returns heatmap', 'Every month since 2010 in one table, in USD or EUR.'),
    ('/bitcoin-dca-calculator/', 'DCA calculator', 'What regular weekly or monthly buys would have returned.'),
    ('/retirement-calculator.html', 'Retirement calculator', 'How much Bitcoin a retirement plan might need.'),
    ('/ma-200w.html', '200-week moving average', "Bitcoin's long-term average price, updated daily."),
    ('/asset-returns.html', 'Asset returns', 'Bitcoin against stocks, bonds and gold, year by year.'),
    ('/bitcoin-vs-gold.html', 'Bitcoin vs gold', 'Returns against gold, silver and oil since 2016.'),
]
# related block on the heatmap page (handover HANDOVER-seo-quickwins-2026-10-26.md)
HUB_RELATED = [
    ('/asset-returns.html', 'Asset returns', 'Bitcoin against stocks, bonds and gold, year by year.'),
    ('/ma-200w.html', '200-week moving average', "Bitcoin's long-term average price, updated daily."),
    ('/rainbow-chart.html', 'Rainbow chart', 'Price history on a log scale in nine colour bands.'),
    ('/stacking.html', 'Stacking Strategist', 'Plan a regular buy (DCA) and compare fees.'),
    ('/bitcoin-dca-calculator/', 'DCA calculator', 'What regular weekly or monthly buys would have returned.'),
    ('/bitcoin-vs-gold.html', 'Bitcoin vs gold', 'Returns against gold, silver and oil since 2016.'),
]
DISCLAIMER = ('Prices: CoinMetrics daily Bitcoin reference rate in US dollars. Past performance does not guarantee future results. '
              'Not investment advice. Virtuse never holds your keys or funds.')


def render():
    """Run btc-returns.js in Node on the data file; returns the model's rendered pieces."""
    js = r'''
const R = require(process.argv[1]), d = require(process.argv[2]);
const now = process.env.VBR_NOW ? new Date(process.env.VBR_NOW) : new Date();
const M = R.model(d, now);
const out = { asOf: d.asOf, cy: M.cy, cm: M.cm, fy: M.fy, lastY: M.lastY, lastM: M.lastM, firstMonth: d.firstClose.month,
  months: [1,2,3,4,5,6,7,8,9,10,11,12].map(m => R.renderMonth(M, m)),
  years: M.yearList.map(y => R.renderYear(M, y)), hub: R.renderHub(M) };
process.stdout.write(JSON.stringify(out));
'''
    r = subprocess.run(['node', '-e', js, os.path.join(SITE, 'btc-returns.js'), DATA_FILE], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def last_day(y, m):
    return '%d-%02d-%02d' % (y, m, calendar.monthrange(y, m)[1])


def related(items=RELATED):
    cards = ''.join('<a class="gcard" href="%s"><b>%s</b><span>%s</span></a>' % (u, esc(t), esc(p)) for u, t, p in items)
    return '''<section id="related">
    <div class="sec-head one"><div class="sec-copy"><h2>Related <span>tools and data</span></h2></div></div>
    <div class="gcards">%s</div>
  </section>''' % cards


def page(rel, url, title, desc, crumbs, h1, h1_grey, lead, block, robots, dataset, asof):
    t = {k: v for k, v in json.load(open(os.path.join(TOOLS, 'bitcoin-data', 'en.json'))).items() if k.startswith('b_') or k == 'email'}
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [F.crumbs_ld(crumbs), dataset]}
    out = F.head('en', title, desc, url, [('en', url), ('x-default', url)], ld, robots=robots, title_max=60)
    out = out.replace("connect-src 'self'", "connect-src 'self' https://raw.githubusercontent.com", 1)
    out = out.replace('</head>', CSS + '</head>', 1)
    nav, foot = F.chrome('en', lambda x: '/' + HUB if x == 'en' else '/%s/%s' % (x, HUB))
    nav = nav.replace('<div class="nav-group current" id="ng-services">', '<div class="nav-group" id="ng-services">')
    nav = nav.replace('<div class="nav-group" id="ng-learn">', '<div class="nav-group current" id="ng-learn">')
    trail = ' · '.join('<a href="%s">%s</a>' % (u, esc(n)) for n, u in crumbs[1:-1]) + ' · <span aria-current="page">%s</span>' % esc(crumbs[-1][0])
    out += '''<body class="page-buy page-data page-vbr no-split">
{nav}

<main class="wrap bd-v3 bd-acc-teal" id="top">
  <div class="buy-hero2 pf-hero">
    <nav class="vbr-crumbs" aria-label="Breadcrumb">{trail}</nav>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <p class="sp-lead">{lead}</p>
  </div>

  <section id="returns" class="vbr">
    <p class="vbr-asof">Data as of {date} · US dollars · CoinMetrics daily reference rate</p>
    <div data-vbr="{spec}" data-asof="{asof}">
{block}
    </div>
  </section>

  {related}

  {brief}

  <p class="tx-fine fi-disc">{disc}</p>
  {foot}
</main>

'''.format(nav=nav, trail=trail, h1=h1, h1g=h1_grey, lead=lead, date=F.date_str(asof, 'en'), spec=block[0], asof=asof, block=block[1],
           related=related(), brief=F.brief_card('en', t, 'btc_returns_brief'), disc=DISCLAIMER, foot=foot)
    sc = C.scripts('/')
    out += sc.replace('<script src="/site-v2.js', '<script src="/btc-returns.js?v=%s" defer></script>\n<script src="/site-v2.js' % JS_V, 1)
    F.check_text(out, rel)
    F.write(rel, out)


def dataset(name, desc, url, cover, asof):
    return {'@type': 'Dataset', 'name': name, 'description': desc, 'url': ORIGIN + url, 'dateModified': asof, 'temporalCoverage': cover,
            'variableMeasured': ['Bitcoin monthly return (USD)', 'Bitcoin month-end close (USD)'], 'creator': {'@id': ORIGIN + '/#org'},
            'isAccessibleForFree': True, 'inLanguage': 'en',
            'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': ORIGIN + '/data/btc-monthly-returns.json'}]}


def build_month(R, m):
    X = R['months'][m - 1]
    if not X['n']:
        return None
    url = '/bitcoin-returns/%s/' % X['slug']
    prev = calendar.month_name[12 if m == 1 else m - 1]
    lead = ('How Bitcoin did in %s in every year since %d: the return from the last close of %s to the last close of %s, '
            'the average and the median, how many years closed higher, and where %s ranks among the 12 months.') % (X['name'], X['first'], prev, X['name'], X['name'])
    crumbs = [('Home', '/'), ('Bitcoin Data', '/bitcoin-data.html'), ('Monthly Returns', '/' + HUB), (X['name'], url)]
    ds = dataset('Bitcoin returns in %s, %s' % (X['name'], X['range']),
                 "Bitcoin's return in %s of every year from %d to %d (last close of %s to last close of %s, US dollars), with the average, median, "
                 'share of years that closed higher and the rank against the other months. Source: CoinMetrics daily reference rate. Updated daily.'
                 % (X['name'], X['first'], X['last'], prev, X['name']),
                 url, '%d-%02d-01/%s' % (X['first'], m, last_day(X['last'], m)), R['asOf'])
    page('bitcoin-returns/%s/index.html' % X['slug'], url, X['title'], X['desc'], crumbs, 'Bitcoin Returns in ' + X['name'], X['range'], lead,
         ('month:%d' % m, X['html']), 'index, follow' if X['indexable'] else 'noindex, follow', ds, R['asOf'])
    return url, X['indexable']


def build_year(R, Y):
    y = Y['y']
    url = '/bitcoin-returns/%d/' % y
    if Y['ytd']:
        lead = ("Bitcoin's return in each month of %d so far, the price at the end of %d and today, the deepest fall from a high this year, "
                'and how the same months compare with %d.') % (y, y - 1, y - 1)
    else:
        lead = ("Bitcoin's return in each month of %d, the price at the start and end of the year, its high, low and deepest fall from a high, "
                'and how %d compares with %d.') % (y, y, y - 1)
    crumbs = [('Home', '/'), ('Bitcoin Data', '/bitcoin-data.html'), ('Monthly Returns', '/' + HUB), (Y['label'], url)]
    cover = '%d-01-01/%s' % (y, R['asOf'] if Y['ytd'] else '%d-12-31' % y)
    ds = dataset('Bitcoin monthly returns in %s' % Y['label'],
                 "Bitcoin's return in each month of %d%s (month-end closes, US dollars), the yearly return, the highest and lowest daily close and "
                 'the maximum drawdown within the year. Source: CoinMetrics daily reference rate. Updated daily.' % (y, ' to date' if Y['ytd'] else ''),
                 url, cover, R['asOf'])
    page('bitcoin-returns/%d/index.html' % y, url, Y['title'], Y['desc'], crumbs, 'Bitcoin Returns %d' % y,
         'year to date' if Y['ytd'] else 'month by month', lead, ('year:%d' % y, Y['html']),
         'index, follow' if Y['indexable'] else 'noindex, follow', ds, R['asOf'])
    return url, Y['indexable']


def build_stub():
    out = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bitcoin Monthly Returns | Virtuse</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="{o}/{hub}">
<meta http-equiv="refresh" content="0; url=/{hub}">
<script>location.replace("/{hub}");</script>
</head>
<body>
<p><a href="/{hub}">Continue to Bitcoin monthly returns</a></p>
</body>
</html>
'''.format(o=ORIGIN, hub=HUB)
    p = os.path.join(SITE, 'bitcoin-returns', 'index.html')
    open(p, 'w').write(out)


# ---------------------------------------------------------------- hub (heatmap page)
def build_hub(R):
    s = open(HUB_SRC).read()
    H = R['hub']
    title = 'Bitcoin Monthly Returns (BTC) by Month %s–%d | Virtuse' % (R['firstMonth'][:4], R['cy'])
    assert len(title) <= 60, title
    s = re.sub(r'<title>[^<]*</title>', '<title>%s</title>' % esc(title, False), s, count=1)
    for prop in ('og:title', 'twitter:title'):
        attr = 'property' if prop.startswith('og') else 'name'
        s = re.sub(r'(<meta %s="%s" content=")[^"]*' % (attr, prop), lambda m: m.group(1) + esc(title), s, count=1)
    # meta description with the month facts people search for; same numbers as the tiles and FAQ
    Mt = H['meta']
    desc = ('Bitcoin monthly returns since %s in one heatmap, in USD or EUR. %s is the strongest month by median (%s), '
            'up in %d of %d years. Updated daily.' % (R['firstMonth'][:4], Mt['name'], Mt['med'], Mt['pos'], Mt['n']))
    if not 140 <= len(desc) <= 160:
        desc = 'Bitcoin monthly returns for every month since %s as a heatmap, in USD or EUR. Average and median return per month and quarter, updated daily.' % R['firstMonth'][:4]
    for name, attr in (('description', 'name'), ('og:description', 'property'), ('twitter:description', 'name')):
        s = re.sub(r'(<meta %s="%s" content=")[^"]*' % (attr, name), lambda m: m.group(1) + esc(desc), s, count=1)

    url = '/' + HUB
    faq = H['faq']
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [
        F.crumbs_ld([('Home', '/'), ('Bitcoin Data', '/bitcoin-data.html'), ('Monthly Returns', url)]),
        {'@type': 'Dataset', 'name': 'Bitcoin monthly returns since 2010',
         'description': "Bitcoin's return in every month since August 2010 (last close of the previous month to the last close of the month), in US dollars "
                        'and euros, with the average, median and share of positive months for each calendar month and quarter. Source: CoinMetrics daily '
                        'reference rate and ECB EUR/USD. Updated daily.',
         'url': ORIGIN + url, 'dateModified': R['asOf'], 'temporalCoverage': '%s-01/%s' % (R['firstMonth'], R['asOf']),
         'variableMeasured': ['Bitcoin monthly return (USD)', 'Bitcoin monthly return (EUR)', 'Bitcoin month-end close (USD)'],
         'creator': {'@id': ORIGIN + '/#org'}, 'isAccessibleForFree': True, 'inLanguage': 'en',
         'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'application/json', 'contentUrl': ORIGIN + '/data/btc-monthly-returns.json'}]},
        F.faq_ld([(q, a) for q, a in faq])]}
    block = '<!-- BTC-RETURNS-LD:START -->\n<script type="application/ld+json">%s</script>\n<!-- BTC-RETURNS-LD:END -->\n' % json.dumps(ld, ensure_ascii=False, indent=2)
    s = re.sub(r'<!-- BTC-RETURNS-LD:START -->.*?<!-- BTC-RETURNS-LD:END -->\n', '', s, flags=re.S)
    s = s.replace('</head>', block + '</head>', 1)

    faq_html = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (' open' if i == 0 else '', esc(q, False), esc(a, False)) for i, (q, a) in enumerate(faq))
    slot = '''<!-- V2:AFTER-LEGACY -->
<style data-v2>
{css}</style>
<section id="by-month" class="vbr-hub">
    <div data-vbr="hub" data-asof="{asof}">
{html}
    </div>
  </section>

  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>Questions <span>and answers</span></h2></div></div>
    {faq}
  </section>

  {related}
  <script src="/btc-returns.js?v={v}" defer></script>
<!-- /V2:AFTER-LEGACY -->
'''.format(css=CSS[len('<style>\n'):-len('</style>\n')], asof=R['asOf'], html=H['html'], faq=faq_html, related=related(HUB_RELATED), v=JS_V)
    s = re.sub(r'<!-- V2:AFTER-LEGACY -->.*?<!-- /V2:AFTER-LEGACY -->\n\n?', '', s, flags=re.S)   # slot + the blank line added below
    i = s.index('<!-- ===== NEWSLETTER ===== -->')
    s = s[:i] + slot + '\n' + s[i:]
    open(HUB_SRC, 'w').write(s)
    build_legacy.build('en', HUB)
    out = open(os.path.join(SITE, HUB)).read()
    part = out[out.index('<section id="by-month"'):out.index('<section id="brief">')]
    vis = re.sub(r'<[^>]+>', ' ', re.sub(r'<script\b.*?</script>|<style\b.*?</style>', '', part, flags=re.S))
    if '—' in vis or '{' in vis:
        sys.exit('%s: em dash or unfilled placeholder in the returns block' % HUB)
    print('%-48s %6d bytes' % (HUB, len(out)))


# ---------------------------------------------------------------- sitemap
def sitemap(urls):
    sys.path.insert(0, os.path.join(REPO, 'seo-ops'))
    from sitemap_lastmod import lastmod_for
    sm = os.path.join(SITE, 'sitemap.xml')
    s = open(sm, encoding='utf-8').read()
    today = datetime.date.today().isoformat()
    old = re.search(r'<!-- BTC-RETURNS:START -->.*?<!-- BTC-RETURNS:END -->\n', s, re.S)
    prev = dict(re.findall(r'<loc>([^<]+)</loc>\n    <lastmod>([^<]+)</lastmod>', old.group(0))) if old else {}
    def lastmod(rel, loc, keep):
        # A page this build changed: its content date (today when the text changed). An unchanged
        # page keeps its lastmod, so a shallow checkout (GitHub Action) cannot move it.
        changed = subprocess.run(['git', 'status', '--porcelain', '--', os.path.join(SITE, rel)], cwd=REPO,
                                 capture_output=True, text=True).stdout.strip()
        if changed:
            d = lastmod_for(rel)
            if d == today or not keep:
                return d or today
        return keep or lastmod_for(rel) or today
    rows = ['<!-- BTC-RETURNS:START -->']
    for u, freq in urls:
        loc = ORIGIN + u
        rows.append('  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n    <changefreq>%s</changefreq>\n    <priority>0.5</priority>\n  </url>' % (
            loc, lastmod(u.strip('/') + '/index.html', loc, prev.get(loc)), freq))
    rows.append('<!-- BTC-RETURNS:END -->\n')
    block = '\n'.join(rows)
    n = s[:old.start()] + block + s[old.end():] if old else s.replace('<!-- TOOLS:START -->', block + '<!-- TOOLS:START -->', 1)
    # the heatmap page's own entry (main list): lastmod from its content history
    hub_loc = ORIGIN + '/' + HUB
    cur = re.search(r'<loc>%s</loc>\n    <lastmod>([^<]+)' % re.escape(hub_loc), n)
    lm = lastmod(HUB, hub_loc, cur.group(1) if cur else None)
    n = re.sub(r'(<loc>%s</loc>\n    <lastmod>)[^<]+' % re.escape(hub_loc), lambda m: m.group(1) + lm, n, count=1)
    if n != s:
        open(sm, 'w', encoding='utf-8').write(n)
        print('updated sitemap.xml')


def main():
    R = render()
    thru = '%d-%02d' % (R['lastY'], R['lastM'])
    if '--monthly' in sys.argv and os.path.exists(STATE) and json.load(open(STATE)).get('thru') == thru:
        print('no month closed since the last build (%s): nothing to do' % thru)
        return
    urls = []
    for m in range(1, 13):
        r = build_month(R, m)
        if r and r[1]:
            urls.append((r[0], 'monthly'))
    for Y in R['years']:
        r = build_year(R, Y)
        if r[1]:
            urls.append((r[0], 'daily' if Y['ytd'] else 'yearly'))
    build_stub()
    build_hub(R)
    sitemap(urls)
    json.dump({'thru': thru, 'asOf': R['asOf']}, open(STATE, 'w'))
    print('%d indexable pages, complete months through %s, data as of %s' % (len(urls), thru, R['asOf']))


if __name__ == '__main__':
    main()
