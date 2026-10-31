import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { SIGNALS } from '../src/features/verdict/index.js';
import { stripeSignature, stripeForm } from '../src/infra/stripe.js';
import { paymentsOn, REPORT_WINDOW_MS } from '../src/features/verdict-pay/domain.js';

const STAGING = 'https://staging.virtuse.com';
const WHSEC = 'whsec_test_secret';
const SID = 'cs_test_a1B2c3D4e5F6g7H8';

function mockKv() {
  const store = new Map();
  return { store, async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); } };
}

function env(extra = {}) {
  return {
    RATE_LIMIT_KV: mockKv(), ANTHROPIC_API_KEY: 'sk-ant-test', VERDICT_ENABLED: '1',
    VERDICT_PAYMENTS: '1', STRIPE_TEST_ONLY: '1', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_PRICE_ID_VERDICT: 'price_123',
    ...extra,
  };
}

function post(path, body, { origin = STAGING, ip = '1.2.3.4', headers = {} } = {}) {
  return new Request(`https://w.example${path}`, {
    method: 'POST',
    headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const POINTS = { worst_case: 3, liquidity: 8, tax: 4, custody: 6, plan_b: 5, goal: 7, horizon: 7, alternatives: 3, rule: 6, asymmetry: 6 };
const MODEL_OUT = {
  declined: false, is_loan: false, drawdown_tested: true, tax_rule_wrong: false, country: 'sk',
  signals: SIGNALS.map((s) => ({ id: s.id, points: POINTS[s.id], reason: `Text o ${s.id}.` })),
  missing: ['Aký je váš plán pri poklese o 70 %?', 'Kto zdedí kľúče?'],
};

// fetch mock: Anthropic answers with MODEL_OUT, Stripe with whatever `stripe` returns.
function withApis(fn, stripe = () => ({ status: 404, body: { error: { type: 'invalid_request_error' } } })) {
  return async () => {
    const calls = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
      const u = String(url);
      calls.push({ url: u, init });
      if (u.startsWith('https://api.stripe.com/')) {
        const r = stripe(u, init);
        return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
        content: [{ type: 'text', text: JSON.stringify(MODEL_OUT) }],
        usage: { input_tokens: 3000, output_tokens: 1500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try { await fn(calls); } finally { globalThis.fetch = orig; }
  };
}

async function freeVerdict(e) {
  const res = await worker.fetch(post('/verdict', { text: 'Chcem kúpiť Bitcoin za 10 000 € z úspor a držať ho 5 rokov.', lang: 'sk', report: true }), e);
  return res.json();
}

function session(rid, over = {}) {
  return { id: SID, object: 'checkout.session', payment_status: 'paid', livemode: false, amount_total: 1400, currency: 'eur', payment_intent: 'pi_1', metadata: { product: 'verdict_report', rid, lang: 'sk' }, ...over };
}

async function webhook(e, event, { secret = WHSEC, t = Math.floor(Date.now() / 1000) } = {}) {
  const payload = JSON.stringify(event);
  const sig = await stripeSignature(secret, t, payload);
  return worker.fetch(post('/verdict/stripe-webhook', payload, { origin: null, headers: { 'Stripe-Signature': `t=${t},v1=${sig}` } }), e);
}

test('paymentsOn: needs the flag and both Stripe values; a live key on staging switches it off', () => {
  assert.equal(paymentsOn(env()), true);
  assert.equal(paymentsOn(env({ VERDICT_PAYMENTS: undefined })), false);
  assert.equal(paymentsOn(env({ STRIPE_PRICE_ID_VERDICT: '' })), false);
  assert.equal(paymentsOn(env({ STRIPE_SECRET_KEY: 'sk_live_x' })), false);
  assert.equal(paymentsOn(env({ STRIPE_SECRET_KEY: 'rk_test_x' })), true);
  assert.equal(paymentsOn(env({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_TEST_ONLY: undefined })), true);
});

test('stripeForm encodes nested params like the Stripe API wants', () => {
  const f = stripeForm({ line_items: [{ price: 'p', quantity: 1 }], metadata: { rid: 'r' }, skip: undefined });
  assert.equal(f.toString(), 'line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Brid%5D=r');
});

test('free verdict with payments: 2 signals, a rid, the result in KV; report:true is ignored', withApis(async () => {
  const e = env();
  const r = await freeVerdict(e);
  assert.equal(r.pay, true);
  assert.match(r.rid, /^[a-f0-9]{32}$/);
  assert.equal(r.report, undefined);
  assert.equal(r.signals.length, 2);
  const stored = JSON.parse(e.RATE_LIMIT_KV.store.get(`verdict:res:${r.rid}`));
  assert.equal(stored.result.signals.length, 10);
  assert.equal(JSON.stringify(stored).includes('10 000'), false, 'decision text is not stored');
}));

test('without payments nothing is stored and no rid is returned', withApis(async () => {
  const e = env({ VERDICT_PAYMENTS: undefined });
  const r = await freeVerdict(e);
  assert.equal(r.rid, undefined);
  assert.equal([...e.RATE_LIMIT_KV.store.keys()].some((k) => k.startsWith('verdict:res:')), false);
}));

test('checkout creates a Session for the stored rid with the price, metadata and return URLs', withApis(async (calls) => {
  const e = env();
  const { rid } = await freeVerdict(e);
  const res = await worker.fetch(post('/verdict/checkout', { rid, lang: 'sk' }), e);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).url, 'https://checkout.stripe.com/c/pay/cs_test_x');
  const call = calls.find((c) => c.url === 'https://api.stripe.com/v1/checkout/sessions');
  const p = new URLSearchParams(call.init.body);
  assert.equal(p.get('mode'), 'payment');
  assert.equal(p.get('line_items[0][price]'), 'price_123');
  assert.equal(p.get('metadata[rid]'), rid);
  assert.equal(p.get('metadata[product]'), 'verdict_report');
  assert.equal(p.get('success_url'), `${STAGING}/sk/verdict.html?session_id={CHECKOUT_SESSION_ID}`);
  assert.equal(p.get('locale'), 'sk');
  assert.equal(p.get('automatic_tax[enabled]'), null);
  assert.equal(call.init.headers.Authorization, 'Bearer sk_test_x');
  assert.equal(call.init.headers['Idempotency-Key'], `verdict-checkout-${rid}-sk`);
}, () => ({ status: 200, body: { id: 'cs_test_x', url: 'https://checkout.stripe.com/c/pay/cs_test_x' } })));

test('checkout: Stripe Tax and invoices only when switched on', withApis(async (calls) => {
  const e = env({ STRIPE_AUTOMATIC_TAX: '1', STRIPE_INVOICE: '1' });
  const { rid } = await freeVerdict(e);
  await worker.fetch(post('/verdict/checkout', { rid, lang: 'en' }), e);
  const p = new URLSearchParams(calls.find((c) => c.url.endsWith('/checkout/sessions')).init.body);
  assert.equal(p.get('automatic_tax[enabled]'), 'true');
  assert.equal(p.get('invoice_creation[enabled]'), 'true');
  assert.equal(p.get('success_url'), `${STAGING}/verdict.html?session_id={CHECKOUT_SESSION_ID}`);
}, () => ({ status: 200, body: { id: 'cs_test_x', url: 'https://checkout.stripe.com/x' } })));

test('checkout refuses an unknown rid, a bad rid, a foreign Origin, and payments off', withApis(async () => {
  const e = env();
  assert.equal((await worker.fetch(post('/verdict/checkout', { rid: 'a'.repeat(32) }), e)).status, 404);
  assert.equal((await worker.fetch(post('/verdict/checkout', { rid: '../x' }), e)).status, 400);
  assert.equal((await worker.fetch(post('/verdict/checkout', { rid: 'a'.repeat(32) }, { origin: 'https://evil.example' }), e)).status, 403);
  assert.equal((await worker.fetch(post('/verdict/checkout', { rid: 'a'.repeat(32) }), env({ VERDICT_PAYMENTS: '0' }))).status, 503);
}));

test('webhook: wrong signature 400, stale timestamp 400, no secret 503', withApis(async () => {
  const e = env();
  const ev = { type: 'checkout.session.completed', data: { object: session('a'.repeat(32)) } };
  assert.equal((await webhook(e, ev, { secret: 'whsec_wrong' })).status, 400);
  assert.equal((await webhook(e, ev, { t: Math.floor(Date.now() / 1000) - 600 })).status, 400);
  const none = await worker.fetch(post('/verdict/stripe-webhook', '{}', { origin: null }), e);
  assert.equal(none.status, 400);
  assert.equal((await webhook(env({ STRIPE_WEBHOOK_SECRET: undefined }), ev)).status, 503);
  assert.equal(e.RATE_LIMIT_KV.store.has(`verdict:paid:${SID}`), false);
}));

test('paid session unlocks exactly one report; after the reload window the free view comes back', withApis(async () => {
  const e = env();
  const { rid } = await freeVerdict(e);
  assert.equal((await webhook(e, { type: 'checkout.session.completed', data: { object: session(rid) } })).status, 200);
  const t0 = Date.now();
  const first = await (await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'sk' }), e)).json();
  assert.equal(first.report, true);
  assert.equal(first.paid, true);
  assert.equal(first.signals.length, 10);
  assert.ok(first.plan.length > 0);
  const reload = await (await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'sk' }), e)).json();
  assert.equal(reload.report, true, 'reload inside the window still works');
  const rec = JSON.parse(e.RATE_LIMIT_KV.store.get(`verdict:paid:${SID}`));
  rec.usedAt = t0 - REPORT_WINDOW_MS - 1000;
  e.RATE_LIMIT_KV.store.set(`verdict:paid:${SID}`, JSON.stringify(rec));
  const later = await (await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'sk' }), e)).json();
  assert.equal(later.report, undefined);
  assert.equal(later.reportUsed, true);
  assert.equal(later.signals.length, 2);
}));

