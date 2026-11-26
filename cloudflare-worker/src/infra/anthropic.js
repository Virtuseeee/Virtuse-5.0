// The one adapter for the Claude API (Anthropic SDK). Every request goes to the
// beta endpoint with the server-side refusal fallback, so a declined request is
// retried on the routed fallback model instead of failing.

import Anthropic from '@anthropic-ai/sdk';

export async function createMessage(env, request, { timeout = 60_000 } = {}) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout });
  return client.beta.messages.create({
    ...request,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
}
