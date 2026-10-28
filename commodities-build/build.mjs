// Builds data/bitcoin-vs-commodities.json for bitcoin-vs-gold.html (Bitcoin vs
// gold, silver, oil, copper, platinum and a commodities basket). Node 18+, no
// dependencies. Run: node commodities-build/build.mjs
//
// Returns come from ETF adjusted closes (total return, same method as
// asset-returns-build), spot prices and the BTC/gold and BTC/silver ratios from
// the front-month futures (GC=F, SI=F ...). Source: Yahoo Finance chart API,
// fallback for Bitcoin and the metals: Stooq CSV. Never Binance.
// The file is written only after every check passes, so a failed run leaves
// the last good file in place (the Action then fails with ::error).
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Kimi_Agent_Virtuse%20MiCA%20Partners', 'data', 'bitcoin-vs-commodities.json');
const START = '2016-01-01';          // first day of the comparison
const BASE_DATE = '2015-12-31';      // index = 100 here
const DAY = 864e5;

// `generated` = when the data last changed, not when the build last ran: a run
// whose numbers equal the committed file leaves the file untouched, so the
// Action has nothing to commit.
function sameData(path, data) {
  if (!existsSync(path)) return false;
  try {
    const { generated: _a, ...prev } = JSON.parse(readFileSync(path, 'utf8'));
    const { generated: _b, ...next } = data;
    return JSON.stringify(prev) === JSON.stringify(next);
  } catch { return false; }
}

// id, display name (English, the page translates by id), returns ticker (ETF),
// spot/futures ticker for the price + ratios, unit of the spot price.
const ASSETS = [
  { id: 'btc', name: 'Bitcoin', ret: 'BTC-USD', spot: 'BTC-USD', unit: 'BTC', stooqRet: 'btcusd', stooqSpot: 'btcusd' },
  { id: 'gold', name: 'Gold', ret: 'GLD', spot: 'GC=F', unit: 'oz', stooqSpot: 'xauusd' },
  { id: 'silver', name: 'Silver', ret: 'SLV', spot: 'SI=F', unit: 'oz', stooqSpot: 'xagusd' },
  { id: 'oil', name: 'WTI crude oil', ret: 'USO', spot: 'CL=F', unit: 'bbl', stooqSpot: 'cl.f' },
  { id: 'copper', name: 'Copper', ret: 'CPER', spot: 'HG=F', unit: 'lb', stooqSpot: 'hg.f' },
  { id: 'platinum', name: 'Platinum', ret: 'PPLT', spot: 'PL=F', unit: 'oz' },
  { id: 'basket', name: 'Commodities basket', ret: 'DBC', spot: null },
];

const ymd = t => new Date(t).toISOString().slice(0, 10);
const round = (x, d = 4) => x == null || !isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d;

async function yahoo(symbol) {
  const p1 = Math.floor(Date.UTC(2015, 10, 1) / 1000);
  const p2 = Math.floor(Date.now() / 1000) + 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div,splits`;
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (virtuse commodities build)' }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const res = j.chart.result[0];
      const adj = res.indicators.adjclose?.[0]?.adjclose || res.indicators.quote[0].close;
      const out = res.timestamp.map((t, k) => [ymd(t * 1000), adj[k]]).filter(([, v]) => v != null && v > 0);
      if (out.length < 100) throw new Error('too few rows');
      return out;
    } catch (e) { lastErr = e; await new Promise(s => setTimeout(s, 3000 * (i + 1))); }
  }
  throw new Error(`${symbol}: ${lastErr.message}`);
}

// Stooq daily CSV (no key): Date,Open,High,Low,Close,Volume. Fallback only.
async function stooq(symbol) {
  const r = await fetch(`https://stooq.com/q/d/l/?s=${symbol}&i=d`, { headers: { 'User-Agent': 'Mozilla/5.0 (virtuse commodities build)' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`stooq ${symbol}: HTTP ${r.status}`);
  const lines = (await r.text()).trim().split('\n').slice(1);
  const out = lines.map(l => l.split(',')).filter(c => c.length >= 5 && c[0] >= '2015-11-01' && +c[4] > 0).map(c => [c[0], +c[4]]);
  if (out.length < 100) throw new Error(`stooq ${symbol}: too few rows`);
  return out;
}

