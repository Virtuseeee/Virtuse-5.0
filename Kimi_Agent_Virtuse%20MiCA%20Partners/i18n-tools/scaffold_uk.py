#!/usr/bin/env python3
"""
Scaffold a uk/<page>.html from the English original: mechanical path fixes,
nav-label translation, standard newsletter/footer translation, hreflang tags
(en/sk/uk/x-default), and the language switcher (nav + mobile menu). Leaves
all page-specific prose (hero, body sections, partner cards) untouched for a
follow-up manual translation pass.

This is the SECOND-GENERATION version of the script, updated after the
uk/index.html pilot + two rounds of user feedback. It bakes in fixes that
used to be hand-patched per page:
  - Desktop language switcher is a compact single-button dropdown
    (.nav-actions > .lang-menu), not the old 3-pill .nav-lang-switch --
    the pill row wrapped/overflowed once Ukrainian labels (which run
    longer than English) were added as a 3rd language. The dropdown is
    grouped with the CTA button in one flex item so it sits tight next to
    "Розпочати" instead of floating in the middle of the nav's
    space-between gap.
  - Nav links get a size/spacing squeeze at >=1025px (and an extra
    squeeze in the 1025-1240px band) so the longer Ukrainian labels don't
    wrap to 2 lines the way the English nav does at in-between widths.
  - NAV_LABELS glossary corrected: Custody -> "Кастоді" (not "Зберігання"),
    Treasury -> "Казначейство" (not left as "Treasury"), Blog -> "Блог"
    (not left as "Blog"), Bitcoin Data -> "Біткоїн дані", Buy Bitcoin ->
    "Купити Біткоїн" -- "Bitcoin" is transliterated to "Біткоїн"
    (correct UA spelling, with ї) in all short UI labels.
  - No em-dashes ("—") in the mechanical strings this script writes
    (newsletter/footer messages, title separator) -- rephrased with
    a comma, colon, "!", or restructured clause instead. This is a
    house rule for this rollout: avoid "—" in UK prose generally: rephrase
    around it. If you write page-specific copy by hand after running this
    script, follow the same rule.
  - <title>/og:title/twitter:title separator changed from " — " to " | "
    for the same reason (only applies to the "<Page> — Virtuse" pattern
    used by every page except index.html, which already has its own
    "Virtuse: <tagline>" title set by hand).

Mirrors scaffold_sk.py (see i18n-tools/README.md "Adding language #2").
Assumes the page already has an sk/<page>.html sibling (site is sk-first);
if it doesn't yet, the SK link in the switcher will 404 until it does.

Usage: python3 scaffold_uk.py <page.html> "<Ukrainian Title (no ' — Virtuse')>" "<Ukrainian og:description>"

IMPORTANT for the caller: write the Ukrainian title/description arguments
WITHOUT em-dashes -- use a comma, colon, or restructure the sentence.
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAV_LABELS = [
    ("Buy Bitcoin", "Купити Біткоїн"),
    ("Mining", "Майнінг"),
    ("Loans", "Позики"),
    ("Custody", "Кастоді"),
    ("Treasury", "Казначейство"),
    ("Tax", "Податки"),
    ("Bots", "Боти"),
    ("Blog", "Блог"),
    ("Bitcoin Data", "Біткоїн дані"),
    ("About", "Про нас"),
    ("Research", "Дослідження"),
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
    # Discovered missing during the Czech rollout (fixed there in
    # scaffold_cs.py first): every uk/*.html page this script produced was
    # shipping with an unfixed src="lang-detect.js" -- a 404 from inside
    # uk/. Now that lang-detect.js covers Ukrainian browsers too (not just
    # Slovak), this actually matters; wasn't caught earlier because it did.
    (r'src="lang-detect\.js"', 'src="../lang-detect.js"'),
]

OTHER_PAGES = [
    "mining.html", "lending.html", "secure.html", "treasury.html", "tax.html",
    "bots.html", "bitcoin-data.html", "about.html", "buy-bitcoin.html",
    "research.html", "faq.html", "terms-and-conditions.html",
    "privacy-policy.html", "aml-compliance.html", "btc-dominance.html",
    "ma-200w.html", "rainbow-chart.html", "retirement-calculator.html",
]

NEWSLETTER_FOOTER = [
    ("<h2>Fix the Money, Fix the World</h2>", "<h2>Змінимо гроші, змінимо світ</h2>"),
    ("<p>Join 18,000+ investors staying ahead of the curve. Get the Virtuse Report in your inbox every week.</p>",
     "<p>Приєднайтеся до понад 18 000 інвесторів, які завжди на крок попереду. Отримуйте Virtuse Report щотижня прямо на пошту.</p>"),
    ('placeholder="Enter your email"', 'placeholder="Введіть свій email"'),
    ('<button type="submit">SUBSCRIBE NOW</button>', '<button type="submit">ПІДПИСАТИСЯ</button>'),
    ("btn.textContent = 'SENDING...';", "btn.textContent = 'НАДСИЛАННЯ...';"),
    ('msg.textContent = "You\'re in \\u2014 check your inbox for a welcome email.";',
     'msg.textContent = "Готово! Перевірте пошту, на вас чекає вітальний лист.";'),
    ("msg.textContent = (result.data && result.data.error) || 'Something went wrong. Please try again.';",
     "msg.textContent = (result.data && result.data.error) || 'Щось пішло не так. Спробуйте ще раз.';"),
    ("msg.textContent = 'Network error \\u2014 please try again.';",
     "msg.textContent = 'Помилка мережі. Спробуйте ще раз.';"),
    ("<h4>Company</h4>", "<h4>Компанія</h4>"),
    (">About Us<", ">Про нас<"),
    ("<h4>Legal</h4>", "<h4>Правова інформація</h4>"),
    (">Terms &amp; Conditions<", ">Умови використання<"),
    (">Privacy Policy<", ">Політика конфіденційності<"),
    (">AML &amp; Compliance<", ">AML і Compliance<"),
    ("<p>&copy;2018 - 2026 Virtuse Group, All Rights Reserved.</p>",
     "<p>&copy;2018 – 2026 Virtuse Group, усі права захищені.</p>"),
]

# ---- compact desktop nav + language-dropdown CSS, inserted before </style> ----
NAV_CSS_TEMPLATE = """
/* ===== UK: compact nav text =====
   Ukrainian nav labels run noticeably longer than their English originals,
   so at the same per-item padding/font-size they wrap onto two lines well
   before the English nav does. Tighten the gap/padding/font-size a notch
   and force single-line labels so the row matches (or beats) the English
   nav's fit at the same viewport width. */
