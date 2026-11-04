// Verdict Lite paid report: rules parity with the browser, the view, checkout, webhook, report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/index.js';
import { stripeSignature } from '../src/infra/stripe.js';
import { REPORT_WINDOW_MS } from '../src/features/verdict-pay/domain.js';
import { renderReportPdf } from '../src/features/verdict-pay/pdf.js';
import { calc, gapIds, grade, validateAnswers } from '../src/features/verdict-lite/rules.js';
import { liteReportView } from '../src/features/verdict-lite/report.js';
import { INTER_BOLD, INTER_REGULAR } from '../src/generated/fonts.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ANNA = { name: 'Anna', age: 41, country: 'sk', savings: 150000, pension: 40000, retire: 65, retmonthly: 150, reserve: '3_6', home: 'mortgage', homeval: 250000, mortbal: 140000, debt: 'none', experience: 'new', btc: 20000, monthly: 200, custody: 'self', fall: 'wait', worries: ['tax', 'keys'], tax_known: 'roughly' };
const WHSEC = 'whsec_test_secret';
const SID = 'cs_test_a1B2c3D4e5F6g7H8';
const ORIGIN = 'https://staging.virtuse.com';

const check = (a) => { const r = validateAnswers(a); assert.ok(r.ok, JSON.stringify(r)); return r.value; };

function grid() {
  const out = [];
  for (const savings of [0, 150000]) for (const btc of [0, 5000, 20000, 60000, 200000]) for (const reserve of ['lt1', '1_3', '3_6', '6p'])
    for (const debt of ['none', 'lt10', 'gt10']) for (const custody of ['self', 'assisted', 'any']) for (const fall of ['sell', 'wait', 'more'])
      for (const [home, homeval, mortbal] of [['rent', null, null], ['own', 250000, null], ['mortgage', 250000, 240000], ['mortgage', 250000, 100000]])
        for (const [age, retire] of [[41, 65], [60, 65]]) for (const tax_known of ['yes', 'no']) for (const experience of ['new', 'hodler'])
          for (const worries of [[], ['tax', 'keys', 'crash'], ['heirs', 'scams', 'retire']])
            out.push({ ...ANNA, savings, btc, reserve, debt, custody, fall, home, homeval, mortbal, age, retire, tax_known, experience, worries });
  return out;
}

// The browser's own calc(), grade() and gaps(), lifted out of verdict-lite.js.
function browserRules() {
  const src = readFileSync(path.join(HERE, '..', '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners', 'verdict-lite.js'), 'utf8');
  const fn = (name) => {
    const start = src.indexOf(`function ${name}(`);
    assert.ok(start > 0, name);
    let depth = 0;
    for (let i = src.indexOf('{', start); ; i++) {
      if (src[i] === '{') depth++;
      if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
    }
  };
  return new Function('A', 'S', `${fn('calc')}\n${fn('grade')}\n${fn('gaps')}\nreturn { calc, grade, gaps };`);
}

test('the report uses exactly the browser score, grade and gaps', () => {
  const make = browserRules();
  const S = { G: new Proxy({}, { get: (_, id) => [id, () => ''] }) };
  const answers = grid();
  assert.ok(answers.length > 10000);
  for (const a of answers) {
    const b = make(a, S);
    const bc = b.calc();
    const v = check(a);
    const c = calc(v);
    assert.equal(c.total, bc.total);
    assert.deepEqual(c.sc, bc.sc);
    assert.equal(grade(c.total), b.grade(bc.total));
    assert.deepEqual(gapIds(v, c), b.gaps(bc).map((g) => g[2]));
  }
});

test('validateAnswers drops the unknown and refuses the bad', () => {
  const v = check({ ...ANNA, name: ' <b>Anna</b> ', email: 'x@y.z', extra: 'nope', worries: ['tax', 'evil'] });
  assert.equal(v.name, 'bAnna/b');
  assert.equal(v.email, undefined);
  assert.equal(v.extra, undefined);
  assert.deepEqual(v.worries, ['tax']);
  for (const bad of [null, [], { ...ANNA, country: 'xx' }, { ...ANNA, savings: -1 }, { ...ANNA, btc: 'lots' }, { ...ANNA, age: 500 }, { ...ANNA, btc: null }, { ...ANNA, mortbal: null }]) {
    assert.equal(validateAnswers(bad).ok, false);
  }
});

