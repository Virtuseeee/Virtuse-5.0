#!/usr/bin/env python3
"""Build the About page (about.html, design v2) for the 10 languages.

usage: python3 build_about.py [en sk ...]     (texts: <lang>.json next to this file)

Everything is static HTML rendered here: shared nav/footer, centred hero, stats, timeline,
founder (id="founder"), how we work, our name (virtu), how we look at partners, Brief card,
Explore the hub (tools, Brief, services, Virtuse CFO card).
The partner count comes from data/partners.json ("partners" only, not "tracked" or
"memberships") and is shown with AS_OF. JSON-LD: BreadcrumbList + Person only (no
Organization, Ras's decision 13 Oct 2026). A language without a JSON file is skipped and
its page is left as it is.
"""
import html, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
import build_fee_index as F
C, B, SITE, ORIGIN = F.C, F.B, F.SITE, F.ORIGIN
LANGS = ['en', 'sk', 'cs', 'uk', 'ru', 'de', 'fr', 'es', 'pl', 'hu']   # hreflang order as before
AS_OF = '2026-10-13'
PHOTO = '/img/team/ras-vasilisin-400'
SAME_AS = [('link_linkedin', 'https://www.linkedin.com/in/rastislav-vasilisin-11bb5819/'),
           ('link_hackernoon', 'https://hackernoon.com/u/ras'),
           ('link_x', 'https://x.com/RasVasilisin')]
BANNED = ('MiCA-licensed', 'insured', '100+', 'Singapore', 'Bratislava', 'offices')

CSS = '''<style>
/* ABOUT (page-about) */
.ab-stats { display: flex; justify-content: center; gap: 16px; margin: 28px auto 0; flex-wrap: wrap; }
.ab-stat { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px 26px; min-width: 200px; text-align: center; }
.ab-stat b { display: block; font-size: 34px; font-weight: 700; letter-spacing: -.02em; }
.ab-stat span { display: block; margin-top: 4px; font-size: 13px; color: var(--muted); }
.page-about .how-log-num { order: 0; margin: 0 0 10px; color: var(--orange); }
.ab-founder { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 36px; align-items: start; background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 28px; }
.ab-founder picture, .ab-founder img { display: block; width: 100%; height: auto; border-radius: 14px; }
.ab-founder h3 { font-size: 24px; font-weight: 700; margin: 0; }
.ab-role { margin: 4px 0 16px; font-size: 14px; color: var(--muted); }
.ab-bio { margin: 0; font-size: 17px; line-height: 1.65; color: var(--text); max-width: 720px; }
.ab-links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
.ab-links a { border: 1px solid var(--line-strong); border-radius: 10px; padding: 8px 14px; font: 600 14px var(--sans); color: var(--text); text-decoration: none; }
.ab-links a:hover { background: var(--card-hover); }
.ab-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.ab-cards.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.ab-card { background: var(--card); border-radius: 16px; padding: 22px 24px; min-width: 0; }
.ab-card b { display: block; font-size: 17px; font-weight: 600; margin-bottom: 8px; }
.ab-card p { margin: 0; font-size: 15px; color: var(--muted); line-height: 1.6; }
.ab-name { max-width: 760px; }
.ab-name p { font-size: 18px; line-height: 1.7; color: var(--muted); margin: 0 0 14px; }
.ab-name p:last-child { color: var(--text); font-weight: 600; }
.ab-label { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.ab-intro { font-size: 17px; color: var(--muted); max-width: 760px; margin: 0 0 24px; line-height: 1.6; }
.ab-licence { margin: 24px 0 0; font-size: 15px; color: var(--text); line-height: 1.6; max-width: 760px; }
.ab-licence a { color: var(--text); }
.ab-sub { font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 14px; }
.ab-sub ~ .gcards { margin-bottom: 32px; }
.ab-cfo { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: var(--card); border: 1px solid var(--line-strong); border-radius: 16px; padding: 18px 20px; }
.ab-cfo p { margin: 0; font-size: 14px; line-height: 1.5; min-width: 0; }
.ab-cfo b { font-weight: 600; }
.ab-cfo a { flex: none; border: 1px solid var(--line-strong); border-radius: 10px; padding: 10px 16px; font: 600 14px var(--sans); color: var(--text); text-decoration: none; white-space: nowrap; }
.ab-cfo a:hover { background: var(--card-hover); }
@media (max-width: 900px) {
  .ab-cards, .ab-cards.four { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .ab-founder { grid-template-columns: 180px minmax(0, 1fr); gap: 24px; }
}
@media (max-width: 600px) {
  .ab-cards, .ab-cards.four { grid-template-columns: minmax(0, 1fr); }
  .ab-founder { grid-template-columns: minmax(0, 1fr); padding: 20px; }
  .ab-founder picture { max-width: 220px; }
  .ab-stat { min-width: 0; flex: 1 1 140px; padding: 16px; }
  .ab-cfo { flex-direction: column; align-items: stretch; }
  .ab-cfo a { text-align: center; }
}
</style>
'''


