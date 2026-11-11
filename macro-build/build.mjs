// Builds data/macro.json (Virtuse Brief: By the numbers, ticker, central banks,
// "Coming up" calendar) and data/btc-treasuries.json (Bitcoin Data: public
// companies holding Bitcoin). Node 18+, no dependencies, no API keys.
// Run: node macro-build/build.mjs
//
// Every figure carries its source and date. A source that fails keeps the
// value from the previous file (marked stale: true) instead of dropping it.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'Kimi_Agent_Virtuse%20MiCA%20Partners');
const OUT = join(SITE, 'data', 'macro.json');
const OUT_TREAS = join(SITE, 'data', 'btc-treasuries.json');
const MEETINGS = JSON.parse(readFileSync(join(ROOT, 'macro-build', 'meetings.json'), 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; virtuse-macro-build)' };

function readPrev(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; } }
function sameData(p, data) {
  if (!existsSync(p)) return false;
  try {
    const { generated: _a, ...prev } = JSON.parse(readFileSync(p, 'utf8'));
    const { generated: _b, ...next } = data;
    return JSON.stringify(prev) === JSON.stringify(next);
  } catch { return false; }
}
async function get(url, kind = 'json', tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      return kind === 'json' ? await r.json() : await r.text();
    } catch (e) { err = e; await new Promise((res) => setTimeout(res, 2000 * (i + 1))); }
  }
  throw err;
}
const isoDay = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

// ---- daily quotes (Yahoo Finance, last daily close) --------------------------
const QUOTES = {
  spx: ['^GSPC', 'S&P 500', 2],
  eurusd: ['EURUSD=X', 'EUR/USD', 4],
  gold: ['GC=F', 'Gold (USD/oz)', 1],
  brent: ['BZ=F', 'Brent (USD/bbl)', 2],
  us10y: ['^TNX', 'US 10Y yield (%)', 3],
};
async function quote(sym, dp) {
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10d&interval=1d`);
  const r = j.chart.result[0];
  const ts = r.timestamp; const c = r.indicators.quote[0].close;
  const rows = ts.map((t, i) => [t, c[i]]).filter((x) => x[1] != null);
  const [t1, v1] = rows[rows.length - 1]; const [, v0] = rows[rows.length - 2];
  return { value: round(v1, dp), prev: round(v0, dp), change_pct: round((v1 / v0 - 1) * 100, 2), date: isoDay(t1),
    source: 'Yahoo Finance', source_url: `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}` };
}

// ---- inflation ---------------------------------------------------------------
// US: BLS CPI-U. y/y is the not-seasonally-adjusted 12-month change, shown only
// for months where BLS has the year-ago index (BLS did not publish y/y for
// October 2026: October 2025 was never collected). m/m is the seasonally
// adjusted change, as in the BLS release.
const BLS_FAQ = 'https://www.bls.gov/cpi/additional-resources/2025-federal-government-shutdown-impact-cpi-faq.htm';
async function blsIndex(series) {
  const y = new Date().getUTCFullYear();
  const j = await get(`https://api.bls.gov/publicAPI/v1/timeseries/data/${series}?startyear=${y - 2}&endyear=${y}`);
  const idx = {};
  for (const d of j.Results.series[0].data) if (/^M(0\d|1[0-2])$/.test(d.period) && d.value !== '-') idx[`${d.year}-${d.period.slice(1)}`] = parseFloat(d.value);
  return idx;
}
function prevMonth(m) { const [y, mm] = m.split('-').map(Number); return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`; }
async function usCpi() {
  const [nsa, sa, core] = await Promise.all([blsIndex('CUUR0000SA0'), blsIndex('CUSR0000SA0'), blsIndex('CUSR0000SA0L1E')]);
  const months = Object.keys(nsa).sort().reverse();
  const latest = months[0];
  let yoy = null;
  for (const m of months) {
    const [yy, mm] = m.split('-');
    const prev = nsa[`${+yy - 1}-${mm}`];
    if (prev) { yoy = { value: round((nsa[m] / prev - 1) * 100, 1), month: m }; break; }
  }
  if (!yoy) throw new Error('no US CPI year-on-year pair');
  const saM = Object.keys(sa).sort().reverse()[0];
  const mom = sa[saM] && sa[prevMonth(saM)] ? round((sa[saM] / sa[prevMonth(saM)] - 1) * 100, 1) : null;
  const coreMom = core[saM] && core[prevMonth(saM)] ? round((core[saM] / core[prevMonth(saM)] - 1) * 100, 1) : null;
  const published = yoy.month === latest;
  return { value: yoy.value, month: yoy.month, yoy_published: published, latest_month: latest,
    mom, mom_month: saM, core_mom: coreMom,
    note: published ? null : `BLS did not publish a ${latest} y/y figure: the year-ago index was never collected (2025 shutdown).`,
    note_url: published ? null : BLS_FAQ,
    source: 'U.S. Bureau of Labor Statistics, CPI-U', source_url: 'https://www.bls.gov/cpi/' };
}
// Euro area and Slovakia: Eurostat HICP (ECOICOP 2), annual rate of change. A
// value Eurostat marks as estimated/provisional (the flash) carries flash: true.
async function hicp(geo) {
  const j = await get(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?geo=${geo}&unit=RCH_A&coicop18=TOTAL&lastTimePeriod=1`);
  const month = Object.keys(j.dimension.time.category.index)[0];
  const flag = (j.status && j.status['0']) || '';
  return { value: j.value['0'], month, flash: /[ep]/i.test(flag), status_flag: flag || null,
    source: `Eurostat, HICP ${geo === 'EA' ? 'euro area' : geo}`, source_url: 'https://ec.europa.eu/eurostat/web/hicp' };
}
const eaHicp = () => hicp('EA');
const skHicp = () => hicp('SK');

