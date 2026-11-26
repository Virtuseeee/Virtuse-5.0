// User-made Radar rules: "tell me when ...". Written as a sentence or picked
// from templates, checked on the device against today's data. Facts only.

import { dayMoveEur, portfolioRows } from './holdings'
import type { Profile } from './model'
import { overview } from './portfolio'
import type { PriceBook } from './prices'

export type RuleKind = 'move' | 'share_above' | 'networth_below' | 'btc_fee_above' | 'cash_below'

export interface Rule {
  id: string
  kind: RuleKind
  /** Holding symbol, or 'ANY' for every holding. Only for move / share_above. */
  symbol?: string
  /** Percent for move / share_above / btc_fee_above, EUR for the others. */
  value: number
  text: string
}

export interface RuleHit {
  rule: Rule
  /** What was measured, in the rule's unit. */
  actual: number
  symbol?: string
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function numberIn(q: string): number | null {
  const m = /(\d[\d\s.,]*)\s*(k|tis|000)?/.exec(q.replace(/(\d)\s(?=\d{3}\b)/g, '$1'))
  if (!m) return null
  let n = Number(m[1].replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return null
  if (m[2] === 'k' || m[2] === 'tis') n *= 1000
  return n
}

/** Reads a sentence into a rule. Returns null when it is not understood. */
export function parseRule(text: string, knownSymbols: string[]): Rule | null {
  const q = fold(text)
  const n = numberIn(q)
  if (n === null) return null
  const sym = knownSymbols.find((s) => new RegExp(`\\b${s.toLowerCase().replace('.', '\\.')}\\b`).test(q)) ?? (/\b(bitcoin|btc)\b/.test(q) ? 'BTC' : undefined)
  const base = { id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: text.trim() }
  if (/poplat|fee/.test(q)) return { ...base, kind: 'btc_fee_above', value: n }
  if (/hotovost|cash|uspor/.test(q) && /pod|below|menej|less/.test(q)) return { ...base, kind: 'cash_below', value: n }
  if (/majet|net worth|worth/.test(q) && /pod|below|klesne|drops|falls/.test(q)) return { ...base, kind: 'networth_below', value: n }
  if (/podiel|tvori|share|of my assets|majetku/.test(q) && /%/.test(q)) return { ...base, kind: 'share_above', symbol: sym ?? 'ANY', value: n }
  if (/pohn|pohyb|zmeni|klesne|stupne|move|moves|drops|rises/.test(q) && /%/.test(q)) return { ...base, kind: 'move', symbol: sym ?? 'ANY', value: n }
  return null
}

export function checkRules(rules: Rule[], profile: Profile, priceEur: number, book: PriceBook | null): RuleHit[] {
  const o = overview(profile, priceEur, book)
  const rows = portfolioRows(profile, priceEur, book, o.assetsEur)
  const pick = (s?: string) => (s && s !== 'ANY' ? rows.filter((r) => r.symbol.toUpperCase() === s.toUpperCase()) : rows)
  const hits: RuleHit[] = []
  for (const rule of rules) {
    switch (rule.kind) {
      case 'move':
        for (const r of pick(rule.symbol)) if (r.changePct !== undefined && Math.abs(r.changePct) >= rule.value) hits.push({ rule, actual: r.changePct, symbol: r.symbol })
        break
      case 'share_above':
        for (const r of pick(rule.symbol)) if (r.sharePct >= rule.value) hits.push({ rule, actual: r.sharePct, symbol: r.symbol })
        break
      case 'networth_below':
        if (o.assetsEur > 0 && o.netWorthEur < rule.value) hits.push({ rule, actual: o.netWorthEur })
        break
      case 'btc_fee_above':
        if (o.bitcoin.boughtEur > 0 && o.bitcoin.feePct >= rule.value) hits.push({ rule, actual: o.bitcoin.feePct })
        break
      case 'cash_below': {
        const cash = o.allocation.find((s) => s.assetClass === 'cash')?.valueEur ?? 0
        if (cash < rule.value) hits.push({ rule, actual: cash })
        break
      }
    }
  }
  return hits
}

export { dayMoveEur }
