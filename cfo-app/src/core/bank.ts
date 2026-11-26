// Bank statements: a generic CSV import (date, description, amount) for EUR
// accounts, keyword categories, and monthly cash flow. Read on the device.
// The PSD2 sandbox (phase 2, later) will fill the same BankAccount shape.

export type Category =
  | 'income' | 'groceries' | 'housing' | 'transport' | 'eating_out' | 'subscriptions'
  | 'shopping' | 'health' | 'investing' | 'transfers' | 'cash' | 'other'

export interface BankTx {
  date: string
  amountEur: number
  description: string
  category: Category
}

export interface BankAccount {
  id: string
  name: string
  txs: BankTx[]
  /** Closing balance from the statement's balance column, if it has one. */
  balanceEur?: number
  period?: string
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Header names seen in Slovak, Czech and English exports.
const DATE = ['datum', 'datum zauctovania', 'datum transakcie', 'datum splatnosti', 'datum zauctovani', 'date', 'booking date', 'transaction date', 'value date']
const AMOUNT = ['suma', 'ciastka', 'castka', 'objem', 'amount', 'suma v mene uctu', 'amount (eur)']
const DEBIT = ['debet', 'vydaj', 'vydavky', 'debit', 'money out', 'paid out']
const CREDIT = ['kredit', 'prijem', 'prijmy', 'credit', 'money in', 'paid in']
const DESC = ['popis', 'popis transakcie', 'protistrana', 'nazov protistrany', 'nazov protiuctu', 'sprava pre prijemcu', 'informacia pre prijemcu', 'poznamka', 'obchodnik', 'description', 'payee', 'counterparty', 'merchant', 'details', 'reference']
const BALANCE = ['zostatok', 'zustatek', 'balance', 'disponibilny zostatok']
const CURRENCY = ['mena', 'mena uctu', 'currency']

function findCol(header: string[], names: string[]): number {
  const h = header.map(fold)
  for (const n of names) {
    const i = h.indexOf(n)
    if (i >= 0) return i
  }
  return h.findIndex((x) => names.some((n) => x.startsWith(n)))
}

export interface BankColumns {
  date: number
  amount: number
  debit: number
  credit: number
  desc: number[]
  balance: number
  currency: number
}

export function bankColumns(header: string[]): BankColumns | null {
  const date = findCol(header, DATE)
  const amount = findCol(header, AMOUNT)
  const debit = findCol(header, DEBIT)
  const credit = findCol(header, CREDIT)
  if (date < 0 || (amount < 0 && (debit < 0 || credit < 0))) return null
  const h = header.map(fold)
  const desc = h.map((x, i) => (DESC.some((n) => x === n || x.startsWith(n)) ? i : -1)).filter((i) => i >= 0)
  return { date, amount, debit, credit, desc, balance: findCol(header, BALANCE), currency: findCol(header, CURRENCY) }
}

/** "05.02.2026", "5.2.2026", "2026-02-05", "05/02/2026" → "2026-02-05". */
export function bankDate(v: string): string | null {
  const s = v.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

const RULES: [Category, RegExp][] = [
  ['investing', /kraken|xtb|trading ?212|interactive brokers|ibkr|21bitcoin|bitstamp|coinmate|anycoin|bybit|revolut invest|finax|fondy|dds|doplnkov/],
  ['groceries', /tesco|lidl|billa|kaufland|coop|jednota|albert|fresh|terno|potravin/],
  ['eating_out', /restaur|bistro|pizz|wolt|bolt food|foodora|kaviar|cafe|kav[ai]ar|mcdonald|kfc|burger/],
  ['transport', /shell|omv|slovnaft|mol |orlen|bolt|uber|zssk|slovak lines|dpb|imhd|parking|dialnic|eznamka|e-znamka/],
  ['housing', /najom|najomne|hypot|uver|energ|zse|sse|vse|spp|elektr|plyn|voda|bvs|svb|spolocenstv|internet|telekom|orange|o2|4ka/],
  ['subscriptions', /netflix|spotify|apple\.com|icloud|google|youtube|disney|hbo|max\.com|amazon prime|microsoft|adobe|chatgpt|openai|patreon/],
  ['health', /lekaren|dr\.max|benu|nemocnic|ambulanc|zubn|optik/],
  ['shopping', /alza|mall|ikea|dm drogerie|decathlon|zara|h&m|amazon|aliexpress|temu|datart|nay|hornbach|obi/],
  ['cash', /vyber z bankomatu|vyber hotovosti|bankomat|atm/],
  ['transfers', /prevod|trvaly prikaz|standing order|vlastny ucet|own account|sporiaci/],
]

export function categorize(description: string, amount: number): Category {
  const d = fold(description)
  if (/mzda|plat |vyplata|salary|payroll|dividend|urok|refund|vratka/.test(d) && amount > 0) return 'income'
  for (const [cat, re] of RULES) if (re.test(d)) return cat
  return amount > 0 ? 'income' : 'other'
}

export interface MonthFlow {
  month: string
  incomeEur: number
  spendingEur: number
  netEur: number
  byCategory: Partial<Record<Category, number>>
}

/** Monthly cash flow. Transfers and investing are kept apart from spending. */
export function cashFlow(accounts: BankAccount[]): MonthFlow[] {
  const map = new Map<string, MonthFlow>()
  for (const acc of accounts) {
    for (const t of acc.txs) {
      const month = t.date.slice(0, 7)
      const f = map.get(month) ?? { month, incomeEur: 0, spendingEur: 0, netEur: 0, byCategory: {} }
      if (t.category === 'transfers' || t.category === 'investing') {
        f.byCategory[t.category] = (f.byCategory[t.category] ?? 0) + -t.amountEur
      } else if (t.amountEur > 0) {
        f.incomeEur += t.amountEur
      } else {
        f.spendingEur += -t.amountEur
        f.byCategory[t.category] = (f.byCategory[t.category] ?? 0) + -t.amountEur
      }
      map.set(month, f)
    }
  }
  return [...map.values()]
    .map((f) => ({ ...f, incomeEur: Math.round(f.incomeEur * 100) / 100, spendingEur: Math.round(f.spendingEur * 100) / 100, netEur: Math.round((f.incomeEur - f.spendingEur) * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

export function bankBalance(accounts: BankAccount[] | undefined): number {
  return (accounts ?? []).reduce((s, a) => s + (a.balanceEur ?? 0), 0)
}
