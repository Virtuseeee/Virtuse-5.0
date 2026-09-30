#!/usr/bin/env node
/**
 * Pre-render one static page per blog story so social networks (which do
 * not run JavaScript) get that story's own preview card: title,
 * description, image, dates.
 *
 * Output (inside the site folder, same clean-URL style as seo-build):
 *   stories/<slug>/index.html        English feed (WP category 13)
 *   sk/stories/<slug>/index.html     Slovak feed (category 26)
 *   ru/stories/<post-id>/index.html  Russian feed (category 57; slugs are
 *                                    Cyrillic, so the post id is used)
 *
 * Each page is article.html with the head filled in (title, description,
 * canonical, Open Graph, Twitter, JSON-LD), the title / dek / image /
 * desk pre-rendered, relative URLs rewritten for the folder depth, and
 * data-root / data-slug / data-lang / data-story on <html>. The story body
 * itself still loads from WordPress through article.js, exactly as on
 * article.html (the WordPress originals on blog.virtuse.com stay the only
 * full-text copy).
 *
 * Stories that disappear from WordPress get their folders removed; the list
 * of generated folders lives in stories-build/manifest.json.
 *
 * Usage (from the repo root):  node stories-build/build.mjs
 * Needs Node 18+ (global fetch) and network access to blog.virtuse.com.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners');
const ORIGIN = 'https://virtuse.com';
const MANIFEST = path.join(HERE, 'manifest.json');
const SITEMAP_START = '<!-- STORIES-BUILD:START -->';
const SITEMAP_END = '<!-- STORIES-BUILD:END -->';
const FALLBACK_IMAGE = { url: ORIGIN + '/news/og-card.png?v=20260921', width: 1200, height: 630 };

const FEEDS = [
  { lang: 'en', api: 'https://blog.virtuse.com/wp-json/wp/v2/posts', category: 13, wpLang: 'en', dir: '', locale: 'en_US' },
  { lang: 'sk', api: 'https://blog.virtuse.com/sk/wp-json/wp/v2/posts', category: 26, wpLang: null, dir: 'sk/', locale: 'sk_SK' },
  { lang: 'ru', api: 'https://blog.virtuse.com/wp-json/wp/v2/posts', category: 57, wpLang: 'ru', dir: 'ru/', locale: 'ru_RU' },
];
// Desk names for the pre-rendered kicker (article.js replaces it on load
// with the same value). Taken from article.js's LANGS.
const DESK_NAMES = {
  en: { mining: 'Mining', treasury: 'Treasury', custody: 'Custody', policy: 'Policy', macro: 'Macro', markets: 'Markets' },
  sk: { mining: 'Ťažba', treasury: 'Treasury', custody: 'Úschova', policy: 'Regulácia', macro: 'Makro', markets: 'Trhy' },
  ru: { mining: 'Майнинг', treasury: 'Treasury', custody: 'Кастоди', policy: 'Регулирование', macro: 'Макро', markets: 'Рынки' },
};

// ---- helpers ---------------------------------------------------------------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', hellip: '…', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', bull: '•' };
function decode(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
const text = (html) => decode(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function clip(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > n * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[,;:.\s]+$/, '') + '…';
}
const storyKey = (post) => (/^[a-z0-9-]+$/.test(post.slug) ? post.slug : String(post.id));

// Desk inference: run the exact code from brief-chrome.js (single source).
function loadDeskInference() {
  const src = fs.readFileSync(path.join(SITE, 'brief-chrome.js'), 'utf8');
  const start = src.indexOf('/* Desks:');
  if (start < 0) throw new Error('desk block not found in brief-chrome.js');
  const window = {};
  const DOMParser = function () { this.parseFromString = (s) => ({ body: { textContent: text(s) } }); };
  vm.runInNewContext(src.slice(start), { window, DOMParser });
  return window.VB_inferDesk;
}

// blog.virtuse.com answers these queries in 8-18 s and sometimes errors or
// stalls under load, so a request gets 90 s and up to 5 tries with a longer
// wait each time (10, 20, 40, 80 s) before the build gives up.
async function getJSON(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'virtuse-stories-build' },
        signal: AbortSignal.timeout(90000),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return { data: await r.json(), totalPages: parseInt(r.headers.get('x-wp-totalpages') || '1', 10) };
    } catch (e) {
      if (attempt >= 5) throw e;
      console.warn(`attempt ${attempt} failed (${e.message}${e.cause ? ' / ' + (e.cause.code || e.cause) : ''}), retrying: ${url}`);
      await new Promise((ok) => setTimeout(ok, 10000 * 2 ** (attempt - 1)));
    }
  }
}

async function fetchFeed(feed) {
  const posts = [];
  for (let page = 1, total = 1; page <= total; page++) {
    const url = `${feed.api}?categories=${feed.category}&per_page=100&page=${page}&_embed=wp:featuredmedia` +
      `&orderby=date&order=desc${feed.wpLang ? '&lang=' + feed.wpLang : ''}`;
    const { data, totalPages } = await getJSON(url);
    total = totalPages;
    posts.push(...data);
  }
  return posts;
}

// ---- page building ---------------------------------------------------------
function imageOf(post) {
  const y = post.yoast_head_json && post.yoast_head_json.og_image && post.yoast_head_json.og_image[0];
  if (y && y.url) return { url: y.url, width: y.width, height: y.height };
  try {
    const m = post._embedded['wp:featuredmedia'][0];
    if (m.source_url) return { url: m.source_url, width: m.media_details?.width, height: m.media_details?.height };
  } catch (e) { /* no featured image */ }
  return null;
}
function descriptionOf(post) {
  const y = post.yoast_head_json && (post.yoast_head_json.og_description || post.yoast_head_json.description);
  const d = y ? decode(y).trim() : text(post.excerpt && post.excerpt.rendered).replace(/\s*\[…\]\s*$/, '');
  return clip(d || 'Bitcoin analysis from the Virtuse Brief desk.', 200);
}

