import * as F from '../core/format'
import type { Lang } from '../core/format'
import type { RadarItem } from '../core/radar'

export type Page = 'dashboard' | 'ask' | 'research' | 'radar' | 'portfolio' | 'transactions' | 'data'

const SK = {
  nav: { dashboard: 'Prehľad', ask: 'Opýtaj sa CFO', research: 'Výskum', radar: 'Radar', portfolio: 'Portfólio', transactions: 'Transakcie', data: 'Údaje a súkromie' } as Record<Page, string>,
  hello: (name: string) => (name ? `Dobrý deň, ${name}` : 'Váš prehľad'),
  demoChip: 'Ukážka: Anna',
  ownChip: 'Vlastné údaje',
  proto: 'Prototyp',
  menu: 'Menu',
  close: 'Zavrieť',
  investments: 'Investície',
  investmentsSub: 'Bitcoin, akcie a ETF',
  cash: 'Hotovosť',
  assets: 'Majetok',
  allAssets: 'Majetok spolu',
  liabilities: 'Záväzky',
  allLiabilities: 'Záväzky spolu',
  movers: 'Dnešné pohyby',
  moversEmpty: 'Žiadne pozície s dennou cenou.',
  pricesAsOf: (d: string) => `Posledný obchodný deň, ceny k ${d}.`,
  askTitle: 'Opýtaj sa CFO',
  askPlaceholder: 'Napíšte otázku o svojich číslach…',
  askSend: 'Opýtať sa',
  radarTitle: 'Radar',
  radarAll: 'Celý Radar →',
  radarEmpty: 'Nič nové. Radar sleduje pohyby, poplatky, dlhy a chýbajúce údaje.',
  emptyTitle: 'Zatiaľ tu nič nie je',
  emptyLead: 'Načítajte export z búrzy alebo brokera, prípadne pridajte majetok ručne.',
  emptyCta: 'Pridať údaje',
  demoReadOnly: 'V ukážke sa údaje nedajú meniť. Prepnite na „Vlastné údaje“.',
  // Ask
  chats: 'Rozhovory',
  newChat: 'Nový rozhovor',
  deleteChat: 'Vymazať',
  untitled: 'Nový rozhovor',
  askLead: 'Odpovede počíta aplikácia z vašich údajov priamo v tomto zariadení. Jazykový model AI pribudne vo fáze 3.',
  sources: 'Zdroje',
  adviceTag: 'Mimo rozsahu',
  askNote: 'Virtuse CFO ukazuje fakty o vašich číslach. Nehovorí, čo kúpiť, predať alebo držať.',
  chatsNotSaved: 'Rozhovory sa neukladajú. Po zatvorení okna zmiznú.',
  // Research
  researchLead: 'Nástroje, ktoré držíte, s údajmi z cenníka Virtuse, a príručky Virtuse k nim.',
  yourInstruments: 'Vaše nástroje',
  noInstruments: 'Zatiaľ žiadne nástroje s cenou. Načítajte export brokera.',
  isin: 'ISIN',
  lastClose: 'Posledná uzatváracia cena',
  dayMove: 'Zmena za deň',
  yourPosition: 'Vaša pozícia',
  heldAt: 'Kde',
  share: 'Podiel na majetku',
  virtuseGuides: 'Na Virtuse',
  guides: [
    ['Index poplatkov za Bitcoin', 'https://virtuse.com/bitcoin-fee-index/'],
    ['Výnosy tried aktív podľa rokov', 'https://virtuse.com/asset-returns.html'],
    ['Daň z Bitcoinu na Slovensku', 'https://virtuse.com/sk/bitcoin-dane/slovensko/'],
    ['Bitcoin: predať, alebo si požičať', 'https://virtuse.com/sk/bitcoin-predat-alebo-pozicat/'],
    ['Virtuse Brief: týždenný prehľad', 'https://virtuse.com/sk/news.html'],
  ] as [string, string][],
  newTopic: 'Nová téma na výskum',
  newTopicPh: 'Napr. ako sa zdaňujú dividendy z írskych ETF na Slovensku',
  newTopicNote: 'Výskum s citovanými zdrojmi (2–5 minút) pribudne vo fáze 3. Témy, ktoré sem zapíšete, si zatiaľ ukladáme len v tomto okne.',
  addTopic: 'Zapísať tému',
  queued: 'Čaká na fázu 3',
  // Radar
  radarLead: 'Veci, ktoré stoja za pozornosť, vypočítané z vašich údajov v tomto zariadení. Len fakty, žiadne odporúčania.',
  watch: 'Sledovať',
  info: 'Na vedomie',
  settings: 'Čo Radar sleduje',
  moveTh: 'Denný pohyb pozície od',
  feeTh: 'Poplatky za Bitcoin od',
  concTh: 'Jedna pozícia tvorí od',
  cashTh: 'Hotovosť tvorí od',
  kinds: { move: 'Pohyby', fees: 'Poplatky', concentration: 'Rozloženie', debt: 'Dlhy', cash: 'Hotovosť', data: 'Údaje', custody: 'Úschova' } as Record<RadarItem['kind'], string>,
  // Portfolio
  portfolioLead: 'Všetko, čo má trhovú cenu: Bitcoin a pozície u brokerov.',
  colName: 'Nástroj',
  colWhere: 'Kde',
  colQty: 'Množstvo',
  colValue: 'Hodnota',
  colShare: 'Podiel',
  colDay: 'Dnes',
  colBasis: 'Cena',
  basisBtc: 'cena BTC',
  // Transactions
  txLead: 'Pohyby Bitcoinu z exportu Kraken. Brokerské pohyby sú zhrnuté v Portfóliu.',
  txNone: 'Žiadne transakcie. Načítajte export Kraken v sekcii Údaje a súkromie.',
  colDate: 'Dátum',
  colType: 'Typ',
  colEur: 'EUR',
  colFee: 'Poplatok',
  txKinds: { buy: 'Nákup', sell: 'Predaj', deposit: 'Vklad BTC', withdrawal: 'Výber do peňaženky', other: 'Iné' } as Record<string, string>,
  all: 'Všetko',
  // Data
  dataLead: 'Importy, ručne zadaný majetok, šifrované uloženie a to, čo by opustilo vaše zariadenie.',
}

