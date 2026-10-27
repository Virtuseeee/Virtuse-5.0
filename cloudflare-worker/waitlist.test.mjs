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
  assert.equal(calls[1].body.subject, "You're on the Virtuse CFO · Verdict waitlist");
  assert.match(calls[1].body.html, /list=cfo/);
  assert.match(calls[1].body.html, /when Verdict and the free fee audit open/);
  assert.doesNotMatch(calls[1].body.html, /1 November|January/);
}));

test('pricing card sign-up (cfo_plan) gets the paid-plans wording, no launch date (Ras 2026-10-27)', withFetch(async (calls) => {
  const res = await worker.fetch(req({ email: 'a@b.co', hp: '', source: 'cfo_plan' }), env());
  assert.equal(res.status, 200);
  assert.equal(calls[0].url, 'https://api.resend.com/audiences/aud-cfo/contacts');
  assert.equal(calls[1].body.subject, "You're on the Virtuse CFO list");
  assert.match(calls[1].body.html, /when the paid Virtuse CFO plans open:/);
  assert.doesNotMatch(calls[1].body.html, /1 November|January/);
  assert.match(calls[1].body.html, /list=cfo/);
}));

test('confirmation email mentions Verdict and the fee audit', () => {
  const h = renderWaitlistEmail('https://x/leave');
  assert.match(h, /Verdict<\/b> scores how complete your Bitcoin decision is/);
  assert.match(h, /one email when Verdict and the free fee audit open/);
  assert.doesNotMatch(h, /1 November|January/);
  assert.match(h, /fee audit<\/b> reads your exchange export/);
  assert.doesNotMatch(h, /recommend/i);
});

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
  assert.match(await res.text(), /left the Virtuse CFO · Verdict waitlist/);
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

test('confirmation email follows the form language (sk), unknown languages get English', withFetch(async (calls) => {
  let res = await worker.fetch(req({ email: 'a@b.co', hp: '', source: 'cfo_page', lang: 'sk' }), env());
  assert.equal(res.status, 200);
  assert.equal(calls[1].body.subject, 'Ste na čakacej listine Virtuse CFO · Verdict');
  assert.match(calls[1].body.html, /<html lang="sk">/);
  assert.match(calls[1].body.html, /keď sa otvorí Verdict a bezplatný audit poplatkov/);
  assert.doesNotMatch(calls[1].body.html, /novembra|januára/);
  assert.match(calls[1].body.html, /Prevádzkovateľ: Virtuse Wealth Management/);
  assert.match(calls[1].body.html, /list=cfo/);
  res = await worker.fetch(req({ email: 'c@d.co', hp: '', source: 'cfo_plan', lang: 'xx' }, { ip: '5.6.7.8' }), env());
  assert.equal(res.status, 200);
  assert.equal(calls[3].body.subject, "You're on the Virtuse CFO list");
}));

test('every waitlist language has all texts and its operator line', async () => {
  const { WAITLIST_LANGS, waitlistSubject } = await import('./src/waitlist.js');
  assert.deepEqual([...WAITLIST_LANGS].sort(), ['cs', 'de', 'en', 'es', 'fr', 'hu', 'pl', 'ru', 'sk', 'uk']);
  for (const L of WAITLIST_LANGS) {
    for (const s of ['cfo_page', 'cfo_plan']) {
      const h = renderWaitlistEmail('https://x/leave', s, L);
      assert.match(h, new RegExp(`<html lang="${L}">`));
      assert.match(h, /Virtuse Wealth Management, a\.s\./);
      assert.doesNotMatch(h, /undefined/);
      assert.ok(waitlistSubject(s, L).length > 10);
    }
  }
});

test('verdict_report: own audience when set, else the CFO audience, report email', withFetch(async (calls) => {
  let res = await worker.fetch(req({ email: 'r@b.co', hp: '', source: 'verdict_report', lang: 'sk' }), env({ RESEND_REPORT_AUDIENCE_ID: 'aud-rep' }));
  assert.equal(res.status, 200);
  assert.equal(calls[0].url, 'https://api.resend.com/audiences/aud-rep/contacts');
  assert.equal(calls[1].body.subject, 'Ste na zozname pre celý report Verdict');
  assert.match(calls[1].body.html, /14 € jednorazovo/);
  assert.match(calls[1].body.html, /neuložili/);
  res = await worker.fetch(req({ email: 's@b.co', hp: '', source: 'verdict_report' }, { ip: '5.5.5.5' }), env());
  assert.equal(calls[2].url, 'https://api.resend.com/audiences/aud-cfo/contacts');
  assert.match(calls[3].body.subject, /full Verdict report/);
}));

test('every waitlist language has the report email', async () => {
  const { WAITLIST_LANGS, waitlistSubject } = await import('./src/waitlist.js');
  for (const L of WAITLIST_LANGS) {
    const h = renderWaitlistEmail('https://x/leave', 'verdict_report', L);
    assert.doesNotMatch(h, /undefined/);
    assert.match(h, /14/);
    assert.ok(waitlistSubject('verdict_report', L).length > 10);
  }
});

test('staging dry run: a valid sign-up answers ok and nothing is sent', withFetch(async (calls) => {
  const res = await worker.fetch(req({ email: 'a@b.co', hp: '', source: 'cfo_page' }), env({ WAITLIST_DRY_RUN: '1' }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, dryRun: true });
  assert.equal(calls.length, 0);
  const bad = await worker.fetch(req({ email: 'nope', hp: '', source: 'cfo_page' }), env({ WAITLIST_DRY_RUN: '1' }));
  assert.equal(bad.status, 400);
}));
