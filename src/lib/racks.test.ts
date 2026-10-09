import { describe, expect, it } from 'vitest'
import { cellarLosing, matchesPerLayer, outside, place, placementsOf, slotName, slotsFreed, stalePlacements, unplaced } from './racks'
import { computeStock } from './stock'
import { makeMovement as mv } from './testing'
import type { Rack } from './types'

function rack(overrides: Partial<Rack> = {}): Rack {
  return { id: 'r1', cellarId: 'home', name: '', columns: 4, rows: 3, depth: 1, layout: 'lying', position: 0, ...overrides }
}

const racks = [rack(), rack({ id: 'r2', position: 1, depth: 2 }), rack({ id: 'r3', cellarId: 'cave' })]
const stock = computeStock([
  mv({ id: 'a', wineId: 'w1', quantity: 3, cellarId: 'home' }),
  mv({ id: 'b', wineId: 'w2', quantity: 1, cellarId: 'home' }),
  mv({ id: 'c', wineId: 'w1', quantity: 2, cellarId: 'cave' }),
])

describe('slotName', () => {
  const cases = [
    { row: 0, column: 0, want: 'A1' },
    { row: 1, column: 2, want: 'B3' },
    { row: 25, column: 23, want: 'Z24' },
  ]
  for (const c of cases) {
    it(`row ${c.row} column ${c.column}`, () => {
      expect(slotName(c)).toBe(c.want)
    })
  }
})

describe('outside', () => {
  const placements = [
    place({ rackId: 'r2', layer: 0, row: 0, column: 3 }, 'w1'),
    place({ rackId: 'r2', layer: 1, row: 0, column: 0 }, 'w1'),
    place({ rackId: 'r2', layer: 0, row: 2, column: 0 }, 'w1'),
    place({ rackId: 'r1', layer: 0, row: 2, column: 3 }, 'w1'),
  ]
  const cases = [
    { name: 'same size', next: rack({ id: 'r2', depth: 2 }), want: [] },
    { name: 'fewer columns', next: rack({ id: 'r2', depth: 2, columns: 3 }), want: ['r2/0/0/3'] },
    { name: 'fewer rows', next: rack({ id: 'r2', depth: 2, rows: 2 }), want: ['r2/0/2/0'] },
    { name: 'single layer', next: rack({ id: 'r2', depth: 1 }), want: ['r2/1/0/0'] },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(outside(c.next, placements).map((p) => p.id)).toEqual(c.want)
    })
  }
})

describe('unplaced and placementsOf', () => {
  const placements = [
    place({ rackId: 'r2', layer: 0, row: 0, column: 0 }, 'w1'),
    place({ rackId: 'r1', layer: 0, row: 1, column: 1 }, 'w1'),
    place({ rackId: 'r3', layer: 0, row: 0, column: 0 }, 'w1'),
    place({ rackId: 'r1', layer: 0, row: 0, column: 0 }, 'w2'),
  ]
  it('counts in-stock bottles of the cellar not in a slot', () => {
    expect(unplaced(stock, racks, placements, 'home')).toEqual(new Map([['w1', 1]]))
    expect(unplaced(stock, racks, placements, 'cave')).toEqual(new Map([['w1', 1]]))
  })
  it('lists a wine’s slots in the cellar, rack order first', () => {
    expect(placementsOf(racks, placements, 'w1', 'home').map((p) => p.id)).toEqual(['r1/0/1/1', 'r2/0/0/0'])
  })
})

describe('slotsFreed', () => {
  const cases = [
    { name: 'enough unplaced bottles', available: 5, quantity: 2, placed: 3, want: 0 },
    { name: 'some placed bottles leave', available: 5, quantity: 4, placed: 3, want: 2 },
    { name: 'everything leaves', available: 3, quantity: 3, placed: 3, want: 3 },
    { name: 'nothing placed', available: 3, quantity: 3, placed: 0, want: 0 },
    { name: 'more than available', available: 2, quantity: 5, placed: 2, want: 2 },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(slotsFreed(c.available, c.quantity, c.placed)).toBe(c.want)
    })
  }
})

describe('stalePlacements', () => {
  const cases = [
    { name: 'valid placement', p: place({ rackId: 'r1', layer: 0, row: 0, column: 0 }, 'w2'), stale: false },
    { name: 'unknown wine', p: place({ rackId: 'r1', layer: 0, row: 0, column: 0 }, 'gone'), stale: true },
    { name: 'unknown rack', p: place({ rackId: 'gone', layer: 0, row: 0, column: 0 }, 'w2'), stale: true },
    { name: 'outside the rack', p: place({ rackId: 'r1', layer: 1, row: 0, column: 0 }, 'w2'), stale: true },
    { name: 'wine not in this cellar', p: place({ rackId: 'r3', layer: 0, row: 0, column: 0 }, 'w2'), stale: true },
  ]
  const wines = new Set(['w1', 'w2'])
  for (const c of cases) {
    it(c.name, () => {
      expect(stalePlacements(wines, racks, [c.p], stock)).toEqual(c.stale ? [c.p] : [])
    })
  }

  it('frees the last slots when more are placed than in stock', () => {
    const placements = [
      place({ rackId: 'r2', layer: 1, row: 0, column: 0 }, 'w1'),
      place({ rackId: 'r1', layer: 0, row: 0, column: 1 }, 'w1'),
      place({ rackId: 'r2', layer: 0, row: 0, column: 0 }, 'w1'),
      place({ rackId: 'r1', layer: 0, row: 0, column: 0 }, 'w1'),
    ]
    expect(stalePlacements(wines, racks, placements, stock).map((p) => p.id)).toEqual(['r2/1/0/0'])
  })
})

describe('matchesPerLayer', () => {
  const placements = [
    place({ rackId: 'r2', layer: 1, row: 0, column: 0 }, 'w1'),
    place({ rackId: 'r2', layer: 1, row: 0, column: 1 }, 'w1'),
    place({ rackId: 'r2', layer: 0, row: 0, column: 0 }, 'w2'),
    place({ rackId: 'r1', layer: 0, row: 0, column: 0 }, 'w1'),
  ]
  const cases = [
    { name: 'back layer only', rack: racks[1], wines: ['w1'], want: [0, 2] },
    { name: 'both layers', rack: racks[1], wines: ['w1', 'w2'], want: [1, 2] },
    { name: 'no match', rack: racks[1], wines: ['w3'], want: [0, 0] },
    { name: 'single layer rack', rack: racks[0], wines: ['w1'], want: [1] },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(matchesPerLayer(c.rack, placements, new Set(c.wines))).toEqual(c.want)
    })
  }
})

describe('cellarLosing', () => {
  const cases = [
    { name: 'addition', m: mv({ kind: 'add', cellarId: 'home' }), want: 'home' },
    { name: 'transfer', m: mv({ kind: 'transfer', cellarId: 'home', toCellarId: 'cave' }), want: 'cave' },
    { name: 'consumption', m: mv({ kind: 'consume', cellarId: 'home' }), want: null },
    { name: 'adjustment', m: mv({ kind: 'adjust', cellarId: 'home' }), want: null },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(cellarLosing(c.m)).toBe(c.want)
    })
  }
})
