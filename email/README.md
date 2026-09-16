# Virtuse News automation

Automates the **Bitcoin Pulse stats only** (price, dominance, 200-week MA,
100-day EMA) in the recurring Virtuse News email. The headline, article
paragraphs, chart captions, and meme are still human-written each issue
directly in [`virtuse-news-template.html`](virtuse-news-template.html).

Sends via [Resend](https://resend.com).

**2026-09-15: replaces the old "Weekly Virtuse Report" pipeline** (the
`template.html` / `weekly-issue.json` / `weekly-pulse.yml` /
`render-pulse.mjs` / `create-resend-broadcast.mjs` set) — that pipeline ran
weekly from mid-August but its content JSON was never edited past its
placeholder "Issue #1", so every draft it created for ~5 weeks had real
stats around stale, generic story picks. Meanwhile `virtuse-news-template.html`
(a richer, article-first design) existed in parallel as a **test-send-only**
template, never wired to a real broadcast. Both were undocumented until
discovered and consolidated in the same session — see `CLAUDE.md`'s
2026-09-15 session status for the full story. This file now describes the
one surviving pipeline; don't recreate the old one.

## How it fits together

```
.github/workflows/virtuse-news.yml          -- scheduled trigger (Tue 07:00 UTC) + manual trigger
.github/scripts/render-virtuse-news.mjs     -- fetches stats, renders virtuse-news-template.html -> dist/virtuse-news-email.html
.github/scripts/create-virtuse-news-broadcast.mjs -- sends the rendered HTML straight to Resend, creates a draft
email/virtuse-news-template.html            -- the email; {{merge_tags}} for the 4 stat-tile numbers + issue date, everything else hand-edited
email/virtuse-news-issue.json               -- EDIT THIS PER ISSUE: subject line + issue date
email/pulse-cache.json                      -- auto-updated fallback cache, don't edit by hand
```

Resend's `createBroadcast` API takes HTML directly in the request body, so
there's no publish-somewhere-public step in this pipeline.

By default the workflow only creates a **draft** broadcast in Resend —
nothing sends automatically. Review it in Resend and click send yourself.
Once you trust the numbers, you can either trigger the workflow manually
with the `send` input checked, or flip its default to `true` in the
workflow file.

## Writing an issue

Before each Tuesday run (or whenever you trigger the workflow manually):

1. Hand-edit [`virtuse-news-template.html`](virtuse-news-template.html)
   directly: the "This Week in Bitcoin" headline and article paragraphs,
   the "What to watch" line, the Chart of the Week captions/band label, and
   swap the meme image if you have a new one. **Don't touch** `{{issue_date}}`,
   `{{btc_price}}`, `{{btc_dominance}}`, `{{btc_200w_ma}}`, `{{btc_ema_100d}}`
   — those are filled automatically at render time.
2. Edit [`virtuse-news-issue.json`](virtuse-news-issue.json)'s
   `issue_number`, `issue_date`, and `subject`.
3. Commit both to `main` — the workflow reads whatever's on `main` at run
   time.

## One-time setup

### 1. Resend setup

1. **API key**: Resend dashboard → API Keys → Create API Key. Give it
   Sending access (Full access also works).
2. **Segment** (Resend's audience/contact-list container): Dashboard →
   Audiences/Segments → create one for "Virtuse News" subscribers. Copy
   its ID from the URL or the segment's settings page.
3. **Verified sending domain**: Dashboard → Domains → add and verify
   `virtuse.com` (or whichever domain `RESEND_FROM_EMAIL` uses) via the DNS
   records Resend gives you, so mail actually sends and doesn't land in
   spam.
4. **Migrate the existing subscriber list**: your current ~18,000
   subscribers live in Zoho, not Resend — Resend doesn't know about them
   yet. Export them from Zoho as CSV and import into the segment via
   Resend's dashboard (Audiences → Import Contacts). This is a one-time
   manual step, not something this automation does — bulk-importing 18k
   contacts isn't something to script blind without reviewing
   deliverability/consent implications first (re-confirm these contacts
   already double-opted-in under GDPR before re-importing them into a new
   sender).

### 2. Add repo secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | from step 1.1 |
| `RESEND_SEGMENT_ID` | from step 1.2 |
| `RESEND_FROM_EMAIL` | e.g. `Virtuse News <news@virtuse.com>` — must be on the verified domain from step 1.3 |

No user GitHub token is needed — the workflow uses the Action's own scoped
`GITHUB_TOKEN` to push the pulse cache back to `main`, which is why
`permissions: contents: write` is set in the workflow.

## Sending a one-off test to yourself

Actions → **Send Test Email** → Run workflow → enter your own address in
`to`, pick `welcome` or `virtuse-news` in `template`, run. It sends exactly
that one template to exactly that one address via Resend's transactional
`/emails` endpoint -- it never touches the real subscriber segment. Uses the
same `RESEND_API_KEY` / `RESEND_FROM_EMAIL` secrets as the main workflow,
no extra setup needed.

Note: a **test send** via this workflow still shows `{{{RESEND_UNSUBSCRIBE_URL}}}`
as literal, unresolved text -- this tool sends the rendered template file
directly, bypassing the real signup flow entirely. That's expected and
harmless for a send-to-yourself test.

The **real** automated welcome flow is a separate piece of infrastructure:
`cloudflare-worker/` is a Worker that the site's newsletter forms POST to
on every real signup -- it adds the Resend contact, sends this template,
and (unlike this test tool) fills in a real, working, per-recipient
unsubscribe link before sending. See `cloudflare-worker/README.md`'s
"Unsubscribe" section for how that link is generated and verified.

## Testing before the first real send

Run it manually anytime via Actions → Virtuse News → Run workflow, leaving
`send` unchecked. Check the created draft in Resend before ever checking
`send`. Things worth checking on that first draft:

- **Rendering** — open the draft's preview in Resend and confirm it matches
  the template (dark background, orange accents, card layout), not a
  stripped/reflowed import.
- **Stat values** — `{{btc_price}}` / `{{btc_dominance}}` / `{{btc_200w_ma}}`
  / `{{btc_ema_100d}}` should show real numbers, not literal unresolved text.
- **Every link and image** — article CTA, both chart CTAs, Bitcoin Data
  dashboard link, footer nav, the two chart images and the meme image —
  all point at `virtuse.com` now (fixed 2026-09-15; they used to point at
  `staging.virtuse.com`, which is stale now that production is live).
- **Unsubscribe link** — should render as a real link, not literal
  `{{{RESEND_UNSUBSCRIBE_URL}}}` text. This only resolves correctly when the
  broadcast has a segment attached (which the script always sets) — without
  one it silently renders as an empty link, so check it actually clicks
  through.
- **Subject and from address** — pulled from `virtuse-news-issue.json` and
  the `RESEND_FROM_EMAIL` secret.
- **Recipient count** — should match your migrated list size, not 0.
