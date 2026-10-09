import { t } from './i18n.svelte'
import { store } from './store.svelte'
import { slotName } from './racks'
import { BOTTLE_SIZES, type Placement, type Rack } from './types'

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
