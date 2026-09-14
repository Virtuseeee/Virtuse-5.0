#!/usr/bin/env node
/**
 * Acceptance checks for generated SEO pages.
 * Run after `node generate.mjs`. Exit 1 on failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_DIR_NAME, wordCount } from './lib/util.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(path.dirname(ROOT), SITE_DIR_NAME);
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

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

  const faqH3 = (html.match(/<h2>FAQ<\/h2>([\s\S]*?)(<h2>|<\/main>)/) || [,''])[1];
  const faqCount = (html.split('<h2>FAQ</h2>')[1] || '').match(/<h3>/g)?.length || 0;
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

  const dis = lang === 'de' ? DISCLAIMERS_DE : DISCLAIMERS_EN;
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

  // Answer must be real HTML in the body, not only injected by JS.
  if (!html.includes('<div class="answer"><p>')) fail(`${rel} missing static answer block`);

  void faqH3;
  void noindex;
}

const indexableEn = manifest.counts.enIndexable;
const indexableDe = manifest.counts.deIndexable;
if (indexableEn < 30) fail(`EN indexable ${indexableEn} < 30`);
if (indexableDe < 13) fail(`DE indexable ${indexableDe} < 13`);

const sitemap = fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
if (!sitemap.includes('SEO-BUILD:START')) fail('sitemap.xml missing SEO-BUILD markers');
const sampleUrls = [
  `${JSON.parse(fs.readFileSync(path.join(ROOT, 'data/meta.json'), 'utf8')).site.origin}/bitcoin-tax/czechia/`,
  `${JSON.parse(fs.readFileSync(path.join(ROOT, 'data/meta.json'), 'utf8')).site.origin}/de/bitcoin-steuern/deutschland/`,
  `${JSON.parse(fs.readFileSync(path.join(ROOT, 'data/meta.json'), 'utf8')).site.origin}/bitcoin-fee-index/`,
  `${JSON.parse(fs.readFileSync(path.join(ROOT, 'data/meta.json'), 'utf8')).site.origin}/bitcoin-dca-calculator/`,
  `${JSON.parse(fs.readFileSync(path.join(ROOT, 'data/meta.json'), 'utf8')).site.origin}/sell-vs-borrow-bitcoin/`
];
for (const u of sampleUrls) {
  if (!sitemap.includes(`<loc>${u}</loc>`)) fail(`sitemap missing ${u}`);
}

const robots = fs.readFileSync(path.join(SITE, 'robots.txt'), 'utf8');
if (!robots.includes('Disallow: /seo-build/')) fail('robots.txt missing internal disallows');
if (!robots.includes('Sitemap:')) fail('robots.txt missing Sitemap');

for (const f of ['llms.txt', 'llms-full.txt']) {
  const t = fs.readFileSync(path.join(SITE, f), 'utf8');
  if (t.length < 400) fail(`${f} too short`);
  if (!t.includes('never holds')) fail(`${f} missing keys disclaimer`);
}

// Fee index live
const feeIndex = fs.readFileSync(path.join(SITE, 'bitcoin-fee-index/index.html'), 'utf8');
if (!feeIndex.includes('Dataset')) fail('Fee Index missing Dataset schema');
if (!feeIndex.includes('Article')) fail('Fee Index missing Article schema');
if (!feeIndex.includes('as of Q3 2026') && !feeIndex.includes('Q3 2026')) fail('Fee Index missing as-of date');
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

// Determinism: second generate should not change bytes of one page
const before = fs.readFileSync(path.join(SITE, 'bitcoin-fee-index/index.html'));
const { spawnSync } = await import('node:child_process');
const rerun = spawnSync(process.execPath, ['generate.mjs'], { cwd: ROOT, encoding: 'utf8' });
if (rerun.status !== 0) fail(`re-generate failed: ${rerun.stderr || rerun.stdout}`);
const after = fs.readFileSync(path.join(SITE, 'bitcoin-fee-index/index.html'));
if (!before.equals(after)) fail('generate is not deterministic (fee-index HTML changed)');

console.log(JSON.stringify({
  htmlFiles: htmlFiles.length,
  enHtml: en,
  deHtml: de,
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
