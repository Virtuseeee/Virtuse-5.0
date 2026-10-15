#!/usr/bin/env python3
"""Build tax.html (Bitcoin tax, design v2) for one or more languages.

usage: python3 build_tax.py en [sk cs ...]   (texts: <lang>.json next to this file)
Affiliate URLs are kept exactly as on the old page; country pills link the
seo-build country guides in the page language (slugs/names from seo-build/data/meta.json).
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import v2common as C

PARTNERS = [
    dict(id='divly', name='Divly', logo='logo-divly.png', url='https://divly.com/?ref=otfkzmf'),
    dict(id='blockpit', name='Blockpit', logo='logo-blockpit.png', url='https://app.blockpit.io/register?fpr=virtuse'),
    dict(id='cointracking', name='CoinTracking', logo='logo-cointracking.png', url='https://cointracking.info/?ref=V328565'),
    dict(id='koinly', name='Koinly', logo='logo-koinly.png', url='https://koinly.io/?via=C7DEBFCF&amp;utm_source=affiliate'),
]
PILLS = ['sk', 'cz', 'de', 'at', 'pl', 'fr', 'es']
OWN = {'sk': 'sk', 'cs': 'cz', 'de': 'de', 'pl': 'pl', 'hu': 'hu', 'fr': 'fr', 'es': 'es'}
META = json.load(open(os.path.join(C.SITE, '..', 'seo-build', 'data', 'meta.json')))
EN_NAMES = {'cz': 'Czechia', 'sk': 'Slovakia', 'pl': 'Poland', 'at': 'Austria', 'de': 'Germany', 'hu': 'Hungary', 'fr': 'France', 'es': 'Spain'}


def guide(L, slug=''):
    base = '/bitcoin-tax/' if L == 'en' else '/%s/%s/' % (L, C.B.GUIDES[L][0])
    path = base + (slug + '/' if slug else '')
    assert os.path.exists(os.path.join(C.SITE, path.strip('/'), 'index.html')), path
    return path


def build(L):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    t = lambda k: T[k]
    page_path, home_path, root = C.paths(L, 'tax.html')
    old, home = open(page_path).read(), open(home_path).read()
    head = C.head(L, old, home, root)
    nav, foot = C.chrome(home, 'tax.html')
    names = EN_NAMES if L == 'en' else META['names'][L]
    slugs = META['slugs'][L]
    inh = '/bitcoin-inheritance/' if L == 'en' else '/%s/%s/' % (L, C.B.GUIDES[L][4])

    cc = PILLS + ([OWN[L]] if L in OWN and OWN[L] not in PILLS else [])
    pills = ''.join('<a class="cpill%s" href="%s"%s>%s</a>' % (' on' if OWN.get(L) == c else '', guide(L, slugs[c]),
                    ' aria-current="true"' if OWN.get(L) == c else '', names[c]) for c in cc)
    pills += '<a class="cpill all" href="%s">%s %s</a>' % (guide(L), t('all13'), C.ARROW)
    de_link = '' if L == 'de' else '<a class="tlink tx-de" href="%s" lang="de">Auf Deutsch: Bitcoin-Steuern Deutschland</a>' % guide('de', META['slugs']['de']['de'])

    rows = []
    for p in PARTNERS:
        i = p['id']
        rows.append('<div class="row tx-row"><span class="hc-name"><img src="{root}{logo}" alt="" width="36" height="36" loading="lazy"><span><b>{name}</b><small>{price}</small></span></span>'
                    '<span class="tx-price">{price}</span><span class="tx-free">{free}</span><span class="tx-cty">{cty}</span><span class="tx-use">{use}</span>'
                    '<a class="hp-get btn-primary" href="{url}" target="_blank" rel="sponsored noopener" aria-label="{cta}">{get} {arrow}</a></div>'.format(
                        root=root, logo=p['logo'], name=p['name'], price=t('pr_%s_price' % i), free=t('pr_%s_free' % i), cty=t('pr_%s_countries' % i),
                        use=t('pr_%s_use' % i), url=p['url'], cta=t('pr_%s_cta' % i), get=t('get'), arrow=C.ARROW))
    panel = '''<div class="hpanel blue tx-panel">
      <div class="tx-part tx-a">
        <div class="tx-label">{a_label}</div>
        <div class="cpills">{pills}</div>
        <div class="tx-links"><a class="tlink" href="{root}tax-agent.html">{agent} {arrow}</a>{de_link}</div>
      </div>
      <div class="tx-part tx-b">
        <div class="tx-label">{b_label}</div>
        <div class="row head tx-row"><span>{c1}</span><span class="tx-price">{c2}</span><span class="tx-free">{c3}</span><span class="tx-cty">{c4}</span><span class="tx-use">{c5}</span><span></span></div>
        {rows}
      </div>
    </div>'''.format(a_label=t('a_label'), pills=pills, root=root, agent=t('agent'), arrow=C.ARROW, de_link=de_link, b_label=t('b_label'),
                     c1=t('col_tool'), c2=t('col_price'), c3=t('col_free'), c4=t('col_countries'), c5=t('col_use'), rows='\n        '.join(rows))

    logos = ''.join('<img src="%s%s" alt="%s" width="22" height="22" loading="lazy">' % (root, p['logo'], p['name']) for p in PARTNERS)
    trust = '''<div class="trust-strip ts-center">
    <span class="ts-stats"><span>{a}</span><span>{b}</span><span>{c}</span></span>
    <span class="ts-logos tx-logos">{logos}</span>
  </div>'''.format(a=t('trust_1'), b=t('trust_2'), c=t('trust_3'), logos=logos)

    steps = ''.join('''      <div class="how-log-item">
        <div class="how-log-marker"><span class="how-log-dot"></span></div>
        <div class="how-log-body">
          <span class="how-log-num">{step} 0{n}</span>
          <h3>{tt}</h3>
          <p>{pp}</p>
        </div>
      </div>
'''.format(step=t('step'), n=n, tt=t('s%d_t' % n), pp=t('s%d_p' % n)) for n in range(1, 5))

    cards = []
    for p in PARTNERS:
        i = p['id']
        feats = ''.join('<li>%s</li>' % t('pr_%s_f%d' % (i, n)) for n in range(1, 5))
        cards.append('''      <article class="pcard2 blue" id="p-{i}">
        <div class="pc-head"><img src="{root}{logo}" alt="{name}" width="48" height="48" loading="lazy"><div><h3>{name}</h3><div class="pc-loc">{loc}</div></div></div>
        <details class="pc-more" open><summary>{details}</summary>
          <p>{body}</p>
          <ul class="pc-feats">{feats}</ul>
        </details>
        <div class="pc-cta"><a href="{url}" target="_blank" rel="sponsored noopener" class="btn btn-ghost btn-primary">{cta} {out}</a></div>
      </article>'''.format(i=i, root=root, logo=p['logo'], name=p['name'], loc=t('pr_%s_loc' % i), details=t('details'),
                           body=t('pr_%s_body' % i), feats=feats, url=p['url'], cta=t('pr_%s_cta' % i), out=C.OUT))

    faq = '''<details open><summary>{q1}</summary><p>{a1} <a href="{guides}">{a1l} →</a></p></details>
    <details><summary>{q2}</summary><p>{a2}</p></details>
    <details><summary>{q3}</summary><p>{a3}</p></details>'''.format(
        q1=t('q1'), a1=t('a1'), guides=guide(L), a1l=t('a1_link'), q2=t('q2'), a2=t('a2'), q3=t('q3'), a3=t('a3'))

    body = '''<body class="page-buy page-tax no-split">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO: country guides + reporting tools in one panel (blue) -->
  <div class="buy-hero2">
    <div class="eyebrow blue"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <p class="sp-lead">{lead}</p>
    {panel}
    <p class="tx-fine">{fine}</p>
    <a class="hp-cta" href="#partners">{cta} <span aria-hidden="true">↓</span></a>
  </div>
  {trust}

  <!-- 2. HOW IT WORKS -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log how-log-4">
{steps}    </div>
  </section>

  <!-- 3. TOOLS -->
  <section id="partners">
    <div class="sec-head one"><div class="sec-copy"><h2>{ph2a} <span>{ph2b}</span></h2></div></div>
    <div class="pgrid tx-grid">
{cards}
    </div>
    <a class="pcard2 blue tx-inh" href="{inh}"><span><b>{inh_t}</b> {inh_p}</span><span class="tlink">{inh_cta} {arrow}</span></a>
  </section>

  <!-- 4. FAQ -->
  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{qh2a} <span>{qh2b}</span></h2></div></div>
    {faq}
  </section>

  <!-- 5. BRIEF -->
  {brief}

  {foot}
</main>

'''.format(nav=nav, eyebrow=t('eyebrow'), h1=t('h1'), h1g=t('h1_grey'), lead=t('lead'), panel=panel, fine=t('fine'), cta=t('cta_details'),
           trust=trust, hh2a=t('h_h2_a'), hh2b=t('h_h2_b'), steps=steps, ph2a=t('p_h2_a'), ph2b=t('p_h2_b'), cards='\n'.join(cards),
           inh=inh, inh_t=t('inh_t'), inh_p=t('inh_p'), inh_cta=t('inh_cta'), arrow=C.ARROW,
           qh2a=t('q_h2_a'), qh2b=t('q_h2_b'), faq=faq, brief=C.brief(L, t, root, 'tax_brief'), foot=foot)
    out = C.fix_links(L, head + body + C.scripts(root))
    open(page_path, 'w').write(C.finalize(out, page_path))
    print('%s: %d bytes' % (L, len(out)))


if __name__ == '__main__':
    for L in sys.argv[1:]:
        build(L)
