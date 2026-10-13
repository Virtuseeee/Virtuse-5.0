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
import html, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
import build_fee_index as F
C, B, SITE, ORIGIN = F.C, F.B, F.SITE, F.ORIGIN
LANGS = ['en', 'sk', 'cs', 'uk', 'ru', 'de', 'fr', 'es', 'pl', 'hu']   # hreflang order as before
JS_V = '1'
FALLBACK_PRICE = 74649          # BTC/EUR, 13 Oct 2026 (CoinGecko); the JS replaces it with the live price

# typed limits (data-min/max) and the smaller slider ranges
FIELDS = {
    #          kind   default  min  max        slider max   slider step
    'stack': ('btc', 0.1,      0,   1000,      10,          0.01),
    'lump':  ('eur', 0,        0,   5000000,   1000000,     10000),
    'dca':   ('eur', 250,      0,   100000,    5000,        50),
    'spend': ('eur', 60000,    0,   1000000,   300000,      1000),
}

CSS = '''<style>
.pf-hero .rc-q{font-size:clamp(22px,3.2vw,34px);line-height:1.2;font-weight:600;letter-spacing:-.02em;color:var(--btc-orange,#f7931a);margin:12px auto 0;max-width:760px}
/* RETIREMENT CALCULATOR (static calculator, logic in /retirement-calc.js) */
.rc [hidden] { display: none !important; }
.rc { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: 20px; align-items: start; text-align: left; }
.rc-panel { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 22px; min-width: 0; }
.rc-panel h2 { font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
.rc-field { padding: 12px 0; border-top: 1px solid var(--line); }
.rc-field:first-of-type { border-top: 0; padding-top: 0; }
.rc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.rc-head label, .rc-lbl { font-size: 14px; color: var(--text); }
.rc-head output { font: 600 14px var(--sans); color: var(--orange); white-space: nowrap; }
.rc-num { width: 132px; flex: none; background: var(--inset); color: var(--orange); border: 1px solid var(--line-strong); border-radius: 8px; padding: 8px 10px; font: 600 14px var(--sans); text-align: right; }
.rc-num:focus { border-color: var(--orange); outline: none; }
.rc input[type=range] { width: 100%; margin: 12px 0 2px; accent-color: var(--orange); height: 18px; }
.rc-hint { margin: 6px 0 0; font-size: 12px; color: var(--dim); line-height: 1.45; }
.rc-hint a { color: var(--muted); }
.rc-err { margin: 6px 0 0; font-size: 12px; color: #f0883e; }
.rc-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.rc-btn { background: transparent; color: var(--text); border: 1px solid var(--line-strong); border-radius: 10px; padding: 9px 10px; font: 500 13px var(--sans); cursor: pointer; text-align: left; line-height: 1.3; }
.rc-btn small { display: block; color: var(--dim); font-size: 11px; }
.rc-btn:hover { background: var(--card-hover); }
.rc-btn[aria-pressed=true] { background: var(--orange); border-color: var(--orange); color: #0d0902; }
.rc-btn[aria-pressed=true] small { color: #3a2506; }
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
.rc-box strong.o { color: var(--orange); }
.rc-box small { display: block; margin-top: 4px; font-size: 12px; color: var(--dim); }
.rc-cfo, .rc-cta { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: var(--card); border: 1px solid var(--line-strong); border-radius: 16px; padding: 18px 20px; }
.rc-cfo p, .rc-cta p { margin: 0; font-size: 14px; line-height: 1.5; min-width: 0; }
.rc-cfo b { font-weight: 600; }
.rc-link { flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--line-strong); border-radius: 10px; padding: 10px 16px; font: 600 14px var(--sans); color: var(--text); text-decoration: none; white-space: nowrap; }
.rc-link:hover { background: var(--card-hover); border-color: rgba(255,255,255,.3); }
.rc-chart canvas { display: block; width: 100%; height: 280px; }
.rc-legend { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin: -4px 0 10px; }
.rc-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.rc-simp { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.55; }
.rc-simp a { color: var(--text); }
@media (max-width: 900px) { .rc { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 520px) {
  .rc-panel { padding: 18px; }
  .rc-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
  .rc-box { padding: 14px; } .rc-box strong { font-size: 18px; }
  .rc-cfo, .rc-cta { flex-direction: column; align-items: stretch; }
  .rc-num { width: 116px; }
  .rc-chart canvas { height: 240px; }
}
</style>
'''


def url(L):
    return '/retirement-calculator.html' if L == 'en' else '/%s/retirement-calculator.html' % L


def esc(s):
    return html.escape(s, quote=True)


