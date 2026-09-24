#!/usr/bin/env python3
"""
port_de_parity.py -- EN-parity fixes for the de/ (German) pages, 2026-09-24.
Same starting state and recipe as ru/ (see port_ru_parity.py, which this
mirrors); only the German strings differ. Where a German programmatic-SEO
page exists (/de/bitcoin-steuern/, /de/bitcoin-gebuehrenindex/, ...) the
guide links point at it instead of the EN equivalent.

Usage:
    python3 i18n-tools/port_de_parity.py            # all de/*.html except 404/index/about/bots/blog
    python3 i18n-tools/port_de_parity.py lending.html blog.html
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import port_uk_parity as UK  # noqa: E402
import port_es_parity as ES  # noqa: E402
from port_how_it_works import OLD_CSS as HOW_OLD_CSS, NEW_CSS as HOW_NEW_CSS  # noqa: E402

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DE = os.path.join(SITE, "de")
sub_once, re_sub_once = ES.sub_once, ES.re_sub_once
STEP_LABEL = "Schritt"


def de_path(de_rel, en_rel):
    """German SEO path if it exists locally, else the EN one."""
    return de_rel if os.path.isdir(os.path.join(SITE, de_rel.strip("/"))) else en_rel


TAX_HUB = de_path("/de/bitcoin-steuern/", "/bitcoin-tax/")
FEE_IDX = de_path("/de/bitcoin-gebuehrenindex/", "/bitcoin-fee-index/")
DCA = de_path("/de/bitcoin-dca-rechner/", "/bitcoin-dca-calculator/")
SELL = de_path("/de/bitcoin-verkaufen-oder-beleihen/", "/sell-vs-borrow-bitcoin/")
INHERIT = de_path("/de/bitcoin-erbrecht/", "/bitcoin-inheritance/")
TAX_SK = de_path("/de/bitcoin-steuern/slowakei/", "/bitcoin-tax/slovakia/")
TAX_CZ = de_path("/de/bitcoin-steuern/tschechien/", "/bitcoin-tax/czechia/")
TAX_DE = de_path("/de/bitcoin-steuern/deutschland/", "/bitcoin-tax/germany/")
TAX_AT = de_path("/de/bitcoin-steuern/oesterreich/", "/bitcoin-tax/austria/")
TAX_PL = de_path("/de/bitcoin-steuern/polen/", "/bitcoin-tax/poland/")

GUIDES_ANCHOR = '        <a href="bitcoin-data.html">Bitcoin-Daten</a>\n      </div>'
GUIDES_EXTRA = {
    "index.html": [f'<a href="{TAX_HUB}">Bitcoin-Steuern</a>', f'<a href="{FEE_IDX}">Gebührenindex</a>', f'<a href="{DCA}">DCA-Rechner</a>', f'<a href="{SELL}">Verkaufen oder beleihen</a>', f'<a href="{INHERIT}">Erbrecht</a>'],
    "buy-bitcoin.html": ['<a href="/buy-bitcoin/slovakia/">Kaufen in der Slowakei</a>', '<a href="/buy-bitcoin/czechia/">Kaufen in Tschechien</a>', '<a href="/buy-bitcoin/germany/">Kaufen in Deutschland</a>', f'<a href="{DCA}">DCA-Rechner</a>', f'<a href="{FEE_IDX}">Gebührenindex</a>'],
    "lending.html": [f'<a href="{SELL}">Verkaufen oder beleihen</a>', '<a href="../loan.html">Loan Copilot</a>'],
    "tax.html": [f'<a href="{TAX_HUB}">Bitcoin-Steuern</a>', f'<a href="{INHERIT}">Erbrecht</a>', '<a href="../tax-agent.html">Tax Agent</a>'],
}


def step_footer_guides(c, log, page):
    extra = GUIDES_EXTRA.get(page)
    if not extra or extra[0] in c:
        return c
    new = GUIDES_ANCHOR.replace("      </div>", "".join("        " + a + "\n" for a in extra) + "      </div>")
    return sub_once(c, GUIDES_ANCHOR, new, f"footer Ratgeber +{len(extra)} guide links", log)


def step_how_it_works(c, log, page):
    if HOW_OLD_CSS not in c:
        return c
    c = c.replace(HOW_OLD_CSS, HOW_NEW_CSS)

    def build(m):
        title = m.group(1).strip()
        steps = ES.STEP_RE.findall(m.group(2))
        words = title.split(None, 1)
        heading = f"<h2>{words[0]} <span>{words[1]}</span></h2>" if len(words) > 1 else f"<h2>{title}</h2>"
        sub = "\n    <p>Vier einfache Schritte zu jedem Bitcoin-Service über unseren Hub</p>" if page == "buy-bitcoin.html" else ""
        items = []
        for i, (h3, p) in enumerate(steps, start=1):
            items.append('    <div class="how-log-item">\n      <div class="how-log-marker"><span class="how-log-dot"></span></div>\n      <div class="how-log-body">\n'
                         f'        <span class="how-log-num">{STEP_LABEL} {i:02d}</span>\n        <h3>{h3}</h3>\n        <p>{p}</p>\n      </div>\n    </div>')
        return '<section class="how">\n  <div class="how-header">\n    ' + heading + sub + '\n  </div>\n  <div class="how-log">\n' + "\n".join(items) + '\n  </div>\n</section>'

    c, n = ES.SECTION_RE.subn(build, c, count=1)
    log.append(f"  OK How-It-Works -> changelog ({n} section)")
    return c


DEK_SPLIT = {
    "Unsere CASP-Partner": "Unsere <span>CASP-Partner</span>",
    "Unsere Mining-Partner": "Unsere <span>Mining-Partner</span>",
    "Zwei Wege zur Teilnahme": "Zwei <span>Wege zur Teilnahme</span>",
    "Unsere Kreditpartner": "Unsere <span>Kreditpartner</span>",
    "Unsere Verwahrungspartner": "Unsere <span>Verwahrungspartner</span>",
    "Für wen wir tätig sind": "Für wen <span>wir tätig sind</span>",
    "Unsere institutionellen Partner": "Unsere <span>institutionellen Partner</span>",
    "Unsere Partner für Steuermeldungen": "Unsere <span>Partner für Steuermeldungen</span>",
    "Zwei Wege zur Automatisierung": "Zwei <span>Wege zur Automatisierung</span>",
}


def step_dek_split(c, log):
    for plain, split in DEK_SPLIT.items():
        c = sub_once(c, f"<h2>{plain}</h2>", f"<h2>{split}</h2>", f"dek-split '{plain}'", log)
    return c


def step_claims(c, log):
    c = re_sub_once(c, r'\n\s*<span class="tag tag-green">Bis zu 20 % Rabatt auf ausgewählte Miner</span>', "", "mining: drop 20% claim", log)
    c = re_sub_once(c, r'\n\s*<span class="tag tag-green">Bis zu 70 \$ BTC-Bonus</span>', "", "secure: drop $70 claim", log)
    c = re_sub_once(c, r'\n\s*<span class="tag tag-gray">DISKRETIONÄR</span>', "", "treasury: drop DISKRETIONÄR", log)
    c = re_sub_once(c, r'\n\s*<span class="tag tag-gray">API</span>', "", "treasury: drop API", log)
    return c


def step_lending(c, log):
    c = sub_once(c, UK.LTYPE_OLD, UK.LTYPE_NEW, "lending .ltype-card -> EN flat card", log)
    c = re_sub_once(c, r'<h3><span class="icon">&#\d+;</span> ', "<h3>", "lending: drop emoji icon #1", log)
    c = re_sub_once(c, r'<h3><span class="icon">&#\d+;</span> ', "<h3>", "lending: drop emoji icon #2", log)
    if ".hero-tool-link" not in c:
        c = sub_once(c, "/* ===== HOW IT WORKS ===== */", UK.HERO_TOOL_CSS, "lending: .hero-tool-link CSS", log)
        c = re_sub_once(c, r'(ab 6 % p\.a\.\s*\n  </p>)\n',
                        r'\1\n  <p class="hero-tool-link">\n    <a href="' + SELL + r'">Vergleichen Sie Verkauf und Bitcoin-besicherten Kredit</a>\n  </p>\n', "lending: hero tool link HTML", log)
    c = re_sub_once(c, r'\n\s*<span class="widget-badge">.*?</span>', "", "lending: drop instant-quote badge", log, flags=re.S)
    c = sub_once(c, ".pcard-terms-value {\n  font-size: 13px;\n  font-weight: 700;\n  color: var(--blue);\n}", ".pcard-terms-value {\n  font-size: 13px;\n  font-weight: 700;\n  color: var(--text);\n}", "lending: term values -> white", log)
    c = sub_once(c, ".pcard-terms {\n  background: rgba(88, 166, 255, 0.05);\n  border: 1px dashed rgba(88, 166, 255, 0.2);", ".pcard-terms {\n  background: rgba(255, 255, 255, 0.03);\n  border: 1px dashed var(--border-hover);", "lending: terms box -> neutral", log)
    return c


STEP0_HTML = f"""<!-- ===== STACKING "STEP 0" ===== -->
<section class="stack-step0">
  <div class="stack-step0-inner">
    <div class="stack-step0-text">
      <h3>Wie viel und wie oft möchten Sie kaufen?</h3>
    </div>
    <a href="../stacking.html?utm_source=stacking&amp;utm_medium=widget" class="stack-step0-cta">
      Meinen Sparplan planen
      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
  </div>
