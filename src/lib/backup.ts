import { z } from 'zod'
import type { Data } from './db'
import { defaultCellar, migrateWinesV1 } from './migrate'
import { MAX_COLUMNS, MAX_DEPTH, MAX_ROWS } from './racks'
import { RACK_LAYOUTS } from './types'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const WineV1Schema = z.object({
  id: z.string(),
  name: z.string(),
  producer: z.string(),
  vintage: z.number().int().nullable(),
  grapes: z.array(z.string()),
  region: z.string(),
  country: z.string(),
  color: z.enum(['red', 'white', 'rose', 'orange', 'sparkling', 'sweet', 'fortified', 'other']),
  photoId: z.string().nullable(),
  bottlesOwned: z.number().int().min(0),
  drinkBy: z.string().nullable(),
  tasteAgainOn: z.string().nullable(),
  createdAt: z.number(),
})

const WineSchema = WineV1Schema.omit({ bottlesOwned: true }).extend({
  sizeCl: z.number().positive(),
  tags: z.array(z.string()),
  wished: z.boolean(),
  value: z.number().min(0).nullable(),
  valueHistory: z.array(z.object({ date, value: z.number().min(0) })),
})

const TastingSchema = z.object({
  id: z.string(),
  wineId: z.string(),
  date: z.string(),
  rating: z.number(),
  notes: z.string(),
})

const CellarSchema = z.object({ id: z.string(), name: z.string(), position: z.number() })

const MovementSchema = z.object({
  id: z.string(),
  wineId: z.string(),
  date,
  kind: z.enum(['add', 'consume', 'gift', 'adjust', 'transfer']),
  quantity: z.number().int().positive(),
  cellarId: z.string(),
  toCellarId: z.string().nullable(),
  unitPrice: z.number().min(0).nullable(),
  note: z.string(),
})

const RackSchema = z.object({
  id: z.string(),
  cellarId: z.string(),
  name: z.string(),
  columns: z.number().int().min(1).max(MAX_COLUMNS),
  rows: z.number().int().min(1).max(MAX_ROWS),
  depth: z.number().int().min(1).max(MAX_DEPTH),
  layout: z.enum(RACK_LAYOUTS),
  position: z.number(),
})

const PlacementSchema = z.object({
  id: z.string(),
  rackId: z.string(),
  layer: z.number().int().min(0),
  row: z.number().int().min(0),
  column: z.number().int().min(0),
  wineId: z.string(),
})

const PhotoSchema = z.object({ id: z.string(), mediaType: z.string(), data: z.string() })

const BackupV1Schema = z.object({
  app: z.literal('wine-track'),
  version: z.literal(1),
  exportedAt: z.string(),
  wines: z.array(WineV1Schema),
  tastings: z.array(TastingSchema),
  photos: z.array(PhotoSchema),
})

const BackupSchema = z.object({
  app: z.literal('wine-track'),
  version: z.literal(2),
  exportedAt: z.string(),
  wines: z.array(WineSchema),
  tastings: z.array(TastingSchema),
  cellars: z.array(CellarSchema).min(1),
  movements: z.array(MovementSchema),
  racks: z.array(RackSchema).default([]),
  placements: z.array(PlacementSchema).default([]),
  photos: z.array(PhotoSchema),
})

export type Backup = z.infer<typeof BackupSchema>
export type BackupPhoto = Backup['photos'][number]

export function serializeBackup(data: Data, photos: BackupPhoto[], exportedAt: string): string {
  const backup: Backup = { app: 'wine-track', version: 2, exportedAt, ...data, photos }
  return JSON.stringify(backup)
}

/** Parses a backup of any known version, upgraded to the current format; null if invalid. */
export function parseBackup(json: string): Backup | null {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  const current = BackupSchema.safeParse(raw)
  if (current.success) return current.data
  const v1 = BackupV1Schema.safeParse(raw)
  if (!v1.success) return null
  const { wines, movements } = migrateWinesV1(v1.data.wines)
  return { ...v1.data, version: 2, wines, movements, cellars: [defaultCellar()], racks: [], placements: [] }
}
