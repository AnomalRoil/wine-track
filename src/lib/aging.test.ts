import { describe, expect, it } from 'vitest'
import {
  cleanAging,
  enteringPhase,
  formatServing,
  fromUnit,
  isWindowOrdered,
  lastYear,
  mergeAging,
  NO_AGING,
  phaseOf,
  profileAxes,
  segmentYears,
  timeline,
  toUnit,
  urgency,
  withAging,
  type Phase,
} from './aging'
import type { Aging } from './types'

function win(drinkFrom: number | null, peakFrom: number | null, peakUntil: number | null, drinkUntil: number | null): Aging {
  return { ...NO_AGING, drinkFrom, peakFrom, peakUntil, drinkUntil }
}

const full = win(2024, 2028, 2032, 2036)

describe('phaseOf', () => {
  const cases: { name: string; a: Aging; year: number; want: Phase | null }[] = [
    { name: 'no window', a: NO_AGING, year: 2026, want: null },
    { name: 'before drinkFrom', a: full, year: 2023, want: 'youth' },
    { name: 'on drinkFrom', a: full, year: 2024, want: 'maturity' },
    { name: 'on peakFrom', a: full, year: 2028, want: 'peak' },
    { name: 'on peakUntil', a: full, year: 2032, want: 'peak' },
    { name: 'after peakUntil', a: full, year: 2033, want: 'decline' },
    { name: 'after drinkUntil', a: full, year: 2037, want: 'decline' },
    { name: 'only drinkUntil, before it', a: win(null, null, null, 2030), year: 2026, want: 'maturity' },
    { name: 'only drinkUntil, after it', a: win(null, null, null, 2030), year: 2031, want: 'decline' },
    { name: 'only drinkFrom', a: win(2020, null, null, null), year: 2040, want: 'maturity' },
    { name: 'peakUntil without peakFrom', a: win(2020, null, 2030, null), year: 2022, want: 'peak' },
    { name: 'peakFrom without peakUntil', a: win(null, 2025, null, 2030), year: 2029, want: 'peak' },
    { name: 'drinkUntil before peakUntil', a: win(2020, 2022, 2035, 2030), year: 2031, want: 'decline' },
  ]
  for (const c of cases) {
    it(c.name, () => expect(phaseOf(c.a, c.year)).toBe(c.want))
  }
})

describe('enteringPhase', () => {
  const cases: { year: number; want: 'peak' | 'decline' | null }[] = [
    { year: 2027, want: null },
    { year: 2028, want: 'peak' },
    { year: 2029, want: null },
    { year: 2033, want: 'decline' },
    { year: 2034, want: null },
  ]
  for (const c of cases) {
    it(`${c.year}`, () => expect(enteringPhase(full, c.year)).toBe(c.want))
  }
})

describe('urgency', () => {
  it('ranks decline, peak, maturity, youth, unknown', () => {
    const order = (['youth', null, 'peak', 'maturity', 'decline'] as (Phase | null)[]).sort((a, b) => urgency(a) - urgency(b))
    expect(order).toEqual(['decline', 'peak', 'maturity', 'youth', null])
  })
})

describe('isWindowOrdered', () => {
  const cases: { name: string; a: Aging; want: boolean }[] = [
    { name: 'empty', a: NO_AGING, want: true },
    { name: 'full', a: full, want: true },
    { name: 'gaps', a: win(2020, null, null, 2030), want: true },
    { name: 'equal years', a: win(2020, 2020, 2020, 2020), want: true },
    { name: 'backwards', a: win(2030, null, null, 2020), want: false },
  ]
  for (const c of cases) {
    it(c.name, () => expect(isWindowOrdered(c.a)).toBe(c.want))
  }
})

describe('timeline', () => {
  it('is null without a window', () => {
    expect(timeline(NO_AGING, 2020, 2026)).toBeNull()
  })

  it('spans vintage to one year past the window, grouped by phase', () => {
    expect(timeline(full, 2020, 2026)).toEqual({
      start: 2020,
      end: 2038,
      segments: [
        { phase: 'youth', from: 2020, to: 2024 },
        { phase: 'maturity', from: 2024, to: 2028 },
        { phase: 'peak', from: 2028, to: 2033 },
        { phase: 'decline', from: 2033, to: 2038 },
      ],
    })
  })

  it('extends to the current year', () => {
    expect(timeline(win(null, null, null, 2020), null, 2026)).toEqual({
      start: 2020,
      end: 2028,
      segments: [
        { phase: 'maturity', from: 2020, to: 2021 },
        { phase: 'decline', from: 2021, to: 2028 },
      ],
    })
  })
})

