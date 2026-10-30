"""Rebuild <tool>/en_strings.json from the English page and drop unused keys from <lang>.json.
usage (site folder): python3 i18n-tools/home/rebuild_en_strings.py home|cfo"""
import ast, io, json, re, sys
tool = sys.argv[1]; D = 'i18n-tools/' + tool
sys.path.insert(0, 'i18n-tools/home')
from strings import segments, context
page, builder = {'home': ('index.html', 'build_lang.py'), 'cfo': ('cfo.html', 'build_cfo.py')}[tool]
en = io.open(page, encoding='utf-8').read(); src = io.open('%s/%s' % (D, builder), encoding='utf-8').read()
old = json.load(io.open('%s/en_strings.json' % D, encoding='utf-8'))
out, seen = [], set()
for k, s, e, t in segments(en):
    if t in seen: continue
    seen.add(t); out.append({'en': t, 'kind': k, 'context': context(en, s, e)})
m = re.search(r'for key in (\[.*?\]):', src, re.S)
for k in (ast.literal_eval(m.group(1)) if m else []):
    if k not in seen: seen.add(k); out.append({'en': k, 'kind': 'script', 'context': 'script message (%s)' % builder})
io.open('%s/en_strings.json' % D, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1))
print('en_strings', len(old), '->', len(out))
for L in ['sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru']:
    p = '%s/%s.json' % (D, L); raw = io.open(p, encoding='utf-8').read(); tr = json.loads(raw)
    keep = {k: v for k, v in tr.items() if k in seen}
    if len(keep) != len(tr):
        io.open(p, 'w', encoding='utf-8').write(json.dumps(keep, ensure_ascii=False, indent=1) + ('\n' if raw.endswith('\n') else ''))
    print(L, 'dropped', len(tr) - len(keep))
