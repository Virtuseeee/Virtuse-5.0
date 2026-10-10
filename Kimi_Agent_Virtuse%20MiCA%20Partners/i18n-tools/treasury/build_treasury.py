#!/usr/bin/env python3
"""Build treasury.html (Corporate treasury, design v2) for one or more languages.

usage: python3 build_treasury.py en [sk cs ...]   (texts: <lang>.json next to this file)
Partner contact URLs are kept exactly as on the old page.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import v2common as C

PARTNERS = [
    dict(id='coinbase', name='Coinbase Institutional', short='Coinbase', logo='logo-coinbase.png', url='https://coinbase.com/institutional'),
    dict(id='sygnum', name='Sygnum', short='Sygnum', logo='logo-sygnum.png', url='https://sygnum.com', tag=True),
    dict(id='bitgo', name='BitGo', short='BitGo', logo='logo-bitgo.png', url='https://bitgo.com', tag=True),
]
SLUG = 'michael-saylors-legacy-the-bitcoin-corporate-revolution'
ART_IMG = 'https://blog.virtuse.com/wp-content/uploads/2025/09/Screenshot-2025-09-22-at-12.29.09-PM-e1758536988904-768x515.png'
AR_RAW = 'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/asset-returns.json'
CHECK = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def build(L):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    t = lambda k: T[k]
    page_path, home_path, root = C.paths(L, 'treasury.html')
    old, home = open(page_path).read(), open(home_path).read()
    head = C.head(L, old, home, root)
    # the live return figure comes from the same file asset-returns.html reads (GitHub first, same-origin copy as fallback)
    head = head.replace("connect-src 'self'", "connect-src 'self' https://raw.githubusercontent.com", 1)
    nav, foot = C.chrome(home, 'treasury.html')
    suffix = (' (%s)' % C.B.IN_EN[L]) if L in C.B.IN_EN else ''
    en_note = (' (%s)' % C.B.BRIEF_EN[L]) if L != 'en' else ''
    tax = '/bitcoin-tax/' if L == 'en' else '/%s/%s/' % (L, C.B.GUIDES[L][0])
    # the pre-rendered story page (stories-build) has the title and the full text in its HTML; article.html?slug= fills in by JavaScript
    art = '%sstories/%s/' % (root, SLUG)
    call = lambda label, cls: '<button type="button" class="%s" data-consultation-trigger data-consultation-lang="%s">%s</button>' % (cls, L, label)

    rows = []
    for p in PARTNERS:
        i = p['id']
        rows.append('<div class="row tp-row"><span class="hc-name"><img src="{root}{logo}" alt="" width="36" height="36" loading="lazy"><span><b>{name}</b><small>{reg}</small></span></span>'
                    '<span class="tp-reg">{reg}</span><span class="tp-model">{model}</span><span class="tp-scale">{scale}</span><span class="tp-use">{use}</span>'
                    '<a class="hp-get btn-primary" href="{url}" target="_blank" rel="noopener noreferrer" aria-label="{cta}">{contact} {arrow}</a></div>'.format(
                        root=root, logo=p['logo'], name=p['short'], reg=t('pr_%s_reg' % i), model=t('pr_%s_model' % i), scale=t('pr_%s_scale' % i),
                        use=t('pr_%s_use' % i), url=p['url'], cta=t('pr_%s_cta' % i), contact=t('contact'), arrow=C.ARROW))
    panel = '''<div class="hpanel indigo tp-panel">
      <div class="row head tp-row"><span>{c1}</span><span class="tp-reg">{c2}</span><span class="tp-model">{c3}</span><span class="tp-scale">{c4}</span><span class="tp-use">{c5}</span><span></span></div>
      {rows}
      <p class="tp-note">{note}</p>
    </div>'''.format(c1=t('col_partner'), c2=t('col_reg'), c3=t('col_model'), c4=t('col_scale'), c5=t('col_use'),
                     rows='\n      '.join(rows), note=t('note'))

    logos = ''.join('<img src="%s%s" alt="%s" width="22" height="22" loading="lazy">' % (root, p['logo'], p['short']) for p in PARTNERS)
    trust = '''<div class="trust-strip ts-center">
    <span class="ts-stats"><span>{a}</span><span>{b}</span><span>{c}</span></span>
    <span class="ts-logos tp-logos">{logos}</span>
  </div>'''.format(a=t('trust_1'), b=t('trust_2'), c=t('trust_3'), logos=logos)

    principles = ''.join('<li>%s<span>%s</span></li>' % (CHECK, t('pr_%d' % n)) for n in range(1, 4))
    why = '''<ul class="tp-principles">{principles}</ul>
    <div class="why-grid">
      <a class="pcard2 indigo why-card why-art" href="{art}">
        <img src="{img}" alt="{img_alt}" width="768" height="515" loading="lazy">
        <span class="why-k">{art_k}</span>
        <h3>{art_title}{en_note}</h3>
        <p>{art_teaser}</p>
        <span class="why-by">{art_by}</span>
        <span class="tlink">{art_cta} {arrow}</span>
      </a>
      <a class="pcard2 indigo why-card why-data" href="{root}asset-returns.html">
        <span class="why-k">{data_k}</span>
        <h3>{data_title}{en_note}</h3>
        <p>{data_p}</p>
        <div class="ar-stat" id="arStat" hidden data-src="{raw}" data-local="{root}data/asset-returns.json" data-locale="{loc}" data-pct="{pct}" data-label="{label}">
          <b id="arStatVal"></b><span id="arStatLabel"></span>
        </div>
        <span class="why-src">{data_src}</span>
        <span class="tlink">{data_cta} {arrow}</span>
      </a>
    </div>
    <p class="tp-foot">{foot}</p>'''.format(principles=principles, art=art, img=ART_IMG, img_alt=t('art_img_alt'), art_k=t('art_k'),
                                          art_title=t('art_title'), en_note=en_note, art_teaser=t('art_teaser'), art_by=t('art_by'),
                                          art_cta=t('art_cta'), arrow=C.ARROW, data_k=t('data_k'), data_title=t('data_title'), data_p=t('data_p'),
                                          raw=AR_RAW, root=root, loc=C.B.LOCALE.get(L, 'en-GB'), pct=' %' if L in C.PCT_SPACE else '%',
                                          label=t('data_label'), data_src=t('data_src'), data_cta=t('data_cta'), foot=t('w_foot'))

    steps = ''.join('''      <div class="how-log-item">
        <div class="how-log-marker"><span class="how-log-dot"></span></div>
        <div class="how-log-body">
          <span class="how-log-num">{step} 0{n}</span>
          <h3>{tt}</h3>
          <p>{pp}</p>
        </div>
      </div>
'''.format(step=t('step'), n=n, tt=t('s%d_t' % n), pp=t('s%d_p' % n)) for n in range(1, 5))

    who = ''.join('''      <article class="pcard2 indigo who-card">
        <h3>{tt}</h3>
        <div class="pc-loc">{ss}</div>
        <ul class="pc-feats">{feats}</ul>
        <div class="pc-cta">{btn}</div>
      </article>
'''.format(tt=t('who_%s_t' % w), ss=t('who_%s_s' % w), feats=''.join('<li>%s</li>' % t('who_%s_%d' % (w, n)) for n in range(1, 5)),
           btn=call(t('who_cta'), 'btn btn-ghost')) for w in ('pub', 'fo'))

    cards = []
    for p in PARTNERS:
        i = p['id']
        feats = ''.join('<li>%s</li>' % t('pr_%s_f%d' % (i, n)) for n in range(1, 5))
        tag = (' <span class="pc-tag">%s</span>' % t('pr_%s_tag' % i)) if p.get('tag') else ''
        cards.append('''      <article class="pcard2 indigo" id="p-{i}">
        <div class="pc-head"><img src="{root}{logo}" alt="{name}" width="48" height="48" loading="lazy"><div><h3>{name}{tag}</h3><div class="pc-loc">{loc}</div></div></div>
        <details class="pc-more" open><summary>{details}</summary>
          <p>{body}</p>
          <ul class="pc-feats">{feats}</ul>
        </details>
        <div class="pc-cta"><a href="{url}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-primary">{cta} {out}</a></div>
      </article>'''.format(i=i, root=root, logo=p['logo'], name=p['name'], tag=tag, loc=t('pr_%s_loc' % i), details=t('details'),
                           body=t('pr_%s_body' % i), feats=feats, url=p['url'], cta=t('pr_%s_cta' % i), out=C.OUT))

    faq = '''<details open><summary>{q1}</summary><p>{a1}</p></details>
    <details><summary>{q2}</summary><p>{a2} <a href="{tax}">{a2l} →</a></p></details>
    <details><summary>{q3}</summary><p>{a3}</p></details>'''.format(
        q1=t('q1'), a1=t('a1'), q2=t('q2'), a2=t('a2'), tax=tax, a2l=t('a2_link'), q3=t('q3'), a3=t('a3'))

    body = '''<body class="page-buy page-treasury no-split">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO: centered headline + one comparison panel (indigo) -->
  <div class="buy-hero2">
    <div class="eyebrow indigo"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <p class="sp-lead">{lead}</p>
    {panel}
    {call_btn}{suffix_line}
    <a class="tlink tp-details" href="#partners">{cta_details} <span aria-hidden="true">↓</span></a>
  </div>
  {trust}

  <!-- 2. WHY COMPANIES HOLD BITCOIN -->
  <section id="why">
    <div class="sec-head one"><div class="sec-copy"><h2>{wh2a} <span>{wh2b}</span></h2></div></div>
    {why}
  </section>

  <!-- 3. HOW IT WORKS -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log how-log-4">
{steps}    </div>
  </section>

  <!-- 4. WHO WE SERVE -->
  <section id="who">
    <div class="sec-head one"><div class="sec-copy"><h2>{oh2a} <span>{oh2b}</span></h2></div></div>
    <div class="pgrid">
{who}    </div>
  </section>

  <!-- 5. PARTNERS -->
  <section id="partners">
    <div class="sec-head one"><div class="sec-copy"><h2>{ph2a} <span>{ph2b}</span></h2></div></div>
    <div class="pgrid pgrid3">
{cards}
    </div>
  </section>

  <!-- 6. FAQ -->
  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{qh2a} <span>{qh2b}</span></h2></div></div>
    {faq}
  </section>

  <!-- 7. BRIEF -->
  {brief}

  {foot}
</main>

'''.format(nav=nav, eyebrow=t('eyebrow'), h1=t('h1'), h1g=t('h1_grey'), lead=t('lead'), panel=panel,
           call_btn=call(t('cta_call'), 'hp-cta'), cta_details=t('cta_details'),
           suffix_line=('\n    <p class="tp-call-lang">%s</p>' % suffix.strip()) if suffix else '',
           trust=trust, wh2a=t('w_h2_a'), wh2b=t('w_h2_b'), why=why, hh2a=t('h_h2_a'), hh2b=t('h_h2_b'), steps=steps,
           oh2a=t('who_h2_a'), oh2b=t('who_h2_b'), who=who, ph2a=t('p_h2_a'), ph2b=t('p_h2_b'), cards='\n'.join(cards),
           qh2a=t('q_h2_a'), qh2b=t('q_h2_b'), faq=faq, brief=C.brief(L, t, root, 'treasury_brief'), foot=foot)
    out = C.fix_links(L, head + body + C.scripts(root))
    open(page_path, 'w').write(out)
    print('%s: %d bytes' % (L, len(out)))


if __name__ == '__main__':
    for L in sys.argv[1:]:
        build(L)
