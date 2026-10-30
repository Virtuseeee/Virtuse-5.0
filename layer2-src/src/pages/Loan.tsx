import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, ArrowUpRight, Landmark, Scale, ShieldAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  analyzeLoan,
  APR_LIMITS,
  BTC_LIMITS,
  BTC_SCALE,
  CASH_LIMITS,
  CASH_SCALE,
  CASH_SLIDER_MAX,
  clamp,
  conditionText,
  CUSTOM_RATE_LIMITS,
  DEFAULT_THRESHOLD,
  ESMA_MICA_URL,
  eur,
  eurCompact,
  FIREFISH_REGULATOR,
  FIREFISH_URL,
  LICENCE_CHECKED,
  loanFacts,
  LTV_LIMITS,
  parseNumber,
  PRICE_BAND,
  PRICE_FALLBACK,
  PRICE_FALLBACK_DATE,
  PRICE_LIMITS,
  scaleIndex,
  TAX_CHECKED,
  TAX_COUNTRIES,
  THRESHOLD_LIMITS,
  YEARS_LIMITS,
} from '@/lib/loan';
import { getLang, t, tv, L, fmtEur, fmtNum, fmtNumShort, pct } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { ResultCaptureForm } from '@/components/CaptureForm';
import { PartnerLinkNote } from '@/components/PartnerLinkNote';
import { ShareResult } from '@/components/ShareResult';
import { TAX_FIELD_SOURCES } from '@/lib/tax-sources.gen';

// ── State from the URL ───────────────────────────────────────
// ?amount=<bucket>: Partner Finder's loan-flow card links here with one of its
// AMOUNTS ids (s/m/l/xl). Explicit ?cash=&btc=&price=&ltv=&apr=&years=
// &country=&threshold= override it. Everything is clamped; invalid values are ignored.
const AMOUNT_BUCKET_PRESETS: Record<string, number> = {
  s: 2_000, // < €1,000
  m: 10_000, // €1,000 to 10,000
  l: 50_000, // €10,000 to 100,000
  xl: 150_000, // > €100,000
};

// Page language → default tax country (if that country is shown at all).
const LANG_COUNTRY: Record<string, string> = { 'en': 'sk', sk: 'sk', cs: 'cz', de: 'de', pl: 'pl', hu: 'hu', fr: 'fr', es: 'es' };
const countryShown = (id: string | null) => id !== null && (id === 'custom' || TAX_COUNTRIES.some((c) => c.id === id));

interface LoanState {
  cash: number;
  btc: number;
  price: number | null; // null = not in the URL (use the live price)
  ltv: number; // percent
  apr: number; // percent
  years: number;
  country: string;
  threshold: number; // percent
}

function readUrlState(lang: Lang): LoanState {
  const def = LANG_COUNTRY[lang];
  const s: LoanState = {
    cash: 25_000, btc: 1, price: null, ltv: 40, apr: 6, years: 3,
    country: countryShown(def) ? def : 'custom', threshold: DEFAULT_THRESHOLD,
  };
  try {
    const q = new URLSearchParams(window.location.search);
    const bucket = q.get('amount');
    if (bucket && bucket in AMOUNT_BUCKET_PRESETS) s.cash = AMOUNT_BUCKET_PRESETS[bucket];
    const num = (k: string, decimalFirst: boolean) => {
      const v = q.get(k);
      return v === null ? null : parseNumber(v, decimalFirst);
    };
    const cash = num('cash', false);
    if (cash !== null) s.cash = cash;
    const btc = num('btc', true);
    if (btc !== null) s.btc = btc;
    const price = num('price', false);
    if (price !== null) s.price = clamp(Math.round(price), PRICE_LIMITS.min, PRICE_LIMITS.max);
    const ltv = num('ltv', true);
    if (ltv !== null) s.ltv = ltv;
    const apr = num('apr', true);
    if (apr !== null) s.apr = apr;
    const years = num('years', true);
    if (years !== null) s.years = Math.round(years);
    const thr = num('threshold', true);
    if (thr !== null) s.threshold = thr;
    const c = q.get('country');
    if (countryShown(c)) s.country = c as string;
  } catch {
    /* no-op: defaults */
  }
  s.cash = Math.round(clamp(s.cash, CASH_LIMITS.min, CASH_LIMITS.max));
  s.btc = Math.round(clamp(s.btc, BTC_LIMITS.min, BTC_LIMITS.max) * 100) / 100;
  s.ltv = Math.round(clamp(s.ltv, LTV_LIMITS.min, LTV_LIMITS.max));
  s.apr = Math.round(clamp(s.apr, APR_LIMITS.min, APR_LIMITS.max) * 2) / 2;
  s.years = clamp(s.years, YEARS_LIMITS.min, YEARS_LIMITS.max);
  s.threshold = Math.round(clamp(s.threshold, THRESHOLD_LIMITS.min, THRESHOLD_LIMITS.max));
  return s;
}

