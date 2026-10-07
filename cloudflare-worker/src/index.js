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
//                                              back to English. The same normalized
//                                              value is also stored on the Resend
//                                              contact as a `lang` property (see
//                                              addContact) so signups are queryable
//                                              by language later -- requires the `lang`
//                                              Contact Property to exist in Resend first,
//                                              see README.md's "Multi-language welcome
//                                              emails" section. lang also picks which
//                                              Resend segment the contact joins (see
//                                              langSegmentId) --
//                                              Slovak signups join the dedicated "Ot
//                                              emails" segment INSTEAD OF the default
//                                              one, not in addition to it.
// POST /send         { email, hp, lang, kind, source, payload, brief }
//                                          -- one email the visitor asked for (Partner Finder
//                                             criteria or a calculator result); see src/send.js
// GET  /unsubscribe  ?email=...&token=...  -- clicked from the welcome email, see below
// GET  /pulse.json                         -- current Brief pulse JSON (KV `current`)
// OPTIONS /pulse.json                      -- CORS preflight for that GET
// PUT  /pulse.json                         -- publish; Bearer PULSE_PUBLISH_TOKEN
// POST /pulse/rollback                     -- copy KV `previous` back onto `current`
//
// Secrets (set via `wrangler secret put`, never in this file or wrangler.toml):
//   RESEND_API_KEY, RESEND_SEGMENT_ID, RESEND_SK_SEGMENT_ID, RESEND_FROM_EMAIL,
//   UNSUB_SECRET, PULSE_PUBLISH_TOKEN
// KV bindings (see wrangler.toml): RATE_LIMIT_KV, PULSE_KV
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

// '../src/send.js' resolves both from src/ (tests) and from dist/ (the
// built worker wrangler bundles).
import { handleSend } from '../src/send.js';
import { handleWpProxy, WP_PREFIX } from '../src/wp-proxy.js';

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

// lang -> the Worker secret name holding that language's dedicated Resend
// segment id. A language NOT listed here (including 'en') uses the
// default RESEND_SEGMENT_ID instead. Add a row here (and `wrangler
// secret put` the secret) for each future language that gets its own
// dedicated segment -- see README.md's "Per-language segments" section.
// This is the ONE place to edit: both addContact (which segment a new
// contact joins) and removeFromSegment (every segment an unsubscribe
// needs to check, since the unsubscribe link doesn't carry lang) derive
// from this map via the two helpers below, so they can't drift out of
// sync with each other.
const LANG_SEGMENT_SECRETS = { sk: 'RESEND_SK_SEGMENT_ID' };

function langSegmentId(env, lang) {
  const secretName = LANG_SEGMENT_SECRETS[lang];
  return secretName ? env[secretName] : undefined;
}

function allLangSegmentIds(env) {
  return Object.values(LANG_SEGMENT_SECRETS)
    .map((secretName) => env[secretName])
    .filter(Boolean);
}

