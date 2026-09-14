import {
  esc,
  jsonLd,
  toRoot,
  canonicalPath,
  wordCount
} from './util.mjs';

const CSS = `
:root {
  --btc-orange: #f7931a;
  --dark: #0d1421;
  --dark-card: #161f30;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --border: #30363d;
  --green: #3fb950;
  --max: 820px;
}
* { box-sizing: border-box; }
html { color-scheme: dark; }
body {
  margin: 0;
  font-family: Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
  background: var(--dark);
  color: var(--text);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--btc-orange); }
.nav {
  display: flex; flex-wrap: wrap; gap: 10px 18px;
  align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
  background: rgba(13,20,33,.96); position: sticky; top: 0;
}
.nav a { color: var(--text-muted); text-decoration: none; font-size: 14px; font-weight: 500; }
.nav a:hover, .nav a[aria-current="page"] { color: var(--text); }
.brand { font-weight: 800; color: var(--text) !important; font-size: 18px; }
.wrap { max-width: var(--max); margin: 0 auto; padding: 28px 20px 64px; }
.crumbs { font-size: 13px; color: var(--text-muted); margin-bottom: 18px; }
.crumbs a { color: var(--text-muted); }
.answer {
  background: var(--dark-card); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px 18px; margin: 16px 0 28px;
}
.answer p { margin: 0; }
h1 { font-size: 1.7rem; line-height: 1.25; margin: 0 0 8px; }
h2 { font-size: 1.2rem; margin: 32px 0 10px; }
h3 { font-size: 1.05rem; margin: 22px 0 8px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 12px 0 20px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { color: var(--text-muted); font-weight: 600; }
.cta {
  display: inline-block; background: var(--btc-orange); color: #0d0902 !important;
  text-decoration: none; font-weight: 700; padding: 10px 16px; border-radius: 8px; margin: 8px 8px 8px 0;
}
.cta-secondary {
  display: inline-block; border: 1px solid var(--border); color: var(--text) !important;
  text-decoration: none; padding: 10px 16px; border-radius: 8px; margin: 8px 8px 8px 0;
}
.muted { color: var(--text-muted); font-size: 14px; }
.disclaimers { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 13px; color: var(--text-muted); }
.related { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 16px; }
.lang { font-size: 13px; }
.flag { font-weight: 600; }
.review { font-size: 12px; color: var(--text-muted); border-left: 2px solid var(--btc-orange); padding: 6px 10px; margin: 12px 0; }
code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
pre {
  background: #111a2b; border: 1px solid var(--border); border-radius: 8px;
  padding: 12px; overflow: auto; white-space: pre-wrap;
}
.asof { font-size: 13px; color: var(--text-muted); margin: 0 0 8px; }
footer.site-footer {
  border-top: 1px solid var(--border); padding: 24px 20px; color: var(--text-muted); font-size: 13px;
}
footer.site-footer .inner { max-width: var(--max); margin: 0 auto; }
@media (max-width: 640px) {
  h1 { font-size: 1.45rem; }
  .nav { padding: 12px 14px; }
}
@media print {
  .nav, .cta, .cta-secondary, footer.site-footer { display: none !important; }
  body { background: #fff; color: #111; }
  a { color: #111; }
  .answer { background: #f4f4f4; border-color: #ccc; }
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
  moduleCta,
  extraHead = '',
  noindex = false,
  origin,
  asOfLabel,
  chrome
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
        url: `${origin}/`,
        description: 'Non-custodial hub for Bitcoin-only services. Virtuse never holds your keys.'
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: 'Virtuse',
        url: `${origin}/`,
        inLanguage: lang === 'de' ? 'de' : 'en',
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

  const ctaHtml = moduleCta
    ? `<p><a class="cta" href="${esc(moduleCta.href)}">${esc(moduleCta.label)}</a></p>`
    : '';

  const langSwitch = (hreflang.find((h) => h.lang === 'en') && hreflang.find((h) => h.lang === 'de'))
    ? `<nav class="lang" aria-label="Language">${hreflang
      .filter((h) => h.lang === 'en' || h.lang === 'de')
      .map((h) => `<a href="${esc(toRoot(relFile, h.path || h.href.replace(origin, '')))}"${h.lang === lang ? ' aria-current="page"' : ''}>${h.lang.toUpperCase()}</a>`)
      .join(' · ')}</nav>`
    : '';

  const wc = wordCount(answerHtml.replace(/<[^>]+>/g, ' '));

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${esc(canonical)}">
${hreflangTags}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Virtuse">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="${lang === 'de' ? 'de_DE' : 'en_US'}">
<link rel="icon" type="image/svg+xml" href="${esc(toRoot(relFile, 'favicon.svg'))}">
<style>${CSS}</style>
${extraHead}
<script type="application/ld+json">${jsonLd(graph)}</script>
</head>
<body>
<!-- generated by seo-build; do not edit by hand. answerWords=${wc} -->
<header class="nav">
  <a class="brand" href="${esc(toRoot(relFile, 'index.html'))}">Virtuse</a>
  <nav aria-label="Primary">
    <a href="${esc(toRoot(relFile, lang === 'de' ? 'de/bitcoin-steuern/' : 'bitcoin-tax/'))}">${esc(chrome.navTax)}</a>
    <a href="${esc(toRoot(relFile, 'bitcoin-fee-index/'))}">${esc(chrome.navFees)}</a>
    <a href="${esc(toRoot(relFile, lang === 'de' ? 'de/bitcoin-dca-rechner/' : 'bitcoin-dca-calculator/'))}">${esc(chrome.navDca)}</a>
    <a href="${esc(toRoot(relFile, 'concierge.html'))}">${esc(chrome.navConcierge)}</a>
  </nav>
  ${langSwitch}
</header>
<main class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">${crumbHtml}</nav>
  <p class="asof">${esc(chrome.asOfPrefix)} ${esc(asOfLabel)}</p>
  <h1>${esc(h1)}</h1>
  <div class="answer"><p>${answerHtml}</p></div>
  ${bodyHtml}
  ${ctaHtml}
  ${relatedHtml}
  <aside class="disclaimers">
    <p>${esc(chrome.disclaimerTax)}</p>
    <p>${esc(chrome.disclaimerKeys)}</p>
    <p>${esc(chrome.disclaimerKyc)}</p>
  </aside>
</main>
<footer class="site-footer"><div class="inner">
  <p>©2018 - 2026 Virtuse Group. <a href="${esc(toRoot(relFile, 'privacy-policy.html'))}">${esc(chrome.privacy)}</a> · <a href="${esc(toRoot(relFile, 'terms-and-conditions.html'))}">${esc(chrome.terms)}</a></p>
</div></footer>
</body>
</html>
`;
}

