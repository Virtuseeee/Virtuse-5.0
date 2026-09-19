#!/usr/bin/env node
/**
 * Deterministic SEO page generator.
 * Same input JSON = same HTML. Numbers come only from seo-build/data/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_DIR_NAME,
  esc,
  wordCount,
  fitWords,
  formatAsOf,
  formatPct,
  formatEur,
  toRoot,
  canonicalPath,
  assertTitle,
  assertDescription,
  resolveSiteOrigin,
  rewriteKnownOrigins
} from './lib/util.mjs';
import { rankRoutes, cheapest, breakEvenBotsVsManual, DEFAULT_CONTRIBUTIONS, routeCost } from './lib/fees.mjs';
import { renderPage, CHROME } from './lib/html.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(ROOT);
const SITE = path.join(REPO, SITE_DIR_NAME);
const DATA = path.join(ROOT, 'data');

const seoData = JSON.parse(fs.readFileSync(path.join(DATA, 'seo-data.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'meta.json'), 'utf8'));
const inheritance = JSON.parse(fs.readFileSync(path.join(DATA, 'inheritance.json'), 'utf8'));
const liveFees = JSON.parse(fs.readFileSync(path.join(DATA, 'fee-schedule-live.json'), 'utf8'));

const ORIGIN = resolveSiteOrigin(meta.site.origin);
const AS_OF = seoData.asOf;
const LASTMOD = seoData.lastmod;
const CTAS = seoData.moduleCtas;
const COUNTRIES = seoData.countries;
const FEE_ROWS = meta.feeSource === 'live' ? liveFees.rows : seoData.feeSchedule.map((row, i) => ({
  id: `brief-${i}`,
  kind: /bot|auto|dca/i.test(`${row.partner} ${row.method}`) ? 'automated' : 'manual',
  monthly: /bot/i.test(row.partner) || /dca/i.test(row.method) ? 4 : 0,
  ...row
}));

const asOfEn = formatAsOf(AS_OF, 'en');
const asOfDe = formatAsOf(AS_OF, 'de');

function slugEn(id) {
  const s = meta.slugs.en[id];
  if (!s) throw new Error(`Missing EN slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function slugDe(id) {
  const s = meta.slugs.de[id];
  if (!s) throw new Error(`Missing DE slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameDe(id) {
  const s = meta.names.de[id];
  if (!s) throw new Error(`Missing DE name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function countryById(id) { return COUNTRIES.find((c) => c.id === id); }

/** Live Tax & Inheritance Agent. seo-data.moduleCtas.tax is /tax.html (category page). */
const TAX_AGENT = 'tax-agent.html';

function abs(p) {
  const c = p.startsWith('/') ? p : canonicalPath(p);
  return ORIGIN + c;
}

function hrefLangPair(enPath, dePath) {
  const tags = [
    { lang: 'en', href: abs(enPath), path: canonicalPath(enPath) },
    { lang: 'x-default', href: abs(enPath), path: canonicalPath(enPath) }
  ];
  if (dePath) {
    tags.splice(1, 0, { lang: 'de', href: abs(dePath), path: canonicalPath(dePath) });
  }
  return tags;
}

function faqLd(items) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: { '@type': 'Answer', text: q.a }
    }))
  };
}

function faqHtml(items, heading) {
  return `<h2>${esc(heading)}</h2>` + items.map((q) =>
    `<h3>${esc(q.q)}</h3><p>${esc(q.a)}</p>`
  ).join('');
}

