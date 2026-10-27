// Review 2026-10-27 (HANDOVER-verdict-skoora-review): partners named from the
// text, buy + inheritance, Plan B tool for a buy case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreVerdict, freeView, reportView, SIGNALS, effectiveProfile, textIntents, cleanProfile } from './src/verdict.js';

const SAMPLE = 'Chcem kupit bitcoin za 10 percent hotovosti a nastavit dedenie';
const out = (pts) => ({ declined: false, is_loan: false, drawdown_tested: false, tax_rule_wrong: false, country: 'sk', summary: '',
  signals: SIGNALS.map((s) => ({ id: s.id, points: pts[s.id], reason: 'Text o tejto oblasti hovorí len čiastočne.', only_profile: false, text_evidence: '', fix: '' })),
  missing: ['Ako sa dedičia dostanú ku kľúčom bez zdieľania seed frázy?'] });
const P = { worst_case: 3, liquidity: 7, tax: 2, custody: 2, plan_b: 1, goal: 3, horizon: 4, alternatives: 0, rule: 2, asymmetry: 5 };

test('intent from text: buy + inheritance in sk/en/ru', () => {
  assert.deepEqual(textIntents(SAMPLE).sort(), ['buy', 'custody']);
  assert.deepEqual(textIntents('I want to buy Bitcoin and sort out inheritance for my heirs').sort(), ['buy', 'custody']);
  assert.deepEqual(textIntents('Хочу купить Биткоин и настроить наследство').sort(), ['buy', 'custody']);
  assert.deepEqual(textIntents('Chcem si požičať 20 000 € oproti BTC'), ['loan']);
});

test('"Something else" + buy/inheritance text: buy goal, custody also, two partner categories', () => {
  const eff = effectiveProfile({ country: 'sk' }, SAMPLE);
  assert.equal(eff.goal, 'buy'); assert.equal(eff.also, 'custody');
  const f = scoreVerdict(out(P), 'sk', { text: SAMPLE, profile: eff });
  const v = freeView(f, eff, { lang: 'sk' });
  assert.equal(v.partnerFinder.pf_goal, 'buy');
  assert.equal(v.partnerFinderAlso.pf_goal, 'custody');
  assert.equal(v.steps.length, 3);
  assert.ok(v.steps.some((s) => s.signal === 'custody'), 'one step for custody/inheritance');
  assert.ok(v.steps.every((s) => !s.tool || s.tool.key !== 'loan'), 'no Loan Copilot for a buy case');
});

test('a chosen tile wins over the text; the answer "both" survives cleanProfile only with buy/dca', () => {
  assert.equal(effectiveProfile({ goal: 'loan' }, SAMPLE).goal, 'loan');
  assert.deepEqual(cleanProfile({ goal: 'buy', also: 'custody' }), { goal: 'buy', also: 'custody' });
  assert.deepEqual(cleanProfile({ goal: 'loan', also: 'custody' }), { goal: 'loan' });
  assert.deepEqual(cleanProfile({ goal: 'buy', also: 'loan' }), { goal: 'buy' });
});

test('Plan B, worst case and reserve: Loan Copilot only on a loan or sale path', () => {
  for (const goal of ['buy', 'dca', 'custody']) {
    const v = freeView(scoreVerdict(out(P), 'sk', { profile: { goal } }), { goal }, { lang: 'sk' });
    assert.ok(v.steps.every((s) => !s.tool || s.tool.key !== 'loan'), goal);
  }
  const l = freeView(scoreVerdict(out(P), 'sk', { profile: { goal: 'loan' } }), { goal: 'loan' }, { lang: 'sk' });
  assert.ok(l.steps.some((s) => s.tool && s.tool.key === 'loan'));
  const r = reportView(scoreVerdict(out(P), 'sk', { profile: { goal: 'buy' } }), { goal: 'buy' }, { lang: 'sk' });
  assert.ok(r.plan.every((s) => s.tool.key !== 'loan'));
});
