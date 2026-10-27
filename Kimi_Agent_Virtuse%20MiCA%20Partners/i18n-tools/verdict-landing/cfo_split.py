# -*- coding: utf-8 -*-
"""Verdict and Virtuse CFO are separate products (Ras 2026-10-27): <lang>/cfo.html
loses the Verdict hero (form + sample verdict) and the Verdict scoring section;
the CFO section becomes the page's hero and links to the Verdict landing.
Edits the 10 built pages directly (the cfo/*.json strings lag the pages).
Idempotent. Usage (site folder): python3 i18n-tools/verdict-landing/cfo_split.py"""
import os, re
SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VLINK = {'en': 'Start with a free Verdict →', 'sk': 'Začnite bezplatným verdiktom →', 'cs': 'Začněte bezplatným verdiktem →',
         'de': 'Mit einem kostenlosen Verdict starten →', 'fr': 'Commencer par un Verdict gratuit →', 'es': 'Empiece con un Verdict gratuito →',
         'pl': 'Proszę zacząć od bezpłatnego Verdict →', 'hu': 'Kezdje egy ingyenes Verdicttel →', 'uk': 'Почніть із безкоштовного Verdict →',
         'ru': 'Начните с бесплатного Verdict →'}
OWN = ('en', 'sk', 'ru')   # languages with their own verdict.html
CSS = '<style>/* CFO alone (verdict-landing/cfo_split.py) */ .cfo-vlink{margin:14px 0 0;font-size:15px} .cfo-vlink a{color:var(--blue);text-decoration:none;border-bottom:1px solid rgba(95,174,222,.4)} .cfo-vlink a:hover{border-color:var(--blue)} #audit .wait{margin-top:18px} .c-hero h1.audit-h{font-size:clamp(32px,4.2vw,48px);font-weight:700;line-height:1.1} .c-hero h1.audit-h > .w,.c-hero h1.audit-h > span.w{color:var(--text);font-weight:700} .c-hero h1.audit-h > span:not(.w){font-weight:400}</style>\n</head>'

for L in VLINK:
    p = os.path.join(SITE, 'cfo.html' if L == 'en' else L + '/cfo.html')
    s = open(p, encoding='utf8').read(); o = s
    href = 'verdict.html' if L in OWN else '/verdict.html'
    if 'id="vdForm"' in s:
        a = s.index('<!-- 1. HERO = VERDICT'); b = s.index('<!-- 2. VIRTUSE CFO')
        hero = s[a:b]
        m = re.search(r'<form class="wait" id="waitForm".*?</form>', hero, re.S); assert m, L
        wait = m.group(0)
        s = s[:a] + s[b:]
        # the CFO section is the hero now: h1, the waitlist form and the way to Verdict
        s, n1 = re.subn(r'<h2 class="audit-h">(.*?)</h2>', r'<h1 class="audit-h">\1</h1>', s, count=1, flags=re.S)
        s, n2 = re.subn(r'<div class="hero-ctas only-wait"><a class="btn btn-primary" href="#waitForm">[^<]*</a></div>',
                        lambda _: wait + '\n      <p class="cfo-vlink"><a href="' + href + '">' + VLINK[L] + '</a></p>', s, count=1)
        # the old Verdict form script is dead code without the form
        s, n3 = re.subn(r'<script>\n// Verdict: the working form.*?</script>\n', '', s, count=1, flags=re.S)
        assert (n1, n2, n3) == (1, 1, 1), (L, n1, n2, n3)
    # pricing: the Verdict plan and the full report start on the Verdict page
    pr = s.index('<section id="pricing">'); pe = s.index('</section>', pr)
    seg = s[pr:pe]
    seg = re.sub(r'<a class="btn btn-ghost" href="#waitForm">[^<]*</a>', '<a class="btn btn-ghost" href="' + href + '">' + VLINK[L].rstrip(' →') + '</a>', seg, count=1)
    seg = seg.replace('href="#verdict"', 'href="' + href + '"')
    s = s[:pr] + seg + s[pe:]
    s = re.sub(r'<style>/\* CFO alone \(verdict-landing/cfo_split\.py\) \*/.*?</style>\n</head>', '</head>', s, flags=re.S)
    s = s.replace('</head>', CSS, 1)
    if s != o: open(p, 'w', encoding='utf8').write(s); print('split', L)
    else: print('unchanged', L)
