#!/usr/bin/env python3
"""
Scaffold an es/<page>.html from the English original: mechanical path
fixes, nav-label translation, standard newsletter/footer translation,
hreflang tags (en/sk/uk/cs/ru/de/fr/es/x-default), and the language
switcher (desktop dropdown + mobile menu, now an 8-option
EN/SK/UK/CS/RU/DE/FR/ES set). Leaves all page-specific prose (hero, body
sections, partner cards) untouched for a follow-up manual translation
pass.

Adapted from scaffold_fr.py (see i18n-tools/README.md "Adding the next
language") with the same structural approach: Spanish is language #8
joining an already-7-language site, so sk_exists/uk_exists/cs_exists/
ru_exists/de_exists/fr_exists are all checked (in practice all six
should already be true for every real page).

Same fixes baked in from the start as the FR-era script (all previously
learned the hard way during earlier rollouts, see scaffold_fr.py's own
docstring for the full history):
  - The 1025-1300px "compact nav" CSS squeeze is inserted unconditionally.
  - `consultation-widget.js` is in PATH_FIXES from the start.
  - `data-consultation-lang="en"` gets rewritten to `data-consultation-lang="es"`
    wherever it appears (falls back to English copy inside the widget
    until it ships real Spanish copy -- see consultation-widget.js's own
    COPY object, which only has en/sk/cs today).
  - `concierge-launcher.js`'s `<script>` tag is REMOVED outright rather
    than left as a bare, un-path-fixed reference -- Layer 2 modules and
    the sticky launcher are explicitly out of scope for this rollout.
  - The Layer 2 module deep-links on index.html/buy-bitcoin.html
    (concierge.html?utm_..., stacking.html?utm_...) are rewritten to
    absolute `https://virtuse.com/...` URLs -- these modules were never
    translated to Spanish, so a bare relative href would 404 into a
    nonexistent es/concierge.html (this bit both fr/ and de/ after their
    initial scaffold and had to be hand-patched retroactively).

Usage: python3 scaffold_es.py <page.html> "<Spanish Title (no ' — Virtuse')>" "<Spanish og:description>"

IMPORTANT for the caller: write the Spanish title/description arguments
WITHOUT em-dashes -- use a comma, colon, or restructure the sentence.
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAV_LABELS = [
    ("Buy Bitcoin", "Comprar Bitcoin"),
    ("Mining", "Minería"),
    ("Loans", "Préstamos"),
    ("Custody", "Custodia"),
    ("Treasury", "Treasury"),  # kept as loanword, matches SK/CS/RU/DE/FR camp
    ("Tax", "Impuestos"),
    ("Bots", "Bots"),  # no false-friend risk in Spanish
    ("Blog", "Blog"),
    ("Bitcoin Data", "Datos de Bitcoin"),
    ("About", "Sobre nosotros"),
    ("Research", "Research"),  # kept as loanword, matches SK/CS/RU/DE/FR
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
    (r'src="consultation-widget\.js"', 'src="../consultation-widget.js"'),
]

OTHER_PAGES = [
    "mining.html", "lending.html", "secure.html", "treasury.html", "tax.html",
    "bots.html", "bitcoin-data.html", "about.html", "buy-bitcoin.html",
    "research.html", "faq.html", "terms-and-conditions.html",
    "privacy-policy.html", "aml-compliance.html", "btc-dominance.html",
    "ma-200w.html", "rainbow-chart.html", "root-cycles.html",
    "retirement-calculator.html", "fear-greed.html", "trading-volume.html",
]

# Layer 2 modules never got a Spanish translation (same decision as
# German/French) -- point these at the live English module on production
# instead of a bare relative href, which would 404 into a nonexistent
# es/concierge.html or es/stacking.html.
LAYER2_LINK_FIXES = [
    ('href="concierge.html?utm_source=concierge&utm_medium=hero"',
     'href="https://virtuse.com/concierge.html?utm_source=concierge&utm_medium=hero"'),
    ('href="concierge.html?utm_source=concierge&utm_medium=banner"',
     'href="https://virtuse.com/concierge.html?utm_source=concierge&utm_medium=banner"'),
    ('href="stacking.html?utm_source=stacking&amp;utm_medium=widget"',
     'href="https://virtuse.com/stacking.html?utm_source=stacking&amp;utm_medium=widget"'),
    # lending.html/tax.html's own hub-to-SEO cross-links (added to the EN
    # source by the 2026-09-15-era "hub-to-SEO internal links" commit,
    # after de/ and fr/ were already scaffolded -- first hit for es/,
    # same bare-relative-href 404 pattern as concierge/stacking above).
    ('href="loan.html">', 'href="https://virtuse.com/loan.html">'),
    ('href="tax-agent.html" class="tax-guides-cta">', 'href="https://virtuse.com/tax-agent.html" class="tax-guides-cta">'),
    ('href="tax-agent.html">', 'href="https://virtuse.com/tax-agent.html">'),
]

NEWSLETTER_FOOTER = [
    ("<h2>Fix the Money, Fix the World</h2>", "<h2>Arreglemos el dinero, arreglemos el mundo</h2>"),
    ("<p>Join 18,000+ investors staying ahead of the curve. Get the Virtuse Report in your inbox every week.</p>",
     "<p>Únase a más de 18.000 inversores que siempre van un paso por delante. Reciba el Virtuse Report cada semana en su bandeja de entrada.</p>"),
    ('placeholder="Enter your email"', 'placeholder="Introduzca su correo electrónico"'),
    ('<button type="submit">SUBSCRIBE NOW</button>', '<button type="submit">SUSCRIBIRSE AHORA</button>'),
    ("btn.textContent = 'SENDING...';", "btn.textContent = 'ENVIANDO...';"),
    ('msg.textContent = "You\'re in \\u2014 check your inbox for a welcome email.";',
     'msg.textContent = "¡Listo! Revise su bandeja de entrada para ver el correo de bienvenida.";'),
    ("msg.textContent = (result.data && result.data.error) || 'Something went wrong. Please try again.';",
     "msg.textContent = (result.data && result.data.error) || 'Algo salió mal. Inténtelo de nuevo.';"),
    ("msg.textContent = 'Network error \\u2014 please try again.';",
     "msg.textContent = 'Error de red. Inténtelo de nuevo.';"),
    ("<h4>Company</h4>", "<h4>Empresa</h4>"),
    (">About Us<", ">Sobre nosotros<"),
    ("<h4>Legal</h4>", "<h4>Información</h4>"),  # matches SK/CS/RU/DE/FR's post-review convention, not a literal "Legal"
    (">Terms &amp; Conditions<", ">Términos y condiciones<"),
    (">Privacy Policy<", ">Política de privacidad<"),
    (">AML &amp; Compliance<", ">AML y cumplimiento<"),
    ("<p>&copy;2018 - 2026 Virtuse Group, All Rights Reserved.</p>",
     "<p>&copy;2018 – 2026 Virtuse Group, todos los derechos reservados.</p>"),
]

# ---- compact desktop nav + language-dropdown CSS, inserted before </style> ----
NAV_SQUEEZE_CSS = """
/* ===== ES: compact nav text =====
   Spanish nav labels can run longer than other languages' (e.g. "Datos
   de Bitcoin", "Sobre nosotros"), so at the default per-item padding/
   font-size they wrap onto two lines at common desktop widths. Inserted
   UNCONDITIONALLY (not gated behind whether the page already had the
   compact dropdown) -- see scaffold_fr.py's own docstring for why that
   gate was wrong when the DE-era script first did it. */
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
"""

NAV_DROPDOWN_CSS = """
.nav-actions { display: flex; align-items: center; gap: 12px; }

