# Virtuse Brief (`news.html`)

Public home of **Virtuse Brief** only. Publisher: Virtuse. Cadence: weekly on Monday.

One-liner: `Virtuse Brief. Bitcoin-only. No tokens. No PR.`

Served at `https://virtuse.com/news.html` and `https://staging.virtuse.com/news.html`.

Three-column Gazette desk (Pulse · weekly cover · by-the-numbers + capture). Not a centered magazine. Dark is the default. A nav Light/Dark control persists `localStorage vb-theme` and sets `html data-theme`. Pulse is the forthcoming daily send — never the page title, H1, or From-name.

Banned on this page as product names: any “Satoshi …” title. **Virtuse News** appears only as “Formerly Virtuse News” in footer fine print.

Mark files use the face pictogram only. Alt, aria, and OG text: **Virtuse Brief**.

Do not restyle the Virtuse hub. Do not add Hub commerce grids.

## Subscribe (Resend audience ENG)

Exactly two quiet captures, one list:

- Compact Atlantic-style card in the hero right rail: email + **Get the Brief**.
- Quiet Lenny-style footer form (`#subscribe`): email + Subscribe, no “Get the Brief” label and no hairline under the disclaimer.

Both POST to the existing Cloudflare Worker:

`POST https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe`
`{ email, hp, lang: "en" }`

No new ESP. The Worker does not store a name field. No sticky bar. No full-bleed Join band.

Unsubscribe in the footer points at `#subscribe` (the live list-unsub route needs a signed per-email token from the welcome mail).

## Editor files

| File | What to edit |
|---|---|
| `news-pulse.json` | Pulse shorts from original outlets. Optional `tag` (`ETF`, `Fed`, `Policy`, `Mining`, `Security`) drives the monoline icon. CTAs render as `Read at {Outlet}` or `Full story`. Empty `items` shows the desk figure + “Desk updating.” Optional `feed` URL is fetched first if set. Cap is 4–5. Bitcoin-only filter is applied in `news.js`. |
| `issues.json` | Weekly issue archive (date, title, excerpt, slug, `image`). A row with `"essay": true` paints the Blog / Ras Take grid first; related WP posts fill remaining columns. `sponsor` is unused on this layout. |

## Live data

The **ticker** (above nav) and **By the numbers** tiles (six figures: BTC/USD, 24h, Hashrate · 3d, Fees, Sats / $, Block) use mempool.space, with Binance / CoinGecko for the 24h change. Failures render dashes.

**Data desk** is a tabbed module in the right column of the Latest issues band (full rail height). Short dek + Open link only; no invented live metrics. Fine print: “Run the numbers. Not a recommendation.”

- Full data desk: `bitcoin-data.html`
- 200W MA: `ma-200w.html`
- Rainbow: `rainbow-chart.html`
- DCA / Stacking: `stacking.html?utm_source=stacking&utm_medium=widget`
- Retirement: `retirement-calculator.html`
- Fee Index: `bitcoin-fee-index/`

## Page order

1. Live ticker (orange hairline, mono stats)
2. Sticky nav (face mark + Virtuse Brief, muted mono links, Get the Brief, theme)
3. Edition line (`Latest Brief · Mon, Sep 14, 2026` — muted, not orange)
4. Three-column hero: Pulse · weekly + cover · six tiles + Atlantic capture
5. Latest issues `#issues` with cover images; Data desk in the right column
6. Blog / Ras Vasilisin’s Take (three columns, omit if empty)
7. Footer with quiet Lenny-style signup (`#subscribe`)

## Marks and drawings

| File | Use |
|---|---|
| `brief-mark.png` | Face pictogram, light knockout, dark theme |
| `brief-mark-dark.png` | Face pictogram, dark ink, light theme |
| `pulse-icons.svg` | ETF, Fed, Policy, Mining, Security (sprite in `news.html`) |
| `desk-updating.svg` | Empty / loading desk figure |
| `og-card.png` / `og-card.svg` | Wordmark + mark on `--bg` |
