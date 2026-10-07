import { useEffect, useState } from 'react';
import { CHROME } from '@/lib/chrome';
import { MODULE_LANGS } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

// The Concierge is also opened inside the sitewide launcher's <iframe>
// overlay (concierge-launcher.js, ?utm_medium=launcher). In that context the
// site nav/footer would render inside the bubble panel, so the page falls
// back to the bare chat.
export function useEmbedMode(): boolean {
  const [embed] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('utm_medium') === 'launcher' || window.self !== window.top;
    } catch {
      return false;
    }
  });
  return embed;
}

// Same order and labels as the site's own language switcher. Only languages
// in MODULE_LANGS (the ones whose module pages are deployed) are listed.
const ALL_SWITCHER: { code: Lang; flag: string; short: string }[] = [
  { code: 'en', flag: '🇬🇧', short: 'EN' },
  { code: 'sk', flag: '🇸🇰', short: 'SK' },
  { code: 'uk', flag: '🇺🇦', short: 'UA' },
  { code: 'cs', flag: '🇨🇿', short: 'CS' },
  { code: 'ru', flag: '🇷🇺', short: 'RU' },
  { code: 'de', flag: '🇩🇪', short: 'DE' },
  { code: 'fr', flag: '🇫🇷', short: 'FR' },
  { code: 'es', flag: '🇪🇸', short: 'ES' },
  { code: 'pl', flag: '🇵🇱', short: 'PL' },
  { code: 'hu', flag: '🇭🇺', short: 'HU' },
];
const LANGS = ALL_SWITCHER.filter((l) => MODULE_LANGS.includes(l.code));

// Module pages are co-located per language (root for EN, <lang>/ for the
// rest), so the language switch is a sibling-folder hop.
function langHref(from: Lang, to: Lang, page: string): string {
  if (from === to) return page;
  if (from === 'en') return `${to}/${page}`;
  return to === 'en' ? `../${page}` : `../${to}/${page}`;
}

function Logo({ homeHref }: { homeHref: string }) {
  return (
    <a href={homeHref} className="flex items-center gap-[2px] text-ink no-underline" aria-label="Virtuse">
      <svg viewBox="0 0 760 483" style={{ height: 26, width: 'auto', display: 'block', flexShrink: 0 }} aria-hidden="true">
        <defs>
          <linearGradient id="vlgA" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stopColor="#A5E0FB" /><stop offset="1" stopColor="#5FAEDE" /></linearGradient>
          <linearGradient id="vlgB" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#4D94EC" /><stop offset="1" stopColor="#2B62C0" /></linearGradient>
        </defs>
        <path fill="url(#vlgA)" d="M30 0h220l250 483H280Z" /><path fill="url(#vlgB)" d="M510 0h245L645 205H400Z" />
      </svg>
      <span style={{ fontWeight: 800, fontSize: 21, letterSpacing: '0.01em', lineHeight: 1, position: 'relative', top: 3 }}>Virtuse</span>
    </a>
  );
}

function LangMenu({ lang, page, id }: { lang: Lang; page: string; id: string }) {
  const [open, setOpen] = useState(false);
  const c = CHROME[lang];
  const me = LANGS.find((l) => l.code === lang)!;
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const el = document.getElementById(id);
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', esc); };
  }, [open, id]);
  return (
    <div className={`vc-lang${open ? ' open' : ''}`} id={id}>
      <button type="button" className="vc-lang-btn" aria-haspopup="true" aria-expanded={open} aria-label={c.langAria} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        <span>{me.flag}</span>{me.short}
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div className="vc-lang-panel" role="menu">
        {LANGS.map((l) => (
          <a key={l.code} role="menuitem" href={langHref(lang, l.code, page)} lang={l.code} className={l.code === lang ? 'active' : ''}>
            <span>{l.flag}</span>{l.short}
          </a>
        ))}
      </div>
    </div>
  );
}

