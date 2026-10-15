# Virtuse.com design and UX/UI audit (read-only)

Date: 2026-10-15. Source: local copy `scratchpad/wt-audit/Kimi_Agent_Virtuse%20MiCA%20Partners`, served on localhost:8931, headless Chrome at 1440 desktop and 390 mobile (DPR 2). EN in full, SK and DE spot checks. No files in the repo were changed.

Paths below are relative to `scratchpad/audit/`. `shots/` holds full-page captures (`d_` = desktop, `m_` = mobile, `fail_` = third-party APIs blocked, `first_`-screens are in `probe/`). `v/` holds downscaled grids made for review.

## The short version

The 14 "v2" pages (buy-bitcoin, secure, lending, mining, treasury, tax, bots, the 4 tools, retirement, fee index, bitcoin-data, about) plus the homepage and CFO page read as one polished system. The homepage hero is clear and the published-fee comparisons are the site's best asset. The weaknesses are mostly outside that core:

1. **Six template families are still live.** They are v2, homepage/CFO (inline CSS, v2 look), the old `styles.css` template (12 pages per language: all the dashboards, FAQ and legal pages, about 115 pages in total), the Brief chrome (news, stories, blog, story pages), the seo-build guides (`/bitcoin-tax/…` and similar) and the 404 page. A visitor moving from Bitcoin Data into any chart, or from Google into a tax guide, lands in a visibly different site.
2. **Live data can fail silently and look wrong.** The 200-week MA page shows "Bitcoin today $2,875, 4.45× Heated" when Binance is unreachable, and Binance blocks some regions.
3. **The trust message conflicts between pages.** Buy Bitcoin calls 21bitcoin the "Lowest fee". The Fee Index ranks ByBit EU first and lists 21bitcoin's spread as "Being measured".
4. **The Brief and CFO funnels are not linked across templates.** The Brief pages never link CFO. The old template has a different Brief form ("Subscribe", white button). Stories are missing from the main nav.

---

## P0: fix first (wrong information shown, or real loss of trust)

### P0-1. The 200-week MA page shows 2017 data as "today" when Binance fails
- **Pages:** `ma-200w.html` (and its 9 translations).
- **What's wrong:** With `api.binance.com` blocked, the page renders only the built-in 2011–2017 seed series. It then labels the last seed point "BITCOIN TODAY $2,875 · 200 WMA $646.61 · 4.45× Heated, Well Above the Floor", and the chart ends in 2017. Binance's public API is geo-blocked in some places (for example HTTP 451 for US IPs) and can rate-limit, so real visitors can see this.
- **Why it matters:** A false "today" price and a market-zone verdict on a site whose pitch is "published facts" hurts trust directly. It may also read as a signal.
- **Fix:** If the live fetch fails, show "Live data unavailable" with a Retry button, as `bitcoin-data.html` already does. Never treat the seed as current. Better still, read a daily JSON snapshot from the repo (the same pattern as `data/asset-returns.json`) and use Binance only for the last candle. Add mempool or CoinGecko as a price fallback.
- **Effort:** S (guard) / M (snapshot).
- **Screenshots:** `shots/fail_d_ma-200w.png` (grid `v/g_h.png`, right panel). Compare with `shots/d_ma-200w.png`.

### P0-2. Buy Bitcoin and the Fee Index disagree on the cheapest route
- **Pages:** `buy-bitcoin.html`, homepage "Buy Bitcoin from 0% fees" panel, `bitcoin-fee-index/`.
- **What's wrong:** Buy Bitcoin and the homepage put 21bitcoin first with a green "Lowest fee" badge at 0%. The Fee Index puts ByBit EU first with a "Lowest total cost" badge, and shows 21bitcoin's spread and total as "Being measured" with no rank. Two pages one click apart give different answers to "what is cheapest".
- **Why it matters:** This is the core value proposition ("published prices, side by side"), and the Fee Index is meant to be the citable source. Visitors and journalists will notice.
- **Fix:** Use one shared label. Either Buy Bitcoin says "Lowest listed fee" with a footnote ("total cost incl. spread: see Fee Index"), or the Fee Index shows 21bitcoin in the ranking with "listed fee 0%, spread pending". Keep both badges worded as "listed fee" vs "total cost".
- **Effort:** S.
- **Screenshots:** `shots/d_buy-bitcoin.png` (top), `shots/d_bitcoin-fee-index.png` (grid `v/g_b.png`, left).

