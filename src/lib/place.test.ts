import { describe, expect, it } from 'vitest'
import { placeLine, shownAppellation } from './place'

describe('placeLine', () => {
  const cases = [
    { name: 'all parts', appellation: 'Pauillac', region: 'Bordeaux', country: 'France', want: 'Pauillac · Bordeaux, France' },
    { name: 'no appellation', appellation: '', region: 'Bordeaux', country: 'France', want: 'Bordeaux, France' },
    { name: 'no region', appellation: 'Pauillac', region: '', country: 'France', want: 'Pauillac, France' },
    { name: 'appellation only', appellation: 'Pauillac', region: '', country: '', want: 'Pauillac' },
    { name: 'no country', appellation: 'Pauillac', region: 'Bordeaux', country: '', want: 'Pauillac · Bordeaux' },
    { name: 'appellation repeats region', appellation: 'champagne ', region: 'Champagne', country: 'France', want: 'Champagne, France' },
    { name: 'accents ignored', appellation: 'Côte Rôtie', region: 'Cote Rotie', country: '', want: 'Cote Rotie' },
    { name: 'blanks', appellation: ' ', region: ' ', country: ' ', want: '' },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(placeLine(c)).toBe(c.want)
    })
  }
})

describe('shownAppellation', () => {
  it('trims', () => {
    expect(shownAppellation({ appellation: ' Margaux ', region: 'Bordeaux' })).toBe('Margaux')
  })
})
