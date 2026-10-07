import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './src/index.js';
import { PARTNERS, validatePayload, renderSendEmail } from './src/send.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_PARTNERS = JSON.parse(
  readFileSync(path.join(HERE, '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners', 'data', 'partners.json'), 'utf8')
).partners;
const ORIGIN = 'https://virtuse.com';

const PLAN = { goal: 'buy', country: 'sk', experience: 'new', custody: 'any', amount: 'm', partners: ['21bitcoin', 'kraken'] };
const STACKING = {
  initial: 500, contribution: 100, frequency: 'monthly', years: 10, returnPct: 20,
  invested: 12500, projected: 48123.4, lowestFeePartner: '21bitcoin',
};
const LOAN = {
  cashNeeded: 20000, btcPrice: 90000, ltvPct: 40, aprPct: 12.5, years: 2,
  taxIfSold: 3800, interestTotal: 5000, collateralBtc: 0.5556, liquidationPrice: 63000,
};

function mockKv() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
  };
}

function env() {
  return {
    RATE_LIMIT_KV: mockKv(),
    RESEND_API_KEY: 'k',
    RESEND_FROM_EMAIL: 'Virtuse <brief@virtuse.com>',
    RESEND_SEGMENT_ID: 'seg',
    UNSUB_SECRET: 's',
  };
}

