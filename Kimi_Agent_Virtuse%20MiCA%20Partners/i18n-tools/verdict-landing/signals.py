# -*- coding: utf-8 -*-
"""Sample plan behind the landing (hero bars, Signals rows, radar): the same
borrow-against-BTC plan as the hero card, 55/100, weakest = Liquidity."""
import math

SCORES = [7, 6, 5, 6, 2, 7, 4, 6, 5, 7]   # sum 55
WEAK = 4
GROUPS = [(0, 3, 'var(--blue)'), (3, 7, 'var(--orange)'), (7, 10, 'var(--teal)')]
TXT = {
  'en': {'groups': [('Intent', 'Do you know why?'), ('Survival', 'Does it survive?'), ('Discipline', 'Will you stick to it?')],
         'names': ['Goal', 'Time horizon', 'Alternatives', 'Worst case', 'Liquidity', 'Custody & inheritance', 'Tax', 'Rule, not emotion', 'Plan B', 'Asymmetry'],
         'short': ['Goal', 'Horizon', 'Alternatives', 'Worst case', 'Liquidity', 'Custody', 'Tax', 'Rule', 'Plan B', 'Asymmetry'],
         'q': ['Do you know what this Bitcoin move is for?', 'When do you need the money again?', 'What else did you consider before this plan?',
               'What happens if BTC falls about 70%?', 'Do you know your liquidation price and cash need?', 'Who holds the keys, and who gets them?',
               'Have you checked the tax hit in your country?', 'Is there a written rule for buys and sells?', "What's the exit if the thesis breaks?",
               'Is the upside worth the downside you are taking?'],
         'sr': 'Sample plan, 55 out of 100. Signal scores out of 10: ', 'weak': 'weakest'},
  'sk': {'groups': [('Zámer', 'Viete prečo?'), ('Prežitie', 'Prežije to?'), ('Disciplína', 'Vydržíte pri tom?')],
         'names': ['Cieľ', 'Časový horizont', 'Alternatívy', 'Najhorší prípad', 'Likvidita', 'Úschova a dedičstvo', 'Dane', 'Pravidlo namiesto emócií', 'Plán B', 'Asymetria'],
         'short': ['Cieľ', 'Horizont', 'Alternatívy', 'Najhorší prípad', 'Likvidita', 'Úschova', 'Dane', 'Pravidlo', 'Plán B', 'Asymetria'],
         'q': ['Viete, na čo je tento krok s Bitcoinom?', 'Kedy budete peniaze opäť potrebovať?', 'Čo iné ste zvažovali pred týmto plánom?',
               'Čo sa stane, ak BTC padne asi o 70 %?', 'Poznáte svoju likvidačnú cenu a potrebu hotovosti?', 'Kto drží kľúče a kto ich dostane?',
               'Overili ste si daňový dopad vo vašej krajine?', 'Máte napísané pravidlo pre nákupy a predaje?', 'Aký je východ, ak sa vaša téza nepotvrdí?',
               'Stojí možný zisk za riziko, ktoré beriete?'],
         'sr': 'Ukážkový plán, 55 zo 100. Skóre signálov z 10: ', 'weak': 'najslabší'},
}

def esc(s): return s.replace('&', '&amp;')

def hero_bars():
    return ''.join('<i%s style="height:%d%%"></i>' % (' class="lo"' if k == WEAK else '', max(14, v * 10)) for k, v in enumerate(SCORES))

def groups(lang):
    T = TXT[lang]; out = []
    for g, (a, b, col) in enumerate(GROUPS):
        k, h = T['groups'][g]
        rows = ''.join('<li class="sig-row%s"><div><b>%s</b><span>%s</span></div><div class="sig-val"><i><em style="width:%d%%"></em></i><b>%d</b></div></li>' % (
            ' weak' if i == WEAK else '', esc(T['names'][i]), esc(T['q'][i]), SCORES[i] * 10, SCORES[i]) for i in range(a, b))
        out.append('<div class="sig-group" style="--c: %s"><div class="k">%s</div><h3>%s</h3><ul>%s</ul></div>' % (col, k, h, rows))
    return '\n'.join(out)

def radar(lang):
    T = TXT[lang]; cx, cy, R, n = 230, 200, 130, len(SCORES)
    ang = lambda i: -math.pi / 2 + 2 * math.pi * i / n
    pt = lambda i, r: (cx + r * math.cos(ang(i)), cy + r * math.sin(ang(i)))
    rings = ''.join('<polygon class="rg" points="%s"/>' % ' '.join('%.1f,%.1f' % pt(i, R * f) for i in range(n)) for f in (0.25, 0.5, 0.75, 1))
    spokes = ''.join('<line class="sp" x1="%d" y1="%d" x2="%.1f" y2="%.1f"/>' % ((cx, cy) + pt(i, R)) for i in range(n))
    poly = ' '.join('%.1f,%.1f' % pt(i, R * v / 10) for i, v in enumerate(SCORES))
    dots = ''.join('<circle class="dt%s" cx="%.1f" cy="%.1f" r="4"/>' % ((' wk' if i == WEAK else '',) + pt(i, R * v / 10)) for i, v in enumerate(SCORES))
    labels = []
    for i, v in enumerate(SCORES):
        x, y = pt(i, R + 26); c = math.cos(ang(i))
        anchor = 'middle' if abs(c) < 0.2 else ('start' if c > 0 else 'end')
        labels.append('<text class="lb%s" x="%.1f" y="%.1f" text-anchor="%s"><tspan>%s</tspan><tspan class="sc" x="%.1f" dy="15">%d</tspan></text>' % (
            ' wk' if i == WEAK else '', x, y - 4, anchor, esc(T['short'][i]), x, v))
    sr = T['sr'] + ', '.join('%s %d%s' % (T['names'][i], v, ' (' + T['weak'] + ')' if i == WEAK else '') for i, v in enumerate(SCORES)) + '.'
    return ('<svg viewBox="-40 -6 540 422" role="img" aria-label="%s">%s%s<polygon class="ar" points="%s"/>%s%s</svg>' % (
        esc(sr), rings, spokes, poly, dots, ''.join(labels)))
