import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  FileText,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  COUNTRY_TAX,
  INHERITANCE_CHECKLIST,
  MULTISIG_KEYS,
  PARTNER_LINKS,
  scoreInheritance,
} from '@/lib/tax';
import { getLang, t, tv, L } from '@/lib/i18n';
import { ResultCaptureForm } from '@/components/CaptureForm';

// ── Deep-link preset ─────────────────────────────────────────
// Concierge's tax/custody-flow result card links here with
// ?country=<id>, the same country id Concierge itself collects
// (both use the same 13 EU countries) — read on load to preselect
// the matching country tab instead of always defaulting to Slovakia.
function readCountryParam(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const country = params.get('country');
    if (country && COUNTRY_TAX.some((c) => c.id === country)) return country;
  } catch {
    /* no-op — fall through to default */
  }
  return null;
}

// ── UTM + click tracking ─────────────────────────────────────
// Same convention as ConciergeChat.tsx / Stacking.tsx / Loan.tsx.
function withUtm(url: string, contentId: string): string {
  try {
    const target = new URL(url, window.location.href);
    const here = new URLSearchParams(window.location.search);
    target.searchParams.set('utm_source', 'tax');
    target.searchParams.set('utm_medium', here.get('utm_medium') || 'page');
    target.searchParams.set('utm_campaign', 'layer2-mvp');
    target.searchParams.set('utm_content', contentId);
    return target.toString();
  } catch {
    return url;
  }
}

function trackPartnerClick(partnerId: string) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: 'tax_partner_click', partner_id: partnerId });
    // eslint-disable-next-line no-console
    console.log('[tax] tax_partner_click', partnerId);
  } catch {
    /* tracking must never block navigation */
  }
}

