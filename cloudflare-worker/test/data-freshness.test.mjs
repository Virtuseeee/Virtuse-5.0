// Daily data freshness check: what counts as a problem, what is only a note, and
// that an alert goes to vasilisin@virtuse.com only. No network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../src/app.js';
import { dataFreshnessProblems, bratislavaDay, DAILY_FILES } from '../src/features/data-freshness/checks.js';
import { runDataFreshness, ALERT_TO } from '../src/features/data-freshness/handler.js';
import { createResendClient } from '../src/infra/resend.js';
const createServices = (e, f) => ({ resend: createResendClient(e.RESEND_API_KEY, f) });

const NOW = Date.parse('2026-11-26T06:40:00Z'); // 07:40 in Bratislava
const PULSE_OK = JSON.stringify({ updated: '2026-11-26T05:51:21Z', items: [{ title: 'a', excerpt: 'b', title_sk: 'a', excerpt_sk: 'b' }] });

// One fake site. `src` / `prod` = data date per file on GitHub main / virtuse.com.
function site({ src = {}, prod = {}, missing = [], httpError = [], pulse = PULSE_OK, pulseStatus = 200, fallback = '2026-11-10T05:32:50Z', funds = '2026-11-06' } = {}) {
  const calls = [];
  const doc = (file, day) => {
    if (file === 'macro.json') return { generated: `${day}T04:17:57Z` };
    if (file === 'btc-treasuries.json') return { as_of: day, generated: `${day}T04:18:00Z` };
    return { asOf: day, generated: `${day}T04:17:53Z` };
  };
  const fetchImpl = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, body: init?.body ? JSON.parse(init.body) : null });
    if (u === 'https://api.resend.com/emails') return new Response('{"id":"e"}', { status: 200 });
    if (u.endsWith('/pulse.json')) return new Response(pulse, { status: pulseStatus });
    if (u.endsWith('news-pulse.json')) return new Response(JSON.stringify({ updated: fallback }), { status: 200 });
    const file = u.split('/').pop();
    const isRaw = u.includes('raw.githubusercontent.com');
    if (httpError.includes(file) && isRaw) return new Response('x', { status: 503 });
    if (missing.includes(file) && isRaw) return new Response('{}', { status: 200 });
    if (file === 'funds-vs-bitcoin.json') return new Response(JSON.stringify({ asOf: funds }), { status: 200 });
    const day = (isRaw ? src : prod)[file] || (isRaw ? '2026-11-26' : '2026-11-26');
    return new Response(JSON.stringify(doc(file, day)), { status: 200 });
  };
  return { fetchImpl, calls };
}

const TEN_DAYS_OLD = Object.fromEntries(DAILY_FILES.map((f) => [f.file, '2026-11-16']));

test('Bratislava day, not UTC', () => {
  assert.equal(bratislavaDay(Date.parse('2026-11-25T23:30:00Z')), '2026-11-26');
});

test('fresh data: no problems (a file one day behind, as by design, is fine)', async () => {
  const { fetchImpl } = site({ src: { 'btc-monthly-returns.json': '2026-11-25', 'bitcoin-vs-commodities.json': '2026-11-25' } });
  const r = await dataFreshnessProblems({ fetchImpl, now: NOW });
  assert.deepEqual(r.problems, []);
  assert.ok(r.notes.some((n) => /news-pulse\.json is from 2026-11-10 \(16 days old\)/.test(n)));
  assert.ok(r.notes.some((n) => /funds-vs-bitcoin\.json data as of 2026-11-06 \(20 days old\)/.test(n)));
});

test('an old asOf on GitHub is a problem', async () => {
  const { fetchImpl } = site({ src: { 'asset-returns.json': '2026-11-21' } });
  const { problems } = await dataFreshnessProblems({ fetchImpl, now: NOW });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /asset-returns\.json on GitHub main is from 2026-11-21 \(5 days old, limit 2\)/);
});

test('a missing date field and an HTTP error are problems', async () => {
  const { fetchImpl } = site({ missing: ['macro.json'], httpError: ['btc-treasuries.json'] });
  const { problems } = await dataFreshnessProblems({ fetchImpl, now: NOW });
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => /macro\.json on GitHub main has no readable "generated" date/.test(p)));
  assert.ok(problems.some((p) => /btc-treasuries\.json on GitHub main could not be read \(HTTP 503\)/.test(p)));
});

test('production copy 10 days behind: a note by default (option C), a problem with checkProdCopy', async () => {
  const { fetchImpl } = site({ prod: TEN_DAYS_OLD });
  const off = await dataFreshnessProblems({ fetchImpl, now: NOW });
  assert.deepEqual(off.problems, []);
  assert.ok(off.notes.some((n) => /^Production copies .*asset-returns\.json 10 days, bitcoin-vs-commodities\.json 10 days, .*macro\.json 10 days behind GitHub main\.$/.test(n)));
  const on = await dataFreshnessProblems({ fetchImpl, now: NOW, checkProdCopy: true });
  assert.equal(on.problems.length, 5);
  assert.ok(on.problems.every((p) => /^Production copy: .* is from 2026-11-16, 10 days behind GitHub main \(2026-11-26\)/.test(p)));
});

