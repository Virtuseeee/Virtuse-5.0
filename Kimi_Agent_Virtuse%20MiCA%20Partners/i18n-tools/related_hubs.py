#!/usr/bin/env python3
"""Related tools and guides on the hub pages (SEO Bod B).

One map, ten languages. Tool pages that already had a #related row
(stacking, loan, tax-agent, concierge, retirement, fee index) get that
row replaced with these four cards. Pages that had none (treasury,
mining, buy, secure, bitcoin-data) get the same section inserted before
the footer.

Tax country guides are not in this map: seo-build/generate.mjs already
gives them Tax Agent (?country=), Loan Copilot, Partner Finder and Buy.
Story pages stay on stories-build/hubs.mjs.

csp_tight.tighten() calls apply(), so a later page rebuild keeps the block.
  python3 related_hubs.py            rewrite the hub HTML
  python3 related_hubs.py --check    report, change nothing
"""
import html as html_mod
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
LANGS = ['en', 'sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru']
# Same slugs as home/build_lang.py GUIDES (tax, fee index, dca, sell vs borrow, inheritance).
# Copied so this module does not import build_lang (that imports csp_tight).
GUIDES = {
    'sk': ['bitcoin-dane', 'bitcoin-index-poplatkov', 'bitcoin-dca-kalkulacka', 'bitcoin-predat-alebo-pozicat', 'bitcoin-dedicstvo'],
    'cs': ['bitcoin-dane', 'bitcoin-index-poplatku', 'bitcoin-dca-kalkulacka', 'bitcoin-prodat-nebo-pujcit', 'bitcoin-dedictvi'],
    'de': ['bitcoin-steuern', 'bitcoin-gebuehrenindex', 'bitcoin-dca-rechner', 'bitcoin-verkaufen-oder-beleihen', 'bitcoin-erbrecht'],
    'fr': ['bitcoin-fiscalite', 'bitcoin-indice-frais', 'bitcoin-calculateur-dca', 'bitcoin-vendre-ou-emprunter', 'bitcoin-succession'],
    'es': ['bitcoin-impuestos', 'bitcoin-indice-comisiones', 'bitcoin-calculadora-dca', 'bitcoin-vender-o-pedir-prestado', 'bitcoin-herencia'],
    'pl': ['bitcoin-podatki', 'bitcoin-indeks-oplat', 'bitcoin-kalkulator-dca', 'bitcoin-sprzedac-czy-pozyczyc', 'bitcoin-dziedziczenie'],
    'hu': ['bitcoin-adozas', 'bitcoin-dijindex', 'bitcoin-dca-kalkulator', 'bitcoin-eladas-vagy-hitel', 'bitcoin-orokles'],
    'uk': ['bitcoin-podatky', 'bitcoin-indeks-komisii', 'bitcoin-kalkuliator-dca', 'bitcoin-prodaty-chy-pozychyty', 'bitcoin-spadshchyna'],
    'ru': ['bitcoin-nalogi', 'bitcoin-indeks-komissiy', 'bitcoin-kalkulyator-dca', 'bitcoin-prodat-ili-zanyat', 'bitcoin-nasledstvo'],
}
EN_GUIDES = ['bitcoin-tax', 'bitcoin-fee-index', 'bitcoin-dca-calculator', 'sell-vs-borrow-bitcoin', 'bitcoin-inheritance']

# Hub id -> four link keys. Order is the order of the cards.
HUB_KEYS = {
    'treasury': ['verdict', 'secure', 'news', 'concierge'],
    'mining': ['buy', 'stacking', 'fee', 'concierge'],
    'stacking': ['retirement', 'fee', 'buy', 'concierge'],
    'loan': ['svb', 'taxagent', 'concierge', 'news'],
    'buy': ['fee', 'stacking', 'concierge', 'secure'],
    'secure': ['inheritance', 'taxagent', 'concierge', 'treasury'],
    'tax-agent': ['taxguide', 'loan', 'inheritance', 'concierge'],
    'fee': ['buy', 'stacking', 'concierge', 'news'],
    'concierge': ['buy', 'secure', 'treasury', 'tax'],
    'retirement': ['stacking', 'data', 'news', 'concierge'],
    'bitcoin-data': ['monthly', 'news', 'stories', 'retirement'],
}
# Path under the language folder (en: site-relative) -> hub id.
PAGE_HUBS = {
    'treasury.html': 'treasury',
    'mining.html': 'mining',
    'stacking.html': 'stacking',
    'loan.html': 'loan',
    'buy-bitcoin.html': 'buy',
    'secure.html': 'secure',
    'tax-agent.html': 'tax-agent',
    'concierge.html': 'concierge',
    'retirement-calculator.html': 'retirement',
    'bitcoin-data.html': 'bitcoin-data',
}

