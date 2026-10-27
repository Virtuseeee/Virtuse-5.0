// Verdict result v2 (handover verdict-result-v2.md, Ras 2026-10-23): everything
// that decides the structure of the result is code, never the model: the level
// (verdict line), the 3 next steps, the plain-language area texts and the
// pricing. The model only fills short personal sentences (summary, per-signal
// fix) into fixed slots; finalize() below validates them and every slot has a
// template fallback. The same AREA_COPY strings live in the site's
// verdict-flow.js only by id; the Worker sends the final text in the request
// language, so the page, the PDF, the eval and the tests show the same words.

import TAX from './tax-facts.js';

const SK_CHARS = /[áäčďéíĺľňóôŕšťúýž]/i;
const RU_CHARS = /[а-яё]/i;

// Verdict languages (verdict.js LANGS); anything else is English.
export const VERDICT_LANGS = ['sk', 'en', 'ru'];
export function lk(lang) { return VERDICT_LANGS.includes(lang) ? lang : 'en'; }

// Locative after the preposition (SK) / "in X" (EN), for "{country}".
export const COUNTRY_LOC = {
  sk: { sk: 'na Slovensku', cz: 'v Česku', at: 'v Rakúsku', de: 'v Nemecku', pl: 'v Poľsku', hu: 'v Maďarsku', si: 'v Slovinsku', hr: 'v Chorvátsku', ro: 'v Rumunsku', bg: 'v Bulharsku', nl: 'v Holandsku', fr: 'vo Francúzsku', es: 'v Španielsku' },
  en: { sk: 'in Slovakia', cz: 'in Czechia', at: 'in Austria', de: 'in Germany', pl: 'in Poland', hu: 'in Hungary', si: 'in Slovenia', hr: 'in Croatia', ro: 'in Romania', bg: 'in Bulgaria', nl: 'in the Netherlands', fr: 'in France', es: 'in Spain' },
  // Same as seo-build meta.json inRu (the ru/ tax pages).
  ru: { sk: 'в Словакии', cz: 'в Чехии', at: 'в Австрии', de: 'в Германии', pl: 'в Польше', hu: 'в Венгрии', si: 'в Словении', hr: 'в Хорватии', ro: 'в Румынии', bg: 'в Болгарии', nl: 'в Нидерландах', fr: 'во Франции', es: 'в Испании' },
};
// Nominative, for "for {countryName}" / "pre {countryName}".
export const COUNTRY_NAME = {
  sk: { sk: 'Slovensko', cz: 'Česko', at: 'Rakúsko', de: 'Nemecko', pl: 'Poľsko', hu: 'Maďarsko', si: 'Slovinsko', hr: 'Chorvátsko', ro: 'Rumunsko', bg: 'Bulharsko', nl: 'Holandsko', fr: 'Francúzsko', es: 'Španielsko' },
  en: { sk: 'Slovakia', cz: 'Czechia', at: 'Austria', de: 'Germany', pl: 'Poland', hu: 'Hungary', si: 'Slovenia', hr: 'Croatia', ro: 'Romania', bg: 'Bulgaria', nl: 'the Netherlands', fr: 'France', es: 'Spain' },
  // RU: genitive, for "для {countryName}" (the only place it is used).
  ru: { sk: 'Словакии', cz: 'Чехии', at: 'Австрии', de: 'Германии', pl: 'Польши', hu: 'Венгрии', si: 'Словении', hr: 'Хорватии', ro: 'Румынии', bg: 'Болгарии', nl: 'Нидерландов', fr: 'Франции', es: 'Испании' },
};
const NO_COUNTRY = { sk: { loc: 'vo vašej krajine', name: 'vašu krajinu' }, en: { loc: 'in your country', name: 'your country' }, ru: { loc: 'в вашей стране', name: 'вашей страны' } };

// What is left after a 70% fall, by amount bucket (same figures as the
// funnel's drop question, verdict-flow.js dropAmt).
const DROP = {
  sk: { s: 'z menej ako 1 000 € by zostalo menej ako 300 €', m: 'z 1 000 až 10 000 € by zostalo asi 300 až 3 000 €', l: 'z 10 000 až 100 000 € by zostalo asi 3 000 až 30 000 €', xl: 'z viac ako 100 000 € by zostalo viac ako 30 000 €' },
  en: { s: 'under €1,000 would be worth under €300', m: '€1,000 to 10,000 would be worth about €300 to 3,000', l: '€10,000 to 100,000 would be worth about €3,000 to 30,000', xl: 'over €100,000 would be worth over €30,000' },
  ru: { s: 'из суммы меньше 1 000 € осталось бы меньше 300 €', m: 'из суммы от 1 000 до 10 000 € осталось бы примерно от 300 до 3 000 €', l: 'из суммы от 10 000 до 100 000 € осталось бы примерно от 3 000 до 30 000 €', xl: 'из суммы больше 100 000 € осталось бы больше 30 000 €' },
};

// Verb-first actions: the model's fix must start with one of these (§3.1).
// EN also allows "Write" and "Complete": the handover's own templates use
// "Write a goal…" and "Complete the sentence…".
export const VERBS = {
  sk: ['Spočítajte', 'Zistite', 'Napíšte', 'Určte', 'Porovnajte', 'Overte', 'Doplňte', 'Pripravte', 'Nastavte', 'Uložte', 'Prejdite si'],
  en: ['Work out', 'Find out', 'Write down', 'Write', 'Set', 'Compare', 'Check', 'Add', 'Prepare', 'Save', 'Go through', 'Complete'],
  ru: ['Посчитайте', 'Узнайте', 'Запишите', 'Определите', 'Сравните', 'Проверьте', 'Добавьте', 'Дополните', 'Подготовьте', 'Настройте', 'Сохраните', 'Обсудите'],
};

// Same names as layer2-src/src/lib/concierge.ts PARTNERS (a test keeps them in
// sync): a fix that names a partner is replaced by the template.
export const PARTNER_NAMES = ['21bitcoin', 'Abundant Mines', 'BitGo', 'Blockpit', 'Blockstream', 'Bybit EU', 'CoinTracking', 'Coinbase Institutional', 'Coinrule', 'Crypto.com', 'Cryptohopper', 'Divly', 'Firefish', 'Invity', 'Koinly', 'Kraken', 'Ledger', 'OneMiners', 'Power Mining', 'RevenueBot', 'Solo Satoshi', 'Sygnum', 'Trezor', 'Umbrel'];

