# Hygiena indexu: návrh na schválenie (17 novembra 2026)

Handover `PROMPT-claude-seo-traffic-fixes-2026-11-17.md`, bod 4. Toto je **návrh**. Noindex, 301, zlučovanie ani mazanie stránok tento PR nerobí; každý riadok so stavom „čaká na áno“ potrebuje Rasovo rozhodnutie.

## Odkiaľ sú čísla

- Search Console, vlastnosť `https://virtuse.com/` (URL prefix, účet vasilisin@virtuse.com), Web, **17 októbra až 13 novembra 2026**, karta Stránky, všetkých 720 riadkov. Čítané priamo v Search Console 17 novembra 2026.
- Súbor `/workspace/seo/gsc/2026-11-16.zip` ani diagnóza `/workspace/seo/traffic-diagnosis-2026-11-17.md` na tomto Macu nie sú (sú na inom stroji). Súčty sedia s diagnózou: 333 klikov, 18 tisíc zobrazení, CTR 1,8 %, priemerná pozícia 21,1.
- Kliky / zobrazenia / pozícia sú za celé okno. Pozícia je priemer Search Console.
- Živý stav (301, 410, 200) overený `curl` na virtuse.com 17 novembra 2026.

## Súhrn skupín

| Skupina | URL so zobrazením | Kliky | Zobrazenia | Poznámka |
|---|---:|---:|---:|---|
| Články `/stories/`, `/sk/stories/`, `/ru/stories/` (vrátane hubu) | 131 | 7 | 1 558 | 125 z nich má 0 klikov. Diagnóza uvádza 167 / 8; rozdiel sú staré `article.html?slug=` a staré slugy WordPressu, ktoré tu počítam medzi parametre a zvyšky. |
| Všetky `/sk/` URL | 123 | 16 | 871 | Veľkú časť zobrazení majú staré slovenské adresy WordPressu, ktoré už presmerúvajú (nižšie). |
| Parametrové URL | 50 | 1 | 1 100 | `tax-agent.html?country=` 13 URL, 0 klikov, 944 zobrazení; `article.html?slug=` 36 URL, 1 klik, 151 zobrazení; `/de/stacking.html?utm_…` 1 URL. |
| Zvyšky burzy a komodít | 4 v okne | 4 | 707 | Všetky už idú 301 (nižšie). |

## Tabuľka návrhov

Stav: **hotové** = platí na produkcii už dnes, nič netreba. **v tomto PR** = mení tento PR. **čaká na áno** = návrh pre Rasa.

### Články bez klikov, s merateľnými zobrazeniami

| URL | Typ | Kliky | Zobr. | Poz. | Prečo | Návrh | Stav |
|---|---|---:|---:|---:|---|---|---|
| `/stories/binance-heist-who-pulled-it-off/` | článok 1 novembra 2026 | 0 | 201 | 9,8 | aktuálna téma W47, prvá strana | nechať; skúsiť title bližší dopytu (napr. „Binance hack: who stole $6.3 billion?“) | čaká na áno |
| `/stories/7-new-crypto-billionaires-on-forbes-400-ras-vasilisin/` | článok 2021 | 0 | 188 | 15,7 | kryptomiliardári z Forbes, mimo Bitcoin-only | noindex (stránka ostáva, len mimo Google) | čaká na áno |
| `/stories/why-crypto-trading-and-digital-asset-management-is-the-next-big-thing/` | článok 2019, éra burzy | 0 | 157 | 73,3 | „crypto trading“, nesedí s Bitcoin-only, pozícia 73 | noindex | čaká na áno |
| `/stories/is-november-bitcoins-best-month/` | článok 1 novembra 2026 | 0 | 97 | 4,5 | v klastri mesačných výnosov, prvá strana bez kliku | nechať; spevniť odkazom z `/bitcoin-returns/november/` a z heatmapy (otázka o novembri) | čaká na áno |
| `/stories/what-you-need-to-know-about-a-digital-euro/` | článok 2021 | 0 | 90 | 41 | stará verzia témy, máme novší slovenský článok o digitálnom eure | nechať; prepojiť s novšími článkami o digitálnom eure | čaká na áno |
| `/sk/stories/damoklov-mec-nad-financnymi-trhmi/` | článok 2019 | 0 | 89 | 6,1 | slovenský, prvá strana bez kliku | nechať; skontrolovať title a popis | čaká na áno |
| `/stories/a-brief-history-of-bitcoin-crashes-and-bear-markets-2009-2022/` | článok 2022 | 0 | 64 | 12,5 | sedí k 200-týždňovému priemeru (dná medvedích trhov) | nechať; odkaz z `ma-200w.html` | čaká na áno |
| `/stories/` | hub | 0 | 62 | 9 | hub článkov | nechať | hotové |
| `/stories/still-dont-know-why-to-buy-bitcoin-here-are-23-reasons-to-own-it/` | článok 2020 | 0 | 30 | 46,6 | evergreen, nízko | nechať | hotové |
| `/stories/bitcoin-fell-below-77000-etfs-sold-fed-looms/` | denná správa | 0 | 23 | 7,5 | krátka správa | nechať | hotové |
| `/stories/bitcoin-price-blasts-past-21k-as-3-day-short-liquidations-near-300m/` | správa 2023 | 0 | 16 | 5,9 | zastaraná cenová správa | noindex | čaká na áno |
| `/stories/crypto-commodities-what-are-they/` | článok 2019, éra burzy | 0 | 13 | 54,5 | mimo Bitcoin-only | noindex | čaká na áno |
| `/stories/what-is-a-bitcoin-treasury/` | článok 2025 | 0 | 12 | 54,8 | sedí k `treasury.html` | nechať; odkaz z `treasury.html` | čaká na áno |
| ďalších 112 článkov | rôzne | 0 | spolu 375 | rôzne | 1 až 11 zobrazení na URL | **žiadny plošný noindex**; rozhodovať po jednom, ak vôbec | čaká na áno |

