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

// Cloudflare Turnstile on the public forms (/subscribe, /send, /waitlist), security audit 2026-11-16.
// Off unless the Worker var TURNSTILE_FORMS is "require" and TURNSTILE_SECRET_KEY is set. Then a request
// without a valid token gets 403 { code: 'captcha', sitekey }; vb-api.js on the site loads the widget
// only at that moment, gets a token and repeats the request once. So nothing from Turnstile runs in
// a visitor's browser while the switch is off. Same widget as the ecosystem form (public site key).
export const TURNSTILE_SITEKEY = '0x4AAAAAAFheOLDBd1DyVOhF';
export const TURNSTILE_FORM_HOSTS = ['virtuse.com', 'www.virtuse.com', 'staging.virtuse.com'];

export function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}
