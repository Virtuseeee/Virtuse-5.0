import { describe, expect, it } from 'vitest'
import { aiEndpoint, askAi } from '../src/core/ai-client'
import type { AiContext } from '../src/core/ai-context'

const facts = { v: 1, country: 'SK' } as unknown as AiContext
const fake = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch

describe('askAi', () => {
  it('marks model answers as AI and declines as advice', async () => {
    const r = await askAi('x', 'q', facts, 'sk', fake(200, { kind: 'answer', lines: ['a', 7, ''], sources: ['tax'] }))
    expect(r).toEqual({ ok: true, answer: { kind: 'answer', lines: ['a'], sources: ['tax'], ai: true } })
    const d = await askAi('x', 'q', facts, 'sk', fake(200, { kind: 'decline', lines: ['no'], sources: [] }))
    expect(d.ok && d.answer.kind).toBe('advice')
  })
  it('maps closed, limited and broken responses', async () => {
    expect(await askAi('x', 'q', facts, 'sk', fake(503, {}))).toEqual({ ok: false, reason: 'off' })
    expect(await askAi('x', 'q', facts, 'sk', fake(429, {}))).toEqual({ ok: false, reason: 'limit' })
    expect(await askAi('x', 'q', facts, 'sk', fake(200, { lines: [] }))).toEqual({ ok: false, reason: 'error' })
    expect(await askAi('x', 'q', facts, 'sk', (async () => { throw new Error('offline') }) as typeof fetch)).toEqual({ ok: false, reason: 'error' })
  })
  it('sends only question, lang and facts', async () => {
    let sent = ''
    await askAi('x', 'q'.repeat(500), facts, 'en', (async (_u: unknown, init?: RequestInit) => { sent = String(init?.body); return new Response('{}', { status: 503 }) }) as typeof fetch)
    expect(Object.keys(JSON.parse(sent))).toEqual(['question', 'lang', 'facts'])
    expect(JSON.parse(sent).question.length).toBe(400)
  })
  it('only staging and local hosts get an endpoint', () => {
    expect(aiEndpoint('staging.virtuse.com')).toMatch(/staging/)
    expect(aiEndpoint('virtuse.com')).toBeNull()
  })
})