// Plain titles + texts per signal and level (low 0-3, mid 4-6, high 7-10).
// Placeholders: {country} "na Slovensku" / "in Slovakia", {drop}, {country_rule}.
export const AREA_COPY = {
  worst_case: {
    title: { sk: 'Čo urobíte pri prepade', en: 'What you do in a crash' },
    q: { sk: 'Čo urobíte, ak Bitcoin padne o 70 %?', en: 'What will you do if Bitcoin falls 70%?' },
    low: {
      short: { sk: 'neviete, čo urobíte, ak Bitcoin padne o 70 %', en: "you don't know what you'd do if Bitcoin fell 70%" },
      meaning: { sk: 'Bitcoin už viackrát padol o 70 % a viac. Bez plánu sa pri takom prepade rozhoduje v strese.', en: 'Bitcoin has fallen 70% or more several times. Without a plan, you decide under stress.' },
      todo: { sk: 'Spočítajte, koľko by vám zostalo pri poklese o 70 % ({drop}), a napíšte, čo vtedy urobíte.', en: "Work out what would be left after a 70% fall ({drop}) and write down what you'd do then." },
    },
    mid: {
      meaning: { sk: 'Viete, ako by ste reagovali, ale nemáte to spočítané v eurách.', en: "You know how you'd react, but you haven't worked it out in euros." },
      todo: { sk: 'Doplňte sumu v eurách a ako dlho to vydržíte bez predaja.', en: 'Add the amount in euros and how long you can wait without selling.' },
    },
    high: {
      short: { sk: 'viete, čo urobíte pri poklese o 70 %', en: "you know what you'd do in a 70% fall" },
      meaning: { sk: 'Pokles o 70 % máte spočítaný aj s plánom, ako ho prečkať.', en: "You've worked out a 70% fall and how to get through it." },
      todo: { sk: 'Nič netreba. Plán si uložte, aby ste ho mali pri prepade po ruke.', en: 'Nothing needed. Save the plan so you have it at hand in a crash.' },
    },
  },
  liquidity: {
    title: { sk: 'Rezerva mimo Bitcoinu', en: 'Cash reserve outside Bitcoin' },
    q: { sk: 'Na koľko mesiacov výdavkov vám vystačia peniaze mimo Bitcoinu?', en: 'How many months of expenses does your money outside Bitcoin cover?' },
    low: {
      short: { sk: 'nemáte jasnú rezervu mimo Bitcoinu', en: 'you have no clear reserve outside Bitcoin' },
      meaning: { sk: 'Ak príde nečakaný výdavok počas poklesu, môžete byť nútení predať Bitcoin so stratou.', en: 'If an unexpected cost comes during a fall, you may have to sell Bitcoin at a loss.' },
      todo: { sk: 'Určte, na koľko mesiacov výdavkov vám vystačia peniaze mimo Bitcoinu. Bežne sa uvádza aspoň 6.', en: 'Set how many months of expenses your money outside Bitcoin covers. At least 6 is the usual benchmark.' },
    },
    mid: {
      meaning: { sk: 'Rezervu máte, ale nie je jasné, na koľko mesiacov vystačí.', en: "You have a reserve, but it's not clear how many months it covers." },
      todo: { sk: 'Napíšte, na koľko mesiacov výdavkov rezerva vystačí.', en: 'Write down how many months of expenses the reserve covers.' },
    },
    high: {
      short: { sk: 'máte rezervu mimo Bitcoinu', en: 'you have a reserve outside Bitcoin' },
      meaning: { sk: 'Bežné aj nečakané výdavky pokryjete bez predaja Bitcoinu.', en: 'You can cover normal and unexpected costs without selling Bitcoin.' },
      todo: { sk: 'Nič netreba. Rezervu nechajte mimo Bitcoinu.', en: 'Nothing needed. Keep the reserve outside Bitcoin.' },
    },
  },
  tax: {
    title: { sk: 'Dane pri predaji', en: 'Tax when you sell' },
    q: { sk: 'Akú daň zaplatíte pri predaji a koľko si na ňu odložíte?', en: 'What tax will you pay when you sell, and how much will you set aside?' },
    low: {
      short: { sk: 'neviete, akú daň zaplatíte pri predaji', en: "you don't know what tax you'd pay when you sell" },
      meaning: { sk: 'Daň môže zobrať výraznú časť zisku. {country_rule}', en: 'Tax can take a large part of the gain. {country_rule}' },
      todo: { sk: 'Zistite v Tax & Inheritance Agent, ako sa predaj zdaní {country}, a koľko si odložiť.', en: 'Find out in the Tax & Inheritance Agent how a sale is taxed {country} and how much to set aside.' },
    },
    mid: {
      meaning: { sk: 'Viete, že daň vznikne, ale nemáte pravidlo ani sumu.', en: "You know tax applies, but you don't have the rule or the amount." },
      todo: { sk: 'Overte sadzbu a pravidlo {country} a spočítajte daň pri zisku 50 %.', en: 'Check the rate and rule {country} and work out the tax on a 50% gain.' },
    },
    high: {
      short: { sk: 'viete, ako sa zdaní predaj {country}', en: 'you know how a sale is taxed {country}' },
      meaning: { sk: 'Poznáte pravidlo pre svoju krajinu a máte odloženú sumu na daň.', en: 'You know the rule for your country and have set the tax aside.' },
      todo: { sk: 'Nič netreba. Uschovajte si záznamy o nákupoch.', en: 'Nothing needed. Keep records of your purchases.' },
    },
  },
  custody: {
    title: { sk: 'Kľúče a dedičia', en: 'Keys and heirs' },
    q: { sk: 'Kto bude držať kľúče a ako sa k Bitcoinu dostanú vaši blízki?', en: 'Who will hold the keys, and how would your family reach the Bitcoin?' },
    low: {
      short: { sk: 'nie je jasné, kto drží kľúče a ako sa k Bitcoinu dostanú blízki', en: "it's not clear who holds the keys or how your family would reach the Bitcoin" },
      meaning: { sk: 'Ak burza zlyhá alebo sa vám niečo stane, Bitcoin môže byť nedostupný.', en: 'If the exchange fails or something happens to you, the Bitcoin may be out of reach.' },
      todo: { sk: 'Napíšte, kde Bitcoin bude a kto sa k nemu dostane bez toho, aby dopredu poznal seed frázu.', en: 'Write down where the Bitcoin will be and who can reach it without knowing the seed phrase in advance.' },
    },
    mid: {
      meaning: { sk: 'Úschovu máte zvolenú, ale chýba postup pre dedičov.', en: "You've chosen custody, but there's no procedure for heirs." },
      todo: { sk: 'Pripravte jednoduchý postup pre dedičov v Tax & Inheritance Agent.', en: 'Prepare a simple procedure for heirs in the Tax & Inheritance Agent.' },
    },
    high: {
      short: { sk: 'máte vyriešenú úschovu aj prístup pre dedičov', en: "you've sorted custody and access for heirs" },
      meaning: { sk: 'Úschova, obnova aj prístup pre dedičov sú opísané.', en: "Custody, recovery and heirs' access are described." },
      todo: { sk: 'Nič netreba. Postup raz ročne overte.', en: 'Nothing needed. Check the procedure once a year.' },
    },
  },
  plan_b: {
    title: { sk: 'Plán B', en: 'Plan B' },
    q: { sk: 'Čo urobíte, ak sa hlavný predpoklad nenaplní?', en: 'What will you do if your main assumption fails?' },
    low: {
      short: { sk: 'nemáte plán, ak sa hlavný predpoklad nenaplní', en: 'you have no plan if the main assumption fails' },
      meaning: { sk: 'Ak sa niečo zmení (práca, príjem, cena), nebudete mať pripravený krok.', en: "If something changes (job, income, price), you won't have a step ready." },
      todo: { sk: 'Napíšte jednu vetu: „Ak sa stane X, urobím Y.“', en: 'Write one sentence: "If X happens, I will do Y."' },
    },
    mid: {
      meaning: { sk: 'Náhradný postup máte len všeobecne.', en: 'Your fallback is only general.' },
      todo: { sk: 'Doplňte konkrétny spúšťač (suma, dátum, udalosť) a konkrétny krok.', en: 'Add a concrete trigger (amount, date, event) and a concrete step.' },
    },
    high: {
      short: { sk: 'máte plán B s konkrétnym spúšťačom', en: 'you have a plan B with a concrete trigger' },
      meaning: { sk: 'Viete, čo urobíte, keď predpoklad neplatí.', en: "You know what you'll do if an assumption fails." },
      todo: { sk: 'Nič netreba.', en: 'Nothing needed.' },
    },
  },
  goal: {
    title: { sk: 'Cieľ s číslom a dátumom', en: 'A goal with a number and a date' },
    q: { sk: 'Akú sumu chcete dosiahnuť a do kedy?', en: 'What amount do you want to reach, and by when?' },
    low: {
      short: { sk: 'nie je jasné, čo má rozhodnutie dosiahnuť', en: "it's not clear what the decision should achieve" },
      meaning: { sk: 'Bez cieľa neviete posúdiť, či plán funguje.', en: "Without a goal you can't tell whether the plan works." },
      todo: { sk: 'Napíšte cieľ s číslom a dátumom, napríklad „30 000 € do roku 2035“.', en: 'Write a goal with a number and a date, for example "€30,000 by 2035".' },
    },
    mid: {
      meaning: { sk: 'Cieľ máte, ale bez čísla alebo termínu.', en: 'You have a goal, but without a number or a date.' },
      todo: { sk: 'Doplňte k cieľu sumu a rok.', en: 'Add an amount and a year to the goal.' },
    },
    high: {
      short: { sk: 'máte cieľ s číslom a dátumom', en: 'you have a goal with a number and a date' },
      meaning: { sk: 'Viete, čo chcete dosiahnuť a dokedy.', en: 'You know what you want to achieve and by when.' },
      todo: { sk: 'Nič netreba.', en: 'Nothing needed.' },
    },
  },
  horizon: {
    title: { sk: 'Kedy budete peniaze potrebovať', en: "When you'll need the money" },
    q: { sk: 'Ako dlho budete držať a čo by vás prinútilo predať skôr?', en: 'How long will you hold, and what would force an earlier sale?' },
    low: {
      short: { sk: 'neviete, kedy budete tieto peniaze potrebovať', en: "you don't know when you'll need this money" },
      meaning: { sk: 'Bitcoin môže roky stáť pod nákupnou cenou. Ak peniaze budete potrebovať skôr, môžete predávať so stratou.', en: 'Bitcoin can stay below your purchase price for years. If you need the money earlier, you may sell at a loss.' },
      todo: { sk: 'Napíšte, ako dlho budete držať a čo by vás prinútilo predať skôr.', en: "Write down how long you'll hold and what would force an earlier sale." },
    },
    mid: {
      meaning: { sk: 'Horizont máte, ale chýba, čo by vás prinútilo predať skôr.', en: 'You have a horizon, but not what would force an earlier sale.' },
      todo: { sk: 'Doplňte jednu udalosť, pri ktorej by ste predali skôr.', en: 'Add one event that would make you sell earlier.' },
    },
    high: {
      short: { sk: 'viete, ako dlho budete držať', en: "you know how long you'll hold" },
      meaning: { sk: 'Horizont sedí s cieľom a viete, čo by ho zmenilo.', en: 'The horizon fits the goal and you know what would change it.' },
      todo: { sk: 'Nič netreba.', en: 'Nothing needed.' },
    },
  },
  alternatives: {
    title: { sk: 'Porovnanie s inými možnosťami', en: 'Compared with other options' },
    q: { sk: 'S akou inou možnosťou ste to porovnali a prečo ste zvolili túto?', en: 'What other option did you compare it with, and why this one?' },
    low: {
      short: { sk: 'neporovnali ste to s inou možnosťou', en: "you haven't compared it with another option" },
      meaning: { sk: 'Neviete, či by tie isté peniaze nesplnili cieľ inak alebo lacnejšie.', en: "You don't know whether the same money could meet the goal another way or at a lower cost." },
      todo: { sk: 'Porovnajte aspoň dve možnosti (napr. ETF, splatenie dlhu, iný spôsob nákupu) a napíšte, prečo táto. Poplatky porovnáte v Indexe poplatkov.', en: 'Compare at least two options (e.g. an ETF, paying off debt, another way to buy) and write down why this one. Compare fees in the Fee Index.' },
    },
    mid: {
      meaning: { sk: 'Jednu inú možnosť ste spomenuli, ale bez porovnania.', en: 'You named one other option, without comparing.' },
      todo: { sk: 'Doplňte druhú možnosť a dôvod voľby.', en: 'Add a second option and the reason for your choice.' },
    },
    high: {
      short: { sk: 'porovnali ste aspoň dve možnosti', en: 'you compared at least two options' },
      meaning: { sk: 'Viete, prečo ste si vybrali práve toto.', en: 'You know why you chose this.' },
      todo: { sk: 'Nič netreba.', en: 'Nothing needed.' },
    },
  },
  rule: {
    title: { sk: 'Pravidlo namiesto emócií', en: 'A rule instead of emotions' },
    q: { sk: 'Podľa akého pravidla dokúpite alebo predáte a kedy ho zmeníte?', en: 'By what rule will you buy more or sell, and when would you change it?' },
    low: {
      short: { sk: 'nemáte napísané pravidlo, kedy dokúpite alebo predáte', en: 'you have no written rule for when to buy more or sell' },
      meaning: { sk: 'Bez pravidla sa ľahko rozhoduje podľa správ a nálady na trhu.', en: "Without a rule it's easy to decide by the news and market mood." },
      todo: { sk: 'Napíšte si pravidlo, napr. „Kupujem 200 € mesačne, nič nemením pri poklese.“ Nastavíte ho v Stacking Strategist.', en: 'Write a rule, e.g. "I buy €200 a month and change nothing in a fall." Set it up in the Stacking Strategist.' },
    },
    mid: {
      meaning: { sk: 'Pravidlo máte v hlave, ale nie napísané a bez podmienky na zmenu.', en: 'You have a rule in your head, not written and without a condition for changing it.' },
      todo: { sk: 'Napíšte pravidlo vrátane toho, kedy ho zmeníte.', en: "Write the rule down, including when you'd change it." },
    },
    high: {
      short: { sk: 'máte napísané pravidlo', en: 'you have a written rule' },
      meaning: { sk: 'Rozhodujete podľa vopred daného pravidla.', en: 'You decide by a rule set in advance.' },
      todo: { sk: 'Nič netreba.', en: 'Nothing needed.' },
    },
  },
  asymmetry: {
    title: { sk: 'Veľkosť, ktorú unesiete', en: 'A size you can live with' },
    q: { sk: 'Akú stratu unesiete bez toho, aby sa vám zmenil život?', en: 'What loss can you carry without changing your life?' },
    low: {
      short: { sk: 'neviete, akú stratu unesiete bez zmeny života', en: "you don't know what loss you can carry without changing your life" },
      meaning: { sk: 'Ak je suma príliš veľká, pokles vám môže zmeniť život.', en: 'If the amount is too big, a fall could change your life.' },
      todo: { sk: 'Určte, akú stratu unesiete bez zmeny života, a podľa nej sumu.', en: 'Set the loss you can carry without changing your life, and size the amount from it.' },
    },
    mid: {
      meaning: { sk: 'Podiel na majetku poznáte, ale nie je zdôvodnený stratou, ktorú unesiete.', en: "You know the share of your wealth, but it isn't justified by a loss you can carry." },
      todo: { sk: 'Doplňte vetu: „Ak by som prišiel o celú sumu, …“', en: 'Complete the sentence: "If I lost the whole amount, …"' },
    },
    high: {
      short: { sk: 'suma zodpovedá strate, ktorú unesiete', en: 'the amount matches a loss you can carry' },
      meaning: { sk: 'Veľkosť je odôvodnená stratou, ktorú unesiete.', en: 'The size is justified by a loss you can carry.' },
      todo: { sk: 'Nič netreba.', en: 'Nothing needed.' },
    },
  },
  fees: {
    title: { sk: 'Poplatky', en: 'Fees' },
    meaning: { sk: 'Poplatky pri nákupe sa medzi poskytovateľmi líšia; pri pravidelnom nákupe sa sčítajú každý rok.', en: 'Purchase fees differ between providers; with regular buying they add up every year.' },
    todo: { sk: 'Porovnajte poplatky pre vašu sumu v Indexe poplatkov.', en: 'Compare fees for your amount in the Fee Index.' },
  },
};