function stateUrl(s: LoanState & { price: number }): URL {
  const u = new URL(window.location.href);
  u.searchParams.delete('amount');
  u.searchParams.set('cash', String(s.cash));
  u.searchParams.set('btc', String(s.btc));
  u.searchParams.set('price', String(s.price));
  u.searchParams.set('ltv', String(s.ltv));
  u.searchParams.set('apr', String(s.apr));
  u.searchParams.set('years', String(s.years));
  u.searchParams.set('country', s.country);
  u.searchParams.set('threshold', String(s.threshold));
  return u;
}

function writeUrlState(s: LoanState & { price: number }) {
  try {
    const u = stateUrl(s);
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
  } catch {
    /* no-op */
  }
}

// ── Click tracking ───────────────────────────────────────
function trackLinkClick(target: string) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: 'loan_link_click', target });
  } catch {
    /* tracking must never block navigation */
  }
}

const cfoHref = (lang: Lang) =>
  `${lang === 'en' ? '/cfo.html' : `/${lang}/cfo.html`}?utm_source=loan&utm_medium=cta&utm_campaign=cfo#waitForm`;

const PRIMARY_CTA =
  'btn-primary flex items-center justify-center gap-1.5 rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-canvas transition hover:opacity-85';
const SECONDARY_CTA =
  'flex items-center justify-center gap-1.5 rounded-[10px] border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-white/30 hover:bg-panel-hover';

// Big values: full amount up to €10M, compact above so cards fit a phone.
const eurStat = (n: number) => (Math.abs(n) >= 10_000_000 ? eurCompact(n) : eur(n));

function timeLabel(ms: number, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, { hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleTimeString();
  }
}

// Typed value next to a slider label: accepts "250 000", "250k", "2.5M",
// "2,5M", "1,5" …; clamps and shows the formatted value once the field loses focus.
function NumField(props: {
  value: number;
  min: number;
  max: number;
  label: string;
  display: string;
  decimalFirst?: boolean;
  round?: (v: number) => number;
  width?: string;
  onCommit: (v: number) => void;
}) {
  const { value, min, max, label, display, decimalFirst = false, round = Math.round, width = 'w-32', onCommit } = props;
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const n = parseNumber(text, decimalFirst);
    if (n !== null) onCommit(clamp(round(n), min, max));
    setText(null);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={text ?? display}
      onFocus={(e) => {
        setText(String(value));
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setText(null);
          e.currentTarget.blur();
        }
      }}
      className={`ml-auto ${width} rounded-md border border-line-strong bg-canvas px-2 py-1 text-right text-sm font-semibold text-bitcoin outline-none focus:border-bitcoin/60`}
    />
  );
}

