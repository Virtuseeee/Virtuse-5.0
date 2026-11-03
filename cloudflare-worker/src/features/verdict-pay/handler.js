// Verdict full report, paid with Stripe Checkout (€14 one-time, price ID in
// STRIPE_PRICE_ID_VERDICT). Rules in domain.js, KV records in store.js.
//
// POST /verdict/checkout       { rid, lang }        -> { url } of a Checkout Session
// POST /verdict/stripe-webhook (Stripe, signed)      checkout.session.completed,
//                              checkout.session.async_payment_succeeded, charge.refunded
// POST /verdict/report         { session_id, lang } -> the full report, open for
//                              30 minutes from the first opening; after that the free view
//
// The webhook also emails the buyer a purchase confirmation with the report
// as a PDF (receipt.js, pdf.js), once per Session (emailedAt in the KV record).
// Only the webhook sends it, so a parallel /verdict/report cannot send twice.
// VERDICT_RECEIPT_TO (staging) sends every confirmation to that address instead.

import { readJson } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { createStripeClient, verifyStripeSignature } from '../../infra/stripe.js';
import { freeView, reportView, verdictOpts } from '../verdict/domain.js';
import { aiJson } from '../verdict/handler.js';
import {
  PAY_TEXT, REPORT_ERRORS, REPORT_WINDOW_MS, RID_RE, SESSION_RE, SIGNATURE_TOLERANCE_S, checkoutParams,
  isVerdictSession, msgLang, pageLang, paymentsOn,
} from './domain.js';
import { renderReportPdf } from './pdf.js';
import { operatorLine, orderNumber, receiptLang, renderReceipt } from './receipt.js';
import { createPayStore } from './store.js';
import { INTER_BOLD, INTER_REGULAR } from '../../generated/fonts.js';

const stripeFor = (ctx) => createStripeClient(ctx.env.STRIPE_SECRET_KEY, ctx.fetch);

export async function handleCheckout(ctx) {
  const { request, env, origin } = ctx;
  const parsed = await readJson(request);
  if (!parsed.ok) return json(400, { error: 'Invalid JSON body' }, origin);
  const body = parsed.value;
  const page = pageLang(body?.lang);
  const lang = msgLang(page);
  if (!paymentsOn(env)) return json(503, { error: PAY_TEXT.closed[lang] }, origin);
  const rid = typeof body?.rid === 'string' ? body.rid : '';
  if (!RID_RE.test(rid)) return json(400, { error: 'Invalid rid' }, origin);
  if (!(await createPayStore(env.RATE_LIMIT_KV).hasResult(rid))) return json(404, { error: PAY_TEXT.expiredRun[lang] }, origin);
  // Same rid + lang within 24 h -> the same Session (a double click or a
  // return from cancel_url does not create a second one).
  let r;
  try {
    r = await stripeFor(ctx).request('POST', '/checkout/sessions', checkoutParams(env, origin, rid, page), `verdict-checkout-${rid}-${page}`);
  } catch (e) {
    console.error(e);
    r = { ok: false, status: 0, data: {} };
  }
  if (!r.ok || !r.data.url) {
    console.error('verdict checkout: stripe', r.status, r.data?.error?.type, r.data?.error?.code, r.data?.error?.param);
    return json(502, { error: PAY_TEXT.checkoutFail[lang] }, origin);
  }
  return json(200, { ok: true, url: r.data.url }, origin);
}

const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
function toBase64(bytes) {
  let s = '';
  for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
  return btoa(s);
}

// Purchase confirmation + report PDF for one paid Session. Returns false when
// sending failed (the webhook then answers 500 and Stripe retries).
export async function sendReceipt(ctx, session, rec, store) {
  const { env, now } = ctx;
  if (rec.emailedAt) return true;
  const to = env.VERDICT_RECEIPT_TO || session.customer_details?.email || session.customer_email;
  if (!to) { console.error('verdict receipt: no email on session'); return true; }
  const stored = await store.getResult(rec.rid);
  if (!stored) { console.error('verdict receipt: result expired', rec.rid); return true; }
  const lang = receiptLang(session.metadata?.lang);
  try {
    const view = reportView(stored.result, stored.profile, verdictOpts(env, pageLang(stored.lang || lang)));
    const pdf = await renderReportPdf(view, {
      lang, fonts: { regular: fromBase64(INTER_REGULAR), bold: fromBase64(INTER_BOLD) },
      date: new Date(rec.paidAt || now), order: orderNumber(session.id), operator: operatorLine(lang),
    });
    const mail = renderReceipt({ lang, sid: session.id, amount: rec.amount, currency: rec.currency, paidAt: rec.paidAt || now });
    await ctx.services.resend.sendEmail({
      from: env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL,
      to: [to],
      reply_to: env.RESEND_REPLY_TO || 'info@virtuse.com',
      subject: mail.subject,
      html: mail.html,
      attachments: [{ filename: mail.filename, content: toBase64(pdf) }],
      tags: [{ name: 'kind', value: 'verdict_receipt' }],
    }, 'Resend verdict receipt failed');
  } catch (e) {
    console.error(e);
    return false;
  }
  rec.emailedAt = now;
  await store.putPaid(session.id, rec);
  return true;
}

