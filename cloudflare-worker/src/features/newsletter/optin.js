// Double opt-in for the Virtuse Brief (creators phase 2, 2026-11-23).
//
// On when the Worker var BRIEF_DOUBLE_OPTIN is "1". Then POST /subscribe (and /send with
// brief: true) no longer adds the address: it sends one confirmation email with a signed
// link. Only the click (GET /confirm shows a button, POST /confirm acts, so link scanners
// that open every URL confirm nothing) adds the contact, sends the welcome email and
// stores the consent record.
//
// The link is stateless: base64url(JSON {e, l, r, s, t}) + "." + HMAC-SHA256(UNSUB_SECRET,
// "confirm:" + payload). Nothing is stored before the click.
//
// Stored after the click, in RATE_LIMIT_KV (no Resend contact properties needed):
//   consent:<sha256(address)>  { at, version, lang, source, ref, ipHash }   proof of consent
//   refsub:<code>:<sha256(address)>  { at }                                 one confirmed sign-up per creator code
// A creator code counts only if KV holds creator:<code> (added by hand when Ras accepts a creator).

import { CONSENT_VERSION, CONFIRM_TTL_MS, EMAIL_RE, OPTIN_ADDRESS_LIMIT } from '../../config.js';
import { equalStrings, hmacSha256Hex, ipHash, sha256Hex } from '../../shared/crypto.js';
import OPERATOR from '../../generated/waitlist-strings.js';
import { briefFrom } from './brief-list.js';

export const optinEnabled = (env) => env.BRIEF_DOUBLE_OPTIN === '1';

// A creator code or a source label as the page sends it: short, lower case, no surprises.
const CODE_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;
const SOURCE_RE = /^[a-z0-9_-]{1,40}$/;
export const cleanCode = (v) => (typeof v === 'string' && CODE_RE.test(v.toLowerCase()) ? v.toLowerCase() : '');
export const cleanSource = (v) => (typeof v === 'string' && SOURCE_RE.test(v) ? v : '');

const b64url = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export async function confirmToken(secret, data) {
  const payload = b64url(JSON.stringify(data));
  return `${payload}.${await hmacSha256Hex(secret, 'confirm:' + payload)}`;
}

// The data inside a valid, unexpired token, else null.
export async function readConfirmToken(secret, token, now) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  if (!equalStrings(await hmacSha256Hex(secret, 'confirm:' + payload), token.slice(dot + 1))) return null;
  let d;
  try { d = JSON.parse(unb64url(payload)); } catch { return null; }
  if (!d || typeof d.e !== 'string' || !EMAIL_RE.test(d.e) || typeof d.t !== 'number') return null;
  if (now - d.t > CONFIRM_TTL_MS || d.t > now + 60000) return null;
  return { email: d.e, lang: d.l === 'sk' ? 'sk' : 'en', ref: cleanCode(d.r), source: cleanSource(d.s), at: d.t };
}

// ---------- texts (EN, SK) ----------

