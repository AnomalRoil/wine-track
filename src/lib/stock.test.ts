import { describe, expect, it } from 'vitest'
import { averageBuyPrice, averageBuyPrices, bottlesOf, canRecord, canRemoveCellar, computeStock, emptyCellar, withinStock } from './stock'
import { makeMovement as mv } from './testing'

const movements = [
  mv({ id: 'a', quantity: 6, cellarId: 'home', unitPrice: 10 }),
  mv({ id: 'b', quantity: 2, cellarId: 'home', unitPrice: 16 }),
  mv({ id: 'c', kind: 'consume', quantity: 1, cellarId: 'home' }),
  mv({ id: 'd', kind: 'transfer', quantity: 3, cellarId: 'home', toCellarId: 'cave' }),
  mv({ id: 'e', kind: 'gift', quantity: 1, cellarId: 'cave' }),
  mv({ id: 'f', wineId: 'w2', quantity: 1, cellarId: 'cave' }),
  mv({ id: 'g', wineId: 'w2', kind: 'adjust', quantity: 1, cellarId: 'cave' }),
]

describe('computeStock', () => {
  const stock = computeStock(movements)
  const cases: { name: string; wineId: string; cellarId?: string; want: number }[] = [
    { name: 'per cellar after removal and transfer out', wineId: 'w1', cellarId: 'home', want: 4 },
    { name: 'per cellar after transfer in and gift', wineId: 'w1', cellarId: 'cave', want: 2 },
    { name: 'total', wineId: 'w1', want: 6 },
    { name: 'emptied by adjustment', wineId: 'w2', want: 0 },
    { name: 'unknown wine', wineId: 'nope', want: 0 },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(bottlesOf(stock, c.wineId, c.cellarId)).toBe(c.want)
    })
  }

  it('drops cellars that reach zero', () => {
    expect([...stock.get('w2')!.keys()]).toEqual([])
  })
})

describe('averageBuyPrice', () => {
  it('weights by quantity and skips unpriced additions', () => {
    expect(averageBuyPrice([...movements, mv({ id: 'x', quantity: 10 })], 'w1')).toBe(11.5)
  })
  it('is null without priced additions', () => {
    expect(averageBuyPrice(movements, 'w2')).toBeNull()
  })
  it('matches the per-wine map', () => {
    expect(averageBuyPrices(movements)).toEqual(new Map([['w1', 11.5]]))
  })
})

describe('emptyCellar', () => {
  const stock = computeStock(movements)
  let n = 0
  const id = () => `new${++n}`

  it('transfers every bottle to the target', () => {
    const out = emptyCellar(stock, 'home', 'cave', '2026-10-09', id)
    expect(out).toEqual([mv({ id: 'new1', date: '2026-10-09', kind: 'transfer', quantity: 4, cellarId: 'home', toCellarId: 'cave' })])
    expect(bottlesOf(computeStock([...movements, ...out]), 'w1', 'home')).toBe(0)
  })

  it('adjusts stock away without a target', () => {
    const out = emptyCellar(stock, 'cave', null, '2026-10-09', id)
    expect(out).toEqual([mv({ id: 'new2', date: '2026-10-09', kind: 'adjust', quantity: 2, cellarId: 'cave' })])
  })
})

describe('withinStock', () => {
  // home: w1 4, cave: w1 2, w2 none
  const stock = computeStock(movements)
  const cases = [
    { name: 'consume within stock', movements: [mv({ kind: 'consume', quantity: 4, cellarId: 'home' })], want: true },
    { name: 'consume beyond stock', movements: [mv({ kind: 'consume', quantity: 5, cellarId: 'home' })], want: false },
    { name: 'gift from an emptied wine', movements: [mv({ wineId: 'w2', kind: 'gift', quantity: 1, cellarId: 'cave' })], want: false },
    {
      name: 'transfer beyond stock',
      movements: [mv({ kind: 'transfer', quantity: 3, cellarId: 'cave', toCellarId: 'home' })],
      want: false,
    },
    {
      name: 'removals summed per cellar',
      movements: [mv({ kind: 'consume', quantity: 1, cellarId: 'cave' }), mv({ kind: 'gift', quantity: 2, cellarId: 'cave' })],
      want: false,
    },
    { name: 'additions', movements: [mv({ wineId: 'w2', quantity: 3, cellarId: 'cave' })], want: true },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(withinStock(stock, c.movements)).toBe(c.want)
    })
  }
})

describe('canRecord', () => {
  // home: w1 4, cave: w1 2
  const stock = computeStock(movements)
  const wines = new Set(['w1', 'w2'])
  const cellars = new Set(['home', 'cave'])
  const cases = [
    { name: 'removal within stock', movements: [mv({ kind: 'consume', quantity: 4, cellarId: 'home' })], want: true },
    { name: 'removal beyond stock', movements: [mv({ kind: 'consume', quantity: 5, cellarId: 'home' })], want: false },
    { name: 'addition of a deleted wine', movements: [mv({ wineId: 'gone', cellarId: 'home' })], want: false },
    { name: 'addition to a deleted cellar', movements: [mv({ cellarId: 'gone' })], want: false },
    {
      name: 'transfer to a deleted cellar',
      movements: [mv({ kind: 'transfer', cellarId: 'home', toCellarId: 'gone' })],
      want: false,
    },
    { name: 'transfer between stored cellars', movements: [mv({ kind: 'transfer', cellarId: 'home', toCellarId: 'cave' })], want: true },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(canRecord(stock, c.movements, wines, cellars)).toBe(c.want)
    })
  }
})

describe('canRemoveCellar', () => {
  const cases = [
    { name: 'one of two, bottles dropped', cellars: ['a', 'b'], id: 'a', target: null, want: true },
    { name: 'one of two, bottles moved', cellars: ['a', 'b'], id: 'a', target: 'b', want: true },
    { name: 'the last one', cellars: ['a'], id: 'a', target: null, want: false },
    { name: 'already deleted', cellars: ['b', 'c'], id: 'a', target: null, want: false },
    { name: 'target deleted', cellars: ['a', 'c'], id: 'a', target: 'b', want: false },
    { name: 'target is itself', cellars: ['a', 'b'], id: 'a', target: 'a', want: false },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(canRemoveCellar(c.cellars, c.id, c.target)).toBe(c.want)
    })
  }
})
