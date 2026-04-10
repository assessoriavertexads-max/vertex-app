// Service Worker - Network First (sem cache de assets)
// Sempre busca a versão mais recente do servidor

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpa todos os caches antigos
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.map((name) => caches.delete(name)))
    ).then(() => self.clients.claim())
  );
});

// Sempre vai para a rede — sem cache
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
