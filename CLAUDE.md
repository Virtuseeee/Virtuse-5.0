# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session status (2026-09-09, continued) — Loan & Liquidity Copilot + Tax & Inheritance Agent: two more Layer 2 modules, live on staging

**What shipped:** the third and fourth Layer 2 modules —
[`loan.html`](Kimi_Agent_Virtuse%20MiCA%20Partners/loan.html) (Loan &
Liquidity Copilot: sell-vs-borrow calculator, liquidation watch,
scenario matrix) and
[`tax-agent.html`](Kimi_Agent_Virtuse%20MiCA%20Partners/tax-agent.html)
(Tax & Inheritance Agent: 11-country tax overview + inheritance
readiness check) — same pattern as `concierge.html`/`stacking.html`:
standalone static pages, `noindex` for now, English only. Source:
`src/lib/loan.ts` + `src/lib/tax.ts` (both untouched, per the brief's
constraint) and lightly adapted `src/pages/Loan.tsx` / `Tax.tsx`, pulled
from the same `/Users/rasvas/Documents/kimi/tasks/2026-09-07/10-24-04-da2d695b/bitcoin-concierge/`
handoff project as Stacking, merged into the canonical
`virtuse-concierge-deploy` source alongside the other two — that
project now builds all **four** modules as separate Vite entries
(`index.html`/`stacking.html`/`tax-agent.html`/`loan.html`).

