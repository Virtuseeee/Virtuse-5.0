import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Landmark,
  Scale,
  ShieldAlert,
} from 'lucide-react';
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
  analyzeLoan,
  eur,
  eurCompact,
  loanFacts,
  MARGIN_CALL_LTV,
  TAX_PRESETS,
} from '@/lib/loan';
import { getLang, t, tv, L, fmtNum, fmtNumShort, pct } from '@/lib/i18n';
import { ResultCaptureForm } from '@/components/CaptureForm';

// ── Deep-link presets ────────────────────────────────────────
// Concierge's loan-flow result card links here with ?amount=<bucket>,
// the same AMOUNTS bucket id (s/m/l/xl) used by the Stacking deep link
// — mapped to a sensible starting "cash needed" figure on this page's
// slider (1,000–250,000) rather than an exact carried-over number.
const AMOUNT_BUCKET_PRESETS: Record<string, number> = {
  s: 2_000, // < €1,000
  m: 10_000, // €1,000 – 10,000
  l: 50_000, // €10,000 – 100,000
  xl: 150_000, // > €100,000
};

function readAmountBucket(): number | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const bucket = params.get('amount');
    if (bucket && bucket in AMOUNT_BUCKET_PRESETS) return AMOUNT_BUCKET_PRESETS[bucket];
  } catch {
    /* no-op — fall through to default */
  }
  return null;
}

// ── Click tracking ───────────────────────────────────────
function trackLinkClick(target: string) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: 'loan_link_click', target });
    // eslint-disable-next-line no-console
    console.log('[loan] loan_link_click', target);
  } catch {
    /* tracking must never block navigation */
  }
}