# Visible heading, split so the second half sits in the grey <span> the tool pages already use.
HEAD = {
    'en': ('Related tools', 'and guides'),
    'sk': ('Súvisiace nástroje', 'a návody'),
    'cs': ('Související nástroje', 'a návody'),
    'de': ('Verwandte Tools', 'und Ratgeber'),
    'fr': ('Outils et guides', 'associés'),
    'es': ('Herramientas y guías', 'relacionadas'),
    'pl': ('Powiązane narzędzia', 'i poradniki'),
    'hu': ('Kapcsolódó eszközök', 'és útmutatók'),
    'uk': ('Пов’язані інструменти', 'та довідники'),
    'ru': ('Связанные инструменты', 'и руководства'),
}

# Cards whose title and dek already live on a tool page. (json folder, key prefix)
FROM_JSON = {
    'verdict': ('stacking', 'rel_cfo'),
    'concierge': ('stacking', 'rel_pf'),
    'buy': ('stacking', 'rel_buy'),
    'fee': ('stacking', 'rel_fee'),
    'retirement': ('stacking', 'rel_ret'),
    'data': ('stacking', 'rel_data'),
    'stacking': ('retirement', 'rel_stack'),
    'secure': ('tax-agent', 'rel_sec'),
    'loan': ('tax-agent', 'rel_loan'),
    'taxguide': ('tax-agent', 'rel_tax'),
    'svb': ('loan', 'rel_svb'),
}