function req(body, { origin = ORIGIN, ip = '1.2.3.4' } = {}) {
  return new Request('https://w.example/send', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

function withFetch(fn) {
  return async () => {
    const calls = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
      return new Response('{}', { status: 200 });
    };
    try { await fn(calls); } finally { globalThis.fetch = orig; }
  };
}

test('every partner link host is a partner host in data/partners.json', () => {
  const hosts = new Set(SITE_PARTNERS.flatMap((p) => p.hosts));
  for (const [id, p] of Object.entries(PARTNERS)) {
    const host = new URL(p.url).hostname.replace(/^www\./, '');
    assert.ok(hosts.has(host), `${id}: ${host} not in data/partners.json`);
  }
  assert.equal(Object.keys(PARTNERS).length, SITE_PARTNERS.length);
});

test('plan payload: known ids only, 1-3 partners', () => {
  assert.equal(validatePayload('plan', 'concierge', PLAN).ok, true);
  assert.equal(validatePayload('plan', 'concierge', { ...PLAN, goal: 'yolo' }).ok, false);
  assert.equal(validatePayload('plan', 'concierge', { ...PLAN, partners: ['evil'] }).ok, false);
  assert.equal(validatePayload('plan', 'concierge', { ...PLAN, partners: [] }).ok, false);
  assert.equal(validatePayload('plan', 'concierge', { ...PLAN, partners: ['kraken', 'kraken'] }).ok, false);
  assert.equal(validatePayload('plan', 'concierge', { ...PLAN, partners: ['toString'] }).ok, false);
  assert.equal(validatePayload('plan', 'stacking', PLAN).ok, false);
});

test('result payload: bounded numbers, extra keys dropped', () => {
  const ok = validatePayload('result', 'stacking', { ...STACKING, note: '<a href=x>click</a>' });
  assert.equal(ok.ok, true);
  assert.equal('note' in ok.value, false);
  assert.equal(validatePayload('result', 'stacking', { ...STACKING, years: 999 }).ok, false);
  assert.equal(validatePayload('result', 'stacking', { ...STACKING, projected: '1e9' }).ok, false);
  assert.equal(validatePayload('result', 'loan', LOAN).ok, true);
  assert.equal(validatePayload('result', 'loan', { ...LOAN, ltvPct: NaN }).ok, false);
  assert.equal(validatePayload('result', 'tax', { country: 'de', inheritanceScore: 60 }).ok, true);
  assert.equal(validatePayload('result', 'tax', { country: 'xx', inheritanceScore: 60 }).ok, false);
});

test('plan email: neutral wording, tracked links, language fallbacks', () => {
  const sk = renderSendEmail({ kind: 'plan', source: 'concierge', payload: PLAN, lang: 'sk', brief: false });
  assert.match(sk.subject, /Partner Finder/);
  assert.match(sk.html, /Partneri, ktorí zodpovedajú vašim kritériám/);
  assert.match(sk.html, /https:\/\/virtuse\.com\/sk\/buy-bitcoin\.html\?utm_source=email/);
  assert.match(sk.html, /21bitcoin\.app\.link\/invite\/\?code=VIRTUSE&amp;utm_source=email&amp;utm_medium=plan/);
  assert.doesNotMatch(sk.html, /best|odporúč|recommend/i);

  // German page: English text, German category page.
  const de = renderSendEmail({ kind: 'plan', source: 'concierge', payload: PLAN, lang: 'de', brief: true });
  assert.match(de.html, /Partners matching your criteria/);
  assert.match(de.html, /virtuse\.com\/de\/buy-bitcoin\.html/);
  assert.match(de.html, /Virtuse Brief/);

  const en = renderSendEmail({ kind: 'plan', source: 'concierge', payload: PLAN, lang: 'en', brief: false });
  assert.match(en.html, /https:\/\/virtuse\.com\/buy-bitcoin\.html\?/);
});

test('result emails format numbers per language', () => {
  const cs = renderSendEmail({ kind: 'result', source: 'stacking', payload: STACKING, lang: 'cs', brief: false });
  assert.match(cs.html, /48\s123\s€/);
  assert.match(cs.html, /10 let/);
  assert.match(cs.html, /cs\/stacking\.html/);
  const en = renderSendEmail({ kind: 'result', source: 'loan', payload: LOAN, lang: 'en', brief: false });
  assert.match(en.html, /€63,000/);
  assert.match(en.html, /12\.5%/);
  assert.match(en.html, /0\.5556 BTC/);
  const tax = renderSendEmail({ kind: 'result', source: 'tax', payload: { country: 'de', inheritanceScore: 60 }, lang: 'sk', brief: false });
  assert.match(tax.html, /Nemecko/);
  assert.match(tax.html, /sk\/tax-agent\.html\?country=de/);
  assert.match(tax.html, /nie daňové poradenstvo/);
});

test('POST /send: sends one email, stores nothing without brief', withFetch(async (calls) => {
  const e = env();
  const res = await worker.fetch(req({ email: 'a@b.co', hp: '', lang: 'sk', kind: 'plan', source: 'concierge', payload: PLAN }), e);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.deepEqual(calls[0].body.to, ['a@b.co']);
  assert.equal(calls[0].body.from, 'Virtuse <brief@virtuse.com>');
}));

test('POST /send with brief: email, contact, welcome email', withFetch(async (calls) => {
  const e = env();
  e.RESEND_SEND_FROM = 'Virtuse <plan@virtuse.com>';
  const res = await worker.fetch(req({ email: 'a@b.co', lang: 'cs', kind: 'result', source: 'tax', payload: { country: 'cz', inheritanceScore: 40 }, brief: true }), e);
  assert.equal(res.status, 200);
  assert.deepEqual(calls.map((c) => c.url), ['https://api.resend.com/emails', 'https://api.resend.com/contacts', 'https://api.resend.com/emails']);
  assert.equal(calls[0].body.from, 'Virtuse <plan@virtuse.com>');
  assert.equal(calls[1].body.properties.lang, 'en'); // no cs welcome template yet
}));

test('POST /send rejects bad input before calling Resend', withFetch(async (calls) => {
  const e = env();
  const bad = [
    { email: 'nope', kind: 'plan', source: 'concierge', payload: PLAN },
    { email: 'a@b.co', kind: 'checklist', source: 'concierge', payload: PLAN },
    { email: 'a@b.co', kind: 'plan', source: 'concierge', payload: { ...PLAN, partners: ['x'] } },
  ];
  for (const b of bad) assert.equal((await worker.fetch(req(b), e)).status, 400);
  assert.equal((await worker.fetch(req({ email: 'a@b.co', kind: 'plan', source: 'concierge', payload: PLAN }, { origin: 'https://evil.example' }), e)).status, 403);
  const hp = await worker.fetch(req({ email: 'a@b.co', hp: 'x', kind: 'plan', source: 'concierge', payload: PLAN }), e);
  assert.equal(hp.status, 200);
  assert.equal(calls.length, 0);
}));

test('POST /send: at most 3 per address per hour, across IPs', withFetch(async () => {
  const e = env();
  const body = { email: 'Same@b.co', kind: 'plan', source: 'concierge', payload: PLAN };
  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await worker.fetch(req(body, { ip: `9.9.9.${i}` }), e)).status);
  assert.deepEqual(statuses, [200, 200, 200, 429]);
  assert.ok([...e.RATE_LIMIT_KV.store.keys()].every((k) => !k.includes('@')));
}));
