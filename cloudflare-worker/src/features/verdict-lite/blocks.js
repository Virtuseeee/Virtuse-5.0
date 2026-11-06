// The concrete blocks of the paid report: the buyer's own numbers, published
// facts and documents to fill in. Pure. Nothing here picks an amount, a moment
// or a partner: sums are arithmetic on the answers, fees and partners are listed
// alphabetically, and the rule for a fall is written by the buyer.

import CHECKLISTS from '../../generated/checklists.js';
import FACTS from '../../generated/lite-facts.js';
import { PARTNERS, PRICED, amountBucket, custodyPartners, matchingPartners, taxPartners } from './partners.js';

// Rates for the worked example, the same rates as the country text in lite-tax.js.
// hold = years until a holding-period exemption applies.
// brackets = [upper limit, rate]; Slovakia: Financial Administration, tax year 2026.
const TAX_EXAMPLE = {
  cz: { rates: [15, 23], hold: 3 },
  sk: { brackets: [[43983.32, 19], [60349.21, 25], [75010.32, 30], [Infinity, 35]], levyOut: true },
  pl: { rates: [19] }, at: { rates: [27.5] }, de: { rates: [45], upTo: true, hold: 1 },
  hu: { rates: [15] }, si: { zero: true }, hr: { rates: [12], hold: 2 }, ro: { rates: [16] }, bg: { rates: [10] }, nl: { box3: true }, fr: { rates: [31.4] },
  // Spain's bands were outside the signed tax review of 5 Nov 2026: no worked figures until they are checked.
  es: { noExample: true },
};
// The scenario the Retirement Calculator opens with (hypothetical), and the sale in the tax example.
export const SCENARIO = { growth: 0.2, inflation: 0.04, sellShare: 0.05 };
const EXAMPLE_GAIN = 10000;
const LOCALE = { en: 'en-GB', sk: 'sk-SK' };

