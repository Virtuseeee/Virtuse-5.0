import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Bot, Calculator, Trophy } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  bestRoute,
  compareFees,
  eur,
  eurCompact,
  FREQUENCIES,
  project,
  RETURN_PRESETS,
} from '@/lib/stacking';
import type { FrequencyId } from '@/lib/stacking';
import { getLang, t, tv, L, fmtEur, fmtNum, pct } from '@/lib/i18n';
import { ResultCaptureForm } from '@/components/CaptureForm';

// ── Deep-link presets ────────────────────────────────────────
// Concierge's buy-flow result card links here with ?amount=<bucket>,
// where <bucket> is one of Concierge's own AMOUNTS ids (s/m/l/xl).
// Stacking has no concept of "total portfolio size" (its sliders are
// lump sum + recurring contribution), so a bucket maps to a sensible
// starting point on those sliders rather than an exact carried-over
// number — the visitor can still drag either slider from there.
const AMOUNT_BUCKET_PRESETS: Record<string, { initial: number; contribution: number }> = {
  s: { initial: 0, contribution: 50 }, // < €1,000
  m: { initial: 500, contribution: 100 }, // €1,000 – 10,000 (site default)
  l: { initial: 5000, contribution: 500 }, // €10,000 – 100,000
  xl: { initial: 10_000, contribution: 1_000 }, // > €100,000 (both sliders' max)
};

function readAmountBucket(): { initial: number; contribution: number } | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const bucket = params.get('amount');
    if (bucket && bucket in AMOUNT_BUCKET_PRESETS) return AMOUNT_BUCKET_PRESETS[bucket];
  } catch {
    /* no-op — fall through to defaults */
  }
  return null;
}

// ── UTM + click tracking ─────────────────────────────────────
// Same convention as ConciergeChat.tsx's withUtm()/trackPartnerClick():
// utm_medium is inherited from the page/iframe Stacking was opened
// with (?utm_medium=page|concierge, set by virtuse.com or by the
// Concierge deep link), so a route click always carries where the
// visitor entered Stacking from.
function withUtm(url: string, routeId: string): string {
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
    // eslint-disable-next-line no-console
    console.log('[stacking] stacking_route_click', routeId);
  } catch {
    /* tracking must never block navigation */
  }
}

