# virtuse.com content, IA and conversion audit (read-only, 15 Oct 2026)

Source: local worktree `scratchpad/wt-audit/Kimi_Agent_Virtuse%20MiCA%20Partners` (HEAD `2c22de03`).
Parsed 518 HTML pages: all languages and SEO folders, excluding `stories/`, `i18n-tools/`, `vendor/` and `blog-translations-ru/`.
Static HTML only. The React app bodies (Partner Finder, Stacking, Loan, Tax Agent) and JS-swapped Brief cards were **not** audited; their shells were.
Scripts and data: `scratchpad/audit/parse.py`, `pages.json`, `outbody.json`, `en_leftovers.json`.

Effort: S = under 2 h, M = half a day to 2 days, L = more than 2 days.

---

## Summary

The v2 service pages (buy, custody, loans, mining, treasury, tax, bots) and the Fee Index are in good shape. Each has a referral disclosure, a "not advice" line and licence lines.

The main problems are in three places:
1. **Older templates that were never cleaned up.** These are the FAQ, the legal pages, the dashboards and the seo-build pages.
2. **Facts that disagree between pages.** These are the buy ranking, the CFO offer and partner stats.
3. **Missing next steps.** The SEO guides and dashboards that rank in search are the weakest at leading readers anywhere.

---

## P0: fix before the CFO launch (1 Nov) or as soon as possible

### P0-1. The FAQ breaks the MiCA wording rules in all 10 languages
`faq.html` and its 9 translations use the old template and were never cleaned up. Quotes from EN:
- "Virtuse is the world's first hub for Bitcoin-only services." This was removed everywhere else.
  - Also present as de "weltweit erste", pl "pierwszy na świecie", hu "világ első", uk "перший у світі" and ru "первым в мире".
- "we vet the best licensed providers in each category".
  - Also present as sk "najlepších", cs "nejlepší", de "besten", fr "meilleurs", es "mejores", pl "najlepszych", hu "legjobb", uk "найкращих" and ru "лучших".
- "For long-term holdings we recommend hardware wallets from our custody partners".
  - Also present as de "empfehlen wir", es "recomendamos" and pl "polecamy".
- "we recommend withdrawing to your own hardware wallet", "our focus and recommendations are strictly Bitcoin", "fiduciary alignment".
- "Virtuse holds no funds, no keys, and no client data." This is false: Brief and CFO waitlist emails are collected.
- Unsourced claims:
  - "serving clients in over 100 countries"
  - "Ledger (… 7M+ devices sold)"
  - "21bitcoin … savings plans … with zero fees" (the first 7 days cost 0.99%)
  - "Miners receive rewards paid out daily"
- Partner naming: it says "Coinbase Institutional" while treasury.html says "Coinbase Prime".
- Disclosure wording differs from the rest of the site: "Virtuse earns a referral fee from partners when you sign up". Other pages say "Some partners pay…".

**Fix:** Rebuild the FAQ with the v2 builder from a reviewed fact sheet, using the same neutral wording as the homepage Quick answers. Also move it onto the v2 nav (see P1-1). **Effort: M.**

### P0-2. The buy-cost ranking contradicts itself across about 170 pages
- **Fee Index** (`/bitcoin-fee-index/` and 10 language versions): "At €100 a month, Bybit EU has the lowest total cost (0.25%), followed by Kraken Pro (0.8%)". 21bitcoin is listed last with "Est. spread: Being measured".
- **Homepage, 10 languages**: "Buy Bitcoin from 0% fees." / "Top 3 by fee", with 21bitcoin first.
- **buy-bitcoin.html, 10 languages**: 21bitcoin badge "Lowest fee", "Sorted by published fee".
- **13 EN `buy-bitcoin/<country>/` pages, the DCA calculator and its 9 translations:**
  - Quote: "As of Q4 2026, the cheapest buy route on the Virtuse Fee Index at €100/month is 21bitcoin". This names the Fee Index, which says the opposite.
  - Meta description: "Cheapest EU bitcoin buy route for Poland as of Q4 2026: 21bitcoin at 0%".
- The word "cheapest" appears 109 times on 30 EN pages. "Lowest" appears 27 times on 19 pages.

**Fix:**
- Define two labelled metrics: "lowest published fee" for the homepage and buy page, and "lowest total cost incl. spread" for the Fee Index.
- Regenerate the seo-build buy-country, DCA and buy-bitcoin pages from `seo-build/data/fee-index.json`, so they cite the same ranking with the same "checked 12 Oct 2026" date.
- Drop "cheapest" from titles and meta descriptions. Use "fees compared" instead.
- Drop "Top 3" on the homepage. Partner Finder already dropped "top-3".

