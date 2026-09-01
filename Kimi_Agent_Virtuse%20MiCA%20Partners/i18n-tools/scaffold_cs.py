#!/usr/bin/env python3
"""
Scaffold a cs/<page>.html from the English original: mechanical path fixes,
nav-label translation, standard newsletter/footer translation, hreflang tags
(en/sk/uk/cs/x-default), and the language switcher (desktop dropdown +
mobile menu, now a 4-option EN/SK/UK/CS set). Leaves all page-specific
prose (hero, body sections, partner cards) untouched for a follow-up
manual translation pass.

Adapted from scaffold_uk.py (see i18n-tools/README.md "Adding the next
language") with one structural difference: Czech is language #4 joining an
already-3-language site, so every scaffolded page's switcher must include
EN + SK + UK + CS from the start, not just EN + (optionally SK) + the new
language. sk_exists/uk_exists are both checked; in practice both should
already be true for every real page since SK and UK are both complete.

Language-specific notes for whoever copies this file next:
  - CRITICAL FALSE FRIEND: Slovak's nav label "Boty" (bots) is NOT valid
    Czech for "bots" -- "boty" means "shoes" in Czech. Do not copy the
    Slovak glossary verbatim into a new Slavic-language script without
    checking for this kind of trap. Correct Czech: "Boti" (informal
    plural of "bot", same declension pattern as "roboti").
  - "Treasury" kept as the English loanword (not translated), matching
    the Slovak choice ("kept — standard even in Slovak financial press")
    over Ukrainian's full translation ("Казначейство") -- Czech and
    Slovak fintech press use English loanwords very similarly, Ukrainian
    less so.
  - Footer "Legal" section header follows the SK site's own later
    human-review correction ("Právne" -> "Informácie", see CLAUDE.md
    commit 493d889), not a fresh literal translation of "Legal" -- Czech
    "Informace", matching that established sitewide convention rather
    than reinventing it.
  - No em dashes ("—") in any mechanically-written string, same house
    rule adopted for UK. <title>/og:title/twitter:title separator is "|".

Usage: python3 scaffold_cs.py <page.html> "<Czech Title (no ' — Virtuse')>" "<Czech og:description>"

IMPORTANT for the caller: write the Czech title/description arguments
WITHOUT em-dashes -- use a comma, colon, or restructure the sentence.
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAV_LABELS = [
    ("Buy Bitcoin", "Koupit Bitcoin"),
    ("Mining", "Těžba"),
    ("Loans", "Půjčky"),
    ("Custody", "Úschova"),
    ("Treasury", "Treasury"),
    ("Tax", "Daně"),
    ("Bots", "Boti"),  # NOT "Boty" -- that means "shoes" in Czech, see module docstring
    ("Blog", "Blog"),
    ("Bitcoin Data", "Bitcoin data"),
    ("About", "O nás"),
    ("Research", "Výzkum"),
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
    # NOT in scaffold_uk.py -- discovered missing while testing this script:
    # uk/*.html pages don't reference lang-detect.js at all (it's Slovak-only
    # by design, so far), so this gap never surfaced there. The EN source DOES
    # reference it on every page (see lang-detect.js, repo root), so it needs
    # the same one-level-up fix as every other shared asset.
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
    ("<h2>Fix the Money, Fix the World</h2>", "<h2>Opravme peníze, opravme svět</h2>"),
    ("<p>Join 18,000+ investors staying ahead of the curve. Get the Virtuse Report in your inbox every week.</p>",
     "<p>Přidejte se k více než 18 000 investorům, kteří jsou vždy o krok napřed. Získávejte Virtuse Report do své schránky každý týden.</p>"),
    ('placeholder="Enter your email"', 'placeholder="Zadejte svůj e-mail"'),
    ('<button type="submit">SUBSCRIBE NOW</button>', '<button type="submit">ODEBÍRAT</button>'),
    ("btn.textContent = 'SENDING...';", "btn.textContent = 'ODESÍLÁNÍ...';"),
    ('msg.textContent = "You\'re in \\u2014 check your inbox for a welcome email.";',
     'msg.textContent = "Hotovo, zkontrolujte si e-mail s uvítacím dopisem.";'),
    ("msg.textContent = (result.data && result.data.error) || 'Something went wrong. Please try again.';",
     "msg.textContent = (result.data && result.data.error) || 'Něco se pokazilo. Zkuste to prosím znovu.';"),
    ("msg.textContent = 'Network error \\u2014 please try again.';",
     "msg.textContent = 'Chyba sítě. Zkuste to znovu.';"),
    ("<h4>Company</h4>", "<h4>Společnost</h4>"),
    (">About Us<", ">O nás<"),
    ("<h4>Legal</h4>", "<h4>Informace</h4>"),  # matches SK's post-review "Právne" -> "Informácie", not a literal "Legal" translation
    (">Terms &amp; Conditions<", ">Obchodní podmínky<"),
    (">Privacy Policy<", ">Ochrana osobních údajů<"),
    (">AML &amp; Compliance<", ">AML a Compliance<"),
    ("<p>&copy;2018 - 2026 Virtuse Group, All Rights Reserved.</p>",
     "<p>&copy;2018 – 2026 Virtuse Group, všechna práva vyhrazena.</p>"),
]

# ---- compact desktop nav + language-dropdown CSS, inserted before </style> ----
NAV_CSS_TEMPLATE = """
/* ===== CS: compact nav text =====
   Same squeeze applied for UK (Czech labels aren't as long as Ukrainian
   ones, but keeping the same tightened spacing keeps the 4-language
   dropdown button + CTA comfortably fitting at the same breakpoints
   rather than re-tuning per language). */
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

