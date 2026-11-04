import { beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => localStorage.clear())

async function loadWith(model: unknown) {
  localStorage.setItem('wine-track:settings', JSON.stringify({ model }))
  vi.resetModules()
  return (await import('./settings.svelte')).settings.model
}

it.each([
  ['claude-opus-5', 'claude-opus-5-5'],
  ['claude-sonnet-4-6', 'claude-sonnet-5-5'],
  ['claude-haiku-4-5', 'claude-haiku-5-5'],
  ['claude-haiku-5-5', 'claude-haiku-5-5'],
  ['claude-unknown', 'claude-sonnet-5-5'],
  [42, 'claude-sonnet-5-5'],
])('a stored model %j loads as %j', async (stored, want) => {
  expect(await loadWith(stored)).toBe(want)
})
