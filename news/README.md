# Satoshi Brief (news.html)

Public home of **Satoshi Brief**. Brand is spelled with the *h* — never “satosi”. This page is a light editorial desk (white / off-white, gray bands, orange accents) with a dark theme behind an explicit toggle. It is not a clone of the Virtuse hub.

Served today at `https://virtuse.com/news.html` and `https://staging.virtuse.com/news.html`. Canonical and Open Graph already point at the future subdomain:

`https://satoshi.virtuse.com/`

`satoshi.html` is a thin redirect to `news.html` so the same document can later sit at the subdomain root.

This is a static page plus JSON the desk can edit. Light is the default on every first visit (no `prefers-color-scheme` auto-dark). A theme toggle (moon/sun, persisted in `localStorage` as `satoshi-theme`) switches a `data-theme="dark"` reverse only after an explicit click.

Forbidden on this page: “Satoshi Newsletter”, “Virtuse News”, “Satoshi News”. Pulse is the forthcoming daily send — never the page title or H1.

## Subdomain / DNS (not cut over)

Do **not** invent DNS records in hosting from this repo. When ready to put the desk on its own host:

1. Add a **CNAME** `satoshi` on `virtuse.com` pointing at the same host that currently serves the site (GitHub Pages `staging.virtuse.com` / Webglobe `virtuse.com`, depending on which environment you are wiring).
2. Point the subdomain document root at this HTML (`news.html` as `/index.html`, or keep `news.html` and redirect `/` → it).
3. Confirm HTTPS on `satoshi.virtuse.com` before treating canonical as live.
4. Leave `https://virtuse.com/news.html` in place (or 301 it to the subdomain) so existing links do not 404.

Example record (hosting panel / DNS provider — fill the target from the live host, do not guess):

```
satoshi.virtuse.com.    CNAME    <pages-or-webglobe-host>.
```

## Subscribe (Resend audience ENG)

Two captures, not two essays:

- Compact strip under the hero (one line + email + Get the Brief). Sticky on desktop after the hero, not sticky on first paint, never sticky on small screens.
- One full form before the footer (`#subscribe`).

Both POST to the existing Cloudflare Worker:

`POST https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe`
`{ email, hp, lang: "en" }`

Name is collected on the full form only. The Worker does not store a name field yet; do not invent a second backend.

English contacts join the Worker’s default Resend segment (`RESEND_SEGMENT_ID`). The ENG audience id to match is:

`3484543c-ea9c-4579-b298-5e4f1c2295fa`

Confirm that secret equals this id before treating Satoshi signups as a dedicated ENG list. Daily Pulse send is not wired. Copy on the page says so.

Unsubscribe in the footer points at `#subscribe` (the live list-unsub route needs a signed per-email token from the welcome mail — do not invent a fake Resend URL).

## Editor files

| File | What to edit |
|---|---|
| `news-pulse.json` | Pulse shorts from original outlets. Outlet CTAs render as `Read at {Outlet}` (CryptoSlate spelling is fixed). Empty `items` shows “No distinct Bitcoin-specific development today.” Optional `feed` URL is fetched first if set. Weekly takes do not belong here — they are the featured Brief on `news.html`. |
| `issues.json` | Weekly issue archive (date, title, excerpt, slug, image, read time). `sponsor` is a string like `"Acme"` or `null`. A non-null value reveals the outlined Sponsored block; empty stays hidden. The current featured Brief is hardcoded on `news.html` from the live weekly take. |
| `../satoshi-lockup.png` | Header lockup (proprietary Virtuse mark: CTA-orange face `#F7931A` + italic charcoal wordmark). Recolor ochre→orange only; do not redraw geometry or OCR-edit letters. |

Blog cards load live from WordPress categories Blog (`13`) and Media Columns (`15`). Boxes (`16`) and Reports (`35`) are excluded.

## Live data

Ticker and **Satoshi Analytics** use the same public endpoints as `bitcoin-data.html`: mempool.space, CoinGecko, Binance. Failures render dashes, not invented numbers.

Calculators are text links under the tiles, not peer cards:

- DCA calculator: `https://virtuse.com/stacking.html?utm_source=stacking&utm_medium=widget`
- Retirement calculator: `https://virtuse.com/retirement-calculator.html`
- Open data desk: `https://virtuse.com/bitcoin-data.html`

## Page order

1. Live ticker
2. Nav (Satoshi lockup)
3. Hero = Satoshi Brief (H1) + compact subscribe strip
4. Pulse shorts
5. Featured Brief (current weekly take)
6. Latest issues
7. Satoshi Blog
8. Satoshi Analytics
9. Full Get the Brief signup
10. Footer (Satoshi Brief one-liner, disclaimer, Archive / Data desk / Unsubscribe)
