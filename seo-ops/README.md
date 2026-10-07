# seo-ops

Prepared material for the plan "Rollout plan: SEO, staré URL a rast nových stránok"
(Claude Docs, https://claude.ai/artifact/JXmCAC3b34NEPTCQrumWrA). Nothing here
changes WordPress or Search Console; those changes are made by Ras (or whoever has
the login). Everything here is read-only against the live sites.

## Step 1: old Virtuse Exchange pages on blog.virtuse.com

Why: virtuse.com sends every unknown path to the same path on blog.virtuse.com
(301), and the old exchange pages still exist there with `index, follow`
(www.virtuse.com/gold/ → virtuse.com/gold/ → blog.virtuse.com/gold/ → 200). They
never fade, and they contradict "we are not an exchange / Bitcoin only, no tokens".

- `../partnerships/legacy-wp-redirects.csv`: every WordPress page (50 EN + 56 SK,
  105 unique URLs, 2026-10-07), each opened live (code, robots, forms, text) and
  given an action: `301` + target, `410`, or `keep`, with the reason. `status` is
  `ready` or `ras` (Ras decides first). Edit this file, never the generated ones.
- `legacy_redirects.py build` turns it into
  `../partnerships/legacy-wp-redirection-import.csv` (+ `-ras.csv`) for the
  Redirection plugin (already installed on the blog) and
  `../partnerships/legacy-wp-htaccess.txt` for .htaccess. Use one of the two.
- `legacy_redirects.py check` checks every row from www.virtuse.com,
  virtuse.com and blog.virtuse.com. Run it after the rules are live; before that,
  every 301/410 row fails (baseline).

**Order for Ras:**
1. Back up WordPress (hosting backup or a backup plugin) and export pages/posts
   (Tools → Export). `wp-posts-inventory.csv` here is a read-only list, not a backup.
2. Decide the 16 `ras` rows (contact form, loan request pages, affiliate/referral,
   glossary) and set them to `ready` (or change the action) in the CSV; run `build`.
3. Redirection → Import → `legacy-wp-redirection-import.csv`. Import two rows first
   (one 301, one 410) and check they show as "Redirect to URL" and "Error (410)";
   Redirection → Options: case-insensitive, ignore trailing slash, ignore query
   parameters. Or paste `legacy-wp-htaccess.txt` above `# BEGIN WordPress`.
4. Purge the LiteSpeed cache (the blog runs LiteSpeed Cache), then
   `python3 seo-ops/legacy_redirects.py check --status ready`.
5. 410 pages: switch them to Draft in WordPress, delete only after a month without
   problems. Search Console: URL inspection → request indexing for a few of them.

**Hops:** with rules only on the blog, a 301 row from www.virtuse.com is 3 hops
(www → virtuse.com → blog → target); the plan wants at most 2. To get 2, the same
`.htaccess` block also goes on virtuse.com, above its catch-all rule to the blog.
That file is on the server only (public_html/.htaccess, not in this repo): download
it first (`sftp> get public_html/.htaccess`) and send it over, then the exact merged
file can be prepared. 410 rows are 2 hops either way.

**Live since 2026-10-07:** 91 rules in the Redirection group "Legacy Exchange 2026-10"
(id 3; disable the group to roll back), identical to the CSV's ready rows. `check
--status ready`: every 410 and every 301 target correct; the 34 301 rows are 3 hops from
www (needs the virtuse.com .htaccess block); `/login/` + `/sk/login/` end as WordPress's
own 302 to wp-login.php (noindex), accepted. Contact pages kept (only contact channel for
former exchange clients, messages to office@virtuse.com); 8 affiliate/referral pages
wait for Ras. Not done yet: switching the 410 pages to Draft, Search Console requests.
Nine older rules in the "Redirections" group (e.g. /sk/registration/ → /sk/registracia/)
now end in a 410 after one extra hop; fine, can be pointed straight at 410 later.

**Changed against the plan's appendix (checked on the live pages):**
`/dashboard/` is a live Bitcoin dashboard (2026-05), not the old app → 301 to
bitcoin-data.html; `/home/` and `/sk/bitcoin-vo-vasom-vrecku/` are the blog's own
front pages → keep; `/e-shop/` sold hardware wallets → 301 to secure.html;
`/request-a-loan/` and `/pozicky/` are live Firefish loan forms linked from the
blog front page → 301 to lending.html (same Firefish widget), Ras confirms.

## Step 2: measuring only the new pages

- `search_console_groups.py`: one RE2 regex per group (homepage, categories, seo,
  data, stories, tools, info) plus `NEW_SITE` (all of them). Search Console →
  Performance → Page → Custom (regex). `NEW_SITE` with "Doesn't match" = legacy
  URLs. The script checks that every sitemap URL is in exactly one group; run it
  after adding a new page type.
- `weekly-search-console.csv`: one row per group and per target query, per week.
- Property: a Domain property for virtuse.com (covers www and http) and a separate
  one for blog.virtuse.com.

## Step 3: one main version of each story

- `stories_canonical_map.py` → `stories-canonical-map.csv`: for each of the 359
  stories the WordPress id/URL, the virtuse.com URL, and checks (virtuse.com 200 +
  self-canonical; the canonical WordPress serves today). 2026-10-07: 359/359 ready,
  WordPress canonical points at itself on all 359.
- The bulk canonical change in WordPress is prepared only after Ras decides which
  copy is the main one (recommended: virtuse.com/stories/).

## Other

- `wp-posts-inventory.csv`: all 1511 WordPress posts (en 870, sk 631, ru 10) with
  categories and whether a story page exists. "Crypto News" / "Krypto novinky":
  566 EN + 308 SK posts, almost all 2021–2023 (decision for Ras: noindex via Yoast
  or leave).
