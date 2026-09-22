# Virtuse Brief (`news.html`)

Public home of **Virtuse Brief** only. Publisher: Virtuse. Cadence: weekly on Monday.

One-liner: `Virtuse Brief. Bitcoin-only. No tokens. No PR.`

Served at `https://virtuse.com/news.html` and `https://staging.virtuse.com/news.html`.

Three-column Gazette desk (Pulse · weekly cover · by-the-numbers + capture). Not a centered magazine. Dark is the default. A nav Light/Dark control persists `localStorage vb-theme` and sets `html data-theme`. Pulse is the forthcoming daily send — never the page title, H1, or From-name.

Banned on this page as product names: any “Satoshi …” title. Do not reintroduce “Virtuse News” as a live product name.

Nav uses the horizontal lockup (`brief-nav-logo.svg` / `-on-light.svg`, PNG companions). Alt: **Virtuse Brief**. OG still uses `og-card.png`.

Do not restyle the Virtuse hub. Do not add Hub commerce grids.

## Subscribe (Resend audience ENG)

Exactly two quiet captures, one list:

- Compact Atlantic-style card in the hero right rail: email + **Get the Brief** (orange text + orange outline, Gazette Join the Brief pattern).
- Footer form (`#subscribe`): email + **Subscribe** (solid orange fill — the loud control). Nav **Get the Brief** is the same orange outline as the hero capture.

Both POST to the existing Cloudflare Worker:

`POST https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe`
`{ email, hp, lang: "en" }`

No new ESP. The Worker does not store a name field. No sticky bar. No full-bleed Join band.

Unsubscribe in the footer points at `#subscribe` (the live list-unsub route needs a signed per-email token from the welcome mail).

## Editor files

| File | What to edit |
|---|---|
| `news-pulse.json` | Pulse shorts from original outlets. Optional `tag` (`ETF`, `Fed`, `Policy`, `Mining`, `Security`) drives the monoline icon. CTAs render as `Read at {Outlet}` or `Full story`. Empty `items` shows the desk figure + “Desk updating.” Optional `feed` URL is fetched first if set. Cap is 4–5. Bitcoin-only filter is applied in `news.js`. |
| `issues.json` | Weekly issue archive (date, title, excerpt, slug, `image`). The Latest issues band renders 4 weekly issues (featured Brief excluded). A row with `"essay": true` paints the Blog / Ras Take grid first; related WP posts fill remaining columns. `sponsor` is unused on this layout. |
| `treasury-ledger.json` | Last-known public-company BTC holdings (CoinGecko snapshot + `as_of`). Live fetch from `api.coingecko.com` overwrites this when it succeeds. Never invent holdings. |
| `firefish-promo.png` | Official Firefish OG creative, cover-cropped as the Partners rail poster. |

## Live data

The **ticker** (above nav) and **By the numbers** tiles (six figures: BTC/USD, 24h, Hashrate · 3d, Fees, Sats / $, Block) use mempool.space, with Binance / CoinGecko for the 24h change. Failures render dashes.

**Data desk** is a link strip in the right column of the Latest issues band. Each tab is itself a navigation link to the matching Virtuse tool page — no orange “Dashboard →” panels under the strip. Below the tabs sits **The treasury ledger** — a compressed Gazette-style bar list of top corporate BTC holders. Live figures come from CoinGecko’s public-company treasury endpoint (already on `connect-src`); if that fetch fails, `treasury-ledger.json` (dated snapshot) is shown. Dashes if both are missing. Do not attribute CoinGecko on the page.

On desktop the right rail (`#issuesRail`) matches the Latest issues cards’ height. **Data desk** (`#data-desk`, tab links + treasury ledger) fills the first card row. **Partners** starts at the top edge of issues row 2 (cards 3–4 in the 2×2) and stays bottom-aligned with the last issue cards. Rail gap matches the archive `row-gap` (28px). No invented live metrics. Do not put “Run the numbers. Not a recommendation.” under Data desk (that line stays only under By the numbers in the hero rail). Tabs shrink to the label, each with a fine border; hover only (no selected state — they leave the page).

**Partners** (this edition: Firefish) keeps the Partners label, not Sponsored. Composition is a rail-fit poster: official `news/firefish-promo.png` cover-cropped (`object-position: center 42%`) plus the short claim “Never sell your Bitcoin. Borrow against it.” and CTAs. The Firefish calculator iframe is omitted — it does not fit a one-card-tall, ~240–360px-wide rail without becoming unusable. Primary CTA is the Virtuse referral `https://app.firefish.io/auth/sign-up?ref=virtuseloan`. Secondary text link **On Virtuse →** goes to `lending.html`. Partner disclosure. Not editorial.

**By the numbers** and **Data desk** sit on a Measured Record inset (`--record-bg`: Gazette `sg-bg-deep`, `#1C1C19` dark / `#EBE9E4` light).

- Dashboard: `bitcoin-data.html`
- Trading volume: `trading-volume.html`
- BTC dominance: `btc-dominance.html`
- Fear and greed: `fear-greed.html`
- 200W MA: `ma-200w.html`
- Rainbow: `rainbow-chart.html`
- DCA / Stacking: `stacking.html?utm_source=stacking&utm_medium=widget`
- Retirement: `retirement-calculator.html`
- Fee Index: `bitcoin-fee-index/`

## Page order

1. Live ticker (orange hairline, mono stats)
2. Sticky nav (V + virtuse brief lockup at ~26px / −25%, muted mono links, outline Get the Brief, theme)
3. Edition line (`Latest Brief · Mon, Sep 14, 2026` — muted, not orange)
4. Three-column hero: Pulse · weekly + cover · six tiles + Atlantic capture
5. Latest issues `#issues` — four weekly covers, **All issues** → `blog.html`; right rail: Data desk (row 1) + Partners Firefish poster (row 2 → column bottom)
6. Blog / Ras Vasilisin’s Take (three columns, omit if empty) + **Blog archive** → `blog.html`
7. Footer with quiet Lenny-style signup (`#subscribe`)

## Marks and drawings

| File | Use |
|---|---|
| `brief-nav-logo.svg` / `.png` | Horizontal lockup (white V + sky-blue stroke + “virtuse brief”), dark nav |
| `brief-nav-logo-on-light.svg` / `.png` | Same lockup in dark ink, light nav |
| `brief-mark.png` | Face pictogram, light knockout (kept; not used in nav) |
| `brief-mark-dark.png` | Face pictogram, dark ink (kept; not used in nav) |
| `pulse-icons.svg` | ETF, Fed, Policy, Mining, Security (sprite in `news.html`) |
| `desk-updating.svg` | Empty / loading desk figure |
| `og-card.png` / `og-card.svg` | Wordmark + mark on `--bg` |
| `firefish-promo.png` | Official Firefish OG (“Never sell your Bitcoin. Borrow against it.”) |
