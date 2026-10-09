# Translating the new Virtuse homepage

Folder: this file's folder (`i18n_home/`). Site files (read only, do not edit): the site folder two levels up
(the English page is `index.html` there; each language has its folder, e.g. `de/`).

## Task
`en_strings.json` is a list of `{en, kind, context}`: every visible text, attribute value
(`kind` = `attr:aria-label|alt|placeholder|title`) and script message (`kind` = `js`) of the new
English homepage. `context` is the surrounding HTML, so you can see where it sits.

Write `<lang>.json`: ONE JSON object mapping **every** `en` value (exact key, including any
leading/trailing space) to its translation. Then run `python3 check.py <lang>` and fix until it
reports 0 problems. Do not edit any other file.

## Terminology: reuse the site's own words
The site already exists in your language. Before translating, read in `<lang>/`:
`index.html` (old homepage: nav labels, footer column names, newsletter wording),
`faq.html` (answers to "Is Virtuse an exchange?" etc.), `buy-bitcoin.html`, `lending.html`,
`secure.html`, `mining.html`, `tax.html`, `bots.html`, `about.html`, and the guide pages below.
Use the same names for the same things (service names, "custody", "partners", "referral fee",
legal page names in the footer). Consistency with the existing site beats a "better" synonym.

Guide hubs (use each page's own `<h1>`/title wording for the footer labels
"Bitcoin tax", "Fee Index", "DCA calculator", "Sell vs borrow", "Inheritance"):
| lang | tax | fee index | DCA | sell vs borrow | inheritance |
|---|---|---|---|---|---|
| sk | sk/bitcoin-dane/ | sk/bitcoin-index-poplatkov/ | sk/bitcoin-dca-kalkulacka/ | sk/bitcoin-predat-alebo-pozicat/ | sk/bitcoin-dedicstvo/ |
| cs | cs/bitcoin-dane/ | cs/bitcoin-index-poplatku/ | cs/bitcoin-dca-kalkulacka/ | cs/bitcoin-prodat-nebo-pujcit/ | cs/bitcoin-dedictvi/ |
| de | de/bitcoin-steuern/ | de/bitcoin-gebuehrenindex/ | de/bitcoin-dca-rechner/ | de/bitcoin-verkaufen-oder-beleihen/ | de/bitcoin-erbrecht/ |
| fr | fr/bitcoin-fiscalite/ | fr/bitcoin-indice-frais/ | fr/bitcoin-calculateur-dca/ | fr/bitcoin-vendre-ou-emprunter/ | fr/bitcoin-succession/ |
| es | es/bitcoin-impuestos/ | es/bitcoin-indice-comisiones/ | es/bitcoin-calculadora-dca/ | es/bitcoin-vender-o-pedir-prestado/ | es/bitcoin-herencia/ |
| pl | pl/bitcoin-podatki/ | pl/bitcoin-indeks-oplat/ | pl/bitcoin-kalkulator-dca/ | pl/bitcoin-sprzedac-czy-pozyczyc/ | pl/bitcoin-dziedziczenie/ |
| hu | hu/bitcoin-adozas/ | hu/bitcoin-dijindex/ | hu/bitcoin-dca-kalkulator/ | hu/bitcoin-eladas-vagy-hitel/ | hu/bitcoin-orokles/ |
| uk | uk/bitcoin-podatky/ | uk/bitcoin-indeks-komisii/ | uk/bitcoin-kalkuliator-dca/ | uk/bitcoin-prodaty-chy-pozychyty/ | uk/bitcoin-spadshchyna/ |
| ru | ru/bitcoin-nalogi/ | ru/bitcoin-indeks-komissiy/ | ru/bitcoin-kalkulyator-dca/ | ru/bitcoin-prodat-ili-zanyat/ | ru/bitcoin-nasledstvo/ |
(each is a folder with `index.html`).

## Keep exactly as in English (value = key)
- Brand and product names: Virtuse, Virtuse CFO, Virtuse Brief, Partner Finder, Stacking Strategist,
  Loan &amp; Liquidity Copilot, Tax &amp; Inheritance Agent, all partner names, Auto-Invest.
- The single letters V, i, r, t, u, s, e (the footer logo), "EN", "BTC / EUR · 90 days" may
  translate only "90 days".
- The language names in the menu (English, Slovenčina, Čeština, Deutsch, Polski, Magyar,
  Français, Español): keep them as they are.
- The Brief issue headline, its excerpt and the cover alt text ("Bitcoin Beat the War…",
  "Up 65% against gold…", "Cover image: Bitcoin Beat the War…"): the Brief is published in
  English, keep these English. In "Latest Brief · 5 Oct 2026 · 3 min" translate "Latest Brief",
  the date and "min"; in the `js` strings "Latest Brief · " and " min" likewise.
- File names (`kraken-ledgers-2026.csv`).

## Style rules
- Register as on the existing pages: sk and cs formal (vy-form), de Sie, fr vous, es usted,
  pl formal-neutral with imperative buttons, hu neutral (Ön where needed), uk ви, ru вы.
- Numbers in the local format. Decimal comma where the language uses it. Space before % in
  sk, cs, de, fr, es ("0,25 %", "5 % p. a."); no space in pl, hu, uk, ru ("0,25%").
  Euro after the amount with a space: "43 000 €" (sk, cs, fr, pl, hu, uk, ru), "43.000 €" (de, es).
  "$0.043/kWh" becomes "0,043 USD/kWh" in decimal-comma languages.
- Dates in the local form: "1 Nov" / "1 November" (e.g. de "1. Nov." / "1. November", sk
  "1. nov." / "1. novembra").
- Short UI labels stay short (nav, buttons, badges "Soon" / "New", "Fee", "Per year").
- MiCA: never "best", "recommended", "advice" or similar; keep "compare", "published fees",
  "match your criteria", "Not advice." The site compares; it never recommends.
- Values are inserted as raw HTML text: write `&` as `&amp;`, keep `&rarr;`, `&mdash;`, `&copy;`
  where the English has them, never use `<` or `>`.
- Preserve leading and trailing spaces exactly as in the key (e.g. " min", "Latest Brief · ").
- Keep sentences natural; the English is written plainly, so should yours be.

## Report back
For each language: the check result, and 2–3 lines on terminology choices you took from the
existing pages (and anything you were unsure about).
