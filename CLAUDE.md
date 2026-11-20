# CLAUDE.md

Guidance for any agent working in this repository (Virtuseeee/Virtuse-5.0, public on GitHub).
Owner: Rastislav Vasilišin ("Ras"), Virtuse Wealth Management, a.s.

Virtuse is a Bitcoin-only hub: it compares vetted partners and offers tools. It does not run
an exchange and never holds client coins, keys or money.

The session log that used to fill this file (8,831 lines, August to 16 November 2026) is in git:
`git show 8e0e397fb:CLAUDE.md`. Read the relevant entry there before touching an area you do
not know; it records why things are the way they are. Do not paste session logs back here.

## Stack

- **Site**: static HTML, no framework, no site-wide build. Folder
  `Kimi_Agent_Virtuse%20MiCA%20Partners/` (the `%20` is literal on disk). 10 languages:
  English in the root, `sk cs de fr es pl hu uk ru` in subfolders.
- **Hosting**: production virtuse.com on Webglobe (Apache, SFTP `ftp.virtuse.com:222`,
  `public_html/`). Staging staging.virtuse.com = branch `gh-pages` on GitHub Pages
  (`robots.txt` there is `Disallow: /`). No PHP on virtuse.com; the only PHP in the repo is
  `seo-ops/wp-mu-plugin/` for the WordPress blog at blog.virtuse.com.
- **Worker**: `cloudflare-worker/` (Cloudflare Worker `virtuse-newsletter`, staging
  `virtuse-newsletter-staging`). Routes: `/subscribe`, `/unsubscribe`, `/send`, `/waitlist`,
  `/ecosystem-apply`, `/pulse.json`, `/wp/*`, `/verdict/*` (checkout, stripe-webhook, report,
  withdraw, status), `/resend/webhook`, `/version`. Uses Resend (email), Stripe Checkout
  (the €14 Verdict report), KV (`RATE_LIMIT_KV`, `PULSE_KV`), Turnstile. Secrets live only in
  Wrangler (`wrangler secret put`), never in git, chat or files.
  Forms (`/subscribe`, `/send`, `/waitlist`) share an hourly email cap; Turnstile on them is
  required only where `TURNSTILE_FORMS=require` (staging; production waits for the lawyer).
- **Tool modules**: `layer2-src/` (React + Vite) builds Partner Finder, Stacking, Loan and
  Tax Agent into `concierge-assets/` plus 40 page shells.
- **Generators**: `seo-build/` (tax, fee index, DCA, DAC8, ecosystem pages), `stories-build/`
  (story pages from WordPress), `i18n-tools/` (per-page Python builders and translations),
  `*-build/` data jobs (asset returns, monthly returns, commodities, macro).
- **Analytics**: GTM `GTM-KXX4Q6WH` with GA4 `G-2VPZD595FF`, Consent Mode v2 through
  `cookie-consent.js`; Cloudflare Web Analytics without cookies. GTM never loads on staging.
- **DNS**: Microsoft 365 admin center. The wildcard `A *` record was deleted on 19 Nov 2026
  (stray hosts served a copy of the site), so every new subdomain needs its own record.

## Commands

```bash
# Preview (run inside the site folder)
cd "Kimi_Agent_Virtuse%20MiCA%20Partners" && python3 -m http.server 8891

# Worker: tests, staging deploy
cd cloudflare-worker && npm ci && npm test
npm run deploy:staging                 # staging Worker only

# Generated pages
node seo-build/generate.mjs && node seo-build/verify.mjs
node seo-build/ecosystem.mjs
node stories-build/build.mjs           # needs WordPress; hubs only: node stories-build/hubs.mjs
python3 "Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/<page>/build_<page>.py"

# Tool modules (then the shells that depend on them)
cd layer2-src && npm ci && npm run build
python3 "../Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/layer2/deploy.py"

# After editing shared files (run inside the site folder)
python3 i18n-tools/minify_css.py       # site-v2.css -> site-v2.min.css
python3 i18n-tools/site_v2_version.py  # after bumping SITE_CSS_V / SITE_JS_V in speed.py
python3 i18n-tools/cf_analytics.py --check
python3 i18n-tools/add_consent.py      # after generating pages from an old template

# Checks (from the repo root)
python3 seo-ops/site_check.py          # links, sitemap, canonical, hreflang
python3 seo-ops/audit_canonical.py

# Production (Ras runs these himself, in Terminal.app, and types the password)
bash deploy_site.sh <from-commit> <to-commit>   # DRY_RUN=1 shows the file list
bash deploy_worker.sh                           # deploys origin/main, then checks /version
```

`DEPLOY.md` describes both deploy scripts. The server `.htaccess`
(`seo-ops/virtuse.com.htaccess`) and the blog's must-use plugins are uploaded by hand:
download the live file first, compare, then upload.

