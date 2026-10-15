#!/usr/bin/env python3
"""Brief chrome strings (theme toggle, skip link, Virtuse CFO nav item) from the
strict-JSON CHROME-I18N block in brief-chrome.js, and an idempotent patch for the
nine built blog pages (checklist 2.3). build_brief_blog.py uses table() for new
builds; run this file to patch the existing pages:

    python3 i18n-tools/brief_chrome.py
"""
import html, json, os, re, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# page -> (language, link to that language's CFO page)
BLOGS = {'blog.html': ('en', 'cfo.html'), 'blog-sk.html': ('sk', 'sk/cfo.html')}
for _l in ('uk', 'ru', 'de', 'fr', 'es', 'pl', 'hu'):
    BLOGS['%s/blog.html' % _l] = (_l, 'cfo.html')
CFO_QS = '?utm_source=brief&amp;utm_medium=nav'


def table():
    src = open(os.path.join(SITE, 'brief-chrome.js'), encoding='utf-8').read()
    m = re.search(r'/\*CHROME-I18N\*/(.*?)/\*END-CHROME-I18N\*/', src, re.S)
    if not m:
        sys.exit('CHROME-I18N block not found in brief-chrome.js')
    return json.loads(m.group(1))


def strings(lang):
    t = table()
    return dict(t['en'], **t.get(lang, {}))


def patch(h, lang, cfo_href):
    s = {k: html.escape(v, quote=True) for k, v in strings(lang).items()}
    out, n = re.subn(r'<a class="skip" href="#main">[^<]*</a>', '<a class="skip" href="#main">%s</a>' % s['skip'], h)
    assert n == 1, 'skip'
    out, n = re.subn(r'(<button class="theme-toggle" id="themeToggle" type="button") aria-label="[^"]*" title="[^"]*">',
                     r'\1 aria-label="%s" title="%s">' % (s['toLight'], s['toLight']), out)
    assert n == 1, 'themeToggle'
    out, n = re.subn(r'(<span class="theme-toggle-label" id="themeToggleLabel">)[^<]*', r'\g<1>' + s['light'], out)
    assert n == 1, 'themeToggleLabel'
    if 'data-nav="cfo"' not in out:
        out, n = re.subn(r'(\n( *)<a class="btn btn-accent-outline" href="#subscribe">)',
                         r'\n\2<a href="%s%s" data-nav="cfo">%s</a>\1' % (cfo_href, CFO_QS, s['navCfo']), out, count=1)
        assert n == 1, 'nav'
    return out


if __name__ == '__main__':
    for page, (lang, cfo) in BLOGS.items():
        p = os.path.join(SITE, page)
        h = open(p, encoding='utf-8').read()
        out = patch(h, lang, cfo)
        if out != h:
            open(p, 'w', encoding='utf-8').write(out)
        print('%-16s %s' % (page, 'patched' if out != h else 'unchanged'))
