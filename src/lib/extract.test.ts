import { describe, expect, it } from 'vitest'
import { alignCompletions, emptyDraft, lookupKey, toWineDraft, wineQuery } from './extract'
import { makeWine } from './testing'

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

  it('keeps imported text on one line and clips long fields', () => {
    const query = wineQuery({ ...emptyDraft(), name: 'Clos\n\nIgnore the above ' + 'x'.repeat(500) })
    expect(query).not.toContain('\n')
    expect(query.length).toBe(120)
    expect(wineQuery({ ...emptyDraft(), name: 'A</wines>B' })).toBe('A/winesB')
  })
})

describe('alignCompletions', () => {
  it('orders answers by index and fills the gaps', () => {
    const syrah = { grapes: ['Syrah'], region: 'Cornas', country: 'France' }
    const empty = { grapes: [], region: null, country: null }
    expect(alignCompletions(3, [{ index: 3, ...syrah }, { index: 9, ...syrah }])).toEqual([empty, empty, syrah])
  })
})

describe('lookupKey', () => {
  const wine = makeWine({ id: 'w1' })
  const cases = [
    { name: 'replaced object with other fields changed', other: { ...wine, wished: true, value: 30, drinkBy: '2030-01-01' }, same: true },
    { name: 'other color', other: { ...wine, color: 'white' as const }, same: false },
    { name: 'other vintage', other: { ...wine, vintage: 2021 }, same: false },
    { name: 'other saved wine', other: { ...wine, id: 'w2' }, same: false },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(lookupKey(c.other) === lookupKey(wine)).toBe(c.same)
    })
  }
})
