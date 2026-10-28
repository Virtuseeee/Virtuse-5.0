// Tax figures stay out of the AI's own text until the lawyer signs off (Ras 2026-10-28).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreVerdict, SIGNALS, systemPrompt, mentionsTaxFigure } from './src/verdict.js';

const P = { worst_case: 3, liquidity: 7, tax: 2, custody: 2, plan_b: 1, goal: 3, horizon: 4, alternatives: 0, rule: 2, asymmetry: 5 };
const RATE = 'Zistite, koľko dane 19–35 % a zdravotných odvodov 16 % by vznikla pri predaji.';
const out = () => ({ declined: false, is_loan: false, drawdown_tested: false, tax_rule_wrong: false, country: 'sk',
  summary: 'Plán pokrýva rezervu, ale chýba daň 19 % pri predaji.',
  signals: SIGNALS.map((s) => ({ id: s.id, points: P[s.id], only_profile: false, text_evidence: '',
    reason: s.id === 'tax' ? 'Daň 19 % z predaja v texte chýba.' : 'Text o tejto oblasti hovorí len čiastočne.',
    fix: s.id === 'tax' ? RATE : s.id === 'worst_case' ? 'Spočítajte, koľko by zostalo pri poklese o 70 %.' : '' })),
  missing: ['Viete, že daň je 19 %?', 'Kto bude držať kľúče?'] });

test('mentionsTaxFigure: tax word + percent only', () => {
  assert.equal(mentionsTaxFigure(RATE), true);
  assert.equal(mentionsTaxFigure('Tax of 19% on the gain'), true);
  assert.equal(mentionsTaxFigure('Spočítajte, koľko by zostalo pri poklese o 70 %.'), false);
  assert.equal(mentionsTaxFigure('Zistite, koľko dane by vznikla pri predaji.'), false);
});

test('tax rates in fix, reason, missing and summary fall back to templates', () => {
  const r = scoreVerdict(out(), 'sk', {});
  const tax = r.signals.find((s) => s.id === 'tax');
  assert.equal(tax.fix, null);
  assert.ok(!/%/.test(tax.reason) && !/\{/.test(tax.reason), tax.reason);
  assert.equal(r.signals.find((s) => s.id === 'worst_case').fix, 'Spočítajte, koľko by zostalo pri poklese o 70 %.');
  assert.deepEqual(r.missing, ['Kto bude držať kľúče?']);
  assert.equal(r.summary, null);
  assert.equal(r.copySource.fixes.tax, 'template');
});

test('the prompt forbids tax figures in the person-facing text', () => {
  for (const L of ['sk', 'en', 'ru']) assert.match(systemPrompt(L), /never write a tax or levy rate/);
});
