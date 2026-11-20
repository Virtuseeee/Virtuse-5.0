#!/usr/bin/env python3
"""Build the Bitcoin tax calculator (bitcoin-tax-calculator.html, EN + SK, design v2).

usage: python3 build_tax_calculator.py [en sk]

Rules:  seo-build/data/tax-rules.json (numbers the calculator uses), checked here against
        seo-build/data/tax-sources.json (official source + quote per country): a rate in the
        rules that is not in the sourced text stops the build.
Logic:  /tax-calc.js (shared, also run by tax-calc.test.mjs in Node).
Texts:  <lang>.json next to this file; the country table reuses tax-sources.json (EN) and
        seo-build/data/meta.json taxSk (SK), the same texts as the /bitcoin-tax/ guides.
Until a tax adviser has reviewed every country the page is noindex and not in the sitemap (REVIEWED).
"""
import html, json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
import build_fee_index as F
import related_hubs
C, B, SITE, ORIGIN = F.C, F.B, F.SITE, F.ORIGIN
REPO = os.path.dirname(SITE)
LANGS = ['en', 'sk']
JS_V = '2'
REVIEWED = False   # True once the tax adviser has signed off all 13 countries: index + sitemap
DEFAULT = {'en': 'de', 'sk': 'sk'}
ORDER = ['sk', 'cz', 'pl', 'hu', 'at', 'de', 'si', 'hr', 'ro', 'bg', 'nl', 'fr', 'es']
FIELDS = {'proceeds': 20000, 'cost': 10000, 'other': 30000, 'invested': 10000}

