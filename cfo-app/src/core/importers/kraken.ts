// Kraken "Ledgers" export (History → Export → Ledgers, CSV).
// Columns: txid, refid, time, type, subtype, aclass, asset, [wallet,] amount, fee, balance.
// A trade is two rows that share a refid: one in BTC, one in EUR.

import type { Tx } from '../model'
import type { ImportResult } from './types'

const REQUIRED = ['txid', 'refid', 'time', 'type', 'asset', 'amount', 'fee']

export function isKrakenLedgers(header: string[]): boolean {
  return REQUIRED.every((c) => header.includes(c))
}

function assetOf(raw: string): 'BTC' | 'EUR' | 'OTHER' {
  const a = raw.toUpperCase().split('.')[0]
  if (a === 'XXBT' || a === 'XBT' || a === 'BTC') return 'BTC'
  if (a === 'ZEUR' || a === 'EUR') return 'EUR'
  return 'OTHER'
}

function num(v: string, row: number, col: string): number {
  const n = Number(v === '' ? '0' : v)
  if (!Number.isFinite(n)) throw new Error(`Row ${row}: "${col}" is not a number`)
  return n
}

function isoTime(v: string): string {
  // Kraken writes "2026-01-05 09:12:33" in UTC.
  const iso = v.includes('T') ? v : v.replace(' ', 'T')
  return iso.endsWith('Z') ? iso : `${iso}Z`
}

interface Row {
  line: number
  refid: string
  time: string
  type: string
  asset: 'BTC' | 'EUR' | 'OTHER'
  amount: number
  fee: number
}

export function importKrakenLedgers(records: Record<string, string>[]): ImportResult {
  const rows: Row[] = records.map((r, i) => ({
    line: i + 2,
    refid: r.refid,
    time: isoTime(r.time),
    type: r.type.toLowerCase(),
    asset: assetOf(r.asset),
    amount: num(r.amount, i + 2, 'amount'),
    fee: num(r.fee, i + 2, 'fee'),
  }))

  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const key = row.refid || `line-${row.line}`
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const txs: Tx[] = []
  let skipped = 0

  for (const [refid, group] of groups) {
    const btc = group.find((r) => r.asset === 'BTC')
    if (!btc) {
      // EUR deposits, withdrawals and other assets do not move Bitcoin.
      skipped += group.length
      continue
    }
    const eur = group.find((r) => r.asset === 'EUR')
    const type = btc.type

    if ((type === 'trade' || type === 'spend' || type === 'receive') && eur) {
      const btcAmt = Math.abs(btc.amount)
      const eurAmt = Math.abs(eur.amount)
      const price = btcAmt > 0 ? eurAmt / btcAmt : 0
      txs.push({
        id: refid,
        source: 'kraken',
        time: btc.time,
        kind: btc.amount > 0 ? 'buy' : 'sell',
        btc: btcAmt,
        eur: eurAmt,
        feeEur: round2(eur.fee + btc.fee * price),
        feeBtc: btc.fee,
      })
      continue
    }

    if (type === 'deposit' || type === 'withdrawal') {
      txs.push({
        id: refid,
        source: 'kraken',
        time: btc.time,
        kind: btc.amount >= 0 ? 'deposit' : 'withdrawal',
        btc: Math.abs(btc.amount),
        eur: 0,
        feeEur: 0,
        feeBtc: btc.fee,
      })
      continue
    }

    skipped += group.length
  }

  txs.sort((a, b) => a.time.localeCompare(b.time))
  return { source: 'kraken', txs, skipped }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
