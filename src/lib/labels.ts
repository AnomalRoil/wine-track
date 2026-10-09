import { t, type MessageKey } from './i18n.svelte'
import { store } from './store.svelte'
import { slotName } from './racks'
import { aromaFamily, type ScaleName } from './tasting'
import { BOTTLE_SIZES, type Placement, type Rack, type Wine } from './types'

export function cellarName(id: string): string {
  const cellar = store.cellars.find((c) => c.id === id)
  if (!cellar) return t('cellar.deleted')
  return cellar.name || t('cellar.default')
}

/** "Magnum · 150 cl", or "70 cl" for a volume without a name. */
export function sizeLabel(cl: number): string {
  const size = BOTTLE_SIZES.find((s) => s.cl === cl)
  return size ? `${t(`size.${size.name}`)} · ${cl} cl` : `${cl} cl`
}

export function answerLabel(name: ScaleName, value: string): string {
  return t(`tasting.${name}.${value}` as MessageKey)
}

/** Localized aroma name; aromas outside the picker are shown as stored. */
export function aromaLabel(id: string): string {
  return aromaFamily(id) ? t(`tasting.aroma.${id}` as MessageKey) : id
}

/** "Name 2015", falling back to the producer when the wine has no name. */
export function wineLabel(w: Wine): string {
  return [w.name || w.producer, w.vintage].filter(Boolean).join(' ')
}

export function rackName(rack: Rack): string {
  if (rack.name) return rack.name
  const siblings = store.racks.filter((r) => r.cellarId === rack.cellarId).sort((a, b) => a.position - b.position)
  return t('rack.unnamed', { n: siblings.findIndex((r) => r.id === rack.id) + 1 })
}

/** "B3", or "B3 at the back" for the back layer of a two-layer rack. */
export function slotLabel(slot: Pick<Placement, 'layer' | 'row' | 'column'>): string {
  const name = slotName(slot)
  return slot.layer > 0 ? t('rack.slotBack', { slot: name }) : name
}

/** "Left wall · B3", for a slot shown outside its rack. */
export function placementLabel(p: Placement): string {
  const rack = store.racks.find((r) => r.id === p.rackId)
  return rack ? `${rackName(rack)} · ${slotLabel(p)}` : slotLabel(p)
}
