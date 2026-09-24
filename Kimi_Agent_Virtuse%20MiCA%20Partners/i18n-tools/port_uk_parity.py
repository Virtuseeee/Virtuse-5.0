#!/usr/bin/env python3
"""
port_uk_parity.py -- mechanical EN-parity fixes for the uk/ (Ukrainian)
pages, 2026-09-24. Everything here was found by diffing each uk page's
<style> block and body sections against the EN original; every step is
optional (skips when the pattern is absent) and logs what it did, so it
is safe to re-run.

Usage:
    python3 i18n-tools/port_uk_parity.py            # all uk/*.html
    python3 i18n-tools/port_uk_parity.py lending.html tax.html

Not covered here (hand work, see CLAUDE.md 2026-09-24 uk entry): bots.html,
about.html, index.html structural ports, blog.html's mobile language
dropdown.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from port_how_it_works import OLD_CSS as HOW_OLD_CSS, NEW_CSS as HOW_NEW_CSS  # noqa: E402

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UK = os.path.join(SITE, "uk")

STEP_LABEL = "Крок"


def sub_once(content, old, new, label, log):
    n = content.count(old)
    if n == 0:
        return content
    if n > 1:
        log.append(f"  !! {label}: {n} matches, replacing all")
    log.append(f"  OK {label}")
    return content.replace(old, new)


def re_sub_once(content, pattern, repl, label, log, flags=0):
    new, n = re.subn(pattern, repl, content, count=1, flags=flags)
    if n:
        log.append(f"  OK {label}")
    return new


# ---------------------------------------------------------------- steps --

def step_lang_pill(c, log):
    return sub_once(
        c,
        ".lang-menu-panel .lang-opt.active {\n  background: var(--btc-orange);\n  color: #0d0902;\n}",
        ".lang-menu-panel .lang-opt.active {\n  background: var(--text);\n  color: var(--dark);\n}",
        "active language pill -> neutral", log)


def step_navcta_hover(c, log):
    return sub_once(c, ".nav-cta:hover { background: var(--btc-orange-light); }\n\n", "", "drop legacy .nav-cta:hover", log)


def step_sec_title(c, log):
    c = sub_once(
        c,
        ".sec-title h2 {\n  font-size: 32px;\n  font-weight: 800;\n  letter-spacing: -0.02em;\n  margin-bottom: 8px;\n}",
        ".sec-title h2 {\n  font-size: 42px;\n  font-weight: 700;\n  letter-spacing: -0.02em;\n  margin-bottom: 8px;\n}\n\n.sec-title h2 span { font-weight: 400; color: var(--text-muted); }",
        ".sec-title h2 42/700 + span", log)
    c = sub_once(
        c,
        ".sec-title p {\n  font-size: 15px;\n  color: var(--text-muted);\n}",
        ".sec-title p {\n  font-size: 20px;\n  font-weight: 400;\n  color: var(--text-muted);\n  max-width: 620px;\n  line-height: 1.55;\n}",
        ".sec-title p 20px", log)
    # treasury's audience header uses its own class with the same drift
    c = sub_once(
        c,
        ".audience-header h2 {\n  font-size: 32px;\n  font-weight: 800;\n  letter-spacing: -0.02em;\n  margin-bottom: 8px;\n}",
        ".audience-header h2 {\n  font-size: 42px;\n  font-weight: 700;\n  letter-spacing: -0.02em;\n  margin-bottom: 8px;\n}\n\n.audience-header h2 span { font-weight: 400; color: var(--text-muted); }",
        ".audience-header h2 42/700 + span", log)
    c = sub_once(
        c,
        ".audience-header p {\n  font-size: 15px;\n  color: var(--text-muted);\n}",
        ".audience-header p {\n  font-size: 20px;\n  font-weight: 400;\n  color: var(--text-muted);\n  max-width: 620px;\n  line-height: 1.55;\n}",
        ".audience-header p 20px", log)
    return c


def step_checkmarks(c, log):
    for sel in (".pcard-features li svg", ".audience-features li svg"):
        c = re_sub_once(
            c,
            r"(" + re.escape(sel) + r" \{\n  width: 16px;\n  height: 16px;\n  color: )var\(--btc-orange\);",
            r"\1var(--text);",
            f"{sel} -> var(--text)", log)
    return c


def step_legacy_orange_hovers(c, log):
    c = sub_once(c, ".btn-primary:hover { background: #ffffff; color: var(--btc-orange); transform: translateY(-1px); }\n\n", "", "drop legacy .btn-primary:hover", log)
    c = sub_once(c, ".btn-secondary:hover { border-color: var(--btc-orange); color: var(--btc-orange); }\n\n", "", "drop legacy .btn-secondary:hover", log)
    c = sub_once(c, ".newsletter-form button:hover { background: var(--btc-orange); color: white; }\n\n", "", "drop legacy .newsletter-form button:hover", log)
    return c


FOOTER_GUIDES_OLD = '        <a href="bitcoin-data.html">Біткоїн дані</a>\n      </div>'
FOOTER_GUIDES_NEW = (
    '        <a href="bitcoin-data.html">Біткоїн дані</a>\n'
    '        <a href="/buy-bitcoin/slovakia/">Купити у Словаччині</a>\n'
    '        <a href="/buy-bitcoin/czechia/">Купити в Чехії</a>\n'
    '        <a href="/buy-bitcoin/germany/">Купити в Німеччині</a>\n'
    '        <a href="/bitcoin-dca-calculator/">DCA-калькулятор</a>\n'
    '        <a href="/bitcoin-fee-index/">Індекс комісій</a>\n'
    '      </div>'
)


def step_footer_guides(c, log):
    if '/buy-bitcoin/slovakia/' in c:
        return c
    return sub_once(c, FOOTER_GUIDES_OLD, FOOTER_GUIDES_NEW, "footer Матеріали +5 guide links", log)


STEP_RE = re.compile(
    r'<div class="step">\s*<div class="step-num">\d+</div>\s*'
    r'<h3>(.*?)</h3>\s*<p>(.*?)</p>\s*</div>', re.S)
SECTION_RE = re.compile(
    r'<section class="how">\s*<div class="how-title">(.*?)</div>\s*'
    r'<div class="steps">(.*?)</div>\s*</section>', re.S)


def step_how_it_works(c, log, page):
    if HOW_OLD_CSS not in c:
        return c
    c = c.replace(HOW_OLD_CSS, HOW_NEW_CSS)

    def build(m):
        title = m.group(1).strip()
        steps = STEP_RE.findall(m.group(2))
        words = title.split(None, 1)
        heading = f"<h2>{words[0]} <span>{words[1]}</span></h2>" if len(words) > 1 else f"<h2>{title}</h2>"
        sub = ""
        if page == "buy-bitcoin.html":
            sub = "\n    <p>Чотири прості кроки, щоб отримати доступ до будь-якого біткоїн-сервісу через наш хаб</p>"
        items = []
        for i, (h3, p) in enumerate(steps, start=1):
            items.append(
                '    <div class="how-log-item">\n'
                '      <div class="how-log-marker"><span class="how-log-dot"></span></div>\n'
                '      <div class="how-log-body">\n'
                f'        <span class="how-log-num">{STEP_LABEL} {i:02d}</span>\n'
                f'        <h3>{h3}</h3>\n'
                f'        <p>{p}</p>\n'
                '      </div>\n'
                '    </div>')
        return ('<section class="how">\n  <div class="how-header">\n    ' + heading + sub +
                '\n  </div>\n  <div class="how-log">\n' + "\n".join(items) + '\n  </div>\n</section>')

    c, n = SECTION_RE.subn(build, c, count=1)
    log.append(f"  OK How-It-Works -> changelog ({n} section)")
    return c


DEK_SPLIT = {
    "Наші CASP-партнери": "Наші <span>CASP-партнери</span>",
    "Наші партнери з майнінгу": "Наші <span>партнери з майнінгу</span>",
    "Два способи участі": "Два <span>способи участі</span>",
    "Наші партнери з кредитування": "Наші <span>партнери з кредитування</span>",
    "Наші кастоді-партнери": "Наші <span>кастоді-партнери</span>",
    "Кого ми обслуговуємо": "Кого <span>ми обслуговуємо</span>",
    "Наші інституційні партнери": "Наші <span>інституційні партнери</span>",
    "Наші партнери з податкової звітності": "Наші <span>партнери з податкової звітності</span>",
    "Два способи автоматизації": "Два <span>способи автоматизації</span>",
    "Партнери з торгових ботів": "Партнери <span>з торгових ботів</span>",
}


def step_dek_split(c, log):
    for plain, split in DEK_SPLIT.items():
        c = sub_once(c, f"<h2>{plain}</h2>", f"<h2>{split}</h2>", f"dek-split '{plain}'", log)
    return c


# ---- lending ------------------------------------------------------------
LTYPE_OLD = """.ltype-card {
  background: var(--dark-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
}

.ltype-card h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;


  gap: 10px;
}