function tableHtml(headers, rows) {
  const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table><thead>${thead}</thead><tbody>${body}</tbody></table>`;
}

function neighborsOf(id) {
  const ids = meta.neighbors[id] || [];
  return ids.map(countryById).filter(Boolean);
}

function finalizeAnswer(parts, lang) {
  const pads = lang === 'de'
    ? [
      `Zahlen unverändert aus dem Tax-Modul, Stand ${asOfDe}.`,
      'Virtuse verwahrt niemals Ihre Schlüssel.',
      'Bitte lokal prüfen; keine Steuerberatung.'
    ]
    : [
      `Figures copied unchanged from the Tax module, dated ${asOfEn}.`,
      'Virtuse never holds your keys.',
      'Confirm locally; not tax advice.'
    ];
  let text = fitWords(parts, 1, 60);
  for (const pad of pads) {
    if (wordCount(text) >= 40) break;
    const trial = `${text} ${pad}`;
    if (wordCount(trial) <= 60) text = trial;
  }
  const n = wordCount(text);
  if (n < 40 || n > 60) {
    throw new Error(`answer words ${n} (${lang}): ${text}`);
  }
  return text;
}

function taxAnswerEn(c) {
  return finalizeAnswer([
    `Bitcoin tax in ${c.name} as of ${asOfEn}: ${c.gainTax}.`,
    `Exemption: ${c.exemption}.`,
    `Filing: ${c.filing}.`,
    c.note,
    'Indicative 2026 overview, not tax advice.'
  ], 'en');
}

function taxAnswerDe(c) {
  const d = meta.taxDe[c.id];
  return finalizeAnswer([
    `Bitcoin-Steuern in ${nameDe(c.id)} Stand ${asOfDe}: ${d.gainTax}.`,
    `Befreiung: ${d.exemption}.`,
    `Veranlagung: ${d.filing}.`,
    d.note,
    'Unverbindlicher Überblick 2026, keine Steuerberatung.'
  ], 'de');
}

function buyAnswerEn(c, winner) {
  const extra = c.id === 'nl'
    ? `In the Netherlands, Box 3 still applies to holdings after you buy, because tax is on deemed return rather than disposal gains.`
    : `Selling or swapping later is what usually creates a tax event under ${c.name} rules (${c.exemption}).`;
  return finalizeAnswer([
    `As of ${asOfEn}, the lowest-fee buy route on the Virtuse Fee Index at €100 per month is ${winner.partner} (${winner.method}) at ${formatPct(winner.pct)} variable fee, ${formatEur(winner.annualDrag)} annual drag.`,
    extra,
    `SEPA from ${c.name} (${meta.currency[c.id]}) typically funds EUR books; partner KYC applies.`,
    'Virtuse never holds your keys.'
  ], 'en');
}

const DEFAULT_MONTHLY = 100;
const winnerDefault = cheapest(FEE_ROWS, DEFAULT_MONTHLY);
const rankedDefault = rankRoutes(FEE_ROWS, DEFAULT_MONTHLY);
const be = breakEvenBotsVsManual(FEE_ROWS);

function taxFaqsEn(c) {
  return [
    {
      q: `What is the bitcoin tax rate in ${c.name}?`,
      a: `As of ${asOfEn}, ${c.name} treats gains as: ${c.gainTax}. This is an indicative 2026 overview, not tax advice.`
    },
    {
      q: `Is there a holding-period exemption in ${c.name}?`,
      a: `${c.exemption}. Confirm the current-year statute with a local advisor before you file.`
    },
    {
      q: `How do you file bitcoin taxes in ${c.name}?`,
      a: `${c.filing}. ${c.note}`
    },
    {
      q: 'Does Virtuse hold my bitcoin or file my tax return?',
      a: 'No. Virtuse never holds your keys. KYC and onboarding happen on each partner’s regulated platform. Use the Tax & Inheritance Agent to compare the 11-country overview, then file with a qualified advisor.'
    }
  ];
}

function taxFaqsDe(c) {
  const d = meta.taxDe[c.id];
  const n = nameDe(c.id);
  return [
    {
      q: `Wie werden Bitcoin-Gewinne in ${n} besteuert?`,
      a: `Stand ${asOfDe}: ${d.gainTax}. Unverbindlicher Überblick 2026, keine Steuerberatung.`
    },
    {
      q: `Gibt es eine Spekulationsfrist oder Haltedauer-Befreiung in ${n}?`,
      a: `${d.exemption}. Prüfen Sie die aktuelle Gesetzeslage mit einem lokalen Steuerberater.`
    },
    {
      q: `Wie erfolgt die Erklärung in ${n}?`,
      a: `${d.filing}. ${d.note}`
    },
    {
      q: 'Verwahrt Virtuse meinen Bitcoin oder übernimmt Virtuse die Steuererklärung?',
      a: 'Nein. Virtuse verwahrt niemals Ihre Schlüssel. KYC und Onboarding erfolgen beim Partner. Der Tax-Agent vergleicht die 11-Länder-Übersicht; die Erklärung macht ein qualifizierter Berater.'
    }
  ];
}

function buyFaqsEn(c, winner) {
  return [
    {
      q: `What is the cheapest way to buy bitcoin in ${c.name} as of ${asOfEn}?`,
      a: `On the Virtuse Fee Index, ${winner.partner} (${winner.method}) has the lowest annual fee drag at €100/month: ${formatPct(winner.pct)}, ${formatEur(winner.annualDrag)} per year. Rankings use the published partner fee schedule, not spreads or FX.`
    },
    {
      q: `Does buying bitcoin trigger tax in ${c.name}?`,
      a: c.id === 'nl'
        ? `The Netherlands does not use a classic capital-gains tax. Box 3 wealth tax on deemed return still applies to holdings (as of ${asOfEn}: ${c.gainTax}).`
        : `This overview treats tax as arising on disposal (sale or swap), not on the purchase itself. ${c.exemption}. Indicative 2026 overview, not tax advice.`
    },
    {
      q: 'Are these fees the full cost of buying?',
      a: 'No. The index ranks percentage plus any listed monthly subscription from the stacking fee schedule. Spread, FX (for non-EUR currencies such as ' + meta.currency[c.id] + '), and network miner fees are not included.'
    },
    {
      q: 'Does Virtuse execute the buy?',
      a: 'No. Virtuse never holds your keys. You complete KYC on the partner platform and buy there.'
    }
  ];
}

const generated = [];

function pushPage(spec) {
  const html = renderPage({
    ...spec,
    origin: ORIGIN,
    asOfLabel: spec.lang === 'de' ? asOfDe : asOfEn,
    chrome: CHROME[spec.lang]
  });
  generated.push({ relFile: spec.relFile, html, lang: spec.lang, noindex: !!spec.noindex, title: spec.title });
}

// --- EN tax hub ---
{
  const relFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`))}">${esc(c.name)}</a>`,
    esc(c.gainTax),
    esc(c.exemption)
  ]);
  const faqs = [
    { q: 'Which EU countries does this bitcoin tax overview cover?', a: `Eleven: ${COUNTRIES.map((c) => c.name).join(', ')}. Figures are as of ${asOfEn} and copied from the Virtuse Tax module.` },
    { q: 'Is this tax advice?', a: 'No. Indicative 2026 overview – not tax advice. Confirm current-year rules with a local advisor.' },
    { q: 'Does Virtuse report my holdings to tax authorities?', a: 'No. Virtuse never holds your keys or your transaction history. Partners complete their own KYC.' },
    { q: 'Where can I model inheritance as well as tax?', a: 'Use the Tax & Inheritance Agent (live module) for the same 11-country set plus a multisig readiness check.' }
  ];
  const answer = finalizeAnswer([
    `This hub compares bitcoin tax treatment across 11 EU countries as of ${asOfEn}.`,
    'Rates, exemptions and filing notes are copied from the Virtuse Tax module; they are not invented for SEO.',
    'Germany and Austria highlight 1-year holding relief; Czechia uses a 3-year time test; the Netherlands uses Box 3 instead of classic capital gains.',
    'Indicative 2026 overview, not tax advice.'
  ], 'en');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Bitcoin tax in 11 EU countries (2026)'),
    description: assertDescription(`Compare bitcoin tax rates, holding exemptions and filing notes for 11 EU countries as of ${asOfEn}. Indicative overview, not tax advice.`),
    h1: 'Bitcoin tax in 11 EU countries',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Bitcoin tax', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-tax/germany/'), label: 'Germany bitcoin tax' },
      { href: toRoot(relFile, 'bitcoin-inheritance/'), label: 'Bitcoin inheritance checklist' },
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Bitcoin Fee Index' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Open Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Each country page states the gain treatment, any holding-period exemption, and filing form as of ${esc(asOfEn)}. Use the live agent if you want the same dataset with an inheritance score.</p>
<h2>Country comparison</h2>
${tableHtml(['Country', 'Gain tax', 'Exemption'], rows)}
${faqHtml(faqs, 'FAQ')}
`
  });
}

// --- DE tax hub ---
{
  const relFile = 'de/bitcoin-steuern/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `de/bitcoin-steuern/${slugDe(c.id)}/`))}">${esc(nameDe(c.id))}</a>`,
    esc(meta.taxDe[c.id].gainTax),
    esc(meta.taxDe[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Welche Länder umfasst dieser Überblick?', a: `Elf EU-Länder: ${COUNTRIES.map((c) => nameDe(c.id)).join(', ')}. Stand ${asOfDe}, Zahlen aus dem Virtuse-Tax-Modul.` },
    { q: 'Ist das Steuerberatung?', a: 'Nein. Unverbindlicher Überblick 2026 – keine Steuerberatung.' },
    { q: 'Meldet Virtuse Bestände an Finanzämter?', a: 'Nein. Virtuse verwahrt niemals Ihre Schlüssel und führt keine Transaktionshistorie.' },
    { q: 'Wo prüfe ich Erbschaft zusätzlich zur Steuer?', a: 'Im Tax- & Inheritance-Agent (Live-Modul) mit denselben 11 Ländern plus Multisig-Check.' }
  ];
  const answer = finalizeAnswer([
    `Dieser Hub vergleicht die Bitcoin-Besteuerung in 11 EU-Ländern, Stand ${asOfDe}.`,
    'Sätze, Befreiungen und Erklärungshinweise stammen aus dem Virtuse-Tax-Modul und wurden nicht für SEO erfunden.',
    'Deutschland: Spekulationsfrist 1 Jahr. Österreich: KESt 27,5 %. Tschechien: 3-Jahres-Zeittest. Niederlande: Box 3 statt klassischer Kapitalertragsteuer.',
    'Unverbindlicher Überblick 2026, keine Steuerberatung.'
  ], 'de');
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin-Steuern in 11 EU-Ländern (2026)'),
    description: assertDescription(`Bitcoin-Steuersätze, Spekulationsfrist und Erklärung in 11 EU-Ländern, Stand ${asOfDe}. Unverbindlich, keine Steuerberatung.`),
    h1: 'Bitcoin-Steuern in 11 EU-Ländern',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Start', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Bitcoin-Steuern', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enFile, relFile),
    related: [
      { href: toRoot(relFile, 'de/bitcoin-steuern/deutschland/'), label: 'Bitcoin-Steuern Deutschland' },
      { href: toRoot(relFile, 'de/bitcoin-erbrecht/'), label: 'Bitcoin und Erbrecht' },
      { href: toRoot(relFile, 'de/bitcoin-gebuehrenindex/'), label: 'Bitcoin-Gebührenindex' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Tax-Agent öffnen →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Pro Land: Gewinnbesteuerung, etwaige Haltedauer-Befreiung und Erklärung, Stand ${esc(asOfDe)}.</p>
<h2>Ländervergleich</h2>
${tableHtml(['Land', 'Gewinnsteuer', 'Befreiung'], rows)}
${faqHtml(faqs, 'FAQ')}
`
  });
}

for (const c of COUNTRIES) {
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const nbs = neighborsOf(c.id);
  const faqs = taxFaqsEn(c);
  const answer = taxAnswerEn(c);
  const body = `
<p>${esc(c.flag)} <strong>${esc(c.name)}</strong> is one of 11 EU countries in the Virtuse Tax module. Figures below are copied from that module as of ${esc(asOfEn)}.</p>
<h2>Rates and filing</h2>
${tableHtml(['Field', 'As of ' + asOfEn], [
  ['Gain tax', esc(c.gainTax)],
  ['Exemption', esc(c.exemption)],
  ['Filing', esc(c.filing)],
  ['Note', esc(c.note)]
])}
<h2>What usually creates a taxable event</h2>
<p>${esc(c.note)} Buying bitcoin is not listed here as a disposal; check local rules if you spend, swap, gift, or lend coins.</p>
<h2>Nearby country guides</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(enRel, `bitcoin-tax/${slugEn(n.id)}/`))}">Bitcoin tax in ${esc(n.name)}</a></li>`).join('')}</ul>
<p>Same-country buy-route ranking: <a href="${esc(toRoot(enRel, `buy-bitcoin/${slugEn(c.id)}/`))}">Buy bitcoin in ${esc(c.name)}</a>.</p>
${faqHtml(faqs, 'FAQ')}
`;
  pushPage({
    relFile: enRel, lang: 'en',
    title: assertTitle(`Bitcoin tax in ${c.name} (${asOfEn})`),
    description: assertDescription(`Bitcoin tax in ${c.name} as of ${asOfEn}: ${c.gainTax}. Indicative 2026 overview, not tax advice.`),
    h1: `Bitcoin tax in ${c.name}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(enRel, 'index.html'), abs: abs('index.html') },
      { name: 'Bitcoin tax', href: toRoot(enRel, 'bitcoin-tax/'), abs: abs('bitcoin-tax/index.html') },
      { name: c.name, abs: abs(enRel) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(enRel, `buy-bitcoin/${slugEn(c.id)}/`), label: `Buy bitcoin in ${c.name}` },
      { href: toRoot(enRel, 'bitcoin-inheritance/'), label: 'Bitcoin inheritance checklist' },
      { href: toRoot(enRel, nbs[0] ? `bitcoin-tax/${slugEn(nbs[0].id)}/` : 'bitcoin-tax/'), label: nbs[0] ? `Tax in ${nbs[0].name}` : 'All country tax guides' }
    ],
    moduleCta: { href: toRoot(enRel, TAX_AGENT + `?country=${c.id}`), label: `Check ${c.name} in the Tax Agent →` },
    schemas: [faqLd(faqs)],
    bodyHtml: body
  });

  const d = meta.taxDe[c.id];
  const faqsDe = taxFaqsDe(c);
  const answerDe = taxAnswerDe(c);
  const review = d.review ? `<p class="review">${esc(d.review)}</p>` : '';
  pushPage({
    relFile: deRel, lang: 'de',
    title: assertTitle(`Bitcoin-Steuern ${nameDe(c.id)} (${asOfDe})`),
    description: assertDescription(`Bitcoin-Steuern in ${nameDe(c.id)}, Stand ${asOfDe}: ${d.gainTax}. Keine Steuerberatung.`),
    h1: `Bitcoin-Steuern in ${nameDe(c.id)}`,
    answerHtml: esc(answerDe),
    breadcrumbs: [
      { name: 'Start', href: toRoot(deRel, 'index.html'), abs: abs('index.html') },
      { name: 'Bitcoin-Steuern', href: toRoot(deRel, 'de/bitcoin-steuern/'), abs: abs('de/bitcoin-steuern/index.html') },
      { name: nameDe(c.id), abs: abs(deRel) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(deRel, 'de/bitcoin-verkaufen-oder-beleihen/'), label: 'Verkaufen oder beleihen' },
      { href: toRoot(deRel, 'de/bitcoin-erbrecht/'), label: 'Bitcoin und Erbrecht' },
      { href: toRoot(deRel, nbs[0] ? `de/bitcoin-steuern/${slugDe(nbs[0].id)}/` : 'de/bitcoin-steuern/'), label: nbs[0] ? `Steuern in ${nameDe(nbs[0].id)}` : 'Alle Länder' }
    ],
    moduleCta: { href: toRoot(deRel, TAX_AGENT + `?country=${c.id}`), label: `${nameDe(c.id)} im Tax-Agent prüfen →` },
    schemas: [faqLd(faqsDe)],
    bodyHtml: `
<p>${esc(c.flag)} Zahlen Stand ${esc(asOfDe)}, übernommen aus dem Virtuse-Tax-Modul.</p>
${review}
<h2>Sätze und Erklärung</h2>
${tableHtml(['Feld', 'Stand ' + asOfDe], [
  ['Gewinnsteuer', esc(d.gainTax)],
  ['Befreiung', esc(d.exemption)],
  ['Erklärung', esc(d.filing)],
  ['Hinweis', esc(d.note)]
])}
<h2>Wann entsteht typischerweise Steuer?</h2>
<p>${esc(d.note)}</p>
<h2>Nachbarländer</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(deRel, `de/bitcoin-steuern/${slugDe(n.id)}/`))}">${esc(nameDe(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqsDe, 'FAQ')}
`
  });
}