**Effort: M.**

### P0-3. Claims removed from Partner Finder on 12 Oct are still on category pages in 10 languages
CLAUDE.md lists them as removed (insured custody, 100,000+ users, SatoshiLabs, 7M+, $250M, …), but the category pages still show:

| Page | Unsourced claim still shown |
|---|---|
| buy-bitcoin.html | 21bitcoin: "with insured Bitcoin custody", bullet "Insured Bitcoin custody", "100,000+ European users". Invity: "from the SatoshiLabs group". All present in 10 languages (sk "poistenou", de "versicherter", fr "assurée", es "asegurada", pl "ubezpieczonym", hu "biztosított", uk/ru "застрахован…"). |
| secure.html (+ faq) | Ledger: "Over 7 million devices sold", "7M+ devices sold worldwide". Present in 12 pages across the translations. |
| treasury.html | BitGo: "$250M insurance coverage". Coinbase: "$320M cold storage coverage". |
| lending.html | Firefish: "EUR 22.5M funded", "8,600 investors". No source or date. |
| tax.html | CoinTracking: "1.9M+ users". Blockpit: "official partner of Bitpanda and BISON", "Blockpit … 7+ EU". |
| mining.html | Power Mining: "22,000+ products sold". |
| bitcoin-fee-index/2026-q3/ (archive, indexable) | "FMA MiCAR-licensed, insured custody". |

**Fix:** Apply the Partner Finder rule. Every figure needs a Source link and "checked <date>", or it is removed. Update the per-page builders' `<lang>.json` and rebuild. **Effort: M.**

### P0-4. The CFO offer is described three different ways
- **cfo.html:**
  - "Free audit · opens 1 Nov" and "Founding price, when paid plans open in January: €9 / month, €90 / year".
  - It describes the product as "Your AI CFO for Bitcoin", a personal fee audit.
  - It is `noindex` and only links to `index.html` and `privacy-policy.html` in the body, so it is a dead end apart from the form.
- **about.html, retirement-calculator.html and the translations** (sk "1. novembra: 9 €/mesiac alebo 90 €/rok", de the same): "Launches 1 November: €9/month or €90/year." This implies paid plans start on 1 Nov, which contradicts the "January" on cfo.html.
- **Related-tool cards** on stacking, loan, tax-agent, retirement-calculator and concierge: "Virtuse CFO – Bitcoin treasury for companies."
  - stacking FAQ: "For those, Virtuse CFO helps plan, track and report a Bitcoin treasury."
  - This is a different product promise (companies and treasury) from cfo.html (individual fee audit).
- **Waitlist count:** cfo.html line 647 has a hardcoded "136 people on the waitlist" (`#waitCount`). CLAUDE.md records it as a fixed number that must be replaced by the real Resend count. It is still static 17 days before launch.

**Fix:**
- Use one shared CFO blurb string per language, for example "Free fee audit from 1 Nov; paid plans from January: €9/month or €90/year". Use it in every tool card and in about/retirement.
- Remove "for companies" unless that is the intended positioning.
- Wire the counter to the real count, or remove it.

**Effort: S.**

### P0-5. The privacy policy does not cover what the CFO page collects or does
The privacy policy is dated "Effective 20 July 2026". It never mentions:
- the waitlist, CFO, Resend, Cloudflare (Worker), Calendly, localStorage, or the `/send` result emails;
- what the AI CFO sends. cfo.html says "The question and your totals are sent". The processor and the data location are not named.

Section 4 (cookies) was rewritten on 2 Oct and GTM changed, but the effective date was not updated. The terms page is "Effective 20 August 2026". No page shows a company registration number.

**Fix:**
- Legal update before 1 Nov: list the processors, the waitlist/Brief/result-email purposes, AI processing and retention.
- Bump the effective date in all 10 languages.

**Effort: M** (legal review).

---

## P1