</section>

<!-- ===== COUNTRY BUY GUIDES + FEE TOOLS ===== -->
<nav class="seo-guides" aria-label="Kaufratgeber nach Land und Gebührentools">
  <div class="seo-guides-inner">
    <h2>Gebührenranking nach Land</h2>
    <p>Vergleichen Sie die Gebühren aller Partner für Ihren Betrag, bevor Sie eine Plattform wählen – mit dem Stacking Strategist.</p>
    <div class="seo-guides-links">
      <a href="/buy-bitcoin/slovakia/">Kaufen in der Slowakei</a>
      <a href="/buy-bitcoin/czechia/">Kaufen in Tschechien</a>
      <a href="/buy-bitcoin/germany/">Kaufen in Deutschland</a>
      <a href="{DCA}">DCA-Rechner</a>
      <a href="{FEE_IDX}">Gebührenindex</a>
    </div>
  </div>
</nav>

<!-- ===== PARTNERS ===== -->"""


def step_buy_bitcoin(c, log):
    if ".stack-step0" in c:
        return c
    c = sub_once(c, "/* ===== PARTNERS ===== */", UK.STEP0_CSS, "buy-bitcoin: step-0 + seo-guides CSS", log)
    c = sub_once(c, "<!-- ===== PARTNERS ===== -->", STEP0_HTML, "buy-bitcoin: step-0 + seo-guides HTML", log)
    return c


TAX_GUIDES_HTML = f"""<!-- Country tax guides (SEO) -->
<section class="tax-guides" id="tax-guides">
<div class="tax-guides-inner">
<h2>Steuerratgeber nach Land</h2>
<p class="tax-guides-lead">Orientierende Überblicke 2026 für 11 EU-Länder plus eine Erbschafts-Checkliste. Keine Steuerberatung.</p>
<div class="tax-guides-links">
<a href="{TAX_HUB}">Alle 11 Länder</a>
<a href="{TAX_SK}">Slowakei</a>
<a href="{TAX_CZ}">Tschechien</a>
<a href="{TAX_DE}">Deutschland</a>
<a href="{TAX_AT}">Österreich</a>
<a href="{TAX_PL}">Polen</a>
<a href="{INHERIT}">Erbschafts-Checkliste</a>
<a href="../tax-agent.html">Regeln meines Landes prüfen</a>
</div>
</div>
</section>
"""


def step_tax(c, log):
    saved = UK.TAX_GUIDES_HTML
    UK.TAX_GUIDES_HTML = TAX_GUIDES_HTML
    try:
        c = UK.step_tax(c, log)
    finally:
        UK.TAX_GUIDES_HTML = saved
    c = re_sub_once(c, r'\n\s*\.eu-card-inner \{ flex-direction: column; gap: 16px; \}', "", "tax: drop stray .eu-card-inner mq", log)
    if "compare-table-wrap" not in c:
        m = re.search(r'(<section class="compare-section">\s*<h2>[^<]*</h2>\s*)(<table class="compare-table">.*?</table>)', c, re.S)
        if m:
            c = c[:m.start()] + m.group(1) + '<div class="compare-table-wrap">\n' + m.group(2) + '\n</div>' + c[m.end():]
            c = c.replace(".compare-table td.best {", ".compare-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }\n.compare-table td.best {", 1)
            log.append("  OK tax: compare-table-wrap")
    return c


def step_blog(c, log):
    c = sub_once(c, ".nav-links a.active{color:var(--btc-orange);background:rgba(247, 147, 26,0.08)}",
                 ".nav-links a.active{color:var(--text);background:rgba(255,255,255,0.06)}", "blog: nav active neutral (minified)", log)
    c = sub_once(c, ".nav-links a{color:var(--text-muted);font-size:14px;font-weight:500;padding:8px 14px;border-radius:8px;transition:all .2s}",
                 ".nav-links a{color:var(--text-muted);font-size:13px;font-weight:400;padding:6px 12px;border-radius:8px;transition:all .2s}", "blog: nav links 13px/400", log)
    c = sub_once(c, ".post-count b{color:var(--btc-orange);font-weight:800}", ".post-count b{color:var(--text);font-weight:800}", "blog: .post-count b -> text", log)
    c = sub_once(c, "margin-bottom:14px;color:var(--btc-orange);background:rgba(247, 147, 26,0.1);align-self:flex-start}",
                 "margin-bottom:14px;color:var(--text);background:rgba(255,255,255,0.06);align-self:flex-start}", "blog: .tag -> neutral", log)
    c = sub_once(c, "  .nav-links a.active { color: var(--btc-orange, #f7931a); }\n  .nav-links a.active .nav-link-num { color: var(--btc-orange, #f7931a); }",
                 "  .nav-links a.active { color: var(--text); }\n  .nav-links a.active .nav-link-num { color: var(--text); }", "blog: drawer active -> text", log)
    c = sub_once(c, "    width: 3px;\n    background: var(--btc-orange, #f7931a);\n  }", "    width: 3px;\n    background: var(--text);\n  }", "blog: drawer active bar -> text", log)
    if ".hero-newsdesk" not in c:
        c = sub_once(c, ".post-count b{", ".hero-newsdesk{margin-top:16px}\n.hero-newsdesk a{color:var(--btc-orange);font-weight:700}\n.post-count b{", "blog: .hero-newsdesk CSS", log)
        c = sub_once(c, "<p>Gedanken zu Bitcoin, Makroökonomie und der Zukunft des Geldes vom CEO von Virtuse, Ras Vasilisin.</p>\n  </div>",
                     "<p>Gedanken zu Bitcoin, Makroökonomie und der Zukunft des Geldes vom CEO von Virtuse, Ras Vasilisin.</p>\n    <p class=\"hero-newsdesk\"><a href=\"../news.html\">Newsdesk</a> – das wöchentliche Briefing und Pulse.</p>\n  </div>",
                     "blog: hero newsdesk line", log)
    return c


def process(page):
    path = os.path.join(DE, page)
    c = open(path, encoding="utf-8").read()
    orig, log = c, []
    if page == "blog.html":
        c = step_blog(c, log)
    else:
        c = UK.step_lang_pill(c, log)
        c = UK.step_navcta_hover(c, log)
        c = UK.step_sec_title(c, log)
        c = UK.step_checkmarks(c, log)
        c = ES.step_legacy_orange_hovers(c, log)
        c = step_footer_guides(c, log, page)
        c = step_how_it_works(c, log, page)
        c = step_dek_split(c, log)
        c = step_claims(c, log)
        if page == "lending.html":
            c = step_lending(c, log)
        if page == "treasury.html":
            c = UK.step_treasury(c, log)
        if page == "secure.html":
            c = UK.step_secure(c, log)
        if page == "buy-bitcoin.html":
            c = step_buy_bitcoin(c, log)
            c = sub_once(c, ".btn-primary {\n  background: var(--btc-orange);\n  color: white;\n  transition: all 0.2s;\n}\n\n", "", "buy-bitcoin: drop legacy orange .btn-primary", log)
        if page == "tax.html":
            c = step_tax(c, log)
        if page == "bitcoin-data.html":
            c = ES.step_bitcoin_data(c, log)
    if c != orig:
        open(path, "w", encoding="utf-8").write(c)
    print(f"{page}: {'changed' if c != orig else 'unchanged'}")
    for line in log:
        print(line)


if __name__ == "__main__":
    pages = sys.argv[1:] or sorted(p for p in os.listdir(DE) if p.endswith(".html") and p not in ("404.html", "index.html", "about.html", "bots.html"))
    for p in pages:
        process(p)
