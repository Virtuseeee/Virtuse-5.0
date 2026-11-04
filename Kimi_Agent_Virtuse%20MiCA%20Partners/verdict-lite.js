/* Verdict (verdict.html, sk/verdict.html): five short steps, a free Lite score for an email,
   and the €14 full report, paid with Stripe Checkout. Replaced the old free-text
   10-signal Verdict on 2026-11-03 (verdict-flow.js stays only for ru/verdict.html).

   Scoring: six areas, 0 to 10 each, 60 at most; the sum is converted to 100 and rounded
   to 5 (45 of 60 is 75). Fixed rules, no AI model. The score measures how
   ready the plan is, never whether to buy or sell. Grade and band come from the same
   thresholds: A/B (70+) Basics in place, C (55-69) A few gaps, D/E (under 55) Basics missing.

   Worker calls (through vb-api.js): POST /send kind verdict_lite (source verdict)
   emails the Lite score after the gate; the payload is only score, grade, band,
   gap ids and the six area points, and the Brief tick rides on the same call
   (brief: true), so there is one welcome at most.
   POST /verdict/checkout { answers, lang, email } stores the answers on the Worker
   for 24 hours and answers with the Stripe Checkout URL. Back from Stripe with
   ?session_id=, POST /verdict/report returns the report, built on the Worker from
   the same rules (features/verdict-lite/; a test keeps calc() and gaps() here in
   step with it). /waitlist (source verdict_report) only when payments are closed.
   Plain ES5 like the rest of the site's scripts. */