---

## P1: important (consistency, funnel, trust)

### P1-1. Every dashboard, the FAQ and the legal pages still use the old template (in all 10 languages)
- **Pages:** `fear-greed`, `ma-200w`, `rainbow-chart`, `root-cycles`, `btc-dominance`, `trading-volume`, `asset-returns`, `btc-monthly-returns`, `faq`, `privacy-policy`, `terms-and-conditions`, `aml-compliance`. That is 12 per language, about 115 pages.
- **What's wrong:**
  - The nav is a flat list of 11 items with "Get Started", not Services/Learn/Tools with "Find partners".
  - Active states and the sub-nav pills are orange.
  - The Brief form says "Get the Brief / Subscribe" with a white bar button, unlike the v2 card with the issue preview.
  - The footer has no language row, no disclaimer and no CFO entry.
  - Notes use `#484f58` text at about 2.2:1 contrast (fails WCAG AA, e.g. "INDEX TODAY", "The five zones").
  - FAQ has orange-bordered accordions.
  - Bitcoin Data (v2) links straight into these pages, so the switch happens within one click.
- **Why it matters:** The charts are evergreen SEO and Brief-signup pages. The jump between designs makes the site feel stitched together, and the CFO and Partner Finder entry points are missing there.
- **Fix:** Port the shell (nav, footer, Brief block, cookie banner) to `site-v2.css` and keep each page's chart body. Replace the orange sub-nav with the v2 neutral chip row. Raise `--text-dim` to the v2 muted colour. Priority order: FAQ, fear-greed, ma-200w, rainbow, then the rest. Legal pages last.
- **Effort:** M (shell port, scripted across languages like earlier rollouts).
- **Screenshots:** `shots/d_fear-greed.png`, `shots/d_ma-200w.png`, `shots/d_faq.png` (grids `v/g_e.png` left, `v/g_d.png` right), mobile `probe/first_fear-greed.png`.

### P1-2. The seo-build guides (organic landing pages) look like a different, unbranded site
- **Pages:** `bitcoin-tax/<country>/`, and by the same generator `buy-bitcoin/<country>/`, `bitcoin-dca-calculator/`, `sell-vs-borrow-bitcoin/`, `bitcoin-inheritance/`, `de/bitcoin-steuern/…` and the translations.
- **What's wrong:** The top bar is a plain "Virtuse" text plus a row of 16px links ("Tax guides Fee Index DCA Partner Finder"). There is no logo, no Services/Tools menu and no Find partners CTA. A bare language code row sits under it. The footer is one line. Mobile tap targets are 16 to 20px tall (the probe counted 25 small targets). The content quality is good: sources, check dates and a DAC8 note.
- **Why it matters:** These are the pages Google sends people to. The first impression is a stripped-down page with weak paths into partners, tools or the Brief, which hurts affiliate and signup conversion from organic traffic.
- **Fix:** Have `seo-build/lib/html.mjs` emit the v2 header and footer (same markup and `site-v2.css`). Keep the article body as it is. Show the source table as stacked rows on mobile.
- **Effort:** M.
- **Screenshots:** `shots/d_bitcoin-tax_slovakia.png` (grid `v/g_e.png` middle), `shots/m_bitcoin-tax_slovakia.png`, `probe/first_bitcoin-tax_slovakia_.png`.

### P1-3. Brief pages (news, stories, blog) are cut off from the hub and its funnels
- **Pages:** `news.html`, `stories/`, `blog.html`, story pages.
- **What's wrong:**
  - The Brief chrome has its own nav (Pulse, Latest issues, Blog, Data, Virtuse Hub). Services and tools are reachable only through "Virtuse Hub" and the footer.
  - None of these pages link Virtuse CFO, even though the launch is on 1 Nov.
  - The theme default differs: `news.html` is light, while stories and blog are dark.
  - The news header still shows the old slogan "FIX THE MONEY, FIX THE WORLD".
  - "LATEST BRIEF · MON, OCT 12" appears twice in a row on mobile.
  - The house ad ("Get 30% off your first loan fee") is the only partner CTA.
  - Story pages handle this better: a sticky "Borrow against Bitcoin / Compare loan partners" card and related tools.
