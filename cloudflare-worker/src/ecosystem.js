// POST /ecosystem-apply
//
// The "Get your project featured" form on /ecosystem/promote/ (all 10 languages). Order of checks:
//   size cap (5 KB) -> JSON -> honeypot -> server-side validation -> per-IP rate limit
//   -> Cloudflare Turnstile siteverify -> email to the Virtuse team -> auto-reply to the applicant.
// Nothing is stored or published: the application only travels by email and is reviewed by hand.
//
// Secrets (wrangler secret put):
//   TURNSTILE_SECRET_KEY  Turnstile widget secret. Not set -> 503, the form stays closed.
//   RESEND_API_KEY        already set for the newsletter.
// Optional plain overrides (wrangler secret put or [vars]):
//   ECOSYSTEM_TO          team inbox, default info@virtuse.com
//   ECOSYSTEM_FROM        sender, default "Virtuse <info@virtuse.com>" (virtuse.com is verified in Resend)
//   ECOSYSTEM_TEST_TO     where every email goes for requests from staging.virtuse.com,
//                         default vasilisin@virtuse.com (both the team copy and the auto-reply)

import STRINGS from './ecosystem-strings.js';

export const ECO_CATEGORIES = ['what-is-bitcoin', 'books', 'podcasts', 'videos', 'conferences', 'privacy',
  'spend-bitcoin', 'store-tools', 'dev-tools', 'jobs', 'peers'];
export const ECO_COUNTRIES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'CH'];
export const ECO_LANGS = Object.keys(STRINGS);

const MAX_BYTES = 5 * 1024;
const IP_MAX_PER_HOUR = 3;
const REPLY_WINDOW_SECONDS = 24 * 60 * 60;
const STAGING_ORIGIN = 'https://staging.virtuse.com';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const LIMITS = { project_name: 120, website: 300, description: 300, licence: 200, repo: 300, contact_name: 120, contact_email: 200, message: 1500 };

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Returns { ok: true, app } or { ok: false, error }. Messages are English; the page shows its own
// translated text for each failure kind and only logs these.
export function validateApplication(body, emailRe) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Invalid body.' };
  const app = {};
  for (const [k, max] of Object.entries(LIMITS)) {
    const v = body[k];
    if (v !== undefined && v !== null && typeof v !== 'string') return { ok: false, error: `Field ${k} must be text.` };
    app[k] = str(v);
    if (app[k].length > max) return { ok: false, error: `Field ${k} is too long.` };
  }
  for (const k of ['project_name', 'website', 'description', 'contact_name', 'contact_email']) {
    if (!app[k]) return { ok: false, error: `Field ${k} is required.` };
  }
  if (!URL_RE.test(app.website)) return { ok: false, error: 'Website must be a http(s) URL.' };
  if (app.repo && !URL_RE.test(app.repo)) return { ok: false, error: 'Repository must be a http(s) URL.' };
  if (!emailRe.test(app.contact_email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (!ECO_CATEGORIES.includes(body.category)) return { ok: false, error: 'Unknown category.' };
  app.category = body.category;
  const c = body.countries;
  if (!Array.isArray(c) || !c.length) return { ok: false, error: 'Choose at least one country.' };
  if (!(c.length === 1 && c[0] === 'ALL') && !c.every((x) => ECO_COUNTRIES.includes(x))) return { ok: false, error: 'Unknown country.' };
  app.countries = c[0] === 'ALL' ? ['ALL'] : [...new Set(c)];
  if (body.bitcoin_only !== true) return { ok: false, error: 'The project must be bitcoin-only.' };
  if (body.consent !== true) return { ok: false, error: 'Consent is required.' };
  app.sponsored_interest = body.sponsored_interest === 'yes' ? 'yes' : 'no';
  app.lang = typeof body.lang === 'string' && ECO_LANGS.includes(body.lang) ? body.lang : 'en';
  return { ok: true, app };
}

export async function verifyTurnstile(env, token, ip) {
  if (!token || typeof token !== 'string' || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  if (ip && ip !== 'unknown') form.append('remoteip', ip);
  try {
    const res = await fetch(SITEVERIFY, { method: 'POST', body: form });
    const out = await res.json();
    if (!(out && out.success === true)) console.warn('turnstile rejected', JSON.stringify({ codes: out && out['error-codes'], hostname: out && out.hostname }));
    return out && out.success === true;
  } catch (e) {
    console.error('turnstile siteverify failed', e);
    return false;
  }
}

async function ipLimited(env, ip) {
  const key = `eco:ip:${ip}`;
  const n = parseInt((await env.RATE_LIMIT_KV.get(key)) || '0', 10);
  if (n >= IP_MAX_PER_HOUR) return true;
  await env.RATE_LIMIT_KV.put(key, String(n + 1), { expirationTtl: 60 * 60 });
  return false;
}

// At most one auto-reply per applicant address per 24 h (the team copy is always sent).
async function mayAutoReply(env, email) {
  const key = `eco:reply:${email.toLowerCase()}`;
  if (await env.RATE_LIMIT_KV.get(key)) return false;
  await env.RATE_LIMIT_KV.put(key, '1', { expirationTtl: REPLY_WINDOW_SECONDS });
  return true;
}

const siteUrl = (lang, path) => `https://virtuse.com/${lang === 'en' ? '' : lang + '/'}${path}`;

export function renderTeamEmail(app, { test }) {
  const rows = [
    ['Project', app.project_name], ['Website', app.website], ['Category', app.category],
    ['Description (EN)', app.description], ['Countries', app.countries.join(', ')], ['Bitcoin-only confirmed', 'yes'],
    ['MiCA / licence', app.licence || '-'], ['Open-source repo', app.repo || '-'], ['Contact name', app.contact_name],
    ['Contact email', app.contact_email], ['Featured / sponsored placement', app.sponsored_interest],
    ['Message', app.message || '-'], ['Form language', app.lang], ['Privacy consent', 'yes'],
  ];
  const subject = `${test ? '[TEST] ' : ''}Ecosystem application: ${app.project_name}`;
  const text = `New application for the Virtuse Bitcoin Ecosystem (manual review, nothing is published automatically).\n\n`
    + rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nReply to this email to answer the applicant.\n`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#111;">
<p>New application for the Virtuse Bitcoin Ecosystem. Manual review, nothing is published automatically.</p>
<table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;">${rows.map(([k, v]) =>
    `<tr><td style="vertical-align:top;color:#555;white-space:nowrap;border-bottom:1px solid #eee;">${escHtml(k)}</td><td style="border-bottom:1px solid #eee;white-space:pre-wrap;">${escHtml(v)}</td></tr>`).join('')}</table>
<p style="color:#555;">Reply to this email to answer the applicant.</p></div>`;
  return { subject, text, html };
}

export function renderAutoReply(app, { test }) {
  const L = STRINGS[app.lang] ? app.lang : 'en';
  const t = STRINGS[L];
  const criteria = siteUrl(L, 'ecosystem/promote/#criteria');
  const privacy = siteUrl(L, 'privacy-policy.html');
  const fill = (s, html) => s
    .replace('{name}', html ? escHtml(app.contact_name) : app.contact_name)
    .replace('{project}', html ? escHtml(app.project_name) : app.project_name)
    .replace('{criteria}', html ? `<a href="${criteria}" style="color:#e6edf3;">${criteria}</a>` : criteria)
    .replace('{privacy}', html ? `<a href="${privacy}" style="color:#8b949e;">${privacy}</a>` : privacy);
  const subject = (test ? '[TEST] ' : '') + fill(t.subject, false);
  const sign = 'Virtuse Wealth Management, a.s.\nhttps://virtuse.com';
  const text = [fill(t.greeting, false), fill(t.received, false), fill(t.review, false), fill(t.reply, false),
    `${t.closing}\n${sign}`, fill(t.foot, false)].join('\n\n') + '\n';
  const P = 'style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#c3ccd6;"';
  const html = `<!DOCTYPE html>
<html lang="${L}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#08090a;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#08090a;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background-color:#141414;border:1px solid #2a2a2a;border-radius:16px;"><tr><td style="padding:32px;">
<p style="margin:0 0 20px 0;font-size:22px;font-weight:800;"><span style="color:#5FAEDE;">V</span><span style="color:#e6edf3;">irtuse</span></p>
<p ${P}>${fill(t.greeting, true)}</p>
<p ${P}>${fill(t.received, true)}</p>
<p ${P}>${fill(t.review, true)}</p>
<p ${P}>${fill(t.reply, true)}</p>
<p ${P}>${escHtml(t.closing)}<br>Virtuse Wealth Management, a.s.<br><a href="https://virtuse.com" style="color:#e6edf3;">https://virtuse.com</a></p>
<p style="margin:16px 0 0 0;font-size:12px;line-height:19px;color:#8b949e;">${fill(t.foot, true)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

async function resendSend(env, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend ecosystem email failed (status ${res.status}): ${t.slice(0, 300)}`);
  }
}

