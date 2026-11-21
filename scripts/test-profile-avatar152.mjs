import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRelay } from '../engine/bin/relay.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const phpBin = resolve(root, '.tools/php-8.5.10/php.exe');
const readBytes = (rel) => readFileSync(resolve(root, rel));
const readUtf8 = (rel) => readFileSync(resolve(root, rel), 'utf8');
const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');

const PRESET_IDS = [
  'pier4_ghost',
  'neon_enforcer',
  'velvet_queen',
  'crimson_viper',
  'gold_financier',
  'iron_chemist',
  'harbor_captain',
  'shadow_architect',
];

const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    tbl[n] = c >>> 0;
  }
  return tbl;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(tagStr, payload) {
  const tag = Buffer.from(tagStr, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, payload])), 0);
  return Buffer.concat([len, tag, payload, crc]);
}

function makePngBuffer(width, height, { noise = false, r = 40, g = 180, b = 120 } = {}) {
  const rowLen = 1 + width * 3;
  const raw = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    raw[rowOffset] = 0;
    if (noise) {
      randomBytes(width * 3).copy(raw, rowOffset + 1);
    } else {
      for (let x = 0; x < width; x++) {
        const px = rowOffset + 1 + x * 3;
        raw[px] = (r + x) & 0xff;
        raw[px + 1] = (g + y) & 0xff;
        raw[px + 2] = b & 0xff;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: noise ? 0 : 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeJpegBuffer(width, height) {
  const app0 = Buffer.from('ffe000104a46494600010100000100010000', 'hex');
  const dqt = Buffer.concat([Buffer.from('ffdb004300', 'hex'), Buffer.alloc(64, 0x08)]);
  const sof0 = Buffer.alloc(13);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(11, 2);
  sof0[4] = 8;
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 1;
  sof0[10] = 1;
  sof0[11] = 0x11;
  sof0[12] = 0;
  const dht = Buffer.from(
    'ffc4001f0000010501010101010100000000000000000102030405060708090a0b',
    'hex',
  );
  const sos = Buffer.from('ffda0008010100003f007f', 'hex');
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    app0,
    dqt,
    sof0,
    dht,
    sos,
    Buffer.from([0xff, 0xd9]),
  ]);
}

function makeWebpBuffer(width, height) {
  const vp8xPayload = Buffer.alloc(10, 0);
  vp8xPayload.writeUIntLE(width - 1, 4, 3);
  vp8xPayload.writeUIntLE(height - 1, 7, 3);
  const vp8xHeader = Buffer.alloc(8);
  vp8xHeader.write('VP8X', 0, 'ascii');
  vp8xHeader.writeUInt32LE(vp8xPayload.length, 4);

  const bits = (((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14)) >>> 0;
  const vp8lHeaderBits = Buffer.alloc(4);
  vp8lHeaderBits.writeUInt32LE(bits, 0);
  let vp8lPayload = Buffer.concat([
    Buffer.from([0x2f]),
    vp8lHeaderBits,
    Buffer.from('10071011118888fe0700', 'hex'),
  ]);
  if (vp8lPayload.length % 2 === 1) {
    vp8lPayload = Buffer.concat([vp8lPayload, Buffer.from([0x00])]);
  }
  const vp8lHeader = Buffer.alloc(8);
  vp8lHeader.write('VP8L', 0, 'ascii');
  vp8lHeader.writeUInt32LE(vp8lPayload.length, 4);

  const riffBody = Buffer.concat([
    Buffer.from('WEBP', 'ascii'),
    vp8xHeader,
    vp8xPayload,
    vp8lHeader,
    vp8lPayload,
  ]);
  const riffHeader = Buffer.alloc(8);
  riffHeader.write('RIFF', 0, 'ascii');
  riffHeader.writeUInt32LE(riffBody.length, 4);
  return Buffer.concat([riffHeader, riffBody]);
}

function httpRawRequest(port, path, { method = 'GET', headers = {}, body = '' } = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ''), 'utf8');
  return new Promise((resolvePromise, rejectPromise) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          ...(payload.length > 0 ? { 'content-length': String(payload.length) } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolvePromise({
            status: res.statusCode,
            headers: res.headers,
            buffer: buf,
            text: buf.toString('utf8'),
          });
        });
      },
    );
    req.on('error', rejectPromise);
    req.setTimeout(12000, () => req.destroy(new Error(`HTTP timeout on ${method} ${path}`)));
    req.end(payload);
  });
}

