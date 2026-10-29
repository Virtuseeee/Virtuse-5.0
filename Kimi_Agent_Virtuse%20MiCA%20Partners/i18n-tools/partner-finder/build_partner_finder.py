#!/usr/bin/env python3
"""Build the Partner Finder page shells (concierge.html, design v2) for the 10 languages.

usage: python3 build_partner_finder.py [en sk ...]     (texts: <lang>.json next to this file)

The page around the app is static HTML: shared nav/footer, centred hero, How it works,
partner ecosystem, FAQ, Brief card, related tools. The React app (layer2-src, built into
concierge-assets/) renders only the chat into #root. Inside the site's launcher iframe the
page shows only the chat (html.vc-embed). The app's asset lines are kept from the current
shell; i18n-tools/layer2/deploy.py rewrites them after every app build.
Counts (partners, categories, countries) come from layer2-src/src/lib/concierge.ts.
"""
import html, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
import build_fee_index as F
C, B, SITE, ORIGIN = F.C, F.B, F.SITE, F.ORIGIN
LANGS = ['en', 'sk', 'cs', 'uk', 'ru', 'de', 'fr', 'es', 'pl', 'hu']   # hreflang order as before
LOGO_CLASS = {'logo-bybit.png': 'dark', 'logo-kraken.png': 'cover', 'logo-invity.svg': 'pad'}
NAME_FIX = {'ByBit EU': 'Bybit EU', 'PowerMining': 'Power Mining'}
CAT_ORDER = ['buy', 'custody', 'loans', 'tax', 'bots', 'mining', 'treasury']


def url(L):
    return '/concierge.html' if L == 'en' else '/%s/concierge.html' % L


def counts():
    src = open(os.path.join(F.REPO, 'layer2-src', 'src', 'lib', 'concierge.ts')).read()
    block = lambda name: src.split('export const %s' % name)[1].split('\n];')[0]
    n = len(re.findall(r"^\s*id: '", block('PARTNERS'), re.M))
    c = len(re.findall(r"\{ id: '", block('GOALS')))
    k = len(re.findall(r"\{ id: '", block('COUNTRIES')))
    return n, c, k


