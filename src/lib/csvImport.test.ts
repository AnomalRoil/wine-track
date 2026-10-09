import { describe, expect, it } from 'vitest'
import {
  applyCompletion,
  incompleteRows,
  parseImport,
  parseNumber,
  planImport,
  type ImportRow,
  type PlanContext,
} from './csvImport'
import { emptyDraft } from './extract'
import { computeStock, bottlesOf } from './stock'
import { makeWine } from './testing'

describe('parseNumber', () => {
  const cases: [string, number][] = [
    ['12', 12],
    ['12,50', 12.5],
    ['12.50 €', 12.5],
    ['CHF 1’234.50', 1234.5],
    ['1.234,5', 1234.5],
    ['1,234.50', 1234.5],
    ['', NaN],
    ['abc', NaN],
    ['12-15', NaN],
  ]
  for (const [raw, want] of cases) {
    it(JSON.stringify(raw), () => {
      expect(parseNumber(raw)).toBe(want)
    })
  }
})

function row(fields: string, header = 'name,producer,vintage,quantity,size_cl,color,purchase_price'): ImportRow {
  const parsed = parseImport(`${header}\n${fields}`, 2026)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.rows[0]
}

describe('parseImport', () => {
  it('reads the template columns', () => {
    const parsed = parseImport(
      'cellar,name,producer,vintage,quantity,size_cl,color,region,country,grapes,purchase_price,notes,tags\n' +
        'Garage,Clos X,Dom Y,2018,6,150,red,Bandol,France,"Mourvèdre, Grenache",32.5,from the fair,"gift; party"',
      2026,
    )
    expect(parsed).toEqual({
      ok: true,
      ignored: [],
      rows: [
        {
          line: 2,
          cellar: 'Garage',
          draft: {
            name: 'Clos X',
            producer: 'Dom Y',
            vintage: 2018,
            grapes: ['Mourvèdre', 'Grenache'],
            region: 'Bandol',
            country: 'France',
            color: 'red',
            sizeCl: 150,
            tags: ['gift', 'party'],
          },
          quantity: 6,
          price: 32.5,
          notes: 'from the fair',
          errors: [],
        },
      ],
    })
  })

  it('matches French and German headers and reports unknown ones', () => {
    const parsed = parseImport('Nom;Millésime;Quantité;Couleur;Größe;Kaufpreis;Rating\nCuvée;2019;2;Rouge;Magnum;12,50;4', 2026)
    expect(parsed.ok && parsed.ignored).toEqual(['Rating'])
    expect(parsed.ok && parsed.rows[0]).toMatchObject({
      draft: { name: 'Cuvée', vintage: 2019, color: 'red', sizeCl: 150 },
      quantity: 2,
      price: 12.5,
      errors: [],
    })
  })

  const failures: { name: string; text: string; want: string }[] = [
    { name: 'empty file', text: '', want: 'empty' },
    { name: 'no name or producer column', text: 'vintage,quantity\n2019,1', want: 'no-name-column' },
  ]
  for (const c of failures) {
    it(c.name, () => {
      expect(parseImport(c.text, 2026)).toEqual({ ok: false, error: c.want })
    })
  }

  const cells: { name: string; fields: string; want: Partial<ImportRow> & { sizeCl?: number; vintage?: number | null; color?: string } }[] = [
    { name: 'defaults for empty cells', fields: 'A,,,,,,', want: { quantity: 1, price: null, sizeCl: 75, vintage: null, color: 'other', errors: [] } },
    { name: 'non-vintage marker', fields: 'A,,NV,1,,,', want: { vintage: null, errors: [] } },
    { name: 'liters', fields: 'A,,,1,"1,5 L",,', want: { sizeCl: 150, errors: [] } },
    { name: 'milliliters', fields: 'A,,,1,375ml,,', want: { sizeCl: 37.5, errors: [] } },
    { name: 'zero quantity', fields: 'A,,,0,,,', want: { quantity: 0, errors: [] } },
    { name: 'German color', fields: 'A,,,1,,Weiß,', want: { color: 'white', errors: [] } },
    { name: 'missing name and producer', fields: ',,2019,1,,,', want: { errors: ['missing-name'] } },
    { name: 'future vintage', fields: 'A,,2031,1,,,', want: { errors: ['vintage'] } },
    { name: 'fractional quantity', fields: 'A,,,1.5,,,', want: { errors: ['quantity'], quantity: 0 } },
    { name: 'bad size', fields: 'A,,,1,big,,', want: { errors: ['size'] } },
    { name: 'unknown color', fields: 'A,,,1,,blue,', want: { errors: ['color'] } },
    { name: 'bad price', fields: 'A,,,1,,,cheap', want: { errors: ['price'], price: null } },
    { name: 'liters without unit', fields: 'A,,,1,"0,75",,', want: { sizeCl: 75, errors: [] } },
    { name: 'known cl format under a cl header', fields: 'A,,,1,1500,,', want: { sizeCl: 1500, errors: [] } },
  ]
  for (const c of cells) {
    it(c.name, () => {
      const r = row(c.fields)
      const { sizeCl, vintage, color, ...rest } = c.want
      expect(r).toMatchObject(rest)
      if (sizeCl !== undefined) expect(r.draft.sizeCl).toBe(sizeCl)
      if (vintage !== undefined) expect(r.draft.vintage).toBe(vintage)
      if (color !== undefined) expect(r.draft.color).toBe(color)
    })
  }
})