def fmt_num(n):
    return ('%g' % n) if isinstance(n, float) else str(n)


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

    def scen(key, rate, on):
        return '<button type="button" class="rc-btn" data-g="%s" aria-pressed="%s" aria-label="%s %d%% %s">%s %d%%<small>%s</small></button>' % (
            rate, 'true' if on else 'false', esc(t['c_' + key]), rate, esc(t['c_hypothetical']), t['c_' + key], rate, t['c_hypothetical'])
    scen_btns = scen('conservative', 10, False) + scen('base', 20, True) + scen('optimistic', 30, False) + \
        '<button type="button" class="rc-btn" data-g="custom" aria-pressed="false" aria-controls="rc-custom">%s<small>0 to 30%%</small></button>' % t['c_custom']

    return '''<div class="pf-app st-app rc" id="plan">
    <form class="rc-panel" id="rc-form" novalidate onsubmit="return false">
      <h2>{plan}</h2>
{age}{ret}{life}{stack}{lump}{dca}{spend}      <div class="rc-field">
        <div class="rc-head"><span class="rc-lbl" id="rc-g-lbl">{growth}</span><output id="rc-g-v">20%</output></div>
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
      <div class="rc-verdict" id="rc-verdict" aria-live="polite"><i id="rc-icon" aria-hidden="true"></i><div><b id="rc-v-title">&hellip;</b><span id="rc-v-sub"></span></div></div>
      <div class="rc-grid" aria-live="polite">
        <div class="rc-box"><p>{r_btc}</p><strong class="o" id="rc-r-btc">&hellip;</strong><small id="rc-r-btc-s"></small></div>
        <div class="rc-box"><p>{r_val}</p><strong id="rc-r-val">&hellip;</strong><small>{r_val_s}</small></div>
        <div class="rc-box"><p>{r_sp}</p><strong id="rc-r-sp">&hellip;</strong><small id="rc-r-sp-s"></small></div>
        <div class="rc-box"><p id="rc-r-need-l">{r_need}</p><strong class="o" id="rc-r-need">&hellip;</strong><small id="rc-r-need-s"></small></div>
      </div>
      <div class="rc-cfo" id="rc-cfo" hidden>
        <p><b>{cfo_lbl}</b><br>{cfo_text}</p>
        <a class="rc-link" href="{cfo_href}" data-cta="cfo">{cfo_link}</a>
      </div>
      <div class="rc-panel rc-chart">
        <h2>{chart}</h2>
        <div class="rc-legend"><span><i style="background:var(--orange)"></i>{leg_acc}</span><span><i style="background:var(--text)"></i>{leg_ret}</span></div>
        <canvas id="rc-chart" role="img" aria-label="{chart_aria}"></canvas>
      </div>
      <p class="rc-simp">{simp} <a href="{tax_href}">{tax_link}</a></p>
      <div class="rc-cta">
        <p>{cta_text}</p>
        <a class="rc-link" href="{pf_href}" data-cta="start-stacking">{cta}</a>
      </div>
    </div>
  </div>
'''.format(plan=t['c_plan'],
           age=age('age', 'c_age', 18, 75, 30), ret=age('ret', 'c_ret_age', 18, 85, 50), life=age('life', 'c_life', 60, 100, 85),
           stack=money('stack', 'c_stack'), lump=money('lump', 'c_lump', '<p class="rc-hint">%s</p>\n        ' % t['c_lump_note']),
           dca=money('dca', 'c_dca'), spend=money('spend', 'c_spend'),
           growth=t['c_growth'], scen=scen_btns, custom_lbl=t['c_custom_label'], inf=t['c_inflation'], inf_src=t['c_inflation_src'],
           price=t['c_price'], fb=FALLBACK_PRICE, loading=t['c_price_loading'],
           r_btc=t['c_res_btc'], r_val=t['c_res_value'], r_val_s=t['c_res_value_sub'], r_sp=t['c_res_spend'],
           r_need=t['c_res_needed'].replace('{0}', '50'),
           cfo_lbl=t['c_cfo_label'], cfo_text=t['c_cfo_text'], cfo_href=links['cfo'], cfo_link=t['c_cfo_link'],
           chart=t['c_chart'], leg_acc=t['c_legend_acc'], leg_ret=t['c_legend_ret'], chart_aria=esc(t['c_chart_aria']),
           simp=t['c_simplify'], tax_href=links['tax'], tax_link=t['c_tax_link'],
           cta_text=t['c_cta_text'], pf_href=links['pf'], cta=t['c_cta'])


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
    faq = [(t['q%d' % i], t['a%d' % i]) for i in range(1, 5)]
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [
        F.crumbs_ld([(t['crumb_home'], '/' if L == 'en' else '/%s/' % L), (t['crumb_page'], page)]),
        {'@type': 'WebApplication', 'name': 'Bitcoin Retirement Calculator', 'url': ORIGIN + page, 'inLanguage': L, 'applicationCategory': 'FinanceApplication',
         'operatingSystem': 'Web', 'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'},
         'publisher': {'@id': ORIGIN + '/#org'}, 'dateModified': '2026-10-13'},
        F.faq_ld([(F.plain(q), F.plain(a)) for q, a in faq])]}
    out = F.head(L, t['title'], t['description'], page, alts, ld, og_title=t['og_title'], og_alt=t['og_title'], title_max=70,
                 og_image=ORIGIN + '/og/retirement-calculator.jpg')
    # This page loads nothing from cdn.jsdelivr.net (site-v2.js's Brief chart still needs api.binance.com).
    assert out.count(' https://cdn.jsdelivr.net') == 1
    out = out.replace(' https://cdn.jsdelivr.net', '', 1)
    assert 'https://api.coingecko.com' in out
    out = out.replace('</head>', CSS + '</head>', 1)
    nav, foot = F.chrome(L, url)
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
    }

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
    rel = [(dca, 'rel_dca'), (page_url('stacking.html'), 'rel_stack'), (page_url('concierge.html'), 'rel_pf'), (tax, 'rel_tax'),
           (page_url('cfo.html'), 'rel_cfo'), (page_url('bitcoin-data.html'), 'rel_data')]
    rcards = ''.join('<a class="gcard" href="%s"><b>%s</b><span>%s</span></a>' % (u, t[x + '_t'], t[x + '_p']) for u, x in rel)

    strings = {k: v for k, v in t.items() if k.startswith('c_')}
    i18n = json.dumps(strings, ensure_ascii=False).replace('</', '<\\/')

    out += '''<body class="page-buy page-fee page-pf page-stack page-ret no-split">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO + the calculator -->
  <div class="buy-hero2 pf-hero">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1}</h1>
    <p class="rc-q">{h1o}</p>
    <p class="sp-lead">{lead}</p>
  </div>
  <noscript><p class="pf-noscript">{noscript}</p></noscript>
  {calc}
  <!-- 2. HOW IT WORKS -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log">
{steps}    </div>
  </section>

  <!-- 3. FAQ -->
  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{qh2a} <span>{qh2b}</span></h2></div></div>
    {faq}
  </section>

  <!-- 4. BRIEF -->
  {brief}

  <!-- 5. RELATED TOOLS -->
  <section id="related">
    <div class="sec-head one"><div class="sec-copy"><h2>{rh2a} <span>{rh2b}</span></h2></div></div>
    <div class="gcards">{rcards}</div>
    <p class="tx-fine fi-disc">{disclaimer}</p>
  </section>

  {foot}
</main>

<script type="application/json" id="rc-i18n">{i18n}</script>
'''.format(nav=nav, eyebrow=t['eyebrow'], h1=t['h1'], h1o=t['h1_q'], lead=t['lead'], noscript=t['noscript'], calc=calculator(L, t, links),
           hh2a=t['how_h2_a'], hh2b=t['how_h2_b'], steps=steps, qh2a=t['faq_h2_a'], qh2b=t['faq_h2_b'], faq=faq_html,
           brief=F.brief_card(L, t, 'retirement_brief'), rh2a=t['rel_h2_a'], rh2b=t['rel_h2_b'], rcards=rcards, disclaimer=t['disclaimer'],
           foot=foot, i18n=i18n)
    sc = C.scripts('/').replace('site-v2.js?v=5', 'site-v2.js?v=6')
    out += sc.replace('<script src="/site-v2.js', '<script src="/retirement-calc.js?v=%s" defer></script>\n<script src="/site-v2.js' % JS_V, 1)
    F.check_text(out, L)
    check_dashes(out, strings, L)
    open(shell, 'w').write(out)
    print('%-34s %6d bytes' % (page, len(out)))


def check_dashes(out, strings, where):
    """No en/em dash in our visible text, title, meta or the calculator strings (the shared nav/footer are the homepage's)."""
    own = re.sub(r'<header class="nav">.*?</header>|<footer\b.*?</footer>|<script type="application/ld\+json">.*?</script>', '', out, flags=re.S)
    own = re.sub(r'<script\b[^>]*src=[^>]*></script>', '', own)
    for ch in ('—', '–', '&mdash;', '&ndash;'):
        if ch in own or any(ch in v for v in strings.values()):
            sys.exit('%s: dash %r in page text or calculator strings' % (where, ch))


def main():
    for L in sys.argv[1:] or LANGS:
        build(L)


if __name__ == '__main__':
    main()
