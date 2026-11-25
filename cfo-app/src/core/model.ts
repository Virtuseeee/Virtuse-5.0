// Data model for the Virtuse CFO prototype.
//
// Everything in src/core runs only in the browser (or in tests) and never
// talks to the network. It is the "trust layer" meant to be published as
// open source later: raw rows, addresses and transaction ids stay here.

export type AssetClass =
  | 'bitcoin'
  | 'cash'
  | 'stocks'
  | 'real_estate'
  | 'pension'
  | 'other'

export const ASSET_CLASSES: AssetClass[] = [
  'bitcoin',
  'cash',
  'stocks',
  'real_estate',
  'pension',
  'other',
]

export type TxKind = 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'other'

/** One normalized Bitcoin movement taken from an exchange export. */
export interface Tx {
  /** Stable id inside the app (the exchange's own ref). Never uploaded. */
  id: string
  source: 'kraken'
  /** ISO 8601, UTC. */
  time: string
  kind: TxKind
  /** BTC moved, always positive. 0 for fiat-only rows. */
  btc: number
  /** EUR paid (buy) or received (sell). 0 when no EUR side. */
  eur: number
  /** Fee in EUR, converted at the trade price when the exchange charged BTC. */
  feeEur: number
  /** Fee charged in BTC (for example a network withdrawal fee). */
  feeBtc: number
}

/** An asset the user types in by hand (savings, flat, pension, ETF account). */
export interface ManualAsset {
  id: string
  name: string
  assetClass: Exclude<AssetClass, 'bitcoin'>
  valueEur: number
}

export interface Liability {
  id: string
  name: string
  kind: 'mortgage' | 'loan' | 'btc_loan'
  balanceEur: number
}

/** Everything the app knows about one person. Kept only on the device. */
export interface Profile {
  version: 1
  label: string
  country: string
  txs: Tx[]
  /** BTC the user holds that no imported file explains (typed in). */
  extraBtc: number
  manualAssets: ManualAsset[]
  liabilities: Liability[]
}

export function emptyProfile(label = ''): Profile {
  return {
    version: 1,
    label,
    country: 'SK',
    txs: [],
    extraBtc: 0,
    manualAssets: [],
    liabilities: [],
  }
}
