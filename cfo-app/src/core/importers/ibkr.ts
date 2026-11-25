// Interactive Brokers: Reports → Statements → Activity (CSV).
// Every line starts with the section name and "Header" / "Data" / "Total".
// We read:
//  - Account Information: Base Currency
//  - Statement: Period
//  - Net Asset Value: Stock / Cash / Total (Current Total, base currency)
//  - Change in NAV: Deposits & Withdrawals, Dividends, Withholding Tax,
//    Commissions (period totals, base currency)
//  - Open Positions: Summary rows (symbol, quantity, value in its currency)

import { emptyAccount, round2, type BrokerAccount, type Holding } from '../brokers'
import { toNumber } from '../csv'

const SECTIONS = ['Net Asset Value', 'Open Positions', 'Trades', 'Change in NAV']

export function isIbkr(rows: string[][]): boolean {
  return rows.some((r) => r[1] === 'Header' && SECTIONS.includes(r[0]))
}

export function importIbkr(rows: string[][]): BrokerAccount {
  const headers = new Map<string, string[]>()
  const data: { section: string; rec: Record<string, string> }[] = []
  for (const r of rows) {
    const [section, kind] = r
    if (kind === 'Header') {
      headers.set(section, r.slice(2).map((c) => c.trim()))
    } else if (kind === 'Data') {
      const h = headers.get(section)
      if (!h) continue
      const rec: Record<string, string> = {}
      h.forEach((name, i) => (rec[name] = (r[i + 2] ?? '').trim()))
      data.push({ section, rec })
    }
  }
  const of = (s: string) => data.filter((d) => d.section === s).map((d) => d.rec)
  const field = (s: string, name: string) => of(s).find((r) => r['Field Name'] === name)?.['Field Value']

  const acc = emptyAccount('ibkr')
  acc.has = { positions: true, cash: true }
  const base = field('Account Information', 'Base Currency') ?? 'EUR'
  if (base !== 'EUR') {
    acc.notes.push(`base_currency:${base}`)
    return acc
  }
  acc.period = field('Statement', 'Period')

  let stock = 0
  let cash = 0
  let total = 0
  for (const r of of('Net Asset Value')) {
    const cls = r['Asset Class']
    const v = toNumber(r['Current Total'] ?? '')
    if (cls === 'Cash') cash = v
    else if (cls === 'Total') total = v
    else if (cls) stock += v
  }
  acc.cashEur = round2(Math.max(0, cash))
  acc.investedValueEur = round2(total ? total - cash : stock)
  acc.valuedAt = 'market'

  const nav = (name: string) => toNumber(field('Change in NAV', name) ?? '')
  const dw = nav('Deposits & Withdrawals')
  acc.depositedEur = round2(Math.max(0, dw))
  acc.withdrawnEur = round2(Math.max(0, -dw))
  acc.dividendsEur = round2(nav('Dividends') + nav('Interest'))
  acc.taxWithheldEur = round2(Math.abs(nav('Withholding Tax')))
  acc.feesEur = round2(Math.abs(nav('Commissions')) + Math.abs(nav('Other Fees')))
  acc.notes.push('period_totals')

  acc.holdings = of('Open Positions')
    .filter((r) => r.DataDiscriminator === 'Summary' && r.Symbol)
    .map<Holding>((r) => ({
      symbol: r.Symbol,
      quantity: toNumber(r.Quantity),
      currency: r.Currency || base,
      value: toNumber(r.Value),
      costEur: r.Currency === 'EUR' ? toNumber(r['Cost Basis']) : undefined,
    }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  return acc
}