test('report before the webhook arrives: asks Stripe and accepts only a paid Verdict session', withApis(async (calls) => {
  const e = env();
  const { rid } = await freeVerdict(e);
  globalThis.__session = session(rid);
  const r = await (await worker.fetch(post('/verdict/report', { session_id: SID }), e)).json();
  assert.equal(r.report, true);
  assert.ok(calls.some((c) => c.url === `https://api.stripe.com/v1/checkout/sessions/${SID}` && c.init.method === 'GET'));
  globalThis.__session = session(rid, { id: 'cs_test_unpaid000000', payment_status: 'unpaid' });
  assert.equal((await worker.fetch(post('/verdict/report', { session_id: 'cs_test_unpaid000000' }), e)).status, 402);
  globalThis.__session = session(rid, { id: 'cs_test_other0000000', metadata: { product: 'cfo_subscription' } });
  assert.equal((await worker.fetch(post('/verdict/report', { session_id: 'cs_test_other0000000' }), e)).status, 402);
  delete globalThis.__session;
}, () => ({ status: 200, body: globalThis.__session })));

test('fake or malformed session_id and a faked Origin never get the report', withApis(async () => {
  const e = env();
  await freeVerdict(e);
  assert.equal((await worker.fetch(post('/verdict/report', { session_id: 'cs_test_doesnotexist00' }), e)).status, 402);
  assert.equal((await worker.fetch(post('/verdict/report', { session_id: 'nope' }), e)).status, 400);
  assert.equal((await worker.fetch(post('/verdict/report', { session_id: SID }, { origin: 'https://evil.example' }), e)).status, 403);
  const r = await (await worker.fetch(post('/verdict', { text: 'Chcem kúpiť Bitcoin za 10 000 € z úspor a držať ho 5 rokov.', lang: 'sk', report: true }, { origin: STAGING, ip: '5.5.5.5' }), e)).json();
  assert.equal(r.report, undefined);
}));