describe('temperatures', () => {
  it('converts both ways', () => {
    expect(toUnit(18, 'F')).toBe(64.4)
    expect(toUnit(18, 'C')).toBe(18)
    expect(toUnit(8.5, 'C')).toBe(8.5)
    expect(fromUnit(64, 'F')).toBe(17.8)
    expect(fromUnit(17, 'C')).toBe(17)
  })

  const cases: { min: number | null; max: number | null; unit: 'C' | 'F'; want: string | null }[] = [
    { min: null, max: null, unit: 'C', want: null },
    { min: 16, max: 18, unit: 'C', want: '16–18 °C' },
    { min: 8, max: 8, unit: 'C', want: '8 °C' },
    { min: 8.5, max: 17.5, unit: 'C', want: '8.5–17.5 °C' },
    { min: null, max: 10, unit: 'F', want: '50 °F' },
    { min: 16, max: 18, unit: 'F', want: '61–64 °F' },
  ]
  for (const c of cases) {
    it(`formats ${c.min}–${c.max} ${c.unit}`, () => expect(formatServing(c.min, c.max, c.unit)).toBe(c.want))
  }
})

describe('withAging', () => {
  it('fills missing fields and keeps present ones', () => {
    expect(withAging({ id: 'w1', drinkFrom: 2020 })).toEqual({ ...NO_AGING, id: 'w1', drinkFrom: 2020 })
  })
})

describe('cleanAging', () => {
  it('rounds years, orders temperatures, clamps profile and decanting', () => {
    const raw: Aging = {
      drinkFrom: 2024.4,
      peakFrom: null,
      peakUntil: 2030,
      drinkUntil: 2035,
      servingMinC: 18,
      servingMaxC: 16,
      decantMinutes: -5,
      profile: { body: 12, tannin: 7.6, sweetness: -1, acidity: 5, fizz: 0 },
    }
    expect(cleanAging(raw)).toEqual({
      drinkFrom: 2024,
      peakFrom: null,
      peakUntil: 2030,
      drinkUntil: 2035,
      servingMinC: 16,
      servingMaxC: 18,
      decantMinutes: 0,
      profile: { body: 10, tannin: 8, sweetness: 0, acidity: 5, fizz: 0 },
    })
  })
})

describe('mergeAging', () => {
  it('takes found values and keeps current ones the lookup lacks', () => {
    const current: Aging = { ...full, servingMinC: 14, decantMinutes: 30 }
    const found: Aging = { ...NO_AGING, drinkFrom: 2025, decantMinutes: 0, profile: { body: 7, tannin: 6, sweetness: 0, acidity: 5, fizz: 0 } }
    expect(mergeAging(current, found)).toEqual({ ...current, drinkFrom: 2025, decantMinutes: 0, profile: found.profile })
  })
})

describe('lastYear', () => {
  const cases: { name: string; a: Aging; want: number }[] = [
    { name: 'drinkUntil', a: full, want: 2036 },
    { name: 'peakUntil fallback', a: win(2020, null, 2030, null), want: 2030 },
    { name: 'open-ended', a: win(2020, null, null, null), want: Infinity },
  ]
  for (const c of cases) {
    it(c.name, () => expect(lastYear(c.a)).toBe(c.want))
  }
})

describe('segmentYears', () => {
  const cases: { name: string; from: number; to: number; last: boolean; want: string }[] = [
    { name: 'range', from: 2024, to: 2028, last: false, want: '2024–2027' },
    { name: 'single year', from: 2024, to: 2025, last: false, want: '2024' },
    { name: 'open-ended', from: 2033, to: 2038, last: true, want: '2033+' },
  ]
  for (const c of cases) {
    it(c.name, () => expect(segmentYears({ phase: 'peak', from: c.from, to: c.to }, c.last)).toBe(c.want))
  }
})

describe('profileAxes', () => {
  const profile = { body: 5, tannin: 5, sweetness: 0, acidity: 5, fizz: 0 }
  it('hides fizz for still wines', () => {
    expect(profileAxes('red', profile)).toEqual(['body', 'tannin', 'sweetness', 'acidity'])
  })
  it('shows fizz for sparkling wines', () => {
    expect(profileAxes('sparkling', null)).toContain('fizz')
  })
  it('shows fizz when set on another color', () => {
    expect(profileAxes('white', { ...profile, fizz: 3 })).toContain('fizz')
  })
})
