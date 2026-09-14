# Content ops: add a country or language without touching generator code

All published rates come from JSON under `seo-build/data/`. Do not type a tax rate or fee into an HTML file. After every edit, run:

```bash
node seo-build/generate.mjs
node seo-build/verify.mjs
```

Then commit **both** the JSON and the regenerated HTML (this site has no server-side build).

## Add a country (same language set)

1. Open `seo-build/data/seo-data.json`.
2. Append one object to `countries` using the **same keys** as the others. Copy numbers from a reviewed source (the Tax module, counsel, or a signed briefing). Do not guess:
   - `id` — two-letter id (must be unique)
   - `name`, `flag`
   - `gainTax`, `exemption`, `filing`, `note` (English strings)
3. Open `seo-build/data/meta.json` and add:
   - `slugs.en.<id>` — English URL slug (`czechia`, not `cz`)
   - `slugs.de.<id>` — German URL slug without umlauts (`oesterreich`, not `österreich`)
   - `names.de.<id>` — native German country name (Österreich is fine in the visible name)
   - `currency.<id>` — ISO code used only for FX-out-of-scope copy
   - `neighbors.<id>` — other country ids for internal links
   - `taxDe.<id>` — German translations of the **same** facts (do not change the numbers). Use Spekulationsfrist, KESt, Freigrenze, Box 3 where they apply. If a term is uncertain, put it in `"review": "REVIEW: …"` — the page will show that marker instead of inventing a statute.
4. Run generate + verify. Failures usually mean: title/description too long, answer block outside 40–60 words, or a missing slug.
5. Commit. New URLs:
   - `/bitcoin-tax/<en-slug>/`
   - `/buy-bitcoin/<en-slug>/`
   - `/de/bitcoin-steuern/<de-slug>/`

You should **not** need to edit `generate.mjs` for an 12th country that follows this shape.

## Add a language (beyond EN/DE)

The generator currently emits English plus the German pilot. A third language is a small code change (new `slugs.<lang>`, chrome strings in `lib/html.mjs`, and a page loop). Until that exists:

- Do **not** hand-translate generated HTML; it will be overwritten on the next build.
- Do **not** add fake `hreflang` to cs/sk/ru/uk unless a true counterpart URL exists. Existing `tax.html` translations are a different page, not alternates of `/bitcoin-tax/czechia/`.

When a language is added, reciprocal `hreflang` (including `x-default` → English) is generated automatically for pairs that exist.

## Change a fee

Edit `seo-build/data/fee-schedule-live.json` only when the live Stacking module’s `FEE_SCHEDULE` changes. Copy `pct`, `fixed`, `monthly` exactly. Then generate. The Q3 2026 archive URL stays as a snapshot of whatever was in the file when that vintage was frozen; if you need a new quarter, add a new `asOf` and an archive path in the generator (that part is a code change, on purpose, so old citations do not move).

## Change inheritance checklist copy

Edit `seo-build/data/inheritance.json` (EN) and `meta.json` → `inheritanceDe` (DE). Keep seed-phrase guidance: the letter of instruction must never contain seeds.

## What not to do

- Do not invent Banxa / “Virtuse Bots” rows for indexable pages; the live module uses 21bitcoin, ByBit EU, Kraken, RevenueBot.
- Do not overwrite `tax.html` (category) with the Tax Agent. The agent is `tax-agent.html`.
- Do not add `lang-detect.js` to these directory URLs: it treats `index.html` as the homepage and would redirect Slovak browsers into a 404 under `/bitcoin-tax/czechia/sk/`.
- Do not claim Virtuse holds keys, funds, or partner KYC data.
