import { describe, expect, it } from 'vitest'

const modules = import.meta.glob<{ en: Record<string, string>; fr: Record<string, string>; de: Record<string, string> }>(
  ['./*.ts', '!./*.test.ts', '!./types.ts'],
  { eager: true },
)

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
}

describe('messages', () => {
  const seen = new Map<string, string>()
  for (const [path, m] of Object.entries(modules)) {
    for (const locale of ['fr', 'de'] as const) {
      it(`${path} ${locale} translates every key with the same placeholders`, () => {
        expect(Object.keys(m[locale]).sort()).toEqual(Object.keys(m.en).sort())
        for (const [key, value] of Object.entries(m.en)) {
          expect(m[locale][key], key).not.toBe('')
          expect(placeholders(m[locale][key]), key).toEqual(placeholders(value))
        }
      })
    }
    it(`${path} defines no key another module defines`, () => {
      for (const key of Object.keys(m.en)) {
        expect(seen.get(key), key).toBeUndefined()
        seen.set(key, path)
      }
    })
  }
})
