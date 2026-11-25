# Virtuse CFO – prototype (phase 1)

Local-first wealth overview for investor and partner demos. Not deployed anywhere yet.

```bash
cd cfo-app
npm ci
npm test        # 17 tests: CSV, Kraken import, portfolio math, upload summary, vault
npm run dev     # http://localhost:5181
npm run build   # dist/
```

## What it does

- **Demo: Anna** – synthetic person (SK, €500/month into Bitcoin, savings, ETFs, flat, pension, mortgage). Illustrative prices.
- **My data** – Kraken Ledgers CSV read in the browser, manual assets and debts, BTC not covered by the import.
- Overview: net worth, assets, debts, Bitcoin share, BTC held, money put in, average buy price, fees paid, allocation.
- **Save encrypted** – PBKDF2-SHA256 (310k) → AES-GCM in this browser (`localStorage`), passphrase never leaves the device.
- **What leaves your device** – the rounded totals an AI CFO would get later (`src/core/upload.ts`). The prototype sends nothing; a test fails if ids, dates, names or exact amounts appear there.

The only network call is an optional BTC/EUR price request to CoinGecko.

## Layout

- `src/core/` – trust layer, no network: model, CSV parser, importers, portfolio math, upload summary, vault. Planned to be published under AGPL.
- `src/data/demo.ts` – Anna's synthetic Kraken file and profile.
- `src/ui/` – React screens, SK/EN strings.

## Rules

Facts about the user's own numbers only. No buy/sell/hold or timing advice, no orders, no custody. New importers (XTB, IBKR, Trading 212) go in `src/core/importers/` with a fixture and tests.