CSS = '''<style>
/* BITCOIN TAX CALCULATOR: one Services-style panel (.hpanel), logic in /tax-calc.js */
.tc [hidden] { display: none !important; }
.tc-form { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 20px 16px; }
.tc-f { grid-column: span 2; min-width: 0; display: flex; flex-direction: column; }
.tc-f.w3 { grid-column: span 3; }
.tc-f.w6 { grid-column: 1 / -1; }
.tc-set { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; gap: 20px 16px; }
.tc-f label, .tc-f .tc-lbl { font: 500 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--dim); margin-bottom: 8px; }
.tc-in, .tc-sel { width: 100%; height: 48px; background: rgba(255,255,255,.04); color: var(--text); border: 1px solid var(--line-strong); border-radius: 12px; padding: 0 14px; font: 600 16px var(--sans); font-variant-numeric: tabular-nums; }
.tc-in[type=date], .tc-in[type=month] { color-scheme: dark; }
.tc-sel { appearance: none; -webkit-appearance: none; padding-right: 40px; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%238b949e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; background-size: 16px; }
.tc-sel option { background: #141414; color: #e6edf3; }
.tc-in:focus, .tc-sel:focus { border-color: var(--c, var(--orange)); outline: none; }
.tc-euro { position: relative; }
.tc-euro .tc-in { padding-right: 34px; }
.tc-euro::after { content: "€"; position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--dim); font-weight: 600; pointer-events: none; }
.tc-hint { margin: 8px 0 0; font-size: 12px; color: var(--dim); line-height: 1.45; }
.tc-f .seg { margin: 0; align-self: flex-start; max-width: 100%; height: 48px; align-items: center; }
.tc-est { grid-column: 1 / -1; margin: -4px 0 0; font-size: 14px; line-height: 1.5; color: var(--muted); min-height: 21px; }
.tc-err { grid-column: 1 / -1; margin: 0; font-size: 13px; color: #f0883e; }
.tc-out { margin-top: 28px; padding-top: 28px; border-top: 1px solid rgba(255,255,255,.06); display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 24px 40px; align-items: end; transition: opacity .15s; }
.tc-out.off, .tc-out.off ~ * { opacity: .35; }
.tc-big p { margin: 0; font: 500 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--dim); }
.tc-big strong { display: block; margin-top: 8px; font-size: clamp(40px, 6vw, 60px); font-weight: 600; line-height: 1; letter-spacing: -.02em; color: var(--c, var(--orange)); font-variant-numeric: tabular-nums; }
.tc-big span { display: block; margin-top: 12px; font-size: 14px; line-height: 1.5; color: var(--muted); }
.tc-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.tc-stats div { border-left: 1px solid rgba(255,255,255,.08); padding-left: 14px; min-width: 0; }
.tc-stats p { margin: 0; font: 500 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--dim); }
.tc-stats strong { display: block; margin-top: 6px; font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.tc-more { margin-top: 24px; display: grid; gap: 8px; }
.tc-more details { border: 1px solid rgba(255,255,255,.06); border-radius: 12px; background: rgba(255,255,255,.02); }
.tc-more summary { cursor: pointer; list-style: none; padding: 14px 16px; font-size: 14px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.tc-more summary::-webkit-details-marker { display: none; }
.tc-more summary::after { content: "+"; color: var(--muted); font-size: 18px; font-weight: 400; }
.tc-more details[open] summary::after { content: "\\2212"; }
.tc-more .tc-body { padding: 0 16px 16px; }
.tc-work { width: 100%; border-collapse: collapse; font-size: 14px; }
.tc-work th, .tc-work td { padding: 9px 0; border-top: 1px solid rgba(255,255,255,.06); text-align: left; font-weight: 400; color: var(--muted); }
.tc-work td { text-align: right; white-space: nowrap; color: var(--text); font-variant-numeric: tabular-nums; padding-left: 12px; }
.tc-work tr.sum th, .tc-work tr.sum td { color: var(--text); font-weight: 600; border-top-color: var(--line-strong); }
.tc-notes { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.55; color: var(--muted); }
.tc-notes li + li { margin-top: 6px; }
.tc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin: 16px 0 0; font-size: 13px; color: var(--muted); }
.tc-meta a { color: var(--text); }
.tc-rev { display: inline-block; border-radius: 999px; padding: 4px 10px; font: 600 11px/1 var(--sans); white-space: nowrap; }
.tc-rev.y { color: #3fb950; background: rgba(63,185,80,.12); border: 1px solid rgba(63,185,80,.35); }
.tc-rev.n { color: #f0883e; background: rgba(240,136,62,.10); border: 1px solid rgba(240,136,62,.30); }
/* comparison: the same sale in 13 countries */
.tc-cmp-w { margin-top: 32px; padding-top: 28px; border-top: 1px solid rgba(255,255,255,.06); }
.tc-cmp-w h2 { margin: 6px 0 18px; font-size: 20px; font-weight: 600; letter-spacing: -.01em; }
.tc-k { font: 500 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--c, var(--orange)); }
.tc-cmp-row { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1.2fr) 96px 110px; gap: 16px; align-items: center; min-height: 52px; padding: 8px 10px; border-top: 1px solid rgba(255,255,255,.06); }
.tc-cmp-row.head { min-height: 0; padding: 0 10px 10px; border-top: 0; font: 500 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--dim); }
.tc-cmp-row.head span:nth-child(n+3) { text-align: right; }
.tc-cmp-row.home { background: color-mix(in srgb, var(--c, #5faede) 9%, transparent); border-radius: 12px; border-top-color: transparent; }
.tc-cmp-row.home + .tc-cmp-row { border-top-color: transparent; }
.tc-cmp-n b { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 15px; font-weight: 600; }
.tc-cmp-n small { display: block; font-size: 12px; color: var(--muted); }
.tc-you { font: 600 11px/1 var(--sans); color: var(--c, #5faede); border: 1px solid color-mix(in srgb, var(--c, #5faede) 45%, transparent); border-radius: 999px; padding: 4px 8px; }
.tc-cmp-bar { height: 8px; border-radius: 999px; background: rgba(255,255,255,.05); overflow: hidden; }
.tc-cmp-bar i { display: block; height: 100%; min-width: 0; border-radius: 999px; background: rgba(255,255,255,.28); }
.tc-cmp-row.home .tc-cmp-bar i { background: var(--c, #5faede); }
.tc-cmp-t, .tc-cmp-k { text-align: right; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
.tc-cmp-k { color: var(--muted); font-weight: 500; }
/* rules: one row per country, details on demand */
.tc-rules { display: grid; gap: 8px; text-align: left; }
.tc-rule { background: #141414; border: 1px solid rgba(255,255,255,.06); border-radius: 14px; }
.tc-rule summary { cursor: pointer; list-style: none; display: grid; grid-template-columns: 150px minmax(0, 1fr) auto 18px; gap: 16px; align-items: center; padding: 16px 20px; }
.tc-rule summary::-webkit-details-marker { display: none; }
.tc-rule summary::after { content: "+"; color: var(--muted); font-size: 18px; text-align: right; }
.tc-rule[open] summary::after { content: "\\2212"; }
.tc-rule summary b { font-size: 15px; font-weight: 600; }
.tc-rule summary span.r { font-size: 14px; color: var(--muted); }
.tc-rule dl { margin: 0; padding: 4px 20px 18px; display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px 16px; font-size: 14px; line-height: 1.5; }
.tc-rule dt { font: 500 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--dim); padding-top: 3px; }
.tc-rule dd { margin: 0; color: var(--muted); }
.tc-rule dd a { color: var(--text); }
.tc-lead { margin: 0 0 20px; max-width: 760px; font-size: 16px; line-height: 1.6; color: var(--muted); text-align: left; }
@media (max-width: 760px) {
  .hpanel.tc { padding: 24px 18px; }
  .tc-f, .tc-f.w3 { grid-column: 1 / -1; }
  .tc-out { grid-template-columns: minmax(0, 1fr); }
  .tc-cmp-row { grid-template-columns: minmax(0, 1fr) 84px; padding: 8px; }
  .tc-cmp-bar, .tc-cmp-k, .tc-cmp-row.head span:nth-child(2), .tc-cmp-row.head span:nth-child(4) { display: none; }
  .tc-rule summary { grid-template-columns: minmax(0, 1fr) auto 18px; gap: 10px; padding: 14px 16px; }
  .tc-rule summary span.r { grid-column: 1 / -1; grid-row: 2; }
  .tc-rule dl { grid-template-columns: minmax(0, 1fr); gap: 2px; padding: 0 16px 16px; }
  .tc-rule dd { margin-bottom: 10px; }
  .tc-f .seg { height: auto; }
}
@media (max-width: 420px) { .tc-stats { grid-template-columns: minmax(0, 1fr); } .tc-stats div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-left: 0; padding: 8px 0 0; border-top: 1px solid rgba(255,255,255,.06); } .tc-stats strong { margin: 0; } }
</style>
'''


