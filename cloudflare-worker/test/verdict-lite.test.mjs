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
import { SCENARIO, planScenario } from '../src/features/verdict-lite/blocks.js';
import { PARTNERS, custodyPartners, matchingPartners, taxPartners } from '../src/features/verdict-lite/partners.js';
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
  assert.deepEqual(r.nums[1], ['Planned for Bitcoin', '€20,000 · 13% of savings']);
  assert.deepEqual(r.nums[2], ['After a 70% fall', '€6,000 left']);
  assert.match(r.summary[0], /^Anna, your plan has a sound size\./);
  assert.equal(r.steps.length, 3);
  assert.ok(r.tax.rows.some(([, v]) => /19 to 35%/.test(v)));
  const sk = liteReportView(check(ANNA), 'sk');
  assert.equal(sk.title, 'Plán Bitcoinu: Anna');
  assert.equal(sk.nums[1][1], '20 000 € · 13 % úspor');
  assert.ok(sk.tax.rows.some(([, v]) => /19 až 35 %/.test(v)));
  assert.match(sk.next[0].href, /^\/sk\/tax-agent\.html\?country=sk$/);
});

test('area map: the groups and questions promised on the Verdict pages', () => {
  for (const [lang, file] of [['en', 'verdict.html'], ['sk', 'sk/verdict.html']]) {
    const html = readFileSync(path.join(HERE, '..', '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners', ...file.split('/')), 'utf8');
    const r = liteReportView(check(ANNA), lang);
    for (const a of r.areas) { assert.ok(html.includes(a.q), a.q); assert.ok(html.includes(`<b>${a.title}</b>`), a.title); }
    for (const g of r.areaMap.groups) { assert.ok(html.includes(g.k), g.k); assert.ok(html.includes(g.h), g.h); }
    assert.ok(html.includes(r.areaMap.how), 'how');
    assert.ok(readFileSync(path.join(HERE, '..', '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners', 'verdict-lite.js'), 'utf8').includes(r.areaMap.how), 'how on the free map');
    // The areas add up to the total: sum out of 60, converted to 100, rounded to 5.
    const pts = r.areas.reduce((n, a) => n + a.points, 0);
    assert.equal(r.score, Math.round(((pts / 60) * 100) / 5) * 5);
    assert.ok(r.areaMap.sum.includes(`${pts} `) && r.areaMap.sum.includes(`${r.score} `));
    assert.ok(r.gradeLine.includes(String(pts)));
    assert.equal(r.scaleRange.length, r.scale.length);
    assert.deepEqual(r.areas.filter((a) => a.weak).map((a) => a.id), ['tax']);
  }
  assert.equal(liteReportView(check({ ...ANNA, savings: 1000000, reserve: '6p', tax_known: 'yes', custody: 'self', experience: 'hodler' }), 'en').areas.filter((a) => a.weak).length, 1);
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
    const form = new URLSearchParams(api.calls.find((c) => c.init.method === 'POST').init.body);
    assert.equal(form.get('customer_email'), 'buyer@example.com');
    assert.equal(form.get('metadata[lang]'), 'sk');
    assert.equal(form.get('metadata[rid]'), key.split(':')[2]);
    assert.match(form.get('success_url'), /\/sk\/verdict\.html\?session_id=/);
    assert.match(form.get('custom_text[submit][message]'), /30 dní/);
    assert.ok(+form.get('expires_at') - Date.now() / 1000 <= 2 * 3600 + 5);
  } finally { api.restore(); }
});

