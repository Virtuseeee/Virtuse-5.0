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
JS_V = '1'
REVIEWED = False   # True once the tax adviser has signed off all 13 countries: index + sitemap
DEFAULT = {'en': 'de', 'sk': 'sk'}
ORDER = ['sk', 'cz', 'pl', 'hu', 'at', 'de', 'si', 'hr', 'ro', 'bg', 'nl', 'fr', 'es']
FIELDS = {'proceeds': 20000, 'cost': 10000, 'other': 30000}

CSS = '''<style>
/* BITCOIN TAX CALCULATOR (logic in /tax-calc.js) */
.tc [hidden] { display: none !important; }
.tc { display: grid; grid-template-columns: minmax(0, 380px) minmax(0, 1fr); gap: 20px; align-items: start; text-align: left; }
.tc-panel { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 22px; min-width: 0; }
.tc-panel h2 { font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 0 0 14px; }
.tc-field { padding: 12px 0; border-top: 1px solid var(--line); }
.tc-field:first-of-type { border-top: 0; padding-top: 0; }
.tc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tc-head label, .tc-lbl { font-size: 14px; color: var(--text); }
.tc-num { width: 140px; flex: none; background: var(--inset); color: var(--c, var(--orange)); border: 1px solid var(--line-strong); border-radius: 8px; padding: 8px 10px; font: 600 14px var(--sans); text-align: right; }
.tc-num[type=date] { color-scheme: dark; text-align: left; }
.tc-num:focus { border-color: var(--c, var(--orange)); outline: none; }
.tc-hint { margin: 6px 0 0; font-size: 12px; color: var(--dim); line-height: 1.45; }
.tc-err { margin: 10px 0 0; font-size: 13px; color: #f0883e; }
.tc-cs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tc-c { background: transparent; color: var(--text); border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 11px; font: 500 13px var(--sans); cursor: pointer; }
.tc-c:hover { border-color: color-mix(in srgb, var(--c, var(--orange)) 45%, transparent); }
.tc-c[aria-pressed=true] { background: var(--c, var(--orange)); border-color: var(--c, var(--orange)); color: #0b1530; }
.tc-res { display: grid; gap: 16px; min-width: 0; }
.tc-verdict { border-radius: 16px; padding: 18px 20px; border: 1px solid var(--line-strong); background: var(--card); }
.tc-verdict b { display: block; font-size: 20px; font-weight: 700; }
.tc-verdict span { display: block; margin-top: 4px; font-size: 14px; color: var(--muted); }
.tc-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.tc-box { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; min-width: 0; }
.tc-box p { margin: 0; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.tc-box strong { display: block; margin-top: 8px; font-size: 20px; font-weight: 700; overflow-wrap: anywhere; }
.tc-box strong.o { color: var(--c, var(--orange)); }
.tc-work { width: 100%; border-collapse: collapse; font-size: 14px; }
.tc-work th, .tc-work td { padding: 9px 0; border-top: 1px solid var(--line); text-align: left; font-weight: 400; color: var(--muted); }
.tc-work td { text-align: right; white-space: nowrap; color: var(--text); font-variant-numeric: tabular-nums; padding-left: 12px; }
.tc-work tr:first-child th, .tc-work tr:first-child td { border-top: 0; }
.tc-work tr.sum th, .tc-work tr.sum td { color: var(--text); font-weight: 600; border-top-color: var(--line-strong); }
.tc-notes { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.55; color: var(--muted); }
.tc-notes li + li { margin-top: 6px; }
.tc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin: 14px 0 0; font-size: 13px; color: var(--muted); }
.tc-meta a { color: var(--text); }
.tc-rev { display: inline-block; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 600; }
.tc-rev.y { background: rgba(63,185,80,.15); color: var(--good); }
.tc-rev.n { background: rgba(240,136,62,.15); color: #f0883e; }
.tc-table-wrap { overflow-x: auto; }
.tc-table { width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; }
.tc-table th, .tc-table td { padding: 12px 10px 12px 0; border-top: 1px solid var(--line); vertical-align: top; }
.tc-table thead th { border-top: 0; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.tc-table tbody th { font-weight: 600; white-space: nowrap; }
.tc-table td { color: var(--muted); line-height: 1.5; }
.tc-table td a { color: var(--text); }
.tc-table small { display: block; margin-top: 4px; }
.tc-lead { margin: 0 0 18px; max-width: 860px; font-size: 16px; line-height: 1.6; color: var(--muted); text-align: left; }
@media (max-width: 1100px) { .tc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 900px) { .tc { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 720px) {
  .tc-table thead { display: none; }
  .tc-table tr { display: block; padding: 12px 0; border-top: 1px solid var(--line); }
  .tc-table th, .tc-table td { display: block; border: 0; padding: 3px 0; }
  .tc-table td[data-l]::before { content: attr(data-l) ": "; color: var(--dim); }
}
@media (max-width: 520px) { .tc-panel { padding: 18px; } .tc-num { width: 124px; } .tc-box strong { font-size: 18px; } }
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


def table(L, t, sources, meta, checked):
    names = {c['id']: c['name'] for c in sources['countries']} if L == 'en' else meta['names']['sk']
    by = {c['id']: c for c in sources['countries']}
    rows = []
    for cid in ORDER:
        c, r = by[cid], json.load(open(os.path.join(REPO, 'seo-build', 'data', 'tax-rules.json')))['countries'][cid]
        if L == 'en':
            f = {k: c['fields'][k]['text'] for k in ('gainTax', 'exemption', 'filing')}
            if 'healthLevy' in c['fields']:
                f['gainTax'] += '; ' + c['fields']['healthLevy']['text']
            guide = '/bitcoin-tax/%s/' % meta['slugs']['en'][cid]
        else:
            s = meta['taxSk'][cid]
            f = {'gainTax': s['gainTax'], 'exemption': s['exemption'], 'filing': s['filing']}
            guide = '/sk/bitcoin-dane/%s/' % meta['slugs']['sk'][cid]
        assert os.path.isdir(os.path.join(SITE, guide.strip('/'))), guide
        g = c['fields']['gainTax']
        rows.append('<tr data-c="{id}"><th scope="row">{name}<small><a href="{guide}">{gl}</a></small></th>'
                    '<td data-l="{lr}">{rate}</td><td data-l="{le}">{ex}</td><td data-l="{lf}">{fi}</td>'
                    '<td data-l="{ls}"><a href="{src}" target="_blank" rel="noopener">{st}</a></td>'
                    '<td data-l="{lv}"><span class="tc-rev {cls}">{rv}</span></td></tr>'.format(
                        id=cid, name=esc(names[cid]), guide=guide, gl=t['guide'], lr=t['col_rate'], le=t['col_exempt'], lf=t['col_filing'],
                        ls=t['col_source'], lv=t['col_review'], rate=esc(nbsp(f['gainTax'], L)), ex=esc(nbsp(f['exemption'], L)),
                        fi=esc(nbsp(f['filing'], L)), src=esc(g['source']), st=esc(re.split(r':| \(| – ', g['sourceTitle'])[0]),
                        cls='y' if r['reviewed'] else 'n', rv=t['review_yes'] if r['reviewed'] else t['review_no']))
    return '''<div class="tc-table-wrap"><table class="tc-table" id="tc-table">
      <thead><tr><th scope="col">{c}</th><th scope="col">{r}</th><th scope="col">{e}</th><th scope="col">{f}</th><th scope="col">{s}</th><th scope="col">{v}</th></tr></thead>
      <tbody>{rows}</tbody>
    </table></div>'''.format(c=t['col_country'], r=t['col_rate'], e=t['col_exempt'], f=t['col_filing'], s=t['col_source'], v=t['col_review'], rows=''.join(rows))


def calculator(L, t, names):
    def field(k, hint, kind='text', extra=''):
        val = '' if kind == 'date' else FIELDS[k]
        inp = ('<input class="tc-num" id="tc-{k}" type="date" value="" aria-describedby="tc-{k}-h">' if kind == 'date' else
               '<input class="tc-num" id="tc-{k}" type="text" inputmode="decimal" autocomplete="off" value="{v}" aria-describedby="tc-{k}-h">').format(k=k, v=val)
        return '''      <div class="tc-field"{extra}>
        <div class="tc-head"><label for="tc-{k}"{lid}>{lab}</label>{inp}</div>
        <p class="tc-hint" id="tc-{k}-h">{hint}</p>
      </div>
