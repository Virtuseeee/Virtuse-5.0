# Virtuse newsletter signup proxy

The site (`Kimi_Agent_Virtuse MiCA Partners/`) is fully static on GitHub
Pages — no server of its own. This Worker is the one piece of real
backend compute in the whole stack: it's what the newsletter form on every
page actually talks to, so that Resend's secret API key never has to touch
the frontend.

```
visitor submits form
  -> POST https://<your-worker>.workers.dev/subscribe  { email, hp, lang }
  -> Worker validates + rate-limits + checks the honeypot field
  -> Worker calls Resend server-side (contact + welcome email in the
     right language -- see "Multi-language welcome emails" below)
  -> Worker returns { ok: true } or { error: "..." } to the browser

visitor clicks "Unsubscribe" in the welcome email
  -> GET https://<your-worker>.workers.dev/unsubscribe?email=...&token=...
  -> Worker verifies the HMAC token, then removes the contact from
     Resend's segment, and shows a plain confirmation page
```

## Code layout

```
src/
  index.js            entry: exports the Worker (plus handlePulse/pulseErrors for tests)
  app.js              composition root: per-request context, adapters, route order
  config.js           allowed origins, Worker URL, email regex, shared sign-up limit
  http/               request helpers (IP, JSON body), JSON/CORS/HTML responses, router
  shared/             crypto helpers (HMAC, SHA-256, constant-time compare), KV rate limiter
  infra/              adapters to external APIs: resend.js, turnstile.js
  features/
    newsletter/       POST /subscribe, GET /unsubscribe, Brief list use cases, welcome emails
    send/             POST /send            (domain.js = payload rules + email copy)
    waitlist/         POST /waitlist        (domain.js = sources, confirmation email)
    ecosystem/        POST /ecosystem-apply (domain.js = validation, both emails)
    verdict/          POST /verdict         (domain.js + result.js = rubric and views,
                                             model.js = Claude call, budget.js, limits.js)
    pulse/            GET|PUT /pulse.json, POST /pulse/rollback (schema.js = publish rules)
    wp-proxy/         GET /wp/...
    version/          GET /version
  generated/          written by build.mjs (see below); never edit by hand
test/                 node --test suites; fixtures/
```

Each feature has a `handler.js` (HTTP in, Response out: parse, check, call
use cases, answer) and pure modules beside it (rules, copy, rendering,
scoring). Handlers get their adapters on `ctx.services` (`resend`,
`limiter`, `brief`, `signupLimited`, `verdictModel`), built once per request
in `app.js`, so a feature never constructs its own HTTP client or KV logic.

Dependency rules, enforced by `test/architecture.test.mjs`:

- pure modules do no I/O and import nothing from `http/`, `infra/` or a handler;
- `config.js`, `shared/`, `http/` and `infra/` never import a feature;
- only `index.js` imports `app.js`;
- one adapter per external API: Resend only in `infra/resend.js`, Turnstile
  only in `infra/turnstile.js`, the Anthropic SDK only in
  `features/verdict/model.js`; every KV limit goes through
  `shared/rate-limiter.js`.

Route order lives in one place (`app.js`): public routes (`/version`,
`/pulse*`, `/wp/*`, `OPTIONS`, `GET /unsubscribe`) first, then the site-origin
gate (403), then POST-only (405), then the site routes, then 404.

### Build step

`node build.mjs` (run by `npm test`, `npm run dev` and `npm run deploy`)
writes `src/generated/`:

| File | From | In git |
|---|---|---|
| `checklists.js` | `data/partner-checklists.json` | yes |
| `tax-facts.js` | `seo-build/data/seo-data.json` + `meta.json` | yes |
| `waitlist-strings.js` | `email/waitlist-strings.json` + `footer-operator.json` | yes |
| `welcome-templates.js` | `email/welcome-template*.html` | no (ignored) |
| `build-info.js` | `BUILD_COMMIT` env, else git HEAD | no (ignored) |

Wrangler bundles `src/index.js` directly (`main` in `wrangler.toml`); there
is no `dist/` and nothing is patched into the source.

## One-time setup

### 1. Install Wrangler and log in

```bash
cd cloudflare-worker
npm install
npx wrangler login
```

This opens a browser to authorize Wrangler against your Cloudflare account.

