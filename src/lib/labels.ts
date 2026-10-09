import { t } from './i18n.svelte'
import { store } from './store.svelte'
import { BOTTLE_SIZES, type Wine } from './types'

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

/** "Name 2015", falling back to the producer when the wine has no name. */
export function wineLabel(w: Wine): string {
  return [w.name || w.producer, w.vintage].filter(Boolean).join(' ')
}
