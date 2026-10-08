#!/usr/bin/env python3
"""Post list for the WordPress must-use plugin virtuse-crypto-news-noindex.php.

Since 2026-10-08 the list also holds the leftover blog posts Ras decided to
hide (seo-ops/blog-leftover-posts.csv, decision "noindex": empty pages,
duplicates, Virtuse Exchange-era posts, 2021 weekly reports). The plugin's
name still says Crypto News; it hides whatever post IDs the JSON lists.

Ras's decision 2026-10-07: hide the old "Crypto News" / "Krypto novinky" posts
(mostly short excerpts of third-party news from 2021-2023) from search engines
but keep them readable. This reads the live WordPress REST API and writes
seo-ops/wp-mu-plugin/virtuse-crypto-news-noindex.json:
  posts: every post in category 38 (Crypto News, EN) or 40 (Krypto novinky, SK)
         published before 2024, minus the stories (stories/wp-canonical.json,
         whose originals already point their canonical at virtuse.com)
  terms: the two category archives
Read-only against WordPress.

    python3 seo-ops/crypto_news_noindex.py
"""
import csv, datetime, json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'seo-ops/wp-mu-plugin/virtuse-crypto-news-noindex.json')
STORIES = os.path.join(ROOT, 'Kimi_Agent_Virtuse%20MiCA%20Partners/stories/wp-canonical.json')
LEFTOVER = os.path.join(ROOT, 'seo-ops/blog-leftover-posts.csv')
CUTOFF = '2024-01-01'
TERMS = [38, 40]  # Crypto News (EN), Krypto novinky (SK)
# Every post, both language endpoints: WPML hides posts filed under the other
# language's category from a category query (4 EN posts sit in 40, 17 SK in 38).
APIS = ['https://blog.virtuse.com/wp-json/wp/v2/posts?lang=all',
        'https://blog.virtuse.com/sk/wp-json/wp/v2/posts?lang=all']
UA = {'User-Agent': 'Mozilla/5.0 virtuse-seo-audit'}

def get(url):
    for i in range(5):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120)
            return r.headers, json.loads(r.read())
        except Exception as e:
            if i == 4: sys.exit(f'WordPress request failed: {url}: {e}')
            time.sleep(5 * (i + 1))

posts, seen = {}, set()
for api in APIS:
    page = 1
    while True:
        h, rows = get(f'{api}&per_page=100&page={page}&_fields=id,date,categories')
        for p in rows:
            seen.add(p['id'])
            if set(p['categories']) & set(TERMS):
                posts[p['id']] = p
        if page >= int(h.get('X-WP-TotalPages') or 1): break
        page += 1

stories = {int(k) for k in json.load(open(STORIES))['posts']}
old = sorted(i for i, p in posts.items() if p['date'] < CUTOFF and i not in stories)
kept = sorted((p['date'][:10], i) for i, p in posts.items() if i not in old)
extra = sorted({int(r['wp_id']) for r in csv.DictReader(open(LEFTOVER, encoding='utf-8')) if r['decision'] == 'noindex'})
missing = [i for i in extra if i not in seen]
if missing: sys.exit(f'leftover posts not found in WordPress: {missing}')
clash = [i for i in extra if i in stories]
if clash: sys.exit(f'leftover posts marked noindex are stories: {clash}')
allp = sorted(set(old) | set(extra))
data = {'generated': datetime.date.today().isoformat(),
        'rule': f'category 38 or 40, published before {CUTOFF}, not a story; plus blog-leftover-posts.csv decision noindex',
        'terms': TERMS, 'count': len(allp), 'crypto_news': len(old), 'leftover': len(extra), 'posts': allp}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=1)
    f.write('\n')
print(f'{len(seen)} posts read; {len(posts)} in the two categories; {len(old)} Crypto News + {len(extra)} leftover = {len(allp)} to noindex; Crypto News kept indexable: {kept}')
