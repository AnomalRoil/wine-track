import { describe, expect, it } from 'vitest'
import {
  addMonths,
  composition,
  consumedRegions,
  drinkShortcuts,
  drinkStatus,
  monthlyFlows,
  ratingHistogram,
  topAddedValue,
  totals,
  valueOverTime,
  yearlyFlows,
  yearlyValues,
  type Dimension,
} from './stats'
import { computeStock } from './stock'
import { makeMovement, makeWine } from './testing'
import type { Tasting, Wine } from './types'

const wines = [
  makeWine({ id: 'a', color: 'red', country: 'France', region: 'Bordeaux', grapes: ['Merlot', 'Cabernet Franc'], vintage: 2015, value: 40 }),
  makeWine({ id: 'b', color: 'white', country: 'france', region: 'Chablis', grapes: ['Chardonnay'], vintage: null, sizeCl: 150 }),
  makeWine({ id: 'c', color: 'red', country: '', region: 'bordeaux', grapes: [], vintage: 2015, value: 10 }),
  makeWine({ id: 'gone', region: 'Jura' }),
]
const movements = [
  makeMovement({ id: '1', wineId: 'a', quantity: 3, unitPrice: 20, date: '2025-11-03' }),
  makeMovement({ id: '2', wineId: 'b', quantity: 2, cellarId: 'cave', date: '2026-01-10' }),
  makeMovement({ id: '3', wineId: 'c', quantity: 1, unitPrice: 15, date: '2026-02-01' }),
  makeMovement({ id: '4', wineId: 'a', kind: 'consume', quantity: 1, date: '2026-03-05' }),
  makeMovement({ id: '5', wineId: 'gone', quantity: 1, date: '2024-06-01' }),
  makeMovement({ id: '6', wineId: 'gone', kind: 'gift', quantity: 1, date: '2026-03-20' }),
  makeMovement({ id: '7', wineId: 'a', kind: 'transfer', quantity: 1, toCellarId: 'cave', date: '2026-03-21' }),
]
const stock = computeStock(movements)

describe('totals', () => {
  it('sums bottles, cost and value of the stock', () => {
    expect(totals(wines, movements, stock)).toEqual({
      bottles: 5,
      wines: 3,
      invested: 2 * 20 + 15,
      value: 2 * 40 + 10,
      added: 2 * 20 - 5,
      unpriced: 2,
    })
  })

  it('values bottles without an estimate at their purchase price', () => {
    const moves = [makeMovement({ wineId: 'x', quantity: 2, unitPrice: 12 })]
    const got = totals([makeWine({ id: 'x', value: null })], moves, computeStock(moves))
    expect([got.invested, got.value, got.added]).toEqual([24, 24, 0])
  })

  it('is zero for an empty collection', () => {
    expect(totals([], [], new Map())).toEqual({ bottles: 0, wines: 0, invested: 0, value: 0, added: 0, unpriced: 0 })
  })
})

describe('composition', () => {
  const cases: { dimension: Dimension; want: [string, number][] }[] = [
    { dimension: 'color', want: [['red', 3], ['white', 2]] },
    { dimension: 'country', want: [['France', 4], ['', 1]] },
    { dimension: 'region', want: [['Bordeaux', 3], ['Chablis', 2]] },
    { dimension: 'grape', want: [['Cabernet Franc', 2], ['Chardonnay', 2], ['Merlot', 2], ['', 1]] },
    { dimension: 'vintage', want: [['2015', 3], ['', 2]] },
    { dimension: 'size', want: [['75', 3], ['150', 2]] },
    { dimension: 'cellar', want: [['cave', 3], ['main', 2]] },
  ]
  for (const { dimension, want } of cases) {
    it(`groups bottles by ${dimension}`, () => {
      const got = composition(wines, stock, dimension)
      expect(got.map((s) => [s.key, s.count])).toEqual(want)
      expect(got[0].share).toBeCloseTo(want[0][1] / 5)
    })
  }
})

it('counts a grape listed in two spellings once per wine', () => {
  const wine = makeWine({ id: 'a', grapes: ['Merlot', 'merlot '] })
  expect(composition([wine], computeStock([makeMovement({ wineId: 'a', quantity: 2 })]), 'grape')).toEqual([{ key: 'Merlot', count: 2, share: 1 }])
})

