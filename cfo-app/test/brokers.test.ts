import { describe, expect, it } from 'vitest'
import { mergeAccount } from '../src/core/brokers'
import { parseRows, toNumber } from '../src/core/csv'
import { importCsv } from '../src/core/importers'
import { SAMPLES } from '../src/data/samples'

const broker = (text: string) => {
  const r = importCsv(text)
  if (r.kind !== 'broker') throw new Error('expected broker')
  return r.account
}

describe('toNumber', () => {
  it('reads dot, comma and grouped numbers', () => {
    expect(toNumber('1 234,56')).toBe(1234.56)
    expect(toNumber('1,234.56')).toBe(1234.56)
    expect(toNumber('1.234,56')).toBe(1234.56)
    expect(toNumber('-12.5')).toBe(-12.5)
    expect(toNumber('')).toBe(0)
    expect(() => toNumber('abc')).toThrow()
  })
})

describe('semicolon CSV', () => {
  it('detects ; and finds the XTB header below account lines', () => {
    expect(parseRows(SAMPLES.xtbCash)[3][0]).toBe('ID')
  })
})

describe('Trading 212', () => {
  const a = broker(SAMPLES.t212)
  it('builds positions at average cost after a partial sell', () => {
    expect(a.source).toBe('t212')
    expect(a.valuedAt).toBe('cost')
    const vwce = a.holdings.find((h) => h.symbol === 'VWCE')!
    expect(vwce.quantity).toBe(6)
    expect(vwce.costEur).toBe(720)
    expect(a.investedValueEur).toBe(1085)
  })
  it('works out cash, fees, income and keeps a foreign-currency tax out of EUR', () => {
    expect(a.cashEur).toBe(836.59)
    expect(a.feesEur).toBe(1.36)
    expect(a.depositedEur).toBe(2000)
    expect(a.withdrawnEur).toBe(100)
    expect(a.dividendsEur).toBe(1.59)
    expect(a.taxWithheldEur).toBe(0)
    expect(a.notes).toContain('tax_other_currency')
    expect(a.period).toBe('2026-01-02 – 2026-03-01')
  })
})

describe('XTB', () => {
  const pos = broker(SAMPLES.xtbPositions)
  const cash = broker(SAMPLES.xtbCash)
  it('reads open positions at market value and skips the total row', () => {
    expect(pos.has).toEqual({ positions: true, cash: false })
    expect(pos.valuedAt).toBe('market')
    expect(pos.holdings.map((h) => [h.symbol, h.quantity, h.value])).toEqual([
      ['VWCE.DE', 60, 7704],
      ['CSPX.UK', 5, 2590.2],
    ])
    expect(pos.investedValueEur).toBe(10294.2)
  })
  it('reads cash operations', () => {
    expect(cash.has).toEqual({ positions: false, cash: true })
    expect(cash.cashEur).toBe(950.3)
    expect(cash.depositedEur).toBe(10500)
    expect(cash.dividendsEur).toBe(3.6)
    expect(cash.feesEur).toBe(0.1)
    expect(cash.period).toBe('2025-02-02 – 2025-07-01')
  })
  it('merges the two files in either order', () => {
    const m1 = mergeAccount(pos, cash)
    const m2 = mergeAccount(cash, pos)
    for (const m of [m1, m2]) {
      expect(m.has).toEqual({ positions: true, cash: true })
      expect(m.investedValueEur).toBe(10294.2)
      expect(m.cashEur).toBe(950.3)
    }
  })
})

describe('Interactive Brokers', () => {
  const a = broker(SAMPLES.ibkr)
  it('takes values in EUR from Net Asset Value', () => {
    expect(a.cashEur).toBe(840.55)
    expect(a.investedValueEur).toBe(36432.4)
    expect(a.valuedAt).toBe('market')
  })
  it('takes period totals from Change in NAV', () => {
    expect(a.depositedEur).toBe(4000)
    expect(a.dividendsEur).toBe(210.35)
    expect(a.taxWithheldEur).toBe(31.55)
    expect(a.feesEur).toBe(20.25)
    expect(a.period).toBe('January 1, 2026 - November 20, 2026')
  })
  it('lists positions in their own currency, skipping total rows', () => {
    expect(a.holdings.map((h) => [h.symbol, h.currency])).toEqual([
      ['VWCE', 'EUR'],
      ['AAPL', 'USD'],
      ['ASML', 'EUR'],
    ])
    expect(a.holdings[1].costEur).toBeUndefined()
  })
  it('refuses to mix currencies when the base is not EUR', () => {
    const usd = broker(SAMPLES.ibkr.replace('Base Currency,EUR', 'Base Currency,USD'))
    expect(usd.notes).toContain('base_currency:USD')
    expect(usd.investedValueEur).toBe(0)
  })
})
