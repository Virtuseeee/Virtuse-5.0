import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { handlePulse, pulseErrors } from './src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIVE = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'news-pulse.sample.json'), 'utf8'));
const TOKEN = 'test-token';
const ORIGIN = 'https://virtuse.com';
const NOW = Date.parse('2026-09-28T12:00:00Z');

function validPulse(overrides = {}) {
  return {
    updated: '2026-09-28T12:00:00Z',
    items: [
      {
        title: 'Bitcoin holds above $80,000',
        source: 'Example',
        tag: 'Policy',
        url: 'https://example.com/bitcoin',
        published: '2026-09-28T11:00:00Z',
        excerpt: 'BTC was little changed on the day.',
      },
    ],
    archive: { label: 'Yesterday', items: [] },
    market: {
      btc_usd: 80000,
      change_24h_pct: 0.1,
      fees: 'low',
      fee_sat_vb: 1,
      sources: 'example',
    },
    ...overrides,
  };
}

function mockKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  const puts = [];
  const gets = [];
  return {
    store,
    puts,
    gets,
    async get(key, opts) {
      gets.push({ key, opts });
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, opts) {
      puts.push({ key, value, opts });
      store.set(key, value);
    },
  };
}

function envFor(kv, token = TOKEN) {
  return { PULSE_KV: kv, PULSE_PUBLISH_TOKEN: token };
}

function pulseRequest(method, pathname, { origin, token, body, contentLength } = {}) {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);
  if (contentLength != null) headers.set('Content-Length', String(contentLength));
  return new Request(`https://virtuse-newsletter.virtuse-ai.workers.dev${pathname}`, {
    method,
    headers,
    body: body === undefined || method === 'GET' || method === 'HEAD' ? undefined : body,
  });
}

test('live gh-pages news-pulse.json passes validation', () => {
  assert.deepEqual(pulseErrors(LIVE, NOW), []);
});

test('pulseErrors rejects schema violations', () => {
  const future = validPulse({ updated: '2026-09-30T12:00:00Z' });
  assert.ok(pulseErrors(future, NOW).some((e) => e.includes('36 hours')));

  const noBtc = validPulse();
  noBtc.items[0].title = 'Markets were quiet overnight';
  noBtc.items[0].excerpt = 'Equities led the session.';
  assert.ok(pulseErrors(noBtc, NOW).some((e) => e.includes('Bitcoin or BTC')));

  const four = validPulse();
  four.items = [...four.items, ...four.items, ...four.items, ...four.items];
  assert.ok(pulseErrors(four, NOW).some((e) => e.includes('1 to 3')));

  const yesterday = validPulse();
  const yItem = {
    title: 'Bitcoin yesterday',
    source: 'Example',
    tag: 'ETF',
    url: 'https://example.com/y',
    published: '2026-09-27T11:00:00Z',
  };
  yesterday.archive.items = [yItem, yItem, yItem];
  assert.ok(pulseErrors(yesterday, NOW).some((e) => e.includes('at most 2')));

  const badMarket = validPulse();
  badMarket.market.btc_usd = '83890';
  assert.ok(pulseErrors(badMarket, NOW).some((e) => e.startsWith('market.btc_usd')));

  assert.ok(pulseErrors(validPulse({ updated: '26 Sep 2026' }), NOW).some((e) => e.startsWith('updated')));
  assert.ok(pulseErrors([], NOW).some((e) => e.includes('JSON object')));
});

test('GET /pulse.json serves KV current with CORS and cache headers', async () => {
  const raw = JSON.stringify(validPulse());
  const kv = mockKv({ current: raw });
  const res = await handlePulse(pulseRequest('GET', '/pulse.json', { origin: ORIGIN }), envFor(kv), ORIGIN, '/pulse.json');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), raw);
  assert.equal(res.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=60');
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(res.headers.get('Vary'), 'Origin');
  assert.equal(kv.gets[0].opts.cacheTtl, 60);
});

test('GET echoes CORS only for the three site origins and 404s when empty', async () => {
  const empty = await handlePulse(
    pulseRequest('GET', '/pulse.json', { origin: 'https://evil.example' }),
    envFor(mockKv()),
    'https://evil.example',
    '/pulse.json'
  );
  assert.equal(empty.status, 404);
  assert.deepEqual(await empty.json(), { error: 'no pulse' });
  assert.equal(empty.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(empty.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(empty.headers.get('Cache-Control'), 'no-store');

  for (const origin of ['https://virtuse.com', 'https://www.virtuse.com', 'https://staging.virtuse.com']) {
    const res = await handlePulse(
      pulseRequest('GET', '/pulse.json', { origin }),
      envFor(mockKv({ current: '{}' })),
      origin,
      '/pulse.json'
    );
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), origin);
  }
});

test('OPTIONS /pulse.json is a CORS preflight for allowed origins only', async () => {
  const ok = await handlePulse(pulseRequest('OPTIONS', '/pulse.json', { origin: ORIGIN }), envFor(mockKv()), ORIGIN, '/pulse.json');
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.match(ok.headers.get('Access-Control-Allow-Methods'), /GET/);
  assert.match(ok.headers.get('Access-Control-Allow-Methods'), /OPTIONS/);
  assert.equal(await ok.text(), '');

  const blocked = await handlePulse(
    pulseRequest('OPTIONS', '/pulse.json', { origin: 'https://evil.example' }),
    envFor(mockKv()),
    'https://evil.example',
    '/pulse.json'
  );
  assert.equal(blocked.status, 204);
  assert.equal(blocked.headers.get('Access-Control-Allow-Origin'), null);
});

