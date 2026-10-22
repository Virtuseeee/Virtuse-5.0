// Bitcoin Ecosystem directory: /ecosystem/ + 12 subpages (handover bitcoin-ecosystem.md, 22 Oct 2026).
//
//   node seo-build/ecosystem.mjs            # write the pages + the ECOSYSTEM sitemap block
//   ECO_DATE=2026-11-07 node seo-build/...  # pretend "today" (past conferences drop out)
//
// Content lives in data/ecosystem.json (entries stay English in every language).
// Chrome (nav, footer, Brief card) comes from data/chrome-v2.json like the other
// seo-build pages; the Ecosystem menu group and footer column are added here until
// the homepages carry them (then seo_chrome.py exports them and the injection is skipped).
// EN only for now; other languages follow with their own strings.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, jsonLd, SITE_DIR_NAME, DEFAULT_ORIGIN } from './lib/util.mjs';
import { SITE_V2, CF_SNIPPET } from './lib/html.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..', SITE_DIR_NAME);
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, 'data/ecosystem.json'), 'utf8'));
const CHROME = JSON.parse(fs.readFileSync(path.join(HERE, 'data/chrome-v2.json'), 'utf8'));
const ORIGIN = DEFAULT_ORIGIN;
const TODAY = process.env.ECO_DATE || new Date().toISOString().slice(0, 10);
const LANG = 'en';
const WORKER = 'https://virtuse-newsletter.virtuse-ai.workers.dev';

const PAGES = DATA.pages;
const INDEX = PAGES.find((p) => p.slug === '');
const SUBPAGES = PAGES.filter((p) => p.slug !== '');
const LISTING = SUBPAGES.filter((p) => p.slug !== 'promote');

const T = {
  home: 'Home',
  howWePick: 'How we pick',
  howWePickText: 'Every entry is chosen by hand and must be bitcoin-only, relevant to Europe, live and honest. We write each verdict ourselves. Paid placements are always labelled "Sponsored" and never change our verdict.',
  criteriaLink: 'Read our listing criteria',
  related: 'Related on Virtuse',
  reviewed: 'Last reviewed:',
  notAdvice: 'Listings are informational, not investment advice.',
  sponsored: 'Sponsored',
  visit: 'Visit',
  entries: (n) => `${n} picks`,
  promoteCta: 'Know a bitcoin-only project that belongs here? Get it featured',
  allPages: 'Explore the ecosystem',
  faq: 'Frequently asked questions',
  table: { name: 'Event', where: 'City', when: 'Dates', only: 'Bitcoin-only', yes: 'Yes', no: 'No' }
};

const pathOf = (p) => (p.slug ? `/ecosystem/${p.slug}/` : '/ecosystem/');
const absOf = (p) => ORIGIN + pathOf(p);
const host = (u) => new URL(u).hostname.replace(/^www\./, '');
const fmtDate = (iso) => {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
};

// ---------- checks ----------
for (const p of PAGES) {
  if (p.title.length > 60) throw new Error(`title > 60 (${p.title.length}): ${p.title}`);
  if (p.description.length > 155) throw new Error(`description > 155 (${p.description.length}): ${p.slug}`);
  if (/[—]/.test(p.title + p.description + p.intro)) throw new Error(`em dash in ${p.slug}`);
}
const h1s = new Set(PAGES.map((p) => p.h1));
if (h1s.size !== PAGES.length) throw new Error('duplicate H1');

function upcoming(entries) {
  return entries.filter((e) => !e.end || e.end >= TODAY);
}
function liveEntries(p) {
  return p.slug === 'conferences' ? upcoming(p.entries) : p.entries || [];
}
function indexable(p) {
  if (!p.entries) return true; // index + promote
  return liveEntries(p).length >= DATA.minEntries;
}

