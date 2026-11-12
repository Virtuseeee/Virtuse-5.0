// Regression tests for the Verdict audit of 12 Nov 2026 (audits/verdict-audit-2026-11-12.md, top 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopedKv } from '../src/app.js';
import { calc, gapIds, validateAnswers } from '../src/features/verdict-lite/rules.js';
import { liteReportView } from '../src/features/verdict-lite/report.js';
import { paidReport } from '../src/features/verdict-pay/handler.js';
import { sessionMatchesKey } from '../src/features/verdict-pay/domain.js';
import { deliveryAlert } from '../src/features/verdict-pay/alerts.js';

const ANNA = { name: 'Anna', age: 41, country: 'sk', savings: 150000, pension: 40000, retire: 65, retmonthly: 150, expenses: null, reserve: '3_6', home: 'mortgage', homeval: 250000, mortbal: 140000, debt: 'none', experience: 'new', btc: 20000, monthly: 200, custody: 'self', fall: 'wait', worries: ['tax', 'keys'], tax_known: 'roughly' };

function mockKv() {
  const store = new Map();
  return { store, async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); } };
}

test('staging keys live under their own prefix', async () => {
  const kv = mockKv();
  const stg = scopedKv(kv, 'stg:');
  await stg.put('verdict:paid:cs_test_x', '1');
  assert.deepEqual([...kv.store.keys()], ['stg:verdict:paid:cs_test_x']);
  assert.equal(await stg.get('verdict:paid:cs_test_x'), '1');
  assert.equal(await kv.get('verdict:paid:cs_test_x'), null);
  assert.equal(scopedKv(kv, ''), kv);
});

test('a test-mode session never opens a report on a live key', async () => {
  assert.equal(sessionMatchesKey({ STRIPE_SECRET_KEY: 'rk_live_x' }, 'cs_test_abc'), false);
  assert.equal(sessionMatchesKey({ STRIPE_SECRET_KEY: 'rk_live_x' }, 'cs_live_abc'), true);
  assert.equal(sessionMatchesKey({ STRIPE_SECRET_KEY: 'sk_test_x' }, 'cs_live_abc'), false);
  const kv = mockKv();
  // the record a staging purchase left in the shared namespace
  await kv.put('verdict:paid:cs_test_abcdefghij', JSON.stringify({ rid: 'a'.repeat(32), status: 'paid', livemode: false }));
  await kv.put(`verdict:res:${'a'.repeat(32)}`, JSON.stringify({ lite: true, answers: ANNA, lang: 'en' }));
  let calls = 0;
  const ctx = { env: { RATE_LIMIT_KV: kv, STRIPE_SECRET_KEY: 'rk_live_x' }, now: Date.now(), fetch: async () => { calls += 1; return new Response('{}'); } };
  assert.deepEqual(await paidReport(ctx, 'cs_test_abcdefghij'), { status: 402, error: 'unpaid' });
  assert.equal(calls, 0);
  // and a record of the wrong mode under a matching id is refused too
  await kv.put('verdict:paid:cs_live_abcdefghij', JSON.stringify({ rid: 'a'.repeat(32), status: 'paid', livemode: false }));
  assert.deepEqual(await paidReport(ctx, 'cs_live_abcdefghij'), { status: 402, error: 'unpaid' });
});

test('answers: whole adult ages, retirement not below age', () => {
  assert.equal(validateAnswers(ANNA).ok, true);
  for (const [patch, field] of [[{ age: 17 }, 'age'], [{ age: 41.5 }, 'age'], [{ age: 150 }, 'age'], [{ retire: 30 }, 'retire'], [{ retire: 65.25 }, 'retire'], [{ btc: -5 }, 'btc']]) {
    assert.deepEqual(validateAnswers({ ...ANNA, ...patch }), { ok: false, error: field });
  }
  assert.equal(validateAnswers({ ...ANNA, age: 65, retire: 65 }).ok, true);
});

test('a retirement worry adds the retirement gap only when it applies', () => {
  const far = { ...ANNA, btc: 5000, reserve: '6p', tax_known: 'yes', custody: 'assisted', worries: ['retire'] };
  assert.ok(!gapIds(far, calc(far)).includes('retire'));
  const near = { ...far, age: 58, btc: 60000 };
  assert.ok(gapIds(near, calc(near)).includes('retire'));
});

test('Czech tax example says that it leaves the annual limits out', () => {
  const text = (a, lang) => JSON.stringify(liteReportView({ ...ANNA, country: 'cz', ...a }, lang, new Date('2026-11-12')));
  assert.match(text({ age: 18 }, 'en'), /does not apply the annual limits/);
  assert.match(text({ age: 64 }, 'en'), /does not apply the annual limits/);
  assert.match(text({ age: 18 }, 'sk'), /neuplatňuje ročné limity/);
  assert.doesNotMatch(JSON.stringify(liteReportView(ANNA, 'en', new Date('2026-11-12'))), /annual limits/);
});

