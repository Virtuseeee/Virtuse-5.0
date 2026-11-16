// Reading the parts of an incoming request every route needs.

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// The JSON routes carry an address, a few ids and numbers; nothing legitimate comes near this.
export const MAX_JSON_BYTES = 16 * 1024;

// { ok: true, value }, or { ok: false } when the body is not valid JSON,
// or { ok: false, tooLarge: true } when it is over maxBytes (checked on the
// Content-Length header first, then on what was actually read).
export async function readJson(request, maxBytes = MAX_JSON_BYTES) {
  if (parseInt(request.headers.get('Content-Length') || '0', 10) > maxBytes) return { ok: false, tooLarge: true };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > maxBytes) return { ok: false, tooLarge: true };
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}
