// Builds src/data/prices.json: ECB reference rates + last close for the
// instruments in universe.json. Run: npm run prices
// ECB: official euro reference rates (eurofxref-daily.xml).
// Prices: Yahoo Finance chart API (unofficial, same source as the site's
// asset-returns build). The final provider is a phase 0 decision.
// Everyone downloads the same file, so it reveals nothing about a user.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const UA = { 'User-Agent': 'Mozilla/5.0 (virtuse cfo prices build)' }
const universe = JSON.parse(readFileSync(new URL('./universe.json', import.meta.url), 'utf8'))
const out = new URL('../src/data/prices.json', import.meta.url)

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
      if (r.ok) return r
      if (r.status < 500 && r.status !== 429) throw new Error(`${r.status} ${url}`)
    } catch (e) {
      if (i === 2) throw e
    }
    await new Promise((res) => setTimeout(res, 2000 * (i + 1)))
  }
  throw new Error(`failed ${url}`)
}

async function ecb() {
  const xml = await (await get('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml')).text()
  const date = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1]
  const rates = { EUR: 1 }
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) rates[m[1]] = Number(m[2])
  if (!date || !rates.USD) throw new Error('ECB file not understood')
  // GBX (pence) is used by London listings.
  if (rates.GBP) rates.GBX = rates.GBP * 100
  return { date, rates }
}

async function quote(symbol) {
  const r = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10d&interval=1d`)
  const j = await r.json()
  const res = j.chart?.result?.[0]
  const closes = res?.indicators?.quote?.[0]?.close ?? []
  const times = res?.timestamp ?? []
  const pts = []
  for (let i = 0; i < closes.length; i++) if (closes[i] != null) pts.push([times[i], closes[i]])
  if (pts.length > 0) {
    const [t, c] = pts[pts.length - 1]
    const prev = pts.length > 1 ? pts[pts.length - 2][1] : null
    const r4 = (n) => Math.round(n * 10000) / 10000
    return {
      price: r4(c),
      prevClose: prev === null ? undefined : r4(prev),
      changePct: prev ? Math.round(((c - prev) / prev) * 10000) / 100 : undefined,
      currency: res.meta.currency,
      date: new Date(t * 1000).toISOString().slice(0, 10),
    }
  }
  throw new Error(`no close for ${symbol}`)
}

async function btcMonthly() {
  const r = await get('https://query1.finance.yahoo.com/v8/finance/chart/BTC-EUR?range=max&interval=1mo')
  const res = (await r.json()).chart?.result?.[0]
  const out = {}
  const closes = res?.indicators?.quote?.[0]?.close ?? []
  ;(res?.timestamp ?? []).forEach((t, i) => {
    if (closes[i] != null) out[new Date(t * 1000).toISOString().slice(0, 7)] = Math.round(closes[i])
  })
  if (Object.keys(out).length < 24) throw new Error('BTC monthly history too short')
  return out
}

const fx = await ecb()
const instruments = []
const failed = []
for (const ins of universe.instruments) {
  try {
    const q = await quote(ins.yahoo)
    instruments.push({ id: ins.id, isin: ins.isin, name: ins.name, aliases: ins.aliases, ...q })
  } catch (e) {
    failed.push(`${ins.id}: ${e.message}`)
  }
}
let previous = null
try { previous = JSON.parse(readFileSync(out, 'utf8')) } catch {}
// Keep the last known price for anything that failed this time.
for (const p of previous?.prices?.instruments ?? []) {
  if (!instruments.some((i) => i.id === p.id) && universe.instruments.some((u) => u.id === p.id)) instruments.push({ ...p, stale: true })
}
if (instruments.length === 0) throw new Error('no prices at all')

let monthly = previous?.btcMonthlyEur ?? {}
try { monthly = await btcMonthly() } catch (e) { failed.push(`BTC monthly: ${e.message}`) }

const book = {
  btcMonthlyEur: monthly,
  builtAt: new Date().toISOString().slice(0, 16) + 'Z',
  fx: { source: 'ECB euro reference rates', date: fx.date, perEur: fx.rates },
  prices: { source: 'Yahoo Finance (last close)', instruments },
}
writeFileSync(out, JSON.stringify(book, null, 1) + '\n')
// Served next to the app; the app loads it at start-up (newer than the bundled copy).
mkdirSync(new URL('../public/', import.meta.url), { recursive: true })
writeFileSync(new URL('../public/prices.json', import.meta.url), JSON.stringify(book) + '\n')
console.log(`ECB ${fx.date}, ${Object.keys(fx.rates).length} currencies; ${instruments.length} prices${failed.length ? `; failed: ${failed.join('; ')}` : ''}`)
