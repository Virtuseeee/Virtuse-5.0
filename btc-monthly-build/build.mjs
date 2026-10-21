// Builds data/btc-monthly-returns.json for btc-monthly-returns.html: Bitcoin's
// month-end closes in USD since July 2010 (CoinMetrics community API,
// PriceUSD, daily reference rate), plus EUR/USD month ends (ECB via
// Frankfurter) for the EUR view. The page derives monthly, quarterly and
// yearly returns from these closes. Also per calendar year, from the daily
// closes: the highest and lowest close and the largest fall from a running
// high (max drawdown), used by the /bitcoin-returns/<year>/ pages.
// Node 18+, no dependencies.
// Run: node btc-monthly-build/build.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Kimi_Agent_Virtuse%20MiCA%20Partners', 'data', 'btc-monthly-returns.json');

async function getJSON(url) {
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'virtuse btc-monthly build' }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { lastErr = e; await new Promise(s => setTimeout(s, 5000 * (i + 1))); }
  }
  throw new Error(`${url}: ${lastErr.message}`);
}

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

// Last value per calendar month, keyed "YYYY-MM".
function monthEnds(points) {
  const out = {};
  for (const [day, v] of points) out[day.slice(0, 7)] = v;
  return out;
}

// Highest and lowest daily close and the max drawdown per calendar year (USD).
// The running high starts at the previous year's last close (the year's
// starting value), so a fall that begins on 1 January counts too; 2010 starts
// with the first price.
function yearStats(btc) {
  const out = {};
  let prevClose = null, y = null, s = null;
  const flush = () => { if (s) out[y] = { hi: px(s.hi), hiD: s.hiD, lo: px(s.lo), loD: s.loD, dd: round(s.dd, 4), ddP: s.ddP, ddT: s.ddT }; };
  for (const [day, v] of btc) {
    const yy = day.slice(0, 4);
    if (yy !== y) {
      flush();
      y = yy;
      const start = prevClose ?? v;
      s = { hi: v, hiD: day, lo: v, loD: day, peak: start, peakD: prevClose == null ? day : `${+yy - 1}-12-31`, dd: 0, ddP: null, ddT: null };
    }
    if (v > s.hi) { s.hi = v; s.hiD = day; }
    if (v < s.lo) { s.lo = v; s.loD = day; }
    if (v > s.peak) { s.peak = v; s.peakD = day; }
    const d = v / s.peak - 1;
    if (d < s.dd) { s.dd = d; s.ddP = s.peakD; s.ddT = day; }
    prevClose = v;
  }
  flush();
  return out;
}
const px = v => (v >= 100 ? round(v, 2) : round(v, 5));

async function main() {
  let url = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2010-07-01&paging_from=start&page_size=10000';
  const btc = [];
  while (url) {
    const j = await getJSON(url);
    for (const row of j.data) if (row.PriceUSD) btc.push([row.time.slice(0, 10), +row.PriceUSD]);
    url = j.next_page_url || null;
  }
  if (btc.length < 5000) throw new Error(`only ${btc.length} BTC days`);
  const asOf = btc[btc.length - 1][0];

  const fx = await getJSON('https://api.frankfurter.app/1999-01-04..?to=USD&from=EUR');
  const eur = Object.keys(fx.rates).sort().map(d => [d, fx.rates[d].USD]);

  const btcM = monthEnds(btc), eurM = monthEnds(eur);
  const months = Object.keys(btcM).sort();
  const closes = {}, eurusd = {};
  for (const m of months) {
    closes[m] = btcM[m] >= 100 ? round(btcM[m], 2) : round(btcM[m], 5);
    if (eurM[m]) eurusd[m] = round(eurM[m], 5);
  }
  const data = {
    generated: new Date().toISOString(),
    asOf,
    // The first month (July 2010) is a partial month whose open is the first
    // available price, so the page starts returns from August 2010.
    firstClose: { month: months[0], open: round(btc[0][1], 5) },
    closes,
    eurusd,
    // Per calendar year from the daily closes: hi/lo = highest/lowest close
    // and its date; dd = max drawdown (fraction, <= 0) from the high on ddP
    // to the low on ddT (both null when the year never fell below its start).
    years: yearStats(btc),
    source: 'CoinMetrics community data (PriceUSD, daily reference rate); EUR/USD from the ECB via Frankfurter.',
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data) + '\n');
  console.log(`Wrote ${OUT}: ${months.length} months, ${months[0]}..${months[months.length - 1]}, as of ${asOf}, last close ${closes[months[months.length - 1]]}`);
}

main().catch(e => { console.error(`::error title=BTC monthly build::${e.message}`); process.exit(1); });
