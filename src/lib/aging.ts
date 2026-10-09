import type { Aging, TasteProfile } from './types'

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

function bounds(a: Aging): number[] {
  return [a.drinkFrom, a.peakFrom, a.peakUntil, a.drinkUntil].filter((y) => y !== null)
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
export function isWindowOrdered(a: Aging): boolean {
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

/** Phases year by year from the vintage (or first known year) to one year past the window. */
export function timeline(a: Aging, vintage: number | null, year: number): Timeline | null {
  const years = bounds(a)
  if (years.length === 0) return null
  const start = Math.min(...years, year, vintage ?? Infinity)
  const end = Math.max(...years, year) + 2
  const segments: Segment[] = []
  for (let y = start; y < end; y++) {
    const phase = phaseOf(a, y)!
    const last = segments.at(-1)
    if (last?.phase === phase) last.to = y + 1
    else segments.push({ phase, from: y, to: y + 1 })
  }
  return { start, end, segments }
}

export const TEMP_UNITS = ['C', 'F'] as const
export type TempUnit = (typeof TEMP_UNITS)[number]

/** A °C temperature in the display unit, rounded to a whole degree. */
export function toUnit(celsius: number, unit: TempUnit): number {
  return Math.round(unit === 'F' ? (celsius * 9) / 5 + 32 : celsius)
}

/** A temperature typed in the display unit, in °C to one decimal. */
export function fromUnit(value: number, unit: TempUnit): number {
  return Math.round((unit === 'F' ? ((value - 32) * 5) / 9 : value) * 10) / 10
}

/** "16–18 °C", "16 °C", or null when no temperature is known. */
export function formatServing(min: number | null, max: number | null, unit: TempUnit): string | null {
  const values = [min, max].filter((c) => c !== null).map((c) => toUnit(c, unit))
  if (values.length === 0) return null
  const range = values.length === 2 && values[0] !== values[1] ? `${values[0]}–${values[1]}` : `${values[0]}`
  return `${range} °${unit}`
}

export const PROFILE_AXES = ['body', 'tannin', 'sweetness', 'acidity', 'fizz'] as const satisfies (keyof TasteProfile)[]

export function neutralProfile(): TasteProfile {
  return { body: 5, tannin: 5, sweetness: 0, acidity: 5, fizz: 0 }
}

function year(y: number | null): number | null {
  return y === null ? null : Math.round(y)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Cleans looked-up aging advice: whole years, ordered temperatures, profile axes within 0–10. */
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
