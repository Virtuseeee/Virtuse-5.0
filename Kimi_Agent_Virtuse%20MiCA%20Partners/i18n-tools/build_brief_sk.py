#!/usr/bin/env python3
"""Build sk/news.html (Slovak Virtuse Brief) from news.html. Handover F3, 2026-11-11.

Same components and script (news.js reads <html lang="sk">); this script swaps the
static text, the head meta, the featured issue (from news/issues-sk.json) and the
links (Slovak pages where they exist, root-absolute paths otherwise).
Every key must be found, so a changed English string stops the build instead of
leaving English on the Slovak page.

  python3 i18n-tools/build_brief_sk.py          # write sk/news.html
  python3 i18n-tools/build_brief_sk.py --check  # exit 1 if sk/news.html is stale
News & Markets is rendered in Slovak from news/news-markets.json by the same generator.
"""
import html, json, pathlib, re, sys

SITE = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = SITE / "news.html", SITE / "sk/news.html"

# Exact text nodes (whitespace-normalised) -> Slovak. "ty" form like the rest of sk/.
TEXT = {
    "Skip to content": "Preskočiť na obsah",
    "Magazine": "Magazín",
    "Bitcoin Data": "Bitcoin dáta",
    "Subscribe": "Odoberať",
    "Light": "Svetlý",
    "Latest Brief ·": "Najnovší Brief ·",
    "Desk updating": "Redakcia aktualizuje",
    "Coming up": "Najbližšie",
    "Add Virtuse as a preferred source on Google": "Pridaj si Virtuse medzi preferované zdroje v Google",
    "Read this Brief": "Čítať Brief",
    "Share on LinkedIn": "Zdieľať na LinkedIn",
    "Follow Virtuse": "Sledovať Virtuse",
    "Older issues": "Staršie vydania",
    "Čítať po slovensky": "Read in English",
    "By the numbers": "V číslach",
    "1 BTC in gold": "1 BTC v zlate",
    "Inflation US · EU": "Inflácia US · EÚ",
    "Bitcoin live; macro at the last daily close. Sources:": "Bitcoin naživo, makro podľa posledného denného uzavretia. Zdroje:",
    ". Not a recommendation.": ". Nie je to investičné odporúčanie.",
    "Get the Brief": "Získaj Brief",
    "Monday. Bitcoin and the macro that moves it.": "Každý pondelok. Bitcoin a makro, ktoré ním hýbe.",
    "Email": "E-mail",
    "One email every Monday. Unsubscribe with one click in any issue.": "Jeden e-mail každý pondelok. Odhlásiš sa jedným klikom v každom vydaní.",
    "Privacy": "Súkromie",
    "Macro of the week": "Makro týždňa",
    "Draft, not published": "Koncept, nezverejnené",
    "Facts with their source. The → BTC line is context, not a recommendation.": "Fakty so zdrojom. Riadok → BTC je kontext, nie investičné odporúčanie.",
    "News &amp; Markets": "Správy a trhy",
    "From the Brief": "Z Briefu",
    "Europe": "Európa",
    "Every row shows its source and date. Not tax or investment advice.": "Každý riadok má zdroj a dátum. Nie je to daňové ani investičné poradenstvo.",
    "All stories": "Všetky články",
    "Central banks": "Centrálne banky",
    "Policy rate, next decision, last move and what the market expects.": "Sadzba, ďalšie rozhodnutie, posledný krok a čo čaká trh.",
    "Bank": "Banka",
    "Rate": "Sadzba",
    "Next": "Ďalej",
    "Rates:": "Sadzby:",
    ". Last move = date the change took effect.": ". Posledný krok = dátum, keď zmena začala platiť.",
    "Bitcoin treasury companies": "Firmy s Bitcoinom v pokladnici",
    "Partners": "Partneri",
    "Get 30% off your first loan fee with our link. Refer a friend later and earn 0.5% a year on their loans in year one.":
        "S naším odkazom máš zľavu 30 % z poplatku za prvý úver. Keď neskôr odporučíš priateľa, získaš počas prvého roka 0,5 % ročne z jeho úverov.",
    "Join Firefish": "Pridať sa k Firefish",
    "On Virtuse": "Na Virtuse",
    "Advertisement, not editorial. Partner link: if you sign up, Virtuse may receive a commission. Your price does not change. Partner terms apply.":
        "Reklama, nie redakčný obsah. Partnerský odkaz: ak sa zaregistruješ, Virtuse môže získať províziu. Tvoja cena sa nemení. Platia podmienky partnera.",
    "How we earn": "Ako zarábame",
    "All issues": "Všetky vydania",
    "Tools": "Nástroje",
    "Retirement Calculator": "Dôchodková kalkulačka",
    "Will your Bitcoin last?": "Vystačí ti Bitcoin?",
    "Stack": "Zásoba",
    "Spending": "Výdavky",
    "€ / year": "€ / rok",
    "Runway": "Vystačí",
    "years": "rokov",
    "Year by year, until your Bitcoin runs out or lasts for life": "Rok po roku, kým Bitcoin nedôjde, alebo vydrží na celý život",
    "Enter your BTC stack, savings and spending in euros. Free, no sign-up.": "Zadaj zásobu BTC, úspory a výdavky v eurách. Zadarmo, bez registrácie.",
    "Score your Bitcoin plan": "Ohodnoť svoj bitcoinový plán",
    "Answers": "Odpovede",
    "Gaps": "Medzery",
    "Score": "Skóre",
    "Savings, goals and worries, in about 3 minutes": "Úspory, ciele a obavy, približne za 3 minúty",
    "An instant score with a letter grade and your 3 biggest gaps. Lite score free.": "Okamžité skóre so známkou a tvoje 3 najväčšie medzery. Lite skóre zadarmo.",
    "Asset Class Returns": "Výnosy tried aktív",
    "Bitcoin against every asset class": "Bitcoin oproti všetkým triedam aktív",
    "Stocks · bonds": "Akcie · dlhopisy",
    "gold · cash": "zlato · hotovosť",
    "Returns": "Výnosy",
    "per year": "za rok",
    "Calendar-year returns in USD or EUR, updated daily": "Ročné výnosy v USD alebo EUR, aktualizované denne",
    "Ten years of Bitcoin, US and European stocks and bonds, gold, commodities and cash. Best and worst asset each year.":
        "Desať rokov Bitcoinu, amerických a európskych akcií a dlhopisov, zlata, komodít a hotovosti. Najlepšie a najhoršie aktívum v každom roku.",
    "Check your country&#x27;s rules": "Pozri pravidlá svojej krajiny",
    "Country": "Krajina",
    "13 EU": "13 EÚ",
    "Tax rules": "Daňové pravidlá",
    "Heirs": "Dedičia",
    "readiness": "pripravenosť",
    "Official sources, as of Q3 2026. Not tax advice.": "Oficiálne zdroje, stav k Q3 2026. Nie je to daňové poradenstvo.",
    "Bitcoin tax rules for 13 EU countries and a check of how ready your Bitcoin is for your heirs.":
        "Daňové pravidlá pre Bitcoin v 13 krajinách EÚ a kontrola, či je tvoj Bitcoin pripravený pre dedičov.",
    "Virtuse Brief. Bitcoin and the macro that moves it. No tokens. No PR.": "Virtuse Brief. Bitcoin a makro, ktoré ním hýbe. Žiadne tokeny. Žiadne PR.",
    "Archive": "Archív",
    "Privacy policy": "Ochrana osobných údajov",
    "Terms": "Podmienky",
    "Unsubscribe": "Odhlásiť sa",
    "Every Brief email ends with a one-click unsubscribe link. No issue at hand? Write to info@virtuse.com and we remove you within a few days.":
        "Každý e-mail Briefu končí odkazom na odhlásenie jedným klikom. Nemáš po ruke žiadne vydanie? Napíš na info@virtuse.com a do pár dní ťa odstránime.",
    "© 2018–2026 Virtuse Wealth Management, a.s. All rights reserved.": "© 2018–2026 Virtuse Wealth Management, a.s. Všetky práva vyhradené.",
    "Operator": "Prevádzkovateľ",
    ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Slovakia · Company ID (IČO) 36 709 042 · VAT ID SK2022293042 · Commercial Register of the Municipal Court Bratislava III, section Sa, file No. 4452/B · info@virtuse.com":
        ": Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Slovensko · IČO 36 709 042 · IČ DPH SK2022293042 · Obchodný register Mestského súdu Bratislava III, oddiel Sa, vložka č. 4452/B · info@virtuse.com",
}
ATTR = {
    "Live Bitcoin stats": "Bitcoin naživo",
    "Language": "Jazyk",
    "Switch to light theme": "Prepnúť na svetlý režim",
    "This week": "Tento týždeň",
    "By the numbers and subscribe": "V číslach a odber",
    "Bitcoin and macro figures": "Bitcoin a makro v číslach",
    "Email address": "E-mailová adresa",
    "News & Markets": "Správy a trhy",
    "Central bank policy rates": "Sadzby centrálnych bánk",
    "Partners (advertisement)": "Partneri (reklama)",
    "Firefish: Never sell your Bitcoin. Borrow against it.": "Firefish: Nepredávaj svoj Bitcoin. Požičaj si s ním ako so zábezpekou.",
    "Type your email…": "Napíš svoj e-mail…",
}
HEAD = [
    ('<html lang="en"', '<html lang="sk"'),
    ("<title>Virtuse Brief: weekly Bitcoin newsletter for Europe</title>", "<title>Virtuse Brief: týždenný bitcoinový newsletter pre Európu</title>"),
    ('content="Weekly newsletter for Europe on Bitcoin and the macro that moves it: markets, rates, inflation, ETFs and policy. Every Monday. No tokens. No PR."',
     'content="Týždenný newsletter pre Európu o Bitcoine a makre, ktoré ním hýbe: trhy, sadzby, inflácia, ETF a regulácia. Každý pondelok. Bez tokenov, bez PR."'),
    ('<link rel="canonical" href="https://virtuse.com/news.html">', '<link rel="canonical" href="https://virtuse.com/sk/news.html">'),
    ('<meta property="og:url" content="https://virtuse.com/news.html">', '<meta property="og:url" content="https://virtuse.com/sk/news.html">'),
    ('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="sk_SK">\n<meta property="og:locale:alternate" content="en_US">'),
    ('<meta property="og:title" content="Virtuse Brief: weekly Bitcoin newsletter for Europe">', '<meta property="og:title" content="Virtuse Brief: týždenný bitcoinový newsletter pre Európu">'),
    ('<meta name="twitter:title" content="Virtuse Brief: weekly Bitcoin newsletter for Europe">', '<meta name="twitter:title" content="Virtuse Brief: týždenný bitcoinový newsletter pre Európu">'),
]
# Pages with a Slovak version: link those; everything else root-absolute.
SK_PAGES = {"news.html", "cfo.html", "how-we-earn.html", "lending.html", "operator.html", "privacy-policy.html",
            "terms-and-conditions.html", "bitcoin-data.html", "retirement-calculator.html", "verdict.html",
            "asset-returns.html", "tax-agent.html"}