'''.format(k=k, lab=esc(t.get('c_' + k, '')), inp=inp, hint=hint, extra=extra, lid=' id="tc-other-l"' if k == 'other' else '')
    pills = ''.join('<button type="button" class="tc-c" data-c="%s" aria-pressed="false">%s</button>' % (c, esc(names[c])) for c in ORDER)
    return '''<div class="pf-app tc" id="calc">
    <form class="tc-panel" id="tc-form" data-default="{dflt}" novalidate onsubmit="return false">
      <h2>{form_h}</h2>
      <div class="tc-field">
        <span class="tc-lbl" id="tc-country-l">{country}</span>
        <div class="tc-cs" id="tc-country" role="group" aria-labelledby="tc-country-l">{pills}</div>
      </div>
{proceeds}{cost}{bought}{other}      <p class="tc-err" id="tc-err" role="alert" hidden></p>
    </form>
    <div class="tc-res">
      <div class="tc-verdict glow" id="tc-verdict" aria-live="polite"><b id="tc-v-title">&hellip;</b><span id="tc-v-sub"></span></div>
      <div class="tc-grid">
        <div class="tc-box glow"><p>{gain}</p><strong id="tc-r-gain">&hellip;</strong></div>
        <div class="tc-box glow"><p>{tax}</p><strong class="o" id="tc-r-tax">&hellip;</strong></div>
        <div class="tc-box glow"><p>{net}</p><strong id="tc-r-net">&hellip;</strong></div>
        <div class="tc-box glow"><p>{eff}</p><strong id="tc-r-eff">&hellip;</strong></div>
      </div>
      <div class="tc-panel" id="tc-work-w"><h2>{work_h}</h2><table class="tc-work"><tbody id="tc-work"></tbody></table></div>
      <div class="tc-panel"><h2>{notes_h}</h2><ul class="tc-notes" id="tc-notes"></ul>
        <p class="tc-meta"><span class="tc-rev" id="tc-rev"></span><span id="tc-src"></span></p></div>
    </div>
  </div>
