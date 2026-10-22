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
  let foot = v2.foot;
  if (!foot.includes('data-eco-col')) {
    const col = `<div class="footer-col" data-eco-col><h4>${esc(ui.navLabel)}</h4>${[INDEX, ...SUBPAGES].map((p) =>
      `<a href="${pathOf(p, l)}">${esc(p === INDEX ? txt(l, p).h1 : txt(l, p).nav)}</a>`).join('')}</div>`;
    const i = foot.lastIndexOf('<div class="footer-col"><h4>');
    if (i < 0) throw new Error(`${l}: footer anchor not found`);
    foot = foot.slice(0, i) + col + foot.slice(i);
  }
  const alt = (x) => (LANGS.includes(x) ? pathOf(current, x) : (x === 'en' ? '/' : `/${x}/`));
  const sub = (s) => s.replace(/\{\{ALT:([a-z]{2})\}\}/g, (_, x) => alt(x));
  return { nav: sub(nav), foot: sub(foot), brief: compactBrief(v2.brief, l) };
}

// Compact single-row Brief signup (texts from the language's Brief card; site-v2.js handles #briefForm).
function compactBrief(card, l) {
  const pick = (re) => { const m = card.match(re); if (!m) throw new Error(`${l}: Brief text not found ${re}`); return m[1]; };
  const h3 = pick(/<h3>([\s\S]*?)<\/h3>/);
  const label = pick(/<label for="email"[^>]*>([^<]*)<\/label>/);
  const ph = pick(/placeholder="([^"]*)"/);
  const btn = pick(/<button class="btn btn-ghost" type="submit">([^<]*)<\/button>/);
  const fine = pick(/<div class="fine">([^<]*)</).trim();
  return `<section id="brief" class="eco-brief" aria-label="Virtuse Brief">
    <div class="eco-brief-row">
      <p class="eco-brief-h">${h3}</p>
      <form class="brief-form eco-brief-form" id="briefForm" data-brief-form data-source="ecosystem" novalidate>
        <label for="email" class="eco-sr">${label}</label>
        <input id="email" name="email" type="email" placeholder="${ph}" autocomplete="email" required>
        <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn btn-ghost" type="submit">${btn}</button>
      </form>
    </div>
    <div class="brief-msg" id="briefMsg" aria-live="polite"></div>
    <p class="eco-brief-fine">${fine}</p>
  </section>`;
}

// ---------- blocks ----------
function card(e, l) {
  const rel = e.sponsored ? 'sponsored noopener' : 'noopener';
  const badge = e.sponsored ? `<span class="eco-sponsored">${esc(S[l].ui.sponsored)}</span>` : '';
  const tags = (e.tags || []).map((t) => `<li>${esc(t)}</li>`).join('');
  const en = l === 'en' ? '' : ' lang="en"';
  return `<li class="eco-card">
      <div class="eco-card-top"><h3><a href="${esc(e.url)}" target="_blank" rel="${rel}">${esc(e.name)}</a></h3>${badge}</div>
      <p${en}>${esc(e.verdict)}</p>
      <div class="eco-card-foot"><ul class="eco-tags"${en}>${tags}</ul><span class="eco-host">${esc(host(e.url))} ↗</span></div>
    </li>`;
}
const grid = (entries, l) => `<ul class="eco-grid">\n    ${entries.map((e) => card(e, l)).join('\n    ')}\n  </ul>`;

