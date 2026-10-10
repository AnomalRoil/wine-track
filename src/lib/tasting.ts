import type { Tasting, TastingSheet, WineColor } from './types'

/** Ordered answers of each graded attribute of the sheet, weakest first. */
export const SCALES = {
  clarity: ['clear', 'hazy', 'cloudy'],
  colorIntensity: ['pale', 'medium', 'deep'],
  noseIntensity: ['light', 'medium', 'pronounced'],
  openness: ['closed', 'opening', 'open'],
  sweetness: ['dry', 'offDry', 'medium', 'sweet', 'luscious'],
  acidity: ['low', 'medium', 'high'],
  tannin: ['low', 'medium', 'high'],
  body: ['light', 'medium', 'full'],
  finish: ['short', 'medium', 'long'],
} as const

export type ScaleName = keyof typeof SCALES

export const APPEARANCE_SCALES = ['clarity', 'colorIntensity'] as const satisfies ScaleName[]
export const NOSE_SCALES = ['noseIntensity', 'openness'] as const satisfies ScaleName[]
export const PALATE_SCALES = ['sweetness', 'acidity', 'tannin', 'body', 'finish'] as const satisfies ScaleName[]

/** Color shades with a representative swatch, keyed by shade id. */
export const SHADES = {
  lemon: '#efe7a2',
  straw: '#ecdc8c',
  yellow: '#e8cc5c',
  gold: '#d9a93a',
  amber: '#b97a2a',
  salmon: '#f2a385',
  pink: '#ef8fa3',
  copper: '#c9744a',
  orange: '#d9822b',
  purple: '#5b1e4d',
  ruby: '#8e1530',
  garnet: '#7a2626',
  tawny: '#9a5a33',
} as const

export type Shade = keyof typeof SHADES

const WHITE_SHADES: Shade[] = ['lemon', 'straw', 'yellow', 'gold', 'amber']
const ROSE_SHADES: Shade[] = ['salmon', 'pink', 'copper']
const RED_SHADES: Shade[] = ['purple', 'ruby', 'garnet', 'tawny']

/**
 * Shades offered for a wine of the given color. Sparkling, sweet, fortified
 * and other wines can be any hue, so they get every white, rosé and red shade.
 */
export function shadesFor(color: WineColor): Shade[] {
  switch (color) {
    case 'white':
      return WHITE_SHADES
    case 'rose':
      return ROSE_SHADES
    case 'red':
      return RED_SHADES
    case 'orange':
      return ['gold', 'amber', 'orange', 'copper']
    default:
      return [...WHITE_SHADES, ...ROSE_SHADES, ...RED_SHADES]
  }
}

/** Shades to offer, keeping a stored shade the wine's color no longer offers so it stays visible and clearable. */
export function shadeChoices(color: WineColor, current: Shade | null): Shade[] {
  const shades = shadesFor(color)
  return current && !shades.includes(current) ? [...shades, current] : shades
}

export type AromaFamily = 'fruit' | 'floral' | 'vegetal' | 'spice' | 'earthy' | 'animal' | 'toasty' | 'faults'

export interface AromaGroup {
  /** Message suffix: the group title, and the family title for single-group families. */
  id: string
  family: AromaFamily
  aromas: string[]
}

