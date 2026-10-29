// Unit tests for the shared kernel: rate limiter, crypto helpers, router,
// and the Resend / Turnstile adapters (with an injected fetch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKvLimiter } from '../src/shared/rate-limiter.js';
import { equalBytes, equalStrings, hmacSha256Hex, sha256Hex } from '../src/shared/crypto.js';
import { ANY, on, pipeline, prefix } from '../src/http/router.js';
import { clientIp, readJson } from '../src/http/request.js';
import { corsHeaders } from '../src/http/responses.js';
import { createResendClient } from '../src/infra/resend.js';
import { verifyTurnstile } from '../src/infra/turnstile.js';

function memoryKv() {
  const store = new Map();
  const puts = [];
  return {
    store, puts,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v, o) { puts.push([k, v, o]); store.set(k, v); },
  };
}

test('limiter counts up to max, then refuses without counting', async () => {
  const kv = memoryKv();
  const limiter = createKvLimiter(kv);
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await limiter.exceeded('k', 3, 60));
  assert.deepEqual(results, [false, false, false, true]);
  assert.equal(kv.store.get('k'), '3');
  assert.deepEqual(kv.puts.at(-1), ['k', '3', { expirationTtl: 60 }]);
});

test('claimOnce succeeds once per window', async () => {
  const limiter = createKvLimiter(memoryKv());
  assert.equal(await limiter.claimOnce('r', 10), true);
  assert.equal(await limiter.claimOnce('r', 10), false);
});

test('crypto helpers match known vectors and compare safely', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    await hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog'),
    'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'
  );
  assert.equal(equalStrings('abc', 'abc'), true);
  assert.equal(equalStrings('abc', 'abd'), false);
  assert.equal(equalStrings('abc', 'ab'), false);
  assert.equal(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2])), true);
  assert.equal(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1])), false);
});

test('router: first matching step answers, in order', async () => {
  const seen = [];
  const step = (name) => () => { seen.push(name); return new Response(name); };
  const route = pipeline(
    on(['GET'], '/a', step('a')),
    on(ANY, ['/b', '/c'], step('bc')),
    on(ANY, prefix('/p/'), step('p')),
    (ctx) => (ctx.method === 'POST' ? undefined : new Response('gate')),
    step('fallback')
  );
  const run = async (method, path) => (await route({ method, path })).text();
  assert.equal(await run('GET', '/a'), 'a');
  assert.equal(await run('POST', '/a'), 'fallback');
  assert.equal(await run('PUT', '/c'), 'bc');
  assert.equal(await run('GET', '/p/x'), 'p');
  assert.equal(await run('GET', '/p'), 'gate');
});

test('router throws when no step answers', async () => {
  await assert.rejects(pipeline(on(['GET'], '/x', () => new Response('')))({ method: 'GET', path: '/y' }), /No step answered/);
});

test('request helpers', async () => {
  const r = (body, headers = {}) => new Request('https://w.example/', { method: 'POST', body, headers });
  assert.equal(clientIp(r('', { 'CF-Connecting-IP': '9.9.9.9' })), '9.9.9.9');
  assert.equal(clientIp(r('')), 'unknown');
  assert.deepEqual(await readJson(r('{"a":1}')), { ok: true, value: { a: 1 } });
  assert.deepEqual(await readJson(r('{')), { ok: false });
});

test('CORS echoes allowed origins only', () => {
  assert.equal(corsHeaders('https://virtuse.com')['Access-Control-Allow-Origin'], 'https://virtuse.com');
  assert.equal(corsHeaders('https://evil.example')['Access-Control-Allow-Origin'], 'https://staging.virtuse.com');
});

test('Resend adapter: auth, duplicates, 404 on unsubscribe, labelled errors', async () => {
  const calls = [];
  let reply = () => new Response('{}', { status: 200 });
  const resend = createResendClient('rk', async (url, init) => { calls.push({ url, init }); return reply(url, init); });

  await resend.sendEmail({ to: ['a@b.co'] });
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer rk');
  assert.equal(calls[0].init.body, '{"to":["a@b.co"]}');

  reply = () => new Response('Contact already exists', { status: 422 });
  assert.deepEqual(await resend.createContact({ email: 'a@b.co' }), { created: false, duplicate: true });
  assert.deepEqual(await resend.addToAudience('aud', { email: 'a@b.co' }, 'x'), { created: false });

  reply = () => new Response('', { status: 404 });
  await resend.unsubscribeFromAudience('aud', 'a+b@c.co', 'x');
  assert.equal(calls.at(-1).url, 'https://api.resend.com/audiences/aud/contacts/a%2Bb%40c.co');
  assert.equal(calls.at(-1).init.method, 'PATCH');

  reply = () => new Response('boom', { status: 500 });
  await assert.rejects(resend.sendEmail({}, 'Resend waitlist email failed'), /^Error: Resend waitlist email failed \(status 500\): boom$/);
  await assert.rejects(resend.createContact({}), /^Error: Resend contacts API failed \(status 500\): boom$/);
});

test('Turnstile adapter accepts only our hosts and never throws', async () => {
  const hosts = ['virtuse.com'];
  const answer = (out) => async () => new Response(JSON.stringify(out));
  const warn = console.warn; const error = console.error;
  console.warn = () => {}; console.error = () => {};
  try {
    assert.equal(await verifyTurnstile({ secret: 's', token: 't', ip: '1.1.1.1', allowedHosts: hosts, fetchImpl: answer({ success: true, hostname: 'virtuse.com' }) }), true);
    assert.equal(await verifyTurnstile({ secret: 's', token: 't', allowedHosts: hosts, fetchImpl: answer({ success: true, hostname: 'evil.example' }) }), false);
    assert.equal(await verifyTurnstile({ secret: 's', token: '', allowedHosts: hosts, fetchImpl: answer({ success: true, hostname: 'virtuse.com' }) }), false);
    assert.equal(await verifyTurnstile({ secret: 's', token: 't', allowedHosts: hosts, fetchImpl: async () => { throw new Error('down'); } }), false);
  } finally {
    console.warn = warn; console.error = error;
  }
});
