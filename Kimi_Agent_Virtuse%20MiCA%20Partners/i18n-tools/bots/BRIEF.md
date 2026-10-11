# Translating the new Automate (bots) page bots.html (design v2)

Folder: this file's folder (`i18n-tools/bots/`). Site root is two levels up (read only, do not edit site files).

## Task
`en.json` holds every text of the new English `bots.html` (key -> English). Write `<lang>.json` with
**exactly the same keys**, values translated. Then run `python3 check.py <lang>` until it reports 0 problems.
Do not edit any other file.

## Sources to reuse (consistency beats a "better" synonym)
1. `../../<lang>/bots.html` (the current, old-design Bots page in your language): partner descriptions,
   feature bullets, the 4 steps, "Get Coinrule" style CTAs, "Paper trading", "Backtesting", "Strategy marketplace", "DCA", "grid".
2. `../treasury/<lang>.json`, `../mining/<lang>.json` (already-translated v2 pages): identical English keys there
   ("step", "details", "col_use" = "Typical use", "q_h2_a", "h_h2_a", every `b_*` Brief key, "email", "get"-style labels)
   must use the exact same translation. `../tax/<lang>.json` for "Bitcoin tax guides", "not tax advice", "13 EU countries"; `../mining/<lang>.json` `f_all` for "All".
3. `../home/<lang>.json` and `../../<lang>/index.html` for register and terminology.

## Rules
- Keep brand/product names: Coinrule, Cryptohopper, RevenueBot, Binance, OKX, Bitget, Y Combinator, API, DCA (may be localized only if the old page does),
  "Stacking Strategist" (tool name, keep in English).
- Numbers: keep every number exactly in local format (150+, 410,000+, 30-day, 3, 13).
- Facts that must stay accurate: the bot never holds funds; coins stay in the user's exchange account; the API key is
  trade-only without withdrawal rights. Never write that users "keep their keys" on an exchange. Keep the risk sentences
  ("results can be negative", backtests don't guarantee future results) accurate.
- Write `&` as `&amp;`. Keep the `&nbsp;` in `eyebrow` (between "3" and the noun).
- MiCA: never "best", "leading", "recommended", "advice" as a claim; the page compares, it never recommends. Keep the
  disclaimers ("Not tax advice", referral fee sentence) accurate. No superlatives (no "most beginner-friendly", "any exchange", "Bitcoin-focused"; no copy/mirror trading).
- Register: sk/cs vy-form, de Sie, fr vous, es usted, pl formal-neutral (prose "Państwo"; buttons as nouns or first
  person, not ty-imperatives), hu neutral/Ön, uk ви, ru вы. Spanish: "partners" not "socios".
- Short UI labels stay short (`get`, `details`, `col_*`, `f_*`, `pr_*_trial`, `pr_*_use`).
- `step` is the word "Step" (shown as "<step> 01"). No em dashes in prose; use a colon, comma or period.

## Report back
check result per language and 2-3 lines on terminology taken from the old page / other v2 pages.
