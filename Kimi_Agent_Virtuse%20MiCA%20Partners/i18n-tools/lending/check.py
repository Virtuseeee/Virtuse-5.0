#!/usr/bin/env python3
"""python3 check.py <lang>: validate <lang>.json against en.json."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
L = sys.argv[1]
en = json.load(open(os.path.join(HERE, 'en.json')))
tr = json.load(open(os.path.join(HERE, L + '.json')))
p = []
miss = [k for k in en if k not in tr]; extra = [k for k in tr if k not in en]
if miss: p.append('missing keys: %r' % miss[:5])
if extra: p.append('unknown keys: %r' % extra[:5])
for k, v in tr.items():
    if k not in en: continue
    if not isinstance(v, str) or not v.strip(): p.append('empty %s' % k); continue
    if re.search(r'&(?![a-zA-Z]+;|#\d+;)', v): p.append('bare & in %s' % k)
    tags_en = re.findall(r'<[^>]+>', en[k]); tags_v = re.findall(r'<[^>]+>', v)
    if sorted(tags_en) != sorted(tags_v): p.append('tags differ in %s: %r vs %r' % (k, tags_en, tags_v))
    for lit in ():
        if lit in en[k] and lit not in v: p.append('%s must stay literally in %s' % (lit, k))
    if re.search(r'\b(best|leading|recommend\w*)\b', v, re.I) and L not in ('en',): p.append('English advice word in %s' % k)
print('%s: %d keys, %d problems' % (L, len(tr), len(p)))
for x in p[:40]: print(' -', x)
sys.exit(1 if p else 0)
