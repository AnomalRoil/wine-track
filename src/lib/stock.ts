import type { Movement } from './types'

/** Bottles per cellar, per wine. Cellars with no bottles left are omitted. */
export type Stock = Map<string, Map<string, number>>

export function computeStock(movements: Movement[]): Stock {
  const stock: Stock = new Map()
  const bump = (wineId: string, cellarId: string, delta: number) => {
    let cellars = stock.get(wineId)
    if (!cellars) stock.set(wineId, (cellars = new Map()))
    const n = (cellars.get(cellarId) ?? 0) + delta
    if (n === 0) cellars.delete(cellarId)
    else cellars.set(cellarId, n)
  }
  for (const m of movements) {
    switch (m.kind) {
      case 'add':
        bump(m.wineId, m.cellarId, m.quantity)
        break
      case 'transfer':
        bump(m.wineId, m.cellarId, -m.quantity)
        if (m.toCellarId) bump(m.wineId, m.toCellarId, m.quantity)
        break
      default:
        bump(m.wineId, m.cellarId, -m.quantity)
    }
  }
  return stock
}

export function bottlesOf(stock: Stock, wineId: string, cellarId?: string): number {
  const cellars = stock.get(wineId)
  if (!cellars) return 0
  if (cellarId !== undefined) return cellars.get(cellarId) ?? 0
  let total = 0
  for (const n of cellars.values()) total += n
  return total
}

/** Whether recording `movements` leaves every cellar they take bottles from at zero or more. */
export function withinStock(stock: Stock, movements: Movement[]): boolean {
  const taken = new Map<string, Map<string, number>>()
  for (const m of movements) {
    if (m.kind === 'add') continue
    const cellars = taken.get(m.wineId) ?? new Map<string, number>()
    cellars.set(m.cellarId, (cellars.get(m.cellarId) ?? 0) + m.quantity)
    taken.set(m.wineId, cellars)
  }
  for (const [wineId, cellars] of taken)
    for (const [cellarId, n] of cellars) if (bottlesOf(stock, wineId, cellarId) < n) return false
  return true
}

/** Average price paid per bottle across priced additions, or null if none is priced. */
export function averageBuyPrice(movements: Movement[], wineId: string): number | null {
  let bottles = 0
  let spent = 0
  for (const m of movements) {
    if (m.wineId !== wineId || m.kind !== 'add' || m.unitPrice === null) continue
    bottles += m.quantity
    spent += m.quantity * m.unitPrice
  }
  return bottles > 0 ? spent / bottles : null
}

/** Average buy price for every wine with at least one priced addition. */
export function averageBuyPrices(movements: Movement[]): Map<string, number> {
  const totals = new Map<string, { bottles: number; spent: number }>()
  for (const m of movements) {
    if (m.kind !== 'add' || m.unitPrice === null) continue
    const t = totals.get(m.wineId) ?? { bottles: 0, spent: 0 }
    t.bottles += m.quantity
    t.spent += m.quantity * m.unitPrice
    totals.set(m.wineId, t)
  }
  const prices = new Map<string, number>()
  for (const [wineId, t] of totals) if (t.bottles > 0) prices.set(wineId, t.spent / t.bottles)
  return prices
}

/**
 * Movements that empty `cellarId`, either by transferring every wine to
 * `targetId` or, when it is null, by recording a stock adjustment.
 */
export function emptyCellar(
  stock: Stock,
  cellarId: string,
  targetId: string | null,
  date: string,
  newId: () => string,
): Movement[] {
  const out: Movement[] = []
  for (const [wineId, cellars] of stock) {
    const quantity = cellars.get(cellarId)
    if (!quantity || quantity < 0) continue
    out.push({
      id: newId(),
      wineId,
      date,
      kind: targetId ? 'transfer' : 'adjust',
      quantity,
      cellarId,
      toCellarId: targetId,
      unitPrice: null,
      note: '',
    })
  }
  return out
}
