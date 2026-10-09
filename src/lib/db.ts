import { defaultCellar, migrateWinesV1, type WineV1 } from './migrate'
import type { Cellar, Movement, Photo, Placement, Rack, Tasting, Wine } from './types'

const DB_NAME = 'wine-track'
const DB_VERSION = 3

let db: IDBDatabase | null = null

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/**
 * Opens the database. `onblocked` runs while a tab still holding an older
 * version keeps the upgrade from starting.
 */
export async function openDb(onblocked?: () => void): Promise<IDBDatabase> {
  if (db) return db
  const r = indexedDB.open(DB_NAME, DB_VERSION)
  r.onupgradeneeded = (e) => upgrade(r.result, r.transaction!, e.oldVersion)
  r.onblocked = () => onblocked?.()
  const opened = await req(r)
  // A newer version opened in another tab: this code no longer matches the schema.
  opened.onversionchange = () => {
    opened.close()
    db = null
    location.reload()
  }
  db = opened
  return db
}

/** Creates and migrates the stores of a database at `oldVersion` up to DB_VERSION. */
export function upgrade(d: IDBDatabase, tx: IDBTransaction, oldVersion: number): void {
  if (oldVersion < 1) {
    d.createObjectStore('wines', { keyPath: 'id' })
    d.createObjectStore('tastings', { keyPath: 'id' }).createIndex('wineId', 'wineId')
    d.createObjectStore('photos', { keyPath: 'id' })
  }
  if (oldVersion < 2) {
    d.createObjectStore('cellars', { keyPath: 'id' }).put(defaultCellar())
    d.createObjectStore('movements', { keyPath: 'id' }).createIndex('wineId', 'wineId')
    const wines = tx.objectStore('wines')
    wines.getAll().onsuccess = (ev) => {
      const old = (ev.target as IDBRequest<WineV1[]>).result
      const migrated = migrateWinesV1(old)
      for (const w of migrated.wines) wines.put(w)
      for (const m of migrated.movements) tx.objectStore('movements').put(m)
    }
  }
  if (oldVersion < 3) {
    d.createObjectStore('racks', { keyPath: 'id' }).createIndex('cellarId', 'cellarId')
    const placements = d.createObjectStore('placements', { keyPath: 'id' })
    placements.createIndex('rackId', 'rackId')
    placements.createIndex('wineId', 'wineId')
  }
}

export interface Data {
  wines: Wine[]
  tastings: Tasting[]
  cellars: Cellar[]
  movements: Movement[]
  racks: Rack[]
  placements: Placement[]
}

export async function loadAll(onblocked?: () => void): Promise<Data> {
  const d = await openDb(onblocked)
  const tx = d.transaction(['wines', 'tastings', 'cellars', 'movements', 'racks', 'placements'])
  const [wines, tastings, cellars, movements, racks, placements] = await Promise.all([
    req(tx.objectStore('wines').getAll() as IDBRequest<Wine[]>),
    req(tx.objectStore('tastings').getAll() as IDBRequest<Tasting[]>),
    req(tx.objectStore('cellars').getAll() as IDBRequest<Cellar[]>),
    req(tx.objectStore('movements').getAll() as IDBRequest<Movement[]>),
    req(tx.objectStore('racks').getAll() as IDBRequest<Rack[]>),
    req(tx.objectStore('placements').getAll() as IDBRequest<Placement[]>),
  ])
  return { wines, tastings, cellars, movements, racks, placements }
}

export async function putWine(wine: Wine): Promise<void> {
  const d = await openDb()
  const tx = d.transaction('wines', 'readwrite')
  tx.objectStore('wines').put(wine)
  await done(tx)
}

/** Deletes the wine plus its tastings, movements, placements and photo in one transaction. */
export async function deleteWine(wine: Wine): Promise<void> {
  const d = await openDb()
  const tx = d.transaction(['wines', 'tastings', 'movements', 'placements', 'photos'], 'readwrite')
  tx.objectStore('wines').delete(wine.id)
  if (wine.photoId) tx.objectStore('photos').delete(wine.photoId)
  for (const name of ['tastings', 'movements', 'placements'] as const) {
    const keys = await req(tx.objectStore(name).index('wineId').getAllKeys(wine.id))
    for (const key of keys) tx.objectStore(name).delete(key)
  }
  await done(tx)
}

