import { describe, expect, it } from 'vitest'
import { emptyDraft, type WineDraft } from './extract'
import { acceptPending, active, edit, formatValue, merge, pendingCount, resolve, setStatus, suggestions, type Suggestion } from './review'

const draft: WineDraft = { ...emptyDraft(), name: 'Les Clos', producer: 'Dauvissat', region: 'Chablis' }

function pending(s: Partial<Suggestion> & Pick<Suggestion, 'field' | 'value'>): Suggestion {
  return { source: 'claude', status: 'pending', edited: false, ...s } as Suggestion
}

const grapes = pending({ field: 'grapes', value: ['Chardonnay'] })
const country = pending({ field: 'country', value: 'France', source: 'lwin' })

describe('suggestions', () => {
  const cases: { name: string; completed: WineDraft; want: Suggestion[] }[] = [
    { name: 'nothing changed', completed: draft, want: [] },
    { name: 'equal grape list', completed: { ...draft, grapes: [] }, want: [] },
    {
      name: 'filled fields, in display order',
      completed: { ...draft, country: 'France', grapes: ['Chardonnay'] },
      want: [grapes, { ...country, source: 'claude' }],
    },
    { name: 'appellation after region', completed: { ...draft, appellation: 'Chablis Grand Cru', country: 'France' }, want: [pending({ field: 'appellation', value: 'Chablis Grand Cru' }), { ...country, source: 'claude' }] },
    { name: 'code and color', completed: { ...draft, lwin: '1066553', color: 'white' }, want: [pending({ field: 'color', value: 'white' }), pending({ field: 'lwin', value: '1066553' })] },
  ]
  for (const c of cases) it(c.name, () => expect(suggestions(draft, c.completed, 'claude')).toEqual(c.want))
})

describe('merge', () => {
  const claudeCountry = pending({ field: 'country', value: 'Frankreich' })
  const cases: { name: string; current: Suggestion[]; incoming: Suggestion[]; want: Suggestion[] }[] = [
    { name: 'adds new fields in order', current: [country], incoming: [grapes], want: [grapes, country] },
    { name: 'keeps another source as an alternative', current: [country], incoming: [claudeCountry], want: [country, claudeCountry] },
    { name: 'keeps a pending one from the same source', current: [claudeCountry], incoming: [pending({ field: 'country', value: 'Suisse' })], want: [claudeCountry] },
    { name: 'keeps an accepted one', current: [{ ...claudeCountry, status: 'accepted' }], incoming: [claudeCountry], want: [{ ...claudeCountry, status: 'accepted' }] },
    { name: 'replaces a rejected one', current: [{ ...claudeCountry, status: 'rejected' }], incoming: [pending({ field: 'country', value: 'Suisse' })], want: [pending({ field: 'country', value: 'Suisse' })] },
  ]
  for (const c of cases) it(c.name, () => expect(merge(c.current, c.incoming)).toEqual(c.want))
})

describe('active', () => {
  const claudeCountry = pending({ field: 'country', value: 'Frankreich' })
  const rejected = { ...country, status: 'rejected' } as Suggestion
  const cases: { name: string; list: Suggestion[]; want: Suggestion[] }[] = [
    { name: 'first not rejected', list: [grapes, country, claudeCountry], want: [grapes, country] },
    { name: 'alternative after a rejection', list: [rejected, claudeCountry], want: [claudeCountry] },
    { name: 'last rejected when all are', list: [rejected, { ...claudeCountry, status: 'rejected' }], want: [{ ...claudeCountry, status: 'rejected' }] },
  ]
  for (const c of cases) it(c.name, () => expect(active(c.list)).toEqual(c.want))
})

describe('resolve', () => {
  const list = [{ ...grapes, status: 'accepted' }, country, pending({ field: 'color', value: 'white', status: 'rejected' })] as Suggestion[]
  const cases: { name: string; list?: Suggestion[]; withPending?: boolean; want: WineDraft }[] = [
    { name: 'no suggestions', want: draft },
    { name: 'accepted only', list, want: { ...draft, grapes: ['Chardonnay'] } },
    { name: 'with pending', list, withPending: true, want: { ...draft, grapes: ['Chardonnay'], country: 'France' } },
  ]
  for (const c of cases) it(c.name, () => expect(resolve(draft, c.list, c.withPending)).toEqual(c.want))

  it('returns the draft itself when nothing applies', () => expect(resolve(draft, [country])).toBe(draft))
  it('applies an alternative once the first is rejected', () =>
    expect(resolve(draft, [{ ...country, status: 'rejected' }, pending({ field: 'country', value: 'Suisse', status: 'accepted' })])).toEqual({ ...draft, country: 'Suisse' }))
})

describe('status changes', () => {
  const list = [grapes, country]
  it('sets one suggestion', () => expect(setStatus(list, country, 'rejected').map((s) => s.status)).toEqual(['pending', 'rejected']))
  it('sets every field', () => expect(setStatus(list, null, 'accepted').map((s) => s.status)).toEqual(['accepted', 'accepted']))
  it('accepts pending only', () =>
    expect(acceptPending([grapes, { ...country, status: 'rejected' }]).map((s) => s.status)).toEqual(['accepted', 'rejected']))
  it('counts pending', () => expect(pendingCount([grapes, { ...country, status: 'accepted' }])).toBe(1))
  it('ignores a hidden alternative', () => {
    const list = [{ ...country, status: 'accepted' }, pending({ field: 'country', value: 'Suisse' })] as Suggestion[]
    expect(pendingCount(list)).toBe(0)
    expect(acceptPending(list).map((s) => s.status)).toEqual(['accepted', 'pending'])
  })
})

describe('edit', () => {
  const list = [grapes, country, pending({ field: 'color', value: 'white' }), pending({ field: 'lwin', value: '1066553' })]
  const cases: { name: string; field: Suggestion['field']; raw: string; want: Suggestion | null }[] = [
    { name: 'text', field: 'country', raw: ' Suisse ', want: pending({ field: 'country', value: 'Suisse', source: 'lwin', status: 'accepted', edited: true }) },
    { name: 'grape list', field: 'grapes', raw: 'Merlot; Cabernet Franc, Merlot', want: pending({ field: 'grapes', value: ['Merlot', 'Cabernet Franc'], status: 'accepted', edited: true }) },
    { name: 'empty rejects', field: 'country', raw: ' ', want: { ...country, status: 'rejected' } },
    { name: 'known color', field: 'color', raw: 'red', want: pending({ field: 'color', value: 'red', status: 'accepted', edited: true }) },
    { name: 'unknown color', field: 'color', raw: 'blue', want: null },
    { name: 'valid code', field: 'lwin', raw: '1066540', want: pending({ field: 'lwin', value: '1066540', status: 'accepted', edited: true }) },
    { name: 'invalid code', field: 'lwin', raw: '12', want: null },
    { name: 'six-digit code', field: 'lwin', raw: '106655', want: null },
  ]
  for (const c of cases) {
    it(c.name, () => {
      const got = edit(list, list.find((s) => s.field === c.field)!, c.raw)
      expect(got && got.find((s) => s.field === c.field)).toEqual(c.want)
    })
  }
})

describe('formatValue', () => {
  it('joins grapes', () => expect(formatValue(pending({ field: 'grapes', value: ['Merlot', 'Malbec'] }))).toBe('Merlot, Malbec'))
  it('shows a missing code as empty', () => expect(formatValue(pending({ field: 'lwin', value: null }))).toBe(''))
})
