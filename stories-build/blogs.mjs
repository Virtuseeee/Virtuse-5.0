/**
 * Static first view of the 10 blog list pages (blog.html, blog-sk.html,
 * <lang>/blog.html). Each page ships a pre-rendered lead story + cards that
 * its own script replaces with page 1 of the WordPress feed after load. Until
 * 2026-10-19 that snapshot was frozen (May/June posts), so every visit first
 * showed old stories and then swapped them. build.mjs calls refreshBlogs()
 * with the feeds it already fetched, so the snapshot is exactly what the
 * script will render: same posts, same order, same markup as makeCard() /
 * renderLead() in the page, so the swap is invisible.
 *
 * Per page, from its own `var CFG = {...}`: category (13 EN, 26 SK, 57 RU),
 * perPage, months, dateStyle, desks, articleBase, langSuffix. Rewrites:
 * the #featuredWrap lead (href, image, kicker, title, dek, date), the
 * #blogGrid cards (perPage - 1, like page 1 of the script), CFG.total /
 * CFG.totalPages and the header count. Idempotent; a page whose markers are
 * missing is skipped with a warning, never half-written.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE, decode, esc } from './common.mjs';

export const BLOG_PAGES = ['blog.html', 'blog-sk.html', 'cs/blog.html', 'de/blog.html', 'es/blog.html',
  'fr/blog.html', 'hu/blog.html', 'pl/blog.html', 'ru/blog.html', 'uk/blog.html'];

const LEAD_SIZES = '(max-width: 800px) calc(100vw - 32px), 730px';
const CARD_SIZES = '(max-width: 480px) calc(100vw - 32px), 410px';

// stripHtml() in the page: DOM textContent, trailing " […]" → "…", trimmed.
function stripHtml(s) {
  return decode(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s*\[…\]\s*$/, '…').trim();
}
function imgOf(p) {
  try { return p._embedded['wp:featuredmedia'][0].source_url || ''; } catch (e) { return ''; }
}
// srcsetOf() in the page: WordPress's smaller copies, same shape only.
function srcsetOf(p) {
  try {
    const m = p._embedded['wp:featuredmedia'][0], d = m.media_details, ratio = d.width / d.height, seen = {}, out = [];
    const all = Object.values(d.sizes || {});
    all.push({ width: d.width, height: d.height, source_url: m.source_url });
    for (const x of all) {
      if (!x || !x.width || !x.height || !x.source_url || seen[x.width]) continue;
      if (Math.abs(x.width / x.height - ratio) > 0.02 * ratio) continue;
      seen[x.width] = 1; out.push(x.source_url + ' ' + x.width + 'w');
    }
    return out.length > 1 ? out.join(', ') : '';
  } catch (e) { return ''; }
}
// fmtDate() in the page. WordPress `date` is site-local without a zone and the
// browser reads it as local time, so the calendar day is the string's own.
function fmtDate(iso, cfg) {
  const [Y, Mo, D] = iso.slice(0, 10).split('-').map(Number);
  const M = cfg.months[Mo - 1];
  return cfg.dateStyle === 'ymd' ? `${Y}. ${M} ${D}.` : cfg.dateStyle === 'dot' ? `${D}. ${M} ${Y}` : `${D} ${M} ${Y}`;
}
const hrefOf = (p, cfg) => cfg.articleBase + '?slug=' + encodeURIComponent(p.slug) + cfg.langSuffix;

function card(p, cfg, readLabel, deskName) {
  const src = imgOf(p), ss = srcsetOf(p);
  const media = src
    ? `<img loading="lazy" ${ss ? `sizes="${esc(CARD_SIZES)}" srcset="${esc(ss)}" ` : ''}src="${esc(src)}" alt="">`
    : '<div class="blog-card-empty">₿</div>';
  return `      <a class="blog-card" href="${esc(hrefOf(p, cfg))}">${media}<div class="blog-card-body">` +
    `<time>${esc(deskName + ' · ' + fmtDate(p.date, cfg))}</time><h3>${esc(stripHtml(p.title.rendered))}</h3>` +
    `<p class="card-dek">${esc(stripHtml(p.excerpt.rendered))}</p><span class="read">${esc(readLabel)} →</span></div></a>`;
}

function refreshPage(rel, feeds, inferDesk) {
  const file = path.join(SITE, rel);
  const html = fs.readFileSync(file, 'utf8');
  const cfgM = html.match(/var CFG = (\{.*?\});\n/);
  if (!cfgM) { console.warn(`blogs: ${rel}: CFG not found, skipped`); return false; }
  const cfg = JSON.parse(cfgM[1]);
  const posts = feeds[cfg.category];
  if (!posts || !posts.length) { console.warn(`blogs: ${rel}: no posts for category ${cfg.category}, skipped`); return false; }
  const deskName = (p) => cfg.desks[inferDesk(p).id];
  const [lead, ...rest] = posts.slice(0, cfg.perPage);
  const readM = html.match(/<span class="read">([^<]*?)\s*→<\/span>/);
  const readLabel = readM ? decode(readM[1]).trim() : 'Read';
  const total = posts.length, totalPages = Math.max(1, Math.ceil(total / cfg.perPage));

  let out = html;
  const swap = (re, fn, what) => {
    if (!re.test(out)) throw new Error(`${rel}: ${what} not found`);
    out = out.replace(re, fn);
  };
  try {
    swap(/(<a class="lead" id="featuredWrap" href=")[^"]*(")/, (m, a, b) => a + esc(hrefOf(lead, cfg)) + b, 'lead href');
    if (imgOf(lead)) {
      const ss = srcsetOf(lead);
      swap(/<img id="leadImg"[^>]*>/, () => `<img id="leadImg" src="${esc(imgOf(lead))}"` +
        (ss ? ` srcset="${esc(ss)}" sizes="${esc(LEAD_SIZES)}"` : '') + ' alt="" loading="eager">', 'lead image');
    }
    swap(/(<p class="lead-kicker" id="leadKicker">)[^<]*(<\/p>)/, (m, a, b) => a + esc(deskName(lead)) + b, 'lead kicker');
    swap(/(<h2 class="lead-title" id="leadTitle">)[\s\S]*?(<\/h2>)/, (m, a, b) => a + esc(stripHtml(lead.title.rendered)) + b, 'lead title');
    swap(/(<p class="lead-dek" id="leadDek">)[\s\S]*?(<\/p>)/, (m, a, b) => a + esc(stripHtml(lead.excerpt.rendered)) + b, 'lead dek');
    swap(/(<span id="leadDate">)[^<]*(<\/span>)/, (m, a, b) => a + esc(fmtDate(lead.date, cfg)) + b, 'lead date');
    swap(/(<div class="blog-grid" id="blogGrid">\n)[\s\S]*?(\n\s*<\/div>\n\s*<div class="load-wrap">)/,
      (m, a, b) => a + rest.map((p) => card(p, cfg, readLabel, deskName(p))).join('\n') + b, 'blog grid');
    // Only the two numbers inside CFG (the rest of the JSON stays byte for byte), and the header count.
    swap(/("total": )\d+(, "totalPages": )\d+/, (m, a, b) => a + total + b + totalPages, 'CFG counts');
    swap(/(id="postCount"[^>]*><b>)\d+(<\/b>)/, (m, a, b) => a + total + b, 'post count');
  } catch (e) {
    console.warn('blogs: ' + e.message + ', skipped');
    return false;
  }
  if (out === html) return false;
  fs.writeFileSync(file, out);
  return true;
}

// feeds: { [category]: posts in WordPress order (date desc) }
export function refreshBlogs(feeds, inferDesk) {
  const changed = BLOG_PAGES.filter((rel) => refreshPage(rel, feeds, inferDesk));
  console.log(`blogs: ${BLOG_PAGES.length} pages, ${changed.length} updated`);
  return changed;
}
