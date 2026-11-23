// GET  /confirm?t=<token>  the page behind the confirmation link: one button, nothing happens yet.
// POST /confirm  (form field t)  the click: joins the Brief, sends the welcome email, stores consent.
//
// Both are top-level navigations from an email client (no Origin, no CORS); the signed token
// is the proof (optin.js). Splitting GET and POST keeps link scanners, which open every URL
// in an email, from confirming an address on their own.

import { clientIp } from '../../http/request.js';
import { html } from '../../http/responses.js';
import { OPTIN_TEXT, confirmPage, finishOptin, readConfirmToken } from './optin.js';

const page = (lang, opts) => {
  const p = confirmPage(lang, opts);
  return html(p.status, p.body);
};

export async function handleConfirm({ request, env, url, method, now, services }) {
  let token = '';
  if (method === 'POST') {
    try { token = String((await request.formData()).get('t') || ''); } catch { token = ''; }
  } else {
    token = url.searchParams.get('t') || '';
  }
  const data = await readConfirmToken(env.UNSUB_SECRET, token, now);
  if (!data) return page('en', { message: OPTIN_TEXT.en.bad, status: 400 });
  if (method !== 'POST') return page(data.lang, { token });
  try {
    await finishOptin({ env, services, data, ip: clientIp(request), now });
  } catch (e) {
    console.error(e);
    return page(data.lang, { message: OPTIN_TEXT[data.lang].failed, status: 502 });
  }
  return page(data.lang, { done: true });
}
