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
    // 仅处理 GET 且 http/https 请求；跳过 chrome-extension、ws、wss 等协议
    if (event.request.method !== 'GET') return
    const url = new URL(event.request.url)
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:'
    if (!isHttp) return

    // 跳过 socket.io 轮询与 battle 实时接口，避免错误缓存
    const skipCachePaths = [/^\/socket\.io\//, /^\/battle\//]
    if (skipCachePaths.some((re) => re.test(url.pathname))) {
        return // 让浏览器默认处理，不拦截
    }

    // Only handle http/https requests; ignore chrome-extension:, file:, data:, etc.
    try {
        const url = new URL(event.request.url)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return
    } catch {
        // If URL parsing fails, do not intercept
        return
    }

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
                // 仅缓存同源的 200 响应，避免缓存第三方与不透明响应
                if (!resp || resp.status !== 200 || resp.type !== 'basic') return resp
                const respClone = resp.clone()
                caches.open(CACHE_NAME).then((cache) => {
                    try {
                        cache.put(event.request, respClone)
                    } catch (e) {
                        // 安全兜底：若出现不支持的协议或其他错误，直接跳过缓存
                    }
                })
                return resp
            })
        }).catch(() => fetch(event.request))
    )
})
