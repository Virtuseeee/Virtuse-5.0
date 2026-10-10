# Translating the new Bitcoin Tax page tax.html (design v2)

Folder: this file's folder (`i18n-tools/tax/`). Site root is two levels up (read only, do not edit site files).

## Task
`en.json` holds every text of the new English `tax.html` (key -> English). Write `<lang>.json` with
**exactly the same keys**, values translated. Then run `python3 check.py <lang>` until it reports 0 problems.
Do not edit any other file. Country names in the pills are not in the JSON (they come from seo-build data).

## Sources to reuse (consistency beats a "better" synonym)
1. `../../<lang>/tax.html` (the current, old-design Tax page in your language): the 4 steps, partner descriptions,
   feature bullets, countries, "Get Divly" style CTAs, the comparison table labels/values ("Free tier", "Yes (200 tx)",
   "Privacy", "Multi-country EU", "Power users", "Global coverage", price formats), "Country tax guides" wording.
2. `../treasury/<lang>.json`, `../mining/<lang>.json` (already-translated v2 pages): identical English keys there
   ("step", "details", "col_use" = "Typical use", "q_h2_a", "h_h2_a", every `b_*` Brief key, "email", "get"-style labels)
   must use the exact same translation. The country guides' tax hub page `../../<lang>/<tax guide folder>/index.html`
   for terms like "indicative overview", "not tax advice", "Tax &amp; Inheritance Agent" (old tax page wording).
3. `../home/<lang>.json` and `../../<lang>/index.html` for register and terminology.

## Rules
- Keep brand/product names: Divly, Blockpit, CoinTracking, Koinly, Bitpanda, BISON, xPub, CSV, KYC, FIFO, LIFO, HIFO,
  "Tax &amp; Inheritance Agent" (keep in English like the site's other tool names, as the old page does).
- Numbers/prices: keep every number and currency exactly, local format as the old page does ("EUR 39/yr" -> e.g.
  "39 EUR/rok"; "From $49/yr (USD)" keeps the dollar price and the "(USD)" note; "10,000 tx" in local grouping;
  "1.9M+" as the old page writes it; 2026, 13, 30+, 7+, 100+, 700+, 300+, 400+, 25+, 14-minute, 2013, 200).
- Write `&` as `&amp;`. `a2` contains the quoted column name "Typical use": quote your own translation of `col_use`
  using your language's quotation marks.
- MiCA: never "best", "leading", "recommended", "advice" as a claim; the page compares, it never recommends. Keep the
  disclaimers ("Not tax advice", referral fee sentence) accurate. No superlatives (no "fastest-growing", "veteran",
  "original", "AI-powered").
- Register: sk/cs vy-form, de Sie, fr vous, es usted, pl formal-neutral (prose "Państwo"; buttons as nouns or first
  person, not ty-imperatives), hu neutral/Ön, uk ви, ru вы. Spanish: "partners" not "socios".
- Short UI labels stay short (`get`, `details`, `col_*`, `a_label`, `b_label`, `all13`, `pr_*_free`, `pr_*_use`).
- `step` is the word "Step" (shown as "<step> 01"). No em dashes in prose; use a colon, comma or period.

## Report back
check result per language and 2-3 lines on terminology taken from the old page / other v2 pages.