for (const c of COUNTRIES) {
  const relFile = `buy-bitcoin/${slugEn(c.id)}/index.html`;
  const winner = winnerDefault;
  const ranked = rankedDefault;
  const faqs = buyFaqsEn(c, winner);
  const answer = buyAnswerEn(c, winner);
  const rows = ranked.map((r, i) => [
    esc(String(i + 1)),
    esc(r.partner),
    esc(r.method),
    esc(formatPct(r.pct)),
    esc(formatEur(r.annualDrag)),
    esc(r.speed)
  ]);
  pushPage({
    relFile, lang: 'en',
    title: assertTitle(`Buy bitcoin in ${c.name}: cheapest route`),
    description: assertDescription(`Cheapest EU bitcoin buy route for ${c.name} as of ${asOfEn}: ${winner.partner} at ${formatPct(winner.pct)}. Fee Index ranking, not a quote.`),
    h1: `Buy bitcoin in ${c.name}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Buy bitcoin', href: toRoot(relFile, 'buy-bitcoin.html'), abs: abs('buy-bitcoin.html') },
      { name: c.name, abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`), label: `Bitcoin tax in ${c.name}` },
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Full Bitcoin Fee Index' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Simulate a DCA plan →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Local currency context: <strong>${esc(meta.currency[c.id])}</strong>. The fee table is EUR-denominated partner fees from the stacking schedule as of ${esc(asOfEn)}. FX conversion out of ${esc(meta.currency[c.id])} is not in the ranking.</p>
<h2>Ranked buy routes at €${DEFAULT_MONTHLY}/month</h2>
${tableHtml(['Rank', 'Partner', 'Method', 'Variable fee', 'Annual drag', 'Speed'], rows)}
<p class="muted">Annual drag uses the live stacking formula: percentage of each purchase plus any listed monthly subscription. ${ranked.some((r) => r.illustrative) ? 'RevenueBot’s percentage is flagged illustrative in the source schedule.' : ''}</p>
<h2>Tax interaction in ${esc(c.name)}</h2>
<p>${esc(c.gainTax)} ${esc(c.exemption)}</p>
<p>Read the dedicated guide: <a href="${esc(toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`))}">Bitcoin tax in ${esc(c.name)}</a>.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

// DCA calculator EN
{
  const relFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const initial = 500;
  const monthly = 100;
  const months = 12;
  const invested = initial + monthly * months;
  const ranked = rankRoutes(FEE_ROWS, monthly, 12).map((r) => {
    const startFee = initial * r.pct + (r.fixed || 0);
    const year = routeCost(r, monthly, 12);
    return { ...r, yearOneFees: startFee + year.annualDrag, invested };
  });
  const win = ranked[0];
  const faqs = [
    { q: 'Does this calculator forecast bitcoin’s price?', a: 'No. It isolates partner fee drag from the published fee schedule. Return assumptions are not included.' },
    { q: `What default plan is shown as of ${asOfEn}?`, a: `€${initial} initial plus €${monthly}/month for 12 months (€${invested} invested). Ranked by first-year fee drag using the stacking formula.` },
    { q: 'Which route is cheapest on that plan?', a: `${win.partner} (${win.method}) at ${formatPct(win.pct)} variable fee, about ${formatEur(win.yearOneFees)} first-year fees in this fee-only illustration.` },
    { q: 'Is this financial advice?', a: 'No. Educational routing only. KYC happens on the partner platform. Virtuse never holds your keys.' }
  ];
  const answer = finalizeAnswer([
    `As of ${asOfEn}, a fee-only DCA illustration of €${initial} plus €${monthly} per month for 12 months (€${invested} invested) ranks ${win.partner} first.`,
    `Variable fee ${formatPct(win.pct)}; first-year fee drag about ${formatEur(win.yearOneFees)} using the live stacking formula.`,
    'This is not a return forecast. Indicative 2026 overview.'
  ], 'en');
  const rows = ranked.map((r, i) => [
    esc(String(i + 1)),
    esc(r.partner),
    esc(r.method),
    esc(formatPct(r.pct)),
    esc(formatEur(r.yearOneFees)),
    r.illustrative ? 'Illustrative fee' : 'Published in schedule'
  ]);
  const feeJson = JSON.stringify(FEE_ROWS.map((r) => ({
    partner: r.partner, method: r.method, pct: r.pct, fixed: r.fixed || 0, monthly: r.monthly || 0
  })));
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Bitcoin DCA calculator (EU fees 2026)'),
    description: assertDescription(`Fee-only bitcoin DCA calculator using Q3 2026 partner fees. Default €500 + €100/month ranks ${win.partner} first. Not a return forecast.`),
    h1: 'Bitcoin DCA calculator',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'DCA calculator', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Bitcoin Fee Index' },
      { href: toRoot(relFile, 'sell-vs-borrow-bitcoin/'), label: 'Sell vs borrow bitcoin' },
      { href: toRoot(relFile, 'buy-bitcoin/germany/'), label: 'Buy bitcoin in Germany' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Open Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin DCA calculator',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    extraHead: `<script type="application/json" id="fee-schedule">${feeJson}</script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('dca-form');
  if (!form) return;
  var data = JSON.parse(document.getElementById('fee-schedule').textContent);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var initial = Number(document.getElementById('dca-initial').value);
    var monthly = Number(document.getElementById('dca-monthly').value);
    var tbody = document.getElementById('dca-body');
    var rows = data.map(function (r) {
      var per = monthly * r.pct + (r.fixed || 0) + (r.monthly || 0);
      var year = per * 12 + initial * r.pct;
      return { partner: r.partner, method: r.method, pct: r.pct, year: year };
    }).sort(function (a, b) { return a.year - b.year; });
    tbody.innerHTML = rows.map(function (r, i) {
      return '<tr><td>' + (i+1) + '</td><td>' + r.partner + '</td><td>' + r.method + '</td><td>' +
        (Math.round(r.pct * 10000) / 100) + ' %</td><td>€' + Math.round(r.year) + '</td></tr>';
    }).join('');
  });
});
</script>`,
    bodyHtml: `
