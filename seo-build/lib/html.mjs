import fs from 'node:fs';
import {
  esc,
  jsonLd,
  toRoot,
  nbspFr,
  canonicalPath,
  wordCount
} from './util.mjs';

// v2 nav, footer, Brief card and site-v2.js strings per language, exported from the v2
// homepages by i18n-tools/seo_chrome.py (committed, so builds stay deterministic).
const CHROME_V2 = JSON.parse(fs.readFileSync(new URL('../data/chrome-v2.json', import.meta.url), 'utf8'));
// ONE cache-buster for the shared site-v2 files on every page; same numbers as SITE_CSS_V / SITE_JS_V in
// Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/speed.py (design-align Batch A Part 1, 2026-10-26).
export const SITE_CSS_V = '17';
export const SITE_JS_V = '10';
export const SITE_V2 = SITE_JS_V;
// Cloudflare Web Analytics (cookieless, no consent, never on staging). Same string as
// SNIPPET in Kimi_Agent_Virtuse%20MiCA%20Partners/i18n-tools/cf_analytics.py; its --check compares the pages.
export const CF_SNIPPET = `<!-- Cloudflare Web Analytics --><script>(function(d){if(location.hostname!=='staging.virtuse.com'){var s=d.createElement('script');s.type='module';s.src='https://static.cloudflareinsights.com/beacon.min.js';s.setAttribute('data-cf-beacon','{"token": "2ea6557e098f45879d87102065701564"}');d.body.appendChild(s);}})(document);</script>`;

// Footer operator line (legal pack 2026-10-16, 3.1); label links to <lang>/operator.html.
const OPERATOR = JSON.parse(fs.readFileSync(new URL('../data/footer-operator.json', import.meta.url), 'utf8'));

// Partner-link note (legal pack chapter 9.2), placed directly after every block that holds referral links.
export const AFF_NOTE = {
  en: ['Partner link – if you sign up, Virtuse may receive a commission. Your price does not change.', 'How we earn'],
  sk: ['Partnerský odkaz – ak sa zaregistrujete, Virtuse môže dostať províziu. Vaša cena sa tým nemení.', 'Ako zarábame'],
  cs: ['Partnerský odkaz – pokud se zaregistrujete, Virtuse může získat provizi. Vaše cena se tím nemění.', 'Jak vyděláváme'],
  pl: ['Link partnerski – jeśli się Państwo zarejestrują, Virtuse może otrzymać prowizję. Państwa cena się przez to nie zmienia.', 'Jak zarabiamy'],
  de: ['Partnerlink – wenn Sie sich registrieren, kann Virtuse eine Provision erhalten. Ihr Preis ändert sich dadurch nicht.', 'Wie wir verdienen'],
  fr: ['Lien partenaire – si vous vous inscrivez, Virtuse peut percevoir une commission. Votre prix ne change pas.', 'Comment nous gagnons de l’argent'],
  es: ['Enlace de socio – si se registra, Virtuse puede recibir una comisión. Su precio no cambia.', 'Cómo ganamos dinero'],
  hu: ['Partnerlink – ha regisztrál, a Virtuse jutalékot kaphat. Az Ön ára ettől nem változik.', 'Hogyan szerzünk bevételt'],
  uk: ['Партнерське посилання – якщо ви зареєструєтеся, Virtuse може отримати комісію. Ваша ціна від цього не змінюється.', 'Як ми заробляємо'],
  ru: ['Партнёрская ссылка – если вы зарегистрируетесь, Virtuse может получить комиссию. Ваша цена от этого не меняется.', 'Как мы зарабатываем']
};

const langFile = (lang, file) => (lang === 'en' ? file : `${lang}/${file}`);

export function affNote(relFile, lang) {
  const [note, how] = AFF_NOTE[lang];
  return `<p class="aff-note">${esc(note)} <a href="${esc(toRoot(relFile, langFile(lang, 'how-we-earn.html')))}">${esc(how)}</a></p>`;
}

