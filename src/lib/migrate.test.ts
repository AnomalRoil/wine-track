import { describe, expect, it } from 'vitest'
import { migrateWinesV1, normalizeWine } from './migrate'
import { makeWine } from './testing'

describe('normalizeWine grape shares', () => {
  const blend = ['Merlot', 'Cabernet Franc']
  const cases: { name: string; stored: Record<string, number> | undefined; want: Record<string, number> }[] = [
    { name: 'a wine stored before shares existed', stored: undefined, want: {} },
    { name: 'valid shares', stored: { Merlot: 60, 'Cabernet Franc': 40 }, want: { Merlot: 60, 'Cabernet Franc': 40 } },
    { name: 'a share of a grape no longer listed', stored: { Merlot: 60, Syrah: 40 }, want: { Merlot: 60 } },
    { name: 'out-of-range shares', stored: { Merlot: 0, 'Cabernet Franc': 140 }, want: {} },
  ]
  for (const c of cases) {
    it(c.name, () => {
      const { grapeShares, ...older } = makeWine({ grapes: blend })
      expect(normalizeWine(c.stored === undefined ? older : { ...older, grapeShares: c.stored }).grapeShares).toEqual(c.want)
    })
  }
})

describe('normalizeWine', () => {
  const { appellation, lwin, ...stored } = makeWine({ region: 'Bordeaux' })
  const cases = [
    { name: 'stored before appellations gets none', wine: stored, want: { appellation: '', region: 'Bordeaux', lwin: null } },
    { name: 'keeps an appellation', wine: { ...stored, appellation: 'Pauillac', lwin }, want: { appellation: 'Pauillac', region: 'Bordeaux' } },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(normalizeWine(c.wine)).toMatchObject(c.want)
    })
  }
  void appellation
})

it('gives version 1 wines no appellation', () => {
  const { wines } = migrateWinesV1([
    { id: 'w1', name: 'Chablis', producer: 'Dauvissat', vintage: 2020, grapes: [], region: 'Chablis', country: 'France', color: 'white', photoId: null, bottlesOwned: 0, drinkBy: null, tasteAgainOn: null, createdAt: 0 },
  ])
  expect(wines[0]).toMatchObject({ region: 'Chablis', appellation: '' })
})
