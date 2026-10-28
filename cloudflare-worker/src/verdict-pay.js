// Verdict full report, paid with Stripe Checkout (handover verdict-stripe-nikita.md).
//
// POST /verdict                 free view; with payments on it also stores the
//                               scored result in KV for 24 h and returns its id (rid)
// POST /verdict/checkout        { rid, lang }        -> { ok, url } of a Checkout Session
// POST /verdict/stripe-webhook  Stripe events, signature checked (no Origin, no CORS)
// POST /verdict/report          { session_id, lang } -> the full report, once per payment
//
// Access is never decided by the Origin header: only a Checkout Session that
// Stripe (webhook or API) reports as paid opens the report. Each payment
// opens one report; it can be reloaded for REPORT_WINDOW_MS after the first
// open, later the same session_id gets the free view again.
//
// Payments are on only with VERDICT_PAYMENTS=1 plus the secrets
// STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_VERDICT. The
// staging Worker (wrangler env "staging") also sets STRIPE_TEST_ONLY=1, so a
// live key stored there by mistake switches payments off instead of charging.
// Optional: STRIPE_AUTOMATIC_TAX=1 (Stripe Tax, price tax-inclusive) and
// STRIPE_INVOICE=1 (invoice after payment), both pending the accountant (handover 4).
//
// KV (RATE_LIMIT_KV, like the other verdict:* keys):
//   verdict:res:<rid>    { result, profile, lang }  24 h; the scored result, never the decision text
//   verdict:paid:<cs_id> { rid, status, usedAt, ... } 30 days
//   verdict:pi:<pi_id>   cs_id                      90 days, for charge.refunded

export const RESULT_TTL = 60 * 60 * 24;
export const PAID_TTL = 60 * 60 * 24 * 30;
export const PI_TTL = 60 * 60 * 24 * 90;
export const REPORT_WINDOW_MS = 30 * 60 * 1000;
export const SIGNATURE_TOLERANCE_S = 300;
const PRODUCT = 'verdict_report';
const RID_RE = /^[a-f0-9]{32}$/;
const SESSION_RE = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

export function paymentsOn(env) {
  const key = env.STRIPE_SECRET_KEY || '';
  if (env.VERDICT_PAYMENTS !== '1' || !key || !env.STRIPE_PRICE_ID_VERDICT) return false;
  if (env.STRIPE_TEST_ONLY === '1' && !/^(sk|rk)_test_/.test(key)) return false;
  return true;
}

// Page languages; messages here exist in sk and en (ru reads the en ones).
const PAGE_LANGS = ['sk', 'en', 'ru'];
const pageLang = (x) => (PAGE_LANGS.includes(x) ? x : 'en');
const msgLang = (x) => (x === 'sk' ? 'sk' : 'en');

export function newRid() {
  return crypto.randomUUID().replace(/-/g, '');
}

export async function storeResult(env, rid, result, profile, lang) {
  await env.RATE_LIMIT_KV.put(`verdict:res:${rid}`, JSON.stringify({ result, profile, lang }), { expirationTtl: RESULT_TTL });
}

// { a: { b: [1] } } -> a[b][0]=1, the form encoding the Stripe API takes.
export function stripeForm(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') stripeForm(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripeApi(env, method, path, params, idempotencyKey) {
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  if (params) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method, headers, body: params ? stripeForm(params).toString() : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function hex(buf) {
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let n = 0; n < a.length; n++) d |= a.charCodeAt(n) ^ b.charCodeAt(n);
  return d === 0;
}

export async function stripeSignature(secret, timestamp, payload) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
}

// Stripe-Signature: t=<unix>,v1=<hex>[,v1=...]  (https://docs.stripe.com/webhooks#verify-manually)
export async function verifyStripeSignature(secret, header, payload, now = Date.now()) {
  if (!secret || !header) return false;
  let t = null;
  const v1 = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') t = v;
    else if (k === 'v1' && v) v1.push(v);
  }
  if (!t || !/^\d+$/.test(t) || !v1.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > SIGNATURE_TOLERANCE_S) return false;
  const expected = await stripeSignature(secret, t, payload);
  return v1.some((s) => sameString(s, expected));
}

