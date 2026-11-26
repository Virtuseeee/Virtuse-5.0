import type { BrokerAccount } from '../brokers'
import type { Tx } from '../model'

export interface BtcImport {
  source: Tx['source']
  txs: Tx[]
  /** Rows that do not move Bitcoin (EUR deposits, other assets, staking). */
  skipped: number
}

export type ImportResult =
  | ({ kind: 'btc' } & BtcImport)
  | { kind: 'broker'; account: BrokerAccount }
