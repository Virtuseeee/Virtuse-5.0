/**
 * Fee math copied from the live stacking module (unaltered):
 * costPerPurchase = contribution * pct + fixed + monthly / (periodsPerYear / 12)
 * annualDrag = costPerPurchase * periodsPerYear
 */
export function routeCost(row, contribution, periodsPerYear = 12) {
  const monthly = row.monthly ?? 0;
  const perPurchaseMonthly = monthly > 0 ? monthly / (periodsPerYear / 12) : 0;
  const costPerPurchase = contribution * row.pct + (row.fixed || 0) + perPurchaseMonthly;
  const effectivePct = contribution > 0 ? costPerPurchase / contribution : 0;
  const annualDrag = costPerPurchase * periodsPerYear;
  return { ...row, costPerPurchase, effectivePct, annualDrag, contribution, periodsPerYear };
}

export function rankRoutes(rows, contribution, periodsPerYear = 12) {
  return rows
    .map((row) => routeCost(row, contribution, periodsPerYear))
    .sort((a, b) => a.annualDrag - b.annualDrag || a.partner.localeCompare(b.partner));
}

export function cheapest(rows, contribution, periodsPerYear = 12) {
  return rankRoutes(rows, contribution, periodsPerYear)[0];
}

function isAutomated(row) {
  if (row.kind) return row.kind === 'automated';
  const blob = `${row.partner} ${row.method}`.toLowerCase();
  return /bot|auto|dca/.test(blob);
}

/**
 * Smallest monthly contribution (EUR) at which the cheapest automated route's
 * annual drag is <= the cheapest manual route. Returns null if automated
 * already wins at €1, or null-with-reason if it never wins in the scan.
 */
export function breakEvenBotsVsManual(rows, periodsPerYear = 12) {
  const automated = rows.filter(isAutomated);
  const manual = rows.filter((r) => !isAutomated(r));
  if (!automated.length || !manual.length) {
    return { status: 'n/a', reason: 'Need both automated and manual rows in the fee schedule.' };
  }
  const at = (amount) => {
    const a = rankRoutes(automated, amount, periodsPerYear)[0];
    const m = rankRoutes(manual, amount, periodsPerYear)[0];
    return { auto: a, manual: m, autoWins: a.annualDrag <= m.annualDrag };
  };
  const one = at(1);
  if (one.autoWins) {
    return {
      status: 'always',
      monthlyEur: 1,
      auto: one.auto,
      manual: one.manual,
      note: 'The cheapest automated route has lower (or equal) annual fee drag than the cheapest manual route at every tested monthly amount from €1.'
    };
  }
  for (let amount = 1; amount <= 20000; amount += 1) {
    const snap = at(amount);
    if (snap.autoWins) {
      return {
        status: 'found',
        monthlyEur: amount,
        auto: snap.auto,
        manual: snap.manual,
        note: `Automated ${snap.auto.partner} annual drag meets or beats ${snap.manual.partner} from €${amount}/month.`
      };
    }
  }
  return {
    status: 'never',
    monthlyEur: null,
    auto: at(100).auto,
    manual: at(100).manual,
    note: 'Within €1–€20,000 monthly, the cheapest automated row does not beat the cheapest manual row on annual fee drag.'
  };
}

export const DEFAULT_CONTRIBUTIONS = [50, 100, 250, 500, 1000];