.ltype-card h3 .icon { font-size: 24px; }

.ltype-card p {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}"""
LTYPE_NEW = """.ltype-card {
  background: var(--dark-card);
  border: none;
  border-radius: 16px;
  padding: 28px 24px;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: background-color 0.15s ease;
}

.ltype-card:hover {
  background: var(--dark-card-hover);
}

.ltype-card h3 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text);
}

.ltype-card p {
  font-size: 15px;
  color: var(--text-muted);
  line-height: 1.6;
}"""

HERO_TOOL_CSS = """.hero-tool-link {
  margin: 0;
}
.hero-tool-link a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
}
.hero-tool-link a:hover { text-decoration: underline; }

/* ===== HOW IT WORKS ===== */"""


def step_lending(c, log):
    c = sub_once(c, LTYPE_OLD, LTYPE_NEW, "lending .ltype-card -> EN flat card", log)
    c = sub_once(c, '<h3><span class="icon">&#128176;</span> Позичальники</h3>', '<h3>Позичальники</h3>', "lending: drop emoji icon (borrowers)", log)
    c = sub_once(c, '<h3><span class="icon">&#128200;</span> Інвестори / Кредитори</h3>', '<h3>Інвестори / Кредитори</h3>', "lending: drop emoji icon (lenders)", log)
    if ".hero-tool-link" not in c:
        c = sub_once(c, "/* ===== HOW IT WORKS ===== */", HERO_TOOL_CSS, "lending: .hero-tool-link CSS", log)
        c = re_sub_once(
            c,
            r'(за ринковими ставками від 6% річних\.\s*\n  </p>)\n',
            r'\1\n  <p class="hero-tool-link">\n    <a href="/sell-vs-borrow-bitcoin/">Порівняйте продаж і позику під заставу біткоїна</a>\n  </p>\n',
            "lending: hero tool link HTML", log)
    return c


# ---- treasury -----------------------------------------------------------
AUD_OLD = """.audience-card {
  background: var(--dark-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 32px;
  transition: border-color 0.2s;
}

.audience-card:hover { border-color: var(--border-hover); }

.audience-card h3 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 6px;


  gap: 10px;
}