// Russian texts of AREA_COPY (same structure; merged below). Formal «вы»,
// "%" without a space like the ru/ pages. Needs a native-speaker review.
const AREA_RU = {
  worst_case: {
    title: 'Что вы сделаете при обвале',
    q: 'Что вы сделаете, если Биткоин упадёт на 70%?',
    low: {
      short: 'вы не знаете, что сделаете, если Биткоин упадёт на 70%',
      meaning: 'Биткоин уже несколько раз падал на 70% и больше. Без плана при таком падении решения принимаются в стрессе.',
      todo: 'Посчитайте, что у вас останется при падении на 70% ({drop}), и запишите, что вы тогда сделаете.',
    },
    mid: {
      meaning: 'Вы знаете, как поступите, но не посчитали это в евро.',
      todo: 'Добавьте сумму в евро и срок, который вы продержитесь без продажи.',
    },
    high: {
      short: 'вы знаете, что сделаете при падении на 70%',
      meaning: 'Падение на 70% у вас посчитано вместе с планом, как его пережить.',
      todo: 'Ничего не нужно. Сохраните план, чтобы при обвале он был под рукой.',
    },
  },
  liquidity: {
    title: 'Резерв вне Биткоина',
    q: 'На сколько месяцев расходов хватит ваших денег вне Биткоина?',
    low: {
      short: 'у вас нет чёткого резерва вне Биткоина',
      meaning: 'Если во время падения возникнет непредвиденный расход, вам, возможно, придётся продать Биткоин с убытком.',
      todo: 'Определите, на сколько месяцев расходов хватит ваших денег вне Биткоина. Обычно указывают не меньше 6.',
    },
    mid: {
      meaning: 'Резерв у вас есть, но неясно, на сколько месяцев его хватит.',
      todo: 'Запишите, на сколько месяцев расходов хватит резерва.',
    },
    high: {
      short: 'у вас есть резерв вне Биткоина',
      meaning: 'Обычные и непредвиденные расходы вы покроете без продажи Биткоина.',
      todo: 'Ничего не нужно. Оставьте резерв вне Биткоина.',
    },
  },
  tax: {
    title: 'Налог при продаже',
    q: 'Какой налог вы заплатите при продаже и сколько отложите на него?',
    low: {
      short: 'вы не знаете, какой налог заплатите при продаже',
      meaning: 'Налог может забрать значительную часть прибыли. {country_rule}',
      todo: 'Узнайте в Tax & Inheritance Agent, как облагается продажа {country} и сколько отложить на налог.',
    },
    mid: {
      meaning: 'Вы знаете, что налог возникнет, но не знаете ни правила, ни суммы.',
      todo: 'Проверьте ставку и правило {country} и посчитайте налог при прибыли 50%.',
    },
    high: {
      short: 'вы знаете, как облагается продажа {country}',
      meaning: 'Вы знаете правило для своей страны и отложили сумму на налог.',
      todo: 'Ничего не нужно. Сохраняйте записи о покупках.',
    },
  },
  custody: {
    title: 'Ключи и наследники',
    q: 'Кто будет хранить ключи и как ваши близкие получат доступ к Биткоину?',
    low: {
      short: 'неясно, кто хранит ключи и как близкие получат доступ к Биткоину',
      meaning: 'Если биржа обанкротится или с вами что-то случится, Биткоин может оказаться недоступным.',
      todo: 'Запишите, где будет Биткоин и кто получит к нему доступ, не зная заранее сид-фразу.',
    },
    mid: {
      meaning: 'Способ хранения выбран, но нет порядка действий для наследников.',
      todo: 'Подготовьте простой порядок действий для наследников в Tax & Inheritance Agent.',
    },
    high: {
      short: 'у вас решены хранение и доступ для наследников',
      meaning: 'Хранение, восстановление и доступ для наследников описаны.',
      todo: 'Ничего не нужно. Раз в год проверяйте порядок действий.',
    },
  },
  plan_b: {
    title: 'План Б',
    q: 'Что вы сделаете, если главное предположение не оправдается?',
    low: {
      short: 'у вас нет плана на случай, если главное предположение не оправдается',
      meaning: 'Если что-то изменится (работа, доход, цена), у вас не будет готового шага.',
      todo: 'Запишите одно предложение: «Если случится X, я сделаю Y».',
    },
    mid: {
      meaning: 'Запасной вариант у вас есть только в общих чертах.',
      todo: 'Добавьте конкретный триггер (сумма, дата, событие) и конкретный шаг.',
    },
    high: {
      short: 'у вас есть план Б с конкретным триггером',
      meaning: 'Вы знаете, что сделаете, если предположение не оправдается.',
      todo: 'Ничего не нужно.',
    },
  },
  goal: {
    title: 'Цель с суммой и датой',
    q: 'Какой суммы вы хотите достичь и к какому сроку?',
    low: {
      short: 'неясно, чего должно достичь решение',
      meaning: 'Без цели вы не можете оценить, работает ли план.',
      todo: 'Запишите цель с суммой и датой, например «30 000 € к 2035 году».',
    },
    mid: {
      meaning: 'Цель у вас есть, но без суммы или срока.',
      todo: 'Добавьте к цели сумму и год.',
    },
    high: {
      short: 'у вас есть цель с суммой и датой',
      meaning: 'Вы знаете, чего хотите достичь и к какому сроку.',
      todo: 'Ничего не нужно.',
    },
  },
  horizon: {
    title: 'Когда вам понадобятся деньги',
    q: 'Как долго вы будете держать Биткоин и что может заставить вас продать раньше?',
    low: {
      short: 'вы не знаете, когда вам понадобятся эти деньги',
      meaning: 'Биткоин может годами стоить ниже цены покупки. Если деньги понадобятся раньше, возможно, придётся продавать с убытком.',
      todo: 'Запишите, как долго вы будете держать Биткоин и что может заставить вас продать раньше.',
    },
    mid: {
      meaning: 'Горизонт у вас есть, но не указано, что может заставить вас продать раньше.',
      todo: 'Добавьте одно событие, при котором вы продали бы раньше.',
    },
    high: {
      short: 'вы знаете, как долго будете держать Биткоин',
      meaning: 'Горизонт согласуется с целью, и вы знаете, что может его изменить.',
      todo: 'Ничего не нужно.',
    },
  },
  alternatives: {
    title: 'Сравнение с другими вариантами',
    q: 'С каким другим вариантом вы это сравнили и почему выбрали этот?',
    low: {
      short: 'вы не сравнили это с другим вариантом',
      meaning: 'Вы не знаете, могли бы те же деньги достичь цели иначе или дешевле.',
      todo: 'Сравните как минимум два варианта (например, ETF, погашение долга, другой способ покупки) и запишите, почему выбрали этот. Комиссии сравните в Индексе комиссий.',
    },
    mid: {
      meaning: 'Один другой вариант вы назвали, но без сравнения.',
      todo: 'Добавьте второй вариант и причину выбора.',
    },
    high: {
      short: 'вы сравнили как минимум два варианта',
      meaning: 'Вы знаете, почему выбрали именно это.',
      todo: 'Ничего не нужно.',
    },
  },
  rule: {
    title: 'Правило вместо эмоций',
    q: 'По какому правилу вы будете докупать или продавать и когда его измените?',
    low: {
      short: 'у вас нет записанного правила, когда докупать или продавать',
      meaning: 'Без правила легко принимать решения под влиянием новостей и настроения рынка.',
      todo: 'Запишите правило, например «Покупаю на 200 € в месяц и ничего не меняю при падении». Настроить его можно в Stacking Strategist.',
    },
    mid: {
      meaning: 'Правило у вас в голове, но оно не записано и в нём нет условия, когда его менять.',
      todo: 'Запишите правило, включая то, когда вы его измените.',
    },
    high: {
      short: 'у вас есть записанное правило',
      meaning: 'Вы принимаете решения по заранее заданному правилу.',
      todo: 'Ничего не нужно.',
    },
  },
  asymmetry: {
    title: 'Размер, который вы выдержите',
    q: 'Какую потерю вы выдержите, не меняя свою жизнь?',
    low: {
      short: 'вы не знаете, какую потерю выдержите без изменений в жизни',
      meaning: 'Если сумма слишком велика, падение может изменить вашу жизнь.',
      todo: 'Определите, какую потерю вы выдержите без изменений в жизни, и по ней выберите сумму.',
    },
    mid: {
      meaning: 'Долю в своём капитале вы знаете, но она не обоснована потерей, которую вы выдержите.',
      todo: 'Дополните предложение: «Если бы я потерял всю сумму, …»',
    },
    high: {
      short: 'сумма соответствует потере, которую вы выдержите',
      meaning: 'Размер обоснован потерей, которую вы выдержите.',
      todo: 'Ничего не нужно.',
    },
  },
  fees: {
    title: 'Комиссии',
    meaning: 'Комиссии при покупке у разных провайдеров отличаются; при регулярных покупках они суммируются каждый год.',
    todo: 'Сравните комиссии для вашей суммы в Индексе комиссий.',
  },
};
(function mergeRu(dst, src) {
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === 'string') dst[k].ru = v;
    else mergeRu(dst[k], v);
  }
})(AREA_COPY, AREA_RU);

