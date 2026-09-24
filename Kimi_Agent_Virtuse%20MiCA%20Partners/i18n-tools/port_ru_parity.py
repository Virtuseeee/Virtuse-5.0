#!/usr/bin/env python3
"""
port_ru_parity.py -- EN-parity fixes for the ru/ (Russian) pages, 2026-09-24.
ru/ starts from the same batch-era state uk/ did (tokens, SVG hamburger,
mobile lang dropdown, Brief nav, wordmark footer, Brief newsletter already
present), so this reuses port_uk_parity's language-agnostic CSS steps and
port_es_parity's later additions (claims, lending badge/terms, bitcoin-data
green->white), with the Russian strings defined here.

Usage:
    python3 i18n-tools/port_ru_parity.py            # all ru/*.html except 404/index/about/bots/blog
    python3 i18n-tools/port_ru_parity.py lending.html tax.html blog.html

Not covered (hand work): index.html / bots.html / about.html transplants,
blog.html's mobile language dropdown.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import port_uk_parity as UK  # noqa: E402
import port_es_parity as ES  # noqa: E402
from port_how_it_works import OLD_CSS as HOW_OLD_CSS, NEW_CSS as HOW_NEW_CSS  # noqa: E402

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RU = os.path.join(SITE, "ru")
sub_once, re_sub_once = ES.sub_once, ES.re_sub_once
STEP_LABEL = "Шаг"

GUIDES_ANCHOR = '        <a href="bitcoin-data.html">Биткоин данные</a>\n      </div>'
GUIDES_EXTRA = {
    "index.html": ['<a href="/bitcoin-tax/">Налоги на биткоин</a>', '<a href="/bitcoin-fee-index/">Индекс комиссий</a>', '<a href="/bitcoin-dca-calculator/">DCA-калькулятор</a>', '<a href="/sell-vs-borrow-bitcoin/">Продать или занять</a>', '<a href="/bitcoin-inheritance/">Наследование</a>'],
    "buy-bitcoin.html": ['<a href="/buy-bitcoin/slovakia/">Купить в Словакии</a>', '<a href="/buy-bitcoin/czechia/">Купить в Чехии</a>', '<a href="/buy-bitcoin/germany/">Купить в Германии</a>', '<a href="/bitcoin-dca-calculator/">DCA-калькулятор</a>', '<a href="/bitcoin-fee-index/">Индекс комиссий</a>'],
    "lending.html": ['<a href="/sell-vs-borrow-bitcoin/">Продать или занять</a>', '<a href="../loan.html">Loan Copilot</a>'],
    "tax.html": ['<a href="/bitcoin-tax/">Налоги на биткоин</a>', '<a href="/bitcoin-inheritance/">Наследование</a>', '<a href="../tax-agent.html">Tax Agent</a>'],
}


def step_footer_guides(c, log, page):
    extra = GUIDES_EXTRA.get(page)
    if not extra or extra[0] in c:
        return c
    new = GUIDES_ANCHOR.replace("      </div>", "".join("        " + a + "\n" for a in extra) + "      </div>")
    return sub_once(c, GUIDES_ANCHOR, new, f"footer Материалы +{len(extra)} guide links", log)


def step_how_it_works(c, log, page):
    if HOW_OLD_CSS not in c:
        return c
    c = c.replace(HOW_OLD_CSS, HOW_NEW_CSS)

    def build(m):
        title = m.group(1).strip()
        steps = ES.STEP_RE.findall(m.group(2))
        words = title.split(None, 1)
        heading = f"<h2>{words[0]} <span>{words[1]}</span></h2>" if len(words) > 1 else f"<h2>{title}</h2>"
        sub = "\n    <p>Четыре простых шага, чтобы получить доступ к любому биткоин-сервису через наш хаб</p>" if page == "buy-bitcoin.html" else ""
        items = []
        for i, (h3, p) in enumerate(steps, start=1):
            items.append('    <div class="how-log-item">\n      <div class="how-log-marker"><span class="how-log-dot"></span></div>\n      <div class="how-log-body">\n'
                         f'        <span class="how-log-num">{STEP_LABEL} {i:02d}</span>\n        <h3>{h3}</h3>\n        <p>{p}</p>\n      </div>\n    </div>')
        return '<section class="how">\n  <div class="how-header">\n    ' + heading + sub + '\n  </div>\n  <div class="how-log">\n' + "\n".join(items) + '\n  </div>\n</section>'

    c, n = ES.SECTION_RE.subn(build, c, count=1)
    log.append(f"  OK How-It-Works -> changelog ({n} section)")
    return c


DEK_SPLIT = {
    "Наши CASP-партнёры": "Наши <span>CASP-партнёры</span>",
    "Наши партнёры по майнингу": "Наши <span>партнёры по майнингу</span>",
    "Два способа участия": "Два <span>способа участия</span>",
    "Наши партнёры по займам": "Наши <span>партнёры по займам</span>",
    "Наши партнёры по кастоди": "Наши <span>партнёры по кастоди</span>",
    "Кого мы обслуживаем": "Кого <span>мы обслуживаем</span>",
    "Наши институциональные партнёры": "Наши <span>институциональные партнёры</span>",
    "Наши партнёры по налоговой отчётности": "Наши <span>партнёры по налоговой отчётности</span>",
    "Два способа автоматизации": "Два <span>способа автоматизации</span>",
    "Партнёры по ботам": "Партнёры <span>по ботам</span>",
}


def step_dek_split(c, log):
    for plain, split in DEK_SPLIT.items():
        c = sub_once(c, f"<h2>{plain}</h2>", f"<h2>{split}</h2>", f"dek-split '{plain}'", log)
    return c


def step_claims(c, log):
    c = re_sub_once(c, r'\n\s*<span class="tag tag-gray">ДИСКРЕЦИОННО</span>', "", "treasury: drop ДИСКРЕЦИОННО", log)
    c = re_sub_once(c, r'\n\s*<span class="tag tag-gray">API</span>', "", "treasury: drop API", log)
    return c


def step_lending(c, log):
    c = sub_once(c, UK.LTYPE_OLD, UK.LTYPE_NEW, "lending .ltype-card -> EN flat card", log)
    c = re_sub_once(c, r'<h3><span class="icon">&#\d+;</span> ', "<h3>", "lending: drop emoji icon #1", log)
    c = re_sub_once(c, r'<h3><span class="icon">&#\d+;</span> ', "<h3>", "lending: drop emoji icon #2", log)
    if ".hero-tool-link" not in c:
        c = sub_once(c, "/* ===== HOW IT WORKS ===== */", UK.HERO_TOOL_CSS, "lending: .hero-tool-link CSS", log)
        c = re_sub_once(c, r'(от 6% годовых\.\s*\n  </p>)\n',
                        r'\1\n  <p class="hero-tool-link">\n    <a href="/sell-vs-borrow-bitcoin/">Сравните продажу и заём под залог биткоина</a>\n  </p>\n', "lending: hero tool link HTML", log)
    c = re_sub_once(c, r'\n\s*<span class="widget-badge">.*?</span>', "", "lending: drop instant-quote badge", log, flags=re.S)
    c = sub_once(c, ".pcard-terms-value {\n  font-size: 13px;\n  font-weight: 700;\n  color: var(--blue);\n}", ".pcard-terms-value {\n  font-size: 13px;\n  font-weight: 700;\n  color: var(--text);\n}", "lending: term values -> white", log)
    c = sub_once(c, ".pcard-terms {\n  background: rgba(88, 166, 255, 0.05);\n  border: 1px dashed rgba(88, 166, 255, 0.2);", ".pcard-terms {\n  background: rgba(255, 255, 255, 0.03);\n  border: 1px dashed var(--border-hover);", "lending: terms box -> neutral", log)
    return c


STEP0_HTML = """<!-- ===== STACKING "STEP 0" ===== -->
<section class="stack-step0">
  <div class="stack-step0-inner">
    <div class="stack-step0-text">
      <h3>Сколько и как часто вы хотите покупать?</h3>
    </div>
    <a href="../stacking.html?utm_source=stacking&amp;utm_medium=widget" class="stack-step0-cta">
      Спланировать накопление
      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
  </div>