function render(template, feed, post, inferDesk) {
  const key = storyKey(post);
  const storyPath = `${feed.dir}stories/${key}/`;
  const root = '../'.repeat(storyPath.split('/').filter(Boolean).length);
  const url = ORIGIN + '/' + storyPath;
  const title = text(post.title.rendered);
  const description = descriptionOf(post);
  const img = imageOf(post);
  const ogImg = img || FALLBACK_IMAGE;
  const published = new Date(post.date_gmt + 'Z').toISOString();
  const modified = new Date((post.modified_gmt || post.date_gmt) + 'Z').toISOString();
  const desk = DESK_NAMES[feed.lang][inferDesk(post).id];

  let h = template;
  const sub = (re, fn, label) => {
    if (!re.test(h)) throw new Error('template anchor not found: ' + label);
    h = h.replace(re, fn);
  };

  // Relative href/src in markup -> relative to this folder depth. data-hub
  // values stay site-relative (article.js prefixes them with data-root).
  h = h.replace(/\b(href|src)="(?!https?:|\/\/|#|data:|mailto:|javascript:)([^"]*)"/g, (m, a, v) => `${a}="${root}${v}"`);

  sub(/<html lang="en" /, () =>
    `<html lang="${feed.lang}" data-root="${root}" data-slug="${esc(post.slug)}" data-lang="${feed.lang}" data-story="${esc(storyPath)}" `, 'html');

  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: title, description, inLanguage: feed.lang,
    datePublished: published, dateModified: modified,
    mainEntityOfPage: url, url,
    image: ogImg.url,
    author: { '@type': 'Person', name: 'Ras Vasilisin', url: ORIGIN + '/about.html' },
    publisher: { '@type': 'Organization', name: 'Virtuse', url: ORIGIN + '/', logo: { '@type': 'ImageObject', url: ORIGIN + '/news/brief-nav-logo.png' } },
  };
  const head = [
    `<title>${esc(title)} · Virtuse Brief</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta name="author" content="Ras Vasilisin">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Virtuse Brief">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${esc(ogImg.url)}">`,
    ogImg.width ? `<meta property="og:image:width" content="${ogImg.width}">` : '',
    ogImg.height ? `<meta property="og:image:height" content="${ogImg.height}">` : '',
    `<meta property="og:image:alt" content="${esc(title)}">`,
    `<meta property="og:locale" content="${feed.locale}">`,
    `<meta property="article:published_time" content="${published}">`,
    `<meta property="article:modified_time" content="${modified}">`,
    `<meta property="article:author" content="Ras Vasilisin">`,
    `<meta property="article:section" content="${esc(desk)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(ogImg.url)}">`,
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n');
  // Replace the generic head block (title .. twitter:image) in one go.
  sub(/<title>[\s\S]*?<meta name="description"[^>]*>/, () => '<!--HEAD-->', 'title/description');
  h = h.replace(/<meta property="og:[^>]*>\n/g, '').replace(/<meta name="twitter:[^>]*>\n/g, '');
  h = h.replace('<!--HEAD-->', head);

  // Pre-rendered story head (article.js re-renders the same on load).
  sub(/(<p class="story-kicker" id="storyKicker">)[^<]*(<\/p>)/, (m, a, b) => a + esc(desk) + b, 'kicker');
  sub(/(<h1 class="story-title" id="articleTitle">)[\s\S]*?(<\/h1>)/, (m, a, b) => a + esc(title) + b, 'title');
  sub(/(<p class="story-dek" id="articleDek">)[\s\S]*?(<\/p>)/, (m, a, b) => a + esc(description) + b, 'dek');
  if (img) {
    sub(/<figure class="story-figure" id="articleHero" hidden>/, () => '<figure class="story-figure" id="articleHero">', 'hero');
    sub(/<img id="heroImg" alt="">/, () => `<img id="heroImg" src="${esc(img.url)}" alt="${esc(title)}"${img.width ? ` width="${img.width}" height="${img.height}"` : ''}>`, 'hero img');
  }
  return { storyPath, html: h, lastmod: modified.slice(0, 10) };
}

