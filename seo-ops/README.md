# seo-ops

Prepared material for the plan "Rollout plan: SEO, staré URL a rast nových stránok"
(Claude Docs, https://claude.ai/artifact/JXmCAC3b34NEPTCQrumWrA). The scripts
here are read-only against the live sites; WordPress, Search Console and server
changes are made by Ras (or whoever has the login), including the one WordPress
plugin in `wp-mu-plugin/` (step 3).

## Step 1: old Virtuse Exchange pages on blog.virtuse.com

Why: virtuse.com sends every unknown path to the same path on blog.virtuse.com
(301), and the old exchange pages still exist there with `index, follow`
(www.virtuse.com/gold/ → virtuse.com/gold/ → blog.virtuse.com/gold/ → 200). They
never fade, and they contradict "we are not an exchange / Bitcoin only, no tokens".

- `../partnerships/legacy-wp-redirects.csv`: every WordPress page (50 EN + 56 SK,
  105 unique URLs, 2026-10-07), each opened live (code, robots, forms, text) and
  given an action: `301` + target, `410`, or `keep`, with the reason. `status` is
  `ready` or `ras` (Ras decides first). Edit this file, never the generated ones.
- `legacy_redirects.py build` turns it into
  `../partnerships/legacy-wp-redirection-import.csv` (+ `-ras.csv`) for the
  Redirection plugin (already installed on the blog) and
  `../partnerships/legacy-wp-htaccess.txt` for .htaccess. Use one of the two.
- `legacy_redirects.py check` checks every row from www.virtuse.com,
  virtuse.com and blog.virtuse.com. Run it after the rules are live; before that,
  every 301/410 row fails (baseline).

**Order for Ras:**
1. Back up WordPress (hosting backup or a backup plugin) and export pages/posts
   (Tools → Export). `wp-posts-inventory.csv` here is a read-only list, not a backup.
2. Decide the 16 `ras` rows (contact form, loan request pages, affiliate/referral,
   glossary) and set them to `ready` (or change the action) in the CSV; run `build`.
3. Redirection → Import → `legacy-wp-redirection-import.csv`. Import two rows first
   (one 301, one 410) and check they show as "Redirect to URL" and "Error (410)";
   Redirection → Options: case-insensitive, ignore trailing slash, ignore query
   parameters. Or paste `legacy-wp-htaccess.txt` above `# BEGIN WordPress`.
4. Purge the LiteSpeed cache (the blog runs LiteSpeed Cache), then
   `python3 seo-ops/legacy_redirects.py check --status ready`.
5. 410 pages: switch them to Draft in WordPress, delete only after a month without
   problems. Search Console: URL inspection → request indexing for a few of them.

**virtuse.com .htaccess (live since 2026-10-07):** `virtuse.com.htaccess` is the server's
public_html/.htaccess with the block inserted by `legacy_redirects.py merge-virtuse`
(`virtuse.com.htaccess.before` = the original, for rollback). It is not deployed by
deploy_site.sh: after changing rules, download the live file, run merge-virtuse on it, test,
upload by hand. Test locally first (`httpd -t` + a throwaway Apache on a high port).

**Hops (before the virtuse.com block):** with rules only on the blog, a 301 row from www.virtuse.com is 3 hops
(www → virtuse.com → blog → target); the plan wants at most 2. To get 2, the same
`.htaccess` block also goes on virtuse.com, above its catch-all rule to the blog.
That file is on the server only (public_html/.htaccess, not in this repo): download
it first (`sftp> get public_html/.htaccess`) and send it over, then the exact merged
file can be prepared. 410 rows are 2 hops either way.

**Live since 2026-10-07:** 91 rules in the Redirection group "Legacy Exchange 2026-10"
(id 3; disable the group to roll back), identical to the CSV's ready rows. `check
--status ready`: every 410 and every 301 target correct; the 34 301 rows are 3 hops from
www (needs the virtuse.com .htaccess block); `/login/` + `/sk/login/` end as WordPress's
own 302 to wp-login.php (noindex), accepted. Contact pages kept (only contact channel for
former exchange clients, messages to office@virtuse.com). The 8 affiliate/referral pages
(they still offered "$10 of bitcoin" with a Register link to the dead virtuse.exchange)
went to 410 on Ras's decision the same evening: group now 99 rules, the same 8 lines are
live in virtuse.com's .htaccess, `check --status ready` 103/105 (only the two login rows
above). Not done yet: switching the 410 pages to Draft, Search Console requests.
Nine older rules in the "Redirections" group (e.g. /sk/registration/ → /sk/registracia/)
now end in a 410 after one extra hop; fine, can be pointed straight at 410 later.

**Backlink check 2026-10-08 (Bing Webmaster Tools → Backlinks For Your Site, 262 pages
from 54 domains):** only `/gold/` (5 links: trend.sk ×2, hackernoon.com, moneyahoy.com,
myfrugalbusiness.com) and `/commodities/` (3 links, moneyminiblog.com) of the 65 410 pages
had outside links. Both changed to 301 → asset-returns.html (Bitcoin vs Gold / Commodities
by year) on Ras's decision: Redirection rules 80 + 70 and the two virtuse.com .htaccess lines.
The other 63 stay 410. Everything else outside sites link to (homepage, /sk/, blog-sk.html,
/fees/, /about-us/, /privacy-policy/, old posts) already ends in a 200. Group now 36 × 301, 63 × 410.

**Changed against the plan's appendix (checked on the live pages):**
`/dashboard/` is a live Bitcoin dashboard (2026-05), not the old app → 301 to
bitcoin-data.html; `/home/` and `/sk/bitcoin-vo-vasom-vrecku/` are the blog's own
front pages → keep; `/e-shop/` sold hardware wallets → 301 to secure.html;
`/request-a-loan/` and `/pozicky/` are live Firefish loan forms linked from the
blog front page → 301 to lending.html (same Firefish widget), Ras confirms.

## Step 2: measuring only the new pages

- `search_console_groups.py`: one RE2 regex per group (homepage, categories, seo,
  data, stories, tools, info) plus `NEW_SITE` (all of them). Search Console →
  Performance → Page → Custom (regex). `NEW_SITE` with "Doesn't match" = legacy
  URLs. The script checks that every sitemap URL is in exactly one group; run it
  after adding a new page type.
- `weekly-search-console.csv`: one row per group and per target query, per week.
- Property: a Domain property for virtuse.com (covers www and http) and a separate
  one for blog.virtuse.com.

## Step 3: one main version of each story

- `stories_canonical_map.py` → `stories-canonical-map.csv`: for each of the 359
  stories the WordPress id/URL, the virtuse.com URL, and checks (virtuse.com 200 +
  self-canonical; the canonical WordPress serves today). Baseline 2026-10-07 before
  the plugin: 359/359 ready, WordPress canonical pointed at itself on all 359.
- Main copy = virtuse.com/stories/ (Ras, 2026-10-07). WordPress can't set Yoast's
  per-post canonical over REST, so `wp-mu-plugin/virtuse-story-canonical.php` (a
  must-use plugin in blog.virtuse.com/wp-content/mu-plugins/) filters what Yoast
  prints: canonical + og:url → the virtuse.com story, and those posts leave the
  blog's Yoast sitemap. It reads `virtuse-story-canonical.json` next to it
  (`{"posts": {post ID: URL}}`); posts not listed keep Yoast's own canonical, and a
  missing or broken JSON changes nothing. No database change, rollback = delete the
  PHP file. Tested on WordPress + current Yoast (Playground, PHP 7.4 and 8.3).
- The JSON is `stories/wp-canonical.json`, written by stories-build/build.mjs and
  put next to the plugin by `stories-build/upload.sftp` after the pages, so a story's
  canonical moves only once its page is on virtuse.com. Check:
  `stories_canonical_map.py` (column wp_canonical_now = virtuse_url).
- **Live since 2026-10-07** (uploaded to `/_sub/blog/wp-content/mu-plugins/` by
  SFTP): 359/359 WordPress originals have canonical + og:url = their virtuse.com
  story, none of them is in the blog's post sitemaps any more, blog home and posts
  200. No page cache answered in front of WordPress (nginx, no x-litespeed-cache
  header), so the change showed at once without a purge.
- Seen on the way, not changed: the 10 RU originals' `/ru/...` permalinks redirect
  to the blog home (WPML); where WordPress actually renders them, the canonical is
  right.

## Bing Webmaster Tools and IndexNow (2026-10-08)

- **IndexNow** tells Bing (and Yandex, Seznam, Naver, Yep) which pages changed, so
  they recrawl them within minutes. Key = the file `<32 hex>.txt` in the site root
  (content = the key; public by design, the engines fetch it to check the sender).
  `indexnow.py --range FROM TO` sends the html pages added/changed in a git range
  that are in sitemap.xml, plus deleted pages; `--sitemap` sends every sitemap URL;
  `--urls …`; `--dry-run`. It refuses to send while the key file is not live.
  `deploy_site.sh` runs `--range` after DEPLOY OK. Story uploads through
  `stories-build/upload.sftp` do not ping (run `--range` by hand afterwards).
  First full send 2026-10-08: 861 sitemap URLs, HTTP 200. The very first try right
  after the key went live got 403 ("key not valid"); a retry minutes later worked.
- **Bing Webmaster Tools (2026-10-08):** account = Ras (vasilisin@virtuse.com),
  site `https://virtuse.com/` verified with `BingSiteAuth.xml` in the site root (keep
  that file; deleting it unverifies the site). `https://virtuse.com/sitemap.xml`
  submitted. Bing already knew three old WordPress-era sitemaps
  (www.virtuse.com/sitemap_index.xml from 2021, blog.virtuse.com/sitemap.xml,
  sitemap.virtuse.com/sitemap_index.xml); they all lead to the blog's sitemap index,
  harmless. Add Nick in Settings → Users if he needs access.

