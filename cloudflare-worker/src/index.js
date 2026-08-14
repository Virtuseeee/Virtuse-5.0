// Virtuse newsletter signup proxy.
//
// The site is fully static (GitHub Pages, no server of its own), and
// Resend's API requires a secret key for every call -- including adding a
// contact -- so it can never be called directly from the form's frontend
// JS. This Worker is the one piece of server-side compute in the whole
// stack: it holds the Resend secret, validates + rate-limits the request,
// and is the only thing that ever talks to Resend on the public's behalf.
//
// POST /subscribe  { email, hp }  -- hp is the honeypot field, must be empty
//
// Secrets (set via `wrangler secret put`, never in this file or wrangler.toml):
//   RESEND_API_KEY, RESEND_SEGMENT_ID, RESEND_FROM_EMAIL
// KV binding (see wrangler.toml): RATE_LIMIT_KV
//
// The welcome email HTML is inlined below (see WELCOME_EMAIL_HTML) rather
// than fetched from anywhere at request time, so a single failed fetch
// can't ever block someone's signup. Keep it in sync with
// email/welcome-template.html by hand -- see cloudflare-worker/README.md
// for the sync step.

const ALLOWED_ORIGINS = [
  'https://staging.virtuse.com',
  'https://virtuse.com',
  'https://www.virtuse.com',
];

const RATE_LIMIT_MAX_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function isRateLimited(env, ip) {
  const key = `ratelimit:${ip}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || '0', 10);
  if (current >= RATE_LIMIT_MAX_PER_HOUR) return true;
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  return false;
}

async function addContact(env, email) {
  const res = await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      segments: [{ id: env.RESEND_SEGMENT_ID }],
    }),
  });

  if (res.ok) return { created: true };

  const text = await res.text();
  // Resend doesn't document duplicate-email behavior. Treat anything that
  // reads like "already exists" as a soft-success rather than an error --
  // from the visitor's point of view, being already subscribed IS success.
  if (/already exists|duplicate/i.test(text)) return { created: false, duplicate: true };

  throw new Error(`Resend contacts API failed (status ${res.status}): ${text.slice(0, 300)}`);
}

async function sendWelcomeEmail(env, email) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject: 'Welcome to Virtuse — You\'re In',
      html: WELCOME_EMAIL_HTML,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend send failed (status ${res.status}): ${text.slice(0, 300)}`);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json(403, { error: 'Origin not allowed' }, origin);
    }

    if (request.method !== 'POST') {
      return json(405, { error: 'Method not allowed' }, origin);
    }

    const url = new URL(request.url);
    if (url.pathname !== '/subscribe') {
      return json(404, { error: 'Not found' }, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Invalid JSON body' }, origin);
    }

    const { email, hp } = body || {};

    // Honeypot: a hidden field real visitors never see or fill. Any value
    // here means a bot filled every field it found -- silently pretend
    // success so the bot doesn't learn anything, but do nothing further.
    if (hp) {
      return json(200, { ok: true }, origin);
    }

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return json(400, { error: 'Please enter a valid email address.' }, origin);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await isRateLimited(env, ip)) {
      return json(429, { error: 'Too many attempts. Please try again later.' }, origin);
    }

    try {
      const result = await addContact(env, email);
      if (result.created) {
        // Only send the welcome email to genuinely new subscribers --
        // never re-send it to someone who's already on the list.
        await sendWelcomeEmail(env, email);
      }
      return json(200, { ok: true }, origin);
    } catch (e) {
      console.error(e);
      return json(502, { error: 'Something went wrong. Please try again in a moment.' }, origin);
    }
  },
};

// Replaced with the real, JSON-escaped contents of
// email/welcome-template.html by build.mjs -- never edit this line by
// hand, and never deploy src/index.js directly (it still has the literal
// placeholder). Run `node build.mjs` and deploy dist/worker.js instead.
const WELCOME_EMAIL_HTML = "__WELCOME_EMAIL_HTML__";
