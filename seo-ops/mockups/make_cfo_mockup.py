#!/usr/bin/env python3
"""MOCKUP: Virtuse CFO + Verdict on one page, built from sk/cfo.html -> sk/cfo-mockup.html."""
import re, sys
SITE = sys.argv[1]
s = open(SITE + '/sk/cfo.html').read()


def one(h, a, b):
    assert h.count(a) == 1, a[:80]
    return h.replace(a, b)


CSS = '''<style>
.vd-hero { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); gap: 48px; align-items: center; padding: 40px 0 24px; }
.vd-hero h1 { font-size: clamp(38px, 5vw, 62px); line-height: 1.05; letter-spacing: -0.03em; font-weight: 700; margin-top: 18px; }
.vd-hero h1 span { color: var(--muted); font-weight: 500; }
.vd-hero h1 .grad, .vd-hero h1 .grad .w { font-weight: 700; background: linear-gradient(90deg, var(--blue) 0%, var(--teal) 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.vd-lead { font-size: 18px; color: var(--muted); margin: 18px 0 22px; max-width: 560px; }
.vd-form { display: grid; gap: 12px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; max-width: 560px; }
.vd-form label { font-weight: 600; font-size: 14px; }
.vd-form textarea { resize: vertical; background: var(--inset); color: var(--text); border: 1px solid var(--line-strong); border-radius: 10px; padding: 14px; font: inherit; font-size: 16px; }
.vd-form .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
.vd-form .row span { font-size: 13px; color: var(--muted); }
.vd-card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 26px; display: grid; gap: 16px; }
.vd-card .top { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.vd-card .q { color: var(--muted); margin: 0; }
.vd-score { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.vd-score b { font-size: 72px; line-height: 0.9; letter-spacing: -0.04em; }
.vd-score b small { font-size: 22px; color: var(--muted); font-weight: 500; }
.vd-pill { display: inline-block; background: rgba(247,147,26,0.14); color: var(--orange); font-weight: 600; font-size: 13px; padding: 6px 12px; border-radius: 999px; }
.vd-sig { display: grid; grid-template-columns: 150px 1fr 24px; gap: 12px; align-items: center; font-size: 13px; color: var(--muted); }
.vd-sig .bar { height: 6px; background: var(--line-strong); border-radius: 3px; overflow: hidden; }
.vd-sig .bar i { display: block; height: 6px; border-radius: 3px; }
.vd-sig .v { text-align: right; font-variant-numeric: tabular-nums; }
.vd-weak { border-top: 1px solid var(--line); padding-top: 14px; font-size: 14px; color: var(--muted); }
.vd-weak a { color: var(--text); }
.vd-bands { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 16px; }
.vd-band { border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; }
.vd-band.hl { border-color: var(--orange); }
.vd-band b { font-size: 17px; display: block; }
.vd-band span { color: var(--muted); font-size: 13px; }
.vd-band p { margin: 6px 0 0; color: var(--muted); font-size: 15px; }
.vd-tools { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.vd-tools a { border: 1px solid var(--line-strong); border-radius: 999px; padding: 8px 14px; font-size: 14px; text-decoration: none; color: var(--text); }
.plan .layer { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.vd-more summary { list-style: none; cursor: pointer; } .vd-more summary::-webkit-details-marker { display: none; } .vd-more summary h2::after { content: ' +'; color: var(--muted); font-weight: 400; } .vd-more[open] summary h2::after { content: ' −'; } .vd-more summary + * { margin-top: 32px; }
.vd-limits ul { list-style: none; padding: 0; margin: 16px 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 12px; } .vd-limits li { border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; color: var(--muted); font-size: 15px; } .vd-limits li b { color: var(--text); }
</style>
'''
s = one(s, '</head>', CSS + '</head>')
s = one(s, '<title>Virtuse CFO: váš AI CFO pre Bitcoin | Virtuse</title>', '<title>Virtuse CFO · Verdict: over rozhodnutie o Bitcoine | Virtuse</title>')

# nav: one tools item
s = one(s, '<a href="cfo.html" aria-current="page" id="navCfo">Virtuse CFO <span class="nav-badge cfo-badge">Čoskoro</span></a>',
        '<a href="cfo-mockup.html" aria-current="page" id="navCfo">Virtuse CFO · Verdict <span class="nav-badge cfo-badge">zadarmo</span></a>')

