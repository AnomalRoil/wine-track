import { describe, expect, it } from 'vitest'
import { parseBackup, serializeBackup } from './backup'
import type { Tasting, Wine } from './types'

const wine: Wine = {
  id: 'w1',
  name: 'Chablis',
  producer: 'Dauvissat',
  vintage: 2020,
  grapes: ['Chardonnay'],
  region: 'Chablis',
  country: 'France',
  color: 'white',
  photoId: 'p1',
  bottlesOwned: 3,
  drinkBy: '2030-01-01',
  tasteAgainOn: null,
  createdAt: 1724800000000,
}

const tasting: Tasting = { id: 't1', wineId: 'w1', date: '2026-08-28', rating: 4.5, notes: 'minerality' }

describe('backup', () => {
  it('roundtrips through serialize and parse', () => {
    const json = serializeBackup([wine], [tasting], [{ id: 'p1', mediaType: 'image/jpeg', data: 'AAAA' }], '2026-08-28T10:00:00Z')
    const parsed = parseBackup(json)
    expect(parsed).not.toBeNull()
    expect(parsed!.wines).toEqual([wine])
    expect(parsed!.tastings).toEqual([tasting])
    expect(parsed!.photos).toEqual([{ id: 'p1', mediaType: 'image/jpeg', data: 'AAAA' }])
  })

  const invalid: { name: string; json: string }[] = [
    { name: 'not JSON', json: 'not json {' },
    { name: 'foreign JSON', json: '{"foo": "bar"}' },
    { name: 'wrong app', json: '{"app":"other","version":1,"exportedAt":"","wines":[],"tastings":[],"photos":[]}' },
    { name: 'wrong version', json: '{"app":"wine-track","version":2,"exportedAt":"","wines":[],"tastings":[],"photos":[]}' },
    { name: 'malformed wine', json: '{"app":"wine-track","version":1,"exportedAt":"","wines":[{"id":1}],"tastings":[],"photos":[]}' },
  ]
  for (const c of invalid) {
    it(`rejects ${c.name}`, () => {
      expect(parseBackup(c.json)).toBeNull()
    })
  }
})
