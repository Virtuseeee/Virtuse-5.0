import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Bot, Calculator, Trophy } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  bestRoute,
  clamp,
  compareFees,
  CONTRIBUTION_LIMITS,
  CONTRIBUTION_SCALE,
  eur,
  eurCompact,
  FEES_CHECKED,
  FREQUENCIES,
  INITIAL_LIMITS,
  INITIAL_SCALE,
  parseAmount,
  project,
  RETURN_PRESETS,
  scaleIndex,
  YEARS_LIMITS,
} from '@/lib/stacking';
import type { FrequencyId, ScenarioId } from '@/lib/stacking';
import { getLang, t, tv, L, fmtEur, fmtNum, pct } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { ResultCaptureForm } from '@/components/CaptureForm';
import { PartnerLinkNote } from '@/components/PartnerLinkNote';
import { ShareResult } from '@/components/ShareResult';

// ── State from the URL ───────────────────────────────────────
// ?amount=<bucket>: Partner Finder's buy-flow card links here with one of its
// AMOUNTS ids (s/m/l/xl); xxl and pc are larger presets. Explicit
// ?initial=&contribution=&freq=&years=&scenario= override the bucket.
// Everything is clamped to the input limits; invalid values are ignored.
interface PlanState {
  initial: number;
  contribution: number;
  frequency: FrequencyId;
  years: number;
  scenario: ScenarioId;
}

const DEFAULT_STATE: PlanState = { initial: 500, contribution: 100, frequency: 'monthly', years: 10, scenario: 'moderate' };

const AMOUNT_BUCKET_PRESETS: Record<string, { initial: number; contribution: number }> = {
  s: { initial: 0, contribution: 50 }, // < €1,000
  m: { initial: 500, contribution: 100 }, // €1,000 to 10,000 (site default)
  l: { initial: 5000, contribution: 500 }, // €10,000 to 100,000
  xl: { initial: 10_000, contribution: 1_000 }, // > €100,000
  xxl: { initial: 100_000, contribution: 5_000 },
  pc: { initial: 1_000_000, contribution: 10_000 },
};

function readUrlState(): PlanState {
  const s = { ...DEFAULT_STATE };
  try {
    const q = new URLSearchParams(window.location.search);
    const bucket = q.get('amount');
    if (bucket && bucket in AMOUNT_BUCKET_PRESETS) Object.assign(s, AMOUNT_BUCKET_PRESETS[bucket]);
    const freq = q.get('freq');
    if (freq === 'weekly' || freq === 'monthly') s.frequency = freq;
    const ini = q.get('initial');
    const iniN = ini !== null ? parseAmount(ini) : null;
    if (iniN !== null) s.initial = iniN;
    const con = q.get('contribution');
    const conN = con !== null ? parseAmount(con) : null;
    if (conN !== null) s.contribution = conN;
    const yrs = Number(q.get('years'));
    if (q.get('years') !== null && Number.isFinite(yrs)) s.years = Math.round(yrs);
    const sc = q.get('scenario');
    if (RETURN_PRESETS.some((p) => p.id === sc)) s.scenario = sc as ScenarioId;
  } catch {
    /* no-op: defaults */
  }
  const cl = CONTRIBUTION_LIMITS[s.frequency];
  s.initial = clamp(s.initial, INITIAL_LIMITS.min, INITIAL_LIMITS.max);
  s.contribution = clamp(s.contribution, cl.min, cl.max);
  s.years = clamp(s.years, YEARS_LIMITS.min, YEARS_LIMITS.max);
  return s;
}

const stateKey = (s: PlanState) => `${s.initial}|${s.contribution}|${s.frequency}|${s.years}|${s.scenario}`;

// Once the visitor changes anything, the URL carries the full plan
// (initial/contribution/freq/years/scenario); amount is dropped, utm_* etc. kept.
function stateUrl(s: PlanState): URL {
  const u = new URL(window.location.href);
  u.searchParams.delete('amount');
  u.searchParams.set('initial', String(s.initial));
  u.searchParams.set('contribution', String(s.contribution));
  u.searchParams.set('freq', s.frequency);
  u.searchParams.set('years', String(s.years));
  u.searchParams.set('scenario', s.scenario);
  return u;
}

