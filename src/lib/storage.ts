import type { StorageAnswers, StorageFactor } from './types'

export type StorageGrade = 'good' | 'fair' | 'poor'

export interface StorageQuestion {
  factor: StorageFactor
  /** Relative importance in the overall score. */
  weight: number
  options: readonly { id: string; grade: StorageGrade }[]
}

const good = (id: string) => ({ id, grade: 'good' as const })
const fair = (id: string) => ({ id, grade: 'fair' as const })
const poor = (id: string) => ({ id, grade: 'poor' as const })

/** The checklist, in display order. Temperature and its stability weigh most on how a wine ages. */
export const STORAGE_QUESTIONS: readonly StorageQuestion[] = [
  { factor: 'temperature', weight: 3, options: [fair('cold'), good('cool'), fair('mild'), poor('warm')] },
  { factor: 'stability', weight: 2, options: [good('steady'), fair('seasonal'), poor('daily')] },
  { factor: 'humidity', weight: 2, options: [poor('dry'), good('ideal'), fair('damp'), fair('unknown')] },
  { factor: 'airflow', weight: 1, options: [good('fresh'), fair('still'), poor('stuffy')] },
  { factor: 'light', weight: 1, options: [good('dark'), fair('dim'), poor('bright')] },
  { factor: 'position', weight: 1, options: [good('lying'), fair('mixed'), poor('standing')] },
  { factor: 'vibration', weight: 1, options: [good('none'), fair('occasional'), poor('constant')] },
  { factor: 'odors', weight: 1, options: [good('none'), fair('faint'), poor('strong')] },
]

const POINTS: Record<StorageGrade, number> = { good: 1, fair: 0.5, poor: 0 }

export function gradeOf(factor: StorageFactor, answers: StorageAnswers): StorageGrade | null {
  const question = STORAGE_QUESTIONS.find((q) => q.factor === factor)
  return question?.options.find((o) => o.id === answers[factor])?.grade ?? null
}

export interface StorageAssessment {
  /** 0–100, weighted over the answered questions; null when none is answered. */
  score: number | null
  answered: number
  /** Factors graded poor, in checklist order. */
  poor: StorageFactor[]
}

export function assessStorage(answers: StorageAnswers): StorageAssessment {
  let points = 0
  let weights = 0
  let answered = 0
  const poor: StorageFactor[] = []
  for (const q of STORAGE_QUESTIONS) {
    const grade = gradeOf(q.factor, answers)
    if (!grade) continue
    answered++
    points += q.weight * POINTS[grade]
    weights += q.weight
    if (grade === 'poor') poor.push(q.factor)
  }
  return { score: weights ? Math.round((100 * points) / weights) : null, answered, poor }
}

export function scoreGrade(score: number): StorageGrade {
  if (score >= 75) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}

/** Share of the remaining time in bottle a wine loses under conditions of this score. */
export function agingPenalty(score: number | null): number {
  if (score === null) return 0
  return { good: 0, fair: 0.15, poor: 0.3 }[scoreGrade(score)]
}

/**
 * The "YYYY-MM-DD" date to drink by once the penalty is applied to the time
 * left until `until`, or null when nothing changes. Display only: stored
 * dates stay as the user entered them.
 */
export function shortenedUntil(until: string, today: string, score: number | null): string | null {
  const penalty = agingPenalty(score)
  const start = Date.parse(`${today}T00:00:00Z`)
  const end = Date.parse(`${until}T00:00:00Z`)
  if (penalty === 0 || end <= start) return null
  const days = Math.floor(((end - start) / 86_400_000) * (1 - penalty))
  return new Date(start + days * 86_400_000).toISOString().slice(0, 10)
}

/** Of the cellars holding a wine, the one with the lowest storage score; null when none is assessed. */
export function worstCellar<C extends { id: string; storage: StorageAnswers }>(
  cellars: C[],
  holding: Iterable<string>,
): { cellar: C; score: number } | null {
  const ids = new Set(holding)
  let worst: { cellar: C; score: number } | null = null
  for (const cellar of cellars) {
    if (!ids.has(cellar.id)) continue
    const { score } = assessStorage(cellar.storage)
    if (score !== null && (!worst || score < worst.score)) worst = { cellar, score }
  }
  return worst
}
