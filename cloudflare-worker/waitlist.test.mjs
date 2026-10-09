import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.js';
import { renderWaitlistEmail } from './src/waitlist.js';

const ORIGIN = 'https://virtuse.com';

function mockKv() {
  const store = new Map();
  return { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); } };
}

function env(extra = {}) {
  return {
    RATE_LIMIT_KV: mockKv(),
    RESEND_API_KEY: 'k',
    RESEND_FROM_EMAIL: 'Virtuse <brief@virtuse.com>',
    RESEND_SEND_FROM: 'Virtuse <plan@virtuse.com>',
    RESEND_SEGMENT_ID: 'seg-brief',
    RESEND_CFO_AUDIENCE_ID: 'aud-cfo',
    UNSUB_SECRET: 's',
    ...extra,
  };
}

function req(body, { origin = ORIGIN, ip = '1.2.3.4', path = '/waitlist' } = {}) {
  return new Request('https://w.example' + path, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

function withFetch(fn, respond = () => new Response('{}', { status: 200 })) {
  return async () => {
    const calls = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const call = { url: String(url), method: init?.method, body: init?.body ? JSON.parse(init.body) : null };
      calls.push(call);
      return respond(call);
    };
    try { await fn(calls); } finally { globalThis.fetch = orig; }
  };
}

test('new sign-up joins the CFO audience, not the Brief, and gets one confirmation', withFetch(async (calls) => {
  const res = await worker.fetch(req({ email: 'a@b.co', hp: '', source: 'cfo_page' }), env());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.resend.com/audiences/aud-cfo/contacts');
  assert.equal(calls[0].body.email, 'a@b.co');
  assert.ok(!calls.some((c) => c.url.includes('seg-brief')));
  assert.equal(calls[1].url, 'https://api.resend.com/emails');
  assert.equal(calls[1].body.from, 'Virtuse <plan@virtuse.com>');
  assert.equal(calls[1].body.subject, "You're on the Virtuse CFO waitlist");
  assert.match(calls[1].body.html, /list=cfo/);
  assert.match(calls[1].body.html, /1 November 2026/);
}));

test('already on the waitlist: 200, no second email', withFetch(async (calls) => {
  const res = await worker.fetch(req({ email: 'a@b.co' }), env());
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
}, () => new Response('{"message":"Contact already exists"}', { status: 409 })));

test('honeypot: 200 and nothing sent', withFetch(async (calls) => {
  const res = await worker.fetch(req({ email: 'a@b.co', hp: 'bot' }), env());
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
}));

test('bad email, unknown source: 400', withFetch(async (calls) => {
  assert.equal((await worker.fetch(req({ email: 'nope' }), env())).status, 400);
  assert.equal((await worker.fetch(req({ email: 'a@b.co', source: 'elsewhere' }), env())).status, 400);
  assert.equal(calls.length, 0);
}));

test('no audience configured: 503, nothing sent', withFetch(async (calls) => {
  const res = await worker.fetch(req({ email: 'a@b.co' }), env({ RESEND_CFO_AUDIENCE_ID: undefined }));
  assert.equal(res.status, 503);
  assert.equal(calls.length, 0);
}));

test('origin gate: unknown origin gets 403', withFetch(async (calls) => {
  const res = await worker.fetch(req({ email: 'a@b.co' }, { origin: 'https://evil.example' }), env());
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
}));

test('Resend failure: 502', withFetch(async () => {
  const res = await worker.fetch(req({ email: 'a@b.co' }), env());
  assert.equal(res.status, 502);
}, () => new Response('boom', { status: 500 })));

test('rate limit applies (6th request from one IP in an hour)', withFetch(async () => {
  const e = env();
  let last;
  for (let i = 0; i < 6; i++) last = await worker.fetch(req({ email: `u${i}@b.co` }), e);
  assert.equal(last.status, 429);
}));

test('leave link with &list=cfo only touches the CFO audience', withFetch(async (calls) => {
  const e = env();
  // build a valid link the same way the confirmation email does
  await worker.fetch(req({ email: 'a@b.co' }), e);
  const link = new URL(calls[1].body.html.match(/href="([^"]+list=cfo)"/)[1].replace(/&amp;/g, '&'));
  calls.length = 0;
  const res = await worker.fetch(new Request('https://w.example' + link.pathname + link.search), e);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /left the Virtuse CFO waitlist/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/audiences/aud-cfo/contacts/a%40b.co');
  assert.equal(calls[0].method, 'PATCH');
}));

test('Brief unsubscribe (no list param) is unchanged and skips the CFO audience', withFetch(async (calls) => {
  const e = env();
  await worker.fetch(req({ email: 'a@b.co' }), e);
  const link = new URL(calls[1].body.html.match(/href="([^"]+)list=cfo"/)[1].replace(/&amp;/g, '&').replace(/&$/, ''));
  calls.length = 0;
  const res = await worker.fetch(new Request('https://w.example' + link.pathname + link.search), e);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /unsubscribed from the Virtuse Brief/);
  assert.ok(calls.every((c) => !c.url.includes('aud-cfo')));
}));

test('confirmation email names no partner and makes no advice claim', () => {
  const html = renderWaitlistEmail('https://x/leave');
  assert.ok(!/recommend|best|should buy/i.test(html));
  assert.match(html, /no investment advice/);
});
