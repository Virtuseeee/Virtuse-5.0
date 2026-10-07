# Virtuse stories build

Pre-renders one static page per blog story so social networks get that
story's own preview card (X, LinkedIn, Facebook, Telegram, Slack, iMessage
and the rest read Open Graph tags without running JavaScript).

```bash
node stories-build/build.mjs      # from the repo root; Node 18+, needs network
```

## What it writes

Inside `Kimi_Agent_Virtuse%20MiCA%20Partners/`:

| Path | Feed |
|---|---|
| `stories/<slug>/index.html` | English WordPress feed (category 13) |
| `sk/stories/<slug>/index.html` | Slovak feed (category 26) |
| `ru/stories/<post-id>/index.html` | Russian feed (category 57); Russian slugs are Cyrillic, so the post id is the folder name |

Each page is `article.html` with:
- head filled in: title, description (Yoast description, else the excerpt),
  canonical, Open Graph (incl. image + size), Twitter card, article dates,
  `BlogPosting` JSON-LD. The Yoast **title** is not used: its WP template
  is broken (`… • Virtuse Exchange %`);
- the kicker (desk), headline, dek and image pre-rendered;
- relative URLs rewritten for the folder depth;
- `data-root`, `data-slug`, `data-lang`, `data-story` on `<html>`, which
  `article.js` reads.

The story body still loads from WordPress in the browser, same as on
`article.html`. Full-text pre-rendering (SEO) is a separate decision because
the WordPress originals on blog.virtuse.com are public (duplicate content /
canonical question).

Desk detection runs the code from `brief-chrome.js` (one source of truth).

`sitemap.xml` gets one `<url>` per story (loc + lastmod from WordPress's
modified date) between `<!-- STORIES-BUILD:START/END -->`. seo-build keeps
its own `SEO-BUILD` block; each generator only rewrites between its own
markers, so they coexist.
`manifest.json` lists every generated folder; stories removed from WordPress
get their folder deleted on the next run (only folders from the manifest).

## Sharing

`article.js` shares the clean URL: a story page shares itself; on
`article.html?slug=…` it checks (HEAD) whether the story page exists and
falls back to the `article.html` URL for a story published after the last
build. Readers in a UI-only language (uk/de/fr/es/pl/hu) share
`stories/<slug>/?lang=de`, so the preview is the story's and the recipient
gets their interface.

## When it runs

`.github/workflows/stories-build.yml` runs daily at 05:00 UTC (and on
demand: Actions → Stories build → Run workflow). It builds from WordPress,
and only if something changed it commits to `main` as `virtuse-bot`
(`[skip ci]`) and mirrors the three story trees to `gh-pages`, so staging
updates by itself. The run's summary lists new (A), changed (M) and
removed (D) stories.

**Retries on a fresh runner.** Webglobe (blog.virtuse.com, 212.57.32.128)
drops TCP connections from part of GitHub's IP ranges, so a runner either
reaches the blog or never does (`UND_ERR_CONNECT_TIMEOUT`); retrying from the
same runner doesn't help. The workflow therefore calls
`.github/workflows/stories-build-run.yml` up to three times (`attempt-1`,
`attempt-2`, `attempt-3`), each a new runner with a different IP. Each attempt
first runs `curl --connect-timeout 10 -I https://blog.virtuse.com/wp-json/`:
unreachable → the attempt ends green with `reachable=false`, a warning
annotation and its runner IP in the summary, and the next attempt starts;
reachable → build, commit, staging as above. The run fails (and emails) only
if all three runners are unreachable ("blog.virtuse.com unreachable from 3
runners") or the build itself fails (no further attempt then). Commit and
staging publish happen at most once per run.

**Through Cloudflare first (since 2026-10-07).** Each attempt now probes the
Cloudflare Worker proxy `https://virtuse-newsletter.virtuse-ai.workers.dev/wp`
first (`cloudflare-worker/src/wp-proxy.js`) and only then blog.virtuse.com
directly; the build gets whichever answered as `WP_BASE`. GitHub → Cloudflare
→ Webglobe avoids the dropped GitHub IPs, so the three attempts should rarely
be needed. Locally `WP_BASE` is unset and the build talks to the blog directly.

**Production stays manual.** Until a story's page is on virtuse.com, shares
of it show the generic Brief card (article.js falls back to its own URL
only when the page is missing on the site it runs on).

**Upload:** a new story is a new folder on the server, and Webglobe's `scp`
does not create missing remote directories (see CLAUDE.md). The build writes
`stories-build/upload.sftp`: `-mkdir` for every folder (errors for existing
ones are ignored), then one `put` per page. Run it from the gh-pages
worktree after syncing:

```bash
cd "<repo>" && git pull --rebase origin main && git -C /private/tmp/gh-pages-wt4 pull origin gh-pages
cd /private/tmp/gh-pages-wt4 && sftp -P 222 virtuse.com@ftp.virtuse.com < "<repo>/stories-build/upload.sftp"
```

(`<repo>` = the local checkout. Pull both first: after an automatic run
the new pages and the new `upload.sftp` exist only on GitHub.)

The last `put` sends `stories/wp-canonical.json` (WordPress post ID → story
URL, written by the build) to blog.virtuse.com's must-use plugin
`virtuse-story-canonical.php` (`/_sub/blog/wp-content/mu-plugins/`), which
points each WordPress original's canonical at its virtuse.com page. It goes
after the pages on purpose: the canonical moves only once the page exists.
See seo-ops/README.md, step 3.

Use `<` (stdin), not `sftp -b`: batch mode disables password login. It
uploads all pages (about 5 MB), so it is safe to re-run. Folders of
stories removed from WordPress are listed as comments at the end of the file
and have to be deleted on the server by hand.
