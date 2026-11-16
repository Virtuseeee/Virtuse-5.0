#!/usr/bin/env python3
"""Build the Bitcoin Retirement Calculator pages (retirement-calculator.html, design v2).

usage: python3 build_retirement.py [en sk ...]     (texts: <lang>.json next to this file)

Everything is static HTML rendered here: shared nav/footer, centred hero, the calculator
markup (labels from <lang>.json), How it works, FAQ, Brief card, related tools.
The logic lives in one shared file, /retirement-calc.js; it reads its strings from the
inline <script type="application/json" id="rc-i18n"> (all "c_*" keys) and formats numbers
with the page's <html lang>. A language without a JSON file is skipped and its page is
left as it is.
"""
import html, json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
import build_fee_index as F
import related_hubs
C, B, SITE, ORIGIN = F.C, F.B, F.SITE, F.ORIGIN
LANGS = ['en', 'sk', 'cs', 'uk', 'ru', 'de', 'fr', 'es', 'pl', 'hu']   # hreflang order as before
JS_V = '4'   # 4: saving-years chart colour from the page accent (--c), 2026-11-05
FALLBACK_PRICE = 74649          # BTC/EUR, 13 Oct 2026 (CoinGecko); the JS replaces it with the live price

# "How much Bitcoin do I need to retire?" (handover 2026-11-16). The table is not typed in: answer_numbers()
# runs btcNeededToday() from /retirement-calc.js in Node, so it is the page's own calculator at these inputs.
# Change the price and date together (CoinGecko BTC/EUR on that day), then rebuild every language.
ANSWER = {'price': 58646, 'date': '2026-11-16', 'age': 50, 'life': 85, 'inflation': 0.02,
          'spends': [20000, 30000, 50000, 80000], 'ref': 30000}
