// Bitcoin + EU glossary: /bitcoin-glossary/ (EN) and /sk/bitcoin-slovnik/ (SK), one page per language,
// one anchor per term (SEO Bod E, handover 2026-11-26).
//
//   node seo-build/glossary.mjs        write both pages + the GLOSSARY sitemap block
//   (seo-build/generate.mjs runs it at the end, so CI builds and verifies it)
//
// data/glossary.json                    structure: term ids, categories, internal links, sources, checked dates
// data/glossary-strings/<lang>.json     texts (en.json is the source; same keys in every language)
// A language without a strings file is not built and gets no hreflang. Chrome (nav, footer, Brief card)
// comes from data/chrome-v2.json like the other seo-build pages. Search, filter and A–Z run in /glossary.js
// (no inline JS); without JS every term is visible.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, jsonLd, SITE_DIR_NAME, DEFAULT_ORIGIN } from './lib/util.mjs';
import { SITE_V2, SITE_CSS_V, CF_SNIPPET, CRUMBS_LABEL } from './lib/html.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..', SITE_DIR_NAME);
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, 'data/glossary.json'), 'utf8'));
const CHROME = JSON.parse(fs.readFileSync(path.join(HERE, 'data/chrome-v2.json'), 'utf8'));
const STR_DIR = path.join(HERE, 'data/glossary-strings');
const ORIGIN = DEFAULT_ORIGIN;
// Bump when /glossary.css or /glossary.js changes (they are cached for a year with ?v=).
export const GLOSSARY_ASSET_V = '1';

const ALL_LANGS = ['en', 'sk', 'cs', 'de', 'pl', 'hu', 'fr', 'es', 'uk', 'ru'];
const OG_LOCALE = { en: 'en_US', sk: 'sk_SK' };
const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  // Nominative month, no ordinal dot form ("26. november 2026"), as the SK house rules ask.
  sk: ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december']
};
const EN = JSON.parse(fs.readFileSync(path.join(STR_DIR, 'en.json'), 'utf8'));
const LANGS = ALL_LANGS.filter((l) => fs.existsSync(path.join(STR_DIR, `${l}.json`)));
for (const l of LANGS) if (!DATA.paths[l]) throw new Error(`glossary: strings for ${l} but no path in glossary.json`);

// ---------- strings: same shape as en.json (alt lists may differ in length) ----------
function sameShape(a, b, where) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) throw new Error(`${where}: not an array`);
    if (!where.endsWith('.alt') && a.length !== b.length) throw new Error(`${where}: array length differs`);
    if (!where.endsWith('.alt')) a.forEach((x, i) => sameShape(x, b[i], `${where}[${i}]`));
  } else if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object') throw new Error(`${where}: not an object`);
    for (const k of Object.keys(a)) { if (k !== '_note') { if (!(k in b)) throw new Error(`${where}.${k} missing`); sameShape(a[k], b[k], `${where}.${k}`); } }
    for (const k of Object.keys(b)) if (k !== '_note' && !(k in a)) throw new Error(`${where}.${k} not in en.json`);
  } else if (typeof b !== 'string') throw new Error(`${where}: not a string`);
}
const holders = (s) => (JSON.stringify({ ...s, _note: "" }).match(/\{[a-zA-Z]+\}/g) || []).sort().join(' ');
const S = {};
for (const l of LANGS) {
  const s = l === 'en' ? EN : JSON.parse(fs.readFileSync(path.join(STR_DIR, `${l}.json`), 'utf8'));
  sameShape(EN, s, l);
  if (holders(s) !== holders(EN)) throw new Error(`glossary ${l}: {placeholders} differ from en.json`);
  S[l] = s;
}

