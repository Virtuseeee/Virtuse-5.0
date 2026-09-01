# i18n tooling

Scripts used to build the `sk/` translation (Aug 2026) and, later, the
`uk/` translation — kept here so the *next* language rollout doesn't start
from a blank editor. See [`../TRANSLATION-SYSTEM.md`](../TRANSLATION-SYSTEM.md)
for the full system this tooling implements.

These are **not** meant to run unattended end-to-end — they handle the
mechanical 80% (paths, nav labels, newsletter/footer boilerplate, hreflang,
sitemap, lang switcher) so a human/AI pass only has to hand-translate the
page-specific prose (hero copy, partner cards, form labels, dashboard JS
strings) afterward. Run each script from anywhere; they hold an absolute
`CONTENT_DIR` path to this repo's content folder.

**Current status: three languages live** — EN (root), SK (`sk/`), UK
(`uk/`). The desktop language switcher is a compact single-button dropdown
(`.nav-actions > .lang-menu`), not the original 3-pill row — see
`dropdown_retrofit.py` below for why. Mobile (≤1024px) still uses the
original pill list inside the hamburger menu
(`li.nav-links-lang-item > .lang-switch`). Both structures share the same
`.lang-opt[lang="xx"]` markup for each language option, so anything that
reads/writes language links only needs to target that one selector/attr
pattern regardless of which of the two switcher UIs it's in.

## Slovak-era scripts (still used for every language, incl. new ones)

### `scaffold_sk.py`

Duplicates `<page>.html` into `sk/<page>.html` and does everything
mechanical: fixes asset/nav paths to `../`, translates the site-wide nav
labels and CTA, translates the standard newsletter/footer block, inserts
`hreflang` tags, and adds the `.lang-switch` markup (desktop nav + mobile
menu) — all pointing at the SK page. Leaves page-specific content
untouched for a manual translation pass.

```bash
python3 scaffold_sk.py "<page>.html" "<SK title, no ' — Virtuse'>" "<SK og:description>"
```

After running it, translate the hero/body/JS-string content by hand, then
run `sitemap_add.py` and `wire_root.py` (below).

**Known gotcha**: a handful of pages spell the newsletter's em dash as a
literal `—` character instead of the `—` escape the script expects
(`terms-and-conditions.html` was one). If the script prints "Newsletter/footer
strings NOT found", grep the output file for `You're in` / `Network error`
and fix those two lines by hand.

### `sitemap_add.py`

Adds `hreflang` `<xhtml:link>` alternates to a page's existing `sitemap.xml`
entry and inserts the `sk/` counterpart entry right after it, reusing the
same `changefreq`/`priority`.

```bash
python3 sitemap_add.py "<page>.html"
```

### `wire_root.py`

Adds the reciprocal `hreflang` tags and the `.lang-switch` nav markup to
the **English** original, pointing at its new `sk/` sibling. Idempotent —
skips pages that already have `hreflang="sk"`.

```bash
python3 wire_root.py "<page>.html"
```

### `relink_sk.py`

Retroactive fixup: pages translated in batches keep pointing their nav/
footer links at the English original (`../page.html`) for any sibling page
that didn't have a `sk/` counterpart *yet* at scaffold time. Once every
page in the batch exists, this rewrites all of them to point at the
Slovak sibling directly. **Run after every batch of pages**, not just once
at the end — this is exactly the bug that shipped and had to be
retroactively fixed (whole `sk/` site's nav pointed back to English for a
while). Excludes each page's own `../<self>.html` (intentional EN
language-switcher link) and `../blog-sk.html`.

```bash
python3 relink_sk.py
```

## UK-era scripts (2nd-generation — also the template for the *next* language)

Added for the Ukrainian rollout (Aug 2026), after a pilot on `uk/index.html`
surfaced problems the SK-era scripts didn't have to deal with (3rd
language on the nav made the old pill row wrap/overflow at real widths).
**Copy these, not the SK-era ones, when adding a new language** — they
already bake in the dropdown switcher and the no-em-dash house rule.

### `scaffold_uk.py`

Same job as `scaffold_sk.py`, second-generation. Differences worth
knowing before you copy it for a new language:
- Writes the compact dropdown switcher markup (`.lang-menu`), not the old
  3-pill `.nav-lang-switch`.
- Nav links get a size/spacing squeeze at ≥1025px (and an extra squeeze
  in the 1025–1240px band) so longer translated labels don't wrap to 2
  lines at in-between widths — matters more for languages with longer
  words than English/Slovak.
- **No em dashes (`—`) in any mechanically-written string** (newsletter/
  footer messages, title separator uses `|` not `—`) — a house rule
  adopted for this rollout; keep following it for hand-written
  page-specific prose too, not just what the script generates.
- Assumes the page already has a `sk/<page>.html` sibling (site is
  SK-first); if it doesn't yet, the SK link in the switcher 404s until it
  does.

