# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session status (2026-09-01) — Three languages fully live: SK, UK, CS

**Current state — done:** Three languages are live sitewide beyond
English — Slovak (`sk/`), Ukrainian (`uk/`), and Czech (`cs/`) — with a
reusable, three-times-proven i18n system, plus a browser-language
auto-redirect (Slovak-only so far) and multiple rounds of human
copy-review fixes on top of the Slovak pages. **All three languages are
deployed and verified on all three targets — `main`, `gh-pages`/staging,
and production `virtuse.com`** (confirmed via `curl` on 2026-09-01: `cs/`
pages 200 with correct content, 4-language switcher wired into
`index.html`/`sk/index.html`/`uk/index.html`, `sitemap.xml` has 80
`hreflang="cs"` entries). Specifics:
- 21 non-blog pages (the original 20, **plus `root-cycles.html`** — a
  separate real page from `rainbow-chart.html`, not a duplicate, added
  after the initial rollout) have `sk/<page>.html`, `uk/<page>.html`,
  **and now `cs/<page>.html`** counterparts: nav, footer, hero/body
  copy, and JS-generated dashboard strings are translated. `blog.html`/
  `blog-sk.html`/`article.html` stay outside the folder convention by
  design; `uk/blog.html` is a partial exception — UI translated, but
  still serves the English WordPress feed (no Ukrainian WP category
  exists yet). **`cs/blog.html` does not exist** — deliberately skipped,
  matching the original Slovak precedent (confirmed with the user
  2026-09-01), not the Ukrainian shell-page precedent. Every `cs/*.html`
  page's blog link falls back to the English `../blog.html`, same as
  every other untranslated-blog language.
- Reciprocal `hreflang` tags + `sitemap.xml` entries for both languages.
  The language switcher is now a **compact dropdown on desktop**
  (`.nav-actions > .lang-menu`, replacing the original 3-pill row once 3
  languages made pills wrap) and unchanged mobile pills — see
  [`TRANSLATION-SYSTEM.md`](Kimi_Agent_Virtuse%20MiCA%20Partners/TRANSLATION-SYSTEM.md)'s
  "Language switcher" section.
- **Browser-language auto-redirect**: `lang-detect.js` (repo root) sends
  a browser reporting Slovak straight to the matching `sk/` page,
  `location.replace`-style, unless the visitor already made an explicit
  language choice via the switcher (remembered in `localStorage`, so it
  never fights a deliberate pick). Slovak-only by design so far — whether
  Ukrainian/Czech should get the same treatment is still an open
  decision, and this file's `TRANSLATED` mapping array needs updating
  whenever a new page/language ships (it already went stale once, missing
  `root-cycles.html` for a while — see [`i18n-tools/README.md`](Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/README.md)).
- Reusable tooling in
  [`i18n-tools/`](Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/):
  the original SK-era scripts (`scaffold_sk.py`, `sitemap_add.py`,
  `wire_root.py`, `relink_sk.py`) plus the **2nd-generation UK-era**
  scripts (`scaffold_uk.py`, `sitemap_add_uk.py`,
  `wire_uk_into_existing.py`, `relink_uk.py`, `dropdown_retrofit.py`) —
  copy the UK-era ones (not the SK-era ones) as the template for Czech,
  they already bake in the dropdown switcher + no-em-dash house rule. See
  that folder's README (rewritten 2026-09-01 to actually document all of
  this — it was still describing itself as SK-only and calling Czech
  "language #2 (e.g. German)" despite UK already having shipped).
