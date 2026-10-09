import type { en } from './messages/io'
import { averageBuyPrices, computeStock } from './stock'
import type { Cellar, Movement, Wine } from './types'

export interface InventoryLine {
  wine: Wine
  quantity: number
  /** Average purchase price per bottle. */
  purchase: number | null
  /** Estimated value per bottle. */
  value: number | null
}

export interface Totals {
  bottles: number
  /** Sum over bottles with a known purchase price. */
  purchase: number
  /** Sum over bottles with an estimated value. */
  value: number
}

export interface InventoryCellar extends Totals {
  cellarId: string
  lines: InventoryLine[]
}

export interface Inventory extends Totals {
  cellars: InventoryCellar[]
  /** Lines with neither a purchase price nor an estimated value. */
  unpriced: (InventoryLine & { cellarId: string })[]
}

function add(t: Totals, line: InventoryLine) {
  t.bottles += line.quantity
  t.purchase += (line.purchase ?? 0) * line.quantity
  t.value += (line.value ?? 0) * line.quantity
}

/** Bottles in stock per cellar, in cellar order, with their prices and totals. */
export function buildInventory(wines: Wine[], movements: Movement[], cellars: Cellar[]): Inventory {
  const stock = computeStock(movements)
  const prices = averageBuyPrices(movements)
  const sorted = [...wines].sort(
    (a, b) => a.producer.localeCompare(b.producer) || a.name.localeCompare(b.name) || (a.vintage ?? 0) - (b.vintage ?? 0),
  )
  const inv: Inventory = { cellars: [], unpriced: [], bottles: 0, purchase: 0, value: 0 }
  for (const cellar of [...cellars].sort((a, b) => a.position - b.position)) {
    const group: InventoryCellar = { cellarId: cellar.id, lines: [], bottles: 0, purchase: 0, value: 0 }
    for (const wine of sorted) {
      const quantity = stock.get(wine.id)?.get(cellar.id) ?? 0
      if (quantity <= 0) continue
      const line = { wine, quantity, purchase: prices.get(wine.id) ?? null, value: wine.value }
      group.lines.push(line)
      add(group, line)
      add(inv, line)
      if (line.purchase === null && line.value === null) inv.unpriced.push({ ...line, cellarId: cellar.id })
    }
    if (group.lines.length > 0) inv.cellars.push(group)
  }
  return inv
}

export type InventoryKey = Extract<keyof typeof en, `io.doc.${string}`>

export interface RenderOptions {
  owner: string
  address: string
  /** Display date of the document. */
  date: string
  lang: string
  t: (key: InventoryKey) => string
  money: (amount: number) => string
  cellarName: (id: string) => string
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** A standalone, print-friendly HTML document of the inventory. */
export function renderInventory(inv: Inventory, o: RenderOptions): string {
  const t = (key: InventoryKey) => escape(o.t(key))
  const amount = (n: number | null) => (n === null ? '—' : escape(o.money(n)))
  const wineCell = (w: Wine) =>
    `<strong>${escape(w.producer)}</strong>${w.producer && w.name ? ' · ' : ''}${escape(w.name)}` +
    (w.region || w.country ? `<br><small>${escape([w.region, w.country].filter(Boolean).join(', '))}</small>` : '')
  const head = `<tr><th>${t('io.doc.wine')}</th><th>${t('io.doc.vintage')}</th><th>${t('io.doc.size')}</th><th class="n">${t('io.doc.quantity')}</th><th class="n">${t('io.doc.purchase')}</th><th class="n">${t('io.doc.value')}</th><th class="n">${t('io.doc.lineValue')}</th></tr>`
  const row = (l: InventoryLine) =>
    `<tr><td>${wineCell(l.wine)}</td><td>${l.wine.vintage ?? t('io.doc.nv')}</td><td>${l.wine.sizeCl} cl</td><td class="n">${l.quantity}</td><td class="n">${amount(l.purchase)}</td><td class="n">${amount(l.value)}</td><td class="n">${amount(l.value === null ? null : l.value * l.quantity)}</td></tr>`
  const cellars = inv.cellars
    .map(
      (c) => `<section><h2>${escape(o.cellarName(c.cellarId))}</h2><table><thead>${head}</thead><tbody>${c.lines.map(row).join('')}</tbody>
<tfoot><tr><td colspan="3">${t('io.doc.total')}</td><td class="n">${c.bottles}</td><td class="n">${amount(c.purchase)}</td><td></td><td class="n">${amount(c.value)}</td></tr></tfoot></table></section>`,
    )
    .join('\n')
  const unpriced =
    inv.unpriced.length === 0
      ? `<p>${t('io.doc.unpricedNone')}</p>`
      : `<ul>${inv.unpriced.map((l) => `<li>${l.quantity} × ${wineCell(l.wine).replace('<br>', ' ')} ${l.wine.vintage ?? t('io.doc.nv')} — ${escape(o.cellarName(l.cellarId))}</li>`).join('')}</ul>`
  const unpricedBottles = inv.unpriced.reduce((n, l) => n + l.quantity, 0)

  return `<!doctype html>
<html lang="${escape(o.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t('io.doc.title')} — ${escape(o.date)}</title>
<style>
body { font: 11pt/1.4 system-ui, sans-serif; color: #000; background: #fff; margin: 1.5rem; }
h1 { font-size: 1.5rem; margin: 0 0 1rem; }
h2 { font-size: 1.1rem; margin: 1.5rem 0 0.4rem; border-bottom: 1px solid #000; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 1rem; margin: 0; }
dt { font-weight: 600; }
dd { margin: 0; white-space: pre-line; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
th, td { border-bottom: 1px solid #bbb; padding: 0.25rem 0.35rem; text-align: left; vertical-align: top; }
th { background: #eee; }
tfoot td { font-weight: 700; border-top: 2px solid #000; }
.n { text-align: right; white-space: nowrap; }
small { color: #444; }
.disclaimer { margin-top: 2rem; font-size: 9pt; color: #333; border-top: 1px solid #bbb; padding-top: 0.5rem; }
.print { position: fixed; top: 1rem; right: 1rem; padding: 0.5rem 1rem; font: inherit; }
section { break-inside: auto; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
@media print { .print { display: none; } body { margin: 0; } }
</style>
</head>
<body>
<button class="print" onclick="print()">${t('io.doc.print')}</button>
<h1>${t('io.doc.title')}</h1>
<dl>
<dt>${t('io.doc.owner')}</dt><dd>${escape(o.owner) || '—'}</dd>
<dt>${t('io.doc.address')}</dt><dd>${escape(o.address) || '—'}</dd>
<dt>${t('io.doc.date')}</dt><dd>${escape(o.date)}</dd>
</dl>
<h2>${t('io.doc.summary')}</h2>
<dl>
<dt>${t('io.doc.bottles')}</dt><dd>${inv.bottles}</dd>
<dt>${t('io.doc.purchaseTotal')}</dt><dd>${amount(inv.purchase)}</dd>
<dt>${t('io.doc.valueTotal')}</dt><dd>${amount(inv.value)}</dd>
<dt>${t('io.doc.unpriced')}</dt><dd>${unpricedBottles}</dd>
</dl>
${inv.cellars.length === 0 ? `<p>${t('io.doc.empty')}</p>` : cellars}
<h2>${t('io.doc.unpriced')}</h2>
${unpriced}
<p class="disclaimer">${t('io.doc.disclaimer')}</p>
</body>
</html>
`
}
