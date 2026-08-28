import type { Photo, Tasting, Wine } from './types'

const DB_NAME = 'wine-track'
const DB_VERSION = 1

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
  r.onupgradeneeded = () => {
    const d = r.result
    d.createObjectStore('wines', { keyPath: 'id' })
    d.createObjectStore('tastings', { keyPath: 'id' }).createIndex('wineId', 'wineId')
    d.createObjectStore('photos', { keyPath: 'id' })
  }
  db = await req(r)
  return db
}

export async function loadAll(): Promise<{ wines: Wine[]; tastings: Tasting[] }> {
  const d = await openDb()
  const tx = d.transaction(['wines', 'tastings'])
  const [wines, tastings] = await Promise.all([
    req(tx.objectStore('wines').getAll() as IDBRequest<Wine[]>),
    req(tx.objectStore('tastings').getAll() as IDBRequest<Tasting[]>),
  ])
  return { wines, tastings }
}

export async function putWine(wine: Wine): Promise<void> {
  const d = await openDb()
  const tx = d.transaction('wines', 'readwrite')
  tx.objectStore('wines').put(wine)
  await done(tx)
}

/** Deletes the wine plus its tastings and photo in one transaction. */
export async function deleteWine(wine: Wine): Promise<void> {
  const d = await openDb()
  const tx = d.transaction(['wines', 'tastings', 'photos'], 'readwrite')
  tx.objectStore('wines').delete(wine.id)
  if (wine.photoId) tx.objectStore('photos').delete(wine.photoId)
  const index = tx.objectStore('tastings').index('wineId')
  const keys = await req(index.getAllKeys(wine.id))
  for (const key of keys) tx.objectStore('tastings').delete(key)
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
export async function replaceAll(wines: Wine[], tastings: Tasting[], photos: Photo[]): Promise<void> {
  const d = await openDb()
  const tx = d.transaction(['wines', 'tastings', 'photos'], 'readwrite')
  for (const name of ['wines', 'tastings', 'photos'] as const) tx.objectStore(name).clear()
  for (const w of wines) tx.objectStore('wines').put(w)
  for (const t of tastings) tx.objectStore('tastings').put(t)
  for (const p of photos) tx.objectStore('photos').put(p)
  await done(tx)
}