SIG = [('Cieľ', 8), ('Časový horizont', 7), ('Alternatívy', 5), ('Najhorší scenár', 4), ('Likvidita', 5),
       ('Úschova a dedičstvo', 6), ('Dane', 3), ('Pravidlo, nie emócia', 7), ('Plán B', 4), ('Asymetria', 6)]
col = lambda v: 'var(--text)' if v >= 7 else ('var(--muted)' if v >= 5 else 'var(--orange)')
sig = '\n'.join('<div class="vd-sig"><span>%s</span><span class="bar"><i style="width:%d%%;background:%s"></i></span><span class="v">%d</span></div>' % (n, v * 10, col(v), v) for n, v in SIG)
score = sum(v for _, v in SIG)

VERDICT = '''<!-- 1. HERO = VERDICT (free entry into Virtuse CFO) -->
  <div class="vd-hero" id="verdict">
    <div>
      <div class="eyebrow">Virtuse CFO · Verdict · zadarmo, bez registrácie</div>
      <h1>Over rozhodnutie o Bitcoine. <span>Potom ho <span class="grad">CFO</span> sleduje za vás.</span></h1>
      <p class="vd-lead">Popíšte, čo chcete urobiť. Verdict ohodnotí vaše uvažovanie v 10 signáloch a ukáže najslabšie miesto. Nehodnotí Bitcoin ani partnerov. Hodnotí, či ste to premysleli.</p>
      <form class="vd-form" onsubmit="return false">
        <label for="vd-decision">Vaše rozhodnutie</label>
        <textarea id="vd-decision" rows="3" placeholder="Napríklad: chcem dať 20 %% hotovosti firmy do Bitcoinu a držať ho 5 rokov."></textarea>
        <div class="row"><span>Zadarmo. Bez registrácie. Nie je to poradenstvo.</span><button type="button" class="btn btn-primary">Získať verdikt zadarmo</button></div>
      </form>
    </div>
    <div class="vd-card" aria-label="Ukážka verdiktu">
      <div class="top"><span>Ukážka verdiktu</span><span>ilustračné čísla</span></div>
      <p class="q">„Chcem si požičať proti svojmu BTC na kúpu bytu.“</p>
      <div class="vd-score"><b>%(score)d<small>/100</small></b><div><span class="vd-pill">Doplňte 2 až 3 predpoklady</span></div></div>
      <div style="display:grid;gap:9px">
%(sig)s
      </div>
      <div class="vd-weak">Najslabšie miesto: neviete, pri akej cene by veriteľ predal váš zálohový Bitcoin. <a href="loan.html">Overiť v Loan Copilote</a></div>
    </div>
  </div>

  <section id="verdict-how">
    <div class="sec-head">
      <h2>Skóre hovorí o úvahe. <span>Nie o tom, či kúpiť.</span></h2>
      <p class="sec-sub">Každý plán prejde aj testom poklesu o 70 %%. Ak ho neprežije, viete to vopred.</p>
    </div>
    <div class="vd-bands">
      <div class="vd-band"><b>Úvaha je úplná</b><span>65 až 100</span><p>Pokryli ste podstatné. Ďalší krok je na vás.</p></div>
      <div class="vd-band hl"><b>Doplňte 2 až 3 predpoklady</b><span>50 až 64</span><p>Overte ich v nástrojoch nižšie, potom rozhodnite.</p></div>
      <div class="vd-band"><b>Chýbajú podstatné veci</b><span>0 až 49</span><p>Verdict vymenuje, ktoré to sú a prečo môžu byť drahé.</p></div>
    </div>
    <div class="vd-tools" aria-label="Nástroje na overenie predpokladov">
      <a href="loan.html">Loan &amp; Liquidity Copilot</a><a href="tax-agent.html">Tax &amp; Inheritance Agent</a><a href="stacking.html">Stacking Strategist</a><a href="retirement-calculator.html">Dôchodková kalkulačka</a>
    </div>
  </section>

  <!-- 2. VIRTUSE CFO: the free fee audit (was the hero) -->
  <section id="audit">
    <div class="sec-head">
      <h2>Virtuse CFO: <span>sleduje vaše čísla po rozhodnutí.</span></h2>
    </div>
''' % {'score': score, 'sig': sig}

# hero -> verdict hero + the old hero (audit) as section 2
s = one(s, '  <!-- 1. HERO = THE PRODUCT -->\n  <div class="c-hero">', VERDICT + '  <div class="c-hero">')
s = one(s, '\n\n  <!-- ASK YOUR CFO -->', '\n  </section>\n\n  <!-- ASK YOUR CFO -->')
s = one(s, '<h1>Váš AI <span class="grad">CFO</span> pre Bitcoin. <span>Číta vaše vlastné exporty a nikdy nevidí vašu peňaženku.</span></h1>',
        '<h2 style="font-size:34px;line-height:1.15">Koľko vás nákupy naozaj stáli? <span style="color:var(--muted);font-weight:500">Číta vaše exporty, nikdy nevidí peňaženku.</span></h2>')

