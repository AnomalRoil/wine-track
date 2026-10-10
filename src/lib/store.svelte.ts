import { withAging } from './aging'
import * as db from './db'
import { defaultCellar, normalizeCellar } from './migrate'
import { canRecord, canRemoveCellar, computeStock, emptyCellar, withinStock } from './stock'
import { today } from './due'
import { planImport, type ImportPlan, type ImportRow, type PlanContext } from './csvImport'
import { approvedDrops, canPlace, cellarLosing, freedSlots, holds, outside, place, planMove, stalePlacements, type Slot } from './racks'
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
 * Runs every write in turn. Each write rechecks its
 * preconditions against the state the previous ones committed, whichever view or
 * screen started it, and does nothing when they no longer hold.
 */
const writes = serial()

/** Counts restores, so a save started before one drops its later steps. */
let generation = 0

/** The current restore count, to pass to a save that has to wait for something first. */
export function storeGeneration(): number {
  return generation
}

/** Current bottles per cellar per wine, recomputed when movements change. */
export function currentStock() {
  return stock
}

export function sortedCellars(): Cellar[] {
  return [...store.cellars].sort((a, b) => a.position - b.position)
}

export function initStore(): Promise<void> {
  return writes(load)
}

/** Replaces all data with a backup once the pending writes are done. */
export function restore(data: db.Data, photos: Photo[]): Promise<void> {
  return writes(async () => {
    generation++
    await db.replaceAll(data, photos)
    await load()
  })
}

/** Every record and photo as one consistent snapshot, once the pending writes are done. */
export function backupSnapshot(): Promise<{ data: db.Data; photos: Photo[] }> {
  return writes(async () => {
    const { data, photos } = await db.snapshot()
    const normalized = { ...data, wines: data.wines.map(withAging), tastings: data.tastings.map(normalizeTasting), cellars: data.cellars.map(normalizeCellar) }
    return { data: normalized, photos }
  })
}

