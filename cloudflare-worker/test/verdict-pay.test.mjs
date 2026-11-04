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

// Purchase confirmation email with the report PDF (receipt.js, pdf.js).
const resendCalls = (calls) => calls.filter((c) => c.url === 'https://api.resend.com/emails').map((c) => JSON.parse(c.init.body));

test('webhook emails the buyer once: confirmation + the report as a PDF', withApis(async (calls) => {
  const e = env({ RESEND_API_KEY: 're_test', RESEND_SEND_FROM: 'Virtuse <plan@virtuse.com>' });
  const { rid } = await freeVerdict(e);
  const ev = { type: 'checkout.session.completed', data: { object: session(rid, { customer_details: { email: 'buyer@example.com' } }) } };
  assert.equal((await webhook(e, ev)).status, 200);
  const sent = resendCalls(calls);
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.deepEqual(m.to, ['buyer@example.com']);
  assert.equal(m.reply_to, 'info@virtuse.com');
  assert.match(m.subject, /platba potvrdená/);
  assert.match(m.html, /14,00\s€/);
  assert.match(m.html, /Prevádzkovateľ: Virtuse Wealth Management, a\.s\./);
  assert.equal(m.attachments.length, 1);
  assert.match(m.attachments[0].filename, /^Virtuse-Verdict-report-\d{8}-[A-Z0-9]+\.pdf$/);
  const pdf = Buffer.from(m.attachments[0].content, 'base64');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 20000);
  assert.ok(JSON.parse(e.RATE_LIMIT_KV.store.get(`verdict:paid:${SID}`)).emailedAt);
  // Stripe sends the same event again, or async_payment_succeeded follows: no second email.
  await webhook(e, ev);
  await webhook(e, { ...ev, type: 'checkout.session.async_payment_succeeded' });
  assert.equal(resendCalls(calls).length, 1);
}));

test('receipt: VERDICT_RECEIPT_TO redirects it (staging); /verdict/report alone sends nothing', withApis(async (calls) => {
  const e = env({ RESEND_API_KEY: 're_test', VERDICT_RECEIPT_TO: 'vasilisin@virtuse.com' });
  const { rid } = await freeVerdict(e);
  await webhook(e, { type: 'checkout.session.completed', data: { object: session(rid, { customer_details: { email: 'buyer@example.com' }, metadata: { product: 'verdict_report', rid, lang: 'en' } }) } });
  const sent = resendCalls(calls);
  assert.deepEqual(sent[0].to, ['vasilisin@virtuse.com']);
  assert.match(sent[0].subject, /payment confirmed/);
}));

test('receipt: a Resend failure answers 500 so Stripe retries, the retry sends it', async () => {
  const e = env({ RESEND_API_KEY: 're_test' });
  const orig = globalThis.fetch;
  let resendOk = false, sentCount = 0;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u === 'https://api.resend.com/emails') { if (!resendOk) return new Response('down', { status: 500 }); sentCount++; return new Response('{"id":"e"}', { status: 200 }); }
    return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', stop_sequence: null, content: [{ type: 'text', text: JSON.stringify(MODEL_OUT) }], usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const { rid } = await freeVerdict(e);
    const ev = { type: 'checkout.session.completed', data: { object: session(rid, { customer_details: { email: 'buyer@example.com' } }) } };
    assert.equal((await webhook(e, ev)).status, 500);
    assert.equal(JSON.parse(e.RATE_LIMIT_KV.store.get(`verdict:paid:${SID}`)).status, 'paid', 'still paid: the report opens');
    resendOk = true;
    assert.equal((await webhook(e, ev)).status, 200);
    assert.equal(sentCount, 1);
  } finally { globalThis.fetch = orig; }
});

// Withdrawal function (Act 108/2024 § 20a) and the data promises in privacy section 9.
const withdrawReq = (body) => new Request('https://w.example/verdict/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://virtuse.com', 'CF-Connecting-IP': '1.2.3.4' }, body: JSON.stringify(body) });
const resendMock = (fail = () => false) => {
  const sent = [];
  const old = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.resend.com')) {
      const b = JSON.parse(init.body);
      if (fail(b)) return new Response('{}', { status: 500 });
      sent.push(b);
      return new Response('{"id":"e"}', { status: 200 });
    }
    return old(url, init);
  };
  return { sent, restore: () => { globalThis.fetch = old; } };
};

