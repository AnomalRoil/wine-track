/** What an AI call was for. */
export type CallTask = 'label' | 'grapes' | 'aging' | 'completion'

/** One AI call, as kept for debugging. Holds no API key and no prompt. */
export interface CallRecord {
  /** ISO time the call started. */
  at: string
  task: CallTask
  model: string
  durationMs: number
  /** "ok", or the failure kind the user saw. */
  outcome: string
  detail?: string
  /** Why the model stopped, from the last response. */
  stopReason?: string
  /** Anthropic's request-id, which support asks for. */
  requestId?: string
  /** Requests sent, more than one when a paused search was resumed. */
  turns: number
  searches: number
  inputTokens: number
  outputTokens: number
  /** Start of the answer that could not be parsed. */
  excerpt?: string
}

export const MAX_CALLS = 20
const STORAGE_KEY = 'wine-track:diagnostics'

function load(): CallRecord[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(stored) ? stored.slice(0, MAX_CALLS) : []
  } catch {
    return []
  }
}

/** The latest AI calls, newest first, kept on this device only. */
export const calls: CallRecord[] = $state(load())

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calls))
  } catch {
    // A full storage must not break the call being recorded; the list stays in memory.
  }
}

export function recordCall(call: CallRecord) {
  calls.unshift(call)
  calls.splice(MAX_CALLS)
  save()
}

export function clearCalls() {
  calls.length = 0
  save()
}

/** The calls as plain text, one line per field, to paste into an issue. */
export function formatCalls(records: readonly CallRecord[]): string {
  return records
    .map((c) =>
      Object.entries(c)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n'),
    )
    .join('\n\n')
}
