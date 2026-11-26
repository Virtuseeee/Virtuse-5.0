import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { goalProgress } from '../src/core/goals'
import type { PriceBook } from '../src/core/prices'
import { checkRules, parseRule } from '../src/core/rules'
import { annaProfile } from '../src/data/demo'

const book = JSON.parse(readFileSync(new URL('./fixtures/prices.json', import.meta.url), 'utf8')) as PriceBook
book.prices.instruments.find((i) => i.id === 'VWCE')!.changePct = -3
const anna = annaProfile()
const SYMS = ['BTC', 'VWCE.DE', 'CSPX.UK']

describe('parseRule', () => {
  it('reads Slovak and English sentences', () => {
    expect(parseRule('Daj vedieť, keď sa VWCE.DE pohne o viac ako 2 %', SYMS)).toMatchObject({ kind: 'move', symbol: 'VWCE.DE', value: 2 })
    expect(parseRule('Keď sa Bitcoin pohne o 5 %', SYMS)).toMatchObject({ kind: 'move', symbol: 'BTC', value: 5 })
    expect(parseRule('Tell me when any holding moves more than 3%', SYMS)).toMatchObject({ kind: 'move', symbol: 'ANY', value: 3 })
    expect(parseRule('Keď čistý majetok klesne pod 150 000 €', SYMS)).toMatchObject({ kind: 'networth_below', value: 150000 })
    expect(parseRule('Keď hotovosť klesne pod 10k', SYMS)).toMatchObject({ kind: 'cash_below', value: 10000 })
    expect(parseRule('Keď BTC tvorí viac ako 30 % majetku', SYMS)).toMatchObject({ kind: 'share_above', symbol: 'BTC', value: 30 })
    expect(parseRule('Keď poplatky za Bitcoin prekročia 1 %', SYMS)).toMatchObject({ kind: 'btc_fee_above', value: 1 })
    expect(parseRule('Daj mi vedieť niečo zaujímavé', SYMS)).toBeNull()
  })
})

describe('checkRules', () => {
  it('fires on matching facts only', () => {
    const rules = [
      parseRule('keď sa VWCE.DE pohne o 2 %', SYMS)!,
      parseRule('keď sa BTC pohne o 5 %', SYMS)!,
      parseRule('keď čistý majetok klesne pod 1 000 000 €', SYMS)!,
      parseRule('keď hotovosť klesne pod 100 €', SYMS)!,
    ]
    const hits = checkRules(rules, anna, 80000, book)
    expect(hits.map((h) => h.rule.kind)).toEqual(['move', 'networth_below'])
    expect(hits[0]).toMatchObject({ symbol: 'VWCE.DE', actual: -3 })
  })
})

describe('goalProgress', () => {
  it('measures BTC, cash and debt payoff', () => {
    const [btc, cash, debt] = goalProgress(anna.goals!, anna, 80000, book)
    expect(btc.current).toBeCloseTo(anna.txs.length ? btc.current : 0)
    expect(btc.pct).toBeCloseTo(btc.current * 100, 6)
    expect(cash.target).toBe(24000)
    expect(cash.done).toBe(false)
    expect(debt.pct).toBeCloseTo((24000 / 120000) * 100, 6)
    expect(debt.done).toBe(false)
  })
})