.lang-menu { position: relative; }

/* ===== ES: compact language dropdown =====
   Same dropdown pattern as DE/FR/RU/CS/UK's rollout, now listing 8
   languages (EN/SK/UK/CS/RU/DE/FR/ES) instead of 7. */

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
    es_title = sys.argv[2]
    es_desc = sys.argv[3]
    en_path = os.path.join(CONTENT_DIR, page)
    es_path = os.path.join(CONTENT_DIR, "es", page)
    sk_exists = os.path.exists(os.path.join(CONTENT_DIR, "sk", page))
    uk_exists = os.path.exists(os.path.join(CONTENT_DIR, "uk", page))
    cs_exists = os.path.exists(os.path.join(CONTENT_DIR, "cs", page))
    ru_exists = os.path.exists(os.path.join(CONTENT_DIR, "ru", page))
    de_exists = os.path.exists(os.path.join(CONTENT_DIR, "de", page))
    fr_exists = os.path.exists(os.path.join(CONTENT_DIR, "fr", page))

    with open(en_path, encoding="utf-8") as f:
        s = f.read()

    orig_len = len(s)

    # lang attr
    s = s.replace('<html lang="en">', '<html lang="es">', 1)

    # path fixes
    for pat, repl in PATH_FIXES:
        s = re.sub(pat, repl, s)

    # logo -> /es/
    s = s.replace('href="index.html" class="nav-logo"', 'href="/es/" class="nav-logo"')

    # other-page links -> ../<name>.html  (skip the current page's own name)
    for name in OTHER_PAGES:
        if name == page:
            continue
        s = re.sub(r'href="' + re.escape(name) + r'"', 'href="../' + name + '"', s)

    # blog.html -> ../blog.html for now (es/blog.html doesn't exist yet at
    # this point in the rollout -- run relink_es.py AFTER building
    # es/blog.html to flip this to self-reference "blog.html".
    s = re.sub(r'href="blog\.html"', 'href="../blog.html"', s)

    # remove the concierge-launcher.js tag outright -- see module docstring
    s = re.sub(r'<script src="concierge-launcher\.js" defer></script>\n?', '', s)

    # Layer 2 module deep-links -> absolute production URLs (see docstring)
    for old, new in LAYER2_LINK_FIXES:
        s = s.replace(old, new)

    # consultation widget: point at the correct copy for this language
    # (falls back to English inside the widget until it ships real
    # Spanish copy -- see consultation-widget.js's own COPY object)
    s = s.replace('data-consultation-lang="en"', 'data-consultation-lang="es"')

    # nav label translation
    for en, es in NAV_LABELS:
        s = s.replace(f'<span class="nav-link-label">{en}</span>', f'<span class="nav-link-label">{es}</span>')

    # CTA button label
    s = s.replace(">Get Started<", ">Comenzar<")

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
        s = s.replace(f'<title>{m.group(1)} — Virtuse</title>', f'<title>{es_title} | Virtuse</title>', 1)

    # hreflang block (insert after shortcut icon) -- includes sk/uk/cs/ru/de/fr only if they exist
    s = re.sub(
        r'<link rel="alternate" hreflang="[^"]*" href="https://(?:staging\.)?virtuse\.com/(?:sk/|uk/|cs/|ru/|de/|fr/)?' + re.escape(page) + r'">\n',
        '', s)

    hreflang_lines = [
        f'<link rel="alternate" hreflang="en" href="https://virtuse.com/{page}">',
    ]
    if sk_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="sk" href="https://virtuse.com/sk/{page}">')
    if uk_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="uk" href="https://virtuse.com/uk/{page}">')
    if cs_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="cs" href="https://virtuse.com/cs/{page}">')
    if ru_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="ru" href="https://virtuse.com/ru/{page}">')
    if de_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="de" href="https://virtuse.com/de/{page}">')
    if fr_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="fr" href="https://virtuse.com/fr/{page}">')
    hreflang_lines.append(f'<link rel="alternate" hreflang="es" href="https://virtuse.com/es/{page}">')
    hreflang_lines.append(f'<link rel="alternate" hreflang="x-default" href="https://virtuse.com/{page}">')
    hreflang = "\n".join(hreflang_lines) + "\n"
    s = s.replace('<link rel="shortcut icon" href="../favicon.ico">\n',
                  '<link rel="shortcut icon" href="../favicon.ico">\n' + hreflang, 1)

    # og/twitter title + description + url + locale
    en_title_match = re.search(r'<meta property="og:title" content="(.*?) — Virtuse">', s)
    if en_title_match:
        s = s.replace(en_title_match.group(0), f'<meta property="og:title" content="{es_title} | Virtuse">')
    s = re.sub(r'<meta name="twitter:title" content=".*? — Virtuse">',
                f'<meta name="twitter:title" content="{es_title} | Virtuse">', s)

    en_desc_match = re.search(r'<meta property="og:description" content="(.*?)">', s)
    if en_desc_match:
        s = s.replace(en_desc_match.group(0), f'<meta property="og:description" content="{es_desc}">')
    en_tw_desc_match = re.search(r'<meta name="twitter:description" content="(.*?)">', s)
    if en_tw_desc_match:
        s = s.replace(en_tw_desc_match.group(0), f'<meta name="twitter:description" content="{es_desc}">')

    s = re.sub(r'<meta property="og:url" content="https://(?:staging\.)?virtuse\.com/' + re.escape(page) + r'">',
                f'<meta property="og:url" content="https://virtuse.com/es/{page}">', s)
    s = s.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="es_ES">')

    # ---- mobile-menu switcher (li.nav-links-lang-item, inside the overlay <ul>) ----
    sk_opt = f'<a href="../sk/{page}" class="lang-opt" lang="sk"><span class="lang-flag">🇸🇰</span>SK</a>\n        ' if sk_exists else ''
    uk_opt = f'<a href="../uk/{page}" class="lang-opt" lang="uk"><span class="lang-flag">🇺🇦</span>UA</a>\n        ' if uk_exists else ''
    cs_opt = f'<a href="../cs/{page}" class="lang-opt" lang="cs"><span class="lang-flag">🇨🇿</span>CS</a>\n        ' if cs_exists else ''
    ru_opt = f'<a href="../ru/{page}" class="lang-opt" lang="ru"><span class="lang-flag">🇷🇺</span>RU</a>\n        ' if ru_exists else ''
    de_opt = f'<a href="../de/{page}" class="lang-opt" lang="de"><span class="lang-flag">🇩🇪</span>DE</a>\n        ' if de_exists else ''
    fr_opt = f'<a href="../fr/{page}" class="lang-opt" lang="fr"><span class="lang-flag">🇫🇷</span>FR</a>\n        ' if fr_exists else ''
    lang_block_li = (
        f'    <li class="nav-links-lang-item">\n'
        f'      <div class="lang-switch" role="navigation" aria-label="Idioma de la página">\n'
        f'        <a href="../{page}" class="lang-opt" lang="en"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        {sk_opt}{uk_opt}{cs_opt}{ru_opt}{de_opt}{fr_opt}<a href="{page}" class="lang-opt active" lang="es"><span class="lang-flag">🇪🇸</span>ES</a>\n'
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
    # (every real page has one, post dropdown_retrofit.py + CS/RU/DE/FR rollout) ----
    sk_opt_menu = f'<a href="../sk/{page}" class="lang-opt" lang="sk" role="menuitem"><span class="lang-flag">🇸🇰</span>SK</a>\n        ' if sk_exists else ''
    uk_opt_menu = f'<a href="../uk/{page}" class="lang-opt" lang="uk" role="menuitem"><span class="lang-flag">🇺🇦</span>UA</a>\n        ' if uk_exists else ''
    cs_opt_menu = f'<a href="../cs/{page}" class="lang-opt" lang="cs" role="menuitem"><span class="lang-flag">🇨🇿</span>CS</a>\n        ' if cs_exists else ''
    ru_opt_menu = f'<a href="../ru/{page}" class="lang-opt" lang="ru" role="menuitem"><span class="lang-flag">🇷🇺</span>RU</a>\n        ' if ru_exists else ''
    de_opt_menu = f'<a href="../de/{page}" class="lang-opt" lang="de" role="menuitem"><span class="lang-flag">🇩🇪</span>DE</a>\n        ' if de_exists else ''
    fr_opt_menu = f'<a href="../fr/{page}" class="lang-opt" lang="fr" role="menuitem"><span class="lang-flag">🇫🇷</span>FR</a>\n        ' if fr_exists else ''

    panel_pat = re.compile(
        r'(      <div class="lang-menu-panel" id="langMenuPanel" role="menu">\n)'
        r'(?:.*\n)*?'
        r'(      </div>\n)'
    )
    new_panel_body = (
        f'        <a href="../{page}" class="lang-opt" lang="en" role="menuitem"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        {sk_opt_menu}{uk_opt_menu}{cs_opt_menu}{ru_opt_menu}{de_opt_menu}{fr_opt_menu}<a href="{page}" class="lang-opt active" lang="es" role="menuitem"><span class="lang-flag">🇪🇸</span>ES</a>\n'
    )
    dropdown_found = bool(panel_pat.search(s))
    s = panel_pat.sub(lambda m: m.group(1) + new_panel_body + m.group(2), s, count=1)

    if dropdown_found:
        s = s.replace(
            '<button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Page language">',
            '<button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Idioma de la página">',
            1)
        s = re.sub(
            r'(<button type="button" class="lang-menu-btn" id="langMenuBtn"[^>]*>\n\s*<span class="lang-flag">)[^<]*(</span>)\S*',
            r'\g<1>🇪🇸\g<2>ES', s, count=1)
        nav_wired = True
    else:
        # Fallback: no dropdown found (404.html and any other page that
        # predates dropdown_retrofit.py).
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
            f'      <button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Idioma de la página">\n'
            f'        <span class="lang-flag">🇪🇸</span>ES\n'
            f'        <svg class="lang-menu-caret" width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
            f'      </button>\n'
            f'      <div class="lang-menu-panel" id="langMenuPanel" role="menu">\n'
            f'{new_panel_body}'
            f'      </div>\n'
            f'    </div>\n'
            f'    <button class="nav-cta">Comenzar</button>\n'
            f'  </div>\n'
        )
        old_tail = '  <button class="nav-cta">Comenzar</button>\n</nav>'
        nav_wired = old_tail in s
        if nav_wired:
            s = s.replace(old_tail, nav_actions_html + '</nav>', 1)
        elif pill_found:
            print("WARNING: old pill row removed but nav-cta tail pattern not found -- dropdown NOT inserted, check nav markup by hand")
        else:
            print("WARNING: neither .lang-menu-panel nor the old pill row found -- switcher NOT wired, check nav markup by hand")

        if nav_wired and "</nav>" in s:
            s = s.replace("</nav>", "</nav>\n" + LANG_DROPDOWN_JS, 1)
        elif nav_wired:
            print("WARNING: </nav> not found, dropdown JS NOT inserted")

    # ---- CSS: squeeze is ALWAYS inserted; dropdown CSS only on the fallback path ----
    css_to_insert = NAV_SQUEEZE_CSS if dropdown_found else (NAV_SQUEEZE_CSS + NAV_DROPDOWN_CSS)
    if "</style>" in s:
        s = s.replace("</style>", css_to_insert + "</style>", 1)
    else:
        print("WARNING: </style> not found, nav CSS NOT inserted")

    os.makedirs(os.path.dirname(es_path), exist_ok=True)
    with open(es_path, "w", encoding="utf-8") as f:
        f.write(s)

    print(f"Wrote {es_path} ({len(s)} bytes, was {orig_len})")
    if not sk_exists:
        print("NOTE: sk/%s does not exist yet -- SK option omitted from switcher." % page)
    if not uk_exists:
        print("NOTE: uk/%s does not exist yet -- UK option omitted from switcher." % page)
    if not cs_exists:
        print("NOTE: cs/%s does not exist yet -- CS option omitted from switcher." % page)
    if not ru_exists:
        print("NOTE: ru/%s does not exist yet -- RU option omitted from switcher." % page)
    if not de_exists:
        print("NOTE: de/%s does not exist yet -- DE option omitted from switcher." % page)
    if not fr_exists:
        print("NOTE: fr/%s does not exist yet -- FR option omitted from switcher." % page)
    if not li_replaced:
        print("NOTE: no pre-existing mobile lang-switcher li found -- check nav by hand.")
    if not dropdown_found:
        print("NOTE: page did not already have the compact dropdown switcher -- used fallback path, double-check the result.")
    if missing:
        print("Newsletter/footer strings NOT found (check manually):", missing)


if __name__ == "__main__":
    main()
