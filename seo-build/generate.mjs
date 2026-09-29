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
  formatPctDe,
  formatEurDe,
  methodDe,
  formatPctSk,
  formatEurSk,
  methodSk,
  methodCs,
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
const N = COUNTRIES.length; // country count shown in copy (was hardcoded 11)
const FEE_ROWS = meta.feeSource === 'live' ? liveFees.rows : seoData.feeSchedule.map((row, i) => ({
  id: `brief-${i}`,
  kind: /bot|auto|dca/i.test(`${row.partner} ${row.method}`) ? 'automated' : 'manual',
  monthly: /bot/i.test(row.partner) || /dca/i.test(row.method) ? 4 : 0,
  ...row
}));

const asOfEn = formatAsOf(AS_OF, 'en');
const asOfDe = formatAsOf(AS_OF, 'de');
const asOfSk = formatAsOf(AS_OF, 'sk');
const asOfCs = formatAsOf(AS_OF, 'cs');

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
function slugSk(id) {
  const s = meta.slugs.sk[id];
  if (!s) throw new Error(`Missing SK slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameSk(id) {
  const s = meta.names.sk[id];
  if (!s) throw new Error(`Missing SK name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function slugCs(id) {
  const s = meta.slugs.cs[id];
  if (!s) throw new Error(`Missing CS slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameCs(id) {
  const s = meta.names.cs[id];
  if (!s) throw new Error(`Missing CS name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
/** "v/na/ve <zemi>" in Czech (na Slovensku, ve Francii). */
function inCs(id) { return meta.inCs[id]; }
/** Czech accusative: only Francie changes (Francii); the -o names stay. */
function accCs(id) { return (meta.accCs && meta.accCs[id]) || nameCs(id); }
/** "v/na/vo <krajine>" in Slovak (na Slovensku, vo Francúzsku). */
function inSk(id) { return meta.inSk[id]; }
/** "in <country>" in German: a few names take an article (in der Slowakei, in den Niederlanden). */
function inDe(id) { return (meta.inDe && meta.inDe[id]) || `in ${nameDe(id)}`; }
function countryById(id) { return COUNTRIES.find((c) => c.id === id); }
/** English country name inside a sentence: "the Netherlands" takes an article. */
function theEn(c) { return c.id === 'nl' ? 'the Netherlands' : c.name; }
function TheEn(c) { const n = theEn(c); return n.charAt(0).toUpperCase() + n.slice(1); }
function lcFirst(t) { return t.charAt(0).toLowerCase() + t.slice(1); }

/** Live Tax & Inheritance Agent. seo-data.moduleCtas.tax is /tax.html (category page). */
const TAX_AGENT = 'tax-agent.html';

function abs(p) {
  const c = p.startsWith('/') ? p : canonicalPath(p);
  return ORIGIN + c;
}

/** EN page -> its Slovak counterpart (the sk/ set mirrors the German pilot). */
const SK_ALT = {
  'bitcoin-tax/index.html': 'sk/bitcoin-dane/index.html',
  'bitcoin-dca-calculator/index.html': 'sk/bitcoin-dca-kalkulacka/index.html',
  'sell-vs-borrow-bitcoin/index.html': 'sk/bitcoin-predat-alebo-pozicat/index.html',
  'bitcoin-inheritance/index.html': 'sk/bitcoin-dedicstvo/index.html',
  'bitcoin-fee-index/index.html': 'sk/bitcoin-index-poplatkov/index.html'
};
for (const c of COUNTRIES) {
  SK_ALT[`bitcoin-tax/${meta.slugs.en[c.id]}/index.html`] = `sk/bitcoin-dane/${meta.slugs.sk[c.id]}/index.html`;
}
/** EN page -> its Czech counterpart. */
const CS_ALT = {
  'bitcoin-tax/index.html': 'cs/bitcoin-dane/index.html',
  'bitcoin-dca-calculator/index.html': 'cs/bitcoin-dca-kalkulacka/index.html',
  'sell-vs-borrow-bitcoin/index.html': 'cs/bitcoin-prodat-nebo-pujcit/index.html',
  'bitcoin-inheritance/index.html': 'cs/bitcoin-dedictvi/index.html',
  'bitcoin-fee-index/index.html': 'cs/bitcoin-index-poplatku/index.html'
};
for (const c of COUNTRIES) {
  CS_ALT[`bitcoin-tax/${meta.slugs.en[c.id]}/index.html`] = `cs/bitcoin-dane/${meta.slugs.cs[c.id]}/index.html`;
}

function hrefLangPair(enPath, dePath) {
  const tags = [
    { lang: 'en', href: abs(enPath), path: canonicalPath(enPath) },
    { lang: 'x-default', href: abs(enPath), path: canonicalPath(enPath) }
  ];
  const csPath = CS_ALT[enPath];
  if (csPath) {
    tags.splice(1, 0, { lang: 'cs', href: abs(csPath), path: canonicalPath(csPath) });
  }
  const skPath = SK_ALT[enPath];
  if (skPath) {
    tags.splice(1, 0, { lang: 'sk', href: abs(skPath), path: canonicalPath(skPath) });
  }
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
  return `<div class="table-wrap"><table><thead>${thead}</thead><tbody>${body}</tbody></table></div>`;
}

function neighborsOf(id) {
  const ids = meta.neighbors[id] || [];
  return ids.map(countryById).filter(Boolean);
}

function finalizeAnswer(parts, lang) {
  const pads = lang === 'de'
    ? [
      `Angaben aus den Live-Modulen von Virtuse, Stand ${asOfDe}.`,
      'Virtuse verwahrt niemals Ihre Schlüssel.',
      'Bitte lokal prüfen; keine Steuerberatung.'
    ]
    : lang === 'cs' ? [
      `Údaje z živých modulů Virtuse, stav ${asOfCs}.`,
      'Virtuse nikdy nedrží vaše klíče.',
      'Ověřte si místní pravidla; nejde o daňové poradenství.'
    ]
    : lang === 'sk' ? [
      `Údaje z live modulov Virtuse, stav ${asOfSk}.`,
      'Virtuse nikdy nedrží vaše kľúče.',
      'Overte si miestne pravidlá; nejde o daňové poradenstvo.'
    ]
    : [
      `Figures taken from Virtuse’s live modules, as of ${asOfEn}.`,
      'Virtuse never holds your keys.',
      'Check local rules; not tax advice.'
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
    `Bitcoin tax in ${theEn(c)} as of ${asOfEn}: ${c.gainTax}.`,
    `Exemption: ${c.exemption}.`,
    `Filing: ${c.filing}.`,
    c.note,
    'Indicative 2026 overview, not tax advice.'
  ], 'en');
}

function taxAnswerDe(c) {
  const d = meta.taxDe[c.id];
  return finalizeAnswer([
    `Bitcoin-Steuern ${inDe(c.id)}, Stand ${asOfDe}: ${d.gainTax}.`,
    `Befreiung: ${d.exemption}.`,
    `Veranlagung: ${d.filing}.`,
    d.note,
    'Unverbindlicher Überblick 2026, keine Steuerberatung.'
  ], 'de');
}

function buyAnswerEn(c, winner) {
  const cur = meta.currency[c.id];
  const extra = c.id === 'nl'
    ? `In the Netherlands, Box 3 still applies to holdings after you buy, because tax is on a deemed return rather than on disposal gains.`
    : `Tax usually arises only when you sell or swap later; exemption in ${theEn(c)}: ${lcFirst(c.exemption)}.`;
  return finalizeAnswer([
    `As of ${asOfEn}, the cheapest buy route on the Virtuse Fee Index at €100/month is ${winner.partner} (${winner.method}): ${formatPct(winner.pct)} variable fee, ${formatEur(winner.annualDrag)} annual fee drag.`,
    extra,
    cur === 'EUR' ? '' : `From ${theEn(c)}, you usually fund a EUR account by SEPA transfer after converting ${cur}; partner KYC applies.`,
    'Virtuse never holds your keys.'
  ].filter(Boolean), 'en');
}

const DEFAULT_MONTHLY = 100;
const winnerDefault = cheapest(FEE_ROWS, DEFAULT_MONTHLY);
const rankedDefault = rankRoutes(FEE_ROWS, DEFAULT_MONTHLY);
const be = breakEvenBotsVsManual(FEE_ROWS);

function taxFaqsEn(c) {
  return [
    {
      q: `What is the bitcoin tax rate in ${theEn(c)}?`,
      a: `As of ${asOfEn}, bitcoin gains in ${theEn(c)} are taxed as follows: ${c.gainTax}. This is an indicative 2026 overview, not tax advice.`
    },
    {
      q: `Is there a holding-period exemption in ${theEn(c)}?`,
      a: `${c.exemption}. Confirm the current year’s rules with a local advisor before you file.`
    },
    {
      q: `How do you file bitcoin taxes in ${theEn(c)}?`,
      a: `${c.filing}. ${c.note}`
    },
    {
      q: 'Does Virtuse hold my bitcoin or file my tax return?',
      a: `No. Virtuse never holds your keys. KYC and onboarding happen on each partner’s regulated platform. Use the Tax & Inheritance Agent to compare the ${N}-country overview, then file with a qualified advisor.`
    }
  ];
}

function taxFaqsDe(c) {
  const d = meta.taxDe[c.id];
  const inN = inDe(c.id);
  return [
    {
      q: `Wie werden Bitcoin-Gewinne ${inN} besteuert?`,
      a: `Stand ${asOfDe}: ${d.gainTax}. Unverbindlicher Überblick 2026, keine Steuerberatung.`
    },
    {
      q: `Gibt es eine Spekulationsfrist oder Haltedauer-Befreiung ${inN}?`,
      a: `${d.exemption}. Lassen Sie die aktuelle Rechtslage von einem lokalen Steuerberater prüfen.`
    },
    {
      q: `Wie erfolgt die Steuererklärung ${inN}?`,
      a: `${d.filing}. ${d.note}`
    },
    {
      q: 'Verwahrt Virtuse meinen Bitcoin oder übernimmt Virtuse die Steuererklärung?',
      a: `Nein. Virtuse verwahrt niemals Ihre Schlüssel. KYC und Onboarding erfolgen beim Partner. Der Tax-Agent vergleicht die ${N}-Länder-Übersicht; die Steuererklärung erstellt ein qualifizierter Steuerberater.`
    }
  ];
}

function buyFaqsEn(c, winner) {
  const cur = meta.currency[c.id];
  return [
    {
      q: `What is the cheapest way to buy bitcoin in ${theEn(c)} as of ${asOfEn}?`,
      a: `On the Virtuse Fee Index, ${winner.partner} (${winner.method}) has the lowest annual fee drag at €100/month: a ${formatPct(winner.pct)} variable fee and ${formatEur(winner.annualDrag)} a year. Rankings use the published partner fee schedule, not spreads or currency conversion.`
    },
    {
      q: `Does buying bitcoin trigger tax in ${theEn(c)}?`,
      a: c.id === 'nl'
        ? `The Netherlands does not use a classic capital gains tax. Box 3 wealth tax on a deemed return still applies to holdings (as of ${asOfEn}: ${c.gainTax}).`
        : `No. In this overview, tax arises when you sell or swap (a disposal), not when you buy. Exemption in ${theEn(c)}: ${lcFirst(c.exemption)}. Indicative 2026 overview, not tax advice.`
    },
    {
      q: 'Are these fees the full cost of buying?',
      a: 'No. The index ranks the percentage fee plus any listed monthly subscription from the Stacking Strategist fee schedule. ' +
        (cur === 'EUR' ? 'Spreads and network (miner) fees are not included.' : `Spreads, currency conversion from ${cur} and network (miner) fees are not included.`)
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
    { q: 'Which EU countries does this bitcoin tax overview cover?', a: `${N} EU countries: ${COUNTRIES.map((c) => theEn(c)).join(', ')}. Figures are as of ${asOfEn}, taken from the Virtuse Tax module.` },
    { q: 'Is this tax advice?', a: 'No. Indicative 2026 overview – not tax advice. Confirm current-year rules with a local advisor.' },
    { q: 'Does Virtuse report my holdings to tax authorities?', a: 'No. Virtuse never holds your keys or your transaction history. Partners complete their own KYC.' },
    { q: 'Where can I model inheritance as well as tax?', a: `Use the Tax & Inheritance Agent (live module) for the same ${N} countries plus a multisig readiness check.` }
  ];
  const answer = finalizeAnswer([
    `This hub compares bitcoin tax treatment across ${N} EU countries as of ${asOfEn}.`,
    'Rates, exemptions and filing notes come from the Virtuse Tax module.',
    'Germany and Austria exempt gains after a 1-year holding period; Czechia uses a 3-year time test; the Netherlands taxes a deemed return under Box 3 instead of capital gains.',
    'Indicative 2026 overview, not tax advice.'
  ], 'en');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle(`Bitcoin tax in ${N} EU countries (2026)`),
    description: assertDescription(`Compare bitcoin tax rates, holding exemptions and filing notes for ${N} EU countries as of ${asOfEn}. Indicative overview, not tax advice.`),
    h1: `Bitcoin tax in ${N} EU countries`,
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Bitcoin tax', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-tax/germany/'), label: 'Bitcoin tax in Germany' },
      { href: toRoot(relFile, 'bitcoin-inheritance/'), label: 'Bitcoin inheritance checklist' },
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Bitcoin Fee Index' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Open Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Each country page gives the tax on gains, any holding-period exemption and the filing requirements as of ${esc(asOfEn)}. The live Tax & Inheritance Agent uses the same data and adds an inheritance readiness score.</p>
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
    { q: 'Welche Länder umfasst dieser Überblick?', a: `${N} EU-Länder: ${COUNTRIES.map((c) => nameDe(c.id)).join(', ')}. Stand ${asOfDe}, Zahlen aus dem Virtuse-Tax-Modul.` },
    { q: 'Ist das Steuerberatung?', a: 'Nein. Unverbindlicher Überblick 2026 – keine Steuerberatung.' },
    { q: 'Meldet Virtuse Bestände an Finanzämter?', a: 'Nein. Virtuse verwahrt niemals Ihre Schlüssel und führt keine Transaktionshistorie.' },
    { q: 'Wo prüfe ich neben der Steuer auch die Nachlassplanung?', a: `Im Tax- & Inheritance-Agent (Live-Modul) mit denselben ${N} Ländern plus Multisig-Check.` }
  ];
  const answer = finalizeAnswer([
    `Dieser Hub vergleicht die Bitcoin-Besteuerung in ${N} EU-Ländern, Stand ${asOfDe}.`,
    'Sätze, Befreiungen und Hinweise zur Steuererklärung stammen aus dem Virtuse-Tax-Modul.',
    'Deutschland: Spekulationsfrist 1 Jahr. Österreich: KESt 27,5 %. Tschechien: 3-Jahres-Zeittest. Niederlande: Box 3 statt klassischer Kapitalertragsteuer.',
    'Unverbindlicher Überblick 2026, keine Steuerberatung.'
  ], 'de');
  pushPage({
    relFile, lang: 'de',
    title: assertTitle(`Bitcoin-Steuern in ${N} EU-Ländern (2026)`),
    description: assertDescription(`Bitcoin-Steuersätze, Spekulationsfrist und Steuererklärung in ${N} EU-Ländern, Stand ${asOfDe}. Unverbindlich, keine Steuerberatung.`),
    h1: `Bitcoin-Steuern in ${N} EU-Ländern`,
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
<p>Pro Land: Gewinnbesteuerung, etwaige Haltedauer-Befreiung und Steuererklärung, Stand ${esc(asOfDe)}.</p>
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
<p>${esc(c.flag)} <strong>${esc(TheEn(c))}</strong> is one of the ${N} EU countries in the Virtuse Tax module. The figures below are taken from that module as of ${esc(asOfEn)}.</p>
<h2>Rates and filing</h2>
${tableHtml(['Field', 'As of ' + asOfEn], [
  ['Gain tax', esc(c.gainTax)],
  ['Exemption', esc(c.exemption)],
  ['Filing', esc(c.filing)],
  ['Note', esc(c.note)]
])}
<h2>What usually creates a taxable event</h2>
<p>${esc(c.note)} Buying bitcoin is not treated as a disposal in this overview; check local rules before you spend, swap, gift or lend coins.</p>
<h2>Nearby country guides</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(enRel, `bitcoin-tax/${slugEn(n.id)}/`))}">Bitcoin tax in ${esc(theEn(n))}</a></li>`).join('')}</ul>
<p>Cheapest ways to buy here: <a href="${esc(toRoot(enRel, `buy-bitcoin/${slugEn(c.id)}/`))}">Buy bitcoin in ${esc(theEn(c))}</a>.</p>
${faqHtml(faqs, 'FAQ')}
`;
  pushPage({
    relFile: enRel, lang: 'en',
    title: assertTitle(`Bitcoin tax in ${theEn(c)} (${asOfEn})`),
    description: assertDescription(`Bitcoin tax in ${theEn(c)} as of ${asOfEn}: ${c.gainTax}. Indicative overview, not tax advice.`),
    h1: `Bitcoin tax in ${theEn(c)}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(enRel, 'index.html'), abs: abs('index.html') },
      { name: 'Bitcoin tax', href: toRoot(enRel, 'bitcoin-tax/'), abs: abs('bitcoin-tax/index.html') },
      { name: c.name, abs: abs(enRel) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(enRel, `buy-bitcoin/${slugEn(c.id)}/`), label: `Buy bitcoin in ${theEn(c)}` },
      { href: toRoot(enRel, 'bitcoin-inheritance/'), label: 'Bitcoin inheritance checklist' },
      { href: toRoot(enRel, nbs[0] ? `bitcoin-tax/${slugEn(nbs[0].id)}/` : 'bitcoin-tax/'), label: nbs[0] ? `Bitcoin tax in ${theEn(nbs[0])}` : 'All country tax guides' }
    ],
    moduleCta: { href: toRoot(enRel, TAX_AGENT + `?country=${c.id}`), label: `Check ${theEn(c)} in the Tax Agent →` },
    schemas: [faqLd(faqs)],
    bodyHtml: body
  });

  const d = meta.taxDe[c.id];
  const faqsDe = taxFaqsDe(c);
  const answerDe = taxAnswerDe(c);
  // d.review is an internal note for content ops / the tax advisor; never published.
  pushPage({
    relFile: deRel, lang: 'de',
    title: assertTitle(`Bitcoin-Steuern ${nameDe(c.id)} (${asOfDe})`),
    description: assertDescription(`Bitcoin-Steuern ${inDe(c.id)} (${asOfDe}): ${d.gainTax}. Keine Steuerberatung.`),
    h1: `Bitcoin-Steuern ${inDe(c.id)}`,
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
      { href: toRoot(deRel, nbs[0] ? `de/bitcoin-steuern/${slugDe(nbs[0].id)}/` : 'de/bitcoin-steuern/'), label: nbs[0] ? `Steuern ${inDe(nbs[0].id)}` : 'Alle Länder' }
    ],
    moduleCta: { href: toRoot(deRel, TAX_AGENT + `?country=${c.id}`), label: `${nameDe(c.id)} im Tax-Agent prüfen →` },
    schemas: [faqLd(faqsDe)],
    bodyHtml: `
<p>${esc(c.flag)} Zahlen Stand ${esc(asOfDe)}, übernommen aus dem Virtuse-Tax-Modul.</p>
<h2>Sätze und Steuererklärung</h2>
${tableHtml(['Feld', 'Stand ' + asOfDe], [
  ['Gewinnsteuer', esc(d.gainTax)],
  ['Befreiung', esc(d.exemption)],
  ['Steuererklärung', esc(d.filing)],
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
    title: assertTitle(`Buy bitcoin in ${theEn(c)}: cheapest route`),
    description: assertDescription(`Cheapest EU bitcoin buy route for ${theEn(c)} as of ${asOfEn}: ${winner.partner} at ${formatPct(winner.pct)}. Fee Index ranking, not a quote.`),
    h1: `Buy bitcoin in ${theEn(c)}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Buy bitcoin', href: toRoot(relFile, 'buy-bitcoin.html'), abs: abs('buy-bitcoin.html') },
      { name: c.name, abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`), label: `Bitcoin tax in ${theEn(c)}` },
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Full Bitcoin Fee Index' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Simulate a DCA plan →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Local currency: <strong>${esc(meta.currency[c.id])}</strong>. The table shows the partners’ EUR-denominated fees from the Stacking Strategist schedule as of ${esc(asOfEn)}.${meta.currency[c.id] === 'EUR' ? '' : ` Currency conversion from ${esc(meta.currency[c.id])} is not included in the ranking.`}</p>
<h2>Ranked buy routes at €${DEFAULT_MONTHLY}/month</h2>
${tableHtml(['Rank', 'Partner', 'Method', 'Variable fee', 'Annual fee drag', 'Speed'], rows)}
<p class="muted">Annual fee drag uses the live Stacking Strategist formula: a percentage of each purchase plus any listed monthly subscription.${ranked.some((r) => r.illustrative) ? ' RevenueBot’s percentage is marked as illustrative in the source schedule.' : ''}</p>
<h2>Tax in ${esc(theEn(c))}</h2>
<p>Gain tax: ${esc(c.gainTax)}. Exemption: ${esc(c.exemption)}.</p>
<p>Read the dedicated guide: <a href="${esc(toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`))}">Bitcoin tax in ${esc(theEn(c))}</a>.</p>
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
    { q: 'Does this calculator forecast bitcoin’s price?', a: 'No. It isolates partner fees from the published fee schedule. Price returns are not modelled.' },
    { q: `What default plan is shown as of ${asOfEn}?`, a: `€${initial} upfront plus €${monthly}/month for 12 months (${formatEur(invested)} invested), ranked by first-year fees using the Stacking Strategist formula.` },
    { q: 'Which route is cheapest on that plan?', a: `${win.partner} (${win.method}) with a ${formatPct(win.pct)} variable fee: about ${formatEur(win.yearOneFees)} in first-year fees in this fee-only example.` },
    { q: 'Is this financial advice?', a: 'No. It is for educational purposes only. KYC happens on the partner platform. Virtuse never holds your keys.' }
  ];
  const answer = finalizeAnswer([
    `As of ${asOfEn}, a fee-only DCA example of €${initial} plus €${monthly} per month for 12 months (${formatEur(invested)} invested) ranks ${win.partner} first.`,
    `Variable fee: ${formatPct(win.pct)}; first-year fees about ${formatEur(win.yearOneFees)}, using the live Stacking Strategist formula.`,
    'This is not a return forecast. Indicative 2026 overview.'
  ], 'en');
  const rows = ranked.map((r, i) => [
    esc(String(i + 1)),
    esc(r.partner),
    esc(r.method),
    esc(formatPct(r.pct)),
    esc(formatEur(r.yearOneFees)),
    r.illustrative ? 'Illustrative fee' : 'Published fee'
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
        (Math.round(r.pct * 10000) / 100) + '%</td><td>€' + Math.round(r.year) + '</td></tr>';
    }).join('');
  });
});
</script>`,
    bodyHtml: `