function writeUrlState(s: PlanState) {
  try {
    const u = stateUrl(s);
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
  } catch {
    /* no-op */
  }
}

// ── UTM + click tracking ─────────────────────────────────────
// Same convention as ConciergeChat.tsx's withUtm()/trackPartnerClick().
// 21bitcoin, Bybit EU and Kraken referral links stay as issued (see ConciergeChat.tsx NO_UTM).
const NO_UTM = new Set(['21bitcoin', 'bybit-eu', 'kraken']);
function withUtm(url: string, routeId: string): string {
  if (NO_UTM.has(routeId)) return url;
  try {
    const target = new URL(url, window.location.href);
    const here = new URLSearchParams(window.location.search);
    target.searchParams.set('utm_source', 'stacking');
    target.searchParams.set('utm_medium', here.get('utm_medium') || 'page');
    target.searchParams.set('utm_campaign', 'layer2-mvp');
    target.searchParams.set('utm_content', routeId);
    return target.toString();
  } catch {
    return url;
  }
}

function trackRouteClick(routeId: string) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: 'stacking_route_click', route_id: routeId });
  } catch {
    /* tracking must never block navigation */
  }
}

// Language pages of the site (EN at the root).
const FEE_INDEX_PATH: Record<Lang, string> = {
  'en': '/bitcoin-fee-index/',
  sk: '/sk/bitcoin-index-poplatkov/',
  cs: '/cs/bitcoin-index-poplatku/',
  de: '/de/bitcoin-gebuehrenindex/',
  pl: '/pl/bitcoin-indeks-oplat/',
  hu: '/hu/bitcoin-dijindex/',
  uk: '/uk/bitcoin-indeks-komisii/',
  ru: '/ru/bitcoin-indeks-komissiy/',
  fr: '/fr/bitcoin-indice-frais/',
  es: '/es/bitcoin-indice-comisiones/',
};
const cfoHref = (lang: Lang) =>
  `${lang === 'en' ? '/cfo.html' : `/${lang}/cfo.html`}?utm_source=stacking&utm_medium=cta&utm_campaign=cfo#waitForm`;

// true on phone widths (the x axis shows fewer year labels there)
function useNarrow(): boolean {
  const q = '(max-width: 639px)';
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}

// Big values: full amount up to €10M, compact above so stat cards fit a phone.
const eurStat = (n: number) => (Math.abs(n) >= 10_000_000 ? eurCompact(n) : eur(n));

// A translated sentence with one {0} slot rendered as a React node (a link).
function withSlot(text: string, node: ReactNode): ReactNode {
  const [before, after = ''] = text.split('{0}');
  return (
    <>
      {before}
      {node}
      {after}
    </>
  );
}

const PRIMARY_CTA =
  'btn-primary flex items-center justify-center gap-1.5 rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-canvas transition hover:opacity-85';

// Typed amount next to a slider label: accepts "250 000", "250.000", "250k",
// "1m", …; clamps and shows the formatted value once the field loses focus.
function AmountField(props: { value: number; min: number; max: number; label: string; lang: Lang; onCommit: (v: number) => void }) {
  const { value, min, max, label, lang, onCommit } = props;
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const n = parseAmount(text);
    if (n !== null) onCommit(clamp(n, min, max));
    setText(null);
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={text ?? fmtEur(value, 0, lang)}
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
      className="ml-auto w-32 rounded-md border border-line-strong bg-canvas px-2 py-1 text-right text-sm font-semibold text-bitcoin outline-none focus:border-bitcoin/60"
    />
  );
}

