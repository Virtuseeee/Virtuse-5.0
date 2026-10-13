import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  FileText,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  COUNTRY_TAX,
  INHERITANCE_CHECKLIST,
  MULTISIG_KEYS,
  PARTNER_LINKS,
  scoreInheritance,
} from '@/lib/tax';
import type { CountryTax } from '@/lib/tax';
import { TAX_FIELD_SOURCES } from '@/lib/tax-sources.gen';
import type { TaxField, TaxOptionalField } from '@/lib/tax-sources.gen';
import { fmtDate, fmtEur, getLang, t, tv, L } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';
import { ResultCaptureForm } from '@/components/CaptureForm';

// The page shell (tax-agent.html) renders the nav, hero, How it works, FAQ,
// Brief card, related tools, footer and disclaimer. This app renders only
// the tool itself.

const FIELDS: TaxField[] = ['gainTax', 'exemption', 'filing'];

// Only countries with an official source for all three cards are shown.
const COUNTRIES: CountryTax[] = COUNTRY_TAX.filter((c) =>
  FIELDS.every((f) => !!TAX_FIELD_SOURCES.countries[c.id]?.[f]?.source),
);

// ── Deep-link preset ─────────────────────────────────────────
// Partner Finder's tax/custody result card links here with ?country=<id>.
function readCountryParam(): string | null {
  try {
    const country = new URLSearchParams(window.location.search).get('country');
    if (country && COUNTRIES.some((c) => c.id === country)) return country;
  } catch {
    /* no-op: fall through to default */
  }
  return null;
}

// ── Partner links: fixed UTM, sponsored ──────────────────────
function partnerUrl(url: string, contentId: string): string {
  try {
    const target = new URL(url);
    target.searchParams.set('utm_source', 'tax');
    target.searchParams.set('utm_medium', 'page');
    target.searchParams.set('utm_campaign', 'tax-agent');
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
  } catch {
    /* tracking must never block navigation */
  }
}

const cfoHref = (lang: Lang) =>
  `${lang === 'en' ? '/cfo.html' : `/${lang}/cfo.html`}?utm_source=tax-agent&utm_medium=cta&utm_campaign=cfo#waitForm`;

const PRIMARY_CTA =
  'btn-primary flex items-center justify-center gap-1.5 rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-canvas transition hover:opacity-85';
const SECONDARY_CTA =
  'flex items-center justify-center gap-1.5 rounded-[10px] border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-white/30 hover:bg-panel-hover';

function Disclosure({ lang }: { lang: Lang }) {
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
      {t(lang,
        "Virtuse may earn a referral fee. It doesn't change the overview.",
        'Virtuse môže dostať odmenu za odporúčanie. Prehľad to nemení.',
        'Virtuse může dostat odměnu za doporučení. Přehled to nemění.')}
    </p>
  );
}