function confDates(e, l) {
  if (!e.start) return /Sep/.test(e.dates) ? S[l].ui.confTbcSep2027 : S[l].ui.confTba2027;
  const f = new Intl.DateTimeFormat(LOCALE[l], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return f.formatRange(new Date(e.start + 'T12:00:00Z'), new Date(e.end + 'T12:00:00Z'));
}
const countryName = (cc, l) => new Intl.DisplayNames([LOCALE[l]], { type: 'region' }).of(cc);
const city = (c, l) => S[l].ui.cities[c] || c;

function conferenceTable(entries, l) {
  const ui = S[l].ui;
  const en = l === 'en' ? '' : ' lang="en"';
  const rows = entries.map((e) => `<tr>
        <td data-label="${esc(ui.tableEvent)}"><div><b>${esc(e.name)}</b><span class="eco-verdict"${en}>${esc(e.verdict)}</span></div></td>
        <td data-label="${esc(ui.tableCity)}">${esc(city(e.city, l))}, ${esc(countryName(e.country, l))}</td>
        <td data-label="${esc(ui.tableDates)}">${e.start ? `<time datetime="${e.start}">${esc(confDates(e, l))}</time>` : esc(confDates(e, l))}</td>
        <td data-label="${esc(ui.tableLink)}"><a class="eco-btn" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(ui.websiteButton)} ↗</a></td>
      </tr>`).join('\n      ');
  return `<div class="table-wrap"><table class="eco-table">
    <thead><tr><th>${esc(ui.tableEvent)}</th><th>${esc(ui.tableCity)}</th><th>${esc(ui.tableDates)}</th><th>${esc(ui.tableLink)}</th></tr></thead>
    <tbody>
      ${rows}
    </tbody>
  </table></div>`;
}

function howWePick(l) {
  const ui = S[l].ui;
  return `<section class="eco-pick" aria-labelledby="pick-h">
    <h2 id="pick-h">${esc(ui.howWePick)}</h2>
    <p>${esc(ui.howWePickText)} <a href="${pathOf(PROMOTE, l)}#criteria">${esc(ui.criteriaLink)}</a>.</p>
  </section>`;
}

function relatedBlock(p, l) {
  if (!p.related || !p.related.length) return '';
  const labels = p === INDEX ? S[l].ui.indexRelated : txt(l, p).related;
  return `<h2>${esc(S[l].ui.related)}</h2>
  <div class="related">${p.related.map((h, i) => `<a href="${esc(loc(h, l))}">${esc(labels[i])}</a>`).join('')}</div>`;
}

function footNotes(p, l) {
  const ui = S[l].ui, d = DATA.reviewed;
  const priv = p.slug === 'privacy' ? ' ' + fill(ui.privacyFootNote, l) : '';
  const enNote = l !== 'en' && p.entries ? ` ${esc(ui.entriesNote)}` : '';
  return `<aside class="disclaimers">
    <p>${esc(ui.notAdvice)}${enNote}${priv}</p>
    <p class="eco-reviewed">${esc(ui.reviewed)} <time datetime="${d}">${esc(fmtDate(d, l))}</time></p>
  </aside>`;
}

// ---------- page bodies ----------
function indexBody(l) {
  const ui = S[l].ui;
  const cards = SUBPAGES.map((p) => {
    const meta = p.slug === 'promote' ? ui.applyForListing : ui.picks.replace('{n}', liveEntries(p).length);
    return `<li><a class="eco-section" href="${pathOf(p, l)}">${icon(p.icon)}<b>${esc(txt(l, p).nav)}</b><span>${esc(txt(l, p).navDesc)}</span><em>${esc(meta)}</em></a></li>`;
  }).join('\n    ');
  return `${howWePick(l)}
  <h2>${esc(ui.allPages)}</h2>
  <ul class="eco-sections">
    ${cards}
  </ul>
  <p class="eco-promote-line"><a href="${pathOf(PROMOTE, l)}">${esc(ui.promoteCta)} →</a></p>
  ${relatedBlock(INDEX, l)}`;
}

function listingBody(p, l) {
  const t = txt(l, p), entries = liveEntries(p);
  const parts = [];
  if (p.slug === 'what-is-bitcoin') {
    parts.push(`<div class="eco-primer">\n  ${t.primer.map((h) => locHtml(h, l)).join('\n  ')}\n  </div>`);
    parts.push(`<h2>${esc(S[l].ui.faq)}</h2>\n  ${t.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n  ')}`);
  }
  parts.push(howWePick(l));
  if (t.legalNote) parts.push(`<p class="eco-legal">${locHtml(t.legalNote, l)}</p>`);
  if (t.partnerNote) parts.push(`<p class="eco-legal">${locHtml(t.partnerNote, l)}</p>`);
  if (t.listHeading) parts.push(`<h2>${esc(t.listHeading)}</h2>`);
  parts.push(p.slug === 'conferences' ? conferenceTable(entries, l) : grid(entries, l));
  parts.push(relatedBlock(p, l));
  return parts.join('\n  ');
}

const COUNTRIES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'CH'];

