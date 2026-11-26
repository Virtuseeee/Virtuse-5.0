// Synthetic demo data for investor and partner demos. Not a real person.
// Prices are illustrative round numbers, not market history.

import type { Profile } from '../core/model'
import { importKrakenLedgers } from '../core/importers/kraken'
import { mergeAccount } from '../core/brokers'
import { parseCsv, parseRows } from '../core/csv'
import { importXtb } from '../core/importers/xtb'
import { SAMPLES } from './samples'

/** Illustrative EUR price used for "today" in demo mode. */
export const DEMO_PRICE_EUR = 78_000

// One illustrative price per month, Jan 2024 → Nov 2026.
const MONTH_PRICES = [
  38000, 46000, 62000, 60000, 58000, 57000, 55000, 54000, 52000, 58000, 82000, 90000,
  95000, 88000, 80000, 82000, 94000, 92000, 100000, 98000, 96000, 100000, 85000, 80000,
  78000, 72000, 70000, 74000, 76000, 80000, 82000, 79000, 75000, 77000, 78000,
]

/** Kraken ledgers.csv for Anna: €500 on the 5th of every month, 0.4 % fee. */
export function annaKrakenCsv(): string {
  const lines = ['"txid","refid","time","type","subtype","aclass","asset","wallet","amount","fee","balance"']
  let eurBal = 0
  let btcBal = 0
  MONTH_PRICES.forEach((price, i) => {
    const y = 2024 + Math.floor(i / 12)
    const m = String((i % 12) + 1).padStart(2, '0')
    const day = `${y}-${m}-05`
    const ref = `QDEMO${String(i).padStart(3, '0')}`
    const fee = 2
    const spend = 500 - fee
    const got = Math.round((spend / price) * 1e8) / 1e8
    eurBal += 500
    lines.push(`"LDEP${i}","DDEMO${i}","${day} 08:00:00","deposit","","currency","ZEUR","spot / main","500.0000","0.0000","${eurBal.toFixed(4)}"`)
    eurBal -= 500
    lines.push(`"LEUR${i}","${ref}","${day} 09:12:33","trade","","currency","ZEUR","spot / main","-${spend.toFixed(4)}","${fee.toFixed(4)}","${eurBal.toFixed(4)}"`)
    btcBal += got
    lines.push(`"LBTC${i}","${ref}","${day} 09:12:33","trade","","currency","XXBT","spot / main","${got.toFixed(10)}","0.0000000000","${btcBal.toFixed(10)}"`)
    // September 2026: she sells 0.015 BTC (shows up in the tax overview).
    if (i === 32) {
      const sold = 0.015
      const eur = Math.round(sold * price * 100) / 100
      const sfee = Math.round(eur * 0.004 * 100) / 100
      btcBal -= sold
      eurBal += eur - sfee
      lines.push(`"LSB${i}","QSELL${i}","${y}-${m}-20 10:00:00","trade","","currency","XXBT","spot / main","-${sold.toFixed(10)}","0.0000000000","${btcBal.toFixed(10)}"`)
      lines.push(`"LSE${i}","QSELL${i}","${y}-${m}-20 10:00:00","trade","","currency","ZEUR","spot / main","${eur.toFixed(4)}","${sfee.toFixed(4)}","${eurBal.toFixed(4)}"`)
    }
    // Every 6th month the coins go to her own hardware wallet.
    if (i % 6 === 5) {
      const wfee = 0.00001
      btcBal = 0
      lines.push(`"LWD${i}","AWDEMO${i}","${day} 18:00:00","withdrawal","","currency","XXBT","spot / main","-${(got * 6).toFixed(10)}","${wfee.toFixed(10)}","0.0000000000"`)
    }
  })
  return lines.join('\n') + '\n'
}

export function annaProfile(): Profile {
  const { txs } = importKrakenLedgers(parseCsv(annaKrakenCsv()))
  return {
    version: 1,
    label: 'Anna (demo)',
    country: 'SK',
    txs,
    extraBtc: 0,
    manualAssets: [
      { id: 'a1', name: 'Sporiaci účet', assetClass: 'cash', valueEur: 18_000 },
      { id: 'a3', name: 'Byt v Bratislave', assetClass: 'real_estate', valueEur: 210_000 },
      { id: 'a4', name: 'Dôchodkové sporenie (3. pilier)', assetClass: 'pension', valueEur: 14_500 },
    ],
    liabilities: [{ id: 'l1', name: 'Hypotéka', kind: 'mortgage', balanceEur: 96_000 }],
    // Her ETF account at XTB, from the two synthetic sample exports.
    goals: [
      { id: 'g1', name: '1 BTC', kind: 'btc', target: 1 },
      { id: 'g2', name: 'Rezerva na 6 mesiacov', kind: 'cash', target: 24_000 },
      { id: 'g3', name: 'Splatiť hypotéku', kind: 'debt_free', target: 0, startDebt: 120_000 },
    ],
    rules: [{ id: 'r1', kind: 'move', symbol: 'BTC', value: 5, text: 'BTC sa pohne o viac ako 5 % za deň' }],
    brokers: [mergeAccount(importXtb(parseRows(SAMPLES.xtbPositions)), importXtb(parseRows(SAMPLES.xtbCash)))],
  }
}
