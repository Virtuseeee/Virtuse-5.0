// Verdict result v2 (handover verdict-result-v2.md §8): level, 3 steps, plain
// areas, model copy validation with template fallback, B0 contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from './src/index.js';
import {
  scoreVerdict, freeView, reportView, cleanProfile, PROFILE, SIGNALS, BANNED, looksLikeAdvice, systemPrompt,
  AREA_COPY, PARTNER_NAMES, VERBS,
} from './src/verdict.js';
import { startsWithVerb } from './src/verdict-result.js';

const SITE = new URL('../Kimi_Agent_Virtuse%2520MiCA%2520Partners/', import.meta.url);

function out(points, over = {}) {
  return {
    declined: false, is_loan: false, drawdown_tested: false, tax_rule_wrong: false, country: 'sk', summary: '',
    signals: SIGNALS.map((s) => ({ id: s.id, points: points[s.id] ?? 0, reason: `Dôvod ${s.id}.`, only_profile: false, text_evidence: '', fix: '' })),
    missing: ['Aký je váš plán?'],
    ...over,
  };
}

const T1_TEXT = 'Chcem kúpiť Bitcoin za 10 000 € z úspor a držať ho 5 rokov.';
const T1 = { goal: 'buy', country: 'sk', experience: 'new', amount: 'm', share: '5_20', horizon: 'gt4', reserve: 'yes', keys: 'exch', custody_pref: 'any', drop: 'hold', aim: 'grow', tax_known: 'roughly', ruleset: 'no', focus: ['next'] };
const T1_PTS = { worst_case: 4, liquidity: 7, tax: 0, custody: 3, plan_b: 3, goal: 3, horizon: 5, alternatives: 2, rule: 2, asymmetry: 5 };

function t1(over = {}, lang = 'sk', opts = {}) {
  const full = scoreVerdict(out(T1_PTS, over), lang, { text: T1_TEXT, profile: T1 });
  return freeView(full, T1, { lang, taxModule: true, ...opts });
}

test('B0: taxknow is accepted as an alias of tax_known; the tax floor applies', () => {
  assert.deepEqual(cleanProfile({ taxknow: 'roughly' }), { tax_known: 'roughly' });
  assert.deepEqual(cleanProfile({ taxknow: 'no', tax_known: 'yes' }), { tax_known: 'yes' });
  assert.ok(t1().signals.concat([]).length);
  const full = scoreVerdict(out(T1_PTS), 'sk', { text: T1_TEXT, profile: T1 });
  assert.ok(full.signals.find((s) => s.id === 'tax').points >= 2);
});

