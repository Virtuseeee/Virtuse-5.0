#!/usr/bin/env python3
"""Shared pieces for design-v2 page builders (category pages after buy-bitcoin).

head(): the page's own metadata + shared styles; chrome(): nav + footer from the
language's v2 homepage with the language menu pointing at the same page;
brief(): the Brief promo (latest issue with cover image + signup); fix_links():
relative links resolve inside the language folder, else one level up.
"""
import html as html_mod, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'home'))
import build_lang as B

ARROW = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
OUT = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12l8-8M5 4h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
PCT_SPACE = {'sk', 'cs', 'de', 'fr', 'es'}
EEA = {'en': 'EEA', 'sk': 'EHP', 'cs': 'EHP', 'pl': 'EOG', 'de': 'EWR', 'fr': 'EEE', 'es': 'EEE', 'hu': 'EGT', 'uk': 'ЄЕП', 'ru': 'ЕЭЗ'}


def paths(L, page):
    pre = '' if L == 'en' else L + '/'
    return os.path.join(SITE, pre + page), os.path.join(SITE, pre + 'index.html'), ('' if L == 'en' else '../')


def eur(n, L):
    if L == 'en':
        return '€' + format(int(round(n)), ',')
    return B.num(int(round(n)), L) + ' €'


def head(L, old, home, root, version='3'):
    h = old[:old.index('</head>')]
    h = re.sub(r'<style\b.*?</style>\s*', '', h, flags=re.S)
    h = re.sub(r'<link rel="(?:stylesheet|preconnect)"[^>]*>\s*', '', h)
    h = re.sub(r'<script src="https://cdn\.jsdelivr\.net/npm/animejs[^>]*></script>\s*', '', h)
    h = re.sub(r"<script>if \(!window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) document\.documentElement\.classList\.add\('anim'\);</script>\s*", '', h)
    h = re.sub(r'<script>window\.VB_I18N = .*?</script>\s*', '', h)
    h = re.sub(r'<meta name="vb-cfo-stage"[^>]*>\s*', '', h)
    h = re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">',
               lambda m: re.search(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">', home).group(0), h)
    i18n = ''
    if L != 'en':
        H = json.load(open(os.path.join(HERE, 'home', L + '.json')))
        keys = {'openMenu': 'Open menu', 'closeMenu': 'Close menu', 'soon': 'Soon', 'new': 'New', 'latestBrief': 'Latest Brief · ',
                'min': ' min', 'coverImage': 'Cover image: ', 'badEmail': 'Please enter a valid email address.', 'sending': 'Sending...',
                'subscribed': "You're in. Brief goes out Monday.", 'error': 'Something went wrong. Please try again.', 'netError': 'Network error. Please try again.'}
        obj = {k: html_mod.unescape(H[v]) for k, v in keys.items()}
        obj['briefLangNote'] = ' (%s)' % B.BRIEF_EN[L]
        i18n = '<script>window.VB_I18N = %s;</script>\n' % json.dumps(obj, ensure_ascii=False)
    return h.rstrip() + '\n<meta name="vb-cfo-stage" content="wait">\n' \
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' \
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap">\n' \
        '<link rel="stylesheet" href="%ssite-v2.css?v=%s">\n' % (root, version) + \
        "<script>if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('anim');</script>\n" + i18n + '</head>\n'


def chrome(home, page):
    nav = home[home.index('<header class="nav">'):home.index('</header>') + len('</header>')]
    nav = re.sub(r'<a class="logo" href="[^"]*"', '<a class="logo" href="index.html"', nav)
    nav = nav.replace('<a href="%s">' % page, '<a href="%s" aria-current="page">' % page, 1)
    nav = nav.replace('<div class="nav-group" id="ng-services">', '<div class="nav-group current" id="ng-services">')

    def panel(seg):
        return re.sub(r'href="((?:\.\./)?(?:[a-z]{2}/)?)index\.html"', r'href="\1%s"' % page, seg)
    i = nav.index('<div class="lang-menu-panel"'); j = nav.index('</div>', i)
    nav = nav[:i] + panel(nav[i:j]) + nav[j:]
    foot = home[home.index('<footer class="footer-main">'):home.index('</footer>') + len('</footer>')]
    i = foot.index('<nav class="footer-langs"'); j = foot.index('</nav>', i)
    foot = foot[:i] + panel(foot[i:j]) + foot[j:]
    return nav, foot


def brief(L, t, root, source):
    return '''<section id="brief">
    <div class="sec-head one"><div class="sec-copy"><h2>{h2a} <span>{h2b}</span></h2></div></div>
    <div class="brief brief-slim">
      <a class="issue" id="briefIssue" data-root="{root}" href="{root}article.html?slug=bitcoin-beat-the-war-november-still-gets-a-vote{langq}">
        <img id="briefImg" src="https://blog.virtuse.com/wp-content/uploads/2026/10/virtuse-brief-en-2026-10-05-hero.jpg" alt="{img_alt}" loading="lazy">
        <div class="issue-body">
          <span class="k" id="briefMeta">{latest}</span>
          <h3 id="briefTitle">Bitcoin Beat the War. November Still Gets a Vote.{note}</h3>
          <p id="briefExcerpt"></p>
          <span class="more">{read}</span>
        </div>
      </a>
      <div class="signup">
        <div class="btc-spark" id="btcSpark" hidden>
          <div class="btc-top"><span>BTC / EUR · 90 d</span><b id="btcLast"></b><em id="btcChg"></em></div>
          <svg viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="btcFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7931a" stop-opacity=".35"/><stop offset="1" stop-color="#f7931a" stop-opacity="0"/></linearGradient></defs><path id="btcArea" fill="url(#btcFill)"/><path id="btcLine" fill="none" stroke="#f7931a" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </div>
        <h3>{gh} <span>{free}</span></h3>
        <p>{gp}</p>
        <form class="brief-form" id="briefForm" data-brief-form data-source="{source}" novalidate>
          <label for="email" style="position:absolute;left:-9999px">{email}</label>
          <input id="email" name="email" type="email" placeholder="{email}" autocomplete="email" required>
          <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button class="btn btn-ghost" type="submit">{btn}</button>
        </form>
        <div class="brief-msg" id="briefMsg" aria-live="polite"></div>
        <div class="fine">{fine} <a href="{root}news.html?utm_source=brief&amp;utm_medium={source}" style="color:var(--muted)">{all}</a></div>
      </div>
    </div>
  </section>'''.format(h2a=t('b_h2_a'), h2b=t('b_h2_b'), root=root, langq=('&amp;lang=' + L) if L != 'en' else '', latest=t('b_latest'),
                       note=(' (%s)' % B.BRIEF_EN[L]) if L != 'en' else '', read=t('b_read'), img_alt=t('b_img_alt'), gh=t('b_get_h'),
                       free=t('b_free'), gp=t('b_get_p'), email=t('email'), btn=t('b_btn'), fine=t('b_fine'), all=t('b_all'), source=source)


def fix_links(L, out):
    if L == 'en':
        return out

    def fix(m):
        attr, url = m.group(1), m.group(2)
        if re.match(r'(https?:|mailto:|#|data:|\.\./|/)', url):
            return m.group(0)
        path = re.split(r'[?#]', url)[0]
        if L == 'sk' and path == 'blog.html':
            return '%s="../blog-sk.html%s"' % (attr, url[len(path):])
        if os.path.exists(os.path.join(SITE, L, path)):
            return m.group(0)
        return '%s="../%s"' % (attr, url)
    b = out.index('<body')
    return out[:b] + re.sub(r'\b(href|src)="([^"]+)"', fix, out[b:])


def scripts(root):
    return '''<script src="{r}site-v2.js?v=3" defer></script>
<script src="{r}consultation-widget.js?v=20261007b" defer></script>
<script src="{r}concierge-launcher.js" defer></script>
</body>
</html>
'''.format(r=root)
