// GET /unsubscribe?email=...&token=...[&list=cfo]
//
// A top-level navigation from an email client: no Origin, no CORS. The HMAC
// token is what proves the request (see unsubscribe-link.js). &list=cfo is
// the link in the CFO waitlist confirmation: it leaves only the waitlist and
// keeps any Brief subscription.

import { EMAIL_RE } from '../../config.js';
import { html } from '../../http/responses.js';
import { leaveWaitlist } from '../waitlist/handler.js';
import { verifyUnsubscribeToken } from './unsubscribe-link.js';
import { UNSUBSCRIBE_MESSAGES as M, unsubscribePage } from './unsubscribe-page.js';

const page = (status, message) => html(status, unsubscribePage(message));

export async function handleUnsubscribe({ env, url, services }) {
  const email = url.searchParams.get('email') || '';
  const token = url.searchParams.get('token') || '';

  if (!email || !token || !EMAIL_RE.test(email)) return page(400, M.incomplete);
  if (!(await verifyUnsubscribeToken(env.UNSUB_SECRET, email, token))) return page(400, M.invalid);

  const waitlistOnly = url.searchParams.get('list') === 'cfo';
  try {
    if (waitlistOnly) await leaveWaitlist(env, services.resend, email);
    else await services.brief.leave(email);
  } catch (e) {
    console.error(e);
    return page(502, M.failed);
  }
  return page(200, waitlistOnly ? M.leftWaitlist : M.leftBrief);
}