// Only pages with a "Related tools" block (tax guides) carry these rules.
const TOOLS_CSS = `
.tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 8px 0 16px; }
.tools a {
  display: block; background: var(--dark-card); border: 1px solid var(--border); border-radius: 10px;
  padding: 14px 16px; color: var(--text); text-decoration: none; transition: border-color 0.2s;
}
.tools a:hover { border-color: var(--border-hover); }
.tools b { display: block; font-size: 15px; margin-bottom: 4px; }
.tools span { display: block; font-size: 14px; color: var(--text-muted); }
@media (max-width: 560px) { .tools { grid-template-columns: 1fr; } }
`.trim();

// Page body styles, scoped to the article (nav, footer, Brief card and tokens come
// from /site-v2.css; the v2 chrome itself comes from data/chrome-v2.json).
const CSS = `
.seo { max-width: 820px; margin: 0 auto; padding: 36px 0 24px; }
.seo a { color: var(--text); text-underline-offset: 3px; text-decoration-color: var(--line-strong); }
.seo a:hover { text-decoration-color: var(--text); }
.seo p, .seo li { color: #c9d1d9; }
.seo h1 { font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 10px; }
.seo h2 { font-size: 1.35rem; font-weight: 700; line-height: 1.25; margin: 40px 0 12px; }
.seo h3 { font-size: 1.08rem; font-weight: 700; margin: 24px 0 8px; }
.seo .crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; font-size: 13px; color: var(--muted); margin: 0 0 22px; }
.seo .crumbs a { color: var(--muted); text-decoration: none; display: inline-block; padding: 6px 0; }
.seo .crumbs a:hover { color: var(--text); }
.seo .asof { font-size: 13px; color: var(--muted); margin: 0 0 8px; }
.seo .answer { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; margin: 18px 0 30px; }
.seo .answer p { margin: 0; color: var(--text); }
.seo .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 14px 0 22px; }
.seo table { width: 100%; border-collapse: collapse; font-size: 14px; }
.seo th, .seo td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
.seo th { color: var(--muted); font-weight: 600; font-size: 13px; }
.seo .cta { display: inline-flex; align-items: center; min-height: 44px; background: var(--text); color: var(--dark); text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 18px; border-radius: 10px; margin: 8px 8px 8px 0; }
.seo .cta:hover { background: #fff; }
.seo .cta-secondary { display: inline-flex; align-items: center; min-height: 44px; border: 1px solid var(--line-strong); color: var(--text); text-decoration: none; padding: 12px 18px; border-radius: 10px; margin: 8px 8px 8px 0; }
.seo .cta-secondary:hover { background: var(--card); }
.seo .muted { color: var(--muted); font-size: 14px; }
.seo .related { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 8px 0 16px; }
.seo .related a { display: flex; align-items: center; min-height: 48px; padding: 12px 16px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; text-decoration: none; font-size: 15px; }
.seo .related a:hover { border-color: var(--line-strong); }
.seo .seo-tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 8px 0 16px; }
.seo .seo-tools a { display: block; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; text-decoration: none; }
.seo .seo-tools a:hover { border-color: var(--line-strong); }
.seo .seo-tools b { display: block; font-size: 15px; margin-bottom: 4px; }
.seo .seo-tools span { display: block; font-size: 14px; color: var(--muted); }
.seo li > a { display: inline-block; padding-block: 11px; }
.seo details { border-bottom: 1px solid var(--line); padding: 14px 0; }
.seo summary { cursor: pointer; font-weight: 600; }
.seo .disclaimers { margin-top: 44px; padding-top: 18px; border-top: 1px solid var(--line); font-size: 13px; }
.seo .disclaimers p { color: var(--muted); }
.seo .review { font-size: 12px; color: var(--muted); border-left: 2px solid var(--line-strong); padding: 6px 10px; margin: 12px 0; }
.seo code, .seo pre { font-family: var(--mono); font-size: 12px; }
.seo pre { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px; overflow: auto; white-space: pre-wrap; }
.page-seo #brief { max-width: 820px; margin: 0 auto; padding-block: 48px; }
.seo .aff-note { margin: 8px 0 16px; font-size: 12px; line-height: 1.45; color: var(--muted); }
.seo .aff-note a { color: var(--muted); }
@media (max-width: 640px) {
  .seo { padding-top: 24px; }
  .seo .related, .seo .seo-tools { grid-template-columns: 1fr; }
  .seo .table-wrap { overflow: visible; }
  .seo table, .seo tbody, .seo tr, .seo td { display: block; width: 100%; }
  .seo thead { display: none; }
  .seo tr { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 6px 14px; margin: 0 0 10px; }
  .seo td { border: 0; padding: 7px 0; display: grid; grid-template-columns: minmax(96px, 38%) 1fr; gap: 12px; }
  .seo td + td { border-top: 1px solid var(--line); }
  .seo td[data-label]::before { content: attr(data-label); color: var(--muted); font-size: 12px; font-weight: 600; }
  .seo td:not([data-label]) { display: block; }
}
@media print {
  .nav, .footer-main, #brief, .seo .cta, .seo .cta-secondary { display: none !important; }
  body { background: #fff; color: #111; padding: 0; }
  .seo a, .seo p, .seo li { color: #111; }
  .seo .answer { background: #f4f4f4; border-color: #ccc; }
}
`.trim();

