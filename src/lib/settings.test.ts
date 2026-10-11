import { afterEach, expect, it } from 'vitest'
import { hasApiKey, settings } from './settings.svelte'

afterEach(() => {
  settings.apiKey = ''
})

it('hasApiKey', () => {
  const cases = [
    { apiKey: '', want: false },
    { apiKey: '   ', want: false },
    { apiKey: 'sk-ant-test', want: true },
  ]
  for (const { apiKey, want } of cases) {
    settings.apiKey = apiKey
    expect(hasApiKey(), JSON.stringify(apiKey)).toBe(want)
  }
})
