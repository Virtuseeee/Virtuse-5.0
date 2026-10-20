import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

// "Copy link to this result" (SEO handover, magnet item 4). The tool's settings are
// already in the URL (replaceState); the shared copy drops the visitor's own utm_*
// and carries utm_source=share so visits from shared links show up in GA4.
// The click goes to dataLayer as tool_share (tool, page_lang); a GTM tag for it is
// still to be added by the container owner.
export function shareUrl(stateUrl: string, tool: string): string {
  try {
    const u = new URL(stateUrl, window.location.href);
    for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k);
    u.searchParams.set('utm_source', 'share');
    u.searchParams.set('utm_medium', 'link');
    u.searchParams.set('utm_campaign', `tool_share_${tool}`);
    u.hash = '';
    return u.toString();
  } catch {
    return stateUrl;
  }
}

function copyText(text: string): Promise<boolean> {
  const legacy = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => legacy());
  }
  return Promise.resolve(legacy());
}

export function ShareResult({ lang, tool, getUrl, className = '' }: {
  lang: Lang;
  tool: string;
  getUrl: () => string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [failedUrl, setFailedUrl] = useState('');

  const onClick = async () => {
    const url = shareUrl(getUrl(), tool);
    const ok = await copyText(url);
    try {
      const w = window as unknown as { dataLayer?: unknown[] };
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event: 'tool_share', tool, page_lang: lang, share_method: ok ? 'copy' : 'copy_failed' });
    } catch {
      /* tracking must never block the copy */
    }
    if (ok) {
      setState('copied');
      window.setTimeout(() => setState('idle'), 2500);
    } else {
      setFailedUrl(url);
      setState('failed');
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        data-cta="tool_share"
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-strong px-3.5 py-2 text-sm font-medium text-ink transition hover:border-white/30 hover:bg-panel-hover"
      >
        {state === 'copied' ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {state === 'copied'
          ? t(lang, 'Link copied', 'Odkaz skopírovaný', 'Odkaz zkopírován')
          : t(lang, 'Copy link to this result', 'Kopírovať odkaz na výsledok', 'Kopírovat odkaz na výsledek')}
      </button>
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? t(lang, 'Link copied', 'Odkaz skopírovaný', 'Odkaz zkopírován') : ''}
      </span>
      {state === 'failed' && (
        <input
          readOnly
          value={failedUrl}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t(lang, 'Link to this result', 'Odkaz na výsledok', 'Odkaz na výsledek')}
          className="mt-2 block w-full max-w-md rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink"
        />
      )}
    </div>
  );
}
