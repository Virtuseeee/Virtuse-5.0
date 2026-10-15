# virtuse.com code/tech audit (read-only), 2026-10-15

Checkout: `wt-audit` at `2c22de03` (main). 953 HTML files in the site folder (incl. 1 template under i18n-tools/ and 10 working files in blog-translations-ru/).
Method: a static parse of every HTML file (`audit/scan.py` → `scan.json`, `links.py`). Runtime checks ran in headless Chrome over CDP (`audit/rt.mjs` + `pagecheck.js`): 114 page loads covering 30 EN page types on desktop and mobile, 10 page types in de (desktop) and sk (mobile), 4 other languages, 15 seo-build, story, news and blog URLs, a keyboard Tab test and a CLS-source trace. The pages were served locally with `python3 -m http.server 8931`. Requests to virtuse.com, blog.virtuse.com and GTM were blocked in Chrome, so their failures are excluded from the results. Production was hit with 8 HEAD requests (1/s).

Scripts and raw results are in `audit/`: rt_all.json, scan.json, links.json and skstory.png.

## Snapshot: which template each page uses

| Family | Pages | What it is |
|---|---|---|
| **v2** (`site-v2.css` + `site-v2.js`, mega-nav, 5-col footer) | 154 | buy-bitcoin, secure, lending, mining, treasury, tax, bots, about, bitcoin-data, retirement-calculator, concierge, stacking, loan, tax-agent (×10 languages) + the 14 Fee Index pages |
| **v2 look, inline CSS** (same nav/footer, own `<style>` 54 KB / 41 KB) | 20 | index.html ×10, cfo.html ×10 |
| **Old template** (`styles.css` + ~20 KB inline `<style>`, numbered 11-item nav "01 Buy Bitcoin…", old footer, anime.js from jsdelivr) | **114** | ma-200w, rainbow-chart, root-cycles, btc-dominance, asset-returns, btc-monthly-returns (×10); fear-greed, trading-volume (×7); faq, privacy-policy, terms-and-conditions, aml-compliance (×10) |
| **seo-build** (own 4–5 KB inline CSS, 4-link nav "Tax guides / Fee Index / DCA / Partner Finder", 2-link footer, no web font) | 204 | bitcoin-tax/* + 9 translations, buy-bitcoin/<country>/ (13), DCA, sell-vs-borrow, inheritance, DAC8 (all languages) |
| **Brief/desk** (`news/news.css`, `article.css`, brief-chrome.js, Plex Mono + Inter + Source Serif) | 437 | stories/ (424 incl. sk/ru), news.html, article.html, 9 blog listings |
| **404** (own inline CSS, its own nav, Inter static 400–900) | 10 | */404.html |

So 4 nav systems and 5 footers are live. The 114 old-template pages and 204 seo-build pages (318 indexable pages) are the main gap in design alignment.

---

## P0

### P0-1 Story images blocked by CSP: 447 `<img>` on 102 story pages never load
- **Where:** `stories/*/index.html`, `sk/stories/*`, `ru/stories/*`. The 102 pages are mostly sk.
- **Evidence:** the story CSP is `img-src 'self' data: https://blog.virtuse.com https://www.googletagmanager.com …`. 447 inline images point to other hosts: media.giphy.com 68+, cloudfront `d15k2d11r6t6rl` 16, satosi.sk 12, miro.medium.com 6, plus googleusercontent, cointelegraph, substackcdn, okrypte.sk, tradingview and others. In the runtime check on `sk/stories/10-moralnych-dovodov-preco-vlastnit-bitcoin/`, CDP reported `loadingFailed blockedReason=csp` for three giphy GIFs. The same blocking happens on production, because the CSP is a meta tag in the page.
- **Fix:** in `stories-build/build.mjs`, choose one of two options:
  - (a) Download third-party images into `stories/img/` at build time. This is the robust option, since hotlinks to giphy and medium also rot.
  - (b) Add the hosts to `img-src` per page from the images actually present.

  Also add a build check that fails when an `<img>` host is not covered by the page CSP.
