import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import * as db from '../lib/db'
import { settings } from '../lib/settings.svelte'
import { restore, store } from '../lib/store.svelte'
import { emptySheet } from '../lib/tasting'
import { makeTasting, makeWine } from '../lib/testing'
import type { Photo, Tasting } from '../lib/types'
import TastingForm from './TastingForm.svelte'

vi.mock('../lib/db')

beforeEach(() => {
  vi.resetAllMocks()
  settings.locale = 'en'
  Object.assign(store, { wines: [makeWine()], tastings: [makeTasting()], cellars: [], movements: [], racks: [], placements: [], restoring: false })
})

/** Restores `tastings` and `photos` as the database would store and reload them. */
function restoreWith(tastings: Tasting[], photos: Photo[] = []): Promise<void> {
  vi.mocked(db.replaceAll).mockImplementation(async (data) => void vi.mocked(db.loadAll).mockResolvedValue(data))
  return restore({ wines: $state.snapshot(store.wines), tastings, cellars: [], movements: [], racks: [], placements: [] }, photos)
}

const photo = (id: string): Photo => ({ id, blob: new Blob() })

it('keeps the draft after a restore and saves it on retry', async () => {
  const ondone = vi.fn()
  render(TastingForm, { wineId: 'w1', color: 'red', tasting: store.tastings[0], ondone })
  const notes = screen.getByLabelText<HTMLTextAreaElement>('Notes')
  await fireEvent.input(notes, { target: { value: 'Flint' } })
  await restoreWith($state.snapshot(store.tastings))

  await fireEvent.click(screen.getByRole('button', { name: 'Save tasting' }))

  expect(await screen.findByText('Something changed in the meantime. Check and try again.')).toBeTruthy()
  expect(notes.value).toBe('Flint')
  expect(store.tastings[0].notes).toBe('')

  await fireEvent.click(screen.getByRole('button', { name: 'Save tasting' }))

  await vi.waitFor(() => expect(ondone).toHaveBeenCalledOnce())
  expect(store.tastings[0].notes).toBe('Flint')
})

it('drops photos a restore removed before saving the kept draft', async () => {
  const sheet = { ...emptySheet(), photoIds: ['p1', 'p2'] }
  store.tastings = [makeTasting({ sheet })]
  const ondone = vi.fn()
  render(TastingForm, { wineId: 'w1', color: 'red', tasting: store.tastings[0], ondone })
  await restoreWith([makeTasting({ sheet: { ...sheet, photoIds: ['p1'] } })], [photo('p1')])

  await fireEvent.click(screen.getByRole('button', { name: 'Save tasting' }))
  await screen.findByText('Something changed in the meantime. Check and try again.')
  await fireEvent.click(screen.getByRole('button', { name: 'Save tasting' }))

  await vi.waitFor(() => expect(ondone).toHaveBeenCalledOnce())
  expect(store.tastings[0].sheet?.photoIds).toEqual(['p1'])
})

it('keeps photos a restore brought when saving the kept draft', async () => {
  const sheet = { ...emptySheet(), photoIds: ['p1', 'p2'] }
  store.tastings = [makeTasting({ sheet })]
  const ondone = vi.fn()
  render(TastingForm, { wineId: 'w1', color: 'red', tasting: store.tastings[0], ondone })
  await restoreWith([makeTasting({ sheet: { ...sheet, photoIds: ['p1', 'p3'] } })], [photo('p1'), photo('p3')])

  await fireEvent.click(screen.getByRole('button', { name: 'Save tasting' }))
  await screen.findByText('Something changed in the meantime. Check and try again.')
  await fireEvent.click(screen.getByRole('button', { name: 'Save tasting' }))

  await vi.waitFor(() => expect(ondone).toHaveBeenCalledOnce())
  expect(store.tastings[0].sheet?.photoIds).toEqual(['p1', 'p3'])
  expect(vi.mocked(db.putTasting).mock.lastCall?.[2]).toEqual([])
})

it('drops photos a restore references without an image when saving the kept draft', async () => {
  const sheet = { ...emptySheet(), photoIds: ['p1', 'p2'] }
  store.tastings = [makeTasting({ sheet })]
  const ondone = vi.fn()
  render(TastingForm, { wineId: 'w1', color: 'red', tasting: store.tastings[0], ondone })
  await restoreWith([makeTasting({ sheet: { ...sheet, photoIds: ['p1', 'p2', 'p3'] } })], [photo('p1')])

  await fireEvent.click(screen.getByRole('button', { name: 'Save tasting' }))
  await screen.findByText('Something changed in the meantime. Check and try again.')
  await fireEvent.click(screen.getByRole('button', { name: 'Save tasting' }))

  await vi.waitFor(() => expect(ondone).toHaveBeenCalledOnce())
  expect(store.tastings[0].sheet?.photoIds).toEqual(['p1'])
})