SCEN = [('conservative', 10, 'c'), ('base', 20, 'b'), ('optimistic', 30, 'o')]   # the calculator's own buttons
RAMP = {'c': '#9ec5f4', 'b': '#3987e5', 'o': '#1c5cab'}   # ordinal blue, checked with the dataviz validator on #141414
MONTH_GEN = {'sk': ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'],
             'cs': ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince']}
AND = {'en': 'and', 'sk': 'a', 'cs': 'a', 'de': 'und', 'es': 'y', 'fr': 'et', 'pl': 'i', 'hu': 'és', 'uk': 'і', 'ru': 'и'}
FAQ_NEW = ['much', 'many', 'one', 'best', 'eu', 'bear']   # q_<k>/a_<k>, shown before q1..q4

# typed limits (data-min/max) and the smaller slider ranges
FIELDS = {
    #          kind   default  min  max        slider max   slider step
    'stack': ('btc', 0.1,      0,   1000,      10,          0.01),
    'lump':  ('eur', 0,        0,   5000000,   1000000,     10000),
    'dca':   ('eur', 250,      0,   100000,    5000,        50),
    'spend': ('eur', 60000,    0,   1000000,   300000,      1000),
}

CSS = '''<style>
/* Batch C (2026-11-05): the question in the headline gradient, inputs and the pressed scenario in the page accent (--c, teal) */
.pf-hero .rc-q{font-size:clamp(22px,3.2vw,34px);line-height:1.2;font-weight:600;letter-spacing:-.02em;margin:12px auto 0;max-width:760px;width:fit-content;background:linear-gradient(90deg,#ffb347 0%,var(--orange) 40%,var(--blue) 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
/* RETIREMENT CALCULATOR (static calculator, logic in /retirement-calc.js) */
.rc [hidden] { display: none !important; }
.rc { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: 20px; align-items: start; text-align: left; }
.rc-panel { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 22px; min-width: 0; }
.rc-panel h2 { font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
.rc-field { padding: 12px 0; border-top: 1px solid var(--line); }
.rc-field:first-of-type { border-top: 0; padding-top: 0; }
.rc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rc-head label, .rc-lbl { font-size: 14px; color: var(--text); }
.rc-head output { font: 600 14px var(--sans); color: var(--c, var(--orange)); white-space: nowrap; }
.rc-num { width: 132px; flex: none; background: var(--inset); color: var(--c, var(--orange)); border: 1px solid var(--line-strong); border-radius: 8px; padding: 8px 10px; font: 600 14px var(--sans); text-align: right; }
.rc-num:focus { border-color: var(--c, var(--orange)); outline: none; }
.rc input[type=range] { width: 100%; margin: 12px 0 2px; accent-color: var(--c, var(--orange)); height: 18px; }
.rc-hint { margin: 6px 0 0; font-size: 12px; color: var(--dim); line-height: 1.45; }
.rc-hint a { color: var(--muted); }
.rc-err { margin: 6px 0 0; font-size: 12px; color: #f0883e; }
.rc-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.rc-btn { background: transparent; color: var(--text); border: 1px solid var(--line-strong); border-radius: 10px; padding: 9px 10px; font: 500 13px var(--sans); cursor: pointer; text-align: left; line-height: 1.3; }
.rc-btn small { display: block; color: var(--dim); font-size: 11px; }
.rc-btn:hover { background: var(--card-hover); }
.rc-btn:hover { border-color: color-mix(in srgb, var(--c, var(--orange)) 45%, transparent); }
.rc-btn[aria-pressed=true] { background: var(--c, var(--orange)); border-color: var(--c, var(--orange)); color: #06201c; }
.rc-btn[aria-pressed=true] small { color: rgba(0,0,0,.6); }
.rc-custom { margin-top: 12px; }
.rc-reset { background: none; border: 0; padding: 0; color: var(--muted); text-decoration: underline; font: inherit; cursor: pointer; }
.rc-res { display: grid; gap: 16px; min-width: 0; }
.rc-verdict { display: flex; gap: 14px; align-items: flex-start; border-radius: 16px; padding: 18px 20px; border: 1px solid var(--line-strong); background: var(--card); }
.rc-verdict b { display: block; font-size: 18px; font-weight: 700; }
.rc-verdict span { font-size: 14px; color: var(--muted); }
.rc-verdict i { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-weight: 700; background: rgba(63,185,80,.15); color: var(--good); }
.rc-verdict.bad i { background: rgba(240,136,62,.15); color: #f0883e; }
.rc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rc-box { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; min-width: 0; }
.rc-box p { margin: 0; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); line-height: 1.4; }
.rc-box strong { display: block; margin-top: 8px; font-size: 22px; font-weight: 700; overflow-wrap: anywhere; }
.rc-box strong.o { color: var(--c, var(--orange)); }
.rc-box small { display: block; margin-top: 4px; font-size: 12px; color: var(--dim); }
.rc-cfo, .rc-cta { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: var(--card); border: 1px solid var(--line-strong); border-radius: 16px; padding: 18px 20px; }
.rc-cfo p, .rc-cta p { margin: 0; font-size: 14px; line-height: 1.5; min-width: 0; }
.rc-cfo b { font-weight: 600; }
.rc-link { flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--line-strong); border-radius: 10px; padding: 10px 16px; font: 600 14px var(--sans); color: var(--text); text-decoration: none; white-space: nowrap; }
.rc-link:hover { background: var(--card-hover); border-color: color-mix(in srgb, var(--c, var(--orange)) 50%, transparent); }
.rc-chart canvas { display: block; width: 100%; height: 280px; }
.rc-share { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; margin-top: 12px; }
.rc-share input { width: 100%; max-width: 460px; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; color: var(--text); font: 13px var(--sans); }
.rc-legend { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin: -4px 0 10px; }
.rc-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.rc-simp { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.55; }
.rc-simp a { color: var(--text); }
/* "How much Bitcoin do I need to retire?" + "How to retire on Bitcoin" (2026-11-16) */
.pf-hero h1 .rc-q { display: block; }
.rq-answer { margin: 0 0 24px; max-width: 860px; font-size: 18px; line-height: 1.6; color: var(--muted); text-align: left; }
.rq-answer b { color: var(--text); font-weight: 600; }
.rq-wrap { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start; text-align: left; }
.rq-card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 22px; min-width: 0; }
.rq-card h3 { margin: 0 0 14px; font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.rq-key { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0 0 14px; font-size: 12px; color: var(--muted); }
.rq-key i, .rq-table thead i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.rq-fig { margin: 0; }
.rq-plot { position: relative; height: 240px; margin: 8px 0 0 30px; border-bottom: 1px solid var(--line-strong); }
.rq-tick { position: absolute; left: 0; right: 0; border-top: 1px solid var(--line); }
.rq-tick span { position: absolute; right: 100%; margin-right: 8px; transform: translateY(-50%); font-size: 11px; color: var(--dim); }
.rq-cols { position: absolute; inset: 0; display: flex; justify-content: space-around; align-items: flex-end; }
.rq-col { display: flex; align-items: flex-end; gap: 2px; height: 100%; }
.rq-bar { display: block; width: 22px; border-radius: 4px 4px 0 0; }
.rq-x { display: flex; justify-content: space-around; margin: 8px 0 0 30px; font-size: 12px; color: var(--muted); }
.rq-axis { margin: 10px 0 0; font-size: 12px; color: var(--dim); }
.rq-table-wrap { overflow-x: auto; }
.rq-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.rq-table caption { caption-side: top; text-align: left; margin: 0 0 10px; font-size: 13px; color: var(--muted); line-height: 1.5; }
.rq-table th, .rq-table td { padding: 10px 6px; border-top: 1px solid var(--line); text-align: right; vertical-align: top; }
.rq-table th:first-child { text-align: left; padding-left: 0; }
.rq-table thead th { border-top: 0; font-size: 12px; font-weight: 600; color: var(--muted); }
.rq-table tbody th { font-weight: 600; white-space: nowrap; }
.rq-table td { white-space: nowrap; font-weight: 600; }
.rq-table td small { display: block; font-size: 12px; font-weight: 400; color: var(--dim); }
.rq-note { margin: 14px 0 0; font-size: 13px; line-height: 1.55; color: var(--muted); }
.rq-cta { margin-top: 20px; text-align: left; }
.rq-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; counter-reset: rq; text-align: left; }
.rq-steps li { counter-increment: rq; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; min-width: 0; }
.rq-steps li::before { content: counter(rq, decimal-leading-zero); display: block; margin-bottom: 10px; font: 600 12px var(--sans); letter-spacing: .06em; color: var(--c, var(--orange)); }
.rq-steps h3 { margin: 0 0 8px; font-size: 17px; font-weight: 600; }
.rq-steps p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--muted); }
.rq-steps a { color: var(--text); }
@media (max-width: 900px) { .rc { grid-template-columns: minmax(0, 1fr); } .rq-wrap { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 520px) {
  .rc-panel { padding: 18px; }
  .rc-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  .rc-box { padding: 14px; } .rc-box strong { font-size: 18px; }
  .rc-cfo, .rc-cta { flex-direction: column; align-items: stretch; }
  .rc-num { width: 116px; }
  .rc-chart canvas { height: 240px; }
  .rq-card { padding: 18px; }
  .rq-answer { font-size: 16px; }
  .rq-bar { width: 16px; }
  .rq-table { font-size: 13px; }
  .rq-table th, .rq-table td { padding: 9px 4px; }
  .rq-table thead i { display: none; }
}
</style>
'''


def url(L):
    return '/retirement-calculator.html' if L == 'en' else '/%s/retirement-calculator.html' % L


def esc(s):
    return html.escape(s, quote=True)


def fmt_num(n):
    return ('%g' % n) if isinstance(n, float) else str(n)


_NUMBERS = None


def answer_numbers():
    """BTC needed today for each spending level and scenario, from /retirement-calc.js itself (Node)."""
    global _NUMBERS
    if _NUMBERS is None:
        prog = r'''
const fs = require("fs");
globalThis.window = {}; globalThis.document = { getElementById: () => null };
eval(fs.readFileSync(process.argv[1], "utf8"));
const R = window.VBRetire, a = JSON.parse(process.argv[2]);
const need = (s, g) => R.btcNeededToday({ age: a.age, retAge: a.age, life: a.life, spend: s, growth: g / 100,
  inflation: a.inflation, price: a.price });
const out = { need: {}, one: {}, flat: need(a.ref, 0) };
for (const s of a.spends) { out.need[s] = {}; for (const [k, g] of a.scen) out.need[s][k] = need(s, g); }
for (const [k, g] of a.scen) out.one[k] = a.ref / need(a.ref, g);
console.log(JSON.stringify(out));
'''
        arg = dict(ANSWER, scen=[[k, g] for _, g, k in SCEN])
        r = subprocess.run(['node', '-e', prog, os.path.join(SITE, 'retirement-calc.js'), json.dumps(arg)],
                           capture_output=True, text=True, check=True)
        _NUMBERS = json.loads(r.stdout)
    return _NUMBERS


def big_falls():
    """Falls of 70% or more from a record month-end close (USD, data/btc-monthly-returns.json),
    counted once a new record closes the fall. Returns [(peak 'YYYY-MM', trough 'YYYY-MM', depth)]."""
    closes = sorted(json.load(open(os.path.join(SITE, 'data', 'btc-monthly-returns.json')))['closes'].items())
    falls, (pm, pv), low = [], closes[0], None
    for m, v in closes[1:]:
        if v > pv:
            if low and low[1] / pv - 1 <= -0.70:
                falls.append((pm, low[0], low[1] / pv - 1))
            pm, pv, low = m, v, None
        elif low is None or v < low[1]:
            low = (m, v)
    return falls


def answer_values(L, t):
    """Placeholders for the new section and FAQ: {price}, {n30_b}, {e30_b}, {one_b}, {flat30}, ..."""
    N = answer_numbers()
    dec = '.' if L == 'en' else ','
    pc = '%' if L in ('en', 'pl', 'hu', 'uk', 'ru') else ' %'

    def btc(x):
        return ('%.1f' % x).replace('.', dec) + ' BTC'

    def money(x, step=1000):
        return F.eur(int(round(x / step) * step), L)
    d = ANSWER['date']
    if L in MONTH_GEN:
        y, m, dd = (int(x) for x in d.split('-'))
        date = '%d. %s %d' % (dd, MONTH_GEN[L][m - 1], y)
    else:
        date = F.date_str(d, L)
    falls = big_falls()
    if len(falls) != 4:   # the texts say "four times"; reword them in every <lang>.json, then change this
        sys.exit('%s: %d falls of 70%% or more in the data, the texts say four' % (L, len(falls)))
    yrs = [a[:4] if a[:4] == b[:4] else '%s–%s' % (a[:4], b[:4]) for a, b, _ in falls]
    v = {'price': F.eur(ANSWER['price'], L), 'date': date, 'age': str(ANSWER['age']), 'life': str(ANSWER['life']),
         'years': str(ANSWER['life'] - ANSWER['age'] + 1), 'infl': '%g%s' % (ANSWER['inflation'] * 100, pc),
         'flat30': btc(N['flat']), 'falls_years': ', '.join(yrs[:-1]) + ' %s %s' % (AND[L], yrs[-1])}
    for _, rate, k in SCEN:
        v['r_' + k] = '%d%s' % (rate, pc)
        v['one_' + k] = money(N['one'][k], 100)
        for s in ANSWER['spends']:
            n = N['need'][str(s)][k]
            v['n%d_%s' % (s // 1000, k)] = btc(n)
            v['e%d_%s' % (s // 1000, k)] = money(n * ANSWER['price'])
    for s in ANSWER['spends']:
        v['s%d' % (s // 1000)] = F.eur(s, L)
    return v


def fill(s, vals):
    """Replace {name} placeholders; an unknown name stops the build. JS strings ({0}) are not filled here."""
    return re.sub(r'\{([a-z][a-z0-9_]*)\}', lambda m: vals[m.group(1)], s)


def answer_section(L, t, v, links):
    """#how-much: direct answer, chart and table from the same numbers, assumptions, Verdict CTA."""
    N = answer_numbers()
    spends = ANSWER['spends']
    top = max(N['need'][str(s)][k] for s in spends for _, _, k in SCEN)
    ymax = int(-(-top // 5) * 5)   # next multiple of 5 BTC
    scen_lbl = {k: '%s %s' % (t['c_' + name], v['r_' + k]) for name, _, k in SCEN}
    key = ''.join('<span><i style="background:%s"></i>%s</span>' % (RAMP[k], scen_lbl[k]) for _, _, k in SCEN)
    ticks = ''.join('<div class="rq-tick" style="bottom:%g%%"><span>%d</span></div>' % (100.0 * y / ymax, y)
                    for y in range(0, ymax + 1, 5))
    cols, alt = '', []
    for s in spends:
        bars = ''
        for _, _, k in SCEN:
            n = N['need'][str(s)][k]
            lab = v['n%d_%s' % (s // 1000, k)]
            bars += '<span class="rq-bar" style="height:%.2f%%;background:%s" title="%s, %s: %s"></span>' % (
                100.0 * n / ymax, RAMP[k], v['s%d' % (s // 1000)], scen_lbl[k], lab)
        cols += '<div class="rq-col">%s</div>' % bars
        alt.append('%s: %s' % (v['s%d' % (s // 1000)], ', '.join('%s %s' % (scen_lbl[k], v['n%d_%s' % (s // 1000, k)]) for _, _, k in SCEN)))
    aria = fill(t['rq_chart_alt'], v) + ' ' + '; '.join(alt) + '.'
    xs = ''.join('<span>%s</span>' % v['s%d' % (s // 1000)] for s in spends)
    head = ''.join('<th scope="col"><i style="background:%s"></i>%s</th>' % (RAMP[k], scen_lbl[k]) for _, _, k in SCEN)
    rows = ''.join('<tr><th scope="row">%s</th>%s</tr>' % (v['s%d' % (s // 1000)], ''.join(
        '<td>%s<small>%s</small></td>' % (v['n%d_%s' % (s // 1000, k)], v['e%d_%s' % (s // 1000, k)]) for _, _, k in SCEN))
        for s in spends)
    return '''  <!-- 2. HOW MUCH BITCOIN DO I NEED TO RETIRE? (numbers from retirement-calc.js, see ANSWER in build_retirement.py) -->
  <section id="how-much">
    <div class="sec-head one"><div class="sec-copy"><h2>{h2a} <span>{h2b}</span></h2></div></div>
    <p class="rq-answer">{answer}</p>
    <div class="rq-wrap">
      <figure class="rq-card rq-fig">
        <h3>{chart_h}</h3>
        <div class="rq-key" aria-hidden="true">{key}</div>
        <div role="img" aria-label="{aria}">
          <div class="rq-plot">{ticks}<div class="rq-cols">{cols}</div></div>
          <div class="rq-x" aria-hidden="true">{xs}</div>
        </div>
        <figcaption class="rq-axis">{axis}</figcaption>
      </figure>
      <div class="rq-card">
        <h3>{table_h}</h3>
        <div class="rq-table-wrap"><table class="rq-table">
          <caption>{caption}</caption>
          <thead><tr><th scope="col">{col_spend}</th>{head}</tr></thead>
          <tbody>{rows}</tbody>
        </table></div>
        <p class="rq-note">{note}</p>
      </div>
    </div>
    <div class="rc-cta rq-cta">
      <p>{cta_text}</p>
      <a class="rc-link" href="{verdict}" data-cta="verdict">{cta}</a>
    </div>
  </section>

'''.format(h2a=t['rq_h2_a'], h2b=t['rq_h2_b'], answer=fill(t['rq_answer'], v), chart_h=t['rq_chart_h'], key=key,
           aria=esc(F.plain(aria)), ticks=ticks, cols=cols, xs=xs, axis=fill(t['rq_axis'], v), table_h=t['rq_table_h'],
           caption=fill(t['rq_caption'], v), col_spend=t['rq_col_spend'], head=head, rows=rows, note=fill(t['rq_note'], v),
           cta_text=t['rq_cta_text'], cta=t['rq_cta'], verdict=links['verdict'])


def steps_section(t, v, links):
    """How to retire on Bitcoin: five practical steps, no advice tone."""
    vals = dict(v, **{'href_' + k: x for k, x in links.items()})
    items = ''.join('\n      <li><h3>%s</h3><p>%s</p></li>' % (t['rs%d_t' % i], fill(t['rs%d_p' % i], vals)) for i in range(1, 6))
    return '''  <!-- 3. HOW TO RETIRE ON BITCOIN -->
  <section id="retire-steps">
    <div class="sec-head one"><div class="sec-copy"><h2>{a} <span>{b}</span></h2></div></div>
    <ol class="rq-steps">{items}
    </ol>
  </section>

'''.format(a=t['rs_h2_a'], b=t['rs_h2_b'], items=items)


def calculator(L, t, links):
    def money(key, label_key, hint=''):
        kind, val, lo, hi, smax, sstep = FIELDS[key]
        lab = t[label_key]
        return '''      <div class="rc-field">
        <div class="rc-head"><label for="rc-{k}">{lab}</label><input class="rc-num" id="rc-{k}" type="text" inputmode="decimal" autocomplete="off" value="{v}" data-kind="{kind}" data-min="{lo}" data-max="{hi}" aria-label="{lab}"></div>
        <input type="range" id="rc-{k}-r" min="0" max="{smax}" step="{sstep}" value="{v}" aria-label="{lab}">
        {hint}<p class="rc-err" id="rc-{k}-e" role="alert" hidden></p>
      </div>
'''.format(k=key, lab=lab, v=fmt_num(val), kind=kind, lo=lo, hi=hi, smax=smax, sstep=fmt_num(sstep), hint=hint)

    def age(key, label_key, lo, hi, v):
        lab = t[label_key]
        return '''      <div class="rc-field">
        <div class="rc-head"><label for="rc-{k}">{lab}</label><output id="rc-{k}-v" for="rc-{k}">{v}</output></div>
        <input type="range" id="rc-{k}" min="{lo}" max="{hi}" step="1" value="{v}" aria-label="{lab}">
      </div>
'''.format(k=key, lab=lab, lo=lo, hi=hi, v=v)

    pc = '&nbsp;%' if L in ('sk', 'cs', 'de', 'fr', 'es') else '%'   # same rule as v2common.PCT_SPACE

    def scen(key, rate, on):
        return '<button type="button" class="rc-btn" data-g="%s" aria-pressed="%s" aria-label="%s %d%s %s">%s %d%s<small>%s</small></button>' % (
            rate, 'true' if on else 'false', esc(t['c_' + key]), rate, pc, esc(t['c_hypothetical']), t['c_' + key], rate, pc, t['c_hypothetical'])
    scen_btns = scen('conservative', 10, False) + scen('base', 20, True) + scen('optimistic', 30, False) + \
        '<button type="button" class="rc-btn" data-g="custom" aria-pressed="false" aria-controls="rc-custom">%s<small>%s</small></button>' % (t['c_custom'], t['custom_range'])

    return '''<div class="pf-app st-app rc" id="plan">
    <form class="rc-panel" id="rc-form" novalidate onsubmit="return false">
      <h2>{plan}</h2>
{age}{ret}{life}{stack}{lump}{dca}{spend}      <div class="rc-field">
        <div class="rc-head"><span class="rc-lbl" id="rc-g-lbl">{growth}</span><output id="rc-g-v">20{pc}</output></div>
        <div class="rc-btns" role="group" aria-labelledby="rc-g-lbl">{scen}</div>
        <div class="rc-custom" id="rc-custom" hidden>
          <div class="rc-head"><label for="rc-gc">{custom_lbl}</label><input class="rc-num" id="rc-gc" type="text" inputmode="decimal" autocomplete="off" value="20" data-kind="pct" data-min="0" data-max="30" aria-label="{custom_lbl}"></div>
          <input type="range" id="rc-gc-r" min="0" max="30" step="1" value="20" aria-label="{custom_lbl}">
          <p class="rc-err" id="rc-gc-e" role="alert" hidden></p>
        </div>
      </div>
      <div class="rc-field">
        <div class="rc-head"><label for="rc-inf">{inf}</label><output id="rc-inf-v" for="rc-inf">2%</output></div>
        <input type="range" id="rc-inf" min="0" max="10" step="0.5" value="2" aria-label="{inf}">
        <p class="rc-hint"><a href="https://www.ecb.europa.eu/mopo/strategy/pricestab/html/index.en.html" target="_blank" rel="noopener">{inf_src}</a></p>
      </div>
      <div class="rc-field">
        <div class="rc-head"><label for="rc-price">{price}</label><input class="rc-num" id="rc-price" type="text" inputmode="decimal" autocomplete="off" value="{fb}" data-kind="eur" data-min="1" data-max="100000000" aria-label="{price}"></div>
        <p class="rc-hint" id="rc-price-note" aria-live="polite">{loading}</p>
        <p class="rc-err" id="rc-price-e" role="alert" hidden></p>
      </div>
    </form>

    <div class="rc-res">
      <div class="rc-verdict glow" id="rc-verdict" aria-live="polite"><i id="rc-icon" aria-hidden="true"></i><div><b id="rc-v-title">&hellip;</b><span id="rc-v-sub"></span></div></div>
      <div class="rc-grid" aria-live="polite">
        <div class="rc-box acc-teal glow"><p>{r_btc}</p><strong class="o" id="rc-r-btc">&hellip;</strong><small id="rc-r-btc-s"></small></div>
        <div class="rc-box acc-blue glow"><p>{r_val}</p><strong id="rc-r-val">&hellip;</strong><small>{r_val_s}</small></div>
        <div class="rc-box acc-yellow glow"><p>{r_sp}</p><strong id="rc-r-sp">&hellip;</strong><small id="rc-r-sp-s"></small></div>
        <div class="rc-box acc-purple glow"><p id="rc-r-need-l">{r_need}</p><strong class="o" id="rc-r-need">&hellip;</strong><small id="rc-r-need-s"></small></div>
      </div>
      <div class="rc-cfo" id="rc-cfo" hidden>
        <p><b>{cfo_lbl}</b><br>{cfo_text}</p>
        <a class="rc-link" href="{cfo_href}" data-cta="cfo">{cfo_link}</a>
      </div>
      <div class="rc-panel rc-chart">
        <h2>{chart}</h2>
        <div class="rc-legend"><span><i style="background:var(--c,var(--orange))"></i>{leg_acc}</span><span><i style="background:var(--text)"></i>{leg_ret}</span></div>
        <canvas id="rc-chart" role="img" aria-label="{chart_aria}"></canvas>
      </div>
      <p class="rc-simp">{simp} <a href="{tax_href}">{tax_link}</a></p>
{verdict_box}      <div class="rc-cta">
        <p>{cta_text}</p>
        <a class="rc-link" href="{pf_href}" data-cta="start-stacking">{cta}</a>
      </div>
    </div>
  </div>
'''.format(plan=t['c_plan'],
           age=age('age', 'c_age', 18, 75, 30), ret=age('ret', 'c_ret_age', 18, 85, 50), life=age('life', 'c_life', 60, 100, 85),
           stack=money('stack', 'c_stack'), lump=money('lump', 'c_lump', '<p class="rc-hint">%s</p>\n        ' % t['c_lump_note']),
           dca=money('dca', 'c_dca'), spend=money('spend', 'c_spend'),
           growth=t['c_growth'], scen=scen_btns, pc=pc, custom_lbl=t['c_custom_label'], inf=t['c_inflation'], inf_src=t['c_inflation_src'],
           price=t['c_price'], fb=FALLBACK_PRICE, loading=t['c_price_loading'],
           r_btc=t['c_res_btc'], r_val=t['c_res_value'], r_val_s=t['c_res_value_sub'], r_sp=t['c_res_spend'],
           r_need=t['c_res_needed'].replace('{0}', '50'),
           cfo_lbl=t['c_cfo_label'], cfo_text=t['c_cfo_text'], cfo_href=links['cfo'], cfo_link=t['c_cfo_link'],
           chart=t['c_chart'], leg_acc=t['c_legend_acc'], leg_ret=t['c_legend_ret'], chart_aria=esc(t['c_chart_aria']),
           simp=t['c_simplify'], tax_href=links['tax'], tax_link=t['c_tax_link'],
           cta_text=t['c_cta_text'], pf_href=links['pf'], cta=t['c_cta'],
           verdict_box=('''      <div class="rc-cta">
        <p>%s</p>
        <a class="rc-link" href="%s" data-cta="verdict">%s</a>
      </div>
''' % (t['rq_cta_text'], links['verdict'], t['rq_cta'])) if 'rq_cta' in t else '')


def build(L):
    jf = os.path.join(HERE, L + '.json')
    if not os.path.exists(jf):
        print('%s: no %s.json, page left as it is' % (L, L))
        return
    T = json.load(open(jf))
    Bt = json.load(open(os.path.join(TOOLS, 'bots', L + '.json')))
    T.update({x: v for x, v in Bt.items() if x.startswith('b_') or x == 'email'})
    t = T
    page = url(L)
    shell = os.path.join(SITE, page.lstrip('/'))

    alts = [(x, url(x)) for x in LANGS] + [('x-default', url('en'))]
    full = 'rq_h2_a' in t   # EN, SK, CS: the answer section, steps and Verdict CTAs; the rest: title, meta and FAQ
    v = answer_values(L, t)
    faq = [(fill(t['q_' + k], v), fill(t['a_' + k], v)) for k in FAQ_NEW if 'q_' + k in t] + \
          [(t['q%d' % i], t['a%d' % i]) for i in range(1, 5)]
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [
        F.crumbs_ld([(t['crumb_home'], '/' if L == 'en' else '/%s/' % L), (t['crumb_page'], page)]),
        {'@type': 'WebApplication', 'name': 'Bitcoin Retirement Calculator', 'url': ORIGIN + page, 'inLanguage': L, 'applicationCategory': 'FinanceApplication',
         'operatingSystem': 'Web', 'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'},
         'publisher': {'@id': ORIGIN + '/#org'}, 'dateModified': '2026-11-16' if 'q_much' in t else '2026-10-13'},
        F.faq_ld([(F.plain(q), F.plain(a)) for q, a in faq])]}
    out = F.head(L, t['title'], t['description'], page, alts, ld, og_title=t['og_title'], og_alt=t['og_title'], title_max=70,
                 og_image=ORIGIN + '/og/retirement-calculator.jpg')
    # CSP: C.finalize() keeps only the third-party origins this page uses.
    assert 'https://api.coingecko.com' in out
    css = CSS if full else re.sub(r'\s*\.rq-wrap \{[^}]*\}', '', '\n'.join(
        x for x in CSS.split('\n') if '.rq-' not in x.split('{')[0] and 'How much Bitcoin' not in x and '.rc-q {' not in x))
    out = out.replace('</head>', css + '</head>', 1)
    nav, foot = F.chrome(L, url, comma=False)
    nav = re.sub(r'(<a href="%s")' % re.escape(page), r'\1 aria-current="page"', nav, count=1)

    loc = lambda p: ('/' if L == 'en' else '/%s/' % L) + p
    def page_url(p):   # the language's own page when it exists
        return loc(p) if L == 'en' or os.path.exists(os.path.join(SITE, L, p)) else '/' + p
    tax = '/bitcoin-tax/' if L == 'en' else '/%s/%s/' % (L, B.GUIDES[L][0])
    dca = '/bitcoin-dca-calculator/' if L == 'en' else '/%s/%s/' % (L, B.GUIDES[L][2])
    links = {
        'tax': tax,
        'cfo': page_url('cfo.html') + '?utm_source=retirement&utm_medium=cta&utm_campaign=cfo#waitForm',
        'pf': page_url('concierge.html') + '?utm_source=retirement&utm_medium=cta&utm_campaign=start-stacking',
        'verdict': page_url('verdict.html') + '?utm_source=retirement&utm_medium=cta&utm_campaign=verdict',
        'dca': dca, 'secure': page_url('secure.html'), 'returns': page_url('btc-monthly-returns.html'), 'plan': '#plan',
        'tax_home': {'en': '/bitcoin-tax/', 'sk': '/sk/bitcoin-dane/slovensko/', 'cs': '/cs/bitcoin-dane/cesko/'}.get(L, tax),
    }
    assert os.path.isdir(os.path.join(SITE, links['tax_home'].strip('/')))

    steps = ''.join('''      <div class="how-log-item">
        <div class="how-log-marker"><span class="how-log-dot"></span></div>
        <div class="how-log-body">
          <span class="how-log-num">{step} 0{i}</span>
          <h3>{tt}</h3>
          <p>{pp}</p>
        </div>
      </div>
'''.format(step=t['step'], i=i, tt=t['s%d_t' % i], pp=t['s%d_p' % i]) for i in range(1, 4))
    faq_html = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (' open' if i == 0 else '', esc(q).replace('&#x27;', "'"), a) for i, (q, a) in enumerate(faq))
    rcards = related_hubs.cards_html(L, 'retirement')   # Bod B map: stacking, Bitcoin Data, Brief, Partner Finder

    strings = {k: v for k, v in t.items() if k.startswith('c_')}
    i18n = json.dumps(strings, ensure_ascii=False).replace('</', '<\\/')

    out += '''<body class="page-buy page-fee page-pf page-stack page-ret no-split">
{nav}

<main class="wrap bd-v3 bd-acc-teal" id="top">

  <!-- 1. HERO + the calculator -->
  <div class="buy-hero2 pf-hero">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    {h1}
    <p class="sp-lead">{lead}</p>
  </div>
  <noscript><p class="pf-noscript">{noscript}</p></noscript>
  {calc}
{answer}{rsteps}  <!-- 4. HOW IT WORKS -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log">
{steps}    </div>
  </section>

  <!-- 5. FAQ -->
  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{qh2a} <span>{qh2b}</span></h2></div></div>
    {faq}
  </section>

  <!-- 6. BRIEF -->
  {brief}

  <!-- 7. RELATED TOOLS -->
  <section id="related">
    <div class="sec-head one"><div class="sec-copy"><h2>{rh2a} <span>{rh2b}</span></h2></div></div>
    <div class="gcards">{rcards}</div>
    <p class="tx-fine fi-disc">{disclaimer}</p>
  </section>

  {foot}
</main>

<script type="application/json" id="rc-i18n">{i18n}</script>
'''.format(nav=nav, eyebrow=t['eyebrow'], lead=t['lead'], noscript=t['noscript'], calc=calculator(L, t, links),
           # with the answer section the question is part of the H1 (search intent); otherwise a line under it as before
           h1=('<h1>%s <span class="rc-q">%s</span></h1>' if full else '<h1>%s</h1>\n    <p class="rc-q">%s</p>') % (t['h1'], t['h1_q']),
           answer=answer_section(L, t, v, links) if full else '', rsteps=steps_section(t, v, links) if full else '',
           hh2a=t['how_h2_a'], hh2b=t['how_h2_b'], steps=steps, qh2a=t['faq_h2_a'], qh2b=t['faq_h2_b'], faq=faq_html,
           brief=F.brief_card(L, t, 'retirement_brief'), rh2a=related_hubs.heading(L)[0], rh2b=related_hubs.heading(L)[1], rcards=rcards, disclaimer=t['disclaimer'],
           foot=foot, i18n=i18n)
    # Bitcoin Data v3 accent system (handover 2026-10-25): accent = this page's card on the hub; newer site-v2 css/js
    sc = C.scripts('/')   # css/js cache-busters: one sitewide value, set in C.finalize (speed.py)
    out += sc.replace('<script src="/site-v2.js', '<script src="/retirement-calc.js?v=%s" defer></script>\n<script src="/site-v2.js' % JS_V, 1)
    F.check_text(out, L)
    check_dashes(out, strings, L)
    open(shell, 'w').write(C.finalize(out, shell))
    print('%-34s %6d bytes' % (page, len(out)))


def check_dashes(out, strings, where):
    """No en/em dash in our visible text, title, meta or the calculator strings (the shared nav/footer are the homepage's)."""
    own = re.sub(r'<header class="nav">.*?</header>|<footer\b.*?</footer>|<script type="application/ld\+json">.*?</script>', '', out, flags=re.S)
    own = re.sub(r'<script\b[^>]*src=[^>]*></script>', '', own)
    own = re.sub(r'(?<=\d)–(?=\d)', '', own)   # a number range (0–30 %) is not a dash in prose
    vals = [re.sub(r'(?<=\d)–(?=\d)', '', v) for v in strings.values()]
    for ch in ('—', '–', '&mdash;', '&ndash;'):
        if ch in own or any(ch in v for v in vals):
            sys.exit('%s: dash %r in page text or calculator strings' % (where, ch))


def main():
    for L in sys.argv[1:] or LANGS:
        build(L)


if __name__ == '__main__':
    main()
