import { toCsv } from './csv'
import { COLUMNS, HEADERS } from './csvImport'
import { averageBuyPrices, computeStock } from './stock'
import type { Cellar, Movement, Wine } from './types'

function byLabel(a: Wine, b: Wine): number {
  return a.producer.localeCompare(b.producer) || a.name.localeCompare(b.name) || (a.vintage ?? 0) - (b.vintage ?? 0)
}

/**
 * The collection in import-template columns: one row per wine and cellar
 * holding it, plus one row without cellar for each wine out of stock, so a
 * re-import recreates the same wines.
 */
export function exportCsv(wines: Wine[], movements: Movement[], cellars: Cellar[], cellarName: (id: string) => string): string {
  const stock = computeStock(movements)
  const prices = averageBuyPrices(movements)
  const order = [...cellars].sort((a, b) => a.position - b.position).map((c) => c.id)
  const rows: (string | number | null)[][] = [COLUMNS.map((c) => HEADERS[c])]

  const line = (wine: Wine, cellarId: string | null, quantity: number) => {
    const notes = movements
      .filter((m) => m.wineId === wine.id && m.kind === 'add' && m.note && (cellarId === null || m.cellarId === cellarId))
      .map((m) => m.note)
    const price = prices.get(wine.id)
    rows.push([
      cellarId === null ? '' : cellarName(cellarId),
      wine.name,
      wine.producer,
      wine.vintage,
      quantity,
      wine.sizeCl,
      wine.color,
      wine.region,
      wine.country,
      wine.grapes.join(', '),
      price === undefined ? null : Math.round(price * 100) / 100,
      [...new Set(notes)].join(' / '),
      wine.tags.join(', '),
    ])
  }

  const sorted = [...wines].sort(byLabel)
  for (const cellarId of order) {
    for (const wine of sorted) {
      const n = stock.get(wine.id)?.get(cellarId) ?? 0
      if (n > 0) line(wine, cellarId, n)
    }
  }
  for (const wine of sorted) {
    const inStock = [...(stock.get(wine.id)?.values() ?? [])].some((n) => n > 0)
    if (!inStock) line(wine, null, 0)
  }
  return toCsv(rows)
}

/** Header-only CSV to fill in a spreadsheet. */
export function templateCsv(): string {
  return toCsv([COLUMNS.map((c) => HEADERS[c])])
}
