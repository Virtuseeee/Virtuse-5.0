# Layer 2 modules (source)

React/Vite source of the four Layer 2 tools: Partner Finder (`concierge.html`),
Stacking Strategist, Loan & Liquidity Copilot, Tax & Inheritance Agent, in 10
languages. Moved into git on 2026-10-07 from
`~/Documents/virtuse-concierge-deploy/bitcoin-concierge` (that copy and its
`.tgz` backups are no longer the source). The site serves only the build
output: `Kimi_Agent_Virtuse%20MiCA%20Partners/concierge-assets/` plus the 40
HTML shells (`concierge.html`, `sk/stacking.html`, ...).

## Change → build → deploy

```bash
cd layer2-src
npm ci                      # first time / after package-lock changes
npm run build               # runs scripts/check-fees.mjs first, then tsc + vite
python3 '../Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/layer2/deploy.py'   # copy into the site
```

Commit the source change **and** the rebuilt `concierge-assets/` + shells in
the same commit, then `bash deploy_site.sh <from>` from the repo root (it
uploads the new hashed assets and deletes the old ones on production).

## Guards

- `scripts/check-fees.mjs`: `FEE_SCHEDULE` in `src/lib/stacking.ts` must
  match `seo-build/data/fee-schedule-live.json` (partners, pct, fixed). When
  partner fees change, edit both, then rebuild both this and seo-build.
- `.github/workflows/layer2-verify.yml`: on every push touching this folder,
  the assets or the fee data, CI rebuilds from here and fails if the result
  differs from the committed `concierge-assets/` or shells. A build that was
  patched by hand, or source that was never rebuilt, shows up red.

## Notes

- `vite.config.ts` lists one entry per language and module (`sk-loan.html`
  etc.); the i18n tools in `i18n-tools/layer2/` (`pages.py`, `dict.py`,
  `gen_chrome.py`) edit this folder directly.
- Every build changes the hashes of shared chunks, so all shells change.
- How the translations work: header of `src/lib/i18n.ts`.
- `validate.mjs` is an old headless click-through (needs a preview server).