### P1-1. There are four separate navigation systems
| Template | Pages (EN; ×10 langs) | Nav |
|---|---|---|
| v2 / homepage | index, cfo, the 7 service pages, the 5 tools, about, bitcoin-data, Fee Index | Services / Learn / Tools (CFO, Partner Finder, Stacking, Loan, Tax Agent, Retirement) |
| Old (pre-v2) | faq, privacy, terms, aml, asset-returns, btc-monthly-returns, btc-dominance, fear-greed, ma-200w, rainbow-chart, root-cycles, trading-volume, 404 (about 120 pages) | 11 flat items. **No Fee Index, CFO, Partner Finder, Stacking, Loan or Tax Agent.** Subscribe forms post without `lang` (P1-4). |
| Brief | news, blog, blog-sk, article | Brief anchors only, no services |
| seo-build | bitcoin-tax (14 + 13 DAC8), buy-bitcoin/<country> (13, EN only), DCA, sell-vs-borrow, inheritance, plus translations | "Tax guides · Fee Index · DCA · Partner Finder" only. No Buy, Custody, Loans, etc. |

**German SEO pilot pages link to English pages:**
- This affects `de/bitcoin-steuern/*`, `de/bitcoin-dca-rechner/` and similar: 174 links in total.
- The nav "Home" goes to `/index.html`, not `/de/`. Fee Index goes to `/bitcoin-fee-index/`, not `/de/bitcoin-gebuehrenindex/`. Partner Finder goes to EN `concierge.html`.
- The body links both `tax-agent.html?country=de` (EN) and `de/tax-agent.html`. The footer privacy and terms links point to EN.
- Other languages' SEO pages are correct. Only the 3 fee-index methodology links point to EN, and that page has no translation.

**Fix:** Port the old-template pages and the seo-build chrome onto the v2 nav/footer partials. At least make the seo-build header use the v2 nav and per-language home, fee-index, concierge and legal URLs. **Effort: L** (M for the DE link fix alone).

### P1-2. Several pages compete for the same search intent
| Intent | Competing pages | Problem |
|---|---|---|
| Buy fees / DCA | buy-bitcoin.html ("Compare MiCA Fees"), /bitcoin-fee-index/, /bitcoin-dca-calculator/ ("EU fees 2026"), stacking.html ("DCA plan and fee comparison"), 13 /buy-bitcoin/<country>/, retirement-calculator | Five page types answer "what does buying cost", and their rankings differ (P0-2). The noindex stubs `calculator.html` and `bitcoin-calculator.html` also exist. |
| Sell vs borrow | lending.html, loan.html (Loan Copilot), /sell-vs-borrow-bitcoin/ | `lending.html` links to sell-vs-borrow but **not to loan.html**. Sell-vs-borrow links to loan.html but not to lending.html (Firefish). |
| Tax | tax.html (software), tax-agent.html ("13 EU Countries"), /bitcoin-tax/ ("Bitcoin tax in 13 EU countries (2026)") | tax-agent and the bitcoin-tax hub have near-identical titles. tax.html is titled "Tax Software Compared" but its hero says "Bitcoin taxes, sorted. Your country's rules…". |
| Inheritance | tax-agent.html (Inheritance Agent), /bitcoin-inheritance/ | Two checklists that are not clearly differentiated. |
| News / content | news.html (Brief), blog.html, blog-sk.html, article.html, /stories/<slug>/, satoshi.html | `satoshi.html` is indexable, has its canonical at `https://satoshi.virtuse.com/`, and meta-refreshes to news.html, which sends mixed signals. |
| Embeds | /bitcoin-fee-index/embed/ is `index, follow` | This duplicates the Fee Index content. |

**Fix:**
- Pick one owner page per intent: Fee Index for cost, loan.html for sell vs borrow, the bitcoin-tax hub for country rules, tax.html for tools.
- Retitle the others to their secondary job, for example the tax-agent title becomes "Tax & Inheritance Agent: check your country interactively".
- Cross-link every page in a cluster.
- Set `noindex` on embed/ and satoshi.html, or remove them.

**Effort: M.**