export function renderPage({
  relFile,
  lang,
  title,
  description,
  h1,
  answerHtml,
  bodyHtml,
  breadcrumbs,
  hreflang,
  schemas,
  related,
  tools = null,
  moduleCta,
  extraHead = '',
  noindex = false,
  noCapture = false,
  origin,
  asOfLabel,
  chrome,
  ogImage = null,
  updated = null
}) {
  const canonical = origin + canonicalPath(relFile);
  const robots = noindex ? 'noindex, follow' : 'index, follow';
  const crumbHtml = breadcrumbs.map((c, i) => {
    const last = i === breadcrumbs.length - 1;
    if (last || !c.href) return `<span>${esc(c.name)}</span>`;
    return `<a href="${esc(c.href)}">${esc(c.name)}</a> <span aria-hidden="true">/</span> `;
  }).join('');

  const hreflangTags = hreflang.map((h) =>
    `  <link rel="alternate" hreflang="${esc(h.lang)}" href="${esc(h.href)}">`
  ).join('\n');

  const breadcrumbLd = {
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((c, i) => {
      const item = { '@type': 'ListItem', position: i + 1, name: c.name };
      if (c.abs) item.item = c.abs;
      return item;
    })
  };

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#org`,
        name: 'Virtuse',
        legalName: 'Virtuse Wealth Management, a.s.',
        logo: `${origin}/email-virtuse-v-mark.png`,
        address: { '@type': 'PostalAddress', streetAddress: 'Borinka 65', postalCode: '900 32', addressLocality: 'Borinka', addressCountry: 'SK' },
        vatID: 'SK2022293042',
        taxID: '36709042',
        url: `${origin}/`,
        description: 'Non-custodial hub for Bitcoin-only services. Virtuse never holds your keys.'
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: 'Virtuse',
        url: `${origin}/`,
        inLanguage: lang,
        publisher: { '@id': `${origin}/#org` }
      },
      breadcrumbLd,
      ...schemas
    ]
  };

  const relatedHtml = related.length
    ? `<h2>${esc(chrome.relatedHeading)}</h2><div class="related">${related.map((r) =>
      `<a href="${esc(r.href)}">${esc(r.label)}</a>`
    ).join('')}</div>`
    : '';

  // "Related tools" cards (tax guides): descriptive anchors to the same-language tools.
  const toolsHtml = tools && tools.items.length
    ? `<h2>${esc(tools.heading)}</h2><div class="seo-tools">${tools.items.map((x) =>
      `<a href="${esc(x.href)}"><b>${esc(x.title)}</b><span>${esc(x.text)}</span></a>`
    ).join('')}</div>`
    : '';

  const ctaHtml = moduleCta
    ? `<p><a class="cta" href="${esc(moduleCta.href)}">${esc(moduleCta.label)}</a></p>`
    : '';

  const v2 = CHROME_V2[lang] || CHROME_V2.en;
  // Language menus (nav + footer) point at this page in each language, else that language's home.
  const alt = {};
  for (const h of hreflang) if (h.lang !== 'x-default') alt[h.lang] = h.path ? '/' + h.path.replace(/^\/+/, '') : h.href.replace(origin, '');
  const fill = (frag) => frag.replace(/\{\{ALT:([a-z]{2})\}\}/g, (_, x) => alt[x] || (x === 'en' ? '/' : `/${x}/`));
  const nav = fill(v2.nav);
  const foot = fill(v2.foot);
  const briefHtml = (noindex || noCapture) ? '' : v2.brief;

  const wc = wordCount(answerHtml.replace(/<[^>]+>/g, ' '));
  const og = ogImage || defaultOgImage(relFile, moduleCta, origin);

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
${noCapture ? '' : CHROME_V2._head + '\n'}<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${esc(canonical)}">
${hreflangTags}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Virtuse">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="${esc(chrome.locale)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(og)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="vb-cfo-stage" content="wait">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/site-v2.min.css?v=${SITE_CSS_V}">
<style>${CSS}</style>
${extraHead}
<script type="application/ld+json">${jsonLd(graph)}</script>
${v2.i18n ? v2.i18n + '\n' : ''}</head>
<body class="page-seo no-split">
<!-- generated by seo-build; do not edit by hand. answerWords=${wc} -->
${nav}

<main class="wrap" id="top">
<article class="seo">
  <nav class="crumbs" aria-label="Breadcrumb">${crumbHtml}</nav>
  <p class="asof">${esc(chrome.asOfPrefix)} ${esc(asOfLabel)}</p>
  <h1>${esc(h1)}</h1>
${updated ? `  <p class="asof updated">${esc(updated.label)} <time datetime="${esc(updated.iso)}">${esc(updated.text)}</time></p>
` : ''}  <div class="answer"><p>${answerHtml}</p></div>
  ${bodyHtml}
  ${ctaHtml}
  ${toolsHtml ? toolsHtml + '\n  ' : ''}${relatedHtml}
  <aside class="disclaimers">
    <p>${esc(chrome.disclaimerTax)}</p>
    <p>${esc(chrome.disclaimerKeys)}</p>
    <p>${esc(chrome.disclaimerKyc)}</p>
  </aside>
</article>
${briefHtml ? '\n  ' + briefHtml + '\n' : ''}
  ${foot}
</main>

<script src="/site-v2.js?v=${SITE_V2}" defer></script>
${CF_SNIPPET}
</body>
</html>
`;
}

/** Default share image per page type when a page sets none. */
function defaultOgImage(relFile, moduleCta, origin) {
  const href = moduleCta ? moduleCta.href : '';
  let img = 'og-cover.jpg';
  if (/(^|\/)buy-bitcoin\//.test(relFile)) img = 'og/fee-index.jpg';
  else if (/dac8/.test(relFile)) img = 'og/bitcoin-tax.jpg';
  else if (/stacking\.html/.test(href)) img = 'og/stacking.jpg';
  else if (/loan\.html/.test(href)) img = 'og/loan.jpg';
  else if (/tax-agent\.html/.test(href)) img = 'og/tax-agent.jpg';
  return `${origin}/${img}`;
}

export const CHROME = {
  en: {
    navTax: 'Tax guides',
    navFees: 'Fee Index',
    navDca: 'DCA',
    navConcierge: 'Partner Finder',
    relatedHeading: 'Related guides',
    asOfPrefix: 'Data as of',
    disclaimerTax: 'Indicative 2026 overview – not tax advice.',
    disclaimerKeys: 'Virtuse never holds your keys.',
    disclaimerKyc: 'KYC and onboarding are completed on each partner’s regulated platform. Virtuse is a non-custodial hub and does not hold funds or customer data for those platforms.',
    privacy: 'Privacy',
    terms: 'Terms',
    locale: 'en_US',
    homeHref: 'index.html',
    taxHref: 'bitcoin-tax/',
    feesHref: 'bitcoin-fee-index/',
    dcaHref: 'bitcoin-dca-calculator/',
    conciergeHref: 'concierge.html',
    privacyHref: 'privacy-policy.html',
    brief: { heading: 'Get <span>the Brief</span>', line: 'Virtuse Brief. Bitcoin-only. No tokens. No PR.', placeholder: 'Email address', button: 'Subscribe', fine: 'Weekly on Monday. Unsubscribe anytime.', sending: 'Sending...', ok: 'You\'re in. Brief goes out Monday.', fail: 'Something went wrong. Please try again.', network: 'Network error — please try again.' },
    termsHref: 'terms-and-conditions.html'
  },
  de: {
    navTax: 'Steuerratgeber',
    navFees: 'Gebührenindex',
    navDca: 'DCA',
    navConcierge: 'Partner Finder',
    relatedHeading: 'Verwandte Ratgeber',
    asOfPrefix: 'Stand der Daten',
    disclaimerTax: 'Unverbindlicher Überblick 2026 – keine Steuerberatung.',
    disclaimerKeys: 'Virtuse verwahrt niemals Ihre Schlüssel.',
    disclaimerKyc: 'KYC und Onboarding erfolgen auf der regulierten Plattform des jeweiligen Partners. Virtuse ist ein Non-Custodial-Hub und verwahrt weder Guthaben noch Kundendaten dieser Plattformen.',
    privacy: 'Datenschutz',
    terms: 'AGB',
    locale: 'de_DE',
    homeHref: 'index.html',
    taxHref: 'de/bitcoin-steuern/',
    feesHref: 'bitcoin-fee-index/',
    dcaHref: 'de/bitcoin-dca-rechner/',
    conciergeHref: 'concierge.html',
    privacyHref: 'privacy-policy.html',
    brief: { heading: 'Holen Sie sich <span>den Brief</span>', line: 'Virtuse Brief. Nur Bitcoin. Keine Token. Keine PR.', placeholder: 'E-Mail-Adresse', button: 'Brief erhalten', fine: 'Jeden Montag. Jederzeit abbestellbar.', sending: 'Wird gesendet...', ok: 'Sie sind dabei. Der Brief kommt am Montag.', fail: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.', network: 'Netzwerkfehler – bitte versuchen Sie es erneut.' },
    termsHref: 'terms-and-conditions.html'
  },
  sk: {
    navTax: 'Daňové návody',
    navFees: 'Index poplatkov',
    navDca: 'DCA',
    navConcierge: 'Partner Finder',
    relatedHeading: 'Súvisiace návody',
    asOfPrefix: 'Stav údajov',
    disclaimerTax: 'Orientačný prehľad 2026 – nejde o daňové poradenstvo.',
    disclaimerKeys: 'Virtuse nikdy nedrží vaše kľúče.',
    disclaimerKyc: 'KYC a registrácia prebiehajú na regulovanej platforme príslušného partnera. Virtuse je nekustodiálny hub a nedrží prostriedky ani údaje klientov týchto platforiem.',
    privacy: 'Ochrana súkromia',
    terms: 'Obchodné podmienky',
    locale: 'sk_SK',
    homeHref: 'sk/index.html',
    taxHref: 'sk/bitcoin-dane/',
    feesHref: 'sk/bitcoin-index-poplatkov/',
    dcaHref: 'sk/bitcoin-dca-kalkulacka/',
    conciergeHref: 'sk/concierge.html',
    privacyHref: 'sk/privacy-policy.html',
    brief: { heading: 'Odoberať <span>Brief</span>', line: 'Virtuse Brief. Iba Bitcoin. Žiadne tokeny. Žiadne PR.', placeholder: 'E-mailová adresa', button: 'Odoberať', fine: 'Každý pondelok. Odhlásenie kedykoľvek.', sending: 'Odosielam...', ok: 'Ste v tom. Brief vychádza v pondelok.', fail: 'Niečo sa pokazilo. Skúste to prosím znova.', network: 'Chyba siete. Skúste to prosím znova.' },
    termsHref: 'sk/terms-and-conditions.html'
  },
  cs: {
    navTax: 'Daňové návody',
    navFees: 'Index poplatků',
    navDca: 'DCA',
    navConcierge: 'Partner Finder',
    relatedHeading: 'Související návody',
    asOfPrefix: 'Stav údajů',
    disclaimerTax: 'Orientační přehled 2026 – nejde o daňové poradenství.',
    disclaimerKeys: 'Virtuse nikdy nedrží vaše klíče.',
    disclaimerKyc: 'KYC a registrace probíhají na regulované platformě příslušného partnera. Virtuse je nekustodiální hub a nedrží prostředky ani údaje klientů těchto platforem.',
    privacy: 'Ochrana osobních údajů',
    terms: 'Obchodní podmínky',
    locale: 'cs_CZ',
    homeHref: 'cs/index.html',
    taxHref: 'cs/bitcoin-dane/',
    feesHref: 'cs/bitcoin-index-poplatku/',
    dcaHref: 'cs/bitcoin-dca-kalkulacka/',
    conciergeHref: 'cs/concierge.html',
    privacyHref: 'cs/privacy-policy.html',
    brief: { heading: 'Odebírat <span>Brief</span>', line: 'Virtuse Brief. Jen Bitcoin. Žádné tokeny. Žádné PR.', placeholder: 'E-mailová adresa', button: 'Odebírat', fine: 'Každé pondělí. Odhlášení kdykoli.', sending: 'Odesílání...', ok: 'Hotovo. Brief vychází v pondělí.', fail: 'Něco se pokazilo. Zkuste to znovu.', network: 'Chyba sítě. Zkuste to znovu.' },
    termsHref: 'cs/terms-and-conditions.html'
  },
  pl: {
    navTax: 'Poradniki podatkowe',
    navFees: 'Indeks opłat',
    navDca: 'DCA',
    navConcierge: 'Partner Finder',
    relatedHeading: 'Powiązane poradniki',
    asOfPrefix: 'Stan danych',
    disclaimerTax: 'Przegląd orientacyjny 2026 – nie stanowi porady podatkowej.',
    disclaimerKeys: 'Virtuse nigdy nie przechowuje Państwa kluczy.',
    disclaimerKyc: 'KYC i rejestracja odbywają się na regulowanej platformie danego partnera. Virtuse to niepowierniczy hub i nie przechowuje środków ani danych klientów tych platform.',
    privacy: 'Polityka prywatności',
    terms: 'Regulamin',
    locale: 'pl_PL',
    homeHref: 'pl/index.html',
    taxHref: 'pl/bitcoin-podatki/',
    feesHref: 'pl/bitcoin-indeks-oplat/',
    dcaHref: 'pl/bitcoin-kalkulator-dca/',
    conciergeHref: 'pl/concierge.html',
    privacyHref: 'pl/privacy-policy.html',
    brief: { heading: 'Zapisz się <span>na Brief</span>', line: 'Virtuse Brief. Tylko Bitcoin. Bez tokenów. Bez PR-u.', placeholder: 'Adres e-mail', button: 'Zapisz się', fine: 'Co tydzień w poniedziałek. Rezygnacja w dowolnym momencie.', sending: 'Wysyłanie...', ok: 'Gotowe. Brief ukazuje się w poniedziałki.', fail: 'Coś poszło nie tak. Prosimy spróbować ponownie.', network: 'Błąd sieci. Prosimy spróbować ponownie.' },
    termsHref: 'pl/terms-and-conditions.html'
  },
  hu: {
    navTax: 'Adózási útmutatók',
    navFees: 'Díjindex',
    navDca: 'DCA',
    navConcierge: 'Partner Finder',
    relatedHeading: 'Kapcsolódó útmutatók',
    asOfPrefix: 'Adatok állapota:',
    disclaimerTax: 'Tájékoztató áttekintés 2026 – nem adótanácsadás.',
    disclaimerKeys: 'A Virtuse soha nem kezeli az Ön kulcsait.',
    disclaimerKyc: 'A KYC és a regisztráció az adott partner szabályozott platformján történik. A Virtuse nem letétkezelő hub, és nem kezeli ezeknek a platformoknak az ügyfélpénzeit vagy ügyféladatait.',
    privacy: 'Adatvédelmi tájékoztató',
    terms: 'Felhasználási feltételek',
    locale: 'hu_HU',
    homeHref: 'hu/index.html',
    taxHref: 'hu/bitcoin-adozas/',
    feesHref: 'hu/bitcoin-dijindex/',
    dcaHref: 'hu/bitcoin-dca-kalkulator/',
    conciergeHref: 'hu/concierge.html',
    privacyHref: 'hu/privacy-policy.html',
    brief: { heading: 'Iratkozzon fel <span>a Briefre</span>', line: 'Virtuse Brief. Csak Bitcoin. Tokenek nélkül. PR nélkül.', placeholder: 'E-mail-cím', button: 'Feliratkozás', fine: 'Minden hétfőn. Bármikor leiratkozhat.', sending: 'Küldés...', ok: 'Kész. A Brief hétfőnként érkezik.', fail: 'Hiba történt. Kérjük, próbálja újra.', network: 'Hálózati hiba. Kérjük, próbálja újra.' },
    termsHref: 'hu/terms-and-conditions.html'
  },
  uk: {
    navTax: 'Податкові гіди',
    navFees: 'Індекс комісій',
    navDca: 'DCA',
    navConcierge: 'Partner Finder',
    relatedHeading: 'Пов’язані гіди',
    asOfPrefix: 'Дані станом на',
    disclaimerTax: 'Довідковий огляд 2026 – не є податковою консультацією.',
    disclaimerKeys: 'Virtuse ніколи не зберігає ваші ключі.',
    disclaimerKyc: 'KYC і реєстрація відбуваються на регульованій платформі відповідного партнера. Virtuse — некастодіальний хаб і не зберігає кошти чи дані клієнтів цих платформ.',
    privacy: 'Політика конфіденційності',
    terms: 'Умови використання',
    locale: 'uk_UA',
    homeHref: 'uk/index.html',
    taxHref: 'uk/bitcoin-podatky/',
    feesHref: 'uk/bitcoin-indeks-komisii/',
    dcaHref: 'uk/bitcoin-kalkuliator-dca/',
    conciergeHref: 'uk/concierge.html',
    privacyHref: 'uk/privacy-policy.html',
    brief: { heading: 'Отримайте <span>Brief</span>', line: 'Virtuse Brief. Лише Біткоїн. Жодних токенів. Жодного PR.', placeholder: 'Електронна пошта', button: 'Отримати Brief', fine: 'Щопонеділка. Відписатися можна будь-коли.', sending: 'Надсилання...', ok: 'Готово! Brief вийде в понеділок.', fail: 'Щось пішло не так. Спробуйте ще раз.', network: 'Помилка мережі. Спробуйте ще раз.' },
    termsHref: 'uk/terms-and-conditions.html'
  },
  ru: {
    navTax: 'Налоговые гиды',
    navFees: 'Индекс комиссий',
    navDca: 'DCA',
    navConcierge: 'Partner Finder',
    relatedHeading: 'Связанные гиды',
    asOfPrefix: 'Данные по состоянию на',
    disclaimerTax: 'Справочный обзор 2026 – не является налоговой консультацией.',
    disclaimerKeys: 'Virtuse никогда не хранит ваши ключи.',
    disclaimerKyc: 'KYC и регистрация проходят на регулируемой платформе соответствующего партнёра. Virtuse — некастодиальный хаб и не хранит средства или данные клиентов этих платформ.',
    privacy: 'Политика конфиденциальности',
    terms: 'Условия использования',
    locale: 'ru_RU',
    homeHref: 'ru/index.html',
    taxHref: 'ru/bitcoin-nalogi/',
    feesHref: 'ru/bitcoin-indeks-komissiy/',
    dcaHref: 'ru/bitcoin-kalkulyator-dca/',
    conciergeHref: 'ru/concierge.html',
    privacyHref: 'ru/privacy-policy.html',
    brief: { heading: 'Получите <span>Brief</span>', line: 'Virtuse Brief. Только Биткоин. Без токенов. Без пиара.', placeholder: 'Электронная почта', button: 'Подписаться', fine: 'Каждый понедельник. Отписаться можно в любой момент.', sending: 'Отправка...', ok: 'Готово. Brief выходит в понедельник.', fail: 'Что-то пошло не так. Попробуйте ещё раз.', network: 'Ошибка сети. Попробуйте ещё раз.' },
    termsHref: 'ru/terms-and-conditions.html'
  },
  fr: {
    navTax: 'Guides fiscaux',
    navFees: 'Indice des frais',
    navDca: 'DCA',
    navConcierge: 'Partner Finder',
    relatedHeading: 'Guides associés',
    asOfPrefix: 'Données au',
    disclaimerTax: 'Aperçu indicatif 2026 – pas un conseil fiscal.',
    disclaimerKeys: 'Virtuse ne détient jamais vos clés.',
    disclaimerKyc: 'Le KYC et l’inscription se font sur la plateforme régulée de chaque partenaire. Virtuse est un hub non custodial et ne détient ni les fonds ni les données clients de ces plateformes.',
    privacy: 'Politique de confidentialité',
    terms: 'CGU',
    locale: 'fr_FR',
    homeHref: 'fr/index.html',
    taxHref: 'fr/bitcoin-fiscalite/',
    feesHref: 'fr/bitcoin-indice-frais/',
    dcaHref: 'fr/bitcoin-calculateur-dca/',
    conciergeHref: 'fr/concierge.html',
    privacyHref: 'fr/privacy-policy.html',
    brief: { heading: 'Recevez <span>le Brief</span>', line: 'Virtuse Brief. 100\u00a0% Bitcoin. Pas de tokens. Pas de RP.', placeholder: 'Adresse e-mail', button: 'Recevoir le Brief', fine: 'Chaque lundi. Désabonnement à tout moment.', sending: 'Envoi en cours...', ok: 'C\'est fait. Le Brief part lundi.', fail: 'Une erreur est survenue. Veuillez réessayer.', network: 'Erreur réseau. Veuillez réessayer.' },
    termsHref: 'fr/terms-and-conditions.html'
  },
  es: {
    navTax: 'Guías fiscales',
    navFees: 'Índice de comisiones',
    navDca: 'DCA',
    navConcierge: 'Partner Finder',
    relatedHeading: 'Guías relacionadas',
    asOfPrefix: 'Datos del',
    disclaimerTax: 'Resumen orientativo 2026 – no es asesoramiento fiscal.',
    disclaimerKeys: 'Virtuse nunca guarda sus claves.',
    disclaimerKyc: 'El KYC y el registro se realizan en la plataforma regulada de cada partner. Virtuse es un hub no custodial y no guarda fondos ni datos de clientes de esas plataformas.',
    privacy: 'Política de privacidad',
    terms: 'Términos y condiciones',
    locale: 'es_ES',
    homeHref: 'es/index.html',
    taxHref: 'es/bitcoin-impuestos/',
    feesHref: 'es/bitcoin-indice-comisiones/',
    dcaHref: 'es/bitcoin-calculadora-dca/',
    conciergeHref: 'es/concierge.html',
    privacyHref: 'es/privacy-policy.html',
    brief: { heading: 'Reciba <span>el Brief</span>', line: 'Virtuse Brief. Solo Bitcoin. Sin tokens. Sin RP.', placeholder: 'Correo electrónico', button: 'Suscribirse', fine: 'Cada lunes. Cancele cuando quiera.', sending: 'Enviando...', ok: 'Listo. El Brief sale el lunes.', fail: 'Algo salió mal. Inténtelo de nuevo.', network: 'Error de red. Inténtelo de nuevo.' },
    termsHref: 'es/terms-and-conditions.html'
  }
};
