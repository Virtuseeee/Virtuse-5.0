// XTB xStation 5: Account history (Excel) saved as CSV, one sheet per file.
//  - "Open positions": Position, Symbol, Type, Volume, Open time, Open price,
//    Market price, Purchase value, ..., Commission, Swap, Rollover, Gross P/L
//  - "Cash operations": ID, Type, Time, Comment, Symbol, Amount
// A few account-info lines usually sit above the header, so we search for it.
// Amounts are in the account currency; only EUR accounts are supported.

import { emptyAccount, round2, type BrokerAccount, type Holding } from '../brokers'
import { findHeader, recordsFrom, toNumber } from '../csv'

const POS = ['Position', 'Symbol', 'Volume', 'Open price', 'Purchase value']
const CASH = ['Type', 'Time', 'Comment', 'Amount']

/** "05.02.2025 10:01:12" or "2025-02-05 10:01:12" → "2025-02-05". */
function isoDay(t: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(t)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : t.slice(0, 10)
}

export function findXtb(rows: string[][]): { kind: 'positions' | 'cash'; header: number } | null {
  const p = findHeader(rows, POS)
  if (p >= 0) return { kind: 'positions', header: p }
  const c = findHeader(rows, CASH)
  if (c >= 0 && rows[c].map((x) => x.trim()).includes('ID')) return { kind: 'cash', header: c }
  return null
}

export function importXtb(rows: string[][]): BrokerAccount {
  const found = findXtb(rows)
  if (!found) throw new Error('not_xtb')
  const records = recordsFrom(rows, found.header).filter((r) => r.Symbol || r.Type)
  const acc = emptyAccount('xtb')
  if (found.kind === 'positions') {
    acc.has.positions = true
    const bySymbol = new Map<string, Holding>()
    let value = 0
    for (const r of records) {
      if (!r.Position || /total/i.test(r.Position)) continue
      const purchase = toNumber(r['Purchase value'])
      const gross = toNumber(r['Gross P/L'] ?? '')
      const h = bySymbol.get(r.Symbol) ?? { symbol: r.Symbol, quantity: 0, currency: 'EUR', costEur: 0, value: 0 }
      h.quantity += toNumber(r.Volume)
      h.costEur = round2((h.costEur ?? 0) + purchase)
      h.value = round2((h.value ?? 0) + purchase + gross)
      bySymbol.set(r.Symbol, h)
      value += purchase + gross
    }
    acc.holdings = [...bySymbol.values()].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    acc.investedValueEur = round2(value)
    acc.valuedAt = 'market'
    return acc
  }

  acc.has.cash = true
  let cash = 0
  let first = ''
  let last = ''
  for (const r of records) {
    const type = (r.Type ?? '').toLowerCase()
    const amt = toNumber(r.Amount)
    cash += amt
    const t = isoDay(r.Time ?? '')
    if (t && (!first || t < first)) first = t
    if (t > last) last = t
    if (type.includes('deposit')) acc.depositedEur += amt
    else if (type.includes('withdraw')) acc.withdrawnEur += Math.abs(amt)
    else if (type.includes('withholding tax')) acc.taxWithheldEur += Math.abs(amt)
    else if (type.includes('dividend') || type.includes('interest')) acc.dividendsEur += amt
    else if (/fee|commission/.test(type)) acc.feesEur += Math.abs(amt)
  }
  acc.cashEur = round2(Math.max(0, cash))
  acc.depositedEur = round2(acc.depositedEur)
  acc.withdrawnEur = round2(acc.withdrawnEur)
  acc.dividendsEur = round2(acc.dividendsEur)
  acc.taxWithheldEur = round2(acc.taxWithheldEur)
  acc.feesEur = round2(acc.feesEur)
  if (first) acc.period = `${first} – ${last}`
  acc.notes.push('xtb_fx_in_price')
  return acc
}
