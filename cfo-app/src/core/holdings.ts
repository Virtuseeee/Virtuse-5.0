// One list of everything the user holds that has a market price:
// Bitcoin from exchange imports plus positions from every broker.

import { BROKER_NAMES, type BrokerSource } from './brokers'
import type { Profile } from './model'
import { bitcoinFacts } from './portfolio'
import { revalue, type PriceBook, type ValueBasis } from './prices'

export interface PortfolioRow {
  key: string
  symbol: string
  name?: string
  where: string
  source: BrokerSource | 'kraken'
  quantity: number
  valueEur: number
  /** Share of all assets (the overview's total), in percent. */
  sharePct: number
  changePct?: number
  basis: ValueBasis | 'btc'
}

export function portfolioRows(profile: Profile, priceEur: number, book: PriceBook | null, assetsEur: number): PortfolioRow[] {
  const rows: PortfolioRow[] = []
  const btc = bitcoinFacts(profile, priceEur)
  if (btc.btc > 0) {
    rows.push({
      key: 'btc',
      symbol: 'BTC',
      name: 'Bitcoin',
      where: profile.txs.length ? 'Kraken' : '—',
      source: 'kraken',
      quantity: btc.btc,
      valueEur: btc.valueEur,
      sharePct: 0,
      changePct: book?.prices.instruments.find((i) => i.id === 'BTC')?.changePct,
      basis: 'btc',
    })
  }
  for (const acc of profile.brokers ?? []) {
    for (const h of revalue(acc, book).holdings) {
      rows.push({
        key: `${acc.source}:${h.symbol}`,
        symbol: h.symbol,
        name: h.instrumentName ?? h.name,
        where: BROKER_NAMES[acc.source],
        source: acc.source,
        quantity: h.quantity,
        valueEur: h.valueEur,
        sharePct: 0,
        changePct: h.changePct,
        basis: h.basis,
      })
    }
  }
  for (const r of rows) r.sharePct = assetsEur > 0 ? (r.valueEur / assetsEur) * 100 : 0
  return rows.sort((a, b) => b.valueEur - a.valueEur)
}

/** Euro move today, worked back from the value after the move. */
export function dayMoveEur(r: PortfolioRow): number {
  if (r.changePct === undefined) return 0
  return r.valueEur - r.valueEur / (1 + r.changePct / 100)
}