## Structure

| Path | What |
|---|---|
| `Kimi_Agent_Virtuse%20MiCA%20Partners/` | the deployed site; `<lang>/` mirrors the root file names |
| `…/verdict.html`, `verdict-lite.js`, `withdrawal.html` | Verdict funnel (EN, SK sell; RU, UK waitlist only) |
| | Verdict hero quick check (two inputs `#h_btc`, `#h_savings`, live card `#mlDemo.live`, `heroUpdate()` in `verdict-lite.js`) and the Problem section; the four Verdict pages are `index, follow` and in `sitemap.xml` (`VERDICT:START/END`). Funnel events pushed to `dataLayer`: `verdict_hero_check` (once, only when the visitor types the figures, never from restored answers), `verdict_buy_intent`, `verdict_step` 1–5, `verdict_lite_unlock`, `verdict_lite_email_sent` / `_failed`, `verdict_result` (once per grade + weakest areas in a tab, key `vb-verdict-result` in `sessionStorage`), `verdict_checkout_start` / `_failed`, `verdict_checkout_cancel` (once per opened Checkout on the `?canceled=1` return, with `verdict_cta`; key `vb-verdict-pay`; GTM's `checkout_.*` trigger already matches it), `verdict_report_view`, `verdict_report_pdf`. GTM version 10 forwards them to GA4; GA4 has event dimensions Verdict step, grade, weakest, CTA, mode, error, lang (registered 19 Nov 2026). `verdict_checkout_waitlist` (`verdict_lang`, `verdict_cta` = the box) fires on a successful report-waitlist sign-up, next to `waitlist_signup`. The analytics fix shipped as `verdict-lite.js?v=30`; read the current `?v=` from the page before bumping. Test the funnel on staging by reading `dataLayer` (no GTM there); a test payment needs Ras, the test email address is `delivered@resend.dev` |
| `…/news.html`, `news/` | Virtuse Brief (issues in `news/issues.json`, `issues-sk.json`) |
| | Brief line "Everything that moves Bitcoin, in one place. Free." (title, cards): `news.html`, `i18n-tools/build_brief_sk.py`, `related_hubs.py`, `about/*.json`, `stories-build/hubs.mjs`; SK cards link `sk/news.html` |
| | Logo animation (V-mark intro, `brand/virtuse-logo-loader-{dark,light}.{mp4,webm}`): plays once beside the Brief subscribe confirmation (`playMark` in `news/news.js`, PR #200) and while Verdict waits: once on the checking screen (step 6), looped above "Preparing your report" (`vMark` in `verdict-lite.js`, PR #202; now `verdict-lite.js?v=30`, which also carries the other session's analytics fix, and `.css?v=31`), and once above the code on the 10 `404.html` pages (inline script, PR #204). The videos are rendered on black and blended with `screen`; if a dark circle or halo shows, the blend sees no page behind it: on the 404 the blend and mask sit on the wrapper, in Verdict (whose screens have a transform) the wrapper gets the page colour as its own background (PR #206, live 2026-11-19: 5/5 files md5 = main on production, checked live in EN and SK on both waiting screens). Loaded only when needed, skipped with reduced motion. The page-blocking loader `brand/logo-loader.js` was removed (PR #198) and is unused; do not put it back as a full-screen intro. Emails: `news/brief-logo-anim-v1.gif` (426×52, plays once 1.3 s, ends on the normal logo) is the header of the EN + SK welcome emails (PR #209, Worker `2338621` deployed 2026-11-19, test emails to vasilisin@ OK); Outlook for Windows gets the static PNG via `<!--[if mso]>`. The Monday Brief is sent by the desk, whose template is not in the repo: the header snippet is in `email/README.md`, not applied yet. A changed GIF gets a new name (`-v2`), Gmail caches by URL |
| `…/stories/`, `sk/stories/`, `ru/stories/` | story pages built from WordPress |
| `…/bitcoin-whitepaper.pdf` | our copy of the Bitcoin whitepaper (same bytes as bitcoin.org/bitcoin.pdf, md5 `d56d71ec…`), linked from the first card of `/ecosystem/what-is-bitcoin/` in 10 languages (`url` in `seo-build/data/ecosystem.json`, absolute because the card prints the host). The server `.htaccess` sends `X-Robots-Tag: noindex` for this one path so the copy does not compete with the original; live since 2026-11-19. `node seo-build/ecosystem.mjs` resets the sitemap `lastmod` of every ecosystem page: restore `sitemap.xml` and set the date only on the pages that changed |
| `…/site-v2.css`, `site-v2.js` | shared design; pages load them with `?v=` |
| `…/i18n-tools/` | builders; `<page>/<lang>.json` hold the translations |
| `cloudflare-worker/src/features/<name>/` | one folder per route; `test/` has the tests |
| `cloudflare-worker/src/generated/` | built from `seo-build/data`, `email/`, `data/`; committed |
| `seo-build/data/` | tax, fee and partner facts (one source for pages, tools and the Worker) |
| `seo-ops/` | redirects, `.htaccess`, sitemap and Search Console scripts, WordPress plugins |
| `email/` | welcome and waitlist email templates |
| `legal-archive/<date>/` | frozen copies of terms, privacy and withdrawal per `TERMS_VERSION` |
| `audits/` | audit reports |
| `.github/workflows/` | data jobs, Stories build, CI checks (no workflow deploys production) |

## Branches & deploy

- `main` is the source of truth and equals production once Ras has deployed.
- `gh-pages` is staging. It can carry unmerged work from other sessions, so compare it with
  `main` before copying files onto it, and patch files in place when they differ.
- Work on a branch (`feat/…`, `fix/…`, `seo/…`), put it on staging, open a PR into `main`.
  This Mac has no `gh`; PRs are opened through the GitHub REST API with the keychain token.
- The OneDrive checkout is hundreds of commits behind `main`. Work in a fresh worktree of
  `origin/main` (`git worktree add --detach <dir> origin/main`); never `git stash` there.
- `i18n-tools/legacy/build_legacy.py` and `i18n-tools/btc-returns/build_returns.py` no longer
  reproduce the committed pages (homepage chrome drift: a `brief-d-cta` aside, the nav badge
  class, the Brief image). Copy only the regions you changed into the built page, or settle
  the drift first. The data Action runs `build_returns.py --monthly` on the 1st of the month
  and will bring that drift into the returns pages; `i18n-tools/home/build_lang.py` stops on
  untranslated strings, so the 10 homepages are edited by hand.
- Order when both change: Worker first, then site. When a `?v=` file changes, bump `v` on
  every page that loads it (those files are cached for a year).
- After a deploy, compare md5 of the changed files on staging and production with the repo.
- Some pages and data are also changed outside this repo's sessions (the Brief desk, the
  daily data Actions, the Stories Action): `git fetch` and check production before editing
  `news.html`, `news/` or story output.

## Rules

1. **Staging PR only.** Never merge to `main`, never deploy. Production goes only through
   Ship after Ras's explicit "áno" in his own words. An old or general go-ahead does not count.
2. **Never publish, post or send anything** (X, WordPress, newsletter, email) without Ras's
   explicit yes.
3. **Test emails only to vasilisin@virtuse.com.**
4. **Never fabricate numbers, quotes or sources.** A figure on a page must match its source;
   mark what you do not know as unknown.
5. **Footer**: "© 2018–2026 Virtuse Wealth Management, a.s."
6. **Keep the GTM/GA4 consent setup, hreflang, canonicals and SEO titles** unless the task is
   about them.
7. **Do not change Verdict scoring, prices or legal disclaimers** without explicit
   instruction. The scoring rules exist twice (`verdict-lite.js` and
   `cloudflare-worker/src/features/verdict-lite/rules.js`); a test keeps them equal.
8. **Secrets**: never print, commit or paste a key, token or password. Ras types passwords
   into his own terminal and rotates keys himself; if you find one, report file, line and
   commit and say "rotate".
9. **No advice wording.** Virtuse does not recommend buying, selling, borrowing or a partner
   (MiCA). Partner links carry `rel="sponsored noopener"` and the referral note.
10. **Tax and fee facts** come from `seo-build/data/` and the partners' own pages. A change
    there means regenerating the pages, the tool modules and the Worker data together.
11. **Edit the source, not only the output.** Most pages are built; after a hand edit update
    the builder's JSON or run its back-sync, or the next rebuild reverts it.
12. **Report honestly.** Say what was checked and how, what was not checked, and what failed.

## Language

- **Slovak**: human and concrete, vy-form, no consulting or AI tone. No abbreviations
  (write "miliarda", "milión", "napríklad", never "mld.", "mil.", "napr."). No dotted ordinal
  numbers ("16. novembra" is a date and fine; "1. krok" is not, write "prvý krok"). No Czech
  word forms ("zadarmo", not "zdarma"; "odliv", not "odlev"). No em dashes in prose. The
  product is "Verdict"; self-custody is "vlastná úschova"; a Bitcoin-backed loan is "pôžička
  so zábezpekou v Bitcoine".
- **English**: plain and natural. Short sentences, no hype, no superlatives without a source.
- **Other languages**: follow each language's `i18n-tools/<page>/<lang>.json` and the notes
  in `i18n-tools/README.md` and `TRANSLATION-SYSTEM.md`; legal pages sell only in EN and SK.
- Reports for Ras are in Slovak; code, comments, commit messages and this file are in English.
