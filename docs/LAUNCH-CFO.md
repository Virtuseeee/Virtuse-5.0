# Virtuse CFO launch checklist (planned 2026-11-01)

`cfo.html` and its 9 language copies (`sk/ cs/ de/ es/ fr/ hu/ pl/ ru/ uk/cfo.html`) stay `noindex, follow` and out of
`sitemap.xml` until launch. Each file carries a `TODO(launch 2026-11-01)` comment next to its robots meta.

- [ ] On 2026-11-01: robots meta → `index, follow` in all 10 files (and drop the TODO comment).
- [ ] Add the 10 cfo URLs to `sitemap.xml` with hreflang alternates (en, sk, cs, de, fr, es, pl, hu, uk, ru + x-default → EN).
- [ ] Each cfo page: canonical = its own URL (today all point to `https://virtuse.com/cfo.html`) and a reciprocal hreflang set.
- [ ] Remove the "Soon / Čoskoro" badges (`cfo-foot-badge`, nav `cfo-badge`, `meta vb-cfo-stage`) if the launch is real.
- [ ] Deploy (`deploy_site.sh`); IndexNow runs at the end; then URL inspection + sitemap resubmit in Search Console.
