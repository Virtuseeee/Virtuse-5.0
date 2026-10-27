#!/usr/bin/env python3
"""Checklist 2.5 (audit design P1-6): Learn / Tools menu with a one-line description per item.

One-off, idempotent. Rewrites the Learn and Tools dropdowns in the two English nav sources (index.html,
cfo.html), adds the description CSS there and to site-v2.css, and adds the new strings to the homepage
and CFO translation files (home/, cfo/ <lang>.json + en_strings.json). Then rebuild as usual:
build_lang.py, build_cfo.py and every v2 builder (they copy the nav from the language's homepage).

  Learn: Virtuse Brief, Stories, Blog, Bitcoin Data, Country tax guides, FAQ
  Tools: Virtuse CFO · Verdict, Partner Finder, Fee Index, Stacking Strategist, Loan & Liquidity Copilot,
         Tax & Inheritance Agent, Retirement Calculator
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
END = ''
LANGS = ['sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru']


def item(href, label, desc, extra=''):
    return '<a href="%s"%s><span class="nd-t">%s</span><span class="nd-d">%s</span></a>' % (href, extra, label, desc)


LEARN = ''.join([
    item('news.html?utm_source=brief&amp;utm_medium=nav', 'Virtuse Brief', 'Weekly Bitcoin news, every Monday'),
    item('/stories/', 'Stories', 'Long reads and analysis'),
    item('blog.html', 'Blog', 'Latest posts from Virtuse'),
    item('bitcoin-data.html', 'Bitcoin Data', 'Live price, network and charts'),
    item('/bitcoin-tax/', 'Country tax guides', 'Tax rules in 13 EU countries'),
    item('faq.html', 'FAQ', 'Answers about Virtuse and partners'),
])
TOOLS = ''.join([
    item('cfo.html', 'Virtuse CFO · Verdict <span class="nav-badge cfo-badge">Free</span>', 'Rate your decision, free', ' id="navCfo"'),
    item('concierge.html?utm_source=concierge&amp;utm_medium=nav', 'Partner Finder', 'Partners that match your answers'),
    item('/bitcoin-fee-index/', 'Fee Index', 'Total cost of buying, compared'),
    item('stacking.html', 'Stacking Strategist', 'Plan regular buys, compare fees'),
    item('loan.html', 'Loan &amp; Liquidity Copilot', 'Sell or borrow against your Bitcoin'),
    item('tax-agent.html', 'Tax &amp; Inheritance Agent', 'Country rules and an inheritance check'),
    item('retirement-calculator.html', 'Retirement Calculator', 'How much Bitcoin for retirement'),
])

CSS_OLD = '@media (min-width: 1181px) { #navCfo { white-space: nowrap; } }'
CSS_FIX = '@media (min-width: 1181px) { #navCfo .nd-t { white-space: nowrap; } }'
ANCHOR = '.nav-links .nav-drop a:hover, .nav-links .nav-drop a:focus-visible { background: var(--card-hover); color: var(--text); }'
CSS_NEW = '''/* Menu items with a one-line description on desktop (checklist 2.5) */
.nav-drop { min-width: 280px; }
.nav-links .nav-drop a { display: flex; flex-direction: column; gap: 3px; }
.nav-drop .nd-d { font-size: 12px; line-height: 1.35; color: var(--dim); white-space: normal; }
.nav-links .nav-drop a:hover .nd-d, .nav-links .nav-drop a:focus-visible .nd-d { color: var(--muted); }
@media (max-width: 1180px) { .nav-drop .nd-d { display: none; } }'''

T = {  # new strings; existing keys in a language file are kept
    'Stories': dict(sk='Príbehy', cs='Příběhy', de='Artikel', fr='Articles', es='Artículos', pl='Artykuły', hu='Cikkek', uk='Статті', ru='Статьи'),
    'Country tax guides': dict(sk='Daňové návody podľa krajín', cs='Daňové průvodce podle zemí', de='Steuerratgeber nach Land',
                               fr='Guides fiscaux par pays', es='Guías fiscales por país', pl='Przewodniki podatkowe według krajów',
                               hu='Adózási útmutatók országonként', uk='Податкові гіди за країнами', ru='Налоговые гиды по странам'),
    'FAQ': dict(sk='Časté otázky', cs='Časté dotazy', de='FAQ', fr='FAQ', es='Preguntas frecuentes', pl='FAQ', hu='GYIK',
                uk='Часті запитання', ru='Частые вопросы'),
    'Weekly Bitcoin news, every Monday': dict(sk='Týždenné správy o Bitcoine, každý pondelok', cs='Týdenní zprávy o Bitcoinu, každé pondělí',
        de='Bitcoin-News jede Woche, montags', fr='L’actualité Bitcoin, chaque lundi', es='Noticias de Bitcoin, cada lunes',
        pl='Wiadomości o Bitcoinie, w każdy poniedziałek', hu='Heti Bitcoin-hírek, minden hétfőn', uk='Новини про Біткоїн щопонеділка',
        ru='Новости о Биткоине по понедельникам'),
    'Long reads and analysis': dict(sk='Dlhšie články a analýzy', cs='Delší články a analýzy', de='Lange Artikel und Analysen',
        fr='Articles de fond et analyses', es='Artículos largos y análisis', pl='Dłuższe artykuły i analizy', hu='Hosszabb cikkek és elemzések',
        uk='Великі статті та аналітика', ru='Большие статьи и аналитика'),
    'Latest posts from Virtuse': dict(sk='Najnovšie príspevky od Virtuse', cs='Nejnovější příspěvky od Virtuse', de='Neueste Beiträge von Virtuse',
        fr='Les derniers billets de Virtuse', es='Últimas publicaciones de Virtuse', pl='Najnowsze wpisy Virtuse', hu='A Virtuse legújabb bejegyzései',
        uk='Найновіші дописи Virtuse', ru='Свежие публикации Virtuse'),
    'Live price, network and charts': dict(sk='Aktuálna cena, sieť a grafy', cs='Aktuální cena, síť a grafy', de='Live-Kurs, Netzwerk und Charts',
        fr='Cours en direct, réseau et graphiques', es='Precio en directo, red y gráficos', pl='Bieżąca cena, sieć i wykresy',
        hu='Élő árfolyam, hálózat és grafikonok', uk='Поточна ціна, мережа та графіки', ru='Текущая цена, сеть и графики'),
    'Tax rules in 13 EU countries': dict(sk='Daňové pravidlá v 13 krajinách EÚ', cs='Daňová pravidla ve 13 zemích EU', de='Steuerregeln in 13 EU-Ländern',
        fr='Règles fiscales dans 13 pays de l’UE', es='Normas fiscales en 13 países de la UE', pl='Zasady podatkowe w 13 krajach UE',
        hu='Adószabályok 13 uniós országban', uk='Податкові правила у 13 країнах ЄС', ru='Налоговые правила в 13 странах ЕС'),
    'Answers about Virtuse and partners': dict(sk='Odpovede o Virtuse a partneroch', cs='Odpovědi o Virtuse a partnerech',
        de='Antworten zu Virtuse und Partnern', fr='Réponses sur Virtuse et les partenaires', es='Respuestas sobre Virtuse y los partners',
        pl='Odpowiedzi o Virtuse i partnerach', hu='Válaszok a Virtuse-ról és a partnerekről', uk='Відповіді про Virtuse і партнерів',
        ru='Ответы о Virtuse и партнёрах'),
    'Rate your decision, free': dict(sk='Ohodnoťte svoje rozhodnutie zadarmo',
        cs='Ohodnoťte své rozhodnutí zdarma', de='Ihre Entscheidung kostenlos bewerten',
        fr='Évaluez votre décision, gratuitement', es='Evalúe su decisión gratis',
        pl='Bezpłatna ocena decyzji', hu='Döntése értékelése ingyen',
        uk='Безкоштовна оцінка вашого рішення', ru='Бесплатная оценка вашего решения'),
    'Partners that match your answers': dict(sk='Partneri podľa vašich odpovedí', cs='Partneři podle vašich odpovědí',
        de='Partner passend zu Ihren Antworten', fr='Les partenaires selon vos réponses', es='Partners según sus respuestas',
        pl='Partnerzy dopasowani do odpowiedzi', hu='Partnerek a válaszai alapján', uk='Партнери за вашими відповідями',
        ru='Партнёры по вашим ответам'),
    'Total cost of buying, compared': dict(sk='Celkové náklady nákupu v porovnaní', cs='Celkové náklady nákupu ve srovnání',
        de='Gesamtkosten beim Kauf im Vergleich', fr='Le coût total d’achat comparé', es='Coste total de compra, comparado',
        pl='Całkowity koszt zakupu w porównaniu', hu='A vásárlás teljes költsége összevetve', uk='Повна вартість купівлі в порівнянні',
        ru='Полная стоимость покупки в сравнении'),
    'Plan regular buys, compare fees': dict(sk='Plán pravidelných nákupov a poplatky', cs='Plán pravidelných nákupů a poplatky',
        de='Sparplan planen, Gebühren vergleichen', fr='Planifier des achats réguliers', es='Planifique compras periódicas',
        pl='Plan regularnych zakupów i opłaty', hu='Rendszeres vásárlás tervezése', uk='План регулярних покупок і комісії',
        ru='План регулярных покупок и комиссии'),
    'Sell or borrow against your Bitcoin': dict(sk='Predať, alebo si požičať so zábezpekou v Bitcoine', cs='Prodat, nebo si půjčit se zajištěním Bitcoinem',
        de='Verkaufen oder mit Bitcoin beleihen', fr='Vendre ou emprunter sur vos Bitcoin', es='Vender o pedir prestado con su Bitcoin',
        pl='Sprzedać czy pożyczyć pod zastaw Bitcoina', hu='Eladás vagy hitel Bitcoin-fedezettel', uk='Продати чи позичити під заставу Біткоїна',
        ru='Продать или занять под залог Биткоина'),
    'Country rules and an inheritance check': dict(sk='Pravidlá krajín a kontrola dedičstva', cs='Pravidla zemí a kontrola dědictví',
        de='Länderregeln und Erbschafts-Check', fr='Règles par pays et bilan successoral', es='Normas por país y revisión de herencia',
        pl='Zasady krajów i sprawdzenie dziedziczenia', hu='Országos szabályok és öröklési ellenőrzés', uk='Правила країн і перевірка спадщини',
        ru='Правила стран и проверка наследства'),
    'How much Bitcoin for retirement': dict(sk='Koľko Bitcoinu na dôchodok', cs='Kolik Bitcoinu na důchod', de='Wie viel Bitcoin für die Rente',
        fr='Combien de Bitcoin pour la retraite', es='Cuánto Bitcoin para la jubilación', pl='Ile Bitcoina na emeryturę',
        hu='Mennyi Bitcoin kell a nyugdíjhoz', uk='Скільки Біткоїна на пенсію', ru='Сколько Биткоина нужно на пенсію'),
}


def rewrite(path):
    p = os.path.join(SITE, path)
    s = open(p, encoding='utf-8').read()
    for gid, body in (('learn', LEARN), ('tools', TOOLS)):
        s, n = re.subn(r'(<div class="nav-drop" id="nd-%s">).*?(</div>)' % gid, lambda m: m.group(1) + body + m.group(2), s, count=1, flags=re.S)
        assert n == 1, (path, gid)
    s = css(s, path)
    open(p, 'w', encoding='utf-8').write(s)


def css(s, path):
    s = s.replace(CSS_OLD, CSS_FIX)
    if '.nav-drop .nd-d' not in s:
        assert s.count(ANCHOR) == 1, path
        s = s.replace(ANCHOR, ANCHOR + '\n' + CSS_NEW, 1)
    return s


def strings(folder):
    d = os.path.join(HERE, folder)
    en_p = os.path.join(d, 'en_strings.json')
    en = json.load(open(en_p, encoding='utf-8'))
    have = {x['en'] for x in en}
    for k in T:
        if k not in have:
            en.append({'en': k, 'kind': 'text', 'context': 'nav menu (2.5)'})
    open(en_p, 'w', encoding='utf-8').write(json.dumps(en, ensure_ascii=False, indent=1) + END)
    for L in LANGS:
        p = os.path.join(d, L + '.json')
        tr = json.load(open(p, encoding='utf-8'))
        for k, v in T.items():
            tr.setdefault(k, v[L])
        open(p, 'w', encoding='utf-8').write(json.dumps(tr, ensure_ascii=False, indent=1) + END)


if __name__ == '__main__':
    for f in ('index.html', 'cfo.html'):
        rewrite(f)
    p = os.path.join(SITE, 'site-v2.css')
    v = css(open(p, encoding='utf-8').read(), 'site-v2.css')
    open(p, 'w', encoding='utf-8').write(v)
    strings('home')
    strings('cfo')
    print('menu rewritten; strings added')