# New cards. news.html is English only; stories hubs exist for en/sk/ru.
# Verdict has its own page in en/sk/ru/uk; other languages use /verdict.html.
NEWS = {
    'en': ('Virtuse Brief', 'The weekly Bitcoin newsletter for Europe.'),
    'sk': ('Virtuse Brief', 'Týždenný newsletter o Bitcoine pre Európu (v angličtine).'),
    'cs': ('Virtuse Brief', 'Týdenní newsletter o Bitcoinu pro Evropu (v angličtině).'),
    'de': ('Virtuse Brief', 'Der wöchentliche Bitcoin-Newsletter für Europa (auf Englisch).'),
    'fr': ('Virtuse Brief', "La lettre Bitcoin hebdomadaire pour l'Europe (en anglais)."),
    'es': ('Virtuse Brief', 'El boletín semanal de Bitcoin para Europa (en inglés).'),
    'pl': ('Virtuse Brief', 'Cotygodniowy newsletter o Bitcoinie dla Europy (po angielsku).'),
    'hu': ('Virtuse Brief', 'A heti Bitcoin-hírlevél Európának (angol nyelven).'),
    'uk': ('Virtuse Brief', 'Щотижнева розсилка про Біткоїн для Європи (англійською).'),
    'ru': ('Virtuse Brief', 'Еженедельная рассылка о Биткоине для Европы (на английском).'),
}
STORIES = {
    'en': ('Bitcoin stories', 'Long reads from the Virtuse Brief desk.'),
    'sk': ('Články o Bitcoine', 'Dlhé texty redakcie Virtuse Brief.'),
    'ru': ('Статьи о Биткоине', 'Длинные материалы редакции Virtuse Brief.'),
    'cs': ('Články o Bitcoinu', 'Dlouhé texty redakce Brief (v angličtině).'),
    'de': ('Bitcoin-Geschichten', 'Lange Texte der Brief-Redaktion (auf Englisch).'),
    'fr': ('Récits Bitcoin', 'Les longs formats du desk Brief (en anglais).'),
    'es': ('Historias de Bitcoin', 'Textos largos de la redacción del Brief (en inglés).'),
    'pl': ('Historie o Bitcoinie', 'Długie teksty redakcji Brief (po angielsku).'),
    'hu': ('Bitcoin-történetek', 'A Brief szerkesztőségének hosszú írásai (angol nyelven).'),
    'uk': ('Історії про Біткоїн', 'Довгі тексти редакції Brief (англійською).'),
}
INHERIT = {
    'en': ('Bitcoin inheritance checklist', 'What your heirs need to find and move your Bitcoin.'),
    'sk': ('Bitcoin a dedičstvo: kontrolný zoznam', 'Čo potrebujú dedičia, aby našli a presunuli váš Bitcoin.'),
    'cs': ('Bitcoin a dědictví: kontrolní seznam', 'Co dědicové potřebují, aby našli a přesunuli váš Bitcoin.'),
    'de': ('Bitcoin und Erbrecht', 'Was Erben brauchen, um Ihren Bitcoin zu finden und zu übertragen.'),
    'fr': ('Bitcoin et succession', 'Ce dont vos héritiers ont besoin pour retrouver et transférer votre Bitcoin.'),
    'es': ('Bitcoin y herencia', 'Lo que sus herederos necesitan para encontrar y mover su Bitcoin.'),
    'pl': ('Bitcoin i dziedziczenie', 'Co spadkobiercy potrzebują, aby odnaleźć i przenieść Bitcoina.'),
    'hu': ('Bitcoin és öröklés', 'Amire az örökösöknek szükségük van, hogy megtalálják és áthelyezzék a Bitcoint.'),
    'uk': ('Біткоїн і спадщина', 'Що потрібно спадкоємцям, щоб знайти і переказати ваш Біткоїн.'),
    'ru': ('Биткоин и наследство: чек-лист', 'Что нужно наследникам, чтобы найти и перевести ваш Биткоин.'),
}
TREASURY = {
    'en': ('Bitcoin treasury', 'Custody and execution partners for companies.'),
    'sk': ('Úschova Bitcoinu pre firmy', 'Partneri pre úschovu a obchodovanie pre firmy.'),
    'cs': ('Bitcoin v rozvaze', 'Partneři pro úschovu a provádění obchodů pro firmy.'),
    'de': ('Bitcoin-Treasury', 'Verwahrung und Ausführung für Unternehmen.'),
    'fr': ('Trésorerie Bitcoin', "Partenaires de conservation et d'exécution pour les entreprises."),
    'es': ('Tesorería de Bitcoin', 'Socios de custodia y ejecución para empresas.'),
    'pl': ('Bitcoin w bilansie', 'Partnerzy do przechowywania i realizacji zleceń dla firm.'),
    'hu': ('Bitcoin a mérlegben', 'Letétkezelés és végrehajtás cégeknek.'),
    'uk': ('Біткоїн для компаній', 'Партнери зі зберігання та виконання угод для компаній.'),
    'ru': ('Хранение Биткоина для компаний', 'Партнёры по хранению и исполнению сделок для компаний.'),
}
TAXCAT = {
    'en': ('Bitcoin tax', 'Country rules and the tools that prepare a report.'),
    'sk': ('Dane z Bitcoinu', 'Pravidlá krajín a nástroje na daňové prehľady.'),
    'cs': ('Daně z Bitcoinu', 'Pravidla zemí a nástroje na daňové přehledy.'),
    'de': ('Bitcoin-Steuern', 'Länderregeln und Werkzeuge für den Steuerbericht.'),
    'fr': ('Fiscalité Bitcoin', 'Les règles par pays et les outils de déclaration.'),
    'es': ('Impuestos de Bitcoin', 'Normas por país y herramientas para la declaración.'),
    'pl': ('Podatki od Bitcoina', 'Zasady według kraju i narzędzia do raportu podatkowego.'),
    'hu': ('Bitcoin-adózás', 'Országonkénti szabályok és az adóriport eszközei.'),
    'uk': ('Податки на Біткоїн', 'Правила за країнами та інструменти податкового звіту.'),
    'ru': ('Налоги на Биткоин', 'Правила по странам и инструменты для налогового отчёта.'),
}
# Same sentence as the tax-guide card in seo-build/generate.mjs GUIDE_TOOLS.
TAXAGENT_DEK = {
    'en': 'Tax rules by country and an inheritance readiness check.',
    'sk': 'Daňové pravidlá podľa krajiny a kontrola pripravenosti na dedičstvo.',
    'cs': 'Daňová pravidla podle země a kontrola připravenosti na dědictví.',
    'uk': 'Податкові правила за країною та перевірка готовності до спадщини.',
    'ru': 'Налоговые правила по странам и проверка готовности к наследованию.',
    'de': 'Steuerregeln je Land und ein Check zur Nachlassplanung.',
    'fr': 'Les règles fiscales par pays et un contrôle de préparation successorale.',
    'es': 'Normas fiscales por país y una revisión de la preparación sucesoria.',
    'pl': 'Zasady podatkowe według kraju i sprawdzenie gotowości spadkowej.',
    'hu': 'Adószabályok országonként és öröklési felkészültségi ellenőrzés.',
}
MONTHLY_DEK = {
    'en': "Bitcoin's return for every month since 2010.",
    'sk': 'Výnos Bitcoinu za každý mesiac od roku 2010.',
    'cs': 'Výnos Bitcoinu za každý měsíc od roku 2010.',
    'de': 'Die Bitcoin-Rendite für jeden Monat seit 2010.',
    'fr': 'Le rendement du Bitcoin pour chaque mois depuis 2010.',
    'es': 'El rendimiento de Bitcoin cada mes desde 2010.',
    'pl': 'Zwrot Bitcoina w każdym miesiącu od 2010 roku.',
    'hu': 'A Bitcoin hozama hónapról hónapra 2010 óta.',
    'uk': 'Прибутковість Біткоїна за кожен місяць від 2010 року.',
    'ru': 'Доходность Биткоина за каждый месяц с 2010 года.',
}
EXTRA = {
    'news': NEWS, 'stories': STORIES, 'inheritance': INHERIT, 'treasury': TREASURY,
    'tax': TAXCAT,
}

