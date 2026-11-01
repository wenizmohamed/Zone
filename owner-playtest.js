(() => {
  'use strict';
  let state = null;
  let selected = false;
  let selectedSessionId = null;
  let blocked = null;
  let pending = null;
  let generation = 0;
  let starting = null;
  let lastExit = null;
  let available = false;
  let refreshing = null;
  let recovering = null;
  let transport = null;
  const selectionKey = 'zone.ownerPlaytest.selection';
  const preview = Boolean(window.ZonePlatform?.preview) || new URLSearchParams(location.search ?? '').get('zone-preview') === '1';
  // This is only a per-tab mode safety latch, not authentication or gameplay.
  // It stores exactly one server-issued sessionId, never a token or gear/state.
  if (!preview) {
    try {
      const remembered = window.sessionStorage?.getItem(selectionKey);
      if (typeof remembered === 'string' && /^[a-f0-9]{32}$/.test(remembered)) {
        selected = true; selectedSessionId = remembered; pending = 'resume';
      }
    } catch (_) { /* Optional storage cannot grant any server authority. */ }
  }
  const rememberSelection = sessionId => { if (!preview) try { window.sessionStorage?.setItem(selectionKey, sessionId); } catch (_) {} };
  const forgetSelection = () => { if (!preview) try { window.sessionStorage?.removeItem(selectionKey); } catch (_) {} };
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const key = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const current = () => !selected ? {active: false, mode: 'player', ...clone(lastExit)}
    : blocked || !state ? {active: true, mode: 'owner-playtest', sessionId: selectedSessionId,
      expired: Boolean(blocked?.expired), blocked: true, pending, error: blocked?.message ?? (pending === 'resume' ? 'Owner playtest is awaiting authenticated resume.' : 'Owner playtest is starting.')}
      : {...clone(state), expired: false, blocked: false, pending};
  const emit = () => {
    window.dispatchEvent(new CustomEvent('zone:owner-playtest', {detail: {available, active: selected,
      expired: Boolean(blocked?.expired), blocked: Boolean(blocked) || (selected && !state), pending,
      serverCloseUnconfirmed: lastExit?.serverCloseUnconfirmed === true, snapshot: selected ? current() : null}}));
  };
  const modeError = message => { const error = new Error(message); error.status = 409; return error; };
  const transientRead = error => error.name !== 'SyntaxError' && (!error.status || [408,429].includes(error.status) || (error.status >= 500 && error.status <= 599));
  const block = (error, ticket, expired = true, retryableRead = false) => {
    if (ticket !== generation) return current();
    if (blocked && !blocked.retryableRead && retryableRead) return current();
    if (error.status === 401 || error.status === 403) available = false;
    if (selected) { blocked = {message: error.message, expired, retryableRead}; pending = null; }
    emit(); return current();
  };
  const accept = (next, ticket, allowSessionChange = false, recoverRead = false) => {
    if (ticket !== generation) return current();
    if (selected && blocked && !allowSessionChange && !(recoverRead && blocked.retryableRead && !blocked.expired)) return current();
    if (next?.active) {
      if (!next.sessionId || !Number.isInteger(next.version) || next.version < 1 || !next.gameplay) return block(modeError('Invalid owner playtest snapshot.'), ticket);
      if (selectedSessionId && next.sessionId !== selectedSessionId && !allowSessionChange) return block(modeError('Owner playtest session changed. Exit before continuing.'), ticket);
      if (state && next.sessionId === selectedSessionId && (next.version < state.version || (next.version === state.version && !recoverRead))) return current();
      selected = true; selectedSessionId = next.sessionId; state = clone(next); blocked = null; pending = null; lastExit = null; rememberSelection(selectedSessionId); emit();
    } else if (selected) return block(modeError('Owner playtest expired or ended. Explicitly return to your account before continuing.'), ticket);
    else emit();
    return current();
  };
  const ready = () => {
    if (!selected || !state || blocked || pending === 'start' || pending === 'stop' || pending === 'recover') throw modeError(blocked?.message ?? 'Owner playtest is not ready.');
  };
  async function request(path, method = 'GET', body) {
    if (transport) return transport(path, method, body);
    const response = await fetch(path, {method, credentials: 'same-origin', cache: 'no-store',
      headers: {'Accept': 'application/json', ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
      ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || 'Owner playtest request failed.');
      error.status = response.status; error.payload = result;
      throw error;
    }
    return result;
  }
  async function probe() {
    if (preview) return {available: false, active: false, snapshot: null};
    const ticket = generation;
    try {
      const access = await request('/api/v1/admin/session');
      if (ticket !== generation) return {available, active: selected, snapshot: selected ? current() : null};
      available = access.authenticated === true;
      emit();
      if (available) await refresh(); else if (selected) block(Object.assign(new Error('Admin authentication required.'), {status: 401}), ticket); else emit();
    } catch (error) {
      if (error.status !== 401 && error.status !== 403) { if (selected) block(error, ticket, false, transientRead(error)); throw error; }
      block(error, ticket);
    }
    return {available, active: selected, expired: Boolean(blocked?.expired), snapshot: selected ? current() : null};
  }
  async function refresh() { return refreshSnapshot(); }
  async function refreshSnapshot(recoverRead = false) {
    if (preview) return {active: false, mode: 'player'};
    const ticket = generation;
    if (!refreshing || refreshing.ticket !== ticket) {
      const entry = {ticket, promise: null, recoverRead};
      entry.promise = request('/api/v1/admin/playtest').then(next => accept(next, ticket, false, entry.recoverRead)).catch(error => {
        if (ticket !== generation) return current();
        block(error, ticket, error.status === 401 || error.status === 403, transientRead(error)); throw error;
      }).finally(() => { if (refreshing === entry) refreshing = null; });
      refreshing = entry;
    }
    // Only authenticated explicit recovery can authorize a shared pending read
    // to unblock the same session. Public refresh arguments grant nothing.
    if (recoverRead) refreshing.recoverRead = true;
    return refreshing.promise;
  }
  async function recover() {
    if (preview || !selected) return {active:false, mode:'player'};
    if (recovering?.ticket === generation) return recovering.promise;
    if (!selectedSessionId || pending === 'start' || pending === 'stop' || (blocked && !blocked.retryableRead)) throw modeError(blocked?.message ?? 'Owner playtest cannot be resumed. Explicitly exit before continuing.');
    const ticket = generation, entry = {ticket, promise:null};
    pending = 'recover'; emit();
    entry.promise = (async () => {
      try {
        // Explicit recovery only. Authenticate reads and retain the selected
        // session, including same-version snapshots. Never resend a mutation.
        const access = await request('/api/v1/admin/session');
        if (ticket !== generation) return current();
        if (access.authenticated !== true) throw Object.assign(new Error('Admin authentication required.'), {status:401});
        available = true;
        await refreshSnapshot(true);
        if (ticket !== generation) return current();
        if (blocked || !state || state.sessionId !== selectedSessionId) throw modeError(blocked?.message ?? 'Owner playtest is not ready.');
        pending = null; emit(); return current();
      } catch (error) {
        if (ticket !== generation) return current();
        // Identity/expiry blocks created while validating the snapshot stay
        // irreversible here; a transient read cannot convert them to retryable.
        if (!blocked || blocked.retryableRead) block(error, ticket, error.status === 401 || error.status === 403, transientRead(error));
        throw error;
      } finally { if (recovering === entry) recovering = null; }
    })();
    recovering = entry; return entry.promise;
  }
  async function start(idempotencyKey = key()) {
    if (preview) throw modeError('Owner playtest is not available in preview.');
    if (selected) throw modeError('Exit the selected owner playtest before starting another.');
    const ticket = ++generation;
    selected = true; selectedSessionId = null; state = null; blocked = null; pending = 'start'; lastExit = null; emit();
    const entry = {ticket, promise: request('/api/v1/admin/playtest/start', 'POST', {idempotencyKey})}; starting = entry;
    try {
      const result = await entry.promise;
      if (ticket !== generation) return current();
      pending = null; available = true; return accept(result, ticket, true);
    } catch (error) {
      if (ticket !== generation) return current();
      block(error, ticket, error.status === 401 || error.status === 403); throw error;
    } finally { if (starting === entry) starting = null; }
  }
  async function stop(idempotencyKey = key()) {
    if (preview) return {active: false, mode: 'player'};
    const ticket = ++generation; const inFlightStart = starting;
    let sessionId = selectedSessionId;
    pending = 'stop'; emit();
    const leave = result => {
      if (ticket !== generation) return current();
      selected = false; selectedSessionId = null; state = null; blocked = null; pending = null; lastExit = clone(result); forgetSelection(); emit(); return current();
    };
    try {
      // A stop issued during start closes that exact new sandbox after its
      // response, without allowing the late start to repaint the player view.
      if (!sessionId && inFlightStart) { const result = await inFlightStart.promise; sessionId = result?.sessionId; }
      if (ticket !== generation) return current();
      if (!sessionId) {
        const discovered = await request('/api/v1/admin/playtest');
        if (ticket !== generation) return current();
        if (!discovered.active) return leave(discovered);
        sessionId = discovered.sessionId;
      }
      const result = await request('/api/v1/admin/playtest', 'DELETE', {sessionId, idempotencyKey});
      if (ticket !== generation) return current();
      if (result.active !== false) throw modeError('Owner playtest closure was not confirmed.');
      return leave(result);
    } catch (error) {
      if (ticket !== generation) return current();
      if (error.status === 401 || error.status === 403) {
        available = false;
        // Explicit human exit only. No claim that the server deleted its
        // private, expiring snapshot after owner authorization was revoked.
        return leave({active: false, mode: 'player', serverCloseUnconfirmed: true, notice: error.message});
      }
      block(error, ticket, false); throw error;
    }
  }
  async function action(name, payload = {}, idempotencyKey = key()) {
    ready(); const expectedVersion = state.version; const sessionId = selectedSessionId; const ticket = ++generation;
    try {
      const result = await request('/api/v1/admin/playtest/action', 'POST', {action: name, ...payload, sessionId, expectedVersion, idempotencyKey});
      return accept(result, ticket);
    } catch (error) {
      if (ticket !== generation) return current();
      if (error.status === 401 || error.status === 403 || error.message === 'Owner playtest is not active.' || error.message.includes('Session identity does not match.')) block(error, ticket); throw error;
    }
  }
  const reads = {
    '/api/v1/gameplay': next => next.gameplay,
    '/api/v1/player': next => ({player: next.gameplay.player}),
    '/api/v1/combat': next => next.combat,
    '/api/v1/casino/high-low': next => next.highLow,
    '/api/v1/travel': next => next.gameplay.travel,
    '/api/v1/hospital/quote': next => next.gameplay.hospitalQuote,
    '/api/v1/daily/contract': next => next.dailyContract,
    '/api/v1/notifications': next => ({notifications: next.notifications}),
  };
  const writes = {
    '/api/v1/gym/train': body => ['gym.train', {stat: body.stat, sessions: body.sessions ?? 1}],
    '/api/v1/jobs/work': () => ['job.work', {}],
    '/api/v1/bank/deposit': body => ['bank.deposit', {amount: body.amount}],
    '/api/v1/bank/withdraw': body => ['bank.withdraw', {amount: body.amount}],
    '/api/v1/hospital/heal': () => ['hospital.heal', {}],
    '/api/v1/travel': body => ['travel.start', {id: body.city}],
    '/api/v1/casino/blackjack': body => ['casino.blackjack', {bet: body.bet}],
    '/api/v1/casino/high-low': body => ['casino.high-low', {bet: body.bet, direction: body.direction}],
    '/api/v1/daily/login': () => ['daily.login', {}],
    '/api/v1/daily/contract/claim': () => ['daily.claim', {}],
  };
  /**
   * Hook the application's central JSON requester before its live request.
   * Returns {handled,response}; safe shared GETs such as /city/map pass through.
   * While active, every unknown game mutation fails closed instead of spending
   * the real character's funds. Public content/readiness stays ZonePlatform's
   * responsibility, separate from the labeled sandbox's account status.
   */
  async function route(path, body = {}, method = 'GET') {
    if (!selected) return {handled: false};
    const pathname = new URL(path, location.origin).pathname;
    method = method.toUpperCase();
    if (method === 'GET' && reads[pathname]) {
      ready(); const ticket = generation;
      const next = await refresh();
      if (ticket !== generation || !selected) throw modeError('Owner playtest changed while the request was pending.');
      ready();
      return {handled: true, response: clone(reads[pathname](next))};
    }
    if (method === 'GET' || !pathname.startsWith('/api/v1/') || pathname.startsWith('/api/v1/admin/') || pathname.startsWith('/api/v1/auth/')) return {handled: false};
    ready();
    let mapped = writes[pathname]?.(body);
    if (pathname === '/api/v1/gameplay/action') mapped = [body.action, {id: body.id ?? '', ...(body.expectedPrice === undefined ? {} : {expectedPrice: body.expectedPrice})}];
    const crime = pathname.match(/^\/api\/v1\/crimes\/([a-z0-9-]+)\/attempt$/);
    if (crime) mapped = ['crime.attempt', {id: crime[1]}];
    if (pathname === '/api/v1/combat/action') mapped = [`combat.${body.action}`, {opponentId: body.opponentId ?? '', approach: body.approach ?? ''}];
    if (!mapped || !state.capabilities.includes(mapped[0])) {
      const error = new Error('This shared action is not available in isolated Owner Playtest. Exit playtesting to use your real account.');
      error.status = 422; throw error;
    }
    const operation = action(...mapped); const ticket = generation; const next = await operation;
    if (ticket !== generation || !selected) throw modeError('Owner playtest changed while the request was pending.');
    ready();
    // Existing consumers retain their normal response contract. Sandbox state
    // is broadcast separately, so normal balances are never forged or cached.
    // Actual settlement costs and journal receipts remain untouched in snapshot
    // result/receipt. UI state uses the post-playtest resource refill and clock.
    const response = pathname === '/api/v1/gameplay/action'
      ? {...clone(next.gameplay), result: clone(next.result.result)}
      : clone(next.result);
    if (Object.hasOwn(response, 'player')) response.player = clone(next.gameplay.player);
    if (Object.hasOwn(response, 'cooldowns')) response.cooldowns = clone(next.gameplay.cooldowns);
    return {handled: true, response};
  }
  window.zoneOwnerPlaytest = Object.freeze({
    configure: options => { if (options?.request && typeof options.request !== 'function') throw new TypeError('Playtest transport must be a function.'); transport = options?.request ?? null; },
    probe, refresh, recover, start, stop, action, route,
    snapshot: () => selected ? current() : null, available: () => available, active: () => selected,
    expired: () => Boolean(blocked?.expired),
    supportedReadRoutes: () => Object.keys(reads),
    supportedWriteRoutes: () => Object.keys(writes),
    isSupportedReadRoute: path => Object.hasOwn(reads, String(path ?? '')),
    isSupportedWriteRoute: path => Object.hasOwn(writes, String(path ?? '')),
    selectionStorageKey: () => selectionKey,
    isValidPlaytestSessionId: id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id),
    isBlocked: () => Boolean(blocked) || (selected && !state),
    isPending: () => Boolean(pending),
    isReady: () => Boolean(selected && state && !blocked && !['start', 'stop', 'recover'].includes(pending)),
    selectedSessionId: () => selectedSessionId,
    diagnostics: () => ({
      preview,
      available,
      active: selected,
      sessionId: selectedSessionId,
      version: state?.version ?? null,
      blocked: Boolean(blocked),
      expired: Boolean(blocked?.expired),
      retryableRead: Boolean(blocked?.retryableRead),
      pending,
      capabilityCount: Array.isArray(state?.capabilities) ? state.capabilities.length : 0,
    }),
  });
})();
