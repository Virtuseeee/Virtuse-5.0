// GET|HEAD|OPTIONS /pulse.json   public, CORS for the site origins
// PUT /pulse.json                 publish; Bearer PULSE_PUBLISH_TOKEN
// POST /pulse/rollback            copy KV `previous` back onto `current`
//
// Not behind the site-origin gate: browsers on virtuse.com GET it, and the
// daily publisher is curl with a bearer secret (no Origin).
//
// KV keys (PULSE_KV):
//   current            -- the document GET serves
//   previous           -- the document overwritten by the last successful PUT
//   pulse-YYYY-MM-DD   -- dated copy of that PUT (expirationTtl 60 days)

import { isAllowedOrigin } from '../../config.js';
import { byteLength } from '../../shared/crypto.js';
import { pulseAuthorized } from './auth.js';
import { PULSE_MAX_BYTES, pulseErrors } from './schema.js';

const PULSE_KEY = 'current';
const PULSE_PREV_KEY = 'previous';
const PULSE_DATED_TTL_SECONDS = 60 * 24 * 60 * 60;

function pulsePublicHeaders(origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
  }
  return headers;
}

function pulsePrivateJson(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function pulseDatedKey(updated) {
  return `pulse-${String(updated).slice(0, 10)}`;
}

async function handlePulseGet(request, env, origin) {
  const headers = pulsePublicHeaders(origin);
  const body = await env.PULSE_KV.get(PULSE_KEY, { cacheTtl: 60 });
  if (!body) {
    // Don't cache the empty state: a publish in the next minute should show up.
    headers['Cache-Control'] = 'no-store';
    return new Response(JSON.stringify({ error: 'no pulse' }), { status: 404, headers });
  }
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
}

function pulsePreflight(origin) {
  const headers = {
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return new Response(null, { status: 204, headers });
}

export async function handlePulse(request, env, origin, pathname) {
  if (pathname === '/pulse.json' && request.method === 'OPTIONS') {
    return pulsePreflight(origin);
  }

  if (pathname === '/pulse.json' && (request.method === 'GET' || request.method === 'HEAD')) {
    return handlePulseGet(request, env, origin);
  }

  if (pathname === '/pulse.json' && request.method === 'PUT') {
    if (!(await pulseAuthorized(request.headers.get('Authorization'), env.PULSE_PUBLISH_TOKEN))) {
      return pulsePrivateJson(401, { error: 'unauthorized' });
    }

    const declared = request.headers.get('Content-Length');
    if (declared && Number(declared) > PULSE_MAX_BYTES) {
      return pulsePrivateJson(400, {
        error: 'validation failed',
        errors: ['body must be at most 16 KB'],
      });
    }

    const text = await request.text();
    if (byteLength(text) > PULSE_MAX_BYTES) {
      return pulsePrivateJson(400, {
        error: 'validation failed',
        errors: ['body must be at most 16 KB'],
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return pulsePrivateJson(400, {
        error: 'validation failed',
        errors: ['body must be valid JSON'],
      });
    }

    const errors = pulseErrors(data);
    if (errors.length) {
      return pulsePrivateJson(400, { error: 'validation failed', errors });
    }

    const previous = await env.PULSE_KV.get(PULSE_KEY);
    if (previous != null) {
      await env.PULSE_KV.put(PULSE_PREV_KEY, previous);
    }
    await env.PULSE_KV.put(PULSE_KEY, text);
    const datedKey = pulseDatedKey(data.updated);
    await env.PULSE_KV.put(datedKey, text, { expirationTtl: PULSE_DATED_TTL_SECONDS });

    const yesterday = data.archive.items.length;
    return pulsePrivateJson(200, {
      ok: true,
      updated: data.updated,
      items: data.items.length,
      yesterday,
      bytes: byteLength(text),
      datedKey,
      ttlDays: 60,
    });
  }

  if (pathname === '/pulse/rollback' && request.method === 'POST') {
    if (!(await pulseAuthorized(request.headers.get('Authorization'), env.PULSE_PUBLISH_TOKEN))) {
      return pulsePrivateJson(401, { error: 'unauthorized' });
    }
    const previous = await env.PULSE_KV.get(PULSE_PREV_KEY);
    if (previous == null) {
      return pulsePrivateJson(404, { error: 'no previous pulse' });
    }
    await env.PULSE_KV.put(PULSE_KEY, previous);
    let updated = null;
    try {
      updated = JSON.parse(previous).updated ?? null;
    } catch {
      updated = null;
    }
    return pulsePrivateJson(200, { ok: true, restored: true, updated });
  }

  return pulsePrivateJson(405, { error: 'method not allowed' });
}
