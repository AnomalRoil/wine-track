import type { WineDraft } from './extract'
import { cleanShares, parseGrapes, type GrapeShares } from './grapes'
import { WINE_COLORS, type WineColor } from './types'

/** Draft fields an import completion can fill, in display order. */
export const REVIEW_FIELDS = ['grapes', 'region', 'appellation', 'country', 'color', 'lwin'] as const
export type ReviewField = (typeof REVIEW_FIELDS)[number]

export type SuggestionSource = 'claude' | 'lwin'
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected'

/** A value a completion proposes for one field of an imported row; grapes may carry the shares the user typed. */
export type Suggestion = {
  [F in ReviewField]: { field: F; value: WineDraft[F]; source: SuggestionSource; status: SuggestionStatus; edited: boolean } & (F extends 'grapes'
    ? { grapeShares?: GrapeShares }
    : unknown)
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

/**
 * Adds `incoming` to `current`. A suggestion replaces only a rejected one from
 * the same source; one from another source is kept as an alternative for the field.
 */
export function merge(current: readonly Suggestion[], incoming: readonly Suggestion[]): Suggestion[] {
  const next = [...current]
  for (const s of incoming) {
    const i = next.findIndex((c) => c.field === s.field && c.source === s.source)
    if (i < 0) next.push(s)
    else if (next[i].status === 'rejected') next[i] = s
  }
  return next.sort((a, b) => REVIEW_FIELDS.indexOf(a.field) - REVIEW_FIELDS.indexOf(b.field))
}

/** The suggestion shown for each field: the first one not rejected, else the last rejected one. */
export function active(list: readonly Suggestion[]): Suggestion[] {
  return REVIEW_FIELDS.flatMap((f) => {
    const candidates = list.filter((s) => s.field === f)
    return candidates.find((s) => s.status !== 'rejected') ?? candidates.slice(-1)
  })
}

/**
 * `draft` with the accepted suggestions applied, or with every suggestion not
 * rejected when `withPending`. Returns `draft` itself when nothing applies.
 */
export function resolve(draft: WineDraft, list: readonly Suggestion[] = [], withPending = false): WineDraft {
  const applied = active(list).filter((s) => s.status === 'accepted' || (withPending && s.status === 'pending'))
  if (applied.length === 0) return draft
  const next: WineDraft = { ...draft, ...Object.fromEntries(applied.map((s) => [s.field, s.value])) }
  const grapes = applied.find((s) => s.field === 'grapes')
  if (grapes) next.grapeShares = grapes.grapeShares ?? {}
  return next
}

/** Sets the status of `target`, or of every suggestion shown when `target` is null; hidden alternatives keep theirs. */
export function setStatus(list: readonly Suggestion[], target: Suggestion | null, status: SuggestionStatus): Suggestion[] {
  const targets = target === null ? active(list) : [target]
  return list.map((s) => (targets.includes(s) ? { ...s, status } : s))
}

/** Accepts every pending suggestion shown. */
export function acceptPending(list: readonly Suggestion[]): Suggestion[] {
  const shown = active(list)
  return list.map((s) => (s.status === 'pending' && shown.includes(s) ? { ...s, status: 'accepted' } : s))
}

export function pendingCount(list: readonly Suggestion[]): number {
  return active(list).filter((s) => s.status === 'pending').length
}

/** A suggestion's value as the user edits it. */
export function formatValue(s: Suggestion): string {
  if (s.field !== 'grapes') return s.value ?? ''
  const shares = cleanShares(s.value, s.grapeShares ?? {})
  return s.value.map((g) => (Object.hasOwn(shares, g) ? `${g} ${shares[g]}%` : g)).join(', ')
}

/**
 * Replaces `target`'s value by what the user typed and accepts it. An empty
 * entry rejects the suggestion; an invalid color or code, or grapes text that
 * names no grape, returns null.
 */
export function edit(list: readonly Suggestion[], target: Suggestion, raw: string): Suggestion[] | null {
  const text = raw.trim()
  if (text === '') return setStatus(list, target, 'rejected')
  let patch: { value: WineDraft[ReviewField]; grapeShares?: GrapeShares }
  if (target.field === 'grapes') {
    const { grapes, grapeShares } = parseGrapes(text)
    if (grapes.length === 0) return null
    patch = { value: grapes, grapeShares }
  } else if (target.field === 'color') {
    if (!WINE_COLORS.includes(text as WineColor)) return null
    patch = { value: text as WineColor }
  } else if (target.field === 'lwin') {
    if (!/^\d{7}$/.test(text)) return null
    patch = { value: text }
  } else patch = { value: text }
  return list.map((s) => (s === target ? ({ ...s, ...patch, status: 'accepted', edited: true } as Suggestion) : s))
}
