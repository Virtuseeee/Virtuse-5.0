import { describe, expect, it } from 'vitest'
import { btcHistory, cutRange, upsertSnapshot } from '../src/core/history'
import type { Tx } from '../src/core/model'

const tx = (time: string, kind: Tx['kind'], btc: number, eur: number, feeBtc = 0): Tx =>
  ({ id: time, source: 'kraken', time, kind, btc, eur, feeEur: 0, feeBtc })
const MONTHLY = { '2026-01': 80000, '2026-02': 60000, '2026-04': 70000, '2026-05': 75000 }

describe('btcHistory', () => {
  it('values the coins held at each month end and carries a missing close forward', () => {
    const pts = btcHistory([
      tx('2026-01-05T09:00:00Z', 'buy', 0.01, 800),
      tx('2026-02-05T09:00:00Z', 'buy', 0.01, 600),
      tx('2026-03-10T09:00:00Z', 'withdrawal', 0.0199, 0, 0.0001),
      tx('2026-04-20T09:00:00Z', 'sell', 0.005, 350),
    ], MONTHLY, '2026-05-15')
    expect(pts.map((p) => p.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'])
    expect(pts[0]).toMatchObject({ btc: 0.01, valueEur: 800, investedEur: 800 })
    expect(pts[2].valueEur).toBe(Math.round(0.0199 * 60000))
    expect(pts[3]).toMatchObject({ investedEur: 1050 })
    expect(pts[4].btc).toBeCloseTo(0.0149, 9)
  })
  it('is empty without buys or prices', () => {
    expect(btcHistory([], MONTHLY, '2026-05-01')).toEqual([])
    expect(btcHistory([tx('2026-01-05T09:00:00Z', 'buy', 0.01, 800)], undefined, '2026-05-01')).toEqual([])
  })
})

describe('snapshots and ranges', () => {
  it('keeps one snapshot a day and leaves the list alone when nothing moved', () => {
    const a = upsertSnapshot([], { date: '2026-11-25', netWorthEur: 100, assetsEur: 100, liabilitiesEur: 0 })
    const b = upsertSnapshot(a, { date: '2026-11-25', netWorthEur: 100.4, assetsEur: 100.4, liabilitiesEur: 0 })
    expect(b).toBe(a)
    const c = upsertSnapshot(a, { date: '2026-11-25', netWorthEur: 150, assetsEur: 150, liabilitiesEur: 0 })
    expect(c).toHaveLength(1)
    expect(upsertSnapshot(c, { date: '2026-11-26', netWorthEur: 160, assetsEur: 160, liabilitiesEur: 0 })).toHaveLength(2)
  })
  it('cuts by range', () => {
    const pts = ['2025-01', '2025-11', '2026-08', '2026-09', '2026-10', '2026-11'].map((month) => ({ month }))
    expect(cutRange(pts, '3m', '2026-11-26').map((p) => p.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11'])
    expect(cutRange(pts, '1y', '2026-11-26')).toHaveLength(5)
    expect(cutRange(pts, 'all', '2026-11-26')).toHaveLength(6)
  })
})