def url(L):
    return '/about.html' if L == 'en' else '/%s/about.html' % L


def esc(s):
    return html.escape(s, quote=True)


def partner_count():
    d = json.load(open(os.path.join(SITE, 'data', 'partners.json')))
    return len(d['partners'])


def check_own(out, t, where):
    """No en/em dash in our visible text, title, meta (the shared nav/footer are the homepage's) and no banned claims."""
    own = re.sub(r'<header class="nav">.*?</header>|<footer\b.*?</footer>|<script\b.*?</script>|<style\b.*?</style>', '', out, flags=re.S)
    for ch in ('—', '–', '&mdash;', '&ndash;'):
        if ch in own or any(ch in v for k, v in t.items() if not k.startswith('_')):
            sys.exit('%s: dash %r in page text, meta or texts' % (where, ch))
    if where == 'en':
        vis = re.sub(r'<[^>]+>', ' ', own)
        for w in BANNED:
            if w.lower() in vis.lower():
                sys.exit('%s: banned word %r' % (where, w))


def build(L):
    jf = os.path.join(HERE, L + '.json')
    if not os.path.exists(jf):
        print('%s: no %s.json, page left as it is' % (L, L))
        return
    T = json.load(open(jf))
    Bt = json.load(open(os.path.join(TOOLS, 'bots', L + '.json')))
    T.update({x: v for x, v in Bt.items() if x.startswith('b_') or x == 'email'})
    t = T
    page = url(L)
    shell = os.path.join(SITE, page.lstrip('/'))
    n = partner_count()
    date = F.date_str(AS_OF, L)

    alts = [(x, url(x)) for x in LANGS] + [('x-default', url('en'))]
    person = {'@type': 'Person', 'name': 'Rastislav Vasilisin', 'alternateName': 'Ras Vasilisin', 'jobTitle': 'Founder',
              'image': ORIGIN + PHOTO + '.webp', 'url': ORIGIN + page + '#founder', 'sameAs': [u for _, u in SAME_AS]}
    ld = {'@context': 'https://schema.org', '@graph': [
        F.crumbs_ld([(t['crumb_home'], '/' if L == 'en' else '/%s/' % L), (t['crumb_page'], page)]), person]}
    out = F.head(L, t['title'], t['description'], page, alts, ld, og_title=t['og_title'], og_alt=t['og_title'], title_max=70,
                 og_image=ORIGIN + '/og/about.jpg')
    # CSP: C.finalize() keeps only the third-party origins this page uses.
    out = out.replace('</head>', CSS + '</head>', 1)
    nav, foot = F.chrome(L, url)
    nav = re.sub(r'(<a href="%s")' % re.escape(page), r'\1 aria-current="page"', nav, count=1)

    loc = lambda p: ('/' if L == 'en' else '/%s/' % L) + p
    def page_url(p):   # the language's own page when it exists
        return loc(p) if L == 'en' or os.path.exists(os.path.join(SITE, L, p)) else '/' + p

    stats = '<div class="ab-stats"><div class="ab-stat"><b>%s</b><span>%s</span></div><div class="ab-stat"><b>%d</b><span>%s</span></div></div>' % (
        t['stat_founded_n'], t['stat_founded'], n, t['stat_partners'].replace('{date}', date).replace('{n}', str(n)))

    timeline = ''.join('''      <div class="how-log-item">
        <div class="how-log-marker"><span class="how-log-dot"></span></div>
        <div class="how-log-body">
          <span class="how-log-num">{y}</span>
          <h3>{tt}</h3>
          <p>{pp}</p>
        </div>
      </div>
'''.format(y=t['t%d_year' % i], tt=t['t%d_t' % i], pp=t['t%d_p' % i]) for i in range(1, 5))

    links = ''.join('<a href="%s" rel="me noopener" target="_blank">%s</a>' % (u, t[k]) for k, u in SAME_AS)
    founder = '''<div class="ab-founder">
      <picture><source srcset="{p}.webp" type="image/webp"><img src="{p}.jpg" width="400" height="496" alt="{alt}" loading="lazy"></picture>
      <div>
        <h3>{name}</h3>
        <p class="ab-role">{role}</p>
        <p class="ab-bio">{bio}</p>
        <nav class="ab-links" aria-label="{ll}">{links}</nav>
      </div>
    </div>'''.format(p=PHOTO, alt=esc(t['founder_alt']), name=t['founder_name'], role=t['founder_role'], bio=t['founder_bio'],
                     ll=esc(t['founder_links_label']), links=links)

    card = lambda k: '<div class="ab-card"><b>%s</b><p>%s</p></div>' % (t[k + '_t'], t[k + '_p'])
    values = ''.join(card('v%d' % i) for i in range(1, 4))
    vet = ''.join(card('k%d' % i) for i in range(1, 5))
    pf = page_url('concierge.html')

    gc = lambda u, k: '<a class="gcard" href="%s"><b>%s</b><span>%s</span></a>' % (u, t[k + '_t'], t[k + '_p'])
    tools = ''.join(gc(page_url(p), k) for p, k in [('concierge.html', 'x_pf'), ('stacking.html', 'x_stack'), ('loan.html', 'x_loan'),
                                                     ('tax-agent.html', 'x_tax'), ('retirement-calculator.html', 'x_ret'), ('news.html', 'x_brief')])
    services = ''.join(gc(page_url(p), k) for p, k in [('buy-bitcoin.html', 'x_buy'), ('secure.html', 'x_sec'), ('lending.html', 'x_loans'),
                                                        ('mining.html', 'x_mining'), ('treasury.html', 'x_treasury'), ('tax.html', 'x_taxrep'),
                                                        ('bots.html', 'x_bots')])
    cfo_href = page_url('cfo.html') + '?utm_source=about&utm_medium=cta&utm_campaign=cfo#waitForm'
    cfo = '<div class="ab-cfo"><p><b>%s</b><br>%s</p><a href="%s" data-cta="cfo">%s</a></div>' % (t['cfo_label'], t['cfo_text'], cfo_href, t['cfo_link'])

    out += '''<body class="page-buy page-fee page-pf page-about no-split">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO -->
  <div class="buy-hero2 pf-hero">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-or">{h1o}</span></h1>
    <p class="sp-lead">{lead}</p>
    {stats}
  </div>

  <!-- 2. STORY -->
  <section id="story">
    <div class="sec-head one"><div class="sec-copy"><h2>{sh2a} <span>{sh2b}</span></h2></div></div>
    <div class="how-log">
{timeline}    </div>
  </section>

  <!-- 3. FOUNDER -->
  <section id="founder">
    <div class="sec-head one"><div class="sec-copy"><h2>{fh2a} <span>{fh2b}</span></h2></div></div>
    {founder}
  </section>

  <!-- 4. HOW WE WORK -->
  <section id="values">
    <div class="sec-head one"><div class="sec-copy"><h2>{vh2a} <span>{vh2b}</span></h2></div></div>
    <div class="ab-cards">{values}</div>
  </section>

  <!-- 5. OUR NAME -->
  <section id="name">
    <div class="sec-head one"><div class="sec-copy"><span class="ab-label">{nlabel}</span><h2>{nh2a} <span>{nh2b}</span></h2></div></div>
    <div class="ab-name"><p>{np1}</p><p>{np2}</p><p>{np3}</p></div>
  </section>

  <!-- 6. HOW WE LOOK AT PARTNERS -->
  <section id="vetting">
    <div class="sec-head one"><div class="sec-copy"><h2>{kh2a} <span>{kh2b}</span></h2></div></div>
    <p class="ab-intro">{kintro}</p>
    <div class="ab-cards four">{vet}</div>
    <p class="ab-licence">{licence} <a href="{pf}">{pflink}</a></p>
  </section>

  <!-- 7. BRIEF -->
  {brief}

  <!-- 8. EXPLORE THE HUB -->
  <section id="explore">
    <div class="sec-head one"><div class="sec-copy"><h2>{xh2a} <span>{xh2b}</span></h2></div></div>
    <p class="ab-sub">{xtools}</p>
    <div class="gcards">{tools}</div>
    <p class="ab-sub">{xserv}</p>
    <div class="gcards">{services}</div>
    {cfo}
  </section>

  {foot}
</main>

'''.format(nav=nav, eyebrow=t['eyebrow'], h1=t['h1'], h1o=t['h1_or'], lead=t['lead'], stats=stats,
           sh2a=t['story_h2_a'], sh2b=t['story_h2_b'], timeline=timeline,
           fh2a=t['founder_h2_a'], fh2b=t['founder_h2_b'], founder=founder,
           vh2a=t['values_h2_a'], vh2b=t['values_h2_b'], values=values,
           nlabel=t['name_label'], nh2a=t['name_h2_a'], nh2b=t['name_h2_b'], np1=t['name_p1'], np2=t['name_p2'], np3=t['name_p3'],
           kh2a=t['vet_h2_a'], kh2b=t['vet_h2_b'], kintro=t['vet_intro'], vet=vet, licence=t['vet_licence'], pf=pf, pflink=t['vet_link'],
           brief=F.brief_card(L, t, 'about_brief'),
           xh2a=t['explore_h2_a'], xh2b=t['explore_h2_b'], xtools=t['explore_tools'], tools=tools, xserv=t['explore_services'],
           services=services, cfo=cfo, foot=foot)
    out += C.scripts('/')
    F.check_text(out, L)
    check_own(out, t, L)
    for bad in ('lang-detect.js', 'anime', 'cdn.jsdelivr.net', 'GTM-M4C5VRD'):
        assert bad not in out, (L, bad)
    assert out.count("'GTM-KXX4Q6WH'") == 1, L
    open(shell, 'w').write(C.finalize(out, shell))
    print('%-20s %6d bytes, %d partners as of %s' % (page, len(out), n, date))


def main():
    for L in sys.argv[1:] or LANGS:
        build(L)


if __name__ == '__main__':
    main()