const COPY = {
  en: {
    worth: { k: 'The whole picture', h: 'Bitcoin as a share of what you own', savings: 'Savings and investments', pension: 'Retirement savings', home: 'Home minus mortgage', total: 'Total', btc: 'Planned for Bitcoin', ofTotal: (p) => `${p} of the total`, debts: 'Consumer debts are not deducted, because you gave them as a range.', vs: (p) => `Of your savings alone it is ${p}; this figure also counts the other lines above.` },
    falls: { head: ['Fall', 'High to low', 'Your amount at the low', 'Months it took to get back to the high'], note: 'Bitcoin in USD, month-end prices. Past falls do not predict future ones.' },
    reserve: {
      k: 'Cash reserve', h: 'Your reserve in euros',
      full: (e, t) => `At ${e} a month, 6 months is ${t}. Your reserve of 6 months or more is at least that: the target is met.`,
      range: (e, t, a, b, open) => `At ${e} a month, 6 months is ${t}. Your reserve is about ${a} to ${b}, so up to ${open} is still open.`,
      under: (e, t, b) => `At ${e} a month, 6 months is ${t}. Your reserve is under ${b}.`,
      none: 'You did not give your monthly spending, so the target stays in months: 6 months. Multiply a typical month by six to get your figure.',
    },
    retire: {
      k: 'Retirement', h: 'Retirement in plain numbers', years: 'Years left', sofar: 'Retirement savings so far', added: (m) => `Added by then at ${m} a month`, total: 'Retirement savings together, without returns', lump: 'Planned for Bitcoin', monthly: (e, n) => `Added at ${e} a month, ${n} months`, planTotal: 'You put into Bitcoin by retirement', scenario: 'Hypothetical scenario: Bitcoin +20% a year, inflation 4%', nominal: (a) => `Hypothetical value on your first day at ${a}`, real: "The same in today's money", planSub: "Fixed assumptions from the Retirement Calculator, not a forecast. Bitcoin has fallen 70% or more several times, and the real value can be far lower, including a loss. Crypto-assets are not covered by deposit guarantee or investor compensation schemes. For comparison: Strategy's public credit tool uses 10% a year as its default (checked 6 Nov 2026), and Michael Saylor, whose company holds Bitcoin, has said he expects about 30% a year over the next 20 years. Those are their figures; +20% is an assumption and not a forecast by Virtuse.",
      longest: (m, left) => `The longest recovery above took ${m} months; you have ${left} months until retirement.`,
      statBack: 'Longest way back to the high', statLeft: 'Months until you retire', months: (m) => `${m} months`,
      note: 'Retirement savings are simple sums, without returns or inflation.', na: 'You did not give a retirement age that can be used here.',
    },
    tax: {
      gain: (g) => `Example: a ${g} gain`, rate: 'Rate', taxC: 'Tax', left: 'Left', upTo: (r) => `up to ${r}`,
      heroK: 'Hypothetical tax on this sale', sale: (a) => `Example: selling 5% of your Bitcoin in the first year of retirement, at ${a}`, value: 'Bitcoin value in the +20% a year scenario', sold: 'You sell 5%', cost: 'Purchase cost of that part (5% of what you put in)', gainL: 'Taxable gain',
      band: (r, b) => `Tax at ${r} on ${b}`, taxTotal: 'Tax in total', share: (p, g) => `That is ${p} of the ${g} gain.`, leftSale: 'Left from the sale', leftGain: 'Left from the gain',
      scale: (first, rest) => `${first} applies to the part of the gain over ${rest}`, scaleAnd: 'and', bandHead: ['Part of the gain', 'Amount', 'Rate', 'Tax'], bandFrom: (x) => `up to ${x}`, bandBetween: (a, b) => `${a} to ${b}`, bandOver: (x) => `over ${x}`,
      exempt: (n) => `After ${n} ${n === 1 ? 'year' : 'years'} of holding, a sale is exempt under the rule above, so the tax is ${'€'}0. This assumes you sell your oldest purchases first.`,
      noteSale: (y) => `At today's rates and bands, on this gain alone: no other income, allowances, costs or fees. The purchase cost is 5% of the amounts in this report; Bitcoin you already hold is not counted. Rates can differ in ${y} years, and the scenario is not a forecast. Check with a tax adviser before you file.`,
      levyNote: 'Health insurance contributions are not included: their rate and base depend on your situation, for example if you receive a pension.',
      noExample: "Spain taxes these gains on its savings scale, and the amount depends on the size of the gain. This report shows no worked figures for Spain: ask a tax adviser for the current bands.",
      note: 'For illustration only, at the rates above. Your actual rate depends on your other income and costs. This is not a forecast of any gain.',
      hold: (n, d) => `A purchase made today would reach the ${n}-year holding period on ${d}.`,
      filing: { sk: (y) => `A sale in ${y} goes into the type B return due 31 March ${y + 1}.`, hr: (y) => `A gain in ${y} goes on the JOPPD form by the end of February ${y + 1}.` },
      zero: 'Private gains are not taxed under the rule above, so there is no example here.',
      box3: 'Box 3 taxes a deemed return on your wealth, not each sale, so there is no per-sale example here.',
    },
    fees: {
      k: 'Fees', h: 'Published fees on your amounts', partner: 'Partner', method: 'Method', one: (b) => `One purchase of ${b}`, year: (m) => `${m} a month: fee per year`,
      method21: 'Auto-Invest plan', methodBybit: 'Spot trading', methodKraken: 'Pro trading',
      auto: (first) => `€0 on Auto-Invest from day 8; ${first} at 0.99% in the first 7 days`, autoYear: '€0 from day 8',
      note: (q) => `Published entry-level fees, ${q}, in alphabetical order. Spreads, deposit and network fees can add to this. This is not a ranking; check each partner's price list.`,
      compare: (n) => `Outside your criteria, for comparison only: ${n}.`, compareTag: 'for comparison only', onSite: "on the partner's site", methodApp: 'App', methodCard: 'App and card',
    },
    partners: {
      k: 'Partners', h: 'Partners that match your criteria',
      criteria: (e, c, a) => `Your criteria: buying Bitcoin · ${e} · ${c}${a ? ` · ${a}` : ''}`,
      intro: 'Selected by the same fixed rules as Partner Finder and listed alphabetically, not ranked. You compare and choose. Links may be referral links and Virtuse may receive a fee.',
      exp: { new: 'first purchase', hodler: 'already holding Bitcoin' }, cust: { self: 'own keys', assisted: 'assisted custody', any: 'custody open' },
      amount: { s: 'under €1,000', m: '€1,000 to €10,000', l: '€10,000 to €100,000', xl: 'over €100,000' },
      licence: 'Licence', price: "Fees and prices: on the partner's site", open: 'Open',
      groups: { buy: 'Buying', custody: 'Custody', tax: 'Tax', heirs: 'Inheritance' }, custodyNote: (e) => `Partner Finder's custody rule · ${e}`, taxNote: (c) => `Partner Finder's tax rule · ${c}`, otherCountry: 'other country',
      heirsEmpty: 'We have no separate partner for inheritance. The readiness check is in Tax Agent, multisig and custody are in the guide, and the letter for your heirs is under Documents.',
      tools: { finder: 'Partner Finder', tax: 'Tax Agent', custody: 'Custody guide' },
      steps: (d) => `First steps, as described on the partner's own pages on ${d}. Screens can change.`,
    },
    docs: {
      k: 'Documents', h: 'Documents to fill in', pdfNote: 'All of them are in your PDF, ready to print.',
      rule: { title: 'My rule for a fall', text: 'Write it yourself, one line per row, before you need it.', head: ['If Bitcoin falls by', 'My amount would be', 'What I will do'], pct: (p) => `${p}%` },
      record: { title: 'Purchase record', text: 'One line per purchase, from the first one. Keep each confirmation from the partner too.', columns: ['Date', 'Euros paid', 'BTC received', 'Price', 'Fee', 'Partner', 'Where held'], csv: 'Download as CSV', file: 'virtuse-purchase-record.csv' },
      recovery: {
        titleSelf: 'Recovery test, own keys', titleAssisted: 'Recovery questions for your provider',
        self: ['Write the recovery phrase on paper, in order. No photo, no cloud.', 'Send a small amount, for example €20, to the wallet.', 'Note the receiving address and the balance.', 'Wipe the device or reset it to factory settings.', 'Restore it using only the paper backup.', 'Check that the same address and balance appear.', 'Keep the backup in a second place, away from the device.', 'Repeat the test once a year.'],
        assisted: ['What happens if I lose my key?', 'How long does recovery take, and what do you need from me?', 'What happens to my Bitcoin if you stop operating?', 'Who can act for my heirs, and with which documents?', 'Can I test a recovery with a small amount first?', 'Write down the answers and the date.'],
      },
      heirs: {
        title: 'Letter for your heirs', warn: 'Never write the recovery phrase, PIN or passwords in this letter. Keep it with your will or with your lawyer.',
        fields: ['My name and the date', 'What exists: Bitcoin, about how much, which wallets or accounts', 'Where the instructions and backups are (the place, not the content)', 'Partners and accounts I use', 'Who can help: a person I trust, my lawyer', 'Where this letter is kept'],
        country: 'Country where I pay tax', custody: 'How I hold my keys',
      },
    },
  },
  sk: {
    worth: { k: 'Celý obraz', h: 'Bitcoin ako podiel toho, čo máte', savings: 'Úspory a investície', pension: 'Úspory na dôchodok', home: 'Bývanie mínus hypotéka', total: 'Spolu', btc: 'Plánujete do Bitcoinu', ofTotal: (p) => `${p} z celku`, debts: 'Spotrebné dlhy nie sú odpočítané, lebo ste ich uviedli ako rozpätie.', vs: (p) => `Zo samotných úspor je to ${p}; toto číslo ráta aj ostatné položky vyššie.` },
    falls: { head: ['Pokles', 'Z maxima na minimum', 'Vaša suma na minime', 'Koľko mesiacov trvala cesta späť na maximum'], note: 'Bitcoin v USD, ceny na konci mesiaca. Minulé poklesy nepredpovedajú budúce.' },
    reserve: {
      k: 'Rezerva v hotovosti', h: 'Vaša rezerva v eurách',
      full: (e, t) => `Pri ${e} mesačne je 6 mesiacov ${t}. Vaša rezerva 6 mesiacov a viac je aspoň toľko: cieľ je splnený.`,
      range: (e, t, a, b, open) => `Pri ${e} mesačne je 6 mesiacov ${t}. Vaša rezerva je približne ${a} až ${b}, takže otvorených je ešte najviac ${open}.`,
      under: (e, t, b) => `Pri ${e} mesačne je 6 mesiacov ${t}. Vaša rezerva je menej ako ${b}.`,
      none: 'Neuviedli ste mesačné výdavky, takže cieľ zostáva v mesiacoch: 6 mesiacov. Bežný mesiac vynásobte šiestimi a máte svoju sumu.',
    },
    retire: {
      k: 'Dôchodok', h: 'Dôchodok v číslach', years: 'Zostáva rokov', sofar: 'Doterajšie úspory na dôchodok', added: (m) => `Pridáte dovtedy pri ${m} mesačne`, total: 'Úspory na dôchodok spolu, bez výnosov', lump: 'Plánujete do Bitcoinu', monthly: (e, n) => `Pridáte pri ${e} mesačne, ${n} mesiacov`, planTotal: 'Do Bitcoinu vložíte do dôchodku', scenario: 'Hypotetický scenár: Bitcoin +20 % ročne, inflácia 4 %', nominal: (a) => `Hypotetická hodnota v prvý deň vo veku ${a} rokov`, real: 'To isté v dnešných cenách', planSub: 'Pevné predpoklady z Dôchodkovej kalkulačky, nie predpoveď. Bitcoin už viackrát klesol o 70 % a viac a skutočná hodnota môže byť oveľa nižšia, vrátane straty. Kryptoaktíva nie sú kryté systémom ochrany vkladov ani systémom náhrad pre investorov. Pre porovnanie: verejný kreditný nástroj spoločnosti Strategy má predvolených 10 % ročne (overené 6. 11. 2026) a Michael Saylor, ktorého spoločnosť drží Bitcoin, uviedol, že počas nasledujúcich 20 rokov očakáva približne 30 % ročne. Sú to ich údaje; +20 % je predpoklad, nie predpoveď Virtuse.',
      longest: (m, left) => `Najdlhší návrat vyššie trval ${m} mesiacov; do dôchodku máte ${left} mesiacov.`,
      statBack: 'Najdlhšia cesta späť na maximum', statLeft: 'Do dôchodku vám zostáva', months: (m) => `${m} mesiacov`,
      note: 'Úspory na dôchodok sú jednoduché súčty, bez výnosov a inflácie.', na: 'Neuviedli ste vek odchodu do dôchodku, s ktorým by sa tu dalo počítať.',
    },
    tax: {
      gain: (g) => `Príklad: zisk ${g}`, rate: 'Sadzba', taxC: 'Daň', left: 'Zostane', upTo: (r) => `do ${r}`,
      heroK: 'Hypotetická suma na zdanenie', sale: (a) => `Príklad: predaj 5 % Bitcoinu v prvom roku dôchodku, vo veku ${a} rokov`, value: 'Hodnota Bitcoinu v scenári +20 % ročne', sold: 'Predáte 5 %', cost: 'Nákupná cena tejto časti (5 % z vložených súm)', gainL: 'Zdaniteľný zisk',
      band: (r, b) => `Daň ${r} z ${b}`, taxTotal: 'Daň spolu', share: (p, g) => `To je ${p} zo zisku ${g}.`, leftSale: 'Z predaja vám zostane', leftGain: 'Zo zisku zostane',
      scale: (first, rest) => `${first} platí pre časť zisku nad ${rest}`, scaleAnd: 'a', bandHead: ['Časť zisku', 'Suma', 'Sadzba', 'Daň'], bandFrom: (x) => `do ${x}`, bandBetween: (a, b) => `${a} až ${b}`, bandOver: (x) => `nad ${x}`,
      exempt: (n) => `Po ${n} ${n === 1 ? 'roku' : 'rokoch'} držby je predaj podľa pravidla vyššie oslobodený, takže daň je 0 €. Počíta sa s tým, že predávate najstaršie nákupy.`,
      noteSale: (y) => `Pri dnešných sadzbách a pásmach, len z tohto zisku: bez iných príjmov, nezdaniteľnej časti, výdavkov a poplatkov. Nákupná cena je 5 % zo súm v tomto reporte; Bitcoin, ktorý už držíte, sa nepočíta. O ${y} ${y === 1 ? 'rok' : y < 5 ? 'roky' : 'rokov'} môžu byť sadzby iné a scenár nie je predpoveď. Pred podaním priznania sa poraďte s daňovým poradcom.`,
      levyNote: 'Zdravotné odvody nie sú započítané: ich sadzba a základ závisia od vašej situácie, napríklad ak poberáte dôchodok.',
      noExample: 'Španielsko zdaňuje tieto zisky podľa stupnice príjmov z úspor a suma závisí od výšky zisku. Tento report pre Španielsko neuvádza prepočet: aktuálne pásma si overte u daňového poradcu.',
      note: 'Len ako ilustrácia, pri sadzbách uvedených vyššie. Skutočná sadzba závisí od vašich ostatných príjmov a výdavkov. Nejde o predpoveď zisku.',
      hold: (n, d) => `Nákup urobený dnes by dosiahol dobu držby ${n} ${n === 1 ? 'rok' : 'roky'} dňa ${d}.`,
      filing: { sk: (y) => `Predaj v roku ${y} patrí do priznania typu B s termínom 31. marca ${y + 1}.`, hr: (y) => `Zisk v roku ${y} patrí na formulár JOPPD do konca februára ${y + 1}.` },
      zero: 'Podľa pravidla vyššie sa súkromné zisky nezdaňujú, takže príklad tu nie je.',
      box3: 'Box 3 zdaňuje predpokladaný výnos z majetku, nie každý predaj, takže príklad na jeden predaj tu nie je.',
    },
    fees: {
      k: 'Poplatky', h: 'Zverejnené poplatky z vašich súm', partner: 'Partner', method: 'Spôsob', one: (b) => `Jednorazový nákup ${b}`, year: (m) => `${m} mesačne: poplatok za rok`,
      method21: 'Sporiaci plán Auto-Invest', methodBybit: 'Spot obchodovanie', methodKraken: 'Pro trading',
      auto: (first) => `0 € na Auto-Invest od 8. dňa; ${first} pri 0,99 % prvých 7 dní`, autoYear: '0 € od 8. dňa',
      note: (q) => `Zverejnené vstupné poplatky, ${q}, abecedne. Môžu sa pridať spready, poplatky za vklad a sieť. Nie je to poradie; pozrite si cenník každého partnera.`,
      compare: (n) => `Mimo vašich kritérií, len na porovnanie: ${n}.`, compareTag: 'len na porovnanie', onSite: 'na stránke partnera', methodApp: 'Aplikácia', methodCard: 'Aplikácia a karta',
    },
    partners: {
      k: 'Partneri', h: 'Partneri, ktorí spĺňajú vaše kritériá',
      criteria: (e, c, a) => `Vaše kritériá: nákup Bitcoinu · ${e} · ${c}${a ? ` · ${a}` : ''}`,
      intro: 'Vybraní rovnakými pevnými pravidlami ako v Partner Finderi a uvedení abecedne, nie podľa poradia. Porovnáte a vyberiete si sami. Odkazy môžu byť odporúčacie a Virtuse môže dostať províziu.',
      exp: { new: 'prvý nákup', hodler: 'Bitcoin už držíte' }, cust: { self: 'vlastné kľúče', assisted: 'asistovaná úschova', any: 'úschova otvorená' },
      amount: { s: 'do 1 000 €', m: '1 000 až 10 000 €', l: '10 000 až 100 000 €', xl: 'nad 100 000 €' },
      licence: 'Licencia', price: 'Poplatky a ceny: na stránke partnera', open: 'Otvoriť',
      groups: { buy: 'Nákup', custody: 'Úschova', tax: 'Dane', heirs: 'Dedičstvo' }, custodyNote: (e) => `Pravidlo pre úschovu v Partner Finderi · ${e}`, taxNote: (c) => `Pravidlo pre dane v Partner Finderi · ${c}`, otherCountry: 'iná krajina',
      heirsEmpty: 'Samostatného partnera na dedičstvo nemáme. Kontrolu pripravenosti nájdete v Tax Agentovi, multisig a úschovu v sprievodcovi a list pre dedičov v časti Dokumenty.',
      tools: { finder: 'Partner Finder', tax: 'Tax Agent', custody: 'Sprievodca úschovou' },
      steps: (d) => `Prvé kroky, ako ich partner opisoval na vlastných stránkach ${d}. Obrazovky sa môžu zmeniť.`,
    },
    docs: {
      k: 'Dokumenty', h: 'Dokumenty na vyplnenie', pdfNote: 'Všetky sú vo vašom PDF, pripravené na tlač.',
      rule: { title: 'Moje pravidlo pre pokles', text: 'Napíšte si ho sami, jeden riadok na každý pokles, skôr než ho budete potrebovať.', head: ['Ak Bitcoin klesne o', 'Moja suma by bola', 'Čo urobím'], pct: (p) => `${p}\u00a0%` },
      record: { title: 'Záznam nákupov', text: 'Jeden riadok na každý nákup, od prvého. Odložte si aj každé potvrdenie od partnera.', columns: ['Dátum', 'Zaplatené eurá', 'Prijaté BTC', 'Cena', 'Poplatok', 'Partner', 'Kde je uložené'], csv: 'Stiahnuť ako CSV', file: 'virtuse-zaznam-nakupov.csv' },
      recovery: {
        titleSelf: 'Skúška obnovy, vlastné kľúče', titleAssisted: 'Otázky k obnove pre poskytovateľa',
        self: ['Frázu na obnovu zapíšte na papier, v správnom poradí. Žiadna fotka, žiadny cloud.', 'Pošlite do peňaženky malú sumu, napríklad 20 €.', 'Zapíšte si prijímaciu adresu a zostatok.', 'Zariadenie vymažte alebo obnovte na výrobné nastavenia.', 'Obnovte ho len z papierovej zálohy.', 'Overte, že sa zobrazí rovnaká adresa aj zostatok.', 'Zálohu uložte na druhé miesto, mimo zariadenia.', 'Skúšku zopakujte raz ročne.'],
        assisted: ['Čo sa stane, ak stratím svoj kľúč?', 'Ako dlho trvá obnova a čo od mňa potrebujete?', 'Čo sa stane s mojím Bitcoinom, ak skončíte činnosť?', 'Kto môže konať za mojich dedičov a s akými dokumentmi?', 'Môžem si obnovu najprv vyskúšať s malou sumou?', 'Odpovede si zapíšte aj s dátumom.'],
      },
      heirs: {
        title: 'List pre dedičov', warn: 'Do tohto listu nikdy nepíšte frázu na obnovu, PIN ani heslá. Uložte ho so závetom alebo u právnika.',
        fields: ['Moje meno a dátum', 'Čo existuje: Bitcoin, približne koľko, ktoré peňaženky alebo účty', 'Kde sú pokyny a zálohy (miesto, nie obsah)', 'Partneri a účty, ktoré používam', 'Kto môže pomôcť: osoba, ktorej dôverujem, môj právnik', 'Kde je tento list uložený'],
        country: 'Krajina, kde platím dane', custody: 'Ako držím kľúče',
      },
    },
  },
};