def url(L):
    return '/bitcoin-tax-calculator.html' if L == 'en' else '/%s/bitcoin-tax-calculator.html' % L


def lang_url(x):
    return url(x) if x in LANGS else ('/' if x == 'en' else '/%s/' % x)


def esc(s):
    return html.escape(s, quote=True)


def nbsp(s, L):
    """Slovak: no-break space before % and € after a number (site rule, v2common.PCT_SPACE)."""
    if L != 'sk':
        return s
    return re.sub(r'(\d) (%|€|Kč|CZK|PLN|lei)', '\\1\u00a0\\2', s)


def date_text(d, L):
    y, m, dd = (int(x) for x in d.split('-'))
    if L == 'sk':
        return '%d. %d. %d' % (dd, m, y)
    return F.date_str(d, L)


def check_rules(rules, sources):
    """Every rate the calculator uses must appear in the sourced gain-tax text."""
    for c in sources['countries']:
        r = rules['countries'].get(c['id'])
        if not r:
            sys.exit('tax-rules.json: no rule for %s' % c['id'])
        t = c['fields']['gainTax']['text']
        rates = [r['rate']] if r['kind'] == 'flat' else [r['bands'][0][1], r['bands'][-1][1]] if r['kind'] == 'bands' else [45] if r['kind'] == 'de' else []
        for x in rates:
            if ('%g%%' % x) not in t and ('%g' % x) not in t:
                sys.exit('%s: rate %g not in tax-sources.json text "%s"' % (c['id'], x, t))
    if set(rules['countries']) != {c['id'] for c in sources['countries']}:
        sys.exit('tax-rules.json and tax-sources.json list different countries')