export const OPTIN_TEXT = {
  en: {
    subject: 'Confirm your Virtuse Brief subscription',
    h: 'One click and you are in.',
    p: 'Confirm that you want the Virtuse Brief: Bitcoin and the macro that moves it, every Monday.',
    btn: 'Confirm my subscription',
    note: 'If you did not sign up, ignore this email. Nothing happens without the click. The link works for 7 days.',
    pageTitle: 'Confirm your subscription',
    pageP: 'Click the button to start receiving the Virtuse Brief.',
    doneH: 'You are in.',
    doneP: 'The Brief arrives on Monday. We have just sent you a welcome email.',
    back: 'Back to the Brief',
    bad: 'This confirmation link is invalid or has expired. Please sign up again on virtuse.com.',
    failed: 'Something went wrong. Please try again in a moment.',
  },
  sk: {
    subject: 'Potvrďte odber Virtuse Brief',
    h: 'Jedno kliknutie a odber je váš.',
    p: 'Potvrďte, že chcete dostávať Virtuse Brief: Bitcoin a makro, ktoré ho hýbe, každý pondelok.',
    btn: 'Potvrdiť odber',
    note: 'Ak ste sa neprihlásili, tento e-mail ignorujte. Bez kliknutia sa nič nestane. Odkaz platí 7 dní.',
    pageTitle: 'Potvrďte odber',
    pageP: 'Kliknutím na tlačidlo začnete dostávať Virtuse Brief.',
    doneH: 'Odber je potvrdený.',
    doneP: 'Brief príde v pondelok. Práve sme vám poslali uvítací e-mail.',
    back: 'Späť na Brief',
    bad: 'Tento potvrdzovací odkaz je neplatný alebo vypršal. Prihláste sa prosím znova na virtuse.com.',
    failed: 'Niečo sa pokazilo. Skúste to prosím o chvíľu znova.',
  },
};
const T = (lang) => OPTIN_TEXT[lang === 'sk' ? 'sk' : 'en'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function confirmEmailHtml(lang, link) {
  const t = T(lang);
  const op = (OPERATOR[lang] || OPERATOR.en).operator;
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(t.subject)}</title></head>
<body style="margin:0;padding:0;background-color:#08090a;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#08090a;"><tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:100%;background-color:#141414;border-radius:16px;">
<tr><td style="padding:40px 36px;">
<p style="margin:0 0 24px 0;font-size:22px;font-weight:800;"><span style="color:#5FAEDE;">V</span><span style="color:#e6edf3;">irtuse</span></p>
<p style="margin:0 0 12px 0;font-size:22px;line-height:30px;font-weight:700;color:#e6edf3;">${esc(t.h)}</p>
<p style="margin:0 0 28px 0;font-size:16px;line-height:26px;color:#c3ccd6;">${esc(t.p)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:8px;background-color:#e6edf3;">
<a href="${esc(link)}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:700;color:#08090a;text-decoration:none;">${esc(t.btn)}</a></td></tr></table>
<p style="margin:28px 0 0 0;font-size:13px;line-height:21px;color:#8b949e;">${esc(t.note)}</p>
</td></tr></table>
<p style="margin:20px 0 0 0;max-width:520px;font-size:11px;line-height:17px;color:#6e7681;">${esc(op)}</p>
</td></tr></table></body></html>`;
}

// The page behind the link: a button (POST), so opening the URL confirms nothing.
export function confirmPage(lang, { token, done, message, status } = {}) {
  const t = T(lang);
  let body;
  if (done) body = `<h1>${esc(t.doneH)}</h1><p>${esc(t.doneP)}</p><p><a class="b" href="https://virtuse.com/${lang === 'sk' ? 'sk/' : ''}news.html">${esc(t.back)}</a></p>`;
  else if (message) body = `<p>${esc(message)}</p>`;
  else body = `<h1>${esc(t.pageTitle)}</h1><p>${esc(t.pageP)}</p><form method="post" action="/confirm"><input type="hidden" name="t" value="${esc(token)}"><button class="b" type="submit">${esc(t.btn)}</button></form>`;
  return { status: status || 200, body: `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex"><title>Virtuse Brief</title>
<style>body{margin:0;background:#08090a;color:#c3ccd6;font-family:Arial,Helvetica,sans-serif}main{max-width:480px;margin:64px auto;padding:40px 32px;background:#141414;border-radius:16px;text-align:center}
.l{margin:0 0 20px;font-size:22px;font-weight:800}.l span{color:#5FAEDE}h1{color:#e6edf3;font-size:22px;margin:0 0 12px}p{font-size:16px;line-height:26px;margin:0 0 20px}
.b{display:inline-block;border:0;border-radius:8px;background:#e6edf3;color:#08090a;font-size:16px;font-weight:700;padding:14px 24px;cursor:pointer;text-decoration:none}</style></head>
<body><main><p class="l"><span>V</span>irtuse</p>${body}</main></body></html>` };
}

// ---------- the two steps ----------

// Step 1: send the confirmation email. Returns 'sent', 'limited' (this address asked too
// often) or 'skipped' (staging dry run without a test inbox).
export async function startOptin({ env, services, email, lang, ref, source, workerOrigin, now }) {
  const addr = await sha256Hex(email.toLowerCase());
  if (await services.limiter.exceeded(`optin:addr:${addr}`, OPTIN_ADDRESS_LIMIT.max, OPTIN_ADDRESS_LIMIT.windowSeconds)) return 'limited';
  const token = await confirmToken(env.UNSUB_SECRET, { e: email, l: lang, r: cleanCode(ref), s: cleanSource(source), t: now });
  const link = `${workerOrigin}/confirm?t=${token}`;
  // Staging: SUBSCRIBE_DRY_RUN sends the confirmation only to BRIEF_TEST_TO (never to the visitor).
  const to = env.SUBSCRIBE_DRY_RUN === '1' ? env.BRIEF_TEST_TO : email;
  if (!to) return 'skipped';
  await services.resend.sendEmail({
    from: briefFrom(env),
    to: [to],
    subject: (env.SUBSCRIBE_DRY_RUN === '1' ? '[TEST] ' : '') + T(lang).subject,
    html: confirmEmailHtml(lang, link),
  }, 'Resend confirmation send failed');
  return 'sent';
}

// Step 2: the click. Joins the Brief (or, on a staging dry run, sends the welcome to BRIEF_TEST_TO),
// then stores the consent record and the creator attribution.
export async function finishOptin({ env, services, data, ip, now }) {
  const addr = await sha256Hex(data.email.toLowerCase());
  if (env.SUBSCRIBE_DRY_RUN === '1') {
    if (env.BRIEF_TEST_TO) await services.brief.sendWelcome(env.BRIEF_TEST_TO, data.lang);
  } else {
    await services.brief.join(data.email, data.lang);
  }
  const kv = env.RATE_LIMIT_KV;
  const day = new Date(now).toISOString().slice(0, 10);
  await kv.put(`consent:${addr}`, JSON.stringify({
    at: new Date(now).toISOString(), requestedAt: new Date(data.at).toISOString(), version: CONSENT_VERSION,
    lang: data.lang, source: data.source || null, ref: data.ref || null, ipHash: await ipHash(ip, day, env),
  }));
  if (data.ref && (await kv.get(`creator:${data.ref}`))) {
    const key = `refsub:${data.ref}:${addr}`;
    if (!(await kv.get(key))) await kv.put(key, JSON.stringify({ at: new Date(now).toISOString() }));
  }
}
