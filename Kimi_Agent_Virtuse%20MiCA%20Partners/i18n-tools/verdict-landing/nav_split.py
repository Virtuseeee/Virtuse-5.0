# -*- coding: utf-8 -*-
"""Verdict and Virtuse CFO are separate products (Ras 2026-10-27): the combined
"Virtuse CFO · Verdict" entry becomes two entries in the Tools menu and the
footer, cards about Verdict link to the Verdict landing, and links to the old
cfo.html#verdict hero go to verdict.html. Idempotent.
Usage (repo root): python3 "Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/verdict-landing/nav_split.py" [--dry]"""
import os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
LANGS = ('sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru')
OWN = ('en', 'sk', 'ru')
VNAME = {'sk': 'Verdikt', 'cs': 'Verdikt'}
CFO_D = {'en': 'Fees, loans and tax over time · planned', 'sk': 'Poplatky, pôžičky a dane v čase · pripravujeme',
         'cs': 'Poplatky, půjčky a daně v čase · připravujeme', 'de': 'Gebühren, Kredite und Steuern im Blick · in Planung',
         'fr': 'Frais, prêts et impôts dans la durée · en préparation', 'es': 'Comisiones, préstamos e impuestos en el tiempo · en preparación',
         'pl': 'Opłaty, pożyczki i podatki w czasie · w przygotowaniu', 'hu': 'Díjak, hitelek és adók követése · előkészületben',
         'uk': 'Комісії, позики й податки з часом · готуємо', 'ru': 'Комиссии, займы и налоги со временем · готовим'}
ROOTS = ['Kimi_Agent_Virtuse%20MiCA%20Partners', 'seo-build', 'stories-build', 'layer2-src/src']   # not the Worker: its waitlist is the CFO list
SKIP_DIRS = {'node_modules', 'dist', '.git', 'research', 'legacy', 'work'}
EXT = ('.html', '.js', '.json', '.mjs', '.ts', '.tsx', '.py')

def file_lang(path, text):
    m = re.search(r'<html lang="(\w\w)', text)
    if m and path.endswith('.html'): return m.group(1)
    rel = os.path.relpath(path, os.path.join(ROOT, ROOTS[0]))
    first = rel.split(os.sep)[0]
    return first if first in LANGS else 'en'

def href_lang(href, default):
    m = re.search(r'(?:^|/)(sk|cs|de|fr|es|pl|hu|uk|ru)/cfo\.html', href)
    return m.group(1) if m else default

def vhref(href, lang):
    if lang in OWN: return re.sub(r'cfo\.html(?:#verdict)?', 'verdict.html', href, count=1)
    return '/verdict.html'

Q = r'(\\?")'   # plain or JSON-escaped quote
def run(text, flang):
    n = 0
    def nav(m):
        nonlocal n; n += 1
        q, href, badge, desc = m.group(1), m.group(2), m.group(3), m.group(4)
        L = href_lang(href, flang)
        a = '<a href=%s%s%s id=%snavVerdict%s><span class=%snd-t%s>%s <span class=%snav-badge cfo-badge%s>%s</span></span><span class=%snd-d%s>%s</span></a>' % (
            q, vhref(href, L), q, q, q, q, q, VNAME.get(L, 'Verdict'), q, q, badge, q, q, desc)
        b = '<a href=%s%s%s id=%snavCfo%s><span class=%snd-t%s>Virtuse CFO</span><span class=%snd-d%s>%s</span></a>' % (q, href, q, q, q, q, q, q, q, CFO_D[L])
        return a + b
    text = re.sub(r'<a href=' + Q + r'([^"\\]*)\1 id=\1navCfo\1><span class=\1nd-t\1>Virtuse CFO · Verdict <span class=\1nav-badge cfo-badge\1>([^<]*)</span></span><span class=\1nd-d\1>([^<]*)</span></a>', nav, text)
    def nav2(m):
        nonlocal n; n += 1
        q, href, badge = m.group(1), m.group(2), m.group(3); L = href_lang(href, flang)
        return '<a href=%s%s%s id=%snavVerdict%s>%s <span class=%snav-badge cfo-badge%s>%s</span></a><a href=%s%s%s id=%snavCfo%s>Virtuse CFO</a>' % (
            q, vhref(href, L), q, q, q, VNAME.get(L, 'Verdict'), q, q, badge, q, href, q, q, q)
    text = re.sub(r'<a href=' + Q + r'([^"\\]*)\1 id=\1navCfo\1>Virtuse CFO · Verdict <span class=\1nav-badge cfo-badge\1>([^<]*)</span></a>', nav2, text)
    def foot(m):
        nonlocal n; n += 1
        q, href, badge = m.group(1), m.group(2), m.group(3); L = href_lang(href, flang)
        return '<a href=%s%s%s>%s <span class=%ssoon cfo-foot-badge%s>%s</span></a><a href=%s%s%s>Virtuse CFO</a>' % (
            q, vhref(href, L), q, VNAME.get(L, 'Verdict'), q, q, badge, q, href, q)
    text = re.sub(r'<a href=' + Q + r'([^"\\]*)\1>Virtuse CFO · Verdict <span class=\1soon cfo-foot-badge\1>([^<]*)</span></a>', foot, text)
    def card(m):
        nonlocal n; n += 1
        L = href_lang(m.group(3), flang)
        return m.group(1) + vhref(m.group(3), L) + m.group(4) + VNAME.get(L, 'Verdict') + m.group(5)
    text = re.sub(r'(<a (?:class=' + Q + r'gcard\2 )?href=")([^"]*cfo\.html[^"]*)("><(?:b|span class="rl-title")>)Virtuse CFO · Verdict(</)', card, text)
    # links to the removed Verdict hero on cfo.html
    def hero(m):
        nonlocal n; n += 1
        L = m.group(2) or flang; qs = m.group(3) or ''
        if L in OWN: return m.group(1) + 'verdict.html' + qs
        return '/verdict.html' + qs
    text = re.sub(r'((?:\.\./)*(?:(sk|cs|de|fr|es|pl|hu|uk|ru)/)?)cfo\.html(\?[^"#\s]*)?#verdict', hero, text)
    # remaining text mentions
    for a, b in (('Virtuse CFO · Verdict zadarmo', 'Verdikt zadarmo'), ('Virtuse CFO · Verdict zdarma', 'Verdikt zdarma'),
                 ('Virtuse CFO · Verdict', 'Verdict')):
        c = text.count(a); n += c; text = text.replace(a, b)
    return text, n

dry = '--dry' in sys.argv; files = total = 0
for r in ROOTS:
    for d, ds, fs in os.walk(os.path.join(ROOT, r)):
        ds[:] = [x for x in ds if x not in SKIP_DIRS and not (r == ROOTS[0] and x == 'i18n-tools' and d.endswith(ROOTS[0]))]
        for f in fs:
            if not f.endswith(EXT) or f == 'nav_split.py': continue
            p = os.path.join(d, f)
            try: t = open(p, encoding='utf8').read()
            except Exception: continue
            if 'Virtuse CFO · Verdict' not in t and '#verdict' not in t: continue
            o = t; t, n = run(t, file_lang(p, t))
            if t != o:
                files += 1; total += n
                if not dry: open(p, 'w', encoding='utf8').write(t)
print('files', files, 'changes', total)
