// Delivery problems with the paid Verdict report (2026-11-11, handover 6.8):
//  - an internal alert to Virtuse when the confirmation + PDF cannot be sent
//    (Resend error, result expired, no email on the Session), deduplicated per
//    Session in KV so Stripe's retries do not repeat it: one alert on the first
//    failure, one more once the same Session has failed ALERT_REPEAT_AT times;
//  - a short note to the buyer when the answers expired before the payment was
//    confirmed (no report can be built, the payment is refunded by hand);
//  - POST /resend/webhook: Resend's email.bounced / email.complained for the
//    confirmations (tag kind=verdict_receipt) -> the same alert, once per email_id.
// Recipient: VERDICT_ALERT_TO, else VERDICT_RECEIPT_TO (staging), else info@virtuse.com.
// The buyer's address never goes into a subject and is masked in the body.

import { orderNumber } from './receipt.js';
import { equalStrings, hmacSha256Base64 } from '../../shared/crypto.js';

export const ALERT_TTL = 24 * 60 * 60;
export const ALERT_REPEAT_AT = 5;
export const SVIX_TOLERANCE_S = 300;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function maskEmail(email) {
  const m = /^([^@]+)@(.+)$/.exec(String(email || ''));
  return m ? `${m[1].slice(0, 1)}***@${m[2]}` : '';
}

const alertTo = (env) => env.VERDICT_ALERT_TO || env.VERDICT_RECEIPT_TO || 'info@virtuse.com';
const fromAddr = (env) => env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL;
const bratislava = (ms) => new Date(ms).toLocaleString('sk-SK', { timeZone: 'Europe/Bratislava', dateStyle: 'short', timeStyle: 'medium' });

const KIND_TEXT = {
  send_failed: 'The confirmation email with the PDF could not be sent (Resend error). Stripe retries the webhook.',
  result_expired: 'The answers had expired before the payment was confirmed, so no report can be built. The buyer got a short note; refund the payment in Stripe.',
  no_email: 'The Checkout Session has no email address, so no confirmation was sent.',
  bounced: 'The confirmation email bounced.',
  complained: 'The buyer marked the confirmation email as spam.',
};

