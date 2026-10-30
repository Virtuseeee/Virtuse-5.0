#!/usr/bin/env python3
"""Build the Bitcoin Fee Index pages (design v2) from one fee table.

usage: python3 build_fee_index.py            all 10 languages + the EN extra pages
       python3 build_fee_index.py en sk      only these languages (main page)

Data: seo-build/data/fee-index.json (fees, sources, spreads, check date); fee_pct
must match seo-build/data/fee-schedule-live.json (the Stacking Strategist table).
The Q3 2026 archive keeps its frozen numbers from fee-schedule-2026-q3.json.
Texts: <lang>.json next to this file; Brief texts come from ../bots/<lang>.json.

Pages written (seo-build no longer writes them, it only lists them in the sitemap):
  bitcoin-fee-index/index.html and the 9 translations (<lang>/<slug>/index.html)
  bitcoin-fee-index/methodology/index.html, print.html, embed/index.html,
  2026-q3/index.html, 2026-q3/print.html  (EN only)
Every page except the embed gets the standard consent + GTM head from buy-bitcoin.html.
The embed is shown inside other sites, so it gets no GTM and no cookie banner.
"""
import datetime, html, json, os, posixpath, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, TOOLS)
import v2common as C
import aff_note as A
B = C.B
SITE = C.SITE
REPO = os.path.dirname(SITE)
DATA = os.path.join(REPO, 'seo-build', 'data')
ORIGIN = 'https://virtuse.com'
LANGS = ['en', 'de', 'sk', 'cs', 'pl', 'hu', 'uk', 'ru', 'fr', 'es']   # hreflang order as before
AMOUNTS = [50, 100, 250, 500, 1000]
DEFAULT = 100
LOCALE = {'en': 'en_US', 'de': 'de_DE', 'sk': 'sk_SK', 'cs': 'cs_CZ', 'pl': 'pl_PL', 'hu': 'hu_HU', 'uk': 'uk_UA', 'ru': 'ru_RU', 'fr': 'fr_FR', 'es': 'es_ES'}
MONTHS = {
    'en': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
OG_IMAGE = ORIGIN + '/og-cover.jpg'
CSS_V = '6'
esc = html.escape


def slug(L):
    return 'bitcoin-fee-index' if L == 'en' else B.GUIDES[L][1]


def url(L):
    return '/bitcoin-fee-index/' if L == 'en' else '/%s/%s/' % (L, slug(L))


def out_file(L):
    return os.path.join(SITE, url(L).strip('/'), 'index.html')


def date_str(iso, L):
    d = datetime.date.fromisoformat(iso)
    if L == 'en':
        return '%d %s %d' % (d.day, MONTHS['en'][d.month - 1], d.year)
    if L == 'hu':
        return '%d. %02d. %02d.' % (d.year, d.month, d.day)
    if L in ('de', 'pl', 'uk', 'ru'):
        return '%02d.%02d.%d' % (d.day, d.month, d.year)
    if L in ('fr', 'es'):
        return '%02d/%02d/%d' % (d.day, d.month, d.year)
    return '%d. %d. %d' % (d.day, d.month, d.year)   # sk, cs


def pct(v, L):
    if v is None:
        return '–'
    sp = ' %' if L in C.PCT_SPACE else '%'
    dec = '.' if L == 'en' else ','
    if 0 < v < 0.005:
        return '&lt;0' + dec + '01' + sp
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return s.replace('.', dec) + sp


def eur(n, L):
    return C.eur(n, L).replace(' €', ' €')


def load():
    fi = json.load(open(os.path.join(DATA, 'fee-index.json')))
    live = {r['id']: r for r in json.load(open(os.path.join(DATA, 'fee-schedule-live.json')))['rows']}
    for r in fi['rows']:
        want = round(live[r['id']]['pct'] * 100, 4)
        if round(r['fee_pct'], 4) != want:
            sys.exit('fee-index.json %s fee %s%% differs from fee-schedule-live.json %s%%' % (r['id'], r['fee_pct'], want))
    if set(live) != {r['id'] for r in fi['rows']}:
        sys.exit('fee-index.json partners differ from fee-schedule-live.json')
    s21 = fi.get('spread_21bitcoin', {}).get('pct')
    if s21 is None:
        prev = os.environ.get('FEE_INDEX_PREVIEW_21_SPREAD')   # local preview only, never committed
        if prev is None:
            print('NOTE: 21bitcoin spread not measured yet: 21bitcoin is listed without a rank')
            return fi, None
        s21 = float(prev)
        print('PREVIEW: 21bitcoin spread %s%% (not measured)' % s21)
    return fi, s21


def spread_for(fi, s21, pid, amount):
    if pid == '21bitcoin':
        return s21
    return fi['spreads']['pct'][pid][str(amount)]


def ranked(fi, s21, amount):
    """Rows by total cost; a route whose spread isn't measured yet (21bitcoin before its
    first measurement) goes last, without a rank: a 0% fee alone must not put it first."""
    rows = []
    for r in fi['rows']:
        sp = spread_for(fi, s21, r['id'], amount)
        pending = sp is None
        total = None if pending else r['fee_pct'] + sp
        rows.append(dict(r, spread=sp, total=total, pending=pending, year=None if pending else 12 * amount * total / 100))
    return sorted(rows, key=lambda x: (x['pending'], x['total'] or 0, x['name']))


# ---------- shared head / chrome ----------

def standard_block():
    s = open(os.path.join(SITE, 'buy-bitcoin.html')).read()
    i = s.index('<!-- vb-consent -->')
    j = s.index('</script>', s.index("'GTM-KXX4Q6WH'")) + len('</script>')
    block = s[i:j]
    for part in ('/cookie-consent.js', '/partner-click.js', '/partner-capture.js', 'GTM-KXX4Q6WH'):
        assert part in block, part
    return block


def csp():
    home = open(os.path.join(SITE, 'index.html')).read()
    return re.search(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', home).group(0)


def i18n_script(L):
    if L == 'en':
        return ''
    H = json.load(open(os.path.join(TOOLS, 'home', L + '.json')))
    keys = {'openMenu': 'Open menu', 'closeMenu': 'Close menu', 'latestBrief': 'Latest Brief · ',
            'min': ' min', 'coverImage': 'Cover image: ', 'badEmail': 'Please enter a valid email address.', 'sending': 'Sending...',
            'subscribed': "You're in. Brief goes out Monday.", 'error': 'Something went wrong. Please try again.', 'netError': 'Network error. Please try again.'}
    obj = {k: html.unescape(H[v]) for k, v in keys.items()}
    obj['briefLangNote'] = ' (%s)' % B.BRIEF_EN[L]
    return '<script>window.VB_I18N = %s;</script>\n' % json.dumps(obj, ensure_ascii=False)


def head(L, title, desc, page_url, alts, ld, og_title=None, og_alt=None, robots='index, follow', gtm=True, og_type='website', title_max=60, og_image=None):
    assert len(title) <= title_max, (L, len(title), title)
    assert len(desc) <= 155, (L, len(desc), desc)
    og_title = og_title or title
    alt_links = ''.join('<link rel="alternate" hreflang="%s" href="%s%s">\n' % (h, ORIGIN, u) for h, u in alts)
    meta = '''<!DOCTYPE html>
<html lang="{L}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
{csp}
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="color-scheme" content="dark">
{std}
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{origin}{url}">
{alts}<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="shortcut icon" href="/favicon.ico">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Virtuse">
<meta property="og:title" content="{og_title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{origin}{url}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{og_alt}">
<meta property="og:locale" content="{locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{og_title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{img}">
<meta name="twitter:image:alt" content="{og_alt}">
<script type="application/ld+json">{ld}</script>
<meta name="vb-cfo-stage" content="wait">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/site-v2.css?v={v}">
<script>if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('anim');</script>
{i18n}</head>
'''.format(L=L, csp=csp(), std=standard_block() if gtm else '', title=esc(title, False), desc=esc(desc), robots=robots, origin=ORIGIN,
           url=page_url, alts=alt_links, og_type=og_type, og_title=esc(og_title), img=og_image or OG_IMAGE, og_alt=esc(og_alt or og_title),
           locale=LOCALE[L], ld=json.dumps(ld, ensure_ascii=False, indent=2), v=CSS_V, i18n=i18n_script(L))
    if not gtm:
        meta = meta.replace('<meta name="vb-cfo-stage" content="wait">\n', '')
    return meta


def absolutize(fragment, L):
    base = '/' if L == 'en' else '/%s/' % L

    def fix(m):
        attr, u = m.group(1), m.group(2)
        if re.match(r'(https?:|mailto:|tel:|#|data:|/|javascript:)', u):
            return m.group(0)
        path, rest = re.match(r'([^?#]*)(.*)', u).groups()
        if L == 'sk' and path == 'blog.html':
            path = '../blog-sk.html'
        full = posixpath.normpath(posixpath.join(base, path)) if path else base
        if path.endswith('/') and not full.endswith('/'):
            full += '/'
        if L != 'en' and full.startswith(base) and not os.path.exists(os.path.join(SITE, full.lstrip('/'))):
            full = '/' + full[len(base):]       # no page in the language folder: the EN one
        return '%s="%s%s"' % (attr, full, rest)
    return re.sub(r'\b(href|src)="([^"]*)"', fix, fragment)


def chrome(L, lang_url, comma=True):
    """Nav + footer of the language's v2 homepage; the language menus point at lang_url(x).
    comma=True: the footer Brief line gets a comma instead of the long dash (fee-index and SEO pages);
    the hub and tool pages keep the homepage's own line (sk: comma, other languages: &mdash;)."""
    home = open(os.path.join(SITE, ('' if L == 'en' else L + '/') + 'index.html')).read()
    nav = home[home.index('<header class="nav">'):home.index('</header>') + len('</header>')]
    nav = re.sub(r'<a class="logo" href="[^"]*"', '<a class="logo" href="index.html"', nav)
    foot = home[home.index('<footer class="footer-main">'):home.index('</footer>') + len('</footer>')]
    nav, foot = absolutize(nav, L), absolutize(foot, L)
    if comma:
        # no long dash in the footer Brief line (&mdash;); the literal dash in the uk/ru legal
        # sentence ("Virtuse — незалежний хаб…") is its verb and stays
        foot = foot.replace(' &mdash; ', ', ')

    def langs(seg):
        def one(m):
            tag = m.group(0)
            x = re.search(r'hreflang="([a-z]{2})"', tag).group(1)
            return re.sub(r'href="[^"]*"', 'href="%s"' % lang_url(x), tag, count=1)
        return re.sub(r'<a [^>]*hreflang="[a-z]{2}"[^>]*>', one, seg)
    i = nav.index('<div class="lang-menu-panel"'); j = nav.index('</div>', i)
    nav = nav[:i] + langs(nav[i:j]) + nav[j:]
    i = foot.index('<nav class="footer-langs"'); j = foot.index('</nav>', i)
    foot = foot[:i] + langs(foot[i:j]) + foot[j:]
    return nav, foot


def org_ld():
    return [{'@type': 'Organization', '@id': ORIGIN + '/#org', 'name': 'Virtuse', 'legalName': 'Virtuse Wealth Management, a.s.', 'url': ORIGIN + '/',
             'logo': ORIGIN + '/email-virtuse-v-mark.png',
             'address': {'@type': 'PostalAddress', 'streetAddress': 'Borinka 65', 'postalCode': '900 32', 'addressLocality': 'Borinka', 'addressCountry': 'SK'},
             'vatID': 'SK2022293042', 'taxID': '36709042'}]


def crumbs_ld(items):
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': ORIGIN + u} for i, (n, u) in enumerate(items)]}


def faq_ld(pairs):
    return {'@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in pairs]}


def plain(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s))


def check_text(out, where):
    # the shared nav and footer come from the homepage as they are; check our own text
    vis = re.sub(r'<script\b.*?</script>|<style\b.*?</style>|<header class="nav">.*?</header>|<footer\b.*?</footer>', '', out, flags=re.S)
    vis = re.sub(r'<[^>]+>', ' ', vis)
    if '—' in vis or '&mdash;' in vis:
        sys.exit('%s: em dash in visible text' % where)
    if '{' in re.sub(r'<script\b.*?</script>', '', out[out.index('<body'):], flags=re.S):
        sys.exit('%s: unfilled placeholder' % where)


def write(rel, out):
    fp = os.path.join(SITE, rel)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp, 'w').write(C.finalize(A.finish(out), fp))
    print('%-48s %6d bytes' % (rel, len(out)))


# '90 d' is the English abbreviation; languages listed here get their own (others keep '90 d')
DAYS90 = {'fr': '90 j'}


def days90(L):
    return DAYS90.get(L, '90 d')


def brief_card(L, t, source='fee_index_brief', days=None):
    """Shared Brief card; its cover image comes from virtuse.com (the issue's og_image), not blog.virtuse.com."""
    b = absolutize(C.brief(L, lambda k: t[k], '', source, days), L).replace('data-root=""', 'data-root="/"')
    iss = [x for x in json.load(open(os.path.join(SITE, 'news', 'issues.json')))['issues'] if x.get('slug') and not x.get('essay')][0]
    if iss.get('og_image'):
        b = re.sub(r'(<img id="briefImg" src=")[^"]*', lambda m: m.group(1) + iss['og_image'], b)
    return b


# ---------- main page (10 languages) ----------

def panel(L, t, fi, s21, date):
    rows = []
    for a in AMOUNTS:
        rk = ranked(fi, s21, a)
        for n, r in enumerate(rk):
            pill = ' <span class="lowest-pill">%s</span>' % t['lowest'] if n == 0 and not r['pending'] else ''
            pend = '<span class="fi-pend">%s</span>' % t['sp_pending']
            rows.append(
                '<div class="row fi-row" data-kind="a{a}"{hid}><span class="hc-name"><img src="/{logo}" alt="" width="36" height="36" class="{lc}" loading="lazy">'
                '<span><b>{name}{pill}</b><small>{method} · <a href="{src}" target="_blank" rel="noopener">{source}</a>, {checked}</small></span></span>'
                '<span class="fi-fee"><em>{c_fee}</em>{fee}</span><span class="fi-sp"><em>{c_sp}</em>{sp}</span>'
                '<span class="fi-tot"><em>{c_tot}</em><b>{tot}</b></span><span class="fi-yr"><em>{c_yr}</em>{yr}</span>'
                '<a class="hp-get btn-primary" href="{url}" target="_blank" rel="sponsored noopener" aria-label="{open}">{open} {arrow}</a></div>'.format(
                    a=a, hid='' if a == DEFAULT else ' hidden', logo=r['logo'], lc=r['logo_class'], name=r['name'], pill=pill,
                    method=t['m_' + r['id']], src=r['source'], source=t['source'], checked=t['checked'].replace('{date}', date),
                    c_fee=t['col_fee'], fee=pct(r['fee_pct'], L), c_sp=t['col_spread'], sp=pend if r['pending'] else pct(r['spread'], L),
                    c_tot=t['col_total'], tot=pend if r['pending'] else pct(r['total'], L), c_yr=t['col_year'], yr='–' if r['pending'] else eur(r['year'], L),
                    url=r['url'], open=t['open'].replace('{name}', r['name']), arrow=C.ARROW))
    seg = ''.join('<button type="button" class="seg-btn{on}" data-filter="a{a}" aria-pressed="{p}">{v}</button>'.format(
        on=' on' if a == DEFAULT else '', a=a, p='true' if a == DEFAULT else 'false', v=eur(a, L)) for a in AMOUNTS)
    return '''<div class="hpanel blue fi-panel">
      <div class="fi-amount"><span>{lbl}</span>
        <div class="seg" role="group" aria-label="{lbl}">{seg}</div>
      </div>
      <div class="row head fi-row"><span>{c1}</span><span class="fi-fee">{c2}</span><span class="fi-sp">{c3}</span><span class="fi-tot">{c4}</span><span class="fi-yr">{c5}</span><span></span></div>
      {rows}
      {aff}
    </div>'''.format(aff=A.note(lambda k: t[k], '/how-we-earn.html' if L == 'en' else '/%s/how-we-earn.html' % L), lbl=t['amount_label'], seg=seg, c1=t['col_partner'], c2=t['col_fee'], c3=t['col_spread'], c4=t['col_total'],
                     c5=t['col_year'], rows='\n      '.join(rows))


def build_main(L, fi, s21, extra_pages):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    Bt = json.load(open(os.path.join(TOOLS, 'bots', L + '.json')))
    T.update({k: v for k, v in Bt.items() if k.startswith('b_') or k == 'email'})
    date = date_str(fi['checked'], L)
    t = {k: (v.replace('{date}', date) if isinstance(v, str) else v) for k, v in T.items()}
    page = url(L)
    alts = [(x, url(x)) for x in LANGS] + [('x-default', url('en'))]
    rk = ranked(fi, s21, DEFAULT)
    # measurement time of the order-book spreads, e.g. "12 Oct 2026, 12:24 UTC"
    when = '%s, %s UTC' % (date, fi['spreads']['measured'][0][11:16])
    spnote = T['spread_note'].replace('{date}', when, 1).replace('{date}', date)
    if s21 is None:   # first sentence (the exchanges) + the 21bitcoin 'being measured' note
        cut = T['spread_note'].index('{date}.') + len('{date}.')
        spnote = T['spread_note'][:cut].replace('{date}', when) + ' ' + t['spread_note_21_pending']
    spnote += ' <a href="/bitcoin-fee-index/methodology/">%s</a>' % t['method_link']
    finding = t['finding'].format(amount=eur(DEFAULT, L), w=rk[0]['name'], wt=pct(rk[0]['total'], L), s=rk[1]['name'], st=pct(rk[1]['total'], L))
    faq = [(t['q%d' % n], t['a%d' % n]) for n in range(1, 5)]
    ld = {'@context': 'https://schema.org', '@graph': org_ld() + [
        crumbs_ld([(t['crumb_home'], '/' if L == 'en' else '/%s/' % L), (t['crumb_page'], page)]),
        {'@type': 'Dataset', 'name': plain(t['title']), 'description': plain(t['description']), 'url': ORIGIN + page,
         'inLanguage': L, 'dateModified': fi['checked'], 'creator': {'@id': ORIGIN + '/#org'},
         'isAccessibleForFree': True, 'variableMeasured': [plain(t['col_fee']), plain(t['col_spread']), plain(t['col_total'])]},
        {'@type': 'Article', 'headline': plain(t['og_title']), 'inLanguage': L, 'dateModified': fi['checked'],
         'author': {'@id': ORIGIN + '/#org'}, 'publisher': {'@id': ORIGIN + '/#org'}, 'mainEntityOfPage': ORIGIN + page},
        faq_ld([(plain(q), plain(a)) for q, a in faq])]}
    out = head(L, t['title'], t['description'], page, alts, ld, og_title=t['og_title'], og_alt=t['og_alt'], og_image=ORIGIN + '/og/fee-index.jpg')
    nav, foot = chrome(L, url)

    loc = lambda p: ('/' if L == 'en' else '/%s/' % L) + p
    dca = '/bitcoin-dca-calculator/' if L == 'en' else '/%s/%s/' % (L, B.GUIDES[L][2])
    steps = ''.join('''      <div class="how-log-item">
        <div class="how-log-marker"><span class="how-log-dot"></span></div>
        <div class="how-log-body">
          <span class="how-log-num">{step} 0{n}</span>
          <h3>{tt}</h3>
          <p>{pp}</p>
        </div>
      </div>
'''.format(step=t['step'], n=n, tt=t['s%d_t' % n], pp=t['s%d_p' % n]) for n in range(1, 4))
    faq_html = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (' open' if i == 0 else '', q, a) for i, (q, a) in enumerate(faq))
    rel = [(loc('stacking.html'), 'rel_stack'), (loc('retirement-calculator.html'), 'rel_ret'), (loc('concierge.html'), 'rel_pf'),
           ('/bitcoin-fee-index/methodology/', 'rel_method'), (dca, 'rel_dca'), (loc('buy-bitcoin.html'), 'rel_buy')]
    cards = ''.join('<a class="gcard" href="%s"><b>%s</b><span>%s</span></a>' % (u, t[k + '_t'], t[k + '_p']) for u, k in rel)
    blurb = t['press_blurb'].format(amount=eur(DEFAULT, L), w=rk[0]['name'], wt=pct(rk[0]['total'], L))
    embed = esc('<iframe src="%s/bitcoin-fee-index/embed/" title="Virtuse Bitcoin Fee Index" width="100%%" height="320" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>\n'
                '<p>Source: <a href="%s/bitcoin-fee-index/">Virtuse Bitcoin Fee Index</a> (fees checked %s)</p>' % (ORIGIN, ORIGIN, date_str(fi['checked'], 'en')))
    body = '''<body class="page-buy page-fee no-split">
{nav}

<main class="wrap acc acc-blue" id="top">

  <!-- 1. HERO + comparison panel -->
  <div class="buy-hero2">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1o}</span></h1>
    <p class="sp-lead">{lead}</p>
    {panel}
    <div class="hp-fine">
      <p class="fi-finding"><b>{fl}</b> {finding}</p>
      <p><b>{disc}</b></p>
      <p>{spnote}</p>
      <p>{excl}</p>
    </div>
  </div>

  <!-- 2. HOW WE CALCULATE -->
  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>{hh2a} <span>{hh2b}</span></h2></div></div>
    <div class="how-log">
{steps}    </div>
    <p class="tools-line"><a class="tlink" href="/bitcoin-fee-index/methodology/">{mlink} {arrow}</a></p>
  </section>

  <!-- 3. FAQ -->
  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>{qh2a} <span>{qh2b}</span></h2></div></div>
    {faq}
  </section>

  <!-- 4. FOR JOURNALISTS -->
  <section id="press" class="qa fi-press">
    <details><summary>{psum}</summary>
      <p>{pintro}</p>
      <h3>{pbh}</h3>
      <p>{blurb}</p>
      <h3>{eh}</h3>
      <p>{eintro}</p>
      <pre class="fi-code">{embed}</pre>
      <p class="fi-btns"><a class="tlink" href="/bitcoin-fee-index/embed/">{bemb} {arrow}</a> <a class="tlink" href="/bitcoin-fee-index/print.html">{bprint} {arrow}</a> <a class="tlink" href="/bitcoin-fee-index/2026-q3/">{barch} {arrow}</a></p>
    </details>
  </section>

  <!-- 5. BRIEF -->
  {brief}

  <!-- 6. RELATED -->
  <section id="related">
    <div class="sec-head one"><div class="sec-copy"><h2>{rh2a} <span>{rh2b}</span></h2></div></div>
    <div class="gcards fi-cards">{cards}</div>
    <p class="tx-fine fi-disc">{disclaimer}</p>
  </section>

  {foot}
</main>

'''.format(nav=nav, eyebrow=t['eyebrow'], h1=t['h1'], h1o=t['h1_or'], lead=t['lead'], panel=panel(L, t, fi, s21, date),
           fl=t['finding_label'], finding=finding, disc=t['disclosure'], spnote=spnote, excl=t['excluded'] + ' ' + t['kraken_instant'],
           hh2a=t['how_h2_a'], hh2b=t['how_h2_b'], steps=steps, mlink=t['method_link'], arrow=C.ARROW,
           qh2a=t['faq_h2_a'], qh2b=t['faq_h2_b'], faq=faq_html, psum=t['press_sum'], pintro=t['press_intro'], pbh=t['press_blurb_h'],
           blurb=blurb, eh=t['embed_h'], eintro=t['embed_intro'], embed=embed, bemb=t['btn_embed'], bprint=t['btn_print'], barch=t['btn_archive'],
           brief=brief_card(L, t, days=days90(L)),
           rh2a=t['rel_h2_a'], rh2b=t['rel_h2_b'], cards=cards, disclaimer=t['disclaimer'], foot=foot)
    out += body + C.scripts('/')
    check_text(out, L)
    write(out_file(L)[len(SITE) + 1:], out)


