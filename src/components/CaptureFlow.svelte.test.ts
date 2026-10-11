import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { parseImport } from '../lib/csvImport'
import * as db from '../lib/db'
import type { LwinWine } from '../lib/lwin'
import { initLwin, searchLwin } from '../lib/lwinData.svelte'
import { settings } from '../lib/settings.svelte'
import { applyImport, store } from '../lib/store.svelte'
import { makeWine } from '../lib/testing'
import CaptureFlow from './CaptureFlow.svelte'

vi.mock('../lib/db')
vi.mock('../lib/lwinData.svelte', () => ({ initLwin: vi.fn(), searchLwin: vi.fn(), matchLwin: vi.fn() }))

const lesClos: LwinWine = {
  lwin: '1066540',
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
  vi.mocked(initLwin).mockResolvedValue()
  vi.mocked(searchLwin).mockResolvedValue([{ wine: lesClos, score: 1 }])
  const wine = makeWine({ name: lesClos.label, producer: lesClos.producer, vintage: null, color: 'white', lwin: null })
  Object.assign(store, { wines: [wine], tastings: [], cellars: [{ id: 'home', name: '', position: 0, storage: {} }], movements: [], racks: [], placements: [], restoring: false })
})

const button = (label: string) => screen.getByRole<HTMLButtonElement>('button', { name: label })

it('drops a duplicate an import coded meanwhile and keeps the draft for a retry', async () => {
  const onsaved = vi.fn()
  render(CaptureFlow, { onsaved, intoCellar: 'home' })
  await fireEvent.input(screen.getByLabelText('Producer'), { target: { value: 'Dauvissat' } })
  await fireEvent.click(await screen.findByRole('button', { name: /Les Clos/ }))
  await fireEvent.click(button('Save'))
  expect(button('Add the bottles to it')).toBeTruthy()

  let imported!: () => void
  vi.mocked(db.putImport).mockImplementation(() => new Promise<void>((resolve) => (imported = resolve)))
  const parsed = parseImport(`name,producer,vintage,lwin\n"${lesClos.label}",${lesClos.producer},,1066553\n`, 2026)
  if (!parsed.ok) throw new Error(parsed.error)
  const done = applyImport(parsed.rows, { defaultCellarName: 'Home', date: '2026-01-01', now: 0, newId: () => crypto.randomUUID() })
  await vi.waitFor(() => expect(db.putImport).toHaveBeenCalled())
  await fireEvent.click(button('Add the bottles to it'))
  imported()
  await done

  expect(await screen.findByText('Something changed in the meantime. Check and try again.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Add the bottles to it' })).toBeNull()
  expect(screen.getByText('LWIN 1066540')).toBeTruthy()
  expect(store.wines.map((w) => w.lwin)).toEqual(['1066553'])

  await fireEvent.click(button('Save'))
  await vi.waitFor(() => expect(onsaved).toHaveBeenCalled())
  expect(store.wines.map((w) => w.lwin)).toEqual(['1066553', '1066540'])
  expect(store.movements.filter((m) => m.wineId === store.wines[1].id)).toHaveLength(1)
})