export function SiteNav({ lang, page, ctaHref, ctaLabel }: { lang: Lang; page: string; ctaHref: string; ctaLabel?: string }) {
  const c = CHROME[lang];
  const [open, setOpen] = useState(false);
  const homeHref = lang === 'en' ? 'index.html' : 'index.html';
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 1024) setOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <>
      <nav className={`vc-nav${open ? ' open' : ''}`}>
        <div className="vc-nav-inner">
          <Logo homeHref={homeHref} />
          <ul className="vc-nav-links">
            {c.nav.map((n) => (<li key={n.href}><a href={n.href}>{n.label}</a></li>))}
          </ul>
          <div className="vc-nav-actions flex items-center gap-3">
            <LangMenu lang={lang} page={page} id="vcLangDesktop" />
            <a className="vc-cta" href={ctaHref}>{ctaLabel || c.cta}</a>
            <button type="button" className="vc-hamburger" aria-label={c.ham} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <line className="ham-line ham-line-1" x1="2" y1="6" x2="18" y2="6" />
                <line className="ham-line ham-line-2" x1="2" y1="14" x2="18" y2="14" />
              </svg>
            </button>
          </div>
        </div>
      </nav>
      <div className="vc-drawer" aria-hidden={!open}>
        {c.nav.map((n) => (<a key={n.href} className="vc-drawer-link" href={n.href}>{n.label}</a>))}
        <div className="pt-4"><LangMenu lang={lang} page={page} id="vcLangMobile" /></div>
      </div>
    </>
  );
}

export function SiteFooter({ lang }: { lang: Lang }) {
  const c = CHROME[lang];
  return (
    <footer className="mt-20 border-t border-line bg-canvas pb-8 pt-[60px]">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-start justify-between gap-10 px-6 lg:px-12">
        <div className="flex items-end gap-[2px]">
          <svg viewBox="0 0 760 483" style={{ height: 34, width: 'auto', display: 'block', flexShrink: 0 }} aria-hidden="true">
            <defs>
              <linearGradient id="vlgFA" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stopColor="#A5E0FB" /><stop offset="1" stopColor="#5FAEDE" /></linearGradient>
              <linearGradient id="vlgFB" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#4D94EC" /><stop offset="1" stopColor="#2B62C0" /></linearGradient>
            </defs>
            <path fill="url(#vlgFA)" d="M30 0h220l250 483H280Z" /><path fill="url(#vlgFB)" d="M510 0h245L645 205H400Z" />
          </svg>
          <span className="text-ink" style={{ fontWeight: 800, fontSize: 27, letterSpacing: '0.01em', lineHeight: 1, position: 'relative', top: 4 }}>Virtuse</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:flex md:gap-[60px]">
          {c.cols.map((col) => (
            <div key={col.h}>
              <h4 className="mb-[18px] text-[13px] font-semibold text-ink">{col.h}</h4>
              {col.links.map((l) => (
                <a key={l.href + l.label} href={l.href} className="mb-3 block text-[13px] leading-snug text-ink-muted no-underline transition-colors hover:text-ink">{l.label}</a>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="vc-wordmark" aria-hidden="true">
        <svg className="vc-wordmark-icon" viewBox="0 0 760 483" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="vlgWA" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stopColor="#A5E0FB" /><stop offset="1" stopColor="#5FAEDE" /></linearGradient>
            <linearGradient id="vlgWB" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#4D94EC" /><stop offset="1" stopColor="#2B62C0" /></linearGradient>
          </defs>
          <path fill="url(#vlgWA)" d="M30 0h220l250 483H280Z" /><path fill="url(#vlgWB)" d="M510 0h245L645 205H400Z" />
        </svg>
        <span className="vc-wordmark-text">Virtuse</span>
      </div>
      <div className="mx-auto mt-8 max-w-[1400px] px-6 lg:px-12">
        <p className="text-[13px] text-ink-muted">{c.copyright}</p>
        <p className="mt-1.5 text-[13px] text-ink-muted">{c.briefLine} <a href={c.briefHref} className="text-ink no-underline hover:underline">{c.read}</a></p>
      </div>
    </footer>
  );
}