CANON_OPEN = '<section id="related" class="hub-related" aria-labelledby="relatedLabel">'
SEC = re.compile(r'(<section id="related"[^>]*>)(.*?)(</section>)', re.S)
H2 = re.compile(r'<h2[^>]*>.*?</h2>', re.S)
GC = re.compile(r'(<div class="gcards[^"]*">).*?(</div>)', re.S)
FOOT = '<footer class="footer-main">'
_JSON = {}


def heading(L):
    return HEAD[L]


def _json(tool, L):
    key = (tool, L)
    if key not in _JSON:
        with open(os.path.join(HERE, tool, L + '.json'), encoding='utf-8') as f:
            _JSON[key] = json.load(f)
    return _JSON[key]


def text_of(key, L):
    if key in FROM_JSON:
        tool, prefix = FROM_JSON[key]
        j = _json(tool, L)
        return j[prefix + '_t'], j[prefix + '_p']
    if key == 'taxagent':
        return 'Tax & Inheritance Agent', TAXAGENT_DEK[L]
    if key == 'monthly':
        return _json('bitcoin-data', L)['c_monthly'], MONTHLY_DEK[L]
    return EXTRA[key][L]


def _page(L, name):
    return '/' + name if L == 'en' else '/%s/%s' % (L, name)


def _guide(L, i):
    slug = EN_GUIDES[i] if L == 'en' else GUIDES[L][i]
    return '/' + slug + '/' if L == 'en' else '/%s/%s/' % (L, slug)