describe('flows', () => {
  it('counts additions, drinks and gifts per month over the last months', () => {
    const got = monthlyFlows(movements, '2026-03-31', 4)
    expect(got).toEqual([
      { period: '2025-12', added: 0, drunk: 0, gifted: 0 },
      { period: '2026-01', added: 2, drunk: 0, gifted: 0 },
      { period: '2026-02', added: 1, drunk: 0, gifted: 0 },
      { period: '2026-03', added: 0, drunk: 1, gifted: 1 },
    ])
  })

  it('counts per year from the first movement to today, with empty years', () => {
    expect(yearlyFlows(movements, '2026-04-01')).toEqual([
      { period: '2024', added: 1, drunk: 0, gifted: 0 },
      { period: '2025', added: 3, drunk: 0, gifted: 0 },
      { period: '2026', added: 3, drunk: 1, gifted: 1 },
    ])
  })

  it('has only the current year without movements', () => {
    expect(yearlyFlows([], '2026-04-01')).toEqual([{ period: '2026', added: 0, drunk: 0, gifted: 0 }])
  })
})

describe('addMonths', () => {
  const cases: [string, number, string][] = [
    ['2026-03', 0, '2026-03'],
    ['2026-01', -1, '2025-12'],
    ['2025-12', 1, '2026-01'],
    ['2026-03', -14, '2025-01'],
  ]
  for (const [month, n, want] of cases) {
    it(`addMonths(${month}, ${n}) = ${want}`, () => expect(addMonths(month, n)).toBe(want))
  }
})

describe('valueOverTime', () => {
  it('replays movements and the value history month by month', () => {
    const wine = makeWine({
      id: 'w',
      value: 30,
      valueHistory: [
        { date: '2026-02-15', value: 25 },
        { date: '2026-04-02', value: 30 },
      ],
    })
    const moves = [
      makeMovement({ id: '1', wineId: 'w', quantity: 2, unitPrice: 20, date: '2026-01-20' }),
      makeMovement({ id: '2', wineId: 'w', kind: 'consume', quantity: 1, date: '2026-03-01' }),
    ]
    expect(valueOverTime([wine], moves, '2026-04-10')).toEqual([
      { month: '2026-01', value: 40, invested: 40 },
      { month: '2026-02', value: 50, invested: 40 },
      { month: '2026-03', value: 25, invested: 20 },
      { month: '2026-04', value: 30, invested: 20 },
    ])
  })

  it('averages only the purchases made by each month', () => {
    const wine = makeWine({ id: 'w', value: null })
    const moves = [
      makeMovement({ id: '1', wineId: 'w', quantity: 1, unitPrice: 10, date: '2026-01-05' }),
      makeMovement({ id: '2', wineId: 'w', quantity: 1, unitPrice: 30, date: '2026-02-05' }),
    ]
    expect(valueOverTime([wine], moves, '2026-02-10')).toEqual([
      { month: '2026-01', value: 10, invested: 10 },
      { month: '2026-02', value: 40, invested: 40 },
    ])
  })

  it('ends on the current value once an estimate is cleared', () => {
    const wine = makeWine({ id: 'w', value: null, valueHistory: [{ date: '2026-01-05', value: 50 }] })
    const moves = [makeMovement({ wineId: 'w', quantity: 2, unitPrice: 20, date: '2026-01-02' })]
    expect(valueOverTime([wine], moves, '2026-02-10')).toEqual([
      { month: '2026-01', value: 100, invested: 40 },
      { month: '2026-02', value: 40, invested: 40 },
    ])
  })

  it('keeps a cleared estimate cleared in later months', () => {
    const history = [
      { date: '2026-01-05', value: 50 },
      { date: '2026-02-03', value: null },
    ]
    const wine = makeWine({ id: 'w', value: null, valueHistory: history })
    const moves = [makeMovement({ wineId: 'w', quantity: 2, unitPrice: 20, date: '2026-01-02' })]
    const want = [
      { month: '2026-01', value: 100, invested: 40 },
      { month: '2026-02', value: 40, invested: 40 },
    ]
    expect(valueOverTime([wine], moves, '2026-02-10')).toEqual(want)
    expect(valueOverTime([wine], moves, '2026-03-10')).toEqual([...want, { month: '2026-03', value: 40, invested: 40 }])
  })

  it('is empty without movements', () => {
    expect(valueOverTime(wines, [], '2026-04-10')).toEqual([])
  })
})

describe('yearlyValues', () => {
  it.each([
    { name: 'empty', points: [], want: [] },
    {
      name: 'keeps the last month of each year',
      points: [
        { month: '2024-11', value: 1, invested: 1 },
        { month: '2024-12', value: 2, invested: 1 },
        { month: '2025-01', value: 3, invested: 2 },
        { month: '2025-04', value: 4, invested: 2 },
      ],
      want: [
        { month: '2024', value: 2, invested: 1 },
        { month: '2025', value: 4, invested: 2 },
      ],
    },
  ])('$name', ({ points, want }) => {
    expect(yearlyValues(points)).toEqual(want)
  })
})

