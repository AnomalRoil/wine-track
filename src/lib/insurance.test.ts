import { describe, expect, it } from 'vitest'
import { buildInventory, renderInventory } from './insurance'
import { en } from './messages/io'
import { makeMovement as mv, makeWine } from './testing'

const cellars = [
  { id: 'b', name: 'Garage', position: 1 },
  { id: 'a', name: 'Home', position: 0 },
  { id: 'c', name: 'Empty', position: 2 },
]
const wines = [
  makeWine({ id: 'w1', producer: 'Zed', value: 40 }),
  makeWine({ id: 'w2', producer: 'Abel <script>', value: null }),
  makeWine({ id: 'w3', producer: 'Mid', value: 25 }),
]
const movements = [
  mv({ id: '1', wineId: 'w1', quantity: 3, cellarId: 'a', unitPrice: 20 }),
  mv({ id: '2', wineId: 'w1', quantity: 1, cellarId: 'b', unitPrice: 30 }),
  mv({ id: '3', wineId: 'w2', quantity: 2, cellarId: 'a' }),
  mv({ id: '4', wineId: 'w3', quantity: 2, cellarId: 'b' }),
  mv({ id: '5', wineId: 'w3', kind: 'consume', quantity: 2, cellarId: 'b' }),
]

describe('buildInventory', () => {
  const inv = buildInventory(wines, movements, cellars)

  it('groups bottles in stock by cellar order, sorted by producer', () => {
    expect(inv.cellars.map((c) => [c.cellarId, c.lines.map((l) => [l.wine.id, l.quantity, l.purchase, l.value])])).toEqual([
      ['a', [['w2', 2, null, null], ['w1', 3, 22.5, 40]]],
      ['b', [['w1', 1, 22.5, 40]]],
    ])
  })

  it('totals only known amounts', () => {
    expect(inv.cellars.map(({ bottles, purchase, value }) => ({ bottles, purchase, value }))).toEqual([
      { bottles: 5, purchase: 67.5, value: 120 },
      { bottles: 1, purchase: 22.5, value: 40 },
    ])
    expect([inv.bottles, inv.purchase, inv.value]).toEqual([6, 90, 160])
  })

  it('lists bottles without any price', () => {
    expect(inv.unpriced.map((l) => [l.wine.id, l.cellarId, l.quantity])).toEqual([['w2', 'a', 2]])
  })
})

describe('renderInventory', () => {
  const html = renderInventory(buildInventory(wines, movements, cellars), {
    owner: 'Ana <b>',
    address: '1 Rue X\n1000 Town',
    date: '9 Oct 2026',
    lang: 'en',
    t: (key) => en[key],
    money: (n) => `€${n.toFixed(2)}`,
    cellarName: (id) => cellars.find((c) => c.id === id)!.name,
  })

  const cases: { name: string; want: string }[] = [
    { name: 'owner, escaped', want: 'Ana &lt;b&gt;' },
    { name: 'address', want: '1 Rue X\n1000 Town' },
    { name: 'date', want: '9 Oct 2026' },
    { name: 'cellar heading', want: '<h2>Garage</h2>' },
    { name: 'grand total value', want: '<dt>Total estimated value</dt><dd>€160.00</dd>' },
    { name: 'unpriced bottle count', want: '<dt>Bottles without any price</dt><dd>2</dd>' },
    { name: 'escaped wine text', want: 'Abel &lt;script&gt;' },
    { name: 'disclaimer', want: en['io.doc.disclaimer'] },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(html).toContain(c.want)
    })
  }

  it('never injects markup from data', () => {
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<h2>Empty</h2>')
  })
})
