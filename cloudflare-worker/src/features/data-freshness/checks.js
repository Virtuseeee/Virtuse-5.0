// Daily data freshness check (audits/data-freshness-2026-11-26.md, bod 3).
// Used twice: by the Worker cron (handler.js) and by the GitHub Action
// (.github/workflows/data-freshness.yml via scripts/data-freshness.mjs).
// It only reads. `fetchImpl` and `now` are parameters, so tests need no network.
//
// Returns { problems, notes }:
//  - problems: readable sentences; any problem = alert (email / red Action run);
//  - notes: informative lines, never an alert on their own.
//
// What it compares:
//  1. the five daily data files on GitHub main (the source the pages read first)
//     must not be older than SOURCE_MAX_AGE_DAYS;
//  2. only with checkProdCopy: the copy on virtuse.com/data/ must not be more than
//     PROD_LAG_MAX_DAYS behind main (today it is 10 days behind: off by default);
//  3. the Pulse (Worker /pulse.json or KV): brief-health's rule, measured at the latest
//     06:40 UTC (the cron time) and not at "now", so a run later in the day does not fail
//     on a Pulse that arrived on time;
//  4. the Pulse fallback news/news-pulse.json on virtuse.com: a note when older
//     than PULSE_FALLBACK_NOTE_DAYS;
//  5. funds-vs-bitcoin.json (manual file): a note with its age only.

import { pulseProblems } from '../brief-health/checks.js';

export const SOURCE_MAX_AGE_DAYS = 2;
export const PROD_LAG_MAX_DAYS = 2;
export const PULSE_FALLBACK_NOTE_DAYS = 7;

export const RAW = 'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/';
export const PROD = 'https://virtuse.com/data/';
export const PULSE_URL = 'https://virtuse-newsletter.virtuse-ai.workers.dev/pulse.json';
export const PULSE_FALLBACK_URL = 'https://virtuse.com/news/news-pulse.json';

// The daily files written by asset-returns.yml and commodities.yml, and the date field
// each page shows as "Data as of". macro.json has no asOf: its generated date is used.
export const DAILY_FILES = [
  { file: 'asset-returns.json', fields: ['asOf'] },
  { file: 'bitcoin-vs-commodities.json', fields: ['asOf'] },
  { file: 'btc-monthly-returns.json', fields: ['asOf'] },
  { file: 'btc-treasuries.json', fields: ['as_of', 'asOf'] },
  { file: 'macro.json', fields: ['generated'] },
];
const FUNDS = { file: 'funds-vs-bitcoin.json', fields: ['asOf'] };

const DAY = 864e5;
const PULSE_DUE_UTC_MIN = 6 * 60 + 40; // 06:40 UTC, the cron (wrangler.toml)

// The latest 06:40 UTC at or before `now`.
export function pulseReference(now) {
  const d = new Date(now);
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + PULSE_DUE_UTC_MIN * 6e4;
  return t <= now ? t : t - DAY;
}
const UA = { 'User-Agent': 'virtuse-data-freshness', Accept: 'application/json' };

// Today's calendar date in Bratislava (YYYY-MM-DD), the same zone news.js uses.
export function bratislavaDay(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}

// The data date of a file: the first field that holds a date, cut to YYYY-MM-DD.
export function dataDay(doc, fields) {
  for (const f of fields) {
    const v = doc?.[f];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && Number.isFinite(Date.parse(v.slice(0, 10)))) return { field: f, day: v.slice(0, 10) };
  }
  return null;
}

// Whole calendar days from `from` to `to` (both YYYY-MM-DD).
export const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function readDay(fetchImpl, base, spec) {
  try {
    const d = await getJson(fetchImpl, base + spec.file);
    const got = dataDay(d, spec.fields);
    if (!got) return { error: `has no readable "${spec.fields[0]}" date` };
    return got;
  } catch (e) {
    return { error: `could not be read (${e.message})` };
  }
}

export async function dataFreshnessProblems({ fetchImpl, now, checkProdCopy = false, pulseRaw } = {}) {
  const today = bratislavaDay(now);
  const problems = [];
  const notes = [];

  // 1 + 2: daily files, source on GitHub, then optionally the production copy.
  for (const spec of DAILY_FILES) {
    const src = await readDay(fetchImpl, RAW, spec);
    if (src.error) {
      problems.push(`Source: ${spec.file} on GitHub main ${src.error}.`);
      continue;
    }
    const age = daysBetween(src.day, today);
    if (age > SOURCE_MAX_AGE_DAYS) {
      problems.push(`Source: ${spec.file} on GitHub main is from ${src.day} (${age} days old, limit ${SOURCE_MAX_AGE_DAYS}); the daily data Action is not updating it.`);
    }
    if (!checkProdCopy) continue;
    const prod = await readDay(fetchImpl, PROD, spec);
    if (prod.error) {
      problems.push(`Production copy: virtuse.com/data/${spec.file} ${prod.error}.`);
      continue;
    }
    const lag = daysBetween(prod.day, src.day);
    if (lag > PROD_LAG_MAX_DAYS) {
      problems.push(`Production copy: virtuse.com/data/${spec.file} is from ${prod.day}, ${lag} days behind GitHub main (${src.day}); pages that fall back to it show old numbers.`);
    }
  }

  // 3: Pulse. The Worker cron passes the KV value; the Action passes nothing and reads the Worker.
  let raw = pulseRaw;
  if (raw === undefined) {
    try {
      const res = await fetchImpl(PULSE_URL, { headers: UA });
      raw = res.ok ? await res.text() : null;
      if (!res.ok) problems.push(`Pulse: ${PULSE_URL} answers HTTP ${res.status}.`);
    } catch (e) {
      raw = null;
      problems.push(`Pulse: ${PULSE_URL} could not be read (${e.message}).`);
    }
  }
  if (raw !== null || pulseRaw !== undefined) {
    const ref = pulseReference(now);
    let updated = '';
    try { updated = JSON.parse(raw)?.updated || ''; } catch { /* pulseProblems reports it */ }
    for (const p of pulseProblems(raw, ref)) {
      problems.push(p.startsWith('Pulse: last published')
        ? `Pulse: last published ${updated}; the ${new Date(ref).toISOString().slice(0, 10)} publish had not arrived by 06:40 UTC.`
        : p);
    }
  }

  // 4: Pulse fallback on the server (used when the Worker does not answer within 3 s).
  try {
    const d = await getJson(fetchImpl, PULSE_FALLBACK_URL);
    const got = dataDay(d, ['updated']);
    if (!got) notes.push('Pulse fallback: news/news-pulse.json has no readable "updated".');
    else {
      const age = daysBetween(got.day, today);
      if (age > PULSE_FALLBACK_NOTE_DAYS) notes.push(`Pulse fallback: news/news-pulse.json is from ${got.day} (${age} days old); the Brief shows it only when the Worker does not answer.`);
    }
  } catch (e) {
    notes.push(`Pulse fallback: news/news-pulse.json could not be read (${e.message}).`);
  }

  // 5: funds-vs-bitcoin.json, built by hand (funds-build/build.py); threshold is open question 5.
  const funds = await readDay(fetchImpl, RAW, FUNDS);
  if (funds.error) notes.push(`Funds: ${FUNDS.file} ${funds.error}.`);
  else notes.push(`Funds: ${FUNDS.file} data as of ${funds.day} (${daysBetween(funds.day, today)} days old); built by hand from the weekly ADSS report, no threshold set yet.`);

  return { problems, notes };
}
