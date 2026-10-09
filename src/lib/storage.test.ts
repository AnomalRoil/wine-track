import { describe, expect, it } from 'vitest'
import { normalizeCellar } from './migrate'
import { agingPenalty, assessStorage, shortenedUntil, worstCellar, type StorageAssessment } from './storage'
import type { StorageAnswers } from './types'

const ideal: StorageAnswers = {
  temperature: 'cool',
  stability: 'steady',
  humidity: 'ideal',
  airflow: 'fresh',
  light: 'dark',
  position: 'lying',
  vibration: 'none',
  odors: 'none',
}

describe('assessStorage', () => {
  const cases: { name: string; answers: StorageAnswers; want: StorageAssessment }[] = [
    { name: 'nothing answered', answers: {}, want: { score: null, answered: 0, poor: [] } },
    { name: 'all good', answers: ideal, want: { score: 100, answered: 8, poor: [] } },
    {
      name: 'warm and bright',
      answers: { ...ideal, temperature: 'warm', light: 'bright' },
      want: { score: 67, answered: 8, poor: ['temperature', 'light'] },
    },
    { name: 'one fair answer', answers: { stability: 'seasonal' }, want: { score: 50, answered: 1, poor: [] } },
    {
      name: 'all poor',
      answers: {
        temperature: 'warm',
        stability: 'daily',
        humidity: 'dry',
        airflow: 'stuffy',
        light: 'bright',
        position: 'standing',
        vibration: 'constant',
        odors: 'strong',
      },
      want: {
        score: 0,
        answered: 8,
        poor: ['temperature', 'stability', 'humidity', 'airflow', 'light', 'position', 'vibration', 'odors'],
      },
    },
    { name: 'unknown option ignored', answers: { light: 'neon', odors: 'none' }, want: { score: 100, answered: 1, poor: [] } },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(assessStorage(c.answers)).toEqual(c.want)
    })
  }
})

describe('agingPenalty', () => {
  const cases: [number | null, number][] = [
    [null, 0],
    [100, 0],
    [75, 0],
    [74, 0.15],
    [50, 0.15],
    [49, 0.3],
    [0, 0.3],
  ]
  for (const [score, want] of cases) {
    it(`${score} → ${want}`, () => {
      expect(agingPenalty(score)).toBe(want)
    })
  }
})

describe('shortenedUntil', () => {
  const cases: { name: string; until: string; score: number | null; want: string | null }[] = [
    { name: 'good storage keeps the date', until: '2036-01-01', score: 90, want: null },
    { name: 'unassessed storage keeps the date', until: '2036-01-01', score: null, want: null },
    { name: 'fair storage takes 15% off the time left', until: '2026-04-11', score: 60, want: '2026-03-27' },
    { name: 'poor storage takes 30% off the time left', until: '2026-04-11', score: 10, want: '2026-03-12' },
    { name: 'past dates stay as they are', until: '2025-12-31', score: 10, want: null },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(shortenedUntil(c.until, '2026-01-01', c.score)).toBe(c.want)
    })
  }
})

describe('worstCellar', () => {
  const cellars = [
    { id: 'a', storage: ideal },
    { id: 'b', storage: { ...ideal, temperature: 'warm' } },
    { id: 'c', storage: {} },
  ]
  const cases: { name: string; holding: string[]; want: string | null }[] = [
    { name: 'lowest score wins', holding: ['a', 'b'], want: 'b' },
    { name: 'only cellars holding the wine count', holding: ['a'], want: 'a' },
    { name: 'unassessed cellars are skipped', holding: ['c'], want: null },
    { name: 'no stock', holding: [], want: null },
  ]
  for (const c of cases) {
    it(c.name, () => {
      expect(worstCellar(cellars, c.holding)?.cellar.id ?? null).toBe(c.want)
    })
  }
})

describe('normalizeCellar', () => {
  it('adds an empty checklist to cellars stored before it existed', () => {
    expect(normalizeCellar({ id: 'a', name: 'Cave', position: 1 })).toEqual({ id: 'a', name: 'Cave', position: 1, storage: {} })
  })

  it('keeps existing answers', () => {
    expect(normalizeCellar({ id: 'a', name: '', position: 0, storage: { light: 'dim' } }).storage).toEqual({ light: 'dim' })
  })
})
