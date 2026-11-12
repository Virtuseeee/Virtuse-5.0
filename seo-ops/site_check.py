"""Site hygiene check (no network): internal links, sitemap.xml, canonical, hreflang.

usage: python3 seo-ops/site_check.py            (exit 1 on any problem)

- every internal href/src (relative, root-absolute, https://virtuse.com/...) resolves to a file
  (stories/, i18n-tools/, brand/ drafts skipped as link sources only where noted);
- sitemap.xml: no duplicates, every <loc> exists, is not a redirect stub, not noindex, and its
  canonical points to itself;
- every indexable page with a self canonical is in sitemap.xml (article.html, the dynamic story
  reader, is allowed);
- every hreflang alternate exists.
Written 2026-11-12 (maintenance round, PR 'Údržba 5/6').
"""
import html as H, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners')
ORIGIN = 'https://virtuse.com/'
SKIP_SRC = ('i18n-tools', 'node_modules', 'blog-translations-ru', 'brand')
ALLOW_UNLISTED = {'article.html'}
problems = []


def local(url):
    p = url[len(ORIGIN):].split('#')[0].split('?')[0]
    return p + 'index.html' if (p == '' or p.endswith('/')) else p


def exists(p):
    full = os.path.join(ROOT, p)
    return os.path.exists(os.path.join(full, 'index.html')) if os.path.isdir(full) else os.path.exists(full)


pages = []
for dp, dn, fn in os.walk(ROOT):
    rel = os.path.relpath(dp, ROOT)
    if rel.split('/')[0] in SKIP_SRC:
        continue
    pages += [os.path.normpath(os.path.join(rel, f)) for f in fn if f.endswith('.html')]

meta = {}
for pg in pages:
    h = open(os.path.join(ROOT, pg), encoding='utf-8', errors='replace').read()
    rob = re.search(r'name="robots" content="([^"]*)"', h)
    can = re.search(r'rel="canonical" href="([^"]+)"', h)
    meta[pg] = dict(stub='http-equiv="refresh"' in h, noindex=bool(rob and 'noindex' in rob.group(1)),
                    canon=can.group(1) if can else None)
    for m in re.finditer(r'<link rel="alternate" hreflang="[^"]+" href="([^"]+)"', h):
        if m.group(1).startswith(ORIGIN) and not exists(local(m.group(1))):
            problems.append('%s: hreflang target missing %s' % (pg, m.group(1)))
    body = re.sub(r'<script\b[^>]*>.*?</script>', '', h, flags=re.S | re.I)
    for m in re.finditer(r'\b(?:href|src)="([^"]+)"', body):
        u = H.unescape(m.group(1)).strip()
        if u.startswith(('mailto:', 'tel:', 'javascript:', 'data:', '#', '{', '$')):
            continue
        if u.startswith(ORIGIN):
            t = local(u)
        elif u.startswith(('http://', 'https://', '//')):
            continue
        elif u.startswith('/'):
            t = u[1:].split('#')[0].split('?')[0]
        else:
            t = os.path.normpath(os.path.join(os.path.dirname(pg), u.split('#')[0].split('?')[0]))
        if t in ('', '.'):
            continue
        if t.startswith('..') or not exists(t):
            problems.append('%s: broken link %s' % (pg, u))

sm = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read()
locs = re.findall(r'<loc>([^<]+)</loc>', sm)
if len(locs) != len(set(locs)):
    problems.append('sitemap: duplicate <loc>')
for u in locs:
    p = local(u)
    m = meta.get(os.path.normpath(p))
    if not exists(p) or m is None:
        problems.append('sitemap: missing file for %s' % u)
    elif m['stub'] or m['noindex']:
        problems.append('sitemap: %s is %s' % (u, 'a redirect stub' if m['stub'] else 'noindex'))
    elif m['canon'] and local(m['canon']) != p:
        problems.append('sitemap: %s has canonical %s' % (u, m['canon']))
listed = {os.path.normpath(local(u)) for u in locs}
for pg, m in meta.items():
    if m['stub'] or m['noindex'] or not m['canon'] or pg in ALLOW_UNLISTED or not m['canon'].startswith(ORIGIN):
        continue
    if os.path.normpath(local(m['canon'])) == pg and pg not in listed:
        problems.append('sitemap: indexable page not listed: %s' % pg)

print('%d pages, %d sitemap URLs, %d problem(s)' % (len(pages), len(locs), len(problems)))
for x in problems[:200]:
    print('  ' + x)
sys.exit(1 if problems else 0)
