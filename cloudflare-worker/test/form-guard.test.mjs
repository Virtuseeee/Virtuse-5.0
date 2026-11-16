// Security audit 2026-11-16 (B1, B3, B5, B7): the hourly ceiling on form emails for all
// visitors together, the Brief tick on /send counted as a sign-up, the withdrawal
// confirmation's own ceiling, and the per-IP limit on /verdict/report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { EMAIL_CAPS } from '../src/config.js';
import { REPORT_LOOKUPS_PER_HOUR } from '../src/features/verdict-pay/domain.js';
import { WITHDRAW_PER_HOUR } from '../src/features/verdict-pay/withdraw.js';

const ORIGIN = 'https://virtuse.com';
const STACKING = { initial: 500, contribution: 100, frequency: 'monthly', years: 10, returnPct: 20, invested: 12500, projected: 48123.4, lowestFeePartner: '21bitcoin' };

function mockKv() {
  const store = new Map();
  return { store, async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); } };
}
const env = (extra = {}) => ({
  RATE_LIMIT_KV: mockKv(), RESEND_API_KEY: 'k', RESEND_FROM_EMAIL: 'Virtuse <brief@virtuse.com>', RESEND_SEGMENT_ID: 'seg',
  RESEND_CFO_AUDIENCE_ID: 'aud', UNSUB_SECRET: 's', ...extra,
});
const post = (path, body, ip = '1.2.3.4') => new Request(`https://w.example${path}`, {
  method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(body),
});
async function withFetch(fn) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method || 'GET', body: typeof init?.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : null });
    return new Response('{"id":"x"}', { status: String(url).includes('api.stripe.com') ? 404 : 200 });
  };
  try { await fn(calls); } finally { globalThis.fetch = orig; }
}
const emails = (calls) => calls.filter((c) => c.url === 'https://api.resend.com/emails');

test('defaults: 120 form emails and 30 withdrawal confirmations per hour', () => {
  assert.deepEqual(EMAIL_CAPS, { forms: 120, withdraw: 30 });
});

test('/subscribe, /waitlist and /send share one hourly ceiling across IPs; one alert, nothing sent past it', () => withFetch(async (calls) => {
  const e = env({ EMAIL_CAP_FORMS_PER_HOUR: '3' });
  assert.equal((await worker.fetch(post('/subscribe', { email: 'a1@b.co' }, '10.0.0.1'), e)).status, 200);
  assert.equal((await worker.fetch(post('/waitlist', { email: 'a2@b.co', source: 'cfo_page' }, '10.0.0.2'), e)).status, 200);
  assert.equal((await worker.fetch(post('/send', { email: 'a3@b.co', kind: 'result', source: 'stacking', payload: STACKING }, '10.0.0.3'), e)).status, 200);
  const before = calls.length;
  for (const [path, body, ip] of [
    ['/subscribe', { email: 'a4@b.co' }, '10.0.0.4'],
    ['/waitlist', { email: 'a5@b.co', source: 'cfo_page' }, '10.0.0.5'],
    ['/send', { email: 'a6@b.co', kind: 'result', source: 'stacking', payload: STACKING }, '10.0.0.6'],
  ]) {
    const res = await worker.fetch(post(path, body, ip), e);
    assert.equal(res.status, 429, path);
    assert.equal((await res.json()).code, 'busy', path);
  }
  const after = calls.slice(before);
  assert.equal(after.length, 1, 'only the internal alert leaves the Worker');
  assert.deepEqual(after[0].body.to, ['info@virtuse.com']);
  assert.match(after[0].body.subject, /hourly email limit reached \(forms\)/);
  assert.ok(!JSON.stringify(after[0].body).includes('@b.co'), 'no visitor address in the alert');
  // A refused /send gave its per-IP and per-address attempts back.
  const sendKeys = [...e.RATE_LIMIT_KV.store.entries()].filter(([k]) => k.startsWith('sendlimit:'));
  assert.ok(sendKeys.filter(([, v]) => String(v).split(':')[0] === '0').length >= 2);
}));

test('the ceiling counts nothing for a honeypot hit, a bad address or a dry run', () => withFetch(async () => {
  const e = env({ EMAIL_CAP_FORMS_PER_HOUR: '1', SUBSCRIBE_DRY_RUN: '1' });
  await worker.fetch(post('/subscribe', { email: 'a@b.co', hp: 'x' }), e);
  await worker.fetch(post('/subscribe', { email: 'nope' }), e);
  await worker.fetch(post('/subscribe', { email: 'a@b.co' }), e);
  assert.ok(![...e.RATE_LIMIT_KV.store.keys()].some((k) => k.startsWith('emailcap:')));
}));

