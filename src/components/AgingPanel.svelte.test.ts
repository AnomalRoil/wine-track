import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import * as db from '../lib/db'
import { lookupAging, type AgingLookup } from '../lib/extract'
import { settings } from '../lib/settings.svelte'
import { restore, store } from '../lib/store.svelte'
import { makeWine } from '../lib/testing'
import AgingPanel from './AgingPanel.svelte'

vi.mock('../lib/db')
vi.mock('../lib/extract', async (original) => ({ ...(await original<typeof import('../lib/extract')>()), lookupAging: vi.fn() }))

/** Holds each wine write until the test releases it. */
let pending: (() => void)[] = []
let reducedMotion = false
const scrolls: ScrollIntoViewOptions[] = []

beforeEach(() => {
  vi.resetAllMocks()
  pending = []
  vi.mocked(db.putWine).mockImplementation(() => new Promise<void>((resolve) => pending.push(resolve)))
  settings.locale = 'en'
  settings.apiKey = ''
  Object.assign(store, { wines: [makeWine()], tastings: [], cellars: [], movements: [], racks: [], placements: [], restoring: false })
  reducedMotion = false
  scrolls.length = 0
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reducedMotion && query.includes('reduce') }))
  Element.prototype.scrollIntoView = function (options) {
    scrolls.push(options as ScrollIntoViewOptions)
  }
})

/** Runs a restore that reloads the same data, so editors opened before it are stale. */
async function restoreSame() {
  const wines = $state.snapshot(store.wines)
  vi.mocked(db.loadAll).mockResolvedValue({ wines, tastings: [], cellars: [{ id: 'home', name: '', position: 0, storage: {} }], movements: [], racks: [], placements: [] })
  await restore({ wines, tastings: [], cellars: [], movements: [], racks: [], placements: [] }, [])
}

function renderPanel() {
  return render(AgingPanel, { wine: store.wines[0] })
}

const decant = () => screen.getByLabelText<HTMLInputElement>(/^Decanting/)

it('keeps the draft after a restore and saves it on retry', async () => {
  renderPanel()
  await fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await fireEvent.input(decant(), { target: { value: '30' } })
  await restoreSame()

  await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Something changed in the meantime. Check and try again.')).toBeTruthy()
  expect(decant().value).toBe('30')
  expect(store.wines[0].decantMinutes).toBeNull()

  await fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await vi.waitFor(() => expect(pending).toHaveLength(1))
  pending[0]()

  await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
  expect(store.wines[0].decantMinutes).toBe(30)
})

it('closes once the save lands', async () => {
  renderPanel()
  await fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await fireEvent.input(decant(), { target: { value: '30' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true)

  await vi.waitFor(() => expect(pending).toHaveLength(1))
  pending[0]()

  await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
  expect(store.wines[0].decantMinutes).toBe(30)
})

it('keeps the open draft and the stored wine when asked to edit again', async () => {
  const { component } = renderPanel()
  await component.edit()
  await fireEvent.input(decant(), { target: { value: '45' } })

  await component.edit()

  expect(decant().value).toBe('45')
  expect(store.wines[0].decantMinutes).toBeNull()
  expect(db.putWine).not.toHaveBeenCalled()
})

it('scrolls to the editor smoothly unless motion is reduced', async () => {
  const { component } = renderPanel()
  await component.edit()
  reducedMotion = true
  await component.edit()

  expect(scrolls.map((s) => s.behavior)).toEqual(['smooth', 'auto'])
})

const year = (label: RegExp) => screen.getByLabelText<HTMLInputElement>(label)

async function saveEdits() {
  await fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await vi.waitFor(() => expect(pending).toHaveLength(1))
  pending[0]()
  await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
}

it('shows where a looked-up window comes from, and keeps the source when saved', async () => {
  settings.apiKey = 'test-key'
  const found: AgingLookup = {
    drinkFrom: 2028,
    peakFrom: null,
    peakUntil: null,
    drinkUntil: 2050,
    servingMinC: null,
    servingMaxC: null,
    decantMinutes: null,
    profile: null,
    source: 'producer',
    sourceUrl: 'https://www.domaine.example/2020',
  }
  vi.mocked(lookupAging).mockResolvedValue({ ok: true, data: found })
  const { rerender } = renderPanel()
  await fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Look up online' }))

  await vi.waitFor(() => expect(year(/^Ready from/).value).toBe('2028'))
  screen.getByText('Review before saving.')
  screen.getByText(/From the producer/)
  expect(screen.getByRole<HTMLAnchorElement>('link', { name: 'domaine.example' }).href).toBe('https://www.domaine.example/2020')

  await saveEdits()
  expect(store.wines[0].windowSource).toEqual({ kind: 'producer', url: 'https://www.domaine.example/2020' })
  await rerender({ wine: store.wines[0] })
  screen.getByText(/From the producer/)
  screen.getByRole('link', { name: 'domaine.example' })
})

it('marks a window edited by hand as set by you', async () => {
  store.wines[0] = { ...store.wines[0], drinkFrom: 2028, windowSource: { kind: 'critic', url: 'https://critic.example' } }
  const { rerender } = renderPanel()
  screen.getByText(/From a critic/)
  await fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await fireEvent.input(year(/^Drink until/), { target: { value: '2045' } })

  screen.getByText('Set by you')
  expect(screen.queryByRole('link')).toBeNull()
  await saveEdits()
  expect(store.wines[0].windowSource).toEqual({ kind: 'user', url: null })
  await rerender({ wine: store.wines[0] })
  screen.getByText('Set by you')
})

it('drops the source once every window year is cleared', async () => {
  store.wines[0] = { ...store.wines[0], drinkFrom: 2028, windowSource: { kind: 'merchant', url: null } }
  renderPanel()
  await fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await fireEvent.input(year(/^Ready from/), { target: { value: '' } })

  expect(screen.queryByText(/From a merchant|Set by you/)).toBeNull()
  await saveEdits()
  expect(store.wines[0].windowSource).toBeNull()
})

it('drops a lookup answer once a field is edited by hand', async () => {
  settings.apiKey = 'test-key'
  let answer!: () => void
  vi.mocked(lookupAging).mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = () =>
          resolve({
            ok: true,
            data: { drinkFrom: null, peakFrom: null, peakUntil: null, drinkUntil: 2050, servingMinC: null, servingMaxC: null, decantMinutes: null, profile: null, source: 'critic', sourceUrl: null },
          })
      }),
  )
  renderPanel()
  await fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Look up online' }))
  await fireEvent.input(year(/^Peak until/), { target: { value: '2040' } })
  answer()
  await new Promise((resolve) => setTimeout(resolve))

  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Look up online' }).disabled).toBe(false)
  expect([year(/^Peak until/).value, year(/^Drink until/).value]).toEqual(['2040', ''])
})

it('changes nothing when the lookup finds nothing reliable', async () => {
  settings.apiKey = 'test-key'
  vi.mocked(lookupAging).mockResolvedValue({
    ok: true,
    data: { drinkFrom: 2028, peakFrom: null, peakUntil: null, drinkUntil: null, servingMinC: null, servingMaxC: null, decantMinutes: null, profile: null, source: 'none', sourceUrl: null },
  })
  renderPanel()
  await fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Look up online' }))

  await screen.findByText('No reliable information found.')
  expect(year(/^Ready from/).value).toBe('')
})
