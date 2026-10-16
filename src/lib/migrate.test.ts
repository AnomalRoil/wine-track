import { describe, expect, it } from 'vitest'
import { normalizeWine } from './migrate'
import { makeWine } from './testing'

describe('normalizeWine', () => {
  it('gives a wine stored before window sources existed no source', () => {
    const { windowSource, ...older } = makeWine({ drinkFrom: 2025 })
    expect(normalizeWine(older)).toEqual({ ...older, windowSource: null })
  })

  it('keeps a stored source', () => {
    const wine = makeWine({ drinkFrom: 2025, windowSource: { kind: 'critic', url: 'https://critic.example' } })
    expect(normalizeWine(wine)).toEqual(wine)
  })
})