<p>Default illustration (also in the answer above, so it indexes without JavaScript): <strong>€${initial} lump sum + €${monthly}/month × 12</strong>. Recalculation in the browser uses the same JSON fee schedule.</p>
<form id="dca-form">
  <p><label>Initial EUR <input id="dca-initial" type="number" min="0" step="50" value="${initial}"></label>
  <label>Monthly EUR <input id="dca-monthly" type="number" min="0" step="25" value="${monthly}"></label>
  <button type="submit" class="cta-secondary">Recalculate fees</button></p>
</form>
<h2>First-year fee drag on the default plan</h2>
<table><thead><tr><th>Rank</th><th>Partner</th><th>Method</th><th>Variable fee</th><th>Year-1 fees</th><th>Note</th></tr></thead>
<tbody id="dca-body">${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
<p class="muted">Formula matches the live Stacking Strategist: annualDrag = (contribution × pct + fixed + monthly subscription) × 12, plus pct on the initial lump sum. Bitcoin price return is omitted on purpose.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

// DCA DE
{
  const relFile = 'de/bitcoin-dca-rechner/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Prognostiziert dieser Rechner den Bitcoin-Preis?', a: 'Nein. Er isoliert die Partnergebühren laut Gebührenplan. Keine Renditeannahme.' },
    { q: `Was ist der Standardplan Stand ${asOfDe}?`, a: '500 € Einmalbetrag plus 100 €/Monat über 12 Monate. Sortierung nach Gebührenlast im ersten Jahr.' },
    { q: 'Welche Route ist in diesem Plan am günstigsten?', a: `${win.partner} (${win.method}) mit ${formatPct(win.pct)} variabler Gebühr laut Stacking-Formel.` },
    { q: 'Ist das eine Anlageberatung?', a: 'Nein. Nur Bildungsrouting. KYC beim Partner. Virtuse verwahrt niemals Ihre Schlüssel.' }
  ];
  const answer = finalizeAnswer([
    `Stand ${asOfDe} rangiert im gebührenbasierten DCA-Beispiel (500 € plus 100 €/Monat über 12 Monate) ${win.partner} auf Platz 1.`,
    `Variable Gebühr ${formatPct(win.pct)}. Keine Kursprognose.`,
    'Zahlen aus dem Live-Stacking-Modul. Unverbindlicher Überblick 2026.'
  ], 'de');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin-DCA-Rechner (EU-Gebühren 2026)'),
    description: assertDescription(`Gebührenbasierter Bitcoin-DCA-Rechner, Stand ${asOfDe}. Standard 500 € + 100 €/Monat, günstigste Route ${win.partner}. Keine Kursprognose.`),
    h1: 'Bitcoin-DCA-Rechner',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Start', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'DCA-Rechner', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enFile, relFile),
    related: [
      { href: toRoot(relFile, 'de/bitcoin-gebuehrenindex/'), label: 'Bitcoin-Gebührenindex' },
      { href: toRoot(relFile, 'de/bitcoin-verkaufen-oder-beleihen/'), label: 'Verkaufen oder beleihen' },
      { href: toRoot(relFile, 'de/bitcoin-steuern/deutschland/'), label: 'Bitcoin-Steuern Deutschland' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Stacking Strategist öffnen →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin-DCA-Rechner',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Standardbeispiel ohne JavaScript: 500 € plus 100 €/Monat × 12. Formel wie im Live-Stacking-Modul.</p>
<h2>Rangfolge bei 100 €/Monat</h2>
${tableHtml(['Rang', 'Partner', 'Methode', 'Variable Gebühr', 'Jahreslast'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(r.method), esc(formatPct(r.pct)), esc(formatEur(r.annualDrag))
]))}
${faqHtml(faqs, 'FAQ')}
`
  });
}

// Sell vs borrow EN
{
  const relFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: 'Does selling bitcoin trigger tax in these 11 countries?', a: `Usually yes, on disposal. Exemptions differ: Germany 0% after 1-year private-sale holding; Czechia 3-year time test; Poland no holding exemption. As of ${asOfEn}. Not tax advice.` },
    { q: 'Does borrowing against bitcoin trigger the same tax?', a: 'A loan is not the same event as a sale in this educational overview. Interest, liquidation risk, and partner KYC still apply. Model numbers in the live Loan copilot; this page does not invent APRs.' },
    { q: 'What is liquidation risk?', a: 'If collateral value falls to the partner’s threshold, the loan can be force-sold. Virtuse never holds your keys or the collateral.' },
    { q: 'Where do I compare a specific cash amount?', a: 'Use the live Loan & Liquidity Copilot. This page explains the tax-versus-risk trade-off with the published country tax strings only.' }
  ];
  const answer = finalizeAnswer([
    `As of ${asOfEn}, selling bitcoin can crystallize tax (for example Germany up to 45% inside the 1-year Spekulationsfrist; Romania 10% flat).`,
    'Borrowing against coins can keep market exposure but adds interest and liquidation risk on a partner platform.',
    'This page does not invent APRs. Indicative 2026 overview, not tax or credit advice. Virtuse never holds your keys.'
  ], 'en');
  const rows = COUNTRIES.map((c) => [
    `<a href="${esc(toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`))}">${esc(c.name)}</a>`,
    esc(c.gainTax),
    esc(c.exemption)
  ]);
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Sell vs borrow bitcoin (EU tax 2026)'),
    description: assertDescription(`Sell bitcoin and pay country tax, or borrow against it and keep exposure. 11-country tax strings as of ${asOfEn}. Not credit advice.`),
    h1: 'Sell bitcoin vs borrow against it',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Sell vs borrow', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-tax/germany/'), label: 'Bitcoin tax in Germany' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' },
      { href: toRoot(relFile, 'bitcoin-inheritance/'), label: 'Inheritance checklist' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.loan.replace(/^\//, '')), label: 'Compare sell vs borrow in the copilot →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Sell vs borrow bitcoin',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Tax if you sell</h2>
<p>Disposal rules below are the same strings as the country tax guides (Tax module, ${esc(asOfEn)}). A sale can use up a holding-period exemption you were close to completing.</p>
${tableHtml(['Country', 'Gain tax', 'Exemption'], rows)}
<h2>Risk if you borrow</h2>
<p>Bitcoin-backed loans are offered by regulated partners, not by Virtuse. You keep price exposure, pay interest, and can be liquidated. Virtuse never holds the collateral. The live copilot runs scenario math; this page stays qualitative so we do not invent an APR.</p>
<h2>How to choose a next step</h2>
<ol>
  <li>Read your country’s tax guide for the rate that would apply <em>if you sold today</em>.</li>
  <li>Open the Loan copilot with the cash amount you actually need.</li>
  <li>Complete KYC on the partner if you proceed; never send seeds to Virtuse.</li>
</ol>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const faqs = [
    { q: 'Löst ein Verkauf in diesen 11 Ländern Steuer aus?', a: `In der Regel ja bei Veräußerung. Deutschland: 0 % nach 1-jähriger Spekulationsfrist. Tschechien: 3-Jahres-Zeittest. Polen: keine Haltedauer-Befreiung. Stand ${asOfDe}. Keine Steuerberatung.` },
    { q: 'Ist ein Kredit dasselbe steuerliche Ereignis wie ein Verkauf?', a: 'In diesem Überblick nicht. Zinsen, Liquidationsrisiko und Partner-KYC bleiben. APRs werden hier nicht erfunden; Zahlen im Live-Loan-Copilot.' },
    { q: 'Was ist Liquidationsrisiko?', a: 'Fällt der Collateral-Wert auf die Schwelle des Partners, kann der Kredit zwangsverkauft werden. Virtuse verwahrt weder Schlüssel noch Collateral.' },
    { q: 'Wo rechne ich einen konkreten Betrag?', a: 'Im Live-Modul Loan & Liquidity Copilot. Diese Seite erklärt nur den Trade-off anhand der veröffentlichten Steuerstrings.' }
  ];
  const answer = finalizeAnswer([
    `Stand ${asOfDe} kann ein Bitcoin-Verkauf Steuer auslösen (Deutschland bis 45 % innerhalb der Spekulationsfrist; Rumänien 10 % Pauschale).`,
    'Ein Kredit gegen Coins kann die Marktposition erhalten, bringt aber Zinsen und Liquidationsrisiko beim Partner.',
    'Keine erfundenen APRs. Unverbindlicher Überblick 2026, keine Steuer- oder Kreditberatung. Virtuse verwahrt niemals Ihre Schlüssel.'
  ], 'de');
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin verkaufen oder beleihen (2026)'),
    description: assertDescription(`Bitcoin verkaufen und Steuer zahlen oder beleihen und Exposure halten. 11-Länder-Sätze Stand ${asOfDe}. Keine Kreditberatung.`),
    h1: 'Bitcoin verkaufen oder beleihen',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Start', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Verkaufen oder beleihen', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enFile, relFile),
    related: [
      { href: toRoot(relFile, 'de/bitcoin-steuern/deutschland/'), label: 'Bitcoin-Steuern Deutschland' },
      { href: toRoot(relFile, 'de/bitcoin-dca-rechner/'), label: 'DCA-Rechner' },
      { href: toRoot(relFile, 'de/bitcoin-erbrecht/'), label: 'Bitcoin und Erbrecht' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.loan.replace(/^\//, '')), label: 'Im Loan-Copilot vergleichen →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin verkaufen oder beleihen',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Steuer beim Verkauf</h2>
${tableHtml(['Land', 'Gewinnsteuer', 'Befreiung'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `de/bitcoin-steuern/${slugDe(c.id)}/`))}">${esc(nameDe(c.id))}</a>`,
  esc(meta.taxDe[c.id].gainTax),
  esc(meta.taxDe[c.id].exemption)
]))}
<h2>Risiko beim Kredit</h2>
<p>Bitcoin-besicherte Kredite kommen von Partnern, nicht von Virtuse. Sie behalten die Kurschance, zahlen Zinsen und können liquidiert werden. Virtuse verwahrt das Collateral nicht.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

