#!/usr/bin/env python3
"""
Scaffold a de/<page>.html from the English original: mechanical path fixes,
nav-label translation, standard newsletter/footer translation, hreflang tags
(en/sk/uk/cs/ru/de/x-default), and the language switcher (desktop dropdown +
mobile menu, now a 6-option EN/SK/UK/CS/RU/DE set). Leaves all page-specific
prose (hero, body sections, partner cards) untouched for a follow-up manual
translation pass.

Adapted from scaffold_ru.py (see i18n-tools/README.md "Adding the next
language") with the same structural approach: German is language #6 joining
an already-5-language site, so sk_exists/uk_exists/cs_exists/ru_exists are
all checked (in practice all four should already be true for every real
page).

IMPORTANT, explicit user decision for this rollout (differs from every
prior language): the blog stays English-only for German visitors, but with
its OWN de/blog.html shell (German chrome, English WordPress feed/articles,
no WPML, no lang param at all) -- NOT the "../blog.html fallback forever"
pattern CS/RU started with and had to retrofit later. This script still
points "Blog" nav links at ../blog.html for these 21 regular pages (since
de/blog.html doesn't exist yet at the point this scaffolds them) -- run
relink_de.py AFTER de/blog.html is built to flip all 21 pages' Blog nav
item to self-reference blog.html. Sequencing it this way (build blog.html
first, THEN relink) avoids ever shipping the broken intermediate state that
ru/*.html briefly had (Blog nav pointing at a not-yet-relinked target).

Language-specific notes for whoever copies this file next:
  - German capitalizes ALL nouns, not just proper nouns -- double check any
    hand-typed nav label / newsletter string against this rule when editing.
  - "Custody": SK/CS use a literal translation ("Úschova" = safekeeping);
    UK/RU use a transliteration ("Кастоді"/"Кастоди"). For German this
    script uses "Verwahrung" (literal, standard German fintech/custody
    term) -- matches the SK/CS camp, not UK/RU's.
  - "Treasury" kept as the English loanword, matching SK/CS/RU (not UK's
    full translation) -- German fintech/crypto press uses "Treasury" as a
    loanword very commonly.
  - "Bots" kept as-is -- no false-friend risk in German (unlike Czech's
    "boty" = shoes trap, see scaffold_cs.py).
  - "Research" kept as the English loanword (common in German finance
    press), not translated to "Analysen" or similar.
  - Footer "Legal" section header follows the SK/CS/RU convention
    ("Právne"->"Informácie"/"Informace"/"Информация") rather than a literal
    "Legal" translation -- German "Informationen".
  - "Privacy Policy" -> "Datenschutzerklärung" -- this is the specific,
    legally-standard German term (not a looser "Datenschutz" or literal
    "Privatsphäre-Richtlinie"); German/EU legal convention matters here.
  - "Terms & Conditions" -> "AGB" (Allgemeine Geschäftsbedingungen) --
    the universally recognized standard German abbreviation, not a fresh
    literal translation.
  - Formal register ("Sie", not "du") throughout, matching the site's
    professional/institutional tone in every other language.
  - No em dashes ("—") in any mechanically-written string, same house rule
    as every other language here. <title>/og:title/twitter:title separator
    is "|".

Usage: python3 scaffold_de.py <page.html> "<German Title (no ' — Virtuse')>" "<German og:description>"

IMPORTANT for the caller: write the German title/description arguments
WITHOUT em-dashes -- use a comma, colon, or restructure the sentence.
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAV_LABELS = [
    ("Buy Bitcoin", "Bitcoin kaufen"),
    ("Mining", "Mining"),
    ("Loans", "Kredite"),
    ("Custody", "Verwahrung"),  # literal, matches SK/CS camp -- see module docstring
    ("Treasury", "Treasury"),
    ("Tax", "Steuern"),
    ("Bots", "Bots"),
    ("Blog", "Blog"),
    ("Bitcoin Data", "Bitcoin-Daten"),
    ("About", "Über uns"),
    ("Research", "Research"),
]

PATH_FIXES = [
    (r'href="styles\.css"', 'href="../styles.css"'),
    (r'href="favicon\.svg"', 'href="../favicon.svg"'),
    (r'href="favicon-32\.png"', 'href="../favicon-32.png"'),
    (r'href="favicon-16\.png"', 'href="../favicon-16.png"'),
    (r'href="apple-touch-icon\.png"', 'href="../apple-touch-icon.png"'),
    (r'href="favicon\.ico"', 'href="../favicon.ico"'),
    (r'src="logo-', 'src="../logo-'),
    (r'src="bull-virtuse\.png"', 'src="../bull-virtuse.png"'),
    (r'src="lang-detect\.js"', 'src="../lang-detect.js"'),
]

OTHER_PAGES = [
    "mining.html", "lending.html", "secure.html", "treasury.html", "tax.html",
    "bots.html", "bitcoin-data.html", "about.html", "buy-bitcoin.html",
    "research.html", "faq.html", "terms-and-conditions.html",
    "privacy-policy.html", "aml-compliance.html", "btc-dominance.html",
    "ma-200w.html", "rainbow-chart.html", "root-cycles.html",
    "retirement-calculator.html",
]

NEWSLETTER_FOOTER = [
    ("<h2>Fix the Money, Fix the World</h2>", "<h2>Reparieren wir das Geld, reparieren wir die Welt</h2>"),
    ("<p>Join 18,000+ investors staying ahead of the curve. Get the Virtuse Report in your inbox every week.</p>",
     "<p>Schließen Sie sich mehr als 18.000 Investoren an, die immer einen Schritt voraus sind. Erhalten Sie den Virtuse Report jede Woche in Ihr Postfach.</p>"),
    ('placeholder="Enter your email"', 'placeholder="E-Mail-Adresse eingeben"'),
    ('<button type="submit">SUBSCRIBE NOW</button>', '<button type="submit">JETZT ABONNIEREN</button>'),
    ("btn.textContent = 'SENDING...';", "btn.textContent = 'WIRD GESENDET...';"),
    ('msg.textContent = "You\'re in \\u2014 check your inbox for a welcome email.";',
     'msg.textContent = "Geschafft! Prüfen Sie Ihr Postfach für die Willkommens-E-Mail.";'),
    ("msg.textContent = (result.data && result.data.error) || 'Something went wrong. Please try again.';",
     "msg.textContent = (result.data && result.data.error) || 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.';"),
    ("msg.textContent = 'Network error \\u2014 please try again.';",
     "msg.textContent = 'Netzwerkfehler. Bitte versuchen Sie es erneut.';"),
    ("<h4>Company</h4>", "<h4>Unternehmen</h4>"),
    (">About Us<", ">Über uns<"),
    ("<h4>Legal</h4>", "<h4>Informationen</h4>"),  # matches SK/CS/RU's post-review convention, not a literal "Legal" translation
    (">Terms &amp; Conditions<", ">AGB<"),
    (">Privacy Policy<", ">Datenschutzerklärung<"),
    (">AML &amp; Compliance<", ">AML und Compliance<"),
    ("<p>&copy;2018 - 2026 Virtuse Group, All Rights Reserved.</p>",
     "<p>&copy;2018 – 2026 Virtuse Group, alle Rechte vorbehalten.</p>"),
]

# ---- compact desktop nav + language-dropdown CSS, inserted before </style> ----
NAV_CSS_TEMPLATE = """
/* ===== DE: compact nav text =====
   Same squeeze applied for UK/CS/RU (keeps the 6-language dropdown button +
   CTA comfortably fitting at the same breakpoints rather than re-tuning
   per language). German nav labels run long ("Bitcoin-Daten", "Verwahrung"),
   so this squeeze matters here as much as it did for UK/RU. */