export const CHROME = {
  en: {
    navTax: 'Tax guides',
    navFees: 'Fee Index',
    navDca: 'DCA',
    navConcierge: 'Concierge',
    relatedHeading: 'Related guides',
    asOfPrefix: 'Data as of',
    disclaimerTax: 'Indicative 2026 overview – not tax advice.',
    disclaimerKeys: 'Virtuse never holds your keys.',
    disclaimerKyc: 'KYC and onboarding are completed on each partner’s regulated platform. Virtuse is a non-custodial hub and does not hold funds or customer data for those platforms.',
    privacy: 'Privacy',
    terms: 'Terms'
  },
  de: {
    navTax: 'Steuer-Guides',
    navFees: 'Gebührenindex',
    navDca: 'DCA',
    navConcierge: 'Concierge',
    relatedHeading: 'Verwandte Guides',
    asOfPrefix: 'Stand der Daten',
    disclaimerTax: 'Unverbindlicher Überblick 2026 – keine Steuerberatung.',
    disclaimerKeys: 'Virtuse verwahrt niemals Ihre Schlüssel.',
    disclaimerKyc: 'KYC und Onboarding erfolgen auf der regulierten Plattform des jeweiligen Partners. Virtuse ist ein nicht-kustodialer Hub und verwahrt weder Guthaben noch Kundendaten dieser Plattformen.',
    privacy: 'Datenschutz',
    terms: 'AGB'
  }
};
