import re
css=open('out/virtuse-logo-anim.css').read()
anim=open('out/web-virtuse-logo-mark.svg').read()
static=open('out/virtuse-logo-mark.svg').read()
D='out/deliver/web/'
def selfcontained(color):
    i=anim.index('>')+1
    s=anim[:i]+'<title>Virtuse</title><style>'+css.replace('\n',' ')+'</style>'+anim[i:]
    return s.replace('class="vlogo anim"', f'class="vlogo anim" style="color:{color}"',1)
open(D+'virtuse-logo-mark-animated.svg','w').write(selfcontained('#e6edf3'))
open(D+'virtuse-logo-mark-animated-on-light.svg','w').write(selfcontained('#0d0d0d'))
open(D+'virtuse-logo-mark.svg','w').write(static)
open(D+'virtuse-logo-anim.css','w').write(css)
demo=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Virtuse logo animation demo</title>
<style>
{css}
body{{margin:0;font-family:Inter,system-ui,sans-serif;background:#08090a;color:#e6edf3}}
section{{padding:48px;border-bottom:1px solid rgba(255,255,255,.08)}}
section.light{{background:#fff;color:#0d0d0d}}
h2{{font-size:13px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin:0 0 20px}}
.hdr{{height:34px}} .hdr svg{{height:34px;width:auto}}
.loader{{display:flex;align-items:center;justify-content:center;height:220px}} .loader svg{{width:260px}}
button{{margin-top:16px;background:none;border:1px solid currentColor;color:inherit;padding:8px 14px;border-radius:8px;cursor:pointer}}
</style></head><body>
<section><h2>Header lockup, dark (inline SVG, plays once on load)</h2><div class="hdr">{anim}</div><button onclick="replay(this)">Replay</button></section>
<section class="light"><h2>Header lockup, light</h2><div class="hdr">{anim}</div><button onclick="replay(this)">Replay</button></section>
<section><h2>Loader pattern (same SVG, larger)</h2><div class="loader">{anim}</div></section>
<section><h2>As &lt;img&gt; (self-contained SVG, CSS embedded)</h2><img src="virtuse-logo-mark-animated.svg" alt="Virtuse" style="height:34px"></section>
<section class="light"><h2>As &lt;img&gt; on light</h2><img src="virtuse-logo-mark-animated-on-light.svg" alt="Virtuse" style="height:34px"></section>
<section><h2>Reduced motion</h2><p style="font-size:14px;opacity:.7">With <code>prefers-reduced-motion: reduce</code> every animation is skipped and the static lockup renders immediately.</p></section>
<script>function replay(btn){{var svg=btn.parentElement.querySelector('svg');var c=svg.cloneNode(true);svg.replaceWith(c);}}</script></body></html>'''
open(D+'demo.html','w').write(demo)
r=open(D+'README.md').read().replace("- virtuse-logo-mark-animated.svg — same lockup with the animation CSS embedded. Plays once when loaded, also as `<img src>` (no script needed). Honors `prefers-reduced-motion` (static logo).",
"- virtuse-logo-mark-animated.svg / -on-light.svg — same lockup with the animation CSS embedded (text colour fixed for dark / light backgrounds). Plays once when loaded, also as `<img src>` (no script needed). Honors `prefers-reduced-motion` (static logo).")
open(D+'README.md','w').write(r); print('web rebuilt')
