import { describe, expect, it } from 'vitest'
import { addDays, addYears, computeDue } from './due'
import type { Wine } from './types'

function wine(id: string, drinkBy: string | null, tasteAgainOn: string | null): Wine {
  return {
    id,
    name: id,
    producer: '',
    vintage: null,
    grapes: [],
    region: '',
    country: '',
    color: 'red',
    photoId: null,
    bottlesOwned: 0,
    drinkBy,
    tasteAgainOn,
    createdAt: 0,
  }
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

  it('a wine can appear in both sections', () => {
    const both = wine('both', '2026-09-01', '2026-09-02')
    const due = computeDue([both], today)
    expect(due.drinkSoon).toHaveLength(1)
    expect(due.tasteAgain).toHaveLength(1)
  })
})
