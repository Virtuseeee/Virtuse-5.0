# Emails

| File | What it is |
|---|---|
| `welcome-template.html` | EN welcome email after a Brief signup. The Cloudflare Worker (`cloudflare-worker/`) embeds it at build time and sends it with a signed unsubscribe link. |
| `welcome-template-sk.html` | The same in Slovak (signups with `lang: "sk"`). |
| `waitlist-strings.json` | Texts of the Virtuse CFO waitlist confirmation email in 10 languages (Worker). |

After changing a template: `cd cloudflare-worker && npm test`, then deploy the Worker with `deploy_worker.sh` (it deploys origin/main). See `cloudflare-worker/README.md`.

The weekly Virtuse Brief (Monday) is not built from this folder; the Brief desk sends it.

## Retired: the "Virtuse News" pipeline (2026-10-21)

`virtuse-news-template.html`, `virtuse-news-issue.json`, `pulse-cache.json`, `.github/workflows/virtuse-news.yml` and the scripts `render-virtuse-news.mjs` / `create-virtuse-news-broadcast.mjs` were removed. The template still said "Virtuse News", the Monday Brief was never built from it, and the Tuesday Action had failed at "Fetch stats and render email" every week since early October. Everything is in git history (`git log -- email/virtuse-news-template.html`) if it is ever needed again.

## Sending a one-off test to yourself

Actions → **Send Test Email** → Run workflow → your own address in `to`, `welcome` or `welcome-sk` in `template`. It sends exactly that template to exactly that address through Resend's transactional `/emails` endpoint and never touches the subscriber list (secrets `RESEND_API_KEY`, `RESEND_FROM_EMAIL`).

A test send shows `{{unsubscribe_url}}` as literal text: the tool sends the template file as it is. Real welcome emails get a working per-recipient link from the Worker.
