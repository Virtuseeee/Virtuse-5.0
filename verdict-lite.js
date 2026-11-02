// Verdict Lite (verdict.html, sk/verdict.html; handover 2026-11-02): six
// questions, then a result scored in the browser by fixed rules (no AI call,
// no Worker call except the €14 report waitlist). Same chrome and CSS classes
// as the full funnel (verdict-flow.js), which stays reachable with ?mode=full
// and for ?report=1 / Stripe returns (see the loader in verdict.html).
// Answer ids are the full funnel's, saved in the shared profile (vb-profile.js),
// so Partner Finder, Tax Agent and the full Verdict get them prefilled.
(function () {
  var LANG = document.documentElement.lang === 'sk' ? 'sk' : 'en';

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

  // Question text and options: 1:1 with verdict-flow.js (stg2). Everything
  // else is Lite copy; the SK Lite copy is a DRAFT for Ras.
  var STR = {
    en: {
      steps: ['Start', 'About you', 'Your plan', 'Verdict'], progress: 'Your progress', back: '← Back', skip: '? Not sure yet', about: 'About you', plan: 'Your plan',
      startEb: 'Verdict Lite · free', startH: '6 questions before you choose a Bitcoin partner in the EU.',
      startP: 'Country, amount, custody and tax. You get a score out of 100, the weakest point and one next step.',
      startHint: '~1 minute · no account · not investment advice', startNote: 'Six short questions, no free text', startBtn: 'Get Lite Verdict',
      q: {
        country: ['Where do you pay tax?', 'Bitcoin tax rules differ a lot between countries.', 'Tax Agent and Partner Finder use the same answer.'],
        amount: ['How much money is involved?', 'Roughly is fine.', 'Used to show what a 70% fall would mean in euros.'],
        share: ['What share of your wealth is it?', 'An estimate is enough. Count savings and investments, not your home.', 'The biggest single factor in the Lite score.'],
        experience: ['Do you already own Bitcoin?', 'Partner Finder uses this to show partners for beginners or experienced holders.', 'Used by Partner Finder.'],
        custody_pref: ['How do you want your Bitcoin held?', 'Partner Finder uses this to show partners that meet your criteria.', 'Used by Partner Finder.'],
        tax_known: ['Do you know how a sale is taxed in your country?', 'For example the rate, an exemption after a holding period, or whether swapping coins is taxed.', 'Affects the Tax area of the score.']
      },
      opts: {
        country: [['sk', 'Slovakia'], ['cz', 'Czechia'], ['at', 'Austria'], ['de', 'Germany'], ['pl', 'Poland'], ['hu', 'Hungary'], ['si', 'Slovenia'], ['hr', 'Croatia'], ['ro', 'Romania'], ['bg', 'Bulgaria'], ['nl', 'Netherlands'], ['fr', 'France'], ['es', 'Spain'], ['other', 'Another country']],
        amount: [['s', 'Under €1,000'], ['m', '€1,000 to 10,000'], ['l', '€10,000 to 100,000'], ['xl', 'Over €100,000']],
        share: [['lt5', 'Under 5%'], ['5_20', '5 to 20%'], ['20_50', '20 to 50%'], ['gt50', 'More than half']],
        experience: [['new', 'Not yet, this will be my first purchase'], ['hodler', 'Yes, I already have some']],
        custody_pref: [['self', 'My own keys'], ['assisted', 'Assisted custody (help with keys and recovery)'], ['any', 'No preference']],
        tax_known: [['yes', 'Yes, I know the rule'], ['roughly', 'Roughly'], ['no', 'No']]
      },
      loadH: 'Checking your answers', loadSteps: ['Reading your 6 answers…', 'Scoring size, tax and custody…', 'Finding the weakest point…'], loadGet: 'What you get',
      unlock: [['Score out of 100', 'From your 6 answers, by fixed rules.'], ['Strongest and weakest point', 'Which area holds you back.'], ['3 bottlenecks', 'What to sort out before you choose a partner.'], ['One next step', 'With the Virtuse tool that helps.']],
      resEb: 'Verdict Lite', band: {
        ready: ['Basics in place', 'Ready to compare partners.', 'Size, tax and custody are covered. Compare the partners that match your criteria and choose.'],
        gaps: ['A few gaps', 'Close: fill in one or two points first.', 'Most of the basics are there. The points below are what is still missing.'],
        basics: ['Basics missing', 'Not yet: fill in the basics first.', 'Before you choose a partner, sort out the points below. Each takes minutes, not days.']
      },
      scoreLine: 'Score from your 6 answers: size, tax and custody, 10 points each, scaled to 100 and rounded to 5.',
      sumH: 'Summary', twoH: 'Strongest and weakest point', strongest: 'Strongest', weakest: 'Weakest', bottH: '3 bottlenecks', nextH: 'Your next step',
      area: { size: 'Size', tax: 'Tax', custody: 'Custody' },
      meaning: {
        size: ['A large part of your wealth is at stake. A 70% fall would change your plans.', 'A 70% fall would hurt, but it would not break your finances.', 'The amount is small next to your savings. A 70% fall would not change your plans.'],
        tax: ["You don't know yet how a sale is taxed in your country.", 'You know the rule roughly. Check the details before the first sale.', 'You know how a sale is taxed in your country.'],
        custody: ["You haven't decided who will hold the keys.", 'You know how you want it held. Practise the recovery before larger amounts.', 'You know how you want your Bitcoin held.']
      },
      sum: function (a) {
        var out = [];
        out.push(a.amount ? 'You plan to put ' + a.amount + ' into Bitcoin' + (a.share ? ', ' + a.share + ' of your wealth' : '') + '.' : (a.share ? 'It is ' + a.share + ' of your wealth.' : 'You did not give an amount.'));
        if (a.experience) out.push(a.experienceId === 'new' ? 'It will be your first Bitcoin.' : 'You already hold some Bitcoin.');
        out.push((a.country ? 'You pay tax in ' + (a.countryId === 'other' ? 'another country' : a.country) : 'You did not say where you pay tax') + (a.taxId === 'yes' ? ' and you know how a sale is taxed.' : a.taxId === 'roughly' ? ' and you know the sale rule roughly.' : " and you don't know the sale rule yet."));
        out.push(a.custody ? 'Custody: ' + a.custody.toLowerCase() + '.' : 'You have not chosen how to hold it.');
        return out.join(' ');
      },
      b: {
        taxNo: ['Find out how a sale of Bitcoin is taxed in {c}.', 'The rate, a holding period and whether swapping coins counts. You need this before the first sale, not after.'],
        taxRough: ['Check the exact tax rule for {c}.', 'Roughly is a start. The exemption and the filing date decide how much you keep.'],
        taxCountry: ['Pick the country where you pay tax.', 'Tax rules and the partners you can use depend on it.'],
        sizeHigh: ['Check the size: {s} of your wealth.', 'In a 70% fall, {f} would be left of {a}. Decide on a size you could hold through that.'],
        sizeNa: ['Estimate what share of your wealth this is.', 'The share, not the amount, decides how much a 70% fall would hurt.'],
        amountNa: ['Put a rough amount on it.', 'A 70% fall means something different at €500 and at €50,000.'],
        custodyAny: ['Decide who will hold the keys.', 'An exchange, your own wallet or assisted custody: each has different risks and a different recovery.'],
        custodyNew: ['Practise a wallet recovery with a small amount first.', 'Own keys on a first purchase: test the backup before the full amount goes in.'],
        horizon: ['Decide when you might need this money.', 'Lite did not ask. Bitcoin can fall 70% and take years to recover.'],
        reserve: ['Keep a reserve of 6 months of expenses outside Bitcoin.', 'Lite did not ask. The reserve is what lets you hold through a fall.'],
        rule: ['Write down what you will do if Bitcoin falls 70%.', 'Lite did not ask. A rule set in advance beats a decision made in a fall.']
      },
      tools: { tax: 'Tax Agent', stacking: 'Stacking Strategist', secure: 'Custody options', full: 'Full Verdict (free)' },
      conH: 'Go through it with a person', conP: 'Free 15-minute consultation with Virtuse. No sales pitch.', conBtn: 'Book a free 15-minute call',
      repH: 'Full report', repT: 'All 10 signals, not just 3 areas.', repList: ['All 10 signals with points and reasons', 'Every missing question for your decision', 'A step plan with Virtuse tools', 'A PDF you keep, no subscription'],
      once: 'One-time', price: '€14', waitNote: "Payments aren't open yet. Leave your email and we'll tell you when the report opens.",
      wantPh: 'Your email', wantBtn: 'Join the waitlist', wantOk: "You're on the list. We'll email you once when the report opens.", wantBad: 'Enter a valid email.',
      wantNote: 'We store only your email, not your answers. Unsubscribe with one click.', privacy: 'Privacy', network: 'Network error. Try again.', error: 'Something went wrong. Try again in a moment.',
      pfH: 'Partners that match your criteria', pfP: 'Partner Finder opens with your answers filled in and shows the partners that match your criteria. Fixed rules set the order, not commission. You compare and choose.',
      pfBtn: 'Open Partner Finder', pfNote: 'Partner links: if you sign up, Virtuse may get a commission; your price does not change.',
      fullP: 'Want the 10-signal check with your own words?', fullLink: 'Full Verdict, free →',
      again: '↺ Rate again', pdf: 'Save as PDF',
      legal: 'Verdict Lite is an automatic check of your 6 answers by fixed rules; no AI model reads them. It rates how complete the basics of your plan are, not whether to buy. Not investment, tax or legal advice.',
      copy: '© 2018–2026 Virtuse Wealth Management, a.s.',
      heroBtn: 'Get Lite Verdict →', heroNote: '6 questions · ~1 minute · free'
    },
    sk: {
      steps: ['Štart', 'O vás', 'Váš plán', 'Verdict'], progress: 'Váš postup', back: '← Späť', skip: '? Zatiaľ neviem', about: 'O vás', plan: 'Váš plán',
      startEb: 'Verdict Lite · zadarmo', startH: '6 otázok predtým, ako si vyberiete Bitcoin partnera v EÚ.',
      startP: 'Krajina, suma, úschova a dane. Dostanete skóre zo 100, najslabšie miesto a jeden ďalší krok.',
      startHint: '~1 minúta · bez účtu · nie je to investičné poradenstvo', startNote: 'Šesť krátkych otázok, bez písania', startBtn: 'Získať Verdict Lite',
      q: {
        country: ['V ktorej krajine platíte dane?', 'Pravidlá pre Bitcoin sa medzi krajinami výrazne líšia.', 'Rovnakú odpoveď použijú Tax Agent a Partner Finder.'],
        amount: ['O akú sumu ide?', 'Približne stačí.', 'Podľa nej ukážeme, čo by znamenal pokles o 70 % v eurách.'],
        share: ['Koľko z vášho majetku to bude?', 'Odhad stačí. Rátajte úspory a investície, nie bývanie.', 'Najväčší jednotlivý faktor skóre Lite.'],
        experience: ['Vlastníte už Bitcoin?', 'Podľa toho Partner Finder vyberie partnerov pre začiatočníkov alebo pokročilých.', 'Použije Partner Finder.'],
        custody_pref: ['Ako chcete mať Bitcoin v úschove?', 'Podľa toho Partner Finder ukáže partnerov, ktorí spĺňajú vaše kritériá.', 'Použije Partner Finder.'],
        tax_known: ['Viete, ako sa vo vašej krajine zdaní predaj?', 'Napríklad sadzba, oslobodenie po čase držby alebo či sa zdaňuje aj výmena kryptomien.', 'Ovplyvní oblasť Dane v skóre.']
      },
      opts: {
        country: [['sk', 'Slovensko'], ['cz', 'Česko'], ['at', 'Rakúsko'], ['de', 'Nemecko'], ['pl', 'Poľsko'], ['hu', 'Maďarsko'], ['si', 'Slovinsko'], ['hr', 'Chorvátsko'], ['ro', 'Rumunsko'], ['bg', 'Bulharsko'], ['nl', 'Holandsko'], ['fr', 'Francúzsko'], ['es', 'Španielsko'], ['other', 'Iná krajina']],
        amount: [['s', 'Menej ako 1 000 €'], ['m', '1 000 až 10 000 €'], ['l', '10 000 až 100 000 €'], ['xl', 'Viac ako 100 000 €']],
        share: [['lt5', 'Menej ako 5 %'], ['5_20', '5 až 20 %'], ['20_50', '20 až 50 %'], ['gt50', 'Viac ako polovica']],
        experience: [['new', 'Ešte nie, bude to prvý nákup'], ['hodler', 'Áno, už nejaký mám']],
        custody_pref: [['self', 'Vlastné kľúče'], ['assisted', 'Asistovaná úschova (pomoc s kľúčmi a obnovou)'], ['any', 'Je mi to jedno']],
        tax_known: [['yes', 'Áno, poznám pravidlo'], ['roughly', 'Približne'], ['no', 'Nie']]
      },
      loadH: 'Kontrolujeme vaše odpovede', loadSteps: ['Čítame vašich 6 odpovedí…', 'Hodnotíme veľkosť, dane a úschovu…', 'Hľadáme najslabšie miesto…'], loadGet: 'Čo dostanete',
      unlock: [['Skóre zo 100', 'Z vašich 6 odpovedí, podľa pevných pravidiel.'], ['Najsilnejšie a najslabšie miesto', 'Ktorá oblasť vás brzdí.'], ['3 úzke miesta', 'Čo vyriešiť predtým, ako si vyberiete partnera.'], ['Jeden ďalší krok', 'S nástrojom Virtuse, ktorý pomôže.']],
      resEb: 'Verdict Lite', band: {
        ready: ['Základy máte', 'Pripravení porovnať partnerov.', 'Veľkosť, dane a úschovu máte pokryté. Porovnajte partnerov, ktorí spĺňajú vaše kritériá, a vyberte si.'],
        gaps: ['Pár medzier', 'Blízko: najprv doplňte jeden či dva body.', 'Väčšinu základov máte. Nižšie je, čo ešte chýba.'],
        basics: ['Chýbajú základy', 'Zatiaľ nie: najprv doplňte základy.', 'Predtým, ako si vyberiete partnera, vyriešte body nižšie. Každý zaberie minúty, nie dni.']
      },
      scoreLine: 'Skóre z vašich 6 odpovedí: veľkosť, dane a úschova, každá po 10 bodov, prepočítané na 100 a zaokrúhlené na 5.',
      sumH: 'Zhrnutie', twoH: 'Najsilnejšie a najslabšie miesto', strongest: 'Najsilnejšie', weakest: 'Najslabšie', bottH: '3 úzke miesta', nextH: 'Váš ďalší krok',
      area: { size: 'Veľkosť', tax: 'Dane', custody: 'Úschova' },
      meaning: {
        size: ['V hre je veľká časť vášho majetku. Pokles o 70 % by zmenil vaše plány.', 'Pokles o 70 % by bolel, ale financie by vám nerozvrátil.', 'Suma je malá oproti vašim úsporám. Pokles o 70 % by vaše plány nezmenil.'],
        tax: ['Zatiaľ neviete, ako sa vo vašej krajine zdaní predaj.', 'Pravidlo poznáte približne. Pred prvým predajom si overte detaily.', 'Viete, ako sa vo vašej krajine zdaní predaj.'],
        custody: ['Nerozhodli ste sa, kto bude držať kľúče.', 'Viete, ako chcete Bitcoin držať. Pred väčšou sumou si vyskúšajte obnovu.', 'Viete, ako chcete mať Bitcoin v úschove.']
      },
      sum: function (a) {
        var out = [];
        out.push(a.amount ? 'Do Bitcoinu chcete dať ' + a.amount + (a.share ? ', čo je ' + a.share + ' vášho majetku' : '') + '.' : (a.share ? 'Ide o ' + a.share + ' vášho majetku.' : 'Sumu ste neuviedli.'));
        if (a.experience) out.push(a.experienceId === 'new' ? 'Bude to váš prvý Bitcoin.' : 'Nejaký Bitcoin už máte.');
        out.push((a.country ? 'Dane platíte v krajine ' + (a.countryId === 'other' ? 'mimo zoznamu' : a.country) : 'Neuviedli ste, kde platíte dane') + (a.taxId === 'yes' ? ' a viete, ako sa zdaní predaj.' : a.taxId === 'roughly' ? ' a pravidlo pre predaj poznáte približne.' : ' a pravidlo pre predaj zatiaľ nepoznáte.'));
        out.push(a.custody ? 'Úschova: ' + a.custody.toLowerCase() + '.' : 'Spôsob úschovy ste nevybrali.');
        return out.join(' ');
      },
      b: {
        taxNo: ['Zistite, ako sa zdaní predaj Bitcoinu v krajine {c}.', 'Sadzba, čas držby a či sa počíta aj výmena kryptomien. Potrebujete to pred prvým predajom, nie po ňom.'],
        taxRough: ['Overte si presné daňové pravidlo pre krajinu {c}.', 'Približne je začiatok. Koľko si necháte, rozhodne oslobodenie a termín priznania.'],
        taxCountry: ['Vyberte krajinu, v ktorej platíte dane.', 'Od nej závisia daňové pravidlá aj partneri, ktorých môžete použiť.'],
        sizeHigh: ['Skontrolujte veľkosť: {s} vášho majetku.', 'Pri poklese o 70 % by zo sumy {a} zostalo {f}. Zvoľte veľkosť, ktorú takým poklesom udržíte.'],
        sizeNa: ['Odhadnite, akú časť majetku to tvorí.', 'Ako veľmi by pokles o 70 % bolel, rozhoduje podiel, nie suma.'],
        amountNa: ['Určte približnú sumu.', 'Pokles o 70 % znamená niečo iné pri 500 € a pri 50 000 €.'],
        custodyAny: ['Rozhodnite, kto bude držať kľúče.', 'Burza, vlastná peňaženka alebo asistovaná úschova: každá má iné riziká a inú obnovu.'],
        custodyNew: ['Najprv si s malou sumou vyskúšajte obnovu peňaženky.', 'Vlastné kľúče pri prvom nákupe: zálohu otestujte skôr, ako vložíte celú sumu.'],
        horizon: ['Rozhodnite, kedy môžete tieto peniaze potrebovať.', 'Lite sa na to nepýtal. Bitcoin môže padnúť o 70 % a roky sa nevrátiť.'],
        reserve: ['Majte mimo Bitcoinu rezervu na 6 mesiacov výdavkov.', 'Lite sa na to nepýtal. Rezerva vám umožní prečkať pokles.'],
        rule: ['Napíšte si, čo urobíte, keď Bitcoin padne o 70 %.', 'Lite sa na to nepýtal. Vopred dané pravidlo je lepšie ako rozhodnutie počas poklesu.']
      },
      tools: { tax: 'Tax Agent', stacking: 'Stacking Strategist', secure: 'Možnosti úschovy', full: 'Celý Verdict (zadarmo)' },
      conH: 'Prejdite si to s človekom', conP: 'Bezplatná 15-minútová konzultácia s Virtuse. Bez predaja.', conBtn: 'Rezervovať bezplatnú konzultáciu',
      repH: 'Celý report', repT: 'Všetkých 10 signálov, nielen 3 oblasti.', repList: ['Všetkých 10 signálov s bodmi a dôvodmi', 'Všetky chýbajúce otázky pre vaše rozhodnutie', 'Plán krokov s nástrojmi Virtuse', 'PDF, ktoré si ponecháte, bez predplatného'],
      once: 'Jednorazovo', price: '14 €', waitNote: 'Platby ešte nespúšťame. Nechajte e-mail a dáme vám vedieť, keď sa report otvorí.',
      wantPh: 'Váš e-mail', wantBtn: 'Zapísať sa na čakaciu listinu', wantOk: 'Ste na zozname. Napíšeme vám raz, keď sa report otvorí.', wantBad: 'Zadajte platný e-mail.',
      wantNote: 'Uložíme len váš e-mail, odpovede nie. Odhlásiť sa môžete jedným kliknutím.', privacy: 'Súkromie', network: 'Chyba siete. Skúste to znova.', error: 'Niečo sa pokazilo. Skúste to o chvíľu.',
      pfH: 'Partneri, ktorí spĺňajú vaše kritériá', pfP: 'Partner Finder sa otvorí s vyplnenými odpoveďami a ukáže partnerov, ktorí spĺňajú vaše kritériá. Poradie určujú pevné pravidlá, nie provízia. Porovnávate a vyberáte vy.',
      pfBtn: 'Otvoriť Partner Finder', pfNote: 'Partnerské odkazy: ak sa zaregistrujete, Virtuse môže dostať províziu, vaša cena sa nemení.',
      fullP: 'Chcete kontrolu na 10 signáloch aj s vlastnými slovami?', fullLink: 'Celý Verdict, zadarmo →',
      again: '↺ Ohodnotiť znova', pdf: 'Uložiť ako PDF',
      legal: 'Verdict Lite je automatická kontrola vašich 6 odpovedí podľa pevných pravidiel; žiadny model AI ich nečíta. Hodnotí, nakoľko máte pokryté základy plánu, nie či kúpiť. Nie je to investičné, daňové ani právne poradenstvo.',
      copy: '© 2018–2026 Virtuse Wealth Management, a.s.',
      heroBtn: 'Získať Verdict Lite →', heroNote: '6 otázok · ~1 minúta · zadarmo'
    }
  }[LANG];

  var KEYS = ['country', 'amount', 'share', 'experience', 'custody_pref', 'tax_known'];
  var PLAN = ['custody_pref', 'tax_known'];
  var DROP = { en: { s: ['under €1,000', 'under €300'], m: ['€1,000 to 10,000', 'about €300 to 3,000'], l: ['€10,000 to 100,000', 'about €3,000 to 30,000'], xl: ['over €100,000', 'over €30,000'] },
    sk: { s: ['menej ako 1 000 €', 'menej ako 300 €'], m: ['1 000 až 10 000 €', 'asi 300 až 3 000 €'], l: ['10 000 až 100 000 €', 'asi 3 000 až 30 000 €'], xl: ['viac ako 100 000 €', 'viac ako 30 000 €'] } }[LANG];
  var TAXC = ['sk', 'cz', 'at', 'de', 'pl', 'hu', 'si', 'hr', 'ro', 'bg', 'nl', 'fr', 'es'];
  var SV = '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CK = '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  var panel = document.getElementById('panel'), back = document.getElementById('back'), stepsEl = document.getElementById('steps');
  if (!panel) return;
  var A = {}, RES = null, i = 0, RET = null;
  var P = window.VBProfile;
  if (P) { var pf = P.get(); KEYS.forEach(function (k) { if (pf[k]) A[k] = pf[k]; }); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function push(o) { o.verdict_mode = 'lite'; (window.dataLayer = window.dataLayer || []).push(o); }
  function label(key, v) { var o = (STR.opts[key] || []).filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : null; }
  function val(k) { return A[k] && A[k] !== 'na' ? A[k] : null; }
  function low(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function save(k) { if (!P) return; var o = {}; o[k] = A[k]; P.set(o); }
  function foot(note, btn) { return '<div class="foot"><span class="note">' + (note || '') + '</span><button class="cta solid" id="c">' + btn + ' ' + SV + '</button></div>'; }

  var SCREENS = [{ s: 0, p: .5, r: start, k: 'start' }];
  KEYS.forEach(function (k) {
    var plan = PLAN.indexOf(k) >= 0, list = plan ? PLAN : KEYS.filter(function (x) { return PLAN.indexOf(x) < 0; });
    SCREENS.push({ s: plan ? 2 : 1, p: (list.indexOf(k) + 1) / list.length, r: q(k), k: k });
  });
  SCREENS.push({ s: 3, p: .5, r: loading, k: 'loading' }, { s: 3, p: 1, r: result, k: 'result' });
  function at(k) { for (var n = 0; n < SCREENS.length; n++) if (SCREENS[n].k === k) return n; return 0; }

  back.textContent = STR.back;
  back.onclick = function () { if (i > 0) go(i === at('result') ? at('tax_known') : i - 1); };
  function stepper() {
    var cur = SCREENS[i];
    stepsEl.innerHTML = '<div class="prog">' + STR.progress + '</div>' + STR.steps.map(function (t, k) {
      var st = k < cur.s ? 'done' : k === cur.s ? 'on' : '', w = k < cur.s ? 100 : k === cur.s ? cur.p * 100 : 0;
      return '<div class="step ' + st + '"><div class="lbl"><span class="n">' + (k < cur.s ? '✓' : k + 1) + '</span><span class="t">' + t + '</span></div><div class="track"><i style="width:' + w + '%"></i></div></div>';
    }).join('');
  }
  function go(n) {
    i = n; back.hidden = i === 0 || i === at('loading'); stepper();
    var root = panel.closest('.vf'); if (root) root.classList.toggle('is-result', SCREENS[i].k === 'result');
    SCREENS[i].r(); spot();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    push({ event: 'verdict_step', verdict_lang: LANG, verdict_step: SCREENS[i].k });
  }
  function next() { if (RET) { var r = RET; RET = null; go(at(r)); } else go(i + 1); }

  function start() {
    panel.innerHTML = '<div class="chip-eyebrow">' + STR.startEb + '</div><h1>' + STR.startH + '</h1><p class="sub">' + STR.startP + '</p><p class="hint">' + STR.startHint + '</p>' + foot(STR.startNote, STR.startBtn);
    document.getElementById('c').onclick = next;
  }
  function q(key) {
    return function () {
      var Q = STR.q[key], O = STR.opts[key], chips = key === 'country';
      var h = '<div class="eyebrow">' + (PLAN.indexOf(key) >= 0 ? STR.plan : STR.about) + '</div><h2>' + Q[0] + '</h2><p class="sub">' + Q[1] + '</p><p class="why">' + Q[2] + '</p>';
      h += chips
        ? '<div class="chips">' + O.map(function (c) { return '<button class="opt' + (A[key] === c[0] ? ' sel' : '') + '" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>'
        : '<div class="opts">' + O.map(function (o) { return '<button class="opt' + (A[key] === o[0] ? ' sel' : '') + '" data-v="' + o[0] + '"><span>' + o[1] + '</span>' + (A[key] === o[0] ? CK : SV) + '</button>'; }).join('') + '</div>';
      panel.innerHTML = h + '<div class="alt"><button class="ghost" data-skip>' + STR.skip + '</button></div>';
      panel.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { A[key] = b.dataset.v; save(key); b.classList.add('sel'); setTimeout(next, 160); }; });
      panel.querySelector('[data-skip]').onclick = function () { A[key] = 'na'; save(key); next(); };
    };
  }
  function loading() {
    var U = STR.unlock;
    panel.innerHTML = '<div class="load"><div class="spin" aria-hidden="true"></div><h2>' + STR.loadH + '</h2><p class="sub" id="ls" aria-live="polite">' + STR.loadSteps[0] + '</p>' +
      '<div class="unlock"><div class="mock" aria-hidden="true"><i style="width:40%"></i><i class="o"></i><i style="width:80%"></i><i style="width:55%"></i></div><div><div class="eyebrow">' + STR.loadGet + '</div>' +
      '<ul class="vl-get">' + U.map(function (u) { return '<li><b>' + u[0] + '</b> ' + u[1] + '</li>'; }).join('') + '</ul></div></div></div>';
    var k = 0, t = setInterval(function () { k++; var e = document.getElementById('ls'); if (e) e.textContent = STR.loadSteps[Math.min(k, STR.loadSteps.length - 1)]; }, 700);
    push({ event: 'verdict_submit', verdict_lang: LANG, verdict_goal: 'buy' });
    setTimeout(function () {
      clearInterval(t); RES = score();
      push({ event: 'verdict_result', verdict_lang: LANG, verdict_band: RES.band, verdict_score: RES.score, verdict_weakest: RES.weak.id });
      next();
    }, 2100);
  }

  // Lite scoring: three areas, 0 to 10 each, from the six answers.
  function score() {
    var share = val('share'), amount = val('amount'), tax = val('tax_known'), cust = val('custody_pref'), exp = val('experience'), country = val('country');
    var size = { lt5: 10, '5_20': 7, '20_50': 4, gt50: 1 }[share]; if (size == null) size = 3;
    if (amount === 'xl' && (share === '20_50' || share === 'gt50')) size = Math.max(0, size - 1);
    var tx = { yes: 10, roughly: 6, no: 2 }[tax]; if (tx == null) tx = 2;
    if (!country) tx = Math.max(0, tx - 1);
    var cu = cust === 'self' ? (exp === 'new' ? 6 : exp === 'hodler' ? 9 : 7) : cust === 'assisted' ? 8 : cust === 'any' ? 4 : 3;
    var areas = [{ id: 'size', p: size }, { id: 'tax', p: tx }, { id: 'custody', p: cu }];
    var sc = Math.round((size + tx + cu) / 30 * 100 / 5) * 5;
    var band = sc >= 80 ? 'ready' : sc >= 55 ? 'gaps' : 'basics';
    var order = areas.slice().sort(function (a, b) { return a.p - b.p; });
    // Bottlenecks: answered gaps first, then what Lite does not ask.
    var cn = country && country !== 'other' ? label('country', country) : null, B = [];
    var taxTool = { name: STR.tools.tax, href: '/tax-agent.html' + (country && TAXC.indexOf(country) >= 0 ? '?country=' + country : '') };
    var lp = LANG === 'sk' ? '/sk/' : '/';
    if (!country) B.push(bn('taxCountry', taxTool));
    else if (tax !== 'yes') B.push(bn(tax === 'roughly' ? 'taxRough' : 'taxNo', taxTool, { c: cn || (LANG === 'sk' ? 'kde platíte dane' : 'your country') }));
    if (!amount) B.push(bn('amountNa', null));
    if (share === 'gt50' || share === '20_50') {
      var d = DROP[amount] || null;
      B.push(bn('sizeHigh', { name: STR.tools.stacking, href: lp + 'stacking.html' }, { s: low(label('share', share)), a: d ? d[0] : (LANG === 'sk' ? 'vašej sumy' : 'your amount'), f: d ? d[1] : (LANG === 'sk' ? 'asi 30 %' : 'about 30%') }));
    } else if (!share) B.push(bn('sizeNa', null));
    if (cust === 'any' || !cust) B.push(bn('custodyAny', { name: STR.tools.secure, href: lp + 'secure.html' }));
    else if (cust === 'self' && exp === 'new') B.push(bn('custodyNew', { name: STR.tools.secure, href: lp + 'secure.html' }));
    var full = { name: STR.tools.full, href: '?mode=full#start' };
    ['horizon', 'reserve', 'rule'].forEach(function (k) { B.push(bn(k, full)); });
    // Only the first gap that came from an answer keeps a tool button per tool; keep the list short.
    B = B.slice(0, 3);
    return { score: sc, band: band, areas: areas, strong: order[2], weak: order[0], steps: B };
  }
  function bn(id, tool, vars) {
    var t = STR.b[id].map(function (s) { return s.replace(/\{(\w)\}/g, function (_, k) { return (vars || {})[k] || ''; }); });
    return { id: id, act: t[0], why: t[1], tool: tool };
  }
  function utm(href, medium) { return href + (href.indexOf('?') < 0 ? '?' : '&') + 'utm_source=verdict&utm_medium=' + medium; }

  function ring(sc, col) {
    var r = 34, c = 2 * Math.PI * r;
    return '<svg class="vf-ring" width="88" height="88" viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="' + r + '" stroke="rgba(255,255,255,.08)" stroke-width="7" fill="none"/>' +
      '<circle cx="44" cy="44" r="' + r + '" stroke="' + col + '" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="' + (c * sc / 100) + ' ' + c + '" transform="rotate(-90 44 44)"/></svg>';
  }
  var COL = { ready: 'var(--teal)', gaps: 'var(--orange)', basics: 'var(--orange)' };
  var ACOL = { size: 'var(--blue)', tax: 'var(--teal)', custody: 'var(--purple)' };
  function areaCard(a, role) {
    var m = STR.meaning[a.id][a.p >= 8 ? 2 : a.p >= 5 ? 1 : 0];
    return '<div class="vf-card area spot" style="--c:' + ACOL[a.id] + '"><div class="h"><div><div class="role">' + role + '</div><b>' + STR.area[a.id] + '</b></div><em>' + a.p + '<small>/10</small></em></div>' +
      '<div class="bar"><i style="width:' + a.p * 10 + '%"></i></div><p>' + m + '</p></div>';
  }
  function pfHref() {
    var q = { pf_goal: 'buy' };
    if (val('country') && val('country') !== 'other') q.pf_country = A.country;
    if (val('experience')) q.pf_experience = A.experience;
    if (val('custody_pref')) q.pf_custody = A.custody_pref;
    if (val('amount')) q.pf_amount = A.amount;
    return (LANG === 'sk' ? '/sk/' : '/') + 'concierge.html?' + Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&') + '&utm_source=verdict&utm_medium=lite';
  }
  function result() {
    var r = RES; if (!r) { go(at('start')); return; }
    var bd = STR.band[r.band], col = COL[r.band];
    var sumA = { amount: val('amount') && low(label('amount', A.amount)), share: val('share') && low(label('share', A.share)), experience: val('experience'), experienceId: A.experience,
      country: val('country') && label('country', A.country), countryId: A.country, taxId: val('tax_known'), custody: val('custody_pref') && label('custody_pref', A.custody_pref) };
    var steps = r.steps.map(function (s, n) {
      return '<li class="vf-card spot' + (n === 0 ? ' first orange' : '') + '"><span class="num">' + (n + 1) + '</span><div><p class="act">' + esc(s.act) + '</p><p class="whyl">' + esc(s.why) + '</p>' +
        (s.tool ? '<div class="vrow"><a class="vf-btn" href="' + esc(utm(s.tool.href, 'lite')) + '" data-step="' + s.id + '">' + esc(s.tool.name) + ' →</a></div>' : '') + '</div></li>';
    }).join('');
    var n1 = r.steps[0];
    panel.innerHTML = '<div class="vx lite">' +
      '<div class="res-head" style="--b:' + col + '"><div><div class="eyebrow"><i></i>' + STR.resEb + '</div><span class="pill">' + bd[0] + '</span>' +
      '<h2 class="verdict">' + bd[1] + '</h2><p class="vwhy">' + bd[2] + '</p></div>' +
      '<div class="score">' + ring(r.score, col) + '<b>' + r.score + '<small>/100</small></b></div></div>' +
      '<p class="small scoreline">' + STR.scoreLine + '</p>' +
      '<div class="sec">' + STR.sumH + '</div><p class="means">' + esc(STR.sum(sumA)) + '</p>' +
      '<div class="sec">' + STR.twoH + '</div><div class="sig2">' + areaCard(r.strong, STR.strongest) + areaCard(r.weak, STR.weakest) + '</div>' +
      '<div class="sec" id="steps3">' + STR.bottH + '</div><ol class="vf-steps">' + steps + '</ol>' +
      '<div class="sec">' + STR.nextH + '</div><div class="vf-card next spot" style="--c:var(--orange)"><p class="act">' + esc(n1.act) + '</p><div class="row">' +
        (n1.tool ? '<a class="vf-btn solid" href="' + esc(utm(n1.tool.href, 'lite_next')) + '" data-step="next">' + esc(n1.tool.name) + ' →</a>' : '') + '</div></div>' +
      '<div class="vf-card consult spot no-print"><b>' + STR.conH + '</b><p>' + STR.conP + '</p><button class="vf-btn solid" data-consult>' + STR.conBtn + ' ' + SV + '</button></div>' +
      '<div class="vf-card price no-print" id="unlock"><div><div class="eyebrow">' + STR.repH + '</div><h3>' + STR.repT + '</h3><ul>' + STR.repList.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>' +
        '<div><span class="small">' + STR.once + '</span><div class="amt">' + STR.price + '</div><p class="small">' + STR.waitNote + '</p>' + wantForm() + '</div></div>' +
      '<div class="sec no-print" id="partners">' + STR.pfH + '</div><div class="vf-card spot no-print"><p>' + STR.pfP + '</p><a class="vf-btn" href="' + esc(pfHref()) + '" data-step="partners">' + STR.pfBtn + ' →</a><p class="small">' + STR.pfNote + '</p></div>' +
      '<p class="sub sm no-print" style="margin-top:22px">' + STR.fullP + ' <a href="?mode=full#start" data-full>' + STR.fullLink + '</a></p>' +
      '<p class="small" style="margin-top:22px">' + STR.legal + '</p><p class="small">' + STR.copy + '</p>' +
      '<div class="foot no-print" style="margin-top:18px"><button class="vf-btn" data-again>' + STR.again + '</button><button class="vf-btn solid" data-pdf>' + STR.pdf + '</button></div></div>';
    panel.querySelector('[data-consult]').onclick = function () {
      push({ event: 'consultation_click', verdict_lang: LANG, verdict_band: r.band, tier: 'lite' });
      if (window.VirtuseConsultation) window.VirtuseConsultation.open(LANG);
    };
    panel.querySelector('[data-again]').onclick = function () { RES = null; go(at('country')); };
    panel.querySelector('[data-pdf]').onclick = function () { push({ event: 'verdict_pdf', verdict_lang: LANG }); window.print(); };
    panel.querySelectorAll('[data-step]').forEach(function (b) { b.addEventListener('click', function () { push({ event: 'verdict_step_click', verdict_lang: LANG, step: b.dataset.step }); }); });
    var fl = panel.querySelector('[data-full]'); if (fl) fl.addEventListener('click', function () { push({ event: 'verdict_full_click', verdict_lang: LANG }); });
    bindWant();
    push({ event: 'verdict_complete', verdict_lang: LANG, tier: 'lite', verdict_band: r.band, verdict_score: r.score, verdict_goal: 'buy' });
  }

  function wantForm() {
    return '<form class="want" id="want" novalidate><input type="email" id="we" autocomplete="email" placeholder="' + STR.wantPh + '" aria-label="' + STR.wantPh + '" required>' +
      '<input type="text" id="wh" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">' +
      '<button class="vf-btn" type="submit">' + STR.wantBtn + '</button><p class="small" id="wm" aria-live="polite">' + STR.wantNote + ' <a href="privacy-policy.html#verdict-cfo">' + STR.privacy + '</a></p></form>';
  }
  function bindWant() {
    var f = document.getElementById('want'); if (!f) return;
    var done = false; try { done = sessionStorage.getItem('vb-want-ok') === '1'; } catch (e) {}
    if (done) { f.innerHTML = '<p class="sub sm" style="color:var(--text)">' + STR.wantOk + '</p>'; return; }
    f.onsubmit = function (e) {
      e.preventDefault();
      var em = document.getElementById('we').value.trim(), msg = document.getElementById('wm'), btn = f.querySelector('button');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { msg.textContent = STR.wantBad; return; }
      btn.disabled = true;
      push({ event: 'unlock_click', verdict_lang: LANG, via: 'form' });
      vbApi().then(function (api) { return api.postJson('/waitlist', { email: em, hp: document.getElementById('wh').value, source: 'verdict_report', lang: LANG }); })
        .then(function (r) { return { ok: r.ok, d: r.data }; })
        .catch(function () { return { ok: false, d: { error: STR.network } }; })
        .then(function (x) {
          if (x.ok) {
            f.innerHTML = '<p class="sub sm" style="color:var(--text)">' + STR.wantOk + '</p>';
            try { sessionStorage.setItem('vb-want-ok', '1'); } catch (e) {}
            push({ event: 'capture_submit', capture_source: 'verdict_report', verdict_lang: LANG });
          } else { btn.disabled = false; msg.textContent = (x.d && x.d.error) || STR.error; }
        });
    };
  }

  function spot() {
    panel.querySelectorAll('.spot, .opt').forEach(function (c) {
      if (c.dataset.spot) return; c.dataset.spot = '1';
      var raf = 0, px = 0, py = 0; c.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(function () { raf = 0; c.classList.add('pm'); var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (px - r.left) + 'px'); c.style.setProperty('--my', (py - r.top) + 'px'); }); }, { passive: true });
      c.addEventListener('pointerleave', function () { if (raf) { cancelAnimationFrame(raf); raf = 0; } c.classList.remove('pm'); });
    });
  }

  // Landing hero (verdict.html VL block): Lite has no free text, so the hero
  // form becomes a plain start button.
  var ask = document.getElementById('vlAsk');
  if (ask) {
    ask.classList.add('vl-lite');
    var bt = ask.querySelector('button[type=submit]'); if (bt) bt.textContent = STR.heroBtn;
    var msg = document.getElementById('vlMsg'); if (msg) { msg.textContent = STR.heroNote; msg.removeAttribute('data-short'); }
    ask.addEventListener('submit', function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      document.documentElement.classList.add('vl-app'); try { sessionStorage.setItem('vb-vl-app', '1'); } catch (x) {}
      history.replaceState(null, '', location.pathname + location.search + '#start');
      push({ event: 'verdict_start', verdict_lang: LANG, source: 'hero' });
      go(at('country')); window.scrollTo(0, 0);
    }, true);
  }
  window.vfSkipIntro = function () { if (i === 0) next(); };
  window.vfStartWithText = function () { go(at('country')); };

  var src = (location.search.match(/[?&]utm_source=([\w-]+)/) || [])[1] || 'direct';
  push({ event: 'verdict_start', verdict_lang: LANG, source: src });
  go(0);
})();
