// ─────────────────────────────────────────────────────────────
// Stacking Strategist – DCA projection + partner fee arbitrage
// Virtuse Layer 2 (Module: Stacking)
//
// Every row in FEE_SCHEDULE is a real partner already featured on
// virtuse.com (buy-bitcoin.html / bots.html), linked via its real,
// currently-live affiliate/referral URL — same rule as concierge.ts's
// PARTNERS catalog, and for the same reason (an earlier draft of this
// file invented "Banxa" and "MiCA-licensed CASP" as placeholder names
// with virtuse.com URLs; fixed to route to real partners instead).
// Where a partner publishes a headline per-trade fee rate, pct/fixed
// below matches it; where none is published (RevenueBot's automated
// DCA/grid pricing), the number stays ILLUSTRATIVE — flagged as such
// in that row's own note, and again in the page's own disclaimer –
// production wires a live quote from that partner's API here.
//
// Trilingual (en/sk/cs): display strings are {en, sk, cs} triples or
// go through t(lang, en, sk, cs). Math (projection, fee comparison,
// route ranking) is 100% unchanged from the English-only version – do
// not rework it.
// ─────────────────────────────────────────────────────────────

import { t, tv, fmtEur, fmtEurCompact, fmtNum, fmtNumShort } from './i18n';
import type { Lang, LocalizedText } from './i18n';
export type { Lang, LocalizedText };

export type FrequencyId = 'weekly' | 'monthly';

export const FREQUENCIES: { id: FrequencyId; label: LocalizedText; periodsPerYear: number }[] = [
  { id: 'weekly', label: { en: 'Weekly', sk: 'Týždenne', cs: 'Týdně' }, periodsPerYear: 52 },
  { id: 'monthly', label: { en: 'Monthly', sk: 'Mesačne', cs: 'Měsíčně' }, periodsPerYear: 12 },
];

export const RETURN_PRESETS = [
  { id: 'conservative', label: { en: 'Conservative', sk: 'Konzervatívny', cs: 'Konzervativní' }, annual: 0.1 },
  { id: 'moderate', label: { en: 'Moderate', sk: 'Mierny', cs: 'Mírný' }, annual: 0.2 },
  { id: 'ark', label: { en: 'ARK-style', sk: 'V štýle ARK', cs: 'Ve stylu ARK' }, annual: 0.39 },
];

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
  partner: string;
  method: LocalizedText;
  pct: number; // percentage fee per purchase
  fixed: number; // fixed fee per purchase (EUR)
  note: LocalizedText;
  speed: LocalizedText;
  url: string;
}

// Q4 2026 (checked 2026-10-02): ByBit EU taker 0.25 %, Kraken Pro tier-1 taker
// 0.8 %; RevenueBot (20 % of bot profit, no purchase fee) removed from the
// purchase-cost comparison.
export const FEE_SCHEDULE: FeeSchedule[] = [
  {
    id: '21bitcoin',
    partner: '21bitcoin',
    method: { en: 'Auto-Invest plan', sk: 'Plán Auto-Invest', cs: 'Plán Auto-Invest' },
    pct: 0,
    fixed: 0,
    note: {
      en: '0 % fees on the built-in Auto-Invest savings plan – FMA MiCAR licensed, insured custody, and already automated: set the schedule once and it runs itself.',
      sk: '0 % poplatky vo vstavanom sporiacom pláne Auto-Invest – licencia FMA MiCAR, poistená úschova a už automatizované: nastavíte harmonogram raz a beží samo.',
      cs: '0 % poplatky ve vestavěném spořicím plánu Auto-Invest – licence FMA MiCAR, pojištěná úschova a už automatizované: nastavíte harmonogram jednou a běží samo.',
    },
    speed: { en: 'Automated', sk: 'Automatizované', cs: 'Automatizované' },
    url: 'https://21bitcoin.app.link/invite/?code=VIRTUSE',
  },
  {
    id: 'bybit-eu',
    partner: 'ByBit EU',
    method: { en: 'Spot trading', sk: 'Spotové obchodovanie', cs: 'Spotové obchodování' },
    pct: 0.0025,
    fixed: 0,
    note: {
      en: 'Spot trading fees from 0.25 % – EU-licensed in Vienna, deep order books for a manual recurring buy.',
      sk: 'Poplatky za spotové obchodovanie od 0,25 % – licencovaná v EÚ vo Viedni, hlboké orderbooky pre manuálny pravidelný nákup.',
      cs: 'Poplatky za spotové obchodování od 0,25 % – licencovaná v EU ve Vídni, hluboké orderbooky pro manuální pravidelný nákup.',
    },
    speed: { en: 'Same day', sk: 'V ten istý deň', cs: 'Ve stejný den' },
    url: 'https://partner.bybit.eu/b/VIRTUSE',
  },
  {
    id: 'kraken',
    partner: 'Kraken',
    method: { en: 'Pro trading', sk: 'Pro trading', cs: 'Pro trading' },
    pct: 0.008,
    fixed: 0,
    note: {
      en: 'Pro trading fees from 0.8 % – veteran EU exchange, deep EUR liquidity since 2011.',
      sk: 'Poplatky za Pro trading od 0,8 % – skúsená EÚ burza, hlboká EUR likvidita od roku 2011.',
      cs: 'Poplatky za Pro trading od 0,8 % – zkušená EU burza, hluboká EUR likvidita od roku 2011.',
    },
    speed: { en: 'Same day', sk: 'V ten istý deň', cs: 'Ve stejný den' },
    url: 'https://proinvite.kraken.com/9f1e/lj72d37e',
  },
];

