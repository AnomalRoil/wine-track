import { describe, expect, it } from 'vitest'
import { matchesSearch } from './search'

describe('matchesSearch', () => {
  const cases: { name: string; fields: (string | number | null)[]; query: string; want: boolean }[] = [
    { name: 'blank query', fields: ['Chablis'], query: '  ', want: true },
    { name: 'case', fields: ['Chablis'], query: 'CHAB', want: true },
    { name: 'accent in the text', fields: ['Château Margaux'], query: 'chateau', want: true },
    { name: 'accent in the query', fields: ['Cotes du Rhone'], query: 'Côtes', want: true },
    { name: 'several accents', fields: ['Côtes du Rhône'], query: 'cotes du rhone', want: true },
    { name: 'spacing', fields: ['Clos  de   Vougeot'], query: 'clos de vougeot', want: true },
    { name: 'across fields', fields: ['Raveneau', 'Chablis'], query: 'raveneau chablis', want: true },
    { name: 'number field', fields: ['Chablis', 2015], query: '2015', want: true },
    { name: 'null field skipped', fields: [null, 'Chablis'], query: 'chablis', want: true },
    { name: 'no match', fields: ['Château Margaux'], query: 'latour', want: false },
    { name: 'non-Latin marks kept', fields: ['ばら'], query: 'はら', want: false },
    { name: 'non-Latin exact', fields: ['ばら'], query: 'ばら', want: true },
  ]
  for (const c of cases) {
    it(c.name, () => expect(matchesSearch(c.fields, c.query)).toBe(c.want))
  }
})
