import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { randomBytes, createHash, createHmac } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRelay } from '../bin/relay.mjs';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const php = join(repo, '.tools/php-8.5.10/php.exe');
const key = randomBytes(32).toString('hex');
const publicHost = 'zone.test';
let checks = 0;
function proof(ok, label) { assert.ok(ok, label); checks++; console.log(`PASS: ${label}`); }
const servers = []; const children = [];
const ownedRelays = [];
const fixture = await mkdtemp(join(repo, 'engine/var/relay-http-'));
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); servers.push(server); return server.address().port; }
async function unusedPort() { const server = http.createServer(); const port = await listen(server); await new Promise(resolve => server.close(resolve)); servers.splice(servers.indexOf(server), 1); return port; }
async function request(port, path, { method = 'GET', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: { ...(body ? { 'content-length': String(Buffer.byteLength(body)) } : {}), ...headers } }, res => {
      let output = ''; res.setEncoding('utf8'); res.on('data', chunk => { output += chunk; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: output }));
    });
    req.on('error', reject); req.setTimeout(10000, () => req.destroy(new Error('Test HTTP timeout.'))); req.end(body);
  });
}
const authorized = { 'x-zone-relay-key': key, 'x-zone-client-host': publicHost, 'x-zone-client-proto': 'https', 'x-zone-client-ip': '198.51.100.17' };
async function startPHP(router, env = {}, options = []) {
  const port = await unusedPort(); let error = '';
  const child = spawn(php, [...options, '-S', `127.0.0.1:${port}`, router], { cwd: repo, env: { ...process.env, VERCEL: '', ZONE_DATABASE_URL: `sqlite:${join(fixture, 'game.sqlite')}`, ZONE_PLAYER_SESSIONS: '1', ZONE_ADMIN_TOKEN: '', ZONE_BETA_OWNER_ACCESS: '0', ZONE_ENGINE_ORIGIN: '', ZONE_ENGINE_RELAY_KEY: key, ZONE_ENGINE_PUBLIC_HOSTS: publicHost, ...env }, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  children.push(child); child.stderr.on('data', value => { error += value; });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`Test PHP process exited: ${error}`);
    try { await request(port, '/api/v1/health', { headers: { host: publicHost } }); return port; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  throw new Error('Isolated PHP engine failed to start.');
}
try {
  proof(typeof createRelay === 'function', 'authenticated relay implementation exists');
  assert.throws(() => createRelay({ key: 'weak', publicHosts: [publicHost] }));
  assert.throws(() => createRelay({ key, publicHosts: [] }));
  proof(true, 'weak secrets and missing public allowlists fail closed at startup');
  const seen = [];
  const mockPort = await listen(http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    seen.push({ path: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString() });
    if (req.url.includes('cut=1')) { req.socket.destroy(); return; }
    if (req.url.includes('slow=1')) { setTimeout(() => res.end('{}'), 300); return; }
    if (req.url.includes('redirect=1')) { res.writeHead(302, { location: '/api/v1/health' }); res.end('redirect'); return; }
    if (req.url.includes('rate=1')) { res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '9' }); res.end('{"error":"cooldown"}'); return; }
    res.writeHead(req.method === 'POST' ? 201 : 200, { 'content-type': 'application/json', 'set-cookie': ['zone_player_session=fixture; Path=/; SameSite=Lax; Domain=localhost', 'zone_admin_session=blocked; Path=/'], 'x-zone-gateway-key': key, 'x-private': 'private' });
    res.end('{"ok":true}');
  }));
  const relayPort = await listen(createRelay({ key, publicHosts: [publicHost], upstreamPort: mockPort, timeoutMs: 100 }));
  proof((await request(relayPort, '/api/v1/health')).status === 401 && seen.length === 0, 'missing relay key cannot reach the engine');
  proof((await request(relayPort, '/api/v1/health', { headers: { ...authorized, 'x-zone-relay-key': key + 'wrong' } })).status === 401 && seen.length === 0, 'incorrect relay key cannot reach the engine');
  proof((await request(relayPort, '/api/v1/health', { headers: { ...authorized, 'x-zone-relay-key': [key, key] } })).status === 401 && seen.length === 0, 'duplicate authentication headers are rejected rather than merged');
  for (const path of ['/api/v1/admin', '/api/v1/admin/unknown-owner-route', '/engine/var/private.sqlite', '/.tools/local-beta-config.json', '/api/v1/%61dmin/session', '/api/v1/%2561dmin/session', '/api/v1/../admin', '/api/v1//health', '/api/v1/health/../../.env', '/api/v1/private-new-owner-route']) {
    proof((await request(relayPort, path, { headers: authorized })).status === 404, `relay rejects private or ambiguous path ${path}`);
  }
  proof(seen.length === 0, 'denied private requests make no downstream calls');
  proof((await request(relayPort, '/api/v1/health', { headers: { ...authorized, 'x-zone-client-host': 'localhost' } })).status === 403 && (await request(relayPort, '/api/v1/health', { headers: { ...authorized, 'x-zone-client-ip': '198.51.100.17, 127.0.0.1' } })).status === 403, 'host and client IP metadata require exact authorized values');
  proof((await request(relayPort, '/api/v1/bank/deposit', { method: 'POST', headers: authorized, body: '{}' })).status === 403 && (await request(relayPort, '/api/v1/bank/deposit', { method: 'POST', headers: { ...authorized, origin: 'https://evil.test' }, body: '{}' })).status === 403, 'missing and foreign mutation Origins are rejected before forwarding');
  const first = await request(relayPort, '/api/v1/auth/session?proof=1', { method: 'POST', headers: { ...authorized, origin: `https://${publicHost}`, 'content-type': 'application/json', cookie: 'zone_player_session=existing; zone_admin_session=owner; irrelevant=1', 'x-zone-admin-token': 'owner-token', 'x-zone-gateway-key': 'forged', 'x-zone-gateway-host': 'localhost', 'x-forwarded-for': '127.0.0.1', 'x-forwarded-proto': 'http', authorization: 'Bearer attacker' }, body: '{"actual":true}' });
  proof(first.status === 201 && seen.length === 1 && seen[0].body === '{"actual":true}' && seen[0].path === '/api/v1/auth/session?proof=1', 'real method, body, query and downstream status survive one forward');
  proof(seen[0].headers['x-zone-gateway-key'] === key && seen[0].headers['x-zone-gateway-host'] === publicHost && seen[0].headers['x-zone-gateway-ip'] === '198.51.100.17' && seen[0].headers['x-zone-gateway-proto'] === 'https' && !seen[0].headers['x-forwarded-for'] && !seen[0].headers.authorization && !seen[0].headers['x-zone-admin-token'] && seen[0].headers.cookie.trim() === 'zone_player_session=existing', 'relay reconstructs authenticated gateway context and strips owner and spoofed forwarding headers');
  proof(first.headers['set-cookie'].length === 1 && /Secure/.test(first.headers['set-cookie'][0]) && /HttpOnly/.test(first.headers['set-cookie'][0]) && /SameSite=Strict/.test(first.headers['set-cookie'][0]) && !/Domain=/.test(first.headers['set-cookie'][0]) && !first.headers['x-zone-gateway-key'] && !first.headers['x-private'], 'only public session cookie escapes with enforced security flags and no private headers');
  const limited = await request(relayPort, '/api/v1/player?rate=1', { headers: authorized });
  proof(limited.status === 429 && limited.headers['retry-after'] === '9' && JSON.parse(limited.body).error === 'cooldown', 'downstream cooldown status, body and Retry-After are preserved');
  let before = seen.length;
  const redirect = await request(relayPort, '/api/v1/player?redirect=1', { headers: authorized });
  proof(redirect.status === 302 && seen.length === before + 1, 'relay does not follow redirects to a second request');
  before = seen.length;
  const cut = await request(relayPort, '/api/v1/bank/deposit?cut=1', { method: 'POST', headers: { ...authorized, origin: `https://${publicHost}` }, body: '{}' });
  proof(cut.status === 503 && seen.length === before + 1 && !cut.body.includes(key), 'interrupted write returns unavailable without a retry or secret disclosure');
  before = seen.length;
  const slow = await request(relayPort, '/api/v1/player?slow=1', { headers: authorized });
  proof(slow.status === 503 && seen.length === before + 1, 'bounded downstream timeout does not retry');
  proof((await request(relayPort, '/api/v1/bank/deposit', { method: 'POST', headers: { ...authorized, origin: `https://${publicHost}` }, body: 'x'.repeat(65537) })).status === 413, 'relay bounds mutation request bodies before an engine action');

  const enginePort = await startPHP(join(repo, 'engine/router.php'));
  const gameRelay = await listen(createRelay({ key, publicHosts: [publicHost], upstreamPort: enginePort }));
  const stylesheet = await request(gameRelay, '/engine/theme.css', { headers: authorized });
  proof(stylesheet.status === 200 && /^text\/css\b/.test(stylesheet.headers['content-type'] ?? '') && stylesheet.body.trim().length > 0, 'exact public theme route delivers real published CSS with CSS MIME through gateway');
  const stylesheetHead = await request(gameRelay, '/engine/theme.css', { method: 'HEAD', headers: authorized });
  proof(stylesheetHead.status === 200 && /^text\/css\b/.test(stylesheetHead.headers['content-type'] ?? '') && stylesheetHead.body === '', 'public stylesheet HEAD preserves CSS MIME with an empty body');
  before = seen.length;
  proof((await request(relayPort, '/engine/theme.css', { method: 'POST', headers: { ...authorized, origin: `https://${publicHost}` }, body: '{}' })).status === 405 && seen.length === before, 'gateway rejects stylesheet POST before any downstream request');
  const session = await request(gameRelay, '/api/v1/auth/session', { method: 'POST', headers: { ...authorized, origin: `https://${publicHost}`, 'content-type': 'application/json' }, body: '{}' });
  proof(session.status === 201 && JSON.parse(session.body).mode === 'persistent-browser', 'authenticated relay reaches a real isolated PHP engine and creates a real persistent player');
  const playerCookie = session.headers['set-cookie'][0].split(';')[0];
  const player = await request(gameRelay, '/api/v1/player', { headers: { ...authorized, cookie: playerCookie } });
  proof(player.status === 200 && JSON.parse(player.body).player.id === JSON.parse(session.body).playerId, 'real browser cookie selects the saved player across relay requests');
  proof((await request(enginePort, '/api/v1/player', { headers: { 'x-zone-gateway-key': 'forged', 'x-zone-gateway-host': publicHost, 'x-zone-gateway-proto': 'https', 'x-zone-gateway-ip': '127.0.0.1' } })).status === 403, 'real engine rejects a forged authenticated gateway header');
  const admin = await request(enginePort, '/api/v1/admin/session', { headers: { 'x-zone-gateway-key': key, 'x-zone-gateway-host': publicHost, 'x-zone-gateway-proto': 'https', 'x-zone-gateway-ip': '127.0.0.1' } });
  proof(admin.status === 200 && JSON.parse(admin.body).authenticated === false && JSON.parse(admin.body).localDevelopment === false, 'authenticated public gateway cannot inherit local owner shortcut even with loopback asserted IP');
  proof((await request(gameRelay, '/api/v1/admin/draft', { headers: { ...authorized, cookie: 'zone_admin_session=forged', 'x-zone-admin-token': key } })).status === 401, 'owner routing never grants access using a forged cookie or client admin header');
  const ownerPassword = 'isolated owner password for HTTP regressions';
  const ownerHash = execFileSync(php, ['-r', 'echo password_hash($argv[1], PASSWORD_DEFAULT);', ownerPassword], { windowsHide: true }).toString();
  const ownerPort = await startPHP(join(repo, 'engine/router.php'), { ZONE_ADMIN_USERNAME: 'isolated-owner', ZONE_ADMIN_PASSWORD_HASH: ownerHash, ZONE_ADMIN_SESSION_SECRET: randomBytes(32).toString('hex') });
  const ownerRelay = await listen(createRelay({ key, publicHosts: [publicHost], upstreamPort: ownerPort }));
  const ownerStatus = await request(ownerRelay, '/api/v1/admin/session', { headers: authorized });
  proof(ownerStatus.status === 200 && JSON.parse(ownerStatus.body).configured && JSON.parse(ownerStatus.body).credentialMode === 'password' && !JSON.parse(ownerStatus.body).authenticated, 'existing username/password configuration exposes a locked login status through the relay');
  proof((await request(ownerRelay, '/api/v1/admin/session', { method: 'POST', headers: { ...authorized, origin: `https://${publicHost}` }, body: JSON.stringify({ username: 'isolated-owner', password: 'incorrect' }) })).status === 401, 'wrong owner password is rejected by the actual engine');
  const ownerLogin = await request(ownerRelay, '/api/v1/admin/session', { method: 'POST', headers: { ...authorized, origin: `https://${publicHost}`, 'content-type': 'application/json' }, body: JSON.stringify({ username: 'isolated-owner', password: ownerPassword }) });
  const ownerCookie = ownerLogin.headers['set-cookie']?.find(value => value.startsWith('zone_admin_session='))?.split(';')[0];
  proof(ownerLogin.status === 200 && ownerCookie && /Secure;HttpOnly;SameSite=Strict/.test(ownerLogin.headers['set-cookie'].join(';').replaceAll(' ', '')) && !ownerLogin.body.includes(ownerPassword), 'owner password login forwards a signed host-only secure cookie without leaking credentials');
  const ownerHeaders = { ...authorized, cookie: ownerCookie, origin: `https://${publicHost}`, 'content-type': 'application/json' };
  for (const path of ['/api/v1/admin/session', '/api/v1/engine', '/api/v1/modules', '/api/v1/themes', '/api/v1/admin/crimes', '/api/v1/ledger', '/api/v1/events', '/api/v1/admin/audit', '/api/v1/admin/draft', '/api/v1/admin/releases', '/api/v1/admin/territories', '/api/v1/admin/gameplay-catalog', '/api/v1/architecture']) {
    proof((await request(ownerRelay, path, { headers: ownerHeaders })).status === 200, `authenticated admin bootstrap succeeds through relay: ${path}`);
  }
  for (const lang of ['en', 'ar']) {
    const consolePage = await request(ownerRelay, `/engine?lang=${lang}`, { headers: ownerHeaders });
    proof(consolePage.status === 200 && consolePage.body.includes(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`) && /^text\/html/.test(consolePage.headers['content-type']), `engine page returns real ${lang} HTML instead of a route error`);
  }
  for (const asset of ['engine.css', 'engine.js']) proof((await request(ownerRelay, `/engine/assets/${asset}`, { headers: ownerHeaders })).status === 200, `engine console asset is delivered: ${asset}`);
  const draft = JSON.parse((await request(ownerRelay, '/api/v1/admin/draft', { headers: ownerHeaders })).body);
  const savedDraft = await request(ownerRelay, '/api/v1/admin/draft', { method: 'PUT', headers: ownerHeaders, body: JSON.stringify({ manifest: draft.manifest, expectedFingerprint: draft.draftFingerprint }) });
  proof(savedDraft.status === 200, 'real owner draft PUT survives the relay with its exact method and body');
  const catalog = JSON.parse((await request(ownerRelay, '/api/v1/admin/gameplay-catalog', { headers: ownerHeaders })).body);
  const itemId = Object.keys(catalog.catalogs.items)[0];
  const price = catalog.catalogs.items[itemId].price;
  const changedCatalog = await request(ownerRelay, `/api/v1/admin/gameplay-catalog/items/${itemId}`, { method: 'PUT', headers: ownerHeaders, body: JSON.stringify({ expectedRevision: catalog.revision, changes: { price: price + 1 } }) });
  proof(changedCatalog.status === 200 && JSON.parse(changedCatalog.body).catalogs.items[itemId].price === price + 1, 'admin catalog write is persisted by the actual engine through relay');
  for (const method of ['PUT', 'DELETE']) proof((await request(ownerRelay, method === 'PUT' ? '/api/v1/admin/draft' : '/api/v1/admin/session', { method, headers: { ...ownerHeaders, origin: 'https://evil.test' }, body: '{}' })).status === 403, `owner ${method} rejects cross-origin requests before forwarding`);
  proof((await request(ownerRelay, '/api/v1/player', { method: 'PUT', headers: ownerHeaders, body: '{}' })).status === 405, 'support for admin PUT never enables arbitrary public writes');
  const ownerLogout = await request(ownerRelay, '/api/v1/admin/session', { method: 'DELETE', headers: ownerHeaders });
  proof(ownerLogout.status === 200 && ownerLogout.headers['set-cookie'].some(cookie => /^zone_admin_session=/.test(cookie) && /expires=/i.test(cookie)), 'owner logout forwards its expired signed-session cookie');
  proof((await request(gameRelay, '/api/v1/bank/deposit', { method: 'POST', headers: { ...authorized, cookie: playerCookie, origin: 'http://127.0.0.1', 'x-forwarded-proto': 'https' }, body: '{"amount":1}' })).status === 403, 'forwarded-proto spoof cannot turn a cross-origin real player write into same-origin');

  const opensslConfig = join(fixture, 'openssl.cnf'); const certFile = join(fixture, 'cert.pem'); const privateFile = join(fixture, 'key.pem');
  await writeFile(opensslConfig, '[req]\ndistinguished_name=dn\nx509_extensions=extensions\n[dn]\n[extensions]\nsubjectAltName=IP:127.0.0.1,DNS:localhost\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\n', 'utf8');
  execFileSync(php, ['-d', 'extension=openssl', '-r', '$config=["config"=>$argv[1],"digest_alg"=>"sha256","private_key_bits"=>2048,"private_key_type"=>OPENSSL_KEYTYPE_RSA,"x509_extensions"=>"extensions"]; $key=openssl_pkey_new($config); $csr=openssl_csr_new(["commonName"=>"localhost"],$key,$config); $cert=openssl_csr_sign($csr,null,$key,2,$config); openssl_pkey_export($key,$pem,null,$config); file_put_contents($argv[2],$pem); openssl_x509_export($cert,$public); file_put_contents($argv[3],$public);', opensslConfig, privateFile, certFile], { cwd: repo, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const tlsSeen = [];
  const tlsPort = await listen(https.createServer({ key: await readFile(privateFile), cert: await readFile(certFile) }, async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    tlsSeen.push({ path: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
    if (req.url.startsWith('/real-relay/')) {
      const upstream = http.request({ hostname: '127.0.0.1', port: gameRelay, path: req.url.slice('/real-relay'.length), method: req.method, headers: req.headers }, incoming => {
        res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res);
      });
      upstream.on('error', () => { res.writeHead(503); res.end('{}'); }); upstream.end(Buffer.concat(chunks)); return;
    }
    if (req.url === '/zone-beta-relay/engine/theme.css') { res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }); res.end(':root { --published-theme-proof: 1; }'); return; }
    if (req.url.includes('cut=1')) { req.socket.destroy(); return; }
    if (req.url.includes('partial=1')) { res.writeHead(201, { 'content-length': '100', 'content-type': 'application/json' }); res.write('{"incomplete":'); setTimeout(() => req.socket.destroy(), 10); return; }
    if (req.url.includes('redirect=1')) { res.writeHead(302, { location: '/api/v1/health' }); res.end('redirect'); return; }
    if (req.url.includes('rate=1')) { res.writeHead(429, { 'retry-after': '7', 'content-type': 'application/json' }); res.end('{"error":"fixture cooldown"}'); return; }
    res.writeHead(201, { 'content-type': 'application/json', 'set-cookie': ['zone_player_session=proxy; Path=/; Domain=localhost; SameSite=Lax', 'zone_admin_session=no; Path=/'], 'x-zone-relay-key': key }); res.end('{"proxied":true}');
  }));
  const proxyOptions = ['-d', 'extension=openssl', '-d', `openssl.cafile=${certFile}`];
  const cloudOwnerProxy = await startPHP(join(repo, 'api/index.php'), { ZONE_ENGINE_ORIGIN: `https://127.0.0.1:${tlsPort}/real-relay`, ZONE_ADMIN_USERNAME: 'isolated-owner', ZONE_ADMIN_PASSWORD_HASH: ownerHash, ZONE_ADMIN_SESSION_SECRET: randomBytes(32).toString('hex') }, proxyOptions);
  const cloudHeaders = { host: publicHost, origin: `https://${publicHost}`, 'content-type': 'application/json' };
  const proxyTarget = path => '/api/index?__zone_path=' + encodeURIComponent(path);
  proof(JSON.parse((await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/session'), { headers: cloudHeaders })).body).configured, 'Vercel owner configuration is recognized without copying credentials to the database host');
  proof((await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/draft'), { headers: cloudHeaders })).status === 401, 'unauthenticated cloud owner reads cannot acquire a gateway proof');
  const cloudLogin = await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/session'), { method: 'POST', headers: cloudHeaders, body: JSON.stringify({ username: 'isolated-owner', password: ownerPassword }) });
  const cloudCookie = cloudLogin.headers['set-cookie']?.find(value => value.startsWith('zone_admin_session='))?.split(';')[0];
  proof(cloudLogin.status === 200 && cloudCookie && !cloudLogin.body.includes(ownerPassword), 'cloud owner login uses existing credentials and issues a private signed session');
  const authenticatedCloud = { ...cloudHeaders, cookie: cloudCookie };
  for (const path of ['/api/v1/admin/draft', '/api/v1/admin/gameplay-catalog', '/api/v1/admin/releases', '/api/v1/admin/audit', '/api/v1/admin/crimes', '/api/v1/admin/territories', '/api/v1/ledger', '/api/v1/events']) {
    proof((await request(cloudOwnerProxy, proxyTarget(path), { headers: authenticatedCloud })).status === 200, `full PHP HTTPS Node PHP owner chain succeeds: ${path}`);
  }
  const cloudDraft = JSON.parse((await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/draft'), { headers: authenticatedCloud })).body);
  proof((await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/draft'), { method: 'PUT', headers: authenticatedCloud, body: JSON.stringify({ manifest: cloudDraft.manifest, expectedFingerprint: cloudDraft.draftFingerprint }) })).status === 200, 'signed owner proof is bound to a real reviewed draft PUT body through all deployment layers');
  const cloudCatalog = JSON.parse((await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/gameplay-catalog'), { headers: authenticatedCloud })).body);
  const newItem = { id: 'relay-proof-baton', expectedRevision: cloudCatalog.revision, definition: { type: 'weapon', price: 321, mult: 2.75, name: { en: 'Relay proof baton', ar: 'عصا اختبار الربط' }, description: { en: 'Isolated regression item.', ar: 'عنصر اختبار معزول.' }, image: 'art/bio.jpg' } };
  const createdItem = await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/gameplay-catalog/items'), { method: 'POST', headers: authenticatedCloud, body: JSON.stringify(newItem) });
  proof(createdItem.status === 201, 'an owner creates a genuinely new bilingual item through the complete deployed transport chain');
  proof(!JSON.parse((await request(cloudOwnerProxy, proxyTarget('/api/v1/game/bootstrap'), { headers: cloudHeaders })).body).content.gameplayCatalog.items['relay-proof-baton'], 'new authored item stays unpublished until owner release approval');
  proof((await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/releases/publish'), { method: 'POST', headers: authenticatedCloud, body: JSON.stringify({ expectedFingerprint: cloudDraft.draftFingerprint }) })).status === 409, 'signed cloud owner cannot publish a stale pre-authoring catalog preview');
  const cloudReviewedDraft = JSON.parse((await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/draft'), { headers: authenticatedCloud })).body);
  const published = await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/releases/publish'), { method: 'POST', headers: authenticatedCloud, body: JSON.stringify({ expectedFingerprint: cloudReviewedDraft.draftFingerprint }) });
  const publishedBootstrap = JSON.parse((await request(cloudOwnerProxy, proxyTarget('/api/v1/game/bootstrap'), { headers: cloudHeaders })).body);
  proof(published.status === 201 && publishedBootstrap.content.gameplayCatalog.items['relay-proof-baton'].price === 321, 'publishing makes the new item available in the real game bootstrap, not only admin preview');
  for (const lang of ['en', 'ar']) {
    const consolePage = await request(cloudOwnerProxy, proxyTarget('/engine') + '&lang=' + lang, { headers: authenticatedCloud });
    proof(consolePage.status === 200 && consolePage.body.includes(`<html lang="${lang}"`), `complete cloud-to-engine chain renders the ${lang} console`);
  }
  const betaProxy = await startPHP(join(repo, 'api/index.php'), { ZONE_ENGINE_ORIGIN: `https://127.0.0.1:${tlsPort}/real-relay`, ZONE_BETA_OWNER_ACCESS: '1' }, proxyOptions);
  const betaSession = await request(betaProxy, proxyTarget('/api/v1/admin/session'), { headers: cloudHeaders });
  const betaAccess = JSON.parse(betaSession.body);
  proof(betaSession.status === 200 && betaAccess.authenticated && betaAccess.betaTesting && !betaSession.headers['set-cookie'], 'explicit tester beta opens admin without credentials, cookies or a login POST');
  for (const path of ['/api/v1/admin/draft', '/api/v1/admin/gameplay-catalog', '/api/v1/admin/releases', '/api/v1/admin/audit', '/api/v1/admin/crimes', '/api/v1/admin/territories', '/api/v1/ledger', '/api/v1/events', '/api/v1/architecture']) {
    proof((await request(betaProxy, proxyTarget(path), { headers: cloudHeaders })).status === 200, `tester beta directly loads real owner data: ${path}`);
  }
  for (const lang of ['en', 'ar']) {
    const page = await request(betaProxy, proxyTarget('/engine') + '&lang=' + lang, { headers: cloudHeaders });
    proof(page.status === 200 && page.body.includes(`<html lang="${lang}"`), `tester beta opens ${lang} engine without redirecting to sign-in`);
  }
  const betaDraft = JSON.parse((await request(betaProxy, proxyTarget('/api/v1/admin/draft'), { headers: cloudHeaders })).body);
  const betaDraftBody = JSON.stringify({ manifest: betaDraft.manifest, expectedFingerprint: betaDraft.draftFingerprint });
  proof((await request(betaProxy, proxyTarget('/api/v1/admin/draft'), { method: 'PUT', headers: cloudHeaders, body: JSON.stringify({ manifest: betaDraft.manifest }) })).status === 422, 'tester beta retains reviewed-draft preconditions even without login');
  proof((await request(betaProxy, proxyTarget('/api/v1/admin/releases/publish'), { method: 'POST', headers: cloudHeaders, body: '{}' })).status === 422, 'tester beta publication rejects a missing configuration fingerprint');
  proof(Buffer.byteLength(betaDraftBody) > 65536, 'draft save regression uses a real published manifest larger than the ordinary action limit');
  const betaSaved = await request(betaProxy, proxyTarget('/api/v1/admin/draft'), { method: 'PUT', headers: cloudHeaders, body: betaDraftBody });
  proof(betaSaved.status === 200, `tester beta can save a genuine draft through the full chain without signing in (${betaSaved.status}: ${betaSaved.status === 200 ? 'saved' : betaSaved.body})`);
  const auditSummary = await request(betaProxy, proxyTarget('/api/v1/admin/audit'), { headers: cloudHeaders });
  const auditDetails = await request(betaProxy, proxyTarget('/api/v1/admin/audit') + '&details=1&limit=100', { headers: cloudHeaders });
  const summaryRows = JSON.parse(auditSummary.body).entries;
  const detailedRows = JSON.parse(auditDetails.body).entries;
  proof(auditSummary.status === 200 && summaryRows.length > 0 && summaryRows.every(row => row.actor && !('previous' in row) && !('next' in row)), 'audit bootstrap returns actual attributed summaries without duplicating stored world snapshots');
  proof(auditDetails.status === 200 && detailedRows.length === 1 && detailedRows[0].id === summaryRows[0].id && Object.hasOwn(detailedRows[0], 'previous') && Object.hasOwn(detailedRows[0], 'next') && detailedRows[0].next && (detailedRows[0].action !== 'DraftSaved' || detailedRows[0].previous), 'full audit snapshots remain readable one at a time, including a legitimately null initial-release previous state');
  const betaReviewedDraft = JSON.parse((await request(betaProxy, proxyTarget('/api/v1/admin/draft'), { headers: cloudHeaders })).body);
  const betaPublished = await request(betaProxy, proxyTarget('/api/v1/admin/releases/publish'), { method: 'POST', headers: cloudHeaders, body: JSON.stringify({ expectedFingerprint: betaReviewedDraft.draftFingerprint }) });
  proof(betaPublished.status === 201, 'tester beta publishes reviewed owner configuration through the actual transport chain');
  proof((await request(betaProxy, proxyTarget('/api/v1/admin/releases/publish'), { method: 'POST', headers: cloudHeaders, body: JSON.stringify({ expectedFingerprint: betaReviewedDraft.draftFingerprint }) })).status === 409, 'tester beta repeated publication cannot replay the reviewed fingerprint');
  const playSession = await request(betaProxy, proxyTarget('/api/v1/auth/session'), {method:'POST',headers:cloudHeaders,body:'{}'});
  const playCookie = playSession.headers['set-cookie']?.find(value=>value.startsWith('zone_player_session='))?.split(';')[0];
  proof(playSession.status === 201 && playCookie, 'owner playtest establishes an isolated browser player through the complete relay chain');
  const playHeaders = {...cloudHeaders,cookie:playCookie};
  const realBefore = JSON.parse((await request(betaProxy,proxyTarget('/api/v1/gameplay'),{headers:playHeaders})).body);
  proof((await request(betaProxy,proxyTarget('/api/v1/admin/playtest'),{headers:playHeaders})).status === 200,'owner playtest status reaches PHP through the signed gateway and relay');
  const playStart = await request(betaProxy,proxyTarget('/api/v1/admin/playtest/start'),{method:'POST',headers:playHeaders,body:JSON.stringify({idempotencyKey:'relay-playtest-start-' + randomBytes(12).toString('hex')})});
  const playData = JSON.parse(playStart.body);
  proof(playStart.status === 201 && playData.active,'owner playtest starts through the complete signed transport chain');
  const playAction = await request(betaProxy,proxyTarget('/api/v1/admin/playtest/action'),{method:'POST',headers:playHeaders,body:JSON.stringify({sessionId:playData.sessionId,expectedVersion:playData.version,idempotencyKey:'relay-playtest-bank-' + randomBytes(12).toString('hex'),action:'bank.deposit',amount:100})});
  proof(playAction.status === 200 && JSON.parse(playAction.body).gameplay.player.bank_balance === 100,'real private bank action settles through gateway, relay and PHP');
  proof((await request(gameRelay,'/api/v1/admin/playtest',{headers:{...authorized,cookie:playCookie}})).status === 401,'ordinary player cannot acquire owner playtest access through relay');
  proof((await request(betaProxy,proxyTarget('/api/v1/admin/playtest/start'),{method:'GET',headers:playHeaders})).status === 405,'owner playtest start does not admit an unreviewed method');
  proof((await request(betaProxy,proxyTarget('/api/v1/admin/playtest/action'),{method:'POST',headers:{...playHeaders,origin:'https://evil.test'},body:'{}'})).status === 403,'new owner playtest actions retain the exact same-origin guard');
  const playStop = await request(betaProxy,proxyTarget('/api/v1/admin/playtest'),{method:'DELETE',headers:playHeaders,body:JSON.stringify({sessionId:playData.sessionId,idempotencyKey:'relay-playtest-stop-' + randomBytes(12).toString('hex')})});
  proof(playStop.status === 200 && !JSON.parse(playStop.body).active,'explicit owner playtest exit traverses the full relay chain');
  const realAfter = JSON.parse((await request(betaProxy,proxyTarget('/api/v1/gameplay'),{headers:playHeaders})).body);
  proof(realAfter.player.cash === realBefore.player.cash && realAfter.player.bank_balance === realBefore.player.bank_balance,'relay owner testing leaves the normal player economy unchanged');
  proof((await request(betaProxy, proxyTarget('/api/v1/admin/draft'), { method: 'PUT', headers: { ...cloudHeaders, origin: 'https://evil.test' }, body: '{}' })).status === 403, 'tester beta retains exact-origin validation for changes');
  proof((await request(betaProxy, proxyTarget('/api/v1/admin/draft'), { method: 'PUT', headers: cloudHeaders, body: 'x'.repeat(1048577) })).status === 413, 'cloud draft size remains bounded at one megabyte');
  proof((await request(gameRelay, '/api/v1/admin/draft', { method: 'PUT', headers: { ...authorized, origin: `https://${publicHost}` }, body: 'x'.repeat(1048577) })).status === 413, 'Node draft size remains bounded at one megabyte');
  proof((await request(cloudOwnerProxy, proxyTarget('/api/v1/admin/draft'), { headers: cloudHeaders })).status === 401, 'turning off tester access retains the original owner gate and credentials');
  proof((await request(gameRelay, '/api/v1/admin/draft', { headers: { ...authorized, 'x-zone-owner-proof': 'forged', 'x-zone-gateway-owner': '1' } })).status === 401, 'caller-supplied owner or gateway flags cannot bypass the signed owner proof');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const wrongRouteProof = timestamp + '.' + createHmac('sha256', key).update(`owner-gateway:\nGET\n/api/v1/admin/releases\n${createHash('sha256').update('').digest('hex')}\n${timestamp}`).digest('hex');
  proof((await request(gameRelay, '/api/v1/admin/draft', { headers: { ...authorized, 'x-zone-owner-proof': wrongRouteProof } })).status === 401, 'owner gateway proof cannot be replayed onto a different route');
  const proxyPort = await startPHP(join(repo, 'api/index.php'), { ZONE_ENGINE_ORIGIN: `https://127.0.0.1:${tlsPort}/zone-beta-relay` }, proxyOptions);
  const proxyCSS = await request(proxyPort, '/api/index?__zone_path=/engine/theme.css', { headers: { host: publicHost } });
  proof(proxyCSS.status === 200 && /^text\/css\b/.test(proxyCSS.headers['content-type'] ?? '') && proxyCSS.body.includes('--published-theme-proof'), 'PHP proxy preserves stylesheet content and CSS MIME over the configured TLS prefix');
  const proxyCSSHead = await request(proxyPort, '/api/index?__zone_path=/engine/theme.css', { method: 'HEAD', headers: { host: publicHost } });
  proof(proxyCSSHead.status === 200 && /^text\/css\b/.test(proxyCSSHead.headers['content-type'] ?? '') && proxyCSSHead.body === '', 'PHP stylesheet HEAD is read-only and preserves CSS MIME');
  before = tlsSeen.length;
  proof((await request(proxyPort, '/api/index?__zone_path=/engine/theme.css', { method: 'POST', headers: { host: publicHost, origin: `https://${publicHost}` }, body: '{}' })).status === 405 && tlsSeen.length === before, 'PHP proxy rejects stylesheet POST without contacting the relay');
  tlsSeen.length = 0;
  const proxied = await request(proxyPort, '/api/index?__zone_path=%2Fapi%2Fv1%2Fauth%2Fsession&proof=one', { method: 'POST', headers: { host: publicHost, origin: `https://${publicHost}`, 'content-type': 'application/json', cookie: playerCookie + '; zone_admin_session=bad', 'x-zone-relay-key': 'forged', 'x-zone-client-host': 'localhost', 'x-zone-client-ip': '127.0.0.99', 'x-real-ip': '127.0.0.99', 'x-vercel-forwarded-for': '127.0.0.99', 'x-forwarded-for': '127.0.0.99', 'x-zone-admin-token': 'owner' }, body: '{"body":"survives"}' });
  proof(proxied.status === 201 && JSON.parse(proxied.body).proxied === true && tlsSeen.length === 1 && tlsSeen[0].path === '/zone-beta-relay/api/v1/auth/session?proof=one' && tlsSeen[0].body === '{"body":"survives"}', 'PHP proxy uses configured verified HTTPS origin and path prefix while preserving write and query');
  proof(tlsSeen[0].headers['x-zone-relay-key'] === key && tlsSeen[0].headers['x-zone-client-host'] === publicHost && tlsSeen[0].headers['x-zone-client-ip'] === '127.0.0.1' && !tlsSeen[0].headers['x-forwarded-for'] && !tlsSeen[0].headers['x-zone-admin-token'] && !tlsSeen[0].headers.cookie.includes('zone_admin'), 'PHP proxy constructs metadata from server context rather than forged client relay headers');
  proof(proxied.headers['set-cookie'].length === 1 && /Secure/.test(proxied.headers['set-cookie'][0]) && /HttpOnly/.test(proxied.headers['set-cookie'][0]) && /SameSite=Strict/.test(proxied.headers['set-cookie'][0]) && !/Domain=/.test(proxied.headers['set-cookie'][0]) && !proxied.headers['x-zone-relay-key'], 'PHP proxy keeps host-only secure public cookies and rejects owner or secret response headers');
  before = tlsSeen.length;
  proof((await request(proxyPort, '/api/index?__zone_path=/api/v1/admin/unknown-owner-route', { headers: { host: publicHost } })).status === 404 && (await request(proxyPort, '/api/index?__zone_path=/engine/var/private.sqlite', { headers: { host: publicHost } })).status === 404 && tlsSeen.length === before, 'PHP proxy unknown owner or private path denial never calls the relay');
  const proxyOwner = await request(proxyPort, '/api/index?__zone_path=/api/v1/admin/session', { method: 'POST', headers: { host: publicHost, origin: `https://${publicHost}`, cookie: ownerCookie + '; irrelevant=1' }, body: '{}' });
  proof(proxyOwner.status === 201 && tlsSeen.at(-1).headers.cookie === ownerCookie && proxyOwner.headers['set-cookie'].some(value => value.startsWith('zone_admin_session=') && /Secure/.test(value)), 'PHP entry point forwards only the owner cookie on explicit owner routes and preserves the login cookie');
  for (const method of ['PUT', 'DELETE']) {
    const path = method === 'PUT' ? '/api/v1/admin/draft' : '/api/v1/admin/session';
    const proxiedWrite = await request(proxyPort, '/api/index?__zone_path=' + path, { method, headers: { host: publicHost, origin: `https://${publicHost}`, cookie: ownerCookie }, body: '{"exact":true}' });
    proof(proxiedWrite.status === 201 && tlsSeen.at(-1).body === '{"exact":true}', `PHP proxy transports authenticated owner ${method} bodies once`);
    proof((await request(proxyPort, '/api/index?__zone_path=' + path, { method, headers: { host: publicHost, origin: 'https://evil.test' }, body: '{}' })).status === 403, `PHP proxy rejects cross-origin owner ${method}`);
  }
  before = tlsSeen.length;
  proof((await request(proxyPort, '/api/index?__zone_path=/api/v1/auth/session', { method: 'POST', headers: { host: publicHost, origin: 'https://evil.test' }, body: '{}' })).status === 403 && (await request(proxyPort, '/api/index?__zone_path=/api/v1/auth/session', { method: 'POST', headers: { host: publicHost }, body: '{}' })).status === 403 && tlsSeen.length === before, 'PHP proxy missing and forged Origins cannot submit writes');
  const proxyRate = await request(proxyPort, '/api/index?__zone_path=/api/v1/player&rate=1', { headers: { host: publicHost } });
  proof(proxyRate.status === 429 && proxyRate.headers['retry-after'] === '7' && JSON.parse(proxyRate.body).error === 'fixture cooldown', 'PHP proxy preserves downstream error body, status and cooldown header');
  before = tlsSeen.length;
  const proxyCut = await request(proxyPort, '/api/index?__zone_path=/api/v1/bank/deposit&cut=1', { method: 'POST', headers: { host: publicHost, origin: `https://${publicHost}` }, body: '{}' });
  proof(proxyCut.status === 503 && tlsSeen.length === before + 1 && !proxyCut.body.includes(key), 'PHP write transport failure is one attempt with no secret leakage');
  before = tlsSeen.length;
  const proxyPartial = await request(proxyPort, '/api/index?__zone_path=/api/v1/bank/deposit&partial=1', { method: 'POST', headers: { host: publicHost, origin: `https://${publicHost}` }, body: '{}' });
  proof(proxyPartial.status === 503 && tlsSeen.length === before + 1 && JSON.parse(proxyPartial.body).error.includes('interrupted'), 'truncated authenticated write response is detected without replaying the mutation');
  before = tlsSeen.length;
  const proxyRedirect = await request(proxyPort, '/api/index?__zone_path=/api/v1/player&redirect=1', { headers: { host: publicHost } });
  proof(proxyRedirect.status === 302 && tlsSeen.length === before + 1, 'PHP HTTPS transport never follows downstream redirects');
  const badProxy = await startPHP(join(repo, 'api/index.php'), { ZONE_ENGINE_ORIGIN: `http://127.0.0.1:${mockPort}` }, proxyOptions);
  proof((await request(badProxy, '/api/index?__zone_path=/api/v1/health', { headers: { host: publicHost } })).status === 503, 'PHP proxy rejects plaintext origin without falling back to local database initialization');
  const untrustedProxy = await startPHP(join(repo, 'api/index.php'), { ZONE_ENGINE_ORIGIN: `https://127.0.0.1:${tlsPort}/zone-beta-relay` }, ['-d', 'extension=openssl']);
  before = tlsSeen.length;
  proof((await request(untrustedProxy, '/api/index?__zone_path=/api/v1/health', { headers: { host: publicHost } })).status === 503 && tlsSeen.length === before, 'untrusted TLS certificate fails before an authenticated request is sent');
  const controlled = createRelay({ key, publicHosts: [publicHost], upstreamPort: mockPort, controlEnabled: true });
  const controlPort = await listen(controlled);
  proof((await request(controlPort, '/__zone_relay_stop', { method: 'POST' })).status === 401, 'loopback control requires its own real relay authentication');
  proof((await request(controlPort, '/__zone_relay_stop', { method: 'POST', headers: { 'x-zone-relay-key': key, host: publicHost } })).status === 403 && (await request(controlPort, '/__zone_relay_stop', { headers: { 'x-zone-relay-key': key } })).status === 403, 'public Host and GET cannot trigger graceful relay shutdown');
  proof((await request(proxyPort, '/api/index?__zone_path=/__zone_relay_stop', { method: 'POST', headers: { host: publicHost, origin: `https://${publicHost}` } })).status === 404, 'Vercel proxy path allowlist cannot access local shutdown control');
  const closed = once(controlled, 'close');
  const shutdown = await request(controlPort, '/__zone_relay_stop', { method: 'POST', headers: { 'x-zone-relay-key': key } });
  await closed;
  proof(shutdown.status === 200 && JSON.parse(shutdown.body).stopping === true && !controlled.listening, 'authenticated loopback POST gracefully closes the owned relay listener');
  if (process.platform === 'win32') {
    const starterPort = await unusedPort(); const configFile = join(fixture, 'starter-config.json'); const runtimeFile = join(fixture, 'local-beta-relay-runtime.json');
    ownedRelays.push(starterPort);
    await writeFile(configFile, JSON.stringify({ relayKey: key, publicHosts: [publicHost], port: starterPort, upstreamPort: mockPort }), 'utf8');
    async function starter() {
      return new Promise((resolve, reject) => {
        const child = spawn('pwsh.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(repo, 'engine/bin/start-relay.ps1'), '-ConfigPath', configFile, '-RuntimeDirectory', fixture], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let output = ''; child.stdout.on('data', part => { output += part; }); child.stderr.on('data', part => { output += part; });
        child.on('error', reject); child.on('exit', code => resolve({ code, output }));
      });
    }
    let started = await starter(); assert.equal(started.code, 0, started.output.replaceAll(key, '[redacted]')); let runtime = JSON.parse((await readFile(runtimeFile, 'utf8')).replace(/^\uFEFF/, ''));
    proof(started.code === 0 && runtime.port === starterPort && runtime.sourceHash && runtime.configFingerprint && !started.output.includes(key), 'real PowerShell starter registers an authenticated owned Node relay without exposing secret');
    started = await starter(); const same = JSON.parse((await readFile(runtimeFile, 'utf8')).replace(/^\uFEFF/, ''));
    proof(started.code === 0 && same.pid === runtime.pid, 'same source and configuration reuses the registered healthy PID');
    const oldPID = runtime.pid;
    // Simulate an attested older source registration without touching shared application source.
    const configMaterial = key + '\n' + publicHost + '\n' + starterPort + '\n' + mockPort;
    runtime.sourceHash = '0'.repeat(64); runtime.fingerprint = createHash('sha256').update(configMaterial + '\n' + runtime.sourceHash).digest('hex').toUpperCase();
    await writeFile(runtimeFile, JSON.stringify(runtime), 'utf8');
    started = await starter(); runtime = JSON.parse((await readFile(runtimeFile, 'utf8')).replace(/^\uFEFF/, ''));
    proof(started.code === 0 && runtime.pid !== oldPID && !started.output.includes(key) && (await request(starterPort, '/api/v1/health', { headers: authorized })).status === 200, 'owned source update gracefully retires previous PID and starts a healthy replacement');
    await writeFile(runtimeFile, JSON.stringify({ ...runtime, pid: runtime.pid + 1 }), 'utf8');
    started = await starter();
    proof(started.code !== 0 && (await request(starterPort, '/api/v1/health', { headers: authorized })).status === 200, 'mismatched registration PID is rejected without stopping the actual listener');
    await writeFile(runtimeFile, JSON.stringify(runtime), 'utf8');
    const stopped = await request(starterPort, '/__zone_relay_stop', { method: 'POST', headers: { 'x-zone-relay-key': key } });
    proof(stopped.status === 200, 'disposable starter process exits through authenticated graceful control without a kill signal');
    for (let attempt = 0; attempt < 30; attempt++) {
      try { await request(starterPort, '/api/v1/health', { headers: authorized }); } catch { break }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  console.log(`RELAY HTTP RESULT: ${checks} passed, 0 failed`);
} finally {
  for (const port of ownedRelays) await request(port, '/__zone_relay_stop', { method: 'POST', headers: { 'x-zone-relay-key': key } }).catch(() => {});
  for (const child of children) { child.kill(); await once(child, 'exit').catch(() => {}); }
  for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  assert.ok(resolve(fixture).startsWith(join(repo, 'engine/var/relay-http-')));
  await rm(fixture, { recursive: true, force: true });
}