(function () {
  'use strict';
  var LANG = (document.documentElement.lang || 'en').slice(0, 2) === 'sk' ? 'sk' : 'en';
  var P = function (f) { return (LANG === 'sk' ? '/sk/' : '/') + f; };
  var LOC = LANG === 'sk' ? 'sk-SK' : 'en-IE';
  var eur = function (n) { var s = Math.round(n).toLocaleString(LOC); return LANG === 'sk' ? s + ' €' : '€' + s; };
  var $ = function (id) { return document.getElementById(id); };
  var dl = function (o) { (window.dataLayer = window.dataLayer || []).push(o); };
  var MOCK = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  var I = {
    home: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
    mort: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M9 15h6M12 12v6"/>',
    rent: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    other: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.5.2-.7.6-.7 1.1v.5M12 17v.01"/>',
    seed: '<path d="M12 21v-9M12 12c0-4 3-7 7-7 0 4-3 7-7 7zM12 14c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z"/>',
    btc: '<circle cx="12" cy="12" r="9"/><path d="M10 7.5h3.2a2 2 0 0 1 0 4H10m0 0h3.7a2.1 2.1 0 0 1 0 4.2H10m0-8.2v8.2"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l2 2M15 8l2 2"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="M9 12h6M12 9v6"/>',
    any: '<path d="M4 7h12l-3-3M20 17H8l3 3"/>',
    tax: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h3"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    crash: '<path d="M3 5l6 6 4-4 8 9"/><path d="M15 16h6v-6"/>',
    heirs: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
    scam: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/>',
    fees: '<circle cx="12" cy="12" r="9"/><path d="M15 9a3 3 0 1 0 0 6M8 11h5M8 13h5"/>',
    pick: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    ret: '<path d="M3 20h18M5 20V10l7-5 7 5v10"/><path d="M9 20v-5h6v5"/>',
    wait: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/>',
    more: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'
  };

  var S = {
    en: {
      countries: [['sk','Slovakia'],['cz','Czechia'],['at','Austria'],['de','Germany'],['pl','Poland'],['hu','Hungary'],['si','Slovenia'],['hr','Croatia'],['ro','Romania'],['bg','Bulgaria'],['nl','Netherlands'],['fr','France'],['es','Spain'],['other','Another country']],
      grp: ['About you', 'Your plan'], chips: ['Start', 'About you', 'Your plan', 'Verdict'],
      step: 'Step {0} of {1}', opt: 'optional', select: 'Select…', cont: 'Continue →', last: 'See my Verdict →',
      retireErr: 'Your retirement age is lower than your age.',
      steps: [
        ["Let's start with the basics.", 'Your name only appears in your own report.', { name: ['First name', 'e.g. Anna'], age: ['Your age', 'e.g. 41'], country: ['Where do you pay tax?', 'Tax rules and the partners you can use depend on it.'] }],
        ['Tell us about your savings and retirement.', 'Be as honest as you can. Round numbers are fine. Your answers stay on this page unless you buy the full report.', { savings: ['Savings and investments (€), without your home and pension', 'e.g. 150000'], pension: ['Retirement savings so far (€): pension pillars, private pension', 'e.g. 40000'], retire: ['At what age do you plan to retire?', 'e.g. 65'], retmonthly: ['How much do you put aside for retirement each month (€)?', 'e.g. 150'], expenses: ['What do you spend in a typical month (€)?', 'e.g. 2000'], reserve: ['How many months could you live from cash, without Bitcoin?'] }],
        ['Do you own your home?', 'Your home is often your biggest asset, and a mortgage changes how much a fall can hurt.', { homeval: ['Estimated home value (€)', 'e.g. 250000'], mortbal: ['Remaining mortgage (€)', 'e.g. 140000'], debt: ['Other debts (consumer loans, cards, leasing)?'] }],
        ["What's your relationship with Bitcoin?", 'No judgement. We work with first-timers, long-time holders and sceptics alike.', { btc: ['How much would you put into Bitcoin (€)?', 'e.g. 20000'], monthly: ['And each month after that (€)?', 'e.g. 200'], custody: ['Who should hold the keys?'], fall: ['Bitcoin drops 70% in a year. What do you do?'] }],
        ['What keeps you up at night about Bitcoin?', 'Pick all that apply. Your plan starts with these.', { tax_known: ['Do you know what the tax office takes when you sell?'] }]
      ],
      o: {
        reserve: [['lt1','Under 1'],['1_3','1 to 3'],['3_6','3 to 6'],['6p','6 or more']],
        home: [['own','Yes','Owned outright'],['mortgage','Yes, with a mortgage','Still paying it off'],['rent','No','I rent'],['other','Other','Family, shared, other']],
        debt: [['none','None'],['lt10','Under €10,000'],['gt10','Over €10,000']],
        experience: [['hodler','I own Bitcoin','Already invested'],['new','Curious','Haven’t bought yet'],['sceptic','Sceptical','Not sure it’s for me']],
        custody: [['self','Me','A hardware wallet I control'],['assisted','Me, with help','Help with keys and recovery'],['any','Not sure yet','Show me all options']],
        fall: [['sell','Sell, to stop the loss','Some or all of it'],['wait','Hold and wait','Do nothing'],['more','Buy more','At the lower price']],
        worries: [['tax','Paying too much tax'],['keys','Losing my keys'],['crash','A crash wiping out my savings'],['heirs','My family not finding it'],['scams','Getting scammed'],['fees','Hidden fees'],['partner','Picking the wrong partner'],['retire','Not having enough for retirement']],
        tax_known: [['yes','Yes, I know the rule'],['roughly','Roughly'],['no','No idea yet']]
      },
      map: { k: 'Six areas', h: ['Six areas.', 'Two groups.'], figure: 'Area map', lead: function (t, g) { return 'Your plan: ' + t + ' out of 100, grade ' + g + '.'; }, how: 'Each area is scored 0 to 10, so 60 points at most. The score is that sum converted to 100 and rounded to 5: 45 out of 60 is 75. Grade A or B (70 and up) means basics in place, C (55 to 69) a few gaps, D or E (under 55) basics missing. It measures how ready your plan is, not whether Bitcoin is a good buy.', sum: function (p, n, t) { return 'Your points: ' + p + ' = ' + n + ' out of 60, which converts and rounds to ' + t + ' out of 100.'; }, short: { size: 'Size', reserve: 'Reserve', debt: 'Debts', tax: 'Tax', custody: 'Custody', fall: 'Behaviour' } },
      areas: { size: 'Size', reserve: 'Reserve', debt: 'Debts', tax: 'Tax', custody: 'Custody', fall: 'Behaviour in a fall' },
      band: ['Basics in place', 'A few gaps', 'Basics missing'],
      who: function (n) { return n ? n + ', your' : 'Your'; },
      gap1: 'Your #1 gap: ',
      G: {
        tax: ['Learn the sale rule in your country', function (a) { return a.tax_known === 'yes' ? 'You know the rule. Keep a record of every purchase from day one.' : 'You do not know the details yet. In many EU countries every swap counts as a sale too.'; }],
        size: ['Size the position to a 70% fall', function (a, c) { return c.share != null && c.share >= 20 ? 'A large share of your savings is at stake. A 70% fall would change your plans.' : 'Bitcoin has fallen 70% or more several times. Know what that would mean for you before you buy.'; }],
        reserve: ['Build a 6-month cash reserve first', function () { return 'So a fall never forces you to sell at the bottom.'; }],
        debt: ['Pay down expensive debt first', function () { return 'Card and consumer-loan interest usually costs more than you can plan to earn.'; }],
        mortgage: ['Keep the mortgage safe in a fall', function () { return 'More than 80% of your home value is still owed. Cash for the payments should never depend on the Bitcoin price.'; }],
        fall: ['Write one rule for a fall', function () { return 'You said you would sell. Decide now, in one line, what you will do at −70%.'; }],
        keys: ['Practise a wallet recovery with €20', function () { return 'Set up, wipe and restore the wallet before the full amount goes in.'; }],
        custody: ['Decide who holds the keys', function () { return 'Without a choice, you cannot compare the partners that fit you.'; }],
        recovery: ['Agree the recovery steps with your provider', function () { return 'Know exactly what happens if you lose a key, before larger amounts go in.'; }],
        retire: ['Keep retirement money out of Bitcoin’s swings', function (a, c) { return c.years != null ? 'You plan to retire in ' + c.years + ' years. Money you need within the next years should not depend on the Bitcoin price.' : 'Money you need for retirement should not depend on the Bitcoin price.'; }],
        heirs: ['Tell one person how to find your Bitcoin', function () { return 'Without instructions, heirs often never find it.'; }],
        records: ['Keep a record of every purchase', function () { return 'Date, amount and price. It makes every later tax return simple.'; }]
      },
      R: {
        sizeNa: 'You did not give your savings, so the size could not be checked.',
        size: [function () { return '<b>Small position.</b> Under 5% of your savings; a fall would not change your plans.'; }, function (p) { return '<b>Sensible size.</b> ' + p + '% of your savings; a fall would hurt, not break your plans.'; }, function (p) { return '<b>Large position.</b> ' + p + '% of your savings; a fall would change your plans.'; }],
        reserve: ['<b>Reserve in place.</b> 6 months or more of cash outside Bitcoin.', '<b>Reserve almost there.</b> 3 to 6 months of cash; the target is 6.', '<b>Thin reserve.</b> Under 3 months of cash; a fall could force a sale.'],
        debt: ['<b>No consumer debt.</b> Nothing pushes you to sell at a bad moment.', '<b>Small debts.</b> Under €10,000 besides any mortgage.', '<b>Debts first.</b> Over €10,000 of consumer debt besides any mortgage.'],
        retire: function (y, pen, mon) { return y == null ? '<b>Retirement.</b> You did not give your retirement age.' : '<b>' + (y === 0 ? 'Retirement this year.' : 'Retirement in ' + y + (y === 1 ? ' year.' : ' years.')) + '</b> ' + (pen ? 'You have pension savings put aside' : 'No pension savings given') + (mon ? ' and add to them every month.' : '.'); },
        mort: ['<b>Mortgage under control.</b> Less than 80% of your home value is still owed.', '<b>Heavy mortgage.</b> More than 80% of your home value is still owed.'],
        tax: ['<b>Tax rule known.</b> You know how a sale is taxed in your country.', '<b>Tax rule roughly known.</b> The details are still open.', '<b>Tax rule unknown.</b> You do not know yet how a sale is taxed.'],
        custody: { selfNew: '<b>Own keys, first time.</b> The backup is not tested yet.', self: '<b>Own keys.</b> You hold your Bitcoin yourself.', assisted: '<b>Assisted custody.</b> You get help with keys and recovery.', any: '<b>Custody open.</b> You have not decided who holds the keys.' },
        fall: { more: '<b>Calm in a fall.</b> You would buy more at a lower price.', wait: '<b>Calm in a fall.</b> You would wait, not sell.', sell: '<b>Risky in a fall.</b> You would sell some or all to stop the loss.' }
      },
      blur: { retire: 'Retirement in plain numbers', retireTxt: function (s, p) { return (s ? s + ' retirement savings' : 'Retirement savings') + (p ? ' · ' + p + ' put into your Bitcoin plan by then' : ''); }, partners: 'Partners by your criteria', partnersTxt: 'Buying, custody, tax, inheritance: listed by fixed rules, you choose', pts: 'Where your points come from', fall: 'What a 70% fall means for you', fallTxt: function (b, r) { return b ? b + ' → ' + r + ', against your reserve and debts' : 'Your amount in euros, against your reserve and debts'; }, rule: function (c) { return 'The sale rule in ' + c; }, ruleTxt: 'Holding period, exemption limit, what counts as a sale', steps: '3 steps for this week', yourCountry: 'your country' },
      gateErr: 'Enter a valid email.', net: 'Something went wrong. Please try again.',
      sent: 'Your Lite score is on its way to your inbox.', notSent: 'We could not send the email right now. Your score is below.',
      tooMany: 'Too many attempts. Please try again in an hour. Your score is below.',
      badAddr: 'We could not deliver to this address. Please check it and try again.',
      wlOk: "You're on the list. We'll email you once, when the report opens.",
      buyWait: 'Opening secure payment…', buyClosed: 'Payment is not open right now. Leave your email and we will write to you once when it is.', buyCanceled: 'Payment cancelled. Nothing was charged.', pdfWait: 'Preparing your PDF…', pdfErr: 'The PDF could not be downloaded. Please try again; your copy is also on its way by email.',
      repLoad: 'Preparing your report…', repUsed: 'This report was open for 30 minutes and has now closed. Your PDF copy is in the email you paid with. Cannot find it? Write to info@virtuse.com.', repNet: 'We could not load your report. Please reload this page. Your PDF copy is on its way by email; if it does not arrive, write to info@virtuse.com.',
      demo: { top: 'VERDICT REPORT · SAMPLE', title: 'Anna’s Bitcoin plan check', meta: '41 · Slovakia · first purchase · own keys', scale: ['Basics missing', 'A few gaps', 'Basics in place'], pill: 'B · Basics in place', nums: [['Planned', '€20,000 · 13%'], ['After a 70% fall', '€6,000 left'], ['Monthly', '€200'], ['Cash reserve', '3 to 6 months']], areas: ['Size', 'Reserve', 'Debts', 'Tax', 'Custody', 'Behaviour'] },
      jump: ['Landing', '1 Basics', '2 Savings', '3 Home', '4 Bitcoin', '5 Worries', 'Loading', 'Gate', 'Lite score', 'Sample']
    },
    sk: {
      countries: [['sk','Slovensko'],['cz','Česko'],['at','Rakúsko'],['de','Nemecko'],['pl','Poľsko'],['hu','Maďarsko'],['si','Slovinsko'],['hr','Chorvátsko'],['ro','Rumunsko'],['bg','Bulharsko'],['nl','Holandsko'],['fr','Francúzsko'],['es','Španielsko'],['other','Iná krajina']],
      grp: ['O vás', 'Váš plán'], chips: ['Štart', 'O vás', 'Váš plán', 'Verdict'],
      step: 'Krok {0} z {1}', opt: 'nepovinné', select: 'Vyberte…', cont: 'Pokračovať →', last: 'Zobraziť môj Verdict →',
      retireErr: 'Vek odchodu do dôchodku je nižší ako váš vek.',
      steps: [
        ['Začnime základmi.', 'Vaše meno sa zobrazí len vo vašom vlastnom reporte.', { name: ['Krstné meno', 'napr. Anna'], age: ['Váš vek', 'napr. 41'], country: ['V ktorej krajine platíte dane?', 'Od toho závisia daňové pravidlá aj partneri, ktorých môžete využiť.'] }],
        ['Povedzte nám o svojich úsporách a dôchodku.', 'Buďte čo najúprimnejší. Stačia zaokrúhlené čísla. Vaše odpovede zostanú na tejto stránke, pokiaľ si nekúpite celý report.', { savings: ['Úspory a investície (€), bez bývania a dôchodku', 'napr. 150000'], pension: ['Doterajšie úspory na dôchodok (€): dôchodkové piliere, súkromné sporenie', 'napr. 40000'], retire: ['V akom veku plánujete ísť do dôchodku?', 'napr. 65'], retmonthly: ['Koľko si mesačne odkladáte na dôchodok (€)?', 'napr. 150'], expenses: ['Koľko minete za bežný mesiac (€)?', 'napr. 2000'], reserve: ['Koľko mesiacov by ste vyžili z hotovosti, bez Bitcoinu?'] }],
        ['Bývate vo vlastnom?', 'Bývanie býva najväčší majetok a hypotéka mení, ako veľmi môže pokles bolieť.', { homeval: ['Odhadovaná hodnota bývania (€)', 'napr. 250000'], mortbal: ['Zostatok hypotéky (€)', 'napr. 140000'], debt: ['Iné dlhy (spotrebné úvery, karty, lízing)?'] }],
        ['Aký máte vzťah k Bitcoinu?', 'Nikoho nesúdime. Pomáhame začiatočníkom, dlhoročným držiteľom aj skeptikom.', { btc: ['Koľko by ste dali do Bitcoinu (€)?', 'napr. 20000'], monthly: ['A potom každý mesiac (€)?', 'napr. 200'], custody: ['Kto má držať kľúče?'], fall: ['Bitcoin za rok klesne o 70 %. Čo urobíte?'] }],
        ['Čo vás na Bitcoine trápi najviac?', 'Vyberte všetko, čo platí. Váš plán začne práve týmto.', { tax_known: ['Viete, koľko si pri predaji vezme daňový úrad?'] }]
      ],
      o: {
        reserve: [['lt1','Menej ako 1'],['1_3','1 až 3'],['3_6','3 až 6'],['6p','6 a viac']],
        home: [['own','Áno','Bez hypotéky'],['mortgage','Áno, s hypotékou','Ešte ju splácam'],['rent','Nie','Bývam v prenájme'],['other','Iné','U rodiny, spoločne, iné']],
        debt: [['none','Žiadne'],['lt10','Do 10 000 €'],['gt10','Nad 10 000 €']],
        experience: [['hodler','Bitcoin vlastním','Už som investoval'],['new','Zaujíma ma','Ešte som nekúpil'],['sceptic','Som skeptický','Nie som si istý, či je pre mňa']],
        custody: [['self','Ja','Hardvérová peňaženka, ktorú ovládam'],['assisted','Ja, s pomocou','Pomoc s kľúčmi a obnovou'],['any','Ešte neviem','Ukážte mi všetky možnosti']],
        fall: [['sell','Predám, aby som zastavil stratu','Časť alebo všetko'],['wait','Počkám','Nič nerobím'],['more','Prikúpim','Za nižšiu cenu']],
        worries: [['tax','Že zaplatím priveľa na daniach'],['keys','Že stratím kľúče'],['crash','Že prepad zničí moje úspory'],['heirs','Že ho rodina nenájde'],['scams','Že naletím podvodníkom'],['fees','Skryté poplatky'],['partner','Že si vyberiem zlého partnera'],['retire','Že mi nebude stačiť na dôchodok']],
        tax_known: [['yes','Áno, poznám pravidlo'],['roughly','Približne'],['no','Zatiaľ netuším']]
      },
      map: { k: 'Šesť oblastí', h: ['Šesť oblastí.', 'Dve skupiny.'], figure: 'Mapa oblastí', lead: function (t, g) { return 'Váš plán: ' + t + ' zo 100, známka ' + g + '.'; }, how: 'Každá oblasť má 0 až 10 bodov, spolu teda najviac 60. Skóre je tento súčet prepočítaný na 100 a zaokrúhlený na 5: 45 zo 60 je 75. Známka A alebo B (70 a viac) znamená, že základy máte, C (55 až 69) pár medzier, D alebo E (pod 55) chýbajúce základy. Meria, nakoľko je pripravený váš plán, nie či je Bitcoin dobrý nákup.', sum: function (p, n, t) { return 'Vaše body: ' + p + ' = ' + n + ' zo 60, po prepočte a zaokrúhlení ' + t + ' zo 100.'; }, short: { size: 'Veľkosť', reserve: 'Rezerva', debt: 'Dlhy', tax: 'Dane', custody: 'Úschova', fall: 'Správanie' } },
      areas: { size: 'Veľkosť', reserve: 'Rezerva', debt: 'Dlhy', tax: 'Dane', custody: 'Úschova', fall: 'Správanie pri poklese' },
      band: ['Základy máte', 'Pár medzier', 'Chýbajú základy'],
      who: function (n) { return n ? n + ', vaše' : 'Vaše'; },
      gap1: 'Vaša medzera č. 1: ',
      G: {
        tax: ['Zistite, ako sa vo vašej krajine zdaní predaj', function (a) { return a.tax_known === 'yes' ? 'Pravidlo poznáte. Od prvého dňa si zapisujte každý nákup.' : 'Podrobnosti zatiaľ nepoznáte. V mnohých krajinách EÚ sa ako predaj ráta aj každá výmena.'; }],
        size: ['Nastavte veľkosť tak, aby ste zvládli pokles o 70 %', function (a, c) { return c.share != null && c.share >= 20 ? 'V hre je veľká časť vašich úspor. Pokles o 70 % by zmenil vaše plány.' : 'Bitcoin už viackrát klesol o 70 % a viac. Pred nákupom si ujasnite, čo by to znamenalo pre vás.'; }],
        reserve: ['Najprv si vytvorte rezervu na 6 mesiacov', function () { return 'Aby vás pokles nikdy neprinútil predávať na dne.'; }],
        debt: ['Najprv splaťte drahé dlhy', function () { return 'Úroky z kariet a spotrebných úverov zvyčajne stoja viac, než môžete rozumne plánovať zarobiť.'; }],
        mortgage: ['Chráňte hypotéku pred poklesom', function () { return 'Dlhujete viac ako 80 % hodnoty bývania. Peniaze na splátky nesmú závisieť od ceny Bitcoinu.'; }],
        fall: ['Napíšte si jedno pravidlo pre pokles', function () { return 'Uviedli ste, že by ste predali. Rozhodnite sa teraz, jednou vetou, čo urobíte pri −70 %.'; }],
        keys: ['Vyskúšajte si obnovu peňaženky s 20 €', function () { return 'Peňaženku nastavte, vymažte a obnovte skôr, než do nej pôjde celá suma.'; }],
        custody: ['Rozhodnite, kto bude držať kľúče', function () { return 'Bez tohto rozhodnutia nemôžete porovnať partnerov, ktorí vám vyhovujú.'; }],
        recovery: ['Dohodnite si s poskytovateľom postup obnovy', function () { return 'Vedzte presne, čo sa stane pri strate kľúča, skôr než pôjdu do hry väčšie sumy.'; }],
        retire: ['Peniaze na dôchodok nenechajte na výkyvoch Bitcoinu', function (a, c) { return c.years != null ? 'Do dôchodku plánujete ísť o ' + c.years + ' rokov. Peniaze, ktoré budete potrebovať v najbližších rokoch, nesmú závisieť od ceny Bitcoinu.' : 'Peniaze na dôchodok nesmú závisieť od ceny Bitcoinu.'; }],
        heirs: ['Povedzte jednému človeku, ako váš Bitcoin nájsť', function () { return 'Bez pokynov ho dedičia často nikdy nenájdu.'; }],
        records: ['Zapisujte si každý nákup', function () { return 'Dátum, suma a cena. Každé neskoršie daňové priznanie bude jednoduché.'; }]
      },
      R: {
        sizeNa: 'Neuviedli ste úspory, takže veľkosť sa nedala posúdiť.',
        size: [function () { return '<b>Malá pozícia.</b> Menej ako 5 % vašich úspor; pokles by vaše plány nezmenil.'; }, function (p) { return '<b>Rozumná veľkosť.</b> ' + p + ' % vašich úspor; pokles by bolel, ale plány by nezničil.'; }, function (p) { return '<b>Veľká pozícia.</b> ' + p + ' % vašich úspor; pokles by zmenil vaše plány.'; }],
        reserve: ['<b>Rezervu máte.</b> 6 mesiacov a viac v hotovosti mimo Bitcoinu.', '<b>Rezerva takmer stačí.</b> 3 až 6 mesiacov v hotovosti; cieľ je 6.', '<b>Tenká rezerva.</b> Menej ako 3 mesiace v hotovosti; pokles by vás mohol prinútiť predať.'],
        debt: ['<b>Žiadne spotrebné dlhy.</b> Nič vás netlačí predávať v zlej chvíli.', '<b>Malé dlhy.</b> Do 10 000 € okrem prípadnej hypotéky.', '<b>Najprv dlhy.</b> Viac ako 10 000 € spotrebných dlhov okrem prípadnej hypotéky.'],
        retire: function (y, pen, mon) { return y == null ? '<b>Dôchodok.</b> Neuviedli ste vek odchodu do dôchodku.' : '<b>' + (y === 0 ? 'Dôchodok ešte tento rok.' : 'Dôchodok o ' + y + ' ' + (y === 1 ? 'rok.' : y < 5 ? 'roky.' : 'rokov.')) + '</b> ' + (pen ? 'Na dôchodok si už odkladáte' : 'Úspory na dôchodok ste neuviedli') + (mon ? ' a každý mesiac pridávate.' : '.'); },
        mort: ['<b>Hypotéka pod kontrolou.</b> Dlhujete menej ako 80 % hodnoty bývania.', '<b>Vysoká hypotéka.</b> Dlhujete viac ako 80 % hodnoty bývania.'],
        tax: ['<b>Pravidlo poznáte.</b> Viete, ako sa vo vašej krajine zdaní predaj.', '<b>Pravidlo poznáte približne.</b> Podrobnosti sú ešte otvorené.', '<b>Pravidlo nepoznáte.</b> Zatiaľ neviete, ako sa zdaní predaj.'],
        custody: { selfNew: '<b>Vlastné kľúče, prvýkrát.</b> Záloha ešte nie je vyskúšaná.', self: '<b>Vlastné kľúče.</b> Bitcoin držíte sami.', assisted: '<b>Asistovaná úschova.</b> S kľúčmi a obnovou vám pomáhajú.', any: '<b>Úschova otvorená.</b> Ešte ste sa nerozhodli, kto bude držať kľúče.' },
        fall: { more: '<b>Pokojný pri poklese.</b> Prikúpili by ste za nižšiu cenu.', wait: '<b>Pokojný pri poklese.</b> Počkali by ste, nepredávali.', sell: '<b>Riziko pri poklese.</b> Predali by ste časť alebo všetko, aby ste zastavili stratu.' }
      },
      blur: { retire: 'Dôchodok v číslach', retireTxt: function (s, p) { return (s ? s + ' úspor na dôchodok' : 'Úspory na dôchodok') + (p ? ' · ' + p + ' vložených do plánu v Bitcoine' : ''); }, partners: 'Partneri podľa vašich kritérií', partnersTxt: 'Nákup, úschova, dane, dedičstvo: podľa pevných pravidiel, vyberáte vy', pts: 'Odkiaľ sú vaše body', fall: 'Čo pre vás znamená pokles o 70 %', fallTxt: function (b, r) { return b ? b + ' → ' + r + ', oproti vašej rezerve a dlhom' : 'Vaša suma v eurách, oproti rezerve a dlhom'; }, rule: function (c) { return 'Pravidlo predaja: ' + c; }, ruleTxt: 'Doba držby, oslobodenie, čo sa ráta ako predaj', steps: '3 kroky na tento týždeň', yourCountry: 'vaša krajina' },
      gateErr: 'Zadajte platný e-mail.', net: 'Niečo sa pokazilo. Skúste to znova.',
      sent: 'Lite skóre vám posielame e-mailom.', notSent: 'E-mail sa teraz nepodarilo odoslať. Vaše skóre nájdete nižšie.',
      tooMany: 'Príliš veľa pokusov. Skúste to znova o hodinu. Vaše skóre nájdete nižšie.',
      badAddr: 'Na túto adresu sa e-mail nepodarilo doručiť. Skontrolujte ju a skúste to znova.',
      wlOk: 'Ste na zozname. Napíšeme vám raz, keď report spustíme.',
      buyWait: 'Otváram zabezpečenú platbu…', buyClosed: 'Platba teraz nie je otvorená. Nechajte nám e-mail a raz vám napíšeme, keď bude.', buyCanceled: 'Platba bola zrušená. Nič sa nestrhlo.', pdfWait: 'Pripravujem PDF…', pdfErr: 'PDF sa nepodarilo stiahnuť. Skúste to znova; kópia je na ceste aj e-mailom.',
      repLoad: 'Pripravujem váš report…', repUsed: 'Tento report bol otvorený 30 minút a teraz je zatvorený. Kópiu v PDF máte v e-maile, ktorým ste platili. Neviete ju nájsť? Napíšte na info@virtuse.com.', repNet: 'Report sa nepodarilo načítať. Znovu načítajte túto stránku. Kópia v PDF je na ceste e-mailom; ak nepríde, napíšte na info@virtuse.com.',
      demo: { top: 'VERDICT REPORT · VZOR', title: 'Plán Bitcoinu: Anna', meta: '41 · Slovensko · prvý nákup · vlastné kľúče', scale: ['Chýbajú základy', 'Pár medzier', 'Základy máte'], pill: 'B · Základy máte', nums: [['Plánuje', '20 000 € · 13 %'], ['Po poklese o 70 %', 'zostane 6 000 €'], ['Mesačne', '200 €'], ['Rezerva', '3 až 6 mesiacov']], areas: ['Veľkosť', 'Rezerva', 'Dlhy', 'Dane', 'Úschova', 'Správanie'] },
      jump: ['Landing', '1 Základ', '2 Úspory', '3 Bývanie', '4 Bitcoin', '5 Obavy', 'Načítanie', 'Brána', 'Lite skóre', 'Vzor']
    }
  }[LANG];

  var COL = { home: ['green','blue','purple','yellow'], experience: ['orange','green','purple'], custody: ['teal','blue','indigo'], fall: ['pink','yellow','green'], worries: ['orange','teal','pink','purple','yellow','blue','indigo','green'] };
  var ICO = { home: [I.home, I.mort, I.rent, I.other], experience: [I.btc, I.seed, I.other], custody: [I.key, I.shield, I.any], fall: [I.crash, I.wait, I.more], worries: [I.tax, I.lock, I.crash, I.heirs, I.scam, I.fees, I.pick, I.ret] };
  var STEPS = [
    { f: [{ k: 'name', type: 'text', opt: 1 }, { k: 'age', type: 'num' }, { k: 'country', type: 'select' }] },
    { f: [{ k: 'savings', type: 'eur' }, { k: 'pension', type: 'eur', opt: 1 }, { k: 'retire', type: 'num' }, { k: 'retmonthly', type: 'eur', opt: 1 }, { k: 'expenses', type: 'eur', opt: 1 }, { k: 'reserve', type: 'seg' }] },
    { f: [{ k: 'home', type: 'tiles' }, { k: 'homeval', type: 'eur', opt: 1, when: function () { return A.home === 'own' || A.home === 'mortgage'; } }, { k: 'mortbal', type: 'eur', when: function () { return A.home === 'mortgage'; } }, { k: 'debt', type: 'seg' }] },
    { f: [{ k: 'experience', type: 'tiles', cols: 'c3' }, { k: 'btc', type: 'eur' }, { k: 'monthly', type: 'eur', opt: 1 }, { k: 'custody', type: 'tiles', cols: 'c3', sm: 1 }, { k: 'fall', type: 'tiles', cols: 'c3', sm: 1 }] },
    { f: [{ k: 'worries', type: 'multi', opt: 1 }, { k: 'tax_known', type: 'seg' }] }
  ];
  var KICK = ['blue', 'green', 'purple', 'orange', 'pink'];
  var KEY = 'vb-verdict-lite';
  var A = { worries: [] }, done = false, cur = 0;
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved && saved.A) { A = saved.A; A.worries = A.worries || []; done = !!saved.done; } } catch (e) {}
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify({ A: A, done: done })); } catch (e) {} }
  var svg = function (p) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; };
  var fmt = function (s) { var a = arguments; return s.replace(/\{(\d)\}/g, function (m, i) { return a[+i + 1]; }); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function stepper(el, active) {
    el.innerHTML = S.chips.map(function (n, i) { return '<span class="' + (i < active ? 'done' : i === active ? 'on' : '') + '">' + n + '</span>'; }).join('');
  }
  // History: every step the visitor moves to forward is its own browser history entry
  // (pushState), so the browser Back button walks back one step at a time and Forward
  // re-renders. State = { vl: 1, s: step, i: entries since the funnel was entered,
  // p: previous step }. Loading (6) is replaced by the gate, so Back never re-runs it.
  // Landing (0) is always the entry the visitor arrived on, so Back from the landing
  // leaves to the previous page.
  var H = window.history && history.pushState;
  function st() { var x = H && history.state; return x && x.vl ? x : null; }
  function url(s) { return location.pathname + (s ? '?s=' + s : ''); }
  function nav(s, how) {
    if (!H) return;
    var now = st(), i = now ? now.i : 0, p = now ? now.s : 0;
    if (how === 'push') history.pushState({ vl: 1, s: s, i: i + 1, p: p }, '', url(s));
    else history.replaceState({ vl: 1, s: s, i: i, p: now ? now.p : 0 }, '', url(s));
  }
  // Step the browser would show for s, after the guards
  function guard(s) {
    s = +s || 0;
    if ((s >= 6 && s <= 8) && !done) s = 1;     // no loading, gate or result without a completed funnel
    if (s === 8 && !A.email) s = 7;             // the Lite score needs the email first
    return s;
  }
  function goStep(s) { var g = guard(s); show(g); nav(g, 'push'); }
  function goBackTo(s) {
    var now = st();
    if (now && now.i > 0 && now.p === s) { history.back(); return; }   // the previous entry is that step
    show(guard(s)); nav(guard(s), 'replace');
  }
  // Back to the landing: return to the landing entry the visitor arrived on
  function goLanding() {
    var now = st();
    if (now && now.i > 0) { toLanding = true; history.go(-now.i); return; }
    show(0); nav(0, 'replace');
  }
  var toLanding = false;
  window.addEventListener('popstate', function (e) {
    var x = e.state && e.state.vl ? e.state : null;
    if (toLanding) { toLanding = false; show(0); if (H) history.replaceState({ vl: 1, s: 0, i: 0, p: 0 }, '', url(0)); return; }
    var s = x ? x.s : (+((/[?&]s=(\d+)/.exec(location.search) || [])[1]) || 0);
    var g = guard(s);
    if (g === 6) g = done ? 7 : 1;                // never replay the loading screen
    show(g);
    if (g !== s) nav(g, 'replace');
  });
  function show(s) {
    s = +s || 0;
    document.querySelectorAll('.ml-screen').forEach(function (el) { el.classList.remove('on'); });
    var key = s >= 1 && s <= 5 ? 'q' : String(s);
    var scr = document.querySelector('.ml-screen[data-s="' + key + '"]'); if (!scr) return;
    scr.classList.add('on');
    $('ml').classList.toggle('wide', s === 0);
    $('ml').classList.toggle('ml-paid', s === 8 || s === 9 || s === 10);
    if (s === 0) demoLoop(); else clearTimeout(demoLoop.t);
    if (key === 'q') { cur = s - 1; renderQ(); dl({ event: 'verdict_step', verdict_step: s }); }
    if (s === 6) load();
    if (s === 8) result();
    window.scrollTo(0, 0);
  }
  function lab(f, l) { return l ? '<label class="ml-lab" for="f_' + f.k + '">' + l + (f.opt ? ' <em>' + S.opt + '</em>' : '') + '</label>' : ''; }
  function field(f, txt) {
    var v = A[f.k], L = txt[f.k] || [];
    if (f.type === 'text' || f.type === 'num' || f.type === 'eur')
      return lab(f, L[0]) + '<div class="ml-inwrap' + (f.type === 'eur' ? ' eur' : '') + '"><input class="ml-input" id="f_' + f.k + '" data-k="' + f.k + '" ' + (f.type === 'text' ? 'type="text" autocomplete="given-name" maxlength="40"' : 'type="number" inputmode="numeric" min="0"') + ' placeholder="' + (L[1] || '') + '" value="' + (v == null ? '' : esc(v)) + '"></div>' + (f.k === 'retire' ? '<p class="ml-err" id="mlRetErr" hidden>' + S.retireErr + '</p>' : '');
    if (f.type === 'select')
      return lab(f, L[0]) + '<select class="ml-input ml-select" id="f_' + f.k + '" data-k="' + f.k + '"><option value="">' + S.select + '</option>' + S.countries.map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' + (L[1] ? '<div class="ml-why">' + L[1] + '</div>' : '');
    if (f.type === 'seg')
      return lab(f, L[0]) + '<div class="ml-seg" role="radiogroup">' + S.o[f.k].map(function (o) { return '<button type="button" role="radio" aria-checked="' + (v === o[0]) + '" class="' + (v === o[0] ? 'sel' : '') + '" data-k="' + f.k + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
    if (f.type === 'tiles')
      return lab(f, L[0]) + '<div class="ml-tiles ' + (f.cols || '') + (f.sm ? ' sm' : '') + '" role="radiogroup">' + S.o[f.k].map(function (o, i) { return '<button type="button" role="radio" aria-checked="' + (v === o[0]) + '" class="ml-tile c-' + COL[f.k][i] + (v === o[0] ? ' sel' : '') + '" data-k="' + f.k + '" data-v="' + o[0] + '">' + svg(ICO[f.k][i]) + '<span><b>' + o[1] + '</b><small>' + o[2] + '</small></span></button>'; }).join('') + '</div>';
    if (f.type === 'multi')
      return '<div class="ml-tiles c4 multi">' + S.o.worries.map(function (o, i) { var on = A.worries.indexOf(o[0]) > -1; return '<button type="button" aria-pressed="' + on + '" class="ml-tile c-' + COL.worries[i] + (on ? ' sel' : '') + '" data-m="' + o[0] + '">' + svg(ICO.worries[i]) + '<b>' + o[1] + '</b></button>'; }).join('') + '</div>';
  }
  function renderQ() {
    var st = STEPS[cur], n = STEPS.length, txt = S.steps[cur], pct = Math.round((cur + 1) / n * 100);
    stepper($('mlStepper'), cur < 3 ? 1 : 2);
    $('mlStepTxt').textContent = fmt(S.step, cur + 1, n);
    $('mlPct').textContent = pct + '%';
    $('mlBar').style.width = pct + '%';
    $('mlQ').className = 'ml-card k-' + KICK[cur];
    $('mlQ').innerHTML = '<div class="ml-kick">' + fmt(S.step, cur + 1, n) + ' · ' + S.grp[cur < 3 ? 0 : 1] + '</div><h2>' + txt[0] + '</h2><p class="ml-hint">' + txt[1] + '</p><div class="ml-fields">' +
      st.f.filter(function (f) { return !f.when || f.when(); }).map(function (f) { return '<div class="ml-field">' + field(f, txt[2]) + '</div>'; }).join('') + '</div>';
    $('mlNext').textContent = cur === n - 1 ? S.last : S.cont;
    check();
  }
  function retireBad() { return A.retire != null && A.age != null && A.retire !== '' && A.age !== '' && +A.retire < +A.age; }
  function check() {
    var ok = STEPS[cur].f.every(function (f) { return f.opt || (f.when && !f.when()) || (A[f.k] != null && A[f.k] !== ''); });
    if (cur === 1) { var bad = retireBad(), e = $('mlRetErr'); if (e) e.hidden = !bad; if (bad) ok = false; }
    $('mlNext').disabled = !ok;
  }

  function calc() {
    var share = A.savings > 0 && A.btc != null ? A.btc / A.savings * 100 : null;
    var size = share == null ? 3 : share < 5 ? 10 : share < 20 ? 7 : share < 50 ? 4 : 1;
    var reserve = { '6p': 10, '3_6': 7, '1_3': 4, lt1: 1 }[A.reserve] || 3;
    var debt = { none: 10, lt10: 7, gt10: 3 }[A.debt] || 5;
    var ltv = A.home === 'mortgage' && A.homeval > 0 && A.mortbal != null ? A.mortbal / A.homeval : null;
    if (ltv != null && ltv > 0.8) debt = Math.max(1, debt - 3);
    // Guard: a retirement age below the current age gives no "years" and no penalty
    var years = A.retire != null && A.age != null && +A.retire >= +A.age ? A.retire - A.age : null;
    if (years != null && years < 10 && share != null && share >= 20) size = Math.max(1, size - 2);
    var tax = { yes: 10, roughly: 6 }[A.tax_known] || 2;
    var custody = A.custody === 'self' ? (A.experience !== 'hodler' ? 6 : 9) : A.custody === 'assisted' ? 8 : 4;
    var fall = { more: 10, wait: 10, sell: 4 }[A.fall] || 5;
    var sc = { size: size, reserve: reserve, debt: debt, tax: tax, custody: custody, fall: fall };
    var sum = size + reserve + debt + tax + custody + fall;
    return { share: share, ltv: ltv, years: years, sc: sc, total: Math.round(sum / 60 * 100 / 5) * 5 };
  }
  function grade(t) { return t >= 85 ? 'A' : t >= 70 ? 'B' : t >= 55 ? 'C' : t >= 40 ? 'D' : 'E'; }
  function band(t) { return t >= 70 ? S.band[0] : t >= 55 ? S.band[1] : S.band[2]; }
  // Rank gaps by the points each area misses, plus a boost for what the person worries about.
  // Partner Finder stays a result CTA, never a gap.
  function gaps(c) {
    var sc = c.sc, w = A.worries || [], pr = {};
    var put = function (id, p) { pr[id] = Math.max(pr[id] || 0, p); };
    if (sc.size < 10) put('size', 10 - sc.size);
    if (sc.reserve < 10) put('reserve', 10 - sc.reserve);
    if (A.debt && A.debt !== 'none') put('debt', A.debt === 'gt10' ? 7 : 3);
    if (c.ltv != null && c.ltv > 0.8) put('mortgage', 4);
    if (sc.tax < 10) put('tax', 10 - sc.tax);
    if (A.custody === 'any') put('custody', 6);
    if (A.custody === 'self' && sc.custody < 10) put('keys', 10 - sc.custody);
    if (A.custody === 'assisted') put('recovery', 2);
    if (sc.fall < 10) put('fall', 10 - sc.fall);
    if (c.years != null && c.years < 10 && (c.share || 0) >= 20) put('retire', 5);
    var boost = { tax: 'tax', keys: A.custody === 'assisted' ? 'recovery' : A.custody === 'any' ? 'custody' : 'keys', crash: 'size', heirs: 'heirs', scams: A.custody === 'any' ? 'custody' : 'keys', retire: 'retire' };
    w.forEach(function (k) { var id = boost[k]; if (id) pr[id] = (pr[id] || 0) + 3; });
    var ids = Object.keys(pr).sort(function (a, b) { return pr[b] - pr[a]; });
    ['heirs', 'records'].forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    return ids.slice(0, 3).map(function (id) { var g = S.G[id]; return [g[0], g[1](A, c), id]; });
  }
  // The left text and the area map, same markup and classes as #signals on the page.
  // M: strings; A: [{ short, points, weak }] in the order of the map.
  function areaTop(M, A) {
    var x = esc, c = [230, 200], R = 130;
    var xy = function (k, v) { var t = (-90 + k * 60) * Math.PI / 180; return [(c[0] + R * v / 10 * Math.cos(t)).toFixed(1), (c[1] + R * v / 10 * Math.sin(t)).toFixed(1)]; };
    var ring = function (v) { return [0, 1, 2, 3, 4, 5].map(function (k) { return xy(k, v).join(','); }).join(' '); };
    var labels = [[230, 28, 'middle'], [366.8, 121, 'start'], [366.8, 279, 'start'], [230, 358, 'middle'], [93.2, 279, 'end'], [93.2, 121, 'end']];
    var svgMap = '<svg viewBox="-40 -6 540 422" role="img" aria-label="' + x(M.figure + ', ' + M.caption) + '">' +
      [2.5, 5, 7.5, 10].map(function (v) { return '<polygon class="rg" points="' + ring(v) + '"/>'; }).join('') +
      A.map(function (a, k) { var e = xy(k, 10); return '<line class="sp" x1="230" y1="200" x2="' + e[0] + '" y2="' + e[1] + '"/>'; }).join('') +
      '<polygon class="ar" points="' + A.map(function (a, k) { return xy(k, a.points).join(','); }).join(' ') + '"/>' +
      A.map(function (a, k) { var e = xy(k, a.points); return '<circle class="dt' + (a.weak ? ' wk' : '') + '" cx="' + e[0] + '" cy="' + e[1] + '" r="4"/>'; }).join('') +
      A.map(function (a, k) { var l = labels[k]; return '<text class="lb' + (a.weak ? ' wk' : '') + '" x="' + l[0] + '" y="' + l[1] + '" text-anchor="' + l[2] + '"><tspan>' + x(a.short) + '</tspan><tspan class="sc" x="' + l[0] + '" dy="15">' + a.points + '</tspan></text>'; }).join('') + '</svg>';
    return '<div class="ml-areas-top"><div><span class="ml-k2">' + x(M.k) + '</span><h4>' + x(M.h[0]) + ' <span>' + x(M.h[1]) + '</span></h4><p class="ml-areas-lead">' + x(M.lead) + '</p><p>' + x(M.how) + '</p><p class="ml-areas-sum">' + x(M.sum) + '</p></div>' +
      '<figure class="radar in"><figcaption><span class="eyebrow blue"><i></i>' + x(M.figure) + '</span><b>' + x(M.caption) + '</b></figcaption>' + svgMap + '</figure></div>';
  }
  function result() {
    var c = calc(), t = c.total, gr = grade(t), sc = c.sc;
    var nm = A.name ? String(A.name).trim() : '';
    $('mlGrade').textContent = gr; $('mlGrade').className = 'ml-grade g' + gr;
    $('mlWho').textContent = S.who(nm);
    $('mlScore').textContent = t;
    $('mlBandH').textContent = band(t);
    $('mlResTop').classList.add('ready');
    // The free area map: the same panel as in the report, without the reasons.
    var mapIds = ['size', 'reserve', 'debt', 'tax', 'custody', 'fall'];
    var lowest = Math.min.apply(null, mapIds.map(function (k) { return sc[k]; }));
    var weakId = lowest < 10 ? mapIds.filter(function (k) { return sc[k] === lowest; })[0] : '';
    var ptSum = mapIds.reduce(function (n, k) { return n + sc[k]; }, 0);
    var mapEl = $('mlFreeMap');
    if (mapEl) mapEl.innerHTML = areaTop({ k: S.map.k, h: S.map.h, figure: S.map.figure, caption: t + '/100', lead: S.map.lead(t, gr), how: S.map.how, sum: S.map.sum(mapIds.map(function (k) { return sc[k]; }).join(' + '), ptSum, t) }, mapIds.map(function (k) { return { short: S.map.short[k], points: sc[k], weak: k === weakId }; }));
    var g = gaps(c), ul = $('mlGaps');
    ul.innerHTML = ''; g.forEach(function (x) { var e = document.createElement('li'); e.innerHTML = '<b></b><span></span>'; e.children[0].textContent = x[0]; e.children[1].textContent = x[1]; ul.appendChild(e); });
    $('mlGap1').textContent = S.gap1 + g[0][0].charAt(0).toLowerCase() + g[0][0].slice(1);
    var R = S.R, sh = c.share, p = sh == null ? 0 : Math.round(sh), rd = [];
    rd.push([sc.size >= 7, sh == null ? R.sizeNa : sh < 5 ? R.size[0](p) : sh < 20 ? R.size[1](p) : R.size[2](p)]);
    rd.push([sc.reserve >= 7, sc.reserve >= 10 ? R.reserve[0] : sc.reserve >= 7 ? R.reserve[1] : R.reserve[2]]);
    rd.push([A.debt !== 'gt10', A.debt === 'none' ? R.debt[0] : A.debt === 'lt10' ? R.debt[1] : R.debt[2]]);
    rd.push([c.years == null || c.years >= 10 || (sh || 0) < 20, R.retire(c.years, A.pension, A.retmonthly)]);
    if (c.ltv != null) rd.push([c.ltv <= 0.8, c.ltv <= 0.8 ? R.mort[0] : R.mort[1]]);
    rd.push([sc.tax >= 7, sc.tax >= 10 ? R.tax[0] : sc.tax >= 6 ? R.tax[1] : R.tax[2]]);
    rd.push([sc.custody >= 7, A.custody === 'self' ? (A.experience !== 'hodler' ? R.custody.selfNew : R.custody.self) : A.custody === 'assisted' ? R.custody.assisted : R.custody.any]);
    rd.push([sc.fall >= 7, R.fall[A.fall] || R.fall.wait]);
    $('mlRead').innerHTML = rd.map(function (r) { return '<li class="' + (r[0] ? '' : 'warn') + '">' + r[1] + '</li>'; }).join('');
    // Blurred preview of the paid report (the Worker builds the real one after payment)
    var cn = A.country && A.country !== 'other' ? (S.countries.filter(function (x) { return x[0] === A.country; })[0] || [0, S.blur.yourCountry])[1] : S.blur.yourCountry;
    var rows = document.querySelectorAll('.ml-blur-row');
    var set = function (i, b, s) { rows[i].children[0].textContent = b; rows[i].children[1].textContent = s; };
    set(0, S.blur.pts, ['size', 'reserve', 'debt', 'tax', 'custody', 'fall'].map(function (k) { return S.areas[k] + ' ' + sc[k] + '/10'; }).join(' · '));
    set(1, S.blur.fall, S.blur.fallTxt(A.btc ? eur(A.btc) : '', A.btc ? eur(A.btc * 0.3) : ''));
    set(2, S.blur.rule(cn), S.blur.ruleTxt);
    set(3, S.blur.steps, g.map(function (x, i) { return (i + 1) + '. ' + x[0]; }).join(' · '));
    var planIn = (A.btc || 0) + (c.years != null ? (A.monthly || 0) * c.years * 12 : 0);
    set(4, S.blur.retire, S.blur.retireTxt(A.pension ? eur(A.pension) : '', planIn ? eur(planIn) : ''));
    set(5, S.blur.partners, S.blur.partnersTxt);
    var amt = !A.btc ? '' : A.btc < 1000 ? 's' : A.btc < 10000 ? 'm' : A.btc < 100000 ? 'l' : 'xl';
    $('mlPf').href = P('concierge.html') + '?pf_goal=buy&pf_country=' + (A.country || '') + '&pf_experience=' + (A.experience === 'hodler' ? 'hodler' : 'new') + '&pf_custody=' + (A.custody || '') + '&pf_amount=' + amt + '&utm_source=verdict&utm_medium=lite';
    dl({ event: 'verdict_result', verdict_mode: 'lite', verdict_score: t, verdict_grade: gr });
  }
  function load() {
    stepper($('mlStepper2'), 3);
    var li = document.querySelectorAll('#mlChecks li');
    li.forEach(function (l) { l.classList.remove('ok'); });
    li.forEach(function (l, i) { setTimeout(function () { l.classList.add('ok'); }, 420 * (i + 1)); });
    clearTimeout(load.t); load.t = setTimeout(function () { if (document.querySelector('.ml-screen[data-s="6"]').classList.contains('on')) { show(7); nav(7, 'replace'); } }, 2700);
  }

  // Hero sample card (fictional client Anna), also shown small on the gate screen
  var D = S.demo;
  var DEMO = '<div class="dm-top"><span>' + D.top + '</span><span class="dm-dots"><i></i><i></i><i></i><i></i></span></div>' +
    '<div class="dm-st"><b class="dm-t">' + D.title + '</b><span class="dm-meta">' + D.meta + '</span></div>' +
    '<div class="dm-st dm-score"><div class="dm-n"><b>75</b><small>/100</small></div><div class="dm-scale"><div class="dm-lbl"><span>' + D.scale[0] + '</span><span>' + D.scale[1] + '</span><span>' + D.scale[2] + '</span></div><div class="dm-track"><i></i></div><span class="dm-pill">' + D.pill + '</span></div></div>' +
    '<div class="dm-st dm-nums">' + D.nums.map(function (x) { return '<div><small>' + x[0] + '</small><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
    '<div class="dm-st dm-areas">' + [7, 7, 10, 6, 6, 10].map(function (v, i) { return '<div class="' + (v <= 6 ? 'lo' : '') + '"><span>' + D.areas[i] + '</span><i><em style="--w:' + v * 10 + '%"></em></i><b>' + v + '</b></div>'; }).join('') + '</div>';
  function demoInit() {
    ['mlDemo', 'mlDemo2'].forEach(function (id) { var d = $(id); if (d && !d.innerHTML) d.innerHTML = DEMO; });
    var d2 = $('mlDemo2'); if (d2) d2.classList.add('all');
  }
  function demoLoop() {
    var d = $('mlDemo'); if (!d) return;
    clearTimeout(demoLoop.t);
    var st = d.querySelectorAll('.dm-st'), dots = d.querySelectorAll('.dm-dots i'), n = d.querySelector('.dm-n b');
    d.classList.remove('all'); st.forEach(function (x) { x.classList.remove('on'); }); dots.forEach(function (x) { x.classList.remove('on'); });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { d.classList.add('all'); return; }
    st.forEach(function (x, k) { setTimeout(function () {
      x.classList.add('on'); if (dots[k]) dots[k].classList.add('on');
      if (x.classList.contains('dm-score')) { var t0 = performance.now(); (function f(now) { var q = Math.min(1, (now - t0) / 1100); n.textContent = Math.round(75 * (1 - Math.pow(1 - q, 3))); if (q < 1) requestAnimationFrame(f); })(t0); }
    }, 250 + k * 750); });
    demoLoop.t = setTimeout(function () { if ($('ml').classList.contains('wide')) demoLoop(); }, 250 + st.length * 750 + 4500);
  }

  function vbApi() {
    if (window.VB_API) return Promise.resolve(window.VB_API);
    return window.VB_API_LOADING || (window.VB_API_LOADING = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = '/vb-api.js?v=2';
      s.onload = function () { if (window.VB_API) ok(window.VB_API); else no(new Error('vb-api.js')); };
      s.onerror = function () { window.VB_API_LOADING = null; no(new Error('vb-api.js')); };
      document.head.appendChild(s);
    }));
  }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (go) { e.preventDefault(); var to = +go.getAttribute('data-go') || 0; if (to === 0) goLanding(); else goStep(to); return; }
    var b = e.target.closest('#mlQ [data-v]');
    if (b) {
      var bk = b.getAttribute('data-k'); A[bk] = b.getAttribute('data-v'); save();
      if (bk === 'home') { renderQ(); return; }   // home value / mortgage fields depend on it
      b.parentNode.querySelectorAll('[data-v]').forEach(function (x) { var on = x === b; x.classList.toggle('sel', on); x.setAttribute('aria-checked', on); });
      check(); return;
    }
    var m = e.target.closest('#mlQ [data-m]');
    if (m) { var k = m.getAttribute('data-m'), i = A.worries.indexOf(k); if (i > -1) A.worries.splice(i, 1); else A.worries.push(k); m.classList.toggle('sel'); m.setAttribute('aria-pressed', i < 0); save(); check(); }
  });
  document.addEventListener('input', function (e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-k');
    if (!k || e.target.tagName === 'SELECT') return;
    var v = e.target.value; A[k] = e.target.type === 'number' ? (v === '' ? null : +v) : v; save(); check();
  });
  document.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT' && e.target.getAttribute('data-k')) { A[e.target.getAttribute('data-k')] = e.target.value; save(); check(); } });
  $('mlNext').onclick = function () { if (cur < STEPS.length - 1) goStep(cur + 2); else { done = true; save(); goStep(6); } };
  $('mlBack').onclick = function () { if (cur === 0) goLanding(); else goBackTo(cur); };

  // Gate: the email unlocks the Lite score; the Brief only when ticked.
  $('mlGate').onsubmit = function (e) {
    e.preventDefault();
    var f = e.target, em = f.email.value.trim(), msg = $('mlGateMsg');
    if (f.website.value) return;
    if (!EMAIL.test(em)) { msg.textContent = S.gateErr; f.email.focus(); return; }
    msg.textContent = ''; A.email = em; save();
    var c = calc(), btn = f.querySelector('button[type=submit]'), sent = $('mlSent');
    var payload = { score: c.total, grade: grade(c.total), band: c.total >= 70 ? 0 : c.total >= 55 ? 1 : 2, gaps: gaps(c).map(function (g) { return g[2]; }), areas: c.sc };
    dl({ event: 'verdict_lite_unlock', verdict_brief: f.brief.checked });
    btn.disabled = true;
    // text: null = sent; otherwise the warning shown above the score.
    var done8 = function (text) { btn.disabled = false; sent.textContent = text || S.sent; sent.className = 'ml-sent' + (text ? ' warn' : ''); goStep(8); };
    vbApi().then(function (api) { return api.postJson('/send', { email: em, hp: f.website.value, lang: LANG, kind: 'verdict_lite', source: 'verdict', brief: f.brief.checked, payload: payload }); })
      .then(function (r) {
        if (r && r.ok) { dl({ event: 'verdict_lite_email_sent' }); return done8(null); }
        var code = r && r.data && r.data.code;
        dl({ event: 'verdict_lite_email_failed', verdict_error: code || (r ? 'http_' + r.status : 'network') });
        // Resend refused the address: stay on the gate so it can be corrected.
        if (code === 'invalid_recipient') { btn.disabled = false; msg.textContent = S.badAddr; f.email.focus(); return; }
        done8(r && r.status === 429 ? S.tooMany : S.notSent);
      })
      .catch(function () { done8(S.notSent); });
  };
  // €14 full report: the answers go to the Worker only here, then on to Stripe.
  function buy(btn) {
    if (!done) { goStep(1); return; }     // the sample page, before the funnel
    var box = btn.closest('[data-buybox]'), msg = box && box.querySelector('.ml-buy-msg');
    var say = function (t) { if (msg) msg.textContent = t; };
    var answers = {}; Object.keys(A).forEach(function (k) { if (k !== 'email') answers[k] = A[k]; });
    btn.disabled = true; say(S.buyWait);
    dl({ event: 'verdict_checkout_start' });
    vbApi().then(function (api) { return api.postJson('/verdict/checkout', { answers: answers, lang: LANG, email: A.email || undefined }); })
      .then(function (r) {
        if (r && r.ok && r.data && r.data.url) { location.href = r.data.url; return; }
        btn.disabled = false;
        if (r && r.status === 503) {          // payments closed on this Worker: the waitlist instead
          say(S.buyClosed);
          var wl = box && box.querySelector('form[data-wl]');
          if (wl) { wl.hidden = false; btn.hidden = true; }
          return;
        }
        say((r && r.data && r.data.error) || S.net);
      })
      .catch(function () { btn.disabled = false; say(S.net); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-buy]');
    if (b) { e.preventDefault(); buy(b); }
  });

  // The report, back from Stripe with ?session_id=. The Worker checks the payment.
  var REP_ICO = {
    tax: I.tax, finder: I.pick,
    retire: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    returns: '<path d="M4 20V4M4 20h16M8 16l3-4 3 2 5-7"/>',
    videos: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    books: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>'
  };
  function renderReport(r) {
    var h = r.h, x = esc;
    var tbl = function (head, rows) {
      return '<table class="ml-table"><thead><tr>' + head.map(function (c) { return '<th>' + x(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (row) { return '<tr>' + row.map(function (c) { return '<td>' + x(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    };
    var pts = function (list) { return '<ul class="ml-pts">' + list.map(function (p, i) { return '<li><i>' + (i + 1) + '</i><div><b>' + x(p.title) + '</b><span>' + x(p.text) + '</span></div></li>'; }).join('') + '</ul>'; };
    var box = function (k, t, body, acc) { return '<div class="ml-box acc-' + acc + '"><span class="ml-k2">' + x(k) + '</span>' + (t ? '<h4>' + x(t) + '</h4>' : '') + body + '</div>'; };
    var paras = function (list) { return list.map(function (t) { return '<p>' + x(t) + '</p>'; }).join(''); };
    var dlBtn = function (cls) { return '<div class="ml-rep-dl"><button class="' + cls + '" type="button" data-pdf>' + x(r.download) + '</button><p class="ml-fine ml-pdf-msg" aria-live="polite"></p></div>'; };
    var kv = function (rows) { return rows.length ? '<table class="ml-table ml-kv"><tbody>' + rows.map(function (t) { return '<tr' + (t[2] ? ' class="strong"' : '') + '><td>' + x(t[0]) + (t[3] ? '<small class="ml-calc">' + x(t[3]) + '</small>' : '') + '</td><td>' + x(t[1]) + '</td></tr>'; }).join('') + '</tbody></table>' : ''; };
    var heroVals = function (b) {
      return '<span class="ml-k2">' + x(b.k) + '</span><div class="ml-plan-vals">' + b.vals.map(function (v) { return '<div><small>' + x(v[0]) + '</small><b>' + x(v[1]) + '</b></div>'; }).join('') + '</div>' + (b.sub ? '<p>' + x(b.sub) + '</p>' : '');
    };
    var planHero = function (p) {
      return p ? '<div class="ml-plan-hero"><div class="ml-plan-top"><small>' + x(p.label) + '</small><b>' + x(p.value) + '</b></div>' + kv(p.rows) + (p.scenario ? '<div class="ml-plan-scn">' + heroVals(p.scenario) + '</div>' : '') + '</div>' : '';
    };
    // The area map and the two groups, same markup and classes as #signals on the page.
    var areaSection = function () {
      var M = r.areaMap, A = r.areas;
      var row = function (id) {
        var a = A.filter(function (z) { return z.id === id; })[0];
        return '<li class="sig-row' + (a.weak ? ' weak' : '') + '"><div><b>' + x(a.title) + '</b><span>' + x(a.q) + '</span><span class="why">' + x(a.why) + '</span></div><div class="sig-val"><i><em style="width:' + a.points * 10 + '%"></em></i><b>' + a.points + '<small>/10</small></b></div></li>';
      };
      return '<div class="ml-box acc-blue ml-areas vl">' + areaTop(M, A) +
        '<div class="sig-groups ml-g2">' + M.groups.map(function (g) { return '<div class="sig-group" style="--c: var(--' + g.color + ')"><div class="k">' + x(g.k) + '</div><h3>' + x(g.h) + '</h3><ul>' + g.ids.map(row).join('') + '</ul></div>'; }).join('') + '</div></div>';
    };
    var partnerCard = function (p) {
      return '<div class="ml-partner"><div class="ml-partner-top"><b>' + x(p.name) + '</b><span>' + x(p.tagline) + '</span></div>' +
        '<ul class="ml-partner-facts">' + p.facts.map(function (t) { return '<li>' + x(t) + '</li>'; }).join('') + '</ul>' +
        (p.steps.length ? '<details><summary>' + x(p.stepsNote) + '</summary><ol>' + p.steps.map(function (s) { return '<li><b>' + x(s.title) + '</b> ' + x(s.text) + '</li>'; }).join('') + '</ol></details>' : '') +
        '<a class="ml-btn2 ghost" rel="noopener sponsored" target="_blank" href="' + x(p.href) + '">' + x(r.partners.open) + ' ' + x(p.name) + ' →</a></div>';
    };
    var partnerGroup = function (g) {
      return '<div class="ml-pgroup acc-' + ({ buy: 'orange', custody: 'purple', tax: 'yellow', heirs: 'teal' }[g.id]) + '"><h5 class="ml-rep-h5">' + x(g.title) + '</h5>' + (g.note ? '<p class="ml-pgroup-note">' + x(g.note) + '</p>' : '') + (g.empty ? '<p>' + x(g.empty) + '</p>' : '') +
        (g.list.length ? '<div class="ml-partners">' + g.list.map(partnerCard).join('') + '</div>' : '') +
        '<div class="ml-pgroup-links">' + g.links.map(function (l) { return '<a class="ml-step-tool" href="' + x(l.href) + '">' + x(l.name) + ' →</a>'; }).join('') + '</div></div>';
    };
    var note = function (t) { return '<p style="font-size:13px;color:var(--dim);margin-top:16px">' + x(t) + '</p>'; };
    var plain = function (rows) { return rows.length ? '<table class="ml-table"><tbody>' + rows.map(function (t) { return '<tr><td>' + x(t[0]) + '</td><td>' + x(t[1]) + '</td></tr>'; }).join('') + '</tbody></table>' : ''; };
    var bandsTbl = function (B) {
      return '<table class="ml-table ml-bands"><thead><tr>' + B.head.map(function (c) { return '<th>' + x(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        B.rows.map(function (row) { return '<tr>' + row.map(function (c) { return '<td>' + x(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody><tfoot><tr>' + B.foot.map(function (c) { return '<td>' + x(c) + '</td>'; }).join('') + '</tr></tfoot></table>';
    };
    var taxEx = function (e) {
      if (!e) return '';
      var hero = e.hero ? '<div class="ml-plan-hero">' + heroVals(e.hero) + (e.text ? '<p>' + x(e.text) + '</p>' : '') + '</div>' : (e.text ? '<p style="margin-top:14px">' + x(e.text) + '</p>' : '');
      var range = e.rows.length ? tbl(e.head, e.rows) : '';
      var tail = e.dates.map(function (t) { return '<p style="margin-top:14px">' + x(t) + '</p>'; }).join('') + (e.note ? note(e.note) : '');
      var title = '<h5 class="ml-rep-h5">' + x(e.title || '') + '</h5>';
      if (!e.kv.length) return title + hero + range + tail;
      // The trail reads sale, cost, gain; tax by band; levy, total, what is left. The result sits beside it.
      var cells = e.bands
        ? '<div>' + kv(e.kv) + '</div><div>' + bandsTbl(e.bands) + '</div><div>' + kv(e.after) + '</div><div>' + hero + '</div>'
        : '<div>' + kv(e.kv) + kv(e.after) + '</div><div>' + hero + range + '</div>';
      return title + '<div class="ml-retire ml-tax-grid">' + cells + '</div>' + tail;
    };
    var docsHtml = function (D) {
      return '<p>' + x(D.pdfNote) + '</p>' +
        '<h5 class="ml-rep-h5">' + x(D.rule.title) + '</h5><p>' + x(D.rule.text) + '</p>' + tbl(D.rule.head, D.rule.rows) +
        '<h5 class="ml-rep-h5">' + x(D.recovery.title) + '</h5><ul class="ml-check">' + D.recovery.items.map(function (t) { return '<li>' + x(t) + '</li>'; }).join('') + '</ul>' +
        '<h5 class="ml-rep-h5">' + x(D.record.title) + '</h5><p>' + x(D.record.text) + '</p><button class="ml-btn2 ghost" type="button" data-csv>' + x(D.record.csv) + '</button>' +
        '<h5 class="ml-rep-h5">' + x(D.heirs.title) + '</h5><p><b>' + x(D.heirs.warn) + '</b></p>' + plain(D.heirs.filled) + '<ul class="ml-check plain">' + D.heirs.fields.map(function (t) { return '<li>' + x(t) + '</li>'; }).join('') + '</ul>';
    };
    return '<div class="ml-k2" style="text-align:center">' + x(r.kicker) + '</div>' +
      '<h2 class="ml-rep-h">' + x(r.title) + '</h2>' +
      '<div class="ml-box ml-nums" style="margin-top:30px">' + r.nums.map(function (n) { return '<div><small>' + x(n[0]) + '</small><b>' + x(n[1]) + '</b></div>'; }).join('') + '</div>' +
      '<div class="ml-sent-wrap"><span class="ml-sent">' + x(r.sent) + '</span></div>' + dlBtn('ml-big orange') +
      '<div class="ml-score-row"><div><div class="n">' + r.score + '<small>/100</small></div><div class="lbl">' + x(r.gradeLine) + '</div></div><div><div class="ml-scale">' + r.scale.map(function (t, i) { return '<span' + ((r.score >= 70 ? 2 : r.score >= 55 ? 1 : 0) === i ? ' class="on"' : '') + '>' + x(t) + '<small>' + x(r.scaleRange[i]) + '</small></span>'; }).join('') + '</div><div class="ml-track"><i style="width:' + r.score + '%"></i></div></div></div>' +
      '<div style="text-align:center"><span class="ml-pill">' + x(r.pill) + '</span></div>' +
      '<div class="ml-box acc-blue" style="margin-top:44px"><span class="ml-k2">' + x(h.summaryK) + '</span>' + paras(r.summary) + '</div>' +
      areaSection() +
      (r.worth ? box(r.worth.k, r.worth.h, kv(r.worth.rows) + (r.worth.note ? note(r.worth.note) : ''), 'teal') : '') +
      box(h.fallK, h.fall, paras(r.fall) + (r.fallTable ? tbl(r.fallTable.head, r.fallTable.rows) + note(r.fallTable.note) : ''), 'pink') +
      box(r.reserveBox.k, r.reserveBox.h, '<p>' + x(r.reserveBox.text) + '</p>', 'green') +
      box(r.retireBox.k, r.retireBox.h, '<div class="ml-retire"><div class="ml-retire-l">' + kv(r.retireBox.rows) + (r.retireBox.stats ? '<div class="ml-retire-stats">' + r.retireBox.stats.map(function (t) { return '<div><small>' + x(t[0]) + '</small><b>' + x(t[1]) + '</b></div>'; }).join('') + '</div>' : '<p>' + x(r.retireBox.text) + '</p>') + (r.retireBox.note ? note(r.retireBox.note) : '') + '</div>' + planHero(r.retireBox.plan) + '</div>', 'orange') +
      box(h.custodyK, h.custody, '<p style="margin-bottom:16px">' + x(r.custody.yours) + '</p>' + tbl(r.custody.head, r.custody.rows), 'purple') +
      box(h.taxK, h.tax, (r.tax.text ? '<p>' + x(r.tax.text) + '</p>' : '') + (r.tax.rows.length ? '<table class="ml-table"><tbody>' + r.tax.rows.map(function (t) { return '<tr><td>' + x(t[0]) + '</td><td>' + x(t[1]) + '</td></tr>'; }).join('') + '</tbody></table>' : '') + (r.tax.note ? note(r.tax.note) : '') + taxEx(r.taxExample), 'yellow') +
      (r.fees ? box(r.fees.k, r.fees.h, '<div class="ml-table-scroll">' + tbl(r.fees.head, r.fees.rows) + '</div>' + note(r.fees.note), 'indigo') : '') +
      box(h.bothK, h.both, '<div class="ml-cols"><div><div class="ml-colh r">' + x(h.wrong) + '</div>' + pts(r.risks) + '</div><div><div class="ml-colh g">' + x(h.solid) + '</div>' + (r.solid.length ? pts(r.solid) : '<p>' + x(r.solidNone) + '</p>') + '</div></div>', 'pink') +
      box(h.planK, h.plan, '<ul class="ml-steps">' + r.steps.map(function (s, i) { return '<li><i>' + (i + 1) + '</i><div><b>' + x(s.title) + '</b><span>' + x(s.text) + '</span>' + (s.tool ? '<a class="ml-step-tool" href="' + x(s.tool.href) + '">' + x(s.tool.name) + ' →</a>' : '') + '</div></li>'; }).join('') + '</ul>', 'green') +
      box(r.partners.k, r.partners.h, '<p>' + x(r.partners.intro) + '</p>' + r.partners.groups.map(partnerGroup).join(''), 'blue') +
      box(r.docs.k, r.docs.h, docsHtml(r.docs), 'purple') +
      box(h.nextK, h.next, '<div class="ml-next">' + r.next.map(function (n) { return '<a href="' + x(n.href) + '">' + svg(REP_ICO[n.id] || I.more) + '<b>' + x(n.name) + '</b><span>' + x(n.sub) + '</span><small>' + x(n.small) + '</small></a>'; }).join('') + '</div>', 'teal') +
      dlBtn('ml-big orange wide') + (r.withdraw ? '<p class="ml-legal">' + x(r.withdraw.text) + ' <a href="' + x(r.withdraw.href) + '">' + x(r.withdraw.label) + ' →</a></p>' : '') + '<p class="ml-legal">' + x(r.legal) + '</p>';
  }
  // The same PDF as in the email, from the Worker, while the report is open.
  function downloadPdf(btn, sid) {
    var msg = btn.parentNode.querySelector('.ml-pdf-msg');
    btn.disabled = true; msg.textContent = S.pdfWait;
    vbApi().then(function (api) { return api.postJson('/verdict/report', { session_id: sid, lang: LANG, format: 'pdf' }); })
      .then(function (r) {
        btn.disabled = false;
        if (!r || !r.ok || !r.data || !r.data.pdf) { msg.textContent = (r && r.data && r.data.reportUsed) ? S.repUsed : (r && r.data && r.data.error) || S.pdfErr; return; }
        var bin = atob(r.data.pdf), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var u = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        var a = document.createElement('a');
        a.href = u; a.download = r.data.filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
        msg.textContent = '';
        dl({ event: 'verdict_report_pdf' });
      })
      .catch(function () { btn.disabled = false; msg.textContent = S.pdfErr; });
  }
  function loadReport(sid) {
    var el = $('mlReport');
    el.onclick = function (e) {
      var b = e.target.closest('[data-pdf]'); if (b) downloadPdf(b, sid);
      if (e.target.closest('[data-csv]') && el.csv) {
        var sep = LANG === 'sk' ? ';' : ',';
        var u = URL.createObjectURL(new Blob(['\ufeff' + el.csv.columns.join(sep) + '\r\n'], { type: 'text/csv;charset=utf-8' }));
        var a = document.createElement('a'); a.href = u; a.download = el.csv.file; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
      }
    };
    // The site's cursor spotlight (.spot in site-v2.css) on cards drawn after load.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) el.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.ml-box, .ml-partner'); if (!c) return;
      var b = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - b.left) + 'px'); c.style.setProperty('--my', (e.clientY - b.top) + 'px');
    });
    el.innerHTML = '<p class="ml-sub" style="text-align:center">' + esc(S.repLoad) + '</p>';
    var say = function (t) { el.innerHTML = '<div class="ml-box"><p>' + esc(t) + '</p></div>'; };
    vbApi().then(function (api) { return api.postJson('/verdict/report', { session_id: sid, lang: LANG }); })
      .then(function (r) {
        var d = (r && r.data) || {};
        if (!r || !r.ok) { say(d.error || S.repNet); return; }
        if (d.reportUsed) { say(S.repUsed); return; }
        el.innerHTML = renderReport(d);
        el.csv = d.docs.record;
        try { sessionStorage.removeItem(KEY); } catch (e) {}
        dl({ event: 'verdict_report_view', verdict_score: d.score, verdict_grade: d.grade });
      })
      .catch(function () { say(S.repNet); });
  }

  // €14 full report waitlist, only when payments are closed (Worker source verdict_report)
  document.querySelectorAll('form[data-wl]').forEach(function (f) {
    f.onsubmit = function (e) {
      e.preventDefault();
      var em = (f.email.value || A.email || '').trim(), msg = f.querySelector('.ml-wl-msg');
      if (f.website.value) return;
      if (!EMAIL.test(em)) { msg.textContent = S.gateErr; f.email.focus(); return; }
      var btn = f.querySelector('button'); btn.disabled = true; msg.textContent = '';
      vbApi().then(function (api) { return api.postJson('/waitlist', { email: em, hp: f.website.value, source: 'verdict_report', lang: LANG }); })
        .then(function (r) { if (r && r.ok === false) throw 0; f.querySelectorAll('input,button').forEach(function (x) { x.hidden = true; }); msg.textContent = S.wlOk; dl({ event: 'waitlist_signup', waitlist_source: 'verdict_report' }); })
        .catch(function () { btn.disabled = false; msg.textContent = S.net; });
    };
  });

  // Local preview only: a bar to jump between the screens
  if (MOCK) {
    var j = document.querySelector('.ml-jump'); if (j) { j.hidden = false; j.insertAdjacentHTML('beforeend', S.jump.map(function (n, i) { return '<a href="?s=' + i + '" data-go="' + i + '">' + i + ' ' + n + '</a>'; }).join('')); }
  }
  // ?consult=1 (from the Lite score email) opens the 15-minute call widget
  if (/[?&]consult=1\b/.test(location.search)) {
    var tryOpen = function (n) { if (window.VirtuseConsultation && window.VirtuseConsultation.open) window.VirtuseConsultation.open(LANG); else if (n) setTimeout(function () { tryOpen(n - 1); }, 300); };
    setTimeout(function () { tryOpen(20); }, 300);
  }
  demoInit();
  var rdr = document.querySelector('.vl .radar');
  if (rdr) { if ('IntersectionObserver' in window) { var ro = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { rdr.classList.add('in'); ro.disconnect(); } }, { threshold: 0.3 }); ro.observe(rdr); } else rdr.classList.add('in'); }
  var sidM = /[?&]session_id=(cs_(?:test|live)_[A-Za-z0-9]+)/.exec(location.search);
  if (sidM) { show(10); loadReport(sidM[1]); return; }
  var canceled = /[?&]canceled=1\b/.test(location.search);
  var mm = /[?&]s=(\d+)/.exec(location.search);
  // First render: the step in the URL (after the guards), without a new history entry
  var first = guard(canceled ? (A.email ? 8 : 7) : mm ? mm[1] : 0);
  if (first === 6) first = done ? 7 : 1;
  show(first);
  if (canceled) document.querySelectorAll('.ml-screen.on .ml-buy-msg').forEach(function (m) { m.textContent = S.buyCanceled; });
  if (H) { var hs = st(); history.replaceState({ vl: 1, s: first, i: hs ? hs.i : 0, p: hs ? hs.p : 0 }, '', url(first)); }
})();
