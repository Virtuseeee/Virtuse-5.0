#!/usr/bin/env python3
"""SEO plan phase 4: set <title>, meta description, og:/twitter: title and
description on 13 hub pages in all 10 languages from data/phase4_titles.json.
Idempotent. Usage: python3 i18n-tools/apply_phase4_titles.py [--dry-run]"""
import html, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(open(os.path.join(ROOT, 'i18n-tools', 'data', 'phase4_titles.json'), encoding='utf-8'))
def attr(s, sel, val):
    pat = re.compile(r'(<meta ' + re.escape(sel) + r' content=")[^"]*(">)')
    s2, n = pat.subn(lambda m: m.group(1) + html.escape(val, quote=True) + m.group(2), s, count=1)
    return s2, n
def main():
    dry = '--dry-run' in sys.argv
    changed = 0; problems = []
    for lang, pages in DATA.items():
        for page, (title, desc) in pages.items():
            rel = f'{page}.html' if lang == 'en' else f'{lang}/{page}.html'
            path = os.path.join(ROOT, rel)
            s = open(path, encoding='utf-8').read()
            n0 = s
            s, k = re.subn(r'<title>.*?</title>', lambda m: '<title>' + html.escape(title, quote=False) + '</title>', s, count=1, flags=re.S)
            if not k: problems.append(rel + ' no <title>')
            for sel, val in (('name="description"', desc), ('property="og:title"', title), ('property="og:description"', desc),
                             ('name="twitter:title"', title), ('name="twitter:description"', desc)):
                s, k = attr(s, sel, val)
                if not k: problems.append(f'{rel} no {sel}')
            if s != n0:
                changed += 1
                if not dry: open(path, 'w', encoding='utf-8').write(s)
    print('changed', changed, '(dry run)' if dry else '')
    for p in problems: print('  !!', p)
if __name__ == '__main__': main()