- **Why it matters:** The Brief is the main repeat-traffic and email channel. Without a CFO or tools entry it doesn't feed the other two goals.
- **Fix:**
  - Add a slim "Virtuse: Services · Tools · CFO" strip or a menu item to the Brief nav.
  - Add a CFO waitlist card in the news sidebar and at the end of each story.
  - Use one default theme for all Brief pages.
  - Drop the duplicate date line and the old slogan.
- **Effort:** S–M.
- **Screenshots:** `shots/d_news.png` (light), `shots/d_stories.png`, `shots/d_story.png` (grid `v/g_f.png`), `shots/m_news.png`.

### P1-4. Rainbow chart and Fear & Greed have no error state when their API fails
- **Pages:** `rainbow-chart.html`, `fear-greed.html` (and the translations). `root-cycles` shows an embedded third-party chart.
- **What's wrong:** With the APIs blocked, Rainbow shows "BITCOIN TODAY ▬ Loading…" forever over a price line that stops years ago. Fear & Greed shows "Unavailable" and an empty 12-month chart frame with no retry. `bitcoin-data.html` already handles this well ("Data unavailable", source, Retry), and Loan does too ("Live price unavailable. Default €74,000, as of 12 Oct").
- **Why it matters:** Users see a broken-looking tool and leave, or they read a partial chart as current.
- **Fix:** Reuse the bitcoin-data pattern: a red dot, "Data unavailable", Retry, and hide or grey out the chart with a single line of text. Also add a snapshot fallback, as in P0-1.
- **Effort:** S.
- **Screenshots:** `shots/fail_d_rainbow-chart.png` (grid `v/g_k.png`), `shots/fail_d_fear-greed.png`, and good examples in `shots/fail_d_bitcoin-data.png` and `shots/fail_m_loan.png`.

### P1-5. Two cookie banners. The tall one covers about 40% of the first mobile screen, on the homepage too
- **Pages:** The large stacked banner (326px tall, three full-width buttons) appears on the homepage, CFO, news, stories, blog, FAQ, dashboards and 404. The v2 pages get the compact one (165px, buttons in one row), because the compact rules live in `site-v2.css` and the homepage and CFO don't load it.
- **What's wrong:** On the homepage at 390px, the banner covers everything below "Prefer to talk? Book a free call". That includes the partner rail and the start of "What we promise". The first impression on the most important page is the worse of the two banners.
- **Fix:** Move the compact mobile rules into `cookie-consent.js` itself, the injected CSS that every page already gets. Then it is identical everywhere, whatever stylesheet a page uses.
- **Effort:** S.
- **Screenshots:** `probe/first_index.png` vs `probe/first_buy-bitcoin.png` (grid `probe/grid1.png`, panels 1–2).

### P1-6. The IA leaves some content unreachable from the main menu
- **What's wrong (main nav, v2):**
  - Learn contains Brief, Blog, Bitcoin Data and Fee Index. Stories, FAQ, the country tax guides hub and the inheritance checklist are missing.
  - Tools contains CFO (Soon), Partner Finder, Stacking, Loan, Tax Agent and Retirement. The Fee Index (a tool) sits under Learn, and the DCA calculator and Sell-vs-borrow are reachable only from the footer.
  - The dropdown items have no one-line descriptions, so "Loan & Liquidity Copilot" doesn't say what it does.
  - No visible breadcrumbs on v2 pages (only seo-build pages have them).
  - No skip link on v2 pages.
- **Why it matters:** The tools and guides are the main SEO and engagement assets. People find them only if they scroll to the footer.
- **Fix:**
  - Learn: Brief, Stories, Blog, Bitcoin Data, Country tax guides, FAQ.
  - Tools: Partner Finder, Fee Index, Stacking/DCA, Loan, Tax & Inheritance, Retirement, CFO (Soon).
  - Add a 1-line description under each item on desktop, plus visible breadcrumbs on deep pages.
- **Effort:** S–M.
- **Screenshots:** `v/g_menu.png` (mobile menu, desktop Tools and Learn), `shots/menu_d_tools.png`, `shots/menu_d_learn.png`, `shots/menu_m_open.png`.

