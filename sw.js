self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // basic fetch listener for PWA support
  e.respondWith(fetch(e.request).catch(() => new Response('Offline')));
});
