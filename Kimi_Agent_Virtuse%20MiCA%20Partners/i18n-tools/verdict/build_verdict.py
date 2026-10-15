#!/usr/bin/env python3
"""MOCKUP: Virtuse Verdict landing page in the v2 site design (sk/verdict.html, noindex).

usage: python3 build_verdict.py

Musk version of the Verdict landing page (first principles, one CTA, show the product),
rebuilt with the shared v2 chrome (nav, footer, Brief card) and site-v2.css, plus the
"Otázky zákazníkov" FAQ from the Bezos version. Forms are inert: this is a mockup.
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
import build_fee_index as F
C, SITE, ORIGIN = F.C, F.SITE, F.ORIGIN
L = 'sk'
PAGE = '/sk/verdict.html'

CSS = '''<style>
.vd-hero { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); gap: 48px; align-items: center; padding: 64px 0 40px; }
.vd-hero h1 { font-size: clamp(40px, 5.4vw, 68px); line-height: 1.04; letter-spacing: -0.03em; font-weight: 700; margin-top: 18px; }
.vd-hero h1 .h1-or { color: var(--orange); }
.vd-lead { font-size: 19px; color: var(--muted); margin: 20px 0 24px; max-width: 560px; }
.vd-form { display: grid; gap: 12px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; max-width: 560px; }
.vd-form label { font-weight: 600; font-size: 14px; }
.vd-form textarea { resize: vertical; background: var(--inset); color: var(--text); border: 1px solid var(--line-strong); border-radius: 10px; padding: 14px; font: inherit; font-size: 16px; }
.vd-form .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
.vd-form .row span { font-size: 13px; color: var(--muted); }
.vd-cta { background: var(--orange); color: #0d0902; border: 0; border-radius: 10px; min-height: 48px; padding: 0 22px; font: 600 15px/1 var(--sans); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.vd-card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 28px; display: grid; gap: 18px; }
.vd-card .top { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); font-family: var(--mono); }
.vd-card .q { color: var(--muted); margin: 0; }
.vd-score { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.vd-score b { font-size: 76px; line-height: 0.9; letter-spacing: -0.04em; }
.vd-score b small { font-size: 24px; color: var(--muted); font-weight: 500; }
.vd-pill { background: rgba(247,147,26,0.14); color: var(--orange); font-weight: 600; font-size: 14px; padding: 6px 12px; border-radius: 999px; }
.vd-sig { display: grid; grid-template-columns: 150px 1fr 24px; gap: 12px; align-items: center; font-size: 13px; color: var(--muted); }
.vd-sig .bar { height: 6px; background: var(--line-strong); border-radius: 3px; overflow: hidden; }
.vd-sig .bar i { display: block; height: 6px; border-radius: 3px; }
.vd-sig .v { font-family: var(--mono); text-align: right; }
.vd-weak { border-top: 1px solid var(--line); padding-top: 16px; font-size: 14px; color: var(--muted); }
.vd-weak a { color: var(--text); }
.vd-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1px; background: var(--line); border-radius: 16px; overflow: hidden; margin-bottom: 96px; }
.vd-facts div { background: var(--dark); padding: 22px; }
.vd-facts b { display: block; font-size: 30px; }
.vd-facts span { color: var(--muted); font-size: 14px; }
.vd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px; }
.vd-box { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 22px; display: grid; gap: 10px; align-content: start; }
.vd-box .n { font-family: var(--mono); font-size: 12px; color: var(--orange); }
.vd-box h3 { font-size: 18px; line-height: 1.25; }
.vd-box p { margin: 0; color: var(--muted); font-size: 15px; }
.vd-box.hl { border-color: var(--orange); }
.vd-tiers { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 16px; margin-top: 16px; }
.vd-tier { border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; }
.vd-tier.hl { border-color: var(--orange); }
.vd-tier b { font-size: 18px; }
.vd-tier span { color: var(--muted); font-size: 14px; }
.vd-tier p { margin: 6px 0 0; color: var(--muted); font-size: 15px; }
.vd-model { border: 1px solid var(--line); border-radius: 20px; padding: 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 32px; align-items: center; }
.vd-model h2 { font-size: 32px; margin-top: 10px; }
.vd-model p { color: var(--muted); font-size: 17px; margin: 10px 0 0; }
.vd-model form { display: grid; gap: 10px; }
.vd-model label { font-weight: 600; font-size: 14px; }
.vd-model .row { display: flex; flex-wrap: wrap; gap: 10px; }
.vd-model input { flex: 1 1 220px; min-height: 48px; background: var(--inset); color: var(--text); border: 1px solid var(--line-strong); border-radius: 10px; padding: 0 14px; font: inherit; font-size: 16px; }
.vd-price { font-size: 40px; font-weight: 700; }
.vd-price small { font-size: 16px; color: var(--muted); font-weight: 500; }
.vd-end { text-align: center; display: grid; gap: 22px; justify-items: center; padding: 40px 0 96px; }
.vd-end h2 { font-size: clamp(32px, 4.4vw, 54px); letter-spacing: -0.03em; max-width: 820px; }
.vd-note { color: var(--dim); font-size: 13px; max-width: 860px; }
#vd section { margin-bottom: 96px; }
</style>
'''

SIGNALS = [('Cieľ', 8), ('Časový horizont', 7), ('Alternatívy', 5), ('Najhorší scenár', 4), ('Likvidita', 5),
           ('Úschova a dedičstvo', 6), ('Dane', 3), ('Pravidlo, nie emócia', 7), ('Plán B', 4), ('Asymetria', 6)]
PRINCIPLES = [
    ('01', 'Prvé princípy', 'Rozložíme rozhodnutie na fakty, ktoré musia platiť. Názor bez faktu dostane nízke skóre.'),
    ('02', 'Najprv vymazať', 'Najlepšia časť plánu je tá, ktorú nepotrebuješ. Verdict ukáže, čo z plánu vypustiť.'),
    ('03', 'Fyzika rizika', 'Každý plán prejde testom poklesu o 70 %. Ak ho neprežije, neprežije ani teba.'),
    ('04', 'Asymetria', 'Hľadáme ohraničenú stratu a otvorený zisk. Opačný plán označíme.'),
    ('05', 'Rýchla spätná väzba', 'Zmeň predpoklad a vyhodnoť znova. Lepšie myslenie je cyklus, nie jednorazová rada.'),
]
FAQ = [
    ('Povie mi Verdict, či mám kúpiť Bitcoin?', 'Nie. Hodnotí, či je tvoja úvaha úplná. Čo urobíš, je tvoje rozhodnutie. Preto nepotrebuje licenciu na poradenstvo a nemá konflikt záujmov.'),
    ('Odkiaľ berie fakty?', 'Z oficiálnych zdrojov, ktoré Virtuse už používa, napríklad daňové pravidlá 13 krajín s dátumom kontroly. Keď fakt chýba, Verdict sa opýta.'),
    ('Čo sa stane s tým, čo napíšem?', 'Bez účtu sa nič neukladá. Ak si report uložíš, zostane tvoj a môžeš ho vymazať.'),
    ('Koľko to stojí?', 'Náhľad je zadarmo. Plný report stojí [CENA] jednorazovo. Firmy ho dostanú vo Virtuse CFO, ktoré sa spúšťa 1. novembra: 9 € mesačne alebo 90 € ročne.'),
]


def color(v):
    return 'var(--text)' if v >= 7 else ('var(--muted)' if v >= 5 else 'var(--orange)')


def build():
    t = {}
    Bt = json.load(open(os.path.join(TOOLS, 'bots', L + '.json')))
    t.update({x: v for x, v in Bt.items() if x.startswith('b_') or x == 'email'})
    url = lambda x: PAGE
    ld = {'@context': 'https://schema.org', '@graph': F.org_ld() + [
        F.crumbs_ld([('Domov', '/sk/'), ('Virtuse Verdict', PAGE)]),
        F.faq_ld(FAQ)]}
    out = F.head(L, 'Virtuse Verdict: over rozhodnutie o Bitcoine | Virtuse',
                 'Virtuse Verdict ohodnotí tvoje uvažovanie o Bitcoine v 10 signáloch a ukáže, kde máš dieru. Nehodnotí Bitcoin, nie je to poradenstvo.',
                 PAGE, [('sk', PAGE)], ld, robots='noindex, nofollow', title_max=70)
    out = out.replace('</head>', CSS + '</head>', 1)
    nav, foot = F.chrome(L, url)
    score = sum(v for _, v in SIGNALS)
    sig = '\n'.join('<div class="vd-sig"><span>%s</span><span class="bar"><i style="width:%d%%;background:%s"></i></span><span class="v">%d</span></div>'
                    % (n, v * 10, color(v), v) for n, v in SIGNALS)
    pr = '\n'.join('<div class="vd-box"><span class="n">%s</span><h3>%s</h3><p>%s</p></div>' % p for p in PRINCIPLES)
    faq = '\n    '.join('<details%s><summary>%s</summary><p>%s</p></details>' % (' open' if i == 0 else '', q, a) for i, (q, a) in enumerate(FAQ))
    cfo = '/sk/cfo.html?utm_source=verdict&utm_medium=cta&utm_campaign=cfo#waitForm'
    out += '''<body class="page-buy page-fee no-split">
{nav}

<main class="wrap" id="vd">

  <div class="vd-hero" id="top">
    <div>
      <div class="eyebrow"><i></i>Virtuse Verdict · Layer 2</div>
      <h1>Over rozhodnutie o Bitcoine <span class="h1-or">skôr, než ho urobíš.</span></h1>
      <p class="vd-lead">Popíš, čo chceš urobiť. Verdict ohodnotí tvoje uvažovanie v 10 signáloch a povie ti, kde máš dieru. Nehodnotí Bitcoin. Hodnotí, či si to premyslel.</p>
      <form class="vd-form" id="start" onsubmit="return false">
        <label for="vd-decision">Tvoje rozhodnutie</label>
        <textarea id="vd-decision" rows="3" placeholder="Napríklad: chcem dať 20 % hotovosti firmy do Bitcoinu a držať ho 5 rokov."></textarea>
        <div class="row"><span>Zadarmo. Bez registrácie. Nie je to poradenstvo.</span><button type="button" class="vd-cta">Získať verdikt</button></div>
      </form>
    </div>
    <div class="vd-card" aria-label="Ukážka verdiktu">
      <div class="top"><span>Ukážka verdiktu</span><span>ilustračné čísla</span></div>
      <p class="q">„Chcem si požičať proti svojmu BTC na kúpu bytu.“</p>
      <div class="vd-score"><b>{score}<small>/100</small></b><div><span class="vd-pill">Testuj</span><p class="q" style="font-size:13px;margin-top:6px">Skontroluj 3 predpoklady</p></div></div>
      <div style="display:grid;gap:10px">
{sig}
      </div>
      <div class="vd-weak">Najslabšie miesto: nepoznáš cenu, pri ktorej by veriteľ predal tvoj zálohový Bitcoin. <a href="/sk/loan.html">Over v Loan Copilote</a></div>
    </div>
  </div>

  <div class="vd-facts" aria-label="Fakty">
    <div><b>10</b><span>signálov kvality rozhodnutia</span></div>
    <div><b>3</b><span>doplňujúce otázky, nič si nevymýšľa</span></div>
    <div><b>10</b><span>jazykov</span></div>
    <div><b>0 €</b><span>provízií za verdikt</span></div>
  </div>

  <section id="how">
    <div class="sec-head one"><div class="sec-copy"><h2>Tri kroky. <span>Žiadne sľuby.</span></h2></div></div>
    <div class="how-log">
      <div class="how-log-item"><div class="how-log-marker"><span class="how-log-dot"></span></div><div class="how-log-body"><span class="how-log-num">Krok 01</span><h3>Popíš rozhodnutie</h3><p>Vlastnými slovami. Verdict sa doplní najviac tromi otázkami, ak niečo chýba.</p></div></div>
      <div class="how-log-item"><div class="how-log-marker"><span class="how-log-dot"></span></div><div class="how-log-body"><span class="how-log-num">Krok 02</span><h3>Dostaneš skóre a diery</h3><p>Cieľ, horizont, najhorší scenár, likvidita, dane, dedičstvo, plán B. Každý signál so zdôvodnením.</p></div></div>
      <div class="how-log-item"><div class="how-log-marker"><span class="how-log-dot"></span></div><div class="how-log-body"><span class="how-log-num">Krok 03</span><h3>Rozhodneš sa sám</h3><p>Konaj, testuj alebo počkaj. Čísla si overíš v nástrojoch Virtuse s oficiálnymi zdrojmi.</p></div></div>
    </div>
    <div class="vd-tiers">
      <div class="vd-tier"><b>Konaj</b> <span>65 až 100</span><p>Úvaha drží. Ďalší krok je na tebe.</p></div>
      <div class="vd-tier hl"><b>Testuj</b> <span>50 až 64</span><p>Over 2 až 3 predpoklady, potom rozhodni.</p></div>
      <div class="vd-tier"><b>Počkaj</b> <span>0 až 49</span><p>Diery, ktoré môžu byť drahé. Povieme ktoré.</p></div>
    </div>
  </section>

  <section id="principy">
    <div class="sec-head one"><div class="sec-copy"><h2>Postavené na prvých princípoch. <span>Nie na hype.</span></h2></div></div>
    <div class="vd-grid">
{pr}
    </div>
  </section>

  <section aria-label="Denný mentálny model">
    <div class="vd-model">
      <div>
        <div class="eyebrow"><i></i>Dnešný mentálny model · 2 / 30</div>
        <h2>Inverzia</h2>
        <p>Neopýtaj sa, ako vyhrať. Opýtaj sa, ako by si o svoj Bitcoin prišiel. Potom to nerob.</p>
      </div>
      <form onsubmit="return false">
        <label for="vd-email">Jeden model každý deň, Brief každý pondelok</label>
        <div class="row"><input id="vd-email" type="email" placeholder="tvoj@email.sk"><button type="button" class="btn btn-primary">Odoberať</button></div>
        <span class="vd-note">Odhlásiš sa jedným klikom.</span>
      </form>
    </div>
  </section>

  <section id="cena">
    <div class="sec-head one"><div class="sec-copy"><h2>Platíš za premyslené rozhodnutie. <span>Nie za tip.</span></h2></div></div>
    <div class="vd-grid">
      <div class="vd-box"><h3>Náhľad</h3><div class="vd-price">0 €</div><p>Skóre, verdikt a najslabšie miesto tvojej úvahy.</p><a class="btn btn-ghost" href="#start">Získať verdikt</a></div>
      <div class="vd-box hl"><h3>Plný report</h3><div class="vd-price">[CENA]</div><p>Všetkých 10 signálov, predpoklady, riziká, plán B a otázky na zajtra. Jednorazovo, bez predplatného.</p><a class="vd-cta" href="#start">Odomknúť report</a></div>
      <div class="vd-box"><h3>Pre firmy, vo Virtuse CFO</h3><div class="vd-price">9 € <small>mesačne</small></div><p>Rozhodnutia o Bitcoin treasury firmy. Spúšťa sa 1. novembra: 9 € mesačne alebo 90 € ročne.</p><a class="btn btn-ghost" href="{cfo}" data-cta="cfo">Dajte mi vedieť →</a></div>
    </div>
  </section>

  <section id="faq" class="qa">
    <div class="sec-head one"><div class="sec-copy"><h2>Otázky <span>zákazníkov</span></h2></div></div>
    {faq}
  </section>

  {brief}

  <div class="vd-end">
    <h2>Najdrahšie rozhodnutie je to, ktoré si nepremyslel.</h2>
    <a class="vd-cta" href="#start">Získať verdikt zadarmo</a>
    <p class="vd-note">Virtuse Verdict hodnotí kvalitu tvojho uvažovania, nie Bitcoin ani konkrétnu službu. Neodporúča nákup, predaj ani pôžičku a neradí partnerov. Nie je to investičné, daňové ani právne poradenstvo. Virtuse nedrží tvoje peniaze ani kľúče.</p>
  </div>

  {foot}
</main>

'''.format(nav=nav, score=score, sig=sig, pr=pr, faq=faq, cfo=cfo, brief=F.brief_card(L, t, 'verdict_brief'), foot=foot)
    out += C.scripts('/')
    F.check_text(out, L)
    shell = os.path.join(SITE, PAGE.lstrip('/'))
    open(shell, 'w').write(C.finalize(out, shell))
    print(PAGE, len(out))


if __name__ == '__main__':
    build()