# ---------- EN extra pages ----------

def simple_page(rel, title, desc, page_url, crumbs, h1, h1o, lead, sections, faq, robots='index, follow', extra_ld=None):
    ld = {'@context': 'https://schema.org', '@graph': org_ld() + [crumbs_ld(crumbs), faq_ld(faq)] + (extra_ld or [])}
    out = head('en', title, desc, page_url, [('en', page_url), ('x-default', page_url)], ld, robots=robots)
    nav, foot = chrome('en', url)
    faq_html = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (' open' if i == 0 else '', esc(q), a if '<' in a else esc(a)) for i, (q, a) in enumerate(faq))
    out += '''<body class="page-buy page-fee no-split">
{nav}

<main class="wrap acc acc-blue" id="top">
  <div class="buy-hero2 fi-sub">
    <div class="eyebrow"><i></i>{crumb}</div>
    <h1>{h1} <span class="h1-grey">{h1o}</span></h1>
    <p class="sp-lead">{lead}</p>
  </div>
{sections}
  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>Questions <span>and answers</span></h2></div></div>
    {faq}
  </section>
  <p class="tx-fine fi-disc">Not investment advice. Virtuse never holds your keys or funds. KYC and onboarding happen on each partner's regulated platform.</p>
  {foot}
</main>

'''.format(nav=nav, crumb=' · '.join(esc(n) for n, _ in crumbs[1:]), h1=h1, h1o=h1o, lead=lead, sections=sections, faq=faq_html, foot=foot)
    out += C.scripts('/')
    check_text(out, rel)
    write(rel, out)


