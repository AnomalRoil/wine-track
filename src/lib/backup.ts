import { z } from 'zod'
import type { Tasting, Wine } from './types'

const WineSchema = z.object({
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

const TastingSchema = z.object({
  id: z.string(),
  wineId: z.string(),
  date: z.string(),
  rating: z.number(),
  notes: z.string(),
})

const BackupSchema = z.object({
  app: z.literal('wine-track'),
  version: z.literal(1),
  exportedAt: z.string(),
  wines: z.array(WineSchema),
  tastings: z.array(TastingSchema),
  photos: z.array(z.object({ id: z.string(), mediaType: z.string(), data: z.string() })),
})

export type Backup = z.infer<typeof BackupSchema>
export type BackupPhoto = Backup['photos'][number]

export function serializeBackup(
  wines: Wine[],
  tastings: Tasting[],
  photos: BackupPhoto[],
  exportedAt: string,
): string {
  const backup: Backup = { app: 'wine-track', version: 1, exportedAt, wines, tastings, photos }
  return JSON.stringify(backup)
}

export function parseBackup(json: string): Backup | null {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  const result = BackupSchema.safeParse(raw)
  return result.success ? result.data : null
}
