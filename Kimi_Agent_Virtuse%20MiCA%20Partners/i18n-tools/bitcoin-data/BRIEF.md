# Translating the new Bitcoin Data page bitcoin-data.html (design v2, live dashboard)

Folder: this file's folder (`i18n-tools/bitcoin-data/`). Site root is two levels up (read only, do not edit site files).

## Task
`en.json` holds every text of the new English `bitcoin-data.html` (key -> English). Write `<lang>.json` with
**exactly the same keys**, values translated. Then run `python3 check.py <lang>` until it reports 0 problems.
Do not edit any other file.

## Sources to reuse (consistency beats a "better" synonym)
1. `../../<lang>/bitcoin-data.html` (the current, old-design page in your language): metric labels (block height,
   hash rate, difficulty, circulating supply, next halving, difficulty adjustment, latest block, transactions, size,
   miner, fee environment, ~30 minutes, ~1 hour, minimum relay, market cap, sats per $1) and the sub-nav chart names
   (Retirement Calculator, BTC Dominance, 200 WMA, Rainbow Chart, Root-Scale Cycles, Trading Volume, Fear & Greed,
   Asset Returns, Monthly Returns). Reuse its wording where the English means the same.
2. `../bots/<lang>.json`, `../tax/<lang>.json` (already-translated v2 pages): identical English keys ("sources" style,
   every `b_*` Brief key, "email") must use the exact same translation. `../home/<lang>.json` for register.

## Rules
- Placeholders `{n}`, `{t}`, `{d}` must stay literally (check.py enforces it). `n_block_ago` = "mined {t} ago" where
  {t} becomes e.g. "5 min"; `s_halving_sub` = "blocks left · est. {d}" where {d} is a date; `p_chart` = "Price, last {n} days".
- Units: keep "sat/vB", "EH/s", "T", "BTC", "MB", "USD", "EUR". `u_s`, `u_min`, `u_h` are short unit words after a number
  (s, min, h) in local form; `u_days`, `u_years` plural words.
- Keep brand/source names: mempool.space, CoinGecko, Binance, S&amp;P 500, GLD, SPY, BND, Virtuse Brief.
- Write `&` as `&amp;`. No em dashes in prose. Numbers stay (21,000,000 in local grouping, 22, 2010, 200).
- `c_dom` / `c_dom_p`: neutral framing of the BTC dominance chart ("Bitcoin's share of the total crypto market cap,
  for context"); do not call it "BTC Dominance" in the title.
- MiCA: no "best/leading/recommended"; keep the disclaimers ("may be delayed", "Not investment advice", "Past
  performance is not a reliable indicator of future results") accurate.
- Register: sk/cs vy-form, de Sie, fr vous, es usted, pl formal-neutral (buttons as nouns), hu neutral/Ön, uk ви, ru вы.
- Short UI labels stay short (`k_*`, `p_30`, `p_90`, `stale`, `retry`, `c_tool`, `s_issued`, `fallback`).

## Report back
check result per language and 2-3 lines on terminology taken from the old page / other v2 pages.
