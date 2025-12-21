const CACHE_NAME = 'chess-app-v1'
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/vite.svg',
]

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    )
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME ? caches.delete(k) : null)))
    )
    self.clients.claim()
})

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return

    // Navigation requests (user typing URL or using SPA navigation) should
    // return the cached index.html when offline to avoid 404 in installed PWA.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/index.html'))
        )
        return
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached
            return fetch(event.request).then((resp) => {
                if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp
                const respClone = resp.clone()
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone))
                return resp
            })
        }).catch(() => fetch(event.request))
    )
})
