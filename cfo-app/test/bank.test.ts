import { describe, expect, it } from 'vitest'
import { bankDate, cashFlow, categorize } from '../src/core/bank'
import { importCsv } from '../src/core/importers'
import { ForeignCurrencyError } from '../src/core/importers/bank'
import { overview } from '../src/core/portfolio'
import { annaProfile } from '../src/data/demo'
import { SAMPLES } from '../src/data/samples'

const bank = (text: string) => {
  const r = importCsv(text)
  if (r.kind !== 'bank') throw new Error(`expected bank, got ${r.kind}`)
  return r.account
}

describe('bank CSV import', () => {
  it('reads a Slovak-style statement with info lines, ; and decimal commas', () => {
    const a = bank(SAMPLES.bank)
    expect(a.txs).toHaveLength(45)
    expect(a.txs[0]).toMatchObject({ date: '2026-09-01', amountEur: 2950, category: 'income' })
    expect(a.balanceEur).toBe(4401.01)
    expect(a.period).toBe('2026-09-01 – 2026-11-25')
  })

  it('reads an English export with separate money in / money out columns', () => {
    const a = bank('Date,Description,Money out,Money in,Balance\n2026-10-01,Salary ACME,,3000.00,3100.00\n2026-10-03,TESCO STORES,45.10,,3054.90\n')
    expect(a.txs.map((t) => [t.amountEur, t.category])).toEqual([[3000, 'income'], [-45.1, 'groceries']])
    expect(a.balanceEur).toBe(3054.9)
  })

  it('refuses a statement in another currency', () => {
    expect(() => importCsv('Datum;Suma;Mena;Popis\n01.10.2026;-10,00;CZK;Albert\n')).toThrow(ForeignCurrencyError)
  })

  it('still detects broker and exchange files first', () => {
    expect(importCsv(SAMPLES.xtbCash).kind).toBe('broker')
    expect(importCsv(SAMPLES.t212).kind).toBe('broker')
  })
})

describe('categories and cash flow', () => {
  it('categorizes by keywords and parses dates', () => {
    expect(categorize('Platba kartou · LIDL Petržalka', -40)).toBe('groceries')
    expect(categorize('Payward Ltd. (Kraken) · Nákup BTC', -500)).toBe('investing')
    expect(categorize('NETFLIX.COM', -12.99)).toBe('subscriptions')
    expect(categorize('Neznámy obchod', -5)).toBe('other')
    expect(bankDate('5.2.2026')).toBe('2026-02-05')
    expect(bankDate('2026-02-05T10:00')).toBe('2026-02-05')
    expect(bankDate('x')).toBeNull()
  })

  it('keeps investing and transfers out of spending', () => {
    const f = cashFlow([bank(SAMPLES.bank)]).find((m) => m.month === '2026-10')!
    expect(f.incomeEur).toBe(2950)
    expect(f.byCategory.investing).toBe(800)
    expect(f.byCategory.transfers).toBe(200)
    expect(f.spendingEur).toBeCloseTo(640 + 85.4 + 12.99 + 10.99 + 64.2 + 48.75 + 37.1 + 71.3 + 42.5 + 55 + 24.9, 2)
    expect(f.netEur).toBeCloseTo(f.incomeEur - f.spendingEur, 2)
  })

  it('adds the bank balance to cash in the overview', () => {
    const anna = annaProfile()
    const withBank = overview(anna, 80000).allocation.find((s) => s.assetClass === 'cash')!.valueEur
    const without = overview({ ...anna, banks: [] }, 80000).allocation.find((s) => s.assetClass === 'cash')!.valueEur
    expect(withBank - without).toBeCloseTo(4401.01, 2)
  })
})

import { ask } from '../src/core/ask'
import { checkRules, parseRule } from '../src/core/rules'
import { open, seal } from '../src/core/vault'
import { DEFAULT_RADAR, radarItems } from '../src/core/radar'

describe('bank in ask, rules, radar and the vault', () => {
  const anna = annaProfile()
  it('answers a spending question from the latest month', () => {
    const a = ask('Koľko som minul?', anna, 80000, null, 'sk')
    expect(a.lines[0]).toMatch(/^2026-11: príjmy/)
    expect(a.sources[0]).toMatch(/Bankový výpis/)
  })
  it('fires an expense rule on a big payment in the last 31 days, not on investing', () => {
    const rule = parseRule('Daj vedieť pri výdavku nad 500 €', [])!
    expect(rule.kind).toBe('expense_above')
    const hits = checkRules([rule], anna, 80000, null, '2026-11-26')
    expect(hits.map((h) => h.actual)).toEqual([640])
  })
  it('lists subscriptions of the last full month on the Radar', () => {
    const codes = radarItems(anna, 80000, null, { ...DEFAULT_RADAR, today: '2026-11-26' }).map((i) => i.code)
    expect(codes).toContain('subscriptions')
  })
  it('keeps chats in the encrypted profile', async () => {
    const p = { ...anna, chats: [{ id: 'c1', title: 'Test', msgs: [{ role: 'user' as const, text: 'Ahoj' }] }] }
    expect((await open(await seal(p, 'correct horse battery'), 'correct horse battery')).chats).toEqual(p.chats)
  })
})
