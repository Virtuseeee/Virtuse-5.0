#!/usr/bin/env python3
"""Search Console page filters for the new virtuse.com, one regex per group.

Paste a group's regex into Search Console → Performance → + Add filter → Page →
Custom (regex) → "Matches regex". `NEW_SITE` with "Doesn't match regex" shows only
the legacy Virtuse Exchange URLs (www.virtuse.com/gold/ …).

Search Console uses RE2 and matches anywhere in the URL, so every regex is anchored
at the start. The prefix accepts http/https and www, since a Domain property reports
all of them.

`python3 seo-ops/search_console_groups.py` checks that every URL in sitemap.xml
(plus the bare homepage URLs) falls into exactly one group, that known legacy URLs
fall into none, and prints the regexes. Run it after adding a new page type.
"""
import re, sys, os

L = r'(?:(?:cs|de|es|fr|hu|pl|ru|sk|uk)/)?'
P = r'^https?://(?:www\.)?virtuse\.com/' + L
END = r'(?:[?#]|$)'

GROUPS = {
    'homepage': P + r'(?:index\.html)?' + END,
    'categories': P + r'(?:buy-bitcoin|mining|lending|secure|treasury|tax|bots)\.html' + END,
    'seo': P + r'(?:bitcoin-[a-z0-9-]+|sell-vs-borrow-bitcoin|buy-bitcoin)/',
    'data': P + r'(?:bitcoin-data|ma-200w|rainbow-chart|root-cycles|fear-greed|trading-volume|btc-dominance'
                r'|retirement-calculator|asset-returns|btc-monthly-returns)\.html' + END,
    'stories': P + r'stories/',
    'tools': P + r'(?:concierge|stacking|loan|tax-agent)\.html' + END,
    'info': P + r'(?:about|faq|privacy-policy|terms-and-conditions|aml-compliance|blog|blog-sk|news|article)\.html' + END,
}
NEW_SITE = '|'.join(f'(?:{r})' for r in GROUPS.values())

LEGACY_SAMPLES = [
    'https://www.virtuse.com/gold/', 'https://virtuse.com/oil/', 'https://www.virtuse.com/wallet/',
    'https://www.virtuse.com/fees/', 'https://virtuse.com/virtu-token/', 'https://www.virtuse.com/sk/gold/',
    'https://virtuse.com/bitcoin-data.html.bak', 'https://www.virtuse.com/blog/',
]

def main():
    site = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Kimi_Agent_Virtuse%20MiCA%20Partners')
    urls = sorted(set(re.findall(r'<loc>([^<]+)</loc>', open(os.path.join(site, 'sitemap.xml'), encoding='utf-8').read())))
    urls += ['https://virtuse.com/', 'https://www.virtuse.com/', 'https://virtuse.com/sk/', 'https://virtuse.com/index.html?utm_source=x']
    comp = {g: re.compile(r) for g, r in GROUPS.items()}
    bad, counts = [], {g: 0 for g in GROUPS}
    for u in urls:
        hit = [g for g, c in comp.items() if c.search(u)]
        if len(hit) != 1: bad.append((u, hit))
        else: counts[hit[0]] += 1
    for u in LEGACY_SAMPLES:
        if re.search(NEW_SITE, u): bad.append((u, 'legacy URL matched NEW_SITE'))
    for g, r in GROUPS.items():
        print(f'{g} ({counts[g]} URLs)\n  {r}\n')
    print(f'NEW_SITE (all groups)\n  {NEW_SITE}\n')
    print(f'checked {len(urls)} URLs + {len(LEGACY_SAMPLES)} legacy samples')
    if bad:
        for b in bad: print('  !!', b)
        sys.exit(1)
    print('OK: every URL in exactly one group, no legacy sample matches')

def links(resource='sc-domain:virtuse.com', user='', days=28):
    """Performance report links with the group filter already applied (bookmark them).
    `page=~regex` = Matches regex, `page=!~regex` = Doesn't match. `user`: the /u/N/ index
    of the Google account that owns the property in this browser ('' = default account)."""
    from urllib.parse import quote
    base = f'https://search.google.com/{("u/" + user + "/") if user else ""}search-console/performance/search-analytics'
    out = {g: f'{base}?resource_id={quote(resource)}&num_of_days={days}&breakdown=page&page=~{quote(r, safe="")}' for g, r in GROUPS.items()}
    out['new site (all groups)'] = f'{base}?resource_id={quote(resource)}&num_of_days={days}&breakdown=page&page=~{quote(NEW_SITE, safe="")}'
    out['legacy URLs (not new site)'] = f'{base}?resource_id={quote(resource)}&num_of_days={days}&breakdown=page&page=!~{quote(NEW_SITE, safe="")}'
    return out

if __name__ == '__main__':
    if '--links' in sys.argv:
        for g, u in links(user=sys.argv[sys.argv.index('--links') + 1] if len(sys.argv) > sys.argv.index('--links') + 1 else '').items():
            print(f'{g}\n  {u}\n')
    else:
        main()
