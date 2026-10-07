import { Check } from 'lucide-react';
import ConciergeChat from '@/components/ConciergeChat';
import { SiteFooter, SiteNav, useEmbedMode } from '@/components/SiteChrome';
import { PARTNERS } from '@/lib/concierge';
import { getLang, t, tv } from '@/lib/i18n';

export default function Home() {
  const lang = getLang();
  const embed = useEmbedMode();

  const STEPS = [
    {
      title: t(lang, 'Set your criteria', 'Zadajte svoje kritériá', 'Zadejte svá kritéria'),
      text: t(lang,
        'Buy, borrow, automate, mine, secure or report: a few questions replace an hour of comparing sites.',
        'Kúpiť, požičať si, automatizovať, ťažiť, zabezpečiť alebo priznať dane: pár otázok nahradí hodinu porovnávania stránok.',
        'Koupit, půjčit si, automatizovat, těžit, zabezpečit nebo přiznat daně: pár otázek nahradí hodinu porovnávání stránek.'),
    },
    {
      title: t(lang, 'Compare the partners that fit', 'Porovnajte partnerov, ktorí vyhovujú', 'Porovnejte partnery, kteří vyhovují'),
      text: tv(lang, `Every result is one of {0} partners pre-screened by Virtuse, filtered by your country and custody preference. You choose.`, `Každý výsledok je jeden z {0} partnerov preverených Virtuse, vyfiltrovaný podľa vašej krajiny a spôsobu úschovy. Vyberáte vy.`, `Každý výsledek je jeden z {0} partnerů prověřených Virtuse, vyfiltrovaný podle vaší země a způsobu úschovy. Vybíráte vy.`, [PARTNERS.length]),
    },
    {
      title: t(lang, 'Finish on their regulated platform', 'Dokončite na ich regulovanej platforme', 'Dokončete na jejich regulované platformě'),
      text: t(lang,
        'KYC and onboarding happen at the partner. Virtuse never holds your keys, funds or data — ever.',
        'KYC a onboarding prebiehajú u partnera. Virtuse nikdy nedrží vaše kľúče, prostriedky ani dáta — nikdy.',
        'KYC a onboarding probíhají u partnera. Virtuse nikdy nedrží vaše klíče, prostředky ani data — nikdy.'),
    },
  ];

  const STATS = [
    { value: String(PARTNERS.length), label: t(lang, 'Vetted partners', 'Preverených partnerov', 'Prověřených partnerů') },
    { value: '7', label: t(lang, 'Service categories', 'Kategórií služieb', 'Kategorií služeb') },
    { value: '13', label: t(lang, 'EU countries', 'Krajín EÚ', 'Zemí EU') },
  ];

  const PARTNER_NAMES = Array.from(new Set(PARTNERS.map((p) => p.name)));
  const stepLabel = t(lang, 'Step', 'Krok', 'Krok');

  if (embed) {
    return (
      <div className="min-h-screen bg-canvas p-3 text-ink">
        <div className="h-[calc(100vh-24px)]"><ConciergeChat /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteNav lang={lang} page="concierge.html" ctaHref="#concierge" ctaLabel={t(lang, 'Find partners', 'Nájsť partnerov', 'Najít partnery')} />

      <main className="mx-auto max-w-[1400px] px-6 pb-8 pt-16 lg:px-12 lg:pt-24">
        {/* hero — homepage dek pattern */}
        <section className="mb-12 max-w-[760px]">
          <span className="mb-4 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t(lang, 'Partner Finder · Layer 2', 'Partner Finder · Layer 2', 'Partner Finder · Layer 2')}
          </span>
          <h1 className="text-[40px] font-bold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[52px]">
            {t(lang, 'One trusted hub.', 'Jedno dôveryhodné centrum.', 'Jedno důvěryhodné centrum.')}{' '}
            <span className="font-normal text-ink-muted">{t(lang, 'Every Bitcoin service.', 'Všetky Bitcoin služby.', 'Všechny Bitcoin služby.')}</span>
          </h1>
          <p className="mt-5 max-w-[620px] text-lg leading-relaxed text-ink-muted sm:text-xl">
            {t(lang,
              'Answer a few questions about your goal, country and custody preference. Partner Finder filters the Virtuse partner network and shows the regulated platforms that fit, side by side. You compare and choose.',
              'Odpovedzte na pár otázok o svojom cieli, krajine a spôsobe úschovy. Partner Finder vyfiltruje sieť partnerov Virtuse a ukáže regulované platformy, ktoré vyhovujú, vedľa seba. Porovnáte a vyberiete si sami.',
              'Odpovězte na pár otázek o svém cíli, zemi a způsobu úschovy. Partner Finder vyfiltruje síť partnerů Virtuse a ukáže regulované platformy, které vyhovují, vedle sebe. Porovnáte a vyberete si sami.')}
          </p>
        </section>

        {/* chat */}
        <section id="concierge" className="scroll-mt-24">
          <div className="h-[72vh] min-h-[560px] max-h-[760px]">
            <ConciergeChat />
          </div>
        </section>

        {/* how it works — homepage changelog pattern */}
        <section className="mt-24">
          <h2 className="mb-10 text-[34px] font-bold leading-[1.25] text-ink sm:text-[42px]">
            {t(lang, 'How', 'Ako', 'Jak')} <span className="font-normal text-ink-muted">{t(lang, 'Partner Finder works', 'funguje Partner Finder', 'funguje Partner Finder')}</span>
          </h2>
          <div className="vc-log">
            {STEPS.map((s, i) => (
              <div key={i} className="vc-log-item">
                <div className="vc-log-marker"><span className="vc-log-dot" /></div>
                <div className="flex flex-1 flex-col">
                  <h3 className="mb-1.5 text-[15px] font-bold text-ink">{s.title}</h3>
                  <p className="text-[15px] leading-relaxed text-ink-muted">{s.text}</p>
                  <span className="mt-4 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{stepLabel} 0{i + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* stats + partner ecosystem */}
        <section className="mt-24 grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <div className="grid gap-6 sm:grid-cols-3">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-[28px] font-bold text-ink">{s.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.08em] text-ink-muted">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-[22px] font-bold text-ink">
              {t(lang, 'Partner', 'Ekosystém', 'Ekosystém')} <span className="font-normal text-ink-muted">{t(lang, 'ecosystem', 'partnerov', 'partnerů')}</span>
            </h2>
            <p className="mb-5 max-w-[560px] text-[15px] leading-relaxed text-ink-muted">
              {t(lang,
                'Every name here has a live, vetted card on virtuse.com. Partner Finder only ever shows these partners.',
                'Každé meno tu má živú, preverenú kartu na virtuse.com. Partner Finder zobrazuje vždy len týchto partnerov.',
                'Každé jméno zde má živou, prověřenou kartu na virtuse.com. Partner Finder zobrazuje vždy jen tyto partnery.')}
            </p>
            <div className="flex flex-wrap gap-2">
              {PARTNER_NAMES.map((p) => (
                <span key={p} className="rounded-full border border-line-strong bg-panel px-3 py-1.5 text-xs font-medium text-ink-muted">{p}</span>
              ))}
            </div>
          </div>
        </section>

        {/* keys note */}
        <section className="mt-16 rounded-2xl border border-line bg-panel p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-panel-hover text-ink"><Check className="h-4 w-4" /></span>
            <div>
              <h3 className="text-[15px] font-bold text-ink">{t(lang, 'Your keys, always', 'Vaše kľúče, vždy', 'Vaše klíče, vždy')}</h3>
              <p className="mt-1.5 max-w-[720px] text-[15px] leading-relaxed text-ink-muted">
                {t(lang,
                  'Partner Finder only compares and links. It cannot move funds, and Virtuse never takes custody. Your keys and your sats stay in your hands.',
                  'Partner Finder iba porovnáva a odkazuje. Nemôže presúvať prostriedky a Virtuse nikdy nepreberá úschovu. Vaše kľúče aj satoshi ostávajú vo vašich rukách.',
                  'Partner Finder jen porovnává a odkazuje. Nemůže přesouvat prostředky a Virtuse nikdy nepřebírá úschovu. Vaše klíče i satoshi zůstávají ve vašich rukou.')}
              </p>
            </div>
          </div>
        </section>

        <p className="mt-10 text-xs leading-relaxed text-ink-dim">
          {t(lang,
            'Partner Finder is a rule-based filter. Results depend only on your answers and never on commission. It is a comparison tool, not financial, investment, tax or legal advice. Some partner links are affiliate links. KYC & onboarding are completed on each partner’s regulated platform.',
            'Partner Finder je filter založený na pravidlách. Výsledky závisia len od vašich odpovedí, nikdy nie od provízie. Je to porovnávací nástroj, nie finančné, investičné, daňové ani právne poradenstvo. Niektoré odkazy na partnerov sú affiliate odkazy. KYC a onboarding prebiehajú na regulovanej platforme každého partnera.',
            'Partner Finder je filtr založený na pravidlech. Výsledky závisí jen na vašich odpovědích, nikdy ne na provizi. Je to srovnávací nástroj, ne finanční, investiční, daňové ani právní poradenství. Některé odkazy na partnery jsou affiliate odkazy. KYC a onboarding probíhají na regulované platformě každého partnera.')}
        </p>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}