# pricing: 3 columns per handover
plans_old = s[s.index('    <div class="plans3">'):s.index('    <div class="terms">')]
plans_new = '''    <div class="plans3">
      <div class="plan">
        <span class="layer">Vstup</span>
        <h3>Verdict</h3>
        <div class="price">0 € <small>bez registrácie</small></div>
        <p class="for">Skóre úvahy 0 až 100, pásmo a najslabšie miesto.</p>
        <ul><li>Hodnotenie rozhodnutia v 10 signáloch</li><li>Najslabšie miesto a odkaz na nástroj, kde ho overíte</li><li>Bezplatný audit poplatkov z exportu</li><li>Nie je to poradenstvo, nič neodporúča</li></ul>
        <a class="btn btn-ghost" href="#verdict">Získať verdikt zadarmo</a>
      </div>
      <div class="plan">
        <span class="layer">Jednorazovo</span>
        <h3>Plný report</h3>
        <div class="price">14 € <small>raz</small></div>
        <p class="for">Pre jedno rozhodnutie, ktoré chcete premyslieť do hĺbky.</p>
        <ul><li>Všetkých 10 signálov so zdôvodnením</li><li>Predpoklady, riziká a plán B</li><li>Otázky na zajtra</li><li>Bez predplatného</li></ul>
        <a class="btn btn-ghost" href="#verdict">Začať verdiktom</a>
      </div>
      <div class="plan pro">
        <span class="founding">Platené plány od januára, zakladateľská cena</span>
        <h3>Virtuse CFO</h3>
        <div class="price"><span data-m>9 € <small>/ mesiac</small></span><span data-y hidden>90 € <small>/ rok</small></span></div>
        <p class="for"><span data-m>Alebo 90 € ročne, 2 mesiace zadarmo.</span><span data-y hidden>To je 7,50 € mesačne pri ročnej platbe.</span></p>
        <ul><li>Neobmedzené verdikty a plné reporty</li><li>História rozhodnutí v čase</li><li>Rozhodnutia o Bitcoin treasury firmy</li><li>Upozornenia na poplatky a LTV pôžičky</li><li>Daňový prehľad, 13 krajín EÚ, a dedičský balík</li></ul>
        <a class="btn btn-primary" href="#waitForm">Dajte mi vedieť</a>
      </div>
    </div>
'''
s = s.replace(plans_old, plans_new)
s = one(s, '<h2>Začnite zadarmo. <span>Platíte, len ak to funguje.</span></h2>', '<h2>Jeden produkt, tri úrovne. <span>Začnite verdiktom zadarmo.</span></h2>')
s = one(s, 'Zrušiť môžete kedykoľvek. Na bezplatný audit nepotrebujete kartu.', 'Verdict aj audit poplatkov sú zadarmo a bez karty. Zrušiť môžete kedykoľvek.')

# FAQ: verdict questions first, unified prices
FAQ = '''<details open><summary>Povie mi Verdict, či mám kúpiť Bitcoin?</summary><p>Nie. Hodnotí, či je vaša úvaha úplná. Čo urobíte, je vaše rozhodnutie. Verdict neodporúča nákup, predaj, pôžičku ani partnera.</p></details>
      <details><summary>Koľko to stojí?</summary><p>Verdict je zadarmo. Plný report stojí 14 € jednorazovo. Verdict aj bezplatný audit poplatkov sú zadarmo od 1. novembra. Platený Virtuse CFO sa otvára v januári: 9 € mesačne alebo 90 € ročne a obsahuje neobmedzené verdikty aj reporty.</p></details>
      <details><summary>Odkiaľ Verdict berie fakty?</summary><p>Z oficiálnych zdrojov, ktoré Virtuse už používa, napríklad daňové pravidlá 13 krajín s dátumom kontroly. Keď fakt chýba, Verdict sa opýta.</p></details>
      <details><summary>Čo sa stane s tým, čo napíšem?</summary><p>Bez účtu sa nič neukladá. S účtom Virtuse CFO si históriu rozhodnutí uložíte a môžete ju kedykoľvek vymazať.</p></details>
      '''
