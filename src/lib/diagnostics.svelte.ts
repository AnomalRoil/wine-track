/** What an AI call was for. */
export type CallTask = 'label' | 'grapes' | 'aging' | 'completion'

/** Something that happened during a call, `ms` after it started. */
export interface CallEvent {
  ms: number
  what: string
}

/** One AI call, as kept for debugging. Holds no API key and no prompt. */
export interface CallRecord {
  /** ISO time the call started. */
  at: string
  task: CallTask
  model: string
  /** Set once the call ends. */
  durationMs?: number
  /** "running", "interrupted" when the app closed mid-call, "ok", or the failure kind the user saw. */
  outcome: string
  detail?: string
  /** Why the model stopped, from the last response. */
  stopReason?: string
  /** Anthropic's request-id, which support asks for. */
  requestId?: string
  /** Responses received, more than one when a paused search was resumed. */
  turns: number
  searches: number
  inputTokens: number
  outputTokens: number
  /** Start of the answer that could not be parsed. */
  excerpt?: string
  events: CallEvent[]
}

export const MAX_CALLS = 20
export const MAX_EVENTS = 100
const STORAGE_KEY = 'wine-track:diagnostics'

function load(): CallRecord[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(stored)) return []
    return stored.slice(0, MAX_CALLS).map((c: CallRecord) => ({
      ...c,
      events: c.events ?? [],
      // A call still running when the app closed never finished.
      outcome: c.outcome === 'running' ? 'interrupted' : c.outcome,
    }))
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

/** A call in progress; every change shows in `calls` and is saved at once. */
export class CallLog {
  readonly #started = Date.now()

  constructor(readonly record: CallRecord) {}

  /** Adds an event; past MAX_EVENTS the last slot holds the latest one, so the start and the end stay visible. */
  event(what: string) {
    const entry = { ms: Date.now() - this.#started, what }
    if (this.record.events.length < MAX_EVENTS) this.record.events.push(entry)
    else this.record.events[MAX_EVENTS - 1] = entry
    save()
  }

  update(fields: Partial<CallRecord>) {
    Object.assign(this.record, fields)
    save()
  }

  finish(fields: Pick<CallRecord, 'outcome' | 'detail'>) {
    this.update({ ...fields, durationMs: Date.now() - this.#started })
  }
}

/** Records a call as running and returns its log. */
export function startCall(task: CallTask, model: string): CallLog {
  calls.unshift({ at: new Date().toISOString(), task, model, outcome: 'running', turns: 0, searches: 0, inputTokens: 0, outputTokens: 0, events: [] })
  calls.splice(MAX_CALLS)
  save()
  return new CallLog(calls[0])
}

export function clearCalls() {
  calls.length = 0
  save()
}

const FIELDS = [
  'at',
  'task',
  'model',
  'durationMs',
  'outcome',
  'detail',
  'stopReason',
  'requestId',
  'turns',
  'searches',
  'inputTokens',
  'outputTokens',
  'excerpt',
] as const satisfies readonly (keyof CallRecord)[]

/** The calls as plain text, one line per field and per event, to paste into an issue. */
export function formatCalls(records: readonly CallRecord[]): string {
  return records
    .map((c) =>
      [
        ...FIELDS.filter((key) => c[key] !== undefined).map((key) => `${key}: ${c[key]}`),
        ...c.events.map((e) => `  +${(e.ms / 1000).toFixed(1)}s ${e.what}`),
      ].join('\n'),
    )
    .join('\n\n')
}