describe('parseImport sizes without unit', () => {
  const cases: [string, number][] = [
    ['75', 75],
    ['750', 75],
    ['375', 37.5],
    ['1500', 150],
    ['"1,5"', 150],
    ['50', 50],
    ['600', 600],
  ]
  for (const [raw, want] of cases) {
    it(raw, () => {
      expect(row(`A,${raw}`, 'name,volume').draft.sizeCl).toBe(want)
    })
  }
})

it('reports spreadsheet line numbers across blank lines', () => {
  const parsed = parseImport('name,vintage\nA,2019\n\n\nB,1700', 2026)
  expect(parsed.ok && parsed.rows.map((r) => [r.line, r.errors])).toEqual([
    [2, []],
    [5, ['vintage']],
  ])
})

describe('planImport', () => {
  let n = 0
  const ctx: PlanContext = {
    cellars: [
      { id: 'cave', name: 'Cave', position: 1, storage: {} },
      { id: 'main', name: '', position: 0, storage: {} },
    ],
    defaultCellarName: 'My cellar',
    date: '2026-10-09',
    now: 42,
    newId: () => `id${++n}`,
  }
  const existing = [makeWine({ id: 'old', name: 'Clos X', producer: 'Dom Y', vintage: 2018, sizeCl: 75 })]
  const text = [
    'cellar,name,producer,vintage,quantity,size_cl,purchase_price,notes',
    'cave,clos x,DOM Y,2018,2,,20,restock', // existing wine, cellar matched case-insensitively
    ',New,,2020,3,,,', // first cellar
    'Garage,New,,2020,1,,,', // repeat of the previous row, new cellar
    'garage,Other,,,0,,,', // new wine without stock
    'My cellar,Clos X,Dom Y,2018,1,150,,', // other size: a new wine
    'Bad,,,,,,,', // invalid
  ].join('\n')
  const parsed = parseImport(text, 2026)
  if (!parsed.ok) throw new Error(parsed.error)
  const plan = planImport(parsed.rows, existing, ctx)

  it('classifies every row', () => {
    expect(plan.matches).toEqual([
      { kind: 'existing', wineId: 'old' },
      { kind: 'new' },
      { kind: 'repeat', line: 3 },
      { kind: 'new' },
      { kind: 'new' },
      { kind: 'invalid' },
    ])
  })

  it('creates one cellar per unknown name, after the existing ones', () => {
    expect(plan.cellars).toEqual([{ id: 'id4', name: 'Garage', position: 2, storage: {} }])
  })

  it('records additions with price and note', () => {
    expect(plan.movements[0]).toEqual({
      id: 'id1',
      wineId: 'old',
      date: '2026-10-09',
      kind: 'add',
      quantity: 2,
      cellarId: 'cave',
      toCellarId: null,
      unitPrice: 20,
      note: 'restock',
    })
    const stock = computeStock(plan.movements)
    const fresh = plan.wines.find((w) => w.name === 'New')!
    expect(bottlesOf(stock, fresh.id, 'main')).toBe(3)
    expect(bottlesOf(stock, fresh.id, 'id4')).toBe(1)
    expect(plan.movements).toHaveLength(4)
  })

  it('builds complete new wines', () => {
    expect(plan.wines.map((w) => [w.name, w.sizeCl, w.createdAt, w.wished])).toEqual([
      ['New', 75, 42, false],
      ['Other', 75, 42, false],
      ['Clos X', 150, 42, false],
    ])
  })

  it('lists new wines lacking grapes or region for completion', () => {
    expect(incompleteRows(parsed.rows, plan).map((r) => r.line)).toEqual([3, 5, 6])
  })
})

describe('applyCompletion', () => {
  const completion = { grapes: [' Syrah '], region: 'Cornas', country: 'France' }
  const cases: { name: string; draft: Partial<ReturnType<typeof emptyDraft>>; want: [string[], string, string] }[] = [
    { name: 'fills empty fields', draft: {}, want: [['Syrah'], 'Cornas', 'France'] },
    { name: 'keeps what the user wrote', draft: { grapes: ['Gamay'], region: 'Morgon' }, want: [['Gamay'], 'Morgon', 'France'] },
  ]
  for (const c of cases) {
    it(c.name, () => {
      const d = applyCompletion({ ...emptyDraft(), ...c.draft }, completion)
      expect([d.grapes, d.region, d.country]).toEqual(c.want)
    })
  }
  it('returns the same draft when nothing is filled', () => {
    const draft = emptyDraft()
    expect(applyCompletion(draft, { grapes: [' '], region: null, country: '' })).toBe(draft)
  })
  it('accepts unknown answers', () => {
    expect(applyCompletion(emptyDraft(), { grapes: [], region: null, country: null }).region).toBe('')
  })
})