- **Effort:** M for (a), S for (b).

### P0-2 Translated story pages ship English page chrome in the HTML
- **Where:** 228 `sk/stories/*` and `ru/stories/*` pages (`<html lang="sk|ru">`).
- **Evidence:** the static HTML contains "Skip to content", "Latest issues", "Virtuse hub", "Get the Brief" (×3), the theme button "Dark" and `aria-label="Switch to dark theme"`. At runtime article.js localizes most of it ("ZDIEĽAŤ", "ČLÁNKY"). The theme toggle still renders "LIGHT" in English on the sk mobile screenshot (`audit/skstory.png`). Crawlers, link previews and no-JS visitors see the English strings. The same chrome strings ("Skip to content", "Dark", "Switch to dark theme") are hard-coded in the 8 translated `*/blog.html` files and in `blog-sk.html`.
- **Fix:** render the localized chrome at build time in `stories-build/build.mjs` and `i18n-tools/build_brief_blog.py` (the strings already exist in article.js), and translate the theme toggle label.
- **Effort:** S–M.

---

## P1

### P1-1 Port the 114 old-template pages to v2 (dashboards, FAQ, legal)
- **What is inconsistent:**
  - Nav is the old numbered list ("01 Buy Bitcoin … 11 About"). It has no Fee Index, CFO, Partner Finder or tools, and its language panel lists EN/SK/UA/CS… pills instead of the v2 dropdown.
  - Footer is the old `footer-main` (21 links vs 37 on v2).
  - Each page carries its own ~20–23 KB inline `<style>`: 114 pages, about 2.4 MB of inline CSS in total. Across the 12 EN templates, 112 rules (13 KB) are byte-identical and could live in one stylesheet.
  - `styles.css` (6 KB) is now loaded only by these pages.
- **No generator:** these pages have no builder in i18n-tools/. They were scaffolded by the legacy `scaffold_*.py` / `port_*_parity.py` scripts, so every edit is a manual 10-language edit.
- **Suggested fix:** one `build_dashboard.py` on `v2common.py` that keeps each chart's JS body and swaps the head, nav, footer and Brief. Then `build_legal.py` for faq/privacy/terms/aml. After that, `styles.css`, anime.js and the subnav CSS go away.
- **Effort:** L (12 templates × 10 languages), M per template once the builder exists.

### P1-2 seo-build pages (204 indexable) use a separate mini-template
- **Evidence:**
  - Nav has 4 links and the footer has 2 (`bitcoin-tax/index.html`), so there is no path to the services from these landing pages apart from in-body links.
  - CSS says `font-family: Inter` but Inter is never loaded (1 request per page, 0 font requests), so the text renders in the system font, unlike the rest of the site.
  - No `cookie-consent.js` or analytics, which is consistent, but also no Brief card in the v2 style.
  - 64 of these pages have no `og:image`: buy-bitcoin/<country> 13, bitcoin-tax 13, plus DCA, sell-vs-borrow and inheritance pages in several languages.
  - Fee Index already moved to v2 through `i18n-tools/fee-index`, so two generators now share one URL family.
- **Fix:** make `seo-build/lib/html.mjs` emit the v2 head, nav and footer (reuse the output of `v2common.py` or the shared partials) and add `site-v2.css`. Add a default `og:image` per page type.
- **Effort:** M.

