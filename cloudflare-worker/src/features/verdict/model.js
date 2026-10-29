// The Claude call behind Verdict: request shape, response parsing, cost.
// Shared by the Worker (handler.js) and the offline eval (verdict-eval/run.mjs).

import Anthropic from '@anthropic-ai/sdk';
import { SCHEMA, profileLines, systemPrompt } from './domain.js';

export const VERDICT_MODEL = 'claude-opus-5-5';
// USD per token for claude-opus-5-5 ($4 / $20 per million). Counted as EUR
// against the cap, which errs on the safe side.
const PRICE_IN = 4 / 1e6;
const PRICE_OUT = 20 / 1e6;

// The request for one verdict (shared by the Worker and the eval's batch mode).
export function verdictRequest(env, text, lang, profile = {}) {
  const prof = Object.keys(profile).length ? `\n<profile>\n${profileLines(profile)}\n</profile>` : '';
  return {
    model: VERDICT_MODEL,
    max_tokens: 16000,
    output_config: { effort: env.VERDICT_EFFORT || 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: [{ type: 'text', text: systemPrompt(lang), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `<decision>\n${text}\n</decision>${prof}` }],
  };
}

// A Messages API response -> { out, usage } or { refused, usage }.
export function readVerdictResponse(response) {
  if (response.stop_reason === 'refusal') return { refused: true, usage: response.usage };
  if (response.stop_reason === 'max_tokens') throw new Error('verdict: max_tokens');
  const textBlock = [...response.content].reverse().find((b) => b.type === 'text');
  if (!textBlock) throw new Error('verdict: no text block');
  return { out: JSON.parse(textBlock.text), usage: response.usage };
}

// One call to Claude. Returns { out, usage } where out is the parsed JSON.
export async function askClaude(env, text, lang, profile = {}) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000 });
  const response = await client.beta.messages.create({
    ...verdictRequest(env, text, lang, profile),
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
  return readVerdictResponse(response);
}

export function costOf(usage) {
  if (!usage) return 0;
  const input = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * 0.1;
  return input * PRICE_IN + (usage.output_tokens || 0) * PRICE_OUT;
}
