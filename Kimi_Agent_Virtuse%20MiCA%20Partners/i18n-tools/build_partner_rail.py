"""Rebuild the "You're in good company" partner rail on the 10 homepages from data/partners.json.
Rule: partners = exactly those with a card on a category page; memberships (none since 2026-10-06, Finas removed) are shown at the end of row 2 but not counted.
Run: python3 i18n-tools/build_partner_rail.py (idempotent)."""
import json, re, sys, html as H
import os
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # site folder (script lives in i18n-tools/)
_D = json.load(open(os.path.join(SITE,'data','partners.json'), encoding='utf-8'))
P = [(p['name'],p['category'],p['logo'],p['page']) for p in _D['partners']]
MEMBERS = _D.get('memberships', [])
ROW1 = [p for p in P if p[1] in ("buy","custody","treasury")]
ROW2 = [p for p in P if p[1] in ("loans","tax","bots","mining")]
assert len(P)==22 and len(ROW1)==11 and len(ROW2)==11

def link(p, pre, hidden):
    n,c,l,pg = p
    ti = ' tabindex="-1"' if hidden else ''
    return (f'        <a href="{pg}"{ti} class="co-logo co-partner">'
            f'<img src="{pre}{l}" alt="" width="28" height="28" decoding="async">'
            f'<span>{H.escape(n)}</span></a>')

def member(m, hidden):
    ti = ' tabindex="-1"' if hidden else ''
    return (f'        <a href="{m["url"]}" target="_blank" rel="noopener noreferrer"{ti} '
            f'class="co-logo co-finas" title="{m["title"]}">{H.escape(m["name"])}</a>')

def ticker(n, rows, pre, extra=False):
    out = [f'  <div class="co-ticker co-ticker-{n}">','    <div class="co-row">']
    for hidden in (False, True):
        out.append('      <div class="co-set" aria-hidden="true">' if hidden else '      <div class="co-set">')
        out += [link(p, pre, hidden) for p in rows]
        if extra: out += [member(m, hidden) for m in MEMBERS]
        out.append('      </div>')
    out += ['    </div>','  </div>']
    return '\n'.join(out)

NEW_CSS = """.co-partner { display: inline-flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.co-partner img { width: 28px; height: 28px; border-radius: 7px; object-fit: contain; background: #fff; flex-shrink: 0; }
.co-partner img[src$="logo-invity.svg"] { padding: 4px; }
.co-finas { font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; }"""

def do(path, pre):
    path = os.path.join(SITE, path)
    s = open(path, encoding='utf-8').read()
    m = re.search(r'  <div class="co-ticker co-ticker-1">.*?\n  </div>\n</section>', s, re.S)
    assert m and s.count('class="co-ticker co-ticker-1"')==1, path
    block = ticker(1, ROW1, pre) + '\n' + ticker(2, ROW2, pre, True) + '\n  </div>\n</section>'
    s = s[:m.start()] + block + s[m.end():]
    if '.co-partner {' not in s:
        c = re.search(r'\.co-firefish \{[^}]*\}.*?\.co-cryptocom span \{[^}]*\}', s, re.S)
        assert c, path+' css'
        s = s[:c.start()] + NEW_CSS + s[c.end():]
    open(path,'w',encoding='utf-8').write(s)
    print('OK', path)

do('index.html','')
for l in "sk cs de es fr hu pl ru uk".split():
    do(f'{l}/index.html','../')
