// Deployment-wide constants. Secrets and per-environment switches are not
// here: they arrive on `env` (wrangler.toml vars, `wrangler secret put`).

// Pages allowed to call the site routes (POST /subscribe, /send, ...).
export const ALLOWED_ORIGINS = [
  'https://staging.virtuse.com',
  'https://virtuse.com',
  'https://www.virtuse.com',
];

export const STAGING_ORIGIN = 'https://staging.virtuse.com';

// Public address of this Worker, used in links inside emails.
export const WORKER_ORIGIN = 'https://virtuse-newsletter.virtuse-ai.workers.dev';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// One per-IP budget shared by the site's sign-up forms
// (POST /subscribe, /send, /waitlist).
export const SIGNUP_LIMIT = { max: 5, windowSeconds: 60 * 60 };

export function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}
