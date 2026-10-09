import { describe, expect, it } from 'vitest'
import { alignCompletions, emptyDraft, toWineDraft, wineQuery } from './extract'

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
        volumeCl: 150,
      }),
    ).toEqual({
      name: 'Chablis',
      producer: 'Dauvissat',
      vintage: 2020,
      grapes: ['Chardonnay'],
      region: 'Chablis',
      country: 'France',
      color: 'white',
      sizeCl: 150,
      tags: [],
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
        volumeCl: null,
      }),
    ).toEqual({ ...emptyDraft(), color: 'other' })
  })

  it('returns an empty draft for null', () => {
    expect(toWineDraft(null)).toEqual(emptyDraft())
  })
})

describe('wineQuery', () => {
  it('joins the identifying fields', () => {
    expect(wineQuery({ ...emptyDraft(), producer: 'Dom', name: 'Clos', vintage: 2019, country: 'France' })).toBe('Dom Clos 2019 France')
  })
})

describe('alignCompletions', () => {
  it('orders answers by index and fills the gaps', () => {
    const syrah = { grapes: ['Syrah'], region: 'Cornas', country: 'France' }
    const empty = { grapes: [], region: null, country: null }
    expect(alignCompletions(3, [{ index: 3, ...syrah }, { index: 9, ...syrah }])).toEqual([empty, empty, syrah])
  })
})
