#!/usr/bin/env python3
"""Per-page CSP: list a third-party origin only when the page actually uses it.

tighten(html, page_path) rewrites the page's <meta http-equiv="Content-Security-Policy">.
For each origin in OPTIONAL it looks at what the page runs: the src of its <script> and
<iframe> tags, the text of its inline scripts, and the local JS files it loads (plus
their static/dynamic imports, e.g. the Layer 2 module chunks). The origin stays in its
directive only if one of those mentions it. Origins not in OPTIONAL (Google Tag Manager /
Analytics, fonts, 'self', ...) are never touched.

The result does not depend on the CSP the page started with: every OPTIONAL origin is
first removed and then put back (in a fixed order) if used. Builders that copy the CSP
from the homepage therefore still get e.g. widget.firefish.io on lending.html.

Pages whose body comes from WordPress in the browser (article.js / news.js / stories)
can embed YouTube, Spotify or X players that no local file names, so they are skipped.

  python3 csp_tight.py [--check] FILE...   rewrite (or only report) the given pages
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)

OPTIONAL = {
    'script-src': ['https://cdn.jsdelivr.net'],
    'connect-src': ['https://blog.virtuse.com', 'https://api.coingecko.com', 'https://api.binance.com', 'https://mempool.space',
                    'https://virtuse-newsletter.virtuse-ai.workers.dev'],
    'frame-src': ['https://widget.firefish.io', 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://open.spotify.com',
                  'https://platform.twitter.com', 'https://twitter.com', 'https://x.com'],
}
SKIP_SCRIPTS = ('article.js', 'news/news.js')   # render WordPress HTML (embeds) at runtime
CSP_RE = re.compile(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)">')


def _local_js(page_path, src):
    if re.match(r'(https?:)?//', src) or src.startswith('data:'):
        return None
    src = re.split(r'[?#]', src)[0]
    p = os.path.join(SITE, src.lstrip('/')) if src.startswith('/') else os.path.normpath(os.path.join(os.path.dirname(page_path), src))
    return p if os.path.isfile(p) else None


def _js_closure(paths):
    seen, todo, text = set(), list(paths), []
    while todo:
        p = todo.pop()
        if p in seen:
            continue
        seen.add(p)
        s = open(p, encoding='utf-8', errors='replace').read()
        text.append(s)
        for m in re.finditer(r'''(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.{1,2}/[^"']+\.js)["']''', s):
            q = os.path.normpath(os.path.join(os.path.dirname(p), m.group(1)))
            if os.path.isfile(q):
                todo.append(q)
    return '\n'.join(text)


def used_text(html, page_path):
    """Everything the page can run: script/iframe srcs, inline scripts, loaded local JS."""
    parts, local = [], []
    for m in re.finditer(r'<(script|iframe)\b([^>]*)>(.*?)</\1>', html, re.S | re.I):
        tag, attrs, body = m.group(1).lower(), m.group(2), m.group(3)
        src = re.search(r'\bsrc="([^"]*)"', attrs)
        if src:
            parts.append(src.group(1))
            if tag == 'script':
                p = _local_js(page_path, src.group(1))
                if p:
                    local.append(p)
        if tag == 'script' and 'application/ld+json' not in attrs:
            parts.append(body)
    parts.append(_js_closure(local))
    return '\n'.join(parts)


def skipped(html):
    return any(re.search(r'<script[^>]*\bsrc="[^"]*\b%s\b' % re.escape(s), html) for s in SKIP_SCRIPTS)


def tighten(html, page_path):
    m = CSP_RE.search(html)
    if not m or skipped(html):
        return html
    text = used_text(html, page_path)
    dirs = [d.strip() for d in m.group(1).split(';') if d.strip()]
    out = []
    for d in dirs:
        toks = d.split()
        name = toks[0]
        if name in OPTIONAL:
            opt = OPTIONAL[name]
            toks = [t for t in toks if t not in opt] + [o for o in opt if re.search(r'(?<![\w.-])' + re.escape(o.split('//', 1)[1]) + r'(?![\w-])', text)]
        out.append(' '.join(toks))
    new = '<meta http-equiv="Content-Security-Policy" content="%s">' % '; '.join(out)
    return html[:m.start()] + new + html[m.end():]


def main():
    args = sys.argv[1:]
    check = '--check' in args
    files = [a for a in args if a != '--check']
    changed = 0
    for f in files:
        f = os.path.abspath(f)
        s = open(f, encoding='utf-8').read()
        t = tighten(s, f)
        if t != s:
            changed += 1
            if check:
                print('would change', os.path.relpath(f, SITE))
            else:
                open(f, 'w', encoding='utf-8').write(t)
    print('%d of %d page(s) %s' % (changed, len(files), 'need a change' if check else 'changed'))
    if check and changed:
        sys.exit(1)


if __name__ == '__main__':
    main()