<p>Default example: <strong>€${initial} lump sum + €${monthly}/month × 12</strong>. Enter your own amounts to recalculate with the same fee schedule.</p>
<form id="dca-form">
  <p><label>Initial amount (EUR) <input id="dca-initial" type="number" min="0" step="50" value="${initial}"></label>
  <label>Monthly amount (EUR) <input id="dca-monthly" type="number" min="0" step="25" value="${monthly}"></label>
  <button type="submit" class="cta-secondary">Recalculate fees</button></p>
</form>
<h2>First-year fees on the default plan</h2>
<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Partner</th><th>Method</th><th>Variable fee</th><th>First-year fees</th><th>Note</th></tr></thead>
<tbody id="dca-body">${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<p class="muted">Same formula as the live Stacking Strategist: first-year fees = (monthly contribution × fee % + fixed fee + monthly subscription) × 12, plus the fee % on the initial lump sum. Bitcoin price returns are deliberately left out.</p>
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
    { q: 'Welche Route ist in diesem Plan am günstigsten?', a: `${win.partner} (${methodDe(win.method)}) mit ${formatPctDe(win.pct)} variabler Gebühr laut Stacking-Formel.` },
    { q: 'Ist das eine Anlageberatung?', a: 'Nein. Nur eine Orientierung zu Bildungszwecken. KYC erfolgt beim Partner. Virtuse verwahrt niemals Ihre Schlüssel.' }
  ];
  const answer = finalizeAnswer([
    `Stand ${asOfDe} liegt im gebührenbasierten DCA-Beispiel (500 € plus 100 €/Monat über 12 Monate) ${win.partner} auf Platz 1.`,
    `Variable Gebühr ${formatPctDe(win.pct)}. Keine Kursprognose.`,
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
<p>Standardbeispiel: 500 € plus 100 €/Monat × 12. Formel wie im Live-Stacking-Modul.</p>
<h2>Rangfolge bei 100 €/Monat</h2>
${tableHtml(['Rang', 'Partner', 'Methode', 'Variable Gebühr', 'Jahreslast'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodDe(r.method)), esc(formatPctDe(r.pct)), esc(formatEurDe(r.annualDrag))
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
    { q: `Does selling bitcoin trigger tax in these ${N} countries?`, a: `Usually yes, when you sell or swap. Exemptions differ: Germany 0% after a 1-year holding period; Czechia a 3-year time test; Poland none. As of ${asOfEn}. Not tax advice.` },
    { q: 'Does borrowing against bitcoin trigger the same tax?', a: 'In this educational overview, a loan is not the same event as a sale. Interest, liquidation risk and partner KYC still apply. Model the numbers in the live Loan & Liquidity Copilot.' },
    { q: 'What is liquidation risk?', a: 'If the value of your collateral falls to the partner’s threshold, the partner can sell the collateral to repay the loan. Virtuse never holds your keys or the collateral.' },
    { q: 'Where do I compare a specific cash amount?', a: 'Use the live Loan & Liquidity Copilot. This page explains the trade-off between tax and risk using only the published country tax rates.' }
  ];
  const answer = finalizeAnswer([
    `As of ${asOfEn}, selling bitcoin can trigger tax (for example, up to 45% in Germany within the 1-year holding period, or Spekulationsfrist; a flat 10% in Romania).`,
    'Borrowing against your bitcoin keeps your market exposure but adds interest and liquidation risk on a partner platform.',
    'Indicative 2026 overview, not tax or credit advice. Virtuse never holds your keys.'
  ], 'en');
  const rows = COUNTRIES.map((c) => [
    `<a href="${esc(toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`))}">${esc(c.name)}</a>`,
    esc(c.gainTax),
    esc(c.exemption)
  ]);
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Sell vs borrow bitcoin (EU tax 2026)'),
    description: assertDescription(`Sell bitcoin and pay tax, or borrow against it and stay invested. Tax rates for ${N} EU countries as of ${asOfEn}. Not credit advice.`),
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
<p>The rates below are the same as in the country tax guides (Tax module, ${esc(asOfEn)}). Selling shortly before a holding period ends can cost you an exemption you were about to qualify for.</p>
${tableHtml(['Country', 'Gain tax', 'Exemption'], rows)}
<h2>Risk if you borrow</h2>
<p>Bitcoin-backed loans are offered by regulated partners, not by Virtuse. You keep your price exposure and pay interest, and your collateral can be liquidated. Virtuse never holds the collateral. The live Loan & Liquidity Copilot runs the scenarios; this page stays qualitative and quotes no interest rates.</p>
<h2>How to choose a next step</h2>
<ol>
  <li>Read your country’s tax guide for the rate that would apply <em>if you sold today</em>.</li>
  <li>Open the Loan & Liquidity Copilot with the cash amount you actually need.</li>
  <li>Complete KYC with the partner if you go ahead; never send your seed phrase to anyone, including Virtuse.</li>
