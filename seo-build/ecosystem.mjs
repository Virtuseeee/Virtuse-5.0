// Bitcoin Ecosystem directory: /ecosystem/ + 12 subpages in every site language
// (handovers bitcoin-ecosystem.md + ecosystem-fixes.md, 22 Oct 2026).
//
//   node seo-build/ecosystem.mjs            # write the pages + the ECOSYSTEM sitemap block
//   ECO_DATE=2026-11-07 node seo-build/...  # pretend "today" (past conferences drop out)
//
// data/ecosystem.json             structure, internal links and entries (entries stay English)
// data/ecosystem-strings/<l>.json page text per language (en.json is the source; same keys)
// Chrome (nav, footer, Brief texts) comes from data/chrome-v2.json like the other seo-build
// pages; the Ecosystem menu group and footer column are added here until the homepages
// carry them (then seo_chrome.py exports them and the injection is skipped).
// A language without a strings file is not built (and gets no hreflang).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, jsonLd, nbspFr, SITE_DIR_NAME, DEFAULT_ORIGIN } from './lib/util.mjs';
import { SITE_V2, CF_SNIPPET } from './lib/html.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..', SITE_DIR_NAME);
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, 'data/ecosystem.json'), 'utf8'));
const CHROME = JSON.parse(fs.readFileSync(path.join(HERE, 'data/chrome-v2.json'), 'utf8'));
const STR_DIR = path.join(HERE, 'data/ecosystem-strings');
const ORIGIN = DEFAULT_ORIGIN;
const TODAY = process.env.ECO_DATE || new Date().toISOString().slice(0, 10);
const WORKER = 'https://virtuse-newsletter.virtuse-ai.workers.dev';

const ALL_LANGS = ['en', 'sk', 'cs', 'de', 'pl', 'hu', 'fr', 'es', 'uk', 'ru'];
const LOCALE = { en: 'en-GB', sk: 'sk-SK', cs: 'cs-CZ', de: 'de-DE', pl: 'pl-PL', hu: 'hu-HU', fr: 'fr-FR', es: 'es-ES', uk: 'uk-UA', ru: 'ru-RU' };
const OG_LOCALE = { en: 'en_US', sk: 'sk_SK', cs: 'cs_CZ', de: 'de_DE', pl: 'pl_PL', hu: 'hu_HU', fr: 'fr_FR', es: 'es_ES', uk: 'uk_UA', ru: 'ru_RU' };

const EN = JSON.parse(fs.readFileSync(path.join(STR_DIR, 'en.json'), 'utf8'));
const LANGS = ALL_LANGS.filter((l) => fs.existsSync(path.join(STR_DIR, `${l}.json`)));

// ---------- strings ----------
function sameShape(a, b, where) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) throw new Error(`${where}: array length differs`);
    a.forEach((x, i) => sameShape(x, b[i], `${where}[${i}]`));
  } else if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object') throw new Error(`${where}: not an object`);
    for (const k of Object.keys(a)) { if (k !== '_note') { if (!(k in b)) throw new Error(`${where}.${k} missing`); sameShape(a[k], b[k], `${where}.${k}`); } }
  } else if (typeof b !== 'string') throw new Error(`${where}: not a string`);
}
const hrefsOf = (s) => (JSON.stringify(s).match(/href=\\"[^\\]*\\"/g) || []).sort().join(' ');
const holdersOf = (s) => (JSON.stringify(s).match(/\{[a-zA-Z]+\}/g) || []).sort().join(' ');
function mapStrings(o, fn) {
  if (Array.isArray(o)) return o.map((x) => mapStrings(x, fn));
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, mapStrings(v, fn)]));
  return typeof o === 'string' ? fn(o) : o;
}
const S = {};
for (const l of LANGS) {
  const s = l === 'en' ? EN : JSON.parse(fs.readFileSync(path.join(STR_DIR, `${l}.json`), 'utf8'));
  sameShape(EN, s, l);
  if (hrefsOf(s) !== hrefsOf(EN)) throw new Error(`${l}: href values differ from en.json`);
  if (holdersOf(s) !== holdersOf(EN)) throw new Error(`${l}: {placeholders} differ from en.json`);
  S[l] = l === 'fr' ? mapStrings(s, nbspFr) : s;
}

// ---------- pages ----------
const PAGES = DATA.pages;
const INDEX = PAGES.find((p) => p.slug === '');
const SUBPAGES = PAGES.filter((p) => p.slug !== '');
const LISTING = SUBPAGES.filter((p) => p.slug !== 'promote');
const PROMOTE = PAGES.find((p) => p.slug === 'promote');
const key = (p) => p.slug || 'index';
const txt = (l, p) => S[l].pages[key(p)];

