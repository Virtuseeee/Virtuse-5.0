#!/usr/bin/env python3
"""Validate a translation file: python3 check.py <lang>   (reads <lang>.json next to this file)."""
import json, re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
lang = sys.argv[1]
en = [x['en'] for x in json.load(open(os.path.join(HERE, 'en_strings.json')))]
tr = json.load(open(os.path.join(HERE, lang + '.json')))
problems = []
missing = [k for k in en if k not in tr]
extra = [k for k in tr if k not in en]
if missing: problems.append('missing keys: %d, e.g. %r' % (len(missing), missing[:3]))
if extra: problems.append('unknown keys: %d, e.g. %r' % (len(extra), extra[:3]))
for k, v in tr.items():
    if k not in en: continue
    if not isinstance(v, str) or not v.strip() and k.strip():
        problems.append('empty value for %r' % k); continue
    # HTML entities: a bare & must be written &amp;
    if re.search(r'&(?![a-zA-Z]+;|#\d+;)', v):
        problems.append('bare & in %r -> %r' % (k, v))
    if '<' in v or '>' in v.replace('&gt;', ''):
        problems.append('angle bracket in %r -> %r' % (k, v))
    if k.startswith(' ') != v.startswith(' ') or k.endswith(' ') != v.endswith(' '):
        problems.append('leading/trailing space changed for %r -> %r' % (k, v))
    for ent in ('&rarr;', '&mdash;', '&copy;'):
        if ent in k and ent not in v:
            problems.append('entity %s dropped in %r' % (ent, k))
    if re.search(r'\b(best|recommended|recommend)\b', v, re.I) and lang in ('de', 'fr', 'es'):
        problems.append('advice-like word in %r -> %r' % (k, v))
print('%s: %d keys, %d problems' % (lang, len(tr), len(problems)))
for p in problems[:40]:
    print(' -', p)
sys.exit(1 if problems else 0)
