// KV records of the paid Verdict report (RATE_LIMIT_KV, like the other verdict:* keys):
//   verdict:res:<rid>    { result, profile, lang }    24 h; the scored result, never the decision text
//   verdict:paid:<cs_id> { rid, status, usedAt, ... } 30 days
//   verdict:pi:<pi_id>   cs_id                        90 days, for charge.refunded

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
  return {
    storeResult: (rid, result, profile, lang) =>
      kv.put(`verdict:res:${rid}`, JSON.stringify({ result, profile, lang }), { expirationTtl: RESULT_TTL }),
    getResult: (rid) => getJson(`verdict:res:${rid}`),
    hasResult: async (rid) => !!(await kv.get(`verdict:res:${rid}`)),
    getPaid: (sid) => getJson(`verdict:paid:${sid}`),
    putPaid,
    sessionForPayment: (pi) => kv.get(`verdict:pi:${pi}`),
    // A paid Checkout Session -> KV, plus the payment_intent -> session link.
    async markPaid(s, now) {
      const rec = paidRecord(s, await getJson(`verdict:paid:${s.id}`), now);
      await putPaid(s.id, rec);
      if (rec.pi) await kv.put(`verdict:pi:${rec.pi}`, s.id, { expirationTtl: PI_TTL });
      return rec;
    },
  };
}
