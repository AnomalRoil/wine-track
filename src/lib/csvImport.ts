import { isWindowOrdered, NO_AGING, WINDOW_KEYS } from './aging'
import { parseCsv } from './csv'
import type { WineDraft } from './extract'
import * as core from './messages/core'
import { BOTTLE_SIZES, STANDARD_SIZE_CL, WINE_COLORS, type Aging, type Cellar, type Movement, type Wine, type WineColor } from './types'

/** Columns of the import template and of the CSV export, in order. */
export const COLUMNS = [
  'cellar',
  'name',
  'producer',
  'vintage',
  'quantity',
  'size_cl',
  'color',
  'region',
  'country',
  'grapes',
  'purchase_price',
  'notes',
  'tags',
  'drink_from',
  'peak_from',
  'peak_until',
  'drink_until',
] as const
export type Column = (typeof COLUMNS)[number]

/** Header line written in the template and the CSV export. */
export const HEADERS: Record<Column, string> = {
  cellar: 'cellar',
  name: 'name',
  producer: 'producer',
  vintage: 'vintage',
  quantity: 'quantity',
  size_cl: 'size (cl)',
  color: 'color',
  region: 'region',
  country: 'country',
  grapes: 'grapes',
  purchase_price: 'purchase price',
  notes: 'notes',
  tags: 'tags',
  drink_from: 'drink from',
  peak_from: 'peak from',
  peak_until: 'peak until',
  drink_until: 'drink until',
}

/** Lowercase, without accents, spaces or punctuation: "Größe (cl)" → "grossecl". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll('ß', 'ss')
    .replace(/[^a-z0-9]/g, '')
}

// Header spellings people are likely to use in English, French and German spreadsheets.
const HEADER_ALIASES: Record<Column, string[]> = {
  cellar: ['cellar', 'cave', 'keller', 'location', 'emplacement', 'lagerort'],
  name: ['name', 'wine', 'nom', 'vin', 'cuvee', 'wein'],
  producer: ['producer', 'winery', 'domaine', 'producteur', 'chateau', 'produzent', 'erzeuger', 'weingut'],
  vintage: ['vintage', 'year', 'millesime', 'annee', 'jahrgang'],
  quantity: ['quantity', 'qty', 'bottles', 'quantite', 'bouteilles', 'menge', 'anzahl', 'flaschen'],
  size_cl: ['sizecl', 'size', 'format', 'volume', 'taille', 'contenance', 'grosse', 'grossecl', 'flaschengrosse'],
  color: ['color', 'colour', 'type', 'couleur', 'farbe', 'typ', 'weintyp'],
  region: ['region', 'appellation', 'aoc', 'regionappellation', 'anbaugebiet'],
  country: ['country', 'pays', 'land'],
  grapes: ['grapes', 'grape', 'varieties', 'cepages', 'cepage', 'rebsorten', 'rebsorte'],
  purchase_price: ['purchaseprice', 'price', 'unitprice', 'prix', 'prixdachat', 'kaufpreis', 'preis'],
  notes: ['notes', 'note', 'comment', 'comments', 'commentaire', 'commentaires', 'notizen', 'bemerkung', 'bemerkungen'],
  tags: ['tags', 'tag', 'etiquettes', 'schlagworte', 'schlagworter'],
  drink_from: ['drinkfrom', 'readyfrom', 'aboireapartirde', 'apartirde', 'trinkreifab', 'trinkenab'],
  peak_from: ['peakfrom', 'debutapogee', 'apogeeapartirde', 'hohepunktab'],
  peak_until: ['peakuntil', 'finapogee', 'apogeejusqua', 'hohepunktbis'],
  drink_until: ['drinkuntil', 'aboirejusqua', 'jusqua', 'trinkenbis'],
}

/** CSV column of each drinking-window year. */
const WINDOW_COLUMNS = {
  drinkFrom: 'drink_from',
  peakFrom: 'peak_from',
  peakUntil: 'peak_until',
  drinkUntil: 'drink_until',
} as const satisfies Record<(typeof WINDOW_KEYS)[number], Column>