test('checkout: the SK page uses its own Price when set, else the EN Price; EN never changes', async () => {
  const api = mockApis();
  const priceOf = () => new URLSearchParams(api.calls.filter((c) => c.init.method === 'POST').pop().init.body).get('line_items[0][price]');
  try {
    let n = 0;
    const call = (lang, e) => worker.fetch(post('/verdict/checkout', { answers: ANNA, lang }, `6.6.6.${++n}`), e);
    assert.equal((await call('sk', env({ STRIPE_PRICE_ID_VERDICT_SK: 'price_sk' }))).status, 200);
    assert.equal(priceOf(), 'price_sk');
    await call('en', env({ STRIPE_PRICE_ID_VERDICT_SK: 'price_sk' }));
    assert.equal(priceOf(), 'price_123');
    await call('sk', env());
    assert.equal(priceOf(), 'price_123');
    assert.ok(!api.calls.some((c) => c.init.method === 'GET'), 'no extra Stripe call');
    assert.ok(!api.calls.some((c) => /price_data/.test(c.init.body || '')), 'no ad-hoc products');
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

    res = await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'sk', format: 'pdf' }), e);
    assert.equal(res.status, 200);
    const dl = await res.json();
    assert.match(dl.filename, /^Virtuse-Verdict-report-\d{8}-[A-Z0-9]+\.pdf$/);
    assert.equal(atob(dl.pdf).slice(0, 5), '%PDF-');

    const rec = JSON.parse(e.RATE_LIMIT_KV.store.get(`verdict:paid:${SID}`));
    rec.usedAt = Date.now() - REPORT_WINDOW_MS - 1000;
    await e.RATE_LIMIT_KV.put(`verdict:paid:${SID}`, JSON.stringify(rec));
    res = await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'sk' }), e);
    body = await res.json();
    assert.equal(body.reportUsed, true);
    assert.equal(body.score, undefined);
    res = await worker.fetch(post('/verdict/report', { session_id: SID, lang: 'sk', format: 'pdf' }), e);
    assert.equal((await res.json()).pdf, undefined);

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

// The concrete blocks
const blocks = (over = {}, lang = 'en', date = new Date('2026-11-04T12:00:00Z')) => liteReportView(check({ ...ANNA, ...over }), lang, date);
// Partners and fees exist only behind VERDICT_REPORT_PARTNERS=1 (hub logic kept for a
// future opinion that covers them); the tests below check that variant.
const withPartners = (over = {}, lang = 'en', date = new Date('2026-11-04T12:00:00Z')) => liteReportView(check({ ...ANNA, ...over }), lang, date, { partners: true });

test('paid report: no fees, partners, Partner Finder tile or referral sentence by default', async () => {
  const fonts = { regular: Uint8Array.from(atob(INTER_REGULAR), (c) => c.charCodeAt(0)), bold: Uint8Array.from(atob(INTER_BOLD), (c) => c.charCodeAt(0)) };
  for (const lang of ['en', 'sk']) for (const custody of ['self', 'assisted', 'any']) {
    const r = blocks({ custody }, lang);
    assert.equal(r.fees, undefined);
    assert.equal(r.partners, undefined);
    assert.ok(!r.next.some((n) => n.id === 'finder'), 'no Partner Finder tile');
    const s = JSON.stringify(r);
    assert.doesNotMatch(s, /referral|províz|sponsored|Partner Finder|Partners that match|Partneri, ktorí|compare the right partners|porovnáte správnych partnerov/i, `${lang} ${custody}`);
    const pdf = await renderReportPdf(r, { lang, fonts, date: new Date(0), order: 'ABC', operator: 'Operator line' });
    assert.ok(pdf.length > 1000);
  }
  for (const [lang, href] of [['en', '/secure.html'], ['sk', '/sk/secure.html']]) {
    const step = blocks({ custody: 'any' }, lang).steps.find((x) => x.id === 'custody');
    assert.equal(step.tool.href, href, `${lang}: custody step links the custody guide`);
  }
  const on = withPartners();
  assert.ok(on.fees && on.partners && on.next.some((n) => n.id === 'finder'));
  assert.match(on.legal, /referral fee/);
  const pdfOn = await renderReportPdf(on, { lang: 'en', fonts, date: new Date(0), order: 'ABC', operator: 'Operator line' });
  assert.ok(pdfOn.length > 1000);
});

