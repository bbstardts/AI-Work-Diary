const CACHE_NAME = 'work-diary-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Real background push - the OS wakes this up even if the app/tab is fully closed.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Don't forget today's diary entry", body: event.data ? event.data.text() : '' };
  }
  const title = data.title || "Don't forget today's diary entry";
  const options = {
    body: data.body || "You haven't logged today's work yet — tap to add it.",
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'wda-daily-reminder'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping a reminder notification opens (or focuses) the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    })
  );
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache API calls - always go to network for fresh data/auth.
  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => cached)
      );
    })
  );
});
