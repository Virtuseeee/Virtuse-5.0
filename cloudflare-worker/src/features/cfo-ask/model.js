// The Claude call behind Ask your CFO. Shared by the Worker and the offline eval.

import { createMessage } from '../../infra/anthropic.js';
import { SCHEMA, systemPrompt, userMessage } from './domain.js';

export const CFO_MODEL = 'claude-opus-5-5';
const PRICE_IN = 4 / 1e6;
const PRICE_OUT = 20 / 1e6;

export function cfoRequest(env, question, facts, lang) {
  return {
    model: CFO_MODEL,
    max_tokens: 4000,
    output_config: { effort: env.CFO_ASK_EFFORT || 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: [{ type: 'text', text: systemPrompt(lang), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage(question, facts) }],
  };
}

export function readCfoResponse(response) {
  if (response.stop_reason === 'refusal') return { refused: true, usage: response.usage };
  if (response.stop_reason === 'max_tokens') throw new Error('cfo-ask: max_tokens');
  const textBlock = [...response.content].reverse().find((b) => b.type === 'text');
  if (!textBlock) throw new Error('cfo-ask: no text block');
  return { out: JSON.parse(textBlock.text), usage: response.usage };
}

export async function askCfoModel(env, question, facts, lang) {
  const response = await createMessage(env, cfoRequest(env, question, facts, lang), { timeout: 45_000 });
  return readCfoResponse(response);
}

export function cfoCost(usage) {
  if (!usage) return 0;
  const input = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * 0.1;
  return input * PRICE_IN + (usage.output_tokens || 0) * PRICE_OUT;
}
