// A broker account as the overview needs it, built from one or more exports.

export type BrokerSource = 'xtb' | 'ibkr' | 't212'

export const BROKER_NAMES: Record<BrokerSource, string> = {
  xtb: 'XTB',
  ibkr: 'Interactive Brokers',
  t212: 'Trading 212',
}

export interface Holding {
  symbol: string
  isin?: string
  name?: string
  quantity: number
  currency: string
  /** Current value in `currency`, when the export has it. */
  value?: number
  /** What was paid, in EUR, when the export lets us work it out. */
  costEur?: number
}

export interface BrokerAccount {
  source: BrokerSource
  /** Which parts the imported files covered. */
  has: { positions: boolean; cash: boolean }
  holdings: Holding[]
  /** Investments in EUR. */
  investedValueEur: number
  /** 'market' = broker's own valuation, 'cost' = purchase price (no prices yet). */
  valuedAt: 'market' | 'cost'
  cashEur: number
  feesEur: number
  depositedEur: number
  withdrawnEur: number
  dividendsEur: number
  taxWithheldEur: number
  /** Period the export covers, or the statement date. */
  period?: string
  notes: string[]
}

export function emptyAccount(source: BrokerSource): BrokerAccount {
  return {
    source,
    has: { positions: false, cash: false },
    holdings: [],
    investedValueEur: 0,
    valuedAt: 'cost',
    cashEur: 0,
    feesEur: 0,
    depositedEur: 0,
    withdrawnEur: 0,
    dividendsEur: 0,
    taxWithheldEur: 0,
    notes: [],
  }
}

/** XTB comes as two files (positions, cash). Keep the newer part of each. */
export function mergeAccount(old: BrokerAccount | undefined, next: BrokerAccount): BrokerAccount {
  if (!old || old.source !== next.source) return next
  const pos = next.has.positions ? next : old
  const cash = next.has.cash ? next : old
  return {
    source: next.source,
    has: { positions: old.has.positions || next.has.positions, cash: old.has.cash || next.has.cash },
    holdings: pos.holdings,
    investedValueEur: pos.investedValueEur,
    valuedAt: pos.valuedAt,
    cashEur: cash.cashEur,
    feesEur: cash.feesEur,
    depositedEur: cash.depositedEur,
    withdrawnEur: cash.withdrawnEur,
    dividendsEur: cash.dividendsEur,
    taxWithheldEur: cash.taxWithheldEur,
    period: next.period ?? old.period,
    notes: [...new Set([...old.notes, ...next.notes])],
  }
}

export const round2 = (n: number) => Math.round(n * 100) / 100
