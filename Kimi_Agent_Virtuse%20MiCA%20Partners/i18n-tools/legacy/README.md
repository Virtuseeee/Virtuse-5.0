# Old-template pages on the v2 shell

`build_legacy.py` ports the 114 pages that still used the old template (12 per language:
faq, the 8 Bitcoin Data dashboards, privacy-policy, terms-and-conditions, aml-compliance)
onto the design-v2 shell. Audit 2026-10-15: code.md P1-1, design.md P1-1.

```bash
python3 i18n-tools/legacy/build_legacy.py                    # all pages, all languages
python3 i18n-tools/legacy/build_legacy.py faq.html --lang=sk  # one page / language
```

- **Edit content in `src/<lang>/<page>`**, not in the built page. `src/` holds each page's old
  file (old shell included); the builder keeps its hero, sections and chart script and rebuilds
  everything around them, so a re-run never depends on the previous output.
- Shell (nav, footer, Brief card, language menu, CSP) comes from the language's homepage, like
  every v2 builder. Rebuild these pages after a homepage nav/footer change.
- Old CSS is kept but every selector is prefixed with `.legacy` (old body/nav/footer rules can't
  touch the v2 shell); the old navy palette maps to v2 surfaces; orange stays only where it means
  Bitcoin (BTC price, BTC table row, chart tooltip).
- fear-greed and trading-volume exist in 7 languages; menu entries for the missing ones go to
  that language's bitcoin-data.html.
- `deploy_site.sh` skips `i18n-tools/`, so `src/` is never uploaded.
