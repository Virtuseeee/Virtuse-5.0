import { useEffect, useState } from 'react';
import { Check, Mail } from 'lucide-react';
import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

// "Email me this": one transactional email sent by the newsletter Worker
// (POST /send, cloudflare-worker/src/send.js in the site repo). Only ids
// and numbers go over the wire; the Worker writes every word of the
// email. Nothing is stored unless the Brief box is ticked.
const SEND_URL = 'https://virtuse-newsletter.virtuse-ai.workers.dev/send';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CaptureSource = 'concierge' | 'stacking' | 'loan' | 'tax';

// Off until the privacy-policy text is approved: the page shell turns it on
// with <meta name="vb-capture" content="on">; ?capture=1 shows it for testing.
export function captureEnabled(): boolean {
  try {
    return (
      document.querySelector('meta[name="vb-capture"]')?.getAttribute('content') === 'on' ||
      new URLSearchParams(window.location.search).get('capture') === '1'
    );
  } catch {
    return false;
  }
}

function pushEvent(event: string, source: CaptureSource, extra: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, capture_source: source, ...extra });
  } catch {
    /* tracking must never break the form */
  }
}

type SendState = 'idle' | 'sending' | 'sent' | 'error' | 'invalid' | 'limited';

export function CaptureForm({
  lang,
  source,
  kind,
  title,
  intro,
  buildPayload,
  className = '',
}: {
  lang: Lang;
  source: CaptureSource;
  kind: 'plan' | 'result';
  title: string;
  intro: string;
  // Read at submit time, so the email carries the numbers on screen then.
  buildPayload: () => Record<string, unknown>;
  className?: string;
}) {
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [brief, setBrief] = useState(false);
  const [state, setState] = useState<SendState>('idle');

  useEffect(() => {
    pushEvent('capture_shown', source);
  }, [source]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'sending' || state === 'sent') return;
    if (!EMAIL_RE.test(email.trim())) {
      setState('invalid');
      return;
    }
    setState('sending');
    try {
      const res = await fetch(SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), hp, lang, kind, source, payload: buildPayload(), brief }),
      });
      if (res.ok) {
        setState('sent');
        pushEvent('capture_submit', source, { capture_brief: brief });
      } else {
        setState(res.status === 429 ? 'limited' : res.status === 400 ? 'invalid' : 'error');
      }
    } catch {
      setState('error');
    }
  };

  const message: Partial<Record<SendState, string>> = {
    sent: t(lang, 'Sent. It should be in your inbox within a minute.', 'Odoslané. Do minúty by mal byť vo vašej schránke.', 'Odesláno. Do minuty by měl být ve vaší schránce.'),
    invalid: t(lang, 'Please enter a valid email address.', 'Zadajte platnú emailovú adresu.', 'Zadejte platnou emailovou adresu.'),
    limited: t(lang, 'Too many attempts. Please try again later.', 'Príliš veľa pokusov. Skúste to neskôr.', 'Příliš mnoho pokusů. Zkuste to později.'),
    error: t(lang, 'Something went wrong. Please try again.', 'Niečo sa pokazilo. Skúste to znova.', 'Něco se pokazilo. Zkuste to znovu.'),
  };

  return (
    <form onSubmit={submit} noValidate className={`relative rounded-xl border border-line bg-panel p-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Mail className="h-4 w-4 shrink-0" />
        {title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{intro}</p>
      {state === 'sent' ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink" role="status">
          <Check className="h-4 w-4 shrink-0" /> {message.sent}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state !== 'sending') setState('idle');
              }}
              placeholder={t(lang, 'Your email', 'Váš email', 'Váš email')}
              aria-label={t(lang, 'Your email', 'Váš email', 'Váš email')}
              className="min-w-[160px] flex-1 rounded-[10px] border border-line-strong bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-white/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={state === 'sending'}
              className="shrink-0 rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-canvas transition hover:opacity-85 disabled:opacity-60"
            >
              {state === 'sending' ? t(lang, 'Sending…', 'Odosielam…', 'Odesílám…') : t(lang, 'Send', 'Odoslať', 'Odeslat')}
            </button>
          </div>
          {/* honeypot: hidden from people, bots fill it */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-ink-muted">
            <input
              type="checkbox"
              checked={brief}
              onChange={(e) => setBrief(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-white"
            />
            {t(lang,
              'Also send me the Virtuse Brief every Monday (unsubscribe anytime).',
              'Posielajte mi aj Virtuse Brief každý pondelok (odhlásenie kedykoľvek).',
              'Posílejte mi také Virtuse Brief každé pondělí (odhlášení kdykoli).')}
          </label>
          {message[state] && (
            <p className="mt-2 text-xs text-ink" role="alert">
              {message[state]}
            </p>
          )}
        </>
      )}
    </form>
  );
}

// Same form under a calculator: "Get this result by email".
export function ResultCaptureForm(props: {
  lang: Lang;
  source: Exclude<CaptureSource, 'concierge'>;
  buildPayload: () => Record<string, unknown>;
}) {
  if (!captureEnabled()) return null;
  const { lang } = props;
  return (
    <div className="mt-6 max-w-xl">
      <CaptureForm
        {...props}
        kind="result"
        title={t(lang, 'Get this result by email', 'Pošlite mi tento výsledok emailom', 'Pošlete mi tento výsledek emailem')}
        intro={t(lang,
          'One email with your inputs and these numbers. We add you to no list unless you tick the box.',
          'Jeden email s vašimi vstupmi a týmito číslami. Do žiadneho zoznamu vás nepridáme, ak nezaškrtnete políčko.',
          'Jeden email s vašimi vstupy a těmito čísly. Do žádného seznamu vás nepřidáme, pokud nezaškrtnete políčko.')}
      />
    </div>
  );
}