export async function handleEcosystemApply(request, env, origin, { json, emailRe }) {
  const len = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (len > MAX_BYTES) return json(413, { error: 'too_large' }, origin);
  let raw;
  try {
    raw = await request.text();
  } catch {
    return json(400, { error: 'invalid' }, origin);
  }
  if (new TextEncoder().encode(raw).length > MAX_BYTES) return json(413, { error: 'too_large' }, origin);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid' }, origin);
  }
  if (body && body.company_url) return json(200, { ok: true }, origin); // honeypot: pretend success, do nothing

  const v = validateApplication(body, emailRe);
  if (!v.ok) return json(400, { error: 'invalid', detail: v.error }, origin);
  const app = v.app;

  // A missing or malformed Turnstile token is a 400 before anything else is spent on the request.
  const token = body.turnstile;
  if (!token || typeof token !== 'string' || token.length > 2048) return json(400, { error: 'captcha' }, origin);
  if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY) return json(503, { error: 'closed' }, origin);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // Turnstile first, so failed or retried checks do not use up the visitor's hourly quota.
  if (!(await verifyTurnstile(env, token, ip))) return json(400, { error: 'captcha' }, origin);
  if (await ipLimited(env, ip)) return json(429, { error: 'rate_limited' }, origin);

  const test = origin === STAGING_ORIGIN;
  const testTo = env.ECOSYSTEM_TEST_TO || 'vasilisin@virtuse.com';
  const from = env.ECOSYSTEM_FROM || 'Virtuse <info@virtuse.com>';
  const team = env.ECOSYSTEM_TO || 'info@virtuse.com';
  try {
    const t = renderTeamEmail(app, { test });
    await resendSend(env, { from, to: [test ? testTo : team], reply_to: app.contact_email, subject: t.subject, text: t.text, html: t.html });
    if (await mayAutoReply(env, app.contact_email)) {
      const r = renderAutoReply(app, { test });
      await resendSend(env, { from, to: [test ? testTo : app.contact_email], reply_to: team, subject: r.subject, text: r.text, html: r.html });
    }
    return json(200, { ok: true }, origin);
  } catch (e) {
    console.error(e);
    return json(502, { error: 'send_failed' }, origin);
  }
}
