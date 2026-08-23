#!/usr/bin/env python3
"""
Scaffold a sk/<page>.html from the English original: mechanical path fixes,
nav-label translation, standard newsletter/footer translation, hreflang tags,
and the lang-switch markup (both nav and mobile-menu variants). Leaves all
page-specific prose (hero, body sections, partner cards) untouched for a
follow-up manual translation pass.

Usage: python3 scaffold_sk.py <page.html> "<Slovak Title (no ' — Virtuse')>" "<Slovak og:description>"
"""
import sys, re, os

CONTENT_DIR = "/Users/rasvas/Library/CloudStorage/OneDrive-VirtuseWealthManagement,a.s/Virtu AI/Kimi_Agent_Virtuse%20MiCA%20Partners"

NAV_LABELS = [
    ("Buy Bitcoin", "Kúpiť Bitcoin"),
    ("Mining", "Ťažba"),
    ("Loans", "Pôžičky"),
    ("Custody", "Úschova"),
    ("Tax", "Dane"),
    ("Bots", "Boty"),
    ("Bitcoin Data", "Bitcoin dáta"),
    ("About", "O nás"),
    ("Research", "Výskum"),
    # Treasury and Blog intentionally omitted: Treasury stays "Treasury",
    # Blog label stays "Blog" (only its href changes, handled separately).
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
]

# Pages linked from nav/footer that are NOT yet translated -> go up one level,
# keep English filename. Add the current page's own filename here too EXCEPT
# where it's the self/active link (handled by not touching bare same-name).
OTHER_PAGES = [
    "mining.html", "lending.html", "secure.html", "treasury.html", "tax.html",
    "bots.html", "bitcoin-data.html", "about.html", "buy-bitcoin.html",
    "research.html", "faq.html", "terms-and-conditions.html",
    "privacy-policy.html", "aml-compliance.html", "btc-dominance.html",
    "ma-200w.html", "rainbow-chart.html", "retirement-calculator.html",
]

NEWSLETTER_FOOTER = [
    ("<h2>Fix the Money, Fix the World</h2>", "<h2>Opravte peniaze, opravte svet</h2>"),
    ("<p>Join 18,000+ investors staying ahead of the curve. Get the Virtuse Report in your inbox every week.</p>",
     "<p>Pridajte sa k 18 000+ investorom, ktorí sú o krok vpred. Virtuse Report každý týždeň priamo do vašej schránky.</p>"),
    ('placeholder="Enter your email"', 'placeholder="Zadajte svoj email"'),
    ('<button type="submit">SUBSCRIBE NOW</button>', '<button type="submit">ODOBERAŤ TERAZ</button>'),
    ("btn.textContent = 'SENDING...';", "btn.textContent = 'ODOSIELAM...';"),
    ('msg.textContent = "You\'re in \\u2014 check your inbox for a welcome email.";',
     'msg.textContent = "Ste v tom — skontrolujte si e-mail, čaká vás uvítacia správa.";'),
    ("msg.textContent = (result.data && result.data.error) || 'Something went wrong. Please try again.';",
     "msg.textContent = (result.data && result.data.error) || 'Niečo sa pokazilo. Skúste to prosím znova.';"),
    ("msg.textContent = 'Network error \\u2014 please try again.';",
     "msg.textContent = 'Chyba siete — skúste to prosím znova.';"),
    ("<h4>Company</h4>", "<h4>Spoločnosť</h4>"),
    (">About Us<", ">O nás<"),
    ("<h4>Legal</h4>", "<h4>Právne</h4>"),
    (">Terms &amp; Conditions<", ">Obchodné podmienky<"),
    (">Privacy Policy<", ">Ochrana osobných údajov<"),
    (">AML &amp; Compliance<", ">AML a Compliance<"),
    ("<p>&copy;2018 - 2026 Virtuse Group, All Rights Reserved.</p>",
     "<p>&copy;2018 – 2026 Virtuse Group, všetky práva vyhradené.</p>"),
]


