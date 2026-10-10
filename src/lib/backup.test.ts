import { describe, expect, it } from 'vitest'
import { NO_AGING } from './aging'
import { parseBackup, serializeBackup } from './backup'
import { emptySheet } from './tasting'
import { makeMovement, makeTasting, makeWine } from './testing'
import type { Tasting } from './types'

const wine = makeWine({
  id: 'w1',
  name: 'Chablis',
  photoId: 'p1',
  tags: ['Fish'],
  lwin: '1066540',
  value: 30,
  valueHistory: [
    { date: '2026-08-20', value: 25 },
    { date: '2026-08-25', value: null },
    { date: '2026-08-28', value: 30 },
  ],
  drinkFrom: 2024,
  peakUntil: 2030,
  servingMinC: 10,
  servingMaxC: 12,
  decantMinutes: 0,
  profile: { body: 4, tannin: 0, sweetness: 1, acidity: 8, fizz: 0 },
})
const tasting: Tasting = { id: 't1', wineId: 'w1', date: '2026-08-28', rating: 4.5, notes: 'minerality' }
const photo = { id: 'p1', mediaType: 'image/jpeg', data: 'AAAA' }

describe('backup', () => {
  it('roundtrips every feature through serialize and parse', () => {
    const detailed = makeTasting({ id: 't2', sheet: { ...emptySheet(), photoIds: ['p2'], aromas: ['plum'] } })
    const tastingPhoto = { id: 'p2', mediaType: 'image/jpeg', data: 'BBBB' }
    const data = {
      wines: [wine],
      tastings: [tasting, detailed],
      cellars: [{ id: 'main', name: '', position: 0, storage: { temperature: 'cool', light: 'bright' } }],
      movements: [makeMovement({ unitPrice: 12.5 })],
      racks: [{ id: 'r1', cellarId: 'main', name: 'Left wall', columns: 6, rows: 4, depth: 2, layout: 'diamond' as const, position: 0 }],
      placements: [{ id: 'r1/1/0/2', rackId: 'r1', layer: 1, row: 0, column: 2, wineId: 'w1' }],
    }
    const parsed = parseBackup(serializeBackup(data, [photo, tastingPhoto], '2026-08-28T10:00:00Z'))
    expect(parsed).toEqual({ app: 'wine-track', version: 2, exportedAt: '2026-08-28T10:00:00Z', ...data, photos: [photo, tastingPhoto] })
  })

  it('fills aging fields and the LWIN missing from an older version 2 backup', () => {
    const { drinkFrom, peakFrom, peakUntil, drinkUntil, servingMinC, servingMaxC, decantMinutes, profile, lwin, ...older } = wine
    const json = JSON.stringify({
      app: 'wine-track',
      version: 2,
      exportedAt: '',
      wines: [older],
      tastings: [],
      cellars: [{ id: 'main', name: '', position: 0 }],
      movements: [],
      photos: [],
    })
    expect(parseBackup(json)?.wines).toEqual([{ ...older, ...NO_AGING, lwin: null }])
  })

  it('reads a version 2 backup made before racks existed', () => {
    const json = JSON.stringify({ app: 'wine-track', version: 2, exportedAt: '', wines: [wine], tastings: [], cellars: [{ id: 'main', name: '', position: 0 }], movements: [], photos: [] })
    const parsed = parseBackup(json)
    expect(parsed?.racks).toEqual([])
    expect(parsed?.placements).toEqual([])
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
    expect(parsed?.wines.map((w) => [w.id, w.sizeCl, w.tags, w.wished, w.value, w.drinkFrom, w.profile])).toEqual([
      ['w1', 75, [], false, null, null, null],
      ['w2', 75, [], false, null, null, null],
    ])
    expect(parsed?.wines[0]).not.toHaveProperty('bottlesOwned')
    expect(parsed?.movements).toEqual([
      makeMovement({ id: 'w1-v1', wineId: 'w1', date: '2026-08-28', quantity: 3, cellarId: 'main' }),
    ])
    expect(parsed?.tastings).toEqual([tasting])
    expect([parsed?.racks, parsed?.placements]).toEqual([[], []])
  })

  function v2(tastings: unknown[]): string {
    return JSON.stringify({ app: 'wine-track', version: 2, exportedAt: '', wines: [], tastings, cellars: [{ id: 'main', name: '', position: 0 }], movements: [], photos: [] })
  }

  it('roundtrips a detailed tasting sheet', () => {
    const detailed = makeTasting({ sheet: { ...emptySheet(), people: ['Ana'], photoIds: ['p2'], shade: 'ruby', aromas: ['cork', 'plum'], tannin: 'high' } })
    expect(parseBackup(v2([detailed]))?.tastings).toEqual([detailed])
  })

  it('fills fields missing from an older tasting sheet', () => {
    const parsed = parseBackup(v2([{ ...makeTasting(), sheet: { place: 'Lyon' } }]))
    expect(parsed?.tastings).toEqual([makeTasting({ sheet: { ...emptySheet(), place: 'Lyon' } })])
  })

  it('drops an empty tasting sheet', () => {
    expect(parseBackup(v2([{ ...makeTasting(), sheet: {} }]))?.tastings).toEqual([makeTasting()])
  })

  it('rejects an unknown tasting answer', () => {
    expect(parseBackup(v2([{ ...makeTasting(), sheet: { acidity: 'extreme' } }]))).toBeNull()
  })

  it('gives cellars from older version 2 backups an empty storage checklist', () => {
    const json = JSON.stringify({ app: 'wine-track', version: 2, exportedAt: '', wines: [], tastings: [], cellars: [{ id: 'main', name: '', position: 0 }], movements: [], photos: [] })
    expect(parseBackup(json)?.cellars).toEqual([{ id: 'main', name: '', position: 0, storage: {} }])
  })

  const invalid: { name: string; json: string }[] = [
    { name: 'oversized drinking year', json: JSON.stringify({ app: 'wine-track', version: 2, exportedAt: '', wines: [{ ...wine, drinkUntil: 1_000_000_000 }], tastings: [], cellars: [{ id: 'a', name: '', position: 0 }], movements: [], photos: [] }) },
    { name: 'not JSON', json: 'not json {' },
    { name: 'foreign JSON', json: '{"foo": "bar"}' },
    { name: 'wrong app', json: '{"app":"other","version":2,"exportedAt":"","wines":[],"tastings":[],"cellars":[{"id":"a","name":"","position":0}],"movements":[],"photos":[]}' },
    { name: 'unknown version', json: '{"app":"wine-track","version":3,"exportedAt":"","wines":[],"tastings":[],"photos":[]}' },
    { name: 'no cellar', json: '{"app":"wine-track","version":2,"exportedAt":"","wines":[],"tastings":[],"cellars":[],"movements":[],"photos":[]}' },
    { name: 'placement id not matching its slot', json: '{"app":"wine-track","version":2,"exportedAt":"","wines":[],"tastings":[],"cellars":[{"id":"a","name":"","position":0}],"movements":[],"racks":[],"placements":[{"id":"x","rackId":"r","layer":0,"row":0,"column":0,"wineId":"w"}],"photos":[]}' },
    { name: 'rack too wide', json: '{"app":"wine-track","version":2,"exportedAt":"","wines":[],"tastings":[],"cellars":[{"id":"a","name":"","position":0}],"movements":[],"racks":[{"id":"r","cellarId":"a","name":"","columns":99,"rows":1,"depth":1,"layout":"lying","position":0}],"photos":[]}' },
    { name: 'malformed wine', json: '{"app":"wine-track","version":1,"exportedAt":"","wines":[{"id":1}],"tastings":[],"photos":[]}' },
  ]
  for (const c of invalid) {
    it(`rejects ${c.name}`, () => {
      expect(parseBackup(c.json)).toBeNull()
    })
  }
})