</section>

<!-- ===== COUNTRY BUY GUIDES + FEE TOOLS ===== -->
<nav class="seo-guides" aria-label="Гиды по покупке по странам и инструменты комиссий">
  <div class="seo-guides-inner">
    <h2>Рейтинг комиссий по странам</h2>
    <p>Сравните комиссии всех партнёров для вашей суммы, прежде чем выбрать платформу, с помощью Stacking Strategist.</p>
    <div class="seo-guides-links">
      <a href="/buy-bitcoin/slovakia/">Купить в Словакии</a>
      <a href="/buy-bitcoin/czechia/">Купить в Чехии</a>
      <a href="/buy-bitcoin/germany/">Купить в Германии</a>
      <a href="/bitcoin-dca-calculator/">DCA-калькулятор</a>
      <a href="/bitcoin-fee-index/">Индекс комиссий</a>
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


TAX_GUIDES_HTML = """<!-- Country tax guides (SEO) -->
<section class="tax-guides" id="tax-guides">
<div class="tax-guides-inner">
<h2>Налоговые гиды по странам</h2>
<p class="tax-guides-lead">Ориентировочные обзоры 2026 года для 11 стран ЕС, а также чек-лист по наследованию. Не является налоговой консультацией.</p>
<div class="tax-guides-links">
<a href="/bitcoin-tax/">Все 11 стран</a>
<a href="/bitcoin-tax/slovakia/">Словакия</a>
<a href="/bitcoin-tax/czechia/">Чехия</a>
<a href="/bitcoin-tax/germany/">Германия</a>
<a href="/bitcoin-tax/austria/">Австрия</a>
<a href="/bitcoin-tax/poland/">Польша</a>
<a href="/bitcoin-inheritance/">Чек-лист по наследованию</a>
<a href="../tax-agent.html">Проверить правила моей страны</a>
<a href="/de/bitcoin-steuern/deutschland/">Auf Deutsch: Bitcoin-Steuern Deutschland</a>
</div>
</div>
</section>
"""


