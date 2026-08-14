# Weekly Virtuse Report automation

Automates the **Bitcoin Pulse stats only** (price, dominance, 200W MA) in the
weekly report email. The lead story, secondary reads, and intro note are
still human-written each week in [`weekly-issue.json`](weekly-issue.json).

## How it fits together

```
.github/workflows/weekly-pulse.yml   -- scheduled trigger (Tue 07:00 UTC) + manual trigger
.github/scripts/render-pulse.mjs     -- fetches stats, renders template.html -> dist/weekly-email.html
.github/scripts/create-zoho-draft.mjs -- hands the published URL to Zoho, creates a draft campaign
email/template.html                  -- the email, with {{merge_tags}} for content + stats
email/weekly-issue.json              -- EDIT THIS WEEKLY: this issue's story picks and intro
email/pulse-cache.json               -- auto-updated fallback cache, don't edit by hand
```

Every run publishes that week's rendered HTML to
`gh-pages` at `email-archive/{date}.html` (noindexed, not linked from the
site nav) — Zoho's `createCampaign` API only accepts a public `content_url`
it fetches from, not raw HTML in the request, so the render has to be live
somewhere before Zoho can pick it up. Once Zoho has fetched it and created
the campaign, that copy is disposable — it's fine if a future full site
redeploy (the manual `git subtree split` + reset workflow) wipes
`email-archive/`, since Zoho keeps its own internal copy from that point on.

By default the workflow only creates a **draft** in Zoho Campaigns — nothing
sends automatically. Review it in Zoho and click send yourself. Once you
trust the numbers, you can either trigger the workflow manually with the
`send` input checked, or flip its default to `true` in the workflow file.

## One-time setup

### 1. Weekly content

Before each Tuesday run, edit [`weekly-issue.json`](weekly-issue.json) with
that week's `issue_number`, `issue_date`, `subject`, `weekly_intro`, and the
4 story fields. Commit it to `main` — the workflow reads whatever's on `main`
at run time.

### 2. Zoho Campaigns API credentials

Zoho Campaigns uses OAuth 2.0. For unattended automation (no human clicking
"allow" each run), you need a **Self Client**:

1. Go to [api-console.zoho.com](https://api-console.zoho.com), create a
   **Self Client**.
2. Under **Generate Code**, request scope `ZohoCampaigns.campaign.CREATE`
   (add `ZohoCampaigns.campaign.UPDATE`, or use the combined
   `ZohoCampaigns.campaign.CREATE-UPDATE` scope, if you also want the
   workflow able to call `sendcampaign`). Generate a grant token — it's
   valid once, for a short window you choose.
3. Exchange the grant token for a refresh token (one-time — the refresh
   token itself doesn't expire):
   ```bash
   curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
     -d "grant_type=authorization_code" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "code=YOUR_GRANT_TOKEN"
   ```
   The response includes `refresh_token` — save it.
4. Find your mailing list's `listkey` via Zoho's
   [Get Mailing Lists](https://www.zoho.com/marketingautomation/help/developers/v1/get-mailing-lists.html)
   API, or from the list's settings page in the Zoho Campaigns UI.

### 3. Add repo secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `ZOHO_CLIENT_ID` | from the Self Client |
| `ZOHO_CLIENT_SECRET` | from the Self Client |
| `ZOHO_REFRESH_TOKEN` | from step 2.3 above |
| `ZOHO_LIST_KEY` | the Virtuse Report subscriber list's key |
| `ZOHO_FROM_EMAIL` | the verified sender address for this list |

If your Zoho account is on a non-`.com` data center (`.eu`, `.in`, `.com.cn`,
`.jp`), also add `ZOHO_ACCOUNTS_DOMAIN` / `ZOHO_API_DOMAIN` env overrides in
the workflow file (defaults are `accounts.zoho.com` / `campaigns.zoho.com`).

No user GitHub token is needed — the workflow uses the Action's own scoped
`GITHUB_TOKEN` to push to `main` (pulse cache) and `gh-pages` (rendered
email), which is why `permissions: contents: write` is set in the workflow.

## Testing before the first real Tuesday

Run it manually anytime via Actions → Weekly Virtuse Report → Run workflow,
leaving `send` unchecked. Check the created draft in Zoho Campaigns before
ever checking `send`.