**Scope, per explicit user confirmation**: both new modules built
together (not staggered), placement limited to the dedicated pages
themselves plus Concierge deep-links only (no category-page embeds,
no sticky-launcher changes) — same narrow slice Stacking got. Concierge's
result cards gained two more deep-links alongside buy's existing
"Simulate my plan": `goal=loan` → "Compare sell vs. borrow" into
`loan.html?amount=<bucket>` (pre-fills "cash needed"); `goal=tax` or
`goal=custody` → "Check my country's rules" into
`tax-agent.html?country=<id>` (pre-selects the matching country tab —
Concierge and Tax share the same 11-country id set, verified: `pl` →
Poland's 19% flat rate pre-selected correctly).

**A near-miss worth its own callout — a real page was almost
overwritten.** The module is internally called "Tax & Inheritance
Agent," and the natural filename, `tax.html`, is **already the site's
real "Bitcoin Tax Reporting" category page** — 1215 lines, full
nav/styles, `hreflang` for 5 languages (en/sk/uk/cs/ru). An early step
this session `Write`'d straight over it without checking first. Caught
immediately (the harness's own "file changed since you last read it"
diff made the mismatch obvious — a 1215-line real page collapsing to a
46-line module shell), fixed with `git checkout` before anything was
committed, and the module was deployed instead at `tax-agent.html`, a
filename chosen specifically to not collide with any real site page.
**The lesson, now a standing rule for every future Layer 2 module**:
before writing a new page to this repo, check the *site's own existing
pages* for that filename — `ls "Kimi_Agent_Virtuse%20MiCA%20Partners/<name>.html"`
or equivalent — not just whether the deploy source's own `dist/`
already produces it. `loan.html` was genuinely free (verified via `git
log` on the path before use, the same check that should have run for
`tax.html` first); a plural `loans.html` category page doesn't exist
either, but a singular `loan.html` easily could have if this site ever
grows one.

**Shared-chunk rebuild, now across four pages**: `concierge.html`'s and
`stacking.html`'s own asset hashes changed *again* in this same commit,
even though neither module's own code changed — Vite's chunk-splitting
now extracts `arrow-left-*.js` (the back-button icon, shared by 3 of
the 4 pages), `shield-check-*.js` (Concierge + Tax), `table-*.js`
(Stacking + Loan), and `triangle-alert-*.js` (Tax + Loan) as their own
shared chunks alongside the existing `button-*.js`/`.css`. All ten
files live together in `concierge-assets/` — expect this list to keep
growing (and old hashes to keep needing deletion, both locally and on
gh-pages) with every future module. **This is the same manual-upkeep
gotcha as before, now sharper**: adding or rebuilding *any one* module
can silently change the asset references needed by *all four* HTML
files, not just the one that changed — always rebuild and check every
page's actual `dist/*.html` output before assuming only the touched
module's `<script src=...>` needs updating.

**Deploy verification, this session:** local build (`npm run build`,
`tsc -b` clean) → full loan-goal and custody-goal Concierge chat flows
clicked through in a real local browser session to their respective
deep links, confirmed correct query params and correct pre-fill on the
target page → regression-checked Concierge and Stacking still render
correctly after the shared-chunk rebuild (Stacking's "saves you €19"
copy-bug fix from earlier this session still correct) → UTM decoration
confirmed on both new pages' partner links → no console errors beyond
the pre-existing GTM `ga-audiences` one → no horizontal overflow at
375px on either new page, including Loan's scenario-matrix table →
committed to `main` (`571a4d5`) → synced to `gh-pages` via the existing
worktree pattern (`12e9595`) → `curl`+browser-verified live on
`staging.virtuse.com`, **including an explicit check that the real
`tax.html` category page still serves its original content** ("Bitcoin
Tax Reporting", not the module). **Production was not touched this
session** — staging-only, same as Stacking.

**Two more real issues found, deliberately not fixed (flagged, per the
brief's "don't rework the logic" constraint):**
- `loan.ts`'s `FIREFISH_URL` constant is `'https://virtuse.com/'`, not
  Firefish's real affiliate link, despite the loan-verdict CTA saying
  "Get a Bitcoin-backed loan via Firefish." Firefish's real URL already
  exists in `concierge.ts`
  (`app.firefish.io/auth/sign-up?ref=virtuseloan`) — this should be a
  trivial fix once approved, since the real link is already vetted and
  used elsewhere in the same codebase.
- `tax.ts`'s `PARTNER_LINKS.unchained` and `.coinfirm` both point at
  `virtuse.com` URLs. Confirmed via `grep` that neither "Coinfirm" nor
  "Unchained" appear anywhere in `tax.html` or `secure.html` — the same
  invented-partner pattern the Concierge catalog had before its
  `075fde8` rewrite (see the 2026-09-08 session status). Unlike
  Firefish, there's no obvious real substitute already sitting in
  `concierge.ts` for either of these — tax.html's real tax-report
  partners are Blockpit/Koinly/CoinTracking/Divly (none of which do
  audit reports via a "Coinfirm"-style service), and secure.html's real
  custody partners are Trezor/Ledger/Blockstream (none offer a
  multisig-inheritance-vault product like the "Unchained-style vault"
  described). Fixing this one may need an actual product decision, not
  just a find-and-replace to an already-known real URL.

**Next steps, in order:**
1. **Approve for production**, or hold at staging — all four modules
   (Concierge, Stacking, Loan, Tax) are staging-only as of this session.
2. **Decide on fixing `FIREFISH_URL`** — likely a quick, low-risk fix
   once approved (the real URL is already known and already used
   elsewhere).
3. **Decide on `tax.ts`'s Coinfirm/Unchained links** — needs a product
   decision (what does Virtuse actually want to route these to?), not
   just a URL swap.
4. **The remaining deferred placements from the original 2-module
   brief** (Grow Your Stack widget — done; Buy Bitcoin step-0 — done;
   Bots-page section — still open; sticky-launcher awareness of
   Stacking — still open) plus this 4-module brief's own placement
   items that were explicitly out of scope this pass: Loans-category
   embed (item D8), Custody-category inheritance section (item E11),
   and the Q1 tax-season seasonal hook (item E12).
5. **Marketing/SEO review** — all four pages are `noindex` for the same
   reason `concierge.html` was: none reviewed yet.
6. **Human review of `stacking.ts`'s `FEE_SCHEDULE`** — already done,
   see the 2026-09-09 (first) session status below. `loan.ts`/`tax.ts`'s
   equivalent partner-identity review is #2/#3 above; nobody has yet
   reviewed whether either module's underlying *logic* (sell-vs-borrow
   verdict thresholds, inheritance-readiness scoring weights) is sound,
   separate from the partner-link issue.

## Session status (2026-09-09) — Stacking Strategist (DCA module): dedicated page, deep-linked from Concierge, live on staging

**What shipped:** the second Layer 2 prototype module, "Stacking
Strategist" (DCA projection + partner fee arbitrage table), deployed as
[`stacking.html`](Kimi_Agent_Virtuse%20MiCA%20Partners/stacking.html) —
same pattern as `concierge.html`: standalone static page, `noindex` for
now, English only. Source: `src/lib/stacking.ts` (untouched, per the
brief's constraint) + a lightly adapted `src/pages/Stacking.tsx`, both
pulled from a **separate, older** Kimi handoff at
`/Users/rasvas/Documents/kimi/tasks/2026-09-07/10-24-04-da2d695b/bitcoin-concierge/`
(this one bundled *both* modules; only Stacking was new — Concierge was
already live from the 2026-09-08 session's own, different source at
`~/Documents/virtuse-concierge-deploy/`) and merged into that canonical
`virtuse-concierge-deploy` project alongside the existing Concierge
code, which is now the **single source of truth for both modules**.

**Scope was deliberately narrowed** from the original two-module brief
([`prompt-pre-claude-nasadenie-2-moduly.md`](/Users/rasvas/Documents/kimi/tasks/2026-09-07/10-24-04-da2d695b/prompt-pre-claude-nasadenie-2-moduly.md),
predates the actual Concierge rollout) to just: (1) the Stacking page
itself, and (2) a deep-link from Concierge's buy-goal result cards
("Simulate my plan →") that carries the visitor's amount bucket over as
`?amount=s|m|l|xl`, which Stacking reads on load to pre-fill its
lump-sum/contribution sliders (verified: `amount=m` → €500 initial /
€100 contribution). **Not done, still open**: the brief's other
placements (Grow-Your-Stack homepage widget, Buy-Bitcoin "step 0"
section, Bots-page section, sitewide launcher awareness of Stacking),
full i18n scaffolding for the module, and a GitHub Action to automate
the main→gh-pages sync — all explicitly deferred, not forgotten.

**Build mechanics — the deploy source is now a two-entry Vite build**,
not a single SPA: `vite.config.ts`'s `build.rollupOptions.input` lists
both `index.html` (Concierge) and `stacking.html` (Stacking) as
separate entries, each with its own `main.tsx`/`main-stacking.tsx` (the
Stacking entry skips `BrowserRouter` — it has no internal routes).
Vite's chunk-splitting now produces a **shared** `button-*.js`/`.css`
chunk both pages load alongside their own entry chunk — this is why
`concierge.html`'s own asset hashes changed in this same commit even
though nothing about Concierge itself changed; both pages' assets now
live together in `concierge-assets/` (not a separate `stacking-assets/`
— they share a chunk, so one folder). **Same manual-upkeep gotcha as
Concierge applies, now to both pages at once**: any future rebuild of
either module means re-copying whichever hashed files changed and
hand-editing the `<script>`/`<link>` lines in *both* `concierge.html`
and `stacking.html`, and deleting whichever old hashed files became
orphaned (this session's rebuild orphaned the original
`index-D2oNk2-L.js`/`index-BAqhd-t6.css` pair — deleted, both locally
and on gh-pages).

**A real issue found, deliberately not fixed (out of scope this pass):**
`stacking.ts`'s `FEE_SCHEDULE` — untouched per the brief's "don't rework
the logic, report errors instead" constraint — routes to "Banxa" and
"MiCA-licensed CASP", names that read exactly like the kind of invented
placeholder partners the Concierge catalog had *before* its `075fde8`
real-partner rewrite (see the 2026-09-08 session status). Unlike
Concierge, Stacking's fee table isn't tied to individual partner
identity in the same way (its `url` fields point back to virtuse.com
category pages like `buy-bitcoin.html`/`bots.html`, not out to a named
partner's own site), so it's a softer version of the same problem — but
worth the same scrutiny before this page leaves `noindex`. **Flag this
to the user before doing any further work on `stacking.ts`, don't
silently rewrite it** — same rule that applied to `concierge.ts` until
the user explicitly asked for that fix.

**Deploy verification, this session:** local build (`npm run build`,
`tsc -b` clean) → local static-server click-through (Concierge's full
buy-flow → result card → "Simulate my plan" → Stacking pre-filled
correctly; UTM on Stacking's own partner-route link correctly inherits
`utm_medium` from the incoming query string; `stacking_route_click`
dataLayer event confirmed via console; 375px viewport, no horizontal
overflow) → committed to `main` (`c04a745`) → synced to `gh-pages` via
the existing worktree pattern (`a0bb4a2`) → `curl`+browser-verified live
on `staging.virtuse.com` (both pages 200, correct asset hashes resolve,
old orphaned hashes 404, no new console errors beyond the pre-existing
GTM `ga-audiences` one). **Production was explicitly not touched this
session** — user chose staging-only for this deploy; production sync
(SFTP, same two-step new-file dance as any changed/new file — see the
Webglobe gotchas below) is still open whenever it's approved.

**Same-day follow-up — Stacking now recommends only real partners too
(`097fb75`):** the user explicitly asked to fix the "Banxa"/"MiCA-licensed
CASP" issue flagged above. `FEE_SCHEDULE` was rebuilt around 4 real
partners already on virtuse.com, each with its real affiliate URL
(reused from `concierge.ts`'s already-vetted catalog):
**21bitcoin** (Auto-Invest plan, 0 % fees — genuinely published, and
genuinely automated, so it doubles as the "set & forget" option),
**ByBit EU** (Spot trading, fees from 0.1 % — published), **Kraken**
(Pro trading, fees from 0.16 % — published), and **RevenueBot**
(Automated DCA/grid bot — no public per-trade fee exists, so this row's
number stays explicitly ILLUSTRATIVE, flagged in its own note, rather
than inventing a precise figure). `bestRoute()`'s reasons/breakEven copy
was rewritten around the new ids; `Stacking.tsx`'s remaining "Virtuse
Bots" references (intro line, CTA button label) were swapped for the
real names — CTA now reads "Start Auto-Invest" when 21bitcoin wins (which
it does at every contribution level, since 0 % genuinely beats every
other row) or "Automate with RevenueBot" when RevenueBot wins. Rebuilt,
verified locally and live on staging (`stacking.html`'s script src →
new `stacking-DFmHQBw0.js`, old `stacking-LnKahpxQ.js` removed both
locally and on gh-pages; UTM-decorated real affiliate link confirmed:
`21bitcoin.app.link/...?code=VIRTUSE&utm_source=stacking&...`).

**Second same-day follow-up — the "saves you €0" copy bug is fixed too
(`3aefe5b`):** the "recommended route" card's *"Staying on the cheapest
route saves you X per year in fees vs the average of the other routes"*
line computed X as `advice.winner.annualDrag` — the winner's **own**
annual fee — not an actual savings-vs-average calculation, so it read as
"saves you €0" once 21bitcoin's real 0 % became the winner. Fixed in
`Stacking.tsx` (not `stacking.ts` — this was page-level copy logic, not
routing/fee-schedule data): X is now `avgOtherDrag - winner.annualDrag`,
the mean `annualDrag` of every *non*-winning row minus the winner's own,
which is what the sentence actually claims; falls back to "there is
nothing left to save" in the (currently unreachable, but handled) case
that's ever exactly zero. Verified live on staging at the €100/month
default: winner (21bitcoin, €0/yr) vs. the other three rows' annual drag
(€1 + €2 + €53 = €56, mean €18.67) now correctly shows **"saves you €19
per year"**. Rebuilt (`stacking.html`'s script src → `stacking-BqlQkD7Z.js`,
old `stacking-DFmHQBw0.js` removed both locally and on gh-pages).
**Gotcha hit while verifying this**: the Browser pane's first re-check
after deploy still showed the stale "€0" text — not a deploy failure,
just the browser's own HTTP cache for the unversioned `stacking.html`
path (the hashed JS chunk itself was already correct, confirmed by
`curl`+MD5 against the local build output). A cache-busted reload
(`?cachebust=1`) showed the fix immediately. Worth remembering for any
future same-page recheck: `curl` the asset/HTML directly first to settle
whether it's a deploy problem or just a stale browser tab before
concluding a fix didn't ship.

**Third same-day follow-up — two of the three deferred placements now
shipped (`1612a3e`):** the user asked which other placement options
existed beyond the dedicated page + Concierge deep-link, and picked the
homepage widget + Buy Bitcoin step-0 (the two the original brief itself
prioritized). Both are plain links, no iframe/embed, so zero new
render-blocking resources:
- `index.html`'s "How Virtuse Works" step 4 card ("Grow Your Stack")
  now carries the brief's exact copy ("Set your rhythm, compare every
  partner's fees, automate with Bots.") plus a "Plan my stack →" CTA
  into `stacking.html?utm_medium=widget` — replacing its previous
  generic description, with a subtle orange highlight (`.how-card-stack`)
  so it reads as the interactive one of the four steps.
- `buy-bitcoin.html` gained a new "step 0" section between "How It
  Works" and the partner comparison grid — "How much — and how often —
  do you want to buy?" + the same CTA, styled consistently with
  `index.html`'s existing `.concierge-banner` pattern (own scoped
  `.stack-step0*` classes, not shared — each top-level page still
  duplicates its own `<style>` block per this repo's convention).

Verified locally and live on staging (`curl` + browser, both desktop and
375px mobile, no new console errors beyond the pre-existing GTM one,
correct `href`s on both).  **Still not done**: a Bots-page section
(automation break-even angle) and any sticky-launcher awareness of
Stacking — the user chose only these two for this pass.

**Next steps, in order:**
1. **Approve for production**, or hold at staging for further review —
   still staging-only as of this session.
2. **Decide on the two remaining placements** — a Bots-page section
   (automation break-even pitch) and sticky-launcher awareness of
   Stacking — see the third same-day follow-up above for what already
   shipped.
3. **Marketing/SEO review** — `stacking.html` is `noindex` for the same
   reason `concierge.html` was: not yet reviewed.
4. ~~Human review of `stacking.ts`'s `FEE_SCHEDULE`~~ — **done**, see the
   first same-day follow-up above; the remaining review item is whether
   the routing/ranking *logic*, not just partner identity, is sound, plus
   the RevenueBot row's still-illustrative fee once they publish real
   pricing.
5. ~~Fix the "saves you €0" copy bug~~ — **done**, see the second
   same-day follow-up just above.

## Session status (2026-09-08) — Bitcoin Concierge rollout: dedicated page, sticky launcher, hero/banner CTAs, live on all 3 targets

**What shipped:** a pre-built React/Vite prototype ("Bitcoin Concierge"
— a rule-based routing assistant that asks goal/country/experience/
custody/amount and matches the visitor to one of the vetted partners
already listed on the site) was handed off from a Cowork/Kimi session as
a local project at
`~/Documents/virtuse-concierge-deploy/bitcoin-concierge/` (**outside
this repo** — only its production build output lives here), with two
briefing docs in `~/Documents/virtuse-concierge-deploy/`
(`CONTEXT-FROM-COWORK.md`, `prompt-pre-claude-nasadenie.md`). This
session built it, integrated it into the static site, and deployed it
end-to-end to **all three** targets — `main`, `gh-pages`/staging, and
production `virtuse.com` — same-day, fully verified on each via `curl`
and a live in-browser click-through.

**New files added to the site** (all under `Kimi_Agent_Virtuse MiCA
Partners/`):
- [`concierge.html`](Kimi_Agent_Virtuse%20MiCA%20Partners/concierge.html)
  — standalone dedicated page, the built prototype's `dist/index.html`
  adapted with the site's usual meta/CSP/OG boilerplate. Deliberately
  `noindex` for now (not yet marketing/SEO-reviewed) and **not** part of
  the `sk`/`uk`/`cs` translation system — English only.
- `concierge-assets/` — the built JS/CSS bundle (hashed filenames from
  Vite; re-copy both files and update the two `<script>`/`<link>` src
  attributes in `concierge.html` by hand on every rebuild — there's no
  build step wired into this repo for it).
- [`concierge-launcher.js`](Kimi_Agent_Virtuse%20MiCA%20Partners/concierge-launcher.js)
  — sitewide sticky bubble (bottom-right, ₿ icon), lazy: builds the
  bubble eagerly but only creates the `<iframe>` overlay on first click,
  so it adds no extra request/render-blocking work to page load. Wired
  into **25 of the 26 EN top-level pages** via `<script ... defer>`
  before `</body>`, the same rollout pattern as `lang-detect.js`.
  Deliberately **excluded** from `blog-sk.html` (Slovak content, and the
  Concierge UI is English-only) and from `concierge.html` itself (the
  destination page doesn't need a launcher pointing at itself). Not
  wired into any `sk/`/`uk/`/`cs/` page — MVP scope was EN only, a
  decision made explicitly this session (see "Next steps").

**Site changes on top of the new files:**
- [`index.html`](Kimi_Agent_Virtuse%20MiCA%20Partners/index.html) hero:
  third button `Get matched in 60 seconds →` next to the existing
  `Explore the Hub` / `See How It Works` pair
  (`?utm_source=concierge&utm_medium=hero`); `.hero-buttons` gained
  `flex-wrap` so three buttons wrap instead of overflowing on
  medium-width viewports.
- New banner between the problem/solution cards and the services grid —
  `Not sure which applies to you? Get matched in 60 seconds`
  (`?utm_medium=banner`) — placed at the exact decision-paralysis moment
  the Cowork analysis identified (`CONTEXT-FROM-COWORK.md`).
- CSP `frame-src` on **all 26 top-level pages** gained `'self'` — it was
  missing entirely (the site's CSP only allowlisted specific external
  frame sources like `widget.firefish.io`/YouTube/Spotify), which would
  have silently blocked the launcher's own iframe with zero visible
  error beyond a console CSP violation. Easy to miss if you don't
  actually click the launcher and check the console.

**Two real bugs found and fixed during implementation** (not visible
from reading the prototype's code, only from actually running it):
1. The prototype's `react-router` route was `<Route path="/" ...>`. That
   never matches once the app is deployed at `/concierge.html` instead
   of the URL root — the page rendered completely blank, no console
   error beyond "No routes matched location". Fixed by changing to
   `path="*"` in the prototype's `App.tsx` before the production build.
   **If this prototype is ever rebuilt from a fresh copy of the Cowork
   source, re-apply this fix** — it's not something a generic
   `npm run build` would catch.
2. Same CSP `frame-src` gap as above — found by actually opening the
   launcher locally and reading the console, not by reading the CSP
   meta tag and reasoning about it.

**UTM + click tracking** (was not in the prototype at all — built this
session, without touching `src/lib/concierge.ts`'s routing logic per the
brief's explicit constraint): every partner-card link in
`ConciergeChat.tsx` now appends
`utm_source=concierge&utm_medium=<inherited from the page's own
?utm_medium>&utm_campaign=layer2-mvp&utm_content=<partner id>` and fires
a `dataLayer.push({event:'concierge_partner_click', partner_id})` before
navigating. Verified end-to-end in a real browser session (not just read
the code): full chat flow → result cards → clicked a partner card →
confirmed both the UTM-decorated `href` and the `dataLayer` event fired.

**Deploy verification, all three targets, `curl` + live browser click,
same session:**
- `main`: `eac694c` (new page/assets/launcher) → `a4f57aa` (wired into
  25 pages) → `04a0bee` (hero+banner CTA on index.html) → `135afb1`
  (local `.claude/launch.json` preview fix, unrelated dev-tooling
  cleanup). Pushed after a `git pull --rebase` (an unrelated commit had
  landed on `main` first — see the recurring gotcha below).
- `gh-pages`/staging: synced via the usual worktree-copy pattern, one
  commit (`8cfbeb2`), confirmed live via `curl` (`concierge.html` 200,
  launcher present on `buy-bitcoin.html`, correctly absent on
  `blog-sk.html`, CSP `frame-src 'self'` present) — GitHub Pages took
  about 45–60s to actually publish after the push, plain immediate
  `curl` right after `git push` still 404'd.
- Production (Webglobe SFTP): `concierge-assets/` is a **brand-new**
  subfolder, so needed the documented two-step `sftp mkdir` +
  `scp -r .../* ...` dance (see the gotcha below); the 27
  already-existing-folder files (26 HTML + `concierge-launcher.js`) went
  up as one plain multi-file `scp`. User ran both commands themselves in
  their own terminal per the standing password rule. Verified live via
  `curl` (same checks as staging) **and** a real in-browser click on
  `https://virtuse.com/index.html` — bubble → overlay → iframe loaded
  `https://virtuse.com/concierge.html?utm_medium=launcher`, no new
  console errors.

**A recurring, unrelated console error, confirmed pre-existing and out
of scope:** every page (before and after this session's changes) throws
a CSP `img-src` violation for `google.sk/ads/ga-audiences` — a GTM
Google Ads remarketing pixel the site's CSP `img-src` allowlist doesn't
cover. Confirmed via a clean fresh-tab load with zero interaction that
this fires with or without any Concierge code present — **not**
something this session introduced, and not in scope to fix here.

**Same-day follow-up — Concierge now recommends only real partners,
with real affiliate links (`428bfd5`):** the user explicitly asked to
drop the constraint above ("don't touch the routing logic") and fix a
real problem it had been hiding — `src/lib/concierge.ts`'s `PARTNERS`
catalog was **entirely invented**. Names like "Banxa", "MiCA-licensed
CASPs", "Unchained", "Coinfirm", "Virtuse Treasury", "Virtuse Bots", and
"Vetted mining partners" don't exist as cards on any virtuse.com page,
and every one of their `url` fields pointed back to a generic
`virtuse.com/` page instead of an actual partner. Fixed by throwing out
the whole catalog and rebuilding it from the **actual partner cards**
on `buy-bitcoin.html`, `secure.html`, `tax.html`, `treasury.html`,
`lending.html`, `bots.html`, and `mining.html` — 22 real partners, each
with the real, currently-live affiliate/referral URL scraped straight
from that page's own `<a href>` (e.g. Kraken →
`proinvite.kraken.com/9f1e/lj72d37e`, Firefish →
`app.firefish.io/auth/sign-up?ref=virtuseloan`). `recommend()` was
rewritten around this real catalog, keeping the same
country/experience/custody/amount-driven structure but grounding every
`reasons` string in that partner's actual page copy instead of invented
claims. The `'earn'` goal itself got relabeled ("Automate & compound" /
"Non-custodial trading & DCA bots") because the site has no
lending-for-yield partner to route to — only the three bots.html
partners (Coinrule, Cryptohopper, RevenueBot) — and the old "Lend EUR /
USDC, up to ~15% p.a." copy would have been actively false advertising
once wired to those. **The governing rule now, worth repeating for any
future partner-catalog edit:** every `Partner.url` must be either that
partner's real affiliate/referral link (preferred) or, only if no
affiliate link exists for that partner, their plain site — never a
virtuse.com URL, and never a partner that doesn't have a real card on
the site. `withUtm()` (unchanged) appends Virtuse's own UTM params onto
whichever of those it is via `URLSearchParams.set`, which additively
preserves the partner's own tracking param (`?ref=...`, `?code=...`,
`?fpr=...` etc.) rather than overwriting it — verified end-to-end on
production: a real loan-flow click landed on
`app.firefish.io/auth/sign-up?ref=virtuseloan&utm_source=concierge&...`,
both tracking systems intact.

Also fixed in the same commit, per the user's explicit copy requests:
- Removed the word "prototype" everywhere it was user-facing (the
  header subtitle badge and the chat widget's badge) — it only remains
  in code comments/dev docs now.
- `Home.tsx`'s intro paragraph now ends after "...routes you to the
  right regulated platform." — dropped the trailing "This is the Phase
  1 MVP of the Virtuse Layer 2 AI Advisor." sentence.
- `Home.tsx`'s page footer now reads only "Routing engine is
  rule-based — a production version plugs in a conversational agent
  over the same data and guardrails. Educational routing only; not
  financial, tax or legal advice. KYC & onboarding are completed on
  each partner's regulated platform." — dropped the "Prototype of the
  Virtuse Layer 2 AI Advisor (Phase 1 · Module 1)." lead-in. (The chat
  widget's own short disclaimer strip — "Non-custodial routing only...
  Not financial advice." — is a separate, shorter string and was left
  as-is; only the page-level footer matched what was asked to change.)
- All partner-count displays ("Routes to N vetted partners", the STATS
  tile, the "Partner ecosystem" pill list) are now derived from
  `PARTNERS.length` / `PARTNERS` itself rather than hardcoded numbers —
  they read **22** now and can't silently drift out of sync with the
  catalog again the way the old hardcoded "11" did.

Rebuilt and redeployed to all three targets same-day: `main` (`428bfd5`),
`gh-pages`/staging (`facdd73`, `curl`-verified live), production (plain
`scp` of `concierge.html` + the two new hashed asset files, **plus** an
`sftp` cleanup step to delete the two now-orphaned old hashed files —
unlike the first Concierge deploy, `concierge-assets/` already existed
on production this time, so no `mkdir` dance was needed, just a
same-folder update). Verified live on `virtuse.com` itself with a real
chat flow (Bitcoin-backed loan → Slovakia → hodler → self-custody →
€1–10k → Firefish), confirming the real affiliate link with both
tracking params intact, and a clean console (same pre-existing GTM
`ga-audiences` pixel error as always, nothing new).

**Next steps, in order:**
1. **Marketing/SEO review of `concierge.html`** — right now it's
   `noindex`. Once approved, remove that and add it (plus reciprocal
   `hreflang`/sitemap entries once translated) the way other pages are
   registered.
2. **Decide on `sk`/`uk`/`cs` rollout for the launcher + dedicated
   page** — explicitly out of scope this session (2026-09-08 decision,
   made via the same kind of question this file's Slovak/Ukrainian/
   Czech rollout sessions used). Would need: translated launcher
   tooltip copy, a translated `concierge.html` (or an explicit decision
   to keep it English-only and just link out from translated pages), and
   updates to `i18n-tools/` scaffold scripts if it's to follow the
   established per-language rollout pattern.
3. **No human marketing/compliance review yet of the routing
   *reasoning* itself** — the partner *catalog* is now accurate (see
   above), but nobody with domain expertise has checked whether e.g.
   routing a self-custody hodler to Invity over Kraken, or a "new to
   Bitcoin" earn-goal visitor to Cryptohopper over Coinrule, is actually
   the right call. Worth a pass before treating the matching logic
   itself as final, same caution as the Slovak welcome email's
   untouched-since-launch status below.
4. **`concierge-assets/`'s hashed filenames need manual upkeep** — there
   is no build/deploy automation wiring the external prototype repo to
   this one. A future prototype change means: rebuild there, copy the
   two new hashed files here, delete the old ones (both locally and on
   every deployed target — production still needs an explicit `sftp rm`
   of the orphaned pair, `scp` alone won't remove them), and hand-edit
   the two `src=`/`href=` lines in `concierge.html`. Easy to forget one
   of these steps; verify with a browser console check (blank white
   panel = the asset paths are stale) rather than assuming a copy
   succeeded.
5. **If the prototype's source is ever regenerated from a fresh Cowork/
   Kimi handoff**, both this session's fixes need re-applying by hand:
   the `react-router` `path="*"` fix (item 1 in the bug list above) and
   the entire real-partner `PARTNERS`/`recommend()` rewrite — a fresh
   handoff would very likely regenerate the same kind of invented
   catalog, since nothing about *that* mistake was specific to this one
   prototype run.

**New gotchas to add to the running list below:**
- The `Kimi_Agent_Virtuse MiCA Partners/` folder name is genuinely
  `%20`-literal on disk (not a display artifact) — `cd "Kimi_Agent_Virtuse
  MiCA Partners"` (real spaces) fails with "no such file or directory";
  the actual path segment is `Kimi_Agent_Virtuse%20MiCA%20Partners`.
  This was already documented below ("the folder name is
  percent-encoded on disk") but got missed when handing the user a
  copy-pasteable `cd` command this session — prefer telling the user
  they're likely already inside it (shells commonly start a session
  there) over asking them to `cd` into a re-typed path.
- A `git worktree` created earlier in a session can disappear from under
  you **mid-session** (not just between sessions) if it lives under a
  scratchpad/tmp path that gets cleaned up — `git worktree list` showed
  it as `prunable` and `cd` into it failed outright the second time it
  was needed the same day. Fix is the same as the between-sessions
  case: `git worktree prune`, then `git worktree add` it again fresh —
  just don't assume a worktree you set up 20 minutes ago in *this*
  session is still there without checking.

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

**Added: `partnerships/` — partner discount outreach templates +
contact list.** Not site code, not deployed anywhere — reference
material for the business side. See "Content pipeline" below for what's
in it; the short version is email templates for asking Buy Bitcoin/
Mining/other partners to add a Virtuse-exclusive discount, plus a
researched (not verified by actually contacting anyone) contact list for
the 7 Buy Bitcoin/Mining partners. Its own top note is worth repeating
here: **every one of those partners already has a live referral
relationship with Virtuse** (the tracked links already on
`buy-bitcoin.html`/`mining.html`), so the existing affiliate portal/
account manager is almost always a better contact than the public
addresses in the file.

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

**Layer 2 modules**: four small rule-based/calculator tools, each a
dedicated static page reachable directly or via deep-links from
Bitcoin Concierge's result cards — **Bitcoin Concierge**
([`concierge.html`](Kimi_Agent_Virtuse%20MiCA%20Partners/concierge.html),
live sitewide since 2026-09-08, plus a sticky launcher bubble
([`concierge-launcher.js`](Kimi_Agent_Virtuse%20MiCA%20Partners/concierge-launcher.js))
on every EN top-level page and hero/banner CTAs on the homepage),
**Stacking Strategist**
([`stacking.html`](Kimi_Agent_Virtuse%20MiCA%20Partners/stacking.html),
DCA projection + fee arbitrage, live since 2026-09-09, plus a homepage
widget and a Buy Bitcoin "step 0" section), **Loan & Liquidity Copilot**
([`loan.html`](Kimi_Agent_Virtuse%20MiCA%20Partners/loan.html),
sell-vs-borrow calculator, live since 2026-09-09), and **Tax &
Inheritance Agent**
([`tax-agent.html`](Kimi_Agent_Virtuse%20MiCA%20Partners/tax-agent.html)
— note the `-agent` suffix: `tax.html` itself is the real, separate
"Bitcoin Tax Reporting" category page, live since 2026-09-09). All four
are `noindex` (not yet marketing/SEO-reviewed) and English-only. Their
shared source (a separate React/Vite project building all four as
independent Vite entries) lives **outside this repo** at
`~/Documents/virtuse-concierge-deploy/bitcoin-concierge/` — only the
production build output (`concierge-assets/`, shared across all four
pages) is committed here. See the 2026-09-08 and 2026-09-09 session
statuses above for the full rollout history, the bugs found along the
way (including a near-miss where a new module's build almost overwrote
the real `tax.html`), and what a future prototype rebuild needs to
repeat.

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

## Partner outreach

`partnerships/` — business reference material, not site code, not
deployed anywhere:
- [`partner-discount-outreach.md`](partnerships/partner-discount-outreach.md) —
  strategy notes + email templates for asking partners to add a
  promotional discount for Virtuse-referred clients, to support sales.
  Buy Bitcoin, Mining, and a general-purpose variant for other verticals
  (lending, custody, tax, treasury, bots).
- [`partner-contacts.md`](partnerships/partner-contacts.md) — public
  contact points for the 7 Buy Bitcoin/Mining partners, gathered from
  each company's own site 2026-09-02 (not third-party scraper databases,
  which are often stale), with a confidence rating per entry. **Not
  verified by actually contacting anyone**, and will drift out of date —
  re-check before relying on it if it's been a while. Its own top note,
  worth repeating: every one of those 7 partners already has a live
  referral relationship with Virtuse (the tracked links already on
  `buy-bitcoin.html`/`mining.html`), so an existing affiliate portal or
  account manager is almost always a better contact than the public
  addresses in the file.

## Git & GitHub workflow

The root of this folder (`Virtu AI`) is a git repo with `origin` set to `https://github.com/Virtuseeee/Virtuse-5.0.git`. `setup_git_sync.sh` is a one-time helper for initializing/syncing a fresh copy of this folder to that same remote (git init, remote add, fetch/merge, commit, push) — it is not part of the site itself.

Rules for working with GitHub in this repo:

- **Auth**: HTTPS with a classic personal access token (`repo` scope) stored in macOS Keychain (`credential.helper=osxkeychain`). If a push/fetch fails with 401/403, the token is missing or invalid — the user must re-enter it interactively in Terminal (`git push` will prompt); never paste tokens into chat, files, or commit history.
- **Branching**: for reviewable changes, branch off `main` (`feat/...`, `fix/...`), push the branch, and open a PR into `main`. Direct commits to `main` are acceptable for routine content syncs of this folder (it is a content mirror, not a collaborative codebase).
- **Commits**: one logical change per commit; message says what changed and why. Since pages duplicate their own `<style>`/nav blocks, a cross-page edit (e.g. nav link change) belongs in a single commit touching all affected pages.
- **Before committing**: run `git status` and review anything staged that you didn't deliberately edit; never commit credentials, tokens, or `.claude/settings.local.json` (gitignored). OneDrive syncs this folder — commit only intentional changes, not sync artifacts like `.DS_Store`.
- **Sync cadence**: after a work session that changes site files, commit and push so GitHub stays the source of truth for deployments.
