// Double opt-in for the Virtuse Brief (BRIEF_DOUBLE_OPTIN=1), creators phase 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../src/app.js';
import { CONSENT_VERSION } from '../src/config.js';
import { confirmToken, readConfirmToken } from '../src/features/newsletter/optin.js';
import { sha256Hex } from '../src/shared/crypto.js';

const ORIGIN = 'https://virtuse.com';
const T0 = Date.UTC(2026, 10, 23, 10, 0, 0);

function mockKv() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
    async delete(k) { store.delete(k); },
  };
}

function env(extra = {}) {
  return {
    RATE_LIMIT_KV: mockKv(),
    RESEND_API_KEY: 'k',
    RESEND_FROM_EMAIL: 'Virtuse <brief@virtuse.com>',
    RESEND_SEGMENT_ID: 'seg-brief',
    RESEND_SK_SEGMENT_ID: 'seg-sk',
    UNSUB_SECRET: 's',
    BRIEF_DOUBLE_OPTIN: '1',
    ...extra,
  };
}

function post(path, body) {
  return new Request('https://w.example' + path, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
    body: JSON.stringify(body),
  });
}

// Captures every fetch to Resend; GET /contacts/... answers 404 (no such contact).
function fakeFetch() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(init.body) : null });
    if (init?.method === 'GET') return new Response('{}', { status: 404 });
    return new Response('{"id":"x"}', { status: 200 });
  };
  return { calls, fetchImpl };
}

function linkFrom(call) {
  const m = call.body.html.match(/href="([^"]+\/confirm\?t=[^"]+)"/);
  assert.ok(m, 'confirmation email carries a /confirm link');
  return new URL(m[1].replace(/&amp;/g, '&'));
}

const confirmPost = (link) => new Request('https://w.example/confirm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': '5.6.7.8' },
  body: 't=' + encodeURIComponent(link.searchParams.get('t')),
});

test('/subscribe sends one confirmation email and adds nobody yet', async () => {
  const { calls, fetchImpl } = fakeFetch();
  const w = createWorker({ fetchImpl, clock: () => T0 });
  const res = await w.fetch(post('/subscribe', { email: 'a@b.co', hp: '', lang: 'en' }), env());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, pending: true });
  assert.ok(!calls.some((c) => c.url.endsWith('/contacts')), 'no contact before the click');
  const mails = calls.filter((c) => c.url.endsWith('/emails'));
  assert.equal(mails.length, 1);
  assert.equal(mails[0].body.subject, 'Confirm your Virtuse Brief subscription');
  assert.deepEqual(mails[0].body.to, ['a@b.co']);
  assert.equal(linkFrom(mails[0]).origin, 'https://w.example');
});

test('Slovak sign-up gets the Slovak confirmation', async () => {
  const { calls, fetchImpl } = fakeFetch();
  await createWorker({ fetchImpl, clock: () => T0 }).fetch(post('/subscribe', { email: 'a@b.co', lang: 'sk' }), env());
  assert.equal(calls.find((c) => c.url.endsWith('/emails')).body.subject, 'Potvrďte odber Virtuse Brief');
});

test('GET /confirm only shows a button; POST joins, welcomes and stores consent', async () => {
  const { calls, fetchImpl } = fakeFetch();
  const e = env();
  await e.RATE_LIMIT_KV.put('creator:satoshi-pod', '{"name":"Test"}');
  const w = createWorker({ fetchImpl, clock: () => T0 });
  await w.fetch(post('/subscribe', { email: 'a@b.co', lang: 'sk', ref: 'Satoshi-Pod', source: 'creators_page' }), e);
  const link = linkFrom(calls.find((c) => c.url.endsWith('/emails')));
  calls.length = 0;

  const page = await createWorker({ fetchImpl, clock: () => T0 + 3600e3 }).fetch(new Request(link.href), e);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /method="post" action="\/confirm"/);
  assert.match(html, /Potvrdiť odber/);
  assert.equal(calls.length, 0, 'opening the link changes nothing');

  const done = await createWorker({ fetchImpl, clock: () => T0 + 3600e3 }).fetch(confirmPost(link), e);
  assert.equal(done.status, 200);
  assert.match(await done.text(), /Odber je potvrdený/);
  const contact = calls.find((c) => c.url === 'https://api.resend.com/contacts');
  assert.deepEqual(contact.body.segments, [{ id: 'seg-sk' }]);
  const welcome = calls.find((c) => c.url.endsWith('/emails'));
  assert.equal(welcome.body.subject, 'Vitajte vo Virtuse Brief');
  assert.match(welcome.body.headers['List-Unsubscribe'], /^<https:\/\/.+\/unsubscribe\?email=a%40b\.co&token=[0-9a-f]+>$/);
  assert.equal(welcome.body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');

  const addr = await sha256Hex('a@b.co');
  const consent = JSON.parse(e.RATE_LIMIT_KV.store.get(`consent:${addr}`));
  assert.equal(consent.version, CONSENT_VERSION);
  assert.equal(consent.lang, 'sk');
  assert.equal(consent.source, 'creators_page');
  assert.equal(consent.ref, 'satoshi-pod');
  assert.match(consent.ipHash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(consent).includes('a@b.co'), 'the record holds no address');
  assert.ok(e.RATE_LIMIT_KV.store.has(`refsub:satoshi-pod:${addr}`), 'counted for the creator');
});