test('/send with the Brief tick counts against the sign-up limit of /subscribe (5 per IP and hour)', () => withFetch(async (calls) => {
  const e = env();
  for (let i = 0; i < 5; i++) assert.equal((await worker.fetch(post('/subscribe', { email: `s${i}@b.co` }), e)).status, 200);
  const before = calls.length;
  const ticked = await worker.fetch(post('/send', { email: 'x@b.co', kind: 'result', source: 'stacking', payload: STACKING, brief: true }), e);
  assert.equal(ticked.status, 429);
  assert.equal(calls.length, before, 'no email and no contact');
  // Without the tick the result email still goes: /send keeps its own, wider limit.
  assert.equal((await worker.fetch(post('/send', { email: 'x@b.co', kind: 'result', source: 'stacking', payload: STACKING }), e)).status, 200);
  assert.equal(emails(calls.slice(before)).length, 1);
}));

test('withdrawal: past the confirmation ceiling Virtuse still gets the statement, the typed address gets nothing', () => withFetch(async (calls) => {
  const e = env({ EMAIL_CAP_WITHDRAW_PER_HOUR: '1', RESEND_SEND_FROM: 'Virtuse <plan@virtuse.com>' });
  const first = await (await worker.fetch(post('/verdict/withdraw', { name: 'Anna', email: 'anna@example.com' }, '10.0.0.1'), e)).json();
  assert.equal(first.confirmed, true);
  const before = calls.length;
  const res = await worker.fetch(post('/verdict/withdraw', { name: 'Boris', email: 'victim@example.com' }, '10.0.0.2'), e);
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.ok(d.ok && d.confirmed === false && d.at);
  const sent = emails(calls.slice(before)).map((c) => c.body.to[0]);
  assert.ok(sent.includes('info@virtuse.com'), 'the statement reached Virtuse');
  assert.ok(!sent.includes('victim@example.com'), 'no confirmation to the typed address');
}));

test(`withdrawal: ${WITHDRAW_PER_HOUR} statements per IP and hour, then 429`, () => withFetch(async () => {
  const e = env({ RESEND_SEND_FROM: 'Virtuse <plan@virtuse.com>' });
  assert.equal(WITHDRAW_PER_HOUR, 3);
  for (let i = 0; i < WITHDRAW_PER_HOUR; i++) assert.equal((await worker.fetch(post('/verdict/withdraw', { name: 'Anna', email: 'a@example.com' }), e)).status, 200);
  assert.equal((await worker.fetch(post('/verdict/withdraw', { name: 'Anna', email: 'a@example.com' }), e)).status, 429);
}));

