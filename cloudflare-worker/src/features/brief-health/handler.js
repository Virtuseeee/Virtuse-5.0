// Cron (wrangler.toml [triggers]): runs the Brief health check once a day and
// emails the problems to Virtuse. A healthy day sends nothing.
// Recipient: BRIEF_ALERT_TO, else VERDICT_ALERT_TO, else info@virtuse.com.
// Sender: RESEND_SEND_FROM, else RESEND_FROM_EMAIL. Never throws.

import { briefHealthProblems } from './checks.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderHealthAlert(problems, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  return {
    subject: `Virtuse Brief check ${day}: ${problems.length} problem${problems.length === 1 ? '' : 's'}`,
    html: `<div style="font:14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#111"><p><b>The daily Brief check found:</b></p><ul>${
      problems.map((p) => `<li>${esc(p)}</li>`).join('')
    }</ul><p style="color:#666">Pages: https://virtuse.com/news.html and /sk/news.html. Internal message from the Virtuse Worker (features/brief-health).</p></div>`,
  };
}

export async function runBriefHealth({ env, now, fetch: fetchImpl, services }) {
  let problems;
  try {
    const pulseRaw = env.PULSE_KV ? await env.PULSE_KV.get('current') : null;
    problems = await briefHealthProblems({ pulseRaw, fetchImpl, now });
  } catch (e) {
    problems = [`The check itself failed: ${e?.message || e}`];
  }
  if (!problems.length) return { ok: true, problems };
  console.error('brief health:', problems.join(' | '));
  let sent = false;
  try {
    const mail = renderHealthAlert(problems, now);
    await services.resend.sendEmail(
      { from: env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL, to: [env.BRIEF_ALERT_TO || env.VERDICT_ALERT_TO || 'info@virtuse.com'], subject: mail.subject, html: mail.html, tags: [{ name: 'kind', value: 'brief_health' }] },
      'Resend brief health alert failed',
      { idempotencyKey: `brief-health-${new Date(now).toISOString().slice(0, 13)}` },
    );
    sent = true;
  } catch (e) {
    console.error(e);
  }
  return { ok: false, problems, sent };
}
