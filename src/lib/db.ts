import { defaultCellar, migrateWinesV1, type WineV1 } from './migrate'
import type { Cellar, Movement, Photo, Tasting, Wine } from './types'

const DB_NAME = 'wine-track'
const DB_VERSION = 2

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

export async function openDb(): Promise<IDBDatabase> {
  if (db) return db
  const r = indexedDB.open(DB_NAME, DB_VERSION)
  r.onupgradeneeded = (e) => {
    const d = r.result
    const tx = r.transaction!
    if (e.oldVersion < 1) {
      d.createObjectStore('wines', { keyPath: 'id' })
      d.createObjectStore('tastings', { keyPath: 'id' }).createIndex('wineId', 'wineId')
      d.createObjectStore('photos', { keyPath: 'id' })
    }
    if (e.oldVersion < 2) {
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
  }
  db = await req(r)
  return db
}

export interface Data {
  wines: Wine[]
  tastings: Tasting[]
  cellars: Cellar[]
  movements: Movement[]
}

export async function loadAll(): Promise<Data> {
  const d = await openDb()
  const tx = d.transaction(['wines', 'tastings', 'cellars', 'movements'])
  const [wines, tastings, cellars, movements] = await Promise.all([
    req(tx.objectStore('wines').getAll() as IDBRequest<Wine[]>),
    req(tx.objectStore('tastings').getAll() as IDBRequest<Tasting[]>),
    req(tx.objectStore('cellars').getAll() as IDBRequest<Cellar[]>),
    req(tx.objectStore('movements').getAll() as IDBRequest<Movement[]>),
  ])
  return { wines, tastings, cellars, movements }
}

export async function putWine(wine: Wine): Promise<void> {
  const d = await openDb()
  const tx = d.transaction('wines', 'readwrite')
  tx.objectStore('wines').put(wine)
  await done(tx)
}

/** Deletes the wine plus its tastings, movements and photo in one transaction. */
export async function deleteWine(wine: Wine): Promise<void> {
  const d = await openDb()
  const tx = d.transaction(['wines', 'tastings', 'movements', 'photos'], 'readwrite')
  tx.objectStore('wines').delete(wine.id)
  if (wine.photoId) tx.objectStore('photos').delete(wine.photoId)
  for (const name of ['tastings', 'movements'] as const) {
    const keys = await req(tx.objectStore(name).index('wineId').getAllKeys(wine.id))
    for (const key of keys) tx.objectStore(name).delete(key)
  }
  await done(tx)
}

export async function putMovements(movements: Movement[]): Promise<void> {
  const d = await openDb()
  const tx = d.transaction('movements', 'readwrite')
  for (const m of movements) tx.objectStore('movements').put(m)
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

/** Deletes a cellar after recording the movements that empty it, atomically. */
export async function deleteCellar(id: string, emptying: Movement[]): Promise<void> {
  const d = await openDb()
  const tx = d.transaction(['cellars', 'movements'], 'readwrite')
  for (const m of emptying) tx.objectStore('movements').put(m)
  tx.objectStore('cellars').delete(id)
  await done(tx)
}

/** Adds the wines, cellars and movements of an import in one transaction. */
export async function putImport(data: Omit<Data, 'tastings'>): Promise<void> {
  const d = await openDb()
  const tx = d.transaction(['wines', 'cellars', 'movements'], 'readwrite')
  for (const w of data.wines) tx.objectStore('wines').put(w)
  for (const c of data.cellars) tx.objectStore('cellars').put(c)
  for (const m of data.movements) tx.objectStore('movements').put(m)
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
  const names = ['wines', 'tastings', 'cellars', 'movements', 'photos'] as const
  const tx = d.transaction(names, 'readwrite')
  for (const name of names) tx.objectStore(name).clear()
  for (const w of data.wines) tx.objectStore('wines').put(w)
  for (const t of data.tastings) tx.objectStore('tastings').put(t)
  for (const c of data.cellars) tx.objectStore('cellars').put(c)
  for (const m of data.movements) tx.objectStore('movements').put(m)
  for (const p of photos) tx.objectStore('photos').put(p)
  await done(tx)
}
