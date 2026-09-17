# Virtuse Brief (`news.html`)

Public home of **Virtuse Brief** only. Publisher: Virtuse. Cadence: weekly on Monday.

One-liner: `Virtuse Brief. Bitcoin-only. No tokens. No PR.`

Served at `https://virtuse.com/news.html` and `https://staging.virtuse.com/news.html`.

This is a static page plus JSON the desk can edit. Dark is the default. A masthead Light/Dark control persists `localStorage vb-theme` and sets `html data-theme`. Pulse is the forthcoming daily send — never the page title, H1, or From-name.

Banned on this page: Satoshi Brief, The Satoshi Brief, Satoshi News, Satoshi Newsletter, Satoshi Desk. **Virtuse News** appears only as “Formerly Virtuse News” on the bottom signup.

Do not restyle the Virtuse hub. Do not add Hub commerce grids.

## Subscribe (Resend audience ENG)

Two captures, not two essays:

- Compact row under the H1 (email + **Get the Brief**). Becomes sticky on desktop only after the Featured Brief has been scrolled past. Not sticky on first paint, never sticky on small screens.
- One full form before the footer (`#subscribe`).

Both POST to the existing Cloudflare Worker:

`POST https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe`
`{ email, hp, lang: "en" }`

No new ESP. The Worker does not store a name field.

Unsubscribe in the footer points at `#subscribe` (the live list-unsub route needs a signed per-email token from the welcome mail).

## Editor files

| File | What to edit |
|---|---|
| `news-pulse.json` | Pulse shorts from original outlets. CTAs render as `Read at {Outlet}` or `Full story`. Empty `items` shows “No distinct Bitcoin-specific development today.” Optional `feed` URL is fetched first if set. Cap is 4–5. Bitcoin-only filter is applied in `news.js`. |
| `issues.json` | Weekly issue archive (date, title, excerpt, slug). A row with `"essay": true` paints **Ras Take**; if none, that block is omitted. `sponsor` is unused on this layout. |

## Live data

Masthead BTC/USD and **Data desk** (four figures) use mempool.space, with Binance / CoinGecko for the 24h change. Failures render dashes. Masthead BTC/USD is omitted while the value is a dash.

Text row under the figures: Full data desk · 200W MA · DCA · Retirement.

- Full data desk: `https://virtuse.com/bitcoin-data.html`
- 200W MA: `ma-200w.html`
- DCA: `https://virtuse.com/stacking.html?utm_source=stacking&utm_medium=widget`
- Retirement: `retirement-calculator.html`

## Page order

1. Masthead (Virtuse Brief + by Virtuse · Light/Dark · BTC/USD · Archive · Data)
2. Title + compact capture
3. Featured Brief (hero)
4. Pulse
5. Latest issues `#issues`
6. Data desk
7. Ras Take (omit if no essay)
8. Full signup
9. Footer
