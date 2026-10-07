import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bitcoin, Check, RotateCcw, ShieldCheck } from 'lucide-react';
import { CaptureForm, captureEnabled } from '@/components/CaptureForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AMOUNTS,
  COUNTRIES,
  CUSTODY,
  EXPERIENCE,
  GOALS,
  PARTNERS,
  needsCustodyStep,
  recommend,
  summaryLine,
} from '@/lib/concierge';
import type { Answers, GoalId, Recommendation } from '@/lib/concierge';
import { getLang, t, tv, L } from '@/lib/i18n';
import type { Lang, LocalizedText } from '@/lib/i18n';

type Phase = 'goal' | 'country' | 'experience' | 'custody' | 'amount' | 'done';

// UI-facing chip: same shape as concierge.ts's ChipOption, but already
// resolved to the visitor's language (label/hint are plain strings, not
// {en, sk, cs} triples) — this is what actually lands in component state.
interface UiChip {
  id: string;
  label: string;
  hint?: string;
}

interface Message {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  options?: UiChip[];
  result?: Recommendation[];
  resultAnswers?: Answers;
}

let idCounter = 1;
const nextId = () => idCounter++;

const welcomeText = (lang: Lang) =>
  t(lang,
    'Hi! This is Virtuse Partner Finder. Answer a few quick questions and I’ll filter our vetted partners down to the ones that fit your criteria. You compare and choose. I never hold keys or funds. What brings you here today?',
    'Dobrý deň! Toto je Virtuse Partner Finder. Odpovedzte na pár krátkych otázok a vyfiltrujem preverených partnerov, ktorí spĺňajú vaše kritériá. Porovnáte a vyberiete si sami. Nikdy nedržím kľúče ani prostriedky. Čo vás sem dnes privádza?',
    'Dobrý den! Tohle je Virtuse Partner Finder. Odpovězte na pár krátkých otázek a vyfiltruji prověřené partnery, kteří splňují vaše kritéria. Porovnáte a vyberete si sami. Nikdy nedržím klíče ani prostředky. Co vás sem dnes přivádí?');

const phaseText = (lang: Lang): Record<Phase, string> => ({
  goal: t(lang, 'What brings you here today?', 'Čo vás sem dnes privádza?', 'Co vás sem dnes přivádí?'),
  country: t(lang, 'Where are you based? (Availability and licensing differ by country.)', 'Odkiaľ ste? (Dostupnosť a licencie sa líšia podľa krajiny.)', 'Odkud jste? (Dostupnost a licence se liší podle země.)'),
  experience: t(lang, 'How would you describe your Bitcoin experience?', 'Ako by ste opísali svoje skúsenosti s Bitcoinom?', 'Jak byste popsali své zkušenosti s Bitcoinem?'),
  custody: t(lang, 'How do you want to hold your bitcoin?', 'Ako chcete držať svoj bitcoin?', 'Jak chcete držet svůj bitcoin?'),
  amount: t(lang, 'Roughly what amount are we talking about?', 'O akej približnej sume sa bavíme?', 'O jaké přibližné částce se bavíme?'),
  done: '',
});

// ── UTM + click tracking ─────────────────────────────────────
// utm_medium is inherited from the page/iframe the concierge was
// opened with (?utm_medium=hero|banner|launcher|page, set by
// virtuse.com), so a partner click always carries where the user
// entered the concierge from, not just that they used it.
function withUtm(url: string, partnerId: string): string {
  try {
    const target = new URL(url);
    const here = new URLSearchParams(window.location.search);
    target.searchParams.set('utm_source', 'concierge');
    target.searchParams.set('utm_medium', here.get('utm_medium') || 'page');
    target.searchParams.set('utm_campaign', 'layer2-mvp');
    target.searchParams.set('utm_content', partnerId);
    return target.toString();
  } catch {
    return url;
  }
}

function trackPartnerClick(partnerId: string) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: 'concierge_partner_click', partner_id: partnerId });
    // eslint-disable-next-line no-console
    console.log('[concierge] concierge_partner_click', partnerId);
  } catch {
    /* tracking must never block navigation */
  }
}

function toChips(goals: typeof GOALS, lang: Lang): UiChip[] {
  return goals.map((g) => ({ id: g.id, label: L(g.label, lang), hint: L(g.hint, lang) }));
}

function localizeChips(opts: { id: string; label: LocalizedText; hint?: LocalizedText }[], lang: Lang): UiChip[] {
  return opts.map((o) => ({ id: o.id, label: L(o.label, lang), hint: L(o.hint, lang) }));
}

