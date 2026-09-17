# Virtuse Brief (`news.html`)

Public home of **Virtuse Brief** only. Publisher: Virtuse. Cadence: weekly on Monday.

One-liner: `Virtuse Brief. Bitcoin-only. No tokens. No PR.`

Served at `https://virtuse.com/news.html` and `https://staging.virtuse.com/news.html`.

Full-bleed Gazette grid (12 columns, desktop main ~8 + rail ~4). Not a centered 720px magazine. Dark is the default. A masthead Light/Dark control persists `localStorage vb-theme` and sets `html data-theme`. Pulse is the forthcoming daily send — never the page title, H1, or From-name.

Banned on this page: Satoshi Brief, The Satoshi Brief, Satoshi News, Satoshi Newsletter, Satoshi Desk. **Virtuse News** appears only as “Formerly Virtuse News” on the bottom signup.

Mark files use the face pictogram only. Alt, aria, and OG text: **Virtuse Brief**. Never caption Satoshi / satosi / Nakamoto.

Do not restyle the Virtuse hub. Do not add Hub commerce grids.

## Subscribe (Resend audience ENG)

Exactly one compact BriefCapture + one full BriefCapture:

- Compact card in the rail (desktop) and one-row under the masthead title on small screens: `VIRTUSE BRIEF` / `Monday. Bitcoin-only.` / email + **Get the Brief**. Becomes sticky on desktop only after the Featured Brief has been scrolled past. Not sticky on first paint, never sticky on small screens.
- One full card before the footer (`#subscribe`).

Both POST to the existing Cloudflare Worker:

`POST https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe`
`{ email, hp, lang: "en" }`

No new ESP. The Worker does not store a name field.

Unsubscribe in the footer points at `#subscribe` (the live list-unsub route needs a signed per-email token from the welcome mail).

## Editor files

| File | What to edit |
|---|---|
| `news-pulse.json` | Pulse shorts from original outlets. Optional `tag` (`ETF`, `Fed`, `Policy`, `Mining`, `Security`) drives the monoline icon. CTAs render as `Read at {Outlet}` or `Full story`. Empty `items` shows the desk figure + “Desk updating.” Optional `feed` URL is fetched first if set. Cap is 4–5. Bitcoin-only filter is applied in `news.js`. |
| `issues.json` | Weekly issue archive (date, title, excerpt, slug). A row with `"essay": true` paints the rail **Read essay** teaser and **Ras Take**; if none, those blocks are omitted. `sponsor` is unused on this layout. |

## Live data

Masthead BTC/USD (omitted while a dash) and the rail **data strip** (four figures) use mempool.space, with Binance / CoinGecko for the 24h change. Failures render dashes.

**Data desk** (page section, formerly Analytics) is calc links only:

- Full data desk: `https://virtuse.com/bitcoin-data.html`
- 200W MA: `ma-200w.html`
- DCA: `https://virtuse.com/stacking.html?utm_source=stacking&utm_medium=widget`
- Retirement: `retirement-calculator.html`

## Page order

1. Masthead edge-to-edge (face mark, VIRTUSE BRIEF, by Virtuse, edition date, BTC/USD, Archive, Data, theme)
2. Compact BriefCapture in the rail (mobile: one-row under title)
3. Featured Brief hero + editorial illustration + 3 bullets + Read this Brief + Older issues
4. Pulse
5. Latest issues `#issues` (full width)
6. Data desk (calc links only)
7. Ras Take (omit if no essay)
8. Full BriefCapture
9. Footer full-width (Archive · Data desk · Hub · Unsubscribe)

## Marks and drawings

| File | Use |
|---|---|
| `brief-mark.png` | Face pictogram, light knockout, dark theme |
| `brief-mark-dark.png` | Face pictogram, dark ink, light theme |
| `featured-brief.svg` | Gavel / Fed colonnade / ledger / cracked bill |
| `pulse-icons.svg` | ETF, Fed, Policy, Mining, Security |
| `desk-updating.svg` | Empty / loading desk figure |
| `og-card.png` / `og-card.svg` | Wordmark + mark on `--bg` |