const pfx = (l) => (l === 'en' ? '' : `/${l}`);
const pathOf = (p, l) => `${pfx(l)}/ecosystem/${p.slug ? p.slug + '/' : ''}`;
const absOf = (p, l) => ORIGIN + pathOf(p, l);
const host = (u) => new URL(u).hostname.replace(/^www\./, '');
const fmtDate = (iso, l) => new Date(iso + 'T12:00:00Z').toLocaleDateString(LOCALE[l], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---------- localised internal links ----------
// EN -> language links from the v2 chrome (same 51 links in the same order in every language).
const LINKMAP = {};
const chromeHrefs = (l) => (CHROME[l].nav + CHROME[l].foot).match(/href="([^"{]+)"/g).map((h) => h.slice(6, -1).replace(/&amp;/g, '&'));
for (const l of ALL_LANGS) {
  const en = chromeHrefs('en'), xx = chromeHrefs(l);
  if (en.length !== xx.length) throw new Error(`chrome link count differs for ${l}`);
  LINKMAP[l] = {};
  en.forEach((h, i) => { LINKMAP[l][h] = xx[i]; LINKMAP[l][h.split('?')[0]] = xx[i].split('?')[0]; });
}
function loc(href, l) {
  if (l === 'en' || !href.startsWith('/')) return href;
  if (href.startsWith('/ecosystem/')) return pfx(l) + href;
  const [p, q] = href.split('?');
  const qs = q ? '?' + q : '';
  if (LINKMAP[l][href]) return LINKMAP[l][href];
  if (LINKMAP[l][p]) return LINKMAP[l][p] + qs;
  const cand = `/${l}${p}`;
  const file = path.join(SITE, cand.endsWith('/') ? cand + 'index.html' : cand);
  return fs.existsSync(file) ? cand + qs : href;
}
const locHtml = (html, l) => html.replace(/href="(\/[^"]*)"/g, (_, h) => `href="${esc(loc(h.replace(/&amp;/g, '&'), l))}"`);
const fill = (s, l) => s.replace(/\{privacy\}/g, loc('/privacy-policy.html', l)).replace(/\{howWeEarn\}/g, loc('/how-we-earn.html', l));

// ---------- checks ----------
for (const l of LANGS) {
  const h1s = new Set();
  for (const p of PAGES) {
    const t = txt(l, p);
    if (t.title.length > 60) throw new Error(`${l} title > 60 (${t.title.length}): ${t.title}`);
    if (t.description.length > 155) throw new Error(`${l} description > 155 (${t.description.length}): ${key(p)}`);
    h1s.add(t.h1);
  }
  if (h1s.size !== PAGES.length) throw new Error(`${l}: duplicate H1`);
}

const upcoming = (entries) => entries.filter((e) => !e.end || e.end >= TODAY);
const liveEntries = (p) => (p.slug === 'conferences' ? upcoming(p.entries) : p.entries || []);
const indexable = (p) => !p.entries || p.index || liveEntries(p).length >= DATA.minEntries;

