import type { Movement, Tasting, Wine } from './types'

/** A minimal wine for tests; override only the fields a test cares about. */
export function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: 'w1',
    name: 'Wine',
    producer: 'Producer',
    vintage: 2020,
    grapes: [],
    region: '',
    country: '',
    color: 'red',
    sizeCl: 75,
    tags: [],
    wished: false,
    value: null,
    valueHistory: [],
    photoId: null,
    drinkBy: null,
    tasteAgainOn: null,
    createdAt: 0,
    ...overrides,
  }
}

export function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'm1',
    wineId: 'w1',
    date: '2026-01-01',
    kind: 'add',
    quantity: 1,
    cellarId: 'main',
    toCellarId: null,
    unitPrice: null,
    note: '',
    ...overrides,
  }
}

export function makeTasting(overrides: Partial<Tasting> = {}): Tasting {
  return { id: 't1', wineId: 'w1', date: '2026-01-01', rating: 3.5, notes: '', ...overrides }
}
