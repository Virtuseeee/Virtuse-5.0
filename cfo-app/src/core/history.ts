// How the user's wealth moved over time, from data already on the device:
//  - Bitcoin: rebuilt month by month from the imported transactions and the
//    month-end BTC/EUR closes in the shared price file (nothing new is sent);
//  - net worth: one snapshot per day the user opens the app, kept in the profile
//    (encrypted with it), because manual assets and brokers have no history.

import type { Profile, Tx } from './model'

export interface BtcPoint {
  month: string
  btc: number
  valueEur: number
  /** EUR put in so far: buys minus sells. */
  investedEur: number
}

export interface Snapshot {
  date: string
  netWorthEur: number
  assetsEur: number
  liabilitiesEur: number
}

const monthOf = (iso: string) => iso.slice(0, 7)

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
}

/** Month-end Bitcoin value from the first buy to `today` (YYYY-MM-DD). */
export function btcHistory(txs: Tx[], monthly: Record<string, number> | undefined, today: string, extraBtc = 0): BtcPoint[] {
  const sorted = [...txs].sort((a, b) => a.time.localeCompare(b.time))
  const first = sorted.find((t) => t.kind === 'buy')
  if (!first || !monthly) return []
  const end = monthOf(today)
  const points: BtcPoint[] = []
  let btc = 0
  let invested = 0
  let i = 0
  let lastClose = 0
  for (let m = monthOf(first.time); m <= end; m = nextMonth(m)) {
    while (i < sorted.length && monthOf(sorted[i].time) <= m) {
      const t = sorted[i++]
      if (t.kind === 'buy') { btc += t.btc - t.feeBtc; invested += t.eur }
      else if (t.kind === 'sell') { btc -= t.btc + t.feeBtc; invested -= t.eur }
      else if (t.kind === 'withdrawal' || t.kind === 'deposit') btc -= t.feeBtc
    }
    lastClose = monthly[m] ?? lastClose
    if (!lastClose) continue
    const held = Math.max(0, btc) + extraBtc
    points.push({ month: m, btc: held, valueEur: Math.round(held * lastClose), investedEur: Math.round(invested) })
  }
  return points
}

/** Adds or replaces today's snapshot; returns the same array when nothing changed. */
export function upsertSnapshot(list: Snapshot[] | undefined, snap: Snapshot, keep = 1500): Snapshot[] {
  const prev = list ?? []
  const last = prev[prev.length - 1]
  if (last && last.date === snap.date) {
    if (Math.abs(last.netWorthEur - snap.netWorthEur) < 1 && Math.abs(last.assetsEur - snap.assetsEur) < 1) return prev
    return [...prev.slice(0, -1), snap]
  }
  return [...prev, snap].slice(-keep)
}

export type Range = '3m' | '1y' | '3y' | 'all'

export function cutRange<T extends { month: string }>(points: T[], range: Range, today: string): T[] {
  if (range === 'all') return points
  const months = range === '3m' ? 3 : range === '1y' ? 12 : 36
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - months)
  const from = d.toISOString().slice(0, 7)
  return points.filter((p) => p.month >= from)
}

export type { Profile }
