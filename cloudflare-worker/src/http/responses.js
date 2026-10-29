// Response builders for the site routes (browser fetch() from virtuse.com).

import { ALLOWED_ORIGINS, isAllowedOrigin } from '../config.js';

// A disallowed origin gets the first allowed one back, so the browser
// blocks the response instead of the Worker echoing an arbitrary origin.
export function corsHeaders(origin) {
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export function preflight(origin) {
  return new Response(null, { headers: corsHeaders(origin) });
}

export function html(status, body) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
