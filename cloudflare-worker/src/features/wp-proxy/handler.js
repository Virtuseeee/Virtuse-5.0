// Read-only proxy for the WordPress REST API on blog.virtuse.com.
//
// Why: Webglobe drops TCP connections from part of GitHub's runner IPs, so
// the Stories build (stories-build/build.mjs) timed out on some runners.
// Through this route the build talks to Cloudflare and Cloudflare talks to
// Webglobe.
//
//   GET https://<worker>/wp/wp-json/wp/v2/posts?...    -> blog.virtuse.com/wp-json/wp/v2/posts?...
//   GET https://<worker>/wp/sk/wp-json/wp/v2/posts?... -> blog.virtuse.com/sk/wp-json/wp/v2/posts?...
//
// Only these public, read-only paths are forwarded (GET/HEAD), with only the
// query parameters the build uses (ALLOWED_PARAMS), so the route
// is not an open proxy and never reaches wp-admin, login or POST endpoints.
// Responses are cached by Cloudflare for a few minutes; WordPress answers a
// posts query in 8-18 s, so repeated build attempts mostly hit the cache.

export const WP_ORIGIN = 'https://blog.virtuse.com';
export const WP_PREFIX = '/wp';
const ALLOWED_PATHS = new Set([
  '/wp-json/',
  '/wp-json/wp/v2/posts',
  '/sk/wp-json/wp/v2/posts',
]);
// The query parameters stories-build/build.mjs sends. Anything else is refused: a random
// parameter would be a new cache key each time (WordPress answers in 8-18 s), and
// rest_route would let the caller pick a different REST route than the path says.
const ALLOWED_PARAMS = new Set(['categories', 'per_page', 'page', '_embed', '_fields', 'orderby', 'order', 'lang', 'slug']);
const MAX_PARAM_LENGTH = 200;
const CACHE_TTL = 300; // seconds

// true when every parameter is on the list, appears once and is short.
export function allowedQuery(searchParams) {
  const seen = new Set();
  for (const [k, v] of searchParams) {
    if (!ALLOWED_PARAMS.has(k) || seen.has(k) || v.length > MAX_PARAM_LENGTH) return false;
    seen.add(k);
  }
  const perPage = searchParams.get('per_page');
  return perPage === null || (/^\d{1,3}$/.test(perPage) && +perPage >= 1 && +perPage <= 100);
}
// Headers worth passing back: the build reads X-WP-TotalPages for paging.
const PASS_HEADERS = ['content-type', 'x-wp-total', 'x-wp-totalpages', 'last-modified', 'etag'];

export async function handleWpProxy(request, url, fetchImpl = fetch) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const path = url.pathname.slice(WP_PREFIX.length) || '/';
  if (!ALLOWED_PATHS.has(path)) {
    return new Response('Not found', { status: 404 });
  }
  if (!allowedQuery(url.searchParams)) {
    return new Response('Bad request', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const upstream = WP_ORIGIN + path + url.search;
  let res;
  try {
    res = await fetchImpl(upstream, {
      method: request.method,
      headers: { 'User-Agent': 'virtuse-wp-proxy', Accept: 'application/json' },
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'upstream unreachable', detail: String(e && e.message || e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = res.headers.get(h);
    if (v != null) headers.set(h, v);
  }
  headers.set('Cache-Control', res.ok ? `public, max-age=${CACHE_TTL}` : 'no-store');
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(request.method === 'HEAD' ? null : res.body, { status: res.status, headers });
}
