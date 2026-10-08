// ─────────────────────────────────────────────────────────────
// Loan & Liquidity Copilot – sell vs. borrow model, LTV risk,
// scenario analysis. Virtuse Layer 2 (Module: Loans)
// Simplified educational model – not financial advice. APR/LTV
// terms are illustrative for the prototype (wire live partner
// quotes in production).
//
// Trilingual (en/sk/cs): display strings are {en, sk, cs} triples or
// go through t(lang, en, sk, cs). The sell-vs-borrow math, liquidation
// price and scenario matrix are 100% unchanged from the English-only
// version — do not rework them.
// ─────────────────────────────────────────────────────────────

import { t, tv, fmtEur, fmtEurCompact, fmtNum } from './i18n';
import type { Lang, LocalizedText } from './i18n';
export type { Lang, LocalizedText };

export const MARGIN_CALL_LTV = 0.7; // illustrative liquidation threshold

export interface TaxPreset {
  id: string;
  name: LocalizedText;
  rate: number; // typical capital-gains rate on crypto gains, decimal
  note?: LocalizedText;
}

export const TAX_PRESETS: TaxPreset[] = [
  { id: 'sk', name: { en: 'Slovakia', sk: 'Slovensko', cs: 'Slovensko' }, rate: 0.35 }, // 19 % income tax + 16 % health contributions (2026)
  { id: 'cz', name: { en: 'Czechia', sk: 'Česko', cs: 'Česko' }, rate: 0.15 },
  { id: 'de', name: { en: 'Germany (<1y held)', sk: 'Nemecko (držba <1 rok)', cs: 'Německo (držba <1 rok)' }, rate: 0.42, note: { en: '0 % after 1-year holding', sk: '0 % po 1-ročnom držaní', cs: '0 % po ročním držení' } },
  { id: 'at', name: { en: 'Austria (bought from Mar 2021)', sk: 'Rakúsko (kúpené od 3/2021)', cs: 'Rakousko (koupeno od 3/2021)' }, rate: 0.275, note: { en: '0 % after 1-year holding if bought before Mar 2021', sk: '0 % po 1-ročnom držaní pri nákupe pred 3/2021', cs: '0 % po ročním držení při nákupu před 3/2021' } },
  { id: 'hu', name: { en: 'Hungary', sk: 'Maďarsko', cs: 'Maďarsko' }, rate: 0.15 },
  { id: 'hr', name: { en: 'Croatia (<2y held)', sk: 'Chorvátsko (držba <2 roky)', cs: 'Chorvatsko (držba <2 roky)' }, rate: 0.12, note: { en: '0 % after 2-year holding', sk: '0 % po 2-ročnom držaní', cs: '0 % po dvouletém držení' } },
  { id: 'ro', name: { en: 'Romania', sk: 'Rumunsko', cs: 'Rumunsko' }, rate: 0.16 }, // 16 % from 2026 (10 % until 2025)
  { id: 'bg', name: { en: 'Bulgaria', sk: 'Bulharsko', cs: 'Bulharsko' }, rate: 0.1 },
  { id: 'pl', name: { en: 'Poland', sk: 'Poľsko', cs: 'Polsko' }, rate: 0.19 },
  { id: 'fr', name: { en: 'France', sk: 'Francúzsko', cs: 'Francie' }, rate: 0.314 }, // PFU 12.8 % + 18.6 % social charges (2026)
  { id: 'es', name: { en: 'Spain (gains €6k–50k)', sk: 'Španielsko (zisk 6–50 tis. €)', cs: 'Španělsko (zisk 6–50 tis. €)' }, rate: 0.21 },
  { id: 'custom', name: { en: 'Custom', sk: 'Vlastné', cs: 'Vlastní' }, rate: 0.19 },
];

export interface LoanInputs {
  cashNeeded: number;
  btcHoldings: number;
  btcPrice: number;
  ltv: number; // 0.25–0.5
  apr: number; // annual interest, decimal
  years: number;
  taxRate: number; // decimal
  gainRatio: number; // share of sold value that is taxable gain, decimal
}

export interface ScenarioResult {
  change: number; // BTC price change over horizon, decimal
  sellNet: number;
  loanNet: number;
  winner: 'sell' | 'loan';
  diff: number;
}

export interface LoanAnalysis {
  btcToSell: number;
  taxIfSold: number;
  cashAfterTax: number;
  collateralBtc: number;
  interestTotal: number;
  interestPerYear: number;
  liquidationPrice: number;
  distanceToLiquidation: number; // decimal, negative = already past
  scenarios: ScenarioResult[];
  bestWinner: 'sell' | 'loan';
  loanWinsCount: number;
}

export const SCENARIO_CHANGES = [-0.5, -0.25, 0, 0.5, 1.5];

