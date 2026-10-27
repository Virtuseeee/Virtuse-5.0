// POST /waitlist  { email, hp, source, lang }
//
// The Virtuse CFO · Verdict waitlist. A sign-up joins its own Resend audience
// (secret RESEND_CFO_AUDIENCE_ID), never the Brief list, and gets one short
// confirmation email with a link to leave the waitlist. Nothing else is sent
// until Verdict and the free fee audit open.
//
// Contacts are created audience-scoped (POST /audiences/{id}/contacts), so
// someone who already reads the Brief can still join the waitlist: the
// unscoped POST /contacts the Brief uses answers "already exists" for them.
//
// No RESEND_CFO_AUDIENCE_ID set -> 503, so the route can be deployed before
// the audience exists without silently dropping sign-ups.

// cfo_plan = the Virtuse CFO card in the pricing table (paid plans).
// verdict_report = "full report" button after a free verdict (verdict-flow.js).
// It joins RESEND_REPORT_AUDIENCE_ID when that secret is set, else the CFO
// audience. Only the email is kept, never the decision text.
export const WAITLIST_SOURCES = ['cfo_page', 'cfo_plan', 'home_buy', 'home_cfo', 'verdict_report'];

import STRINGS from './waitlist-strings.js';

// One confirmation email per language (the form's `lang`; anything else -> English).
export const WAITLIST_LANGS = Object.keys(STRINGS);

export function waitlistSubject(source, lang = 'en') {
  const t = STRINGS[lang] || STRINGS.en;
  if (source === 'verdict_report') return t.subjectReport;
  return source === 'cfo_plan' ? t.subjectPlan : t.subject;
}

export function renderWaitlistEmail(leaveUrl, source, lang = 'en') {
  const L = STRINGS[lang] ? lang : 'en';
  const t = STRINGS[L];
  const plan = source === 'cfo_plan';
  const report = source === 'verdict_report';
  const P = 'style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#c3ccd6;"';
  const b = (s) => s.replace(/<b>/g, '<b style="color:#e6edf3;">');
  return `<!DOCTYPE html>
<html lang="${L}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${waitlistSubject(source, L)}</title></head>
<body style="margin:0;padding:0;background-color:#08090a;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#08090a;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:100%;background-color:#141414;border:1px solid #2a2a2a;border-radius:16px;">
<tr><td style="padding:36px 32px;">
<p style="margin:0 0 20px 0;font-size:22px;font-weight:800;"><span style="color:#5FAEDE;">V</span><span style="color:#e6edf3;">irtuse</span> <span style="color:#8b949e;font-weight:400;">CFO</span></p>
<p style="margin:0 0 14px 0;font-size:20px;line-height:28px;font-weight:700;color:#e6edf3;">${t.onList}</p>
${report ? `<p ${P}>${t.report1}</p>
<p ${P}>${t.report2}</p>` : plan ? `<p ${P}>${t.plan1}</p>
<p ${P}>${t.plan2}</p>` : `<p ${P}>${t.wait}</p>`}
<p ${P}>${b(t.verdict)}</p>
<p ${P}>${b(t.audit)}</p>
<p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:#c3ccd6;">${t.quiet}</p>
<p style="margin:0;font-size:12px;line-height:20px;color:#8b949e;">${t.foot} <a href="${leaveUrl}" style="color:#8b949e;">${t.leave}</a></p>
<p style="margin:12px 0 0 0;font-size:11px;line-height:18px;color:#8b949e;">${t.operator}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

export function audienceFor(env, source) {
  return source === 'verdict_report' && env.RESEND_REPORT_AUDIENCE_ID ? env.RESEND_REPORT_AUDIENCE_ID : env.RESEND_CFO_AUDIENCE_ID;
}

async function addToAudience(env, email, audience) {
  const res = await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (res.ok) return { created: true };
  const text = await res.text();
  if (/already exists|duplicate/i.test(text)) return { created: false };
  throw new Error(`Resend waitlist add failed (status ${res.status}): ${text.slice(0, 300)}`);
}

async function sendConfirmation(env, email, leaveUrl, source, lang) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL,
      to: [email],
      subject: waitlistSubject(source, lang),
      html: renderWaitlistEmail(leaveUrl, source, lang),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend waitlist email failed (status ${res.status}): ${text.slice(0, 300)}`);
  }
}

export async function handleWaitlist(request, env, origin, { json, isRateLimited, emailRe, buildUnsubscribeUrl }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' }, origin);
  }
  const { email, hp, source, lang } = body || {};
  if (hp) return json(200, { ok: true }, origin); // honeypot: pretend success, do nothing
  if (!email || typeof email !== 'string' || !emailRe.test(email)) {
    return json(400, { error: 'Please enter a valid email address.' }, origin);
  }
  if (source !== undefined && !WAITLIST_SOURCES.includes(source)) {
    return json(400, { error: 'Unknown source.' }, origin);
  }
  if (!env.RESEND_CFO_AUDIENCE_ID) {
    return json(503, { error: 'The waitlist is not open yet. Please try again later.' }, origin);
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (await isRateLimited(env, ip)) {
    return json(429, { error: 'Too many attempts. Please try again later.' }, origin);
  }
  try {
    const result = await addToAudience(env, email, audienceFor(env, source));
    if (result.created) {
      const leaveUrl = (await buildUnsubscribeUrl(env, email)) + '&list=cfo';
      await sendConfirmation(env, email, leaveUrl, source, typeof lang === 'string' && WAITLIST_LANGS.includes(lang) ? lang : 'en');
    }
    return json(200, { ok: true }, origin);
  } catch (e) {
    console.error(e);
    return json(502, { error: 'Something went wrong. Please try again in a moment.' }, origin);
  }
}

// Leaving the waitlist: same signed link as the Brief unsubscribe plus
// &list=cfo, and it only touches the CFO audience.
export async function leaveWaitlist(env, email) {
  for (const id of [env.RESEND_CFO_AUDIENCE_ID, env.RESEND_REPORT_AUDIENCE_ID]) if (id) await leaveAudience(env, email, id);
}

async function leaveAudience(env, email, audience) {
  const res = await fetch(
    `https://api.resend.com/audiences/${audience}/contacts/${encodeURIComponent(email)}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ unsubscribed: true }),
    }
  );
  if (res.ok || res.status === 404) return;
  const text = await res.text();
  throw new Error(`Resend waitlist leave failed (status ${res.status}): ${text.slice(0, 300)}`);
}
