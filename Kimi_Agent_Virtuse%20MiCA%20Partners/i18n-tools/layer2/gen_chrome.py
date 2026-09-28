# Generate src/lib/chrome.ts from each language's live homepage markup.
import re,html,json,sys
import sys, os
sys.path.insert(0, os.path.dirname(__file__)); from _paths import SITE, PROJECT
OUT=os.path.join(PROJECT, "src/lib/chrome.ts")
LANGS=['en','sk','cs','uk','ru','de','fr','es','pl','hu']
def txt(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',x))).strip()
def one(pat,s,flags=re.S):
    m=re.search(pat,s,flags); assert m,pat; return m
data={}
for l in LANGS:
    s=open(f"{SITE}/{'' if l=='en' else l+'/'}index.html",encoding='utf-8').read()
    ul=one(r'<ul class="nav-links"[^>]*>(.*?)</ul>',s).group(1)
    nav=[]
    for li in re.findall(r'<li>(.*?)</li>',ul,re.S):
        m=re.search(r'<a href="([^"]+)"[^>]*>.*?<span class="nav-link-label">(.*?)</span>',li,re.S)
        if m: nav.append({'href':html.unescape(m.group(1)),'label':txt(m.group(2))})
    assert len(nav)==11,(l,len(nav))
    cta=txt(one(r'<div class="nav-actions">.*?<button class="nav-cta">(.*?)</button>',s).group(1))
    ham=html.unescape(one(r'id="navHamburger" aria-label="([^"]+)"',s).group(1))
    lang_aria=html.unescape(one(r'id="langMenuBtn"[^>]*aria-label="([^"]+)"',s).group(1))
    cols=[]
    for h,body in re.findall(r'<div class="footer-col">\s*<h4>(.*?)</h4>(.*?)</div>',s,re.S):
        links=[{'href':html.unescape(a),'label':txt(b)} for a,b in re.findall(r'<a href="([^"]+)"[^>]*>(.*?)</a>',body,re.S)]
        cols.append({'h':txt(h),'links':links})
    assert len(cols)==5,(l,len(cols))
    fb=one(r'<div class="footer-bottom">(.*?)</div>',s).group(1)
    copyright=txt(one(r'<p>(.*?)</p>',fb).group(1))
    bm=one(r'<p class="footer-bottom-brief">(.*?)<a href="([^"]+)">(.*?)</a>',fb)
    data[l]={'nav':nav,'cta':cta,'ham':ham,'langAria':lang_aria,'cols':cols,'copyright':copyright,
             'briefLine':txt(bm.group(1)),'briefHref':html.unescape(bm.group(2)),'read':txt(bm.group(3))}
js=json.dumps(data,ensure_ascii=False,indent=2)
ts=("// Auto-generated from each language's homepage (index.html, <lang>/index.html)\n"
    "// nav + footer markup, so the module pages carry the exact same site chrome\n"
    "// (labels, hrefs relative to the language folder, footer columns).\n"
    "// Regenerate with i18n-tools/layer2/gen_chrome.py after homepage nav/footer changes.\n"
    "import type { Lang } from '@/lib/i18n';\n\n"
    "export interface ChromeLink { href: string; label: string }\n"
    "export interface ChromeCol { h: string; links: ChromeLink[] }\n"
    "export interface Chrome {\n  nav: ChromeLink[]; cta: string; ham: string; langAria: string;\n"
    "  cols: ChromeCol[]; copyright: string; briefLine: string; briefHref: string; read: string;\n}\n\n"
    "export const CHROME: Record<Lang, Chrome> = "+js+";\n")
open(OUT,'w',encoding='utf-8').write(ts)
for l in LANGS: print(l, data[l]['cta'],'|',data[l]['ham'],'|',data[l]['read'],'|',data[l]['copyright'][:40])