### P1-7. A third-party widget breaks the visual language and the language on Loans
- **Pages:** `lending.html`, `de/lending.html` (all languages).
- **What's wrong:**
  - The embedded Firefish calculator shows a large empty "EUR 0" state, a red 12m chip and a red full-width "Show options" button.
  - Red appears nowhere else on the site, and here it becomes the most prominent CTA on the page, inside our own card.
  - On DE it shows English text ("Borrow EUR", "Loan period (months)", "Show options").
  - Our own CTA "Get your loan at Firefish" sits below it as an outline button.
- **Fix:**
  - Pass the widget's language and theme parameters if Firefish supports them.
  - Otherwise make our own neutral card (rate, LTV, duration) the primary content with a solid CTA, and move the widget to a lower "Live quote" section.
  - Start the widget with a non-zero amount if possible.
- **Effort:** S–M.
- **Screenshots:** `shots/d_lending.png` (grid `v/g_a.png`, left), `shots/m_de_lending.png` (grid `v/g_g.png`, right).

---

## P2: polish

| # | Page(s) | Issue | Fix | Effort | Screenshot |
|---|---|---|---|---|---|
| P2-1 | Hub/tool H1s | Accent styles vary. Services use a grey second line ("Published fees, side by side."). Tools and about use an orange second line. The homepage uses an orange "compared." Retirement has an orange H2 under a white H1. | Pick one rule: grey dek for all H1s and orange only for a single key word, or make orange the tool-page signature on purpose. Document it in site-v2.css. | S | `v/g_a.png`, `v/g_b.png` |
| P2-2 | Homepage mobile | The cube fills about one full screen after the hero, and the three tall "promise" cards push the first real offer (Buy from 0% fees) about 3 screens down. On mobile "See all 5 buy partners" sits above the table it refers to. | Shrink or hide the cube below 600px. Show the promises as a 3-row compact list on mobile. Move the button under the fee table. | S | `v/m_index_0.png`, `v/m_index_1.png` |
| P2-3 | Retirement calculator (mobile), also Loan | The result ("On track to retire at 50") appears only after about 13 inputs (around 3,000px down), so moving a slider shows no feedback. | Add a sticky mini result bar at the bottom on mobile, or put the summary card above the inputs. | M | `v/g_m.png` (4th) |
| P2-4 | Partner Finder (desktop) | The chat card is fixed-height with about 250px of empty space under the first message, so it looks unfinished. | Let it auto-size until the conversation grows. Show the 7 goal chips larger, as the primary affordance. | S | `shots/d_concierge.png` |
| P2-5 | Brief signup buttons | The same block has a filled white "Get the Brief" on the homepage but an outlined button on the v2 pages, "Subscribe" (white bar) on the old template, "SUBSCRIBE" (orange) on Brief pages, and "Tell me 1 Nov" for CFO. | One primary style for the Brief button (filled), with the same label on all pages. | S | `v/d_index_2.png` vs `v/d_buy-bitcoin_1.png` vs `v/g_d.png` right |
| P2-6 | 404 | Old navy palette (`#0d1421`), an orange pill CTA, no nav or search, and no links to tools or partners. | v2 shell, plus a "Popular: Buy Bitcoin · Partner Finder · Fee Index · Brief" link row. | S | `shots/d_404.png` |
| P2-7 | Imagery | The same AI "Brief scooter" image is repeated on every v2 page. The Brief and blog use AI illustrations with mixed styles, and the "Virtuse Morning" placeholder cover appears twice in a row in the stories hub. With WP images blocked, cards show broken-image icons with alt text. | Rotate the latest issue's own cover. Add a branded fallback cover per desk. Add `onerror` to swap in a neutral placeholder. | S–M | `shots/d_stories.png`, `shots/fail_d_stories.png`, `shots/fail_m_blog.png` |
| P2-8 | Mobile tap targets (v2 header) | "Find partners" is 28px tall, the language button 34×31, the theme toggles on Brief pages 26px. Below the 44px guideline. | Make the header controls at least 40–44px tall. Keep the visual size and add padding. | S | `probe/out.json`, `probe/first_buy-bitcoin.png` |
| P2-9 | Partner Finder bubble | Shown on mobile only on the old template, blog and 404. It is hidden (`display:none`) on the v2 pages. Behaviour is inconsistent. On old pages it sits under the cookie banner. | Decide once: hide it on mobile everywhere, or show it everywhere after the hero. | S | `probe/first_fear-greed.png`, `probe/first_blog.png` |
| P2-10 | Fear & Greed mobile | The month labels on the X axis overlap ("NovDecJanFeb…"), and the sub-nav chips are clipped at the edge without a fade cue. | Show every 2nd or 3rd label below 500px. Add an edge fade to the scrolling chip row. | S | `v/g_m.png` (1st) |
| P2-11 | Footer | Old-template footers lack the language row, the disclaimer and the CFO link. The v2 footer uses an em dash ("Virtuse Brief — the weekly desk"), against the house no-em-dash rule. | Fixed by P1-1. Change the dash to a colon. | S | `v/d_index_3.png` |
| P2-12 | Data formatting | Hashrate reads "1.03K EH/s" in the Brief ticker and "1,025 EH/s" on Bitcoin Data. Price is in USD on the dashboards and EUR on the tools. | Share one formatter and show the currency label on cards. | S | `v/g_f.png`, `v/d_bitcoin-data_0.png` |
| P2-13 | FAQ content vs About | FAQ: "Virtuse Group Pte. Ltd. is anchored in Singapore … serving clients in over 100 countries". About: "operated by Virtuse Wealth Management, a.s.", 22 partners. The entity and scope differ. | Align the entity wording (legal check). | S | `shots/d_faq.png` |
| P2-14 | Homepage disclosure | "What we earn:" is in very small grey text under the shelf grid. Elsewhere it is a readable paragraph. | Same 14px muted paragraph style as on Buy Bitcoin. | S | `v/d_index_1.png` (bottom) |

