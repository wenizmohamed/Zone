(() => {
  // Review deployment origins are not additional player origins. Keep the
  // server host allowlist strict and enter the existing live origin instead.
  const host = location.hostname.toLowerCase();
  const params = new URLSearchParams(location.search);
  if (!/^zone-final-(?:[a-z0-9]+-)?team-auraa\.vercel\.app$/.test(host) || params.get('zone-preview') === '1') return;
  const target = new URL(location.pathname, 'https://zone-torn-style-game-mockup-6cf978c.vercel.app');
  for (const key of ['screen', 'lang']) {
    const value = params.get(key);
    if (value && /^[a-z0-9_-]{1,80}$/i.test(value)) target.searchParams.set(key, value);
  }
  window.ZoneCanonicalEntry = true;
  location.replace(target.href);
})();