// ---------- chrome ----------
function ecoGroup(current) {
  const links = [INDEX, ...SUBPAGES].map((p) => {
    const cur = p === current ? ' aria-current="page"' : '';
    const t = p === INDEX ? 'Overview' : p.nav;
    const d = p === INDEX ? 'All bitcoin-only resources' : p.navDesc;
    return `<a href="${pathOf(p)}"${cur}><span class="nd-t">${esc(t)}</span><span class="nd-d">${esc(d)}</span></a>`;
  }).join('');
  return `
      <div class="nav-group${current ? ' current' : ''}" id="ng-eco">
        <button type="button" class="nav-group-btn" aria-expanded="false" aria-controls="nd-eco">Ecosystem</button>
        <div class="nav-drop" id="nd-eco">${links}</div>
      </div>`;
}

function chrome(current) {
  const v2 = CHROME[LANG];
  let nav = v2.nav;
  if (!nav.includes('id="ng-eco"')) {
    const anchor = '      <a class="nav-top" href="/about.html">';
    if (!nav.includes(anchor)) throw new Error('nav anchor (About) not found');
    nav = nav.replace(anchor, ecoGroup(current).replace(/^\n/, '') + '\n' + anchor);
  }
  let foot = v2.foot;
  if (!foot.includes('<h4>Ecosystem</h4>')) {
    const col = `<div class="footer-col"><h4>Ecosystem</h4>${[INDEX, ...SUBPAGES].map((p) =>
      `<a href="${pathOf(p)}">${esc(p === INDEX ? 'Bitcoin Ecosystem' : p.nav)}</a>`).join('')}</div>`;
    const anchor = '<div class="footer-col"><h4>Legal</h4>';
    if (!foot.includes(anchor)) throw new Error('footer anchor (Legal) not found');
    foot = foot.replace(anchor, col + anchor);
  }
  // Language menus: only EN exists yet, other languages go to their home page.
  const fill = (s) => s.replace(/\{\{ALT:([a-z]{2})\}\}/g, (_, x) => (x === 'en' ? pathOf(current) : `/${x}/`));
  const brief = v2.brief
    .replace('data-source="seo_page"', 'data-source="ecosystem"')
    .replace('utm_medium=seo_page', 'utm_medium=ecosystem');
  return { nav: fill(nav), foot: fill(foot), brief };
}

// ---------- blocks ----------
function card(e) {
  const rel = e.sponsored ? 'sponsored noopener' : 'noopener';
  const badge = e.sponsored ? `<span class="eco-sponsored">${T.sponsored}</span>` : '';
  const tags = (e.tags || []).map((t) => `<li>${esc(t)}</li>`).join('');
  return `<li class="eco-card">
      <div class="eco-card-top"><h3><a href="${esc(e.url)}" target="_blank" rel="${rel}">${esc(e.name)}</a></h3>${badge}</div>
      <p>${esc(e.verdict)}</p>
      <div class="eco-card-foot"><ul class="eco-tags">${tags}</ul><span class="eco-host">${esc(host(e.url))} ↗</span></div>
    </li>`;
}

function grid(entries) {
  return `<ul class="eco-grid">\n    ${entries.map(card).join('\n    ')}\n  </ul>`;
}

function conferenceTable(entries) {
  const rows = entries.map((e) => `<tr>
        <td data-label="${T.table.name}"><div><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.name)}</a><span class="eco-verdict">${esc(e.verdict)}</span></div></td>
        <td data-label="${T.table.where}">${esc(e.city)}, ${esc(e.countryName)}</td>
        <td data-label="${T.table.when}">${e.start ? `<time datetime="${e.start}">${esc(e.dates)}</time>` : esc(e.dates)}</td>
        <td data-label="${T.table.only}">${e.bitcoinOnly ? T.table.yes : T.table.no}</td>
      </tr>`).join('\n      ');
  return `<div class="table-wrap"><table class="eco-table">
    <thead><tr><th>${T.table.name}</th><th>${T.table.where}</th><th>${T.table.when}</th><th>${T.table.only}</th></tr></thead>
    <tbody>
      ${rows}
    </tbody>
  </table></div>`;
}

