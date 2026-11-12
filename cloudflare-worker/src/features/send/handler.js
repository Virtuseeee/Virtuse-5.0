// POST /send  { email, hp, lang, kind, source, payload, brief }
//
// Order of checks: JSON -> honeypot -> address -> kind/source -> payload ->
// per-IP + per-address limit -> send. Only valid requests are counted, the
// per-IP counter is /send's own (not shared with /subscribe and /waitlist), and
// an address Resend refuses (4xx) is answered with 400 invalid_recipient and
// given back to both counters, so a typo does not lock the visitor out.
// Limits per hour: SEND_IP_LIMIT_PER_HOUR (default 20: offices and mobile carriers share one IP) and
// SEND_ADDRESS_LIMIT_PER_HOUR (default 3); staging sets higher values for QA.
// With `brief: true` the address also joins the Brief exactly like POST /subscribe. What may be sent and what the
// email says live in domain.js.

import { EMAIL_RE } from '../../config.js';
import { clientIp, readJson } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { ipHash, sha256Hex } from '../../shared/crypto.js';
import { WELCOME_LANGS } from '../newsletter/welcome.js';
import { SEND_KINDS, SEND_SOURCES, SITE_LANGS, oneOf, renderSendEmail, validatePayload } from './domain.js';

// The per-address key is a hash, so the KV namespace never holds plain
// addresses.
const WINDOW_SECONDS = 60 * 60;
const DEFAULT_PER_IP = 20;
const DEFAULT_PER_ADDRESS = 3;

function limitFrom(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 && n <= 1000 ? n : fallback;
}

async function addressKey(email) {
  return `sendlimit:${await sha256Hex(email.trim().toLowerCase())}`;
}

export async function handleSend({ request, env, origin, services }) {
  const parsed = await readJson(request);
  if (!parsed.ok) return json(400, { error: 'Invalid JSON body' }, origin);
  const { email, hp, lang: rawLang, kind, source, payload, brief } = parsed.value || {};

  if (hp) return json(200, { ok: true }, origin);

  if (!email || typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) {
    return json(400, { error: 'Please enter a valid email address.' }, origin);
  }
  if (!oneOf(SEND_KINDS, kind) || !oneOf(SEND_SOURCES, source)) {
    return json(400, { error: 'Invalid request.' }, origin);
  }
  const checked = validatePayload(kind, source, payload);
  if (!checked.ok) return json(400, { error: 'Invalid request.', detail: checked.error }, origin);

  const lang = oneOf(SITE_LANGS, rawLang) ? rawLang : 'en';
  const wantsBrief = brief === true;

  const ipKey = `sendlimit:ip:${await ipHash(clientIp(request), new Date().toISOString().slice(0, 10), env)}`;
  const addrKey = await addressKey(email);
  if (await services.limiter.exceeded(ipKey, limitFrom(env.SEND_IP_LIMIT_PER_HOUR, DEFAULT_PER_IP), WINDOW_SECONDS)) {
    return json(429, { error: 'Too many attempts. Please try again later.', code: 'rate_limited' }, origin);
  }
  if (await services.limiter.exceeded(addrKey, limitFrom(env.SEND_ADDRESS_LIMIT_PER_HOUR, DEFAULT_PER_ADDRESS), WINDOW_SECONDS)) {
    await services.limiter.refund(ipKey, WINDOW_SECONDS);
    return json(429, { error: 'Too many attempts. Please try again later.', code: 'rate_limited' }, origin);
  }

  const from = env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL;
  if (!from) {
    console.error('send: RESEND_SEND_FROM / RESEND_FROM_EMAIL not set');
    await services.limiter.refund(ipKey, WINDOW_SECONDS);
    await services.limiter.refund(addrKey, WINDOW_SECONDS);
    return json(502, { error: 'Something went wrong. Please try again in a moment.' }, origin);
  }

  const { subject, html } = renderSendEmail({ kind, source, payload: checked.value, lang, brief: wantsBrief });

  try {
    await services.resend.sendEmail({
      from,
      to: [email],
      ...(env.RESEND_REPLY_TO ? { reply_to: env.RESEND_REPLY_TO } : {}),
      subject,
      html,
      tags: [
        { name: 'kind', value: kind },
        { name: 'source', value: source },
      ],
    }, 'Resend send failed', {
      // The same request again within 10 minutes (back to the form, submit again) sends nothing new.
      idempotencyKey: `send-${await sha256Hex(JSON.stringify([email.trim().toLowerCase(), kind, source, lang, wantsBrief, checked.value]))}-${Math.floor(Date.now() / 600000)}`,
    });
  } catch (e) {
    console.error(e);
    // Resend refused the recipient (4xx naming the `to` field, e.g. 422 for an
    // address it will not deliver to): the visitor's input, not an outage, so
    // not counted. Any other 4xx (missing sender, bad key) is our setup: 502.
    if (e && e.status >= 400 && e.status < 500 && e.status !== 429 && /`to`|\bto\b field|recipient/i.test(e.message || '')) {
      await services.limiter.refund(ipKey, WINDOW_SECONDS);
      await services.limiter.refund(addrKey, WINDOW_SECONDS);
      return json(400, { error: 'Please check the email address.', code: 'invalid_recipient' }, origin);
    }
    return json(502, { error: 'Something went wrong. Please try again in a moment.' }, origin);
  }

  try {
    // The Brief welcome follows the page language when it has a template.
    if (wantsBrief) await services.brief.join(email, WELCOME_LANGS.includes(lang) ? lang : 'en');
  } catch (e) {
    // The requested email is already sent: answer 200, so the visitor does not submit again
    // and get it twice; brief: false tells the page the Brief sign-up did not go through.
    console.error(e);
    return json(200, { ok: true, brief: false }, origin);
  }
  return json(200, { ok: true }, origin);
}