### P1-3 Render-blocking / sync scripts and unused JS loaded sitewide
- `lang-detect.js` (7 KB) is a synchronous `<script>` in `<head>` on **214 pages**: the old family plus most v2 category pages (buy-bitcoin, lending, mining, secure, tax, bots, bitcoin-data, …) and blog listings. Homepages and stories already use `defer`. Its `TRANSLATED` list also lacks cfo, concierge, stacking, loan and tax-agent, so the auto-redirect is inconsistent across v2 pages. **Fix:** `defer` everywhere and update the list. **Effort:** S.
- `anime.umd.min.js` 4.5.0 comes from cdn.jsdelivr.net (41 KB) on all 114 old pages. It is parser-blocking at the end of the body, is a third-party dependency, and its host is whitelisted in CSP only for this script. It only does stat counters and scroll reveals. **Fix:** drop it with the P1-1 port, or replace it with CSS/IntersectionObserver. **Effort:** S.
- `consultation-widget.js` (72 KB raw / 21 KB gz, unminified) is loaded on 164 pages. **104 of them have no `[data-consultation-trigger]`**: the 10× about, bots, bitcoin-data, concierge, loan, stacking, tax-agent, retirement and tax pages, and the Fee Index pages. **Fix:** load it only where a trigger exists, or lazy-load it on the first click. **Effort:** S.
- `concierge-launcher.js` is on 272 pages, including the old legal pages. This is fine, but there is no version query (see P2-6).

### P1-4 Page weight on v2 and tool pages
- Every v2 page is about 765–800 KB and 16–22 requests.
  - `site-v2.css` is 117 KB raw / 23 KB gz, unminified, render-blocking.
  - Inter variable fonts take 2 files, 131 KB + 71 KB = 202 KB, and the opsz axis is unused.
  - `news/og/brief-20261012.jpg` (**208 KB**, the 1200×630 OG image reused as the Brief card cover) loads on every v2 page.
- Brief family pages load 3 font families, 250–390 KB of fonts. Measured on `blog.html` mobile: Source Serif 119 KB + 98 KB, Inter 83 KB + 47 KB.
- Tool pages:
  - `stacking.html` is 1.5 MB. `main-stacking-*.js` is 412 KB (117 KB gz) plus `utils-*.js` 228 KB, and Tailwind `utils-*.css` (90 KB) is loaded on top of site-v2.css.
  - `concierge.html` is 1.2 MB / 42 requests.
  - `loan.html` and `tax-agent.html` are 1.1 MB each.
- **Fix:**
  - Minify site-v2.css and the JS files.
  - Make a 400–600 px webp of the Brief cover and use it in the card.
  - Subset the fonts (latin / latin-ext; the variable wght axis only) or self-host them.
  - Code-split the chart library in Stacking (lazy-import the chart below the inputs).
  - Drop unused Tailwind via content purge across shells.
- **Effort:** S for the image and minify, M for fonts and code-splitting.

### P1-5 Accessibility gaps (measured)
- **Contrast** (computed fg/bg):
  - `--text-dim` #484f58 on #08090a / #141414 = **2.2–2.4:1**. On the old template it appears on `.nav-link-num`, `.status-price-label`, `.status-note`, `.chart-note`, `.sec-label` and `.credit-text-label`: 10–15 failing elements per dashboard and legal page on mobile.
  - Brief light theme: orange #f7931a on #fbfbfa = 2.22:1 (`.pulse-tag`, `.read`, `.text-link`, `.btn` on news.html, 16–17 elements).
  - White on orange buttons = 2.30:1 (`.btn` on blog listings and story pages).
  - **Fix:** raise the dim token to about #7d8590, darken the orange text in the light theme (e.g. #b45309), and use dark text on orange buttons as v2 does (`--btn-text`).
  - **Effort:** S.
- **Missing form label:** the old-template newsletter email `<input type=email placeholder=…>` has no label or aria-label on all 114 pages. seo-build pages have 1 unlabeled input each. **Fix:** add `aria-label`. **Effort:** S.
- **No skip link** on v2, home, cfo, old, seo-build or 404 pages (only the Brief family has one). Keyboard Tab shows a visible focus ring on every family tested, so focus is OK. **Fix:** add a skip link to the shared v2 header. **Effort:** S.
- **Heading order:** h2→h4 jumps on index, v2 tool and Partner Finder pages; h1→h3 on dashboards. **183 story pages have 2–26 `<h1>`** because WordPress body headings are copied as h1. **Fix:** demote body h1→h2 in `stories-build`. **Effort:** S.
- **Images without alt:** 354 `<img>` in story bodies have no `alt` attribute. **Fix:** add `alt=""` or the caption in stories-build. **Effort:** S.
- **Small tap targets on mobile:**
  - v2 mobile mega-nav items are 147×18 px. They wrap full width, but 18 px tall is below the 24 px minimum.
  - Inline CTA links ("Browse all services", "Find partners…") are about 20 px tall.
  - Brief blog language links are 15×18 px.
  - seo-build nav links are 16 px tall, language links 17×16 px.
  - Stacking "Source" links are 37×14 px.
  - **Fix:** `min-height: 44px` / padding on the nav-group links and lang pills. **Effort:** S.

