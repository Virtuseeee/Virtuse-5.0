// Verdict full report, paid with Stripe Checkout: the rules. Pure; the
// handlers (handler.js, store.js) do the KV and Stripe calls.
//
// Payments are on only with VERDICT_PAYMENTS=1 plus the secrets
// STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_VERDICT. The
// staging Worker (wrangler env "staging") also sets STRIPE_TEST_ONLY=1, so a
// live key stored there by mistake switches payments off instead of charging.

export const RESULT_TTL = 60 * 60 * 24;
export const PAID_TTL = 60 * 60 * 24 * 30;
export const PI_TTL = 60 * 60 * 24 * 90;
export const REPORT_WINDOW_MS = 30 * 60 * 1000;
export const SIGNATURE_TOLERANCE_S = 300;
export const PRODUCT = 'verdict_report';
export const RID_RE = /^[a-f0-9]{32}$/;
export const SESSION_RE = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

export function paymentsOn(env) {
  const key = env.STRIPE_SECRET_KEY || '';
  if (env.VERDICT_PAYMENTS !== '1' || !key || !env.STRIPE_PRICE_ID_VERDICT) return false;
  if (env.STRIPE_TEST_ONLY === '1' && !/^(sk|rk)_test_/.test(key)) return false;
  return true;
}

// Page languages; messages here exist in sk and en (ru reads the en ones).
const PAGE_LANGS = ['sk', 'en', 'ru'];
export const pageLang = (x) => (PAGE_LANGS.includes(x) ? x : 'en');
export const msgLang = (x) => (x === 'sk' ? 'sk' : 'en');

export function isVerdictSession(s) {
  return !!(s && s.object === 'checkout.session' && s.metadata && s.metadata.product === PRODUCT && RID_RE.test(s.metadata.rid || ''));
}

// Checkout Session params for one stored result (rid) and page language.
export function checkoutParams(env, origin, rid, page) {
  const pageUrl = `${origin}${page === 'en' ? '' : '/' + page}/verdict.html`;
  return {
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
}

// The KV record of a paid Session. Keeps usedAt and a refund already recorded.
export function paidRecord(s, old, now) {
  return {
    rid: s.metadata.rid,
    status: old && old.status === 'refunded' ? 'refunded' : 'paid',
    livemode: !!s.livemode,
    amount: s.amount_total,
    currency: s.currency,
    pi: s.payment_intent || null,
    paidAt: (old && old.paidAt) || now,
    usedAt: (old && old.usedAt) || null,
  };
}

export const PAY_TEXT = {
  closed: { sk: 'Platby zatiaľ nie sú otvorené.', en: 'Payments are not open yet.' },
  expiredRun: { sk: 'Tento verdikt už vypršal (24 h). Spustite ho, prosím, znova.', en: 'This verdict has expired (24 h). Please run it again.' },
  checkoutFail: { sk: 'Platbu sa nepodarilo otvoriť. Skúste to o chvíľu.', en: 'Could not open the payment. Please try again in a moment.' },
  fail: { sk: 'Niečo sa pokazilo. Skúste to o chvíľu.', en: 'Something went wrong. Please try again in a moment.' },
};

export const REPORT_ERRORS = {
  unpaid: { sk: 'Platba nie je potvrdená. Ak vám boli strhnuté peniaze, napíšte na info@virtuse.com.', en: 'The payment is not confirmed. If you were charged, write to info@virtuse.com.' },
  refunded: { sk: 'Táto platba bola vrátená.', en: 'This payment was refunded.' },
  expired: { sk: 'Výsledok už nie je uložený (24 h). Napíšte na info@virtuse.com, platbu vám vrátime.', en: 'The result is no longer stored (24 h). Write to info@virtuse.com and we will refund you.' },
};