test('withdrawal: copy to Virtuse, confirmation with date and time, nothing stored', async () => {
  const m = resendMock();
  try {
    const e = { RATE_LIMIT_KV: mockKv(), RESEND_API_KEY: 're_x', RESEND_SEND_FROM: 'Virtuse <plan@virtuse.com>' };
    const res = await worker.fetch(withdrawReq({ name: 'Anna Nová', email: 'anna@example.com', order: 'ABC123', lang: 'sk' }), e);
    assert.equal(res.status, 200);
    const d = await res.json();
    assert.ok(d.ok && d.confirmed && /\d{4}/.test(d.at));
    assert.deepEqual(m.sent.map((x) => x.to[0]), ['info@virtuse.com', 'anna@example.com']);
    assert.equal(m.sent[0].reply_to, 'anna@example.com');
    const html = m.sent[1].html;
    for (const part of ['Odstupujem od zmluvy', 'Anna Nová', 'anna@example.com', 'ABC123', d.at]) assert.ok(html.includes(part), part);
    const keys = [...e.RATE_LIMIT_KV.store.keys()];
    assert.equal(keys.length, 1);
    assert.match(keys[0], /^verdict:withdraw:[a-f0-9]{64}$/);
    assert.ok(![...e.RATE_LIMIT_KV.store.values()].some((v) => String(v).includes('anna')));
  } finally { m.restore(); }
});

test('withdrawal: the order number is optional, name and email are checked', async () => {
  const m = resendMock();
  try {
    const e = () => ({ RATE_LIMIT_KV: mockKv(), RESEND_API_KEY: 're_x', RESEND_SEND_FROM: 'x@virtuse.com' });
    assert.equal((await worker.fetch(withdrawReq({ name: 'Anna', email: 'a@example.com' }), e())).status, 200);
    const noName = await worker.fetch(withdrawReq({ name: '', email: 'a@example.com' }), e());
    assert.equal(noName.status, 400);
    assert.equal((await noName.json()).field, 'name');
    assert.equal((await worker.fetch(withdrawReq({ name: 'Anna', email: 'nope' }), e())).status, 400);
    const before = m.sent.length;
    assert.equal((await worker.fetch(withdrawReq({ name: 'Anna', email: 'a@example.com', hp: 'x' }), e())).status, 200);
    assert.equal(m.sent.length, before, 'the honeypot sends nothing');
  } finally { m.restore(); }
});

test('withdrawal: no copy to Virtuse means an error; no confirmation is reported', async () => {
  let m = resendMock(() => true);
  try {
    const res = await worker.fetch(withdrawReq({ name: 'Anna', email: 'a@example.com' }), { RATE_LIMIT_KV: mockKv(), RESEND_API_KEY: 're_x', RESEND_SEND_FROM: 'x@virtuse.com' });
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /info@virtuse\.com/);
  } finally { m.restore(); }
  m = resendMock((b) => b.to[0] === 'a@example.com');
  try {
    const res = await worker.fetch(withdrawReq({ name: 'Anna', email: 'a@example.com' }), { RATE_LIMIT_KV: mockKv(), RESEND_API_KEY: 're_x', RESEND_SEND_FROM: 'x@virtuse.com' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).confirmed, false);
  } finally { m.restore(); }
});

test('privacy section 9: answers 24 h, order record and payment link 30 days', async () => {
  const { createPayStore } = await import('../src/features/verdict-pay/store.js');
  const puts = [];
  const kv = { async get() { return null; }, async put(k, v, o) { puts.push([k, v, o]); } };
  const store = createPayStore(kv);
  await store.storeLite('a'.repeat(32), { age: 40 }, 'en');
  assert.equal(puts[0][2].expirationTtl, 24 * 60 * 60);
  assert.ok(!puts[0][1].includes('email'));
  await store.markPaid({ id: 'cs_test_x', metadata: { rid: 'a'.repeat(32), terms_version: '2026-11-04' }, payment_intent: 'pi_1', amount_total: 1400, currency: 'eur' }, 1);
  assert.equal(puts[1][2].expirationTtl, 30 * 24 * 60 * 60);
  assert.equal(JSON.parse(puts[1][1]).terms, '2026-11-04');
  assert.equal(puts[2][2].expirationTtl, 30 * 24 * 60 * 60);
});