function Bullet({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" style={color ? { background: color } : undefined} />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export default function Loan() {
  const lang = useMemo(getLang, []);
  const start = useMemo(() => readUrlState(lang), [lang]);
  const [cashNeeded, setCashNeeded] = useState(start.cash);
  const [btcHoldings, setBtcHoldings] = useState(start.btc);
  const [livePrice, setLivePrice] = useState<{ price: number; at: number } | null>(null);
  const [priceFailed, setPriceFailed] = useState(false);
  const [btcPrice, setBtcPrice] = useState(start.price ?? PRICE_FALLBACK);
  const [ltvPct, setLtvPct] = useState(start.ltv);
  const [aprPct, setAprPct] = useState(start.apr);
  const [years, setYears] = useState(start.years);
  const [country, setCountry] = useState(start.country);
  const [thresholdPct, setThresholdPct] = useState(start.threshold);
  const [customRate, setCustomRate] = useState(19); // percent
  const [gainRatio, setGainRatio] = useState(0.5);

  // The visitor's own changes (not the live price arriving) mark the state dirty;
  // from then on the URL carries the full setup.
  const dirty = useRef(false);
  const priceTouched = useRef(start.price !== null);
  const user = <T,>(set: (v: T) => void) => (v: T) => {
    dirty.current = true;
    set(v);
  };

  // Live BTC/EUR from mempool.space; dated fallback if it fails.
  useEffect(() => {
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 8000);
    fetch('https://mempool.space/api/v1/prices', { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { EUR?: number; time?: number }) => {
        const p = Number(j.EUR);
        if (!Number.isFinite(p) || p <= 0) throw new Error('no EUR price');
        const at = Number.isFinite(Number(j.time)) && Number(j.time) > 0 ? Number(j.time) * 1000 : Date.now();
        setLivePrice({ price: Math.round(p), at });
        if (!priceTouched.current) setBtcPrice(clamp(Math.round(p), PRICE_LIMITS.min, PRICE_LIMITS.max));
      })
      .catch(() => setPriceFailed(true))
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      ctl.abort();
    };
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    writeUrlState({ cash: cashNeeded, btc: btcHoldings, price: btcPrice, ltv: ltvPct, apr: aprPct, years, country, threshold: thresholdPct });
  }, [cashNeeded, btcHoldings, btcPrice, ltvPct, aprPct, years, country, thresholdPct]);

  const setPrice = (v: number) => {
    priceTouched.current = true;
    dirty.current = true;
    setBtcPrice(v);
  };

  const selected = TAX_COUNTRIES.find((c) => c.id === country) ?? null;
  const taxRate = selected ? selected.rate : customRate / 100;
  const ltv = ltvPct / 100;
  const apr = aprPct / 100;
  const threshold = thresholdPct / 100;

  const a = useMemo(
    () => analyzeLoan({ cashNeeded, btcHoldings, btcPrice, ltv, apr, years, taxRate, gainRatio, threshold }),
    [cashNeeded, btcHoldings, btcPrice, ltv, apr, years, taxRate, gainRatio, threshold],
  );
  const facts = useMemo(
    () => loanFacts({ cashNeeded, btcHoldings, btcPrice, ltv, apr, years, taxRate, gainRatio, threshold }, a, lang),
    [cashNeeded, btcHoldings, btcPrice, ltv, apr, years, taxRate, gainRatio, threshold, a, lang],
  );

  const riskPct = a.distanceToLiquidation * 100;
  const riskColor = riskPct < 15 ? '#f87171' : riskPct < 30 ? '#F7931A' : '#34d399';
  const showCfo = cashNeeded >= 100_000 || btcHoldings >= 5;

  // Price slider: ±70 % around the live price (fallback price if it didn't load).
  const base = livePrice?.price ?? PRICE_FALLBACK;
  const priceMin = Math.max(PRICE_LIMITS.min, Math.round((base * (1 - PRICE_BAND)) / 100) * 100);
  const priceMax = Math.max(priceMin + 100, Math.round((base * (1 + PRICE_BAND)) / 100) * 100);

  const btcFmt = (n: number, d = 2) => `${fmtNum(n, d, lang)} BTC`;
  const pctTxt = (n: number) => pct(fmtNumShort(n, 1, lang), lang);

  const cashLabel = t(lang, 'Cash needed', 'Potrebná hotovosť', 'Potřebná hotovost');
  const btcLabel = t(lang, 'Your BTC holdings', 'Vaše BTC', 'Vaše BTC');
  const priceLabel = t(lang, 'BTC price', 'Cena BTC', 'Cena BTC');
  const ltvLabel = t(lang, 'Loan-to-value', 'Pomer LTV', 'Poměr LTV');
  const aprLabel = t(lang, 'Interest rate (APR)', 'Úroková sadzba (APR)', 'Úroková sazba (APR)');
  const yearsLabel = t(lang, 'Horizon in years', 'Horizont v rokoch', 'Horizont v letech');
  const thresholdLabel = t(lang, 'Margin-call threshold (LTV)', 'Prah margin callu (LTV)', 'Práh margin callu (LTV)');
  const customLabel = t(lang, 'Your tax rate on gains', 'Vaša sadzba dane zo zisku', 'Vaše sazba daně ze zisku');
  const gainLabel = t(lang, 'Taxable share of the sale (gain)', 'Zdaniteľná časť predaja (zisk)', 'Zdanitelná část prodeje (zisk)');
  const notEnough = t(lang, 'Not enough BTC', 'Nedostatok BTC', 'Nedostatek BTC');
  const colChange = t(lang, 'BTC price change', 'Zmena ceny BTC', 'Změna ceny BTC');
  const colSell = t(lang, 'If you sell', 'Ak predáte', 'Pokud prodáte');
  const colBorrow = t(lang, 'If you borrow', 'Ak si požičiate', 'Pokud si půjčíte');
  const colDiff = t(lang, 'Difference', 'Rozdiel', 'Rozdíl');

  const sellWarning = tv(lang,
    'Selling all your {0} raises at most {1} after tax.',
    'Predajom všetkých vašich {0} získate po zdanení najviac {1}.',
    'Prodejem všech vašich {0} získáte po zdanění nejvýše {1}.',
    [btcFmt(btcHoldings), eur(a.maxCashFromSelling)]);
  const loanWarning = tv(lang,
    "Your {0} isn't enough for {1} at {2} % LTV. Max loan: {3}.",
    'Vašich {0} nestačí na {1} pri LTV {2} %. Maximálna pôžička: {3}.',
    'Vašich {0} nestačí na {1} při LTV {2} %. Maximální půjčka: {3}.',
    [btcFmt(btcHoldings), eur(cashNeeded), ltvPct, eur(a.maxLoan)]);

  const sellNetToday = a.scenarios.find((s) => s.change === 0)?.sellNet ?? null;
  const loanNetToday = a.scenarios.find((s) => s.change === 0)?.loanNet ?? null;

  return (
    <div className="text-ink">
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* controls */}
        <div className="min-w-0 space-y-6 rounded-2xl border border-line bg-panel p-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label className="text-ink-muted">{cashLabel}</Label>
              <NumField value={cashNeeded} min={CASH_LIMITS.min} max={CASH_LIMITS.max} label={cashLabel} display={fmtEur(cashNeeded, 0, lang)} onCommit={user(setCashNeeded)} />
            </div>
            <Slider
              value={[cashNeeded > CASH_SLIDER_MAX ? CASH_SCALE.length - 1 : scaleIndex(CASH_SCALE, cashNeeded)]}
              onValueChange={([i]) => user(setCashNeeded)(CASH_SCALE[i])}
              min={0}
              max={CASH_SCALE.length - 1}
              step={1}
              aria-label={cashLabel}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label className="text-ink-muted">{btcLabel}</Label>
              <NumField
                value={btcHoldings}
                min={BTC_LIMITS.min}
                max={BTC_LIMITS.max}
                label={btcLabel}
                display={btcFmt(btcHoldings)}
                decimalFirst
                round={(v) => Math.round(v * 100) / 100}
                onCommit={user(setBtcHoldings)}
              />
            </div>
            <Slider
              value={[scaleIndex(BTC_SCALE, btcHoldings)]}
              onValueChange={([i]) => user(setBtcHoldings)(BTC_SCALE[i])}
              min={0}
              max={BTC_SCALE.length - 1}
              step={1}
              aria-label={btcLabel}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label className="text-ink-muted">{priceLabel}</Label>
              <NumField value={btcPrice} min={PRICE_LIMITS.min} max={PRICE_LIMITS.max} label={priceLabel} display={fmtEur(btcPrice, 0, lang)} onCommit={setPrice} />
            </div>
            <Slider
              value={[clamp(btcPrice, priceMin, priceMax)]}
              onValueChange={([v]) => setPrice(v)}
              min={priceMin}
              max={priceMax}
              step={100}
              aria-label={priceLabel}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
              {livePrice
                ? tv(lang, 'Live price {0}, as of {1}', 'Aktuálna cena {0}, k {1}', 'Aktuální cena {0}, k {1}', [fmtEur(livePrice.price, 0, lang), timeLabel(livePrice.at, lang)])
                : priceFailed
                  ? tv(lang, 'Live price unavailable. Default {0}, {1}.', 'Aktuálna cena nie je dostupná. Predvolená {0}, {1}.', 'Aktuální cena není dostupná. Výchozí {0}, {1}.', [fmtEur(PRICE_FALLBACK, 0, lang), L(PRICE_FALLBACK_DATE, lang)])
                  : t(lang, 'Loading the live price…', 'Načítava sa aktuálna cena…', 'Načítá se aktuální cena…')}
              {livePrice && btcPrice !== livePrice.price && (
                <>
                  {' · '}
                  <button type="button" onClick={() => setPrice(livePrice.price)} className="underline underline-offset-2 hover:text-ink">
                    {t(lang, 'Use live price', 'Použiť aktuálnu cenu', 'Použít aktuální cenu')}
                  </button>
                </>
              )}
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-ink-muted">{ltvLabel}</Label>
              <span className="text-sm font-semibold text-bitcoin">{pctTxt(ltvPct)}</span>
            </div>
            <Slider value={[ltvPct]} onValueChange={([v]) => user(setLtvPct)(v)} min={LTV_LIMITS.min} max={LTV_LIMITS.max} step={1} aria-label={ltvLabel} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-ink-muted">{aprLabel}</Label>
              <span className="text-sm font-semibold text-bitcoin">{pctTxt(aprPct)}</span>
            </div>
            <Slider value={[aprPct]} onValueChange={([v]) => user(setAprPct)(v)} min={APR_LIMITS.min} max={APR_LIMITS.max} step={0.5} aria-label={aprLabel} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-ink-muted">{t(lang, 'Horizon', 'Horizont', 'Horizont')}</Label>
              <span className="text-sm font-semibold text-bitcoin">{years} {t(lang, 'years', 'rokov', 'let')}</span>
            </div>
            <Slider value={[years]} onValueChange={([v]) => user(setYears)(v)} min={YEARS_LIMITS.min} max={YEARS_LIMITS.max} step={1} aria-label={yearsLabel} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="text-ink-muted">{thresholdLabel}</Label>
              <span className="text-sm font-semibold text-bitcoin">{pctTxt(thresholdPct)}</span>
            </div>
            <Slider value={[thresholdPct]} onValueChange={([v]) => user(setThresholdPct)(v)} min={THRESHOLD_LIMITS.min} max={THRESHOLD_LIMITS.max} step={1} aria-label={thresholdLabel} />
            <p className="mt-1.5 text-[11px] text-ink-muted">
              {t(lang, 'Example threshold. Each provider sets its own.', 'Príkladový prah. Každý poskytovateľ si určuje vlastný.', 'Příkladový práh. Každý poskytovatel si určuje vlastní.')}
            </p>
          </div>

          <div>
            <Label className="mb-2 block text-ink-muted">{t(lang, 'Tax on the gain when you sell', 'Daň zo zisku pri predaji', 'Daň ze zisku při prodeji')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {TAX_COUNTRIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={country === c.id}
                  onClick={() => user(setCountry)(c.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    country === c.id
                      ? 'border-bitcoin bg-bitcoin text-black'
                      : 'border-line-strong text-ink-muted hover:border-bitcoin/50 hover:text-ink'
                  }`}
                >
                  {L(c.name, lang)} · {pctTxt(Math.round(c.rate * 1000) / 10)}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={country === 'custom'}
                onClick={() => user(setCountry)('custom')}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  country === 'custom'
                    ? 'border-bitcoin bg-bitcoin text-black'
                    : 'border-line-strong text-ink-muted hover:border-bitcoin/50 hover:text-ink'
                }`}
              >
                {t(lang, 'Custom rate', 'Vlastná sadzba', 'Vlastní sazba')} · {pctTxt(customRate)}
              </button>
            </div>
            {selected ? (
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                {conditionText(selected, lang)}{' '}
                <span>
                  ·{' '}
                  <a href={selected.source} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
                    {t(lang, 'Source', 'Zdroj', 'Zdroj')}
                  </a>
                  {TAX_FIELD_SOURCES.countries[selected.id]?.healthLevy ? (
                    <>
                      {' · '}
                      <a href={TAX_FIELD_SOURCES.countries[selected.id]!.healthLevy!.source} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
                        {t(lang, 'Source (health insurance)', 'Zdroj (zdravotné odvody)', 'Zdroj (zdravotní pojištění)')}
                      </a>
                    </>
                  ) : null}
                  , {L(TAX_CHECKED, lang)}
                </span>
              </p>
            ) : (
              <div className="mt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-ink-muted">{customLabel}</Label>
                  <NumField
                    value={customRate}
                    min={CUSTOM_RATE_LIMITS.min}
                    max={CUSTOM_RATE_LIMITS.max}
                    label={customLabel}
                    display={pctTxt(customRate)}
                    decimalFirst
                    round={(v) => Math.round(v * 10) / 10}
                    width="w-20"
                    onCommit={setCustomRate}
                  />
                </div>
                <Slider value={[customRate]} onValueChange={([v]) => setCustomRate(v)} min={CUSTOM_RATE_LIMITS.min} max={CUSTOM_RATE_LIMITS.max} step={1} aria-label={customLabel} />
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="text-ink-muted">{gainLabel}</Label>
              <span className="text-sm font-semibold text-bitcoin">{pctTxt(Math.round(gainRatio * 100))}</span>
            </div>
            <Slider value={[gainRatio * 100]} onValueChange={([v]) => setGainRatio(v / 100)} min={0} max={100} step={5} aria-label={gainLabel} />
            <p className="mt-1.5 text-[11px] text-ink-muted">
              {t(lang,
                'Share of the sale price that is profit (taxed). The rest is your original purchase price (not taxed).',
                'Podiel predajnej ceny, ktorý je zisk (zdanený). Zvyšok je vaša pôvodná nákupná cena (nezdanená).',
                'Podíl prodejní ceny, který je zisk (zdaněný). Zbytek je vaše původní nákupní cena (nezdaněná).')}
            </p>
          </div>
        </div>

        {/* results */}
        <div className="min-w-0 space-y-6">
          {/* risk warning */}
          <div className="flex items-start gap-2 rounded-2xl border border-bitcoin/30 bg-bitcoin/5 p-4 text-xs leading-relaxed text-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bitcoin" />
            <p>
              {t(lang,
                'A Bitcoin-backed loan can be liquidated if the price falls. You can lose part or all of your collateral. Interest and fees apply. Not financial, tax or legal advice.',
                'Pôžička krytá Bitcoinom môže byť zlikvidovaná, ak cena klesne. Môžete prísť o časť zábezpeky alebo o celú zábezpeku. Platia sa úroky a poplatky. Nejde o finančné, daňové ani právne poradenstvo.',
                'Půjčka krytá Bitcoinem může být zlikvidována, pokud cena klesne. Můžete přijít o část nebo celý kolaterál. Platí se úroky a poplatky. Nejde o finanční, daňové ani právní poradenství.')}
            </p>
          </div>

          {(!a.sellFeasible || !a.loanFeasible) && (
            <div role="alert" className="space-y-1.5 rounded-2xl border border-red-400/30 bg-red-400/5 p-4 text-sm leading-relaxed text-ink">
              {!a.loanFeasible && <p>{loanWarning}</p>}
              {!a.sellFeasible && <p>{sellWarning}</p>}
            </div>
          )}

          {/* strategy cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`min-w-0 rounded-2xl border border-line bg-panel p-5 ${a.sellFeasible ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-ink-muted" />
                <h3 className="text-sm font-semibold text-ink">{colSell}</h3>
              </div>
              {a.sellFeasible && sellNetToday !== null ? (
                <>
                  <div className="mt-3 text-[11px] uppercase tracking-wide text-ink-muted">{t(lang, 'BTC left, at today\'s price', 'Zostávajúce BTC pri dnešnej cene', 'Zbývající BTC při dnešní ceně')}</div>
                  <div className="mt-1 break-words text-xl font-bold text-ink" title={eur(sellNetToday)}>{eurStat(sellNetToday)}</div>
                  <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink">
                    <Bullet>{tv(lang, 'Sell {0} at {1}', 'Predáte {0} za {1}', 'Prodáte {0} za {1}', [btcFmt(a.btcToSell, 4), eur(btcPrice)])}</Bullet>
                    <Bullet>{tv(lang, 'Tax on the gain: {0}', 'Daň zo zisku: {0}', 'Daň ze zisku: {0}', [eur(a.taxIfSold)])}</Bullet>
                    <Bullet>{tv(lang, 'Cash left: {0}', 'Zostáva hotovosť: {0}', 'Zůstává hotovost: {0}', [eur(cashNeeded)])}</Bullet>
                    <Bullet>{tv(lang, 'BTC left: {0}', 'Zostáva BTC: {0}', 'Zůstává BTC: {0}', [btcFmt(a.btcLeftAfterSale, 4)])}</Bullet>
                    <Bullet>{t(lang, 'Future upside lost on the sold coins', 'Budúci zisk z predaných mincí je stratený', 'Budoucí zisk z prodaných mincí je ztracen')}</Bullet>
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink">{sellWarning}</p>
              )}
            </div>

            <div className={`min-w-0 rounded-2xl border border-line bg-panel p-5 ${a.loanFeasible ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-ink-muted" />
                <h3 className="text-sm font-semibold text-ink">{t(lang, 'If you borrow (Bitcoin-backed loan)', 'Ak si požičiate (pôžička krytá Bitcoinom)', 'Pokud si půjčíte (půjčka krytá Bitcoinem)')}</h3>
              </div>
              {a.loanFeasible && loanNetToday !== null ? (
                <>
                  <div className="mt-3 text-[11px] uppercase tracking-wide text-ink-muted">{t(lang, 'All BTC minus loan and interest, at today\'s price', 'Všetky BTC mínus pôžička a úrok pri dnešnej cene', 'Všechny BTC minus půjčka a úrok při dnešní ceně')}</div>
                  <div className="mt-1 break-words text-xl font-bold text-ink" title={eur(loanNetToday)}>{eurStat(loanNetToday)}</div>
                  <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink">
                    <Bullet>{tv(lang, 'Receive {0} and keep all {1}', 'Dostanete {0} a ponecháte si všetkých {1}', 'Dostanete {0} a ponecháte si všech {1}', [eur(cashNeeded), btcFmt(btcHoldings)])}</Bullet>
                    <Bullet>{tv(lang, '{0} locked as collateral at {1} % LTV', '{0} uzamknutých ako zábezpeka pri LTV {1} %', '{0} uzamčených jako kolaterál při LTV {1} %', [btcFmt(a.collateralBtc, 4), ltvPct])}</Bullet>
                    <Bullet>{t(lang, 'No sale, so no tax on a sale now', 'Žiadny predaj, teda teraz žiadna daň z predaja', 'Žádný prodej, tedy teď žádná daň z prodeje')}</Bullet>
                    <Bullet>{tv(lang, 'Interest: {0} per year, {1} in total', 'Úrok: {0} ročne, spolu {1}', 'Úrok: {0} ročně, celkem {1}', [eur(a.interestPerYear), eur(a.interestTotal)])}</Bullet>
                    <Bullet>{tv(lang, 'To repay at the end: {0}', 'Na splatenie na konci: {0}', 'Ke splacení na konci: {0}', [eur(cashNeeded + a.interestTotal)])}</Bullet>
                    <Bullet color={riskColor}>{tv(lang, 'Margin call if BTC falls to {0}', 'Margin call pri poklese BTC na {0}', 'Margin call při poklesu BTC na {0}', [eur(a.liquidationPrice)])}</Bullet>
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink">{loanWarning}</p>
              )}
            </div>
          </div>

          {/* liquidation watch */}
          {a.loanFeasible && (
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                <ShieldAlert className="h-4 w-4" style={{ color: riskColor }} /> {t(lang, 'Liquidation watch', 'Sledovanie likvidácie', 'Sledování likvidace')}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="min-w-0 rounded-xl border border-line bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-ink-muted">{t(lang, 'Collateral', 'Zábezpeka', 'Kolaterál')}</div>
                  <div className="mt-1 break-words text-lg font-bold text-ink">{btcFmt(a.collateralBtc, 4)}</div>
                  <div className="text-[11px] text-ink-muted">{tv(lang, 'locked at {0} % LTV', 'uzamknuté pri {0} % LTV', 'uzamčené při {0} % LTV', [ltvPct])}</div>
                </div>
                <div className="min-w-0 rounded-xl border border-line bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-ink-muted">{t(lang, 'Margin-call price', 'Cena margin callu', 'Cena margin callu')}</div>
                  <div className="mt-1 break-words text-lg font-bold" style={{ color: riskColor }} title={eur(a.liquidationPrice)}>{eurStat(a.liquidationPrice)}</div>
                  <div className="text-[11px] text-ink-muted">{tv(lang, 'at a {0} % threshold', 'pri prahu {0} %', 'při prahu {0} %', [thresholdPct])}</div>
                </div>
                <div className="min-w-0 rounded-xl border border-line bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-ink-muted">{t(lang, 'Headroom', 'Rezerva', 'Rezerva')}</div>
                  <div className="mt-1 break-words text-lg font-bold" style={{ color: riskColor }}>
                    {riskPct > 0 ? tv(lang, '{0} % drop room', '{0} % priestor na pokles', '{0} % prostor na pokles', [riskPct.toFixed(0)]) : t(lang, 'past threshold', 'za prahom', 'za prahem')}
                  </div>
                  <div className="text-[11px] text-ink-muted">{t(lang, 'before margin call', 'do margin callu', 'do margin callu')}</div>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, (a.liquidationPrice / btcPrice) * 100))}%`, background: riskColor }}
                />
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                {t(lang,
                  "Bar: margin-call price relative to today's price. The threshold is an example; each provider sets its own.",
                  'Pruh: cena margin callu voči dnešnej cene. Prah je príkladový; každý poskytovateľ si určuje vlastný.',
                  'Pruh: cena margin callu vůči dnešní ceně. Práh je příkladový; každý poskytovatel si určuje vlastní.')}
              </p>
            </div>
          )}

          {/* scenario matrix */}
          <div className="min-w-0 rounded-2xl border border-line bg-panel p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {years === 1
                ? t(lang, 'Net position after 1 year', 'Čistá pozícia po 1 roku', 'Čistá pozice po 1 roce')
                : tv(lang, 'Net position after {0} years', 'Čistá pozícia po {0} rokoch', 'Čistá pozice po {0} letech', [years])}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">{t(lang, 'Both columns assume you spend the cash.', 'Oba stĺpce predpokladajú, že hotovosť minete.', 'Oba sloupce předpokládají, že hotovost utratíte.')}</p>

            <div className="mt-4 hidden grid-cols-[1.2fr_1fr_1fr_1.2fr] gap-3 border-b border-line pb-2 text-xs text-ink-muted sm:grid">
              <div>{colChange}</div>
              <div>{colSell}</div>
              <div>{colBorrow}</div>
              <div className="text-right">{colDiff}</div>
            </div>
            <div className="mt-3 space-y-3 sm:mt-0 sm:space-y-0">
              {a.scenarios.map((s) => {
                const cell = (v: number | null) =>
                  v === null ? <span className="text-ink-muted">{notEnough}</span> : <span title={eur(v)}>{eurCompact(v)}</span>;
                return (
                  <div
                    key={s.change}
                    className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-line p-4 text-sm sm:grid-cols-[1.2fr_1fr_1fr_1.2fr] sm:items-center sm:rounded-none sm:border-0 sm:border-b sm:px-0 sm:py-3"
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <span className="font-medium text-ink">{s.change > 0 ? '+' : s.change < 0 ? '−' : ''}{pct(Math.abs(s.change * 100).toFixed(0), lang)}</span>{' '}
                      <span className="text-[11px] text-ink-muted" title={eur(btcPrice * (1 + s.change))}>({eurCompact(btcPrice * (1 + s.change))})</span>
                    </div>
                    <div>
                      <div className="text-[11px] text-ink-muted sm:hidden">{colSell}</div>
                      <div className="text-ink">{cell(s.sellNet)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-ink-muted sm:hidden">{colBorrow}</div>
                      <div className="text-ink">{cell(s.loanNet)}</div>
                    </div>
                    <div className="col-span-2 sm:col-span-1 sm:text-right">
                      <div className="text-[11px] text-ink-muted sm:hidden">{colDiff}</div>
                      {s.winner ? (
                        <span className="inline-block rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-ink" title={eur(s.diff)}>
                          {s.winner === 'loan'
                            ? tv(lang, 'Borrowing leaves {0} more', 'Pôžička nechá o {0} viac', 'Půjčka nechá o {0} víc', [eurCompact(s.diff)])
                            : tv(lang, 'Selling leaves {0} more', 'Predaj nechá o {0} viac', 'Prodej nechá o {0} víc', [eurCompact(s.diff)])}
                        </span>
                      ) : (
                        <span className="text-ink-muted">{t(lang, 'Not comparable', 'Nedá sa porovnať', 'Nelze porovnat')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              {t(lang,
                'If you sell: value of the BTC you keep. If you borrow: value of all your BTC minus the loan and the total interest.',
                'Ak predáte: hodnota BTC, ktoré si ponecháte. Ak si požičiate: hodnota všetkých vašich BTC mínus pôžička a celkový úrok.',
                'Pokud prodáte: hodnota BTC, které si ponecháte. Pokud si půjčíte: hodnota všech vašich BTC minus půjčka a celkový úrok.')}
            </p>
            <ShareResult
              lang={lang}
              tool="loan"
              className="mt-3"
              getUrl={() => stateUrl({ cash: cashNeeded, btc: btcHoldings, price: btcPrice, ltv: ltvPct, apr: aprPct, years, country, threshold: thresholdPct }).toString()}
            />
          </div>

          {/* summary: facts only, no verdict */}
          <div className={`rounded-2xl border p-5 ${facts.risk ? 'border-red-400/30 bg-red-400/5' : 'border-line-strong bg-white/5'}`}>
            <div className="flex items-center gap-2">
              {facts.risk ? <AlertTriangle className="h-4 w-4 text-red-400" /> : <Scale className="h-4 w-4 text-ink-muted" />}
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">{facts.headline}</h3>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink">
              {facts.facts.map((r, i) => (
                <Bullet key={i}>{r}</Bullet>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              {t(lang,
                'This calculator shows both outcomes and does not recommend either. The decision is yours.',
                'Kalkulačka ukazuje oba výsledky a neodporúča ani jeden. Rozhodnutie je na vás.',
                'Kalkulačka ukazuje oba výsledky a nedoporučuje ani jeden. Rozhodnutí je na vás.')}
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a
                href={FIREFISH_URL}
                target="_blank"
                rel="sponsored noopener"
                onClick={() => trackLinkClick('firefish')}
                className={PRIMARY_CTA}
              >
                {tv(lang, 'Open {0}', 'Otvoriť {0}', 'Otevřít {0}', ['Firefish'])} <ArrowUpRight className="h-4 w-4" />
              </a>
              <a href="lending.html" onClick={() => trackLinkClick('loan-partners')} className={SECONDARY_CTA}>
                {t(lang, 'Compare loan partners', 'Porovnať partnerov pre pôžičky', 'Porovnat partnery pro půjčky')} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <PartnerLinkNote lang={lang} className="mt-2" />
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              <span className="text-ink">Firefish: {tv(lang, 'MiCA-licensed ({0})', 'Licencia MiCA ({0})', 'Licence MiCA ({0})', [L(FIREFISH_REGULATOR, lang)])}</span>{' '}
              ·{' '}
              <a href={ESMA_MICA_URL} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
                {t(lang, 'Source', 'Zdroj', 'Zdroj')}
              </a>
              , {L(LICENCE_CHECKED, lang)}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              {t(lang,
                "Virtuse may earn a referral fee. It doesn't change the results.",
                'Virtuse môže dostať odmenu za odporúčanie. Výsledky to nemení.',
                'Virtuse může dostat odměnu za doporučení. Výsledky to nemění.')}
            </p>
            <a
              href="tax-agent.html"
              onClick={() => trackLinkClick('tax-rules')}
              className="mt-3 inline-flex items-center gap-1 text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              {t(lang, "Check your country's tax rules", 'Overiť daňové pravidlá vašej krajiny', 'Ověřit daňová pravidla vaší země')} <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Virtuse CFO, only for larger positions */}
      {showCfo && (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-line-strong bg-panel p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-ink">
            {tv(lang,
              'Managing a larger Bitcoin position? Verdict: check for free what you left out of your decision. The CFO then tracks fees and risks. Verdict is free; the fee audit comes with Virtuse CFO. Paid plans, once they open: {0}/month or {1}/year.',
              'Spravujete väčšiu bitcoinovú pozíciu? Verdict: skontrolujte zadarmo, čo ste vo svojej úvahe vynechali. CFO potom sleduje poplatky a riziká. Verdict je zadarmo, audit poplatkov príde s Virtuse CFO. Platené plány po spustení: {0}/mesiac alebo {1}/rok.',
              'Spravujete větší bitcoinovou pozici? Verdict: zkontrolujte zdarma, co jste ve své úvaze vynechali. CFO pak sleduje poplatky a rizika. Verdict je zdarma, audit poplatků přijde s Virtuse CFO. Placené plány po spuštění: {0}/měsíc nebo {1}/rok.',
              [fmtEur(9, 0, lang), fmtEur(90, 0, lang)])}
          </p>
          <a href={cfoHref(lang)} data-cta="cfo" className={`${SECONDARY_CTA} shrink-0`}>
            {t(lang, 'Get notified', 'Dajte mi vedieť', 'Dejte mi vědět')} <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}

      <ResultCaptureForm
        lang={lang}
        source="loan"
        buildPayload={() => ({
          cashNeeded,
          btcPrice,
          ltvPct,
          aprPct,
          years,
          taxIfSold: Math.round(a.taxIfSold),
          interestTotal: Math.round(a.interestTotal),
          collateralBtc: Math.round(a.collateralBtc * 1e4) / 1e4,
          liquidationPrice: Math.round(a.liquidationPrice),
        })}
      />
    </div>
  );
}
