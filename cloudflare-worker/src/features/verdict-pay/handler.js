// Verdict full report, paid with Stripe Checkout (€14 one-time, price ID in
// STRIPE_PRICE_ID_VERDICT). Rules in domain.js, KV records in store.js.
//
// POST /verdict/checkout       { rid, lang }        -> { url } of a Checkout Session
//                              { answers, lang, email } Verdict Lite: stores the answers
//                              24 h under a new rid, same Session and same webhook
// POST /verdict/stripe-webhook (Stripe, signed)      checkout.session.completed,
//                              checkout.session.async_payment_succeeded, charge.refunded
// POST /verdict/report         { session_id, lang } -> the full report, open for
//                              30 minutes from the first opening; after that the free view
//                              { ..., format: 'pdf' } (Verdict Lite) -> { filename, pdf } in base64,
//                              the same PDF as in the email, inside the same 30 minutes
//
// The webhook also emails the buyer a purchase confirmation with the report
// as a PDF (receipt.js, pdf.js), once per Session (emailedAt in the KV record).
// Only the webhook sends it, so a parallel /verdict/report cannot send twice.
// VERDICT_RECEIPT_TO (staging) sends every confirmation to that address instead.

import { EMAIL_RE } from '../../config.js';
import { clientIp, readJson } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { createStripeClient, verifyStripeSignature } from '../../infra/stripe.js';
import { freeView, reportView, verdictOpts } from '../verdict/domain.js';
import { ipHash } from '../../shared/crypto.js';
import { aiJson } from '../verdict/handler.js';
import { liteReportView } from '../verdict-lite/report.js';
import { validateAnswers } from '../verdict-lite/rules.js';
import {
  LITE_CHECKOUT_PER_HOUR, LITE_SESSION_S, LITE_TERMS, PAY_TEXT, REPORT_ERRORS, REPORT_WINDOW_MS, RID_RE, SESSION_RE, SIGNATURE_TOLERANCE_S, checkoutParams,
  isVerdictSession, msgLang, pageLang, paymentsOn, sessionMatchesKey, testKey,
} from './domain.js';
import { renderReportPdf } from './pdf.js';
import { operatorLine, orderNumber, receiptLang, renderReceipt, reportFilename } from './receipt.js';
import { createPayStore, newRid } from './store.js';
import { createKvLimiter } from '../../shared/rate-limiter.js';

export const REPORT_LOOKUPS_PER_HOUR = 30;
import { deliveryAlert, renderFailedNotice } from './alerts.js';
import { INTER_BOLD, INTER_REGULAR } from '../../generated/fonts.js';

const stripeFor = (ctx) => createStripeClient(ctx.env.STRIPE_SECRET_KEY, ctx.fetch);

