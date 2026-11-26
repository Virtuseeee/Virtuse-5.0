// "Ask your CFO", prototype version: answers questions about the user's own
// numbers from the data on the device. No AI model yet (phase 3), no network.
// Questions asking what to buy, sell or hold, or where prices will go, get a
// fixed reply: Virtuse CFO states facts and does not give investment advice.

import * as F from './format'
import type { Lang } from './format'
import { BROKER_NAMES, type BrokerSource } from './brokers'
import { dayMoveEur, portfolioRows } from './holdings'
import type { Profile } from './model'
import { overview } from './portfolio'
import type { PriceBook } from './prices'
import { skTaxYears } from './tax-sk'
import { cashFlow, type Category } from './bank'

export interface Answer {
  kind: 'answer' | 'advice' | 'unknown'
  /** Written by the AI model from rounded totals (AI Act art. 50 label). */
  ai?: boolean
  lines: string[]
  sources: string[]
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const ADVICE = /\b(kupit|kup|predat|predaj|mal by som|mala by som|oplati|investovat do|odporuc|poradi|kedy kupit|kam pojde|predpoved|bude rast|bude klesat|should i|(i|to|we) (buy|sell)|buy (more|now|some)|sell (my|now|some|all)|worth it|recommend|forecast|will .* (go|rise|fall)|good time|hold or|najlepsi|(je|bolo by) (teraz |to )?(dobry cas|rozumne)|odporucis|nemal(a)? by som|rebalanc|stoji za to|klesne|stupne|pravdepodobnost|which (broker|etf|stock|holding|exchange)|would it be (sensible|wise)|shouldn.?t i|better to (hold|buy|sell)|would you (buy|sell)|odds|in \d+ years|will the market|where will)\b/

const has = (q: string, re: RegExp) => re.test(q)

export function ask(question: string, profile: Profile, priceEur: number, book: PriceBook | null, lang: Lang): Answer {
  const q = fold(question)
  const sk = lang === 'sk'
  const o = overview(profile, priceEur, book)
  const rows = portfolioRows(profile, priceEur, book, o.assetsEur)
  const eur = (n: number, d = 0) => F.eur(n, lang, d)
  const pct = (n: number, d = 1) => F.pct(n, lang, d)
  const src = {
    kraken: sk ? 'Export Kraken (vo vašom zariadení)' : 'Kraken export (on your device)',
    manual: sk ? 'Majetok a záväzky, ktoré ste zadali' : 'Assets and debts you entered',
    prices: book ? (sk ? `Cenník Virtuse k ${F.date(book.fx.date, lang)} (ECB, posledné uzatváracie ceny)` : `Virtuse price file, ${F.date(book.fx.date, lang)} (ECB, last closes)`) : '',
  }
  const brokerSrc = (b: BrokerSource) => (sk ? `Export ${BROKER_NAMES[b]}` : `${BROKER_NAMES[b]} export`)
  const allBrokerSrc = (profile.brokers ?? []).map((b) => brokerSrc(b.source))

  if (has(q, ADVICE)) {
    return {
      kind: 'advice',
      lines: sk
        ? ['Na toto vám neodpoviem: Virtuse CFO nehovorí, čo kúpiť, predať alebo držať, ani kam pôjdu ceny. Nie je to investičné poradenstvo.', 'Môžem vám ukázať fakty o vašich vlastných číslach: rozdelenie majetku, poplatky, pozície alebo dnešné pohyby.']
        : ['I will not answer that: Virtuse CFO does not say what to buy, sell or hold, or where prices will go. It is not investment advice.', 'I can show you facts about your own numbers: how your assets split, fees, holdings or today’s moves.'],
      sources: [],
    }
  }

  const out = (lines: string[], sources: string[]): Answer => ({ kind: 'answer', lines, sources: sources.filter(Boolean) })

  // A specific broker.
  for (const b of profile.brokers ?? []) {
    const names: Record<BrokerSource, RegExp> = { xtb: /\bxtb\b/, ibkr: /\b(ibkr|interactive)\b/, t212: /\b(t212|trading ?212)\b/ }
    if (has(q, names[b.source])) {
      const r = rows.filter((x) => x.source === b.source)
      const value = r.reduce((s, x) => s + x.valueEur, 0)
      return out(
        [
          sk ? `${BROKER_NAMES[b.source]}: investície ${eur(value)}, hotovosť ${eur(b.cashEur)}.` : `${BROKER_NAMES[b.source]}: investments ${eur(value)}, cash ${eur(b.cashEur)}.`,
          ...r.slice(0, 5).map((x) => `${x.symbol}: ${eur(x.valueEur)} (${pct(x.sharePct)} ${sk ? 'majetku' : 'of assets'})`),
          b.has.cash ? (sk ? `Poplatky ${eur(b.feesEur, 2)}, dividendy a úroky ${eur(b.dividendsEur, 2)}.` : `Fees ${eur(b.feesEur, 2)}, dividends and interest ${eur(b.dividendsEur, 2)}.`) : '',
        ].filter(Boolean),
        [brokerSrc(b.source), src.prices],
      )
    }
  }

  if (has(q, /\bdan|\btax|priznan|odvod/)) {
    const y = skTaxYears(profile.txs)[0]
    if (!y) return out([sk ? 'V načítaných údajoch nie je žiadny predaj Bitcoinu, takže z nich nevzniká daň. Presun do vlastnej peňaženky nie je predaj.' : 'The loaded data has no Bitcoin sale, so there is nothing to tax from it. Moving coins to your own wallet is not a sale.'], [src.kraken])
    const lines = [
      sk ? `Rok ${y.year}: predaje ${eur(y.proceedsEur)}, náklady podľa FIFO ${eur(y.costEur)}, zisk ${eur(y.netEur)}.` : `${y.year}: sales ${eur(y.proceedsEur)}, FIFO cost ${eur(y.costEur)}, gain ${eur(y.netEur)}.`,
    ]
    if (y.incomeTaxEur !== null) lines.push(sk ? `Odhad dane z príjmov ${eur(y.incomeTaxEur, 2)} a zdravotných odvodov ${eur(y.healthEur ?? 0, 2)}, ak nemáte iné ostatné príjmy podľa § 8.` : `Estimated income tax ${eur(y.incomeTaxEur, 2)} and health contributions ${eur(y.healthEur ?? 0, 2)}, if you have no other § 8 income.`)
    lines.push(sk ? `Daňové priznanie typu B do ${F.date(y.dueDate, lang)}. Je to odhad, nie daňové poradenstvo; podrobnosti na obrazovke Dane.` : `Type B return due ${F.date(y.dueDate, lang)}. An estimate, not tax advice; details on the Tax screen.`)
    return out(lines, [src.kraken, sk ? 'Finančná správa: pravidlá pre kryptoaktíva a sadzby 2026' : 'Slovak tax office: crypto-asset rules and 2026 rates'])
  }

  if (has(q, /minul|minula|vydav|vydaj|prijm|cash flow|spend|spent|income|predplat|subscription/)) {
    const flows = cashFlow(profile.banks ?? [])
    if (!flows.length) return out([sk ? 'Nemám načítaný bankový výpis. Pridajte ho v sekcii Údaje a súkromie.' : 'No bank statement loaded. Add one under Data and privacy.'], [])
    const thisMonth = new Date().toISOString().slice(0, 7)
    const wantsLast = /minul\w* mesiac|predchadzajuc|last month|previous month/.test(q)
    const f = (wantsLast ? flows.filter((x) => x.month < thisMonth).pop() : undefined) ?? flows[flows.length - 1]
    const names: Record<Category, [string, string]> = { income: ['Príjem', 'Income'], groceries: ['Potraviny', 'Groceries'], housing: ['Bývanie a energie', 'Housing and utilities'], transport: ['Doprava', 'Transport'], eating_out: ['Jedlo vonku', 'Eating out'], subscriptions: ['Predplatné', 'Subscriptions'], shopping: ['Nákupy', 'Shopping'], health: ['Zdravie', 'Health'], investing: ['Investovanie', 'Investing'], transfers: ['Prevody', 'Transfers'], cash: ['Hotovosť', 'Cash'], other: ['Ostatné', 'Other'] }
    const top = Object.entries(f.byCategory).filter(([c]) => c !== 'investing' && c !== 'transfers').sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0)).slice(0, 4)
    return out(
      [
        sk ? `${f.month}: príjmy ${eur(f.incomeEur)}, výdavky ${eur(f.spendingEur)}, rozdiel ${eur(f.netEur)}.` : `${f.month}: income ${eur(f.incomeEur)}, spending ${eur(f.spendingEur)}, difference ${eur(f.netEur)}.`,
        ...top.map(([c, v]) => `${names[c as Category][sk ? 0 : 1]}: ${eur(v ?? 0, 2)}`),
        f.byCategory.investing ? (sk ? `Investovanie (mimo výdavkov): ${eur(f.byCategory.investing)}.` : `Investing (not counted as spending): ${eur(f.byCategory.investing)}.`) : '',
      ].filter(Boolean),
      [sk ? 'Bankový výpis (vo vašom zariadení)' : 'Bank statement (on your device)'],
    )
  }

  if (has(q, /poplat|fee|naklad|cost/)) {
    const lines = [
      sk ? `Bitcoin: zaplatili ste ${eur(o.bitcoin.feesEur, 2)} na poplatkoch, to je ${pct(o.bitcoin.feePct, 2)} z ${eur(o.bitcoin.boughtEur)} nákupov.` : `Bitcoin: you paid ${eur(o.bitcoin.feesEur, 2)} in fees, ${pct(o.bitcoin.feePct, 2)} of ${eur(o.bitcoin.boughtEur)} in buys.`,
    ]
    if (o.brokers.feesEur > 0) lines.push(sk ? `Brokeri: ${eur(o.brokers.feesEur, 2)} za obdobia v exportoch.` : `Brokers: ${eur(o.brokers.feesEur, 2)} over the periods in the exports.`)
    return out(lines, [src.kraken, ...allBrokerSrc])
  }

  if (has(q, /bitcoin|\bbtc\b|satoshi/)) {
    const b = o.bitcoin
    return out(
      [
        sk ? `Držíte ${F.btc(b.btc, lang)}, dnes v hodnote ${eur(b.valueEur)} pri cene ${eur(priceEur)}.` : `You hold ${F.btc(b.btc, lang)}, worth ${eur(b.valueEur)} today at ${eur(priceEur)}.`,
        sk ? `Vložili ste ${eur(b.netInvestedEur)} (${b.buys} nákupov, priemerná cena ${eur(b.avgBuyPrice)}).` : `You put in ${eur(b.netInvestedEur)} (${b.buys} buys, average price ${eur(b.avgBuyPrice)}).`,
        sk ? `Bitcoin tvorí ${pct(o.btcSharePct)} vášho majetku.` : `Bitcoin is ${pct(o.btcSharePct)} of your assets.`,
      ],
      [src.kraken, src.prices],
    )
  }

  if (has(q, /dnes|pohyb|zmen|today|move|moved/)) {
    const moved = rows.filter((r) => r.changePct !== undefined).sort((a, b) => Math.abs(dayMoveEur(b)) - Math.abs(dayMoveEur(a)))
    if (moved.length === 0) return out([sk ? 'Pre vaše pozície nemám denné pohyby.' : 'I have no daily moves for your holdings.'], [src.prices])
    const total = moved.reduce((s, r) => s + dayMoveEur(r), 0)
    return out(
      [
        sk ? `Za posledný obchodný deň sa hodnota vašich pozícií zmenila o ${eur(total)}.` : `Over the last trading day your holdings changed by ${eur(total)}.`,
        ...moved.slice(0, 5).map((r) => `${r.symbol}: ${r.changePct! > 0 ? '+' : ''}${pct(r.changePct!, 2)} (${eur(dayMoveEur(r))})`),
      ],
      [src.prices],
    )
  }

  if (has(q, /najvac|pozici|drzim|co mam|holding|largest|biggest|position/)) {
    return out(
      [
        sk ? 'Vaše najväčšie pozície:' : 'Your largest holdings:',
        ...rows.slice(0, 6).map((r) => `${r.symbol} (${r.where}): ${eur(r.valueEur)}, ${pct(r.sharePct)} ${sk ? 'majetku' : 'of assets'}`),
      ],
      [src.kraken, ...allBrokerSrc, src.prices],
    )
  }

  if (has(q, /rozdel|alokac|podiel|allocation|split|mix/)) {
    const names: Record<string, [string, string]> = { bitcoin: ['Bitcoin', 'Bitcoin'], cash: ['Hotovosť', 'Cash'], stocks: ['Akcie a ETF', 'Stocks and ETFs'], real_estate: ['Nehnuteľnosti', 'Property'], pension: ['Dôchodok', 'Pension'], other: ['Iné', 'Other'] }
    return out(
      o.allocation.map((s) => `${names[s.assetClass][sk ? 0 : 1]}: ${pct(s.pct)} (${eur(s.valueEur)})`),
      [src.kraken, ...allBrokerSrc, src.manual, src.prices],
    )
  }

  if (has(q, /dlh|hypot|zavaz|uver|debt|mortgage|loan/)) {
    if (o.liabilitiesEur === 0) return out([sk ? 'Nemáte zadané žiadne záväzky.' : 'You have not entered any debts.'], [src.manual])
    return out(
      [
        ...profile.liabilities.map((l) => `${l.name}: ${eur(l.balanceEur)}`),
        sk ? `Záväzky spolu ${eur(o.liabilitiesEur)}, to je ${pct((o.liabilitiesEur / o.assetsEur) * 100)} vášho majetku.` : `Debts total ${eur(o.liabilitiesEur)}, ${pct((o.liabilitiesEur / o.assetsEur) * 100)} of your assets.`,
      ],
      [src.manual],
    )
  }

  if (has(q, /dividend|urok|interest|income|prijem/)) {
    return out(
      (profile.brokers ?? []).filter((b) => b.has.cash).map((b) => `${BROKER_NAMES[b.source]}: ${eur(b.dividendsEur, 2)}${b.taxWithheldEur ? (sk ? `, zrazená daň ${eur(b.taxWithheldEur, 2)}` : `, tax withheld ${eur(b.taxWithheldEur, 2)}`) : ''}`),
      allBrokerSrc,
    )
  }

  if (has(q, /hotovost|cash|uspor|savings/)) {
    const c = o.allocation.find((s) => s.assetClass === 'cash')
    return out([sk ? `Hotovosť a úspory: ${eur(c?.valueEur ?? 0)}, ${pct(c?.pct ?? 0)} majetku.` : `Cash and savings: ${eur(c?.valueEur ?? 0)}, ${pct(c?.pct ?? 0)} of assets.`], [src.manual, ...allBrokerSrc])
  }

  if (has(q, /majet|net worth|worth|kolko mam|how much|celkom|total/)) {
    return out(
      [
        sk ? `Čistý majetok ${eur(o.netWorthEur)}: majetok ${eur(o.assetsEur)} mínus záväzky ${eur(o.liabilitiesEur)}.` : `Net worth ${eur(o.netWorthEur)}: assets ${eur(o.assetsEur)} minus debts ${eur(o.liabilitiesEur)}.`,
      ],
      [src.kraken, ...allBrokerSrc, src.manual, src.prices],
    )
  }

  return {
    kind: 'unknown',
    lines: sk
      ? ['Tomu zatiaľ nerozumiem. Prototyp odpovedá na otázky o vašich číslach, napríklad: čistý majetok, rozdelenie, Bitcoin, poplatky, najväčšie pozície, dnešné pohyby, dlhy, dividendy alebo konkrétny broker.']
      : ['I do not understand that yet. The prototype answers questions about your numbers, such as net worth, allocation, Bitcoin, fees, largest holdings, today’s moves, debts, dividends or a specific broker.'],
    sources: [],
  }
}

export const SUGGESTED: Record<Lang, string[]> = {
  sk: ['Koľko som minul minulý mesiac?', 'Aký je môj čistý majetok?', 'Ako mám rozdelený majetok?', 'Koľko som zaplatil na poplatkoch?', 'Čo sa dnes najviac pohlo?', 'Aké sú moje najväčšie pozície?', 'Mám kúpiť viac Bitcoinu?'],
  en: ['How much did I spend last month?', 'What is my net worth?', 'How are my assets split?', 'How much have I paid in fees?', 'What moved most today?', 'What are my largest holdings?', 'Should I buy more Bitcoin?'],
}