test('the Anna report matches the published sample', () => {
  const r = liteReportView(check(ANNA), 'en');
  assert.equal(r.score, 75);
  assert.equal(r.grade, 'B');
  assert.deepEqual(r.areas.map((a) => a.points), [7, 7, 10, 6, 6, 10]);
  assert.deepEqual(r.nums[1], ['Planned for Bitcoin', '€20,000 · 13%']);
  assert.deepEqual(r.nums[2], ['After a 70% fall', '€6,000 left']);
  assert.match(r.summary[0], /^Anna, your plan has a sound size\./);
  assert.equal(r.steps.length, 3);
  assert.ok(r.tax.rows.some(([, v]) => /19 to 35%/.test(v)));
  const sk = liteReportView(check(ANNA), 'sk');
  assert.equal(sk.title, 'Plán Bitcoinu: Anna');
  assert.equal(sk.nums[1][1], '20 000 € · 13 %');
  assert.ok(sk.tax.rows.some(([, v]) => /19 až 35 %/.test(v)));
  assert.match(sk.next[0].href, /^\/sk\/tax-agent\.html\?country=sk$/);
});

test('every answer combination renders complete text, without advice wording', () => {
  const advice = /\b(you should buy|buy now|sell now|we recommend|recommended|best partner)\b|odporúčame|kúpte|predajte/i;
  const sample = grid().filter((_, i) => i % 7 === 0);
  for (const a of sample) for (const lang of ['en', 'sk']) {
    const r = liteReportView(check(a), lang);
    const text = JSON.stringify(r);
    assert.doesNotMatch(text, /undefined|NaN|null,"text"|\[object/, text.slice(0, 200));
    assert.doesNotMatch(text, advice);
    assert.doesNotMatch(text, /—/);
    assert.equal(r.steps.length, 3);
    assert.ok(r.risks.length >= 1 && r.risks.length <= 3);
    assert.ok(r.solid.length <= 3);
  }
});

test('every country has its sale rule; another country gets the adviser note', () => {
  for (const country of ['sk', 'cz', 'at', 'de', 'pl', 'hu', 'si', 'hr', 'ro', 'bg', 'nl', 'fr', 'es']) for (const lang of ['en', 'sk']) {
    const r = liteReportView(check({ ...ANNA, country }), lang);
    assert.ok(r.tax.rows.length >= 2, country);
    assert.match(r.tax.note, /Q\d 20\d\d/);
    assert.ok(r.steps[0].tool || r.steps[1].tool);
  }
  const other = liteReportView(check({ ...ANNA, country: 'other' }), 'en');
  assert.equal(other.tax.rows.length, 0);
  assert.match(other.tax.text, /tax adviser/);
  assert.doesNotMatch(other.next[1].href, /pf_country/);
  assert.match(liteReportView(check({ ...ANNA, country: 'nl' }), 'en').h.taxK, /the Netherlands/);
});

test('the PDF renders in both languages, with a long name and every section', async () => {
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const fonts = { regular: b64(INTER_REGULAR), bold: b64(INTER_BOLD) };
  for (const lang of ['en', 'sk']) {
    const pdf = await renderReportPdf(liteReportView(check({ ...ANNA, name: 'Žofia-Alžbeta Ďurčanská', country: 'other' }), lang), { lang, fonts, date: new Date(0), order: 'ABC', operator: 'Operator line' });
    assert.ok(pdf.length > 5000);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), '%PDF-');
  }
});

// Worker routes
function mockKv() {
  const store = new Map();
  return { store, async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); } };
}
const env = (extra = {}) => ({
  RATE_LIMIT_KV: mockKv(), VERDICT_PAYMENTS: '1', STRIPE_TEST_ONLY: '1', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_PRICE_ID_VERDICT: 'price_123',
  RESEND_API_KEY: 're_x', RESEND_SEND_FROM: 'Virtuse <plan@virtuse.com>', ...extra,
});
const post = (p, body, ip = '1.2.3.4') => new Request(`https://w.example${p}`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(body) });