function promoteBody(l) {
  const m = S[l].promote;
  const opts = LISTING.map((p) => `<option value="${p.slug}">${esc(txt(l, p).nav)}</option>`).join('');
  const coll = new Intl.Collator(LOCALE[l]);
  const countries = COUNTRIES.map((c) => [c, countryName(c, l)]).sort((a, b) => coll.compare(a[1], b[1])).map(([c, n]) =>
    `<label class="eco-check"><input type="checkbox" name="countries" value="${c}" checked> ${esc(n)}</label>`).join('');
  return `<section class="eco-copy">
    <h2 id="criteria">${esc(m.criteriaH)}</h2>
    <ol>
      ${m.criteria.map((c) => `<li>${c}</li>`).join('\n      ')}
    </ol>
    <h2 id="paid">${esc(m.paidH)}</h2>
    <p>${fill(m.paid, l)}</p>
    <h2 id="removal">${esc(m.removalH)}</h2>
    <p>${esc(m.removal)}</p>
  </section>

  <section class="eco-apply" aria-labelledby="apply-h">
    <h2 id="apply-h">${esc(m.applyH)}</h2>
    <p class="muted">${esc(m.required)}</p>
    <form id="ecoForm" class="eco-form" data-endpoint="${WORKER}/ecosystem-apply" novalidate>
      <div class="eco-row">
        <label>${esc(m.fProject)}<input name="project_name" required maxlength="120" autocomplete="organization"></label>
        <label>${esc(m.fWebsite)}<input name="website" type="url" required maxlength="300" placeholder="https://"></label>
      </div>
      <label>${esc(m.fCategory)}<select name="category" required><option value="">${esc(m.fCategoryChoose)}</option>${opts}</select></label>
      <label>${esc(m.fDesc)}<textarea name="description" required maxlength="300" rows="3"></textarea><span class="eco-count">0 / 300</span></label>
      <fieldset class="eco-countries">
        <legend>${esc(m.fCountries)}</legend>
        <label class="eco-check eco-check-all"><input type="checkbox" data-all-countries checked> ${esc(m.fAllCountries)}</label>
        <details class="eco-pick-countries">
          <summary>${esc(m.fChooseCountries)}</summary>
          <div class="eco-check-grid">${countries}</div>
        </details>
      </fieldset>
      <label class="eco-check"><input type="checkbox" name="bitcoin_only" required> <span>${esc(m.fBitcoinOnly)}</span></label>
      <div class="eco-row">
        <label>${esc(m.fLicence)}<input name="licence" maxlength="200"></label>
        <label>${esc(m.fRepo)}<input name="repo" type="url" maxlength="300" placeholder="https://"></label>
      </div>
      <div class="eco-row">
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
      <!-- Cloudflare Turnstile widget goes here once the site key is set (keys are stored by Ras, never in the repo). -->
      <button class="eco-submit" type="submit">${esc(m.fSubmit)}</button>
      <p class="eco-form-msg" id="ecoFormMsg" role="status" aria-live="polite"></p>
    </form>
    <p class="eco-mail">${m.mail}</p>
  </section>`;
}

