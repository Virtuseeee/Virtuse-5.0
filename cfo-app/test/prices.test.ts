import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emptyAccount } from '../src/core/brokers'
import { importCsv } from '../src/core/importers'
import { emptyProfile } from '../src/core/model'
import { overview } from '../src/core/portfolio'
import { btcPriceEur, findInstrument, revalue, toEur, type PriceBook } from '../src/core/prices'
import { buildSummary } from '../src/core/upload'
import { SAMPLES } from '../src/data/samples'

const book = JSON.parse(readFileSync(new URL('./fixtures/prices.json', import.meta.url), 'utf8')) as PriceBook
const broker = (text: string) => {
  const r = importCsv(text)
  if (r.kind !== 'broker') throw new Error('expected broker')
  return r.account
}

describe('ECB conversion', () => {
  it('divides by the units per euro', () => {
    expect(toEur(110, 'USD', book)).toBeCloseTo(100, 9)
    expect(toEur(85, 'GBX', book)).toBeCloseTo(1, 9)
    expect(toEur(5, 'EUR', null)).toBe(5)
    expect(toEur(5, 'JPY', book)).toBeNull()
    expect(toEur(5, 'USD', null)).toBeNull()
  })
})

describe('matching', () => {
  it('prefers ISIN, then a case-insensitive alias', () => {
    expect(findInstrument({ symbol: 'ZZZ', isin: 'US0378331005' }, book)?.id).toBe('AAPL')
    expect(findInstrument({ symbol: 'cspx.uk' }, book)?.id).toBe('SXR8')
    expect(findInstrument({ symbol: 'UNKNOWN' }, book)).toBeNull()
    expect(btcPriceEur(book)).toBe(80000)
  })
})

describe('revalue', () => {
  it('turns Trading 212 cost into market value: VWCE 6 × 150, AAPL 2 × 220 / 1.1', () => {
    const r = revalue(broker(SAMPLES.t212), book)
    expect(r.holdings.map((h) => [h.symbol, h.valueEur, h.basis])).toEqual([
      ['VWCE', 900, 'price'],
      ['AAPL', 400, 'price'],
    ])
    expect(r.account.investedValueEur).toBe(1300)
    expect(r.account.valuedAt).toBe('market')
    expect(r.unpriced).toBe(0)
  })

  it('values XTB at today’s price, CSPX via the same ISIN listed in EUR', () => {
    const r = revalue(broker(SAMPLES.xtbPositions), book)
    expect(r.account.investedValueEur).toBe(60 * 150 + 5 * 600)
  })

  it('falls back to the broker value converted at ECB for unknown symbols', () => {
    const r = revalue(broker(SAMPLES.ibkr), book)
    const asml = r.holdings.find((h) => h.symbol === 'ASML')!
    expect(asml.basis).toBe('broker')
    expect(asml.valueEur).toBe(6300)
    expect(r.holdings.find((h) => h.symbol === 'AAPL')!.valueEur).toBe(6000)
  })

  it('keeps purchase price when nothing better exists and counts it', () => {
    const acc = { ...emptyAccount('t212'), has: { positions: true, cash: false }, holdings: [{ symbol: 'XYZ', quantity: 1, currency: 'EUR', costEur: 50 }] }
    const r = revalue(acc, book)
    expect(r.holdings[0].basis).toBe('cost')
    expect(r.unpriced).toBe(1)
    expect(r.account.valuedAt).toBe('cost')
  })

  it('leaves an account without positions alone', () => {
    const cash = broker(SAMPLES.xtbCash)
    expect(revalue(cash, book).account).toBe(cash)
  })
})

describe('overview with prices', () => {
  it('uses re-valued broker totals and keeps tickers out of the upload', () => {
    const p = { ...emptyProfile(), brokers: [broker(SAMPLES.t212)] }
    expect(overview(p, 80000, book).brokers.investedValueEur).toBe(1300)
    expect(overview(p, 80000, null).brokers.investedValueEur).toBe(1085)
    const json = JSON.stringify(buildSummary(p, 80000, book))
    expect(json).not.toContain('VWCE')
    expect(json).not.toContain('AAPL')
  })
})
