import type { Movement, Tasting, Wine } from './types'

export type JournalEntry =
  | { type: 'movement'; date: string; wine: Wine | undefined; movement: Movement }
  | { type: 'tasting'; date: string; wine: Wine | undefined; tasting: Tasting }

function tastingText(t: Tasting): string[] {
  const s = t.sheet
  return s ? [t.notes, ...s.people, s.place, s.meal, s.conclusion] : [t.notes]
}

/** Stock movements and tastings, newest first, optionally narrowed by a wine-name search. */
export function journal(wines: Wine[], movements: Movement[], tastings: Tasting[], search: string): JournalEntry[] {
  const byId = new Map(wines.map((w) => [w.id, w]))
  const entries: JournalEntry[] = [
    ...movements.map((m) => ({ type: 'movement' as const, date: m.date, wine: byId.get(m.wineId), movement: m })),
    ...tastings.map((t) => ({ type: 'tasting' as const, date: t.date, wine: byId.get(t.wineId), tasting: t })),
  ]
  const q = search.trim().toLowerCase()
  const matching = q
    ? entries.filter((e) => {
        const w = e.wine
        const text = e.type === 'movement' ? [e.movement.note] : tastingText(e.tasting)
        return [w?.name, w?.producer, w?.vintage, ...text].join(' ').toLowerCase().includes(q)
      })
    : entries
  // Entries carry only a day; reversing first keeps the latest-recorded on top within a day.
  return matching.reverse().sort((a, b) => b.date.localeCompare(a.date))
}
