# Update pass for bots translations (2026-10-11)

`en.json` changed. In each `<lang>.json` you are given, update ONLY these keys (translate from the current English in
`en.json`), add the new ones, keep every other value unchanged, then run `python3 check.py <lang>` until 0 problems.
Keep the key order of en.json (insert new keys where en.json has them). Write JSON with indent=1, UTF-8, trailing newline.

Changed: `fine`, `pr_coinrule_types`, `pr_coinrule_body`, `pr_coinrule_f2`, `pr_cryptohopper_types`, `pr_cryptohopper_body`,
`pr_cryptohopper_f3`, `pr_cryptohopper_f4`, `pr_revenuebot_ex`, `pr_revenuebot_body`, `pr_revenuebot_f2`.
New: `pr_coinrule_avail`, `q4`, `a4`, `a4_link`.

Rules (same as BRIEF.md): same register and terminology as the rest of that file (reuse its existing words for
"exchange", "trade-only API key", "withdrawal", "paper trading", "grid", "see provider", "self-custody"; `a4_link`
should match the wording the language's v2 Custody page uses for self-custody, see `../secure/<lang>.json`).
Facts must stay exact: 3-day free trial; Binance, Bybit, OKX; France as the example country; the exchange holds coins
and keys, the bot never does; BTC only. Brand names unchanged. Write `&` as `&amp;`. No em dashes. No "best/leading/
recommended". Polish buttons as nouns, not imperatives. Spanish "partners", not "socios".
