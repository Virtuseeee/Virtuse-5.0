# Virtuse CFO launch checklist (planned 2026-11-01)

`cfo.html` and its 9 language copies (`sk/ cs/ de/ es/ fr/ hu/ pl/ ru/ uk/cfo.html`) stay `noindex, follow` and out of
`sitemap.xml` until launch. Each file carries a `TODO(launch 2026-11-01)` comment next to its robots meta.

- [ ] On 2026-11-01: robots meta → `index, follow` in all 10 files (and drop the TODO comment).
- [ ] Add the 10 cfo URLs to `sitemap.xml` with hreflang alternates (en, sk, cs, de, fr, es, pl, hu, uk, ru + x-default → EN).
- [ ] Each cfo page: canonical = its own URL (today all point to `https://virtuse.com/cfo.html`) and a reciprocal hreflang set.
- [x] 2026-10-15 (CFO + Verdict merge): the nav and footer Tools item reads "Virtuse CFO · Verdict" with a "Free" badge
  in all 10 languages (`i18n-tools/apply_cfo_verdict_nav.py`; homepages via `i18n-tools/home`); the badge no longer
  switches to Soon/New by `meta vb-cfo-stage` (the stage only colours it). Run the script with `--with-cfo` once the
  merged cfo.html pages land.
- [ ] Before and after the launch: `python3 seo-ops/check_cfo_pages.py` (repo), `--staging`, `--live`.
- [ ] Deploy (`deploy_site.sh`); IndexNow runs at the end; then URL inspection + sitemap resubmit in Search Console.