Do sitemapy aj do nových odkazov idú len kanonické `/stories/<slug>/`. Sitemap dnes neobsahuje ani jedno `article.html?slug=`.

### Slovenské lokalizácie

| URL | Typ | Kliky | Zobr. | Poz. | Prečo | Návrh | Stav |
|---|---|---:|---:|---:|---|---|---|
| `/sk/bitcoin-dane/slovensko/` | daňový návod | 6 | 79 | 4,9 | výhra | nesiahať | hotové |
| `/sk/kupit-bitcoin/slovensko/` | nákupný návod | 0 | 52 | 7,1 | prvá strana bez kliku | nechať; title a popis na CTR | čaká na áno |
| `/sk/` | domov | 0 | 35 | 4,6 | značkové dopyty | nechať | hotové |
| `/sk/fear-greed.html` | graf | 0 | 27 | 7,1 | malý objem | nechať | hotové |
| `/sk/retirement-calculator.html` (0 / 6 / 4,5), `/sk/btc-monthly-returns.html` (1 / 3 / 5,3), `/sk/ma-200w.html` (pod 5 zobrazení) | nástroje | 1 | 9+ | 4,5 a 5,3 | slovenský objem vyhľadávania je malý, nie tenký obsah | nechať; v tomto PR dostali odkazy v klastri | v tomto PR |
| `/sk/virtuse-report/`, `/sk/virtuse-news/` | staré adresy WordPressu | 0 | 87 | 8,7 a 11,2 | 301 na `/sk/stories/` | nič | hotové |
| `/sk/wealth-management/`, `/sk/mate-zaujem-o-konzultaciu/` | staré adresy | 0 | 44 | 6,7 a 8,2 | 301 na `/sk/index.html` | nič | hotové |
| `/sk/striebro/`, `/sk/zlato/` | staré komoditné adresy | 0 | 36 | 6,9 a 2,4 | 301 na `/sk/bitcoin-vs-gold.html` | nič | hotové |
| `/sk/o-nas/`, `/sk/home-2/` | staré adresy | 0 | 34 | 8,4 a 1 | 301 na `/sk/about.html` | nič | hotové |
| `/sk/institucie/`, `/sk/dashboard/` | staré adresy | 0 | 26 | 10,9 a 1 | 301 na `/sk/concierge.html`, `/sk/bitcoin-data.html` | nič | hotové |
| `/sk/invite/` | stará adresa (referral) | 0 | 20 | 11,5 | 410 | nič | hotové |

Záver: medzi slovenskými URL nevidím tenké stránky na noindex. Väčšina zobrazení bez klikov ide na staré adresy, ktoré už presmerúvajú a vypadnú samé.

### Parametrové URL

| URL | Typ | Kliky | Zobr. | Poz. | Prečo | Návrh | Stav |
|---|---|---:|---:|---:|---|---|---|
| `/tax-agent.html?country=hr` | parameter | 0 | 753 | 57,7 | canonical už ukazuje na `https://virtuse.com/tax-agent.html` (overené naživo); Google URL aj tak hlási, pravdepodobne preto, že JavaScript ukáže iný obsah (Chorvátsko) | canonical nechať na čistý `tax-agent.html`; `/bitcoin-tax/croatia/` nie je ten istý obsah (návod vs. nástroj), preto naň canonical nedávam | hotové (canonical), sledovať |
| `/tax-agent.html?country=bg`, `?country=de`, `?country=es` | parameter | 0 | 175 | 10 až 76,7 | to isté | to isté | hotové |
| `/sk/`, `/cs/`, `/pl/`, `/uk/`, `/es/`, `/ru/`, `/de/tax-agent.html?country=…` | parameter | 0 | 16 | rôzne | to isté | to isté | hotové |
| `/article.html?slug=…` (36 URL, niektoré s `&lang=`) | starý čítač | 1 | 151 | 1,6 až 10 | od 14 októbra 301 na `/stories/<slug>/` (overené na článku o STRC) | nič, vypadnú samé | hotové |
| `/de/stacking.html?utm_source=…` | UTM | 0 | 5 | 24 | canonical na čistú URL | nič | hotové |
| sitemap.xml | | | | | 0 parametrových URL (overené) | | hotové |

