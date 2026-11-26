// Composition root: builds the per-request context, wires the adapters
// (Resend, KV, Claude) into the features, and declares the route order.
// This is the only module that knows about every feature.

import { handleResendWebhook } from './features/verdict-pay/alerts.js';
import { EMAIL_CAPS, SIGNUP_LIMIT, TURNSTILE_FORM_HOSTS, TURNSTILE_SITEKEY, isAllowedOrigin } from './config.js';
import { clientIp } from './http/request.js';
import { json, preflight } from './http/responses.js';
import { ANY, on, pipeline, prefix } from './http/router.js';
import { createResendClient } from './infra/resend.js';
import { verifyTurnstile } from './infra/turnstile.js';
import { ipHash } from './shared/crypto.js';
import { createEmailCap } from './shared/email-cap.js';
import { createKvLimiter } from './shared/rate-limiter.js';

import { runBriefHealth } from './features/brief-health/handler.js';
import { runDataFreshness } from './features/data-freshness/handler.js';
import { handleEcosystemApply } from './features/ecosystem/handler.js';
import { createBriefList } from './features/newsletter/brief-list.js';
import { handleSubscribe } from './features/newsletter/subscribe-handler.js';
import { handleUnsubscribe } from './features/newsletter/unsubscribe-handler.js';
import { handlePulse } from './features/pulse/handler.js';
import { handleSend } from './features/send/handler.js';
import { handleCheckout, handleReport, handleStripeWebhook } from './features/verdict-pay/handler.js';
import { handleWithdraw } from './features/verdict-pay/withdraw.js';
import { handleVerdict } from './features/verdict/handler.js';
import { askClaude } from './features/verdict/model.js';
import { handleCfoAsk } from './features/cfo-ask/handler.js';
import { askCfoModel } from './features/cfo-ask/model.js';
import { handleVersion } from './features/version/handler.js';
import { handleVerdictStatus } from './features/verdict-pay/status.js';
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
    // Keyed by the day-salted hash of the IP (privacy policy), never the address itself.
    signupLimited: async (ip, now = Date.now()) =>
      limiter.exceeded(`ratelimit:${await ipHash(ip, new Date(now).toISOString().slice(0, 10), env)}`, SIGNUP_LIMIT.max, SIGNUP_LIMIT.windowSeconds),
    // Hourly ceiling for all visitors together: sign-up and result emails share one budget,
    // the withdrawal confirmation has its own (a flood of sign-ups must never use it up).
    emailCap: createEmailCap({ env, limiter, resend, buckets: EMAIL_CAPS }),
    // Turnstile on the public forms. Resolves null when the request may go on, else the 403
    // the form's client (vb-api.js) answers by fetching a token and repeating the request.
    // Off (null for everyone) unless TURNSTILE_FORMS=require; a missing secret also means off,
    // loudly, so a setup slip never closes the forms.
    async captcha(request, token, origin) {
      if (env.TURNSTILE_FORMS !== 'require') return null;
      if (!env.TURNSTILE_SECRET_KEY) { console.error('TURNSTILE_FORMS=require but TURNSTILE_SECRET_KEY is not set: forms stay open'); return null; }
      const ok = await verifyTurnstile({ secret: env.TURNSTILE_SECRET_KEY, token, ip: clientIp(request), allowedHosts: TURNSTILE_FORM_HOSTS, fetchImpl });
      return ok ? null : json(403, { error: 'Please confirm you are not a robot and try again.', code: 'captcha', sitekey: TURNSTILE_SITEKEY }, origin);
    },
    verdictModel: { ask: (text, lang, profile) => askClaude(env, text, lang, profile) },
    cfoModel: { ask: (question, facts, lang) => askCfoModel(env, question, facts, lang) },
  };
}

// Staging shares the RATE_LIMIT_KV namespace with production. KV_PREFIX (set only
// in [env.staging]) puts every staging key under its own prefix, so a staging
// test can never be read as a production order, result or rate-limit counter.
export function scopedKv(kv, prefix) {
  if (!kv || !prefix) return kv;
  return {
    get: (key, ...rest) => kv.get(prefix + key, ...rest),
    put: (key, ...rest) => kv.put(prefix + key, ...rest),
    delete: (key, ...rest) => kv.delete(prefix + key, ...rest),
  };
}

const scopedEnv = (rawEnv) => (rawEnv.KV_PREFIX ? { ...rawEnv, RATE_LIMIT_KV: scopedKv(rawEnv.RATE_LIMIT_KV, rawEnv.KV_PREFIX) } : rawEnv);

function createContext(request, rawEnv, { fetchImpl, clock }) {
  const env = scopedEnv(rawEnv);
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
  // Verdict: are €14 payments open? (boolean only, same as the checkout's 503)
  on(['GET', 'HEAD'], '/verdict/status', handleVerdictStatus),
  // Pulse: GET is public, the publisher is curl with a bearer token (no Origin).
  on(ANY, ['/pulse.json', '/pulse/rollback'], (c) => handlePulse(c.request, c.env, c.origin, c.path)),
  // Read-only WordPress proxy for the Stories build on GitHub runners (no Origin).
  on(ANY, prefix(WP_PREFIX + '/'), (c) => handleWpProxy(c.request, c.url, c.fetch)),
  // Stripe calls it (no Origin); the signature is the proof.
  on(ANY, '/verdict/stripe-webhook', handleStripeWebhook),
  // Resend calls it (no Origin); the Svix signature is the proof.
  on(ANY, '/resend/webhook', handleResendWebhook),
  on(['OPTIONS'], ANY, (c) => preflight(c.origin)),
  // Clicked from an email client: no Origin; the HMAC token is the proof.
  on(['GET'], '/unsubscribe', handleUnsubscribe),

  siteOnly,
  postOnly,
  on(['POST'], '/send', handleSend),
  on(['POST'], '/verdict', handleVerdict),
  on(['POST'], '/cfo/ask', handleCfoAsk),
  on(['POST'], '/verdict/checkout', handleCheckout),
  on(['POST'], '/verdict/report', handleReport),
  on(['POST'], '/verdict/withdraw', handleWithdraw),
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
    // Cron trigger (wrangler.toml [triggers], production only): the daily Brief check
    // and the data freshness check. Returns the Brief check's result.
    async scheduled(event, rawEnv, execCtx) {
      const env = scopedEnv(rawEnv);
      const now = clock();
      const services = createServices(env, fetchImpl);
      const run = runBriefHealth({ env, now, fetch: fetchImpl, services });
      const data = runDataFreshness({ env, now, fetch: fetchImpl, services });
      const both = Promise.allSettled([run, data]);
      if (execCtx?.waitUntil) execCtx.waitUntil(both);
      return both.then(() => run);
    },
  };
}
