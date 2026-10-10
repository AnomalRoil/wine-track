import { lastYear, phaseOf, type Phase } from './aging'
import { addDays, DRINK_HORIZON_DAYS } from './due'
import { averageBuyPrices, bottlesOf, computeStock, type Stock } from './stock'
import type { Movement, PricePoint, Tasting, Wine } from './types'

export interface Totals {
  bottles: number
  /** Wines with at least one bottle in stock. */
  wines: number
  /** Purchase cost of the bottles in stock, from each wine's average buy price. */
  invested: number
  /** Estimated value of the bottles in stock; bottles without a value count at their purchase price. */
  value: number
  /** Value minus cost, over bottles that have both. */
  added: number
  /** Bottles in stock with no known purchase price. */
  unpriced: number
}

function inStock(wines: Wine[], stock: Stock): { wine: Wine; bottles: number }[] {
  return wines.map((wine) => ({ wine, bottles: bottlesOf(stock, wine.id) })).filter((x) => x.bottles > 0)
}

export function totals(wines: Wine[], movements: Movement[], stock: Stock): Totals {
  const prices = averageBuyPrices(movements)
  const out: Totals = { bottles: 0, wines: 0, invested: 0, value: 0, added: 0, unpriced: 0 }
  for (const { wine, bottles } of inStock(wines, stock)) {
    const buy = prices.get(wine.id)
    out.bottles += bottles
    out.wines++
    if (buy === undefined) out.unpriced += bottles
    else out.invested += buy * bottles
    out.value += (wine.value ?? buy ?? 0) * bottles
    if (wine.value !== null && buy !== undefined) out.added += (wine.value - buy) * bottles
  }
  return out
}

export const DIMENSIONS = ['color', 'country', 'region', 'grape', 'vintage', 'size', 'cellar'] as const
export type Dimension = (typeof DIMENSIONS)[number]

export interface Share {
  /** Grouping key: the display spelling, a cellar id, a size in cl, a year; '' when unset. */
  key: string
  count: number
  /** Fraction of the total, 0–1. */
  share: number
}

function groupKey(key: string): string {
  return key.trim().toLowerCase()
}

/** Counts per key, merging keys case-insensitively under the first spelling seen, largest first. */
function rank(entries: [key: string, count: number][], total: number): Share[] {
  const groups = new Map<string, Share>()
  for (const [key, count] of entries) {
    const k = groupKey(key)
    const g = groups.get(k)
    if (g) g.count += count
    else groups.set(k, { key: key.trim(), count, share: 0 })
  }
  for (const g of groups.values()) g.share = total > 0 ? g.count / total : 0
  return [...groups.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

/**
 * Bottles in stock grouped by `dimension`. A blend counts toward each of its
 * grapes, so grape shares can add up to more than 1.
 */
export function composition(wines: Wine[], stock: Stock, dimension: Dimension): Share[] {
  const owned = inStock(wines, stock)
  const total = owned.reduce((n, x) => n + x.bottles, 0)
  const entries: [string, number][] = []
  for (const { wine, bottles } of owned) {
    switch (dimension) {
      case 'color':
        entries.push([wine.color, bottles])
        break
      case 'country':
        entries.push([wine.country, bottles])
        break
      case 'region':
        entries.push([wine.region, bottles])
        break
      case 'grape':
        if (wine.grapes.length === 0) entries.push(['', bottles])
        for (const [i, g] of wine.grapes.entries())
          if (wine.grapes.findIndex((x) => groupKey(x) === groupKey(g)) === i) entries.push([g, bottles])
        break
      case 'vintage':
        entries.push([wine.vintage === null ? '' : String(wine.vintage), bottles])
        break
      case 'size':
        entries.push([String(wine.sizeCl), bottles])
        break
      case 'cellar':
        for (const [cellarId, n] of stock.get(wine.id) ?? []) if (n > 0) entries.push([cellarId, n])
        break
    }
  }
  return rank(entries, total)
}

export interface Flow {
  /** "YYYY-MM" or "YYYY" */
  period: string
  added: number
  drunk: number
  gifted: number
}

function flows(movements: Movement[], periods: string[], periodOf: (date: string) => string): Flow[] {
  const byPeriod = new Map(periods.map((period) => [period, { period, added: 0, drunk: 0, gifted: 0 }]))
  for (const m of movements) {
    const f = byPeriod.get(periodOf(m.date))
    if (!f) continue
    if (m.kind === 'add') f.added += m.quantity
    else if (m.kind === 'consume') f.drunk += m.quantity
    else if (m.kind === 'gift') f.gifted += m.quantity
  }
  return [...byPeriod.values()]
}

/** "YYYY-MM" shifted by `n` months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** Bottles added, drunk and gifted in each of the `months` months ending with today's, oldest first. */
export function monthlyFlows(movements: Movement[], today: string, months = 12): Flow[] {
  const current = today.slice(0, 7)
  const periods = Array.from({ length: months }, (_, i) => addMonths(current, i - months + 1))
  return flows(movements, periods, (date) => date.slice(0, 7))
}

/** Bottles added, drunk and gifted per year, from the first movement's year to today's. */
export function yearlyFlows(movements: Movement[], today: string): Flow[] {
  const last = Number(today.slice(0, 4))
  const first = Math.min(last, ...movements.map((m) => Number(m.date.slice(0, 4))))
  const periods = Array.from({ length: last - first + 1 }, (_, i) => String(first + i))
  return flows(movements, periods, (date) => date.slice(0, 4))
}

export interface ValuePoint {
  /** "YYYY-MM"; values hold at the end of that month. */
  month: string
  value: number
  invested: number
}

/**
 * Latest-dated value set by the end of `month`, else the purchase price, else 0. The history
 * can be out of order, e.g. after a clock correction. The current month uses `wine.value`,
 * which also covers estimates cleared before clearing was dated.
 */
function valueAt(wine: Wine, month: string, current: string, buy: number | undefined): number {
  if (month >= current) return wine.value ?? buy ?? 0
  let latest: PricePoint | undefined
  for (const p of wine.valueHistory) if (p.date.slice(0, 7) <= month && (!latest || p.date >= latest.date)) latest = p
  return latest?.value ?? buy ?? 0
}

/**
 * Month-end value and purchase cost of the stock, from the first movement's
 * month to today's, rebuilt by replaying movements against the value history.
 */
export function valueOverTime(wines: Wine[], movements: Movement[], today: string): ValuePoint[] {
  if (movements.length === 0) return []
  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date))
  const current = today.slice(0, 7)
  const points: ValuePoint[] = []
  let applied = 0
  for (let month = sorted[0].date.slice(0, 7); month <= current; month = addMonths(month, 1)) {
    while (applied < sorted.length && sorted[applied].date.slice(0, 7) <= month) applied++
    const past = sorted.slice(0, applied)
    const stock = computeStock(past)
    const prices = averageBuyPrices(past)
    const point = { month, value: 0, invested: 0 }
    for (const { wine, bottles } of inStock(wines, stock)) {
      const buy = prices.get(wine.id)
      point.value += valueAt(wine, month, current, buy) * bottles
      point.invested += (buy ?? 0) * bottles
    }
    points.push(point)
  }
  return points
}

