// How many verdicts one visitor may request per UTC day.

const PER_IP_PER_DAY = 10;
// "Rate my verdict again" after adding to the plan (P0.3, Ras 2026-10-27)
// has its own counter, so fixing gaps does not use up new verdicts. The
// monthly cost cap still covers both.
export const PER_IP_RECALC_PER_DAY = 20;
// A higher limit for new verdicts on one UTC day only, for testing on
// staging (VERDICT_PER_IP_BOOST = "50:2026-10-27"). It ends by itself when the
// date passes; production does not set it.
export function perIpPerDay(env, day) {
  const m = /^(\d{1,3}):(\d{4}-\d{2}-\d{2})$/.exec(env.VERDICT_PER_IP_BOOST || '');
  return m && m[2] === day ? Math.max(PER_IP_PER_DAY, +m[1]) : PER_IP_PER_DAY;
}
