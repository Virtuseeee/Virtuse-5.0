#!/usr/bin/env python3
"""Wire a new language into the Layer 2 modules (project + site).  Idempotent.

  pages.py <lang> meta/<lang>.json

meta/<lang>.json:
  {"locale": "fr_FR",
   "project": {"concierge": ["<short title>", "<meta description>"], "stacking": [...], "loan": [...], "tax-agent": [...]},
   "site":    {"concierge": ["<page title | Virtuse>", "<description/OG>"], ...}}

Does: project <lang>-<module>.html entries (from sk-*), vite.config.ts inputs, MODULE_LANGS in
src/lib/i18n.ts and in the site's concierge-launcher.js, site <lang>/<module>.html shells (from
sk/, assets are added later by deploy.py), hreflang on every module shell, and on the site's
<lang>/*.html pages: ../concierge|stacking|loan|tax-agent.html -> local + the launcher <script>.
Does NOT: translate the launcher bubble text (add a COPY block in concierge-launcher.js by hand).
"""
import sys, os, re, json, glob
sys.path.insert(0, os.path.dirname(__file__)); from _paths import SITE, PROJECT, MODULES, site_shell
lang, meta = sys.argv[1], json.load(open(sys.argv[2], encoding='utf-8'))
assert re.fullmatch(r'[a-z]{2}', lang) and lang not in ('en', 'sk', 'cs')
def R(p): return open(p, encoding='utf-8').read()
def W(p, s): open(p, 'w', encoding='utf-8').write(s); print('  wrote', os.path.relpath(p, os.path.dirname(SITE)))
def attr(s, sel, val):
    return re.sub(r'(<meta ' + re.escape(sel) + r' content=")[^"]*(")', lambda m: m.group(1) + val + m.group(2), s, count=1)

print('project entries')
for mod in MODULES:
    p = os.path.join(PROJECT, f'{lang}-{mod}.html')
    if os.path.exists(p): continue
    title, desc = meta['project'][mod]
    s = R(os.path.join(PROJECT, f'sk-{mod}.html')).replace('<html lang="sk">', f'<html lang="{lang}">', 1)
    s = re.sub(r'<title>.*?</title>', lambda m: f'<title>{title}</title>', s, count=1)
    W(p, attr(s, 'name="description"', desc))
vp = os.path.join(PROJECT, 'vite.config.ts'); v = R(vp)
names = {'concierge': 'Main', 'stacking': 'Stacking', 'tax-agent': 'Tax', 'loan': 'Loan'}
add = ''.join(f'        {lang}{names[m]}: path.resolve(__dirname, "{lang}-{m}.html"),\n' for m in MODULES if f'"{lang}-{m}.html"' not in v)
if add:
    anchor = v.rindex('path.resolve(__dirname, "'); anchor = v.index('\n', anchor) + 1
    W(vp, v[:anchor] + add + v[anchor:])
ip = os.path.join(PROJECT, 'src/lib/i18n.ts'); s = R(ip)
m = re.search(r"export const MODULE_LANGS: Lang\[\] = \[([^\]]*)\];", s)
if f"'{lang}'" not in m.group(1):
    W(ip, s[:m.end(1)] + f", '{lang}'" + s[m.end(1):])
lp = os.path.join(SITE, 'concierge-launcher.js'); s = R(lp)
m = re.search(r"var MODULE_LANGS = \[([^\]]*)\];", s)
if f"'{lang}'" not in m.group(1):
    W(lp, s[:m.end(1)] + f", '{lang}'" + s[m.end(1):])
if not re.search(r'\n    ' + lang + r': \{', s):
    print(f'  !! concierge-launcher.js has no COPY block for {lang} -- add it by hand (bubble text falls back to EN)')

print('site shells')
os.makedirs(os.path.join(SITE, lang), exist_ok=True)
for mod in MODULES:
    p = os.path.join(SITE, lang, f'{mod}.html')
    if os.path.exists(p): continue
    title, desc = meta['site'][mod]
    s = R(os.path.join(SITE, 'sk', f'{mod}.html')).replace('<html lang="sk">', f'<html lang="{lang}">', 1)
    s = re.sub(r'<title>.*?</title>', lambda m: f'<title>{title}</title>', s, count=1)
    for sel in ('name="description"', 'property="og:description"', 'name="twitter:description"'): s = attr(s, sel, desc)
    for sel in ('property="og:title"', 'name="twitter:title"'): s = attr(s, sel, title)
    s = s.replace(f'content="https://virtuse.com/sk/{mod}.html"', f'content="https://virtuse.com/{lang}/{mod}.html"')
    s = s.replace('content="sk_SK"', f'content="{meta["locale"]}"')
    s = '\n'.join(l for l in s.split('\n') if 'concierge-assets/' not in l)
    W(p, s)

print('hreflang on all module shells')
langs = ['en'] + sorted({os.path.basename(os.path.dirname(p)) for p in glob.glob(os.path.join(SITE, '*', 'concierge.html'))},
                        key=lambda l: ['sk', 'cs', 'uk', 'ru', 'de', 'fr', 'es', 'pl', 'hu'].index(l) if l in ['sk', 'cs', 'uk', 'ru', 'de', 'fr', 'es', 'pl', 'hu'] else 99)
for mod in MODULES:
    u = lambda l: f'https://virtuse.com/{mod}.html' if l == 'en' else f'https://virtuse.com/{l}/{mod}.html'
    block = '\n'.join(f'<link rel="alternate" hreflang="{l}" href="{u(l)}">' for l in langs) + f'\n<link rel="alternate" hreflang="x-default" href="{u("en")}">'
    for l in langs:
        p = os.path.join(SITE, site_shell(l, mod)); s = R(p)
        m = re.search(r'(<link rel="alternate" hreflang="[^"]+" href="[^"]+">\n)*<link rel="alternate" hreflang="x-default" href="[^"]+">', s)
        n = s[:m.start()] + block + s[m.end():]
        if n != s: W(p, n)

print(f'{lang}/ site pages: tool links + launcher')
TAG = '<script src="../concierge-launcher.js" defer></script>'
nlinks = 0
for p in sorted(glob.glob(os.path.join(SITE, lang, '*.html'))):
    base = os.path.basename(p)[:-5]
    if base in MODULES: continue
    s = R(p); o = s
    s, k = re.subn(r'\.\./(concierge|stacking|loan|tax-agent)\.html', r'\1.html', s); nlinks += k
    if base != '404' and TAG not in s:
        assert s.count('</body>') == 1, p
        s = s.replace('</body>', TAG + '\n</body>')
    # the bubble opens concierge.html in an iframe: the page CSP must allow it
    if base != '404' and "frame-src 'self'" not in s and 'frame-src ' in s:
        s = s.replace('frame-src ', "frame-src 'self' ", 1)
    if s != o: W(p, s)
print(f'done: {nlinks} links repointed. Next: gen_chrome.py, npm run build, deploy.py')