const COLOR_ALIASES = new Map<string, WineColor>()
for (const color of WINE_COLORS) {
  COLOR_ALIASES.set(color, color)
  for (const m of [core.en, core.fr, core.de]) COLOR_ALIASES.set(fold(m[`color.${color}`]), color)
}
for (const [alias, color] of Object.entries({
  rouge: 'red',
  blanc: 'white',
  weisswein: 'white',
  rotwein: 'red',
  roze: 'rose',
  champagne: 'sparkling',
  mousseux: 'sparkling',
  petillant: 'sparkling',
  sekt: 'sparkling',
  dessert: 'sweet',
  liquoreux: 'sweet',
  doux: 'sweet',
  suss: 'sweet',
  mute: 'fortified',
} satisfies Record<string, WineColor>)) {
  COLOR_ALIASES.set(alias, color)
}

const SIZE_ALIASES = new Map<string, number>()
for (const size of BOTTLE_SIZES) {
  SIZE_ALIASES.set(size.name, size.cl)
  for (const m of [core.en, core.fr, core.de]) SIZE_ALIASES.set(fold(m[`size.${size.name}`]), size.cl)
}

export type RowError = 'missing-name' | 'vintage' | 'quantity' | 'size' | 'color' | 'price' | 'window'

/** Drinking-window years of a row; all null when the row has none. */
export type WindowYears = Pick<Aging, (typeof WINDOW_KEYS)[number]>

export interface ImportRow {
  /** Line number in the file, header included, for error messages. */
  line: number
  /** Cellar name as written; empty means the first cellar. */
  cellar: string
  draft: WineDraft
  quantity: number
  /** Purchase price per bottle. */
  price: number | null
  notes: string
  window: WindowYears
  errors: RowError[]
}

/** Largest CSV file accepted, in bytes; a bigger file would freeze the page while parsing. */
export const MAX_IMPORT_BYTES = 5_000_000

/** Most data lines accepted in one import; the preview renders each one. */
export const MAX_IMPORT_ROWS = 5000

export type ParsedImport =
  | { ok: true; rows: ImportRow[]; ignored: string[] }
  | { ok: false; error: 'empty' | 'no-name-column' | 'too-many-rows' }

/** Parses "12,50", "€ 12.50", "1 234,5" or "1,234.50"; NaN when not a number. */
export function parseNumber(raw: string): number {
  let s = raw.replace(/[^\d.,-]/g, '')
  if (s === '' || s === '-') return NaN
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) s = s.replaceAll('.', '').replace(',', '.')
  else s = s.replaceAll(',', '')
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN
}

function parseVintage(raw: string, maxYear: number): number | null | undefined {
  if (raw === '' || ['nv', 'sa', 'nm', 'none'].includes(fold(raw))) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1800 && n <= maxYear ? n : undefined
}

const KNOWN_CL = new Set<number>(BOTTLE_SIZES.map((s) => s.cl))

/**
 * Unit of a number written without one: liters below 10 (0,75), centiliters
 * under a header that says "cl", milliliters when that gives a known format
 * (750, 1500), else centiliters.
 */
function bareUnit(n: number, clHeader: boolean): 'l' | 'ml' | 'cl' {
  if (n < 10) return 'l'
  if (clHeader) return 'cl'
  return n >= 200 && KNOWN_CL.has(n / 10) ? 'ml' : 'cl'
}

function parseSize(raw: string, clHeader: boolean): number | undefined {
  if (raw === '') return STANDARD_SIZE_CL
  const named = SIZE_ALIASES.get(fold(raw))
  if (named) return named
  const n = parseNumber(raw)
  const unit = /(ml|cl|l)\s*$/i.exec(raw)?.[1].toLowerCase() ?? bareUnit(n, clHeader)
  const cl = unit === 'l' ? n * 100 : unit === 'ml' ? n / 10 : n
  return cl > 0 && cl <= 3000 ? Math.round(cl * 10) / 10 : undefined
}