### P1-3. Dead ends and missing next steps (body links only, nav/footer excluded)
- **Dashboards** (fear-greed, ma-200w, rainbow-chart, root-cycles, trading-volume, btc-dominance, btc-monthly-returns, asset-returns, ×10 languages): **0 body links** to a service, tool or Brief other than the sub-nav. These rank in search, so they waste that traffic.
- **secure.html:** the body links only to the Brief and the article. There is no link to /bitcoin-inheritance/, multisig/treasury or Partner Finder.
- **/bitcoin-inheritance/:** links to tax pages and tax-agent, but **not to secure.html** (hardware wallets, multisig), which is the natural next step.
- **mining.html:** the only internal next step is the tax hub.
- **/bitcoin-tax/<country>/** (13 EN + translations): **no link to tax.html**, so the reader of the country rules never sees the reporting-tool comparison (Koinly/Blockpit/Divly/CoinTracking), which is where the revenue is.
- **/buy-bitcoin/<country>/** (13):
  - They say "the cheapest buy route … is 21bitcoin", yet link to neither buy-bitcoin.html nor the partner.
  - 10 of the 13 have exactly **1 inbound link**. Only CZ, DE and SK are linked from buy-bitcoin.html.
- **DAC8 pages** (13 EN): 1–2 inbound links each.
- **cfo.html:** no links to tools or the Fee Index in the body (see P0-4).

**Fix:** Add a "Next step" or related block to the seo-build templates, the dashboard template and secure/mining:
- tax guide → tax.html + tax-agent
- buy-country → buy-bitcoin.html#<partner> + Fee Index
- inheritance → secure.html
- dashboards → Stacking / Fee Index / Brief

**Effort: M.**

### P1-4. Brief signups lose their language on 36 pages
The old-template pages post `JSON.stringify({ email, hp })` without `lang`:
- `sk/fear-greed.html` and `sk/trading-volume.html`. **Slovak readers get the English welcome email and go into the wrong Resend segment.**
- 11 de pages and 11 ru pages.
- 12 EN pages.

Full list: faq, privacy, terms, aml, asset-returns, btc-monthly-returns, btc-dominance, fear-greed, ma-200w, rainbow-chart, root-cycles and trading-volume, each in EN/de/ru, plus sk fear-greed and sk trading-volume.

**Fix:** Add `lang: document.documentElement.lang` to these forms, or switch them to `site-v2.js`. **Effort: S.**

### P1-5. Mixed "as of" labels on the same page
- **/bitcoin-tax/<country>/:** the title "Bitcoin tax in Germany (Q3 2026)" and "Data as of Q3 2026" sit next to "Updated 13 Oct 2026" and "checked 13 Oct 2026", which is Q4.
- **tax-agent.html footer:** "As of Q3 2026".
- **Buy pricing:** buy-country pages, buy-bitcoin.html and the homepage use "Q4 2026" with no Source link. The Fee Index and Stacking use "checked 12 Oct 2026" with a Source link.
- **Homepage static Brief card:** "Latest Brief · 5 Oct 2026" (JS swaps it). The newest issue in `news/issues.json` is 12 Oct. Crawlers and no-JS readers see the stale issue, and translated homepages show its English dek ("Up 65% against gold since the February low…") on 9 languages.

**Fix:**
- Use one date convention: "checked DD Mon YYYY" with a Source link.
- Generate the static Brief card from issues.json in the deploy step.

**Effort: S–M.**

### P1-6. Affiliate links are tagged inconsistently and partner names vary
- **rel="sponsored":** 440 of 592 partner links (70 pages: every category page in 10 languages) carry `rel="noopener noreferrer"` without `sponsored`. The Fee Index, Stacking and Partner Finder links do use `rel="sponsored noopener"`.
- **Brand spellings** in visible text:
  - "ByBit EU" ×170 vs "Bybit EU" ×190. buy-bitcoin uses both in the same card: "ByBit EU … Bybit EU GmbH is MiCAR-licensed".
  - "Power Mining" ×20 vs "Power Mining" ×50.
  - "Coinbase Prime" vs "Coinbase Institutional".
- **Disclosure wording** varies between "may pay", "Some partners pay", "earns a referral fee from partners when you sign up" (FAQ), and none at all (stacking/loan/tax-agent shells; check the apps).

**Fix:**
- Add `sponsored` in the category builders.
- Normalise names from `data/partners.json` (`Bybit EU`, `Power Mining`).
- Use one disclosure string per language.

**Effort: S.**

---

## P2

### P2-1. Em/en dashes still in visible text
- **447 em dashes on 214 pages** (EN 151, ru 63, uk 58, sk 35, fr/es 30, cs 26, pl/hu/de 18).
- **Worst EN pages:** terms-and-conditions 22, privacy-policy 21, faq 18, aml-compliance 17, rainbow-chart 9, root-cycles 9, trading-volume 8.
- **Titles** use "… — Virtuse" on every old-template page:
  - "Privacy Policy — Virtuse"
  - "Bitcoin Rainbow Chart — Virtuse"
  - "Page Not Found — Virtuse"
  - and others.
- **Spaced en dash used as a sentence dash:** 103 occurrences on 80 pages (de/privacy-policy 7, /bitcoin-inheritance/ 6, …).
- Some are "—" used as empty-value placeholders in dashboard tiles before JS loads (article, btc-dominance, ma-200w).
- **Decision needed for RU/UK:** in "У каждого — самый важный факт" and "Virtuse — це…" the dash is grammatical (the copula), not a style dash.

