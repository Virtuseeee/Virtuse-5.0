// The paid Verdict Lite report (€14): one view object built from the stored
// answers by fixed rules, no AI. Pure. The page (verdict-lite.js) and the PDF
// (verdict-pay/pdf.js) both print this object, so they never differ.
//
// Rates how ready the plan is. It never says whether to buy or sell, and no
// step tells anyone to buy. Country tax lines come from lite-tax.js, the same
// source as the tax pages.

import TAX from '../../generated/lite-tax.js';
import { reportBlocks } from './blocks.js';
import { bandIndex, calc, gapIds, grade, worryTargets } from './rules.js';

const NBSP = ' ';
const group = (n, sep) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
const FMT = {
  en: { eur: (n) => `€${group(n, ',')}`, pct: (n) => `${Math.round(n)}%` },
  sk: { eur: (n) => `${group(n, NBSP)}${NBSP}€`, pct: (n) => `${Math.round(n)}${NBSP}%` },
};

const COPY = {
  en: {
    title: (n) => (n ? `${n}'s Bitcoin plan check` : 'Your Bitcoin plan check'),
    kicker: 'Full report',
    age: (a) => String(a),
    taxIn: (c) => (c ? `tax in ${c}` : 'tax elsewhere'),
    exp: { hodler: 'already holding Bitcoin', new: 'first purchase', sceptic: 'still sceptical' },
    keys: { self: 'own keys', assisted: 'own keys, with help', any: 'custody still open' },
    worriedAbout: 'worried about',
    worry: { tax: 'tax', keys: 'losing keys', crash: 'a crash', heirs: 'heirs', scams: 'scams', fees: 'fees', partner: 'picking a partner', retire: 'retirement' },
    n: {
      savings: 'Savings, without home', planned: 'Planned for Bitcoin', share: (p) => `${p} of savings`, after: 'After a 70% fall', left: (r) => `${r} left`, monthly: 'Monthly addition',
      perYear: (m, y) => `${m} · ${y} a year`, noMonthly: 'None planned', reserve: 'Cash reserve', retire: 'Retirement',
      retired: (s, age, y) => `${s ? `${s} saved · ` : ''}at ${age}, in ${y} ${y === 1 ? 'year' : 'years'}`, retireNa: 'Age not given', home: 'Home',
      homeOwn: (v) => (v ? `${v} · no mortgage` : 'Owned, no mortgage'), homeMort: (v, m, p) => (v ? `${v} · ${m} mortgage (${p})` : `${m} mortgage`), homeRent: 'Rented', homeOther: 'Other',
      debts: 'Other debts', debt: { none: 'None', lt10: 'Under €10,000', gt10: 'Over €10,000' },
    },
    reserveShort: { '6p': '6 months or more', '3_6': '3 to 6 months', '1_3': '1 to 3 months', lt1: 'under 1 month' },
    reserveNum: { '6p': '6 months or more · target met', '3_6': '3 to 6 months · target 6', '1_3': '1 to 3 months · target 6', lt1: 'Under 1 month · target 6' },
    scale: ['Basics missing', 'A few gaps', 'Basics in place'],
    gradeLine: (g) => `Grade ${g} · plan readiness`,
    pill: (g, b) => `${g} · ${b}`,
    h: {
      summaryK: 'Plain-English summary', areasK: 'Area by area', areas: (t) => `Where the ${t} points come from`, area: 'Area', points: 'Points', why: 'Why',
      fallK: 'A 70% fall', fall: 'What it means in euros', custodyK: 'Custody', custody: 'Your custody options side by side',
      taxK: (c) => (c ? `Tax in ${c}` : 'Tax'), tax: 'The sale rule in plain words', bothK: 'Both sides', both: 'What can go wrong, and what is already solid', wrong: 'What can go wrong', solid: 'Already solid',
      planK: 'Your plan', plan: '3 steps for this week', nextK: 'Next on Virtuse', next: 'Put the plan to work',
    },
    area: { size: 'Size', reserve: 'Reserve', debt: 'Debts', tax: 'Tax', custody: 'Custody', fall: 'Behaviour in a fall' },
    why: {
      sizeNa: 'You gave no savings, so the size could not be checked.',
      size: (p, r, b) => `${p} of savings. A 70% fall leaves ${r} of ${b}.`,
      sizeNear: ' Retirement is under 10 years away, which takes 2 points off.',
      reserve: { '6p': '6 months or more of cash outside Bitcoin.', '3_6': '3 to 6 months of cash. The target is 6.', '1_3': '1 to 3 months of cash. A fall could force a sale.', lt1: 'Under 1 month of cash. A fall could force a sale.' },
      debt: { none: 'No consumer debt.', lt10: 'Under €10,000 of consumer debt.', gt10: 'Over €10,000 of consumer debt.' },
      mort: (p) => `Mortgage at ${p} of the home value.`,
      mortHeavy: (p) => `Mortgage at ${p} of the home value, which takes 3 points off.`,
      tax: { yes: 'You know how a sale is taxed in your country.', roughly: 'You know the rule roughly. Details are still open before the first sale.', no: 'You do not know yet how a sale is taxed.' },
      custody: { selfNew: 'Own keys chosen. Recovery not practised yet.', self: 'Own keys, and you already hold Bitcoin. A tested backup is the last point.', assisted: 'Assisted custody: you get help with keys and recovery.', any: 'You have not decided who holds the keys.' },
      fall: { more: 'You would buy more at a lower price, not sell.', wait: 'You would wait, not sell.', sell: 'You would sell some or all to stop the loss.' },
    },
    sum: {
      lead: (n) => (n ? `${n}, ` : ''),
      sizeOk: 'your plan has a sound size.', sizeBig: 'your plan is large for your savings.', sizeHuge: 'most of your savings would be at stake.', sizeNa: 'the size of your plan could not be checked, because you gave no savings.',
      math: (b, p, r, ok) => `${b} is ${p} of your savings: after a 70% fall ${r} would be left, ${ok ? 'which would hurt but not break your finances.' : 'which would change your plans.'}`,
      debt: { none: 'You have no debts', noneMort: 'You have no debts besides the mortgage', lt10: 'You have under €10,000 of consumer debt', gt10: 'You have over €10,000 of consumer debt' },
      fall: { wait: ', and you said you would wait in a fall rather than sell.', more: ', and you said you would buy more in a fall rather than sell.', sell: ', and you said you would sell in a fall, which turns a paper loss into a real one.' },
      open: (n, w) => `${n === 2 ? 'Two details are' : 'Three details are'} open${w === 0 ? '.' : w === 1 ? ', and one of them is what you worry about.' : w === 2 ? ', and two of them are what you worry about.' : ', and all three are what you worry about.'}`,
    },
    gapLine: {
      tax: (c) => `The sale rule ${c ? `in ${c} ` : ''}is set out below, and records matter from the first purchase.`,
      size: (r) => (r ? `Decide what a fall to ${r} would mean for you.` : 'Decide what a 70% fall would mean for you.'),
      reserve: (res) => `Your cash reserve is ${res}; 6 months gives a fall less power over you.`,
      debt: () => 'Consumer debt comes first: its interest usually costs more than you can plan to earn.',
      mortgage: () => 'More than 80% of your home value is still owed, so the payments should not depend on the Bitcoin price.',
      fall: () => 'You said you would sell in a fall; decide now, in one line, what you will do at −70%.',
      keys: () => 'With own keys, the backup is the part that most often goes wrong.',
      custody: () => 'You have not decided who holds the keys, so you cannot compare the partners that fit yet.',
      recovery: () => 'Agree what happens if a key is lost before larger amounts go in.',
      retire: (y) => `You plan to retire in ${y} years; money you need soon should not depend on the Bitcoin price.`,
      heirs: () => 'Without instructions, heirs often never find Bitcoin.',
      records: () => 'A simple record of every purchase makes every later tax return easy.',
    },
    fall: {
      none: 'You entered no amount for Bitcoin, so there is nothing to show in euros yet.',
      main: (b, r, l) => `Bitcoin has fallen 70% or more several times. On ${b} that leaves ${r}: a paper loss of ${l}.`,
      share: (p) => `That is ${p} of the savings you gave.`,
      thin: (res) => `With ${res} of cash, a fall could force a sale if your income stops.`,
      ok: (res) => `With ${res} of cash outside Bitcoin, a fall alone should not force a sale.`,
      debt: 'Over €10,000 of consumer debt would have to be paid on top, whatever the price does.',
      monthly: (m) => `Your ${m} a month should never come out of your reserve.`,
    },
    custodyTable: {
      head: ['', 'Own keys', 'Assisted custody'],
      rows: [
        ['Who holds the keys', 'You, on a hardware wallet', 'You and a provider (multisig)'],
        ['If you lose the backup', 'Nobody can restore it', 'The provider helps you recover'],
        ['What you pay', 'A one-off device price', 'A fee set by the provider'],
        ['Fits when', 'You practise the recovery first', 'You want help with recovery and heirs'],
      ],
      yours: { self: 'You chose own keys. The recovery test in your plan is the part to do before larger amounts go in.', assisted: 'You chose assisted custody. Ask your provider how recovery works before larger amounts go in.', any: 'You have not decided yet. This table is the decision to make.' },
    },
    tax: {
      gain: 'Tax on a gain', levy: 'Also payable', exempt: 'Exemption', filing: 'Tax return', note: 'Worth knowing',
      asOf: (q) => `Indicative, as shown in the Virtuse Tax Agent (${q}). Check with a tax adviser before you file.`,
      other: 'Your country is not among the 13 we cover. Ask a tax adviser how a sale and a swap between coins are taxed where you live, and keep a record of every purchase from day one.',
    },
    risk: {
      tax: ['A tax surprise', 'Without records from day one, the first sale is guesswork. See the sale rule above.'],
      keys: ['A lost backup', 'On own keys, a recovery phrase written once and never tested is the usual failure.'],
      custody: ['No decision on keys', 'Without one, you can end up where the first app puts you, not where you meant to be.'],
      recovery: ['An unclear recovery', 'If you learn the process only when a key is gone, it is too late to compare.'],
      reserve: ['A forced sale', 'With a thin reserve, a lost income during a fall can force a sale at the worst moment.'],
      debt: ['Debts during a fall', 'Payments continue whatever the price does, and they can push you to sell.'],
      mortgage: ['A heavy mortgage', 'More than 80% of your home value is owed, so a fall could meet a tight budget.'],
      fall: ['Selling at the bottom', 'You said you would sell. A rule written now is easier to follow than a decision made during a fall.'],
      retire: ['Too little time to recover', 'With retirement under 10 years away, a long fall may not end before you need the money.'],
      heirs: ['Your family not finding it', 'Without instructions, heirs often never find Bitcoin.'],
      records: ['Missing records', 'A tax return without purchase dates and prices is slow and uncertain.'],
      fall70: (b, r) => ['A 70% fall', b ? `Bitcoin has fallen 70% or more several times. On ${b} that leaves about ${r}.` : 'Bitcoin has fallen 70% or more several times.'],
    },
    solid: {
      size: (p) => ['A sensible size', `${p} of your savings. A fall would hurt, not break your plans.`],
      custody: { self: ['Custody decided', 'You know you want your own keys, so you can compare the right partners.'], assisted: ['Custody decided', 'You want help with keys and recovery, so you can compare the right partners.'] },
      debt: { none: ['No consumer debt', 'Nothing forces you to sell in a fall.'], lt10: ['Small debts', 'Under €10,000 besides any mortgage.'] },
      reserve: ['A cash reserve', 'You could live from cash for months without touching Bitcoin.'],
      fall: ['Calm in a fall', 'You said you would not sell in a fall.'],
      tax: ['The tax rule', 'You know how a sale is taxed in your country.'],
      none: 'Nothing here yet. The three steps below are where it starts.',
    },
    step: {
      tax: (c) => [`Check the sale rule${c ? ` in ${c}` : ''}`, c ? `Open Tax Agent with ${c} filled in. About 10 minutes. Start a simple record of every purchase.` : 'Ask a tax adviser how a sale and a swap are taxed where you live. Start a simple record of every purchase.'],
      size: (b, r) => ['Size the position to a 70% fall', b ? `Write down what ${r} left of ${b} would mean for your plans, and decide what size you could live with.` : 'Write down what a 70% fall would mean for your plans, and decide what size you could live with.'],
      reserve: (res) => ['Build a 6-month cash reserve', `You have ${res}. Keep the cash outside Bitcoin, so a fall never forces you to sell at the bottom.`],
      debt: () => ['List your debts and their interest', 'One line per loan, with its rate. Card and consumer-loan interest usually costs more than you can plan to earn.'],
      mortgage: () => ['Keep the mortgage safe in a fall', 'Work out how many months of payments you hold in cash. They should never depend on the Bitcoin price.'],
      fall: () => ['Write one rule for a fall', 'You said you would sell. Decide now, in one line, what you will do at −70%. The form is under Documents.'],
      keys: () => ['Practise a recovery with €20', 'Set up the hardware wallet, send a small amount, wipe it and restore it from the backup, before larger amounts go in. The checklist is under Documents.'],
      custody: () => ['Decide who holds the keys', 'Use the table above. Once you decide, Partner Finder can show the partners that match.'],
      recovery: () => ['Agree the recovery steps with your provider', 'Ask what happens if you lose a key and how long recovery takes, before larger amounts go in.'],
      retire: (y) => ['Keep retirement money out of Bitcoin’s swings', `You plan to retire in ${y} years. Mark what you will need in the next years and keep it outside Bitcoin.`],
      heirs: () => ['Tell one person how to find your Bitcoin', 'Write down where the instructions are, never the recovery phrase itself, and tell one person you trust. The letter is under Documents.'],
      records: () => ['Keep a record of every purchase', 'Date, amount and price in one simple table, under Documents. It makes every later tax return easy.'],
      review: () => ['Check the plan again in a year', 'Your answers leave no big gap today. Run Verdict again once a year, or when your savings change.'],
    },
    tool: { tax: 'Tax Agent', custody: 'Custody guide', finder: 'Partner Finder', retire: 'Retirement Calculator', returns: 'Asset Returns', videos: 'Bitcoin videos', books: 'Bitcoin books', verdict: 'Verdict' },
    next: {
      tax: (c) => (c ? `${c}, filled in →` : 'Pick a country →'), free: 'Free', finder: 'Partners that match →', compare: 'You compare and choose', retire: 'Your own assumptions →', returns: 'Year by year since 2016 →', videos: 'Channels and talks →', books: 'What to read →',
    },
    sent: 'A PDF copy is on its way to the email you paid with. This page stays open for 30 minutes.',
    download: 'Download PDF',
    legal: 'Verdict checks your answers by fixed rules and is not investment, tax or legal advice. Partners are listed because they match the criteria, not ranked; Virtuse may receive a referral fee.',
  },
  sk: {
    title: (n) => (n ? `Plán Bitcoinu: ${n}` : 'Váš plán Bitcoinu'),
    kicker: 'Celý report',
    age: (a) => `${a} ${a === 1 ? 'rok' : a < 5 && a > 1 ? 'roky' : 'rokov'}`,
    taxIn: (c) => (c ? `dane ${c}` : 'dane v inej krajine'),
    exp: { hodler: 'Bitcoin už držíte', new: 'prvý nákup', sceptic: 'zatiaľ skepsa' },
    keys: { self: 'vlastné kľúče', assisted: 'vlastné kľúče s pomocou', any: 'úschova otvorená' },
    worriedAbout: 'trápi vás',
    worry: { tax: 'dane', keys: 'strata kľúčov', crash: 'prepad', heirs: 'dedičia', scams: 'podvody', fees: 'poplatky', partner: 'výber partnera', retire: 'dôchodok' },
    n: {
      savings: 'Úspory bez bývania', planned: 'Plánujete do Bitcoinu', share: (p) => `${p} úspor`, after: 'Po poklese o 70 %', left: (r) => `zostane ${r}`, monthly: 'Mesačne pridáte',
      perYear: (m, y) => `${m} · ${y} ročne`, noMonthly: 'Neplánujete', reserve: 'Rezerva v hotovosti', retire: 'Dôchodok',
      retired: (s, age, y) => `${s ? `${s} úspor · ` : ''}v ${age} rokoch, o ${y} ${y === 1 ? 'rok' : y > 1 && y < 5 ? 'roky' : 'rokov'}`, retireNa: 'Vek ste neuviedli', home: 'Bývanie',
      homeOwn: (v) => (v ? `${v} · bez hypotéky` : 'Vlastné, bez hypotéky'), homeMort: (v, m, p) => (v ? `${v} · hypotéka ${m} (${p})` : `hypotéka ${m}`), homeRent: 'Prenájom', homeOther: 'Iné',
      debts: 'Iné dlhy', debt: { none: 'Žiadne', lt10: 'Do 10 000 €', gt10: 'Nad 10 000 €' },
    },
    reserveShort: { '6p': '6 mesiacov a viac', '3_6': '3 až 6 mesiacov', '1_3': '1 až 3 mesiace', lt1: 'menej ako 1 mesiac' },
    reserveNum: { '6p': '6 mesiacov a viac · cieľ splnený', '3_6': '3 až 6 mesiacov · cieľ 6', '1_3': '1 až 3 mesiace · cieľ 6', lt1: 'Menej ako 1 mesiac · cieľ 6' },
    scale: ['Chýbajú základy', 'Pár medzier', 'Základy máte'],
    gradeLine: (g) => `Známka ${g} · pripravenosť plánu`,
    pill: (g, b) => `${g} · ${b}`,
    h: {
      summaryK: 'Zhrnutie', areasK: 'Oblasť po oblasti', areas: (t) => `Odkiaľ je ${t} bodov`, area: 'Oblasť', points: 'Body', why: 'Prečo',
      fallK: 'Pokles o 70 %', fall: 'Čo to znamená v eurách', custodyK: 'Úschova', custody: 'Možnosti úschovy vedľa seba',
      taxK: (c) => (c ? `Dane ${c}` : 'Dane'), tax: 'Pravidlo predaja jednoducho', bothK: 'Obe strany', both: 'Čo sa môže pokaziť a čo už máte', wrong: 'Čo sa môže pokaziť', solid: 'Už máte',
      planK: 'Váš plán', plan: '3 kroky na tento týždeň', nextK: 'Ďalej na Virtuse', next: 'Plán do praxe',
    },
    area: { size: 'Veľkosť', reserve: 'Rezerva', debt: 'Dlhy', tax: 'Dane', custody: 'Úschova', fall: 'Správanie pri poklese' },
    why: {
      sizeNa: 'Neuviedli ste úspory, takže veľkosť sa nedala posúdiť.',
      size: (p, r) => `${p} úspor. Po poklese o 70 % zostane ${r}.`,
      sizeNear: ' Do dôchodku máte menej ako 10 rokov, preto sú 2 body dole.',
      reserve: { '6p': '6 mesiacov a viac v hotovosti mimo Bitcoinu.', '3_6': '3 až 6 mesiacov v hotovosti. Cieľ je 6.', '1_3': '1 až 3 mesiace v hotovosti. Pokles by vás mohol prinútiť predať.', lt1: 'Menej ako 1 mesiac v hotovosti. Pokles by vás mohol prinútiť predať.' },
      debt: { none: 'Žiadne spotrebné dlhy.', lt10: 'Spotrebné dlhy do 10 000 €.', gt10: 'Spotrebné dlhy nad 10 000 €.' },
      mort: (p) => `Hypotéka na ${p} hodnoty bývania.`,
      mortHeavy: (p) => `Hypotéka na ${p} hodnoty bývania, preto sú 3 body dole.`,
      tax: { yes: 'Viete, ako sa vo vašej krajine zdaní predaj.', roughly: 'Pravidlo poznáte približne. Pred prvým predajom treba doriešiť detaily.', no: 'Zatiaľ neviete, ako sa zdaní predaj.' },
      custody: { selfNew: 'Zvolené vlastné kľúče. Obnova ešte nie je vyskúšaná.', self: 'Vlastné kľúče a Bitcoin už držíte. Posledný bod je vyskúšaná záloha.', assisted: 'Asistovaná úschova: s kľúčmi a obnovou vám pomáhajú.', any: 'Ešte ste sa nerozhodli, kto bude držať kľúče.' },
      fall: { more: 'Prikúpili by ste za nižšiu cenu, nepredávali.', wait: 'Počkali by ste, nepredávali.', sell: 'Predali by ste časť alebo všetko, aby ste zastavili stratu.' },
    },
    sum: {
      lead: (n) => (n ? `${n}, ` : ''),
      sizeOk: 'váš plán má rozumnú veľkosť.', sizeBig: 'váš plán je na vaše úspory veľký.', sizeHuge: 'v hre by bola väčšina vašich úspor.', sizeNa: 'veľkosť plánu sa nedala posúdiť, lebo ste neuviedli úspory.',
      math: (b, p, r, ok) => `${b} je ${p} vašich úspor: po poklese o 70 % by zostalo ${r}, ${ok ? 'čo by bolelo, ale vaše financie by to nezničilo.' : 'čo by zmenilo vaše plány.'}`,
      debt: { none: 'Nemáte dlhy', noneMort: 'Okrem hypotéky nemáte dlhy', lt10: 'Máte spotrebné dlhy do 10 000 €', gt10: 'Máte spotrebné dlhy nad 10 000 €' },
      fall: { wait: ' a uviedli ste, že pri poklese by ste počkali, nie predávali.', more: ' a uviedli ste, že pri poklese by ste prikúpili, nie predávali.', sell: ' a uviedli ste, že pri poklese by ste predali, čím sa strata na papieri zmení na skutočnú.' },
      open: (n, w) => `Otvorené ${n === 2 ? 'sú dva detaily' : 'sú tri detaily'}${w === 0 ? '.' : w === 1 ? ' a jeden z nich je presne to, čo vás trápi.' : w === 2 ? ' a dva z nich sú presne tie, ktoré vás trápia.' : ' a všetky sú presne tie, ktoré vás trápia.'}`,
    },
    gapLine: {
      tax: (c) => `Pravidlo predaja ${c ? `${c} ` : ''}nájdete nižšie a záznamy sú dôležité od prvého nákupu.`,
      size: (r) => (r ? `Rozhodnite sa, čo by pre vás znamenal pokles na ${r}.` : 'Rozhodnite sa, čo by pre vás znamenal pokles o 70 %.'),
      reserve: (res) => `Vaša rezerva je ${res}; so 6 mesiacmi má pokles nad vami menšiu moc.`,
      debt: () => 'Spotrebné dlhy sú prvé na rade: ich úroky zvyčajne stoja viac, než môžete rozumne plánovať zarobiť.',
      mortgage: () => 'Dlhujete viac ako 80 % hodnoty bývania, preto splátky nesmú závisieť od ceny Bitcoinu.',
      fall: () => 'Uviedli ste, že pri poklese by ste predali; rozhodnite sa teraz, jednou vetou, čo urobíte pri −70 %.',
      keys: () => 'Pri vlastných kľúčoch sa najčastejšie pokazí záloha.',
      custody: () => 'Ešte ste sa nerozhodli, kto bude držať kľúče, takže zatiaľ nemôžete porovnať partnerov, ktorí vám vyhovujú.',
      recovery: () => 'Dohodnite si, čo sa stane pri strate kľúča, skôr než pôjdu do hry väčšie sumy.',
      retire: (y) => `Do dôchodku plánujete ísť o ${y} ${y === 1 ? 'rok' : y > 1 && y < 5 ? 'roky' : 'rokov'}; peniaze, ktoré budete čoskoro potrebovať, nesmú závisieť od ceny Bitcoinu.`,
      heirs: () => 'Bez pokynov dedičia Bitcoin často nikdy nenájdu.',
      records: () => 'Jednoduchý záznam každého nákupu uľahčí každé neskoršie daňové priznanie.',
    },
    fall: {
      none: 'Neuviedli ste sumu do Bitcoinu, takže zatiaľ nie je čo ukázať v eurách.',
      main: (b, r, l) => `Bitcoin už viackrát klesol o 70 % a viac. Pri sume ${b} by zostalo ${r}: strata na papieri ${l}.`,
      share: (p) => `To je ${p} úspor, ktoré ste uviedli.`,
      thin: (res) => `S rezervou ${res} by vás pokles mohol prinútiť predať, ak by ste prišli o príjem.`,
      ok: (res) => `S rezervou ${res} mimo Bitcoinu by vás samotný pokles nemal prinútiť predať.`,
      debt: 'Spotrebné dlhy nad 10 000 € by ste museli splácať bez ohľadu na cenu.',
      monthly: (m) => `Mesačná suma ${m} by nikdy nemala ísť z rezervy.`,
    },
    custodyTable: {
      head: ['', 'Vlastné kľúče', 'Asistovaná úschova'],
      rows: [
        ['Kto drží kľúče', 'Vy, na hardvérovej peňaženke', 'Vy a poskytovateľ (multisig)'],
        ['Ak stratíte zálohu', 'Nikto ju neobnoví', 'Poskytovateľ vám pomôže s obnovou'],
        ['Čo platíte', 'Jednorazovo cenu zariadenia', 'Poplatok podľa poskytovateľa'],
        ['Hodí sa, keď', 'si najprv vyskúšate obnovu', 'chcete pomoc s obnovou a dedením'],
      ],
      yours: { self: 'Zvolili ste vlastné kľúče. Skúška obnovy z vášho plánu patrí pred väčšie sumy.', assisted: 'Zvolili ste asistovanú úschovu. Pred väčšími sumami sa poskytovateľa opýtajte, ako funguje obnova.', any: 'Ešte ste sa nerozhodli. Táto tabuľka je rozhodnutie, ktoré máte pred sebou.' },
    },
    tax: {
      gain: 'Daň zo zisku', levy: 'Navyše', exempt: 'Oslobodenie', filing: 'Priznanie', note: 'Dobré vedieť',
      asOf: (q) => `Orientačne, podľa Tax Agenta od Virtuse (${q}). Pred podaním priznania sa poraďte s daňovým poradcom.`,
      other: 'Vaša krajina nie je medzi 13, ktoré pokrývame. Opýtajte sa daňového poradcu, ako sa u vás zdaňuje predaj a výmena kryptomien, a od prvého dňa si zapisujte každý nákup.',
    },
    risk: {
      tax: ['Daňové prekvapenie', 'Bez záznamov od prvého dňa je prvý predaj hádanka. Pravidlo predaja je vyššie.'],
      keys: ['Stratená záloha', 'Pri vlastných kľúčoch je najčastejšou chybou fráza na obnovu zapísaná raz a nikdy nevyskúšaná.'],
      custody: ['Nerozhodnuté kľúče', 'Bez rozhodnutia môžete skončiť tam, kam vás dá prvá aplikácia, nie tam, kde ste chceli byť.'],
      recovery: ['Nejasná obnova', 'Ak postup zistíte až po strate kľúča, na porovnanie je neskoro.'],
      reserve: ['Nútený predaj', 'S tenkou rezervou vás strata príjmu počas poklesu môže prinútiť predať v najhoršej chvíli.'],
      debt: ['Dlhy počas poklesu', 'Splátky pokračujú bez ohľadu na cenu a môžu vás tlačiť k predaju.'],
      mortgage: ['Vysoká hypotéka', 'Dlhujete viac ako 80 % hodnoty bývania, takže pokles môže prísť v napätom rozpočte.'],
      fall: ['Predaj na dne', 'Uviedli ste, že by ste predali. Pravidlo napísané teraz sa dodržiava ľahšie než rozhodnutie uprostred poklesu.'],
      retire: ['Málo času na zotavenie', 'Do dôchodku máte menej ako 10 rokov, takže dlhý pokles sa nemusí skončiť skôr, než budete peniaze potrebovať.'],
      heirs: ['Rodina ho nenájde', 'Bez pokynov dedičia Bitcoin často nikdy nenájdu.'],
      records: ['Chýbajúce záznamy', 'Daňové priznanie bez dátumov a cien nákupov je pomalé a neisté.'],
      fall70: (b, r) => ['Pokles o 70 %', b ? `Bitcoin už viackrát klesol o 70 % a viac. Pri sume ${b} by zostalo asi ${r}.` : 'Bitcoin už viackrát klesol o 70 % a viac.'],
    },
    solid: {
      size: (p) => ['Rozumnú veľkosť', `${p} vašich úspor. Pokles by bolel, ale plány by nezničil.`],
      custody: { self: ['Rozhodnutú úschovu', 'Viete, že chcete vlastné kľúče, takže porovnáte správnych partnerov.'], assisted: ['Rozhodnutú úschovu', 'Chcete pomoc s kľúčmi a obnovou, takže porovnáte správnych partnerov.'] },
      debt: { none: ['Žiadne spotrebné dlhy', 'Nič vás pri poklese nenúti predávať.'], lt10: ['Malé dlhy', 'Do 10 000 € okrem prípadnej hypotéky.'] },
      reserve: ['Rezervu v hotovosti', 'Mesiace by ste vyžili z hotovosti bez toho, aby ste siahli na Bitcoin.'],
      fall: ['Pokoj pri poklese', 'Uviedli ste, že by ste pri poklese nepredávali.'],
      tax: ['Daňové pravidlo', 'Viete, ako sa vo vašej krajine zdaní predaj.'],
      none: 'Zatiaľ nič. Začína sa to troma krokmi nižšie.',
    },
    step: {
      tax: (c, inC) => [`Overte si pravidlo predaja${inC ? ` ${inC}` : ''}`, c ? `Otvorte Tax Agenta s vyplnenou krajinou ${c}. Asi 10 minút. Začnite si jednoducho zapisovať každý nákup.` : 'Opýtajte sa daňového poradcu, ako sa u vás zdaňuje predaj a výmena. Začnite si jednoducho zapisovať každý nákup.'],
      size: (b, r) => ['Nastavte veľkosť tak, aby ste zvládli pokles o 70 %', b ? `Zapíšte si, čo by pre vaše plány znamenalo, keby zo sumy ${b} zostalo ${r}, a rozhodnite sa, s akou veľkosťou viete žiť.` : 'Zapíšte si, čo by pre vaše plány znamenal pokles o 70 %, a rozhodnite sa, s akou veľkosťou viete žiť.'],
      reserve: (res) => ['Vytvorte si rezervu na 6 mesiacov', `Teraz máte ${res}. Hotovosť držte mimo Bitcoinu, aby vás pokles nikdy neprinútil predávať na dne.`],
      debt: () => ['Spíšte si dlhy a ich úroky', 'Jeden riadok na úver, so sadzbou. Úroky z kariet a spotrebných úverov zvyčajne stoja viac, než môžete rozumne plánovať zarobiť.'],
      mortgage: () => ['Chráňte hypotéku pred poklesom', 'Spočítajte si, na koľko mesiacov splátok máte hotovosť. Nesmú závisieť od ceny Bitcoinu.'],
      fall: () => ['Napíšte si jedno pravidlo pre pokles', 'Uviedli ste, že by ste predali. Rozhodnite sa teraz, jednou vetou, čo urobíte pri −70 %. Formulár nájdete v časti Dokumenty.'],
      keys: () => ['Vyskúšajte si obnovu s 20 €', 'Nastavte hardvérovú peňaženku, pošlite malú sumu, peňaženku vymažte a obnovte zo zálohy, skôr než pôjdu do hry väčšie sumy. Postup nájdete v časti Dokumenty.'],
      custody: () => ['Rozhodnite, kto bude držať kľúče', 'Pomôže vám tabuľka vyššie. Keď sa rozhodnete, Partner Finder ukáže partnerov, ktorí spĺňajú kritériá.'],
      recovery: () => ['Dohodnite si s poskytovateľom postup obnovy', 'Opýtajte sa, čo sa stane pri strate kľúča a ako dlho obnova trvá, skôr než pôjdu do hry väčšie sumy.'],
      retire: (y) => ['Peniaze na dôchodok nenechajte na výkyvoch Bitcoinu', `Do dôchodku plánujete ísť o ${y} ${y === 1 ? 'rok' : y > 1 && y < 5 ? 'roky' : 'rokov'}. Označte si, čo budete v najbližších rokoch potrebovať, a držte to mimo Bitcoinu.`],
      heirs: () => ['Povedzte jednému človeku, ako váš Bitcoin nájsť', 'Zapíšte si, kde sú pokyny, nikdy nie samotnú frázu na obnovu, a povedzte to jednému človeku, ktorému dôverujete. List nájdete v časti Dokumenty.'],
      records: () => ['Zapisujte si každý nákup', 'Dátum, suma a cena v jednej jednoduchej tabuľke, v časti Dokumenty. Každé neskoršie daňové priznanie bude jednoduché.'],
      review: () => ['Pozrite sa na plán znova o rok', 'Vaše odpovede dnes nenechávajú veľkú medzeru. Spustite Verdict raz ročne alebo keď sa zmenia vaše úspory.'],
    },
    tool: { tax: 'Tax Agent', custody: 'Sprievodca úschovou', finder: 'Partner Finder', retire: 'Dôchodková kalkulačka', returns: 'Výnosy tried aktív', videos: 'Videá o Bitcoine', books: 'Knihy o Bitcoine', verdict: 'Verdict' },
    next: {
      tax: (c) => (c ? `${c}, vyplnené →` : 'Vyberte krajinu →'), free: 'Zadarmo', finder: 'Partneri, ktorí sedia →', compare: 'Porovnáte a vyberiete si sami', retire: 'Vlastné predpoklady →', returns: 'Rok po roku od 2016 →', videos: 'Kanály a prednášky →', books: 'Čo si prečítať →',
    },
    sent: 'Kópia v PDF je na ceste na e-mail, ktorým ste platili. Táto stránka zostane otvorená 30 minút.',
    download: 'Stiahnuť PDF',
    legal: 'Verdict kontroluje vaše odpovede pevnými pravidlami a nie je to investičné, daňové ani právne poradenstvo. Partnerov uvádzame preto, že spĺňajú kritériá, nie podľa poradia; Virtuse môže od partnera dostať províziu.',
  },
};