function parseList(raw: string): string[] {
  return [...new Set(raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean))]
}

function pickWindow(a: WindowYears): WindowYears {
  return Object.fromEntries(WINDOW_KEYS.map((k) => [k, a[k]])) as WindowYears
}

/**
 * Reads an import CSV. Headers are matched loosely (case, accents, English,
 * French or German names); unknown columns are reported and skipped.
 */
export function parseImport(text: string, currentYear: number): ParsedImport {
  const [first, ...lines] = parseCsv(text)
  if (!first) return { ok: false, error: 'empty' }
  if (lines.length > MAX_IMPORT_ROWS) return { ok: false, error: 'too-many-rows' }
  const index = new Map<Column, number>()
  const ignored: string[] = []
  first.cells.forEach((h, i) => {
    const key = fold(h)
    const column = COLUMNS.find((c) => HEADER_ALIASES[c].includes(key))
    if (column && !index.has(column)) index.set(column, i)
    else if (h.trim()) ignored.push(h.trim())
  })
  if (!index.has('name') && !index.has('producer')) return { ok: false, error: 'no-name-column' }
  const clHeader = index.has('size_cl') && fold(first.cells[index.get('size_cl')!]).endsWith('cl')

  const rows = lines.map(({ line, cells }): ImportRow => {
    // Undoes the formula guard of toCsv.
    const get = (c: Column) => (index.has(c) ? (cells[index.get(c)!] ?? '').trim().replace(/^'(?=[=+\-@])/, '') : '')
    const errors: RowError[] = []

    const vintage = parseVintage(get('vintage'), currentYear + 1)
    if (vintage === undefined) errors.push('vintage')

    const rawQuantity = get('quantity')
    const quantity = rawQuantity === '' ? 1 : Number(rawQuantity)
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10000) errors.push('quantity')

    const sizeCl = parseSize(get('size_cl'), clHeader)
    if (sizeCl === undefined) errors.push('size')

    const rawColor = get('color')
    const color = rawColor === '' ? 'other' : COLOR_ALIASES.get(fold(rawColor))
    if (color === undefined) errors.push('color')

    const rawPrice = get('purchase_price')
    const price = rawPrice === '' ? null : parseNumber(rawPrice)
    if (price !== null && !(price >= 0)) errors.push('price')

    const window = pickWindow(NO_AGING)
    for (const key of WINDOW_KEYS) {
      const raw = get(WINDOW_COLUMNS[key])
      if (raw === '') continue
      const year = Number(raw)
      if (Number.isInteger(year) && year >= 1800 && year <= currentYear + 150) window[key] = year
      else if (!errors.includes('window')) errors.push('window')
    }
    if (!isWindowOrdered(window) && !errors.includes('window')) errors.push('window')

    const name = get('name')
    const producer = get('producer')
    if (!name && !producer) errors.push('missing-name')

    return {
      line,
      cellar: get('cellar'),
      draft: {
        name,
        producer,
        vintage: vintage ?? null,
        grapes: parseList(get('grapes')),
        region: get('region'),
        country: get('country'),
        color: color ?? 'other',
        sizeCl: sizeCl ?? STANDARD_SIZE_CL,
        tags: parseList(get('tags')),
      },
      quantity: errors.includes('quantity') ? 0 : quantity,
      price: errors.includes('price') ? null : price,
      notes: get('notes'),
      window: errors.includes('window') ? pickWindow(NO_AGING) : window,
      errors,
    }
  })
  return { ok: true, rows, ignored }
}

/**
 * Compares names ignoring case, spacing and accents on Latin letters (Château = Chateau).
 * Unlike fold, it keeps every script's letters apart, including marks that change a
 * non-Latin letter (は ≠ ば).
 */
export function identity(s: string): string {
  return s
    .normalize('NFD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Identity used to detect duplicates: same name, producer, vintage and bottle size. */
export function wineKey(w: Pick<WineDraft, 'name' | 'producer' | 'vintage' | 'sizeCl'>): string {
  return [identity(w.name), identity(w.producer), w.vintage ?? 'nv', w.sizeCl].join('|')
}

export type RowMatch =
  | { kind: 'invalid' }
  | { kind: 'new' }
  | { kind: 'existing'; wineId: string }
  | { kind: 'repeat'; line: number }

export interface ImportPlan {
  /** One entry per input row, in order. */
  matches: RowMatch[]
  wines: Wine[]
  cellars: Cellar[]
  movements: Movement[]
}

export interface PlanContext {
  /** Cellars as stored, any order. */
  cellars: Cellar[]
  /** Display name of the cellar whose stored name is empty. */
  defaultCellarName: string
  date: string
  now: number
  newId: () => string
}

/**
 * Turns valid rows into new wines, new cellars and stock additions. A row
 * matching an existing wine, or an earlier row, adds stock to that wine.
 */
export function planImport(rows: ImportRow[], existing: Wine[], ctx: PlanContext): ImportPlan {
  const byKey = new Map(existing.map((w) => [wineKey(w), w.id]))
  const firstLine = new Map<string, number>()
  const sorted = [...ctx.cellars].sort((a, b) => a.position - b.position)
  const cellarIds = new Map(sorted.map((c) => [identity(c.name || ctx.defaultCellarName), c.id]))
  let position = Math.max(-1, ...sorted.map((c) => c.position))
  const plan: ImportPlan = { matches: [], wines: [], cellars: [], movements: [] }

  for (const row of rows) {
    if (row.errors.length > 0) {
      plan.matches.push({ kind: 'invalid' })
      continue
    }
    const key = wineKey(row.draft)
    let wineId = byKey.get(key)
    if (wineId && firstLine.has(key)) {
      plan.matches.push({ kind: 'repeat', line: firstLine.get(key)! })
    } else if (wineId) {
      plan.matches.push({ kind: 'existing', wineId })
    } else {
      wineId = ctx.newId()
      byKey.set(key, wineId)
      firstLine.set(key, row.line)
      plan.matches.push({ kind: 'new' })
      plan.wines.push({
        id: wineId,
        ...row.draft,
        wished: false,
        value: null,
        valueHistory: [],
        photoId: null,
        drinkBy: null,
        tasteAgainOn: null,
        createdAt: ctx.now,
        ...NO_AGING,
        ...row.window,
      })
    }
    if (row.quantity === 0) continue

    let cellarId = row.cellar ? cellarIds.get(identity(row.cellar)) : sorted[0]?.id
    if (!cellarId) {
      cellarId = ctx.newId()
      cellarIds.set(identity(row.cellar), cellarId)
      plan.cellars.push({ id: cellarId, name: row.cellar, position: ++position, storage: {} })
    }
    plan.movements.push({
      id: ctx.newId(),
      wineId,
      date: ctx.date,
      kind: 'add',
      quantity: row.quantity,
      cellarId,
      toCellarId: null,
      unitPrice: row.price,
      note: row.notes,
    })
  }
  return plan
}

/** Valid rows that create a wine and lack grapes or a region, for an online completion. */
export function incompleteRows(rows: ImportRow[], plan: ImportPlan): ImportRow[] {
  return rows.filter(
    (row, i) => plan.matches[i].kind === 'new' && (row.draft.grapes.length === 0 || !row.draft.region),
  )
}

export interface Completion {
  grapes: string[]
  region: string | null
  country: string | null
}

/** Fills only the fields the row left empty; what the user wrote always wins. Returns `draft` itself when nothing was filled. */
export function applyCompletion(draft: WineDraft, c: Completion): WineDraft {
  const next = {
    ...draft,
    grapes: draft.grapes.length > 0 ? draft.grapes : c.grapes.map((g) => g.trim()).filter(Boolean),
    region: draft.region || c.region?.trim() || '',
    country: draft.country || c.country?.trim() || '',
  }
  const filled = next.grapes.length > draft.grapes.length || next.region !== draft.region || next.country !== draft.country
  return filled ? next : draft
}
