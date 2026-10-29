// Signed one-click unsubscribe links.
//
// The link carries the address plus HMAC-SHA256(UNSUB_SECRET, address), so
// a link only ever unsubscribes the address it was sent to and nobody can
// build one for someone else. No login, no second confirmation step.

import { WORKER_ORIGIN } from '../../config.js';
import { equalStrings, hmacSha256Hex } from '../../shared/crypto.js';

export async function unsubscribeUrl(secret, email) {
  const token = await hmacSha256Hex(secret, email);
  return `${WORKER_ORIGIN}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

export async function verifyUnsubscribeToken(secret, email, token) {
  return equalStrings(await hmacSha256Hex(secret, email), token);
}
