import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from './src/index.js';

test('GET /version answers without an Origin and never caches', async () => {
  const res = await worker.fetch(new Request('https://w.example/version'), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.ok('commit' in (await res.json()));
});

test('POST /version is not the version route', async () => {
  const res = await worker.fetch(new Request('https://w.example/version', { method: 'POST' }), {});
  assert.notEqual(res.status, 200);
});

test('build.mjs stamps the commit into dist/worker.js', () => {
  const dist = readFileSync(new URL('./dist/worker.js', import.meta.url), 'utf8');
  assert.ok(!dist.includes('"__BUILD_COMMIT__"'));
});