def table(headers, rows, cls='fi-table'):
    th = ''.join('<th>%s</th>' % h for h in headers)
    tr = ''.join('<tr>%s</tr>' % ''.join('<td>%s</td>' % c for c in r) for r in rows)
    return '<div class="table-wrap"><table class="%s"><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (cls, th, tr)


def all_amount_rows(fi, s21):
    out = []
    for a in AMOUNTS:
        for n, r in enumerate(ranked(fi, s21, a)):
            if r['pending']:
                out.append([eur(a, 'en'), '–', r['name'], pct(r['fee_pct'], 'en'), 'Being measured', 'Being measured', '–'])
            else:
                out.append([eur(a, 'en'), str(n + 1), r['name'], pct(r['fee_pct'], 'en'), pct(r['spread'], 'en'), '<b>%s</b>' % pct(r['total'], 'en'), eur(r['year'], 'en')])
    return out


def build_methodology(fi, s21):
    date = date_str(fi['checked'], 'en')
    m = fi['spread_21bitcoin']
    src = ''.join('<li><b>%s</b>: %s <a href="%s" target="_blank" rel="noopener">Source</a>, checked %s.</li>' % (
        r['name'], esc(r['fee_fact']), r['source'], date) for r in fi['rows'])
    times = ', '.join(fi['spreads']['measured'])
    t21 = ', '.join(m.get('measured') or [])
    sections = '''  <section id="inputs">
    <div class="sec-head one"><div class="sec-copy"><h2>Listed <span>fees</span></h2></div></div>
    <ul class="fi-list">{src}</ul>
    <p class="tx-fine">The ranking uses the fee for the route a monthly buyer would use: 21bitcoin's Auto-Invest plan, a spot market buy on Bybit EU, and a spot market buy (taker) on Kraken Pro at the entry tier.</p>
  </section>
  <section id="spread">
    <div class="sec-head one"><div class="sec-copy"><h2>Estimated <span>spread</span></h2></div></div>
    <ul class="fi-list">
      <li><b>Bybit EU and Kraken Pro</b>: we simulate a market buy of each amount (€50, €100, €250, €500, €1,000) against the public BTC/EUR order book and compare the average fill price with the mid price (halfway between the best bid and the best ask). That covers half the bid-ask spread plus any slippage. Average of samples taken at {times} (UTC).</li>
      <li><b>21bitcoin</b>: there is no public order book. {method} {t21}</li>
    </ul>
    <p class="tx-fine">Spreads move with the market. A spread is an estimate for the time it was measured, not a promise of the price you will get.</p>
  </section>
  <section id="formula">
    <div class="sec-head one"><div class="sec-copy"><h2>Total <span>cost</span></h2></div></div>
    <ul class="fi-list">
      <li>Total cost per buy = listed fee + estimated spread, as a share of the amount.</li>
      <li>Per year = 12 × monthly amount × total cost.</li>
      <li>Ranking: lowest total cost first, for each amount separately. No partner has a fixed place, and a referral fee never changes the order.</li>
      <li>Not included: network and withdrawal fees, currency conversion from CZK, PLN, HUF, RON or BGN, and promotions that are not on the partner's fee page.</li>
    </ul>
    {table}
  </section>
'''.format(src=src, times=esc(times), method=esc(m['method']), t21=('Samples: %s (UTC).' % esc(t21)) if t21 else 'Until it is measured, 21bitcoin is listed without a rank.',
           table=table(['Amount', 'Rank', 'Partner', 'Fee', 'Est. spread', 'Total cost', 'Per year'], all_amount_rows(fi, s21)))
    simple_page('bitcoin-fee-index/methodology/index.html', 'Bitcoin Fee Index methodology: fees and spreads',
                'How the Virtuse Bitcoin Fee Index ranks EU buy routes by total cost: listed fee plus estimated spread. Sources and check dates.',
                '/bitcoin-fee-index/methodology/', [('Home', '/'), ('Fee Index', '/bitcoin-fee-index/'), ('Methodology', '/bitcoin-fee-index/methodology/')],
                'How the Fee Index', 'is calculated', 'Fees checked %s. Every number links to the partner page it comes from.' % date, sections,
                [('Where do the fees come from?', 'From each partner\'s own fee page, checked on %s. The links are in the list above.' % date),
                 ('Why include the spread?', 'A route can charge no fee and still sell Bitcoin above the market price. Adding the spread makes routes comparable.'),
                 ('How often is this updated?', 'Every quarter, and whenever a partner changes its published fees. Past quarters stay online as archive pages, so citations keep working.')],
                extra_ld=[{'@type': 'Article', 'headline': 'Bitcoin Fee Index methodology', 'dateModified': fi['checked'],
                           'author': {'@id': ORIGIN + '/#org'}, 'publisher': {'@id': ORIGIN + '/#org'}, 'mainEntityOfPage': ORIGIN + '/bitcoin-fee-index/methodology/'}])


