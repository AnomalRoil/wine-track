import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { extractFromLabel, lookupAging, lookupGrapes, type AgingLookup, type GrapeLookup, type Result, type WineExtraction } from '../lib/extract'
import { matchLwin, searchLwin } from '../lib/lwinData.svelte'
import * as db from '../lib/db'
import { blobToBase64, processPhoto } from '../lib/photo'
import { settings } from '../lib/settings.svelte'
import { store } from '../lib/store.svelte'
import { makeWine } from '../lib/testing'
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
  appellation: null,
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

it('Reading the label fills the appellation apart from the region', async () => {
  const { answer } = await formWithPhoto()
  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  answer({ ok: true, data: { ...label, appellation: 'Chablis Premier Cru', region: 'Burgundy' } })

  await waitFor(() => expect(name().value).toBe('Chablis'))
  expect(screen.getByLabelText<HTMLInputElement>('Appellation').value).toBe('Chablis Premier Cru')
  expect(screen.getByLabelText<HTMLInputElement>('Region').value).toBe('Burgundy')
})

it('Reading the label keeps the grape being typed', async () => {
  const { answer } = await formWithPhoto()
  await fireEvent.input(document.querySelector('#grape-input')!, { target: { value: 'Syrah' } })

  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  answer({ ok: true, data: label })

  await waitFor(() => expect(name().value).toBe('Chablis'))
  expect(document.querySelector<HTMLInputElement>('#grape-input')!.value).toBe('Syrah')
  expect(screen.queryByRole('button', { name: 'Remove Chardonnay' })).toBeNull()
  expect(activeColor()).toBe('White')
})

it('Reading the label leaves a grape being typed whole', async () => {
  const { answer } = await formWithPhoto()
  const grape = document.querySelector<HTMLInputElement>('#grape-input')!
  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  await fireEvent.input(grape, { target: { value: 'Cabernet Sau' } })
  answer({ ok: true, data: label })
  await waitFor(() => expect(name().value).toBe('Chablis'))

  await fireEvent.input(grape, { target: { value: 'Cabernet Sauvignon' } })
  await fireEvent.keyDown(grape, { key: 'Enter' })
  screen.getByRole('button', { name: 'Remove Cabernet Sauvignon' })
  expect(screen.queryByRole('button', { name: 'Remove Cabernet Sau' })).toBeNull()
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

it('Reading the label offers no match once an LWIN wine is linked', async () => {
  const { answer } = await formWithPhoto()
  const wine = { lwin: '1066553', producer: 'Dauvissat', label: 'Chablis', country: 'France', region: '', subRegion: '', colour: 'white', subType: '', firstVintage: null, finalVintage: null }
  vi.mocked(searchLwin).mockResolvedValue([{ wine, score: 1 }])
  vi.mocked(matchLwin).mockResolvedValue([[{ wine, score: 1 }]])
  await fireEvent.input(name(), { target: { value: 'Chab' } })
  await fireEvent.click(await screen.findByRole('button', { name: /^Dauvissat/ }))

  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  answer({ ok: true, data: label })
  await waitFor(() => expect(activeColor()).toBe('White'))
  await new Promise((resolve) => setTimeout(resolve))

  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
})

it('A photo that cannot be read shows an error and frees Save', async () => {
  await formWithPhoto()
  vi.mocked(blobToBase64).mockRejectedValueOnce(new Error('NotReadableError'))
  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))

  await screen.findByText('Extraction failed: NotReadableError')
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false)
})

it('A photo that cannot be read before extraction opens the form with an error', async () => {
  settings.apiKey = 'key'
  vi.mocked(processPhoto).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  vi.mocked(blobToBase64).mockRejectedValueOnce(new Error('NotReadableError'))
  render(CaptureFlow, { onsaved: () => {}, photo: new File(['jpeg'], 'label.jpg') })

  await screen.findByText('Extraction failed: NotReadableError')
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false)
})

/** Types a wine the collection has, with one bottle, and saves to get the duplicate offered. */
async function offerDuplicate() {
  store.wines = [makeWine({ name: 'Les Clos', producer: 'Dauvissat', vintage: null })]
  await fireEvent.input(name(), { target: { value: 'Les Clos' } })
  await fireEvent.input(document.querySelector('#producer')!, { target: { value: 'Dauvissat' } })
  await fireEvent.input(document.querySelector('#qty')!, { target: { value: '1' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  return screen.getByRole('button', { name: 'Add the bottles to it' }) as HTMLButtonElement
}

it('The duplicate waits for the label read, which keeps the typed wine', async () => {
  const { answer } = await formWithPhoto()
  const addTo = await offerDuplicate()
  await fireEvent.click(screen.getByRole('button', { name: 'Read the label' }))
  expect(addTo.disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Save as a new wine' }) as HTMLButtonElement).disabled).toBe(true)

  answer({ ok: true, data: { ...label, name: 'Other', producer: 'Other', vintage: null, volumeCl: null } })
  await waitFor(() => expect(addTo.disabled).toBe(false))
  expect(addTo.isConnected).toBe(true)
  expect(name().value).toBe('Les Clos')
})

it('The label read waits for adding to the duplicate', async () => {
  const onsaved = vi.fn()
  await formWithPhoto(onsaved)
  const addTo = await offerDuplicate()
  let written: () => void = () => {}
  vi.mocked(db.putWine).mockReturnValue(new Promise((resolve) => (written = resolve)))
  await fireEvent.click(addTo)

  const readLabel = screen.getByRole('button', { name: 'Read the label' }) as HTMLButtonElement
  await waitFor(() => expect(readLabel.disabled).toBe(true))
  await fireEvent.click(readLabel)
  expect(extractFromLabel).not.toHaveBeenCalled()

  written()
  await waitFor(() => expect(onsaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1', photoId: expect.any(String) })))
  expect(store.movements).toHaveLength(1)
})