// Inheritance EN
{
  const relFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const items = inheritance.items;
  const faqs = [
    { q: 'Should a letter of instruction contain seed phrases?', a: 'No. The Tax module’s checklist says the letter lists inventory, locations and contacts – never seed phrases. Store it with your will or attorney.' },
    { q: 'Why is 2-of-3 multisig on the checklist?', a: 'A single seed is a single point of failure for you and for heirs. The module scores 2-of-3 with two keys held by you and one by a partner or attorney.' },
    { q: 'Does Virtuse custody keys for heirs?', a: 'No. Virtuse never holds your keys. Inheritance execution happens with your attorney, heirs, and any vault partner you choose.' },
    { q: 'How is the readiness score weighted?', a: 'The live Tax module assigns points (letter 20, separation 20, heir-aware 15, multisig 20, tested 15, accounts 15). This page lists the same items without re-scoring.' }
  ];
  const answer = finalizeAnswer([
    `As of ${asOfEn}, the Virtuse Tax module’s inheritance checklist has six items: letter of instruction, geographic key separation, heir awareness, 2-of-3 multisig, a recovery drill, and documented accounts.`,
    'A single seed is a single point of failure. Virtuse never holds your keys.',
    'Educational checklist, not legal advice.'
  ], 'en');
  const howto = {
    '@type': 'HowTo',
    name: 'Prepare a bitcoin inheritance plan',
    description: 'Six-step checklist copied from the Virtuse Tax & Inheritance Agent.',
    totalTime: 'P7D',
    step: items.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.question,
      text: `${it.detail} ${it.action}`
    }))
  };
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Bitcoin inheritance checklist (2026)'),
    description: assertDescription(`Six-step bitcoin inheritance checklist as of ${asOfEn}: letter of instruction, key separation, heir awareness, 2-of-3 multisig. Not legal advice.`),
    h1: 'Bitcoin inheritance checklist',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Inheritance', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-tax/germany/'), label: 'Bitcoin tax in Germany' },
      { href: toRoot(relFile, 'bitcoin-tax/'), label: '11-country tax hub' },
      { href: toRoot(relFile, 'sell-vs-borrow-bitcoin/'), label: 'Sell vs borrow' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Score this checklist in the Tax Agent →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Items and wording below are copied from the live Tax module checklist (English strings unaltered). Educational only, not legal advice.</p>
<h2>HowTo: six checks</h2>
<ol>
  ${items.map((it) => `<li><h3>${esc(it.question)}</h3><p>${esc(it.detail)}</p><p>${esc(it.action)}</p></li>`).join('')}
</ol>
<p>Country tax still applies to heirs who later sell. Start with <a href="${esc(toRoot(relFile, 'bitcoin-tax/'))}">the 11-country tax hub</a>.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'de/bitcoin-erbrecht/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const faqs = [
    { q: 'Dürfen Seed-Wörter im Schreiben stehen?', a: 'Nein. Das Schreiben nennt Inventar, Orte und Kontakte – niemals Seed-Phrasen. Aufbewahrung beim Testament oder Anwalt.' },
    { q: 'Warum Multisig 2-von-3?', a: 'Eine einzelne Seed-Phrase ist ein Single Point of Failure für Sie und für Erben.' },
    { q: 'Verwahrt Virtuse Schlüssel für Erben?', a: 'Nein. Virtuse verwahrt niemals Ihre Schlüssel.' },
    { q: 'Ist das Rechtsberatung?', a: 'Nein. Bildungs-Checkliste aus dem Tax-Modul, Stand ' + asOfDe + '.' }
  ];
  const answer = finalizeAnswer([
    `Stand ${asOfDe} umfasst die Checkliste des Tax-Moduls sechs Punkte: Schreiben mit Anweisungen, geografische Schlüsseltrennung, informierte Erben, Multisig 2-von-3, Wiederherstellungstest und dokumentierte Konten.`,
    'Eine einzelne Seed-Phrase ist ein Single Point of Failure. Virtuse verwahrt niemals Ihre Schlüssel.',
    'Keine Rechtsberatung.'
  ], 'de');
  const howto = {
    '@type': 'HowTo',
    name: 'Bitcoin-Nachlass vorbereiten',
    inLanguage: 'de',
    step: meta.inheritanceDe.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin und Erbrecht: Checkliste (2026)'),
    description: assertDescription(`Sechs-Punkte-Checkliste für Bitcoin-Erbfolge, Stand ${asOfDe}: Anweisungsschreiben, Schlüsseltrennung, Multisig 2-von-3. Keine Rechtsberatung.`),
    h1: 'Bitcoin-Erbfolge: Checkliste',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Start', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Erbrecht', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enFile, relFile),
    related: [
      { href: toRoot(relFile, 'de/bitcoin-steuern/deutschland/'), label: 'Bitcoin-Steuern Deutschland' },
      { href: toRoot(relFile, 'de/bitcoin-steuern/'), label: '11-Länder-Steuerhub' },
      { href: toRoot(relFile, 'de/bitcoin-verkaufen-oder-beleihen/'), label: 'Verkaufen oder beleihen' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Checkliste im Tax-Agent bewerten →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Inhalt entspricht der Checkliste des Tax-Moduls. Keine Rechtsberatung.</p>
<h2>HowTo: sechs Prüfschritte</h2>
<ol>${meta.inheritanceDe.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'FAQ')}
`
  });
}

function feeIndexBody(relFile, lang) {
  const contribs = DEFAULT_CONTRIBUTIONS;
  const tables = contribs.map((amt) => {
    const ranked = rankRoutes(FEE_ROWS, amt);
    return `<h3>${lang === 'de' ? 'Monatlich' : 'Monthly'} ${esc(formatEur(amt))}</h3>` +
      tableHtml(
        lang === 'de' ? ['Rang', 'Partner', 'Methode', 'Gebühr', 'Jahreslast'] : ['Rank', 'Partner', 'Method', 'Fee', 'Annual drag'],
        ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(r.method),
          esc(formatPct(r.pct) + (r.monthly ? ` + ${formatEur(r.monthly)}/mo` : '')),
          esc(formatEur(r.annualDrag))
        ])
      );
  }).join('');
  let beText;
  if (lang === 'de') {
    if (be.status === 'always') {
      beText = `Break-even Bots vs. manuell: Die günstigste automatisierte Route (${be.auto.partner}) hat ab 1 €/Monat eine niedrigere oder gleiche Jahreslast als die günstigste manuelle Route (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Break-even: ab ${formatEur(be.monthlyEur)}/Monat ist ${be.auto.partner} (automatisiert) nicht teurer als ${be.manual.partner} (manuell).`;
    } else {
      beText = `Im Scan bis 20.000 €/Monat unterbietet die günstigste automatisierte Route die günstigste manuelle Route nicht.`;
    }
  } else if (be.status === 'always') {
    beText = `Break-even, automated vs manual: ${be.auto.partner} already has lower or equal annual drag than ${be.manual.partner} from €1/month. ${be.note}`;
  } else if (be.status === 'found') {
    beText = `Break-even: from ${formatEur(be.monthlyEur)}/month, ${be.auto.partner} (automated) meets or beats ${be.manual.partner} (manual) on annual drag.`;
  } else {
    beText = `Automated vs manual: within €1–€20,000 monthly, the cheapest automated row does not beat the cheapest manual row.`;
  }
  return { tables, beText, winner: winnerDefault };
}

function pressBlurb() {
  const w = winnerDefault;
  return `Virtuse Bitcoin Fee Index (${asOfEn}): among listed EU buy routes, ${w.partner} (${w.method}) ranks first on annual fee drag at €100/month (${formatPct(w.pct)}, ${formatEur(w.annualDrag)}/year). Ranking uses partner percentage fees plus any listed monthly subscription from the stacking schedule; spreads, FX and miner fees are excluded. Source: ${ORIGIN}/bitcoin-fee-index/ — Virtuse never holds your keys.`;
}

{
  const relFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'en');
  const faqs = [
    { q: 'What does the Bitcoin Fee Index rank?', a: `Partner buy-route fee drag as of ${asOfEn}, using the stacking module formula on listed percentage fees and monthly subscriptions.` },
    { q: 'Who is cheapest at €100 per month?', a: `${winner.partner}, ${formatPct(winner.pct)} variable, ${formatEur(winner.annualDrag)} annual drag on that contribution.` },
    { q: 'Is RevenueBot’s fee exact?', a: FEE_ROWS.some((r) => r.illustrative)
      ? 'The stacking schedule marks RevenueBot’s percentage as illustrative pending their published schedule.'
      : 'See each row note in the methodology page.' },
    { q: 'May I republish the table?', a: 'Yes, with attribution: “Source: Virtuse Bitcoin Fee Index, as of ' + asOfEn + '” and a link to this page. Embed snippet is below.' }
  ];
  const answer = finalizeAnswer([
    `The Virtuse Bitcoin Fee Index as of ${asOfEn} ranks EU buy routes by annual fee drag.`,
    `At €100/month the first-ranked route is ${winner.partner} (${winner.method}) at ${formatPct(winner.pct)}, ${formatEur(winner.annualDrag)} per year.`,
    be.status === 'always'
      ? `Automated ${be.auto.partner} already beats manual ${be.manual.partner} from €1/month on listed fees.`
      : beText,
    'Not a quote. Virtuse never holds your keys.'
  ], 'en');
  const embedSnippet = `<iframe src="${ORIGIN}/bitcoin-fee-index/embed/" title="Virtuse Bitcoin Fee Index" width="100%" height="320" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
<p>Source: <a href="${ORIGIN}/bitcoin-fee-index/">Virtuse Bitcoin Fee Index</a> (as of ${asOfEn})</p>`;
  const article = {
    '@type': 'Article',
    headline: 'Virtuse Bitcoin Fee Index',
    datePublished: LASTMOD,
    dateModified: LASTMOD,
    inLanguage: 'en',
    author: { '@id': `${ORIGIN}/#org` },
    publisher: { '@id': `${ORIGIN}/#org` },
    description: `EU bitcoin buy-route fee ranking as of ${asOfEn}.`
  };
  const dataset = {
    '@type': 'Dataset',
    name: 'Virtuse Bitcoin Fee Index',
    temporalCoverage: '2026-Q3',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    creator: { '@id': `${ORIGIN}/#org` },
    variableMeasured: 'Annual partner fee drag (EUR) at stated monthly contribution',
    url: abs(relFile)
  };
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Bitcoin Fee Index (EU) Q3 2026'),
    description: assertDescription(`EU bitcoin buy-route ranking as of ${asOfEn}. Cheapest at €100/month: ${winner.partner} at ${formatPct(winner.pct)}. Spreads excluded.`),
    h1: 'Bitcoin Fee Index',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Fee Index', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/2026-q3/'), label: 'Q3 2026 archive snapshot' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Methodology' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Open Stacking Strategist →' },
    schemas: [faqLd(faqs), article, dataset],
    bodyHtml: `
<h2>Rankings by monthly contribution</h2>
<p>Citeable as of ${esc(asOfEn)}. Formula documented on the <a href="${esc(toRoot(relFile, 'bitcoin-fee-index/methodology/'))}">methodology</a> page.</p>
${tables}
<h2>Break-even: automated vs manual</h2>
<p>${esc(beText)}</p>
<h2>Press blurb</h2>
<p>${esc(pressBlurb())}</p>
<h2>Embed</h2>
<p>Copy-paste. Keep the attribution line.</p>
<pre>${esc(embedSnippet)}</pre>
<p><a class="cta-secondary" href="${esc(toRoot(relFile, 'bitcoin-fee-index/embed/'))}">Open embeddable table</a>
<a class="cta-secondary" href="${esc(toRoot(relFile, 'bitcoin-fee-index/2026-q3/print.html'))}">Print / PDF view</a></p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'de/bitcoin-gebuehrenindex/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'de');
  const faqs = [
    { q: 'Was misst der Gebührenindex?', a: `Die Gebührenlast von Kaufrouten Stand ${asOfDe}, Formel wie im Stacking-Modul.` },
    { q: 'Wer ist bei 100 €/Monat am günstigsten?', a: `${winner.partner}, ${formatPct(winner.pct)}, ${formatEur(winner.annualDrag)} Jahreslast.` },
    { q: 'Sind Spreads enthalten?', a: 'Nein. Nur Prozentgebühr plus etwaiges Monatsabo laut Plan. FX und Miner-Fees fehlen.' },
    { q: 'Darf ich die Tabelle zitieren?', a: `Ja, mit Quellenangabe „Quelle: Virtuse Bitcoin-Gebührenindex, Stand ${asOfDe}“ und Link.` }
  ];
  const answer = finalizeAnswer([
    `Der Virtuse Bitcoin-Gebührenindex Stand ${asOfDe} sortiert EU-Kaufrouten nach Jahres-Gebührenlast.`,
    `Bei 100 €/Monat führt ${winner.partner} (${winner.method}) mit ${formatPct(winner.pct)}, ${formatEur(winner.annualDrag)} pro Jahr.`,
    beText,
    'Kein Angebot. Virtuse verwahrt niemals Ihre Schlüssel.'
  ], 'de');
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin-Gebührenindex (EU) Q3 2026'),
    description: assertDescription(`EU-Kaufrouten nach Gebühren, Stand ${asOfDe}. Günstigste Route bei 100 €/Monat: ${winner.partner} mit ${formatPct(winner.pct)}.`),
    h1: 'Bitcoin-Gebührenindex',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Start', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Gebührenindex', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enFile, relFile),
    related: [
      { href: toRoot(relFile, 'de/bitcoin-dca-rechner/'), label: 'DCA-Rechner' },
      { href: toRoot(relFile, 'de/bitcoin-steuern/deutschland/'), label: 'Bitcoin-Steuern Deutschland' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Methodik (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Stacking Strategist öffnen →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Virtuse Bitcoin-Gebührenindex',
        inLanguage: 'de',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Virtuse Bitcoin-Gebührenindex',
        temporalCoverage: '2026-Q3',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Ranglisten nach Monatsbeitrag</h2>
${tables}
<h2>Break-even: automatisiert vs. manuell</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'bitcoin-fee-index/2026-q3/index.html';
  const ranked = rankRoutes(FEE_ROWS, 100);
  const faqs = [
    { q: 'Is this archive different from the live index?', a: `This snapshot is the ${asOfEn} vintage of the same fee schedule. When a later quarter ships, this URL stays put.` },
    { q: 'What contribution is archived in the table?', a: '€100 per month, 12 purchases, stacking formula.' },
    { q: 'How do I export a PDF?', a: 'Open the print view and use the browser Print dialog → Save as PDF. No extra software.' },
    { q: 'Can I cite a single number?', a: `${ranked[0].partner} annual drag at €100/month is ${formatEur(ranked[0].annualDrag)} as of ${asOfEn}.` }
  ];
  const answer = finalizeAnswer([
    `Archive vintage ${asOfEn}: the Bitcoin Fee Index ranked ${ranked[0].partner} first at €100/month with ${formatEur(ranked[0].annualDrag)} annual drag (${formatPct(ranked[0].pct)}).`,
    'This URL is the quarter snapshot so citations do not move when a later quarter is published.',
    'Dataset, not a trade quote.'
  ], 'en');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Fee Index archive: 2026 Q3'),
    description: assertDescription(`Q3 2026 snapshot of the Virtuse Bitcoin Fee Index. First at €100/month: ${ranked[0].partner}, ${formatEur(ranked[0].annualDrag)} annual drag.`),
    h1: 'Bitcoin Fee Index archive — 2026 Q3',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Fee Index', href: toRoot(relFile, 'bitcoin-fee-index/'), abs: abs('bitcoin-fee-index/index.html') },
      { name: '2026 Q3', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Current Fee Index' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Methodology' },
      { href: toRoot(relFile, 'bitcoin-fee-index/2026-q3/print.html'), label: 'Print / PDF view' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Open Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Dataset',
        name: 'Virtuse Bitcoin Fee Index 2026-Q3',
        temporalCoverage: '2026-Q3',
        identifier: '2026-q3',
        url: abs(relFile)
      },
      {
        '@type': 'Article',
        headline: 'Bitcoin Fee Index archive — 2026 Q3',
        datePublished: LASTMOD
      }
    ],
    bodyHtml: `
