# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session status (2026-08-25) — Slovak translation rollout

**Current state — done:** The whole site (20 non-blog pages) has a
Slovak translation under `Kimi_Agent_Virtuse MiCA Partners/sk/`, plus a
reusable i18n system to translate into more languages later, **and** a
first round of human copy-review fixes has been applied on top. Specifics:
- All pages except `blog.html`/`blog-sk.html`/`article.html` (intentionally
  out of scope — see below) have a `sk/<page>.html` counterpart: nav,
  footer, hero/body copy, and JS-generated dashboard strings (chart
  tooltips, `sk-SK` locale formatting) are translated.
- Reciprocal `hreflang` tags + `sitemap.xml` entries, and an EN/SK language
  switcher wired into every page's desktop nav and mobile menu.
- `.lang-switch` CSS component canonicalized into
  [`styles.css`](Kimi_Agent_Virtuse%20MiCA%20Partners/styles.css).
- Reusable tooling in
  [`i18n-tools/`](Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/)
  (`scaffold_sk.py`, `sitemap_add.py`, `wire_root.py`, `relink_sk.py`) —
  see that folder's README before translating another page/language.
- Full system documented in
  [`TRANSLATION-SYSTEM.md`](Kimi_Agent_Virtuse%20MiCA%20Partners/TRANSLATION-SYSTEM.md).
