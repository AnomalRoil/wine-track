import * as db from './db'
import type { Tasting, Wine } from './types'

export const store = $state({
  wines: [] as Wine[],
  tastings: [] as Tasting[],
  loaded: false,
})

export async function initStore(): Promise<void> {
  const all = await db.loadAll()
  store.wines = all.wines
  store.tastings = all.tastings
  store.loaded = true
}

export function tastingsFor(wineId: string): Tasting[] {
  return store.tastings
    .filter((t) => t.wineId === wineId)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function saveWine(wine: Wine): Promise<void> {
  await db.putWine($state.snapshot(wine))
  const i = store.wines.findIndex((w) => w.id === wine.id)
  if (i >= 0) store.wines[i] = wine
  else store.wines.push(wine)
}

export async function removeWine(wine: Wine): Promise<void> {
  await db.deleteWine($state.snapshot(wine))
  store.wines = store.wines.filter((w) => w.id !== wine.id)
  store.tastings = store.tastings.filter((t) => t.wineId !== wine.id)
}

export async function saveTasting(tasting: Tasting): Promise<void> {
  await db.putTasting($state.snapshot(tasting))
  const i = store.tastings.findIndex((t) => t.id === tasting.id)
  if (i >= 0) store.tastings[i] = tasting
  else store.tastings.push(tasting)
}

export async function removeTasting(id: string): Promise<void> {
  await db.deleteTasting(id)
  store.tastings = store.tastings.filter((t) => t.id !== id)
}
