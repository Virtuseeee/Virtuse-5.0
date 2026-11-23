// POST /subscribe  { email, hp, lang, turnstile?, ref?, source? }
//
// hp is the honeypot (must be empty). lang picks the welcome email and the
// Resend segment (see welcome.js, segments.js); anything else becomes 'en'.
// With BRIEF_DOUBLE_OPTIN=1 (optin.js) the address is not added here: it gets a
// confirmation email and the answer is { ok: true, pending: true }. ref is a
// creator code, source the form that sent it; both are kept in the consent record.

import { EMAIL_MAX_LENGTH, EMAIL_RE, SIGNUP_MAX_BYTES } from '../../config.js';
import { clientIp, readJson } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { welcomeLang } from './welcome.js';
import { optinEnabled, startOptin } from './optin.js';

export async function handleSubscribe({ request, env, origin, url, now, services }) {
  const body = await readJson(request, SIGNUP_MAX_BYTES);
  if (body.tooLarge) return json(413, { error: 'Request too large.' }, origin);
  if (!body.ok) return json(400, { error: 'Invalid JSON body' }, origin);

  const { email, hp, lang: rawLang, turnstile, ref, source } = body.value || {};
  const lang = welcomeLang(rawLang);

  // A bot filled the hidden field: pretend success, do nothing.
  if (hp) return json(200, { ok: true }, origin);

  if (!email || typeof email !== 'string' || email.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(email)) {
    return json(400, { error: 'Please enter a valid email address.' }, origin);
  }

  const blocked = await services.captcha(request, turnstile, origin);
  if (blocked) return blocked;

  // Staging (SUBSCRIBE_DRY_RUN=1): answer like a real sign-up, store and send nothing.
  // With double opt-in on, staging sends the confirmation to BRIEF_TEST_TO instead (optin.js).
  if (env.SUBSCRIBE_DRY_RUN === '1' && !optinEnabled(env)) return json(200, { ok: true, dryRun: true }, origin);

  if (await services.signupLimited(clientIp(request))) {
    return json(429, { error: 'Too many attempts. Please try again later.' }, origin);
  }

  if (await services.emailCap.exceeded('forms')) return json(429, { error: 'Too many requests right now. Please try again in an hour.', code: 'busy' }, origin);

  try {
    if (optinEnabled(env)) {
      const r = await startOptin({ env, services, email, lang, ref, source, workerOrigin: url.origin, now });
      // 'limited' answers like 'sent': the visitor learns nothing about who asked before.
      if (r !== 'sent') await services.emailCap.refund('forms');
      return json(200, { ok: true, pending: true }, origin);
    }
    await services.brief.join(email, lang);
    return json(200, { ok: true }, origin);
  } catch (e) {
    console.error(e);
    return json(502, { error: 'Something went wrong. Please try again in a moment.' }, origin);
  }
}
