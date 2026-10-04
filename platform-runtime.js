(() => {
  const ACTIVE_CACHE = 'zone.platform.activeRelease';
  const PREVIEW_CACHE = 'zone.platform.previewRelease';
  const GAME_DATA_CACHE = 'zone.platform.gameData';
  const params = new URLSearchParams(location.search);
  const preview = params.get('zone-preview') === '1';

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

  let release = parseRelease(localStorage.getItem(preview ? PREVIEW_CACHE : ACTIVE_CACHE)) ?? fallback;
  let gameData = preview ? (release.manifest.content ?? {}) : (parseData(localStorage.getItem(GAME_DATA_CACHE)) ?? release.manifest.content ?? {});
  let connection = preview ? 'preview' : 'connecting', pendingRefresh = null;
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
    preview,
    refresh: async () => {
      if (preview) return { release, content: gameData };
      if (pendingRefresh) return pendingRefresh;
      pendingRefresh = (async () => {
        try {
          const response = await fetch('/api/v1/game/bootstrap', { headers: { Accept: 'application/json' }, cache: 'no-store' });
          if (!response.ok) throw new Error(`Runtime API ${response.status}`);
          const remote = await response.json();
          if (remote?.release?.manifest?.schemaVersion !== 1 || !remote?.content || typeof remote.content !== 'object') throw new Error('Unsupported game bootstrap payload.');
          const previousFingerprint = fingerprint(release, gameData);
          release = remote.release; gameData = remote.content; connection = 'connected';
          localStorage.setItem(ACTIVE_CACHE, JSON.stringify(release));
          localStorage.setItem(GAME_DATA_CACHE, JSON.stringify(gameData));
          applyTokens(); document.documentElement.dataset.zoneReleaseApi = connection;
          const changed = previousFingerprint !== fingerprint(release, gameData);
          window.dispatchEvent(new CustomEvent('zone:runtime', { detail: { release, content: gameData, changed, connection } }));
          return remote;
        } catch (error) {
          connection = 'offline'; document.documentElement.dataset.zoneReleaseApi = connection;
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
    setInterval(() => { if (document.visibilityState !== 'hidden') window.ZonePlatform.refresh().catch(() => {}); }, 30000);
  }, { once: true });

  addEventListener('storage', (event) => {
    if (preview || ![ACTIVE_CACHE, GAME_DATA_CACHE].includes(event.key)) return;
    window.ZonePlatform.refresh().catch(() => {});
  });
  addEventListener('focus', () => { if (!preview) window.ZonePlatform.refresh().catch(() => {}); });
})();
