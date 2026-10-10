import { describe, expect, it } from 'vitest'
import { upgrade } from './db'

/** Records the stores and indexes an upgrade creates. */
function fakeDb() {
  const created: Record<string, string[]> = {}
  const store = (name: string) => ({
    createIndex: (index: string) => created[name].push(index),
    put: () => {},
    getAll: () => ({}),
  })
  const d = {
    createObjectStore: (name: string) => {
      created[name] = []
      return store(name)
    },
  }
  const tx = { objectStore: store }
  return { d: d as unknown as IDBDatabase, tx: tx as unknown as IDBTransaction, created }
}

describe('upgrade', () => {
  const cases = [
    {
      name: 'from v2 adds racks, placements and the cache',
      oldVersion: 2,
      want: { racks: ['cellarId'], placements: ['rackId', 'wineId'], cache: [] },
    },
    { name: 'from v3 adds the cache only', oldVersion: 3, want: { cache: [] } },
    {
      name: 'from scratch creates every store',
      oldVersion: 0,
      want: {
        wines: [],
        tastings: ['wineId'],
        photos: [],
        cellars: [],
        movements: ['wineId'],
        racks: ['cellarId'],
        placements: ['rackId', 'wineId'],
        cache: [],
      },
    },
    { name: 'at v4 changes nothing', oldVersion: 4, want: {} },
  ]
  for (const c of cases) {
    it(c.name, () => {
      const { d, tx, created } = fakeDb()
      upgrade(d, tx, c.oldVersion)
      expect(created).toEqual(c.want)
    })
  }
})
