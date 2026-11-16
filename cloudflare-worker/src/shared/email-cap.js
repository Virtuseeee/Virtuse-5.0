// A ceiling on the emails the public forms may trigger in one clock hour, for
// all visitors together (security audit 2026-11-16, B1). The per-IP limits
// stop one address; this stops many addresses at once, so a flood of forged
// sign-ups cannot turn the Worker into a bulk sender on virtuse.com's name.
//
// One counter per bucket and hour in RATE_LIMIT_KV ("emailcap:<bucket>:<hour>"),
// no personal data. The first refusal in an hour sends one internal note.
// Like every KV counter here it is a soft limit (see rate-limiter.js).

const HOUR_S = 60 * 60;

function capFrom(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 && n <= 100000 ? n : fallback;
}

// buckets: { forms: 120, ... } = the default per hour; env EMAIL_CAP_<BUCKET>_PER_HOUR overrides it.
export function createEmailCap({ env, limiter, resend, buckets }) {
  const alertTo = env.FORM_ALERT_TO || env.VERDICT_ALERT_TO || env.VERDICT_RECEIPT_TO || 'info@virtuse.com';
  const from = env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL;
  return {
    // Counts one email against `bucket`. True when this hour's budget is already used up.
    async exceeded(bucket, now = Date.now()) {
      const max = capFrom(env[`EMAIL_CAP_${bucket.toUpperCase()}_PER_HOUR`], buckets[bucket]);
      const hour = new Date(now).toISOString().slice(0, 13);
      if (!(await limiter.exceeded(`emailcap:${bucket}:${hour}`, max, HOUR_S))) return false;
      try {
        if (from && (await limiter.claimOnce(`emailcap:alert:${bucket}:${hour}`, HOUR_S))) {
          await resend.sendEmail({
            from, to: [alertTo],
            subject: `Virtuse forms: hourly email limit reached (${bucket})`,
            html: `<div style="font:14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#111"><p><b>The public forms reached their hourly email limit.</b></p><p>Bucket: ${bucket} · limit: ${max} per hour · hour (UTC): ${hour}:00</p><p>Further requests in this hour are refused with "try again later". If this is real demand, raise EMAIL_CAP_${bucket.toUpperCase()}_PER_HOUR on the Worker; if not, somebody is flooding the forms.</p><p style="color:#666">Internal message from the Virtuse Worker.</p></div>`,
            tags: [{ name: 'kind', value: 'form_cap_alert' }],
          }, 'Resend form cap alert failed', { idempotencyKey: `form-cap-${bucket}-${hour}` });
        }
      } catch (e) {
        console.error(e);
      }
      return true;
    },

    // Gives one counted email back, e.g. when Resend refused the address and nothing was sent.
    async refund(bucket, now = Date.now()) {
      await limiter.refund(`emailcap:${bucket}:${new Date(now).toISOString().slice(0, 13)}`, HOUR_S);
    },
  };
}
