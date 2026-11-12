import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const OPEN = { VERDICT_PAYMENTS: '1', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PRICE_ID_VERDICT: 'price_x' };

test('GET /verdict/status: payments open', async () => {
  const res = await worker.fetch(new Request('https://w.example/verdict/status'), OPEN);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { payments: true });
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.match(res.headers.get('cache-control'), /max-age=60/);
});

test('GET /verdict/status: closed when VERDICT_PAYMENTS is off or Stripe is missing', async () => {
  for (const env of [{}, { ...OPEN, VERDICT_PAYMENTS: '0' }, { ...OPEN, STRIPE_PRICE_ID_VERDICT: '' },
    { ...OPEN, STRIPE_TEST_ONLY: '1', STRIPE_SECRET_KEY: 'sk_live_x' }]) {
    const res = await worker.fetch(new Request('https://w.example/verdict/status'), env);
    assert.deepEqual(await res.json(), { payments: false });
  }
});

test('GET /verdict/status reveals nothing but the boolean', async () => {
  const res = await worker.fetch(new Request('https://w.example/verdict/status'), OPEN);
  assert.deepEqual(Object.keys(await res.json()), ['payments']);
});

test('POST /verdict/status is not the status route', async () => {
  const res = await worker.fetch(new Request('https://w.example/verdict/status', { method: 'POST', headers: { Origin: 'https://virtuse.com' } }), OPEN);
  assert.notEqual(res.status, 200);
});