// ---- central banks -----------------------------------------------------------
// Last change in a [date, rate] series (dates = when the rate took effect).
function lastMove(hist, source_url) {
  for (let i = hist.length - 1; i > 0; i--) {
    const d = round((hist[i][1] - hist[i - 1][1]) * 100, 0);
    if (d !== 0) return { dir: d > 0 ? 'up' : 'down', bp: Math.abs(d), date: hist[i][0], effective: true, source_url };
  }
  return null;
}
// Market expectations: Kalshi (CFTC-regulated event exchange), public market
// data API. The scenario with the highest last traded price for the bank's
// next decision; price in USD = implied probability.
const KALSHI = { fed: 'KXFEDDECISION', ecb: 'KXCBDECISIONEU', boe: 'KXCBDECISIONENGLAND', boj: 'KXCBDECISIONJAPAN' };
function scenario(t) {
  t = String(t || '');
  if (/maintain|hold/i.test(t)) return { en: 'Hold', sk: 'Bez zmeny' };
  const m = t.match(/(hike|cut)\s*(more than\s*|>\s*)?(1-)?(\d+)\s*bps?/i);
  if (!m) return { en: t, sk: t };
  const up = /hike/i.test(m[1]); const more = !!m[2];
  const bp = `${more ? '>' : ''}${m[4]} bp`;
  return { en: `${up ? 'Hike' : 'Cut'} ${bp}`, sk: `${up ? 'Zvýšenie' : 'Zníženie'} o ${bp}` };
}
async function expects(bank, nextMeeting) {
  if (!nextMeeting) return null;
  const ev = await get(`https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=${KALSHI[bank]}&status=open`);
  const events = (ev.events || []).filter((e) => e.event_ticker);
  if (!events.length) return null;
  const want = nextMeeting.slice(2, 4) + ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][+nextMeeting.slice(5, 7) - 1];
  const e = events.find((x) => x.event_ticker.includes(`-${want}`));
  if (!e) return null;
  const mk = await get(`https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=${e.event_ticker}`);
  const ms = (mk.markets || []).map((m) => ({ t: m.yes_sub_title, p: parseFloat(m.last_price_dollars) })).filter((m) => !isNaN(m.p));
  if (!ms.length) return null;
  ms.sort((a, b) => b.p - a.p);
  const sc = scenario(ms[0].t);
  return { scenario: sc.en, scenario_sk: sc.sk, prob: Math.round(ms[0].p * 100), meeting: nextMeeting, as_of: new Date().toISOString().slice(0, 10),
    source: 'Kalshi prediction market', source_url: `https://kalshi.com/markets/${KALSHI[bank].toLowerCase()}` };
}

