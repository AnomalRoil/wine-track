import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv'

describe('parseCsv', () => {
  const cases: { name: string; text: string; want: string[][] }[] = [
    { name: 'commas', text: 'a,b\n1,2\n', want: [['a', 'b'], ['1', '2']] },
    { name: 'semicolons with decimal commas', text: 'a;b\r\n1,5;2', want: [['a', 'b'], ['1,5', '2']] },
    { name: 'tabs', text: 'a\tb\n1\t2', want: [['a', 'b'], ['1', '2']] },
    { name: 'quotes, escaped quotes and newlines', text: 'a,b\n"x, ""y""","line1\nline2"', want: [['a', 'b'], ['x, "y"', 'line1\nline2']] },
    { name: 'BOM and blank lines', text: '﻿a,b\n\n,\n1,2', want: [['a', 'b'], ['1', '2']] },
    { name: 'delimiter inside quoted header', text: '"a;b",c\n1,2', want: [['a;b', 'c'], ['1', '2']] },
    { name: 'empty', text: '', want: [] },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(parseCsv(c.text)).toEqual(c.want)
    })
  }
})

describe('toCsv', () => {
  it('quotes, neutralizes formulas and roundtrips', () => {
    const rows = [['name', 'n'], ['Clos "A", rouge', 12.5], ['=1+1', null], ['a;b', -3]]
    const csv = toCsv(rows)
    expect(csv).toBe('﻿name,n\r\n"Clos ""A"", rouge",12.5\r\n\'=1+1,\r\n"a;b",-3\r\n')
    expect(parseCsv(csv)).toEqual([['name', 'n'], ['Clos "A", rouge', '12.5'], ["'=1+1", ''], ['a;b', '-3']])
  })
})