test('partners: same list as the built Partner Finder, same published facts, alphabetical', () => {
  const src = readFileSync(path.join(HERE, '..', '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners', 'pf-recommend.js'), 'utf8');
  const PF = new Function(`${src};return VBPartners;`)();
  for (const experience of ['new', 'hodler', 'sceptic']) for (const custody of ['self', 'assisted', 'any']) for (const btc of [500, 5000, 50000, 500000]) {
    const amount = btc < 1000 ? 's' : btc < 10000 ? 'm' : btc < 100000 ? 'l' : 'xl';
    const want = PF.recommend({ goal: 'buy', country: 'sk', experience: experience === 'hodler' ? 'hodler' : 'new', custody, amount }, 'en').map((x) => x.partner.id).sort();
    const ours = matchingPartners({ experience, custody, btc });
    assert.deepEqual([...ours].sort(), want, `${experience} ${custody} ${btc}`);
    const groups = withPartners({ experience, custody, btc }).partners.groups;
    assert.deepEqual(groups.map((g) => g.id), ['buy', 'custody', 'tax', 'heirs']);
    for (const g of groups) {
      const list = g.list.map((p) => p.name);
      assert.deepEqual(list, [...list].sort((x, y) => x.localeCompare(y, 'en')));
    }
    const wantCustody = PF.recommend({ goal: 'custody', country: 'sk', experience: experience === 'hodler' ? 'hodler' : 'new', custody, amount }, 'en').map((x) => x.partner.id).sort();
    assert.deepEqual([...custodyPartners({ experience })].sort(), wantCustody);
  }
  for (const country of ['sk', 'cz', 'de', 'at', 'nl', 'es', 'fr', 'other']) {
    const want = PF.recommend({ goal: 'tax', country, experience: 'new', custody: 'any', amount: 'm' }, 'en').map((x) => x.partner.id).sort();
    assert.deepEqual([...taxPartners({ country })].sort(), want, country);
  }
  for (const [id, p] of Object.entries(PARTNERS)) {
    const pf = PF.PARTNERS.find((x) => x.id === id);
    assert.equal(p.url, pf.url, id);
    assert.equal(p.name, pf.name, id);
    assert.equal(p.en.tagline, pf.tagline.en, id);
    assert.equal(p.sk.tagline, pf.tagline.sk, id);
    if (pf.feeNote) { assert.equal(p.en.fee, pf.feeNote.en, id); assert.equal(p.sk.fee, pf.feeNote.sk, id); }
  }
});

test('partners: fixed wording, tracked links, translated steps', () => {
  for (const lang of ['en', 'sk']) for (const custody of ['self', 'assisted', 'any']) for (const experience of ['new', 'hodler']) for (const btc of [500, 50000]) {
    const { partners } = withPartners({ custody, experience, btc }, lang);
    for (const g of partners.groups) {
      assert.ok(g.list.length > 0 || g.empty, g.id);
      assert.ok(g.links.length > 0, g.id);
      for (const p of g.list) {
        assert.ok(p.facts.length >= 1, p.id);
        assert.match(p.href, /utm_source=verdict&utm_medium=report/);
        // First steps wait for approval in data/partner-checklists.json; none is approved yet.
        assert.equal(p.steps.length, 0, p.id);
        assert.equal(p.stepsNote, '', p.id);
      }
    }
    assert.doesNotMatch(JSON.stringify(partners), /match score|best|top pick|najlepš/i);
  }
});

