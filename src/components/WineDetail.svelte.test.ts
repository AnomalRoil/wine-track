import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { parseImport } from '../lib/csvImport'
import * as db from '../lib/db'
import { settings } from '../lib/settings.svelte'
import { applyImport, restore, store } from '../lib/store.svelte'
import { makeTasting, makeWine } from '../lib/testing'
import WineDetail from './WineDetail.svelte'

vi.mock('../lib/db')

/** Holds each wine write until the test releases it. */
let pending: (() => void)[] = []
const home = { id: 'home', name: '', position: 0, storage: {} }

beforeEach(() => {
  vi.resetAllMocks()
  pending = []
  vi.mocked(db.putWine).mockImplementation(() => new Promise<void>((resolve) => pending.push(resolve)))
  vi.mocked(db.getLwin).mockResolvedValue(undefined)
  settings.locale = 'en'
  Object.assign(store, { wines: [makeWine()], tastings: [], cellars: [home], movements: [], racks: [], placements: [], restoring: false })
})

async function openEditor() {
  render(WineDetail, { wineId: 'w1', onclose: () => {} })
  await fireEvent.click(screen.getByRole('button', { name: 'Edit wine' }))
}

const name = () => screen.getByLabelText<HTMLInputElement>('Wine name')
const button = (label: string) => screen.getByRole<HTMLButtonElement>('button', { name: label })

it('keeps the draft after a restore and saves it on retry', async () => {
  await openEditor()
  await fireEvent.input(name(), { target: { value: 'Renamed' } })
  const wines = $state.snapshot(store.wines)
  vi.mocked(db.loadAll).mockResolvedValue({ wines, tastings: [], cellars: [home], movements: [], racks: [], placements: [] })
  await restore({ wines, tastings: [], cellars: [home], movements: [], racks: [], placements: [] }, [])

  await fireEvent.click(button('Save'))

  expect(await screen.findByText('Something changed in the meantime. Check and try again.')).toBeTruthy()
  expect(name().value).toBe('Renamed')
  expect(store.wines[0].name).toBe('Wine')

  await fireEvent.click(button('Save'))
  await vi.waitFor(() => expect(pending).toHaveLength(1))
  pending[0]()

  await vi.waitFor(() => expect(screen.queryByLabelText('Wine name')).toBeNull())
  expect(store.wines[0].name).toBe('Renamed')
})

it('shows the restored values after a stale save and keeps them on retry', async () => {
  await openEditor()
  await fireEvent.input(name(), { target: { value: 'Renamed' } })
  const wines = [makeWine({ vintage: 2019 })]
  vi.mocked(db.loadAll).mockResolvedValue({ wines, tastings: [], cellars: [home], movements: [], racks: [], placements: [] })
  await restore({ wines, tastings: [], cellars: [home], movements: [], racks: [], placements: [] }, [])

  await fireEvent.click(button('Save'))
  expect(await screen.findByText('Something changed in the meantime. Check and try again.')).toBeTruthy()
  expect(name().value).toBe('Renamed')
  expect(screen.getByLabelText<HTMLInputElement>('Vintage').value).toBe('2019')

  await fireEvent.click(button('Save'))
  await vi.waitFor(() => expect(pending).toHaveLength(1))
  pending[0]()

  await vi.waitFor(() => expect(screen.queryByLabelText('Wine name')).toBeNull())
  expect(store.wines[0]).toMatchObject({ name: 'Renamed', vintage: 2019 })
})

it('closes the tasting editor when a restore removes the tasting', async () => {
  store.tastings = [makeTasting()]
  render(WineDetail, { wineId: 'w1', onclose: () => {} })
  await fireEvent.click(button('Edit tasting'))
  expect(screen.getByLabelText('Notes')).toBeTruthy()

  const wines = $state.snapshot(store.wines)
  vi.mocked(db.loadAll).mockResolvedValue({ wines, tastings: [], cellars: [home], movements: [], racks: [], placements: [] })
  await restore({ wines, tastings: [], cellars: [home], movements: [], racks: [], placements: [] }, [])

  await vi.waitFor(() => expect(screen.queryByLabelText('Notes')).toBeNull())
})

it('keeps the editor and its actions locked until the save lands', async () => {
  await openEditor()
  await fireEvent.input(name(), { target: { value: 'Renamed' } })
  await fireEvent.click(button('Save'))

  await vi.waitFor(() => expect(pending).toHaveLength(1))
  expect(button('Cancel').disabled).toBe(true)
  expect(button('Save').disabled).toBe(true)

  pending[0]()
  await vi.waitFor(() => expect(screen.queryByLabelText('Wine name')).toBeNull())
  expect(store.wines[0].name).toBe('Renamed')
})

it('keeps the code an import gave the wine while its editor was open', async () => {
  let imported!: () => void
  vi.mocked(db.putImport).mockImplementation(() => new Promise<void>((resolve) => (imported = resolve)))
  const parsed = parseImport('name,producer,vintage,lwin,quantity\nWine,Producer,2020,1066553,1', 2026)
  if (!parsed.ok) throw new Error(parsed.error)
  const done = applyImport(parsed.rows, { defaultCellarName: 'Home', date: '2026-01-01', now: 0, newId: () => crypto.randomUUID() })
  await vi.waitFor(() => expect(db.putImport).toHaveBeenCalled())

  await openEditor()
  imported()
  await done
  await fireEvent.input(name(), { target: { value: 'Renamed' } })
  await fireEvent.click(button('Save'))
  await vi.waitFor(() => expect(pending).toHaveLength(1))
  pending[0]()

  await vi.waitFor(() => expect(screen.queryByLabelText('Wine name')).toBeNull())
  expect(store.wines[0]).toMatchObject({ name: 'Renamed', lwin: '1066553' })
})

it('shows Edit and Delete without a menu, and asks before deleting', async () => {
  vi.mocked(db.deleteWine).mockResolvedValue()
  const onclose = vi.fn()
  render(WineDetail, { wineId: 'w1', onclose })
  expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)

  await fireEvent.click(button('Delete wine'))
  expect(store.wines).toHaveLength(1)

  await fireEvent.click(button('Delete wine'))
  await vi.waitFor(() => expect(onclose).toHaveBeenCalled())
  expect(confirm).toHaveBeenCalledTimes(2)
  expect(store.wines).toHaveLength(0)
})

it('keeps the menu for the calendar export only', async () => {
  store.wines = [makeWine({ drinkBy: '2030-01-01' })]
  render(WineDetail, { wineId: 'w1', onclose: () => {} })
  await fireEvent.click(button('More actions'))
  expect(screen.getAllByRole('menuitem').map((m) => m.textContent?.trim())).toEqual(['Add to calendar (.ics)'])
})

it('shows the appellation before the region and saves an edited one', async () => {
  store.wines = [makeWine({ vintage: 2016, appellation: 'Pauillac', region: 'Bordeaux', country: 'France' })]
  render(WineDetail, { wineId: 'w1', onclose: () => {} })
  expect(document.querySelector('.where')?.textContent).toBe('2016 · Pauillac · Bordeaux, France')
  await openEditor()
  const appellation = screen.getByLabelText<HTMLInputElement>('Appellation')
  expect(appellation.value).toBe('Pauillac')
  await fireEvent.input(appellation, { target: { value: 'Saint-Julien' } })

  await fireEvent.click(button('Save'))
  await vi.waitFor(() => expect(pending).toHaveLength(1))
  pending[0]()

  await vi.waitFor(() => expect(store.wines[0].appellation).toBe('Saint-Julien'))
  expect(store.wines[0].region).toBe('Bordeaux')
})