export function renderAlert({ kind, sid = '', rid = '', lang = '', email = '', detail = '', attempts = 1, now }) {
  const order = sid ? orderNumber(sid) : '';
  const rows = [
    ['What happened', KIND_TEXT[kind] || kind], ['Order', order], ['Checkout Session', sid], ['Result id', rid], ['Language', lang],
    ['Buyer', maskEmail(email)], ['Attempts so far', attempts > 1 ? String(attempts) : ''], ['Detail', String(detail || '').slice(0, 300)],
    ['Time (Bratislava)', bratislava(now)],
  ].filter(([, v]) => v);
  const subject = `Verdict delivery problem: ${kind}${order ? ` · order ${order}` : ''}${attempts > 1 ? ` · still failing after ${attempts}` : ''}`;
  const html = `<div style="font:14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#111"><p><b>Verdict paid report: delivery needs a look.</b></p><table cellpadding="4" style="border-collapse:collapse">${
    rows.map(([k, v]) => `<tr><td style="color:#666;vertical-align:top">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')
  }</table><p style="color:#666">Stripe Dashboard → Payments → search the order number. Internal message from the Verdict Worker.</p></div>`;
  return { subject, html };
}

const NOTICE = {
  en: {
    subject: 'Your Verdict report: we could not prepare it',
    body: (o) => [`Thank you for your purchase (order ${o}).`, 'We received your payment, but we could not prepare your report: your answers had expired before the payment was confirmed.', 'We will refund your payment. Reply to this email or write to info@virtuse.com and we will sort it out.'],
  },
  sk: {
    subject: 'Váš report Verdict: nepodarilo sa ho pripraviť',
    body: (o) => [`Ďakujeme za nákup (objednávka ${o}).`, 'Platbu sme dostali, report sa však nepodarilo pripraviť: vaše odpovede vypršali skôr, než sa platba potvrdila.', 'Platbu vám vrátime. Odpovedzte na tento e-mail alebo napíšte na info@virtuse.com.'],
  },
};

export function renderFailedNotice(lang, sid) {
  const t = NOTICE[lang] || NOTICE.en;
  const ps = t.body(orderNumber(sid));
  return { subject: t.subject, html: `<div style="font:15px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#111">${ps.map((p) => `<p>${esc(p)}</p>`).join('')}<p>Virtuse</p></div>` };
}

// One internal alert per Session on the first failure, one more at ALERT_REPEAT_AT.
// Returns the attempt count. Never throws: an alert must not change the webhook's answer.
export async function deliveryAlert(ctx, { key, kind, sid, rid, lang, email, detail }) {
  const { env, now } = ctx;
  const kv = env.RATE_LIMIT_KV;
  const k = `alert:${key || sid}`;
  let attempts = 1;
  try {
    const prev = await kv.get(k);
    attempts = (prev ? (Number(JSON.parse(prev).attempts) || 0) : 0) + 1;
    await kv.put(k, JSON.stringify({ attempts, kind, at: now }), { expirationTtl: ALERT_TTL });
  } catch (e) {
    console.error('verdict alert: KV', e);
  }
  if (attempts !== 1 && attempts !== ALERT_REPEAT_AT) return attempts;
  try {
    const mail = renderAlert({ kind, sid, rid, lang, email, detail, attempts, now });
    await ctx.services.resend.sendEmail(
      { from: fromAddr(env), to: [alertTo(env)], subject: mail.subject, html: mail.html, tags: [{ name: 'kind', value: 'verdict_alert' }] },
      'Resend verdict alert failed',
      { idempotencyKey: `verdict-alert-${key || sid}-${attempts}` },
    );
  } catch (e) {
    console.error(e);
  }
  return attempts;
}

// Svix (Resend webhooks): "v1,<base64>" entries, HMAC-SHA256 over "<id>.<timestamp>.<body>",
// key = base64 part of the "whsec_..." secret.
const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function svixSignature(secret, id, timestamp, payload) {
  return hmacSha256Base64(b64ToBytes(String(secret).replace(/^whsec_/, '')), `${id}.${timestamp}.${payload}`);
}

export async function verifySvix(secret, headers, payload, nowMs, tolerance = SVIX_TOLERANCE_S) {
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sigs = headers.get('svix-signature');
  if (!id || !ts || !sigs || !/^\d+$/.test(ts)) return false;
  if (Math.abs(nowMs / 1000 - Number(ts)) > tolerance) return false;
  let want;
  try {
    want = await svixSignature(secret, id, ts, payload);
  } catch {
    return false;
  }
  return sigs.split(' ').some((part) => {
    const [v, s] = part.split(',');
    return v === 'v1' && typeof s === 'string' && equalStrings(s, want);
  });
}

const tagKind = (tags) => (Array.isArray(tags) ? tags.find((t) => t?.name === 'kind')?.value : tags?.kind);

// POST /resend/webhook (Resend calls it, no Origin; the Svix signature is the proof).
export async function handleResendWebhook(ctx) {
  const { request, env, now } = ctx;
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  if (!env.RESEND_WEBHOOK_SECRET) return reply(503, { error: 'Webhook not configured' });
  const payload = await request.text();
  if (!(await verifySvix(env.RESEND_WEBHOOK_SECRET, request.headers, payload, now))) return reply(401, { error: 'Invalid signature' });
  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return reply(400, { error: 'Invalid JSON' });
  }
  const kind = event?.type === 'email.bounced' ? 'bounced' : event?.type === 'email.complained' ? 'complained' : null;
  const d = event?.data || {};
  if (kind && tagKind(d.tags) === 'verdict_receipt' && d.email_id) {
    await deliveryAlert(ctx, { key: `resend:${d.email_id}`, kind, email: Array.isArray(d.to) ? d.to[0] : d.to, detail: `Resend email ${d.email_id}${d.bounce?.message ? ` · ${d.bounce.message}` : ''}` });
  }
  return reply(200, { received: true });
}
