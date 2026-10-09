import { describe, expect, it } from 'vitest'
import { journal } from './journal'
import { makeMovement, makeWine } from './testing'
import type { Tasting } from './types'

const wines = [makeWine({ id: 'w1', name: 'Chablis' }), makeWine({ id: 'w2', name: 'Margaux' })]
const movements = [
  makeMovement({ id: 'm1', wineId: 'w1', date: '2026-01-01' }),
  makeMovement({ id: 'm2', wineId: 'w2', date: '2026-03-01', kind: 'gift', note: 'for Sam' }),
  makeMovement({ id: 'm3', wineId: 'gone', date: '2026-02-01' }),
]
const tastings: Tasting[] = [{ id: 't1', wineId: 'w1', date: '2026-02-15', rating: 4, notes: 'flinty' }]

function ids(search: string): string[] {
  return journal(wines, movements, tastings, search).map((e) => (e.type === 'movement' ? e.movement.id : e.tasting.id))
}

describe('journal', () => {
  it('merges movements and tastings, newest first', () => {
    expect(ids('')).toEqual(['m2', 't1', 'm3', 'm1'])
  })
  it('puts the latest-recorded first within a day', () => {
    const sameDay = [makeMovement({ id: 'a' }), makeMovement({ id: 'b' })]
    expect(journal(wines, sameDay, [], '').map((e) => e.type === 'movement' && e.movement.id)).toEqual(['b', 'a'])
  })
  it('keeps entries of deleted wines without a wine', () => {
    expect(journal(wines, movements, tastings, '').find((e) => e.date === '2026-02-01')?.wine).toBeUndefined()
  })
  const searches: { name: string; search: string; want: string[] }[] = [
    { name: 'wine name', search: 'chablis', want: ['t1', 'm1'] },
    { name: 'movement note', search: 'sam', want: ['m2'] },
    { name: 'tasting notes', search: 'FLINT', want: ['t1'] },
  ]
  for (const c of searches) {
    it(`searches by ${c.name}`, () => {
      expect(ids(c.search)).toEqual(c.want)
    })
  }
})
