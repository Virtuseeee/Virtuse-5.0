// Daily Brief health check: what counts as a problem, and that an alert is
// emailed only when there is one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../src/app.js';
import { briefHealthProblems, pulseProblems } from '../src/features/brief-health/checks.js';

const NOW = Date.parse('2026-11-12T06:40:00Z');
const item = (o = {}) => ({ title: 'Bitcoin', excerpt: 'BTC up.', title_sk: 'Bitcoin', excerpt_sk: 'BTC rastie.', ...o });
const pulse = (o = {}) => JSON.stringify({ updated: '2026-11-12T05:32:31Z', items: [item()], archive: { items: [{ title: 'x', title_sk: 'x' }] }, ...o });

function site({ missing = [], staleData = false, wpDown = false } = {}) {
  return async (url, init) => {
    const u = String(url);
    if (u.includes('raw.githubusercontent.com')) {
      const day = staleData ? '2026-11-01' : '2026-11-12';
      return new Response(JSON.stringify({ asOf: day, generated: `${day}T03:00:00Z` }), { status: 200 });
    }
    if (u.includes('blog.virtuse.com')) {
      if (wpDown) return new Response('x', { status: 503 });
      const sk = u.includes('/sk/');
      return new Response(JSON.stringify([
        { slug: sk ? 'novy-clanok' : 'new-post', date_gmt: '2026-11-10T10:00:00', link: 'https://blog.virtuse.com/p/' },
        { slug: 'too-fresh', date_gmt: '2026-11-12T05:00:00', link: 'https://blog.virtuse.com/f/' },
      ]), { status: 200 });
    }
    if (init?.method === 'HEAD') return new Response(null, { status: missing.some((m) => u.includes(m)) ? 404 : 200 });
    return new Response('{"id":"e"}', { status: 200 });
  };
}

test('a healthy Brief has no problems', async () => {
  assert.deepEqual(await briefHealthProblems({ pulseRaw: pulse(), fetchImpl: site(), now: NOW }), []);
});

test('Pulse: stale, empty, missing Slovak copy', () => {
  assert.match(pulseProblems(null, NOW)[0], /nothing is published/);
  assert.match(pulseProblems(pulse({ updated: '2026-11-11T05:32:31Z' }), NOW)[0], /did not arrive/);
  assert.match(pulseProblems(pulse({ items: [] }), NOW)[0], /no items/);
  assert.match(pulseProblems(pulse({ items: [item({ title_sk: ' ' })] }), NOW)[0], /no title_sk/);
  assert.match(pulseProblems(pulse({ items: [item({ excerpt_sk: undefined })] }), NOW)[0], /no excerpt_sk/);
  assert.match(pulseProblems(pulse({ archive: { items: [{ title: 'x' }] } }), NOW)[0], /archive\.items\[0\]/);
});

test('a post without a story page on production is reported; a post from the last hours is not', async () => {
  const p = await briefHealthProblems({ pulseRaw: pulse(), fetchImpl: site({ missing: ['novy-clanok'] }), now: NOW });
  assert.equal(p.length, 1);
  assert.match(p[0], /sk\/stories\/novy-clanok\/ answers 404/);
});

test('old data files and an unreachable WordPress are reported', async () => {
  const p = await briefHealthProblems({ pulseRaw: pulse(), fetchImpl: site({ staleData: true, wpDown: true }), now: NOW });
  assert.equal(p.filter((x) => /^Data:/.test(x)).length, 2);
  assert.equal(p.filter((x) => /WordPress did not answer/.test(x)).length, 2);
});

function run(fetchImpl, pulseRaw) {
  const calls = [];
  const wrapped = async (url, init) => { calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null }); return fetchImpl(url, init); };
  const env = { PULSE_KV: { get: async () => pulseRaw }, RATE_LIMIT_KV: {}, RESEND_API_KEY: 'k', RESEND_FROM_EMAIL: 'Virtuse <brief@virtuse.com>' };
  return createWorker({ fetchImpl: wrapped, clock: () => NOW }).scheduled({}, env, {}).then((result) => ({ result, calls }));
}

test('scheduled: healthy day sends no email', async () => {
  const { result, calls } = await run(site(), pulse());
  assert.equal(result.ok, true);
  assert.equal(calls.filter((c) => c.url === 'https://api.resend.com/emails').length, 0);
});

test('scheduled: problems are emailed once to info@virtuse.com', async () => {
  const { result, calls } = await run(site({ missing: ['new-post'] }), null);
  assert.equal(result.ok, false);
  assert.equal(result.sent, true);
  const mails = calls.filter((c) => c.url === 'https://api.resend.com/emails');
  assert.equal(mails.length, 1);
  assert.deepEqual(mails[0].body.to, ['info@virtuse.com']);
  assert.match(mails[0].body.subject, /Virtuse Brief check 2026-11-12: 2 problems/);
  assert.match(mails[0].body.html, /nothing is published/);
});
