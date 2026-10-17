// Service Worker — MCM App PWA
// Estrategia minimalista de runtime caching. NO precachea nada (los nombres
// de los bundles llevan hash y cambian por build, así que un precache list
// fijo se rompería en cada despliegue).
//
// v4 (2026-10): el HTML solo se guarda si la respuesta es buena y no espera a
// la red más de HTML_TIMEOUT_MS si hay copia; los bundles con hash viejos se
// podan al guardar uno nuevo (antes cada despliegue dejaba ~8 MB más en el
// caché, para siempre). Subir VERSION limpia de una vez lo acumulado.

const VERSION = 'mcm-pwa-v4';
const RUNTIME_CACHE = `mcm-runtime-${VERSION}`;

/** Con copia en caché, cuánto se espera a la red antes de servir la copia. */
const HTML_TIMEOUT_MS = 4000;

/** Ficheros con hash del export de Expo: `<nombre>-<hash>.<ext>`. */
const HASHED_ASSET = /^(\/_expo\/static\/.+)-[0-9a-f]{16,}\.(js|css)$/;

// Instalación: skip waiting para activarse cuanto antes
self.addEventListener('install', () => {
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

/**
 * El HTML se guarda por RUTA, sin query: `/cancion?f=a` y `/cancion?f=b` son
 * el mismo fichero estático y no deben ocupar una entrada cada uno.
 */
function htmlCacheKey(url) {
  return new Request(url.origin + url.pathname);
}

/**
 * Tras guardar un bundle con hash, borra del caché las versiones anteriores
 * del MISMO fichero (mismo nombre, otro hash). Un trozo que se borre de más
 * solo cuesta volver a descargarlo.
 */
async function pruneOldVersions(cache, url) {
  const match = url.pathname.match(HASHED_ASSET);
  if (!match) return;
  const base = match[1];
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter((k) => {
        const path = new URL(k.url).pathname;
        const m = path.match(HASHED_ASSET);
        return path !== url.pathname && m && m[1] === base;
      })
      .map((k) => cache.delete(k)),
  );
}

// Network-first para HTML (para ver siempre la última versión del shell),
// con tope de espera si hay copia. Solo se guardan respuestas buenas: un
// 404/500 puntual del hosting no puede acabar siendo la versión offline.
async function handleHTML(event, url) {
  const { request } = event;
  const key = htmlCacheKey(url);
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(key, response.clone());
    }
    return response;
  });
  // Que el guardado termine aunque ya se haya respondido con la copia.
  event.waitUntil(
    network.then(
      () => undefined,
      () => undefined,
    ),
  );

  const cached =
    (await caches.match(key)) ||
    (await caches.match(request, { ignoreSearch: true })) ||
    (await caches.match('/'));
  if (!cached) return network; // sin copia: lo que diga la red, tarde lo que tarde

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), HTML_TIMEOUT_MS);
  });
  try {
    const fresh = await Promise.race([network, timeout]);
    // Un error del servidor (5xx) con copia buena: mejor la copia.
    if (fresh && fresh.status < 500) return fresh;
  } catch {
    // Sin red: la copia.
  } finally {
    clearTimeout(timer);
  }
  return cached;
}

// Cache-first con revalidación en background para assets estáticos
// (_expo/static, /assets, /manifest.json, iconos…).
async function handleAsset(event, url) {
  const { request } = event;
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(async (response) => {
    if (response && response.status === 200 && response.type === 'basic') {
      await cache.put(request, response.clone());
      await pruneOldVersions(cache, url);
    }
    return response;
  });
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  // Sin copia y sin red: un error de red de verdad, no `undefined` (que hace
  // que `respondWith` lance un TypeError).
  return network.catch(() => Response.error());
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo gestionamos GET HTTP(S) del propio origen
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  event.respondWith(isHTML ? handleHTML(event, url) : handleAsset(event, url));
});