def build_print(fi, s21):
    date = date_str(fi['checked'], 'en')
    sections = '''  <section id="table">
    {table}
    <p class="tx-fine">Source: Virtuse Bitcoin Fee Index, fees checked {date}. {origin}/bitcoin-fee-index/ · Fees: {srcs}. Not included: network, withdrawal and currency fees.</p>
    <p class="tx-fine fi-noprint">To save a PDF: File, then Print, then Save as PDF.</p>
  </section>
'''.format(table=table(['Amount', 'Rank', 'Partner', 'Fee', 'Est. spread', 'Total cost', 'Per year'], all_amount_rows(fi, s21)),
           date=date, origin=ORIGIN, srcs=' · '.join('%s %s' % (r['name'], r['source']) for r in fi['rows']))
    simple_page('bitcoin-fee-index/print.html', 'Bitcoin Fee Index: print / PDF view',
                'Print-ready Virtuse Bitcoin Fee Index: total cost of EU Bitcoin buy routes at €50 to €1,000 a month. Fees checked %s.' % date,
                '/bitcoin-fee-index/print.html', [('Home', '/'), ('Fee Index', '/bitcoin-fee-index/'), ('Print', '/bitcoin-fee-index/print.html')],
                'Bitcoin Fee Index,', 'print view', 'All amounts on one page. Fees checked %s.' % date, sections,
                [('How do I make a PDF?', 'File, then Print, then Save as PDF. Works in Chrome, Firefox, Safari and Edge.'),
                 ('What must a reprint include?', 'The source line: Virtuse Bitcoin Fee Index, fees checked %s, and the link %s/bitcoin-fee-index/.' % (date, ORIGIN))],
                robots='noindex, follow')