function isVerdictSession(s) {
  return s && s.object === 'checkout.session' && s.metadata && s.metadata.product === PRODUCT && RID_RE.test(s.metadata.rid || '');
}

async function getPaid(env, sid) {
  const raw = await env.RATE_LIMIT_KV.get(`verdict:paid:${sid}`);
  return raw ? JSON.parse(raw) : null;
}

async function putPaid(env, sid, rec) {
  await env.RATE_LIMIT_KV.put(`verdict:paid:${sid}`, JSON.stringify(rec), { expirationTtl: PAID_TTL });
}

// A paid Checkout Session -> KV. Keeps usedAt and a refund already recorded.
export async function markPaid(env, s, now = Date.now()) {
  const old = await getPaid(env, s.id);
  const rec = {
    rid: s.metadata.rid,
    status: old && old.status === 'refunded' ? 'refunded' : 'paid',
    livemode: !!s.livemode,
    amount: s.amount_total,
    currency: s.currency,
    pi: s.payment_intent || null,
    paidAt: (old && old.paidAt) || now,
    usedAt: (old && old.usedAt) || null,
  };
  await putPaid(env, s.id, rec);
  if (rec.pi) await env.RATE_LIMIT_KV.put(`verdict:pi:${rec.pi}`, s.id, { expirationTtl: PI_TTL });
  return rec;
}

export async function handleCheckout(request, env, origin, { json }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' }, origin);
  }
  const page = pageLang(body?.lang);
  const lang = msgLang(page);
  if (!paymentsOn(env)) return json(503, { error: lang === 'sk' ? 'Platby zatiaľ nie sú otvorené.' : 'Payments are not open yet.' }, origin);
  const rid = typeof body?.rid === 'string' ? body.rid : '';
  if (!RID_RE.test(rid)) return json(400, { error: 'Invalid rid' }, origin);
  const stored = await env.RATE_LIMIT_KV.get(`verdict:res:${rid}`);
  if (!stored) {
    return json(404, { error: lang === 'sk' ? 'Tento verdikt už vypršal (24 h). Spustite ho, prosím, znova.' : 'This verdict has expired (24 h). Please run it again.' }, origin);
  }
  const pageUrl = `${origin}${page === 'en' ? '' : '/' + page}/verdict.html`;
  const params = {
    mode: 'payment',
    line_items: [{ price: env.STRIPE_PRICE_ID_VERDICT, quantity: 1 }],
    success_url: `${pageUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${pageUrl}?canceled=1`,
    client_reference_id: rid,
    metadata: { product: PRODUCT, rid, lang: page },
    locale: page,
    automatic_tax: env.STRIPE_AUTOMATIC_TAX === '1' ? { enabled: true } : undefined,
    invoice_creation: env.STRIPE_INVOICE === '1' ? { enabled: true } : undefined,
  };
  // Same rid + lang within 24 h -> the same Session (a double click or a
  // return from cancel_url does not create a second one).
  const r = await stripeApi(env, 'POST', '/checkout/sessions', params, `verdict-checkout-${rid}-${page}`);
  if (!r.ok || !r.data.url) {
    console.error('verdict checkout: stripe', r.status, r.data?.error?.type, r.data?.error?.code, r.data?.error?.param);
    return json(502, { error: lang === 'sk' ? 'Platbu sa nepodarilo otvoriť. Skúste to o chvíľu.' : 'Could not open the payment. Please try again in a moment.' }, origin);
  }
  return json(200, { ok: true, url: r.data.url }, origin);
}

