// Picks the right importer for a CSV file from its contents.

import { parseRows, recordsFrom } from '../csv'
import { importIbkr, isIbkr } from './ibkr'
import { importKrakenLedgers, isKrakenLedgers } from './kraken'
import { importT212, isT212 } from './t212'
import { findXtb, importXtb } from './xtb'
import { findBankHeader, importBank } from './bank'
import type { ImportResult } from './types'

export type { ImportResult } from './types'

export class UnknownFormatError extends Error {
  constructor() {
    super('unknown_format')
  }
}

export function importCsv(text: string): ImportResult {
  const rows = parseRows(text)
  if (rows.length === 0) throw new UnknownFormatError()
  const header = rows[0].map((c) => c.trim())
  if (isKrakenLedgers(header)) return { kind: 'btc', ...importKrakenLedgers(recordsFrom(rows, 0)) }
  if (isT212(header)) return { kind: 'broker', account: importT212(recordsFrom(rows, 0)) }
  if (isIbkr(rows)) return { kind: 'broker', account: importIbkr(rows) }
  if (findXtb(rows)) return { kind: 'broker', account: importXtb(rows) }
  if (findBankHeader(rows) >= 0) return { kind: 'bank', account: importBank(rows) }
  throw new UnknownFormatError()
}
