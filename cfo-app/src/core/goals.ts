// Goals the user sets, measured against their own numbers. No advice on how
// to reach them.

import type { Profile } from './model'
import { overview } from './portfolio'
import type { PriceBook } from './prices'

export type GoalKind = 'net_worth' | 'btc' | 'cash' | 'debt_free'

export interface Goal {
  id: string
  name: string
  kind: GoalKind
  /** EUR, or BTC for kind 'btc'. Ignored for debt_free (target is 0). */
  target: number
  /** Debt when the goal was set, so payoff progress can be measured. */
  startDebt?: number
}

export interface GoalProgress {
  goal: Goal
  current: number
  target: number
  pct: number
  done: boolean
}

export function goalProgress(goals: Goal[], profile: Profile, priceEur: number, book: PriceBook | null): GoalProgress[] {
  const o = overview(profile, priceEur, book)
  const cash = o.allocation.find((s) => s.assetClass === 'cash')?.valueEur ?? 0
  return goals.map((goal) => {
    if (goal.kind === 'debt_free') {
      const start = goal.startDebt ?? o.liabilitiesEur
      const paid = Math.max(0, start - o.liabilitiesEur)
      const pct = start > 0 ? Math.min(100, (paid / start) * 100) : 100
      return { goal, current: o.liabilitiesEur, target: 0, pct, done: o.liabilitiesEur <= 0 }
    }
    const current = goal.kind === 'btc' ? o.bitcoin.btc : goal.kind === 'cash' ? cash : o.netWorthEur
    const pct = goal.target > 0 ? Math.max(0, Math.min(100, (current / goal.target) * 100)) : 0
    return { goal, current, target: goal.target, pct, done: current >= goal.target }
  })
}
