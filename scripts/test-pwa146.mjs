import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readUtf8 = (rel) => readFileSync(resolve(root, rel), 'utf8');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngDimensions(buffer) {
  assert.ok(buffer.length >= 24, 'PNG buffer must be at least 24 bytes');
  assert.equal(buffer.subarray(0, 8).compare(PNG_MAGIC), 0, 'PNG magic bytes mismatch');
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR', 'PNG IHDR chunk missing');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('all 4 PWA & iOS raster PNG app icons exist with valid PNG magic bytes and exact dimensions', () => {
  const expected = [
    ['assets/icons/icon-192.png', 192, 192],
    ['assets/icons/icon-512.png', 512, 512],
    ['assets/icons/icon-maskable-512.png', 512, 512],
    ['assets/icons/apple-touch-icon-180.png', 180, 180],
  ];
  for (const [rel, width, height] of expected) {
    const abs = resolve(root, rel);
    assert.ok(existsSync(abs), `Missing icon: ${rel}`);
    const bytes = readFileSync(abs);
    assert.ok(bytes.length > 1024, `Icon too small / blank: ${rel}`);
    const dims = readPngDimensions(bytes);
    assert.equal(dims.width, width, `${rel} width`);
    assert.equal(dims.height, height, `${rel} height`);
  }
});