async function load(): Promise<void> {
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

/** Changes a wine, applying `patch` to the wine as the previous writes left it. False when it is gone. */
export function patchWine(id: string, patch: (wine: Wine) => Partial<Wine>): Promise<boolean> {
  return writes(async () => {
    const i = store.wines.findIndex((w) => w.id === id)
    if (i < 0) return false
    const wine = { ...store.wines[i], ...patch($state.snapshot(store.wines[i])) }
    await db.putWine($state.snapshot(wine))
    store.wines[i] = wine
    return true
  })
}

/**
 * Adds a new wine with its label photo and stock additions, all or nothing. False when a
 * restore ran since `since`, a storeGeneration() read when the save started, when an
 * addition's cellar is gone, or when the write fails.
 */
export function addWine(wine: Wine, photo: Photo | null, movements: Movement[], since: number): Promise<boolean> {
  return writes(async () => {
    if (since !== generation) return false
    const wineIds = new Set([...store.wines.map((w) => w.id), wine.id])
    if (!canRecord(stock, movements, wineIds, new Set(store.cellars.map((c) => c.id)))) return false
    try {
      await db.putWine($state.snapshot(wine), photo, movements)
    } catch {
      // The transaction rolled back, so the caller keeps the draft and can retry without a duplicate.
      return false
    }
    store.wines.push(wine)
    store.movements.push(...movements)
    return true
  })
}

/** Stores a thumbnail made for a photo read at `since`, unless a restore or deletion dropped the photo. */
export function saveThumb(photo: Photo, since: number): Promise<void> {
  return writes(async () => {
    if (since === generation && store.wines.some((w) => w.photoId === photo.id)) await db.putPhoto(photo)
  })
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

/**
 * Saves a tasting with the photos it gained; `removedPhotoIds` are photos it no longer shows.
 * False when its wine is gone.
 */
export function saveTasting(tasting: Tasting, added: Photo[] = [], removedPhotoIds: string[] = []): Promise<boolean> {
  return writes(async () => {
    if (!store.wines.some((w) => w.id === tasting.wineId)) return false
    await db.putTasting($state.snapshot(tasting), added, removedPhotoIds)
    const i = store.tastings.findIndex((t) => t.id === tasting.id)
    if (i >= 0) store.tastings[i] = tasting
    else store.tastings.push(tasting)
    return true
  })
}

export function removeTasting(tasting: Tasting): Promise<void> {
  return writes(async () => {
    const current = store.tastings.find((t) => t.id === tasting.id)
    if (!current) return
    await db.deleteTasting($state.snapshot(current))
    store.tastings = store.tastings.filter((t) => t.id !== tasting.id)
  })
}

/**
 * Records movements, emptying the slots of bottles that leave; `chosen` names them
 * when only some of a wine's slots empty. False when a wine or cellar is gone, a
 * movement would take more bottles than its cellar holds, or `chosen` no longer fits.
 */
export function addMovements(movements: Movement[], chosen: string[] = []): Promise<boolean> {
  return writes(async () => {
    const losses = movements.filter((m) => m.kind !== 'add')
    const freed = freedSlots(losses, chosen, store.racks, store.placements, stock)
    return freed !== null && recordMovements(movements, freed, [])
  })
}

async function recordMovements(movements: Movement[], freed: string[], placed: Placement[]): Promise<boolean> {
  const wineIds = new Set(store.wines.map((w) => w.id))
  if (!canRecord(stock, movements, wineIds, new Set(store.cellars.map((c) => c.id)))) return false
  await db.putMovements(movements, freed, placed)
  store.movements.push(...movements)
  const gone = new Set([...freed, ...placed.map((p) => p.id)])
  if (gone.size > 0) store.placements = [...store.placements.filter((p) => !gone.has(p.id)), ...placed]
  await freeStalePlacements()
  return true
}

/** Records drinking the bottle in `placement` and empties its slot. False when the slot no longer holds it. */
export function drink(placement: Placement): Promise<boolean> {
  return writes(async () => {
    const rack = store.racks.find((r) => r.id === placement.rackId)
    if (!rack || !holds(store.placements, placement)) return false
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

/** Empties the slot of `placement`. False when the slot no longer holds that bottle. */
export function unplace(placement: Placement): Promise<boolean> {
  return writes(async () => {
    if (!holds(store.placements, placement)) return false
    await commitPlacements([], [placement.id])
    return true
  })
}

async function commitPlacements(put: Placement[], remove: string[]): Promise<void> {
  await db.updatePlacements(put, remove)
  const gone = new Set([...remove, ...put.map((p) => p.id)])
  store.placements = [...store.placements.filter((p) => !gone.has(p.id)), ...put]
}

/**
 * Deletes a movement, emptying the slots of bottles that disappear; `chosen` names them
 * when only some of a wine's slots empty. 'stale' when the movement is gone or `chosen` no
 * longer fits; 'unbalanced' when undoing it would leave a cellar below zero bottles or
 * return bottles to a deleted cellar.
 */
export function removeMovement(id: string, chosen: string[] = []): Promise<'removed' | 'stale' | 'unbalanced'> {
  return writes(async () => {
    const m = store.movements.find((x) => x.id === id)
    if (!m) return 'stale'
    const cellarId = cellarLosing(m)
    const losses = cellarId ? [{ wineId: m.wineId, cellarId, quantity: m.quantity }] : []
    const returnsTo = m.kind === 'add' ? null : m.cellarId
    const inverse = losses.map((l) => ({ ...m, ...l, kind: 'consume' as const, toCellarId: null }))
    if ((returnsTo && !store.cellars.some((c) => c.id === returnsTo)) || !withinStock(stock, inverse)) return 'unbalanced'
    const freed = freedSlots(losses, chosen, store.racks, store.placements, stock)
    if (!freed) return 'stale'
    await db.deleteMovement(id, freed)
    store.movements = store.movements.filter((x) => x.id !== id)
    if (freed.length > 0) store.placements = store.placements.filter((p) => !freed.includes(p.id))
    await freeStalePlacements()
    return 'removed'
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

/**
 * Deletes a cellar, moving its bottles to `targetId` or, when null, out of stock.
 * False when it is the last cellar or either cellar is gone.
 */
export function removeCellar(id: string, targetId: string | null): Promise<boolean> {
  return writes(async () => {
    if (!canRemoveCellar(store.cellars.map((c) => c.id), id, targetId)) return false
    const emptying = emptyCellar(stock, id, targetId, today(), () => crypto.randomUUID())
    await db.deleteCellar(id, emptying)
    store.movements.push(...emptying)
    store.cellars = store.cellars.filter((c) => c.id !== id)
    const rackIds = new Set(store.racks.filter((r) => r.cellarId === id).map((r) => r.id))
    store.racks = store.racks.filter((r) => !rackIds.has(r.id))
    store.placements = store.placements.filter((p) => !rackIds.has(p.rackId))
    return true
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

/** Adds a rack. False when its cellar is gone. */
export function addRack(rack: Rack): Promise<boolean> {
  return writes(async () => {
    if (!store.cellars.some((c) => c.id === rack.cellarId)) return false
    await putRacks([rack])
    return true
  })
}

/**
 * Saves an edited rack, keeping its current position; bottles outside its new size leave
 * their slots. False when the rack is gone or it would drop a placement not in `approved`.
 */
export function updateRack(rack: Rack, approved: string[] = []): Promise<boolean> {
  return writes(async () => {
    const current = store.racks.find((r) => r.id === rack.id)
    const next = current && { ...rack, position: current.position }
    if (!next || !approvedDrops(next, store.placements, approved)) return false
    await putRacks([next])
    return true
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

/**
 * Plans the import against the stored wines and cellars and commits it atomically:
 * new wines, new cellars and stock additions. Returns the plan it committed.
 */
export function applyImport(rows: ImportRow[], ctx: Omit<PlanContext, 'cellars'>): Promise<ImportPlan> {
  return writes(async () => {
    const plan = planImport(rows, store.wines, { ...ctx, cellars: store.cellars })
    const { wines, cellars, movements } = plan
    await db.putImport({ wines, cellars, movements })
    store.wines.push(...wines)
    store.cellars.push(...cellars)
    store.movements.push(...movements)
    return plan
  })
}