def build_q3():
    q3 = json.load(open(os.path.join(DATA, 'fee-schedule-2026-q3.json')))['rows']
    name = lambda r: 'Bybit EU' if r['id'] == 'bybit-eu' else r['partner']
    rows = sorted(q3, key=lambda r: (100 * r['pct'], r['partner']))
    trs = [[str(i + 1), name(r), esc(r['method']), pct(100 * r['pct'], 'en'), eur(12 * 100 * r['pct'], 'en'),
            esc(r['note']).replace(' – ', ', ').replace('–', ',')] for i, r in enumerate(rows)]
    sec = '''  <section id="table">
    {table}
    <p class="tx-fine">Frozen copy of the Q3 2026 ranking at €100 a month: listed fees only, as the index worked then. The current index ranks by total cost (fee plus estimated spread): <a href="/bitcoin-fee-index/">open the current index</a>.</p>
    <p class="fi-btns"><a class="tlink" href="/bitcoin-fee-index/2026-q3/print.html">Print / PDF view {arrow}</a> <a class="tlink" href="/bitcoin-fee-index/methodology/">Methodology {arrow}</a></p>
  </section>
'''
    hdr = ['Rank', 'Partner', 'Method', 'Fee', 'Annual fee at €100/month', 'Note']
    ds = [{'@type': 'Dataset', 'name': 'Virtuse Bitcoin Fee Index, 2026 Q3', 'url': ORIGIN + '/bitcoin-fee-index/2026-q3/',
           'temporalCoverage': '2026-07-01/2026-09-30', 'creator': {'@id': ORIGIN + '/#org'}, 'isAccessibleForFree': True}]
    simple_page('bitcoin-fee-index/2026-q3/index.html', 'Fee Index archive: 2026 Q3',
                'Q3 2026 snapshot of the Virtuse Bitcoin Fee Index. First at €100/month: 21bitcoin, €0 annual fee. Kept unchanged for citations.',
                '/bitcoin-fee-index/2026-q3/', [('Home', '/'), ('Fee Index', '/bitcoin-fee-index/'), ('2026 Q3', '/bitcoin-fee-index/2026-q3/')],
                'Fee Index archive,', '2026 Q3', 'In the Q3 2026 snapshot, 21bitcoin ranked first at €100 a month with €0 in annual fees (0%). This page stays unchanged so citations keep working.',
                sec.format(table=table(hdr, trs), arrow=C.ARROW),
                [('Is this archive different from the current index?', 'Yes. It keeps the Q3 2026 fee schedule and ranks by listed fee only. The current index adds the estimated spread.'),
                 ('Can I cite a single number?', '21bitcoin\'s annual fee at €100 a month was €0 as of Q3 2026.')], extra_ld=ds)
    psec = '''  <section id="table">
    {table}
    <p class="tx-fine">Source: Virtuse Bitcoin Fee Index, as of Q3 2026. {origin}/bitcoin-fee-index/2026-q3/</p>
  </section>
'''.format(table=table(hdr[:5], [r[:5] for r in trs]), origin=ORIGIN)
    simple_page('bitcoin-fee-index/2026-q3/print.html', 'Fee Index 2026 Q3: print / PDF',
                'Print-optimized 2026 Q3 Bitcoin Fee Index. Save as PDF from the browser. First route at €100/month: 21bitcoin.',
                '/bitcoin-fee-index/2026-q3/print.html', [('Home', '/'), ('Fee Index', '/bitcoin-fee-index/'), ('2026 Q3', '/bitcoin-fee-index/2026-q3/'), ('Print', '/bitcoin-fee-index/2026-q3/print.html')],
                'Fee Index 2026 Q3,', 'print view', 'File, then Print, then Save as PDF.', psec,
                [('Does this page change with the live index?', 'No. It shows the Q3 2026 archive snapshot.'),
                 ('What must a reprint include?', 'The source line: Virtuse Bitcoin Fee Index, as of Q3 2026, and the archive URL.')],
                robots='noindex, follow')


