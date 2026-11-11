#!/usr/bin/env python3
"""Write the Brief page's "News & Markets" list from news/news-markets.json.

Replaces the block between <!-- news-markets:start --> and
<!-- news-markets:end --> in news.html. Run after each issue:

    python3 seo-ops/news_markets.py          # write
    python3 seo-ops/news_markets.py --check  # exit 1 if news.html is stale

Exactly 4 items, categories Macro, World, Markets, Regulation in that order: category (kicker), title, excerpt, date (YYYY-MM-DD), source, url.
"""
import html, json, pathlib, re, sys

SITE = pathlib.Path(__file__).resolve().parent.parent / "Kimi_Agent_Virtuse%20MiCA%20Partners"
SRC = SITE / "news/news-markets.json"
PAGES = {"en": SITE / "news.html", "sk": SITE / "sk/news.html"}
CAT_SK = {"Macro": "Makro", "World": "Svet", "Markets": "Trhy", "Regulation": "Regulácia"}
MONTHS_SK = "januára februára marca apríla mája júna júla augusta septembra októbra novembra decembra".split()
START, END = "<!-- news-markets:start -->", "<!-- news-markets:end -->"

CATEGORIES = ["Macro", "World", "Markets", "Regulation"]
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()

def render(d, lang="en"):
    e = html.escape
    items = d["items"]
    assert len(items) == 4, "News & Markets shows exactly 4 cards"
    cats = [it.get("category") for it in items]
    assert cats == CATEGORIES, f"categories must be {CATEGORIES} in this order, got {cats}"
    out = [START, '      <div class="markets-grid" data-issue="%s">' % e(d["issue_date"])]
    for it in items:
        for k in ("category", "title", "excerpt", "date", "source", "url"):
            assert it.get(k), f"item missing {k}: {it}"
        assert it["url"].startswith("https://"), it["url"]
        y, m, dd = it["date"].split("-")
        human = f"{int(dd)}. {MONTHS_SK[int(m) - 1]} {y}" if lang == "sk" else f"{int(dd)} {MONTHS[int(m) - 1]} {y}"
        cat = CAT_SK[it["category"]] if lang == "sk" else it["category"]
        title = it.get("title_sk") if lang == "sk" else it["title"]
        excerpt = it.get("excerpt_sk") if lang == "sk" else it["excerpt"]
        assert title and excerpt, f"missing {lang} text: {it['title']}"
        out += [
            '        <article class="markets-card">',
            f'          <p class="markets-kicker">{e(cat)}</p>',
            f'          <h3 class="markets-title"><a href="{e(it["url"])}" target="_blank" rel="noopener noreferrer">{e(title)}</a></h3>',
            f'          <p class="markets-deck">{e(excerpt)}</p>',
            f'          <p class="markets-filing"><time datetime="{e(it["date"])}">{human}</time><span>{e(it["source"])}</span></p>',
            '        </article>']
    out += ["      </div>", "      " + END]
    return "\n".join(out)

def main():
    d = json.loads(SRC.read_text())
    stale = False
    for lang, page_p in PAGES.items():
        if not page_p.exists():
            continue
        page = page_p.read_text()
        m = re.search(re.escape(START) + r".*?" + re.escape(END), page, re.S)
        assert m, f"markers not found in {page_p.name}"
        new = page[:m.start()] + render(d, lang) + page[m.end():]
        if new != page:
            stale = True
            if "--check" not in sys.argv:
                page_p.write_text(new)
    if "--check" in sys.argv:
        sys.exit(1 if stale else 0)
    print(f"news-markets: {len(d['items'])} items, issue {d['issue_date']}")

if __name__ == "__main__":
    main()
