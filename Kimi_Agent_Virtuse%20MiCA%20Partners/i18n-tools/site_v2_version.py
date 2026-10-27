#!/usr/bin/env python3
"""One cache-buster for the shared site-v2 files on every built page (design-align Batch A Part 1, 2026-10-26).

usage: python3 i18n-tools/site_v2_version.py [--check]   (--check: list pages with another version, exit 1)

Rewrites every site-v2 stylesheet link to site-v2.min.css?v=SITE_CSS_V and every site-v2.js to
?v=SITE_JS_V (numbers in speed.py). Builders already do this in C.finalize(), seo-build imports the same
numbers in lib/html.mjs; this script covers hand-made pages (operator, how-we-earn, ...) and pages that
are not rebuilt after a bump. Pages without a site-v2 link (homepage, cfo, blog, news) are untouched.
"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import speed

SITE = os.path.dirname(HERE)


def pages():
    out = subprocess.run(['git', 'ls-files', '*.html'], cwd=SITE, capture_output=True, text=True, check=True).stdout
    return [p for p in out.splitlines() if not p.startswith('i18n-tools/')]


def fix(html):
    html = speed.CSS_RE.sub(r'\1site-v2.min.css?v=%s"' % speed.SITE_CSS_V, html)
    return speed.JS_RE.sub(r'\1site-v2.js?v=%s"' % speed.SITE_JS_V, html)


def main():
    check = '--check' in sys.argv
    changed = []
    for p in pages():
        path = os.path.join(SITE, p)
        s = open(path, encoding='utf-8').read()
        t = fix(s)
        if t != s:
            changed.append(p)
            if not check:
                open(path, 'w', encoding='utf-8').write(t)
    if check:
        for p in changed[:40]:
            print('other site-v2 version:', p)
        print('%d page(s) not on site-v2.min.css?v=%s / site-v2.js?v=%s' % (len(changed), speed.SITE_CSS_V, speed.SITE_JS_V))
        sys.exit(1 if changed else 0)
    print('rewrote %d page(s) to site-v2.min.css?v=%s, site-v2.js?v=%s' % (len(changed), speed.SITE_CSS_V, speed.SITE_JS_V))


if __name__ == '__main__':
    main()
