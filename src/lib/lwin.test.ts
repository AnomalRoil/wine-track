import { describe, expect, it } from 'vitest'
import { emptyDraft, type WineDraft } from './extract'
import { applyLwin, completeFromLwin, CONFIDENT, displayName, duplicateOf, lwinColor, match, parseLwin, search, words, type LwinWine } from './lwin'
import { makeWine } from './testing'

const header = JSON.stringify({
  format: 1,
  tables: {
    title: ['', 'Domaine', 'Chateau'],
    country: ['', 'France', 'Portugal'],
    region: ['', 'Burgundy', 'Bordeaux', 'Port'],
    subRegion: ['', 'Chablis', 'Sauternes', 'Champagne'],
    colour: ['', 'White', 'Red', 'Rose'],
    subType: ['', 'Still', 'Sparkling', 'Port'],
  },
})
const rows = [
  ['1066540', '0', 'Vincent Dauvissat', 'Chablis', '1', '1', '1', '1', '1', '', ''],
  ['1066553', '0', 'Vincent Dauvissat', 'Chablis Grand Cru, Les Clos', '1', '1', '1', '1', '1', '', ''],
  ['1181812', '1', 'Jean Dauvissat', 'Chablis Premier Cru, Fourchaume', '1', '1', '1', '1', '1', '', ''],
  ['1012361', '2', "d'Yquem", 'Sauternes', '1', '2', '2', '1', '1', '', ''],
  ['1014033', '0', 'Krug', 'Grande Cuvee', '1', '0', '3', '1', '2', '', ''],
  ['1100001', '0', 'Taylor', 'Vintage Port', '2', '3', '0', '2', '3', '1970', '2020'],
  ['1100002', '0', 'Romanee', 'Rose', '1', '1', '0', '3', '1', '', ''],
]
const index = parseLwin(`${header}\n${rows.map((r) => r.join('\t')).join('\n')}\n`)
const byCode = (lwin: string) => index.wines.find((w) => w.lwin === lwin)!

describe('words', () => {
  const cases: [string, string[]][] = [
    ["Château d'Yquem", ['chateau', 'd', 'yquem']],
    ['ROMANÉE-CONTI', ['romanee', 'conti']],
    ['Blaufränkisch Straße', ['blaufrankisch', 'strasse']],
    ['  ', []],
    ['N°41', ['n', '41']],
    ['Romane\u0301e-Conti', ['romanee', 'conti']],
  ]
  for (const [input, want] of cases) {
    it(JSON.stringify(input), () => expect(words(input)).toEqual(want))
  }
})

describe('parseLwin', () => {
  it('joins the title to the producer and reads the tables', () => {
    expect(byCode('1181812')).toEqual({
      lwin: '1181812',
      producer: 'Domaine Jean Dauvissat',
      label: 'Chablis Premier Cru, Fourchaume',
      country: 'France',
      region: 'Burgundy',
      subRegion: 'Chablis',
      colour: 'White',
      subType: 'Still',
      firstVintage: null,
      finalVintage: null,
    })
    expect(byCode('1100001')).toMatchObject({ firstVintage: 1970, finalVintage: 2020, subRegion: '' })
  })

  it('rejects an unknown format', () => {
    expect(() => parseLwin('{"format":2,"tables":{}}\n')).toThrow()
  })
})

describe('search', () => {
  const cases: { query: string; want: string[] }[] = [
    { query: 'Dauvissat', want: ['1066540', '1066553', '1181812'] },
    { query: 'dauv clos', want: ['1066553'] },
    { query: 'Jean Dauvissat', want: ['1181812'] },
    { query: 'chablis', want: ['1066540', '1066553', '1181812'] },
    { query: 'Château Yquem', want: ['1012361'] },
    { query: 'Romanée', want: ['1100002'] },
    { query: 'Romane\u0301e', want: ['1100002'] },
    { query: 'champagne', want: ['1014033'] },
    { query: 'x', want: [] },
    { query: 'zzz', want: [] },
  ]
  for (const c of cases) {
    it(c.query, () => {
      expect(search(index, c.query, 5).map((s) => s.wine.lwin)).toEqual(c.want)
    })
  }

  it('ranks an exact producer first', () => {
    expect(search(index, 'Krug', 5)[0].wine.lwin).toBe('1014033')
  })

  it('keeps the limit', () => {
    expect(search(index, 'dauvissat', 2)).toHaveLength(2)
  })
})