function formJs(l) {
  const m = S[l].promote;
  const msgs = { required: m.mRequired, country: m.mCountry, sending: m.mSending, ok: m.mOk, fail: m.mFail };
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
    var t = f.querySelector('[name="cf-turnstile-response"]'); if (t) data.turnstile = t.value;
    var btn = f.querySelector('.eco-submit'); btn.disabled = true; msg.className = 'eco-form-msg'; msg.textContent = M.sending;
    fetch(f.getAttribute('data-endpoint'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json().catch(function () { return {}; }); })
      .then(function () {
        f.reset(); cnt.textContent = '0 / 300';
        msg.className = 'eco-form-msg ok'; msg.textContent = M.ok;
        (window.dataLayer = window.dataLayer || []).push({ event: 'ecosystem_apply', category: data.category });
      })
      .catch(function () { msg.className = 'eco-form-msg err'; msg.innerHTML = M.fail; })
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
const CSS = `
.eco { max-width: 1040px; margin: 0 auto; padding: 36px 0 24px; min-width: 0; }
.eco a { color: var(--text); text-underline-offset: 3px; text-decoration-color: var(--line-strong); }
.eco a:hover { text-decoration-color: var(--text); }
.eco p, .eco li { color: #c9d1d9; }
.eco h1, .eco h2, .eco h3, .eco p, .eco li, .eco summary, .eco label, .eco b, .eco span { overflow-wrap: break-word; }
.eco h1 { font-size: clamp(2rem, 4.5vw, 2.9rem); font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; margin: 0 0 14px; hyphens: auto; }
.eco h2 { font-size: 1.35rem; font-weight: 700; line-height: 1.25; margin: 44px 0 14px; }
.eco .lead { font-size: 1.1rem; line-height: 1.6; color: var(--muted); max-width: 760px; margin: 0; }
.eco .crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; font-size: 13px; color: var(--muted); margin: 0 0 22px; }
.eco .crumbs a { color: var(--muted); text-decoration: none; display: inline-block; padding: 6px 0; }
.eco .crumbs a:hover { color: var(--text); }
.eco-pick { background: var(--card); border: 1px solid var(--line); border-left: 3px solid #f7931a; border-radius: 12px; padding: 18px 20px; margin: 30px 0 8px; }
.eco-pick h2 { margin: 0 0 6px; font-size: 1rem; }
.eco-pick p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--muted); }
.eco-legal { font-size: 14px; line-height: 1.55; color: var(--muted) !important; border-left: 2px solid var(--line-strong); padding: 4px 0 4px 12px; margin: 18px 0; }
.eco-grid, .eco-sections { list-style: none; padding: 0; margin: 18px 0 8px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.eco-card { position: relative; min-width: 0; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px 18px 14px; display: flex; flex-direction: column; gap: 10px; transition: border-color .15s, background .15s; }
.eco-card:hover { border-color: var(--line-strong); background: var(--card-hover); }
.eco-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.eco-card h3 { margin: 0; font-size: 16px; line-height: 1.3; }
.eco-card h3 a { text-decoration: none; }
.eco-card h3 a::after { content: ""; position: absolute; inset: 0; }
.eco-card p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted); flex: 1; }
.eco-card-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; min-width: 0; }
.eco-tags { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.eco-tags li { font-size: 11px; line-height: 1; color: var(--muted); border: 1px solid var(--line-strong); border-radius: 999px; padding: 5px 8px; }
.eco-host { font: 500 11px/1 var(--mono); color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50%; }
.eco-sponsored { font-size: 11px; font-weight: 600; color: #f7931a; border: 1px solid rgba(247,147,26,.4); border-radius: 999px; padding: 4px 8px; white-space: nowrap; }
.eco-sections li { min-width: 0; }
.eco-sections a { display: flex; flex-direction: column; gap: 6px; height: 100%; box-sizing: border-box; min-height: 140px; padding: 18px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; text-decoration: none; transition: border-color .15s, background .15s; }
.eco-sections a:hover { border-color: rgba(247,147,26,.45); background: var(--card-hover); }
.eco-ico { width: 32px; height: 32px; padding: 6px; box-sizing: border-box; border-radius: 9px; background: rgba(247,147,26,.12); fill: none; stroke: #f7931a; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; margin-bottom: 6px; flex: none; }
.eco-sections b { font-size: 17px; line-height: 1.25; }
.eco-sections span { font-size: 14px; color: var(--muted); flex: 1; }
.eco-sections em { font: normal 500 11px/1.3 var(--mono); color: var(--dim); text-transform: uppercase; letter-spacing: .06em; }
.eco-promote-line { margin: 18px 0 0; }
.eco-primer { max-width: 760px; }
.eco-primer p, .eco-primer li { font-size: 16px; line-height: 1.7; }
.eco-primer ul { padding-left: 20px; }
.eco details { border-bottom: 1px solid var(--line); padding: 14px 0; max-width: 760px; }
.eco summary { cursor: pointer; font-weight: 600; }
.eco details p { margin: 10px 0 0; line-height: 1.6; }
.eco .related { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 8px 0 16px; }
.eco .related a { display: flex; align-items: center; min-height: 48px; padding: 12px 16px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; text-decoration: none; font-size: 15px; min-width: 0; }
.eco .related a:hover { border-color: var(--line-strong); }
.eco .table-wrap { overflow-x: auto; margin: 18px 0 8px; }
.eco-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.eco-table th, .eco-table td { text-align: left; padding: 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
.eco-table th { color: var(--muted); font-weight: 600; font-size: 13px; }
.eco-table td b { font-weight: 600; }
.eco-verdict { display: block; margin-top: 4px; font-size: 13px; color: var(--muted); }
.eco-btn { display: inline-flex; align-items: center; min-height: 40px; padding: 8px 14px; border: 1px solid var(--line-strong); border-radius: 10px; text-decoration: none !important; font-weight: 600; font-size: 13px; white-space: nowrap; }
.eco-btn:hover { border-color: #f7931a; color: #fff; }
.eco .disclaimers { margin-top: 44px; padding-top: 18px; border-top: 1px solid var(--line); font-size: 13px; }
.eco .disclaimers p { color: var(--muted); margin: 0 0 6px; }
.eco .muted { color: var(--muted); font-size: 14px; }
.eco-copy, .eco-apply { max-width: 760px; }
.eco-copy li { margin: 0 0 8px; line-height: 1.55; }
.eco-form { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; min-width: 0; }
.eco-form label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--text); min-width: 0; }
.eco-form input:not([type=checkbox]):not([type=radio]), .eco-form select, .eco-form textarea { font: 400 16px/1.4 var(--sans); color: var(--text); background: var(--card); border: 1px solid var(--line-strong); border-radius: 10px; padding: 11px 12px; min-height: 44px; box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0; }
.eco-form textarea { resize: vertical; }
.eco-form input:focus, .eco-form select:focus, .eco-form textarea:focus { outline: 2px solid var(--text); outline-offset: 1px; }
.eco-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.eco-form fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin: 0; min-width: 0; }
.eco-form legend { font-size: 14px; padding: 0 6px; }
.eco-form .eco-check { flex-direction: row; align-items: flex-start; gap: 8px; color: #c9d1d9; line-height: 1.45; }
.eco-check input { margin-top: 3px; accent-color: #f7931a; width: 16px; height: 16px; flex: none; }
.eco-check-all { font-weight: 600; }
.eco .eco-pick-countries { border: 0; padding: 8px 0 0; max-width: none; }
.eco-pick-countries summary { font-size: 14px; font-weight: 500; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; display: inline-block; padding: 6px 0; }
.eco-check-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 12px; margin-top: 10px; }
.eco-radio { display: flex; flex-wrap: wrap; gap: 8px 20px; }
.eco-count { font-size: 12px; color: var(--dim); align-self: flex-end; }
.eco-form .hp { position: absolute; left: -9999px; }
.eco-submit { align-self: flex-start; min-height: 44px; padding: 12px 22px; border: 0; border-radius: 10px; background: var(--text); color: #08090a; font: 600 15px/1 var(--sans); cursor: pointer; }
.eco-submit:disabled { opacity: .6; cursor: wait; }
.eco-form-msg { margin: 0; font-size: 14px; min-height: 1.2em; }
.eco-form-msg.ok { color: #3fb950; }
.eco-form-msg.err { color: #f0883e; }
.eco-mail { margin-top: 18px; }
.eco-sr { position: absolute !important; left: -9999px; }
.eco-brief { max-width: 1040px; margin: 8px auto 0; padding: 18px 20px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; box-sizing: border-box; }
.eco-brief-row { display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap; }
.eco-brief-h { margin: 0; font-size: 16px; font-weight: 600; color: var(--text); flex: 1 1 220px; }
.eco-brief-h span { color: var(--muted); font-weight: 400; }
.eco-brief-form { display: flex !important; gap: 8px; flex: 2 1 340px; min-width: 0; }
.eco-brief-form input[type=email] { flex: 1; min-width: 0; padding: 11px 12px; font-size: 16px; }
.eco-brief-form .btn { white-space: nowrap; flex: none; }
.eco-brief .brief-msg { margin-top: 8px; font-size: 13px; }
.eco-brief-fine { margin: 6px 0 0; font-size: 12px; color: var(--dim); }
/* Ecosystem menu: 13 items in two columns on desktop */
@media (min-width: 1181px) {
  #nd-eco { min-width: 560px; grid-template-columns: 1fr 1fr; column-gap: 4px; left: auto; right: -12px; }
  .nav-group.open #nd-eco { display: grid; }
}
@media (hover: hover) and (min-width: 1181px) { #ng-eco:hover #nd-eco { display: grid; } }
@media (max-width: 900px) { .eco-grid, .eco-sections { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) {
  .eco { padding-top: 24px; }
  .eco-grid, .eco .related, .eco-row { grid-template-columns: minmax(0, 1fr); }
  .eco-sections { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .eco-sections a { min-height: 128px; padding: 14px 12px; gap: 4px; }
  .eco-sections b { font-size: 15px; }
  .eco-sections span { font-size: 13px; }
  .eco-ico { width: 28px; height: 28px; padding: 5px; }
  .eco-check-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .eco .table-wrap { overflow: visible; }
  .eco-table, .eco-table tbody, .eco-table tr, .eco-table td { display: block; width: 100%; box-sizing: border-box; }
  .eco-table thead { display: none; }
  .eco-table tr { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 6px 14px; margin: 0 0 10px; }
  .eco-table td { border: 0; padding: 8px 0; display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 12px; }
  .eco-table td + td { border-top: 1px solid var(--line); }
  .eco-table td::before { content: attr(data-label); color: var(--muted); font-size: 12px; font-weight: 600; }
  .eco-brief-form { flex-basis: 100%; }
}
`.trim();

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
<link rel="stylesheet" href="/site-v2.css?v=${SITE_V2}">
<style>${CSS}</style>
<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': schemas(p, l) })}</script>
${CHROME[l].i18n ? CHROME[l].i18n + '\n' : ''}</head>
<body class="page-eco no-split">
<!-- generated by seo-build/ecosystem.mjs; edit seo-build/data/ecosystem*.json, not this file -->
${nav}

<main class="wrap" id="top">
<article class="eco">
  <nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>
  <h1>${esc(t.h1)}</h1>
  <p class="lead">${esc(t.intro)}</p>
  ${body}
  ${footNotes(p, l)}
</article>
${p.slug !== 'promote' ? '\n  ' + brief + '\n' : ''}
  ${foot}
</main>

<script src="/site-v2.js?v=${SITE_V2}" defer></script>
${p.slug === 'promote' ? formJs(l) + '\n' : ''}${CF_SNIPPET}
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
