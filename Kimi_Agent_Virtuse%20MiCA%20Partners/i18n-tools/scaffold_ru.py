#!/usr/bin/env python3
"""
Scaffold a ru/<page>.html from the English original: mechanical path fixes,
nav-label translation, standard newsletter/footer translation, hreflang tags
(en/sk/uk/cs/ru/x-default), and the language switcher (desktop dropdown +
mobile menu, now a 5-option EN/SK/UK/CS/RU set). Leaves all page-specific
prose (hero, body sections, partner cards) untouched for a follow-up
manual translation pass.

Adapted from scaffold_cs.py (see i18n-tools/README.md "Adding the next
language") with the same structural approach: Russian is language #5
joining an already-4-language site, so sk_exists/uk_exists/cs_exists are
all checked (in practice all three should already be true for every real
page).

Audience note: this Russian rollout targets EU-resident Russian speakers
specifically (confirmed with the user), not the Russian Federation market
-- doesn't change any code here, but keep it in mind for hand-translated
prose (e.g. don't localize prices/examples toward RF-specific context).

Language-specific notes for whoever copies this file next:
  - "Custody": UK explicitly corrected its glossary from a literal
    translation ("Зберігання") to the transliteration "Кастоді" per an
    explicit user request mid-rollout, while SK/CS both use a literal
    translation ("Úschova" = "safekeeping"). For Russian this script
    defaults to "Кастоди" (transliteration, matching the UK precedent,
    and matching how the term is actually used in RU crypto/fintech
    press) -- flag this as a glossary choice worth double-checking with
    the user, since it diverges from the SK/CS pattern.
  - "Treasury" kept as the English loanword, matching SK/CS (not
    UK's full translation "Казначейство") -- RU fintech/crypto press
    uses "Treasury" as a loanword very commonly, similar to SK/CS.
  - Footer "Legal" section header follows the SK site's post-review
    convention ("Právne" -> "Informácie") and CS's copy of it
    ("Informace") rather than a literal "Legal" translation -- Russian
    "Информация", matching that established sitewide pattern.
  - No em dashes ("—") in any mechanically-written string, same house
    rule as UK/CS. <title>/og:title/twitter:title separator is "|".
  - Bitcoin declines by grammatical case in Russian just like Ukrainian
    (Биткоин/Биткоина/Биткоину/Биткоин/Биткоином/(о) Биткоине) -- this
    script only writes NOMINATIVE "Биткоин" in nav labels/mechanical
    strings; hand-translated prose must decline it correctly per
    sentence, same rule as scaffold_uk.py.

Usage: python3 scaffold_ru.py <page.html> "<Russian Title (no ' — Virtuse')>" "<Russian og:description>"

IMPORTANT for the caller: write the Russian title/description arguments
WITHOUT em-dashes -- use a comma, colon, or restructure the sentence.
"""
import sys, re, os

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAV_LABELS = [
    ("Buy Bitcoin", "Купить Биткоин"),
    ("Mining", "Майнинг"),
    ("Loans", "Займы"),
    ("Custody", "Кастоди"),  # transliteration, matches UK precedent -- see module docstring
    ("Treasury", "Treasury"),
    ("Tax", "Налоги"),
    ("Bots", "Боты"),
    ("Blog", "Блог"),
    ("Bitcoin Data", "Биткоин данные"),
    ("About", "О нас"),
    ("Research", "Исследования"),
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
    ("<h2>Fix the Money, Fix the World</h2>", "<h2>Изменим финансы, изменим мир</h2>"),
    ("<p>Join 18,000+ investors staying ahead of the curve. Get the Virtuse Report in your inbox every week.</p>",
     "<p>Присоединяйтесь к более чем 18 000 инвесторов, которые всегда на шаг впереди. Получайте Virtuse Report на почту каждую неделю.</p>"),
    ('placeholder="Enter your email"', 'placeholder="Введите свой email"'),
    ('<button type="submit">SUBSCRIBE NOW</button>', '<button type="submit">ПОДПИСАТЬСЯ</button>'),
    ("btn.textContent = 'SENDING...';", "btn.textContent = 'ОТПРАВКА...';"),
    ('msg.textContent = "You\'re in \\u2014 check your inbox for a welcome email.";',
     'msg.textContent = "Готово! Проверьте почту, вас ждёт приветственное письмо.";'),
    ("msg.textContent = (result.data && result.data.error) || 'Something went wrong. Please try again.';",
     "msg.textContent = (result.data && result.data.error) || 'Что-то пошло не так. Попробуйте ещё раз.';"),
    ("msg.textContent = 'Network error \\u2014 please try again.';",
     "msg.textContent = 'Ошибка сети. Попробуйте ещё раз.';"),
    ("<h4>Company</h4>", "<h4>Компания</h4>"),
    (">About Us<", ">О нас<"),
    ("<h4>Legal</h4>", "<h4>Информация</h4>"),  # matches SK/CS's post-review convention, not a literal "Legal" translation
    (">Terms &amp; Conditions<", ">Условия использования<"),
    (">Privacy Policy<", ">Политика конфиденциальности<"),
    (">AML &amp; Compliance<", ">AML и Compliance<"),
    ("<p>&copy;2018 - 2026 Virtuse Group, All Rights Reserved.</p>",
     "<p>&copy;2018 – 2026 Virtuse Group, все права защищены.</p>"),
]