@media (min-width: 1025px) and (max-width: 1240px) {
  .nav { padding: 20px 16px; }
  .nav-links { gap: 0; }
  .nav-links a { padding: 7px 4px; font-size: 12px; }
  .nav-actions { gap: 8px; }
  .nav-cta { padding: 10px 12px; }
}

/* ===== CS: compact language dropdown =====
   Same dropdown pattern as UK's rollout, now listing 4 languages
   (EN/SK/UK/CS) instead of 3. */

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
    cs_title = sys.argv[2]
    cs_desc = sys.argv[3]
    en_path = os.path.join(CONTENT_DIR, page)
    cs_path = os.path.join(CONTENT_DIR, "cs", page)
    sk_exists = os.path.exists(os.path.join(CONTENT_DIR, "sk", page))
    uk_exists = os.path.exists(os.path.join(CONTENT_DIR, "uk", page))

    with open(en_path, encoding="utf-8") as f:
        s = f.read()

    orig_len = len(s)

    # lang attr
    s = s.replace('<html lang="en">', '<html lang="cs">', 1)

    # path fixes
    for pat, repl in PATH_FIXES:
        s = re.sub(pat, repl, s)

    # logo -> /cs/
    s = s.replace('href="index.html" class="nav-logo"', 'href="/cs/" class="nav-logo"')

    # other-page links -> ../<name>.html  (skip the current page's own name)
    for name in OTHER_PAGES:
        if name == page:
            continue
        s = re.sub(r'href="' + re.escape(name) + r'"', 'href="../' + name + '"', s)

    # blog.html -> ../blog.html (no blog-cs.html/cs/blog.html exists yet)
    s = re.sub(r'href="blog\.html"', 'href="../blog.html"', s)

    # nav label translation
    for en, cs in NAV_LABELS:
        s = s.replace(f'<span class="nav-link-label">{en}</span>', f'<span class="nav-link-label">{cs}</span>')

    # CTA button label
    s = s.replace(">Get Started<", ">Začít<")

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
        s = s.replace(f'<title>{m.group(1)} — Virtuse</title>', f'<title>{cs_title} | Virtuse</title>', 1)

    # hreflang block (insert after shortcut icon) -- includes sk/uk only if they exist
    s = re.sub(
        r'<link rel="alternate" hreflang="[^"]*" href="https://staging\.virtuse\.com/(?:sk/|uk/)?' + re.escape(page) + r'">\n',
        '', s)

    hreflang_lines = [
        f'<link rel="alternate" hreflang="en" href="https://staging.virtuse.com/{page}">',
    ]
    if sk_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="sk" href="https://staging.virtuse.com/sk/{page}">')
    if uk_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="uk" href="https://staging.virtuse.com/uk/{page}">')
    hreflang_lines.append(f'<link rel="alternate" hreflang="cs" href="https://staging.virtuse.com/cs/{page}">')
    hreflang_lines.append(f'<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}">')
    hreflang = "\n".join(hreflang_lines) + "\n"
    s = s.replace('<link rel="shortcut icon" href="../favicon.ico">\n',
                  '<link rel="shortcut icon" href="../favicon.ico">\n' + hreflang, 1)

    # og/twitter title + description + url + locale
    en_title_match = re.search(r'<meta property="og:title" content="(.*?) — Virtuse">', s)
    if en_title_match:
        s = s.replace(en_title_match.group(0), f'<meta property="og:title" content="{cs_title} | Virtuse">')
    s = re.sub(r'<meta name="twitter:title" content=".*? — Virtuse">',
                f'<meta name="twitter:title" content="{cs_title} | Virtuse">', s)

    en_desc_match = re.search(r'<meta property="og:description" content="(.*?)">', s)
    if en_desc_match:
        s = s.replace(en_desc_match.group(0), f'<meta property="og:description" content="{cs_desc}">')
    en_tw_desc_match = re.search(r'<meta name="twitter:description" content="(.*?)">', s)
    if en_tw_desc_match:
        s = s.replace(en_tw_desc_match.group(0), f'<meta name="twitter:description" content="{cs_desc}">')

    s = s.replace(f'<meta property="og:url" content="https://staging.virtuse.com/{page}">',
                  f'<meta property="og:url" content="https://staging.virtuse.com/cs/{page}">')
    s = s.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="cs_CZ">')

    # ---- mobile-menu switcher (li.nav-links-lang-item, inside the overlay <ul>) ----
    # 4-pill EN/SK/UK/CS row -- works fine stacked vertically in the
    # full-screen overlay, so it's left as pills (only the DESKTOP switcher
    # is the compact dropdown).
    sk_opt = f'<a href="../sk/{page}" class="lang-opt" lang="sk"><span class="lang-flag">🇸🇰</span>SK</a>\n        ' if sk_exists else ''
    uk_opt = f'<a href="../uk/{page}" class="lang-opt" lang="uk"><span class="lang-flag">🇺🇦</span>UA</a>\n        ' if uk_exists else ''
    lang_block_li = (
        f'    <li class="nav-links-lang-item">\n'
        f'      <div class="lang-switch" role="navigation" aria-label="Jazyk stránky">\n'
        f'        <a href="../{page}" class="lang-opt" lang="en"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        {sk_opt}{uk_opt}<a href="{page}" class="lang-opt active" lang="cs"><span class="lang-flag">🇨🇿</span>CS</a>\n'
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

    # ---- desktop switcher: this page is coming straight from the EN root,
    # which (post dropdown_retrofit.py) already has the compact dropdown,
    # not the old pill row. Replace its .lang-menu-panel wholesale with a
    # fresh 4-option EN/SK/UK/CS panel, and update the button's flag/label
    # to CS (it shows the CURRENT page's own language). ----
    sk_opt_menu = f'<a href="../sk/{page}" class="lang-opt" lang="sk" role="menuitem"><span class="lang-flag">🇸🇰</span>SK</a>\n        ' if sk_exists else ''
    uk_opt_menu = f'<a href="../uk/{page}" class="lang-opt" lang="uk" role="menuitem"><span class="lang-flag">🇺🇦</span>UA</a>\n        ' if uk_exists else ''

    panel_pat = re.compile(
        r'(      <div class="lang-menu-panel" id="langMenuPanel" role="menu">\n)'
        r'(?:.*\n)*?'
        r'(      </div>\n)'
    )
    new_panel_body = (
        f'        <a href="../{page}" class="lang-opt" lang="en" role="menuitem"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        {sk_opt_menu}{uk_opt_menu}<a href="{page}" class="lang-opt active" lang="cs" role="menuitem"><span class="lang-flag">🇨🇿</span>CS</a>\n'
    )
    dropdown_found = bool(panel_pat.search(s))
    s = panel_pat.sub(lambda m: m.group(1) + new_panel_body + m.group(2), s, count=1)

    if dropdown_found:
        # button's aria-label and shown flag/text both reflect the current
        # (CS) page's own language -- inherited from the EN source as-is
        # otherwise, since the fast path only patches the panel's <a> list.
        s = s.replace(
            '<button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Page language">',
            '<button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Jazyk stránky">',
            1)
        s = re.sub(
            r'(<button type="button" class="lang-menu-btn" id="langMenuBtn"[^>]*>\n\s*<span class="lang-flag">)[^<]*(</span>)\S*',
            r'\g<1>🇨🇿\g<2>CS', s, count=1)
        nav_wired = True
    else:
        # Fallback: no dropdown found (shouldn't happen for any real page
        # post dropdown_retrofit.py, but handle the old pill row just in
        # case this script is ever run against a page that predates it).
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
            f'      <button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Jazyk stránky">\n'
            f'        <span class="lang-flag">🇨🇿</span>CS\n'
            f'        <svg class="lang-menu-caret" width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
            f'      </button>\n'
            f'      <div class="lang-menu-panel" id="langMenuPanel" role="menu">\n'
            f'{new_panel_body}'
            f'      </div>\n'
            f'    </div>\n'
            f'    <button class="nav-cta">Začít</button>\n'
            f'  </div>\n'
        )
        old_tail = '  <button class="nav-cta">Začít</button>\n</nav>'
        nav_wired = old_tail in s
        if nav_wired:
            s = s.replace(old_tail, nav_actions_html + '</nav>', 1)
        elif pill_found:
            print("WARNING: old pill row removed but nav-cta tail pattern not found -- dropdown NOT inserted, check nav markup by hand")
        else:
            print("WARNING: neither .lang-menu-panel nor the old pill row found -- switcher NOT wired, check nav markup by hand")

    # ---- CSS: insert the compact-nav + dropdown styles right before </style> ----
    # Only needed on the fallback path (a page with the dropdown already
    # present already has this CSS from when it was first added).
    if not dropdown_found:
        if "</style>" in s:
            s = s.replace("</style>", NAV_CSS_TEMPLATE + "</style>", 1)
        else:
            print("WARNING: </style> not found, nav/dropdown CSS NOT inserted")

        if nav_wired and "</nav>" in s:
            s = s.replace("</nav>", "</nav>\n" + LANG_DROPDOWN_JS, 1)
        elif nav_wired:
            print("WARNING: </nav> not found, dropdown JS NOT inserted")

    os.makedirs(os.path.dirname(cs_path), exist_ok=True)
    with open(cs_path, "w", encoding="utf-8") as f:
        f.write(s)

    print(f"Wrote {cs_path} ({len(s)} bytes, was {orig_len})")
    if not sk_exists:
        print("NOTE: sk/%s does not exist yet -- SK option omitted from switcher." % page)
    if not uk_exists:
        print("NOTE: uk/%s does not exist yet -- UK option omitted from switcher." % page)
    if not li_replaced:
        print("NOTE: no pre-existing mobile lang-switcher li found -- check nav by hand.")
    if not dropdown_found:
        print("NOTE: page did not already have the compact dropdown switcher -- used fallback path, double-check the result.")
    if missing:
        print("Newsletter/footer strings NOT found (check manually):", missing)


if __name__ == "__main__":
    main()
