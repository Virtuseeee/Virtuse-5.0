// node --test macro-build/macro-rules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const rules = require('../Kimi_Agent_Virtuse%20MiCA%20Partners/news/macro-rules.js');
const copy = JSON.parse(readFileSync(new URL('../Kimi_Agent_Virtuse%2520MiCA%2520Partners/news/macro-copy.json', import.meta.url)));

test('boundaries pick the documented rule', () => {
  assert.match(rules.pick(copy, 'us10y', 4.75, 'en'), /^Expensive money/);
  assert.match(rules.pick(copy, 'us10y', 4.74, 'en'), /^Yields in a middle/);
  assert.match(rules.pick(copy, 'us10y', 4.0, 'en'), /^Cheaper money/);
  assert.match(rules.pick(copy, 'btc_24h', 3, 'en'), /^Up over 3%/);
  assert.match(rules.pick(copy, 'btc_24h', -3, 'en'), /^Down over 3%/);
  assert.match(rules.pick(copy, 'btc_24h', 0.4, 'en'), /calm day/);
  assert.match(rules.pick(copy, 'fear_greed', 25, 'en'), /^Extreme fear/);
  assert.match(rules.pick(copy, 'fear_greed', 26, 'en'), /^Fear/);
  assert.match(rules.pick(copy, 'fear_greed', 76, 'en'), /^Extreme greed/);
  assert.match(rules.pick(copy, 'infl_us', 3.7, 'sk'), /nad 3/);
  assert.match(rules.pick(copy, 'eurusd_1d', -0.3, 'en'), /^Weaker euro/);
});
test('missing value or metric gives no line', () => {
  assert.equal(rules.pick(copy, 'us10y', null, 'en'), '');
  assert.equal(rules.pick(copy, 'us10y', NaN, 'en'), '');
  assert.equal(rules.pick(copy, 'nope', 1, 'en'), '');
});
test('every line exists in EN and SK and stays short', () => {
  for (const [metric, list] of Object.entries(copy.rules)) {
    assert.ok(list.some((r) => r.else), `${metric} needs an else rule`);
    for (const r of list) {
      for (const lang of ['en', 'sk']) {
        assert.ok(r[lang], `${metric} missing ${lang}`);
        assert.ok(r[lang].length <= 90, `${metric} ${lang} too long (${r[lang].length}): ${r[lang]}`);
      }
      assert.doesNotMatch(r.en, /\b(buy|sell|will (rise|fall)|target price)\b/i, `${metric}: no advice or forecasts`);
    }
  }
});