.nav-actions { display: flex; align-items: center; gap: 12px; }

.lang-menu { position: relative; }

@media (min-width: 1025px) {
  .nav-links { gap: 2px; }
  .nav-links a {
    font-size: 13px;
    padding: 8px 9px;
    white-space: nowrap;
  }
}

@media (min-width: 1025px) and (max-width: 1300px) {
  .nav { padding: 20px 16px; }
  .nav-links { gap: 0; }
  .nav-links a { padding: 7px 4px; font-size: 12px; }
  .nav-actions { gap: 8px; }
  .nav-cta { padding: 10px 12px; }
}

/* ===== DE: compact language dropdown =====
   Same dropdown pattern as UK/CS/RU's rollout, now listing 6 languages
   (EN/SK/UK/CS/RU/DE) instead of 5. */

.lang-menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--dark-card);
  border: 1px solid var(--border);
  border-radius: 100px;
  padding: 6px 11px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.lang-menu-btn:hover { border-color: var(--btc-orange); }

.lang-menu-caret {
  opacity: 0.6;
  transition: transform 0.2s ease;
}

.lang-menu.open .lang-menu-caret { transform: rotate(180deg); }

.lang-menu-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 130px;
  background: var(--dark-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 6px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px);
  transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  z-index: 200;
}

