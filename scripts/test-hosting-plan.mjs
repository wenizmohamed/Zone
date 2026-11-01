import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import {
  createRelay,
  relayRouteDiagnostics,
  publicRoutePaths,
  publicRouteCount,
  defaultRelayUpstreamPort,
  defaultRelayTimeoutMs,
  defaultRelayMaxRequestBytes,
  defaultRelayMaxDraftBytes,
  defaultRelayMaxResponseBytes,
} from '../engine/bin/relay.mjs';

// Static contracts only. No server, network request, shell or database is opened.
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const folder = 'engine/deploy/zone-staging/';
const config = Object.fromEntries([
  'php-fpm.conf', 'php-pool.conf', 'nginx-engine.conf', 'nginx-candidate-prefix.conf',
  'nginx-zone-logging.conf', 'zone-staging-fpm.service', 'zone-staging-relay.service',
  'zone-staging-engine.env.example', 'zone-staging-relay.env.example',
  'vercel-candidate.env.example', 'zone-staging-logrotate.conf', 'README.md',
].map(name => [name, read(folder + name)]));
const relay = read('engine/bin/relay.mjs');
const router = read('engine/router.php');
const proxy = read('api/index.php');
const bootstrap = read('engine/bootstrap.php');
const database = read('engine/src/Core/Persistence/Database.php');
const cache = read('engine/src/Infrastructure/Cache/CacheFactory.php');
const withoutComments = value => value.split('\n').filter(line => !/^\s*[#;]/.test(line)).join('\n');
const ini = value => Object.fromEntries(withoutComments(value).split('\n').map(line => line.match(/^\s*([^=\[\]\s][^=]*)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(match => [match[1].trim(), match[2]]));
const nginx = name => withoutComments(config[name]);
const pool = ini(config['php-pool.conf']);
const master = ini(config['php-fpm.conf']);
const fpmUnit = ini(config['zone-staging-fpm.service']);
const relayUnit = ini(config['zone-staging-relay.service']);
const env = name => ini(config[name]);

function validatePrefix(source) {
  const stripped = withoutComments(source);
  assert.match(stripped, /location\s+\^~\s+\/zone-staging-gateway\/\s*\{/);
  assert.match(stripped, /proxy_pass\s+http:\/\/127\.0\.0\.1:55437\/;/);
  assert.match(stripped, /proxy_set_header\s+Host\s+zone-staging-gateway\.invalid;/);
  assert.doesNotMatch(stripped, /proxy_set_header\s+Host\s+(?:127\.0\.0\.1|localhost|\$host|\$http_host)/);
  assert.doesNotMatch(stripped, /(?:^|\n)\s*(?:server\b|listen\b|server_name\b|rewrite\b|ssl_\w+\b)/);
  assert.doesNotMatch(stripped, /proxy_set_header\s+(?:X-Zone-|X-Forwarded-|X-Real-IP)/i);
}

function validateAdapter(source) {
  const stripped = withoutComments(source);
  assert.match(stripped, /listen\s+127\.0\.0\.1:54301;/);
  assert.equal((stripped.match(/\blisten\s/g) || []).length, 1);
  assert.match(stripped, /fastcgi_pass\s+unix:\/run\/zone-staging\/php-fpm\.sock;/);
  assert.match(stripped, /fastcgi_param\s+SCRIPT_FILENAME\s+\/srv\/zone-staging\/current\/engine\/router\.php;/);
  assert.match(stripped, /fastcgi_param\s+REMOTE_ADDR\s+127\.0\.0\.1;/);
  assert.equal((stripped.match(/fastcgi_param\s+REMOTE_ADDR\b/g) || []).length, 1);
  assert.doesNotMatch(stripped, /\binclude\b|\$document_root|\$fastcgi_script_name|fastcgi_split_path_info/);
  assert.match(stripped, /fastcgi_pass_request_headers\s+off;/);
}

test('candidate adapter ports/socket are new and isolated; external snippet cannot replace shared listeners', () => {
  validateAdapter(config['nginx-engine.conf']);
  validatePrefix(config['nginx-candidate-prefix.conf']);
  assert.equal(pool.listen, '/run/zone-staging/php-fpm.sock');
  assert.equal(env('zone-staging-relay.env.example').ZONE_ENGINE_LOCAL_PORT, '54301');
  assert.equal(env('zone-staging-relay.env.example').ZONE_ENGINE_RELAY_PORT, '55437');
  for (const name of ['nginx-engine.conf', 'nginx-candidate-prefix.conf', 'php-fpm.conf', 'php-pool.conf']) {
    assert.doesNotMatch(withoutComments(config[name]), /(?:0\.0\.0\.0|\[::\]|:3001\b|:55436\b|listen\s+(?:80|443|5432)\b)/);
  }
  assert.match(relay, /server\.listen\(port, '127\.0\.0\.1'/);
  assert.match(relay, /hostname: '127\.0\.0\.1', port: upstreamPort, path: url/);
});

test('external prefix cannot impersonate the relay local shutdown Host, including a known unsafe mutant', () => {
  validatePrefix(config['nginx-candidate-prefix.conf']);
  assert.match(relay, /request\.socket\.remoteAddress !== '127\.0\.0\.1'/);
  assert.match(relay, /onceHeader\(request, 'host'\) !== `127\.0\.0\.1:\$\{address\.port\}`/);
  assert.match(relay, /controlEnabled && url === '\/__zone_relay_stop'/);
  const unsafe = config['nginx-candidate-prefix.conf'].replace('Host zone-staging-gateway.invalid', 'Host 127.0.0.1:55437');
  assert.throws(() => validatePrefix(unsafe), assert.AssertionError);
});

test('adapter preserves trusted peer until router validates signed context; signed-IP-as-peer mutant fails', () => {
  validateAdapter(config['nginx-engine.conf']);
  assert.match(router, /in_array\(\$_SERVER\['REMOTE_ADDR'\] \?\? '', \['127\.0\.0\.1', '::1'\], true\)/);
  assert.match(router, /hash_equals\(\$gatewayKey, \(string\) \$_SERVER\['HTTP_X_ZONE_GATEWAY_KEY'\]\)/);
  assert.match(router, /in_array\(\$gatewayHost, \$allowedHosts, true\)/);
  assert.match(router, /filter_var\(\$gatewayIp, FILTER_VALIDATE_IP\)/);
  assert.ok(router.indexOf('Gateway authentication failed.') < router.indexOf("$_SERVER['REMOTE_ADDR'] = $gatewayIp"));
  const unsafe = config['nginx-engine.conf'].replace('REMOTE_ADDR 127.0.0.1', 'REMOTE_ADDR $http_x_zone_gateway_ip');
  assert.throws(() => validateAdapter(unsafe), assert.AssertionError);
});

test('FPM header allowlist matches existing relay output and cannot pass caller-supplied owner tokens', () => {
  const adapter = nginx('nginx-engine.conf');
  const actual = Array.from(adapter.matchAll(/fastcgi_param\s+(HTTP_\w+)\s+[^;]+;/g), match => match[1]).sort();
  const allowed = ['HTTP_HOST', 'HTTP_X_ZONE_GATEWAY_KEY', 'HTTP_X_ZONE_GATEWAY_HOST', 'HTTP_X_ZONE_GATEWAY_PROTO',
    'HTTP_X_ZONE_GATEWAY_IP', 'HTTP_X_ZONE_GATEWAY_OWNER', 'HTTP_ACCEPT', 'HTTP_ORIGIN', 'HTTP_REFERER',
    'HTTP_USER_AGENT', 'HTTP_COOKIE', 'HTTP_X_ZONE_PLAYER_ID', 'HTTP_X_ZONE_PLAYER_TOKEN'].sort();
  assert.deepEqual(actual, allowed);
  for (const suffix of ['KEY', 'HOST', 'PROTO', 'IP', 'OWNER']) {
    assert.match(adapter, new RegExp('HTTP_X_ZONE_GATEWAY_' + suffix + '\\s+\\$http_x_zone_gateway_' + suffix.toLowerCase() + ';'));
    assert.match(router, new RegExp('HTTP_X_ZONE_GATEWAY_' + suffix));
  }
  assert.match(relay, /headers\['x-zone-gateway-owner'\] = '1'/);
  assert.match(relay, /createHmac\('sha256', key\)/);
  assert.doesNotMatch(adapter, /HTTP_(?:X_ZONE_ADMIN|X_FORWARDED|X_REAL_IP)/);
  assert.match(relay, /cookieNames = owner\.length \? \['zone_player_session', 'zone_admin_session'\] : \['zone_player_session'\]/);
});

test('prefix and adapter preserve canonical route/query/body used by Vercel owner proof', () => {
  assert.match(nginx('nginx-engine.conf'), /REQUEST_URI\s+\$request_uri;/);
  assert.match(nginx('nginx-engine.conf'), /QUERY_STRING\s+\$query_string;/);
  assert.match(nginx('nginx-engine.conf'), /CONTENT_LENGTH\s+\$content_length;/);
  assert.match(nginx('nginx-candidate-prefix.conf'), /proxy_pass_request_headers\s+on;/);
  assert.match(proxy, /rtrim\(\$relayOrigin, '\/'\) \. \$requestTarget/);
  assert.match(proxy, /hash_hmac\('sha256', "owner-gateway:/);
  assert.match(relay, /\$\{request\.method\}\\n\$\{url\}\\n\$\{createHash/);
  const requestTarget = '/api/v1/admin/draft?lang=ar&opaque=a%2Fb';
  const origin = 'https://engine.example.test/zone-staging-gateway';
  const downstream = new URL(origin + requestTarget);
  const stripped = downstream.pathname.slice('/zone-staging-gateway'.length) + downstream.search;
  assert.equal(stripped, requestTarget);
  assert.equal(env('vercel-candidate.env.example').ZONE_ENGINE_ORIGIN, 'https://REPLACE_APPROVED_TLS_HOST/zone-staging-gateway');
});

test('independent FPM master imports one pool, dedicated UID/socket and limited worker env', () => {
  assert.equal(master.include, '/etc/zone-staging/php-pool.conf');
  assert.equal(master.pid, '/run/zone-staging/php-fpm.pid');
  assert.equal(master.daemonize, 'no');
  assert.equal(pool.user, 'zone-engine-staging');
  assert.equal(pool.group, 'zone-engine-staging');
  assert.equal(pool['listen.owner'], pool.user);
  assert.equal(pool['listen.group'], 'www-data');
  assert.equal(pool['listen.mode'], '0660');
  assert.equal(pool.clear_env, 'yes');
  const imports = Array.from(withoutComments(config['php-pool.conf']).matchAll(/^env\[(\w+)\]\s*=\s*(.+)$/gm), match => [match[1], match[2]]);
  assert.deepEqual(imports, [['VERCEL', '1'], ['ZONE_PLAYER_SESSIONS', '1'], ['ZONE_DATABASE_URL', '$ZONE_DATABASE_URL'],
    ['ZONE_ENGINE_RELAY_KEY', '$ZONE_ENGINE_RELAY_KEY'], ['ZONE_ENGINE_PUBLIC_HOSTS', '$ZONE_ENGINE_PUBLIC_HOSTS']]);
  assert.equal(pool['security.limit_extensions'], '.php');
  assert.doesNotMatch(master.include, /\*|pool\.d/);
});

test('secret examples remain private placeholders and fail existing relay validation without opening a server', () => {
  const engineEnv = env('zone-staging-engine.env.example');
  const relayEnv = env('zone-staging-relay.env.example');
  const candidateEnv = env('vercel-candidate.env.example');
  for (const values of [engineEnv, relayEnv, candidateEnv]) {
    assert.equal(values.ZONE_ENGINE_RELAY_KEY, 'REPLACE_RELAY_KEY');
    assert.equal(values.ZONE_ENGINE_PUBLIC_HOSTS, 'REPLACE_ALLOWED_VERCEL_HOST');
    assert.doesNotMatch(Object.keys(values).join(' '), /ADMIN|FOUNDER|LEGACY|REDIS|BETA_TEST/);
  }
  assert.equal(relayEnv.ZONE_DATABASE_URL, undefined);
  assert.equal(candidateEnv.ZONE_DATABASE_URL, undefined);
  assert.match(engineEnv.ZONE_DATABASE_URL, /^postgresql:\/\/REPLACE_DB_ROLE:REPLACE_URL_ENCODED_DB_PASSWORD@127\.0\.0\.1:5432\/REPLACE_RESTORED_STAGING_DATABASE\?sslmode=require$/);
  assert.doesNotMatch(engineEnv.ZONE_DATABASE_URL, /zone_local_beta|55433|55436/);
  assert.throws(() => createRelay({ key: relayEnv.ZONE_ENGINE_RELAY_KEY, publicHosts: relayEnv.ZONE_ENGINE_PUBLIC_HOSTS }), /strong relay secret/);
  assert.throws(() => createRelay({ key: 'static-test-key-not-a-real-secret-12345', publicHosts: relayEnv.ZONE_ENGINE_PUBLIC_HOSTS }), /Exact public host allowlist/);
});

test('units use private env outside source, bounded restart/permissions, no relay DB/root/capabilities', () => {
  assert.equal(fpmUnit.EnvironmentFile, '/etc/zone-staging/engine.env');
  assert.equal(relayUnit.EnvironmentFile, '/etc/zone-staging/relay.env');
  assert.equal(relayUnit.User, 'zone-relay-staging');
  assert.equal(relayUnit.Group, relayUnit.User);
  assert.equal(relayUnit.CapabilityBoundingSet, '');
  assert.equal(fpmUnit.CapabilityBoundingSet, 'CAP_SETUID CAP_SETGID CAP_CHOWN CAP_KILL');
  assert.doesNotMatch(fpmUnit.CapabilityBoundingSet, /CAP_DAC_OVERRIDE|CAP_SYS_ADMIN|CAP_NET_ADMIN/);
  for (const unit of [fpmUnit, relayUnit]) {
    assert.equal(unit.Restart, 'on-failure');
    assert.equal(unit.RestartSec, '5');
    assert.equal(unit.StartLimitIntervalSec, '60');
    assert.equal(unit.StartLimitBurst, '3');
    assert.equal(unit.NoNewPrivileges, 'true');
    assert.equal(unit.ProtectSystem, 'strict');
    assert.equal(unit.ProtectHome, 'true');
    assert.equal(unit.PrivateTmp, 'true');
    assert.equal(unit.LimitCORE, '0');
    assert.equal(unit.LimitNOFILE, '2048');
    assert.equal(unit.ReadOnlyPaths, '/srv/zone-staging');
    assert.equal(unit.OOMPolicy, 'stop');
  }
  assert.equal(relayUnit.ReadWritePaths, undefined);
  assert.equal(fpmUnit.ReadWritePaths, '/run/zone-staging /var/log/zone-staging /var/lib/zone-staging');
  assert.match(fpmUnit.ExecStartPre, /php-fpm8\.5 --test --fpm-config \/etc\/zone-staging\/php-fpm\.conf$/);
  assert.match(relayUnit.ExecStartPre, /node --check \/srv\/zone-staging\/current\/engine\/bin\/relay\.mjs$/);
});

test('resource limits bound candidate pool/relay without claiming shared-host capacity', () => {
  assert.equal(pool.pm, 'ondemand');
  assert.equal(pool['pm.max_children'], '4');
  assert.equal(pool['pm.process_idle_timeout'], '10s');
  assert.equal(pool['pm.max_requests'], '300');
  assert.match(config['php-pool.conf'], /php_admin_value\[memory_limit\]\s*=\s*128M/);
  assert.equal(fpmUnit.MemoryHigh, '640M');
  assert.equal(fpmUnit.MemoryMax, '768M');
  assert.equal(relayUnit.MemoryHigh, '192M');
  assert.equal(relayUnit.MemoryMax, '256M');
  assert.equal(fpmUnit.CPUQuota, '75%');
  assert.equal(relayUnit.CPUQuota, '25%');
  assert.equal(fpmUnit.TasksMax, '16');
  assert.equal(relayUnit.TasksMax, '32');
  assert.equal(relayUnit.Environment, 'NODE_OPTIONS=--max-old-space-size=128');
  assert.match(config['README.md'], /not a concurrent-player promise/);
});

test('timeouts are nested, bodies bounded and upstream retries remain off for economy writes', () => {
  assert.equal(pool.request_terminate_timeout, '16s');
  assert.equal(pool.request_terminate_timeout_track_finished, 'yes');
  assert.match(nginx('nginx-engine.conf'), /fastcgi_read_timeout\s+18s;/);
  assert.match(nginx('nginx-candidate-prefix.conf'), /proxy_read_timeout\s+22s;/);
  assert.match(relay, /timeoutMs = 18000/);
  assert.match(proxy, /'timeout' => 22/);
  assert.match(relay, /maxRequestBytes = 65536, maxDraftBytes = 1048576, maxResponseBytes = 4194304/);
  assert.match(nginx('nginx-engine.conf'), /client_max_body_size\s+1m;/);
  assert.match(nginx('nginx-candidate-prefix.conf'), /client_max_body_size\s+1m;/);
  assert.match(nginx('nginx-engine.conf'), /fastcgi_next_upstream\s+off;/);
  assert.match(nginx('nginx-candidate-prefix.conf'), /proxy_next_upstream\s+off;/);
  assert.match(proxy, /'follow_location' => 0, 'max_redirects' => 0/);
  assert.equal((proxy.match(/@fopen\(\$destination/g) || []).length, 1);
  assert.match(config['README.md'], /Timeouts do not prove an\naction failed before commit/);
});

test('graceful unit stop calls only authenticated loopback control and waits within fallback deadline', () => {
  const match = relayUnit.ExecStop.match(/^\/usr\/bin\/node -e '([\s\S]+)'$/);
  assert.ok(match, 'Unit stop command must remain one quoted JS expression with no shell');
  const command = match[1];
  assert.doesNotThrow(() => new Script(command, { filename: 'zone-staging-relay.service ExecStop' }));
  assert.match(command, /host:"127\.0\.0\.1",port:p,method:"POST",path:"\/__zone_relay_stop"/);
  assert.match(command, /Host:"127\.0\.0\.1:"\+p/);
  assert.match(command, /"X-Zone-Relay-Key":process\.env\.ZONE_ENGINE_RELAY_KEY/);
  assert.match(command, /"Content-Length":"0"/);
  assert.match(command, /process\.env\.MAINPID/);
  assert.match(command, /process\.kill\(pid,0\)/);
  assert.match(command, /Date\.now\(\)\+22000/);
  assert.doesNotMatch(command, /console\.|exec\(|spawn\(|eval\(/);
  assert.equal(relayUnit.TimeoutStopSec, '25');
  assert.equal(fpmUnit.KillSignal, 'SIGQUIT');
  assert.equal(fpmUnit.KillMode, 'mixed');
  assert.match(config['README.md'], /not a guarantee of zero interruption/);
});

test('logging omits access secrets and explicit rotation avoids broad destructive targets', () => {
  const logging = nginx('nginx-zone-logging.conf');
  assert.match(logging, /\$request_method \$uri/);
  assert.doesNotMatch(logging, /\$(?:request\b|request_uri|args|query_string|remote_addr|http_|request_body)/);
  assert.equal(pool['access.format'], '"%t %m %s %{milliseconds}d %{megabytes}M"');
  assert.equal(pool.catch_workers_output, 'yes');
  assert.match(config['php-pool.conf'], /php_admin_flag\[display_errors\]\s*=\s*off/);
  const rotation = withoutComments(config['zone-staging-logrotate.conf']);
  assert.equal((rotation.match(/rotate 7/g) || []).length, 2);
  assert.equal((rotation.match(/maxsize 10M/g) || []).length, 2);
  assert.doesNotMatch(rotation, /\*|\brm\b|\brestart\b/);
  assert.match(rotation, /--signal=USR1 zone-staging-fpm\.service/);
  assert.match(rotation, /--signal=USR1 nginx\.service/);
  assert.match(config['README.md'], /Resolve duplicate logrotate ownership before installation/);
  assert.match(config['README.md'], /not a hard disk\ncap/);
  assert.match(config['README.md'], /errors can contain request URIs/);
});

test('readiness/migration and cache contracts honestly require restored isolated DB before first request', () => {
  assert.match(bootstrap, /\$database->migrateAndSeed\(\)/);
  assert.match(router, /\$path === '\/api\/v1\/health'/);
  assert.match(router, /'engine' => \$engine->status\(\)/);
  assert.match(database, /connect_timeout=10/);
  assert.match(database, /\$this->pdo->exec\(\$sql\)/);
  assert.match(cache, /\$redisUrl === '' \? new ArrayCacheStore\(\)/);
  assert.match(config['README.md'], /DB before any runtime request/);
  assert.match(config['README.md'], /Health is DB-backed readiness/);
  assert.match(config['README.md'], /No Redis is configured here/);
  assert.match(config['README.md'], /not delivered or proven by these service files/);
});

test('operator path distinguishes unexecuted Linux gates, authoritative PC, immutable code and ledger-safe failback', () => {
  const readme = config['README.md'];
  assert.match(readme, /Linux FPM\/Nginx staging runtime is unexecuted/);
  assert.match(readme, /PC 127\.0\.0\.1:55433 \/ zone_local_beta/);
  assert.match(readme, /WSL is unavailable locally/);
  assert.match(readme, /Local PC PHP stays 8\.5\.10/);
  assert.match(readme, /systemd-analyze verify/);
  assert.match(readme, /nginx -t/);
  assert.match(readme, /logrotate --debug/);
  assert.match(readme, /record actual RPO\/RTO/);
  assert.match(readme, /do \*\*not\*\* blindly\nrepoint at the stale PC/);
  assert.match(readme, /Never erase the new ledger/);
  assert.match(readme, /Neither an FPM reload nor rollback to an old source commit undoes migrations/);
  assert.match(config['php-pool.conf'], /php_admin_value\[opcache.validate_timestamps\]\s*=\s*0/);
  assert.match(readme, /without a reviewed drain\nand service refresh can keep old PHP bytecode/);
  assert.match(readme, /not an observed VPS runtime/);
  assert.match(readme, /archive with LF line endings, not an auto-CRLF Windows checkout/);
  assert.match(readme, /third-party maintainer source, not the Ubuntu archive/);
  assert.doesNotMatch(readme, /(?:Linux runtime|staging runtime) (?:passed|accepted|verified|ready)/i);
  const diag = relayRouteDiagnostics();
  assert.ok(diag.publicRouteCount >= 35);
  assert.equal(diag.supportsAssetContent, true);
  assert.equal(diag.supportsWorldRoutes, true);
  assert.equal(diag.supportsThemeCss, true);
  assert.equal(publicRouteCount(), diag.publicRouteCount);
  assert.ok(Array.isArray(publicRoutePaths()) && publicRoutePaths().includes('health'));
  assert.equal(defaultRelayUpstreamPort(), 4301);
  assert.equal(defaultRelayTimeoutMs(), 18000);
  assert.equal(defaultRelayMaxRequestBytes(), 65536);
  assert.equal(defaultRelayMaxDraftBytes(), 1048576);
  assert.equal(defaultRelayMaxResponseBytes(), 4194304);
});
