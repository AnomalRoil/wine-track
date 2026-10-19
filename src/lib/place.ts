import { identity } from './csvImport'
import type { Wine } from './types'

type Place = Pick<Wine, 'appellation' | 'region' | 'country'>

/** The appellation worth showing beside the region: '' when it is empty or repeats the region. */
export function shownAppellation(w: Pick<Wine, 'appellation' | 'region'>): string {
  const appellation = w.appellation.trim()
  return identity(appellation) === identity(w.region) ? '' : appellation
}

/** "Pauillac · Bordeaux, France", leaving out the parts a wine lacks. */
export function placeLine(w: Place): string {
  const area = [shownAppellation(w), w.region.trim()].filter(Boolean).join(' · ')
  return [area, w.country.trim()].filter(Boolean).join(', ')
}
