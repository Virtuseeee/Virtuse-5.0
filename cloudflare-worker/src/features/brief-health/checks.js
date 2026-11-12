// Daily health check of the Virtuse Brief (audits/brief-audit-2026-11-12.md, V6).
// Returns the list of problems as readable strings (empty = healthy):
//  - Pulse: published today, has items, every item has Slovak copy;
//  - data files the page reads (asset returns, macro): not older than a few days;
//  - the newest blog posts (EN + SK) have their story page on virtuse.com.
// It only reads. `fetchImpl` and `now` are parameters, so tests need no network.

export const PULSE_MAX_AGE_H = 4; // the cron runs about 1-2 h after the 06:25 publish
export const DATA_MAX_AGE_DAYS = 4; // covers a weekend plus a holiday
const POST_MIN_AGE_H = 8; // give the Stories build and the upload time
const POST_MAX_AGE_DAYS = 14;

const SITE = 'https://virtuse.com';
const RAW = 'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/';
const WP = 'https://blog.virtuse.com';
const FEEDS = [
  { lang: 'en', api: '/wp-json/wp/v2/posts?categories=13,15', base: '/stories/' },
  { lang: 'sk', api: '/sk/wp-json/wp/v2/posts?categories=26', base: '/sk/stories/' },
];

const hours = (ms) => Math.round((ms / 36e5) * 10) / 10;
const filled = (v) => typeof v === 'string' && v.trim().length > 0;

export function pulseProblems(raw, now) {
  if (!raw) return ['Pulse: nothing is published (KV "current" is empty).'];
  let d;
  try {
    d = JSON.parse(raw);
  } catch {
    return ['Pulse: the stored document is not valid JSON.'];
  }
  const out = [];
  const t = Date.parse(d.updated);
  if (!Number.isFinite(t)) out.push('Pulse: "updated" is missing or not a date.');
  else if (now - t > PULSE_MAX_AGE_H * 36e5) out.push(`Pulse: last published ${hours(now - t)} h ago (${d.updated}); today's 06:25 publish did not arrive.`);
  const items = Array.isArray(d.items) ? d.items : [];
  if (!items.length) out.push('Pulse: no items.');
  items.forEach((it, i) => {
    if (!filled(it?.title_sk)) out.push(`Pulse: items[${i}] has no title_sk (the Slovak page shows English with an "EN" mark).`);
    else if (filled(it?.excerpt) && !filled(it?.excerpt_sk)) out.push(`Pulse: items[${i}] has title_sk but no excerpt_sk (the Slovak page shows no excerpt).`);
  });
  (Array.isArray(d.archive?.items) ? d.archive.items : []).forEach((it, i) => {
    if (!filled(it?.title_sk)) out.push(`Pulse: archive.items[${i}] has no title_sk.`);
  });
  return out;
}

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url, { headers: { 'User-Agent': 'virtuse-brief-health', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function dataProblems(fetchImpl, now) {
  const out = [];
  const max = DATA_MAX_AGE_DAYS * 864e5;
  for (const [file, field] of [['asset-returns.json', 'asOf'], ['macro.json', 'generated']]) {
    try {
      const d = await getJson(fetchImpl, RAW + file);
      const t = Date.parse(d?.[field]);
      if (!Number.isFinite(t)) out.push(`Data: ${file} has no "${field}".`);
      else if (now - t > max) out.push(`Data: ${file} is ${Math.floor((now - t) / 864e5)} days old (${d[field]}); the daily data Action is not updating it.`);
    } catch (e) {
      out.push(`Data: ${file} could not be read from GitHub (${e.message}).`);
    }
  }
  return out;
}

async function storyProblems(fetchImpl, now) {
  const out = [];
  for (const feed of FEEDS) {
    let posts;
    try {
      posts = await getJson(fetchImpl, `${WP}${feed.api}&per_page=5&orderby=date&order=desc&_fields=slug,date_gmt,link`);
    } catch (e) {
      out.push(`Stories (${feed.lang}): WordPress did not answer (${e.message}).`);
      continue;
    }
    for (const p of Array.isArray(posts) ? posts : []) {
      const age = now - Date.parse(`${p.date_gmt}Z`);
      if (!p.slug || !Number.isFinite(age) || age < POST_MIN_AGE_H * 36e5 || age > POST_MAX_AGE_DAYS * 864e5) continue;
      const url = `${SITE}${feed.base}${encodeURIComponent(p.slug)}/`;
      try {
        const res = await fetchImpl(url, { method: 'HEAD', redirect: 'manual', headers: { 'User-Agent': 'virtuse-brief-health' } });
        if (res.status !== 200) out.push(`Stories (${feed.lang}): ${url} answers ${res.status}. The post (${p.link}) has no story page on production; run the Stories build and deploy_site.sh.`);
      } catch (e) {
        out.push(`Stories (${feed.lang}): ${url} could not be checked (${e.message}).`);
      }
    }
  }
  return out;
}

export async function briefHealthProblems({ pulseRaw, fetchImpl, now }) {
  return [...pulseProblems(pulseRaw, now), ...(await dataProblems(fetchImpl, now)), ...(await storyProblems(fetchImpl, now))];
}
