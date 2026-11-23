#!/usr/bin/env python3
"""Render the creators share kit: 4 graphics x 2 sizes x EN/SK = 16 JPGs in creators/kit/.

usage: python3 render_kit.py            (needs Google Chrome, Node 18+ and network for Google Fonts)

Every number is read from the data files at render time; nothing is typed into a template.
  btc-vs-gold      data/bitcoin-vs-commodities.json   Bitcoin and gold, 10 years: total and per year, USD
  asset-returns    data/asset-returns.json            Bitcoin's rank and per-year return since 2016
  fee-index        seo-build/data/fee-index.json      total cost of a EUR 100 buy (same ranking as the Fee Index page;
                                                      a route whose spread is not measured yet is shown unranked)
  monthly-returns  data/btc-monthly-returns.json      average and median return of the current month over all complete years,
                                                      exactly as the Monthly Returns pages show it (btc-returns.js model, from 2010)
Labels come from creators/<lang>.json (kit_* keys), so the SK images follow sk.json.

Rendering: a local http.server serves the generated HTML; Chrome runs headless with
--remote-debugging-port and a small Node script (global WebSocket, no packages) captures each
page over the DevTools protocol. Plain --headless --screenshot hangs on our Macs (og/README.md).
"""
import calendar, contextlib, datetime, functools, html, http.server, json, os, shutil, socket, subprocess, sys, tempfile, threading, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
import build_fee_index as F
C, SITE = F.C, F.SITE
REPO = os.path.dirname(SITE)
OUT = os.path.join(SITE, 'creators', 'kit')
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
LANGS = ['en', 'sk']
SIZES = {'1080x1080': (1080, 1080), '1200x675': (1200, 675)}
GRAPHICS = ['btc-vs-gold', 'asset-returns', 'fee-index', 'monthly-returns']
MAX_BYTES = 300 * 1024
MONTHS_SK = ['januári', 'februári', 'marci', 'apríli', 'máji', 'júni', 'júli', 'auguste', 'septembri', 'októbri', 'novembri', 'decembri']  # locative: "Bitcoin v novembri"

esc = lambda s: html.escape(str(s), quote=True)


def labels(L):
    t = json.load(open(os.path.join(HERE, L + '.json'), encoding='utf-8'))
    t['sp_pending'] = json.load(open(os.path.join(TOOLS, 'fee-index', L + '.json'), encoding='utf-8'))['sp_pending']
    return t


def ret(v, L, signed=True):
    """+12.3% / −4.5% (EN), +12,3 % (SK); one decimal, none from 1,000 % up."""
    if v is None:
        return '–'
    p = v * 100
    s = ('{:,.0f}' if abs(p) >= 1000 else '{:.1f}').format(abs(p))
    if L != 'en':
        s = s.replace(',', ' ').replace('.', ',')
    sign = ('+' if p > 0 else '−' if p < 0 else '') if signed else ('−' if p < 0 else '')
    return sign + s + (' %' if L in C.PCT_SPACE else '%')


# ---------- data (read at render time) ----------

def d_gold():
    d = json.load(open(os.path.join(SITE, 'data', 'bitcoin-vs-commodities.json')))
    a = {x['id']: x for x in d['assets']}
    return {'asOf': d['asOf'],
            'rows': [(k, a[k]['periods']['y10']['usd'], a[k]['periods']['y10']['usdPa']) for k in ('btc', 'gold')]}


def d_assets():
    d = json.load(open(os.path.join(SITE, 'data', 'asset-returns.json')))
    rows = sorted([r for r in d['rows'] if r['annualized'] is not None], key=lambda r: -r['annualized'])
    rank = next(i for i, r in enumerate(rows, 1) if r['ticker'] == 'BTC')
    return {'asOf': d['asOf'], 'since': d['years'][0], 'rank': rank, 'n': len(rows), 'rows': rows}


def d_fees():
    fi, s21 = F.load()
    rows = F.ranked(fi, s21, 100)
    return {'asOf': fi['checked'], 'rows': rows}


