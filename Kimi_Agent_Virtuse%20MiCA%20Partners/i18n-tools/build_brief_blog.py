#!/usr/bin/env python3
"""Rebuild the blog listing pages in the Virtuse Brief interface.

Everything that is page data comes from the existing (hub-design) blog page
of that language: hreflang tags, the WordPress feed config (CFG, incl. its
already-translated UI strings), the language switcher targets, the
newsletter copy, footer links, copyright, h1, og:description, and the 12
pre-rendered fallback cards (kept for SEO / no-JS). Only strings that are
new to the Brief layout live in NEW below.

The output shares news/news.css (desk-owned) and brief-chrome.js with
article.html.

Usage (from the site folder):
    python3 i18n-tools/build_brief_blog.py <lang> <source.html> [<out.html>]
    e.g. python3 i18n-tools/build_brief_blog.py de de/blog.html
If <out.html> is omitted the source is rewritten in place. The source must
still be in the old hub layout (the extractor reads that markup).
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = open(os.path.join(HERE, 'brief_blog_template.html'), encoding='utf-8').read()

# Language switcher: fixed order and labels (targets come from the page).
ORDER = [('en', 'EN'), ('sk', 'SK'), ('uk', 'UA'), ('ru', 'RU'), ('de', 'DE'),
         ('fr', 'FR'), ('es', 'ES'), ('pl', 'PL'), ('hu', 'HU')]

# Strings that are new to the Brief layout. Mining / custody / treasury desk
# names are taken from each page's own nav, so they match the site's terms.
NEW = {
    'en': dict(lead='Latest', by='By', read='Read', read_story='Read the story',
               nav_issues='Latest issues', nav_data='Data', nav_hub='Virtuse hub', lang_label='Language',
               policy='Policy', macro='Macro', markets='Markets',
               emailReq='Email is required.', sending='Sending', subOk='You are on the list. Check your inbox.',
               subErr='Could not join the list. Try again.', netErr='Network error. Try again.'),
    'sk': dict(lead='Najnovšie', by='Autor', read='Čítať', read_story='Čítať článok',
               nav_issues='Posledné vydania', nav_data='Dáta', nav_hub='Virtuse hub', lang_label='Jazyk',
               policy='Regulácia', macro='Makro', markets='Trhy',
               emailReq='Zadajte e-mail.', sending='Odosielam', subOk='Hotovo. Skontrolujte si schránku.',
               subErr='Prihlásenie sa nepodarilo. Skúste to znova.', netErr='Chyba siete. Skúste to znova.'),
    'uk': dict(lead='Найновіше', by='Автор', read='Читати', read_story='Читати статтю',
               nav_issues='Останні випуски', nav_data='Дані', nav_hub='Virtuse', lang_label='Мова',
               policy='Регулювання', macro='Макро', markets='Ринки',
               emailReq='Вкажіть e-mail.', sending='Надсилання', subOk='Готово. Перевірте пошту.',
               subErr='Не вдалося підписатися. Спробуйте ще раз.', netErr='Помилка мережі. Спробуйте ще раз.'),
    'ru': dict(lead='Новое', by='Автор', read='Читать', read_story='Читать статью',
               nav_issues='Последние выпуски', nav_data='Данные', nav_hub='Virtuse', lang_label='Язык',
               policy='Регулирование', macro='Макро', markets='Рынки',
               emailReq='Укажите e-mail.', sending='Отправка', subOk='Готово. Проверьте почту.',
               subErr='Не удалось подписаться. Попробуйте ещё раз.', netErr='Ошибка сети. Попробуйте ещё раз.'),
    'de': dict(lead='Neueste', by='Von', read='Lesen', read_story='Artikel lesen',
               nav_issues='Neueste Ausgaben', nav_data='Daten', nav_hub='Virtuse Hub', lang_label='Sprache',
               policy='Regulierung', macro='Makro', markets='Märkte',
               emailReq='Bitte geben Sie Ihre E-Mail-Adresse ein.', sending='Wird gesendet',
               subOk='Geschafft. Bitte prüfen Sie Ihr Postfach.', subErr='Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
               netErr='Netzwerkfehler. Bitte erneut versuchen.'),
    'fr': dict(lead='À la une', by='Par', read='Lire', read_story='Lire l’article',
               nav_issues='Derniers numéros', nav_data='Données', nav_hub='Hub Virtuse', lang_label='Langue',
               policy='Régulation', macro='Macro', markets='Marchés',
               emailReq='Adresse e-mail requise.', sending='Envoi', subOk='C’est fait. Vérifiez votre boîte de réception.',
               subErr='Inscription impossible. Réessayez.', netErr='Erreur réseau. Réessayez.'),
    'es': dict(lead='Lo último', by='Por', read='Leer', read_story='Leer el artículo',
               nav_issues='Últimos números', nav_data='Datos', nav_hub='Hub de Virtuse', lang_label='Idioma',
               policy='Regulación', macro='Macro', markets='Mercados',
               emailReq='Indique su correo electrónico.', sending='Enviando', subOk='Listo. Revise su correo.',
               subErr='No se pudo completar la suscripción. Inténtelo de nuevo.', netErr='Error de red. Inténtelo de nuevo.'),
    'pl': dict(lead='Najnowsze', by='Autor', read='Czytaj', read_story='Przeczytaj artykuł',
               nav_issues='Najnowsze wydania', nav_data='Dane', nav_hub='Hub Virtuse', lang_label='Język',
               policy='Regulacje', macro='Makro', markets='Rynki',
               emailReq='Podaj adres e-mail.', sending='Wysyłanie', subOk='Gotowe. Sprawdź skrzynkę.',
               subErr='Nie udało się zapisać. Spróbuj ponownie.', netErr='Błąd sieci. Spróbuj ponownie.'),
    'hu': dict(lead='Legújabb', by='Szerző:', read='Elolvasom', read_story='Tovább a cikkhez',
               nav_issues='Legutóbbi számok', nav_data='Adatok', nav_hub='Virtuse hub', lang_label='Nyelv',
               policy='Szabályozás', macro='Makró', markets='Piacok',
               emailReq='Adja meg e-mail-címét.', sending='Küldés', subOk='Kész. Nézze meg a postafiókját.',
               subErr='A feliratkozás nem sikerült. Próbálja újra.', netErr='Hálózati hiba. Próbálja újra.'),
}
# English page: the old strings said "articles"; the Brief says "stories".
EN_STRINGS = {
    'countSuffix': 'stories', 'gridLabel': 'All stories', 'searchLabel': 'Search results',
    'loadMore': 'Load more stories', 'endLabel': 'That’s the whole archive',
    'showing': 'Showing {n} of {t}', 'empty': 'No stories found',
    'feedError': 'Couldn’t reach the story feed. Showing recent posts.'
}


def text(s):
    """Visible text of an HTML fragment (entities kept as entities)."""
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s)).strip()


def one(rx, s, flags=re.S):
    m = re.search(rx, s, flags)
    assert m, 'not found: ' + rx
    return m


def extract(src, lang):
    d = {}
    d['csp'] = one(r'<meta http-equiv="Content-Security-Policy"[^>]*>', src).group(0)
    d['hreflang'] = re.findall(r'<link rel="alternate" hreflang="[^"]+" href="[^"]+">', src)
    d['canonical'] = one(r'<link rel="alternate" hreflang="%s" href="([^"]+)">' % lang, src).group(1)
    d['cfg'] = json.loads(one(r'var CFG = (\{.*?\});', src).group(1))
    d['og_locale'] = one(r'og:locale" content="([^"]+)"', src).group(1)
    d['description'] = one(r'og:description" content="([^"]*)"', src).group(1)
    d['h1'] = text(one(r'<h1>(.*?)</h1>', src).group(1))
    d['search_ph'] = one(r'id="searchInput" placeholder="([^"]*)"', src).group(1)
    nav = re.findall(r'nav-link-label">([^<]*)<', src)
    d['nav'] = dict(mining=nav[1], custody=nav[3], treasury=nav[4], blog=nav[7])
    # Language switcher targets (relative to this page).
    ls = one(r'<div class="lang-switch"[^>]*>(.*?)</div>', src).group(1)
    d['langs'] = {code: href for href, code in re.findall(r'href="([^"]+)"[^>]*lang="([^"]+)"', ls)}
    # Newsletter copy (already translated and reviewed).
    nl = one(r'<section class="newsletter">(.*?)</form>', src).group(1)
    d['cap_kicker'] = text(one(r'<h2>(.*?)</h2>', nl).group(1))
    d['cap_dek'] = one(r'<p>(.*?)</p>', nl).group(1).strip()
    d['cap_ph'] = one(r'type="email"[^>]*placeholder="([^"]*)"', nl).group(1)
    d['cap_btn'] = text(one(r'<button[^>]*>(.*?)</button>', nl).group(1))
    # Footer: localized About / Terms / Privacy and copyright.
    ft = one(r'<footer.*?</footer>', src).group(0)
    for key, rx in (('about', r'about\.html'), ('terms', r'terms-and-conditions\.html'), ('privacy', r'privacy-policy\.html')):
        m = one(r'<a href="([^"]*%s)"[^>]*>(.*?)</a>' % rx, ft)
        d[key + '_href'], d[key] = m.group(1), text(m.group(2))
    d['copy'] = one(r'<p>(&copy;[^<]*|©[^<]*)</p>', ft).group(1)
    # Where this page sits: '' at the root, '../' in a language folder.
    d['p'] = '../' if d['langs'].get('en', 'blog.html').startswith('../') else ''
    d['hub'] = d['about_href'].replace('about.html', 'index.html')
    # Lead + static fallback cards.
    feat = one(r'class="featured" id="featuredCard">.*?<img src="([^"]+)".*?<h2 class="featured-title">(.*?)</h2>.*?'
               r'<p class="featured-excerpt">(.*?)</p>.*?<div class="featured-meta">.*?<span class="dot"></span>(.*?)</div>', src)
    fhref = one(r'<a href="([^"]+)" class="featured" id="featuredCard"', src).group(1)
    d['featured'] = dict(href=fhref, img=feat.group(1), title=feat.group(2).strip(),
                         excerpt=feat.group(3).strip(), date=feat.group(4).strip())
    d['cards'] = []
    for m in re.finditer(r'<a href="([^"]+)" class="blog-card">\s*<div class="blog-card-media">(.*?)</div>.*?'
                         r'<div class="blog-card-title">(.*?)</div>\s*<div class="blog-card-excerpt">(.*?)</div>.*?'
                         r'<span class="dot"></span>(.*?)</div>', src, re.S):
        img = re.search(r'src="([^"]+)"', m.group(2))
        d['cards'].append(dict(href=m.group(1), img=img.group(1) if img else '', title=m.group(3).strip(),
                               excerpt=m.group(4).strip(), date=m.group(5).strip()))
    assert len(d['cards']) >= 6, 'too few static cards: %d' % len(d['cards'])
    return d


def card_html(c, read):
    img = '<img src="%s" alt="" loading="lazy">' % c['img'] if c['img'] else '<div class="blog-card-empty">₿</div>'
    return ('      <a class="blog-card" href="%s">%s<div class="blog-card-body"><time>%s</time><h3>%s</h3>'
            '<p class="card-dek">%s</p><span class="read">%s →</span></div></a>'
            % (c['href'], img, c['date'], c['title'], c['excerpt'], read))


def build(lang, src_path, out_path):
    src = open(src_path, encoding='utf-8').read()
    d = extract(src, lang)
    n = NEW[lang]
    cfg = d['cfg']
    if lang == 'en':
        cfg['strings'] = EN_STRINGS
    cfg['desks'] = dict(mining=d['nav']['mining'], treasury=d['nav']['treasury'], custody=d['nav']['custody'],
                        policy=n['policy'], macro=n['macro'], markets=n['markets'])
    cfg['articleBase'] = d['p'] + 'article.html'
    # Languages without their own WP feed still open the story with the
    # interface in the page language (article.html reads ?lang=).
    if lang != 'en' and not cfg.get('langSuffix'):
        cfg['langSuffix'] = '&lang=' + lang
        for c in d['cards'] + [d['featured']]:
            c['href'] += '&lang=' + lang
    ui = {k: n[k] for k in ('emailReq', 'sending', 'subOk', 'subErr', 'netErr')}
    on = ' class="on" aria-current="page"'
    lang_links = '\n'.join('          <a href="%s" lang="%s"%s>%s</a>' % (d['langs'][code], code, on if code == lang else '', label)
                           for code, label in ORDER if code in d['langs'])
    f = d['featured']
    title = '%s · Virtuse Brief' % d['h1']
    repl = {
        '{{P}}': d['p'], '{{HUB}}': d['hub'], '{{HTML_LANG}}': lang, '{{CSP}}': d['csp'], '{{TITLE}}': title,
        '{{DESC}}': d['description'], '{{CANONICAL}}': d['canonical'], '{{HREFLANG}}': '\n'.join(d['hreflang']),
        '{{OG_LOCALE}}': d['og_locale'], '{{KICKER}}': 'Virtuse Brief', '{{H1}}': d['h1'],
        '{{SEARCH_LABEL}}': d['search_ph'].rstrip('…. '), '{{SEARCH_PH}}': d['search_ph'], '{{LANG_LABEL}}': n['lang_label'],
        '{{LANG_LINKS}}': lang_links, '{{COUNT}}': str(cfg['total']), '{{COUNT_SUFFIX}}': cfg['strings']['countSuffix'],
        '{{LEAD}}': n['lead'], '{{ALL}}': cfg['strings']['gridLabel'], '{{BY}}': n['by'], '{{READ_STORY}}': n['read_story'],
        '{{F_HREF}}': f['href'], '{{F_IMG}}': f['img'], '{{F_TITLE}}': f['title'], '{{F_EXCERPT}}': f['excerpt'],
        '{{F_DATE}}': f['date'], '{{CARDS}}': '\n'.join(card_html(c, n['read']) for c in d['cards']),
        '{{LOAD_MORE}}': cfg['strings']['loadMore'],
        '{{CAP_KICKER}}': d['cap_kicker'], '{{CAP_DEK}}': d['cap_dek'], '{{CAP_BTN}}': d['cap_btn'],
        '{{CAP_PH}}': d['cap_ph'], '{{SUBSCRIBE}}': d['cap_btn'],
        '{{NAV_ISSUES}}': n['nav_issues'], '{{NAV_BLOG}}': d['nav']['blog'], '{{NAV_DATA}}': n['nav_data'],
        '{{NAV_HUB}}': n['nav_hub'], '{{NAV_GET}}': d['cap_btn'],
        '{{ABOUT}}': d['about'], '{{ABOUT_HREF}}': d['about_href'], '{{TERMS}}': d['terms'], '{{TERMS_HREF}}': d['terms_href'],
        '{{PRIVACY}}': d['privacy'], '{{PRIVACY_HREF}}': d['privacy_href'],
        '{{COPY}}': d['copy'] + (' Not financial advice.' if lang == 'en' else ''),
        '{{WORKER_LANG}}': lang, '{{VB_UI}}': json.dumps(ui, ensure_ascii=False),
        '{{CFG}}': json.dumps(cfg, ensure_ascii=False),
    }
    out = TEMPLATE
    for k, v in repl.items():
        out = out.replace(k, v)
    left = re.findall(r'\{\{[A-Z_]+\}\}', out)
    assert not left, left
    open(out_path, 'w', encoding='utf-8').write(out)
    print('%-16s %s: lead + %d cards, total %s, prefix %r, hub %s'
          % (out_path, lang, len(d['cards']), cfg['total'], d['p'], d['hub']))


if __name__ == '__main__':
    lang, src = sys.argv[1], sys.argv[2]
    build(lang, src, sys.argv[3] if len(sys.argv) > 3 else src)