.lang-menu.open .lang-menu-panel {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.lang-menu-panel .lang-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.lang-menu-panel .lang-opt:hover { background: rgba(255, 255, 255, 0.06); color: var(--text); }

.lang-menu-panel .lang-opt.active {
  background: var(--btc-orange);
  color: #0d0902;
}

@media (max-width: 1024px) {
  .lang-menu { display: none; }
}
"""

LANG_DROPDOWN_JS = """
<script>
// ===== LANGUAGE DROPDOWN =====
(function () {
  var wrap = document.getElementById('langMenu');
  var btn = document.getElementById('langMenuBtn');
  if (!wrap || !btn) return;
  function close() {
    wrap.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var isOpen = wrap.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) {
    if (!wrap.contains(e.target)) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();
</script>
"""


def main():
    page = sys.argv[1]
    de_title = sys.argv[2]
    de_desc = sys.argv[3]
    en_path = os.path.join(CONTENT_DIR, page)
    de_path = os.path.join(CONTENT_DIR, "de", page)
    sk_exists = os.path.exists(os.path.join(CONTENT_DIR, "sk", page))
    uk_exists = os.path.exists(os.path.join(CONTENT_DIR, "uk", page))
    cs_exists = os.path.exists(os.path.join(CONTENT_DIR, "cs", page))
    ru_exists = os.path.exists(os.path.join(CONTENT_DIR, "ru", page))

    with open(en_path, encoding="utf-8") as f:
        s = f.read()

    orig_len = len(s)

    # lang attr
    s = s.replace('<html lang="en">', '<html lang="de">', 1)

    # path fixes
    for pat, repl in PATH_FIXES:
        s = re.sub(pat, repl, s)

    # logo -> /de/
    s = s.replace('href="index.html" class="nav-logo"', 'href="/de/" class="nav-logo"')

    # other-page links -> ../<name>.html  (skip the current page's own name)
    for name in OTHER_PAGES:
        if name == page:
            continue
        s = re.sub(r'href="' + re.escape(name) + r'"', 'href="../' + name + '"', s)

    # blog.html -> ../blog.html for now (de/blog.html doesn't exist yet at
    # this point in the rollout -- run relink_de.py AFTER building
    # de/blog.html to flip this to self-reference "blog.html", see the
    # module docstring for why this order matters).
    s = re.sub(r'href="blog\.html"', 'href="../blog.html"', s)

    # nav label translation
    for en, de in NAV_LABELS:
        s = s.replace(f'<span class="nav-link-label">{en}</span>', f'<span class="nav-link-label">{de}</span>')

    # CTA button label
    s = s.replace(">Get Started<", ">Jetzt starten<")

    # newsletter/footer
    missing = []
    for old, new in NEWSLETTER_FOOTER:
        if old not in s:
            missing.append(old)
        else:
            s = s.replace(old, new)

    # <title>/og:title/twitter:title -- "|" separator, not "—" (house rule).
    m = re.search(r'<title>(.*?) — Virtuse</title>', s)
    if m:
        s = s.replace(f'<title>{m.group(1)} — Virtuse</title>', f'<title>{de_title} | Virtuse</title>', 1)

    # hreflang block (insert after shortcut icon) -- includes sk/uk/cs/ru only if they exist
    s = re.sub(
        r'<link rel="alternate" hreflang="[^"]*" href="https://staging\.virtuse\.com/(?:sk/|uk/|cs/|ru/)?' + re.escape(page) + r'">\n',
        '', s)

    hreflang_lines = [
        f'<link rel="alternate" hreflang="en" href="https://staging.virtuse.com/{page}">',
    ]
    if sk_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="sk" href="https://staging.virtuse.com/sk/{page}">')
    if uk_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="uk" href="https://staging.virtuse.com/uk/{page}">')
    if cs_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="cs" href="https://staging.virtuse.com/cs/{page}">')
    if ru_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="ru" href="https://staging.virtuse.com/ru/{page}">')
    hreflang_lines.append(f'<link rel="alternate" hreflang="de" href="https://staging.virtuse.com/de/{page}">')
    hreflang_lines.append(f'<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}">')
    hreflang = "\n".join(hreflang_lines) + "\n"
    s = s.replace('<link rel="shortcut icon" href="../favicon.ico">\n',
                  '<link rel="shortcut icon" href="../favicon.ico">\n' + hreflang, 1)

    # og/twitter title + description + url + locale
    en_title_match = re.search(r'<meta property="og:title" content="(.*?) — Virtuse">', s)
    if en_title_match:
        s = s.replace(en_title_match.group(0), f'<meta property="og:title" content="{de_title} | Virtuse">')
    s = re.sub(r'<meta name="twitter:title" content=".*? — Virtuse">',
                f'<meta name="twitter:title" content="{de_title} | Virtuse">', s)

    en_desc_match = re.search(r'<meta property="og:description" content="(.*?)">', s)
    if en_desc_match:
        s = s.replace(en_desc_match.group(0), f'<meta property="og:description" content="{de_desc}">')
    en_tw_desc_match = re.search(r'<meta name="twitter:description" content="(.*?)">', s)
    if en_tw_desc_match:
        s = s.replace(en_tw_desc_match.group(0), f'<meta name="twitter:description" content="{de_desc}">')

    s = s.replace(f'<meta property="og:url" content="https://staging.virtuse.com/{page}">',
                  f'<meta property="og:url" content="https://staging.virtuse.com/de/{page}">')
    s = s.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="de_DE">')

    # ---- mobile-menu switcher (li.nav-links-lang-item, inside the overlay <ul>) ----
    sk_opt = f'<a href="../sk/{page}" class="lang-opt" lang="sk"><span class="lang-flag">🇸🇰</span>SK</a>\n        ' if sk_exists else ''
    uk_opt = f'<a href="../uk/{page}" class="lang-opt" lang="uk"><span class="lang-flag">🇺🇦</span>UA</a>\n        ' if uk_exists else ''
    cs_opt = f'<a href="../cs/{page}" class="lang-opt" lang="cs"><span class="lang-flag">🇨🇿</span>CS</a>\n        ' if cs_exists else ''
    ru_opt = f'<a href="../ru/{page}" class="lang-opt" lang="ru"><span class="lang-flag">🇷🇺</span>RU</a>\n        ' if ru_exists else ''
    lang_block_li = (
        f'    <li class="nav-links-lang-item">\n'
        f'      <div class="lang-switch" role="navigation" aria-label="Sprache der Seite">\n'
        f'        <a href="../{page}" class="lang-opt" lang="en"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        {sk_opt}{uk_opt}{cs_opt}{ru_opt}<a href="{page}" class="lang-opt active" lang="de"><span class="lang-flag">🇩🇪</span>DE</a>\n'
        f'      </div>\n'
        f'    </li>\n'
    )
    existing_li_pat = re.compile(
        r'    <li class="nav-links-lang-item">\n'
        r'      <div class="lang-switch" role="navigation" aria-label="[^"]*">\n'
        r'(?:.*\n)*?'
        r'      </div>\n    </li>\n'
    )
    li_replaced = bool(existing_li_pat.search(s))
    s = existing_li_pat.sub(lang_block_li, s, count=1)

    # ---- desktop switcher: patch the existing compact dropdown's panel
    # (every real page has one, post dropdown_retrofit.py + CS/RU rollout) ----
    sk_opt_menu = f'<a href="../sk/{page}" class="lang-opt" lang="sk" role="menuitem"><span class="lang-flag">🇸🇰</span>SK</a>\n        ' if sk_exists else ''
    uk_opt_menu = f'<a href="../uk/{page}" class="lang-opt" lang="uk" role="menuitem"><span class="lang-flag">🇺🇦</span>UA</a>\n        ' if uk_exists else ''
    cs_opt_menu = f'<a href="../cs/{page}" class="lang-opt" lang="cs" role="menuitem"><span class="lang-flag">🇨🇿</span>CS</a>\n        ' if cs_exists else ''
    ru_opt_menu = f'<a href="../ru/{page}" class="lang-opt" lang="ru" role="menuitem"><span class="lang-flag">🇷🇺</span>RU</a>\n        ' if ru_exists else ''

    panel_pat = re.compile(
        r'(      <div class="lang-menu-panel" id="langMenuPanel" role="menu">\n)'
        r'(?:.*\n)*?'
        r'(      </div>\n)'
    )
    new_panel_body = (
        f'        <a href="../{page}" class="lang-opt" lang="en" role="menuitem"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        {sk_opt_menu}{uk_opt_menu}{cs_opt_menu}{ru_opt_menu}<a href="{page}" class="lang-opt active" lang="de" role="menuitem"><span class="lang-flag">🇩🇪</span>DE</a>\n'
    )
    dropdown_found = bool(panel_pat.search(s))
    s = panel_pat.sub(lambda m: m.group(1) + new_panel_body + m.group(2), s, count=1)

    if dropdown_found:
        s = s.replace(
            '<button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Page language">',
            '<button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Sprache der Seite">',
            1)
        s = re.sub(
            r'(<button type="button" class="lang-menu-btn" id="langMenuBtn"[^>]*>\n\s*<span class="lang-flag">)[^<]*(</span>)\S*',
            r'\g<1>🇩🇪\g<2>DE', s, count=1)
        nav_wired = True
    else:
        # Fallback: no dropdown found (shouldn't happen for any real page
        # post dropdown_retrofit.py / CS / RU rollout, but handle the old
        # pill row just in case this script runs against a page that
        # predates it).
        old_pill_pat = re.compile(
            r'  <div class="lang-switch nav-lang-switch" role="navigation" aria-label="[^"]*">\n'
            r'(?:.*\n)*?'
            r'  </div>\n'
        )
        pill_found = bool(old_pill_pat.search(s))
        s = old_pill_pat.sub('', s, count=1)
        nav_actions_html = (
            f'  <div class="nav-actions">\n'
            f'    <div class="lang-menu" id="langMenu">\n'
            f'      <button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Sprache der Seite">\n'
            f'        <span class="lang-flag">🇩🇪</span>DE\n'
            f'        <svg class="lang-menu-caret" width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
            f'      </button>\n'
            f'      <div class="lang-menu-panel" id="langMenuPanel" role="menu">\n'
            f'{new_panel_body}'
            f'      </div>\n'
            f'    </div>\n'
            f'    <button class="nav-cta">Jetzt starten</button>\n'
            f'  </div>\n'
        )
        old_tail = '  <button class="nav-cta">Jetzt starten</button>\n</nav>'
        nav_wired = old_tail in s
        if nav_wired:
            s = s.replace(old_tail, nav_actions_html + '</nav>', 1)
        elif pill_found:
            print("WARNING: old pill row removed but nav-cta tail pattern not found -- dropdown NOT inserted, check nav markup by hand")
        else:
            print("WARNING: neither .lang-menu-panel nor the old pill row found -- switcher NOT wired, check nav markup by hand")

    # ---- CSS/JS: only needed on the fallback path ----
    if not dropdown_found:
        if "</style>" in s:
            s = s.replace("</style>", NAV_CSS_TEMPLATE + "</style>", 1)
        else:
            print("WARNING: </style> not found, nav/dropdown CSS NOT inserted")

        if nav_wired and "</nav>" in s:
            s = s.replace("</nav>", "</nav>\n" + LANG_DROPDOWN_JS, 1)
        elif nav_wired:
            print("WARNING: </nav> not found, dropdown JS NOT inserted")

    os.makedirs(os.path.dirname(de_path), exist_ok=True)
    with open(de_path, "w", encoding="utf-8") as f:
        f.write(s)

    print(f"Wrote {de_path} ({len(s)} bytes, was {orig_len})")
    if not sk_exists:
        print("NOTE: sk/%s does not exist yet -- SK option omitted from switcher." % page)
    if not uk_exists:
        print("NOTE: uk/%s does not exist yet -- UK option omitted from switcher." % page)
    if not cs_exists:
        print("NOTE: cs/%s does not exist yet -- CS option omitted from switcher." % page)
    if not ru_exists:
        print("NOTE: ru/%s does not exist yet -- RU option omitted from switcher." % page)
    if not li_replaced:
        print("NOTE: no pre-existing mobile lang-switcher li found -- check nav by hand.")
    if not dropdown_found:
        print("NOTE: page did not already have the compact dropdown switcher -- used fallback path, double-check the result.")
    if missing:
        print("Newsletter/footer strings NOT found (check manually):", missing)


if __name__ == "__main__":
    main()
