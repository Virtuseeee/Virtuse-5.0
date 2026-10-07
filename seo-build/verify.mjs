#!/usr/bin/env node
/**
 * Acceptance checks for generated SEO pages.
 * Run after `node generate.mjs`. Exit 1 on failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_DIR_NAME, wordCount, DEFAULT_ORIGIN, resolveSiteOrigin } from './lib/util.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(path.dirname(ROOT), SITE_DIR_NAME);
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/meta.json'), 'utf8'));
const ORIGIN = resolveSiteOrigin(meta.site.origin);

const errors = [];
const warnings = [];
function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

const DISCLAIMERS_EN = [
  'Indicative 2026 overview',
  'Virtuse never holds your keys',
  'KYC'
];
const DISCLAIMERS_DE = [
  'Unverbindlicher Überblick 2026',
  'Virtuse verwahrt niemals Ihre Schlüssel',
  'KYC'
];

const DISCLAIMERS_SK = [
  'Orientačný prehľad 2026',
  'Virtuse nikdy nedrží vaše kľúče',
  'KYC'
];

const DISCLAIMERS_CS = [
  'Orientační přehled 2026',
  'Virtuse nikdy nedrží vaše klíče',
  'KYC'
];

const DISCLAIMERS_PL = [
  'Przegląd orientacyjny 2026',
  'Virtuse nigdy nie przechowuje Państwa kluczy',
  'KYC'
];

const DISCLAIMERS_HU = [
  'Tájékoztató áttekintés 2026',
  'A Virtuse soha nem kezeli az Ön kulcsait',
  'KYC'
];

const DISCLAIMERS_UK = [
  'Довідковий огляд 2026',
  'Virtuse ніколи не зберігає ваші ключі',
  'KYC'
];

const DISCLAIMERS_RU = [
  'Справочный обзор 2026',
  'Virtuse никогда не хранит ваши ключи',
  'KYC'
];

const DISCLAIMERS_FR = [
  'Aperçu indicatif 2026',
  'Virtuse ne détient jamais vos clés',
  'KYC'
];

const DISCLAIMERS_ES = [
  'Resumen orientativo 2026',
  'Virtuse nunca guarda sus claves',
  'KYC'
];

function stripTags(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

function attr(html, re) {
  const m = html.match(re);
  return m ? m[1] : '';
}

const htmlFiles = manifest.files.filter((f) => f.endsWith('.html'));
let en = 0;
let de = 0;
let sk = 0;
let cs = 0;
let pl = 0;
let hu = 0;
let ukc = 0;
let ruc = 0;
let frc = 0;
let esc2 = 0;

for (const rel of htmlFiles) {
  const fp = path.join(SITE, rel);
  if (!fs.existsSync(fp)) {
    fail(`missing ${rel}`);
    continue;
  }
  const html = fs.readFileSync(fp, 'utf8');
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > 100 * 1024) fail(`${rel} is ${bytes} bytes (>100KB)`);

  const lang = attr(html, /<html lang="([^"]+)"/);
  if (lang === 'en') en += 1;
  if (lang === 'de') de += 1;
  if (lang === 'sk') sk += 1;
  if (lang === 'cs') cs += 1;
  if (lang === 'pl') pl += 1;
  if (lang === 'hu') hu += 1;
  if (lang === 'uk') ukc += 1;
  if (lang === 'ru') ruc += 1;
  if (lang === 'fr') frc += 1;
  if (lang === 'es') esc2 += 1;

  const title = attr(html, /<title>([^<]+)<\/title>/);
  if (title.length > 60) fail(`${rel} title ${title.length} > 60: ${title}`);
  if (title.length < 12) fail(`${rel} title too short`);

  const desc = attr(html, /name="description" content="([^"]+)"/);
  if (desc.length > 155) fail(`${rel} description ${desc.length} > 155`);
  if (desc.length < 50) fail(`${rel} description too short (${desc.length})`);

  const h1s = html.match(/<h1>[^<]+<\/h1>/g) || [];
  if (h1s.length !== 1) fail(`${rel} has ${h1s.length} H1s`);

  const answer = attr(html, /<div class="answer"><p>([\s\S]*?)<\/p><\/div>/);
  const aw = wordCount(answer);
  if (aw < 40 || aw > 60) fail(`${rel} answer words ${aw} (need 40–60)`);

  const h2 = (html.match(/<h2>/g) || []).length;
  if (h2 < 2) fail(`${rel} has ${h2} H2s (need ≥2)`);

  const faqHeading = lang === 'sk' ? '<h2>Časté otázky</h2>' : lang === 'cs' ? '<h2>Časté dotazy</h2>' : lang === 'pl' ? '<h2>Najczęstsze pytania</h2>' : lang === 'hu' ? '<h2>Gyakori kérdések</h2>' : lang === 'uk' ? '<h2>Часті запитання</h2>' : lang === 'ru' ? '<h2>Частые вопросы</h2>' : lang === 'fr' ? '<h2>Questions fréquentes</h2>' : lang === 'es' ? '<h2>Preguntas frecuentes</h2>' : '<h2>FAQ</h2>';
  const faqH3 = (html.split(faqHeading)[1] || '');
  const faqCount = (html.split(faqHeading)[1] || '').match(/<h3>/g)?.length || 0;
  if (faqCount < 3 || faqCount > 5) fail(`${rel} FAQ count ${faqCount} (need 3–5)`);

  if (!html.includes('BreadcrumbList')) fail(`${rel} missing BreadcrumbList`);
  if (!html.includes('FAQPage')) fail(`${rel} missing FAQPage`);
  if (!html.includes('"@type": "Organization"') && !html.includes('"@type":"Organization"')) {
    if (!html.includes('"@type": "Organization"')) {
      // pretty-printed json ld uses "@type": "Organization"
      if (!html.includes('"Organization"')) fail(`${rel} missing Organization schema`);
    }
  }

  const robots = attr(html, /name="robots" content="([^"]+)"/);
  const noindex = robots.includes('noindex');

  const dis = lang === 'de' ? DISCLAIMERS_DE : lang === 'sk' ? DISCLAIMERS_SK : lang === 'cs' ? DISCLAIMERS_CS : lang === 'pl' ? DISCLAIMERS_PL : lang === 'hu' ? DISCLAIMERS_HU : lang === 'uk' ? DISCLAIMERS_UK : lang === 'ru' ? DISCLAIMERS_RU : lang === 'fr' ? DISCLAIMERS_FR : lang === 'es' ? DISCLAIMERS_ES : DISCLAIMERS_EN;
  for (const d of dis) {
    if (!html.includes(d)) fail(`${rel} missing disclaimer snippet: ${d}`);
  }

  const related = (html.match(/<div class="related">([\s\S]*?)<\/div>/) || [,''])[1];
  const relLinks = related.match(/<a /g)?.length || 0;
  if (relLinks < 2) fail(`${rel} related SEO links ${relLinks} < 2`);

  if (!html.includes('class="cta"')) fail(`${rel} missing module CTA`);

  if (/lorem ipsum/i.test(html)) fail(`${rel} contains lorem`);

  const hreflang = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => m[1]);
  if (!hreflang.includes('en') || !hreflang.includes('x-default')) {
    fail(`${rel} hreflang missing en or x-default (${hreflang.join(',')})`);
  }
  if (lang === 'de' && !hreflang.includes('de')) fail(`${rel} DE page missing hreflang de`);
  if (lang === 'sk' && !hreflang.includes('sk')) fail(`${rel} SK page missing hreflang sk`);
  if (lang === 'cs' && !hreflang.includes('cs')) fail(`${rel} CS page missing hreflang cs`);
  if (lang === 'pl' && !hreflang.includes('pl')) fail(`${rel} PL page missing hreflang pl`);
  if (lang === 'hu' && !hreflang.includes('hu')) fail(`${rel} HU page missing hreflang hu`);
  if (lang === 'uk' && !hreflang.includes('uk')) fail(`${rel} UK page missing hreflang uk`);
  if (lang === 'ru' && !hreflang.includes('ru')) fail(`${rel} RU page missing hreflang ru`);
  if (lang === 'fr' && !hreflang.includes('fr')) fail(`${rel} FR page missing hreflang fr`);
  if (lang === 'es' && !hreflang.includes('es')) fail(`${rel} ES page missing hreflang es`);

  // Answer must be real HTML in the body, not only injected by JS.
  if (!html.includes('<div class="answer"><p>')) fail(`${rel} missing static answer block`);

  void faqH3;
  void noindex;
}

const indexableEn = manifest.counts.enIndexable;
const indexableDe = manifest.counts.deIndexable;
if (indexableEn < 30) fail(`EN indexable ${indexableEn} < 30`);
if (indexableDe < 13) fail(`DE indexable ${indexableDe} < 13`);

if (!process.env.SITE_ORIGIN && ORIGIN !== DEFAULT_ORIGIN) {
  fail(`default origin must be ${DEFAULT_ORIGIN} (got ${ORIGIN}; set SITE_ORIGIN to override)`);
}

const sitemap = fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
if (!sitemap.includes('SEO-BUILD:START')) fail('sitemap.xml missing SEO-BUILD markers');
const sampleUrls = [
  `${ORIGIN}/bitcoin-tax/czechia/`,
  `${ORIGIN}/de/bitcoin-steuern/deutschland/`,
  `${ORIGIN}/bitcoin-fee-index/`,
  `${ORIGIN}/bitcoin-dca-calculator/`,
  `${ORIGIN}/sell-vs-borrow-bitcoin/`,
  `${ORIGIN}/index.html`
];
for (const u of sampleUrls) {
  if (!sitemap.includes(`<loc>${u}</loc>`)) fail(`sitemap missing ${u}`);
}

const robots = fs.readFileSync(path.join(SITE, 'robots.txt'), 'utf8');
if (!robots.includes('Disallow: /seo-build/')) fail('robots.txt missing internal disallows');
if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) {
  fail(`robots.txt Sitemap must be ${ORIGIN}/sitemap.xml`);
}

for (const f of ['llms.txt', 'llms-full.txt']) {
  const t = fs.readFileSync(path.join(SITE, f), 'utf8');
  if (t.length < 400) fail(`${f} too short`);
  if (!t.includes('never holds')) fail(`${f} missing keys disclaimer`);
  if (!t.includes(`${ORIGIN}/bitcoin-tax/`)) fail(`${f} missing origin ${ORIGIN}`);
}

const seoOutputs = [
  'sitemap.xml',
  'robots.txt',
  'llms.txt',
  'llms-full.txt',
  'bitcoin-tax/czechia/index.html',
  'bitcoin-fee-index/index.html',
  'bitcoin-dca-calculator/index.html'
];
if (ORIGIN !== 'https://staging.virtuse.com') {
  for (const rel of seoOutputs) {
    const t = fs.readFileSync(path.join(SITE, rel), 'utf8');
    if (t.includes('staging.virtuse.com')) fail(`${rel} still contains staging.virtuse.com`);
  }
}

const canonicalSample = fs.readFileSync(path.join(SITE, 'bitcoin-dca-calculator/index.html'), 'utf8');
if (!canonicalSample.includes(`rel="canonical" href="${ORIGIN}/bitcoin-dca-calculator/"`)) {
  fail('DCA canonical does not use the resolved origin');
}
if (!canonicalSample.includes(`property="og:url" content="${ORIGIN}/bitcoin-dca-calculator/"`)) {
  fail('DCA og:url does not use the resolved origin');
}

// Fee index live
const feeIndex = fs.readFileSync(path.join(SITE, 'bitcoin-fee-index/index.html'), 'utf8');
if (!feeIndex.includes('Dataset')) fail('Fee Index missing Dataset schema');
if (!feeIndex.includes('Article')) fail('Fee Index missing Article schema');
const feeAsOfLabel = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fee-schedule-live.json'), 'utf8')).asOf.replace(/^(\d{4})-Q(\d)$/, 'Q$2 $1');
if (!feeIndex.includes(feeAsOfLabel)) fail(`Fee Index missing as-of date (${feeAsOfLabel})`);
const feeArchive = fs.readFileSync(path.join(SITE, 'bitcoin-fee-index/2026-q3/index.html'), 'utf8');
if (!feeArchive.includes('0.16%')) fail('Q3 archive must keep the frozen Q3 fees (Kraken 0.16%)');
if (/RevenueBot/.test(feeIndex.replace(/Why is RevenueBot not ranked\?|RevenueBot charges no fee per purchase/g, ''))) fail('RevenueBot must not appear in the live Fee Index ranking');
if (!feeIndex.includes('iframe')) fail('Fee Index missing embed snippet');

const inh = fs.readFileSync(path.join(SITE, 'bitcoin-inheritance/index.html'), 'utf8');
if (!inh.includes('HowTo')) fail('Inheritance missing HowTo schema');

const dca = fs.readFileSync(path.join(SITE, 'bitcoin-dca-calculator/index.html'), 'utf8');
if (!dca.includes('WebApplication')) fail('DCA missing WebApplication schema');
if (!dca.includes('"price": "0"')) fail('DCA offers price not 0');

const czCta = fs.readFileSync(path.join(SITE, 'bitcoin-tax/czechia/index.html'), 'utf8');
if (!czCta.includes('tax-agent.html')) fail('tax country CTA should point at tax-agent.html, not the tax.html category page');

// hreflang reciprocity EN tax <-> DE tax
const cz = fs.readFileSync(path.join(SITE, 'bitcoin-tax/czechia/index.html'), 'utf8');
const tschechien = fs.readFileSync(path.join(SITE, 'de/bitcoin-steuern/tschechien/index.html'), 'utf8');
if (!cz.includes('de/bitcoin-steuern/tschechien')) fail('EN czechia missing DE hreflang');
if (!tschechien.includes('bitcoin-tax/czechia')) fail('DE tschechien missing EN hreflang');
const cesko = fs.readFileSync(path.join(SITE, 'sk/bitcoin-dane/cesko/index.html'), 'utf8');
if (!cz.includes('sk/bitcoin-dane/cesko')) fail('EN czechia missing SK hreflang');
if (!tschechien.includes('sk/bitcoin-dane/cesko')) fail('DE tschechien missing SK hreflang');
if (!cesko.includes('bitcoin-tax/czechia') || !cesko.includes('de/bitcoin-steuern/tschechien')) fail('SK cesko missing EN/DE hreflang');
const ceskoCs = fs.readFileSync(path.join(SITE, 'cs/bitcoin-dane/cesko/index.html'), 'utf8');
for (const [name, html] of [['EN czechia', cz], ['DE tschechien', tschechien], ['SK cesko', cesko]]) {
  if (!html.includes('cs/bitcoin-dane/cesko')) fail(`${name} missing CS hreflang`);
}
if (!ceskoCs.includes('bitcoin-tax/czechia') || !ceskoCs.includes('sk/bitcoin-dane/cesko')) fail('CS cesko missing EN/SK hreflang');
const czechyPl = fs.readFileSync(path.join(SITE, 'pl/bitcoin-podatki/czechy/index.html'), 'utf8');
for (const [name, html] of [['EN czechia', cz], ['DE tschechien', tschechien], ['SK cesko', cesko], ['CS cesko', ceskoCs]]) {
  if (!html.includes('pl/bitcoin-podatki/czechy')) fail(`${name} missing PL hreflang`);
}
if (!czechyPl.includes('bitcoin-tax/czechia') || !czechyPl.includes('cs/bitcoin-dane/cesko')) fail('PL czechy missing EN/CS hreflang');
const csehHu = fs.readFileSync(path.join(SITE, 'hu/bitcoin-adozas/csehorszag/index.html'), 'utf8');
for (const [name, html] of [['EN czechia', cz], ['DE tschechien', tschechien], ['SK cesko', cesko], ['CS cesko', ceskoCs], ['PL czechy', czechyPl]]) {
  if (!html.includes('hu/bitcoin-adozas/csehorszag')) fail(`${name} missing HU hreflang`);
}
if (!csehHu.includes('bitcoin-tax/czechia') || !csehHu.includes('pl/bitcoin-podatki/czechy')) fail('HU csehorszag missing EN/PL hreflang');
const chekhiiaUk = fs.readFileSync(path.join(SITE, 'uk/bitcoin-podatky/chekhiia/index.html'), 'utf8');
for (const [name, html] of [['EN czechia', cz], ['DE tschechien', tschechien], ['SK cesko', cesko], ['CS cesko', ceskoCs], ['PL czechy', czechyPl], ['HU csehorszag', csehHu]]) {
  if (!html.includes('uk/bitcoin-podatky/chekhiia')) fail(`${name} missing UK hreflang`);
}
if (!chekhiiaUk.includes('bitcoin-tax/czechia') || !chekhiiaUk.includes('hu/bitcoin-adozas/csehorszag')) fail('UK chekhiia missing EN/HU hreflang');
const chekhiyaRu = fs.readFileSync(path.join(SITE, 'ru/bitcoin-nalogi/chekhiya/index.html'), 'utf8');
for (const [name, html] of [['EN czechia', cz], ['DE tschechien', tschechien], ['SK cesko', cesko], ['CS cesko', ceskoCs], ['PL czechy', czechyPl], ['HU csehorszag', csehHu], ['UK chekhiia', chekhiiaUk]]) {
  if (!html.includes('ru/bitcoin-nalogi/chekhiya')) fail(`${name} missing RU hreflang`);
}
if (!chekhiyaRu.includes('bitcoin-tax/czechia') || !chekhiyaRu.includes('uk/bitcoin-podatky/chekhiia')) fail('RU chekhiya missing EN/UK hreflang');
const tchequieFr = fs.readFileSync(path.join(SITE, 'fr/bitcoin-fiscalite/tchequie/index.html'), 'utf8');
for (const [name, html] of [['EN czechia', cz], ['DE tschechien', tschechien], ['SK cesko', cesko], ['CS cesko', ceskoCs], ['PL czechy', czechyPl], ['HU csehorszag', csehHu], ['UK chekhiia', chekhiiaUk], ['RU chekhiya', chekhiyaRu]]) {
  if (!html.includes('fr/bitcoin-fiscalite/tchequie')) fail(`${name} missing FR hreflang`);
}
if (!tchequieFr.includes('bitcoin-tax/czechia') || !tchequieFr.includes('ru/bitcoin-nalogi/chekhiya')) fail('FR tchequie missing EN/RU hreflang');
// French typography: no plain space before : ; ? ! % in the visible text of French pages
if (/ [:;?!%]/.test(stripTags(tchequieFr).replace(/&[a-z]+;/g, ''))) fail('FR tchequie has a plain space before : ; ? ! or %');
const checaEs = fs.readFileSync(path.join(SITE, 'es/bitcoin-impuestos/republica-checa/index.html'), 'utf8');
for (const [name, html] of [['EN czechia', cz], ['DE tschechien', tschechien], ['SK cesko', cesko], ['CS cesko', ceskoCs], ['PL czechy', czechyPl], ['HU csehorszag', csehHu], ['UK chekhiia', chekhiiaUk], ['RU chekhiya', chekhiyaRu], ['FR tchequie', tchequieFr]]) {
  if (!html.includes('es/bitcoin-impuestos/republica-checa')) fail(`${name} missing ES hreflang`);
}
if (!checaEs.includes('bitcoin-tax/czechia') || !checaEs.includes('fr/bitcoin-fiscalite/tchequie')) fail('ES republica-checa missing EN/FR hreflang');
if (/\d [%€]/.test(stripTags(checaEs))) fail('ES republica-checa has a plain space before % or €');

// Determinism: second generate should not change bytes of one page
const before = fs.readFileSync(path.join(SITE, 'bitcoin-fee-index/index.html'));
const { spawnSync } = await import('node:child_process');
const rerun = spawnSync(process.execPath, ['generate.mjs'], { cwd: ROOT, encoding: 'utf8' });
if (rerun.status !== 0) fail(`re-generate failed: ${rerun.stderr || rerun.stdout}`);
const after = fs.readFileSync(path.join(SITE, 'bitcoin-fee-index/index.html'));
if (!before.equals(after)) fail('generate is not deterministic (fee-index HTML changed)');

console.log(JSON.stringify({
  origin: ORIGIN,
  htmlFiles: htmlFiles.length,
  enHtml: en,
  deHtml: de,
  skHtml: sk,
  csHtml: cs,
  plHtml: pl,
  huHtml: hu,
  ukHtml: ukc,
  ruHtml: ruc,
  frHtml: frc,
  esHtml: esc2,
  counts: JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).counts,
  warnings,
  errors: errors.length
}, null, 2));

if (warnings.length) console.log(warnings.map((w) => 'WARN ' + w).join('\n'));
if (errors.length) {
  console.error(errors.map((e) => 'FAIL ' + e).join('\n'));
  process.exit(1);
}
console.log('verify: all checks passed');
