// POST /waitlist, domain part: sources, the confirmation email, which audience.
//
// The Virtuse CFO · Verdict waitlist. A sign-up joins its own Resend audience
// (secret RESEND_CFO_AUDIENCE_ID), never the Brief list, and gets one short
// confirmation email with a link to leave the waitlist. Nothing else is sent
// until the fee audit and Virtuse CFO open.
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

import STRINGS from '../../generated/waitlist-strings.js';

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
