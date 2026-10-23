// Verdict question funnel (verdict.html, sk/verdict.html). Asks the questions the
// AI would otherwise guess, then calls the Worker (POST /verdict with a profile of
// fixed ids, see cloudflare-worker/src/verdict.js PROFILE) and shows the free view:
// score, strongest and weakest signal, 8 locked, Partner Finder prefilled.
// Off until launch: on for staging, ?verdict=1 or <meta name="vb-verdict" content="on">.
// cfo.html hands over the decision text in sessionStorage 'vb-verdict-text'.
// Full report: no payment yet. Visitors leave an email (Worker POST /waitlist,
// source verdict_report). On staging the request asks the staging Worker for
// the report preview (?free=1 shows the free view instead).
// Questions depend on the goal (GOALSETS); hints only say an answer "affects"
// a signal when the Worker's profileFloors() backs it.
(function () {
  var LANG = document.documentElement.lang === 'sk' ? 'sk' : 'en';
  // Staging and local testing call the staging Worker (Verdict open, full
  // report preview); production calls the production Worker.
  var STAGE = location.hostname === 'staging.virtuse.com' || location.hostname === 'localhost';
  var WORKER = (STAGE ? 'https://virtuse-newsletter-staging.virtuse-ai.workers.dev' : 'https://virtuse-newsletter.virtuse-ai.workers.dev') + '/verdict';
  var WAITLIST = 'https://virtuse-newsletter.virtuse-ai.workers.dev/waitlist';
  var meta = document.querySelector('meta[name="vb-verdict"]');
  // ?free=1 shows the free view on staging too.
  var PREVIEW = !/[?&]free=1\b/.test(location.search) && (STAGE || /[?&]report=1\b/.test(location.search));
  var ON = location.hostname === 'staging.virtuse.com' || location.hostname === 'localhost' || /[?&]verdict=1\b/.test(location.search) || (meta && meta.content === 'on');

  var STR = {
    sk: {
      steps: ['Rozhodnutie', 'O vás', 'Váš plán', 'Kontrola'], back: '← Späť', cont: 'Pokračovať', start: 'Začať', skip: '? Zatiaľ neviem', other: 'Niečo iné, opíšem to',
      closedH: 'Verdict sa otvára 1. novembra.', closedP: 'Zapíšte sa a dáme vám vedieť.', closedCta: 'Na stránku Virtuse CFO',
      startEb: 'Verdict · zadarmo', startH: 'Otestujte svoje rozhodnutie o Bitcoine. <span>Pomáhame investorom robiť múdre rozhodnutia.</span>',
      startP: 'Skôr ako kúpite, predáte alebo si požičiate, otestujte svoje rozhodnutie na 10 signáloch. Najprv sa opýtame, čo AI potrebuje vedieť, potom dostanete verdikt.',
      startHint: 'Asi 2 minúty · bez účtu · nie je to investičné poradenstvo', startNote: 'Pár krátkych otázok + vaše vlastné slová',
      goalEb: 'Vaše rozhodnutie', goalH: 'Čo zvažujete?', goalP: 'Vyberte to, čo je najbližšie.', goalHint: 'Rovnaké kategórie používa Partner Finder.',
      goals: [['buy', 'Kúpiť Bitcoin', 'Prvý nákup alebo väčšia jednorazová suma'], ['dca', 'Pravidelne dokupovať', 'Mesačne alebo týždenne'], ['loan', 'Pôžička krytá Bitcoinom', 'Hotovosť bez predaja'], ['sell', 'Predať časť Bitcoinu', 'Výber zisku, nákup niečoho iného'], ['treasury', 'Bitcoin vo firme', 'Časť hotovosti firmy do BTC'], ['custody', 'Úschova a dedičstvo', 'Kľúče, multisig, kto sa k BTC dostane']],
      textH: 'Opíšte ho vlastnými slovami.', textP: 'Suma, čas, odkiaľ peniaze idú. Jedna až tri vety stačia.', textHint: 'Alebo začnite od príkladu a upravte ho.',
      textPh: 'Napríklad: Chcem kúpiť Bitcoin za 10 000 € z úspor a držať ho 5 rokov.', textWarn: 'Nepíšte mená, kontakty, čísla účtov, adresy peňaženiek ani zdravotné údaje. Text neukladáme v databáze Virtuse; na vyhodnotenie ho spracúva Anthropic (USA).', textShort: 'Aspoň jedna veta',
      sugg: { buy: ['Chcem kúpiť Bitcoin za 10 000 € z úspor a držať ho 5 rokov.', 'Zvažujem dať do Bitcoinu polovicu peňazí z predaja bytu.'], dca: ['Chcem každý mesiac kupovať Bitcoin za 200 € najbližších 10 rokov.', 'Chcem presunúť sporenie z ETF do Bitcoinu, 300 € mesačne.'], loan: ['Chcem si požičať 20 000 € oproti 0,5 BTC na rekonštrukciu.', 'Zvažujem pôžičku krytú Bitcoinom namiesto hypotéky.'], sell: ['Chcem predať 30 % Bitcoinu a kúpiť auto.', 'Rozmýšľam, či predať časť po raste o 80 %.'], treasury: ['Chcem dať 20 % hotovosti firmy do Bitcoinu na 5 rokov.', 'Firma má 200 000 € rezervu, uvažujeme o 10 % v BTC.'], custody: ['Chcem presunúť Bitcoin z burzy na hardvérovú peňaženku.', 'Chcem, aby sa manželka dostala k môjmu Bitcoinu, ak sa mi niečo stane.'] },
      howEb: 'Ako to funguje', howH: '10 signálov. Jeden poctivý obraz.', howP: 'Každé rozhodnutie hodnotíme rovnako, aby ste videli, kde naozaj stojí. Ďalších {n} otázok dá AI údaje, ktoré by inak hádala.', howNote: 'Ukážkové body, nie vaše. Každý signál 0 až 10, skóre je ich súčet zaokrúhlený na 5.',
      howTabs: { 'Riziko': [['Najhorší scenár', 7], ['Likvidita', 5], ['Plán B', 4]], 'Dane a úschova': [['Dane', 6], ['Úschova a dedičstvo', 3], ['Alternatívy', 7]], 'Plán': [['Cieľ', 8], ['Časový horizont', 7], ['Pravidlo, nie emócia', 5]] },
      about: 'O vás', plan: 'Váš plán',
      q: {
        country: ['V ktorej krajine platíte dane?', 'Pravidlá pre Bitcoin sa medzi krajinami výrazne líšia.', 'Pomôže AI posúdiť signál Dane. Rovnakú odpoveď použije Tax Agent a Partner Finder.'],
        experience: ['Vlastníte už Bitcoin?', 'Podľa toho Partner Finder vyberie partnerov pre začiatočníkov alebo pokročilých.', 'Použije Partner Finder. AI to berie ako kontext.'],
        amount: ['O akú sumu ide?', 'Približne stačí.', 'Pomôže AI posúdiť Najhorší scenár (prepad v eurách). Použije Partner Finder a Stacking.'],
        share: ['Koľko z vášho majetku to bude?', 'Odhad stačí. Rátajte úspory a investície, nie bývanie.', 'Ovplyvní signál Asymetria a pomôže posúdiť Najhorší scenár.'],
        horizon: ['Kedy môžete tieto peniaze potrebovať?', 'Bitcoin môže padnúť o 70 % a roky sa nevrátiť.', 'Ovplyvní signál Časový horizont a pomôže posúdiť Likviditu.'],
        reserve: ['Máte bokom rezervu aspoň na 6 mesiacov výdavkov?', 'Mimo Bitcoinu, v hotovosti alebo na účte.', 'Ovplyvní signál Likvidita a pomôže posúdiť Plán B.'],
        keys: ['Kto bude držať kľúče a kto o nich vie?', 'Úschova je časť rozhodnutia, nie detail.', 'Ovplyvní signál Úschova a dedičstvo.'],
        drop: ['Bitcoin padne o 70 %. Čo urobíte?', 'Odpovedzte podľa toho, čo by ste naozaj urobili.', 'Ovplyvní signály Najhorší scenár a Pravidlo, nie emócia.'],
        aim: ['Čo má toto rozhodnutie dosiahnuť?', 'Vyberte, čo je najbližšie. Číslo a termín môžete dopísať do vlastného textu.', 'Ovplyvní signál Cieľ.'],
        taxknow: ['Viete, ako sa vo vašej krajine zdaní predaj?', 'Napríklad sadzba, oslobodenie po čase držby alebo či sa zdaňuje aj výmena kryptomien.', 'Ovplyvní signál Dane.'],
        ruleset: ['Máte napísané pravidlo, kedy dokúpite alebo predáte?', 'Napríklad: dokúpim pri poklese o 30 %, predám desatinu pri dvojnásobku.', 'Ovplyvní signál Pravidlo, nie emócia.'],
        holdtime: ['Ako dlho Bitcoin, ktorý chcete predať, držíte?', 'V niektorých krajinách závisí daň od času držby.', 'Ovplyvní signál Časový horizont a pomôže posúdiť Dane.'],
        basis: ['Viete, za koľko ste ho kúpili?', 'Nákupná cena je základ pre výpočet dane.', 'Pomôže AI posúdiť signál Dane.'],
        ltv: ['Aká veľká bude pôžička oproti hodnote zábezpeky?', 'LTV: pôžička delená hodnotou Bitcoinu v zábezpeke.', 'Pomôže AI posúdiť Najhorší scenár.'],
        liqprice: ['Viete, pri akej cene Bitcoinu by pôžičku zlikvidovali?', 'Pri tejto cene veriteľ predá zábezpeku.', 'Ovplyvní signál Najhorší scenár.'],
        runway: ['Na koľko mesiacov vystačí firme hotovosť bez Bitcoinu?', 'Bežné náklady firmy bez predaja BTC.', 'Ovplyvní signál Likvidita.'],
        board: ['Schválilo to predstavenstvo alebo vlastníci?', 'Pravidlá pre Bitcoin vo firme by mali byť písomne schválené.', 'Ovplyvní signál Pravidlo, nie emócia.'],
        heirs: ['Vedia vaši dedičia, ako sa k Bitcoinu dostať?', 'Bez toho, aby dopredu poznali seed frázu.', 'Ovplyvní signál Úschova a dedičstvo.']
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
        keys: [['exch', 'Burza alebo aplikácia'], ['self', 'Ja, na vlastnej peňaženke'], ['selfplan', 'Ja, a blízky vie, ako sa k nim dostať'], ['multisig', 'Multisig s viacerými kľúčmi']],
        drop: [['buy', 'Dokúpim podľa vopred daného pravidla'], ['hold', 'Podržím, nič nerobím'], ['sell', 'Predám časť alebo všetko']],
        aim: [['retire', 'Peniaze na dôchodok'], ['grow', 'Dlhodobo zhodnotiť úspory'], ['purchase', 'Konkrétny nákup alebo cieľ'], ['family', 'Niečo pre deti alebo dedičov']],
        taxknow: [['yes', 'Áno, poznám pravidlo'], ['roughly', 'Približne'], ['no', 'Nie']],
        ruleset: [['yes', 'Áno, mám ho napísané'], ['roughly', 'Približne, mám ho v hlave'], ['no', 'Nie']],
        holdtime: [['lt1', 'Menej ako rok'], ['1_3', '1 až 3 roky'], ['gt3', 'Viac ako 3 roky']],
        basis: [['yes', 'Áno, mám záznamy'], ['roughly', 'Približne'], ['no', 'Nie']],
        ltv: [['lt30', 'Menej ako 30 %'], ['30_50', '30 až 50 %'], ['gt50', 'Viac ako 50 %']],
        liqprice: [['yes', 'Áno, poznám ju'], ['no', 'Nie']],
        runway: [['lt12', 'Menej ako 12 mesiacov'], ['12_24', '12 až 24 mesiacov'], ['gt24', 'Viac ako 24 mesiacov']],
        board: [['yes', 'Áno'], ['pending', 'Čaká na schválenie'], ['no', 'Nie']],
        heirs: [['yes', 'Áno, majú postup'], ['no', 'Nie']]
      },
      ctxEb: 'Váš kontext', ctxH: 'Vaše rozhodnutie má teraz pevný rámec.', ctxP: 'Väčšina rozhodnutí zlyhá na tom, čo sa nepovedalo nahlas: kedy budete peniaze potrebovať, čo urobíte pri prepade a kto sa k nim dostane. AI vaše odpovede zohľadní. Čo napíšete vlastnými slovami, váži viac.',
      ctxWhat: 'Čo zvažujete', ctxLimits: 'Vaše hranice',
      focusH: 'Čo chcete zistiť najviac?', focusP: 'Na to sa vo verdikte zameriame.', focusHint: 'Vyberte jedno alebo viac.', picked: ' vybrané', pickOne: 'Vyberte aspoň jedno',
      focus: [['risk', 'Kde je najväčšie riziko?'], ['drop', 'Zvládnem to pri prepade?'], ['tax', 'Čo s daňami a úschovou?'], ['next', 'Čo mám urobiť ako ďalšie?']],
      revEb: 'Posledná kontrola', revH: 'Takto vaše rozhodnutie pochopíme.', revP: 'Opravte, čo nesedí. Presne toto pôjde do hodnotenia.', edit: '✎ Upraviť', none: 'Neuvedené', notYet: 'Zatiaľ neviem', otherGoal: 'Niečo iné',
      rev: { goal: 'Čo zvažujete', text: 'Vlastnými slovami', country: 'Krajina', experience: 'Bitcoin už vlastníte', amount: 'Suma', share: 'Podiel na majetku', horizon: 'Kedy peniaze potrebujete', reserve: 'Rezerva na 6 mesiacov', keys: 'Kľúče', drop: 'Pri prepade o 70 %', aim: 'Čo má dosiahnuť', taxknow: 'Zdanenie predaja', ruleset: 'Napísané pravidlo', holdtime: 'Čas držby', basis: 'Nákupná cena', ltv: 'LTV pôžičky', liqprice: 'Cena likvidácie', runway: 'Hotovosť firmy', board: 'Schválenie', heirs: 'Dedičia' },
      revAi: 'Hodnotí umelá inteligencia (jazykový model od Anthropic). Môže sa mýliť. Nie je to investičné, daňové ani právne poradenstvo.', getVerdict: 'Získať verdikt zadarmo',
      loadH: 'Kontrolujeme vaše rozhodnutie', loadSteps: ['Čítame vaše rozhodnutie a odpovede…', 'Hodnotíme 10 signálov…', 'Hľadáme najslabšie miesto…', 'Pripravujeme ďalší krok…'], loadGet: 'Čo dostanete', loadNote: 'Zvyčajne 5 až 15 sekúnd. Nechajte stránku otvorenú.',
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
      prevBadge: 'Náhľad reportu', prevNote: 'Náhľad na testovanie. Na virtuse.com návštevník vidí 2 signály a formulár pre záujem o report.',
      allH: 'Všetkých 10 signálov', missAllH: 'Chýbajúce otázky', planH: 'Plán krokov', planP: 'Signály pod 7 bodov, od najslabšieho. Každý s nástrojom, kde ho doplníte.', planNone: 'Všetky signály majú aspoň 7 bodov.', pdf: 'Uložiť ako PDF', pts: ' b.',
      R: {
        sentence: function (s, w) { return 'Vaša úvaha je najsilnejšia v oblasti ' + s + ' a najslabšia v oblasti ' + w + '.'; },
        sentenceLow: function (w) { return 'Väčšina úvahy zatiaľ nie je opísaná. Najviac chýba oblasť ' + w + '.'; },
        means: function (sc, n) { return 'Čo znamená ' + sc + '/100: dobre ste opísali ' + n + ' z 10 oblastí.'; },
        nextH: 'Váš ďalší krok', again2: 'Ohodnotiť znova', open: 'Otvoriť',
        next: { worst_case: 'Spočítajte, čo by pre váš plán znamenal pokles o 70 %.', liquidity: 'Určte, na koľko mesiacov výdavkov vám vystačí rezerva mimo Bitcoinu.', tax: function (c) { return 'Zistite, ako sa predaj zdaní ' + (c ? 'v krajine ' + c : 'vo vašej krajine') + '.'; }, custody: 'Opíšte, kto drží kľúče a ako sa k Bitcoinu dostanú dedičia.', plan_b: 'Napíšte, čo urobíte, ak hlavný predpoklad neplatí.', goal: 'Doplňte cieľ s číslom a dátumom.', horizon: 'Napíšte, ako dlho budete držať a čo by vás prinútilo predať skôr.', alternatives: 'Porovnajte aspoň dve iné možnosti a napíšte, prečo táto.', rule: 'Napíšte si pravidlo, kedy dokúpite, predáte alebo zmeníte plán.', asymmetry: 'Určte, akú stratu unesiete bez zmeny života, a podľa nej veľkosť.' },
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
        progress: 'Váš postup', of: ' z ', secs: ' s'
      },
      declinedH: 'Verdict to nevie ohodnotiť.', again: '↺ Ohodnotiť ďalšie rozhodnutie', decision: 'Rozhodnutie'
    },
    en: {
      steps: ['Decision', 'About you', 'Your plan', 'Check'], back: '← Back', cont: 'Continue', start: 'Start', skip: '? Not sure yet', other: 'Something else, I will describe it',
      closedH: 'Verdict opens on 1 November.', closedP: 'Join the list and we will tell you.', closedCta: 'To the Virtuse CFO page',
      startEb: 'Verdict · free', startH: 'Check your Bitcoin decision. <span>Empower investors to make smart decisions.</span>',
      startP: 'Before you buy, sell or borrow, test your decision on 10 signals. First we ask what the AI needs to know, then you get your verdict.',
      startHint: 'About 2 minutes · no account · not investment advice', startNote: 'A few short questions + your own words',
      goalEb: 'Your decision', goalH: 'What are you considering?', goalP: 'Pick the closest one.', goalHint: 'Partner Finder uses the same categories.',
      goals: [['buy', 'Buy Bitcoin', 'A first purchase or a larger lump sum'], ['dca', 'Buy regularly', 'Monthly or weekly'], ['loan', 'Bitcoin-backed loan', 'Cash without selling'], ['sell', 'Sell part of my Bitcoin', 'Take profit, buy something else'], ['treasury', 'Bitcoin in my company', 'Part of company cash into BTC'], ['custody', 'Custody and inheritance', 'Keys, multisig, who can reach the BTC']],
      textH: 'Describe it in your own words.', textP: 'Amount, timing, where the money comes from. One to three sentences are enough.', textHint: 'Or start from an example and edit it.',
      textPh: 'For example: I want to buy €10,000 of Bitcoin from savings and hold it for 5 years.', textWarn: "Don't write names, contact details, account numbers, wallet addresses or health details. We don't store the text in the Virtuse database; Anthropic (USA) processes it to assess it.", textShort: 'At least one sentence',
      sugg: { buy: ['I want to buy €10,000 of Bitcoin from savings and hold it for 5 years.', "I'm thinking of putting half the money from selling my flat into Bitcoin."], dca: ['I want to buy €200 of Bitcoin every month for the next 10 years.', 'I want to move my €300 monthly ETF savings into Bitcoin.'], loan: ['I want to borrow €20,000 against 0.5 BTC for a renovation.', "I'm considering a Bitcoin-backed loan instead of a mortgage."], sell: ['I want to sell 30% of my Bitcoin and buy a car.', "I'm wondering whether to sell some after an 80% rise."], treasury: ["I want to put 20% of my company's cash into Bitcoin for 5 years.", 'The company has a €200,000 reserve; we are considering 10% in BTC.'], custody: ['I want to move my Bitcoin from an exchange to a hardware wallet.', 'I want my wife to be able to reach my Bitcoin if something happens to me.'] },
      howEb: 'How it works', howH: '10 signals. One honest picture.', howP: 'Every decision is scored the same way, so you can see where yours really stands. The next {n} questions give the AI what it would otherwise guess.', howNote: 'Example scores, not yours. Each signal 0 to 10, the score is their sum rounded to 5.',
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
        taxknow: ['Do you know how a sale is taxed in your country?', 'For example the rate, an exemption after a holding period, or whether swapping coins is taxed.', 'Affects the Tax signal.'],
        ruleset: ['Do you have a written rule for when to buy more or sell?', 'For example: buy more after a 30% fall, sell a tenth when the price doubles.', 'Affects the Rule, not emotion signal.'],
        holdtime: ['How long have you held the Bitcoin you want to sell?', 'In some countries the tax depends on the holding period.', 'Affects the Time horizon signal and helps judge Tax.'],
        basis: ['Do you know what you paid for it?', 'The purchase price is the basis for the tax.', 'Helps the AI judge the Tax signal.'],
        ltv: ['How big is the loan compared with the collateral?', 'LTV: the loan divided by the value of the Bitcoin held as collateral.', 'Helps the AI judge the Worst case.'],
        liqprice: ['Do you know the Bitcoin price at which the loan would be liquidated?', 'At that price the lender sells the collateral.', 'Affects the Worst case signal.'],
        runway: ['How many months can the company run on cash without the Bitcoin?', 'Normal company costs without selling BTC.', 'Affects the Liquidity signal.'],
        board: ['Has the board or have the owners approved it?', 'Rules for Bitcoin in a company should be approved in writing.', 'Affects the Rule, not emotion signal.'],
        heirs: ['Do your heirs know how to reach the Bitcoin?', 'Without knowing the seed phrase in advance.', 'Affects the Custody and inheritance signal.']
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
        taxknow: [['yes', 'Yes, I know the rule'], ['roughly', 'Roughly'], ['no', 'No']],
        ruleset: [['yes', 'Yes, written down'], ['roughly', 'Roughly, in my head'], ['no', 'No']],
        holdtime: [['lt1', 'Under a year'], ['1_3', '1 to 3 years'], ['gt3', 'Over 3 years']],
        basis: [['yes', 'Yes, I have records'], ['roughly', 'Roughly'], ['no', 'No']],
        ltv: [['lt30', 'Under 30%'], ['30_50', '30 to 50%'], ['gt50', 'Over 50%']],
        liqprice: [['yes', 'Yes, I know it'], ['no', 'No']],
        runway: [['lt12', 'Under 12 months'], ['12_24', '12 to 24 months'], ['gt24', 'Over 24 months']],
        board: [['yes', 'Yes'], ['pending', 'Pending'], ['no', 'No']],
        heirs: [['yes', 'Yes, they have a procedure'], ['no', 'No']]
      },
      ctxEb: 'Your context', ctxH: 'Your decision now has a clear frame.', ctxP: "Most decisions fail on what was never said out loud: when you'll need the money, what you'll do in a fall and who can reach it. The AI takes your answers into account. What you write in your own words counts more.",
      ctxWhat: "What you're considering", ctxLimits: 'Your limits',
      focusH: 'What do you most want to find out?', focusP: "That's where the verdict will focus.", focusHint: 'Pick one or more.', picked: ' selected', pickOne: 'Pick at least one',
      focus: [['risk', "Where's the biggest risk?"], ['drop', 'Can I get through a fall?'], ['tax', 'What about tax and custody?'], ['next', 'What should I do next?']],
      revEb: 'Final check', revH: "Here's how we understood your decision.", revP: "Change anything that doesn't sound right. This is exactly what gets assessed.", edit: '✎ Edit', none: 'Not given', notYet: 'Not sure yet', otherGoal: 'Something else',
      rev: { goal: "What you're considering", text: 'In your own words', country: 'Country', experience: 'Already own Bitcoin', amount: 'Amount', share: 'Share of wealth', horizon: 'When you need the money', reserve: '6-month reserve', keys: 'Keys', drop: 'In a 70% fall', aim: 'What it should achieve', taxknow: 'Tax on a sale', ruleset: 'Written rule', holdtime: 'Holding period', basis: 'Purchase price', ltv: 'Loan LTV', liqprice: 'Liquidation price', runway: 'Company cash runway', board: 'Approval', heirs: 'Heirs' },
      revAi: 'This assessment is generated by artificial intelligence (a language model by Anthropic). It may be wrong. It is not investment, tax or legal advice.', getVerdict: 'Get my free verdict',
      loadH: 'Checking your decision', loadSteps: ['Reading your decision and answers…', 'Scoring 10 signals…', 'Finding the weakest point…', 'Preparing your next step…'], loadGet: 'What you get', loadNote: 'Usually 5 to 15 seconds. Keep this page open.',
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
      prevBadge: 'Report preview', prevNote: 'Preview for testing. On virtuse.com visitors see 2 signals and a form to register interest in the report.',
      allH: 'All 10 signals', missAllH: 'Missing questions', planH: 'Step-by-step plan', planP: 'Signals under 7 points, weakest first. Each with the tool where you fill it in.', planNone: 'Every signal has at least 7 points.', pdf: 'Save as PDF', pts: ' pts',
      R: {
        sentence: function (s, w) { return 'Your thinking is strongest on ' + s + ' and weakest on ' + w + '.'; },
        sentenceLow: function (w) { return 'Most of your thinking is not described yet. ' + w + ' is missing most.'; },
        means: function (sc, n) { return 'What ' + sc + '/100 means: you described ' + n + ' of 10 areas well.'; },
        nextH: 'Your next step', again2: 'Rate again', open: 'Open',
        next: { worst_case: 'Work out what a 70% fall would mean for your plan.', liquidity: 'Work out how many months of expenses your reserve outside Bitcoin covers.', tax: function (c) { return 'Find out how a sale is taxed in ' + (c || 'your country') + '.'; }, custody: 'Describe who holds the keys and how heirs would reach the Bitcoin.', plan_b: 'Write down what you will do if your main assumption fails.', goal: 'Add a goal with a number and a date.', horizon: 'Write down how long you will hold and what would force an earlier sale.', alternatives: 'Compare at least two other options and write down why this one.', rule: 'Write a rule for when you buy more, sell or change the plan.', asymmetry: 'Work out what loss you can carry without changing your life, and size from that.' },
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
        progress: 'Your progress', of: ' of ', secs: ' s'
      },
      declinedH: "Verdict can't rate this.", again: '↺ Rate another decision', decision: 'Decision'
    }
  }[LANG];

  var A = { goal: null, text: '', focus: [] };
  var SV = '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CK = '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var BUYSET = { about: ['country', 'experience', 'amount', 'share', 'horizon', 'reserve'], plan: ['keys', 'drop', 'aim', 'taxknow', 'ruleset'] };
  var GOALSETS = {
    buy: BUYSET, dca: BUYSET,
    sell: { about: ['country', 'amount', 'share', 'holdtime', 'basis'], plan: ['taxknow', 'aim', 'keys', 'ruleset'] },
    loan: { about: ['country', 'amount', 'ltv', 'liqprice', 'horizon', 'reserve'], plan: ['keys', 'drop', 'taxknow', 'ruleset'] },
    treasury: { about: ['country', 'amount', 'runway', 'board', 'horizon'], plan: ['keys', 'drop', 'taxknow', 'ruleset'] },
    custody: { about: ['country', 'amount', 'keys', 'heirs'], plan: ['taxknow', 'aim'] }
  };
  function SET() { return GOALSETS[A.goal] || BUYSET; }
  function KEYS() { return SET().about.concat(SET().plan); }
  var RET = null; // edit from the final check: Continue returns there
  var panel = document.getElementById('panel'), back = document.getElementById('back'), stepsEl = document.getElementById('steps');
  var RESULT = null, i = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function quote(t) { return (LANG === 'sk' ? '„' : '“') + esc(t) + (LANG === 'sk' ? '“' : '”'); }
  function push(o) { (window.dataLayer = window.dataLayer || []).push(o); }
  function foot(extra, btn, disabled, solid) { return '<div class="foot"><span class="note" id="fn">' + (extra || '') + '</span><button class="cta' + (solid ? ' solid' : '') + '" id="c"' + (disabled ? ' disabled' : '') + '>' + (btn || STR.cont) + ' ' + SV + '</button></div>'; }
  function label(key, v) { var o = (STR.opts[key] || []).filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : null; }
  function ans(key) { var v = A[key]; if (!v) return STR.none; if (v === 'na') return STR.notYet; return label(key, v) || v; }
  function goalLabel() { var g = STR.goals.filter(function (x) { return x[0] === A.goal; })[0]; return g ? g[1] : STR.otherGoal; }

  if (!ON) {
    stepsEl.hidden = true;
    panel.innerHTML = '<div class="closed"><h2>' + STR.closedH + '</h2><p class="sub">' + STR.closedP + '</p><a class="cta" href="cfo.html#pricing">' + STR.closedCta + ' ' + SV + '</a></div>';
    return;
  }

  var SCREENS;
  function build() {
    var S = SET(), np = S.plan.length + 1;
    SCREENS = [{ s: 0, p: .2, r: start }, { s: 0, p: .45, r: goal, k: 'goal' }, { s: 0, p: .75, r: text, k: 'text' }, { s: 0, p: 1, r: how }];
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
    i = n; back.hidden = i === 0 || i === at('loading'); stepper(); SCREENS[i].r(); spot();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    push({ event: 'verdict_step', verdict_lang: LANG, verdict_step: SCREENS[i].k || SCREENS[i].r.name });
  }
  function next() { if (RET) { var r = RET; RET = null; go(at(r)); } else go(i + 1); }
  function skipBtn(lbl, key) {
    return '<div class="alt"><button class="ghost" data-skip="' + key + '">' + (lbl || STR.skip) + '</button></div>';
  }
  function bindSkip() { var b = panel.querySelector('[data-skip]'); if (b) b.onclick = function () { if (b.dataset.skip === 'goal') return setGoal('na'); A[b.dataset.skip] = 'na'; next(); }; }
  // A new goal brings its own questions, so an edit then walks through them.
  function setGoal(v) { if (v !== A.goal) RET = null; A.goal = v; build(); next(); }

  function start() {
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.startEb + '</div><h1>' + STR.startH + '</h1><p class="sub">' + STR.startP + '</p><p class="hint">' + STR.startHint + '</p>' + foot(STR.startNote, STR.start);
    document.getElementById('c').onclick = next;
  }
  function goal() {
    panel.innerHTML = '<div class="eyebrow">' + STR.goalEb + '</div><h2>' + STR.goalH + '</h2><p class="sub">' + STR.goalP + '</p><p class="hint">' + STR.goalHint + '</p>' +
      '<div class="opts">' + STR.goals.map(function (g) { return '<button class="opt' + (A.goal === g[0] ? ' sel' : '') + '" data-v="' + g[0] + '"><span>' + g[1] + '<small>' + g[2] + '</small></span>' + (A.goal === g[0] ? CK : SV) + '</button>'; }).join('') + '</div>' + skipBtn(STR.other, 'goal');
    panel.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { setGoal(b.dataset.v); }; });
    bindSkip();
  }
  function text() {
    var s = STR.sugg[A.goal] || STR.sugg.buy;
    panel.innerHTML = '<div class="eyebrow">' + STR.goalEb + '</div><h2>' + STR.textH + '</h2><p class="sub">' + STR.textP + '</p><p class="hint">' + STR.textHint + '</p>' +
      '<div class="sugg">' + s.map(function (t) { return '<button>' + esc(t) + '</button>'; }).join('') + '</div>' +
      '<textarea id="tx" maxlength="1200" aria-label="' + esc(STR.rev.text) + '" placeholder="' + esc(STR.textPh) + '">' + esc(A.text) + '</textarea>' +
      '<div class="count"><span id="cn">0</span> / 1200</div><input class="hp" id="hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
      '<p class="warn">' + STR.textWarn + '</p>' + foot();
    var tx = document.getElementById('tx'), c = document.getElementById('c');
    function upd() { A.text = tx.value; document.getElementById('cn').textContent = tx.value.length; var ok = tx.value.trim().length >= 20; c.disabled = !ok; document.getElementById('fn').textContent = ok ? '' : STR.textShort; }
    panel.querySelectorAll('.sugg button').forEach(function (b) { b.onclick = function () { tx.value = b.textContent; upd(); tx.focus(); }; });
    tx.oninput = upd; upd(); c.onclick = function () { A.hp = document.getElementById('hp').value; next(); };
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
      panel.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { A[key] = b.dataset.v; b.classList.add('sel'); setTimeout(next, 160); }; });
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
      '<div style="margin-top:20px">' + foot() + '</div>';
    document.getElementById('c').onclick = next;
  }
  function focus() {
    function draw() {
      panel.innerHTML = '<div class="eyebrow">' + STR.plan + '</div><h2>' + STR.focusH + '</h2><p class="sub">' + STR.focusP + '</p><p class="hint">' + STR.focusHint + '</p>' +
        '<div class="opts">' + STR.focus.map(function (f) { var s = A.focus.indexOf(f[0]) >= 0; return '<button class="opt' + (s ? ' sel' : '') + '" aria-pressed="' + s + '" data-v="' + f[0] + '"><span>' + f[1] + '</span>' + (s ? CK : SV) + '</button>'; }).join('') + '</div>' +
        foot(A.focus.length ? A.focus.length + STR.picked : STR.pickOne, null, !A.focus.length);
      panel.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { var v = b.dataset.v, p = A.focus.indexOf(v); if (p >= 0) A.focus.splice(p, 1); else A.focus.push(v); draw(); }; });
      document.getElementById('c').onclick = next;
    }
    draw();
  }
  function review() {
    var rows = [['goal', goalLabel(), 'goal'], ['text', A.text || STR.none, 'text']].concat(KEYS().map(function (k) { return [k, ans(k), k]; }));
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.revEb + '</div><h2>' + STR.revH + '</h2><p class="sub">' + STR.revP + '</p><div style="margin-top:18px">' +
      rows.map(function (r) { return '<div class="vfr"><div><b>' + STR.rev[r[0]] + '</b>' + esc(r[1]) + '</div><button class="ghost edit" data-to="' + r[2] + '">' + STR.edit + '</button></div>'; }).join('') +
      '</div><label class="vf-name"><b>' + STR.R.nameL + '</b><input id="dn" maxlength="60" autocomplete="off" placeholder="' + esc(STR.R.namePh) + '" value="' + esc(A.name || '') + '"><span class="small">' + STR.R.nameNote + '</span></label>' +
      '<p class="warn" style="margin-top:12px">' + STR.revAi + '</p>' + foot('', STR.getVerdict, A.text.trim().length < 20, true);
    document.getElementById('dn').oninput = function () { A.name = this.value.trim(); };
    panel.querySelectorAll('[data-to]').forEach(function (b) { b.onclick = function () { RET = 'review'; go(at(b.dataset.to)); }; });
    document.getElementById('c').onclick = next;
  }
  function profile() {
    var p = {};
    ['goal'].concat(KEYS()).forEach(function (k) { if (A[k] && A[k] !== 'na') p[k] = A[k]; });
    if (A.focus.length) p.focus = A.focus.slice();
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
      document.getElementById('ls').textContent = STR.loadSteps[Math.min(k, STR.loadSteps.length - 1)];
      document.getElementById('lt').textContent = (k % U.length + 1) + STR.R.of + U.length + ' · ' + Math.round((Date.now() - t0) / 1000) + STR.R.secs;
    }
    show();
    var tick = setInterval(function () { var e = document.getElementById('lt'); if (e) e.textContent = (k % U.length + 1) + STR.R.of + U.length + ' · ' + Math.round((Date.now() - t0) / 1000) + STR.R.secs; else clearInterval(tick); }, 1000);
    var t = setInterval(function () { k++; show(); }, 1600), minWait = new Promise(function (r) { setTimeout(r, 2500); });
    push({ event: 'verdict_submit', verdict_lang: LANG, verdict_goal: A.goal || 'other' });
    // An unchanged payload (Back -> "Get my verdict" again) reuses the last
    // answer instead of paying for and counting a new call.
    var payload = JSON.stringify({ text: A.text, lang: LANG, hp: A.hp || '', profile: profile(), report: PREVIEW }), cached = null;
    try { var c = JSON.parse(sessionStorage.getItem('vb-verdict-last') || 'null'); if (c && c.k === payload) cached = c.d; } catch (e) {}
    var call = cached ? Promise.resolve({ ok: true, d: cached }) : fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
      .catch(function () { return { ok: false, d: { error: STR.network } }; });
    if (cached) minWait = Promise.resolve();
    Promise.all([call, minWait]).then(function (x) {
      clearInterval(t); clearInterval(tick);
      var res = x[0];
      if (res.ok && res.d && res.d.ok) {
        RESULT = res.d;
        if (!cached) try { sessionStorage.setItem('vb-verdict-last', JSON.stringify({ k: payload, d: res.d })); } catch (e) {}
        push(RESULT.declined ? { event: 'verdict_declined', verdict_lang: LANG } : { event: 'verdict_result', verdict_lang: LANG, verdict_band: RESULT.band.id, verdict_weakest: RESULT.weakest.id });
        next(); return;
      }
      panel.innerHTML = '<h2>' + STR.failH + '</h2><p class="sub">' + esc((res.d && res.d.error) || STR.error) + '</p><div class="foot"><span></span><button class="ghost" id="rt">' + STR.retry + '</button></div>';
      document.getElementById('rt').onclick = function () { go(at('loading')); };
    });
  }
  // Result (verdict-review D, 2026-10-23): verdict sentence + score ring in
  // the band colour, one next step, two free signals with "how to improve",
  // 8 locked, price card + waitlist + FAQ, Partner Finder last (MiCA, C17).
  var GROUP = { worst_case: 'risk', liquidity: 'risk', plan_b: 'risk', tax: 'taxc', custody: 'taxc', goal: 'plan', horizon: 'plan', alternatives: 'plan', rule: 'plan', asymmetry: 'plan' };
  var GCOL = { risk: 'blue', taxc: 'teal', plan: 'purple' };
  var BANDCOL = { complete: 'var(--green)', add: 'var(--yellow)', missing: 'var(--orange)' };
  var R = STR.R;
  function nm(s) { return LANG === 'sk' ? '„' + s + '“' : s; }
  function bigRing(score, col) {
    var r = 44, c = 2 * Math.PI * r;
    return '<svg class="vf-ring" width="112" height="112" viewBox="0 0 112 112" aria-hidden="true"><circle cx="56" cy="56" r="' + r + '" stroke="rgba(255,255,255,.08)" stroke-width="8" fill="none"/>' +
      '<circle cx="56" cy="56" r="' + r + '" stroke="' + col + '" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="' + (c * score / 100) + ' ' + c + '" transform="rotate(-90 56 56)"/></svg>';
  }
  // Handoff to the tool with what the funnel already knows (F37).
  function toolHref(t, medium) {
    var q = ['utm_source=verdict', 'utm_medium=' + (medium || 'result')];
    if (t.key === 'tax' && A.country && A.country !== 'other' && A.country !== 'na') q.unshift('country=' + A.country);
    if ((t.key === 'stacking' || t.key === 'loan') && /^(s|m|l|xl)$/.test(A.amount || '')) q.unshift('amount=' + A.amount);
    return t.page + (t.page.indexOf('?') < 0 ? '?' : '&') + q.join('&');
  }
  function nextText(id) { var n = R.next[id]; return typeof n === 'function' ? n(A.country && A.country !== 'other' && A.country !== 'na' ? label('country', A.country) : '') : n; }
  function sig(s, tag, href) {
    var g = GROUP[s.id];
    return '<div class="vf-card ' + GCOL[g] + ' spot"><div class="h"><div><b>' + esc(s.name) + '</b><div class="tag">' + (tag ? tag + ' · ' : '') + R.group[g] + '</div></div><em>' + s.points + '<small>/10</small></em></div>' +
      '<div class="bar"><i style="width:' + s.points * 10 + '%"></i></div><p>' + esc(s.reason) + '</p>' +
      '<details class="imp"><summary>' + R.improve + '</summary><p>' + R.tip[s.id] + '</p></details>' +
      (href ? '<a class="vf-btn" href="' + href + '">' + STR.fill + esc(s.tool.name) + ' →</a>' : '') + '</div>';
  }
  function headBlock(r, strongName, weakName, strongPts) {
    var col = BANDCOL[r.band.id] || 'var(--orange)';
    return '<div class="res-head"><div><div class="eyebrow ' + (r.band.id === 'complete' ? 'green' : r.band.id === 'add' ? 'yellow' : '') + '"><i></i>' + (r.report ? R.pdfTitle + ' · ' + STR.prevBadge : STR.resEb) + ' · ' + esc(A.name || goalLabel()) + '</div>' +
      '<h2>' + esc(strongPts < 5 ? R.sentenceLow(nm(weakName)) : R.sentence(nm(strongName), nm(weakName))) + '</h2>' +
      '<p class="means">' + esc(R.means(r.score, r.covered == null ? '?' : r.covered)) + '</p><p class="quote">' + quote(A.text.slice(0, 160) + (A.text.length > 160 ? '…' : '')) + '</p></div>' +
      '<div class="score" style="--b:' + col + '">' + bigRing(r.score, col) + '<b>' + r.score + '<small>/100</small></b><span class="pill">' + esc(r.band.label) + '</span></div></div>';
  }
  function nextBlock(weak, medium) {
    return '<div class="sec">' + R.nextH + '</div><div class="vf-card next ' + GCOL[GROUP[weak.id]] + ' spot"><p class="act">' + esc(nextText(weak.id)) + '</p>' +
      '<div class="row"><a class="vf-btn solid" href="' + toolHref(weak.tool, medium) + '">' + esc(weak.tool.name) + ' →</a><button class="vf-btn" data-again>↺ ' + R.again2 + '</button></div></div>';
  }
  function pfBlock(r, medium) {
    if (!r.partnerFinder) return '';
    var pfq = Object.keys(r.partnerFinder).map(function (k) { return k + '=' + encodeURIComponent(r.partnerFinder[k]); }).join('&') + '&utm_source=verdict';
    var collapsed = r.band.id === 'missing';
    return '<div class="no-print"><div class="sec">' + R.pfH + '</div><p class="sub sm">' + R.pfP + '</p>' +
      (collapsed ? '<button class="vf-btn" id="pfShow">' + R.pfShow + '</button>' : '') +
      '<div id="pfBox"' + (collapsed ? ' hidden' : '') + '><iframe class="pf" id="pfFrame" ' + (collapsed ? 'data-src' : 'src') + '="concierge.html?' + pfq + '&utm_medium=' + medium + '" title="Partner Finder" loading="lazy"></iframe>' +
      '<p class="small">' + STR.pfNote + ' <a href="concierge.html?' + pfq + '&utm_medium=' + medium + '_open">' + STR.pfOpen + '</a></p></div></div>';
  }
  function legal(r) { return '<p class="small" style="margin-top:22px">' + esc(r.scoreNote) + '</p><p class="small">' + esc(r.aiLabel) + ' ' + esc(r.disclaimer) + '</p>'; }
  function bindCommon() {
    panel.querySelectorAll('[data-again]').forEach(function (b) { b.onclick = function () { A.text = ''; RESULT = null; go(1); }; });
    var sh = document.getElementById('pfShow');
    if (sh) sh.onclick = function () { var f = document.getElementById('pfFrame'); f.src = f.getAttribute('data-src'); document.getElementById('pfBox').hidden = false; sh.hidden = true; push({ event: 'verdict_pf_show', verdict_lang: LANG }); };
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
    if (r.report) { showReport(r); return; }
    var strong = r.signals.filter(function (x) { return x.role === 'strongest'; })[0], weak = r.signals.filter(function (x) { return x.role === 'weakest'; })[0];
    if (!strong || !weak) { panel.innerHTML = '<h2>' + STR.failH + '</h2><p class="sub">' + STR.error + '</p>' + again; document.getElementById('again').onclick = function () { go(at('review')); }; return; }
    weak.tool = weak.tool || r.weakest.tool;
    panel.innerHTML = '<div data-ai-generated="true">' + headBlock(r, strong.name, weak.name, strong.points) + nextBlock(weak, 'result') +
      '<div class="sec">' + STR.free + '</div><div class="sig2">' + sig(strong, STR.strongest) + sig(weak, STR.weakest, toolHref(weak.tool)) + '</div>' +
      '<div class="vf-card q spot"><b>' + R.openQ + '</b><p>' + esc(r.missing[0] || STR.nothing) + (r.missingMore ? ' <span class="dim">+' + r.missingMore + STR.inReport + '</span>' : '') + '</p></div>' +
      '<div class="sec" id="report">' + R.lockedH(r.locked.length) + '</div><div class="lgrid">' + r.locked.map(function (x) { var g = GROUP[x.id]; return '<div class="' + GCOL[g] + '"><span>🔒 ' + esc(x.name) + '</span><small>' + R.group[g] + '</small><i></i><i></i></div>'; }).join('') + '</div>' +
      '<div class="price vf-card spot"><div><div class="eyebrow"><i></i>' + R.inside + '</div><h3>' + STR.repT + '</h3><p class="sub sm">' + STR.repP + '</p><ul>' + STR.repList.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' +
      '<div><div class="eyebrow"><i></i>' + STR.once + '</div><div class="amt">' + (LANG === 'sk' ? '14 €' : '€14') + '</div><p class="sub sm">' + STR.noSub + '</p><p class="small" style="margin-top:6px">' + STR.waitNote + '</p>' + wantForm() + '</div></div>' +
      '<div class="sec">' + R.faqH + '</div><div class="faq">' + R.faq.map(function (f) { return '<details><summary>' + f[0] + '</summary><p>' + f[1] + '</p></details>'; }).join('') + '</div>' +
      pfBlock(r, 'verdict') + legal(r) + '</div>' +
      '<div class="vf-sticky"><button class="vf-btn" data-again>↺ ' + R.again2 + '</button><button class="vf-btn solid" data-want>' + R.sticky + '</button></div>';
    bindCommon(); bindWant();
  }

  // Interest in the full report: email only, no decision text.
  function wantForm() {
    return '<form class="want" id="want" novalidate><input type="email" id="we" autocomplete="email" placeholder="' + STR.wantPh + '" aria-label="' + STR.wantPh + '" required>' +
      '<input type="text" id="wh" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">' +
      '<button class="vf-btn solid" type="submit">' + STR.wantBtn + '</button><p class="small" id="wm" aria-live="polite">' + STR.wantNote + ' <a href="privacy-policy.html#verdict-cfo">' + STR.privacy + '</a></p></form>';
  }
  function bindWant() {
    var f = document.getElementById('want'); if (!f) return;
    panel.querySelectorAll('[data-want]').forEach(function (b) {
      b.onclick = function () { document.getElementById('report').scrollIntoView({ behavior: 'smooth' }); setTimeout(function () { var e = document.getElementById('we'); if (e) e.focus({ preventScroll: true }); }, 500); };
    });
    f.onsubmit = function (e) {
      e.preventDefault();
      var em = document.getElementById('we').value.trim(), msg = document.getElementById('wm'), btn = f.querySelector('button');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { msg.textContent = STR.wantBad; return; }
      btn.disabled = true;
      fetch(WAITLIST, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, hp: document.getElementById('wh').value, source: 'verdict_report', lang: LANG }) })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
        .catch(function () { return { ok: false, d: { error: STR.network } }; })
        .then(function (x) {
          if (x.ok) {
            f.innerHTML = '<p class="sub sm" style="color:var(--text)">' + STR.wantOk + '</p>';
            push({ event: 'capture_submit', capture_source: 'verdict_report', verdict_lang: LANG });
          } else { btn.disabled = false; msg.textContent = (x.d && x.d.error) || STR.error; }
        });
    };
  }

  // Full report (preview only until payments exist; see the header comment).
  function showReport(r) {
    var weak = r.signals.filter(function (s) { return s.id === r.weakest.id; })[0] || r.signals[0];
    var strong = r.signals.filter(function (s) { return s.id !== weak.id; }).sort(function (a, b) { return b.points - a.points; })[0];
    weak.tool = weak.tool || r.weakest.tool;
    var groups = ['risk', 'taxc', 'plan'];
    panel.innerHTML = '<div data-ai-generated="true" class="report">' +
      '<p class="warn no-print">' + STR.prevNote + '</p>' + headBlock(r, strong.name, weak.name, strong.points) + nextBlock(weak, 'report') +
      '<div class="sec">' + R.planH + '</div><p class="sub sm">' + STR.planP + '</p><div class="route">' +
      (r.plan.length ? r.plan.map(function (s, n) { return '<div class="r vf-card ' + GCOL[GROUP[s.id]] + ' spot"><div><b>' + (n + 1) + '. ' + esc(s.name) + ' · ' + s.points + STR.pts + '</b><span>' + esc(nextText(s.id)) + '</span></div><a class="vf-btn" href="' + toolHref(s.tool, 'report') + '">' + esc(s.tool.name) + ' →</a></div>'; }).join('') : '<div class="r vf-card"><span>' + STR.planNone + '</span></div>') + '</div>' +
      groups.map(function (g) {
        var ss = r.signals.filter(function (s) { return GROUP[s.id] === g; });
        return '<div class="sec">' + R.group[g] + '</div><div class="sig2">' + ss.map(function (s) { return sig(s, s.id === weak.id ? STR.weakest : '', s.points < 7 ? toolHref(s.tool, 'report') : ''); }).join('') + '</div>';
      }).join('') +
      '<div class="sec">' + STR.missAllH + '</div><div class="faq">' + (r.missing.length ? r.missing.map(function (m, n) { return '<div class="vf-card q"><b>' + (n + 1) + '</b><p>' + esc(m) + '</p></div>'; }).join('') : '<p class="sub sm">' + STR.nothing + '</p>') + '</div>' +
      pfBlock(r, 'verdict_report') + legal(r) + '</div>' +
      '<div class="foot no-print" style="margin-top:18px"><button class="vf-btn" data-again>↺ ' + R.again2 + '</button><button class="vf-btn solid" id="pdf">' + STR.pdf + '</button></div>';
    bindCommon();
    document.getElementById('pdf').onclick = function () {
      push({ event: 'verdict_report_pdf', verdict_lang: LANG });
      var t = document.title; document.title = R.pdfTitle + (A.name ? ' · ' + A.name : '');
      window.print(); setTimeout(function () { document.title = t; }, 500);
    };
  }

  // Cursor spotlight (same effect as site-v2.js, for cards rendered later).
  function spot() {
    panel.querySelectorAll('.spot, .opt').forEach(function (c) {
      if (c.dataset.spot) return; c.dataset.spot = '1';
      c.addEventListener('pointermove', function (e) { c.classList.add('pm'); var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
      c.addEventListener('pointerleave', function () { c.classList.remove('pm'); });
    });
  }

  // Handed over from cfo.html: skip the start screen, text already filled in.
  var handed = '';
  try { handed = sessionStorage.getItem('vb-verdict-text') || ''; sessionStorage.removeItem('vb-verdict-text'); } catch (e) {}
  if (handed) { A.text = handed.slice(0, 1200); go(1); } else go(0);
})();