def build_embed(fi, s21):
    date = date_str(fi['checked'], 'en')
    rk = ranked(fi, s21, DEFAULT)
    rows = ''.join('<tr><td>{n}</td><td>{name}</td><td>{fee}</td><td>{sp}</td><td><b>{tot}</b></td><td>{yr}</td></tr>'.format(
        n='–' if r['pending'] else i + 1, name=r['name'], fee=pct(r['fee_pct'], 'en'), sp='Being measured' if r['pending'] else pct(r['spread'], 'en'),
        tot='Being measured' if r['pending'] else pct(r['total'], 'en'), yr='–' if r['pending'] else eur(r['year'], 'en')) for i, r in enumerate(rk))
    utm = '?utm_source=embed&amp;utm_medium=referral&amp;utm_campaign=fee_index'
    out = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bitcoin Fee Index embed (fees checked {date})</title>
<meta name="description" content="Embeddable Virtuse Bitcoin Fee Index table: total cost of EU Bitcoin buy routes at €100 a month. Fees checked {date}. Attribution required.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="{origin}/bitcoin-fee-index/embed/">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:title" content="Bitcoin Fee Index embed">
<meta property="og:url" content="{origin}/bitcoin-fee-index/embed/">
<meta property="og:image" content="{img}">
<meta name="twitter:card" content="summary_large_image">
<style>
body {{ margin: 0; background: #08090a; color: #e6edf3; font: 14px/1.5 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
.w {{ padding: 16px; }}
h1 {{ font-size: 16px; margin: 0 0 4px; }}
p {{ margin: 0 0 10px; color: #8b949e; font-size: 12px; }}
.tw {{ overflow-x: auto; }}
table {{ width: 100%; border-collapse: collapse; }}
th, td {{ text-align: left; padding: 7px 8px; border-bottom: 1px solid rgba(255,255,255,.08); white-space: nowrap; }}
th {{ color: #8b949e; font-weight: 600; font-size: 12px; }}
a {{ color: #f7931a; }}
</style>
</head>
<body>
<div class="w">
  <h1>Bitcoin Fee Index: total cost at €100 a month</h1>
  <p>Listed fee plus estimated spread. Fees checked {date}.</p>
  <div class="tw"><table><thead><tr><th>#</th><th>Partner</th><th>Fee</th><th>Est. spread</th><th>Total cost</th><th>Per year</th></tr></thead><tbody>{rows}</tbody></table></div>
  <p>Source: <a href="{origin}/bitcoin-fee-index/{utm}" target="_blank" rel="noopener">Virtuse Bitcoin Fee Index</a> (fees checked {date}). Not investment advice.</p>
</div>
</body>
</html>
'''.format(date=date, origin=ORIGIN, img=OG_IMAGE, rows=rows, utm=utm)
    check_text(out, 'embed')
    write('bitcoin-fee-index/embed/index.html', out)


def main():
    fi, s21 = load()
    langs = sys.argv[1:] or LANGS
    for L in langs:
        build_main(L, fi, s21, None)
    if not sys.argv[1:]:
        build_methodology(fi, s21)
        build_print(fi, s21)
        build_q3()
        build_embed(fi, s21)


if __name__ == '__main__':
    main()
