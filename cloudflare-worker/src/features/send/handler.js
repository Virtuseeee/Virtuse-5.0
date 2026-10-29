// POST /send  { email, hp, lang, kind, source, payload, brief }
//
// Order of checks: JSON -> honeypot -> address -> kind/source -> payload ->
// per-IP + per-address limit -> send. With `brief: true` the address also
// joins the Brief exactly like POST /subscribe. What may be sent and what the
// email says live in domain.js.

import { EMAIL_RE } from '../../config.js';
import { clientIp, readJson } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { sha256Hex } from '../../shared/crypto.js';
import { WELCOME_LANGS } from '../newsletter/welcome.js';
import { SEND_KINDS, SEND_SOURCES, SITE_LANGS, oneOf, renderSendEmail, validatePayload } from './domain.js';

// Per-address limit on top of the shared per-IP one. The key is a hash, so
// the KV namespace never holds plain addresses.
const PER_ADDRESS = { max: 3, windowSeconds: 60 * 60 };

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

  if (
    (await services.signupLimited(clientIp(request))) ||
    (await services.limiter.exceeded(await addressKey(email), PER_ADDRESS.max, PER_ADDRESS.windowSeconds))
  ) {
    return json(429, { error: 'Too many attempts. Please try again later.' }, origin);
  }

  const { subject, html } = renderSendEmail({ kind, source, payload: checked.value, lang, brief: wantsBrief });

  try {
    await services.resend.sendEmail({
      from: env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL,
      to: [email],
      ...(env.RESEND_REPLY_TO ? { reply_to: env.RESEND_REPLY_TO } : {}),
      subject,
      html,
      tags: [
        { name: 'kind', value: kind },
        { name: 'source', value: source },
      ],
    });

    // The Brief welcome follows the page language when it has a template.
    if (wantsBrief) await services.brief.join(email, WELCOME_LANGS.includes(lang) ? lang : 'en');
    return json(200, { ok: true }, origin);
  } catch (e) {
    console.error(e);
    return json(502, { error: 'Something went wrong. Please try again in a moment.' }, origin);
  }
}
