import type { Tx } from '../model'

export interface ImportResult {
  source: Tx['source']
  txs: Tx[]
  /** Rows that do not move Bitcoin (EUR deposits, other assets, staking). */
  skipped: number
}
