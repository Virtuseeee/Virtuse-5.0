import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleWpProxy } from './src/wp-proxy.js';

const BASE = 'https://virtuse-newsletter.virtuse-ai.workers.dev';

function fakeFetch(calls, { status = 200, body = '[]', headers = {} } = {}) {
  return async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status, headers: { 'content-type': 'application/json', ...headers } });
  };
}
const req = (path, method = 'GET') => {
  const url = new URL(BASE + path);
  return [new Request(url, { method }), url];
};

test('forwards allowed posts path with query string', async () => {
  const calls = [];
  const [r, u] = req('/wp/sk/wp-json/wp/v2/posts?categories=26&per_page=100&page=2');
  const res = await handleWpProxy(r, u, fakeFetch(calls, { headers: { 'x-wp-totalpages': '3', 'set-cookie': 'a=b' } }));
  assert.equal(res.status, 200);
  assert.equal(calls[0].url, 'https://blog.virtuse.com/sk/wp-json/wp/v2/posts?categories=26&per_page=100&page=2');
  assert.equal(res.headers.get('x-wp-totalpages'), '3');
  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal(await res.text(), '[]');
});

test('rejects paths outside the allowlist', async () => {
  for (const p of ['/wp/wp-admin/', '/wp/wp-login.php', '/wp/wp-json/wp/v2/users', '/wp/../wp-json/wp/v2/posts', '/wp/']) {
    const calls = [];
    const [r, u] = req(p);
    const res = await handleWpProxy(r, u, fakeFetch(calls));
    assert.equal(res.status, 404, p);
    assert.equal(calls.length, 0, p);
  }
});

test('rejects non-GET methods', async () => {
  const calls = [];
  const [r, u] = req('/wp/wp-json/wp/v2/posts', 'POST');
  const res = await handleWpProxy(r, u, fakeFetch(calls));
  assert.equal(res.status, 405);
  assert.equal(calls.length, 0);
});

test('HEAD works for the probe and returns no body', async () => {
  const calls = [];
  const [r, u] = req('/wp/wp-json/', 'HEAD');
  const res = await handleWpProxy(r, u, fakeFetch(calls, { body: null }));
  assert.equal(res.status, 200);
  assert.equal(calls[0].init.method, 'HEAD');
});

test('upstream errors are passed through uncached, network failure is 502', async () => {
  const [r, u] = req('/wp/wp-json/wp/v2/posts');
  const res = await handleWpProxy(r, u, fakeFetch([], { status: 503, body: 'busy' }));
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const [r2, u2] = req('/wp/wp-json/wp/v2/posts');
  const res2 = await handleWpProxy(r2, u2, async () => { throw new Error('connect timeout'); });
  assert.equal(res2.status, 502);
});
