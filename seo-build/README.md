# Virtuse SEO build

Deterministic static HTML generator for programmatic SEO (EN + DE pilot), the Bitcoin Fee Index, and `llms.txt`.

Website source lives in `Kimi_Agent_Virtuse%20MiCA%20Partners/` (percent-encoded folder name). This generator writes HTML into that folder. There is **no server, no rewrite layer, and no database**. GitHub Pages serves `index.html` inside each directory, which is why approved URLs look like `/bitcoin-tax/czechia/`.

## Commands

From repo root:

```bash
node seo-build/generate.mjs
node seo-build/verify.mjs
```

Or from this folder:

```bash
npm run build          # generate HTML + patch sitemap.xml / robots.txt / llms.txt
npm run verify         # acceptance checks (re-runs generate once to assert determinism)
npm run build:verify
```

Same input JSON always produces the same HTML. Numbers are not invented at generate time.

## Data sources (do not invent rates)

| File | What |
|---|---|
| `data/seo-data.json` | Exact brief JSON: 11 country tax strings, placeholder fee schedule, module CTAs |
| `data/fee-schedule-live.json` | **Used for published Fee Index / buy / DCA pages.** Extracted from the shipped Stacking bundle (`main-stacking-*.js`). Partners: 21bitcoin, ByBit EU, Kraken, RevenueBot. Numbers unaltered. |
| `data/inheritance.json` | Tax module inheritance checklist (English strings unaltered) |
| `data/meta.json` | Slugs, German names/translations, origin, `feeSource` |

`meta.feeSource` is `"live"`. Set it to anything else only if you intentionally want the brief’s Banxa / “MiCA-licensed CASP” / “Virtuse Bots” placeholder table in indexable HTML (not recommended: those names were already replaced in the live Stacking module).

## URL map (approved)

**EN**

- `/bitcoin-tax/` hub + `/bitcoin-tax/{country}/` (czechia, slovakia, poland, austria, germany, hungary, slovenia, croatia, romania, bulgaria, netherlands)
- `/buy-bitcoin/{country}/` — country framing around the same EUR fee ranking (no `/buy-bitcoin/` hub, so it does not collide with existing `buy-bitcoin.html`)
- `/sell-vs-borrow-bitcoin/`
- `/bitcoin-dca-calculator/`
- `/bitcoin-inheritance/`
- `/bitcoin-fee-index/` + archive `/bitcoin-fee-index/2026-q3/` + `/methodology/` + `/embed/`
- Print/PDF companion (noindex): `/bitcoin-fee-index/2026-q3/print.html`

**DE pilot**

- `/de/bitcoin-steuern/` + `/de/bitcoin-steuern/{land}/` (tschechien, slowakei, polen, oesterreich, deutschland, ungarn, slowenien, kroatien, rumaenien, bulgarien, niederlande)
- `/de/bitcoin-verkaufen-oder-beleihen/`
- `/de/bitcoin-dca-rechner/`
- `/de/bitcoin-erbrecht/`
- `/de/bitcoin-gebuehrenindex/`

Live module CTAs: `tax-agent.html` (interactive agent; `tax.html` is the separate category page), `stacking.html`, `loan.html`, `concierge.html`.

## Adding a country or language without code

See [CONTENT-OPS.md](CONTENT-OPS.md).

## Deploy: main → gh-pages (staging)

There is **no GitHub Action that publishes the site**. Staging is a manual worktree copy, same as the rest of this repo. Production is a **separate** Webglobe SFTP step and is **not** triggered by this PR.

After this branch is merged to `main`:

```bash
# 1. Confirm generate is current (optional if HTML was committed)
node seo-build/generate.mjs && node seo-build/verify.mjs

# 2. Staging: copy the content folder into a gh-pages worktree
git worktree add /tmp/gh-pages-wt gh-pages
git -C /tmp/gh-pages-wt pull origin gh-pages

# Copy site files (folder name is percent-encoded on disk)
# Exclude research/, i18n-tools/, PDFs as the existing process already does.
rsync -a --delete \
  --exclude research --exclude i18n-tools --exclude '*.docx' --exclude '*.pdf' \
  "Kimi_Agent_Virtuse%20MiCA%20Partners/" /tmp/gh-pages-wt/

cd /tmp/gh-pages-wt
git add -A
git status   # review: new bitcoin-tax/, buy-bitcoin/<country>/, de/, llms.txt, sitemap.xml, robots.txt
git commit -m "Staging: programmatic SEO + Fee Index (EN + DE pilot)"
git push origin gh-pages
```

Do **not** `rsync --delete` in a way that wipes `CNAME`. If you copy file-by-file instead of rsync, keep the existing `CNAME` on `gh-pages` (staging.virtuse.com).

Production SFTP is unchanged: only upload after marketing/SEO review. These pages start as indexable in HTML (`index, follow`) except the print view (`noindex`). Hold production if you want them `noindex` until review — flip `noindex` in the generator or add a robots meta via a data flag.

## PDF export (Fee Index)

No PDF library. Open `/bitcoin-fee-index/2026-q3/print.html` → browser Print → Save as PDF. Print CSS hides nav/footer.

## Hypothesis (existing SEO folders)

Searched the repo: no prior `seo-build/`, `/bitcoin-tax/`, or `llms.txt`. Programmatic SEO is new in this PR. `tax.html` remains the category page; `tax-agent.html` remains the Layer 2 module.