### P1-6 Layout shift (CLS > 0.1) on several pages, desktop 1440
- root-cycles **0.352**: the shift is in `SECTION.chart-section`, `.subnav-wrap`, `.credit-section` and `UL.nav-links` at 200 ms, which looks like a font or nav swap.
- btc-dominance 0.353 in one run and 0 in another, so it is flaky.
- btc-monthly-returns 0.204 (`SECTION.newsletter` at 78 ms).
- Story pages 0.267–0.276 (`FOOTER.site-footer`, as the body expands after JS).
- treasury 0.094 and article.html 0.08 are borderline.
- **Fix:** reserve heights for the chart and table containers. For stories, render the body statically (already the case) and avoid footer/script reflow; check the brief-chrome ticker insertion.
- **Effort:** S–M.

---

## P2

### P2-1 Internal links: no broken targets, but 262 links go through a 301
- Of 38,962 hrefs across 953 files, **0** point to a missing local file. All img, script and css refs also exist (0 missing).
- 292 static links still use `article.html?slug=…`, on 172 pages: 13 per blog listing, plus the Brief cards on index and the v2 pages. 262 of them have a matching `stories/<slug>/` page. The other 30 use `&lang=sk|ru` with an English slug and fall through to the EN story via `.htaccess`. All of them cost a 301 hop. JS swaps some of them after a HEAD request, which also accounts for the many aborted `HEAD /stories/everything-but-bitcoin/` requests seen in the network log.
- **Fix:** have the builders write `/stories/<slug>/` directly when the folder exists (build_brief_blog.py, home/build_lang.py, v2common Brief card).
- **Effort:** S.

### P2-2 Sitemap and orphans
- The sitemap has 916 URLs: 0 duplicates, 0 entries without a file, 0 noindex entries, and canonicals match.
- Hreflang: 0 missing targets, 0 non-reciprocal pairs, x-default present everywhere it is used.
- Indexable pages that are not in the sitemap or linked from anywhere:
  - the 10 `blog-translations-ru/*.html` files. These are WordPress paste notes ("=== ЗАГОЛОВОК (paste into the WordPress title field) ==="), sit in the deployable folder, and are 404 on production today. `deploy_site.sh` only excludes `i18n-tools/` and `*.md`, so any future edit would publish them.
  - `i18n-tools/brief_blog_template.html` (excluded by deploy).
