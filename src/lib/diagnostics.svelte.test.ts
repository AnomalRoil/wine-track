import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calls, clearCalls, MAX_EVENTS, startCall } from './diagnostics.svelte'

beforeEach(() => clearCalls())

describe('CallLog', () => {
  it('saves a running call at once, then its events and its end', () => {
    vi.useFakeTimers()
    const log = startCall('aging', 'claude-opus-5')
    expect(JSON.parse(localStorage.getItem('wine-track:diagnostics')!)[0]).toMatchObject({ task: 'aging', outcome: 'running' })
    vi.advanceTimersByTime(1500)
    log.event('connected')
    vi.advanceTimersByTime(500)
    log.finish({ outcome: 'ok' })
    expect(calls[0]).toMatchObject({ outcome: 'ok', durationMs: 2000, events: [{ ms: 1500, what: 'connected' }] })
    expect(JSON.parse(localStorage.getItem('wine-track:diagnostics')!)[0].durationMs).toBe(2000)
    vi.useRealTimers()
  })

  it('keeps the first events and the latest one past the limit', () => {
    const log = startCall('aging', 'claude-opus-5')
    for (let i = 0; i < MAX_EVENTS + 5; i++) log.event(`e${i}`)
    expect(calls[0].events).toHaveLength(MAX_EVENTS)
    expect(calls[0].events[MAX_EVENTS - 2].what).toBe(`e${MAX_EVENTS - 2}`)
    expect(calls[0].events.at(-1)?.what).toBe(`e${MAX_EVENTS + 4}`)
  })
})

it('marks a call the app closed during as interrupted', async () => {
  startCall('aging', 'claude-opus-5')
  vi.resetModules()
  const reloaded = await import('./diagnostics.svelte')
  expect(reloaded.calls[0].outcome).toBe('interrupted')
})
