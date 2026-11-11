// Small WebCrypto helpers shared by the features. Pure functions of their
// inputs; nothing here reads env or does I/O.

const encoder = new TextEncoder();

export function toHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

// HMAC-SHA256 with a raw byte key, as base64 (Svix / Resend webhooks).
export async function hmacSha256Base64(keyBytes, message) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return btoa(String.fromCharCode(...sig));
}

export async function hmacSha256Hex(secret, message) {
  return toHex(await hmacSha256(secret, message));
}

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

// Compares two strings without stopping at the first difference. A length
// mismatch returns early (the length of a hex token is public anyway).
export function equalStrings(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Compares two byte arrays without an early exit, also on a length mismatch.
export function equalBytes(a, b) {
  let diff = a.length === b.length ? 0 : 1;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function byteLength(text) {
  return encoder.encode(text).length;
}

// Privacy policy: the IP is kept only as a one-way hash, salted per day
// (salt = secret + date), and the counter expires after at most 24 hours.
export async function ipHash(ip, day, env) {
  return sha256Hex(`${env.UNSUB_SECRET || 'virtuse'}:${day}:${ip}`);
}
