/* ZONE Syndicate Crime MMO - Production Service Worker (v159) */
const SHELL_CACHE_NAME = 'zone-shell-v159';
const SHELL_CACHE_PREFIX = 'zone-shell-';
const CACHE_NAME = 'zone-app-v146';
const CACHE_PREFIX = 'zone-app-';
const NAV_TIMEOUT_MS = 3500;
const PRECACHE_URLS = [
  './offline.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/data/zone-batch-skill-pack.json',
  './assets/data/zone-300-skills-encyclopedia.json',
  './assets/data/zone-config-skills-468.json',
  './assets/ui/zone-torn-live.css?v=159',
  './assets/ui/zone-torn-live.js?v=159',
  './assets/ui/zone-rpg-empire.css?v=159',
  './assets/ui/zone-rpg-empire.js?v=159',
  './assets/ui/zone-ascension-breakthrough.css?v=159',
  './assets/ui/zone-ascension-breakthrough.js?v=159',
  './assets/ui/zone-ecs-3d.css?v=159',
  './assets/ui/zone-ecs-3d-bridge.js?v=159',
  './assets/ui/zone-3d-rigged-operative.mjs?v=159',
  './assets/ui/zone-3d-environments.mjs?v=159',
  './assets/ui/zone-vfx-particles.mjs',
  './assets/ui/zone-ecs-3d-engine.mjs?v=159',
  './assets/ui/zone-profile-avatar.css?v=159',
  './assets/ui/zone-profile-avatar.js?v=159',
  './assets/ui/zone-instant-games.js?v=159',
  './assets/ui/zone-audio-haptics.js?v=159',
  './assets/ui/zone-tactical-director.css?v=159',
  './assets/ui/zone-tactical-director.js?v=159',
  './assets/ui/zone-hud-accessibility.css?v=159',
  './assets/ui/zone-hud-accessibility.js?v=159',
  './assets/ui/zone-batch-liveops.js?v=159',
  './assets/ui/zone-vehicle-garage.css?v=159',
  './assets/ui/zone-vehicle-garage.js?v=159',
  './assets/ui/zone-faction-warfare.css?v=159',
  './assets/ui/zone-faction-warfare.js?v=159',
  './assets/ui/zone-loadout-synergies.css?v=159',
  './assets/ui/zone-loadout-synergies.js?v=159',
  './assets/ui/zone-casino-tables.css?v=159',
  './assets/ui/zone-casino-tables.js?v=159',
  './assets/ui/zone-world-encounters.js?v=159',
  './assets/ui/zone-player-settings.css?v=159',
  './assets/ui/zone-player-settings.js?v=159',
  './assets/ui/zone-replay-viewer.css?v=159',
  './assets/ui/zone-replay-viewer.js?v=159',
  './assets/ui/zone-chat-system.css?v=159',
  './assets/ui/zone-chat-system.js?v=159',
  './assets/ui/zone-companion-3d.css?v=159',
  './assets/ui/zone-companion-3d.js?v=159'
];

const IMMUTABLE_BINARY_RE = /\.(?:woff2|webp|png|jpe?g|glb)$/i;
const VERSIONED_CODE_RE = /\.(?:css|js|mjs)$/i;

function isNetworkOnlyPath(pathname) {
  return (
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/engine' ||
    pathname.startsWith('/engine/')
  );
}

function isImmutableBinary(pathname) {
  return pathname.startsWith('/lib/') || IMMUTABLE_BINARY_RE.test(pathname);
}

function isVersionedCode(url) {
  return VERSIONED_CODE_RE.test(url.pathname) && url.searchParams.has('v');
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkResponse = await fetchWithTimeout(request, NAV_TIMEOUT_MS);
    if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match('./offline.html');
    if (offline) return offline;
    return new Response('Offline — ZONE Syndicate', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function refreshInBackground(cache, request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && (fresh.type === 'basic' || fresh.type === 'cors')) {
      await cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    return null;
  }
}

async function handleCacheFirstWithRefresh(event, request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    event.waitUntil(refreshInBackground(cache, request));
    return cached;
  }
  const fresh = await fetch(request);
  if (fresh && fresh.ok && (fresh.type === 'basic' || fresh.type === 'cors')) {
    event.waitUntil(cache.put(request, fresh.clone()).catch(() => {}));
  }
  return fresh;
}

async function handleStaleWhileRevalidate(event, request) {
  const cache = await caches.open(SHELL_CACHE_NAME);
  // Key strictly by full URL (never ignoreSearch) so ?v=146 vs ?v=148 never collide.
  const cached = await cache.match(request, { ignoreSearch: false });
  const networkPromise = refreshInBackground(cache, request);
  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }
  const fresh = await networkPromise;
  if (fresh) return fresh;
  return fetch(request);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) =>
            (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) ||
            (key.startsWith(SHELL_CACHE_PREFIX) && key !== SHELL_CACHE_NAME)
          )
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // NEVER cache non-GET requests (POST/PUT/PATCH/DELETE mutations must hit network directly).
  if (!request || request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Only intercept same-origin HTTP(S) traffic.
  if (url.origin !== self.location.origin) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // NEVER cache /api/ or /engine/ endpoints (strictly network-only!).
  if (isNetworkOnlyPath(url.pathname)) return;

  // Never intercept service worker script updates themselves.
  if (url.pathname === '/sw.js') return;

  // HTML Navigations: Network-first (3.5s timeout -> cached response -> ./offline.html).
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Immutable binary assets (.woff2, .webp, .png, .jpg, .glb, /lib/): Cache-first + background refresh.
  if (isImmutableBinary(url.pathname)) {
    event.respondWith(handleCacheFirstWithRefresh(event, request));
    return;
  }

  // Versioned CSS/JS (?v=): Stale-While-Revalidate keyed by exact full URL.
  if (isVersionedCode(url)) {
    event.respondWith(handleStaleWhileRevalidate(event, request));
  }
});
