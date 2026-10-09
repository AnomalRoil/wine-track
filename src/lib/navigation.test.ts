import { describe, expect, it } from 'vitest'
import { staleStep } from './navigation'

describe('staleStep', () => {
  const cases = [
    { name: 'forward with an entry ahead', forward: true, depth: 1, top: 2, want: 'forward' },
    { name: 'forward onto the last entry', forward: true, depth: 2, top: 2, want: 'back' },
    { name: 'back', forward: false, depth: 1, top: 2, want: 'back' },
    { name: 'back onto the last entry', forward: false, depth: 2, top: 2, want: 'back' },
  ] as const
  for (const c of cases) {
    it(c.name, () => {
      expect(staleStep(c.forward, c.depth, c.top)).toBe(c.want)
    })
  }
})
