import json
F = json.load(open('out/fragments.json'))
A, B, GRAD = F['markA'], F['markB'], F['grad']
word, sub, url = F['word'], F['sub'], F['url']
CAP = 1490/2048

# ---------- stacked composition (mark units) ----------
WW = 1180.0                          # wordmark width under the mark
ws = WW / word['adv']                # scale for 1000-em word
wcap = CAP * 1000 * ws
gap1, gap2, gap3 = 150, 135, 100
SW = 1010.0; ss = SW / sub['adv']; scap = CAP * 100 * ss
UW = 560.0; us = UW / url['adv']; ucap = CAP * 100 * us
PAD = 60
cw = max(760, WW, SW) + 2*PAD
markx = (cw - 760) / 2
wordx = (cw - WW) / 2; wordy = 483 + gap1 + wcap          # baseline
subx = (cw - SW) / 2;  suby = wordy + gap2 + scap
urlx = (cw - UW) / 2;  urly = suby + gap3 + ucap
ch_intro = suby + 0.05*100*ss + PAD
ch_outro = urly + 0.05*100*us + PAD
def mark_group(tx, ty, sc=1.0):
    return (f'<g class="vmark" transform="translate({tx:.1f},{ty:.1f}) scale({sc})">'
            f'<path class="vm vm-a" fill="url(#vlgA)" d="{A}"/><path class="vm vm-b" fill="url(#vlgB)" d="{B}"/>'
            f'<g clip-path="url(#vclip)"><g transform="skewX(-22)"><rect class="vsheen" x="-320" y="-80" width="300" height="660" fill="url(#vshine)"/></g></g></g>')
DEFS = (f'<defs>{GRAD}<clipPath id="vclip"><path d="{A}"/><path d="{B}"/></clipPath>'
        '<linearGradient id="vshine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/>'
        '<stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>')
def stacked(with_url):
    h = ch_outro if with_url else ch_intro
    s = (f'<svg class="vlogo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cw:.1f} {h:.1f}">{DEFS}'
         + mark_group(markx, 0)
         + f'<g class="vword" transform="translate({wordx:.1f},{wordy:.1f}) scale({ws:.5f})">{word["paths"]}</g>'
         + f'<g class="vsub" transform="translate({subx:.1f},{suby:.1f}) scale({ss:.5f})">{sub["paths"]}</g>')
    if with_url:
        up = url["paths"].replace('class="vs"', 'class="vu"')
        s += f'<g class="vurl" transform="translate({urlx:.1f},{urly:.1f}) scale({us:.5f})">{up}</g>'
    return s + '</svg>'
# ---------- horizontal lockup (nav proportions) ----------
L = F['lockup']; lws = L['size']/1000
PADH = 40
horizontal = (f'<svg class="vlogo" xmlns="http://www.w3.org/2000/svg" viewBox="{-PADH} {-PADH} {L["w"]+2*PADH:.1f} {L["h"]+2*PADH:.1f}">{DEFS}'
              + mark_group(0, 0)
              + f'<g class="vword" transform="translate({L["textX"]:.1f},{L["baseline"]:.1f}) scale({lws:.5f})">{word["paths"]}</g></svg>')
markonly = (f'<svg class="vlogo" xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 880 603">{DEFS}' + mark_group(0, 0) + '</svg>')