.audience-card h3 .icon {
  font-size: 24px;
}
"""
AUD_NEW = """.audience-card {
  background: var(--dark-card);
  border: none;
  border-radius: 16px;
  padding: 28px 24px;
  transition: background-color 0.15s ease;
}

.audience-card:hover { background: var(--dark-card-hover); }

.audience-card h3 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--text);
}
"""
TOPPICK_OLD = """.pcard-top-pick {
  border-color: rgba(247, 147, 26, 0.3);
}

.pcard-top-pick::before {
  opacity: 1;
  background: linear-gradient(90deg, var(--btc-orange), var(--btc-orange-light));
}"""
TOPPICK_NEW = """.pcard-top-pick:hover {
  border-color: var(--border-hover);
  background: var(--dark-card-hover);
}"""


def step_treasury(c, log):
    c = sub_once(c, AUD_OLD, AUD_NEW, "treasury .audience-card -> EN flat card", log)
    c = re_sub_once(c, r'<h3><span class="icon">&#\d+;</span> ', '<h3>', "treasury: drop emoji icon #1", log)
    c = re_sub_once(c, r'<h3><span class="icon">&#\d+;</span> ', '<h3>', "treasury: drop emoji icon #2", log)
    c = sub_once(c, TOPPICK_OLD, TOPPICK_NEW, "treasury .pcard-top-pick -> neutral hover", log)
    return c


# ---- secure -------------------------------------------------------------
SECURE_STATS_CSS = """/* Hero Stats */
.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 600px;
}

