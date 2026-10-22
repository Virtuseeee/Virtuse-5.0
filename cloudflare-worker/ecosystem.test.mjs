import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.js';
import { renderAutoReply, ECO_LANGS } from './src/ecosystem.js';

const PROD = 'https://virtuse.com';
const STAGING = 'https://staging.virtuse.com';

function mockKv() {
  const store = new Map();
  return { store, async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); } };
}

function env(extra = {}) {
  return { RATE_LIMIT_KV: mockKv(), RESEND_API_KEY: 'k', TURNSTILE_SECRET_KEY: 'ts', ...extra };
}

function app(extra = {}) {
  return {
    project_name: 'Satoshi Shop', website: 'https://example.org', category: 'store-tools',
    description: 'A bitcoin-only checkout for small shops.', countries: ['ALL'], bitcoin_only: true,
    licence: '', repo: 'https://github.com/example/shop', contact_name: 'Ada Muster', contact_email: 'ada@example.org',
    sponsored_interest: 'no', message: '', consent: true, lang: 'sk', turnstile: 'tok', company_url: '', ...extra,
  };
}

function req(body, { origin = PROD, ip = '1.2.3.4', raw } = {}) {
  return new Request('https://w.example/ecosystem-apply', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: raw ?? JSON.stringify(body),
  });
}

// Mocks Turnstile siteverify (success unless captchaOk=false) and Resend.
function withFetch(fn, { captchaOk = true, resendStatus = 200 } = {}) {
  return async () => {
    const calls = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.includes('turnstile')) {
        const f = init.body;
        calls.push({ url: u, secret: f.get('secret'), response: f.get('response'), remoteip: f.get('remoteip') });
        return new Response(JSON.stringify({ success: captchaOk }), { status: 200 });
      }
      calls.push({ url: u, body: JSON.parse(init.body) });
      return new Response('{}', { status: resendStatus });
    };
    try { await fn(calls); } finally { globalThis.fetch = orig; }
  };
}

const resend = (calls) => calls.filter((c) => c.url.includes('resend'));

test('valid application: Turnstile checked, team email + auto-reply sent', withFetch(async (calls) => {
  const res = await worker.fetch(req(app()), env());
  assert.equal(res.status, 200);
  const ts = calls.find((c) => c.url.includes('turnstile'));
  assert.equal(ts.secret, 'ts'); assert.equal(ts.response, 'tok'); assert.equal(ts.remoteip, '1.2.3.4');
  const [team, reply] = resend(calls);
  assert.deepEqual(team.body.to, ['info@virtuse.com']);
  assert.equal(team.body.reply_to, 'ada@example.org');
  assert.equal(team.body.from, 'Virtuse <info@virtuse.com>');
  assert.match(team.body.subject, /^Ecosystem application: Satoshi Shop$/);
  assert.match(team.body.text, /Countries: ALL/);
  assert.deepEqual(reply.body.to, ['ada@example.org']);
  assert.equal(reply.body.reply_to, 'info@virtuse.com');
  assert.equal(reply.body.subject, 'Prijali sme vašu žiadosť: Satoshi Shop');
  assert.match(reply.body.html, /https:\/\/virtuse\.com\/sk\/ecosystem\/promote\/#criteria/);
  assert.match(reply.body.html, /https:\/\/virtuse\.com\/sk\/privacy-policy\.html/);
}));

test('staging: both emails go only to the test inbox, marked [TEST]', withFetch(async (calls) => {
  const res = await worker.fetch(req(app({ lang: 'en' }), { origin: STAGING }), env());
  assert.equal(res.status, 200);
  for (const c of resend(calls)) {
    assert.deepEqual(c.body.to, ['vasilisin@virtuse.com']);
    assert.match(c.body.subject, /^\[TEST\] /);
  }
  assert.equal(resend(calls).length, 2);
}));

test('ECOSYSTEM_TO / ECOSYSTEM_FROM overrides', withFetch(async (calls) => {
  await worker.fetch(req(app()), env({ ECOSYSTEM_TO: 'team@virtuse.com', ECOSYSTEM_FROM: 'Virtuse <listings@virtuse.com>' }));
  const [team, reply] = resend(calls);
  assert.deepEqual(team.body.to, ['team@virtuse.com']);
  assert.equal(reply.body.reply_to, 'team@virtuse.com');
  assert.equal(team.body.from, 'Virtuse <listings@virtuse.com>');
}));

test('failed Turnstile -> 403, nothing sent', withFetch(async (calls) => {
  const res = await worker.fetch(req(app()), env());
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'captcha' });
  assert.equal(resend(calls).length, 0);
}, { captchaOk: false }));

