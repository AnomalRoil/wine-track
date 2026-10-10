import { lastYear, phaseOf, urgency, type Phase } from './aging'
import { bottlesOf, type Stock } from './stock'
import type { Tasting, Wine, WineColor } from './types'

/** Collection data a filter or sort needs besides the wines themselves. */
export interface FilterContext {
  tastings: Tasting[]
  stock: Stock
  /** Average price paid per bottle, by wine id. */
  buyPrices: Map<string, number>
  /** Current year, for drinking phases. */
  year: number
}

export interface WineFilter {
  search: string
  colors: WineColor[]
  vintageMin: number | null
  vintageMax: number | null
  grape: string | null
  minRating: number | null
  ownedOnly: boolean
  wishedOnly: boolean
  /** Only wines with bottles in this cellar. */
  cellarId: string | null
  tag: string | null
  phases: Phase[]
}

export function emptyFilter(): WineFilter {
  return {
    search: '',
    colors: [],
    vintageMin: null,
    vintageMax: null,
    grape: null,
    minRating: null,
    ownedOnly: false,
    wishedOnly: false,
    cellarId: null,
    tag: null,
    phases: [],
  }
}

export function isFilterActive(f: WineFilter): boolean {
  return (
    f.search !== '' ||
    f.colors.length > 0 ||
    f.vintageMin !== null ||
    f.vintageMax !== null ||
    f.grape !== null ||
    f.minRating !== null ||
    f.ownedOnly ||
    f.wishedOnly ||
    f.cellarId !== null ||
    f.tag !== null ||
    f.phases.length > 0
  )
}

export function avgRating(tastings: Tasting[]): number | null {
  if (tastings.length === 0) return null
  return tastings.reduce((sum, t) => sum + t.rating, 0) / tastings.length
}

function ratingsByWine(tastings: Tasting[]): Map<string, number> {
  const grouped = new Map<string, Tasting[]>()
  for (const t of tastings) {
    const list = grouped.get(t.wineId)
    if (list) list.push(t)
    else grouped.set(t.wineId, [t])
  }
  const avg = new Map<string, number>()
  for (const [wineId, list] of grouped) avg.set(wineId, avgRating(list)!)
  return avg
}

function hasName(names: string[], name: string): boolean {
  const k = name.toLowerCase()
  return names.some((n) => n.toLowerCase() === k)
}

export function filterWines(wines: Wine[], ctx: FilterContext, f: WineFilter): Wine[] {
  const ratings = f.minRating !== null ? ratingsByWine(ctx.tastings) : null
  const search = f.search.trim().toLowerCase()
  return wines.filter((w) => {
    if (f.ownedOnly && bottlesOf(ctx.stock, w.id) <= 0) return false
    if (f.wishedOnly && !w.wished) return false
    if (f.cellarId !== null && bottlesOf(ctx.stock, w.id, f.cellarId) <= 0) return false
    if (f.tag !== null && !hasName(w.tags, f.tag)) return false
    if (f.colors.length > 0 && !f.colors.includes(w.color)) return false
    if (f.vintageMin !== null && (w.vintage === null || w.vintage < f.vintageMin)) return false
    if (f.vintageMax !== null && (w.vintage === null || w.vintage > f.vintageMax)) return false
    if (f.grape !== null && !hasName(w.grapes, f.grape)) return false
    if (f.phases.length > 0) {
      const phase = phaseOf(w, ctx.year)
      if (phase === null || !f.phases.includes(phase)) return false
    }
    if (ratings) {
      const r = ratings.get(w.id)
      if (r === undefined || r < f.minRating!) return false
    }
    if (search) {
      const haystack = [w.name, w.producer, w.region, w.country, ...w.grapes, ...w.tags, w.vintage ?? '']
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

export const SORT_KEYS = ['recent', 'name', 'vintage', 'rating', 'value', 'buyPrice', 'urgency'] as const
export type SortKey = (typeof SORT_KEYS)[number]

/** Sorts by a number, highest first, with wines lacking it last. */
function byDescending(wines: Wine[], of: (w: Wine) => number | null | undefined): Wine[] {
  return wines.sort((a, b) => (of(b) ?? -Infinity) - (of(a) ?? -Infinity))
}

export function sortWines(wines: Wine[], ctx: FilterContext, key: SortKey): Wine[] {
  const sorted = [...wines]
  switch (key) {
    case 'recent':
      return sorted.sort((a, b) => b.createdAt - a.createdAt)
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'vintage':
      return byDescending(sorted, (w) => w.vintage)
    case 'rating': {
      const ratings = ratingsByWine(ctx.tastings)
      return byDescending(sorted, (w) => ratings.get(w.id))
    }
    case 'value':
      return byDescending(sorted, (w) => w.value)
    case 'buyPrice':
      return byDescending(sorted, (w) => ctx.buyPrices.get(w.id))
    case 'urgency':
      return sorted.sort(
        (a, b) => urgency(phaseOf(a, ctx.year)) - urgency(phaseOf(b, ctx.year)) || lastYear(a) - lastYear(b),
      )
  }
}

/** Distinct grape names across the collection, for the filter dropdown. */
export function distinctGrapes(wines: Wine[]): string[] {
  return distinctNames(wines.map((w) => w.grapes))
}

export function distinctTags(wines: Wine[]): string[] {
  return distinctNames(wines.map((w) => w.tags))
}

/** Case-insensitive union of name lists, keeping the first spelling seen, sorted. */
function distinctNames(lists: string[][]): string[] {
  const seen = new Map<string, string>()
  for (const list of lists) {
    for (const g of list) {
      const k = g.toLowerCase()
      if (!seen.has(k)) seen.set(k, g)
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
