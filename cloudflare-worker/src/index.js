// Virtuse newsletter signup proxy.
//
// The site is fully static (GitHub Pages, no server of its own), and
// Resend's API requires a secret key for every call -- including adding a
// contact -- so it can never be called directly from the form's frontend
// JS. This Worker is the one piece of server-side compute in the whole
// stack: it holds the Resend secret, validates + rate-limits the request,
// and is the only thing that ever talks to Resend on the public's behalf.
//
// POST /subscribe    { email, hp, lang }   -- hp is the honeypot field, must be empty;
//                                              lang picks which welcome email template
//                                              to send (see WELCOME_EMAIL_TEMPLATES
//                                              below) -- omitted or unrecognized falls
//                                              back to English
// GET  /unsubscribe  ?email=...&token=...  -- clicked from the welcome email, see below
//
// Secrets (set via `wrangler secret put`, never in this file or wrangler.toml):
//   RESEND_API_KEY, RESEND_SEGMENT_ID, RESEND_FROM_EMAIL, UNSUB_SECRET
// KV binding (see wrangler.toml): RATE_LIMIT_KV
//
// The welcome email HTML is inlined below (see WELCOME_EMAIL_HTML) rather
// than fetched from anywhere at request time, so a single failed fetch
// can't ever block someone's signup. Keep it in sync with
// email/welcome-template.html by hand -- see cloudflare-worker/README.md
// for the sync step.
//
// The template's {{unsubscribe_url}} placeholder is filled in per
// recipient at send time (see sendWelcomeEmail), not at build time --
// Resend's own unsubscribe merge tag only resolves for Broadcast-API sends
// tied to a segment, and this is a transactional single-send, so we have
// to build and validate the link ourselves. The link is HMAC-signed with
// UNSUB_SECRET so it can't be replayed against a different email address.

const ALLOWED_ORIGINS = [
  'https://staging.virtuse.com',
  'https://virtuse.com',
  'https://www.virtuse.com',
];

const RATE_LIMIT_MAX_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WORKER_ORIGIN = 'https://virtuse-newsletter.virtuse-ai.workers.dev';

const textEncoder = new TextEncoder();

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

// lang -> { html, subject }. Add a row here (and a matching
// WELCOME_EMAIL_HTML_<LANG> placeholder + build.mjs TEMPLATES entry)
// whenever a new language gets its own welcome email -- see
// cloudflare-worker/README.md's "Multi-language welcome emails" section.
// A lang not present here (including undefined/omitted) falls back to 'en'.
const WELCOME_EMAIL_TEMPLATES = {
  en: { html: () => WELCOME_EMAIL_HTML, subject: 'Welcome to Virtuse — You\'re In' },
  sk: { html: () => WELCOME_EMAIL_HTML_SK, subject: 'Vitajte vo Virtuse' },
};

async function sendWelcomeEmail(env, email, lang) {
  const template = WELCOME_EMAIL_TEMPLATES[lang] || WELCOME_EMAIL_TEMPLATES.en;

  const unsubscribeUrl = await buildUnsubscribeUrl(env, email);
  const html = template.html().replace('{{unsubscribe_url}}', unsubscribeUrl);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject: template.subject,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend send failed (status ${res.status}): ${text.slice(0, 300)}`);
  }
}

// --- Unsubscribe: link signing + Resend removal --------------------------
//
// The link embeds the recipient's email plus an HMAC-SHA256(UNSUB_SECRET,
// email) token, so a visitor can only ever unsubscribe the exact address
// the email was sent to -- nobody can guess or enumerate another person's
// unsubscribe link. This mirrors the standard one-click, no-login
// unsubscribe pattern CAN-SPAM/GDPR expect, without needing an account or
// a second confirmation step.

async function hmacToken(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildUnsubscribeUrl(env, email) {
  const token = await hmacToken(env.UNSUB_SECRET, email);
  return `${WORKER_ORIGIN}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

async function verifyUnsubToken(env, email, token) {
  const expected = await hmacToken(env.UNSUB_SECRET, email);
  if (expected.length !== token.length) return false;
  // Constant-time-ish compare -- avoids leaking match length via timing.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

async function removeFromSegment(env, email) {
  const res = await fetch(
    `https://api.resend.com/audiences/${env.RESEND_SEGMENT_ID}/contacts/${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ unsubscribed: true }),
    }
  );
  if (res.ok || res.status === 404) return; // 404: already gone, visitor's intent is already satisfied

  const text = await res.text();
  throw new Error(`Resend unsubscribe failed (status ${res.status}): ${text.slice(0, 300)}`);
}

function htmlResponse(status, body) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function unsubscribePage(message) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Virtuse</title></head>
<body style="margin:0;padding:0;background-color:#0d1421;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d1421;">
<tr><td align="center" style="padding:64px 16px;">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px;max-width:100%;background-color:#111a2b;border:1px solid #30363d;border-radius:16px;">
<tr><td style="padding:40px 36px;text-align:center;">
<p style="margin:0 0 20px 0;font-size:22px;font-weight:800;"><span style="color:#5FAEDE;">V</span><span style="color:#e6edf3;">irtuse</span></p>
<p style="margin:0;font-size:16px;line-height:26px;color:#c3ccd6;">${message}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

async function handleUnsubscribe(env, url) {
  const email = url.searchParams.get('email') || '';
  const token = url.searchParams.get('token') || '';

  if (!email || !token || !EMAIL_RE.test(email)) {
    return htmlResponse(400, unsubscribePage('That unsubscribe link looks incomplete or invalid.'));
  }

  if (!(await verifyUnsubToken(env, email, token))) {
    return htmlResponse(400, unsubscribePage('That unsubscribe link is invalid.'));
  }

  try {
    await removeFromSegment(env, email);
  } catch (e) {
    console.error(e);
    return htmlResponse(
      502,
      unsubscribePage('Something went wrong processing your request. Please try again in a moment.')
    );
  }

  return htmlResponse(200, unsubscribePage("You've been unsubscribed from the Virtuse Report. Sorry to see you go."));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    // Unsubscribe is a plain top-level navigation clicked from an email
    // client, not a fetch() from the site -- it carries no Origin header
    // and needs none of the CORS/POST checks below. Its own HMAC token
    // (see handleUnsubscribe) is what proves the request is legitimate.
    if (request.method === 'GET' && url.pathname === '/unsubscribe') {
      return handleUnsubscribe(env, url);
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json(403, { error: 'Origin not allowed' }, origin);
    }

    if (request.method !== 'POST') {
      return json(405, { error: 'Method not allowed' }, origin);
    }

    if (url.pathname !== '/subscribe') {
      return json(404, { error: 'Not found' }, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Invalid JSON body' }, origin);
    }

    const { email, hp, lang } = body || {};

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
        await sendWelcomeEmail(env, email, typeof lang === 'string' ? lang : undefined);
      }
      return json(200, { ok: true }, origin);
    } catch (e) {
      console.error(e);
      return json(502, { error: 'Something went wrong. Please try again in a moment.' }, origin);
    }
  },
};

// Replaced with the real, JSON-escaped contents of the corresponding
// email/welcome-template*.html file by build.mjs -- never edit these lines
// by hand, and never deploy src/index.js directly (it still has the
// literal placeholders). Run `node build.mjs` and deploy dist/worker.js
// instead.
const WELCOME_EMAIL_HTML = "__WELCOME_EMAIL_HTML__";
const WELCOME_EMAIL_HTML_SK = "__WELCOME_EMAIL_HTML_SK__";
