#!/usr/bin/env python3
"""Build pl/blog.html from es/blog.html.

The blog shell is the same template in every language folder (EN
WordPress feed, localised chrome), so the Polish page is the Spanish one
with its strings swapped. Every replacement is asserted; a missing
source string aborts instead of shipping Spanish.

Usage: python3 i18n-tools/build_pl_blog.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "es", "blog.html")
DST = os.path.join(ROOT, "pl", "blog.html")

PL_OPT = '<a href="blog.html" class="lang-opt active" lang="pl"{role}><span class="lang-flag">🇵🇱</span>PL</a>'

PAIRS = [
    ('<html lang="es">', '<html lang="pl">'),
    ('<link rel="alternate" hreflang="es" href="https://virtuse.com/es/blog.html">',
     '<link rel="alternate" hreflang="es" href="https://virtuse.com/es/blog.html">\n'
     '<link rel="alternate" hreflang="pl" href="https://virtuse.com/pl/blog.html">'),
    ('content="https://virtuse.com/es/blog.html"', 'content="https://virtuse.com/pl/blog.html"'),
    ('<meta property="og:locale" content="es_ES">', '<meta property="og:locale" content="pl_PL">'),
    ('<a href="/es/" class="nav-logo">', '<a href="/pl/" class="nav-logo">'),
    ('Reflexiones sobre Bitcoin, macroeconomía y el futuro del dinero, por el CEO de Virtuse, Ras Vasilisin.',
     'Analizy o Bitcoinie, makroekonomii i przyszłości pieniądza od CEO Virtuse, Rasa Vasilisina.'),
    ('<span class="nav-link-label">Comprar Bitcoin</span>', '<span class="nav-link-label">Kup Bitcoin</span>'),
    ('<span class="nav-link-label">Minería</span>', '<span class="nav-link-label">Kopanie</span>'),
    ('<span class="nav-link-label">Préstamos</span>', '<span class="nav-link-label">Pożyczki</span>'),
    ('<span class="nav-link-label">Custodia</span>', '<span class="nav-link-label">Przechowywanie</span>'),
    ('<span class="nav-link-label">Impuestos</span>', '<span class="nav-link-label">Podatki</span>'),
    ('<span class="nav-link-label">Bots</span>', '<span class="nav-link-label">Boty</span>'),
    ('<span class="nav-link-label">Datos de Bitcoin</span>', '<span class="nav-link-label">Dane o Bitcoinie</span>'),
    ('<span class="nav-link-label">Sobre nosotros</span>', '<span class="nav-link-label">O nas</span>'),
    ('>Comenzar<svg', '>Rozpocznij<svg'),
    ('aria-label="Idioma del blog"', 'aria-label="Język bloga"'),
    ('aria-label="Idioma de la página"', 'aria-label="Język strony"'),
    ('aria-label="Alternar menú"', 'aria-label="Przełącz menu"'),
    ('<span class="lang-flag">🇪🇸</span>ES\n', '<span class="lang-flag">🇵🇱</span>PL\n'),
    ('<h1>Blog <span>Virtuse</span></h1>', '<h1>Blog <span>Virtuse</span></h1>'),
    ('<a href="../news.html">Redacción</a>: el briefing semanal y Pulse.',
     '<a href="../news.html">Redakcja</a>: cotygodniowy Brief i Pulse.'),
    ('placeholder="Buscar artículos…"', 'placeholder="Szukaj artykułów…"'),
    ('<b>169</b> artículos, y sigue creciendo', '<b>169</b> artykułów i ciągle przybywa'),
    ('Último artículo', 'Najnowszy artykuł'),
    ('Leer más <span class="arrow">', 'Czytaj dalej <span class="arrow">'),
    ('<div class="section-label" id="gridLabel">Todos los artículos</div>',
     '<div class="section-label" id="gridLabel">Wszystkie artykuły</div>'),
    ('<button class="load-more" id="loadMore">Más artículos</button>',
     '<button class="load-more" id="loadMore">Więcej artykułów</button>'),
    ('<h2>Recibe <span>el Brief</span></h2>', '<h2>Zapisz się <span>na Brief</span></h2>'),
    ('<p>Virtuse Brief. Solo Bitcoin. Sin tokens. Sin RP.</p>',
     '<p>Virtuse Brief. Tylko Bitcoin. Bez tokenów. Bez PR-u.</p>'),
    ('placeholder="Correo electrónico"', 'placeholder="Adres e-mail"'),
    ('<button type="submit">Recibir el Brief</button>', '<button type="submit">Zapisz się</button>'),
    ('Cada lunes. Cancela cuando quieras.', 'Co tydzień w poniedziałek. Rezygnacja w dowolnym momencie.'),
    ("btn.textContent = 'ENVIANDO...';", "btn.textContent = 'WYSYŁANIE...';"),
    ("lang: 'es' })", "lang: 'pl' })"),
    ('"Listo — revisa tu correo para el mensaje de bienvenida."', '"Gotowe. Wiadomość powitalna jest już w drodze."'),
    ("'Algo salió mal. Inténtalo de nuevo.'", "'Coś poszło nie tak. Prosimy spróbować ponownie.'"),
    ("'Error de red — inténtalo de nuevo.'", "'Błąd sieci. Prosimy spróbować ponownie.'"),
    ('<h4>Servicios</h4>', '<h4>Usługi</h4>'),
    ('<a href="buy-bitcoin.html">Comprar Bitcoin</a>', '<a href="buy-bitcoin.html">Kup Bitcoin</a>'),
    ('<a href="secure.html">Custodia</a>', '<a href="secure.html">Przechowywanie</a>'),
    ('<a href="mining.html">Minería</a>', '<a href="mining.html">Kopanie</a>'),
    ('<a href="lending.html">Préstamos</a>', '<a href="lending.html">Pożyczki</a>'),
    ('<a href="tax.html">Impuestos</a>', '<a href="tax.html">Podatki</a>'),
    ('<a href="bots.html">Bots</a>', '<a href="bots.html">Boty</a>'),
    ('<h4>Empresa</h4>', '<h4>Firma</h4>'),
    ('<a href="about.html">Sobre nosotros</a>', '<a href="about.html">O nas</a>'),
    ('<a href="../news.html">Redacción</a>', '<a href="../news.html">Redakcja</a>'),
    ('<h4>Herramientas</h4>', '<h4>Narzędzia</h4>'),
    ('<a href="retirement-calculator.html">Retirement Calculator</a>',
     '<a href="retirement-calculator.html">Kalkulator emerytalny</a>'),
    ('<h4>Recursos</h4>', '<h4>Poradniki</h4>'),
    ('<a href="bitcoin-data.html">Datos de Bitcoin</a>', '<a href="bitcoin-data.html">Dane o Bitcoinie</a>'),
    ('<h4>Legal</h4>', '<h4>Informacje prawne</h4>'),
    ('<a href="terms-and-conditions.html">Términos y condiciones</a>', '<a href="terms-and-conditions.html">Regulamin</a>'),
    ('<a href="privacy-policy.html">Política de privacidad</a>', '<a href="privacy-policy.html">Polityka prywatności</a>'),
    ('<a href="aml-compliance.html">AML y cumplimiento</a>', '<a href="aml-compliance.html">AML i zgodność</a>'),
    ('<p>&copy;2018 – 2026 Virtuse Group, todos los derechos reservados.</p>',
     '<p>&copy; 2018–2026 Virtuse Group. Wszelkie prawa zastrzeżone.</p>'),
    ('Virtuse Brief — el resumen semanal de Virtuse. <a href="../news.html?utm_source=brief&amp;utm_medium=footer">Leerlo &rarr;</a>',
     'Virtuse Brief: cotygodniowy przegląd od Virtuse. <a href="../news.html?utm_source=brief&amp;utm_medium=footer">Czytaj &rarr;</a>'),
    ('"months": ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]',
     '"months": ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]'),
    ('"countSuffix": "artículos, y sigue creciendo"', '"countSuffix": "artykułów i ciągle przybywa"'),
    ('"gridLabel": "Todos los artículos"', '"gridLabel": "Wszystkie artykuły"'),
    ('"searchLabel": "Resultados de búsqueda"', '"searchLabel": "Wyniki wyszukiwania"'),
    ('"loadMore": "Más artículos"', '"loadMore": "Więcej artykułów"'),
    ('"endLabel": "Estos son todos los artículos"', '"endLabel": "To już wszystkie artykuły"'),
    ('"showing": "{n} de {t} mostrados"', '"showing": "Wyświetlono {n} z {t}"'),
    ('"empty": "No se encontraron artículos"', '"empty": "Nie znaleziono artykułów"'),
    ('"feedError": "No se pudo cargar el feed de artículos. Se muestran los últimos artículos conocidos."',
     '"feedError": "Nie udało się wczytać listy artykułów. Wyświetlamy ostatnio znane artykuły."'),
]

EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
PL_MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]


def main():
    s = open(SRC, encoding="utf-8").read()
    for old, new in PAIRS:
        if old not in s:
            raise SystemExit("not found: %r" % old[:100])
        s = s.replace(old, new)

    # Language switchers: ES becomes a plain link, PL is appended active.
    n_before = s.count('class="lang-opt active" lang="es"')
    s = s.replace('<a href="blog.html" class="lang-opt active" lang="es" role="menuitem">',
                  '<a href="../es/blog.html" class="lang-opt" lang="es" role="menuitem">')
    s = s.replace('<a href="blog.html" class="lang-opt active" lang="es">',
                  '<a href="../es/blog.html" class="lang-opt" lang="es">')
    s, n1 = re.subn(r'( *)(<a href="\.\./es/blog\.html" class="lang-opt" lang="es" role="menuitem">.*?</a>)',
                    lambda m: m.group(1) + m.group(2) + "\n" + m.group(1) + PL_OPT.format(role=' role="menuitem"'), s)
    s, n2 = re.subn(r'(<a href="\.\./es/blog\.html" class="lang-opt" lang="es">.*?</a>)',
                    lambda m: m.group(1) + "\n      " + PL_OPT.format(role=""), s)
    assert n_before == 3 and n1 == 2 and n2 == 1, (n_before, n1, n2)

    # Static fallback dates ("14 May 2026") -> Polish abbreviations.
    def date(m):
        return "%s %s %s" % (m.group(1), PL_MONTHS[EN_MONTHS.index(m.group(2))], m.group(3))
    s, nd = re.subn(r"\b(\d{1,2}) (%s) (\d{4})\b" % "|".join(EN_MONTHS), date, s)
    assert nd >= 13, nd

    for bad in ("ES\n", "Redacción", "artículos", "Leer", "Recib", "Correo", "Servicios"):
        assert bad not in s.replace('lang="es"', ""), bad

    with open(DST, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("wrote pl/blog.html (%d static dates)" % nd)


if __name__ == "__main__":
    main()
