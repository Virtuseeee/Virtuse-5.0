# Knižnica článkov Rasa Vasilisina

Inventár všetkých textov publikovaných ako Ras / Rastislav Vasilisin (EN, SK, RU, UK) a ich externých verzií. Zostavené 2026-11-05.

## Čo je kde

| Súbor | Obsah |
|---|---|
| `kniznica-clankov.html` | Interaktívna knižnica (CRM): filtre, triedenie, detail článku, poznámky/stav/pozretia a pipeline nápadov uložené v databáze Artifactu. Publikovaná ako Artifact: https://claude.ai/artifact/VoKEFdFAE5zwVinLmtVjob (súkromný, zdieľať cez Share menu). |
| `kniznica-clankov.xlsx` | To isté ako 4 hárky: Články, Externé publikácie, Médiá a outlety, Archív Crypto News. Dá sa importovať do Google Sheets (Súbor → Importovať). |
| `clanky.csv` | 657 článkov z blog.virtuse.com (Blog, Media Columns, Guides, Blog SK, Mediálne komentáre, Bitcoin University, Návody, Oznamy), zoradené od najnovšieho. |
| `externe-publikacie.csv` | 368 článkov a vystúpení na iných platformách (Medium, HackerNoon, Denník N, SME, Trend, Seeking Alpha, Investing.com, podcasty…) s pozretiami tam, kde ich platforma zverejňuje, a väzbou na WP ID dvojičky na blogu. |
| `media-outlety.csv` | Prehľad outletov: počet, roky, autorská stránka, aká metrika je dostupná. |
| `archiv-crypto-news.csv` | 874 krátkych správ Crypto News / Krypto novinky (2020–2023, od 7. 10. 2026 noindex). Nie sú to autorské stĺpčeky, ale Yoast pri časti z nich uvádza Rasa ako autora. |
| `library.json` | Rovnaké dáta ako JSON (vstup pre stránku). |
| `data/posts_all.json` | Surový export WordPress REST API (en/sk/ru/uk). |
| `data/ext/*.json` | Výstupy zberu z externých platforiem (vstup pre build, nie je automatický). |
| `tools/build_library.py` | Prebuduje všetko: WP fetch → dataset → CSV/XLSX/JSON → HTML stránka. |

## Stĺpce v `clanky.csv`

Dátum, Názov, Jazyk, Typ (Blog / Mediálny stĺpček / Bitcoin University / Návod / Oznam), Kde publikované, Kategória (WP), URL, Story na virtuse.com (statická kópia, ak existuje), Preklad / dvojička (WP ID druhej jazykovej verzie; „odhad“ = podľa dátumu a čísla v názve, nie podľa WPML), Témy (automaticky z kľúčových slov, max. 3), Počet slov, Pozretia (prázdne pre WP, viď nižšie), Zdroj pozretí, Pôvodne publikované (len ak to článok sám uvádza), Autor (WP), WP ID, Externé verzie, Odkazy v texte.

## Pozretia

WordPress na blog.virtuse.com nemá počítadlo pozretí a REST API žiadne nevracia. Možnosti:

1. Raz mesačne stiahnuť zo Search Console kliky/zobrazenia podľa URL (virtuse.com aj blog.virtuse.com) a doplniť do stĺpca Pozretia (v Artifacte priamo v detaile článku).
2. Nainštalovať plugin Post Views Counter a číslo čítať z REST API (potom doplniť do `build_library.py`).

Externé platformy: Medium = claps, HackerNoon = reads (pageviews), SME blog = „Prečítané“. Denník N, Trend, Pravda pozretia nezverejňujú.

## Aktualizácia

```bash
python3 content-library/tools/build_library.py
```

Stiahne aktuálne články z blogu, prepočíta dvojičky a témy, prepíše CSV/XLSX/JSON a `kniznica-clankov.html`. Potom stránku znova publikovať na rovnakú Artifact URL (poznámky, stavy a pipeline sú v databáze Artifactu a prežijú novú verziu). Externé platformy sa nesťahujú automaticky; nové články na Medium/HackerNoon/Denníku N treba doplniť do `data/ext/*.json` (rovnaký tvar ako existujúce súbory).

## Čo chýba

- LinkedIn články a X príspevky (vyžadujú prihlásenie).
- Pri starších SK stĺpčekoch (2019–2022) blog väčšinou neuvádza, v ktorom médiu vyšli (Trend, Denník N, Pravda); outlet je pri nich „blog.virtuse.com/sk“.
- Rozhovory v TV a podcastoch len tam, kde existuje verejná stránka epizódy.
