/* Mira offline shell: cache static assets only, never API or user-data fetches. */
const CACHE = 'mira-shell-v5';
/* Large model assets live in an isolated, on-demand, versioned browser cache.
 * Do not preload them on startup, and never put user data in this cache. */
const ROOM_3D_CACHE = 'mira-room-glb-v2';
const ROOM_GLB_PATH = /(?:^|\/)avatars\/realistic\/vitruvian-lab\/(?:head|body|hair)\.glb$/i;
const ROOM_GLB_MAX_BYTES = 18 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 128;
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest']);
const STATIC_PATH = /(?:^|\/)(?:assets|mira-assets|avatars|scenes)(?:\/|$)|\.(?:js|css|png|jpg|jpeg|webp|svg|woff2?|ico|webmanifest)$/i;

function sameOriginGet(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && !/(?:^|\/)api(?:\/|$)/i.test(url.pathname);
}

function canCache(response) {
  if (!response || !response.ok || response.type === 'opaque') return false;
  const policy = String(response.headers.get('cache-control') || '');
  return !/(?:^|,)\s*(?:private|no-store|no-cache)\b/i.test(policy);
}

async function cacheResponse(cache, request, response) {
  if (!canCache(response)) return;
  await cache.put(request, response.clone());
  const entries = await cache.keys();
  for (const old of entries.slice(0, Math.max(0, entries.length - MAX_CACHE_ENTRIES))) {
    await cache.delete(old);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.add('./'); } catch { /* first install may be offline */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE && key !== ROOM_3D_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!sameOriginGet(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (canCache(fresh)) {
          const cache = await caches.open(CACHE);
          await cacheResponse(cache, request, fresh);
        }
        return fresh;
      } catch {
        return (await caches.match(request)) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  const pathname = new URL(request.url).pathname;

  // WebGL loaders request GLBs with request.destination === ''. The standard
  // image/script allowlist therefore never cached these ~30 MiB of models.
  // Cache ONLY the three public CC0 lab GLBs, after an explicit 3D request.
  // Do not cache arbitrary binary downloads, APIs, user uploads or responses
  // with private/no-store policies.
  if (ROOM_GLB_PATH.test(pathname) && (request.destination === '' ||
       request.destination === 'fetch')) {
    event.respondWith((async () => {
      const cache = await caches.open(ROOM_3D_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      const length = Number(response.headers.get('content-length') || 0);
      const mime = String(response.headers.get('content-type') || '').toLowerCase();
      const validBinary = /^(?:model\/gltf-binary|application\/octet-stream)(?:;|$)/.test(mime);
      if (canCache(response) && validBinary &&
          (length === 0 || length <= ROOM_GLB_MAX_BYTES)) {
        // A quota error must never block the first WebGL load.
        const store = cache.put(request, response.clone()).catch(() => {});
        if (typeof event.waitUntil === 'function') event.waitUntil(store);
      }
      return response;
    })());
    return;
  }
  if (!STATIC_DESTINATIONS.has(request.destination) || !STATIC_PATH.test(pathname)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (canCache(response)) {
      const cache = await caches.open(CACHE);
      await cacheResponse(cache, request, response);
    }
    return response;
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'MIRA_HEARTBEAT') {
    // Service workers cannot maintain camera/microphone capture through OS suspend.
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows[0]) return windows[0].focus();
    return self.clients.openWindow('./');
  })());
});
