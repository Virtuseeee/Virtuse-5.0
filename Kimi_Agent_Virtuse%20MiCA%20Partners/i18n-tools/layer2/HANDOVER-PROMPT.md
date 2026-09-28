# Handover prompt: Layer 2 module translation (FR → ES → PL → HU → UK → RU)

You are taking over the translation of Virtuse's four Layer 2 modules (Bitcoin Concierge, Stacking
Strategist, Loan & Liquidity Copilot, Tax & Inheritance Agent) into the remaining site languages.
The user writes in Slovak; reply in Slovak.

## Read first
1. `CLAUDE.md` in the repo root — at least the entries from 2026-09-25 onwards. The 2026-09-27
   entry describes the i18n architecture and the German pilot this work continues.
2. `Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/layer2/README.md` — the tools you will use.
3. The project's `src/lib/i18n.ts` header (project at `~/Documents/virtuse-concierge-deploy/bitcoin-concierge`).

## Where things stand
- EN, SK, CS: done before (inline in the code). **DE: done and live on production** (pilot).
- Remaining, one language per round, in this order: **FR, ES, PL, HU, UK, RU.**
- Each round: local → staging → production. Never start the next language before the current
  one is verified on production.

## Decisions already made (do not re-open)
- Translate all four modules, including the Tax Agent's country tax rules. Keep every rate and
  figure exactly; flag the tax content for native/tax-advisor review in your summary. The module
  pages stay `noindex`.
- The Concierge bubble goes on every page of the language (except 404 and the four tool pages).
- Tool names stay in English ("Bitcoin Concierge", "Stacking Strategist", "Loan & Liquidity Copilot",
  "Tax & Inheritance Agent"), as in each language's homepage footer.
- Register and terminology follow that language's own site pages (open its homepage, lending,
  secure, tax and faq pages and reuse their wording). Known decisions from the proofreading rounds:
  FR vous, "portefeuille", "dépositaire", "séquestre" (escrow), "bots de trading", non-breaking space
  (U+00A0, the actual character — not `&nbsp;`) before `: ; ? ! %` and inside « »; ES usted,
  "retirada(s)" for withdrawals, "tesorería" in prose; RU "Данные о Биткоине", "сетка ордеров",
  CEO "Растислава Василишина"; UK capital "Біткоїн", Virtuse is feminine, CEO "Ras Vasilisin".
  PL/HU: check CLAUDE.md (ninth/tenth round entries) and their pages.
- Numbers inside text strings use the language's style ("0,16 %"), and the four amount buckets
  are localized like DE's ("< 1.000 €"). Computed amounts stay `en-IE` ("€25,000") everywhere:
  changing that is an **open decision for the user**, not part of your rounds.

## Recipe for one language (example: fr)
From the site folder `Kimi_Agent_Virtuse%20MiCA%20Partners` (T=i18n-tools/layer2):
1. Back up the project first (it is not under git), e.g. `tar czf ~/concierge-src-$(date +%F).tgz -C ~/Documents/virtuse-concierge-deploy/bitcoin-concierge src *.html vite.config.ts`.
2. `python3 $T/dict.py template fr` → translate every `tr` in `$T/work/fr.todo.json` (382 strings,
   ~3,000 words; keep `{0}` placeholders and `\n`) → `python3 $T/dict.py build fr` must end with
   `fr: 382/382 translated, 0 missing … 0 placeholder mismatches`.
3. Write `$T/meta/fr.json` (copy `meta/de.json`: locale, short project titles, site titles/descriptions).
4. `python3 $T/pages.py fr $T/meta/fr.json`, then add a `fr:` COPY block to
   `concierge-launcher.js` (bubble texts; copy the `de:` block).
5. `python3 $T/gen_chrome.py` → `npm run build` in the project → `python3 $T/deploy.py`.
6. Verify locally (serve the site folder: `python3 -m http.server 8891`) — see checklist below.
7. Commit on `main` with explicit paths (`concierge-assets fr concierge-launcher.js` + the 12–16
   module shells + `i18n-tools/layer2`), `git pull --rebase origin main`, push.
8. Sync the gh-pages worktree — find it with `git worktree list` (it lives under `/private/tmp/gh-pages-wtN`
   and the number changes between sessions; production commands `cd` into it) — (copy the changed files, `git rm` the
   hashes listed in `$T/work/deploy_removed.txt`), push, then
   `$T/verify_md5.sh staging.virtuse.com <listfile>` until all match (GitHub Pages takes ~1–2 min).
9. Give the user the production command. **The user runs it; you never handle the SFTP password.**
   Order: new `concierge-assets/*` first, then root/sk/cs/de/<lang> shells and the `<lang>/` pages,
   last an `sftp -P 222 virtuse.com@ftp.virtuse.com < <file>` with one `rm public_html/concierge-assets/<old>`
   line per removed hash plus `bye`. Format: `scp -P 222 <files> virtuse.com@ftp.virtuse.com:public_html/<folder>/`.
   Paste generated commands verbatim — never retype file lists.
10. After the user says it's done: `$T/verify_md5.sh virtuse.com <listfile>`, check the old hashes
    return 301, run the chat flow live, then add a CLAUDE.md session entry and commit it.

## Verification checklist (every round)
- `node scripts/i18n-check.mjs` in the project: 0 missing for every dictionary.
- `python3 $T/tagcheck.py <lang>/*.html` and the module shells: 0 problems.
- Browser, `<lang>/concierge.html`: full chat flows (buy + loan) in the language; interpolated
  names (country, amount) appear translated; "Continue to partner" links keep their UTM
  parameters; "Simulate my plan" opens `<lang>/stacking.html`.
- The other three tools render with no English leftovers; the default country is the language's
  own where it exists (pl, hu; fr/es/uk/ru fall back to Slovakia — acceptable).
- No horizontal overflow at 375 px and 1280 px (iframe sweep; run it from a neutral host page —
  from uk pages frames came back cross-origin).
- The bubble on `<lang>/index.html` opens `<lang>/concierge.html`; EN/SK/CS/DE bubbles unchanged.
- EN/SK/CS/DE tool pages change only by the new switcher entry.

## Rules and gotchas
- Never `git add -A`. Three local files are always excluded from commits:
  `cloudflare-worker/src/index.js`, `email/welcome-template.html`, `email/welcome-template-sk.html`.
- Do not touch `news.html`, `news/`, `satoshi.html` (owned by the Brief desk).
- Blog pages (`*/blog.html`, `blog-sk.html`) are regenerated by another pipeline; after any blog
  rebuild, re-run `pages.py` for the affected languages (it re-adds the bubble; idempotent).
- Dictionary keys are the English source text. If English copy changes, those entries fall back to
  English until you re-run `dict.py template` and translate the new rows.
- Every build changes asset hashes for all shells, so every production deploy includes all shells.
- A stale browser cache can show an old page after deploy — check with curl/md5 first.
- If no gh-pages worktree exists: `git worktree prune && git worktree add /private/tmp/gh-pages-wt5 gh-pages`.
  Another agent may be using the current one — check `git -C <wt> status` is clean and pull before syncing.
- Report outcomes honestly: if a check wasn't run or failed, say so.
