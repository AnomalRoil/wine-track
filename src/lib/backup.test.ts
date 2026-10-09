import { describe, expect, it } from 'vitest'
import { parseBackup, serializeBackup } from './backup'
import { makeMovement, makeWine } from './testing'
import type { Tasting } from './types'

const wine = makeWine({ id: 'w1', name: 'Chablis', photoId: 'p1', tags: ['Fish'], value: 30, valueHistory: [{ date: '2026-08-28', value: 30 }] })
const tasting: Tasting = { id: 't1', wineId: 'w1', date: '2026-08-28', rating: 4.5, notes: 'minerality' }
const photo = { id: 'p1', mediaType: 'image/jpeg', data: 'AAAA' }

describe('backup', () => {
  it('roundtrips through serialize and parse', () => {
    const data = {
      wines: [wine],
      tastings: [tasting],
      cellars: [{ id: 'main', name: '', position: 0, storage: { temperature: 'cool', light: 'bright' } }],
      movements: [makeMovement({ unitPrice: 12.5 })],
    }
    const parsed = parseBackup(serializeBackup(data, [photo], '2026-08-28T10:00:00Z'))
    expect(parsed).toEqual({ app: 'wine-track', version: 2, exportedAt: '2026-08-28T10:00:00Z', ...data, photos: [photo] })
  })

  it('upgrades a version 1 backup, turning stock counters into additions', () => {
    const v1Wine = {
      id: 'w1',
      name: 'Chablis',
      producer: 'Dauvissat',
      vintage: 2020,
      grapes: ['Chardonnay'],
      region: 'Chablis',
      country: 'France',
      color: 'white',
      photoId: null,
      bottlesOwned: 3,
      drinkBy: null,
      tasteAgainOn: null,
      createdAt: Date.UTC(2026, 7, 28),
    }
    const json = JSON.stringify({ app: 'wine-track', version: 1, exportedAt: '', wines: [v1Wine, { ...v1Wine, id: 'w2', bottlesOwned: 0 }], tastings: [tasting], photos: [] })
    const parsed = parseBackup(json)
    expect(parsed?.version).toBe(2)
    expect(parsed?.cellars).toEqual([{ id: 'main', name: '', position: 0, storage: {} }])
    expect(parsed?.wines.map((w) => [w.id, w.sizeCl, w.tags, w.wished, w.value])).toEqual([
      ['w1', 75, [], false, null],
      ['w2', 75, [], false, null],
    ])
    expect(parsed?.wines[0]).not.toHaveProperty('bottlesOwned')
    expect(parsed?.movements).toEqual([
      makeMovement({ id: 'w1-v1', wineId: 'w1', date: '2026-08-28', quantity: 3, cellarId: 'main' }),
    ])
    expect(parsed?.tastings).toEqual([tasting])
  })

  it('gives cellars from older version 2 backups an empty storage checklist', () => {
    const json = JSON.stringify({ app: 'wine-track', version: 2, exportedAt: '', wines: [], tastings: [], cellars: [{ id: 'main', name: '', position: 0 }], movements: [], photos: [] })
    expect(parseBackup(json)?.cellars).toEqual([{ id: 'main', name: '', position: 0, storage: {} }])
  })

  const invalid: { name: string; json: string }[] = [
    { name: 'not JSON', json: 'not json {' },
    { name: 'foreign JSON', json: '{"foo": "bar"}' },
    { name: 'wrong app', json: '{"app":"other","version":2,"exportedAt":"","wines":[],"tastings":[],"cellars":[{"id":"a","name":"","position":0}],"movements":[],"photos":[]}' },
    { name: 'unknown version', json: '{"app":"wine-track","version":3,"exportedAt":"","wines":[],"tastings":[],"photos":[]}' },
    { name: 'no cellar', json: '{"app":"wine-track","version":2,"exportedAt":"","wines":[],"tastings":[],"cellars":[],"movements":[],"photos":[]}' },
    { name: 'malformed wine', json: '{"app":"wine-track","version":1,"exportedAt":"","wines":[{"id":1}],"tastings":[],"photos":[]}' },
  ]
  for (const c of invalid) {
    it(`rejects ${c.name}`, () => {
      expect(parseBackup(c.json)).toBeNull()
    })
  }
})