async function series(symbol, stooqSymbol) {
  try { return await yahoo(symbol); } catch (e) {
    if (!stooqSymbol) throw e;
    console.warn(`${symbol}: ${e.message}; using Stooq ${stooqSymbol}`);
    return stooq(stooqSymbol);
  }
}

// value on or before a date (series sorted by date)
function at(ser, date) {
  let lo = 0, hi = ser.length - 1, ans = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (ser[m][0] <= date) { ans = ser[m][1]; lo = m + 1; } else hi = m - 1; }
  return ans;
}
function lastOfYear(ser, y) { return at(ser, `${y}-12-31`); }
function shift(date, years) { const d = new Date(date + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() - years); return ymd(d); }

async function main() {
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const years = []; for (let y = 2016; y <= thisYear; y++) years.push(y);

  const fx = await series('EURUSD=X');        // USD per 1 EUR
  const ret = {}, spot = {};
  for (const a of ASSETS) {
    ret[a.id] = await series(a.ret, a.stooqRet);
    if (a.spot) spot[a.id] = a.spot === a.ret ? ret[a.id] : await series(a.spot, a.stooqSpot);
  }

  // master calendar: gold ETF trading days from the base date; Bitcoin and FX are
  // forward-filled onto it. asOf = the newest date where both BTC and gold have a close.
  const gold = ret.gold;
  const cal = gold.map(x => x[0]).filter(d => d >= BASE_DATE);
  const lastBtc = ret.btc[ret.btc.length - 1][0], lastGold = gold[gold.length - 1][0];
  const asOf = lastBtc < lastGold ? lastBtc : lastGold;
  const calUpTo = cal.filter(d => d <= asOf);
  if (calUpTo.length < 2000) throw new Error(`calendar too short: ${calUpTo.length}`);
  const last = calUpTo[calUpTo.length - 1];
  const fxAt = d => at(fx, d);

  const assets = [];
  for (const a of ASSETS) {
    const s = ret[a.id];
    const base = at(s, BASE_DATE);
    if (!base) throw new Error(`${a.id}: no close at ${BASE_DATE}`);
    const v = at(s, last);
    const usd = (d0, d1) => at(s, d1) / at(s, d0) - 1;
    const eur = (d0, d1) => (at(s, d1) / fxAt(d1)) / (at(s, d0) / fxAt(d0)) - 1;
    const span = (d0, n) => ({ usd: round(usd(d0, last)), eur: round(eur(d0, last)),
      usdPa: n ? round(Math.pow(1 + usd(d0, last), 1 / n) - 1) : undefined, eurPa: n ? round(Math.pow(1 + eur(d0, last), 1 / n) - 1) : undefined });
    const yEnd = `${thisYear - 1}-12-31`;
    const periods = { ytd: span(yEnd), y1: span(shift(last, 1)), y5: span(shift(last, 5), 5), y10: span(shift(last, 10), 10) };
    const annual = {}, exact = [];
    for (const y of years) {
      const d0 = `${y - 1}-12-31`, d1 = y === thisYear ? last : `${y}-12-31`;
      exact.push(usd(d0, d1));
      annual[y] = { usd: round(usd(d0, d1)), eur: round(eur(d0, d1)) };
    }
    // check: chained annual returns = cumulative since the base date
    const chained = exact.reduce((p, r) => p * (1 + r), 1) - 1;
    const cum = usd(BASE_DATE, last);
    if (Math.abs(chained - cum) > 1e-6 * (1 + Math.abs(cum))) throw new Error(`${a.id}: chained annual ${chained} != cumulative ${cum}`);
    const row = { id: a.id, name: a.name, ticker: a.ret, periods, annual, cumulative: { usd: round(cum), eur: round(eur(BASE_DATE, last)) } };
    if (a.spot) {
      const sp = spot[a.id]; const [pd, pv] = sp[sp.length - 1];
      row.spot = { ticker: a.spot, unit: a.unit, usd: round(pv, 2), eur: round(pv / fxAt(pd), 2), date: pd };
    }
    assets.push(row);
    console.log(a.id.padEnd(9), Object.entries(periods).map(([k, p]) => `${k} ${(p.usd * 100).toFixed(1)}%`).join('  '));
  }

  // growth index (USD, base 100 at BASE_DATE) on the calendar: weekly points for
  // the whole span, daily points for the last 400 days. fx per point for the EUR view.
  const idx = (a, d) => round(100 * at(ret[a.id], d) / at(ret[a.id], BASE_DATE), 3);
  const pack = dates => ({ dates, fx: dates.map(d => round(fxAt(d), 5)), ...Object.fromEntries(ASSETS.map(a => [a.id, dates.map(d => idx(a, d))])) });
  const weekly = [BASE_DATE];
  for (let i = 1; i < calUpTo.length; i++) {
    const d = new Date(calUpTo[i] + 'T00:00:00Z'), n = calUpTo[i + 1] ? new Date(calUpTo[i + 1] + 'T00:00:00Z') : null;
    const wk = x => Math.floor((x.getTime() - 4 * DAY) / (7 * DAY));      // weeks starting Monday
    if (!n || wk(n) !== wk(d)) weekly.push(calUpTo[i]);
  }
  const cutoff = ymd(new Date(last + 'T00:00:00Z').getTime() - 400 * DAY);
  const daily = calUpTo.filter(d => d >= cutoff);

  // BTC/gold and BTC/silver: ounces per bitcoin, from the futures closes, daily
  const ratio = {};
  for (const m of ['gold', 'silver']) {
    const sp = spot[m];
    const dates = sp.map(x => x[0]).filter(d => d >= BASE_DATE && d <= asOf);
    const values = dates.map(d => round(at(ret.btc, d) / at(sp, d), 2));
    const yearEnd = {}; for (const y of years) yearEnd[y] = round(at(ret.btc, y === thisYear ? last : `${y}-12-31`) / at(sp, y === thisYear ? last : `${y}-12-31`), 2);
    const lastV = values[values.length - 1];
    if (m === 'gold' && !(lastV > 1 && lastV < 200)) throw new Error(`BTC/gold ratio out of range: ${lastV}`);
    ratio[m] = { unit: 'oz', dates, values, yearEnd, current: lastV, asOf: dates[dates.length - 1] };
  }

  // no gaps in the last 5 calendar days for Bitcoin and gold
  const recent = ymd(now.getTime() - 5 * DAY);
  if (lastBtc < recent) throw new Error(`Bitcoin series ends ${lastBtc}`);
  if (lastGold < ymd(now.getTime() - 7 * DAY)) throw new Error(`gold ETF series ends ${lastGold}`);
  for (const d of calUpTo.slice(-5)) if (at(ret.btc, d) == null || at(gold, d) == null) throw new Error(`null close near ${d}`);

  const data = {
    generated: now.toISOString(),
    asOf: last,
    start: START,
    baseDate: BASE_DATE,
    years,
    ytdYear: thisYear,
    eurusd: { latest: round(fxAt(last), 5), date: last },
    source: 'Returns: Yahoo Finance adjusted close of the ETFs GLD, SLV, USO, CPER, PPLT, DBC (total return, distributions reinvested) and BTC-USD, in USD; EUR view via EUR/USD. Prices and the BTC/gold and BTC/silver ratios: front-month futures GC=F, SI=F, CL=F, HG=F, PL=F. Not investment advice.',
    assets,
    growth: { weekly: pack(weekly), daily: pack(daily) },
    ratio,
  };
  const json = JSON.stringify(data) + '\n';
  if (existsSync(OUT)) {
    const prev = JSON.parse(readFileSync(OUT, 'utf8'));
    if (prev.asOf > data.asOf) throw new Error(`new asOf ${data.asOf} is older than the current file (${prev.asOf})`);
  }
  if (sameData(OUT, data)) { console.log(`Unchanged: ${OUT} (as of ${data.asOf})`); return; }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, json);
  console.log(`Wrote ${OUT} (as of ${data.asOf}, ${(json.length / 1024).toFixed(0)} KB, BTC/gold ${ratio.gold.current} oz)`);
}

main().catch(e => { console.error(`::error title=Bitcoin vs commodities build::${e.message}`); process.exit(1); });