export async function handleStripeWebhook(request, env, now = Date.now()) {
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  if (!env.STRIPE_WEBHOOK_SECRET) return reply(503, { error: 'Webhook not configured' });
  const payload = await request.text();
  if (!(await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, request.headers.get('Stripe-Signature'), payload, now))) {
    return reply(400, { error: 'Invalid signature' });
  }
  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return reply(400, { error: 'Invalid JSON' });
  }
  const obj = event?.data?.object;
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    // Other Virtuse payments on the same account have no Verdict metadata: ignored.
    if (isVerdictSession(obj) && obj.payment_status === 'paid') await markPaid(env, obj, now);
  } else if (event.type === 'charge.refunded' && obj?.payment_intent) {
    const sid = await env.RATE_LIMIT_KV.get(`verdict:pi:${obj.payment_intent}`);
    const rec = sid && (await getPaid(env, sid));
    if (rec) {
      rec.amountRefunded = obj.amount_refunded;
      if (obj.refunded) rec.status = 'refunded';
      await putPaid(env, sid, rec);
    }
  }
  return reply(200, { received: true });
}

// After the redirect from Stripe. KV first (webhook); if the webhook has not
// arrived yet, ask Stripe directly. Returns { report } | { used } | { error, status }.
export async function paidReport(env, sid, now = Date.now()) {
  let rec = await getPaid(env, sid);
  if (!rec) {
    const r = await stripeApi(env, 'GET', `/checkout/sessions/${encodeURIComponent(sid)}`);
    if (!r.ok || !isVerdictSession(r.data) || r.data.payment_status !== 'paid') return { status: 402, error: 'unpaid' };
    rec = await markPaid(env, r.data, now);
  }
  if (rec.status !== 'paid') return { status: 402, error: rec.status };
  const raw = await env.RATE_LIMIT_KV.get(`verdict:res:${rec.rid}`);
  if (!raw) return { status: 410, error: 'expired' };
  const stored = JSON.parse(raw);
  if (!rec.usedAt) {
    rec.usedAt = now;
    await putPaid(env, sid, rec);
  } else if (now - rec.usedAt > REPORT_WINDOW_MS) {
    return { used: true, stored };
  }
  return { report: true, stored, until: rec.usedAt + REPORT_WINDOW_MS };
}

const REPORT_ERRORS = {
  unpaid: { sk: 'Platba nie je potvrdená. Ak vám boli strhnuté peniaze, napíšte na info@virtuse.com.', en: 'The payment is not confirmed. If you were charged, write to info@virtuse.com.' },
  refunded: { sk: 'Táto platba bola vrátená.', en: 'This payment was refunded.' },
  expired: { sk: 'Výsledok už nie je uložený (24 h). Napíšte na info@virtuse.com, platbu vám vrátime.', en: 'The result is no longer stored (24 h). Write to info@virtuse.com and we will refund you.' },
};

export async function handleReport(request, env, origin, { json, aiJson, freeView, reportView, verdictOpts = (_env, l) => ({ lang: l }) }, now = Date.now()) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' }, origin);
  }
  const page = pageLang(body?.lang);
  const lang = msgLang(page);
  if (!paymentsOn(env)) return json(503, { error: lang === 'sk' ? 'Platby zatiaľ nie sú otvorené.' : 'Payments are not open yet.' }, origin);
  const sid = typeof body?.session_id === 'string' ? body.session_id : '';
  if (!SESSION_RE.test(sid)) return json(400, { error: REPORT_ERRORS.unpaid[lang] }, origin);
  let out;
  try {
    out = await paidReport(env, sid, now);
  } catch (e) {
    console.error(e);
    return json(502, { error: lang === 'sk' ? 'Niečo sa pokazilo. Skúste to o chvíľu.' : 'Something went wrong. Please try again in a moment.' }, origin);
  }
  if (out.error) return json(out.status, { error: (REPORT_ERRORS[out.error] || REPORT_ERRORS.unpaid)[lang] }, origin);
  const { result, profile } = out.stored;
  const opts = verdictOpts(env, pageLang(out.stored.lang || page));
  if (out.used) return aiJson(json, { ...freeView(result, profile, opts), reportUsed: true }, origin);
  return aiJson(json, { ...reportView(result, profile, opts), paid: true, until: out.until }, origin);
}