const quarter = (asOf) => { const [y, q] = String(asOf).split('-'); return `${q} ${y}`; };
const fmtDate = (d, lang) => d.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bratislava' });
const period = (f) => `${f.from.slice(0, 4)}–${f.low.slice(0, 4)}`;

// Same math as simulate() in retirement-calc.js: the amount today grows from day
// one, each monthly amount from its own month. Pure arithmetic on fixed assumptions.
export function planScenario(A, years) {
  if (years == null || years < 1) return null;
  const lump = A.btc > 0 ? A.btc : 0;
  const dca = A.monthly > 0 ? A.monthly : 0;
  if (!lump && !dca) return null;
  const g = 1 + SCENARIO.growth;
  let nominal = lump * g ** years;
  for (let t = 0; t < years; t += 1) for (let m = 0; m < 12; m += 1) nominal += dca * g ** (years - t - m / 12);
  return { paid: lump + dca * 12 * years, nominal, real: nominal / (1 + SCENARIO.inflation) ** years };
}

function worth(A, T, { eur, pct }) {
  const equity = A.home === 'own' ? A.homeval || 0 : A.home === 'mortgage' && A.homeval ? A.homeval - (A.mortbal || 0) : null;
  const total = (A.savings || 0) + (A.pension || 0) + (equity || 0);
  if (total <= 0) return null;
  const rows = [[T.worth.savings, eur(A.savings || 0)]];
  if (A.pension) rows.push([T.worth.pension, eur(A.pension)]);
  if (equity !== null && A.homeval) rows.push([T.worth.home, equity < 0 ? `−${eur(-equity)}` : eur(equity)]);
  rows.push([T.worth.total, eur(total)]);
  rows.push([T.worth.btc, `${eur(A.btc || 0)} · ${T.worth.ofTotal(pct(((A.btc || 0) / total) * 100))}`]);
  const vs = A.savings > 0 && total > A.savings && A.btc > 0 ? T.worth.vs(pct((A.btc / A.savings) * 100)) : '';
  return { k: T.worth.k, h: T.worth.h, rows, note: [vs, A.debt !== 'none' ? T.worth.debts : ''].filter(Boolean).join(' ') };
}

