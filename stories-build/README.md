# Virtuse stories build

Pre-renders one static page per blog story so social networks get that
story's own preview card (X, LinkedIn, Facebook, Telegram, Slack, iMessage
and the rest read Open Graph tags without running JavaScript), and search
engines and readers without JavaScript get the full text.

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
- the kicker (desk), headline, dek (only a hand-written excerpt, as in
  `article.js`), byline (desk, date in UTC, read time) and image
  pre-rendered;
- the **full story body** in `#articleBody`, sanitized with the same tag and
  attribute allowlist as `article.js`'s `sanitizeHtml()` (`sanitizeBody()`
  in build.mjs: no scripts/styles/forms, http(s)/mailto links only,
  iframes only from YouTube/Spotify/X, no inline styles). A small parser
  follows the HTML rules posts hit (block tags end an open `<p>` etc.), so
  the output is always balanced. Lazy-loaded images (`data-src`) get their
  real `src`, body images get `loading="lazy"`;
- relative URLs rewritten for the folder depth;
- `data-root`, `data-slug`, `data-lang`, `data-story` on `<html>`, which
  `article.js` reads.

`#articleBody` carries `data-modified` (WordPress's `modified_gmt` at build
time). `article.js` still fetches the post on load (byline block height,
More, share) and only replaces the body when WordPress has a newer version,
so readers never see the text flash or images reload; it then builds the
table of contents and the numbered Sources as before. The WordPress
originals point their canonical at these pages
(`seo-ops/wp-mu-plugin/virtuse-story-canonical.php`), so this is the copy
Google should index.

Checked on 2026-10-07 (all 359 pages): the pre-rendered body has exactly
the text `article.js` renders from the same post, and nothing after it
(Sources, author box, footer) ends up inside it. Paragraph counts differ
on 8 old posts only because their stray `</p>` tags made empty paragraphs
in the browser rendering; the build leaves those out.

Desk detection runs the code from `brief-chrome.js` (one source of truth).

`sitemap.xml` gets one `<url>` per story (loc + lastmod from WordPress's
modified date) between `<!-- STORIES-BUILD:START/END -->`. seo-build keeps
its own `SEO-BUILD` block; each generator only rewrites between its own
markers, so they coexist.
`manifest.json` lists every generated folder; stories removed from WordPress
get their folder deleted on the next run (only folders from the manifest).

## Hubs and related links (`hubs.mjs`, 2026-10-13)

`build.mjs` ends by calling `buildHubs()` from `hubs.mjs`. It needs no
network: everything comes from the story pages just written, so it can also
run on its own after a template or wording change:

```bash
node stories-build/hubs.mjs       # from the repo root; offline, idempotent
```

- **Hub pages**, newest first, 24 stories per page: `stories/`,
  `stories/page/<n>/`, `sk/stories/`, `sk/stories/page/<n>/`, `ru/stories/`.
  Only for languages with stories (en, sk, ru); no hub for uk/de/... and
  no hreflang pointing at one. Each page: self canonical, `CollectionPage` +
  `ItemList` + `BreadcrumbList` JSON-LD, prev/next links, cards with image,
  date, title and description, the Brief chrome of the story pages (same
  head, consent and GTM block as `article.html`; nav/footer in the hub's
  language from `article.js`'s `LANGS`). Page 1 hubs list each other in
  hreflang (en, sk, ru, x-default = en); later pages are self-canonical
  only. Pagination pages that are no longer needed are deleted on the next
  run (`manifest.json` → `hubs`).
- **Story pages**: breadcrumb `Virtuse Brief / Stories` (Články, Статьи)
  links the story's own hub, as do "All stories" and the back link
  (`article.js` keeps them there); the BreadcrumbList JSON-LD gets the hub
  as level 3; a "Related tools and guides" block (2-3 links, same language)
  between `<!-- STORIES-RELATED:START/END -->` after the body. Links are
  picked from the story's words (title x4, description x2, body x0.5,
  max 8 body hits) plus the desk: tax → tax guide + Tax Agent;
  inheritance → inheritance checklist + Tax Agent + wallets; loans → Loan
  Copilot + sell-or-borrow guide; custody → wallets + Tax Agent; mining →
  mining; treasury → treasury + CFO; buy/DCA → Stacking + fee index + buy;
  nothing clear → Partner Finder + news.html. Wording and topic words:
  `LINKS` / `TOPICS` in hubs.mjs. `build.mjs` applies the same function
  (`applyStoryExtras`) while rendering, so a WordPress build and an
  offline run give byte-identical pages (checked 2026-10-13).
- `sitemap.xml`: hub URLs between `<!-- STORIES-HUBS:START/END -->` inside
  the STORIES-BUILD block (lastmod = newest story change on that page).
- `upload.sftp`: hub pages between `# hubs:start` / `# hubs:end`
  (pagination folders are created first).


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

## Brief article SEO (2026-10-12)

- `/stories/<slug>/` (and `sk/stories/<slug>/`) are the canonical, static copies of Brief/blog articles. Head: `<title>Post | Virtuse Brief</title>`, description ≤ 160 chars, canonical, hreflang (self + x-default; `en`/`sk`/`x-default` when paired), OG + Twitter large image, JSON-LD `Article` + `BreadcrumbList` (Virtuse home `/` or `/sk/` → `/news.html` → article).
- EN↔SK pairs: add `"slug_sk": "<sk-slug>"` to the issue in `news/issues.json` next to its EN `slug`; the next build writes the hreflang pair into both pages and the sitemap.
- `.htaccess` (seo-ops): `/a/<slug>` and `article.html?slug=<slug>[&lang=sk]` 301 to the story page when it exists, otherwise the reader (302). `article.js` also points article.html's canonical at the story page.
- WordPress: `virtuse-story-canonical.php` points each post's canonical at its virtuse.com copy (reads `stories/wp-canonical.json`); `virtuse-brief-link.php` adds a fixed "Read the Brief on virtuse.com" bar at the top of those posts (printed in `wp_footer`, front end only; it pads `<body>` and pushes the theme's pinned header/menu down by the bar height).
