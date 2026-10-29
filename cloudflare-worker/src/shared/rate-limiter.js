// Fixed-window counters in a KV namespace (RATE_LIMIT_KV). KV is eventually
// consistent, so these are soft limits that stop abuse, not exact quotas.
//
// Every limit in the Worker goes through here, so the read-check-write
// sequence (and its KV cost: one get, at most one put) is the same
// everywhere.

export function createKvLimiter(kv) {
  return {
    // Counts one attempt under `key`. Returns true when the window already
    // holds `max` attempts; that attempt is then not counted.
    async exceeded(key, max, windowSeconds) {
      const current = parseInt((await kv.get(key)) || '0', 10);
      if (current >= max) return true;
      await kv.put(key, String(current + 1), { expirationTtl: windowSeconds });
      return false;
    },

    // True the first time `key` is claimed in the window, false while that
    // claim is still alive.
    async claimOnce(key, windowSeconds) {
      if (await kv.get(key)) return false;
      await kv.put(key, '1', { expirationTtl: windowSeconds });
      return true;
    },
  };
}
