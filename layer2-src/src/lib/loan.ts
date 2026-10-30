// ─────────────────────────────────────────────────────────────
// Loan & Liquidity Copilot: sell vs. borrow model, LTV risk,
// scenario analysis. Virtuse Layer 2 (Module: Loans).
// Simplified educational model, not financial advice. LTV, APR and the
// margin-call threshold are the visitor's own inputs; no provider terms
// are assumed.
//
// Model (Ras, 2026-10-12): the cash is spent in both columns.
//   Sell:   sell enough BTC that proceeds minus tax = cash needed.
//           Net = remaining BTC × scenario price.
//   Borrow: net = all BTC × scenario price − principal − total interest.
//
// Display strings: EN/SK/CS inline via t()/tv()/{en, sk, cs}; other
// languages through the dictionaries keyed by the English text.
// ─────────────────────────────────────────────────────────────

import { t, tv, fmtEur, fmtEurCompact, fmtNum, fmtNumShort } from './i18n';
import type { Lang, LocalizedText } from './i18n';
import { TAX_SOURCES } from './tax-sources.gen';
export type { Lang, LocalizedText };

// ── Partner + sources ─────────────────────────────────────────
// Firefish referral link stays exactly as issued (no UTM).
export const FIREFISH_URL = 'https://app.firefish.io/auth/sign-up?ref=virtuseloan';
// Same source and date as Partner Finder's licence lines (concierge.ts).
export const ESMA_MICA_URL =
  'https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica';
export const LICENCE_CHECKED: LocalizedText = { en: 'checked 12 Oct 2026', sk: 'overené 12. 10. 2026', cs: 'ověřeno 12. 10. 2026' };
export const FIREFISH_REGULATOR: LocalizedText = { en: 'NBS Slovakia', sk: 'NBS Slovensko', cs: 'NBS Slovensko' };

// ── Input limits ──────────────────────────────────────────────
export const CASH_LIMITS = { min: 1_000, max: 5_000_000 };
export const CASH_SLIDER_MAX = 1_000_000; // typed values above keep the slider at its end
export const BTC_LIMITS = { min: 0.01, max: 1_000 };
export const PRICE_LIMITS = { min: 1_000, max: 10_000_000 };
export const PRICE_BAND = 0.7; // slider ±70 % around the live price
export const LTV_LIMITS = { min: 10, max: 70 }; // percent
export const APR_LIMITS = { min: 0, max: 20 }; // percent, step 0.5
export const YEARS_LIMITS = { min: 1, max: 10 };
export const THRESHOLD_LIMITS = { min: 50, max: 90 }; // percent
export const CUSTOM_RATE_LIMITS = { min: 0, max: 60 }; // percent
export const DEFAULT_THRESHOLD = 70; // example only, never a provider's term

// Fallback when the live price can't be loaded.
export const PRICE_FALLBACK = 74_000;
export const PRICE_FALLBACK_DATE: LocalizedText = { en: 'as of 12 Oct 2026', sk: 'k 12. 10. 2026', cs: 'k 12. 10. 2026' };

function stepScale(segments: [number, number, number][], dp = 0): number[] {
  const f = 10 ** dp;
  const out: number[] = [];
  for (const [from, to, step] of segments) {
    for (let i = Math.round(from * f); i <= Math.round(to * f); i += Math.round(step * f)) {
      const v = i / f;
      if (out[out.length - 1] !== v) out.push(v);
    }
  }
  return out;
}
export const CASH_SCALE = stepScale([[1_000, 10_000, 500], [10_000, 100_000, 5_000], [100_000, 1_000_000, 25_000]]);
export const BTC_SCALE = stepScale([[0.01, 0.1, 0.01], [0.1, 1, 0.05], [1, 10, 0.5], [10, 100, 5], [100, 1_000, 50]], 2);

export function scaleIndex(scale: number[], v: number): number {
  let best = 0;
  for (let i = 1; i < scale.length; i++) if (Math.abs(scale[i] - v) < Math.abs(scale[best] - v)) best = i;
  return best;
}

