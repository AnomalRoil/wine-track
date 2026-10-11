import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { completeWines, type Result } from '../lib/extract'
import type { Completion } from '../lib/csvImport'
import type { LwinWine } from '../lib/lwin'
import { findLwin, matchLwin } from '../lib/lwinData.svelte'
import { settings } from '../lib/settings.svelte'
import { applyImport, store } from '../lib/store.svelte'
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
  vi.mocked(applyImport).mockResolvedValue({ matches: [], wines: [], cellars: [], movements: [] })
  render(ImportPanel)

  await load('name,producer,vintage,lwin\nLes Clos,Dauvissat,2019,1066553\nChablis,Dauvissat,2019,')
  await fireEvent.click(await screen.findByLabelText('Fill in from LWIN: Vincent Dauvissat, Chablis Grand Cru, Les Clos'))
  await fireEvent.click(screen.getByRole('button', { name: /^Import/ }))

  expect(findLwin).toHaveBeenCalledWith(['1066553'])
  expect(vi.mocked(matchLwin).mock.calls.map(([drafts]) => drafts.map((d) => d.name))).toEqual([['Chablis']])
  const [rows] = vi.mocked(applyImport).mock.calls[0]
  expect(rows[0].draft).toMatchObject({ lwin: '1066553', region: 'Chablis', country: 'France' })
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
  await vi.waitFor(() => expect(matchLwin).toHaveBeenCalledTimes(1))

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