function howWePick() {
  return `<section class="eco-pick" aria-labelledby="pick-h">
    <h2 id="pick-h">${T.howWePick}</h2>
    <p>${esc(T.howWePickText)} <a href="/ecosystem/promote/#criteria">${T.criteriaLink}</a>.</p>
  </section>`;
}

function relatedBlock(p) {
  if (!p.related || !p.related.length) return '';
  return `<h2>${T.related}</h2>
  <div class="related">${p.related.map((r) => `<a href="${esc(r.href)}">${esc(r.label)}</a>`).join('')}</div>`;
}

function footNotes(p) {
  const d = DATA.reviewed;
  return `<aside class="disclaimers">
    <p>${T.notAdvice}${p.slug === 'privacy' ? ' Looking for how Virtuse handles your data? Read our <a href="/privacy-policy.html">privacy policy</a>.' : ''}</p>
    <p class="eco-reviewed">${T.reviewed} <time datetime="${d}">${fmtDate(d)}</time></p>
  </aside>`;
}

// ---------- page bodies ----------
function indexBody() {
  const cards = SUBPAGES.map((p) => {
    const n = p.entries ? liveEntries(p).length : 0;
    const meta = p.slug === 'promote' ? 'Apply for a listing' : T.entries(n);
    return `<li><a class="eco-section" href="${pathOf(p)}"><b>${esc(p.nav)}</b><span>${esc(p.navDesc)}</span><em>${esc(meta)}</em></a></li>`;
  }).join('\n    ');
  return `${howWePick()}
  <h2>${T.allPages}</h2>
  <ul class="eco-sections">
    ${cards}
  </ul>
  <p class="eco-promote-line"><a href="/ecosystem/promote/">${T.promoteCta} →</a></p>
  <h2>${T.related}</h2>
  <div class="related"><a href="/news.html?utm_source=brief&amp;utm_medium=ecosystem">Virtuse Brief: weekly Bitcoin news</a><a href="/ecosystem/what-is-bitcoin/">New to Bitcoin? Start here</a></div>`;
}

function listingBody(p) {
  const entries = liveEntries(p);
  const parts = [];
  if (p.slug === 'what-is-bitcoin') {
    parts.push(`<div class="eco-primer">\n  ${p.primer.join('\n  ')}\n  </div>`);
    parts.push(`<h2>${T.faq}</h2>\n  ${p.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n  ')}`);
  }
  parts.push(howWePick());
  if (p.legalNote) parts.push(`<p class="eco-legal">${p.legalNote}</p>`);
  if (p.partnerNote) parts.push(`<p class="eco-legal">${p.partnerNote}</p>`);
  if (p.listHeading) parts.push(`<h2>${esc(p.listHeading)}</h2>`);
  parts.push(p.slug === 'conferences' ? conferenceTable(entries) : grid(entries));
  parts.push(relatedBlock(p));
  return parts.join('\n  ');
}

const CATEGORIES = LISTING.map((p) => [p.slug, p.nav]);
const COUNTRIES = [
  ['AT', 'Austria'], ['BE', 'Belgium'], ['BG', 'Bulgaria'], ['HR', 'Croatia'], ['CY', 'Cyprus'], ['CZ', 'Czechia'],
  ['DK', 'Denmark'], ['EE', 'Estonia'], ['FI', 'Finland'], ['FR', 'France'], ['DE', 'Germany'], ['GR', 'Greece'],
  ['HU', 'Hungary'], ['IE', 'Ireland'], ['IT', 'Italy'], ['LV', 'Latvia'], ['LT', 'Lithuania'], ['LU', 'Luxembourg'],
  ['MT', 'Malta'], ['NL', 'Netherlands'], ['PL', 'Poland'], ['PT', 'Portugal'], ['RO', 'Romania'], ['SK', 'Slovakia'],
  ['SI', 'Slovenia'], ['ES', 'Spain'], ['SE', 'Sweden'], ['IS', 'Iceland'], ['LI', 'Liechtenstein'], ['NO', 'Norway'],
  ['CH', 'Switzerland']
];

