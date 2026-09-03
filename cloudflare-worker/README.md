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

This runs `build.mjs` (embeds the current `email/welcome-template.html`
into the bundle — see the note below) and then `wrangler deploy`. Wrangler
prints your Worker's URL on success, something like:

```
https://virtuse-newsletter.<your-subdomain>.workers.dev
```

That's the URL the site's forms need to POST to — send it back so the
frontend rollout can use it.

## Keeping the welcome email in sync

`src/index.js` doesn't contain the welcome email's HTML directly — it has a
placeholder that `build.mjs` fills in from `email/welcome-template.html` at
build time (this avoids ever hand-copying HTML into a JS string, which is
exactly the kind of thing that silently drifts out of sync or breaks on a
stray backtick). **Whenever you edit `email/welcome-template.html`, re-run
`npm run deploy`** to ship the updated version to the Worker. `dist/worker.js`
is a build artifact — it's gitignored, never edit it directly, and never
deploy `src/index.js` as-is (it still has the literal placeholder text).

Note: the template's `{{unsubscribe_url}}` placeholder is deliberately
*not* filled in at build time — it's still literal in `dist/worker.js`.
`sendWelcomeEmail` in `src/index.js` substitutes the real, per-recipient,
signed URL at send time instead (see "Unsubscribe" below), because the
link has to be different for every recipient.

## Multi-language welcome emails

`POST /subscribe` accepts an optional `lang` field: `{ email, hp, lang }`.
`sendWelcomeEmail` picks the matching template + subject from
`WELCOME_EMAIL_TEMPLATES` in `src/index.js`; an omitted, unrecognized, or
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
2. In `build.mjs`, add a `{ file: 'welcome-template-<lang>.html', placeholder: '"__WELCOME_EMAIL_HTML_<LANG>__"' }` row to `TEMPLATES`.
3. In `src/index.js`, add `const WELCOME_EMAIL_HTML_<LANG> = "__WELCOME_EMAIL_HTML_<LANG>__";` near the bottom, and a matching `<lang>: { html: () => WELCOME_EMAIL_HTML_<LANG>, subject: '...' }` row to `WELCOME_EMAIL_TEMPLATES`.
4. Update the language's site pages to send `lang: '<lang>'` in their form's fetch body.
5. `npm run deploy`.

No new secret or KV setup needed — every language shares the same
`UNSUB_SECRET`, rate limit, and Resend segment; only the email content and
subject differ per language.

### Tracking language on the Resend contact itself

Every contact created via `POST /subscribe` also gets a `lang` [Contact
Property](https://resend.com/docs/dashboard/audiences/properties) set to
the same normalized value used for the welcome-email template lookup
(`en`/`sk` today) — so contacts are filterable/queryable by signup
language in Resend, not just at send time. This only fires once, on
initial contact creation (same as `segments` above) — an already-existing
contact's `lang` property isn't updated on a repeat signup.

**One-time setup required before this works** — the `lang` property must
exist in Resend first, or the `properties` key in `addContact`'s request
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

## Unsubscribe

The welcome email's unsubscribe link points at this Worker's own
`GET /unsubscribe?email=...&token=...` route, not at Resend directly —
Resend's unsubscribe merge tag only resolves for Broadcast-API sends tied
to a segment, and the welcome email is a transactional single-send, so it
never would have resolved there.

- `token` is `HMAC-SHA256(UNSUB_SECRET, email)`, computed once in
  `buildUnsubscribeUrl` when the welcome email is sent, and re-verified in
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
  `virtuse.com`, `www.virtuse.com`) in `src/index.js` — update
  `ALLOWED_ORIGINS` there if that list ever changes, then redeploy.
- **Rate limit**: 5 submissions per IP per hour, tracked in the KV
  namespace. Adjust `RATE_LIMIT_MAX_PER_HOUR` in `src/index.js` if needed.
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
