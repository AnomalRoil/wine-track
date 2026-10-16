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
  expect(rows[0].draft).toMatchObject({ lwin: '1066553', region: 'Burgundy', appellation: 'Chablis', country: 'France' })
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
  const batch = Array.from({ length: 8 }, () => ({ grapes: ['Merlot'], region: 'Bordeaux', appellation: null, country: 'France' }))
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

it('imports rows with values it does not understand, listing what it emptied', async () => {
  vi.mocked(applyImport).mockResolvedValue({ matches: [], wines: [], codes: new Map(), cellars: [], movements: [] })
  render(ImportPanel)

  await load('name,vintage,quantity,purchase price\nClos,20x9,six,cheap\nPlain,2019,1,10\n,2019,1,')

  expect(await screen.findByText('1 line is imported with 3 emptied fields.')).toBeTruthy()
  const list = document.querySelector('details.emptied-list')!
  expect([...list.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
    'Line 2: “20x9” left empty, so this line makes a new wine without a vintage. The vintage must be a year, or empty or NV for a non-vintage wine.',
    'Line 2: “six” left empty, so no bottles are added. The quantity must be a whole number.',
    'Line 2: “cheap” left empty. The purchase price must be a number.',
  ])
  expect(document.querySelectorAll('.card.line ul.emptied li')).toHaveLength(3)
  await fireEvent.click(screen.getByRole('button', { name: 'Import 2 lines' }))

  const [rows] = vi.mocked(applyImport).mock.calls[0]
  expect(rows.map((r) => [r.draft.name, r.draft.vintage, r.quantity, r.price])).toEqual([
    ['Clos', null, 0, null],
    ['Plain', 2019, 1, 10],
    ['', 2019, 1, null],
  ])
})

it('shows no emptied summary when every value is understood', async () => {
  render(ImportPanel)
  await load('name,vintage\nClos,2019')
  await screen.findByText('Line 2')
  expect(document.querySelector('details.emptied-list')).toBeNull()
})

it('says when a line without bottles drops its price', async () => {
  render(ImportPanel)
  await load('name,quantity,purchase price\nClos,six,45\nPlain,1,10')
  expect(await screen.findAllByText('Prices are kept with added bottles only; this line adds none, so its price is not imported.')).toHaveLength(1)
})

/** Loads two wines and completes both: Merlot, Bordeaux, France. */
async function loadCompleted() {
  vi.mocked(completeWines).mockImplementation(async (_auth, _model, drafts) => ({
    ok: true,
    data: drafts.map(() => ({ grapes: ['Merlot'], region: 'Bordeaux', appellation: null, country: 'France' })),
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

  await fireEvent.click(line(2).getByRole('button', { name: 'Accept Region' }))
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

it('keeps the region Claude found behind a pending LWIN one and sends Claude no pending value', async () => {
  const rioja = { ...lesClos, subRegion: '', region: 'Rioja' }
  vi.mocked(findLwin).mockImplementation(async (codes) => codes.map(() => rioja))
  vi.mocked(completeWines).mockImplementation(async (_auth, _model, drafts) => ({
    ok: true,
    data: drafts.map(() => ({ grapes: ['Chardonnay'], region: 'Chablis', appellation: null, country: 'France' })),
  }))
  vi.mocked(applyImport).mockResolvedValue({ matches: [], wines: [], codes: new Map(), cellars: [], movements: [] })
  render(ImportPanel)
  await load('name,producer,vintage,lwin\nLes Clos,Dauvissat,2019,1066553')
  await fireEvent.click(await screen.findByRole('button', { name: 'Complete with Claude (1)' }))
  await screen.findByText('Chardonnay')

  const [sent] = vi.mocked(completeWines).mock.calls[0][2]
  expect([sent.region, sent.country]).toEqual(['', ''])
  expect(line(2).getByText('Rioja')).toBeTruthy()
  await fireEvent.click(line(2).getByRole('button', { name: 'Reject Region' }))
  expect(line(2).getByText('Chablis')).toBeTruthy()
  await fireEvent.click(line(2).getByRole('button', { name: 'Accept Region' }))
  expect((await imported())[0].region).toBe('Chablis')
})

it('keeps the editor open on an invalid code', async () => {
  vi.mocked(matchLwin).mockImplementation(async (drafts) => drafts.map(() => [{ wine: lesClos, score: 1 }]))
  render(ImportPanel)
  await load('name,producer,vintage\nLes Clos,Dauvissat,2019')
  await fireEvent.click(await screen.findByRole('button', { name: 'Edit LWIN code' }))
  const input = screen.getByRole('textbox', { name: 'LWIN code' })
  await fireEvent.input(input, { target: { value: '106655' } })
  await fireEvent.keyDown(input, { key: 'Enter' })

  expect(screen.getByText('An LWIN code has 7 digits.')).toBeTruthy()
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'LWIN code' }).value).toBe('106655')
  await fireEvent.keyDown(input, { key: 'Escape' })
  expect(screen.getByText('1066553')).toBeTruthy()
})

it('sends no line twice after an empty answer', async () => {
  vi.mocked(completeWines).mockImplementation(async (_auth, _model, drafts) => ({
    ok: true,
    data: drafts.map(() => ({ grapes: [], region: null, appellation: null, country: null })),
  }))
  render(ImportPanel)
  await load('name\nPetrus')
  await fireEvent.click(await screen.findByRole('button', { name: 'Complete with Claude (1)' }))

  await vi.waitFor(() => expect(screen.queryByRole('button', { name: /^Complete with Claude/ })).toBeNull())
  expect(completeWines).toHaveBeenCalledTimes(1)
})