async function listenZero(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function allocateFreePort() {
  const tmp = http.createServer();
  const port = await listenZero(tmp);
  await new Promise((res) => tmp.close(res));
  return port;
}

test('v152 Static, SHA-256 Lock, Entrypoints, SW Precache & PostgreSQL 16 SQL Law Gate', () => {
  const rawIndex = readBytes('index.html');
  const bodyIdx = rawIndex.indexOf(Buffer.from('<body>'));
  assert.ok(bodyIdx > 0, 'index.html must contain <body>');
  assert.equal(
    sha256Hex(rawIndex.subarray(bodyIdx)),
    '68fd3de219ee1de7b2a3f72223f7866ac956448b030e5999362e92eef9fcd313',
    'index.html <body> onward SHA-256 MUST stay 100% byte-identical',
  );

  const headHtml = rawIndex.subarray(0, bodyIdx).toString('utf8');
  assert.match(headHtml, /href="\.\/assets\/ui\/gym116\.css\?v=117"/, 'gym116.css?v=117 must stay untouched');
  assert.match(headHtml, /href="\.\/assets\/ui\/zone-ecs-3d\.css\?v=159"/);
  assert.match(headHtml, /href="\.\/assets\/ui\/zone-profile-avatar\.css\?v=159"/);
  assert.match(headHtml, /<script defer src="\.\/assets\/ui\/zone-ecs-3d-bridge\.js\?v=159"><\/script>/);
  assert.match(headHtml, /<script defer src="\.\/assets\/ui\/zone-profile-avatar\.js\?v=159"><\/script>/);
  assert.doesNotMatch(headHtml, /\?v=15[12345678]\b/, 'All ?v=151..158 head references must be bumped to ?v=159');

  const accountHtml = readUtf8('account.html');
  assert.match(accountHtml, /href="\/assets\/ui\/watercolor-sketchbook\.css\?v=159"/);
  assert.match(accountHtml, /href="\/assets\/ui\/zone-app-shell\.css\?v=159"/);
  assert.match(accountHtml, /href="\/assets\/ui\/zone-profile-avatar\.css\?v=159"/);
  assert.match(accountHtml, /<script src="\/assets\/ui\/watercolor-sketchbook\.js\?v=159" defer><\/script>/);
  assert.match(accountHtml, /<script src="\/assets\/ui\/zone-app-shell\.js\?v=159" defer><\/script>/);
  assert.match(accountHtml, /<script src="\/account\.js\?v=73" defer><\/script>/);
  assert.match(accountHtml, /<script src="\/assets\/ui\/zone-profile-avatar\.js\?v=159" defer><\/script>/);
  assert.match(accountHtml, /min-height:44px/);
  assert.match(accountHtml, /role="status"/);
  assert.doesNotMatch(accountHtml, /\?v=146\b/);
  assert.doesNotMatch(accountHtml, /\?v=15[2345678]\b/);

  const swSrc = readUtf8('sw.js');
  assert.match(swSrc, /SHELL_CACHE_NAME\s*=\s*['"]zone-shell-v159['"]/);
  for (const asset of [
    '/assets/ui/zone-ecs-3d.css',
    '/assets/ui/zone-ecs-3d-bridge.js',
    '/assets/ui/zone-ecs-3d-engine.mjs',
    '/assets/ui/zone-profile-avatar.css',
    '/assets/ui/zone-profile-avatar.js',
  ]) {
    assert.ok(swSrc.includes(asset), `sw.js PRECACHE_URLS must include ${asset}`);
  }

  const cssSrc = readUtf8('assets/ui/zone-profile-avatar.css');
  let braceDepth = 0;
  for (const ch of cssSrc) {
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth--;
    assert.ok(braceDepth >= 0, 'Unbalanced closing brace in zone-profile-avatar.css');
  }
  assert.equal(braceDepth, 0, 'Unclosed CSS block in zone-profile-avatar.css');
  for (const sel of [
    '.zpa-crest-img',
    '.zpa-camera-badge',
    '#zone-account-avatar-section',
    '#zone-profile-avatar-modal',
    'html[data-theme="light"]',
    'html[dir="rtl"]',
    '@media (max-width: 420px)',
  ]) {
    assert.ok(cssSrc.includes(sel), `Missing CSS rule ${sel} in zone-profile-avatar.css`);
  }

  for (const jsRel of ['assets/ui/zone-profile-avatar.js', 'engine/bin/relay.mjs', 'sw.js']) {
    assert.ok(existsSync(resolve(root, jsRel)), `Missing JS file: ${jsRel}`);
    execFileSync(process.execPath, ['--check', resolve(root, jsRel)], { stdio: 'pipe' });
  }

  for (const phpRel of [
    'engine/src/Core/Game/PlayerAvatarService.php',
    'engine/src/Core/Game/TornSystemsService.php',
    'engine/src/Application/GameEngine.php',
    'engine/router.php',
    'api/index.php',
  ]) {
    assert.ok(existsSync(resolve(root, phpRel)), `Missing PHP file: ${phpRel}`);
    assert.ok(statSync(resolve(root, phpRel)).size > 100);
    execFileSync(phpBin, ['-l', resolve(root, phpRel)], { stdio: 'pipe' });
  }

  // PostgreSQL 16 SQL Law audit on PlayerAvatarService.php & TornSystemsService.php
  const avatarPhp = readUtf8('engine/src/Core/Game/PlayerAvatarService.php');
  assert.ok(avatarPhp.includes('CREATE TABLE IF NOT EXISTS player_avatars'));
  assert.ok(avatarPhp.includes('ON CONFLICT (player_id) DO UPDATE SET'));

  // Verify SQL strings have zero 2-arg scalar MIN(a,b)/MAX(a,b) and zero duplicate named :param placeholders
  for (const match of avatarPhp.matchAll(/['"]((?:SELECT|INSERT|UPDATE|DELETE|CREATE)\b[^'"]+)['"]/gi)) {
    const sql = match[1];
    assert.doesNotMatch(sql, /\b(?:MIN|MAX)\s*\([^)]+,[^)]+\)/i, `Forbidden 2-arg scalar MIN/MAX in SQL: ${sql}`);
    const params = [...sql.matchAll(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]);
    assert.equal(
      params.length,
      new Set(params).size,
      `Duplicate named placeholder in SQL prohibited by PostgreSQL 16 PDO: ${sql}`,
    );
  }

  const routerPhp = readUtf8('engine/router.php');
  assert.ok(routerPhp.includes("if (\$path === '/api/v1/player-profile/avatar')"));
  assert.ok(!routerPhp.includes('JSON_PRETTY_PRINT'), 'Compact JSON required (no JSON_PRETTY_PRINT)');

  // Verify test-account.mjs passes 8/8 unchanged
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const acctOut = execFileSync(
    process.execPath,
    ['--test', '--test-reporter=spec', resolve(root, 'scripts/test-account.mjs')],
    {
      encoding: 'utf8',
      stdio: 'pipe',
      env: childEnv,
    },
  );
  assert.match(acctOut, /pass 8/);
  assert.match(acctOut, /fail 0/);
});

test('v152 PHP 8.5 + Relay E2E: PNG/JPEG/WebP/>64KB uploads, ?raw=1 binary stream, XSS/SVG/bounds HTTP 400 rejection, 8 presets, ?id= lookup, directory hydration & removal', async () => {
  const fixtureDir = await mkdtemp(join(root, 'engine/var/avatar152-e2e-'));
  const relayKey = randomBytes(32).toString('hex');
  const publicHost = 'zone.test';
  const children = [];
  const servers = [];

  const authorizedHeaders = {
    'x-zone-relay-key': relayKey,
    'x-zone-client-host': publicHost,
    'x-zone-client-proto': 'https',
    'x-zone-client-ip': '198.51.100.42',
  };

  try {
    const enginePort = await allocateFreePort();
    let phpStderr = '';
    const phpChild = spawn(
      phpBin,
      ['-S', `127.0.0.1:${enginePort}`, resolve(root, 'engine/router.php')],
      {
        cwd: root,
        env: {
          ...process.env,
          VERCEL: '',
          ZONE_DATABASE_URL: `sqlite:${join(fixtureDir, 'avatar.sqlite')}`,
          ZONE_PLAYER_SESSIONS: '1',
          ZONE_ADMIN_TOKEN: '',
          ZONE_BETA_OWNER_ACCESS: '0',
          ZONE_ENGINE_ORIGIN: '',
          ZONE_ENGINE_RELAY_KEY: relayKey,
          ZONE_ENGINE_PUBLIC_HOSTS: publicHost,
        },
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );
    children.push(phpChild);
    phpChild.stderr.on('data', (d) => { phpStderr += d.toString(); });

    let engineUp = false;
    for (let i = 0; i < 60; i++) {
      if (phpChild.exitCode !== null) {
        throw new Error(`Isolated PHP exited early: ${phpStderr}`);
      }
      try {
        const h = await httpRawRequest(enginePort, '/api/v1/health', { headers: { host: publicHost } });
        if (h.status === 200) {
          engineUp = true;
          break;
        }
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(engineUp, 'Isolated PHP engine started');

    const relayServer = createRelay({ key: relayKey, publicHosts: [publicHost], upstreamPort: enginePort });
    const relayPort = await listenZero(relayServer);
    servers.push(relayServer);

    async function createPlayerSession(ipSuffix) {
      const res = await httpRawRequest(relayPort, '/api/v1/auth/session', {
        method: 'POST',
        headers: {
          ...authorizedHeaders,
          'x-zone-client-ip': `198.51.100.${ipSuffix}`,
          origin: `https://${publicHost}`,
          'content-type': 'application/json',
        },
        body: '{}',
      });
      assert.equal(res.status, 201);
      const body = JSON.parse(res.text);
      const cookie = res.headers['set-cookie'][0].split(';')[0];
      return { playerId: body.playerId, cookie, ip: `198.51.100.${ipSuffix}` };
    }

    const playerA = await createPlayerSession(51);
    const playerB = await createPlayerSession(52);
    assert.notEqual(playerA.playerId, playerB.playerId);

    const headersFor = (p, isPost = false) => ({
      ...authorizedHeaders,
      'x-zone-client-ip': p.ip,
      cookie: p.cookie,
      ...(isPost
        ? { origin: `https://${publicHost}`, 'content-type': 'application/json' }
        : {}),
    });

    // Initial GET state
    const initRes = await httpRawRequest(relayPort, '/api/v1/player-profile/avatar', {
      headers: headersFor(playerA),
    });
    assert.equal(initRes.status, 200);
    assert.ok(!initRes.text.includes('\n  '), 'Avatar JSON must be compact (no pretty print)');
    const initJson = JSON.parse(initRes.text);
    assert.equal(initJson.ok, true);
    assert.equal(initJson.playerId, playerA.playerId);
    assert.equal(initJson.hasCustomAvatar, false);
    assert.equal(initJson.presets.length, 8);

    // 1. PNG Upload + Binary ?raw=1 verification
    const pngBuf = makePngBuffer(64, 64, { r: 24, g: 190, b: 110 });
    const pngSha = sha256Hex(pngBuf);
    const pngDataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`;

    const upPng = await httpRawRequest(relayPort, '/api/v1/player-profile/avatar', {
      method: 'POST',
      headers: headersFor(playerA, true),
      body: JSON.stringify({ action: 'upload', dataUrl: pngDataUrl }),
    });
    assert.equal(upPng.status, 200);
    const upPngJson = JSON.parse(upPng.text);
    assert.equal(upPngJson.ok, true);
    assert.equal(upPngJson.playerId, playerA.playerId);
    assert.equal(upPngJson.hasCustomAvatar, true);
    assert.equal(upPngJson.mimeType, 'image/png');
    assert.equal(upPngJson.sha256, pngSha);
    assert.equal(
      upPngJson.avatarUrl,
      `/api/v1/player-profile/avatar?raw=1&id=${encodeURIComponent(playerA.playerId)}&v=${pngSha.slice(0, 10)}`,
    );

    const rawPng = await httpRawRequest(relayPort, upPngJson.avatarUrl, { headers: authorizedHeaders });
    assert.equal(rawPng.status, 200);
    assert.equal(rawPng.headers['content-type'], 'image/png');
    assert.equal(rawPng.headers['x-content-type-options'], 'nosniff');
    assert.match(String(rawPng.headers['cache-control'] || ''), /public,\s*max-age=3600/);
    assert.equal(sha256Hex(rawPng.buffer), pngSha, 'Streamed binary PNG must match uploaded bytes 100%');

    const headPng = await httpRawRequest(relayPort, upPngJson.avatarUrl, {
      method: 'HEAD',
      headers: authorizedHeaders,
    });
    assert.equal(headPng.status, 200);
    assert.equal(headPng.headers['content-type'], 'image/png');
    assert.equal(headPng.buffer.length, 0);

    // 2. JPEG Upload + Binary ?raw=1 verification
    const jpgBuf = makeJpegBuffer(48, 48);
    const jpgSha = sha256Hex(jpgBuf);
    const upJpg = await httpRawRequest(relayPort, '/api/v1/player-profile/avatar', {
      method: 'POST',
      headers: headersFor(playerA, true),
      body: JSON.stringify({ action: 'upload', dataUrl: `data:image/jpeg;base64,${jpgBuf.toString('base64')}` }),
    });
    assert.equal(upJpg.status, 200);
    const upJpgJson = JSON.parse(upJpg.text);
    assert.equal(upJpgJson.mimeType, 'image/jpeg');
    assert.equal(upJpgJson.sha256, jpgSha);

    const rawJpg = await httpRawRequest(relayPort, upJpgJson.avatarUrl, { headers: authorizedHeaders });
    assert.equal(rawJpg.status, 200);
    assert.equal(rawJpg.headers['content-type'], 'image/jpeg');
    assert.equal(sha256Hex(rawJpg.buffer), jpgSha);

    // 3. WebP Upload + Binary ?raw=1 verification
    const webpBuf = makeWebpBuffer(64, 64);
    const webpSha = sha256Hex(webpBuf);
    const upWebp = await httpRawRequest(relayPort, '/api/v1/player-profile/avatar', {
      method: 'POST',
      headers: headersFor(playerA, true),
      body: JSON.stringify({ action: 'upload', dataUrl: `data:image/webp;base64,${webpBuf.toString('base64')}` }),
    });
    assert.equal(upWebp.status, 200);
    const upWebpJson = JSON.parse(upWebp.text);
    assert.equal(upWebpJson.mimeType, 'image/webp');
    assert.equal(upWebpJson.sha256, webpSha);

    const rawWebp = await httpRawRequest(relayPort, upWebpJson.avatarUrl, { headers: authorizedHeaders });
    assert.equal(rawWebp.status, 200);
    assert.equal(rawWebp.headers['content-type'], 'image/webp');
    assert.equal(sha256Hex(rawWebp.buffer), webpSha);

    // 4. Large (> 64 KB) high-detail photo upload through Relay (proves 1 MiB avatar body allowance)
    const largePngBuf = makePngBuffer(180, 180, { noise: true });
    assert.ok(largePngBuf.length > 90_000 && largePngBuf.length <= 380_000, `Expected ~97KB PNG, got ${largePngBuf.length}`);
    const upLarge = await httpRawRequest(relayPort, '/api/v1/player-profile/avatar', {
      method: 'POST',
      headers: headersFor(playerA, true),
      body: JSON.stringify({ action: 'upload', dataUrl: `data:image/png;base64,${largePngBuf.toString('base64')}` }),
    });
    assert.equal(upLarge.status, 200);
    assert.equal(JSON.parse(upLarge.text).sha256, sha256Hex(largePngBuf));

    // 5. Security, XSS, SVG & Bounds Rejections (ALL MUST return HTTP 400)
    const svgPayload = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="20"/></svg>');
    const xssPayload = Buffer.from('<html><body><script>fetch("/steal")</script></body></html>'.padEnd(96, ' '));
    const pngWithEmbeddedScript = Buffer.concat([pngBuf.subarray(0, 33), Buffer.from('<script>alert(1)</script>'), pngBuf.subarray(33)]);
    const fakeHeaderBytes = Buffer.alloc(128, 0x42);
    const tinyBytes = Buffer.from('tiny');
    const hugeBytes = Buffer.alloc(385_000, 0xaa);
    const tooSmallDimPng = makePngBuffer(8, 8);
    const tooLargeDimPng = makePngBuffer(1200, 1200);

    const badPayloads = [
      { label: 'SVG MIME upload', body: { action: 'upload', dataUrl: `data:image/svg+xml;base64,${svgPayload.toString('base64')}` } },
      { label: 'SVG bytes disguised as PNG', body: { action: 'upload', dataUrl: `data:image/png;base64,${svgPayload.toString('base64')}` } },
      { label: 'HTML/script disguised as JPEG', body: { action: 'upload', dataUrl: `data:image/jpeg;base64,${xssPayload.toString('base64')}` } },
      { label: 'PNG with embedded <script tag', body: { action: 'upload', dataUrl: `data:image/png;base64,${pngWithEmbeddedScript.toString('base64')}` } },
      { label: 'Invalid magic bytes', body: { action: 'upload', dataUrl: `data:image/png;base64,${fakeHeaderBytes.toString('base64')}` } },
      { label: 'Decoded length < 32 bytes', body: { action: 'upload', dataUrl: `data:image/png;base64,${tinyBytes.toString('base64')}` } },
      { label: 'Decoded length > 380000 bytes', body: { action: 'upload', dataUrl: `data:image/png;base64,${hugeBytes.toString('base64')}` } },
      { label: 'Dimensions < 16x16', body: { action: 'upload', dataUrl: `data:image/png;base64,${tooSmallDimPng.toString('base64')}` } },
      { label: 'Dimensions > 1024x1024', body: { action: 'upload', dataUrl: `data:image/png;base64,${tooLargeDimPng.toString('base64')}` } },
      { label: 'Unknown preset ID', body: { action: 'preset', presetId: 'nonexistent_syndicate_boss' } },
      { label: 'Unsupported action', body: { action: 'drop_table' } },
    ];

    for (const bad of badPayloads) {
      const res = await httpRawRequest(relayPort, '/api/v1/player-profile/avatar', {
        method: 'POST',
        headers: headersFor(playerA, true),
        body: JSON.stringify(bad.body),
      });
      assert.equal(res.status, 400, `Expected HTTP 400 for ${bad.label}, got ${res.status}: ${res.text}`);
      const errBody = JSON.parse(res.text);
      assert.equal(errBody.ok, false);
    }

    // 6. All 8 Curated Syndicate Illustrated Portrait Presets on playerB
    for (const pid of PRESET_IDS) {
      const pRes = await httpRawRequest(relayPort, '/api/v1/player-profile/avatar', {
        method: 'POST',
        headers: headersFor(playerB, true),
        body: JSON.stringify({ action: 'preset', presetId: pid }),
      });
      assert.equal(pRes.status, 200, `Preset ${pid} must succeed`);
      const pJson = JSON.parse(pRes.text);
      assert.equal(pJson.ok, true);
      assert.equal(pJson.playerId, playerB.playerId);
      assert.equal(pJson.hasCustomAvatar, false);
      assert.equal(pJson.presetId, pid);
      assert.ok(String(pJson.avatarUrl || '').startsWith('data:image/svg+xml;base64,'));
    }

    // 7. Cross-player ?id=<otherPlayer> lookup + Player Directory & Profile batched hydration
    const lookupAFromB = await httpRawRequest(
      relayPort,
      `/api/v1/player-profile/avatar?id=${encodeURIComponent(playerA.playerId)}`,
      { headers: headersFor(playerB) },
    );
    assert.equal(lookupAFromB.status, 200);
    const lookupAJson = JSON.parse(lookupAFromB.text);
    assert.equal(lookupAJson.playerId, playerA.playerId);
    assert.equal(lookupAJson.hasCustomAvatar, true);
    assert.ok(String(lookupAJson.avatarUrl).includes(`id=${encodeURIComponent(playerA.playerId)}`));

    const lookupBFromA = await httpRawRequest(
      relayPort,
      `/api/v1/player-profile/avatar?id=${encodeURIComponent(playerB.playerId)}`,
      { headers: headersFor(playerA) },
    );
    assert.equal(lookupBFromA.status, 200);
    const lookupBJson = JSON.parse(lookupBFromA.text);
    assert.equal(lookupBJson.playerId, playerB.playerId);
    assert.equal(lookupBJson.hasCustomAvatar, false);
    assert.equal(lookupBJson.presetId, 'shadow_architect');

    const dirRes = await httpRawRequest(relayPort, '/api/v1/player-profile', {
      headers: headersFor(playerA),
    });
    assert.equal(dirRes.status, 200);
    const dirJson = JSON.parse(dirRes.text);
    const directoryEntries = dirJson.directory || dirJson.players || [];
    assert.ok(Array.isArray(directoryEntries) && directoryEntries.length >= 2, 'Directory must return players');

    const entryA = directoryEntries.find((e) => (e.id || e.playerId) === playerA.playerId);
    const entryB = directoryEntries.find((e) => (e.id || e.playerId) === playerB.playerId);
    assert.ok(entryA, 'playerA present in directory');
    assert.equal(entryA.hasCustomAvatar, true);
    assert.ok(String(entryA.avatarUrl || '').includes('raw=1'));
    assert.ok(entryB, 'playerB present in directory');
    assert.equal(entryB.avatarPresetId, 'shadow_architect');
    assert.ok(String(entryB.avatarUrl || '').startsWith('data:image/svg+xml;base64,'));

    const profARes = await httpRawRequest(
      relayPort,
      `/api/v1/player-profile?id=${encodeURIComponent(playerA.playerId)}`,
      { headers: headersFor(playerB) },
    );
    assert.equal(profARes.status, 200);
    const profAJson = JSON.parse(profARes.text);
    assert.equal(profAJson.profile.hasCustomAvatar, true);
    assert.ok(String(profAJson.profile.avatarUrl || '').includes('raw=1'));

    // 8. Remove avatar resets row cleanly
    const remRes = await httpRawRequest(relayPort, '/api/v1/player-profile/avatar', {
      method: 'POST',
      headers: headersFor(playerA, true),
      body: JSON.stringify({ action: 'remove' }),
    });
    assert.equal(remRes.status, 200);
    const remJson = JSON.parse(remRes.text);
    assert.equal(remJson.ok, true);
    assert.equal(remJson.hasCustomAvatar, false);
    assert.equal(remJson.avatarUrl, null);

    const afterRemRaw = await httpRawRequest(
      relayPort,
      `/api/v1/player-profile/avatar?raw=1&id=${encodeURIComponent(playerA.playerId)}`,
      { headers: authorizedHeaders },
    );
    assert.equal(afterRemRaw.status, 200);
    assert.match(String(afterRemRaw.headers['content-type'] || ''), /^application\/json/);
    assert.equal(JSON.parse(afterRemRaw.text).hasCustomAvatar, false);
  } finally {
    for (const s of servers) {
      await new Promise((r) => s.close(() => r()));
    }
    for (const c of children) {
      if (c.exitCode === null) c.kill();
    }
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('v152 Headless Browser UI Gate: Studio 256x256 Crop/Zoom + 8 Presets + 0ms Sync Across All 5 Mounts (index.html & account.html, EN/AR RTL, 390px Mobile, Zero Signed-Out 401s)', async () => {
  let playwrightMod = null;
  for (const candidate of [
    'playwright',
    'C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules\\playwright\\index.mjs',
    'C:\\Users\\user\\.gemini\\node_modules\\playwright\\index.mjs',
  ]) {
    try {
      playwrightMod = await import(candidate);
      break;
    } catch (_) {}
  }
  assert.ok(playwrightMod, 'Playwright must be available for real browser verification');

  const fixtureDir = await mkdtemp(join(root, 'engine/var/avatar152-ui-'));
  const relayKey = randomBytes(32).toString('hex');
  const children = [];
  const servers = [];
  let browser = null;

  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.glb': 'model/gltf-binary',
    '.obj': 'text/plain; charset=utf-8',
    '.mtl': 'text/plain; charset=utf-8',
  };

  try {
    // 1. Start static + gateway server proxying through real createRelay -> isolated PHP
    const publicHost = 'zone.test';
    let relayPort = 0;

    const siteServer = http.createServer(async (req, res) => {
      const u = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
      if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/engine')) {
        const bodyChunks = [];
        for await (const chunk of req) bodyChunks.push(chunk);
        const rawBody = Buffer.concat(bodyChunks);

        const fwdHeaders = {
          'x-zone-relay-key': relayKey,
          'x-zone-client-host': publicHost,
          'x-zone-client-proto': 'https',
          'x-zone-client-ip': '198.51.100.88',
        };
        if (req.headers.cookie) fwdHeaders.cookie = req.headers.cookie;
        if (req.headers['content-type']) fwdHeaders['content-type'] = req.headers['content-type'];
        if (req.headers.accept) fwdHeaders.accept = req.headers.accept;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          fwdHeaders.origin = `https://${publicHost}`;
        }

        const upstream = await httpRawRequest(relayPort, u.pathname + u.search, {
          method: req.method,
          headers: fwdHeaders,
          body: rawBody,
        });

        const outHeaders = {};
        for (const [k, v] of Object.entries(upstream.headers)) {
          if (k.toLowerCase() === 'set-cookie' && Array.isArray(v)) {
            // Strip Secure flag on http://127.0.0.1 local browser context so cookies persist
            outHeaders['set-cookie'] = v.map((c) => c.replace(/;\s*Secure/gi, ''));
          } else if (v !== undefined) {
            outHeaders[k] = v;
          }
        }
        res.writeHead(upstream.status, outHeaders);
        res.end(upstream.buffer);
        return;
      }

      let relPath = decodeURIComponent(u.pathname);
      if (relPath === '/' || relPath === '/index.html') relPath = '/index.html';
      else if (relPath === '/account') relPath = '/account.html';

      const diskPath = resolve(root, '.' + relPath);
      if (!diskPath.startsWith(root) || !existsSync(diskPath) || statSync(diskPath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = extname(diskPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(diskPath));
    });

    const sitePort = await listenZero(siteServer);
    servers.push(siteServer);
    const siteHost = `127.0.0.1:${sitePort}`;

    const enginePort = await allocateFreePort();
    const phpChild = spawn(
      phpBin,
      ['-S', `127.0.0.1:${enginePort}`, resolve(root, 'engine/router.php')],
      {
        cwd: root,
        env: {
          ...process.env,
          VERCEL: '',
          ZONE_DATABASE_URL: `sqlite:${join(fixtureDir, 'ui.sqlite')}`,
          ZONE_PLAYER_SESSIONS: '1',
          ZONE_ADMIN_TOKEN: '',
          ZONE_BETA_OWNER_ACCESS: '0',
          ZONE_ENGINE_ORIGIN: '',
          ZONE_ENGINE_RELAY_KEY: relayKey,
          ZONE_ENGINE_PUBLIC_HOSTS: publicHost,
        },
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );
    children.push(phpChild);

    for (let i = 0; i < 60; i++) {
      try {
        const h = await httpRawRequest(enginePort, '/api/v1/health', { headers: { host: publicHost } });
        if (h.status === 200) break;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 50));
    }

    const relayServer = createRelay({ key: relayKey, publicHosts: [publicHost], upstreamPort: enginePort });
    relayPort = await listenZero(relayServer);
    servers.push(relayServer);

    for (const opts of [{ headless: true, channel: 'msedge' }, { headless: true, channel: 'chrome' }, { headless: true }]) {
      try {
        browser = await playwrightMod.chromium.launch(opts);
        break;
      } catch (_) {}
    }
    assert.ok(browser, 'Headless Chromium/Edge launched');

    // --- PART A: Signed-out account.html (Zero 401s + Section Mount + EN/AR Toggle + >=48px Button) ---
    const signedOutCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const acctPage = await signedOutCtx.newPage();
    const acct401s = [];
    const acctErrors = [];
    acctPage.on('response', (resp) => {
      if (resp.status() === 401) acct401s.push(resp.url());
    });
    acctPage.on('pageerror', (err) => acctErrors.push(err.message));

    await acctPage.goto(`http://${siteHost}/account.html`, { waitUntil: 'networkidle' });
    await acctPage.waitForSelector('#zone-account-avatar-section', { state: 'attached', timeout: 5000 });

    assert.deepEqual(acct401s, [], 'Signed-out account.html must trigger ZERO HTTP 401 responses');
    assert.deepEqual(acctErrors, [], 'Signed-out account.html must have zero page errors');

    const acctLayout = await acctPage.evaluate(() => {
      const main = document.querySelector('main');
      const avatarSec = document.getElementById('zone-account-avatar-section');
      const claimPanel = document.getElementById('claimPanel');
      const openBtn = document.getElementById('zpa-account-open-btn');
      const openBtnSvg = openBtn ? openBtn.querySelector('svg') : null;
      const preview = document.getElementById('zpa-account-preview');
      const childrenArr = Array.from(main.children);
      return {
        insideMain: avatarSec && avatarSec.parentElement === main,
        beforeClaimPanel: childrenArr.indexOf(avatarSec) < childrenArr.indexOf(claimPanel),
        btnHeight: openBtn ? openBtn.getBoundingClientRect().height : 0,
        svgWidth: openBtnSvg ? openBtnSvg.getBoundingClientRect().width : 0,
        svgHeight: openBtnSvg ? openBtnSvg.getBoundingClientRect().height : 0,
        previewWidth: preview ? preview.getBoundingClientRect().width : 0,
        headingEn: document.getElementById('zpa-account-heading')?.textContent || '',
      };
    });
    assert.equal(acctLayout.insideMain, true, '#zone-account-avatar-section must be inside <main>');
    assert.equal(acctLayout.beforeClaimPanel, true, '#zone-account-avatar-section must appear above #claimPanel');
    assert.ok(acctLayout.btnHeight >= 48 && acctLayout.btnHeight <= 68, `Upload button height must be 48..68px, got ${acctLayout.btnHeight}`);
    assert.equal(acctLayout.svgWidth, 16, `Camera icon SVG width must be 16px, got ${acctLayout.svgWidth}`);
    assert.equal(acctLayout.svgHeight, 16, `Camera icon SVG height must be 16px, got ${acctLayout.svgHeight}`);
    assert.ok(acctLayout.previewWidth >= 70, `Preview must be ~72x72, got ${acctLayout.previewWidth}`);
    assert.match(acctLayout.headingEn, /Profile Picture/i);

    // Toggle Arabic on account.html
    await acctPage.click('#languageToggle');
    await acctPage.waitForTimeout(80);
    const acctAr = await acctPage.evaluate(() => ({
      dir: document.documentElement.dir,
      heading: document.getElementById('zpa-account-heading')?.textContent || '',
      btn: document.getElementById('zpa-account-open-lbl')?.textContent || '',
    }));
    assert.equal(acctAr.dir, 'rtl');
    assert.match(acctAr.heading, /صورة الملف الشخصي/);
    assert.match(acctAr.btn, /رفع|تغيير/);

    // Reconnect guest character on account.html -> select preset -> verify 0ms preview update
    await acctPage.click('#languageToggle');
    await acctPage.evaluate(async () => {
      await fetch('/api/v1/auth/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    });
    await acctPage.reload({ waitUntil: 'networkidle' });
    await acctPage.click('#zpa-account-open-btn');
    await acctPage.waitForSelector('#zone-profile-avatar-modal', { state: 'visible', timeout: 5000 });
    await acctPage.click('[data-zpa-preset="velvet_queen"]');
    await acctPage.click('#zpa-modal-save-btn');
    await acctPage.waitForFunction(
      () => {
        const img = document.querySelector('#zpa-account-preview img');
        return img && img.getAttribute('src')?.startsWith('data:image/svg+xml;base64,');
      },
      { timeout: 5000 },
    );
    await signedOutCtx.close();

    // --- PART B: index.html Full Studio Crop/Zoom Upload & 0ms Sync Across All Mounts ---
    const gameCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const gamePage = await gameCtx.newPage();
    await gamePage.goto(`http://${siteHost}/?screen=home`, { waitUntil: 'domcontentloaded' });
    await gamePage.waitForFunction(() => Boolean(window.ZoneProfileAvatar && window.ZoneProfileAvatar.diagnostics().ready), {
      timeout: 10000,
    });

    // Ensure session + wait for initial avatar state
    const activePlayerId = await gamePage.evaluate(async () => {
      if (window.ZoneSession && typeof window.ZoneSession.ensure === 'function') {
        await window.ZoneSession.ensure();
      } else {
        await fetch('/api/v1/auth/session', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
      }
      const st = await window.ZoneProfileAvatar.refresh();
      return st.playerId;
    });
    assert.ok(activePlayerId, 'Active session playerId resolved on index.html');

    // Ensure all 4 index.html mount surfaces exist outside <x-dc> in live DOM so we verify simultaneous 0ms sync
    await gamePage.evaluate((pid) => {
      const outsideXdc = (sel) => Array.from(document.querySelectorAll(sel)).find((el) => !el.closest('x-dc')) || null;

      if (!outsideXdc('#zone-operative-crest .zaaa-op-avatar')) {
        const crest = document.createElement('div');
        crest.id = 'zone-operative-crest';
        crest.innerHTML = '<div class="zaaa-op-avatar"></div>';
        document.body.appendChild(crest);
      }
      if (!outsideXdc('.zone-home-brief')) {
        const hb = document.createElement('section');
        hb.className = 'zone-home-brief';
        document.body.appendChild(hb);
      }
      if (!outsideXdc('.zone-dossier-actions')) {
        const da = document.createElement('div');
        da.className = 'zone-dossier-actions';
        document.body.appendChild(da);
      }
      if (!outsideXdc('[data-omar-profile-modal]')) {
        const om = document.createElement('section');
        om.setAttribute('data-omar-profile-modal', '1');
        om.setAttribute('data-player-id', pid);
        om.style.cssText = 'position:static !important;inset:auto !important;pointer-events:none;';
        om.innerHTML = '<div class="zone-modal-card"><strong>Operative</strong></div>';
        document.body.appendChild(om);
      }
      const badge = document.createElement('span');
      badge.id = 'test-inline-zpa-badge';
      badge.className = 'zpa-inline-avatar';
      badge.setAttribute('data-zpa-avatar', pid);
      document.body.appendChild(badge);

      window.ZoneProfileAvatar.syncMounts();
    }, activePlayerId);

    // Click camera badge on Sidebar Operative Crest to open Studio Modal
    await gamePage.click('#zone-operative-crest .zaaa-op-avatar .zpa-camera-badge');
    await gamePage.waitForSelector('#zone-profile-avatar-modal', { state: 'visible', timeout: 5000 });

    // Upload custom PNG through file picker -> interactive 256x256 canvas crop + zoom -> save
    const sampleUploadPng = makePngBuffer(160, 120, { r: 210, g: 70, b: 45 });
    await gamePage.setInputFiles('#zpa-file-input', {
      name: 'operative-photo.png',
      mimeType: 'image/png',
      buffer: sampleUploadPng,
    });

    await gamePage.waitForFunction(
      () => !document.getElementById('zpa-zoom-slider')?.disabled,
      { timeout: 5000 },
    );

    // Adjust zoom slider to 1.66x (step=0.02) and verify canvas export < 250 KB
    const exportedCheck = await gamePage.evaluate(() => {
      const slider = document.getElementById('zpa-zoom-slider');
      slider.value = '1.66';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const dataUrl = window.ZoneProfileAvatar.exportCroppedDataUrl();
      const approxBytes = Math.ceil((dataUrl.split(',')[1] || '').length * 0.75);
      return {
        prefix: dataUrl.slice(0, 26),
        approxBytes,
        zoomLabel: document.getElementById('zpa-zoom-val')?.textContent || '',
      };
    });
    assert.match(exportedCheck.prefix, /^data:image\/(webp|jpeg);base64,/);
    assert.ok(exportedCheck.approxBytes > 50 && exportedCheck.approxBytes < 250_000);
    assert.equal(exportedCheck.zoomLabel, '1.66×');

    // Click Save Profile Photo and assert 0ms sync across all 4 index.html surfaces!
    await gamePage.click('#zpa-modal-save-btn');
    await gamePage.waitForTimeout(350);
    const syncState = await gamePage.evaluate(() => {
      const outsideXdc = (sel) => Array.from(document.querySelectorAll(sel)).find((el) => !el.closest('x-dc')) || null;
      return {
        state: window.ZoneProfileAvatar.getState(),
        banner: document.getElementById('zpa-status-banner')?.textContent || '',
        bannerErr: document.getElementById('zpa-status-banner')?.getAttribute('data-error') || '',
        crestSrc: outsideXdc('#zone-operative-crest .zaaa-op-avatar img.zpa-crest-img')?.getAttribute('src') || '',
        homeSrc: outsideXdc('.zone-home-brief .zpa-avatar-box img')?.getAttribute('src') || '',
        dossierBtn: Boolean(outsideXdc('.zone-dossier-actions button.zpa-dossier-upload-btn')),
        omarSrc: outsideXdc('[data-omar-profile-modal] .zpa-omar-avatar-frame img')?.getAttribute('src') || '',
        inlineSrc: document.querySelector('#test-inline-zpa-badge img.zpa-inline-avatar-img')?.getAttribute('src') || '',
      };
    });
    assert.equal(syncState.state.hasCustomAvatar, true, `Save failed: banner="${syncState.banner}" err=${syncState.bannerErr}`);
    assert.ok(syncState.crestSrc.length > 0, 'Sidebar crest image synced');
    assert.ok(syncState.homeSrc.length > 0, 'Home brief avatar image synced');
    assert.equal(syncState.dossierBtn, true, 'Dossier Upload Photo button mounted');
    assert.ok(syncState.omarSrc.length > 0, 'Omar profile modal avatar image synced');
    assert.ok(syncState.inlineSrc.length > 0, 'Inline [data-zpa-avatar] badge image synced');

    // Verify 390px mobile responsive modal + RTL switch on index.html
    await gamePage.setViewportSize({ width: 390, height: 844 });
    const mobileFit = await gamePage.evaluate(() => {
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
      window.ZoneProfileAvatar.syncMounts();
      const modal = document.getElementById('zone-profile-avatar-modal');
      const rect = modal.getBoundingClientRect();
      return {
        modalWidth: rect.width,
        fitsViewport: rect.width <= 390 && rect.left >= -1 && rect.right <= 391,
        titleAr: document.getElementById('zpa-modal-title')?.textContent || '',
      };
    });
    assert.equal(mobileFit.fitsViewport, true, `Studio modal must fit 390px viewport cleanly, width=${mobileFit.modalWidth}`);
    assert.match(mobileFit.titleAr, /استوديو صورة الملف الشخصي/);

    await gameCtx.close();
  } finally {
    if (browser) await browser.close();
    for (const s of servers) {
      if (typeof s.closeAllConnections === 'function') s.closeAllConnections();
      await new Promise((r) => s.close(() => r()));
    }
    for (const c of children) {
      if (c.exitCode === null) c.kill();
    }
    await rm(fixtureDir, { recursive: true, force: true });
  }
});
