import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import * as db from '../lib/db'
import { settings } from '../lib/settings.svelte'
import { addMovements, store } from '../lib/store.svelte'
import { makeMovement, makeWine } from '../lib/testing'
import CellarSettings from './CellarSettings.svelte'

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
    movements: [],
    racks: [],
    placements: [],
  })
})

it('asks where bottles go when they arrive while an empty cellar waits for deletion', async () => {
  let arrive!: () => void
  vi.mocked(db.putMovements).mockImplementation(() => new Promise<void>((resolve) => (arrive = resolve)))
  vi.stubGlobal('confirm', () => true)
  vi.stubGlobal('alert', vi.fn())
  render(CellarSettings)

  const arrival = addMovements([makeMovement({ quantity: 2, cellarId: 'cave' })])
  await fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1])
  await vi.waitFor(() => expect(db.putMovements).toHaveBeenCalled())
  arrive()
  await arrival

  expect(await screen.findByText('“Cave” holds 2 bottles. Move them before deleting the cellar, or remove them from stock.')).toBeTruthy()
  expect(store.cellars.map((c) => c.id)).toEqual(['home', 'cave'])
  expect(db.deleteCellar).not.toHaveBeenCalled()
  expect(alert).not.toHaveBeenCalled()
})
