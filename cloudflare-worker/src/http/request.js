// Reading the parts of an incoming request every route needs.

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// { ok: true, value } or { ok: false } when the body is not valid JSON.
export async function readJson(request) {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}
