import { bankColumns, bankDate, categorize, type BankAccount, type BankTx } from '../bank'
import { toNumber } from '../csv'

/** Finds the header row (a few info lines may sit above it). */
export function findBankHeader(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 25); i++) if (bankColumns(rows[i])) return i
  return -1
}

export class ForeignCurrencyError extends Error {
  constructor(public currency: string) {
    super('bank_currency')
  }
}

export function importBank(rows: string[][], name = 'Bankový účet'): BankAccount {
  const hi = findBankHeader(rows)
  if (hi < 0) throw new Error('not_bank')
  const cols = bankColumns(rows[hi])!
  const txs: BankTx[] = []
  let lastBalance: number | undefined
  let lastDate = ''
  for (const r of rows.slice(hi + 1)) {
    if (!r.some((c) => c.trim())) continue
    const date = bankDate(r[cols.date] ?? '')
    if (!date) continue
    const cur = cols.currency >= 0 ? (r[cols.currency] ?? '').trim().toUpperCase() : 'EUR'
    if (cur && cur !== 'EUR') throw new ForeignCurrencyError(cur)
    let amount: number
    if (cols.amount >= 0) amount = toNumber(r[cols.amount] ?? '')
    else amount = Math.abs(toNumber(r[cols.credit] ?? '')) - Math.abs(toNumber(r[cols.debit] ?? ''))
    if (amount === 0) continue
    const description = cols.desc.map((i) => (r[i] ?? '').trim()).filter(Boolean).join(' · ')
    txs.push({ date, amountEur: Math.round(amount * 100) / 100, description, category: categorize(description, amount) })
    if (cols.balance >= 0 && (r[cols.balance] ?? '').trim() && date >= lastDate) {
      lastBalance = toNumber(r[cols.balance])
      lastDate = date
    }
  }
  txs.sort((a, b) => a.date.localeCompare(b.date))
  const acc: BankAccount = { id: 'bank', name, txs, balanceEur: lastBalance }
  if (txs.length) acc.period = `${txs[0].date} – ${txs[txs.length - 1].date}`
  return acc
}
