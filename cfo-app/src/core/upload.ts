// The only data that may ever leave the device: rounded totals.
// No transaction ids, dates, addresses, names or exact amounts.
// A test fails if anything else appears here.

import type { AssetClass, Profile } from './model'
import { overview } from './portfolio'

export interface UploadSummary {
  country: string
  /** Rounded to the nearest 10 EUR. */
  fees_paid_eur: number
  /** Rounded to the nearest 100 EUR. */
  invested_eur: number
  /** Whole percent. */
  btc_share_pct: number
  /** Whole percent per asset class. */
  class_pct: Partial<Record<AssetClass, number>>
  has_debt: boolean
}

export const UPLOAD_KEYS: (keyof UploadSummary)[] = [
  'country',
  'fees_paid_eur',
  'invested_eur',
  'btc_share_pct',
  'class_pct',
  'has_debt',
]

export function buildSummary(profile: Profile, priceEur: number): UploadSummary {
  const o = overview(profile, priceEur)
  const class_pct: Partial<Record<AssetClass, number>> = {}
  for (const s of o.allocation) class_pct[s.assetClass] = Math.round(s.pct)
  return {
    country: profile.country,
    fees_paid_eur: Math.round(o.bitcoin.feesEur / 10) * 10,
    invested_eur: Math.round(o.bitcoin.netInvestedEur / 100) * 100,
    btc_share_pct: Math.round(o.btcSharePct),
    class_pct,
    has_debt: o.liabilitiesEur > 0,
  }
}
