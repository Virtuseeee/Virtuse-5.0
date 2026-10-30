"""Usage (site folder): python3 i18n-tools/legacy/backsync.py
Bring i18n-tools/legacy/src/<lang>/<page> up to date with the committed built page:
build -> diff(build, page) -> apply each differing hunk to src (found by unique context) -> repeat.
Run from the site folder. Never writes a built page (it restores them from memory)."""
import difflib, io, os, sys
sys.path.insert(0, 'i18n-tools/legacy'); sys.path.insert(0, 'i18n-tools')
import build_legacy as BL
import v2common as C
def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8').write(s)
todo = [(L, p) for p in BL.PAGES for L in BL.LANGS if os.path.exists(os.path.join(BL.SRC, L, p))]
left = []
for L, page in todo:
    pp = C.paths(L, page)[0]; target = rd(pp); sp = os.path.join(BL.SRC, L, page)
    ok = False
    for it in range(6):
        BL.build(L, page); got = rd(pp); wr(pp, target)
        if got == target: ok = True; break
        src = rd(sp); a = got.split('\n'); b = target.split('\n'); changed = False
        ops = [o for o in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes() if o[0] != 'equal']
        for tag, i1, i2, j1, j2 in reversed(ops):
            for c in range(0, 6):
                lo, hi = max(0, i1 - c), min(len(a), i2 + c)
                old = '\n'.join(a[lo:hi]); new = '\n'.join(a[lo:i1] + b[j1:j2] + a[i2:hi])
                if not old.strip(): continue
                if src.count(old) == 1:
                    src = src.replace(old, new); changed = True; break
            else:
                # line not verbatim in src (hero/sub-nav are transformed): move the changed words only
                if tag == 'replace' and i2 - i1 == j2 - j1:
                    for x, y in zip(a[i1:i2], b[j1:j2]):
                        for t2, k1, k2, l1, l2 in reversed(difflib.SequenceMatcher(None, x, y, autojunk=False).get_opcodes()):
                            if t2 == 'equal': continue
                            for c in (8, 16, 30, 50, 80):
                                lo, hi = max(0, k1 - c), min(len(x), k2 + c)
                                o2 = x[lo:hi]; n2 = x[lo:k1] + y[l1:l2] + x[k2:hi]
                                if src.count(o2) == 1:
                                    src = src.replace(o2, n2); changed = True; break
        if not changed: break
        wr(sp, src)
    if not ok: left.append((L, page))
print('in sync %d / %d' % (len(todo) - len(left), len(todo)))
for x in left: print('LEFT', *x)
