#!/usr/bin/env python3
"""Audit canonical + hreflang on every indexable page of the static site.

usage: python3 seo-ops/audit_canonical.py [--list]
- indexable = HTML under the site folder, not noindex, not a meta-refresh redirect, not robots-Disallowed
- each must have exactly one <link rel="canonical"> with an absolute https://virtuse.com/... URL equal to its own URL
  (a directory index is /dir/, a language homepage /xx/)
- every hreflang set must be reciprocal: each listed page exists, lists the same set back, and includes itself + x-default
Exit code 1 if anything is wrong.
"""
import glob, os, re, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners')
ORIGIN = 'https://virtuse.com/'
SKIP = ('i18n-tools/', 'docs/', 'mining_deploy/', 'buybitcoin/', 'hero/')


def url_of(rel):
    return ORIGIN + (rel[:-len('index.html')] if rel.endswith('index.html') else rel)


def main():
    os.chdir(ROOT)
    dis = [l.split(':', 1)[1].strip() for l in open('robots.txt') if l.lower().startswith('disallow')]
    pages, by_url = {}, {}
    for f in sorted(glob.glob('**/*.html', recursive=True)):
        if f.startswith(SKIP) or '/node_modules/' in f or any(('/' + f).startswith(d) for d in dis if d):
            continue
        s = open(f, errors='ignore').read()
        head = s[:s.find('</head>')] if '</head>' in s else s[:20000]
        if re.search(r'<meta name="robots" content="[^"]*noindex', head) or 'http-equiv="refresh"' in head:
            continue
        canon = re.findall(r'<link rel="canonical" href="([^"]*)"', head)
        alts = dict(re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', head))
        pages[f] = (canon, alts)
        by_url[url_of(f)] = f
    problems = []
    for f, (canon, alts) in pages.items():
        me = url_of(f)
        if not canon:
            problems.append('%s: no canonical' % f)
        elif len(canon) > 1:
            problems.append('%s: %d canonicals' % (f, len(canon)))
        elif canon[0] != me:
            problems.append('%s: canonical %s != own URL %s' % (f, canon[0], me))
        if alts:
            if me not in alts.values():
                problems.append('%s: hreflang set does not include itself' % f)
            if 'x-default' not in alts:
                problems.append('%s: hreflang without x-default' % f)
            for lang, u in alts.items():
                if lang == 'x-default':
                    continue
                g = by_url.get(u)
                if not g:
                    problems.append('%s: hreflang %s -> %s is not an indexable page here' % (f, lang, u))
                    continue
                back = pages[g][1]
                if me not in back.values():
                    problems.append('%s: %s does not link back (hreflang)' % (f, g))
    print('indexable pages: %d, with hreflang: %d, problems: %d' % (len(pages), sum(1 for p in pages.values() if p[1]), len(problems)))
    if '--list' in sys.argv or len(problems) < 60:
        for p in problems:
            print(' -', p)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