def table(L, t, sources, meta, rules):
    names = {c['id']: c['name'] for c in sources['countries']} if L == 'en' else meta['names']['sk']
    by = {c['id']: c for c in sources['countries']}
    rows = []
    for cid in ORDER:
        c, r = by[cid], rules['countries'][cid]
        if L == 'en':
            f = {k: c['fields'][k]['text'] for k in ('gainTax', 'exemption', 'filing')}
            if 'healthLevy' in c['fields']:
                f['gainTax'] += '; ' + c['fields']['healthLevy']['text']
            guide = '/bitcoin-tax/%s/' % meta['slugs']['en'][cid]
        else:
            f = {k: meta['taxSk'][cid][k] for k in ('gainTax', 'exemption', 'filing')}
            guide = '/sk/bitcoin-dane/%s/' % meta['slugs']['sk'][cid]
        assert os.path.isdir(os.path.join(SITE, guide.strip('/'))), guide
        g = c['fields']['gainTax']
        rows.append('''<details class="tc-rule" data-c="{id}"><summary><b>{name}</b><span class="r">{rate}</span><span class="tc-rev {cls}">{rv}</span></summary>
      <dl><dt>{le}</dt><dd>{ex}</dd><dt>{lf}</dt><dd>{fi}</dd>
      <dt>{ls}</dt><dd><a href="{src}" target="_blank" rel="noopener">{st}</a></dd><dt>{lg}</dt><dd><a href="{guide}">{name}</a></dd></dl></details>'''.format(
            id=cid, name=esc(names[cid]), guide=guide, le=t['rule_exempt'], lf=t['rule_filing'], ls=t['rule_source'], lg=t['rule_guide'],
            rate=esc(nbsp(f['gainTax'], L)), ex=esc(nbsp(f['exemption'], L)), fi=esc(nbsp(f['filing'], L)), src=esc(g['source']),
            st=esc(re.split(r':| \(| – ', g['sourceTitle'])[0]), cls='y' if r['reviewed'] else 'n',
            rv=t['review_yes'] if r['reviewed'] else t['review_no']))
    return '<div class="tc-rules" id="tc-table">\n    %s\n    </div>' % '\n    '.join(rows)


def calculator(L, t, names):
    def money(k, w=''):
        return '''<div class="tc-f{w}"><label for="tc-{k}">{lab}</label>
          <span class="tc-euro"><input class="tc-in" id="tc-{k}" type="text" inputmode="decimal" autocomplete="off" value="{v}" aria-describedby="tc-{k}-h"></span>
          <p class="tc-hint" id="tc-{k}-h">{hint}</p></div>'''.format(k=k, w=w, lab=t['c_' + k], v=FIELDS[k], hint=t['c_%s_hint' % k])
    opts = ''.join('<option value="%s"%s>%s</option>' % (c, ' selected' if c == DEFAULT[L] else '', esc(names[c]))
                   for c in sorted(ORDER, key=lambda c: names[c]))
    return '''<div class="hpanel blue tc" id="calc">
      <form class="tc-form" id="tc-form" data-order='{order}' novalidate onsubmit="return false">
        <div class="tc-f w3"><label for="tc-country">{country}</label>
          <select class="tc-sel" id="tc-country">{opts}</select></div>
        <div class="tc-f w3"><span class="tc-lbl" id="tc-mode-l">{mode_label}</span>
          <div class="seg" id="tc-mode" role="group" aria-labelledby="tc-mode-l"><button type="button" class="seg-btn on" data-mode="exact" aria-pressed="true">{mode_exact}</button><button type="button" class="seg-btn" data-mode="est" aria-pressed="false">{mode_est}</button></div></div>
        <div class="tc-set" id="tc-exact">
          {proceeds}
          {cost}
          <div class="tc-f"><label for="tc-bought">{bought}</label>
          <input class="tc-in" id="tc-bought" type="date" value="" aria-describedby="tc-bought-h">
          <p class="tc-hint" id="tc-bought-h">{bought_hint}</p></div>
        </div>
        <div class="tc-set" id="tc-estf" hidden>
          {invested}
          <div class="tc-f w3"><label for="tc-month">{month}</label>
          <input class="tc-in" id="tc-month" type="month" min="2010-08" value="2022-01" aria-describedby="tc-month-h">
          <p class="tc-hint" id="tc-month-h">{month_hint}</p></div>
          <p class="tc-est" id="tc-est" aria-live="polite"></p>
        </div>
        {other}
        <p class="tc-err" id="tc-err" role="alert" hidden></p>
      </form>

      <div class="tc-out" id="tc-out" aria-live="polite">
        <div class="tc-big"><p id="tc-v-title">{res_tax}</p><strong id="tc-r-tax">&hellip;</strong><span id="tc-v-sub"></span></div>
        <div class="tc-stats">
          <div><p>{gain}</p><strong id="tc-r-gain">&hellip;</strong></div>
          <div><p>{net}</p><strong id="tc-r-net">&hellip;</strong></div>
          <div><p>{eff}</p><strong id="tc-r-eff">&hellip;</strong></div>
        </div>
      </div>
      <div class="tc-more">
        <details id="tc-work-w"><summary>{work_h}</summary><div class="tc-body"><table class="tc-work"><tbody id="tc-work"></tbody></table>
          <p class="tc-meta"><span class="tc-rev" id="tc-rev"></span><span id="tc-src"></span></p></div></details>
        <details id="tc-notes-w"><summary>{notes_h}</summary><div class="tc-body"><ul class="tc-notes" id="tc-notes"></ul></div></details>
      </div>

      <div class="tc-cmp-w">
        <span class="tc-k">{cmp_k}</span>
        <h2>{cmp_h}</h2>
        <div class="tc-cmp-row head"><span>{cc}</span><span></span><span>{ct}</span><span>{ck}</span></div>
        <div id="tc-cmp"></div>
        <p class="hp-diff" id="tc-cmp-sum"></p>
      </div>
    </div>
    <div class="hp-fine">
      <p>{fine1}</p>
      <p>{cmp_note}</p>
    </div>
'''.format(order=json.dumps(ORDER), country=t['c_country'], opts=opts, mode_label=t['mode_label'], mode_exact=t['mode_exact'], mode_est=t['mode_est'],
           proceeds=money('proceeds'), cost=money('cost'), bought=t['c_bought'], bought_hint=t['c_bought_hint'],
           invested=money('invested', ' w3'), month=t['c_month'], month_hint=t['c_month_hint'], other=money('other', ' w3'),
           res_tax=t['res_tax'], gain=t['res_gain'], net=t['res_net'], eff=t['res_eff'], work_h=t['work_h'], notes_h=t['notes_h'],
           cmp_k=t['cmp_k'], cmp_h=t['cmp_h'], cc=t['cmp_col_c'], ct=t['cmp_col_t'], ck=t['cmp_col_k'], fine1=t['fine1'], cmp_note=t['cmp_note'])


