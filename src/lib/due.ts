import type { Wine } from './types'

export interface DueItem {
  wine: Wine
  /** "YYYY-MM-DD" */
  date: string
  overdue: boolean
}

export const DRINK_HORIZON_DAYS = 183
const TASTE_HORIZON_DAYS = 30

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function addYears(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d.toISOString().slice(0, 10)
}

/** Wines whose drink-by or taste-again date falls within the horizon of `today`. */
export function computeDue(wines: Wine[], today: string): { drinkSoon: DueItem[]; tasteAgain: DueItem[] } {
  const drinkLimit = addDays(today, DRINK_HORIZON_DAYS)
  const tasteLimit = addDays(today, TASTE_HORIZON_DAYS)
  const drinkSoon: DueItem[] = []
  const tasteAgain: DueItem[] = []
  for (const wine of wines) {
    if (wine.drinkBy && wine.drinkBy <= drinkLimit) {
      drinkSoon.push({ wine, date: wine.drinkBy, overdue: wine.drinkBy < today })
    }
    if (wine.tasteAgainOn && wine.tasteAgainOn <= tasteLimit) {
      tasteAgain.push({ wine, date: wine.tasteAgainOn, overdue: wine.tasteAgainOn < today })
    }
  }
  const byDate = (a: DueItem, b: DueItem) => a.date.localeCompare(b.date)
  return { drinkSoon: drinkSoon.sort(byDate), tasteAgain: tasteAgain.sort(byDate) }
}

export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