type S = typeof SK

const EN: S = {
  nav: { dashboard: 'Overview', ask: 'Ask your CFO', research: 'Research', radar: 'Radar', portfolio: 'Portfolio', transactions: 'Transactions', data: 'Data and privacy' },
  hello: (name: string) => (name ? `Good day, ${name}` : 'Your overview'),
  demoChip: 'Demo: Anna',
  ownChip: 'My data',
  proto: 'Prototype',
  menu: 'Menu',
  close: 'Close',
  investments: 'Investments',
  investmentsSub: 'Bitcoin, stocks and ETFs',
  cash: 'Cash',
  assets: 'Assets',
  allAssets: 'Total assets',
  liabilities: 'Debts',
  allLiabilities: 'Total debts',
  movers: 'Today’s moves',
  moversEmpty: 'No holdings with a daily price.',
  pricesAsOf: (d: string) => `Last trading day, prices as of ${d}.`,
  askTitle: 'Ask your CFO',
  askPlaceholder: 'Ask about your numbers…',
  askSend: 'Ask',
  radarTitle: 'Radar',
  radarAll: 'Open Radar →',
  radarEmpty: 'Nothing new. Radar watches moves, fees, debts and missing data.',
  emptyTitle: 'Nothing here yet',
  emptyLead: 'Load an exchange or broker export, or add assets by hand.',
  emptyCta: 'Add data',
  demoReadOnly: 'The demo cannot be edited. Switch to “My data”.',
  chats: 'Chats',
  newChat: 'New chat',
  deleteChat: 'Delete',
  untitled: 'New chat',
  askLead: 'Answers are worked out from your data on this device. An AI language model comes in phase 3.',
  sources: 'Sources',
  adviceTag: 'Out of scope',
  askNote: 'Virtuse CFO shows facts about your numbers. It does not say what to buy, sell or hold.',
  chatsNotSaved: 'Chats are not saved. They disappear when you close the window.',
  researchLead: 'The instruments you hold, with data from the Virtuse price file, and Virtuse guides.',
  yourInstruments: 'Your instruments',
  noInstruments: 'No priced instruments yet. Load a broker export.',
  isin: 'ISIN',
  lastClose: 'Last close',
  dayMove: 'Day’s move',
  yourPosition: 'Your position',
  heldAt: 'Held at',
  share: 'Share of assets',
  virtuseGuides: 'On Virtuse',
  guides: [
    ['Bitcoin Fee Index', 'https://virtuse.com/bitcoin-fee-index/'],
    ['Asset class returns by year', 'https://virtuse.com/asset-returns.html'],
    ['Bitcoin tax in Slovakia', 'https://virtuse.com/bitcoin-tax/slovakia/'],
    ['Sell or borrow against Bitcoin', 'https://virtuse.com/sell-vs-borrow-bitcoin/'],
    ['Virtuse Brief: the weekly desk', 'https://virtuse.com/news.html'],
  ],
  newTopic: 'New research topic',
  newTopicPh: 'E.g. how dividends from Irish ETFs are taxed in Slovakia',
  newTopicNote: 'Research with cited sources (2–5 minutes) comes in phase 3. Topics you add are kept in this window only for now.',
  addTopic: 'Add topic',
  queued: 'Waiting for phase 3',
  radarLead: 'Things worth a look, worked out from your data on this device. Facts only, no recommendations.',
  watch: 'Watch',
  info: 'For your information',
  settings: 'What Radar watches',
  moveTh: 'Daily move of a holding from',
  feeTh: 'Bitcoin fees from',
  concTh: 'One holding is at least',
  cashTh: 'Cash is at least',
  kinds: { move: 'Moves', fees: 'Fees', concentration: 'Mix', debt: 'Debts', cash: 'Cash', data: 'Data', custody: 'Custody' },
  portfolioLead: 'Everything with a market price: Bitcoin and broker positions.',
  colName: 'Instrument',
  colWhere: 'Where',
  colQty: 'Quantity',
  colValue: 'Value',
  colShare: 'Share',
  colDay: 'Today',
  colBasis: 'Price',
  basisBtc: 'BTC price',
  txLead: 'Bitcoin movements from the Kraken export. Broker activity is summed up in Portfolio.',
  txNone: 'No transactions. Load a Kraken export under Data and privacy.',
  colDate: 'Date',
  colType: 'Type',
  colEur: 'EUR',
  colFee: 'Fee',
  txKinds: { buy: 'Buy', sell: 'Sell', deposit: 'BTC deposit', withdrawal: 'Withdrawal to wallet', other: 'Other' },
  all: 'All',
  dataLead: 'Imports, assets you enter, encrypted saving and what would leave your device.',
}

