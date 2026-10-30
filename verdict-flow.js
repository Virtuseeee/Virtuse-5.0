// Verdict question funnel (verdict.html, sk/verdict.html). Asks the questions the
// AI would otherwise guess, then calls the Worker (POST /verdict with a profile of
// fixed ids, see cloudflare-worker/src/verdict.js PROFILE) and shows the free view:
// verdict line, 3 next steps, 2 areas, partners and pricing (verdict-result-v2).
// Off until launch: on for staging, ?verdict=1 or <meta name="vb-verdict" content="on">.
// cfo.html hands over the decision text in sessionStorage 'vb-verdict-text'.
// Full report: no payment yet. Visitors leave an email (Worker POST /waitlist,
// source verdict_report). ?report=1 asks the staging Worker for the report
// preview; without it staging shows the free view with the pricing block.
// Questions depend on the goal (GOALSETS); hints only say an answer "affects"
// a signal when the Worker's profileFloors() backs it.
(function () {
  // Verdict languages: sk, en, ru (the Worker's LANGS); anything else is English.
  var LANG = ['sk', 'ru'].indexOf(document.documentElement.lang) >= 0 ? document.documentElement.lang : 'en';

  // Worker calls go through vb-api.js: staging and local testing call the
  // staging Worker for /verdict (Verdict open, full report preview) and
  // /waitlist (dry run, nothing stored or sent); production calls production.
  // Newsletter Worker client (vb-api.js), loaded on first use. The same loader
  // sits in every shared script that posts to the Worker; see vb-api.js.
  function vbApi() {
    if (window.VB_API) return Promise.resolve(window.VB_API);
    return window.VB_API_LOADING || (window.VB_API_LOADING = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = '/vb-api.js?v=1';
      s.onload = function () { if (window.VB_API) ok(window.VB_API); else no(new Error('vb-api.js')); };
      s.onerror = function () { window.VB_API_LOADING = null; no(new Error('vb-api.js')); };
      document.head.appendChild(s);
    }));
  }

  var meta = document.querySelector('meta[name="vb-verdict"]');
  // The report preview only with ?report=1 (staging Worker); the default on
  // staging is the free view, as a visitor sees it (verdict-result-v2 §3).
  var PREVIEW = /[?&]report=1\b/.test(location.search);
  var ON = location.hostname === 'staging.virtuse.com' || location.hostname === 'localhost' || /[?&]verdict=1\b/.test(location.search) || (meta && meta.content === 'on');

  var STR = {
    sk: {
      steps: ['Rozhodnutie', 'O vás', 'Váš plán', 'Verdict'], back: '← Späť', cont: 'Pokračovať', start: 'Začať', skip: '? Zatiaľ neviem', other: 'Niečo iné, opíšem to',
      closedH: 'Verdict sa čoskoro otvorí.', closedP: 'Zapíšte sa a dáme vám vedieť.', closedCta: 'Na stránku Virtuse CFO',
      startEb: 'Verdict · zadarmo', startH: 'Otestujte svoje rozhodnutie o Bitcoine. <span>Pomáhame investorom robiť múdre rozhodnutia.</span>',
      startP: 'Skôr ako kúpite, predáte alebo si požičiate, otestujte svoje rozhodnutie na 10 signáloch. Najprv sa opýtame, čo AI potrebuje vedieť, potom dostanete verdikt.',
      startHint: 'Asi 2 minúty · bez účtu · nie je to investičné poradenstvo', startNote: 'Pár krátkych otázok + vaše vlastné slová',
      goalEb: 'Vaše rozhodnutie', goalH: 'Čo zvažujete?', goalP: 'Vyberte to, čo je najbližšie.', goalHint: 'Rovnaké kategórie používa Partner Finder.',
      goals: [['buy', 'Kúpiť Bitcoin', 'Prvý nákup alebo väčšia jednorazová suma'], ['dca', 'Pravidelne dokupovať', 'Mesačne alebo týždenne'], ['loan', 'Pôžička so zábezpekou v Bitcoine', 'Hotovosť bez predaja'], ['sell', 'Predať časť Bitcoinu', 'Výber zisku, nákup niečoho iného'], ['treasury', 'Bitcoin vo firme', 'Časť hotovosti firmy do BTC'], ['custody', 'Úschova a dedičstvo', 'Kľúče, multisig, kto sa k BTC dostane']],
      textH: 'Opíšte ho vlastnými slovami.', textP: 'Suma, čas, odkiaľ peniaze idú. Jedna až tri vety stačia.', textHint: 'Alebo začnite od príkladu a upravte ho.',
      textPh: 'Napríklad: Chcem kúpiť Bitcoin za 10 000 € z úspor a držať ho 5 rokov.', textWarn: 'Nepíšte mená, kontakty, čísla účtov, adresy peňaženiek ani zdravotné údaje. Text neukladáme v databáze Virtuse; na vyhodnotenie ho spracúva Anthropic (USA).', textShort: 'Aspoň jedna veta',
      sugg: { buy: ['Chcem kúpiť Bitcoin za 10 000 € z úspor a držať ho 5 rokov.', 'Zvažujem dať do Bitcoinu polovicu peňazí z predaja bytu.'], dca: ['Chcem každý mesiac kupovať Bitcoin za 200 € najbližších 10 rokov.', 'Chcem presunúť sporenie z ETF do Bitcoinu, 300 € mesačne.'], loan: ['Chcem si požičať 20 000 € oproti 0,5 BTC na rekonštrukciu.', 'Zvažujem pôžičku so zábezpekou v Bitcoine namiesto hypotéky.'], sell: ['Chcem predať 30 % Bitcoinu a kúpiť auto.', 'Rozmýšľam, či predať časť po raste o 80 %.'], treasury: ['Chcem dať 20 % hotovosti firmy do Bitcoinu na 5 rokov.', 'Firma má 200 000 € rezervu, uvažujeme o 10 % v BTC.'], custody: ['Chcem presunúť Bitcoin z burzy na hardvérovú peňaženku.', 'Chcem, aby sa manželka dostala k môjmu Bitcoinu, ak sa mi niečo stane.'] },
      howEb: 'Ako to funguje', howH: '10 signálov. Jeden poctivý obraz.', howP: 'Každé rozhodnutie hodnotíme rovnako, aby ste videli, kde naozaj stojí. Ďalších {n} otázok dá AI údaje, ktoré by inak hádala.', howNote: 'Ukážkové body, nie vaše. Každý signál 0 až 10, skóre je ich súčet zaokrúhlený na 5.',
      howTabs: { 'Riziko': [['Najhorší scenár', 7], ['Likvidita', 5], ['Plán B', 4]], 'Dane a úschova': [['Dane', 6], ['Úschova a dedičstvo', 3], ['Alternatívy', 7]], 'Plán': [['Cieľ', 8], ['Časový horizont', 7], ['Pravidlo, nie emócia', 5]] },
      about: 'O vás', plan: 'Váš plán',
      q: {
        country: ['V ktorej krajine platíte dane?', 'Pravidlá pre Bitcoin sa medzi krajinami výrazne líšia.', 'Pomôže AI posúdiť signál Dane. Rovnakú odpoveď použijú Tax Agent a Partner Finder.'],
        experience: ['Vlastníte už Bitcoin?', 'Podľa toho Partner Finder vyberie partnerov pre začiatočníkov alebo pokročilých.', 'Použije Partner Finder. AI to berie ako kontext.'],
        amount: ['O akú sumu ide?', 'Približne stačí.', 'Pomôže AI posúdiť Najhorší scenár (prepad v eurách). Použijú ju Partner Finder a Stacking Strategist.'],
        share: ['Koľko z vášho majetku to bude?', 'Odhad stačí. Rátajte úspory a investície, nie bývanie.', 'Ovplyvní signál Asymetria a pomôže posúdiť Najhorší scenár.'],
        horizon: ['Kedy môžete tieto peniaze potrebovať?', 'Bitcoin môže padnúť o 70 % a roky sa nevrátiť.', 'Ovplyvní signál Časový horizont a pomôže posúdiť Likviditu.'],
        reserve: ['Máte bokom rezervu aspoň na 6 mesiacov výdavkov?', 'Mimo Bitcoinu, v hotovosti alebo na účte.', 'Ovplyvní signál Likvidita a pomôže posúdiť Plán B.'],
        keys: ['Kto bude držať kľúče a kto o nich vie?', 'Úschova je časť rozhodnutia, nie detail.', 'Ovplyvní signál Úschova a dedičstvo.'],
        drop: ['Bitcoin padne o 70 %. Čo urobíte?', 'Odpovedzte podľa toho, čo by ste naozaj urobili.', 'Ovplyvní signály Najhorší scenár a Pravidlo, nie emócia.'],
        aim: ['Čo má toto rozhodnutie dosiahnuť?', 'Vyberte, čo je najbližšie. Číslo a termín môžete dopísať do vlastného textu.', 'Ovplyvní signál Cieľ.'],
        tax_known: ['Viete, ako sa vo vašej krajine zdaní predaj?', 'Napríklad sadzba, oslobodenie po čase držby alebo či sa zdaňuje aj výmena kryptomien.', 'Ovplyvní signál Dane.'],
        ruleset: ['Máte napísané pravidlo, kedy dokúpite alebo predáte?', 'Napríklad: dokúpim pri poklese o 30 %, predám desatinu pri dvojnásobku.', 'Ovplyvní signál Pravidlo, nie emócia.'],
        holdtime: ['Ako dlho Bitcoin, ktorý chcete predať, držíte?', 'V niektorých krajinách závisí daň od času držby.', 'Ovplyvní signál Časový horizont a pomôže posúdiť Dane.'],
        basis: ['Viete, za koľko ste ho kúpili?', 'Nákupná cena je základ pre výpočet dane.', 'Pomôže AI posúdiť signál Dane.'],
        ltv: ['Aká veľká bude pôžička oproti hodnote zábezpeky?', 'LTV: pôžička delená hodnotou Bitcoinu v zábezpeke.', 'Pomôže AI posúdiť Najhorší scenár.'],
        liqprice: ['Viete, pri akej cene Bitcoinu by zábezpeku zlikvidovali?', 'Pri tejto cene veriteľ predá zábezpeku.', 'Ovplyvní signál Najhorší scenár.'],
        runway: ['Na koľko mesiacov vystačí firme hotovosť bez Bitcoinu?', 'Bežné náklady firmy bez predaja BTC.', 'Ovplyvní signál Likvidita.'],
        board: ['Schválilo to predstavenstvo alebo vlastníci?', 'Pravidlá pre Bitcoin vo firme by mali byť písomne schválené.', 'Ovplyvní signál Pravidlo, nie emócia.'],
        heirs: ['Vedia vaši dedičia, ako sa k Bitcoinu dostať?', 'Bez toho, aby dopredu poznali seed frázu.', 'Ovplyvní signál Úschova a dedičstvo.'],
        custody_pref: ['Ako chcete mať Bitcoin v úschove?', 'Podľa toho Partner Finder ukáže partnerov, ktorí spĺňajú vaše kritériá.', 'Použije Partner Finder. AI to berie ako kontext.'],
        freq: ['Ako často chcete nakupovať?', 'Rovnakú odpoveď použije Stacking Strategist.', 'Použije Stacking Strategist. AI to berie ako kontext.']
      },
      dropAmt: { s: ['menej ako 1 000 €', 'menej ako 300 €'], m: ['1 000 až 10 000 €', 'asi 300 až 3 000 €'], l: ['10 000 až 100 000 €', 'asi 3 000 až 30 000 €'], xl: ['viac ako 100 000 €', 'viac ako 30 000 €'] },
      dropSub: function (a) { return a ? 'Pri sume ' + a[0] + ' by zostalo ' + a[1] + '. Odpovedzte podľa toho, čo by ste naozaj urobili.' : 'Z každých 1 000 € by zostalo asi 300 €. Odpovedzte podľa toho, čo by ste naozaj urobili.'; },
      opts: {
        country: [['sk', 'Slovensko'], ['cz', 'Česko'], ['at', 'Rakúsko'], ['de', 'Nemecko'], ['pl', 'Poľsko'], ['hu', 'Maďarsko'], ['si', 'Slovinsko'], ['hr', 'Chorvátsko'], ['ro', 'Rumunsko'], ['bg', 'Bulharsko'], ['nl', 'Holandsko'], ['fr', 'Francúzsko'], ['es', 'Španielsko'], ['other', 'Iná krajina']],
        experience: [['new', 'Ešte nie, bude to prvý nákup'], ['hodler', 'Áno, už nejaký mám']],
        amount: [['s', 'Menej ako 1 000 €'], ['m', '1 000 až 10 000 €'], ['l', '10 000 až 100 000 €'], ['xl', 'Viac ako 100 000 €']],
        share: [['lt5', 'Menej ako 5 %'], ['5_20', '5 až 20 %'], ['20_50', '20 až 50 %'], ['gt50', 'Viac ako polovica']],
        horizon: [['lt1', 'Do 1 roka'], ['1_4', 'O 1 až 4 roky'], ['gt4', 'O viac ako 4 roky'], ['never', 'Neplánujem ich minúť']],
        reserve: [['yes', 'Áno'], ['part', 'Čiastočne'], ['no', 'Nie']],
        keys: [['exch', 'Burza alebo aplikácia'], ['self', 'Ja, vo vlastnej peňaženke'], ['selfplan', 'Ja, a blízky vie, ako sa k nim dostať'], ['multisig', 'Multisig s viacerými kľúčmi']],
        drop: [['buy', 'Dokúpim podľa vopred daného pravidla'], ['hold', 'Podržím, nič nerobím'], ['sell', 'Predám časť alebo všetko']],
        aim: [['retire', 'Peniaze na dôchodok'], ['grow', 'Dlhodobo zhodnotiť úspory'], ['purchase', 'Konkrétny nákup alebo cieľ'], ['family', 'Niečo pre deti alebo dedičov']],
        tax_known: [['yes', 'Áno, poznám pravidlo'], ['roughly', 'Približne'], ['no', 'Nie']],
        ruleset: [['yes', 'Áno, mám ho napísané'], ['roughly', 'Približne, mám ho v hlave'], ['no', 'Nie']],
        holdtime: [['lt1', 'Menej ako rok'], ['1_3', '1 až 3 roky'], ['gt3', 'Viac ako 3 roky']],
        basis: [['yes', 'Áno, mám záznamy'], ['roughly', 'Približne'], ['no', 'Nie']],
        ltv: [['lt30', 'Menej ako 30 %'], ['30_50', '30 až 50 %'], ['gt50', 'Viac ako 50 %']],
        liqprice: [['yes', 'Áno, poznám ju'], ['no', 'Nie']],
        runway: [['lt12', 'Menej ako 12 mesiacov'], ['12_24', '12 až 24 mesiacov'], ['gt24', 'Viac ako 24 mesiacov']],
        board: [['yes', 'Áno'], ['pending', 'Čaká na schválenie'], ['no', 'Nie']],
        heirs: [['yes', 'Áno, majú postup'], ['no', 'Nie']],
        custody_pref: [['self', 'Vlastné kľúče'], ['assisted', 'Asistovaná úschova (pomoc s kľúčmi a obnovou)'], ['any', 'Je mi to jedno']],
        freq: [['weekly', 'Týždenne'], ['monthly', 'Mesačne']]
      },
      ctxEb: 'Váš kontext', ctxH: 'Vaše rozhodnutie má teraz pevný rámec.', ctxP: 'Väčšina rozhodnutí zlyhá na tom, čo sa nepovedalo nahlas: kedy budete peniaze potrebovať, čo urobíte pri prepade a kto sa k nim dostane. AI vaše odpovede zohľadní. Čo napíšete vlastnými slovami, váži viac.',
      ctxWhat: 'Čo zvažujete', ctxLimits: 'Vaše hranice',
      focusH: 'Čo chcete zistiť najviac?', focusP: 'Na to sa vo verdikte zameriame.', focusHint: 'Vyberte jedno alebo viac.', picked: ' vybrané', pickOne: 'Vyberte aspoň jedno',
      focus: [['risk', 'Kde je najväčšie riziko?'], ['drop', 'Zvládnem to pri prepade?'], ['tax', 'Čo s daňami a úschovou?'], ['next', 'Čo mi v pláne chýba?']],
      revEb: 'Posledná kontrola', revH: 'Takto vaše rozhodnutie pochopíme.', revP: 'Opravte, čo nesedí. Presne toto pôjde do hodnotenia.', edit: '✎ Upraviť', none: 'Neuvedené', notYet: 'Zatiaľ neviem', otherGoal: 'Niečo iné',
      rev: { goal: 'Čo zvažujete', text: 'Vlastnými slovami', country: 'Krajina', experience: 'Bitcoin už vlastníte', amount: 'Suma', share: 'Podiel na majetku', horizon: 'Kedy peniaze potrebujete', reserve: 'Rezerva na 6 mesiacov', keys: 'Kľúče', drop: 'Pri prepade o 70 %', aim: 'Čo má dosiahnuť', tax_known: 'Zdanenie predaja', ruleset: 'Napísané pravidlo', holdtime: 'Čas držby', basis: 'Nákupná cena', ltv: 'LTV pôžičky', liqprice: 'Cena likvidácie', runway: 'Hotovosť firmy', board: 'Schválenie', heirs: 'Dedičia', custody_pref: 'Preferovaná úschova', freq: 'Ako často' },
      revAi: 'Hodnotí umelá inteligencia (jazykový model od Anthropic). Môže sa mýliť. Nie je to investičné, daňové ani právne poradenstvo.', getVerdict: 'Získať verdikt zadarmo',
      loadH: 'Kontrolujeme vaše rozhodnutie', loadSteps: ['Čítame vaše rozhodnutie a odpovede…', 'Hodnotíme 10 signálov…', 'Hľadáme najslabšie miesto…', 'Pripravujeme 3 ďalšie kroky…'], loadGet: 'Čo dostanete', loadNote: 'Zvyčajne 15 až 30 sekúnd. Nechajte stránku otvorenú.', loadLong: 'Ešte chvíľu, pripravujeme vaše kroky…',
      unlock: [['Všetkých 10 signálov', 'Každý signál s bodmi a dôvodom, napísaným pre vaše rozhodnutie.'], ['Najslabšie miesto', 'Ktorý signál vás ťahá dole a kde ho doplniť.'], ['Chýbajúce otázky', 'Na čo ste nemysleli a čo zvážiť predtým, ako konáte.'], ['Partneri pre vašu kategóriu', 'Partner Finder s vašimi odpoveďami už vyplnenými.']],
      failH: 'Verdict sa nepodarilo načítať.', retry: '↺ Skúsiť znova', network: 'Chyba siete. Skúste to znova.', error: 'Niečo sa pokazilo. Skúste to o chvíľu.',
      resEb: 'Váš verdikt', weakH: 'Najslabšie miesto: ', found: 'Čo Verdict našiel', strongB: 'Silné miesto', weakB: 'Najslabšie miesto', missB: 'Čo chýba', nothing: 'Nič podstatné.', inReport: ' v reporte',
      free: 'Dva signály zadarmo', strongest: 'Najsilnejší', weakest: 'Najslabší', fill: 'Doplniť v ',
      lockedH: ' ďalších signálov je v reporte', lockedP: 'Každý s bodmi a dôvodom, napísaným pre vaše rozhodnutie.', lockedCta: '🔒 Zapísať sa na report za 14 €',
      nextH: 'Váš ďalší krok', nextB: 'Doplňte najslabšie miesto', open: 'Otvoriť →',
      pfH: 'Partneri pre vašu kategóriu', pfP: 'Partner Finder už pozná vaše odpovede a ukazuje partnerov, ktorí spĺňajú vaše kritériá. Poradie určujú pevné pravidlá, nie provízia. Vyberáte vy.',
      pfNote: 'Partnerské odkazy: ak sa zaregistrujete, Virtuse môže dostať províziu, vaša cena sa nemení.', pfOpen: 'Otvoriť Partner Finder na celej stránke →',
      repH: 'Celý report', repT: 'Viac istoty, kým konáte.', repP: 'Nájdite slabé miesta skôr, ako vás budú stáť peniaze.', repList: ['Všetkých 10 signálov s bodmi a dôvodmi', 'Všetky chýbajúce otázky pre vaše rozhodnutie', 'Plán krokov s nástrojmi Virtuse', 'PDF, ktoré si ponecháte, bez predplatného'],
      once: 'Jednorazovo', noSub: 'Žiadne predplatné.', waitNote: 'Platby ešte nespúšťame. Nechajte e-mail a dáme vám vedieť, keď sa report otvorí.',
      wantPh: 'Váš e-mail', wantBtn: 'Dajte mi vedieť', wantOk: 'Ste na zozname. Napíšeme vám raz, keď sa report otvorí.', wantBad: 'Zadajte platný e-mail.',
      wantNote: 'Uložíme len váš e-mail, text rozhodnutia nie. Odhlásiť sa môžete jedným kliknutím z e-mailu.', privacy: 'Súkromie',
      prevBadge: 'Náhľad reportu', prevNote: 'Náhľad reportu na testovanie (?report=1). Bez ?report=1 vidíte to, čo návštevník: verdikt, 3 kroky, 2 oblasti, partnerov a ceny.',
      allH: 'Všetkých 10 signálov', missAllH: 'Chýbajúce otázky', planH: 'Plán krokov', planP: 'Signály pod 7 bodov, od najslabšieho. Každý s nástrojom, kde ho doplníte.', planNone: 'Všetky signály majú aspoň 7 bodov.', pdf: 'Uložiť ako PDF', pts: ' b.',
      R: {
        nextH: 'Váš ďalší krok', again2: 'Ohodnotiť znova', open: 'Otvoriť',
        improve: 'Ako zlepšiť toto skóre?',
        tip: { worst_case: 'Na 10 bodov: dopad poklesu o 70 % v eurách a plán, ako ho prečkať.', liquidity: 'Na 10 bodov: rezerva v mesiacoch výdavkov, nezávislá od ceny Bitcoinu.', tax: 'Na 10 bodov: správne pravidlo pre vašu krajinu a odložená suma na daň.', custody: 'Na 10 bodov: úschova, obnova a postup pre dedičov bez zdieľania seed frázy.', plan_b: 'Na 10 bodov: konkrétny spúšťač a konkrétny krok, ak predpoklad neplatí.', goal: 'Na 10 bodov: cieľ s číslom a dátumom.', horizon: 'Na 10 bodov: horizont v súlade s cieľom a čo by vás prinútilo predať skôr.', alternatives: 'Na 10 bodov: aspoň dve porovnané možnosti s dôvodom voľby.', rule: 'Na 10 bodov: napísané pravidlo vrátane toho, kedy ho zmeníte.', asymmetry: 'Na 10 bodov: veľkosť odôvodnená stratou, ktorú unesiete.' },
        openQ: 'Otázka, na ktorú zatiaľ nemáte odpoveď', lockedH: function (n) { return 'Ďalších ' + n + ' signálov je v reporte'; },
        inside: 'Čo je v reporte', faqH: 'Pred odomknutím',
        faq: [['Je to investičné poradenstvo?', 'Nie. Report hodnotí, nakoľko úplne je opísaná vaša úvaha. Nehovorí, či kúpiť, predať alebo počkať.'], ['Čo sa stane s mojím textom?', 'Text neukladáme v databáze Virtuse. Na vyhodnotenie ho spracúva Anthropic (USA). Pre report si necháme len váš e-mail.'], ['Kedy sa report otvorí?', 'Platby ešte nespúšťame. Kto nechá e-mail, dostane jednu správu, keď sa report otvorí.']],
        pfH: 'Partneri pre vašu kategóriu',
        pfP: 'Keď doplníte medzery: partneri v kategórii, ktorí spĺňajú vaše kritériá. Poradie určujú pevné pravidlá, nie provízia. Porovnávate a vyberáte vy.',
        pfShow: 'Zobraziť partnerov', sticky: 'Zapísať sa na report',
        group: { risk: 'Riziko', taxc: 'Dane a úschova', plan: 'Plán' }, planH: 'Plán krokov', pdfTitle: 'Verdict',
        nameL: 'Názov rozhodnutia (nepovinné)', namePh: 'Napríklad: Bitcoin na dôchodok', nameNote: 'Uvidíte ho len vy, vo výsledku a v PDF. Neposielame ho.',
        progress: 'Váš postup', of: ' z ', secs: ' s',
        stored: 'Odpovede si pamätá len tento prehliadač, aby ste ich v ďalších nástrojoch nemuseli písať znova.', forget: 'Zabudnúť moje odpovede',
        consultH: 'Chcete si rozhodnutie prejsť s človekom?', consultP: 'Osobná konzultácia: 15 minút, zadarmo, bez predaja.', consultBtn: 'Rezervovať konzultáciu'
      },
      declinedH: 'Verdict to nevie ohodnotiť.', again: '↺ Ohodnotiť ďalšie rozhodnutie', decision: 'Rozhodnutie'
    },
    en: {
      steps: ['Decision', 'About you', 'Your plan', 'Verdict'], back: '← Back', cont: 'Continue', start: 'Start', skip: '? Not sure yet', other: 'Something else, I will describe it',
      closedH: 'Verdict opens soon.', closedP: 'Join the list and we will tell you.', closedCta: 'To the Virtuse CFO page',
      startEb: 'Verdict · free', startH: 'Check your Bitcoin decision. <span>Empower investors to make smart decisions.</span>',
      startP: 'Before you buy, sell or borrow, test your decision on 10 signals. First we ask what the AI needs to know, then you get your verdict.',
      startHint: 'About 2 minutes · no account · not investment advice', startNote: 'A few short questions + your own words',
      goalEb: 'Your decision', goalH: 'What are you considering?', goalP: 'Pick the closest one.', goalHint: 'Partner Finder uses the same categories.',
      goals: [['buy', 'Buy Bitcoin', 'A first purchase or a larger lump sum'], ['dca', 'Buy regularly', 'Monthly or weekly'], ['loan', 'Bitcoin-backed loan', 'Cash without selling'], ['sell', 'Sell part of my Bitcoin', 'Take profit, buy something else'], ['treasury', 'Bitcoin in my company', 'Part of company cash into BTC'], ['custody', 'Custody and inheritance', 'Keys, multisig, who can reach the BTC']],
      textH: 'Describe it in your own words.', textP: 'Amount, timing, where the money comes from. One to three sentences are enough.', textHint: 'Or start from an example and edit it.',
      textPh: 'For example: I want to buy €10,000 of Bitcoin from savings and hold it for 5 years.', textWarn: "Don't write names, contact details, account numbers, wallet addresses or health details. We don't store the text in the Virtuse database; Anthropic (USA) processes it to assess it.", textShort: 'At least one sentence',
      sugg: { buy: ['I want to buy €10,000 of Bitcoin from savings and hold it for 5 years.', "I'm thinking of putting half the money from selling my flat into Bitcoin."], dca: ['I want to buy €200 of Bitcoin every month for the next 10 years.', 'I want to move my €300 monthly ETF savings into Bitcoin.'], loan: ['I want to borrow €20,000 against 0.5 BTC for a renovation.', "I'm considering a Bitcoin-backed loan instead of a mortgage."], sell: ['I want to sell 30% of my Bitcoin and buy a car.', "I'm wondering whether to sell some after an 80% rise."], treasury: ["I want to put 20% of my company's cash into Bitcoin for 5 years.", 'The company has a €200,000 reserve; we are considering 10% in BTC.'], custody: ['I want to move my Bitcoin from an exchange to a hardware wallet.', 'I want my wife to be able to reach my Bitcoin if something happens to me.'] },
      howEb: 'How it works', howH: '10 signals. One honest picture.', howP: 'Every decision is scored the same way, so you can see where yours really stands. The next {n} questions give the AI what it would otherwise guess.', howNote: 'Example scores, not yours. Each signal is scored 0 to 10; the score is their sum, rounded to 5.',
      howTabs: { 'Risk': [['Worst case', 7], ['Liquidity', 5], ['Plan B', 4]], 'Tax and custody': [['Tax', 6], ['Custody and inheritance', 3], ['Alternatives', 7]], 'Plan': [['Goal', 8], ['Time horizon', 7], ['Rule, not emotion', 5]] },
      about: 'About you', plan: 'Your plan',
      q: {
        country: ['Where do you pay tax?', 'Bitcoin tax rules differ a lot between countries.', 'Helps the AI judge the Tax signal. Tax Agent and Partner Finder use the same answer.'],
        experience: ['Do you already own Bitcoin?', 'Partner Finder uses this to show partners for beginners or experienced holders.', 'Used by Partner Finder. The AI takes it as context.'],
        amount: ['How much money is involved?', 'Roughly is fine.', 'Helps the AI judge the Worst case (a fall in euros). Used by Partner Finder and Stacking.'],
        share: ['What share of your wealth is it?', 'An estimate is enough. Count savings and investments, not your home.', 'Affects the Asymmetry signal and helps judge the Worst case.'],
        horizon: ['When might you need this money?', 'Bitcoin can fall 70% and take years to recover.', 'Affects the Time horizon signal and helps judge Liquidity.'],
        reserve: ['Do you have a reserve for at least 6 months of expenses?', 'Outside Bitcoin, in cash or a bank account.', 'Affects the Liquidity signal and helps judge Plan B.'],
        keys: ['Who will hold the keys, and who knows about them?', 'Custody is part of the decision, not a detail.', 'Affects the Custody and inheritance signal.'],
        drop: ['Bitcoin falls 70%. What do you do?', 'Answer with what you would really do.', 'Affects the Worst case and Rule, not emotion signals.'],
        aim: ['What should this decision achieve?', 'Pick the closest. You can add a number and a date in your own words.', 'Affects the Goal signal.'],
        tax_known: ['Do you know how a sale is taxed in your country?', 'For example the rate, an exemption after a holding period, or whether swapping coins is taxed.', 'Affects the Tax signal.'],
        ruleset: ['Do you have a written rule for when to buy more or sell?', 'For example: buy more after a 30% fall, sell a tenth when the price doubles.', 'Affects the Rule, not emotion signal.'],
        holdtime: ['How long have you held the Bitcoin you want to sell?', 'In some countries the tax depends on the holding period.', 'Affects the Time horizon signal and helps judge Tax.'],
        basis: ['Do you know what you paid for it?', 'The purchase price is the basis for the tax.', 'Helps the AI judge the Tax signal.'],
        ltv: ['How big is the loan compared with the collateral?', 'LTV: the loan divided by the value of the Bitcoin held as collateral.', 'Helps the AI judge the Worst case.'],
        liqprice: ['Do you know the Bitcoin price at which the loan would be liquidated?', 'At that price the lender sells the collateral.', 'Affects the Worst case signal.'],
        runway: ['How many months can the company run on cash without the Bitcoin?', 'Normal company costs without selling BTC.', 'Affects the Liquidity signal.'],
        board: ['Has the board or have the owners approved it?', 'Rules for Bitcoin in a company should be approved in writing.', 'Affects the Rule, not emotion signal.'],
        heirs: ['Do your heirs know how to reach the Bitcoin?', 'Without knowing the seed phrase in advance.', 'Affects the Custody and inheritance signal.'],
        custody_pref: ['How do you want your Bitcoin held?', 'Partner Finder uses this to show partners that meet your criteria.', 'Used by Partner Finder. The AI takes it as context.'],
        freq: ['How often do you want to buy?', 'Stacking Strategist uses the same answer.', 'Used by Stacking Strategist. The AI takes it as context.']
      },
      dropAmt: { s: ['under €1,000', 'under €300'], m: ['€1,000 to 10,000', 'about €300 to 3,000'], l: ['€10,000 to 100,000', 'about €3,000 to 30,000'], xl: ['over €100,000', 'over €30,000'] },
      dropSub: function (a) { return a ? 'An amount of ' + a[0] + ' would be worth ' + a[1] + '. Answer with what you would really do.' : 'Every €1,000 would be worth about €300. Answer with what you would really do.'; },
      opts: {
        country: [['sk', 'Slovakia'], ['cz', 'Czechia'], ['at', 'Austria'], ['de', 'Germany'], ['pl', 'Poland'], ['hu', 'Hungary'], ['si', 'Slovenia'], ['hr', 'Croatia'], ['ro', 'Romania'], ['bg', 'Bulgaria'], ['nl', 'Netherlands'], ['fr', 'France'], ['es', 'Spain'], ['other', 'Another country']],
        experience: [['new', 'Not yet, this will be my first purchase'], ['hodler', 'Yes, I already have some']],
        amount: [['s', 'Under €1,000'], ['m', '€1,000 to 10,000'], ['l', '€10,000 to 100,000'], ['xl', 'Over €100,000']],
        share: [['lt5', 'Under 5%'], ['5_20', '5 to 20%'], ['20_50', '20 to 50%'], ['gt50', 'More than half']],
        horizon: [['lt1', 'Within 1 year'], ['1_4', 'In 1 to 4 years'], ['gt4', 'In more than 4 years'], ['never', "I don't plan to spend it"]],
        reserve: [['yes', 'Yes'], ['part', 'Partly'], ['no', 'No']],
        keys: [['exch', 'An exchange or app'], ['self', 'Me, in my own wallet'], ['selfplan', 'Me, and someone close knows how to reach them'], ['multisig', 'A multisig with several keys']],
        drop: [['buy', 'Buy more by a rule set in advance'], ['hold', 'Hold, do nothing'], ['sell', 'Sell some or all']],
        aim: [['retire', 'Money for retirement'], ['grow', 'Grow savings over the long term'], ['purchase', 'A specific purchase or goal'], ['family', 'Something for children or heirs']],
        tax_known: [['yes', 'Yes, I know the rule'], ['roughly', 'Roughly'], ['no', 'No']],
        ruleset: [['yes', 'Yes, written down'], ['roughly', 'Roughly, in my head'], ['no', 'No']],
        holdtime: [['lt1', 'Under a year'], ['1_3', '1 to 3 years'], ['gt3', 'Over 3 years']],
        basis: [['yes', 'Yes, I have records'], ['roughly', 'Roughly'], ['no', 'No']],
        ltv: [['lt30', 'Under 30%'], ['30_50', '30 to 50%'], ['gt50', 'Over 50%']],
        liqprice: [['yes', 'Yes, I know it'], ['no', 'No']],
        runway: [['lt12', 'Under 12 months'], ['12_24', '12 to 24 months'], ['gt24', 'Over 24 months']],
        board: [['yes', 'Yes'], ['pending', 'Pending'], ['no', 'No']],
        heirs: [['yes', 'Yes, they have a procedure'], ['no', 'No']],
        custody_pref: [['self', 'My own keys'], ['assisted', 'Assisted custody (help with keys and recovery)'], ['any', 'No preference']],
        freq: [['weekly', 'Weekly'], ['monthly', 'Monthly']]
      },
      ctxEb: 'Your context', ctxH: 'Your decision now has a clear frame.', ctxP: "Most decisions fail on what was never said out loud: when you'll need the money, what you'll do in a fall and who can reach it. The AI takes your answers into account. What you write in your own words counts more.",
      ctxWhat: "What you're considering", ctxLimits: 'Your limits',
      focusH: 'What do you most want to find out?', focusP: "That's where the verdict will focus.", focusHint: 'Pick one or more.', picked: ' selected', pickOne: 'Pick at least one',
      focus: [['risk', "Where's the biggest risk?"], ['drop', 'Can I get through a fall?'], ['tax', 'What about tax and custody?'], ['next', "What's missing in my plan?"]],
      revEb: 'Final check', revH: "Here's how we understood your decision.", revP: "Change anything that doesn't sound right. This is exactly what gets assessed.", edit: '✎ Edit', none: 'Not given', notYet: 'Not sure yet', otherGoal: 'Something else',
      rev: { goal: "What you're considering", text: 'In your own words', country: 'Country', experience: 'Already own Bitcoin', amount: 'Amount', share: 'Share of wealth', horizon: 'When you need the money', reserve: '6-month reserve', keys: 'Keys', drop: 'In a 70% fall', aim: 'What it should achieve', tax_known: 'Tax on a sale', ruleset: 'Written rule', holdtime: 'Holding period', basis: 'Purchase price', ltv: 'Loan LTV', liqprice: 'Liquidation price', runway: 'Company cash runway', board: 'Approval', heirs: 'Heirs', custody_pref: 'Preferred custody', freq: 'How often' },
      revAi: 'This assessment is generated by artificial intelligence (a language model by Anthropic). It may be wrong. It is not investment, tax or legal advice.', getVerdict: 'Get my free verdict',
      loadH: 'Checking your decision', loadSteps: ['Reading your decision and answers…', 'Scoring 10 signals…', 'Finding the weakest point…', 'Preparing your 3 next steps…'], loadGet: 'What you get', loadNote: 'Usually 15 to 30 seconds. Keep this page open.', loadLong: 'Almost there, preparing your steps…',
      unlock: [['All 10 signals', 'Each signal scored, with a reason written for your decision.'], ['The weakest point', 'Which signal pulls you down and where to fill it in.'], ['Missing questions', "What you haven't considered before you act."], ['Partners for your category', 'Partner Finder with your answers already filled in.']],
      failH: "Verdict couldn't load.", retry: '↺ Try again', network: 'Network error. Please try again.', error: 'Something went wrong. Please try again in a moment.',
      resEb: 'Your verdict', weakH: 'Weakest point: ', found: 'What Verdict found', strongB: 'Strong point', weakB: 'Weakest point', missB: "What's missing", nothing: 'Nothing major.', inReport: ' in the report',
      free: 'Two signals free', strongest: 'Strongest', weakest: 'Weakest', fill: 'Fill it in with ',
      lockedH: ' more signals are in the report', lockedP: 'Each scored, with a reason written for your decision.', lockedCta: '🔒 Join the waitlist for the €14 report',
      nextH: 'Your next step', nextB: 'Fill in the weakest point', open: 'Open →',
      pfH: 'Partners for your category', pfP: 'Partner Finder already has your answers and shows the partners that meet your criteria. Fixed rules set the order, not commission. You choose.',
      pfNote: 'Partner links: if you sign up, Virtuse may receive a commission. Your price does not change.', pfOpen: 'Open Partner Finder full page →',
      repH: 'Full report', repT: 'More certainty before you act.', repP: 'Find the gaps before they cost you money.', repList: ['All 10 signals with scores and reasons', 'Every missing question for your decision', 'A step-by-step plan with Virtuse tools', 'A PDF to keep, no subscription'],
      once: 'One-time', noSub: 'No subscription.', waitNote: "Payments aren't open yet. Leave your email and we'll tell you when the report opens.",
      wantPh: 'Your email', wantBtn: 'Let me know', wantOk: "You're on the list. We'll write once, when the report opens.", wantBad: 'Enter a valid email.',
      wantNote: 'We keep only your email, not your decision text. Leave with one click from the email.', privacy: 'Privacy',
      prevBadge: 'Report preview', prevNote: 'Report preview for testing (?report=1). Without ?report=1 you see what a visitor sees: the verdict, 3 steps, 2 areas, partners and pricing.',
      allH: 'All 10 signals', missAllH: 'Missing questions', planH: 'Step-by-step plan', planP: 'Signals under 7 points, weakest first. Each with the tool where you fill it in.', planNone: 'Every signal has at least 7 points.', pdf: 'Save as PDF', pts: ' pts',
      R: {
        nextH: 'Your next step', again2: 'Rate again', open: 'Open',
        improve: 'How can this score improve?',
        tip: { worst_case: 'For 10 points: what a 70% fall means in euros and a plan to get through it.', liquidity: 'For 10 points: a reserve in months of expenses, independent of the Bitcoin price.', tax: 'For 10 points: the right rule for your country and the tax set aside.', custody: 'For 10 points: custody, recovery and a procedure for heirs without sharing the seed phrase.', plan_b: 'For 10 points: a concrete trigger and a concrete step if an assumption fails.', goal: 'For 10 points: a goal with a number and a date.', horizon: 'For 10 points: a horizon that fits the goal, and what would force an earlier sale.', alternatives: 'For 10 points: at least two options compared, with a reason for the choice.', rule: 'For 10 points: a written rule, including when you would change it.', asymmetry: 'For 10 points: a size justified by the loss you can carry.' },
        openQ: "A question you haven't answered yet", lockedH: function (n) { return n + ' more signals are in the report'; },
        inside: "What's in the report", faqH: 'Before you unlock',
        faq: [['Is this investment advice?', 'No. The report rates how completely your thinking is described. It never says whether to buy, sell or wait.'], ['What happens to my text?', "We don't store it in the Virtuse database. Anthropic (USA) processes it to assess it. For the report we keep only your email."], ['When does the report open?', "Payments aren't open yet. If you leave your email, you get one message when the report opens."]],
        pfH: 'Partners for your category',
        pfP: "When you've filled the gaps: partners in this category that match your criteria. Fixed rules set the order, not commission. You compare and choose.",
        pfShow: 'Show partners', sticky: 'Join the report waitlist',
        group: { risk: 'Risk', taxc: 'Tax and custody', plan: 'Plan' }, planH: 'Step-by-step plan', pdfTitle: 'Verdict',
        nameL: 'Decision name (optional)', namePh: 'For example: Bitcoin for retirement', nameNote: 'Only you see it, in the result and the PDF. We do not send it.',
        progress: 'Your progress', of: ' of ', secs: ' s',
        stored: 'Only this browser remembers your answers, so other tools need not ask again.', forget: 'Forget my answers',
        consultH: 'Would you like to go through your decision with a person?', consultP: 'Personal consultation: 15 minutes, free, no sales pitch.', consultBtn: 'Book a 15-minute call'
      },
      declinedH: "Verdict can't rate this.", again: '↺ Rate another decision', decision: 'Decision'
    },
    ru: {
      steps: ['Решение', 'О вас', 'Ваш план', 'Вердикт'], back: '← Назад', cont: 'Продолжить', start: 'Начать', skip: '? Пока не знаю', other: 'Другое, опишу сам(а)',
      closedH: 'Verdict скоро откроется.', closedP: 'Запишитесь, и мы сообщим вам.', closedCta: 'На страницу Virtuse CFO',
      startEb: 'Verdict · бесплатно', startH: 'Проверьте своё решение о Биткоине. <span>Помогаем инвесторам принимать обдуманные решения.</span>',
      startP: 'Прежде чем покупать, продавать или брать заём, проверьте своё решение по 10 сигналам. Сначала мы спросим то, что нужно знать ИИ, затем вы получите вердикт.',
      startHint: 'Около 2 минут · без аккаунта · не инвестиционная консультация', startNote: 'Несколько коротких вопросов + ваши собственные слова',
      goalEb: 'Ваше решение', goalH: 'Что вы рассматриваете?', goalP: 'Выберите самый близкий вариант.', goalHint: 'Те же категории использует Partner Finder.',
      goals: [['buy', 'Купить Биткоин', 'Первая покупка или крупная разовая сумма'], ['dca', 'Регулярно докупать', 'Ежемесячно или еженедельно'], ['loan', 'Заём под залог Биткоина', 'Деньги без продажи'], ['sell', 'Продать часть Биткоина', 'Фиксация прибыли, покупка чего-то другого'], ['treasury', 'Биткоин в компании', 'Часть денег компании в BTC'], ['custody', 'Хранение и наследство', 'Ключи, мультиподпись, кто получит доступ к BTC']],
      textH: 'Опишите его своими словами.', textP: 'Сумма, сроки, откуда деньги. Достаточно одного-трёх предложений.', textHint: 'Или начните с примера и измените его.',
      textPh: 'Например: Хочу купить Биткоин на 10 000 € из сбережений и держать его 5 лет.', textWarn: 'Не указывайте имена, контакты, номера счетов, адреса кошельков и данные о здоровье. Мы не сохраняем текст в базе данных Virtuse; для оценки его обрабатывает Anthropic (США).', textShort: 'Хотя бы одно предложение',
      sugg: { buy: ['Хочу купить Биткоин на 10 000 € из сбережений и держать его 5 лет.', 'Думаю вложить в Биткоин половину денег от продажи квартиры.'], dca: ['Хочу каждый месяц покупать Биткоин на 200 € ближайшие 10 лет.', 'Хочу перевести накопления из ETF в Биткоин, 300 € в месяц.'], loan: ['Хочу занять 20 000 € под залог 0,5 BTC на ремонт.', 'Рассматриваю заём под залог Биткоина вместо ипотеки.'], sell: ['Хочу продать 30% Биткоина и купить машину.', 'Думаю, продавать ли часть после роста на 80%.'], treasury: ['Хочу вложить 20% денег компании в Биткоин на 5 лет.', 'У компании резерв 200 000 €, рассматриваем 10% в BTC.'], custody: ['Хочу перенести Биткоин с биржи на аппаратный кошелёк.', 'Хочу, чтобы жена получила доступ к моему Биткоину, если со мной что-то случится.'] },
      howEb: 'Как это работает', howH: '10 сигналов. Одна честная картина.', howP: 'Каждое решение мы оцениваем одинаково, чтобы вы видели, где оно на самом деле находится. Следующие {n} вопросов дадут ИИ данные, которые он иначе угадывал бы.', howNote: 'Примерные баллы, не ваши. Каждый сигнал от 0 до 10, оценка равна их сумме, округлённой до 5.',
      howTabs: { 'Риск': [['Худший сценарий', 7], ['Ликвидность', 5], ['План Б', 4]], 'Налоги и хранение': [['Налоги', 6], ['Хранение и наследство', 3], ['Альтернативы', 7]], 'План': [['Цель', 8], ['Временной горизонт', 7], ['Правило, а не эмоция', 5]] },
      about: 'О вас', plan: 'Ваш план',
      q: {
        country: ['В какой стране вы платите налоги?', 'Правила для Биткоина в разных странах сильно отличаются.', 'Поможет ИИ оценить сигнал «Налоги». Тот же ответ используют Tax Agent и Partner Finder.'],
        experience: ['У вас уже есть Биткоин?', 'По этому ответу Partner Finder покажет партнёров для новичков или опытных.', 'Использует Partner Finder. ИИ учитывает это как контекст.'],
        amount: ['О какой сумме идёт речь?', 'Достаточно примерно.', 'Поможет ИИ оценить «Худший сценарий» (падение в евро). Используют Partner Finder и Stacking.'],
        share: ['Какую долю вашего капитала это составит?', 'Достаточно оценки. Считайте сбережения и инвестиции, без жилья.', 'Влияет на сигнал «Асимметрия» и помогает оценить «Худший сценарий».'],
        horizon: ['Когда вам могут понадобиться эти деньги?', 'Биткоин может упасть на 70% и годами не восстанавливаться.', 'Влияет на сигнал «Временной горизонт» и помогает оценить ликвидность.'],
        reserve: ['Есть ли у вас резерв хотя бы на 6 месяцев расходов?', 'Вне Биткоина, наличными или на счёте.', 'Влияет на сигнал «Ликвидность» и помогает оценить «План Б».'],
        keys: ['Кто будет хранить ключи и кто о них знает?', 'Хранение является частью решения, а не деталью.', 'Влияет на сигнал «Хранение и наследство».'],
        drop: ['Биткоин упал на 70%. Что вы сделаете?', 'Отвечайте так, как поступили бы на самом деле.', 'Влияет на сигналы «Худший сценарий» и «Правило, а не эмоция».'],
        aim: ['Чего должно достичь это решение?', 'Выберите самый близкий вариант. Сумму и срок можно дописать в своём тексте.', 'Влияет на сигнал «Цель».'],
        tax_known: ['Знаете ли вы, как в вашей стране облагается налогом продажа?', 'Например, ставка, освобождение после срока владения или облагается ли обмен криптовалют.', 'Влияет на сигнал «Налоги».'],
        ruleset: ['Есть ли у вас записанное правило, когда докупать или продавать?', 'Например: докупаю при падении на 30%, продаю десятую часть при удвоении цены.', 'Влияет на сигнал «Правило, а не эмоция».'],
        holdtime: ['Как долго вы держите Биткоин, который хотите продать?', 'В некоторых странах налог зависит от срока владения.', 'Влияет на сигнал «Временной горизонт» и помогает оценить налоги.'],
        basis: ['Знаете ли вы, за сколько его купили?', 'Цена покупки является основой для расчёта налога.', 'Поможет ИИ оценить сигнал «Налоги».'],
        ltv: ['Каким будет заём по отношению к стоимости залога?', 'LTV: заём, делённый на стоимость Биткоина в залоге.', 'Поможет ИИ оценить «Худший сценарий».'],
        liqprice: ['Знаете ли вы, при какой цене Биткоина залог ликвидируют?', 'При этой цене кредитор продаст залог.', 'Влияет на сигнал «Худший сценарий».'],
        runway: ['На сколько месяцев компании хватит денег без Биткоина?', 'Обычные расходы компании без продажи BTC.', 'Влияет на сигнал «Ликвидность».'],
        board: ['Одобрили ли это правление или владельцы?', 'Правила для Биткоина в компании должны быть одобрены письменно.', 'Влияет на сигнал «Правило, а не эмоция».'],
        heirs: ['Знают ли ваши наследники, как получить доступ к Биткоину?', 'Не зная заранее сид-фразу.', 'Влияет на сигнал «Хранение и наследство».'],
        custody_pref: ['Как вы хотите хранить Биткоин?', 'По этому ответу Partner Finder покажет партнёров, которые соответствуют вашим критериям.', 'Использует Partner Finder. ИИ учитывает это как контекст.'],
        freq: ['Как часто вы хотите покупать?', 'Тот же ответ использует Stacking Strategist.', 'Использует Stacking Strategist. ИИ учитывает это как контекст.']
      },
      dropAmt: { s: ['меньше 1 000 €', 'меньше 300 €'], m: ['от 1 000 до 10 000 €', 'примерно от 300 до 3 000 €'], l: ['от 10 000 до 100 000 €', 'примерно от 3 000 до 30 000 €'], xl: ['больше 100 000 €', 'больше 30 000 €'] },
      dropSub: function (a) { return a ? 'Из суммы ' + a[0] + ' осталось бы ' + a[1] + '. Отвечайте так, как поступили бы на самом деле.' : 'Из каждых 1 000 € осталось бы примерно 300 €. Отвечайте так, как поступили бы на самом деле.'; },
      opts: {
        country: [['sk', 'Словакия'], ['cz', 'Чехия'], ['at', 'Австрия'], ['de', 'Германия'], ['pl', 'Польша'], ['hu', 'Венгрия'], ['si', 'Словения'], ['hr', 'Хорватия'], ['ro', 'Румыния'], ['bg', 'Болгария'], ['nl', 'Нидерланды'], ['fr', 'Франция'], ['es', 'Испания'], ['other', 'Другая страна']],
        experience: [['new', 'Пока нет, это будет первая покупка'], ['hodler', 'Да, уже есть']],
        amount: [['s', 'Меньше 1 000 €'], ['m', 'От 1 000 до 10 000 €'], ['l', 'От 10 000 до 100 000 €'], ['xl', 'Больше 100 000 €']],
        share: [['lt5', 'Меньше 5%'], ['5_20', 'От 5 до 20%'], ['20_50', 'От 20 до 50%'], ['gt50', 'Больше половины']],
        horizon: [['lt1', 'В течение года'], ['1_4', 'Через 1–4 года'], ['gt4', 'Больше чем через 4 года'], ['never', 'Не планирую их тратить']],
        reserve: [['yes', 'Да'], ['part', 'Частично'], ['no', 'Нет']],
        keys: [['exch', 'Биржа или приложение'], ['self', 'Я, на собственном кошельке'], ['selfplan', 'Я, а близкий человек знает, как получить доступ'], ['multisig', 'Мультиподпись с несколькими ключами']],
        drop: [['buy', 'Докуплю по заранее заданному правилу'], ['hold', 'Ничего не буду делать'], ['sell', 'Продам часть или всё']],
        aim: [['retire', 'Деньги на пенсию'], ['grow', 'Долгосрочный рост сбережений'], ['purchase', 'Конкретная покупка или цель'], ['family', 'Что-то для детей или наследников']],
        tax_known: [['yes', 'Да, знаю правило'], ['roughly', 'Примерно'], ['no', 'Нет']],
        ruleset: [['yes', 'Да, оно записано'], ['roughly', 'Примерно, держу в голове'], ['no', 'Нет']],
        holdtime: [['lt1', 'Меньше года'], ['1_3', 'От 1 до 3 лет'], ['gt3', 'Больше 3 лет']],
        basis: [['yes', 'Да, есть записи'], ['roughly', 'Примерно'], ['no', 'Нет']],
        ltv: [['lt30', 'Меньше 30%'], ['30_50', 'От 30 до 50%'], ['gt50', 'Больше 50%']],
        liqprice: [['yes', 'Да, знаю'], ['no', 'Нет']],
        runway: [['lt12', 'Меньше 12 месяцев'], ['12_24', 'От 12 до 24 месяцев'], ['gt24', 'Больше 24 месяцев']],
        board: [['yes', 'Да'], ['pending', 'Ожидает одобрения'], ['no', 'Нет']],
        heirs: [['yes', 'Да, у них есть порядок действий'], ['no', 'Нет']],
        custody_pref: [['self', 'Собственные ключи'], ['assisted', 'Хранение с поддержкой (помощь с ключами и восстановлением)'], ['any', 'Без разницы']],
        freq: [['weekly', 'Еженедельно'], ['monthly', 'Ежемесячно']]
      },
      ctxEb: 'Ваш контекст', ctxH: 'У вашего решения теперь есть чёткие рамки.', ctxP: 'Большинство решений проваливается на том, что не было сказано вслух: когда вам понадобятся деньги, что вы сделаете при обвале и кто получит к ним доступ. ИИ учтёт ваши ответы. То, что вы напишете своими словами, весит больше.',
      ctxWhat: 'Что вы рассматриваете', ctxLimits: 'Ваши границы',
      focusH: 'Что вы больше всего хотите узнать?', focusP: 'На этом сосредоточится вердикт.', focusHint: 'Выберите один или несколько вариантов.', picked: ' выбрано', pickOne: 'Выберите хотя бы один',
      focus: [['risk', 'Где самый большой риск?'], ['drop', 'Выдержу ли я обвал?'], ['tax', 'Что с налогами и хранением?'], ['next', 'Чего не хватает в моём плане?']],
      revEb: 'Последняя проверка', revH: 'Так мы поняли ваше решение.', revP: 'Исправьте то, что не так. Именно это пойдёт в оценку.', edit: '✎ Изменить', none: 'Не указано', notYet: 'Пока не знаю', otherGoal: 'Другое',
      rev: { goal: 'Что вы рассматриваете', text: 'Своими словами', country: 'Страна', experience: 'Уже есть Биткоин', amount: 'Сумма', share: 'Доля капитала', horizon: 'Когда нужны деньги', reserve: 'Резерв на 6 месяцев', keys: 'Ключи', drop: 'При падении на 70%', aim: 'Чего достичь', tax_known: 'Налог при продаже', ruleset: 'Записанное правило', holdtime: 'Срок владения', basis: 'Цена покупки', ltv: 'LTV займа', liqprice: 'Цена ликвидации', runway: 'Деньги компании', board: 'Одобрение', heirs: 'Наследники', custody_pref: 'Предпочтительное хранение', freq: 'Как часто' },
      revAi: 'Оценивает искусственный интеллект (языковая модель Anthropic). Он может ошибаться. Это не инвестиционная, налоговая или юридическая консультация.', getVerdict: 'Получить вердикт бесплатно',
      loadH: 'Проверяем ваше решение', loadSteps: ['Читаем ваше решение и ответы…', 'Оцениваем 10 сигналов…', 'Ищем самое слабое место…', 'Готовим 3 следующих шага…'], loadGet: 'Что вы получите', loadNote: 'Обычно от 15 до 30 секунд. Не закрывайте страницу.', loadLong: 'Ещё немного, готовим ваши шаги…',
      unlock: [['Все 10 сигналов', 'Каждый сигнал с баллами и пояснением для вашего решения.'], ['Самое слабое место', 'Какой сигнал тянет вас вниз и где его дополнить.'], ['Недостающие вопросы', 'О чём вы не подумали и что взвесить, прежде чем действовать.'], ['Партнёры для вашей категории', 'Partner Finder с уже заполненными ответами.']],
      failH: 'Не удалось загрузить Verdict.', retry: '↺ Попробовать снова', network: 'Ошибка сети. Попробуйте снова.', error: 'Что-то пошло не так. Попробуйте через минуту.',
      resEb: 'Ваш вердикт', weakH: 'Самое слабое место: ', found: 'Что нашёл Verdict', strongB: 'Сильное место', weakB: 'Самое слабое место', missB: 'Чего не хватает', nothing: 'Ничего существенного.', inReport: ' в отчёте',
      free: 'Два сигнала бесплатно', strongest: 'Самый сильный', weakest: 'Самый слабый', fill: 'Дополнить в ',
      lockedH: ' других сигналов есть в отчёте', lockedP: 'Каждый с баллами и пояснением для вашего решения.', lockedCta: '🔒 Записаться на отчёт за 14 €',
      nextH: 'Ваш следующий шаг', nextB: 'Дополните самое слабое место', open: 'Открыть →',
      pfH: 'Партнёры для вашей категории', pfP: 'Partner Finder уже знает ваши ответы и показывает партнёров, которые соответствуют вашим критериям. Порядок определяют фиксированные правила, а не комиссия. Выбираете вы.',
      pfNote: 'Партнёрские ссылки: если вы зарегистрируетесь, Virtuse может получить комиссию, ваша цена не меняется.', pfOpen: 'Открыть Partner Finder на всю страницу →',
      repH: 'Полный отчёт', repT: 'Больше уверенности, прежде чем действовать.', repP: 'Найдите слабые места до того, как они будут стоить вам денег.', repList: ['Все 10 сигналов с баллами и пояснениями', 'Все недостающие вопросы для вашего решения', 'План шагов с инструментами Virtuse', 'PDF, который останется у вас, без подписки'],
      once: 'Разово', noSub: 'Без подписки.', waitNote: 'Платежи пока не запущены. Оставьте e-mail, и мы сообщим, когда отчёт откроется.',
      wantPh: 'Ваш e-mail', wantBtn: 'Сообщите мне', wantOk: 'Вы в списке. Мы напишем один раз, когда отчёт откроется.', wantBad: 'Введите действительный e-mail.',
      wantNote: 'Мы сохраним только ваш e-mail, но не текст решения. Отписаться можно одним кликом из письма.', privacy: 'Конфиденциальность',
      prevBadge: 'Предпросмотр отчёта', prevNote: 'Предпросмотр отчёта для тестирования (?report=1). Без ?report=1 вы видите то же, что посетитель: вердикт, 3 шага, 2 области, партнёров и цены.',
      allH: 'Все 10 сигналов', missAllH: 'Недостающие вопросы', planH: 'План шагов', planP: 'Сигналы ниже 7 баллов, от самого слабого. Каждый с инструментом, где его дополнить.', planNone: 'У всех сигналов не меньше 7 баллов.', pdf: 'Сохранить как PDF', pts: ' б.',
      R: {
        nextH: 'Ваш следующий шаг', again2: 'Оценить снова', open: 'Открыть',
        improve: 'Как улучшить эту оценку?',
        tip: { worst_case: 'На 10 баллов: последствия падения на 70% в евро и план, как его пережить.', liquidity: 'На 10 баллов: резерв в месяцах расходов, независимый от цены Биткоина.', tax: 'На 10 баллов: верное правило для вашей страны и отложенная на налог сумма.', custody: 'На 10 баллов: хранение, восстановление и порядок действий для наследников без передачи сид-фразы.', plan_b: 'На 10 баллов: конкретный триггер и конкретный шаг, если предположение не оправдается.', goal: 'На 10 баллов: цель с суммой и датой.', horizon: 'На 10 баллов: горизонт, согласованный с целью, и то, что может заставить продать раньше.', alternatives: 'На 10 баллов: как минимум два сравнённых варианта с причиной выбора.', rule: 'На 10 баллов: записанное правило, включая то, когда вы его измените.', asymmetry: 'На 10 баллов: размер, обоснованный потерей, которую вы выдержите.' },
        openQ: 'Вопрос, на который у вас пока нет ответа', lockedH: function (n) { return 'Ещё ' + n + ' сигналов есть в отчёте'; },
        inside: 'Что есть в отчёте', faqH: 'Перед тем как открыть',
        faq: [['Это инвестиционная консультация?', 'Нет. Отчёт оценивает, насколько полно описаны ваши рассуждения. Он не говорит, покупать, продавать или ждать.'], ['Что будет с моим текстом?', 'Мы не сохраняем текст в базе данных Virtuse. Для оценки его обрабатывает Anthropic (США). Для отчёта мы сохраним только ваш e-mail.'], ['Когда откроется отчёт?', 'Платежи пока не запущены. Тот, кто оставит e-mail, получит одно сообщение, когда отчёт откроется.']],
        pfH: 'Партнёры для вашей категории',
        pfP: 'Когда вы заполните пробелы: партнёры в категории, которые соответствуют вашим критериям. Порядок определяют фиксированные правила, а не комиссия. Сравниваете и выбираете вы.',
        pfShow: 'Показать партнёров', sticky: 'Записаться на отчёт',
        group: { risk: 'Риск', taxc: 'Налоги и хранение', plan: 'План' }, planH: 'План шагов', pdfTitle: 'Verdict',
        nameL: 'Название решения (необязательно)', namePh: 'Например: Биткоин на пенсию', nameNote: 'Его видите только вы, в результате и в PDF. Мы его не отправляем.',
        progress: 'Ваш прогресс', of: ' из ', secs: ' с',
        stored: 'Ответы запоминает только этот браузер, чтобы в других инструментах их не пришлось вводить заново.', forget: 'Забыть мои ответы',
        consultH: 'Хотите обсудить решение с человеком?', consultP: 'Личная консультация: 15 минут, бесплатно, без продаж.', consultBtn: 'Записаться на консультацию'
      },
      declinedH: 'Verdict не может это оценить.', again: '↺ Оценить другое решение', decision: 'Решение'
    }
  }[LANG];

  var A = { goal: null, text: '', focus: [] };
  var SV = '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CK = '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var BUYSET = { about: ['country', 'experience', 'amount', 'share', 'horizon', 'reserve'], plan: ['keys', 'custody_pref', 'drop', 'aim', 'tax_known', 'ruleset'] };
  var GOALSETS = {
    buy: BUYSET,
    dca: { about: ['country', 'experience', 'amount', 'freq', 'share', 'horizon', 'reserve'], plan: BUYSET.plan },
    sell: { about: ['country', 'amount', 'share', 'holdtime', 'basis'], plan: ['tax_known', 'aim', 'keys', 'ruleset'] },
    loan: { about: ['country', 'amount', 'ltv', 'liqprice', 'horizon', 'reserve'], plan: ['keys', 'drop', 'tax_known', 'ruleset'] },
    treasury: { about: ['country', 'amount', 'runway', 'board', 'horizon'], plan: ['keys', 'drop', 'tax_known', 'ruleset'] },
    custody: { about: ['country', 'amount', 'keys', 'custody_pref', 'heirs'], plan: ['tax_known', 'aim'] }
  };
  function SET() { return GOALSETS[A.goal] || BUYSET; }
  function KEYS() { return SET().about.concat(SET().plan); }
  var RET = null; // edit from the final check: Continue returns there
  var panel = document.getElementById('panel'), back = document.getElementById('back'), stepsEl = document.getElementById('steps');
  var RESULT = null, i = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function quote(t) { var q = { sk: ['„', '“'], ru: ['«', '»'] }[LANG] || ['“', '”']; return q[0] + esc(t) + q[1]; }
  function push(o) { (window.dataLayer = window.dataLayer || []).push(o); }
  function foot(extra, btn, disabled, solid) { return '<div class="foot"><span class="note" id="fn">' + (extra || '') + '</span><button class="cta' + (solid ? ' solid' : '') + '" id="c"' + (disabled ? ' disabled' : '') + '>' + (btn || STR.cont) + ' ' + SV + '</button></div>'; }
  function label(key, v) { var o = (STR.opts[key] || []).filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : null; }
  function ans(key) { var v = A[key]; if (!v) return STR.none; if (v === 'na') return STR.notYet; return label(key, v) || v; }
  function goalLabel() {
    var g = STR.goals.filter(function (x) { return x[0] === A.goal; })[0], a = STR.goals.filter(function (x) { return x[0] === A.also; })[0];
    return (g ? g[1] : STR.otherGoal) + (a && g ? ' + ' + a[1] : '');
  }
  // What the free text is about (review 2026-10-27, P1.1): plain keyword
  // stems in sk/cs/en/ru, matched without diacritics. Only used to ask the
  // person, never to change an answer on its own.
  function plain(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var INTENT = {
    buy: /(\bkup|nakup|dokup|\bbuy|purchas|\bdca\b|investova|\binvest|vloz|\bdat\b.{0,30}\bdo (bitcoin|btc)|\bput\b.{0,30}\binto (bitcoin|btc)|купит|покуп|докуп|вложит|инвест)/,
    custody: /(dedi|deden|dedic|inherit|\bheir|seed|klu?c|custody|uschov|multisig|наслед|ключ|хранен|сид)/,
    loan: /(poziC|pozic|pujc|\bloan|borrow|\buver|заём|заем|займ|кредит)/i,
    sell: /(preda[tj]|prodat|\bsell|продат|продаж)/,
    dca: /(mesacn|tyzdenn|pravideln|kazdy mesiac|monthly|weekly|every month|ежемесяч|еженедел|каждый месяц)/,
    treasury: /(firm|spolocnost|company|corporate|treasury|компани|фирм)/
  };
  function intents(t) { var x = plain(t), o = []; for (var k in INTENT) if (INTENT[k].test(x)) o.push(k); return o; }
  // The clarifying screen: "Something else" with a text that names goals, or
  // a buy goal whose text also asks for custody/inheritance.
  function intentOptions() {
    if (!V) return null;
    var f = intents(A.text), other = !A.goal || A.goal === 'na';
    if (other && f.length) {
      var o = STR.goals.filter(function (g) { return f.indexOf(g[0]) >= 0; });
      if (f.indexOf('buy') >= 0 && f.indexOf('custody') >= 0) o.push(V.intentBoth);
      return o;
    }
    if ((A.goal === 'buy' || A.goal === 'dca') && f.indexOf('custody') >= 0 && !A.alsoAsked) return STR.goals.filter(function (g) { return g[0] === A.goal; }).concat([V.intentBoth]);
    return null;
  }
  function intent() {
    var o = intentOptions() || [];
    var cur = A.also ? 'both' : A.goal;
    panel.innerHTML = '<div class="eyebrow">' + V.intentEb + '</div><h2>' + V.intentH + '</h2><p class="sub">' + V.intentP + '</p>' +
      '<div class="opts">' + o.map(function (g) { return '<button class="opt' + (cur === g[0] ? ' sel' : '') + '" data-v="' + g[0] + '"><span>' + g[1] + '<small>' + g[2] + '</small></span>' + (cur === g[0] ? CK : SV) + '</button>'; }).join('') + '</div>' +
      ((!A.goal || A.goal === 'na') ? '<div class="alt"><button class="ghost" id="inone">' + V.intentNone + '</button></div>' : '');
    panel.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () {
      A.alsoAsked = 1;
      var v = b.dataset.v, base = v === 'both' ? (A.goal === 'dca' ? 'dca' : 'buy') : v;
      A.also = v === 'both' ? 'custody' : null; save('also');
      push({ event: 'verdict_intent', verdict_lang: LANG, intent: v });
      if (base !== A.goal) { A.goal = base; save('goal'); RET = null; build(); go(at('how')); } else { build(); RET ? next() : go(at('how')); }
    }; });
    var n = document.getElementById('inone'); if (n) n.onclick = function () { A.alsoAsked = 1; A.also = null; next(); };
  }
  // Text vs answers (P1.2): only what the text states clearly with a number
  // or a plain word. Shown on the final check, never changed automatically.
  function num(x) { return parseFloat(String(x).replace(/[\s .]/g, '').replace(',', '.')); }
  function conflicts() {
    var t = plain(A.text), out = [], m;
    var shareBand = function (n) { return n < 5 ? 'lt5' : n <= 20 ? '5_20' : n <= 50 ? '20_50' : 'gt50'; };
    var re = /(\d{1,2}(?:[.,]\d)?)\s*(?:%|percent|percen|prc|процент)/g;
    while ((m = re.exec(t))) {
      var ctxS = t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
      if (!/(hotovos|uspor|majet|portf|saving|cash|wealth|net worth|сбереж|капитал|налич|имуществ)/.test(ctxS)) continue;
      if (/(pad|prepad|drop|fall|crash|pokles|dan|tax|урон|падени|налог)/.test(t.slice(Math.max(0, m.index - 20), m.index))) continue;
      var n = num(m[1]);
      if (A.share && A.share !== 'na' && shareBand(n) !== A.share) out.push(['share', V.cf.share(m[1], ans('share'))]);
      break;
    }
    var amtBand = function (n) { return n < 1000 ? 's' : n < 10000 ? 'm' : n <= 100000 ? 'l' : 'xl'; };
    var ra = /(\d[\d\s .,]*\d|\d)\s*(k|tis\.?|tisic|000)?\s*(€|eur\b|euro|евро)/g;
    while ((m = ra.exec(t))) {
      if (/(mesac|month|tyzd|week|mesic|ежемес|в месяц|неделю)/.test(t.slice(m.index + m[0].length, m.index + m[0].length + 14))) continue;
      var v = num(m[1]); if (m[2] && /k|tis/.test(m[2])) v *= 1000; if (m[2] === '000') v *= 1000;
      if (!(v > 0)) continue;
      if (A.amount && A.amount !== 'na' && amtBand(v) !== A.amount) out.push(['amount', V.cf.amount(m[0].trim(), ans('amount'))]);
      break;
    }
    var ry = /(\d{1,2})\s*(rok|roky|rokov|let|year|years|yrs|лет|год)/;
    if ((m = ry.exec(t)) && A.horizon && A.horizon !== 'na' && A.horizon !== 'never') {
      var y = +m[1], hb = y < 1 ? 'lt1' : y <= 4 ? '1_4' : 'gt4';
      if (hb !== A.horizon && !(A.horizon === 'gt4' && y >= 4) && !(A.horizon === '1_4' && y === 1)) out.push(['horizon', V.cf.horizon(m[0], ans('horizon'))]);
    }
    if (/(dochod|duchod|retire|pension|пенси)/.test(t) && A.aim && A.aim !== 'na' && A.aim !== 'retire') out.push(['aim', V.cf.aim('', ans('aim'))]);
    if (A.aim === 'retire' && A.horizon === 'lt1') out.push(['horizon', V.cf.retireSoon]);
    return out;
  }

  if (!ON) {
    stepsEl.hidden = true;
    panel.innerHTML = '<div class="closed"><h2>' + STR.closedH + '</h2><p class="sub">' + STR.closedP + '</p><a class="cta" href="cfo.html#pricing">' + STR.closedCta + ' ' + SV + '</a></div>';
    return;
  }

  var SCREENS;
  function build() {
    var S = SET(), np = S.plan.length + 1;
    SCREENS = [{ s: 0, p: .2, r: start }, { s: 0, p: .45, r: goal, k: 'goal' }, { s: 0, p: .75, r: text, k: 'text' }];
    if (intentOptions()) SCREENS.push({ s: 0, p: .9, r: intent, k: 'intent' });
    SCREENS.push({ s: 0, p: 1, r: how, k: 'how' });
    S.about.forEach(function (k, n) { SCREENS.push({ s: 1, p: (n + 1) / (S.about.length + 1), r: q(k), k: k }); });
    SCREENS.push({ s: 1, p: 1, r: context });
    S.plan.forEach(function (k, n) { SCREENS.push({ s: 2, p: (n + 1) / np, r: q(k), k: k }); });
    SCREENS.push({ s: 2, p: 1, r: focus }, { s: 3, p: .6, r: review, k: 'review' }, { s: 3, p: 1, r: loading, k: 'loading' }, { s: 3, p: 1, r: showResult, k: 'result' });
  }
  build();
  function at(k) { for (var n = 0; n < SCREENS.length; n++) if (SCREENS[n].k === k) return n; return 0; }

  back.textContent = STR.back;
  back.onclick = function () { if (i > 0) go(i === at('result') ? at('review') : i - 1); };
  function stepper() {
    var cur = SCREENS[i];
    stepsEl.innerHTML = '<div class="prog">' + STR.R.progress + '</div>' + STR.steps.map(function (t, k) {
      var st = k < cur.s ? 'done' : k === cur.s ? 'on' : '', w = k < cur.s ? 100 : k === cur.s ? cur.p * 100 : 0;
      return '<div class="step ' + st + '"><div class="lbl"><span class="n">' + (k < cur.s ? '✓' : k + 1) + '</span><span class="t">' + t + '</span></div><div class="track"><i style="width:' + w + '%"></i></div></div>';
    }).join('');
  }
  function go(n) {
    i = n; back.hidden = i === 0 || i === at('loading'); stepper();
    var root = panel.closest('.vf'); if (root) root.classList.toggle('is-result', SCREENS[i].k === 'result');
    SCREENS[i].r(); spot();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    push({ event: 'verdict_step', verdict_lang: LANG, verdict_step: SCREENS[i].k || SCREENS[i].r.name });
  }
  function next() { if (RET) { var r = RET; RET = null; go(at(r)); } else go(i + 1); }
  function skipBtn(lbl, key) {
    return '<div class="alt"><button class="ghost" data-skip="' + key + '">' + (lbl || STR.skip) + '</button></div>';
  }
  function bindSkip() { var b = panel.querySelector('[data-skip]'); if (b) b.onclick = function () { if (b.dataset.skip === 'goal') return setGoal('na'); A[b.dataset.skip] = 'na'; save(b.dataset.skip); next(); }; }
  // Shared profile (vb-profile.js): fixed ids to localStorage, text and name to sessionStorage only.
  var P = window.VBProfile;
  function save(key) { if (!P) return; var o = {}; o[key] = A[key]; P.set(o); }
  function saveText() { if (P) P.setText({ text: A.text || '', name: A.name || '' }); }
  // A new goal brings its own questions, so an edit then walks through them.
  function setGoal(v) { if (v !== A.goal) { RET = null; A.also = null; A.alsoAsked = 0; save('also'); } A.goal = v; save('goal'); build(); next(); }

  function start() {
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.startEb + '</div><h1>' + STR.startH + '</h1><p class="sub">' + STR.startP + '</p><p class="hint">' + STR.startHint + '</p>' + foot(STR.startNote, STR.start);
    document.getElementById('c').onclick = next;
  }
  // P0.4 (review 2026-10-27): with a text already written (hero, cfo.html or
  // an earlier pass) this screen refines it: the text is echoed, the closest
  // tile is preselected, and buy + inheritance can be picked as "Both" here,
  // so the intent question is not asked a third time.
  function guessGoal() {
    var f = intents(A.text), order = ['loan', 'sell', 'treasury', 'dca', 'buy', 'custody'];
    if (f.indexOf('buy') >= 0 && f.indexOf('custody') >= 0 && f.indexOf('loan') < 0 && f.indexOf('sell') < 0) return { pick: f.indexOf('dca') >= 0 ? 'dca' : 'buy', both: true, all: f };
    return { pick: order.filter(function (k) { return f.indexOf(k) >= 0; })[0] || null, both: false, all: f };
  }
  function goal() {
    var has = A.text.trim().length >= 20, G = has ? guessGoal() : { all: [] };
    var cur = A.also && A.goal ? 'both' : (A.goal && A.goal !== 'na' ? A.goal : (has ? (G.both ? 'both' : G.pick) : null));
    var list = STR.goals.slice(); if (has && G.both) list.push(V.intentBoth);
    var curL = (list.filter(function (g) { return g[0] === cur; })[0] || [])[1];
    panel.innerHTML = '<div class="eyebrow">' + STR.goalEb + '</div><h2>' + (has ? V.refineH : STR.goalH) + '</h2>' +
      (has ? '<div class="vf-echo"><b>' + V.echoL + ':</b> ' + quote(A.text.length > 140 ? A.text.slice(0, 137).trim() + '…' : A.text) + '</div><p class="sub">' + V.refineP(curL) + '</p>' : '<p class="sub">' + STR.goalP + '</p><p class="hint">' + STR.goalHint + '</p>') +
      '<div class="opts">' + list.map(function (g) {
        var m = has && (G.all.indexOf(g[0]) >= 0 || (g[0] === 'both' && G.both));
        return '<button class="opt' + (cur === g[0] ? ' sel' : '') + '" data-v="' + g[0] + '"><span>' + g[1] + (m ? ' <em class="vf-match">' + V.fromText + '</em>' : '') + '<small>' + g[2] + '</small></span>' + (cur === g[0] ? CK : SV) + '</button>';
      }).join('') + '</div>' + (has && curL ? foot('', V.refineGo(curL), false, true) : '') + skipBtn(STR.other, 'goal');
    function pick(v) {
      if (v === 'both') { var base = G.pick === 'dca' ? 'dca' : 'buy'; if (base !== A.goal) RET = null; A.goal = base; save('goal'); A.also = 'custody'; A.alsoAsked = 1; build(); next(); return; }
      if (has && G.both) { if (v !== A.goal) RET = null; A.goal = v; save('goal'); A.also = null; A.alsoAsked = 1; build(); next(); return; }
      setGoal(v);
    }
    panel.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { pick(b.dataset.v); }; });
    var c = document.getElementById('c'); if (c) c.onclick = function () { pick(cur); };
    bindSkip();
  }
  function text() {
    var s = STR.sugg[A.goal] || STR.sugg.buy, had = A.text.trim().length >= 20;
    panel.innerHTML = '<div class="eyebrow">' + STR.goalEb + '</div><h2>' + (had ? V.text2H : STR.textH) + '</h2><p class="sub">' + (had ? V.text2P : STR.textP) + '</p>' +
      (had ? '' : '<p class="hint">' + STR.textHint + '</p><div class="sugg">' + s.map(function (t) { return '<button>' + esc(t) + '</button>'; }).join('') + '</div>') +
      '<textarea id="tx" maxlength="1200" aria-label="' + esc(STR.rev.text) + '" placeholder="' + esc(STR.textPh) + '">' + esc(A.text) + '</textarea>' +
      '<div class="count"><span id="cn">0</span> / 1200</div><input class="hp" id="hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
      '<p class="warn">' + STR.textWarn + '</p>' + foot();
    var tx = document.getElementById('tx'), c = document.getElementById('c');
    function upd() { A.text = tx.value; saveText(); document.getElementById('cn').textContent = tx.value.length; var ok = tx.value.trim().length >= 20; c.disabled = !ok; document.getElementById('fn').textContent = ok ? '' : STR.textShort; }
    panel.querySelectorAll('.sugg button').forEach(function (b) { b.onclick = function () { tx.value = b.textContent; upd(); tx.focus(); }; });
    tx.oninput = upd; upd(); c.onclick = function () { A.hp = document.getElementById('hp').value; var ret = RET; build(); if (intentOptions()) { RET = ret; go(at('intent')); } else if (ret) next(); else go(at('text') + 1); };
  }
  function ring(v) {
    var r = 30, c = 2 * Math.PI * r;
    return '<svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="' + r + '" stroke="rgba(255,255,255,.08)" stroke-width="5" fill="none"/><circle cx="38" cy="38" r="' + r + '" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="' + (c * v / 10) + ' ' + c + '" transform="rotate(-90 38 38)"/><text x="38" y="44" text-anchor="middle" fill="var(--text)" font-size="18" font-weight="700" font-family="Inter">' + v + '</text></svg>';
  }
  function how() {
    var keys = Object.keys(STR.howTabs), cur = 0;
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.howEb + '</div><h2>' + STR.howH + '</h2><p class="sub">' + STR.howP.replace('{n}', KEYS().length + 1) + '</p>' +
      '<div class="inner"><div class="tabs" role="tablist"></div><div class="rings"></div><p class="small">' + STR.howNote + '</p></div>' + foot();
    function draw() {
      panel.querySelector('.tabs').innerHTML = keys.map(function (k, n) { return '<button role="tab" aria-selected="' + (n === cur) + '" class="' + (n === cur ? 'on' : '') + '" data-n="' + n + '">' + k + '</button>'; }).join('');
      var col = ['var(--blue)', 'var(--teal)', 'var(--purple)'][cur];
      panel.querySelector('.rings').innerHTML = STR.howTabs[keys[cur]].map(function (x) { return '<div class="ring vf-card spot" style="--c:' + col + ';color:' + col + '">' + ring(x[1]) + '<span>' + x[0] + '</span></div>'; }).join('');
      spot();
      panel.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { cur = +b.dataset.n; draw(); }; });
    }
    draw(); document.getElementById('c').onclick = next;
  }
  function q(key) {
    return function () {
      var Q = STR.q[key], O = STR.opts[key], chips = key === 'country';
      var sub = key === 'drop' ? STR.dropSub(STR.dropAmt[A.amount]) : Q[1];
      var h = '<div class="eyebrow">' + (SET().plan.indexOf(key) >= 0 ? STR.plan : STR.about) + '</div><h2>' + Q[0] + '</h2><p class="sub">' + sub + '</p><p class="why">' + Q[2] + '</p>';
      h += chips
        ? '<div class="chips">' + O.map(function (c) { return '<button class="opt' + (A[key] === c[0] ? ' sel' : '') + '" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'
        : '<div class="opts">' + O.map(function (o) { return '<button class="opt' + (A[key] === o[0] ? ' sel' : '') + '" data-v="' + o[0] + '"><span>' + o[1] + '</span>' + (A[key] === o[0] ? CK : SV) + '</button>'; }).join('') + '</div>';
      panel.innerHTML = h + skipBtn(null, key);
      panel.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { A[key] = b.dataset.v; save(key); b.classList.add('sel'); setTimeout(next, 160); }; });
      bindSkip();
    };
  }
  // The answered "limits" of this goal's questions, as one line.
  function limits() {
    var out = SET().about.filter(function (k) { return k !== 'country' && k !== 'experience' && A[k] && A[k] !== 'na'; })
      .map(function (k) { return STR.rev[k] + ': ' + ans(k).toLowerCase(); });
    return out.length ? out.join(' · ') : STR.none;
  }
  function context() {
    var dots = '';
    for (var k = 0; k < 70; k++) { var x = (k * 37) % 92 + 2, y = (k * 53) % 86 + 4; dots += '<span style="left:' + x + '%;top:' + y + '%"' + (x > 62 && y > 6 && k % 2 ? ' class="hit"' : '') + '></span>'; }
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.ctxEb + '</div><h2>' + STR.ctxH + '</h2><p class="sub">' + STR.ctxP + '</p>' +
      '<div class="inner" style="margin-top:16px"><div class="dotfield" aria-hidden="true"><div class="halo"></div>' + dots + '</div>' +
      '<div class="ctx"><div><b>' + STR.ctxWhat + '</b><span>' + esc(goalLabel()) + '</span></div><div><b>' + STR.ctxLimits + '</b><span>' + esc(limits()) + '</span></div></div></div>' +
      '<div style="margin-top:12px">' + foot() + '</div>';
    document.getElementById('c').onclick = next;
  }
  function focus() {
    function draw() {
      panel.innerHTML = '<div class="eyebrow">' + STR.plan + '</div><h2>' + STR.focusH + '</h2><p class="sub">' + STR.focusP + '</p><p class="hint">' + STR.focusHint + '</p>' +
        '<div class="opts">' + STR.focus.map(function (f) { var s = A.focus.indexOf(f[0]) >= 0; return '<button class="opt' + (s ? ' sel' : '') + '" aria-pressed="' + s + '" data-v="' + f[0] + '"><span>' + f[1] + '</span>' + (s ? CK : SV) + '</button>'; }).join('') + '</div>' +
        foot(A.focus.length ? A.focus.length + STR.picked : STR.pickOne, null, !A.focus.length);
      panel.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { var v = b.dataset.v, p = A.focus.indexOf(v); if (p >= 0) A.focus.splice(p, 1); else A.focus.push(v); save('focus'); draw(); }; });
      document.getElementById('c').onclick = next;
    }
    draw();
  }
  function review() {
    PREV = null; ADDED = {}; RERATED = false; SEEN = []; saveAdded(); // a verdict started from the final check is a new one, not a re-rating
    var rows = [['goal', goalLabel(), 'goal'], ['text', A.text || STR.none, 'text']].concat(KEYS().map(function (k) { return [k, ans(k), k]; }));
    var cfs = conflicts(); if (cfs.length) push({ event: 'verdict_conflict', verdict_lang: LANG, fields: cfs.map(function (c) { return c[0]; }).join(',') });
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.revEb + '</div><h2>' + STR.revH + '</h2><p class="sub">' + STR.revP + '</p><div style="margin-top:18px">' +
      (cfs.length ? '<div class="vf-cf" role="alert"><b>' + V.cfH(cfs.length) + '</b><p>' + V.cfP + '</p></div>' : '') +
      rows.map(function (r) { var w = cfs.filter(function (c) { return c[0] === r[0]; }); return '<div class="vfr' + (w.length ? ' cf' : '') + '"><div><b>' + STR.rev[r[0]] + '</b>' + esc(r[1]) + w.map(function (c) { return '<span class="cfw">' + esc(c[1]) + '</span>'; }).join('') + '</div><button class="ghost edit" data-to="' + r[2] + '">' + STR.edit + '</button></div>'; }).join('') +
      '</div><label class="vf-name"><b>' + STR.R.nameL + '</b><input id="dn" maxlength="60" autocomplete="off" placeholder="' + esc(STR.R.namePh) + '" value="' + esc(A.name || '') + '"><span class="small">' + STR.R.nameNote + '</span></label>' +
      '<p class="warn" style="margin-top:12px">' + STR.revAi + ' ' + STR.R.stored + ' <a href="#" id="vfForget">' + STR.R.forget + '</a></p>' + foot('', STR.getVerdict, A.text.trim().length < 20, true);
    document.getElementById('dn').oninput = function () { A.name = this.value.trim(); saveText(); };
    var fg = document.getElementById('vfForget');
    if (fg) fg.onclick = function (e) { e.preventDefault(); if (P) P.clear(); A = { goal: null, text: '', focus: [] }; RESULT = null; build(); push({ event: 'verdict_profile_forget', page_lang: LANG }); go(0); };
    panel.querySelectorAll('[data-to]').forEach(function (b) { b.onclick = function () { RET = 'review'; go(at(b.dataset.to)); }; });
    document.getElementById('c').onclick = next;
  }
  function profile() {
    var p = {};
    ['goal'].concat(KEYS()).forEach(function (k) { if (A[k] && A[k] !== 'na') p[k] = A[k]; });
    if (A.focus.length) p.focus = A.focus.slice();
    if (A.also && p.goal) p.also = A.also;
    return p;
  }
  function loading() {
    var U = STR.unlock, k = 0;
    panel.innerHTML = '<div class="load"><div class="spin" aria-hidden="true"></div><h2>' + STR.loadH + '</h2><p class="sub" id="ls" aria-live="polite">' + STR.loadSteps[0] + '</p>' +
      '<div class="unlock"><div class="mock" aria-hidden="true"><i style="width:40%"></i><i class="o"></i><i style="width:80%"></i><i style="width:55%"></i></div><div><div class="eyebrow">' + STR.loadGet + '</div><h3 id="ut" style="font-size:22px;margin-bottom:6px"></h3><p class="sub" id="ud" style="font-size:15px"></p></div></div>' +
      '<div class="pager" id="pg"></div><p class="small" id="lt" aria-hidden="true"></p><p class="small">' + STR.loadNote + '</p></div>';
    var t0 = Date.now();
    function show() {
      var u = U[k % U.length];
      document.getElementById('ut').textContent = u[0]; document.getElementById('ud').textContent = u[1];
      document.getElementById('pg').innerHTML = U.map(function (_, n) { return '<i class="' + (n === k % U.length ? 'on' : '') + '"></i>'; }).join('');
      document.getElementById('ls').textContent = Date.now() - t0 > 15000 ? STR.loadLong : STR.loadSteps[Math.min(k, STR.loadSteps.length - 1)];
      document.getElementById('lt').textContent = (k % U.length + 1) + STR.R.of + U.length + ' · ' + Math.round((Date.now() - t0) / 1000) + STR.R.secs;
    }
    show();
    var tick = setInterval(function () { var e = document.getElementById('lt'); if (e) e.textContent = (k % U.length + 1) + STR.R.of + U.length + ' · ' + Math.round((Date.now() - t0) / 1000) + STR.R.secs; else clearInterval(tick); }, 1000);
    var t = setInterval(function () { k++; show(); }, 1600), minWait = new Promise(function (r) { setTimeout(r, 2500); });
    push({ event: 'verdict_submit', verdict_lang: LANG, verdict_goal: A.goal || 'other' });
    // An unchanged payload (Back -> "Get my verdict" again) reuses the last
    // answer instead of paying for and counting a new call.
    var payload = JSON.stringify({ text: A.text, lang: LANG, hp: A.hp || '', profile: profile(), report: PREVIEW, recalc: PREV != null }), cached = null;
    try { var c = JSON.parse(sessionStorage.getItem('vb-verdict-last') || 'null'); if (c && c.k === payload) cached = c.d; } catch (e) {}
    var call = cached ? Promise.resolve({ ok: true, d: cached }) : vbApi().then(function (api) { return api.postJson('/verdict', payload); })
      .then(function (r) { return { ok: r.ok, d: r.data }; })
      .catch(function () { return { ok: false, d: { error: STR.network } }; });
    if (cached) minWait = Promise.resolve();
    Promise.all([call, minWait]).then(function (x) {
      clearInterval(t); clearInterval(tick);
      var res = x[0];
      if (res.ok && res.d && res.d.ok) {
        RESULT = res.d;
        if (!cached) try { sessionStorage.setItem('vb-verdict-last', JSON.stringify({ k: payload, d: res.d })); } catch (e) {}
        push(RESULT.declined ? { event: 'verdict_declined', verdict_lang: LANG } : { event: 'verdict_result', verdict_lang: LANG, verdict_band: RESULT.band.id, verdict_level: RESULT.level && RESULT.level.id, verdict_weakest: RESULT.weakest.id });
        next(); return;
      }
      panel.innerHTML = '<h2>' + STR.failH + '</h2><p class="sub">' + esc((res.d && res.d.error) || STR.error) + '</p><div class="foot"><span></span><button class="ghost" id="rt">' + STR.retry + '</button></div>';
      document.getElementById('rt').onclick = function () { go(at('loading')); };
    });
  }
  // Result v2 (verdict-result-v2.md, 2026-10-23): verdict line → 3 next steps
  // → two areas in plain language → one open question → 2-3 partners → pricing
  // → legal. Level, steps, area texts and pricing come from the Worker (code,
  // not the model); this file only lays them out.
  var V = {
    sk: {
      levelPill: { ready: 'Premyslené', almost: 'Takmer hotové', basics: 'Chýbajú základy', redflag: 'Červená vlajka' },
      more: function (n) { return '+' + n + ' ďalšie'; },
      stepsH: 'Vaše 3 ďalšie kroky', why: 'Prečo: ', areasH: 'Dve oblasti vysvetlené',
      role: { weakest: 'Najviac chýba', strongest: 'Čo už máte', furthest: 'Kde ste najďalej', second: 'Druhá vec na doplnenie' },
      meaningL: 'Čo to pre vás znamená', todoL: 'Čo urobiť', inStep: function (n) { return 'Krok ' + n + ' vyššie.'; }, reasonL: 'Prečo toto hodnotenie', tipL: 'Ako získať 10 bodov',
      filler: { partners: 'Pozrieť partnerov ↓', consult: 'Rezervovať 15 min', pdf: 'Uložiť ako PDF', recheck: '↺ Ohodnotiť znova' },
      lockedStrip: function (n) { return 'Ďalších ' + n + ' oblastí je v reporte: '; },
      partnersH: 'Kde to môžete urobiť',
      partnersP: function (c) { return 'Partneri v kategórii ' + c.cat + ', ktorí spĺňajú vaše kritériá' + (c.crit ? ' (' + c.crit + ')' : '') + '. Poradie určujú pevné pravidlá, nie provízia. Porovnávate a vyberáte vy.'; },
      partnersBasics: 'Najprv si prejdite 3 kroky vyššie. Partnerov tu máte, keď budete pripravení.',
      alsoH: 'Na úschovu a dedenie', wantDone: 'Ste na zozname', newTag: 'nové', prevDone: 'Už ste doplnili', prevHint: 'Ak skóre ešte nestúplo, napíšte to konkrétnejšie: čísla, dátum, kto a kedy.', addMore: 'Doplniť ešte', pdfDl: 'Stiahnuť PDF', pdfPrint: 'Tlačiť',
      echoL: 'Váš text', refineH: 'Spresnite kategóriu.', refineP: function (x) { return x ? 'Podľa vášho textu je najbližšie „' + x + '“. Potvrďte ju alebo vyberte inú. Podľa nej Partner Finder vyberie partnerov.' : 'Vyberte kategóriu, ktorá je vášmu textu najbližšie. Podľa nej Partner Finder vyberie partnerov.'; }, refineGo: function (x) { return 'Pokračovať: ' + x; }, fromText: 'podľa textu',
      text2H: 'Doplňte alebo upravte zadanie.', sugHint: 'Návrh vložíte šípkou →', doneBtn: 'Doplnené do plánu', text2P: 'Váš text je už vložený, netreba písať od nuly. Ak chcete ešte niečo doplniť, pripíšte to.', insert: 'Vložiť',
      intentEb: 'Váš zámer', intentH: 'Čo je hlavný cieľ?', intentP: 'Váš text spomína viac vecí. Podľa toho vyberieme otázky, nástroje a partnerov.', intentBoth: ['both', 'Oboje', 'Kúpiť Bitcoin a nastaviť úschovu a dedenie'], intentNone: 'Ani jedno, nechám „Niečo iné“',
      cfH: function (n) { return n === 1 ? 'Text a odpovede si v 1 bode odporujú.' : 'Text a odpovede si odporujú v ' + n + ' bodoch.'; }, cfP: 'Opravte odpoveď alebo text. Inak verdikt zohľadní oboje a môže byť menej presný.',
      cf: { share: function (n, a) { return 'Text hovorí asi ' + n + ' %, vybrali ste „' + a + '“.'; }, amount: function (n, a) { return 'Text hovorí asi ' + n + ', vybrali ste „' + a + '“.'; }, horizon: function (n, a) { return 'Text hovorí o ' + n + ', vybrali ste „' + a + '“.'; }, aim: function (n, a) { return 'Text spomína dôchodok, vybrali ste „' + a + '“.'; }, retireSoon: 'Dôchodok ako cieľ a peniaze potrebné do 1 roka si odporujú.' },
      partnersShow: 'Zobraziť partnerov', pfAll: 'Porovnať všetkých v Partner Finderi →', pfOpen: 'Otvoriť Partner Finder →',
      licence: function (reg, chk) { return 'Licencia MiCA: ' + reg + ' · ' + chk + ' · zdroj ESMA'; },
      feeSrc: function (chk) { return 'Zdroj, ' + chk; }, view: function (n) { return 'Pozrieť ' + n + ' →'; },
      priceH: 'Čo môžete získať', freeT: 'Zadarmo', repT: 'Report', conT: 'Osobná konzultácia',
      freePrice: '0 €', repPrice: '14 €', repOnce: 'jednorazovo, bez predplatného', conPrice: '15 min · zadarmo',
      freeList: ['Verdict a 3 ďalšie kroky', '2 oblasti vysvetlené', 'Partneri podľa vašich kritérií'],
      conList: ['Prejdete si verdikt s človekom', 'Bez predaja', 'Odpovede z Verdictu sa zdieľajú len po vašom kliknutí'],
      haveIt: '✓ Máte ho', repWait: 'Zapísať sa na report za 14 €', repBuy: 'Odomknúť report za 14 €', conBtn: 'Rezervovať 15 min',
      cfo: 'Rozhodujete častejšie? <b>Virtuse CFO</b>: neobmedzené verdikty a reporty za 9 €/mesiac alebo 90 €/rok. Zapíšte sa, dáme vám vedieť, keď ho spustíme.',
      visitorBadge: 'Toto vidí návštevník bez reportu',
      consultSmall: 'Chcete to prejsť s človekom?', consultLink: 'Osobná konzultácia',
      stickySteps: '3 kroky ↑', stickyRep: 'Report 14 €', missAllH: 'Všetky chýbajúce otázky', partial: 'Niektoré oblasti AI tentoraz nevyhodnotila; ukazujeme ich ako nepopísané.'
    },
    en: {
      levelPill: { ready: 'Thought through', almost: 'Almost there', basics: 'Basics missing', redflag: 'Red flag' },
      more: function (n) { return '+' + n + ' more'; },
      stepsH: 'Your 3 next steps', why: 'Why: ', areasH: 'Two signals explained',
      role: { weakest: 'Missing most', strongest: 'What you already have', furthest: "Where you're furthest along", second: 'Second thing to add' },
      meaningL: 'What it means for you', todoL: 'What to do', inStep: function (n) { return 'Step ' + n + ' above.'; }, reasonL: 'Why this rating', tipL: 'How to get 10 points',
      filler: { partners: 'See the partners ↓', consult: 'Book 15 minutes', pdf: 'Save as PDF', recheck: '↺ Rate again' },
      lockedStrip: function (n) { return n + ' more signals are in the report: '; },
      partnersH: 'Where you can do it',
      partnersP: function (c) { return 'Partners in the ' + c.cat + ' category that match your criteria' + (c.crit ? ' (' + c.crit + ')' : '') + '. Fixed rules set the order, not commission. You compare and choose.'; },
      partnersBasics: "Go through the 3 steps above first. The partners are here when you're ready.",
      alsoH: 'For custody and inheritance', wantDone: "You're on the list", newTag: 'new', prevDone: 'Already added', prevHint: 'If the score has not moved yet, be more specific: numbers, a date, who and when.', addMore: 'Add more', pdfDl: 'Download PDF', pdfPrint: 'Print',
      echoL: 'Your text', refineH: 'Confirm the category.', refineP: function (x) { return x ? 'From your text, the closest is "' + x + '". Confirm it or pick another. Partner Finder uses it to pick partners.' : 'Pick the category closest to your text. Partner Finder uses it to pick partners.'; }, refineGo: function (x) { return 'Continue: ' + x; }, fromText: 'from your text',
      text2H: 'Add to or edit your decision.', sugHint: 'Press → to use the suggestion', doneBtn: 'Added to your plan', text2P: 'Your text is already here; no need to start over. If there is anything else you want to add, write it in.', insert: 'Insert',
      intentEb: 'Your intent', intentH: 'What is the main goal?', intentP: 'Your text mentions more than one thing. We pick the questions, tools and partners from it.', intentBoth: ['both', 'Both', 'Buy Bitcoin and set up custody and inheritance'], intentNone: 'Neither, keep "Something else"',
      cfH: function (n) { return n === 1 ? 'Your text and answers disagree on 1 point.' : 'Your text and answers disagree on ' + n + ' points.'; }, cfP: 'Fix the answer or the text. Otherwise the verdict weighs both and may be less precise.',
      cf: { share: function (n, a) { return 'Your text says about ' + n + '%, you picked "' + a + '".'; }, amount: function (n, a) { return 'Your text says about ' + n + ', you picked "' + a + '".'; }, horizon: function (n, a) { return 'Your text says ' + n + ', you picked "' + a + '".'; }, aim: function (n, a) { return 'Your text mentions retirement, you picked "' + a + '".'; }, retireSoon: 'Retirement as the aim and needing the money within 1 year contradict each other.' },
      partnersShow: 'Show partners', pfAll: 'Compare all in Partner Finder →', pfOpen: 'Open Partner Finder →',
      licence: function (reg, chk) { return 'MiCA licence: ' + reg + ' · ' + chk + ' · source ESMA'; },
      feeSrc: function (chk) { return 'Source, ' + chk; }, view: function (n) { return 'View ' + n + ' →'; },
      priceH: 'What you can get', freeT: 'Free', repT: 'Full report', conT: 'Personal consultation',
      freePrice: '€0', repPrice: '€14', repOnce: 'one-time, no subscription', conPrice: '15 min · free',
      freeList: ['Verdict and 3 next steps', '2 signals explained', 'Partners that match your criteria'],
      conList: ['Go through your verdict with a person', 'No sales pitch', 'Your Verdict answers are shared only after you click'],
      haveIt: '✓ You have it', repWait: 'Join the waitlist for the €14 report', repBuy: 'Unlock the report for €14', conBtn: 'Book 15 minutes',
      cfo: 'Deciding more often? <b>Virtuse CFO</b>: unlimited verdicts and reports for €9 a month or €90 a year. Join the waitlist and we\'ll tell you when it opens.',
      visitorBadge: 'This is what a visitor without the report sees',
      consultSmall: 'Want to go through it with a person?', consultLink: 'Personal consultation',
      stickySteps: '3 steps ↑', stickyRep: 'Report €14', missAllH: 'All missing questions', partial: "The AI didn't rate some signals this time; they are shown as not described."
    },
    ru: {
      levelPill: { ready: 'Продумано', almost: 'Почти готово', basics: 'Не хватает основы', redflag: 'Красный флаг' },
      more: function (n) { return '+' + n + ' ещё'; },
      stepsH: 'Ваши 3 следующих шага', why: 'Почему: ', areasH: 'Две области с пояснением',
      role: { weakest: 'Не хватает больше всего', strongest: 'Что у вас уже есть', furthest: 'Где вы продвинулись дальше всего', second: 'Второе, что нужно дополнить' },
      meaningL: 'Что это значит для вас', todoL: 'Что сделать', inStep: function (n) { return 'Шаг ' + n + ' выше.'; }, reasonL: 'Почему такая оценка', tipL: 'Как получить 10 баллов',
      filler: { partners: 'Посмотреть партнёров ↓', consult: 'Записаться на 15 минут', pdf: 'Сохранить как PDF', recheck: '↺ Оценить снова' },
      lockedStrip: function (n) { return 'Ещё ' + n + ' областей есть в отчёте: '; },
      partnersH: 'Где это можно сделать',
      partnersP: function (c) { return 'Партнёры в категории «' + c.cat + '», которые соответствуют вашим критериям' + (c.crit ? ' (' + c.crit + ')' : '') + '. Порядок определяют фиксированные правила, а не комиссия. Сравниваете и выбираете вы.'; },
      partnersBasics: 'Сначала пройдите 3 шага выше. Партнёры будут здесь, когда вы будете готовы.',
      alsoH: 'Для хранения и наследства', wantDone: 'Вы в списке', newTag: 'новое', prevDone: 'Вы уже добавили', prevHint: 'Если оценка пока не выросла, напишите конкретнее: суммы, дату, кто и когда.', addMore: 'Добавить ещё', pdfDl: 'Скачать PDF', pdfPrint: 'Печать',
      echoL: 'Ваш текст', refineH: 'Уточните категорию.', refineP: function (x) { return x ? 'По вашему тексту ближе всего «' + x + '». Подтвердите или выберите другую. По ней Partner Finder подберёт партнёров.' : 'Выберите категорию, ближайшую к вашему тексту. По ней Partner Finder подберёт партнёров.'; }, refineGo: function (x) { return 'Продолжить: ' + x; }, fromText: 'по тексту',
      text2H: 'Дополните или измените описание.', sugHint: 'Нажмите →, чтобы вставить подсказку', doneBtn: 'Добавлено в план', text2P: 'Ваш текст уже здесь, начинать заново не нужно. Если хотите что-то добавить, допишите.', insert: 'Вставить',
      intentEb: 'Ваша цель', intentH: 'Что главное?', intentP: 'В вашем тексте несколько тем. По ответу мы подберём вопросы, инструменты и партнёров.', intentBoth: ['both', 'И то, и другое', 'Купить Биткоин и настроить хранение и наследство'], intentNone: 'Ни то, ни другое, оставить «Другое»',
      cfH: function (n) { return n === 1 ? 'Текст и ответы расходятся в 1 пункте.' : 'Текст и ответы расходятся в пунктах: ' + n + '.'; }, cfP: 'Исправьте ответ или текст. Иначе вердикт учтёт и то, и другое и может быть менее точным.',
      cf: { share: function (n, a) { return 'В тексте около ' + n + '%, а выбрано «' + a + '».'; }, amount: function (n, a) { return 'В тексте около ' + n + ', а выбрано «' + a + '».'; }, horizon: function (n, a) { return 'В тексте: ' + n + ', а выбрано «' + a + '».'; }, aim: function (n, a) { return 'В тексте упоминается пенсия, а выбрано «' + a + '».'; }, retireSoon: 'Пенсия как цель и деньги, нужные в течение года, противоречат друг другу.' },
      partnersShow: 'Показать партнёров', pfAll: 'Сравнить всех в Partner Finder →', pfOpen: 'Открыть Partner Finder →',
      licence: function (reg, chk) { return 'Лицензия MiCA: ' + reg + ' · ' + chk + ' · источник ESMA'; },
      feeSrc: function (chk) { return 'Источник, ' + chk; }, view: function (n) { return 'Посмотреть ' + n + ' →'; },
      priceH: 'Что вы можете получить', freeT: 'Бесплатно', repT: 'Отчёт', conT: 'Личная консультация',
      freePrice: '0 €', repPrice: '14 €', repOnce: 'разово, без подписки', conPrice: '15 мин · бесплатно',
      freeList: ['Вердикт и 3 следующих шага', '2 области с пояснением', 'Партнёры по вашим критериям'],
      conList: ['Вы проходите вердикт вместе с человеком', 'Без продаж', 'Ответы из Verdict передаются только после вашего клика'],
      haveIt: '✓ У вас есть', repWait: 'Записаться на отчёт за 14 €', repBuy: 'Открыть отчёт за 14 €', conBtn: 'Записаться на 15 минут',
      cfo: 'Принимаете решения чаще? <b>Virtuse CFO</b>: неограниченные вердикты и отчёты за 9 € в месяц или 90 € в год. Запишитесь, и мы сообщим о запуске.',
      visitorBadge: 'Это видит посетитель без отчёта',
      consultSmall: 'Хотите пройти это с человеком?', consultLink: 'Личная консультация',
      stickySteps: '3 шага ↑', stickyRep: 'Отчёт 14 €', missAllH: 'Все недостающие вопросы', partial: 'Некоторые области ИИ на этот раз не оценил; мы показываем их как неописанные.'
    }
  }[LANG];
  var GROUP = { worst_case: 'risk', liquidity: 'risk', plan_b: 'risk', tax: 'taxc', custody: 'taxc', goal: 'plan', horizon: 'plan', alternatives: 'plan', rule: 'plan', asymmetry: 'plan' };
  var GCOL = { risk: 'blue', taxc: 'teal', plan: 'purple' };
  var LEVELCOL = { ready: 'var(--green)', almost: 'var(--blue)', basics: 'var(--yellow)', redflag: 'var(--orange)' };
  var R = STR.R;
  var FLAG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>';
  function bigRing(score, col) {
    var r = 34, c = 2 * Math.PI * r;
    return '<svg class="vf-ring" width="88" height="88" viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="' + r + '" stroke="rgba(255,255,255,.08)" stroke-width="7" fill="none"/>' +
      '<circle cx="44" cy="44" r="' + r + '" stroke="' + col + '" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="' + (c * score / 100) + ' ' + c + '" transform="rotate(-90 44 44)"/></svg>';
  }
  // Handoff to the tool with what the funnel already knows (F37, v2 §3.1).
  var VBTOOL = { tax: 'tax', loan: 'loan', stacking: 'stacking' };
  function toolHref(t, medium) {
    var q = {}, k;
    if (P && VBTOOL[t.key]) { var pp = P.toParams(VBTOOL[t.key]); for (k in pp) q[k] = pp[k]; }
    for (k in (t.params || {})) q[k] = t.params[k];
    q.utm_source = 'verdict'; q.utm_medium = medium || 'result';
    return t.page + (t.page.indexOf('?') < 0 ? '?' : '&') + Object.keys(q).map(function (x) { return x + '=' + encodeURIComponent(q[x]); }).join('&');
  }
  function headBlock(r) {
    var L = r.level, col = LEVELCOL[L.id] || 'var(--orange)';
    return '<div class="res-head lvl-' + L.id + '" style="--b:' + col + '"><div><div class="eyebrow"><i></i>' + (r.report ? R.pdfTitle + ' · ' + STR.prevBadge : STR.resEb) + ' · ' + esc(A.name || goalLabel()) + '</div>' +
      '<span class="pill">' + (L.id === 'redflag' ? FLAG + ' ' : '') + esc(V.levelPill[L.id]) + '</span>' +
      '<h2 class="verdict">' + esc(L.headline) + '</h2><p class="vwhy">' + esc(L.why) + (L.more ? ' <span class="dim">' + V.more(L.more) + '</span>' : '') + '</p>' +
      '<p class="quote">' + quote(A.text.slice(0, 160) + (A.text.length > 160 ? '…' : '')) + '</p></div>' +
      '<div class="score">' + bigRing(r.score, col) + '<b>' + r.score + '<small>/100</small></b></div></div>' +
      '<p class="small scoreline">' + esc(L.scoreLine) + '</p>' + (r.partial ? '<p class="small">' + V.partial + '</p>' : '');
  }
  function stepBtn(s, medium) {
    if (s.tool) return '<a class="vf-btn' + (s.n === 1 ? ' solid' : '') + '" href="' + toolHref(s.tool, medium) + '" data-step="' + s.id + '">' + esc(s.tool.name) + ' →</a>';
    if (s.id === 'partners') return '<a class="vf-btn" href="#partners" data-step="partners">' + V.filler.partners + '</a>';
    if (s.id === 'consult') return '<button class="vf-btn" data-consult data-step="consult">' + V.filler.consult + '</button>';
    if (s.id === 'pdf') return '<button class="vf-btn" data-pdf data-step="pdf">' + V.filler.pdf + '</button>';
    return '<button class="vf-btn" data-again data-step="recheck">' + V.filler.recheck + '</button>';
  }
  function stepsBlock(r, medium) {
    return '<div class="sec" id="steps3">' + V.stepsH + '</div><ol class="vf-steps">' + r.steps.map(function (s) {
      var g = s.signal ? GCOL[GROUP[s.signal]] : s.kind === 'flag' ? 'orange' : '';
      return '<li class="vf-card spot ' + g + (s.n === 1 ? ' first' : '') + '"><span class="num">' + s.n + '</span><div><p class="act">' + esc(s.action) + '</p>' +
        (s.why ? '<p class="whyl">' + V.why + esc(s.why) + '</p>' : '') + '<div class="vrow">' + stepBtn(s, medium) + '</div></div></li>';
    }).join('') + '</ol>';
  }
  function roleLabel(a) {
    if (a.role === 'strongest') return a.points >= 7 ? V.role.strongest : V.role.furthest;
    return V.role[a.role] || '';
  }
  // An area that is already one of the 3 steps points there instead of
  // repeating the same action and button (keeps the free view short).
  function areaCard(a, medium, steps) {
    var g = GROUP[a.id], st = (steps || []).filter(function (s) { return s.signal === a.id; })[0];
    return '<div class="vf-card area ' + GCOL[g] + ' spot"><div class="h"><div>' + (roleLabel(a) ? '<div class="role">' + roleLabel(a) + '</div>' : '') + '<b>' + esc(a.title) + '</b><div class="tag">' + esc(a.name) + ' · ' + R.group[g] + '</div></div><em>' + a.points + '<small>/10</small></em></div>' +
      '<div class="bar"><i style="width:' + a.points * 10 + '%"></i></div>' +
      '<p><b class="albl">' + V.meaningL + ':</b> ' + esc(a.meaning) + '</p><p><b class="albl">' + V.todoL + ':</b> ' + (st ? '<a href="#steps3">' + V.inStep(st.n) + '</a>' : esc(a.todo)) + '</p>' +
      (!st && a.points < 7 && a.tool ? '<a class="vf-btn" href="' + toolHref(a.tool, medium) + '">' + esc(a.tool.name) + ' →</a>' : '') +
      '<div class="dets"><details class="imp"><summary>' + V.reasonL + '</summary><p>' + esc(a.reason) + '</p></details>' +
      '<details class="imp"><summary>' + V.tipL + '</summary><p>' + R.tip[a.id] + '</p></details></div></div>';
  }
  // Partners from the Partner Finder engine itself (pf-recommend.js, §6).
  var NO_UTM = { '21bitcoin': 1, 'bybit-eu': 1, kraken: 1 };
  function pfQuery(r, medium) {
    var q = r.partnerFinder || {};
    return Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&') + (Object.keys(q).length ? '&' : '') + 'utm_source=verdict&utm_medium=' + medium;
  }
  function partnersBlock(r, medium) {
    var collapsed = r.level.id === 'redflag';
    return '<div class="no-print" id="partners"><div class="sec">' + V.partnersH + '</div><div id="pfCards"></div>' +
      (r.level.id === 'basics' ? '<p class="sub sm gate">' + V.partnersBasics + '</p>' : '') +
      (collapsed ? '<p class="sub sm gate">' + esc(r.level.flags[0].text) + '</p><button class="vf-btn" id="pfShow">' + V.partnersShow + '</button>' : '') +
      '<div id="pfBox"' + (collapsed ? ' hidden' : '') + '><div class="vpgrid" id="pfGrid"></div><div id="pfAlso"></div>' +
      '<p class="small">' + STR.pfNote + ' <a href="concierge.html?' + pfQuery(r, medium) + '">' + (r.partnerFinder ? V.pfAll : V.pfOpen) + '</a></p></div></div>';
  }
  function partnerUrl(p, medium) {
    if (NO_UTM[p.id]) return p.url;
    try { var u = new URL(p.url); u.searchParams.set('utm_source', 'verdict'); u.searchParams.set('utm_medium', medium); u.searchParams.set('utm_campaign', 'partner_finder'); u.searchParams.set('utm_content', p.id); return u.toString(); } catch (e) { return p.url; }
  }
  function loadPartners(r, medium) {
    var grid = document.getElementById('pfGrid'); if (!grid || !r.partnerFinder) return;
    function draw() {
      var VB = window.VBPartners; if (!VB || !document.getElementById('pfGrid')) return;
      var q = r.partnerFinder, a = { goal: q.pf_goal, country: q.pf_country, experience: q.pf_experience, custody: q.pf_custody, amount: q.pf_amount };
      // Languages beyond en/sk/cs: the engine's own dictionary (pf-dict-<lang>.js).
      var D = window.VBPartnersDict && window.VBPartnersDict[LANG];
      if (D && VB.registerDict && !VB._dict) { VB.registerDict(LANG, D); VB._dict = 1; }
      var Lx = function (o) { return !o ? '' : VB.L ? VB.L(o, LANG) : (o[LANG] || o.en); };
      var recs = VB.recommend(a, LANG).slice(0, 3);
      if (!recs.length) return;
      function lab(list, id) { var x = list.filter(function (o) { return o.id === id; })[0]; return x ? Lx(x.label) : ''; }
      // Russian keeps the capital of country names ("Словакия"); the rest is lower case.
      var lc = function (x) { return x.toLowerCase(); };
      var crit = [LANG === 'ru' ? lab(VB.COUNTRIES, a.country) : lc(lab(VB.COUNTRIES, a.country)), lc(lab(VB.EXPERIENCE, a.experience)), lc(lab(VB.CUSTODY, a.custody))].filter(Boolean).join(', ');
      var head = '<p class="sub sm">' + esc(V.partnersP({ cat: lab(VB.GOALS, a.goal), crit: crit })) + '</p>';
      var chk = Lx(VB.LICENCE_CHECKED);
      document.getElementById('pfCards').innerHTML = head;
      function card(x) {
        var p = x.partner, T = Lx;
        return '<div class="vf-card pcard spot"><b>' + esc(p.name) + '</b><p class="tl">' + esc(T(p.tagline)) + '</p>' +
          (p.licence ? '<p class="lic"><a href="' + VB.ESMA_MICA_URL + '" target="_blank" rel="noopener">' + esc(V.licence(T(p.licence.regulator), chk)) + '</a></p>' : (p.badge ? '<p class="lic">' + esc(T(p.badge)) + '</p>' : '')) +
          (p.feeNote ? '<p class="fee">' + esc(T(p.feeNote)) + (p.feeSource ? ' · <a href="' + esc(p.feeSource) + '" target="_blank" rel="noopener">' + esc(V.feeSrc(chk)) + '</a>' : '') + '</p>' : '') +
          (x.reasons[0] ? '<p class="rs">' + esc(x.reasons[0]) + '</p>' : '') +
          '<a class="vf-btn" href="' + esc(partnerUrl(p, medium)) + '" target="_blank" rel="sponsored noopener" data-pid="' + p.id + '" data-pname="' + esc(p.name) + '" data-pcat="' + esc(x.cat || a.goal) + '">' + esc(V.view(p.name)) + '</a></div>';
      }
      grid.innerHTML = recs.map(card).join('');
      // A second short strip when the person also wants custody and inheritance (P1.1).
      var q2 = r.partnerFinderAlso, box2 = document.getElementById('pfAlso');
      if (q2 && box2) {
        var a2 = { goal: q2.pf_goal, country: q2.pf_country, experience: q2.pf_experience, custody: q2.pf_custody, amount: q2.pf_amount };
        var ids = recs.map(function (x) { return x.partner.id; });
        var r2 = VB.recommend(a2, LANG).filter(function (x) { return ids.indexOf(x.partner.id) < 0; }).slice(0, 2);
        r2.forEach(function (x) { x.cat = a2.goal; });
        if (r2.length) box2.innerHTML = '<p class="sub sm vx-also"><b>' + esc(V.alsoH) + '</b><br>' + esc(V.partnersP({ cat: lab(VB.GOALS, a2.goal), crit: '' })) + '</p><div class="vpgrid">' + r2.map(card).join('') + '</div>';
      }
      document.querySelectorAll('#pfBox [data-pid]').forEach(function (b) { b.onclick = function () {
        push({ event: 'partner_click', partner: b.dataset.pname, partner_id: b.dataset.pid, partner_category: b.dataset.pcat, link_type: 'cta', link_host: b.hostname.replace(/^www\./, ''), page_lang: LANG, goal: A.goal || 'other', source: 'verdict' });
      }; });
      spot();
    }
    function load(src, cb) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = cb; s.onerror = cb; document.head.appendChild(s); }
    var dict = LANG === 'ru' && !(window.VBPartnersDict && window.VBPartnersDict.ru);
    function go2() { if (dict) load('/pf-dict-' + LANG + '.js?v=3', draw); else draw(); }
    if (window.VBPartners) return go2();
    load('/pf-recommend.js?v=3', go2);
  }
  // Result layout after Skoora's structure (Ras, 2026-10-27): your decision →
  // what Verdict found → two areas behind the verdict → 8 more waiting →
  // partners → everything inside the verdict → unlock → why trust it → FAQ.
  // Our design and rules stay: no invented reviews, no discounts, MiCA wording.
  var W = {
    sk: {
      add: { btn: 'Doplniť do plánu', btnQ: 'Doplniť odpoveď', miss: 'Čo chýba', write: 'Čo napísať', what: 'Čo sa stane', happen: 'Doplnenie pridáme k vášmu textu a verdikt prepočítame. Skóre tejto oblasti stúpne, ak doplnenie odpovedá na to, čo chýba.', eg: 'Napr.: ', save: 'Uložiť do plánu', cancel: 'Zrušiť', done: 'Čaká na prepočet.', edit: 'Upraviť', then: 'Potom: ', long: 'Text by mal viac ako 1 200 znakov. Skráťte doplnenie.', empty: 'Napíšte aspoň jednu vetu.',
        recalc: function (n) { return 'Prepočítať verdikt (' + n + (n === 1 ? ' doplnenie' : n < 5 ? ' doplnenia' : ' doplnení') + ')'; }, recalcP: 'Doplnenia sa pridajú k vášmu textu. Prepočet je jedno nové hodnotenie (najviac 20 prepočtov za deň).',
        delta: function (a, b) { return 'Po doplnení: skóre ' + a + ' → ' + b + ' zo 100.'; },
        ask: { worst_case: ['Koľko eur by ste stratili pri prepade o 70 % a čo vtedy urobíte.', 'Pri prepade o 70 % by som stratil asi 7 000 €. Vtedy nepredávam a plán nemením.'], liquidity: ['Koľko mesiacov výdavkov máte bokom mimo Bitcoinu.', 'Rezervu na 6 mesiacov výdavkov, asi 9 000 €, mám na sporiacom účte.'], tax: ['V ktorej krajine platíte dane a ako sa tam zdaní predaj.', 'Dane platím na Slovensku. Pri predaji si odložím časť zisku na daň a odvody.'], custody: ['Kde budú kľúče a ako sa k nim dostanú dedičia bez zdieľania seed frázy.', 'Bitcoin bude na hardvérovej peňaženke. Postup pre dedičov je uložený u notára, seed frázu nikomu nedávam.'], plan_b: ['Čo by vás prinútilo zmeniť plán a čo potom urobíte.', 'Ak prídem o príjem, prestanem dokupovať a žijem z rezervy.'], goal: ['Cieľ s číslom a dátumom.', 'Do roku 2035 chcem mať na dôchodok aspoň 50 000 €.'], horizon: ['Ako dlho budete držať a čo by vás prinútilo predať skôr.', 'Držím aspoň 10 rokov. Skôr by som predal len pri vážnej chorobe.'], alternatives: ['Aspoň dve iné možnosti, ktoré ste zvážili, a prečo práve táto.', 'Zvažoval som ETF a skoršie splatenie hypotéky. Vyberám Bitcoin, lebo…'], rule: ['Napísané pravidlo, kedy kúpite alebo predáte.', 'Kupujem 200 € mesačne, pri poklese nič nemením, predávam najskôr v roku 2035.'], asymmetry: ['Prečo práve táto suma: akú stratu unesiete.', 'Ide o 10 % úspor. Ak by išli na nulu, bývanie ani rezervu to neohrozí.'] }
      },
      secDecision: 'Vaše rozhodnutie', secFound: 'Čo Verdict našiel', secTwo: 'Dve oblasti za vaším verdiktom', secFull: 'Chcete celý verdikt?', secTrust: 'Prečo Verdictu veriť', secFaq: 'Pred odomknutím',
      ringNote: 'Kruh ukazuje skóre úplnosti plánu (0 až 100), štítok pod ním úroveň verdiktu.',
      cardTitle: { flag: 'Červená vlajka', partners: 'Partneri', consult: 'Osobná konzultácia', recheck: 'Ohodnotiť znova', pdf: 'PDF' },
      stepN: function (n) { return 'Krok ' + n; },
      improve: 'Ako zlepšiť toto skóre?',
      waitH: function (n) { return 'Ďalších ' + n + ' oblastí čaká'; }, waitP: 'Každá je už ohodnotená a vysvetlená vo vašom verdikte.', waitCta: 'Zobraziť všetky oblasti',
      fullH: 'Všetko vo vašom verdikte', fullP: 'Celý verdikt sa otvorí ako report: všetkých 10 oblastí, otázky a plán krokov na jednom mieste. Jedna platba, bez predplatného.', locked: 'Zamknuté',
      feats: function (tax, cn) { return [['Partneri podľa vašich kritérií', 'Partneri s licenciou MiCA a dátumom overenia. Porovnáte a vyberiete vy.'], [tax && cn ? 'Daňové pravidlá: ' + cn : 'Dane: čo si overiť', tax && cn ? 'Pravidlo zdanenia predaja pre vašu krajinu so zdrojom a dátumom. Bez výpočtu z vašej sumy.' : 'Na čo sa pri dani z predaja pripraviť, s odkazom na Tax & Inheritance Agent.'], ['Úschova a dedenie: čo doplniť', 'Čo chýba, aby sa dedičia dostali k Bitcoinu bez zdieľania seed frázy.'], ['Plán krokov s nástrojmi Virtuse', 'Oblasti pod 7 bodov od najslabšej, každá s odkazom na nástroj.'], ['Všetkých 10 oblastí s dôvodom', 'Body a dôvod pre každú oblasť a všetky otázky, ktoré chýbajú.'], ['PDF na uloženie', 'Celý verdikt ako PDF, ktoré si ponecháte.']]; },
      payH: 'Viac istoty. <span>Od rozhodnutia k ďalším krokom.</span>', payP: 'Nájdite medzery v pláne skôr, ako vás budú stáť peniaze, a pokračujte podľa jasných krokov.',
      barToday: 'Dobre opísané oblasti dnes', barReport: 'V reporte vysvetlené', of10: function (n) { return n + ' z 10'; },
      payT: 'Váš report', payRow: 'Celý verdikt', once: 'Jednorazová cena', onceNote: 'Bez predplatného a bez obnovy. Report si ponecháte.',
      plusT: 'K tomu: osobná konzultácia', plusP: '15 minút s človekom, zadarmo, bez predaja.', plusBtn: 'Rezervovať',
      waitBtn: 'Zapísať sa na report za 14 €', buyBtn: 'Odomknúť verdikt', stripe: 'Bezpečná platba cez Stripe', opens: 'Otvorí sa hneď po platbe',
      trust: [['24 overených partnerov', 'Pri partneroch s licenciou MiCA uvádzame dátum overenia v registri ESMA.'], ['Daňové pravidlá 13 krajín EÚ', 'Z rovnakých zdrojov ako naše daňové stránky, s uvedeným dátumom.'], ['Rovnaké hodnotenie pre každého', '10 oblastí podľa pevnej rubriky. Poradie partnerov určujú pevné pravidlá, nie provízia.'], ['Vaše peniaze ani kľúče nedržíme', 'Text rozhodnutia neukladáme v databáze Virtuse. Virtuse od roku 2018.']],
      faq: [['Čo sa stane, keď sa zapíšem?', 'Uložíme len váš e-mail. Keď sa report otvorí, pošleme vám jednu správu. Nič iné.'], ['Čo presne dostanem za 14 €?', 'Všetkých 10 oblastí s bodmi a dôvodmi, všetky chýbajúce otázky, plán krokov s nástrojmi Virtuse a PDF na uloženie.'], ['Prečo platiť, keď sa môžem opýtať ChatGPT?', 'Verdict hodnotí každé rozhodnutie na rovnakých 10 oblastiach podľa pevnej rubriky, pracuje s vašimi odpoveďami a s daňovými pravidlami 13 krajín, ktoré uvádzame so zdrojom. Partnerov ukazuje len overených.'], ['Čo ak verdikt povie, že plán nie je pripravený?', 'Verdict meria, nakoľko úplne je plán opísaný, nie či kúpiť alebo predať. Ukáže, čo doplniť, a môžete ho ohodnotiť znova.'], ['Ponechám si ho?', 'Áno. Report si uložíte ako PDF, bez predplatného.'], ['Je to investičné poradenstvo?', 'Nie. Verdict hodnotí úplnosť vašej úvahy. Nehovorí, či kúpiť, predať alebo počkať.'], ['Čo sa stane s mojím textom?', 'Text neukladáme v databáze Virtuse. Na vyhodnotenie ho spracúva Anthropic (USA).']],
      ctaFinal: 'Zapísať sa', ctaNote: 'Report za 14 € · jednorazovo, bez predplatného'
    },
    en: {
      add: { btn: 'Add to my plan', btnQ: 'Add an answer', miss: 'What is missing', write: 'What to write', what: 'What happens', happen: 'We add it to your text and rate your decision again. The score in this signal goes up if the addition answers what is missing.', eg: 'E.g.: ', save: 'Save to my plan', cancel: 'Cancel', done: 'Waiting for the new rating.', edit: 'Edit', then: 'Then: ', long: 'The text would be longer than 1,200 characters. Shorten the addition.', empty: 'Write at least one sentence.',
        recalc: function (n) { return 'Rate my decision again (' + n + (n === 1 ? ' addition' : ' additions') + ')'; }, recalcP: 'Your additions are added to your text. Rating again is one new assessment (at most 20 a day).',
        delta: function (a, b) { return 'After your additions: score ' + a + ' → ' + b + ' out of 100.'; },
        ask: { worst_case: ['How many euros you would lose in a 70% fall and what you would do then.', 'In a 70% fall I would lose about €7,000. I would not sell and would keep my plan.'], liquidity: ['How many months of expenses you keep outside Bitcoin.', 'I keep 6 months of expenses, about €9,000, in a savings account.'], tax: ['Where you pay tax and how a sale is taxed there.', 'I pay tax in Slovakia. When I sell, I set aside part of the gain for tax.'], custody: ['Where the keys will be and how heirs reach them without sharing the seed phrase.', 'The Bitcoin will be on a hardware wallet. Instructions for my heirs are with a notary; I share the seed phrase with no one.'], plan_b: ['What would make you change the plan and what you would do then.', 'If I lose my income, I stop buying and live from my reserve.'], goal: ['A goal with a number and a date.', 'By 2035 I want at least €50,000 for retirement.'], horizon: ['How long you will hold and what would force you to sell earlier.', 'I hold for at least 10 years. I would sell earlier only in case of serious illness.'], alternatives: ['At least two other options you considered, and why this one.', 'I considered an ETF and paying off my mortgage early. I choose Bitcoin because…'], rule: ['A written rule for when you buy or sell.', 'I buy €200 a month, change nothing in a fall and sell no earlier than 2035.'], asymmetry: ['Why this amount: what loss you can carry.', 'It is 10% of my savings. If it went to zero, my home and reserve would be fine.'] }
      },
      secDecision: 'Your decision', secFound: 'What Verdict found', secTwo: 'Two signals behind your verdict', secFull: 'Want the full verdict?', secTrust: 'Why trust Verdict', secFaq: 'Before you unlock',
      ringNote: 'The ring shows how complete your plan is (0 to 100); the chip below shows the verdict level.',
      cardTitle: { flag: 'Red flag', partners: 'Partners', consult: 'Personal consultation', recheck: 'Rate again', pdf: 'PDF' },
      stepN: function (n) { return 'Step ' + n; },
      improve: 'How can this score improve?',
      waitH: function (n) { return n + ' more signals are waiting'; }, waitP: 'Each one is already scored and explained inside your verdict.', waitCta: 'See every signal',
      fullH: 'Everything inside your verdict', fullP: 'The full verdict opens as a report: all 10 signals, the questions and a step plan in one place. One payment, no subscription.', locked: 'Locked',
      feats: function (tax, cn) { return [['Partners that match your criteria', 'Partners with a MiCA licence and the date it was checked. You compare and choose.'], [tax && cn ? 'Tax rules: ' + cn : 'Tax: what to check', tax && cn ? 'The rule for taxing a sale in your country, with source and date. No calculation from your amount.' : 'What to prepare for tax on a sale, with a link to the Tax & Inheritance Agent.'], ['Custody and inheritance: what to add', 'What is missing so heirs can reach the Bitcoin without sharing the seed phrase.'], ['Step plan with Virtuse tools', 'Signals under 7 points, weakest first, each with a link to a tool.'], ['All 10 signals with reasons', 'Points and a reason for each signal, and every question still missing.'], ['PDF to keep', 'Your whole verdict as a PDF to keep.']]; },
      payH: 'More certainty. <span>From decision to next steps.</span>', payP: 'Find the gaps in your plan before they cost you money, and follow clear steps.',
      barToday: 'Signals described well today', barReport: 'Explained in the report', of10: function (n) { return n + ' of 10'; },
      payT: 'Your report', payRow: 'Full verdict', once: 'One-time price', onceNote: 'No subscription or renewal. The report is yours to keep.',
      plusT: 'Plus: personal consultation', plusP: '15 minutes with a person, free, no sales pitch.', plusBtn: 'Book',
      waitBtn: 'Join the waitlist for the €14 report', buyBtn: 'Unlock my verdict', stripe: 'Secure checkout with Stripe', opens: 'Opens right after payment',
      trust: [['24 vetted partners', 'For partners with a MiCA licence we show the date we checked the ESMA register.'], ['Tax rules for 13 EU countries', 'From the same sources as our tax pages, with the date shown.'], ['The same rating for everyone', '10 signals on a fixed rubric. Fixed rules set the partner order, not commission.'], ["We don't hold your money or keys", "We don't store your decision text in the Virtuse database. Virtuse has been running since 2018."]],
      faq: [['What happens after I join?', 'We keep only your email. When the report opens, we send you one message. Nothing else.'], ['What exactly do I get for €14?', 'All 10 signals with points and reasons, every missing question, a step plan with Virtuse tools and a PDF to keep.'], ['Why pay when I can just ask ChatGPT?', 'Verdict rates every decision on the same 10 signals with a fixed rubric, uses your answers and the tax rules of 13 countries we cite with sources. It shows only vetted partners.'], ['What if the verdict says my plan is not ready?', 'Verdict measures how completely your plan is described, not whether to buy or sell. It shows what to add, and you can rate it again.'], ['Do I keep it?', 'Yes. You save the report as a PDF, with no subscription.'], ['Is this investment advice?', 'No. Verdict rates how complete your thinking is. It never says whether to buy, sell or wait.'], ['What happens to my text?', "We don't store it in the Virtuse database. Anthropic (USA) processes it to assess it."]],
      ctaFinal: 'Join the waitlist', ctaNote: '€14 report · one-time, no subscription'
    },
    ru: {
      add: { btn: 'Дополнить план', btnQ: 'Добавить ответ', miss: 'Чего не хватает', write: 'Что написать', what: 'Что будет дальше', happen: 'Мы добавим это к вашему тексту и оценим вердикт заново. Оценка этой области вырастет, если дополнение отвечает на то, чего не хватает.', eg: 'Например: ', save: 'Сохранить в план', cancel: 'Отмена', done: 'Ждёт новой оценки.', edit: 'Изменить', then: 'Затем: ', long: 'Текст будет длиннее 1200 знаков. Сократите дополнение.', empty: 'Напишите хотя бы одно предложение.',
        recalc: function (n) { return 'Оценить вердикт заново (дополнений: ' + n + ')'; }, recalcP: 'Дополнения добавятся к вашему тексту. Новая оценка — это одна проверка (не больше 20 в день).',
        delta: function (a, b) { return 'После дополнений: оценка ' + a + ' → ' + b + ' из 100.'; },
        ask: { worst_case: ['Сколько евро вы потеряете при падении на 70% и что тогда сделаете.', 'При падении на 70% я потеряю около 7 000 €. Тогда я не продаю и план не меняю.'], liquidity: ['Сколько месяцев расходов у вас отложено вне Биткоина.', 'Резерв на 6 месяцев расходов, около 9 000 €, лежит на сберегательном счёте.'], tax: ['В какой стране вы платите налоги и как там облагается налогом продажа.', 'Налоги я плачу в Словакии. При продаже откладываю часть прибыли на налог.'], custody: ['Где будут ключи и как наследники получат доступ без передачи сид-фразы.', 'Биткоин будет на аппаратном кошельке. Инструкция для наследников хранится у нотариуса, сид-фразу я никому не передаю.'], plan_b: ['Что заставит вас изменить план и что вы тогда сделаете.', 'Если я потеряю доход, перестану докупать и буду жить на резерв.'], goal: ['Цель с суммой и датой.', 'К 2035 году хочу иметь на пенсию не меньше 50 000 €.'], horizon: ['Как долго вы будете держать и что может заставить продать раньше.', 'Держу не меньше 10 лет. Раньше продам только при серьёзной болезни.'], alternatives: ['Как минимум два других варианта, которые вы сравнили, и почему этот.', 'Я рассматривал ETF и досрочное погашение ипотеки. Выбираю Биткоин, потому что…'], rule: ['Записанное правило, когда вы покупаете или продаёте.', 'Покупаю на 200 € в месяц, при падении ничего не меняю, продаю не раньше 2035 года.'], asymmetry: ['Почему именно эта сумма: какую потерю вы выдержите.', 'Это 10% сбережений. Если они обнулятся, жильё и резерв не пострадают.'] }
      },
      secDecision: 'Ваше решение', secFound: 'Что нашёл Verdict', secTwo: 'Две области за вашим вердиктом', secFull: 'Хотите полный вердикт?', secTrust: 'Почему Verdict можно доверять', secFaq: 'Перед тем как открыть',
      ringNote: 'Кольцо показывает, насколько полно описан план (от 0 до 100), метка под ним — уровень вердикта.',
      cardTitle: { flag: 'Красный флаг', partners: 'Партнёры', consult: 'Личная консультация', recheck: 'Оценить снова', pdf: 'PDF' },
      stepN: function (n) { return 'Шаг ' + n; },
      improve: 'Как улучшить эту оценку?',
      waitH: function (n) { return 'Ещё ' + n + ' областей ждут вас'; }, waitP: 'Каждая уже оценена и объяснена в вашем вердикте.', waitCta: 'Показать все области',
      fullH: 'Всё в вашем вердикте', fullP: 'Полный вердикт откроется как отчёт: все 10 областей, вопросы и план шагов в одном месте. Один платёж, без подписки.', locked: 'Закрыто',
      feats: function (tax, cn) { return [['Партнёры по вашим критериям', 'Партнёры с лицензией MiCA и датой проверки. Сравниваете и выбираете вы.'], [tax && cn ? 'Налоговые правила: ' + cn : 'Налоги: что проверить', tax && cn ? 'Правило налогообложения продажи в вашей стране, с источником и датой. Без расчёта по вашей сумме.' : 'К чему подготовиться по налогу при продаже, со ссылкой на Tax & Inheritance Agent.'], ['Хранение и наследство: что дополнить', 'Чего не хватает, чтобы наследники получили доступ к Биткоину без передачи сид-фразы.'], ['План шагов с инструментами Virtuse', 'Области ниже 7 баллов, от самой слабой, каждая со ссылкой на инструмент.'], ['Все 10 областей с пояснением', 'Баллы и пояснение по каждой области и все недостающие вопросы.'], ['PDF для сохранения', 'Весь вердикт в PDF, который останется у вас.']]; },
      payH: 'Больше уверенности. <span>От решения к следующим шагам.</span>', payP: 'Найдите пробелы в плане раньше, чем они будут стоить вам денег, и двигайтесь по понятным шагам.',
      barToday: 'Хорошо описанные области сейчас', barReport: 'Объяснено в отчёте', of10: function (n) { return n + ' из 10'; },
      payT: 'Ваш отчёт', payRow: 'Полный вердикт', once: 'Разовая цена', onceNote: 'Без подписки и продления. Отчёт остаётся у вас.',
      plusT: 'Плюс: личная консультация', plusP: '15 минут с человеком, бесплатно, без продаж.', plusBtn: 'Записаться',
      waitBtn: 'Записаться на отчёт за 14 €', buyBtn: 'Открыть вердикт', stripe: 'Безопасная оплата через Stripe', opens: 'Откроется сразу после оплаты',
      trust: [['24 проверенных партнёра', 'Для партнёров с лицензией MiCA мы указываем дату проверки в реестре ESMA.'], ['Налоговые правила 13 стран ЕС', 'Из тех же источников, что и наши налоговые страницы, с указанием даты.'], ['Одинаковая оценка для всех', '10 областей по фиксированной методике. Порядок партнёров определяют фиксированные правила, а не комиссия.'], ['Мы не храним ваши деньги и ключи', 'Текст решения мы не сохраняем в базе данных Virtuse. Virtuse с 2018 года.']],
      faq: [['Что будет, когда я запишусь?', 'Мы сохраним только ваш e-mail. Когда отчёт откроется, отправим одно письмо. Ничего больше.'], ['Что именно я получу за 14 €?', 'Все 10 областей с баллами и пояснениями, все недостающие вопросы, план шагов с инструментами Virtuse и PDF для сохранения.'], ['Зачем платить, если можно спросить ChatGPT?', 'Verdict оценивает каждое решение по одним и тем же 10 областям по фиксированной методике, учитывает ваши ответы и налоговые правила 13 стран, которые мы приводим с источниками. Он показывает только проверенных партнёров.'], ['Что если вердикт скажет, что план не готов?', 'Verdict измеряет, насколько полно описан план, а не то, покупать или продавать. Он покажет, что дополнить, и вы сможете оценить снова.'], ['Отчёт останется у меня?', 'Да. Вы сохраняете отчёт в PDF, без подписки.'], ['Это инвестиционная консультация?', 'Нет. Verdict оценивает полноту ваших рассуждений. Он не говорит, покупать, продавать или ждать.'], ['Что будет с моим текстом?', 'Мы не сохраняем его в базе данных Virtuse. Для оценки его обрабатывает Anthropic (США).']],
      ctaFinal: 'Записаться', ctaNote: 'Отчёт за 14 € · разово, без подписки'
    }
  }[LANG];
  var ICON = {
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-5"/>',
    box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    quote: '<rect x="3" y="4" width="18" height="15" rx="3"/><path d="M8 10h2v3H8zM14 10h2v3h-2z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.1"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    up: '<path d="M4 16l6-6 4 4 6-6M15 8h5v5"/>', alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.1"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'
  };
  function ic(n, s) { return '<svg class="vx-ic" width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>'; }
  function vsec(icon, label, id) { return '<div class="vx-sec"' + (id ? ' id="' + id + '"' : '') + '>' + ic(icon) + '<span>' + label + '</span></div>'; }

  function decisionBlock(r) {
    var L = r.level, col = LEVELCOL[L.id] || 'var(--orange)';
    return '<section class="vx-decision" style="--b:' + col + '">' + vsec('bulb', W.secDecision) +
      '<div class="vx-dgrid"><div><h1 class="vx-title">' + esc(A.name || goalLabel()) + '</h1><p class="vx-text">' + esc(A.text) + '</p><p class="small">' + W.ringNote + '</p></div>' +
      '<div class="vx-score"><div class="score">' + bigRing(r.score, col) + '<b>' + r.score + '<small>/100</small></b></div><span class="pill">' + (L.id === 'redflag' ? FLAG + ' ' : '') + esc(V.levelPill[L.id]) + '</span>' + (r.report ? '' : '<button class="vf-btn vx-pdfsm no-print" data-pdf>' + PD.pdfFree + '</button>') + '</div></div></section>';
  }
  function stepTitle(s) {
    if (s.kind === 'flag') return W.cardTitle.flag;
    if (s.kind === 'filler') return W.cardTitle[s.id] || '';
    var pick = function (list) { return (list || []).filter(function (x) { return x.id === s.signal; })[0]; };
    var a = pick(RESULT.areas) || pick(RESULT.locked) || pick(RESULT.signals);
    return a ? (a.title || a.name) : '';
  }
  // P0.3 (review 2026-10-27): every gap gets one action that edits this
  // Verdikt: a short addition to the person's own text. Additions collect in
  // ADDS; one button rates the verdict again with them (one Worker call).
  // Tool links stay, as a secondary "Then: …".
  var ADDS = {}, PREV = null, ADDED = {}, RERATED = false, SEEN = []; // ADDED: what earlier re-ratings already took in
  try { var _ad = JSON.parse(sessionStorage.getItem('vb-verdict-added') || 'null'); if (_ad && _ad.a) { ADDED = _ad.a; SEEN = _ad.s || []; RERATED = true; } } catch (e) {}
  function saveAdded() { try { sessionStorage.setItem('vb-verdict-added', JSON.stringify({ a: ADDED, s: SEEN })); } catch (e) {} }
  function addKey(s) { return s.signal || (s.kind === 'flag' ? s.id : null); }
  function addBox(key, why, ask, q) {
    var A2 = W.add, a = A2.ask[key] || [ask || '', ''], done = ADDS[key];
    return '<div class="vx-addw" data-addw="' + esc(key) + '">' +
      '<div class="vx-done"' + (done ? '' : ' hidden') + '><button class="vf-btn vx-donebtn" disabled aria-disabled="true">' + CK + ' ' + V.doneBtn + '</button><p class="small">' + A2.done + ' <button class="linkish" data-addopen>' + A2.edit + '</button></p></div>' +
      (ADDED[key] && !done ? '<div class="vx-prev"><b>' + V.prevDone + ':</b> ' + quote(ADDED[key].length > 140 ? ADDED[key].slice(0, 137) + '…' : ADDED[key]) + '<p class="small">' + V.prevHint + '</p></div>' : '') +
      '<button class="vf-btn ' + (ADDED[key] ? '' : 'solid ') + 'vx-addb" data-addopen' + (done ? ' hidden' : '') + '>' + (ADDED[key] ? V.addMore : (q ? A2.btnQ : A2.btn)) + '</button>' +
      '<div class="vx-add" hidden>' + (why ? '<p><b>' + A2.miss + ':</b> ' + esc(why) + '</p>' : '') +
      '<p><b>' + A2.write + ':</b> ' + esc(a[0]) + '</p>' +
      '<div class="vx-ta"><textarea maxlength="400" placeholder="' + esc(a[1] ? A2.eg + a[1] : '') + '"' + (a[1] ? ' data-sug="' + esc(a[1]) + '"' : '') + '>' + esc(done || '') + '</textarea>' +
      (a[1] ? '<button class="vx-sugk" type="button" data-insert title="' + esc(V.sugHint) + '" aria-label="' + esc(V.sugHint) + '"><kbd>→</kbd></button>' : '') + '</div>' +
      '<p class="small"><b>' + A2.what + ':</b> ' + A2.happen + '</p><p class="small vx-adderr" hidden></p>' +
      '<div class="vrow"><button class="vf-btn solid" data-addsave>' + A2.save + '</button><button class="ghost" data-addcancel>' + A2.cancel + '</button></div></div></div>';
  }
  function recalcBar() {
    var n = Object.keys(ADDS).length;
    return '<div class="vx-re no-print"' + (n ? '' : ' hidden') + '><button class="vf-btn solid" data-recalc>' + W.add.recalc(n) + ' ' + ic('arrow', 16) + '</button><p class="small">' + W.add.recalcP + '</p></div>';
  }
  function bindAdds() {
    function refresh() {
      var n = Object.keys(ADDS).length;
      panel.querySelectorAll('.vx-re').forEach(function (b) { b.hidden = !n; b.querySelector('[data-recalc]').innerHTML = W.add.recalc(n) + ' ' + ic('arrow', 16); });
      panel.querySelectorAll('[data-addw]').forEach(function (w) {
        var d = !!ADDS[w.dataset.addw]; w.querySelector('.vx-done').hidden = !d; w.querySelector('.vx-addb').hidden = d || !w.querySelector('.vx-add').hidden;
      });
    }
    panel.querySelectorAll('[data-addw]').forEach(function (w) {
      var box = w.querySelector('.vx-add'), ta = box.querySelector('textarea'), err = box.querySelector('.vx-adderr');
      w.querySelectorAll('[data-addopen]').forEach(function (b) { b.onclick = function () {
        box.hidden = false; w.querySelector('.vx-addb').hidden = true; w.querySelector('.vx-done').hidden = true; ta.value = ADDS[w.dataset.addw] || ''; var k2 = box.querySelector('[data-insert]'); if (k2) k2.hidden = !!ta.value; ta.focus();
        push({ event: 'verdict_add_open', verdict_lang: LANG, signal: w.dataset.addw });
      }; });
      box.querySelector('[data-addcancel]').onclick = function () { box.hidden = true; refresh(); };
      // The suggestion sits in the empty field as a placeholder; → (or Tab)
      // in the empty field, or the small → key on touch screens, writes it in.
      var ins = box.querySelector('[data-insert]'), sug = ta.dataset.sug;
      function fill() { if (!sug) return; ta.value = sug; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); syncK(); push({ event: 'verdict_add_insert', verdict_lang: LANG, signal: w.dataset.addw }); }
      function syncK() { if (ins) ins.hidden = !!ta.value; }
      if (ins) ins.onclick = fill;
      ta.addEventListener('keydown', function (e) { if (sug && !ta.value && (e.key === 'ArrowRight' || e.key === 'Tab') && !e.shiftKey) { e.preventDefault(); fill(); } });
      ta.addEventListener('input', syncK);
      box.querySelector('[data-addsave]').onclick = function () {
        var v = ta.value.trim().replace(/\s+/g, ' ');
        if (v.length < 8) { err.textContent = W.add.empty; err.hidden = false; return; }
        var others = Object.keys(ADDS).filter(function (k) { return k !== w.dataset.addw; }).map(function (k) { return ADDS[k]; }).concat([v]);
        if ((A.text.trim() + ' ' + others.join(' ')).length > 1200) { err.textContent = W.add.long; err.hidden = false; return; }
        err.hidden = true; ADDS[w.dataset.addw] = v; box.hidden = true;
        // The same gap can sit in a step and in an area card: both show it.
        panel.querySelectorAll('[data-addw="' + w.dataset.addw + '"] textarea').forEach(function (t) { t.value = v; });
        push({ event: 'verdict_add_save', verdict_lang: LANG, signal: w.dataset.addw });
        refresh();
      };
    });
    panel.querySelectorAll('[data-recalc]').forEach(function (b) { b.onclick = function () {
      var add = Object.keys(ADDS).map(function (k) { return ADDS[k]; });
      if (!add.length) return;
      PREV = RESULT && RESULT.score; A.text = A.text.trim() + '\n' + add.join(' ');
      // The open question changes with every rating, so it is not carried over.
      Object.keys(ADDS).forEach(function (k) { if (k !== 'q') ADDED[k] = (ADDED[k] ? ADDED[k] + ' ' : '') + ADDS[k]; }); ADDS = {}; RERATED = true; (RESULT.steps || []).forEach(function (st) { var k = addKey(st); if (k && SEEN.indexOf(k) < 0) SEEN.push(k); }); saveAdded(); saveText();
      push({ event: 'verdict_recalc', verdict_lang: LANG, additions: add.length });
      go(at('loading'));
    }; });
  }
  function foundBlock(r, medium) {
    var L = r.level;
    return '<section class="vx-found" id="steps3">' + vsec('search', W.secFound) +
      '<h2 class="vx-lead">' + esc(L.headline) + ' <span>' + esc(L.why) + (L.more ? ' ' + V.more(L.more) : '') + '</span></h2>' +
      '<p class="small scoreline">' + esc(L.scoreLine) + '</p>' + (r.partial ? '<p class="small">' + V.partial + '</p>' : '') +
      '<div class="vx-cards">' + r.steps.map(function (s) {
        var g = s.signal ? GCOL[GROUP[s.signal]] : s.kind === 'flag' ? 'orange' : '';
        return '<div class="vf-card vx-step spot ' + g + '"><div class="vx-kicker">' + W.stepN(s.n) + (RERATED && addKey(s) && !ADDED[addKey(s)] && SEEN.indexOf(addKey(s)) < 0 ? ' <span class="vx-new">' + V.newTag + '</span>' : '') + '</div><b>' + esc(stepTitle(s)) + '</b><p>' + esc(s.action) + '</p>' +
          (s.why ? '<p class="whyl">' + V.why + esc(s.why) + '</p>' : '') +
          (addKey(s) ? addBox(addKey(s), '', s.kind === 'flag' ? s.action : '') + (s.tool ? '<a class="vx-then" href="' + toolHref(s.tool, medium) + '" data-step="' + s.id + '">' + W.add.then + esc(s.tool.name) + ' →</a>' : '')
            : '<div class="vrow">' + stepBtn(s, medium) + '</div>') + '</div>';
      }).join('') + '</div>' + (PREV != null && r.score != null ? '<p class="vx-delta">' + W.add.delta(PREV, r.score) + '</p>' : '') + recalcBar() + '</section>';
  }
  function twoBlock(r, medium) {
    return '<section class="vx-two">' + vsec('gauge', W.secTwo) + '<div class="sig2">' + r.areas.map(function (a) {
      var g = GROUP[a.id], st = r.steps.filter(function (s) { return s.signal === a.id; })[0];
      return '<div class="vf-card vx-area ' + GCOL[g] + ' spot"><span class="vx-badge">' + ic(a.points >= 7 ? 'up' : 'alert', 18) + '</span>' +
        '<div class="h"><div><b>' + esc(a.title) + '</b><div class="role">' + esc(roleLabel(a)) + ' · ' + esc(a.name) + '</div></div><em>' + a.points + '<small>/10</small></em></div>' +
        '<div class="bar"><i style="width:' + a.points * 10 + '%"></i></div>' +
        '<p>' + esc(a.meaning) + '</p><p><b class="albl">' + V.todoL + ':</b> ' + esc(st ? st.action : a.todo) + '</p>' +
        (a.points < 7 ? addBox(a.id, a.meaning) : '') +
        '<details class="vx-improve"><summary>' + W.improve + ic('arrow', 18) + '</summary><p>' + R.tip[a.id] + '</p><p class="dim">' + esc(a.reason) + '</p></details></div>';
    }).join('') + '</div>' + recalcBar() + '</section>';
  }
  function waitingBlock(r) {
    var n = (r.locked || []).length; if (!n) return '';
    return '<section class="vf-card vx-wait">' + '<div class="vx-whead"><span class="vx-lockc">' + ic('lock') + '</span><div><b>' + W.waitH(n) + '</b><p>' + W.waitP + '</p></div>' +
      '<a class="vf-btn solid" href="#unlock" data-want>' + ic('lock', 16) + ' ' + W.waitCta + ' ' + ic('arrow', 16) + '</a></div>' +
      '<div class="vx-lgrid">' + r.locked.map(function (x) {
        return '<div class="vx-lcard ' + GCOL[GROUP[x.id]] + '"><div><b>' + esc(x.title || x.name) + '</b>' + ic('lock', 16) + '</div><i></i><i></i><i></i></div>';
      }).join('') + '</div>' +
      '<div class="vx-q"><b>' + R.openQ + '</b><p>' + esc(r.missing[0] || STR.nothing) + (r.missingMore ? ' <span class="dim">+' + r.missingMore + STR.inReport + '</span>' : '') + '</p>' +
      (r.missing[0] && !r.report ? addBox('q', '', r.missing[0], true) : '') + '</div></section>';
  }
  function fullBlock(r) {
    var tax = r.pricing && r.pricing.report && r.pricing.report.taxModule, cn = A.country && A.country !== 'other' && A.country !== 'na' ? label('country', A.country) : '';
    var mocks = ['<i class="dot"></i><i class="l"></i><i class="dot"></i><i class="l s"></i>', '<i class="l"></i><i class="l s"></i><i class="l"></i><i class="l s"></i>', '<i class="hex"></i><i class="l r"></i><i class="l r s"></i>', '<i class="bars"></i>', '<i class="l"></i><i class="l s"></i><i class="l"></i>', '<i class="doc"></i>'];
    return '<section class="vx-full">' + vsec('box', W.secFull) + '<h2 class="vx-h">' + W.fullH + '</h2><p class="sub">' + W.fullP + '</p>' +
      '<div class="vx-fgrid">' + W.feats(tax, cn).map(function (f, i) {
        return '<div class="vf-card vx-feat"><div class="vx-mock">' + mocks[i] + '<span class="vx-lk">' + ic('lock', 14) + ' ' + W.locked + '</span><span class="vx-lockc big">' + ic('lock', 26) + '</span></div><b>' + f[0] + '</b><p>' + f[1] + '</p></div>';
      }).join('') + '</div></section>';
  }
  function payBlock(r) {
    var pr = r.pricing || { report: { mode: 'waitlist' } }, wait = pr.report.mode !== 'checkout', cov = r.covered == null ? 0 : r.covered;
    return '<section class="vf-card vx-pay no-print" id="unlock"><div class="vx-pl"><h2>' + W.payH + '</h2><p class="sub">' + W.payP + '</p>' +
      '<div class="vx-bars"><div><span>' + W.barToday + '</span><b>' + W.of10(cov) + '</b><i><em style="width:' + cov * 10 + '%"></em></i></div>' +
      '<div class="hi"><span>' + W.barReport + '</span><b>' + W.of10(10) + '</b><i><em style="width:100%"></em></i></div></div></div>' +
      '<div class="vx-pr" id="report"><b class="vx-pt">' + W.payT + '</b><div class="vx-row"><span>' + W.payRow + '</span><span>' + V.repPrice + '</span></div>' +
      '<div class="vx-row big"><span>' + W.once + '</span><strong>' + V.repPrice + '</strong></div><p class="small">' + W.onceNote + '</p>' +
      '<div class="vx-plus"><span class="vx-lockc">' + ic('shield') + '</span><div><b>' + W.plusT + '</b><p>' + W.plusP + '</p></div><button class="vf-btn" data-consult>' + W.plusBtn + '</button></div>' +
      (wait ? '<p class="small">' + STR.waitNote + '</p>' + wantForm(W.waitBtn)
        : '<button class="vf-btn solid vx-buy" data-checkout>' + W.buyBtn + ' ' + ic('arrow', 18) + '</button><p class="small c">' + W.opens + '</p><p class="small c">' + ic('shield', 16) + ' ' + W.stripe + '</p>') +
      '<p class="small cfo">' + V.cfo.replace('<b>Virtuse CFO</b>', '<a href="cfo.html#pricing"><b>Virtuse CFO</b></a>') + '</p></div></section>';
  }
  function trustBlock() {
    return '<section class="vx-trust">' + vsec('quote', W.secTrust) + '<div class="vx-tgrid">' + W.trust.map(function (t) { return '<div class="vf-card vx-tcard"><b>' + t[0] + '</b><p>' + t[1] + '</p></div>'; }).join('') + '</div></section>';
  }
  function faqBlock(r) {
    var wait = !(r.pricing && r.pricing.report && r.pricing.report.mode === 'checkout');
    return '<section class="vx-faq no-print">' + vsec('help', W.secFaq) + '<div class="vf-card vx-acc">' + W.faq.map(function (f) { return '<details><summary>' + f[0] + ic('arrow', 18) + '</summary><p>' + f[1] + '</p></details>'; }).join('') + '</div>' +
      '<div class="vx-final"><button class="vf-btn solid" data-want>' + (wait ? W.ctaFinal : W.buyBtn) + ' <span>|</span> ' + V.repPrice + '</button><p class="small">' + W.ctaNote + '</p></div></section>';
  }
  // PDF report v1 (HANDOVER-verdict-pdf-ux-2026-10-27, phase 1): a separate,
  // print-only A4 document built from the report data at click time; the
  // browser saves it as PDF. White paper, no site chrome, page numbers.
  var PD = {
    sk: { moreB: 'Celý report za 14 €', moreR: 'obsahuje všetkých 10 oblastí s dôvodom, všetky chýbajúce otázky, plán krokov a 5-stranové PDF.', docFree: 'Verdict · zhrnutie', two: 'Dve oblasti za vaším verdiktom', openQ: 'Otázka, na ktorú zatiaľ nemáte odpoveď', more: 'Celý report za 14 € obsahuje všetkých 10 oblastí s dôvodom, všetky chýbajúce otázky, plán krokov a 5-stranové PDF.', pdfFree: 'Stiahnuť PDF zhrnutie', doc: 'Verdict · report', date: 'Dátum', goal: 'Čo zvažujete', country: 'Krajina', score: 'Skóre úplnosti plánu', scoreNote: 'Meria úplnosť plánu, nie či je Bitcoin dobrá voľba.', steps: 'Tri ďalšie kroky', tool: 'Nástroj', signals: 'Všetkých 10 oblastí', todo: 'Čo urobiť', gaps: 'Otázky, na ktoré ešte nemáte odpoveď', plan: 'Plán krokov', planP: 'Oblasti pod 7 bodov, od najslabšej.', planNone: 'Všetky oblasti majú aspoň 7 bodov.', covered: function (n) { return 'Dobre opísané oblasti: ' + n + ' z 10.'; }, partners: 'Kde to môžete urobiť', partnersP: 'Partneri, ktorí spĺňajú vaše kritériá. Poradie určujú pevné pravidlá, nie provízia. Porovnáte a vyberiete vy.', disclose: 'Partnerské odkazy: ak sa zaregistrujete, Virtuse môže dostať províziu, vaša cena sa nemení.', notes: 'Poznámky k daniam, úschove a poplatkom', taxNote: 'Nie je to daňové poradenstvo. Pravidlá si overte s daňovým poradcom.', fees: 'Poplatky porovnáte v Indexe poplatkov', links: 'Užitočné odkazy', appendix: 'Príloha: vaše odpovede', again: 'Ohodnotiť znova', consult: 'Osobná konzultácia, 15 minút, zadarmo', legal: 'Vygenerované umelou inteligenciou. Nie je to investičné, daňové ani právne poradenstvo. Virtuse nedrží vaše kľúče ani peniaze.', id: 'ID reportu', file: 'Virtuse-Verdict' },
    en: { moreB: 'The full €14 report', moreR: 'has all 10 signals with reasons, every missing question, a step plan and a 5-page PDF.', docFree: 'Verdict · summary', two: 'Two signals behind your verdict', openQ: 'A question you have not answered yet', more: 'The full €14 report has all 10 signals with reasons, every missing question, a step plan and a 5-page PDF.', pdfFree: 'Download PDF summary', doc: 'Verdict · report', date: 'Date', goal: 'What you are considering', country: 'Country', score: 'Plan completeness score', scoreNote: 'Measures how complete the plan is, not whether Bitcoin is a good choice.', steps: 'Three next steps', tool: 'Tool', signals: 'All 10 signals', todo: 'What to do', gaps: 'Questions you have not answered yet', plan: 'Step plan', planP: 'Signals under 7 points, weakest first.', planNone: 'Every signal has at least 7 points.', covered: function (n) { return 'Signals well described: ' + n + ' of 10.'; }, partners: 'Where you can do it', partnersP: 'Partners that match your criteria. Fixed rules set the order, not commission. You compare and choose.', disclose: 'Partner links: if you sign up, Virtuse may receive a commission; your price does not change.', notes: 'Notes on tax, custody and fees', taxNote: 'This is not tax advice. Check the rules with a tax adviser.', fees: 'Compare fees in the Bitcoin Fee Index', links: 'Useful links', appendix: 'Appendix: your answers', again: 'Rate again', consult: 'Personal consultation, 15 minutes, free', legal: 'Generated by artificial intelligence. Not investment, tax or legal advice. Virtuse holds no keys or funds.', id: 'Report ID', file: 'Virtuse-Verdict' },
    ru: { moreB: 'Полный отчёт за 14 €', moreR: 'содержит все 10 областей с пояснениями, все недостающие вопросы, план шагов и PDF на 5 страниц.', docFree: 'Вердикт · краткая версия', two: 'Две области за вашим вердиктом', openQ: 'Вопрос, на который у вас пока нет ответа', more: 'Полный отчёт за 14 € содержит все 10 областей с пояснениями, все недостающие вопросы, план шагов и PDF на 5 страниц.', pdfFree: 'Скачать PDF (кратко)', doc: 'Вердикт · отчёт', date: 'Дата', goal: 'Что вы рассматриваете', country: 'Страна', score: 'Оценка полноты плана', scoreNote: 'Измеряет полноту плана, а не то, хорош ли Биткоин.', steps: 'Три следующих шага', tool: 'Инструмент', signals: 'Все 10 областей', todo: 'Что сделать', gaps: 'Вопросы, на которые у вас пока нет ответа', plan: 'План шагов', planP: 'Области ниже 7 баллов, от самой слабой.', planNone: 'У всех областей не меньше 7 баллов.', covered: function (n) { return 'Хорошо описанных областей: ' + n + ' из 10.'; }, partners: 'Где это можно сделать', partnersP: 'Партнёры, которые соответствуют вашим критериям. Порядок определяют фиксированные правила, а не комиссия. Сравниваете и выбираете вы.', disclose: 'Партнёрские ссылки: если вы зарегистрируетесь, Virtuse может получить комиссию, ваша цена не меняется.', notes: 'Заметки о налогах, хранении и комиссиях', taxNote: 'Это не налоговая консультация. Проверьте правила у налогового консультанта.', fees: 'Комиссии сравните в Индексе комиссий', links: 'Полезные ссылки', appendix: 'Приложение: ваши ответы', again: 'Оценить снова', consult: 'Личная консультация, 15 минут, бесплатно', legal: 'Создано искусственным интеллектом. Не является инвестиционной, налоговой или юридической консультацией. Virtuse не хранит ваши ключи и деньги.', id: 'ID отчёта', file: 'Virtuse-Verdict' }
  }[LANG];
  function absUrl(h) { try { var u = new URL(h, location.href); ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) { u.searchParams.delete(k); }); return 'virtuse.com' + u.pathname + u.search; } catch (e) { return h; } }
  function shortId(r) { var t = (A.text || '') + '|' + (r.score || 0) + '|' + new Date().toISOString().slice(0, 10), h = 5381; for (var k = 0; k < t.length; k++) h = ((h * 33) ^ t.charCodeAt(k)) >>> 0; return ('00000' + h.toString(16)).slice(-6).toUpperCase(); }
  function printDoc(r) {
    var ds = new Date().toLocaleDateString({ sk: 'sk-SK', ru: 'ru-RU' }[LANG] || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), id = shortId(r);
    var cn = A.country && A.country !== 'na' && A.country !== 'other' ? (label('country', A.country) || '') : '';
    var areas = r.areas || [], col = { risk: '#2563eb', taxc: '#0f8f7d', plan: '#7c3aed' }, groups = ['risk', 'taxc', 'plan'];
    var stepRow = function (s) { return '<li><b>' + esc(stepTitle(s)) + '</b><span>' + esc(s.action) + '</span>' + (s.tool ? '<em>' + PD.tool + ': ' + esc(s.tool.name) + ' · ' + esc(absUrl(toolHref(s.tool, 'pdf'))) + '</em>' : '') + '</li>'; };
    var cards = [].slice.call(document.querySelectorAll('#pfBox .pcard')).map(function (c) {
      var g = function (q) { var e = c.querySelector(q); return e ? e.textContent.trim() : ''; };
      return '<div class="pp"><b>' + esc(g('b')) + '</b><span>' + esc(g('.tl')) + '</span>' + (g('.lic') ? '<i>' + esc(g('.lic')) + '</i>' : '') + (g('.fee') ? '<i>' + esc(g('.fee')) + '</i>' : '') + '</div>';
    }).join('');
    var tax = areas.filter(function (a) { return a.id === 'tax'; })[0], cus = areas.filter(function (a) { return a.id === 'custody'; })[0];
    var rows = [['goal', goalLabel()]].concat(KEYS().map(function (k) { return [k, ans(k)]; }));
    var plan = r.plan || [], pre = LANG === 'en' ? '' : '/' + LANG;
    var feeUrl = 'virtuse.com' + ({ sk: '/sk/bitcoin-index-poplatkov/', ru: '/ru/bitcoin-indeks-komissiy/' }[LANG] || '/bitcoin-fee-index/');
    return '<div class="pd" lang="' + LANG + '">' +
      '<section class="pd-cover"><div class="pd-brand"><img src="/email-virtuse-v-mark.png" alt="" width="34" height="22"><b>Virtuse</b><span>' + PD.doc + '</span></div>' +
      '<p class="pd-meta">' + PD.date + ': ' + esc(ds) + (A.name ? ' · ' + esc(A.name) : '') + ' · ' + PD.id + ' ' + id + '</p>' +
      '<blockquote>' + quote(A.text || '') + '</blockquote><p class="pd-meta">' + PD.goal + ': ' + esc(goalLabel()) + (cn ? ' · ' + PD.country + ': ' + esc(cn) : '') + '</p>' +
      '<div class="pd-score"><div class="pd-num">' + (r.score == null ? '–' : r.score) + '<small>/100</small></div><div><span class="pd-pill">' + esc((V.levelPill || {})[r.level.id] || '') + '</span><h1>' + esc(r.level.headline) + '</h1><p>' + esc(r.level.why) + '</p><p class="pd-note">' + PD.score + '. ' + PD.scoreNote + '</p></div></div>' +
      '<h2>' + PD.steps + '</h2><ol class="pd-steps">' + (r.steps || []).map(stepRow).join('') + '</ol>' +
      '<p class="pd-legal">' + PD.legal + '</p></section>' +
      '<section class="pd-page"><h2>' + PD.signals + '</h2><div class="pd-sgrid">' + groups.map(function (gk) {
        return '<h3 style="color:' + col[gk] + '">' + R.group[gk] + '</h3>' + areas.filter(function (a) { return GROUP[a.id] === gk; }).map(function (a) {
          return '<div class="pd-sig"><div class="pd-sh"><b>' + esc(a.title) + '</b><em>' + a.points + '/10</em></div><div class="pd-bar"><i style="width:' + a.points * 10 + '%;background:' + col[gk] + '"></i></div><p>' + esc(a.reason || a.meaning) + '</p><p><b>' + PD.todo + ':</b> ' + esc(a.todo) + '</p></div>';
        }).join('');
      }).join('') + '</div></section>' +
      '<section class="pd-page"><h2>' + PD.gaps + '</h2><ol class="pd-list">' + (r.missing || []).map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ol>' +
      '<h2>' + PD.plan + '</h2><p class="pd-note">' + (plan.length ? PD.planP : PD.planNone) + ' ' + PD.covered(r.covered || 0) + '</p>' +
      '<table class="pd-tab">' + plan.map(function (s) { return '<tr><td><b>' + esc(s.title) + '</b></td><td>' + s.points + '/10</td><td>' + esc(s.tool.name) + '<br><span>' + esc(absUrl(toolHref(s.tool, 'pdf'))) + '</span></td></tr>'; }).join('') + '</table></section>' +
      '<section class="pd-page"><h2>' + PD.partners + '</h2><p class="pd-note">' + PD.partnersP + '</p><div class="pd-pgrid">' + cards + '</div><p class="pd-note">' + PD.disclose + '</p>' +
      '<h2>' + PD.notes + '</h2>' + (tax ? '<div class="pd-sig"><b>' + esc(tax.title) + '</b><p>' + esc(tax.meaning) + '</p><p class="pd-note">' + PD.taxNote + '</p></div>' : '') +
      (cus ? '<div class="pd-sig"><b>' + esc(cus.title) + '</b><p>' + esc(cus.meaning) + '</p><p>' + esc(R.tip.custody) + '</p></div>' : '') +
      '<div class="pd-sig"><b>' + PD.fees + '</b><p>' + esc(feeUrl) + '</p></div></section>' +
      '<section class="pd-page"><h2>' + PD.appendix + '</h2><table class="pd-tab">' + rows.map(function (x) { return '<tr><td>' + esc(STR.rev[x[0]] || x[0]) + '</td><td>' + esc(x[1]) + '</td></tr>'; }).join('') + '</table>' +
      '<h2>' + PD.links + '</h2><ul class="pd-list"><li>Partner Finder · virtuse.com' + pre + '/concierge.html</li><li>Tax &amp; Inheritance Agent · virtuse.com' + pre + '/tax-agent.html</li><li>' + PD.again + ' · virtuse.com' + pre + '/verdict.html</li><li>' + PD.consult + ' · virtuse.com' + pre + '/verdict.html</li></ul>' +
      '<p class="pd-legal">' + esc(r.scoreNote || '') + '</p><p class="pd-legal">' + PD.legal + '</p></section></div>';
  }
  // Free result: one A4 page (Ras 2026-10-27), design v2 from the handover
  // (verdict-summary-v2.html): white page, Services/Ecosystem tokens, Virtuse V,
  // ring score, step cards, two areas, question box, partner cards, dark CTA.
  // The full 5-page PDF stays in the report.
  function printDocFree(r) {
    var ds = new Date().toLocaleDateString({ sk: 'sk-SK', ru: 'ru-RU' }[LANG] || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), id = shortId(r);
    var cn = A.country && A.country !== 'na' && A.country !== 'other' ? (label('country', A.country) || '') : '';
    var pc = ['var(--p2-teal)', 'var(--p2-blue)', 'var(--p2-purple)'];
    var cards = [].slice.call(document.querySelectorAll('#pfBox .pcard')).slice(0, 3).map(function (c, n) {
      var g = function (q) { var e = c.querySelector(q); return e ? e.textContent.trim() : ''; };
      return '<div class="p2-pcard" style="--pc:' + pc[n] + '"><h4>' + esc(g('b')) + '</h4><p>' + esc(g('.lic') || g('.tl')) + '</p></div>';
    }).join('');
    var sc = r.score == null ? 0 : r.score, C = 2 * Math.PI * 32;
    var logo = '<svg viewBox="0 0 760 483" aria-hidden="true"><defs><linearGradient id="p2vA" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#A5E0FB"/><stop offset="1" stop-color="#5FAEDE"/></linearGradient><linearGradient id="p2vB" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#4D94EC"/><stop offset="1" stop-color="#2B62C0"/></linearGradient></defs><path fill="url(#p2vA)" d="M30 0h220l250 483H280Z"/><path fill="url(#p2vB)" d="M510 0h245L645 205H400Z"/></svg>';
    var sec = function (c, t) { return '<div class="p2-sec" style="--c:' + c + '"><i></i>' + t + '</div>'; };
    var site = 'virtuse.com' + (LANG === 'en' ? '' : '/' + LANG) + '/verdict.html';
    return '<div class="p2" lang="' + LANG + '"><div class="p2-page">' +
      '<header class="p2-top"><div class="p2-brand">' + logo + '<span>Virtuse</span></div><div class="p2-meta"><div class="p2-eyebrow"><i></i>' + PD.docFree + '</div><div class="p2-date">' + esc(ds) + ' · ID ' + id + (A.name ? ' · ' + esc(A.name) : '') + '</div></div></header>' +
      '<div class="p2-grow">' +
      '<div class="p2-quote"><q>' + esc(A.text || '') + '</q><div class="p2-sub">' + PD.goal + ': ' + esc(goalLabel()) + (cn ? ' · ' + PD.country + ': ' + esc(cn) : '') + '</div></div>' +
      '<section class="p2-score"><div class="p2-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" fill="none" stroke="#e6ebf0" stroke-width="7"/><circle cx="40" cy="40" r="32" fill="none" stroke="#5faede" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (C * sc / 100).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg><div class="p2-num"><b>' + (r.score == null ? '–' : sc) + '</b><small>/100</small></div></div>' +
      '<div class="p2-sbody"><div class="p2-chip"><i></i>' + esc((V.levelPill || {})[r.level.id] || '') + '</div><h1>' + esc(r.level.headline) + '</h1><p>' + esc(r.level.why) + '</p><div class="p2-note">' + PD.score + '. ' + PD.scoreNote + '</div></div></section>' +
      '<div class="p2-grp">' + sec('var(--p2-blue)', PD.steps) + '<div class="p2-steps">' + (r.steps || []).map(function (s, n) {
        return '<div class="p2-step"><div class="p2-n">' + (n + 1) + '</div><div><h3>' + esc(stepTitle(s)) + '</h3><p>' + esc(s.action) + '</p>' + (s.tool ? '<span class="p2-tool">' + PD.tool + ' · ' + esc(s.tool.name) + '</span>' : '') + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="p2-grp">' + sec('var(--p2-teal)', PD.two) + '<div class="p2-areas">' + (r.areas || []).map(function (a) {
        return '<div class="p2-area" style="--ac:' + (a.points < 7 ? 'var(--p2-orange)' : 'var(--p2-green)') + '"><div class="p2-row"><h3>' + esc(a.title) + '</h3><span class="p2-pts">' + a.points + '/10</span></div><p>' + esc(a.meaning) + '</p><div class="p2-do"><b>' + PD.todo + ':</b> ' + esc(a.todo) + '</div></div>';
      }).join('') + '</div></div>' +
      (r.missing && r.missing[0] ? '<div class="p2-qbox">' + sec('var(--p2-purple)', PD.openQ) + '<p>' + esc(r.missing[0]) + '</p></div>' : '') +
      (cards ? '<div class="p2-grp">' + sec('var(--p2-teal)', PD.partners) + '<div class="p2-partners">' + cards + '</div><p class="p2-aff">' + PD.disclose + '</p></div>' : '') +
      '<div class="p2-cta"><p><strong>' + PD.moreB + '</strong> ' + PD.moreR + '</p><a>' + site + '</a></div>' +
      '</div><footer class="p2-foot"><div class="p2-legal">' + PD.legal + '</div><div class="p2-copy">© 2018–2026 Virtuse Wealth Management, a.s. · 1 / 1</div></footer></div></div>';
  }
  function downloadPdf() {
    var r = RESULT; if (!r) return;
    push({ event: r.report ? 'verdict_report_pdf' : 'verdict_free_pdf', verdict_lang: LANG });
    var old = document.getElementById('vxPrint'); if (old) old.remove();
    var full = !!r.report;
    var box = document.createElement('div'); box.id = 'vxPrint'; box.className = 'vx-printdoc'; box.innerHTML = full ? printDoc(r) : printDocFree(r);
    document.body.appendChild(box);
    // Free PDF: always exactly one A4 page. Lay it out off-screen at 210 mm, and
    // when the content is taller than the page, zoom the whole page down so it fits.
    if (!full) {
      var pg = box.querySelector('.p2-page');
      box.classList.add('vx-measure');
      var A4 = 296 * 96 / 25.4, need = pg ? pg.scrollHeight : 0;
      box.classList.remove('vx-measure');
      if (pg && need > A4) { var z = Math.max(0.6, Math.floor(A4 / need * 1000) / 1000); pg.style.zoom = z; pg.style.height = 'calc(296mm / ' + z + ')'; }
    }
    var st = document.createElement('style'); st.id = 'vxPrintPage';
    st.textContent = full ? '@media print { :root { color-scheme: light !important; } html, body { background: #fff !important; background-image: none !important; } } @page { size: A4; margin: 11mm 14mm 15mm; @bottom-left { content: "© 2018–2026 Virtuse Wealth Management, a.s."; font: 8pt Inter, Arial, sans-serif; color: #666; } @bottom-right { content: counter(page) " / " counter(pages); font: 8pt Inter, Arial, sans-serif; color: #666; } }' : '@media print { :root { color-scheme: light !important; } html, body { background: #fff !important; background-image: none !important; } } @page { size: A4; margin: 0; }';
    document.head.appendChild(st);
    var t = document.title; document.title = PD.file + '-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + shortId(r);
    document.body.classList.add('vf-print');
    function done() { document.body.classList.remove('vf-print'); document.title = t; box.remove(); st.remove(); window.removeEventListener('afterprint', done); }
    window.addEventListener('afterprint', done);
    window.print();
  }
  function legal(r) { return '<p class="small" style="margin-top:22px">' + esc(r.scoreNote) + '</p><p class="small">' + esc(r.aiLabel) + ' ' + esc(r.disclaimer) + '</p>'; }
  function againFoot(pdf) { return '<div class="foot no-print" style="margin-top:18px"><button class="vf-btn" data-again>' + V.filler.recheck + '</button>' + '<button class="vf-btn solid" data-pdf>' + (pdf ? STR.pdf : PD.pdfFree) + '</button></div>'; }
  function sticky() { return '<div class="vf-sticky"><a class="vf-btn" href="#steps3">' + V.stickySteps + '</a><button class="vf-btn solid" data-want>' + V.stickyRep + '</button></div>'; }
  function bindCommon() {
    var r = RESULT || {};
    push({ event: 'verdict_complete', verdict_lang: LANG, tier: r.report ? 'report' : 'free', verdict_band: r.band && r.band.id, verdict_level: r.level && r.level.id, verdict_score: r.score, verdict_goal: A.goal || 'other' });
    panel.querySelectorAll('[data-consult]').forEach(function (b) { b.onclick = function () {
      push({ event: 'consultation_click', verdict_lang: LANG, verdict_band: r.band && r.band.id, verdict_level: r.level && r.level.id, tier: r.report ? 'report' : 'free' });
      if (window.VirtuseConsultation) window.VirtuseConsultation.open(LANG);
    }; });
    panel.parentNode.querySelectorAll('[data-again]').forEach(function (b) { b.onclick = function () { A.text = ''; RESULT = null; go(1); }; });
    panel.querySelectorAll('[data-step]').forEach(function (b) { b.addEventListener('click', function () { push({ event: 'verdict_step_click', verdict_lang: LANG, step: b.dataset.step, verdict_level: r.level && r.level.id }); }); });
    panel.querySelectorAll('[data-pdf]').forEach(function (b) { b.onclick = downloadPdf; });
    var sh = document.getElementById('pfShow');
    if (sh) sh.onclick = function () { document.getElementById('pfBox').hidden = false; sh.hidden = true; push({ event: 'verdict_pf_show', verdict_lang: LANG }); };
    var pb = document.getElementById('report');
    if (pb && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); push({ event: 'pricing_view', verdict_lang: LANG, verdict_level: r.level && r.level.id }); } }, { threshold: .3 });
      io.observe(pb);
    }
    spot();
  }
  function showResult() {
    var r = RESULT; if (!r) { go(at('review')); return; }
    var again = '<div class="foot" style="margin-top:18px"><button class="ghost" id="again">' + STR.again + '</button></div>';
    if (r.declined) {
      panel.innerHTML = '<div class="eyebrow">' + STR.resEb + '</div><h2>' + STR.declinedH + '</h2><p class="sub">' + esc(r.message) + '</p><p class="small">' + esc(r.aiLabel) + '</p>' + again;
      document.getElementById('again').onclick = function () { go(at('text')); };
      return;
    }
    if (!r.level || !r.steps || !r.areas) { panel.innerHTML = '<h2>' + STR.failH + '</h2><p class="sub">' + STR.error + '</p>' + again; document.getElementById('again').onclick = function () { go(at('review')); }; return; }
    if (r.report) { showReport(r); return; }
    panel.innerHTML = '<div data-ai-generated="true" class="vx">' + decisionBlock(r) + foundBlock(r, 'result') + twoBlock(r, 'result') + waitingBlock(r) +
      partnersBlock(r, 'verdict') + fullBlock(r) + payBlock(r) + trustBlock() + faqBlock(r) + legal(r) + againFoot(false) + '</div>' + sticky();
    bindCommon(); bindWant(); bindAdds(); PREV = null; loadPartners(r, 'verdict');
  }

  // Interest in the full report: email only, no decision text.
  function wantForm(btn) {
    return '<form class="want" id="want" novalidate><input type="email" id="we" autocomplete="email" placeholder="' + STR.wantPh + '" aria-label="' + STR.wantPh + '" required>' +
      '<input type="text" id="wh" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">' +
      '<button class="vf-btn solid" type="submit">' + (btn || STR.wantBtn) + '</button><p class="small" id="wm" aria-live="polite">' + STR.wantNote + ' <a href="privacy-policy.html#verdict-cfo">' + STR.privacy + '</a></p></form>';
  }
  function wantOk() { try { return sessionStorage.getItem('vb-want-ok') === '1'; } catch (e) { return false; } }
  function wantDoneAll() {
    try { sessionStorage.setItem('vb-want-ok', '1'); } catch (e) {}
    panel.parentNode.querySelectorAll('[data-want]').forEach(function (b) {
      b.classList.add('vx-wantdone'); b.setAttribute('aria-disabled', 'true'); if (b.tagName === 'BUTTON') b.disabled = true; else b.removeAttribute('href');
      b.innerHTML = CK + ' ' + V.wantDone; b.onclick = function (e) { if (e) e.preventDefault(); };
    });
  }
  function bindWant() {
    var f = document.getElementById('want');
    if (f && wantOk()) { f.innerHTML = '<p class="sub sm" style="color:var(--text)">' + STR.wantOk + '</p>'; wantDoneAll(); return; }
    if (!f) { panel.parentNode.querySelectorAll('[data-want]').forEach(function (b) { b.onclick = function (e) { e.preventDefault(); var u = document.getElementById('unlock'); if (u) u.scrollIntoView({ behavior: 'smooth' }); }; }); return; }
    panel.parentNode.querySelectorAll('[data-want]').forEach(function (b) {
      b.onclick = function (e) { if (e) e.preventDefault(); push({ event: 'unlock_click', verdict_lang: LANG, verdict_band: RESULT && RESULT.band && RESULT.band.id, verdict_level: RESULT && RESULT.level && RESULT.level.id }); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { var e = document.getElementById('we'); if (e) e.focus({ preventScroll: true }); }, 500); };
    });
    f.onsubmit = function (e) {
      e.preventDefault();
      var em = document.getElementById('we').value.trim(), msg = document.getElementById('wm'), btn = f.querySelector('button');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { msg.textContent = STR.wantBad; return; }
      btn.disabled = true;
      push({ event: 'unlock_click', verdict_lang: LANG, verdict_level: RESULT && RESULT.level && RESULT.level.id, via: 'form' });
      var body = { email: em, hp: document.getElementById('wh').value, source: 'verdict_report', lang: LANG };
      vbApi().then(function (api) { return api.postJson('/waitlist', body); })
        .then(function (r) { return { ok: r.ok, d: r.data }; })
        .catch(function () { return { ok: false, d: { error: STR.network } }; })
        .then(function (x) {
          if (x.ok) {
            f.innerHTML = '<p class="sub sm" style="color:var(--text)">' + STR.wantOk + '</p>';
            wantDoneAll();
            push({ event: 'capture_submit', capture_source: 'verdict_report', verdict_lang: LANG });
          } else { btn.disabled = false; msg.textContent = (x.d && x.d.error) || STR.error; }
        });
    };
  }

  // Full report (preview only until payments exist; see the header comment):
  // verdict, steps, all 10 areas by group, every missing question, partners,
  // PDF; the staging preview also shows the free view's pricing block.
  function showReport(r) {
    var groups = ['risk', 'taxc', 'plan'];
    panel.innerHTML = '<div data-ai-generated="true" class="report">' +
      '<p class="warn no-print">' + STR.prevNote + '</p><div class="vx-pdfbar no-print"><button class="vf-btn solid" data-pdf>' + V.pdfDl + '</button><button class="vf-btn" data-pdf>' + V.pdfPrint + '</button><button class="vf-btn" data-again>' + V.filler.recheck + '</button></div>' + headBlock(r) + stepsBlock(r, 'report') +
      groups.map(function (g) {
        var ss = r.areas.filter(function (a) { return GROUP[a.id] === g; });
        return '<div class="sec">' + R.group[g] + '</div><div class="sig2">' + ss.map(function (a) { return areaCard(a, 'report', r.steps); }).join('') + '</div>';
      }).join('') +
      '<div class="sec">' + V.missAllH + '</div><div class="faq">' + (r.missing.length ? r.missing.map(function (m, n) { return '<div class="vf-card q"><b>' + (n + 1) + '</b><p>' + esc(m) + '</p></div>'; }).join('') : '<p class="sub sm">' + STR.nothing + '</p>') + '</div>' +
      partnersBlock(r, 'verdict_report') +
      '<p class="sub sm no-print consult-line">' + V.consultSmall + ' <a href="#" data-consult>' + V.consultLink + '</a></p>' +
      '<div class="sec badge">' + V.visitorBadge + '</div>' + fullBlock(r) + payBlock(r) + trustBlock() + faqBlock(r) + legal(r) + againFoot(true) + '</div>';
    bindCommon(); bindWant(); loadPartners(r, 'verdict_report');
  }

  // Cursor spotlight (same effect as site-v2.js, for cards rendered later).
  function spot() {
    panel.querySelectorAll('.spot, .opt').forEach(function (c) {
      if (c.dataset.spot) return; c.dataset.spot = '1';
      var raf = 0, px = 0, py = 0; c.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(function () { raf = 0; c.classList.add('pm'); var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (px - r.left) + 'px'); c.style.setProperty('--my', (py - r.top) + 'px'); }); }, { passive: true });
      c.addEventListener('pointerleave', function () { if (raf) { cancelAnimationFrame(raf); raf = 0; } c.classList.remove('pm'); });
    });
  }

  // Startup: earlier answers from the shared profile, text from this session;
  // cfo.html hands over a fresh text (sessionStorage 'vb-verdict-text').
  var handed = '', src = (location.search.match(/[?&]utm_source=([\w-]+)/) || [])[1] || 'direct';
  try { handed = sessionStorage.getItem('vb-verdict-text') || ''; sessionStorage.removeItem('vb-verdict-text'); } catch (e) {}
  if (P) {
    var pf = P.get(), pt = P.getText();
    // "What do you most want to find out" is asked fresh every time (Ras 2026-10-27:
    // all four were ticked from an earlier run); the other answers stay preselected.
    Object.keys(pf).forEach(function (k) { if (k !== 'focus') A[k] = pf[k]; });
    if (pt.text) A.text = pt.text; if (pt.name) A.name = pt.name;
  }
  // A new decision from cfo.html is a new verdict: drop the old decision's
  // name and walk through the questions again from the goal; earlier answers
  // only stay preselected (bug 2026-10-27: it jumped straight to the check).
  if (handed) { A.text = handed.slice(0, 1200); A.name = ''; src = 'cfo'; saveText(); }
  build();
  push({ event: 'verdict_start', verdict_lang: LANG, source: src });
  if (handed) go(at('goal'));
  else if (A.goal) {
    // Prefilled: the final check when everything is answered, else the first gap.
    var gap = KEYS().filter(function (k) { return !A[k]; })[0];
    if (A.text.trim().length < 20) go(at('text'));
    else if (gap) go(at(gap));
    else go(at('review'));
  } else go(0);
  // The Verdict landing above the funnel already says what the intro says:
  // its CTA skips the intro screen (verdict-landing build.py).
  window.vfSkipIntro = function () { if (i === 0) next(); };
  // The landing hero form hands its text straight in (same path as a hand-over from cfo.html).
  window.vfStartWithText = function (text) {
    A.text = String(text || '').slice(0, 1200); A.name = ''; saveText(); build();
    push({ event: 'verdict_start', verdict_lang: LANG, source: 'hero' });
    go(at('goal'));
  };
})();