## Page speed / Core Web Vitals (2026-10-08)

- **Field data:** PageSpeed Insights shows "No Data" for virtuse.com (too few Chrome
  users for CrUX), so Core Web Vitals don't affect Google ranking yet; Google only
  uses field data. Re-check at pagespeed.web.dev once traffic grows. The PageSpeed
  API answers 429 without a key; run Lighthouse locally instead
  (`npx lighthouse@13 URL --only-categories=performance`, phone profile by default).
- **Lighthouse before (live, phone):** homepage EN 55 / SK 65 (LCP 5.6 / 5.9 s:
  render-blocking anime.js + font @import, Three.js cube), blog.html 70 and news.html
  69 (3.9 / 2.3 MB of full-size WordPress images, LCP 6-7 s), story page 79 (LCP 5.5 s,
  full-size hero), concierge 81, asset-returns 92, buy-bitcoin / bitcoin-data /
  bitcoin-tax 97-100. Cookie banner layout shift 0.14-0.16 (cause "Web font loaded").
- **Fixes:** `i18n-tools/apply_speed_fixes.py` (186 pages: font `<link>` + preconnect
  instead of `@import`; 10 homepages: anime.js `defer` with the reveals on
  DOMContentLoaded, removed where unused; cube built after the load event, fades in,
  pauses off screen). `cookie-consent.js` waits for the Inter faces (max 3 s) before
  showing the banner. asset-returns keeps the table's height while it loads.
  WordPress's smaller image copies as `srcset` (same shape only): `article.js`,
  `stories-build/build.mjs` (hero, plus `fetchpriority="high"`), the 9 blog listings
  + `i18n-tools/brief_blog_template.html` (script) and their static fallback images
  (`i18n-tools/blog_static_srcset.py`), `news/news.js` (one WordPress request for all
  issue slugs) + news.html's static cover. Browser caching headers in virtuse.com's
  `.htaccess` (`virtuse.com.htaccess`): HTML/JSON no-cache, CSS/JS 1 h, images/fonts
  7 days, `concierge-assets/` 1 year immutable; tested on a local Apache 2.4.
