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

// Emails per clock hour that the public forms may trigger, for all visitors
// together (shared/email-cap.js). forms: /subscribe, /send, /waitlist.
// withdraw: the confirmation of /verdict/withdraw. Override per Worker with
// EMAIL_CAP_FORMS_PER_HOUR / EMAIL_CAP_WITHDRAW_PER_HOUR.
export const EMAIL_CAPS = { forms: 120, withdraw: 30 };

export function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}