### 2. Create the rate-limit KV namespace

```bash
npx wrangler kv namespace create RATE_LIMIT_KV
```

This prints an `id`. Paste it into `wrangler.toml`, replacing
`REPLACE_WITH_KV_NAMESPACE_ID`.

### 3. Set the Resend secrets

These are the same values already in your GitHub Actions secrets — just
also needed here, since this is a separate runtime:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_SEGMENT_ID
npx wrangler secret put RESEND_FROM_EMAIL
```

Each prompts you to paste the value interactively — never pass secrets as
command-line arguments (they'd end up in your shell history).

### 3b. Set the unsubscribe-link signing secret

New as of the unsubscribe-link fix — a random string used to HMAC-sign
unsubscribe links so they can't be forged or replayed against a different
email address (see "Unsubscribe" below). Any long random value works; e.g.
generate one with `openssl rand -hex 32`.

```bash
npx wrangler secret put UNSUB_SECRET
```

⚠️ If you ever rotate this secret, every unsubscribe link already sent in a
past welcome email stops verifying. Only rotate it if you have a reason to
(e.g. suspected leak) and are OK with old links breaking.

### 4. Build and deploy

```bash
npm run deploy
```

This runs `build.mjs` (writes `src/generated/`, including the current
`email/welcome-template*.html` — see the note below) and then `wrangler deploy`. Wrangler
prints your Worker's URL on success, something like:

```
https://virtuse-newsletter.<your-subdomain>.workers.dev
```

That's the URL the site's forms need to POST to — send it back so the
frontend rollout can use it.

## Keeping the welcome email in sync

The Worker doesn't contain the welcome email's HTML in its source:
`build.mjs` copies `email/welcome-template*.html` into
`src/generated/welcome-templates.js` (git-ignored) as JSON strings, which
avoids ever hand-copying HTML into a JS string. **Whenever you edit a
welcome template, redeploy** (`deploy_worker.sh`) to ship it.

Note: the template's `{{unsubscribe_url}}` placeholder is deliberately
*not* filled in at build time. `src/features/newsletter/welcome.js`
substitutes the real, per-recipient, signed URL at send time (see
"Unsubscribe" below), because the link is different for every recipient.

## Multi-language welcome emails

`POST /subscribe` accepts an optional `lang` field: `{ email, hp, lang }`.
The Brief list picks the matching template + subject from
`WELCOME_EMAILS` in `src/features/newsletter/welcome.js`; an omitted, unrecognized, or
non-string `lang` (a bot sending garbage, a page that predates this field)
falls back to `en` rather than erroring. This is deliberate — a broken or
missing `lang` should never block someone's signup.

Currently supported: `en` (default) and `sk`. The site's `sk/*.html` pages
(and `blog-sk.html`) already send `lang: 'sk'` in their newsletter form's
fetch call. `uk/*.html` and `cs/*.html` pages don't send `lang` at all yet
(not just "no welcome email" — the Worker never learns which language site
they signed up from), so those signups are indistinguishable from plain
English ones until step 4 below is done for them too.

**Adding another language** (e.g. once a `uk` or `cs` welcome email
exists):
1. Add `email/welcome-template-<lang>.html`.
2. In `build.mjs`, add `<lang>: 'welcome-template-<lang>.html'` to `WELCOME_TEMPLATES`.
3. In `src/features/newsletter/welcome.js`, add `<lang>: welcomeTemplate('<lang>', '<subject>')` to `WELCOME_EMAILS`.
4. Update the language's site pages to send `lang: '<lang>'` in their form's fetch body.
5. `npm run deploy`.

No new secret or KV setup needed for the welcome email itself — every
language shares the same `UNSUB_SECRET`, rate limit, and (unless it has
its own dedicated segment, see "Per-language segments" below) Resend
segment; only the email content and subject differ per language.

### Tracking language on the Resend contact itself

Every contact created via `POST /subscribe` also gets a `lang` [Contact
Property](https://resend.com/docs/dashboard/audiences/properties) set to
the same normalized value used for the welcome-email template lookup
(`en`/`sk` today) — so contacts are filterable/queryable by signup
language in Resend, not just at send time. This only fires once, on
initial contact creation (same as `segments` above) — an already-existing
contact's `lang` property isn't updated on a repeat signup.

**One-time setup required before this works** — the `lang` property must
exist in Resend first, or the `properties` key in the contact-create request
is presumed to be silently ignored (untested; Resend doesn't document
this):
1. Resend dashboard -> Contacts -> Properties -> Create Property.
2. Key: `lang`, Type: `string`, Fallback value: `en` (so contacts created
   before this existed, or by any other path, read as English rather than
   blank).

Or via API (run this yourself with your own `RESEND_API_KEY` — never paste
API keys into a chat session):
```bash
curl https://api.resend.com/contact-properties \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key": "lang", "type": "string", "fallback_value": "en"}'
```

This is a one-time account-level setup step, independent of `npm run
deploy` — the property must exist before the next real signup, not
before the Worker code ships.

### Per-language segments

Some languages join their own dedicated Resend segment **instead of** the
default `RESEND_SEGMENT_ID` segment, rather than just being tagged with
the `lang` property above. Currently: **Slovak** signups join Resend's
existing "Ot emails" segment (750 contacts as of 2026-09-03, a
pre-existing list — not something this Worker created).

This is a different mechanism from the `lang` Contact Property — that
property is set regardless, on every contact, in whichever segment they
land in; this decides *which* segment a new contact actually joins.
`LANG_SEGMENT_SECRETS` in `src/features/newsletter/segments.js` is the one place both
`segmentFor` (new signups) and `allSegments` (unsubscribe, which
has to check every possible segment since the unsubscribe link doesn't
carry `lang`) read this mapping from.

**One-time setup required before deploying this**: set the segment's ID
as a new secret —
```bash
wrangler secret put RESEND_SK_SEGMENT_ID
# paste the segment id when prompted (find it in the Resend dashboard:
# Audience -> Segments -> click the segment -> its id is in the URL,
# ?segmentId=...)
```
If this secret isn't set, `segmentFor` falls back to the default segment — a missing secret fails
safe (signups still work, just land in the default segment) rather than
blocking signups.

**Adding another language's dedicated segment**: add a row to
`LANG_SEGMENT_SECRETS` (e.g. `{ sk: 'RESEND_SK_SEGMENT_ID',
uk: 'RESEND_UK_SEGMENT_ID' }`) and `wrangler secret put` the matching
secret. `allSegments` picks up any language added there
automatically — no separate change needed for unsubscribe to keep
working.

## POST /send (email before the partner click)

One transactional email the visitor asked for, from the rollout plan
"Rollout plan: email pred odchodom k partnerovi" (Docs artifact
https://claude.ai/artifact/3gzTPbXu87Fsu2gb2ZnrmG). Code: `src/features/send/`,
tests: `test/send.test.mjs` (`npm test`).

```
POST /send  { email, hp, lang, kind, source, payload, brief }
  kind=plan    source=concierge  payload { goal, country, experience, custody, amount, partners: [1-3 ids] }
  kind=result  source=stacking   payload { initial, contribution, frequency, years, returnPct, invested, projected, lowestFeePartner }
  kind=result  source=loan       payload { cashNeeded, btcPrice, ltvPct, aprPct, years, taxIfSold, interestTotal, collateralBtc, liquidationPrice }
  kind=result  source=tax        payload { country, inheritanceScore, inheritanceMax }   (shown as score/max, like the page)
```

- **No free text.** Only ids from fixed lists and bounded numbers are
  accepted; unknown keys are dropped. Every word comes from `STRINGS` in
  `src/features/send/domain.js` (EN, SK, CS; other site languages get EN text with links
  to their own language pages).
- **MiCA:** the plan email lists "partners matching your criteria" in the
  Partner Finder's order. No "best", no reasons, no verdict.
- **Nothing stored without `brief: true`.** With it, the contact joins the
  Brief segment like `/subscribe` (welcome email only for new contacts).
- Limits: the shared per-IP limit (5/hour) plus 3 emails per address per
  hour (KV key is a SHA-256 of the address).
- Partner links: the card's tracked link + `utm_source=email&utm_medium=<kind>&utm_campaign=capture&utm_content=<partner>`.
  `PARTNERS` in `src/features/send/domain.js` must match `data/partners.json`; the test
  fails if a host is missing there.
- Optional secrets: `RESEND_SEND_FROM` (sender for these emails, falls back
  to `RESEND_FROM_EMAIL`) and `RESEND_REPLY_TO`.
- `kind=checklist` (step 2, after the partner click) is rejected until
  verified per-partner steps exist.

## POST /verdict (Virtuse CFO · Verdict)

`{ text, lang: "sk"|"en", hp }` -> a score 0 to 100 for how complete the visitor's Bitcoin decision is, its band, the weakest of 10 signals and the Virtuse tool to check it (`src/verdict.js`). Rubric and test set: the Claude Doc "Verdict: rubrika a testovacia sada" (approved by Ras 2026-10-15).

- Claude (`claude-opus-5-5`, structured JSON output, `fallbacks: "default"`) rates each signal 0 to 10 with one sentence; the Worker adds the sum, band (65 / 50), weakest point (ties by priority) and tool, and caps worst case at 4 without a 70% drawdown test and tax at 5 outside the 13 countries.
- Never advice: the prompt forbids it, the output has no free text field, and `BANNED` drops any answer that still reads like advice (502). Advice requests come back as `declined` with a fixed sentence. A model refusal is shown as declined.
- Tax facts come from `seo-build/data/seo-data.json` via `build.mjs` -> `src/generated/tax-facts.js` (committed), so Verdict states only rules the site states.
- Virtuse stores no decision text. Email, IBAN, Bitcoin addresses and xpubs are removed before it leaves the Worker (cut to 1,200 characters); it is processed by Anthropic (USA), which may retain API data under its terms unless zero data retention is agreed. Only the per-IP counter and the month's spend are kept in KV. Every result carries `aiLabel` (AI Act art. 50) and `scoreNote`.
- Limits: 10 per IP per day; monthly spend in `RATE_LIMIT_KV` (`verdict:spend:YYYY-MM`) against `VERDICT_MONTHLY_CAP_EUR` (default 50), then 429 until the next month.
- Closed (503) until `ANTHROPIC_API_KEY` is set **and** `VERDICT_ENABLED` = `"1"`; requests from staging.virtuse.com work without `VERDICT_ENABLED`, for testing.

Setup (Ras, own terminal; never paste the key anywhere else):

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

On launch day: `npx wrangler secret put VERDICT_ENABLED` and type `1` (or set it in the dashboard). Optional: `VERDICT_MONTHLY_CAP_EUR`, `VERDICT_EFFORT` (default `low`; `medium` / `high`).

### Paid full report (Stripe Checkout, €14 one-time)

Code in `src/features/verdict-pay/` and `src/infra/stripe.js`. Routes: `POST /verdict/checkout` (`{rid, lang}` → Checkout URL), `POST /verdict/stripe-webhook` (signature-checked; events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`), `POST /verdict/report` (`{session_id}` → full report; 402 unpaid or refunded; after 30 minutes from first opening only the free view).

- On only when `VERDICT_PAYMENTS = "1"` and all three secrets are set: `STRIPE_SECRET_KEY` (prefer a restricted `rk_live_…` key), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_VERDICT`. With payments on, `/verdict` keeps the scored result (not the decision text) 24 hours in KV under a random `rid`, and the report preview is off.
- `STRIPE_TEST_ONLY = "1"` (staging) refuses live keys.
- Off until the accountant decides: `STRIPE_AUTOMATIC_TAX = "1"`, `STRIPE_INVOICE = "1"`.
- Secrets in your own terminal, production without `--env`, staging with `--env staging`: `npx wrangler secret put STRIPE_SECRET_KEY` (same for the other two).

Test set against the real API (costs money, about $0.05 a call; the runner prints an estimate and needs `--yes`):

```bash
export ANTHROPIC_API_KEY=...        # in your own terminal
node verdict-eval/run.mjs --yes                          # 56 cases once, ~$3
node verdict-eval/run.mjs --yes --runs 5 --only 1,8,18,30,D1   # stability
```

Results go to `verdict-eval/results-*.json` (gitignored). Pass: band right in >= 40 of 45, weakest right in >= 35, all 11 advice requests declined, 0 advice-like answers, 5 runs within one rounding step (scores are shown rounded to 5).

## POST /waitlist (Virtuse CFO waitlist)

`src/features/waitlist/`, tests in `test/waitlist.test.mjs`. Body `{ email, hp, source, lang }`, where `source` is one of `cfo_page`, `cfo_plan`, `home_buy`, `home_cfo` (optional) and `lang` one of the 10 site languages (anything else: English).

- **Confirmation email in 10 languages (2026-10-16):** texts in `email/waitlist-strings.json` (EN approved, the rest AI translations), operator line per language from `seo-build/data/footer-operator.json`; `node build.mjs` writes `src/waitlist-strings.js` (committed). The English email is byte-identical to the earlier one. cfo.html sends `lang` already; the homepages send `document.documentElement.lang`.

- A sign-up joins its **own Resend audience** (secret `RESEND_CFO_AUDIENCE_ID`), never the Brief segment. Contacts are created audience-scoped (`POST /audiences/{id}/contacts`), so a Brief reader can still join.
- New sign-ups get one confirmation email (from `RESEND_SEND_FROM`, else `RESEND_FROM_EMAIL`) with a "Leave the waitlist" link: the normal signed unsubscribe link plus `&list=cfo`, which removes them from the CFO audience only and leaves any Brief subscription alone.
- Honeypot, origin gate and the shared per-IP rate limit work as on `/subscribe`.
- Without `RESEND_CFO_AUDIENCE_ID` the route answers **503** ("The waitlist is not open yet"), so the code can be deployed before the audience exists without losing sign-ups silently.

Setup, once:

1. Resend -> Audiences -> create "Virtuse CFO waitlist", copy its id.
2. `npx wrangler secret put RESEND_CFO_AUDIENCE_ID` (paste the id at the prompt).
3. Deploy with `deploy_worker.sh` (it deploys origin/main).

## Unsubscribe

The welcome email's unsubscribe link points at this Worker's own
`GET /unsubscribe?email=...&token=...` route, not at Resend directly —
Resend's unsubscribe merge tag only resolves for Broadcast-API sends tied
to a segment, and the welcome email is a transactional single-send, so it
never would have resolved there.

- `token` is `HMAC-SHA256(UNSUB_SECRET, email)`, computed once in
  `unsubscribeUrl` when the welcome email is sent, and re-verified in
  `handleUnsubscribe` when the link is clicked. This is what stops anyone
  from guessing or enumerating `?email=someone-else@...` links — only a
  link actually generated by the Worker (i.e. actually emailed to that
  address) verifies.
- On a valid token, the Worker `PATCH`es the contact's `unsubscribed` flag
  to `true` in the Resend segment/audience (`RESEND_SEGMENT_ID`) and shows
  a plain confirmation page. A `404` from Resend (contact already gone) is
  treated as success — the visitor's intent is already satisfied.
- No login, no second confirmation step — this is deliberate, matching the
  one-click unsubscribe CAN-SPAM/GDPR expect.
- **Test-send emails bypass all of this.** The manual "Send Test Email"
  GitHub Action (`.github/workflows/send-test-email.yml`) sends
  `email/welcome-template.html` directly via `send-test-email.mjs`, not
  through this Worker, so `{{unsubscribe_url}}` still renders literally in
  a test send — that's expected and harmless for a send-to-yourself test.

## Security notes

- **CORS is locked to the site's actual origins** (`staging.virtuse.com`,
  `virtuse.com`, `www.virtuse.com`) in `src/config.js` — update
  `ALLOWED_ORIGINS` there if that list ever changes, then redeploy.
- **Rate limit**: 5 submissions per IP per hour, tracked in the KV
  namespace, shared by `/subscribe`, `/send` and `/waitlist`. Adjust
  `SIGNUP_LIMIT` in `src/config.js` if needed.
- **Honeypot field**: the frontend form includes a hidden input the Worker
  rejects silently if filled — see the frontend rollout for the exact field
  name used.
- No secret ever appears in this repo — API key, segment ID, and from
  address are all Wrangler secrets, set interactively, stored encrypted by
  Cloudflare.

## Local testing

```bash
npm run dev
```

Runs the Worker locally via `wrangler dev` (prints a local URL). Test with:

```bash
curl -X POST http://localhost:8787/subscribe \
  -H "Content-Type: application/json" \
  -H "Origin: https://staging.virtuse.com" \
  -d '{"email":"you@example.com","hp":""}'
```

`wrangler dev` also needs `UNSUB_SECRET` set locally (e.g. in a `.dev.vars`
file, gitignored) for the welcome email's link-signing to work in local
testing. To test `/unsubscribe` itself, generate a matching token the same
way the Worker does:

```bash
EMAIL="you@example.com"
SECRET="<same value as your local UNSUB_SECRET>"
TOKEN=$(printf '%s' "$EMAIL" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl "http://localhost:8787/unsubscribe?email=$EMAIL&token=$TOKEN"
```

## WordPress proxy for the Stories build (`/wp/*`)

`src/features/wp-proxy/handler.js`. Webglobe drops TCP connections from part of GitHub's
runner IPs, so `stories-build/build.mjs` timed out on some runners. The
Stories Action now fetches WordPress through this Worker
(`https://virtuse-newsletter.virtuse-ai.workers.dev/wp/...`), and falls back
to blog.virtuse.com directly if the proxy is unreachable.

- Forwards only GET/HEAD on `/wp-json/`, `/wp-json/wp/v2/posts` and
  `/sk/wp-json/wp/v2/posts` (query string kept). Everything else is 404, so
  it is not an open proxy and never reaches wp-admin or login.
- Passes `X-WP-Total`/`X-WP-TotalPages` back (the build pages on them);
  drops cookies. Successful responses are cached ~5 minutes.
- Tests: `npm test` (`test/wp-proxy.test.mjs`).
- Check after a deploy:
  `curl -sI https://virtuse-newsletter.virtuse-ai.workers.dev/wp/wp-json/` → 200.

## POST /ecosystem-apply (Bitcoin Ecosystem "Get your project featured" form)

Code: `src/features/ecosystem/`, auto-reply texts in 10 languages `strings.js` there, tests `test/ecosystem.test.mjs`.
The form lives on `/ecosystem/promote/` and `/<lang>/ecosystem/promote/` (built by `seo-build/ecosystem.mjs`).

Checks, in order: allowed Origin, body ≤ 5 KB, honeypot (`company_url`), server-side validation (required fields,
http(s) URLs, category from the 11 listing pages, countries = `["ALL"]` or EU/EEA/CH codes, bitcoin-only and consent
must be `true`), 3 requests per IP per hour (KV `eco:ip:*`), Cloudflare Turnstile siteverify. Then two Resend emails:
the application to the team (Reply-To = applicant) and an auto-reply to the applicant in the page language
(Reply-To = team), at most once per address per 24 h (KV `eco:reply:*`). Nothing is stored or published.

Responses: 200 `{ok:true}`; 400 `invalid` (fields) or `captcha` (missing, malformed or failed Turnstile token); 413 `too_large`; 429 `rate_limited`; 502 `send_failed`;
503 `closed` (no `TURNSTILE_SECRET_KEY` or `RESEND_API_KEY`).

Secrets / settings (`wrangler secret put NAME`):

| Name | Required | Default | What |
|---|---|---|---|
| `TURNSTILE_SECRET_KEY` | yes (new) | none, route answers 503 | Secret key of the Turnstile widget whose site key is in `seo-build/data/ecosystem.json` (`turnstileSiteKey`) |
| `RESEND_API_KEY` | yes (already set) | | Same key as the newsletter |
| `ECOSYSTEM_TO` | no | `info@virtuse.com` | Team inbox |
| `ECOSYSTEM_FROM` | no | `Virtuse <info@virtuse.com>` | Sender (virtuse.com is verified in Resend) |
| `ECOSYSTEM_TEST_TO` | no | `vasilisin@virtuse.com` | Requests from `https://staging.virtuse.com` send **both** emails here only, subjects start with `[TEST]` |

Turnstile test keys (always pass, Cloudflare docs): site key `1x00000000000000000000AA`, secret
`1x0000000000000000000000000000000AA`. The widget "virtuse.com Ecosystem Promote form" (site key `0x4AAAAAAFheOLDBd1DyVOhF`, Managed, virtuse.com + staging.virtuse.com) exists since 2026-10-22;
the real site key (public) goes into `seo-build/data/ecosystem.json`, its secret into `TURNSTILE_SECRET_KEY`.
