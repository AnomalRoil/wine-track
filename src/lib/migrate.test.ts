import { describe, expect, it } from 'vitest'
import { migrateWinesV1, normalizeWine } from './migrate'
import { makeWine } from './testing'

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
