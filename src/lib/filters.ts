import type { Tasting, Wine, WineColor } from './types'

export interface WineFilter {
  search: string
  colors: WineColor[]
  vintageMin: number | null
  vintageMax: number | null
  grape: string | null
  minRating: number | null
  ownedOnly: boolean
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
    f.ownedOnly
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

export function filterWines(wines: Wine[], tastings: Tasting[], f: WineFilter): Wine[] {
  const ratings = f.minRating !== null ? ratingsByWine(tastings) : null
  const search = f.search.trim().toLowerCase()
  return wines.filter((w) => {
    if (f.ownedOnly && w.bottlesOwned === 0) return false
    if (f.colors.length > 0 && !f.colors.includes(w.color)) return false
    if (f.vintageMin !== null && (w.vintage === null || w.vintage < f.vintageMin)) return false
    if (f.vintageMax !== null && (w.vintage === null || w.vintage > f.vintageMax)) return false
    if (f.grape !== null && !w.grapes.some((g) => g.toLowerCase() === f.grape!.toLowerCase())) {
      return false
    }
    if (ratings) {
      const r = ratings.get(w.id)
      if (r === undefined || r < f.minRating!) return false
    }
    if (search) {
      const haystack = [w.name, w.producer, w.region, w.country, ...w.grapes, w.vintage ?? '']
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

export type SortKey = 'recent' | 'name' | 'vintage' | 'rating'

export function sortWines(wines: Wine[], tastings: Tasting[], key: SortKey): Wine[] {
  const sorted = [...wines]
  switch (key) {
    case 'recent':
      return sorted.sort((a, b) => b.createdAt - a.createdAt)
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'vintage':
      return sorted.sort((a, b) => (b.vintage ?? -Infinity) - (a.vintage ?? -Infinity))
    case 'rating': {
      const ratings = ratingsByWine(tastings)
      return sorted.sort((a, b) => (ratings.get(b.id) ?? -1) - (ratings.get(a.id) ?? -1))
    }
  }
}

/** Distinct grape names across the collection, for the filter dropdown. */
export function distinctGrapes(wines: Wine[]): string[] {
  const seen = new Map<string, string>()
  for (const w of wines) {
    for (const g of w.grapes) {
      const k = g.toLowerCase()
      if (!seen.has(k)) seen.set(k, g)
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
