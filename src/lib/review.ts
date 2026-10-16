import type { WineDraft } from './extract'
import { WINE_COLORS, type WineColor } from './types'

/** Draft fields an import completion can fill, in display order. */
export const REVIEW_FIELDS = ['grapes', 'region', 'country', 'color', 'lwin'] as const
export type ReviewField = (typeof REVIEW_FIELDS)[number]

export type SuggestionSource = 'claude' | 'lwin'
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected'

/** A value a completion proposes for one field of an imported row. */
export type Suggestion = {
  [F in ReviewField]: { field: F; value: WineDraft[F]; source: SuggestionSource; status: SuggestionStatus; edited: boolean }
}[ReviewField]

function same(a: WineDraft[ReviewField], b: WineDraft[ReviewField]): boolean {
  return Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => v === b[i]) : a === b
}

/** Pending suggestions for each field `completed` changes from `draft`. */
export function suggestions(draft: WineDraft, completed: WineDraft, source: SuggestionSource): Suggestion[] {
  return REVIEW_FIELDS.filter((f) => !same(draft[f], completed[f])).map(
    (field) => ({ field, value: completed[field], source, status: 'pending', edited: false }) as Suggestion,
  )
}

/** Adds `incoming` to `current`; a new suggestion replaces only a rejected one for the same field. */
export function merge(current: readonly Suggestion[], incoming: readonly Suggestion[]): Suggestion[] {
  const next = [...current]
  for (const s of incoming) {
    const i = next.findIndex((c) => c.field === s.field)
    if (i < 0) next.push(s)
    else if (next[i].status === 'rejected') next[i] = s
  }
  return next.sort((a, b) => REVIEW_FIELDS.indexOf(a.field) - REVIEW_FIELDS.indexOf(b.field))
}

/**
 * `draft` with the accepted suggestions applied, or with every suggestion not
 * rejected when `withPending`. Returns `draft` itself when nothing applies.
 */
export function resolve(draft: WineDraft, list: readonly Suggestion[] = [], withPending = false): WineDraft {
  const applied = list.filter((s) => s.status === 'accepted' || (withPending && s.status === 'pending'))
  if (applied.length === 0) return draft
  return { ...draft, ...Object.fromEntries(applied.map((s) => [s.field, s.value])) }
}

/** Sets the status of `field`'s suggestion, or of every suggestion when `field` is null. */
export function setStatus(list: readonly Suggestion[], field: ReviewField | null, status: SuggestionStatus): Suggestion[] {
  return list.map((s) => (field === null || s.field === field ? { ...s, status } : s))
}

/** Accepts every pending suggestion. */
export function acceptPending(list: readonly Suggestion[]): Suggestion[] {
  return list.map((s) => (s.status === 'pending' ? { ...s, status: 'accepted' } : s))
}

export function pendingCount(list: readonly Suggestion[]): number {
  return list.filter((s) => s.status === 'pending').length
}

/** A suggestion's value as the user edits it. */
export function formatValue(s: Suggestion): string {
  return s.field === 'grapes' ? s.value.join(', ') : (s.value ?? '')
}

/**
 * Replaces `field`'s value by what the user typed and accepts it. An empty
 * entry rejects the suggestion; an invalid color or code leaves the list unchanged.
 */
export function edit(list: readonly Suggestion[], field: ReviewField, raw: string): Suggestion[] {
  const text = raw.trim()
  if (text === '') return setStatus(list, field, 'rejected')
  let value: WineDraft[ReviewField]
  if (field === 'grapes') value = [...new Set(text.split(/[,;|]/).map((g) => g.trim()).filter(Boolean))]
  else if (field === 'color') {
    if (!WINE_COLORS.includes(text as WineColor)) return [...list]
    value = text as WineColor
  } else if (field === 'lwin') {
    if (!/^\d{7}$/.test(text)) return [...list]
    value = text
  } else value = text
  return list.map((s) => (s.field === field ? ({ ...s, value, status: 'accepted', edited: true } as Suggestion) : s))
}
