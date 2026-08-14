# Virtuse newsletter signup proxy

The site (`Kimi_Agent_Virtuse MiCA Partners/`) is fully static on GitHub
Pages — no server of its own. This Worker is the one piece of real
backend compute in the whole stack: it's what the newsletter form on every
page actually talks to, so that Resend's secret API key never has to touch
the frontend.

```
visitor submits form
  -> POST https://<your-worker>.workers.dev/subscribe  { email, hp }
  -> Worker validates + rate-limits + checks the honeypot field
  -> Worker calls Resend server-side (contact + welcome email)
  -> Worker returns { ok: true } or { error: "..." } to the browser
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