export function areaLevel(points) { return points >= 7 ? 'high' : points >= 4 ? 'mid' : 'low'; }

// The fixed one-line tax fact for the person's country, from the same data as
// the tax pages (tax-facts.js). Only with VERDICT_TAX_MODULE on.
export function countryRule(country, lang) {
  const c = TAX.countries.find((x) => x.id === country);
  if (!c) return '';
  const L = lk(lang);
  if (L === 'ru') {
    if (!c.ru) return '';
    const loc = COUNTRY_LOC.ru[country];
    // Lower-case first letter after the colon (ru/ pages' style), but keep acronyms.
    const lc = (t) => /^\p{Lu}\p{Lu}/u.test(t) ? t : t[0].toLowerCase() + t.slice(1);
    return `${cap(loc)}: ${lc(c.ru.gainTax)}${c.ru.healthLevyShort ? ', ' + c.ru.healthLevyShort : ''}. ${c.ru.exemption}. (По состоянию на ${TAX.asOf.split('-').reverse().join(' ')})`;
  }
  if (L === 'sk') {
    if (!c.sk) return '';
    const loc = COUNTRY_LOC.sk[country];
    return `${loc[0].toUpperCase() + loc.slice(1)}: ${c.sk.gainTax}${c.sk.healthLevyShort ? ', ' + c.sk.healthLevyShort : ''}. ${c.sk.exemption}. (Stav: ${TAX.asOf.split('-').reverse().join(' ')})`;
  }
  return `${COUNTRY_LOC.en[country].replace(/^in /, 'In ')}: ${c.gainTax}. ${c.exemption}. (As of ${TAX.asOf.split('-').reverse().join(' ')})`;
}

