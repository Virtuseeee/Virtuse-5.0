// The Worker (cloudflare-worker/src/features/cfo-ask/domain.js) rejects any
// AI context with a value it does not know. This keeps both lists in step.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ASSET_CLASSES } from '../src/core/model'
import { buildAiContext } from '../src/core/ai-context'
import { annaProfile } from '../src/data/demo'

const worker = readFileSync(new URL('../../cloudflare-worker/src/features/cfo-ask/domain.js', import.meta.url), 'utf8')
const list = (name: string) => JSON.parse(worker.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))![1].replace(/'/g, '"')) as string[]
const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const union = (text: string, name: string) => [...text.match(new RegExp(`type ${name} =([^\\n]*(\\n\\s*\\|[^\\n]*)*)`))![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])

describe('AI context contract with the Worker', () => {
  it('uses the same categories, classes, goals and debt kinds', () => {
    expect(union(src('../src/core/bank.ts'), 'Category').sort()).toEqual(list('CATS').sort())
    expect([...ASSET_CLASSES].sort()).toEqual(list('CLASSES').sort())
    expect(union(src('../src/core/goals.ts'), 'GoalKind').sort()).toEqual(list('GOALS').sort())
    expect(src('../src/core/model.ts')).toMatch(/kind: 'mortgage' \| 'loan' \| 'btc_loan'/)
    expect(list('DEBTS').sort()).toEqual(['btc_loan', 'loan', 'mortgage'])
  })
  it('the demo context has only keys the Worker reads', () => {
    const c = buildAiContext(annaProfile(), 60000, null, '2026-11-26')
    expect(Object.keys(c).sort()).toEqual(['assets_eur', 'brokers', 'btc', 'cash_flow', 'class_pct', 'country', 'day_move_eur', 'debt_kinds', 'debts_eur', 'goals', 'net_worth_eur', 'tax', 'v'])
  })
})