Ďalší krok, ak by `?country=` nevypadli: odkazy z daňových návodov na Tax Agent zmeniť z `?country=hr` na `#country=hr` (Google fragment neindexuje). To je zmena v module Layer 2 (číta `?country=`), preto len návrh.

### Zvyšky burzy a komodít

| URL | Kliky | Zobr. | Poz. | Živý stav 17 novembra | Návrh | Stav |
|---|---:|---:|---:|---|---|---|
| `/oil/` | 3 | 589 | 27,6 | 301 na `/bitcoin-vs-gold.html` | nič; Google ešte drží starý inventár | hotové |
| `/gold/` | 1 | 29 | 5,8 | 301 na `/bitcoin-vs-gold.html` | nič | hotové |
| `/commodities/` | 0 | 0 v okne | | 301 na `/bitcoin-vs-gold.html` | nič | hotové |
| `/virtusex-platform/` | 0 | 65 | 9,4 | 301 na `/concierge.html` | nič | hotové |
| `/etfs/` | 0 | 24 | 9,5 | 301 na `/asset-returns.html` | nič | hotové |
| `/faq/` | 0 | 123 | 1,5 | 301 na `/faq.html` | nič | hotové |
| `/what-you-need-to-know-about-a-digital-euro/` | 0 | 64 | 43,3 | 301 na `/stories/what-you-need-to-know-about-a-digital-euro/` | nič | hotové |

Všetky presmerovania z `seo-ops/redirects-2026-10-13.csv` pre tieto adresy sú na serveri naživo. Na serverovom `.htaccess` netreba nič meniť.

### Ďalšie vysoké zobrazenia bez klikov

| URL | Kliky | Zobr. | Poz. | Prečo | Návrh | Stav |
|---|---:|---:|---:|---|---|---|
| `/about.html` | 0 | 339 | 2,1 | pozícia 2 bez kliku: značkové dopyty („virtuse exchange“), ľudia hľadajú starú burzu | title/popis môže povedať, že Virtuse už nie je burza (presmeruje očakávania) | čaká na áno |
| `/faq.html` | 0 | 125 | 2,8 | to isté | to isté | čaká na áno |
| `/es/aml-compliance.html` | 0 | 277 | 55,6 | právna stránka, španielsky, všeobecné AML dopyty | noindex právnych stránok v jazykoch, kde sa nepredáva | čaká na áno |
| `/ru/ecosystem/what-is-bitcoin/` | 3 | 700 | 54,4 | dostáva kliky aj z pozície 54 | nechať | hotové |
| `/bitcoin-vs-gold.html` | 0 | 273 | 19,9 | preberá inventár `/gold/` a `/oil/` | nechať | hotové |
| `/de/btc-dominance.html` | 0 | 249 | 13,5 | práca z 26 októbra | nechať, merať | hotové |
| `/de/mining.html` | 0 | 189 | 42,3 | | nechať | hotové |
| `/fr/treasury.html` | 0 | 123 | 45,7 | | nechať | hotové |
| `/fr/secure.html`, `/fr/btc-dominance.html` | 0 | 157 | 31 a 61 | | nechať | hotové |
| `/es/ecosystem/spend-bitcoin/`, `/pl/ecosystem/spend-bitcoin/` | 0 | 254 | 38,4 a 11,9 | | nechať | hotové |
| `/ru/bitcoin-data.html`, `/ru/bitcoin-indeks-komissiy/` | 0 | 285 | 28,2 a 14 | | nechať | hotové |
| `/bitcoin-tax/croatia/` | 0 | 109 | 6,6 | prvá strana bez kliku | nechať; title na CTR | čaká na áno |
| `/bitcoin-returns/2023/`, `/2018/`, `/2012/`, `/2011/`, `/2020/` | 0 | 370 | 5,5 až 15,2 | ročníky v klastri | v tomto PR dostali odkazy na mesačné výnosy, 200 WMA a kalkulačku | v tomto PR |
| `/blog.html` | 0 | 51 | 9,2 | noindex presmerovacia stránka na `/stories/` | nič | hotové |

## Čo tento PR zmenil bezpečne

- Canonical: žiadna zlá kanonická adresa (`seo-ops/audit_canonical.py`: 1 099 indexovateľných stránok, 0 problémov; `seo-ops/site_check.py`: 0 problémov). Nič na opravu.
- Parametre v sitemap: žiadne.
- `<lastmod>` v sitemap: len 38 adries, ktoré tento PR mení.