function mockApis(stripe = {}) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.startsWith('https://api.stripe.com/')) {
      const r = stripe.handler ? stripe.handler(u, init) : { status: 200, body: { id: SID, url: `https://checkout.stripe.com/c/pay/${SID}` } };
      return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ id: 'em_1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}
const session = (rid, extra = {}) => ({ id: SID, object: 'checkout.session', payment_status: 'paid', metadata: { product: 'verdict_report', rid, lang: 'sk' }, amount_total: 1400, currency: 'eur', payment_intent: 'pi_1', livemode: false, customer_details: { email: 'buyer@example.com' }, ...extra });

async function webhook(e, obj, type = 'checkout.session.completed') {
  const payload = JSON.stringify({ type, data: { object: obj } });
  const t = Math.floor(Date.now() / 1000);
  const v1 = await stripeSignature(WHSEC, t, payload);
  return worker.fetch(new Request('https://w.example/verdict/stripe-webhook', { method: 'POST', headers: { 'Stripe-Signature': `t=${t},v1=${v1}` }, body: payload }), e);
}

test('checkout stores the answers without the email and opens a short Stripe session', async () => {
  const api = mockApis();
  try {
    const e = env();
    const res = await worker.fetch(post('/verdict/checkout', { answers: { ...ANNA, email: 'buyer@example.com' }, lang: 'sk', email: 'buyer@example.com' }), e);
    assert.equal(res.status, 200);
    assert.match((await res.json()).url, /^https:\/\/checkout\.stripe\.com/);
    const key = [...e.RATE_LIMIT_KV.store.keys()].find((k) => k.startsWith('verdict:res:'));
    const stored = JSON.parse(e.RATE_LIMIT_KV.store.get(key));
    assert.equal(stored.lite, true);
    assert.equal(stored.lang, 'sk');
    assert.doesNotMatch(JSON.stringify(stored), /buyer@example/);
    const form = new URLSearchParams(api.calls[0].init.body);
    assert.equal(form.get('customer_email'), 'buyer@example.com');
    assert.equal(form.get('metadata[lang]'), 'sk');
    assert.equal(form.get('metadata[rid]'), key.split(':')[2]);
    assert.match(form.get('success_url'), /\/sk\/verdict\.html\?session_id=/);
    assert.match(form.get('custom_text[submit][message]'), /30 dní/);
    assert.ok(+form.get('expires_at') - Date.now() / 1000 <= 2 * 3600 + 5);
  } finally { api.restore(); }
});

test('checkout: closed payments, bad answers and too many attempts', async () => {
  const api = mockApis();
  try {
    let res = await worker.fetch(post('/verdict/checkout', { answers: ANNA, lang: 'en' }), env({ VERDICT_PAYMENTS: '0' }));
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'closed');
    res = await worker.fetch(post('/verdict/checkout', { answers: { ...ANNA, reserve: 'x' }, lang: 'en' }), env());
    assert.equal(res.status, 400);
    const e = env();
    for (let i = 0; i < 20; i++) assert.equal((await worker.fetch(post('/verdict/checkout', { answers: ANNA, lang: 'en' }, '9.9.9.9'), e)).status, 200);
    assert.equal((await worker.fetch(post('/verdict/checkout', { answers: ANNA, lang: 'en' }, '9.9.9.9'), e)).status, 429);
  } finally { api.restore(); }
});

test('paid: the webhook emails the PDF once, the report opens, then closes after 30 minutes', async () => {
  const rid = 'a'.repeat(32);
  const api = mockApis({ handler: () => ({ status: 404, body: {} }) });
  try {
    const e = env();
    await e.RATE_LIMIT_KV.put(`verdict:res:${rid}`, JSON.stringify({ lite: true, answers: check(ANNA), lang: 'sk' }));
    assert.equal((await webhook(e, session(rid))).status, 200);
    assert.equal((await webhook(e, session(rid))).status, 200);
    const mails = api.calls.filter((c) => c.url.includes('resend.com'));
    assert.equal(mails.length, 1);
    const mail = JSON.parse(mails[0].init.body);
    assert.deepEqual(mail.to, ['buyer@example.com']);
    assert.ok(mail.attachments[0].content.length > 5000);
    assert.match(mail.html, /ako je váš plán pripravený/);

    let res = await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'sk' }), e);
    assert.equal(res.status, 200);
    let body = await res.json();
    assert.equal(body.lite, true);
    assert.equal(body.score, 75);
    assert.equal(body.title, 'Plán Bitcoinu: Anna');
    assert.equal(res.headers.get('X-AI-Generated'), null);
    assert.equal(body.ai_generated, undefined);

    const rec = JSON.parse(e.RATE_LIMIT_KV.store.get(`verdict:paid:${SID}`));
    rec.usedAt = Date.now() - REPORT_WINDOW_MS - 1000;
    await e.RATE_LIMIT_KV.put(`verdict:paid:${SID}`, JSON.stringify(rec));
    res = await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'sk' }), e);
    body = await res.json();
    assert.equal(body.reportUsed, true);
    assert.equal(body.score, undefined);

    e.RATE_LIMIT_KV.store.delete(`verdict:res:${rid}`);
    res = await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'sk' }), e);
    assert.equal(res.status, 410);
    assert.match((await res.json()).error, /e-maile ako PDF/);
  } finally { api.restore(); }
});

test('an unpaid session gets no report', async () => {
  const api = mockApis({ handler: () => ({ status: 200, body: session('a'.repeat(32), { payment_status: 'unpaid' }) }) });
  try {
    const res = await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'en' }), env());
    assert.equal(res.status, 402);
  } finally { api.restore(); }
});
