// Delivery of the paid Verdict report (handover 6.8, 2026-11-11): one email per
// Session, a note + alert when the answers expired, deduplicated alerts on
// failures, and the Resend bounce/complaint webhook with Svix signatures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { stripeSignature } from '../src/infra/stripe.js';
import { createPayStore } from '../src/features/verdict-pay/store.js';
import { ALERT_REPEAT_AT, maskEmail, svixSignature } from '../src/features/verdict-pay/alerts.js';

const WHSEC = 'whsec_test_secret';
const SID = 'cs_test_a1B2c3D4e5F6g7H8';
const RID = 'a'.repeat(32);
const RESEND_SECRET = `whsec_${btoa('resend-test-secret-0123456789')}`;
const ANNA = { name: 'Anna', age: 41, country: 'sk', savings: 150000, pension: 40000, retire: 65, retmonthly: 150, reserve: '3_6', home: 'mortgage', homeval: 250000, mortbal: 140000, debt: 'none', experience: 'new', btc: 20000, monthly: 200, custody: 'self', fall: 'wait', worries: ['tax', 'keys'], tax_known: 'roughly' };

function mockKv() {
  const store = new Map();
  return { store, async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); } };
}
const env = (extra = {}) => ({
  RATE_LIMIT_KV: mockKv(), VERDICT_PAYMENTS: '1', STRIPE_TEST_ONLY: '1', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_PRICE_ID_VERDICT: 'price_123',
  RESEND_API_KEY: 're_x', RESEND_SEND_FROM: 'Virtuse <plan@virtuse.com>', RESEND_WEBHOOK_SECRET: RESEND_SECRET, ...extra,
});
const session = (extra = {}) => ({ id: SID, object: 'checkout.session', payment_status: 'paid', metadata: { product: 'verdict_report', rid: RID, lang: 'sk' }, amount_total: 1400, currency: 'eur', payment_intent: 'pi_1', livemode: false, customer_details: { email: 'buyer@example.com' }, ...extra });

