// Turns a Profile into the numbers the overview shows.
// Facts about the user's own data only: no forecasts, no advice.

import { ASSET_CLASSES, type AssetClass, type Profile } from './model'

export interface BitcoinFacts {
  /** BTC held: bought − sold − BTC fees + typed-in BTC. */
  btc: number
  /** EUR paid for buys minus EUR received from sells. */
  netInvestedEur: number
  /** EUR paid for all buys. */
  boughtEur: number
  /** Average EUR price per BTC bought (fees not included). */
  avgBuyPrice: number
  valueEur: number
  /** Value minus net invested. Only meaningful when nothing was typed in. */
  gainEur: number
  feesEur: number
  /** Fees as a share of EUR paid for buys. */
  feePct: number
  buys: number
  sells: number
  firstBuy: string | null
}

export interface ClassSlice {
  assetClass: AssetClass
  valueEur: number
  pct: number
}

export interface Overview {
  bitcoin: BitcoinFacts
  assetsEur: number
  liabilitiesEur: number
  netWorthEur: number
  allocation: ClassSlice[]
  /** Bitcoin as a share of all assets (not of net worth). */
  btcSharePct: number
}

export function bitcoinFacts(profile: Profile, priceEur: number): BitcoinFacts {
  let btc = profile.extraBtc
  let boughtEur = 0
  let boughtBtc = 0
  let soldEur = 0
  let feesEur = 0
  let buys = 0
  let sells = 0
  let firstBuy: string | null = null

  for (const tx of profile.txs) {
    feesEur += tx.feeEur
    if (tx.kind === 'buy') {
      btc += tx.btc - tx.feeBtc
      boughtEur += tx.eur
      boughtBtc += tx.btc
      buys++
      if (!firstBuy || tx.time < firstBuy) firstBuy = tx.time
    } else if (tx.kind === 'sell') {
      btc -= tx.btc + tx.feeBtc
      soldEur += tx.eur
      sells++
    } else if (tx.kind === 'withdrawal' || tx.kind === 'deposit') {
      // Moving coins between the exchange and the user's own wallet keeps
      // them in the user's hands; only the network fee leaves.
      btc -= tx.feeBtc
      feesEur += tx.feeBtc * priceEur
    }
  }

  btc = Math.max(0, btc)
  const netInvestedEur = boughtEur - soldEur
  const valueEur = btc * priceEur
  return {
    btc,
    netInvestedEur,
    boughtEur,
    avgBuyPrice: boughtBtc > 0 ? boughtEur / boughtBtc : 0,
    valueEur,
    gainEur: valueEur - netInvestedEur,
    feesEur,
    feePct: boughtEur > 0 ? (feesEur / boughtEur) * 100 : 0,
    buys,
    sells,
    firstBuy,
  }
}

export function overview(profile: Profile, priceEur: number): Overview {
  const bitcoin = bitcoinFacts(profile, priceEur)
  const byClass = new Map<AssetClass, number>(ASSET_CLASSES.map((c) => [c, 0]))
  byClass.set('bitcoin', bitcoin.valueEur)
  for (const a of profile.manualAssets) {
    byClass.set(a.assetClass, (byClass.get(a.assetClass) ?? 0) + Math.max(0, a.valueEur))
  }
  const assetsEur = [...byClass.values()].reduce((s, v) => s + v, 0)
  const liabilitiesEur = profile.liabilities.reduce((s, l) => s + Math.max(0, l.balanceEur), 0)
  const allocation = ASSET_CLASSES.map((c) => {
    const valueEur = byClass.get(c) ?? 0
    return { assetClass: c, valueEur, pct: assetsEur > 0 ? (valueEur / assetsEur) * 100 : 0 }
  }).filter((s) => s.valueEur > 0)

  return {
    bitcoin,
    assetsEur,
    liabilitiesEur,
    netWorthEur: assetsEur - liabilitiesEur,
    allocation,
    btcSharePct: assetsEur > 0 ? (bitcoin.valueEur / assetsEur) * 100 : 0,
  }
}
