#!/usr/bin/env node
// Fetches this week's Bitcoin Pulse stats (same sources/logic as the live
// bitcoin-data.html / btc-dominance.html / ma-200w.html pages), merges them
// with email/weekly-issue.json, and renders email/template.html to
// dist/weekly-email.html.
//
// Does NOT push anywhere and does NOT talk to Zoho -- see create-zoho-draft.mjs
// for the next step. Run this first.
//
// Usage: node .github/scripts/render-pulse.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const EMAIL_DIR = path.join(ROOT, 'email');
const DIST_DIR = path.join(ROOT, 'dist');

const CACHE_PATH = path.join(EMAIL_DIR, 'pulse-cache.json');
const ISSUE_PATH = path.join(EMAIL_DIR, 'weekly-issue.json');
const TEMPLATE_PATH = path.join(EMAIL_DIR, 'template.html');

function usd(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'virtuse-weekly-pulse/1.0' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// ---- Same endpoints/calculations as the live site pages ----

// bitcoin-data.html: mempool.space primary, CoinGecko fallback.
async function getBtcPrice() {
  try {
    const p = await fetchJson('https://mempool.space/api/v1/prices');
    if (!p.USD) throw new Error('no USD field in mempool.space response');
    return p.USD;
  } catch (e) {
    console.warn('mempool.space price fetch failed, falling back to CoinGecko:', e.message);
    const g = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (!g.bitcoin?.usd) throw new Error('CoinGecko fallback also failed');
    return g.bitcoin.usd;
  }
}

// btc-dominance.html: CoinGecko /global, data.market_cap_percentage.btc.
async function getBtcDominance() {
  const d = await fetchJson('https://api.coingecko.com/api/v3/global');
  const v = d.data?.market_cap_percentage?.btc;
  if (v == null) throw new Error('dominance field missing from CoinGecko response');
  return v;
}

// ma-200w.html: trailing 200 weekly closes from Binance, simple average
// (the site calls it "wma" but the actual math is `sum / 200`).
async function getBtc200wMa() {
  const rows = await fetchJson('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=200');
  if (!Array.isArray(rows) || rows.length < 200) {
    throw new Error(`expected 200 weekly candles from Binance, got ${Array.isArray(rows) ? rows.length : typeof rows}`);
  }
  const sum = rows.reduce((acc, candle) => acc + parseFloat(candle[4]), 0); // candle[4] = close
  return sum / rows.length;
}

async function withFallback(name, fetcher, cache) {
  try {
    return { value: await fetcher(), stale: false };
  } catch (e) {
    console.warn(`${name} fetch failed (${e.message}), falling back to cached value`);
    if (cache?.[name] == null) {
      throw new Error(`${name} fetch failed and no cached value exists yet -- nothing to fall back to`);
    }
    return { value: cache[name], stale: true };
  }
}

function loadJson(filePath, fallback = {}) {
  return existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function main() {
  const cache = loadJson(CACHE_PATH, {});
  const issue = loadJson(ISSUE_PATH);

  const [price, dominance, ma200w] = await Promise.all([
    withFallback('btc_price_raw', getBtcPrice, cache),
    withFallback('btc_dominance_raw', getBtcDominance, cache),
    withFallback('btc_200w_ma_raw', getBtc200wMa, cache),
  ]);

  const stats = {
    btc_price: (price.stale ? '~' : '') + usd(price.value),
    btc_dominance: (dominance.stale ? '~' : '') + dominance.value.toFixed(2) + '%',
    btc_200w_ma: (ma200w.stale ? '~' : '') + usd(ma200w.value),
  };

  // Persist this run's raw values so next week has something to fall back to.
  writeFileSync(CACHE_PATH, JSON.stringify({
    btc_price_raw: price.value,
    btc_dominance_raw: dominance.value,
    btc_200w_ma_raw: ma200w.value,
    updated_at: new Date().toISOString(),
  }, null, 2) + '\n');

  const mergeFields = { ...issue, ...stats };

  let html = readFileSync(TEMPLATE_PATH, 'utf8');
  html = html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (!(key in mergeFields)) {
      console.warn(`No value found for {{${key}}} -- leaving the literal placeholder in place`);
      return match;
    }
    return escapeHtml(mergeFields[key]);
  });

  if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });
  const outPath = path.join(DIST_DIR, 'weekly-email.html');
  writeFileSync(outPath, html);

  const anyStale = price.stale || dominance.stale || ma200w.stale;
  console.log('Rendered', outPath);
  console.log('Bitcoin Pulse stats used:', stats, anyStale ? '(one or more values are cached/stale -- check logs above)' : '(all live)');
}

main().catch((e) => {
  console.error('render-pulse failed:', e);
  process.exit(1);
});
