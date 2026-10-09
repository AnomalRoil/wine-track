import { describe, expect, it } from 'vitest'
import { AROMA_GROUPS, answered, emptySheet, isEmptySheet, keyAromas, normalizeTasting, shadesFor, SHADES } from './tasting'
import { makeTasting } from './testing'
import { WINE_COLORS, type TastingSheet } from './types'

function sheet(overrides: Partial<TastingSheet>): TastingSheet {
  return { ...emptySheet(), ...overrides }
}

describe('shadesFor', () => {
  const cases: { color: (typeof WINE_COLORS)[number]; want: string[] }[] = [
    { color: 'white', want: ['lemon', 'straw', 'yellow', 'gold', 'amber'] },
    { color: 'rose', want: ['salmon', 'pink', 'copper'] },
    { color: 'red', want: ['purple', 'ruby', 'garnet', 'tawny'] },
    { color: 'orange', want: ['gold', 'amber', 'orange', 'copper'] },
  ]
  for (const c of cases) {
    it(c.color, () => {
      expect(shadesFor(c.color)).toEqual(c.want)
    })
  }
  it('offers every white, rosé and red shade for colorless types', () => {
    expect(shadesFor('sparkling')).toEqual([...shadesFor('white'), ...shadesFor('rose'), ...shadesFor('red')])
  })
  it('only offers shades with a swatch', () => {
    for (const color of WINE_COLORS) {
      for (const s of shadesFor(color)) expect(SHADES, s).toHaveProperty(s)
    }
  })
})

describe('AROMA_GROUPS', () => {
  it('has unique aroma ids', () => {
    const all = AROMA_GROUPS.flatMap((g) => g.aromas)
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('isEmptySheet', () => {
  const cases: { name: string; sheet: TastingSheet; want: boolean }[] = [
    { name: 'fresh sheet', sheet: emptySheet(), want: true },
    { name: 'blank place', sheet: sheet({ place: '  ' }), want: true },
    { name: 'place', sheet: sheet({ place: 'Home' }), want: false },
    { name: 'people', sheet: sheet({ people: ['Ana'] }), want: false },
    { name: 'photo', sheet: sheet({ photoIds: ['p1'] }), want: false },
    { name: 'scale', sheet: sheet({ acidity: 'high' }), want: false },
    { name: 'shade', sheet: sheet({ shade: 'ruby' }), want: false },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(isEmptySheet(c.sheet)).toBe(c.want)
    })
  }
})

describe('normalizeTasting', () => {
  const cases: { name: string; tasting: Parameters<typeof normalizeTasting>[0]; want: ReturnType<typeof normalizeTasting> }[] = [
    { name: 'quick tasting unchanged', tasting: makeTasting(), want: makeTasting() },
    { name: 'empty sheet dropped', tasting: makeTasting({ sheet: emptySheet() }), want: makeTasting() },
    {
      name: 'missing fields filled',
      tasting: makeTasting({ sheet: { aromas: ['cork'] } as unknown as TastingSheet }),
      want: makeTasting({ sheet: sheet({ aromas: ['cork'] }) }),
    },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(normalizeTasting(c.tasting)).toEqual(c.want)
    })
  }
})

describe('keyAromas', () => {
  const cases: { name: string; sheet?: TastingSheet; max?: number; want: string[] }[] = [
    { name: 'no sheet', want: [] },
    { name: 'picker order', sheet: sheet({ aromas: ['vanilla', 'violet', 'raspberry'] }), want: ['raspberry', 'violet', 'vanilla'] },
    { name: 'faults first', sheet: sheet({ aromas: ['raspberry', 'cork'] }), want: ['cork', 'raspberry'] },
    { name: 'capped', sheet: sheet({ aromas: ['vanilla', 'violet', 'raspberry'] }), max: 2, want: ['raspberry', 'violet'] },
    { name: 'unknown aromas last', sheet: sheet({ aromas: ['wet stone', 'plum'] }), want: ['plum', 'wet stone'] },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(keyAromas(c.sheet, c.max)).toEqual(c.want)
    })
  }
})

describe('answered', () => {
  it('keeps answered scales in the given order', () => {
    const s = sheet({ body: 'full', sweetness: 'dry', tannin: null })
    expect(answered(s, ['sweetness', 'tannin', 'body'])).toEqual([
      { name: 'sweetness', value: 'dry' },
      { name: 'body', value: 'full' },
    ])
  })
})
