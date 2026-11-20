// Loaded into the app's service worker. Shows the lock screen alerts the push server sends.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cut Tracker', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'cut-tracker-session',
      renotify: true,
      requireInteraction: false,
      data: { url: `${self.registration.scope}#workout` },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows[0];
      if (open) return open.focus();
      return self.clients.openWindow(url || self.registration.scope);
    }),
  );
});
