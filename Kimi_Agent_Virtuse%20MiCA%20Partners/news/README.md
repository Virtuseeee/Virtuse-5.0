# Satoshi (news hub)

Independent Bitcoin-only news desk. Brand: **Satoshi** (spelled with the *h* — never “satosi”). The page is a light editorial layout inspired by [Satoshi Gazette](https://satoshigazette.org/) (white / off-white, gray bands, orange instead of Gazette red) with a Pulse hero patterned on [Bitcoin Collective](https://newsletter.bitcoincollective.co/).

Served today at `https://virtuse.com/news.html` and `https://staging.virtuse.com/news.html`. Canonical and Open Graph already point at the future subdomain:

`https://satoshi.virtuse.com/`

`satoshi.html` is a thin redirect to `news.html` so the same document can later sit at the subdomain root.

This is a static page plus JSON the desk can edit. It is not a clone of virtuse.com. Light is the default; a Gazette-like theme toggle (moon/sun, persisted in `localStorage` as `satoshi-theme`) switches a `data-theme="dark"` reverse. `prefers-color-scheme` is used only when the visitor has no saved choice.

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

The band under Pulse POSTs to the existing Cloudflare Worker:

`POST https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe`
`{ email, hp, lang: "en" }`

Name is collected in the UI only. The Worker does not store a name field yet; do not invent a second backend.

English contacts join the Worker’s default Resend segment (`RESEND_SEGMENT_ID`). The ENG audience id to match is:

`3484543c-ea9c-4579-b298-5e4f1c2295fa`

Confirm that secret equals this id before treating Satoshi signups as a dedicated ENG list. Daily Pulse send is not wired. Copy on the page says so.

## Editor files

| File | What to edit |
|---|---|
| `news-pulse.json` | At least three Bitcoin-only stories from the last 24–48h. Link the **original outlet**, not virtuse.com. Include `excerpt` (~3 lines) for the Pulse shorts. Optional `image` (must be `blog.virtuse.com` or another host already on the page CSP) for the left featured card; otherwise the weekly-take image is used. Empty `items` shows “No distinct Bitcoin-specific development today.” Optional `feed` URL is fetched first if set. |
| `issues.json` | Weekly issue archive (date, title, excerpt, slug, image, read time). `sponsor` is a string like `"Acme"` or `null`. A non-null value reveals the outlined Sponsored block; empty stays hidden. |
| `../satoshi-lockup.png` | Header lockup (proprietary Virtuse mark: ochre face + italic wordmark). Ship the attached bitmap as-is; do not redraw or OCR-edit letters. |

Blog cards load live from WordPress categories Blog (`13`) and Media Columns (`15`). Boxes (`16`) and Reports (`35`) are excluded.

## Live data

Ticker and **Satoshi Analytics** (merged dashboard + tools, Gazette “By the numbers” tiles) use the same public endpoints as `bitcoin-data.html`: mempool.space, CoinGecko, Binance. Failures render dashes, not invented numbers.

DCA tool: `https://virtuse.com/bitcoin-dca-calculator/`
Retirement calculator: `https://virtuse.com/retirement-calculator.html`

## Page order

1. Live ticker
2. Nav (Satoshi lockup)
3. Hero = Satoshi Pulse
4. Subscribe band
5. Latest issues
6. Satoshi Blog
7. TRUSTED BY
8. Satoshi Analytics
9. About
10. Footer