test('manifest.webmanifest is a valid W3C Web App Manifest with all icons and shortcuts', () => {
  const manifest = JSON.parse(readUtf8('manifest.webmanifest'));
  assert.equal(manifest.name, 'ZONE | Syndicate Crime MMO');
  assert.equal(manifest.short_name, 'ZONE');
  assert.equal(manifest.start_url, '/?source=pwa');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.display_override, ['window-controls-overlay', 'standalone', 'minimal-ui']);
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.background_color, '#141210');
  assert.equal(manifest.theme_color, '#141210');
  assert.deepEqual(manifest.categories, ['games', 'strategy', 'role-playing']);

  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);
  const icon192 = manifest.icons.find((i) => i.sizes === '192x192');
  const icon512Any = manifest.icons.find((i) => i.sizes === '512x512' && i.purpose === 'any');
  const icon512Mask = manifest.icons.find((i) => i.sizes === '512x512' && i.purpose === 'maskable');
  assert.ok(icon192 && icon192.src === '/assets/icons/icon-192.png' && icon192.type === 'image/png');
  assert.ok(icon512Any && icon512Any.src === '/assets/icons/icon-512.png' && icon512Any.type === 'image/png');
  assert.ok(icon512Mask && icon512Mask.src === '/assets/icons/icon-maskable-512.png' && icon512Mask.type === 'image/png');
  for (const icon of manifest.icons) {
    assert.ok(existsSync(resolve(root, icon.src.replace(/^\//, ''))), `Manifest icon missing on disk: ${icon.src}`);
  }

  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 4);
  const shortcutMap = Object.fromEntries(manifest.shortcuts.map((s) => [s.name, s.url]));
  assert.equal(shortcutMap['City 3D Map'], '/?screen=city');
  assert.equal(shortcutMap['Crimes'], '/?screen=crimes');
  assert.equal(shortcutMap['Awards & Merits'], '/?sid=awards&tab=merits');
  assert.equal(shortcutMap['Gym'], '/?screen=gym');
});

test('sw.js passes node --check, enforces API/engine/non-GET bypass, cleans old caches, and supports SKIP_WAITING', async () => {
  const swPath = resolve(root, 'sw.js');
  execFileSync(process.execPath, ['--check', swPath], { stdio: 'pipe' });

  const swSource = readUtf8('sw.js');
  assert.match(swSource, /CACHE_NAME\s*=\s*['"]zone-app-v146['"]/);
  assert.match(swSource, /\.\/offline\.html/);
  assert.match(swSource, /\.\/manifest\.webmanifest/);
  assert.match(swSource, /\.\/assets\/icons\/icon-192\.png/);
  assert.match(swSource, /SKIP_WAITING/);
  assert.match(swSource, /clients\.claim\(\)/);

  // Behavioral sandbox check of sw.js listeners
  const listeners = {};
  const store = new Map();
  let skipWaitingCalled = 0;
  let claimed = 0;
  const deletedCaches = [];

  const mockCache = {
    async addAll(urls) {
      for (const u of urls) store.set(u, { url: u, ok: true, status: 200, type: 'basic', clone() { return this; } });
    },
    async match(req) {
      const key = typeof req === 'string' ? req : req.url;
      return store.get(key) || null;
    },
    async put(req, res) {
      const key = typeof req === 'string' ? req : req.url;
      store.set(key, res);
    },
  };

  const sandbox = createContext({
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    Response: class MockResponse {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.ok = this.status >= 200 && this.status < 300;
        this.type = 'basic';
      }
      clone() { return this; }
    },
    caches: {
      async open() { return mockCache; },
      async keys() { return ['zone-app-v144', 'zone-app-v145', 'zone-app-v146', 'other-cache']; },
      async delete(k) { deletedCaches.push(k); return true; },
    },
    fetch: async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      if (url.includes('offline-fail')) throw new Error('offline');
      return { url, ok: true, status: 200, type: 'basic', clone() { return this; } };
    },
    self: {
      location: { origin: 'https://zone.test' },
      addEventListener(type, fn) { listeners[type] = fn; },
      skipWaiting() { skipWaitingCalled++; return Promise.resolve(); },
      clients: { claim() { claimed++; return Promise.resolve(); } },
    },
  });
  runInContext(swSource, sandbox);

  // Activate cleans old zone-app-* caches only and calls clients.claim()
  let waitPromise;
  listeners.activate({ waitUntil(p) { waitPromise = p; } });
  await waitPromise;
  assert.deepEqual(deletedCaches.sort(), ['zone-app-v144', 'zone-app-v145']);
  assert.equal(claimed, 1);

  // SKIP_WAITING message triggers self.skipWaiting()
  listeners.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(skipWaitingCalled, 1);

  // Helper to test fetch interception
  const dispatchFetch = (request) => {
    let responded = false;
    let responsePromise = null;
    const waitPromises = [];
    listeners.fetch({
      request,
      respondWith(p) { responded = true; responsePromise = p; },
      waitUntil(p) { waitPromises.push(p); },
    });
    return { responded, responsePromise, waitPromises };
  };

  // NEVER cache /api/, /engine/, or non-GET requests
  assert.equal(dispatchFetch({ method: 'GET', url: 'https://zone.test/api/v1/gameplay' }).responded, false);
  assert.equal(dispatchFetch({ method: 'GET', url: 'https://zone.test/engine/theme.css' }).responded, false);
  assert.equal(dispatchFetch({ method: 'POST', url: 'https://zone.test/assets/icons/icon-192.png' }).responded, false);
  assert.equal(dispatchFetch({ method: 'GET', url: 'https://zone.test/sw.js' }).responded, false);

  // Versioned CSS/JS (?v=146 vs ?v=147) cached distinctly by full URL
  const r146 = dispatchFetch({ method: 'GET', url: 'https://zone.test/assets/ui/zone-app-shell.css?v=146' });
  assert.equal(r146.responded, true);
  await r146.responsePromise;
  const r147 = dispatchFetch({ method: 'GET', url: 'https://zone.test/assets/ui/zone-app-shell.css?v=147' });
  assert.equal(r147.responded, true);
  await r147.responsePromise;
  assert.ok(store.has('https://zone.test/assets/ui/zone-app-shell.css?v=146'));
  assert.ok(store.has('https://zone.test/assets/ui/zone-app-shell.css?v=147'));

  // Immutable binary asset (.woff2) intercepted and cached
  const fontRes = dispatchFetch({ method: 'GET', url: 'https://zone.test/assets/fonts/rubik-variable.woff2' });
  assert.equal(fontRes.responded, true);
  await fontRes.responsePromise;
  await Promise.all(fontRes.waitPromises);
  assert.ok(store.has('https://zone.test/assets/fonts/rubik-variable.woff2'));

  // Navigation offline fallback returns ./offline.html when network fails
  await mockCache.addAll(['./offline.html']);
  const navFail = dispatchFetch({ method: 'GET', mode: 'navigate', url: 'https://zone.test/?offline-fail=1' });
  assert.equal(navFail.responded, true);
  const offlineRes = await navFail.responsePromise;
  assert.equal(offlineRes.url, './offline.html');
});

test('offline.html is self-contained, non-empty, bilingual EN/AR with reconnect button', () => {
  const abs = resolve(root, 'offline.html');
  assert.ok(existsSync(abs));
  assert.ok(statSync(abs).size > 500);
  const html = readUtf8('offline.html');
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<style>/i);
  assert.match(html, /Reconnect/);
  assert.match(html, /إعادة الاتصال/);
  assert.match(html, /window\.location\.reload\(\)/);
  assert.match(html, /dir="rtl"/);
});