```bash
python3 scaffold_uk.py "<page>.html" "<UK title, no em dash>" "<UK og:description>"
```

### `sitemap_add_uk.py`

Same job as `sitemap_add.py`, but matches a page's `<loc>` regardless of
which language-folder prefix it already has, so it works for the 3rd+
language onward. **Not actually language-parameterized** despite the
docstring's claim — it's still hardcoded to `hreflang="uk"` and `uk/`
internally, so a new language still needs its own copy (or a real
parameterization pass — see "Adding the next language" below).

```bash
python3 sitemap_add_uk.py "<page>.html"
```

### `wire_uk_into_existing.py`

Adds the UK option to a page that's already wired for EN/SK: inserts
`hreflang="uk"` into both the English original and its `sk/` sibling, and
extends both pages' `.lang-switch` (dropdown + mobile pill list) from a
2-option EN/SK row to a 3-option EN/SK/UK row. Idempotent — skips a file
that already has `hreflang="uk"`. Run once per page, **after**
`uk/<page>.html` has been scaffolded and after `sitemap_add_uk.py`.

```bash
python3 wire_uk_into_existing.py "<page>.html"
```

### `relink_uk.py`

The `relink_sk.py` fixup, for `uk/`. Excludes each page's own
`../<self>.html` and `blog.html` — **correction**: `uk/blog.html` *does*
exist (added directly in the UK rollout, not skipped as the script's own
docstring claims), but it isn't a true translation of the blog feed — its
UI/nav is Ukrainian but it still pulls WordPress category 13 (the default
English feed), since no Ukrainian WP category exists yet. `relink_uk.py`
still excludes `blog.html` from its rewriting because the root
`blog.html` → `uk/blog.html` link is handled by the switcher, not by this
script's page-to-page relinking.

```bash
python3 relink_uk.py
```

### `dropdown_retrofit.py`

One-time migration script, already run: rewrites the EN/SK pages' old
3-pill desktop switcher into the compact dropdown, preserving whatever
language options already existed. You shouldn't need to run this again
unless a page somehow still has the old 3-pill markup — check with:

```bash
grep -L "lang-menu-btn" *.html sk/*.html   # pages still on the old switcher, if any
```

## Known site quirk: dual-named pages

`rainbow-chart.html` and `root-cycles.html` are two **different, real**
pages (not a stray duplicate) — meaningfully different content, both
sitemapped and hreflang-wired, at every language level (root, `sk/`,
`uk/`). Both need scaffolding/wiring when adding a new language; don't
assume one is a copy-paste leftover of the other.

## Adding the next language (Czech is next)

Repeat the UK-era pattern with a **new folder** — recommend `cs/` (ISO
639-1 code for Czech; `cz` is the *country* code, not the language code —
don't use it for the folder, hreflang, or sitemap entries). Concretely:

1. Copy `scaffold_uk.py` → `scaffold_cs.py`, `relink_uk.py` →
   `relink_cs.py`, `wire_uk_into_existing.py` → `wire_cs_into_existing.py`,
   `sitemap_add_uk.py` → `sitemap_add_cs.py`. Swap the Ukrainian
   `NAV_LABELS`/newsletter strings/flag emoji (`🇺🇦`/`uk`) for Czech ones
   (`🇨🇿`/`cs`).
2. Scaffold all 20 non-blog pages, hand-translate the prose, `sitemap_add_cs.py`,
   `wire_cs_into_existing.py` per page (this now touches **three** existing
   folders — root, `sk/`, `uk/` — to add the 4th switcher option, not just
   the new `cs/` files).
3. Run `relink_cs.py` after every batch, not just at the end.
4. Decide on `blog.html`: SK never got a `/sk/blog.html` (stayed on the
   `blog-sk.html` suffix pattern, deliberately); UK got a `uk/blog.html`
   shell with UI translated but English WordPress content (no Ukrainian
   category exists). Same choice applies to Czech — a `cs/blog.html`
   shell is easy to add for consistency, but won't have real Czech blog
   content until a Czech WordPress category exists either.
5. `lang-detect.js` (browser-language auto-redirect, repo root) is
   currently Slovak-only by design — decide whether Czech (and Ukrainian)
   should get the same treatment, and update its `TRANSLATED` array and
   `browserLang` check accordingly if so. **This array has already gone
   stale once** (missed `root-cycles.html` for a while after it shipped)
   — whenever a new page is scaffolded for *any* language, check this
   file too.

Given this will be the **third** near-duplicate script family (`_sk`,
`_uk`, `_cs`), it may be worth actually parameterizing at this point
(single `scaffold_lang.py <code> <page> <title> <desc>` driven by a
`LANGUAGES` config dict) rather than copying a fourth time for language
#5 — `sitemap_add_uk.py`'s docstring already *claims* to be generalized
but isn't; a real parameterization would fix that too.
