(() => {
  if (window.ZoneCanonicalEntry) return;
  const ACTIVE_CACHE = 'zone.platform.activeRelease';
  const PREVIEW_CACHE = 'zone.platform.previewRelease';
  const GAME_DATA_CACHE = 'zone.platform.gameData';
  const params = new URLSearchParams(location.search);
  const preview = params.get('zone-preview') === '1';
  // Browser storage is a presentation cache, never a prerequisite for the API.
  const cached = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const cache = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const readBootstrap = async () => {
    if (typeof AbortController === 'undefined' || typeof setTimeout !== 'function') {
      const response = await fetch('/api/v1/game/bootstrap', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Runtime API ${response.status}`);
      return response.json();
    }
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { reject(new Error('ZONE runtime read timed out. Reconnect to refresh.')); controller.abort(); }, 25000);
    });
    try {
      const response = await Promise.race([fetch('/api/v1/game/bootstrap', { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal }), deadline]);
      if (!response.ok) throw new Error(`Runtime API ${response.status}`);
      return await Promise.race([response.json(), deadline]);
    } finally { clearTimeout(timer); }
  };

  const parseRelease = (value) => {
    try {
      const release = JSON.parse(value);
      return release?.manifest?.schemaVersion === 1 ? release : null;
    } catch (_) { return null; }
  };
  const parseData = (value) => {
    try {
      const data = JSON.parse(value);
      return data && typeof data === 'object' ? data : null;
    } catch (_) { return null; }
  };

  const fallback = {
    id: 'frontend-default',
    version: 0,
    active: true,
    manifest: {
      schemaVersion: 1,
      branding: { name: { en: 'ZONE', ar: 'زون' }, tagline: { en: 'Build the city. Run the world.', ar: 'ابنِ المدينة. أدر العالم.' }, accent: '#a3d900' },
      announcement: { enabled: false, text: { en: '', ar: '' } },
      modules: {},
      navigation: ['home', 'items', 'city', 'jobs', 'gym', 'properties', 'education', 'crimes', 'missions', 'newspaper', 'jail', 'hospital', 'casino', 'hof', 'faction', 'elimination', 'attack', 'market'],
      pages: [],
    },
  };

  let release = parseRelease(cached(preview ? PREVIEW_CACHE : ACTIVE_CACHE)) ?? fallback;
  let gameData = preview ? (release.manifest.content ?? {}) : (parseData(cached(GAME_DATA_CACHE)) ?? release.manifest.content ?? {});
  let connection = preview ? 'preview' : 'connecting', pendingRefresh = null, nextAutomaticRefresh = 0, failures = 0;
  const builtinScreens = ['home','items','city','jobs','bank','gym','properties','education','crimes','missions','newspaper','jail','hospital','casino','hof','faction','elimination','attack','market'];
  const resolvePage = (screen, reserved = []) => {
    if (typeof screen !== 'string' || !screen || builtinScreens.includes(screen) || reserved.includes(screen)) return screen;
    const pages = (Array.isArray(release.manifest.pages) ? release.manifest.pages : []).filter(page => page?.enabled && typeof page.id === 'string' && !builtinScreens.includes(page.id) && release.manifest.modules?.[page.id] !== false);
    // Canonical page IDs always win over another page's slug. Disabled or
    // ambiguous aliases stay unresolved so the normal route guard can reject.
    if (pages.some(page => page.id === screen)) return screen;
    const matches = pages.filter(page => page.slug === screen);
    return matches.length === 1 ? matches[0].id : screen;
  };
  const fingerprint = (nextRelease, nextData) => JSON.stringify([nextRelease, nextData]);
  const applyTokens = () => {
    const accent = release.manifest.branding?.accent;
    if (/^#[0-9a-f]{6}$/i.test(accent ?? '')) document.documentElement.style.setProperty('--acc', accent);
    document.documentElement.dataset.zoneRelease = String(release.version);
    document.documentElement.dataset.zonePreview = preview ? '1' : '0';
    document.documentElement.dataset.zoneTheme = String(gameData.activeTheme ?? '');
  };
  applyTokens();

  window.ZonePlatform = {
    active: () => release,
    manifest: () => release.manifest,
    data: () => gameData,
    status: () => connection,
    resolvePage,
    preview,
    builtinScreens: () => builtinScreens.slice(),
    isBuiltinScreen: (id) => builtinScreens.includes(String(id || '')),
    isConnected: () => connection === 'connected',
    isOffline: () => connection === 'offline',
    isPending: () => Boolean(pendingRefresh),
    activeReleaseCacheKey: () => ACTIVE_CACHE,
    previewReleaseCacheKey: () => PREVIEW_CACHE,
    gameDataCacheKey: () => GAME_DATA_CACHE,
    bootstrapEndpointPath: () => '/api/v1/game/bootstrap',
    bootstrapReadTimeoutMs: () => 25000,
    diagnostics: () => ({ status: connection, releaseId: release.id, releaseVersion: release.version, preview, failures, nextAutomaticRefresh, builtinScreenCount: builtinScreens.length }),
    refresh: async () => {
      if (preview) return { release, content: gameData };
      if (pendingRefresh) return pendingRefresh;
      pendingRefresh = (async () => {
        try {
          const remote = await readBootstrap();
          if (remote?.release?.manifest?.schemaVersion !== 1 || !remote?.content || typeof remote.content !== 'object') throw new Error('Unsupported game bootstrap payload.');
          const previousFingerprint = fingerprint(release, gameData);
          release = remote.release; gameData = remote.content; connection = 'connected';
          failures = 0; nextAutomaticRefresh = Date.now() + 30000;
          cache(ACTIVE_CACHE, release);
          cache(GAME_DATA_CACHE, gameData);
          applyTokens(); document.documentElement.dataset.zoneReleaseApi = connection;
          const changed = previousFingerprint !== fingerprint(release, gameData);
          window.dispatchEvent(new CustomEvent('zone:runtime', { detail: { release, content: gameData, changed, connection } }));
          return remote;
        } catch (error) {
          connection = 'offline'; document.documentElement.dataset.zoneReleaseApi = connection;
          failures++; nextAutomaticRefresh = Date.now() + Math.min(600000, 30000 * 2 ** Math.min(failures, 4));
          window.dispatchEvent(new CustomEvent('zone:runtime', { detail: { release, content: gameData, changed: false, connection } }));
          throw error;
        } finally { pendingRefresh = null; }
      })();
      return pendingRefresh;
    },
  };

  addEventListener('DOMContentLoaded', () => {
    if (preview) return;
    window.ZonePlatform.refresh().catch((error) => {
      console.warn('ZONE runtime API unavailable, using the last validated runtime cache.', error);
    });
    setInterval(() => { if (document.visibilityState !== 'hidden' && Date.now() >= nextAutomaticRefresh) window.ZonePlatform.refresh().catch(() => {}); }, 120000);
  }, { once: true });

  addEventListener('storage', (event) => {
    if (preview || ![ACTIVE_CACHE, GAME_DATA_CACHE].includes(event.key) || Date.now() < nextAutomaticRefresh) return;
    window.ZonePlatform.refresh().catch(() => {});
  });
  addEventListener('focus', () => { if (!preview && Date.now() >= nextAutomaticRefresh) window.ZonePlatform.refresh().catch(() => {}); });
  addEventListener('online', () => { if (!preview) window.ZonePlatform.refresh().catch(() => {}); });
})();
