// Slovak tax overview for Bitcoin sales: facts from the user's own data plus
// the rules Virtuse publishes with official sources (seo-build/data/tax-sources.json,
// checked 2026-10-13). An estimate to take to a tax adviser, not a tax return.
//
// Sourced facts used here:
//  - a crypto sale or swap is other income under § 8(1)(t) ZDP; no holding-period exemption
//  - 2026 bands for § 8 income: 19 % up to 43,983.32 €, 25 % to 60,349.21 €, 30 % to 75,010.32 €, 35 % above
//  - expenses above income are ignored (a loss for the year counts as zero)
//  - health insurance 16 % of the gain for 2026 and 2027 (15 % in 2024 and 2025), 8 % with a disability
//  - type B return by 31 March of the following year
// Assumptions (flagged in the UI): FIFO lots; buy fees part of the cost, sale fees
// reduce proceeds; only Bitcoin sold for EUR on the imported exchange.

import type { Tx } from './model'

export const SK_BANDS_2026: [number, number][] = [
  [43_983.32, 0.19],
  [60_349.21, 0.25],
  [75_010.32, 0.3],
  [Infinity, 0.35],
]
export const SK_HEALTH_RATE: Record<number, number> = { 2024: 0.15, 2025: 0.15, 2026: 0.16, 2027: 0.16 }
export const SK_SOURCES = {
  rates: 'https://podpora.financnasprava.sk/081400-Sadzba-dane-z-pr%C3%ADjmov-fyzickej-osoby-za-rok-2026',
  crypto: 'https://podpora.financnasprava.sk/293880-Pr%C3%ADjmy-z-predaja-kryproakt%C3%ADv--u-nepodnikate%C4%BEa-',
  filing: 'https://podpora.financnasprava.sk/516395-Povinnos%C5%A5-poda%C5%A5-da%C5%88ov%C3%A9-priznanie-k-dani-z-pr%C3%ADjmov-FO-za-rok-2026',
  health: 'https://www.vszp.sk/platitelia/platenie-poistneho/oznamenia-zmeny/zmeny-od-01-01.2026/',
}

export interface SaleLine {
  time: string
  btc: number
  proceedsEur: number
  costEur: number
  gainEur: number
}

export interface TaxYear {
  year: number
  sales: SaleLine[]
  proceedsEur: number
  costEur: number
  /** Sum of gains and losses of the year's sales. */
  netEur: number
  /** § 8 base from these sales: a negative year counts as zero. */
  baseEur: number
  /** Income tax on this base alone, when the year's bands are known. */
  incomeTaxEur: number | null
  healthEur: number | null
  healthRate: number | null
  /** ISO date of the filing deadline (31 March next year). */
  dueDate: string
  /** BTC sold that the imported buys do not cover (cost unknown, counted as 0). */
  uncoveredBtc: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function bandTax(base: number, bands: [number, number][] = SK_BANDS_2026): number {
  let tax = 0
  let prev = 0
  for (const [top, rate] of bands) {
    if (base <= prev) break
    tax += (Math.min(base, top) - prev) * rate
    prev = top
  }
  return r2(tax)
}

/** FIFO lots over the user's buys; each sale consumes the oldest coins first. */
export function skTaxYears(txs: Tx[]): TaxYear[] {
  const lots: { btc: number; costPerBtc: number }[] = []
  const years = new Map<number, TaxYear>()
  const sorted = [...txs].sort((a, b) => a.time.localeCompare(b.time))

  for (const tx of sorted) {
    if (tx.kind === 'buy') {
      const btc = tx.btc - tx.feeBtc
      if (btc > 0) lots.push({ btc, costPerBtc: (tx.eur + tx.feeEur) / btc })
      continue
    }
    if (tx.kind === 'withdrawal' || tx.kind === 'deposit') {
      // Moving own coins is not a sale; the network fee leaves the oldest lot.
      let fee = tx.feeBtc
      while (fee > 1e-12 && lots.length) {
        const take = Math.min(fee, lots[0].btc)
        lots[0].btc -= take
        fee -= take
        if (lots[0].btc <= 1e-12) lots.shift()
      }
      continue
    }
    if (tx.kind !== 'sell') continue

    let left = tx.btc + tx.feeBtc
    let cost = 0
    while (left > 1e-12 && lots.length) {
      const take = Math.min(left, lots[0].btc)
      cost += take * lots[0].costPerBtc
      lots[0].btc -= take
      left -= take
      if (lots[0].btc <= 1e-12) lots.shift()
    }
    const year = Number(tx.time.slice(0, 4))
    const y = years.get(year) ?? emptyYear(year)
    const proceeds = tx.eur - tx.feeEur
    y.sales.push({ time: tx.time, btc: tx.btc, proceedsEur: r2(proceeds), costEur: r2(cost), gainEur: r2(proceeds - cost) })
    y.uncoveredBtc += Math.max(0, left)
    years.set(year, y)
  }

  return [...years.values()]
    .map((y) => {
      const proceedsEur = r2(y.sales.reduce((s, x) => s + x.proceedsEur, 0))
      const costEur = r2(y.sales.reduce((s, x) => s + x.costEur, 0))
      const netEur = r2(proceedsEur - costEur)
      const baseEur = Math.max(0, netEur)
      const known = y.year === 2026 || y.year === 2027
      const healthRate = SK_HEALTH_RATE[y.year] ?? null
      return {
        ...y,
        proceedsEur,
        costEur,
        netEur,
        baseEur,
        incomeTaxEur: known ? bandTax(baseEur) : null,
        healthRate,
        healthEur: healthRate === null ? null : r2(baseEur * healthRate),
      }
    })
    .sort((a, b) => b.year - a.year)
}

function emptyYear(year: number): TaxYear {
  return { year, sales: [], proceedsEur: 0, costEur: 0, netEur: 0, baseEur: 0, incomeTaxEur: null, healthEur: null, healthRate: null, dueDate: `${year + 1}-03-31`, uncoveredBtc: 0 }
}
