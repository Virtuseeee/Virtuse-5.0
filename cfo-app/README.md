# Virtuse CFO – prototype (phase 1)

Local-first wealth overview for investor and partner demos. Not deployed anywhere yet.

```bash
cd cfo-app
npm ci
npm test        # 36 tests: CSV, imports, prices/FX, portfolio math, upload summary, vault
npm run prices  # refresh src/data/prices.json (ECB rates + last closes)
npm run dev     # http://localhost:5181
npm run build   # dist/
```

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

## Layout

- `src/core/` – trust layer, no network: model, CSV parser, importers, portfolio math, upload summary, vault. Planned to be published under AGPL.
- `src/data/demo.ts` – Anna's synthetic Kraken file and profile.
- `src/ui/` – React screens, SK/EN strings.

## Rules

Facts about the user's own numbers only. No buy/sell/hold or timing advice, no orders, no custody. New importers (XTB, IBKR, Trading 212) go in `src/core/importers/` with a fixture and tests.