def step_tax(c, log):
    # same rule set as port_uk_parity.step_tax, with the Russian tax-guides block
    saved = UK.TAX_GUIDES_HTML
    UK.TAX_GUIDES_HTML = TAX_GUIDES_HTML
    try:
        return UK.step_tax(c, log)
    finally:
        UK.TAX_GUIDES_HTML = saved


def step_blog(c, log):
    c = sub_once(c, ".nav-links a.active{color:var(--btc-orange);background:rgba(247, 147, 26,0.08)}",
                 ".nav-links a.active{color:var(--text);background:rgba(255,255,255,0.06)}", "blog: nav active neutral (minified)", log)
    c = sub_once(c, ".nav-links a{color:var(--text-muted);font-size:14px;font-weight:500;padding:8px 14px;border-radius:8px;transition:all .2s}",
                 ".nav-links a{color:var(--text-muted);font-size:13px;font-weight:400;padding:6px 12px;border-radius:8px;transition:all .2s}", "blog: nav links 13px/400", log)
    c = sub_once(c, ".post-count b{color:var(--btc-orange);font-weight:800}", ".post-count b{color:var(--text);font-weight:800}", "blog: .post-count b -> text", log)
    c = sub_once(c, "margin-bottom:14px;color:var(--btc-orange);background:rgba(247, 147, 26,0.1);align-self:flex-start}",
                 "margin-bottom:14px;color:var(--text);background:rgba(255,255,255,0.06);align-self:flex-start}", "blog: .tag -> neutral", log)
    if ".hero-newsdesk" not in c:
        c = sub_once(c, ".post-count b{", ".hero-newsdesk{margin-top:16px}\n.hero-newsdesk a{color:var(--btc-orange);font-weight:700}\n.post-count b{", "blog: .hero-newsdesk CSS", log)
        c = sub_once(c, "<p>Мысли о Биткоине, макроэкономике и будущем денег от CEO Virtuse Растислава Василишина.</p>\n  </div>",
                     "<p>Мысли о Биткоине, макроэкономике и будущем денег от CEO Virtuse Растислава Василишина.</p>\n    <p class=\"hero-newsdesk\"><a href=\"../news.html\">Новостной деск</a> — еженедельный брифинг и Pulse.</p>\n  </div>",
                     "blog: hero newsdesk line", log)
    return c


def process(page):
    path = os.path.join(RU, page)
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
    pages = sys.argv[1:] or sorted(p for p in os.listdir(RU) if p.endswith(".html") and p not in ("404.html", "index.html", "about.html", "bots.html", "blog.html"))
    for p in pages:
        process(p)