export default function Stacking() {
  const lang = useMemo(getLang, []);
  const deepLinkPreset = useMemo(readAmountBucket, []);
  const [initial, setInitial] = useState(deepLinkPreset?.initial ?? 500);
  const [contribution, setContribution] = useState(deepLinkPreset?.contribution ?? 100);
  const [frequency, setFrequency] = useState<FrequencyId>('monthly');
  const [years, setYears] = useState(10);
  const [preset, setPreset] = useState('moderate');

  const periodsPerYear = FREQUENCIES.find((f) => f.id === frequency)!.periodsPerYear;
  const annualReturn = RETURN_PRESETS.find((p) => p.id === preset)!.annual;

  const points = useMemo(
    () => project({ initial, contribution, periodsPerYear, years, annualReturn }, lang),
    [initial, contribution, periodsPerYear, years, annualReturn, lang],
  );

  const final = points[points.length - 1];
  const fees = useMemo(() => compareFees(contribution, periodsPerYear), [contribution, periodsPerYear]);
  const advice = useMemo(() => bestRoute(contribution, periodsPerYear, lang), [contribution, periodsPerYear, lang]);
  // What the copy below actually claims: the winner's annual fee vs the
  // *average* annual fee of every other row — not the winner's own fee
  // in isolation (that was the bug: with a 0%-fee winner it read as
  // "saves you €0", when the real saving is what the other routes cost).
  const otherFees = fees.filter((f) => f.id !== advice.winner.id);
  const avgOtherDrag = otherFees.length
    ? otherFees.reduce((sum, f) => sum + f.annualDrag, 0) / otherFees.length
    : advice.winner.annualDrag;
  const annualSavingsVsAverage = Math.max(0, avgOtherDrag - advice.winner.annualDrag);

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-zinc-100">
      {/* header */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bitcoin text-lg font-bold text-black">
              ₿
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-wide text-white">
                VIRTUSE <span className="text-zinc-500">·</span>{' '}
                <span className="text-bitcoin">Stacking Strategist</span>
              </div>
              <div className="text-xs text-zinc-500">{t(lang, 'Layer 2 · Module 03', 'Layer 2 · Modul 03', 'Layer 2 · Modul 03')}</div>
            </div>
          </div>
          <a href="concierge.html">
            <Button
              variant="outline"
              size="sm"
              className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Partner Finder
            </Button>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            {t(lang, 'Your DCA plan,', 'Váš DCA plán,', 'Váš DCA plán,')} <span className="text-bitcoin">{t(lang, 'priced across every partner.', 'ocenený naprieč všetkými partnermi.', 'oceněný napříč všemi partnery.')}</span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {t(lang,
              "Set your stacking rhythm, see the long-term projection, and let the fee arbitrage table find the cheapest route per purchase – then automate it with 21bitcoin's Auto-Invest plan or a dedicated DCA bot like RevenueBot.",
              'Nastavte si rytmus dokupovania, pozrite sa na dlhodobú projekciu a nechajte tabuľku poplatkov nájsť najlacnejšiu trasu na nákup – potom to zautomatizujte plánom Auto-Invest od 21bitcoin alebo špecializovaným DCA botom ako RevenueBot.',
              'Nastavte si rytmus dokupování, podívejte se na dlouhodobou projekci a nechte tabulku poplatků najít nejlevnější trasu na nákup – pak to zautomatizujte plánem Auto-Invest od 21bitcoin nebo specializovaným DCA botem jako RevenueBot.')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* controls */}
          <div className="space-y-6 rounded-2xl border border-white/10 bg-[#111113] p-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-zinc-400">{t(lang, 'Initial lump sum', 'Počiatočná jednorazová suma', 'Počáteční jednorázová částka')}</Label>
                <span className="text-sm font-semibold text-bitcoin">{eur(initial)}</span>
              </div>
              <Slider value={[initial]} onValueChange={([v]) => setInitial(v)} min={0} max={10_000} step={100} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-zinc-400">{t(lang, 'Contribution per period', 'Suma na jedno obdobie', 'Částka na jedno období')}</Label>
                <span className="text-sm font-semibold text-bitcoin">{eur(contribution)}</span>
              </div>
              <Slider value={[contribution]} onValueChange={([v]) => setContribution(v)} min={10} max={1_000} step={10} />
            </div>

            <div>
              <Label className="mb-2 block text-zinc-400">{t(lang, 'Frequency', 'Frekvencia', 'Frekvence')}</Label>
              <div className="flex gap-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFrequency(f.id)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      frequency === f.id
                        ? 'border-bitcoin bg-bitcoin text-black'
                        : 'border-white/15 text-zinc-400 hover:border-bitcoin/50 hover:text-white'
                    }`}
                  >
                    {L(f.label, lang)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-zinc-400">{t(lang, 'Horizon', 'Horizont', 'Horizont')}</Label>
                <span className="text-sm font-semibold text-bitcoin">{years} {t(lang, 'years', 'rokov', 'let')}</span>
              </div>
              <Slider value={[years]} onValueChange={([v]) => setYears(v)} min={1} max={25} step={1} />
            </div>

            <div>
              <Label className="mb-2 block text-zinc-400">{t(lang, 'Annual return assumption', 'Predpokladaný ročný výnos', 'Předpokládaný roční výnos')}</Label>
              <div className="flex gap-2">
                {RETURN_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      preset === p.id
                        ? 'border-bitcoin bg-bitcoin text-black'
                        : 'border-white/15 text-zinc-400 hover:border-bitcoin/50 hover:text-white'
                    }`}
                  >
                    {L(p.label, lang)}
                    <span className="block text-[10px] opacity-70">{pct((p.annual * 100).toFixed(0), lang)}/{t(lang, 'yr', 'rok', 'rok')}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-zinc-400">
              <Calculator className="mb-2 h-4 w-4 text-bitcoin" />
              {preset === 'ark'
                ? t(lang,
                    'ARK-style scenario (39 %/yr) mirrors the research cited on virtuse.com. Treat it as an optimistic bound, not a promise.',
                    'Scenár v štýle ARK (39 %/rok) vychádza z výskumu citovaného na virtuse.com. Berte ho ako optimistický horný odhad, nie sľub.',
                    'Scénář ve stylu ARK (39 %/rok) vychází z výzkumu citovaného na virtuse.com. Berte ho jako optimistický horní odhad, ne slib.')
                : t(lang,
                    'Projection compounds your contribution at the chosen rate every period. Past performance never guarantees future results.',
                    'Projekcia zložene zhodnocuje váš vklad zvolenou sadzbou v každom období. Minulá výkonnosť nikdy nezaručuje budúce výsledky.',
                    'Projekce složeně zhodnocuje váš vklad zvolenou sazbou v každém období. Minulá výkonnost nikdy nezaručuje budoucí výsledky.')}
            </div>
          </div>

          {/* projection */}
          <div className="min-w-0 rounded-2xl border border-white/10 bg-[#111113] p-5">
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">{t(lang, 'Total invested', 'Celkovo investované', 'Celkově investováno')}</div>
                <div className="mt-1 text-xl font-bold text-white">{eur(final.invested)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">{t(lang, 'Projected value', 'Predpokladaná hodnota', 'Předpokládaná hodnota')}</div>
                <div className="mt-1 text-xl font-bold text-bitcoin">{eur(final.value)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">{t(lang, 'Multiple', 'Násobok', 'Násobek')}</div>
                <div className="mt-1 text-xl font-bold text-white">
                  {fmtNum(final.value / final.invested, 1, lang)}×
                </div>
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
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => eurCompact(v)}
                    width={52}
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
            <p className="mt-2 text-right text-[11px] text-zinc-600">
              {t(lang, 'Orange = projected value · dashed = your total invested', 'Oranžová = predpokladaná hodnota · prerušovaná = celkovo investované', 'Oranžová = předpokládaná hodnota · přerušovaná = celkově investováno')}
            </p>
          </div>
        </div>

        {/* fee arbitrage */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 rounded-2xl border border-white/10 bg-[#111113] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              {t(lang, 'Fee arbitrage', 'Porovnanie poplatkov', 'Porovnání poplatků')} · {eur(contribution)} {L(FREQUENCIES.find((f) => f.id === frequency)!.label, lang).toLowerCase()}
            </h2>
            <div className="mt-4 overflow-x-auto">
              <Table className="[&_th]:whitespace-normal">
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-zinc-500">{t(lang, 'Route', 'Trasa', 'Trasa')}</TableHead>
                    <TableHead className="text-zinc-500">{t(lang, 'Fee / purchase', 'Poplatok / nákup', 'Poplatek / nákup')}</TableHead>
                    <TableHead className="text-zinc-500">{t(lang, 'Effective', 'Efektívny', 'Efektivní')}</TableHead>
                    <TableHead className="text-zinc-500">{t(lang, 'Annual drag', 'Ročná záťaž', 'Roční zátěž')}</TableHead>
                    <TableHead className="text-right text-zinc-500">{t(lang, 'BTC per €1,000', 'BTC na 1 000 €', 'BTC na 1 000 €')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((f, i) => (
                    <TableRow key={f.id} className={`border-white/10 ${i === 0 ? 'bg-bitcoin/5' : 'hover:bg-white/5'}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {i === 0 && <Trophy className="h-3.5 w-3.5 text-bitcoin" />}
                          <div>
                            <div className="font-medium text-white">
                              {f.partner} <span className="text-zinc-500">·</span> {L(f.method, lang)}
                            </div>
                            <div className="text-[11px] text-zinc-500">{L(f.note, lang)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-300">{eur(f.costPerPurchase)}</TableCell>
                      <TableCell className="text-zinc-300">{pct(fmtNum(f.effectivePct * 100, 2, lang), lang)}</TableCell>
                      <TableCell className="text-zinc-300">{eur(f.annualDrag)}</TableCell>
                      <TableCell className="text-right font-semibold text-bitcoin">
                        {fmtEur(f.btcPer1000, 2, lang)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
              {t(lang,
                '"BTC per €1,000" = how much bitcoin actually lands in your wallet per €1,000 invested after all route fees. Illustrative fee schedule – production wires live partner quotes.',
                '„BTC na 1 000 €" = koľko bitcoinu skutočne pristane vo vašej peňaženke na 1 000 € investovaných po odpočítaní poplatkov trasy. Ilustratívny cenník – produkčná verzia napojí živé ceny partnerov.',
                '„BTC na 1 000 €" = kolik bitcoinu skutečně přistane ve vaší peněžence na 1 000 € investovaných po odečtení poplatků trasy. Ilustrativní ceník – produkční verze napojí živé ceny partnerů.')}
            </p>
          </div>

          {/* route advice */}
          <div className="flex flex-col rounded-2xl border border-bitcoin/30 bg-bitcoin/5 p-5">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-bitcoin" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-bitcoin">{t(lang, 'Lowest fee at your amount', 'Najnižší poplatok pri vašej sume', 'Nejnižší poplatek při vaší částce')}</h2>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-lg font-bold text-white">
                {advice.winner.partner} · {L(advice.winner.method, lang)}
              </span>
              <Badge className="bg-bitcoin text-black hover:bg-bitcoin">{pct(fmtNum(advice.winner.effectivePct * 100, 2, lang), lang)} {t(lang, 'eff.', 'ef.', 'ef.')}</Badge>
            </div>
            <ul className="mt-3 flex-1 space-y-2">
              {advice.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-zinc-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-bitcoin" />
                  {r}
                </li>
              ))}
              {advice.breakEven && (
                <li className="flex items-start gap-2 text-xs leading-relaxed text-zinc-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-bitcoin" />
                  {advice.breakEven}
                </li>
              )}
            </ul>
            <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
              {annualSavingsVsAverage > 0 ? (
                <>
                  {t(lang, 'Staying on the cheapest route saves you', 'Zotrvaním na najlacnejšej trase ušetríte', 'Setrváním na nejlevnější trase ušetříte')}{' '}
                  <span className="font-semibold text-bitcoin">{eur(annualSavingsVsAverage)}</span>{' '}
                  {t(lang, 'per year in fees vs the average of the other routes.', 'ročne na poplatkoch oproti priemeru ostatných trás.', 'ročně na poplatcích oproti průměru ostatních tras.')}
                </>
              ) : (
                <>
                  {t(lang,
                    'Every route above costs the same or more than this one — there is nothing left to save by switching.',
                    'Každá trasa vyššie stojí rovnako alebo viac než táto — zmenou už nič neušetríte.',
                    'Každá trasa výše stojí stejně nebo víc než tato — změnou už nic neušetříte.')}
                </>
              )}
            </div>
            <a
              href={withUtm(advice.winner.url, advice.winner.id)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackRouteClick(advice.winner.id)}
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-bitcoin px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
            >
              {tv(lang, `Open {0}`, `Otvoriť {0}`, `Otevřít {0}`, [advice.winner.partner])}{' '}
              <ArrowUpRight className="h-4 w-4" />
            </a>
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

        <footer className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-zinc-600">
          {t(lang,
            'Stacking Strategist – Virtuse Layer 2, Module 03. Fees are illustrative for the prototype; projections are mathematical scenarios, not promises. Not financial advice. Virtuse never holds your keys – purchases settle to the wallet you choose.',
            'Stacking Strategist – Virtuse Layer 2, Modul 03. Poplatky sú v prototype ilustratívne; projekcie sú matematické scenáre, nie sľuby. Nejde o finančné poradenstvo. Virtuse nikdy nedrží vaše kľúče – nákupy smerujú do peňaženky podľa vášho výberu.',
            'Stacking Strategist – Virtuse Layer 2, Modul 03. Poplatky jsou v prototypu ilustrativní; projekce jsou matematické scénáře, ne sliby. Nejde o finanční poradenství. Virtuse nikdy nedrží vaše klíče – nákupy směřují do peněženky podle vašeho výběru.')}
        </footer>
      </main>
    </div>
  );
}