function promoteBody() {
  const opts = CATEGORIES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  const countries = COUNTRIES.map(([c, n]) =>
    `<label class="eco-check"><input type="checkbox" name="countries" value="${c}"> ${esc(n)}</label>`).join('');
  return `<section class="eco-copy">
    <h2 id="criteria">Criteria</h2>
    <ol>
      <li><strong>Bitcoin only.</strong> You support bitcoin (on-chain and/or Lightning) and do not list, sell or promote other cryptocurrencies or tokens.</li>
      <li><strong>Relevant to Europe.</strong> You serve users in the EU/EEA or Switzerland.</li>
      <li><strong>Regulated where required.</strong> If you provide crypto-asset services in the EU, you hold a MiCA (CASP) authorisation or an applicable transitional licence.</li>
      <li><strong>Live and maintained,</strong> with a working public website.</li>
      <li><strong>Honest:</strong> no yield promises and no undisclosed custody.</li>
    </ol>
    <h2 id="paid">Paid placement</h2>
    <p>Some entries are marked "Sponsored" or "Featured". These are paid placements, and some links are affiliate links. Payment never changes our criteria or our verdict, and it does not guarantee acceptance. See <a href="/how-we-earn.html">How we earn</a>.</p>
    <h2 id="removal">Removal</h2>
    <p>We may remove a listing if it no longer meets the criteria. You may request removal at any time.</p>
  </section>

  <section class="eco-apply" aria-labelledby="apply-h">
    <h2 id="apply-h">Application</h2>
    <p class="muted">Fields marked * are required. We review every application personally; nothing is published automatically.</p>
    <form id="ecoForm" class="eco-form" data-endpoint="${WORKER}/ecosystem-apply" novalidate>
      <div class="eco-row">
        <label>Project name *<input name="project_name" required maxlength="120" autocomplete="organization"></label>
        <label>Website URL *<input name="website" type="url" required maxlength="300" placeholder="https://"></label>
      </div>
      <label>Ecosystem category *<select name="category" required><option value="">Choose a category</option>${opts}</select></label>
      <label>Short description in English (max 300 characters) *<textarea name="description" required maxlength="300" rows="3"></textarea><span class="eco-count" data-for="description">0 / 300</span></label>
      <fieldset class="eco-countries">
        <legend>Countries served *</legend>
        <label class="eco-check eco-check-all"><input type="checkbox" data-all-countries> All EU/EEA countries and Switzerland</label>
        <div class="eco-check-grid">${countries}</div>
      </fieldset>
      <label class="eco-check"><input type="checkbox" name="bitcoin_only" required> I confirm the project is bitcoin-only (no other cryptocurrencies or tokens) *</label>
      <div class="eco-row">
        <label>MiCA / licence number and authority (if applicable)<input name="licence" maxlength="200"></label>
        <label>Open-source repository URL<input name="repo" type="url" maxlength="300" placeholder="https://"></label>
      </div>
      <div class="eco-row">
        <label>Contact name *<input name="contact_name" required maxlength="120" autocomplete="name"></label>
        <label>Contact email *<input name="contact_email" type="email" required maxlength="200" autocomplete="email"></label>
      </div>
      <fieldset class="eco-radio">
        <legend>Interested in a featured or sponsored placement?</legend>
        <label class="eco-check"><input type="radio" name="sponsored_interest" value="yes"> Yes</label>
        <label class="eco-check"><input type="radio" name="sponsored_interest" value="no" checked> No</label>
      </fieldset>
      <label>Message<textarea name="message" maxlength="1500" rows="4"></textarea></label>
      <label class="eco-check"><input type="checkbox" name="consent" required> I agree that Virtuse processes these details to review the application, as described in the <a href="/privacy-policy.html">privacy policy</a>. *</label>
      <input class="hp" type="text" name="company_url" tabindex="-1" autocomplete="off" aria-hidden="true">
      <!-- Cloudflare Turnstile widget goes here once the site key is set (keys are stored by Ras, never in the repo). -->
      <button class="eco-submit" type="submit">Send application</button>
      <p class="eco-form-msg" id="ecoFormMsg" role="status" aria-live="polite"></p>
    </form>
    <p class="eco-mail">Prefer email? Write to <a href="mailto:info@virtuse.com?subject=Bitcoin%20Ecosystem%20application">info@virtuse.com</a>.</p>
  </section>`;
}

