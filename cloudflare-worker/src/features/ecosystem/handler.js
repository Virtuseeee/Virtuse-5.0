// POST /ecosystem-apply  ("Get your project featured" on /ecosystem/promote/)
//
// Order of checks: size cap (5 KB) -> JSON -> honeypot -> validation ->
// Turnstile token present -> configured -> Turnstile siteverify -> per-IP
// limit -> email to the team -> auto-reply (at most one per address per 24 h).
// Nothing is stored or published; the application travels only by email.
// Requests from staging.virtuse.com send both emails to ECOSYSTEM_TEST_TO.

import { EMAIL_RE, STAGING_ORIGIN } from '../../config.js';
import { clientIp } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { byteLength } from '../../shared/crypto.js';
import { verifyTurnstile } from '../../infra/turnstile.js';
import { TURNSTILE_HOSTS, renderAutoReply, renderTeamEmail, validateApplication } from './domain.js';

const MAX_BYTES = 5 * 1024;
const PER_IP = { max: 3, windowSeconds: 60 * 60 };
const AUTO_REPLY_WINDOW_SECONDS = 24 * 60 * 60;
const EMAIL_FAILED = 'Resend ecosystem email failed';

export async function handleEcosystemApply({ request, env, origin, services }) {
  const len = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (len > MAX_BYTES) return json(413, { error: 'too_large' }, origin);
  let raw;
  try {
    raw = await request.text();
  } catch {
    return json(400, { error: 'invalid' }, origin);
  }
  if (byteLength(raw) > MAX_BYTES) return json(413, { error: 'too_large' }, origin);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid' }, origin);
  }
  if (body && body.company_url) return json(200, { ok: true }, origin); // honeypot: pretend success, do nothing

  const v = validateApplication(body, EMAIL_RE);
  if (!v.ok) return json(400, { error: 'invalid', detail: v.error }, origin);
  const app = v.app;

  // A missing or malformed token is a 400 before anything else is spent on the request.
  const token = body.turnstile;
  if (!token || typeof token !== 'string' || token.length > 2048) return json(400, { error: 'captcha' }, origin);
  if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY) return json(503, { error: 'closed' }, origin);

  const ip = clientIp(request);
  // Turnstile first, so failed or retried checks do not use up the visitor's hourly quota.
  if (!(await verifyTurnstile({ secret: env.TURNSTILE_SECRET_KEY, token, ip, allowedHosts: TURNSTILE_HOSTS }))) {
    return json(400, { error: 'captcha' }, origin);
  }
  if (await services.limiter.exceeded(`eco:ip:${ip}`, PER_IP.max, PER_IP.windowSeconds)) {
    return json(429, { error: 'rate_limited' }, origin);
  }

  const test = origin === STAGING_ORIGIN;
  const testTo = env.ECOSYSTEM_TEST_TO || 'vasilisin@virtuse.com';
  const from = env.ECOSYSTEM_FROM || 'Virtuse <info@virtuse.com>';
  const team = env.ECOSYSTEM_TO || 'info@virtuse.com';
  try {
    const t = renderTeamEmail(app, { test });
    await services.resend.sendEmail(
      { from, to: [test ? testTo : team], reply_to: app.contact_email, subject: t.subject, text: t.text, html: t.html },
      EMAIL_FAILED
    );
    if (await services.limiter.claimOnce(`eco:reply:${app.contact_email.toLowerCase()}`, AUTO_REPLY_WINDOW_SECONDS)) {
      const r = renderAutoReply(app, { test });
      await services.resend.sendEmail(
        { from, to: [test ? testTo : app.contact_email], reply_to: team, subject: r.subject, text: r.text, html: r.html },
        EMAIL_FAILED
      );
    }
    return json(200, { ok: true }, origin);
  } catch (e) {
    console.error(e);
    return json(502, { error: 'send_failed' }, origin);
  }
}
