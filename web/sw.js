// Retire the old offline shell so password checks always reach the server.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('fcl-judge-desk-')).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
// No fetch interception: an already-open counter still stores reps in IndexedDB.
