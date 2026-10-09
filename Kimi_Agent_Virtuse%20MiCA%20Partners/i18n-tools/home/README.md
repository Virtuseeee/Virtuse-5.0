# Homepage translations

The 9 language homepages (`<lang>/index.html`) are generated from the English `index.html` plus `<lang>.json`.
Each language keeps its own head tags (title, description, Open Graph, canonical, JSON-LD), read from its current `index.html`.

1. After changing English homepage text, rebuild `en_strings.json` from `strings.segments()` on `index.html`
   (visible text plus aria-label / alt / placeholder / title) and the script messages listed in `build_lang.py`.
2. Translate new or changed keys in each `<lang>.json` (rules in `BRIEF.md`). `python3 check.py <lang>` must report 0 problems.
3. `python3 build_lang.py sk cs pl de fr es hu uk ru`, then `python3 linkcheck.py <lang>`.
4. Check 320 / 375 / 1440 px in the browser.

Calls outside SK/CS/EN run in English, so the builder adds "(in English)" after the call link for de, fr, es, pl, hu, uk and ru.
