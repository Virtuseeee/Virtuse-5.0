# Virtuse News (Phase 1)

English newsletter hub served at `https://virtuse.com/news.html`.

This is a static page plus JSON the desk can edit. It is not a clone of virtuse.com and not the 2022 satosi.sk magazine layout.

Phase 2 will rebrand the wordmark to Satoshi. Color, type, and lockup tokens live in `news.css` (`:root`) so that swap is one file.

## Subscribe (Resend audience ENG)

The hero form POSTs to the existing Cloudflare Worker:

`POST https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe`
`{ email, hp, lang: "en" }`

Name is collected in the UI only. The Worker does not store a name field yet; do not invent a second backend.

English contacts join the Worker’s default Resend segment (`RESEND_SEGMENT_ID`). The ENG audience id to match is:

`3484543c-ea9c-4579-b298-5e4f1c2295fa`

Confirm that secret equals this id before treating News signups as a dedicated ENG list. Daily Pulse send is not wired. Copy on the page says so.

## Editor files

| File | What to edit |
|---|---|
| `news-pulse.json` | Up to three Bitcoin-only stories from the last 24–48h. Link the **original outlet**, not virtuse.com. Empty `items` shows “No distinct Bitcoin-specific development today.” Optional `feed` URL is fetched first if set. |
| `issues.json` | Weekly issue archive (date, title, excerpt, slug, image, read time). `sponsor` is a string like `"Acme"` or `null`. A non-null value reveals the outlined Sponsored block; empty stays hidden. |

Blog cards load live from WordPress categories Blog (`13`) and Media Columns (`15`). Boxes (`16`) and Reports (`35`) are excluded.

## Live data

Ticker and dashboard use the same public endpoints as `bitcoin-data.html` / `btc-dominance.html`: mempool.space, CoinGecko, Binance. Failures render dashes, not invented numbers.

DCA tool: `https://virtuse.com/bitcoin-dca-calculator/`
Retirement calculator: `https://virtuse.com/retirement-calculator.html`