// ---- main ------------------------------------------------------------------
async function main() {
  const template = fs.readFileSync(path.join(SITE, 'article.html'), 'utf8');
  const inferDesk = loadDeskInference();
  const previous = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).stories || [] : [];
  const written = [];
  const lastmods = {};

  for (const feed of FEEDS) {
    const posts = await fetchFeed(feed);
    const seen = new Set();
    for (const post of posts) {
      const { storyPath, html, lastmod } = render(template, feed, post, inferDesk);
      if (seen.has(storyPath)) continue; // WP cross-posts can repeat a slug
      seen.add(storyPath);
      const file = path.join(SITE, storyPath, 'index.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (old !== html) fs.writeFileSync(file, html);
      written.push(storyPath);
      lastmods[storyPath] = lastmod;
    }
    console.log(`${feed.lang}: ${seen.size} stories`);
  }

  // Remove folders of stories that are no longer in WordPress. Only paths
  // this script created earlier (manifest) are ever deleted.
  const keep = new Set(written);
  const removed = previous.filter((p) => !keep.has(p));
  for (const p of removed) {
    const dir = path.join(SITE, p);
    if (/^(?:(?:sk|ru)\/)?stories\/[^/]+\/$/.test(p) && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  }
  // No build date in here: the scheduled Action should only commit when the
  // set of stories (or a page) actually changed.
  fs.writeFileSync(MANIFEST, JSON.stringify({ stories: written.sort() }, null, 2) + '\n');

  // sitemap.xml: our own marked block (seo-build keeps its SEO-BUILD block;
  // each generator only ever rewrites the text between its own markers).
  const sitemapFile = path.join(SITE, 'sitemap.xml');
  const xml = fs.readFileSync(sitemapFile, 'utf8');
  const block = [SITEMAP_START, ...written.map((p) => `  <url>
    <loc>${ORIGIN}/${p}</loc>
    <lastmod>${lastmods[p]}</lastmod>
  </url>`), SITEMAP_END].join('\n');
  let nextXml;
  if (xml.includes(SITEMAP_START) && xml.includes(SITEMAP_END)) {
    nextXml = xml.replace(new RegExp(`${SITEMAP_START}[\\s\\S]*?${SITEMAP_END}`), () => block);
  } else {
    if (!xml.includes('</urlset>')) throw new Error('sitemap.xml missing </urlset>');
    nextXml = xml.replace('</urlset>', `${block}\n</urlset>`);
  }
  if (nextXml !== xml) fs.writeFileSync(sitemapFile, nextXml);
  console.log(`sitemap.xml: ${written.length} story URLs${nextXml === xml ? ' (unchanged)' : ''}`);

  // Production upload batch for sftp (run from the gh-pages worktree, which
  // has the site at its root). Webglobe's scp does not create missing
  // remote directories, so every folder is created first; '-' makes sftp
  // ignore "already exists". Stale folders must be removed by hand (listed).
  const dirs = new Set();
  for (const p of written) {
    const parts = p.split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  const lines = [...dirs].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
    .filter((d) => !['sk', 'ru'].includes(d))
    .map((d) => `-mkdir public_html/${d}`);
  for (const p of written.sort()) lines.push(`put ${p}index.html public_html/${p}index.html`);
  lines.push('put sitemap.xml public_html/sitemap.xml');
  for (const p of removed) lines.push(`# removed from WordPress, delete on the server: public_html/${p}`);
  lines.push('bye');
  fs.writeFileSync(path.join(HERE, 'upload.sftp'), lines.join('\n') + '\n');
  console.log(`total ${written.length} pages; removed ${removed.length}`);
}

main().catch((e) => {
  console.error(e);
  // GitHub only shows job logs to signed-in users; annotations are public, so
  // surface the actual cause (HTTP status, timeout, DNS…) as one.
  if (process.env.GITHUB_ACTIONS) {
    const cause = e && e.cause ? ' | cause: ' + (e.cause.code || '') + ' ' + (e.cause.message || e.cause) : '';
    console.log('::error title=Stories build::' + String(e && e.message || e).replace(/\r?\n/g, ' ') + cause);
  }
  process.exit(1);
});