function mockApis({ resend = () => 200, delay = 0 } = {}) {
  const calls = [];
  const seen = new Set();
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u === 'https://api.resend.com/emails') {
      const body = JSON.parse(init.body);
      const key = init.headers['Idempotency-Key'];
      if (delay) await new Promise((r) => setTimeout(r, delay));
      // Like Resend: a second request with a used key sends nothing new.
      if (key && seen.has(key)) return new Response('{"id":"e"}', { status: 200 });
      calls.push({ body, key });
      const kind = body.tags?.[0]?.value;
      const status = kind === 'verdict_alert' ? 200 : resend(body);
      if (status === 200 && key) seen.add(key);
      return new Response(status === 200 ? '{"id":"e"}' : 'down', { status });
    }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const sent = (kind) => calls.filter((c) => c.body.tags?.[0]?.value === kind);
  return { calls, sent, restore: () => { globalThis.fetch = orig; } };
}
async function stripeHook(e, obj, type = 'checkout.session.completed') {
  const payload = JSON.stringify({ type, data: { object: obj } });
  const t = Math.floor(Date.now() / 1000);
  const v1 = await stripeSignature(WHSEC, t, payload);
  return worker.fetch(new Request('https://w.example/verdict/stripe-webhook', { method: 'POST', headers: { 'Stripe-Signature': `t=${t},v1=${v1}` }, body: payload }), e);
}
async function resendHook(e, event, { secret = RESEND_SECRET, id = 'msg_1', ts = Math.floor(Date.now() / 1000) } = {}) {
  const payload = JSON.stringify(event);
  const sig = await svixSignature(secret, id, String(ts), payload);
  return worker.fetch(new Request('https://w.example/resend/webhook', { method: 'POST', headers: { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${sig}` }, body: payload }), e);
}
const withResult = async (e) => { await createPayStore(e.RATE_LIMIT_KV).storeLite(RID, ANNA, 'sk'); return e; };

test('the same webhook twice sends one confirmation, with a Resend idempotency key', async () => {
  const api = mockApis();
  try {
    const e = await withResult(env());
    assert.equal((await stripeHook(e, session())).status, 200);
    assert.equal((await stripeHook(e, session())).status, 200);
    const r = api.sent('verdict_receipt');
    assert.equal(r.length, 1);
    assert.equal(r[0].key, `verdict-receipt-${SID}`);
    assert.equal(api.sent('verdict_alert').length, 0);
  } finally { api.restore(); }
});

test('two concurrent deliveries of the event send one confirmation', async () => {
  const api = mockApis({ delay: 30 });
  try {
    const e = await withResult(env());
    const res = await Promise.all([stripeHook(e, session()), stripeHook(e, session())]);
    assert.ok(res.some((r) => r.status === 200));                 // a loser (if any) answers 500 and Stripe retries
    assert.equal(api.sent('verdict_receipt').length, 1);
    assert.equal((await stripeHook(e, session())).status, 200);    // Stripe's retry: already emailed
    assert.equal(api.sent('verdict_receipt').length, 1);
  } finally { api.restore(); }
});

test('expired answers: a note to the buyer and one alert, never a silent success', async () => {
  const api = mockApis();
  try {
    const e = env({ VERDICT_ALERT_TO: 'alerts@example.com' });
    assert.equal((await stripeHook(e, session())).status, 200);
    assert.equal((await stripeHook(e, session())).status, 200);
    const notes = api.sent('verdict_receipt');
    assert.equal(notes.length, 1);
    assert.match(notes[0].body.subject, /nepodarilo/);
    assert.match(notes[0].body.html, /Platbu vám vrátime/);
    assert.equal(notes[0].key, `verdict-notice-${SID}`);
    const alerts = api.sent('verdict_alert');
    assert.equal(alerts.length, 1);
    assert.deepEqual(alerts[0].body.to, ['alerts@example.com']);
    assert.match(alerts[0].body.subject, /result_expired/);
    assert.doesNotMatch(alerts[0].body.subject, /buyer@example/);
    assert.match(alerts[0].body.html, /b\*\*\*@example\.com/);
    assert.doesNotMatch(alerts[0].body.html, /buyer@example/);
  } finally { api.restore(); }
});

test('Resend down: 500 to Stripe each time, one alert, a second only after repeated failures', async () => {
  const api = mockApis({ resend: () => 500 });
  try {
    const e = await withResult(env({ VERDICT_RECEIPT_TO: 'staging@example.com' }));
    for (let i = 0; i < 3; i++) assert.equal((await stripeHook(e, session())).status, 500);
    let alerts = api.sent('verdict_alert');
    assert.equal(alerts.length, 1);
    assert.deepEqual(alerts[0].body.to, ['staging@example.com']);   // staging: never info@
    assert.match(alerts[0].body.subject, /send_failed/);
    for (let i = 3; i < ALERT_REPEAT_AT; i++) await stripeHook(e, session());
    alerts = api.sent('verdict_alert');
    assert.equal(alerts.length, 2);
    assert.match(alerts[1].body.subject, /still failing after 5/);
  } finally { api.restore(); }
});

test('no email on the Session: alert, and production alerts go to info@', async () => {
  const api = mockApis();
  try {
    const e = await withResult(env());
    assert.equal((await stripeHook(e, session({ customer_details: {}, customer_email: null }))).status, 200);
    const a = api.sent('verdict_alert');
    assert.equal(a.length, 1);
    assert.deepEqual(a[0].body.to, ['info@virtuse.com']);
    assert.match(a[0].body.subject, /no_email/);
  } finally { api.restore(); }
});

test('Resend webhook: a bounced confirmation alerts once; bad or old signatures are refused', async () => {
  const api = mockApis();
  try {
    const e = env();
    const bounced = { type: 'email.bounced', data: { email_id: 'em_9', to: ['buyer@example.com'], tags: { kind: 'verdict_receipt' }, bounce: { message: 'Mailbox does not exist' } } };
    assert.equal((await resendHook(e, bounced)).status, 200);
    assert.equal((await resendHook(e, bounced, { id: 'msg_2' })).status, 200);   // same email_id: no second alert
    const a = api.sent('verdict_alert');
    assert.equal(a.length, 1);
    assert.match(a[0].body.subject, /bounced/);
    assert.match(a[0].body.html, /Mailbox does not exist/);
    assert.equal((await resendHook(e, bounced, { secret: `whsec_${btoa('wrong')}` })).status, 401);
    assert.equal((await resendHook(e, bounced, { ts: Math.floor(Date.now() / 1000) - 3600 })).status, 401);
    // Other emails (newsletter etc.) are ignored
    await resendHook(e, { type: 'email.complained', data: { email_id: 'em_10', to: ['x@example.com'], tags: [{ name: 'kind', value: 'brief' }] } });
    assert.equal(api.sent('verdict_alert').length, 1);
    await resendHook(e, { type: 'email.complained', data: { email_id: 'em_11', to: ['x@example.com'], tags: [{ name: 'kind', value: 'verdict_receipt' }] } });
    assert.equal(api.sent('verdict_alert').length, 2);
    assert.equal((await resendHook(env({ RESEND_WEBHOOK_SECRET: undefined }), bounced)).status, 503);
  } finally { api.restore(); }
});

test('a refunded payment no longer opens the report', async () => {
  const api = mockApis();
  try {
    const e = await withResult(env());
    await stripeHook(e, session());
    await stripeHook(e, { payment_intent: 'pi_1', amount_refunded: 1400, refunded: true }, 'charge.refunded');
    const res = await worker.fetch(new Request('https://w.example/verdict/report', { method: 'POST', headers: { Origin: 'https://staging.virtuse.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: SID, lang: 'sk' }) }), e);
    assert.equal(res.status, 402);
  } finally { api.restore(); }
});

test('maskEmail keeps only the first letter and the domain', () => {
  assert.equal(maskEmail('vasil@example.com'), 'v***@example.com');
  assert.equal(maskEmail('nope'), '');
});
