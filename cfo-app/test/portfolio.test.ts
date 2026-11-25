import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importCsv } from '../src/core/importers'
import { emptyProfile } from '../src/core/model'
import { bitcoinFacts, overview } from '../src/core/portfolio'
import { annaProfile, DEMO_PRICE_EUR } from '../src/data/demo'

const csv = readFileSync(new URL('./fixtures/kraken-ledgers.csv', import.meta.url), 'utf8')

describe('bitcoinFacts', () => {
  const p = { ...emptyProfile('t'), txs: importCsv(csv).txs }
  const f = bitcoinFacts(p, 100_000)

  it('counts BTC after buys, sells and fees; a withdrawal to own wallet stays owned', () => {
    expect(f.btc).toBeCloseTo(0.007935, 9)
  })

  it('adds EUR fees and the withdrawal network fee at today’s price', () => {
    expect(f.feesEur).toBeCloseTo(2 + 4 + 1 + 0.000015 * 100_000, 6)
    expect(f.feePct).toBeCloseTo((f.feesEur / 900) * 100, 6)
  })

  it('reports invested, average price and gain', () => {
    expect(f.boughtEur).toBe(900)
    expect(f.netInvestedEur).toBe(700)
    expect(f.avgBuyPrice).toBe(90_000)
    expect(f.gainEur).toBeCloseTo(0.007935 * 100_000 - 700, 6)
    expect(f.firstBuy).toBe('2026-01-05T09:12:33Z')
  })
})

describe('overview', () => {
  it('splits Anna’s assets by class and subtracts the mortgage', () => {
    const o = overview(annaProfile(), DEMO_PRICE_EUR)
    expect(o.bitcoin.buys).toBe(35)
    expect(o.liabilitiesEur).toBe(96_000)
    expect(o.netWorthEur).toBeCloseTo(o.assetsEur - 96_000, 6)
    expect(o.allocation.reduce((s, c) => s + c.pct, 0)).toBeCloseTo(100, 6)
    expect(o.btcSharePct).toBeGreaterThan(0)
    expect(o.btcSharePct).toBeLessThan(15)
  })

  it('is all zeros for an empty profile', () => {
    const o = overview(emptyProfile(), 80_000)
    expect(o.assetsEur).toBe(0)
    expect(o.allocation).toEqual([])
    expect(o.btcSharePct).toBe(0)
  })
})
