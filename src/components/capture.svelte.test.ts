import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { extractFromLabel, lookupAging, lookupGrapes, type AgingLookup, type GrapeLookup, type Result, type WineExtraction } from '../lib/extract'
import { searchLwin } from '../lib/lwinData.svelte'
import { processPhoto } from '../lib/photo'
import { settings } from '../lib/settings.svelte'
import { store } from '../lib/store.svelte'
import type { Wine } from '../lib/types'
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
  makeThumb: vi.fn(async (blob: Blob) => blob),
}))
vi.mock('../lib/extract', async (original) => ({
  ...(await original<typeof import('../lib/extract')>()),
  extractFromLabel: vi.fn(),
  lookupGrapes: vi.fn(),
  lookupAging: vi.fn(),
}))

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
async function formWithPhoto(onsaved: (wine: Wine) => void = () => {}) {
  vi.mocked(processPhoto).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  render(CaptureFlow, { onsaved, photo: new File(['jpeg'], 'label.jpg') })
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

it('Reading the label keeps a grape typed while it reads', async () => {
  const { answer } = await formWithPhoto()
  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  await fireEvent.input(document.querySelector('#grape-input')!, { target: { value: 'Syrah' } })
  answer({ ok: true, data: label })

  await waitFor(() => expect(name().value).toBe('Chablis'))
  screen.getByRole('button', { name: 'Remove Syrah' })
  expect(screen.queryByRole('button', { name: 'Remove Chardonnay' })).toBeNull()
})

it('Reading the label fills the fields a picked LWIN wine left empty', async () => {
  const { answer } = await formWithPhoto()
  const wine = { lwin: '1066553', producer: '', label: 'Chablis', country: '', region: '', subRegion: '', colour: '', subType: '', firstVintage: null, finalVintage: null }
  vi.mocked(searchLwin).mockResolvedValue([{ wine, score: 1 }])
  await fireEvent.input(name(), { target: { value: 'Chab' } })
  await fireEvent.click(await screen.findByRole('button', { name: /^Chablis/ }))
  expect(activeColor()).toBe('Red')

  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  answer({ ok: true, data: { ...label, name: 'Other' } })

  await waitFor(() => expect(activeColor()).toBe('White'))
  expect(name().value).toBe('Chablis')
  expect(document.querySelector<HTMLInputElement>('#producer')!.value).toBe('Dauvissat')
  expect(document.querySelector<HTMLInputElement>('#country')!.value).toBe('France')
})

it('A grape lookup answering after the label read changed the wine is dropped', async () => {
  const { answer } = await formWithPhoto()
  let found: (result: Result<GrapeLookup>) => void = () => {}
  vi.mocked(lookupGrapes).mockReturnValue(new Promise((resolve) => (found = resolve)))
  await fireEvent.input(document.querySelector('#producer')!, { target: { value: 'Dauvissat' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Look up grapes online' }))

  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  answer({ ok: true, data: label })
  await waitFor(() => expect(name().value).toBe('Chablis'))
  found({ ok: true, data: { grapes: ['Merlot'], confidence: 'printed-source' } })
  await new Promise((resolve) => setTimeout(resolve))

  expect((screen.getByRole('button', { name: 'Look up grapes online' }) as HTMLButtonElement).disabled).toBe(false)
  screen.getByRole('button', { name: 'Remove Chardonnay' })
  expect(screen.queryByRole('button', { name: 'Remove Merlot' })).toBeNull()
})

it('The grape lookup waits for the label read', async () => {
  await formWithPhoto()
  await fireEvent.input(name(), { target: { value: 'Les Clos' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))

  const lookup = screen.getByRole('button', { name: 'Look up grapes online' }) as HTMLButtonElement
  expect(lookup.disabled).toBe(true)
})

it('A grape lookup answering during the label read is dropped', async () => {
  const { answer } = await formWithPhoto()
  let found: (result: Result<GrapeLookup>) => void = () => {}
  vi.mocked(lookupGrapes).mockReturnValue(new Promise((resolve) => (found = resolve)))
  await fireEvent.input(document.querySelector('#producer')!, { target: { value: 'Dauvissat' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Look up grapes online' }))

  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  found({ ok: true, data: { grapes: ['Merlot'], confidence: 'printed-source' } })
  await new Promise((resolve) => setTimeout(resolve))
  expect(screen.queryByRole('button', { name: 'Remove Merlot' })).toBeNull()

  answer({ ok: true, data: label })
  await waitFor(() => expect(name().value).toBe('Chablis'))
  screen.getByRole('button', { name: 'Remove Chardonnay' })
})

it('A drinking-window lookup answering during the label read is dropped, and waits for it', async () => {
  const { answer } = await formWithPhoto()
  let found: (result: Result<AgingLookup>) => void = () => {}
  vi.mocked(lookupAging).mockReturnValue(new Promise((resolve) => (found = resolve)))
  await fireEvent.input(document.querySelector('#producer')!, { target: { value: 'Dauvissat' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Look up online' }))

  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  found({
    ok: true,
    data: { drinkFrom: 2030, peakFrom: null, peakUntil: null, drinkUntil: null, servingMinC: null, servingMaxC: null, decantMinutes: null, profile: null, confidence: 'similar' },
  })
  await new Promise((resolve) => setTimeout(resolve))
  expect(document.querySelector<HTMLInputElement>('#aging-drinkFrom')!.value).toBe('')
  expect((screen.getByRole('button', { name: 'Look up online' }) as HTMLButtonElement).disabled).toBe(true)

  answer({ ok: true, data: label })
  await waitFor(() => expect(name().value).toBe('Chablis'))
  expect((screen.getByRole('button', { name: 'Look up online' }) as HTMLButtonElement).disabled).toBe(false)
})

it('Saving waits for the label read', async () => {
  const onsaved = vi.fn()
  const { answer } = await formWithPhoto(onsaved)
  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))

  const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
  expect(save.disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(false)
  await fireEvent.submit(save.form!)
  await new Promise((resolve) => setTimeout(resolve))
  expect(onsaved).not.toHaveBeenCalled()

  answer({ ok: true, data: label })
  await waitFor(() => expect(save.disabled).toBe(false))
  await fireEvent.click(save)
  await waitFor(() => expect(onsaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Chablis' })))
})
