import { describe, expect, it } from 'vitest'
import { addDays, addYears, computeDue } from './due'
import { makeWine } from './testing'
import type { Wine } from './types'

function wine(id: string, drinkBy: string | null, tasteAgainOn: string | null): Wine {
  return makeWine({ id, name: id, drinkBy, tasteAgainOn })
}

describe('addDays / addYears', () => {
  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('addYears keeps the day', () => {
    expect(addYears('2026-08-28', 5)).toBe('2031-08-28')
  })
  it('addYears clamps Feb 29', () => {
    expect(addYears('2024-02-29', 1)).toBe('2025-03-01')
  })
})

describe('computeDue', () => {
  const today = '2026-08-28'

  it('splits drink-by and taste-again, sorted by date, overdue flagged', () => {
    const wines = [
      wine('past', '2026-01-01', null),
      wine('soon', '2026-10-01', null),
      wine('far', '2030-01-01', null),
      wine('taste-now', null, '2026-09-01'),
      wine('taste-later', null, '2027-01-01'),
    ]
    const due = computeDue(wines, today)
    expect(due.drinkSoon.map((d) => d.wine.id)).toEqual(['past', 'soon'])
    expect(due.drinkSoon[0].overdue).toBe(true)
    expect(due.drinkSoon[1].overdue).toBe(false)
    expect(due.tasteAgain.map((d) => d.wine.id)).toEqual(['taste-now'])
  })

  it('adds wines entering peak or decline this year', () => {
    const wines = [
      makeWine({ id: 'peak', peakFrom: 2026, peakUntil: 2030 }),
      makeWine({ id: 'decline', drinkUntil: 2025 }),
      makeWine({ id: 'old-decline', drinkUntil: 2020 }),
      makeWine({ id: 'young', drinkFrom: 2030 }),
      wine('overdue', '2026-08-01', null),
      wine('upcoming', '2026-09-01', null),
    ]
    expect(computeDue(wines, today).drinkSoon).toEqual([
      { wine: wines[4], date: '2026-08-01', overdue: true },
      { wine: wines[0], date: today, overdue: false, entering: 'peak' },
      { wine: wines[1], date: today, overdue: false, entering: 'decline' },
      { wine: wines[5], date: '2026-09-01', overdue: false },
    ])
  })

  it('a wine can appear in both sections', () => {
    const both = wine('both', '2026-09-01', '2026-09-02')
    const due = computeDue([both], today)
    expect(due.drinkSoon).toHaveLength(1)
    expect(due.tasteAgain).toHaveLength(1)
  })
})