// ---- Europe card (manual items live in macro-build/europe.json) ---------------
const EUROPE = JSON.parse(readFileSync(join(ROOT, 'macro-build', 'europe.json'), 'utf8'));

async function fed() {
  const j = await get('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json');
  const r = j.refRates[0];
  const y = new Date().getUTCFullYear();
  const h = await get(`https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=${y - 2}-01-01&endDate=${r.effectiveDate}`);
  const hist = h.refRates.map((x) => [x.effectiveDate, x.targetRateTo]).sort((a, b) => a[0].localeCompare(b[0]));
  return { rate: `${r.targetRateFrom.toFixed(2)}–${r.targetRateTo.toFixed(2)}%`, low: r.targetRateFrom, high: r.targetRateTo, date: r.effectiveDate,
    last_move: lastMove(hist, 'https://www.federalreserve.gov/monetarypolicy/openmarket.htm'),
    label: 'Fed funds target', source: 'Federal Reserve Bank of New York', source_url: 'https://www.newyorkfed.org/markets/reference-rates/effr' };
}
async function ecb() {
  const y = new Date().getUTCFullYear();
  const csv = await get(`https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV?startPeriod=${y - 2}-01-01&format=csvdata`, 'text');
  const lines = csv.trim().split('\n'); const h = lines[0].split(',');
  const hist = lines.slice(1).map((l) => l.split(',')).map((v) => [v[h.indexOf('TIME_PERIOD')], parseFloat(v[h.indexOf('OBS_VALUE')])]);
  const [date, rate] = hist[hist.length - 1];
  return { rate: `${rate.toFixed(2)}%`, low: rate, high: rate, date,
    last_move: lastMove(hist, 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html'),
    label: 'Deposit facility rate', source: 'European Central Bank', source_url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html' };
}
async function boe() {
  const y = new Date().getUTCFullYear();
  const t = await get(`https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=01/Jan/${y - 2}&Dateto=now&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N`, 'text');
  const rows = t.trim().split('\n').map((l) => l.trim().split(',')).filter((x) => x.length === 2 && !isNaN(parseFloat(x[1])));
  const hist = rows.map(([d, v]) => [new Date(d + ' UTC').toISOString().slice(0, 10), parseFloat(v)]);
  const [date, rate] = hist[hist.length - 1];
  return { rate: `${rate.toFixed(2)}%`, low: rate, high: rate, date,
    last_move: lastMove(hist, 'https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate'),
    label: 'Bank Rate', source: 'Bank of England', source_url: 'https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate' };
}
// BoJ: the basic loan rate is set 0.25 pt above the policy rate (the guideline
// for the uncollateralized overnight call rate), so policy = basic loan − 0.25.
async function boj() {
  const y = new Date().getUTCFullYear();
  const j = await get(`https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=IR01&code=MADR1Z%40D&startDate=${y - 2}01`);
  const v = j.RESULTSET[0].VALUES;
  const hist = v.SURVEY_DATES.map((d, i) => [String(d), v.VALUES[i]]).filter((x) => x[1] !== null && x[1] !== '')
    .map(([d, val]) => [`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, round(val - 0.25, 2)]);
  const [date, rate] = hist[hist.length - 1];
  return { rate: `${rate.toFixed(2)}%`, low: rate, high: rate, date,
    last_move: lastMove(hist, 'https://www.boj.or.jp/en/mopo/mpmdeci/index.htm'),
    label: 'Policy rate (overnight call rate target)', source: 'Bank of Japan', source_url: 'https://www.boj.or.jp/en/mopo/index.htm' };
}

// ---- treasuries (CoinGecko public companies) --------------------------------
async function treasuries() {
  const j = await get('https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin');
  const companies = j.companies.filter((c) => c.total_holdings > 0)
    .sort((a, b) => b.total_holdings - a.total_holdings)
    .map((c) => ({ name: c.name, symbol: c.symbol, country: c.country || '', btc: Math.round(c.total_holdings),
      usd: Math.round(c.total_current_value_usd || 0), pct_supply: c.percentage_of_total_supply }));
  return { total_btc: Math.round(j.total_holdings), count: companies.length, companies,
    source: 'CoinGecko public-company treasuries', source_url: 'https://www.coingecko.com/en/treasuries/bitcoin' };
}

async function main() {
  const prev = readPrev(OUT);
  const today = new Date().toISOString().slice(0, 10);
  const out = { generated: new Date().toISOString(), quotes: {}, inflation: {}, central_banks: {}, calendar: [] };
  const keep = (group, key, fn) => fn().then((v) => { out[group][key] = v; })
    .catch((e) => { console.error(`${group}.${key}: ${e.message}`); if (prev[group] && prev[group][key]) out[group][key] = { ...prev[group][key], stale: true }; });
  const jobs = [];
  for (const [k, [sym, , dp]] of Object.entries(QUOTES)) jobs.push(keep('quotes', k, () => quote(sym, dp)));
  jobs.push(keep('inflation', 'us', usCpi), keep('inflation', 'ea', eaHicp), keep('inflation', 'sk', skHicp));
  for (const [k, fn] of Object.entries({ fed, ecb, boe, boj })) jobs.push(keep('central_banks', k, fn));
  await Promise.all(jobs);
  const DECISION_UTC = { fed: '19:00', ecb: '13:15', boe: '12:00', boj: '03:00' };
  for (const k of ['fed', 'ecb', 'boe', 'boj']) {
    const next = (MEETINGS[k] || []).find((d) => d >= today);
    if (!out.central_banks[k]) continue;
    out.central_banks[k].next_meeting = next || null;
    out.central_banks[k].calendar_url = MEETINGS.sources[k];
    try { out.central_banks[k].expects = await expects(k, next); }
    catch (e) {
      console.error(`expects.${k}: ${e.message}`);
      const p = prev.central_banks && prev.central_banks[k] && prev.central_banks[k].expects;
      out.central_banks[k].expects = p ? { ...p, stale: true } : null;
    }
  }
  const NAMES = { fed: ['Fed rate decision (FOMC)', 'Rozhodnutie Fedu (FOMC)'], ecb: ['ECB rate decision', 'Rozhodnutie ECB'],
    boe: ['Bank of England rate decision', 'Rozhodnutie Bank of England'], boj: ['Bank of Japan rate decision', 'Rozhodnutie Bank of Japan'] };
  const all = [];
  for (const k of Object.keys(NAMES)) for (const d of MEETINGS[k] || []) all.push({ date: d, time: `${d}T${DECISION_UTC[k]}:00Z`, kind: k, impact: 'high', title: NAMES[k][0], title_sk: NAMES[k][1], url: MEETINGS.sources[k] });
  for (const e of MEETINGS.events || []) all.push(e);
  all.sort((a, b) => (a.time || a.date).localeCompare(b.time || b.date));
  const nowIso = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  out.calendar = all.filter((e) => e.date >= today).slice(0, 8);
  out.recent_events = all.filter((e) => e.date >= weekAgo && (e.time || e.date) <= nowIso).slice(-6);
  out.europe = EUROPE;
  mkdirSync(dirname(OUT), { recursive: true });
  const missing = ['spx', 'eurusd', 'gold'].filter((k) => !out.quotes[k]);
  if (missing.length) throw new Error(`no data for ${missing.join(', ')}`);
  if (sameData(OUT, out)) console.log('macro.json unchanged'); else { writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n'); console.log('macro.json written'); }

  try {
    const t = await treasuries();
    const tr = { generated: new Date().toISOString(), as_of: today, ...t };
    const p = readPrev(OUT_TREAS);
    const { generated: _a, as_of: _b, ...a } = p; const { generated: _c, as_of: _d, ...b } = tr;
    if (JSON.stringify(a) === JSON.stringify(b)) console.log('btc-treasuries.json unchanged');
    else { writeFileSync(OUT_TREAS, JSON.stringify(tr) + '\n'); console.log(`btc-treasuries.json written: ${t.count} companies`); }
  } catch (e) { console.error(`treasuries: ${e.message}`); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
