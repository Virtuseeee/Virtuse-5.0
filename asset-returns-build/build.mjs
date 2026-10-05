// Builds data/asset-returns.json for asset-returns.html: calendar-year total
// returns (dividends reinvested, via Yahoo Finance adjusted close) for a fixed
// set of ETFs plus Bitcoin, from 2016 to today. Node 18+, no dependencies.
// Run: node asset-returns-build/build.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Kimi_Agent_Virtuse%20MiCA%20Partners', 'data', 'asset-returns.json');
const START_YEAR = 2016;

const ASSETS = [
  ['BTC-USD', 'BTC', 'Bitcoin'],
  ['DBC', 'DBC', 'Commodities'],
  ['QQQ', 'QQQ', 'US Nasdaq 100'],
  ['IWD', 'IWD', 'US Value'],
  ['CWB', 'CWB', 'Convertible Bonds'],
  ['IWM', 'IWM', 'US Small Caps'],
  ['SPY', 'SPY', 'US Large Caps'],
  ['MDY', 'MDY', 'US Mid Caps'],
  ['VWO', 'VWO', 'Emerging Markets'],
  ['EFA', 'EFA', 'Developed International'],
  ['IWF', 'IWF', 'US Growth'],
  ['VNQ', 'VNQ', 'US REITs'],
  ['BIL', 'BIL', 'US Cash'],
  ['HYG', 'HYG', 'High Yield Bonds'],
  ['PFF', 'PFF', 'Preferred Stocks'],
  ['TIP', 'TIP', 'TIPS'],
  ['EMB', 'EMB', 'EM Bonds (USD)'],
  ['BND', 'BND', 'US Total Bond Market'],
  ['GLD', 'GLD', 'Gold'],
  // Europe. UCITS bond ETFs trade in EUR; their prices are converted to USD
  // with EUR/USD so every row is a USD total return like the rest.
  ['FEZ', 'FEZ', 'Euro Stoxx 50'],
  ['VGK', 'VGK', 'European Stocks'],
  ['EUNH.DE', 'EUNH', 'Euro Government Bonds', 'EUR'],
  ['EUN5.DE', 'EUN5', 'Euro Corporate Bonds', 'EUR'],
];


async function fetchSeries(symbol) {
  const p1 = Math.floor(Date.UTC(START_YEAR - 1, 11, 1) / 1000);
  const p2 = Math.floor(Date.now() / 1000) + 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div,splits`;
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (virtuse asset-returns build)' }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const res = j.chart.result[0];
      const adj = res.indicators.adjclose?.[0]?.adjclose || res.indicators.quote[0].close;
      return res.timestamp.map((t, k) => [t * 1000, adj[k]]).filter(([, v]) => v != null && v > 0);
    } catch (e) { lastErr = e; await new Promise(s => setTimeout(s, 3000 * (i + 1))); }
  }
  throw new Error(`${symbol}: ${lastErr.message}`);
}

function yearEndCloses(series) {
  const out = {};
  for (const [t, v] of series) out[new Date(t).getUTCFullYear()] = v; // last value per year wins
  return out;
}

const round = (x, d = 4) => x == null ? null : Math.round(x * 10 ** d) / 10 ** d;

async function main() {
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const years = [];
  for (let y = START_YEAR; y <= thisYear; y++) years.push(y);

  const rows = [];
  let asOf = 0;
  const eurusd = await fetchSeries('EURUSD=X');
  // EUR prices -> USD using the latest EUR/USD close on or before that day.
  const toUsd = series => {
    let j = 0;
    return series.map(([t, v]) => {
      while (j + 1 < eurusd.length && eurusd[j + 1][0] <= t + 864e5 / 2) j++;
      return [t, v * eurusd[j][1]];
    });
  };
  const fxYearEnd = {};
  for (const [y, v] of Object.entries(yearEndCloses(eurusd))) if (+y >= START_YEAR - 1) fxYearEnd[y] = round(v, 5);
  fxYearEnd[thisYear] = round(eurusd[eurusd.length - 1][1], 5);
  for (const [symbol, ticker, name, ccy] of ASSETS) {
    let series = await fetchSeries(symbol);
    if (ccy === 'EUR') series = toUsd(series);
    const closes = yearEndCloses(series);
    const [lastT, lastV] = series[series.length - 1];
    asOf = Math.max(asOf, lastT);
    closes[thisYear] = lastV;
    const returns = years.map(y => (closes[y] != null && closes[y - 1] != null) ? round(closes[y] / closes[y - 1] - 1) : null);
    const base = closes[START_YEAR - 1];
    const cumulative = base ? closes[thisYear] / base - 1 : null;
    const yrs = (lastT - Date.UTC(START_YEAR - 1, 11, 31)) / (365.25 * 864e5);
    const annualized = cumulative != null ? Math.pow(1 + cumulative, 1 / yrs) - 1 : null;
    rows.push({ ticker, name, region: ccy === 'EUR' || ['FEZ', 'VGK'].includes(ticker) ? 'eu' : undefined, returns, cumulative: round(cumulative), annualized: round(annualized) });
    console.log(ticker.padEnd(4), returns.map(r => r == null ? '  n/a' : (r * 100).toFixed(1).padStart(6)).join(' '));
  }

  const data = {
    generated: now.toISOString(),
    asOf: new Date(asOf).toISOString().slice(0, 10),
    years,
    ytdYear: thisYear,
    // EUR/USD (USD per 1 EUR) at each year end, current year = latest close.
    // The page uses it to show every row in EUR.
    eurusd: fxYearEnd,
    yearsElapsed: round((asOf - Date.UTC(START_YEAR - 1, 11, 31)) / (365.25 * 864e5)),
    source: 'Yahoo Finance adjusted close (total return, dividends reinvested), in USD. EUR-listed ETFs converted with EUR/USD; the page converts every row to EUR on request.',
    rows,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
  console.log(`Wrote ${OUT} (as of ${data.asOf})`);
}

main().catch(e => { console.error(`::error title=Asset returns build::${e.message}`); process.exit(1); });