.stat-box {
  background: var(--dark-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px 24px;
  text-align: center;
  transition: border-color 0.2s;
}

.stat-box:hover { border-color: var(--border-hover); }

.stat-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--btc-orange);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

"""


def step_secure(c, log):
    c = sub_once(c, SECURE_STATS_CSS, "", "secure: drop hero-stats CSS", log)
    c = re_sub_once(c, r'\n  <div class="hero-stats">.*?\n  </div>\n(?=</section>)', "\n", "secure: drop hero-stats HTML", log, flags=re.S)
    c = re_sub_once(c, r'\n  \.hero-stats \{ grid-template-columns: repeat\(3, 1fr\); \}', "", "secure: drop hero-stats mq #1", log)
    c = re_sub_once(c, r'\n  \.hero-stats \{ grid-template-columns: 1fr; \}', "", "secure: drop hero-stats mq #2", log)
    return c


# ---- buy-bitcoin --------------------------------------------------------
STEP0_CSS = """.stack-step0 {
  max-width: 1200px;
  margin: 0 auto 48px;
  padding: 0 48px;
}

.stack-step0-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  padding: 28px 32px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: linear-gradient(90deg, rgba(247,147,26,0.07), rgba(247,147,26,0.02));
}

.stack-step0-text h3 {
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 0;
}

.stack-step0-text p {
  font-size: 14px;
  color: var(--text-muted);
  max-width: 520px;
}

.stack-step0-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  padding: 12px 22px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  color: #0b0b0c;
  background: var(--btc-orange);
  text-decoration: none;
  transition: filter 0.2s;
}

.stack-step0-cta svg { width: 14px; height: 14px; transition: transform 0.2s; }
.stack-step0-cta:hover { filter: brightness(1.08); }
.stack-step0-cta:hover svg { transform: translateX(3px); }

@media (max-width: 700px) {
  .stack-step0 { padding: 0 24px; margin-bottom: 32px; }
  .stack-step0-inner { flex-direction: column; text-align: center; padding: 24px; }
}

