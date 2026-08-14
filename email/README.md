# Weekly Virtuse Report automation

Automates the **Bitcoin Pulse stats only** (price, dominance, 200W MA) in the
weekly report email. The lead story, secondary reads, and intro note are
still human-written each week in [`weekly-issue.json`](weekly-issue.json).

Sends via [Resend](https://resend.com).

## How it fits together

```
.github/workflows/weekly-pulse.yml      -- scheduled trigger (Tue 07:00 UTC) + manual trigger
.github/scripts/render-pulse.mjs        -- fetches stats, renders template.html -> dist/weekly-email.html
.github/scripts/create-resend-broadcast.mjs -- sends the rendered HTML straight to Resend, creates a draft
email/template.html                     -- the email, with {{merge_tags}} for content + stats
email/weekly-issue.json                 -- EDIT THIS WEEKLY: this issue's story picks and intro
email/pulse-cache.json                  -- auto-updated fallback cache, don't edit by hand
```

Resend's `createBroadcast` API takes HTML directly in the request body, so
there's no publish-somewhere-public step in this pipeline (an earlier
version of this automation used Zoho Campaigns, whose API only accepts a
public `content_url` it fetches from — that's why you may see a leftover
`email-archive/` folder on `gh-pages` from that version; it's no longer
written to and can be deleted whenever).

By default the workflow only creates a **draft** broadcast in Resend —
nothing sends automatically. Review it in Resend and click send yourself.
Once you trust the numbers, you can either trigger the workflow manually
with the `send` input checked, or flip its default to `true` in the
workflow file.

## One-time setup

### 1. Weekly content

Before each Tuesday run, edit [`weekly-issue.json`](weekly-issue.json) with
that week's `issue_number`, `issue_date`, `subject`, `weekly_intro`, and the
4 story fields. Commit it to `main` — the workflow reads whatever's on `main`
at run time.

### 2. Resend setup

1. **API key**: Resend dashboard → API Keys → Create API Key. Give it
   Sending access (Full access also works).
2. **Segment** (Resend's audience/contact-list container): Dashboard →
   Audiences/Segments → create one for "Virtuse Report" subscribers. Copy
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

### 3. Add repo secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | from step 2.1 |
| `RESEND_SEGMENT_ID` | from step 2.2 |
| `RESEND_FROM_EMAIL` | e.g. `Virtuse Report <report@virtuse.com>` — must be on the verified domain from step 2.3 |

No user GitHub token is needed — the workflow uses the Action's own scoped
`GITHUB_TOKEN` to push the pulse cache back to `main`, which is why
`permissions: contents: write` is set in the workflow.

## Testing before the first real Tuesday

Run it manually anytime via Actions → Weekly Virtuse Report → Run workflow,
leaving `send` unchecked. Check the created draft in Resend before ever
checking `send`. Things worth checking on that first draft:

- **Rendering** — open the draft's preview in Resend and confirm it matches
  the template (dark background, orange accents, card layout), not a
  stripped/reflowed import.
- **Stat values** — `{{btc_price}}` / `{{btc_dominance}}` / `{{btc_200w_ma}}`
  should show real numbers, not literal unresolved text.
- **Every link** — lead story, 3 secondary stories, "Explore the Hub" row,
  Bitcoin Data dashboard link. These currently point at
  `staging.virtuse.com` — swap the domain in `email/template.html` once
  `virtuse.com` is live.
- **Unsubscribe link** — should render as a real link, not literal
  `{{{RESEND_UNSUBSCRIBE_URL}}}` text. This only resolves correctly when the
  broadcast has a segment attached (which the script always sets) — without
  one it silently renders as an empty link, so check it actually clicks
  through.
- **Subject and from address** — pulled from `weekly-issue.json` and the
  `RESEND_FROM_EMAIL` secret.
- **Recipient count** — should match your migrated list size, not 0.
