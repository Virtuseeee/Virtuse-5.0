#!/usr/bin/env python3
"""Map every story to its two copies and check them (plan "SEO, staré URL…", step 3).

Each WordPress story exists twice: the original on blog.virtuse.com and the
pre-rendered page on virtuse.com/(sk/|ru/)stories/<key>/ (stories-build). This
lists both for every story in stories-build/manifest.json and checks:
  - virtuse.com page: HTTP 200 and <link rel="canonical"> pointing at itself
  - WordPress original: the canonical Yoast serves today (yoast_head_json)

Writes seo-ops/stories-canonical-map.csv. Read-only on both sites; changes nothing.
Same post selection as stories-build/build.mjs (feeds, categories, storyKey, first
post wins on a repeated key).

    python3 seo-ops/stories_canonical_map.py
"""
import csv, json, os, re, sys, time, urllib.request, concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEEDS = [
    ('en', 'https://blog.virtuse.com/wp-json/wp/v2/posts', 13, 'en', ''),
    ('sk', 'https://blog.virtuse.com/sk/wp-json/wp/v2/posts', 26, None, 'sk/'),
    ('ru', 'https://blog.virtuse.com/wp-json/wp/v2/posts', 57, 'ru', 'ru/'),
]
UA = {'User-Agent': 'Mozilla/5.0 virtuse-seo-audit'}

def get(url, tries=5):
    for i in range(tries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120)
            return r.status, r.headers, r.read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            return e.code, e.headers, ''
        except Exception as e:
            if i == tries - 1: return 'ERR ' + str(e)[:80], {}, ''
            time.sleep(5 * (i + 1))

def posts(api, cat, wp_lang):
    out, page = [], 1
    while True:
        q = f'{api}?categories={cat}&per_page=100&page={page}&_fields=id,slug,link,modified,yoast_head_json.canonical'
        if wp_lang: q += f'&lang={wp_lang}'
        code, h, body = get(q)
        if code != 200: sys.exit(f'WordPress {code} for {q}')
        out += json.loads(body)
        if page >= int(h.get('X-WP-TotalPages') or 1): return out
        page += 1

def main():
    manifest = set(json.load(open(os.path.join(ROOT, 'stories-build/manifest.json')))['stories'])
    rows, seen = [], set()
    for lang, api, cat, wp_lang, d in FEEDS:
        for p in posts(api, cat, wp_lang):
            key = p['slug'] if re.fullmatch(r'[a-z0-9-]+', p['slug']) else str(p['id'])
            path = f'{d}stories/{key}/'
            if path in seen: continue
            seen.add(path)
            rows.append({'lang': lang, 'wp_id': p['id'], 'wp_url': p['link'], 'wp_modified': p['modified'][:10],
                         'wp_canonical_now': (p.get('yoast_head_json') or {}).get('canonical', ''),
                         'virtuse_url': 'https://virtuse.com/' + path, 'in_manifest': path in manifest})

    def check(r):
        code, _, body = get(r['virtuse_url'], tries=3)
        can = (re.search(r'<link rel="canonical" href="([^"]+)"', body) or [None, ''])[1]
        r['virtuse_status'] = code
        r['virtuse_canonical_self'] = can == r['virtuse_url']
        r['ready_for_wp_canonical'] = r['in_manifest'] and code == 200 and r['virtuse_canonical_self']
        return r
    with cf.ThreadPoolExecutor(8) as ex:
        rows = list(ex.map(check, rows))

    out = os.path.join(ROOT, 'seo-ops/stories-canonical-map.csv')
    with open(out, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader(); w.writerows(rows)
    ready = sum(r['ready_for_wp_canonical'] for r in rows)
    missing = sorted(manifest - seen)
    print(f'{len(rows)} WordPress stories, {ready} ready (on virtuse.com, 200, self-canonical)')
    for r in rows:
        if not r['ready_for_wp_canonical']:
            print('  not ready:', r['virtuse_url'], r['virtuse_status'], 'manifest' if r['in_manifest'] else 'NOT IN MANIFEST')
    if missing: print('  in manifest but not in WordPress:', missing)
    wp_self = sum(r['wp_canonical_now'] == r['wp_url'] for r in rows)
    print(f'WordPress canonical today: {wp_self}/{len(rows)} point at themselves')
    print('wrote', os.path.relpath(out, ROOT))

if __name__ == '__main__':
    main()