test('Pulse older than 4 h is a problem (read from the Worker when no KV value is given)', async () => {
  const { fetchImpl } = site({ pulse: JSON.stringify({ updated: '2026-11-25T05:51:21Z', items: [{ title: 'a', title_sk: 'a' }] }) });
  const { problems } = await dataFreshnessProblems({ fetchImpl, now: NOW });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^Pulse: last published 2026-11-25T05:51:21Z; the 2026-11-26 publish had not arrived by 06:40 UTC\.$/);
});

test('Pulse is judged at 06:40 UTC: a later run passes on time, an early run uses yesterday', async () => {
  const { fetchImpl } = site();
  const late = await dataFreshnessProblems({ fetchImpl, now: Date.parse('2026-11-26T15:00:00Z') });
  assert.deepEqual(late.problems, []);
  const yday = site({ pulse: JSON.stringify({ updated: '2026-11-25T05:40:00Z', items: [{ title: 'a', title_sk: 'a' }] }) });
  const early = await dataFreshnessProblems({ fetchImpl: yday.fetchImpl, now: Date.parse('2026-11-26T05:00:00Z') });
  assert.deepEqual(early.problems, []);
});

test('Pulse endpoint down is one problem, not two', async () => {
  const { fetchImpl } = site({ pulseStatus: 503 });
  const { problems } = await dataFreshnessProblems({ fetchImpl, now: NOW });
  assert.deepEqual(problems, ['Pulse: https://virtuse-newsletter.virtuse-ai.workers.dev/pulse.json answers HTTP 503.']);
});

const env = (o = {}) => ({ RESEND_API_KEY: 'k', RESEND_FROM_EMAIL: 'Virtuse <brief@virtuse.com>', RATE_LIMIT_KV: {}, ...o });
const mails = (calls) => calls.filter((c) => c.url === 'https://api.resend.com/emails');
async function runWith(e, opts) {
  const s = site(opts);
  const result = await runDataFreshness({ env: e, now: NOW, fetch: s.fetchImpl, services: createServices(e, s.fetchImpl) });
  return { result, calls: s.calls };
}

test('healthy day: no email', async () => {
  const { result, calls } = await runWith(env({ DATA_ALERT_TO: ALERT_TO }));
  assert.equal(result.ok, true);
  assert.equal(mails(calls).length, 0);
});

test('problem: one email, to vasilisin@virtuse.com only', async () => {
  const { result, calls } = await runWith(env({ DATA_ALERT_TO: ALERT_TO }), { src: { 'macro.json': '2026-11-20' } });
  assert.equal(result.sent, true);
  const m = mails(calls);
  assert.equal(m.length, 1);
  assert.deepEqual(m[0].body.to, ['vasilisin@virtuse.com']);
  assert.equal(m[0].body.subject, 'Virtuse data check 2026-11-26: 1 problem');
  assert.match(m[0].body.html, /macro\.json on GitHub main is from 2026-11-20/);
  assert.match(m[0].body.html, /https:\/\/virtuse\.com\/asset-returns\.html/);
  assert.doesNotMatch(JSON.stringify(m[0].body), /info@virtuse\.com/);
});

test('no DATA_ALERT_TO, or any other address: nothing is sent and info@ is never used', async () => {
  for (const to of [undefined, '', 'info@virtuse.com', 'VASILISIN@virtuse.com', 'someone@example.com']) {
    const { result, calls } = await runWith(env({ DATA_ALERT_TO: to, BRIEF_ALERT_TO: 'info@virtuse.com', VERDICT_ALERT_TO: 'info@virtuse.com' }), { src: { 'macro.json': '2026-11-20' } });
    assert.equal(result.ok, false);
    assert.equal(result.sent, false, String(to));
    assert.equal(mails(calls).length, 0, String(to));
  }
});

test('CHECK_PROD_COPY="0" keeps the production copy out; "1" turns it on', async () => {
  const off = await runWith(env({ DATA_ALERT_TO: ALERT_TO, CHECK_PROD_COPY: '0' }), { prod: TEN_DAYS_OLD });
  assert.equal(off.result.ok, true);
  const on = await runWith(env({ DATA_ALERT_TO: ALERT_TO, CHECK_PROD_COPY: '1' }), { prod: TEN_DAYS_OLD });
  assert.equal(on.result.problems.length, 5);
  assert.match(mails(on.calls)[0].body.subject, /5 problems/);
});

test('the cron runs both checks and still returns the Brief check result', async () => {
  const s = site({ src: { 'macro.json': '2026-11-20' } });
  const e = env({ DATA_ALERT_TO: ALERT_TO, PULSE_KV: { get: async () => PULSE_OK } });
  const result = await createWorker({ fetchImpl: s.fetchImpl, clock: () => NOW }).scheduled({}, e, {});
  assert.equal(typeof result.ok, 'boolean');
  assert.ok(Array.isArray(result.problems));
  const data = mails(s.calls).filter((m) => /Virtuse data check/.test(m.body.subject));
  assert.equal(data.length, 1);
  assert.deepEqual(data[0].body.to, ['vasilisin@virtuse.com']);
});
