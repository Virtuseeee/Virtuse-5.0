import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TERMS_VERSION, RESULT_TTL, PAID_TTL } from '../src/features/verdict-pay/domain.js';
import { createPayStore } from '../src/features/verdict-pay/store.js';
import { archiveDir, currentWording } from '../../legal-archive/snapshot.mjs';

test('the pages say what the archive for TERMS_VERSION says', () => {
  for (const [name, text] of currentWording()) {
    const archived = readFileSync(path.join(archiveDir(TERMS_VERSION), name), 'utf8');
    assert.equal(text, archived, `${name} changed: set a new TERMS_VERSION and run node legal-archive/snapshot.mjs`);
  }
});

test('answers expire after 24 h and the order record after 30 days, as privacy section 9 says', async () => {
  const puts = [];
  const kv = { put: async (k, v, o) => puts.push([k, o]), get: async () => null };
  const store = createPayStore(kv);
  await store.storeLite('a'.repeat(32), { age: 40 }, 'en');
  await store.markPaid({ id: 'cs_test_x', metadata: { rid: 'a'.repeat(32) }, payment_intent: 'pi_x' }, 1);
  assert.deepEqual(puts[0], [`verdict:res:${'a'.repeat(32)}`, { expirationTtl: RESULT_TTL }]);
  assert.equal(RESULT_TTL, 86400);
  assert.equal(PAID_TTL, 30 * 86400);
  for (const [, o] of puts) assert.ok(o.expirationTtl > 0 && o.expirationTtl <= PAID_TTL);
});
