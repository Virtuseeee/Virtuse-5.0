# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session status (2026-09-02) — Newsletter → welcome-email automation discovered, fixed, extended to Slovak

**This session's work, in brief:** asked to "pull out the latest version
of the Virtuse welcome email" and later "roll out a plan for automated
sending" of it, discovery revealed the automated pipeline **already
existed and was already live in production** — built and deployed
2026-08-14 (`e9af012`/`61737f0`), with **zero mention anywhere in this
file**. Found via `curl`, not by asking — the lesson from the Czech
rollout below ("always verify current state before trusting this file")
struck again, this time on a completely different subsystem. Full
details of what the pipeline is, what was broken, and what got built are
below; **this file itself is now the source of truth for it going
forward** — it wasn't before.

**The pipeline** (see
[`cloudflare-worker/README.md`](cloudflare-worker/README.md) and
[`email/README.md`](email/README.md) for full detail): every newsletter
form sitewide POSTs to a Cloudflare Worker
(`virtuse-newsletter.virtuse-ai.workers.dev/subscribe`), which adds the
contact to Resend and, only for genuinely new subscribers, sends a
welcome email. This is **backend compute outside this git repo's normal
deploy story** — `cloudflare-worker/` is real server-side code, deployed
via `wrangler deploy` (Cloudflare), not via `gh-pages`/SFTP like every
other content change here. **Treat it as a fourth, fully independent
deploy target**, alongside `main`/`gh-pages`/production-SFTP: a Worker
code change and a frontend HTML change are two separate deploys that can
drift from each other. This bit the session directly — the Slovak
language-routing logic was live on the Worker *before* the frontend's
`lang: 'sk'` field existed on any deployed page anywhere, so real Slovak
signups would have kept getting the English email until the frontend was
separately deployed to `gh-pages` and production.

**Found and fixed: a real, live compliance bug.** The welcome email's
unsubscribe link was a literal, unresolved `{{unsubscribe_url}}` — every
real welcome email sent since the Aug 14 launch had a dead unsubscribe
link (Resend's unsubscribe merge tag only resolves for Broadcast-API
sends tied to a segment, not this flow's transactional single-send).
Fixed (`74e6407`): the Worker now has a `GET /unsubscribe?email=...&token=...`
route, HMAC-signed with a new `UNSUB_SECRET` Wrangler secret so a link
can't be forged for someone else's address. Deployed and verified live
end-to-end: real signup → real welcome email → real unsubscribe click →
contact actually removed from the Resend segment.

**Added: Slovak welcome email, live sitewide.** New
[`email/welcome-template-sk.html`](email/welcome-template-sk.html)
(`36587d8`), translated using the established SK glossary/tone rather
than fresh from English, then put through a human-editing pass for
shorter/punchier sentences (max ~20 words, cut the stiff "Vážený
investor" formal opener and a redundant self-introduction paragraph the
sign-off already covers). Its "Start here" article links to
`blog-sk.html`'s **genuine** Slovak translation of the same article the
English version features (not a Slovak title over an English link).
Wired into the live flow (`acc08d0`): the Worker's `/subscribe` now
accepts an optional `lang` field and picks the matching template +
subject from a `WELCOME_EMAIL_TEMPLATES` map (anything missing/
unrecognized/wrong-type falls back to English — a bad `lang` should never
block a signup); all 21 Slovak-language newsletter forms (`sk/*.html` +
`blog-sk.html`) now send `lang: 'sk'`. **`uk`/`cs` are not in the map
yet** — those languages' signups still get the English welcome email;
adding a third language is documented as a short, concrete checklist in
`cloudflare-worker/README.md`'s "Multi-language welcome emails" section.
Deployed and verified on **all four targets**: Worker (`wrangler deploy`),
`main` (`acc08d0`), `gh-pages`/staging (`55d9fee`), and production
(SFTP) — a real signup with `lang:"sk"` through the live production
endpoint produced a real email with the Slovak subject ("Vitajte vo
Virtuse"), received and confirmed.

**Found and fixed: `blog-sk.html`'s nav/footer were still entirely
English.** User-reported: navigating `sk/index.html` → Blog made "the
entire menu switch to English." Root cause: `blog-sk.html` predates the
i18n system's per-page nav translation (`scaffold_sk.py` et al. never
touched it, since it lives outside the `sk/` folder convention by
design) and had simply never had its own nav/footer translated, even
though its blog content, hero, and newsletter section were already
Slovak. Its hamburger menu showed "Buy Bitcoin", "Mining", "Loans",
"Custody", "Tax", "Bots", "Bitcoin Data", "About", "Get Started" (×2);
its footer showed "Company"/"About Us"/"Legal"/"Terms &
Conditions"/"Privacy Policy"/"All Rights Reserved". Fixed (`40289ce`):
translated to match `sk/index.html`'s established labels exactly (Kúpiť
Bitcoin, Ťažba, Pôžičky, Úschova, Treasury, Dane, Boty, Bitcoin dáta, O
nás, Začať; footer Spoločnosť/Informácie columns). Labels only — hrefs
were already correct, this wasn't the `306f717`-class bare-link bug.
Deployed to all three site targets (`main`, `gh-pages`/staging,
production) and `curl`-verified on each. **Worth a sweep for the same
class of bug**: any other page living outside the `sk/`/`uk/`/`cs`
folder convention (i.e. anything the scaffold scripts never touched)
should be checked for the same "body translated, shared nav/footer
chrome never was" gap — `blog-sk.html` is confirmed fixed now, but
nothing has systematically checked whether e.g. `blog.html`'s own
nav/footer (as the English original) or any deploy-variant page
(`mining_deploy/`, `buybitcoin/`, `hero/`) has drifted the same way.

