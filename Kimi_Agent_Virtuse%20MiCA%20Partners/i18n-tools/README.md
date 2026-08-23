# i18n tooling

Scripts used to build the `sk/` translation (Aug 2026) — kept here so the
*next* language rollout doesn't start from a blank editor. See
[`../TRANSLATION-SYSTEM.md`](../TRANSLATION-SYSTEM.md) for the full system
this tooling implements.

These are **not** meant to run unattended end-to-end — they handle the
mechanical 80% (paths, nav labels, newsletter/footer boilerplate, hreflang,
sitemap, lang switcher) so a human/AI pass only has to hand-translate the
page-specific prose (hero copy, partner cards, form labels, dashboard JS
strings) afterward. Run each script from anywhere; they hold an absolute
`CONTENT_DIR` path to this repo's content folder.

## `scaffold_sk.py`

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

## `sitemap_add.py`

Adds `hreflang` `<xhtml:link>` alternates to a page's existing `sitemap.xml`
entry and inserts the `sk/` counterpart entry right after it, reusing the
same `changefreq`/`priority`.

```bash
python3 sitemap_add.py "<page>.html"
```

## `wire_root.py`

Adds the reciprocal `hreflang` tags and the `.lang-switch` nav markup to
the **English** original, pointing at its new `sk/` sibling. Idempotent —
skips pages that already have `hreflang="sk"`.

```bash
python3 wire_root.py "<page>.html"
```

## Adding language #2 (e.g. German)

These scripts are Slovak-specific (nav labels, newsletter strings, flag
emoji are hardcoded). For a second language: copy `scaffold_sk.py` to
`scaffold_de.py`, replace the `NAV_LABELS`/`NEWSLETTER_FOOTER` Slovak
strings with German ones, change the `🇸🇰`/`sk` literals to `🇩🇪`/`de`, and
extend every existing `.lang-switch` block site-wide from a 2-option
EN/SK pill to a 3-option EN/SK/DE row (`sitemap_add.py`/`wire_root.py`
need the same `sk` → `de` treatment, or better: parameterize them by
language code rather than duplicating).
