# Emails

| File | What it is |
|---|---|
| `welcome-template.html` | EN welcome email after a Brief signup. The Cloudflare Worker (`cloudflare-worker/`) embeds it at build time and sends it with a signed unsubscribe link. |
| `welcome-template-sk.html` | The same in Slovak (signups with `lang: "sk"`). |
| `waitlist-strings.json` | Texts of the Virtuse CFO waitlist confirmation email in 10 languages (Worker). |

After changing a template: `cd cloudflare-worker && npm test`, then deploy the Worker with `deploy_worker.sh` (it deploys origin/main). See `cloudflare-worker/README.md`.

The weekly Virtuse Brief (Monday) is not built from this folder; the Brief desk sends it.

## Animated logo in the header (2026-11-19)

`https://virtuse.com/news/brief-logo-anim-v1.gif` (213×26 shown, 426×52 file, 51 KB): the V-mark assembles, then "virtuse brief" slides in; it plays once (1.3 s) and stays on the normal logo. Both welcome templates use it. Outlook for Windows shows only the first frame of a GIF (here empty), so it gets the static PNG through a conditional comment. The weekly Brief should use the same header; the desk replaces its `<img class="brand-lockup" …brief-nav-logo-on-light.png…>` with:

```html
<!--[if mso]><img class="brand-lockup" src="https://virtuse.com/news/brief-nav-logo-on-light.png" width="213" height="26" alt="Virtuse Brief" style="display:block;width:213px;max-width:100%;height:auto;border:0;"><![endif]-->
<!--[if !mso]><!--><img class="brand-lockup" src="https://virtuse.com/news/brief-logo-anim-v1.gif" width="213" height="26" alt="Virtuse Brief" style="display:block;width:213px;max-width:100%;height:auto;border:0;"><!--<![endif]-->
```

Gmail caches images by URL, so a changed animation gets a new file name (`-v2.gif`), never an overwrite.

## Retired: the "Virtuse News" pipeline (2026-10-21)

`virtuse-news-template.html`, `virtuse-news-issue.json`, `pulse-cache.json`, `.github/workflows/virtuse-news.yml` and the scripts `render-virtuse-news.mjs` / `create-virtuse-news-broadcast.mjs` were removed. The template still said "Virtuse News", the Monday Brief was never built from it, and the Tuesday Action had failed at "Fetch stats and render email" every week since early October. Everything is in git history (`git log -- email/virtuse-news-template.html`) if it is ever needed again.

## Sending a one-off test to yourself

Actions → **Send Test Email** → Run workflow → your own address in `to`, `welcome` or `welcome-sk` in `template`. It sends exactly that template to exactly that address through Resend's transactional `/emails` endpoint and never touches the subscriber list (secrets `RESEND_API_KEY`, `RESEND_FROM_EMAIL`).

A test send shows `{{unsubscribe_url}}` as literal text: the tool sends the template file as it is. Real welcome emails get a working per-recipient link from the Worker.