- Full system documented in
  [`TRANSLATION-SYSTEM.md`](Kimi_Agent_Virtuse%20MiCA%20Partners/TRANSLATION-SYSTEM.md)
  (also rewritten 2026-09-01 for the same reason — it still said "Slovak
  is done" with zero mention of Ukrainian).
- **Slovak post-launch review-fix rounds** (all on `main`, all synced to
  `gh-pages`/staging and production):
  - `b2cfad6` — 12-item homepage copy fixes from human review + sitewide
    label renames (Tradingové boty, Dane, BTC Data) + sitewide removal of
    stylistic em dashes/`&mdash;` from prose.
  - `493d889` — Buy Bitcoin how-it-works steps reworded; shared footer
    heading "Právne" → "Informácie" propagated sitewide.
  - `f65ec04` — About Us hero rewritten.
  - `306f717` — **Bug fix**: `blog-sk.html`'s nav/footer links were bare
    (resolved to the English root pages since `blog-sk.html` lives
    outside `sk/`); fixed to route through `sk/<page>.html`.
  - `b3d7a93` — `lang-detect.js` added (see above).
  - `ccad770`/`fb30b1e`/`04cfc5e` — `root-cycles.html` added and
    translated to SK + UK.
- All three deploy targets — `main`, `gh-pages`/staging, and production —
  are aligned as of the Czech rollout completing (2026-09-01, confirmed
  via `curl` against all three). The UK rollout + Rainbow Chart/
  root-cycles additions were discovered mid-session to have *already*
  been deployed to production independently (outside any session's
  visibility — `uk/index.html` was live with an Aug 27 timestamp before
  any deploy command was run this session), so production's actual
  staleness baseline going into the Czech deploy was smaller than git
  history alone suggested. **Lesson**: always `curl`-verify current
  production state before assuming a git-history diff tells the whole
  story — see the gotcha below.

**Czech (`cs/`) rollout — complete, all 4 phases.**
- **Phase 0** (housekeeping): `lang-detect.js`'s stale mapping fixed
  (added `root-cycles.html`) and actually deployed to staging+production
  (it existed on `main` but was never synced to either — every live page
  was silently 404ing on it); `i18n-tools/README.md` and
  `TRANSLATION-SYSTEM.md` brought up to date with the real UK-era state.
- **Phase 1** (tooling): `scaffold_cs.py`, `relink_cs.py`,
  `wire_cs_into_existing.py`, `sitemap_add_cs.py` created (Option A —
  copied the UK-era scripts, not a parameterized refactor) and verified
  end-to-end against a real page before being trusted for the full
  rollout. Found three real bugs by testing rather than just reading the
  UK-era scripts — see `80046cb`'s commit message for the full list;
  the important one for language #5: `wire_uk_into_existing.py`'s
  desktop-switcher regex targets the *old* pill markup, which doesn't
  exist anywhere anymore — `wire_cs_into_existing.py`'s
  `.lang-menu-panel`-targeting version is the one to keep copying next,
  not the UK-era original.
- **Phase 2** (translation): all 21 pages hand-translated into `cs/`,
  using the **reviewed SK copy as the translation basis** (not fresh
  from English — Czech and Slovak are close enough that this reuses
  already-approved phrasing and gives more consistent results). Every
  page individually verified: structural tag-balance check, exhaustive
  leftover-English sweep, and (new for this language) a
  **Slovak-diacritic sweep** (`ľ ĺ ô ä ŕ` — none exist in Czech) to catch
  words accidentally carried over verbatim from the SK reference instead
  of translated. One commit per page on `main`, plus a final
  `relink_cs.py` cleanup commit once all 21 existed.
- **Phase 3/4** (verification + deploy): browser-verified (desktop *and*
  mobile viewports) that the 4-language switcher renders and links
  correctly in both the dropdown and the mobile pill list, then deployed
  to `gh-pages`/staging and to production. **`uk/` turned out to already
  exist on production** (see above), so only `cs/` needed the
  `sftp mkdir` new-folder treatment; `sk/`/`uk/`/root files were plain
  recursive updates.

Real bugs found and fixed *during* the Czech rollout (beyond the three
found in Phase 1 testing):
- `scaffold_cs.py`'s title/OG/Twitter regex doesn't match `index.html`'s
  own `"Virtuse: <tagline>"` pattern (same documented limitation as
  `scaffold_uk.py`) — fixed by hand for `cs/index.html`.
- The homepage's live-WordPress blog teaser section had broken article
  links (missing `../` prefix from inside `cs/`) — and while fixing it,
  found the **exact same bug already live on `uk/index.html`** (both the
  static fallback cards and the JS-generated href, still unfixed as of
  2026-09-01). Flagged as a separate task (`task_d6e026b1`) rather than
  silently fixing only the Czech copy — **still open, worth picking up**.
- A handful of pages (`root-cycles.html`, `terms-and-conditions.html`)
  hit the documented "literal em dash instead of `—` escape"
  newsletter-string gotcha from `i18n-tools/README.md` — fixed by hand
  each time, matching the documented workaround.
- `research.html`'s blog-posts grid is **deliberately** left in English
  (matches the documented `TRANSLATION-SYSTEM.md` precedent — excerpts
  link to specific English blog posts); everything else on that page is
  translated.
- Slovak's nav label "Boty" (bots) is a **false friend in Czech**
  ("boty" = shoes) — used "Boti" instead. Worth double-checking for any
  future Slavic-language rollout, not just assuming SK terms transfer.

**Next steps, in order:**
1. **Fix the pre-existing `uk/index.html` broken blog-link bug** flagged
   above (`task_d6e026b1`) — quick, and now doubly worth doing since the
   Czech equivalent required fixing the same class of bug.
2. **Decide whether `lang-detect.js` should also auto-redirect Ukrainian
   and/or Czech browsers**, not just Slovak ones — if yes for Czech, add
   `'cs'` to its `browserLang` check and a `cs/` branch alongside the
   existing `sk/` one.
3. **Still the top-priority *compliance* item**: human legal review of
   the AI-translated compliance pages — now in **three** languages
   (`sk/`, `uk/`, and `cs/` `privacy-policy.html`,
   `terms-and-conditions.html`, `aml-compliance.html`) — real MiCA/GDPR
   exposure if mistranslated, all three languages' versions are live on
   production, none reviewed by a human speaker of any of them yet.
4. **When ready for language #5**: follow
   [`i18n-tools/README.md`](Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/README.md)'s
   "Adding the next language" section, copying the **Czech-era** scripts
   (not the UK-era ones — see the `wire_*_into_existing.py` note above).

**Decisions, constraints & gotchas (not obvious from the code):**
- **Real time gaps between sessions can hide substantial work** — the
  Ukrainian rollout, the Rainbow Chart/`root-cycles.html` pages, and the
  dropdown switcher redesign all happened without any CLAUDE.md record,
  discovered only by actually running `git log`/`ls` rather than trusting
  this file's last-written status. **Always verify current git state
  before resuming multi-session work here** — don't assume this file is
  current just because it looks complete for what it does mention.
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
- **`git diff` against an old "last known deploy" commit can overstate
  what production actually needs** — mid-Czech-rollout, a diff against
  `306f717` (the last commit confirmed live) suggested `uk/` was
  entirely missing from production, but `curl` showed it had already
  been deployed independently (outside this session, `last-modified:
  Aug 27`) sometime after that commit. Always `curl`-verify a
  representative file or two from each folder/language against the
  *actual current* production state before building a deploy command
  from git history alone — the git baseline can be stale in either
  direction.

**Commands to pick this up (no env vars needed — no build tooling in this repo):**
```bash
# Local preview
cd "Kimi_Agent_Virtuse MiCA Partners" && python3 -m http.server 8777
open http://localhost:8777/sk/index.html

# Translate another page into an EXISTING language, e.g. Czech (from repo root)
python3 "Kimi_Agent_Virtuse MiCA Partners/i18n-tools/scaffold_cs.py" "<page>.html" "<CS title>" "<CS og:description>"
# ...hand-translate the page-specific prose, then:
python3 "Kimi_Agent_Virtuse MiCA Partners/i18n-tools/sitemap_add_cs.py" "<page>.html"
python3 "Kimi_Agent_Virtuse MiCA Partners/i18n-tools/wire_cs_into_existing.py" "<page>.html"
python3 "Kimi_Agent_Virtuse MiCA Partners/i18n-tools/relink_cs.py"   # re-run after EVERY batch
# For SK/UK the equivalent scripts are scaffold_sk.py+sitemap_add.py+wire_root.py+relink_sk.py
# and scaffold_uk.py+sitemap_add_uk.py+wire_uk_into_existing.py+relink_uk.py respectively.

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
