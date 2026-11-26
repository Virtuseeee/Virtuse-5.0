import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/core/csv'

describe('parseCsv', () => {
  it('reads quoted fields, doubled quotes, CRLF and a BOM', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\r\n\r\n1,2')
    expect(rows).toEqual([
      { a: 'x, y', b: 'he said "hi"' },
      { a: '1', b: '2' },
    ])
  })
  it('returns nothing for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })
})