/** Year-end points ("YYYY"), the last one holding today's values. */
export function yearlyValues(points: ValuePoint[]): ValuePoint[] {
  const byYear = new Map<string, ValuePoint>()
  for (const p of points) byYear.set(p.month.slice(0, 4), { ...p, month: p.month.slice(0, 4) })
  return [...byYear.values()]
}

export interface WineGain {
  wine: Wine
  bottles: number
  added: number
}

/** Wines in stock whose value exceeds their purchase price, biggest total gain first. */
export function topAddedValue(wines: Wine[], movements: Movement[], stock: Stock, limit = 5): WineGain[] {
  const prices = averageBuyPrices(movements)
  const gains: WineGain[] = []
  for (const { wine, bottles } of inStock(wines, stock)) {
    const buy = prices.get(wine.id)
    if (wine.value === null || buy === undefined) continue
    const added = (wine.value - buy) * bottles
    if (added > 0) gains.push({ wine, bottles, added })
  }
  return gains.sort((a, b) => b.added - a.added).slice(0, limit)
}

/** Bottles drunk per region, most drunk first. */
export function consumedRegions(wines: Wine[], movements: Movement[]): Share[] {
  const regions = new Map(wines.map((w) => [w.id, w.region]))
  const drunk = movements.filter((m) => m.kind === 'consume' && regions.has(m.wineId))
  const total = drunk.reduce((n, m) => n + m.quantity, 0)
  return rank(
    drunk.map((m) => [regions.get(m.wineId)!, m.quantity]),
    total,
  )
}

export interface RatingBucket {
  rating: number
  count: number
}

/** Tastings per half-star step from 1 to 5. */
export function ratingHistogram(tastings: Tasting[]): RatingBucket[] {
  const buckets = Array.from({ length: 9 }, (_, i) => ({ rating: 1 + i / 2, count: 0 }))
  for (const t of tastings) {
    const i = Math.round((Math.min(5, Math.max(1, t.rating)) - 1) * 2)
    buckets[i].count++
  }
  return buckets
}

export type DrinkStatus = 'ready' | 'peak' | 'decline'

const PHASE_STATUS: Partial<Record<Phase, DrinkStatus>> = { maturity: 'ready', peak: 'peak', decline: 'decline' }

/**
 * Where a wine stands in its drinking window; young wines are null. A wine
 * without a window falls back to its drink-before date: past it (decline),
 * due within the drink-soon horizon (peak), or later (ready).
 */
export function drinkStatus(wine: Wine, today: string): DrinkStatus | null {
  const phase = phaseOf(wine, Number(today.slice(0, 4)))
  if (phase) return PHASE_STATUS[phase] ?? null
  if (!wine.drinkBy) return null
  if (wine.drinkBy < today) return 'decline'
  if (wine.drinkBy <= addDays(today, DRINK_HORIZON_DAYS)) return 'peak'
  return 'ready'
}

/** In-stock wines by drink status, the window closing soonest first, then by drink-before date. */
export function drinkShortcuts(wines: Wine[], stock: Stock, today: string): Record<DrinkStatus, Wine[]> {
  const out: Record<DrinkStatus, Wine[]> = { ready: [], peak: [], decline: [] }
  for (const { wine } of inStock(wines, stock)) {
    const status = drinkStatus(wine, today)
    if (status) out[status].push(wine)
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => lastYear(a) - lastYear(b) || (a.drinkBy ?? '').localeCompare(b.drinkBy ?? ''))
  }
  return out
}