def href_of(key, L):
    if key == 'news':
        return '/news.html'
    if key == 'stories':
        if L in ('sk', 'ru'):
            return '/%s/stories/' % L
        return '/stories/'
    if key == 'verdict':
        if L in ('sk', 'ru', 'uk'):
            return '/%s/verdict.html' % L
        return '/verdict.html'
    if key == 'fee':
        return _guide(L, 1)
    if key == 'taxguide':
        return _guide(L, 0)
    if key == 'svb':
        return _guide(L, 3)
    if key == 'inheritance':
        return _guide(L, 4)
    if key == 'monthly':
        return _page(L, 'btc-monthly-returns.html')
    files = {
        'secure': 'secure.html', 'concierge': 'concierge.html', 'buy': 'buy-bitcoin.html',
        'stacking': 'stacking.html', 'retirement': 'retirement-calculator.html',
        'loan': 'loan.html', 'taxagent': 'tax-agent.html', 'treasury': 'treasury.html',
        'tax': 'tax.html', 'data': 'bitcoin-data.html',
    }
    return _page(L, files[key])


def esc(s):
    return html_mod.escape(s, quote=False)


def cards_html(L, hub):
    parts = []
    for key in HUB_KEYS[hub]:
        title, dek = text_of(key, L)
        href = href_of(key, L)
        parts.append('<a class="gcard" href="%s"><b>%s</b><span>%s</span></a>' % (
            html_mod.escape(href, quote=True), esc(title), esc(dek)))
    return ''.join(parts)


def h2_html(L):
    a, b = heading(L)
    return '<h2 id="relatedLabel">%s <span>%s</span></h2>' % (esc(a), esc(b))


def fee_rel(L):
    if L == 'en':
        return 'bitcoin-fee-index/index.html'
    return '%s/%s/index.html' % (L, GUIDES[L][1])


def site_rel(page_path):
    rel = os.path.relpath(os.path.abspath(page_path), SITE)
    if rel.startswith('..'):
        return None
    return rel.replace(os.sep, '/')


def split_lang(rel):
    head = rel.split('/', 1)[0]
    if head in LANGS and head != 'en':
        return head, rel[len(head) + 1:]
    return 'en', rel


def hub_of(page_path):
    """(lang, hub id) when this file is one of the hub pages, else None."""
    rel = site_rel(page_path)
    if not rel:
        return None
    for L in LANGS:
        if rel == fee_rel(L):
            return L, 'fee'
    L, rest = split_lang(rel)
    hub = PAGE_HUBS.get(rest)
    if hub:
        return L, hub
    return None


def targets():
    out = []
    for L in LANGS:
        for rest, hub in PAGE_HUBS.items():
            rel = rest if L == 'en' else '%s/%s' % (L, rest)
            out.append((rel, L, hub))
        out.append((fee_rel(L), L, 'fee'))
    return out


def apply(html, page_path):
    """Insert or replace the related block. Other pages are returned unchanged."""
    found = hub_of(page_path)
    if not found:
        return html
    L, hub = found
    # First insert matched an un-indented footer and doubled the comment's indent.
    html = html.replace('    <!-- RELATED-TOOLS -->\n', '  <!-- RELATED-TOOLS -->\n')
    h2, cards = h2_html(L), cards_html(L, hub)
    secs = list(SEC.finditer(html))
    if len(secs) > 1:
        raise SystemExit('more than one #related on %s' % page_path)
    if secs:
        m = secs[0]
        inner = m.group(2)
        if not H2.search(inner) or not GC.search(inner):
            raise SystemExit('related section has no h2 or gcards: %s' % page_path)
        inner = H2.sub(h2, inner, count=1)
        inner = GC.sub(lambda g: g.group(1) + cards + g.group(2), inner, count=1)
        return html[:m.start()] + CANON_OPEN + inner + m.group(3) + html[m.end():]
    # Match the indented footer so the comment above it keeps the same indent as <section>.
    foot = '  ' + FOOT
    if foot not in html:
        raise SystemExit('no footer on %s' % page_path)
    block = (
        '  <!-- RELATED-TOOLS -->\n'
        '  %s\n'
        '    <div class="sec-head one"><div class="sec-copy">%s</div></div>\n'
        '    <div class="gcards">%s</div>\n'
        '  </section>'
    ) % (CANON_OPEN, h2, cards)
    return html.replace(foot, block + '\n\n' + foot, 1)


