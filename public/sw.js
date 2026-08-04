const CACHE_NAME = 'owa-shell-v1'
const SHELL = ['/', '/app-icon.svg']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  // Live API, authentication, uploads, and mutations must always reach the
  // server. The PWA only caches the navigation shell and static assets.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone()
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
      return response
    }).catch(() => caches.match(request).then(cached => cached || caches.match('/'))))
    return
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/app-icon.svg') {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone()
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
      return response
    })))
  }
})

// The push service delivers a JSON payload (see src/lib/webPush.ts) with
// title/body/url/tag/icon. tag lets a second notification about the same
// thing (e.g. two messages in one conversation) replace the first instead
// of stacking, url is where notificationclick below should land.
self.addEventListener('push', event => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: 'Oringe Waswa & Akude', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Oringe Waswa & Akude', {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag,
      data: { url: payload.url || '/' },
    })
  )
})

// Focuses an already-open tab on the target URL rather than always opening
// a new one, so tapping three notifications in a row doesn't pile up three
// tabs.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})