s = one(s, '<h2>Otázky. <span>Skôr než niečo exportujete.</span></h2>', '<h2>Otázky <span>zákazníkov.</span></h2>')
s = one(s, '<details open><summary>Ako získam export z Krakenu?</summary>', FAQ + '<details><summary>Ako získam export z Krakenu?</summary>')
s = s.replace('<link rel="canonical" href="https://virtuse.com/sk/cfo.html">', '<link rel="canonical" href="https://virtuse.com/sk/cfo.html">')
# 1. one stage label in the audit section
s = one(s, '<div class="eyebrow"><span class="stage-k only-audit">Bezplatný audit · spustený od 1. nov.</span><span class="stage-k only-wait">Bezplatný audit · otvára sa 1. nov.</span></div>',
        '<div class="eyebrow">Bezplatný audit · od 1. novembra</div>')
# 2. no hardcoded waitlist count
s = one(s, '<p class="wait-count" id="waitCount"><b>136</b> ľudí na čakacej listine</p>', '')
# 4. fee sources + date, like the Fee Index
s = one(s, 'Ukážkový export a čísla na ilustráciu. Zverejnené poplatky typu taker pri bežnom trhovom nákupe; spready a poplatky za výber nie sú zahrnuté. *0 % od 8. dňa Auto-Invest. Nejde o investičné poradenstvo.',
        'Ukážkový export a čísla na ilustráciu. Zverejnené poplatky typu taker pri bežnom trhovom nákupe podľa stránok partnerov: <a href="https://www.kraken.com/features/fee-schedule" target="_blank" rel="noopener">Kraken</a>, <a href="https://www.bybit.eu/en-EU/help-center/article/Trading-Fee-Structure" target="_blank" rel="noopener">ByBit EU</a>, <a href="https://21bitcoin.app/en/fees" target="_blank" rel="noopener">21bitcoin</a>, overené 12. 10. 2026 ako v <a href="bitcoin-index-poplatkov/">Indexe poplatkov</a>. Spready a poplatky za výber nie sú zahrnuté; spread 21bitcoinu zatiaľ nemáme zmeraný. *0 % od 8. dňa Auto-Invest. Nejde o investičné poradenstvo.')
# 5. shorter page, pricing higher
def cut(a, b):
    i, j = s.index(a), s.index(b)
    return s[i:j]
ask = cut('  <!-- ASK YOUR CFO -->', '  <!-- 2. FIRST PRINCIPLES -->')
costs = cut('  <!-- 2. FIRST PRINCIPLES -->', '  <!-- 3. PROOF, NOT PROMISE -->')
proof = cut('  <!-- 3. PROOF, NOT PROMISE -->', '  <!-- 4. AFTER THE AUDIT -->')
after = cut('  <!-- 4. AFTER THE AUDIT -->', '  <!-- 5. HARD LIMITS -->')
limits = cut('  <!-- 5. HARD LIMITS -->', '  <!-- 6. PRICING -->')
pricing = cut('  <!-- 6. PRICING -->', '  <!-- 7. QUESTIONS')
block = ask + costs + proof + after + limits + pricing
costs2 = costs.replace('<section>\n    <div class="sec-head">\n      <h2>Nákup má tri náklady. <span>Väčšina ľudí sa pozerá len na jeden.</span></h2>\n    </div>',
    '<section class="vd-fold">\n    <details class="vd-more"><summary><h2>Nákup má tri náklady. <span>Väčšina ľudí sa pozerá len na jeden.</span></h2></summary>', 1)
assert costs2 != costs
costs2 = costs2[::-1].replace('>noitces/<', '>noitces/<\n>sliated/<', 1)[::-1]
limits2 = ('  <!-- 5. HARD LIMITS (compact) -->\n  <section class="vd-limits">\n    <h2 style="font-size:24px">Čo nedokáže, zámerne.</h2>\n'
           '    <ul><li><b>Presúvať peniaze.</b> Žiadne kľúče, mince ani eurá, iba na čítanie.</li><li><b>Zadávať príkazy.</b> Nákup prebieha na licencovanej platforme partnera.</li>'
           '<li><b>Hovoriť vám, či kúpiť alebo predať.</b> Verdict aj CFO otázky na nákup, predaj a načasovanie odmietnu.</li></ul>\n  </section>\n\n')
s = s.replace(block, pricing + ask + after + proof + costs2 + limits2)
assert 'Layer 2' not in s and '[CENA]' not in s
open(SITE + '/sk/cfo-mockup.html', 'w').write(s)
print('ok', len(s))
