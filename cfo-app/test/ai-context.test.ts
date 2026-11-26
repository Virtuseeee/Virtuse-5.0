import { describe, expect, it } from 'vitest'
import { buildAiContext, roundEur } from '../src/core/ai-context'
import { annaProfile } from '../src/data/demo'

describe('AI context (what the AI CFO may see)', () => {
  const anna = annaProfile()
  const ctx = buildAiContext(anna, 80000, null, '2026-11-26')
  const json = JSON.stringify(ctx)

  it('rounds sums coarsely', () => {
    expect(roundEur(1234.56)).toBe(1200)
    expect(roundEur(987)).toBe(990)
    expect(roundEur(173_456)).toBe(173_000)
    expect(ctx.net_worth_eur % 100).toBe(0)
  })

  it('carries no names, symbols, ids, account numbers or single payments', () => {
    for (const tx of anna.txs) expect(json).not.toContain(tx.id)
    for (const a of anna.manualAssets) expect(json).not.toContain(a.name)
    for (const l of anna.liabilities) expect(json).not.toContain(l.name)
    for (const b of anna.brokers) for (const h of b.holdings) expect(json).not.toContain(h.symbol)
    for (const b of anna.banks ?? []) {
      expect(json).not.toContain(b.name)
      for (const t of b.txs) {
        expect(json).not.toContain(t.description.split(' · ')[0])
        expect(json).not.toContain(t.date)
      }
    }
    for (const g of anna.goals ?? []) expect(json).not.toContain(g.name)
    expect(json).not.toMatch(/SK\d{2}/)
  })

  it('has the facts the model needs', () => {
    expect(ctx.cash_flow?.month).toBe('2026-10')
    expect(ctx.tax?.year).toBe(2026)
    expect(ctx.goals.map((g) => g.kind)).toEqual(['btc', 'cash', 'debt_free'])
    expect(ctx.debt_kinds).toEqual(['mortgage'])
  })
})
