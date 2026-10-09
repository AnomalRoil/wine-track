import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { exportCsv, templateCsv } from './csvExport'
import { parseImport, planImport } from './csvImport'
import { makeMovement as mv, makeWine } from './testing'

const HEADER = ['cellar', 'name', 'producer', 'vintage', 'quantity', 'size (cl)', 'color', 'region', 'country', 'grapes', 'purchase price', 'notes', 'tags', 'drink from', 'peak from', 'peak until', 'drink until']
const cellsOf = (text: string) => parseCsv(text).map((r) => r.cells)

const cellars = [
  { id: 'b', name: 'Garage', position: 1, storage: {} },
  { id: 'main', name: '', position: 0, storage: {} },
]
const name = (id: string) => cellars.find((c) => c.id === id)!.name || 'My cellar'
const wines = [
  makeWine({ id: 'w1', name: 'Clos', producer: 'Zed', grapes: ['Syrah', 'Grenache'], tags: ['party'], sizeCl: 150, drinkFrom: 2024, peakUntil: 2032 }),
  makeWine({ id: 'w2', name: '=Formula', producer: 'Abel', vintage: null, color: 'white' }),
  makeWine({ id: 'w3', name: 'Gone', producer: 'Abel', sizeCl: 1500 }),
]
const movements = [
  mv({ id: '1', wineId: 'w1', quantity: 4, cellarId: 'main', unitPrice: 10, note: 'fair' }),
  mv({ id: '2', wineId: 'w1', quantity: 2, cellarId: 'b', unitPrice: 15 }),
  mv({ id: '3', wineId: 'w2', quantity: 1, cellarId: 'b' }),
  mv({ id: '4', wineId: 'w3', quantity: 1, cellarId: 'b' }),
  mv({ id: '5', wineId: 'w3', kind: 'consume', quantity: 1, cellarId: 'b' }),
]

describe('exportCsv', () => {
  const csv = exportCsv(wines, movements, cellars, name)

  it('writes one row per wine and cellar, then wines out of stock', () => {
    expect(cellsOf(csv)).toEqual([
      HEADER,
      ['My cellar', 'Clos', 'Zed', '2020', '4', '150', 'red', '', '', 'Syrah, Grenache', '11.67', 'fair', 'party', '2024', '', '2032', ''],
      ['Garage', "'=Formula", 'Abel', '', '1', '75', 'white', '', '', '', '', '', '', '', '', '', ''],
      ['Garage', 'Clos', 'Zed', '2020', '2', '150', 'red', '', '', 'Syrah, Grenache', '11.67', '', 'party', '2024', '', '2032', ''],
      ['', 'Gone', 'Abel', '2020', '0', '1500', 'red', '', '', '', '', '', '', '', '', '', ''],
    ])
  })

  it('reimports onto the same wines', () => {
    const parsed = parseImport(csv, 2026)
    if (!parsed.ok) throw new Error(parsed.error)
    const plan = planImport(parsed.rows, wines, { cellars, defaultCellarName: 'My cellar', date: '', now: 0, newId: () => 'new' })
    expect(plan.matches.map((m) => m.kind)).toEqual(['existing', 'existing', 'existing', 'existing'])
    expect(parsed.rows[1].draft.name).toBe('=Formula')
    expect(plan.cellars).toEqual([])
    expect(parsed.rows[0].window).toEqual({ drinkFrom: 2024, peakFrom: null, peakUntil: 2032, drinkUntil: null })
  })
})

it('reimports nonstandard sizes in centiliters', () => {
  const odd = [makeWine({ id: 'w', name: 'Big', sizeCl: 500 }), makeWine({ id: 'm', name: 'Mini', sizeCl: 5 })]
  const parsed = parseImport(exportCsv(odd, [], cellars, name), 2026)
  if (!parsed.ok) throw new Error(parsed.error)
  expect(parsed.rows.map((r) => r.draft.sizeCl)).toEqual([500, 5])
})

describe('templateCsv', () => {
  it('holds the header only', () => {
    expect(cellsOf(templateCsv())).toEqual([HEADER])
  })
})
