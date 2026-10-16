import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import * as db from '../lib/db'
import { settings } from '../lib/settings.svelte'
import { store } from '../lib/store.svelte'
import { makeMovement, makeWine } from '../lib/testing'
import StockPanel from './StockPanel.svelte'

vi.mock('../lib/db')

beforeEach(() => {
  vi.resetAllMocks()
  settings.locale = 'en'
  Object.assign(store, {
    wines: [makeWine()],
    tastings: [],
    cellars: [
      { id: 'home', name: 'Home', position: 0, storage: {} },
      { id: 'cave', name: 'Cave', position: 1, storage: {} },
    ],
    movements: [makeMovement({ quantity: 3, cellarId: 'cave' })],
    racks: [],
    placements: [],
  })
  render(StockPanel, { wineId: 'w1' })
})

const cellar = () => screen.getByLabelText<HTMLSelectElement>('Cellar').value
const note = () => screen.getByLabelText<HTMLInputElement>('Note')

it('resets the form defaults when the mode changes', async () => {
  await fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(cellar()).toBe('home')

  await fireEvent.click(screen.getByRole('button', { name: 'Drink a bottle' }))
  expect(cellar()).toBe('cave')

  await fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(cellar()).toBe('home')
})

it('keeps the next form open when a save from the previous mode lands', async () => {
  let land!: () => void
  vi.mocked(db.putMovements).mockImplementation(() => new Promise<void>((resolve) => (land = resolve)))
  await fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  await fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await vi.waitFor(() => expect(db.putMovements).toHaveBeenCalled())

  await fireEvent.click(screen.getByRole('button', { name: 'Move' }))
  await fireEvent.input(note(), { target: { value: 'for the party' } })
  land()

  await vi.waitFor(() => expect(store.movements).toHaveLength(2))
  await new Promise((resolve) => setTimeout(resolve))
  expect(note().value).toBe('for the party')
  expect(screen.getByLabelText('To cellar')).toBeTruthy()
})

it('records where added bottles were bought', async () => {
  await fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  await fireEvent.input(screen.getByLabelText('Bought at'), { target: { value: ' Lavinia ' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  await vi.waitFor(() => expect(store.movements).toHaveLength(2))
  expect(store.movements[1]).toMatchObject({ kind: 'add', place: 'Lavinia' })
})

it('asks for a purchase place on additions only', async () => {
  await fireEvent.click(screen.getByRole('button', { name: 'Drink a bottle' }))
  expect(screen.queryByLabelText('Bought at')).toBeNull()
})