const FORM_JS = `<script>
(function () {
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
    if (!f.checkValidity() || !countries.length) {
      msg.textContent = 'Please fill in all required fields' + (countries.length ? '.' : ' and choose at least one country.');
      msg.className = 'eco-form-msg err'; (f.querySelector(':invalid') || f.querySelector('.eco-countries')).focus && (f.querySelector(':invalid') || all).focus(); return;
    }
    var data = { lang: document.documentElement.lang || 'en', countries: countries };
    ['project_name','website','category','description','licence','repo','contact_name','contact_email','message'].forEach(function (k) { data[k] = f[k].value.trim(); });
    data.bitcoin_only = f.bitcoin_only.checked; data.consent = f.consent.checked;
    data.sponsored_interest = (f.querySelector('input[name="sponsored_interest"]:checked') || {}).value || 'no';
    var t = f.querySelector('[name="cf-turnstile-response"]'); if (t) data.turnstile = t.value;
    var btn = f.querySelector('.eco-submit'); btn.disabled = true; msg.className = 'eco-form-msg'; msg.textContent = 'Sending…';
    fetch(f.getAttribute('data-endpoint'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json().catch(function () { return {}; }); })
      .then(function () {
        f.reset(); cnt.textContent = '0 / 300';
        msg.className = 'eco-form-msg ok';
        msg.textContent = 'Thank you. We have received your application and sent a confirmation to your email. Reviews usually take up to 30 days.';
        (window.dataLayer = window.dataLayer || []).push({ event: 'ecosystem_apply', category: data.category });
      })
      .catch(function () { msg.className = 'eco-form-msg err'; msg.innerHTML = 'Sending did not work. Please email your application to <a href="mailto:info@virtuse.com">info@virtuse.com</a>.'; })
      .then(function () { btn.disabled = false; });
  });
})();
</script>`;