export const clamp = (v: number, min: number, max: number): number =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;

// Typed numbers: "250000", "250 000", "250.000", "250,000", "250k", "2.5M",
// "2,5M", "€ 2.000". With decimalFirst (BTC, percent) a single separator is
// always the decimal point ("1.500" = 1.5). Returns null if unreadable.
export function parseNumber(raw: string, decimalFirst = false): number | null {
  let s = String(raw).toLowerCase().replace(/eur|btc|€|%|[\s  ']/g, '');
  let mult = 1;
  const suffix = s.match(/^(.*?)(k|m)$/);
  if (suffix) {
    s = suffix[1];
    mult = suffix[2] === 'k' ? 1e3 : 1e6;
  }
  if (!/^\d[\d.,]*$|^[.,]\d+$/.test(s)) return null;
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
    const thousands = groups.every((g) => g.length === 3) && (parts.length > 2 || (mult === 1 && !decimalFirst));
    if (thousands) norm = parts.join('');
    else if (parts.length === 2) norm = parts.join('.');
    else return null;
  }
  const n = parseFloat(norm) * mult;
  return Number.isFinite(n) ? n : null;
}

// ── Tax rates (seo-build/data/tax-sources.json, generated into tax-sources.gen.ts) ──
export interface TaxCountry {
  id: string;
  name: LocalizedText;
  rate: number; // decimal
  condition: string; // English, from the JSON
  source: string;
}

export const TAX_CHECKED: LocalizedText = LICENCE_CHECKED;

const COUNTRY_NAMES: Record<string, LocalizedText> = {
  cz: { en: 'Czechia', sk: 'Česko', cs: 'Česko' },
  sk: { en: 'Slovakia', sk: 'Slovensko', cs: 'Slovensko' },
  pl: { en: 'Poland', sk: 'Poľsko', cs: 'Polsko' },
  at: { en: 'Austria', sk: 'Rakúsko', cs: 'Rakousko' },
  de: { en: 'Germany', sk: 'Nemecko', cs: 'Německo' },
  hu: { en: 'Hungary', sk: 'Maďarsko', cs: 'Maďarsko' },
  si: { en: 'Slovenia', sk: 'Slovinsko', cs: 'Slovinsko' },
  hr: { en: 'Croatia', sk: 'Chorvátsko', cs: 'Chorvatsko' },
  ro: { en: 'Romania', sk: 'Rumunsko', cs: 'Rumunsko' },
  bg: { en: 'Bulgaria', sk: 'Bulharsko', cs: 'Bulharsko' },
  nl: { en: 'Netherlands', sk: 'Holandsko', cs: 'Nizozemsko' },
  fr: { en: 'France', sk: 'Francúzsko', cs: 'Francie' },
  es: { en: 'Spain', sk: 'Španielsko', cs: 'Španělsko' },
};

// Translations of the JSON's English "condition" per country. Shown only
// while the English text still matches the JSON; otherwise the JSON's
// English condition is shown as is (so a changed rule is never mistranslated).
export const TAX_CONDITIONS: Record<string, LocalizedText> = {
  cz: {
    en: "15% income tax (23% on the part of the tax base above 36x the average wage); exempt if held more than 3 years, or if total crypto sale proceeds in the year do not exceed CZK 100,000.",
    sk: "15 % daň z príjmov (23 % z časti základu dane nad 36-násobok priemernej mzdy); oslobodené pri držbe viac ako 3 roky alebo ak celkový príjem z predaja kryptoaktív za rok nepresiahne 100 000 Kč.",
    cs: "15 % daň z příjmů (23 % z části základu daně nad 36násobek průměrné mzdy); osvobozeno při držbě déle než 3 roky nebo pokud celkový příjem z prodeje kryptoaktiv za rok nepřesáhne 100 000 Kč.",
  },
  sk: {
    en: "Crypto sale = other income (§ 8(1)(t)); progressive 19% up to €43,983.32, 25% to €60,349.21, 30% to €75,010.32, 35% above (2026); no holding-period exemption; losses ignored. Plus 16% health insurance contributions on the gain (8% with a disability); the preset uses 19% + 16% = 35%.",
    sk: "Predaj kryptomien = ostatný príjem (§ 8 ods. 1 písm. t); progresívne 19 % do 43 983,32 €, 25 % do 60 349,21 €, 30 % do 75 010,32 €, 35 % nad túto sumu (2026); bez oslobodenia podľa doby držby; straty sa nezohľadňujú. K tomu zdravotné odvody 16 % zo zisku (8 % pri zdravotnom postihnutí); predvoľba počíta 19 % + 16 % = 35 %.",
    cs: "Prodej kryptoměn = ostatní příjem (§ 8 odst. 1 písm. t); progresivně 19 % do 43 983,32 €, 25 % do 60 349,21 €, 30 % do 75 010,32 €, 35 % nad tuto částku (2026); bez osvobození podle doby držby; ztráty se nezohledňují. K tomu zdravotní pojištění 16 % ze zisku (8 % při zdravotním postižení); předvolba počítá 19 % + 16 % = 35 %.",
  },
  pl: {
    en: "19% on income from paid disposal of virtual currency (PIT-38); no holding-period exemption; crypto-to-crypto swaps not taxed.",
    sk: "19 % z príjmu z odplatného prevodu virtuálnej meny (PIT-38); bez oslobodenia podľa doby držby; výmeny kryptomeny za kryptomenu sa nezdaňujú.",
    cs: "19 % z příjmu z úplatného převodu virtuální měny (PIT-38); bez osvobození podle doby držby; směny kryptoměny za kryptoměnu se nedaní.",
  },
  at: {
    en: "27.5% special rate for crypto acquired after 28 February 2021 (no holding exemption); crypto acquired up to 28 Feb 2021 ('Altbestand') stays under the old regime.",
    sk: "Osobitná sadzba 27,5 % pre kryptoaktíva nadobudnuté po 28. februári 2021 (bez oslobodenia podľa doby držby); kryptoaktíva nadobudnuté do 28. 2. 2021 („Altbestand“) ostávajú v starom režime.",
    cs: "Zvláštní sazba 27,5 % pro kryptoaktiva nabytá po 28. únoru 2021 (bez osvobození podle doby držby); kryptoaktiva nabytá do 28. 2. 2021 („Altbestand“) zůstávají ve starém režimu.",
  },
  de: {
    en: "Private sale taxed at the personal progressive rate (0–45%; 42% band for taxable income €69,879–277,825) if held 1 year or less; tax-free after more than 1 year; total private-sale gains under €1,000 a year are tax-free.",
    sk: "Súkromný predaj sa zdaňuje osobnou progresívnou sadzbou (0 až 45 %; pásmo 42 % pre zdaniteľný príjem 69 879 až 277 825 €), ak držba trvala 1 rok alebo menej; po viac ako 1 roku je oslobodený; celkové zisky zo súkromných predajov pod 1 000 € ročne sú oslobodené.",
    cs: "Soukromý prodej se daní osobní progresivní sazbou (0 až 45 %; pásmo 42 % pro zdanitelný příjem 69 879 až 277 825 €), pokud držba trvala 1 rok nebo méně; po více než 1 roce je osvobozen; celkové zisky ze soukromých prodejů pod 1 000 € ročně jsou osvobozeny.",
  },
  hu: {
    en: "15% personal income tax on the annual net gain from crypto transactions; no holding-period exemption; small transactions exempt under minimum-wage-linked limits.",
    sk: "15 % daň z príjmov fyzických osôb z ročného čistého zisku z kryptotransakcií; bez oslobodenia podľa doby držby; malé transakcie sú oslobodené v limitoch naviazaných na minimálnu mzdu.",
    cs: "15 % daň z příjmů fyzických osob z ročního čistého zisku z kryptotransakcí; bez osvobození podle doby držby; malé transakce jsou osvobozeny v limitech navázaných na minimální mzdu.",
  },
  si: {
    en: "No income tax on capital gains from selling virtual currencies by a private individual, unless trading is carried on as a business activity.",
    sk: "Žiadna daň z príjmov z kapitálových ziskov z predaja virtuálnych mien fyzickou osobou, pokiaľ nejde o podnikateľskú činnosť.",
    cs: "Žádná daň z příjmů z kapitálových zisků z prodeje virtuálních měn fyzickou osobou, pokud nejde o podnikatelskou činnost.",
  },
  hr: {
    en: "12% tax on capital gains; gains on crypto acquired more than 2 years before the sale are not taxed (still reported on JOPPD).",
    sk: "12 % daň z kapitálových ziskov; zisky z kryptoaktív nadobudnutých viac ako 2 roky pred predajom sa nezdaňujú (stále sa uvádzajú v JOPPD).",
    cs: "12 % daň z kapitálových zisků; zisky z kryptoaktiv nabytých více než 2 roky před prodejem se nedaní (stále se uvádějí v JOPPD).",
  },
  ro: {
    en: "16% on the gain from transfers of virtual currency made from 1 Jan 2026 (10% before); gains under 200 lei per transaction are exempt if annual gains do not exceed 600 lei; no holding exemption.",
    sk: "16 % zo zisku z prevodov virtuálnej meny uskutočnených od 1. 1. 2026 (predtým 10 %); zisky pod 200 lei na transakciu sú oslobodené, ak ročné zisky nepresiahnu 600 lei; bez oslobodenia podľa doby držby.",
    cs: "16 % ze zisku z převodů virtuální měny uskutečněných od 1. 1. 2026 (dříve 10 %); zisky pod 200 lei na transakci jsou osvobozeny, pokud roční zisky nepřesáhnou 600 lei; bez osvobození podle doby držby.",
  },
  bg: {
    en: "10% tax on the annual tax base; crypto gains (net of the year's losses) are reduced by 10% deemed expenses, so the effective rate on the gain is about 9%; no holding-period exemption.",
    sk: "10 % daň z ročného základu dane; zisky z kryptoaktív (po odpočítaní strát za rok) sa znižujú o 10 % paušálnych výdavkov, takže efektívna sadzba zo zisku je približne 9 %; bez oslobodenia podľa doby držby.",
    cs: "10 % daň z ročního základu daně; zisky z kryptoaktiv (po odečtení ztrát za rok) se snižují o 10 % paušálních výdajů, takže efektivní sazba ze zisku je přibližně 9 %; bez osvobození podle doby držby.",
  },
  nl: {
    en: "No tax on the sale itself; crypto is a Box 3 asset taxed at 36% on a deemed return (6.00% for 'other assets' in the 2026 provisional assessment), above a €59,357 tax-free allowance per person (2026).",
    sk: "Samotný predaj sa nezdaňuje; kryptoaktíva sú majetok v Boxe 3, zdaňovaný 36 % z fiktívneho výnosu (6,00 % pre „ostatný majetok“ v predbežnom výmere 2026) nad nezdaniteľnú sumu 59 357 € na osobu (2026).",
    cs: "Samotný prodej se nedaní; kryptoaktiva jsou majetek v Boxu 3, daněný 36 % z fiktivního výnosu (6,00 % pro „ostatní majetek“ v předběžném výměru 2026) nad nezdanitelnou částku 59 357 € na osobu (2026).",
  },
  fr: {
    en: "Flat tax (PFU) 31.4% = 12.8% income tax + 18.6% social charges on private-wealth crypto gains; option for the progressive scale; exempt if total disposal proceeds in the year are €305 or less; no holding exemption.",
    sk: "Paušálna daň (PFU) 31,4 % = 12,8 % daň z príjmov + 18,6 % sociálne odvody zo ziskov z kryptoaktív v súkromnom majetku; možnosť progresívnej sadzby; oslobodené, ak celkové príjmy z predaja za rok nepresiahnu 305 €; bez oslobodenia podľa doby držby.",
    cs: "Paušální daň (PFU) 31,4 % = 12,8 % daň z příjmů + 18,6 % sociální odvody ze zisků z kryptoaktiv v soukromém majetku; možnost progresivní sazby; osvobozeno, pokud celkové příjmy z prodeje za rok nepřesáhnou 305 €; bez osvobození podle doby držby.",
  },
  es: {
    en: "Gains go to the savings base: combined state + regional scale 19% to €6,000, 21% €6,000–50,000, 23% €50,000–200,000, 27% €200,000–300,000, 30% above; no holding exemption.",
    sk: "Zisky patria do základu z úspor: kombinovaná štátna a regionálna stupnica 19 % do 6 000 €, 21 % od 6 000 do 50 000 €, 23 % od 50 000 do 200 000 €, 27 % od 200 000 do 300 000 €, 30 % nad túto sumu; bez oslobodenia podľa doby držby.",
    cs: "Zisky patří do základu z úspor: kombinovaná státní a regionální stupnice 19 % do 6 000 €, 21 % od 6 000 do 50 000 €, 23 % od 50 000 do 200 000 €, 27 % od 200 000 do 300 000 €, 30 % nad tuto částku; bez osvobození podle doby držby.",
  },
};

export const TAX_COUNTRIES: TaxCountry[] = TAX_SOURCES.countries
  .filter((c) => c.verified === true && typeof c.loanRate === 'number' && Number.isFinite(c.loanRate))
  .map((c) => ({
    id: c.id,
    name: COUNTRY_NAMES[c.id] ?? { en: c.name, sk: c.name, cs: c.name },
    rate: c.loanRate as number,
    condition: c.condition,
    source: c.source,
  }));

export function conditionText(c: TaxCountry, lang: Lang): string {
  const tr = TAX_CONDITIONS[c.id];
  if (tr && tr.en === c.condition) return t(lang, tr.en, tr.sk, tr.cs);
  return c.condition;
}

// ── Model ─────────────────────────────────────────────────────
export interface LoanInputs {
  cashNeeded: number;
  btcHoldings: number;
  btcPrice: number;
  ltv: number; // decimal, 0.10–0.70
  apr: number; // decimal
  years: number;
  taxRate: number; // decimal
  gainRatio: number; // taxable share of the sale proceeds, decimal
  threshold: number; // margin-call LTV, decimal
}

export interface ScenarioResult {
  change: number; // BTC price change over the horizon, decimal
  sellNet: number | null; // null = selling can't raise the cash
  loanNet: number | null; // null = not enough BTC for the collateral
  winner: 'sell' | 'loan' | null;
  diff: number;
}

export interface LoanAnalysis {
  btcToSell: number;
  taxIfSold: number;
  btcLeftAfterSale: number;
  sellFeasible: boolean;
  maxCashFromSelling: number;
  collateralBtc: number;
  loanFeasible: boolean;
  maxLoan: number;
  interestTotal: number;
  interestPerYear: number;
  liquidationPrice: number;
  distanceToLiquidation: number; // decimal, negative = already past
  scenarios: ScenarioResult[];
  loanWinsCount: number;
  breakevenAnnual: number | null; // decimal; borrowing leaves more above this yearly change
}

export const SCENARIO_CHANGES = [-0.5, -0.25, 0, 0.5, 1.5];

const fin = (n: number): number => (Number.isFinite(n) ? n : 0);

export function analyzeLoan(inp: LoanInputs): LoanAnalysis {
  const { cashNeeded: C, btcHoldings: H, btcPrice: P, ltv, apr, years, taxRate, gainRatio, threshold } = inp;
  const keep = Math.max(0.01, 1 - gainRatio * taxRate); // share of proceeds left after tax

  // ── sell: proceeds − tax = cash needed ──
  const btcToSell = fin(C / (P * keep));
  const taxIfSold = fin(btcToSell * P * gainRatio * taxRate);
  const sellFeasible = btcToSell <= H + 1e-9;
  const maxCashFromSelling = fin(H * P * keep);
  const btcLeftAfterSale = Math.max(0, H - btcToSell);

  // ── borrow ──
  const collateralBtc = ltv > 0 ? fin(C / (ltv * P)) : 0;
  const loanFeasible = ltv > 0 && collateralBtc <= H + 1e-9;
  const maxLoan = fin(H * P * ltv);
  const interestPerYear = C * apr;
  const interestTotal = interestPerYear * years;

  // margin call when loan / (collateral × price) = threshold
  const liquidationPrice = threshold > 0 && collateralBtc > 0 ? fin(C / (threshold * collateralBtc)) : 0;
  const distanceToLiquidation = P > 0 ? 1 - liquidationPrice / P : 0;

  const scenarios: ScenarioResult[] = SCENARIO_CHANGES.map((change) => {
    const horizonPrice = P * (1 + change);
    const sellNet = sellFeasible ? btcLeftAfterSale * horizonPrice : null;
    const loanNet = loanFeasible ? H * horizonPrice - C - interestTotal : null;
    const winner = sellNet === null || loanNet === null ? null : loanNet >= sellNet ? 'loan' : 'sell';
    const diff = sellNet === null || loanNet === null ? 0 : Math.abs(loanNet - sellNet);
    return { change, sellNet, loanNet, winner, diff };
  });
  const loanWinsCount = scenarios.filter((s) => s.winner === 'loan').length;

  // Borrow − sell = btcToSell × P' − C − interest, so borrowing leaves more
  // once P'/P ≥ (C + interest) × keep / C.
  let breakevenAnnual: number | null = null;
  if (sellFeasible && loanFeasible && C > 0 && years > 0) {
    const multiple = ((C + interestTotal) * keep) / C;
    const v = Math.pow(multiple, 1 / years) - 1;
    breakevenAnnual = Number.isFinite(v) ? v : null;
  }

  return {
    btcToSell, taxIfSold, btcLeftAfterSale, sellFeasible, maxCashFromSelling,
    collateralBtc, loanFeasible, maxLoan, interestTotal, interestPerYear,
    liquidationPrice, distanceToLiquidation, scenarios, loanWinsCount, breakevenAnnual,
  };
}

// Neutral summary. Deliberately no verdict and no "you should": the page
// shows what the numbers do, the visitor decides (MiCA: a personalised
// sell/borrow recommendation would be advice).
export interface LoanFacts {
  risk: boolean; // margin-call headroom under 15 %
  headline: string;
  facts: string[];
}

const pct1 = (d: number, lang: Lang) => fmtNumShort(Math.round(d * 1000) / 10, 1, lang);

export function loanFacts(inp: LoanInputs, a: LoanAnalysis, lang: Lang = 'en'): LoanFacts {
  const { years, apr } = inp;
  const facts: string[] = [];
  const risk = a.loanFeasible && a.distanceToLiquidation < 0.15;

  if (risk) {
    facts.push(
      tv(lang,
        'Headroom to the margin call is only {0} %. A moderate price drop puts the collateral at risk. A lower LTV or amount increases the headroom.',
        'Rezerva do margin callu je len {0} %. Mierny pokles ceny ohrozí zábezpeku. Nižšie LTV alebo nižšia suma rezervu zväčší.',
        'Rezerva do margin callu je jen {0} %. Mírný pokles ceny ohrozí kolaterál. Nižší LTV nebo nižší částka rezervu zvětší.',
        [Math.max(0, a.distanceToLiquidation * 100).toFixed(0)]),
    );
  }
  if (a.sellFeasible && a.loanFeasible) {
    facts.push(
      tv(lang,
        'In {0} of {1} price scenarios borrowing leaves more; in {2} selling does.',
        'V {0} z {1} cenových scenárov zostane viac pri pôžičke; v {2} pri predaji.',
        'V {0} z {1} cenových scénářů zůstane víc u půjčky; v {2} u prodeje.',
        [a.loanWinsCount, a.scenarios.length, a.scenarios.length - a.loanWinsCount]),
    );
  }
  if (a.sellFeasible) {
    facts.push(
      tv(lang,
        'Selling now: {0} BTC leave your stack, and {1} of the proceeds goes to tax on the gain.',
        'Predaj teraz: z vášho stacku odíde {0} BTC a {1} z výnosu pôjde na daň zo zisku.',
        'Prodej teď: z vašeho stacku odejde {0} BTC a {1} z výnosu půjde na daň ze zisku.',
        [fmtNum(a.btcToSell, 4, lang), eur(a.taxIfSold)]),
    );
  }
  if (a.loanFeasible) {
    facts.push(
      tv(lang,
        'Borrowing: {0} interest over {1} years ({2} % p.a.), with {3} BTC locked as collateral.',
        'Pôžička: úrok {0} za {1} r. ({2} % p. a.), {3} BTC uzamknutých ako zábezpeka.',
        'Půjčka: úrok {0} za {1} r. ({2} % p. a.), {3} BTC uzamčených jako kolaterál.',
        [eur(a.interestTotal), years, fmtNumShort(apr * 100, 1, lang), fmtNum(a.collateralBtc, 4, lang)]),
    );
  }
  if (a.breakevenAnnual !== null) {
    facts.push(
      a.breakevenAnnual > 0
        ? tv(lang,
          'Borrowing leaves more only if BTC rises by about {0} % per year or more.',
          'Pôžička nechá viac, len ak BTC rastie zhruba o {0} % ročne alebo viac.',
          'Půjčka nechá víc, jen pokud BTC roste zhruba o {0} % ročně nebo víc.',
          [pct1(a.breakevenAnnual, lang)])
        : tv(lang,
          'Borrowing leaves more unless BTC falls by more than about {0} % per year.',
          'Pôžička nechá viac, pokiaľ BTC neklesá o viac než zhruba {0} % ročne.',
          'Půjčka nechá víc, pokud BTC neklesá o víc než zhruba {0} % ročně.',
          [pct1(-a.breakevenAnnual, lang)]),
    );
  }
  if (!a.sellFeasible && !a.loanFeasible) {
    facts.push(
      t(lang,
        'Your BTC holdings are too small for this amount either way. Lower the cash needed or add holdings to compare both options.',
        'Vaše BTC na túto sumu nestačia ani v jednom prípade. Znížte potrebnú hotovosť alebo pridajte BTC, aby ste mohli porovnať obe možnosti.',
        'Vaše BTC na tuto částku nestačí ani v jednom případě. Snižte potřebnou hotovost nebo přidejte BTC, abyste mohli porovnat obě možnosti.'),
    );
  }
  return {
    risk,
    headline: risk
      ? t(lang, 'Liquidation risk is high at these settings', 'Pri týchto nastaveniach je riziko likvidácie vysoké', 'Při těchto nastaveních je riziko likvidace vysoké')
      : t(lang, 'What the numbers show', 'Čo ukazujú čísla', 'Co ukazují čísla'),
    facts,
  };
}

// ── Formatting ────────────────────────────────────────────────
// Negative amounts get a true minus sign before the currency: "−€242.5k".
export function eur(n: number): string {
  const v = fin(n);
  return v < 0 && Math.round(-v) > 0 ? '−' + fmtEur(-v) : fmtEur(Math.abs(v) < 0.5 ? 0 : v);
}

export function eurCompact(n: number): string {
  const v = fin(n);
  return v < 0 && Math.round(-v) > 0 ? '−' + fmtEurCompact(-v) : fmtEurCompact(Math.abs(v) < 0.5 ? 0 : v);
}
