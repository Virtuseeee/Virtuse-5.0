# Data freshness: why the copies on virtuse.com go stale, and options (2026-11-26)

Analysis only. Nothing in this PR uploads to production; the choice between the options is Ras's
(open question 1 in the handover `handover_data_freshness.md`).

Checked on `origin/main` `36009cfcb` (26 Nov 2026, 05:19 UTC), re-checked after rebase on `aa7a490bd`,
and on the live sites on 26 Nov 2026 between 09:00 and 10:40 UTC.

## 1. What is stale

Live run of the new check (`node cloudflare-worker/scripts/data-freshness.mjs`, `CHECK_PROD_COPY=1`),
26 Nov 2026 09:39 UTC:

| File `data/…` | GitHub main (what pages read first) | virtuse.com copy | Behind |
|---|---|---|---|
| `asset-returns.json` | `asOf` 2026-11-26 | 2026-11-16 | 10 days |
| `bitcoin-vs-commodities.json` | `asOf` 2026-11-25 | 2026-11-16 | 9 days |
| `btc-monthly-returns.json` | `asOf` 2026-11-25 | 2026-11-15 | 10 days |
| `btc-treasuries.json` | `as_of` 2026-11-26 | 2026-11-16 | 10 days |
| `macro.json` | `generated` 2026-11-26 | 2026-11-16 | 10 days |
| `funds-vs-bitcoin.json` | `asOf` 2026-11-06 | same | manual file, no workflow |
| `news/news-pulse.json` (Pulse fallback) | `updated` 2026-11-10 | same | 16 days; the Worker's `/pulse.json` is fresh |

What visitors see: in a browser the pages read GitHub raw first, so they show fresh numbers today.
The stale copy is what the fallback path, crawlers, `contentUrl` in JSON-LD, `llms.txt` and the
Tweet CRM (outside this repo) read. Until this PR, a page on the fallback showed the old numbers
with only the small "Data as of" line.

## 2. Cause (lines on `origin/main` `36009cfcb`)

1. **The daily workflows write only to `main` and `gh-pages`.** `.github/workflows/asset-returns.yml`:
   file list `:39`, commit to main `:78`, publish to staging `:97`; its own comment `:9-11` says the
   server copy "is only the fallback". `.github/workflows/commodities.yml`: commit `:48`, staging `:67`.
   CLAUDE.md `:103`: "no workflow deploys production". The stale copy is by design, not an Actions failure.
2. **`deploy_site.sh` uploads only files changed in the deployed commit range** (`deploy_site.sh:49`,
   `git diff --name-only … "$FROM" "$TO"`). The bot adds data commits daily; data reaches production
   only when Ras's range happens to contain one. The last one was `19dc6ce2b` (16 Nov, 21:45 UTC).
3. **The existing daily check could not see it.** `features/brief-health/checks.js` reads GitHub raw,
   only `asset-returns.json` and `macro.json`, limit 4 days; never `virtuse.com/data/`. Its alerts go to
   `BRIEF_ALERT_TO`, else `VERDICT_ALERT_TO`, else `info@virtuse.com` (`handler.js:3`, `:34`).
4. **Actions run late.** Planned 22:30 UTC Mon–Fri and 12:00 UTC weekends (`asset-returns.yml:15-16`);
   recent commits land 03:20–06:20 UTC the next day (GitHub delays scheduled runs). `asOf` is therefore
   the run date, and `btc-monthly-returns` / `bitcoin-vs-commodities` are one day behind by design.
   Thresholds in this PR allow for that (pages: 3 days; check: 2 days on the source).

## 3. Options for getting the JSON to production

| Option | What it is | For | Against |
|---|---|---|---|
| **A. Daily request through Ship** | Ship uploads "only `data/*.json`" after Ras's yes, every day | No rule change; Ras sees everything | A yes every day; easy to forget, and the copy goes stale again |
| **B. Narrow standing rule "data files only"** | Ras approves once: Ship (or one script) may upload **only the five** daily files from `main`, after a schema check and `asOf` never older than production, with md5 verification | Copy stays fresh without a daily question; no HTML, no code | An exception to "production only after yes". Needs SFTP access without a typed password (DEPLOY.md: Ras types it in his own terminal), so unattended runs are **a new security decision**: where the credential is kept and who may use it |
| **C. Stop depending on the production copy** | Every reader (Tweet CRM, `contentUrl`, `llms.txt`, page fallback) uses GitHub raw or staging; the server copy stays "last deployed", and pages now show its date (this PR) | No new access, no deploy | Crawlers and LLMs reading `https://virtuse.com/data/…json` still get the old file until a deploy; raw has about 5 minutes of cache (`cache-control: max-age=300`) |
| **D. Worker or edge rule serving `/data/*.json` from GitHub** | Not investigated | – | **Not verified.** Unknown whether virtuse.com's DNS and routing (Webglobe hosting) allow it. Listed only as a possibility |

What this PR does works under any of A–D: the visible note on pages, the Brief dateline fix, and the
daily check (with the production-copy comparison off until the choice is made).

## 4. Related, described only (not deployed, not changed)

### 4.1 1 December 2026: monthly rebuild of the returns pages

On the 1st the Asset returns workflow runs `build_returns.py --monthly` (`asset-returns.yml:76`) and
commits 28 `bitcoin-returns/` pages, `btc-monthly-returns.html`, the sitemap and
`i18n-tools/legacy/src/en/btc-monthly-returns.html` to `main` and `gh-pages` (`PUBLISH`, `:42`), **not
to production**.

Dry run on a copy (worktree of this branch, data through October 2026, i.e. the same months as the
committed pages, so every difference is builder drift; the copy was reset afterwards):

- 31 files change (28 pages, the hub, the SK hub written but not committed by the Action, the EN source).
- Besides the new dates, the builder would: drop the **Virtuse CFO** item from the Tools menu and the
  footer, drop the `cfo-badge` class from the Verdict badge, add the `brief-d-cta` "Get the Brief" aside,
  add the LinkedIn "Follow Virtuse" and "Withdrawal" footer links, change the Brief card image to the
  23 Nov cover while its alt text still names the 5 Oct issue, and normalise two `.legacy .footer-col`
  CSS selectors.
- The new `data-freshness.js` tag and call survive the rebuild (checked).

Recommendation: either fix the chrome drift in the builder before 1 Dec, or accept that main and staging
get the drift on the 1st and production keeps the current pages until the next deploy. Open question 6;
default is report only, no change.

### 4.2 `funds-vs-bitcoin.json`

No workflow: built by hand with `funds-build/build.py --adss YY_MM_DD`. Its sources say the fund
returns come from **the weekly ADSS report** (one PDF per week, dated a Friday; `build.py:10-11`, and
`fridays()` for the weekly series), plus NBS daily unit values and Eurostat monthly HICP. The page says
"Data as of 6 November 2026" (`funds-vs-bitcoin.html:375`), 20 days ago today.

Proposed threshold (for Ras to decide, open question 5): **14 days**, i.e. one missed weekly report.
How many days after its Friday the ADSS publishes each report was not checked. Until decided, the daily
check prints the file's age as a note only, and the page shows no note.

## 5. What the check reports today

- With `CHECK_PROD_COPY` off (default): 0 problems; 2 notes (Pulse fallback 16 days, funds 20 days).
- With it on: the five production copies, 9–10 days behind. That is why it stays off until option A–D is
  chosen; otherwise the alert would arrive every day with nothing to do about it.