function fallTable(A, T, { eur, pct }) {
  if (!(A.btc > 0)) return null;
  const rows = [...FACTS.falls].reverse().map((f) => [period(f), `−${pct(f.pct)}`, eur(A.btc * (1 - f.pct / 100)), String(f.monthsBack)]);
  return { head: T.falls.head, rows, note: T.falls.note };
}

function reserve(A, T, { eur }) {
  const e = A.expenses;
  let text = T.reserve.none;
  if (e > 0) {
    const t = eur(e * 6);
    if (A.reserve === '6p') text = T.reserve.full(eur(e), t);
    else if (A.reserve === 'lt1') text = T.reserve.under(eur(e), t, eur(e));
    else {
      const [lo, hi] = A.reserve === '3_6' ? [3, 6] : [1, 3];
      text = T.reserve.range(eur(e), t, eur(e * lo), eur(e * hi), eur(e * (6 - lo)));
    }
  }
  return { k: T.reserve.k, h: T.reserve.h, text };
}

function retirement(A, T, years, { eur }, scen) {
  if (years == null) return { k: T.retire.k, h: T.retire.h, rows: [], plan: null, text: T.retire.na, note: '' };
  const m = years * 12;
  const added = (A.retmonthly || 0) * m;
  const rows = [[T.retire.years, String(years)]];
  if (A.pension) rows.push([T.retire.sofar, eur(A.pension)]);
  if (A.retmonthly) rows.push([T.retire.added(eur(A.retmonthly)), eur(added)]);
  if (A.pension || A.retmonthly) rows.push([T.retire.total, eur((A.pension || 0) + added)]);
  // The Bitcoin plan stays apart from the savings above: its own lines, then one total.
  const lump = A.btc > 0 ? A.btc : 0;
  const paidIn = (A.monthly || 0) * m;
  let plan = null;
  if (lump || paidIn) {
    plan = { rows: [], label: T.retire.planTotal, value: eur(lump + paidIn) };
    if (scen) plan.scenario = { k: T.retire.scenario, vals: [[T.retire.nominal(A.retire), eur(scen.nominal)], [T.retire.real, eur(scen.real)]], sub: T.retire.planSub };
    if (lump) plan.rows.push([T.retire.lump, eur(lump)]);
    if (paidIn) plan.rows.push([T.retire.monthly(eur(A.monthly), m), eur(paidIn)]);
  }
  const longest = Math.max(...FACTS.falls.map((f) => f.monthsBack));
  return { k: T.retire.k, h: T.retire.h, rows, plan, text: T.retire.longest(longest, m), stats: [[T.retire.statBack, T.retire.months(longest)], [T.retire.statLeft, T.retire.months(m)]], note: T.retire.note };
}

