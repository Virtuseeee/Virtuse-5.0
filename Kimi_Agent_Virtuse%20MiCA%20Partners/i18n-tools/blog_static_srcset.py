#!/usr/bin/env python3
"""srcset for the static fallback images on the 9 blog listings. Idempotent.

The blog pages carry a static lead + cards (for crawlers and visitors without
JavaScript) whose <img> point at the full WordPress originals (250 KB - 1 MB each).
This adds srcset/sizes with WordPress's smaller copies, looked up per post by the
slug in the card's link. Same rule as srcsetOf() in the pages' own script: copies
with the same shape as the original only. A card whose image is not the post's
featured image is left alone.

    python3 i18n-tools/blog_static_srcset.py [--dry-run]
"""
import html, json, os, re, sys, urllib.parse, urllib.request

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = '--dry-run' in sys.argv
PAGES = ['blog.html', 'blog-sk.html'] + [f'{l}/blog.html' for l in 'uk ru de fr es pl hu'.split()]
LEAD_SIZES = '(max-width: 800px) calc(100vw - 32px), 730px'
CARD_SIZES = '(max-width: 480px) calc(100vw - 32px), 410px'
UA = {'User-Agent': 'virtuse-blog-srcset'}
LEAD = re.compile(r'(<a class="lead" id="featuredWrap" href="([^"]+)">\s*<div class="lead-media"><img id="leadImg" src="([^"]+)")( alt="")')
CARD = re.compile(r'(<a class="blog-card" href="([^"]+)"><img src="([^"]+)")( alt="")')
cache = {}


def featured(href):
    q = urllib.parse.parse_qs(urllib.parse.urlparse(html.unescape(href)).query)
    slug, lang = q['slug'][0], (q.get('lang') or ['en'])[0]
    api = ('https://blog.virtuse.com/sk/wp-json/wp/v2/posts?' if lang == 'sk' else
           'https://blog.virtuse.com/wp-json/wp/v2/posts?lang=' + ('ru' if lang == 'ru' else 'en') + '&')
    url = api + urllib.parse.urlencode({'slug': slug, '_embed': 'wp:featuredmedia'})
    if url not in cache:
        posts = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))
        try:
            cache[url] = posts[0]['_embedded']['wp:featuredmedia'][0]
        except (IndexError, KeyError, TypeError):
            cache[url] = None
    return cache[url]


def srcset(m):
    d = (m or {}).get('media_details') or {}
    if not d.get('width') or not d.get('height'):
        return ''
    ratio, seen, out = d['width'] / d['height'], set(), []
    for x in list((d.get('sizes') or {}).values()) + [{'width': d['width'], 'height': d['height'], 'source_url': m['source_url']}]:
        if not x.get('width') or not x.get('height') or not x.get('source_url') or x['width'] in seen:
            continue
        if abs(x['width'] / x['height'] - ratio) > 0.02 * ratio:
            continue
        seen.add(x['width'])
        out.append(f"{x['source_url']} {x['width']}w")
    return ', '.join(out) if len(out) > 1 else ''


def main():
    total = 0
    for page in PAGES:
        path = os.path.join(SITE, page)
        s = open(path, encoding='utf-8').read()
        n = skipped = 0

        def fix(m, sizes, extra=''):
            nonlocal n, skipped
            if 'srcset=' in m.group(0):
                return m.group(0)
            media = featured(m.group(2))
            ss = srcset(media) if media and media.get('source_url') == m.group(3) else ''
            if not ss:
                skipped += 1
                return m.group(0)
            n += 1
            return f'{m.group(1)} srcset="{ss}" sizes="{sizes}"{extra}{m.group(4)}'

        # No fetchpriority on the static lead: the script replaces it with the newest post.
        s2 = LEAD.sub(lambda m: fix(m, LEAD_SIZES), s)
        s2 = CARD.sub(lambda m: fix(m, CARD_SIZES), s2)
        print(f'{page}: {n} images with srcset, {skipped} left as is')
        total += n
        if s2 != s and not DRY:
            open(path, 'w', encoding='utf-8').write(s2)
    print(f'{total} images {"would get" if DRY else "got"} srcset')


if __name__ == '__main__':
    main()