test('an unknown creator code is kept in the consent record but not counted', async () => {
  const { calls, fetchImpl } = fakeFetch();
  const e = env();
  const w = createWorker({ fetchImpl, clock: () => T0 });
  await w.fetch(post('/subscribe', { email: 'x@y.co', ref: 'nobody' }), e);
  await w.fetch(confirmPost(linkFrom(calls.find((c) => c.url.endsWith('/emails')))), e);
  assert.ok(![...e.RATE_LIMIT_KV.store.keys()].some((k) => k.startsWith('refsub:')));
});

test('a malformed ref or source is dropped', async () => {
  const data = await readConfirmToken('s', await confirmToken('s', { e: 'a@b.co', l: 'en', r: 'Bad Code!', s: '<x>', t: T0 }), T0);
  assert.equal(data.ref, '');
  assert.equal(data.source, '');
});

test('a changed or expired token is refused', async () => {
  const t = await confirmToken('s', { e: 'a@b.co', l: 'en', t: T0 });
  assert.ok(await readConfirmToken('s', t, T0 + 6 * 86400e3));
  assert.equal(await readConfirmToken('s', t, T0 + 8 * 86400e3), null);
  assert.equal(await readConfirmToken('other', t, T0), null);
  const forged = await confirmToken('s', { e: 'victim@b.co', l: 'en', t: T0 });
  assert.equal(await readConfirmToken('s', forged.split('.')[0] + '.' + t.split('.')[1], T0), null);
  const { fetchImpl, calls } = fakeFetch();
  const res = await createWorker({ fetchImpl, clock: () => T0 }).fetch(new Request('https://w.example/confirm?t=abc.def'), env());
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test('one address gets at most 3 confirmation emails a day, and learns nothing from the 4th', async () => {
  const { calls, fetchImpl } = fakeFetch();
  const e = env();
  const w = createWorker({ fetchImpl, clock: () => T0 });
  const ips = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'];
  for (const ip of ips) {
    const r = new Request('https://w.example/subscribe', { method: 'POST', headers: { Origin: ORIGIN, 'CF-Connecting-IP': ip }, body: JSON.stringify({ email: 'A@b.co' }) });
    const res = await w.fetch(r, e);
    assert.deepEqual(await res.json(), { ok: true, pending: true });
  }
  assert.equal(calls.filter((c) => c.url.endsWith('/emails')).length, 3);
});

test('staging dry run: confirmation and welcome go only to BRIEF_TEST_TO, no contact', async () => {
  const { calls, fetchImpl } = fakeFetch();
  const e = env({ SUBSCRIBE_DRY_RUN: '1', BRIEF_TEST_TO: 'test@virtuse.com' });
  const w = createWorker({ fetchImpl, clock: () => T0 });
  const res = await w.fetch(post('/subscribe', { email: 'visitor@b.co' }), e);
  assert.deepEqual(await res.json(), { ok: true, pending: true });
  const mail = calls.find((c) => c.url.endsWith('/emails'));
  assert.deepEqual(mail.body.to, ['test@virtuse.com']);
  assert.match(mail.body.subject, /^\[TEST\] /);
  calls.length = 0;
  await w.fetch(confirmPost(linkFrom(mail)), e);
  assert.ok(!calls.some((c) => c.url.includes('/contacts')));
  assert.deepEqual(calls.find((c) => c.url.endsWith('/emails')).body.to, ['test@virtuse.com']);
});

test('staging dry run without BRIEF_TEST_TO sends nothing', async () => {
  const { calls, fetchImpl } = fakeFetch();
  const res = await createWorker({ fetchImpl, clock: () => T0 }).fetch(post('/subscribe', { email: 'v@b.co' }), env({ SUBSCRIBE_DRY_RUN: '1' }));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

test('/send with brief: true asks for confirmation instead of joining', async () => {
  const { calls, fetchImpl } = fakeFetch();
  const res = await createWorker({ fetchImpl, clock: () => T0 }).fetch(post('/send', {
    email: 'a@b.co', lang: 'en', kind: 'result', source: 'tax', payload: { country: 'cz', inheritanceScore: 40, inheritanceMax: 105 }, brief: true,
  }), env());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, pending: true });
  assert.ok(!calls.some((c) => c.url === 'https://api.resend.com/contacts'));
  const subjects = calls.filter((c) => c.url.endsWith('/emails')).map((c) => c.body.subject);
  assert.ok(subjects.includes('Confirm your Virtuse Brief subscription'));
  assert.equal(subjects.length, 2, 'the result email and the confirmation');
});

test('switch off: /subscribe joins at once, as before', async () => {
  const { calls, fetchImpl } = fakeFetch();
  const res = await createWorker({ fetchImpl, clock: () => T0 }).fetch(post('/subscribe', { email: 'a@b.co' }), env({ BRIEF_DOUBLE_OPTIN: '0' }));
  assert.deepEqual(await res.json(), { ok: true });
  assert.ok(calls.some((c) => c.url === 'https://api.resend.com/contacts'));
});