test('PUT requires the bearer token, compared so a wrong or missing secret is rejected', async () => {
  const body = JSON.stringify(validPulse());
  const kv = mockKv({ current: '{"old":true}' });
  const wrong = await handlePulse(
    pulseRequest('PUT', '/pulse.json', { token: 'nope', body }),
    envFor(kv),
    '',
    '/pulse.json'
  );
  assert.equal(wrong.status, 401);
  assert.equal(kv.puts.length, 0);

  const missing = await handlePulse(
    pulseRequest('PUT', '/pulse.json', { token: TOKEN, body }),
    envFor(kv, ''),
    '',
    '/pulse.json'
  );
  assert.equal(missing.status, 401);
  assert.equal(kv.puts.length, 0);

  const prefix = await handlePulse(
    pulseRequest('PUT', '/pulse.json', { token: TOKEN.slice(0, 4), body }),
    envFor(kv),
    '',
    '/pulse.json'
  );
  assert.equal(prefix.status, 401);
});

test('PUT stores current, copies the old value to previous, and writes a 60-day dated key', async () => {
  const first = JSON.stringify(validPulse());
  const secondDoc = validPulse({ updated: '2026-09-28T15:00:00Z' });
  secondDoc.items[0].title = 'Bitcoin slips after the open';
  const second = JSON.stringify(secondDoc);
  const kv = mockKv();

  const created = await handlePulse(
    pulseRequest('PUT', '/pulse.json', { token: TOKEN, body: first }),
    envFor(kv),
    '',
    '/pulse.json'
  );
  assert.equal(created.status, 200);
  const createdBody = await created.json();
  assert.equal(createdBody.ok, true);
  assert.equal(createdBody.items, 1);
  assert.equal(createdBody.yesterday, 0);
  assert.equal(createdBody.datedKey, 'pulse-2026-09-28');
  assert.equal(kv.store.get('current'), first);
  assert.equal(kv.store.has('previous'), false);
  assert.equal(kv.store.get('pulse-2026-09-28'), first);
  assert.equal(kv.puts.find((p) => p.key === 'pulse-2026-09-28').opts.expirationTtl, 60 * 24 * 60 * 60);

  const updated = await handlePulse(
    pulseRequest('PUT', '/pulse.json', { token: TOKEN, body: second }),
    envFor(kv),
    '',
    '/pulse.json'
  );
  assert.equal(updated.status, 200);
  assert.equal(kv.store.get('current'), second);
  assert.equal(kv.store.get('previous'), first);
});

test('PUT returns 400 and does not write when validation fails', async () => {
  const kv = mockKv({ current: 'keep' });
  const cases = [
    '{',
    JSON.stringify([]),
    JSON.stringify(validPulse({ market: { btc_usd: 1 } })),
    'x'.repeat(20 * 1024),
  ];
  for (const body of cases) {
    const before = kv.puts.length;
    const res = await handlePulse(
      pulseRequest('PUT', '/pulse.json', { token: TOKEN, body }),
      envFor(kv),
      '',
      '/pulse.json'
    );
    assert.equal(res.status, 400, body.slice(0, 40));
    const payload = await res.json();
    assert.equal(payload.error, 'validation failed');
    assert.ok(Array.isArray(payload.errors) && payload.errors.length > 0);
    assert.equal(kv.puts.length, before);
    assert.equal(kv.store.get('current'), 'keep');
  }
});

test('POST /pulse/rollback restores previous onto current', async () => {
  const kv = mockKv({ current: 'new', previous: JSON.stringify(validPulse()) });
  const denied = await handlePulse(
    pulseRequest('POST', '/pulse/rollback', { token: 'nope' }),
    envFor(kv),
    '',
    '/pulse/rollback'
  );
  assert.equal(denied.status, 401);
  assert.equal(kv.store.get('current'), 'new');

  const res = await handlePulse(
    pulseRequest('POST', '/pulse/rollback', { token: TOKEN }),
    envFor(kv),
    '',
    '/pulse/rollback'
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.restored, true);
  assert.equal(body.updated, '2026-09-28T12:00:00Z');
  assert.equal(kv.store.get('current'), JSON.stringify(validPulse()));
  assert.equal(kv.store.get('previous'), JSON.stringify(validPulse()));

  const empty = mockKv({ current: 'only' });
  const missing = await handlePulse(
    pulseRequest('POST', '/pulse/rollback', { token: TOKEN }),
    envFor(empty),
    '',
    '/pulse/rollback'
  );
  assert.equal(missing.status, 404);
  assert.equal(empty.store.get('current'), 'only');
});

test('newsletter routes are unchanged', async () => {
  const opt = await worker.fetch(
    new Request('https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN },
    }),
    {}
  );
  assert.equal(opt.status, 200);
  assert.equal(opt.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(opt.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assert.equal(opt.headers.get('Access-Control-Allow-Headers'), 'Content-Type');

  const blocked = await worker.fetch(
    new Request('https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: '{}',
    }),
    {}
  );
  assert.equal(blocked.status, 403);
  assert.deepEqual(await blocked.json(), { error: 'Origin not allowed' });

  const unsub = await worker.fetch(
    new Request('https://virtuse-newsletter.virtuse-ai.workers.dev/unsubscribe', { method: 'GET' }),
    {}
  );
  assert.equal(unsub.status, 400);
  assert.match(unsub.headers.get('Content-Type'), /text\/html/);

  const viaFetch = await worker.fetch(
    pulseRequest('GET', '/pulse.json', { origin: ORIGIN }),
    envFor(mockKv())
  );
  assert.equal(viaFetch.status, 404);
});
