# Translating the new Loans page lending.html (design v2)

Folder: this file's folder (`i18n-tools/buy/`). Site root is two levels up (read only, do not edit site files).

## Task
`en.json` holds every text of the new English `lending.html` (Loans: Firefish Bitcoin-backed loans) (key -> English). Write `<lang>.json` with
**exactly the same keys**, values translated. Then run `python3 check.py <lang>` until it reports 0 problems.
Do not edit any other file.

**Start from `<lang>.prefill.json`** (strings already translated on the live Buy Bitcoin page in your language): copy them unchanged, then translate the rest.

Also reuse `../buy/<lang>.json` for identical English wording (e.g. the "What we earn" note, "Lowest fee" style pills).

## Sources to reuse (consistency beats a "better" synonym)
1. `<lang>/lending.html` (the current, old-design Loans page in your language): steps, borrower/investor texts, loan facts, feature
   bullets, countries, CTA labels ("Get Trezor"…),
   "What we earn" disclosure. Reuse its wording where the English means the same.
2. `../home/<lang>.json` (the already-translated new homepage, key = English text): reuse the exact translation
   for identical English strings (e.g. "Plan my stack", "Prefer to talk?", "Book a free 15-minute call",
   "Find partners in 60 seconds", "You buy every month", "/ month", "Fee", "Per year", "Get the Brief", "Free.",
   "Unsubscribe anytime. Not advice.", the €480 difference sentence, "Full Fee Index", "What we earn" note,
   "Virtuse Brief.", "Bitcoin-only, every Monday.", "Read the issue →", "All issues and the blog →", "Email address").
3. `<lang>/index.html` for register and terminology.

## Rules
- Keep brand/partner/product names as in English (21bitcoin, ByBit EU, Bybit EU GmbH, Kraken, Kraken Pro,
  Invity, Crypto.com, Foris DAX MT Limited, SatoshiLabs, Trezor, BitGo, Auto-Invest, Auto Buy, Visa Card, MiCA,
  MiCAR, CASP, FMA, MFSA, KYC, EEA may be localized as the old page does, e.g. EWR/EHP/EEE).
- Numbers: keep every number; local format. Decimal comma where the language uses it; space before % in
  sk, cs, de, fr, es ("0,25 %"); no space in pl, hu, uk, ru. "100,000+" in local grouping.
- `diff_line` contains HTML (`<b id="diffYr">€48</b>`, `<b id="diffBase">€6,000</b>`): keep the two `<b id=…>`
  tags and their ids exactly, keep "€48" and "€6,000" literally inside them (the builder reformats them).
- `earn` starts with `<b>…:</b>`: keep the `<b>` tag. `h1_grad` contains `&#8209;` (non-breaking hyphen) in
  "MiCA&#8209;licensed": keep an `&#8209;` between "MiCA" and the rest if your translation has a hyphen there,
  otherwise write the word plainly. Write `&` as `&amp;` elsewhere.
- `h1_a` + `h1_grad` + `h1_b` form one sentence ("Buy Bitcoin through" + "MiCA-licensed" + "partners."). Adjust
  the split so it reads naturally; `h1_grad` (gradient) should hold the "MiCA-licensed" idea.
- MiCA: never "best", "leading", "recommended", "advice". The page compares; it never recommends. Facts only.
- Register: sk/cs vy-form, de Sie, fr vous, es usted, pl formal-neutral (prose "Państwo"; buttons as nouns or
  first person like the new pl homepage, not ty-imperatives), hu neutral/Ön, uk ви, ru вы.
- Short UI labels stay short (`get`, `details`, `col_*`, `show_all`, `fee_site`, badges).
- `step` is the word "Step" (shown as "<step> 01").

## Report back
check result per language and 2-3 lines on terminology taken from the old page / homepage.

## Loans specifics
- Keep all numbers and facts exactly: 5–15% p.a., up to 50% LTV, 3/6/12/18/24 months, EUR/CHF/CZK/USDC, EUR 800, EUR 22.5M, 8,600 investors, ESMA MiCA register. Local number format.
- Firefish, ESMA, MiCA, LTV, USDC stay as names. "multi-sig escrow": use the old page's term.
- Risk text (fine_risk, a1) must stay accurate and neutral: liquidation risk, not advice. No promises of returns.
- Tax answer (a3): no advice, just "depends on your country" + guide pointer.
