// The month's AI spend (EUR, counted from token usage), kept in RATE_LIMIT_KV
// so VERDICT_MONTHLY_CAP_EUR can stop new verdicts once it is reached.

const SPEND_TTL_SECONDS = 60 * 60 * 24 * 40;

export function monthKey(now) {
  return 'verdict:spend:' + new Date(now).toISOString().slice(0, 7);
}

export function createSpendLedger(kv, now) {
  const key = monthKey(now);
  return {
    async spent() {
      return parseFloat((await kv.get(key)) || '0');
    },
    async record(total) {
      await kv.put(key, String(total), { expirationTtl: SPEND_TTL_SECONDS });
    },
  };
}
