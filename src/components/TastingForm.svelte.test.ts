import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import * as db from '../lib/db'
import { settings } from '../lib/settings.svelte'
import { restore, store } from '../lib/store.svelte'
import { emptySheet } from '../lib/tasting'
import { makeTasting, makeWine } from '../lib/testing'
import TastingForm from './TastingForm.svelte'

vi.mock('../lib/db')

beforeEach(() => {
  vi.resetAllMocks()
  settings.locale = 'en'
  Object.assign(store, { wines: [makeWine()], tastings: [makeTasting()], cellars: [], movements: [], racks: [], placements: [], restoring: false })
})

it('keeps the draft after a restore and saves it on retry', async () => {
  const ondone = vi.fn()
  render(TastingForm, { wineId: 'w1', color: 'red', tasting: store.tastings[0], ondone })
  const notes = screen.getByLabelText<HTMLTextAreaElement>('Notes')
  await fireEvent.input(notes, { target: { value: 'Flint' } })
  const data = { wines: $state.snapshot(store.wines), tastings: $state.snapshot(store.tastings), cellars: [], movements: [], racks: [], placements: [] }
  vi.mocked(db.loadAll).mockResolvedValue(data)
  await restore(data, [])

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
  const restored = [makeTasting({ sheet: { ...sheet, photoIds: ['p1'] } })]
  const data = { wines: $state.snapshot(store.wines), tastings: restored, cellars: [], movements: [], racks: [], placements: [] }
  vi.mocked(db.loadAll).mockResolvedValue(data)
  await restore(data, [])

  await fireEvent.click(screen.getByRole('button', { name: 'Save tasting' }))
  await screen.findByText('Something changed in the meantime. Check and try again.')
  await fireEvent.click(screen.getByRole('button', { name: 'Save tasting' }))

  await vi.waitFor(() => expect(ondone).toHaveBeenCalledOnce())
  expect(store.tastings[0].sheet?.photoIds).toEqual(['p1'])
})