export function analyzeLoan(inp: LoanInputs): LoanAnalysis {
  const { cashNeeded, btcHoldings, btcPrice, ltv, apr, years, taxRate, gainRatio } = inp;

  // ── sell path ──
  const btcToSell = cashNeeded / btcPrice;
  const taxIfSold = cashNeeded * gainRatio * taxRate;
  const cashAfterTax = cashNeeded - taxIfSold;

  // ── loan path ──
  const collateralBtc = cashNeeded / (ltv * btcPrice);
  const interestPerYear = cashNeeded * apr;
  const interestTotal = interestPerYear * years;

  // margin call when loanValue / collateralValue = MARGIN_CALL_LTV
  // -> price at which cashNeeded / (collateralBtc * P) = 0.7 -> P = cashNeeded / (0.7 * collateralBtc)
  const liquidationPrice = cashNeeded / (MARGIN_CALL_LTV * collateralBtc);
  // buffer = how far price can FALL before liquidation (positive = safe headroom)
  const distanceToLiquidation = 1 - liquidationPrice / btcPrice;

  // ── scenarios ──
  const scenarios: ScenarioResult[] = SCENARIO_CHANGES.map((change) => {
    const horizonPrice = btcPrice * (1 + change);

    // SELL: cash (after tax) + remaining BTC value
    const remainingBtc = Math.max(0, btcHoldings - btcToSell);
    const sellNet = cashAfterTax + remainingBtc * horizonPrice;

    // LOAN: full stack appreciates, minus principal + interest owed
    const loanNet = btcHoldings * horizonPrice - cashNeeded - interestTotal;

    const winner = loanNet >= sellNet ? 'loan' : 'sell';
    return { change, sellNet, loanNet, winner, diff: Math.abs(loanNet - sellNet) };
  });

  const loanWinsCount = scenarios.filter((s) => s.winner === 'loan').length;
  const bestWinner = loanWinsCount >= SCENARIO_CHANGES.length / 2 ? 'loan' : 'sell';

  return {
    btcToSell,
    taxIfSold,
    cashAfterTax,
    collateralBtc,
    interestTotal,
    interestPerYear,
    liquidationPrice,
    distanceToLiquidation,
    scenarios,
    bestWinner,
    loanWinsCount,
  };
}

// Neutral summary of the two scenarios. Deliberately no verdict and no
// "you should": the page shows what the numbers do, the visitor decides
// (MiCA: a personalised sell/borrow recommendation would be advice).
export interface LoanFacts {
  risk: boolean; // margin-call headroom under 15 %
  headline: string;
  facts: string[];
}

export function loanFacts(inp: LoanInputs, a: LoanAnalysis, lang: Lang = 'en'): LoanFacts {
  const { years, apr } = inp;
  const cash = inp.cashNeeded;
  // price multiple at which the borrow column catches up with the sell column
  const breakevenHorizon = (cash + a.interestTotal + a.cashAfterTax) / cash;
  const breakevenAnnual = Math.pow(breakevenHorizon, 1 / years) - 1;
  const facts: string[] = [];
  const risk = a.distanceToLiquidation < 0.15;

  if (risk) {
    facts.push(
      tv(lang, `Headroom to the margin call is only {0} % – a moderate drawdown puts the collateral at risk. A lower LTV or amount increases the headroom.`, `Rezerva do margin callu je len {0} % – mierny pokles ceny ohrozí kolaterál. Nižšie LTV alebo nižšia suma rezervu zväčší.`, `Rezerva do margin callu je jen {0} % – mírný pokles ceny ohrozí kolaterál. Nižší LTV nebo nižší částka rezervu zvětší.`, [(a.distanceToLiquidation * 100).toFixed(0)]),
    );
  }
  facts.push(
    tv(lang, `In {0} of {1} price scenarios the borrow column ends higher; in {2} the sell column does.`, `V {0} z {1} cenových scenárov skončí vyššie stĺpec pôžičky; v {2} stĺpec predaja.`, `V {0} z {1} cenových scénářů skončí výš sloupec půjčky; v {2} sloupec prodeje.`, [a.loanWinsCount, a.scenarios.length, a.scenarios.length - a.loanWinsCount]),
    tv(lang, `Selling now: {0} tax on the gain, and {1} BTC leave your stack.`, `Predaj teraz: daň zo zisku {0} a z vášho stacku odíde {1} BTC.`, `Prodej teď: daň ze zisku {0} a z vašeho stacku odejde {1} BTC.`, [eur(a.taxIfSold), fmtNum(a.btcToSell, 4, lang)]),
    tv(lang, `Borrowing: {0} interest over {1} years ({2} % p.a.), with {3} BTC locked as collateral.`, `Pôžička: úrok {0} za {1} r. ({2} % p.a.), {3} BTC uzamknutých ako kolaterál.`, `Půjčka: úrok {0} za {1} r. ({2} % p.a.), {3} BTC uzamčených jako kolaterál.`, [eur(a.interestTotal), years, (apr * 100).toFixed(0), fmtNum(a.collateralBtc, 4, lang)]),
    tv(lang, `The borrow column catches up with the sell column only if BTC rises by about {0} % per year or more.`, `Stĺpec pôžičky dobehne stĺpec predaja, len ak BTC rastie zhruba o {0} % ročne alebo viac.`, `Sloupec půjčky dožene sloupec prodeje, jen pokud BTC roste zhruba o {0} % ročně nebo víc.`, [(breakevenAnnual * 100).toFixed(0)]),
  );
  return {
    risk,
    headline: risk
      ? t(lang, 'Liquidation risk is high at these settings', 'Pri týchto nastaveniach je riziko likvidácie vysoké', 'Při těchto nastaveních je riziko likvidace vysoké')
      : t(lang, 'What the numbers show', 'Čo ukazujú čísla', 'Co ukazují čísla'),
    facts,
  };
}

export function eur(n: number): string {
  return fmtEur(n);
}

export function eurCompact(n: number): string {
  return fmtEurCompact(n);
}


