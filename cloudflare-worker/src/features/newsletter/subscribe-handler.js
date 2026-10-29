// POST /subscribe  { email, hp, lang }
//
// hp is the honeypot (must be empty). lang picks the welcome email and the
// Resend segment (see welcome.js, segments.js); anything else becomes 'en'.

import { EMAIL_RE } from '../../config.js';
import { clientIp, readJson } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { welcomeLang } from './welcome.js';

export async function handleSubscribe({ request, env, origin, services }) {
  const body = await readJson(request);
  if (!body.ok) return json(400, { error: 'Invalid JSON body' }, origin);

  const { email, hp, lang: rawLang } = body.value || {};
  const lang = welcomeLang(rawLang);

  // A bot filled the hidden field: pretend success, do nothing.
  if (hp) return json(200, { ok: true }, origin);

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return json(400, { error: 'Please enter a valid email address.' }, origin);
  }

  // Staging (SUBSCRIBE_DRY_RUN=1): answer like a real sign-up, store and send nothing.
  if (env.SUBSCRIBE_DRY_RUN === '1') return json(200, { ok: true, dryRun: true }, origin);

  if (await services.signupLimited(clientIp(request))) {
    return json(429, { error: 'Too many attempts. Please try again later.' }, origin);
  }

  try {
    await services.brief.join(email, lang);
    return json(200, { ok: true }, origin);
  } catch (e) {
    console.error(e);
    return json(502, { error: 'Something went wrong. Please try again in a moment.' }, origin);
  }
}
