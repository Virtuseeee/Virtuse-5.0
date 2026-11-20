// Tests for the DCA calculator's shared renderer (Kimi…/dca-calc.js).  Run: node --test seo-build/dca-calc.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SITE_DIR_NAME } from './lib/util.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const V = createRequire(import.meta.url)(path.join(ROOT, '..', SITE_DIR_NAME, 'dca-calc.js'));
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dca-snapshot.json'), 'utf8'));
const H = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dca-history.json'), 'utf8'));

// The snapshot ends with October 2026. "Live" = the same file plus a close inside a running November.
const live = { ...snap, asOf: '2026-11-19', closes: { ...snap.closes, '2026-11': 61881.16 }, eurusd: { ...snap.eurusd, '2026-11': 1.0992 } };
const r = Math.round;

test('snapshot ends with a complete month', () => {
  assert.equal(V.lastFull(snap), '2026-10');
  assert.equal(snap.asOf, '2026-10-31');
});

test('default plan: 100 EUR from January 2020, valued at the October 2026 close', () => {
  const m = V.model(snap, 100, '2020-01', 'EUR');
  assert.equal(m.n, 82);
  assert.equal(m.invested, 8200);
  assert.equal(m.btc.toFixed(4), '0.3058');
  assert.equal(r(m.avg), 26816);
  assert.equal(r(m.value), 21185);
  assert.equal((m.change * 100).toFixed(0), '158');
  assert.equal(r(m.lump), 67100);
  assert.equal(m.asOf, '2026-10-31');
});

test('a close inside a running month does not change the result', () => {
  assert.equal(V.lastFull(live), '2026-10');
  const a = V.model(snap, 100, '2020-01', 'EUR'), b = V.model(live, 100, '2020-01', 'EUR');
  assert.equal(r(b.value), 21185);
  assert.equal(b.value, a.value);
  assert.equal(b.lump, a.lump);
  assert.equal(b.asOf, '2026-10-31');
  assert.equal(b.series.length, a.series.length);
});

test('second check: 200 EUR from January 2021', () => {
  const m = V.model(live, 200, '2021-01', 'EUR');
  assert.equal(m.n, 70);
  assert.equal(m.invested, 14000);
  assert.equal(r(m.value), 24552);
  assert.equal((m.change * 100).toFixed(1), '75.4');
});

test('once the month is complete it counts', () => {
  const done = { ...live, asOf: '2026-11-30' };
  assert.equal(V.lastFull(done), '2026-11');
  assert.equal(V.model(done, 100, '2020-01', 'EUR').n, 83);
});

test('start and amount limits', () => {
  assert.equal(V.clampStart(live, '2026-11'), '2026-10');
  assert.equal(V.clampStart(live, '2026-12'), '2026-10');
  assert.equal(V.clampStart(live, '2010-01'), V.MIN_START);
  assert.equal(V.clampAmount(0), 10);
  assert.equal(V.clampAmount(10), 10);
  assert.equal(V.clampAmount(100000), 100000);
  assert.equal(V.clampAmount(250000), 100000);
  const months = V.monthList(live);
  assert.equal(months[0], '2014-01');
  assert.equal(months[months.length - 1], '2026-10');
});

test('amount slider reaches the field limit', () => {
  assert.equal(V.STEPS[0], V.AMOUNT_MIN);
  assert.equal(V.STEPS[V.STEPS.length - 1], V.AMOUNT_MAX);
  for (let i = 1; i < V.STEPS.length; i++) assert.ok(V.STEPS[i] > V.STEPS[i - 1]);
  assert.equal(V.STEPS[V.stepIndex(100000)], 100000);
  assert.equal(V.STEPS[V.stepIndex(100)], 100);
  assert.equal(V.STEPS[V.stepIndex(60000)], 50000);   // a typed value between stops rests on the stop below
});

test('Slovak dates have no ordinal point and take the dative after "k"', () => {
  const F = V.fmt('sk', 'sk-SK', 'EUR');
  assert.equal(F.day('2026-10-31'), '31 októbra 2026');
  assert.equal(F.dayTo('2026-10-31'), '31 októbru 2026');
  assert.equal(F.day('2026-11-20'), '20 novembra 2026');
  const m = V.model(snap, 100, '2020-01', 'EUR');
  const html = V.results(m, H.sk, F) + V.table(V.byYear(snap, 100, 'EUR'), H.sk, F) + V.note(m, H.sk, F) + V.summary(snap, H.sk, 'sk', 'sk-SK');
  assert.match(html, /Hodnota k 31 októbru 2026/);
  assert.doesNotMatch(html, /\d\.\s(januára|februára|marca|apríla|mája|júna|júla|augusta|septembra|októbra|novembra|decembra)/);
  assert.doesNotMatch(html, /tis\./);
});

test('every language has every text', () => {
  const keys = Object.keys(H.en).filter((k) => k !== 'disclaimer');
  for (const lang of Object.keys(H.locales)) {
    for (const k of keys) assert.ok(typeof H[lang][k] === 'string' && H[lang][k].length, `${lang}.${k}`);
    assert.doesNotMatch(JSON.stringify(H[lang]), /[–—]/, `${lang}: en or em dash`);
  }
});
