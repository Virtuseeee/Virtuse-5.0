// Composition root: builds the per-request context, wires the adapters
// (Resend, KV, Claude) into the features, and declares the route order.
// This is the only module that knows about every feature.

import { SIGNUP_LIMIT, isAllowedOrigin } from './config.js';
import { json, preflight } from './http/responses.js';
import { ANY, on, pipeline, prefix } from './http/router.js';
import { createResendClient } from './infra/resend.js';
import { createKvLimiter } from './shared/rate-limiter.js';

import { handleEcosystemApply } from './features/ecosystem/handler.js';
import { createBriefList } from './features/newsletter/brief-list.js';
import { handleSubscribe } from './features/newsletter/subscribe-handler.js';
import { handleUnsubscribe } from './features/newsletter/unsubscribe-handler.js';
import { handlePulse } from './features/pulse/handler.js';
import { handleSend } from './features/send/handler.js';
import { handleCheckout, handleReport, handleStripeWebhook } from './features/verdict-pay/handler.js';
import { handleVerdict } from './features/verdict/handler.js';
import { askClaude } from './features/verdict/model.js';
import { handleVersion } from './features/version/handler.js';
import { handleWaitlist } from './features/waitlist/handler.js';
import { WP_PREFIX, handleWpProxy } from './features/wp-proxy/handler.js';

// Adapters for one request. Built lazily: public routes like GET /pulse.json
// never need them.
function createServices(env, fetchImpl) {
  const resend = createResendClient(env.RESEND_API_KEY, fetchImpl);
  const limiter = createKvLimiter(env.RATE_LIMIT_KV);
  return {
    resend,
    limiter,
    brief: createBriefList({ env, resend }),
    signupLimited: (ip) => limiter.exceeded(`ratelimit:${ip}`, SIGNUP_LIMIT.max, SIGNUP_LIMIT.windowSeconds),
    verdictModel: { ask: (text, lang, profile) => askClaude(env, text, lang, profile) },
  };
}

function createContext(request, env, { fetchImpl, clock }) {
  const url = new URL(request.url);
  let services;
  return {
    request,
    env,
    url,
    path: url.pathname,
    method: request.method,
    origin: request.headers.get('Origin') || '',
    now: clock(),
    fetch: fetchImpl,
    get services() {
      return (services ??= createServices(env, fetchImpl));
    },
  };
}

// Site routes: browser fetch() from virtuse.com, behind the origin gate.
const siteOnly = (ctx) => (isAllowedOrigin(ctx.origin) ? undefined : json(403, { error: 'Origin not allowed' }, ctx.origin));
const postOnly = (ctx) => (ctx.method === 'POST' ? undefined : json(405, { error: 'Method not allowed' }, ctx.origin));
const notFound = (ctx) => json(404, { error: 'Not found' }, ctx.origin);

const route = pipeline(
  // Public routes, before the gate.
  on(['GET', 'HEAD'], '/version', handleVersion),
  // Pulse: GET is public, the publisher is curl with a bearer token (no Origin).
  on(ANY, ['/pulse.json', '/pulse/rollback'], (c) => handlePulse(c.request, c.env, c.origin, c.path)),
  // Read-only WordPress proxy for the Stories build on GitHub runners (no Origin).
  on(ANY, prefix(WP_PREFIX + '/'), (c) => handleWpProxy(c.request, c.url, c.fetch)),
  // Stripe calls it (no Origin); the signature is the proof.
  on(ANY, '/verdict/stripe-webhook', handleStripeWebhook),
  on(['OPTIONS'], ANY, (c) => preflight(c.origin)),
  // Clicked from an email client: no Origin; the HMAC token is the proof.
  on(['GET'], '/unsubscribe', handleUnsubscribe),

  siteOnly,
  postOnly,
  on(['POST'], '/send', handleSend),
  on(['POST'], '/verdict', handleVerdict),
  on(['POST'], '/verdict/checkout', handleCheckout),
  on(['POST'], '/verdict/report', handleReport),
  on(['POST'], '/ecosystem-apply', handleEcosystemApply),
  on(['POST'], '/waitlist', handleWaitlist),
  on(['POST'], '/subscribe', handleSubscribe),
  notFound
);

// fetchImpl and clock are seams for tests; production uses the globals.
export function createWorker({ fetchImpl = (...args) => globalThis.fetch(...args), clock = () => Date.now() } = {}) {
  return {
    async fetch(request, env) {
      return route(createContext(request, env, { fetchImpl, clock }));
    },
  };
}
