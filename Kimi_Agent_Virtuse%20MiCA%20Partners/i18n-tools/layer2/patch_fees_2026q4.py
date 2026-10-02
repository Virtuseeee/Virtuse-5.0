#!/usr/bin/env python3
"""Q4 2026 fee update, patched straight into the BUILT Layer 2 bundles.

The Concierge/Stacking source (~/Documents/virtuse-concierge-deploy/bitcoin-concierge)
was not reachable from the Mac used on 2026-10-02, so the shipped bundles in
concierge-assets/ are patched instead. **Port the same change into the source
(src FEE_SCHEDULE + feeNote strings + i18n dictionaries) before the next
`npm run build`, or the rebuild brings the old fees back.**

Checked on the partners' own pages 2026-10-02 (taker = a plain market buy):
- ByBit EU spot: 0.1% maker / 0.25% taker  -> 0.25%
- Kraken Pro spot, tier 1 ($0+): 0.40% maker / 0.80% taker -> 0.8%
- 21bitcoin Auto-Invest: 0% from day 8 (unchanged)
- RevenueBot: 20% of bot profit, max $50/month, no purchase fee
  -> removed from the purchase-cost comparison (Stacking DR array).

Changed files get a new content-hash name; references in the other assets and
in the HTML shells are rewritten. Old files are left in place (cached pages
keep working). Idempotent: does nothing once the old numbers are gone.
"""
import glob, hashlib, os, re

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
A = os.path.join(SITE, 'concierge-assets')

SUBS = [
    ('pct:.0016,', 'pct:.008,'), ('pct:.001,', 'pct:.0025,'),
    ('0.16 %', '0.8 %'), ('0.16%', '0.8%'), ('0,16 %', '0,8 %'), ('0,16%', '0,8%'),
    ('0.1 %', '0.25 %'), ('0.1%', '0.25%'), ('0,1 %', '0,25 %'), ('0,1%', '0,25%'),
]
RB = re.compile(r',\{id:"revenuebot",partner:"RevenueBot",method:\{.*?url:"https://app\.revenuebot\.io/external/r/90928"\}(?=\];)', re.S)


def fee_patch(s):
    s2 = RB.sub('', s)
    for a, b in SUBS:
        s2 = s2.replace(a, b)
    return s2


def main():
    renames = {}
    for p in sorted(glob.glob(os.path.join(A, '*.js'))):
        s = open(p, encoding='utf-8').read()
        n = fee_patch(s)
        if n != s:
            open(p, 'w', encoding='utf-8').write(n)
            renames[os.path.basename(p)] = None
            print('patched', os.path.basename(p))
    if not renames:
        print('nothing to patch'); return
    # cascade: any asset referencing a renamed file changes too
    changed = True
    while changed:
        changed = False
        for p in glob.glob(os.path.join(A, '*.js')) + glob.glob(os.path.join(A, '*.css')):
            b = os.path.basename(p)
            if b in renames: continue
            s = open(p, encoding='utf-8').read()
            if any(old in s for old in renames):
                renames[b] = None; changed = True
    # new names from content hash (after reference rewrite, iterate until stable)
    def newname(old, content):
        stem, ext = os.path.splitext(old)
        base = stem.rsplit('-', 1)[0]
        return f"{base}-q4{hashlib.md5(content.encode()).hexdigest()[:6]}{ext}"
    contents = {b: open(os.path.join(A, b), encoding='utf-8').read() for b in renames}
    for b in renames: renames[b] = newname(b, contents[b])
    for b, c in contents.items():
        for old, new in renames.items():
            c = c.replace(old, new)
        open(os.path.join(A, renames[b]), 'w', encoding='utf-8').write(c)
        print(f'{b} -> {renames[b]}')
    shells = glob.glob(os.path.join(SITE, '*.html')) + glob.glob(os.path.join(SITE, '*', '*.html'))
    nsh = 0
    for p in shells:
        s = open(p, encoding='utf-8').read()
        n = s
        for old, new in renames.items():
            n = n.replace(old, new)
        if n != s:
            open(p, 'w', encoding='utf-8').write(n); nsh += 1
    print('html files updated:', nsh)
    # the patched originals are restored, so old URLs keep serving old content
    print('NOTE: run `git checkout -- concierge-assets/<old names>` to restore the originals')


if __name__ == '__main__':
    main()
