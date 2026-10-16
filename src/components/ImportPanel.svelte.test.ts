import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { tick } from 'svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { completeWines, type Result } from '../lib/extract'
import type { Completion } from '../lib/csvImport'
import type { LwinWine } from '../lib/lwin'
import { findLwin, matchLwin } from '../lib/lwinData.svelte'
import { settings } from '../lib/settings.svelte'
import { applyImport, store } from '../lib/store.svelte'
import { makeWine } from '../lib/testing'
import ImportPanel from './ImportPanel.svelte'

vi.mock('../lib/db')
vi.mock('../lib/lwinData.svelte', () => ({ findLwin: vi.fn(), matchLwin: vi.fn() }))
vi.mock('../lib/extract', async (original) => ({ ...(await original<typeof import('../lib/extract')>()), completeWines: vi.fn() }))
vi.mock('../lib/store.svelte', async (original) => ({ ...(await original<typeof import('../lib/store.svelte')>()), applyImport: vi.fn() }))

const lesClos: LwinWine = {
  lwin: '1066553',
  producer: 'Vincent Dauvissat',
  label: 'Chablis Grand Cru, Les Clos',
  country: 'France',
  region: 'Burgundy',
  subRegion: 'Chablis',
  colour: 'White',
  subType: 'Still',
  firstVintage: null,
  finalVintage: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  settings.locale = 'en'
  settings.apiKey = 'key'
  vi.mocked(findLwin).mockImplementation(async (codes) => codes.map(() => null))
  vi.mocked(matchLwin).mockImplementation(async (drafts) => drafts.map(() => []))
  vi.stubGlobal('confirm', () => true)
  Object.assign(store, { wines: [], tastings: [], cellars: [{ id: 'home', name: '', position: 0, storage: {} }], movements: [], racks: [], placements: [] })
})

/** A file whose content arrives when the test resolves it. */
function deferredFile(): { file: File; arrive: (csv: string) => void } {
  let arrive!: (csv: string) => void
  const content = new Promise<ArrayBuffer>((resolve) => (arrive = (csv) => resolve(new TextEncoder().encode(csv).buffer as ArrayBuffer)))
  return { file: { size: 10, arrayBuffer: () => content } as unknown as File, arrive }
}

async function choose(file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await fireEvent.change(input)
}

async function load(csv: string) {
  const { file, arrive } = deferredFile()
  await choose(file)
  arrive(csv)
}

it('completes a coded row from its own code and keeps that code', async () => {
  vi.mocked(findLwin).mockImplementation(async (codes) => codes.map((c) => (c === '1066553' ? lesClos : null)))
  vi.mocked(applyImport).mockResolvedValue({ matches: [], wines: [], codes: new Map(), cellars: [], movements: [] })
  render(ImportPanel)

  await load('name,producer,vintage,lwin\nLes Clos,Dauvissat,2019,1066553\nChablis,Dauvissat,2019,')
  await screen.findByText('Found in LWIN: Vincent Dauvissat, Chablis Grand Cru, Les Clos')
  await fireEvent.click(screen.getByRole('button', { name: 'Accept line' }))
  await fireEvent.click(screen.getByRole('button', { name: /^Import/ }))

  expect(findLwin).toHaveBeenCalledWith(['1066553'])
  expect(vi.mocked(matchLwin).mock.calls.map(([drafts]) => drafts.map((d) => d.name))).toEqual([['Chablis']])
  const [rows] = vi.mocked(applyImport).mock.calls[0]
  expect(rows[0].draft).toMatchObject({ lwin: '1066553', region: 'Chablis', country: 'France' })
})

it('matches by name a coded row whose code is unknown', async () => {
  vi.mocked(matchLwin).mockImplementation(async (drafts) => drafts.map(() => [{ wine: lesClos, score: 1 }]))
  render(ImportPanel)

  await load('name,producer,vintage,lwin\nLes Clos,Dauvissat,2019,1066540')

  expect(await screen.findByText('Found in LWIN: Vincent Dauvissat, Chablis Grand Cru, Les Clos')).toBeTruthy()
  expect(findLwin).toHaveBeenCalledWith(['1066540'])
  expect(vi.mocked(matchLwin).mock.calls.map(([drafts]) => drafts.map((d) => d.lwin))).toEqual([['1066540']])
})

it('keeps the undo of a code that matched the row to a stored wine', async () => {
  store.wines = [makeWine({ name: 'Chablis Grand Cru, Les Clos', producer: 'Vincent Dauvissat', vintage: 2019, lwin: '1066553' })]
  vi.mocked(matchLwin).mockImplementation(async (drafts) => drafts.map(() => [{ wine: lesClos, score: 1 }]))
  render(ImportPanel)

  await load('name,producer,vintage\nLes Clos,Dauvissat,2019')
  const status = () => document.querySelector('.line .status')?.textContent?.trim()
  await fireEvent.click(await screen.findByRole('button', { name: 'Accept line' }))
  expect(status()).toBe('Adds bottles to a wine you have')

  await fireEvent.click(screen.getByRole('button', { name: 'Reject line' }))
  expect(status()).toBe('New wine')
})

