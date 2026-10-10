import { beforeEach, expect, it, vi } from 'vitest'
import { parseImport } from './csvImport'
import * as db from './db'
import { place } from './racks'
import {
  addMovements,
  addWine,
  applyImport,
  drink,
  moveBottle,
  patchCellar,
  placeBottle,
  removeCellar,
  removeWine,
  restore,
  patchWine,
  saveTasting,
  store,
  storeGeneration,
  swapCellars,
  unplace,
  updateRack,
} from './store.svelte'
import { makeMovement as mv, makeWine } from './testing'
import type { Cellar, Rack } from './types'

vi.mock('./db', () => ({
  deleteCellar: vi.fn(),
  deleteWine: vi.fn(),
  loadAll: vi.fn(),
  putCellars: vi.fn(),
  putImport: vi.fn(),
  putMovements: vi.fn(),
  putRacks: vi.fn(),
  putTasting: vi.fn(),
  putWine: vi.fn(),
  replaceAll: vi.fn(),
  updatePlacements: vi.fn(),
}))

/** Holds every db write until the test releases it. */
let pending: (() => void)[] = []
const deferred = () => new Promise<void>((resolve) => pending.push(resolve))

/** Releases the held db writes in order until every task has settled. */
async function release(...tasks: Promise<unknown>[]): Promise<void> {
  let settled = false
  const all = Promise.allSettled(tasks).then(() => (settled = true))
  for (let i = 0; ; i++) {
    await vi.waitFor(() => expect(settled || pending.length > i).toBe(true))
    if (settled) break
    pending[i]()
  }
  await all
}

const cellar = (id: string, position = 0): Cellar => ({ id, name: id, position, storage: {} })
const rack: Rack = { id: 'r', cellarId: 'home', name: '', columns: 2, rows: 3, depth: 1, layout: 'lying', position: 0 }

beforeEach(() => {
  pending = []
  for (const write of [db.deleteCellar, db.deleteWine, db.putCellars, db.putImport, db.putMovements, db.putRacks, db.putTasting, db.putWine, db.replaceAll, db.updatePlacements])
    vi.mocked(write).mockReset().mockImplementation(deferred)
  vi.mocked(db.loadAll).mockReset()
  Object.assign(store, {
    wines: [makeWine()],
    tastings: [],
    cellars: [cellar('home')],
    movements: [],
    racks: [],
    placements: [],
  })
})

it('builds each queued cellar write on the one before', async () => {
  store.cellars = [cellar('c'), cellar('d', 1)]

  const answer = patchCellar('c', (c) => ({ ...c, storage: { temperature: 'cool' } }))
  const reorder = swapCellars('c', 'd')
  const rename = patchCellar('c', (c) => ({ ...c, name: 'Home' }))
  await release(answer, reorder, rename)

  expect(store.cellars.find((c) => c.id === 'c')).toEqual({ id: 'c', name: 'Home', position: 1, storage: { temperature: 'cool' } })
})

it('records one movement when the last bottle is drunk twice', async () => {
  const bottle = place({ rackId: 'r', layer: 0, row: 0, column: 0 }, 'w1')
  store.racks = [rack]
  store.placements = [bottle]
  store.movements = [mv({ id: 'a', quantity: 1, cellarId: 'home' })]

  const first = drink(bottle)
  const second = drink(bottle)
  await release(first, second)

  expect(await first).toBe(true)
  expect(await second).toBe(false)
  expect(db.putMovements).toHaveBeenCalledTimes(1)
  expect(store.movements.filter((m) => m.kind === 'consume')).toHaveLength(1)
  expect(store.placements).toEqual([])
})

it('keeps a cellar when both are deleted behind a pending write', async () => {
  store.cellars = [cellar('a'), cellar('b', 1)]

  const rename = patchCellar('a', (c) => ({ ...c, name: 'Home' }))
  const first = removeCellar('a', null)
  const second = removeCellar('b', null)
  await release(rename, first, second)

  expect([await first, await second]).toEqual([true, false])
  expect(store.cellars.map((c) => c.id)).toEqual(['b'])
  expect(db.deleteCellar).toHaveBeenCalledTimes(1)
})

it('refuses to move bottles into a cellar deleted earlier in the queue', async () => {
  store.cellars = [cellar('a'), cellar('b', 1), cellar('c', 2)]
  store.movements = [mv({ id: 'm', quantity: 2, cellarId: 'c' })]

  const first = removeCellar('b', null)
  const second = removeCellar('c', 'b')
  await release(first, second)

  expect([await first, await second]).toEqual([true, false])
  expect(store.cellars.map((c) => c.id)).toEqual(['a', 'c'])
  expect(store.movements).toHaveLength(1)
})

it('restores a backup after the writes queued before it', async () => {
  const kept = place({ rackId: 'r', layer: 0, row: 2, column: 0 }, 'w1')
  const backup: db.Data = {
    wines: [makeWine()],
    tastings: [],
    cellars: [cellar('home')],
    movements: [mv({ id: 'b', quantity: 1, cellarId: 'home' })],
    racks: [rack],
    placements: [kept],
  }
  vi.mocked(db.loadAll).mockResolvedValue(structuredClone(backup))
  store.racks = [rack]
  store.movements = [mv({ id: 'a', quantity: 2, cellarId: 'home' })]

  const resize = updateRack({ ...rack, rows: 2 })
  const add = addMovements([mv({ id: 'c', quantity: 1, cellarId: 'home' })])
  const restored = restore(backup, [])
  await release(resize, add, restored)

  const order = (fn: unknown) => vi.mocked(fn as () => void).mock.invocationCallOrder[0]
  expect(order(db.replaceAll)).toBeGreaterThan(order(db.putMovements))
  expect(store.racks).toEqual([rack])
  expect(store.placements).toEqual([kept])
  expect(store.movements.map((m) => m.id)).toEqual(['b'])
})

