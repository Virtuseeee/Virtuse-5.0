// Verdict question funnel (verdict.html, sk/verdict.html). Asks the questions the
// AI would otherwise guess, then calls the Worker (POST /verdict with a profile of
// fixed ids, see cloudflare-worker/src/verdict.js PROFILE) and shows the free view:
// score, strongest and weakest signal, 8 locked, Partner Finder prefilled.
// Off until launch: on for staging, ?verdict=1 or <meta name="vb-verdict" content="on">.
// cfo.html hands over the decision text in sessionStorage 'vb-verdict-text'.
(function () {
  var LANG = document.documentElement.lang === 'sk' ? 'sk' : 'en';
  var WORKER = 'https://virtuse-newsletter.virtuse-ai.workers.dev/verdict';
  var meta = document.querySelector('meta[name="vb-verdict"]');
  var ON = location.hostname === 'staging.virtuse.com' || location.hostname === 'localhost' || /[?&]verdict=1\b/.test(location.search) || (meta && meta.content === 'on');

  var STR = {
    sk: {
      steps: ['Rozhodnutie', 'O vás', 'Váš plán', 'Kontrola'], back: '← Späť', cont: 'Pokračovať', start: 'Začať', skip: '? Zatiaľ neviem', other: 'Niečo iné, opíšem to',
      closedH: 'Verdict sa otvára 1. novembra.', closedP: 'Zapíšte sa a dáme vám vedieť.', closedCta: 'Na stránku Virtuse CFO',
      startEb: 'Verdict · zadarmo', startH: 'Pomáhame investorom robiť <span>múdre rozhodnutia.</span>',
      startP: 'Skôr ako kúpite, predáte alebo si požičiate, otestujte svoje rozhodnutie na 10 signáloch. Najprv sa opýtame, čo AI potrebuje vedieť, potom dostanete verdikt.',
      startHint: 'Asi 2 minúty · bez účtu · nie je to investičné poradenstvo', startNote: '10 krátkych otázok + vaše vlastné slová',
      goalEb: 'Vaše rozhodnutie', goalH: 'Čo zvažujete?', goalP: 'Vyberte to, čo je najbližšie.', goalHint: 'Rovnaké kategórie používa Partner Finder.',
      goals: [['buy', 'Kúpiť Bitcoin', 'Prvý nákup alebo väčšia jednorazová suma'], ['dca', 'Pravidelne dokupovať', 'Mesačne alebo týždenne'], ['loan', 'Pôžička krytá Bitcoinom', 'Hotovosť bez predaja'], ['sell', 'Predať časť Bitcoinu', 'Výber zisku, nákup niečoho iného'], ['treasury', 'Bitcoin vo firme', 'Časť hotovosti firmy do BTC'], ['custody', 'Úschova a dedičstvo', 'Kľúče, multisig, kto sa k BTC dostane']],
      textH: 'Opíšte ho vlastnými slovami.', textP: 'Suma, čas, odkiaľ peniaze idú. Jedna až tri vety stačia.', textHint: 'Alebo začnite od príkladu a upravte ho.',
      textPh: 'Napríklad: Chcem kúpiť Bitcoin za 10 000 € z úspor a držať ho 5 rokov.', textWarn: 'Nepíšte mená, kontakty, čísla účtov, adresy peňaženiek ani zdravotné údaje. Text neukladáme v databáze Virtuse; na vyhodnotenie ho spracúva Anthropic (USA).', textShort: 'Aspoň jedna veta',
      sugg: { buy: ['Chcem kúpiť Bitcoin za 10 000 € z úspor a držať ho 5 rokov.', 'Zvažujem dať do Bitcoinu polovicu peňazí z predaja bytu.'], dca: ['Chcem každý mesiac kupovať Bitcoin za 200 € najbližších 10 rokov.', 'Chcem presunúť sporenie z ETF do Bitcoinu, 300 € mesačne.'], loan: ['Chcem si požičať 20 000 € oproti 0,5 BTC na rekonštrukciu.', 'Zvažujem pôžičku krytú Bitcoinom namiesto hypotéky.'], sell: ['Chcem predať 30 % Bitcoinu a kúpiť auto.', 'Rozmýšľam, či predať časť po raste o 80 %.'], treasury: ['Chcem dať 20 % hotovosti firmy do Bitcoinu na 5 rokov.', 'Firma má 200 000 € rezervu, uvažujeme o 10 % v BTC.'], custody: ['Chcem presunúť Bitcoin z burzy na hardvérovú peňaženku.', 'Chcem, aby sa manželka dostala k môjmu Bitcoinu, ak sa mi niečo stane.'] },
      howEb: 'Ako to funguje', howH: '10 signálov. Jeden poctivý obraz.', howP: 'Každé rozhodnutie hodnotíme rovnako, aby ste videli, kde naozaj stojí. Ďalších 8 otázok dá AI údaje, ktoré by inak hádala.', howNote: 'Ukážkové body, nie vaše. Každý signál 0 až 10, skóre je ich súčet.',
      howTabs: { 'Riziko': [['Najhorší scenár', 7], ['Likvidita', 5], ['Plán B', 4]], 'Dane a úschova': [['Dane', 6], ['Úschova a dedičstvo', 3], ['Alternatívy', 7]], 'Plán': [['Cieľ', 8], ['Časový horizont', 7], ['Pravidlo, nie emócia', 5]] },
      about: 'O vás', plan: 'Váš plán',
      q: {
        country: ['V ktorej krajine platíte dane?', 'Pravidlá pre Bitcoin sa medzi krajinami výrazne líšia.', 'Napĺňa signál Dane. Rovnakú odpoveď použije Tax Agent a Partner Finder.'],
        experience: ['Vlastníte už Bitcoin?', 'Podľa toho Partner Finder vyberie partnerov pre začiatočníkov alebo pokročilých.', 'Použije Partner Finder. AI to berie ako kontext.'],
        amount: ['O akú sumu ide?', 'Približne stačí.', 'Napĺňa signál Najhorší scenár (prepad v eurách). Použije Partner Finder a Stacking.'],
        share: ['Koľko z vášho majetku to bude?', 'Odhad stačí. Rátajte úspory a investície, nie bývanie.', 'Napĺňa signály Najhorší scenár a Asymetria.'],
        horizon: ['Kedy môžete tieto peniaze potrebovať?', 'Bitcoin môže padnúť o 70 % a roky sa nevrátiť.', 'Napĺňa signály Časový horizont a Likvidita.'],
        reserve: ['Máte bokom rezervu aspoň na 6 mesiacov výdavkov?', 'Mimo Bitcoinu, v hotovosti alebo na účte.', 'Napĺňa signály Likvidita a Plán B.'],
        keys: ['Kto bude držať kľúče a kto o nich vie?', 'Úschova je časť rozhodnutia, nie detail.', 'Napĺňa signál Úschova a dedičstvo.'],
        drop: ['Bitcoin padne o 50 %. Čo urobíte?', 'Odpovedzte podľa toho, čo by ste naozaj urobili.', 'Napĺňa signály Pravidlo, nie emócia a Najhorší scenár.']
      },
      opts: {
        country: [['sk', 'Slovensko'], ['cz', 'Česko'], ['at', 'Rakúsko'], ['de', 'Nemecko'], ['pl', 'Poľsko'], ['hu', 'Maďarsko'], ['si', 'Slovinsko'], ['hr', 'Chorvátsko'], ['ro', 'Rumunsko'], ['bg', 'Bulharsko'], ['nl', 'Holandsko'], ['fr', 'Francúzsko'], ['es', 'Španielsko'], ['other', 'Iná krajina']],
        experience: [['new', 'Ešte nie, bude to prvý nákup'], ['hodler', 'Áno, už nejaký mám']],
        amount: [['s', 'Menej ako 1 000 €'], ['m', '1 000 až 10 000 €'], ['l', '10 000 až 100 000 €'], ['xl', 'Viac ako 100 000 €']],
        share: [['lt5', 'Menej ako 5 %'], ['5_20', '5 až 20 %'], ['20_50', '20 až 50 %'], ['gt50', 'Viac ako polovica']],
        horizon: [['lt1', 'Do 1 roka'], ['1_4', 'O 1 až 4 roky'], ['gt4', 'O viac ako 4 roky'], ['never', 'Neplánujem ich minúť']],
        reserve: [['yes', 'Áno'], ['part', 'Čiastočne'], ['no', 'Nie']],
        keys: [['exch', 'Burza alebo aplikácia'], ['self', 'Ja, na vlastnej peňaženke'], ['selfplan', 'Ja, a blízky vie, ako sa k nim dostať']],
        drop: [['buy', 'Dokúpim podľa vopred daného pravidla'], ['hold', 'Podržím, nič nerobím'], ['sell', 'Predám časť alebo všetko']]
      },
      ctxEb: 'Váš kontext', ctxH: 'Vaše rozhodnutie má teraz pevný rámec.', ctxP: 'Väčšina rozhodnutí zlyhá na tom, čo sa nepovedalo nahlas: kedy budete peniaze potrebovať, čo urobíte pri prepade a kto sa k nim dostane. Teraz to AI vie a nemusí hádať.',
      ctxWhat: 'Čo zvažujete', ctxLimits: 'Vaše hranice', ofWealth: 'majetku', reserveW: 'rezerva',
      focusH: 'Čo chcete zistiť najviac?', focusP: 'Na to sa vo verdikte zameriame.', focusHint: 'Vyberte jedno alebo viac.', picked: ' vybrané', pickOne: 'Vyberte aspoň jedno',
      focus: [['risk', 'Kde je najväčšie riziko?'], ['drop', 'Zvládnem to pri prepade?'], ['tax', 'Čo s daňami a úschovou?'], ['next', 'Čo mám urobiť ako ďalšie?']],
      revEb: 'Posledná kontrola', revH: 'Takto vaše rozhodnutie pochopíme.', revP: 'Opravte, čo nesedí. Presne toto pôjde do hodnotenia.', edit: '✎ Upraviť', none: 'Neuvedené', notYet: 'Zatiaľ neviem', otherGoal: 'Niečo iné',
      rev: { goal: 'Čo zvažujete', text: 'Vlastnými slovami', country: 'Krajina', experience: 'Bitcoin už vlastníte', amount: 'Suma', share: 'Podiel na majetku', horizon: 'Kedy peniaze potrebujete', reserve: 'Rezerva na 6 mesiacov', keys: 'Kľúče', drop: 'Pri prepade o 50 %' },
      revAi: 'Hodnotí umelá inteligencia (jazykový model od Anthropic). Môže sa mýliť. Nie je to investičné, daňové ani právne poradenstvo.', getVerdict: 'Získať verdikt zadarmo',
      loadH: 'Kontrolujeme vaše rozhodnutie', loadSteps: ['Čítame vaše rozhodnutie a odpovede…', 'Hodnotíme 10 signálov…', 'Hľadáme najslabšie miesto…', 'Pripravujeme ďalší krok…'], loadGet: 'Čo dostanete', loadNote: 'Zvyčajne 5 až 15 sekúnd. Nechajte stránku otvorenú.',
      unlock: [['Všetkých 10 signálov', 'Každý signál s bodmi a dôvodom, napísaným pre vaše rozhodnutie.'], ['Najslabšie miesto', 'Ktorý signál vás ťahá dole a kde ho doplniť.'], ['Chýbajúce otázky', 'Na čo ste nemysleli a čo zvážiť predtým, ako konáte.'], ['Partneri pre vašu kategóriu', 'Partner Finder s vašimi odpoveďami už vyplnenými.']],
      failH: 'Verdict sa nepodarilo načítať.', retry: '↺ Skúsiť znova', network: 'Chyba siete. Skúste to znova.', error: 'Niečo sa pokazilo. Skúste to o chvíľu.',
      resEb: 'Váš verdikt', weakH: 'Najslabšie miesto: ', found: 'Čo Verdict našiel', strongB: 'Silné miesto', weakB: 'Najslabšie miesto', missB: 'Čo chýba', nothing: 'Nič podstatné.', inReport: ' v reporte',
      free: 'Dva signály zadarmo', strongest: 'Najsilnejší', weakest: 'Najslabší', fill: 'Doplniť v ',
      lockedH: ' ďalších signálov je v reporte', lockedP: 'Každý s bodmi a dôvodom, napísaným pre vaše rozhodnutie.', lockedCta: '🔒 Celý report za 14 €',
      nextH: 'Váš ďalší krok', nextB: 'Doplňte najslabšie miesto', open: 'Otvoriť →',
      pfH: 'Partneri pre vašu kategóriu', pfP: 'Partner Finder už pozná vaše odpovede a ukazuje partnerov, ktorí spĺňajú vaše kritériá. Poradie určujú pevné pravidlá, nie provízia. Vyberáte vy.',
      pfNote: 'Partnerské odkazy: ak sa zaregistrujete, Virtuse môže dostať províziu, vaša cena sa nemení.', pfOpen: 'Otvoriť Partner Finder na celej stránke →',
      repH: 'Celý report', repT: 'Viac istoty, kým konáte.', repP: 'Nájdite slabé miesta skôr, ako vás budú stáť peniaze.', repList: ['Všetkých 10 signálov s bodmi a dôvodmi', 'Všetky chýbajúce otázky pre vaše rozhodnutie', 'Plán krokov s nástrojmi Virtuse', 'PDF na neskôr, ostáva vám natrvalo'],
      once: 'Jednorazovo', noSub: 'Žiadne predplatné.', unlockCta: 'Odomknúť celý report', waitNote: 'Do 1. novembra zbierame záujem na stránke Virtuse CFO.',
      declinedH: 'Verdict to nevie ohodnotiť.', again: '↺ Ohodnotiť ďalšie rozhodnutie', decision: 'Rozhodnutie'
    },
    en: {
      steps: ['Decision', 'About you', 'Your plan', 'Check'], back: '← Back', cont: 'Continue', start: 'Start', skip: '? Not sure yet', other: 'Something else, I will describe it',
      closedH: 'Verdict opens on 1 November.', closedP: 'Join the list and we will tell you.', closedCta: 'To the Virtuse CFO page',
      startEb: 'Verdict · free', startH: 'Helping investors make <span>smart decisions.</span>',
      startP: 'Before you buy, sell or borrow, test your decision on 10 signals. First we ask what the AI needs to know, then you get your verdict.',
      startHint: 'About 2 minutes · no account · not investment advice', startNote: '10 short questions + your own words',
      goalEb: 'Your decision', goalH: 'What are you considering?', goalP: 'Pick the closest one.', goalHint: 'Partner Finder uses the same categories.',
      goals: [['buy', 'Buy Bitcoin', 'A first purchase or a larger lump sum'], ['dca', 'Buy regularly', 'Monthly or weekly'], ['loan', 'Bitcoin-backed loan', 'Cash without selling'], ['sell', 'Sell part of my Bitcoin', 'Take profit, buy something else'], ['treasury', 'Bitcoin in my company', 'Part of company cash into BTC'], ['custody', 'Custody and inheritance', 'Keys, multisig, who can reach the BTC']],
      textH: 'Describe it in your own words.', textP: 'Amount, timing, where the money comes from. One to three sentences are enough.', textHint: 'Or start from an example and edit it.',
      textPh: 'For example: I want to buy €10,000 of Bitcoin from savings and hold it for 5 years.', textWarn: "Don't write names, contact details, account numbers, wallet addresses or health details. We don't store the text in the Virtuse database; Anthropic (USA) processes it to assess it.", textShort: 'At least one sentence',
      sugg: { buy: ['I want to buy €10,000 of Bitcoin from savings and hold it for 5 years.', "I'm thinking of putting half the money from selling my flat into Bitcoin."], dca: ['I want to buy €200 of Bitcoin every month for the next 10 years.', 'I want to move my €300 monthly ETF savings into Bitcoin.'], loan: ['I want to borrow €20,000 against 0.5 BTC for a renovation.', "I'm considering a Bitcoin-backed loan instead of a mortgage."], sell: ['I want to sell 30% of my Bitcoin and buy a car.', "I'm wondering whether to sell some after an 80% rise."], treasury: ["I want to put 20% of my company's cash into Bitcoin for 5 years.", 'The company has a €200,000 reserve; we are considering 10% in BTC.'], custody: ['I want to move my Bitcoin from an exchange to a hardware wallet.', 'I want my wife to be able to reach my Bitcoin if something happens to me.'] },
      howEb: 'How it works', howH: '10 signals. One honest picture.', howP: 'Every decision is scored the same way, so you can see where yours really stands. The next 8 questions give the AI what it would otherwise guess.', howNote: 'Example scores, not yours. Each signal 0 to 10, the score is their sum.',
      howTabs: { 'Risk': [['Worst case', 7], ['Liquidity', 5], ['Plan B', 4]], 'Tax and custody': [['Tax', 6], ['Custody and inheritance', 3], ['Alternatives', 7]], 'Plan': [['Goal', 8], ['Time horizon', 7], ['Rule, not emotion', 5]] },
      about: 'About you', plan: 'Your plan',
      q: {
        country: ['Where do you pay tax?', 'Bitcoin tax rules differ a lot between countries.', 'Fills the Tax signal. Tax Agent and Partner Finder use the same answer.'],
        experience: ['Do you already own Bitcoin?', 'Partner Finder uses this to show partners for beginners or experienced holders.', 'Used by Partner Finder. The AI takes it as context.'],
        amount: ['How much money is involved?', 'Roughly is fine.', 'Fills the Worst case signal (a fall in euros). Used by Partner Finder and Stacking.'],
        share: ['What share of your wealth is it?', 'An estimate is enough. Count savings and investments, not your home.', 'Fills the Worst case and Asymmetry signals.'],
        horizon: ['When might you need this money?', 'Bitcoin can fall 70% and take years to recover.', 'Fills the Time horizon and Liquidity signals.'],
        reserve: ['Do you have a reserve for at least 6 months of expenses?', 'Outside Bitcoin, in cash or a bank account.', 'Fills the Liquidity and Plan B signals.'],
        keys: ['Who will hold the keys, and who knows about them?', 'Custody is part of the decision, not a detail.', 'Fills the Custody and inheritance signal.'],
        drop: ['Bitcoin falls 50%. What do you do?', 'Answer with what you would really do.', 'Fills the Rule, not emotion and Worst case signals.']
      },
      opts: {
        country: [['sk', 'Slovakia'], ['cz', 'Czechia'], ['at', 'Austria'], ['de', 'Germany'], ['pl', 'Poland'], ['hu', 'Hungary'], ['si', 'Slovenia'], ['hr', 'Croatia'], ['ro', 'Romania'], ['bg', 'Bulgaria'], ['nl', 'Netherlands'], ['fr', 'France'], ['es', 'Spain'], ['other', 'Another country']],
        experience: [['new', 'Not yet, this will be my first purchase'], ['hodler', 'Yes, I already have some']],
        amount: [['s', 'Under €1,000'], ['m', '€1,000 to 10,000'], ['l', '€10,000 to 100,000'], ['xl', 'Over €100,000']],
        share: [['lt5', 'Under 5%'], ['5_20', '5 to 20%'], ['20_50', '20 to 50%'], ['gt50', 'More than half']],
        horizon: [['lt1', 'Within 1 year'], ['1_4', 'In 1 to 4 years'], ['gt4', 'In more than 4 years'], ['never', "I don't plan to spend it"]],
        reserve: [['yes', 'Yes'], ['part', 'Partly'], ['no', 'No']],
        keys: [['exch', 'An exchange or app'], ['self', 'Me, in my own wallet'], ['selfplan', 'Me, and someone close knows how to reach them']],
        drop: [['buy', 'Buy more by a rule set in advance'], ['hold', 'Hold, do nothing'], ['sell', 'Sell some or all']]
      },
      ctxEb: 'Your context', ctxH: 'Your decision now has a clear frame.', ctxP: "Most decisions fail on what was never said out loud: when you'll need the money, what you'll do in a fall and who can reach it. Now the AI knows and doesn't have to guess.",
      ctxWhat: "What you're considering", ctxLimits: 'Your limits', ofWealth: 'of wealth', reserveW: 'reserve',
      focusH: 'What do you most want to find out?', focusP: "That's where the verdict will focus.", focusHint: 'Pick one or more.', picked: ' selected', pickOne: 'Pick at least one',
      focus: [['risk', "Where's the biggest risk?"], ['drop', 'Can I get through a fall?'], ['tax', 'What about tax and custody?'], ['next', 'What should I do next?']],
      revEb: 'Final check', revH: "Here's how we understood your decision.", revP: "Change anything that doesn't sound right. This is exactly what gets assessed.", edit: '✎ Edit', none: 'Not given', notYet: 'Not sure yet', otherGoal: 'Something else',
      rev: { goal: "What you're considering", text: 'In your own words', country: 'Country', experience: 'Already own Bitcoin', amount: 'Amount', share: 'Share of wealth', horizon: 'When you need the money', reserve: '6-month reserve', keys: 'Keys', drop: 'In a 50% fall' },
      revAi: 'This assessment is generated by artificial intelligence (a language model by Anthropic). It may be wrong. It is not investment, tax or legal advice.', getVerdict: 'Get my free verdict',
      loadH: 'Checking your decision', loadSteps: ['Reading your decision and answers…', 'Scoring 10 signals…', 'Finding the weakest point…', 'Preparing your next step…'], loadGet: 'What you get', loadNote: 'Usually 5 to 15 seconds. Keep this page open.',
      unlock: [['All 10 signals', 'Each signal scored, with a reason written for your decision.'], ['The weakest point', 'Which signal pulls you down and where to fill it in.'], ['Missing questions', "What you haven't considered before you act."], ['Partners for your category', 'Partner Finder with your answers already filled in.']],
      failH: "Verdict couldn't load.", retry: '↺ Try again', network: 'Network error. Please try again.', error: 'Something went wrong. Please try again in a moment.',
      resEb: 'Your verdict', weakH: 'Weakest point: ', found: 'What Verdict found', strongB: 'Strong point', weakB: 'Weakest point', missB: "What's missing", nothing: 'Nothing major.', inReport: ' in the report',
      free: 'Two signals free', strongest: 'Strongest', weakest: 'Weakest', fill: 'Fill it in with ',
      lockedH: ' more signals are in the report', lockedP: 'Each scored, with a reason written for your decision.', lockedCta: '🔒 Full report for €14',
      nextH: 'Your next step', nextB: 'Fill in the weakest point', open: 'Open →',
      pfH: 'Partners for your category', pfP: 'Partner Finder already has your answers and shows the partners that meet your criteria. Fixed rules set the order, not commission. You choose.',
      pfNote: 'Partner links: if you sign up, Virtuse may receive a commission. Your price does not change.', pfOpen: 'Open Partner Finder full page →',
      repH: 'Full report', repT: 'More certainty before you act.', repP: 'Find the gaps before they cost you money.', repList: ['All 10 signals with scores and reasons', 'Every missing question for your decision', 'A step-by-step plan with Virtuse tools', 'A PDF to keep, yours permanently'],
      once: 'One-time', noSub: 'No subscription.', unlockCta: 'Unlock the full report', waitNote: 'Until 1 November we collect interest on the Virtuse CFO page.',
      declinedH: "Verdict can't rate this.", again: '↺ Rate another decision', decision: 'Decision'
    }
  }[LANG];

  var A = { goal: null, text: '', country: null, experience: null, amount: null, share: null, horizon: null, reserve: null, keys: null, drop: null, focus: [] };
  var SV = '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CK = '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var PROFILE_KEYS = ['country', 'experience', 'amount', 'share', 'horizon', 'reserve', 'keys', 'drop'];
  var panel = document.getElementById('panel'), back = document.getElementById('back'), stepsEl = document.getElementById('steps');
  var RESULT = null, i = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function push(o) { (window.dataLayer = window.dataLayer || []).push(o); }
  function foot(extra, btn, disabled) { return '<div class="foot"><span class="note" id="fn">' + (extra || '') + '</span><button class="cta" id="c"' + (disabled ? ' disabled' : '') + '>' + (btn || STR.cont) + ' ' + SV + '</button></div>'; }
  function label(key, v) { var o = (STR.opts[key] || []).filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : null; }
  function ans(key) { var v = A[key]; if (!v) return STR.none; if (v === 'na') return STR.notYet; return label(key, v) || v; }
  function goalLabel() { var g = STR.goals.filter(function (x) { return x[0] === A.goal; })[0]; return g ? g[1] : STR.otherGoal; }

  if (!ON) {
    stepsEl.hidden = true;
    panel.innerHTML = '<div class="closed"><h2>' + STR.closedH + '</h2><p class="sub">' + STR.closedP + '</p><a class="cta" href="cfo.html#pricing">' + STR.closedCta + ' ' + SV + '</a></div>';
    return;
  }

  var SCREENS = [
    { s: 0, p: .2, r: start }, { s: 0, p: .45, r: goal }, { s: 0, p: .75, r: text, k: 'text' }, { s: 0, p: 1, r: how }
  ];
  PROFILE_KEYS.forEach(function (k, n) { SCREENS.push({ s: k === 'drop' ? 2 : 1, p: k === 'drop' ? .4 : (n + 1) / 7, r: q(k), k: k }); });
  SCREENS.push({ s: 2, p: .7, r: context }, { s: 2, p: 1, r: focus }, { s: 3, p: .6, r: review, k: 'review' }, { s: 3, p: 1, r: loading, k: 'loading' }, { s: 3, p: 1, r: showResult, k: 'result' });
  function at(k) { for (var n = 0; n < SCREENS.length; n++) if (SCREENS[n].k === k) return n; return 0; }

  back.textContent = STR.back;
  back.onclick = function () { if (i > 0) go(i === at('result') ? at('review') : i - 1); };
  function stepper() {
    var cur = SCREENS[i];
    stepsEl.innerHTML = STR.steps.map(function (t, k) {
      var st = k < cur.s ? 'done' : k === cur.s ? 'on' : '', w = k < cur.s ? 100 : k === cur.s ? cur.p * 100 : 0;
      return '<div class="step ' + st + '"><div class="lbl"><span class="n">' + (k < cur.s ? '✓' : k + 1) + '</span><span class="t">' + t + '</span></div><div class="track"><i style="width:' + w + '%"></i></div></div>';
    }).join('');
  }
  function go(n) {
    i = n; back.hidden = i === 0 || i === at('loading'); stepper(); SCREENS[i].r();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    push({ event: 'verdict_step', verdict_lang: LANG, verdict_step: SCREENS[i].k || SCREENS[i].r.name });
  }
  function next() { go(i + 1); }
  function skipBtn(lbl, key) {
    return '<div class="alt"><button class="ghost" data-skip="' + key + '">' + (lbl || STR.skip) + '</button></div>';
  }
  function bindSkip() { var b = panel.querySelector('[data-skip]'); if (b) b.onclick = function () { A[b.dataset.skip] = 'na'; next(); }; }

  function start() {
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.startEb + '</div><h1>' + STR.startH + '</h1><p class="sub">' + STR.startP + '</p><p class="hint">' + STR.startHint + '</p>' + foot(STR.startNote, STR.start);
    document.getElementById('c').onclick = next;
  }
  function goal() {
    panel.innerHTML = '<div class="eyebrow">' + STR.goalEb + '</div><h2>' + STR.goalH + '</h2><p class="sub">' + STR.goalP + '</p><p class="hint">' + STR.goalHint + '</p>' +
      '<div class="opts">' + STR.goals.map(function (g) { return '<button class="opt' + (A.goal === g[0] ? ' sel' : '') + '" data-v="' + g[0] + '"><span>' + g[1] + '<small>' + g[2] + '</small></span>' + (A.goal === g[0] ? CK : SV) + '</button>'; }).join('') + '</div>' + skipBtn(STR.other, 'goal');
    panel.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { A.goal = b.dataset.v; next(); }; });
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
    return '<svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="' + r + '" stroke="#2b2f35" stroke-width="5" fill="none"/><circle cx="38" cy="38" r="' + r + '" stroke="#f7931a" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="' + (c * v / 10) + ' ' + c + '" transform="rotate(-90 38 38)"/><text x="38" y="44" text-anchor="middle" fill="#e6edf3" font-size="18" font-weight="700" font-family="Inter">' + v + '</text></svg>';
  }
  function how() {
    var keys = Object.keys(STR.howTabs), cur = 0;
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.howEb + '</div><h2>' + STR.howH + '</h2><p class="sub">' + STR.howP + '</p>' +
      '<div class="inner"><div class="tabs" role="tablist"></div><div class="rings"></div><p class="small">' + STR.howNote + '</p></div>' + foot();
    function draw() {
      panel.querySelector('.tabs').innerHTML = keys.map(function (k, n) { return '<button role="tab" aria-selected="' + (n === cur) + '" class="' + (n === cur ? 'on' : '') + '" data-n="' + n + '">' + k + '</button>'; }).join('');
      panel.querySelector('.rings').innerHTML = STR.howTabs[keys[cur]].map(function (x) { return '<div class="ring">' + ring(x[1]) + x[0] + '</div>'; }).join('');
      panel.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { cur = +b.dataset.n; draw(); }; });
    }
    draw(); document.getElementById('c').onclick = next;
  }
  function q(key) {
    return function () {
      var Q = STR.q[key], O = STR.opts[key], chips = key === 'country';
      var h = '<div class="eyebrow">' + (key === 'drop' ? STR.plan : STR.about) + '</div><h2>' + Q[0] + '</h2><p class="sub">' + Q[1] + '</p><p class="why">' + Q[2] + '</p>';
      h += chips
        ? '<div class="chips">' + O.map(function (c) { return '<button class="opt' + (A[key] === c[0] ? ' sel' : '') + '" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'
        : '<div class="opts">' + O.map(function (o) { return '<button class="opt' + (A[key] === o[0] ? ' sel' : '') + '" data-v="' + o[0] + '"><span>' + o[1] + '</span>' + (A[key] === o[0] ? CK : SV) + '</button>'; }).join('') + '</div>';
      panel.innerHTML = h + skipBtn(null, key);
      panel.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { A[key] = b.dataset.v; b.classList.add('sel'); setTimeout(next, 160); }; });
      bindSkip();
    };
  }
  function context() {
    var dots = '';
    for (var k = 0; k < 70; k++) { var x = (k * 37) % 92 + 2, y = (k * 53) % 86 + 4; dots += '<span style="left:' + x + '%;top:' + y + '%"' + (x > 62 && y > 6 && k % 2 ? ' class="hit"' : '') + '></span>'; }
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.ctxEb + '</div><h2>' + STR.ctxH + '</h2><p class="sub">' + STR.ctxP + '</p>' +
      '<div class="inner" style="margin-top:16px"><div class="dotfield" aria-hidden="true"><div class="halo"></div>' + dots + '</div>' +
      '<div class="ctx"><div><b>' + STR.ctxWhat + '</b><span>' + esc(goalLabel()) + '</span></div><div><b>' + STR.ctxLimits + '</b><span>' + esc(ans('share')) + ' ' + STR.ofWealth + ' · ' + esc(ans('horizon').toLowerCase()) + ' · ' + STR.reserveW + ': ' + esc(ans('reserve').toLowerCase()) + '</span></div></div></div>' +
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
    var rows = [['goal', goalLabel(), 1], ['text', A.text || STR.none, at('text')]].concat(PROFILE_KEYS.map(function (k) { return [k, ans(k), at(k)]; }));
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.revEb + '</div><h2>' + STR.revH + '</h2><p class="sub">' + STR.revP + '</p><div style="margin-top:18px">' +
      rows.map(function (r) { return '<div class="rv"><div><b>' + STR.rev[r[0]] + '</b>' + esc(r[1]) + '</div><button class="ghost edit" data-to="' + r[2] + '">' + STR.edit + '</button></div>'; }).join('') +
      '</div><p class="warn" style="margin-top:12px">' + STR.revAi + '</p>' + foot('', STR.getVerdict, A.text.trim().length < 20);
    panel.querySelectorAll('[data-to]').forEach(function (b) { b.onclick = function () { go(+b.dataset.to); }; });
    document.getElementById('c').onclick = next;
  }
  function profile() {
    var p = {};
    ['goal'].concat(PROFILE_KEYS).forEach(function (k) { if (A[k] && A[k] !== 'na') p[k] = A[k]; });
    if (A.focus.length) p.focus = A.focus.slice();
    return p;
  }
  function loading() {
    var U = STR.unlock, k = 0;
    panel.innerHTML = '<div class="load"><div class="spin" aria-hidden="true"></div><h2>' + STR.loadH + '</h2><p class="sub" id="ls" aria-live="polite">' + STR.loadSteps[0] + '</p>' +
      '<div class="unlock"><div class="mock" aria-hidden="true"><i style="width:40%"></i><i class="o"></i><i style="width:80%"></i><i style="width:55%"></i></div><div><div class="eyebrow">' + STR.loadGet + '</div><h3 id="ut" style="font-size:22px;margin-bottom:6px"></h3><p class="sub" id="ud" style="font-size:15px"></p></div></div>' +
      '<div class="pager" id="pg"></div><p class="small">' + STR.loadNote + '</p></div>';
    function show() {
      var u = U[k % U.length];
      document.getElementById('ut').textContent = u[0]; document.getElementById('ud').textContent = u[1];
      document.getElementById('pg').innerHTML = U.map(function (_, n) { return '<i class="' + (n === k % U.length ? 'on' : '') + '"></i>'; }).join('');
      document.getElementById('ls').textContent = STR.loadSteps[Math.min(k, STR.loadSteps.length - 1)];
    }
    show();
    var t = setInterval(function () { k++; show(); }, 1600), minWait = new Promise(function (r) { setTimeout(r, 2500); });
    push({ event: 'verdict_submit', verdict_lang: LANG, verdict_goal: A.goal || 'other' });
    var call = fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: A.text, lang: LANG, hp: A.hp || '', profile: profile() }) })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
      .catch(function () { return { ok: false, d: { error: STR.network } }; });
    Promise.all([call, minWait]).then(function (x) {
      clearInterval(t);
      var res = x[0];
      if (res.ok && res.d && res.d.ok) {
        RESULT = res.d;
        push(RESULT.declined ? { event: 'verdict_declined', verdict_lang: LANG } : { event: 'verdict_result', verdict_lang: LANG, verdict_band: RESULT.band.id, verdict_weakest: RESULT.weakest.id });
        next(); return;
      }
      panel.innerHTML = '<h2>' + STR.failH + '</h2><p class="sub">' + esc((res.d && res.d.error) || STR.error) + '</p><div class="foot"><span></span><button class="ghost" id="rt">' + STR.retry + '</button></div>';
      document.getElementById('rt').onclick = function () { go(at('loading')); };
    });
  }
  function sig(s, lab, href, tool) {
    return '<div class="sig"><div class="h"><div><b>' + esc(s.name) + '</b><div class="tag">' + lab + '</div></div><em>' + s.points + '<small>/10</small></em></div><div class="bar"><i style="width:' + s.points * 10 + '%"></i></div><p>' + esc(s.reason) + '</p>' + (href ? '<a href="' + href + '">' + STR.fill + esc(tool) + ' →</a>' : '') + '</div>';
  }
  function showResult() {
    var r = RESULT; if (!r) { go(at('review')); return; }
    var again = '<div class="foot" style="margin-top:18px"><button class="ghost" id="again">' + STR.again + '</button></div>';
    if (r.declined) {
      panel.innerHTML = '<div class="eyebrow">' + STR.resEb + '</div><h2>' + STR.declinedH + '</h2><p class="sub">' + esc(r.message) + '</p><p class="small">' + esc(r.aiLabel) + '</p>' + again;
      document.getElementById('again').onclick = function () { go(at('text')); };
      return;
    }
    var strong = r.signals.filter(function (x) { return x.role === 'strongest'; })[0], weak = r.signals.filter(function (x) { return x.role === 'weakest'; })[0];
    var tool = r.weakest.tool, toolHref = tool.page + (tool.page.indexOf('?') < 0 ? '?' : '&') + 'utm_source=verdict';
    var pfq = r.partnerFinder ? Object.keys(r.partnerFinder).map(function (k) { return k + '=' + encodeURIComponent(r.partnerFinder[k]); }).join('&') + '&utm_source=verdict' : '';
    panel.innerHTML = '<div data-ai-generated="true">' +
      '<div class="res-head"><div><div class="eyebrow">' + STR.resEb + ' · ' + esc(goalLabel()) + '</div>' +
      '<h2>' + STR.weakH + esc(weak.name) + '</h2><p class="sub" style="font-size:15px">„' + esc(A.text.slice(0, 140)) + (A.text.length > 140 ? '…' : '') + '“</p></div>' +
      '<div class="score"><b>' + r.score + '</b><small>/100</small><br><span class="pill">' + esc(r.band.label) + '</span></div></div>' +
      '<div class="sec">' + STR.found + '</div><div class="found">' +
      '<div><b>' + STR.strongB + '</b><p>' + esc(strong.name) + ': ' + esc(strong.reason) + '</p></div>' +
      '<div><b>' + STR.weakB + '</b><p>' + esc(weak.name) + ': ' + esc(weak.reason) + '</p></div>' +
      '<div><b>' + STR.missB + '</b><p>' + esc(r.missing[0] || STR.nothing) + (r.missingMore ? ' <span style="color:var(--dim)">+' + r.missingMore + STR.inReport + '</span>' : '') + '</p></div></div>' +
      '<div class="sec">' + STR.free + '</div><div class="sig2">' + sig(strong, STR.strongest) + sig(weak, STR.weakest, toolHref, tool.name) + '</div>' +
      '<div class="locked"><div class="lh"><div><b style="font-size:18px">' + r.locked.length + STR.lockedH + '</b><p>' + STR.lockedP + '</p></div><a class="cta" href="cfo.html#pricing" style="text-decoration:none">' + STR.lockedCta + '</a></div>' +
      '<div class="lgrid">' + r.locked.map(function (x) { return '<div>🔒 ' + esc(x.name) + '<i></i><i></i></div>'; }).join('') + '</div></div>' +
      '<div class="sec">' + STR.nextH + '</div><div class="route"><div class="r"><div><b>' + STR.nextB + '</b><span>' + esc(weak.name) + ' · ' + esc(tool.name) + '</span></div><a href="' + toolHref + '">' + STR.open + '</a></div></div>' +
      (r.partnerFinder ? '<div class="sec">' + STR.pfH + '</div><p class="sub" style="font-size:15px">' + STR.pfP + '</p>' +
        '<iframe class="pf" src="concierge.html?' + pfq + '&utm_medium=verdict" title="Partner Finder" loading="lazy"></iframe>' +
        '<p class="small">' + STR.pfNote + ' <a href="concierge.html?' + pfq + '&utm_medium=verdict_open" style="color:var(--text)">' + STR.pfOpen + '</a></p>' : '') +
      '<div class="sec">' + STR.repH + '</div><div class="price"><div><h3 style="font-size:24px">' + STR.repT + '</h3><p class="sub" style="font-size:15px">' + STR.repP + '</p><ul>' + STR.repList.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' +
      '<div><div class="eyebrow">' + STR.once + '</div><div class="amt">' + (LANG === 'sk' ? '14 €' : '€14') + '</div><p class="sub" style="font-size:14px">' + STR.noSub + '</p><a class="cta" href="cfo.html#pricing" style="width:100%;justify-content:center;margin-top:14px;text-decoration:none">' + STR.unlockCta + '</a><p class="small">' + STR.waitNote + '</p></div></div>' +
      '<p class="small" style="margin-top:22px">' + esc(r.scoreNote) + '</p><p class="small">' + esc(r.aiLabel) + ' ' + esc(r.disclaimer) + '</p></div>' + again;
    document.getElementById('again').onclick = function () { A.text = ''; RESULT = null; go(1); };
  }

  // Handed over from cfo.html: skip the start screen, text already filled in.
  var handed = '';
  try { handed = sessionStorage.getItem('vb-verdict-text') || ''; sessionStorage.removeItem('vb-verdict-text'); } catch (e) {}
  if (handed) { A.text = handed.slice(0, 1200); go(1); } else go(0);
})();
