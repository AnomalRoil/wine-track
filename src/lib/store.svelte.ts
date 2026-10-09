import { withAging } from './aging'
import * as db from './db'
import { defaultCellar } from './migrate'
import { computeStock, emptyCellar } from './stock'
import { today } from './due'
import { normalizeTasting } from './tasting'
import type { Cellar, Movement, Photo, Tasting, Wine } from './types'

export const store = $state({
  wines: [] as Wine[],
  tastings: [] as Tasting[],
  cellars: [] as Cellar[],
  movements: [] as Movement[],
  loaded: false,
})

const stock = $derived(computeStock(store.movements))

/** Current bottles per cellar per wine, recomputed when movements change. */
export function currentStock() {
  return stock
}

export function sortedCellars(): Cellar[] {
  return [...store.cellars].sort((a, b) => a.position - b.position)
}

export async function initStore(): Promise<void> {
  const all = await db.loadAll()
  if (all.cellars.length === 0) {
    all.cellars = [defaultCellar()]
    await db.putCellars(all.cellars)
  }
  store.wines = all.wines.map(withAging)
  store.tastings = all.tastings.map(normalizeTasting)
  store.cellars = all.cellars
  store.movements = all.movements
  store.loaded = true
}

export function tastingsFor(wineId: string): Tasting[] {
  return store.tastings
    .filter((t) => t.wineId === wineId)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function movementsFor(wineId: string): Movement[] {
  return store.movements
    .filter((m) => m.wineId === wineId)
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
  store.movements = store.movements.filter((m) => m.wineId !== wine.id)
}

/** Saves a tasting with the photos it gained; `removedPhotoIds` are photos it no longer shows. */
export async function saveTasting(tasting: Tasting, added: Photo[] = [], removedPhotoIds: string[] = []): Promise<void> {
  await db.putTasting($state.snapshot(tasting), added, removedPhotoIds)
  const i = store.tastings.findIndex((t) => t.id === tasting.id)
  if (i >= 0) store.tastings[i] = tasting
  else store.tastings.push(tasting)
}

export async function removeTasting(tasting: Tasting): Promise<void> {
  await db.deleteTasting($state.snapshot(tasting))
  store.tastings = store.tastings.filter((t) => t.id !== tasting.id)
}

export async function addMovements(movements: Movement[]): Promise<void> {
  await db.putMovements(movements)
  store.movements.push(...movements)
}

export async function removeMovement(id: string): Promise<void> {
  await db.deleteMovement(id)
  store.movements = store.movements.filter((m) => m.id !== id)
}

export async function saveCellars(cellars: Cellar[]): Promise<void> {
  await db.putCellars($state.snapshot(cellars))
  for (const c of cellars) {
    const i = store.cellars.findIndex((x) => x.id === c.id)
    if (i >= 0) store.cellars[i] = c
    else store.cellars.push(c)
  }
}

/** Deletes a cellar, moving its bottles to `targetId` or, when null, out of stock. */
export async function removeCellar(id: string, targetId: string | null): Promise<void> {
  const emptying = emptyCellar(stock, id, targetId, today(), () => crypto.randomUUID())
  await db.deleteCellar(id, emptying)
  store.movements.push(...emptying)
  store.cellars = store.cellars.filter((c) => c.id !== id)
}
