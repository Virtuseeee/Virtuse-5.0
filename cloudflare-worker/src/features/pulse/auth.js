// Bearer-token check for the Pulse publish routes.
//
// Both sides are HMAC'd to a fixed 32-byte digest and compared without an
// early exit, so the time taken does not depend on the secret or on how much
// of it was guessed. A missing secret never authorizes.

import { equalBytes, hmacSha256 } from '../../shared/crypto.js';

const DIGEST_KEY = 'pulse-auth';

export async function pulseAuthorized(authHeader, secret) {
  const provided = typeof authHeader === 'string' ? authHeader : '';
  const expected = typeof secret === 'string' && secret.length > 0 ? `Bearer ${secret}` : '';
  const a = await hmacSha256(DIGEST_KEY, provided);
  const b = await hmacSha256(DIGEST_KEY, expected);
  return expected.length > 0 && equalBytes(a, b);
}