test('/verdict/report: a per-IP limit stops lookups before they reach Stripe', () => withFetch(async (calls) => {
  const e = env({ VERDICT_PAYMENTS: '1', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test', STRIPE_PRICE_ID_VERDICT: 'price_123' });
  const ask = (n, ip) => worker.fetch(post('/verdict/report', { session_id: `cs_test_guess${String(n).padStart(8, '0')}`, lang: 'en' }, ip), e);
  for (let i = 0; i < REPORT_LOOKUPS_PER_HOUR; i++) assert.equal((await ask(i)).status, 402);
  const stripeCalls = calls.filter((c) => c.url.includes('api.stripe.com')).length;
  assert.equal(stripeCalls, REPORT_LOOKUPS_PER_HOUR);
  const res = await ask(999);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).code, 'rate_limited');
  assert.equal(calls.filter((c) => c.url.includes('api.stripe.com')).length, stripeCalls, 'no Stripe call past the limit');
  assert.equal((await ask(1000, '5.6.7.8')).status, 402, 'another IP is not affected');
  // A malformed id is refused before it is counted.
  const e2 = env({ VERDICT_PAYMENTS: '1', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test', STRIPE_PRICE_ID_VERDICT: 'price_123' });
  assert.equal((await worker.fetch(post('/verdict/report', { session_id: 'nope' }), e2)).status, 400);
  assert.equal(e2.RATE_LIMIT_KV.store.size, 0);
  assert.ok(![...e.RATE_LIMIT_KV.store.keys()].some((k) => k.includes('1.2.3.4')), 'the IP is stored only as a hash');
}));

// Turnstile on the forms, behind the Worker var TURNSTILE_FORMS (off on production until switched on).
async function withTurnstile(fn, { valid = 'good-token', hostname = 'virtuse.com' } = {}) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('challenges.cloudflare.com')) {
      const token = init.body.get('response');
      calls.push({ url: u, token });
      return new Response(JSON.stringify({ success: token === valid, hostname, 'error-codes': token === valid ? [] : ['invalid-input-response'] }), { status: 200 });
    }
    calls.push({ url: u, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    return new Response('{"id":"x"}', { status: 200 });
  };
  try { await fn(calls); } finally { globalThis.fetch = orig; }
}
const FORMS = [
  ['/subscribe', { email: 't@b.co' }],
  ['/waitlist', { email: 't@b.co', source: 'cfo_page' }],
  ['/send', { email: 't@b.co', kind: 'result', source: 'stacking', payload: STACKING }],
];

test('Turnstile off (no TURNSTILE_FORMS): the forms work without a token and never call Turnstile', () => withTurnstile(async (calls) => {
  const e = env({ TURNSTILE_SECRET_KEY: 'sec' });
  for (const [path, body] of FORMS) assert.equal((await worker.fetch(post(path, body), e)).status, 200, path);
  assert.ok(!calls.some((c) => c.url.includes('challenges.cloudflare.com')));
}));

test('Turnstile required: no token or a bad token -> 403 captcha with the site key, nothing sent or counted', () => withTurnstile(async (calls) => {
  const e = env({ TURNSTILE_FORMS: 'require', TURNSTILE_SECRET_KEY: 'sec' });
  for (const [path, body] of FORMS) {
    for (const turnstile of [undefined, 'bad-token', 12345]) {
      const res = await worker.fetch(post(path, { ...body, turnstile }), e);
      assert.equal(res.status, 403, path);
      const d = await res.json();
      assert.equal(d.code, 'captcha');
      assert.match(d.sitekey, /^0x4/);
    }
  }
  assert.ok(!calls.some((c) => c.url.includes('api.resend.com')), 'no Resend call');
  assert.equal(e.RATE_LIMIT_KV.store.size, 0, 'no limit counted');
}));

test('Turnstile required: a valid token lets each form through', () => withTurnstile(async (calls) => {
  const e = env({ TURNSTILE_FORMS: 'require', TURNSTILE_SECRET_KEY: 'sec' });
  for (const [path, body] of FORMS) assert.equal((await worker.fetch(post(path, { ...body, turnstile: 'good-token' }), e)).status, 200, path);
  assert.equal(emails(calls).length, 3);
}));

test('Turnstile required: a token issued for another site is refused', () => withTurnstile(async () => {
  const e = env({ TURNSTILE_FORMS: 'require', TURNSTILE_SECRET_KEY: 'sec' });
  assert.equal((await worker.fetch(post('/subscribe', { email: 't@b.co', turnstile: 'good-token' }), e)).status, 403);
}, { hostname: 'evil.example' }));

test('Turnstile required but no secret on the Worker: the forms stay open', () => withTurnstile(async (calls) => {
  const e = env({ TURNSTILE_FORMS: 'require' });
  assert.equal((await worker.fetch(post('/subscribe', { email: 't@b.co' }), e)).status, 200);
  assert.ok(!calls.some((c) => c.url.includes('challenges.cloudflare.com')));
}));

test('Turnstile required: honeypot and bad address are answered as before, and the staging dry run still needs the token', () => withTurnstile(async () => {
  const e = env({ TURNSTILE_FORMS: 'require', TURNSTILE_SECRET_KEY: 'sec', SUBSCRIBE_DRY_RUN: '1' });
  assert.equal((await worker.fetch(post('/subscribe', { email: 't@b.co', hp: 'x' }), e)).status, 200);
  assert.equal((await worker.fetch(post('/subscribe', { email: 'nope' }), e)).status, 400);
  assert.equal((await worker.fetch(post('/subscribe', { email: 't@b.co' }), e)).status, 403);
  assert.deepEqual(await (await worker.fetch(post('/subscribe', { email: 't@b.co', turnstile: 'good-token' }), e)).json(), { ok: true, dryRun: true });
}));
