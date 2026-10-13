#!/usr/bin/env python3
"""Build the Stacking Strategist page shells (stacking.html, design v2) for the 10 languages.

usage: python3 build_stacking.py [en sk ...]     (texts: <lang>.json next to this file)

The page around the app is static HTML: shared nav/footer, centred hero, How it works, FAQ,
Brief card, related tools. The React app (layer2-src, built into concierge-assets/) renders
only the calculator into #root. The app's asset lines are kept from the current shell;
i18n-tools/layer2/deploy.py rewrites them after every app build (run this builder after it).
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
import build_fee_index as F
C, B, SITE, ORIGIN = F.C, F.B, F.SITE, F.ORIGIN
LANGS = ['en', 'sk', 'cs', 'uk', 'ru', 'de', 'fr', 'es', 'pl', 'hu']   # hreflang order as before


def url(L):
    return '/stacking.html' if L == 'en' else '/%s/stacking.html' % L


def build(L):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    Bt = json.load(open(os.path.join(TOOLS, 'bots', L + '.json')))
    T.update({x: v for x, v in Bt.items() if x.startswith('b_') or x == 'email'})
    t = T
    page = url(L)
    shell = os.path.join(SITE, page.lstrip('/'))
    old = open(shell).read()
    assets = '\n'.join(l for l in old.split('\n') if 'concierge-assets/' in l)
    if not assets:
        sys.exit('%s: no app asset lines found' % shell)

    alts = [(x, url(x)) for x in LANGS] + [('x-default', url('en'))]
    faq = [(t['q%d' % i], t['a%d' % i]) for i in range(1, 5)]
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [
        F.crumbs_ld([(t['crumb_home'], '/' if L == 'en' else '/%s/' % L), (t['crumb_page'], page)]),
        {'@type': 'WebApplication', 'name': 'Stacking Strategist', 'url': ORIGIN + page, 'inLanguage': L, 'applicationCategory': 'FinanceApplication',
         'operatingSystem': 'Web', 'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'},
         'publisher': {'@id': ORIGIN + '/#org'}, 'dateModified': '2026-10-12'},
        F.faq_ld([(F.plain(q), F.plain(a)) for q, a in faq])]}
    out = F.head(L, t['title'], t['description'], page, alts, ld, og_title=t['og_title'], og_alt=t['og_title'], title_max=70, og_image=F.ORIGIN + '/og/stacking.jpg')
    out = out.replace('</head>', assets + '\n</head>', 1)
    nav, foot = F.chrome(L, url)
    nav = re.sub(r'(<a href="%s")' % re.escape(page), r'\1 aria-current="page"', nav, count=1)

    loc = lambda p: ('/' if L == 'en' else '/%s/' % L) + p
    def page_url(p):   # the language's own page when it exists
        return loc(p) if L == 'en' or os.path.exists(os.path.join(SITE, L, p)) else '/' + p
    steps = ''.join('''      <div class="how-log-item">
        <div class="how-log-marker"><span class="how-log-dot"></span></div>
        <div class="how-log-body">
          <span class="how-log-num">{step} 0{i}</span>
          <h3>{tt}</h3>
          <p>{pp}</p>
        </div>
      </div>
'''.format(step=t['step'], i=i, tt=t['s%d_t' % i], pp=t['s%d_p' % i]) for i in range(1, 4))
    faq_html = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (' open' if i == 0 else '', q, a) for i, (q, a) in enumerate(faq))
    fee = '/bitcoin-fee-index/' if L == 'en' else '/%s/%s/' % (L, B.GUIDES[L][1])
    dca = '/bitcoin-dca-calculator/' if L == 'en' else '/%s/%s/' % (L, B.GUIDES[L][2])
    rel = [(fee, 'rel_fee'), (page_url('retirement-calculator.html'), 'rel_ret'), (page_url('concierge.html'), 'rel_pf'), (dca, 'rel_dca'),
           (page_url('buy-bitcoin.html'), 'rel_buy'), (page_url('cfo.html'), 'rel_cfo')]
    rcards = ''.join('<a class="gcard" href="%s"><b>%s</b><span>%s</span></a>' % (u, t[x + '_t'], t[x + '_p']) for u, x in rel)

    out += '''<body class="page-buy page-fee page-pf page-stack no-split">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO + the calculator -->
  <div class="buy-hero2 pf-hero">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-or">{h1o}</span></h1>
    <p class="sp-lead">{lead}</p>
  </div>
  <div class="pf-app st-app" id="plan">
    <div id="root"><noscript><p class="pf-noscript">{noscript}</p></noscript></div>
  </div>

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

'''.format(nav=nav, eyebrow=t['eyebrow'], h1=t['h1'], h1o=t['h1_or'], lead=t['lead'], noscript=t['noscript'],
           hh2a=t['how_h2_a'], hh2b=t['how_h2_b'], steps=steps, qh2a=t['faq_h2_a'], qh2b=t['faq_h2_b'], faq=faq_html,
           brief=F.brief_card(L, t, 'stacking_brief'), rh2a=t['rel_h2_a'], rh2b=t['rel_h2_b'], rcards=rcards, disclaimer=t['disclaimer'], foot=foot)
    out += C.scripts('/').replace('site-v2.js?v=5', 'site-v2.js?v=6')
    F.check_text(out, L)
    open(shell, 'w').write(out)
    print('%-20s %6d bytes' % (page, len(out)))


def main():
    for L in sys.argv[1:] or LANGS:
        build(L)


if __name__ == '__main__':
    main()
