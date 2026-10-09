import type { Aging, TasteProfile, WineColor } from './types'

export const PHASES = ['youth', 'maturity', 'peak', 'decline'] as const
export type Phase = (typeof PHASES)[number]

export const NO_AGING: Aging = {
  drinkFrom: null,
  peakFrom: null,
  peakUntil: null,
  drinkUntil: null,
  servingMinC: null,
  servingMaxC: null,
  decantMinutes: null,
  profile: null,
}

/** Fills aging fields missing from wines stored before they existed. */
export function withAging<T extends Partial<Aging>>(wine: T): T & Aging {
  return { ...NO_AGING, ...wine }
}

/** Calendar years the app accepts for vintages and drinking windows. */
export const MIN_YEAR = 1800
export const MAX_YEAR = 2200

/** Window years in chronological order. */
export const WINDOW_KEYS = ['drinkFrom', 'peakFrom', 'peakUntil', 'drinkUntil'] as const satisfies (keyof Aging)[]

function bounds(a: Pick<Aging, (typeof WINDOW_KEYS)[number]>): number[] {
  return WINDOW_KEYS.map((k) => a[k]).filter((y) => y !== null)
}

/** The wine's phase in `year`, or null when no drinking window is known. */
export function phaseOf(a: Aging, year: number): Phase | null {
  const { drinkFrom, peakFrom, peakUntil, drinkUntil } = a
  if (bounds(a).length === 0) return null
  if (drinkFrom !== null && year < drinkFrom) return 'youth'
  if ((peakUntil !== null && year > peakUntil) || (drinkUntil !== null && year > drinkUntil)) return 'decline'
  // A known end of peak without a start means the peak began when the wine became ready.
  if (peakFrom !== null ? year >= peakFrom : peakUntil !== null) return 'peak'
  return 'maturity'
}

/** True when the known window years never go backwards. */
export function isWindowOrdered(a: Pick<Aging, (typeof WINDOW_KEYS)[number]>): boolean {
  const years = bounds(a)
  return years.every((y, i) => i === 0 || years[i - 1] <= y)
}

const URGENCY: Record<Phase, number> = { decline: 0, peak: 1, maturity: 2, youth: 3 }

/** Sort rank: declining wines first, then at peak, maturing, young, unknown last. */
export function urgency(phase: Phase | null): number {
  return phase === null ? PHASES.length : URGENCY[phase]
}

/** The phase a wine enters in `year`, if it enters peak or decline that year. */
export function enteringPhase(a: Aging, year: number): 'peak' | 'decline' | null {
  const now = phaseOf(a, year)
  if ((now === 'peak' || now === 'decline') && phaseOf(a, year - 1) !== now) return now
  return null
}

export interface Segment {
  phase: Phase
  /** First year, inclusive. */
  from: number
  /** Last year, exclusive. */
  to: number
}

export interface Timeline {
  start: number
  end: number
  segments: Segment[]
}

/** Phases from the vintage (or first known year) to one year past the window. */
export function timeline(a: Aging, vintage: number | null, year: number): Timeline | null {
  const years = bounds(a)
  if (years.length === 0) return null
  const start = Math.min(...years, year, vintage ?? Infinity)
  const end = Math.max(...years, year) + 2
  // The phase only changes on a window year or the year after one.
  const changes = [a.drinkFrom, a.peakFrom, a.peakUntil, a.drinkUntil].flatMap((y) => (y === null ? [] : [y, y + 1]))
  const starts = [...new Set([start, ...changes.filter((y) => y > start && y < end)])].sort((x, y) => x - y)
  const segments: Segment[] = []
  for (const [i, from] of starts.entries()) {
    const phase = phaseOf(a, from)!
    const to = starts[i + 1] ?? end
    const last = segments.at(-1)
    if (last?.phase === phase) last.to = to
    else segments.push({ phase, from, to })
  }
  return { start, end, segments }
}

