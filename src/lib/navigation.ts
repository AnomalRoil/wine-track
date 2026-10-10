/** History entries carry their depth, so a popstate tells back from forward. */
export interface Entry {
  depth: number
  /** Set once an entry was pushed over this one, so an entry lies ahead even after a reload. */
  next?: boolean
}

/** Depth of the entry shown, and whether the last move went forward. */
const position = { depth: 0, forward: false }

// A reload keeps the entry, so the page starts at its depth.
if (typeof history !== 'undefined') position.depth = (history.state as Entry | null)?.depth ?? 0

// Registered before any view's listener, so views read the direction of the move that just happened.
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const depth = (history.state as Entry | null)?.depth ?? 0
    position.forward = depth > position.depth
    position.depth = depth
  })
}

/** The entry a page load starts on: the entry's depth and mark, without the views it pointed at. */
export function startEntry(state: unknown): Entry {
  const entry = state as Entry | null
  return { depth: entry?.depth ?? 0, next: entry?.next }
}

/** Pushes `entry`, which drops every entry ahead of the current one. */
export function pushEntry<T extends Entry>(entry: T): void {
  history.replaceState({ ...history.state, next: true }, '')
  history.pushState({ ...entry, next: false }, '')
  position.depth = entry.depth
}

/**
 * Which way to leave an entry whose overlay is gone: on in the direction of travel,
 * or back when travelling back or when no entry lies ahead.
 */
export function staleStep(forward: boolean, ahead: boolean): 'forward' | 'back' {
  return forward && ahead ? 'forward' : 'back'
}

/** Leaves the current entry, whose overlay is gone. */
export function skipStale(): void {
  const ahead = (history.state as Entry | null)?.next === true
  if (staleStep(position.forward, ahead) === 'forward') history.forward()
  else history.back()
}
