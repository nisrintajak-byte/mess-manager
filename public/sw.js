/* Mess Manager service worker: shows phone notifications sent by the server even when the site
   is closed, and opens the app when one is tapped. Nothing is cached here. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Mess Manager', {
      body: d.body || '',
      tag: d.tag,
      dir: d.dir || 'auto',
      lang: d.lang || '',
      icon: self.registration.scope + 'favicon.ico',
      data: { room_id: d.room_id || null },
      // New Need Request with the special alert on: stays on screen until tapped or swiped away,
      // and vibrates longer (browsers do not allow a custom sound here).
      requireInteraction: !!d.loud,
      renotify: !!d.loud && !!d.tag,
      vibrate: d.loud ? [600, 250, 600, 250, 1000] : undefined,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const scope = self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(scope) && 'focus' in c) return c.focus();
      return self.clients.openWindow(scope);
    }),
  );
});
