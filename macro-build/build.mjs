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
// US: BLS CPI-U, not seasonally adjusted (the headline 12-month figure). Latest
// month that has a year-ago index (October 2025 was never collected).
async function usCpi() {
  const y = new Date().getUTCFullYear();
  const j = await get(`https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0?startyear=${y - 2}&endyear=${y}`);
  const idx = {};
  for (const d of j.Results.series[0].data) if (/^M(0\d|1[0-2])$/.test(d.period) && d.value !== '-') idx[`${d.year}-${d.period.slice(1)}`] = parseFloat(d.value);
  const months = Object.keys(idx).sort().reverse();
  for (const m of months) {
    const [yy, mm] = m.split('-');
    const prev = idx[`${+yy - 1}-${mm}`];
    if (prev) return { value: round((idx[m] / prev - 1) * 100, 1), month: m, latest_index_month: months[0],
      source: 'U.S. Bureau of Labor Statistics, CPI-U', source_url: 'https://www.bls.gov/cpi/' };
  }
  throw new Error('no US CPI year-on-year pair');
}
// Euro area: Eurostat HICP (ECOICOP 2), annual rate of change, flash included.
async function eaHicp() {
  const j = await get('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?geo=EA&unit=RCH_A&coicop18=TOTAL&lastTimePeriod=1');
  const month = Object.keys(j.dimension.time.category.index)[0];
  return { value: j.value['0'], month, source: 'Eurostat, HICP euro area', source_url: 'https://ec.europa.eu/eurostat/web/hicp' };
}

// ---- central banks -----------------------------------------------------------
async function fed() {
  const j = await get('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json');
  const r = j.refRates[0];
  return { rate: `${r.targetRateFrom.toFixed(2)}–${r.targetRateTo.toFixed(2)}%`, low: r.targetRateFrom, high: r.targetRateTo, date: r.effectiveDate,
    label: 'Fed funds target', source: 'Federal Reserve Bank of New York', source_url: 'https://www.newyorkfed.org/markets/reference-rates/effr' };
}
async function ecb() {
  const csv = await get('https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV?lastNObservations=1&format=csvdata', 'text');
  const [head, row] = csv.trim().split('\n');
  const h = head.split(','); const v = row.split(',');
  const rate = parseFloat(v[h.indexOf('OBS_VALUE')]);
  return { rate: `${rate.toFixed(2)}%`, low: rate, high: rate, date: v[h.indexOf('TIME_PERIOD')],
    label: 'Deposit facility rate', source: 'European Central Bank', source_url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html' };
}
async function boe() {
  const t = await get('https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=01/Jan/2026&Dateto=now&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N', 'text');
  const rows = t.trim().split('\n').map((l) => l.split(',')).filter((x) => x.length === 2 && !isNaN(parseFloat(x[1])));
  const [d, v] = rows[rows.length - 1];
  const rate = parseFloat(v);
  return { rate: `${rate.toFixed(2)}%`, low: rate, high: rate, date: new Date(d + ' UTC').toISOString().slice(0, 10),
    label: 'Bank Rate', source: 'Bank of England', source_url: 'https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate' };
}
// BoJ: the basic loan rate is set 0.25 pt above the policy rate (the guideline
// for the uncollateralized overnight call rate), so policy = basic loan − 0.25.
async function boj() {
  const y = new Date().getUTCFullYear();
  const j = await get(`https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=IR01&code=MADR1M&startDate=${y - 1}01`);
  const v = j.RESULTSET[0].VALUES; const n = v.VALUES.length - 1;
  const rate = round(v.VALUES[n] - 0.25, 2); const ym = String(v.SURVEY_DATES[n]);
  return { rate: `${rate.toFixed(2)}%`, low: rate, high: rate, date: `${ym.slice(0, 4)}-${ym.slice(4, 6)}`,
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
  jobs.push(keep('inflation', 'us', usCpi), keep('inflation', 'ea', eaHicp));
  for (const [k, fn] of Object.entries({ fed, ecb, boe, boj })) jobs.push(keep('central_banks', k, fn));
  await Promise.all(jobs);
  for (const k of ['fed', 'ecb', 'boe', 'boj']) {
    const next = (MEETINGS[k] || []).find((d) => d >= today);
    if (out.central_banks[k]) { out.central_banks[k].next_meeting = next || null; out.central_banks[k].calendar_url = MEETINGS.sources[k]; }
  }
  const NAMES = { fed: 'Fed rate decision (FOMC)', ecb: 'ECB rate decision', boe: 'Bank of England rate decision', boj: 'Bank of Japan rate decision' };
  const cal = [];
  for (const k of Object.keys(NAMES)) for (const d of MEETINGS[k] || []) if (d >= today) cal.push({ date: d, title: NAMES[k], url: MEETINGS.sources[k] });
  for (const e of MEETINGS.events || []) if (e.date >= today) cal.push(e);
  out.calendar = cal.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
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
