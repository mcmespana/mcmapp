// Service Worker — MCM App PWA
// Estrategia minimalista de runtime caching. NO precachea nada (los nombres
// de los bundles llevan hash y cambian por build, así que un precache list
// fijo se rompería en cada despliegue).

const VERSION = 'mcm-pwa-v3';
const RUNTIME_CACHE = `mcm-runtime-${VERSION}`;

// Instalación: skip waiting para activarse cuanto antes
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activación: limpia caches antiguos y reclama clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== RUNTIME_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Fetch: estrategia network-first para HTML (para ver siempre la última
// versión del shell de la app), cache-first para assets estáticos.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo gestionamos GET HTTP(S)
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Fallback al index si no hay nada cacheado
          const fallback = await caches.match('/');
          if (fallback) return fallback;
          throw err;
        }
      })(),
    );
    return;
  }

  // Para assets estáticos (_expo/static, /assets, /manifest.json, iconos…)
  // usamos cache-first con revalidación en background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === 'basic'
          ) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkPromise;
    })(),
  );
});
