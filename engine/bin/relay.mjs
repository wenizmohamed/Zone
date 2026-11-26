import http from 'node:http';
import { timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

const publicPaths = new Set(['auth/account', 'auth/claim', 'auth/login', 'auth/recover', 'auth/logout', 'auth/session',
  'health', 'engine', 'modules', 'themes', 'player', 'leaderboards', 'gameplay', 'gameplay/action', 'combat', 'combat/action',
  'player-combat', 'player-combat/opponents', 'player-combat/action', 'player-market', 'player-market/action',
  'family-activities', 'family-activities/action', 'crimes', 'achievements', 'city/map', 'factions/join', 'releases/active',
  'game/bootstrap', 'cities', 'gym/train', 'bank/deposit', 'bank/withdraw', 'hospital/heal', 'hospital/quote', 'hospital/patients', 'hospital/revive-player', 'travel',
  'foreign-market', 'foreign-market/action', 'faction-chain', 'faction-chain/action', 'player-profile', 'player-profile/avatar', 'events-feed',
  'story-campaign', 'story-campaign/action', 'player-rpg', 'player-rpg/action', 'ascension', 'ascension/action', 'tactical', 'tactical/action', 'economy-security', 'economy-security/action', 'faction-war', 'faction-war/action', 'synergies', 'synergies/action', 'settings', 'settings/action', 'syndicate-chat', 'syndicate-chat/action', 'chat', 'chat/action', 'companions', 'companions/action', 'city-activities', 'city-activities/action', 'syndicate-economy', 'syndicate-economy/action', 'faction-empire', 'faction-empire/action',
  'casino/blackjack', 'casino/high-low', 'casino/roulette', 'casino/slots', 'social', 'social/action', 'jobs/work', 'attack', 'daily/login', 'daily/contract', 'daily/contract/claim', 'notifications']);
export function isPublicPath(path) {
  if (/^\/api\/v1\/assets\/[a-f0-9]{64}(?:\/content)?$/.test(path) || ['/api/v1/world', '/api/v1/world/claim'].includes(path)) return true;
  if (path === '/engine/theme.css') return true;
  if (!/^\/api\/v1\/[A-Za-z0-9/-]+$/.test(path) || path.includes('//') || path.endsWith('/')) return false;
  const route = path.slice('/api/v1/'.length);
  return publicPaths.has(route) || /^crimes\/[a-z0-9-]+\/attempt$/.test(route) || /^territories\/ZC-[0-9]{3}\/action$/.test(route);
}
export function ownerMethods(path) {
  if (/^\/api\/v1\/assets\/[a-f0-9]{64}(?:\/content)?$/.test(path) || ['/api/v1/admin/assets', '/api/v1/admin/workers'].includes(path) || /^\/api\/v1\/admin\/assets\/[a-f0-9]{64}$/.test(path)) return ['GET', 'HEAD'];
  if (path === '/api/v1/admin/assets/uploads' || /^\/api\/v1\/admin\/assets\/uploads\/[a-f0-9]{32}\/(?:chunks|complete)$/.test(path)) return ['POST'];
  if (path === '/api/v1/admin/shop-catalog' || /^\/api\/v1\/admin\/assets\/[a-f0-9]{64}\/transform$/.test(path)) return ['PUT'];
  if (['/engine', '/engine/', '/engine/assets/engine.css', '/engine/assets/engine.js', '/api/v1/ledger', '/api/v1/events', '/api/v1/architecture'].includes(path)) return ['GET', 'HEAD'];
  if (path === '/api/v1/admin/session') return ['GET', 'POST', 'DELETE'];
  if (path === '/api/v1/admin/playtest') return ['GET', 'DELETE'];
  if (['/api/v1/admin/playtest/start', '/api/v1/admin/playtest/action'].includes(path)) return ['POST'];
  if (path === '/api/v1/admin/draft') return ['GET', 'PUT'];
  if (['/api/v1/admin/releases', '/api/v1/admin/crimes', '/api/v1/admin/audit', '/api/v1/admin/territories', '/api/v1/admin/gameplay-catalog'].includes(path)) return ['GET'];
  if (/^\/api\/v1\/admin\/(?:crimes\/[a-z0-9-]+|gameplay-catalog\/[a-z]+\/[A-Za-z0-9_-]+)$/.test(path)) return ['PUT'];
  if (path === '/api/v1/admin/releases/publish' || /^\/api\/v1\/admin\/(?:releases\/[a-f0-9]{32}\/activate|modules\/[a-z0-9-]+\/(?:install|uninstall|enable|disable)|themes\/[a-z0-9-]+\/activate|territories\/ZC-[0-9]{3}\/ownership|gameplay-catalog\/[a-z]+)$/.test(path)) return ['POST'];
  return [];
}
export function relayRouteDiagnostics() {
  return {
    publicRouteCount: publicPaths.size,
    supportsAssetContent: isPublicPath('/api/v1/assets/' + 'a'.repeat(64) + '/content'),
    supportsWorldRoutes: isPublicPath('/api/v1/world') && isPublicPath('/api/v1/world/claim'),
    supportsThemeCss: isPublicPath('/engine/theme.css'),
  };
}
export function publicRoutePaths() {
  return Array.from(publicPaths);
}
export function publicRouteCount() {
  return publicPaths.size;
}
export function defaultRelayUpstreamPort() {
  return 4301;
}
export function defaultRelayTimeoutMs() {
  return 18000;
}
export function defaultRelayMaxRequestBytes() {
  return 65536;
}
export function defaultRelayMaxDraftBytes() {
  return 1048576;
}
export function defaultRelayMaxResponseBytes() {
  return 4194304;
}
function host(value) {
  const normalized = String(value ?? '').toLowerCase();
  return /^(?:localhost|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::443)?$/.test(normalized) && !normalized.includes('..') ? normalized.replace(/:443$/, '') : null;
}
function onceHeader(request, name) {
  let value = null;
  for (let index = 0; index < request.rawHeaders.length; index += 2) if (request.rawHeaders[index].toLowerCase() === name) {
    if (value !== null) return null;
    value = request.rawHeaders[index + 1];
  }
  return value;
}
function sameSecret(value, key) {
  if (typeof value !== 'string') return false;
  const left = Buffer.from(value); const right = Buffer.from(key);
  return left.length === right.length && timingSafeEqual(left, right);
}
function reply(response, status, error) {
  if (response.headersSent || response.destroyed) return;
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify({ error }));
}
export function createRelay({ key, publicHosts, upstreamPort = 4301, timeoutMs = 18000, maxRequestBytes = 65536, maxDraftBytes = 1048576, maxResponseBytes = 4194304, controlEnabled = false }) {
  if (typeof key !== 'string' || !/^[\x21-\x7e]{32,512}$/.test(key)) throw new Error('A strong relay secret is required.');
  const hosts = new Set((Array.isArray(publicHosts) ? publicHosts : String(publicHosts ?? '').split(',')).map(host));
  if (hosts.size < 1 || hosts.has(null)) throw new Error('Exact public host allowlist is required.');
  if (!Number.isInteger(upstreamPort) || upstreamPort < 1 || upstreamPort > 65535) throw new Error('Invalid local engine port.');
  const server = http.createServer({ maxHeaderSize: 16384, requestTimeout: 20000 }, async (request, response) => {
    if (!sameSecret(onceHeader(request, 'x-zone-relay-key'), key)) return reply(response, 401, 'Relay authentication required.');
    const url = request.url ?? '';
    if (controlEnabled && url === '/__zone_relay_stop') {
      const address = server.address();
      if (request.method !== 'POST' || request.socket.remoteAddress !== '127.0.0.1' || onceHeader(request, 'host') !== `127.0.0.1:${address.port}`
        || request.headers['transfer-encoding'] || Number(request.headers['content-length'] ?? 0) !== 0) return reply(response, 403, 'Local relay control rejected.');
      response.once('finish', () => { server.close(); server.closeIdleConnections(); });
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'connection': 'close' });
      response.end('{"stopping":true}'); return;
    }
    const question = url.indexOf('?'); const path = question < 0 ? url : url.slice(0, question);
    const owner = ownerMethods(path);
    if ((!isPublicPath(path) && owner.length === 0) || /[\x00-\x20\x7f\\#]/.test(url)) return reply(response, 404, 'Route not found.');
    if (!(owner.length ? owner : ['GET', 'HEAD', 'POST', 'OPTIONS']).includes(request.method)) { request.resume(); return reply(response, 405, 'Method not allowed.'); }
    if (path === '/engine/theme.css' && !['GET', 'HEAD'].includes(request.method)) return reply(response, 405, 'Theme stylesheet is read-only.');
    const clientHost = host(onceHeader(request, 'x-zone-client-host'));
    const clientIP = onceHeader(request, 'x-zone-client-ip');
    if (!clientHost || !hosts.has(clientHost) || onceHeader(request, 'x-zone-client-proto') !== 'https' || !isIP(clientIP ?? '')) return reply(response, 403, 'Invalid gateway metadata.');
    const origin = onceHeader(request, 'origin');
    if (['POST', 'PUT', 'DELETE'].includes(request.method) && origin !== `https://${clientHost}`) return reply(response, 403, 'Cross-origin request rejected.');
    const largeDraft = request.method === 'PUT' && ['/api/v1/admin/draft', '/api/v1/admin/shop-catalog'].includes(path);
    const assetChunk = request.method === 'POST' && /^\/api\/v1\/admin\/assets\/uploads\/[a-f0-9]{32}\/chunks$/.test(path);
    const avatarUpload = request.method === 'POST' && path === '/api/v1/player-profile/avatar';
    const requestLimit = largeDraft || assetChunk || avatarUpload ? maxDraftBytes : maxRequestBytes;
    if (Number(request.headers['content-length'] ?? 0) > requestLimit) return reply(response, 413, 'Request body is too large.');
    const chunks = []; let bytes = 0;
    try {
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > requestLimit) { reply(response, 413, 'Request body is too large.'); return; }
        chunks.push(chunk);
      }
    } catch { return reply(response, 400, 'Invalid request body.'); }
    const body = Buffer.concat(chunks);
    const headers = { host: `127.0.0.1:${upstreamPort}`, 'x-zone-gateway-key': key, 'x-zone-gateway-host': clientHost, 'x-zone-gateway-proto': 'https', 'x-zone-gateway-ip': clientIP };
    const proof = onceHeader(request, 'x-zone-owner-proof');
    const match = typeof proof === 'string' ? /^([0-9]{10})\.([a-f0-9]{64})$/.exec(proof) : null;
    if (owner.length && match && Math.abs(Date.now() / 1000 - Number(match[1])) < 30) {
      const signature = createHmac('sha256', key).update(`owner-gateway:\n${request.method}\n${url}\n${createHash('sha256').update(body).digest('hex')}\n${match[1]}`).digest('hex');
      if (sameSecret(match[2], signature)) headers['x-zone-gateway-owner'] = '1';
    }
    // An allowlist strips caller-supplied owner tokens, forwarding and gateway headers.
    for (const name of ['accept', 'content-type', 'origin', 'referer', 'user-agent', 'x-zone-player-id', 'x-zone-player-token']) {
      const value = onceHeader(request, name); if (value !== null) headers[name] = value;
    }
    const cookie = onceHeader(request, 'cookie');
    const cookieNames = owner.length ? ['zone_player_session', 'zone_admin_session'] : ['zone_player_session'];
    if (cookie !== null) headers.cookie = cookie.split(';').filter(part => cookieNames.includes(part.trim().split('=')[0])).join(';');
    if (body.length > 0 || ['POST', 'PUT', 'DELETE'].includes(request.method)) headers['content-length'] = String(body.length);
    const downstream = http.request({ hostname: '127.0.0.1', port: upstreamPort, path: url, method: request.method, headers, agent: false }, incoming => {
      const output = []; let received = 0;
      incoming.on('data', chunk => {
        received += chunk.length;
        if (received > maxResponseBytes) { downstream.destroy(); reply(response, 502, 'Engine response is too large.'); return; }
        output.push(chunk);
      });
      incoming.on('aborted', () => reply(response, 503, 'Local engine is unavailable. Reload saved state before repeating an action.'));
      incoming.on('error', () => reply(response, 503, 'Local engine is unavailable. Reload saved state before repeating an action.'));
      incoming.on('end', () => {
        if (response.headersSent || response.destroyed) return;
        const exposed = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
        if (path === '/api/v1/player-profile/avatar' && incoming.statusCode === 200 && typeof incoming.headers['content-type'] === 'string' && incoming.headers['content-type'].toLowerCase().startsWith('image/') && typeof incoming.headers['cache-control'] === 'string') {
          exposed['cache-control'] = incoming.headers['cache-control'];
        }
        for (const name of ['content-type', 'retry-after', 'content-security-policy', 'referrer-policy', 'permissions-policy', 'x-zone-server-ms', 'x-zone-sync-state']) if (incoming.headers[name] !== undefined) exposed[name] = incoming.headers[name];
        if (incoming.headers['set-cookie']) exposed['set-cookie'] = incoming.headers['set-cookie'].filter(value => value.startsWith('zone_player_session=') || (path === '/api/v1/admin/session' && value.startsWith('zone_admin_session='))).map(value => {
          // Authenticated public requests always set a host-only browser cookie.
          const parts = value.split(';').filter(part => !/^\s*(domain|secure|httponly|samesite)\b/i.test(part));
          return [...parts, 'Secure', 'HttpOnly', 'SameSite=Strict'].join(';');
        });
        if (typeof incoming.headers.location === 'string' && isPublicPath(incoming.headers.location)) exposed.location = incoming.headers.location;
        const completeBody = Buffer.concat(output);
        exposed['content-length'] = String(completeBody.length);
        response.writeHead(incoming.statusCode ?? 502, exposed); response.end(completeBody);
      });
    });
    downstream.setTimeout(timeoutMs, () => downstream.destroy());
    downstream.on('error', () => reply(response, 503, 'Local engine is unavailable. Reload saved state before repeating an action.'));
    response.on('close', () => { if (!response.writableEnded) downstream.destroy(); });
    downstream.end(body);
  });
  server.headersTimeout = 10000;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const port = Number(process.env.ZONE_ENGINE_RELAY_PORT ?? 55435);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid relay port.');
    const server = createRelay({ key: process.env.ZONE_ENGINE_RELAY_KEY, publicHosts: process.env.ZONE_ENGINE_PUBLIC_HOSTS, upstreamPort: Number(process.env.ZONE_ENGINE_LOCAL_PORT ?? 4301), controlEnabled: true });
    server.on('error', () => { console.error('Relay listener could not start.'); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`ZONE relay listening on 127.0.0.1:${port}`));
  } catch { console.error('Relay configuration is invalid.'); process.exitCode = 1; }
}