/* .nav-actions groups the language switcher with the CTA button into one
   flex item so the nav's space-between doesn't spread them apart -- the
   switcher sits right next to the CTA, not centered in the leftover gap.
   Declared before the media queries below so their narrower-width
   overrides (same selector) win the cascade at those widths. */
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

/* Extra squeeze for the narrow "almost mobile" desktop band, where even
   the compact pass above isn't quite enough room for the longer labels. */
@media (min-width: 1025px) and (max-width: 1240px) {
  .nav { padding: 20px 16px; }
  .nav-links { gap: 0; }
  .nav-links a { padding: 7px 4px; font-size: 12px; }
  .nav-actions { gap: 8px; }
  .nav-cta { padding: 10px 12px; }
}

/* ===== UK: compact language dropdown =====
   Site-navigation stays exactly as shipped (inline links >1024px,
   hamburger overlay <=1024px) -- only the language switcher moves out of
   the inline nav row. A single compact button opens a small dropdown
   (EN/SK/UA), so the desktop nav row never overflows regardless of how
   many languages exist. */

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
    uk_title = sys.argv[2]
    uk_desc = sys.argv[3]
    en_path = os.path.join(CONTENT_DIR, page)
    uk_path = os.path.join(CONTENT_DIR, "uk", page)
    sk_exists = os.path.exists(os.path.join(CONTENT_DIR, "sk", page))

    with open(en_path, encoding="utf-8") as f:
        s = f.read()

    orig_len = len(s)

    # lang attr
    s = s.replace('<html lang="en">', '<html lang="uk">', 1)

    # path fixes
    for pat, repl in PATH_FIXES:
        s = re.sub(pat, repl, s)

    # logo -> /uk/
    s = s.replace('href="index.html" class="nav-logo"', 'href="/uk/" class="nav-logo"')

    # other-page links -> ../<name>.html  (skip the current page's own name)
    for name in OTHER_PAGES:
        if name == page:
            continue
        s = re.sub(r'href="' + re.escape(name) + r'"', 'href="../' + name + '"', s)

    # blog.html -> ../blog.html (no blog-uk.html exists; blog stays English for now)
    s = re.sub(r'href="blog\.html"', 'href="../blog.html"', s)

    # nav label translation
    for en, uk in NAV_LABELS:
        s = s.replace(f'<span class="nav-link-label">{en}</span>', f'<span class="nav-link-label">{uk}</span>')

    # CTA button label
    s = s.replace(">Get Started<", ">Розпочати<")

    # newsletter/footer
    missing = []
    for old, new in NEWSLETTER_FOOTER:
        if old not in s:
            missing.append(old)
        else:
            s = s.replace(old, new)

    # <title>/og:title/twitter:title -- "|" separator, not "—" (house rule).
    # Only matches the "<Page> — Virtuse" pattern used by every page except
    # index.html (which sets its own "Virtuse: <tagline>" title by hand).
    m = re.search(r'<title>(.*?) — Virtuse</title>', s)
    if m:
        s = s.replace(f'<title>{m.group(1)} — Virtuse</title>', f'<title>{uk_title} | Virtuse</title>', 1)

    # hreflang block (insert after shortcut icon) -- includes sk only if it exists
    # strip any pre-existing hreflang block for this page (carried over from
    # the EN source if it was already wired for sk) -- we rebuild it fresh.
    s = re.sub(
        r'<link rel="alternate" hreflang="[^"]*" href="https://staging\.virtuse\.com/(?:sk/)?' + re.escape(page) + r'">\n',
        '', s)

    hreflang_lines = [
        f'<link rel="alternate" hreflang="en" href="https://staging.virtuse.com/{page}">',
    ]
    if sk_exists:
        hreflang_lines.append(f'<link rel="alternate" hreflang="sk" href="https://staging.virtuse.com/sk/{page}">')
    hreflang_lines.append(f'<link rel="alternate" hreflang="uk" href="https://staging.virtuse.com/uk/{page}">')
    hreflang_lines.append(f'<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}">')
    hreflang = "\n".join(hreflang_lines) + "\n"
    s = s.replace('<link rel="shortcut icon" href="../favicon.ico">\n',
                  '<link rel="shortcut icon" href="../favicon.ico">\n' + hreflang, 1)

    # og/twitter title + description + url + locale
    en_title_match = re.search(r'<meta property="og:title" content="(.*?) — Virtuse">', s)
    if en_title_match:
        s = s.replace(en_title_match.group(0), f'<meta property="og:title" content="{uk_title} | Virtuse">')
    s = re.sub(r'<meta name="twitter:title" content=".*? — Virtuse">',
                f'<meta name="twitter:title" content="{uk_title} | Virtuse">', s)

    en_desc_match = re.search(r'<meta property="og:description" content="(.*?)">', s)
    if en_desc_match:
        s = s.replace(en_desc_match.group(0), f'<meta property="og:description" content="{uk_desc}">')
    en_tw_desc_match = re.search(r'<meta name="twitter:description" content="(.*?)">', s)
    if en_tw_desc_match:
        s = s.replace(en_tw_desc_match.group(0), f'<meta name="twitter:description" content="{uk_desc}">')

    s = s.replace(f'<meta property="og:url" content="https://staging.virtuse.com/{page}">',
                  f'<meta property="og:url" content="https://staging.virtuse.com/uk/{page}">')
    s = s.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="uk_UA">')

    # ---- mobile-menu switcher (li.nav-links-lang-item, inside the overlay <ul>) ----
    # 3-pill EN/SK/UA row; works fine stacked vertically in the full-screen
    # overlay, so it's left as-is (only the DESKTOP switcher changes below).
    sk_opt = f'<a href="../sk/{page}" class="lang-opt" lang="sk"><span class="lang-flag">🇸🇰</span>SK</a>\n        ' if sk_exists else ''
    lang_block_li = (
        f'    <li class="nav-links-lang-item">\n'
        f'      <div class="lang-switch" role="navigation" aria-label="Мова сторінки">\n'
        f'        <a href="../{page}" class="lang-opt" lang="en"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        {sk_opt}<a href="{page}" class="lang-opt active" lang="uk"><span class="lang-flag">🇺🇦</span>UA</a>\n'
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

    # ---- desktop switcher: remove the OLD pill row (wire_root.py's
    # .lang-switch.nav-lang-switch, sibling of <ul>), then wrap the trailing
    # nav-cta button together with the new compact dropdown in .nav-actions ----
    existing_nav_pat = re.compile(
        r'  <div class="lang-switch nav-lang-switch" role="navigation" aria-label="[^"]*">\n'
        r'(?:.*\n)*?'
        r'  </div>\n'
    )
    s = existing_nav_pat.sub('', s, count=1)

    sk_opt_menu = f'<a href="../sk/{page}" class="lang-opt" lang="sk" role="menuitem"><span class="lang-flag">🇸🇰</span>SK</a>\n        ' if sk_exists else ''
    nav_actions_html = (
        f'  <div class="nav-actions">\n'
        f'    <div class="lang-menu" id="langMenu">\n'
        f'      <button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Мова сторінки">\n'
        f'        <span class="lang-flag">🇺🇦</span>UA\n'
        f'        <svg class="lang-menu-caret" width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
        f'      </button>\n'
        f'      <div class="lang-menu-panel" id="langMenuPanel" role="menu">\n'
        f'        <a href="../{page}" class="lang-opt" lang="en" role="menuitem"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        {sk_opt_menu}<a href="{page}" class="lang-opt active" lang="uk" role="menuitem"><span class="lang-flag">🇺🇦</span>UA</a>\n'
        f'      </div>\n'
        f'    </div>\n'
        f'    <button class="nav-cta">Розпочати</button>\n'
        f'  </div>\n'
    )
    old_tail = '  <button class="nav-cta">Розпочати</button>\n</nav>'
    nav_wired = old_tail in s
    if nav_wired:
        s = s.replace(old_tail, nav_actions_html + '</nav>', 1)
    else:
        print("WARNING: nav-cta tail pattern not found, lang dropdown NOT inserted (check nav markup by hand)")

    # ---- CSS: insert the compact-nav + dropdown styles right before </style> ----
    if "</style>" in s:
        s = s.replace("</style>", NAV_CSS_TEMPLATE + "</style>", 1)
    else:
        print("WARNING: </style> not found, nav/dropdown CSS NOT inserted")

    # ---- JS: insert the dropdown toggle script right after </nav> ----
    if nav_wired and "</nav>" in s:
        s = s.replace("</nav>", "</nav>\n" + LANG_DROPDOWN_JS, 1)
    elif nav_wired:
        print("WARNING: </nav> not found, dropdown JS NOT inserted")

    os.makedirs(os.path.dirname(uk_path), exist_ok=True)
    with open(uk_path, "w", encoding="utf-8") as f:
        f.write(s)

    print(f"Wrote {uk_path} ({len(s)} bytes, was {orig_len})")
    if not sk_exists:
        print("NOTE: sk/%s does not exist yet -- SK option omitted from switcher." % page)
    if not li_replaced:
        print("NOTE: no pre-existing mobile lang-switcher li found (page never wired for sk?) -- check nav by hand.")
    if missing:
        print("Newsletter/footer strings NOT found (check manually):", missing)


if __name__ == "__main__":
    main()
