#!/usr/bin/env python3
"""Build bots.html (Automate: DCA and rule-based bots, design v2) for one or more languages.

usage: python3 build_bots.py en [sk cs ...]   (texts: <lang>.json next to this file)
Affiliate URLs are kept exactly as on the old page.
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import v2common as C

PARTNERS = [
    dict(id='coinrule', name='Coinrule', logo='logo-coinrule.png', kind='rules', url='https://coinrule.com/?fp_ref=virtuse'),
    dict(id='cryptohopper', name='Cryptohopper', logo='logo-cryptohopper.png', kind='dca', url='https://www.cryptohopper.com/?atid=40864'),
    dict(id='revenuebot', name='RevenueBot', logo='logo-revenuebot.png', kind='dca rules', url='https://app.revenuebot.io/external/r/90928'),
]


def build(L):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    t = lambda k: T[k]
    page_path, home_path, root = C.paths(L, 'bots.html')
    old, home = open(page_path).read(), open(home_path).read()
    head = C.head(L, old, home, root)
    # the user count in the old meta description is not verifiable on Coinrule's site
    head = re.sub(r'\s*\([^()]*410[^()]*\)', '', head)
    nav, foot = C.chrome(home, 'bots.html')
    tax = '/bitcoin-tax/' if L == 'en' else '/%s/%s/' % (L, C.B.GUIDES[L][0])

    rows = []
    for p in PARTNERS:
        i = p['id']
        rows.append('<div class="row bt-row" data-kind="{kind}"><span class="hc-name"><img src="{root}{logo}" alt="" width="36" height="36" loading="lazy"><span><b>{name}</b><small>{types}{avail}</small></span></span>'
                    '<span class="bt-types">{types}</span><span class="bt-ex">{ex}{avail}</span><span class="bt-use">{use}</span>'
                    '<a class="hp-get btn-primary" href="{url}" target="_blank" rel="noopener noreferrer" aria-label="{cta}">{get} {arrow}</a></div>'.format(
                        kind=p['kind'], root=root, logo=p['logo'], name=p['name'], types=t('pr_%s_types' % i), ex=t('pr_%s_ex' % i),
                        avail=('<em class="bt-avail">%s</em>' % T['pr_%s_avail' % i]) if ('pr_%s_avail' % i) in T else '', use=t('pr_%s_use' % i), url=p['url'], cta=t('pr_%s_cta' % i), get=t('get'), arrow=C.ARROW))
    panel = '''<div class="hpanel pink bt-panel">
      <div class="seg" role="group" aria-label="{f_all} / {f_dca} / {f_rules}">
        <button type="button" class="seg-btn on" data-filter="all" aria-pressed="true">{f_all}</button><button type="button" class="seg-btn" data-filter="dca" aria-pressed="false">{f_dca}</button><button type="button" class="seg-btn" data-filter="rules" aria-pressed="false">{f_rules}</button>
      </div>
      <div class="row head bt-row"><span>{c1}</span><span class="bt-types">{c2}</span><span class="bt-ex">{c3}</span><span class="bt-use">{c5}</span><span></span></div>
      {rows}
    </div>'''.format(f_all=t('f_all'), f_dca=t('f_dca'), f_rules=t('f_rules'), c1=t('col_bot'), c2=t('col_types'), c3=t('col_ex'),
                     c5=t('col_use'), rows='\n      '.join(rows))

    logos = ''.join('<img src="%s%s" alt="%s" width="22" height="22" loading="lazy">' % (root, p['logo'], p['name']) for p in PARTNERS)
    trust = '''<div class="trust-strip ts-center">
    <span class="ts-stats"><span>{a}</span><span>{b}</span><span>{c}</span></span>
    <span class="ts-logos bt-logos">{logos}</span>
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

    ways = ''.join('''      <article class="pcard2 pink way-card">
        <h3>{tt}</h3>
        <p>{pp}</p>
      </article>
'''.format(tt=t('w_%s_t' % w), pp=t('w_%s_p' % w)) for w in ('dca', 'rules'))

    cards = []
    for p in PARTNERS:
        i = p['id']
        feats = ''.join('<li>%s</li>' % t('pr_%s_f%d' % (i, n)) for n in range(1, 5))
        cards.append('''      <article class="pcard2 pink" id="p-{i}">
        <div class="pc-head"><img src="{root}{logo}" alt="{name}" width="48" height="48" loading="lazy"><div><h3>{name}</h3><div class="pc-loc">{types}</div></div></div>
        <details class="pc-more" open><summary>{details}</summary>
          <p>{body}</p>
          <ul class="pc-feats">{feats}</ul>
        </details>{avail}
        <div class="pc-cta"><a href="{url}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-primary">{cta} {out}</a></div>
      </article>'''.format(i=i, root=root, logo=p['logo'], name=p['name'], types=t('pr_%s_use' % i), details=t('details'),
                           body=t('pr_%s_body' % i), feats=feats, avail=('\n        <p class="pc-avail">%s</p>' % T['pr_%s_avail' % i]) if ('pr_%s_avail' % i) in T else '', url=p['url'], cta=t('pr_%s_cta' % i), out=C.OUT))

    faq = '''<details open><summary>{q1}</summary><p>{a1}</p></details>
    <details><summary>{q2}</summary><p>{a2}</p></details>
    <details><summary>{q3}</summary><p>{a3} <a href="{tax}">{a3l} →</a></p></details>
    <details><summary>{q4}</summary><p>{a4} <a href="{root}secure.html">{a4l} →</a></p></details>'''.format(
        q1=t('q1'), a1=t('a1'), q2=t('q2'), a2=t('a2'), q3=t('q3'), a3=t('a3'), tax=tax, a3l=t('a3_link'),
        q4=t('q4'), a4=t('a4'), a4l=t('a4_link'), root=root)

    body = '''<body class="page-buy page-bots no-split">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO: bots compared in one panel (pink) -->
  <div class="buy-hero2">
    <div class="eyebrow pink"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <p class="sp-lead">{lead}</p>
    {panel}
    <p class="tx-fine">{fine}</p>
    <a class="hp-cta" href="#partners">{cta} <span aria-hidden="true">↓</span></a>
    <a class="tlink bt-stack" href="{root}stacking.html">{stack} {arrow}</a>
  </div>
  {trust}

  <!-- 2. HOW IT WORKS -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log how-log-4">
{steps}    </div>
  </section>

  <!-- 3. DCA OR ADVANCED RULES -->
  <section id="ways">
    <div class="sec-head one"><div class="sec-copy"><h2>{wh2a} <span>{wh2b}</span></h2></div></div>
    <div class="pgrid">
{ways}    </div>
    <p class="tp-foot">{wself}</p>
  </section>

  <!-- 4. PARTNERS -->
  <section id="partners">
    <div class="sec-head one"><div class="sec-copy"><h2>{ph2a} <span>{ph2b}</span></h2></div></div>
    <div class="pgrid pgrid3">
{cards}
    </div>
  </section>

  <!-- 5. FAQ -->
  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{qh2a} <span>{qh2b}</span></h2></div></div>
    {faq}
  </section>

  <!-- 6. BRIEF -->
  {brief}

  {foot}
</main>

'''.format(nav=nav, eyebrow=t('eyebrow'), h1=t('h1'), h1g=t('h1_grey'), lead=t('lead'), panel=panel, fine=t('fine'), cta=t('cta_details'),
           root=root, stack=t('stack_link'), arrow=C.ARROW, trust=trust, hh2a=t('h_h2_a'), hh2b=t('h_h2_b'), steps=steps,
           wh2a=t('w_h2_a'), wh2b=t('w_h2_b'), ways=ways, wself=t('w_self'), ph2a=t('p_h2_a'), ph2b=t('p_h2_b'), cards='\n'.join(cards),
           qh2a=t('q_h2_a'), qh2b=t('q_h2_b'), faq=faq, brief=C.brief(L, t, root, 'bots_brief'), foot=foot)
    out = C.fix_links(L, head + body + C.scripts(root))
    open(page_path, 'w').write(out)
    print('%s: %d bytes' % (L, len(out)))


if __name__ == '__main__':
    for L in sys.argv[1:]:
        build(L)