test('falls, reserve and whole picture are plain arithmetic on the answers', () => {
  const r = blocks();
  assert.deepEqual(r.fallTable.rows[0], ['2021–2022', '−73%', '€5,400', '29']);
  assert.deepEqual(r.fallTable.rows[2], ['2013–2015', '−81%', '€3,800', '39']);
  assert.deepEqual(r.worth.rows.at(-1), ['Planned for Bitcoin', '€20,000 · 7% of the total']);
  assert.deepEqual(r.worth.rows.at(-2), ['Total', '€300,000']);
  assert.match(r.worth.note, /Of your savings alone it is 13%/);
  assert.match(r.reserveBox.text, /did not give/);
  assert.match(blocks({ expenses: 2000 }).reserveBox.text, /6 months is €12,000.*€6,000 to €12,000.*up to €6,000/);
  assert.match(blocks({ expenses: 2000, reserve: '6p' }).reserveBox.text, /target is met/);
  assert.match(blocks({ expenses: 2000, reserve: 'lt1' }).reserveBox.text, /under €2,000/);
  assert.deepEqual(r.retireBox.rows.at(-1), ['Retirement savings together, without returns', '€83,200']);
  assert.deepEqual(r.retireBox.plan.rows, [['Planned for Bitcoin', '€20,000'], ['Added at €200 a month, 288 months', '€57,600']]);
  assert.equal(r.retireBox.plan.value, '€77,600');
  assert.match(r.retireBox.plan.scenario.sub, /not a forecast/);
  assert.match(r.retireBox.plan.scenario.vals[0][0], /first day at 65/);
  assert.equal(blocks({ btc: 0, monthly: null }).retireBox.plan, null);
  for (const lang of ['en', 'sk']) assert.doesNotMatch(JSON.stringify(withPartners({ custody: 'assisted' }, lang).partners) + JSON.stringify(blocks({ custody: 'assisted' }, lang).docs), /with help|s pomocou/);
  assert.equal(blocks({ btc: 0 }).fallTable, null);
  assert.equal(blocks({ savings: 0, pension: null, home: 'rent' }).worth, null);
});

test('scenario: the same math as the Retirement Calculator, inflation on top', () => {
  const src = readFileSync(path.join(HERE, '..', '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners', 'retirement-calc.js'), 'utf8');
  const math = src.slice(src.indexOf('function simulate'), src.indexOf('var NEEDED_CAP'));
  const sim = new Function(`${math}\nreturn simulate;`)();
  for (const [btc, monthly, age, retire] of [[500000, 300, 53, 65], [20000, 200, 41, 65], [0, 100, 30, 31], [1000, 0, 60, 70]]) {
    const years = retire - age;
    const s = planScenario({ btc, monthly }, years);
    const r = sim(btc / 100, { age, retAge: retire, life: 100, dca: monthly, spend: 0, growth: SCENARIO.growth, inflation: SCENARIO.inflation, price: 100 });
    assert.ok(Math.abs(s.nominal - r.valueAtRet) < 0.01, `${btc} ${monthly}`);
    assert.ok(Math.abs(s.real - s.nominal / 1.04 ** years) < 1e-6);
    assert.equal(s.paid, btc + monthly * 12 * years);
  }
  assert.equal(planScenario({ btc: 0, monthly: 0 }, 10), null);
  assert.equal(planScenario({ btc: 1000 }, 0), null);
  assert.equal(planScenario({ btc: 1000 }, null), null);
});

