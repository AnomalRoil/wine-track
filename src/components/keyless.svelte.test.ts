import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import { beforeEach, expect, it, vi } from 'vitest'
import { NO_AGING } from '../lib/aging'
import { emptyDraft, extractFromLabel, lookupAging, lookupGrapes } from '../lib/extract'
import { processPhoto } from '../lib/photo'
import { settings } from '../lib/settings.svelte'
import { store } from '../lib/store.svelte'
import AgingFields from './AgingFields.svelte'
import CaptureFlow from './CaptureFlow.svelte'
import CellarView from './CellarView.svelte'
import NeedsKey from './NeedsKey.svelte'
import WineForm from './WineForm.svelte'

vi.mock('../lib/db')
vi.mock('../lib/lwinData.svelte', async (original) => ({
  ...(await original<typeof import('../lib/lwinData.svelte')>()),
  initLwin: vi.fn(async () => {}),
  checkRemote: vi.fn(async () => {}),
  searchLwin: vi.fn(async () => []),
  matchLwin: vi.fn(async () => [[]]),
}))
vi.mock('../lib/photo', async (original) => ({ ...(await original<typeof import('../lib/photo')>()), processPhoto: vi.fn() }))
vi.mock('../lib/extract', async (original) => ({
  ...(await original<typeof import('../lib/extract')>()),
  extractFromLabel: vi.fn(),
  lookupGrapes: vi.fn(),
  lookupAging: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  settings.locale = 'en'
  settings.apiKey = ''
  Object.assign(store, { wines: [], tastings: [], cellars: [{ id: 'home', name: '', position: 0, storage: {} }], movements: [], racks: [], placements: [] })
  URL.createObjectURL = () => 'blob:photo'
  URL.revokeObjectURL = () => {}
})

const draft = () => ({ ...emptyDraft(), name: 'Les Clos', producer: 'Dauvissat' })

it('NeedsKey shows the action unavailable and asks for a key in a dialog', async () => {
  const onclick = vi.fn()
  const { container } = render(NeedsKey, { label: 'Look up grapes online', onclick })

  const action = screen.getByRole('button', { name: 'Look up grapes online' })
  expect(action.getAttribute('aria-disabled')).toBe('true')
  expect(action.getAttribute('aria-describedby')).toBe(screen.getByText(/Needs an Anthropic API key/).id)
  await fireEvent.click(action)
  expect(onclick).not.toHaveBeenCalled()

  const link = screen.getByRole('button', { name: 'Add an API key' })
  await fireEvent.click(link)
  const dialog = await screen.findByRole('dialog', { name: 'Add an API key' })
  await waitFor(() => expect(document.activeElement).toBe(dialog.querySelector('input[type=password]')))
  expect(container.closest('[inert]')).not.toBeNull()

  await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(container.closest('[inert]')).toBeNull()
  await waitFor(() => expect(document.activeElement).toBe(link))
  expect(settings.apiKey).toBe('')
})

it('NeedsKey keeps the same button once a key is added', async () => {
  const onclick = vi.fn()
  render(NeedsKey, { label: 'Look up grapes online', onclick })
  const action = screen.getByRole('button', { name: 'Look up grapes online' })
  await fireEvent.click(action)
  expect(onclick).not.toHaveBeenCalled()

  settings.apiKey = 'key'
  await waitFor(() => expect(action.getAttribute('aria-disabled')).toBeNull())
  expect(action.isConnected).toBe(true)
  await fireEvent.click(action)
  expect(onclick).toHaveBeenCalledOnce()
})

it('WineForm offers the grape lookup only with a key', async () => {
  render(WineForm, { draft: draft(), title: 'New wine', onsave: () => {}, oncancel: () => {} })

  const lookup = screen.getByRole('button', { name: 'Look up grapes online' })
  expect(lookup.getAttribute('aria-disabled')).toBe('true')
  await fireEvent.click(lookup)
  expect(lookupGrapes).not.toHaveBeenCalled()

  settings.apiKey = 'key'
  await waitFor(() => expect(lookup.getAttribute('aria-disabled')).toBeNull())
  expect(lookup.isConnected).toBe(true)
  expect(screen.queryByText(/Needs an Anthropic API key/)).toBeNull()
  vi.mocked(lookupGrapes).mockResolvedValue({ ok: true, data: { grapes: [{ name: 'Chardonnay', percent: null }], confidence: 'printed-source', sourceUrl: null } })
  await fireEvent.click(lookup)
  expect(lookupGrapes).toHaveBeenCalledOnce()
})

it('WineForm keeps the grape lookup plainly disabled while it has nothing to look up', () => {
  render(WineForm, { draft: emptyDraft(), title: 'New wine', onsave: () => {}, oncancel: () => {} })

  const lookup = screen.getByRole('button', { name: 'Look up grapes online' }) as HTMLButtonElement
  expect(lookup.disabled).toBe(true)
  expect(lookup.getAttribute('aria-disabled')).toBeNull()
  expect(screen.queryByText(/Needs an Anthropic API key/)).toBeNull()
})

it('AgingFields offers the drinking-window lookup only with a key', async () => {
  render(AgingFields, { aging: { ...NO_AGING }, wine: draft() })

  const lookup = screen.getByRole('button', { name: 'Look up online' })
  expect(lookup.getAttribute('aria-disabled')).toBe('true')
  await fireEvent.click(lookup)
  expect(lookupAging).not.toHaveBeenCalled()
  screen.getByText(/Needs an Anthropic API key/)
})

it('CaptureFlow goes from a photo straight to the form without a key', async () => {
  vi.mocked(processPhoto).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  render(CaptureFlow, { onsaved: () => {}, photo: new File(['jpeg'], 'label.jpg') })

  const readLabel = await screen.findByRole('button', { name: 'Read the label' })
  expect(readLabel.getAttribute('aria-disabled')).toBe('true')
  screen.getByRole('heading', { name: 'New wine' })
  expect(screen.queryByText('Reading the label…')).toBeNull()
  expect(document.querySelector('.error')).toBeNull()
  expect(extractFromLabel).not.toHaveBeenCalled()

  await fireEvent.input(document.querySelector('#name')!, { target: { value: 'Les Clos' } })
  expectHintNextToEach(['Read the label', 'Look up grapes online', 'Look up online'])
})

/** Each action named in `names` is gated, with the key hint right after it. */
function expectHintNextToEach(names: string[]) {
  for (const name of names) {
    const action = screen.getByRole('button', { name })
    expect(action.getAttribute('aria-describedby')).toBe(action.nextElementSibling?.id)
    expect(action.nextElementSibling?.textContent).toMatch(/Needs an Anthropic API key/)
  }
  expect(screen.getAllByText(/Needs an Anthropic API key/)).toHaveLength(names.length)
}

it('CaptureFlow without a photo shows the key hint only next to the lookups', async () => {
  render(CaptureFlow, { onsaved: () => {}, intoCellar: 'home' })
  expect(screen.queryByText(/Needs an Anthropic API key/)).toBeNull()

  await fireEvent.input(document.querySelector('#name')!, { target: { value: 'Les Clos' } })
  expectHintNextToEach(['Look up grapes online', 'Look up online'])
})

async function captureWithDraft() {
  vi.mocked(processPhoto).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  render(CaptureFlow, { onsaved: () => {}, photo: new File(['jpeg'], 'label.jpg') })
  await screen.findByRole('button', { name: 'Read the label' })
  await fireEvent.input(document.querySelector('#name')!, { target: { value: 'Les Clos' } })
  const [link] = screen.getAllByRole('button', { name: 'Add an API key' })
  link.focus()
  await fireEvent.click(link)
  return { link, dialog: await screen.findByRole('dialog', { name: 'Add an API key' }) }
}

it('A key saved from the capture form enables reading the label and keeps the form', async () => {
  const { dialog } = await captureWithDraft()
  const save = within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement
  expect(save.disabled).toBe(true)
  await fireEvent.input(dialog.querySelector('input[type=password]')!, { target: { value: ' sk-ant-test ' } })
  await fireEvent.click(save)

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(settings.apiKey).toBe('sk-ant-test')
  expect(document.querySelector<HTMLImageElement>('img.preview')?.src).toBe('blob:photo')
  expect(document.querySelector<HTMLInputElement>('#name')!.value).toBe('Les Clos')
  const readLabel = screen.getByRole('button', { name: 'Read the label' })
  expect(readLabel.getAttribute('aria-disabled')).toBeNull()
  expect(screen.queryByText(/Needs an Anthropic API key/)).toBeNull()
  // The hint link is gone with the hint, so the focus goes to the action the key enabled.
  await waitFor(() => expect(document.activeElement).toBe(readLabel))
})

it('Cancel and Escape close the key dialog without saving', async () => {
  for (const close of [
    () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })),
    () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }),
  ]) {
    const { link, dialog } = await captureWithDraft()
    await fireEvent.input(dialog.querySelector('input[type=password]')!, { target: { value: 'sk-ant-test' } })
    await close()

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(settings.apiKey).toBe('')
    expect(document.querySelector<HTMLInputElement>('#name')!.value).toBe('Les Clos')
    await waitFor(() => expect(document.activeElement).toBe(link))
    cleanup()
  }
})

