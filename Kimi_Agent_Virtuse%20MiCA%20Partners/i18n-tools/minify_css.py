#!/usr/bin/env python3
"""site-v2.css (readable source, edit this one) -> site-v2.min.css (what the pages load).

usage: python3 i18n-tools/minify_css.py [--check]   (--check: exit 1 if site-v2.min.css is stale)

Conservative on purpose: strips comments and collapses whitespace, but never touches spaces
around + - * / (calc), never removes a space before ':' (descendant pseudo selectors), and keeps
string literals (content: "...", url("...")) exactly as written. Audit 2026-10-15, code P1-4.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
SRC, OUT = os.path.join(SITE, 'site-v2.css'), os.path.join(SITE, 'site-v2.min.css')
TOKEN = re.compile(r'("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|/\*.*?\*/)', re.S)


def minify(css):
    out = []
    for i, part in enumerate(TOKEN.split(css)):
        if i % 2:                                  # string literal or comment
            if not part.startswith('/*'):
                out.append(part)
            continue
        p = re.sub(r'\s+', ' ', part)
        p = re.sub(r'\s*([{};,])\s*', r'\1', p)    # around braces, semicolons, commas
        p = re.sub(r':\s+', ':', p)                # after ':' only (never before)
        out.append(p)
    s = ''.join(out)
    s = s.replace(';}', '}')
    return s.strip() + '\n'


def main():
    src = open(SRC, encoding='utf-8').read()
    m = '/* GENERATED from site-v2.css by i18n-tools/minify_css.py. Edit site-v2.css, then re-run. */\n' + minify(src)
    if '--check' in sys.argv:
        cur = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if cur != m:
            print('site-v2.min.css is stale: run python3 i18n-tools/minify_css.py'); sys.exit(1)
        print('site-v2.min.css up to date'); return
    open(OUT, 'w', encoding='utf-8').write(m)
    print('site-v2.css %d -> site-v2.min.css %d bytes' % (len(src.encode()), len(m.encode())))


if __name__ == '__main__':
    main()