.seo-guides {
  max-width: 1200px;
  margin: 0 auto 48px;
  padding: 0 48px;
}
.seo-guides-inner {
  padding: 28px 32px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--dark-card);
}
.seo-guides h2 {
  font-size: 42px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.25;
  margin: 0 0 14px;
}
.seo-guides p {
  font-size: 20px;
  font-weight: 400;
  color: var(--text-muted);
  line-height: 1.55;
  margin: 0 0 16px;
}
.seo-guides-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
}
.seo-guides-links a {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 100px;
  border: 1px solid var(--border);
  background: rgba(247,147,26,0.06);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.seo-guides-links a:hover {
  border-color: rgba(247,147,26,0.45);
  color: var(--btc-orange);
}
@media (max-width: 700px) {
  .seo-guides { padding: 0 24px; }
  .seo-guides-inner { padding: 20px 24px; }
}

/* ===== PARTNERS ===== */"""

STEP0_HTML = """<!-- ===== STACKING "STEP 0" ===== -->
<section class="stack-step0">
  <div class="stack-step0-inner">
    <div class="stack-step0-text">
      <h3>Скільки і як часто ви хочете купувати?</h3>
    </div>
    <a href="../stacking.html?utm_source=stacking&amp;utm_medium=widget" class="stack-step0-cta">
      Спланувати накопичення
      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
  </div>
</section>

<!-- ===== COUNTRY BUY GUIDES + FEE TOOLS ===== -->
<nav class="seo-guides" aria-label="Гіди з купівлі за країнами та інструменти комісій">
  <div class="seo-guides-inner">
    <h2>Рейтинг комісій за країнами</h2>
    <p>Порівняйте комісії всіх партнерів для вашої суми, перш ніж обрати платформу, за допомогою Stacking Strategist.</p>
    <div class="seo-guides-links">
      <a href="/buy-bitcoin/slovakia/">Купити у Словаччині</a>
      <a href="/buy-bitcoin/czechia/">Купити в Чехії</a>
      <a href="/buy-bitcoin/germany/">Купити в Німеччині</a>
      <a href="/bitcoin-dca-calculator/">DCA-калькулятор</a>
      <a href="/bitcoin-fee-index/">Індекс комісій</a>
    </div>
  </div>
</nav>

<!-- ===== PARTNERS ===== -->"""


def step_buy_bitcoin(c, log):
    if ".stack-step0" in c:
        return c
    c = sub_once(c, "/* ===== PARTNERS ===== */", STEP0_CSS, "buy-bitcoin: step-0 + seo-guides CSS", log)
    c = sub_once(c, "<!-- ===== PARTNERS ===== -->", STEP0_HTML, "buy-bitcoin: step-0 + seo-guides HTML", log)
    return c


# ---- tax ----------------------------------------------------------------
TAX_GUIDES_CSS = """.tax-guides { max-width: 1200px; margin: 0 auto 80px; padding: 0 48px; }
.tax-guides-inner { background: #141414; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 28px 32px; }
.tax-guides h2 { font-size: 42px; font-weight: 700; color: #e6edf3; line-height: 1.25; margin: 0 0 14px; }
.tax-guides-lead { font-size: 20px; font-weight: 400; color: #8b949e; line-height: 1.55; margin: 0 0 24px; max-width: 620px; }
.tax-guides-links { display: flex; flex-wrap: wrap; gap: 10px 12px; margin-bottom: 0; }
.tax-guides-links a {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 100px;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(247,147,26,0.06);
  color: #e6edf3;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.tax-guides-links a:hover {
  border-color: rgba(247,147,26,0.45);
  color: #f7931a;
}
@media (max-width: 700px) {
  .tax-guides { padding: 0 24px; }
  .tax-guides-inner { padding: 24px; }
}
"""
TAX_GUIDES_HTML = """<!-- Country tax guides (SEO) -->
<section class="tax-guides" id="tax-guides">
<div class="tax-guides-inner">
<h2>Податкові гіди за країнами</h2>
<p class="tax-guides-lead">Орієнтовні огляди 2026 року для 11 країн ЄС, а також чекліст спадкування. Це не податкова консультація.</p>
<div class="tax-guides-links">
<a href="/bitcoin-tax/">Усі 11 країн</a>
<a href="/bitcoin-tax/slovakia/">Словаччина</a>
<a href="/bitcoin-tax/czechia/">Чехія</a>
<a href="/bitcoin-tax/germany/">Німеччина</a>
<a href="/bitcoin-tax/austria/">Австрія</a>
<a href="/bitcoin-tax/poland/">Польща</a>
<a href="/bitcoin-inheritance/">Чекліст спадкування</a>
<a href="../tax-agent.html">Перевірити правила моєї країни</a>
<a href="/de/bitcoin-steuern/deutschland/">Auf Deutsch: Bitcoin-Steuern Deutschland</a>
</div>
</div>
</section>
"""


def step_tax(c, log):
    c = sub_once(c,
                 ".nav-cta { background: #f7931a; color: #08090a; font-weight: 700; font-size: 13px; padding: 9px 20px; border-radius: 8px; transition: all 0.2s; border: none; cursor: pointer; }",
                 ".nav-cta { background: #f7931a; color: #08090a; font-weight: 700; font-size: 12px; padding: 7px 14px; border-radius: 8px; transition: all 0.2s; border: none; cursor: pointer; }",
                 "tax: .nav-cta 12px/7px14px", log)
    c = sub_once(c,
                 ".section-header h2 { font-size: 34px; font-weight: 800; letter-spacing: -0.8px; margin-bottom: 10px; }\n.section-header p { font-size: 16px; color: #8b949e; }",
                 ".section-header h2 { font-size: 42px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 8px; }\n.section-header h2 span { font-weight: 400; color: var(--text-muted); }\n.section-header p { font-size: 20px; font-weight: 400; color: var(--text-muted); max-width: 620px; line-height: 1.55; }",
                 "tax: .section-header -> EN", log)
    c = sub_once(c,
                 ".how-header h2 { font-size: 34px; font-weight: 700; letter-spacing: -0.8px; margin-bottom: 10px; }",
                 ".how-header h2 { font-size: 42px; font-weight: 700; color: var(--text); line-height: 1.25; margin-bottom: 14px; }",
                 "tax: .how-header h2 42px", log)
    # legacy EU complexity card -> country tax guides (CSS)
    c = re_sub_once(c, r"\.eu-card \{[^\n]*\n(\.eu-[^\n]*\n)+", TAX_GUIDES_CSS, "tax: .eu-* CSS -> .tax-guides CSS", log)
    c = re_sub_once(c, r"\n  \.eu-card-inner \{ flex-direction: column; gap: 16px; \}", "", "tax: drop .eu-card-inner mq", log)
    c = re_sub_once(c, r'<!-- EU Tax Complexity -->\n<div class="eu-card">.*?</div>\n</div>\n</div>\n</div>\n', TAX_GUIDES_HTML, "tax: EU card HTML -> tax-guides section", log, flags=re.S)
    c = sub_once(c,
                 ".partner-card { background: #141414; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; transition: all 0.25s; display: flex; flex-direction: column; }\n.partner-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.12); }\n.partner-card.top-pick { border: 1px solid rgba(247, 147, 26,0.3); }",
                 ".partner-card { background: #141414; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; transition: border-color 0.15s ease, background-color 0.15s ease; display: flex; flex-direction: column; }\n.partner-card:hover { border-color: rgba(255,255,255,0.12); background: #1c1c1c; }\n.partner-card.top-pick:hover { border-color: rgba(255,255,255,0.12); background: #1c1c1c; }",
                 "tax: .partner-card flat hover", log)
    c = sub_once(c, ".partner-features li svg { width: 14px; height: 14px; color: #3fb950; flex-shrink: 0; }",
                 ".partner-features li svg { width: 14px; height: 14px; color: #e6edf3; flex-shrink: 0; }", "tax: checkmarks green -> text", log)
    c = sub_once(c, ".compare-table td.best { color: #3fb950; font-weight: 600; }",
                 ".compare-table td.best { color: #f7931a; font-weight: 600; }", "tax: td.best green -> orange", log)
    return c


# ---- bitcoin-data -------------------------------------------------------
def step_bitcoin_data(c, log):
    c = sub_once(c, ".subnav a.active { background: var(--btc-orange); color: #0d0902; }",
                 ".subnav a.active { background: var(--text); color: var(--dark); }", "bitcoin-data: subnav active neutral", log)
    c = sub_once(c,
                 ".price-card {\n  background: linear-gradient(135deg, var(--dark-card) 0%, #20180d 100%);\n  border: 1px solid rgba(247, 147, 26, 0.3);\n  border-radius: 18px;\n  padding: 36px 40px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n  flex-wrap: wrap;\n}",
                 ".price-card {\n  background: var(--dark-card);\n  border: 1px solid var(--border);\n  border-radius: 18px;\n  padding: 36px 40px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n  flex-wrap: wrap;\n  transition: border-color 0.2s;\n}\n\n.price-card:hover { border-color: var(--border-hover); }",
                 "bitcoin-data: .price-card neutral", log)
    for sel in (".price-value", ".big-metric"):
        c = re_sub_once(c, r"(" + re.escape(sel) + r" \{\n(?:[^}]*\n)*?  color: )var\(--btc-orange\);", r"\1var(--text);", f"bitcoin-data: {sel} -> text", log)
    c = sub_once(c, ".stat-value.orange { color: var(--btc-orange); }", ".stat-value.orange { color: var(--text); }", "bitcoin-data: .stat-value.orange -> text", log)
    c = sub_once(c, ".kv-row .v.orange { color: var(--btc-orange); }", ".kv-row .v.orange { color: var(--text); }", "bitcoin-data: .kv-row .v.orange -> text", log)
    return c


# ---- blog (CSS + newsdesk line only; mobile dropdown is hand-ported) -----
def step_blog(c, log):
    c = sub_once(c, ".nav-links a.active{color:var(--btc-orange);background:rgba(247, 147, 26,0.08)}",
                 ".nav-links a.active{color:var(--text);background:rgba(255,255,255,0.06)}", "blog: nav active neutral (minified)", log)
    c = sub_once(c, ".post-count b{color:var(--btc-orange);font-weight:800}", ".post-count b{color:var(--text);font-weight:800}", "blog: .post-count b -> text", log)
    c = sub_once(c, "margin-bottom:14px;color:var(--btc-orange);background:rgba(247, 147, 26,0.1);align-self:flex-start}",
                 "margin-bottom:14px;color:var(--text);background:rgba(255,255,255,0.06);align-self:flex-start}", "blog: .tag -> neutral", log)
    if ".hero-newsdesk" not in c:
        c = sub_once(c, ".post-count b{", ".hero-newsdesk{margin-top:16px}\n.hero-newsdesk a{color:var(--btc-orange);font-weight:700}\n.post-count b{", "blog: .hero-newsdesk CSS", log)
        c = sub_once(c, "<p>Думки про Біткоїн, макроекономіку та майбутнє грошей від CEO Virtuse Rastislava Vasilisina.</p>\n  </div>",
                     "<p>Думки про Біткоїн, макроекономіку та майбутнє грошей від CEO Virtuse Rastislava Vasilisina.</p>\n    <p class=\"hero-newsdesk\"><a href=\"../news.html\">Новинний деск</a> — щотижневий брифінг і Pulse.</p>\n  </div>",
                     "blog: hero newsdesk line", log)
    return c


# ---------------------------------------------------------------- main ---

def process(page):
    path = os.path.join(UK, page)
    c = open(path, encoding="utf-8").read()
    orig = c
    log = []
    c = step_lang_pill(c, log)
    c = step_navcta_hover(c, log)
    c = step_sec_title(c, log)
    c = step_checkmarks(c, log)
    c = step_legacy_orange_hovers(c, log)
    c = step_footer_guides(c, log)
    c = step_how_it_works(c, log, page)
    c = step_dek_split(c, log)
    if page == "lending.html":
        c = step_lending(c, log)
    if page == "treasury.html":
        c = step_treasury(c, log)
    if page == "secure.html":
        c = step_secure(c, log)
    if page == "buy-bitcoin.html":
        c = step_buy_bitcoin(c, log)
    if page == "tax.html":
        c = step_tax(c, log)
    if page == "bitcoin-data.html":
        c = step_bitcoin_data(c, log)
    if page == "blog.html":
        c = step_blog(c, log)
    if c != orig:
        open(path, "w", encoding="utf-8").write(c)
    print(f"{page}: {'changed' if c != orig else 'unchanged'}")
    for line in log:
        print(line)


if __name__ == "__main__":
    pages = sys.argv[1:] or sorted(p for p in os.listdir(UK) if p.endswith(".html") and p != "404.html")
    for p in pages:
        process(p)
