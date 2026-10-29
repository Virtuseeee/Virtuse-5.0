// POST /subscribe: the lang field only ever selects an own key of the
// welcome-email / segment maps. Object.prototype keys ('toString',
// 'constructor', ...) fall back to English and the default segment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { welcomeLang } from '../src/features/newsletter/welcome.js';
import { segmentFor } from '../src/features/newsletter/segments.js';

const ORIGIN = 'https://virtuse.com';

function mockKv() {
  const store = new Map();
  return { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); } };
}

function env() {
  return {
    RATE_LIMIT_KV: mockKv(),
    RESEND_API_KEY: 'k',
    RESEND_FROM_EMAIL: 'Virtuse <brief@virtuse.com>',
    RESEND_SEGMENT_ID: 'seg-brief',
    RESEND_SK_SEGMENT_ID: 'seg-sk',
    UNSUB_SECRET: 's',
  };
}

function subscribe(body) {
  return new Request('https://w.example/subscribe', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
    body: JSON.stringify(body),
  });
}

async function withFetch(fn) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(init.body) : null });
    return new Response('{"id":"x"}', { status: 200 });
  };
  try { await fn(calls); } finally { globalThis.fetch = orig; }
}

for (const lang of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
  test(`/subscribe with lang "${lang}" is an English sign-up in the default segment`, () => withFetch(async (calls) => {
    const res = await worker.fetch(subscribe({ email: 'a@b.co', hp: '', lang }), env());
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });

    const contact = calls.find((c) => c.url === 'https://api.resend.com/contacts');
    assert.ok(contact, 'expected a contact to be created');
    assert.equal(contact.body.email, 'a@b.co');
    assert.deepEqual(contact.body.properties, { lang: 'en' });
    assert.deepEqual(contact.body.segments, [{ id: 'seg-brief' }]);

    const email = calls.find((c) => c.url === 'https://api.resend.com/emails');
    assert.ok(email, 'expected the welcome email');
    assert.equal(email.body.subject, 'Welcome to Virtuse Brief');
    assert.deepEqual(email.body.to, ['a@b.co']);
  }));
}

test('/subscribe with lang "sk" still joins the Slovak segment and gets the Slovak email', () => withFetch(async (calls) => {
  const res = await worker.fetch(subscribe({ email: 'a@b.co', hp: '', lang: 'sk' }), env());
  assert.equal(res.status, 200);
  const contact = calls.find((c) => c.url === 'https://api.resend.com/contacts');
  assert.deepEqual(contact.body.properties, { lang: 'sk' });
  assert.deepEqual(contact.body.segments, [{ id: 'seg-sk' }]);
  const email = calls.find((c) => c.url === 'https://api.resend.com/emails');
  assert.equal(email.body.subject, 'Vitajte vo Virtuse Brief');
}));

test('welcomeLang and segmentFor ignore inherited keys', () => {
  for (const k of ['toString', 'constructor', 'valueOf', '__proto__', 'isPrototypeOf']) {
    assert.equal(welcomeLang(k), 'en');
    assert.equal(segmentFor(env(), k), 'seg-brief');
  }
  assert.equal(welcomeLang('sk'), 'sk');
  assert.equal(welcomeLang('en'), 'en');
  assert.equal(welcomeLang('de'), 'en');
  assert.equal(welcomeLang(42), 'en');
  assert.equal(segmentFor(env(), 'sk'), 'seg-sk');
  assert.equal(segmentFor(env(), 'en'), 'seg-brief');
  assert.equal(segmentFor({ RESEND_SEGMENT_ID: 'seg-brief' }, 'sk'), 'seg-brief');
});
