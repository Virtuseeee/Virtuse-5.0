# Translating the new Corporate Treasury page treasury.html (design v2)

Folder: this file's folder (`i18n-tools/treasury/`). Site root is two levels up (read only, do not edit site files).

## Task
`en.json` holds every text of the new English `treasury.html` (key -> English). Write `<lang>.json` with
**exactly the same keys**, values translated. Then run `python3 check.py <lang>` until it reports 0 problems.
Do not edit any other file.

## Sources to reuse (consistency beats a "better" synonym)
1. `../../<lang>/treasury.html` (the current, old-design Treasury page in your language): steps, "Who we serve"
   bullets, partner descriptions/feature bullets, regulator names, "Contact Coinbase" style CTAs, tags. Reuse its
   wording where the English means the same.
2. `../mining/<lang>.json` and `../lending/<lang>.json` (already-translated v2 pages): identical English keys there
   ("step", "details", "col_partner", "q_h2_a", all `b_*` Brief keys, "email", "Book a free 15-minute call" style,
   "Bitcoin tax guides") must use the exact same translation.
3. `../home/<lang>.json` and `../../<lang>/index.html` for register and terminology.

## Rules
- Keep brand/product names: Coinbase, Coinbase Institutional, Coinbase Prime, Sygnum, Sygnum Select, BitGo,
  MicroStrategy, Michael Saylor, Ras Vasilisin, MiCA, CASP, CSSF, FINMA, BaFin, SOC 2 Type II, ETP, API, HNWI, AuA
  (AuA/HNWI may be localized only if the old page does).
- `art_title` is the English article's title: keep it in English (the page adds "(in English)" automatically).
  Translate `art_teaser`, `art_by` ("By" only), `art_k`, `art_cta`, `art_img_alt`.
- `data_label` contains `{rank}` and `{n}` placeholders: keep both literally.
- Numbers: keep every number; local format ($320M -> e.g. "320 mil. $" / "320 Mio. USD" as the old page does;
  CHF 4B+ likewise; "27", "13", "15-minute"). Space before % only matters if you write %.
- Write `&` as `&amp;`.
- MiCA: never "best", "leading", "recommended", "advice" as a claim. The page compares; it never recommends.
  The disclaimers ("does not give investment advice", "not tax or accounting advice") must stay accurate.
- Register: sk/cs vy-form, de Sie, fr vous, es usted, pl formal-neutral (prose "Państwo"; buttons as nouns or
  first person, not ty-imperatives), hu neutral/Ön, uk ви, ru вы. Spanish: "partners" not "socios".
- Short UI labels stay short (`contact`, `details`, `col_*`, `art_k`, `data_k`, tags).
- `step` is the word "Step" (shown as "<step> 01").
- No em dashes in prose (house rule); use a colon, comma or period.

## Report back
check result per language and 2-3 lines on terminology taken from the old page / other v2 pages.
