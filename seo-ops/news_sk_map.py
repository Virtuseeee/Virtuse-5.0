#!/usr/bin/env python3
"""Pair Brief issues with their Slovak story pages (Brief handover F3, 2026-11-11).

For every issue in news/issues.json, reads stories/<slug>/index.html and takes its
hreflang="sk" link. Writes:
  - news/issues.json: alt_url = the Slovak story path (only when one exists)
  - news/issues-sk.json: the Slovak list for sk/news.html (title, excerpt, image
    from the Slovak story page's own meta; alt_url back to English)
Run after a new issue and after the stories build:  python3 seo-ops/news_sk_map.py
"""
import html, json, pathlib, re

SITE = pathlib.Path(__file__).resolve().parent.parent / "Kimi_Agent_Virtuse%20MiCA%20Partners"
EN = SITE / "news/issues.json"
SK = SITE / "news/issues-sk.json"

def meta(page, prop):
    m = re.search(r'<meta (?:property|name)="%s" content="([^"]*)"' % re.escape(prop), page)
    return html.unescape(m.group(1)) if m else ""

def main():
    data = json.loads(EN.read_text())
    sk_issues = []
    for issue in data["issues"]:
        issue.pop("alt_url", None)
        page_p = SITE / "stories" / issue["slug"] / "index.html"
        if not page_p.exists():
            continue
        page = page_p.read_text()
        m = re.search(r'<link rel="alternate" hreflang="sk" href="https://virtuse\.com(/sk/stories/[^"]+/)"', page)
        if not m:
            continue
        sk_path = m.group(1)
        sk_page_p = SITE / sk_path.strip("/") / "index.html"
        if not sk_page_p.exists():
            continue
        sk_page = sk_page_p.read_text()
        issue["alt_url"] = sk_path
        title = re.sub(r"\s*·\s*Virtuse Brief$", "", meta(sk_page, "og:title")).strip()
        sk_issues.append({
            "date": issue["date"],
            "title": title or issue["title"],
            "excerpt": meta(sk_page, "og:description") or meta(sk_page, "description"),
            "slug": sk_path.rstrip("/").split("/")[-1],
            "image": issue.get("image") or meta(sk_page, "og:image"),
            "read_min": issue.get("read_min"),
            "author": issue.get("author"),
            **({"essay": True} if issue.get("essay") else {}),
            "alt_url": "/stories/%s/" % issue["slug"],
            "en_slug": issue["slug"],
        })
    # Issues without a Slovak story stay in the Slovak list in English, marked (EN),
    # linking the English story; the newest Slovak issue still leads the page.
    paired = {x["en_slug"] for x in sk_issues}
    for issue in data["issues"]:
        if issue["slug"] in paired:
            continue
        sk_issues.append({k: issue[k] for k in ("date", "title", "excerpt", "slug", "image", "read_min", "author", "essay") if k in issue}
                         | {"title": issue["title"] + " (EN)", "lang": "en", "url": "/stories/%s/" % issue["slug"]})
    sk_issues.sort(key=lambda x: x["date"], reverse=True)
    EN.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    SK.write_text(json.dumps({"issues": sk_issues}, indent=2, ensure_ascii=False) + "\n")
    print(f"issues: {len(data['issues'])}, with a Slovak story: {len(paired)}")

main()
