// The month's AI spend (EUR, counted from token usage), kept in RATE_LIMIT_KV
// so VERDICT_MONTHLY_CAP_EUR can stop new verdicts once it is reached.

const SPEND_TTL_SECONDS = 60 * 60 * 24 * 40;
// Booked before the model is called and replaced by the real cost afterwards, so requests
// that arrive together each see the others' share of the month's budget (audit B14).
export const SPEND_RESERVE_EUR = 0.1;

export function monthKey(now, prefix = 'verdict:spend:') {
  return prefix + new Date(now).toISOString().slice(0, 7);
}

export function createSpendLedger(kv, now, prefix) {
  const key = monthKey(now, prefix);
  return {
    async spent() {
      return parseFloat((await kv.get(key)) || '0');
    },
    async record(total) {
      await kv.put(key, String(total), { expirationTtl: SPEND_TTL_SECONDS });
    },
    // Adds delta to what is stored now (re-read, so a request that finished meanwhile is kept).
    async add(delta) {
      const total = Math.max(0, parseFloat((await kv.get(key)) || '0') + delta);
      await kv.put(key, String(Math.round(total * 1e6) / 1e6), { expirationTtl: SPEND_TTL_SECONDS });
    },
  };
}
