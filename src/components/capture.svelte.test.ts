import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { extractFromLabel, type Result, type WineExtraction } from '../lib/extract'
import { processPhoto } from '../lib/photo'
import { settings } from '../lib/settings.svelte'
import { store } from '../lib/store.svelte'
import CaptureFlow from './CaptureFlow.svelte'

vi.mock('../lib/db')
vi.mock('../lib/lwinData.svelte', async (original) => ({
  ...(await original<typeof import('../lib/lwinData.svelte')>()),
  initLwin: vi.fn(async () => {}),
  checkRemote: vi.fn(async () => {}),
  searchLwin: vi.fn(async () => []),
  matchLwin: vi.fn(async () => [[]]),
}))
vi.mock('../lib/photo', async (original) => ({
  ...(await original<typeof import('../lib/photo')>()),
  processPhoto: vi.fn(),
  blobToBase64: vi.fn(async () => 'jpeg'),
}))
vi.mock('../lib/extract', async (original) => ({ ...(await original<typeof import('../lib/extract')>()), extractFromLabel: vi.fn() }))

const label: WineExtraction = {
  name: 'Chablis',
  producer: 'Dauvissat',
  vintage: 2020,
  grapes: ['Chardonnay'],
  region: 'Chablis',
  country: 'France',
  color: 'white',
  volumeCl: 150,
}

beforeEach(() => {
  vi.clearAllMocks()
  settings.locale = 'en'
  settings.apiKey = ''
  Object.assign(store, { wines: [], tastings: [], cellars: [{ id: 'home', name: '', position: 0, storage: {} }], movements: [], racks: [], placements: [] })
  URL.createObjectURL = () => 'blob:photo'
  URL.revokeObjectURL = () => {}
})

/** Opens the capture form on a photo, then adds a key so the label can be read from the form. */
async function formWithPhoto() {
  vi.mocked(processPhoto).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  render(CaptureFlow, { onsaved: () => {}, photo: new File(['jpeg'], 'label.jpg') })
  await screen.findByRole('button', { name: 'Read the label' })
  settings.apiKey = 'key'
  let answer: (result: Result<WineExtraction>) => void = () => {}
  vi.mocked(extractFromLabel).mockReturnValue(new Promise((resolve) => (answer = resolve)))
  return { answer: (result: Result<WineExtraction>) => answer(result) }
}

const name = () => document.querySelector<HTMLInputElement>('#name')!
const activeColor = () => document.querySelector('#color-chips .active')?.textContent?.trim()

it('Reading the label keeps the form and its chosen color', async () => {
  const { answer } = await formWithPhoto()
  await fireEvent.click(screen.getByRole('button', { name: 'Red' }))
  const details = document.querySelector('details.aging') as HTMLDetailsElement
  details.open = true
  const input = name()

  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  const reading = screen.getByRole('button', { name: 'Reading the label…' }) as HTMLButtonElement
  expect(reading.disabled).toBe(true)
  expect(name()).toBe(input)

  answer({ ok: true, data: label })
  await waitFor(() => expect(name().value).toBe('Chablis'))
  expect(name()).toBe(input)
  expect(activeColor()).toBe('Red')
  expect((document.querySelector('#size') as HTMLSelectElement).value).toBe('150')
  expect(details.open).toBe(true)
})

it('Reading the label keeps the grape being typed', async () => {
  const { answer } = await formWithPhoto()
  await fireEvent.input(document.querySelector('#grape-input')!, { target: { value: 'Syrah' } })

  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  answer({ ok: true, data: label })

  await waitFor(() => expect(name().value).toBe('Chablis'))
  screen.getByRole('button', { name: 'Remove Syrah' })
  expect(screen.queryByRole('button', { name: 'Remove Chardonnay' })).toBeNull()
  expect(activeColor()).toBe('White')
})
