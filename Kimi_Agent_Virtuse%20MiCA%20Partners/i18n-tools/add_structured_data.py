#!/usr/bin/env python3
"""Add schema.org JSON-LD to the hub pages (SEO plan, phase 2).

- The 10 homepages (index.html of the root and of every language folder) get
  Organization + WebSite. The Organization keeps the @id the generated SEO
  pages already use (https://virtuse.com/#org), so Google merges them.
- Every other indexable top-level hub page gets a BreadcrumbList:
  Home > <page name>. The page name is the page's own <title> without the
  " — Virtuse" / " | Virtuse" suffix and without any " — subtitle", so it is
  already in the page language.

Skipped: 404, noindex pages, pages that already carry JSON-LD (news.html),
article.html (a template), satoshi.html, and the blogs (blog*.html are
rebuilt by build_brief_blog.py, which would drop the block).

The block is one <script type="application/ld+json" id="virtuse-ld"> placed
right before </head>. Re-running replaces it, so the script is idempotent.
JSON-LD is a data block, so the pages' CSP (script-src) does not apply to it.

Usage: python3 i18n-tools/add_structured_data.py [--dry-run] [--list]
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDERS = ["", "sk", "uk", "cs", "ru", "de", "fr", "es", "pl", "hu"]
BASE = "https://virtuse.com/"
SKIP = {"404.html", "article.html", "satoshi.html", "news.html"}
SAME_AS = [
    "https://twitter.com/VirtuseExchange",
    "https://www.linkedin.com/company/virtuse-exchange/",
    "https://www.facebook.com/virtuseexchange/",
]
HOME_NAME = {"en": "Home", "sk": "Domov", "uk": "Головна", "cs": "Domů",
             "ru": "Главная", "de": "Startseite", "fr": "Accueil",
             "es": "Inicio", "pl": "Strona główna", "hu": "Főoldal"}

BLOCK = re.compile(r'<script type="application/ld\+json" id="virtuse-ld">.*?</script>\n', re.S)
TITLE = re.compile(r"<title>(.*?)</title>", re.S)
OG_URL = re.compile(r'<meta property="og:url" content="([^"]*)">')
ROBOTS = re.compile(r'<meta name="robots" content="([^"]*)"')


def organization():
    return {
        "@type": "Organization",
        "@id": BASE + "#org",
        "name": "Virtuse",
        "legalName": "Virtuse Group Pte. Ltd.",
        "url": BASE,
        "logo": {"@type": "ImageObject", "url": BASE + "email-virtuse-v-mark.png",
                 "width": 736, "height": 483},
        "image": BASE + "og-cover.jpg",
        "description": "Non-custodial hub for Bitcoin-only services. Virtuse never holds your keys.",
        "foundingDate": "2018",
        "email": "support@virtuse.com",
        "address": [
            {"@type": "PostalAddress", "addressLocality": "Singapore", "addressCountry": "SG"},
            {"@type": "PostalAddress", "addressLocality": "Bratislava", "addressCountry": "SK"},
        ],
        "sameAs": SAME_AS,
    }


def website(lang):
    return {"@type": "WebSite", "@id": BASE + "#website", "name": "Virtuse",
            "url": BASE, "inLanguage": lang, "publisher": {"@id": BASE + "#org"}}


def page_name(title):
    t = html.unescape(re.sub(r"\s+", " ", title)).strip()
    t = re.sub(r"\s*[—|]\s*Virtuse\s*$", "", t)
    return t.split(" — ")[0].strip()


def home_url(folder):
    return BASE + ("index.html" if not folder else folder + "/index.html")


def render(data):
    body = json.dumps(data, ensure_ascii=False, indent=2).replace("</", "<\\/")
    return '<script type="application/ld+json" id="virtuse-ld">\n' + body + "\n</script>\n"


def main():
    dry = "--dry-run" in sys.argv
    listing = "--list" in sys.argv
    done, skipped = 0, []
    for folder in FOLDERS:
        lang = folder or "en"
        d = os.path.join(ROOT, folder)
        for name in sorted(os.listdir(d)):
            if not name.endswith(".html"):
                continue
            rel = os.path.join(folder, name)
            path = os.path.join(d, name)
            s = open(path, encoding="utf-8").read()
            base = BLOCK.sub("", s)
            robots = ROBOTS.search(base)
            if name in SKIP or name.startswith("blog"):
                continue
            if robots and "noindex" in robots.group(1):
                continue
            if "application/ld+json" in base:
                skipped.append(rel + " (has its own JSON-LD)")
                continue
            if name == "index.html":
                data = {"@context": "https://schema.org",
                        "@graph": [organization(), website(lang)]}
                label = "Organization + WebSite"
            else:
                t, u = TITLE.search(base), OG_URL.search(base)
                if not t or not u:
                    skipped.append(rel + " (no <title> or og:url)")
                    continue
                pname = page_name(t.group(1))
                data = {"@context": "https://schema.org", "@type": "BreadcrumbList",
                        "itemListElement": [
                            {"@type": "ListItem", "position": 1, "name": HOME_NAME[lang],
                             "item": home_url(folder)},
                            {"@type": "ListItem", "position": 2, "name": pname,
                             "item": u.group(1)}]}
                label = "Breadcrumb: %s > %s" % (HOME_NAME[lang], pname)
            if "</head>" not in base:
                skipped.append(rel + " (no </head>)")
                continue
            new = base.replace("</head>", render(data) + "</head>", 1)
            if listing:
                print("%-34s %s" % (rel, label))
            if new != s:
                done += 1
                if not dry:
                    with open(path, "w", encoding="utf-8") as fh:
                        fh.write(new)
    print("changed: %d%s" % (done, " (dry run)" if dry else ""))
    for x in skipped:
        print("  skipped:", x)


if __name__ == "__main__":
    main()