test('capacitor.config.json is valid and configured for iOS & Android wrapping', () => {
  const cap = JSON.parse(readUtf8('capacitor.config.json'));
  assert.equal(cap.appId, 'com.zonecity.syndicate');
  assert.equal(cap.appName, 'ZONE');
  assert.equal(cap.webDir, 'public');
  assert.equal(cap.backgroundColor, '#141210');
  assert.equal(cap.server?.androidScheme, 'https');
  assert.equal(cap.ios?.contentInset, 'automatic');
  assert.ok(cap.plugins?.StatusBar);
  assert.ok(cap.plugins?.SplashScreen);
});

test('vercel.json preserves security/rewrites/no-store and adds optimized PWA & CDN caching headers in valid precedence order', () => {
  const cfg = JSON.parse(readUtf8('vercel.json'));
  assert.equal(cfg.outputDirectory, 'public');
  assert.ok(Array.isArray(cfg.rewrites) && cfg.rewrites.length >= 3);
  assert.match(cfg.functions['api/index.php'].excludeFiles, /engine\/\{bin,tests,var,deploy\}/);

  const bySource = new Map(cfg.headers.map((entry, idx) => [entry.source, { idx, headers: Object.fromEntries(entry.headers.map((h) => [h.key, h.value])) }]));

  // Security headers preserved
  const globalSec = bySource.get('/(.*)');
  assert.ok(globalSec);
  assert.equal(globalSec.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(globalSec.headers['X-Frame-Options'], 'SAMEORIGIN');

  // HTML documents stay no-store
  for (const src of ['/', '/index.html', '/(admin|account)']) {
    assert.match(bySource.get(src)?.headers['Cache-Control'] || '', /no-store/);
  }

  // Service worker & manifest headers
  const swRule = bySource.get('/sw.js');
  assert.ok(swRule);
  assert.match(swRule.headers['Cache-Control'], /no-cache/);
  assert.match(swRule.headers['Cache-Control'], /no-store/);
  assert.equal(swRule.headers['Service-Worker-Allowed'], '/');

  const manifestRule = bySource.get('/manifest.webmanifest');
  assert.ok(manifestRule);
  assert.equal(manifestRule.headers['Content-Type'], 'application/manifest+json; charset=utf-8');
  assert.equal(manifestRule.headers['Cache-Control'], 'public, max-age=3600');

  // Immutable fonts & libs
  for (const src of ['/assets/fonts/(.*)', '/assets/ui/watercolor-fonts/(.*)', '/lib/(.*)']) {
    assert.equal(bySource.get(src)?.headers['Cache-Control'], 'public, max-age=31536000, immutable', src);
  }

  // Long-lived binary art/icons
  for (const src of ['/assets/icons/(.*)', '/assets/ui/watercolor-art/(.*)', '/(art|assets/weapons|assets/character)/(.*)']) {
    assert.equal(bySource.get(src)?.headers['Cache-Control'], 'public, max-age=604800, stale-while-revalidate=2592000', src);
  }

  // Versioned UI/city/dist assets
  const uiRule = bySource.get('/(assets/ui|assets/city|dist)/(.*)');
  assert.ok(uiRule);
  assert.equal(uiRule.headers['Cache-Control'], 'public, max-age=300, stale-while-revalidate=86400');

  // Precedence: specific assets/ui sub-rules MUST come after /(assets/ui|assets/city|dist)/(.*)
  assert.ok(bySource.get('/assets/ui/watercolor-art/(.*)').idx > uiRule.idx, 'watercolor-art rule must override generic assets/ui rule');
  assert.ok(bySource.get('/assets/ui/watercolor-fonts/(.*)').idx > uiRule.idx, 'watercolor-fonts rule must override generic assets/ui rule');
});

test('scripts/build.mjs packages manifest.webmanifest, sw.js, and offline.html into runtimeFiles', () => {
  const buildSrc = readUtf8('scripts/build.mjs');
  for (const file of ['manifest.webmanifest', 'sw.js', 'offline.html']) {
    assert.ok(buildSrc.includes(`'${file}'`), `scripts/build.mjs missing runtimeFile: ${file}`);
  }
});
