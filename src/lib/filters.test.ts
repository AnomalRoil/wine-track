import { describe, expect, it } from 'vitest'
import { avgRating, distinctGrapes, distinctTags, emptyFilter, filterWines, sortWines, type FilterContext } from './filters'
import { computeStock } from './stock'
import { makeMovement, makeWine as wine } from './testing'
import type { Tasting } from './types'

function ctx(tastings: Tasting[] = []): FilterContext {
  const movements = [
    makeMovement({ id: 'm1', wineId: 'w2', quantity: 2, cellarId: 'main', unitPrice: 40 }),
    makeMovement({ id: 'm2', wineId: 'w1', quantity: 1, cellarId: 'other', unitPrice: 20 }),
    makeMovement({ id: 'm3', wineId: 'w1', kind: 'consume', quantity: 1, cellarId: 'other' }),
  ]
  return { tastings, stock: computeStock(movements), buyPrices: new Map([['w1', 20], ['w2', 40]]), year: 2026 }
}

function tasting(overrides: Partial<Tasting>): Tasting {
  return { id: 't1', wineId: 'w1', date: '2026-01-01', rating: 3, notes: '', ...overrides }
}

const chablis = wine({ id: 'w1', name: 'Chablis', producer: 'Dauvissat', vintage: 2020, grapes: ['Chardonnay'], color: 'white', region: 'Chablis', country: 'France', tags: ['Fish'], createdAt: 1, drinkFrom: 2021, drinkUntil: 2025 })
const margaux = wine({ id: 'w2', name: 'Château Margaux', producer: 'Margaux', vintage: 2015, grapes: ['Cabernet Sauvignon', 'Merlot'], color: 'red', region: 'Margaux', country: 'France', value: 500, createdAt: 2, drinkFrom: 2022, peakFrom: 2026, peakUntil: 2040 })
const champagne = wine({ id: 'w3', name: 'Brut Réserve', producer: 'Billecart', vintage: null, grapes: ['chardonnay', 'Pinot Noir'], color: 'sparkling', country: 'France', tags: ['fish', 'Party'], wished: true, value: 45, createdAt: 3 })
const wines = [chablis, margaux, champagne]

describe('filterWines', () => {
  it('returns everything on the empty filter', () => {
    expect(filterWines(wines, ctx(), emptyFilter())).toEqual(wines)
  })

  const cases: { name: string; patch: Partial<ReturnType<typeof emptyFilter>>; want: string[] }[] = [
    { name: 'search by producer', patch: { search: 'dauvissat' }, want: ['w1'] },
    { name: 'search by grape', patch: { search: 'pinot' }, want: ['w3'] },
    { name: 'search by vintage', patch: { search: '2015' }, want: ['w2'] },
    { name: 'color', patch: { colors: ['white', 'sparkling'] }, want: ['w1', 'w3'] },
    { name: 'vintage range excludes non-vintage', patch: { vintageMin: 2000, vintageMax: 2016 }, want: ['w2'] },
    { name: 'grape is case-insensitive', patch: { grape: 'Chardonnay' }, want: ['w1', 'w3'] },
    { name: 'owned only ignores emptied stock', patch: { ownedOnly: true }, want: ['w2'] },
    { name: 'wished only', patch: { wishedOnly: true }, want: ['w3'] },
    { name: 'cellar', patch: { cellarId: 'main' }, want: ['w2'] },
    { name: 'emptied cellar', patch: { cellarId: 'other' }, want: [] },
    { name: 'tag is case-insensitive', patch: { tag: 'FISH' }, want: ['w1', 'w3'] },
    { name: 'search by tag', patch: { search: 'party' }, want: ['w3'] },
    { name: 'phase', patch: { phases: ['peak'] }, want: ['w2'] },
    { name: 'phases exclude unknown windows', patch: { phases: ['decline', 'peak'] }, want: ['w1', 'w2'] },
  ]
  for (const c of cases) {
    it(c.name, () => {
      const got = filterWines(wines, ctx(), { ...emptyFilter(), ...c.patch }).map((w) => w.id)
      expect(got).toEqual(c.want)
    })
  }

  it('min rating uses the average and excludes unrated wines', () => {
    const tastings = [
      tasting({ id: 't1', wineId: 'w1', rating: 5 }),
      tasting({ id: 't2', wineId: 'w1', rating: 4 }),
      tasting({ id: 't3', wineId: 'w2', rating: 2 }),
    ]
    const got = filterWines(wines, ctx(tastings), { ...emptyFilter(), minRating: 4 }).map((w) => w.id)
    expect(got).toEqual(['w1'])
  })
})

describe('sortWines', () => {
  it('recent puts newest first', () => {
    expect(sortWines(wines, ctx(), 'recent').map((w) => w.id)).toEqual(['w3', 'w2', 'w1'])
  })
  it('vintage puts non-vintage last', () => {
    expect(sortWines(wines, ctx(), 'vintage').map((w) => w.id)).toEqual(['w1', 'w2', 'w3'])
  })
  it('rating puts unrated last', () => {
    const tastings = [tasting({ id: 't1', wineId: 'w2', rating: 4 })]
    expect(sortWines(wines, ctx(tastings), 'rating')[0].id).toBe('w2')
  })
  it('value puts unvalued last', () => {
    expect(sortWines(wines, ctx(), 'value').map((w) => w.id)).toEqual(['w2', 'w3', 'w1'])
  })
  it('urgency puts declining first and unknown windows last', () => {
    expect(sortWines([champagne, margaux, chablis], ctx(), 'urgency').map((w) => w.id)).toEqual(['w1', 'w2', 'w3'])
  })
  it('urgency orders a phase by last drinking year', () => {
    const late = wine({ id: 'late', drinkUntil: 2030 })
    const early = wine({ id: 'early', drinkUntil: 2027 })
    expect(sortWines([late, early], ctx(), 'urgency').map((w) => w.id)).toEqual(['early', 'late'])
  })
  it('buyPrice puts unpriced last', () => {
    expect(sortWines(wines, ctx(), 'buyPrice').map((w) => w.id)).toEqual(['w2', 'w1', 'w3'])
  })
})

describe('avgRating', () => {
  it('averages ratings', () => {
    expect(avgRating([tasting({ rating: 4 }), tasting({ id: 't2', rating: 3 })])).toBe(3.5)
  })
  it('returns null with no tastings', () => {
    expect(avgRating([])).toBeNull()
  })
})

describe('distinctGrapes', () => {
  it('dedupes case-insensitively and sorts', () => {
    expect(distinctGrapes(wines)).toEqual(['Cabernet Sauvignon', 'Chardonnay', 'Merlot', 'Pinot Noir'])
  })
})

describe('distinctTags', () => {
  it('dedupes case-insensitively and sorts', () => {
    expect(distinctTags(wines)).toEqual(['Fish', 'Party'])
  })
})