// ---------- JSON-LD ----------
function schemas(p) {
  const crumbs = [{ name: T.home, item: `${ORIGIN}/` }, { name: 'Bitcoin Ecosystem', item: absOf(INDEX) }];
  if (p !== INDEX) crumbs.push({ name: p.nav === 'Promote' ? p.h1 : p.nav, item: absOf(p) });
  const graph = [
    {
      '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'Virtuse', legalName: 'Virtuse Wealth Management, a.s.',
      logo: `${ORIGIN}/email-virtuse-v-mark.png`, url: `${ORIGIN}/`,
      address: { '@type': 'PostalAddress', streetAddress: 'Borinka 65', postalCode: '900 32', addressLocality: 'Borinka', addressCountry: 'SK' }
    },
    { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) }
  ];
  if (p.slug === 'promote') {
    graph.push({ '@type': 'WebPage', '@id': absOf(p), url: absOf(p), name: p.title, description: p.description, inLanguage: LANG, isPartOf: { '@id': absOf(INDEX) } });
    return graph;
  }
  const items = p === INDEX
    ? SUBPAGES.map((s) => ({ name: s.nav, url: absOf(s) }))
    : liveEntries(p).map((e) => ({ name: e.name, url: e.url }));
  graph.push({
    '@type': 'CollectionPage', '@id': absOf(p), url: absOf(p), name: p.h1, description: p.description, inLanguage: LANG,
    dateModified: DATA.reviewed, publisher: { '@id': `${ORIGIN}/#org` },
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: x.url })) }
  });
  if (p.slug === 'what-is-bitcoin') {
    graph.push({ '@type': 'Article', headline: p.h1, description: p.description, inLanguage: LANG, dateModified: DATA.reviewed, author: { '@id': `${ORIGIN}/#org` }, publisher: { '@id': `${ORIGIN}/#org` }, mainEntityOfPage: absOf(p) });
    graph.push({ '@type': 'FAQPage', mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
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
.eco { max-width: 1040px; margin: 0 auto; padding: 36px 0 24px; }
.eco a { color: var(--text); text-underline-offset: 3px; text-decoration-color: var(--line-strong); }
.eco a:hover { text-decoration-color: var(--text); }
.eco p, .eco li { color: #c9d1d9; }
.eco h1 { font-size: clamp(2rem, 4.5vw, 2.9rem); font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; margin: 0 0 14px; }
.eco h2 { font-size: 1.35rem; font-weight: 700; line-height: 1.25; margin: 44px 0 14px; }
.eco .lead { font-size: 1.1rem; line-height: 1.6; color: var(--muted); max-width: 760px; margin: 0; }
.eco .crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; font-size: 13px; color: var(--muted); margin: 0 0 22px; }
.eco .crumbs a { color: var(--muted); text-decoration: none; display: inline-block; padding: 6px 0; }
.eco .crumbs a:hover { color: var(--text); }
.eco-pick { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; margin: 30px 0 8px; }
.eco-pick h2 { margin: 0 0 6px; font-size: 1rem; }
.eco-pick p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--muted); }
.eco-legal { font-size: 14px; line-height: 1.55; color: var(--muted) !important; border-left: 2px solid var(--line-strong); padding: 4px 0 4px 12px; margin: 18px 0; }
.eco-grid, .eco-sections { list-style: none; padding: 0; margin: 18px 0 8px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.eco-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px 18px 14px; display: flex; flex-direction: column; gap: 10px; transition: border-color .15s, background .15s; }
.eco-card:hover { border-color: var(--line-strong); background: var(--card-hover); }
.eco-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.eco-card h3 { margin: 0; font-size: 16px; line-height: 1.3; }
.eco-card h3 a { text-decoration: none; }
.eco-card h3 a::after { content: ""; position: absolute; inset: 0; }
.eco-card { position: relative; }
.eco-card p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted); flex: 1; }
.eco-card-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; }
.eco-tags { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.eco-tags li { font-size: 11px; line-height: 1; color: var(--muted); border: 1px solid var(--line-strong); border-radius: 999px; padding: 5px 8px; }
.eco-host { font: 500 11px/1 var(--mono); color: var(--dim); white-space: nowrap; }
.eco-sponsored { font-size: 11px; font-weight: 600; color: #f7931a; border: 1px solid rgba(247,147,26,.4); border-radius: 999px; padding: 4px 8px; white-space: nowrap; }
.eco-sections a { display: flex; flex-direction: column; gap: 6px; height: 100%; box-sizing: border-box; min-height: 120px; padding: 18px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; text-decoration: none; transition: border-color .15s, background .15s; }
.eco-sections a:hover { border-color: var(--line-strong); background: var(--card-hover); }
.eco-sections b { font-size: 17px; }
.eco-sections span { font-size: 14px; color: var(--muted); flex: 1; }
.eco-sections em { font: normal 500 11px/1 var(--mono); color: var(--dim); text-transform: uppercase; letter-spacing: .06em; }
.eco-promote-line { margin: 18px 0 0; }
.eco-primer { max-width: 760px; }
.eco-primer p, .eco-primer li { font-size: 16px; line-height: 1.7; }
.eco-primer ul { padding-left: 20px; }
.eco details { border-bottom: 1px solid var(--line); padding: 14px 0; max-width: 760px; }
.eco summary { cursor: pointer; font-weight: 600; }
.eco details p { margin: 10px 0 0; line-height: 1.6; }
.eco .related { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 8px 0 16px; }
.eco .related a { display: flex; align-items: center; min-height: 48px; padding: 12px 16px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; text-decoration: none; font-size: 15px; }
.eco .related a:hover { border-color: var(--line-strong); }
.eco .table-wrap { overflow-x: auto; margin: 18px 0 8px; }
.eco-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.eco-table th, .eco-table td { text-align: left; padding: 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
.eco-table th { color: var(--muted); font-weight: 600; font-size: 13px; }
.eco-table td a { font-weight: 600; }
.eco-verdict { display: block; margin-top: 4px; font-size: 13px; color: var(--muted); }
.eco .disclaimers { margin-top: 44px; padding-top: 18px; border-top: 1px solid var(--line); font-size: 13px; }
.eco .disclaimers p { color: var(--muted); margin: 0 0 6px; }
.eco .muted { color: var(--muted); font-size: 14px; }
.eco-copy { max-width: 760px; }
.eco-copy li { margin: 0 0 8px; line-height: 1.55; }
.eco-apply { max-width: 760px; }
.eco-form { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }
.eco-form label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--text); }
.eco-form input:not([type=checkbox]):not([type=radio]), .eco-form select, .eco-form textarea { font: 400 15px/1.4 var(--sans); color: var(--text); background: var(--card); border: 1px solid var(--line-strong); border-radius: 10px; padding: 11px 12px; min-height: 44px; box-sizing: border-box; width: 100%; }
.eco-form textarea { resize: vertical; }
.eco-form input:focus, .eco-form select:focus, .eco-form textarea:focus { outline: 2px solid var(--text); outline-offset: 1px; }
.eco-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.eco-form fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin: 0; }
.eco-form legend { font-size: 14px; padding: 0 6px; }
.eco-form .eco-check { flex-direction: row; align-items: flex-start; gap: 8px; color: #c9d1d9; line-height: 1.45; }
.eco-check input { margin-top: 3px; accent-color: #f7931a; width: 16px; height: 16px; flex: none; }
.eco-check-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 12px; margin-top: 10px; }
.eco-check-all { font-weight: 600; }
.eco-radio { display: flex; gap: 20px; }
.eco-count { font-size: 12px; color: var(--dim); align-self: flex-end; }
.eco-form .hp { position: absolute; left: -9999px; }
.eco-submit { align-self: flex-start; min-height: 44px; padding: 12px 22px; border: 0; border-radius: 10px; background: var(--text); color: #08090a; font: 600 15px/1 var(--sans); cursor: pointer; }
.eco-submit:disabled { opacity: .6; cursor: wait; }
.eco-form-msg { margin: 0; font-size: 14px; min-height: 1.2em; }
.eco-form-msg.ok { color: #3fb950; }
.eco-form-msg.err { color: #f0883e; }
.eco-mail { margin-top: 18px; }
.page-eco #brief { max-width: 1040px; margin: 0 auto; padding-block: 48px; }
/* Ecosystem menu: 13 items in two columns on desktop */
@media (min-width: 1181px) {
  #nd-eco { min-width: 560px; grid-template-columns: 1fr 1fr; column-gap: 4px; left: auto; right: -12px; }
  .nav-group.open #nd-eco { display: grid; }
}
@media (hover: hover) and (min-width: 1181px) { #ng-eco:hover #nd-eco { display: grid; } }
@media (max-width: 900px) { .eco-grid, .eco-sections { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) {
  .eco { padding-top: 24px; }
  .eco-grid, .eco-sections, .eco .related, .eco-row { grid-template-columns: 1fr; }
  .eco-check-grid { grid-template-columns: 1fr 1fr; }
  .eco .table-wrap { overflow: visible; }
  .eco-table, .eco-table tbody, .eco-table tr, .eco-table td { display: block; width: 100%; box-sizing: border-box; }
  .eco-table thead { display: none; }
  .eco-table tr { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 6px 14px; margin: 0 0 10px; }
  .eco-table td { border: 0; padding: 8px 0; display: grid; grid-template-columns: 96px 1fr; gap: 12px; }
  .eco-table td + td { border-top: 1px solid var(--line); }
  .eco-table td::before { content: attr(data-label); color: var(--muted); font-size: 12px; font-weight: 600; }
}
`.trim();

function render(p) {
  const { nav, foot, brief } = chrome(p);
  const canonical = absOf(p);
  const noindex = !indexable(p);
  const crumbs = p === INDEX
    ? `<a href="/">${T.home}</a> <span aria-hidden="true">/</span> <span>Bitcoin Ecosystem</span>`
    : `<a href="/">${T.home}</a> <span aria-hidden="true">/</span> <a href="/ecosystem/">Ecosystem</a> <span aria-hidden="true">/</span> <span>${esc(p.nav === 'Promote' ? 'Get featured' : p.nav)}</span>`;
  const body = p === INDEX ? indexBody() : p.slug === 'promote' ? promoteBody() : listingBody(p);
  const showBrief = p.slug !== 'promote';
  return `<!DOCTYPE html>
<html lang="${LANG}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
${CHROME._head}
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">
<link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="en" href="${canonical}">
  <link rel="alternate" hreflang="x-default" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Virtuse">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="en_US">
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
<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': schemas(p) })}</script>
${CHROME[LANG].i18n ? CHROME[LANG].i18n + '\n' : ''}</head>
<body class="page-eco no-split">
<!-- generated by seo-build/ecosystem.mjs; edit seo-build/data/ecosystem.json, not this file -->
${nav}

<main class="wrap" id="top">
<article class="eco">
  <nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>
  <h1>${esc(p.h1)}</h1>
  <p class="lead">${esc(p.intro)}</p>
  ${body}
  ${footNotes(p)}
</article>
${showBrief ? '\n  ' + brief + '\n' : ''}
  ${foot}
</main>

<script src="/site-v2.js?v=${SITE_V2}" defer></script>
${p.slug === 'promote' ? FORM_JS + '\n' : ''}${CF_SNIPPET}
</body>
</html>
`;
}

// ---------- write ----------
const written = [];
for (const p of PAGES) {
  const rel = p.slug ? `ecosystem/${p.slug}/index.html` : 'ecosystem/index.html';
  const file = path.join(SITE, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, render(p), 'utf8');
  written.push({ rel, p, indexable: indexable(p), n: p.entries ? liveEntries(p).length : null });
}

// Sitemap block (indexable pages only), placed before the seo-build block.
const START = '<!-- ECOSYSTEM:START -->', END = '<!-- ECOSYSTEM:END -->';
const smPath = path.join(SITE, 'sitemap.xml');
let xml = fs.readFileSync(smPath, 'utf8');
const urls = written.filter((w) => w.indexable).map((w) => `  <url>
    <loc>${absOf(w.p)}</loc>
    <lastmod>${DATA.reviewed}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${w.p === INDEX ? '0.6' : '0.5'}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${absOf(w.p)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${absOf(w.p)}"/>
  </url>`).join('\n');
const block = `${START}\n${urls}\n${END}`;
if (xml.includes(START)) xml = xml.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
else if (xml.includes('<!-- SEO-BUILD:START -->')) xml = xml.replace('<!-- SEO-BUILD:START -->', `${block}\n<!-- SEO-BUILD:START -->`);
else throw new Error('sitemap anchor not found');
fs.writeFileSync(smPath, xml, 'utf8');

for (const w of written) console.log(`${w.indexable ? 'index  ' : 'NOINDEX'} ${w.rel}${w.n !== null ? `  (${w.n} entries)` : ''}`);
console.log(`sitemap: ${written.filter((w) => w.indexable).length} ecosystem URLs (as of ${TODAY})`);