**Two secrets-handling near-misses worth remembering:**
- Generated a random `UNSUB_SECRET` value with `openssl rand -hex 32` and
  printed it into this chat as a convenience — wrong, even though it's an
  internal signing key rather than a login credential, because it ends up
  sitting in the conversation log where a secret shouldn't be. Caught it
  and had the user generate their own directly in their terminal instead
  (same handling the SFTP password already gets, extended to this
  secret). **Generate/paste secrets in the user's own terminal, never in
  chat, even for non-login secrets.**
- Setting a Wrangler secret (`wrangler secret put`) and deploying the
  Worker's code (`wrangler deploy`) are two independent actions — the
  user ran the secret-put step twice, successfully, and reasonably read
  that as "deployed," but the code (with the new route the secret
  supports) hadn't shipped yet. Caught by `curl`-verifying the live
  behavior rather than trusting a "success" message from an adjacent
  step.

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
  a browser reporting Slovak, Ukrainian, or Czech straight to the
  matching `<lang>/` page (`blog.html` handled as its own per-language
  special case — see the file), `location.replace`-style, unless the
  visitor already made an explicit language choice via the switcher
  (remembered in `localStorage`, so it never fights a deliberate pick).
  Generalized from Slovak-only to all three in `f6cf8b1` (2026-09-01,
  before this session). This file's `TRANSLATED` mapping array needs
  updating whenever a new page ships in *any* covered language (it
  already went stale once, missing `root-cycles.html` for a while — see
  [`i18n-tools/README.md`](Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/README.md)).
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
  static fallback cards and the JS-generated href). Flagged as a
  separate task (`task_d6e026b1`) rather than silently fixing only the
  Czech copy — **fixed same-day in `066082d`**, before the next session
  started.
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
1. ~~Fix the pre-existing `uk/index.html` broken blog-link bug~~ —
   **already done**, `066082d` (2026-09-01), before this session started.
   Was still listed here as open going into this session — another
   instance of this file lagging real repo state; see the "real time
   gaps" gotcha below.
2. ~~Decide whether `lang-detect.js` should auto-redirect Ukrainian/Czech
   too~~ — **already done**, `f6cf8b1` (2026-09-01): it now auto-redirects
   `sk`/`uk`/`cs` browsers, generalized from the old Slovak-only
   `browserLang` check to a `targetLang` resolver.
3. **Still the top-priority *compliance* item**: human legal review of
   the AI-translated compliance pages — in **three** languages (`sk/`,
   `uk/`, and `cs/` `privacy-policy.html`, `terms-and-conditions.html`,
   `aml-compliance.html`) — real MiCA/GDPR exposure if mistranslated, all
   three languages' versions are live on production, none reviewed by a
   human speaker of any of them yet.
4. **When ready for language #5** (site pages): follow
   [`i18n-tools/README.md`](Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/README.md)'s
   "Adding the next language" section, copying the **Czech-era** scripts
   (not the UK-era ones — see the `wire_*_into_existing.py` note above).
5. **New: give Ukrainian and Czech their own welcome email.** Right now
   only `en` (default) and `sk` have a template — `uk`/`cs` signups still
   get the English welcome email. Follow
   [`cloudflare-worker/README.md`](cloudflare-worker/README.md)'s
   "Multi-language welcome emails" checklist (draft
   `email/welcome-template-<lang>.html`, add it to `build.mjs`'s
   `TEMPLATES` and `src/index.js`'s `WELCOME_EMAIL_TEMPLATES`, wire the
   language's forms to send `lang: '<lang>'`, deploy). The Slovak one
   (`email/welcome-template-sk.html`) is the template to copy the
   *process* from, including the human-editing pass for tone.
6. **New: no human speaker has reviewed the Slovak welcome email's
   copy** — it was translated using the site's reviewed SK glossary/tone
   and then edited for punch, but never checked by a native speaker the
   way the site's `sk/` pages themselves went through review rounds
   (see the Slovak post-launch fixes below). Lower stakes than #3 (it's
   marketing copy, not a legal page), but still worth a pass before
   treating it as final.

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
- **The Cloudflare Worker (`cloudflare-worker/`) is a fourth deploy
  target, fully independent of `main`/`gh-pages`/production-SFTP** — see
  the 2026-09-02 session status above. Shipping a Worker code change
  (`npm run deploy`) does nothing to the site's static HTML, and vice
  versa; verify each side separately with `curl` rather than assuming one
  deploy implies the other happened.
