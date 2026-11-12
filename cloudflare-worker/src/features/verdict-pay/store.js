// KV records of the paid Verdict report (RATE_LIMIT_KV, like the other verdict:* keys):
//   verdict:res:<rid>    { result, profile, lang }    24 h; the scored result, never the decision text
//                        { lite: true, answers, lang } 24 h; Verdict Lite: the validated answers, no email
//   verdict:paid:<cs_id> { rid, status, usedAt, ... } 30 days
//   verdict:pi:<pi_id>   cs_id                        30 days, for charge.refunded
//   verdict:used:<cs_id>, verdict:mail:<cs_id>, verdict:refund:<pi_id>   30 days
//                        write-once markers (first opening, email sent, refunded). KV is not
//                        atomic: the webhook and the browser can both rewrite the order record
//                        at the same second and one would drop the other's field. A marker is
//                        only ever added, and getPaid() folds the markers into the record.
//                        The refund marker is keyed by payment, so a refund that arrives
//                        before checkout.session.completed is not lost.

import { PAID_TTL, PI_TTL, RESULT_TTL, paidRecord } from './domain.js';

export function newRid() {
  return crypto.randomUUID().replace(/-/g, '');
}

export function createPayStore(kv) {
  const getJson = async (key) => {
    const raw = await kv.get(key);
    return raw ? JSON.parse(raw) : null;
  };
  const putPaid = (sid, rec) => kv.put(`verdict:paid:${sid}`, JSON.stringify(rec), { expirationTtl: PAID_TTL });
  const mark = (key, now) => kv.put(key, String(now), { expirationTtl: PAID_TTL });
  // The order record with the markers folded in.
  async function withMarkers(sid, rec) {
    if (!rec) return rec;
    const [used, mailed, refund] = await Promise.all([
      kv.get(`verdict:used:${sid}`), kv.get(`verdict:mail:${sid}`), rec.pi ? kv.get(`verdict:refund:${rec.pi}`) : null,
    ]);
    if (used && !rec.usedAt) rec.usedAt = Number(used);
    if (mailed && !rec.emailedAt) rec.emailedAt = Number(mailed);
    if (refund) {
      rec.status = 'refunded';
      const r = JSON.parse(refund);
      if (r && r.amount != null) rec.amountRefunded = r.amount;
    }
    return rec;
  }
  return {
    storeResult: (rid, result, profile, lang) =>
      kv.put(`verdict:res:${rid}`, JSON.stringify({ result, profile, lang }), { expirationTtl: RESULT_TTL }),
    storeLite: (rid, answers, lang) =>
      kv.put(`verdict:res:${rid}`, JSON.stringify({ lite: true, answers, lang }), { expirationTtl: RESULT_TTL }),
    getResult: (rid) => getJson(`verdict:res:${rid}`),
    hasResult: async (rid) => !!(await kv.get(`verdict:res:${rid}`)),
    getPaid: async (sid) => withMarkers(sid, await getJson(`verdict:paid:${sid}`)),
    markUsed: async (sid, now) => { if (!(await kv.get(`verdict:used:${sid}`))) await mark(`verdict:used:${sid}`, now); },
    markEmailed: (sid, now) => mark(`verdict:mail:${sid}`, now),
    markRefunded: (pi, amount, full) => (full ? kv.put(`verdict:refund:${pi}`, JSON.stringify({ amount }), { expirationTtl: PAID_TTL }) : undefined),
    putPaid,
    sessionForPayment: (pi) => kv.get(`verdict:pi:${pi}`),
    // A paid Checkout Session -> KV, plus the payment_intent -> session link.
    async markPaid(s, now) {
      const rec = paidRecord(s, await withMarkers(s.id, await getJson(`verdict:paid:${s.id}`)), now);
      await putPaid(s.id, rec);
      if (rec.pi) await kv.put(`verdict:pi:${rec.pi}`, s.id, { expirationTtl: PI_TTL });
      return withMarkers(s.id, rec);
    },
  };
}