export function app(lang: Lang): S {
  return lang === 'sk' ? SK : EN
}

/** One radar item as a title and a "why you see this" line. */
export function radarText(item: RadarItem, lang: Lang): { title: string; why: string } {
  const v = item.vars
  const sk = lang === 'sk'
  const pct = (n: number | string, d = 0) => F.pct(Number(n), lang, d)
  const eur = (n: number | string, d = 0) => F.eur(Number(n), lang, d)
  switch (item.code) {
    case 'move':
      return {
        title: sk ? `${v.symbol} sa za deň pohol o ${Number(v.pct) > 0 ? '+' : ''}${pct(v.pct, 2)} (${eur(v.eur)}).` : `${v.symbol} moved ${Number(v.pct) > 0 ? '+' : ''}${pct(v.pct, 2)} in a day (${eur(v.eur)}).`,
        why: sk ? 'Pohyb prekročil prah, ktorý ste nastavili.' : 'The move crossed the threshold you set.',
      }
    case 'fees_btc':
      return {
        title: sk ? `Na poplatkoch za Bitcoin ste zaplatili ${eur(v.eur)}, ${pct(v.pct, 2)} z nákupov.` : `You paid ${eur(v.eur)} in Bitcoin fees, ${pct(v.pct, 2)} of your buys.`,
        why: sk ? 'Index poplatkov Virtuse porovnáva zverejnené poplatky partnerov.' : 'The Virtuse Fee Index compares partners’ published fees.',
      }
    case 'fees_brokers':
      return { title: sk ? `Poplatky u brokerov: ${eur(v.eur, 2)}.` : `Broker fees: ${eur(v.eur, 2)}.`, why: sk ? 'Súčet z vašich exportov za obdobia, ktoré pokrývajú.' : 'Total from your exports over the periods they cover.' }
    case 'concentration':
      return { title: sk ? `${v.symbol} tvorí ${pct(v.pct)} vášho majetku.` : `${v.symbol} is ${pct(v.pct)} of your assets.`, why: sk ? 'Najväčšia pozícia prekročila prah, ktorý ste nastavili.' : 'Your largest holding crossed the threshold you set.' }
    case 'real_estate':
      return { title: sk ? `Nehnuteľnosti tvoria ${pct(v.pct)} vášho majetku.` : `Property is ${pct(v.pct)} of your assets.`, why: sk ? 'Viac ako polovica majetku je v jednej triede.' : 'More than half of your assets are in one class.' }
    case 'debt_ratio':
      return { title: sk ? `Záväzky ${eur(v.eur)} zodpovedajú ${pct(v.pct)} vášho majetku.` : `Debts of ${eur(v.eur)} equal ${pct(v.pct)} of your assets.`, why: sk ? 'Počítané zo záväzkov, ktoré ste zadali.' : 'From the debts you entered.' }
    case 'cash_share':
      return { title: sk ? `Hotovosť ${eur(v.eur)} tvorí ${pct(v.pct)} majetku.` : `Cash of ${eur(v.eur)} is ${pct(v.pct)} of your assets.`, why: sk ? 'Podiel hotovosti prekročil prah, ktorý ste nastavili.' : 'The cash share crossed the threshold you set.' }
    case 'own_wallet':
      return { title: sk ? `Bitcoin ste ${v.n}× vybrali z búrzy do vlastnej peňaženky.` : `You withdrew Bitcoin from the exchange to your own wallet ${v.n} times.`, why: sk ? 'Coiny vo vlastnej úschove počítame ako vaše, odpočítame len poplatok siete.' : 'Coins in your own custody count as yours; only the network fee is deducted.' }
    case 'prices_stale':
      return { title: sk ? `Cenník je z ${F.date(String(v.date), lang)}.` : `The price file is from ${F.date(String(v.date), lang)}.`, why: sk ? 'Hodnoty pozícií môžu byť staršie ako tri dni.' : 'Holding values may be more than three days old.' }
    case 'missing_positions':
      return { title: sk ? `${v.broker}: chýba súbor s otvorenými pozíciami.` : `${v.broker}: the open positions file is missing.`, why: sk ? 'Bez neho nepoznáme hodnotu investícií.' : 'Without it the investments have no value.' }
    case 'missing_cash':
      return { title: sk ? `${v.broker}: chýba súbor s peňažnými operáciami.` : `${v.broker}: the cash operations file is missing.`, why: sk ? 'Bez neho chýba hotovosť, vklady a poplatky.' : 'Without it cash, deposits and fees are missing.' }
    case 'unpriced':
      return { title: sk ? `${v.broker}: ${v.n} ${Number(v.n) === 1 ? 'pozícia nemá' : 'pozície nemajú'} cenu v cenníku.` : `${v.broker}: ${v.n} holding(s) have no price in the price file.`, why: sk ? 'Sú započítané v nákupnej cene.' : 'They count at purchase price.' }
    default:
      return { title: item.code, why: '' }
  }
}