it('Closing the key dialog keeps a slot capture in CellarView', async () => {
  vi.mocked(processPhoto).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
  store.racks = [{ id: 'r', cellarId: 'home', name: '', columns: 1, rows: 1, depth: 1, layout: 'lying', position: 0 }]
  render(CellarView, { onopen: () => {} })
  await fireEvent.click(document.querySelector('[data-slot]')!)
  const gallery = document.querySelector<HTMLInputElement>('input[type=file]:not([capture])')!
  await fireEvent.change(gallery, { target: { files: [new File(['jpeg'], 'label.jpg')] } })
  await screen.findByRole('button', { name: 'Read the label' })
  await fireEvent.input(document.querySelector('#name')!, { target: { value: 'Les Clos' } })

  for (const close of [
    (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })),
    async (dialog: HTMLElement) => {
      await fireEvent.input(dialog.querySelector('input[type=password]')!, { target: { value: 'sk-ant-test' } })
      await fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    },
  ]) {
    const hint = screen.getByRole('button', { name: 'Read the label' }).nextElementSibling as HTMLElement
    await fireEvent.click(within(hint).getByRole('button', { name: 'Add an API key' }))
    await close(await screen.findByRole('dialog', { name: 'Add an API key' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Forward lands on the closed dialog's entry, which must still read as the capture's.
    history.forward()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(document.querySelector<HTMLImageElement>('img.preview')?.src).toBe('blob:photo')
    expect(document.querySelector<HTMLInputElement>('#name')?.value).toBe('Les Clos')
  }
  expect(settings.apiKey).toBe('sk-ant-test')
})
