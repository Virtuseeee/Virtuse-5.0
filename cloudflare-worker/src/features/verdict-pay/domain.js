// Verdict full report, paid with Stripe Checkout: the rules. Pure; the
// handlers (handler.js, store.js) do the KV and Stripe calls.
//
// Payments are on only with VERDICT_PAYMENTS=1 plus the secrets
// STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_VERDICT. The
// staging Worker (wrangler env "staging") also sets STRIPE_TEST_ONLY=1, so a
// live key stored there by mistake switches payments off instead of charging.

export const RESULT_TTL = 60 * 60 * 24;
export const PAID_TTL = 60 * 60 * 24 * 30;
export const PI_TTL = PAID_TTL; // the order record and its payment link go together
export const REPORT_WINDOW_MS = 30 * 60 * 1000;
export const SIGNATURE_TOLERANCE_S = 300;
export const PRODUCT = 'verdict_report';
// The wording of terms 5a, the withdrawal page and privacy section 9 at the time of a purchase:
// legal-archive/<date>/ holds each version (a test fails if the pages change without a new date),
// the Stripe metadata and the order record hold this date.
export const TERMS_VERSION = '2026-11-06';
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

const INVOICE_TEXT = {
  en: {
    fields: [['Company ID', '36 709 042'], ['Tax ID', '2022293042'], ['VAT ID', 'SK2022293042']],
    footer: "Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, Slovakia. Registered in the Commercial Register of the Municipal Court Bratislava III, section Sa, file 4452/B. If the buyer's EU VAT ID is shown on this invoice, the VAT is reverse charged (Art. 196 of Directive 2006/112/EC).",
  },
  sk: {
    fields: [['IČO', '36 709 042'], ['DIČ', '2022293042'], ['IČ DPH', 'SK2022293042']],
    footer: 'Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka. Zapísaná v obchodnom registri Mestského súdu Bratislava III, oddiel Sa, vložka č. 4452/B. Ak je na faktúre uvedené IČ DPH odberateľa z EÚ, ide o prenesenie daňovej povinnosti (čl. 196 smernice 2006/112/ES).',
  },
};

// VAT, as the accountant set it out on 6 Nov 2026. Stripe Tax, with a "small seller" registration
// in Slovakia, charges Slovak VAT on EU consumers up to 10,000 EUR a year of cross-border sales, then
// their country's VAT through OSS once the Union OSS registration is added in the Dashboard (no
// code change). An EU business with a VAT ID: reverse charge. Outside the EU: no VAT.
// The 14 EUR price is VAT-inclusive (tax_behavior inclusive on the Price).
function taxParams(env, metadata, page) {
  const out = {};
  if (env.STRIPE_AUTOMATIC_TAX === '1') {
    out.automatic_tax = { enabled: true };
    out.tax_id_collection = { enabled: true };
  }
  if (env.STRIPE_INVOICE === '1') {
    const text = INVOICE_TEXT[page] || INVOICE_TEXT.en;
    out.invoice_creation = {
      enabled: true,
      invoice_data: {
        metadata,
        footer: text.footer,
        custom_fields: text.fields.map(([name, value]) => ({ name, value })),
        rendering_options: { amount_tax_display: 'include_inclusive_tax' },
      },
    };
  }
  return out;
}

// Checkout Session params for one stored result (rid) and page language.
// extra (Verdict Lite): prefilled email, a short expiry (the answers are kept
// only 24 h) and the terms line above the pay button. ipCountry: Cloudflare's country of the
// request, kept on the payment as evidence of the customer's country (VAT), never the IP itself.
export function checkoutParams(env, origin, rid, page, extra = {}, ipCountry = null) {
  const metadata = { product: PRODUCT, rid, lang: page, terms_version: TERMS_VERSION };
  if (ipCountry) metadata.ip_country = ipCountry;
  const pageUrl = `${origin}${page === 'en' ? '' : '/' + page}/verdict.html`;
  return {
    mode: 'payment',
    line_items: [{ price: env.STRIPE_PRICE_ID_VERDICT, quantity: 1 }],
    success_url: `${pageUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${pageUrl}?canceled=1`,
    client_reference_id: rid,
    metadata,
    payment_intent_data: { metadata },
    locale: page,
    ...taxParams(env, metadata, page),
    ...extra,
  };
}

