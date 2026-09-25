#!/usr/bin/env python3
"""Scaffold hu/<page>.html from the current (redesigned) EN root page.

Structural transforms only -- the copy stays English and is translated
afterwards by apply_hu_translations.py. Written for the post-redesign
markup (two .lang-menu instances, Brief nav item, 5-column footer); the
older scaffold_<lang>.py scripts target the pre-redesign nav and no
longer match it.

Usage: python3 i18n-tools/scaffold_hu.py [page.html ...]   (default: all)
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANG = "hu"
DOMAIN = "https://virtuse.com"

PAGES = [
    "404.html", "about.html", "aml-compliance.html", "bitcoin-data.html",
    "bots.html", "btc-dominance.html", "buy-bitcoin.html", "faq.html",
    "fear-greed.html", "index.html", "lending.html", "ma-200w.html",
    "mining.html", "privacy-policy.html", "rainbow-chart.html",
    "retirement-calculator.html", "root-cycles.html", "secure.html",
    "tax.html", "terms-and-conditions.html", "trading-volume.html",
    "treasury.html",
]
# Pages that exist inside hu/ (bare relative links to these stay bare).
LOCAL = set(PAGES) | {"blog.html"}

SWITCH_ORDER = ["en", "sk", "uk", "cs", "ru", "de", "fr", "es", "pl", "hu"]
FLAG = {"en": "🇬🇧", "sk": "🇸🇰", "uk": "🇺🇦", "cs": "🇨🇿", "ru": "🇷🇺",
        "de": "🇩🇪", "fr": "🇫🇷", "es": "🇪🇸", "pl": "🇵🇱", "hu": "🇭🇺"}
CODE = {"en": "EN", "sk": "SK", "uk": "UA", "cs": "CS", "ru": "RU",
        "de": "DE", "fr": "FR", "es": "ES", "pl": "PL", "hu": "HU"}


NAV_SQUEEZE_CSS = """
/* ===== HU: compact nav text =====
   Hungarian nav labels run longer than English ("Letétkezelés",
   "Bitcoin-adatok"), so at the default padding they wrap onto two lines at
   common desktop widths. Same block as scaffold_es.py, with a selector
   strong enough to beat the redesign's own .nav-links a:not(.lang-opt). */
@media (min-width: 1025px) {
  .nav-links { gap: 2px; }
  .nav .nav-links a:not(.lang-opt) {
    font-size: 13px;
    padding: 8px 9px;
    white-space: nowrap;
  }
}

@media (min-width: 1025px) and (max-width: 1300px) {
  .nav { padding: 20px 16px; }
  .nav-links { gap: 0; }
  .nav .nav-links a:not(.lang-opt) { padding: 7px 4px; font-size: 12px; }
  .nav-actions { gap: 8px; }
  .nav-cta { padding: 10px 12px; }
}

/* Below ~1200px the twelve Hungarian labels still push the CTA off-screen. */
@media (min-width: 1025px) and (max-width: 1200px) {
  .nav { padding: 18px 12px; }
  .nav .nav-links a:not(.lang-opt) { padding: 7px 2px; font-size: 11px; }
  .nav-logo span { font-size: 18px !important; }
}
"""


def fail(msg):
    raise SystemExit("ERROR: " + msg)


def is_relative(url):
    return not re.match(r"^(?:[a-z]+:|/|#|\.\./)", url)


def rewrite_url(url):
    if url in ("/",):
        return "/hu/"
    if not is_relative(url):
        return url
    base = re.split(r"[?#]", url, 1)[0]
    if base in LOCAL:
        return url
    return "../" + url


def switcher_langs(page):
    # Only languages that actually have this page (uk/cs/ru lack some
    # dashboard pages; EN's own switcher still links to those dead URLs).
    return [l for l in SWITCH_ORDER
            if l in ("en", LANG) or os.path.exists(os.path.join(ROOT, l, page))]


def switcher_href(lang, page):
    return "../" + page if lang == "en" else "../%s/%s" % (lang, page)


def rebuild_switchers(s, page):
    """Rewrite every .lang-menu-panel's options and add HU (active)."""
    opt_re = re.compile(r'(?P<indent>[ \t]*)<a [^>]*class="lang-opt[^"]*"[^>]*>.*?</a>\n')

    def panel(m):
        block = m.group(0)
        opts = list(opt_re.finditer(block))
        if not opts:
            fail("%s: empty lang panel" % page)
        indent = opts[0].group("indent")
        role = ' role="menuitem"' if 'role="menuitem"' in opts[0].group(0) else ""
        lines = []
        for lang in switcher_langs(page):
            active = lang == LANG
            lines.append('%s<a href="%s" class="lang-opt%s" lang="%s"%s><span class="lang-flag">%s</span>%s</a>\n'
                         % (indent, page if active else switcher_href(lang, page),
                            " active" if active else "", lang, role, FLAG[lang], CODE[lang]))
        start, end = opts[0].start(), opts[-1].end()
        return block[:start] + "".join(lines) + block[end:]

    panel_re = re.compile(r'<div class="lang-menu-panel"[^>]*>\n.*?</div>', re.S)
    s, n = panel_re.subn(panel, s)
    if n == 0 and 'class="lang-opt' in s:
        fail("%s: lang options present but no .lang-menu-panel matched" % page)
    # Current-language label on both dropdown buttons.
    s, nb = re.subn(r'(<button[^>]*class="lang-menu-btn"[^>]*>\s*)<span class="lang-flag">🇬🇧</span>EN',
                    r'\1<span class="lang-flag">🇭🇺</span>HU', s)
    if nb != n:
        fail("%s: %d panels but %d dropdown buttons relabelled" % (page, n, nb))
    return s, n


