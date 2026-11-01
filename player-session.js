(() => {
  if (window.ZoneCanonicalEntry) return;
  if (new URLSearchParams(location.search).get('zone-preview') === '1') return;
  const nativeFetch = window.fetch.bind(window);
  let pending = null, identity = null, retryAfter = 0, expired = false;
  const cached = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const cache = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const removeCache = key => { try { localStorage.removeItem(key); } catch (_) {} };
  // Bound reads, including body parsing, without retrying or aborting gameplay
  // mutations whose server outcome could already be committed.
  const boundedRead = async (input, options) => {
    if (typeof AbortController === 'undefined' || typeof setTimeout !== 'function' || options?.signal) return nativeFetch(input, options);
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { reject(new Error('ZONE read timed out. Reconnect to refresh saved progress.')); controller.abort(); }, 25000);
    });
    try {
      const response = await Promise.race([nativeFetch(input, { ...options, signal: controller.signal }), deadline]);
      return new Proxy(response, { get(target, key) {
        const value = Reflect.get(target, key, target);
        if (['json', 'text', 'blob', 'arrayBuffer', 'formData'].includes(key) && typeof value === 'function') return async (...args) => {
          try { return await Promise.race([value.apply(target, args), deadline]); }
          finally { clearTimeout(timer); }
        };
        return typeof value === 'function' ? value.bind(target) : value;
      } });
    } catch (error) { clearTimeout(timer); throw error; }
  };
  const playerPath = /^\/api\/v1\/(?:player|player-combat|player-market|family-activities|world|gameplay|combat|achievements|leaderboards|city\/map|territories|factions|crimes\/[^/]+\/attempt|gym|bank|hospital|travel|casino|jobs|attack|daily|notifications)(?:\/|$)/;
  const sessionExpired = () => {
    if (expired || (identity?.expiresAt && identity.expiresAt * 1000 <= Date.now())) {
      expired = true; document.documentElement.dataset.zonePlayerAccess = 'expired';
    }
    return expired;
  };
  const ensure = () => {
    if (sessionExpired()) {
      return Promise.reject(new Error('Player session expired. Open Account to restore your saved character.'));
    }
    if (identity) return Promise.resolve(identity);
    if (pending) return pending;
    if (Date.now() < retryAfter) return Promise.reject(new Error('ZONE connection unavailable. Please retry shortly.'));
    pending = boundedRead('/api/v1/auth/session', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' })
      .then(async response => {
        if (response.status === 401) { expired = true; sessionExpired(); }
        const session = await response.json();
        if (!response.ok || typeof session.playerId !== 'string') throw new Error(session.error || 'Unable to establish player access.');
        identity = session;
        // Cached presentation never authorizes gameplay. Clear another account's
        // view when identity changes, before authoritative hydration completes.
        const previous = cached('zone.player.id');
        if (previous && previous !== session.playerId) removeCache('zone.v2.save');
        cache('zone.player.id', session.playerId);
        document.documentElement.dataset.zonePlayerAccess = session.mode;
        return session;
      }).catch(error => { retryAfter = Date.now() + 15000; throw error; })
      .finally(() => { pending = null; });
    return pending;
  };
  window.ZoneSession = { ensure, current: () => identity, expired: sessionExpired,
    isPlayerRoute: path => typeof path === 'string' && playerPath.test(path),
    readTimeoutMs: () => 25000,
    retryBackoffMs: () => 15000,
    isPending: () => Boolean(pending),
    isEstablished: () => Boolean(identity) && !sessionExpired(),
    isBackingOff: () => Date.now() < retryAfter,
    diagnostics: () => ({ established: Boolean(identity), playerId: identity?.playerId || null, mode: identity?.mode || null, expired: sessionExpired(), retryAfterMs: Math.max(0, retryAfter - Date.now()), ttlSeconds: identity?.expiresAt ? Math.max(0, Math.floor(identity.expiresAt - Date.now() / 1000)) : null }),
    recover: async () => {
    retryAfter = 0;
    if (!sessionExpired()) return ensure();
    const response = await boundedRead('/api/v1/auth/account', {credentials:'same-origin', cache:'no-store'});
    const account = await response.json();
    // The real account status returns playerId/username/claimed on success,
    // not an authenticated boolean. The cookie is still verified again by
    // auth/session; browser presentation never supplies access or identity.
    if (!response.ok || typeof account?.playerId !== 'string' || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(account.playerId)) throw new Error('Player session expired. Open Account to restore your saved character.');
    identity = null; expired = false; return ensure();
  } };
  window.fetch = async (input, options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    const playerRequest = url.origin === location.origin && playerPath.test(url.pathname);
    if (playerRequest) await ensure();
    const method = String(options?.method || (typeof input === 'object' ? input.method : '') || 'GET').toUpperCase();
    const response = await (playerRequest && method === 'GET' ? boundedRead(input, options) : nativeFetch(input, options));
    if (playerRequest && response.status === 401) {
      expired = true; sessionExpired();
    }
    return response;
  };
})();