- **Post-launch review-fix rounds** (all on `main`, all synced to
  `gh-pages`/staging — see commands below for the sync recipe):
  - `b2cfad6` — 12-item homepage copy fixes from human review (hero
    headline, CTA text, hub-node label, services heading, how-it-works
    step count, blog subtext, mission statement) + sitewide label
    renames (Tradingové boty, Dane, BTC Data) + sitewide removal of
    stylistic em dashes/`&mdash;` from prose (title/OG/Twitter meta
    separators switched to `|`).
  - `493d889` — Buy Bitcoin how-it-works steps reworded; shared footer
    heading "Právne" → "Informácie" propagated to all 18 pages using it.
  - `f65ec04` — About Us hero rewritten: new h1 ("Globálna
    infraštruktúra pre Bitcoin") and a new two-paragraph mission/company
    copy (Virtuse Group, Singapore HQ, Bratislava base, 50+ partners).
  - `306f717` — **Bug fix**: `blog-sk.html`'s nav/footer links were bare
    (`buy-bitcoin.html`, `about.html`, etc.), which resolve to the
    *English* root pages since `blog-sk.html` lives outside `sk/`. A
    visitor reading the Slovak blog who clicked any other nav item got
    dropped into English. Fixed by routing all of them through
    `sk/<page>.html`; also fixed the nav's own "Blog" item, which
    pointed at `blog.html` (English) despite being marked active.
- `gh-pages` (staging) is currently in sync with `main` as of `306f717`
  / `f51c6ba` — confirmed live via `curl`/browser on
  `staging.virtuse.com`.
- **Production `virtuse.com` is now also fully deployed and in sync**
  with `main` as of `306f717`, via Webglobe SFTP (see gotcha below for
  the exact recipe and the two bugs that blocked it initially). Verified
  via `curl`: homepage, `/sk/index.html`, `/sk/about.html`,
  `/sk/buy-bitcoin.html`, `/sk/terms-and-conditions.html`, and
  `blog-sk.html` all return 200 with fresh timestamps; spot-checked copy
  (hero headline, nav-bug-fix link) present in the served HTML. All
  three deploy targets — `main`, `gh-pages`/staging, and production —
  are now aligned.

**In progress:** Nothing mid-task — every fix above is committed, pushed,
and verified live on staging **and production**.

**Next steps, in order:**
1. **Human legal review** of the three AI-translated compliance pages
   (`sk/privacy-policy.html`, `sk/terms-and-conditions.html`,
   `sk/aml-compliance.html`) before treating them as final — they carry
   real MiCA/GDPR regulatory exposure if mistranslated, and haven't been
   reviewed by a Slovak speaker yet. **This is now the top-priority open
   item** — these pages are live on production, not just staging.
2. When ready for a second language, follow
   [`i18n-tools/README.md`](Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/README.md)'s
   "Adding language #2" section.
3. Decide whether to fold `blog.html`/`blog-sk.html` into the `sk/`
   folder convention, or leave the suffix pattern permanently (currently
   left as-is by deliberate decision — low priority). The nav-link bug
   in `306f717` was fixed *without* folding it in (links now point from
   the root-level `blog-sk.html` into `sk/`), so this decision is still
   open, just no longer urgent.
4. Keep taking human-review copy fixes as they come in, and re-deploy to
   all three targets each time — the pattern established this session
   (edit on `main` → verify on local preview → commit/push to `main` →
   sync `gh-pages` worktree → push → confirm live via `curl`/Monitor →
   SFTP-upload the same changed files to production → confirm live) is
   the one to repeat; see commands below.

**Decisions, constraints & gotchas (not obvious from the code):**
- **Three completely separate deploy targets, easy to conflate:** `main`
  (source of truth / git history) → `gh-pages` branch → GitHub Pages at
  `staging.virtuse.com` (has its own `CNAME` file, no CI/CD, nothing
  auto-deploys on push) → separately, Webglobe SFTP
  (`ftp.virtuse.com:222`, user `virtuse.com`, target `public_html/`) →
  production `virtuse.com`. All three now require a manual step each
  time site content changes; none of this is automated.
- **Webglobe SFTP has two sharp edges, both discovered and fixed this
  session:**
  1. The port must go in its own `-P 222` flag. Embedding it in the
     destination path (`user@host:222:public_html/`, as an early attempt
     did) is silently parsed as part of the *remote path*, not a port —
     the upload either fails or lands somewhere wrong, with no obvious
     error.
  2. Modern `scp` (SFTP-protocol-based, the OpenSSH default) will **not**
     auto-create a remote directory that doesn't exist yet for a
     recursive (`-r`) copy — it fails per-file with `realpath ...: No
     such file` / `path canonicalization failed`, exit status still 0,
     easy to miss without `-v`. This is why the first full-site upload
     silently dropped the entire `sk/` folder while every top-level file
     landed fine. Fix: create the remote directory first via
     `sftp ... <<< "mkdir public_html/sk"`, *then* `scp -r sk/*` (the
     folder's contents, not the folder itself) into the now-existing
     directory. Any brand-new subfolder pushed to production needs this
     two-step dance; existing folders just need a normal recursive copy.
  3. SFTP/SSH credentials must be typed by the user directly into their
     own terminal — Claude gives the exact command and verifies the
     result via `curl` afterward, but never sees or handles the
     password itself.
- **`gh-pages` drifts behind `main` silently** — it was ~7 commits stale
  (missing OG tags, `terms-and-conditions.html`) before the initial
  translation sync. There's no automation keeping it current; treat it
  as a manual deploy step every time, not a mirror. `main` itself can
  also pick up unrelated automated commits between sessions (e.g. a
  `[skip ci]` Bitcoin Pulse cache update bot) — if `git push origin main`
  is rejected as non-fast-forward, `git pull --rebase origin main` and
  push again; don't assume the rejection means a real conflict.
- Pages translated/edited in batches can end up with **stale
  `../page.html` links** to pages that don't share their prefix
  convention — this has bitten the project twice: once mid-translation
  (whole `sk/` site's nav pointed back to English; fixed by
  `i18n-tools/relink_sk.py`, re-run after every batch), and once via
  `blog-sk.html` specifically, which sits at the repo root outside
  `sk/` and isn't covered by `relink_sk.py` at all — its links had to be
  fixed by hand (`306f717`). Any future edit to `blog-sk.html`'s nav/
  footer must keep those hrefs pointed at `sk/<page>.html`, not bare
  `<page>.html`.
- The sandboxed Bash tool's permission classifier blocks shell loops and
  bulk `rm -rf`/`find -exec` even against scratch/worktree paths — use
  explicit multi-argument `cp src1 src2 ... dest/` (no loop) for
  batch-copying files instead.

**Commands to pick this up (no env vars needed — no build tooling in this repo):**
```bash
# Local preview
cd "Kimi_Agent_Virtuse MiCA Partners" && python3 -m http.server 8777
open http://localhost:8777/sk/index.html

# Translate another page into an existing language (from repo root)
python3 "Kimi_Agent_Virtuse MiCA Partners/i18n-tools/scaffold_sk.py" "<page>.html" "<SK title>" "<SK og:description>"
# ...hand-translate the page-specific prose, then:
python3 "Kimi_Agent_Virtuse MiCA Partners/i18n-tools/sitemap_add.py" "<page>.html"
python3 "Kimi_Agent_Virtuse MiCA Partners/i18n-tools/wire_root.py" "<page>.html"
python3 "Kimi_Agent_Virtuse MiCA Partners/i18n-tools/relink_sk.py"   # re-run after EVERY batch

# Sync staging (gh-pages branch) after pushing to main — see gotcha above
git worktree add /tmp/gh-pages-wt gh-pages
# copy main's content folder (excluding research/docs/PDFs/i18n-tools) into /tmp/gh-pages-wt, then:
cd /tmp/gh-pages-wt && git add -A && git commit -m "..." && git push origin gh-pages

# Deploy to production (Webglobe SFTP) — user runs this themselves, types
# the password directly, Claude never sees it. For files/folders that
# already exist on the server, a plain recursive scp of just the changed
# paths is enough:
cd "Kimi_Agent_Virtuse MiCA Partners" && scp -P 222 -r <changed-file-or-dir> ... virtuse.com@ftp.virtuse.com:public_html/
# For a BRAND-NEW subfolder (doesn't exist on the server yet), scp -r can't
# create it — see gotcha above — so create it first, then upload contents:
sftp -P 222 virtuse.com@ftp.virtuse.com <<< "mkdir public_html/<newfolder>"
cd "Kimi_Agent_Virtuse MiCA Partners" && scp -P 222 -r <newfolder>/* virtuse.com@ftp.virtuse.com:public_html/<newfolder>/
# Then verify from here with curl, e.g.:
curl -sI https://virtuse.com/<path> | grep -i "HTTP\|last-modified"
```
`origin` has both `main` (source of truth, PR/commit here) and `gh-pages`
(staging deploy target, sync manually as above) as separate branches —
don't confuse a `main` push with a staging deploy. Production is a third,
fully separate target reached only via the Webglobe SFTP commands above.

## Repository purpose

This repo holds marketing/content assets for **Virtuse** ("The World's First Hub for Bitcoin-Only Services") — a Bitcoin-only wealth management / partner ecosystem site. It is content-first, not an application: there is no build tool, package manager, bundler, or test suite. Pages are static HTML files with inline `<style>` and `<script>` blocks, editable and viewable directly in a browser (`open <file>.html` or a static file server).

All working content currently lives under `Kimi_Agent_Virtuse MiCA Partners/` (the folder name is percent-encoded on disk as `Kimi_Agent_Virtuse%20MiCA%20Partners`).

## Working with this repo

- No install/build/lint/test commands apply — there is no `package.json`, `requirements.txt`, or config file anywhere in the tree. Preview changes by opening the HTML file directly in a browser.
- External dependencies are loaded via CDN inline in each page (e.g. `animejs@4.5.0` from jsdelivr for animations, Google Fonts `Inter`). Don't introduce a package manager for these — keep the CDN `<script>`/`<link>` pattern consistent with existing pages.
- Each top-level `.html` file (`index.html`, `about.html`, `blog.html`, `mining.html`, `tax.html`, `treasury.html`, `lending.html`, `research.html`, `secure.html`, `buy-bitcoin.html`, etc.) is a self-contained landing/marketing page. Each still carries its own large page-specific `<style>` block, but the common core (nav, footer, CSS custom properties like `--btc-orange`, `--dark`, `--text-muted`, the language-switcher pill) was de-duplicated into [`styles.css`](Kimi_Agent_Virtuse%20MiCA%20Partners/styles.css), which every page links — check there before assuming a style rule needs copy-pasting per page.
- Some pages have deploy-specific subfolder variants (e.g. `mining_deploy/index.html`, `buybitcoin/index.html`, `hero/index.html`) — check whether an edit belongs in the root page or its deploy variant.
- **Translations** live in per-language subfolders mirroring the root filenames (e.g. `sk/index.html`). See [`Kimi_Agent_Virtuse MiCA Partners/TRANSLATION-SYSTEM.md`](Kimi_Agent_Virtuse%20MiCA%20Partners/TRANSLATION-SYSTEM.md) before adding or editing a translated page — it has the URL/hreflang convention, the language-switcher markup to copy, the EN→SK glossary, and the rollout order for pages not yet translated. `blog.html`/`blog-sk.html` predate this convention and intentionally don't follow it (see that doc).

## Content pipeline

- `research/bitcoin_europe_dim01.md` … `dim12.md` — raw deep-research dimension files feeding market analysis.
- `research/bitcoin_europe_cross_verification.md`, `research/bitcoin_europe_insight.md` — verification and synthesized-insight passes over the dimension files.
- `bitcoin-europe-market-analysis.agent.outline.md` — structured outline (TAM/SAM/SOM, trends, opportunities, capital flows) generated from the research files.
- `bitcoin-europe-market-analysis.md` / `.converted.md` / `.base.docx` / `.footnote.docx` — successive drafts of the analysis converted into Word doc form; `Bitcoin-Europe-Market-Analysis.docx` and the PDFs (`Virtuse-Complete-Partner-Ecosystem.pdf`, `Virtuse-EU-Licensed-Partners.pdf`, `Virtuse-Landing-Pages-Presentation.pdf`, `Virtuse-Non-MiCA-Business-Model-Framework.pdf`) are the final deliverables.
- `chapter1_market_sizing.md` … `chapter4_capital_flows.md` — long-form chapters underlying the same analysis.
- `plan.md` — implementation plan for landing-page animation work (scroll reveals, text scramble, staggered card entrances, hover effects) implemented via anime.js in the HTML pages.

When asked to update the market analysis, prefer editing the research/outline/chapter markdown sources first, then regenerate or hand-sync the `.docx`/`.md` derivatives rather than editing a derived file in isolation.

## Git & GitHub workflow

The root of this folder (`Virtu AI`) is a git repo with `origin` set to `https://github.com/Virtuseeee/Virtuse-5.0.git`. `setup_git_sync.sh` is a one-time helper for initializing/syncing a fresh copy of this folder to that same remote (git init, remote add, fetch/merge, commit, push) — it is not part of the site itself.

Rules for working with GitHub in this repo:

- **Auth**: HTTPS with a classic personal access token (`repo` scope) stored in macOS Keychain (`credential.helper=osxkeychain`). If a push/fetch fails with 401/403, the token is missing or invalid — the user must re-enter it interactively in Terminal (`git push` will prompt); never paste tokens into chat, files, or commit history.
- **Branching**: for reviewable changes, branch off `main` (`feat/...`, `fix/...`), push the branch, and open a PR into `main`. Direct commits to `main` are acceptable for routine content syncs of this folder (it is a content mirror, not a collaborative codebase).
- **Commits**: one logical change per commit; message says what changed and why. Since pages duplicate their own `<style>`/nav blocks, a cross-page edit (e.g. nav link change) belongs in a single commit touching all affected pages.
- **Before committing**: run `git status` and review anything staged that you didn't deliberately edit; never commit credentials, tokens, or `.claude/settings.local.json` (gitignored). OneDrive syncs this folder — commit only intentional changes, not sync artifacts like `.DS_Store`.
- **Sync cadence**: after a work session that changes site files, commit and push so GitHub stays the source of truth for deployments.
