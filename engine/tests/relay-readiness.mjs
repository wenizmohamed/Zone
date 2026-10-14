import assert from 'node:assert/strict';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'win32', 'This integration gate must exercise the actual Windows PowerShell starter.');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = await mkdtemp(join(repo, 'engine/var/relay-readiness-'));
const key = randomBytes(32).toString('hex');
const publicHost = 'zone-readiness.test';
let mode = 'healthy';
let healthCalls = 0;
let checks = 0;
let relayPort;
const timers = new Set();
const sockets = new Set();
const headers = { 'x-zone-relay-key': key, 'x-zone-client-host': publicHost, 'x-zone-client-proto': 'https', 'x-zone-client-ip': '127.0.0.1' };
const mock = http.createServer((request, response) => {
  assert.equal(request.url, '/api/v1/health');
  healthCalls++;
  if (mode === 'exhausted') {
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end('{"error":"isolated readiness failure"}');
    return;
  }
  const reply = () => {
    if (response.destroyed) return;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"ok":true,"isolatedFixture":true}');
  };
  if (mode === 'delayed-first' && healthCalls === 1) {
    const timer = setTimeout(() => { timers.delete(timer); reply(); }, 6200);
    timers.add(timer);
  } else reply();
});
mock.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
function proof(condition, label) { assert.ok(condition, label); checks++; console.log(`PASS: ${label}`); }
async function listen(server) { server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port; }
async function request(path, method = 'GET', timeout = 5000) {
  return new Promise((resolve, reject) => {
    const call = http.request({ hostname: '127.0.0.1', port: relayPort, path, method, headers }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', part => body += part);
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    call.on('error', reject); call.setTimeout(timeout, () => call.destroy(new Error('Isolated fixture HTTP timeout.'))); call.end();
  });
}
const configFile = join(fixture, 'starter-config.json');
const runtimeFile = join(fixture, 'local-beta-relay-runtime.json');
async function starter() {
  return new Promise((resolve, reject) => {
    const child = spawn('pwsh.exe', ['-NoProfile', '-File', join(repo, 'engine/bin/start-relay.ps1'), '-ConfigPath', configFile, '-RuntimeDirectory', fixture], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; const started = performance.now();
    child.stdout.on('data', part => output += part); child.stderr.on('data', part => output += part);
    child.on('error', reject); child.on('exit', code => resolve({ code, output: output.replaceAll(key, '[redacted]'), elapsed: performance.now() - started }));
  });
}
async function runtime() { return JSON.parse((await readFile(runtimeFile, 'utf8')).replace(/^\uFEFF/, '')); }
try {
  const upstreamPort = await listen(mock);
  const reservation = http.createServer(); relayPort = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  await writeFile(configFile, JSON.stringify({ relayKey: key, publicHosts: [publicHost], port: relayPort, upstreamPort }), 'utf8');
  let result = await starter();
  assert.equal(result.code, 0, result.output);
  const original = await runtime();
  proof(original.port === relayPort && original.pid > 0 && (await request('/api/v1/health')).status === 200, 'isolated real starter creates a healthy registered relay on an unused loopback port');

  mode = 'delayed-first'; healthCalls = 0;
  result = await starter();
  assert.equal(result.code, 0, result.output);
  proof(healthCalls === 2 && result.elapsed >= 5000 && result.elapsed < 22000, 'a genuinely timed-out first health probe is followed by one successful bounded probe');
  assert.deepEqual(await runtime(), original);
  proof((await runtime()).pid === original.pid, 'delayed health success reuses the exact registered listener and leaves registration unchanged');

  mode = 'exhausted'; healthCalls = 0;
  result = await starter();
  proof(result.code !== 0 && healthCalls === 3 && result.output.includes('failed three bounded readiness probes') && result.elapsed < 22000, 'three failed probes exhaust the bounded retry and fail the starter explicitly');
  assert.deepEqual(await runtime(), original);
  mode = 'healthy'; healthCalls = 0;
  proof((await request('/api/v1/health')).status === 200 && (await runtime()).pid === original.pid, 'exhaustion preserves the actual live listener and does not replace or duplicate its registration');
  const relayErrors = await readFile(join(fixture, `local-beta-relay-${relayPort}-errors.log`), 'utf8');
  proof(relayErrors === '', 'no duplicate-bind, fatal or unhandled relay error is emitted by either readiness case');
  const stopped = await request('/__zone_relay_stop', 'POST');
  proof(stopped.status === 200 && JSON.parse(stopped.body).stopping === true, 'only the disposable authenticated relay is closed gracefully without a process-kill signal');
  relayPort = undefined;
  console.log(`RELAY READINESS RESULT: ${checks} passed, 0 failed`);
} finally {
  if (relayPort) await request('/__zone_relay_stop', 'POST').catch(() => {});
  for (const timer of timers) clearTimeout(timer);
  for (const socket of sockets) socket.destroy();
  mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
  assert.ok(resolve(fixture).startsWith(join(repo, 'engine/var/relay-readiness-')));
  // The owned relay closes asynchronously. Wait for its log handles before removing only this fixture.
  await rm(fixture, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