// Called by Stripe, not the browser: plain JSON, no CORS.
export async function handleStripeWebhook(ctx) {
  const { request, env, now } = ctx;
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  if (!env.STRIPE_WEBHOOK_SECRET) return reply(503, { error: 'Webhook not configured' });
  const payload = await request.text();
  const signed = await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, request.headers.get('Stripe-Signature'), payload, now, SIGNATURE_TOLERANCE_S);
  if (!signed) return reply(400, { error: 'Invalid signature' });
  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return reply(400, { error: 'Invalid JSON' });
  }
  const store = createPayStore(env.RATE_LIMIT_KV);
  const obj = event?.data?.object;
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    // Other Virtuse payments on the same account have no Verdict metadata: ignored.
    if (isVerdictSession(obj) && obj.payment_status === 'paid') {
      const rec = await store.markPaid(obj, now);
      if (rec.status === 'paid' && !(await sendReceipt(ctx, obj, rec, store))) return reply(500, { error: 'Receipt not sent' });
    }
  } else if (event.type === 'charge.refunded' && obj?.payment_intent) {
    const sid = await store.sessionForPayment(obj.payment_intent);
    const rec = sid && (await store.getPaid(sid));
    if (rec) {
      rec.amountRefunded = obj.amount_refunded;
      if (obj.refunded) rec.status = 'refunded';
      await store.putPaid(sid, rec);
    }
  }
  return reply(200, { received: true });
}

// After the redirect from Stripe. KV first (webhook); if the webhook has not
// arrived yet, ask Stripe directly. Returns { report } | { used } | { error, status }.
export async function paidReport(ctx, sid) {
  const { env, now } = ctx;
  const store = createPayStore(env.RATE_LIMIT_KV);
  let rec = await store.getPaid(sid);
  if (!rec) {
    const r = await stripeFor(ctx).request('GET', `/checkout/sessions/${encodeURIComponent(sid)}`);
    if (!r.ok || !isVerdictSession(r.data) || r.data.payment_status !== 'paid') return { status: 402, error: 'unpaid' };
    rec = await store.markPaid(r.data, now);
  }
  if (rec.status !== 'paid') return { status: 402, error: rec.status };
  const stored = await store.getResult(rec.rid);
  if (!stored) return { status: 410, error: 'expired' };
  if (!rec.usedAt) {
    rec.usedAt = now;
    await store.putPaid(sid, rec);
  } else if (now - rec.usedAt > REPORT_WINDOW_MS) {
    return { used: true, stored };
  }
  return { report: true, stored, until: rec.usedAt + REPORT_WINDOW_MS };
}

export async function handleReport(ctx) {
  const { request, env, origin } = ctx;
  const parsed = await readJson(request);
  if (!parsed.ok) return json(400, { error: 'Invalid JSON body' }, origin);
  const body = parsed.value;
  const page = pageLang(body?.lang);
  const lang = msgLang(page);
  if (!paymentsOn(env)) return json(503, { error: PAY_TEXT.closed[lang] }, origin);
  const sid = typeof body?.session_id === 'string' ? body.session_id : '';
  if (!SESSION_RE.test(sid)) return json(400, { error: REPORT_ERRORS.unpaid[lang] }, origin);
  let out;
  try {
    out = await paidReport(ctx, sid);
  } catch (e) {
    console.error(e);
    return json(502, { error: PAY_TEXT.fail[lang] }, origin);
  }
  if (out.error) return json(out.status, { error: (REPORT_ERRORS[out.error] || REPORT_ERRORS.unpaid)[lang] }, origin);
  const { result, profile } = out.stored;
  const opts = verdictOpts(env, pageLang(out.stored.lang || page));
  if (out.used) return aiJson({ ...freeView(result, profile, opts), reportUsed: true }, origin);
  return aiJson({ ...reportView(result, profile, opts), paid: true, until: out.until }, origin);
}