export async function handleCheckout(ctx) {
  const { request, env, origin } = ctx;
  const parsed = await readJson(request);
  if (!parsed.ok) return json(400, { error: 'Invalid JSON body' }, origin);
  const body = parsed.value;
  const page = pageLang(body?.lang);
  const lang = msgLang(page);
  if (!paymentsOn(env)) return json(503, { error: PAY_TEXT.closed[lang], code: 'closed' }, origin);
  let rid;
  let params;
  if (body?.answers) {
    // Verdict Lite: no stored result exists yet, so this call makes one. It is
    // the only unauthenticated write on this route, hence the limit per IP.
    const checked = validateAnswers(body.answers);
    if (!checked.ok) return json(400, { error: PAY_TEXT.badAnswers[lang], detail: checked.error }, origin);
    const day = new Date(ctx.now ?? Date.now()).toISOString().slice(0, 10);
    if (await ctx.services.limiter.exceeded(`verdict:litepay:${await ipHash(clientIp(request), day, env)}`, LITE_CHECKOUT_PER_HOUR, 60 * 60)) {
      return json(429, { error: PAY_TEXT.tooMany[lang], code: 'rate_limited' }, origin);
    }
    rid = newRid();
    await createPayStore(env.RATE_LIMIT_KV).storeLite(rid, checked.value, lang);
    const email = typeof body.email === 'string' && body.email.length <= 254 && EMAIL_RE.test(body.email) ? body.email : undefined;
    params = checkoutParams(env, origin, rid, lang, {
      customer_email: email,
      expires_at: Math.floor(ctx.now / 1000) + LITE_SESSION_S,
      custom_text: { submit: { message: LITE_TERMS[lang] } },
      // Billing address + the card's country + ip_country: evidence of the customer's country (VAT).
      billing_address_collection: 'required',
    }, request.cf?.country);
  } else {
    rid = typeof body?.rid === 'string' ? body.rid : '';
    if (!RID_RE.test(rid)) return json(400, { error: 'Invalid rid' }, origin);
    if (!(await createPayStore(env.RATE_LIMIT_KV).hasResult(rid))) return json(404, { error: PAY_TEXT.expiredRun[lang] }, origin);
    params = checkoutParams(env, origin, rid, page);
  }
  // Same rid + lang within 24 h -> the same Session (a double click or a
  // return from cancel_url does not create a second one).
  let r;
  try {
    r = await stripeFor(ctx).request('POST', '/checkout/sessions', params, `verdict-checkout-${rid}-${page}`);
  } catch (e) {
    console.error(e);
    r = { ok: false, status: 0, data: {} };
  }
  if (!r.ok || !r.data.url) {
    console.error('verdict checkout: stripe', r.status, r.data?.error?.type, r.data?.error?.code, r.data?.error?.param);
    // Nobody can pay while this fails: tell Virtuse, once per hour (and again at the 5th failure).
    await deliveryAlert(ctx, {
      key: `checkout:${new Date(ctx.now).toISOString().slice(0, 13)}`, kind: 'checkout_failed', lang,
      detail: `Stripe status ${r.status}${r.data?.error ? ` · ${[r.data.error.type, r.data.error.code, r.data.error.param].filter(Boolean).join(' · ')}` : ''}`,
    });
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

// The report PDF for one paid Session; the email and the download share it.
function reportPdf(view, lang, sid, paidAt) {
  return renderReportPdf(view, {
    lang, fonts: { regular: fromBase64(INTER_REGULAR), bold: fromBase64(INTER_BOLD) },
    date: new Date(paidAt), order: orderNumber(sid), operator: operatorLine(lang),
  });
}

// The Stripe invoice page for the email. Without it the buyer still gets Stripe's own invoice email.
async function invoiceLink(ctx, session) {
  if (typeof session.invoice !== 'string') return null;
  try {
    const r = await stripeFor(ctx).request('GET', `/invoices/${encodeURIComponent(session.invoice)}`);
    return (r.ok && r.data.hosted_invoice_url) || null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Purchase confirmation + report PDF for one paid Session. Returns false when
// sending failed (the webhook then answers 500 and Stripe retries).
// At most one email per Session: emailedAt in KV, a 60 s claim (sendingAt) against
// a parallel delivery of the same event, and Resend's Idempotency-Key.
export const SENDING_CLAIM_MS = 60 * 1000;
export async function sendReceipt(ctx, session, rec, store) {
  const { env, now } = ctx;
  if (rec.emailedAt) return true;
  if (rec.sendingAt && now - rec.sendingAt < SENDING_CLAIM_MS) return false;   // another run is sending; Stripe retries
  const lang = receiptLang(session.metadata?.lang);
  const buyer = session.customer_details?.email || session.customer_email;
  const to = env.VERDICT_RECEIPT_TO || buyer;
  const alert = (kind, detail) => deliveryAlert(ctx, { kind, sid: session.id, rid: rec.rid, lang, email: buyer, detail });
  if (!to) { console.error('verdict receipt: no email on session'); await alert('no_email'); return true; }
  const stored = await store.getResult(rec.rid);
  if (!stored) {
    console.error('verdict receipt: result expired', rec.rid);
    if (!rec.failNoticeAt) {
      try {
        const n = renderFailedNotice(lang, session.id);
        await ctx.services.resend.sendEmail({
          from: env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL, to: [to], reply_to: env.RESEND_REPLY_TO || 'info@virtuse.com',
          subject: n.subject, html: n.html, tags: [{ name: 'kind', value: 'verdict_receipt' }],
        }, 'Resend verdict notice failed', { idempotencyKey: `verdict-notice-${session.id}` });
        rec.failNoticeAt = now;
        await store.putPaid(session.id, rec);
      } catch (e) {
        console.error(e);
      }
    }
    await alert('result_expired');
    return true;
  }
  // Re-read just before claiming: a parallel run may have sent or claimed meanwhile.
  // KV is not atomic, so Resend's Idempotency-Key below is the final guard.
  const fresh = await store.getPaid(session.id);
  if (fresh?.emailedAt) return true;
  if (fresh?.sendingAt && now - fresh.sendingAt < SENDING_CLAIM_MS) return false;
  rec.sendingAt = now;
  await store.putPaid(session.id, rec);
  try {
    const view = stored.lite
      ? liteReportView(stored.answers, stored.lang, new Date(rec.paidAt || now), { partners: env.VERDICT_REPORT_PARTNERS === '1' })
      : reportView(stored.result, stored.profile, verdictOpts(env, pageLang(stored.lang || lang)));
    const pdf = await reportPdf(view, lang, session.id, rec.paidAt || now);
    const invoiceUrl = await invoiceLink(ctx, session);
    const mail = renderReceipt({ lang, sid: session.id, amount: rec.amount, currency: rec.currency, paidAt: rec.paidAt || now, lite: !!stored.lite, vat: session.total_details?.amount_tax, invoiceUrl });
    await ctx.services.resend.sendEmail({
      from: env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL,
      to: [to],
      reply_to: env.RESEND_REPLY_TO || 'info@virtuse.com',
      subject: mail.subject,
      html: mail.html,
      attachments: [{ filename: mail.filename, content: toBase64(pdf) }],
      // order: lets a bounce alert (POST /resend/webhook) name the order.
      tags: [{ name: 'kind', value: 'verdict_receipt' }, { name: 'order', value: orderNumber(session.id) }],
    }, 'Resend verdict receipt failed', { idempotencyKey: `verdict-receipt-${session.id}` });
  } catch (e) {
    console.error(e);
    delete rec.sendingAt;
    await store.putPaid(session.id, rec);
    await alert('send_failed', e?.message);
    return false;
  }
  delete rec.sendingAt;
  rec.emailedAt = now;
  await store.markEmailed(session.id, now);
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
    if (isVerdictSession(obj) && obj.payment_status === 'paid' && sessionMatchesKey(env, obj.id)) {
      const rec = await store.markPaid(obj, now);
      if (rec.status === 'paid' && !(await sendReceipt(ctx, obj, rec, store))) return reply(500, { error: 'Receipt not sent' });
    }
  } else if (event.type === 'charge.refunded' && obj?.payment_intent) {
    // The marker is kept by payment even when the order is not recorded yet (events can arrive out of order).
    await store.markRefunded(obj.payment_intent, obj.amount_refunded, !!obj.refunded);
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
  if (!sessionMatchesKey(env, sid)) return { status: 402, error: 'unpaid' };
  let rec = await store.getPaid(sid);
  // A record written by the other mode (shared KV before 2026-11-12) does not count.
  if (rec && typeof rec.livemode === 'boolean' && rec.livemode === testKey(env)) return { status: 402, error: 'unpaid' };
  if (!rec) {
    // Each unknown id costs a Stripe API call: limit them per IP, so nobody can use up the
    // account's Stripe rate limit (which would stop Checkout for everyone).
    if (ctx.request) {
      const day = new Date(now).toISOString().slice(0, 10);
      const key = `verdict:lookup:${await ipHash(clientIp(ctx.request), day, env)}`;
      if (await createKvLimiter(env.RATE_LIMIT_KV).exceeded(key, REPORT_LOOKUPS_PER_HOUR, 60 * 60)) return { status: 429, error: 'tooMany' };
    }
    const r = await stripeFor(ctx).request('GET', `/checkout/sessions/${encodeURIComponent(sid)}`);
    if (!r.ok || !isVerdictSession(r.data) || r.data.payment_status !== 'paid') return { status: 402, error: 'unpaid' };
    rec = await store.markPaid(r.data, now);
  }
  if (rec.status !== 'paid') return { status: 402, error: rec.status };
  const stored = await store.getResult(rec.rid);
  if (!stored) return { status: 410, error: rec.emailedAt ? 'emailed' : 'expired' };
  if (!rec.usedAt) {
    await store.markUsed(sid, now);
    rec = (await store.getPaid(sid)) || rec;
    if (!rec.usedAt) rec.usedAt = now;
    await store.putPaid(sid, rec);
  }
  if (now - rec.usedAt > REPORT_WINDOW_MS) return { used: true, stored };
  return { report: true, stored, until: rec.usedAt + REPORT_WINDOW_MS, paidAt: rec.paidAt };
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
  if (out.error === 'tooMany') return json(429, { error: PAY_TEXT.tooMany[lang], code: 'rate_limited' }, origin);
  if (out.error) return json(out.status, { error: (REPORT_ERRORS[out.error] || REPORT_ERRORS.unpaid)[lang] }, origin);
  if (out.stored.lite) {
    if (out.used) return json(200, { lite: true, reportUsed: true }, origin);
    const view = liteReportView(out.stored.answers, out.stored.lang, new Date(out.paidAt), { partners: env.VERDICT_REPORT_PARTNERS === '1' });
    if (body.format === 'pdf') {
      try {
        const pdf = await reportPdf(view, view.lang, sid, out.paidAt);
        return json(200, { filename: reportFilename(out.paidAt, sid), pdf: toBase64(pdf) }, origin);
      } catch (e) {
        console.error(e);
        return json(502, { error: PAY_TEXT.fail[lang] }, origin);
      }
    }
    return json(200, { ...view, paid: true, until: out.until }, origin);
  }
  const { result, profile } = out.stored;
  const opts = verdictOpts(env, pageLang(out.stored.lang || page));
  if (out.used) return aiJson({ ...freeView(result, profile, opts), reportUsed: true }, origin);
  return aiJson({ ...reportView(result, profile, opts), paid: true, until: out.until }, origin);
}
