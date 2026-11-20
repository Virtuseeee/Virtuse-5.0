// node --test: checks tax-calc.js against hand-worked cases. Run from the site folder:
//   node --test i18n-tools/tax-calculator/tax-calc.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '../..');
const require = createRequire(import.meta.url);
const T = require(path.join(site, 'tax-calc.js'));
const rules = JSON.parse(fs.readFileSync(path.resolve(site, '../seo-build/data/tax-rules.json'), 'utf8'));
const today = '2026-11-19';
const run = (c, o) => T.compute(rules, c, Object.assign({ bought: '2026-01-10', today, other: 0 }, o));

test('Slovakia: 19% band plus 16% health levy', () => {
  const x = run('sk', { proceeds: 15000, cost: 5000, other: 30000 });
  assert.equal(x.tax, 1900); assert.equal(x.levy, 1600); assert.equal(x.total, 3500); assert.equal(x.net, 11500);
});
test('Slovakia: gain crosses the 25% band', () => {
  const x = run('sk', { proceeds: 15000, cost: 5000, other: 40000 });
  assert.equal(x.tax, 2261); assert.equal(x.lines.filter(l => l.key === 'band').length, 2);
});
test('Slovakia: no holding exemption, a loss pays nothing', () => {
  assert.equal(run('sk', { proceeds: 15000, cost: 5000, bought: '2015-01-01' }).status, 'taxed');
  assert.equal(run('sk', { proceeds: 4000, cost: 5000 }).status, 'loss');
});
test('Czechia: small sales, 3-year test, cap', () => {
  assert.deepEqual([run('cz', { proceeds: 4000, cost: 1000 }).status, run('cz', { proceeds: 4000, cost: 1000 }).reason], ['exempt', 'small']);
  assert.equal(run('cz', { proceeds: 10000, cost: 5000 }).tax, 750);
  assert.equal(run('cz', { proceeds: 10000, cost: 5000, bought: '2023-11-19' }).status, 'taxed');   // exactly 3 years: not more
  assert.equal(run('cz', { proceeds: 10000, cost: 5000, bought: '2023-11-18' }).reason, 'hold');
  assert.equal(run('cz', { proceeds: 2e6, cost: 5000, bought: '2020-01-01' }).status, 'over');
  const big = run('cz', { proceeds: 100000, cost: 0, other: 1762812 / rules.fx.CZK - 50000 });
  assert.equal(big.lines.length, 2);
});
test('Germany: Freigrenze, one year, § 32a', () => {
  assert.equal(run('de', { proceeds: 1999, cost: 1000 }).reason, 'freigrenze');
  assert.equal(run('de', { proceeds: 2000, cost: 1000 }).status, 'taxed');   // 1,000 is not under 1,000
  assert.equal(run('de', { proceeds: 20000, cost: 1000, bought: '2025-11-18' }).reason, 'hold');
  assert.equal(T.deTax(12348), 0); assert.equal(T.deTax(100000), Math.floor(42000 - 11135.63));
  assert.equal(T.deTax(300000), Math.floor(135000 - 19470.38));
  const x = run('de', { proceeds: 20000, cost: 10000, other: 100000 });
  assert.equal(x.tax, 4200);   // fully in the 42% zone
});
test('Austria: old holdings tax-free, new ones 27.5%', () => {
  assert.equal(run('at', { proceeds: 20000, cost: 10000, bought: '2021-02-28' }).reason, 'old');
  assert.equal(run('at', { proceeds: 20000, cost: 10000, bought: '2021-03-01' }).tax, 2750);
});
test('flat countries', () => {
  for (const [c, t] of [['pl', 1900], ['hu', 1500], ['hr', 1200], ['ro', 1600], ['bg', 1000], ['fr', 3140]])
    assert.equal(run(c, { proceeds: 20000, cost: 10000 }).tax, t, c);
  assert.equal(run('hr', { proceeds: 20000, cost: 10000, bought: '2024-11-18' }).reason, 'hold');
  assert.equal(run('fr', { proceeds: 305, cost: 100 }).reason, 'small');
  assert.equal(run('fr', { proceeds: 306, cost: 100 }).status, 'taxed');
});
test('Spain: savings bands', () => {
  assert.equal(run('es', { proceeds: 20000, cost: 10000 }).tax, 1980);
  assert.equal(run('es', { proceeds: 20000, cost: 10000, other: 300000 }).tax, 3000);
});
test('Slovenia and the Netherlands do not tax the sale', () => {
  assert.equal(run('si', { proceeds: 20000, cost: 10000 }).status, 'none');
  assert.equal(run('nl', { proceeds: 20000, cost: 10000 }).status, 'box3');
});
test('rates agree with tax-sources.json', () => {
  const src = JSON.parse(fs.readFileSync(path.resolve(site, '../seo-build/data/tax-sources.json'), 'utf8'));
  for (const c of src.countries) {
    const r = rules.countries[c.id];
    assert.ok(r, c.id);
    const t = c.fields.gainTax.text;
    const rates = r.kind === 'flat' ? [r.rate] : r.kind === 'bands' ? [r.bands[0][1], r.bands.at(-1)[1]] : r.kind === 'de' ? [45] : [];
    for (const x of rates) assert.ok(t.includes(String(x).replace('.', '.')) , `${c.id}: ${x} not in "${t}"`);
  }
});
test('amounts: thousands and decimal marks, k and m', () => {
  const ok = { '2000000': 2e6, '2 000 000': 2e6, '2.000.000': 2e6, '2,000,000': 2e6, '1.000.000': 1e6, '2.000,50': 2000.5, '2000,50': 2000.5,
               '2,000.50': 2000.5, '250k': 250000, '2.5m': 2.5e6, '0': 0 };
  for (const [s, n] of Object.entries(ok)) assert.equal(T.parseNum(s), n, s);
  for (const s of ['', 'abc', '1,2,3', '-5']) assert.ok(Number.isNaN(T.parseNum(s)), s);
});
test('estimate: month price is the mean of the two month-end closes in euros', () => {
  const d = { closes: { '2021-12': 110, '2022-01': 88 }, eurusd: { '2021-12': 1.1, '2022-01': 1.1 } };
  assert.equal(T.monthPrice(d, '2022-01'), 90);
  assert.equal(T.monthPrice(d, '2021-12'), 0);   // no close before it
  assert.equal(T.monthPrice(d, '2030-01'), 0);
});
test('Germany: a long-held estimate is an exemption with the full proceeds kept, not an empty result', () => {
  const x = run('de', { proceeds: 2918859, cost: 2000000, bought: '2024-01-31' });
  assert.deepEqual([x.status, x.reason, x.total, x.net], ['exempt', 'hold', 0, 2918859]);
});