# ---- compact desktop nav + language-dropdown CSS, inserted before </style> ----
NAV_CSS_TEMPLATE = """
/* ===== RU: compact nav text =====
   Same squeeze applied for UK/CS (keeps the 5-language dropdown button +
   CTA comfortably fitting at the same breakpoints rather than re-tuning
   per language). */
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

/* ===== RU: compact language dropdown =====
   Same dropdown pattern as UK/CS's rollout, now listing 5 languages
   (EN/SK/UK/CS/RU) instead of 4. */

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
    ru_title = sys.argv[2]
    ru_desc = sys.argv[3]
    en_path = os.path.join(CONTENT_DIR, page)
    ru_path = os.path.join(CONTENT_DIR, "ru", page)
    sk_exists = os.path.exists(os.path.join(CONTENT_DIR, "sk", page))
    uk_exists = os.path.exists(os.path.join(CONTENT_DIR, "uk", page))
    cs_exists = os.path.exists(os.path.join(CONTENT_DIR, "cs", page))

    with open(en_path, encoding="utf-8") as f:
        s = f.read()

    orig_len = len(s)

    # lang attr
    s = s.replace('<html lang="en">', '<html lang="ru">', 1)

    # path fixes
    for pat, repl in PATH_FIXES:
        s = re.sub(pat, repl, s)

    # logo -> /ru/
    s = s.replace('href="index.html" class="nav-logo"', 'href="/ru/" class="nav-logo"')

    # other-page links -> ../<name>.html  (skip the current page's own name)
    for name in OTHER_PAGES:
        if name == page:
            continue
        s = re.sub(r'href="' + re.escape(name) + r'"', 'href="../' + name + '"', s)

    # blog.html -> ../blog.html (no blog-ru.html/ru/blog.html exists yet)
    s = re.sub(r'href="blog\.html"', 'href="../blog.html"', s)

    # nav label translation
    for en, ru in NAV_LABELS:
        s = s.replace(f'<span class="nav-link-label">{en}</span>', f'<span class="nav-link-label">{ru}</span>')

    # CTA button label
    s = s.replace(">Get Started<", ">Начать<")

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
        s = s.replace(f'<title>{m.group(1)} — Virtuse</title>', f'<title>{ru_title} | Virtuse</title>', 1)

    # hreflang block (insert after shortcut icon) -- includes sk/uk/cs only if they exist
    s = re.sub(
        r'<link rel="alternate" hreflang="[^"]*" href="https://staging\.virtuse\.com/(?:sk/|uk/|cs/)?' + re.escape(page) + r'">\n',
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
    hreflang_lines.append(f'<link rel="alternate" hreflang="ru" href="https://staging.virtuse.com/ru/{page}">')
    hreflang_lines.append(f'<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}">')
    hreflang = "\n".join(hreflang_lines) + "\n"
    s = s.replace('<link rel="shortcut icon" href="../favicon.ico">\n',
                  '<link rel="shortcut icon" href="../favicon.ico">\n' + hreflang, 1)

    # og/twitter title + description + url + locale
    en_title_match = re.search(r'<meta property="og:title" content="(.*?) — Virtuse">', s)
    if en_title_match:
        s = s.replace(en_title_match.group(0), f'<meta property="og:title" content="{ru_title} | Virtuse">')
    s = re.sub(r'<meta name="twitter:title" content=".*? — Virtuse">',
                f'<meta name="twitter:title" content="{ru_title} | Virtuse">', s)

    en_desc_match = re.search(r'<meta property="og:description" content="(.*?)">', s)
    if en_desc_match:
        s = s.replace(en_desc_match.group(0), f'<meta property="og:description" content="{ru_desc}">')
    en_tw_desc_match = re.search(r'<meta name="twitter:description" content="(.*?)">', s)
    if en_tw_desc_match:
        s = s.replace(en_tw_desc_match.group(0), f'<meta name="twitter:description" content="{ru_desc}">')

    s = s.replace(f'<meta property="og:url" content="https://staging.virtuse.com/{page}">',
                  f'<meta property="og:url" content="https://staging.virtuse.com/ru/{page}">')
    s = s.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="ru_RU">')

    # ---- mobile-menu switcher (li.nav-links-lang-item, inside the overlay <ul>) ----
    sk_opt = f'<a href="../sk/{page}" class="lang-opt" lang="sk"><span class="lang-flag">🇸🇰</span>SK</a>\n        ' if sk_exists else ''
    uk_opt = f'<a href="../uk/{page}" class="lang-opt" lang="uk"><span class="lang-flag">🇺🇦</span>UA</a>\n        ' if uk_exists else ''
    cs_opt = f'<a href="../cs/{page}" class="lang-opt" lang="cs"><span class="lang-flag">🇨🇿</span>CS</a>\n        ' if cs_exists else ''
    lang_block_li = (
        f'    <li class="nav-links-lang-item">\n'
        f'      <div class="lang-switch" role="navigation" aria-label="Язык страницы">\n'
        f'        <a href="../{page}" class="lang-opt" lang="en"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        {sk_opt}{uk_opt}{cs_opt}<a href="{page}" class="lang-opt active" lang="ru"><span class="lang-flag">🇷🇺</span>RU</a>\n'
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
    # (every real page has one, post dropdown_retrofit.py + CS rollout) ----
    sk_opt_menu = f'<a href="../sk/{page}" class="lang-opt" lang="sk" role="menuitem"><span class="lang-flag">🇸🇰</span>SK</a>\n        ' if sk_exists else ''
    uk_opt_menu = f'<a href="../uk/{page}" class="lang-opt" lang="uk" role="menuitem"><span class="lang-flag">🇺🇦</span>UA</a>\n        ' if uk_exists else ''
    cs_opt_menu = f'<a href="../cs/{page}" class="lang-opt" lang="cs" role="menuitem"><span class="lang-flag">🇨🇿</span>CS</a>\n        ' if cs_exists else ''

    panel_pat = re.compile(
        r'(      <div class="lang-menu-panel" id="langMenuPanel" role="menu">\n)'
        r'(?:.*\n)*?'
        r'(      </div>\n)'
    )
    new_panel_body = (
        f'        <a href="../{page}" class="lang-opt" lang="en" role="menuitem"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        {sk_opt_menu}{uk_opt_menu}{cs_opt_menu}<a href="{page}" class="lang-opt active" lang="ru" role="menuitem"><span class="lang-flag">🇷🇺</span>RU</a>\n'
    )
    dropdown_found = bool(panel_pat.search(s))
    s = panel_pat.sub(lambda m: m.group(1) + new_panel_body + m.group(2), s, count=1)

    if dropdown_found:
        s = s.replace(
            '<button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Page language">',
            '<button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Язык страницы">',
            1)
        s = re.sub(
            r'(<button type="button" class="lang-menu-btn" id="langMenuBtn"[^>]*>\n\s*<span class="lang-flag">)[^<]*(</span>)\S*',
            r'\g<1>🇷🇺\g<2>RU', s, count=1)
        nav_wired = True
    else:
        # Fallback: no dropdown found (shouldn't happen for any real page
        # post dropdown_retrofit.py / CS rollout, but handle the old pill
        # row just in case this script runs against a page that predates it).
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
            f'      <button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Язык страницы">\n'
            f'        <span class="lang-flag">🇷🇺</span>RU\n'
            f'        <svg class="lang-menu-caret" width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
            f'      </button>\n'
            f'      <div class="lang-menu-panel" id="langMenuPanel" role="menu">\n'
            f'{new_panel_body}'
            f'      </div>\n'
            f'    </div>\n'
            f'    <button class="nav-cta">Начать</button>\n'
            f'  </div>\n'
        )
        old_tail = '  <button class="nav-cta">Начать</button>\n</nav>'
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

    os.makedirs(os.path.dirname(ru_path), exist_ok=True)
    with open(ru_path, "w", encoding="utf-8") as f:
        f.write(s)

    print(f"Wrote {ru_path} ({len(s)} bytes, was {orig_len})")
    if not sk_exists:
        print("NOTE: sk/%s does not exist yet -- SK option omitted from switcher." % page)
    if not uk_exists:
        print("NOTE: uk/%s does not exist yet -- UK option omitted from switcher." % page)
    if not cs_exists:
        print("NOTE: cs/%s does not exist yet -- CS option omitted from switcher." % page)
    if not li_replaced:
        print("NOTE: no pre-existing mobile lang-switcher li found -- check nav by hand.")
    if not dropdown_found:
        print("NOTE: page did not already have the compact dropdown switcher -- used fallback path, double-check the result.")
    if missing:
        print("Newsletter/footer strings NOT found (check manually):", missing)


if __name__ == "__main__":
    main()
