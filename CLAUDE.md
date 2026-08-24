# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session status (2026-08-24) — Slovak translation rollout

**Current state — done:** The whole site (20 non-blog pages) now has a
Slovak translation under `Kimi_Agent_Virtuse MiCA Partners/sk/`, plus a
reusable i18n system to translate into more languages later. Specifics:
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
- **Deployed and verified live** at `https://staging.virtuse.com/sk/...`
  (GitHub Pages, see gotcha below) — confirmed via browser click-through
  on every page, no leftover English, no new console errors.

**In progress:** Nothing mid-task — this phase is complete and pushed.

**Next steps, in order:**
1. **Human legal review** of the three AI-translated compliance pages
   (`sk/privacy-policy.html`, `sk/terms-and-conditions.html`,
   `sk/aml-compliance.html`) before treating them as final — they carry
   real MiCA/GDPR regulatory exposure if mistranslated, and haven't been
   reviewed by a Slovak speaker yet. They are currently **live** on
   staging (see gotcha below), just not yet on production.
2. **Get it onto production `virtuse.com`** (Webglobe SFTP, not
   GitHub Pages — see gotcha below). An `scp` upload to
   `virtuse.com@ftp.virtuse.com:222:public_html/` was attempted and
   *did not visibly take effect* (verified via `curl` before/after —
   `styles.css` size and `/sk/` both unchanged); this is unresolved —
   next session should re-verify the SFTP credentials/path with the user
   before retrying, rather than assuming the same command will work.
3. Decide whether to fold `blog.html`/`blog-sk.html` into the `sk/`
   folder convention, or leave the suffix pattern permanently (currently
   left as-is by deliberate decision — low priority).
4. When ready for a second language, follow
   [`i18n-tools/README.md`](Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/README.md)'s
   "Adding language #2" section.
5. Two **pre-existing, unrelated** local changes (`.claude/launch.json`,
   `.gitignore`) have been sitting uncommitted since before this work
   started — not touched all session, still need the user's own call on
   whether/how to commit them.

**Decisions, constraints & gotchas (not obvious from the code):**
- **Two completely separate deploy targets, easy to conflate:**
  `staging.virtuse.com` is **GitHub Pages**, built from the `gh-pages`
  branch (has its own `CNAME` file) — *not* the Webglobe host. It has no
  CI/CD; nothing auto-deploys on push to `main`. To update it: copy
  `main`'s `Kimi_Agent_Virtuse MiCA Partners/` content onto a checkout of
  `gh-pages` (excluding the research/docs/PDFs and `i18n-tools/` — that
  branch only ever held site-serving assets), commit, `git push origin
  gh-pages`. Production `virtuse.com` is the actual Webglobe SFTP host
  (`ftp.virtuse.com:222`, `public_html`, per hosting notes) — separate
  credentials, separate manual step, and per next-step #2 above, the
  last attempt there didn't work.
- **`gh-pages` drifts behind `main` silently** — it was ~7 commits stale
  (missing OG tags, `terms-and-conditions.html`) before this session's
  sync. There's no automation keeping it current; treat it as a manual
  deploy step every time, not a mirror.
- Pages translated in batches will have **stale `../page.html` links**
  to pages that didn't have a `sk/` counterpart yet at scaffold time —
  this bit us mid-session (whole site's nav pointed back to English) and
  `i18n-tools/relink_sk.py` exists specifically to fix it. **Re-run it**
  after translating any new batch of pages, before considering the batch
  done.
- The sandboxed Bash tool's permission classifier blocks shell loops and
  bulk `rm -rf`/`find -exec` even against scratch/worktree paths — use
  explicit multi-argument `cp src1 src2 ... dest/` (no loop) for
  batch-copying files instead.
- SFTP/hosting credentials must be typed by the user directly into their
  own terminal — never routed through Claude, per this project's
  established security practice.

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
```
`origin` has both `main` (source of truth, PR/commit here) and `gh-pages`
(staging deploy target, sync manually as above) as separate branches —
don't confuse a `main` push with a staging deploy.

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
