import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ask } from '../src/core/ask'
import { portfolioRows } from '../src/core/holdings'
import { overview } from '../src/core/portfolio'
import type { PriceBook } from '../src/core/prices'
import { DEFAULT_RADAR, radarItems } from '../src/core/radar'
import { annaProfile } from '../src/data/demo'

const book = JSON.parse(readFileSync(new URL('./fixtures/prices.json', import.meta.url), 'utf8')) as PriceBook
book.prices.instruments.find((i) => i.id === 'VWCE')!.changePct = -3
const anna = annaProfile()
const PRICE = 80000

describe('portfolio rows', () => {
  it('lists BTC and broker positions, largest first, with shares of all assets', () => {
    const o = overview(anna, PRICE, book)
    const rows = portfolioRows(anna, PRICE, book, o.assetsEur)
    expect(rows.map((r) => r.symbol)).toContain('BTC')
    expect(rows.map((r) => r.symbol)).toContain('VWCE.DE')
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].valueEur).toBeGreaterThanOrEqual(rows[i].valueEur)
    const vw = rows.find((r) => r.symbol === 'VWCE.DE')!
    expect(vw.sharePct).toBeCloseTo((9000 / o.assetsEur) * 100, 6)
  })
})

describe('radar', () => {
  const items = radarItems(anna, PRICE, book, { ...DEFAULT_RADAR, today: '2026-11-30' })
  const codes = items.map((i) => i.code)
  it('reports a big move, stale prices, debt, real estate share and own-wallet custody', () => {
    expect(codes).toContain('move')
    expect(items.find((i) => i.code === 'move')!.vars.symbol).toBe('VWCE.DE')
    expect(codes).toContain('prices_stale')
    expect(codes).toContain('debt_ratio')
    expect(codes).toContain('real_estate')
    expect(codes).toContain('own_wallet')
  })
  it('puts watch items first', () => {
    const firstInfo = items.findIndex((i) => i.level === 'info')
    expect(items.slice(firstInfo).every((i) => i.level === 'info')).toBe(true)
  })
  it('is quiet about stale prices the day they were built', () => {
    expect(radarItems(anna, PRICE, book, { ...DEFAULT_RADAR, today: '2026-11-20' }).map((i) => i.code)).not.toContain('prices_stale')
  })
})

describe('ask', () => {
  it('refuses advice in Slovak and English, with no numbers in the reply', () => {
    for (const [q, lang] of [['Mám kúpiť viac Bitcoinu?', 'sk'], ['Oplatí sa predať VWCE?', 'sk'], ['Should I sell my ETF?', 'en'], ['Kam pôjde cena?', 'sk']] as const) {
      const a = ask(q, anna, PRICE, book, lang)
      expect(a.kind, q).toBe('advice')
      expect(a.lines.join(' ')).not.toMatch(/\d/)
    }
  })
  it('answers net worth with the overview number and sources', () => {
    const o = overview(anna, PRICE, book)
    const a = ask('Aký je môj čistý majetok?', anna, PRICE, book, 'sk')
    expect(a.kind).toBe('answer')
    expect(a.lines[0]).toContain(new Intl.NumberFormat('sk-SK').format(Math.round(o.netWorthEur)).replace(/\s/g, ' '))
    expect(a.sources.length).toBeGreaterThan(0)
  })
  it('handles fees, moves, holdings, a broker and unknown questions', () => {
    expect(ask('Koľko som zaplatil na poplatkoch?', anna, PRICE, book, 'sk').lines[0]).toMatch(/poplatkoch/)
    expect(ask('What moved most today?', anna, PRICE, book, 'en').lines[1]).toMatch(/^VWCE\.DE: -3/)
    expect(ask('Aké sú moje najväčšie pozície?', anna, PRICE, book, 'sk').lines.length).toBeGreaterThan(1)
    expect(ask('Čo mám na XTB?', anna, PRICE, book, 'sk').lines[0]).toMatch(/^XTB/)
    expect(ask('Aké bude počasie?', anna, PRICE, book, 'sk').kind).toBe('unknown')
  })
})