- **`wrangler` must be installed locally before `npm run deploy` works**
  — `npx wrangler <command>` (e.g. `secret put`) downloads a one-off copy
  each time and never persists it to `node_modules`, so the project's own
  `npm run deploy` script (which calls bare `wrangler` expecting it on
  the local `node_modules/.bin` PATH) fails with `command not found`
  until `npm install` has actually been run once in `cloudflare-worker/`.
- **Setting a Wrangler secret and deploying the Worker's code are two
  separate steps that are easy to conflate** — `wrangler secret put X`
  succeeding does not mean the code that uses `X` has shipped. Verify the
  actual deployed behavior with `curl`, not the success message of an
  adjacent command.
- **Never generate or print a secret value into the chat**, even a
  non-login one like an HMAC signing key — it ends up sitting in the
  conversation log. Have the user generate it (e.g. `openssl rand -hex
  32`) and paste it directly into their own terminal prompt, same
  handling the SFTP password already gets.
- **A `git worktree` left over from a previous session's `gh-pages` sync
  can often be reused** — check `git worktree list` before creating a new
  one; the branch can only be checked out in one worktree at a time, and
  session scratchpad directories aren't always cleaned up between
  sessions. `git pull origin gh-pages` in it first to make sure it's not
  itself stale.
- **`gh-pages` can drift *per file*, not just per whole folder** —
  `blog-sk.html` on `gh-pages` was missing `lang-detect.js`, its
  `hreflang` tags, the desktop dropdown switcher, and the UK nav pill,
  none of which had anything to do with the newsletter-`lang` change
  being synced. Syncing "just the changed file" from `main` can bring
  along a larger diff than expected if that specific file had drifted
  independently — check the diff before pushing, don't assume it's a
  single-line change just because the intended edit was.

**Commands to pick this up (no env vars needed for the static site itself — `cloudflare-worker/` is the one exception, see its own section below):**
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

# Deploy the newsletter Worker (separate from all of the above — see
# cloudflare-worker/README.md). Needs npm install once if wrangler has
# never been installed locally in this folder before:
cd cloudflare-worker && npm install   # first time only
npm run deploy                        # rebuilds dist/worker.js from src/ + email templates, then wrangler deploy
# Verify live behavior directly, don't trust the deploy output alone:
curl -s -i -X OPTIONS https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe -H "Origin: https://virtuse.com" -H "Access-Control-Request-Method: POST"
```
`origin` has both `main` (source of truth, PR/commit here) and `gh-pages`
(staging deploy target, sync manually as above) as separate branches —
don't confuse a `main` push with a staging deploy. Production is a third,
fully separate target reached only via the Webglobe SFTP commands above.
The Cloudflare Worker is a **fourth**, fully independent target — see the
2026-09-02 session status and its gotcha above.

## Repository purpose

This repo holds marketing/content assets for **Virtuse** ("The World's First Hub for Bitcoin-Only Services") — a Bitcoin-only wealth management / partner ecosystem site. It is content-first, not an application: the site itself has no build tool, package manager, bundler, or test suite — pages are static HTML files with inline `<style>` and `<script>` blocks, editable and viewable directly in a browser (`open <file>.html` or a static file server). The one exception is `cloudflare-worker/` (see below and its own README) — real server-side code with a real `package.json`/npm/Wrangler toolchain, deployed separately from the static site.

All working content currently lives under `Kimi_Agent_Virtuse MiCA Partners/` (the folder name is percent-encoded on disk as `Kimi_Agent_Virtuse%20MiCA%20Partners`).

**Newsletter signup → welcome email**: every newsletter form sitewide
POSTs to a Cloudflare Worker (`cloudflare-worker/`, deployed via
`wrangler`, not part of the static-site deploy flow) which adds the
contact to Resend and sends a welcome email
(`email/welcome-template.html`, or a per-language variant like
`email/welcome-template-sk.html` — see `cloudflare-worker/README.md`'s
"Multi-language welcome emails"). See the 2026-09-02 session status above
for how this was discovered/fixed/extended, and `cloudflare-worker/README.md`
+ `email/README.md` for the full system.

## Working with this repo

- No install/build/lint/test commands apply to the **site itself** — no `package.json`, `requirements.txt`, or config file governs the HTML pages. Preview changes by opening the HTML file directly in a browser. (`cloudflare-worker/` is a real npm/Wrangler project with its own `package.json` — see "Newsletter signup → welcome email" above and its own README; that tooling is scoped to that one folder and doesn't apply to anything else in the repo.)
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
