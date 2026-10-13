#!/usr/bin/env python3
"""Truthful <lastmod> in sitemap.xml + drop URLs that should not be there.

Usage (from anywhere):
    python3 seo-ops/sitemap_lastmod.py            # rewrite sitemap.xml in place
    python3 seo-ops/sitemap_lastmod.py --check    # report only, exit 1 if anything would change

lastmod = the real last content change of the page's file:
  * `git log -1 --format=%cs -- <file>` (one git log pass for the whole site),
  * the file has uncommitted changes (modified / untracked) -> today's date
    (the content really changed; after the commit, the commit date takes over),
  * news.html -> date of the newest non-essay Brief in news/issues.json.
Never the build time. URLs inside <!-- STORIES-BUILD:START/END --> keep their
lastmod (stories-build/build.mjs writes the WordPress modified date).

Every <url> (all blocks) is dropped when its file does not exist, the page has
meta robots noindex, or its rel=canonical points to another URL. Dropped URLs
are printed. Nothing else is reordered or reformatted; hreflang alternates stay.

The generators use the same date logic: i18n-tools/apply_tool_seo.py imports
lastmod_for() from here, seo-build/generate.mjs has the Node twin in
seo-build/lib/gitdate.mjs.
"""
import datetime
import json
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_DIR = 'Kimi_Agent_Virtuse%20MiCA%20Partners'
SITE = os.path.join(REPO, SITE_DIR)
ORIGIN = 'https://virtuse.com'
STORIES_START, STORIES_END = '<!-- STORIES-BUILD:START -->', '<!-- STORIES-BUILD:END -->'

_dates = None
_dirty = None


def _git(*args):
    return subprocess.run(['git', '-c', 'core.quotepath=off', *args], cwd=REPO,
                          capture_output=True, text=True, check=True).stdout


def _load():
    global _dates, _dirty
    if _dates is not None:
        return
    _dates = {}
    cur = None
    for line in _git('log', '--format=@@%cs', '--name-only', '--', SITE_DIR).splitlines():
        if line.startswith('@@'):
            cur = line[2:]
        elif line and cur and line not in _dates:
            _dates[line] = cur  # newest commit first, so the first hit wins
    _dirty = set()
    out = _git('status', '--porcelain=v1', '-z', '--untracked-files=all', '--', SITE_DIR)
    for ent in out.split('\0'):
        if len(ent) > 3:
            _dirty.add(ent[3:])


def news_date():
    data = json.load(open(os.path.join(SITE, 'news', 'issues.json'), encoding='utf-8'))
    dates = [i['date'] for i in data.get('issues', []) if not i.get('essay') and i.get('date')]
    return max(dates) if dates else None


def lastmod_for(rel):
    """rel = path relative to the site folder, e.g. 'about.html' or 'sk/index.html'."""
    _load()
    if rel == 'news.html':
        d = news_date()
        if d:
            return d
    key = f'{SITE_DIR}/{rel}'
    if key in _dirty:
        return datetime.date.today().isoformat()
    return _dates.get(key)


def url_to_rel(loc):
    if not loc.startswith(ORIGIN + '/'):
        return None
    p = loc[len(ORIGIN) + 1:].split('#')[0].split('?')[0]
    if p == '' or p.endswith('/'):
        return p + 'index.html'
    return p


def page_problem(loc, rel):
    fp = os.path.join(SITE, rel) if rel else None
    if not fp or not os.path.isfile(fp):
        return 'file missing'
    html = open(fp, encoding='utf-8', errors='replace').read()
    head = html.split('</head>', 1)[0]
    for m in re.finditer(r'<meta\s+[^>]*name=["\']robots["\'][^>]*>', head, re.I):
        if 'noindex' in m.group(0).lower():
            return 'noindex'
    m = re.search(r'<link\s+[^>]*rel=["\']canonical["\'][^>]*>', head, re.I)
    if m:
        h = re.search(r'href=["\']([^"\']+)["\']', m.group(0))
        if h and h.group(1) != loc:
            return f'canonical -> {h.group(1)}'
    return None


URL_RE = re.compile(r'(\n[ \t]*)?<url>(.*?)</url>', re.S)


def process(xml):
    s0 = xml.find(STORIES_START)
    s1 = xml.find(STORIES_END)
    dropped, missing_date = [], []

    def repl(m):
        body = m.group(2)
        lm = re.search(r'<loc>([^<]+)</loc>', body)
        loc = lm.group(1).strip() if lm else ''
        rel = url_to_rel(loc)
        prob = page_problem(loc, rel)
        if prob:
            dropped.append((loc, prob))
            return ''
        in_stories = s0 != -1 and s0 < m.start() < s1
        if in_stories:
            return m.group(0)
        d = lastmod_for(rel)
        if not d:
            missing_date.append(loc)
            return m.group(0)
        if '<lastmod>' in body:
            body = re.sub(r'<lastmod>[^<]*</lastmod>', f'<lastmod>{d}</lastmod>', body, count=1)
        else:
            body = body.replace('</loc>', f'</loc>\n    <lastmod>{d}</lastmod>', 1)
        return f'{m.group(1) or ""}<url>{body}</url>'

    return URL_RE.sub(repl, xml), dropped, missing_date


def dist(xml, n=5):
    c = {}
    for d in re.findall(r'<lastmod>([^<]+)</lastmod>', xml):
        c[d] = c.get(d, 0) + 1
    return sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[:n]


def main():
    check = '--check' in sys.argv
    path = os.path.join(SITE, 'sitemap.xml')
    xml = open(path, encoding='utf-8').read()
    new, dropped, missing = process(xml)
    print(f'URLs: {xml.count("<url>")} -> {new.count("<url>")}')
    print('lastmod top 5 before:', dist(xml))
    print('lastmod top 5 after: ', dist(new))
    for loc, why in dropped:
        print(f'DROPPED {loc}  ({why})')
    for loc in missing:
        print(f'NO GIT DATE (kept old lastmod) {loc}')
    if new == xml:
        print('sitemap.xml unchanged')
        return 0
    if check:
        print('sitemap.xml would change')
        return 1
    open(path, 'w', encoding='utf-8').write(new)
    print('sitemap.xml written')
    return 0


if __name__ == '__main__':
    sys.exit(main())
