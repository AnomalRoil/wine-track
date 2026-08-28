import { describe, expect, it } from 'vitest'
import { avgRating, distinctGrapes, emptyFilter, filterWines, sortWines } from './filters'
import type { Tasting, Wine } from './types'

function wine(overrides: Partial<Wine>): Wine {
  return {
    id: 'w1',
    name: 'Wine',
    producer: 'Producer',
    vintage: 2020,
    grapes: [],
    region: '',
    country: '',
    color: 'red',
    photoId: null,
    bottlesOwned: 0,
    drinkBy: null,
    tasteAgainOn: null,
    createdAt: 0,
    ...overrides,
  }
}

function tasting(overrides: Partial<Tasting>): Tasting {
  return { id: 't1', wineId: 'w1', date: '2026-01-01', rating: 3, notes: '', ...overrides }
}

const chablis = wine({ id: 'w1', name: 'Chablis', producer: 'Dauvissat', vintage: 2020, grapes: ['Chardonnay'], color: 'white', region: 'Chablis', country: 'France', createdAt: 1 })
const margaux = wine({ id: 'w2', name: 'Château Margaux', producer: 'Margaux', vintage: 2015, grapes: ['Cabernet Sauvignon', 'Merlot'], color: 'red', region: 'Margaux', country: 'France', bottlesOwned: 2, createdAt: 2 })
const champagne = wine({ id: 'w3', name: 'Brut Réserve', producer: 'Billecart', vintage: null, grapes: ['chardonnay', 'Pinot Noir'], color: 'sparkling', country: 'France', createdAt: 3 })
const wines = [chablis, margaux, champagne]

describe('filterWines', () => {
  it('returns everything on the empty filter', () => {
    expect(filterWines(wines, [], emptyFilter())).toEqual(wines)
  })

  const cases: { name: string; patch: Partial<ReturnType<typeof emptyFilter>>; want: string[] }[] = [
    { name: 'search by producer', patch: { search: 'dauvissat' }, want: ['w1'] },
    { name: 'search by grape', patch: { search: 'pinot' }, want: ['w3'] },
    { name: 'search by vintage', patch: { search: '2015' }, want: ['w2'] },
    { name: 'color', patch: { colors: ['white', 'sparkling'] }, want: ['w1', 'w3'] },
    { name: 'vintage range excludes non-vintage', patch: { vintageMin: 2000, vintageMax: 2016 }, want: ['w2'] },
    { name: 'grape is case-insensitive', patch: { grape: 'Chardonnay' }, want: ['w1', 'w3'] },
    { name: 'owned only', patch: { ownedOnly: true }, want: ['w2'] },
  ]
  for (const c of cases) {
    it(c.name, () => {
      const got = filterWines(wines, [], { ...emptyFilter(), ...c.patch }).map((w) => w.id)
      expect(got).toEqual(c.want)
    })
  }

  it('min rating uses the average and excludes unrated wines', () => {
    const tastings = [
      tasting({ id: 't1', wineId: 'w1', rating: 5 }),
      tasting({ id: 't2', wineId: 'w1', rating: 4 }),
      tasting({ id: 't3', wineId: 'w2', rating: 2 }),
    ]
    const got = filterWines(wines, tastings, { ...emptyFilter(), minRating: 4 }).map((w) => w.id)
    expect(got).toEqual(['w1'])
  })
})

describe('sortWines', () => {
  it('recent puts newest first', () => {
    expect(sortWines(wines, [], 'recent').map((w) => w.id)).toEqual(['w3', 'w2', 'w1'])
  })
  it('vintage puts non-vintage last', () => {
    expect(sortWines(wines, [], 'vintage').map((w) => w.id)).toEqual(['w1', 'w2', 'w3'])
  })
  it('rating puts unrated last', () => {
    const tastings = [tasting({ id: 't1', wineId: 'w2', rating: 4 })]
    expect(sortWines(wines, tastings, 'rating')[0].id).toBe('w2')
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