test('huge sums print as digits, never in exponent notation', () => {
  const big = { ...ANNA, age: 18, retire: 120, savings: 1e10, btc: 1e10, monthly: 1e10 };
  assert.doesNotMatch(JSON.stringify(liteReportView(big, 'en', new Date('2026-11-12'))), /\de\+\d/);
});

test('an alert that could not be sent is tried again; the webhook is a second channel', async () => {
  const kv = mockKv();
  const sent = [];
  const base = { now: 1, services: { resend: { sendEmail: async () => { throw new Error('Resend down'); } } }, fetch: async (url, init) => { sent.push([url, JSON.parse(init.body).text]); return new Response('ok'); } };
  // Resend down, no webhook: nothing counted, so the next failure alerts again
  await deliveryAlert({ ...base, env: { RATE_LIMIT_KV: kv } }, { kind: 'send_failed', sid: 'cs_test_abcdefghij' });
  assert.equal(kv.store.size, 0);
  // Resend down, webhook set: Virtuse is told through the webhook and the attempt counts
  await deliveryAlert({ ...base, env: { RATE_LIMIT_KV: kv, VERDICT_ALERT_WEBHOOK: 'https://hooks.example/x' } }, { kind: 'send_failed', sid: 'cs_test_abcdefghij', detail: 'status 500' });
  assert.equal(sent.length, 1);
  assert.match(sent[0][1], /send_failed/);
  assert.equal(JSON.parse(kv.store.get('alert:cs_test_abcdefghij')).attempts, 1);
});

// Audit finding 15: the sample report on the page shows what the Worker really writes for Anna.
test('the sample steps on verdict.html are the Worker steps for Anna', async () => {
  const { readFileSync } = await import('node:fs');
  const site = new URL('../../Kimi_Agent_Virtuse%2520MiCA%2520Partners/', import.meta.url);
  for (const [lang, file] of [['en', 'verdict.html'], ['sk', 'sk/verdict.html']]) {
    const html = readFileSync(new URL(file, site), 'utf8');
    const ul = /<ul class="ml-steps">([\s\S]*?)<\/ul>/.exec(html)[1];
    const sample = [...ul.matchAll(/<b>(.*?)<\/b><span>(.*?)<\/span>/g)].map((m) => [m[1], m[2]]);
    const steps = liteReportView(ANNA, lang, new Date('2026-11-12')).steps;
    assert.equal(sample.length, steps.length, lang);
    const norm = (t) => t.replace(/&nbsp;|\u00a0/g, ' ');
    sample.forEach(([title, text], i) => {
      assert.equal(norm(title), norm(steps[i].title), `${lang} step ${i + 1}`);
      assert.ok(norm(steps[i].text).startsWith(norm(text)), `${lang} step ${i + 1}: ${text}`);
    });
  }
});

// ---- Findings 9 to 28 (second round) ----------------------------------------
import worker from '../src/index.js';
import { createPayStore } from '../src/features/verdict-pay/store.js';
import { checkoutParams } from '../src/features/verdict-pay/domain.js';
import { REPORT_LOOKUPS_PER_HOUR } from '../src/features/verdict-pay/handler.js';
import { renderSendEmail } from '../src/features/send/domain.js';

const RID = 'b'.repeat(32);
const paidSession = (over = {}) => ({ id: 'cs_test_abcdefghij', object: 'checkout.session', livemode: false, payment_status: 'paid', payment_intent: 'pi_1', amount_total: 1400, currency: 'eur', metadata: { product: 'verdict_report', rid: RID, lang: 'en' }, ...over });

test('markers: a later order-record write cannot drop the first opening or the email', async () => {
  const kv = mockKv();
  const store = createPayStore(kv);
  await store.markPaid(paidSession(), 1);
  await store.markUsed('cs_test_abcdefghij', 100);
  await store.markEmailed('cs_test_abcdefghij', 200);
  // a stale copy of the record, written by a parallel run, has neither field
  await store.putPaid('cs_test_abcdefghij', { rid: RID, status: 'paid', pi: 'pi_1', livemode: false });
  const rec = await store.getPaid('cs_test_abcdefghij');
  assert.equal(rec.usedAt, 100);
  assert.equal(rec.emailedAt, 200);
  await store.markUsed('cs_test_abcdefghij', 999);   // write-once
  assert.equal((await store.getPaid('cs_test_abcdefghij')).usedAt, 100);
});

test('a refund that arrives before the payment is recorded still closes the report', async () => {
  const kv = mockKv();
  const store = createPayStore(kv);
  await store.markRefunded('pi_1', 1400, true);
  const rec = await store.markPaid(paidSession(), 1);
  assert.equal(rec.status, 'refunded');
  assert.equal((await store.getPaid('cs_test_abcdefghij')).status, 'refunded');
  await store.markRefunded('pi_2', 500, false);   // a partial refund keeps the report open
  assert.equal(kv.store.has('verdict:refund:pi_2'), false);
});