/** Records movements and empties the slots of the bottles that left, atomically. */
export async function putMovements(movements: Movement[], freed: string[] = []): Promise<void> {
  const d = await openDb()
  const tx = d.transaction(['movements', 'placements'], 'readwrite')
  for (const m of movements) tx.objectStore('movements').put(m)
  for (const id of freed) tx.objectStore('placements').delete(id)
  await done(tx)
}

export async function deleteMovement(id: string): Promise<void> {
  const d = await openDb()
  const tx = d.transaction('movements', 'readwrite')
  tx.objectStore('movements').delete(id)
  await done(tx)
}

export async function putCellars(cellars: Cellar[]): Promise<void> {
  const d = await openDb()
  const tx = d.transaction('cellars', 'readwrite')
  for (const c of cellars) tx.objectStore('cellars').put(c)
  await done(tx)
}

/** Deletes a cellar and its racks after recording the movements that empty it, atomically. */
export async function deleteCellar(id: string, emptying: Movement[]): Promise<void> {
  const d = await openDb()
  const tx = d.transaction(['cellars', 'movements', 'racks', 'placements'], 'readwrite')
  for (const m of emptying) tx.objectStore('movements').put(m)
  tx.objectStore('cellars').delete(id)
  const rackIds = await req(tx.objectStore('racks').index('cellarId').getAllKeys(id))
  for (const rackId of rackIds) deleteRackIn(tx, rackId as string)
  await done(tx)
}

/** Saves racks and removes the placements a resize left outside them, atomically. */
export async function putRacks(racks: Rack[], dropped: string[] = []): Promise<void> {
  const d = await openDb()
  const tx = d.transaction(['racks', 'placements'], 'readwrite')
  for (const r of racks) tx.objectStore('racks').put(r)
  for (const id of dropped) tx.objectStore('placements').delete(id)
  await done(tx)
}

export async function deleteRack(id: string): Promise<void> {
  const d = await openDb()
  const tx = d.transaction(['racks', 'placements'], 'readwrite')
  deleteRackIn(tx, id)
  await done(tx)
}

function deleteRackIn(tx: IDBTransaction, id: string) {
  tx.objectStore('racks').delete(id)
  const placements = tx.objectStore('placements')
  placements.index('rackId').getAllKeys(id).onsuccess = (e) => {
    for (const key of (e.target as IDBRequest<IDBValidKey[]>).result) placements.delete(key)
  }
}

export async function updatePlacements(put: Placement[], remove: string[]): Promise<void> {
  const d = await openDb()
  const tx = d.transaction('placements', 'readwrite')
  for (const id of remove) tx.objectStore('placements').delete(id)
  for (const p of put) tx.objectStore('placements').put(p)
  await done(tx)
}

export async function putTasting(tasting: Tasting): Promise<void> {
  const d = await openDb()
  const tx = d.transaction('tastings', 'readwrite')
  tx.objectStore('tastings').put(tasting)
  await done(tx)
}

export async function deleteTasting(id: string): Promise<void> {
  const d = await openDb()
  const tx = d.transaction('tastings', 'readwrite')
  tx.objectStore('tastings').delete(id)
  await done(tx)
}

export async function putPhoto(photo: Photo): Promise<void> {
  const d = await openDb()
  const tx = d.transaction('photos', 'readwrite')
  tx.objectStore('photos').put(photo)
  await done(tx)
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  const d = await openDb()
  const tx = d.transaction('photos')
  return req(tx.objectStore('photos').get(id) as IDBRequest<Photo | undefined>)
}

export async function getAllPhotos(): Promise<Photo[]> {
  const d = await openDb()
  const tx = d.transaction('photos')
  return req(tx.objectStore('photos').getAll() as IDBRequest<Photo[]>)
}

/** Replaces the entire database content in one transaction (backup import). */
export async function replaceAll(data: Data, photos: Photo[]): Promise<void> {
  const d = await openDb()
  const names = ['wines', 'tastings', 'cellars', 'movements', 'racks', 'placements', 'photos'] as const
  const tx = d.transaction(names, 'readwrite')
  for (const name of names) tx.objectStore(name).clear()
  for (const w of data.wines) tx.objectStore('wines').put(w)
  for (const t of data.tastings) tx.objectStore('tastings').put(t)
  for (const c of data.cellars) tx.objectStore('cellars').put(c)
  for (const m of data.movements) tx.objectStore('movements').put(m)
  for (const r of data.racks) tx.objectStore('racks').put(r)
  for (const p of data.placements) tx.objectStore('placements').put(p)
  for (const p of photos) tx.objectStore('photos').put(p)
  await done(tx)
}
