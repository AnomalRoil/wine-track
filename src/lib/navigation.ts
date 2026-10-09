/** History entries carry their depth, so a popstate tells back from forward. */
export interface Entry {
  depth: number
}

/** Depth of the entry shown, of the deepest entry this page pushed, and whether the last move went forward. */
const position = { depth: 0, top: 0, forward: false }

// Registered before any view's listener, so views read the direction of the move that just happened.
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const depth = (history.state as Entry | null)?.depth ?? 0
    position.forward = depth > position.depth
    position.depth = depth
  })
}

/** Pushes `entry`, which drops every entry ahead of the current one. */
export function pushEntry<T extends Entry>(entry: T): void {
  history.pushState(entry, '')
  position.depth = position.top = entry.depth
}

/**
 * Which way to leave an entry whose overlay is gone: on in the direction of travel,
 * or back when travelling back or when no entry lies ahead.
 */
export function staleStep(forward: boolean, depth: number, top: number): 'forward' | 'back' {
  return forward && depth < top ? 'forward' : 'back'
}

/** Leaves the current entry, whose overlay is gone. */
export function skipStale(): void {
  if (staleStep(position.forward, position.depth, position.top) === 'forward') history.forward()
  else history.back()
}
