# Virtuse CFO – prototype (phase 1)

Local-first wealth overview for investor and partner demos. Not deployed anywhere yet.

```bash
cd cfo-app
npm ci
npm test        # 67 tests: CSV, imports, prices/FX, portfolio math, upload summary, vault
npm run prices  # refresh src/data/prices.json (ECB rates + last closes)
npm run dev     # http://localhost:5181
npm run build   # dist/
```

## Design

Same language as the Services and Ecosystem pages on virtuse.com (`site-v2.css`): site tokens (#08090a, #141414 cards, Inter + JetBrains Mono), one accent per screen (Overview orange, Ask purple, Research blue, Radar pink, Portfolio green, Transactions teal, Goals yellow, Data indigo) via `--c`, cards with an accent corner glow and a metallic top edge, accent border and glow on hover, cursor spotlight (`.spot`, set in `App.tsx`), mono uppercase labels, pill buttons, Treasury-style tables, eyebrow + headline page heads.

## Screens (pilot layout)

Sidebar app with eight screens, same structure as other AI-CFO products (overview, chat, research, alerts), our own copy and design:

- **Prehľad / Overview** – net worth, investments, cash, debts; assets with allocation bar; today's moves; ask-your-CFO box; debts; Radar preview; Bitcoin facts.
- **Opýtaj sa CFO / Ask your CFO** – one composer with Chat / Radar modes, history on the right (kept in memory only), disclaimer under the composer. In Radar mode a sentence becomes a Radar rule (`src/core/rules.ts`). Prototype answers are worked out on the device from the user's data (`src/core/ask.ts`) and cite their sources; questions about what to buy, sell or hold, or where prices go, get a fixed refusal. An AI model comes in phase 3 behind the same rules.
- **Výskum / Research** – centred composer, Suggested / Reports tabs (topics queued for phase 3), instruments the user holds with data from the price file, Virtuse guides.
- **Radar** – facts worth a look from the user's data (`src/core/radar.ts`): big daily moves, fees, concentration, debt share, cash share, own-wallet custody, stale or missing data. Thresholds are set by the user (stored in `localStorage`, no amounts). Own rules from sentences or templates, shown as true now / not yet.
- **Portfólio** – tabs Overview / Accounts / Assets / Debts, every priced holding with share of assets, today's move and price basis, asset-type grid.
- Own-data overview shows a setup checklist with a percentage until all six steps are done.
- **Transakcie** – tabs Bitcoin (Kraken export) and Bank (statement lines with category filter).
- Bank statements: generic CSV import (`src/core/bank.ts`, `src/core/importers/bank.ts`) for EUR accounts: Slovak/Czech/English column names, `;` or `,`, decimal commas, separate debit/credit columns, info lines above the header. Keyword categories; monthly cash flow with investing and own transfers kept apart from spending; the closing balance counts as cash. Overview card, Ask answers, Radar (subscriptions, month with spending above income) and an expense rule use it. The PSD2 sandbox will fill the same shape later.
- Chats are part of the profile, so own-data chats are saved with the encrypted vault.
- **Dane / Tax** – Slovak overview of Bitcoin sales per year (`src/core/tax-sk.ts`): FIFO cost, gain, § 8 base, 2026 band estimate and 16 % health contributions, filing deadline, official sources (same facts as `seo-build/data/tax-sources.json`). Assumptions shown on screen; stocks/ETFs left out until rules are checked.
- Overview chart: Bitcoin value vs money put in, month by month, rebuilt from transactions and the month-end BTC/EUR closes in the price file; own data also records one net-worth snapshot a day in the (encrypted) profile.
- **Ciele / Goals** – net worth, BTC, cash or debt payoff targets with progress from the user's numbers (`src/core/goals.ts`).
- **Údaje a súkromie / Data and privacy** – BTC price, imports, manual assets and debts, encrypted vault, what would leave the device.

## What it does

- **Demo: Anna** – synthetic person (SK, €500/month into Bitcoin, savings, ETFs, flat, pension, mortgage). Illustrative prices.
- **My data** – exports read in the browser (several files at once), manual assets and debts, BTC not covered by the import.
- Supported exports (all EUR accounts only for now):
  - Kraken: Ledgers CSV → Bitcoin buys, sells, fees, withdrawals.
  - XTB: Account history (Excel) → "Open positions" and "Cash operations" sheets saved as CSV; the two files merge into one account. Market value from Purchase value + Gross P/L.
  - Interactive Brokers: Activity Statement CSV, base currency EUR. Values from Net Asset Value, deposits/dividends/fees from Change in NAV (statement period), positions from Open Positions.
  - Trading 212: History export CSV. No current prices in the export, so positions are at average purchase price (flagged in the UI).
- The broker formats follow each broker's documented export; they have not yet been checked against real anonymised files. Samples in `src/data/samples/` are synthetic.
- Overview: net worth, assets, debts, Bitcoin share, BTC held, money put in, average buy price, fees paid, allocation.
- **Save encrypted** – PBKDF2-SHA256 (310k) → AES-GCM in this browser (`localStorage`), passphrase never leaves the device.
- **What leaves your device** – the rounded totals an AI CFO would get later (`src/core/upload.ts`). The prototype sends nothing; a test fails if ids, dates, names or exact amounts appear there.

## Prices and exchange rates

`src/data/prices.json` holds ECB euro reference rates and the last close for the instruments in `scripts/universe.json` (popular UCITS ETFs, a few stocks, BTC-EUR). `npm run prices` rebuilds it: ECB `eurofxref-daily.xml` and the Yahoo Finance chart API (unofficial, the same source as the site's asset-returns build; the final provider is a phase 0 decision). Failed quotes keep the last known price, marked `stale`.

Every user gets the same file, and holdings are matched to it on the device (ISIN first, then ticker aliases such as CSPX.UK → the same fund listed in EUR). Each holding shows where its value comes from: Virtuse price, the broker's own value converted at the ECB rate, or purchase price.

The prototype bundles a snapshot. In production the file would be rebuilt daily by a GitHub Action and served from Virtuse.

The only other network call is an optional live BTC/EUR request to CoinGecko.

## AI CFO (phase 4, staging only)

Ask your CFO first answers on the device (`src/core/ask.ts`). Questions about
buying, selling, holding, timing or forecasts are refused there and never sent.
Only a question the device marks `unknown` goes to the Worker's
`POST /cfo/ask`, together with `buildAiContext()` (`src/core/ai-context.ts`):
rounded totals, class shares, the last month's income and spending by
category, tax-year totals and goal progress. No holding names or symbols,
single transactions or their dates, account numbers or exact amounts.
The Data page shows that exact object under "When you ask the AI CFO".

- `src/core/ai-client.ts`: calls the Worker; only `staging.virtuse.com` and
  localhost get an endpoint, production has none. 503 (switched off), 429
  (limit) and network errors fall back to the local answer with a note.
- AI answers carry the "AI answer" tag (AI Act art. 50); declines show as
  "Out of scope".
- `test/ai-contract.test.ts` checks that the categories, classes, goal and
  debt kinds equal the Worker's lists, which reject anything else.
- Eval: `cloudflare-worker/cfo-eval/` (see the Worker README).

## Layout

- `src/core/` – trust layer, no network: model, CSV parser, importers, portfolio math, upload summary, vault. Planned to be published under AGPL.
- `src/data/demo.ts` – Anna's synthetic Kraken file and profile.
- `src/ui/` – React screens, SK/EN strings.

## Rules

Facts about the user's own numbers only. No buy/sell/hold or timing advice, no orders, no custody. New importers (XTB, IBKR, Trading 212) go in `src/core/importers/` with a fixture and tests.