/** "2024–2027", "2024", or "2033+" for the open-ended last segment. */
export function segmentYears(s: Segment, last: boolean): string {
  if (last) return `${s.from}+`
  return s.to - 1 > s.from ? `${s.from}–${s.to - 1}` : `${s.from}`
}

export const TEMP_UNITS = ['C', 'F'] as const
export type TempUnit = (typeof TEMP_UNITS)[number]

/** A °C temperature in the display unit, to one decimal. */
export function toUnit(celsius: number, unit: TempUnit): number {
  return Math.round((unit === 'F' ? (celsius * 9) / 5 + 32 : celsius) * 10) / 10
}

/** A temperature typed in the display unit, in °C to one decimal. */
export function fromUnit(value: number, unit: TempUnit): number {
  return Math.round((unit === 'F' ? ((value - 32) * 5) / 9 : value) * 10) / 10
}

/** "16–18 °C", "8.5 °C", or null when no temperature is known; °F in whole degrees. */
export function formatServing(min: number | null, max: number | null, unit: TempUnit): string | null {
  const shown = (c: number) => (unit === 'F' ? Math.round(toUnit(c, unit)) : toUnit(c, unit))
  const values = [min, max].filter((c) => c !== null).map(shown)
  if (values.length === 0) return null
  const range = values.length === 2 && values[0] !== values[1] ? `${values[0]}–${values[1]}` : `${values[0]}`
  return `${range} °${unit}`
}

export const PROFILE_AXES = ['body', 'tannin', 'sweetness', 'acidity', 'fizz'] as const satisfies (keyof TasteProfile)[]

/** Axes worth showing: fizz only for sparkling wines or when already set. */
export function profileAxes(color: WineColor, profile: TasteProfile | null): (keyof TasteProfile)[] {
  return PROFILE_AXES.filter((axis) => axis !== 'fizz' || color === 'sparkling' || (profile?.fizz ?? 0) > 0)
}

export function neutralProfile(): TasteProfile {
  return { body: 5, tannin: 5, sweetness: 0, acidity: 5, fizz: 0 }
}

function year(y: number | null): number | null {
  if (y === null) return null
  const rounded = Math.round(y)
  return rounded >= MIN_YEAR && rounded <= MAX_YEAR ? rounded : null
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Cleans looked-up aging advice: whole years within MIN_YEAR–MAX_YEAR, ordered temperatures, profile axes within 0–10. */
export function cleanAging(a: Aging): Aging {
  const temps = [a.servingMinC, a.servingMaxC]
  const [servingMinC, servingMaxC] =
    temps[0] !== null && temps[1] !== null && temps[0] > temps[1] ? [temps[1], temps[0]] : temps
  const p = a.profile
  const axis = (n: number) => clamp(Math.round(n), 0, 10)
  const profile = p && {
    body: axis(p.body),
    tannin: axis(p.tannin),
    sweetness: axis(p.sweetness),
    acidity: axis(p.acidity),
    fizz: axis(p.fizz),
  }
  return {
    drinkFrom: year(a.drinkFrom),
    peakFrom: year(a.peakFrom),
    peakUntil: year(a.peakUntil),
    drinkUntil: year(a.drinkUntil),
    servingMinC,
    servingMaxC,
    decantMinutes: a.decantMinutes === null ? null : Math.max(0, Math.round(a.decantMinutes)),
    profile,
  }
}

/** Fills `current` with every value a lookup found, keeping what it did not find. */
export function mergeAging(current: Aging, found: Aging): Aging {
  const merged = { ...current }
  for (const key of Object.keys(NO_AGING) as (keyof Aging)[]) {
    if (found[key] !== null) Object.assign(merged, { [key]: found[key] })
  }
  return merged
}

/** Last year worth drinking, for ordering wines within a phase; Infinity when open-ended. */
export function lastYear(a: Aging): number {
  return a.drinkUntil ?? a.peakUntil ?? Infinity
}