// ---------- icons (index cards) ----------
const ICON = {
  btc: '<circle cx="12" cy="12" r="9"/><path d="M10 7.5h3.2a2 2 0 0 1 0 4H10m0 0h3.7a2.1 2.1 0 0 1 0 4.2H10m0-8.2v8.2M11 6v1.5m0 8.2V17m2-11v1.5m0 8.2V17"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  bag: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  store: '<path d="M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6"/>',
  code: '<path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>',
  megaphone: '<path d="M3 10v4h4l7 4V6L7 10zM18 9a4 4 0 0 1 0 6"/>'
};
const icon = (name) => `<svg class="eco-ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

// ---------- chrome ----------
function chrome(current, l) {
  const v2 = CHROME[l];
  const ui = S[l].ui;
  let nav = v2.nav;
  if (!nav.includes('id="ng-eco"')) {
    const links = [INDEX, ...SUBPAGES].map((p) => {
      const cur = p === current ? ' aria-current="page"' : '';
      const t = p === INDEX ? ui.overview : txt(l, p).nav;
      return `<a href="${pathOf(p, l)}"${cur}><span class="nd-t">${esc(t)}</span><span class="nd-d">${esc(txt(l, p).navDesc)}</span></a>`;
    }).join('');
    const group = `<div class="nav-group current" id="ng-eco">
        <button type="button" class="nav-group-btn" aria-expanded="false" aria-controls="nd-eco">${esc(ui.navLabel)}</button>
        <div class="nav-drop" id="nd-eco">${links}</div>
      </div>
      `;
    if (!/<a class="nav-top"/.test(nav)) throw new Error(`${l}: nav anchor (About) not found`);
    nav = nav.replace(/<a class="nav-top"/, group + '<a class="nav-top"');
  }
  // The shared menu already carries the group (i18n-tools/nav_ecosystem.py): mark it as the current one.
  nav = nav.replace('<div class="nav-group" id="ng-eco">', '<div class="nav-group current" id="ng-eco">')
    .replace(`<a href="${pathOf(current, l)}"><span class="nd-t">`, `<a href="${pathOf(current, l)}" aria-current="page"><span class="nd-t">`);
  let foot = v2.foot;
  if (!foot.includes(`href="${pathOf(INDEX, l)}"`)) {
    const col = `<div class="footer-col" data-eco-col><h4>${esc(ui.navLabel)}</h4>${[INDEX, ...SUBPAGES].map((p) =>
      `<a href="${pathOf(p, l)}">${esc(p === INDEX ? txt(l, p).h1 : txt(l, p).nav)}</a>`).join('')}</div>`;
    const i = foot.lastIndexOf('<div class="footer-col"><h4>');
    if (i < 0) throw new Error(`${l}: footer anchor not found`);
    foot = foot.slice(0, i) + col + foot.slice(i);
  }
  const alt = (x) => (LANGS.includes(x) ? pathOf(current, x) : (x === 'en' ? '/' : `/${x}/`));
  const sub = (s) => s.replace(/\{\{ALT:([a-z]{2})\}\}/g, (_, x) => alt(x));
  const brief = v2.brief.replace('data-source="seo_page"', 'data-source="ecosystem"').replace('utm_medium=seo_page', 'utm_medium=ecosystem');
  return { nav: sub(nav), foot: sub(foot), brief };
}

// ---------- blocks (Services system: pcard2 accents, hpanel, tp-principles, hp-get/hp-cta) ----------
const ARROW = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const end = (s) => (/[.!?…]$/.test(s.trim()) ? s.trim() : s.trim() + '.');
const cap = (s) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

// Services heading: white sentence + grey continuation (".sec-head h2 span").
const head2 = (white, grey, id) =>
  `<div class="sec-head one"><div class="sec-copy"><h2${id ? ` id="${id}"` : ''}>${esc(end(white))} <span>${esc(grey)}</span></h2></div></div>`;

function entryCard(e, p, l) {
  const rel = e.sponsored ? 'sponsored noopener' : 'noopener';
  const en = l === 'en' ? '' : ' lang="en"';
  const spons = e.sponsored ? `<span class="eco-spons">${esc(S[l].ui.sponsored)}</span>` : '';
  return `<article class="pcard2 ${p.accent} eco-card">
        <span class="eco-k"${en}>${esc((e.tags || []).join(' · '))}</span>${spons}
        <h3>${esc(e.name)}</h3>
        <p${en}>${esc(e.verdict)}</p>
        <div class="eco-foot"><span class="eco-host">${esc(host(e.url))}</span><a class="hp-get" href="${esc(e.url)}" target="_blank" rel="${rel}">${esc(S[l].ui.websiteButton)} ${ARROW}</a></div>
      </article>`;
}
const entryGrid = (entries, p, l) => `<div class="eco-grid">\n      ${entries.map((e) => entryCard(e, p, l)).join('\n      ')}\n    </div>`;

function confDates(e, l) {
  if (!e.start) return /Sep/.test(e.dates) ? S[l].ui.confTbcSep2027 : S[l].ui.confTba2027;
  const f = new Intl.DateTimeFormat(LOCALE[l], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return f.formatRange(new Date(e.start + 'T12:00:00Z'), new Date(e.end + 'T12:00:00Z'));
}
const countryName = (cc, l) => new Intl.DisplayNames([LOCALE[l]], { type: 'region' }).of(cc);
const city = (c, l) => S[l].ui.cities[c] || c;

// Conferences: the Treasury comparison table (rounded panel, mono column headers, outlined buttons).
function conferencePanel(entries, p, l) {
  const ui = S[l].ui;
  const en = l === 'en' ? '' : ' lang="en"';
  const rows = entries.map((e) => `<div class="eco-trow">
        <span><b>${esc(e.name)}</b><small${en}>${esc(e.verdict)}</small></span>
        <span class="eco-c">${esc(city(e.city, l))}, ${esc(countryName(e.country, l))}</span>
        <span class="eco-c">${e.start ? `<time datetime="${e.start}">${esc(confDates(e, l))}</time>` : esc(confDates(e, l))}</span>
        <a class="hp-get" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(ui.websiteButton)} ${ARROW}</a>
      </div>`).join('\n      ');
  return `<div class="hpanel ${p.accent} eco-panel">
      <div class="eco-trow head"><span>${esc(ui.tableEvent)}</span><span>${esc(ui.tableCity)}</span><span>${esc(ui.tableDates)}</span><span></span></div>
      ${rows}
    </div>`;
}

function pickSection(l) {
  const ui = S[l].ui;
  return `<section id="pick">
    ${head2(ui.howWePick, ui.pickSub)}
    <ul class="tp-principles eco-principles">${ui.steps.map((s) => `<li>${CHECK}<span><b>${esc(s.t)}</b>${esc(s.d)}</span></li>`).join('')}</ul>
    <p class="eco-more"><a class="tlink" href="${pathOf(PROMOTE, l)}#criteria">${esc(ui.criteriaLink)} ${ARROW}</a></p>
  </section>`;
}

function relatedSection(p, l) {
  if (!p.related || !p.related.length) return '';
  const labels = p === INDEX ? S[l].ui.indexRelated : txt(l, p).related;
  return `<section id="related">
    ${head2(S[l].ui.related, S[l].ui.relatedSub)}
    <div class="gcards">${p.related.map((h, i) => `<a class="gcard" href="${esc(loc(h, l))}"><b>${esc(labels[i])}</b><span class="tlink">${ARROW}</span></a>`).join('')}</div>
  </section>`;
}

function footNotes(p, l) {
  const ui = S[l].ui, d = DATA.reviewed;
  const priv = p.slug === 'privacy' ? ' ' + fill(ui.privacyFootNote, l) : '';
  const enNote = l !== 'en' && p.entries ? ` ${esc(ui.entriesNote)}` : '';
  return `<p class="pf-disc eco-notes">${esc(ui.notAdvice)}${enNote}${priv} ${esc(ui.reviewed)} <time datetime="${d}">${esc(fmtDate(d, l))}</time>.</p>`;
}

// ---------- page bodies ----------
function indexBody(l) {
  const ui = S[l].ui;
  const cards = SUBPAGES.map((p) => {
    const meta = p.slug === 'promote' ? ui.applyForListing : ui.picks.replace('{n}', liveEntries(p).length);
    return `<a class="pcard2 ${p.accent} eco-card eco-cat" href="${pathOf(p, l)}">${icon(p.icon)}<h3>${esc(txt(l, p).nav)}</h3><p>${esc(txt(l, p).navDesc)}</p><span class="eco-k">${esc(meta)}</span></a>`;
  }).join('\n      ');
  return `<section id="explore">
    ${head2(ui.allPages, ui.exploreSub)}
    <div class="eco-grid eco-cats">
      ${cards}
    </div>
    <p class="eco-more"><a class="tlink" href="${pathOf(PROMOTE, l)}">${esc(ui.promoteCta)} ${ARROW}</a></p>
  </section>
  ${pickSection(l)}
  ${relatedSection(INDEX, l)}`;
}

function listingBody(p, l) {
  const t = txt(l, p), ui = S[l].ui, entries = liveEntries(p);
  const parts = [];
  const notes = [t.legalNote, t.partnerNote].filter(Boolean).map((n) => `<p class="eco-note">${locHtml(n, l)}</p>`).join('\n    ');
  const list = p.slug === 'conferences' ? conferencePanel(entries, p, l) : entryGrid(entries, p, l);
  if (p.slug === 'what-is-bitcoin') parts.push(whatIsArticle(p, l));
  parts.push(`<section id="list">
    ${head2(t.listHeading || ui.listH, ui.listSub)}
    ${notes ? notes + '\n    ' : ''}${list}
  </section>`);
  parts.push(pickSection(l));
  parts.push(relatedSection(p, l));
  return parts.join('\n  ');
}


// What is Bitcoin?: facts row, two-column article with a sticky "On this page" list,
// callout panels and the "How it works" steps. The primer has the same 26 items in every
// language: H2s at 0, 4, 7, 10, 12, 17, 21, 23 (checked below).
const PRIMER_H2 = [0, 4, 7, 10, 12, 17, 21, 23];
const twoTone = (text) => { const s = text.trim(), i = s.indexOf(' '); return i < 0 ? esc(s) : `${esc(s.slice(0, i))} <span>${esc(s.slice(i + 1))}</span>`; };
function whatIsArticle(p, l) {
  const t = txt(l, p), ui = S[l].ui;
  const pr = t.primer.map((h) => locHtml(h, l));
  const h2s = pr.map((h, i) => (h.startsWith('<h2>') ? i : -1)).filter((i) => i >= 0);
  if (pr.length !== 26 || h2s.join() !== PRIMER_H2.join()) throw new Error(`${l}: primer structure changed`);
  const title = (i) => pr[i].replace(/<\/?h2>/g, '');
  const toc = [];
  const secs = PRIMER_H2.map((start, gi) => {
    const stop = PRIMER_H2[gi + 1] || pr.length;
    const id = `s${gi + 1}`;
    toc.push([id, title(start)]);
    let body = pr.slice(start + 1, stop);
    if (start === 7) body = body.map((h, k) => (k === 1 ? `<div class="eco-notepanel">${h}</div>` : h));
    if (start === 10) body = [`<div class="hpanel orange eco-callout">${body.join('')}</div>`];
    if (start === 12) {
      const steps = t.howSteps.map((s, k) => `<div class="how-log-item"><div class="how-log-marker"><span class="how-log-dot"></span></div><div class="how-log-body"><span class="how-log-num">${esc(ui.step)} ${String(k + 1).padStart(2, '0')}</span><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p></div></div>`).join('');
      body = [`<div class="how-log eco-how">${steps}</div>`, ...body];
    }
    return `<section class="eco-sec" id="${id}">
        <h2>${twoTone(title(start))}</h2>
        ${body.join('\n        ')}
      </section>`;
  });
  toc.push(['faq', ui.faq], ['list', t.listHeading]);
  const facts = t.facts.map((f) => `<div class="pcard2 orange eco-card eco-fact"><span class="eco-k">${esc(f.l)}</span><b>${esc(f.v)}</b></div>`).join('');
  return `<div class="eco-facts">${facts}</div>
  <div class="eco-article">
    <div class="eco-body eco-prose">
      ${secs.join('\n      ')}
      <section id="faq" class="qa eco-sec">
        <h2>${twoTone(ui.faq)}</h2>
        ${t.faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n        ')}
      </section>
    </div>
    <nav class="eco-toc" aria-label="${esc(ui.onThisPage)}">
      <details open><summary>${esc(ui.onThisPage)}</summary>
        <ol>${toc.map(([id, x]) => `<li><a href="#${id}">${esc(x)}</a></li>`).join('')}</ol>
      </details>
    </nav>
  </div>`;
}

const TOC_JS = `<script>
(function () {
  var toc = document.querySelector('.eco-toc'); if (!toc) return;
  var det = toc.querySelector('details'), mq = window.matchMedia('(min-width: 1024px)');
  function fit() { det.open = mq.matches; } fit(); if (mq.addEventListener) mq.addEventListener('change', fit);
  toc.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { if (!mq.matches) det.open = false; }); });
  var links = [].slice.call(toc.querySelectorAll('a')), secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  function mark() {
    var cur = 0;
    secs.forEach(function (el, i) { if (el && el.getBoundingClientRect().top <= 140) cur = i; });
    links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
  }
  window.addEventListener('scroll', mark, { passive: true });
  mark();
})();
</script>`;

const COUNTRIES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'CH'];

function promoteBody(l) {
  const m = S[l].promote;
  const opts = LISTING.map((p) => `<option value="${p.slug}">${esc(txt(l, p).nav)}</option>`).join('');
  const coll = new Intl.Collator(LOCALE[l]);
  const countries = COUNTRIES.map((c) => [c, countryName(c, l)]).sort((a, b) => coll.compare(a[1], b[1])).map(([c, n]) =>
    `<label class="eco-check"><input type="checkbox" name="countries" value="${c}" checked> ${esc(n)}</label>`).join('');
  return `<section id="criteria">
    ${head2(m.criteriaH, m.criteriaSub)}
    <div class="eco-copy">
      <ol>
        ${m.criteria.map((c) => `<li>${c}</li>`).join('\n        ')}
      </ol>
      <div class="why-grid">
        <div class="pcard2 orange eco-card"><span class="eco-k" id="paid">${esc(m.paidH)}</span><p>${fill(m.paid, l)}</p></div>
        <div class="pcard2 blue eco-card"><span class="eco-k" id="removal">${esc(m.removalH)}</span><p>${esc(m.removal)}</p></div>
      </div>
    </div>
  </section>

  <section id="apply">
    ${head2(m.applyH, m.applySub, 'apply-h')}
    <div class="hpanel eco-form-panel">
    <p class="eco-muted">${esc(m.required)}</p>
    <form id="ecoForm" class="eco-form" data-endpoint="${WORKER}/ecosystem-apply" novalidate>
      <div class="eco-2">
        <label>${esc(m.fProject)}<input name="project_name" required maxlength="120" autocomplete="organization"></label>
        <label>${esc(m.fWebsite)}<input name="website" type="url" required maxlength="300" placeholder="https://"></label>
      </div>
      <label>${esc(m.fCategory)}<select name="category" required><option value="">${esc(m.fCategoryChoose)}</option>${opts}</select></label>
      <label>${esc(m.fDesc)}<textarea name="description" required maxlength="300" rows="3"></textarea><span class="eco-count">0 / 300</span></label>
      <fieldset class="eco-countries">
        <legend>${esc(m.fCountries)}</legend>
        <label class="eco-check eco-all"><input type="checkbox" data-all-countries checked> ${esc(m.fAllCountries)}</label>
        <details class="eco-pick-countries">
          <summary>${esc(m.fChooseCountries)}</summary>
          <div class="eco-cgrid">${countries}</div>
        </details>
      </fieldset>
      <label class="eco-check"><input type="checkbox" name="bitcoin_only" required> <span>${esc(m.fBitcoinOnly)}</span></label>
      <div class="eco-2">
        <label>${esc(m.fLicence)}<input name="licence" maxlength="200"></label>
        <label>${esc(m.fRepo)}<input name="repo" type="url" maxlength="300" placeholder="https://"></label>
      </div>
      <div class="eco-2">
        <label>${esc(m.fContactName)}<input name="contact_name" required maxlength="120" autocomplete="name"></label>
        <label>${esc(m.fContactEmail)}<input name="contact_email" type="email" required maxlength="200" autocomplete="email"></label>
      </div>
      <fieldset class="eco-radio">
        <legend>${esc(m.fSponsored)}</legend>
        <label class="eco-check"><input type="radio" name="sponsored_interest" value="yes"> ${esc(m.fYes)}</label>
        <label class="eco-check"><input type="radio" name="sponsored_interest" value="no" checked> ${esc(m.fNo)}</label>
      </fieldset>
      <label>${esc(m.fMessage)}<textarea name="message" maxlength="1500" rows="4"></textarea></label>
      <label class="eco-check"><input type="checkbox" name="consent" required> <span>${fill(m.fConsent, l)}</span></label>
      <input class="hp" type="text" name="company_url" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="cf-turnstile eco-turnstile" data-sitekey="${esc(DATA.turnstileSiteKey)}" data-theme="dark" data-language="${l}" data-size="flexible"></div>
      <button class="hp-cta eco-submit" type="submit">${esc(m.fSubmit)} ${ARROW}</button>
      <p class="eco-form-msg" id="ecoFormMsg" role="status" aria-live="polite"></p>
    </form>
    <p class="eco-mail">${m.mail}</p>
    </div>
  </section>`;
}

function formJs(l) {
  const m = S[l].promote;
  const msgs = { required: m.mRequired, country: m.mCountry, sending: m.mSending, ok: m.mOk, fail: m.mFail, captcha: m.mCaptcha, rate: m.mRate };
  return `<script>
