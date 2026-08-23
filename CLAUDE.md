# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
