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

export interface Wine {
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
  photoId: string | null
  /** 0 means tasted but not in the cellar. */
  bottlesOwned: number
  /** "YYYY-MM-DD" deadline to drink the wine, or null. */
  drinkBy: string | null
  /** "YYYY-MM-DD" reminder to taste again, or null. */
  tasteAgainOn: string | null
  createdAt: number
}

export interface Tasting {
  id: string
  wineId: string
  /** "YYYY-MM-DD" */
  date: string
  /** 1.0–5.0, one decimal. */
  rating: number
  notes: string
}

export interface Photo {
  id: string
  blob: Blob
  /** Square list icon; generated lazily for photos saved before it existed. */
  thumb?: Blob
}