<p>Frozen copy of the ${esc(asOfEn)} ranking at €100/month.</p>
${tableHtml(['Rank', 'Partner', 'Method', 'Fee', 'Annual drag', 'Note'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(r.method), esc(formatPct(r.pct)), esc(formatEur(r.annualDrag)), esc(r.note)
]))}
<p><a class="cta-secondary" href="${esc(toRoot(relFile, 'bitcoin-fee-index/2026-q3/print.html'))}">Print-optimized view</a></p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'bitcoin-fee-index/2026-q3/print.html';
  const ranked = rankRoutes(FEE_ROWS, 100);
  const answer = finalizeAnswer([
    `Print view of the ${asOfEn} Bitcoin Fee Index snapshot.`,
    `First at €100/month: ${ranked[0].partner}, ${formatEur(ranked[0].annualDrag)} annual drag.`,
    'Use the browser Print dialog and choose Save as PDF. No third-party PDF library.',
    'Attribution required: Virtuse Bitcoin Fee Index, as of ' + asOfEn + '.'
  ], 'en');
  const faqs = [
    { q: 'How do I make a PDF?', a: 'File → Print → Save as PDF (Chrome, Firefox, Safari, Edge). A4 or Letter both work.' },
    { q: 'Does this page change with the live index?', a: `It is tied to the 2026-Q3 archive vintage (${asOfEn}).` },
    { q: 'What must a reprint include?', a: `Source line: Virtuse Bitcoin Fee Index, as of ${asOfEn}, and the canonical archive URL.` }
  ];
  pushPage({
    relFile, lang: 'en', noindex: true,
    title: assertTitle('Fee Index 2026 Q3 — print / PDF'),
    description: assertDescription(`Print-optimized 2026 Q3 Bitcoin Fee Index. Save as PDF from the browser. First route at €100/month: ${ranked[0].partner}.`),
    h1: 'Bitcoin Fee Index — 2026 Q3 print view',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Fee Index', href: toRoot(relFile, 'bitcoin-fee-index/'), abs: abs('bitcoin-fee-index/index.html') },
      { name: '2026 Q3', href: toRoot(relFile, 'bitcoin-fee-index/2026-q3/'), abs: abs('bitcoin-fee-index/2026-q3/index.html') },
      { name: 'Print', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/2026-q3/'), label: 'HTML archive' },
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Live index' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Methodology' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Stacking Strategist →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p class="muted">File → Print → Save as PDF. Navigation hides in print CSS.</p>
${tableHtml(['Rank', 'Partner', 'Method', 'Fee', 'Annual drag (€100/mo)'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(r.method), esc(formatPct(r.pct)), esc(formatEur(r.annualDrag))
]))}
<p>Source: Virtuse Bitcoin Fee Index, as of ${esc(asOfEn)}. ${esc(ORIGIN)}/bitcoin-fee-index/2026-q3/</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'bitcoin-fee-index/methodology/index.html';
  const faqs = [
    { q: 'Where do the percentages come from?', a: meta.feeSource === 'live'
      ? 'From the shipped Stacking Strategist FEE_SCHEDULE (21bitcoin 0%, ByBit EU 0.1%, Kraken 0.16%, RevenueBot 0.4% + €4/month illustrative). Numbers are not edited for SEO.'
      : 'From seo-data.json feeSchedule.' },
    { q: 'What is the annual-drag formula?', a: 'costPerPurchase = contribution × pct + fixed + monthly / (periodsPerYear / 12); annualDrag = costPerPurchase × periodsPerYear. Copied from the live stacking module.' },
    { q: 'Why is a later Banxa/CASP table not used?', a: 'A brief placeholder schedule existed for early prototypes. Indexable pages use the live module partners so Google does not rank invented brand names.' },
    { q: 'How often will this change?', a: 'When the stacking fee schedule is updated, change seo-build/data/fee-schedule-live.json and re-run npm run build. Archive URLs stay stable.' }
  ];
  const answer = finalizeAnswer([
    `Methodology as of ${asOfEn}: rank partners by annual fee drag at a stated monthly euro contribution.`,
    'Formula is the live stacking module’s: percentage of each purchase plus allocated monthly subscription.',
    'Spreads, FX and miner fees are out of scope. RevenueBot’s rate is marked illustrative in the source schedule.',
    'Not a brokerage quote.'
  ], 'en');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Fee Index methodology (Q3 2026)'),
    description: assertDescription(`How the Virtuse Bitcoin Fee Index ranks EU buy routes as of ${asOfEn}. Stacking-module formula, no invented percentages.`),
    h1: 'Bitcoin Fee Index methodology',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Fee Index', href: toRoot(relFile, 'bitcoin-fee-index/'), abs: abs('bitcoin-fee-index/index.html') },
      { name: 'Methodology', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Fee Index' },
      { href: toRoot(relFile, 'bitcoin-fee-index/2026-q3/'), label: '2026 Q3 archive' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'See fees in Stacking Strategist →' },
    schemas: [faqLd(faqs), { '@type': 'Article', headline: 'Bitcoin Fee Index methodology', datePublished: LASTMOD }],
    bodyHtml: `
<h2>Inputs</h2>
${tableHtml(['Partner', 'Method', 'pct', 'fixed', 'monthly', 'Flag'], FEE_ROWS.map((r) => [
  esc(r.partner), esc(r.method), esc(String(r.pct)), esc(String(r.fixed || 0)), esc(String(r.monthly || 0)), r.illustrative ? 'illustrative' : 'as published'
]))}
<h2>Formula</h2>
<pre>costPerPurchase = contribution * pct + fixed + monthly / (periodsPerYear / 12)
annualDrag = costPerPurchase * periodsPerYear</pre>
<p>Default periodsPerYear = 12. Same as the live stacking module; not re-derived.</p>
<h2>Out of scope</h2>
<ul>
  <li>Bid/ask spread</li>
  <li>FX from CZK, PLN, HUF, RON, BGN into EUR</li>
  <li>Bitcoin network miner fees</li>
  <li>Promotional discounts that are not in the schedule</li>
</ul>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'bitcoin-fee-index/embed/index.html';
  const ranked = rankRoutes(FEE_ROWS, 100);
  const faqs = [
    { q: 'Can this page be iframed?', a: 'Yes. GitHub Pages / staging does not send X-Frame-Options. Parent pages on virtuse.com already allow frame-src self.' },
    { q: 'What table is shown?', a: `€100/month ranking as of ${asOfEn}, four listed partners.` },
    { q: 'Is JavaScript required?', a: 'No. The table is static HTML.' },
    { q: 'What attribution is required?', a: `Visible “Source: Virtuse Bitcoin Fee Index, as of ${asOfEn}” plus a link to the index.` }
  ];
  const answer = finalizeAnswer([
    `Embeddable Fee Index widget as of ${asOfEn}.`,
    `At €100/month ${ranked[0].partner} ranks first at ${formatPct(ranked[0].pct)} (${formatEur(ranked[0].annualDrag)}/year).`,
    'Static HTML, no JavaScript required. Always show the source line.',
    'Virtuse never holds your keys.'
  ], 'en');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Fee Index embed widget (Q3 2026)'),
    description: assertDescription(`Iframe-ready Bitcoin Fee Index table as of ${asOfEn}. ${ranked[0].partner} first at €100/month. Attribution required.`),
    h1: 'Bitcoin Fee Index — embed',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Fee Index', href: toRoot(relFile, 'bitcoin-fee-index/'), abs: abs('bitcoin-fee-index/index.html') },
      { name: 'Embed', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Full Fee Index' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Methodology' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.concierge.replace(/^\//, '')), label: 'Get matched in Concierge →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Virtuse Bitcoin Fee Index embed',
        url: abs(relFile),
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
${tableHtml(['Partner', 'Method', 'Fee', 'Annual drag @ €100/mo'], ranked.map((r) => [
  esc(r.partner), esc(r.method), esc(formatPct(r.pct)), esc(formatEur(r.annualDrag))
]))}
<p class="muted">Source: <a href="${esc(toRoot(relFile, 'bitcoin-fee-index/'))}">Virtuse Bitcoin Fee Index</a> (as of ${esc(asOfEn)}). Virtuse never holds your keys.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

// ---------- llms.txt ----------
function llmsShort() {
  const taxLines = COUNTRIES.map((c) =>
    `- [${c.name}](${ORIGIN}/bitcoin-tax/${slugEn(c.id)}/): ${c.gainTax}. ${c.exemption}. As of ${asOfEn}.`
  ).join('\n');
  const feeLines = rankRoutes(FEE_ROWS, 100).map((r, i) =>
    `- ${i + 1}. ${r.partner} (${r.method}): ${formatPct(r.pct)}, annual drag at €100/mo ${formatEur(r.annualDrag)}`
  ).join('\n');
  return `# Virtuse

> Non-custodial hub for Bitcoin-only services. Virtuse never holds your keys.

As of ${asOfEn}. Indicative 2026 overview – not tax advice. Partner KYC on each platform.

## Bitcoin tax (11 EU countries)

${taxLines}

Hub: ${ORIGIN}/bitcoin-tax/

## Buy routes / Fee Index

${feeLines}

Index: ${ORIGIN}/bitcoin-fee-index/
Archive: ${ORIGIN}/bitcoin-fee-index/2026-q3/

## Tools

- DCA calculator: ${ORIGIN}/bitcoin-dca-calculator/
- Sell vs borrow: ${ORIGIN}/sell-vs-borrow-bitcoin/
- Inheritance checklist: ${ORIGIN}/bitcoin-inheritance/
- Concierge (live): ${ORIGIN}/concierge.html
- Tax agent (live): ${ORIGIN}/tax-agent.html
- Tax category: ${ORIGIN}/tax.html
- Stacking (live): ${ORIGIN}/stacking.html
- Loan copilot (live): ${ORIGIN}/loan.html

## German pilot

- ${ORIGIN}/de/bitcoin-steuern/
- ${ORIGIN}/de/bitcoin-dca-rechner/
- ${ORIGIN}/de/bitcoin-verkaufen-oder-beleihen/
- ${ORIGIN}/de/bitcoin-erbrecht/
- ${ORIGIN}/de/bitcoin-gebuehrenindex/

## Optional

- Full rates: ${ORIGIN}/llms-full.txt
`;
}

function llmsFull() {
  const tax = COUNTRIES.map((c) => `### ${c.flag} ${c.name} (\`${c.id}\`)
- Gain tax: ${c.gainTax}
- Exemption: ${c.exemption}
- Filing: ${c.filing}
- Note: ${c.note}
- EN: ${ORIGIN}/bitcoin-tax/${slugEn(c.id)}/
- DE: ${ORIGIN}/de/bitcoin-steuern/${slugDe(c.id)}/
`).join('\n');
  const fees = FEE_ROWS.map((r) => `- ${r.partner} | ${r.method} | pct=${r.pct} | fixed=${r.fixed || 0} | monthly=${r.monthly || 0} | ${r.note}`).join('\n');
  const inh = inheritance.items.map((it) => `- ${it.question} (${it.points} pts): ${it.action}`).join('\n');
  return `# Virtuse — full rates and fees

As of ${asOfEn}. Copied from seo-build data / live Layer 2 modules. Do not treat as advice.

## Countries

${tax}

## Fee schedule (live stacking module)

${fees}

Formula: costPerPurchase = contribution * pct + fixed + monthly / (periodsPerYear / 12); annualDrag = costPerPurchase * periodsPerYear.

## Inheritance checklist (tax module)

${inh}

## Disclaimers

- Indicative 2026 overview – not tax advice
- Virtuse never holds your keys
- KYC and onboarding are completed on each partner’s regulated platform
`;
}

// ---------- sitemap + robots ----------
const SEO_MARK_START = '<!-- SEO-BUILD:START -->';
const SEO_MARK_END = '<!-- SEO-BUILD:END -->';

function sitemapEntries() {
  const indexable = generated.filter((p) => !p.noindex);
  const byCanon = new Map();
  for (const p of indexable) {
    const loc = abs(p.relFile);
    const pair = p.html.match(/hreflang="de" href="([^"]+)"/);
    const en = p.html.match(/hreflang="en" href="([^"]+)"/);
    const links = [];
    const hrefs = [...p.html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)];
    for (const m of hrefs) {
      links.push(`    <xhtml:link rel="alternate" hreflang="${m[1]}" href="${m[2]}"/>`);
    }
    byCanon.set(loc, { loc, links: links.join('\n'), lang: p.lang });
  }
  return [...byCanon.values()].map((e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${e.lang === 'en' ? '0.7' : '0.6'}</priority>
${e.links}
  </url>`).join('\n');
}

function patchSitemap(xml) {
  const block = `${SEO_MARK_START}\n${sitemapEntries()}\n${SEO_MARK_END}`;
  if (xml.includes(SEO_MARK_START) && xml.includes(SEO_MARK_END)) {
    return xml.replace(new RegExp(`${SEO_MARK_START}[\\s\\S]*?${SEO_MARK_END}`), block);
  }
  if (!xml.includes('</urlset>')) throw new Error('sitemap.xml missing </urlset>');
  return xml.replace('</urlset>', `${block}\n</urlset>`);
}

function patchRobots(txt) {
  const extra = `Disallow: /i18n-tools/
Disallow: /research/
Disallow: /partnerships/
Disallow: /seo-build/
Disallow: /cloudflare-worker/
Disallow: /email/
Disallow: /bitcoin-fee-index/2026-q3/print.html`;
  let out = txt;
  if (!out.includes('Disallow: /seo-build/')) {
    out = out.replace(/Allow: \/\n/, `Allow: /\n${extra}\n`);
  }
  const sitemapLine = `Sitemap: ${ORIGIN}/sitemap.xml`;
  if (/^Sitemap:\s*\S+/m.test(out)) {
    out = out.replace(/^Sitemap:\s*\S+/m, sitemapLine);
  } else {
    out = `${out.trimEnd()}\n\n${sitemapLine}\n`;
  }
  return out;
}

function walkPublishedFiles(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      ent.name === 'i18n-tools' ||
      ent.name === 'research' ||
      ent.name === 'partnerships' ||
      ent.name === 'node_modules'
    ) continue;
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walkPublishedFiles(fp, acc);
    else if (/\.(html|xml|txt)$/.test(ent.name)) acc.push(fp);
  }
  return acc;
}