(function () {
  var M = ${JSON.stringify(msgs).replace(/</g, '\\u003c')};
  var f = document.getElementById('ecoForm'); if (!f) return;
  var msg = document.getElementById('ecoFormMsg');
  var all = f.querySelector('[data-all-countries]');
  var boxes = Array.prototype.slice.call(f.querySelectorAll('input[name="countries"]'));
  all.addEventListener('change', function () { boxes.forEach(function (b) { b.checked = all.checked; }); });
  boxes.forEach(function (b) { b.addEventListener('change', function () { all.checked = boxes.every(function (x) { return x.checked; }); }); });
  var ta = f.querySelector('textarea[name="description"]'), cnt = f.querySelector('.eco-count');
  ta.addEventListener('input', function () { cnt.textContent = ta.value.length + ' / 300'; });
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    if (f.company_url.value) return;
    var countries = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
    if (!f.checkValidity()) { msg.className = 'eco-form-msg err'; msg.textContent = M.required; var bad = f.querySelector(':invalid'); if (bad) bad.focus(); return; }
    if (!countries.length) { msg.className = 'eco-form-msg err'; msg.textContent = M.country; f.querySelector('.eco-pick-countries').open = true; return; }
    var data = { lang: document.documentElement.lang || 'en', countries: countries.length === boxes.length ? ['ALL'] : countries };
    ['project_name','website','category','description','licence','repo','contact_name','contact_email','message'].forEach(function (k) { data[k] = f[k].value.trim(); });
    data.bitcoin_only = f.bitcoin_only.checked; data.consent = f.consent.checked;
    data.sponsored_interest = (f.querySelector('input[name="sponsored_interest"]:checked') || {}).value || 'no';
    var t = f.querySelector('[name="cf-turnstile-response"]'); data.turnstile = t ? t.value : '';
    if (!data.turnstile) { msg.className = 'eco-form-msg err'; msg.textContent = M.captcha; return; }
    var btn = f.querySelector('.eco-submit'); btn.disabled = true; msg.className = 'eco-form-msg'; msg.textContent = M.sending;
    function reset() { if (window.turnstile) try { window.turnstile.reset(f.querySelector('.cf-turnstile')); } catch (x) {} }
    fetch(f.getAttribute('data-endpoint'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(r.status); e.code = j.error; throw e; } return j; }); })
      .then(function () {
        f.reset(); all.checked = true; boxes.forEach(function (b) { b.checked = true; }); cnt.textContent = '0 / 300';
        f.hidden = true; msg.className = 'eco-form-msg ok'; msg.textContent = M.ok; f.parentNode.insertBefore(msg, f);
        (window.dataLayer = window.dataLayer || []).push({ event: 'ecosystem_apply', category: data.category });
      })
      .catch(function (e) {
        msg.className = 'eco-form-msg err';
        if (e.code === 'captcha') msg.textContent = M.captcha;
        else if (e.code === 'rate_limited') msg.textContent = M.rate;
        else if (e.code === 'invalid') msg.textContent = M.required;
        else msg.innerHTML = M.fail;
        reset();
      })
      .then(function () { btn.disabled = false; });
  });
})();
</script>`;
}

// ---------- JSON-LD ----------
function schemas(p, l) {
  const ui = S[l].ui, t = txt(l, p);
  const crumbs = [{ name: ui.home, item: ORIGIN + (l === 'en' ? '/' : `/${l}/`) }, { name: txt(l, INDEX).h1, item: absOf(INDEX, l) }];
  if (p !== INDEX) crumbs.push({ name: p.slug === 'promote' ? ui.promoteCrumb : t.nav, item: absOf(p, l) });
  const graph = [
    {
      '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'Virtuse', legalName: 'Virtuse Wealth Management, a.s.',
      logo: `${ORIGIN}/email-virtuse-v-mark.png`, url: `${ORIGIN}/`,
      address: { '@type': 'PostalAddress', streetAddress: 'Borinka 65', postalCode: '900 32', addressLocality: 'Borinka', addressCountry: 'SK' }
    },
    { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) }
  ];
  if (p.slug === 'promote') {
    graph.push({ '@type': 'WebPage', '@id': absOf(p, l), url: absOf(p, l), name: t.title, description: t.description, inLanguage: l, isPartOf: { '@id': absOf(INDEX, l) } });
    return graph;
  }
  const items = p === INDEX
    ? SUBPAGES.map((s) => ({ name: txt(l, s).nav, url: absOf(s, l) }))
    : liveEntries(p).map((e) => ({ name: e.name, url: e.url }));
  graph.push({
    '@type': 'CollectionPage', '@id': absOf(p, l), url: absOf(p, l), name: t.h1, description: t.description, inLanguage: l,
    dateModified: DATA.reviewed, publisher: { '@id': `${ORIGIN}/#org` },
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: x.url })) }
  });
  if (p.slug === 'what-is-bitcoin') {
    graph.push({ '@type': 'Article', headline: t.h1, description: t.description, inLanguage: l, dateModified: DATA.reviewed, author: { '@id': `${ORIGIN}/#org` }, publisher: { '@id': `${ORIGIN}/#org` }, mainEntityOfPage: absOf(p, l) });
    graph.push({ '@type': 'FAQPage', inLanguage: l, mainEntity: t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }
  if (p.slug === 'conferences') {
    for (const e of liveEntries(p).filter((x) => x.start)) {
      graph.push({
        '@type': 'Event', name: e.name, startDate: e.start, endDate: e.end, url: e.url,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled',
        location: { '@type': 'Place', name: e.venue || e.city, address: { '@type': 'PostalAddress', addressLocality: e.city, addressCountry: e.country } },
        description: e.verdict
      });
    }
  }
  return graph;
}

// ---------- page ----------
// No page CSS: everything comes from /site-v2.min.css (the "ECOSYSTEM" block at the end of
// site-v2.css builds on the Services eyebrow/pcard2/hpanel accent system).
const CSS_V = '11';

// Two-line Services H1: white line (the page H1) + grey line (the accent, as its own sentence).
function heroH1(t) {
  const line2 = cap(t.h1Accent.replace(/^[\s,:;.]+/, '').trim());
  return `${esc(end(t.h1))} <span class="h1-grey">${esc(line2)}</span>`;
}

function eyebrow(p, l) {
  const ui = S[l].ui;
  const text = p === INDEX ? [ui.eyebrowIndex, ui.steps[0].t, ui.steps[1].t].join(' · ') : [ui.crumbEcosystem, p.slug === 'promote' ? ui.promoteCrumb : txt(l, p).nav].join(' · ');
  return `<div class="eyebrow ${p.accent === 'orange' ? '' : p.accent}"><i></i>${esc(text)}</div>`.replace('class="eyebrow "', 'class="eyebrow"');
}

function stats(p, l) {
  const ui = S[l].ui;
  if (p === INDEX) {
    const n = LISTING.reduce((s, x) => s + liveEntries(x).length, 0);
    return ui.stats.replace('{c}', SUBPAGES.length).replace('{n}', n);
  }
  if (p.entries) return ui.subStats.replace('{n}', liveEntries(p).length).replace('{date}', fmtDate(DATA.reviewed, l));
  return '';
}

function render(p, l) {
  const { nav, foot, brief } = chrome(p, l);
  const t = txt(l, p), ui = S[l].ui;
  const canonical = absOf(p, l);
  const robots = indexable(p) ? 'index, follow' : 'noindex, follow';
  const home = l === 'en' ? '/' : `/${l}/`;
  const sep = ' <span aria-hidden="true">/</span> ';
  const crumbs = p === INDEX
    ? `<a href="${home}">${esc(ui.home)}</a>${sep}<span>${esc(ui.crumbEcosystem)}</span>`
    : `<a href="${home}">${esc(ui.home)}</a>${sep}<a href="${pathOf(INDEX, l)}">${esc(ui.crumbEcosystem)}</a>${sep}<span>${esc(p.slug === 'promote' ? ui.promoteCrumb : t.nav)}</span>`;
  const body = p === INDEX ? indexBody(l) : p.slug === 'promote' ? promoteBody(l) : listingBody(p, l);
  const st = stats(p, l);
  const cta = p === INDEX ? `    <a class="hp-cta" href="${pathOf(PROMOTE, l)}">${esc(ui.applyForListing)} ${ARROW}</a>\n`
    : p.slug === 'promote' ? `    <a class="hp-cta" href="#apply">${esc(S[l].promote.applyH)} ${ARROW}</a>\n` : '';
  const hreflang = [...LANGS.map((x) => `  <link rel="alternate" hreflang="${x}" href="${absOf(p, x)}">`), `  <link rel="alternate" hreflang="x-default" href="${absOf(p, 'en')}">`].join('\n');
  return `<!DOCTYPE html>
<html lang="${l}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
${CHROME._head}
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">
${hreflang}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Virtuse">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
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
<meta name="vb-cfo-stage" content="wait">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/site-v2.min.css?v=${CSS_V}">
<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': schemas(p, l) })}</script>
${CHROME[l].i18n ? CHROME[l].i18n + '\n' : ''}</head>
<body class="page-buy page-eco no-split">
<!-- generated by seo-build/ecosystem.mjs; edit seo-build/data/ecosystem*.json, not this file -->
${nav}

<main class="wrap eco-acc-${p.accent}" id="top">
  <div class="buy-hero2 eco-hero">
    <nav class="eco-crumbs" aria-label="Breadcrumb">${crumbs}</nav>
    ${eyebrow(p, l)}
    <h1>${heroH1(t)}</h1>
    <p class="sp-lead">${esc(t.intro)}</p>
${st ? `    <p class="pf-counts">${esc(st)}</p>\n` : ''}${cta}  </div>
  ${body}
  ${footNotes(p, l)}
${p.slug !== 'promote' ? '\n  ' + brief + '\n' : ''}
  ${foot}
</main>

<script src="/site-v2.js?v=${SITE_V2}" defer></script>
${p.slug === 'promote' ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>\n' + formJs(l) + '\n' : ''}${p.slug === 'what-is-bitcoin' ? TOC_JS + '\n' : ''}${CF_SNIPPET}
</body>
</html>
`;
}

// ---------- write ----------
const written = [];
for (const l of LANGS) {
  for (const p of PAGES) {
    const rel = `${l === 'en' ? '' : l + '/'}ecosystem/${p.slug ? p.slug + '/' : ''}index.html`;
    const file = path.join(SITE, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, render(p, l), 'utf8');
    written.push({ rel, p, l, indexable: indexable(p) });
  }
}

// Sitemap block: every indexable page in every built language, with all alternates.
const START = '<!-- ECOSYSTEM:START -->', END = '<!-- ECOSYSTEM:END -->';
const smPath = path.join(SITE, 'sitemap.xml');
let xml = fs.readFileSync(smPath, 'utf8');
const alts = (p) => [...LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${absOf(p, x)}"/>`), `    <xhtml:link rel="alternate" hreflang="x-default" href="${absOf(p, 'en')}"/>`].join('\n');
const urls = written.filter((w) => w.indexable).map((w) => `  <url>
    <loc>${absOf(w.p, w.l)}</loc>
    <lastmod>${DATA.reviewed}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${w.p === INDEX ? '0.6' : '0.5'}</priority>
${alts(w.p)}
  </url>`).join('\n');
const block = `${START}\n${urls}\n${END}`;
if (xml.includes(START)) xml = xml.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
else if (xml.includes('<!-- SEO-BUILD:START -->')) xml = xml.replace('<!-- SEO-BUILD:START -->', `${block}\n<!-- SEO-BUILD:START -->`);
else throw new Error('sitemap anchor not found');
fs.writeFileSync(smPath, xml, 'utf8');

console.log(`languages: ${LANGS.join(', ')}${LANGS.length < ALL_LANGS.length ? ` (missing strings: ${ALL_LANGS.filter((x) => !LANGS.includes(x)).join(', ')})` : ''}`);
console.log(`pages: ${written.length}, noindex: ${written.filter((w) => !w.indexable).map((w) => w.rel).join(', ') || 'none'}`);
console.log(`sitemap: ${written.filter((w) => w.indexable).length} ecosystem URLs (as of ${TODAY})`);
