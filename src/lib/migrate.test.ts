import { describe, expect, it } from 'vitest'
import { normalizeWine } from './migrate'
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
