// ─────────────────────────────────────────────────────────────
// Stacking Strategist – DCA projection + partner fee arbitrage
// Virtuse Layer 2 (Module: Stacking)
//
// Every row in FEE_SCHEDULE is a real partner already featured on
// virtuse.com, linked via its real, currently-live affiliate/referral URL
// (same rule as concierge.ts's PARTNERS catalog). pct/fixed must match
// seo-build/data/fee-schedule-live.json (scripts/check-fees.mjs).
//
// Trilingual (en/sk/cs): display strings are {en, sk, cs} triples or
// go through t(lang, en, sk, cs). Math (projection, fee comparison,
// route ranking) is unchanged from the English-only version.
// ─────────────────────────────────────────────────────────────

import { t, tv, fmtEur, fmtEurCompact, fmtNum, fmtNumShort, pct } from './i18n';
import type { Lang, LocalizedText } from './i18n';
export type { Lang, LocalizedText };

export type FrequencyId = 'weekly' | 'monthly';

export const FREQUENCIES: { id: FrequencyId; label: LocalizedText; periodsPerYear: number }[] = [
  { id: 'weekly', label: { en: 'Weekly', sk: 'Týždenne', cs: 'Týdně' }, periodsPerYear: 52 },
  { id: 'monthly', label: { en: 'Monthly', sk: 'Mesačne', cs: 'Měsíčně' }, periodsPerYear: 12 },
];

// Scenarios, not forecasts (Ras, 12 Oct 2026): 10 / 20 / 25 % a year, the
// highest one shown as hypothetical.
export type ScenarioId = 'conservative' | 'moderate' | 'optimistic';
export const RETURN_PRESETS: { id: ScenarioId; label: LocalizedText; annual: number; hypothetical?: boolean }[] = [
  { id: 'conservative', label: { en: 'Conservative', sk: 'Konzervatívny', cs: 'Konzervativní' }, annual: 0.1 },
  { id: 'moderate', label: { en: 'Moderate', sk: 'Mierny', cs: 'Mírný' }, annual: 0.2 },
  { id: 'optimistic', label: { en: 'Optimistic', sk: 'Optimistický', cs: 'Optimistický' }, annual: 0.25, hypothetical: true },
];

// ── Input limits (Ras, 12 Oct 2026) ─────────────────────────
// Sliders move over a stepped value list (finer steps for small amounts);
// the typed field next to each label accepts any value inside the limits.
export const INITIAL_LIMITS = { min: 0, max: 1_000_000 };
export const CONTRIBUTION_LIMITS: Record<FrequencyId, { min: number; max: number }> = {
  monthly: { min: 10, max: 100_000 },
  weekly: { min: 10, max: 25_000 },
};
export const YEARS_LIMITS = { min: 1, max: 25 };

function stepScale(segments: [number, number, number][]): number[] {
  const out: number[] = [];
  for (const [from, to, step] of segments) {
    for (let v = from; v <= to; v += step) if (out[out.length - 1] !== v) out.push(v);
  }
  return out;
}
export const INITIAL_SCALE = stepScale([[0, 10_000, 500], [10_000, 100_000, 5_000], [100_000, 1_000_000, 50_000]]);
export const CONTRIBUTION_SCALE: Record<FrequencyId, number[]> = {
  monthly: stepScale([[10, 1_000, 10], [1_000, 10_000, 100], [10_000, 100_000, 1_000]]),
  weekly: stepScale([[10, 1_000, 10], [1_000, 10_000, 100], [10_000, 25_000, 1_000]]),
};

// Slider position for a value: the nearest step (exact for values on the scale).
export function scaleIndex(scale: number[], v: number): number {
  let best = 0;
  for (let i = 1; i < scale.length; i++) if (Math.abs(scale[i] - v) < Math.abs(scale[best] - v)) best = i;
  return best;
}

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

