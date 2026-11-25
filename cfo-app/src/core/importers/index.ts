// Picks the right importer for a CSV file from its header line.
// New exchanges and brokers (phase 2) register here.

import { parseCsv } from '../csv'
import { importKrakenLedgers, isKrakenLedgers } from './kraken'
import type { ImportResult } from './types'

export type { ImportResult } from './types'

export class UnknownFormatError extends Error {
  constructor() {
    super('unknown_format')
  }
}

export function importCsv(text: string): ImportResult {
  const records = parseCsv(text)
  const header = records.length > 0 ? Object.keys(records[0]) : []
  if (isKrakenLedgers(header)) return importKrakenLedgers(records)
  throw new UnknownFormatError()
}
