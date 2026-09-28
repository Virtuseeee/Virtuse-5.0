# Brief Pulse JSON on the newsletter Worker

`GET /pulse.json` on the existing `virtuse-newsletter` Worker serves the
daily Virtuse Brief pulse. The page keeps using its local
`news/news-pulse.json` until a later change points it here. This file is
only the Worker side: publish with a bearer token, read with a short
public cache.

Nothing here changes `POST /subscribe` or `GET /unsubscribe`.

Worker URL (already allowed by `news.html` `connect-src`):

`https://virtuse-newsletter.virtuse-ai.workers.dev`

## One-time setup

Run these on a machine where Wrangler is logged into the Virtuse
Cloudflare account (`npx wrangler login` from this directory if it is
not). The KV namespace does not exist yet. Do not deploy while
`wrangler.toml` still says `PULSE_KV_ID_PLACEHOLDER` — Wrangler will
reject that id.

```bash
cd cloudflare-worker
npm install

# Prints an id. This is the exact create command:
wrangler kv namespace create PULSE_KV
```

`wrangler` here is the local devDependency. If it is not on your `PATH`,
run the same command as `npx wrangler kv namespace create PULSE_KV`.

Paste the printed id into `cloudflare-worker/wrangler.toml`, replacing
`PULSE_KV_ID_PLACEHOLDER` on the `PULSE_KV` binding:

```toml
[[kv_namespaces]]
binding = "PULSE_KV"
id = "PASTE_THE_PRINTED_ID"
```

Then set the publish secret (it prompts; do not pass the value as an
argument) and deploy. `npm run deploy` is `node build.mjs && wrangler deploy`.
The build step only embeds the welcome-email templates; it must still run
so `dist/worker.js` exists.

```bash
wrangler secret put PULSE_PUBLISH_TOKEN
npm run deploy
```

Generate the token yourself (`openssl rand -hex 32` in your own terminal)
and store it with the box secrets. It is not a Cloudflare account token.
Anyone who has it can replace the pulse text, within the schema below.
Rotate it with the same `wrangler secret put` command.

## What gets stored

| KV key | Contents |
|---|---|
| `current` | Document served by `GET /pulse.json` |
| `previous` | Value of `current` just before the last successful `PUT` |
| `pulse-YYYY-MM-DD` | Copy of that `PUT`, dated from `updated`. TTL 60 days |

`PUT` copies `current` to `previous` only when `current` already exists,
then writes `current` and the dated key. `POST /pulse/rollback` (same
`Authorization: Bearer` header) copies `previous` back onto `current`.
It leaves `previous` in place, so a second rollback is a no-op.

## Schema the PUT handler enforces

Body must be valid JSON of at most 16 KB (16 × 1024 bytes). Otherwise
`400` with `{ "error": "validation failed", "errors": [ ... ] }`.

Checked against `news/news-pulse.json` on `gh-pages` (snapshot in
`fixtures/news-pulse.sample.json`, which the local test accepts):

- `updated`: ISO-8601 UTC timestamp `YYYY-MM-DDTHH:mm:ssZ` (optional
  milliseconds). Not more than 36 hours in the future.
- `market`: object with finite numbers `btc_usd`, `change_24h_pct`,
  `fee_sat_vb`, and non-empty strings `fees` and `sources`.
- `items`: array of 1 to 3. Each item has `title` (1–120 characters),
  `excerpt` (string), `source` (non-empty), `url` (`https://`), `tag`
  one of `ETF`, `Fed`, `Policy`, `Mining`, `Security`, and `published`
  (same ISO UTC form). `title` + `excerpt` must match `/bitcoin|\bbtc\b/i`.
- `archive.items`: the yesterday array, length at most 2. Each entry has
  the same fields as a pulse item except `excerpt` and the Bitcoin check.
- When present: `what_moved` is a string of at most 300 characters;
  `fear_greed.value` is a number from 0 to 100; `dominance.btc_pct` is a
  finite number; `quick_media` has a `title` and an `https` `url`;
  `feed` is a string or `null`.

A successful `PUT` returns `200`:

```json
{ "ok": true, "updated": "...", "items": 3, "yesterday": 2, "bytes": 2807, "datedKey": "pulse-2026-09-26", "ttlDays": 60 }
```

Missing or wrong bearer token: `401` `{ "error": "unauthorized" }`.
The token is compared in constant time (both sides are HMAC-SHA256'd to
a fixed-length digest, then XOR'd). A missing `PULSE_PUBLISH_TOKEN`
secret also fails closed.

`GET` of an empty namespace: `404` `{ "error": "no pulse" }` with
`Cache-Control: no-store`. A stored document is served as the raw JSON
bytes with `Content-Type: application/json; charset=utf-8` and
`Cache-Control: public, max-age=60`. `Access-Control-Allow-Origin` is set
only for `https://virtuse.com`, `https://www.virtuse.com`, and
`https://staging.virtuse.com`. `OPTIONS /pulse.json` is the preflight
for that GET.

KV reads use `cacheTtl: 60`. After a publish, expect up to about a minute
of stale `GET`s.

## Smoke tests

Replace `$TOKEN` with the secret you just set. Do not echo it.

```bash
BASE=https://virtuse-newsletter.virtuse-ai.workers.dev

# GET — 404 JSON until the first publish, then the stored document.
curl -sS -D - "$BASE/pulse.json" -H "Origin: https://virtuse.com"

# PUT — a real draft, or fixtures/news-pulse.sample.json (its `updated`
# is in the past, which is allowed; only a timestamp more than 36 hours
# ahead is rejected).
curl -sS -X PUT "$BASE/pulse.json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @fixtures/news-pulse.sample.json

# GET again — `updated` matches the file you put.
curl -sS "$BASE/pulse.json?t=$(date +%s)"

# Rollback — restores KV `previous` onto `current`.
curl -sS -X POST "$BASE/pulse/rollback" \
  -H "Authorization: Bearer $TOKEN"

# /subscribe is unchanged. OPTIONS from the site origin is 200,
# Allow-Methods POST, OPTIONS. A POST from anywhere else is 403.
curl -sS -D - -o /dev/null -X OPTIONS "$BASE/subscribe" \
  -H "Origin: https://virtuse.com" \
  -H "Access-Control-Request-Method: POST"
```

Local check (no Cloudflare credentials): `npm test` in this directory.
It uses Node's built-in test runner.