def rewrite_attrs(s):
    def tag(m):
        t = m.group(0)
        if 'class="lang-opt' in t:
            return t
        return re.sub(r'\b(href|src)="([^"]*)"',
                      lambda a: '%s="%s"' % (a.group(1), rewrite_url(a.group(2))), t)
    return re.sub(r"<(?:a|link|img|script|source|iframe)\b[^>]*>", tag, s)


def rewrite_script_literals(s):
    def block(m):
        body = m.group(2)
        body = re.sub(r"""(['"])([a-z0-9-]+\.html(?:[?#][^'"]*)?)\1""",
                      lambda q: q.group(1) + rewrite_url(q.group(2)) + q.group(1), body)
        return m.group(1) + body + m.group(3)
    return re.sub(r"(<script\b[^>]*>)(.*?)(</script>)", block, s, flags=re.S)


def scaffold(page):
    src = os.path.join(ROOT, page)
    s = open(src, encoding="utf-8").read()

    s, n = re.subn(r'<html lang="en"', '<html lang="hu"', s, count=1)
    if not n:
        fail(page + ": no <html lang=\"en\">")

    # hreflang: add hu right after pl (404 has none)
    pl_line = '<link rel="alternate" hreflang="pl" href="%s/pl/%s">' % (DOMAIN, page)
    if 'hreflang="hu"' in s:
        pass  # the EN page is already wired (wire_hu_into_existing.py)
    elif pl_line in s:
        s = s.replace(pl_line, pl_line + '\n<link rel="alternate" hreflang="hu" href="%s/hu/%s">' % (DOMAIN, page), 1)
    elif page != "404.html":
        fail(page + ": pl hreflang line not found")

    s = s.replace('<meta property="og:url" content="%s/%s">' % (DOMAIN, page),
                  '<meta property="og:url" content="%s/hu/%s">' % (DOMAIN, page))
    s = s.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="hu_HU">')

    # The sitewide Concierge launcher is EN/SK/CS-only; translated folders omit it.
    s = re.sub(r'[ \t]*<script src="concierge-launcher\.js"[^>]*></script>\n?', "", s)

    s, panels = rebuild_switchers(s, page)
    s = re.sub(r'<a href="(?:index\.html|/)" class="nav-logo">', '<a href="/hu/" class="nav-logo">', s)
    s = rewrite_attrs(s)
    s = rewrite_script_literals(s)

    if "</style>" not in s:
        fail(page + ": no </style> for the compact nav CSS")
    s = s.replace("</style>", NAV_SQUEEZE_CSS + "</style>", 1)

    s = s.replace('data-consultation-lang="en"', 'data-consultation-lang="hu"')
    s = s.replace("lang: 'en'", "lang: 'hu'")
    s = s.replace("JSON.stringify({ email: email, hp: hp })",
                  "JSON.stringify({ email: email, hp: hp, lang: 'hu' })")
    if "virtuse-newsletter" in s and "lang: 'hu'" not in s:
        fail(page + ": newsletter fetch found but lang 'hu' not set")

    out_dir = os.path.join(ROOT, LANG)
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, page), "w", encoding="utf-8") as fh:
        fh.write(s)
    print("%-28s ok (lang panels: %d)" % (page, panels))


if __name__ == "__main__":
    for p in (sys.argv[1:] or PAGES):
        scaffold(p)
