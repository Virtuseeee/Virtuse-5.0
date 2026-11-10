#!/usr/bin/env python3
"""Write the Brief page's "News & Markets" list from news/news-markets.json.

Replaces the block between <!-- news-markets:start --> and
<!-- news-markets:end --> in news.html. Run after each issue:

    python3 seo-ops/news_markets.py          # write
    python3 seo-ops/news_markets.py --check  # exit 1 if news.html is stale

Each item: lead (bold, accent), text (plain), link (underlined, url).
"""
import html, json, pathlib, re, sys

SITE = pathlib.Path(__file__).resolve().parent.parent / "Kimi_Agent_Virtuse%20MiCA%20Partners"
SRC, PAGE = SITE / "news/news-markets.json", SITE / "news.html"
START, END = "<!-- news-markets:start -->", "<!-- news-markets:end -->"

def render(d):
    e = html.escape
    out = [START,
           f'      <p class="markets-intro">{e(d["intro"])}</p>',
           f'      <ol class="markets-list" data-issue="{e(d["issue_date"])}">']
    for it in d["items"]:
        for k in ("lead", "text", "link", "url"):
            assert it.get(k), f"item missing {k}: {it}"
        assert it["url"].startswith("https://"), it["url"]
        out.append(
            f'        <li><strong class="markets-lead">{e(it["lead"])}</strong> {e(it["text"])} '
            f'<a href="{e(it["url"])}" target="_blank" rel="noopener noreferrer">{e(it["link"])}</a></li>')
    out += ["      </ol>", "      " + END]
    return "\n".join(out)

def main():
    d = json.loads(SRC.read_text())
    page = PAGE.read_text()
    m = re.search(re.escape(START) + r".*?" + re.escape(END), page, re.S)
    assert m, "markers not found in news.html"
    new = page[:m.start()] + render(d) + page[m.end():]
    if "--check" in sys.argv:
        sys.exit(0 if new == page else 1)
    if new != page:
        PAGE.write_text(new)
    print(f"news-markets: {len(d['items'])} items, issue {d['issue_date']}")

main()