test('B0 contract: every key the funnel can send exists in PROFILE', () => {
  const js = readFileSync(new URL('verdict-flow.js', SITE), 'utf8');
  const sets = js.slice(js.indexOf('var BUYSET'), js.indexOf('function SET()'));
  const keys = new Set([...sets.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
  keys.add('goal');
  for (const k of keys) assert.ok(k in PROFILE, `funnel key ${k} missing in PROFILE`);
  assert.ok(keys.has('tax_known') && keys.has('custody_pref') && keys.has('freq'));
  // focus is accepted as a list
  assert.deepEqual(cleanProfile({ focus: ['next', 'x'] }), { focus: ['next'] });
});

test('T1 sensible beginner: basics, template why, 3 steps tax → fees → rule', () => {
  const r = t1();
  assert.equal(r.level.id, 'basics');
  assert.equal(r.level.headline, 'Ešte nie: najprv doplňte základy.');
  assert.equal(r.level.why, 'Máte rezervu mimo Bitcoinu, ale neviete, akú daň zaplatíte pri predaji.');
  assert.deepEqual(r.level.flags, []);
  assert.match(r.level.scoreLine, /^Skóre \d+\/100 meria, nakoľko úplne je plán opísaný/);
  assert.equal(r.steps.length, 3);
  assert.deepEqual(r.steps.map((s) => s.signal), ['tax', 'alternatives', 'rule']);
  assert.equal(r.steps[0].tool.page, 'tax-agent.html');
  assert.deepEqual(r.steps[0].tool.params, { country: 'sk' });
  assert.match(r.steps[0].action, /na Slovensku/);
  assert.equal(r.steps[1].tool.page, '/sk/bitcoin-index-poplatkov/');
  assert.equal(r.steps[2].tool.page, 'stacking.html');
  assert.deepEqual(r.steps[2].tool.params, { amount: 'm' });
  for (const s of r.steps) assert.ok(startsWithVerb(s.action, 'sk'), s.action);
  assert.deepEqual(r.areas.map((a) => [a.id, a.role]), [['tax', 'weakest'], ['liquidity', 'strongest']]);
  assert.equal(r.areas[0].title, 'Dane pri predaji');
  assert.match(r.areas[0].meaning, /^Daň môže zobrať výraznú časť zisku\. Na Slovensku: 19 až 35 %/);
  assert.equal(r.pricing.report.mode, 'waitlist');
  assert.equal(r.pricing.cfo.opens, null);
  assert.equal(r.locked.length, 8);
  assert.equal(r.copySource.summary, 'template');
});

test('T8 EN parity: same structure, EN headline and copy', () => {
  const r = t1({}, 'en');
  assert.equal(r.level.headline, 'Not yet: fill in the basics first.');
  assert.equal(r.level.why, "You have a reserve outside Bitcoin, but you don't know what tax you'd pay when you sell.");
  assert.equal(r.steps[1].tool.page, '/bitcoin-fee-index/');
  for (const s of r.steps) assert.ok(startsWithVerb(s.action, 'en'), s.action);
});

test('country rule only with the tax module on', () => {
  assert.doesNotMatch(t1({}, 'sk', { taxModule: false }).areas[0].meaning, /19 až 35/);
  assert.match(t1({}, 'sk', { taxModule: true }).areas[0].meaning, /19 až 35/);
});

test('a valid model summary and fix are used; invalid ones fall back to templates', () => {
  const sigs = out(T1_PTS).signals.map((s) => s.id === 'tax' ? { ...s, fix: 'Zistite, akú daň zaplatíte zo zisku pri predaji na Slovensku.' } : s);
  const r = t1({ signals: sigs, summary: 'Máte rezervu na 6 mesiacov, ale nemáte spočítanú daň zo zisku pri predaji 10 000 €.' });
  assert.equal(r.level.why, 'Máte rezervu na 6 mesiacov, ale nemáte spočítanú daň zo zisku pri predaji 10 000 €.');
  assert.equal(r.steps[0].action, 'Zistite, akú daň zaplatíte zo zisku pri predaji na Slovensku.');
  assert.equal(r.copySource.fixes.tax, 'model');
  // summary with a signal name, a score or a "/10" → template
  for (const bad of ['Signál Dane má 0/10 bodov, ostatné sú v poriadku a premyslené.', 'Najlepšie by bolo kúpiť teraz, máte rezervu aj horizont.', 'Short.']) {
    assert.equal(t1({ summary: bad }).copySource.summary, 'template', bad);
  }
});

test('T7 degradation: empty summary, an advice fix, a partner fix and 9 signals still render', () => {
  const sigs = out(T1_PTS).signals.filter((s) => s.id !== 'goal').map((s) =>
    s.id === 'worst_case' ? { ...s, fix: 'Kúpte viac pri poklese.' } : s.id === 'alternatives' ? { ...s, fix: 'Porovnajte poplatky v aplikácii Kraken a vyberte nižšie.' } : s);
  const full = scoreVerdict(out(T1_PTS, { signals: sigs, summary: '' }), 'sk', { text: T1_TEXT, profile: T1 });
  assert.equal(full.partial, true);
  assert.equal(full.copySource.summary, 'template');
  assert.equal(full.copySource.fixes.worst_case, 'template');
  assert.equal(full.copySource.fixes.alternatives, 'template');
  const r = freeView(full, T1, { lang: 'sk' });
  assert.equal(r.steps.length, 3);
  assert.ok(!JSON.stringify(r).includes('Kraken'));
  assert.ok(!looksLikeAdvice(full));
});

test('6 signals → 502, not a half result', async () => {
  const sigs = out(T1_PTS).signals.slice(0, 6);
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
    content: [{ type: 'text', text: JSON.stringify(out(T1_PTS, { signals: sigs })) }], usage: { input_tokens: 1, output_tokens: 1 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const kv = new Map();
    const res = await worker.fetch(new Request('https://w.example/verdict', { method: 'POST', headers: { Origin: 'https://virtuse.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': '9.9.9.9' }, body: JSON.stringify({ text: T1_TEXT, lang: 'sk', profile: T1 }) }),
      { RATE_LIMIT_KV: { async get(k) { return kv.get(k) ?? null; }, async put(k, v) { kv.set(k, v); } }, ANTHROPIC_API_KEY: 'k', VERDICT_ENABLED: '1' });
    assert.equal(res.status, 502);
  } finally { globalThis.fetch = orig; }
});

test('no "your own decision" boilerplate unless the text asked whether to act', () => {
  const m = ['Aký je váš plán pri poklese?', 'Či konať, je vaše vlastné rozhodnutie.'];
  const a = scoreVerdict(out(T1_PTS, { missing: m }), 'sk', { text: T1_TEXT, profile: T1 });
  assert.deepEqual(a.missing, ['Aký je váš plán pri poklese?']);
  const b = scoreVerdict(out(T1_PTS, { missing: m }), 'sk', { text: 'Mám kúpiť Bitcoin za 10 000 € teraz, alebo počkať? Držal by som ho 5 rokov.', profile: T1 });
  assert.equal(b.missing.length, 2);
  // empty missing → the weakest area's question
  const c = scoreVerdict(out(T1_PTS, { missing: ['Či konať, je vaše vlastné rozhodnutie.'] }), 'sk', { text: T1_TEXT, profile: T1 });
  assert.equal(c.missing[0], AREA_COPY.tax.q.sk);
  // reasons lose a trailing boilerplate sentence
  const sigs = out(T1_PTS).signals.map((s) => s.id === 'tax' ? { ...s, reason: 'Text daň nespomína. Či konať, je vaše vlastné rozhodnutie.' } : s);
  assert.equal(scoreVerdict(out(T1_PTS, { signals: sigs }), 'sk', { text: T1_TEXT, profile: T1 }).signals.find((s) => s.id === 'tax').reason, 'Text daň nespomína.');
});

test('T2 loan red flags: rf_reserve first, +1 more, step 1 fixes it', () => {
  const p = { goal: 'loan', country: 'sk', amount: 'l', ltv: 'gt50', liqprice: 'no', horizon: 'lt1', reserve: 'no', keys: 'exch', drop: 'sell', tax_known: 'no', ruleset: 'no' };
  const full = scoreVerdict(out(T1_PTS, { is_loan: true }), 'sk', { text: 'Chcem si požičať 20 000 € oproti 0,5 BTC na rekonštrukciu.', profile: p });
  const r = freeView(full, p, { lang: 'sk' });
  assert.equal(r.level.id, 'redflag');
  assert.equal(r.level.headline, 'Stop: v pláne je červená vlajka.');
  assert.deepEqual(r.level.flags.map((f) => f.id), ['rf_reserve', 'rf_ltv']);
  assert.equal(r.level.more, 1);
  assert.equal(r.level.why, 'Peniaze môžete potrebovať do roka a nemáte rezervu mimo Bitcoinu.');
  assert.equal(r.steps[0].kind, 'flag');
  assert.equal(r.steps[0].tool.page, 'loan.html');
  assert.equal(r.steps.length, 3);
});

test('T4 wrong tax rule: rf_tax in the country, step 1 tax-agent with the country', () => {
  const p = { goal: 'sell', country: 'at', amount: 'l', share: '20_50', holdtime: 'gt3', basis: 'yes', tax_known: 'yes', aim: 'purchase', keys: 'exch', ruleset: 'no' };
  const full = scoreVerdict(out({ ...T1_PTS, tax: 8 }, { tax_rule_wrong: true, country: 'at' }), 'sk', { text: 'Predám 30 % Bitcoinu, ktorý mám od roku 2022, na auto. V Rakúsku je to po roku držby bez dane.', profile: p });
  const r = freeView(full, p, { lang: 'sk' });
  assert.equal(r.weakest.id, 'tax');
  assert.equal(r.level.id, 'redflag');
  assert.match(r.level.why, /nesedí s verejnými pravidlami v Rakúsku/);
  assert.equal(r.steps[0].tool.page, 'tax-agent.html');
  assert.deepEqual(r.steps[0].tool.params, { country: 'at' });
  assert.match(r.steps[0].action, /pre Rakúsko/);
  // alternatives for a sale → sell vs borrow
  assert.equal(full.signals.find((s) => s.id === 'alternatives').tool.page, '/sk/bitcoin-predat-alebo-pozicat/');
});

test('T5 company: rf_runway; other country gets no country rule', () => {
  const p = { goal: 'treasury', country: 'other', amount: 'xl', runway: 'lt12', board: 'pending', horizon: '1_4', keys: 'exch', drop: 'hold', tax_known: 'no', ruleset: 'no' };
  const full = scoreVerdict(out(T1_PTS, { country: 'other' }), 'en', { text: 'The company has a €200,000 reserve; we are considering 10% in BTC for 3 years.', profile: p });
  const r = reportView(full, p, { lang: 'en', taxModule: true });
  assert.equal(r.level.flags[0].id, 'rf_runway');
  assert.equal(r.steps[0].tool.page, 'treasury.html');
  assert.equal(r.areas.length, 10);
  assert.doesNotMatch(r.areas.find((a) => a.id === 'tax').meaning, /As of/);
  assert.ok(r.missing.includes('Check the rule for your country with a tax adviser.'));
  assert.equal(r.freeAreas.length, 2);
});

test('T3 complete plan: ready, fillers complete the 3 steps', () => {
  const pts = { worst_case: 9, liquidity: 9, tax: 8, custody: 8, plan_b: 7, goal: 9, horizon: 8, alternatives: 8, rule: 9, asymmetry: 6 };
  const p = { goal: 'dca', country: 'de', amount: 'm', reserve: 'yes', drop: 'buy' };
  const full = scoreVerdict(out(pts, { drawdown_tested: true }), 'sk', { profile: p });
  const r = freeView(full, p, { lang: 'sk' });
  assert.equal(r.level.id, 'ready');
  assert.equal(r.level.headline, 'Plán je premyslený.');
  assert.deepEqual(r.steps.map((s) => s.id), ['asymmetry', 'partners', 'consult']);
  assert.equal(r.areas[1].role, 'strongest');
  const rep = reportView(full, p, { lang: 'sk' });
  assert.deepEqual(rep.steps.map((s) => s.id), ['asymmetry', 'pdf', 'partners']);
});

test('almost: "doplňte {n} veci" with n = signals under 7, at most 3; 1 → "1 vec"', () => {
  const two = { worst_case: 9, liquidity: 9, tax: 8, custody: 8, plan_b: 7, goal: 9, horizon: 8, alternatives: 3, rule: 9, asymmetry: 6 };
  assert.equal(freeView(scoreVerdict(out(two, { drawdown_tested: true }), 'sk'), {}, { lang: 'sk' }).level.headline, 'Takmer hotové: doplňte 2 veci.');
  const one = { ...two, asymmetry: 8 };
  assert.equal(freeView(scoreVerdict(out(one, { drawdown_tested: true }), 'sk'), {}, { lang: 'sk' }).level.headline, 'Takmer hotové: doplňte 1 vec.');
  assert.equal(freeView(scoreVerdict(out(one, { drawdown_tested: true }), 'en'), {}, { lang: 'en' }).level.headline, 'Almost there: add 1 thing.');
});

test('free areas: second-weakest when the strongest is under 4', () => {
  const low = Object.fromEntries(SIGNALS.map((s) => [s.id, 2]));
  low.goal = 3;
  const r = freeView(scoreVerdict(out(low), 'sk'), {}, { lang: 'sk' });
  assert.deepEqual(r.areas.map((a) => a.role), ['weakest', 'second']);
  assert.equal(r.level.why.split(' a ').length >= 2, true);
});

test('pricing: checkout only with VERDICT_CHECKOUT; tax line flag passes through', () => {
  assert.equal(t1({}, 'sk', { checkout: true }).pricing.report.mode, 'checkout');
  assert.equal(t1({}, 'sk', { taxModule: false }).pricing.report.taxModule, false);
});

test('copy: templates start with an allowed verb, contain no advice or ranking words', () => {
  const RANK = /\bbest\b|najlepš|odporúč|recommend|\btop\b|лучш|рекоменд|(^|[^\p{L}])топ(?![\p{L}])/iu;
  for (const [id, c] of Object.entries(AREA_COPY)) {
    if (id === 'fees') continue;
    for (const lvl of ['low', 'mid']) for (const L of ['sk', 'en', 'ru']) assert.ok(startsWithVerb(c[lvl].todo[L], L), `${id}.${lvl}.${L}`);
  }
  const all = JSON.stringify(AREA_COPY);
  assert.ok(!RANK.test(all));
  assert.ok(!BANNED.some((re) => re.test(all)), BANNED.find((re) => re.test(all)));
  for (const f of ['verdict-flow.js']) {
    const js = readFileSync(new URL(f, SITE), 'utf8');
    assert.doesNotMatch(js, /najsilnejšia v oblasti|najslabšia v oblasti|strongest on|weakest on/);
  }
  assert.doesNotMatch(readFileSync(new URL('src/verdict.js', import.meta.url), 'utf8'), /najsilnejšia v oblasti|strongest on /);
});

test('partner names match the Partner Finder catalog', () => {
  const ts = readFileSync(new URL('../layer2-src/src/lib/concierge.ts', import.meta.url), 'utf8');
  const names = [...new Set([...ts.matchAll(/^\s+name: '([^']+)'/gm)].map((m) => m[1]))].sort();
  assert.deepEqual([...PARTNER_NAMES].sort(), names);
});

test('prompt asks for summary and fix with the verb list; schema requires them', async () => {
  const p = systemPrompt('sk');
  assert.match(p, /summary: one sentence/);
  assert.match(p, new RegExp(VERBS.sk[0]));
  assert.match(p, /never a request for advice/);
});

test('summary: ordinary words like daň, cieľ, tax pass; a signal used as a label fails', () => {
  const ok = 'Máte rezervu na 6 mesiacov, ale neviete, akú daň zaplatíte a nemáte cieľ s dátumom.';
  assert.equal(t1({ summary: ok }).level.why, ok);
  const en = scoreVerdict(out(T1_PTS, { summary: "You have a 6-month reserve, but you haven't worked out the tax on a sale." }), 'en', { text: T1_TEXT, profile: T1 });
  assert.equal(en.copySource.summary, 'model');
  assert.equal(t1({ summary: 'Vaša úvaha je slabá v časti Dane, zvyšok je opísaný celkom dobre.' }).copySource.summary, 'template');
});

// ── Russian (2026-10-24): same structure as SK/EN, Russian copy only.
const SK_OR_EN = /[áäčďéíĺľňóôŕšťúýž]|\b(the|and|you|your|Not yet|Almost|Stop:)\b/;
function noLeftovers(r) {
  const texts = [r.level.headline, r.level.why, r.level.scoreLine, ...r.level.flags.map((f) => f.text),
    ...r.steps.flatMap((s) => [s.action, s.why]), ...r.areas.flatMap((a) => [a.title, a.meaning, a.todo]), ...r.locked.map((l) => l.title)];
  for (const t of texts) {
    if (!t) continue;
    const plain = t.replace(/Tax & Inheritance Agent|Loan & Liquidity Copilot|Stacking Strategist|Bitcoin|Verdict|Virtuse|LTV|ETF|\bX\b|\bY\b/g, '');
    assert.doesNotMatch(plain, SK_OR_EN, t);
  }
}

test('RU T1: basics headline, template why, 3 verb-first steps, no SK/EN leftovers', () => {
  const r = t1({}, 'ru');
  assert.equal(r.level.id, 'basics');
  assert.equal(r.level.headline, 'Пока нет: сначала дополните основу плана.');
  assert.equal(r.level.why, 'У вас есть резерв вне Биткоина, но вы не знаете, какой налог заплатите при продаже.');
  assert.match(r.level.scoreLine, /^Оценка \d+\/100 показывает, насколько полно описан план/);
  assert.deepEqual(r.steps.map((s) => s.signal), ['tax', 'alternatives', 'rule']);
  for (const s of r.steps) assert.ok(startsWithVerb(s.action, 'ru'), s.action);
  assert.match(r.steps[0].action, /в Словакии/);
  assert.equal(r.steps[1].tool.page, '/ru/bitcoin-indeks-komissiy/');
  assert.equal(r.areas[0].title, 'Налог при продаже');
  assert.match(r.areas[0].meaning, /^Налог может забрать значительную часть прибыли\. В Словакии: подоходный налог от 19 до 35%/);
  assert.equal(r.band.label, 'Не хватает важного');
  assert.match(r.aiLabel, /искусственным интеллектом/);
  noLeftovers(r);
});

test('RU T2: loan red flag headline and flag text in Russian', () => {
  const p = { goal: 'loan', country: 'sk', amount: 'l', ltv: 'gt50', liqprice: 'no', horizon: 'lt1', reserve: 'no', keys: 'exch', drop: 'sell', tax_known: 'no', ruleset: 'no' };
  const full = scoreVerdict(out(T1_PTS, { is_loan: true }), 'ru', { text: 'Хочу занять 20 000 € под залог 0,5 BTC на ремонт.', profile: p });
  const r = freeView(full, p, { lang: 'ru' });
  assert.equal(r.level.headline, 'Стоп: в плане есть красный флаг.');
  assert.deepEqual(r.level.flags.map((f) => f.id), ['rf_reserve', 'rf_ltv']);
  assert.equal(r.level.why, 'Деньги могут понадобиться вам в течение года, а резерва вне Биткоина у вас нет.');
  assert.equal(r.steps.length, 3);
  for (const s of r.steps) assert.ok(startsWithVerb(s.action, 'ru'), s.action);
  noLeftovers(r);
});

test('RU T4: wrong tax rule names the country in Russian (locative + genitive)', () => {
  const p = { goal: 'sell', country: 'at', amount: 'l', tax_known: 'yes', keys: 'exch' };
  const full = scoreVerdict(out({ ...T1_PTS, tax: 8 }, { tax_rule_wrong: true, country: 'at' }), 'ru', { profile: p });
  const r = freeView(full, p, { lang: 'ru' });
  assert.match(r.level.why, /публичными правилами в Австрии/);
  assert.match(r.steps[0].action, /для Австрии/);
  assert.equal(full.signals.find((s) => s.id === 'alternatives').tool.page, '/ru/bitcoin-prodat-ili-zanyat/');
});

test('RU almost headline: 1 пункт / 2 пункта; T3 ready', () => {
  const two = { worst_case: 9, liquidity: 9, tax: 8, custody: 8, plan_b: 7, goal: 9, horizon: 8, alternatives: 3, rule: 9, asymmetry: 6 };
  assert.equal(freeView(scoreVerdict(out(two, { drawdown_tested: true }), 'ru'), {}, { lang: 'ru' }).level.headline, 'Почти готово: дополните 2 пункта.');
  assert.equal(freeView(scoreVerdict(out({ ...two, asymmetry: 8 }, { drawdown_tested: true }), 'ru'), {}, { lang: 'ru' }).level.headline, 'Почти готово: дополните 1 пункт.');
  const ready = freeView(scoreVerdict(out({ ...two, alternatives: 8 }, { drawdown_tested: true }), 'ru'), { goal: 'dca', reserve: 'yes', drop: 'buy' }, { lang: 'ru' });
  assert.equal(ready.level.headline, 'План продуман.');
  noLeftovers(ready);
});

test('RU model copy: valid Russian summary/fix used; advice, SK text or jargon fall back', () => {
  const sigs = out(T1_PTS).signals.map((s) => s.id === 'tax' ? { ...s, fix: 'Узнайте, какой налог вы заплатите с прибыли при продаже в Словакии.' } : s);
  const okSum = 'У вас есть резерв на 6 месяцев, но не посчитан налог с прибыли при продаже 10 000 €.';
  const r = t1({ signals: sigs, summary: okSum }, 'ru');
  assert.equal(r.level.why, okSum);
  assert.equal(r.copySource.fixes.tax, 'model');
  for (const bad of ['Лучше всего купите сейчас, у вас есть резерв и горизонт.', 'Máte rezervu, ale neviete, akú daň zaplatíte pri predaji.', 'Сигнал «Налоги» у вас слабый, остальное описано хорошо.']) {
    assert.equal(t1({ summary: bad }, 'ru').copySource.summary, 'template', bad);
  }
  for (const fix of ['Купите ещё при падении на 70%, если цена упадёт.', 'Держите Биткоин не меньше 5 лет и запишите это.', 'Сравните комиссии в Kraken и выберите меньшую.']) {
    const s2 = out(T1_PTS).signals.map((s) => s.id === 'tax' ? { ...s, fix } : s);
    assert.equal(t1({ signals: s2 }, 'ru').copySource.fixes.tax, 'template', fix);
  }
  assert.ok(BANNED.some((re) => re.test('Мы рекомендуем этот вариант.')));
  assert.ok(BANNED.some((re) => re.test('Это лучший выбор.')));
  assert.ok(!BANNED.some((re) => re.test('Чтобы лучше понять риск, посчитайте падение.')));
});

test('RU prompt and errors', async () => {
  const p = systemPrompt('ru');
  assert.match(p, /Russian \(formal «вы»\)/);
  assert.match(p, new RegExp(VERBS.ru[0]));
  const kv = new Map();
  const res = await worker.fetch(new Request('https://w.example/verdict', { method: 'POST', headers: { Origin: 'https://virtuse.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'коротко', lang: 'ru' }) }),
    { RATE_LIMIT_KV: { async get(k) { return kv.get(k) ?? null; }, async put(k, v) { kv.set(k, v); } } });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Опишите решение хотя бы одним предложением.');
});
