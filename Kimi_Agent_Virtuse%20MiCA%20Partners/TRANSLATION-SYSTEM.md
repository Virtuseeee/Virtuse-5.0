# Translation system

How Virtuse's static pages get translated, and how to add the next page or
the next language. Piloted on `sk/index.html` (Aug 2026); the full site
rollout (20 pages) completed the same month — read `sk/index.html`
alongside this doc as the reference implementation, and see
[`i18n-tools/`](i18n-tools/) for the scripts that did the mechanical work.

**Status: Slovak and Ukrainian are both done; Czech is next.** All 21
non-blog pages (the original 20, plus `root-cycles.html` — a separate,
real page from `rainbow-chart.html`, not a duplicate, see "Known site
quirk" below) have both a `sk/` and a `uk/` counterpart, each with
reciprocal `hreflang`, a working `sitemap.xml` entry, and the nav
language switcher wired for all three languages (EN/SK/UK). The desktop
switcher was redesigned from a 3-pill row into a compact single-button
dropdown partway through the UK rollout — see "Language switcher" below
for the current markup. `blog-sk.html`/`article.html` stay outside the
folder convention by design (see below); `uk/blog.html` is an exception —
it *does* exist (UI/nav translated) but still pulls WordPress category 13
(the English feed), since no Ukrainian WP category exists yet. The legal
pages (`privacy-policy`, `terms-and-conditions`, `aml-compliance`) were
AI-translated for both languages using precise legal terminology and EU
regulation citations kept verbatim, but per the project's own QA
guidance these carry real regulatory exposure and should get an actual
human legal read-through before anyone treats them as final — that
review hasn't happened yet for either language, and both are already
live on production, not just staging.

See [`i18n-tools/README.md`](i18n-tools/README.md) for the current
tooling (the UK-era scripts, not the original SK-era ones, are the
template for the next language) and its "Adding the next language"
section for the concrete Czech (`cs/`) plan.

## URL scheme

Each language gets its own folder mirroring the root filenames:

```
/index.html          <- English (canonical, unprefixed)
/sk/index.html        <- Slovak
/uk/index.html        <- Ukrainian
/cs/index.html        <- (next) Czech
```

No `.htaccess` or server config is needed — these are just real static
files in real subdirectories, which Apache serves natively. A translated
page lives at `<lang>/<same-filename>.html` and needs three path fixes
relative to the English original:

- Shared assets go up one level: `href="styles.css"` → `href="../styles.css"`,
  same for favicons, `apple-touch-icon.png`, and any `logo-*.png` images.
- Links to pages that **aren't translated yet** also go up one level and
  keep the English filename: `href="mining.html"` → `href="../mining.html"`.
  This is expected and fine — a Slovak visitor clicking "Ťažba" lands on
  the English Mining page until that page is translated too.
- Links to pages that **are** translated point at the sibling file in the
  same language folder, e.g. `href="index.html"` (self) or, once it
  exists, `href="../mining.html"` → a same-language `mining.html` inside
  `sk/`.
- The nav logo (`<a href="/">`) becomes `<a href="/sk/">` so it stays on
  the Slovak homepage rather than dropping back to English.

`blog.html`/`blog-sk.html` predate this convention (suffix-based, not a
folder) and stay as-is by design — see the decision log below.

## Language switcher

Every language option — on both switcher UIs below — is a
`.lang-opt[lang="xx"]` anchor (e.g. `<a href="sk/index.html" class="lang-opt"
lang="sk">`). Anything that needs to read or write a language link only
ever has to target that one selector; it's stable across the redesign
below.

1. **Desktop nav bar** (≥1025px) — a compact single-button dropdown:
   `.nav-actions > .lang-menu` containing a `.lang-menu-btn` (shows the
   current language) that toggles a `.lang-menu-panel` listing every
   `.lang-opt`. **This replaced the original 3-pill `.nav-lang-switch`
   row** partway through the UK rollout (`i18n-tools/dropdown_retrofit.py`)
   — the pill row wrapped/overflowed once a 3rd language with longer
   labels (Ukrainian) was added. If you're looking at an older page or
   screenshot with a visible EN/SK pill row in the desktop nav, that's
   the pre-dropdown markup; copy the dropdown pattern for anything new.
2. **Mobile full-screen menu** (≤1024px) — unchanged since the SK rollout:
   `<li class="nav-links-lang-item"><div class="lang-switch">...</div></li>`
   inside `.nav-links`, a plain list of `.lang-opt` pills.

Both instances list every live language's sibling page. Copy the exact
current markup from `index.html` (search `lang-menu` for desktop,
`nav-links-lang-item` for mobile) onto every page you translate, in the
English original and every translated counterpart — a page without a
translated sibling yet should **not** list that language (see blog.html
precedent: `uk/blog.html` only appears in the switcher once it exists).

## `<head>` requirements for a translated page

Every translated page (and its English source, once a translation exists)
needs, in addition to the translated `<title>`/OG/Twitter tags:

```html
<html lang="sk">  <!-- or en, de, ... -->
...
<link rel="alternate" hreflang="en" href="https://staging.virtuse.com/index.html">
<link rel="alternate" hreflang="sk" href="https://staging.virtuse.com/sk/index.html">
<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/index.html">
```

`hreflang` tags are reciprocal — the English page must list the Slovak
alternate and vice versa, or search engines ignore them. `x-default`
always points at the English version (the fallback for languages we don't
have yet). Also add the same three `<xhtml:link>` alternates to the page's
entry in [sitemap.xml](sitemap.xml) (see the `index.html`/`sk/index.html`
entries there for the exact format).

Note: this repo's OG/canonical URLs currently point at
`staging.virtuse.com` site-wide, not the production `virtuse.com` domain —
that's a pre-existing state unrelated to translation; new pages should
just match whatever the rest of the site is doing at the time so they
don't stick out.

## The blog is a separate, mostly-solved system

`blog.html`/`blog-sk.html`/`article.html?...&lang=sk` don't follow the
folder convention above because they don't need to: post content comes
live from `blog.virtuse.com`'s WordPress/WPML install, which already has
a `/sk/wp-json/...` Slovak REST endpoint (category 26) alongside the
default `/wp-json/...` English one (category 13). `sk/index.html`'s "Blog"
teaser panel fetches from that same `/sk/` endpoint — see the `<script>`
block in `sk/index.html` for the pattern if another page needs a live
blog feed. Translating a *new* blog post is a WordPress/WPML task, not a
static-HTML task.

**`uk/blog.html` is the exception, and it's a half-measure.** It exists
(nav/UI translated to Ukrainian) but its feed config still points at
`category: 13` — the same default English feed `blog.html` uses — because
there's no Ukrainian WP category yet. So a Ukrainian visitor gets a
Ukrainian-language page shell showing English article titles/excerpts.
This is a reasonable stopgap, not a bug, but don't assume `uk/blog.html`'s
existence means Ukrainian blog content exists — it doesn't yet. Same
choice will need making for Czech: either skip `cs/blog.html` entirely
(matching SK's approach) or ship the same shell-only stopgap (matching
UK's), until a real Czech WP category exists.

## Known gap: the newsletter Worker's error strings

The subscribe form on every page posts to the Cloudflare Worker at
`cloudflare-worker/src/index.js`. Its own validation error strings
("Please enter a valid email address.", the rate-limit message, etc.) are
hardcoded English and returned as-is regardless of what page called it.
`sk/index.html`'s success/network-error messages are translated
client-side, but a server-rejected submission (bad email, rate limit)
will still show English text. Fixing this needs the Worker to accept a
`lang` field and hold parallel string tables — worth doing once more than
one or two pages are live, not blocking for the pilot.

## Glossary (English → Slovak)

Keep these consistent across every page — a term translated two different
ways on two pages reads as sloppy and hurts search relevance for both.

| English | Slovak | Notes |
|---|---|---|
| Buy Bitcoin | Kúpiť Bitcoin | |
| Mining | Ťažba | |
| Loans | Pôžičky | |
| Custody | Úschova | |
| Treasury | Treasury | kept — standard even in Slovak financial press |
| Tax | Dane | ; "Tax Reporting" → "Daňové priznania" |
| Bots / Trading Bots | Boty / Obchodné boty | |
| About | O nás | |
| Research | Výskum | ; "Media & Research" → "Médiá a výskum" |
| Bitcoin Data | Bitcoin dáta | |
| Vetted / preverené | Preverené | consistent across hero stats + problem cards |
| MiCA-licensed | s licenciou MiCA | |
| Custody (as a noun, "self-custody") | (vlastná) úschova | |
| Get Started | Začať | |
| FAQ | FAQ | kept — universally recognized |
| Terms & Conditions | Obchodné podmienky | |
| Privacy Policy | Ochrana osobných údajov | |
| AML & Compliance | AML a Compliance | "compliance" kept, standard fintech usage |
| Hub | centrum | "Bitcoin-Only Hub" → "centrum len pre Bitcoin" |
| DCA | DCA | kept, well-known term |
| p.a. (per annum) | p.a. | kept |

Bitcoin itself, satoshi/sat, BTC, CASP, KYC, and EU/EÚ country names follow
standard Slovak fintech/crypto press usage — don't over-translate them.

## How each page actually got translated

For each page: run `python3 i18n-tools/scaffold_sk.py "<page>.html" "<SK
title>" "<SK og:description>"` to duplicate into `sk/<page>.html` and
handle every mechanical piece (paths, nav labels, newsletter/footer,
hreflang, lang switcher), then hand-translate the page-specific prose
(hero, body sections, partner cards, form labels) using the glossary
below, then run `python3 i18n-tools/sitemap_add.py "<page>.html"` and
`python3 i18n-tools/wire_root.py "<page>.html"` to wire the sitemap entry
and the English original's reciprocal switcher, then spot-check in a
browser (nav, mobile menu, all internal links resolve, no leftover
English via `grep -oE '>[A-Z][a-zA-Z ...]{3,80}<'` over the body).

Two page types needed extra care beyond the scaffold:

- **Data/tool pages** (`bitcoin-data`, `btc-dominance`, `ma-200w`,
  `rainbow-chart`, `retirement-calculator`) have JS-generated strings
  (chart tooltips, band/regime labels, `timeAgo()`-style relative time,
  `toLocaleDateString`/`toLocaleTimeString` locale codes) that the
  scaffold script can't see — these were found by grepping each script
  block for `textContent =`/`innerHTML =` assignments and translated by
  hand. `eur()`/plain-number formatting was switched to the `sk-SK` Intl
  locale (space thousands separator); `usd()` and `compact()`/K-M-B
  notation were deliberately left on `en-US` since Slovak's compact
  abbreviations ("mil.", "mld.") read oddly appended to a hand-written
  unit suffix like "EH/s".
- **The five data/tool pages cross-link to each other** via a `subnav`
  bar — once all five existed, those links were pointed at the sibling
  `sk/` pages directly rather than falling back to `../`.

## Known site quirk: `rainbow-chart.html` vs `root-cycles.html`

These are two **different, real** pages, not a stray duplicate — a
different tool/methodology presentation, meaningfully different content,
both sitemapped and hreflang-wired at every language level (root, `sk/`,
`uk/`). If you're scaffolding a new language, both need translating; if
you're auditing for missed pages (like [`lang-detect.js`](lang-detect.js)'s
browser-redirect mapping, which missed `root-cycles.html` for a while
after it shipped), check for both filenames, not just one.

## Adding the next language

Once two or three languages exist, repeat this process with a new folder
(`sk/`, `uk/`, `cs/`, ...) and extend every language switcher — **both**
the desktop dropdown and the mobile pill list — with the new option. No
other architecture changes needed — this is why the folder +
shared-component approach was chosen over the original filename-suffix
pattern. See [`i18n-tools/README.md`](i18n-tools/README.md)'s "Adding the
next language" section for the concrete script-by-script Czech plan —
copy the **UK-era** scripts (`scaffold_uk.py` etc.), not the original
SK-era ones, since they already handle the dropdown switcher and the
no-em-dash house rule adopted for UK.

## Decision log

- **Folder-per-language (`/sk/`), not filename suffix** — chosen over
  continuing the `-sk.html` pattern from blog-sk.html because it scales
  to more languages without the site's file listing turning into
  `about.html`, `about-sk.html`, `about-de.html`, `about-cs.html`..., and
  because clean per-language URLs are better for `hreflang`/SEO. Confirmed
  with the user 2026-08-23.
- **`blog-sk.html` stays on its old pattern** — it's already live and
  indexed; migrating it into `/sk/blog.html` would need a 301 redirect
  and carries SEO risk for no real benefit. Confirmed with the user
  2026-08-23.
- **Translation QA**: AI-drafted translation + the team's own review pass
  for most pages; a professional or legal translator specifically for the
  compliance pages (privacy policy, terms, AML) given MiCA regulatory
  exposure if those are mistranslated. Confirmed with the user 2026-08-23.
- **Desktop switcher redesigned as a dropdown, not a 3rd pill** — the
  original `.nav-lang-switch` pill row was sized for 2 languages; adding
  Ukrainian's longer labels as a 3rd pill made it wrap/overflow at real
  viewport widths. Rather than keep shrinking type to fit more pills as
  more languages are added, switched to a single compact button that
  opens a dropdown — scales to any number of languages without further
  nav redesign. Mobile kept the original pill list (screen width isn't
  the constraint there).
- **`uk/blog.html` ships as a UI-only shell** (English WordPress feed,
  Ukrainian chrome) rather than being skipped like SK's blog was — a
  deliberate stopgap so the switcher doesn't have a language option that
  goes nowhere, accepting that the content itself won't be Ukrainian
  until a WP category exists.
