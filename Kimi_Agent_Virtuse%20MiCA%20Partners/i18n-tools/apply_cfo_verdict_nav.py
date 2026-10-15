#!/usr/bin/env python3
"""Tools nav + footer item "Virtuse CFO" -> "Virtuse CFO · Verdict" with a "Free" badge
(handover "CFO + Verdict merge", 2026-10-15). Idempotent.

The homepages are rebuilt by i18n-tools/home (index.html + <lang>.json carry the new
label); the other v2 page pipelines copy nav + footer from the homepage, so their next
rebuild keeps it. This script updates the pages as they are now.

    python3 i18n-tools/apply_cfo_verdict_nav.py            # every page except */cfo.html
    python3 i18n-tools/apply_cfo_verdict_nav.py --with-cfo # also the cfo.html pages
                                                           # (run after the merged page lands)
"""
import glob, os, re, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FREE = {'Soon': 'Free', 'Čoskoro': 'Zadarmo', 'Brzy': 'Zdarma', 'Bald': 'Kostenlos', 'Bientôt': 'Gratuit',
        'Pronto': 'Gratis', 'Wkrótce': 'Bezpłatnie', 'Hamarosan': 'Ingyenes', 'Незабаром': 'Безкоштовно',
        'Скоро': 'Бесплатно'}
WORD = '|'.join(map(re.escape, FREE))
NAV = re.compile(r'(id="navCfo">)Virtuse CFO (<span class="nav-badge cfo-badge">)(%s)(</span></a>)' % WORD)
FOOT = re.compile(r'(<a href="[^"]*cfo\.html">)Virtuse CFO (<span class="soon cfo-foot-badge">)(%s)(</span></a>)' % WORD)
VB_SOON_NEW = re.compile(r'"soon": "[^"]*", "new": "[^"]*", ')
# cfo.html's own inline copy of the old badge script ("Soon"/"New" by stage)
STAGE_JS = re.compile(r"// Stage badges[^\n]*\n\(function \(\) \{\n  var audit = !document\.body\.classList\.contains\('stage-wait'\);\n"
                      r"  document\.querySelectorAll\('\.nav-badge, \.cfo-foot-badge'\)\.forEach\(function \(b\) \{ b\.textContent = audit \? '[^']*' : '[^']*'; \}\);\n\}\)\(\);\n")


def main():
    with_cfo = '--with-cfo' in sys.argv
    n = 0
    for path in sorted(glob.glob(os.path.join(SITE, '**', '*.html'), recursive=True)):
        rel = os.path.relpath(path, SITE)
        if rel.startswith('i18n-tools') or (os.path.basename(rel) == 'cfo.html' and not with_cfo):
            continue
        s0 = s = open(path, encoding='utf-8').read()
        s = NAV.sub(lambda m: m.group(1) + 'Virtuse CFO · Verdict ' + m.group(2) + FREE[m.group(3)] + m.group(4), s)
        s = FOOT.sub(lambda m: m.group(1) + 'Virtuse CFO · Verdict ' + m.group(2) + FREE[m.group(3)] + m.group(4), s)
        if os.path.basename(rel) == 'cfo.html':
            s = STAGE_JS.sub('', s)
        # site-v2.js no longer reads "soon"/"new"; the page builders stopped writing them
        s = VB_SOON_NEW.sub('', s)
        if s != s0:
            open(path, 'w', encoding='utf-8').write(s)
            n += 1
    left = [os.path.relpath(p, SITE) for p in glob.glob(os.path.join(SITE, '**', '*.html'), recursive=True)
            if not os.path.relpath(p, SITE).startswith('i18n-tools') and (with_cfo or os.path.basename(p) != 'cfo.html')
            and re.search(r'>Virtuse CFO <span class="(nav-badge cfo-badge|soon cfo-foot-badge)">', open(p, encoding='utf-8').read())]
    print(f'{n} pages updated; old label left on {len(left)} pages' + (f': {left[:5]}' if left else ''))
    return 1 if left else 0


if __name__ == '__main__':
    sys.exit(main())