def build(L, rules, sources, meta):
    t = json.load(open(os.path.join(HERE, L + '.json')))
    Bt = json.load(open(os.path.join(TOOLS, 'bots', L + '.json')))
    t.update({x: v for x, v in Bt.items() if x.startswith('b_') or x == 'email'})
    checked = date_text(rules['checked'], L)
    fill = {'checked': checked, 'fxdate': date_text(rules['fx']['date'], L),
            'fx': ('%g' % rules['fx']['CZK']).replace('.', ',' if L == 'sk' else '.')}
    for k in ('table_lead', 'disclaimer', 'fine1'):
        t[k] = nbsp(t[k].format(**fill), L)
    S = t['c']
    for k, v in list(S.items()):
        if isinstance(v, list):
            S[k] = [nbsp(x.replace('{fxdate}', fill['fxdate']).replace('{fx}', fill['fx']).replace('{checked}', checked), L) for x in v]
        elif isinstance(v, str):
            S[k] = nbsp(v, L)
    names = {c['id']: c['name'] for c in sources['countries']} if L == 'en' else meta['names']['sk']
    for cid in ORDER:
        S['n_' + cid] = names[cid]
    for k in [k for k in t if isinstance(t[k], str)]:
        t[k] = nbsp(t[k], L)

    page = url(L)
    shell = os.path.join(SITE, page.lstrip('/'))
    alts = [(x, url(x)) for x in LANGS] + [('x-default', url('en'))]
    faq = [(t['q%d' % i], t['a%d' % i]) for i in range(1, 6)]
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [
        F.crumbs_ld([(t['crumb_home'], '/' if L == 'en' else '/%s/' % L), (t['crumb_page'], page)]),
        {'@type': 'WebApplication', 'name': t['crumb_page'], 'url': ORIGIN + page, 'inLanguage': L, 'applicationCategory': 'FinanceApplication',
         'operatingSystem': 'Web', 'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'},
         'publisher': {'@id': ORIGIN + '/#org'}, 'dateModified': rules['checked']},
        F.faq_ld([(F.plain(q), F.plain(a)) for q, a in faq])]}
    out = F.head(L, t['title'], t['description'], page, alts, ld, og_title=t['og_title'], og_alt=t['og_title'],
                 robots='index, follow' if REVIEWED else 'noindex, follow', og_image=ORIGIN + '/og/bitcoin-tax.jpg')
    out = out.replace('</head>', CSS + '</head>', 1)
    nav, foot = F.chrome(L, lang_url, comma=False)

    steps = ''.join('''      <div class="how-log-item">
        <div class="how-log-marker"><span class="how-log-dot"></span></div>
        <div class="how-log-body">
          <span class="how-log-num">{step} 0{i}</span>
          <h3>{tt}</h3>
          <p>{pp}</p>
        </div>
      </div>
'''.format(step=t['step'], i=i, tt=t['s%d_t' % i], pp=t['s%d_p' % i]) for i in range(1, 4))
    faq_html = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (' open' if i == 0 else '', esc(q), a) for i, (q, a) in enumerate(faq))
    rh = related_hubs.heading(L)
    rules_js = json.dumps(rules, ensure_ascii=False).replace('</', '<\\/')
    i18n = json.dumps(S, ensure_ascii=False).replace('</', '<\\/')

    out += '''<body class="page-buy page-tc no-split">
{nav}

<main class="wrap acc acc-blue" id="top">

  <!-- 1. HERO + the calculator panel (Services layout: centred headline, one panel) -->
  <div class="buy-hero2">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <noscript><p class="hp-fine">{noscript}</p></noscript>
    {calc}
  </div>

  <!-- 2. THE RULE IN EACH COUNTRY -->
  <section id="rules">
    <div class="sec-head one"><div class="sec-copy"><h2>{th2a} <span>{th2b}</span></h2></div></div>
    <p class="tc-lead">{tlead}</p>
    {table}
  </section>

  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log">
{steps}    </div>
  </section>

  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{qh2a} <span>{qh2b}</span></h2></div></div>
    {faq}
  </section>

  {brief}

  <section id="related">
    <div class="sec-head one"><div class="sec-copy"><h2>{rh2a} <span>{rh2b}</span></h2></div></div>
    <div class="gcards">{rcards}</div>
    <p class="tx-fine fi-disc">{disclaimer}</p>
  </section>

  {foot}
</main>

<script type="application/json" id="tc-rules">{rules}</script>
<script type="application/json" id="tc-i18n">{i18n}</script>
'''.format(nav=nav, eyebrow=t['eyebrow'], h1=t['h1'], h1g=t['h1_grey'], noscript=t['noscript'], calc=calculator(L, t, names),
           th2a=t['table_h_a'], th2b=t['table_h_b'], tlead=t['table_lead'], table=table(L, t, sources, meta, rules),
           hh2a=t['how_h2_a'], hh2b=t['how_h2_b'], steps=steps, qh2a=t['faq_h2_a'], qh2b=t['faq_h2_b'], faq=faq_html,
           brief=F.brief_card(L, t, 'tax_calculator_brief'), rh2a=rh[0], rh2b=rh[1], rcards=related_hubs.cards_html(L, 'tax-agent'),
           disclaimer=t['disclaimer'], foot=foot, rules=rules_js, i18n=i18n)
    sc = C.scripts('/')
    out += sc.replace('<script src="/site-v2.js', '<script src="/tax-calc.js?v=%s" defer></script>\n<script src="/site-v2.js' % JS_V, 1)
    F.check_text(out, L)
    own = re.sub(r'<header class="nav">.*?</header>|<footer\b.*?</footer>|<script\b.*?</script>', '', out, flags=re.S)
    if re.search(r'—|&mdash;|(?<!\d)–(?!\d)', own) or any('—' in str(v) for v in S.values()):
        sys.exit('%s: long dash in page text' % L)
    open(shell, 'w').write(C.finalize(out, shell))
    print('%-40s %6d bytes' % (page, len(out)))


def main():
    data = os.path.join(REPO, 'seo-build', 'data')
    rules = json.load(open(os.path.join(data, 'tax-rules.json')))
    sources = json.load(open(os.path.join(data, 'tax-sources.json')))
    meta = json.load(open(os.path.join(data, 'meta.json')))
    check_rules(rules, sources)
    r = subprocess.run(['node', '--test', os.path.join(HERE, 'tax-calc.test.mjs')], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stdout[-2000:] + r.stderr[-2000:])
    for L in sys.argv[1:] or LANGS:
        build(L, rules, sources, meta)


if __name__ == '__main__':
    main()
