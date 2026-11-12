// Fixed-window counters in a KV namespace (RATE_LIMIT_KV). KV is eventually
// consistent, so these are soft limits that stop abuse, not exact quotas.
//
// Every limit in the Worker goes through here, so the read-check-write
// sequence (and its KV cost: one get, at most one put) is the same
// everywhere.

// A counter is stored as "<count>:<window end, ms>". The window ends a fixed time
// after its first attempt; later attempts do not move it. (Values written before
// 2026-11-12 are a bare count: read as the start of a new window.)
function read(raw, now) {
  if (!raw) return { n: 0, reset: 0 };
  const [n, r] = String(raw).split(':');
  const reset = Number(r) || 0;
  if (reset && reset <= now) return { n: 0, reset: 0 };
  return { n: parseInt(n, 10) || 0, reset };
}

export function createKvLimiter(kv, clock = () => Date.now()) {
  const write = (key, n, reset, now) =>
    kv.put(key, `${n}:${reset}`, { expirationTtl: Math.max(60, Math.ceil((reset - now) / 1000)) });
  return {
    // Counts one attempt under `key`. Returns true when the window already
    // holds `max` attempts; that attempt is then not counted.
    async exceeded(key, max, windowSeconds) {
      const now = clock();
      const cur = read(await kv.get(key), now);
      if (cur.n >= max) return true;
      await write(key, cur.n + 1, cur.reset || now + windowSeconds * 1000, now);
      return false;
    },

    // Gives back one attempt counted by exceeded(), e.g. when the request
    // turned out to be the visitor's mistake (an address Resend refuses).
    async refund(key, windowSeconds) {
      const now = clock();
      const cur = read(await kv.get(key), now);
      if (cur.n > 0) await write(key, cur.n - 1, cur.reset || now + windowSeconds * 1000, now);
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