def d_monthly():
    """Average and median of the current calendar month over all complete years, taken from the same
    btc-returns.js model the Monthly Returns pages use, so the image matches the site (Ras, 20 Nov: from 2010)."""
    js = r'''
const R = require(process.argv[1]), d = require(process.argv[2]);
const M = R.model(d, new Date(d.asOf + 'T12:00:00Z'));
const X = M.months[M.cm - 1];
process.stdout.write(JSON.stringify({ m: M.cm, first: X.first, last: X.last, n: X.n, pos: X.pos, avg: X.avg, med: X.med, asOf: d.asOf }));
'''
    r = subprocess.run(['node', '-e', js, os.path.join(SITE, 'btc-returns.js'), os.path.join(SITE, 'data', 'btc-monthly-returns.json')], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


# ---------- HTML ----------

CSS = '''*{margin:0;padding:0;box-sizing:border-box}
html,body{width:%(w)dpx;height:%(h)dpx;background:#08090a;overflow:hidden}
body{position:relative;font-family:Inter,sans-serif;color:#e6edf3;padding:%(pad)dpx;display:flex;flex-direction:column}
.glow{position:absolute;right:-200px;top:-220px;width:720px;height:720px;border-radius:50%%;background:radial-gradient(circle,rgba(247,147,26,.16) 0%%,rgba(247,147,26,.05) 40%%,rgba(247,147,26,0) 68%%)}
.top{display:flex;align-items:center;gap:14px;font-weight:700;font-size:26px;position:relative}
.top svg{height:30px;width:auto}
.eye{margin-top:%(eyetop)dpx;font:500 17px "JetBrains Mono",monospace;letter-spacing:.18em;color:#8b949e;text-transform:uppercase;position:relative}
h1{margin-top:12px;font-size:%(h1)dpx;line-height:1.08;font-weight:700;letter-spacing:-.025em;position:relative}
h1 em{font-style:normal;color:#f7931a}
.main{flex:1;display:flex;flex-direction:column;justify-content:center;position:relative}
.foot{display:flex;justify-content:space-between;gap:24px;font-size:18px;color:#8b949e;border-top:1px solid rgba(255,255,255,.12);padding-top:18px;position:relative}
table{width:100%%;border-collapse:collapse;font-size:%(td)dpx}
th{font:500 15px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#8b949e;text-align:right;padding:0 0 12px}
th:first-child,td:first-child{text-align:left}
td{padding:%(tdpad)dpx 0;border-top:1px solid rgba(255,255,255,.08);text-align:right;font-variant-numeric:tabular-nums}
tr.btc td{color:#f7931a;font-weight:700}
td small{color:#8b949e;font-size:.72em;margin-left:10px}
.big{display:flex;gap:%(gap)dpx}
.big div{flex:1;background:#141414;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:%(cardpad)dpx}
.big b{display:block;font-size:%(bignum)dpx;font-weight:700;letter-spacing:-.02em;line-height:1}
.big span{display:block;margin-top:12px;font-size:20px;color:#8b949e}
.big .o b{color:#f7931a}
.note{margin-top:%(notetop)dpx;font-size:20px;color:#8b949e}
'''

LOGO = ('<svg viewBox="0 0 760 483" aria-hidden="true"><defs><linearGradient id="vA" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#A5E0FB"/>'
        '<stop offset="1" stop-color="#5FAEDE"/></linearGradient><linearGradient id="vB" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#4D94EC"/>'
        '<stop offset="1" stop-color="#2B62C0"/></linearGradient></defs><path fill="url(#vA)" d="M30 0h220l250 483H280Z"/>'
        '<path fill="url(#vB)" d="M510 0h245L645 205H400Z"/></svg><span>Virtuse</span>')


def page(size, eye, h1, main, asof, t):
    w, h = SIZES[size]
    sq = w == h
    v = dict(w=w, h=h, pad=72 if sq else 60, eyetop=56 if sq else 30, h1=64 if sq else 52, td=30 if sq else 24, tdpad=14 if sq else 8,
             gap=24, cardpad=34 if sq else 26, bignum=96 if sq else 76, notetop=28 if sq else 18)
    return '''<!doctype html><html lang="{L}"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&family=JetBrains+Mono:wght@500&display=block">
<style>{css}</style></head><body>
<div class="glow"></div>
<div class="top">{logo}</div>
<div class="eye">{eye}</div>
<h1>{h1}</h1>
<div class="main">{main}</div>
<div class="foot"><span>{asof}</span><span>{src}</span></div>
</body></html>'''.format(L=t['_lang'], css=CSS % v, logo=LOGO, eye=esc(eye), h1=h1, main=main, asof=esc(asof), src=esc(t['kit_source']))


def g_gold(D, t, L, size):
    rows = ''.join('<tr%s><td>%s</td><td>%s</td><td>%s</td></tr>' % (' class="btc"' if k == 'btc' else '', esc(t['kit_btc'] if k == 'btc' else t['kit_gold']),
                                                                   ret(tot, L), ret(pa, L)) for k, tot, pa in D['rows'])
    main = '<table><thead><tr><th></th><th>%s</th><th>%s</th></tr></thead><tbody>%s</tbody></table><p class="note">%s</p>' % (
        esc(t['kit_10y']), esc(t['kit_pa']), rows, esc(t['kit_usd_total']))
    return page(size, t['kit_gold_eye'], esc(t['kit_gold_h1']).replace('{em}', '<em>').replace('{/em}', '</em>'), main,
                t['kit_asof'].replace('{date}', F.date_str(D['asOf'], L)), t)


def g_assets(D, t, L, size):
    top = 6 if SIZES[size][0] == SIZES[size][1] else 4
    show = D['rows'][:top]
    if all(r['ticker'] != 'BTC' for r in show):
        show = show[:-1] + [next(r for r in D['rows'] if r['ticker'] == 'BTC')]
    rank_of = {r['ticker']: i for i, r in enumerate(D['rows'], 1)}
    rows = ''.join('<tr%s><td>%d. %s</td><td>%s</td></tr>' % (' class="btc"' if r['ticker'] == 'BTC' else '', rank_of[r['ticker']],
                                                             esc(r['name']), ret(r['annualized'], L)) for r in show)
    main = '<table><thead><tr><th></th><th>%s</th></tr></thead><tbody>%s</tbody></table><p class="note">%s</p>' % (
        esc(t['kit_ar_col'].replace('{year}', str(D['since']))), rows,
        esc(t['kit_ar_note'].replace('{rank}', str(D['rank'])).replace('{n}', str(D['n']))))
    return page(size, t['kit_ar_eye'], esc(t['kit_ar_h1']).replace('{em}', '<em>').replace('{/em}', '</em>'), main,
                t['kit_asof'].replace('{date}', F.date_str(D['asOf'], L)), t)


def g_fees(D, t, L, size):
    def cost(r):
        if r['pending']:
            return esc(t['sp_pending'])
        return '%s<small>%s</small>' % (eur2(r['total'], L), F.pct(r['total'], L))
    n = 0
    rows = ''
    for r in D['rows']:
        if not r['pending']:
            n += 1
        rows += '<tr><td>%s%s</td><td>%s</td></tr>' % ('%d. ' % n if not r['pending'] else '', esc(r['name']), cost(r))
    main = '<table><thead><tr><th></th><th>%s</th></tr></thead><tbody>%s</tbody></table><p class="note">%s</p>' % (
        esc(t['kit_fee_col']), rows, esc(t['kit_fee_note']))
    return page(size, t['kit_fee_eye'], esc(t['kit_fee_h1']).replace('{em}', '<em>').replace('{/em}', '</em>'), main,
                t['kit_fee_asof'].replace('{date}', F.date_str(D['asOf'], L)), t)


def eur2(v, L):
    """Cost in euros of a EUR 100 buy at total v %: v euros, two decimals."""
    s = '%.2f' % v
    return ('€' + s) if L == 'en' else (s.replace('.', ',') + ' €')


def g_monthly(D, t, L, size):
    month = calendar.month_name[D['m']] if L == 'en' else MONTHS_SK[D['m'] - 1]
    main = '<div class="big"><div class="o"><b>%s</b><span>%s</span></div><div><b>%s</b><span>%s</span></div></div><p class="note">%s</p>' % (
        ret(D['avg'], L), esc(t['kit_mr_avg']), ret(D['med'], L), esc(t['kit_mr_med']),
        esc(t['kit_mr_note'].replace('{pos}', str(D['pos'])).replace('{n}', str(D['n'])).replace('{first}', str(D['first'])).replace('{last}', str(D['last']))))
    h1 = esc(t['kit_mr_h1'].replace('{month}', month)).replace('{em}', '<em>').replace('{/em}', '</em>')
    return page(size, t['kit_mr_eye'], h1, main, t['kit_asof'].replace('{date}', F.date_str(D['asOf'], L)), t)


# ---------- render ----------

NODE = r'''
const [port, jobsFile] = process.argv.slice(1);
const jobs = require(jobsFile);
(async () => {
  const v = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl); let id = 0; const wait = {}; const ev = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; } else ev.push(d); };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  for (const j of jobs) {
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Emulation.setDeviceMetricsOverride', { width: j.w, height: j.h, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Page.navigate', { url: j.url }, sessionId);
    for (let k = 0; k < 100; k++) {   // wait for load + fonts
      const r = await send('Runtime.evaluate', { expression: 'document.readyState === "complete" && document.fonts.status === "loaded"', returnByValue: true }, sessionId);
      if (r.result && r.result.result && r.result.result.value) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: j.q, clip: { x: 0, y: 0, width: j.w, height: j.h, scale: 1 } }, sessionId);
    require('fs').writeFileSync(j.out, Buffer.from(shot.result.data, 'base64'));
    await send('Target.closeTarget', { targetId });
  }
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
'''


def free_port():
    with contextlib.closing(socket.socket()) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def render(pages):
    tmp = tempfile.mkdtemp(prefix='creators-kit-')
    for name, (w, h, doc) in pages.items():
        open(os.path.join(tmp, name + '.html'), 'w', encoding='utf-8').write(doc)
    hp = free_port()
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', hp), functools.partial(Quiet, directory=tmp))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    cp = free_port()
    prof = tempfile.mkdtemp(prefix='creators-kit-chrome-')
    chrome = subprocess.Popen([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=%d' % cp,
                               '--user-data-dir=' + prof, 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen('http://127.0.0.1:%d/json/version' % cp, timeout=1); break
            except OSError:
                time.sleep(0.1)
        os.makedirs(OUT, exist_ok=True)
        for q in (88, 80, 72):
            jobs = [{'url': 'http://127.0.0.1:%d/%s.html' % (hp, n), 'w': w, 'h': h, 'q': q, 'out': os.path.join(OUT, n + '.jpg')}
                    for n, (w, h, _) in pages.items()]
            jf = os.path.join(tmp, 'jobs.json'); json.dump(jobs, open(jf, 'w'))
            subprocess.run(['node', '-e', NODE, str(cp), jf], check=True)
            big = [n for n in pages if os.path.getsize(os.path.join(OUT, n + '.jpg')) > MAX_BYTES]
            if not big:
                break
            pages = {n: pages[n] for n in big}
        else:
            sys.exit('still over 300 KB: %s' % big)
    finally:
        chrome.terminate(); srv.shutdown()
        shutil.rmtree(tmp, ignore_errors=True); shutil.rmtree(prof, ignore_errors=True)


def main():
    data = {'btc-vs-gold': d_gold(), 'asset-returns': d_assets(), 'fee-index': d_fees(), 'monthly-returns': d_monthly()}
    draw = {'btc-vs-gold': g_gold, 'asset-returns': g_assets, 'fee-index': g_fees, 'monthly-returns': g_monthly}
    pages = {}
    for L in LANGS:
        t = labels(L); t['_lang'] = L
        for g in GRAPHICS:
            for size, (w, h) in SIZES.items():
                doc = draw[g](data[g], t, L, size)
                for ch in ('—', '&mdash;'):
                    if ch in doc:
                        sys.exit('%s %s %s: em dash in the image text' % (g, L, size))
                pages['%s%s-%s' % (g, '' if L == 'en' else '-sk', size)] = (w, h, doc)
    render(pages)
    for n in sorted(pages):
        print('%-36s %4d KB' % ('creators/kit/%s.jpg' % n, os.path.getsize(os.path.join(OUT, n + '.jpg')) // 1024))


if __name__ == '__main__':
    main()
