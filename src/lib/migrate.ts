import { STANDARD_SIZE_CL, type Cellar, type Movement, type Wine } from './types'

/** Id of the cellar created on first run and by the v1 → v2 migration. */
export const DEFAULT_CELLAR_ID = 'main'

export function defaultCellar(): Cellar {
  return { id: DEFAULT_CELLAR_ID, name: '', position: 0, storage: {} }
}

/** A wine as stored before cellars existed: stock was a plain counter. */
export type WineV1 = Omit<Wine, 'sizeCl' | 'tags' | 'wished' | 'value' | 'valueHistory'> & {
  bottlesOwned: number
}

/** Converts v1 wines, turning each stock counter into one addition to the default cellar. */
export function migrateWinesV1(old: WineV1[]): { wines: Wine[]; movements: Movement[] } {
  const wines: Wine[] = []
  const movements: Movement[] = []
  for (const { bottlesOwned, ...rest } of old) {
    wines.push({ ...rest, sizeCl: STANDARD_SIZE_CL, tags: [], wished: false, value: null, valueHistory: [] })
    if (bottlesOwned > 0) {
      movements.push({
        id: `${rest.id}-v1`,
        wineId: rest.id,
        date: new Date(rest.createdAt).toISOString().slice(0, 10),
        kind: 'add',
        quantity: bottlesOwned,
        cellarId: DEFAULT_CELLAR_ID,
        toCellarId: null,
        unitPrice: null,
        note: '',
      })
    }
  }
  return { wines, movements }
}

/** Fills fields added to cellars after they were first stored. */
export function normalizeCellar(cellar: Omit<Cellar, 'storage'> & Partial<Cellar>): Cellar {
  return { ...cellar, storage: cellar.storage ?? {} }
}
