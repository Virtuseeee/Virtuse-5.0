#!/usr/bin/env python3
"""Build hu/blog.html from es/blog.html (which already carries the PL option).

The blog shell is the same template in every language folder (EN
WordPress feed, localised chrome), so the Hungarian page is the Spanish one
with its strings swapped. Every replacement is asserted; a missing
source string aborts instead of shipping Spanish.

Usage: python3 i18n-tools/build_hu_blog.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "es", "blog.html")
DST = os.path.join(ROOT, "hu", "blog.html")

HU_OPT = '<a href="blog.html" class="lang-opt active" lang="hu"{role}><span class="lang-flag">🇭🇺</span>HU</a>'

PAIRS = [
    ('<html lang="es">', '<html lang="hu">'),
    ('<link rel="alternate" hreflang="pl" href="https://virtuse.com/pl/blog.html">',
     '<link rel="alternate" hreflang="pl" href="https://virtuse.com/pl/blog.html">\n'
     '<link rel="alternate" hreflang="hu" href="https://virtuse.com/hu/blog.html">'),
    ('content="https://virtuse.com/es/blog.html"', 'content="https://virtuse.com/hu/blog.html"'),
    ('<meta property="og:locale" content="es_ES">', '<meta property="og:locale" content="hu_HU">'),
    ('<a href="/es/" class="nav-logo">', '<a href="/hu/" class="nav-logo">'),
    ('/* ===== ES: compact nav text =====', '/* ===== HU (from ES): compact nav text ====='),
    ('Reflexiones sobre Bitcoin, macroeconomía y el futuro del dinero, por el CEO de Virtuse, Ras Vasilisin.',
     'Ras Vasilisin, a Virtuse vezérigazgatójának elemzései a Bitcoinról, a makrogazdaságról és a pénz jövőjéről.'),
    ('<span class="nav-link-label">Comprar Bitcoin</span>', '<span class="nav-link-label">Bitcoin vásárlás</span>'),
    ('<span class="nav-link-label">Minería</span>', '<span class="nav-link-label">Bányászat</span>'),
    ('<span class="nav-link-label">Préstamos</span>', '<span class="nav-link-label">Hitelek</span>'),
    ('<span class="nav-link-label">Custodia</span>', '<span class="nav-link-label">Letétkezelés</span>'),
    ('<span class="nav-link-label">Impuestos</span>', '<span class="nav-link-label">Adózás</span>'),
    ('<span class="nav-link-label">Bots</span>', '<span class="nav-link-label">Botok</span>'),
    ('<span class="nav-link-label">Datos de Bitcoin</span>', '<span class="nav-link-label">Bitcoin-adatok</span>'),
    ('<span class="nav-link-label">Sobre nosotros</span>', '<span class="nav-link-label">Rólunk</span>'),
    ('>Comenzar<svg', '>Kezdés<svg'),
    ('aria-label="Idioma del blog"', 'aria-label="A blog nyelve"'),
    ('aria-label="Idioma de la página"', 'aria-label="Az oldal nyelve"'),
    ('aria-label="Alternar menú"', 'aria-label="Menü megnyitása"'),
    ('<span class="lang-flag">🇪🇸</span>ES\n', '<span class="lang-flag">🇭🇺</span>HU\n'),
    ('<h1>Blog <span>Virtuse</span></h1>', '<h1>Virtuse <span>blog</span></h1>'),
    ('<a href="../news.html">Redacción</a>: el briefing semanal y Pulse.',
     '<a href="../news.html">Szerkesztőség</a>: a heti Brief és a Pulse.'),
    ('placeholder="Buscar artículos…"', 'placeholder="Cikkek keresése…"'),
    ('<b>169</b> artículos, y sigue creciendo', '<b>169</b> cikk, és egyre több'),
    ('Último artículo', 'Legújabb cikk'),
    ('Leer más <span class="arrow">', 'Tovább olvasom <span class="arrow">'),
    ('<div class="section-label" id="gridLabel">Todos los artículos</div>',
     '<div class="section-label" id="gridLabel">Összes cikk</div>'),
    ('<button class="load-more" id="loadMore">Más artículos</button>',
     '<button class="load-more" id="loadMore">További cikkek</button>'),
    ('<h2>Recibe <span>el Brief</span></h2>', '<h2>Iratkozzon fel <span>a Briefre</span></h2>'),
    ('<p>Virtuse Brief. Solo Bitcoin. Sin tokens. Sin RP.</p>',
     '<p>Virtuse Brief. Csak Bitcoin. Tokenek nélkül. PR nélkül.</p>'),
    ('placeholder="Correo electrónico"', 'placeholder="E-mail-cím"'),
    ('<button type="submit">Recibir el Brief</button>', '<button type="submit">Feliratkozás</button>'),
    ('Cada lunes. Cancela cuando quieras.', 'Minden hétfőn. Bármikor leiratkozhat.'),
    ("btn.textContent = 'ENVIANDO...';", "btn.textContent = 'KÜLDÉS...';"),
    ("lang: 'es' })", "lang: 'hu' })"),
    ('"Listo — revisa tu correo para el mensaje de bienvenida."', '"Kész. Az üdvözlő e-mail úton van."'),
    ("'Algo salió mal. Inténtalo de nuevo.'", "'Hiba történt. Kérjük, próbálja újra.'"),
    ("'Error de red — inténtalo de nuevo.'", "'Hálózati hiba. Kérjük, próbálja újra.'"),
    ('<h4>Servicios</h4>', '<h4>Szolgáltatások</h4>'),
    ('<a href="buy-bitcoin.html">Comprar Bitcoin</a>', '<a href="buy-bitcoin.html">Bitcoin vásárlás</a>'),
    ('<a href="secure.html">Custodia</a>', '<a href="secure.html">Letétkezelés</a>'),
    ('<a href="mining.html">Minería</a>', '<a href="mining.html">Bányászat</a>'),
    ('<a href="lending.html">Préstamos</a>', '<a href="lending.html">Hitelek</a>'),
    ('<a href="tax.html">Impuestos</a>', '<a href="tax.html">Adózás</a>'),
    ('<a href="bots.html">Bots</a>', '<a href="bots.html">Botok</a>'),
    ('<h4>Empresa</h4>', '<h4>Cég</h4>'),
    ('<a href="about.html">Sobre nosotros</a>', '<a href="about.html">Rólunk</a>'),
    ('<a href="faq.html">FAQ</a>', '<a href="faq.html">GYIK</a>'),
    ('<a href="../news.html">Redacción</a>', '<a href="../news.html">Szerkesztőség</a>'),
    ('<h4>Herramientas</h4>', '<h4>Eszközök</h4>'),
    ('<a href="retirement-calculator.html">Retirement Calculator</a>',
     '<a href="retirement-calculator.html">Nyugdíjkalkulátor</a>'),
    ('<h4>Recursos</h4>', '<h4>Útmutatók</h4>'),
    ('<a href="bitcoin-data.html">Datos de Bitcoin</a>', '<a href="bitcoin-data.html">Bitcoin-adatok</a>'),
    ('<h4>Legal</h4>', '<h4>Jogi információk</h4>'),
    ('<a href="terms-and-conditions.html">Términos y condiciones</a>', '<a href="terms-and-conditions.html">Felhasználási feltételek</a>'),
    ('<a href="privacy-policy.html">Política de privacidad</a>', '<a href="privacy-policy.html">Adatvédelmi tájékoztató</a>'),
    ('<a href="aml-compliance.html">AML y cumplimiento</a>', '<a href="aml-compliance.html">AML és megfelelés</a>'),
    ('<p>&copy;2018 – 2026 Virtuse Group, todos los derechos reservados.</p>',
     '<p>&copy; 2018–2026 Virtuse Group. Minden jog fenntartva.</p>'),
    ('Virtuse Brief — el resumen semanal de Virtuse. <a href="../news.html?utm_source=brief&amp;utm_medium=footer">Leerlo &rarr;</a>',
     'Virtuse Brief: a Virtuse heti összefoglalója. <a href="../news.html?utm_source=brief&amp;utm_medium=footer">Elolvasom &rarr;</a>'),
    ('"months": ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]',
     '"months": ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]'),
    # Hungarian dates are year-first: "2026. máj. 14."
    ("return d.getDate() + ' ' + CFG.months[d.getMonth()] + ' ' + d.getFullYear();",
     "return d.getFullYear() + '. ' + CFG.months[d.getMonth()] + ' ' + d.getDate() + '.';"),
    ('"countSuffix": "artículos, y sigue creciendo"', '"countSuffix": "cikk, és egyre több"'),
    ('"gridLabel": "Todos los artículos"', '"gridLabel": "Összes cikk"'),
    ('"searchLabel": "Resultados de búsqueda"', '"searchLabel": "Találatok"'),
    ('"loadMore": "Más artículos"', '"loadMore": "További cikkek"'),
    ('"endLabel": "Estos son todos los artículos"', '"endLabel": "Ez volt az összes cikk"'),
    ('"showing": "{n} de {t} mostrados"', '"showing": "{n} / {t} megjelenítve"'),
    ('"empty": "No se encontraron artículos"', '"empty": "Nincs találat"'),
    ('"feedError": "No se pudo cargar el feed de artículos. Se muestran los últimos artículos conocidos."',
     '"feedError": "A cikklistát nem sikerült betölteni. A legutóbb ismert cikkeket mutatjuk."'),
]

EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
HU_MONTHS = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]


def main():
    s = open(SRC, encoding="utf-8").read()
    for old, new in PAIRS:
        if old not in s:
            raise SystemExit("not found: %r" % old[:100])
        s = s.replace(old, new)

    # Language switchers: ES becomes a plain link, HU is appended (active)
    # after the PL option es/blog.html already carries.
    n_before = s.count('class="lang-opt active" lang="es"')
    s = s.replace('<a href="blog.html" class="lang-opt active" lang="es" role="menuitem">',
                  '<a href="../es/blog.html" class="lang-opt" lang="es" role="menuitem">')
    s = s.replace('<a href="blog.html" class="lang-opt active" lang="es">',
                  '<a href="../es/blog.html" class="lang-opt" lang="es">')
    s, n1 = re.subn(r'( *)(<a href="\.\./pl/blog\.html" class="lang-opt" lang="pl" role="menuitem">.*?</a>)',
                    lambda m: m.group(1) + m.group(2) + "\n" + m.group(1) + HU_OPT.format(role=' role="menuitem"'), s)
    s, n2 = re.subn(r'( *)(<a href="\.\./pl/blog\.html" class="lang-opt" lang="pl">.*?</a>)',
                    lambda m: m.group(1) + m.group(2) + "\n" + m.group(1) + HU_OPT.format(role=""), s)
    assert n_before == 3 and n1 == 2 and n2 == 1, (n_before, n1, n2)

    # Static fallback dates ("14 May 2026") -> "2026. máj. 14.".
    def date(m):
        return "%s. %s %s." % (m.group(3), HU_MONTHS[EN_MONTHS.index(m.group(2))], m.group(1))
    s, nd = re.subn(r"\b(\d{1,2}) (%s) (\d{4})\b" % "|".join(EN_MONTHS), date, s)
    assert nd >= 13, nd

    for bad in ("ES\n", "Redacción", "artículos", "Leer", "Recib", "Correo", "Servicios"):
        assert bad not in s.replace('lang="es"', ""), bad

    with open(DST, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("wrote hu/blog.html (%d static dates)" % nd)


if __name__ == "__main__":
    main()
