#!/usr/bin/env python3
"""Per-edition social preview for news.html (og:/twitter: tags in static HTML; crawlers don't run JS).

usage:
  python3 i18n-tools/set_news_og.py            # rewrite news.html from the newest non-essay issue
  python3 i18n-tools/set_news_og.py --image    # first make news/og/brief-YYYYMMDD.jpg (1200x630, + 800 px WebP) from the
                                               # issue's "image" and store it as "og_image" in issues.json
  python3 i18n-tools/set_news_og.py --check    # exit 1 if news.html is not up to date

Edition flow: new issue in news/issues.json -> run with --image -> deploy (news.html, news/issues.json,
news/og/brief-YYYYMMDD.jpg + brief-YYYYMMDD-800.webp). Without og_image the generic /news/og-card.png is used.
Only the meta tags listed below change; the head order, GTM and consent snippet are left alone.
"""
import html, io, json, os, re, sys, urllib.request
from PIL import Image
from datetime import date

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS, ISSUES = os.path.join(SITE, 'news.html'), os.path.join(SITE, 'news', 'issues.json')
ORIGIN = 'https://virtuse.com'
GENERIC = ('/news/og-card.png', '20260921')
W, H = 1200, 630
TOP_SHARE = 0.25  # of the height cropped away, a quarter comes off the top (heads sit near the top of the heroes)


def latest(issues):
    return next(i for i in issues if not i.get('essay'))


def clip(s, n=160):
    s = re.sub(r'\s+', ' ', s).strip()
    if len(s) <= n:
        return s
    cut = s[:n - 1]
    return cut[:cut.rfind(' ')].rstrip(',;:. ') + '…'


def make_image(issue):
    ymd = issue['date'].replace('-', '')
    req = urllib.request.Request(issue['image'], headers={'User-Agent': 'Mozilla/5.0 virtuse-og'})
    im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert('RGB')
    scale = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    dx, dy = im.width - W, im.height - H
    left, top = dx // 2, round(dy * TOP_SHARE)
    im = im.crop((left, top, left + W, top + H))
    rel = 'news/og/brief-%s.jpg' % ymd
    os.makedirs(os.path.join(SITE, 'news', 'og'), exist_ok=True)
    im.save(os.path.join(SITE, rel), 'JPEG', quality=85, optimize=True, progressive=True)
    small(im, ymd)
    return '/' + rel


def small(im, ymd):
    # 800 px WebP for the Brief cards (site-v2.js and the homepages load it, the JPG stays the og:image and
    # the fallback). Audit 2026-10-15, code P2-8: the 213 KB JPG was the cover on every service page.
    im.resize((800, round(800 * H / W)), Image.LANCZOS).save(
        os.path.join(SITE, 'news', 'og', 'brief-%s-800.webp' % ymd), 'WEBP', quality=78, method=6)


def tags_for(issue):
    d = date.fromisoformat(issue['date'])
    when = '%s %d, %d' % (d.strftime('%b'), d.day, d.year)
    title = 'Virtuse Brief · %s · %s' % (when, issue['title'].rstrip('.'))
    desc = clip(issue.get('dek') or issue.get('excerpt') or 'Virtuse Brief. Bitcoin-only. No tokens. No PR.')
    path, ver = (issue['og_image'], issue['date'].replace('-', '')) if issue.get('og_image') else GENERIC
    img = ORIGIN + path + '?v=' + ver
    alt = issue['title'].rstrip('.') + ' · Virtuse Brief' if issue.get('og_image') else 'Virtuse Brief'
    e = lambda s: html.escape(s, quote=True)
    return {
        'property="og:title"': e(title), 'property="og:description"': e(desc), 'property="og:url"': ORIGIN + '/news.html',
        'property="og:image"': e(img), 'property="og:image:alt"': e(alt), 'property="og:image:width"': str(W),
        'property="og:image:height"': str(H), 'name="twitter:card"': 'summary_large_image', 'name="twitter:title"': e(title),
        'name="twitter:description"': e(desc), 'name="twitter:image"': e(img), 'name="twitter:image:alt"': e(alt),
    }


def apply(page, tags):
    for attr, val in tags.items():
        rx = re.compile(r'(<meta %s content=")[^"]*(">)' % re.escape(attr))
        if len(rx.findall(page)) != 1:
            sys.exit('news.html: expected exactly one <meta %s content="…"> tag' % attr)
        page = rx.sub(lambda m: m.group(1) + val + m.group(2), page)
    return page


def main():
    data = json.load(open(ISSUES))
    issue = latest(data['issues'])
    if '--image' in sys.argv:
        issue['og_image'] = make_image(issue)
        with open(ISSUES, 'w') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print('image:', issue['og_image'])
    page = open(NEWS).read()
    out = apply(page, tags_for(issue))
    if '--check' in sys.argv:
        sys.exit(0 if out == page else 'news.html og/twitter tags are not up to date: run set_news_og.py')
    if out != page:
        open(NEWS, 'w').write(out)
    print('news.html: %s (%s)' % ('updated' if out != page else 'unchanged', issue['date']))


if __name__ == '__main__':
    main()
