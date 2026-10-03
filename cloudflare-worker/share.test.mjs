import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleShare, shareMetaFromPost, renderSharePage, clipText, htmlToText } from './src/index.js';

const POST = {
  date_gmt: '2026-09-28T10:00:00',
  modified_gmt: '2026-09-28T11:00:00',
  title: { rendered: 'Five Percent Yields &#038; an &#8220;Empty&#8221; Bid' },
  excerpt: { rendered: '<p>Foreign Treasury demand has fallen 80 percent. The 10&#8209;year is back above 5 percent.</p>\n' },
  _embedded: {
    'wp:featuredmedia': [{
      source_url: 'https://blog.virtuse.com/wp-content/uploads/hero.jpg',
      alt_text: 'Scooter',
      media_details: { width: 1600, height: 900, sizes: { large: { source_url: 'https://blog.virtuse.com/wp-content/uploads/hero-1024x576.jpg', width: 1024, height: 576 } } },
    }],
  },
};

function fakeFetch(map) {
  const calls = [];
  const fn = async (u) => {
    calls.push(u);
    for (const [k, v] of Object.entries(map)) if (u.includes(k)) return new Response(JSON.stringify(v), { status: 200 });
    return new Response('[]', { status: 200 });
  };
  fn.calls = calls;
  return fn;
}

test('meta from post: decoded title, plain excerpt, large image, canonical', () => {
  const m = shareMetaFromPost(POST, 'five', 'en');
  assert.equal(m.title, 'Five Percent Yields & an \u201CEmpty\u201D Bid');
  assert.match(m.description, /^Foreign Treasury demand has fallen 80 percent\. The 10\u2011year/);
  assert.equal(m.image, 'https://blog.virtuse.com/wp-content/uploads/hero-1024x576.jpg');
  assert.equal(m.imageWidth, 1024);
  assert.equal(m.url, 'https://virtuse.com/article.html?slug=five');
  assert.equal(shareMetaFromPost(POST, 'five', 'sk').url, 'https://virtuse.com/article.html?slug=five&lang=sk');
});

test('no featured image falls back to generic card', () => {
  const m = shareMetaFromPost({ title: { rendered: 'X' }, excerpt: { rendered: '' }, content: { rendered: '<p>Body text</p>' } }, 'x', 'en');
  assert.equal(m.image, 'https://virtuse.com/news/og-card.png?v=20260921');
  assert.equal(m.description, 'Body text');
});

test('clipText trims on word boundary with ellipsis', () => {
  const long = 'word '.repeat(100);
  const c = clipText(long, 200);
  assert.ok(c.length <= 200, c.length);
  assert.ok(c.endsWith('\u2026'));
  assert.equal(clipText('Short [&hellip;]'), 'Short');
  assert.equal(htmlToText('<p>a<script>x</script> b&nbsp;c</p>'), 'a b c');
});

test('render escapes everything and has all required tags', () => {
  const html = renderSharePage({ ...shareMetaFromPost(POST, 'five', 'en'), title: '"><script>alert(1)</script>', description: "O'Brien & <b>", url: 'https://virtuse.com/article.html?slug=a&lang=sk' });
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&quot;&gt;&lt;script&gt;'));
  assert.ok(html.includes('O&#39;Brien &amp; &lt;b&gt;'));
  assert.ok(html.includes('href="https://virtuse.com/article.html?slug=a&amp;lang=sk"'));
  for (const t of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type" content="article', 'og:site_name" content="Virtuse"', 'twitter:card" content="summary_large_image', 'twitter:title', 'twitter:description', 'twitter:image', 'rel="canonical"', 'http-equiv="refresh"', 'location.replace(']) {
    assert.ok(html.includes(t), t);
  }
});

test('handleShare EN: 200, cached 1h, hits EN API', async () => {
  const f = fakeFetch({ 'slug=five': [POST] });
  const res = await handleShare(new Request('https://w/a/five?utm_source=x'), new URL('https://w/a/five?utm_source=x'), { fetchImpl: f });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=3600');
  assert.match(res.headers.get('Content-Type'), /text\/html/);
  assert.ok(f.calls[0].startsWith('https://blog.virtuse.com/wp-json/wp/v2/posts?slug=five'));
  const body = await res.text();
  assert.ok(body.includes('<link rel="canonical" href="https://virtuse.com/article.html?slug=five">'));
});

test('handleShare SK uses WPML /sk/ API and &lang=sk canonical', async () => {
  const f = fakeFetch({ 'slug=pat': [POST] });
  const res = await handleShare(new Request('https://w/a/pat?lang=sk'), new URL('https://w/a/pat?lang=sk'), { fetchImpl: f });
  assert.equal(res.status, 200);
  assert.ok(f.calls[0].startsWith('https://blog.virtuse.com/sk/wp-json/wp/v2/posts?slug=pat'));
  assert.ok((await res.text()).includes('slug=pat&amp;lang=sk'));
});

test('unknown slug -> 404 generic; bad slug -> 404 without fetch', async () => {
  const f = fakeFetch({});
  const r1 = await handleShare(new Request('https://w/a/nope'), new URL('https://w/a/nope'), { fetchImpl: f });
  assert.equal(r1.status, 404);
  assert.ok((await r1.text()).includes('og-card.png'));
  const r2 = await handleShare(new Request('https://w/a/%3Cscript%3E'), new URL('https://w/a/%3Cscript%3E'), { fetchImpl: f });
  assert.equal(r2.status, 404);
  assert.equal(f.calls.length, 1);
});

test('WP error -> 200 page that still redirects to article, short cache', async () => {
  const f = async () => new Response('err', { status: 502 });
  const res = await handleShare(new Request('https://w/a/five'), new URL('https://w/a/five'), { fetchImpl: f });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=60');
  assert.ok((await res.text()).includes('location.replace("https://virtuse.com/article.html?slug=five")'));
});

test('WP transient failure is retried once', async () => {
  let n = 0;
  const f = async () => (++n === 1 ? new Response('err', { status: 503 }) : new Response(JSON.stringify([POST]), { status: 200 }));
  const res = await handleShare(new Request('https://w/a/five'), new URL('https://w/a/five'), { fetchImpl: f });
  assert.equal(res.status, 200);
  assert.equal(n, 2);
  assert.ok((await res.text()).includes('Five Percent Yields &amp; an'));
});

test('cache: second request served from cache without WP fetch', async () => {
  const store = new Map();
  const cache = { match: async (r) => store.get(r.url)?.clone(), put: async (r, res) => { store.set(r.url, res); } };
  const f = fakeFetch({ 'slug=five': [POST] });
  await handleShare(new Request('https://w/a/five'), new URL('https://w/a/five'), { fetchImpl: f, cache });
  const r2 = await handleShare(new Request('https://w/a/five?utm=1'), new URL('https://w/a/five?utm=1'), { fetchImpl: f, cache });
  assert.equal(r2.status, 200);
  assert.equal(f.calls.length, 1);
});

test('router: /a/ is public (no Origin), other routes unchanged', async () => {
  const env = {};
  const origFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch({ 'slug=five': [POST] });
  try {
    const r = await worker.fetch(new Request('https://w/a/five'), env);
    assert.equal(r.status, 200);
    const r403 = await worker.fetch(new Request('https://w/other'), env);
    assert.equal(r403.status, 403);
  } finally {
    globalThis.fetch = origFetch;
  }
});