test('missing Turnstile token -> 403 without calling siteverify', withFetch(async (calls) => {
  const res = await worker.fetch(req(app({ turnstile: '' })), env());
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
}));

test('no TURNSTILE_SECRET_KEY -> 503 closed', withFetch(async (calls) => {
  const res = await worker.fetch(req(app()), env({ TURNSTILE_SECRET_KEY: undefined }));
  assert.equal(res.status, 503);
  assert.equal(calls.length, 0);
}));

test('honeypot -> 200, nothing checked or sent', withFetch(async (calls) => {
  const res = await worker.fetch(req(app({ company_url: 'http://spam' })), env());
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
}));

test('validation: required fields, URL, category, countries, flags', withFetch(async (calls) => {
  const bad = [
    { project_name: '' }, { website: 'example.org' }, { repo: 'ftp://x' }, { contact_email: 'nope' },
    { category: 'wallets' }, { countries: [] }, { countries: ['US'] }, { bitcoin_only: false }, { consent: 'yes' },
    { description: 'x'.repeat(301) }, { message: 42 },
  ];
  for (const b of bad) {
    const res = await worker.fetch(req(app(b)), env());
    assert.equal(res.status, 400, JSON.stringify(b));
  }
  assert.equal(calls.length, 0);
}));

test('body over 5 KB -> 413', withFetch(async (calls) => {
  const res = await worker.fetch(req(null, { raw: JSON.stringify(app({ message: 'x'.repeat(6000) })) }), env());
  assert.equal(res.status, 413);
  assert.equal(calls.length, 0);
}));

test('rate limit: 3 per IP per hour, the 4th gets 429', withFetch(async () => {
  const e = env();
  for (let i = 0; i < 3; i++) assert.equal((await worker.fetch(req(app({ contact_email: `a${i}@example.org` })), e)).status, 200);
  assert.equal((await worker.fetch(req(app()), e)).status, 429);
  assert.equal((await worker.fetch(req(app(), { ip: '5.6.7.8' }), e)).status, 200);
}));

test('auto-reply at most once per address per 24 h (team copy always)', withFetch(async (calls) => {
  const e = env();
  await worker.fetch(req(app(), { ip: '1.1.1.1' }), e);
  await worker.fetch(req(app(), { ip: '2.2.2.2' }), e);
  const sent = resend(calls);
  assert.equal(sent.length, 3);
  assert.equal(sent.filter((c) => c.body.to[0] === 'ada@example.org').length, 1);
}));

test('Resend failure -> 502', withFetch(async () => {
  const res = await worker.fetch(req(app()), env());
  assert.equal(res.status, 502);
}, { resendStatus: 500 }));

test('unknown origin -> 403 before anything else', withFetch(async (calls) => {
  const res = await worker.fetch(req(app(), { origin: 'https://evil.example' }), env());
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
}));

test('auto-reply exists for all 10 page languages and escapes user input', () => {
  assert.deepEqual([...ECO_LANGS].sort(), ['cs', 'de', 'en', 'es', 'fr', 'hu', 'pl', 'ru', 'sk', 'uk']);
  for (const lang of ECO_LANGS) {
    const r = renderAutoReply({ ...app({ lang }), project_name: '<b>X</b>', contact_name: 'A & B' }, { test: false });
    assert.ok(r.html.includes('&lt;b&gt;X&lt;/b&gt;'), lang);
    assert.ok(!r.html.includes('{'), lang + ' placeholder left');
    assert.ok(r.text.includes('<b>X</b>'), lang);
  }
});