export default function Stacking() {
  const lang = useMemo(getLang, []);
  const start = useMemo(readUrlState, []);
  const [initial, setInitial] = useState(start.initial);
  const [contribution, setContribution] = useState(start.contribution);
  const [frequency, setFrequency] = useState<FrequencyId>(start.frequency);
  const [years, setYears] = useState(start.years);
  const [preset, setPreset] = useState<ScenarioId>(start.scenario);

  // Write the plan to the URL after the first real change (not on load).
  const dirty = useRef(false);
  useEffect(() => {
    const now = { initial, contribution, frequency, years, scenario: preset };
    if (!dirty.current && stateKey(now) === stateKey(start)) return;
    dirty.current = true;
    writeUrlState(now);
  }, [initial, contribution, frequency, years, preset, start]);

  const changeFrequency = (f: FrequencyId) => {
    if (f === frequency) return;
    const factor = f === 'weekly' ? 12 / 52 : 52 / 12;
    const lim = CONTRIBUTION_LIMITS[f];
    setContribution(clamp(Math.round(contribution * factor), lim.min, lim.max));
    setFrequency(f);
  };

  const periodsPerYear = FREQUENCIES.find((f) => f.id === frequency)!.periodsPerYear;
  const annualReturn = RETURN_PRESETS.find((p) => p.id === preset)!.annual;
  const contribLimits = CONTRIBUTION_LIMITS[frequency];
  const contribScale = CONTRIBUTION_SCALE[frequency];

  const points = useMemo(
    () => project({ initial, contribution, periodsPerYear, years, annualReturn }, lang),
    [initial, contribution, periodsPerYear, years, annualReturn, lang],
  );

  const final = points[points.length - 1];
  const multiple = final.invested > 0 ? final.value / final.invested : 1;
  const fees = useMemo(() => compareFees(contribution, periodsPerYear), [contribution, periodsPerYear]);
  const advice = useMemo(() => bestRoute(contribution, periodsPerYear, lang), [contribution, periodsPerYear, lang]);
  // The winner's annual fee vs the average annual fee of the other routes.
  const otherFees = fees.filter((f) => f.id !== advice.winner.id);
  const avgOtherDrag = otherFees.length
    ? otherFees.reduce((sum, f) => sum + f.annualDrag, 0) / otherFees.length
    : advice.winner.annualDrag;
  const annualSavingsVsAverage = Math.max(0, avgOtherDrag - advice.winner.annualDrag);

  // x axis: whole years only; on phones every 5 years for long horizons (every 2 from 6 years)
  const narrow = useNarrow();
  const tickStep = narrow ? (years > 10 ? 5 : years > 5 ? 2 : 1) : (years > 15 ? 2 : 1);
  const xTicks = points
    .filter((pt, i) => pt.period === 0 || i === points.length - 1 || (pt.period % periodsPerYear === 0 && (pt.period / periodsPerYear) % tickStep === 0 && years - pt.period / periodsPerYear >= tickStep / 2))
    .map((pt) => pt.label);
  const showCfo = initial > 100_000 || contribution * periodsPerYear > 100_000 || final.value >= 1_000_000;

  const freqLabel = L(FREQUENCIES.find((f) => f.id === frequency)!.label, lang).toLowerCase();
  const colRoute = t(lang, 'Route', 'Trasa', 'Trasa');
  const colFee = t(lang, 'Fee / purchase', 'Poplatok / nákup', 'Poplatek / nákup');
  const colEff = t(lang, 'Effective', 'Efektívny', 'Efektivní');
  const colDrag = t(lang, 'Annual drag', 'Ročná záťaž', 'Roční zátěž');
  const colNet = t(lang, 'Invested after fees per €1,000', 'Investované po poplatkoch na 1 000 €', 'Investováno po poplatcích na 1 000 €');
  const initialLabel = t(lang, 'Initial lump sum', 'Počiatočná jednorazová suma', 'Počáteční jednorázová částka');
  const contribLabel = t(lang, 'Contribution per period', 'Suma na jedno obdobie', 'Částka na jedno období');

  return (
    <div className="text-ink">
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* controls */}
        <div className="min-w-0 space-y-6 rounded-2xl border border-line bg-panel p-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label className="text-ink-muted">{initialLabel}</Label>
              <AmountField value={initial} min={INITIAL_LIMITS.min} max={INITIAL_LIMITS.max} label={initialLabel} lang={lang} onCommit={setInitial} />
            </div>
            <Slider
              value={[scaleIndex(INITIAL_SCALE, initial)]}
              onValueChange={([i]) => setInitial(INITIAL_SCALE[i])}
              min={0}
              max={INITIAL_SCALE.length - 1}
              step={1}
              aria-label={initialLabel}
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label className="text-ink-muted">{contribLabel}</Label>
              <AmountField value={contribution} min={contribLimits.min} max={contribLimits.max} label={contribLabel} lang={lang} onCommit={setContribution} />
            </div>
            <Slider
              value={[scaleIndex(contribScale, contribution)]}
              onValueChange={([i]) => setContribution(contribScale[i])}
              min={0}
              max={contribScale.length - 1}
              step={1}
              aria-label={contribLabel}
            />
          </div>

          <div>
            <Label className="mb-2 block text-ink-muted">{t(lang, 'Frequency', 'Frekvencia', 'Frekvence')}</Label>
            <div className="flex gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => changeFrequency(f.id)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    frequency === f.id
                      ? 'border-bitcoin bg-bitcoin text-black'
                      : 'border-line-strong text-ink-muted hover:border-bitcoin/50 hover:text-ink'
                  }`}
                >
                  {L(f.label, lang)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-ink-muted">{t(lang, 'Horizon', 'Horizont', 'Horizont')}</Label>
              <span className="text-sm font-semibold text-bitcoin">{years} {t(lang, 'years', 'rokov', 'let')}</span>
            </div>
            <Slider value={[years]} onValueChange={([v]) => setYears(v)} min={YEARS_LIMITS.min} max={YEARS_LIMITS.max} step={1} aria-label={t(lang, 'Horizon in years', 'Horizont v rokoch', 'Horizont v letech')} />
          </div>

          <div>
            <Label className="mb-2 block text-ink-muted">{t(lang, 'Annual return assumption', 'Predpokladaný ročný výnos', 'Předpokládaný roční výnos')}</Label>
            <div className="flex flex-col gap-2" role="radiogroup">
              {RETURN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={preset === p.id}
                  onClick={() => setPreset(p.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                    preset === p.id
                      ? 'border-bitcoin bg-bitcoin text-black'
                      : 'border-line-strong text-ink-muted hover:border-bitcoin/50 hover:text-ink'
                  }`}
                >
                  {tv(lang, '{0}: {1}/yr', '{0}: {1}/rok', '{0}: {1}/rok', [L(p.label, lang), pct((p.annual * 100).toFixed(0), lang)])}
                  {p.hypothetical && ' '}
                  {p.hypothetical && (
                    <span className=" text-xs font-normal opacity-80">{t(lang, '(hypothetical)', '(hypotetický)', '(hypotetický)')}</span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
              <Calculator className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bitcoin" />
              {t(lang,
                "Scenarios, not forecasts. Not investment advice. Past performance doesn't guarantee future results.",
                'Scenáre, nie predpovede. Nejde o investičné poradenstvo. Minulá výkonnosť nezaručuje budúce výsledky.',
                'Scénáře, ne předpovědi. Nejde o investiční poradenství. Minulá výkonnost nezaručuje budoucí výsledky.')}
            </p>
          </div>
        </div>

        {/* projection */}
        <div className="min-w-0 rounded-2xl border border-line bg-panel p-5">
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-ink-muted">{t(lang, 'Total invested', 'Celkovo investované', 'Celkově investováno')}</div>
              <div className="mt-1 break-words text-lg font-bold text-ink sm:text-xl">{eurStat(final.invested)}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-ink-muted">{t(lang, 'Projected value', 'Predpokladaná hodnota', 'Předpokládaná hodnota')}</div>
              <div className="mt-1 break-words text-lg font-bold text-bitcoin sm:text-xl">{eurStat(final.value)}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-ink-muted">{t(lang, 'Multiple', 'Násobok', 'Násobek')}</div>
              <div className="mt-1 break-words text-lg font-bold text-ink sm:text-xl">{fmtNum(multiple, 1, lang)}×</div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F7931A" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#F7931A" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" ticks={xTicks} interval={0} tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => eurCompact(v)}
                  width={68}
                />
                <Tooltip
                  contentStyle={{
                    background: '#17171a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(value: number, name: string) => [eur(value), name === 'value' ? t(lang, 'Projected value', 'Predpokladaná hodnota', 'Předpokládaná hodnota') : t(lang, 'Invested', 'Investované', 'Investováno')]}
                />
                <Area type="monotone" dataKey="value" stroke="#F7931A" strokeWidth={2} fill="url(#gv)" name="value" />
                <Area type="monotone" dataKey="invested" stroke="#52525b" strokeWidth={1.5} fill="transparent" strokeDasharray="5 4" name="invested" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-right text-[11px] text-ink-muted">
            {t(lang, 'Orange = projected value · dashed = your total invested', 'Oranžová = predpokladaná hodnota · prerušovaná = celkovo investované', 'Oranžová = předpokládaná hodnota · přerušovaná = celkově investováno')}
          </p>
          <ShareResult
            lang={lang}
            tool="stacking"
            className="mt-3 flex flex-col items-end"
            getUrl={() => stateUrl({ initial, contribution, frequency, years, scenario: preset }).toString()}
          />
        </div>
      </div>

      {/* Virtuse CFO, only for larger plans */}
      {showCfo && (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-line-strong bg-panel p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-ink">
            {tv(lang,
              'Planning a larger allocation? Virtuse CFO · Verdict: check for free what you left out of your decision. The CFO then tracks fees and risks. Verdict and the fee audit are free from 1 November. Paid plans from January: {0}/month or {1}/year.',
              'Plánujete väčšiu alokáciu? Virtuse CFO · Verdict: skontrolujte zadarmo, čo ste vo svojej úvahe vynechali. CFO potom sleduje poplatky a riziká. Verdict aj audit poplatkov sú zadarmo od 1. novembra. Platené plány od januára: {0}/mesiac alebo {1}/rok.',
              'Plánujete větší alokaci? Virtuse CFO · Verdict: zkontrolujte zdarma, co jste ve své úvaze vynechali. CFO pak sleduje poplatky a rizika. Verdict i audit poplatků jsou zdarma od 1. listopadu. Placené plány od ledna: {0}/měsíc nebo {1}/rok.',
              [fmtEur(9, 0, lang), fmtEur(90, 0, lang)])}
          </p>
          <a
            href={cfoHref(lang)}
            data-cta="cfo"
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-white/30 hover:bg-panel-hover"
          >
            {t(lang, 'Get notified', 'Dajte mi vedieť', 'Dejte mi vědět')} <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* fee comparison */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 rounded-2xl border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {t(lang, 'Fee arbitrage', 'Porovnanie poplatkov', 'Porovnání poplatků')} · {eur(contribution)} {freqLabel}
          </h2>

          {/* header row (wide screens); on phones each row is a card with its own labels */}
          <div className="mt-4 hidden grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_1.2fr_auto] gap-3 border-b border-line pb-2 text-xs text-ink-muted md:grid">
            <div>{colRoute}</div>
            <div>{colFee}</div>
            <div>{colEff}</div>
            <div>{colDrag}</div>
            <div className="text-right">{colNet}</div>
            <div className="w-28" />
          </div>
          <div className="mt-3 space-y-3 md:mt-0 md:space-y-0">
            {fees.map((f, i) => (
              <div
                key={f.id}
                className={`grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-line p-4 text-sm md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_1.2fr_auto] md:items-center md:rounded-none md:border-0 md:border-b md:px-0 md:py-3 ${
                  i === 0 ? 'bg-bitcoin/5' : ''
                }`}
              >
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <div className="flex items-center gap-2 font-medium text-ink">
                    {i === 0 && <Trophy className="h-3.5 w-3.5 shrink-0 text-bitcoin" />}
                    {f.partner}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                    {L(f.note, lang)}
                    {' · '}
                    <a href={f.source} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
                      {t(lang, 'Source', 'Zdroj', 'Zdroj')}
                    </a>
                    , {L(FEES_CHECKED, lang)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-ink-muted md:hidden">{colFee}</div>
                  <div className="text-ink">{eur(f.costPerPurchase)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-ink-muted md:hidden">{colEff}</div>
                  <div className="text-ink">{pct(fmtNum(f.effectivePct * 100, 2, lang), lang)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-ink-muted md:hidden">{colDrag}</div>
                  <div className="text-ink">{eur(f.annualDrag)}</div>
                </div>
                <div className="md:text-right">
                  <div className="text-[11px] text-ink-muted md:hidden">{colNet}</div>
                  <div className="font-semibold text-bitcoin">{fmtEur(f.netPer1000, 2, lang)}</div>
                </div>
                <div className="col-span-2 md:col-span-1 md:w-28">
                  <a
                    href={withUtm(f.url, f.id)}
                    target="_blank"
                    rel="sponsored noopener"
                    onClick={() => trackRouteClick(f.id)}
                    className={`${PRIMARY_CTA} w-full px-3 py-2 text-xs`}
                  >
                    {tv(lang, `Open {0}`, `Otvoriť {0}`, `Otevřít {0}`, [f.partner])} <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                <PartnerLinkNote lang={lang} className="col-span-2 md:col-span-6 md:text-right" />
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            {t(lang,
              '"Invested after fees per €1,000" = how many euros of every €1,000 actually buy Bitcoin after the route\'s fee.',
              '„Investované po poplatkoch na 1 000 €“ = koľko eur z každých 1 000 € skutočne kúpi Bitcoin po odpočítaní poplatku trasy.',
              '„Investováno po poplatcích na 1 000 €“ = kolik eur z každých 1 000 € skutečně koupí Bitcoin po odečtení poplatku trasy.')}{' '}
            {withSlot(
              t(lang,
                'Spreads are not included. For total cost (fee + estimated spread) see the {0}.',
                'Spready nie sú zahrnuté. Celkové náklady (poplatok + odhadovaný spread) nájdete v {0}.',
                'Spready nejsou zahrnuty. Celkové náklady (poplatek + odhadovaný spread) najdete v {0}.'),
              <a href={FEE_INDEX_PATH[lang]} className="underline underline-offset-2 hover:text-ink">
                {t(lang, 'Fee Index', 'indexe poplatkov', 'indexu poplatků')}
              </a>,
            )}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            {t(lang,
              "Virtuse may earn a referral fee. It doesn't change the results.",
              'Virtuse môže dostať odmenu za odporúčanie. Výsledky to nemení.',
              'Virtuse může dostat odměnu za doporučení. Výsledky to nemění.')}
          </p>
        </div>

        {/* lowest fee */}
        <div className="flex flex-col rounded-2xl border border-bitcoin/30 bg-bitcoin/5 p-5">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-bitcoin" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-bitcoin">{t(lang, 'Lowest fee at your amount', 'Najnižší poplatok pri vašej sume', 'Nejnižší poplatek při vaší částce')}</h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-ink">{advice.winner.partner}</span>
            <Badge className="bg-bitcoin text-black hover:bg-bitcoin">{pct(fmtNum(advice.winner.effectivePct * 100, 2, lang), lang)} {t(lang, 'eff.', 'ef.', 'ef.')}</Badge>
          </div>
          <ul className="mt-3 flex-1 space-y-2">
            {advice.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-ink">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-bitcoin" />
                {r}
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-lg border border-line bg-black/30 p-3 text-xs text-ink-muted">
            {annualSavingsVsAverage > 0 ? (
              <>
                {t(lang, 'Staying on the cheapest route saves you', 'Zotrvaním na najlacnejšej trase ušetríte', 'Setrváním na nejlevnější trase ušetříte')}{' '}
                <span className="font-semibold text-bitcoin">{eur(annualSavingsVsAverage)}</span>{' '}
                {t(lang, 'per year in fees vs the average of the other routes.', 'ročne na poplatkoch oproti priemeru ostatných trás.', 'ročně na poplatcích oproti průměru ostatních tras.')}
              </>
            ) : (
              <>
                {t(lang,
                  'Every route above costs the same or more than this one: there is nothing left to save by switching.',
                  'Každá trasa vyššie stojí rovnako alebo viac než táto: zmenou už nič neušetríte.',
                  'Každá trasa výše stojí stejně nebo víc než tato: změnou už nic neušetříte.')}
              </>
            )}
          </div>
          <a
            href={withUtm(advice.winner.url, advice.winner.id)}
            target="_blank"
            rel="sponsored noopener"
            onClick={() => trackRouteClick(advice.winner.id)}
            className={`${PRIMARY_CTA} mt-4`}
          >
            {tv(lang, `Open {0}`, `Otvoriť {0}`, `Otevřít {0}`, [advice.winner.partner])} <ArrowUpRight className="h-4 w-4" />
          </a>
          <PartnerLinkNote lang={lang} className="mt-2" />
        </div>
      </div>

      <ResultCaptureForm
        lang={lang}
        source="stacking"
        buildPayload={() => ({
          initial,
          contribution,
          frequency,
          years,
          returnPct: Math.round(annualReturn * 1000) / 10,
          invested: Math.round(final.invested),
          projected: Math.round(final.value),
          lowestFeePartner: advice.winner.id,
        })}
      />
    </div>
  );
}