- Other deployable-folder clutter: 4 .docx and 4 .pdf strategy files, research/*.md and chapter*.md. The docx/pdf are 404 on production today, but are not excluded by the deploy script.
- **Fix:** move these files out of the site folder, or add a deny-list (docx|pdf|blog-translations-ru) to `deploy_site.sh`.
- **Effort:** S.

### P2-3 Duplicate or near-duplicate content
- 3 pairs of story pages have identical titles and are both self-canonical and indexable:
  - `three-ways-how-media-downplays-inflation` and `…-ras-vasilisin`
  - `how-to-prepare-for-recession` and `how-to-prepare-for-a-recession`
  - `half-of-the-worlds-wealth-…` and `…-ras-vasilisin`
- Duplicate titles across languages:
  - sk and cs about pages: "O nás: nezávislý Bitcoin hub od roku 2018 | Virtuse"
  - sk and cs AML pages: "AML a Compliance | Virtuse"
  - pl, cs and fr blog listings: "Blog Virtuse · Virtuse Brief"
  - ru and uk blog listings: "Блог Virtuse · Virtuse Brief"
- **Fix:** canonicalize or 301 the 3 story duplicates; localize the cs titles.
- **Effort:** S.

### P2-4 Title and description lengths
- 286 story titles are over 60 characters, because " | Virtuse Brief" is appended to long WordPress titles. Tool pages are also long: stacking 8/10, loan 8/10, concierge 7/10, tax-agent 3/10.
- Descriptions over 160 characters: root-cycles 10, asset-returns 10, aml-compliance 8, btc-monthly-returns 5, rainbow-chart 4.
- Very short titles: "AGB | Virtuse", "CGU | Virtuse", "Regulamin | Virtuse", "Duhový graf | Virtuse".
- **Effort:** S.

### P2-5 Third-party data API resilience
- The Brief card chart, bitcoin-data, retirement-calculator, trading-volume, the blog ticker and news.html call `api.coingecko.com` directly from the browser.
- With 4 pages loading in parallel from one IP, CoinGecko answered without CORS headers (rate-limit responses). The result was console errors and empty widgets on 24 of 114 runs.
- Production visitors behind shared IPs, or anyone loading several tabs at once, can hit the same limit.
- **Fix:** proxy and cache through the existing Cloudflare Worker (the `/pulse.json` pattern), or commit daily JSON via the existing Actions as asset-returns already does.
- **Effort:** M.

### P2-6 Cache-busting is inconsistent
- `site-v2.css` is loaded as `?v=5` on 80 pages and `?v=6` on 74. `cookie-consent.js` (735 pages), `concierge-launcher.js` (272) and `news.css` (436) have no version at all.
- `.htaccess` sends `max-age=3600` for css/js, so a deploy can mix old CSS with new HTML for up to an hour.
- **Fix:** one version constant in `v2common.py`, applied to all shared assets, or content-hash filenames.
- **Effort:** S.

### P2-7 Maintainability of the generators
- 17 page builders exist. Only 8 use `i18n-tools/v2common.py`. build_buy, about, home/build_lang, cfo, partner-finder, loan, tax-agent, stacking and retirement each carry their own head/nav/footer copy.
- index/cfo duplicate the v2 CSS inline (54 KB and 41 KB per file × 20). site-v2.css is the same "homepage CSS verbatim".
- 70 top-level scripts remain in `i18n-tools/`, many obsolete (port_*_parity, scaffold_*, relink_*, *_translations.py from the pre-v2 design).
- **Risk:** a hand edit on a v2 page is silently overwritten by its builder.
- **Fix:** move the remaining builders to v2common, make index/cfo link site-v2.css, and archive the dead scripts.
- **Effort:** M.

### P2-8 Unreferenced files
- `img/team/ras-vasilisin.jpg`: 518 KB, 1264×1568. Only the `-400` variant is used.
- `news/`: brief-mark.png, brief-mark-dark.png, brief-nav-logo-on-light.png, featured-brief.svg, og-card.svg, pulse-icons.svg, desk-updating.svg (about 82 KB).
- There are no orphan concierge-assets hashes in the worktree. The local OneDrive checkout, however, has about 25 untracked old `concierge-assets/*` hashes that should not be deployed.
- **Effort:** S.

### P2-9 Hotlinked story media
- 1,554 story images are served from blog.virtuse.com (WordPress). Some are full-size (1280–1408 px WhatsApp JPEGs) with srcset.
- 299 come from giphy.
- The stories now depend on WordPress staying online.
- **Fix:** copy the images at build time; see P0-1.
- **Effort:** M.

---

## Clean, nothing to fix
- No horizontal overflow at 390 px or 1440 px on any of the 114 runs.
- No JS exceptions on any page except the CORS / rate-limit fetch failures described in P2-5.
- No 4xx on local assets.
- Every page has a canonical, a meta description and `lang` matching its folder. The one exception is `blog-sk.html`, which is `sk` at the root, as intended.
- Focus rings are visible with the keyboard on every family tested.
