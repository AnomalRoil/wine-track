import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { NO_AGING } from '../lib/aging'
import { emptyDraft, extractFromLabel, lookupAging, lookupGrapes } from '../lib/extract'
import { onScreenRequest } from '../lib/navigation'
import { processPhoto } from '../lib/photo'
import { settings } from '../lib/settings.svelte'
import { store } from '../lib/store.svelte'
import AgingFields from './AgingFields.svelte'
import CaptureFlow from './CaptureFlow.svelte'
import NeedsKey from './NeedsKey.svelte'
import CaptureInLayer from '../test/CaptureInLayer.svelte'
import WineForm from './WineForm.svelte'

vi.mock('../lib/db')
vi.mock('../lib/lwinData.svelte', async (original) => ({
  ...(await original<typeof import('../lib/lwinData.svelte')>()),
  initLwin: vi.fn(async () => {}),
  checkRemote: vi.fn(async () => {}),
  searchLwin: vi.fn(async () => []),
  matchLwin: vi.fn(async () => [[]]),
}))
vi.mock('../lib/photo', async (original) => ({ ...(await original<typeof import('../lib/photo')>()), processPhoto: vi.fn() }))
vi.mock('../lib/extract', async (original) => ({
  ...(await original<typeof import('../lib/extract')>()),
  extractFromLabel: vi.fn(),
  lookupGrapes: vi.fn(),
  lookupAging: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  settings.locale = 'en'
  settings.apiKey = ''
  Object.assign(store, { wines: [], tastings: [], cellars: [{ id: 'home', name: '', position: 0, storage: {} }], movements: [], racks: [], placements: [] })
  URL.createObjectURL = () => 'blob:photo'
  URL.revokeObjectURL = () => {}
})

const draft = () => ({ ...emptyDraft(), name: 'Les Clos', producer: 'Dauvissat' })

it('NeedsKey shows the action unavailable and requests the Settings screen', async () => {
  const requested: string[] = []
  const stop = onScreenRequest((id) => requested.push(id))
  render(NeedsKey, { label: 'Look up grapes online' })

  const action = screen.getByRole('button', { name: 'Look up grapes online' })
  expect(action.getAttribute('aria-disabled')).toBe('true')
  expect(action.getAttribute('aria-describedby')).toBe(screen.getByText(/Needs an Anthropic API key/).id)
  await fireEvent.click(screen.getAllByRole('button', { name: 'Add it in Settings' })[0])
  stop()

  expect(requested).toEqual(['settings'])
})

it('WineForm offers the grape lookup only with a key', async () => {
  render(WineForm, { draft: draft(), title: 'New wine', onsave: () => {}, oncancel: () => {} })

  const lookup = screen.getByRole('button', { name: 'Look up grapes online' })
  expect(lookup.getAttribute('aria-disabled')).toBe('true')
  await fireEvent.click(lookup)
  expect(lookupGrapes).not.toHaveBeenCalled()

  settings.apiKey = 'key'
  await waitFor(() => expect(screen.getByRole('button', { name: 'Look up grapes online' }).getAttribute('aria-disabled')).toBeNull())
  expect(screen.queryByText(/Needs an Anthropic API key/)).toBeNull()
})

it('AgingFields offers the drinking-window lookup only with a key', async () => {
  render(AgingFields, { aging: { ...NO_AGING }, wine: draft() })

  const lookup = screen.getByRole('button', { name: 'Look up online' })
  expect(lookup.getAttribute('aria-disabled')).toBe('true')
  await fireEvent.click(lookup)
  expect(lookupAging).not.toHaveBeenCalled()
  screen.getByText(/Needs an Anthropic API key/)
})

it('CaptureFlow goes from a photo straight to the form without a key', async () => {
  vi.mocked(processPhoto).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  render(CaptureFlow, { onsaved: () => {}, photo: new File(['jpeg'], 'label.jpg') })

  const readLabel = await screen.findByRole('button', { name: 'Read the label' })
  expect(readLabel.getAttribute('aria-disabled')).toBe('true')
  screen.getByRole('heading', { name: 'New wine' })
  expect(screen.queryByText('Reading the label…')).toBeNull()
  expect(document.querySelector('.error')).toBeNull()
  expect(extractFromLabel).not.toHaveBeenCalled()
})

it('Settings opened from the capture form returns to the same form', async () => {
  vi.mocked(processPhoto).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  render(CaptureInLayer, { photo: new File(['jpeg'], 'label.jpg') })
  await screen.findByRole('button', { name: 'Read the label' })
  await fireEvent.input(document.querySelector('#name')!, { target: { value: 'Les Clos' } })

  await fireEvent.click(screen.getAllByRole('button', { name: 'Add it in Settings' })[0])
  const layer = await screen.findByRole('dialog', { name: 'Settings' })
  await fireEvent.input(layer.querySelector('#apikey')!, { target: { value: 'key' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Back' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(document.querySelector<HTMLImageElement>('img.preview')?.src).toBe('blob:photo')
  expect(document.querySelector<HTMLInputElement>('#name')!.value).toBe('Les Clos')
  expect(screen.getByRole('button', { name: 'Read the label' }).getAttribute('aria-disabled')).toBeNull()
})
