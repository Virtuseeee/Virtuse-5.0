# Layer 2 module translation tools

Tools for translating the four Layer 2 modules (Bitcoin Concierge, Stacking Strategist,
Loan & Liquidity Copilot, Tax & Inheritance Agent) into more languages. The modules are a
React/Vite project **outside this repo** at `~/Documents/virtuse-concierge-deploy/bitcoin-concierge`
(not under git); only its build output (`concierge-assets/`) and the HTML shells live here.

| Tool | What it does |
|---|---|
| `dict.py template <lang>` | Writes `work/<lang>.todo.json` (every English source string + an empty `tr`; keeps existing translations). |
| `dict.py build <lang>` | Validates the todo file (no empty rows, placeholders `{0}` intact) and writes the project's `src/lib/i18n/<lang>.ts`. |
| `pages.py <lang> meta/<lang>.json` | Project entry pages + vite inputs + `MODULE_LANGS` (project and `concierge-launcher.js`), the 4 site shells in `<lang>/`, hreflang on every module shell, and on `<lang>/*.html`: tool links → local + the Concierge bubble. Idempotent. |
| `gen_chrome.py` | Regenerates the project's `src/lib/chrome.ts` (nav/footer) from all 10 homepages. Run after `pages.py`. |
| `deploy.py` | After `npm run build`: syncs `concierge-assets/`, rewrites asset lines in every module shell, lists removed hashes in `work/deploy_removed.txt`. |
| `tagcheck.py FILE…` | HTML tag balance for every file given. |
| `verify_md5.sh <host> <listfile>` | Compares the gh-pages worktree with a host (staging or production). |

`meta/de.json` is the example for page titles/descriptions; `work/de.todo.json` is the finished German dictionary.
How the i18n works in code: see the project's `src/lib/i18n.ts` header and CLAUDE.md (2026-09-27 entry).