// The KV record of a paid Session. Keeps usedAt and a refund already recorded.
export function paidRecord(s, old, now) {
  return {
    rid: s.metadata.rid,
    terms: s.metadata.terms_version || null,
    status: old && old.status === 'refunded' ? 'refunded' : 'paid',
    livemode: !!s.livemode,
    amount: s.amount_total,
    currency: s.currency,
    pi: s.payment_intent || null,
    paidAt: (old && old.paidAt) || now,
    usedAt: (old && old.usedAt) || null,
    emailedAt: (old && old.emailedAt) || null,
    ...(old && old.sendingAt ? { sendingAt: old.sendingAt } : {}),
    ...(old && old.failNoticeAt ? { failNoticeAt: old.failNoticeAt } : {}),
  };
}

// A Lite Checkout Session expires after 2 hours, well inside the 24 h the
// answers are kept, so a late payment always finds them.
export const LITE_SESSION_S = 2 * 60 * 60;
export const LITE_CHECKOUT_PER_HOUR = 20;

export const LITE_TERMS = {
  en: 'One payment, no subscription. Your report opens right after payment and a PDF comes by email. 30-day refund, no questions asked; your 14-day EU right of withdrawal applies on top, even after you open the report. Withdrawal: virtuse.com/withdrawal.html. Terms: virtuse.com/terms-and-conditions.html',
  sk: 'Jedna platba, bez predplatného. Report sa otvorí hneď po platbe a PDF príde e-mailom. Vrátenie peňazí do 30 dní bez otázok; vaše 14-dňové právo na odstúpenie v EÚ platí navyše, aj po otvorení reportu. Odstúpenie: virtuse.com/sk/withdrawal.html. Podmienky: virtuse.com/sk/terms-and-conditions.html',
};

export const PAY_TEXT = {
  closed: { sk: 'Platby zatiaľ nie sú otvorené.', en: 'Payments are not open yet.' },
  expiredRun: { sk: 'Tento verdikt už vypršal (24 h). Spustite ho, prosím, znova.', en: 'This verdict has expired (24 h). Please run it again.' },
  checkoutFail: { sk: 'Platbu sa nepodarilo otvoriť. Skúste to o chvíľu.', en: 'Could not open the payment. Please try again in a moment.' },
  fail: { sk: 'Niečo sa pokazilo. Skúste to o chvíľu.', en: 'Something went wrong. Please try again in a moment.' },
  badAnswers: { sk: 'Niektoré odpovede chýbajú. Prejdite, prosím, kroky znova.', en: 'Some answers are missing. Please go through the steps again.' },
  tooMany: { sk: 'Príliš veľa pokusov. Skúste to znova o hodinu.', en: 'Too many attempts. Please try again in an hour.' },
};

export const REPORT_ERRORS = {
  unpaid: { sk: 'Platba nie je potvrdená. Ak vám boli strhnuté peniaze, napíšte na info@virtuse.com.', en: 'The payment is not confirmed. If you were charged, write to info@virtuse.com.' },
  refunded: { sk: 'Táto platba bola vrátená.', en: 'This payment was refunded.' },
  expired: { sk: 'Výsledok už nie je uložený (24 h). Napíšte na info@virtuse.com, platbu vám vrátime.', en: 'The result is no longer stored (24 h). Write to info@virtuse.com and we will refund you.' },
  emailed: { sk: 'Odpovede už na webe neuchovávame (24 h). Report máte v e-maile ako PDF; ak ho nenájdete, napíšte na info@virtuse.com.', en: 'Your answers are no longer stored on the site (24 h). The report is in your email as a PDF; if you cannot find it, write to info@virtuse.com.' },
};
