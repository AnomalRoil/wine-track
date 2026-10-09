import { withAging } from './aging'
import * as db from './db'
import { defaultCellar, normalizeCellar } from './migrate'
import { computeStock, emptyCellar, withinStock } from './stock'
import { today } from './due'
import { canPlace, outside, place, planMove, stalePlacements, type Slot } from './racks'
import { serial } from './serial'
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

/**
 * Runs every write to stock, slots, racks or cellars in turn. Each write checks the
 * state the previous ones committed, whichever view or screen started it.
 */
const writes = serial()

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

export function removeWine(wine: Wine): Promise<void> {
  return writes(async () => {
    await db.deleteWine($state.snapshot(wine))
    store.wines = store.wines.filter((w) => w.id !== wine.id)
    store.tastings = store.tastings.filter((t) => t.wineId !== wine.id)
    store.movements = store.movements.filter((m) => m.wineId !== wine.id)
    store.placements = store.placements.filter((p) => p.wineId !== wine.id)
  })
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
 * and `placed` the bottles that moved into one. False when a movement would take
 * more bottles than its cellar holds.
 */
export function addMovements(movements: Movement[], freed: string[] = [], placed: Placement[] = []): Promise<boolean> {
  return writes(() => recordMovements(movements, freed, placed))
}

async function recordMovements(movements: Movement[], freed: string[], placed: Placement[]): Promise<boolean> {
  if (!withinStock(stock, movements)) return false
  await db.putMovements(movements, freed, placed)
  store.movements.push(...movements)
  if (freed.length === 0 && placed.length === 0) return true
  const gone = new Set([...freed, ...placed.map((p) => p.id)])
  store.placements = [...store.placements.filter((p) => !gone.has(p.id)), ...placed]
  return true
}

/** Records drinking the bottle in `placement` and empties its slot. False when the slot no longer holds it. */
export function drink(placement: Placement): Promise<boolean> {
  return writes(async () => {
    const rack = store.racks.find((r) => r.id === placement.rackId)
    if (!rack || !store.placements.some((p) => p.id === placement.id && p.wineId === placement.wineId)) return false
    const consume: Movement = {
      id: crypto.randomUUID(),
      wineId: placement.wineId,
      date: today(),
      kind: 'consume',
      quantity: 1,
      cellarId: rack.cellarId,
      toCellarId: null,
      unitPrice: null,
      note: '',
    }
    return recordMovements([consume], [placement.id], [])
  })
}

/** Puts a bottle of `wineId` in `slot`. False when the slot is filled or gone, or every bottle is placed. */
export function placeBottle(slot: Slot, wineId: string): Promise<boolean> {
  return writes(async () => {
    if (!canPlace(slot, wineId, store.racks, store.placements, stock)) return false
    await commitPlacements([place(slot, wineId)], [])
    return true
  })
}

/** Moves the bottle in `from` to `to`, recording transfers between cellars. False when the move no longer applies. */
export function moveBottle(from: Placement, to: Slot): Promise<boolean> {
  return writes(async () => {
    const move = planMove(from, to, store.racks, store.placements, today(), () => crypto.randomUUID())
    if (!move) return false
    if (move.transfers.length > 0) return recordMovements(move.transfers, move.freed, move.put)
    await commitPlacements(move.put, move.freed)
    return true
  })
}

/** Empties a slot. */
export function unplace(id: string): Promise<void> {
  return writes(() => commitPlacements([], [id]))
}

async function commitPlacements(put: Placement[], remove: string[]): Promise<void> {
  await db.updatePlacements(put, remove)
  const gone = new Set([...remove, ...put.map((p) => p.id)])
  store.placements = [...store.placements.filter((p) => !gone.has(p.id)), ...put]
}

/** Deletes a movement; `freed` lists the slots to empty first when its bottles disappear. */
export function removeMovement(id: string, freed: string[] = []): Promise<void> {
  return writes(async () => {
    await db.deleteMovement(id, freed)
    store.movements = store.movements.filter((m) => m.id !== id)
    if (freed.length > 0) store.placements = store.placements.filter((p) => !freed.includes(p.id))
    await freeStalePlacements()
  })
}

async function putCellars(cellars: Cellar[]): Promise<void> {
  await db.putCellars($state.snapshot(cellars))
  for (const c of cellars) {
    const i = store.cellars.findIndex((x) => x.id === c.id)
    if (i >= 0) store.cellars[i] = c
    else store.cellars.push(c)
  }
}

export function addCellar(cellar: Cellar): Promise<void> {
  return writes(() => putCellars([cellar]))
}

/** Changes a cellar, applying `patch` to the cellar as the previous writes left it. */
export function patchCellar(id: string, patch: (cellar: Cellar) => Cellar): Promise<void> {
  return writes(async () => {
    const current = store.cellars.find((c) => c.id === id)
    if (current) await putCellars([patch(current)])
  })
}

/** Swaps the display positions of two cellars. */
export function swapCellars(a: string, b: string): Promise<void> {
  return writes(async () => {
    const [x, y] = [store.cellars.find((c) => c.id === a), store.cellars.find((c) => c.id === b)]
    if (x && y) await putCellars([{ ...x, position: y.position }, { ...y, position: x.position }])
  })
}

/** Deletes a cellar, moving its bottles to `targetId` or, when null, out of stock. */
export function removeCellar(id: string, targetId: string | null): Promise<void> {
  return writes(async () => {
    const emptying = emptyCellar(stock, id, targetId, today(), () => crypto.randomUUID())
    await db.deleteCellar(id, emptying)
    store.movements.push(...emptying)
    store.cellars = store.cellars.filter((c) => c.id !== id)
    const rackIds = new Set(store.racks.filter((r) => r.cellarId === id).map((r) => r.id))
    store.racks = store.racks.filter((r) => !rackIds.has(r.id))
    store.placements = store.placements.filter((p) => !rackIds.has(p.rackId))
  })
}

/** Saves racks and empties the slots they no longer hold. */
async function putRacks(racks: Rack[]): Promise<void> {
  const dropped = racks.flatMap((r) => outside(r, store.placements)).map((p) => p.id)
  await db.putRacks($state.snapshot(racks), dropped)
  for (const r of racks) {
    const i = store.racks.findIndex((x) => x.id === r.id)
    if (i >= 0) store.racks[i] = r
    else store.racks.push(r)
  }
  if (dropped.length > 0) store.placements = store.placements.filter((p) => !dropped.includes(p.id))
}

export function addRack(rack: Rack): Promise<void> {
  return writes(() => putRacks([rack]))
}

/** Saves an edited rack, keeping its current position; bottles outside its new size leave their slots. */
export function updateRack(rack: Rack): Promise<void> {
  return writes(async () => {
    const current = store.racks.find((r) => r.id === rack.id)
    if (current) await putRacks([{ ...rack, position: current.position }])
  })
}

/** Swaps the display positions of two racks. */
export function swapRacks(a: string, b: string): Promise<void> {
  return writes(async () => {
    const [x, y] = [store.racks.find((r) => r.id === a), store.racks.find((r) => r.id === b)]
    if (x && y) await putRacks([{ ...x, position: y.position }, { ...y, position: x.position }])
  })
}

export function removeRack(id: string): Promise<void> {
  return writes(async () => {
    await db.deleteRack(id)
    store.racks = store.racks.filter((r) => r.id !== id)
    store.placements = store.placements.filter((p) => p.rackId !== id)
  })
}

/** Commits an import atomically: new wines, new cellars and stock additions. */
export function applyImport(data: Pick<db.Data, 'wines' | 'cellars' | 'movements'>): Promise<void> {
  return writes(async () => {
    await db.putImport(data)
    store.wines.push(...data.wines)
    store.cellars.push(...data.cellars)
    store.movements.push(...data.movements)
  })
}