export default function ConciergeChat() {
  const [lang] = useState<Lang>(getLang);
  const [messages, setMessages] = useState<Message[]>([
    { id: nextId(), role: 'assistant', text: welcomeText(lang), options: toChips(GOALS, lang) },
  ]);
  const [phase, setPhase] = useState<Phase>('goal');
  const [answers, setAnswers] = useState<Answers>({});
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const PHASE_TEXT = phaseText(lang);

  useEffect(() => {
    // Keep the welcome message + first chips in view on mount (matters on
    // phones, where the list is short); auto-scroll only once the
    // conversation has actually progressed.
    if (messages.length <= 1 && !typing) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const say = (
    text: string,
    options?: UiChip[],
    result?: Recommendation[],
    resultAnswers?: Answers,
  ) => {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: nextId(), role: 'assistant', text, options, result, resultAnswers }]);
    }, 650 + Math.random() * 400);
  };

  const answer = (opt: UiChip) => {
    // remove options from the last assistant message
    setMessages((m) => m.map((msg) => ({ ...msg, options: undefined })));
    setMessages((m) => [...m, { id: nextId(), role: 'user', text: opt.label }]);

    const next: Answers = { ...answers };

    if (phase === 'goal') {
      next.goal = opt.id as GoalId;
      setAnswers(next);
      setPhase('country');
      say(PHASE_TEXT.country, localizeChips(COUNTRIES, lang));
      return;
    }
    if (phase === 'country') {
      next.country = opt.id;
      setAnswers(next);
      if (needsCustodyStep(next.goal)) {
        setPhase('experience');
        say(PHASE_TEXT.experience, localizeChips(EXPERIENCE, lang));
      } else {
        setPhase('amount');
        say(PHASE_TEXT.amount, localizeChips(AMOUNTS, lang));
      }
      return;
    }
    if (phase === 'experience') {
      next.experience = opt.id as Answers['experience'];
      setAnswers(next);
      setPhase('custody');
      say(PHASE_TEXT.custody, localizeChips(CUSTODY, lang));
      return;
    }
    if (phase === 'custody') {
      next.custody = opt.id as Answers['custody'];
      setAnswers(next);
      setPhase('amount');
      say(PHASE_TEXT.amount, localizeChips(AMOUNTS, lang));
      return;
    }
    if (phase === 'amount') {
      next.amount = opt.id as Answers['amount'];
      setAnswers(next);
      setPhase('done');
      const recs = recommend(next, lang);
      say(
        tv(lang, `Your criteria:\n{0}\nThese partners fit them. The order comes from fixed rules based on your answers, never from commission. Compare and choose one: you finish onboarding on the partner’s regulated platform, and your bitcoin never touches Virtuse.`, `Vaše kritériá:\n{0}\nTíto partneri ich spĺňajú. Poradie určujú pevné pravidlá podľa vašich odpovedí, nikdy nie provízia. Porovnajte ich a vyberte si: onboarding dokončíte na regulovanej platforme partnera a váš bitcoin sa Virtuse nikdy nedotkne.`, `Vaše kritéria:\n{0}\nTito partneři je splňují. Pořadí určují pevná pravidla podle vašich odpovědí, nikdy ne provize. Porovnejte je a vyberte si: onboarding dokončíte na regulované platformě partnera a váš bitcoin se Virtuse nikdy nedotkne.`, [summaryLine(next, lang)]),
        undefined,
        recs,
        next,
      );
      return;
    }
  };

  const restart = () => {
    idCounter = 1;
    setAnswers({});
    setPhase('goal');
    setMessages([
      { id: nextId(), role: 'assistant', text: welcomeText(lang), options: toChips(GOALS, lang) },
    ]);
  };

  const lastMessage = messages[messages.length - 1];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-panel">
      {/* chat header */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-panel-hover text-ink">
          <Bitcoin className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-ink">{t(lang, 'Partner Finder', 'Partner Finder', 'Partner Finder')}</span>
            <Badge variant="outline" className="border-line-strong bg-transparent text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted hover:bg-transparent">Layer 2</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-bitcoin" />
            {tv(lang, `Filters {0} vetted partners · never holds your keys`, `Filtruje {0} preverených partnerov · nikdy nedrží vaše kľúče`, `Filtruje {0} prověřených partnerů · nikdy nedrží vaše klíče`, [PARTNERS.length])}
          </div>
        </div>
        {phase === 'done' && (
          <Button
            variant="outline"
            size="sm"
            onClick={restart}
            className="border-line-strong bg-transparent text-ink-muted hover:border-white/25 hover:bg-panel-hover hover:text-ink"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {t(lang, 'Start over', 'Začať znova', 'Začít znovu')}
          </Button>
        )}
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === 'assistant' ? (
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-panel-hover text-ink">
                    <Bitcoin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 max-w-full space-y-3 sm:max-w-[85%]">
                    <div className="rounded-2xl rounded-tl-sm border border-line bg-panel-hover px-4 py-3 text-[15px] leading-relaxed text-ink">
                      {msg.text.split('\n').map((line, i) => (
                        <p key={i} className={i > 0 ? 'mt-2' : ''}>
                          {line}
                        </p>
                      ))}
                    </div>
                    {msg.result && (
                      <ResultCards recs={msg.result} answers={msg.resultAnswers} onRestart={restart} lang={lang} />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-ink px-4 py-2.5 text-sm font-medium text-canvas">
                    {msg.text}
                  </div>
                </div>
              )}
            </div>
          ))}

          {typing && (
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-panel-hover text-ink">
                <Bitcoin className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-line bg-panel-hover px-4 py-3.5">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          {/* quick-reply chips for the last assistant message */}
          {!typing && lastMessage?.role === 'assistant' && lastMessage.options && (
            <div className="flex flex-wrap gap-2 pl-10">
              {lastMessage.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => answer(opt)}
                  className="group rounded-full border border-line-strong bg-panel px-4 py-2 text-left text-sm text-ink transition hover:border-white/30 hover:bg-panel-hover"
                >
                  <span className="font-medium">{opt.label}</span>
                  {opt.hint && (
                    <span className="block text-xs text-ink-muted group-hover:text-ink">
                      {opt.hint}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* footer strip */}
      <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-ink-muted">
        <ShieldCheck className="h-4 w-4 shrink-0 text-ink-muted" />
        {t(lang,
          'A comparison, not advice. Virtuse never holds your keys. Onboarding & KYC happen on the partner’s regulated platform.',
          'Porovnanie, nie poradenstvo. Virtuse nikdy nedrží vaše kľúče. Onboarding a KYC prebiehajú na regulovanej platforme partnera.',
          'Srovnání, ne poradenství. Virtuse nikdy nedrží vaše klíče. Onboarding a KYC probíhají na regulované platformě partnera.')}
      </div>
    </div>
  );
}

// Deep-link into Stacking Strategist, only offered for the 'buy' goal
// (Stacking is a DCA/recurring-purchase planner — it doesn't map onto
// mining/lending/custody/tax/treasury flows). Carries the visitor's
// amount bucket over as ?amount=<bucket> for Stacking to pre-fill its
// sliders from — see AMOUNT_BUCKET_PRESETS in Stacking.tsx. Every
// module's EN/SK/CS HTML entries are co-located per language (root
// for EN, sk/ for SK, cs/ for CS), so a bare relative filename always
// resolves to the sibling page in the same language section — no lang
// prefix needed (adding one would double up to sk/sk/... from inside
// sk/).
function stackingDeepLink(amount: Answers['amount'] | undefined): string {
  const here = new URLSearchParams(window.location.search);
  const params = new URLSearchParams();
  if (amount) params.set('amount', amount);
  params.set('utm_medium', here.get('utm_medium') || 'concierge');
  return `stacking.html?${params.toString()}`;
}

// Deep-link into the Loan & Liquidity Copilot, only offered for the
// 'loan' goal. Carries the visitor's amount bucket over as
// ?amount=<bucket> for Loan to pre-fill its "cash needed" slider from
// — see AMOUNT_BUCKET_PRESETS in Loan.tsx.
function loanDeepLink(amount: Answers['amount'] | undefined): string {
  const here = new URLSearchParams(window.location.search);
  const params = new URLSearchParams();
  if (amount) params.set('amount', amount);
  params.set('utm_medium', here.get('utm_medium') || 'concierge');
  return `loan.html?${params.toString()}`;
}

// Deep-link into the Tax & Inheritance Agent, offered for the 'tax'
// and 'custody' goals (custody's inheritance-readiness check and tax's
// country overview both live on the same module/page). Carries the
// visitor's country over as ?country=<id> — both modules share the
// same 13-country id set — for Tax to preselect on load.
function taxDeepLink(country: Answers['country'] | undefined): string {
  const here = new URLSearchParams(window.location.search);
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  params.set('utm_medium', here.get('utm_medium') || 'concierge');
  return `tax-agent.html?${params.toString()}`;
}

function ResultCards({
  recs,
  answers,
  onRestart,
  lang,
}: {
  recs: Recommendation[];
  answers?: Answers;
  onRestart: () => void;
  lang: Lang;
}) {
  return (
    <div className="space-y-3">
      {recs.map((rec) => (
        <div
          key={rec.partner.id}
          className="w-full max-w-sm rounded-xl border border-line bg-panel-hover p-4 sm:w-96"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-bold text-ink">{rec.partner.name}</span>
                {rec.partner.badge && (
                  <Badge variant="outline" className="border-line-strong text-ink-muted">
                    {L(rec.partner.badge, lang)}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">{L(rec.partner.tagline, lang)}</p>
            </div>
          </div>

          <ul className="mt-3 space-y-1.5">
            {rec.reasons.map((r, j) => (
              <li key={j} className="flex items-start gap-2 text-xs leading-relaxed text-ink">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                {r}
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] text-ink-muted">{L(rec.partner.feeNote, lang)}</p>

          <a
            href={withUtm(rec.partner.url, rec.partner.id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackPartnerClick(rec.partner.id)}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-[10px] bg-ink px-4 py-2.5 text-sm font-semibold text-canvas transition hover:opacity-85"
          >
            {rec.actionLabel} <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onRestart}
          className="border-line-strong bg-transparent text-ink-muted hover:border-white/25 hover:bg-panel-hover hover:text-ink"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {t(lang, 'Adjust answers', 'Upraviť odpovede', 'Upravit odpovědi')}
        </Button>
        {answers?.goal === 'buy' && (
          <a href={stackingDeepLink(answers.amount)}>
            <Button
              size="sm"
              className="border border-line-strong bg-transparent text-ink hover:border-white/30 hover:bg-panel-hover"
            >
              {t(lang, 'Simulate my plan', 'Simulovať môj plán', 'Simulovat můj plán')} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </a>
        )}
        {answers?.goal === 'loan' && (
          <a href={loanDeepLink(answers.amount)}>
            <Button
              size="sm"
              className="border border-line-strong bg-transparent text-ink hover:border-white/30 hover:bg-panel-hover"
            >
              {t(lang, 'Compare sell vs. borrow', 'Porovnať predaj vs. pôžičku', 'Porovnat prodej vs. půjčku')} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </a>
        )}
        {(answers?.goal === 'tax' || answers?.goal === 'custody') && (
          <a href={taxDeepLink(answers.country)}>
            <Button
              size="sm"
              className="border border-line-strong bg-transparent text-ink hover:border-white/30 hover:bg-panel-hover"
            >
              {t(lang, "Check my country's rules", 'Overiť pravidlá pre moju krajinu', 'Ověřit pravidla pro mou zemi')} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </a>
        )}
      </div>
      {answers && captureEnabled() && <PlanEmailForm recs={recs} answers={answers} lang={lang} />}
    </div>
  );
}

// "Email me this list" under the result cards (see CaptureForm.tsx).
function PlanEmailForm({ recs, answers, lang }: { recs: Recommendation[]; answers: Answers; lang: Lang }) {
  if (recs.length === 0 || !answers.goal || !answers.country || !answers.amount) return null;
  return (
    <CaptureForm
      lang={lang}
      source="concierge"
      kind="plan"
      className="w-full max-w-sm sm:w-96"
      title={t(lang, 'Get this list by email', 'Pošlite mi tento zoznam emailom', 'Pošlete mi tento seznam emailem')}
      intro={t(lang,
        'One email with your criteria and these partners. We add you to no list unless you tick the box.',
        'Jeden email s vašimi kritériami a týmito partnermi. Do žiadneho zoznamu vás nepridáme, ak nezaškrtnete políčko.',
        'Jeden email s vašimi kritérii a těmito partnery. Do žádného seznamu vás nepřidáme, pokud nezaškrtnete políčko.')}
      buildPayload={() => {
        const payload: Record<string, unknown> = {
          goal: answers.goal,
          country: answers.country,
          amount: answers.amount,
          partners: recs.map((r) => r.partner.id),
        };
        if (needsCustodyStep(answers.goal)) {
          payload.experience = answers.experience;
          payload.custody = answers.custody;
        }
        return payload;
      }}
    />
  );
}
