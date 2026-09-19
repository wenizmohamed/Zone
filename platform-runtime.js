(() => {
  const ACTIVE_CACHE = 'zone.platform.activeRelease';
  const PREVIEW_CACHE = 'zone.platform.previewRelease';
  const params = new URLSearchParams(location.search);
  const preview = params.get('zone-preview') === '1';

  const parse = (value) => {
    try {
      const release = JSON.parse(value);
      return release?.manifest?.schemaVersion === 1 ? release : null;
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

  let release = parse(localStorage.getItem(preview ? PREVIEW_CACHE : ACTIVE_CACHE)) ?? fallback;
  const reloadMarker = 'zone.platform.reloadedRelease';
  const reloadForRelease = (nextRelease) => {
    const nextId = String(nextRelease?.id ?? '');
    if (!nextId || sessionStorage.getItem(reloadMarker) === nextId) return;
    sessionStorage.setItem(reloadMarker, nextId);
    location.reload();
  };
  const applyTokens = () => {
    const accent = release.manifest.branding?.accent;
    if (/^#[0-9a-f]{6}$/i.test(accent ?? '')) document.documentElement.style.setProperty('--acc', accent);
    document.documentElement.dataset.zoneRelease = String(release.version);
    document.documentElement.dataset.zonePreview = preview ? '1' : '0';
  };
  applyTokens();

  window.ZonePlatform = {
    active: () => release,
    manifest: () => release.manifest,
    preview,
    refresh: async () => {
      if (preview) return release;
      const response = await fetch('/api/v1/releases/active', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Release API ${response.status}`);
      const remote = await response.json();
      if (remote?.manifest?.schemaVersion !== 1) throw new Error('Unsupported release manifest.');
      const cachedVersion = Number(release.version) || 0;
      const remoteVersion = Number(remote.version) || 0;
      if (remoteVersion >= cachedVersion || release.id === 'frontend-default') {
        const changed = remote.id !== release.id;
        release = remote;
        localStorage.setItem(ACTIVE_CACHE, JSON.stringify(remote));
        applyTokens();
        window.dispatchEvent(new CustomEvent('zone:release', { detail: { release, changed } }));
        if (changed) reloadForRelease(remote);
      }
      return release;
    },
  };

  addEventListener('DOMContentLoaded', () => {
    if (preview) return;
    window.ZonePlatform.refresh().catch((error) => {
      document.documentElement.dataset.zoneReleaseApi = 'offline';
      console.warn('ZONE release API unavailable, using the last validated release cache.', error);
    });
  }, { once: true });

  addEventListener('storage', (event) => {
    if (preview || event.key !== ACTIVE_CACHE || !event.newValue) return;
    const nextRelease = parse(event.newValue);
    if (nextRelease && nextRelease.id !== release.id) reloadForRelease(nextRelease);
  });
})();
