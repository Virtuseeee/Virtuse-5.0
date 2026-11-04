// The online withdrawal function for the paid Verdict report (Slovak Act 108/2024,
// § 20a; Directive (EU) 2023/2673). POST /verdict/withdraw { name, email, order, lang }.
//
// Open to anyone, with no account and no check against the order: a consumer must be
// able to send the statement whatever we can look up. The Worker stores nothing. It
// emails the statement to Virtuse, which refunds through Stripe by hand within 14 days,
// and sends the consumer the confirmation on a durable medium, with date and time.

import { EMAIL_RE } from '../../config.js';
import { clientIp, readJson } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { ipHash } from '../../shared/crypto.js';
import { formatTimestamp } from './receipt.js';

export const WITHDRAW_PER_HOUR = 10;
const WINDOW_S = 60 * 60;
const INBOX = 'info@virtuse.com';

const T = {
  en: {
    subject: 'We received your withdrawal from the contract',
    h: 'We received your withdrawal',
    lead: 'This confirms that your statement of withdrawal reached us. You do not need to do anything else.',
    statement: 'I withdraw from the contract for the supply of digital content: Verdict, full report.',
    labels: { statement: 'Your statement', name: 'Name', email: 'Email', order: 'Order number', at: 'Received on' },
    none: 'not given',
    refund: 'We will refund the full €14 to the same card, at no cost to you, within 14 days of receiving this statement. You do not need to return anything.',
    help: 'Questions: reply to this email or write to info@virtuse.com.',
    bad: { name: 'Please enter your name.', email: 'Please enter a valid email address.' },
    limit: 'Too many attempts. Please write to info@virtuse.com; your withdrawal counts from the moment you send it.',
    fail: 'We could not send this. Please write to info@virtuse.com; your withdrawal counts from the moment you send it.',
  },
  sk: {
    subject: 'Prijali sme vaše odstúpenie od zmluvy',
    h: 'Prijali sme vaše odstúpenie',
    lead: 'Týmto potvrdzujeme, že vaše oznámenie o odstúpení od zmluvy nám bolo doručené. Nemusíte robiť nič ďalšie.',
    statement: 'Odstupujem od zmluvy o dodaní digitálneho obsahu: Verdict, celý report.',
    labels: { statement: 'Vaše oznámenie', name: 'Meno', email: 'E-mail', order: 'Číslo objednávky', at: 'Doručené' },
    none: 'neuvedené',
    refund: 'Celých 14 € vrátime na tú istú kartu, bez nákladov pre vás, do 14 dní od doručenia tohto oznámenia. Nič nám nemusíte vracať.',
    help: 'Otázky: odpovedzte na tento e-mail alebo napíšte na info@virtuse.com.',
    bad: { name: 'Zadajte, prosím, svoje meno.', email: 'Zadajte, prosím, platnú e-mailovú adresu.' },
    limit: 'Príliš veľa pokusov. Napíšte, prosím, na info@virtuse.com; odstúpenie platí od chvíle, keď ho pošlete.',
    fail: 'Nepodarilo sa to odoslať. Napíšte, prosím, na info@virtuse.com; odstúpenie platí od chvíle, keď ho pošlete.',
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function renderWithdrawal({ lang, name, email, order, at }) {
  const t = T[lang];
  const L = t.labels;
  const when = formatTimestamp(at, lang);
  const rows = [[L.statement, t.statement], [L.name, name], [L.email, email], [L.order, order || t.none], [L.at, when]];
  const row = ([k, v]) => `<tr><td style="padding:8px 12px 8px 0;color:#5f6670;font-size:14px;width:38%;border-bottom:1px solid #eceef1;vertical-align:top;">${esc(k)}</td><td style="padding:8px 0;color:#121417;font-size:14px;border-bottom:1px solid #eceef1;">${esc(v)}</td></tr>`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"></head><body style="margin:0;padding:24px 12px;background:#f4f5f7;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;"><tr><td style="padding:28px 32px;">
<h1 style="margin:0 0 12px 0;font-size:22px;line-height:30px;color:#121417;">${esc(t.h)}</h1>
<p style="margin:0 0 18px 0;font-size:15px;line-height:24px;color:#2b2f36;">${esc(t.lead)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.map(row).join('')}</table>
<p style="margin:18px 0 0 0;font-size:14px;line-height:22px;color:#2b2f36;">${esc(t.refund)}</p>
<p style="margin:12px 0 0 0;font-size:14px;line-height:22px;color:#2b2f36;">${esc(t.help)}</p>
<p style="margin:18px 0 0 0;font-size:11px;line-height:18px;color:#8b949e;">Virtuse Wealth Management, a.s., Borinka 65, 900 32 Borinka, IČO 36 709 042</p>
</td></tr></table></body></html>`;
  return { subject: t.subject, html, when };
}

export async function handleWithdraw(ctx) {
  const { request, env, origin, services } = ctx;
  const now = ctx.now ?? Date.now();
  const parsed = await readJson(request);
  if (!parsed.ok) return json(400, { error: 'Invalid JSON body' }, origin);
  const body = parsed.value || {};
  const lang = body.lang === 'sk' ? 'sk' : 'en';
  const t = T[lang];
  if (body.hp) return json(200, { ok: true }, origin);
  const name = clean(body.name, 120);
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
  const order = clean(body.order, 60);
  if (name.length < 2) return json(400, { error: t.bad.name, field: 'name' }, origin);
  if (!EMAIL_RE.test(email)) return json(400, { error: t.bad.email, field: 'email' }, origin);
  const day = new Date(now).toISOString().slice(0, 10);
  if (await services.limiter.exceeded(`verdict:withdraw:${await ipHash(clientIp(request), day, env)}`, WITHDRAW_PER_HOUR, WINDOW_S)) {
    return json(429, { error: t.limit, code: 'rate_limited' }, origin);
  }
  const mail = renderWithdrawal({ lang, name, email, order, at: now });
  const from = env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL;
  // Virtuse first: without this copy nobody refunds. Staging sends both to the test inbox.
  try {
    await services.resend.sendEmail({
      from, to: [env.VERDICT_RECEIPT_TO || INBOX], reply_to: email,
      subject: `Odstúpenie od zmluvy: Verdict${order ? ` · ${order}` : ''}`, html: mail.html,
      tags: [{ name: 'kind', value: 'verdict_withdrawal_inbox' }],
    }, 'Resend withdrawal inbox failed');
  } catch (e) {
    console.error('verdict withdraw: inbox', e?.message);
    return json(502, { error: t.fail }, origin);
  }
  let confirmed = true;
  try {
    await services.resend.sendEmail({
      from, to: [env.VERDICT_RECEIPT_TO || email], reply_to: env.RESEND_REPLY_TO || INBOX,
      subject: mail.subject, html: mail.html,
      tags: [{ name: 'kind', value: 'verdict_withdrawal' }],
    }, 'Resend withdrawal confirmation failed');
  } catch (e) {
    confirmed = false;
    console.error('verdict withdraw: confirmation', e?.message);
  }
  return json(200, { ok: true, at: mail.when, confirmed }, origin);
}