describe('match', () => {
  const draft = (fields: Partial<WineDraft>): WineDraft => ({ ...emptyDraft(), color: 'other', ...fields })
  const cases: { name: string; draft: WineDraft; want: string | null; confident: boolean }[] = [
    {
      name: 'label with producer and climat',
      draft: draft({ producer: 'Vincent Dauvissat', name: 'Chablis Grand Cru Les Clos', color: 'white' }),
      want: '1066553',
      confident: true,
    },
    {
      name: 'accents and title',
      draft: draft({ producer: 'Château d’Yquem', name: 'Sauternes', vintage: 2015, color: 'sweet' }),
      want: '1012361',
      confident: true,
    },
    {
      name: 'vintage outside the known range',
      draft: draft({ producer: 'Taylor', name: 'Vintage Port', vintage: 2022 }),
      want: '1100001',
      confident: false,
    },
    {
      name: 'colour disagreement',
      draft: draft({ producer: 'Vincent Dauvissat', name: 'Chablis', color: 'red' }),
      want: '1066540',
      confident: false,
    },
    {
      name: 'decomposed accents',
      draft: draft({ producer: 'Cha\u0302teau d’Yquem', name: 'Sauternes', color: 'sweet' }),
      want: '1012361',
      confident: true,
    },
    { name: 'unknown producer', draft: draft({ producer: 'Nobody', name: 'Chablis' }), want: null, confident: false },
    { name: 'title alone', draft: draft({ producer: 'Domaine' }), want: null, confident: false },
  ]
  for (const c of cases) {
    it(c.name, () => {
      const [best] = match(index, c.draft, 3)
      expect(best?.wine.lwin ?? null).toBe(c.want)
      expect((best?.score ?? 0) >= CONFIDENT).toBe(c.confident)
    })
  }
})

describe('lwinColor', () => {
  const cases: [Pick<LwinWine, 'colour' | 'subType'>, string][] = [
    [{ colour: 'Red', subType: 'Still' }, 'red'],
    [{ colour: 'White', subType: 'Sparkling' }, 'sparkling'],
    [{ colour: 'Red', subType: 'Port' }, 'fortified'],
    [{ colour: '', subType: 'Fortified' }, 'fortified'],
    [{ colour: 'Rose', subType: 'Still' }, 'rose'],
    [{ colour: 'Mixed', subType: 'Still' }, 'other'],
  ]
  for (const [wine, want] of cases) {
    it(`${wine.colour}/${wine.subType}`, () => expect(lwinColor(wine)).toBe(want))
  }
})

describe('displayName', () => {
  it('joins producer and label', () => {
    expect(displayName(byCode('1066553'))).toBe('Vincent Dauvissat, Chablis Grand Cru, Les Clos')
    expect(displayName({ producer: '', label: 'Grange' })).toBe('Grange')
  })
})

describe('applyLwin', () => {
  const cases: { name: string; color: WineDraft['color']; lwin: string; want: WineDraft['color'] }[] = [
    { name: 'takes the colour of the wine', color: 'red', lwin: '1066553', want: 'white' },
    { name: 'keeps a sweet white', color: 'sweet', lwin: '1012361', want: 'sweet' },
    { name: 'takes sparkling', color: 'white', lwin: '1014033', want: 'sparkling' },
  ]
  for (const c of cases) {
    it(c.name, () => {
      const got = applyLwin({ ...emptyDraft(), vintage: 2019, color: c.color, name: 'typed' }, byCode(c.lwin))
      expect(got.color).toBe(c.want)
      expect(got.lwin).toBe(c.lwin)
      expect(got.vintage).toBe(2019)
    })
  }

  it('fills name, producer and place', () => {
    expect(applyLwin(emptyDraft(), byCode('1181812'))).toMatchObject({
      name: 'Chablis Premier Cru, Fourchaume',
      producer: 'Domaine Jean Dauvissat',
      region: 'Chablis',
      country: 'France',
    })
    expect(applyLwin(emptyDraft(), byCode('1100001')).region).toBe('Port')
  })
})

describe('completeFromLwin', () => {
  it('fills only empty fields', () => {
    const draft = { ...emptyDraft(), name: 'Clos', region: 'Bourgogne', color: 'other' as const }
    expect(completeFromLwin(draft, byCode('1066553'))).toMatchObject({
      name: 'Clos',
      region: 'Bourgogne',
      country: 'France',
      color: 'white',
      lwin: '1066553',
    })
  })
})

describe('duplicateOf', () => {
  const wines = [
    makeWine({ id: 'a', name: 'Les Clos', producer: 'Dauvissat', vintage: 2019, lwin: '1066553' }),
    makeWine({ id: 'b', name: 'Château Margaux', producer: '', vintage: 2010, lwin: null }),
  ]
  const cases: { name: string; draft: Partial<WineDraft>; want: string | undefined }[] = [
    { name: 'same code, vintage and size', draft: { name: 'other', lwin: '1066553', vintage: 2019 }, want: 'a' },
    { name: 'same code, other vintage', draft: { name: 'other', lwin: '1066553', vintage: 2020 }, want: undefined },
    { name: 'same code, other size', draft: { name: 'other', lwin: '1066553', vintage: 2019, sizeCl: 150 }, want: undefined },
    { name: 'same name ignoring accents', draft: { name: 'chateau  margaux', vintage: 2010 }, want: 'b' },
    { name: 'nothing alike', draft: { name: 'Krug', vintage: 2010 }, want: undefined },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(duplicateOf({ ...emptyDraft(), sizeCl: 75, ...c.draft }, wines)?.id).toBe(c.want)
    })
  }
})
