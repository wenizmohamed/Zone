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
  const reloadMarker = 'zone.platform.reloadedRuntime';
  const fingerprint = (nextRelease, nextData) => JSON.stringify([
    nextRelease?.id ?? '', nextRelease?.version ?? 0,
    (nextData?.crimes ?? []).map((crime) => [crime.id, crime.enabled, crime.name_en, crime.name_ar, crime.nerve_cost, crime.success_basis_points, crime.cash_min, crime.cash_max, crime.xp_reward]),
    (nextData?.engineModules ?? []).map((module) => [module.id, module.installed, module.enabled]),
    nextData?.activeTheme ?? '',
  ]);
  const reloadForRuntime = (nextRelease, nextData) => {
    const marker = fingerprint(nextRelease, nextData);
    if (sessionStorage.getItem(reloadMarker) === marker) return;
    sessionStorage.setItem(reloadMarker, marker);
    location.reload();
  };
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
    preview,
    refresh: async () => {
      if (preview) return { release, content: gameData };
      const response = await fetch('/api/v1/game/bootstrap', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Runtime API ${response.status}`);
      const remote = await response.json();
      if (remote?.release?.manifest?.schemaVersion !== 1 || !remote?.content || typeof remote.content !== 'object') throw new Error('Unsupported game bootstrap payload.');
      const previousFingerprint = fingerprint(release, gameData);
      release = remote.release;
      gameData = remote.content;
      localStorage.setItem(ACTIVE_CACHE, JSON.stringify(release));
      localStorage.setItem(GAME_DATA_CACHE, JSON.stringify(gameData));
      applyTokens();
      const changed = previousFingerprint !== fingerprint(release, gameData);
      window.dispatchEvent(new CustomEvent('zone:runtime', { detail: { release, content: gameData, changed } }));
      if (changed) reloadForRuntime(release, gameData);
      return remote;
    },
  };

  addEventListener('DOMContentLoaded', () => {
    if (preview) return;
    window.ZonePlatform.refresh().catch((error) => {
      document.documentElement.dataset.zoneReleaseApi = 'offline';
      console.warn('ZONE runtime API unavailable, using the last validated runtime cache.', error);
    });
  }, { once: true });

  addEventListener('storage', (event) => {
    if (preview || ![ACTIVE_CACHE, GAME_DATA_CACHE].includes(event.key)) return;
    const nextRelease = parseRelease(localStorage.getItem(ACTIVE_CACHE)) ?? release;
    const nextData = parseData(localStorage.getItem(GAME_DATA_CACHE)) ?? gameData;
    if (fingerprint(nextRelease, nextData) !== fingerprint(release, gameData)) reloadForRuntime(nextRelease, nextData);
  });
})();