def main():
    page = sys.argv[1]
    sk_title = sys.argv[2]
    sk_desc = sys.argv[3]
    en_path = os.path.join(CONTENT_DIR, page)
    sk_path = os.path.join(CONTENT_DIR, "sk", page)

    with open(en_path, encoding="utf-8") as f:
        s = f.read()

    orig_len = len(s)

    # lang attr
    s = s.replace('<html lang="en">', '<html lang="sk">', 1)

    # path fixes
    for pat, repl in PATH_FIXES:
        s = re.sub(pat, repl, s)

    # logo -> /sk/
    s = s.replace('href="index.html" class="nav-logo"', 'href="/sk/" class="nav-logo"')

    # other-page links -> ../<name>.html  (skip the current page's own name)
    for name in OTHER_PAGES:
        if name == page:
            continue
        s = re.sub(r'href="' + re.escape(name) + r'"', 'href="../' + name + '"', s)

    # blog.html -> ../blog-sk.html (translated already)
    s = re.sub(r'href="blog\.html"', 'href="../blog-sk.html"', s)

    # nav label translation
    for en, sk in NAV_LABELS:
        s = s.replace(f'<span class="nav-link-label">{en}</span>', f'<span class="nav-link-label">{sk}</span>')

    # CTA button label
    s = s.replace(">Get Started<", ">Začať<")

    # newsletter/footer
    missing = []
    for old, new in NEWSLETTER_FOOTER:
        if old not in s:
            missing.append(old)
        else:
            s = s.replace(old, new)

    # <title>
    m = re.search(r'<title>(.*?) — Virtuse</title>', s)
    if m:
        s = s.replace(f'<title>{m.group(1)} — Virtuse</title>', f'<title>{sk_title} — Virtuse</title>', 1)

    # hreflang block (insert after shortcut icon)
    hreflang = (
        f'<link rel="alternate" hreflang="en" href="https://staging.virtuse.com/{page}">\n'
        f'<link rel="alternate" hreflang="sk" href="https://staging.virtuse.com/sk/{page}">\n'
        f'<link rel="alternate" hreflang="x-default" href="https://staging.virtuse.com/{page}">\n'
    )
    s = s.replace('<link rel="shortcut icon" href="../favicon.ico">\n',
                  '<link rel="shortcut icon" href="../favicon.ico">\n' + hreflang, 1)

    # og/twitter title + description + url + locale
    en_title_match = re.search(r'<meta property="og:title" content="(.*?) — Virtuse">', s)
    if en_title_match:
        en_full_title = en_title_match.group(0)
        s = s.replace(en_full_title, f'<meta property="og:title" content="{sk_title} — Virtuse">')
    s = re.sub(r'<meta name="twitter:title" content=".*? — Virtuse">',
                f'<meta name="twitter:title" content="{sk_title} — Virtuse">', s)

    en_desc_match = re.search(r'<meta property="og:description" content="(.*?)">', s)
    if en_desc_match:
        s = s.replace(en_desc_match.group(0), f'<meta property="og:description" content="{sk_desc}">')
    en_tw_desc_match = re.search(r'<meta name="twitter:description" content="(.*?)">', s)
    if en_tw_desc_match:
        s = s.replace(en_tw_desc_match.group(0), f'<meta name="twitter:description" content="{sk_desc}">')

    s = s.replace(f'<meta property="og:url" content="https://staging.virtuse.com/{page}">',
                  f'<meta property="og:url" content="https://staging.virtuse.com/sk/{page}">')
    s = s.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="sk_SK">')

    # lang switch: nav + mobile-menu variant, inserted right after the mobile CTA li / before </ul>+outer button
    lang_block_li = (
        f'    <li class="nav-links-lang-item">\n'
        f'      <div class="lang-switch" role="navigation" aria-label="Jazyk stránky">\n'
        f'        <a href="../{page}" class="lang-opt" lang="en"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'        <a href="{page}" class="lang-opt active" lang="sk"><span class="lang-flag">🇸🇰</span>SK</a>\n'
        f'      </div>\n'
        f'    </li>\n'
    )
    nav_switch_div = (
        f'  <div class="lang-switch nav-lang-switch" role="navigation" aria-label="Jazyk stránky">\n'
        f'    <a href="../{page}" class="lang-opt" lang="en"><span class="lang-flag">🇬🇧</span>EN</a>\n'
        f'    <a href="{page}" class="lang-opt active" lang="sk"><span class="lang-flag">🇸🇰</span>SK</a>\n'
        f'  </div>\n'
    )
    old_tail = '  </ul>\n  <button class="nav-cta">Začať</button>\n</nav>'
    new_tail = f'  </ul>\n{nav_switch_div}  <button class="nav-cta">Začať</button>\n</nav>'
    if old_tail in s:
        # insert lang li before </ul>
        s = s.replace('  </ul>\n  <button class="nav-cta">Začať</button>\n</nav>',
                      lang_block_li + new_tail, 1)
    else:
        print("WARNING: nav tail pattern not found, lang switch NOT inserted (nav)")

    with open(sk_path, "w", encoding="utf-8") as f:
        f.write(s)

    print(f"Wrote {sk_path} ({len(s)} bytes, was {orig_len})")
    if missing:
        print("Newsletter/footer strings NOT found (check manually):", missing)


if __name__ == "__main__":
    main()