---

## What already works well (keep)

- **Homepage hero:** the claim is clear and specific ("Every Bitcoin service, compared. Published prices, side by side."), with one primary and one secondary CTA plus a low-key call link.
- **Partner comparison cards on the v2 category pages:** the fee table first, then detail cards. Licence, country and regulator are in mono caps, and the referral disclosure sits next to the CTAs (buy-bitcoin, secure, treasury, mining, bots, tax).
- **Bitcoin Data's error handling** ("Data unavailable" + sources + Retry) and **Loan's price fallback** with a date. Use these as the pattern everywhere.
- **Tax guides and the Tax Agent:** every rule carries a source link and a "checked" date. That is a strong trust signal; give it more visual weight (e.g. a small "Sources checked 13 Oct 2026" badge near the H1).
- **SK and DE:** translations look complete in the v2 chrome, including form feedback strings. No horizontal overflow on any page at 390px.

## Top 10 quick wins

1. Guard the 200-WMA page so it never labels seed data "today". Show "Data unavailable / Retry" (P0-1, S).
2. Reword the "Lowest fee" and "Lowest total cost" badges so Buy Bitcoin and the Fee Index don't contradict each other (P0-2, S).
3. Move the compact mobile cookie-banner CSS into `cookie-consent.js` so the homepage gets the 165px version (P1-5, S).
4. Add an error state with Retry to Rainbow and Fear & Greed (P1-4, S).
5. Add a CFO waitlist card to news.html and to the end of story pages. Add Stories and FAQ to the Learn menu (P1-3, P1-6, S).
6. Move the Fee Index into Tools, and add the DCA calculator and Sell-vs-borrow there (P1-6, S).
7. Use the same "Get the Brief" button style (filled) and label everywhere (P2-5, S).
8. Raise the old template's `--text-dim` (#484f58, 2.2:1) to the v2 muted grey: one variable change for about 115 pages (P1-1 partial, S).
9. Replace 404 with the v2 shell and four popular links (P2-6, S).
10. Shrink the homepage cube on mobile and put "See all 5 buy partners" under the fee table (P2-2, S).

## Method notes

- The capture helpers are in `scratchpad/audit/` (`simple.mjs`, `fail.mjs` with `Network.setBlockedURLs` for CoinGecko, mempool, Binance, alternative.me, raw.githubusercontent, blog.virtuse.com and others, `probe.mjs` for mobile metrics, `menu.mjs` for open menus).
- The cookie banner was rejected before the full-page shots. The `probe/first_*` shots keep it, to show the first screen as a new visitor sees it.
- The `cdpfull.mjs` run hung on the tall Brief pages, so `d_news.png` and `d_stories.png` were captured with `simple.mjs`. `d_index2.png` is a second homepage capture.
- The contrast scan covered text nodes on buy-bitcoin, index, fear-greed and concierge. Only the old template failed AA.
