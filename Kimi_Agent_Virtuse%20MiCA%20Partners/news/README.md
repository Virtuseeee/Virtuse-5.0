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
| `../data/macro.json` | Macro figures for the Brief (2026-11-11): **By the numbers** (left: BTC/USD + 24h, 1 BTC in gold oz, Fear & Greed from the Pulse feed; right: S&P 500, EUR/USD, inflation US CPI-U / euro area HICP y/y), the ticker (S&P 500, gold, Brent, EUR/USD, US 10Y added after the Bitcoin items), **Coming up** under Pulse (next central bank decisions + any `events` in `macro-build/meetings.json`) and the **Central banks** table in the Newsletter rail (Fed, ECB, BoE, BoJ: rate + next decision). Built daily by `macro-build/build.mjs` in the Asset returns Action; the page reads it from raw.githubusercontent.com first, `data/macro.json` is the fallback. Meeting dates live in `macro-build/meetings.json` (official calendars; add each new year). US CPI shows the latest month with a year-ago index (Oct 2025 was never collected, so Oct 2026 y/y is blank at BLS and FRED). The treasury ledger left the Brief: the full list (`data/btc-treasuries.json`, CoinGecko) is on `bitcoin-data.html#treasuries`. |
| `news-markets.json` | **News & Markets** (under the hero): four category cards in the Further-reading pattern (kicker, title, deck, date + source). Taken from the latest newsletter's "What else have you missed?" list: exactly 4 `items` with `category`, `title`, `excerpt`, `date` (YYYY-MM-DD), `source`, `url` (https). Static HTML in `news.html` between `news-markets` markers: after editing run `python3 seo-ops/news_markets.py` (`--check` exits 1 if stale). Page order: Pulse/hero, News & Markets, Magazine (`#blog`), Newsletter (`#issues`), Tools (`#tools`: Retirement Calculator, Verdict, Stacking Strategist, Tax & Inheritance Agent; static HTML, `utm_medium=tools`). |
| `news-pulse.json` | Fallback when the Worker's `/pulse.json` fails. Pulse shorts from original outlets. The header says `Updated today · HH:MM` whenever items render, whatever the file's `updated` stamp says, so keep this copy recent. The strip under the logo is today's date (Europe/Bratislava), set by `news.js`; only the featured eyebrow carries the issue date. Optional `tag` (`ETF`, `Macro`, `World`, `Policy`, `Mining`, `Security`; legacy `Fed` shows as `Macro`) drives the monoline icon. `Macro` and `World` items may run without Bitcoin in the text; every other tag goes through the Bitcoin-only filter. The `what_moved` line is no longer shown (2026-11-10). CTAs render as `Read at {Outlet}` or `Full story`. Empty `items` shows the desk figure + “Desk updating.” Optional `feed` URL is fetched first if set. Cap is 4–5. Bitcoin-only filter is applied in `news.js`. |
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
| `pulse-icons.svg` | ETF, Macro, World, Policy, Mining, Security (sprite in `news.html`) |
| `desk-updating.svg` | Empty / loading desk figure |
| `og-card.png` / `og-card.svg` | Wordmark + mark on `--bg` |
| `firefish-promo.png` | Official Firefish OG (“Never sell your Bitcoin. Borrow against it.”) |


## Slovak Brief (2026-11-11, branch `feat/brief-sk`)

`sk/news.html` is built from the live `news.html` by `i18n-tools/build_brief_sk.py`: same layout, Slovak text (every English string must map, or the build stops), Slovak featured issue from `news/issues-sk.json`, Slovak pages linked where they exist. `news.js` reads `<html lang>` (Slovak UI strings, `sk-SK` numbers/dates, `/sk/stories/`, WordPress SK category 26). Rebuild after any change to `news.html`:

    python3 seo-ops/news_sk_map.py                    # issues-sk.json from the stories' hreflang
    python3 Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/build_brief_sk.py

News & Markets has `title_sk` / `excerpt_sk` in `news-markets.json` (`seo-ops/news_markets.py` writes both pages). Also on this branch: Pulse "Updated X h ago" + "Desk updating" after 8 h + "Before the release" demotion (see `cloudflare-worker/PULSE.md`), CPI/NFP in Coming up, the macro-intraday workflow, and the inflation tile's m/m note and flash label. Issues without a Slovak story appear in the Slovak list in English, marked (EN).
