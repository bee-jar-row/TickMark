/* TickMark service worker — receives start-by alerts from the server even when the app is closed. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'TickMark', body: event.data?.text() }; }

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = wins.find((c) => c.visibilityState === 'visible');
    // App is open and on screen: let the page show its own big alert (sound + vibration).
    if (visible) visible.postMessage({ type: 'push-alert', payload: data });

    await self.registration.showNotification(data.title || 'TickMark', {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.taskId ? `task-${data.taskId}` : 'tickmark',
      renotify: true,
      requireInteraction: true,               // stays until the student acts on it
      vibrate: [500, 150, 200, 150, 500],     // long-short-long, felt in a pocket
      silent: false,
      data,
      actions: data.taskId
        ? [{ action: 'open', title: 'Open task' }, { action: 'snooze', title: 'Remind in 30 min' }]
        : [],
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  event.notification.close();

  if (event.action === 'snooze' && data.taskId) {
    event.waitUntil(
      fetch(`/api/tasks/${data.taskId}/snooze`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-id': data.userId },
        body: JSON.stringify({ minutes: 30 }),
      }).catch(() => {}),
    );
    return;
  }

  const url = data.taskId ? `/#task-${data.taskId}` : '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if ('focus' in c) {
        await c.focus();
        c.postMessage({ type: 'open-task', taskId: data.taskId });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
