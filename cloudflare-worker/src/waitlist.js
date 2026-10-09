// POST /waitlist  { email, hp, source }
//
// The Virtuse CFO waitlist. A sign-up joins its own Resend audience
// (secret RESEND_CFO_AUDIENCE_ID), never the Brief list, and gets one short
// confirmation email with a link to leave the waitlist. Nothing else is sent
// until the free audit opens.
//
// Contacts are created audience-scoped (POST /audiences/{id}/contacts), so
// someone who already reads the Brief can still join the waitlist: the
// unscoped POST /contacts the Brief uses answers "already exists" for them.
//
// No RESEND_CFO_AUDIENCE_ID set -> 503, so the route can be deployed before
// the audience exists without silently dropping sign-ups.

export const WAITLIST_SOURCES = ['cfo_page', 'home_buy', 'home_cfo'];

const SUBJECT = "You're on the Virtuse CFO waitlist";

export function renderWaitlistEmail(leaveUrl) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${SUBJECT}</title></head>
<body style="margin:0;padding:0;background-color:#08090a;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#08090a;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px;max-width:100%;background-color:#141414;border:1px solid #2a2a2a;border-radius:16px;">
<tr><td style="padding:36px 32px;">
<p style="margin:0 0 20px 0;font-size:22px;font-weight:800;"><span style="color:#5FAEDE;">V</span><span style="color:#e6edf3;">irtuse</span> <span style="color:#8b949e;font-weight:400;">CFO</span></p>
<p style="margin:0 0 14px 0;font-size:20px;line-height:28px;font-weight:700;color:#e6edf3;">You're on the list.</p>
<p style="margin:0 0 14px 0;font-size:15px;line-height:24px;color:#c3ccd6;">We'll send you one email when the free fee audit opens, planned from 1 December 2026. It reads your exchange export in your browser and shows what your buying really cost you. Nothing is uploaded.</p>
<p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:#c3ccd6;">Until then we won't email you about anything else.</p>
<p style="margin:0;font-size:12px;line-height:20px;color:#8b949e;">You joined the waitlist on virtuse.com. Virtuse never holds your keys or funds and gives no investment advice. <a href="${leaveUrl}" style="color:#8b949e;">Leave the waitlist</a></p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

async function addToAudience(env, email) {
  const res = await fetch(`https://api.resend.com/audiences/${env.RESEND_CFO_AUDIENCE_ID}/contacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (res.ok) return { created: true };
  const text = await res.text();
  if (/already exists|duplicate/i.test(text)) return { created: false };
  throw new Error(`Resend waitlist add failed (status ${res.status}): ${text.slice(0, 300)}`);
}

async function sendConfirmation(env, email, leaveUrl) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL,
      to: [email],
      subject: SUBJECT,
      html: renderWaitlistEmail(leaveUrl),
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
  const { email, hp, source } = body || {};
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
    const result = await addToAudience(env, email);
    if (result.created) {
      const leaveUrl = (await buildUnsubscribeUrl(env, email)) + '&list=cfo';
      await sendConfirmation(env, email, leaveUrl);
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
  if (!env.RESEND_CFO_AUDIENCE_ID) return;
  const res = await fetch(
    `https://api.resend.com/audiences/${env.RESEND_CFO_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`,
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
