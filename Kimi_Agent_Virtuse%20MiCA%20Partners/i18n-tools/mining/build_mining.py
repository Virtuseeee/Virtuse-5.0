#!/usr/bin/env python3
"""Build mining.html (design v2) for one or more languages.

usage: python3 build_mining.py en [sk cs ...]   (texts: <lang>.json next to this file)
Referral URLs are kept exactly as on the old page.
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import v2common as C

PARTNERS = [
    dict(id='oneminers', name='OneMiners', logo='logo-oneminers.png', cls='', kind='host', url='https://oneminers.com/products/?discount=virtuse_buy'),
    dict(id='abundant', name='Abundant Mines', logo='logo-abundantmines.png', cls='invert', kind='host', url='https://abundantmines.com/ref/76/'),
    dict(id='powermining', name='Power Mining', logo='logo-powermining.png', cls='clear', kind='home', url='https://shop.powermining.io/?ref=Virtuse'),
]
EN_TITLE_OLD = 'Bitcoin Mining Hosting from $0.043/kWh | Virtuse'
EN_TITLE_NEW = 'Bitcoin Mining Hosting &amp; Hardware Partners | Virtuse'


def build(L):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    t = lambda k: T[k]
    page_path, home_path, root = C.paths(L, 'mining.html')
    old, home = open(page_path).read(), open(home_path).read()
    head = C.head(L, old, home, root)
    if L == 'en':  # only one partner publishes a price; the title no longer leads with it
        head = head.replace(EN_TITLE_OLD, EN_TITLE_NEW)
    nav, foot = C.chrome(home, 'mining.html')
    suffix = (' (%s)' % C.B.IN_EN[L]) if L in C.B.IN_EN else ''
    tax = '/bitcoin-tax/' if L == 'en' else '/%s/%s/' % (L, C.B.GUIDES[L][0])

    rows = []
    for p in PARTNERS:
        i = p['id']
        rows.append('<div class="row mp-row" data-kind="{kind}"><span class="hc-name"><img src="{root}{logo}" alt="" width="36" height="36" class="{cls}" loading="lazy"><span><b>{name}</b><small>{type}</small></span></span>'
                    '<span class="mp-type">{type}</span><span class="mp-loc">{loc}</span><span class="mp-fact">{fact}</span>'
                    '<a class="hp-get btn-primary" href="{url}" target="_blank" rel="noopener noreferrer" aria-label="{cta}">{visit} {arrow}</a></div>'.format(
                        kind=p['kind'], root=root, logo=p['logo'], cls=p['cls'], name=p['name'], type=t('pr_%s_type' % i), loc=t('pr_%s_loc' % i),
                        fact=t('pr_%s_fact' % i), url=p['url'], cta=t('pr_%s_cta' % i), visit=t('visit'), arrow=C.ARROW))
    panel = '''<div class="hpanel yellow mp-panel" id="mpPanel">
      <div class="seg" role="group" aria-label="{f_all} / {f_host} / {f_home}">
        <button type="button" class="seg-btn on" data-filter="all" aria-pressed="true">{f_all}</button><button type="button" class="seg-btn" data-filter="host" aria-pressed="false">{f_host}</button><button type="button" class="seg-btn" data-filter="home" aria-pressed="false">{f_home}</button>
      </div>
      <div class="row head mp-row"><span>{c1}</span><span class="mp-type">{c2}</span><span class="mp-loc">{c3}</span><span class="mp-fact">{c4}</span><span></span></div>
      {rows}
    </div>'''.format(f_all=t('f_all'), f_host=t('f_host'), f_home=t('f_home'), c1=t('col_partner'), c2=t('col_type'), c3=t('col_loc'),
                     c4=t('col_fact'), rows='\n      '.join(rows))

    logos = ''.join('<img src="%s%s" alt="%s" width="22" height="22" class="%s" loading="lazy">' % (root, p['logo'], p['name'], p['cls'] or 'invert') for p in PARTNERS)
    trust = '''<div class="trust-strip ts-center">
    <span class="ts-stats"><span>{a}</span><span>{b}</span><span>{c}</span></span>
    <span class="ts-logos mp-logos">{logos}</span>
  </div>'''.format(a=t('trust_1'), b=t('trust_2'), c=t('trust_3'), logos=logos)

    def path(title, prefix):
        items = ''.join('''<li class="mp-step"><span class="mp-dot"></span><span class="how-log-num">{step} 0{n}</span><b>{tt}</b><span>{pp}</span></li>'''.format(
            step=t('step'), n=n, tt=t('%s%d_t' % (prefix, n)), pp=t('%s%d_p' % (prefix, n))) for n in range(1, 5))
        return '<div class="mp-path"><h3>%s</h3><ol>%s</ol></div>' % (title, items)
    paths = path(t('path_host'), 'ph') + path(t('path_home'), 'pm')

    cards = []
    for p in PARTNERS:
        i = p['id']
        feats = ''.join('<li>%s</li>' % t('pr_%s_f%d' % (i, n)) for n in range(1, 5))
        cards.append('''      <article class="pcard2 yellow" id="p-{i}">
        <div class="pc-head"><img src="{root}{logo}" alt="{name}" class="{cls}" width="48" height="48" loading="lazy"><div><h3>{name}</h3><div class="pc-loc">{base}</div></div></div>
        <details class="pc-more" open><summary>{details}</summary>
          <p>{body}</p>
          <ul class="pc-feats">{feats}</ul>
        </details>
        <div class="pc-cta"><a href="{url}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-primary">{cta} {out}</a></div>
      </article>'''.format(i=i, root=root, logo=p['logo'], cls=p['cls'], name=p['name'], base=t('pr_%s_base' % i), details=t('details'),
                           body=t('pr_%s_body' % i), feats=feats, url=p['url'], cta=t('pr_%s_cta' % i), out=C.OUT))

    faq = '''<details open><summary>{q1}</summary><p>{a1}</p></details>
    <details><summary>{q2}</summary><p>{a2}</p></details>
    <details><summary>{q3}</summary><p>{a3} <a href="{tax}">{a3l} →</a></p></details>'''.format(
        q1=t('q1'), a1=t('a1'), q2=t('q2'), a2=t('a2'), q3=t('q3'), a3=t('a3'), tax=tax, a3l=t('a3_link'))

    body = '''<body class="page-buy page-mine no-split">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO: centered headline + one comparison panel (yellow) -->
  <div class="buy-hero2">
    <div class="eyebrow yellow"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <p class="sp-lead">{lead}</p>
    {panel}
    <div class="hp-fine">
      <p>{fine}</p>
      <p>{talk} <button type="button" class="link-btn" data-consultation-trigger data-consultation-lang="{L}">{call}</button>{suffix}.</p>
    </div>
    <a class="hp-cta" href="#partners">{cta} <span aria-hidden="true">↓</span></a>
  </div>
  {trust}

  <!-- 2. HOW IT WORKS: two paths -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="mp-paths">{paths}</div>
  </section>

  <!-- 3. PARTNERS -->
  <section id="partners">
    <div class="sec-head one"><div class="sec-copy"><h2>{ph2a} <span>{ph2b}</span></h2></div></div>
    <div class="pgrid pgrid3">
{cards}
    </div>
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

'''.format(nav=nav, eyebrow=t('eyebrow'), h1=t('h1'), h1g=t('h1_grey'), lead=t('lead'), panel=panel, fine=t('fine'), talk=t('talk'), L=L,
           call=t('call'), suffix=suffix, cta=t('cta_details'), trust=trust, hh2a=t('h_h2_a'), hh2b=t('h_h2_b'), paths=paths,
           ph2a=t('p_h2_a'), ph2b=t('p_h2_b'), cards='\n'.join(cards), qh2a=t('q_h2_a'), qh2b=t('q_h2_b'), faq=faq,
           brief=C.brief(L, t, root, 'mining_brief'), foot=foot)
    out = C.fix_links(L, head + body + C.scripts(root))
    open(page_path, 'w').write(out)
    print('%s: %d bytes' % (L, len(out)))


if __name__ == '__main__':
    for L in sys.argv[1:]:
        build(L)