describe('topAddedValue', () => {
  it('keeps priced wines in stock that gained value', () => {
    const got = topAddedValue(wines, movements, stock)
    expect(got.map((g) => [g.wine.id, g.bottles, g.added])).toEqual([['a', 2, 40]])
  })
})

describe('consumedRegions', () => {
  it('ranks regions by bottles drunk', () => {
    const moves = [
      makeMovement({ id: '1', wineId: 'a', kind: 'consume', quantity: 2 }),
      makeMovement({ id: '2', wineId: 'c', kind: 'consume', quantity: 1 }),
      makeMovement({ id: '3', wineId: 'b', kind: 'consume', quantity: 1 }),
      makeMovement({ id: '4', wineId: 'b', kind: 'gift', quantity: 5 }),
      makeMovement({ id: '5', wineId: 'deleted', kind: 'consume', quantity: 9 }),
    ]
    expect(consumedRegions(wines, moves)).toEqual([
      { key: 'Bordeaux', count: 3, share: 0.75 },
      { key: 'Chablis', count: 1, share: 0.25 },
    ])
  })
})

describe('ratingHistogram', () => {
  it('rounds ratings to the nearest half star', () => {
    const tasting = (rating: number): Tasting => ({ id: String(rating), wineId: 'a', date: '2026-01-01', rating, notes: '' })
    const got = ratingHistogram([1, 1.2, 3.8, 4, 5, 4.9].map(tasting))
    expect(got.filter((b) => b.count > 0)).toEqual([
      { rating: 1, count: 2 },
      { rating: 4, count: 2 },
      { rating: 5, count: 2 },
    ])
    expect(got).toHaveLength(9)
  })
})

describe('drinkStatus', () => {
  const cases: [string | null, ReturnType<typeof drinkStatus>][] = [
    [null, null],
    ['2026-03-31', 'decline'],
    ['2026-04-01', 'peak'],
    ['2026-09-30', 'peak'],
    ['2027-06-01', 'ready'],
  ]
  for (const [drinkBy, want] of cases) {
    it(`drinkBy ${drinkBy} is ${want}`, () => {
      expect(drinkStatus(makeWine({ drinkBy }), '2026-04-01')).toBe(want)
    })
  }

  const windows: { name: string; wine: Partial<Wine>; want: ReturnType<typeof drinkStatus> }[] = [
    { name: 'young', wine: { drinkFrom: 2028 }, want: null },
    { name: 'maturing', wine: { drinkFrom: 2024, peakFrom: 2028 }, want: 'ready' },
    { name: 'at peak', wine: { peakFrom: 2025, peakUntil: 2027 }, want: 'peak' },
    { name: 'past its window', wine: { drinkUntil: 2025 }, want: 'decline' },
    { name: 'window wins over drink-before date', wine: { drinkFrom: 2028, drinkBy: '2020-01-01' }, want: null },
  ]
  for (const c of windows) {
    it(`uses the drinking window: ${c.name}`, () => {
      expect(drinkStatus(makeWine(c.wine), '2026-04-01')).toBe(c.want)
    })
  }

  it('lists only wines in stock, soonest first', () => {
    const ws = [
      makeWine({ id: 'x', drinkBy: '2026-08-01' }),
      makeWine({ id: 'y', drinkBy: '2026-05-01' }),
      makeWine({ id: 'z', drinkBy: '2020-01-01' }),
    ]
    const s = computeStock([makeMovement({ wineId: 'x' }), makeMovement({ wineId: 'y' })])
    const got = drinkShortcuts(ws, s, '2026-04-01')
    expect(got.peak.map((w) => w.id)).toEqual(['y', 'x'])
    expect(got.decline).toEqual([])
    expect(got.ready).toEqual([])
  })

  it('lists windowed wines before drink-before dates, closing soonest first', () => {
    const ws = [
      makeWine({ id: 'date', drinkBy: '2026-05-01' }),
      makeWine({ id: 'late', peakFrom: 2025, peakUntil: 2030 }),
      makeWine({ id: 'soon', peakFrom: 2025, peakUntil: 2027 }),
    ]
    const s = computeStock(ws.map((w) => makeMovement({ id: w.id, wineId: w.id })))
    expect(drinkShortcuts(ws, s, '2026-04-01').peak.map((w) => w.id)).toEqual(['soon', 'late', 'date'])
  })
})
