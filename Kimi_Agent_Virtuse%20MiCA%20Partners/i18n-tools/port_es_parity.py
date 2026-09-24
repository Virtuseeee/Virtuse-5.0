#!/usr/bin/env python3
"""
port_es_parity.py -- EN-parity fixes for the es/ (Spanish) pages, 2026-09-24.
Run AFTER port_homepage_redesign_es.py (tokens/nav/hamburger/lang dropdown/
CTA/pcard). This script is the Spanish counterpart of port_uk_parity.py plus
the pieces es/ never received because it was created after the batch ports:
the 5-column + wordmark footer, the "Recibe el Brief" newsletter card, and the
"Brief" nav item. Every step is optional/idempotent and logs what it did.

Usage:
    python3 i18n-tools/port_es_parity.py            # all es/*.html except 404/blog
    python3 i18n-tools/port_es_parity.py lending.html tax.html

Not covered here (hand work): tax.html / bots.html / index.html style-block
transplants, about.html recipe, blog.html mobile language dropdown.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from port_how_it_works import OLD_CSS as HOW_OLD_CSS, NEW_CSS as HOW_NEW_CSS  # noqa: E402
import port_uk_parity as UK  # noqa: E402  (reuses its CSS block constants)

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ES = os.path.join(SITE, "es")
EN_BUY = open(os.path.join(SITE, "buy-bitcoin.html"), encoding="utf-8").read()
ES_BLOG = open(os.path.join(ES, "blog.html"), encoding="utf-8").read()

STEP_LABEL = "Paso"


def flex(s):
    return re.compile(r"\s+".join(re.escape(p) for p in re.split(r"\s+", s.strip())))


def sub_once(c, old, new, label, log):
    n = c.count(old)
    if n == 0:
        m = flex(old).search(c)
        if not m:
            return c
        log.append(f"  OK {label} (flex)")
        return c[: m.start()] + new.strip("\n") + c[m.end():]
    if n > 1:
        log.append(f"  !! {label}: {n} matches, replacing all")
    log.append(f"  OK {label}")
    return c.replace(old, new)


def re_sub_once(c, pattern, repl, label, log, flags=0):
    new, n = re.subn(pattern, repl, c, count=1, flags=flags)
    if n:
        log.append(f"  OK {label}")
    return new


# ---------------------------------------------------------------- shared --
def step_lang_pill(c, log):
    return sub_once(c, ".lang-menu-panel .lang-opt.active {\n  background: var(--btc-orange);\n  color: #0d0902;\n}",
                    ".lang-menu-panel .lang-opt.active {\n  background: var(--text);\n  color: var(--dark);\n}", "active language pill -> neutral", log)


def step_navcta_hover(c, log):
    return sub_once(c, ".nav-cta:hover { background: var(--btc-orange-light); }\n\n", "", "drop legacy .nav-cta:hover", log)


def step_sec_title(c, log):
    c = sub_once(c, ".sec-title h2 {\n  font-size: 32px;\n  font-weight: 800;\n  letter-spacing: -0.02em;\n  margin-bottom: 8px;\n}",
                 ".sec-title h2 {\n  font-size: 42px;\n  font-weight: 700;\n  letter-spacing: -0.02em;\n  margin-bottom: 8px;\n}\n\n.sec-title h2 span { font-weight: 400; color: var(--text-muted); }", ".sec-title h2 42/700 + span", log)
    c = sub_once(c, ".sec-title p {\n  font-size: 15px;\n  color: var(--text-muted);\n}",
                 ".sec-title p {\n  font-size: 20px;\n  font-weight: 400;\n  color: var(--text-muted);\n  max-width: 620px;\n  line-height: 1.55;\n}", ".sec-title p 20px", log)
    c = sub_once(c, ".audience-header h2 {\n  font-size: 32px;\n  font-weight: 800;\n  letter-spacing: -0.02em;\n  margin-bottom: 8px;\n}",
                 ".audience-header h2 {\n  font-size: 42px;\n  font-weight: 700;\n  letter-spacing: -0.02em;\n  margin-bottom: 8px;\n}\n\n.audience-header h2 span { font-weight: 400; color: var(--text-muted); }", ".audience-header h2 42/700 + span", log)
    c = sub_once(c, ".audience-header p {\n  font-size: 15px;\n  color: var(--text-muted);\n}",
                 ".audience-header p {\n  font-size: 20px;\n  font-weight: 400;\n  color: var(--text-muted);\n  max-width: 620px;\n  line-height: 1.55;\n}", ".audience-header p 20px", log)
    return c


def step_checkmarks(c, log):
    for sel in (".pcard-features li svg", ".audience-features li svg"):
        c = re_sub_once(c, r"(" + re.escape(sel) + r" \{\n  width: 16px;\n  height: 16px;\n  color: )var\(--btc-orange\);", r"\1var(--text);", f"{sel} -> var(--text)", log)
    return c


def step_legacy_orange_hovers(c, log):
    c = sub_once(c, ".btn-primary:hover { background: #ffffff; color: var(--btc-orange); transform: translateY(-1px); }\n\n", "", "drop legacy .btn-primary:hover", log)
    c = sub_once(c, ".btn-secondary:hover { border-color: var(--btc-orange); color: var(--btc-orange); }\n\n", "", "drop legacy .btn-secondary:hover", log)
    c = sub_once(c, ".newsletter-form button:hover { background: var(--btc-orange); color: white; }\n\n", "", "drop legacy .newsletter-form button:hover", log)
    c = sub_once(c, ".footer-col a:hover { color: var(--btc-orange); }", ".footer-col a:hover { color: var(--text); }", ".footer-col a:hover -> text", log)
    return c


# ---------------------------------------------------------------- Brief nav --
BRIEF_LI = ('    <li><a href="../news.html?utm_source=brief&amp;utm_medium=nav"><span class="nav-link-num">09</span><span class="nav-link-label">Brief</span>'
            '<svg class="nav-link-arrow" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></a></li>\n')


def step_brief_nav(c, log):
    if ">Brief</span>" in c:
        return c
    m = re.search(r'(    <li><a href="bitcoin-data\.html"[^>]*><span class="nav-link-num">)09(</span>)', c)
    m2 = re.search(r'(<li><a href="about\.html"[^>]*><span class="nav-link-num">)10(</span>)', c)
    if not (m and m2):
        log.append("  !! Brief nav: anchors not found")
        return c
    c = c[: m.start()] + m.group(1) + "10" + m.group(2) + c[m.end():]
    m2 = re.search(r'(<li><a href="about\.html"[^>]*><span class="nav-link-num">)10(</span>)', c)
    c = c[: m2.start()] + m2.group(1) + "11" + m2.group(2) + c[m2.end():]
    m3 = re.search(r'    <li><a href="bitcoin-data\.html"', c)
    c = c[: m3.start()] + BRIEF_LI + c[m3.start():]
    log.append("  OK Brief nav item (09) + renumber")
    return c


# ---------------------------------------------------------------- footer --
def en_block(start_marker, end_marker):
    s = EN_BUY.index(start_marker)
    e = EN_BUY.index(end_marker, s)
    return EN_BUY[s:e]


NEWSLETTER_FOOTER_CSS = en_block("/* ===== NEWSLETTER ===== */", "/* ===== RESPONSIVE ===== */")
FOOTER_HTML = re.search(r'<footer class="footer-main">.*?</footer>', ES_BLOG, re.S).group(0)
FOOTER_HTML = FOOTER_HTML.replace('color:#e6edf3;line-height:1;position:relative;top:4px;">Virtuse', 'color:var(--text);line-height:1;position:relative;top:4px;">Virtuse')
GUIDES_EXTRA = {
    # EN index.html's Guides column is the tax/fee set; buy-bitcoin.html's is the buy-in-country set (see below).
    "index.html": ['<a href="/bitcoin-tax/">Impuestos sobre Bitcoin</a>', '<a href="/bitcoin-fee-index/">Índice de comisiones</a>', '<a href="/bitcoin-dca-calculator/">Calculadora DCA</a>', '<a href="/sell-vs-borrow-bitcoin/">Vender o pedir prestado</a>', '<a href="/bitcoin-inheritance/">Herencia</a>'],
    "buy-bitcoin.html": ['<a href="/buy-bitcoin/slovakia/">Comprar en Eslovaquia</a>', '<a href="/buy-bitcoin/czechia/">Comprar en República Checa</a>', '<a href="/buy-bitcoin/germany/">Comprar en Alemania</a>', '<a href="/bitcoin-dca-calculator/">Calculadora DCA</a>', '<a href="/bitcoin-fee-index/">Índice de comisiones</a>'],
    "lending.html": ['<a href="/sell-vs-borrow-bitcoin/">Vender o pedir prestado</a>', '<a href="../loan.html">Loan Copilot</a>'],
    "tax.html": ['<a href="/bitcoin-tax/">Impuestos sobre Bitcoin</a>', '<a href="/bitcoin-inheritance/">Herencia</a>', '<a href="../tax-agent.html">Tax Agent</a>'],
}

NEWSLETTER_HTML = """<section class="newsletter">
  <div class="brief-card brief-card-poster">
  <h2>Recibe <span>el Brief</span></h2>
  <p>Virtuse Brief. Solo Bitcoin. Sin tokens. Sin RP.</p>
  <form class="newsletter-form newsletter-form-stacked" id="newsletterForm" novalidate>
    <input type="email" name="email" placeholder="Correo electrónico" required>
    <input type="text" name="website" autocomplete="off" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none">
    <button type="submit">Recibir el Brief</button>
  </form>
  <p id="newsletterMsg" role="status" aria-live="polite" class="brief-form-msg"></p>
  <p class="brief-fineprint">Cada lunes. Cancela cuando quieras.</p>
  </div>
  <script>
  (function () {
    var form = document.getElementById('newsletterForm');
    if (!form) return;
    var msg = document.getElementById('newsletterMsg');
    var btn = form.querySelector('button[type="submit"]');
    var btnLabel = btn.textContent;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.elements['email'].value.trim();
      var hp = form.elements['website'].value;
      msg.textContent = '';
      msg.style.color = 'var(--text-muted)';
      btn.disabled = true;
      btn.textContent = 'ENVIANDO...';
      fetch('https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, hp: hp, lang: 'es' })
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (result) {
        if (result.ok) {
          form.reset();
          msg.textContent = "Listo — revisa tu correo para el mensaje de bienvenida.";
          msg.style.color = 'var(--green, #3fb950)';
        } else {
          msg.textContent = (result.data && result.data.error) || 'Algo salió mal. Inténtalo de nuevo.';
          msg.style.color = '#f85149';
        }
      }).catch(function () {
        msg.textContent = 'Error de red — inténtalo de nuevo.';
        msg.style.color = '#f85149';
      }).then(function () {
        btn.disabled = false;
        btn.textContent = btnLabel;
      });
    });
  })();
  </script>
