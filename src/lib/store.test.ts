import { expect, it, vi } from 'vitest'
import * as db from './db'
import { patchStorage, store } from './store.svelte'

vi.mock('./db', () => ({ putCellars: vi.fn() }))

it('builds each queued storage write on the one before', async () => {
  const pending: (() => void)[] = []
  vi.mocked(db.putCellars).mockImplementation(() => new Promise<void>((resolve) => pending.push(resolve)))
  store.cellars = [{ id: 'c', name: '', position: 0, storage: {} }]

  const first = patchStorage('c', (s) => ({ ...s, temperature: 'cool' }))
  const second = patchStorage('c', (s) => ({ ...s, light: 'dark' }))
  await vi.waitFor(() => expect(pending).toHaveLength(1))
  pending[0]()
  await first
  await vi.waitFor(() => expect(pending).toHaveLength(2))
  pending[1]()
  await second

  expect(store.cellars[0].storage).toEqual({ temperature: 'cool', light: 'dark' })
})
