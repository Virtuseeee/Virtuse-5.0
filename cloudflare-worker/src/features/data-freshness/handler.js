// Cron (wrangler.toml [triggers], same daily run as brief-health): the data freshness
// check (checks.js). A healthy day sends nothing.
//
// Recipient: only DATA_ALERT_TO, and only when it is exactly ALERT_TO below. There is
// no fallback: a missing or different value sends nothing and only logs the problems.
// The production copy is a note (option C, 2026-11-26); CHECK_PROD_COPY "1" or "true"
// makes its lag a problem again.
// Never throws.

import { dataFreshnessProblems } from './checks.js';

export const ALERT_TO = 'vasilisin@virtuse.com';
const LINKS = ['https://virtuse.com/asset-returns.html', 'audits/data-freshness-2026-11-26.md (Virtuse-5.0 repo)'];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const on = (v) => v === '1' || v === 'true' || v === true;

export function renderDataAlert({ problems, notes }, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  const list = (xs) => `<ul>${xs.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`;
  return {
    subject: `Virtuse data check ${day}: ${problems.length} problem${problems.length === 1 ? '' : 's'}`,
    html: `<div style="font:14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#111"><p><b>The daily data check found:</b></p>${list(problems)}${
      notes.length ? `<p><b>For information:</b></p>${list(notes)}` : ''
    }<p style="color:#666">${LINKS.map(esc).join('<br>')}<br>Internal message from the Virtuse Worker (features/data-freshness).</p></div>`,
  };
}

export async function runDataFreshness({ env, now, fetch: fetchImpl, services }) {
  let result;
  try {
    const pulseRaw = env.PULSE_KV ? await env.PULSE_KV.get('current') : undefined;
    result = await dataFreshnessProblems({ fetchImpl, now, checkProdCopy: on(env.CHECK_PROD_COPY), pulseRaw });
  } catch (e) {
    result = { problems: [`The check itself failed: ${e?.message || e}`], notes: [] };
  }
  const { problems, notes } = result;
  if (!problems.length) return { ok: true, problems, notes, sent: false };
  console.error('data freshness:', problems.join(' | '));
  if (env.DATA_ALERT_TO !== ALERT_TO) {
    console.error(`data freshness: no email sent (DATA_ALERT_TO is ${env.DATA_ALERT_TO ? 'not the allowed address' : 'not set'}).`);
    return { ok: false, problems, notes, sent: false };
  }
  let sent = false;
  try {
    const mail = renderDataAlert(result, now);
    await services.resend.sendEmail(
      { from: env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL, to: [ALERT_TO], subject: mail.subject, html: mail.html, tags: [{ name: 'kind', value: 'data_freshness' }] },
      'Resend data freshness alert failed',
      { idempotencyKey: `data-freshness-${new Date(now).toISOString().slice(0, 13)}` },
    );
    sent = true;
  } catch (e) {
    console.error(e);
  }
  return { ok: false, problems, notes, sent };
}
