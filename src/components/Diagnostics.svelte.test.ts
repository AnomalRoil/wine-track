import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { calls, clearCalls, startCall, type CallRecord } from '../lib/diagnostics.svelte'
import { settings } from '../lib/settings.svelte'
import Diagnostics from './Diagnostics.svelte'

function record(fields: Partial<CallRecord>) {
  startCall('aging', 'claude-opus-5-5').update(fields)
}

const timedOut: Partial<CallRecord> = { durationMs: 120_000, outcome: 'timeout', requestId: 'req_1', turns: 1, searches: 3 }

beforeEach(() => {
  settings.locale = 'en'
  clearCalls()
})

it('lists calls with their task, outcome and duration, and copies them as text', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  record({ ...timedOut, events: [{ ms: 400, what: 'connected' }, { ms: 2100, what: 'web_search "Montrose 2016"' }] })
  render(Diagnostics)
  expect(screen.getByText(/Drinking window/).textContent).toContain('timeout · 120.0 s')
  await fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
  expect(writeText.mock.calls[0][0]).toContain('requestId: req_1\nturns: 1\nsearches: 3')
  expect(writeText.mock.calls[0][0]).toContain('  +0.4s connected\n  +2.1s web_search "Montrose 2016"')
  expect(await screen.findByText('Copied to the clipboard.')).toBeTruthy()
})

it('keeps the latest calls only and clears them', async () => {
  for (let i = 0; i < 25; i++) record({ ...timedOut, durationMs: i })
  expect(calls).toHaveLength(20)
  expect(calls[0].durationMs).toBe(24)
  render(Diagnostics)
  await fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(screen.getByText('No calls yet.')).toBeTruthy()
  expect(localStorage.getItem('wine-track:diagnostics')).toBe('[]')
})

it('shows a call as running from its start, with its elapsed time', async () => {
  vi.useFakeTimers()
  startCall('grapes', 'claude-opus-5-5')
  render(Diagnostics)
  expect(screen.getByText(/Grape lookup/).textContent).toContain('running · 0.0 s')
  await vi.advanceTimersByTimeAsync(3000)
  expect(screen.getByText(/Grape lookup/).textContent).toContain('running · 3.0 s')
  vi.useRealTimers()
})
