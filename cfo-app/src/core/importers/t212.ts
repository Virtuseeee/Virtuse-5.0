// Trading 212: History → Export history (CSV).
// Columns (may vary by period chosen): Action, Time, ISIN, Ticker, Name,
// No. of shares, Price / share, Currency (Price / share), Exchange rate,
// Result, Currency (Result), Total, Currency (Total), Withholding tax,
// Currency (Withholding tax), Notes, ID, Currency conversion fee, ...
// Older exports use "Total (EUR)" instead of Total + Currency (Total).
// The export has no current prices, so positions are valued at cost.

import { emptyAccount, round2, type BrokerAccount, type Holding } from '../brokers'
import { toNumber } from '../csv'

export function isT212(header: string[]): boolean {
  return header.includes('Action') && header.includes('Time') && header.includes('No. of shares')
}

function totalOf(r: Record<string, string>, line: number): { eur: number; currency: string } {
  if ('Total' in r) return { eur: Math.abs(toNumber(r.Total, `row ${line} Total`)), currency: r['Currency (Total)'] || 'EUR' }
  const k = Object.keys(r).find((h) => /^Total \(([A-Z]{3})\)$/.test(h))
  if (!k) return { eur: 0, currency: 'EUR' }
  return { eur: Math.abs(toNumber(r[k], `row ${line} ${k}`)), currency: k.slice(7, 10) }
}

function feesOf(r: Record<string, string>): number {
  let f = 0
  for (const [k, v] of Object.entries(r)) {
    if (k.startsWith('Currency (')) continue
    if (/fee|stamp duty|transaction tax/i.test(k)) f += Math.abs(toNumber(v))
  }
  return f
}

export function importT212(records: Record<string, string>[]): BrokerAccount {
  const acc = emptyAccount('t212')
  acc.has = { positions: true, cash: true }
  const pos = new Map<string, Holding>()
  let cash = 0
  let first = ''
  let last = ''
  const otherCurrency = new Set<string>()

  records.forEach((r, i) => {
    const line = i + 2
    const action = (r.Action ?? '').toLowerCase()
    const { eur, currency } = totalOf(r, line)
    if (currency !== 'EUR') {
      otherCurrency.add(currency)
      return
    }
    const time = r.Time ?? ''
    if (time && (!first || time < first)) first = time
    if (time > last) last = time
    const fee = feesOf(r)
    acc.feesEur += fee

    if (/\b(buy|sell)\b/.test(action)) {
      const key = r.ISIN || r.Ticker
      const qty = Math.abs(toNumber(r['No. of shares'], `row ${line} shares`))
      const h = pos.get(key) ?? { symbol: r.Ticker || key, name: r.Name || undefined, quantity: 0, currency: r['Currency (Price / share)'] || 'EUR', costEur: 0 }
      if (action.includes('buy')) {
        h.quantity += qty
        h.costEur = (h.costEur ?? 0) + eur
        cash -= eur
      } else {
        const share = h.quantity > 0 ? Math.min(1, qty / h.quantity) : 0
        h.costEur = (h.costEur ?? 0) * (1 - share)
        h.quantity = Math.max(0, h.quantity - qty)
        cash += eur
      }
      pos.set(key, h)
    } else if (action === 'deposit') {
      acc.depositedEur += eur
      cash += eur
    } else if (action === 'withdrawal') {
      acc.withdrawnEur += eur
      cash -= eur
    } else if (action.startsWith('dividend')) {
      acc.dividendsEur += eur
      if ((r['Currency (Withholding tax)'] || 'EUR') === 'EUR') acc.taxWithheldEur += Math.abs(toNumber(r['Withholding tax'] ?? ''))
      else if (r['Withholding tax']) acc.notes.push('tax_other_currency')
      cash += eur
    } else if (action.includes('interest')) {
      acc.dividendsEur += eur
      cash += eur
    }
  })

  acc.holdings = [...pos.values()]
    .filter((h) => h.quantity > 1e-9)
    .map((h) => ({ ...h, costEur: round2(h.costEur ?? 0) }))
    .sort((a, b) => (b.costEur ?? 0) - (a.costEur ?? 0))
  acc.investedValueEur = round2(acc.holdings.reduce((s, h) => s + (h.costEur ?? 0), 0))
  acc.valuedAt = 'cost'
  acc.cashEur = round2(Math.max(0, cash))
  acc.feesEur = round2(acc.feesEur)
  acc.depositedEur = round2(acc.depositedEur)
  acc.withdrawnEur = round2(acc.withdrawnEur)
  acc.dividendsEur = round2(acc.dividendsEur)
  acc.taxWithheldEur = round2(acc.taxWithheldEur)
  if (first) acc.period = `${first.slice(0, 10)} – ${last.slice(0, 10)}`
  acc.notes = [...new Set(acc.notes)]
  for (const c of otherCurrency) acc.notes.push(`skipped_currency:${c}`)
  acc.notes.push('valued_at_cost')
  return acc
}
