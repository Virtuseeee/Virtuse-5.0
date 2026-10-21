"""Outline Inter text with fontTools and compose the Virtuse lockup SVGs.
Units: the mark's own viewBox (760 x 483). Nav lockup on virtuse.com:
mark 26px tall, 'Virtuse' Inter 800 21px, letter-spacing 0.01em,
align-items:flex-end, gap 1px, text shifted down 3px (line-height 1)."""
import json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

MARK_A = "M30 0h220l250 483H280Z"
MARK_B = "M510 0h245L645 205H400Z"
GRAD = ('<linearGradient id="vlgA" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#A5E0FB"/><stop offset="1" stop-color="#5FAEDE"/></linearGradient>'
        '<linearGradient id="vlgB" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#4D94EC"/><stop offset="1" stop-color="#2B62C0"/></linearGradient>')
PX = 483 / 26.0  # lockup units per CSS px

def outline(fontfile, text, size, x0, baseline, tracking_em=0.0, cls="vl"):
    """Return (list of <path> strings, total advance) for text at font size `size`
    (in output units), pen origin at (x0, baseline), y down."""
    f = TTFont(fontfile); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm
    kern = {}
    try:
        from fontTools.ttLib.tables import otTables  # noqa
        # GPOS pair kerning (first PairPos subtable, format 1/2) -- good enough for 'Virtuse'
        gpos = f['GPOS'].table
        for lk in gpos.LookupList.Lookup:
            for st in lk.SubTable:
                if getattr(st, 'LookupType', lk.LookupType) == 9: st = st.ExtSubTable
                if st.LookupType != 2: continue
                cov = st.Coverage.glyphs
                if st.Format == 1:
                    for g1, ps in zip(cov, st.PairSet):
                        for pvr in ps.PairValueRecord:
                            v = pvr.Value1.XAdvance if pvr.Value1 and hasattr(pvr.Value1,'XAdvance') else 0
                            if v: kern[(g1, pvr.SecondGlyph)] = v
                elif st.Format == 2:
                    c1 = st.ClassDef1.classDefs; c2 = st.ClassDef2.classDefs
                    for g1 in cov:
                        k1 = c1.get(g1, 0)
                        for g2, k2 in c2.items():
                            rec = st.Class1Record[k1].Class2Record[k2]
                            v = rec.Value1.XAdvance if rec.Value1 and hasattr(rec.Value1,'XAdvance') else 0
                            if v and (g1, g2) not in kern: kern[(g1, g2)] = v
    except Exception as e:
        print("kern skipped:", e)
    s = size / upm
    x = x0; paths = []; prev = None
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]
        if prev and (prev, g) in kern: x += kern[(prev, g)] * s
        if ch != ' ':
            pen = SVGPathPen(gs); tp = TransformPen(pen, (s, 0, 0, -s, x, baseline))
            gs[g].draw(tp)
            d = pen.getCommands()
            paths.append(f'<path class="{cls}" style="--i:{i}" d="{d}"/>')
        x += gs[g].width * s + tracking_em * size
        prev = g
    return paths, x - x0 - tracking_em * size

def rnd(svg):
    import re
    return re.sub(r'(\d+\.\d{3})\d+', r'\1', svg)

# --- horizontal lockup (nav proportions) ---
size = 21 * PX                 # 390.1
baseline = 26.14 * PX          # 485.6 ~ mark bottom
x0 = 760 + 1 * PX
wm, adv = outline('fonts/Inter-800.ttf', 'Virtuse', size, x0, baseline, tracking_em=0.01)
W = x0 + adv
H = 483 + 0.2415 * size        # leave room for descender-free text; viewBox bottom
lockup = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {H:.1f}" role="img" aria-label="Virtuse">'
          f'<title>Virtuse</title><defs>{GRAD}</defs>'
          f'<g class="vmark"><path class="vm vm-a" fill="url(#vlgA)" d="{MARK_A}"/><path class="vm vm-b" fill="url(#vlgB)" d="{MARK_B}"/></g>'
          f'<g class="vword" fill="currentColor">{"".join(wm)}</g></svg>')
open('out/virtuse-logo-mark.svg', 'w').write(rnd(lockup))

# --- fragments for the animation page (stacked layout composes them itself) ---
sub, sub_adv = outline('fonts/Inter-500.ttf', 'WEALTH MANAGEMENT', 100, 0, 0, tracking_em=0.30, cls="vs")
url, url_adv = outline('fonts/Inter-500.ttf', 'virtuse.com', 100, 0, 0, tracking_em=0.02, cls="vs")
wm0, adv0 = outline('fonts/Inter-800.ttf', 'Virtuse', 1000, 0, 0, tracking_em=0.01)  # 1000-unit em, origin baseline
frag = {
  'lockup': {'w': W, 'h': H, 'textX': x0, 'baseline': baseline, 'size': size},
  'word': {'paths': rnd(''.join(wm0)), 'adv': adv0, 'em': 1000, 'cap': 1490/2048*1000},
  'sub':  {'paths': rnd(''.join(sub)), 'adv': sub_adv, 'em': 100, 'cap': 1490/2048*100},
  'url':  {'paths': rnd(''.join(url)), 'adv': url_adv, 'em': 100, 'cap': 1490/2048*100},
  'markA': MARK_A, 'markB': MARK_B, 'grad': GRAD,
}
json.dump(frag, open('out/fragments.json', 'w'))
print('lockup', round(W,1), round(H,1), 'word adv', round(adv0,1), 'sub adv', round(sub_adv,1), 'kern pairs', len(wm))
