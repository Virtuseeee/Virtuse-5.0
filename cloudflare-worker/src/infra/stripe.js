// Adapter for the Stripe API (Checkout Sessions) and Stripe webhook
// signatures. Form-encoded requests, as Stripe's REST API expects.

import { equalStrings, hmacSha256Hex } from '../shared/crypto.js';

const API = 'https://api.stripe.com/v1';

// Nested objects and arrays in Stripe's form encoding:
// { line_items: [{ price: 'p' }] } -> line_items[0][price]=p
export function stripeForm(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') stripeForm(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export function createStripeClient(secretKey, fetchImpl = (...a) => globalThis.fetch(...a)) {
  return {
    // { ok, status, data }. A network error throws; the caller answers 502.
    async request(method, path, params, idempotencyKey) {
      const headers = { Authorization: `Bearer ${secretKey}` };
      let body;
      if (params) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = stripeForm(params).toString();
      }
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      const res = await fetchImpl(`${API}${path}`, { method, headers, body });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
  };
}

export function stripeSignature(secret, t, payload) {
  return hmacSha256Hex(secret, `${t}.${payload}`);
}

// Stripe-Signature: t=<unix>,v1=<hex>[,v1=...]. True when one v1 matches and
// t is within `toleranceSeconds` of now (replay window).
export async function verifyStripeSignature(secret, header, payload, nowMs, toleranceSeconds = 300) {
  if (!secret || !header || typeof header !== 'string') return false;
  let t = null;
  const sigs = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') t = v;
    else if (k === 'v1' && v) sigs.push(v);
  }
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(nowMs / 1000 - Number(t)) > toleranceSeconds) return false;
  const expected = await stripeSignature(secret, t, payload);
  return sigs.some((s) => equalStrings(s, expected));
}