/** The aroma picker, by family then group, in display order. Aroma ids are unique. */
export const AROMA_GROUPS: AromaGroup[] = [
  { id: 'redFruit', family: 'fruit', aromas: ['strawberry', 'raspberry', 'redCherry', 'redcurrant', 'cranberry'] },
  { id: 'blackFruit', family: 'fruit', aromas: ['blackberry', 'blackcurrant', 'blackCherry', 'plum', 'blueberry'] },
  { id: 'citrus', family: 'fruit', aromas: ['lemon', 'lime', 'grapefruit', 'orangePeel'] },
  { id: 'orchardFruit', family: 'fruit', aromas: ['apple', 'pear', 'quince'] },
  { id: 'stoneFruit', family: 'fruit', aromas: ['peach', 'apricot', 'nectarine'] },
  { id: 'tropicalFruit', family: 'fruit', aromas: ['pineapple', 'mango', 'passionFruit', 'lychee', 'banana'] },
  { id: 'driedFruit', family: 'fruit', aromas: ['fig', 'raisin', 'prune', 'driedApricot'] },
  { id: 'floral', family: 'floral', aromas: ['violet', 'rose', 'acacia', 'elderflower', 'orangeBlossom'] },
  { id: 'vegetal', family: 'vegetal', aromas: ['greenPepper', 'cutGrass', 'tomatoLeaf', 'asparagus', 'hay'] },
  { id: 'spice', family: 'spice', aromas: ['blackPepper', 'clove', 'cinnamon', 'licorice', 'mint', 'thyme', 'eucalyptus'] },
  { id: 'earthy', family: 'earthy', aromas: ['mushroom', 'forestFloor', 'truffle'] },
  { id: 'animal', family: 'animal', aromas: ['leather', 'game', 'curedMeat'] },
  { id: 'toasty', family: 'toasty', aromas: ['smoke', 'coffee', 'cocoa', 'caramel', 'vanilla'] },
  { id: 'faults', family: 'faults', aromas: ['cork', 'oxidized', 'reduced', 'volatile'] },
]

export const AROMA_FAMILIES: AromaFamily[] = [...new Set(AROMA_GROUPS.map((g) => g.family))]

const familyOf = new Map(AROMA_GROUPS.flatMap((g) => g.aromas.map((a) => [a, g.family] as const)))

/** Picker order of every aroma, for stable display whatever order they were picked in. */
const aromaOrder = new Map(AROMA_GROUPS.flatMap((g) => g.aromas).map((a, i) => [a, i]))

export function aromaFamily(aroma: string): AromaFamily | undefined {
  return familyOf.get(aroma)
}

export function emptySheet(): TastingSheet {
  return {
    people: [],
    place: '',
    meal: '',
    photoIds: [],
    clarity: null,
    colorIntensity: null,
    shade: null,
    noseIntensity: null,
    openness: null,
    aromas: [],
    sweetness: null,
    acidity: null,
    tannin: null,
    body: null,
    finish: null,
    conclusion: '',
  }
}

/** True when nothing was filled in, so the tasting is a quick one. */
export function isEmptySheet(sheet: TastingSheet): boolean {
  const empty = emptySheet()
  return (Object.keys(empty) as (keyof TastingSheet)[]).every((k) => {
    const v = sheet[k]
    if (Array.isArray(v)) return v.length === 0
    if (typeof v === 'string') return v.trim() === ''
    return v === empty[k]
  })
}

/** Fills fields missing from a sheet saved by an older version; drops an empty sheet. */
export function normalizeTasting(tasting: Tasting): Tasting {
  const { sheet, ...rest } = tasting
  if (!sheet) return rest
  const full = { ...emptySheet(), ...sheet }
  return isEmptySheet(full) ? rest : { ...rest, sheet: full }
}

/** Aromas in picker order, faults first since they matter most. */
export function sortedAromas(aromas: string[]): string[] {
  const rank = (a: string) => (aromaFamily(a) === 'faults' ? -1000 : 0) + (aromaOrder.get(a) ?? aromaOrder.size)
  return [...aromas].sort((a, b) => rank(a) - rank(b))
}

/** The few aromas worth showing in a one-line summary. */
export function keyAromas(sheet: TastingSheet | undefined, max = 3): string[] {
  return sheet ? sortedAromas(sheet.aromas).slice(0, max) : []
}

/** Graded attributes that were answered, in the given order. */
export function answered(sheet: TastingSheet, names: readonly ScaleName[]): { name: ScaleName; value: string }[] {
  return names.flatMap((name) => {
    const value = sheet[name]
    return value ? [{ name, value }] : []
  })
}