// ctx: { lang, profile, taxModule }
export function fill(str, ctx) {
  const L = lk(ctx.lang);
  const p = ctx.profile || {};
  const listed = p.country && p.country !== 'other' && COUNTRY_LOC[L][p.country];
  const drop = DROP[L][p.amount];
  return String(str)
    .replace(' ({drop})', drop ? ` (${drop})` : '')
    .replace('{drop}', drop || '')
    .replace('{country_rule}', listed && ctx.taxModule ? countryRule(p.country, L) : '')
    .replace(/\{country\}/g, listed ? COUNTRY_LOC[L][p.country] : NO_COUNTRY[L].loc)
    .replace(/\{countryName\}/g, listed ? COUNTRY_NAME[L][p.country] : NO_COUNTRY[L].name)
    .replace(/\s+$/, '');
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// ── Red flags (§2.2): facts in the answers or the code only. Table order.
export const RED_FLAGS = [
  { id: 'rf_reserve', test: (p) => p.reserve === 'no' && p.horizon === 'lt1',
    text: { sk: 'Peniaze môžete potrebovať do roka a nemáte rezervu mimo Bitcoinu.', en: 'You may need the money within a year and have no reserve outside Bitcoin.', ru: 'Деньги могут понадобиться вам в течение года, а резерва вне Биткоина у вас нет.' },
    action: { sk: 'Určte rezervu aspoň na 6 mesiacov výdavkov mimo Bitcoinu, skôr než budete pokračovať.', en: 'Set aside a reserve of at least 6 months of expenses outside Bitcoin before you go on.', ru: 'Определите резерв не меньше чем на 6 месяцев расходов вне Биткоина, прежде чем продолжать.' }, tool: 'loan' },
  { id: 'rf_share', test: (p) => p.share === 'gt50',
    text: { sk: 'Do Bitcoinu má ísť viac ako polovica vašich úspor a investícií.', en: 'More than half of your savings and investments would be in Bitcoin.', ru: 'В Биткоин должно пойти больше половины ваших сбережений и инвестиций.' },
    action: { sk: 'Spočítajte, čo by pokles o 70 % urobil s celým vaším majetkom, nie len s touto sumou.', en: 'Work out what a 70% fall would do to your whole wealth, not just this amount.', ru: 'Посчитайте, что падение на 70% сделает со всем вашим капиталом, а не только с этой суммой.' }, tool: 'retirement' },
  { id: 'rf_ltv', test: (p) => p.goal === 'loan' && (p.ltv === 'gt50' || p.liqprice === 'no'),
    text: { sk: 'Pri pôžičke nepoznáte cenu likvidácie alebo je LTV nad 50 %.', en: "For the loan, you don't know the liquidation price or the LTV is above 50%.", ru: 'По займу вы не знаете цену ликвидации, или LTV выше 50%.' },
    action: { sk: 'Zistite cenu likvidácie a spočítajte LTV pri poklese o 50 %.', en: 'Find out the liquidation price and work out the LTV after a 50% fall.', ru: 'Узнайте цену ликвидации и посчитайте LTV при падении на 50%.' }, tool: 'loan' },
  { id: 'rf_tax', test: (p, full) => !!full.taxRuleWrong,
    text: { sk: 'Pravidlo zdanenia, ktoré uvádzate, nesedí s verejnými pravidlami {country}.', en: "The tax rule you state doesn't match the public rules {country}.", ru: 'Правило налогообложения, которое вы указываете, не совпадает с публичными правилами {country}.' },
    action: { sk: 'Overte pravidlo zdanenia pre {countryName} v Tax & Inheritance Agent.', en: 'Check the tax rule for {countryName} in the Tax & Inheritance Agent.', ru: 'Проверьте правило налогообложения для {countryName} в Tax & Inheritance Agent.' }, tool: 'tax' },
  { id: 'rf_runway', test: (p) => p.goal === 'treasury' && p.runway === 'lt12',
    text: { sk: 'Firma bez Bitcoinu vydrží menej ako 12 mesiacov.', en: 'The company can run for less than 12 months without the Bitcoin.', ru: 'Компания без Биткоина продержится меньше 12 месяцев.' },
    action: { sk: 'Spočítajte, na koľko mesiacov vystačí firme hotovosť bez Bitcoinu.', en: "Work out how many months the company's cash lasts without the Bitcoin.", ru: 'Посчитайте, на сколько месяцев компании хватит денег без Биткоина.' }, tool: 'treasury' },
];

export function redFlags(full, profile = {}) {
  return RED_FLAGS.filter((f) => f.test(profile, full));
}

const HEAD = {
  ready: { sk: 'Plán je premyslený.', en: 'Your plan is thought through.', ru: 'План продуман.' },
  almost: { sk: (n) => `Takmer hotové: doplňte ${n} ${n === 1 ? 'vec' : 'veci'}.`, en: (n) => `Almost there: add ${n} ${n === 1 ? 'thing' : 'things'}.`, ru: (n) => `Почти готово: дополните ${n} ${n === 1 ? 'пункт' : 'пункта'}.` },
  basics: { sk: 'Ešte nie: najprv doplňte základy.', en: 'Not yet: fill in the basics first.', ru: 'Пока нет: сначала дополните основу плана.' },
  redflag: { sk: 'Stop: v pláne je červená vlajka.', en: 'Stop: there is a red flag in your plan.', ru: 'Стоп: в плане есть красный флаг.' },
};
export const LEVEL_HEADLINES = HEAD;

function byWeak(a, b) { return a.points - b.points || a.priority - b.priority; }

// The template "why" (§2.4): strongest high phrase + weakest low phrase.
export function whyTemplate(full, ctx) {
  const L = lk(ctx.lang);
  const sigs = full.signals;
  const weak = sigs.find((s) => s.id === full.weakest.id) || [...sigs].sort(byWeak)[0];
  const strong = [...sigs].filter((s) => s.points >= 7 && s.id !== weak.id).sort((a, b) => b.points - a.points || a.priority - b.priority)[0];
  const lo = (s) => fill(AREA_COPY[s.id].low.short[L], ctx);
  if (strong) return cap(`${fill(AREA_COPY[strong.id].high.short[L], ctx)}${{ sk: ', ale ', en: ', but ', ru: ', но ' }[L]}${lo(weak)}.`);
  const weak2 = [...sigs].filter((s) => s.id !== weak.id).sort(byWeak)[0];
  return cap(`${lo(weak)}${{ sk: ' a ', en: ' and ', ru: ' и ' }[L]}${lo(weak2)}.`);
}

// §2.1: level computed in code, never by the model.
export function verdictLevel(full, profile = {}, ctx = {}) {
  const L = lk(ctx.lang);
  const c = { ...ctx, lang: L, profile };
  const flags = redFlags(full, profile);
  const below7 = full.signals.filter((s) => s.points < 7).length;
  let id;
  if (flags.length) id = 'redflag';
  else if (full.score < 50) id = 'basics';
  else if (full.score >= 65 && full.signals.every((s) => s.points >= 4)) id = 'ready';
  else id = 'almost';
  const n = Math.max(1, Math.min(3, below7));
  const h = HEAD[id][L];
  const why = flags.length ? fill(flags[0].text[L], c) : (full.summary || whyTemplate(full, c));
  return {
    id,
    headline: typeof h === 'function' ? h(n) : h,
    why,
    flags: flags.map((f) => ({ id: f.id, text: fill(f.text[L], c) })),
    more: Math.max(0, flags.length - 1),
    scoreLine: {
      sk: `Skóre ${full.score}/100 meria, nakoľko úplne je plán opísaný, nie či je Bitcoin dobrá voľba.`,
      en: `The ${full.score}/100 score measures how complete the plan is, not whether Bitcoin is a good choice.`,
      ru: `Оценка ${full.score}/100 показывает, насколько полно описан план, а не то, хороший ли выбор Биткоин.`,
    }[L],
  };
}

// Tool of a signal for this person (§3.1 remap): worst_case → Loan Copilot,
// alternatives → Fee Index (buy, dca) or sell vs borrow.
export const TOOL_PAGES = {
  loan: { page: 'loan.html', name: { sk: 'Loan & Liquidity Copilot', en: 'Loan & Liquidity Copilot', ru: 'Loan & Liquidity Copilot' } },
  tax: { page: 'tax-agent.html', name: { sk: 'Tax & Inheritance Agent', en: 'Tax & Inheritance Agent', ru: 'Tax & Inheritance Agent' } },
  stacking: { page: 'stacking.html', name: { sk: 'Stacking Strategist', en: 'Stacking Strategist', ru: 'Stacking Strategist' } },
  retirement: { page: 'retirement-calculator.html', name: { sk: 'Dôchodková kalkulačka', en: 'Retirement Calculator', ru: 'Пенсионный калькулятор' } },
  treasury: { page: 'treasury.html', name: { sk: 'Bitcoin vo firme', en: 'Bitcoin treasury', ru: 'Биткоин в компании' } },
  fees: { page: { sk: '/sk/bitcoin-index-poplatkov/', en: '/bitcoin-fee-index/', ru: '/ru/bitcoin-indeks-komissiy/' }, name: { sk: 'Index poplatkov', en: 'Bitcoin Fee Index', ru: 'Индекс комиссий' } },
  svb: { page: { sk: '/sk/bitcoin-predat-alebo-pozicat/', en: '/sell-vs-borrow-bitcoin/', ru: '/ru/bitcoin-prodat-ili-zanyat/' }, name: { sk: 'Predať, alebo požičať', en: 'Sell or borrow', ru: 'Продать или занять' } },
};
const SIGNAL_TOOL = { worst_case: 'loan', liquidity: 'loan', tax: 'tax', custody: 'tax', plan_b: 'loan', goal: 'retirement', horizon: 'stacking', rule: 'stacking', asymmetry: 'retirement' };

// Review 2026-10-27 (P1.3): the Loan Copilot only for a loan or a sale
// (sell vs borrow); a buy, regular buying or custody case works on its
// worst case, plan B and reserve in the Stacking Strategist (amount, rhythm,
// what to do in a fall), a company in the treasury page. No goal known:
// unchanged (Loan Copilot).
const LOAN_PATH = ['loan', 'sell'];
export function toolKeyFor(id, profile = {}) {
  if (id === 'alternatives') return ['buy', 'dca'].includes(profile.goal) || !profile.goal ? 'fees' : 'svb';
  if (['worst_case', 'plan_b', 'liquidity'].includes(id) && profile.goal && !LOAN_PATH.includes(profile.goal)) return profile.goal === 'treasury' ? 'treasury' : 'stacking';
  return SIGNAL_TOOL[id];
}
export function tool(key, lang, profile = {}) {
  const L = lk(lang);
  const t = TOOL_PAGES[key];
  const params = {};
  if (key === 'tax' && profile.country && profile.country !== 'other') params.country = profile.country;
  if ((key === 'loan' || key === 'stacking') && profile.amount) params.amount = profile.amount;
  return { key, page: typeof t.page === 'string' ? t.page : t.page[L], name: t.name[L], params };
}

// What the area card says (§4): plain title, meaning, what to do.
export function areaView(s, role, ctx) {
  const L = lk(ctx.lang);
  const lvl = areaLevel(s.points);
  const C = AREA_COPY[s.id][lvl];
  return {
    id: s.id, role, title: AREA_COPY[s.id].title[L], name: s.name, points: s.points, level: lvl,
    meaning: fill(C.meaning[L], ctx),
    todo: s.points < 7 && s.fix ? s.fix : fill(C.todo[L], ctx),
    reason: s.reason,
    tool: tool(toolKeyFor(s.id, ctx.profile), L, ctx.profile),
  };
}

const FILLERS = {
  pdf: { sk: 'Uložte si verdikt a vráťte sa k nemu pred nákupom.', en: 'Save this verdict and come back to it before you act.', ru: 'Сохраните вердикт и вернитесь к нему, прежде чем действовать.' },
  partners: { sk: 'Porovnajte partnerov nižšie podľa poplatkov a úschovy.', en: 'Compare the partners below by fees and custody.', ru: 'Сравните партнёров ниже по комиссиям и способу хранения.' },
  consult: { sk: 'Prejdite si plán 15 minút s človekom.', en: 'Go through the plan with a person for 15 minutes.', ru: 'Обсудите план за 15 минут с человеком.' },
  recheck: { sk: 'Prejdite si verdikt znova, keď sa vo vašom pláne niečo zmení.', en: 'Go through the verdict again when something in your plan changes.', ru: 'Проверьте вердикт заново, когда в вашем плане что-то изменится.' },
};

// §3.1: always exactly 3 steps. ctx.report: the PDF filler is report-only.
export function nextSteps(full, profile = {}, level, ctx = {}) {
  const L = lk(ctx.lang);
  const c = { ...ctx, lang: L, profile };
  const steps = [];
  const used = new Set();
  const acts = new Set();
  const add = (s) => { if (steps.length >= 3 || acts.has(s.action)) return; acts.add(s.action); if (s.tool) used.add(s.tool.key); steps.push({ n: steps.length + 1, ...s }); };
  const flags = level && level.id === 'redflag' ? redFlags(full, profile) : [];
  if (flags.length) {
    const f = flags[0];
    add({ id: f.id, kind: 'flag', signal: null, action: fill(f.action[L], c), why: fill(f.text[L], c), tool: tool(f.tool, L, profile) });
  }
  const weak = full.signals.filter((s) => s.points < 7).sort(byWeak);

  const signalStep = (s) => {
    const lvl = areaLevel(s.points);
    return { id: s.id, kind: 'signal', signal: s.id, action: s.fix || fill(AREA_COPY[s.id][lvl].todo[L], c), why: fill(AREA_COPY[s.id][lvl].meaning[L], { ...c, taxModule: false }), tool: tool(toolKeyFor(s.id, profile), L, profile) };
  };
  // Buy + custody/inheritance (P1.1): the custody gap gets one of the 3 steps,
  // right after the weakest one, even when its tool is already used.
  const cust = weak.find((s) => s.id === 'custody');
  if (profile.also === 'custody' && cust) { if (weak[0] !== cust) add(signalStep(weak[0])); add(signalStep(cust)); }
  for (const s of weak) { const st = signalStep(s); if (!used.has(st.tool.key)) add(st); }
  for (const s of weak) add(signalStep(s));
  // Free view: no PDF (report only), so "rate again" is the third filler.
  for (const k of (ctx.report ? ['pdf', 'partners', 'consult', 'recheck'] : ['partners', 'consult', 'recheck'])) {
    add({ id: k, kind: 'filler', signal: null, action: FILLERS[k][L], why: '', tool: null });
  }
  return steps;
}

// ── Validation of the model's free sentences (§5.3). Invalid → template.
export function startsWithVerb(t, lang) {
  return VERBS[lk(lang)].some((v) => t.startsWith(v + ' ') || t.startsWith(v + ','));
}
function langOk(t, L) {
  if (L === 'ru') return RU_CHARS.test(t) && !SK_CHARS.test(t);
  if (RU_CHARS.test(t)) return false;
  if (L === 'sk') return SK_CHARS.test(t) || /\b(a|ale|že|sa|je|nie|ste|máte|pri|na|do|ako)\b/i.test(t);
  return !SK_CHARS.test(t);
}
// \b is ASCII-only in JS, so Russian words get their own letter-boundary patterns.
const JARGON_RU = /(^|[^\p{L}])(сигнал|област|рубрик|профил|балл)\p{L}*/iu;
const IMPERATIVE_RU = /(^|[^\p{L}])(купите|докупите|продайте|займите|подождите|держите|переведите|выберите)(?![\p{L}])/iu;
const JARGON = /\b(signal|signál\w*|area|oblas\w*|score|skóre|rubric|rubrik\w*|profile|profil\w*)\b|\/10|\bbod(y|ov|u|ami)?\b/i;
const PARTNER_RE = new RegExp('\\b(' + PARTNER_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
const IMPERATIVE_ACT = /\b(kúpte|nakúpte|dokúpte|predajte|požičajte|počkajte|držte|presuňte|vyberte si)\b|\b(buy|sell|borrow|hold) (now|more|some|all|it|part|half|your|the|bitcoin|btc)\b/i;

export function validSummary(t, lang, BANNED, signalNames) {
  const L = lk(lang);
  if (typeof t !== 'string') return false;
  const s = t.trim();
  if (s.length < 20 || s.length > 160) return false;
  if (BANNED.some((re) => re.test(s)) || JARGON.test(s) || JARGON_RU.test(s) || !langOk(s, L)) return false;
  // A signal used as a label: an id (worst_case, plan_b) or a display name
  // written with its capital mid-sentence ("v oblasti Dane"). Ordinary words
  // like "daň", "cieľ" or "tax" are allowed (live test 2026-10-23: a plain
  // substring check rejected every model summary).
  if (signalNames.some((n) => /_/.test(n) ? s.includes(n) : new RegExp('(^|[^\\p{L}])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}])', 'u').test(s.slice(1)))) return false;
  return true;
}
export function validFix(t, lang, BANNED) {
  const L = lk(lang);
  if (typeof t !== 'string') return false;
  const s = t.trim();
  if (s.length < 15 || s.length > 120) return false;
  if (!startsWithVerb(s, L) || !langOk(s, L)) return false;
  if (BANNED.some((re) => re.test(s)) || PARTNER_RE.test(s) || IMPERATIVE_ACT.test(s) || IMPERATIVE_RU.test(s)) return false;
  return true;
}

// "Whether to act is your own decision" belongs in missing only when the text
// itself asked whether to act (prompt rule); the funnel's focus answers are
// topics, not a request for advice.
export const OWN_DECISION = /(vaše vlastné rozhodnutie|vaším vlastným rozhodnutím|your own decision|ваше собственное решение|ваше личное решение|решать вам)/i;
export function asksWhetherToAct(text) {
  return /\?/.test(text || '') && /(mám|mal[a]? by som|oplatí sa|kúpiť alebo|predať alebo|alebo počkať|should i|is it (a good|worth)|or wait|buy or|sell or|стоит ли|мне (купить|продать|подождать)|купить или|продать или|или подождать)/i.test(text || '');
}

// The pricing block data (§7). mode: waitlist until Stripe is live.
export function pricing(opts = {}) {
  return {
    report: { price_eur: 14, mode: opts.checkout ? 'checkout' : 'waitlist', taxModule: !!opts.taxModule },
    consult: { price_eur: 0 },
    cfo: { price_eur_month: 9, price_eur_year: 90, opens: null }, // no launch date (Ras 2026-10-27)
  };
}
