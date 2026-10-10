#!/usr/bin/env python3
"""Build secure.html (Custody, design v2) for one or more languages.

usage: python3 build_secure.py en [sk cs ...]   (texts: <lang>.json next to this file)
Same components as buy-bitcoin.html (centered hero + one comparison panel), teal accent.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import v2common as C

# sorted by published price (EUR 49 < USD 65 < EUR 79 at any plausible rate; no conversion shown)
DEVICES = [
    dict(id='trezor', logo='logo-trezor.png', cls='', price=49, cur='EUR', open=True, url='https://affil.trezor.io/aff_c?offer_id=133&aff_id=846427'),
    dict(id='jade', logo='logo-blockstream.png', cls='', price=65, cur='USD', open=True, url='https://rewards.blockstream.com/qo0khs'),
    dict(id='ledger', logo='logo-ledger.png', cls='invert', price=79, cur='EUR', open=None, url='https://shop.ledger.com/?r=3256467ea813'),
]


def price(d, L, t):
    if d['cur'] == 'EUR':
        return C.eur(d['price'], L)
    return '$%d' % d['price']


def build(L):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    t = lambda k: T[k]
    page_path, home_path, root = C.paths(L, 'secure.html')
    old, home = open(page_path).read(), open(home_path).read()
    head = C.head(L, old, home, root)
    nav, foot = C.chrome(home, 'secure.html')
    suffix = (' (%s)' % C.B.IN_EN[L]) if L in C.B.IN_EN else ''

    rows = []
    for k, d in enumerate(DEVICES):
        i = d['id']
        pill = '<span class="lowest-pill teal">%s</span>' % t('lowest_pill') if k == 0 else ''
        p = price(d, L, t)
        usd = '<small class="cur-note">%s</small>' % t('usd_note') if d['cur'] == 'USD' else ''
        rows.append('<div class="row sp-row"><span class="hc-name"><img src="{root}{logo}" alt="" width="36" height="36" class="{cls}" loading="lazy"><span><b>{dev} {pill}</b><small>{feat}</small></span></span>'
                    '<span class="sp-made">{made}</span><span class="sp-open">{open}</span><span class="sp-feat">{feat}</span>'
                    '<span class="sp-price">{p}{usd}</span><a class="hp-get" href="{url}" target="_blank" rel="noopener noreferrer" aria-label="{getl}">{get} {arrow}</a></div>'.format(
                        root=root, logo=d['logo'], cls=d['cls'], dev=t('pr_%s_device' % i), pill=pill, feat=t('pr_%s_feature' % i),
                        made=t('pr_%s_made' % i), open=t('yes') if d['open'] else t('not_stated'), p=p, usd=usd, url=d['url'],
                        getl=t('pr_%s_get' % i), get=t('get'), arrow=C.ARROW))
    panel = '''<div class="hpanel teal sp-panel">
      <div class="row head sp-row"><span>{c1}</span><span class="sp-made">{c2}</span><span class="sp-open">{c3}</span><span class="sp-feat">{c4}</span><span class="sp-price">{c5}</span><span></span></div>
      {rows}
    </div>'''.format(c1=t('col_device'), c2=t('col_made'), c3=t('col_open'), c4=t('col_feature'), c5=t('col_price'), rows='\n      '.join(rows))

    logos = ''.join('<img src="%s%s" alt="%s" width="22" height="22" class="%s" loading="lazy">' % (root, d['logo'], t('pr_%s_device' % d['id']), d['cls']) for d in DEVICES)
    trust = '''<div class="trust-strip ts-center">
    <span class="ts-stats"><span>{a}</span><span>{b}</span><span>{c}</span></span>
    <span class="ts-logos">{logos}</span>
  </div>'''.format(a=t('trust_1'), b=t('trust_2'), c=t('trust_3'), logos=logos)

    cards = []
    for d in DEVICES:
        i = d['id']
        badge = price(d, L, t) + (' USD' if d['cur'] == 'USD' and False else '')
        feats = ''.join('<li>%s</li>' % t('pr_%s_f%d' % (i, n)) for n in range(1, 5))
        cards.append('''      <article class="pcard2 teal" id="p-{i}">
        <span class="pc-badge teal">{badge}</span>
        <div class="pc-head"><img src="{root}{logo}" alt="{dev}" class="{cls}" width="48" height="48" loading="lazy"><div><h3>{dev}</h3><div class="pc-loc">{made}</div></div></div>
        <details class="pc-more" open><summary>{details}</summary>
          <p>{body}</p>
          <ul class="pc-feats">{feats}</ul>
        </details>
        <div class="pc-cta"><a href="{url}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">{get} {out}</a></div>
      </article>'''.format(i=i, badge=badge, root=root, logo=d['logo'], cls=d['cls'], dev=t('pr_%s_device' % i), made=t('pr_%s_made' % i),
                           details=t('details'), body=t('pr_%s_body' % i), feats=feats, url=d['url'], get=t('pr_%s_get' % i), out=C.OUT))

    steps = ''.join('''      <div class="how-log-item">
        <div class="how-log-marker"><span class="how-log-dot"></span></div>
        <div class="how-log-body">
          <span class="how-log-num">{step} 0{n}</span>
          <h3>{tt}</h3>
          <p>{pp}</p>
        </div>
      </div>
'''.format(step=t('step'), n=n, tt=t('s%d_t' % n), pp=t('s%d_p' % n)) for n in range(1, 5))

    body = '''<body class="page-buy page-secure">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO: centered headline + one comparison panel (teal) -->
  <div class="buy-hero2">
    <div class="eyebrow teal"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <p class="sp-lead">{lead}</p>
    {panel}
    <div class="hp-fine">
      <p>{fine_prices}</p>
      <p>{earn}</p>
      <p>{talk} <button type="button" class="link-btn" data-consultation-trigger data-consultation-lang="{L}">{call}</button>{suffix}.</p>
    </div>
    <a class="hp-cta" href="#partners">{cta} <span aria-hidden="true">↓</span></a>
  </div>
  {trust}

  <!-- 2. HOW SELF-CUSTODY WORKS -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log how-log-4">
{steps}    </div>
  </section>

  <!-- 3. DEVICES -->
  <section id="partners">
    <div class="sec-head one"><div class="sec-copy"><h2>{ph2a} <span>{ph2b}</span></h2></div></div>
    <div class="pgrid pgrid3">
{cards}
    </div>
    <p class="cat-note">{earn}</p>
  </section>

  <!-- 4. BRIEF -->
  {brief}

  {foot}
</main>

'''.format(nav=nav, eyebrow=t('eyebrow'), h1=t('h1'), h1g=t('h1_grey'), lead=t('lead'), panel=panel, fine_prices=t('fine_prices') + ' ' + t('usd_fine'),
           earn=t('earn'), talk=t('talk'), L=L, call=t('call'), suffix=suffix, cta=t('cta_details'), trust=trust, hh2a=t('h_h2_a'),
           hh2b=t('h_h2_b'), steps=steps, ph2a=t('p_h2_a'), ph2b=t('p_h2_b'), cards='\n'.join(cards),
           brief=C.brief(L, t, root, 'secure_brief'), foot=foot)
    out = C.fix_links(L, head + body + C.scripts(root))
    open(page_path, 'w').write(out)
    print('%s: %d bytes' % (L, len(out)))


if __name__ == '__main__':
    for L in sys.argv[1:]:
        build(L)
