// Holds the parsed wine names database off the main thread and answers lookups.
import { readLwin } from './db'
import type { WineDraft } from './extract'
import { match, parseLwin, search, type LwinIndex, type Scored } from './lwin'

export type LwinRequest =
  | { kind: 'load' }
  | { kind: 'search'; query: string; limit: number }
  | { kind: 'match'; drafts: WineDraft[]; limit: number }

/** Answer to a request, by kind: wines loaded (0 when none), search results, results per draft. */
export type LwinResult = { load: number; search: Scored[]; match: Scored[][] }

let index: Promise<LwinIndex | null> | null = null

async function load(): Promise<LwinIndex | null> {
  const cache = await readLwin()
  return cache ? parseLwin(await cache.data.text()) : null
}

async function answer(request: LwinRequest): Promise<LwinResult[LwinRequest['kind']]> {
  if (request.kind === 'load' || !index) index = load()
  // A failed load is retried on the next request.
  const current = await index.catch((err) => {
    index = null
    throw err
  })
  switch (request.kind) {
    case 'load':
      return current?.wines.length ?? 0
    case 'search':
      return current ? search(current, request.query, request.limit) : []
    case 'match':
      return request.drafts.map((d) => (current ? match(current, d, request.limit) : []))
  }
}

self.onmessage = async (e: MessageEvent<{ id: number; request: LwinRequest }>) => {
  const { id, request } = e.data
  try {
    self.postMessage({ id, ok: true, result: await answer(request) })
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
