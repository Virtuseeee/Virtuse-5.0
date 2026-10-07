"""One primary step in the homepage hero (consultation), 9 translated homepages, mirroring EN index.html.
Hero: single consultation button + note + Partner Finder as a text link; nav CTA opens the consultation
widget; Brief strip moved under section.services; Partner Finder bubble only after the hero
(data-reveal="after-hero"). Idempotent: a page that already has .hero-cta-note is skipped.
Run: python3 i18n-tools/apply_hero_single_cta.py"""
import os, re
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = {  # button, note, alt question, nav label  (alt link text = the page's own banner CTA)
 'cs': ('Domluvit bezplatný hovor', '15 minut, zdarma, bez prodejních řečí.', 'Raději si služby porovnáte sami?', 'Domluvit hovor'),
 'sk': ('Dohodnúť bezplatný hovor', '15 minút, zadarmo, bez predaja.', 'Radšej si služby porovnáte sami?', 'Dohodnúť hovor'),
 'de': ('Kostenloses Gespräch buchen', '15 Minuten, kostenlos, ohne Verkaufsgespräch, auf Englisch.', 'Lieber selbst vergleichen?', 'Gespräch buchen'),
 'es': ('Reservar una llamada gratuita', '15 minutos, gratis, sin discurso de venta, en inglés.', '¿Prefiere comparar los servicios usted mismo?', 'Reservar llamada'),
 'fr': ('Réserver un appel gratuit', '15&nbsp;minutes, gratuit, sans discours commercial, en anglais.', 'Vous préférez comparer vous-même&nbsp;?', 'Réserver un appel'),
 'hu': ('Ingyenes hívás foglalása', '15 perc, ingyenes, értékesítési szöveg nélkül, angol nyelven.', 'Inkább maga hasonlítaná össze a szolgáltatásokat?', 'Hívás foglalása'),
 'pl': ('Umów bezpłatną rozmowę', '15 minut, bezpłatnie, bez sprzedaży, po angielsku.', 'Wolą Państwo porównać usługi samodzielnie?', 'Umów rozmowę'),
 'ru': ('Записаться на бесплатный звонок', '15 минут, бесплатно, без продаж, на английском.', 'Хотите сравнить сервисы сами?', 'Записаться'),
 'uk': ('Записатися на безкоштовний дзвінок', '15 хвилин, безкоштовно, без продажів, англійською.', 'Хочете порівняти сервіси самостійно?', 'Записатися'),
}
CSS_OLD = '.hero-buttons { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 40px; }'
CSS_NEW = '''.hero-buttons { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 14px; }
.hero-cta-note { font-size: 14px; color: var(--text-muted); margin: 0 0 22px; }
.hero-alt { margin: 0 0 40px; font-size: 15px; }
.hero-alt-link { color: var(--text); text-decoration: none; border-bottom: 1px solid var(--border-hover); padding-bottom: 2px; transition: border-color .2s ease; }
.hero-alt-link:hover { border-color: var(--text); }'''

def one(s, a, b):
    assert s.count(a) == 1, (s.count(a), a[:80]); return s.replace(a, b)

for lang, (btn, note, q, nav) in T.items():
    p = os.path.join(SITE, lang, 'index.html'); s = open(p, encoding='utf-8').read()
    if 'hero-cta-note' in s:
        print('skip', lang); continue
    # banner CTA text = the link text
    m = re.search(r'class="concierge-banner-cta"[^>]*>\s*([^<]+?)\s*<', s); assert m, lang
    find = m.group(1)
    # hero: drop the Partner Finder button, rename the consultation button, add note + text link
    hb = re.search(r'(      <div class="hero-buttons">\n        <button type="button" class="btn-primary" data-consultation-trigger data-consultation-lang="%s">\n          )([^\n]+)(\n.*?</button>)\n        <a [^>]*concierge-hero-cta">.*?</a>\n      </div>\n' % lang, s, re.S)
    assert hb, lang
    new = (hb.group(1) + btn + hb.group(3) + '\n      </div>\n'
           f'      <p class="hero-cta-note">{note}</p>\n'
           f'      <p class="hero-alt"><a href="concierge.html?utm_source=concierge&utm_medium=hero" class="hero-alt-link">{q} {find} <span aria-hidden="true">&rarr;</span></a></p>\n')
    s = s[:hb.start()] + new + s[hb.end():]
    # nav CTA -> consultation widget
    trig = f' data-consultation-trigger data-consultation-lang="{lang}"'
    s, n1 = re.subn(r'<button type="button" class="nav-cta nav-links-cta">[^<]*<svg', f'<button type="button" class="nav-cta nav-links-cta"{trig}>{nav}<svg', s); assert n1 == 1, lang
    s, n2 = re.subn(r'    <button class="nav-cta">[^<]*</button>', f'    <button type="button" class="nav-cta"{trig}>{nav}</button>', s); assert n2 == 1, lang
    s, n3 = re.subn(r'<!-- ===== GET STARTED: CONTEXTUAL SCROLL ===== -->\n<script>.*?</script>\n',
                    '<!-- Homepage only: the nav CTA opens the consultation widget (data-consultation-trigger), not concierge.html. -->\n', s, flags=re.S); assert n3 == 1, lang
    # bubble after the hero
    s = one(s, '<script src="../concierge-launcher.js" defer></script>', '<script src="../concierge-launcher.js" data-reveal="after-hero" defer></script>')
    # Brief strip under services
    start = s.index('<!-- ===== VIRTUSE BRIEF CAPTURE (primary) ===== -->')
    end = s.index('</section>', s.index('id="virtuse-brief"')) + len('</section>')
    block = s[start:end]; assert s[end:end+2] == '\n\n', lang
    s = s[:start] + s[end+2:]
    i = s.index('<section class="services'); j = s.index('</section>', i) + len('</section>')
    s = s[:j] + '\n\n' + block + s[j:]
    s = one(s, CSS_OLD, CSS_NEW)
    open(p, 'w', encoding='utf-8').write(s); print('ok', lang)