CSS = r"""
:root { --ease-out: cubic-bezier(.16,1,.3,1); }
.vlogo { display:block; overflow:visible; }
.vword { fill: var(--v-text, currentColor); }
.vsub, .vurl { fill: var(--v-muted, #8b949e); }
.vsheen { transform: translateX(0); }
@media (prefers-reduced-motion: no-preference) {
  .vlogo.anim .vm-a { animation: vm-in-a 680ms var(--ease-out) 0ms both; }
  .vlogo.anim .vm-b { animation: vm-in-b 680ms var(--ease-out) 80ms both; }
  .vlogo.anim .vsheen { animation: vsheen 560ms cubic-bezier(.45,0,.2,1) 560ms both; }
  .vlogo.anim .vl { animation: vl-in 460ms var(--ease-out) calc(760ms + var(--i) * 26ms) both; }
  .vlogo.anim .vs { animation: vs-in 520ms ease-out 1150ms both; }
  .vlogo.anim .vu { animation: vs-in 450ms ease-out 1550ms both; }
  .vlogo.anim.loop { animation: vfade 420ms ease-in 2320ms both; }
  .vlogo.anim.out-only .vm-a, .vlogo.anim.out-only .vm-b, .vlogo.anim.out-only .vl, .vlogo.anim.out-only .vs, .vlogo.anim.out-only .vsheen { animation: none; }
}
@keyframes vm-in-a { from { opacity:0; transform: translate(-130px,-70px); } 55% { opacity:1; } to { opacity:1; transform: translate(0,0); } }
@keyframes vm-in-b { from { opacity:0; transform: translate(130px,-70px); }  55% { opacity:1; } to { opacity:1; transform: translate(0,0); } }
@keyframes vsheen  { from { transform: translateX(0); } to { transform: translateX(1420px); } }
@keyframes vl-in   { from { opacity:0; transform: translateY(90px); } to { opacity:1; transform: translateY(0); } }
@keyframes vs-in   { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
@keyframes vfade   { from { opacity:1; } to { opacity:0; } }
"""
open('out/virtuse-logo-anim.css', 'w').write(CSS.strip() + '\n')

PAGE = """<!doctype html><html><head><meta charset="utf-8"><title>Virtuse logo animation</title>
<script>
(function(){var q=new URLSearchParams(location.search);var h=document.documentElement;
h.dataset.variant=q.get('variant')||'intro';h.dataset.layout=q.get('layout')||'stacked';h.dataset.theme=q.get('theme')||'dark';
h.style.setProperty('--size',(q.get('size')||'')+'');if(q.get('sub')==='0'){h.dataset.sub='0';}})();
</script>
<style>
html,body{margin:0;height:100%;}
body{display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:hidden;background:#08090a;}
html[data-theme=light] body{background:#ffffff;--v-text:#0d0d0d;--v-muted:#666666;}
html[data-theme=transparent] body{background:transparent;}
html[data-theme=dark] body{--v-text:#e6edf3;--v-muted:#8b949e;}
.stage{display:flex;align-items:center;justify-content:center;width:100%;height:100%;}
.lay{display:none;}
html[data-sub='0'] .vsub{display:none;}
html[data-layout=stacked] .lay-stacked,html[data-layout=outro] .lay-outro,html[data-layout=horizontal] .lay-horizontal,html[data-layout=mark] .lay-mark{display:block;}
.lay-stacked .vlogo,.lay-outro .vlogo{width:var(--size,58vw);}
.lay-horizontal .vlogo{width:var(--size,62vw);}
.lay-mark .vlogo{width:var(--size,58vw);}
__CSS__
</style></head><body><div class="stage">
<div class="lay lay-stacked">__STACKED__</div>
<div class="lay lay-outro">__OUTRO__</div>
<div class="lay lay-horizontal">__HORIZ__</div>
<div class="lay lay-mark">__MARK__</div>
</div>
<script>
(function(){var v=document.documentElement.dataset.variant;
document.querySelectorAll('.vlogo').forEach(function(s){ if(v!=='static'){s.classList.add('anim');} if(v==='loop'){s.classList.add('loop');} });
})();
</script></body></html>"""
import re
def uid(svg, sfx):
    return re.sub(r'(id="|url\(#)(vlgA|vlgB|vclip|vshine)', lambda m: m.group(1)+m.group(2)+sfx, svg)
html = (PAGE.replace('__CSS__', CSS).replace('__STACKED__', uid(stacked(False),'S')).replace('__OUTRO__', uid(stacked(True),'O'))
        .replace('__HORIZ__', uid(horizontal,'H')).replace('__MARK__', uid(markonly,'M')))
open('out/logo-anim.html', 'w').write(html)
# web deliverable: lockup svg with animation classes (same as horizontal, no padding)
open('out/web-virtuse-logo-mark.svg', 'w').write(horizontal.replace('class="vlogo"', 'class="vlogo anim" role="img" aria-label="Virtuse"').replace(f'viewBox="{-PADH} {-PADH}', 'viewBox="0 0').replace(f'{L["w"]+2*PADH:.1f} {L["h"]+2*PADH:.1f}"', f'{L["w"]:.1f} {L["h"]:.1f}"'))
print('stacked', round(cw), round(ch_intro), round(ch_outro), 'word scale', round(ws,4), 'page bytes', len(html))