'''.format(dflt=DEFAULT[L], form_h=t['form_h'], country=t['c_country'], pills=pills,
           proceeds=field('proceeds', t['c_proceeds_hint']), cost=field('cost', t['c_cost_hint']),
           bought=field('bought', t['c_bought_hint'], 'date'),
           other=field('other', t['c']['other_hint'], extra=' id="tc-other-f" hidden'),
           gain=t['res_gain'], tax=t['res_tax'], net=t['res_net'], eff=t['res_eff'], work_h=t['work_h'], notes_h=t['notes_h'])


def build(L, rules, sources, meta):
    t = json.load(open(os.path.join(HERE, L + '.json')))
    Bt = json.load(open(os.path.join(TOOLS, 'bots', L + '.json')))
    t.update({x: v for x, v in Bt.items() if x.startswith('b_') or x == 'email'})
    checked = date_text(rules['checked'], L)
    fill = {'checked': checked, 'fxdate': date_text(rules['fx']['date'], L),
            'fx': ('%g' % rules['fx']['CZK']).replace('.', ',' if L == 'sk' else '.')}
    for k in ('table_lead', 'disclaimer'):
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
    for k in ('proceeds', 'cost', 'bought'):
        t['c_' + k] = t['c_' + k]
    t['c_other'] = S['other_total']
    for k in [k for k in t if isinstance(t[k], str)]:
        t[k] = nbsp(t[k], L)

    page = url(L)
    shell = os.path.join(SITE, page.lstrip('/'))
    alts = [(x, url(x)) for x in LANGS] + [('x-default', url('en'))]
    faq = [(t['q%d' % i], t['a%d' % i]) for i in range(1, 6)]
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [
        F.crumbs_ld([(t['crumb_home'], '/' if L == 'en' else '/%s/' % L), (t['crumb_page'], page)]),
        {'@type': 'WebApplication', 'name': t['h1'], 'url': ORIGIN + page, 'inLanguage': L, 'applicationCategory': 'FinanceApplication',
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

    out += '''<body class="page-buy page-fee page-pf page-stack page-tc no-split">
{nav}

<main class="wrap bd-v3 bd-acc-blue" id="top">

  <div class="buy-hero2 pf-hero">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1}</h1>
    <p class="sp-lead">{lead}</p>
  </div>
  <noscript><p class="pf-noscript">{noscript}</p></noscript>
  {calc}
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
'''.format(nav=nav, eyebrow=t['eyebrow'], h1=t['h1'], lead=t['lead'], noscript=t['noscript'], calc=calculator(L, t, names),
           th2a=t['table_h_a'], th2b=t['table_h_b'], tlead=t['table_lead'], table=table(L, t, sources, meta, checked),
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