it('shows only the newer file when two reads finish in reverse order', async () => {
  render(ImportPanel)
  const first = deferredFile()
  const second = deferredFile()
  await choose(first.file)
  await choose(second.file)

  second.arrive('name\nNewer')
  await screen.findByText('Newer')
  first.arrive('name\nOlder')
  // A macrotask runs the older read's continuation, then tick() flushes what it would render.
  await new Promise((resolve) => setTimeout(resolve))
  await tick()

  expect(matchLwin).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Older')).toBeNull()
  expect(screen.getByText('Newer')).toBeTruthy()
})

/** Starts a completion of nine wines and holds its first batch of eight until the test resolves it. */
async function startCompletion() {
  let finish!: (r: Result<Completion[]>) => void
  vi.mocked(completeWines).mockImplementation(() => new Promise((resolve) => (finish = resolve)))
  await load(`name\n${Array.from({ length: 9 }, (_, i) => `Wine ${i}`).join('\n')}`)
  await fireEvent.click(await screen.findByRole('button', { name: 'Complete with Claude (9)' }))
  await vi.waitFor(() => expect(completeWines).toHaveBeenCalledTimes(1))
  const batch = Array.from({ length: 8 }, () => ({ grapes: ['Merlot'], region: 'Bordeaux', country: 'France' }))
  return () => finish({ ok: true, data: batch })
}

it('starts no further batch after the import is cancelled', async () => {
  render(ImportPanel)
  const finish = await startCompletion()

  await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  finish()
  await new Promise((resolve) => setTimeout(resolve))

  expect(completeWines).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Wine 0')).toBeNull()
})

it('starts no further batch after leaving the screen', async () => {
  const { unmount } = render(ImportPanel)
  const finish = await startCompletion()

  unmount()
  finish()
  await new Promise((resolve) => setTimeout(resolve))

  expect(completeWines).toHaveBeenCalledTimes(1)
})

/** Loads two wines and completes both: Merlot, Bordeaux, France. */
async function loadCompleted() {
  vi.mocked(completeWines).mockImplementation(async (_auth, _model, drafts) => ({
    ok: true,
    data: drafts.map(() => ({ grapes: ['Merlot'], region: 'Bordeaux', country: 'France' })),
  }))
  vi.mocked(applyImport).mockResolvedValue({ matches: [], wines: [], codes: new Map(), cellars: [], movements: [] })
  await load('name,country\nPetrus,\nLe Pin,Frankreich')
  await fireEvent.click(await screen.findByRole('button', { name: 'Complete with Claude (2)' }))
  await screen.findByText('5 completed fields await review. Only accepted fields are imported.')
}

/** The preview card of the given file line. */
function line(n: number) {
  return within(screen.getByText(`Line ${n}`).closest<HTMLElement>('.line')!)
}

async function imported() {
  await fireEvent.click(screen.getByRole('button', { name: /^Import/ }))
  const [rows] = vi.mocked(applyImport).mock.calls[0]
  return rows.map((r) => ({ grapes: r.draft.grapes, region: r.draft.region, country: r.draft.country }))
}

it('imports no completed field until it is accepted', async () => {
  render(ImportPanel)
  await loadCompleted()

  expect(line(2).getAllByText(/^Claude · to review$/)).toHaveLength(3)
  expect(line(3).getAllByText(/^Claude · to review$/)).toHaveLength(2)
  expect(await imported()).toEqual([
    { grapes: [], region: '', country: '' },
    { grapes: [], region: '', country: 'Frankreich' },
  ])
})

it('imports an accepted field and restores a rejected one', async () => {
  render(ImportPanel)
  await loadCompleted()

  await fireEvent.click(line(2).getByRole('button', { name: 'Accept Region / appellation' }))
  await fireEvent.click(line(2).getByRole('button', { name: 'Accept Grapes' }))
  await fireEvent.click(line(2).getByRole('button', { name: 'Reject Grapes' }))

  expect(screen.getByText('3 completed fields await review. Only accepted fields are imported.')).toBeTruthy()
  await fireEvent.click(line(3).getByRole('button', { name: 'Reject line' }))
  expect(screen.queryByRole('button', { name: /^Complete with Claude/ })).toBeNull()
  expect(line(2).getByText('Claude · rejected')).toBeTruthy()
  expect((await imported())[0]).toEqual({ grapes: [], region: 'Bordeaux', country: '' })
})

it('imports a field edited by hand', async () => {
  render(ImportPanel)
  await loadCompleted()

  await fireEvent.click(line(3).getByRole('button', { name: 'Edit Grapes' }))
  const input = line(3).getByRole('textbox', { name: 'Grapes' })
  await fireEvent.input(input, { target: { value: 'Merlot, Cabernet Franc' } })
  await fireEvent.keyDown(input, { key: 'Enter' })

  expect(line(3).getByText('Claude · edited · accepted')).toBeTruthy()
  expect((await imported())[1]).toEqual({ grapes: ['Merlot', 'Cabernet Franc'], region: '', country: 'Frankreich' })
})

it('accepts every pending field at once', async () => {
  render(ImportPanel)
  await loadCompleted()

  await fireEvent.click(line(2).getByRole('button', { name: 'Reject Country' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Accept all' }))

  expect(screen.queryByRole('button', { name: 'Accept all' })).toBeNull()
  expect(await imported()).toEqual([
    { grapes: ['Merlot'], region: 'Bordeaux', country: '' },
    { grapes: ['Merlot'], region: 'Bordeaux', country: 'Frankreich' },
  ])
})
