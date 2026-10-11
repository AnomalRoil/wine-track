import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import * as db from '../lib/db'
import { settings } from '../lib/settings.svelte'
import { restore, store } from '../lib/store.svelte'
import { makeWine } from '../lib/testing'
import AgingPanel from './AgingPanel.svelte'

vi.mock('../lib/db')

/** Holds each wine write until the test releases it. */
let pending: (() => void)[] = []
let reducedMotion = false
const scrolls: ScrollIntoViewOptions[] = []

beforeEach(() => {
  vi.resetAllMocks()
  pending = []
  vi.mocked(db.putWine).mockImplementation(() => new Promise<void>((resolve) => pending.push(resolve)))
  settings.locale = 'en'
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