// ---------- data checks ----------
const TERMS = DATA.terms;
const IDS = new Set();
const SOURCED = new Set(['eu', 'tax', 'macro']);
for (const t of TERMS) {
  if (!/^[a-z0-9-]+$/.test(t.id)) throw new Error(`glossary: bad id ${t.id}`);
  if (IDS.has(t.id)) throw new Error(`glossary: duplicate id ${t.id}`);
  IDS.add(t.id);
  if (!DATA.categories.includes(t.cat)) throw new Error(`glossary ${t.id}: unknown category ${t.cat}`);
  if (SOURCED.has(t.cat) && !(t.sources && t.sources.length && t.checked)) throw new Error(`glossary ${t.id}: ${t.cat} term needs sources + checked`);
  for (const s of t.sources || []) if (!/^https:\/\//.test(s.url) || !s.title) throw new Error(`glossary ${t.id}: source needs https url + title`);
  if (t.checked && !/^\d{4}-\d{2}-\d{2}$/.test(t.checked)) throw new Error(`glossary ${t.id}: checked must be YYYY-MM-DD`);
  const counts = LANGS.map((l) => (t.links[l] || []).length);
  if (new Set(counts).size !== 1 || !counts[0]) throw new Error(`glossary ${t.id}: link count differs between languages`);
  for (const l of LANGS) {
    const tx = S[l].terms[t.id];
    if (!tx) throw new Error(`glossary ${l}: no text for ${t.id}`);
    if (tx.linkLabels.length !== t.links[l].length) throw new Error(`glossary ${l} ${t.id}: linkLabels do not match links`);
    if (t.cat === 'tax' && /%/.test(tx.def)) throw new Error(`glossary ${l} ${t.id}: no tax rates in the glossary`);
    for (const h of t.links[l]) {
      if (h.startsWith('#')) { if (!TERMS.some((x) => x.id === h.slice(1))) throw new Error(`glossary ${t.id}: anchor ${h} is not a term`); continue; }
      const file = path.join(SITE, h.split(/[?#]/)[0].replace(/\/$/, '/index.html'));
      if (!fs.existsSync(file)) throw new Error(`glossary ${l} ${t.id}: link target missing ${h}`);
    }
  }
}
for (const t of TERMS) for (const x of t.see || []) if (!IDS.has(x)) throw new Error(`glossary ${t.id}: see ${x} is not a term`);
for (const l of LANGS) for (const id of Object.keys(S[l].terms)) if (!IDS.has(id)) throw new Error(`glossary ${l}: text for unknown term ${id}`);
if (TERMS.length < 45 || TERMS.length > 60) throw new Error(`glossary: ${TERMS.length} terms (want 45-60)`);
const N = TERMS.length;
for (const l of LANGS) {
  const t = S[l].page.title.replace(/\{n\}/g, String(N)), d = S[l].page.description;
  if (t.length > 60) throw new Error(`glossary ${l}: title ${t.length} > 60`);
  if (d.length > 155) throw new Error(`glossary ${l}: description ${d.length} > 155`);
}
const REVIEWED = TERMS.map((t) => t.checked).filter(Boolean).sort().pop();

// ---------- helpers ----------
const pathOf = (l) => '/' + DATA.paths[l].replace(/index\.html$/, '');
const absOf = (l) => ORIGIN + pathOf(l);
const fill = (s) => s.replace(/\{n\}/g, String(N));
const fmtDate = (iso, l) => { const [y, m, d] = iso.split('-').map(Number); return l === 'en' ? `${d} ${MONTHS.en[m - 1]} ${y}` : `${d}. ${MONTHS[l][m - 1]} ${y}`; };
// Letter for the A–Z bar: first character without diacritics; digits group under "#".
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const letterOf = (name) => { const c = fold(name).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
const ARROW = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function sorted(l) {
  const coll = new Intl.Collator(l, { sensitivity: 'base', numeric: true });
  return [...TERMS].sort((a, b) => coll.compare(S[l].terms[a.id].name, S[l].terms[b.id].name));
}

// ---------- chrome ----------
function chrome(l) {
  const v2 = CHROME[l];
  const here = pathOf(l);
  const alt = (x) => (LANGS.includes(x) ? pathOf(x) : (x === 'en' ? '/' : `/${x}/`));
  const sub = (s) => s.replace(/\{\{ALT:([a-z]{2})\}\}/g, (_, x) => alt(x));
  let nav = v2.nav;
  // The Learn menu carries the glossary (i18n-tools/nav_glossary.py): mark it as the current page.
  if (nav.includes(`<a href="${here}">`)) {
    nav = nav.replace(`<a href="${here}">`, `<a href="${here}" aria-current="page">`)
      .replace('<div class="nav-group" id="ng-learn">', '<div class="nav-group current" id="ng-learn">');
  }
  const brief = v2.brief.replace('data-source="seo_page"', 'data-source="glossary"').replace(/utm_medium=seo_page/g, 'utm_medium=glossary');
  return { nav: sub(nav), foot: sub(v2.foot), brief };
}

// ---------- body ----------
function termHtml(t, l) {
  const s = S[l], tx = s.terms[t.id], p = s.page;
  const links = t.links[l].map((h, i) => `<a href="${esc(h)}">${esc(tx.linkLabels[i])}</a>`).join(', ');
  const see = (t.see || []).map((x) => `<a href="#${x}">${esc(s.terms[x].name)}</a>`).join(', ');
  const src = (t.sources || []).map((x) => `<a href="${esc(x.url)}" rel="noopener" target="_blank">${esc(x.title)}</a>`).join('; ');
  // Extra search words: the names of the "see also" terms (so "mica" also finds CASP).
  const keys = (t.see || []).map((x) => s.terms[x].name).join(' | ');
  return `<div class="gl-term" id="${t.id}" data-cat="${t.cat}" data-k="${esc(keys)}">
          <dt><dfn>${esc(tx.name)}</dfn><a class="gl-anchor" href="#${t.id}" aria-label="${esc(p.copy)}: ${esc(tx.name)}" title="${esc(p.copy)}">#</a><span class="gl-cat">${esc(s.cats[t.cat])}</span></dt>
          <dd>
            <p class="gl-def">${esc(tx.def)}</p>
${tx.alt.length ? `            <p class="gl-meta"><span>${esc(p.also)}</span> ${esc(tx.alt.join(', '))}</p>\n` : ''}            <p class="gl-meta"><span>${esc(p.relatedOn)}</span> ${links}</p>
${see ? `            <p class="gl-meta"><span>${esc(p.seeAlso)}</span> ${see}</p>\n` : ''}${src ? `            <p class="gl-meta gl-src"><span>${esc(p.source)}</span> ${src}</p>\n` : ''}          </dd>
        </div>`;
}

function listHtml(l) {
  const groups = new Map();
  for (const t of sorted(l)) {
    const k = letterOf(S[l].terms[t.id].name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  return [...groups].map(([k, ts]) => `<section class="gl-group" id="letter-${k === '#' ? 'num' : k.toLowerCase()}" data-letter="${k}">
      <h2 class="gl-letter">${k}</h2>
      <dl class="gl-list">
        ${ts.map((t) => termHtml(t, l)).join('\n        ')}
      </dl>
    </section>`).join('\n    ');
}

function toolsHtml(l) {
  const s = S[l];
  const letters = new Set(TERMS.map((t) => letterOf(s.terms[t.id].name)));
  const az = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => letters.has(c)
    ? `<a href="#letter-${c.toLowerCase()}">${c}</a>`
    : `<span aria-disabled="true">${c}</span>`).join('');
  const num = letters.has('#') ? '<a href="#letter-num">#</a>' : '';
  const chips = [`<button type="button" class="gl-chip" data-cat="" aria-pressed="true">${esc(s.page.all)}</button>`,
    ...DATA.categories.map((c) => `<button type="button" class="gl-chip" data-cat="${c}" aria-pressed="false">${esc(s.cats[c])}</button>`)].join('');
  return `<div class="gl-tools" id="glTools">
      <label class="gl-search" hidden><span class="sr-only">${esc(s.page.searchLabel)}</span><input type="search" id="glQ" name="q" placeholder="${esc(s.page.searchPlaceholder)}" autocomplete="off" spellcheck="false"></label>
      <div class="gl-chips" role="group" aria-label="${esc(s.page.catsLabel)}" hidden>${chips}</div>
      <nav class="gl-az" aria-label="${esc(s.page.azLabel)}">${num}${az}</nav>
      <p class="gl-count" id="glCount" hidden aria-live="polite" data-one="${esc(s.page.countOne)}" data-many="${esc(s.page.countMany)}" data-copied="${esc(s.page.copied)}">${esc(s.page.countMany.replace('{n}', N))}</p>
      <p class="gl-empty" id="glEmpty" hidden>${esc(s.page.empty)}</p>
    </div>`;
}

const RELATED_HREF = {
  en: ['/news.html?utm_source=glossary&utm_medium=related', '/verdict.html', '/tax-agent.html', '/bitcoin-data.html'],
  sk: ['/sk/news.html?utm_source=glossary&utm_medium=related', '/sk/verdict.html', '/sk/tax-agent.html', '/sk/bitcoin-data.html']
};
function relatedHtml(l) {
  const s = S[l];
  const hrefs = RELATED_HREF[l] || RELATED_HREF.en;
  return `<section id="related" class="hub-related" aria-labelledby="relatedLabel">
    <div class="sec-head one"><div class="sec-copy"><h2 id="relatedLabel">${esc(s.page.relatedH)} <span>${esc(s.page.relatedSub)}</span></h2></div></div>
    <div class="gcards">${s.related.map((r, i) => `<a class="gcard" href="${esc(hrefs[i])}"><b>${esc(r.t)}</b><span>${esc(r.d)}</span></a>`).join('')}</div>
  </section>`;
}

// ---------- JSON-LD ----------
function schemas(l) {
  const s = S[l], url = absOf(l);
  const home = ORIGIN + (l === 'en' ? '/' : `/${l}/`);
  return [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: s.page.home, item: home },
      { '@type': 'ListItem', position: 2, name: s.page.crumb, item: url }] },
    { '@type': ['WebPage', 'CollectionPage'], '@id': `${url}#webpage`, url, name: fill(s.page.title), description: s.page.description,
      inLanguage: l, dateModified: REVIEWED, publisher: { '@id': `${ORIGIN}/#org` }, mainEntity: { '@id': `${url}#set` } },
    { '@type': 'DefinedTermSet', '@id': `${url}#set`, name: s.page.setName, inLanguage: l, url,
      hasDefinedTerm: sorted(l).map((t) => {
        const tx = s.terms[t.id];
        const o = { '@type': 'DefinedTerm', '@id': `${url}#${t.id}`, name: tx.name };
        if (tx.alt.length) o.alternateName = tx.alt.length === 1 ? tx.alt[0] : tx.alt;
        Object.assign(o, { description: tx.def, url: `${url}#${t.id}`, inDefinedTermSet: { '@id': `${url}#set` } });
        return o;
      }) }
  ];
}

// ---------- page ----------
function render(l) {
  const s = S[l], p = s.page;
  const { nav, foot, brief } = chrome(l);
  const canonical = absOf(l);
  const home = l === 'en' ? '/' : `/${l}/`;
  const sep = ' <span aria-hidden="true">/</span> ';
  const crumbs = `<a href="${home}">${esc(p.home)}</a>${sep}<span>${esc(p.learn)}</span>${sep}<span>${esc(p.crumb)}</span>`;
  const title = fill(p.title);
  const hreflang = [...LANGS.map((x) => `<link rel="alternate" hreflang="${x}" href="${absOf(x)}">`), `<link rel="alternate" hreflang="x-default" href="${absOf('en')}">`].join('\n');
  return `<!DOCTYPE html>
<html lang="${l}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
${CHROME._head}
<title>${esc(title)}</title>
<meta name="description" content="${esc(p.description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
${hreflang}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Virtuse">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${OG_LOCALE[l]}">
<meta property="og:image" content="${ORIGIN}/og-cover.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ORIGIN}/og-cover.jpg">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/site-v2.min.css?v=${SITE_CSS_V}">
<link rel="stylesheet" href="/glossary.css?v=${GLOSSARY_ASSET_V}">
<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': schemas(l) })}</script>
${CHROME[l].i18n ? CHROME[l].i18n + '\n' : ''}</head>
<body class="page-buy page-eco page-gl no-split">
<!-- generated by seo-build/glossary.mjs; edit seo-build/data/glossary*.json, not this file -->
${nav}

<main class="wrap" id="top">
  <div class="buy-hero2 eco-hero gl-hero">
    <nav class="eco-crumbs" aria-label="${CRUMBS_LABEL[l] || 'Breadcrumb'}">${crumbs}</nav>
    <div class="eyebrow blue"><i></i>${esc(p.eyebrow)}</div>
    <h1>${esc(p.h1)}. <span class="h1-grey">${esc(fill(p.h1Accent))}</span></h1>
    <p class="sp-lead">${esc(p.intro)}</p>
    <p class="sp-lead gl-position">${esc(p.position)}</p>
  </div>

  <section class="gl-wrap" aria-label="${esc(p.crumb)}">
    ${toolsHtml(l)}
    ${listHtml(l)}
    <p class="gl-reviewed">${esc(p.reviewed.replace('{date}', fmtDate(REVIEWED, l)))} ${esc(p.notAdvice)}</p>
  </section>

  ${relatedHtml(l)}

  ${brief}

  ${foot}
</main>

<script src="/site-v2.js?v=${SITE_V2}" defer></script>
<script src="/glossary.js?v=${GLOSSARY_ASSET_V}" defer></script>
${CF_SNIPPET}
</body>
</html>
`;
}

// ---------- write ----------
const START = '<!-- GLOSSARY:START -->', END = '<!-- GLOSSARY:END -->';
const smPath = path.join(SITE, 'sitemap.xml');
let xml = fs.readFileSync(smPath, 'utf8');
const old = xml.match(new RegExp(`${START}[\\s\\S]*?${END}`));
const prevLastmod = Object.fromEntries([...(old ? old[0] : '').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));
const today = new Date().toISOString().slice(0, 10);
const lastmod = {};
for (const l of LANGS) {
  const file = path.join(SITE, DATA.paths[l]);
  const html = render(l);
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf8');
  // Unchanged page keeps its lastmod (seo-ops/sitemap_lastmod.py sets it from git); a changed one gets today.
  lastmod[l] = before === html && prevLastmod[absOf(l)] ? prevLastmod[absOf(l)] : today;
}
const alts = [...LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${absOf(x)}"/>`), `    <xhtml:link rel="alternate" hreflang="x-default" href="${absOf('en')}"/>`].join('\n');
const urls = LANGS.map((l) => `  <url>
    <loc>${absOf(l)}</loc>
    <lastmod>${lastmod[l]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
${alts}
  </url>`).join('\n');
const block = `${START}\n${urls}\n${END}`;
if (old) xml = xml.replace(old[0], block);
else if (xml.includes('<!-- ECOSYSTEM:START -->')) xml = xml.replace('<!-- ECOSYSTEM:START -->', `${block}\n<!-- ECOSYSTEM:START -->`);
else throw new Error('sitemap anchor not found');
fs.writeFileSync(smPath, xml, 'utf8');

console.log(`glossary: ${N} terms, languages ${LANGS.join(', ')}, reviewed ${REVIEWED}`);
