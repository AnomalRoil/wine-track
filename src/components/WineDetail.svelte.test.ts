import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import * as db from '../lib/db'
import { settings } from '../lib/settings.svelte'
import { restore, store } from '../lib/store.svelte'
import { makeWine } from '../lib/testing'
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
  await fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
  await fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
}

const name = () => screen.getByLabelText<HTMLInputElement>('Wine name')
const button = (label: string) => screen.getByRole<HTMLButtonElement>('button', { name: label })

it('keeps the draft and says why when a restore ran since the editor opened', async () => {
  await openEditor()
  await fireEvent.input(name(), { target: { value: 'Renamed' } })
  const wines = $state.snapshot(store.wines)
  vi.mocked(db.loadAll).mockResolvedValue({ wines, tastings: [], cellars: [home], movements: [], racks: [], placements: [] })
  await restore({ wines, tastings: [], cellars: [home], movements: [], racks: [], placements: [] }, [])

  await fireEvent.click(button('Save'))

  expect(await screen.findByText('Something changed in the meantime. Check and try again.')).toBeTruthy()
  expect(name().value).toBe('Renamed')
  expect(store.wines[0].name).toBe('Wine')
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
