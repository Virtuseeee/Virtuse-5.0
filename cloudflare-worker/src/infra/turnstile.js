// Adapter for Cloudflare Turnstile siteverify. Returns true only for a token
// Turnstile issued on one of `allowedHosts`; every failure is a plain false.

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile({ secret, token, ip, allowedHosts, fetchImpl = (...a) => globalThis.fetch(...a) }) {
  if (!token || typeof token !== 'string' || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip && ip !== 'unknown') form.append('remoteip', ip);
  try {
    const res = await fetchImpl(SITEVERIFY, { method: 'POST', body: form });
    const out = await res.json();
    const ok = !!(out && out.success === true && allowedHosts.includes(out.hostname));
    if (!ok) console.warn('turnstile rejected', JSON.stringify({ codes: out && out['error-codes'], hostname: out && out.hostname }));
    return ok;
  } catch (e) {
    console.error('turnstile siteverify failed', e);
    return false;
  }
}