test('charge.refunded marks the session refunded and closes the report', withApis(async () => {
  const e = env();
  const { rid } = await freeVerdict(e);
  await webhook(e, { type: 'checkout.session.completed', data: { object: session(rid) } });
  assert.equal((await webhook(e, { type: 'charge.refunded', data: { object: { object: 'charge', payment_intent: 'pi_1', refunded: true, amount_refunded: 1400 } } })).status, 200);
  assert.equal(JSON.parse(e.RATE_LIMIT_KV.store.get(`verdict:paid:${SID}`)).status, 'refunded');
  assert.equal((await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'en' }), e)).status, 402);
  // A late duplicate completed event does not undo the refund.
  await webhook(e, { type: 'checkout.session.completed', data: { object: session(rid) } });
  assert.equal(JSON.parse(e.RATE_LIMIT_KV.store.get(`verdict:paid:${SID}`)).status, 'refunded');
}));

test('webhook ignores sessions of other products and unpaid async sessions', withApis(async () => {
  const e = env();
  await webhook(e, { type: 'checkout.session.completed', data: { object: session('a'.repeat(32), { metadata: {} }) } });
  await webhook(e, { type: 'checkout.session.completed', data: { object: session('a'.repeat(32), { payment_status: 'unpaid' }) } });
  assert.equal(e.RATE_LIMIT_KV.store.has(`verdict:paid:${SID}`), false);
  await webhook(e, { type: 'checkout.session.async_payment_succeeded', data: { object: session('a'.repeat(32)) } });
  assert.equal(JSON.parse(e.RATE_LIMIT_KV.store.get(`verdict:paid:${SID}`)).status, 'paid');
}));

test('paid but the stored result expired: 410 with a refund note', withApis(async () => {
  const e = env();
  const { rid } = await freeVerdict(e);
  await webhook(e, { type: 'checkout.session.completed', data: { object: session(rid) } });
  e.RATE_LIMIT_KV.store.delete(`verdict:res:${rid}`);
  const res = await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'en' }), e);
  assert.equal(res.status, 410);
  assert.match((await res.json()).error, /refund/);
}));