test('tax example: 5% sale in the scenario, by country', () => {
  const A = { btc: 500000, monthly: 300, age: 53, retire: 65 };
  const s = planScenario(A, 12);
  const sale = s.nominal * 0.05;
  const gain = sale - s.paid * 0.05;
  const sk = blocks({ ...A, country: 'sk' }, 'sk').taxExample;
  assert.match(sk.title, /predaj 5 %/);
  assert.match(sk.title, /vo veku 65 rokov/);
  const skTax = 43983.32 * 0.19 + (60349.21 - 43983.32) * 0.25 + (75010.32 - 60349.21) * 0.3 + (gain - 75010.32) * 0.35;
  const nb = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const digits = (t) => +String(t).replace(/\D/g, '');
  const row = (re) => sk.after.find((x) => re.test(x[0]));
  // Printed lines add up: value, 5% of it, cost, gain, tax per band, levy, total, left.
  const kv = Object.fromEntries(sk.kv.map((x) => [x[0], digits(x[1])]));
  const [worth, sold, paid, profit] = Object.values(kv);
  assert.equal(sold, Math.round(worth * 0.05));
  assert.equal(profit, sold - paid);
  assert.ok(sk.kv[3][3].includes('−'), 'the gain shows its sum');
  assert.ok(Math.abs(profit - gain) <= 1 && Math.abs(sold - sale) <= 1);
  const lines = sk.bands.rows.map((x) => digits(x[3]));
  const taxSum = lines.reduce((a, b) => a + b, 0);
  assert.equal(sk.bands.rows.length, 4);
  assert.equal(digits(sk.bands.foot[3]), taxSum);
  assert.ok(Math.abs(taxSum - skTax) <= 3);
  assert.ok(Math.abs(sk.bands.rows.reduce((a, x) => a + digits(x[1]), 0) - profit) <= 2);
  assert.match(sk.bands.rows[0][0], /^do /);
  assert.match(sk.bands.rows[1][0], / až /);
  assert.match(sk.bands.rows[3][0], /^nad /);
  // Signed tax review: the 16% levy cannot be confirmed for someone on a pension, so it is named, not computed.
  assert.equal(row(/Zdravotné/), undefined);
  assert.match(sk.note, /Zdravotné odvody nie sú započítané/);
  assert.equal(digits(sk.hero.vals[0][1]), taxSum);
  assert.equal(digits(sk.hero.vals[1][1]), sold - taxSum);
  assert.equal(digits(row(/Z predaja/)[1]), sold - taxSum);
  assert.match(sk.hero.sub, /zo zisku/);
  assert.match(sk.dates.at(-1), new RegExp(`roku ${new Date().getFullYear() + 12} .*31\\. marca ${new Date().getFullYear() + 13}`));
  // A small gain stays in the first band.
  const small = blocks({ btc: 1000, monthly: 0, age: 60, retire: 61, country: 'sk' }, 'sk').taxExample;
  assert.equal(small.kv.filter((x) => /^Daň \d/.test(x[0])).length, 1);
  // The bands it does not reach are named, so "19 to 35%" has its thresholds.
  assert.match(small.scale, /^25\u00a0% platí pre časť zisku nad 43\u00a0983\u00a0€, 30\u00a0% nad 60\u00a0349\u00a0€ a 35\u00a0% nad 75\u00a0010\u00a0€\.$/);
  assert.equal(sk.scale, undefined, 'every band is already in the table');
  assert.match(blocks({ btc: 1000, monthly: 0, age: 60, retire: 61, country: 'sk' }).taxExample.scale, /^25% applies to the part of the gain over €43,983, 30% over €60,349 and 35% over €75,010\.$/);
  // Flat rate, one line.
  const at = blocks({ ...A, country: 'at' }).taxExample;
  assert.match(at.kv[4][0], /Tax at 27.5% on/);
  assert.equal(at.head.length, 0);
  // Holding period reached: exempt, sale kept in full.
  for (const country of ['cz', 'de', 'hr']) {
    const e = blocks({ ...A, country }).taxExample;
    assert.match(e.text, /exempt/, country);
    assert.equal(e.hero.vals[0][1], '€0', country);
  }
  // Holding period not reached, range: each rate.
  const cz = blocks({ btc: 1000, monthly: 0, age: 60, retire: 62, country: 'cz' }).taxExample;
  assert.deepEqual(cz.rows.map((x) => x[0]), ['15%', '23%']);
  assert.match(cz.dates[0], /3-year holding period/);
  assert.equal(blocks({ btc: 1000, age: 60, retire: 60, country: 'de' }).taxExample.rows[0][0], 'up to 45%');
  assert.match(blocks({ ...A, country: 'hr' }, 'sk').taxExample.dates[0], /2 roky/);
  // No plan or no years: the worked example on a fixed gain.
  const fix = blocks({ btc: 0, monthly: null, country: 'sk' }).taxExample;
  assert.match(fix.title, /€10,000 gain/);
  assert.equal(fix.kv[0][1], '€1,900');
  assert.equal(blocks({ country: 'si' }).taxExample.kv.length, 0);
  assert.equal(blocks({ country: 'nl' }).taxExample.rows.length, 0);
  assert.equal(blocks({ country: 'other' }).taxExample, null);
});

