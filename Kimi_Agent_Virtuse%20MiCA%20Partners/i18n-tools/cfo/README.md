# CFO page translations

`<lang>/cfo.html` (9 languages) is generated from the English `cfo.html` plus `<lang>.json` by `build_cfo.py`
(uses the helpers in `../home/`). Title and description are translated keys; canonical and og:url point to
`/<lang>/cfo.html`; the page stays `noindex` like the English one. The language menu links each language's CFO page.

After changing English text: update `en_strings.json` (same method as `../home/README.md`), translate the new keys
(rules in `BRIEF.md`), `python3 check.py <lang>`, then `python3 build_cfo.py sk cs pl de fr es hu uk ru`.
Rebuild the homepages afterwards too if a CFO page was added or removed (their CFO links follow what exists).
