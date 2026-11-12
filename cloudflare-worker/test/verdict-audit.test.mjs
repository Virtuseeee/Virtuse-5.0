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