const BAND_LABEL = {
  en: ['Basics in place', 'A few gaps', 'Basics missing'],
  sk: ['Základy máte', 'Pár medzier', 'Chýbajú základy'],
};
const ORDER = ['size', 'reserve', 'debt', 'tax', 'custody', 'fall'];

const quarter = (asOf) => { const [y, q] = String(asOf).split('-'); return `${q} ${y}`; };
const page = (lang, file, query) => {
  const q = query ? new URLSearchParams(query).toString() : '';
  return `${lang === 'sk' ? '/sk/' : '/'}${file}${q ? `?${q}` : ''}`;
};
const tool = (name, lang, file, query) => ({ name, href: page(lang, file, query) });

// In English, country names take no article except the Netherlands.
const inEn = (id, name) => (id === 'nl' ? 'the Netherlands' : name);

// date: the day the report is about (the payment), for dates in the tax block.
export function liteReportView(answers, rawLang = 'en', date = new Date()) {
  const lang = rawLang === 'sk' ? 'sk' : 'en';
  const T = COPY[lang];
  const { eur, pct } = FMT[lang];
  const A = answers;
  const c = calc(A);
  const { sc, share, ltv, years, total } = c;
  const g = grade(total);
  const band = BAND_LABEL[lang][bandIndex(total)];
  const name = A.name || '';
  const fact = A.country !== 'other' ? TAX.countries[A.country]?.[lang] : null;
  const cName = fact ? (lang === 'en' ? inEn(A.country, fact.name) : fact.name) : '';
  const cIn = fact ? (lang === 'en' ? `in ${cName}` : fact.in) : '';
  const b = A.btc > 0 ? eur(A.btc) : '';
  const r = A.btc > 0 ? eur(A.btc * 0.3) : '';
  const l = A.btc > 0 ? eur(A.btc * 0.7) : '';
  const p = share == null ? '' : pct(share);
  const res = T.reserveShort[A.reserve];
  const m = A.monthly > 0 ? eur(A.monthly) : '';

  // Header line
  const worries = A.worries.map((w) => T.worry[w]).join(', ');
  const meta = [T.age(A.age), T.taxIn(lang === 'en' ? cName : cIn), T.exp[A.experience], T.keys[A.custody]];
  if (worries) meta.push(`${T.worriedAbout}: ${worries}`);

  // Numbers
  const homeValue = A.home === 'own' ? T.n.homeOwn(A.homeval ? eur(A.homeval) : '')
    : A.home === 'mortgage' ? T.n.homeMort(A.homeval ? eur(A.homeval) : '', eur(A.mortbal || 0), ltv == null ? '' : pct(ltv * 100))
      : A.home === 'rent' ? T.n.homeRent : T.n.homeOther;
  const nums = [
    [T.n.savings, eur(A.savings || 0)],
    [T.n.planned, p ? `${eur(A.btc || 0)} · ${T.n.share(p)}` : eur(A.btc || 0)],
    [T.n.after, A.btc > 0 ? T.n.left(r) : '–'],
    [T.n.monthly, m ? T.n.perYear(m, eur(A.monthly * 12)) : T.n.noMonthly],
    [T.n.reserve, T.reserveNum[A.reserve]],
    [T.n.retire, years == null ? T.n.retireNa : T.n.retired(A.pension ? eur(A.pension) : '', A.retire, years)],
    [T.n.home, homeValue],
    [T.n.debts, T.n.debt[A.debt]],
  ];

  // Area by area
  const sizeNear = years != null && years < 10 && share != null && share >= 20;
  const ltvP = ltv == null ? '' : pct(ltv * 100);
  const debtWhy = [T.why.debt[A.debt]];
  if (ltv != null) debtWhy.unshift(ltv > 0.8 ? T.why.mortHeavy(ltvP) : T.why.mort(ltvP));
  const custodyWhy = A.custody === 'self' ? (A.experience !== 'hodler' ? T.why.custody.selfNew : T.why.custody.self) : T.why.custody[A.custody];
  const why = {
    size: share == null ? T.why.sizeNa : T.why.size(p, A.btc > 0 ? r : eur(0), A.btc > 0 ? b : eur(0)) + (sizeNear ? T.why.sizeNear : ''),
    reserve: T.why.reserve[A.reserve],
    debt: debtWhy.join(' '),
    tax: T.why.tax[A.tax_known],
    custody: custodyWhy,
    fall: T.why.fall[A.fall],
  };
  const areas = ORDER.map((id) => ({ id, title: T.area[id], points: sc[id], why: why[id] }));

  // Summary
  const gaps = gapIds(A, c);
  const lead = T.sum.lead(name);
  const sizeLine = share == null ? T.sum.sizeNa : share < 20 ? T.sum.sizeOk : share < 50 ? T.sum.sizeBig : T.sum.sizeHuge;
  const debtKey = A.debt === 'none' ? (A.home === 'mortgage' ? 'noneMort' : 'none') : A.debt;
  const p1 = [`${lead}${sizeLine}`];
  if (share != null && A.btc > 0) p1.push(T.sum.math(b, p, r, share < 20));
  p1.push(`${T.sum.debt[debtKey]}${T.sum.fall[A.fall]}`);
  const targets = Object.entries(worryTargets(A)).filter(([w]) => A.worries.includes(w)).map(([, id]) => id);
  const worried = gaps.filter((id) => targets.includes(id)).length;
  const gapArg = { tax: lang === 'en' ? cName : cIn, size: r, reserve: res, retire: years };
  const p2 = [T.sum.open(gaps.length, worried), ...gaps.map((id) => T.gapLine[id](gapArg[id]))];

  // 70% fall
  const fallParas = [];
  if (A.btc > 0) {
    const first = [T.fall.main(b, r, l)];
    if (share != null) first.push(T.fall.share(pct(share * 0.7)));
    fallParas.push(first.join(' '));
    const second = [sc.reserve >= 7 ? T.fall.ok(res) : T.fall.thin(res)];
    if (A.debt === 'gt10') second.push(T.fall.debt);
    if (m) second.push(T.fall.monthly(m));
    fallParas.push(second.join(' '));
  } else {
    fallParas.push(T.fall.none);
  }

  // Tax
  const tax = fact
    ? {
        rows: [[T.tax.gain, fact.gainTax], fact.healthLevy && [T.tax.levy, fact.healthLevy], [T.tax.exempt, fact.exemption], fact.filing && [T.tax.filing, fact.filing], fact.note && [T.tax.note, fact.note]].filter(Boolean),
        note: T.tax.asOf(quarter(TAX.asOf)),
      }
    : { rows: [], text: T.tax.other };

  // Both sides: the top gaps as risks, and the 70% fall always.
  const risks = gaps.filter((id) => id !== 'size').slice(0, 2).map((id) => T.risk[id]).filter(Boolean);
  risks.push(T.risk.fall70(b, r));
  const solid = [];
  if (sc.size >= 7) solid.push(T.solid.size(p));
  if (A.custody !== 'any') solid.push(T.solid.custody[A.custody]);
  if (sc.debt >= 7) solid.push(T.solid.debt[A.debt]);
  if (sc.reserve >= 7) solid.push(T.solid.reserve);
  if (sc.fall >= 10) solid.push(T.solid.fall);
  if (sc.tax >= 10) solid.push(T.solid.tax);

  // Steps: one per gap, each with the tool that helps.
  const taxQuery = fact ? { country: A.country } : null;
  const stepArg = {
    tax: [lang === 'en' ? cName : fact?.name, lang === 'en' ? cName : cIn],
    size: [b, r],
    reserve: [res],
    retire: [years],
  };
  const stepTool = {
    tax: fact ? tool(T.tool.tax, lang, 'tax-agent.html', taxQuery) : null,
    keys: tool(T.tool.custody, lang, 'secure.html'),
    recovery: tool(T.tool.custody, lang, 'secure.html'),
    custody: tool(T.tool.custody, lang, 'secure.html'),
    retire: tool(T.tool.retire, lang, 'retirement-calculator.html'),
    heirs: tool(T.tool.tax, lang, 'tax-agent.html', taxQuery),
    review: tool(T.tool.verdict, lang, 'verdict.html'),
  };
  const stepIds = gaps.length < 3 ? [...gaps, 'review'] : gaps;
  const steps = stepIds.map((id) => {
    const [title, text] = T.step[id](...(stepArg[id] || []));
    return { id, title, text, tool: stepTool[id] || null };
  });

  // Next on Virtuse
  const amount = !A.btc ? '' : A.btc < 1000 ? 's' : A.btc < 10000 ? 'm' : A.btc < 100000 ? 'l' : 'xl';
  const finder = {
    pf_goal: 'buy', ...(A.country !== 'other' ? { pf_country: A.country } : {}), pf_experience: A.experience === 'hodler' ? 'hodler' : 'new',
    pf_custody: A.custody, ...(amount ? { pf_amount: amount } : {}),
  };
  const next = [
    { id: 'tax', name: T.tool.tax, sub: T.next.tax(fact?.name || ''), small: T.next.free, href: page(lang, 'tax-agent.html', taxQuery) },
    { id: 'finder', name: T.tool.finder, sub: T.next.finder, small: T.next.compare, href: page(lang, 'concierge.html', { ...finder, utm_source: 'verdict', utm_medium: 'report' }), print: page(lang, 'concierge.html', finder) },
    { id: 'retire', name: T.tool.retire, sub: T.next.retire, small: T.next.free, href: page(lang, 'retirement-calculator.html') },
    { id: 'returns', name: T.tool.returns, sub: T.next.returns, small: T.next.free, href: page(lang, 'asset-returns.html') },
    { id: 'videos', name: T.tool.videos, sub: T.next.videos, small: T.next.free, href: page(lang, 'ecosystem/videos/') },
    { id: 'books', name: T.tool.books, sub: T.next.books, small: T.next.free, href: page(lang, 'ecosystem/books/') },
  ];

  return {
    lite: true,
    lang,
    kicker: T.kicker,
    title: T.title(name),
    meta: meta.join(' · '),
    nums,
    score: total,
    grade: g,
    gradeLine: T.gradeLine(g),
    scale: T.scale,
    pill: T.pill(g, band),
    h: {
      summaryK: T.h.summaryK, areasK: T.h.areasK, areas: T.h.areas(total), area: T.h.area, points: T.h.points, why: T.h.why,
      fallK: T.h.fallK, fall: T.h.fall, custodyK: T.h.custodyK, custody: T.h.custody, taxK: T.h.taxK(lang === 'en' ? cName : (cIn || '')), tax: T.h.tax,
      bothK: T.h.bothK, both: T.h.both, wrong: T.h.wrong, solid: T.h.solid, planK: T.h.planK, plan: T.h.plan, nextK: T.h.nextK, next: T.h.next,
    },
    summary: [p1.join(' '), p2.join(' ')],
    areas,
    fall: fallParas,
    custody: { head: T.custodyTable.head, rows: T.custodyTable.rows, yours: T.custodyTable.yours[A.custody] },
    tax,
    risks: risks.map(([title, text]) => ({ title, text })),
    solid: solid.slice(0, 3).map(([title, text]) => ({ title, text })),
    solidNone: T.solid.none,
    steps,
    next,
    sent: T.sent,
    download: T.download,
    ...reportBlocks(A, c, lang, FMT[lang], date, fact?.name || ''),
    legal: T.legal,
  };
}