</section>"""


def step_footer_newsletter(c, log, page):
    # CSS: replace everything from the newsletter comment up to the 900px responsive block
    m = re.search(r"/\* ===== NEWSLETTER( SECTION)? ===== \*/.*?(?=\n@media \(max-width: 900px\) \{)", c, re.S)
    if m and "footerWordmark" not in c:
        c = c[: m.start()] + NEWSLETTER_FOOTER_CSS.rstrip("\n") + "\n" + c[m.end():]
        log.append("  OK newsletter+footer CSS -> EN block")
    elif "footerWordmark" not in c:
        # Dashboard/legal/bots-shaped pages have no NEWSLETTER comment or
        # 900px block to anchor on -- append EN's block (later rules win
        # over the page's own older .footer-* / .newsletter rules) plus
        # the newsletter/footer mobile rules, before the language-specific
        # compact-nav block (or the closing </style>).
        mobile = ("\n@media (max-width: 900px) {\n  .newsletter { padding: 60px 24px; }\n  .newsletter h2 { font-size: 28px; }\n"
                  "  .newsletter-form { flex-direction: column; }\n  .footer-main { padding: 40px 24px 20px; }\n"
                  "  .footer-inner { flex-direction: column; gap: 30px; padding: 0; }\n  .footer-bottom { padding-left: 0; padding-right: 0; }\n"
                  "  .footer-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 64px 24px; }\n"
                  "  .footer-wordmark { height: 110px; opacity: 0.32; }\n  .footer-wordmark-icon { height: 140px; }\n  .footer-wordmark-text { font-size: 184px; }\n}\n")
        block = "\n" + NEWSLETTER_FOOTER_CSS.rstrip("\n") + "\n" + mobile
        anchor = "/* ===== ES: compact nav text"
        if anchor in c:
            i = c.index(anchor)
            c = c[:i] + block.lstrip("\n") + "\n" + c[i:]
        else:
            i = c.index("</style>")
            c = c[:i] + block + c[i:]
        log.append("  OK newsletter+footer CSS -> EN block (appended)")
    c = sub_once(c,
                 "  .footer-inner { flex-direction: column; gap: 30px; }\n  .footer-columns { gap: 40px; }\n  .footer-logo img { height: 60px; }",
                 "  .footer-inner { flex-direction: column; gap: 30px; padding: 0; }\n  .footer-bottom { padding-left: 0; padding-right: 0; }\n  .footer-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 64px 24px; }\n  .footer-wordmark { height: 110px; opacity: 0.32; }\n  .footer-wordmark-icon { height: 140px; }\n  .footer-wordmark-text { font-size: 184px; }",
                 "footer mobile rules -> EN", log)
    # HTML: newsletter section
    if 'class="brief-card brief-card-poster"' not in c:
        c = re_sub_once(c, r'<section class="newsletter[^"]*">.*?</section>', lambda _m: NEWSLETTER_HTML, "newsletter section -> Brief card", log, flags=re.S)
    # HTML: footer
    if "footer-wordmark-text\">" not in c:
        html = FOOTER_HTML
        extra = GUIDES_EXTRA.get(page)
        if extra:
            html = html.replace('        <a href="bitcoin-data.html">Datos de Bitcoin</a>\n', '        <a href="bitcoin-data.html">Datos de Bitcoin</a>\n' + "".join("        " + a + "\n" for a in extra), 1)
        c = re_sub_once(c, r'<footer class="footer-main">.*?</footer>', lambda _m: html, "footer -> 5 columns + wordmark", log, flags=re.S)
    return c


# ---------------------------------------------------------------- how / dek --
STEP_RE = re.compile(r'<div class="step">\s*<div class="step-num">\d+</div>\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>\s*</div>', re.S)
SECTION_RE = re.compile(r'<section class="how">\s*<div class="how-title">(.*?)</div>\s*<div class="steps">(.*?)</div>\s*</section>', re.S)


def step_how_it_works(c, log, page):
    if HOW_OLD_CSS not in c:
        return c
    c = c.replace(HOW_OLD_CSS, HOW_NEW_CSS)

    def build(m):
        title = m.group(1).strip()
        steps = STEP_RE.findall(m.group(2))
        words = title.split(None, 1)
        heading = f"<h2>{words[0]} <span>{words[1]}</span></h2>" if len(words) > 1 else f"<h2>{title}</h2>"
        sub = "\n    <p>Cuatro sencillos pasos para acceder a cualquier servicio de Bitcoin a través de nuestro hub</p>" if page == "buy-bitcoin.html" else ""
        items = []
        for i, (h3, p) in enumerate(steps, start=1):
            items.append('    <div class="how-log-item">\n      <div class="how-log-marker"><span class="how-log-dot"></span></div>\n      <div class="how-log-body">\n'
                         f'        <span class="how-log-num">{STEP_LABEL} {i:02d}</span>\n        <h3>{h3}</h3>\n        <p>{p}</p>\n      </div>\n    </div>')
        return '<section class="how">\n  <div class="how-header">\n    ' + heading + sub + '\n  </div>\n  <div class="how-log">\n' + "\n".join(items) + '\n  </div>\n</section>'

    c, n = SECTION_RE.subn(build, c, count=1)
    log.append(f"  OK How-It-Works -> changelog ({n} section)")
    return c


DEK_SPLIT = {
    "Nuestros socios CASP": "Nuestros <span>socios CASP</span>",
    "Nuestros socios de minería": "Nuestros <span>socios de minería</span>",
    "Dos formas de participar": "Dos <span>formas de participar</span>",
    "Nuestros socios de préstamos": "Nuestros <span>socios de préstamos</span>",
    "Nuestros socios de custodia": "Nuestros <span>socios de custodia</span>",
    "A quién atendemos": "A quién <span>atendemos</span>",
    "Nuestros socios institucionales": "Nuestros <span>socios institucionales</span>",
    "Nuestros socios de informes fiscales": "Nuestros <span>socios de informes fiscales</span>",
    "Dos formas de automatizar": "Dos <span>formas de automatizar</span>",
    "Bots asociados": "Bots <span>asociados</span>",
}


def step_dek_split(c, log):
    for plain, split in DEK_SPLIT.items():
        c = sub_once(c, f"<h2>{plain}</h2>", f"<h2>{split}</h2>", f"dek-split '{plain}'", log)
    return c


# ---------------------------------------------------------------- claims --
def step_claims(c, log):
    c = re_sub_once(c, r'\n\s*<span class="tag tag-green">Hasta un 20 % de descuento en mineros seleccionados</span>', "", "mining: drop 20% claim", log)
    c = re_sub_once(c, r'\n\s*<span class="tag tag-green">Hasta 70 \$ de bonificación en BTC</span>', "", "secure: drop $70 claim", log)
    c = re_sub_once(c, r'\n\s*<span class="tag tag-gray">DISCRECIONAL</span>', "", "treasury: drop DISCRECIONAL", log)
    c = re_sub_once(c, r'\n\s*<span class="tag tag-gray">API</span>', "", "treasury: drop API", log)
    return c


# ---------------------------------------------------------------- pages --
HERO_TOOL_CSS = UK.HERO_TOOL_CSS


def step_lending(c, log):
    c = sub_once(c, UK.LTYPE_OLD, UK.LTYPE_NEW, "lending .ltype-card -> EN flat card", log)
    c = re_sub_once(c, r'<h3><span class="icon">&#\d+;</span> ', "<h3>", "lending: drop emoji icon #1", log)
    c = re_sub_once(c, r'<h3><span class="icon">&#\d+;</span> ', "<h3>", "lending: drop emoji icon #2", log)
    if ".hero-tool-link" not in c:
        c = sub_once(c, "/* ===== HOW IT WORKS ===== */", HERO_TOOL_CSS, "lending: .hero-tool-link CSS", log)
        c = re_sub_once(c, r'(\n  </p>)\n(?=\s*\n*\s*</section>\s*\n\s*<!-- ===== HOW IT WORKS)',
                        r'\1\n  <p class="hero-tool-link">\n    <a href="/sell-vs-borrow-bitcoin/">Compare vender frente a un préstamo respaldado por Bitcoin</a>\n  </p>\n', "lending: hero tool link HTML", log)
    c = re_sub_once(c, r'\n\s*<span class="widget-badge">.*?</span>', "", "lending: drop instant-quote badge", log, flags=re.S)
    c = sub_once(c, ".pcard-terms-value {\n  font-size: 13px;\n  font-weight: 700;\n  color: var(--blue);\n}", ".pcard-terms-value {\n  font-size: 13px;\n  font-weight: 700;\n  color: var(--text);\n}", "lending: term values -> white", log)
    c = sub_once(c, ".pcard-terms {\n  background: rgba(88, 166, 255, 0.05);\n  border: 1px dashed rgba(88, 166, 255, 0.2);", ".pcard-terms {\n  background: rgba(255, 255, 255, 0.03);\n  border: 1px dashed var(--border-hover);", "lending: terms box -> neutral", log)
    return c


def step_treasury(c, log):
    c = sub_once(c, UK.AUD_OLD, UK.AUD_NEW, "treasury .audience-card -> EN flat card", log)
    c = re_sub_once(c, r'<h3><span class="icon">&#\d+;</span> ', "<h3>", "treasury: drop emoji icon #1", log)
    c = re_sub_once(c, r'<h3><span class="icon">&#\d+;</span> ', "<h3>", "treasury: drop emoji icon #2", log)
    c = sub_once(c, UK.TOPPICK_OLD, UK.TOPPICK_NEW, "treasury .pcard-top-pick -> neutral hover", log)
    return c


def step_secure(c, log):
    c = sub_once(c, UK.SECURE_STATS_CSS, "", "secure: drop hero-stats CSS", log)
    c = re_sub_once(c, r'\n  <div class="hero-stats">.*?\n  </div>\n(?=</section>)', "\n", "secure: drop hero-stats HTML", log, flags=re.S)
    c = re_sub_once(c, r'\n  \.hero-stats \{ grid-template-columns: repeat\(3, 1fr\); \}', "", "secure: drop hero-stats mq #1", log)
    c = re_sub_once(c, r'\n  \.hero-stats \{ grid-template-columns: 1fr; \}', "", "secure: drop hero-stats mq #2", log)
    return c


def step_bitcoin_data(c, log):
    c = sub_once(c, ".subnav a.active { background: var(--btc-orange); color: #0d0902; }", ".subnav a.active { background: var(--text); color: var(--dark); }", "bitcoin-data: subnav active neutral", log)
    c = sub_once(c, ".price-card {\n  background: linear-gradient(135deg, var(--dark-card) 0%, #20180d 100%);\n  border: 1px solid rgba(247, 147, 26, 0.3);\n  border-radius: 18px;\n  padding: 36px 40px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n  flex-wrap: wrap;\n}",
                 ".price-card {\n  background: var(--dark-card);\n  border: 1px solid var(--border);\n  border-radius: 18px;\n  padding: 36px 40px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n  flex-wrap: wrap;\n  transition: border-color 0.2s;\n}\n\n.price-card:hover { border-color: var(--border-hover); }", "bitcoin-data: .price-card neutral", log)
    for sel in (".price-value", ".big-metric"):
        c = re_sub_once(c, r"(" + re.escape(sel) + r" \{\n(?:[^}]*\n)*?  color: )var\(--btc-orange\);", r"\1var(--text);", f"bitcoin-data: {sel} -> text", log)
    c = sub_once(c, ".stat-value.orange { color: var(--btc-orange); }", ".stat-value.orange { color: var(--text); }", "bitcoin-data: .stat-value.orange -> text", log)
    c = sub_once(c, ".kv-row .v.orange { color: var(--btc-orange); }", ".kv-row .v.orange { color: var(--text); }", "bitcoin-data: .kv-row .v.orange -> text", log)
    # green -> white (per user request)
    c = sub_once(c, "  background: var(--green-bg);\n  border: 1px solid rgba(63, 185, 80, 0.35);\n  color: var(--green);\n  font-size: 13px;", "  background: var(--dark-card);\n  border: 1px solid var(--border-hover);\n  color: var(--text);\n  font-size: 13px;", "bitcoin-data: live badge -> white", log)
    c = sub_once(c, "  border-radius: 50%;\n  background: var(--green);\n  animation: pulse 2s infinite;", "  border-radius: 50%;\n  background: var(--text);\n  animation: pulse 2s infinite;", "bitcoin-data: live dot -> white", log)
    c = sub_once(c, ".kv-row .v.green { color: var(--green); }", ".kv-row .v.green { color: var(--text); }", "bitcoin-data: .kv-row .v.green -> white", log)
    c = sub_once(c, "$('diffChange').style.color = chg >= 0 ? 'var(--green)' : 'var(--red)';", "$('diffChange').style.color = 'var(--text)';", "bitcoin-data: diffChange -> white", log)
    return c


# ---------------------------------------------------------------- main --
def process(page):
    path = os.path.join(ES, page)
    c = open(path, encoding="utf-8").read()
    orig = c
    log = []
    c = step_lang_pill(c, log)
    c = step_navcta_hover(c, log)
    c = step_sec_title(c, log)
    c = step_checkmarks(c, log)
    c = step_legacy_orange_hovers(c, log)
    c = step_brief_nav(c, log)
    c = step_footer_newsletter(c, log, page)
    c = step_how_it_works(c, log, page)
    c = step_dek_split(c, log)
    c = step_claims(c, log)
    if page == "lending.html":
        c = step_lending(c, log)
    if page == "treasury.html":
        c = step_treasury(c, log)
    if page == "secure.html":
        c = step_secure(c, log)
    if page == "bitcoin-data.html":
        c = step_bitcoin_data(c, log)
    if c != orig:
        open(path, "w", encoding="utf-8").write(c)
    print(f"{page}: {'changed' if c != orig else 'unchanged'}")
    for line in log:
        print(line)


if __name__ == "__main__":
    pages = sys.argv[1:] or sorted(p for p in os.listdir(ES) if p.endswith(".html") and p not in ("404.html", "blog.html"))
    for p in pages:
        process(p)
