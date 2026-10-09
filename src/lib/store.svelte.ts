import { withAging } from './aging'
import * as db from './db'
import { defaultCellar, normalizeCellar } from './migrate'
import { computeStock, emptyCellar } from './stock'
import { today } from './due'
import { stalePlacements } from './racks'
import { normalizeTasting } from './tasting'
import type { Cellar, Movement, Photo, Placement, Rack, Tasting, Wine } from './types'

export const store = $state({
  wines: [] as Wine[],
  tastings: [] as Tasting[],
  cellars: [] as Cellar[],
  movements: [] as Movement[],
  racks: [] as Rack[],
  placements: [] as Placement[],
  loaded: false,
  /** Another tab holds an older database version and keeps it from upgrading. */
  blocked: false,
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
  const all = await db.loadAll(() => (store.blocked = true))
  if (all.cellars.length === 0) {
    all.cellars = [defaultCellar()]
    await db.putCellars(all.cellars)
  }
  store.wines = all.wines.map(withAging)
  store.tastings = all.tastings.map(normalizeTasting)
  store.cellars = all.cellars.map(normalizeCellar)
  store.movements = all.movements
  const cellarIds = new Set(all.cellars.map((c) => c.id))
  const orphans = all.racks.filter((r) => !cellarIds.has(r.cellarId))
  for (const r of orphans) await db.deleteRack(r.id)
  store.racks = all.racks.filter((r) => cellarIds.has(r.cellarId))
  store.placements = all.placements
  await freeStalePlacements()
  store.loaded = true
}

/** Empties slots whose bottle no longer exists, e.g. after deleting an addition from the history. */
async function freeStalePlacements(): Promise<void> {
  const wineIds = new Set(store.wines.map((w) => w.id))
  const stale = new Set(stalePlacements(wineIds, store.racks, store.placements, stock).map((p) => p.id))
  if (stale.size === 0) return
  await db.updatePlacements([], [...stale])
  store.placements = store.placements.filter((p) => !stale.has(p.id))
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
  store.placements = store.placements.filter((p) => p.wineId !== wine.id)
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

/**
 * Records movements; `freed` lists the placements of bottles that left their slot
 * and `placed` the bottles that moved into one.
 */
export async function addMovements(movements: Movement[], freed: string[] = [], placed: Placement[] = []): Promise<void> {
  await db.putMovements(movements, freed, placed)
  store.movements.push(...movements)
  if (freed.length === 0 && placed.length === 0) return
  const gone = new Set([...freed, ...placed.map((p) => p.id)])
  store.placements = [...store.placements.filter((p) => !gone.has(p.id)), ...placed]
}

/** Deletes a movement; `freed` lists the slots to empty first when its bottles disappear. */
export async function removeMovement(id: string, freed: string[] = []): Promise<void> {
  await db.deleteMovement(id, freed)
  store.movements = store.movements.filter((m) => m.id !== id)
  if (freed.length > 0) store.placements = store.placements.filter((p) => !freed.includes(p.id))
  await freeStalePlacements()
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
  const rackIds = new Set(store.racks.filter((r) => r.cellarId === id).map((r) => r.id))
  store.racks = store.racks.filter((r) => !rackIds.has(r.id))
  store.placements = store.placements.filter((p) => !rackIds.has(p.rackId))
}

/** Saves racks; `dropped` lists placements a resize left outside them. */
export async function saveRacks(racks: Rack[], dropped: string[] = []): Promise<void> {
  await db.putRacks($state.snapshot(racks), dropped)
  for (const r of racks) {
    const i = store.racks.findIndex((x) => x.id === r.id)
    if (i >= 0) store.racks[i] = r
    else store.racks.push(r)
  }
  if (dropped.length > 0) store.placements = store.placements.filter((p) => !dropped.includes(p.id))
}

export async function removeRack(id: string): Promise<void> {
  await db.deleteRack(id)
  store.racks = store.racks.filter((r) => r.id !== id)
  store.placements = store.placements.filter((p) => p.rackId !== id)
}

/** Puts bottles in slots and empties others, atomically. */
export async function updatePlacements(put: Placement[], remove: string[] = []): Promise<void> {
  await db.updatePlacements(put, remove)
  const gone = new Set([...remove, ...put.map((p) => p.id)])
  store.placements = [...store.placements.filter((p) => !gone.has(p.id)), ...put]
}

/** Commits an import atomically: new wines, new cellars and stock additions. */
export async function applyImport(data: Pick<db.Data, 'wines' | 'cellars' | 'movements'>): Promise<void> {
  await db.putImport(data)
  store.wines.push(...data.wines)
  store.cellars.push(...data.cellars)
  store.movements.push(...data.movements)
}