export default function Loan() {
  const lang = useMemo(getLang, []);
  const deepLinkCash = useMemo(readAmountBucket, []);
  const [cashNeeded, setCashNeeded] = useState(deepLinkCash ?? 25_000);
  const [btcHoldings, setBtcHoldings] = useState(1);
  const [btcPrice, setBtcPrice] = useState(105_000);
  const [ltv, setLtv] = useState(0.4);
  const [apr, setApr] = useState(0.06);
  const [years, setYears] = useState(3);
  const [taxPreset, setTaxPreset] = useState(({ cs: 'cz', de: 'de', pl: 'pl', hu: 'hu', fr: 'fr', es: 'es', uk: 'custom', ru: 'custom' } as Record<string, string>)[lang] ?? 'sk');
  const [gainRatio, setGainRatio] = useState(0.5);

  // Custom: visitors from countries outside the list set their own rate (uk/ru start here).
  const [customRate, setCustomRate] = useState(0.19);
  const taxRate = taxPreset === 'custom' ? customRate : TAX_PRESETS.find((tp) => tp.id === taxPreset)!.rate;

  const a = useMemo(
    () =>
      analyzeLoan({ cashNeeded, btcHoldings, btcPrice, ltv, apr, years, taxRate, gainRatio }),
    [cashNeeded, btcHoldings, btcPrice, ltv, apr, years, taxRate, gainRatio],
  );
  const facts = useMemo(
    () => loanFacts({ cashNeeded, btcHoldings, btcPrice, ltv, apr, years, taxRate, gainRatio }, a, lang),
    [cashNeeded, btcHoldings, btcPrice, ltv, apr, years, taxRate, gainRatio, a, lang],
  );

  const riskPct = a.distanceToLiquidation * 100;
  const riskColor = riskPct < 15 ? '#f87171' : riskPct < 30 ? '#F7931A' : '#34d399';

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-zinc-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bitcoin text-lg font-bold text-black">
              ₿
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-wide text-white">
                VIRTUSE <span className="text-zinc-500">·</span>{' '}
                <span className="text-bitcoin">{t(lang, 'Loan & Liquidity Copilot', 'Pôžičkový a likviditný asistent', 'Půjčkový a likviditní asistent')}</span>
              </div>
              <div className="text-xs text-zinc-500">{t(lang, 'Layer 2 · Module 04', 'Layer 2 · Modul 04', 'Layer 2 · Modul 04')}</div>
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
            {t(lang, 'Sell your bitcoin, or', 'Predať bitcoin, alebo', 'Prodat bitcoin, nebo')} <span className="text-bitcoin">{t(lang, 'borrow against it?', 'požičať si oproti nemu?', 'půjčit si oproti němu?')}</span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {t(lang,
              'Both options side by side, with your own numbers. Compare the tax bill and lost upside of selling against the interest and liquidation risk of a Bitcoin-backed loan.',
              'Obe možnosti vedľa seba, s vašimi vlastnými číslami. Porovnajte daňový výmer a stratený potenciálny zisk pri predaji oproti úroku a riziku likvidácie pri pôžičke krytej Bitcoinom.',
              'Obě možnosti vedle sebe, s vašimi vlastními čísly. Porovnejte daňový výměr a ztracený potenciální zisk při prodeji oproti úroku a riziku likvidace u půjčky kryté Bitcoinem.')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* controls */}
          <div className="min-w-0 space-y-5 rounded-2xl border border-white/10 bg-[#111113] p-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-zinc-400">{t(lang, 'Cash needed', 'Potrebná hotovosť', 'Potřebná hotovost')}</Label>
                <span className="text-sm font-semibold text-bitcoin">{eur(cashNeeded)}</span>
              </div>
              <Slider value={[cashNeeded]} onValueChange={([v]) => setCashNeeded(v)} min={1_000} max={250_000} step={1_000} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-zinc-400">{t(lang, 'Your BTC holdings', 'Vaše BTC', 'Vaše BTC')}</Label>
                <span className="text-sm font-semibold text-bitcoin">{fmtNum(btcHoldings, 2, lang)} BTC</span>
              </div>
              <Slider value={[btcHoldings]} onValueChange={([v]) => setBtcHoldings(v)} min={0.1} max={10} step={0.1} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-zinc-400">{t(lang, 'BTC price', 'Cena BTC', 'Cena BTC')}</Label>
                <span className="text-sm font-semibold text-bitcoin">{eur(btcPrice)}</span>
              </div>
              <Slider value={[btcPrice]} onValueChange={([v]) => setBtcPrice(v)} min={20_000} max={300_000} step={5_000} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-zinc-400">{t(lang, 'Loan-to-value', 'Loan-to-value', 'Loan-to-value')}</Label>
                <span className="text-sm font-semibold text-bitcoin">{pct((ltv * 100).toFixed(0), lang)}</span>
              </div>
              <Slider value={[ltv * 100]} onValueChange={([v]) => setLtv(v / 100)} min={25} max={65} step={1} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-zinc-400">{t(lang, 'Interest rate (APR)', 'Úroková sadzba (APR)', 'Úroková sazba (APR)')}</Label>
                <span className="text-sm font-semibold text-bitcoin">{pct((apr * 100).toFixed(0), lang)}</span>
              </div>
              <Slider value={[apr * 100]} onValueChange={([v]) => setApr(v / 100)} min={4} max={12} step={0.5} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-zinc-400">{t(lang, 'Horizon', 'Horizont', 'Horizont')}</Label>
                <span className="text-sm font-semibold text-bitcoin">{years} {t(lang, 'years', 'rokov', 'let')}</span>
              </div>
              <Slider value={[years]} onValueChange={([v]) => setYears(v)} min={1} max={10} step={1} />
            </div>

            <div>
              <Label className="mb-2 block text-zinc-400">{t(lang, 'Tax jurisdiction (gain rate)', 'Daňová jurisdikcia (sadzba zo zisku)', 'Daňová jurisdikce (sazba ze zisku)')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {TAX_PRESETS.map((tp) => (
                  <button
                    key={tp.id}
                    onClick={() => setTaxPreset(tp.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      taxPreset === tp.id
                        ? 'border-bitcoin bg-bitcoin text-black'
                        : 'border-white/15 text-zinc-400 hover:border-bitcoin/50 hover:text-white'
                    }`}
                  >
                    {L(tp.name, lang)} · {pct(fmtNumShort(Math.round((tp.id === 'custom' ? customRate : tp.rate) * 1000) / 10, 1, lang), lang)}
                  </button>
                ))}
              </div>
              {taxPreset === 'custom' && (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-zinc-400">{t(lang, 'Your tax rate on gains', 'Vaša sadzba dane zo zisku', 'Vaše sazba daně ze zisku')}</Label>
                    <span className="text-sm font-semibold text-bitcoin">{pct((customRate * 100).toFixed(0), lang)}</span>
                  </div>
                  <Slider value={[customRate * 100]} onValueChange={([v]) => setCustomRate(v / 100)} min={0} max={50} step={1} />
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-zinc-400">{t(lang, 'Untaxed cost basis share', 'Nezdanená časť obstarávacej ceny', 'Nezdaněná část pořizovací ceny')}</Label>
                <span className="text-sm font-semibold text-bitcoin">{pct(Math.round((1 - gainRatio) * 100), lang)}</span>
              </div>
              <Slider value={[gainRatio * 100]} onValueChange={([v]) => setGainRatio(v / 100)} min={0} max={90} step={5} />
              <p className="mt-1 text-[11px] text-zinc-600">
                {t(lang,
                  'Share of the sold value that is profit (taxed), vs. your original purchase price (not taxed).',
                  'Podiel predanej hodnoty, ktorý je zisk (zdanený), oproti pôvodnej nákupnej cene (nezdanenej).',
                  'Podíl prodané hodnoty, který je zisk (zdaněný), oproti původní nákupní ceně (nezdaněné).')}
              </p>
            </div>
          </div>

          {/* results */}
          <div className="min-w-0 space-y-6">
            {/* risk gauge */}
            <div className="rounded-2xl border border-white/10 bg-[#111113] p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                <ShieldAlert className="h-4 w-4" style={{ color: riskColor }} /> {t(lang, 'Liquidation watch', 'Sledovanie likvidácie', 'Sledování likvidace')}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">{t(lang, 'Collateral', 'Kolaterál', 'Kolaterál')}</div>
                  <div className="mt-1 text-lg font-bold text-white">{fmtNum(a.collateralBtc, 4, lang)} BTC</div>
                  <div className="text-[11px] text-zinc-500">{tv(lang, `locked at {0} % LTV`, `uzamknuté pri {0} % LTV`, `uzamčené při {0} % LTV`, [(ltv * 100).toFixed(0)])}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">{t(lang, 'Margin-call price', 'Cena margin callu', 'Cena margin callu')}</div>
                  <div className="mt-1 text-lg font-bold" style={{ color: riskColor }}>{eur(a.liquidationPrice)}</div>
                  <div className="text-[11px] text-zinc-500">{tv(lang, `at {0} % LTV threshold`, `pri prahu LTV {0} %`, `při prahu LTV {0} %`, [(MARGIN_CALL_LTV * 100).toFixed(0)])}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">{t(lang, 'Headroom', 'Rezerva', 'Rezerva')}</div>
                  <div className="mt-1 text-lg font-bold" style={{ color: riskColor }}>
                    {riskPct > 0 ? tv(lang, `{0} % drop room`, `{0} % priestor na pokles`, `{0} % prostor na pokles`, [riskPct.toFixed(0)]) : t(lang, 'past threshold', 'za prahom', 'za prahem')}
                  </div>
                  <div className="text-[11px] text-zinc-500">{t(lang, 'before margin call', 'do margin callu', 'do margin callu')}</div>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, (a.liquidationPrice / btcPrice) * 100))}%`, background: riskColor }}
                />
              </div>
              <p className="mt-2 text-[11px] text-zinc-600">
                {tv(lang, `Bar: margin-call price relative to current price. Illustrative {0} % threshold – real terms depend on the loan provider.`, `Pruh: cena margin callu voči aktuálnej cene. Ilustratívny prah {0} % – reálne podmienky závisia od poskytovateľa pôžičky.`, `Pruh: cena margin callu vůči aktuální ceně. Ilustrativní práh {0} % – reálné podmínky závisí na poskytovateli půjčky.`, [(MARGIN_CALL_LTV * 100).toFixed(0)])}
              </p>
            </div>

            {/* strategy cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#111113] p-5">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-zinc-400" />
                  <h3 className="text-sm font-semibold text-white">{t(lang, 'If you sell', 'Ak predáte', 'Pokud prodáte')}</h3>
                </div>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-300">
                  <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                    {tv(lang, `Sell {0} BTC → {1}`, `Predáte {0} BTC → {1}`, `Prodáte {0} BTC → {1}`, [fmtNum(a.btcToSell, 4, lang), eur(cashNeeded)])}</li>
                  <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                    {tv(lang, `Tax on gains: −{0}`, `Daň zo zisku: −{0}`, `Daň ze zisku: −{0}`, [eur(a.taxIfSold)])}</li>
                  <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                    {tv(lang, `Cash left: {0}`, `Zostáva hotovosť: {0}`, `Zůstává hotovost: {0}`, [eur(a.cashAfterTax)])}</li>
                  <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                    {t(lang, 'Future upside lost on the sold coins', 'Budúci zisk z predaných mincí je stratený', 'Budoucí zisk z prodaných mincí je ztracen')}</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#111113] p-5">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-zinc-400" />
                  <h3 className="text-sm font-semibold text-white">{t(lang, 'If you borrow (Firefish-style)', 'Ak si požičiate (v štýle Firefish)', 'Pokud si půjčíte (ve stylu Firefish)')}</h3>
                </div>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-300">
                  <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                    {tv(lang, `Receive {0} – keep all {1} BTC`, `Dostanete {0} – ponecháte si všetkých {1} BTC`, `Dostanete {0} – ponecháte si všech {1} BTC`, [eur(cashNeeded), fmtNum(btcHoldings, 2, lang)])}</li>
                  <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                    {t(lang, 'No sale, no immediate capital-gains tax', 'Žiadny predaj, žiadna okamžitá daň zo zisku', 'Žádný prodej, žádná okamžitá daň ze zisku')}</li>
                  <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                    {tv(lang, `Interest: {0}/yr → {1} total`, `Úrok: {0}/rok → spolu {1}`, `Úrok: {0}/rok → celkem {1}`, [eur(a.interestPerYear), eur(a.interestTotal)])}</li>
                  <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: riskColor }} />
                    {tv(lang, `Margin call if BTC falls to {0}`, `Margin call pri poklese BTC na {0}`, `Margin call při poklesu BTC na {0}`, [eur(a.liquidationPrice)])}</li>
                </ul>
              </div>
            </div>

            {/* scenario table */}
            <div className="min-w-0 rounded-2xl border border-white/10 bg-[#111113] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                {tv(lang, `Scenario matrix · net position after {0}y`, `Matica scenárov · čistá pozícia po {0} r.`, `Matice scénářů · čistá pozice po {0} r.`, [years])}
              </h2>
              <div className="mt-4 overflow-x-auto">
                <Table className="[&_th]:whitespace-normal">
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-zinc-500">{t(lang, 'BTC change', 'Zmena BTC', 'Změna BTC')}</TableHead>
                      <TableHead className="text-zinc-500">{t(lang, 'Sell net', 'Čistý zisk – predaj', 'Čistý zisk – prodej')}</TableHead>
                      <TableHead className="text-zinc-500">{t(lang, 'Borrow net', 'Čistý zisk – pôžička', 'Čistý zisk – půjčka')}</TableHead>
                      <TableHead className="text-right text-zinc-500">{t(lang, 'Difference', 'Rozdiel', 'Rozdíl')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {a.scenarios.map((s) => (
                      <TableRow key={s.change} className="border-white/10 hover:bg-white/5">
                        <TableCell className="font-medium text-white">
                          {s.change > 0 ? '+' : ''}{pct((s.change * 100).toFixed(0), lang)}
                        </TableCell>
                        <TableCell className="text-zinc-300">{eurCompact(s.sellNet)}</TableCell>
                        <TableCell className="text-zinc-300">{eurCompact(s.loanNet)}</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-white/10 text-zinc-300 hover:bg-white/10">
                            {s.winner === 'loan' ? t(lang, 'Borrow', 'Pôžička', 'Půjčka') : t(lang, 'Sell', 'Predaj', 'Prodej')} +{eurCompact(s.diff)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* summary: facts only, no verdict */}
            <div
              className={`rounded-2xl border p-5 ${
                facts.risk ? 'border-red-400/30 bg-red-400/5' : 'border-white/15 bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                {facts.risk ? (
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                ) : (
                  <Scale className="h-4 w-4 text-zinc-400" />
                )}
                <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{facts.headline}</h3>
              </div>
              <ul className="mt-3 space-y-2">
                {facts.facts.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-zinc-300">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                    {r}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                {t(lang,
                  'This calculator shows both outcomes and does not recommend either. The decision is yours.',
                  'Kalkulačka ukazuje oba výsledky a neodporúča ani jeden. Rozhodnutie je na vás.',
                  'Kalkulačka ukazuje oba výsledky a nedoporučuje ani jeden. Rozhodnutí je na vás.')}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a
                  href="lending.html"
                  onClick={() => trackLinkClick('loan-partners')}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {t(lang, 'Compare loan partners', 'Porovnať partnerov pre pôžičky', 'Porovnat partnery pro půjčky')} <ArrowUpRight className="h-4 w-4" />
                </a>
                <a
                  href="tax-agent.html"
                  onClick={() => trackLinkClick('tax-rules')}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {t(lang, "Check your country's tax rules", 'Overiť daňové pravidlá vašej krajiny', 'Ověřit daňová pravidla vaší země')} <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <ResultCaptureForm
          lang={lang}
          source="loan"
          buildPayload={() => ({
            cashNeeded,
            btcPrice,
            ltvPct: Math.round(ltv * 1000) / 10,
            aprPct: Math.round(apr * 1000) / 10,
            years,
            taxIfSold: Math.round(a.taxIfSold),
            interestTotal: Math.round(a.interestTotal),
            collateralBtc: Math.round(a.collateralBtc * 1e4) / 1e4,
            liquidationPrice: Math.round(a.liquidationPrice),
          })}
        />

        <footer className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-zinc-600">
          {t(lang,
            'Loan & Liquidity Copilot – Virtuse Layer 2, Module 04. Simplified educational model with illustrative rates and a fixed margin-call threshold – real loan terms depend on the provider. Not financial, tax or legal advice. Virtuse never holds your keys; collateral stays in multisig escrow.',
            'Pôžičkový a likviditný asistent – Virtuse Layer 2, Modul 04. Zjednodušený vzdelávací model s ilustratívnymi sadzbami a fixným prahom margin callu – reálne podmienky pôžičky závisia od poskytovateľa. Nejde o finančné, daňové ani právne poradenstvo. Virtuse nikdy nedrží vaše kľúče; kolaterál ostáva v multisig escrow.',
            'Půjčkový a likviditní asistent – Virtuse Layer 2, Modul 04. Zjednodušený vzdělávací model s ilustrativními sazbami a fixním prahem margin callu – reálné podmínky půjčky závisí na poskytovateli. Nejde o finanční, daňové ani právní poradenství. Virtuse nikdy nedrží vaše klíče; kolaterál zůstává v multisig escrow.')}
        </footer>
      </main>
    </div>
  );
}