**Fix:** Rewrite the dashes when these templates move to v2. Use "|" in titles. **Effort: S–M.**

### P2-2. Footer copyright has three variants
- "©2018 - 2026 Virtuse Group." (spaced hyphen) on 43 EN seo-build pages and their translations.
- "© 2018–2026 Virtuse Group. All rights reserved." on 34 pages.
- "© Virtuse Group. All rights reserved." on news.html.

**Effort: S.**

### P2-3. Language parity gaps
- **Missing pages:**
  - `fear-greed.html` and `trading-volume.html` do not exist in cs/uk/ru (links fall back to EN). Their hreflang omits cs/uk/ru, which is correct.
  - `/buy-bitcoin/<country>/` (13) and Fee Index methodology/embed/print are EN only.
  - `news.html` is EN only. There is no `sk/blog.html` (blog-sk.html is used instead).
- **English text on translated pages:**
  - The 8 translated `<lang>/blog.html` pages show English post titles and excerpts (WordPress EN feed; 21 English blocks each).
  - The tool names stay in English on purpose: Partner Finder, Stacking Strategist, Loan & Liquidity Copilot, Tax & Inheritance Agent.
  - Otherwise no English sentences were detected on translated static pages.
- **Positive:** no orphaned translation of a removed EN page was found.

### P2-4. Legal page details
- aml-compliance says "As one of Central Europe's leading digital-asset platforms at the time". This is historical, but self-promotional and unsourced.
- about.html still reads "Virtuse … became a Bitcoin-only exchange" in the timeline. It is historical, but could be misread next to "Is Virtuse an exchange? No."

**Fix:** Add "(2019–2022)" context. **Effort: S.**

### P2-5. Breadcrumbs
- Only the seo-build pages show visible breadcrumbs ("Home / Bitcoin tax / Germany").
- The v2 pages carry BreadcrumbList JSON-LD only.
- cfo.html has none.

Low priority. Optional visible crumb for the tool and guide pages.

---

## Conversion paths from the homepage (EN)

| Intent | Shortest path | Clicks to partner/tool/signup | Friction |
|---|---|---|---|
| Buy | Home "See all 5 buy partners" → buy-bitcoin.html → "Get 21bitcoin" | 2 (the homepage table has no Get buttons) | Ranking conflict (P0-2). Buy-country SEO pages have no route to a partner (P1-3). |
| Custody | Home shelf "Store" → secure.html → "Get Trezor" | 2 | No inheritance, multisig or treasury next step. |
| Loan | Home shelf "Borrow" → lending.html → "Get your loan at Firefish" | 2 | lending ↔ loan.html are not linked. The calculator is only reachable via nav Tools (P1-2). |
| Tax | Home shelf "Tax" → tax.html → tool "Get" | 2 | Tax guide readers (most SEO traffic) have no link to tax.html (P1-3). |
| Mining / Bots / Treasury | Home shelf → page → partner "Visit/Get/Contact" | 2 | Treasury has a "Book a 15-minute treasury call" CTA. Mining and bots do not. |
| Partner Finder | Hero "Find partners in 60 seconds" → 5 answers → partner | 1 + 5 answers + 1 | Fine. It is linked from 104 pages. |
| CFO waitlist | Homepage CFO section inline form "Tell me 1 Nov" | 0 (inline) | Offer wording conflicts (P0-4). |
| Brief | Homepage inline "Get the Brief" form | 0 (inline) | Forms are on almost every page (briefForm 140, old newsletterForm 114, seo-build 203). The language is lost on 36 pages (P1-4). |

Brief copy is consistent:
- "Virtuse Brief. Bitcoin-only. No tokens. No PR." / "Weekly on Monday. Unsubscribe anytime." on old pages.
- "Market, policy, mining. No tokens. No PR. One email, every Monday." on v2.

Button labels vary: "Subscribe" on old pages vs "Get the Brief" on v2.

## Numbers that are consistent (no action)
- Partner count: 22 everywhere (index, about, cfo, concierge). This matches `data/partners.json` (22 partners: buy 5, tax 4, custody 3, treasury 3, bots 3, mining 3, loans 1).
- Category counts match: "5 buy partners", "3 partners" (bots, mining, treasury).
- "13 EU countries" is consistent across 26 EN tax pages and the homepage.
- Current fees match everywhere: Kraken 0.8%, Bybit EU 0.25%. The old 0.16% and 0.1% figures appear only in the frozen 2026-Q3 archive.
- No broken internal links were found among parsed pages.