def build(L, n, c, k, partners):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    Bt = json.load(open(os.path.join(TOOLS, 'bots', L + '.json')))
    T.update({x: v for x, v in Bt.items() if x.startswith('b_') or x == 'email'})
    t = {x: (v.replace('{n}', str(n)).replace('{c}', str(c)).replace('{k}', str(k)) if isinstance(v, str) else v) for x, v in T.items()}
    page = url(L)
    shell = os.path.join(SITE, page.lstrip('/'))
    old = open(shell).read()
    assets = '\n'.join(l for l in old.split('\n') if 'concierge-assets/' in l)
    if not assets:
        sys.exit('%s: no app asset lines found' % shell)
    if L != 'en':   # the language folder: asset paths are ../concierge-assets/
        assets = assets.replace('"./concierge-assets/', '"../concierge-assets/')

    alts = [(x, url(x)) for x in LANGS] + [('x-default', url('en'))]
    faq = [(t['q%d' % i], t['a%d' % i]) for i in range(1, 5)]
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [
        F.crumbs_ld([(t['crumb_home'], '/' if L == 'en' else '/%s/' % L), (t['crumb_page'], page)]),
        {'@type': 'WebApplication', 'name': 'Partner Finder', 'url': ORIGIN + page, 'inLanguage': L, 'applicationCategory': 'FinanceApplication',
         'operatingSystem': 'Web', 'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'},
         'publisher': {'@id': ORIGIN + '/#org'}, 'dateModified': '2026-10-12'},
        F.faq_ld([(F.plain(q), F.plain(a)) for q, a in faq])]}
    out = F.head(L, t['title'], t['description'], page, alts, ld, og_title=t['og_title'], og_alt=t['og_title'], title_max=70, og_image=F.ORIGIN + '/og/concierge.jpg')
    # inside the site's launcher iframe only the chat is shown (decided before first paint)
    embed = "<script>try{if(window.top!==window.self||/[?&]utm_medium=launcher(&|$)/.test(location.search))document.documentElement.classList.add('vc-embed')}catch(e){document.documentElement.classList.add('vc-embed')}</script>\n"
    out = out.replace('</head>', embed + assets + '\n</head>', 1)
    nav, foot = F.chrome(L, url, comma=False)
    nav = re.sub(r'(<a href="%s")' % re.escape(page), r'\1 aria-current="page"', nav, count=1)

    loc = lambda p: ('/' if L == 'en' else '/%s/' % L) + p
    def page_url(p):   # the language's own category page when it exists
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
    cards = []
    for cat in CAT_ORDER:
        for p in [x for x in partners if x['category'] == cat]:
            name = NAME_FIX.get(p['name'], p['name'])
            cards.append('<a class="pf-card" href="{u}"><img src="/{logo}" alt="" width="36" height="36" class="{lc}" loading="lazy"><span><b>{name}</b><small>{cat}</small></span></a>'.format(
                u=page_url(p['page']), logo=p['logo'], lc=LOGO_CLASS.get(p['logo'], ''), name=name, cat=t['cat_' + cat]))
    faq_html = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (' open' if i == 0 else '', q, a) for i, (q, a) in enumerate(faq))
    fee = '/bitcoin-fee-index/' if L == 'en' else '/%s/%s/' % (L, B.GUIDES[L][1])
    rel = [(page_url('stacking.html'), 'rel_stack'), (page_url('retirement-calculator.html'), 'rel_ret'), (fee, 'rel_fee'), (page_url('buy-bitcoin.html'), 'rel_buy'),
           (page_url('loan.html'), 'rel_loan'), (page_url('cfo.html'), 'rel_cfo')]
    rcards = ''.join('<a class="gcard" href="%s"><b>%s</b><span>%s</span></a>' % (u, t[x + '_t'], t[x + '_p']) for u, x in rel)

    out += '''<body class="page-buy page-fee page-pf no-split">
{nav}

<main class="wrap acc acc-pink" id="top">

  <!-- 1. HERO + the app -->
  <div class="buy-hero2 pf-hero">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1o}</span></h1>
    <p class="sp-lead">{lead}</p>
    <p class="pf-counts">{counts}</p>
  </div>
  <div class="pf-app" id="finder">
    <div id="root"><noscript><p class="pf-noscript">{noscript}</p></noscript></div>
    <p class="pf-disc">{disc}</p>
  </div>

  <!-- 2. HOW IT WORKS -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log">
{steps}    </div>
  </section>

  <!-- 3. PARTNER ECOSYSTEM -->
  <section id="partners">
    <div class="sec-head one"><div class="sec-copy"><h2>{eh2a} <span>{eh2b}</span></h2><p>{ep}</p></div></div>
    <div class="pf-grid">{cards}</div>
  </section>

  <!-- 4. FAQ -->
  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{qh2a} <span>{qh2b}</span></h2></div></div>
    {faq}
  </section>

  <!-- 5. BRIEF -->
  {brief}

  <!-- 6. RELATED TOOLS -->
  <section id="related">
    <div class="sec-head one"><div class="sec-copy"><h2>{rh2a} <span>{rh2b}</span></h2></div></div>
    <div class="gcards">{rcards}</div>
    <p class="tx-fine fi-disc">{disc} {disclaimer}</p>
  </section>

  {foot}
</main>

'''.format(nav=nav, eyebrow=t['eyebrow'], h1=t['h1'], h1o=t['h1_or'], lead=t['lead'], counts=t['counts'], noscript=t['noscript'],
           disc=t['disclosure'], hh2a=t['how_h2_a'], hh2b=t['how_h2_b'], steps=steps, eh2a=t['eco_h2_a'], eh2b=t['eco_h2_b'], ep=t['eco_p'],
           cards=''.join(cards), qh2a=t['faq_h2_a'], qh2b=t['faq_h2_b'], faq=faq_html, brief=F.brief_card(L, t, 'partner_finder_brief'),
           rh2a=t['rel_h2_a'], rh2b=t['rel_h2_b'], rcards=rcards, disclaimer=t['disclaimer'], foot=foot)
    # the page is the Partner Finder itself: no launcher bubble here
    out += C.scripts('/').replace('<script src="/concierge-launcher.js" defer></script>\n', '')
    F.check_text(out, L)
    open(shell, 'w').write(C.finalize(out, shell))
    print('%-20s %6d bytes' % (page, len(out)))


def main():
    n, c, k = counts()
    partners = json.load(open(os.path.join(SITE, 'data', 'partners.json')))['partners']
    if len(partners) != n:
        sys.exit('partners.json has %d partners, concierge.ts %d' % (len(partners), n))
    print('counts: %d partners, %d categories, %d countries' % (n, c, k))
    for L in sys.argv[1:] or LANGS:
        build(L, n, c, k, partners)


if __name__ == '__main__':
    main()
