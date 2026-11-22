#!/usr/bin/env python3
"""Tax Calculator in the Tools menu and the footer Tools column, right after Tax & Inheritance Agent.

One-off, idempotent (same pattern as nav_ecosystem.py). The calculator exists in English and Slovak
(bitcoin-tax-calculator.html, sk/bitcoin-tax-calculator.html). The other eight languages get the item
in their own language, linked to the English page; the menu description says so.

  python3 nav_tax_calculator.py            sources: index.html + cfo.html (English nav sources), the homepage
                                           and CFO translation files (home/, cfo/), seo-build/data/chrome-v2.json
  python3 nav_tax_calculator.py --built    also patch every built page that carries the v2 menu
  python3 nav_tax_calculator.py --check    list built pages with the Tools menu but without the item

A later rebuild gives the same links: build_lang.py / build_cfo.py keep a relative link when the page
exists in the language folder (sk) and write ../bitcoin-tax-calculator.html otherwise; the builders that
take the chrome from the homepage (v2common, fee-index) turn both into root-absolute paths.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
REPO = os.path.dirname(SITE)
PAGE = 'bitcoin-tax-calculator.html'
OWN = ('en', 'sk')   # languages with their own calculator page
T = {   # menu title, menu description (one line, like the other items)
    'en': ('Tax Calculator', 'Tax on a Bitcoin sale, 13 countries'),
    'sk': ('Daňová kalkulačka', 'Daň z predaja Bitcoinu, 13 krajín'),
    'cs': ('Daňová kalkulačka', 'Daň z prodeje Bitcoinu, 13 zemí · anglicky'),
    'de': ('Steuerrechner', 'Steuer beim Bitcoin-Verkauf, 13 Länder · auf Englisch'),
    'fr': ('Calculateur d’impôt', 'Impôt sur une vente de Bitcoin, 13 pays · en anglais'),
    'es': ('Calculadora de impuestos', 'Impuesto por vender Bitcoin, 13 países · en inglés'),
    'pl': ('Kalkulator podatku', 'Podatek od sprzedaży Bitcoina, 13 krajów · po angielsku'),
    'hu': ('Adókalkulátor', 'Bitcoin-eladás adója, 13 ország · angolul'),
    'uk': ('Податковий калькулятор', 'Податок із продажу Біткоїна, 13 країн · англійською'),
    'ru': ('Налоговый калькулятор', 'Налог с продажи Биткоина, 13 стран · на английском'),
}
NAV = re.compile(r'<a href="([^"]*)tax-agent\.html[^"]*"[^>]*><span class="nd-t">.*?</a>', re.S)
FOOT = re.compile(r'<a href="([^"]*)tax-agent\.html[^"]*"[^>]*>[^<]*</a>')


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def href(L, prefix):
    """prefix = what stands before tax-agent.html in the same menu: '', '/', '/de/' ..."""
    if L in OWN:
        return prefix + PAGE
    return ('../' if prefix == '' else '/') + PAGE


def patch(html, L):
    title, desc = T[L]
    i = html.find('id="nd-tools"')
    if i >= 0:
        j = html.index('</div>', i)
        m = NAV.search(html, i, j)
        plain = not m   # operator.html / how-we-earn.html: hand-made pages, menu items without descriptions
        m = m or FOOT.search(html, i, j)
        if not m:
            raise SystemExit('Tools menu without the Tax Agent item')
        if PAGE in html[i:j]:
            m = None
    if i >= 0 and m:
        item = ('<a href="%s">%s</a>' % (href(L, m.group(1)), esc(title)) if plain else
                '<a href="%s"><span class="nd-t">%s</span><span class="nd-d">%s</span></a>' % (href(L, m.group(1)), esc(title), esc(desc)))
        html = html[:m.end()] + item + html[m.end():]
    i = html.find('<div class="footer-columns">')
    if i >= 0:
        j = html.index('</footer>', i)
        m = FOOT.search(html, i, j)
        if m and not re.search(r'<a href="[^"]*%s">%s</a>' % (re.escape(PAGE), re.escape(esc(title))), html[i:j]):
            html = html[:m.end()] + '<a href="%s">%s</a>' % (href(L, m.group(1)), esc(title)) + html[m.end():]
    return html


def strings(folder):
    """English nav texts -> translations for the homepage / CFO builders (existing keys are kept)."""
    d = os.path.join(HERE, folder)
    en_p = os.path.join(d, 'en_strings.json')
    en = json.load(open(en_p, encoding='utf-8'))
    have = {x['en'] for x in en}
    for k in T['en']:
        if k not in have:
            en.append({'en': k, 'kind': 'text', 'context': 'Tools menu: tax calculator'})
    open(en_p, 'w', encoding='utf-8').write(json.dumps(en, ensure_ascii=False, indent=1))
    for L in [x for x in T if x != 'en']:
        p = os.path.join(d, L + '.json')
        tr = json.load(open(p, encoding='utf-8'))
        for k, v in zip(T['en'], T[L]):
            if k in tr and tr[k] != v:
                raise SystemExit('%s/%s: "%s" already translated differently' % (folder, L, k))
            tr.setdefault(k, v)
        open(p, 'w', encoding='utf-8').write(json.dumps(tr, ensure_ascii=False, indent=1))


def chrome_json():
    p = os.path.join(REPO, 'seo-build/data/chrome-v2.json')
    c = json.load(open(p, encoding='utf-8'))
    for L in T:
        c[L]['nav'] = patch(c[L]['nav'], L)
        c[L]['foot'] = patch(c[L]['foot'], L)
    open(p, 'w', encoding='utf-8').write(json.dumps(c, ensure_ascii=False, indent=1) + '\n')


def pages():
    for root, dirs, files in os.walk(SITE):
        if os.path.relpath(root, SITE).startswith(('i18n-tools', 'research', 'brand')):
            continue
        for f in files:
            if f.endswith('.html'):
                p = os.path.join(root, f)
                h = open(p, encoding='utf-8', newline='').read()
                if 'id="nd-tools"' in h:
                    yield p, h


def built(check=False):
    n = 0
    for p, h in pages():
        L = re.search(r'<html lang="([a-z]{2})', h).group(1)
        new = patch(h, L)
        if new != h:
            n += 1
            if check:
                print('needs it:', os.path.relpath(p, SITE))
            else:
                open(p, 'w', encoding='utf-8', newline='').write(new)
    print('built pages %s: %d' % ('without the item' if check else 'patched', n))
    return n


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(1 if built(check=True) else 0)
    for f in ('index.html', 'cfo.html'):
        p = os.path.join(SITE, f)
        h = open(p, encoding='utf-8').read()
        new = patch(h, 'en')
        # the English sources use relative links
        open(p, 'w', encoding='utf-8').write(new)
    strings('home')
    strings('cfo')
    chrome_json()
    if '--built' in sys.argv:
        built()
    print('Tax Calculator added to index.html, cfo.html, home/ + cfo/ strings, chrome-v2.json')
