// GET  /unsubscribe?email=...&token=...[&list=cfo]  a page with one button (nothing happens yet)
// POST /unsubscribe  the button (form fields email, token, list) or a mail client's RFC 8058
//                    one-click request (body "List-Unsubscribe=One-Click", fields in the URL)
//
// Top-level navigations from an email client: no Origin, no CORS. The HMAC token is what
// proves the request (see unsubscribe-link.js). The GET only shows a button since 2026-11-23
// (Brief audit 2026-11-12): mail scanners open every link and used to unsubscribe readers.
// &list=cfo is the link in the CFO waitlist confirmation: it leaves only the waitlist and
// keeps any Brief subscription.

import { EMAIL_RE } from '../../config.js';
import { html } from '../../http/responses.js';
import { leaveWaitlist } from '../waitlist/handler.js';
import { verifyUnsubscribeToken } from './unsubscribe-link.js';
import { UNSUBSCRIBE_MESSAGES as M, unsubscribeButtonPage, unsubscribePage } from './unsubscribe-page.js';

const page = (status, message) => html(status, unsubscribePage(message));

async function fields(request, url, method) {
  const q = (k) => url.searchParams.get(k) || '';
  if (method !== 'POST') return { email: q('email'), token: q('token'), list: q('list') };
  let form = null;
  try { form = await request.formData(); } catch { form = null; }
  const f = (k) => (form && form.get(k) ? String(form.get(k)) : q(k));
  return { email: f('email'), token: f('token'), list: f('list') };
}

export async function handleUnsubscribe({ request, env, url, method, services }) {
  const { email, token, list } = await fields(request, url, method);

  if (!email || !token || !EMAIL_RE.test(email)) return page(400, M.incomplete);
  if (!(await verifyUnsubscribeToken(env.UNSUB_SECRET, email, token))) return page(400, M.invalid);

  const waitlistOnly = list === 'cfo';
  if (method !== 'POST') return html(200, unsubscribeButtonPage({ email, token, list: waitlistOnly ? 'cfo' : '' }));
  try {
    if (waitlistOnly) await leaveWaitlist(env, services.resend, email);
    else await services.brief.leave(email);
  } catch (e) {
    console.error(e);
    return page(502, M.failed);
  }
  return page(200, waitlistOnly ? M.leftWaitlist : M.leftBrief);
}
