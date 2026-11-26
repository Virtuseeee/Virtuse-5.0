import { describe, expect, it } from 'vitest'
import { buildSummary, UPLOAD_KEYS } from '../src/core/upload'
import { annaProfile, DEMO_PRICE_EUR } from '../src/data/demo'

describe('buildSummary (what may leave the device)', () => {
  const profile = annaProfile()
  const s = buildSummary(profile, DEMO_PRICE_EUR)
  const json = JSON.stringify(s)

  it('has exactly the allowed keys', () => {
    expect(Object.keys(s).sort()).toEqual([...UPLOAD_KEYS].sort())
  })

  it('carries no transaction id, date, asset name or exact amount', () => {
    for (const tx of profile.txs) {
      expect(json).not.toContain(tx.id)
      expect(json).not.toContain(tx.time.slice(0, 10))
    }
    for (const a of profile.manualAssets) expect(json).not.toContain(a.name)
    for (const l of profile.liabilities) expect(json).not.toContain(l.name)
    expect(json).not.toContain(String(profile.liabilities[0].balanceEur))
    for (const b of profile.brokers) for (const h of b.holdings) expect(json).not.toContain(h.symbol)
    expect(json).not.toContain('12345678')
  })

  it('rounds the money totals', () => {
    expect(s.fees_paid_eur % 10).toBe(0)
    expect(s.invested_eur % 100).toBe(0)
    expect(Number.isInteger(s.btc_share_pct)).toBe(true)
    expect(s.has_debt).toBe(true)
    expect(s.brokers).toEqual(['xtb'])
    expect(s.broker_fees_eur % 10).toBe(0)
  })
})
