"""Re-learn i18n-tools/<tool>/<lang>.json from the committed translated page.
usage (site folder): python3 i18n-tools/home/learn_from_pages.py home|cfo sk [cs ...]"""
import io, json, os, re, subprocess, sys, html as H
tool = sys.argv[1]; langs = sys.argv[2:]
D = 'i18n-tools/' + tool
sys.path.insert(0, 'i18n-tools/home')
from strings import segments
BUILD = {'home': ('build_lang.py', 'index.html'), 'cfo': ('build_cfo.py', 'cfo.html')}[tool]
def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8').write(s)
en = rd(BUILD[1])
segs = segments(en)
SRC = rd('%s/%s' % (D, BUILD[0]))
uniq = []
for k, s, e, t in segs:
    # text the builder looks for literally (e.g. the EN language code) is left as it is
    if t not in uniq and ("'%s'" % t not in SRC and '"%s"' % t not in SRC and '>%s<' % t not in SRC): uniq.append(t)
M = lambda i: '⟦%d⟧' % i
import ast
mm = re.search(r'for key in (\[.*?\]):', SRC, re.S)
JSKEYS = ast.literal_eval(mm.group(1)) if mm else []
for L in langs:
    page = L + '/' + BUILD[1]; target = rd(page)
    old = json.loads(rd('%s/%s.json' % (D, L)))
    mk = dict(old); mk.update({t: M(i) for i, t in enumerate(uniq)})
    js_new = [k for k in JSKEYS if k not in old and k not in uniq]   # JS-only strings the json lacks: learn them from the page script
    base = len(uniq)
    for n, k in enumerate(js_new): mk[k] = M(base + n)
    allk = uniq + js_new
    tmp = '/tmp/claude-501/learn_%s_%s.json' % (tool, L); os.makedirs(os.path.dirname(tmp), exist_ok=True); wr(tmp, json.dumps(mk, ensure_ascii=False))
    r = subprocess.run([sys.executable, '%s/%s' % (D, BUILD[0]), L], env=dict(os.environ, TR=tmp), capture_output=True, text=True)
    built = rd(page); wr(page, target)
    if r.returncode: print(L, 'marker build failed:', (r.stderr or r.stdout)[-300:]); continue
    parts = re.split('(⟦\\d+⟧)', built)
    pos = 0; learned = {}; conflict = []; ok = True
    for i in range(0, len(parts) - 1, 2):
        fixed, mark = parts[i], parts[i + 1]
        if not target.startswith(fixed, pos):
            j = target.find(fixed, pos)
            if j < 0: print(L, 'lost alignment near', repr(fixed[:80])); ok = False; break
            pos = j
        pos += len(fixed)
        nxt = parts[i + 2]
        anchor = nxt[:60] if nxt else ''
        j = target.find(anchor, pos) if anchor else len(target)
        if j < 0: print(L, 'no anchor', repr(anchor)); ok = False; break
        val = target[pos:j]; pos = j
        idx = int(mark[1:-1]); t = allk[idx]
        if t in learned and learned[t] != val: conflict.append((t, learned[t], val))
        learned.setdefault(t, val)
    if not ok: continue
    new = dict(old)
    for t, v in learned.items():
        kinds = {k for k, s, e, tt in segs if tt == t}
        if any(k.startswith('attr:') for k in kinds): v = v.replace('&quot;', '"')
        if t in js_new: v = v.replace("\\'", "'").replace('\\"', '"')
        new[t] = v
    wr('%s/%s.json' % (D, L), json.dumps(new, ensure_ascii=False, indent=1))
    r = subprocess.run([sys.executable, '%s/%s' % (D, BUILD[0]), L], capture_output=True, text=True)
    got = rd(page); wr(page, target)
    print(L, 'learned', len(learned), 'changed', sum(1 for t in learned if old.get(t) != new[t]), 'conflicts', len(conflict),
          'REPRODUCES' if got == target else ('build: ' + (r.stderr or r.stdout)[-200:] if r.returncode else 'DIFFERS'))
    for c in conflict[:3]: print('   conflict', repr(c[0][:50]), '|', repr(c[1][:50]), '|', repr(c[2][:50]))
