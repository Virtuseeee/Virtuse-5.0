// Sends a question the local engine could not answer to the Virtuse Worker,
// together with the rounded totals from buildAiContext. Nothing else leaves
// the device: no symbols, names, dates, transactions or exact amounts.

import type { Lang } from './format'
import type { AiContext } from './ai-context'
import type { Answer } from './ask'

export const AI_ENDPOINTS = {
  staging: 'https://virtuse-newsletter-staging.virtuse-ai.workers.dev/cfo/ask',
  production: 'https://virtuse-newsletter.virtuse-ai.workers.dev/cfo/ask',
} as const

/** The pilot only talks to the staging Worker; production stays closed. */
export function aiEndpoint(host: string): string | null {
  if (host === 'staging.virtuse.com' || host === 'localhost' || host === '127.0.0.1') return AI_ENDPOINTS.staging
  return null
}

export type AiResult =
  | { ok: true; answer: Answer }
  | { ok: false; reason: 'off' | 'limit' | 'error' }

export async function askAi(
  endpoint: string,
  question: string,
  facts: AiContext,
  lang: Lang,
  fetcher: typeof fetch = fetch,
  timeoutMs = 50_000,
): Promise<AiResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.slice(0, 400), lang, facts }),
      signal: ctrl.signal,
    })
    if (res.status === 503) return { ok: false, reason: 'off' }
    if (res.status === 429) return { ok: false, reason: 'limit' }
    if (!res.ok) return { ok: false, reason: 'error' }
    const body = (await res.json()) as { kind?: string; lines?: unknown; sources?: unknown }
    const lines = Array.isArray(body.lines) ? body.lines.filter((l): l is string => typeof l === 'string' && l.trim() !== '').slice(0, 5) : []
    if (!lines.length) return { ok: false, reason: 'error' }
    const sources = Array.isArray(body.sources) ? body.sources.filter((s): s is string => typeof s === 'string') : []
    return { ok: true, answer: { kind: body.kind === 'decline' ? 'advice' : 'answer', lines, sources, ai: body.kind !== 'decline' } }
  } catch {
    return { ok: false, reason: 'error' }
  } finally {
    clearTimeout(timer)
  }
}
