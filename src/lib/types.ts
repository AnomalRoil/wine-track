import type { SCALES, Shade } from './tasting'

export type WineColor =
  | 'red'
  | 'white'
  | 'rose'
  | 'orange'
  | 'sparkling'
  | 'sweet'
  | 'fortified'
  | 'other'

export const WINE_COLORS: WineColor[] = [
  'red',
  'white',
  'rose',
  'orange',
  'sparkling',
  'sweet',
  'fortified',
  'other',
]

/** Named bottle formats, in centiliters. */
export const BOTTLE_SIZES = [
  { name: 'piccolo', cl: 20 },
  { name: 'half', cl: 37.5 },
  { name: 'medium', cl: 50 },
  { name: 'clavelin', cl: 62 },
  { name: 'standard', cl: 75 },
  { name: 'liter', cl: 100 },
  { name: 'magnum', cl: 150 },
  { name: 'jeroboam', cl: 300 },
  { name: 'rehoboam', cl: 450 },
  { name: 'methuselah', cl: 600 },
  { name: 'salmanazar', cl: 900 },
  { name: 'balthazar', cl: 1200 },
  { name: 'nebuchadnezzar', cl: 1500 },
] as const

export const STANDARD_SIZE_CL = 75

export interface PricePoint {
  /** "YYYY-MM-DD" */
  date: string
  /** Null when the estimate was cleared that day. */
  value: number | null
}

/** How a wine tastes, each axis 0–10 from the first pole to the second. */
export interface TasteProfile {
  /** light ↔ bold */
  body: number
  /** smooth ↔ tannic */
  tannin: number
  /** dry ↔ sweet */
  sweetness: number
  /** soft ↔ acidic */
  acidity: number
  /** still ↔ fizzy; shown for sparkling wines only. */
  fizz: number
}

/** Drinking window and serving advice; every field is null when unknown. */
export interface Aging {
  /** Years: ready to drink from, at peak from/until, drinkable until. */
  drinkFrom: number | null
  peakFrom: number | null
  peakUntil: number | null
  drinkUntil: number | null
  /** Serving temperature range, always stored in °C. */
  servingMinC: number | null
  servingMaxC: number | null
  /** 0 means no decanting. */
  decantMinutes: number | null
  profile: TasteProfile | null
}

export interface Wine extends Aging {
  id: string
  name: string
  producer: string
  /** Millésime; null for non-vintage wines. */
  vintage: number | null
  grapes: string[]
  /** Region or appellation, free text. */
  region: string
  country: string
  color: WineColor
  sizeCl: number
  tags: string[]
  /** On the wishlist: wanted, regardless of stock. */
  wished: boolean
  /** Latest estimated value of one bottle, in the settings currency. */
  value: number | null
  /** Every value ever set, oldest first; the last entry equals `value`. */
  valueHistory: PricePoint[]
  photoId: string | null
  /** "YYYY-MM-DD" deadline to drink the wine, or null. */
  drinkBy: string | null
  /** "YYYY-MM-DD" reminder to taste again, or null. */
  tasteAgainOn: string | null
  createdAt: number
}

export interface Cellar {
  id: string
  /** Empty for the cellar created on first run; shown under a localized default name. */
  name: string
  /** Display order, ascending. */
  position: number
  /** Storage-conditions checklist; unanswered questions are absent. */
  storage: StorageAnswers
}

export const RACK_LAYOUTS = ['lying', 'standing', 'diamond'] as const
/** How bottles sit in a rack: lying necks out, standing, or lying in rows shifted by half a slot. */
export type RackLayout = (typeof RACK_LAYOUTS)[number]

/** A grid of bottle slots in a cellar. */
export interface Rack {
  id: string
  cellarId: string
  name: string
  columns: number
  rows: number
  /** 1 for a single layer, 2 for front and back. */
  depth: number
  layout: RackLayout
  /** Display order within the cellar, ascending. */
  position: number
}

/** One bottle of a wine sitting in a rack slot. Rows and columns count from 0, top left; layer 0 is the front. */
export interface Placement {
  /** Derived from the slot, so a slot never holds two bottles. */
  id: string
  rackId: string
  layer: number
  row: number
  column: number
  wineId: string
}
export type StorageFactor =
  | 'temperature'
  | 'stability'
  | 'humidity'
  | 'airflow'
  | 'light'
  | 'position'
  | 'vibration'
  | 'odors'

/** Chosen option id per checklist question; see STORAGE_QUESTIONS. */
export type StorageAnswers = Partial<Record<StorageFactor, string>>

export type MovementKind = 'add' | 'consume' | 'gift' | 'adjust' | 'transfer'

export const REMOVAL_KINDS = ['consume', 'gift', 'adjust'] as const satisfies MovementKind[]

/**
 * A change in stock. Stock levels are never stored: they are the sum of all
 * movements, so the journal and the cellar can never disagree.
 */
export interface Movement {
  id: string
  wineId: string
  /** "YYYY-MM-DD" */
  date: string
  kind: MovementKind
  /** Bottle count, always positive; `kind` gives the direction. */
  quantity: number
  /** Source cellar for removals and transfers, destination for additions. */
  cellarId: string
  /** Destination of a transfer; null otherwise. */
  toCellarId: string | null
  /** Price paid per bottle, for additions; null when unknown. */
  unitPrice: number | null
  note: string
}

export interface Tasting {
  id: string
  wineId: string
  /** "YYYY-MM-DD" */
  date: string
  /** 1.0–5.0, one decimal. */
  rating: number
  notes: string
  /** Detailed tasting sheet; absent for a quick tasting. */
  sheet?: TastingSheet
}

type Answer<K extends keyof typeof SCALES> = (typeof SCALES)[K][number] | null

export interface TastingSheet {
  people: string[]
  place: string
  meal: string
  /** Photos taken during the tasting, in the `photos` store. */
  photoIds: string[]
  clarity: Answer<'clarity'>
  colorIntensity: Answer<'colorIntensity'>
  shade: Shade | null
  noseIntensity: Answer<'noseIntensity'>
  openness: Answer<'openness'>
  /** Aroma ids from `AROMA_GROUPS`. */
  aromas: string[]
  sweetness: Answer<'sweetness'>
  acidity: Answer<'acidity'>
  tannin: Answer<'tannin'>
  body: Answer<'body'>
  finish: Answer<'finish'>
  conclusion: string
}

export interface Photo {
  id: string
  blob: Blob
  /** Square list icon; generated lazily for photos saved before it existed. */
  thumb?: Blob
}
