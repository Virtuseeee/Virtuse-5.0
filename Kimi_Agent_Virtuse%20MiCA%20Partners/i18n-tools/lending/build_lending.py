#!/usr/bin/env python3
"""Build lending.html (Loans, design v2) around the Firefish widget, for one or more languages.

usage: python3 build_lending.py en [sk cs ...]   (texts: <lang>.json next to this file)
Every Firefish URL keeps ref=virtuseloan.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import v2common as C

SIGNUP = 'https://app.firefish.io/auth/sign-up?ref=virtuseloan'
WIDGET = 'https://widget.firefish.io/?ref=virtuseloan&amp;theme=dark&amp;bg=141414&amp;pageBg=rgba(0,0,0,0)&amp;borderCard=rgba(0,0,0,0)&amp;shadowCard=none&amp;widgetShadow=none'
BORROW = SIGNUP  # firefish.io itself is not in the partner-click host map; app.firefish.io is


def build(L):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    t = lambda k: T[k]
    page_path, home_path, root = C.paths(L, 'lending.html')
    old, home = open(page_path).read(), open(home_path).read()
    head = C.head(L, old, home, root)
    nav, foot = C.chrome(home, 'lending.html')
    suffix = (' (%s)' % C.B.IN_EN[L]) if L in C.B.IN_EN else ''
    svb = '/sell-vs-borrow-bitcoin/' if L == 'en' else '/%s/%s/' % (L, C.B.GUIDES[L][3])
    tax = '/bitcoin-tax/' if L == 'en' else '/%s/%s/' % (L, C.B.GUIDES[L][0])

    details = ''.join('<div class="ld-row"><span>%s</span><b>%s</b></div>' % (t(k), t(k + '_v'))
                      for k in ('d_rate', 'd_ltv', 'd_dur', 'd_cur', 'd_min', 'd_cust'))
    panel = '''<div class="hpanel purple lend-panel">
      <div class="lend-grid">
        <div class="lend-widget"><iframe src="{widget}" title="{wt}" width="100%" height="560" style="border:0" allow="clipboard-write"></iframe></div>
        <div class="lend-details">
          <h2 class="ld-title">{dt}</h2>
          {details}
          <p class="ld-note">{dn}</p>
        </div>
      </div>
    </div>'''.format(widget=WIDGET, wt=t('widget_title'), dt=t('d_title'), details=details, dn=t('d_note'))

    trust = '''<div class="trust-strip ts-center">
    <span class="ts-stats"><span class="ts-brand"><img src="{root}logo-firefish.png" alt="" width="32" height="32" loading="lazy"><b>Firefish</b></span><span>{a}</span><span>{b}</span><span>{c}</span><span>{d}</span></span>
  </div>'''.format(a=t('t_funded'), b=t('t_investors'), c=t('t_esma'), d=t('t_btc'), root=root)

    steps = ''.join('''      <div class="how-log-item">
        <div class="how-log-marker"><span class="how-log-dot"></span></div>
        <div class="how-log-body">
          <span class="how-log-num">{step} 0{n}</span>
          <h3>{tt}</h3>
          <p>{pp}</p>
        </div>
      </div>
'''.format(step=t('step'), n=n, tt=t('s%d_t' % n), pp=t('s%d_p' % n)) for n in range(1, 5))

    ways = ''.join('''      <article class="pcard2 purple way-card">
        <h3>{tt}</h3>
        <p>{pp}</p>
        <div class="pc-cta"><a href="{url}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">{cta} {out}</a></div>
      </article>
'''.format(tt=t('w_%s_t' % w), pp=t('w_%s_p' % w), url=SIGNUP, cta=t('w_%s_cta' % w), out=C.OUT) for w in ('b', 'i'))

    faq = '''<details open><summary>{q1}</summary><p>{a1} <a href="{borrow}" target="_blank" rel="noopener noreferrer">{a1l} ↗</a></p></details>
    <details><summary>{q2}</summary><p>{a2}</p></details>
    <details><summary>{q3}</summary><p>{a3} <a href="{tax}">{a3l} →</a></p></details>'''.format(
        q1=t('q1'), a1=t('a1'), borrow=BORROW, a1l=t('a1_link'), q2=t('q2'), a2=t('a2'), q3=t('q3'), a3=t('a3'), tax=tax, a3l=t('a3_link'))

    body = '''<body class="page-buy page-lend">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO: the Firefish calculator as the centerpiece -->
  <div class="buy-hero2">
    <div class="eyebrow purple"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    {panel}
    <a class="hp-cta btn-primary" href="{signup}" target="_blank" rel="noopener noreferrer">{cta} <span aria-hidden="true">↗</span></a>
    <a class="tlink lend-compare" href="{svb}">{compare} {arrow}</a>
    <div class="hp-fine">
      <p>{fine_ref} {fine_risk}</p>
      <p>{talk} <button type="button" class="link-btn" data-consultation-trigger data-consultation-lang="{L}">{call}</button>{suffix}.</p>
    </div>
  </div>
  {trust}

  <!-- 2. HOW IT WORKS -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log how-log-4">
{steps}    </div>
  </section>

  <!-- 3. BORROW OR LEND -->
  <section id="ways">
    <div class="sec-head one"><div class="sec-copy"><h2>{wh2a} <span>{wh2b}</span></h2></div></div>
    <div class="pgrid">
{ways}    </div>
  </section>

  <!-- 4. RISKS / FAQ -->
  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{fh2a} <span>{fh2b}</span></h2></div></div>
    {faq}
  </section>

  <!-- 5. BRIEF -->
  {brief}

  {foot}
</main>

'''.format(nav=nav, eyebrow=t('eyebrow'), h1=t('h1'), h1g=t('h1_grey'), panel=panel, signup=SIGNUP, cta=t('cta'),
           svb=svb, compare=t('compare'), arrow=C.ARROW, fine_ref=t('fine_ref'), fine_risk=t('fine_risk'), talk=t('talk'), L=L,
           call=t('call'), suffix=suffix, trust=trust, hh2a=t('h_h2_a'), hh2b=t('h_h2_b'), steps=steps, wh2a=t('w_h2_a'),
           wh2b=t('w_h2_b'), ways=ways, fh2a=t('f_h2_a'), fh2b=t('f_h2_b'), faq=faq, brief=C.brief(L, t, root, 'lending_brief'), foot=foot)
    out = C.fix_links(L, head + body + C.scripts(root))
    open(page_path, 'w').write(out)
    print('%s: %d bytes' % (L, len(out)))


if __name__ == '__main__':
    for L in sys.argv[1:]:
        build(L)