export default function Tax() {
  const lang = useMemo(getLang, []);
  const deepLinkCountry = useMemo(readCountryParam, []);
  // uk/ru have no country of their own in the list: start with none selected.
  const [countryId, setCountryId] = useState<string | null>(() => {
    if (deepLinkCountry) return deepLinkCountry;
    if (lang === 'uk' || lang === 'ru') return null;
    const def = ({ cs: 'cz', de: 'de', pl: 'pl', hu: 'hu', fr: 'fr', es: 'es' } as Record<string, string>)[lang] ?? 'sk';
    return COUNTRIES.some((c) => c.id === def) ? def : COUNTRIES[0]?.id ?? null;
  });
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const country = COUNTRIES.find((c) => c.id === countryId);
  const sources = country ? TAX_FIELD_SOURCES.countries[country.id] : undefined;
  const result = useMemo(() => scoreInheritance(answers, lang), [answers, lang]);
  const unanswered = INHERITANCE_CHECKLIST.filter((i) => !(i.id in answers)).length;
  const checkedDate = fmtDate(TAX_FIELD_SOURCES.checked, lang);

  const toggle = (id: string) => setAnswers((a) => ({ ...a, [id]: !a[id] }));

  const tierStyle =
    result.tier === 'at-risk'
      ? { border: 'border-red-400/30', bg: 'bg-red-400/5', text: 'text-red-400', bar: '#f87171' }
      : result.tier === 'partial'
        ? { border: 'border-line-strong', bg: 'bg-white/5', text: 'text-bitcoin', bar: '#F7931A' }
        : { border: 'border-emerald-400/30', bg: 'bg-emerald-400/5', text: 'text-emerald-400', bar: '#34d399' };

  // Cards: gain tax, then health insurance where the country has it (Slovakia), exemption, filing.
  const cards: (TaxField | TaxOptionalField)[] =
    country && sources && country.healthLevy && sources.healthLevy?.source
      ? ['gainTax', 'healthLevy', 'exemption', 'filing']
      : FIELDS;
  const fieldLabel: Record<TaxField | TaxOptionalField, string> = {
    gainTax: t(lang, 'Gain tax', 'Daň zo zisku', 'Daň ze zisku'),
    healthLevy: t(lang, 'Health insurance', 'Zdravotné odvody', 'Zdravotní pojištění'),
    exemption: t(lang, 'Holding exemption', 'Oslobodenie podľa držania', 'Osvobození podle držení'),
    filing: t(lang, 'Filing', 'Priznanie', 'Přiznání'),
  };

  return (
    <div className="text-ink">
      {/* ── TAX OVERVIEW ── */}
      <div className="min-w-0 rounded-2xl border border-line bg-panel p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
          <FileText className="h-4 w-4 text-bitcoin" /> {t(lang, 'Tax overview · 13 EU countries', 'Prehľad daní · 13 krajín EÚ', 'Přehled daní · 13 zemí EU')}
        </h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {COUNTRIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={countryId === c.id}
              onClick={() => setCountryId(c.id)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                countryId === c.id
                  ? 'border-bitcoin bg-bitcoin text-black'
                  : 'border-line-strong text-ink-muted hover:border-bitcoin/50 hover:text-ink'
              }`}
            >
              {c.flag} {L(c.name, lang)}
            </button>
          ))}
        </div>

        {country && sources ? (
          <div className={`mt-5 grid gap-4 sm:grid-cols-2 ${cards.length > 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
            {cards.map((f) => {
              const text = country[f];
              const src = sources[f];
              if (!text || !src) return null;
              return (
              <div key={f} className="flex min-w-0 flex-col rounded-xl border border-line bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-wide text-ink-muted">{fieldLabel[f]}</div>
                <div className="mt-1 break-words text-sm font-semibold leading-snug text-ink">{L(text, lang)}</div>
                <div className="mt-auto pt-3 text-[11px] text-ink-muted">
                  <a href={src.source} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
                    {t(lang, 'Source', 'Zdroj', 'Zdroj')}
                  </a>
                  {', '}
                  {tv(lang, 'checked {0}', 'overené {0}', 'ověřeno {0}', [fmtDate(src.checked, lang)])}
                </div>
              </div>
              );
            })}
            <div className={`min-w-0 rounded-xl border border-line bg-white/5 p-4 ${cards.length > 3 ? 'sm:col-span-2' : ''}`}>
              <div className="text-[11px] uppercase tracking-wide text-ink-muted">{t(lang, 'Good to know', 'Dobré vedieť', 'Dobré vědět')}</div>
              <div className="mt-1 break-words text-xs leading-relaxed text-ink">{L(country.note, lang)}</div>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-line bg-white/5 p-4 text-sm text-ink">
            {t(lang, 'Choose your country above to see its rules.', 'Vyberte si krajinu vyššie a zobrazia sa jej pravidlá.', 'Vyberte si zemi výše a zobrazí se její pravidla.')}
          </div>
        )}

        <div className="mt-4 grid gap-4 rounded-xl border border-line-strong bg-white/5 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
          <p className="min-w-0 text-xs leading-relaxed text-ink">
            <span className="font-semibold">
              {tv(lang, 'As of Q3 2026, checked {0}.', 'Stav k Q3 2026, overené {0}.', 'Stav ke Q3 2026, ověřeno {0}.', [checkedDate])}
            </span>{' '}
            {t(lang,
              'Tax rules change fast and your situation is individual, so verify with a local tax advisor. For crypto tax reports, Lukka is one option.',
              'Daňové pravidlá sa menia rýchlo a vaša situácia je individuálna, preto si to overte u miestneho daňového poradcu. Pre krypto daňové výkazy je jednou z možností Lukka.',
              'Daňová pravidla se mění rychle a vaše situace je individuální, proto si to ověřte u místního daňového poradce. Pro krypto daňové výkazy je jednou z možností Lukka.')}
          </p>
          <div className="min-w-0">
            <a
              href={partnerUrl(PARTNER_LINKS.lukka, 'lukka')}
              target="_blank"
              rel="sponsored noopener"
              onClick={() => trackPartnerClick('lukka')}
              className={PRIMARY_CTA}
            >
              {t(lang, 'Tax reports via Lukka', 'Daňové výkazy cez Lukka', 'Daňové výkazy přes Lukka')} <ArrowUpRight className="h-4 w-4" />
            </a>
            <Disclosure lang={lang} />
          </div>
        </div>
      </div>

      {/* ── VIRTUSE CFO ── */}
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-line-strong bg-panel p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm leading-relaxed text-ink">
          <span className="font-semibold">Virtuse CFO</span>
          <br />
          {tv(lang,
            'Launches 1 November: {0}/month or {1}/year.',
            'Spúšťa sa 1. novembra: {0}/mesiac alebo {1}/rok.',
            'Spouští se 1. listopadu: {0}/měsíc nebo {1}/rok.',
            [fmtEur(9, 0, lang), fmtEur(90, 0, lang)])}
        </p>
        <a href={cfoHref(lang)} data-cta="cfo" className={`${SECONDARY_CTA} shrink-0`}>
          {t(lang, 'Get notified', 'Dajte mi vedieť', 'Dejte mi vědět')} <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      {/* ── INHERITANCE ── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 rounded-2xl border border-line bg-panel p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            <KeyRound className="h-4 w-4 shrink-0 text-bitcoin" /> {t(lang, 'What happens to my sats? · Readiness check', 'Čo sa stane s mojimi satoshi? · Kontrola pripravenosti', 'Co se stane s mými satoshi? · Kontrola připravenosti')}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            {t(lang,
              'Six yes/no questions. Answer honestly: the score shows how recoverable your bitcoin would be for your heirs tomorrow morning.',
              'Šesť otázok áno/nie. Odpovedajte úprimne: skóre ukáže, ako obnoviteľný by bol váš bitcoin pre vašich dedičov už zajtra ráno.',
              'Šest otázek ano/ne. Odpovídejte upřímně: skóre ukáže, jak obnovitelný by byl váš bitcoin pro vaše dědice už zítra ráno.')}
          </p>

          <div className="mt-4 space-y-2">
            {INHERITANCE_CHECKLIST.map((item) => {
              const yes = !!answers[item.id];
              const question = L(item.question, lang);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={yes}
                  aria-label={question}
                  onClick={() => toggle(item.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                    yes ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-line bg-white/5 hover:border-line-strong'
                  }`}
                >
                  {yes ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-dim" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{question}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">{L(item.detail, lang)}</div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-ink-muted">+{item.points}</span>
                </button>
              );
            })}
          </div>

          {/* score */}
          <div className={`mt-5 rounded-xl border p-4 ${tierStyle.border} ${tierStyle.bg}`}>
            <div className="flex items-center justify-between gap-3">
              <div className={`flex min-w-0 items-center gap-2 text-sm font-semibold ${tierStyle.text}`}>
                {result.tier === 'at-risk' ? (
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                ) : result.tier === 'partial' ? (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                ) : (
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                )}
                {result.label}
              </div>
              <div className="shrink-0 text-sm font-bold text-ink">
                {result.score}<span className="text-ink-muted">/{result.max}</span>
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
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {t(lang, 'Priority fixes', 'Prioritné opravy', 'Prioritní opravy')}
                </div>
                {result.missing.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 text-xs leading-relaxed text-ink">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: tierStyle.bar }} />
                    <span className="min-w-0">
                      <span className="font-medium">{L(m.question, lang)}</span>{' '}
                      <span className="text-ink-muted">{L(m.action, lang)}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-ink">
                {t(lang,
                  'Fully inheritance-ready. Schedule an annual recovery drill and keep the letter of instruction current.',
                  'Plne pripravené na dedenie. Naplánujte si ročnú skúšku obnovy a udržiavajte list s pokynmi aktuálny.',
                  'Plně připraveno na dědění. Naplánujte si roční zkoušku obnovy a udržujte dopis s pokyny aktuální.')}
              </p>
            )}
            {unanswered > 0 && (
              <p className="mt-3 text-[11px] text-ink-muted">
                {tv(lang, `{0} of {1} questions not answered yet.`, `{0} z {1} otázok zatiaľ nezodpovedaných.`, `{0} z {1} otázek zatím nezodpovězených.`, [unanswered, INHERITANCE_CHECKLIST.length])}
              </p>
            )}
          </div>
        </div>

        {/* multisig explainer + CTA */}
        <aside className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-line bg-panel p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {t(lang, 'The 2-of-3 multisig inheritance setup', 'Nastavenie dedenia s multisigom 2 z 3', 'Nastavení dědění s multisigem 2 ze 3')}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {t(lang,
                'Three keys, any two move funds. No single point of failure, and your heirs can recover with Key C plus one of yours.',
                'Tri kľúče, ľubovoľné dva presunú prostriedky. Žiadny jediný bod zlyhania a vaši dedičia môžu obnoviť prístup pomocou kľúča C a jedného z vašich.',
                'Tři klíče, libovolné dva přesunou prostředky. Žádný jediný bod selhání a vaši dědicové mohou obnovit přístup pomocí klíče C a jednoho z vašich.')}
            </p>
            <div className="mt-4 space-y-2">
              {MULTISIG_KEYS.map((k) => (
                <div key={k.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/5 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 font-bold text-ink">
                    {k.id}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-ink">
                      {L(k.share, lang)} · {L(k.holder, lang)}
                    </div>
                    <div className="text-[11px] text-ink-muted">{L(k.location, lang)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-line-strong bg-white/5 p-3 text-center text-xs font-medium text-ink">
              {t(lang,
                'Any 2 of 3 keys can move funds; 1 lost key never means lost coins.',
                'Ľubovoľné 2 z 3 kľúčov môžu presunúť prostriedky; strata 1 kľúča nikdy neznamená stratu mincí.',
                'Libovolné 2 ze 3 klíčů mohou přesunout prostředky; ztráta 1 klíče nikdy neznamená ztrátu mincí.')}
            </div>
          </div>

          <div className="rounded-2xl border border-line-strong bg-panel p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-bitcoin" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">{t(lang, 'Set it up properly', 'Nastavte si to poriadne', 'Nastavte si to pořádně')}</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink">
              {t(lang,
                'In a 2-of-3 setup you keep two keys. A collaborative custody provider such as Unchained can hold the third.',
                'V nastavení 2 z 3 si dva kľúče ponechávate vy. Tretí môže držať poskytovateľ kolaboratívnej úschovy, napríklad Unchained.',
                'V nastavení 2 ze 3 si dva klíče ponecháváte vy. Třetí může držet poskytovatel kolaborativní úschovy, například Unchained.')}
            </p>
            <a
              href={partnerUrl(PARTNER_LINKS.unchained, 'unchained')}
              target="_blank"
              rel="sponsored noopener"
              onClick={() => trackPartnerClick('unchained')}
              className={`mt-4 ${PRIMARY_CTA}`}
            >
              {tv(lang, 'Open {0}', 'Otvoriť {0}', 'Otevřít {0}', ['Unchained'])} <ArrowUpRight className="h-4 w-4" />
            </a>
            <Disclosure lang={lang} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="border-line-strong text-ink-muted">{t(lang, 'Self-custody', 'Vlastná úschova', 'Vlastní úschova')}</Badge>
              <Badge variant="outline" className="border-line-strong text-ink-muted">{t(lang, '2-of-3 multisig', 'Multisig 2 z 3', 'Multisig 2 ze 3')}</Badge>
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
    </div>
  );
}
