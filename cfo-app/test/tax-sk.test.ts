import { describe, expect, it } from 'vitest'
import type { Tx } from '../src/core/model'
import { bandTax, skTaxYears } from '../src/core/tax-sk'

const tx = (time: string, kind: Tx['kind'], btc: number, eur: number, feeEur = 0, feeBtc = 0): Tx =>
  ({ id: time, source: 'kraken', time, kind, btc, eur, feeEur, feeBtc })

describe('bandTax (2026 bands for § 8 income)', () => {
  it('applies 19 / 25 / 30 / 35 % by slice', () => {
    expect(bandTax(10_000)).toBe(1900)
    expect(bandTax(43_983.32)).toBeCloseTo(43_983.32 * 0.19, 2)
    expect(bandTax(50_000)).toBeCloseTo(43_983.32 * 0.19 + (50_000 - 43_983.32) * 0.25, 2)
    expect(bandTax(100_000)).toBeCloseTo(43_983.32 * 0.19 + (60_349.21 - 43_983.32) * 0.25 + (75_010.32 - 60_349.21) * 0.3 + (100_000 - 75_010.32) * 0.35, 1)
    expect(bandTax(0)).toBe(0)
  })
})

describe('skTaxYears', () => {
  it('uses FIFO lots with buy fees in the cost and sale fees off the proceeds', () => {
    const years = skTaxYears([
      tx('2025-01-10T10:00:00Z', 'buy', 0.1, 4000, 10),
      tx('2025-06-10T10:00:00Z', 'buy', 0.1, 6000, 10),
      tx('2026-03-01T10:00:00Z', 'sell', 0.15, 12000, 30),
    ])
    expect(years).toHaveLength(1)
    const y = years[0]
    expect(y.year).toBe(2026)
    // 0.1 from the first lot (4010) + 0.05 from the second (3005)
    expect(y.costEur).toBe(7015)
    expect(y.proceedsEur).toBe(11970)
    expect(y.netEur).toBe(4955)
    expect(y.incomeTaxEur).toBeCloseTo(4955 * 0.19, 2)
    expect(y.healthEur).toBeCloseTo(4955 * 0.16, 2)
    expect(y.dueDate).toBe('2027-03-31')
  })

  it('counts a losing year as zero and leaves earlier years without bands', () => {
    const years = skTaxYears([
      tx('2024-01-10T10:00:00Z', 'buy', 0.1, 6000),
      tx('2025-02-01T10:00:00Z', 'sell', 0.05, 2000),
    ])
    expect(years[0]).toMatchObject({ year: 2025, netEur: -1000, baseEur: 0, incomeTaxEur: null, healthRate: 0.15, healthEur: 0 })
  })

  it('takes a withdrawal fee from the oldest lot and flags sales without known cost', () => {
    const years = skTaxYears([
      tx('2026-01-01T10:00:00Z', 'buy', 0.01, 800),
      tx('2026-01-02T10:00:00Z', 'withdrawal', 0.009, 0, 0, 0.001),
      tx('2026-02-01T10:00:00Z', 'sell', 0.02, 1800),
    ])
    expect(years[0].uncoveredBtc).toBeCloseTo(0.011, 9)
    expect(years[0].costEur).toBeCloseTo(720, 6)
  })
})

import { ask } from '../src/core/ask'
import { DEFAULT_RADAR, radarItems } from '../src/core/radar'
import { annaProfile } from '../src/data/demo'

describe('tax in ask and radar (Anna sold 0.015 BTC in Sept 2026)', () => {
  const anna = annaProfile()
  it('answers a tax question with the 2026 figures and the deadline', () => {
    const a = ask('Koľko zaplatím daň?', anna, 80000, null, 'sk')
    expect(a.kind).toBe('answer')
    expect(a.lines[0]).toMatch(/^Rok 2026: predaje/)
    expect(a.lines.join(' ')).toMatch(/31\. 3\. 2027/)
  })
  it('puts the filing reminder on the Radar until the deadline', () => {
    const codes = (today: string) => radarItems(anna, 80000, null, { ...DEFAULT_RADAR, today }).map((i) => i.code)
    expect(codes('2026-11-26')).toContain('tax_due')
    expect(codes('2027-04-01')).not.toContain('tax_due')
  })
})