export default function Tax() {
  const lang = useMemo(getLang, []);
  const deepLinkCountry = useMemo(readCountryParam, []);
  // uk/ru have no country of their own in the list: start with none selected.
  const [countryId, setCountryId] = useState<string | null>(
    deepLinkCountry ?? (lang === 'uk' || lang === 'ru' ? null : ({ cs: 'cz', de: 'de', pl: 'pl', hu: 'hu', fr: 'fr', es: 'es' } as Record<string, string>)[lang] ?? 'sk'),
  );
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const country = COUNTRY_TAX.find((c) => c.id === countryId);
  const result = useMemo(() => scoreInheritance(answers, lang), [answers, lang]);
  const answeredCount = Object.values(answers).filter(Boolean).length;

  const toggle = (id: string) => setAnswers((a) => ({ ...a, [id]: !a[id] }));

  const tierStyle =
    result.tier === 'at-risk'
      ? { border: 'border-red-400/30', bg: 'bg-red-400/5', text: 'text-red-400', bar: '#f87171' }
      : result.tier === 'partial'
        ? { border: 'border-bitcoin/30', bg: 'bg-bitcoin/5', text: 'text-bitcoin', bar: '#F7931A' }
        : { border: 'border-emerald-400/30', bg: 'bg-emerald-400/5', text: 'text-emerald-400', bar: '#34d399' };

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
                <span className="text-bitcoin">{t(lang, 'Tax & Inheritance Agent', 'Daňový a dedičský agent', 'Daňový a dědický agent')}</span>
              </div>
              <div className="text-xs text-zinc-500">{t(lang, 'Layer 2 · Module 06', 'Layer 2 · Modul 06', 'Layer 2 · Modul 06')}</div>
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
            {t(lang, 'Two questions every bitcoiner avoids:', 'Dve otázky, ktorým sa každý bitcoiner vyhýba:', 'Dvě otázky, kterým se každý bitcoiner vyhýbá:')}{' '}
            <span className="text-bitcoin">{t(lang, 'taxes and death.', 'dane a smrť.', 'daně a smrt.')}</span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {t(lang,
              'A country-by-country overview of how bitcoin gains are treated across the 13 EU countries Virtuse serves – plus an inheritance-readiness check that answers "what happens to my sats when I\'m gone".',
              'Prehľad zdanenia zisku z bitcoinu naprieč 13 krajinami EÚ, ktoré Virtuse obsluhuje – plus kontrola pripravenosti na dedenie, ktorá odpovie na otázku „čo sa stane s mojimi satoshi, keď tu nebudem".',
              'Přehled zdanění zisku z bitcoinu napříč 13 zeměmi EU, které Virtuse obsluhuje – plus kontrola připravenosti na dědění, která odpoví na otázku „co se stane s mými satoshi, až tu nebudu".')}
          </p>
        </div>

        {/* ── TAX OVERVIEW ── */}
        <div className="rounded-2xl border border-white/10 bg-[#111113] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              <FileText className="h-4 w-4 text-bitcoin" /> {t(lang, 'Tax overview · 13 EU countries', 'Prehľad daní · 13 krajín EÚ', 'Přehled daní · 13 zemí EU')}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRY_TAX.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCountryId(c.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    countryId === c.id
                      ? 'border-bitcoin bg-bitcoin text-black'
                      : 'border-white/15 text-zinc-400 hover:border-bitcoin/50 hover:text-white'
                  }`}
                >
                  {c.flag} {L(c.name, lang)}
                </button>
              ))}
            </div>
          </div>

          {country ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">{t(lang, 'Gain tax', 'Daň zo zisku', 'Daň ze zisku')}</div>
              <div className="mt-1 text-sm font-semibold leading-snug text-white">{L(country.gainTax, lang)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">{t(lang, 'Holding exemption', 'Oslobodenie podľa držania', 'Osvobození podle držení')}</div>
              <div className="mt-1 text-sm font-semibold leading-snug text-emerald-300">{L(country.exemption, lang)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">{t(lang, 'Filing', 'Priznanie', 'Přiznání')}</div>
              <div className="mt-1 text-sm font-semibold leading-snug text-white">{L(country.filing, lang)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">{t(lang, 'Good to know', 'Dobré vedieť', 'Dobré vědět')}</div>
              <div className="mt-1 text-xs leading-relaxed text-zinc-300">{L(country.note, lang)}</div>
            </div>
          </div>
          ) : (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              {t(lang, 'Choose your country above to see its rules.', 'Vyberte si krajinu vyššie a zobrazia sa jej pravidlá.', 'Vyberte si zemi výše a zobrazí se její pravidla.')}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bitcoin/20 bg-bitcoin/5 p-4">
            <p className="max-w-xl text-xs leading-relaxed text-zinc-300">
              <span className="font-semibold text-bitcoin">{t(lang, 'Indicative 2025 overview.', 'Indikatívny prehľad za rok 2025.', 'Indikativní přehled za rok 2025.')}</span>{' '}
              {t(lang,
                'Tax rules change fast and your situation is individual – verify with a local tax advisor. For audit-ready crypto tax reports, Virtuse partners with Lukka.',
                'Daňové pravidlá sa menia rýchlo a vaša situácia je individuálna – overte si to u miestneho daňového poradcu. Pre kontrole odolné krypto daňové výkazy Virtuse spolupracuje s Lukka.',
                'Daňová pravidla se mění rychle a vaše situace je individuální – ověřte si to u místního daňového poradce. Pro kontrole odolné krypto daňové výkazy Virtuse spolupracuje s Lukka.')}
            </p>
            <a
              href={withUtm(PARTNER_LINKS.lukka, 'lukka')}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPartnerClick('lukka')}
              className="flex items-center gap-1.5 rounded-lg bg-bitcoin px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
            >
              {t(lang, 'Tax reports via Lukka', 'Daňové výkazy cez Lukka', 'Daňové výkazy přes Lukka')} <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* ── INHERITANCE ── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-white/10 bg-[#111113] p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              <KeyRound className="h-4 w-4 text-bitcoin" /> {t(lang, 'What happens to my sats? · Readiness check', 'Čo sa stane s mojimi satoshi? · Kontrola pripravenosti', 'Co se stane s mými satoshi? · Kontrola připravenosti')}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {t(lang,
                'Six yes/no questions. Answer honestly – the score shows how recoverable your bitcoin would be for your heirs tomorrow morning.',
                'Šesť otázok áno/nie. Odpovedajte úprimne – skóre ukáže, ako obnoviteľný by bol váš bitcoin pre vašich dedičov už zajtra ráno.',
                'Šest otázek ano/ne. Odpovídejte upřímně – skóre ukáže, jak obnovitelný by byl váš bitcoin pro vaše dědice už zítra ráno.')}
            </p>

            <div className="mt-4 space-y-2">
              {INHERITANCE_CHECKLIST.map((item) => {
                const yes = !!answers[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                      yes
                        ? 'border-emerald-400/30 bg-emerald-400/5'
                        : 'border-white/10 bg-white/5 hover:border-white/25'
                    }`}
                  >
                    {yes ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-600" />
                    )}
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${yes ? 'text-emerald-200' : 'text-white'}`}>
                        {L(item.question, lang)}
                      </div>
                      <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{L(item.detail, lang)}</div>
                    </div>
                    <span className="text-xs font-semibold text-zinc-600">+{item.points}</span>
                  </button>
                );
              })}
            </div>

            {/* score */}
            <div className={`mt-5 rounded-xl border p-4 ${tierStyle.border} ${tierStyle.bg}`}>
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 text-sm font-semibold ${tierStyle.text}`}>
                  {result.tier === 'at-risk' ? (
                    <ShieldAlert className="h-4 w-4" />
                  ) : result.tier === 'partial' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {result.label}
                </div>
                <div className="text-sm font-bold text-white">
                  {result.score}<span className="text-zinc-500">/{result.max}</span>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(result.score / result.max) * 100}%`, background: tierStyle.bar }}
                />
              </div>
              {result.missing.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t(lang, 'Priority fixes', 'Prioritné opravy', 'Prioritní opravy')}
                  </div>
                  {result.missing.map((m) => (
                    <div key={m.id} className="flex items-start gap-2 text-xs leading-relaxed text-zinc-300">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: tierStyle.bar }} />
                      <span>
                        <span className="font-medium text-white">{L(m.question, lang)}</span> – {L(m.action, lang)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-emerald-200/80">
                  {t(lang,
                    'Fully inheritance-ready. Schedule an annual recovery drill and keep the letter of instruction current.',
                    'Plne pripravené na dedenie. Naplánujte si ročnú skúšku obnovy a udržiavajte list s pokynmi aktuálny.',
                    'Plně připraveno na dědění. Naplánujte si roční zkoušku obnovy a udržujte dopis s pokyny aktuální.')}
                </p>
              )}
              {answeredCount < INHERITANCE_CHECKLIST.length && (
                <p className="mt-3 text-[11px] text-zinc-600">
                  {tv(lang, `{0} of {1} questions not answered yet.`, `{0} z {1} otázok zatiaľ nezodpovedaných.`, `{0} z {1} otázek zatím nezodpovězených.`, [INHERITANCE_CHECKLIST.length - Object.keys(answers).length, INHERITANCE_CHECKLIST.length])}
                </p>
              )}
            </div>
          </div>

          {/* multisig explainer + CTA */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#111113] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                {t(lang, 'The 2-of-3 multisig inheritance setup', 'Nastavenie dedenia s multisigom 2 z 3', 'Nastavení dědění s multisigem 2 ze 3')}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {t(lang,
                  'Three keys, any two move funds. No single point of failure – and your heirs can recover with the partner key plus one of yours.',
                  'Tri kľúče, ľubovoľné dva presunú prostriedky. Žiadny jediný bod zlyhania – a vaši dedičia môžu obnoviť prístup pomocou kľúča partnera a jedného z vašich.',
                  'Tři klíče, libovolné dva přesunou prostředky. Žádný jediný bod selhání – a vaši dědicové mohou obnovit přístup pomocí klíče partnera a jednoho z vašich.')}
              </p>
              <div className="mt-4 space-y-2">
                {MULTISIG_KEYS.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bitcoin/15 font-bold text-bitcoin">
                      {k.id}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {L(k.share, lang)} · {L(k.holder, lang)}
                      </div>
                      <div className="text-[11px] text-zinc-500">{L(k.location, lang)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-bitcoin/20 bg-bitcoin/5 p-3 text-center text-xs font-medium text-bitcoin">
                {t(lang, 'Any 2 of 3 keys can move funds – 1 lost key never means lost coins.', 'Ľubovoľné 2 z 3 kľúčov môžu presunúť prostriedky – strata 1 kľúča nikdy neznamená stratu mincí.', 'Libovolné 2 ze 3 klíčů mohou přesunout prostředky – ztráta 1 klíče nikdy neznamená ztrátu mincí.')}
              </div>
            </div>

            <div className="rounded-2xl border border-bitcoin/30 bg-bitcoin/5 p-5">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-bitcoin" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-bitcoin">{t(lang, 'Set it up properly', 'Nastavte si to poriadne', 'Nastavte si to pořádně')}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                {t(lang,
                  'Multisig vaults with a formal inheritance protocol – you always hold the majority of keys. Vetted by Virtuse, settled to wallets you control.',
                  'Multisig trezory s formálnym protokolom dedenia – väčšinu kľúčov máte vždy vy. Preverené Virtuse, prostriedky smerujú do peňaženiek pod vašou kontrolou.',
                  'Multisig trezory s formálním protokolem dědění – většinu klíčů máte vždy vy. Prověřené Virtuse, prostředky směřují do peněženek pod vaší kontrolou.')}
              </p>
              <a
                href={withUtm(PARTNER_LINKS.unchained, 'unchained')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPartnerClick('unchained')}
                className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-bitcoin px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
              >
                {t(lang, 'Explore multisig inheritance', 'Preskúmať multisig dedenie', 'Prozkoumat multisig dědění')} <ArrowUpRight className="h-4 w-4" />
              </a>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="border-white/15 text-zinc-400">{t(lang, 'Self-custody', 'Vlastná úschova', 'Vlastní úschova')}</Badge>
                <Badge variant="outline" className="border-white/15 text-zinc-400">{t(lang, '2-of-3 multisig', 'Multisig 2 z 3', 'Multisig 2 ze 3')}</Badge>
                <Badge variant="outline" className="border-white/15 text-zinc-400">{t(lang, 'Inheritance protocol', 'Protokol dedenia', 'Protokol dědění')}</Badge>
              </div>
            </div>
          </aside>
        </div>

        {countryId && (
          <ResultCaptureForm
            lang={lang}
            source="tax"
            buildPayload={() => ({ country: countryId, inheritanceScore: result.score, inheritanceMax: result.max })}
          />
        )}

        <footer className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-zinc-600">
          {t(lang,
            'Tax & Inheritance Agent – Virtuse Layer 2, Module 06. Tax figures are an indicative 2025 overview and may be outdated – not tax, legal or financial advice. Inheritance tools are educational; consult a professional for estate planning. Virtuse never holds your keys.',
            'Daňový a dedičský agent – Virtuse Layer 2, Modul 06. Daňové údaje sú indikatívny prehľad za rok 2025 a môžu byť zastarané – nejde o daňové, právne ani finančné poradenstvo. Nástroje na dedenie sú vzdelávacie; pre plánovanie dedičstva sa poraďte s odborníkom. Virtuse nikdy nedrží vaše kľúče.',
            'Daňový a dědický agent – Virtuse Layer 2, Modul 06. Daňové údaje jsou indikativní přehled za rok 2025 a mohou být zastaralé – nejde o daňové, právní ani finanční poradenství. Nástroje pro dědění jsou vzdělávací; pro plánování dědictví se poraďte s odborníkem. Virtuse nikdy nedrží vaše klíče.')}
        </footer>
      </main>
    </div>
  );
}
