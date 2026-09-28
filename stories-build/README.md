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
`manifest.json` lists every generated folder; stories removed from WordPress
get their folder deleted on the next run (only folders from the manifest).

## Sharing

`article.js` shares the clean URL: a story page shares itself; on
`article.html?slug=…` it checks (HEAD) whether the story page exists and
falls back to the `article.html` URL for a story published after the last
build. Readers in a UI-only language (uk/de/fr/es/pl/hu) share
`stories/<slug>/?lang=de`, so the preview is the story's and the recipient
gets their interface.

## When to run it

After new stories are published in WordPress (or titles, excerpts or
featured images change): run the build, commit, sync gh-pages, and upload
the new or changed story folders to production. Nothing here runs
automatically yet. Until a story has its page, shares of it show the
generic Brief card.

**Upload:** a new story is a new folder on the server, and Webglobe's `scp`
does not create missing remote directories (see CLAUDE.md). The build writes
`stories-build/upload.sftp`: `-mkdir` for every folder (errors for existing
ones are ignored), then one `put` per page. Run it from the gh-pages
worktree after syncing:

```bash
cd /private/tmp/gh-pages-wt4 && sftp -P 222 virtuse.com@ftp.virtuse.com < "<repo>/stories-build/upload.sftp"
```

Use `<` (stdin), not `sftp -b`: batch mode disables password login. It
uploads all pages (about 5 MB), so it is safe to re-run. Folders of
stories removed from WordPress are listed as comments at the end of the file
and have to be deleted on the server by hand.
