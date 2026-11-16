// Security audit 2026-11-16 (B4, B8, B20, B21, B23): staging /send adds nobody to the
// Brief, the WordPress proxy forwards only the build's parameters, KV keys hold hashes
// instead of IPs and addresses, sign-up bodies and addresses have a size limit, and the
// internal delivery alert no longer carries the full Checkout Session id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { EMAIL_MAX_LENGTH, SIGNUP_MAX_BYTES } from '../src/config.js';
import { MAX_JSON_BYTES } from '../src/http/request.js';
import { renderAlert, shortSid } from '../src/features/verdict-pay/alerts.js';
import { allowedQuery, handleWpProxy } from '../src/features/wp-proxy/handler.js';

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
const post = (path, body, ip = '203.0.113.77') => new Request(`https://w.example${path}`, {
  method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
async function withFetch(fn) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method || 'GET', body: typeof init?.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : null });
    if (String(url).includes('turnstile')) return new Response(JSON.stringify({ success: true, hostname: 'virtuse.com' }), { status: 200 });
    return new Response('{"id":"x"}', { status: 200 });
  };
  try { await fn(calls); } finally { globalThis.fetch = orig; }
}

test('B4: on staging (SUBSCRIBE_DRY_RUN=1) /send with the Brief tick sends the result email but adds no contact', () => withFetch(async (calls) => {
  const res = await worker.fetch(post('/send', { email: 'a@b.co', kind: 'result', source: 'stacking', payload: STACKING, brief: true }), env({ SUBSCRIBE_DRY_RUN: '1' }));
  assert.equal(res.status, 200);
  assert.deepEqual(calls.map((c) => c.url), ['https://api.resend.com/emails'], 'one email, no contact or segment call');
}));

test('B4: without the dry run the Brief tick still joins the Brief', () => withFetch(async (calls) => {
  const res = await worker.fetch(post('/send', { email: 'a@b.co', kind: 'result', source: 'stacking', payload: STACKING, brief: true }), env());
  assert.equal(res.status, 200);
  assert.ok(calls.some((c) => /contacts|audiences|segments/.test(c.url)), 'the address is added to the Brief list');
}));

test('B8: the WordPress proxy accepts the build\'s queries', () => {
  for (const q of [
    'categories=13&per_page=100&page=2&_embed=wp:featuredmedia&orderby=date&order=desc&lang=en',
    'slug=some-post&_fields=id,status,categories&lang=ru',
    '',
  ]) assert.equal(allowedQuery(new URLSearchParams(q)), true, q);
});

test('B8: unknown, repeated, oversized parameters and rest_route are refused before WordPress is called', async () => {
  for (const q of ['x=1', 'rest_route=/wp/v2/users', 'page=1&page=2', 'per_page=101', 'per_page=0', 'per_page=abc', 'slug=' + 'a'.repeat(201), 'categories=13&cachebust=123']) {
    const calls = [];
    const url = new URL('https://w.example/wp/wp-json/wp/v2/posts?' + q);
    const res = await handleWpProxy(new Request(url), url, async (u) => { calls.push(u); return new Response('[]'); });
    assert.equal(res.status, 400, q);
    assert.equal(calls.length, 0, q);
  }
});

test('B20: the sign-up limit key holds a hash, never the IP', () => withFetch(async () => {
  const e = env();
  assert.equal((await worker.fetch(post('/subscribe', { email: 'a@b.co' }), e)).status, 200);
  const keys = [...e.RATE_LIMIT_KV.store.keys()];
  assert.ok(keys.some((k) => /^ratelimit:[0-9a-f]{64}$/.test(k)), keys.join(' '));
  assert.ok(!keys.some((k) => k.includes('203.0.113.77')));
}));

test('B20: the sign-up limit still stops the 6th sign-up from one IP in an hour', () => withFetch(async () => {
  const e = env();
  for (let i = 0; i < 5; i++) assert.equal((await worker.fetch(post('/subscribe', { email: `s${i}@b.co` }), e)).status, 200);
  assert.equal((await worker.fetch(post('/subscribe', { email: 's5@b.co' }), e)).status, 429);
  assert.equal((await worker.fetch(post('/subscribe', { email: 's6@b.co' }, '203.0.113.78'), e)).status, 200, 'another IP is not affected');
}));

