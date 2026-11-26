// Price book: ECB rates + last closes for a published list of instruments.
// The app downloads the whole book (same file for everyone) and matches
// holdings locally, so no ticker or amount leaves the device.

import { round2, type BrokerAccount, type Holding } from './brokers'

export interface PricedInstrument {
  id: string
  isin?: string
  name: string
  aliases: string[]
  price: number
  /** Close the trading day before, for the day's move. */
  prevClose?: number
  /** Day's move in percent. */
  changePct?: number
  currency: string
  date: string
  stale?: boolean
}

export interface PriceBook {
  /** Month-end BTC/EUR close by 'YYYY-MM' (the current month = latest close). */
  btcMonthlyEur?: Record<string, number>
  builtAt: string
  fx: { source: string; date: string; perEur: Record<string, number> }
  prices: { source: string; instruments: PricedInstrument[] }
}

/** Amount in `currency` → EUR at the ECB rate. null when the rate is unknown. */
export function toEur(amount: number, currency: string, book: PriceBook | null): number | null {
  if (currency === 'EUR') return amount
  const rate = book?.fx.perEur[currency.toUpperCase()]
  return rate ? amount / rate : null
}

const norm = (s: string) => s.trim().toUpperCase()

export function findInstrument(h: Pick<Holding, 'symbol' | 'isin'>, book: PriceBook | null): PricedInstrument | null {
  if (!book) return null
  const list = book.prices.instruments
  if (h.isin) {
    const byIsin = list.find((i) => i.isin && norm(i.isin) === norm(h.isin!))
    if (byIsin) return byIsin
  }
  const sym = norm(h.symbol)
  return list.find((i) => i.aliases.some((a) => norm(a) === sym)) ?? null
}

export function btcPriceEur(book: PriceBook | null): number | null {
  const b = book?.prices.instruments.find((i) => i.id === 'BTC')
  return b ? toEur(b.price, b.currency, book) : null
}

export type ValueBasis = 'price' | 'broker' | 'cost' | 'none'

export interface ValuedHolding extends Holding {
  valueEur: number
  basis: ValueBasis
  priceDate?: string
  changePct?: number
  instrumentName?: string
}

/**
 * Values every holding in EUR. Order of preference:
 * 1. quantity × Virtuse price (converted at the ECB rate),
 * 2. the broker's own value (converted if needed),
 * 3. purchase price in EUR.
 */
export function valueHoldings(account: BrokerAccount, book: PriceBook | null): ValuedHolding[] {
  return account.holdings.map((h) => {
    const ins = findInstrument(h, book)
    if (ins) {
      const eur = toEur(h.quantity * ins.price, ins.currency, book)
      if (eur !== null) return { ...h, valueEur: round2(eur), basis: 'price', priceDate: ins.date, changePct: ins.changePct, instrumentName: ins.name }
    }
    if (h.value !== undefined) {
      const eur = toEur(h.value, h.currency, book)
      if (eur !== null) return { ...h, valueEur: round2(eur), basis: 'broker' }
    }
    if (h.costEur !== undefined) return { ...h, valueEur: h.costEur, basis: 'cost' }
    return { ...h, valueEur: 0, basis: 'none' }
  })
}

export interface Revalued {
  account: BrokerAccount
  holdings: ValuedHolding[]
  /** Holdings valued at purchase price or not at all. */
  unpriced: number
}

/** Account with investments re-valued from its holdings, when it lists them. */
export function revalue(account: BrokerAccount, book: PriceBook | null): Revalued {
  const holdings = valueHoldings(account, book)
  if (!account.has.positions || holdings.length === 0) return { account, holdings, unpriced: 0 }
  const unpriced = holdings.filter((h) => h.basis === 'cost' || h.basis === 'none').length
  const investedValueEur = round2(holdings.reduce((s, h) => s + h.valueEur, 0))
  return {
    account: { ...account, investedValueEur, valuedAt: unpriced === holdings.length ? 'cost' : 'market' },
    holdings,
    unpriced,
  }
}
