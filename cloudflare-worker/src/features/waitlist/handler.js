// POST /waitlist  { email, hp, source, lang }
// and leaving the waitlist from the signed link (&list=cfo, see
// features/newsletter/unsubscribe-handler.js).
//
// No RESEND_CFO_AUDIENCE_ID -> 503, so the route can be deployed before the
// audience exists without silently dropping sign-ups.

import { EMAIL_RE } from '../../config.js';
import { clientIp, readJson } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { unsubscribeUrl } from '../newsletter/unsubscribe-link.js';
import { WAITLIST_LANGS, WAITLIST_SOURCES, audienceFor, renderWaitlistEmail, waitlistSubject } from './domain.js';

export async function handleWaitlist({ request, env, origin, services }) {
  const parsed = await readJson(request);
  if (!parsed.ok) return json(400, { error: 'Invalid JSON body' }, origin);
  const { email, hp, source, lang } = parsed.value || {};

  if (hp) return json(200, { ok: true }, origin); // honeypot: pretend success, do nothing
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return json(400, { error: 'Please enter a valid email address.' }, origin);
  }
  if (source !== undefined && !WAITLIST_SOURCES.includes(source)) {
    return json(400, { error: 'Unknown source.' }, origin);
  }
  // Staging (WAITLIST_DRY_RUN=1): answer like a real sign-up, store and send nothing.
  if (env.WAITLIST_DRY_RUN === '1') return json(200, { ok: true, dryRun: true }, origin);
  if (!env.RESEND_CFO_AUDIENCE_ID) {
    return json(503, { error: 'The waitlist is not open yet. Please try again later.' }, origin);
  }
  if (await services.signupLimited(clientIp(request))) {
    return json(429, { error: 'Too many attempts. Please try again later.' }, origin);
  }

  const { resend } = services;
  try {
    const result = await resend.addToAudience(audienceFor(env, source), { email, unsubscribed: false }, 'Resend waitlist add failed');
    if (result.created) {
      const leaveUrl = (await unsubscribeUrl(env.UNSUB_SECRET, email)) + '&list=cfo';
      const emailLang = typeof lang === 'string' && WAITLIST_LANGS.includes(lang) ? lang : 'en';
      await resend.sendEmail(
        {
          from: env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL,
          to: [email],
          subject: waitlistSubject(source, emailLang),
          html: renderWaitlistEmail(leaveUrl, source, emailLang),
        },
        'Resend waitlist email failed'
      );
    }
    return json(200, { ok: true }, origin);
  } catch (e) {
    console.error(e);
    return json(502, { error: 'Something went wrong. Please try again in a moment.' }, origin);
  }
}

// Leaves the CFO and the report audiences; any Brief subscription stays.
export async function leaveWaitlist(env, resend, email) {
  for (const id of [env.RESEND_CFO_AUDIENCE_ID, env.RESEND_REPORT_AUDIENCE_ID]) {
    if (id) await resend.unsubscribeFromAudience(id, email, 'Resend waitlist leave failed');
  }
}
