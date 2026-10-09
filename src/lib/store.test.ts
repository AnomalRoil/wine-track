import { beforeEach, expect, it, vi } from 'vitest'
import * as db from './db'
import { place } from './racks'
import { drink, patchCellar, store, swapCellars } from './store.svelte'
import { makeMovement as mv } from './testing'

vi.mock('./db', () => ({ putCellars: vi.fn(), putMovements: vi.fn() }))

/** Holds every db write until the test releases it. */
let pending: (() => void)[] = []
const deferred = () => new Promise<void>((resolve) => pending.push(resolve))

beforeEach(() => {
  pending = []
  vi.mocked(db.putCellars).mockReset().mockImplementation(deferred)
  vi.mocked(db.putMovements).mockReset().mockImplementation(deferred)
})

it('builds each queued cellar write on the one before', async () => {
  store.cellars = [
    { id: 'c', name: '', position: 0, storage: {} },
    { id: 'd', name: '', position: 1, storage: {} },
  ]

  const answer = patchCellar('c', (c) => ({ ...c, storage: { temperature: 'cool' } }))
  const reorder = swapCellars('c', 'd')
  const rename = patchCellar('c', (c) => ({ ...c, name: 'Home' }))
  for (let i = 1; i <= 3; i++) {
    await vi.waitFor(() => expect(pending).toHaveLength(i))
    pending[i - 1]()
  }
  await Promise.all([answer, reorder, rename])

  expect(store.cellars.find((c) => c.id === 'c')).toEqual({ id: 'c', name: 'Home', position: 1, storage: { temperature: 'cool' } })
})

it('records one movement when the last bottle is drunk twice', async () => {
  const bottle = place({ rackId: 'r', layer: 0, row: 0, column: 0 }, 'w1')
  store.racks = [{ id: 'r', cellarId: 'home', name: '', columns: 1, rows: 1, depth: 1, layout: 'lying', position: 0 }]
  store.placements = [bottle]
  store.movements = [mv({ id: 'a', quantity: 1, cellarId: 'home' })]

  const first = drink(bottle)
  const second = drink(bottle)
  await vi.waitFor(() => expect(pending).toHaveLength(1))
  pending[0]()

  expect(await first).toBe(true)
  expect(await second).toBe(false)
  expect(db.putMovements).toHaveBeenCalledTimes(1)
  expect(store.movements.filter((m) => m.kind === 'consume')).toHaveLength(1)
  expect(store.placements).toEqual([])
})
