import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './src/index.js';
import { scoreVerdict, redact, looksLikeAdvice, systemPrompt, costOf, SIGNALS } from './src/verdict.js';

const ORIGIN = 'https://virtuse.com';
const STAGING = 'https://staging.virtuse.com';

function mockKv() {
  const store = new Map();
  return { store, async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); } };
}

function env(extra = {}) {
  return { RATE_LIMIT_KV: mockKv(), ANTHROPIC_API_KEY: 'sk-test', VERDICT_ENABLED: '1', ...extra };
}

function req(body, { origin = ORIGIN, ip = '1.2.3.4' } = {}) {
  return new Request('https://w.example/verdict', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

const POINTS = { worst_case: 3, liquidity: 8, tax: 4, custody: 6, plan_b: 5, goal: 7, horizon: 7, alternatives: 3, rule: 6, asymmetry: 6 };

function modelOut(over = {}) {
  return {
    declined: false, is_loan: false, drawdown_tested: true, tax_rule_wrong: false, country: 'sk',
    signals: SIGNALS.map((s) => ({ id: s.id, points: POINTS[s.id], reason: `Text o ${s.id}.` })),
    missing: ['Aký je váš plán pri poklese o 70 %?'],
    ...over,
  };
}

// Answers like the Messages API: a thinking block, then the JSON text block.
function withClaude(fn, out = modelOut(), { stop = 'end_turn' } = {}) {
  return async () => {
    const calls = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const body = init?.body ? JSON.parse(init.body) : null;
      calls.push({ url: String(url), headers: init?.headers, body });
      return new Response(JSON.stringify({
        id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: stop, stop_sequence: null,
        content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: JSON.stringify(out) }],
        usage: { input_tokens: 3000, output_tokens: 1500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try { await fn(calls); } finally { globalThis.fetch = orig; }
  };
}

test('score is the sum, band and weakest point come from the rubric', () => {
  const r = scoreVerdict(modelOut(), 'sk');
  assert.equal(r.score, 55);
  assert.equal(r.band.id, 'add');
  assert.equal(r.band.label, 'Doplňte 2 až 3 predpoklady');
  // worst_case and alternatives both have 3: priority 1 wins
  assert.equal(r.weakest.id, 'worst_case');
  assert.equal(r.weakest.tool.page, 'stacking.html');
  assert.equal(r.signals.length, 10);
});

test('band thresholds 65 and 50', () => {
  const at = (n) => scoreVerdict(modelOut({ signals: SIGNALS.map((s, i) => ({ id: s.id, points: i < n % 10 ? Math.ceil(n / 10) : Math.floor(n / 10), reason: 'x' })) }), 'en');
  assert.equal(at(65).band.id, 'complete');
  assert.equal(at(64).band.id, 'add');
  assert.equal(at(50).band.id, 'add');
  assert.equal(at(49).band.id, 'missing');
});

test('no 70% test caps worst case at 4; loans point to Loan Copilot', () => {
  const out = modelOut({ drawdown_tested: false, is_loan: true, signals: SIGNALS.map((s) => ({ id: s.id, points: s.id === 'worst_case' ? 9 : 9, reason: 'x' })) });
  const r = scoreVerdict(out, 'en');
  assert.equal(r.signals.find((s) => s.id === 'worst_case').points, 4);
  assert.equal(r.weakest.id, 'worst_case');
  assert.equal(r.weakest.tool.page, 'loan.html');
});

test('a country outside the 13 caps tax at 5 and asks to check with an adviser', () => {
  const r = scoreVerdict(modelOut({ country: 'other', signals: SIGNALS.map((s) => ({ id: s.id, points: 10, reason: 'x' })) }), 'sk');
  assert.equal(r.signals.find((s) => s.id === 'tax').points, 5);
  assert.ok(r.missing.some((m) => /daňovým poradcom/.test(m)));
});

test('a tax rule that contradicts the data is always the weakest point', () => {
  const r = scoreVerdict(modelOut({ tax_rule_wrong: true, signals: SIGNALS.map((s) => ({ id: s.id, points: s.id === 'tax' ? 6 : (s.id === 'worst_case' ? 0 : 8), reason: 'x' })) }), 'sk');
  assert.equal(r.weakest.id, 'tax');
  assert.equal(r.signals.find((s) => s.id === 'tax').points, 2);
  assert.equal(r.weakest.tool.page, 'tax-agent.html');
});

test('points are clamped, missing is capped at 3, wrong signal count throws', () => {
  const r = scoreVerdict(modelOut({ signals: SIGNALS.map((s) => ({ id: s.id, points: 14, reason: 'x' })), missing: ['a', 'b', 'c', 'd'] }), 'en');
  assert.equal(r.score, 100);
  assert.equal(r.missing.length, 3);
  assert.throws(() => scoreVerdict(modelOut({ signals: modelOut().signals.slice(0, 9) }), 'en'));
});

test('every result carries the AI label (AI Act art. 50) and the score note', () => {
  const r = scoreVerdict(modelOut(), 'sk');
  assert.match(r.aiLabel, /umelá inteligencia \(Anthropic\)/);
  assert.match(r.scoreNote, /Rozhodujete vy/);
  assert.match(scoreVerdict({ declined: true }, 'en').aiLabel, /generated by AI/);
});

test('declined returns the fixed sentence and no score', () => {
  const r = scoreVerdict({ declined: true }, 'sk');
  assert.equal(r.declined, true);
  assert.equal(r.score, undefined);
  assert.match(r.message, /nie to, či kupovať alebo predať/);
});

test('advice-like wording is caught in both languages', () => {
  const base = scoreVerdict(modelOut(), 'en');
  assert.equal(looksLikeAdvice(base), false);
  for (const bad of ['Odporúčame kúpiť viac.', 'Mali by ste predať.', 'You should buy now.', 'Kraken is the best choice.', 'Now is the time to act.']) {
    assert.equal(looksLikeAdvice({ ...base, missing: [bad] }), true, bad);
  }
});

test('redaction removes email, IBAN and Bitcoin addresses', () => {
  const t = redact('Mail jan@x.sk, IBAN SK31 1200 0000 1987 4263 7541, adresa bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq.');
  assert.doesNotMatch(t, /jan@x\.sk|1987|bc1q/);
  assert.match(t, /\[email\].*\[iban\].*\[address\]/);
});

test('prompt carries the tax facts and forbids advice', () => {
  const p = systemPrompt('sk');
  assert.match(p, /sk Slovakia: 19 to 35% income tax/);
  assert.match(p, /You never advise/);
  assert.match(p, /Slovak/);
});

test('cost: opus 5.5 at $4/$20 per million', () => {
  assert.equal(Math.round(costOf({ input_tokens: 3000, output_tokens: 1500 }) * 1000) / 1000, 0.042);
});

test('POST /verdict calls Claude once with structured output and returns the result', withClaude(async (calls) => {
  const e = env();
  const res = await worker.fetch(req({ text: 'Každý mesiac kúpim BTC za 100 €, 10 rokov, rezerva 6 mesiacov.', lang: 'sk' }), e);
  assert.equal(res.status, 200);
  const r = await res.json();
  assert.equal(r.score, 55);
  assert.equal(calls.length, 1);
  const b = calls[0].body;
  assert.equal(b.model, 'claude-opus-5-5');
  assert.equal(b.output_config.format.type, 'json_schema');
  assert.equal(b.fallbacks, 'default');
  assert.equal(b.thinking, undefined);
  assert.match(b.messages[0].content, /^<decision>\n/);
  assert.ok([...e.RATE_LIMIT_KV.store.keys()].some((k) => k.startsWith('verdict:spend:')));
}));

test('closed without VERDICT_ENABLED on virtuse.com, open on staging', withClaude(async (calls) => {
  const body = { text: 'I will buy €100 of BTC every month for 10 years.', lang: 'en' };
  let res = await worker.fetch(req(body), env({ VERDICT_ENABLED: undefined }));
  assert.equal(res.status, 503);
  assert.equal(calls.length, 0);
  res = await worker.fetch(req(body, { origin: STAGING }), env({ VERDICT_ENABLED: undefined }));
  assert.equal(res.status, 200);
}));

test('no API key -> 503, short text -> 400, honeypot -> no call', withClaude(async (calls) => {
  assert.equal((await worker.fetch(req({ text: 'I will buy €100 of BTC every month.', lang: 'en' }), env({ ANTHROPIC_API_KEY: undefined }))).status, 503);
  assert.equal((await worker.fetch(req({ text: 'buy?', lang: 'en' }), env())).status, 400);
  assert.equal((await worker.fetch(req({ text: 'I will buy €100 of BTC every month.', hp: 'x' }), env())).status, 200);
  assert.equal(calls.length, 0);
}));

test('10 a day per IP, and the monthly cap stops calls', withClaude(async (calls) => {
  const e = env();
  const body = { text: 'I will buy €100 of BTC every month for 10 years.', lang: 'en' };
  for (let i = 0; i < 10; i++) assert.equal((await worker.fetch(req(body), e)).status, 200);
  assert.equal((await worker.fetch(req(body), e)).status, 429);
  const e2 = env({ VERDICT_MONTHLY_CAP_EUR: '1' });
  e2.RATE_LIMIT_KV.store.set('verdict:spend:' + new Date().toISOString().slice(0, 7), '1.5');
  assert.equal((await worker.fetch(req(body), e2)).status, 429);
  assert.equal(calls.length, 10);
}));

test('advice-like model output is not shown', withClaude(async () => {
  const res = await worker.fetch(req({ text: 'I will buy €100 of BTC every month for 10 years.', lang: 'en' }), env());
  assert.equal(res.status, 502);
}, modelOut({ missing: ['You should buy more now.'] })));

test('refusal stop reason is shown as declined', withClaude(async () => {
  const res = await worker.fetch(req({ text: 'I will buy €100 of BTC every month for 10 years.', lang: 'en' }), env());
  const r = await res.json();
  assert.equal(r.declined, true);
}, modelOut(), { stop: 'refusal' }));

test('other routes are unchanged: /verdict is POST-only behind the origin check', withClaude(async (calls) => {
  const res = await worker.fetch(req({ text: 'I will buy €100 of BTC every month.' }, { origin: 'https://evil.example' }), env());
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
}));