// Typed amounts: "250000", "250 000", "250.000", "250,000", "250k", "1m", "1M",
// "1,5k", "€ 2.000". Returns a whole number of euros, or null if unreadable.
export function parseAmount(raw: string): number | null {
  let s = String(raw).toLowerCase().replace(/eur|€|[\s\u00a0\u202f']/g, '');
  let mult = 1;
  const suffix = s.match(/^(.*?)(k|m)$/);
  if (suffix) {
    s = suffix[1];
    mult = suffix[2] === 'k' ? 1e3 : 1e6;
  }
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const dot = s.lastIndexOf('.');
  const comma = s.lastIndexOf(',');
  let norm = s;
  if (dot >= 0 && comma >= 0) {
    const dec = dot > comma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    const parts = s.split(thou).join('').split(dec);
    if (parts.length !== 2) return null;
    norm = parts.join('.');
  } else if (dot >= 0 || comma >= 0) {
    const parts = s.split(dot >= 0 ? '.' : ',');
    const groups = parts.slice(1);
    const thousands = groups.every((g) => g.length === 3) && (parts.length > 2 || mult === 1);
    if (thousands) norm = parts.join('');
    else if (parts.length === 2) norm = parts.join('.');
    else return null;
  }
  const n = parseFloat(norm) * mult;
  return Number.isFinite(n) ? Math.round(n) : null;
}

export interface ProjectionPoint {
  period: number;
  label: string;
  invested: number;
  value: number;
}

export interface ProjectOptions {
  initial: number;
  contribution: number;
  periodsPerYear: number;
  years: number;
  annualReturn: number;
}

export function project(o: ProjectOptions, lang: Lang = 'en'): ProjectionPoint[] {
  const n = Math.round(o.years * o.periodsPerYear);
  const r = Math.pow(1 + o.annualReturn, 1 / o.periodsPerYear) - 1;
  const points: ProjectionPoint[] = [];
  let value = o.initial;
  let invested = o.initial;
  points.push({ period: 0, label: t(lang, 'now', 'teraz', 'teď'), invested, value });
  for (let p = 1; p <= n; p++) {
    value = value * (1 + r) + o.contribution;
    invested += o.contribution;
    if (p % Math.max(1, Math.round(o.periodsPerYear / 4)) === 0 || p === n) {
      points.push({
        period: p,
        label: `${fmtNumShort(p / o.periodsPerYear, 1, lang)}${t(lang, 'y', 'r', 'r')}`,
        invested: Math.round(invested),
        value: Math.round(value),
      });
    }
  }
  return points;
}

// ── Fee arbitrage ────────────────────────────────────────────

export interface FeeSchedule {
  id: string;
  partner: string; // display name
  pct: number; // percentage fee per purchase
  fixed: number; // fixed fee per purchase (EUR)
  note: LocalizedText;
  source: string; // the partner's own fee page
  url: string;
}

// Fee pages checked on this date (shown next to each row's "Source" link).
export const FEES_CHECKED: LocalizedText = { en: 'checked 12 Oct 2026', sk: 'overené 12. 10. 2026', cs: 'ověřeno 12. 10. 2026' };

// Q4 2026 (checked 2026-10-12): Bybit EU spot 0.25 %, Kraken Pro tier-1 taker 0.8 %.
export const FEE_SCHEDULE: FeeSchedule[] = [
  {
    id: '21bitcoin',
    partner: '21bitcoin',
    pct: 0,
    fixed: 0,
    note: {
      en: 'Auto-Invest plan: 0% fees from day 8 (0.99%, or 0.79% with a referral code, for the first 7 days)',
      sk: 'Plán Auto-Invest: 0 % poplatky od 8. dňa (prvých 7 dní 0,99 %, s kódom odporúčania 0,79 %)',
      cs: 'Plán Auto-Invest: 0 % poplatky od 8. dne (prvních 7 dní 0,99 %, s doporučujícím kódem 0,79 %)',
    },
    source: 'https://21bitcoin.app/en/fees',
    url: 'https://21bitcoin.app.link/invite/?code=VIRTUSE',
  },
  {
    id: 'bybit-eu',
    partner: 'Bybit EU',
    pct: 0.0025,
    fixed: 0,
    note: {
      en: 'Spot: 0.25% fee',
      sk: 'Spot: poplatok 0,25 %',
      cs: 'Spot: poplatek 0,25 %',
    },
    source: 'https://www.bybit.eu/en-EU/help-center/article/Trading-Fee-Structure',
    url: 'https://partner.bybit.eu/b/VIRTUSE',
  },
  {
    id: 'kraken',
    partner: 'Kraken Pro',
    pct: 0.008,
    fixed: 0,
    note: {
      en: 'Kraken Pro (spot taker, Tier 1): 0.8%',
      sk: 'Kraken Pro (spot taker, úroveň 1): 0,8 %',
      cs: 'Kraken Pro (spot taker, úroveň 1): 0,8 %',
    },
    source: 'https://www.kraken.com/features/fee-schedule',
    url: 'https://proinvite.kraken.com/9f1e/lj72d37e',
  },
];

export interface FeeComparison extends FeeSchedule {
  costPerPurchase: number;
  effectivePct: number;
  annualDrag: number;
  netPer1000: number; // euros that actually buy Bitcoin per €1,000, after the route's fee
}

export function compareFees(contribution: number, periodsPerYear: number): FeeComparison[] {
  const c = Number.isFinite(contribution) && contribution > 0 ? contribution : 0;
  return FEE_SCHEDULE.map((f) => {
    const costPerPurchase = c * f.pct + f.fixed;
    const effectivePct = c > 0 ? costPerPurchase / c : f.pct;
    const annualDrag = costPerPurchase * periodsPerYear;
    const netPer1000 = 1000 * (1 - effectivePct);
    return { ...f, costPerPurchase, effectivePct, annualDrag, netPer1000 };
  }).sort((a, b) => b.netPer1000 - a.netPer1000);
}

export interface RouteAdvice {
  winner: FeeComparison;
  reasons: string[];
}

export function bestRoute(contribution: number, periodsPerYear: number, lang: Lang = 'en'): RouteAdvice {
  const all = compareFees(contribution, periodsPerYear);
  const [winner] = all;
  const reasons: string[] = [];

  if (winner.id === '21bitcoin') {
    reasons.push(
      tv(lang,
        `0% fees on 21bitcoin's Auto-Invest plan from day 8, so all of your {0} per purchase goes into Bitcoin.`,
        `0 % poplatky v pláne Auto-Invest od 21bitcoin počnúc 8. dňom, takže celých {0} z každého nákupu ide do Bitcoinu.`,
        `0 % poplatky v plánu Auto-Invest od 21bitcoin počínaje 8. dnem, takže celých {0} z každého nákupu jde do Bitcoinu.`,
        [eur(contribution)]),
      t(lang,
        'Once you set the schedule, the plan buys on its own.',
        'Keď nastavíte harmonogram, plán nakupuje sám.',
        'Jakmile nastavíte harmonogram, plán nakupuje sám.'),
    );
  } else {
    reasons.push(
      tv(lang,
        `Lowest fee at this amount: {0} per purchase via {1}.`,
        `Najnižší poplatok pri tejto sume: {0} za nákup cez {1}.`,
        `Nejnižší poplatek při této částce: {0} za nákup přes {1}.`,
        [pct(fmtNum(winner.effectivePct * 100, 2, lang), lang), winner.partner]),
      t(lang,
        'One manual purchase per period. A calendar reminder helps you keep the rhythm.',
        'Jeden manuálny nákup za obdobie. Pripomienka v kalendári vám pomôže udržať rytmus.',
        'Jeden manuální nákup za období. Připomínka v kalendáři vám pomůže udržet rytmus.'),
    );
  }

  return { winner, reasons };
}

export function eur(n: number): string {
  return fmtEur(n);
}

export function eurCompact(n: number): string {
  return fmtEurCompact(n);
}