def norm(t): return " ".join(t.split())

def main():
    s = SRC.read_text()
    for a, b in HEAD:
        assert s.count(a) == 1, f"head: {a[:60]}"
        s = s.replace(a, b)
    # JSON-LD lists the English editions: not on the Slovak page.
    s = re.sub(r"<!-- news-jsonld:start.*?<!-- news-jsonld:end -->\n?", "", s, flags=re.S)
    head, body = s.split("<body", 1)
    used = set()
    def text_sub(m):
        raw = m.group(1); key = norm(raw)
        if key in TEXT:
            used.add(key)
            lead = raw[: len(raw) - len(raw.lstrip())]; tail = raw[len(raw.rstrip()):]
            return ">" + lead + TEXT[key] + tail + "<"
        return m.group(0)
    body = re.sub(r">([^<>]+)<", text_sub, body)
    def attr_sub(m):
        k = html.unescape(m.group(2))
        if k in ATTR:
            used.add("@" + k)
            return f'{m.group(1)}="{html.escape(ATTR[k], quote=True)}"'
        return m.group(0)
    body = re.sub(r'(aria-label|placeholder|alt|title)="([^"]+)"', attr_sub, body)
    missing = [k for k in TEXT if k not in used] + ["@" + k for k in ATTR if "@" + k not in used]
    assert not missing, f"not found in news.html (changed English?): {missing}"
    s = head + "<body" + body

    # Featured issue: the newest Slovak issue.
    sk = json.loads((SITE / "news/issues-sk.json").read_text())["issues"]
    feat = next(i for i in sk if not i.get("lang") and not i.get("essay"))
    en_slug = feat["en_slug"]
    s = s.replace(f"/stories/{en_slug}/", f"/sk/stories/{feat['slug']}/")
    s = s.replace(f'data-issue-slug="{en_slug}"', f'data-issue-slug="{feat["slug"]}"')
    s = re.sub(r'(<h2 class="featured-title">\s*<a [^>]*>)[^<]*(</a>)', lambda m: m.group(1) + html.escape(feat["title"]) + m.group(2), s)
    facts = [x.strip() for x in re.findall(r"[^.!?]+[.!?]?", feat["excerpt"]) if x.strip()][:3]
    s = re.sub(r'(<ul class="featured-brief-facts">).*?(</ul>)',
               lambda m: m.group(1) + "".join(f"\n          <li>{html.escape(f.rstrip('.'))}</li>" for f in facts) + "\n        " + m.group(2), s, flags=re.S)
    s = re.sub(r'(<img src="/news/covers/[^"]*"[^>]*alt=")[^"]*"', lambda m: m.group(1) + html.escape(feat["title"]) + '"', s)
    s = re.sub(r'(<a class="text-link featured-alt-lang" id="featuredAltLang" href=")[^"]*(" hreflang=")sk(" lang=")sk(">)',
               lambda m: m.group(1) + feat["alt_url"] + m.group(2) + "en" + m.group(3) + "en" + m.group(4), s)
    s = re.sub(r'(<p class="featured-eyebrow">[^<]*<time datetime="(\d{4})-(\d\d)-(\d\d)">)[^<]*(</time>)',
               lambda m: m.group(1) + f"{int(m.group(4))}. {int(m.group(3))}. {m.group(2)}" + m.group(5), s)
    s = re.sub(r'(<p class="edition">[^<]*<time datetime="(\d{4})-(\d\d)-(\d\d)">)[^<]*(</time>)',
               lambda m: m.group(1) + f"{int(m.group(4))}. {int(m.group(3))}. {m.group(2)}" + m.group(5), s)
    s = s.replace('<meta property="og:description" content="', '<meta property="og:description" content="' + html.escape(feat["excerpt"]) + '" data-en="', 1)
    s = re.sub(r' data-en="[^"]*"', "", s, count=1)
    s = re.sub(r'(<meta name="twitter:description" content=")[^"]*"', lambda m: m.group(1) + html.escape(feat["excerpt"]) + '"', s)
    s = re.sub(r'(<meta (?:property="og:image:alt"|name="twitter:image:alt") content=")[^"]*"', lambda m: m.group(1) + html.escape(feat["title"]) + ' · Virtuse Brief"', s)

    # Language switch: SK is current.
    s = s.replace('<a href="/news.html" hreflang="en" lang="en" aria-current="true">EN</a><a href="/sk/news.html" hreflang="sk" lang="sk" data-keep-hash>SK</a>',
                  '<a href="/news.html" hreflang="en" lang="en" data-keep-hash>EN</a><a href="/sk/news.html" hreflang="sk" lang="sk" aria-current="true">SK</a>')
    # Links: relative -> root-absolute, Slovak page where one exists.
    def link_sub(m):
        attr, url = m.group(1), m.group(2)
        if url.startswith(("http", "mailto:", "#", "data:", "/sk/")) or url in ("/news.html",):
            return m.group(0)
        path = url.lstrip("/")
        page = path.split("?")[0].split("#")[0]
        if page in SK_PAGES:
            return f'{attr}="/sk/{path}"'
        if page == "stories/":
            return f'{attr}="/sk/stories/{path[len("stories/"):]}"'
        if path == "":
            return f'{attr}="/sk/index.html"'
        return f'{attr}="/{path}"'
    s = re.sub(r'(href|src)="([^"]*)"', link_sub, s)
    s = s.replace('<link rel="alternate" hreflang="en" href="/news.html">', '<link rel="alternate" hreflang="en" href="https://virtuse.com/news.html">')
    s = s.replace("/sk/tax-agent.html?utm_source=brief&amp;utm_medium=europe", "/sk/tax-agent.html?utm_source=brief&amp;utm_medium=europe")
    # News & Markets in Slovak (same generator as the English page).
    import importlib.util
    spec = importlib.util.spec_from_file_location("news_markets", SITE.parent / "seo-ops" / "news_markets.py")
    nm = importlib.util.module_from_spec(spec); spec.loader.exec_module(nm)
    m = re.search(re.escape(nm.START) + r".*?" + re.escape(nm.END), s, re.S)
    s = s[:m.start()] + nm.render(json.loads(nm.SRC.read_text()), "sk") + s[m.end():]
    if "--check" in sys.argv:
        sys.exit(0 if OUT.exists() and OUT.read_text() == s else 1)
    OUT.write_text(s)
    print(f"sk/news.html written ({len(TEXT)} texts, {len(ATTR)} attributes)")

main()
