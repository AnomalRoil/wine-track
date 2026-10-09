import { bottlesOf, type Stock } from './stock'
import type { Movement, Placement, Rack } from './types'

export const MAX_COLUMNS = 24
/** Rows are lettered A–Z. */
export const MAX_ROWS = 26
export const MAX_DEPTH = 2

export interface Slot {
  rackId: string
  layer: number
  row: number
  column: number
}

export function slotId(s: Slot): string {
  return `${s.rackId}/${s.layer}/${s.row}/${s.column}`
}

/** "B3": rows lettered from the top, columns numbered from the left. */
export function slotName(s: Pick<Slot, 'row' | 'column'>): string {
  return `${String.fromCharCode(65 + s.row)}${s.column + 1}`
}

export function place(slot: Slot, wineId: string): Placement {
  const { rackId, layer, row, column } = slot
  return { id: slotId(slot), rackId, layer, row, column, wineId }
}

export function fits(rack: Pick<Rack, 'columns' | 'rows' | 'depth'>, s: Omit<Slot, 'rackId'>): boolean {
  return s.layer < rack.depth && s.row < rack.rows && s.column < rack.columns
}

/** Placements that resizing a rack to `next` would leave outside it. */
export function outside(next: Rack, placements: Placement[]): Placement[] {
  return placements.filter((p) => p.rackId === next.id && !fits(next, p))
}

export function racksOf(racks: Rack[], cellarId: string): Rack[] {
  return racks.filter((r) => r.cellarId === cellarId).sort((a, b) => a.position - b.position)
}

/** Placements of a wine in any rack of the cellar, in slot order. */
export function placementsOf(racks: Rack[], placements: Placement[], wineId: string, cellarId: string): Placement[] {
  const rackIds = new Set(racksOf(racks, cellarId).map((r) => r.id))
  return placements.filter((p) => p.wineId === wineId && rackIds.has(p.rackId)).sort(bySlot(racks))
}

/** In-stock bottles of the cellar that sit in no slot, per wine; wines with none are omitted. */
export function unplaced(stock: Stock, racks: Rack[], placements: Placement[], cellarId: string): Map<string, number> {
  const rackIds = new Set(racksOf(racks, cellarId).map((r) => r.id))
  const placed = new Map<string, number>()
  for (const p of placements) if (rackIds.has(p.rackId)) placed.set(p.wineId, (placed.get(p.wineId) ?? 0) + 1)
  const out = new Map<string, number>()
  for (const wineId of stock.keys()) {
    const n = bottlesOf(stock, wineId, cellarId) - (placed.get(wineId) ?? 0)
    if (n > 0) out.set(wineId, n)
  }
  return out
}

/** How many of the `placed` slots empty when `quantity` of the `available` bottles leave the cellar. */
export function slotsFreed(available: number, quantity: number, placed: number): number {
  return Math.min(placed, Math.max(0, placed - (available - quantity)))
}

/** Bottles of the `wineIds` wines per layer of the rack, front first. */
export function matchesPerLayer(rack: Rack, placements: Placement[], wineIds: Set<string>): number[] {
  const counts = Array.from({ length: rack.depth }, () => 0)
  for (const p of placements) if (p.rackId === rack.id && p.layer < rack.depth && wineIds.has(p.wineId)) counts[p.layer]++
  return counts
}

/**
 * Transfers recording a slot move between cellars: the moved bottle goes to `to`,
 * and the bottle it swaps with, if any, comes back to `from`.
 */
export function moveTransfers(
  moved: string,
  swapped: string | null,
  from: string,
  to: string,
  date: string,
  newId: () => string,
): Movement[] {
  if (from === to || moved === swapped) return []
  const transfer = (wineId: string, cellarId: string, toCellarId: string): Movement => ({
    id: newId(),
    wineId,
    date,
    kind: 'transfer',
    quantity: 1,
    cellarId,
    toCellarId,
    unitPrice: null,
    note: '',
  })
  const out = [transfer(moved, from, to)]
  if (swapped) out.push(transfer(swapped, to, from))
  return out
}

/** The cellar whose stock drops when `m` is deleted from the history, or null. */
export function cellarLosing(m: Movement): string | null {
  if (m.kind === 'add') return m.cellarId
  if (m.kind === 'transfer') return m.toCellarId
  return null
}

/**
 * Placements no longer backed by data: unknown wine or rack, outside the
 * rack, or beyond the bottles in stock. Extra bottles leave from the last slots.
 */
export function stalePlacements(wineIds: Set<string>, racks: Rack[], placements: Placement[], stock: Stock): Placement[] {
  const rackById = new Map(racks.map((r) => [r.id, r]))
  const stale: Placement[] = []
  const kept = new Map<string, Placement[]>()
  for (const p of [...placements].sort(bySlot(racks))) {
    const rack = rackById.get(p.rackId)
    if (!rack || !wineIds.has(p.wineId) || !fits(rack, p)) {
      stale.push(p)
      continue
    }
    const key = `${p.wineId}\n${rack.cellarId}`
    const list = kept.get(key) ?? []
    if (list.length < bottlesOf(stock, p.wineId, rack.cellarId)) {
      list.push(p)
      kept.set(key, list)
    } else stale.push(p)
  }
  return stale
}

function bySlot(racks: Rack[]): (a: Placement, b: Placement) => number {
  const position = new Map(racks.map((r) => [r.id, r.position]))
  return (a, b) =>
    (position.get(a.rackId) ?? 0) - (position.get(b.rackId) ?? 0) ||
    a.rackId.localeCompare(b.rackId) ||
    a.layer - b.layer ||
    a.row - b.row ||
    a.column - b.column
}
