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
| `…/news.html`, `news/` | Virtuse Brief (issues in `news/issues.json`, `issues-sk.json`) |
| `…/stories/`, `sk/stories/`, `ru/stories/` | story pages built from WordPress |
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