def _file_for(href):
    path = href.split('?', 1)[0].split('#', 1)[0]
    if path.endswith('/'):
        path += 'index.html'
    return path.lstrip('/')


def check():
    """Static checks. Returns a list of problems (empty means ok)."""
    errs = []
    for L in LANGS:
        if L not in HEAD or len(heading(L)) != 2:
            errs.append('heading missing for ' + L)
        for hub, keys in HUB_KEYS.items():
            if not (3 <= len(keys) <= 4):
                errs.append('%s has %d cards' % (hub, len(keys)))
            for key in keys:
                try:
                    title, dek = text_of(key, L)
                    href = href_of(key, L)
                except KeyError as e:
                    errs.append('%s %s %s: missing %s' % (L, hub, key, e))
                    continue
                blob = (title + ' ' + dek).lower()
                if 'click here' in blob or 'kliknite' in blob or 'tu klik' in blob:
                    errs.append('%s %s anchor is generic' % (L, key))
                if L == 'sk' and ('—' in title or '—' in dek or '&mdash;' in dek):
                    errs.append('sk %s has an em dash' % key)
                if not os.path.isfile(os.path.join(SITE, _file_for(href))):
                    errs.append('%s %s -> missing %s' % (L, key, href))
                path = href.split('?', 1)[0]
                own = path.startswith('/%s/' % L) if L != 'en' else not re.match(r'^/[a-z]{2}/', path)
                shared = path in ('/news.html', '/stories/', '/verdict.html')
                if L == 'en':
                    shared = path in ('/news.html', '/stories/', '/verdict.html')
                if not own and not shared:
                    errs.append('%s %s href %s is not a %s page' % (L, key, href, L))
                if L in ('sk', 'ru') and key == 'stories' and not path.startswith('/%s/' % L):
                    errs.append('%s stories should be the %s hub' % (L, L))
                if L in ('sk', 'ru') and key == 'verdict' and not path.startswith('/%s/' % L):
                    errs.append('%s verdict should be the %s page' % (L, L))
    # A card must not point at the page it sits on.
    for rel, L, hub in targets():
        page = '/' + rel if rel.endswith('.html') else '/' + rel[:rel.rfind('/')] + '/'
        if rel.endswith('/index.html'):
            page = '/' + rel[:rel.rfind('/index.html')] + '/'
        for key in HUB_KEYS[hub]:
            if href_of(key, L).split('?')[0] == page:
                errs.append('%s card %s links to itself' % (rel, key))
    return errs


def main():
    errs = check()
    if errs:
        print('\n'.join(errs))
        sys.exit(1)
    write = '--check' not in sys.argv
    changed = []
    for rel, L, hub in targets():
        fp = os.path.join(SITE, rel)
        if not os.path.isfile(fp):
            print('missing page', rel)
            sys.exit(1)
        with open(fp, encoding='utf-8', newline='') as f:
            old = f.read()
        title = re.search(r'<title>[^<]*</title>', old)
        new = apply(old, fp)
        if apply(new, fp) != new:
            print('not idempotent', rel)
            sys.exit(1)
        if not title or re.search(r'<title>[^<]*</title>', new).group(0) != title.group(0):
            print('title changed', rel)
            sys.exit(1)
        if 'class="hub-related"' not in new:
            print('block missing after apply', rel)
            sys.exit(1)
        if new != old:
            changed.append(rel)
            if write:
                with open(fp, 'w', encoding='utf-8', newline='') as f:
                    f.write(new)
    print('%d of %d hub page(s) %s' % (len(changed), len(targets()), 'updated' if write else 'would change'))
    if '--examples' in sys.argv or write:
        for rel, L, hub in targets():
            if L in ('en', 'sk') and hub in ('treasury', 'mining', 'stacking'):
                titles = [text_of(k, L)[0] for k in HUB_KEYS[hub]]
                hrefs = [href_of(k, L) for k in HUB_KEYS[hub]]
                print('%s: %s' % (rel, ' | '.join('%s -> %s' % (t, h) for t, h in zip(titles, hrefs))))


if __name__ == '__main__':
    main()