function taxExample(A, T, date, lang, { eur, pct }, years, scen) {
  const ex = TAX_EXAMPLE[A.country];
  if (!ex) return null;
  if (ex.zero) return { text: T.tax.zero, kv: [], after: [], bands: null, rows: [], head: [], dates: [] };
  if (ex.box3) return { text: T.tax.box3, kv: [], after: [], bands: null, rows: [], head: [], dates: [] };
  if (ex.noExample) return { text: T.tax.noExample, kv: [], after: [], bands: null, rows: [], head: [], dates: [] };
  const rate = (r) => (lang === 'sk' ? `${String(r).replace('.', ',')}\u00a0%` : `${r}%`);
  // Every printed line adds up: whole euros are rounded once, then only added and taken away.
  const share = rate(SCENARIO.sellShare * 100);
  const worth = scen ? Math.round(scen.nominal) : 0;
  const sale = Math.round(worth * SCENARIO.sellShare);
  const cost = scen ? Math.round(scen.paid * SCENARIO.sellShare) : 0;
  const worked = scen && sale > cost;
  const g = worked ? sale - cost : EXAMPLE_GAIN;
  const base = worked ? sale : g;
  const kv = worked ? [
    [T.tax.value, eur(worth)],
    [T.tax.sold, eur(sale), false, `${share} × ${eur(worth)}`],
    [T.tax.cost, eur(cost), false, `${share} × ${eur(scen.paid)}`],
    [T.tax.gainL, eur(g), true, `${eur(sale)} − ${eur(cost)}`],
  ] : [];
  const dates = [];
  if (ex.hold) {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + ex.hold);
    dates.push(T.tax.hold(ex.hold, fmtDate(d, lang)));
  }
  const saleYear = date.getFullYear() + (worked ? years : 0);
  const filing = T.tax.filing[A.country];
  if (filing) dates.push(filing(saleYear));
  const out = { title: worked ? T.tax.sale(A.retire) : T.tax.gain(eur(g)), kv, after: [], bands: null, head: [], rows: [], dates, note: worked ? T.tax.noteSale(years) : T.tax.note };
  if (worked && ex.hold && years >= ex.hold) {
    out.text = T.tax.exempt(ex.hold);
    out.hero = { k: T.tax.heroK, vals: [[T.tax.taxTotal, eur(0)], [T.tax.leftSale, eur(sale)]] };
    return out;
  }
  if (ex.brackets || (ex.rates.length === 1 && !ex.upTo)) {
    const list = ex.brackets || [[Infinity, ex.rates[0]]];
    const money = (x) => eur(Math.round(x));
    let from = 0;
    let tax = 0;
    const lines = [];
    for (const [to, r] of list) {
      const part = Math.min(g, to) - from;
      if (part <= 0) break;
      const due = Math.round((part * r) / 100);
      tax += due;
      lines.push({ from, to, r, part: Math.round(part), due });
      from = to;
    }
    // The bands this gain does not reach, so "19 to 35%" in the rule above has its thresholds.
    const above = list.slice(lines.length).map(([, r], k) => [rate(r), money(list[lines.length + k - 1][0])]);
    if (above.length) {
      const parts = above.map(([r, from], k) => (k ? `${r} ${lang === 'sk' ? 'nad ' : 'over '}${from}` : from));
      const rest = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ${T.tax.scaleAnd} ${parts.at(-1)}` : parts[0];
      out.scale = `${T.tax.scale(above[0][0], rest)}.`;
    }
    if (lines.length > 1) {
      out.bands = {
        head: T.tax.bandHead,
        rows: lines.map((x) => [x.from === 0 ? T.tax.bandFrom(money(x.to)) : x.to === Infinity || x.to >= g ? T.tax.bandOver(money(x.from)) : T.tax.bandBetween(money(x.from), money(x.to)), eur(x.part), rate(x.r), eur(x.due)]),
        foot: [T.tax.taxTotal, eur(g), '', eur(tax)],
      };
    } else {
      kv.push([T.tax.band(rate(lines[0].r), eur(lines[0].part)), eur(lines[0].due)]);
    }
    if (ex.levyOut) out.note = `${T.tax.levyNote} ${out.note}`;
    const all = tax;
    const leftLabel = worked ? T.tax.leftSale : T.tax.leftGain;
    out.after.push([leftLabel, eur(base - all), true, `${eur(base)} − ${eur(all)}`]);
    out.hero = { k: T.tax.heroK, vals: [[T.tax.taxTotal, eur(all)], [leftLabel, eur(base - all)]], sub: T.tax.share(pct((all / g) * 100), eur(g)) };
    return out;
  }
  // A range without published bands in our data: show each rate.
  out.head = [T.tax.rate, T.tax.taxC, T.tax.left];
  out.rows = ex.rates.map((r) => [ex.upTo ? T.tax.upTo(rate(r)) : rate(r), eur((g * r) / 100), eur(base - (g * r) / 100)]);
  return out;
}

function fees(A, T, { eur }) {
  const one = A.btc > 0 ? A.btc : 0;
  const year = (A.monthly || 0) * 12;
  if (!one && !year) return null;
  const method = { '21bitcoin': T.fees.method21, 'bybit-eu': T.fees.methodBybit, kraken: T.fees.methodKraken, invity: T.fees.methodApp, 'crypto-com': T.fees.methodCard };
  const money = (x) => eur(x);
  const head = [T.fees.partner, T.fees.method, ...(one ? [T.fees.one(eur(one))] : []), ...(year ? [T.fees.year(eur(A.monthly))] : [])];
  const matched = matchingPartners(A);
  // One row per partner that matches the criteria (a wallet has a device price, not a fee on a purchase),
  // plus the published fees kept for comparison, marked as such. Always alphabetical.
  const unpublished = matched.filter((id) => !PRICED.includes(id) && id !== 'trezor').map((id) => ({ id, partner: PARTNERS[id].name, none: true }));
  const list = [...FACTS.fees, ...unpublished].sort((x, y) => x.partner.localeCompare(y.partner, 'en'));
  const rows = list.map((f) => {
    const cells = [f.partner, matched.includes(f.id) ? method[f.id] || '' : `${method[f.id] || ''} · ${T.fees.compareTag}`];
    if (f.none) {
      if (one) cells.push(T.fees.onSite);
      if (year) cells.push(T.fees.onSite);
    } else if (f.id === '21bitcoin') {
      if (one) cells.push(T.fees.auto(money(one * 0.0099)));
      if (year) cells.push(T.fees.autoYear);
    } else {
      if (one) cells.push(money(one * f.pct + f.fixed));
      if (year) cells.push(money(year * f.pct));
    }
    return cells;
  });
  const names = (ids) => ids.map((id) => PARTNERS[id].name).join(', ');
  const compare = FACTS.fees.filter((f) => !matched.includes(f.id)).map((f) => f.id);
  const note = [T.fees.note(quarter(FACTS.feesAsOf)), compare.length && T.fees.compare(names(compare))].filter(Boolean).join(' ');
  return { k: T.fees.k, h: T.fees.h, head, rows, note };
}

const toolHref = (lang, file, query) => {
  const q = query ? `?${new URLSearchParams(query).toString()}` : '';
  return `${lang === 'sk' ? '/sk/' : '/'}${file}${q}`;
};

function partnerBlock(A, T, lang, countryName) {
  const P = T.partners;
  const utm = (url, id) => { const u = new URL(url); u.searchParams.set('utm_source', 'verdict'); u.searchParams.set('utm_medium', 'report'); u.searchParams.set('utm_content', id); return u.toString(); };
  // Every card has the same fields: licence if there is one, the price, one fact.
  const card = (id, withSteps) => {
    const p = PARTNERS[id];
    const f = p[lang];
    const facts = [f.licence && `${P.licence}: ${f.licence}`, ...(PRICED.includes(id) ? [f.fee] : [P.price, f.fee])].filter(Boolean);
    const c = CHECKLISTS[id];
    // A partner's first steps appear only once they are approved in data/partner-checklists.json.
    const steps = withSteps && c.approved ? (c.steps[lang] && c.steps[lang].length ? c.steps[lang] : c.steps.en).map(({ title, text }) => ({ title, text })) : [];
    return { id, name: p.name, tagline: f.tagline, facts, href: utm(p.url, id), site: new URL(p.url).hostname, stepsNote: steps.length ? P.steps(fmtDate(new Date(`${c.as_of}T12:00:00Z`), lang)) : '', steps };
  };
  const cards = (ids, withSteps) => ids.map((id) => card(id, withSteps)).sort((x, y) => x.name.localeCompare(y.name, 'en'));
  const bucket = amountBucket(A.btc);
  const expLine = P.exp[A.experience === 'hodler' ? 'hodler' : 'new'];
  const taxQuery = A.country !== 'other' ? { country: A.country } : null;
  const finder = { pf_goal: 'buy', ...(A.country !== 'other' ? { pf_country: A.country } : {}), pf_experience: A.experience === 'hodler' ? 'hodler' : 'new', pf_custody: A.custody, ...(bucket ? { pf_amount: bucket } : {}) };
  const link = (id, file, query) => ({ name: P.tools[id], href: toolHref(lang, file, query) });
  return {
    k: P.k, h: P.h, intro: P.intro, open: P.open,
    groups: [
      { id: 'buy', title: P.groups.buy, note: P.criteria(expLine, P.cust[A.custody], bucket ? P.amount[bucket] : ''), list: cards(matchingPartners(A), true), links: [link('finder', 'concierge.html', finder)] },
      { id: 'custody', title: P.groups.custody, note: P.custodyNote(expLine), list: cards(custodyPartners(A), false), links: [link('custody', 'secure.html')] },
      { id: 'tax', title: P.groups.tax, note: P.taxNote(countryName || P.otherCountry), list: cards(taxPartners(A), false), links: [link('tax', 'tax-agent.html', taxQuery)] },
      { id: 'heirs', title: P.groups.heirs, note: '', empty: P.heirsEmpty, list: [], links: [link('tax', 'tax-agent.html', taxQuery), link('custody', 'secure.html')] },
    ],
  };
}

function docs(A, T, countryName, { eur }) {
  const D = T.docs;
  const custodyLine = T.partners.cust[A.custody];
  const rules = [30, 50, 70].map((p) => [`−${D.rule.pct(p)}`, A.btc > 0 ? eur(A.btc * (1 - p / 100)) : '', '']);
  return {
    k: D.k, h: D.h, pdfNote: D.pdfNote,
    rule: { title: D.rule.title, text: D.rule.text, head: D.rule.head, rows: rules },
    record: { title: D.record.title, text: D.record.text, columns: D.record.columns, csv: D.record.csv, file: D.record.file },
    recovery: A.custody === 'assisted'
      ? { title: D.recovery.titleAssisted, items: D.recovery.assisted }
      : { title: D.recovery.titleSelf, items: D.recovery.self },
    heirs: { title: D.heirs.title, warn: D.heirs.warn, filled: [[D.heirs.country, countryName || ''], [D.heirs.custody, custodyLine]].filter(([, v]) => v), fields: D.heirs.fields },
  };
}

export function reportBlocks(A, c, lang, fmt, date, countryName) {
  const T = COPY[lang];
  const scen = planScenario(A, c.years);
  return {
    worth: worth(A, T, fmt),
    fallTable: fallTable(A, T, fmt),
    reserveBox: reserve(A, T, fmt),
    retireBox: retirement(A, T, c.years, fmt, scen),
    taxExample: taxExample(A, T, date, lang, fmt, c.years, scen),
    fees: fees(A, T, fmt),
    partners: partnerBlock(A, T, lang, countryName),
    docs: docs(A, T, countryName, fmt),
  };
}
