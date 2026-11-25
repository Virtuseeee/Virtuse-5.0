// Minimal RFC 4180 CSV reader: quoted fields, doubled quotes, CRLF or LF,
// comma or semicolon (detected from the first line).

export type Delimiter = ',' | ';' | '\t'

export function detectDelimiter(text: string): Delimiter {
  const first = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? ''
  const count = (d: string) => {
    let n = 0
    let q = false
    for (const ch of first) {
      if (ch === '"') q = !q
      else if (!q && ch === d) n++
    }
    return n
  }
  const c = count(','), s = count(';'), t = count('\t')
  if (t > c && t > s) return '\t'
  return s > c ? ';' : ','
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text)
  if (rows.length === 0) return []
  return recordsFrom(rows, 0)
}

/** Rows below `headerIndex`, keyed by that row. Blank rows are dropped. */
export function recordsFrom(rows: string[][], headerIndex: number): Record<string, string>[] {
  const header = rows[headerIndex].map((h) => h.trim())
  return rows
    .slice(headerIndex + 1)
    .filter((r) => r.some((cell) => cell.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {}
      header.forEach((h, i) => {
        obj[h] = (r[i] ?? '').trim()
      })
      return obj
    })
}

export function parseRows(text: string, delimiter?: Delimiter): string[][] {
  text = text.replace(/^﻿/, '')
  const d = delimiter ?? detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === d) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** "1 234,56", "1,234.56", "-12.5", "" → number. Throws on garbage. */
export function toNumber(v: string, where = ''): number {
  let s = (v ?? '').replace(/[\s ']/g, '')
  if (s === '' || s === '-' || s === '--') return 0
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`not_a_number ${where} "${v}"`)
  return n
}

/** Finds the first row (within `limit`) that contains every given cell. */
export function findHeader(rows: string[][], cells: string[], limit = 20): number {
  for (let i = 0; i < Math.min(rows.length, limit); i++) {
    const r = rows[i].map((c) => c.trim())
    if (cells.every((c) => r.includes(c))) return i
  }
  return -1
}
