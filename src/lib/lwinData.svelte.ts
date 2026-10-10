import { deleteLwin, getLwin, putLwin, type LwinCache } from './db'
import type { WineDraft } from './extract'
import { LWIN_FORMAT, type LwinMeta, type Scored } from './lwin'
import type { LwinRequest, LwinResult } from './lwin.worker'

const BASE = `${import.meta.env.BASE_URL}lwin/`

export const lwin = $state({
  /** The downloaded copy; null when none. */
  installed: null as LwinMeta | null,
  /** The published copy: null when the site has none, undefined until known or when offline. */
  remote: undefined as LwinMeta | null | undefined,
  busy: false,
  failed: false,
})

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, { resolve: (v: never) => void; reject: (e: Error) => void }>()

/** Fails every pending request and drops the worker, so the next request starts a new one. */
function stop(error: Error) {
  for (const p of pending.values()) p.reject(error)
  pending.clear()
  worker?.terminate()
  worker = null
}

function ask<K extends LwinRequest['kind']>(request: Extract<LwinRequest, { kind: K }>): Promise<LwinResult[K]> {
  if (!worker) {
    worker = new Worker(new URL('./lwin.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, ok, result, error } = e.data
      const p = pending.get(id)
      pending.delete(id)
      if (ok) p?.resolve(result as never)
      else p?.reject(new Error(error))
    }
    // A worker script that cannot load (offline, or replaced by a deploy) would leave requests waiting.
    worker.onerror = (e) => stop(new Error(e.message || 'LWIN worker failed'))
    worker.onmessageerror = () => stop(new Error('unreadable LWIN worker message'))
  }
  const id = nextId++
  worker.postMessage({ id, request })
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

let started: Promise<void> | null = null

/** Reads which copy is installed, once it succeeds; the worker parses it in the background. */
export function initLwin(): Promise<void> {
  started ??= getLwin().then(
    (cache) => {
      lwin.installed = cache?.meta ?? null
      if (cache) ask({ kind: 'load' }).catch(() => {})
    },
    (error) => {
      started = null
      throw error
    },
  )
  return started
}

/** Whether a copy is installed; false when that cannot be read, which only means no suggestion. */
async function installed(): Promise<boolean> {
  await initLwin().catch(() => {})
  return lwin.installed !== null
}

/** Fetches the description of the published copy. */
export async function checkRemote(): Promise<void> {
  try {
    const response = await fetch(`${BASE}meta.json`, { cache: 'no-cache' })
    if (!response.ok) {
      lwin.remote = response.status === 404 ? null : undefined
      return
    }
    const meta = (await response.json()) as LwinMeta
    lwin.remote = meta.format === LWIN_FORMAT ? meta : null
  } catch {
    lwin.remote = undefined
  }
}

export function updateAvailable(): boolean {
  return Boolean(lwin.installed && lwin.remote && lwin.remote.date > lwin.installed.date)
}

/** Downloads the published copy, stores it and loads it into the worker. */
export async function downloadLwin(): Promise<void> {
  const meta = $state.snapshot(lwin.remote)
  if (!meta || lwin.busy) return
  lwin.busy = true
  lwin.failed = false
  let previous: LwinCache | undefined
  let replaced = false
  try {
    previous = await getLwin()
    const response = await fetch(`${BASE}lwin-wines.tsv.gz`, { cache: 'no-cache' })
    if (!response.ok) throw new Error(`${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    // A server may already have decoded it (Content-Encoding: gzip).
    const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b
    const data = gzipped
      ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).blob()
      : new Blob([bytes])
    await putLwin({ meta, data: new Blob([data], { type: 'text/tab-separated-values' }) })
    replaced = true
    if ((await ask({ kind: 'load' })) !== meta.rows) throw new Error('incomplete data')
    lwin.installed = meta
  } catch {
    lwin.failed = true
    if (replaced) {
      if (previous) await putLwin(previous)
      else await deleteLwin()
      await ask({ kind: 'load' }).catch(() => {})
    }
  } finally {
    lwin.busy = false
  }
}

export async function removeLwin(): Promise<void> {
  await deleteLwin()
  lwin.installed = null
  await ask({ kind: 'load' })
}

/** Wines named like `query`, best first; none when the database is not installed. */
export async function searchLwin(query: string, limit: number): Promise<Scored[]> {
  if (!(await installed())) return []
  // A lookup that fails only means no suggestion.
  return ask({ kind: 'search', query, limit }).catch(() => [])
}

/** The best matches of each draft; empty lists when the database is not installed. */
export async function matchLwin(drafts: WineDraft[], limit: number): Promise<Scored[][]> {
  const none = drafts.map(() => [])
  if (!(await installed())) return none
  return ask({ kind: 'match', drafts: drafts.map((d) => $state.snapshot(d)), limit }).catch(() => none)
}