export interface FeeComparison extends FeeSchedule {
  costPerPurchase: number;
  effectivePct: number;
  annualDrag: number;
  btcPer1000: number; // sats received per €1,000 invested
}

export function compareFees(contribution: number, periodsPerYear: number): FeeComparison[] {
  return FEE_SCHEDULE.map((f) => {
    const monthly = (f as FeeSchedule & { monthly?: number }).monthly ?? 0;
    const subPerPurchase = monthly > 0 ? monthly / (periodsPerYear / 12) : 0;
    const costPerPurchase = contribution * f.pct + f.fixed + subPerPurchase;
    const effectivePct = costPerPurchase / contribution;
    const annualDrag = costPerPurchase * periodsPerYear;
    const btcPer1000 = 1000 * (1 - effectivePct);
    return { ...f, costPerPurchase, effectivePct, annualDrag, btcPer1000 };
  }).sort((a, b) => b.btcPer1000 - a.btcPer1000);
}

export interface RouteAdvice {
  winner: FeeComparison;
  runnerUp: FeeComparison;
  reasons: string[];
  breakEven?: string;
}

export function bestRoute(contribution: number, periodsPerYear: number, lang: Lang = 'en'): RouteAdvice {
  const all = compareFees(contribution, periodsPerYear);
  const [winner, runnerUp] = all;
  const reasons: string[] = [];

  if (winner.id === '21bitcoin') {
    reasons.push(
      tv(lang, `0 % fees on 21bitcoin's Auto-Invest plan – every euro of your {0}/period buys Bitcoin, none of it is lost to fees.`, `0 % poplatky v pláne Auto-Invest od 21bitcoin – každé euro z vašich {0}/obdobie kupuje Bitcoin, nič sa nestráca na poplatkoch.`, `0 % poplatky v plánu Auto-Invest od 21bitcoin – každé euro z vašich {0}/období kupuje Bitcoin, nic se neztrácí na poplatcích.`, [eur(contribution)]),
      t(lang,
        'It runs on autopilot too, once you set the schedule – the same "set & forget" benefit a trading bot gives you, without a subscription.',
        'Po nastavení harmonogramu beží tiež na autopilota – rovnaká výhoda „nastav a zabudni" ako pri obchodnom bote, bez predplatného.',
        'Po nastavení harmonogramu běží také na autopilota – stejná výhoda „nastav a zapomeň" jako u obchodního bota, bez předplatného.'),
    );
  } else if (winner.id === 'revenuebot') {
    reasons.push(
      tv(lang, `At {0}/period, RevenueBot's flat monthly fee is diluted enough to beat a manual exchange purchase.`, `Pri sume {0}/obdobie sa fixný mesačný poplatok RevenueBotu dostatočne rozloží a poráža manuálny nákup na burze.`, `Při částce {0}/období se fixní měsíční poplatek RevenueBotu dostatečně rozloží a poráží manuální nákup na burze.`, [eur(contribution)]),
      t(lang,
        'Automation removes timing anxiety and missed purchases – the hidden cost of manual DCA.',
        'Automatizácia odstraňuje stres z časovania a vynechané nákupy – skrytý náklad manuálneho DCA.',
        'Automatizace odstraňuje stres z časování a vynechané nákupy – skrytý náklad manuálního DCA.'),
    );
  } else {
    reasons.push(
      tv(lang, `Lowest cost among the manual-purchase routes at this amount – {0} % per purchase via {1}.`, `Najnižšie náklady spomedzi manuálnych trás pri tejto sume – {0} % za nákup cez {1}.`, `Nejnižší náklady mezi manuálními trasami při této částce – {0} % za nákup přes {1}.`, [fmtNum(winner.effectivePct * 100, 2, lang), winner.partner]),
      t(lang,
        'One manual step per period; pair it with a calendar reminder or a weekly ritual.',
        'Jeden manuálny krok za obdobie; spárujte si to s pripomienkou v kalendári alebo týždenným rituálom.',
        'Jeden manuální krok za období; spárujte si to s připomínkou v kalendáři nebo týdenním rituálem.'),
    );
  }

  // Where automation (RevenueBot) crosses over the cheaper of the two
  // manual-trading routes on pure fees – still informative even when
  // 21bitcoin's 0 % wins outright on price, since not every visitor
  // wants the Auto-Invest app over their own exchange of choice.
  let breakEven: string | undefined;
  const manual = all.find((f) => f.id === 'kraken' || f.id === 'bybit-eu');
  const bot = all.find((f) => f.id === 'revenuebot');
  if (manual && bot && manual.pct > bot.pct) {
    const be = 4 / (manual.pct - bot.pct); // monthly amount where RevenueBot undercuts the manual route on pure fees
    const beAmount = eur(Math.ceil(be / 10) * 10);
    breakEven = tv(lang, `Between the paid routes: RevenueBot's automation undercuts manual {0} trading on pure fees once you stack more than ≈ {1}/month – below that, {0} is cheaper but manual.`, `Medzi platenými trasami: automatizácia RevenueBotu poráža manuálne obchodovanie cez {0} na čistých poplatkoch, keď investujete viac než ≈ {1}/mesiac – pod touto hranicou je {0} lacnejší, ale manuálny.`, `Mezi placenými trasami: automatizace RevenueBotu poráží manuální obchodování přes {0} na čistých poplatcích, jakmile investujete více než ≈ {1}/měsíc – pod touto hranicí je {0} levnější, ale manuální.`, [manual.partner, beAmount]);
  }

  return { winner, runnerUp, reasons, breakEven };
}

export function eur(n: number): string {
  return fmtEur(n);
}

export function eurCompact(n: number): string {
  return fmtEurCompact(n);
}