async function addContact(env, email, lang) {
  // Slovak signups join Resend's existing "Ot emails" segment INSTEAD OF
  // the default one, not in addition to it -- see langSegmentId above.
  const segmentId = langSegmentId(env, lang) || env.RESEND_SEGMENT_ID;

  const res = await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      segments: [{ id: segmentId }],
      // Requires the `lang` Contact Property to already exist in Resend
      // (Contacts -> Properties -> Create Property, type "string") --
      // see README.md. If it doesn't exist yet, Resend is expected to
      // just ignore this key rather than fail the whole contact create,
      // but that's untested; create the property first.
      properties: { lang },
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
  en: { html: () => WELCOME_EMAIL_HTML, subject: 'Welcome to Virtuse Brief' },
  sk: { html: () => WELCOME_EMAIL_HTML_SK, subject: 'Vitajte vo Virtuse Brief' },
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
  // The unsubscribe link only carries email + token, not lang (see
  // buildUnsubscribeUrl) -- so this can't know in advance whether the
  // contact is in the default segment or a per-language one (see
  // LANG_SEGMENT_SECRETS). Try every configured segment; a 404 for one
  // the contact was never in is expected and fine, not an error.
  const segmentIds = [...new Set([env.RESEND_SEGMENT_ID, ...allLangSegmentIds(env)].filter(Boolean))];

  for (const segmentId of segmentIds) {
    const res = await fetch(
      `https://api.resend.com/audiences/${segmentId}/contacts/${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unsubscribed: true }),
      }
    );
    if (res.ok || res.status === 404) continue; // 404: not a member of this segment, fine

    const text = await res.text();
    throw new Error(`Resend unsubscribe failed for segment ${segmentId} (status ${res.status}): ${text.slice(0, 300)}`);
  }
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

  return htmlResponse(200, unsubscribePage("You've been unsubscribed from the Virtuse Brief. Sorry to see you go."));
}

// --- Brief Pulse JSON (KV) ------------------------------------------------
//
// Public GET of the daily news pulse, plus a token-gated publish. This
// block does not share the newsletter origin gate: a browser on
// virtuse.com fetches GET /pulse.json, and the daily publisher is curl
// with a bearer secret (no Origin). Newsletter routes below are unchanged.
//
// KV keys:
//   current            -- the document GET serves
//   previous           -- the document overwritten by the last successful PUT
//   pulse-YYYY-MM-DD   -- dated copy of that PUT (expirationTtl 60 days)

const PULSE_KEY = 'current';
const PULSE_PREV_KEY = 'previous';
const PULSE_MAX_BYTES = 16 * 1024;
const PULSE_DATED_TTL_SECONDS = 60 * 24 * 60 * 60;
const PULSE_FUTURE_MS = 36 * 60 * 60 * 1000;
const PULSE_TAGS = ['ETF', 'Fed', 'Policy', 'Mining', 'Security'];
const PULSE_BTC_RE = /bitcoin|\bbtc\b/i;
const PULSE_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function pulsePublicHeaders(origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
  }
  return headers;
}

function pulsePrivateJson(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// HMAC both sides to a fixed 32-byte digest, then XOR. The compare itself
// does not bail out early and does not depend on the secret's length.
async function pulseAuthorized(authHeader, secret) {
  const provided = typeof authHeader === 'string' ? authHeader : '';
  const expected = typeof secret === 'string' && secret.length > 0 ? `Bearer ${secret}` : '';
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode('pulse-auth'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const a = new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(provided)));
  const b = new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(expected)));
  let diff = a.length === b.length ? 0 : 1;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= a[i] ^ b[i];
  return expected.length > 0 && diff === 0;
}

function parsePulseIso(value) {
  if (typeof value !== 'string' || !PULSE_ISO_RE.test(value)) return null;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  // Reject calendar overflow (2026-02-31 parses as March on some engines,
  // as NaN on others). Round-trip the UTC timestamp through ISO.
  if (new Date(t).toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  return t;
}

function isHttpsUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('https://')) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function pulseItemErrors(it, i, prefix) {
  const errors = [];
  const label = `${prefix}[${i}]`;
  if (!it || typeof it !== 'object' || Array.isArray(it)) {
    errors.push(`${label} must be an object`);
    return errors;
  }
  if (typeof it.title !== 'string' || it.title.length === 0 || it.title.length > 120) {
    errors.push(`${label}.title must be a non-empty string of at most 120 characters`);
  }
  if (typeof it.source !== 'string' || it.source.length === 0) {
    errors.push(`${label}.source must be a non-empty string`);
  }
  if (!isHttpsUrl(it.url)) {
    errors.push(`${label}.url must be an https URL`);
  }
  if (!PULSE_TAGS.includes(it.tag)) {
    errors.push(`${label}.tag must be one of ${PULSE_TAGS.join(', ')}`);
  }
  if (parsePulseIso(it.published) == null) {
    errors.push(`${label}.published must be an ISO-8601 UTC timestamp`);
  }
  return errors;
}

// Required shape of gh-pages news/news-pulse.json, plus the publish rules
// from the pulse proposal (size is checked by the PUT handler, not here).
export function pulseErrors(data, now = Date.now()) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('body must be a JSON object');
    return errors;
  }

  const updated = parsePulseIso(data.updated);
  if (updated == null) {
    errors.push('updated must be an ISO-8601 UTC timestamp (YYYY-MM-DDTHH:mm:ssZ)');
  } else if (updated > now + PULSE_FUTURE_MS) {
    errors.push('updated must not be more than 36 hours in the future');
  }

  const market = data.market;
  if (!market || typeof market !== 'object' || Array.isArray(market)) {
    errors.push('market must be an object');
  } else {
    if (typeof market.btc_usd !== 'number' || !Number.isFinite(market.btc_usd)) {
      errors.push('market.btc_usd must be a finite number');
    }
    if (typeof market.change_24h_pct !== 'number' || !Number.isFinite(market.change_24h_pct)) {
      errors.push('market.change_24h_pct must be a finite number');
    }
    if (typeof market.fees !== 'string' || market.fees.length === 0) {
      errors.push('market.fees must be a non-empty string');
    }
    if (typeof market.fee_sat_vb !== 'number' || !Number.isFinite(market.fee_sat_vb)) {
      errors.push('market.fee_sat_vb must be a finite number');
    }
    if (typeof market.sources !== 'string' || market.sources.length === 0) {
      errors.push('market.sources must be a non-empty string');
    }
  }

  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 3) {
    errors.push('items must be an array of 1 to 3 pulse items');
  }
  const items = Array.isArray(data.items) ? data.items : [];
  items.forEach((it, i) => {
    errors.push(...pulseItemErrors(it, i, 'items'));
    if (it && typeof it === 'object' && !Array.isArray(it)) {
      if (typeof it.excerpt !== 'string') {
        errors.push(`items[${i}].excerpt must be a string`);
      }
      const title = typeof it.title === 'string' ? it.title : '';
      const excerpt = typeof it.excerpt === 'string' ? it.excerpt : '';
      if ((title || excerpt) && !PULSE_BTC_RE.test(`${title} ${excerpt}`)) {
        errors.push(`items[${i}] title+excerpt must mention Bitcoin or BTC`);
      }
    }
  });

  const archive = data.archive;
  const yesterday = archive && !Array.isArray(archive) ? archive.items : undefined;
  if (!archive || typeof archive !== 'object' || Array.isArray(archive) || !Array.isArray(yesterday) || yesterday.length > 2) {
    errors.push('archive.items (yesterday) must be an array of at most 2');
  } else {
    yesterday.forEach((it, i) => {
      errors.push(...pulseItemErrors(it, i, 'archive.items'));
    });
  }

  if (data.what_moved != null) {
    if (typeof data.what_moved !== 'string' || data.what_moved.length > 300) {
      errors.push('what_moved must be a string of at most 300 characters');
    }
  }

  if (data.fear_greed != null) {
    const fg = data.fear_greed;
    const value = fg && typeof fg === 'object' ? fg.value : undefined;
    if (!fg || typeof fg !== 'object' || Array.isArray(fg) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      errors.push('fear_greed.value must be a number from 0 to 100');
    }
  }

  if (data.dominance != null) {
    const dom = data.dominance;
    if (!dom || typeof dom !== 'object' || Array.isArray(dom) || typeof dom.btc_pct !== 'number' || !Number.isFinite(dom.btc_pct)) {
      errors.push('dominance.btc_pct must be a finite number');
    }
  }

  if (data.quick_media != null) {
    const qm = data.quick_media;
    if (!qm || typeof qm !== 'object' || Array.isArray(qm) || typeof qm.title !== 'string' || !isHttpsUrl(qm.url)) {
      errors.push('quick_media must have a title and an https url');
    }
  }

  if (data.feed != null && typeof data.feed !== 'string') {
    errors.push('feed must be a string or null');
  }

  return errors;
}

function pulseDatedKey(updated) {
  return `pulse-${String(updated).slice(0, 10)}`;
}

async function handlePulseGet(request, env, origin) {
  const headers = pulsePublicHeaders(origin);
  const body = await env.PULSE_KV.get(PULSE_KEY, { cacheTtl: 60 });
  if (!body) {
    // Don't cache the empty state: a publish in the next minute should show up.
    headers['Cache-Control'] = 'no-store';
    return new Response(JSON.stringify({ error: 'no pulse' }), { status: 404, headers });
  }
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
}

function pulsePreflight(origin) {
  const headers = {
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return new Response(null, { status: 204, headers });
}

export async function handlePulse(request, env, origin, pathname) {
  if (pathname === '/pulse.json' && request.method === 'OPTIONS') {
    return pulsePreflight(origin);
  }

  if (pathname === '/pulse.json' && (request.method === 'GET' || request.method === 'HEAD')) {
    return handlePulseGet(request, env, origin);
  }

  if (pathname === '/pulse.json' && request.method === 'PUT') {
    if (!(await pulseAuthorized(request.headers.get('Authorization'), env.PULSE_PUBLISH_TOKEN))) {
      return pulsePrivateJson(401, { error: 'unauthorized' });
    }

    const declared = request.headers.get('Content-Length');
    if (declared && Number(declared) > PULSE_MAX_BYTES) {
      return pulsePrivateJson(400, {
        error: 'validation failed',
        errors: ['body must be at most 16 KB'],
      });
    }

    const text = await request.text();
    if (textEncoder.encode(text).length > PULSE_MAX_BYTES) {
      return pulsePrivateJson(400, {
        error: 'validation failed',
        errors: ['body must be at most 16 KB'],
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return pulsePrivateJson(400, {
        error: 'validation failed',
        errors: ['body must be valid JSON'],
      });
    }

    const errors = pulseErrors(data);
    if (errors.length) {
      return pulsePrivateJson(400, { error: 'validation failed', errors });
    }

    const previous = await env.PULSE_KV.get(PULSE_KEY);
    if (previous != null) {
      await env.PULSE_KV.put(PULSE_PREV_KEY, previous);
    }
    await env.PULSE_KV.put(PULSE_KEY, text);
    const datedKey = pulseDatedKey(data.updated);
    await env.PULSE_KV.put(datedKey, text, { expirationTtl: PULSE_DATED_TTL_SECONDS });

    const yesterday = data.archive.items.length;
    return pulsePrivateJson(200, {
      ok: true,
      updated: data.updated,
      items: data.items.length,
      yesterday,
      bytes: textEncoder.encode(text).length,
      datedKey,
      ttlDays: 60,
    });
  }

  if (pathname === '/pulse/rollback' && request.method === 'POST') {
    if (!(await pulseAuthorized(request.headers.get('Authorization'), env.PULSE_PUBLISH_TOKEN))) {
      return pulsePrivateJson(401, { error: 'unauthorized' });
    }
    const previous = await env.PULSE_KV.get(PULSE_PREV_KEY);
    if (previous == null) {
      return pulsePrivateJson(404, { error: 'no previous pulse' });
    }
    await env.PULSE_KV.put(PULSE_KEY, previous);
    let updated = null;
    try {
      updated = JSON.parse(previous).updated ?? null;
    } catch {
      updated = null;
    }
    return pulsePrivateJson(200, { ok: true, restored: true, updated });
  }

  return pulsePrivateJson(405, { error: 'method not allowed' });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // Pulse is dispatched before the newsletter OPTIONS/origin gate so
    // GET /pulse.json stays public and /subscribe stays byte-identical.
    if (url.pathname === '/pulse.json' || url.pathname === '/pulse/rollback') {
      return handlePulse(request, env, origin, url.pathname);
    }

    // Read-only WordPress proxy for the Stories build (see src/wp-proxy.js).
    // Called from GitHub runners, not browsers: no Origin, no CORS.
    if (url.pathname.startsWith(WP_PREFIX + '/')) {
      return handleWpProxy(request, url);
    }

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

    if (url.pathname === '/send') {
      return handleSend(request, env, origin, {
        json,
        isRateLimited,
        addContact,
        sendWelcomeEmail,
        emailRe: EMAIL_RE,
        welcomeLangs: Object.keys(WELCOME_EMAIL_TEMPLATES),
      });
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

    const { email, hp, lang: rawLang } = body || {};
    // Normalize once so the Resend `lang` property and the welcome-email
    // template lookup always agree -- a missing, non-string, or
    // unrecognized lang (a bot, or a page that predates/doesn't yet send
    // this field, e.g. uk/cs today) is recorded and treated as 'en'.
    const lang = typeof rawLang === 'string' && rawLang in WELCOME_EMAIL_TEMPLATES ? rawLang : 'en';

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
      const result = await addContact(env, email, lang);
      if (result.created) {
        // Only send the welcome email to genuinely new subscribers --
        // never re-send it to someone who's already on the list.
        await sendWelcomeEmail(env, email, lang);
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