test('B20: the ecosystem form keeps no IP and no address in KV', () => withFetch(async () => {
  const e = env({ TURNSTILE_SECRET_KEY: 't' });
  const app = {
    project_name: 'Satoshi Shop', website: 'https://example.org', category: 'store-tools',
    description: 'A bitcoin-only checkout for small shops.', countries: ['ALL'], bitcoin_only: true,
    licence: '', repo: '', contact_name: 'Ada Muster', contact_email: 'Ada@Nodebox.example',
    sponsored_interest: 'no', message: '', consent: true, lang: 'en', turnstile: 'tok', company_url: '',
  };
  const res = await worker.fetch(post('/ecosystem-apply', app), e);
  const keys = [...e.RATE_LIMIT_KV.store.keys()];
  if (res.status === 200) {
    assert.ok(keys.some((k) => /^eco:ip:[0-9a-f]{64}$/.test(k)), keys.join(' '));
    assert.ok(keys.some((k) => /^eco:reply:[0-9a-f]{64}$/.test(k)), keys.join(' '));
  } else {
    assert.equal(res.status, 400, 'the fixture did not pass validation'); // keeps the test honest if the form's fields change
    assert.fail('ecosystem fixture rejected: ' + JSON.stringify(await res.json()));
  }
  assert.ok(!keys.some((k) => /203\.0\.113\.77|nodebox/i.test(k)));
}));

test('B21: /subscribe and /waitlist refuse a body over 4 kB and an address over 254 characters', () => withFetch(async (calls) => {
  assert.equal(SIGNUP_MAX_BYTES, 4096);
  assert.equal(EMAIL_MAX_LENGTH, 254);
  const big = JSON.stringify({ email: 'a@b.co', lang: 'x'.repeat(5000) });
  const long = 'a'.repeat(250) + '@b.co';
  for (const path of ['/subscribe', '/waitlist']) {
    assert.equal((await worker.fetch(post(path, big), env())).status, 413, path);
    assert.equal((await worker.fetch(post(path, { email: long }), env())).status, 400, path);
  }
  assert.equal(calls.length, 0);
}));

test('B21: every JSON route refuses a body over 16 kB', () => withFetch(async (calls) => {
  assert.equal(MAX_JSON_BYTES, 16384);
  const res = await worker.fetch(post('/send', JSON.stringify({ email: 'a@b.co', kind: 'result', source: 'stacking', payload: STACKING, pad: 'x'.repeat(17000) })), env());
  assert.equal(res.status, 413);
  assert.equal(calls.length, 0);
}));

test('B23: the delivery alert shows only the start of the Checkout Session id', () => {
  const sid = 'cs_live_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0';
  const { subject, html } = renderAlert({ kind: 'send_failed', sid, now: Date.UTC(2026, 10, 16) });
  assert.equal(shortSid(sid), 'cs_live_a1B2c3D4e5…');
  assert.ok(!html.includes(sid) && !subject.includes(sid));
  assert.ok(html.includes('cs_live_a1B2c3D4e5…'));
  assert.match(subject, /order A1B2C3D4E5/);
});

// ---- second round (B14, B17) ----
import { SPEND_RESERVE_EUR } from '../src/features/verdict/budget.js';
import { pulseErrors } from '../src/features/pulse/schema.js';

test('B14: the AI Verdict books a share of the monthly budget before the model call and settles it afterwards', async () => {
  const e = { RATE_LIMIT_KV: mockKv(), ANTHROPIC_API_KEY: 'sk-test', VERDICT_ENABLED: '1', VERDICT_MONTHLY_CAP_EUR: '0.05' };
  const key = 'verdict:spend:' + new Date().toISOString().slice(0, 7);
  const body = { text: 'I will buy €100 of BTC every month for 10 years.', lang: 'en' };
  const seen = {};
  const orig = globalThis.fetch;
  globalThis.fetch = async () => {
    seen.during = parseFloat(e.RATE_LIMIT_KV.store.get(key));
    // A second visitor arrives while the first call is still running.
    seen.second = (await worker.fetch(post('/verdict', body, '203.0.113.90'), e)).status;
    throw new Error('model unreachable');
  };
  try {
    const res = await worker.fetch(post('/verdict', body), e);
    assert.equal(res.status, 502);
  } finally { globalThis.fetch = orig; }
  assert.equal(seen.during, SPEND_RESERVE_EUR, 'the reservation is visible while the call runs');
  assert.equal(seen.second, 429, 'the concurrent request sees the budget as used');
  assert.equal(parseFloat(e.RATE_LIMIT_KV.store.get(key)), 0, 'a failed call that cost nothing gives the reservation back');
});

test('B17: the Pulse feed must be an https URL (or none)', () => {
  const feedErrors = (feed) => pulseErrors({ feed }).filter((m) => /feed/.test(m));
  for (const ok of [null, undefined, '', 'https://example.org/pulse.json']) assert.deepEqual(feedErrors(ok), [], String(ok));
  for (const bad of ['javascript:alert(1)', 'http://example.org/p.json', '//example.org/p.json', 'data:text/html,x', 5]) assert.equal(feedErrors(bad).length, 1, String(bad));
});
