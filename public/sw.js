// Bump on any change to an unhashed public file (icons, manifest, favicon): assets are served cache-first.
const CACHE = 'wine-track-v2'
const SHELL = new URL('.', self.registration.scope).pathname

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Navigations: network-first so new deploys are picked up, cached shell offline.
// Same-origin assets: cache-first — Vite filenames are hashed, public files are versioned by query and CACHE.
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy))
          return response
        })
        .catch(() => caches.match(SHELL)),
    )
    return
  }

  const url = new URL(request.url)
  if (url.origin !== location.origin) return
  // The wine names database lives in IndexedDB once downloaded; caching it too would double its size and hide updates.
  if (url.pathname.startsWith(`${SHELL}lwin/`)) return

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
