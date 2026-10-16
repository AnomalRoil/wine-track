import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import * as db from '../lib/db'
import { emptyDraft, lookupGrapes } from '../lib/extract'
import { settings } from '../lib/settings.svelte'
import { store } from '../lib/store.svelte'
import { makeWine } from '../lib/testing'
import WineDetail from './WineDetail.svelte'
import WineForm from './WineForm.svelte'

vi.mock('../lib/db')
vi.mock('../lib/lwinData.svelte', async (original) => ({
  ...(await original<typeof import('../lib/lwinData.svelte')>()),
  initLwin: vi.fn(async () => {}),
  searchLwin: vi.fn(async () => []),
}))
vi.mock('../lib/extract', async (original) => ({ ...(await original<typeof import('../lib/extract')>()), lookupGrapes: vi.fn() }))

const home = { id: 'home', name: '', position: 0, storage: {} }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(db.putWine).mockResolvedValue()
  vi.mocked(db.getLwin).mockResolvedValue(undefined)
  settings.locale = 'en'
  settings.apiKey = 'key'
  Object.assign(store, { wines: [], tastings: [], cellars: [home], movements: [], racks: [], placements: [], restoring: false })
})

const share = (grape: string) => screen.getByLabelText<HTMLInputElement>(`Percentage of ${grape}`)
const warning = () => screen.queryByText(/The percentages add up to/)

function form(grapes: string[], grapeShares: Record<string, number> = {}) {
  const draft = $state({ ...emptyDraft(), name: 'Clos', grapes, grapeShares })
  render(WineForm, { draft, title: 'New wine', onsave: () => {}, oncancel: () => {} })
}

it('warns while the shares given do not total 100%', async () => {
  form(['Merlot', 'Cabernet Franc'])
  expect(warning()).toBeNull()

  await fireEvent.input(share('Merlot'), { target: { value: '60' } })
  expect(warning()?.textContent).toBe('The percentages add up to 60%, not 100%.')

  await fireEvent.input(share('Cabernet Franc'), { target: { value: '40' } })
  expect(warning()).toBeNull()
})

it('drops the share of a removed grape', async () => {
  form(['Merlot', 'Cabernet Franc'], { Merlot: 60, 'Cabernet Franc': 40 })
  await fireEvent.click(screen.getByRole('button', { name: 'Remove Cabernet Franc' }))
  expect(warning()?.textContent).toBe('The percentages add up to 60%, not 100%.')
})

it('fills the shares a source states and links to it', async () => {
  vi.mocked(lookupGrapes).mockResolvedValue({
    ok: true,
    data: { grapes: [{ name: 'Merlot', percent: 80 }, { name: 'Malbec', percent: 20 }], confidence: 'printed-source', sourceUrl: 'https://domaine.example/fiche' },
  })
  form([])
  await fireEvent.click(screen.getByRole('button', { name: 'Look up grapes online' }))

  await waitFor(() => expect(share('Merlot').value).toBe('80'))
  expect(share('Malbec').value).toBe('20')
  const link = screen.getByRole<HTMLAnchorElement>('link', { name: 'Source: domaine.example' })
  expect(link.href).toBe('https://domaine.example/fiche')
  expect(link.rel).toContain('noopener')
})

it('leaves shares empty for a typical blend', async () => {
  vi.mocked(lookupGrapes).mockResolvedValue({
    ok: true,
    data: { grapes: [{ name: 'Syrah', percent: 90 }, { name: 'Viognier', percent: 10 }], confidence: 'typical-blend', sourceUrl: null },
  })
  form([])
  await fireEvent.click(screen.getByRole('button', { name: 'Look up grapes online' }))

  await waitFor(() => expect(share('Syrah').value).toBe(''))
  expect(share('Viognier').value).toBe('')
  expect(screen.getByText(/Typical blend for this appellation/)).toBeTruthy()
  expect(screen.queryByRole('link', { name: /^Source/ })).toBeNull()
})

it('shows each share on the wine page, a single grape as 100%', () => {
  store.wines = [
    makeWine({ id: 'w1', grapes: ['Merlot', 'Malbec'], grapeShares: { Merlot: 87.5 } }),
    makeWine({ id: 'w2', grapes: ['Chardonnay'] }),
  ]
  render(WineDetail, { wineId: 'w1', onclose: () => {} })
  expect(screen.getByText('Merlot').textContent).toBe('Merlot87.5%')
  expect(screen.getByText('Malbec').textContent).toBe('Malbec')

  render(WineDetail, { wineId: 'w2', onclose: () => {} })
  expect(screen.getByText('Chardonnay').textContent).toBe('Chardonnay100%')
})

it('saves a share edited on the wine page', async () => {
  store.wines = [makeWine({ grapes: ['Merlot', 'Malbec'] })]
  render(WineDetail, { wineId: 'w1', onclose: () => {} })
  await fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
  await fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))

  await fireEvent.input(share('Merlot'), { target: { value: '70' } })
  await fireEvent.input(share('Malbec'), { target: { value: '30' } })
  await fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(store.wines[0].grapeShares).toEqual({ Merlot: 70, Malbec: 30 }))
  expect(vi.mocked(db.putWine).mock.calls.at(-1)?.[0]).toMatchObject({ grapeShares: { Merlot: 70, Malbec: 30 } })
})