- **Local A/B (same machine, phone profile):** homepage EN 79 → 91 (LCP 3.9 → 3.2 s,
  CLS 0.144 → 0), SK 87 → 94 (LCP 3.7 → 2.7 s); blog.html 70 → 79-89 (LCP 6.7 →
  3.6-5.4 s, 3.9 → 1.7 MB); blog-sk 76 → 78 (3.5 → 1.5 MB); news.html 68 → 80 (LCP
  7.6 → 5.1 s, CLS 0.175 → 0.02); story page 73 → 79 (CLS 0.144 → 0.008);
  asset-returns CLS 0.17 → 0.02.
- **Left open:** the blog lead and the Brief cover come from a WordPress request made
  by the page script, so their LCP stays ~5 s on a slow phone; a static, current lead
  in the HTML would fix that. news.html's cover and first issue cards still start at
  full size (they load before the WordPress answer with the sizes arrives); the Brief
  desk could put the 768 px copies (`-768x…`) in `news/issues.json` instead.
- **Story pages (checked 2026-10-08, left as they are on Ras's decision):** live
  Lighthouse says LCP ~5.3 s, but in Chrome the hero image is the LCP at 0.3-0.7 s and
  nothing re-renders it. The 5.3 s is Lantern's slow-4G model sharing bandwidth with
  ~500 KB downloaded alongside the hero: GTM 128 KB, Source Serif 4 168 KB (the
  `opsz` axis), Inter 48 KB, IBM Plex Mono 30 KB. Moving the ticker's API calls and
  article.js's WordPress check after `load` changed nothing (they are a few KB).
  Local A/B, 3 runs each: GTM loaded after `load` 5.4 → 4.8 s (no visual change, but
  visits/partner clicks in the first 1-2 s go uncounted in GA4); Source Serif 4
  without `opsz` (168 → 69 KB) 5.4 → 4.9 s, but headlines get visibly wider and
  heavier sitewide; both 4.3 s (score 79 → ~84). Revisit if CrUX data appears and
  story LCP turns out poor.

## Other

- `wp-posts-inventory.csv`: all 1511 WordPress posts (en 870, sk 631, ru 10) with
  categories and whether a story page exists. "Crypto News" / "Krypto novinky":
  566 EN + 308 SK posts, almost all 2021–2023.
- **Crypto News hidden from search (Ras, 2026-10-07; live the same day):**
  `wp-mu-plugin/virtuse-crypto-news-noindex.php`, a second must-use plugin next to
  the canonical one, sets Yoast's robots to `noindex, follow` for the posts and
  category pages in `virtuse-crypto-news-noindex.json` and leaves them out of the
  blog's sitemaps (posts + category sitemap). The posts stay readable. List =
  `crypto_news_noindex.py`: every post in category 38 (Crypto News) or 40 (Krypto
  novinky) published before 2024, minus the stories → 868 posts (561 EN, 307 SK)
  + the two category archives. It reads all posts, not a category query: WPML
  hides 21 posts filed under the other language's category. Kept indexable: the 5
  that are stories and the 2025–2026 articles. Live check: exactly these 868 of 1501
  posts are noindex, none of them in the post sitemaps (287 entries left), category
  archives noindex, Blog category and other posts unchanged. Tested first in
  WordPress Playground (PHP 7.4, current Yoast, with the canonical plugin; missing
  or broken JSON = no change). Rollback = delete the PHP file. Google drops the
  pages as it recrawls them.
- **Leftover blog posts (Ras, 2026-10-08):** after stories (canonical → virtuse.com)
  and Crypto News (noindex), 285 posts were still indexable on the blog.
  `blog-leftover-posts.csv` has one row per post with its group, Ras's decision and
  the categories before/after (for rollback):
  - **noindex (240):** 171 empty pages (title + share buttons only; most are old
    "Media Columns" entries with the title of a story), 4 copies of stories, 52
    Virtuse Exchange-era posts (exchange news, VIRTU token, contests, "partnerships"
    with Coinfirm/Banxa/Unchained), 13 weekly Virtuse Reports from 2021. Added to
    `virtuse-crypto-news-noindex.json` (`crypto_news_noindex.py` now merges the CSV's
    noindex rows; the plugin hides whatever IDs the JSON lists). Live check: 232
    noindex, the other 8 URLs already 301 to the story originals (old slugs); none in
    the post sitemaps.
  - **story (45):** 24 Slovak posts sat in the English Blog category (13) and
    yesterday's post 15170 was set to English with the Slovak category, so neither
    blog page nor the stories build saw them; 20 more real articles were moved into
    the Blog category (13 EN / 26 SK, Uncategorized dropped). Done in wp-admin as Ras
    over the REST API. **WPML gotchas:** save a Slovak post through
    `/sk/wp-json/...`, an English one through `/wp-json/...`; a post that still holds
    the other language's term loses it on the first save and gets the new one on a
    second save; editing an original copies its categories to its translations
    (5409 → 6520). A full before/after diff of all 1502 posts showed only the
    intended changes. 15170's language was switched in the classic editor's WPML box
    (old URL 301s to `/sk/...`). The next stories build turns them into story pages.
- **Blog name (Ras, 2026-10-08):** the blog called itself "Virtuse Exchange" in every
  title, og:site_name, the Organization schema and the RSS feed. Changed in wp-admin
  (WordPress database, not in git; old values here for rollback):
  - Settings → General with `?lang=en` (WPML original): Site Title "Virtuse Exchange"
    → **Virtuse Brief**, Tagline "A one-stop shop for your Bitcoin" → **Bitcoin-only
    analysis by Ras Vasilisin**; with `?lang=sk` (WPML translation): Site Title →
    Virtuse Brief, Tagline "Investovanie je ľahké" → **Analýzy len o Bitcoine od Rasťa
    Vasilisina**. uk/ru have no translation and show the English values. The admin
    language is SK: open settings with `?lang=en` to edit originals.
  - Yoast (opened with `?lang=en`; its `wpseo_titles` texts are WPML strings, the
    originals had been typed in Slovak): Organization name "Virtuse Exchange" →
    **Virtuse**; logo → media 9238 (blog copy of VIRTUSE-SM2.jpg, was the
    www.virtuse.com URL behind two redirects); homepage social title "%%sitename%%"
    (printed literally) → empty, so og:title = the SEO title; 404 title "Stránka
    nenájdená %%sep%% %%sitename%%" → "Page not found …"; breadcrumbs "Úvod" → Home,
    "Archív pre" → Archives for, "Hľadali ste" → You searched for, "Chyba 404:
    Stránka nenájdená" → Error 404: Page not found. Slovak pages keep "Úvod" and
    "Stránka nenájdená" (WPML translations already existed).
  - Pages 9 (/blog/) and 2814 (/sk/blog/): Yoast SEO title "News from Crypto World" /
    "Novinky z krypto sveta" → **Blog** (→ "Blog • Virtuse Brief").
  - Live: home "Virtuse Brief • Bitcoin-only analysis by Ras Vasilisin" (SK "…Analýzy
    len o Bitcoine od Rasťa Vasilisina"), posts "<title> • Virtuse Brief",
    og:site_name Virtuse Brief, Organization "Virtuse", RSS "Virtuse Brief".
  - Theme `virtuse/header.php` line 75 (Appearance → Theme File Editor): header logo
    alt="Virtuse Exchange" → alt="Virtuse" (the image itself reads VIRTUSE). Original
    file in the 2026-10-07 blog backup. The same file still has the old GTM-M4C5VRD
    snippet; the must-use plugin virtuse-remove-old-gtm.php strips it from the output.
  - Pages 9 / 2814 meta description (was "Crypto blogs and announcements about news
    from cryptocurrencies and commodity trading…" / "Krypto články a novinky zo sveta
    kryptomien, svetových búrz a obchodovania s komoditami…"): EN "Bitcoin-only
    articles by Ras Vasilisin, founder of Virtuse: markets, macro, custody and
    Bitcoin-backed loans, explained without hype." / SK "Články Rasťa Vasilisina,
    zakladateľa Virtuse, len o Bitcoine: trhy, makroekonómia, úschova a pôžičky so
    zábezpekou v Bitcoine."
  - Live: no "Virtuse Exchange" left in the HTML of the home pages, /blog/, posts, 404.