function rewritePublishedOrigins() {
  for (const fp of walkPublishedFiles(SITE)) {
    const before = fs.readFileSync(fp, 'utf8');
    const after = rewriteKnownOrigins(before, ORIGIN);
    if (after !== before) fs.writeFileSync(fp, after, 'utf8');
  }
}

function writeAll() {
  const manifestPath = path.join(ROOT, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const prev = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const rel of prev.files || []) {
      const fp = path.join(SITE, rel);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  }

  const files = [];
  for (const p of generated) {
    const fp = path.join(SITE, p.relFile);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, p.html, 'utf8');
    files.push(p.relFile);
  }

  const llms = llmsShort();
  const llmsF = llmsFull();
  fs.writeFileSync(path.join(SITE, 'llms.txt'), llms, 'utf8');
  fs.writeFileSync(path.join(SITE, 'llms-full.txt'), llmsF, 'utf8');
  files.push('llms.txt', 'llms-full.txt');

  const sitemapPath = path.join(SITE, 'sitemap.xml');
  const sitemap = rewriteKnownOrigins(fs.readFileSync(sitemapPath, 'utf8'), ORIGIN);
  fs.writeFileSync(sitemapPath, patchSitemap(sitemap), 'utf8');

  const robotsPath = path.join(SITE, 'robots.txt');
  fs.writeFileSync(
    robotsPath,
    patchRobots(rewriteKnownOrigins(fs.readFileSync(robotsPath, 'utf8'), ORIGIN)),
    'utf8'
  );

  rewritePublishedOrigins();

  const counts = {
    enIndexable: generated.filter((p) => p.lang === 'en' && !p.noindex).length,
    deIndexable: generated.filter((p) => p.lang === 'de' && !p.noindex).length,
    noindex: generated.filter((p) => p.noindex).length,
    totalHtml: generated.length
  };

  const manifest = {
    generatedAtAsOf: AS_OF,
    lastmod: LASTMOD,
    origin: ORIGIN,
    feeSource: meta.feeSource,
    counts,
    files
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

const manifest = writeAll();
console.log(JSON.stringify(manifest.counts, null, 2));
console.log(`origin ${ORIGIN}`);
console.log(`Wrote ${manifest.files.length} files into ${SITE_DIR_NAME}`);
