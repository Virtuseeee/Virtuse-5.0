// What the AI CFO may see: rounded facts about the user's own numbers.
// No names, account numbers, holding symbols, transaction ids, dates of single
// payments or exact amounts. The Worker accepts only these keys (cfo-ask/domain.js)
// and a test here fails if anything identifying slips in.

import { cashFlow, type Category } from './bank'
import { goalProgress } from './goals'
import type { Profile } from './model'
import { overview } from './portfolio'
import type { PriceBook } from './prices'
import { skTaxYears } from './tax-sk'
import { dayMoveEur, portfolioRows } from './holdings'

export interface AiContext {
  v: 1
  country: string
  net_worth_eur: number
  assets_eur: number
  debts_eur: number
  class_pct: Record<string, number>
  btc: { held_btc: number; value_eur: number; put_in_eur: number; avg_buy_eur: number; fee_pct: number; buys: number; first_buy_year: number | null }
  brokers: { count: number; invested_eur: number; cash_eur: number; fees_eur: number; dividends_eur: number }
  day_move_eur: number
  cash_flow: { month: string; income_eur: number; spending_eur: number; top: { cat: Category; eur: number }[] } | null
  tax: { year: number; gain_eur: number; base_eur: number; due: string } | null
  goals: { kind: string; pct: number }[]
  debt_kinds: string[]
}

/** Coarser rounding for bigger sums: 10 below 1 000, 100 below 100 000, else 1 000. */
export function roundEur(n: number): number {
  const a = Math.abs(n)
  const step = a < 1000 ? 10 : a < 100_000 ? 100 : 1000
  return Math.round(n / step) * step
}

export function buildAiContext(profile: Profile, priceEur: number, book: PriceBook | null, today = new Date().toISOString().slice(0, 10)): AiContext {
  const o = overview(profile, priceEur, book)
  const rows = portfolioRows(profile, priceEur, book, o.assetsEur)
  const class_pct: Record<string, number> = {}
  for (const s of o.allocation) class_pct[s.assetClass] = Math.round(s.pct)
  const flows = cashFlow(profile.banks ?? [])
  const f = flows.filter((x) => x.month < today.slice(0, 7)).pop() ?? flows[flows.length - 1]
  const ty = skTaxYears(profile.txs)[0]
  return {
    v: 1,
    country: profile.country,
    net_worth_eur: roundEur(o.netWorthEur),
    assets_eur: roundEur(o.assetsEur),
    debts_eur: roundEur(o.liabilitiesEur),
    class_pct,
    btc: {
      held_btc: Math.round(o.bitcoin.btc * 100) / 100,
      value_eur: roundEur(o.bitcoin.valueEur),
      put_in_eur: roundEur(o.bitcoin.netInvestedEur),
      avg_buy_eur: roundEur(o.bitcoin.avgBuyPrice),
      fee_pct: Math.round(o.bitcoin.feePct * 100) / 100,
      buys: o.bitcoin.buys,
      first_buy_year: o.bitcoin.firstBuy ? Number(o.bitcoin.firstBuy.slice(0, 4)) : null,
    },
    brokers: {
      count: (profile.brokers ?? []).length,
      invested_eur: roundEur(o.brokers.investedValueEur),
      cash_eur: roundEur(o.brokers.cashEur),
      fees_eur: roundEur(o.brokers.feesEur),
      dividends_eur: roundEur(o.brokers.dividendsEur),
    },
    day_move_eur: roundEur(rows.reduce((s, r) => s + dayMoveEur(r), 0)),
    cash_flow: f
      ? {
          month: f.month,
          income_eur: roundEur(f.incomeEur),
          spending_eur: roundEur(f.spendingEur),
          top: Object.entries(f.byCategory)
            .filter(([c]) => c !== 'investing' && c !== 'transfers')
            .sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0))
            .slice(0, 5)
            .map(([cat, eur]) => ({ cat: cat as Category, eur: roundEur(eur ?? 0) })),
        }
      : null,
    tax: ty ? { year: ty.year, gain_eur: roundEur(ty.netEur), base_eur: roundEur(ty.baseEur), due: ty.dueDate } : null,
    goals: goalProgress(profile.goals ?? [], profile, priceEur, book).map((g) => ({ kind: g.goal.kind, pct: Math.round(g.pct) })),
    debt_kinds: [...new Set(profile.liabilities.map((l) => l.kind))],
  }
}