</ol>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const faqs = [
    { q: `Löst ein Verkauf in diesen ${N} Ländern Steuer aus?`, a: `In der Regel ja, bei einer Veräußerung. Deutschland: 0 % nach 1-jähriger Spekulationsfrist. Tschechien: 3-Jahres-Zeittest. Polen: keine Haltedauer-Befreiung. Stand ${asOfDe}. Keine Steuerberatung.` },
    { q: 'Ist ein Kredit dasselbe steuerliche Ereignis wie ein Verkauf?', a: 'In diesem Überblick nicht. Zinsen, Liquidationsrisiko und das KYC beim Partner bleiben. Konkrete Zinssätze zeigt der Loan-Copilot.' },
    { q: 'Was ist Liquidationsrisiko?', a: 'Fällt der Wert der Sicherheit (Collateral) auf die Schwelle des Partners, kann die Sicherheit zwangsverkauft werden. Virtuse verwahrt weder Schlüssel noch Sicherheiten.' },
    { q: 'Wo berechne ich einen konkreten Betrag?', a: 'Im Live-Modul Loan & Liquidity Copilot. Diese Seite erklärt nur die Abwägung anhand der veröffentlichten Steuerangaben.' }
  ];
  const answer = finalizeAnswer([
    `Stand ${asOfDe} kann ein Bitcoin-Verkauf Steuer auslösen (Deutschland bis 45 % innerhalb der Spekulationsfrist; Rumänien pauschal 10 %).`,
    'Ein Kredit mit Bitcoin als Sicherheit kann die Marktposition erhalten, bringt aber Zinsen und ein Liquidationsrisiko beim Partner.',
    'Die Seite nennt keine Zinssätze. Unverbindlicher Überblick 2026, keine Steuer- oder Kreditberatung. Virtuse verwahrt niemals Ihre Schlüssel.'
  ], 'de');
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin verkaufen oder beleihen (2026)'),
    description: assertDescription(`Bitcoin verkaufen und Steuer zahlen oder beleihen und investiert bleiben. ${N}-Länder-Sätze, Stand ${asOfDe}. Keine Kreditberatung.`),
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
<p>Bitcoin-besicherte Kredite kommen von Partnern, nicht von Virtuse. Sie behalten die Kurschance, zahlen Zinsen, und Ihre Sicherheit kann liquidiert werden. Virtuse verwahrt die Sicherheit (Collateral) nicht.</p>
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
    { q: 'Why is 2-of-3 multisig on the checklist?', a: 'A single seed is a single point of failure for you and for your heirs. The module scores 2-of-3 with two keys held by you and one by a partner or attorney.' },
    { q: 'Does Virtuse custody keys for heirs?', a: 'No. Virtuse never holds your keys. Inheritance is handled by your attorney, your heirs and any vault partner you choose.' },
    { q: 'How is the readiness score weighted?', a: 'The live Tax module assigns points (letter 20, separation 20, heir awareness 15, multisig 20, tested recovery 15, accounts 15). This page lists the same items without scoring them.' }
  ];
  const answer = finalizeAnswer([
    `As of ${asOfEn}, the Virtuse Tax module’s inheritance checklist has six items: letter of instruction, geographic key separation, heir awareness, 2-of-3 multisig, a recovery drill, and documented accounts.`,
    'A single seed is a single point of failure. Virtuse never holds your keys.',
    'Educational checklist, not legal advice.'
  ], 'en');
  const howto = {
    '@type': 'HowTo',
    name: 'Prepare a bitcoin inheritance plan',
    description: 'Six-step checklist from the Virtuse Tax & Inheritance Agent.',
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
      { href: toRoot(relFile, 'bitcoin-tax/'), label: `${N}-country tax hub` },
      { href: toRoot(relFile, 'sell-vs-borrow-bitcoin/'), label: 'Sell vs borrow' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Score this checklist in the Tax Agent →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>The items and wording come from the live Tax module checklist. Educational only, not legal advice.</p>
<h2>Six checks</h2>
<ol>
  ${items.map((it) => `<li><h3>${esc(it.question)}</h3><p>${esc(it.detail)}</p><p>${esc(it.action)}</p></li>`).join('')}
</ol>
<p>Country tax still applies to heirs who later sell. Start with <a href="${esc(toRoot(relFile, 'bitcoin-tax/'))}">the ${N}-country tax hub</a>.</p>
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
    { q: 'Ist das Rechtsberatung?', a: 'Nein. Eine Checkliste zu Bildungszwecken aus dem Tax-Modul, Stand ' + asOfDe + '.' }
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
      { href: toRoot(relFile, 'de/bitcoin-steuern/'), label: `${N}-Länder-Steuerhub` },
      { href: toRoot(relFile, 'de/bitcoin-verkaufen-oder-beleihen/'), label: 'Verkaufen oder beleihen' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Checkliste im Tax-Agent bewerten →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Inhalt entspricht der Checkliste des Tax-Moduls. Keine Rechtsberatung.</p>
<h2>Anleitung: sechs Prüfschritte</h2>
<ol>${meta.inheritanceDe.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'FAQ')}
`
  });
}

function feeIndexBody(relFile, lang) {
  const contribs = DEFAULT_CONTRIBUTIONS;
  const tables = contribs.map((amt) => {
    const ranked = rankRoutes(FEE_ROWS, amt);
    if (lang === 'cs') {
      return `<h3>${esc(formatEurSk(amt))} měsíčně</h3>` +
        tableHtml(['Pořadí', 'Partner', 'Metoda', 'Poplatek', 'Roční poplatky'], ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(methodCs(r.method)),
          esc(formatPctSk(r.pct) + (r.monthly ? ` + ${formatEurSk(r.monthly)} měsíčně` : '')),
          esc(formatEurSk(r.annualDrag))
        ]));
    }
    if (lang === 'sk') {
      return `<h3>${esc(formatEurSk(amt))} mesačne</h3>` +
        tableHtml(['Poradie', 'Partner', 'Metóda', 'Poplatok', 'Ročné poplatky'], ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(methodSk(r.method)),
          esc(formatPctSk(r.pct) + (r.monthly ? ` + ${formatEurSk(r.monthly)} mesačne` : '')),
          esc(formatEurSk(r.annualDrag))
        ]));
    }
    return `<h3>${lang === 'de' ? `${esc(formatEurDe(amt))} pro Monat` : `${esc(formatEur(amt))} per month`}</h3>` +
      tableHtml(
        lang === 'de' ? ['Rang', 'Partner', 'Methode', 'Gebühr', 'Jahreslast'] : ['Rank', 'Partner', 'Method', 'Fee', 'Annual fee drag'],
        ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(lang === 'de' ? methodDe(r.method) : r.method),
          esc(lang === 'de'
            ? formatPctDe(r.pct) + (r.monthly ? ` + ${formatEurDe(r.monthly)}/Monat` : '')
            : formatPct(r.pct) + (r.monthly ? ` + ${formatEur(r.monthly)}/month` : '')),
          esc(lang === 'de' ? formatEurDe(r.annualDrag) : formatEur(r.annualDrag))
        ])
      );
  }).join('');
  let beText;
  if (lang === 'cs') {
    if (be.status === 'always') {
      beText = `Při zveřejněných poplatcích má nejlevnější automatizovaná cesta (${be.auto.partner}) od 1 € měsíčně stejné nebo nižší roční poplatky než nejlevnější ruční cesta (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Bod zvratu: od ${formatEurSk(be.monthlyEur)} měsíčně není ${be.auto.partner} (automatizovaně) dražší než ${be.manual.partner} (ručně).`;
    } else {
      beText = 'Do 20 000 € měsíčně nejlevnější automatizovaná cesta nepřekoná nejlevnější ruční cestu.';
    }
  } else if (lang === 'sk') {
    if (be.status === 'always') {
      beText = `Pri zverejnených poplatkoch má najlacnejšia automatizovaná cesta (${be.auto.partner}) od 1 € mesačne rovnaké alebo nižšie ročné poplatky ako najlacnejšia manuálna cesta (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Bod zvratu: od ${formatEurSk(be.monthlyEur)} mesačne nie je ${be.auto.partner} (automatizovane) drahší ako ${be.manual.partner} (manuálne).`;
    } else {
      beText = 'Do 20 000 € mesačne najlacnejšia automatizovaná cesta neprekoná najlacnejšiu manuálnu cestu.';
    }
  } else if (lang === 'de') {
    if (be.status === 'always') {
      beText = `Break-even automatisiert vs. manuell: Die günstigste automatisierte Route (${be.auto.partner}) hat ab 1 €/Monat eine niedrigere oder gleiche Jahreslast als die günstigste manuelle Route (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Break-even: ab ${formatEurDe(be.monthlyEur)}/Monat ist ${be.auto.partner} (automatisiert) nicht teurer als ${be.manual.partner} (manuell).`;
    } else {
      beText = `Im Scan bis 20.000 €/Monat unterbietet die günstigste automatisierte Route die günstigste manuelle Route nicht.`;
    }
  } else if (be.status === 'always') {
    beText = `On listed fees, ${be.auto.partner} (automated) has an annual fee drag equal to or lower than ${be.manual.partner} (manual) at every tested monthly amount from €1.`;
  } else if (be.status === 'found') {
    beText = `Break-even: from ${formatEur(be.monthlyEur)}/month, ${be.auto.partner} (automated) costs the same as or less than ${be.manual.partner} (manual) in annual fees.`;
  } else {
    beText = `Automated vs manual: between €1 and €20,000 a month, the cheapest automated route never beats the cheapest manual route.`;
  }
  return { tables, beText, winner: winnerDefault };
}

function pressBlurb() {
  const w = winnerDefault;
  return `Virtuse Bitcoin Fee Index (${asOfEn}): among listed EU buy routes, ${w.partner} (${w.method}) ranks first on annual fee drag at €100/month (${formatPct(w.pct)}, ${formatEur(w.annualDrag)}/year). Ranking uses partner percentage fees plus any listed monthly subscription from the Stacking Strategist schedule; spreads, currency conversion and miner fees are excluded. Source: ${ORIGIN}/bitcoin-fee-index/ — Virtuse never holds your keys.`;
}

{
  const relFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'en');
  const faqs = [
    { q: 'What does the Bitcoin Fee Index rank?', a: `The annual fee drag of partner buy routes as of ${asOfEn}, calculated with the Stacking Strategist formula from listed percentage fees and monthly subscriptions.` },
    { q: 'Who is cheapest at €100 per month?', a: `${winner.partner}: a ${formatPct(winner.pct)} variable fee and ${formatEur(winner.annualDrag)} in annual fee drag at that amount.` },
    { q: 'Is RevenueBot’s fee exact?', a: FEE_ROWS.some((r) => r.illustrative)
      ? 'No. The Stacking Strategist schedule marks RevenueBot’s percentage as illustrative until RevenueBot publishes its own fee schedule.'
      : 'See each row note in the methodology page.' },
    { q: 'May I republish the table?', a: 'Yes, with attribution: “Source: Virtuse Bitcoin Fee Index, as of ' + asOfEn + '” and a link to this page. The embed code is above.' }
  ];
  const answer = finalizeAnswer([
    `The Virtuse Bitcoin Fee Index as of ${asOfEn} ranks EU buy routes by annual fee drag.`,
    `At €100/month, the top-ranked route is ${winner.partner} (${winner.method}) at ${formatPct(winner.pct)}, ${formatEur(winner.annualDrag)} a year.`,
    be.status === 'always'
      ? `On listed fees, automated ${be.auto.partner} costs the same as or less than manual ${be.manual.partner} at every monthly amount from €1.`
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
<p>Figures as of ${esc(asOfEn)}. The formula is documented on the <a href="${esc(toRoot(relFile, 'bitcoin-fee-index/methodology/'))}">methodology</a> page.</p>
${tables}
<h2>Break-even: automated vs manual</h2>
<p>${esc(beText)}</p>
<h2>Press blurb</h2>
<p>${esc(pressBlurb())}</p>
<h2>Embed</h2>
<p>Copy and paste the code below; keep the attribution line.</p>
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
    { q: 'Wer ist bei 100 €/Monat am günstigsten?', a: `${winner.partner}, ${formatPctDe(winner.pct)}, ${formatEurDe(winner.annualDrag)} Jahreslast.` },
    { q: 'Sind Spreads enthalten?', a: 'Nein. Nur die prozentuale Gebühr plus ein etwaiges Monatsabo laut Plan. Wechselkurse und Mining-Gebühren sind nicht enthalten.' },
    { q: 'Darf ich die Tabelle zitieren?', a: `Ja, mit Quellenangabe „Quelle: Virtuse Bitcoin-Gebührenindex, Stand ${asOfDe}“ und Link.` }
  ];
  const answer = finalizeAnswer([
    `Der Virtuse Bitcoin-Gebührenindex Stand ${asOfDe} sortiert EU-Kaufrouten nach Jahres-Gebührenlast.`,
    `Bei 100 €/Monat führt ${winner.partner} (${methodDe(winner.method)}) mit ${formatPctDe(winner.pct)}, ${formatEurDe(winner.annualDrag)} pro Jahr.`,
    beText,
    'Kein Angebot. Virtuse verwahrt niemals Ihre Schlüssel.'
  ], 'de');
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin-Gebührenindex (EU) Q3 2026'),
    description: assertDescription(`EU-Kaufrouten nach Gebühren, Stand ${asOfDe}. Günstigste Route bei 100 €/Monat: ${winner.partner} mit ${formatPctDe(winner.pct)}.`),
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
    { q: 'Is this archive different from the live index?', a: `It is the ${asOfEn} snapshot of the same fee schedule. When a later quarter is published, this URL stays the same.` },
    { q: 'What contribution is archived in the table?', a: '€100 per month, 12 purchases, calculated with the Stacking Strategist formula.' },
    { q: 'How do I export a PDF?', a: 'Open the print view and choose Print → Save as PDF in your browser. No extra software is needed.' },
    { q: 'Can I cite a single number?', a: `${ranked[0].partner}’s annual fee drag at €100/month is ${formatEur(ranked[0].annualDrag)} as of ${asOfEn}.` }
  ];
  const answer = finalizeAnswer([
    `In the ${asOfEn} snapshot, the Bitcoin Fee Index ranked ${ranked[0].partner} first at €100/month, with ${formatEur(ranked[0].annualDrag)} annual fee drag (${formatPct(ranked[0].pct)}).`,
    'This URL keeps the snapshot for the quarter, so citations stay valid when a later quarter is published.',
    'A dataset, not a trade quote.'
  ], 'en');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Fee Index archive: 2026 Q3'),
    description: assertDescription(`Q3 2026 snapshot of the Virtuse Bitcoin Fee Index. First at €100/month: ${ranked[0].partner}, ${formatEur(ranked[0].annualDrag)} annual fee drag.`),
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
${tableHtml(['Rank', 'Partner', 'Method', 'Fee', 'Annual fee drag', 'Note'], ranked.map((r, i) => [
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
    `First at €100/month: ${ranked[0].partner}, ${formatEur(ranked[0].annualDrag)} annual fee drag.`,
    'Use your browser’s Print dialog and choose Save as PDF. No extra software is needed.',
    'Attribution required: Virtuse Bitcoin Fee Index, as of ' + asOfEn + '.'
  ], 'en');
  const faqs = [
    { q: 'How do I make a PDF?', a: 'File → Print → Save as PDF (Chrome, Firefox, Safari, Edge). A4 or Letter both work.' },
    { q: 'Does this page change with the live index?', a: `No. It shows the ${asOfEn} archive snapshot.` },
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
<p class="muted">File → Print → Save as PDF. Navigation is hidden when printing.</p>
${tableHtml(['Rank', 'Partner', 'Method', 'Fee', 'Annual fee drag (€100/month)'], ranked.map((r, i) => [
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
      ? 'From the fee schedule of the live Stacking Strategist (21bitcoin 0%, ByBit EU 0.1%, Kraken 0.16%, RevenueBot 0.4% + €4/month, illustrative).'
      : 'From seo-data.json feeSchedule.' },
    { q: 'What is the annual-drag formula?', a: 'costPerPurchase = contribution × pct + fixed + monthly / (periodsPerYear / 12); annualDrag = costPerPurchase × periodsPerYear. The same formula as the live Stacking Strategist.' },
    { q: 'How often will this change?', a: 'When a partner changes its published fees, the schedule is updated and a new quarterly snapshot is published. Archive URLs stay stable.' }
  ];
  const answer = finalizeAnswer([
    `Methodology as of ${asOfEn}: rank partners by annual fee drag at a stated monthly euro contribution.`,
    'The formula is the one used by the live Stacking Strategist: a percentage of each purchase plus any monthly subscription.',
    'Spreads, currency conversion and miner fees are out of scope. RevenueBot’s rate is marked as illustrative in the source schedule.',
    'Not a brokerage quote.'
  ], 'en');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Fee Index methodology (Q3 2026)'),
    description: assertDescription(`How the Virtuse Bitcoin Fee Index ranks EU buy routes as of ${asOfEn}. Stacking Strategist formula, published fees.`),
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
<p>Default: periodsPerYear = 12, as in the live Stacking Strategist.</p>
<h2>Out of scope</h2>
<ul>
  <li>Bid/ask spread</li>
  <li>Currency conversion from CZK, PLN, HUF, RON or BGN into EUR</li>
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
    { q: 'Can this page be iframed?', a: 'Yes. The page is built to be embedded in an iframe on other websites.' },
    { q: 'What table is shown?', a: `The €100/month ranking as of ${asOfEn}, with four listed partners.` },
    { q: 'Is JavaScript required?', a: 'No. The table is static HTML.' },
    { q: 'What attribution is required?', a: `Visible “Source: Virtuse Bitcoin Fee Index, as of ${asOfEn}” plus a link to the index.` }
  ];
  const answer = finalizeAnswer([
    `Embeddable Fee Index widget as of ${asOfEn}.`,
    `At €100/month, ${ranked[0].partner} ranks first at ${formatPct(ranked[0].pct)} (${formatEur(ranked[0].annualDrag)} a year).`,
    'Static HTML; no JavaScript required. Always show the source line.',
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
${tableHtml(['Partner', 'Method', 'Fee', 'Annual fee drag at €100/month'], ranked.map((r) => [
  esc(r.partner), esc(r.method), esc(formatPct(r.pct)), esc(formatEur(r.annualDrag))
]))}
<p class="muted">Source: <a href="${esc(toRoot(relFile, 'bitcoin-fee-index/'))}">Virtuse Bitcoin Fee Index</a> (as of ${esc(asOfEn)}). Virtuse never holds your keys.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

// ---------- Slovak (sk/) ----------
const SK_HOME = { name: 'Domov', href: null, abs: abs('sk/index.html') };
function skHome(relFile) { return { ...SK_HOME, href: toRoot(relFile, 'sk/index.html') }; }

// SK tax hub
{
  const relFile = 'sk/bitcoin-dane/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `sk/bitcoin-dane/${slugSk(c.id)}/`))}">${esc(nameSk(c.id))}</a>`,
    esc(meta.taxSk[c.id].gainTax),
    esc(meta.taxSk[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Ktoré krajiny tento prehľad pokrýva?', a: `${N} krajín EÚ: ${COUNTRIES.map((c) => nameSk(c.id)).join(', ')}. Stav ${asOfSk}, údaje z modulu Virtuse Tax.` },
    { q: 'Ide o daňové poradenstvo?', a: 'Nie. Orientačný prehľad 2026 – nejde o daňové poradenstvo. Pravidlá pre aktuálny rok si overte u miestneho poradcu.' },
    { q: 'Hlási Virtuse moje držby daňovým úradom?', a: 'Nie. Virtuse nikdy nedrží vaše kľúče ani históriu vašich transakcií. KYC robia partneri sami.' },
    { q: 'Kde si okrem daní preverím aj dedenie?', a: `V module Tax & Inheritance Agent (live modul) s rovnakými ${N} krajinami a kontrolou pripravenosti na multisig.` }
  ];
  const answer = finalizeAnswer([
    `Tento prehľad porovnáva zdanenie Bitcoinu v ${N} krajinách EÚ, stav ${asOfSk}.`,
    'Sadzby, oslobodenia a poznámky k daňovému priznaniu pochádzajú z modulu Virtuse Tax.',
    'Nemecko a Rakúsko oslobodzujú zisky po 1 roku držby, Česko uplatňuje 3-ročný časový test a Holandsko namiesto dane zo ziskov zdaňuje predpokladaný výnos (Box 3).',
    'Orientačný prehľad 2026, nejde o daňové poradenstvo.'
  ], 'sk');
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle(`Dane z Bitcoinu v ${N} krajinách EÚ (2026)`),
    description: assertDescription(`Sadzby dane z Bitcoinu, oslobodenia podľa doby držby a daňové priznanie v ${N} krajinách EÚ, stav ${asOfSk}. Orientačný prehľad.`),
    h1: `Dane z Bitcoinu v ${N} krajinách EÚ`,
    answerHtml: esc(answer),
    breadcrumbs: [skHome(relFile), { name: 'Dane z Bitcoinu', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-dane/slovensko/'), label: 'Dane z Bitcoinu na Slovensku' },
      { href: toRoot(relFile, 'sk/bitcoin-dedicstvo/'), label: 'Bitcoin a dedičstvo' },
      { href: toRoot(relFile, 'sk/bitcoin-index-poplatkov/'), label: 'Index poplatkov za Bitcoin' }
    ],
    moduleCta: { href: toRoot(relFile, 'sk/' + TAX_AGENT), label: 'Otvoriť Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Každá stránka krajiny uvádza daň zo ziskov, prípadné oslobodenie podľa doby držby a daňové priznanie, stav ${esc(asOfSk)}. Live modul Tax & Inheritance Agent používa rovnaké údaje a pridáva skóre pripravenosti na dedenie.</p>
<h2>Porovnanie krajín</h2>
${tableHtml(['Krajina', 'Daň zo ziskov', 'Oslobodenie'], rows)}
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// SK country tax pages
for (const c of COUNTRIES) {
  const relFile = `sk/bitcoin-dane/${slugSk(c.id)}/index.html`;
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const t = meta.taxSk[c.id];
  const inN = inSk(c.id);
  const nbs = neighborsOf(c.id);
  const faqs = [
    { q: `Aká je daň z Bitcoinu ${inN}?`, a: `Stav ${asOfSk}: ${t.gainTax}. Orientačný prehľad 2026, nejde o daňové poradenstvo.` },
    { q: `Existuje ${inN} oslobodenie podľa doby držby?`, a: `${t.exemption}. Pred podaním priznania si pravidlá pre aktuálny rok overte u miestneho daňového poradcu.` },
    { q: `Ako sa ${inN} podáva daňové priznanie?`, a: `${t.filing}. ${t.note}` },
    { q: 'Drží Virtuse môj Bitcoin alebo podáva moje daňové priznanie?', a: `Nie. Virtuse nikdy nedrží vaše kľúče. KYC a registrácia prebiehajú u partnera. Tax Agent porovná prehľad ${N} krajín; daňové priznanie pripraví kvalifikovaný daňový poradca.` }
  ];
  const answer = finalizeAnswer([
    `Dane z Bitcoinu ${inN}, stav ${asOfSk}: ${t.gainTax}.`,
    `Oslobodenie: ${t.exemption}.`,
    `Priznanie: ${t.filing}.`,
    t.note,
    'Orientačný prehľad 2026, nejde o daňové poradenstvo.'
  ], 'sk');
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle(`Dane z Bitcoinu ${inN} (${asOfSk})`),
    description: assertDescription(`Dane z Bitcoinu ${inN} (${asOfSk}): ${t.gainTax}. Nejde o daňové poradenstvo.`),
    h1: `Dane z Bitcoinu ${inN}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      skHome(relFile),
      { name: 'Dane z Bitcoinu', href: toRoot(relFile, 'sk/bitcoin-dane/'), abs: abs('sk/bitcoin-dane/index.html') },
      { name: nameSk(c.id), abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-predat-alebo-pozicat/'), label: 'Bitcoin: predať alebo požičať' },
      { href: toRoot(relFile, 'sk/bitcoin-dedicstvo/'), label: 'Bitcoin a dedičstvo' },
      { href: toRoot(relFile, nbs[0] ? `sk/bitcoin-dane/${slugSk(nbs[0].id)}/` : 'sk/bitcoin-dane/'), label: nbs[0] ? `Dane z Bitcoinu ${inSk(nbs[0].id)}` : 'Všetky krajiny' }
    ],
    moduleCta: { href: toRoot(relFile, `sk/${TAX_AGENT}?country=${c.id}`), label: `Skontrolovať ${nameSk(c.id)} v Tax Agentovi →` },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>${esc(c.flag)} Údaje so stavom ${esc(asOfSk)}, prevzaté z modulu Virtuse Tax.</p>
<h2>Sadzby a daňové priznanie</h2>
${tableHtml(['Údaj', 'Stav ' + asOfSk], [
  ['Daň zo ziskov', esc(t.gainTax)],
  ['Oslobodenie', esc(t.exemption)],
  ['Daňové priznanie', esc(t.filing)],
  ['Poznámka', esc(t.note)]
])}
<h2>Kedy zvyčajne vzniká daň?</h2>
<p>${esc(t.note)} Nákup Bitcoinu sa v tomto prehľade nepovažuje za zdaniteľný prevod; pred platbou, výmenou, darovaním alebo požičaním mincí si overte miestne pravidlá.</p>
<h2>Susedné krajiny</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(relFile, `sk/bitcoin-dane/${slugSk(n.id)}/`))}">Dane z Bitcoinu ${esc(inSk(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// SK DCA calculator
{
  const relFile = 'sk/bitcoin-dca-kalkulacka/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Predpovedá táto kalkulačka cenu Bitcoinu?', a: 'Nie. Porovnáva len poplatky partnerov podľa zverejneného cenníka. Výnos z ceny Bitcoinu nemodeluje.' },
    { q: `Aký je štandardný plán, stav ${asOfSk}?`, a: 'Jednorazovo 500 € a potom 100 € mesačne počas 12 mesiacov. Poradie podľa poplatkov za prvý rok.' },
    { q: 'Ktorá cesta je v tomto pláne najlacnejšia?', a: `${win.partner} (${methodSk(win.method)}) s variabilným poplatkom ${formatPctSk(win.pct)} podľa vzorca Stacking Strategist.` },
    { q: 'Ide o investičné poradenstvo?', a: 'Nie. Slúži len na vzdelávacie účely. KYC prebieha u partnera. Virtuse nikdy nedrží vaše kľúče.' }
  ];
  const answer = finalizeAnswer([
    `V príklade DCA, ktorý počíta len s poplatkami (500 € a potom 100 € mesačne počas 12 mesiacov), je k stavu ${asOfSk} na prvom mieste ${win.partner}.`,
    `Variabilný poplatok ${formatPctSk(win.pct)}. Nejde o predpoveď ceny.`,
    'Údaje z live modulu Stacking Strategist. Orientačný prehľad 2026.'
  ], 'sk');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle('Bitcoin DCA kalkulačka (poplatky v EÚ 2026)'),
    description: assertDescription(`DCA kalkulačka pre Bitcoin, ktorá počíta len s poplatkami, stav ${asOfSk}. Štandard 500 € + 100 € mesačne, najlacnejšia cesta ${win.partner}.`),
    h1: 'Bitcoin DCA kalkulačka',
    answerHtml: esc(answer),
    breadcrumbs: [skHome(relFile), { name: 'DCA kalkulačka', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-index-poplatkov/'), label: 'Index poplatkov za Bitcoin' },
      { href: toRoot(relFile, 'sk/bitcoin-predat-alebo-pozicat/'), label: 'Bitcoin: predať alebo požičať' },
      { href: toRoot(relFile, 'sk/bitcoin-dane/slovensko/'), label: 'Dane z Bitcoinu na Slovensku' }
    ],
    moduleCta: { href: toRoot(relFile, 'sk/stacking.html'), label: 'Otvoriť Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin DCA kalkulačka',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Štandardný príklad: 500 € a potom 100 € mesačne × 12. Rovnaký vzorec ako v live module Stacking Strategist.</p>
<h2>Poradie pri 100 € mesačne</h2>
${tableHtml(['Poradie', 'Partner', 'Metóda', 'Variabilný poplatok', 'Ročné poplatky'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodSk(r.method)), esc(formatPctSk(r.pct)), esc(formatEurSk(r.annualDrag))
]))}
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// SK sell vs borrow
{
  const relFile = 'sk/bitcoin-predat-alebo-pozicat/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `Vzniká pri predaji v týchto ${N} krajinách daň?`, a: `Spravidla áno, pri predaji alebo výmene. Oslobodenia sa líšia: Nemecko 0 % po 1 roku držby, Česko 3-ročný časový test, Poľsko bez oslobodenia. Stav ${asOfSk}. Nejde o daňové poradenstvo.` },
    { q: 'Je pôžička rovnaká daňová udalosť ako predaj?', a: 'V tomto prehľade nie. Úroky, riziko likvidácie a KYC u partnera však platia. Konkrétne čísla vypočíta Loan & Liquidity Copilot.' },
    { q: 'Čo je riziko likvidácie?', a: 'Ak hodnota zábezpeky klesne na hranicu partnera, partner môže zábezpeku predať a splatiť ňou pôžičku. Virtuse nikdy nedrží vaše kľúče ani zábezpeku.' },
    { q: 'Kde si prepočítam konkrétnu sumu?', a: 'V live module Loan & Liquidity Copilot. Táto stránka vysvetľuje len rozdiel medzi daňou a rizikom na základe zverejnených daňových sadzieb.' }
  ];
  const answer = finalizeAnswer([
    `K stavu ${asOfSk} môže predaj Bitcoinu vyvolať daň (napríklad v Nemecku až 45 % počas 1-ročnej lehoty držby, v Rumunsku jednotných 10 %).`,
    'Pôžička zabezpečená Bitcoinom vám ponechá trhovú pozíciu, ale pridá úroky a riziko likvidácie u partnera.',
    'Orientačný prehľad 2026, nejde o daňové ani úverové poradenstvo. Virtuse nikdy nedrží vaše kľúče.'
  ], 'sk');
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle('Bitcoin: predať, alebo si požičať? (2026)'),
    description: assertDescription(`Predať Bitcoin a zaplatiť daň, alebo si požičať so zábezpekou v Bitcoine a zostať investovaný? Sadzby ${N} krajín EÚ, stav ${asOfSk}.`),
    h1: 'Predať Bitcoin, alebo si požičať so zábezpekou?',
    answerHtml: esc(answer),
    breadcrumbs: [skHome(relFile), { name: 'Predať alebo požičať', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-dane/slovensko/'), label: 'Dane z Bitcoinu na Slovensku' },
      { href: toRoot(relFile, 'sk/bitcoin-dca-kalkulacka/'), label: 'DCA kalkulačka' },
      { href: toRoot(relFile, 'sk/bitcoin-dedicstvo/'), label: 'Bitcoin a dedičstvo' }
    ],
    moduleCta: { href: toRoot(relFile, 'sk/loan.html'), label: 'Porovnať v Loan Copilote →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin: predať alebo požičať',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Daň pri predaji</h2>
${tableHtml(['Krajina', 'Daň zo ziskov', 'Oslobodenie'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `sk/bitcoin-dane/${slugSk(c.id)}/`))}">${esc(nameSk(c.id))}</a>`,
  esc(meta.taxSk[c.id].gainTax),
  esc(meta.taxSk[c.id].exemption)
]))}
<h2>Riziko pri pôžičke</h2>
<p>Pôžičky zabezpečené Bitcoinom poskytujú regulovaní partneri, nie Virtuse. Ponecháte si cenovú expozíciu, platíte úroky a vaša zábezpeka môže byť zlikvidovaná. Virtuse zábezpeku nikdy nedrží.</p>
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// SK inheritance
{
  const relFile = 'sk/bitcoin-dedicstvo/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const faqs = [
    { q: 'Môže byť v liste s pokynmi seed fráza?', a: 'Nie. List uvádza zoznam, umiestnenia a kontakty – nikdy nie seed frázy. Uložte ho spolu so závetom alebo u právnika.' },
    { q: 'Prečo multisig 2 z 3?', a: 'Jediná seed fráza je jediný bod zlyhania pre vás aj pre vašich dedičov.' },
    { q: 'Drží Virtuse kľúče pre dedičov?', a: 'Nie. Virtuse nikdy nedrží vaše kľúče.' },
    { q: 'Ide o právne poradenstvo?', a: `Nie. Je to kontrolný zoznam na vzdelávacie účely z modulu Tax, stav ${asOfSk}.` }
  ];
  const answer = finalizeAnswer([
    `K stavu ${asOfSk} má kontrolný zoznam modulu Tax šesť bodov: list s pokynmi, geografické rozdelenie kľúčov, informovaný dedič, multisig 2 z 3, test obnovy a zdokumentované účty.`,
    'Jediná seed fráza je jediný bod zlyhania. Virtuse nikdy nedrží vaše kľúče.',
    'Nejde o právne poradenstvo.'
  ], 'sk');
  const howto = {
    '@type': 'HowTo',
    name: 'Príprava Bitcoinu na dedenie',
    inLanguage: 'sk',
    step: meta.inheritanceSk.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle('Bitcoin a dedičstvo: kontrolný zoznam (2026)'),
    description: assertDescription(`Šesťbodový kontrolný zoznam pre dedenie Bitcoinu, stav ${asOfSk}: list s pokynmi, rozdelenie kľúčov, multisig 2 z 3. Nejde o právne poradenstvo.`),
    h1: 'Dedenie Bitcoinu: kontrolný zoznam',
    answerHtml: esc(answer),
    breadcrumbs: [skHome(relFile), { name: 'Dedičstvo', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-dane/slovensko/'), label: 'Dane z Bitcoinu na Slovensku' },
      { href: toRoot(relFile, 'sk/bitcoin-dane/'), label: `Dane v ${N} krajinách EÚ` },
      { href: toRoot(relFile, 'sk/bitcoin-predat-alebo-pozicat/'), label: 'Bitcoin: predať alebo požičať' }
    ],
    moduleCta: { href: toRoot(relFile, 'sk/' + TAX_AGENT), label: 'Ohodnotiť zoznam v Tax Agentovi →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Obsah zodpovedá kontrolnému zoznamu modulu Tax. Nejde o právne poradenstvo.</p>
<h2>Návod: šesť krokov</h2>
<ol>${meta.inheritanceSk.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// SK fee index
{
  const relFile = 'sk/bitcoin-index-poplatkov/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'sk');
  const faqs = [
    { q: 'Čo meria index poplatkov?', a: `Ročné poplatky kúpnych ciest, stav ${asOfSk}, podľa vzorca modulu Stacking Strategist.` },
    { q: 'Kto je pri 100 € mesačne najlacnejší?', a: `${winner.partner}: ${formatPctSk(winner.pct)}, ročné poplatky ${formatEurSk(winner.annualDrag)}.` },
    { q: 'Sú v tom zahrnuté spready?', a: 'Nie. Len percentuálny poplatok a prípadné mesačné predplatné podľa cenníka. Kurzové rozdiely a poplatky siete Bitcoin (miner fees) nie sú zahrnuté.' },
    { q: 'Môžem tabuľku citovať?', a: `Áno, s uvedením zdroja „Zdroj: Virtuse index poplatkov za Bitcoin, stav ${asOfSk}“ a odkazom.` }
  ];
  const answer = finalizeAnswer([
    `Virtuse index poplatkov za Bitcoin, stav ${asOfSk}, zoraďuje kúpne cesty v EÚ podľa ročných poplatkov.`,
    `Pri 100 € mesačne vedie ${winner.partner} (${methodSk(winner.method)}) s ${formatPctSk(winner.pct)}, ${formatEurSk(winner.annualDrag)} ročne.`,
    beText,
    'Nejde o ponuku. Virtuse nikdy nedrží vaše kľúče.'
  ], 'sk');
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle('Index poplatkov za Bitcoin (EÚ) Q3 2026'),
    description: assertDescription(`Kúpne cesty v EÚ podľa poplatkov, stav ${asOfSk}. Najlacnejšia cesta pri 100 € mesačne: ${winner.partner} s ${formatPctSk(winner.pct)}.`),
    h1: 'Index poplatkov za Bitcoin',
    answerHtml: esc(answer),
    breadcrumbs: [skHome(relFile), { name: 'Index poplatkov', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-dca-kalkulacka/'), label: 'DCA kalkulačka' },
      { href: toRoot(relFile, 'sk/bitcoin-dane/slovensko/'), label: 'Dane z Bitcoinu na Slovensku' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Metodika (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, 'sk/stacking.html'), label: 'Otvoriť Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Virtuse index poplatkov za Bitcoin',
        inLanguage: 'sk',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Virtuse index poplatkov za Bitcoin',
        temporalCoverage: '2026-Q3',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Poradie podľa mesačného vkladu</h2>
${tables}
<h2>Automatizovane, alebo manuálne?</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// ---------- Czech (cs/) ----------
function csHome(relFile) { return { name: 'Domů', href: toRoot(relFile, 'cs/index.html'), abs: abs('cs/index.html') }; }

// CS tax hub
{
  const relFile = 'cs/bitcoin-dane/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `cs/bitcoin-dane/${slugCs(c.id)}/`))}">${esc(nameCs(c.id))}</a>`,
    esc(meta.taxCs[c.id].gainTax),
    esc(meta.taxCs[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Které země tento přehled pokrývá?', a: `${N} zemí EU: ${COUNTRIES.map((c) => nameCs(c.id)).join(', ')}. Stav ${asOfCs}, údaje z modulu Virtuse Tax.` },
    { q: 'Jde o daňové poradenství?', a: 'Ne. Orientační přehled 2026 – nejde o daňové poradenství. Pravidla pro aktuální rok si ověřte u místního poradce.' },
    { q: 'Hlásí Virtuse moje držby finančnímu úřadu?', a: 'Ne. Virtuse nikdy nedrží vaše klíče ani historii vašich transakcí. KYC provádějí partneři sami.' },
    { q: 'Kde si kromě daní prověřím i dědění?', a: `V modulu Tax & Inheritance Agent (živý modul) se stejnými ${N} zeměmi a kontrolou připravenosti na multisig.` }
  ];
  const answer = finalizeAnswer([
    `Tento přehled porovnává zdanění Bitcoinu v ${N} zemích EU, stav ${asOfCs}.`,
    'Sazby, osvobození a poznámky k daňovému přiznání pocházejí z modulu Virtuse Tax.',
    'Německo a Rakousko osvobozují zisky po 1 roce držení, Česko uplatňuje 3letý časový test a Nizozemsko místo daně ze zisků daní předpokládaný výnos (Box 3).',
    'Orientační přehled 2026, nejde o daňové poradenství.'
  ], 'cs');
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle(`Daně z Bitcoinu v ${N} zemích EU (2026)`),
    description: assertDescription(`Sazby daně z Bitcoinu, osvobození podle doby držení a daňové přiznání v ${N} zemích EU, stav ${asOfCs}. Orientační přehled.`),
    h1: `Daně z Bitcoinu v ${N} zemích EU`,
    answerHtml: esc(answer),
    breadcrumbs: [csHome(relFile), { name: 'Daně z Bitcoinu', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-dane/cesko/'), label: 'Daně z Bitcoinu v Česku' },
      { href: toRoot(relFile, 'cs/bitcoin-dedictvi/'), label: 'Bitcoin a dědění' },
      { href: toRoot(relFile, 'cs/bitcoin-index-poplatku/'), label: 'Index poplatků za Bitcoin' }
    ],
    moduleCta: { href: toRoot(relFile, 'cs/' + TAX_AGENT), label: 'Otevřít Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Každá stránka země uvádí daň ze zisků, případné osvobození podle doby držení a daňové přiznání, stav ${esc(asOfCs)}. Živý modul Tax & Inheritance Agent používá stejné údaje a přidává skóre připravenosti na dědění.</p>
<h2>Srovnání zemí</h2>
${tableHtml(['Země', 'Daň ze zisků', 'Osvobození'], rows)}
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// CS country tax pages
for (const c of COUNTRIES) {
  const relFile = `cs/bitcoin-dane/${slugCs(c.id)}/index.html`;
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const t = meta.taxCs[c.id];
  const inN = inCs(c.id);
  const nbs = neighborsOf(c.id);
  const faqs = [
    { q: `Jaká je daň z Bitcoinu ${inN}?`, a: `Stav ${asOfCs}: ${t.gainTax}. Orientační přehled 2026, nejde o daňové poradenství.` },
    { q: `Existuje ${inN} osvobození podle doby držení?`, a: `${t.exemption}. Před podáním přiznání si pravidla pro aktuální rok ověřte u místního daňového poradce.` },
    { q: `Jak se ${inN} podává daňové přiznání?`, a: `${t.filing}. ${t.note}` },
    { q: 'Drží Virtuse můj Bitcoin nebo podává moje daňové přiznání?', a: `Ne. Virtuse nikdy nedrží vaše klíče. KYC a registrace probíhají u partnera. Tax Agent porovná přehled ${N} zemí; daňové přiznání připraví kvalifikovaný daňový poradce.` }
  ];
  const answer = finalizeAnswer([
    `Daně z Bitcoinu ${inN}, stav ${asOfCs}: ${t.gainTax}.`,
    `Osvobození: ${t.exemption}.`,
    `Přiznání: ${t.filing}.`,
    t.note,
    'Orientační přehled 2026, nejde o daňové poradenství.'
  ], 'cs');
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle(`Daně z Bitcoinu ${inN} (${asOfCs})`),
    description: assertDescription(`Daně z Bitcoinu ${inN} (${asOfCs}): ${t.gainTax}. Nejde o daňové poradenství.`),
    h1: `Daně z Bitcoinu ${inN}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      csHome(relFile),
      { name: 'Daně z Bitcoinu', href: toRoot(relFile, 'cs/bitcoin-dane/'), abs: abs('cs/bitcoin-dane/index.html') },
      { name: nameCs(c.id), abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-prodat-nebo-pujcit/'), label: 'Bitcoin: prodat, nebo si půjčit' },
      { href: toRoot(relFile, 'cs/bitcoin-dedictvi/'), label: 'Bitcoin a dědění' },
      { href: toRoot(relFile, nbs[0] ? `cs/bitcoin-dane/${slugCs(nbs[0].id)}/` : 'cs/bitcoin-dane/'), label: nbs[0] ? `Daně z Bitcoinu ${inCs(nbs[0].id)}` : 'Všechny země' }
    ],
    moduleCta: { href: toRoot(relFile, `cs/${TAX_AGENT}?country=${c.id}`), label: `Zkontrolovat ${accCs(c.id)} v Tax Agentovi →` },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>${esc(c.flag)} Údaje ke stavu ${esc(asOfCs)}, převzaté z modulu Virtuse Tax.</p>
<h2>Sazby a daňové přiznání</h2>
${tableHtml(['Údaj', 'Stav ' + asOfCs], [
  ['Daň ze zisků', esc(t.gainTax)],
  ['Osvobození', esc(t.exemption)],
  ['Daňové přiznání', esc(t.filing)],
  ['Poznámka', esc(t.note)]
])}
<h2>Kdy obvykle vzniká daň?</h2>
<p>${esc(t.note)} Nákup Bitcoinu se v tomto přehledu nepovažuje za zdanitelný převod; před platbou, směnou, darováním nebo půjčením mincí si ověřte místní pravidla.</p>
<h2>Sousední země</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(relFile, `cs/bitcoin-dane/${slugCs(n.id)}/`))}">Daně z Bitcoinu ${esc(inCs(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// CS DCA calculator
{
  const relFile = 'cs/bitcoin-dca-kalkulacka/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Předpovídá tato kalkulačka cenu Bitcoinu?', a: 'Ne. Porovnává jen poplatky partnerů podle zveřejněného ceníku. Výnos z ceny Bitcoinu nemodeluje.' },
    { q: `Jaký je standardní plán, stav ${asOfCs}?`, a: 'Jednorázově 500 € a poté 100 € měsíčně po dobu 12 měsíců. Pořadí podle poplatků za první rok.' },
    { q: 'Která cesta je v tomto plánu nejlevnější?', a: `${win.partner} (${methodCs(win.method)}) s variabilním poplatkem ${formatPctSk(win.pct)} podle vzorce Stacking Strategist.` },
    { q: 'Jde o investiční poradenství?', a: 'Ne. Slouží jen ke vzdělávacím účelům. KYC probíhá u partnera. Virtuse nikdy nedrží vaše klíče.' }
  ];
  const answer = finalizeAnswer([
    `V příkladu DCA, který počítá jen s poplatky (500 € a poté 100 € měsíčně po dobu 12 měsíců), je ke stavu ${asOfCs} na prvním místě ${win.partner}.`,
    `Variabilní poplatek ${formatPctSk(win.pct)}. Nejde o předpověď ceny.`,
    'Údaje z živého modulu Stacking Strategist. Orientační přehled 2026.'
  ], 'cs');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle('Bitcoin DCA kalkulačka (poplatky v EU 2026)'),
    description: assertDescription(`DCA kalkulačka pro Bitcoin, která počítá jen s poplatky, stav ${asOfCs}. Standard 500 € + 100 € měsíčně, nejlevnější cesta ${win.partner}.`),
    h1: 'Bitcoin DCA kalkulačka',
    answerHtml: esc(answer),
    breadcrumbs: [csHome(relFile), { name: 'DCA kalkulačka', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-index-poplatku/'), label: 'Index poplatků za Bitcoin' },
      { href: toRoot(relFile, 'cs/bitcoin-prodat-nebo-pujcit/'), label: 'Bitcoin: prodat, nebo si půjčit' },
      { href: toRoot(relFile, 'cs/bitcoin-dane/cesko/'), label: 'Daně z Bitcoinu v Česku' }
    ],
    moduleCta: { href: toRoot(relFile, 'cs/stacking.html'), label: 'Otevřít Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin DCA kalkulačka',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Standardní příklad: 500 € a poté 100 € měsíčně × 12. Stejný vzorec jako v živém modulu Stacking Strategist.</p>
<h2>Pořadí při 100 € měsíčně</h2>
${tableHtml(['Pořadí', 'Partner', 'Metoda', 'Variabilní poplatek', 'Roční poplatky'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodCs(r.method)), esc(formatPctSk(r.pct)), esc(formatEurSk(r.annualDrag))
]))}
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// CS sell vs borrow
{
  const relFile = 'cs/bitcoin-prodat-nebo-pujcit/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `Vzniká při prodeji v těchto ${N} zemích daň?`, a: `Zpravidla ano, při prodeji nebo směně. Osvobození se liší: Německo 0 % po 1 roce držení, Česko 3letý časový test, Polsko bez osvobození. Stav ${asOfCs}. Nejde o daňové poradenství.` },
    { q: 'Je půjčka stejná daňová událost jako prodej?', a: 'V tomto přehledu ne. Úroky, riziko likvidace a KYC u partnera však platí. Konkrétní čísla spočítá Loan & Liquidity Copilot.' },
    { q: 'Co je riziko likvidace?', a: 'Pokud hodnota zajištění klesne na hranici partnera, partner může zajištění prodat a splatit jím půjčku. Virtuse nikdy nedrží vaše klíče ani zajištění.' },
    { q: 'Kde si přepočítám konkrétní částku?', a: 'V živém modulu Loan & Liquidity Copilot. Tato stránka vysvětluje jen rozdíl mezi daní a rizikem na základě zveřejněných daňových sazeb.' }
  ];
  const answer = finalizeAnswer([
    `Ke stavu ${asOfCs} může prodej Bitcoinu vyvolat daň (například v Německu až 45 % během 1leté lhůty držení, v Rumunsku jednotných 10 %).`,
    'Půjčka zajištěná Bitcoinem vám ponechá tržní pozici, ale přidá úroky a riziko likvidace u partnera.',
    'Orientační přehled 2026, nejde o daňové ani úvěrové poradenství. Virtuse nikdy nedrží vaše klíče.'
  ], 'cs');
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle('Bitcoin: prodat, nebo si půjčit? (2026)'),
    description: assertDescription(`Prodat Bitcoin a zaplatit daň, nebo si půjčit se zajištěním v Bitcoinu a zůstat investovaný? Sazby ${N} zemí EU, stav ${asOfCs}.`),
    h1: 'Prodat Bitcoin, nebo si půjčit se zajištěním?',
    answerHtml: esc(answer),
    breadcrumbs: [csHome(relFile), { name: 'Prodat, nebo půjčit', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-dane/cesko/'), label: 'Daně z Bitcoinu v Česku' },
      { href: toRoot(relFile, 'cs/bitcoin-dca-kalkulacka/'), label: 'DCA kalkulačka' },
      { href: toRoot(relFile, 'cs/bitcoin-dedictvi/'), label: 'Bitcoin a dědění' }
    ],
    moduleCta: { href: toRoot(relFile, 'cs/loan.html'), label: 'Porovnat v Loan Copilotu →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin: prodat, nebo si půjčit',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Daň při prodeji</h2>
${tableHtml(['Země', 'Daň ze zisků', 'Osvobození'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `cs/bitcoin-dane/${slugCs(c.id)}/`))}">${esc(nameCs(c.id))}</a>`,
  esc(meta.taxCs[c.id].gainTax),
  esc(meta.taxCs[c.id].exemption)
]))}
<h2>Riziko při půjčce</h2>
<p>Půjčky zajištěné Bitcoinem poskytují regulovaní partneři, ne Virtuse. Ponecháte si cenovou expozici, platíte úroky a vaše zajištění může být zlikvidováno. Virtuse zajištění nikdy nedrží.</p>
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// CS inheritance
{
  const relFile = 'cs/bitcoin-dedictvi/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const faqs = [
    { q: 'Může být v dopise s pokyny seed fráze?', a: 'Ne. Dopis uvádí seznam, umístění a kontakty – nikdy ne seed fráze. Uložte ho spolu se závětí nebo u právníka.' },
    { q: 'Proč multisig 2 ze 3?', a: 'Jediná seed fráze je jediný bod selhání pro vás i pro vaše dědice.' },
    { q: 'Drží Virtuse klíče pro dědice?', a: 'Ne. Virtuse nikdy nedrží vaše klíče.' },
    { q: 'Jde o právní poradenství?', a: `Ne. Je to kontrolní seznam ke vzdělávacím účelům z modulu Tax, stav ${asOfCs}.` }
  ];
  const answer = finalizeAnswer([
    `Ke stavu ${asOfCs} má kontrolní seznam modulu Tax šest bodů: dopis s pokyny, geografické rozdělení klíčů, informovaný dědic, multisig 2 ze 3, test obnovy a zdokumentované účty.`,
    'Jediná seed fráze je jediný bod selhání. Virtuse nikdy nedrží vaše klíče.',
    'Nejde o právní poradenství.'
  ], 'cs');
  const howto = {
    '@type': 'HowTo',
    name: 'Příprava Bitcoinu na dědění',
    inLanguage: 'cs',
    step: meta.inheritanceCs.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle('Bitcoin a dědění: kontrolní seznam (2026)'),
    description: assertDescription(`Šestibodový kontrolní seznam pro dědění Bitcoinu, stav ${asOfCs}: dopis s pokyny, rozdělení klíčů, multisig 2 ze 3. Nejde o právní poradenství.`),
    h1: 'Dědění Bitcoinu: kontrolní seznam',
    answerHtml: esc(answer),
    breadcrumbs: [csHome(relFile), { name: 'Dědění', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-dane/cesko/'), label: 'Daně z Bitcoinu v Česku' },
      { href: toRoot(relFile, 'cs/bitcoin-dane/'), label: `Daně v ${N} zemích EU` },
      { href: toRoot(relFile, 'cs/bitcoin-prodat-nebo-pujcit/'), label: 'Bitcoin: prodat, nebo si půjčit' }
    ],
    moduleCta: { href: toRoot(relFile, 'cs/' + TAX_AGENT), label: 'Ohodnotit seznam v Tax Agentovi →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Obsah odpovídá kontrolnímu seznamu modulu Tax. Nejde o právní poradenství.</p>
<h2>Návod: šest kroků</h2>
<ol>${meta.inheritanceCs.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// CS fee index
{
  const relFile = 'cs/bitcoin-index-poplatku/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'cs');
  const faqs = [
    { q: 'Co měří index poplatků?', a: `Roční poplatky nákupních cest, stav ${asOfCs}, podle vzorce modulu Stacking Strategist.` },
    { q: 'Kdo je při 100 € měsíčně nejlevnější?', a: `${winner.partner}: ${formatPctSk(winner.pct)}, roční poplatky ${formatEurSk(winner.annualDrag)}.` },
    { q: 'Jsou v tom zahrnuté spready?', a: 'Ne. Jen procentní poplatek a případné měsíční předplatné podle ceníku. Kurzové rozdíly a poplatky sítě Bitcoin (miner fees) zahrnuté nejsou.' },
    { q: 'Mohu tabulku citovat?', a: `Ano, s uvedením zdroje „Zdroj: Virtuse index poplatků za Bitcoin, stav ${asOfCs}“ a odkazem.` }
  ];
  const answer = finalizeAnswer([
    `Virtuse index poplatků za Bitcoin, stav ${asOfCs}, řadí nákupní cesty v EU podle ročních poplatků.`,
    `Při 100 € měsíčně vede ${winner.partner} (${methodCs(winner.method)}) s ${formatPctSk(winner.pct)}, ${formatEurSk(winner.annualDrag)} ročně.`,
    beText,
    'Nejde o nabídku. Virtuse nikdy nedrží vaše klíče.'
  ], 'cs');
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle('Index poplatků za Bitcoin (EU) Q3 2026'),
    description: assertDescription(`Nákupní cesty v EU podle poplatků, stav ${asOfCs}. Nejlevnější cesta při 100 € měsíčně: ${winner.partner} s ${formatPctSk(winner.pct)}.`),
    h1: 'Index poplatků za Bitcoin',
    answerHtml: esc(answer),
    breadcrumbs: [csHome(relFile), { name: 'Index poplatků', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-dca-kalkulacka/'), label: 'DCA kalkulačka' },
      { href: toRoot(relFile, 'cs/bitcoin-dane/cesko/'), label: 'Daně z Bitcoinu v Česku' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Metodika (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, 'cs/stacking.html'), label: 'Otevřít Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Virtuse index poplatků za Bitcoin',
        inLanguage: 'cs',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Virtuse index poplatků za Bitcoin',
        temporalCoverage: '2026-Q3',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Pořadí podle měsíčního vkladu</h2>
${tables}
<h2>Automatizovaně, nebo ručně?</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// ---------- llms.txt ----------
function llmsShort() {
  const taxLines = COUNTRIES.map((c) =>
    `- [${c.name}](${ORIGIN}/bitcoin-tax/${slugEn(c.id)}/): ${c.gainTax}. ${c.exemption}. As of ${asOfEn}.`
  ).join('\n');
  const feeLines = rankRoutes(FEE_ROWS, 100).map((r, i) =>
    `- ${i + 1}. ${r.partner} (${r.method}): ${formatPct(r.pct)}, annual fee drag at €100/month ${formatEur(r.annualDrag)}`
  ).join('\n');
  return `# Virtuse

> Non-custodial hub for Bitcoin-only services. Virtuse never holds your keys.

As of ${asOfEn}. Indicative 2026 overview – not tax advice. Partner KYC on each platform.

## Bitcoin tax (${N} EU countries)

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

## Slovak

- ${ORIGIN}/sk/bitcoin-dane/
- ${ORIGIN}/sk/bitcoin-dca-kalkulacka/
- ${ORIGIN}/sk/bitcoin-predat-alebo-pozicat/
- ${ORIGIN}/sk/bitcoin-dedicstvo/
- ${ORIGIN}/sk/bitcoin-index-poplatkov/

## Czech

- ${ORIGIN}/cs/bitcoin-dane/
- ${ORIGIN}/cs/bitcoin-dca-kalkulacka/
- ${ORIGIN}/cs/bitcoin-prodat-nebo-pujcit/
- ${ORIGIN}/cs/bitcoin-dedictvi/
- ${ORIGIN}/cs/bitcoin-index-poplatku/

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
- SK: ${ORIGIN}/sk/bitcoin-dane/${slugSk(c.id)}/
- CS: ${ORIGIN}/cs/bitcoin-dane/${slugCs(c.id)}/
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
    skIndexable: generated.filter((p) => p.lang === 'sk' && !p.noindex).length,
    csIndexable: generated.filter((p) => p.lang === 'cs' && !p.noindex).length,
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