test('unknown session ids are looked up at Stripe at most REPORT_LOOKUPS_PER_HOUR times per IP', async () => {
  const kv = mockKv();
  let stripeCalls = 0;
  const ctx = (n) => ({
    env: { RATE_LIMIT_KV: kv, STRIPE_SECRET_KEY: 'sk_test_x', UNSUB_SECRET: 's' }, now: 5_000,
    request: new Request('https://w.example/verdict/report', { headers: { 'CF-Connecting-IP': '9.9.9.9' } }),
    fetch: async () => { stripeCalls += 1; return new Response(JSON.stringify({ id: `cs_test_${n}`, object: 'checkout.session', payment_status: 'unpaid' })); },
  });
  for (let i = 0; i < REPORT_LOOKUPS_PER_HOUR; i++) assert.equal((await paidReport(ctx(i), `cs_test_abcdefghij${i}`)).error, 'unpaid');
  assert.deepEqual(await paidReport(ctx('x'), 'cs_test_abcdefghijx'), { status: 429, error: 'tooMany' });
  assert.equal(stripeCalls, REPORT_LOOKUPS_PER_HOUR);
});

test('Checkout offers card only (Apple Pay and Google Pay are cards)', () => {
  assert.deepEqual(checkoutParams({ STRIPE_PRICE_ID_VERDICT: 'p' }, 'https://virtuse.com', RID, 'en').payment_method_types, ['card']);
});

test('Lite email with the Brief does not say "we did not add you to any list"', () => {
  const payload = { score: 75, grade: 'B', band: 0, gaps: ['tax'], areas: { size: 7, reserve: 7, debt: 10, tax: 6, custody: 6, fall: 10 } };
  for (const lang of ['en', 'sk']) {
    const withBrief = renderSendEmail({ kind: 'verdict_lite', source: 'verdict', payload, lang, brief: true }).html;
    const without = renderSendEmail({ kind: 'verdict_lite', source: 'verdict', payload, lang, brief: false }).html;
    assert.doesNotMatch(withBrief, /any list|žiadneho zoznamu/);
    assert.match(without, /any list|žiadneho zoznamu/);
  }
});

function captureFetch(status = () => 200) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers || {}, body: init?.body ? JSON.parse(init.body) : null });
    return new Response('{"id":"e"}', { status: status(String(url)) });
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}
const sendEnv = () => ({ RATE_LIMIT_KV: mockKv(), RESEND_API_KEY: 'k', RESEND_FROM_EMAIL: 'V <b@virtuse.com>', RESEND_SEGMENT_ID: 'seg', UNSUB_SECRET: 's' });
const sendReq = (body) => new Request('https://w.example/send', { method: 'POST', headers: { Origin: 'https://virtuse.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' }, body: JSON.stringify(body) });
const LITE_BODY = { email: 'a@b.co', lang: 'en', kind: 'verdict_lite', source: 'verdict', payload: { score: 75, grade: 'B', band: 0, gaps: ['tax'], areas: { size: 7, reserve: 7, debt: 10, tax: 6, custody: 6, fall: 10 } } };

test('/send: the same request twice carries the same idempotency key; a failed Brief sign-up is still 200', async () => {
  const f = captureFetch((url) => (url.endsWith('/contacts') ? 500 : 200));
  try {
    const e = sendEnv();
    assert.equal((await worker.fetch(sendReq(LITE_BODY), e)).status, 200);
    assert.equal((await worker.fetch(sendReq(LITE_BODY), e)).status, 200);
    const keys = f.calls.filter((c) => c.url.endsWith('/emails')).map((c) => c.headers['Idempotency-Key']);
    assert.equal(keys.length, 2);
    assert.ok(keys[0] && keys[0] === keys[1]);
    const res = await worker.fetch(sendReq({ ...LITE_BODY, email: 'c@d.co', brief: true }), e);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, brief: false });
  } finally { f.restore(); }
});

test('withdrawal: a staging test that reaches production sends nothing; 3 per address per hour', async () => {
  const f = captureFetch();
  try {
    const e = { RATE_LIMIT_KV: mockKv(), RESEND_API_KEY: 'k', RESEND_SEND_FROM: 'V <p@virtuse.com>', UNSUB_SECRET: 's' };
    const wd = (origin, ip, email = 'anna@example.com') => new Request('https://w.example/verdict/withdraw', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify({ name: 'Anna', email, lang: 'sk' }) });
    const st = await worker.fetch(wd('https://staging.virtuse.com', '1.1.1.1'), e);
    assert.equal(st.status, 409);
    assert.equal(f.calls.length, 0);
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await worker.fetch(wd('https://virtuse.com', `2.2.2.${i}`), e)).status);
    assert.deepEqual(statuses, [200, 200, 200, 429]);
  } finally { f.restore(); }
});

test('bounce alert names the order from the receipt tag', async () => {
  const { renderAlert } = await import('../src/features/verdict-pay/alerts.js');
  const a = renderAlert({ kind: 'bounced', order: 'ABCDEFGHIJ', now: 0 });
  assert.match(a.subject, /order ABCDEFGHIJ/);
});
