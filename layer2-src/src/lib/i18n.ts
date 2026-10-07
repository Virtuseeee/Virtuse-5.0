// ─────────────────────────────────────────────────────────────
// Shared i18n for all four Layer 2 modules (concierge, stacking, tax, loan).
//
// Each module's HTML entry sets <html lang="…">; getLang() reads it at mount
// time, so one compiled bundle serves every language.
//
// EN, SK and CS copy lives inline in the code (t(lang, en, sk, cs) and
// { en, sk, cs } objects), exactly as before. Every other language is a
// dictionary in src/lib/i18n/<lang>.ts keyed by the English source text
// (gettext-style) and loaded on demand by initI18n() before the first
// render, so a visitor only downloads their own language. A missing entry
// falls back to English, and scripts/i18n-check.mjs lists what is missing.
//
// Strings with runtime values use numbered placeholders — tv(lang, 'Sell
// {0} BTC', …, [amount]) — so the dictionary key stays stable.
// ─────────────────────────────────────────────────────────────

export const ALL_LANGS = ['en', 'sk', 'cs', 'uk', 'ru', 'de', 'fr', 'es', 'pl', 'hu'] as const;
export type Lang = (typeof ALL_LANGS)[number];
type InlineLang = 'en' | 'sk' | 'cs';

// Languages whose module pages are built and deployed. Add a language here
// (and its four HTML entries in vite.config.ts) once its dictionary is done;
// the module language switcher lists exactly these.
export const MODULE_LANGS: Lang[] = ['en', 'sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru'];

export interface LocalizedText {
  en: string;
  sk: string;
  cs: string;
}

type Dict = Record<string, string>;
const DICTS: Partial<Record<Lang, Dict>> = {};

const isInline = (l: Lang): l is InlineLang => l === 'en' || l === 'sk' || l === 'cs';

// Number/currency formatting per page language. English keeps the exact
// output it always had ("€25,000", "€25.0k"); every other language uses its
// own locale ("25 000 €", "25.000 €", decimal comma, …).
const LOCALES: Record<Lang, string> = {
  en: 'en-IE', sk: 'sk-SK', cs: 'cs-CZ', uk: 'uk-UA', ru: 'ru-RU',
  de: 'de-DE', fr: 'fr-FR', es: 'es-ES', pl: 'pl-PL', hu: 'hu-HU',
};

export function fmtEur(n: number, digits = 0, lang: Lang = getLang()): string {
  const v = digits === 0 ? Math.round(n) : n;
  if (lang === 'en') {
    return '€' + new Intl.NumberFormat('en-IE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  }
  return new Intl.NumberFormat(LOCALES[lang] ?? 'en-IE', {
    style: 'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(v);
}

export function fmtEurCompact(n: number, lang: Lang = getLang()): string {
  if (lang === 'en') {
    if (Math.abs(n) >= 1_000_000) return '€' + (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1_000) return '€' + (n / 1_000).toFixed(1) + 'k';
    return fmtEur(n, 0, lang);
  }
  if (Math.abs(n) < 1_000) return fmtEur(n, 0, lang);
  // German has no short form for thousands (Intl prints "25.500,0 €").
  if (lang === 'de' && Math.abs(n) < 1_000_000) return fmtNumShort(n / 1_000, 1, lang) + '\u00a0Tsd.\u00a0€';
  return new Intl.NumberFormat(LOCALES[lang] ?? 'en-IE', {
    style: 'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol', notation: 'compact', maximumFractionDigits: 1,
  }).format(n);
}

// Fixed decimals (like toFixed) in the page language: "0.16" / "0,16".
export function fmtNum(n: number, digits: number, lang: Lang = getLang()): string {
  if (lang === 'en') return n.toFixed(digits);
  return new Intl.NumberFormat(LOCALES[lang] ?? 'en-IE', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(n);
}

// Up to `max` decimals, trailing zeros dropped: "2.5" / "2,5", "3".
export function fmtNumShort(n: number, max: number, lang: Lang = getLang()): string {
  return new Intl.NumberFormat(LOCALES[lang] ?? 'en-IE', { maximumFractionDigits: max, useGrouping: false }).format(n);
}

export function getLang(): Lang {
  if (typeof document === 'undefined') return 'en';
  const l = document.documentElement.lang;
  return (ALL_LANGS as readonly string[]).includes(l) ? (l as Lang) : 'en';
}

// Load the current page's dictionary (no-op for EN/SK/CS). Call before render.
export async function initI18n(): Promise<void> {
  const lang = getLang();
  if (isInline(lang) || DICTS[lang]) return;
  try {
    const mod = await import(`./i18n/${lang}.ts`);
    DICTS[lang] = mod.default as Dict;
  } catch {
    DICTS[lang] = {}; // dictionary missing or failed to load: fall back to EN
  }
}

const lookup = (lang: Lang, en: string): string => DICTS[lang]?.[en] ?? en;

// Space before "%" follows each language's site pages: "6%" in en/pl/hu/uk/ru,
// "6 %" (non-breaking) in sk/cs/de/fr/es. Applied to every string t/tv/L
// return, so source strings and dictionaries can be written either way.
const PCT_SPACE: Record<Lang, boolean> = {
  en: false, pl: false, hu: false, uk: false, ru: false,
  sk: true, cs: true, de: true, fr: true, es: true,
};
export const pctSep = (lang: Lang = getLang()): string => (PCT_SPACE[lang] ? '\u00a0' : '');
export const pct = (n: string | number, lang: Lang = getLang()): string => `${n}${pctSep(lang)}%`;
const normPct = (s: string, lang: Lang): string => s.replace(/(\d)[ \u00a0\u202f]?%/g, `$1${pctSep(lang)}%`);

export const t = (lang: Lang, en: string, sk: string, cs: string): string =>
  normPct(lang === 'en' ? en : lang === 'sk' ? sk : lang === 'cs' ? cs : lookup(lang, en), lang);

// Localized-text accessor: L(obj, lang) replaces obj[lang].
export function L(x: LocalizedText, lang: Lang): string;
export function L(x: LocalizedText | undefined, lang: Lang): string | undefined;
export function L(x: LocalizedText | undefined, lang: Lang): string | undefined {
  if (!x) return undefined;
  return normPct(isInline(lang) ? x[lang] : lookup(lang, x.en), lang);
}

const fill = (s: string, vars: (string | number)[]): string =>
  s.replace(/\{(\d+)\}/g, (m, i) => (vars[+i] !== undefined ? String(vars[+i]) : m));

// t() with numbered placeholders {0}, {1}, … filled from vars.
export const tv = (lang: Lang, en: string, sk: string, cs: string, vars: (string | number)[]): string =>
  normPct(fill(t(lang, en, sk, cs), vars), lang);
