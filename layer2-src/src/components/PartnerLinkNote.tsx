import { t } from '@/lib/i18n';
import type { Lang } from '@/lib/i18n';

// Partner-link label (legal pack, chapter 9 point 2). Shown directly at every
// outbound partner CTA that is a commission/referral link. Plain links with no
// referral (bitgo.com, unchained.com, lukka.tech …) don't get it.
// how-we-earn.html sits in the page's own language folder (root for EN), the
// same relative convention as the chrome.ts links.
export function PartnerLinkNote({ lang, className = '' }: { lang: Lang; className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-ink-muted ${className}`}>
      {t(lang,
        'Partner link – if you sign up, Virtuse may receive a commission. Your price does not change.',
        'Partnerský odkaz – ak sa zaregistrujete, Virtuse môže dostať províziu. Vaša cena sa tým nemení.',
        'Partnerský odkaz – pokud se zaregistrujete, Virtuse může dostat provizi. Vaše cena se tím nemění.')}{' '}
      <a href="how-we-earn.html" className="underline underline-offset-2 hover:text-ink">
        {t(lang, 'How we earn', 'Ako zarábame', 'Jak vyděláváme')}
      </a>
    </p>
  );
}
