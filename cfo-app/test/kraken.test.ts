import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { importCsv, UnknownFormatError } from '../src/core/importers'

const csv = readFileSync(new URL('./fixtures/kraken-ledgers.csv', import.meta.url), 'utf8')

describe('Kraken ledgers import', () => {
  const r = importCsv(csv)

  it('pairs trade rows by refid and skips rows without BTC', () => {
    expect(r.source).toBe('kraken')
    expect(r.txs.map((t) => t.kind)).toEqual(['buy', 'buy', 'sell', 'withdrawal'])
    expect(r.skipped).toBe(2)
  })

  it('takes the EUR fee as is and converts a BTC fee at the trade price', () => {
    expect(r.txs[0]).toMatchObject({ id: 'T1', btc: 0.005, eur: 500, feeEur: 2, feeBtc: 0 })
    expect(r.txs[1]).toMatchObject({ id: 'T2', btc: 0.005, eur: 400, feeEur: 4, feeBtc: 0.00005 })
    expect(r.txs[2]).toMatchObject({ id: 'T3', kind: 'sell', btc: 0.002, eur: 200, feeEur: 1 })
  })

  it('keeps the network fee of a withdrawal in BTC', () => {
    expect(r.txs[3]).toMatchObject({ kind: 'withdrawal', btc: 0.007, feeBtc: 0.000015 })
  })

  it('writes times as UTC ISO strings', () => {
    expect(r.txs[0].time).toBe('2026-01-05T09:12:33Z')
  })

  it('rejects a file it does not know', () => {
    expect(() => importCsv('date,amount\n2026-01-01,5')).toThrow(UnknownFormatError)
  })
})
