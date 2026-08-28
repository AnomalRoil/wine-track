import { describe, expect, it } from 'vitest'
import { emptyDraft, toWineDraft } from './extract'

describe('toWineDraft', () => {
  it('maps a full extraction', () => {
    expect(
      toWineDraft({
        name: 'Chablis',
        producer: 'Dauvissat',
        vintage: 2020,
        grapes: [' Chardonnay ', ''],
        region: 'Chablis',
        country: 'France',
        color: 'white',
      }),
    ).toEqual({
      name: 'Chablis',
      producer: 'Dauvissat',
      vintage: 2020,
      grapes: ['Chardonnay'],
      region: 'Chablis',
      country: 'France',
      color: 'white',
    })
  })

  it('maps nulls to empty strings and unknown color to other', () => {
    expect(
      toWineDraft({
        name: null,
        producer: null,
        vintage: null,
        grapes: [],
        region: null,
        country: null,
        color: 'unknown',
      }),
    ).toEqual({ ...emptyDraft(), color: 'other' })
  })

  it('returns an empty draft for null', () => {
    expect(toWineDraft(null)).toEqual(emptyDraft())
  })
})
