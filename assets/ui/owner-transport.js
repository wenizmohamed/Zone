(() => {
  if (window.ZoneCanonicalEntry || !window.zoneOwnerPlaytest || new URLSearchParams(location.search).get('zone-preview') === '1') return;
  const upstream = window.fetch.bind(window);
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    if (url.origin === location.origin && window.zoneOwnerPlaytest.active() && url.pathname.startsWith('/api/v1/') && !/^\/api\/v1\/(?:admin|auth)\//.test(url.pathname)) {
      const method = String(options?.method || (typeof input === 'object' ? input.method : '') || 'GET').toUpperCase();
      const body = options?.body ? JSON.parse(options.body) : {};
      const routed = await window.zoneOwnerPlaytest.route(url.pathname, body, method);
      if (routed.handled) return new Response(JSON.stringify(routed.response), {status: 200, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
    }
    return upstream(input, options);
  };
})();