it('empties the last slot when two queued removals take both bottles', async () => {
  const bottle = place({ rackId: 'r', layer: 0, row: 0, column: 0 }, 'w1')
  store.racks = [rack]
  store.placements = [bottle]
  store.movements = [mv({ id: 'a', quantity: 2, cellarId: 'home' })]

  const first = addMovements([mv({ id: 'x', kind: 'consume', cellarId: 'home' })])
  const second = addMovements([mv({ id: 'y', kind: 'consume', cellarId: 'home' })])
  await release(first, second)

  expect([await first, await second]).toEqual([true, true])
  expect(store.placements).toEqual([])
})

it('refuses an addition for a wine deleted earlier', async () => {
  store.wines = []
  const added = addMovements([mv({ cellarId: 'home' })])
  await release(added)
  expect(await added).toBe(false)
  expect(store.movements).toEqual([])
})

it('keeps the swapped-in bottle when its slot is emptied behind the swap', async () => {
  const a = place({ rackId: 'r', layer: 0, row: 0, column: 0 }, 'w1')
  const b = place({ rackId: 'r', layer: 0, row: 0, column: 1 }, 'w2')
  store.racks = [rack]
  store.placements = [a, b]

  const swap = moveBottle(a, { rackId: 'r', layer: 0, row: 0, column: 1 })
  const out = unplace(a)
  await release(swap, out)

  expect([await swap, await out]).toEqual([true, false])
  expect(store.placements.map((p) => [p.id, p.wineId]).sort()).toEqual([
    [a.id, 'w2'],
    [b.id, 'w1'],
  ])
})

it('refuses a resize that would drop a bottle placed while it waited', async () => {
  store.racks = [rack]
  store.movements = [mv({ id: 'a', quantity: 1, cellarId: 'home' })]

  const placed = placeBottle({ rackId: 'r', layer: 0, row: 2, column: 0 }, 'w1')
  const resize = updateRack({ ...rack, rows: 2 })
  await release(placed, resize)

  expect([await placed, await resize]).toEqual([true, false])
  expect(store.racks).toEqual([rack])
  expect(store.placements).toHaveLength(1)
})

it('adds to the wines of an import already committed instead of duplicating them', async () => {
  store.wines = []
  const parsed = parseImport('name,producer,quantity,cellar\nClos,Dom,2,Cave\n', 2026)
  if (!parsed.ok) throw new Error(parsed.error)
  const ctx = { defaultCellarName: 'Home', date: '2026-01-01', now: 0, newId: () => crypto.randomUUID() }

  const first = applyImport(parsed.rows, ctx)
  const second = applyImport(parsed.rows, ctx)
  await release(first, second)

  expect((await second).matches).toEqual([{ kind: 'existing', wineId: store.wines[0].id }])
  expect(store.wines).toHaveLength(1)
  expect(store.cellars.map((c) => c.name)).toEqual(['home', 'Cave'])
  expect(store.movements).toHaveLength(2)
})

it('keeps every field of overlapping wine edits', async () => {
  const aging = patchWine('w1', () => ({ drinkFrom: 2028, drinkUntil: 2040 }))
  const value = patchWine('w1', (w) => ({ value: 30, valueHistory: [...w.valueHistory, { date: '2026-01-01', value: 30 }] }))
  const wished = patchWine('w1', (w) => ({ wished: !w.wished }))
  await release(aging, value, wished)

  expect(store.wines[0]).toMatchObject({ drinkFrom: 2028, drinkUntil: 2040, value: 30, valueHistory: [{ date: '2026-01-01', value: 30 }], wished: true })
  expect(vi.mocked(db.putWine).mock.calls.at(-1)?.[0]).toEqual(store.wines[0])
})

it('drops a capture whose photo was still processing when a backup was restored', async () => {
  const backup: db.Data = { wines: [makeWine({ id: 'old' })], tastings: [], cellars: [cellar('home')], movements: [], racks: [], placements: [] }
  vi.mocked(db.loadAll).mockResolvedValue(structuredClone(backup))
  let processed!: (blob: Blob) => void
  const processing = new Promise<Blob>((resolve) => (processed = resolve))

  const capture = (async () => {
    const since = storeGeneration()
    const blob = await processing
    const wine = makeWine({ id: 'new', photoId: 'p' })
    return addWine(wine, { id: 'p', blob }, [mv({ wineId: 'new', cellarId: 'home' })], since)
  })()
  const restored = restore(backup, [])
  await release(restored)
  processed(new Blob())
  await release(capture)

  expect(await capture).toBe(false)
  expect(db.putWine).not.toHaveBeenCalled()
  expect(db.putMovements).not.toHaveBeenCalled()
  expect(store.wines.map((w) => w.id)).toEqual(['old'])
})

it('keeps a wine and its tastings deleted while an edit waited', async () => {
  const wine = makeWine()
  const removed = removeWine(wine)
  const edited = patchWine(wine.id, () => ({ name: 'Renamed' }))
  const tasted = saveTasting({ id: 't', wineId: wine.id, date: '2026-01-01', rating: 4, notes: '' })
  await release(removed, edited, tasted)

  expect([await edited, await tasted]).toEqual([false, false])
  expect(db.putWine).not.toHaveBeenCalled()
  expect(db.putTasting).not.toHaveBeenCalled()
  expect(store.wines).toEqual([])
  expect(store.tastings).toEqual([])
})
