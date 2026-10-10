import { afterEach, describe, expect, it, vi } from 'vitest'
import { staleStep } from './navigation'

describe('staleStep', () => {
  const cases = [
    { name: 'forward with an entry ahead', forward: true, ahead: true, want: 'forward' },
    { name: 'forward onto the last entry', forward: true, ahead: false, want: 'back' },
    { name: 'back', forward: false, ahead: true, want: 'back' },
    { name: 'back onto the last entry', forward: false, ahead: false, want: 'back' },
  ] as const
  for (const c of cases) {
    it(c.name, () => {
      expect(staleStep(c.forward, c.ahead)).toBe(c.want)
    })
  }
})

/** A browser history whose entries, unlike the page's module state, survive a reload. */
function fakeHistory() {
  const entries: unknown[] = [null]
  let index = 0
  const window = new EventTarget()
  const go = (n: number) => {
    index += n
    window.dispatchEvent(new Event('popstate'))
  }
  const history = {
    get state() {
      return entries[index]
    },
    replaceState: (state: unknown) => (entries[index] = structuredClone(state)),
    pushState: (state: unknown) => entries.splice(++index, entries.length, structuredClone(state)),
    back: () => go(-1),
    forward: () => go(1),
  }
  return { window, history, index: () => index }
}

describe('skipStale', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('goes on past a stale overlay entry after a reload', async () => {
    const fake = fakeHistory()
    vi.stubGlobal('window', fake.window)
    vi.stubGlobal('history', fake.history)

    let nav = await import('./navigation')
    fake.history.replaceState({ depth: 0 })
    nav.pushEntry({ depth: 1, overlay: true })
    nav.pushEntry({ depth: 2, wine: 'w1' })
    fake.history.back()
    nav.skipStale()
    expect(fake.index()).toBe(0)

    vi.resetModules()
    nav = await import('./navigation')
    fake.history.replaceState({ depth: 0 })
    fake.history.forward()
    nav.skipStale()
    expect(fake.index()).toBe(2)
  })
})
