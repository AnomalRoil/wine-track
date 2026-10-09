import { describe, expect, it } from 'vitest'
import { decodeText, parseCsv, toCsv } from './csv'

const cellsOf = (text: string) => parseCsv(text).map((r) => r.cells)

describe('parseCsv', () => {
  const cases: { name: string; text: string; want: string[][] }[] = [
    { name: 'commas', text: 'a,b\n1,2\n', want: [['a', 'b'], ['1', '2']] },
    { name: 'semicolons with decimal commas', text: 'a;b\r\n1,5;2', want: [['a', 'b'], ['1,5', '2']] },
    { name: 'tabs', text: 'a\tb\n1\t2', want: [['a', 'b'], ['1', '2']] },
    { name: 'quotes, escaped quotes and newlines', text: 'a,b\n"x, ""y""","line1\nline2"', want: [['a', 'b'], ['x, "y"', 'line1\nline2']] },
    { name: 'BOM and blank lines', text: '﻿a,b\n\n,\n1,2', want: [['a', 'b'], ['1', '2']] },
    { name: 'delimiter inside quoted header', text: '"a;b",c\n1,2', want: [['a;b', 'c'], ['1', '2']] },
    { name: 'empty', text: '', want: [] },
    { name: 'semicolons after a blank line', text: '\r\n  \na;b\n1,5;2', want: [['a', 'b'], ['1,5', '2']] },
    { name: 'tabs after a blank line', text: '\na\tb\n1\t2', want: [['a', 'b'], ['1', '2']] },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(cellsOf(c.text)).toEqual(c.want)
    })
  }

  it('numbers rows by the file line they start on', () => {
    const text = 'a,b\r\n\r\n"multi\nline",1\n2,3\r4,5'
    expect(parseCsv(text).map((r) => r.line)).toEqual([1, 3, 5, 6])
  })
})

describe('decodeText', () => {
  const cases: { name: string; bytes: number[]; want: string }[] = [
    { name: 'UTF-8', bytes: [0x43, 0x68, 0xc3, 0xa2, 0x74], want: 'Chât' },
    { name: 'Windows-1252 from Excel', bytes: [0x43, 0x68, 0xe2, 0x74, 0x80], want: 'Chât€' },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(decodeText(new Uint8Array(c.bytes))).toBe(c.want)
    })
  }
})

describe('toCsv', () => {
  it('quotes, neutralizes formulas and roundtrips', () => {
    const rows = [['name', 'n'], ['Clos "A", rouge', 12.5], ['=1+1', null], ['a;b', -3]]
    const csv = toCsv(rows)
    expect(csv).toBe('﻿name,n\r\n"Clos ""A"", rouge",12.5\r\n\'=1+1,\r\n"a;b",-3\r\n')
    expect(cellsOf(csv)).toEqual([['name', 'n'], ['Clos "A", rouge', '12.5'], ["'=1+1", ''], ['a;b', '-3']])
  })
})
