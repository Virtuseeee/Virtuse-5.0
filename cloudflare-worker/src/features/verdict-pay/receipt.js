// Purchase confirmation email for the paid Verdict report: order summary,
// operator, terms link and the report PDF as an attachment. Pure: the
// webhook (handler.js) renders the PDF and sends the message.

import WAITLIST_STRINGS from '../../generated/waitlist-strings.js';

const T = {
  en: {
    subject: 'Your Verdict report: payment confirmed',
    hi: 'Thank you for your purchase.',
    lead: 'Your full Verdict report is attached to this email as a PDF. Keep it: on the website the report stays open for 30 minutes after you first open it.',
    order: 'Order summary', product: 'Product', productV: 'Verdict · full report (one-off, no subscription)',
    amount: 'Amount paid', date: 'Date', ref: 'Order number', method: 'Payment', methodV: 'Card, via Stripe',
    terms: 'Terms and conditions', privacy: 'Privacy policy',
    help: 'Questions about your order or a refund: reply to this email or write to info@virtuse.com.',
    note: 'The report rates how complete your thinking is, not whether the decision is right. It is not investment, tax or legal advice.',
    file: 'Virtuse-Verdict-report',
  },
  sk: {
    subject: 'Váš report Verdict: platba potvrdená',
    hi: 'Ďakujeme za nákup.',
    lead: 'Celý report Verdict nájdete v prílohe tohto e-mailu ako PDF. Uschovajte si ho: na webe zostáva report otvorený 30 minút od prvého otvorenia.',
    order: 'Zhrnutie objednávky', product: 'Produkt', productV: 'Verdict · celý report (jednorazovo, bez predplatného)',
    amount: 'Zaplatená suma', date: 'Dátum', ref: 'Číslo objednávky', method: 'Platba', methodV: 'Kartou cez Stripe',
    terms: 'Obchodné podmienky', privacy: 'Ochrana osobných údajov',
    help: 'Otázky k objednávke alebo žiadosť o vrátenie peňazí: odpovedzte na tento e-mail alebo napíšte na info@virtuse.com.',
    note: 'Report hodnotí úplnosť vašej úvahy, nie to, či je rozhodnutie správne. Nejde o investičné, daňové ani právne poradenstvo.',
    file: 'Virtuse-Verdict-report',
  },
  ru: {
    subject: 'Ваш отчёт Verdict: оплата подтверждена',
    hi: 'Спасибо за покупку.',
    lead: 'Полный отчёт Verdict приложен к этому письму в формате PDF. Сохраните его: на сайте отчёт открыт 30 минут с момента первого открытия.',
    order: 'Детали заказа', product: 'Продукт', productV: 'Verdict · полный отчёт (разово, без подписки)',
    amount: 'Оплачено', date: 'Дата', ref: 'Номер заказа', method: 'Оплата', methodV: 'Картой через Stripe',
    terms: 'Условия использования', privacy: 'Политика конфиденциальности',
    help: 'Вопросы по заказу или возврат денег: ответьте на это письмо или напишите на info@virtuse.com.',
    note: 'Отчёт оценивает полноту ваших размышлений, а не правильность решения. Это не инвестиционная, налоговая или юридическая консультация.',
    file: 'Virtuse-Verdict-report',
  },
};

const LOCALE = { en: 'en-GB', sk: 'sk-SK', ru: 'ru-RU' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const receiptLang = (x) => (T[x] ? x : 'en');

// Short, readable order number from the Checkout Session id.
export const orderNumber = (sid) => String(sid || '').replace(/^cs_(test|live)_/, '').slice(0, 10).toUpperCase();

export function operatorLine(lang) {
  return (WAITLIST_STRINGS[lang] || WAITLIST_STRINGS.en).operator;
}

export function formatAmount(minor, currency, lang) {
  return new Intl.NumberFormat(LOCALE[lang] || 'en-GB', { style: 'currency', currency: (currency || 'eur').toUpperCase() }).format((minor || 0) / 100);
}

export function formatDate(ms, lang) {
  return new Date(ms).toLocaleDateString(LOCALE[lang] || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bratislava' });
}

// { subject, html, filename } for one paid Session.
export function renderReceipt({ lang, sid, amount, currency, paidAt }) {
  const L = receiptLang(lang);
  const t = T[L];
  const site = `https://virtuse.com${L === 'en' ? '' : '/' + L}`;
  const row = (k, v) => `<tr><td style="padding:8px 0;color:#5f6670;font-size:14px;width:42%;border-bottom:1px solid #eceef1;">${esc(k)}</td><td style="padding:8px 0;color:#121417;font-size:14px;border-bottom:1px solid #eceef1;">${esc(v)}</td></tr>`;
  const html = `<!doctype html><html lang="${L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:28px 32px 8px 32px;"><img src="https://virtuse.com/email-virtuse-v-mark.png" width="34" height="22" alt="Virtuse" style="display:block;"></td></tr>
<tr><td style="padding:12px 32px 0 32px;">
<h1 style="margin:0 0 12px 0;font-size:22px;line-height:30px;color:#121417;">${esc(t.hi)}</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:24px;color:#2b2f36;">${esc(t.lead)}</p>
<p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#121417;text-transform:uppercase;letter-spacing:.04em;">${esc(t.order)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row(t.product, t.productV)}${row(t.amount, formatAmount(amount, currency, L))}${row(t.date, formatDate(paidAt, L))}${row(t.ref, orderNumber(sid))}${row(t.method, t.methodV)}
</table>
<p style="margin:20px 0 0 0;font-size:14px;line-height:22px;color:#2b2f36;">${esc(t.help)}</p>
<p style="margin:12px 0 0 0;font-size:14px;line-height:22px;"><a href="${site}/terms-and-conditions.html" style="color:#2b62c0;">${esc(t.terms)}</a> · <a href="${site}/privacy-policy.html#verdict-cfo" style="color:#2b62c0;">${esc(t.privacy)}</a></p>
<p style="margin:20px 0 0 0;font-size:12px;line-height:19px;color:#5f6670;">${esc(t.note)}</p>
<p style="margin:12px 0 28px 0;font-size:11px;line-height:18px;color:#8b949e;">${esc(operatorLine(L))}</p>
</td></tr></table></td></tr></table></body></html>`;
  const day = new Date(paidAt).toISOString().slice(0, 10).replace(/-/g, '');
  return { subject: t.subject, html, filename: `${t.file}-${day}-${orderNumber(sid)}.pdf` };
}
