// Radar: things worth knowing about the user's own data, computed on the
// device. Facts only: no buy/sell/hold suggestions, no forecasts.

import { BROKER_NAMES } from './brokers'
import { dayMoveEur, portfolioRows } from './holdings'
import type { Profile } from './model'
import { overview } from './portfolio'
import { revalue, type PriceBook } from './prices'
import { skTaxYears } from './tax-sk'

export type RadarKind = 'move' | 'fees' | 'concentration' | 'debt' | 'cash' | 'data' | 'custody' | 'tax'

export interface RadarItem {
  id: string
  kind: RadarKind
  /** 'watch' items go first and carry a dot in the sidebar badge. */
  level: 'watch' | 'info'
  code: string
  vars: Record<string, string | number>
}

export interface RadarOptions {
  /** ISO date of "today", for the stale-price check. */
  today: string
  movePct: number
  feePct: number
  concentrationPct: number
  cashPct: number
}

export const DEFAULT_RADAR: Omit<RadarOptions, 'today'> = { movePct: 2, feePct: 0.5, concentrationPct: 25, cashPct: 30 }

export function radarItems(profile: Profile, priceEur: number, book: PriceBook | null, opts: RadarOptions): RadarItem[] {
  const o = overview(profile, priceEur, book)
  const rows = portfolioRows(profile, priceEur, book, o.assetsEur)
  const items: RadarItem[] = []

  for (const r of rows) {
    if (r.changePct !== undefined && Math.abs(r.changePct) >= opts.movePct) {
      items.push({ id: `move:${r.key}`, kind: 'move', level: 'watch', code: 'move', vars: { symbol: r.symbol, pct: r.changePct, eur: Math.round(dayMoveEur(r)) } })
    }
  }

  if (o.bitcoin.boughtEur > 0 && o.bitcoin.feePct >= opts.feePct) {
    items.push({ id: 'fees:btc', kind: 'fees', level: 'watch', code: 'fees_btc', vars: { pct: Math.round(o.bitcoin.feePct * 100) / 100, eur: Math.round(o.bitcoin.feesEur) } })
  }
  if (o.brokers.feesEur > 0) {
    items.push({ id: 'fees:brokers', kind: 'fees', level: 'info', code: 'fees_brokers', vars: { eur: Math.round(o.brokers.feesEur * 100) / 100 } })
  }

  const top = rows[0]
  if (top && top.sharePct >= opts.concentrationPct) {
    items.push({ id: `conc:${top.key}`, kind: 'concentration', level: 'info', code: 'concentration', vars: { symbol: top.symbol, pct: Math.round(top.sharePct) } })
  }
  const realEstate = o.allocation.find((s) => s.assetClass === 'real_estate')
  if (realEstate && realEstate.pct >= 50) {
    items.push({ id: 'conc:real_estate', kind: 'concentration', level: 'info', code: 'real_estate', vars: { pct: Math.round(realEstate.pct) } })
  }

  if (o.liabilitiesEur > 0 && o.assetsEur > 0) {
    items.push({ id: 'debt', kind: 'debt', level: 'info', code: 'debt_ratio', vars: { pct: Math.round((o.liabilitiesEur / o.assetsEur) * 100), eur: Math.round(o.liabilitiesEur) } })
  }

  const cash = o.allocation.find((s) => s.assetClass === 'cash')
  if (cash && cash.pct >= opts.cashPct) {
    items.push({ id: 'cash', kind: 'cash', level: 'info', code: 'cash_share', vars: { pct: Math.round(cash.pct), eur: Math.round(cash.valueEur) } })
  }

  const withdrawals = profile.txs.filter((t) => t.kind === 'withdrawal').length
  if (withdrawals > 0) {
    items.push({ id: 'custody', kind: 'custody', level: 'info', code: 'own_wallet', vars: { n: withdrawals } })
  }

  const year = Number(opts.today.slice(0, 4))
  const ty = skTaxYears(profile.txs).find((y) => y.year === year || y.year === year - 1)
  if (ty && ty.baseEur > 0 && opts.today <= ty.dueDate) {
    items.push({ id: `tax:${ty.year}`, kind: 'tax', level: 'info', code: 'tax_due', vars: { year: ty.year, eur: Math.round(ty.baseEur), date: ty.dueDate } })
  }

  if (book) {
    const age = (Date.parse(opts.today) - Date.parse(book.fx.date)) / 86_400_000
    if (age > 3) items.push({ id: 'data:stale', kind: 'data', level: 'watch', code: 'prices_stale', vars: { date: book.fx.date } })
  }
  for (const acc of profile.brokers ?? []) {
    const name = BROKER_NAMES[acc.source]
    if (!acc.has.positions) items.push({ id: `data:pos:${acc.source}`, kind: 'data', level: 'watch', code: 'missing_positions', vars: { broker: name } })
    if (!acc.has.cash) items.push({ id: `data:cash:${acc.source}`, kind: 'data', level: 'info', code: 'missing_cash', vars: { broker: name } })
    const { unpriced } = revalue(acc, book)
    if (unpriced > 0) items.push({ id: `data:unpriced:${acc.source}`, kind: 'data', level: 'info', code: 'unpriced', vars: { broker: name, n: unpriced } })
  }

  return items.sort((a, b) => (a.level === b.level ? 0 : a.level === 'watch' ? -1 : 1))
}
