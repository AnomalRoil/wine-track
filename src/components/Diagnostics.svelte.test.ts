import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { calls, clearCalls, recordCall, type CallRecord } from '../lib/diagnostics.svelte'
import { settings } from '../lib/settings.svelte'
import Diagnostics from './Diagnostics.svelte'

const call: CallRecord = {
  at: '2026-11-03T10:00:00.000Z',
  task: 'aging',
  model: 'claude-opus-5',
  durationMs: 120_000,
  outcome: 'timeout',
  requestId: 'req_1',
  turns: 1,
  searches: 3,
  inputTokens: 900,
  outputTokens: 80,
}

beforeEach(() => {
  settings.locale = 'en'
  clearCalls()
})

it('lists calls with their task, outcome and duration, and copies them as text', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  recordCall(call)
  render(Diagnostics)
  expect(screen.getByText(/Drinking window/).textContent).toContain('timeout · 120.0 s')
  await fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
  expect(writeText.mock.calls[0][0]).toContain('requestId: req_1\nturns: 1\nsearches: 3')
  expect(await screen.findByText('Copied to the clipboard.')).toBeTruthy()
})

it('keeps the latest calls only and clears them', async () => {
  for (let i = 0; i < 25; i++) recordCall({ ...call, durationMs: i })
  expect(calls).toHaveLength(20)
  expect(calls[0].durationMs).toBe(24)
  render(Diagnostics)
  await fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(screen.getByText('No calls yet.')).toBeTruthy()
  expect(localStorage.getItem('wine-track:diagnostics')).toBe('[]')
})