test('fees: published rates on the amounts, alphabetical, no winner', () => {
  const f = withPartners().fees;
  assert.deepEqual(f.head.slice(2), ['One purchase of €20,000', '€200 a month: fee per year']);
  assert.deepEqual(f.rows.map((x) => x[0]), ['21bitcoin', 'Bybit EU', 'Kraken']);
  assert.match(f.rows[0][2], /€0 on Auto-Invest from day 8; €198 at 0\.99%/);
  assert.deepEqual(f.rows[1].slice(2), ['€50', '€6']);
  assert.deepEqual(f.rows[2].slice(2), ['€160', '€19']);
  assert.match(f.note, /not a ranking/);
  assert.match(f.note, /Outside your criteria, for comparison only: Kraken\./);
  // Every partner that matches has a row; a fee kept for comparison says so.
  const hod = withPartners({ experience: 'hodler', custody: 'assisted', btc: 500000 }).fees;
  assert.deepEqual(hod.rows.map((x) => x[0]), ['21bitcoin', 'Bybit EU', 'Invity', 'Kraken']);
  assert.match(hod.rows[0][1], /for comparison only/);
  assert.equal(hod.rows[2][2], "on the partner's site");
  assert.doesNotMatch(hod.rows[3][1], /comparison/);
  assert.match(hod.note, /Outside your criteria, for comparison only: 21bitcoin\./);
  assert.equal(withPartners({ btc: 0, monthly: null }).fees, null);
  assert.equal(withPartners({ monthly: null }).fees.head.length, 3);
});

test('documents: the buyer writes the rule, the letter never asks for the phrase', () => {
  const d = blocks({}, 'sk').docs;
  assert.deepEqual(d.rule.rows[2].slice(0, 2), ['−70 %', '6 000 €']);
  assert.equal(d.rule.rows[2][2], '');
  assert.equal(d.record.columns.length, 7);
  assert.match(d.heirs.warn, /nikdy nepíšte frázu na obnovu/);
  assert.deepEqual(d.heirs.filled[0], ['Krajina, kde platím dane', 'Slovensko']);
  assert.match(blocks({ custody: 'assisted' }).docs.recovery.title, /provider/);
});

test('the bigger PDF still renders, with and without every optional answer', async () => {
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const fonts = { regular: b64(INTER_REGULAR), bold: b64(INTER_BOLD) };
  for (const a of [{ expenses: 2000 }, { country: 'other', custody: 'any', experience: 'hodler', btc: 500000 }, { btc: 0, monthly: null, pension: null, retmonthly: null, home: 'rent', homeval: null, mortbal: null, savings: 0 }, { country: 'nl', custody: 'assisted' }]) for (const lang of ['en', 'sk']) {
    const pdf = await renderReportPdf(blocks(a, lang), { lang, fonts, date: new Date(0), order: 'X', operator: 'Op' });
    assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), '%PDF-');
  }
});

test('signed tax review: Spain has no worked figures and no bands in the report', () => {
  const es = liteReportView(check({ ...ANNA, country: 'es' }), 'en');
  assert.match(es.taxExample.text, /no worked figures/);
  assert.equal(es.taxExample.hero, undefined);
  assert.doesNotMatch(JSON.stringify(es.tax), /19|30\s?%/);
  const sk = liteReportView(check({ ...ANNA, country: 'es' }), 'sk');
  assert.match(sk.taxExample.text, /neuvádza prepočet/);
});

test('the +20% scenario says it is an assumption and carries the MiCA warning, in both languages', () => {
  const en = JSON.stringify(liteReportView(check({ ...ANNA, country: 'at' }), 'en'));
  assert.match(en, /not covered by deposit guarantee or investor compensation schemes/);
  assert.match(en, /\+20% is an assumption and not a forecast by Virtuse/);
  const sk = JSON.stringify(liteReportView(check({ ...ANNA, country: 'at' }), 'sk'));
  assert.match(sk, /nie sú kryté systémom ochrany vkladov/);
  assert.match(sk, /\+20 % je predpoklad, nie predpoveď Virtuse/);
});
