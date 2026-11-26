import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readBytes = (rel) => readFileSync(resolve(root, rel));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const AUTHORIZED_V150_FILES = new Set([
  'assets/ui/aaa-topbar-sidebar.css',
  'assets/ui/aaa-topbar-sidebar.js',
  'assets/ui/zone-app-shell.css',
  'assets/ui/zone-player-settings.css',
  'assets/ui/zone-torn-live.css',
  'assets/ui/zone-torn-live.js',
  'assets/ui/zone-rpg-empire.css',
  'assets/ui/zone-rpg-empire.js',
  'assets/ui/zone-ascension-breakthrough.css',
  'assets/ui/zone-ascension-breakthrough.js',
  'assets/ui/zone-instant-games.js',
  'assets/ui/zone-batch-liveops.js',
  'assets/ui/zone-gamekit-bridge.js',
  'assets/ui/zone-ecs-3d-engine.mjs',
  'assets/ui/zone-ecs-3d-bridge.js',
  'assets/ui/zone-ecs-3d.css',
  'assets/ui/zone-3d-environments.mjs',
  'assets/ui/zone-3d-rigged-operative.mjs',
  'assets/ui/zone-casino-tables.css',
  'assets/ui/zone-casino-tables.js',
  'assets/ui/zone-vehicle-garage.css',
  'assets/ui/zone-vehicle-garage.js',
  'assets/ui/zone-companion-3d.css',
  'assets/ui/zone-companion-3d.js',
  'assets/ui/zone-profile-avatar.css',
  'assets/ui/zone-profile-avatar.js',
  'docs/gdd/FEATURE_SOVEREIGN_3D_AND_VELVET_CASINO_V163.md',
  'docs/upgrades/upgrade-001-v163-3d-casino-overhaul.md',
  'docs/gdd/',
  'docs/upgrades/',
  'tests/test-sovereign-3d-casino163.mjs',
  'tests/test-casino-tables157.mjs',
  'tests/test-env-3d-world157.mjs',
  'tests/test-vehicle-garage157.mjs',
  'tests/test-perf-scaler159.mjs',
  'assets/ui/aaa-game-surfaces.css',
  'assets/ui/aaa-game-fx.js',
  'assets/ui/aaa-topbar-sidebar.js',
  'assets/ui/watercolor-sketchbook.css',
  'assets/ui/watercolor-sketchbook.js',
  'assets/ui/zone-replay-viewer.js',
  'assets/ui/zone-chat-system.js',
  'index.html',
  'account.html',
  'sw.js',
  'api/index.php',
  'engine/router.php',
  'engine/bin/relay.mjs',
  'engine/src/Application/GameEngine.php',
  'engine/src/Core/Game/AscensionEngineService.php',
  'engine/src/Core/Game/PlayerAvatarService.php',
  'engine/src/Core/Game/TornSystemsService.php',
  'engine/src/Core/Game/ForeignMarketService.php',
  'engine/src/Core/Game/CityActivitiesService.php',
  'engine/src/Core/Game/TradeBazaarCompanyService.php',
  'engine/src/Core/Game/PlayerCombatService.php',
  'engine/src/Core/Game/CombatService.php',
  'scripts/test-torn-core148.mjs',
  'scripts/test-pvp-travel148.mjs',
  'scripts/test-torn-ui148.mjs',
  'scripts/test-rpg-story149.mjs',
  'scripts/test-activities149.mjs',
  'scripts/test-factions-warfare149.mjs',
  'scripts/test-rpg-ui149.mjs',
  'scripts/test-ux-ia150.mjs',
  'scripts/test-breakthrough-ascension151.mjs',
  'scripts/test-progression-gates151.mjs',
  'scripts/test-breakthrough-ui151.mjs',
  'scripts/test-ecs-3d-engine152.mjs',
  'scripts/test-profile-avatar152.mjs',
  'scripts/test-account.mjs'
]);

test('v150 SHA-256 lock gate: index.html <body> is 100% byte-identical and 0 unauthorized files modified', () => {
  const rawHtml = readBytes('index.html');
  const bodyIdx = rawHtml.indexOf(Buffer.from('<body>'));
  assert.ok(bodyIdx > 0, 'index.html must contain <body>');
  assert.equal(
    sha256(rawHtml.subarray(bodyIdx)),
    '4c791309a03202d90db55efac2e9a8d02b4bda23914784672056e6abbb205d07',
    'index.html <body> onward must have 0 byte diffs'
  );

  const head = rawHtml.subarray(0, bodyIdx).toString('utf8');
  assert.match(head, /href="\.\/assets\/ui\/gym116\.css\?v=117"/, 'gym116.css?v=117 preserved');
  assert.ok(Number(head.match(/href="\.\/assets\/ui\/zone-torn-live\.css\?v=(\d+)"/)?.[1] || 0) >= 150);
  assert.ok(Number(head.match(/src="\.\/assets\/ui\/zone-torn-live\.js\?v=(\d+)"/)?.[1] || 0) >= 150);
  assert.ok(Number(head.match(/href="\.\/assets\/ui\/zone-rpg-empire\.css\?v=(\d+)"/)?.[1] || 0) >= 150);
  assert.ok(Number(head.match(/src="\.\/assets\/ui\/zone-rpg-empire\.js\?v=(\d+)"/)?.[1] || 0) >= 150);

  const gitStatus = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  const changed = gitStatus
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[A-Z?]{1,2}\s+/, '').replace(/\\/g, '/'))
    .filter((p) => !p.startsWith('public/'));

  for (const relPath of changed) {
    assert.ok(
      AUTHORIZED_V150_FILES.has(relPath),
      `Unauthorized file modification detected outside v150 ownership: ${relPath}`
    );
  }
});

test('v150 Clean Native Torn UI/UX & Information Architecture Gate (Desktop 1440x900 & Mobile 390x844, Light/Dark, EN/AR RTL)', async (t) => {
  let playwrightMod = null;
  for (const candidate of [
    'playwright',
    'C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules\\playwright\\index.mjs',
    'C:\\Users\\user\\.gemini\\node_modules\\playwright\\index.mjs'
  ]) {
    try {
      playwrightMod = await import(candidate);
      break;
    } catch (_) {}
  }
  assert.ok(playwrightMod, 'Playwright must be available for v150 UX/IA verification');

  let browser = null;
  for (const opts of [{ headless: true, channel: 'msedge' }, { headless: true, channel: 'chrome' }, { headless: true }]) {
    try {
      browser = await playwrightMod.chromium.launch(opts);
      break;
    } catch (_) {}
  }
  assert.ok(browser, 'Headless Chromium/Edge binary must be available');

  const http = await import('node:http');
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.glb': 'model/gltf-binary',
    '.obj': 'text/plain; charset=utf-8',
    '.mtl': 'text/plain; charset=utf-8'
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/api/v1/auth/session') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, playerId: 'p-150', mode: 'guest', session: { playerId: 'p-150', mode: 'guest' }, expiresAt: nowSec + 3600 }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/story-campaign')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        activeChapterId: 'act1_ch1',
        alignment: 'syndicate',
        chapters: [{ id: 'act1_ch1', act: 1, chapterNumber: 1, titleEn: 'Dockside Blood', titleAr: 'دماء الرصيف', objectivesDone: 1, objectivesTotal: 2 }]
      }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/player-rpg')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        leveling: { level: 12, potentialLevel: 13, pendingLevels: 1, holdLevel: false },
        rank: { rankNumber: 4, titleEn: 'Rookie', titleAr: 'مستجد', nextTitleEn: 'Novice', nextTitleAr: 'ناشئ', claimable: false, totalTriggers: 4, breakdown: { level: 1, battleStats: 1, networth: 1, crimes: 1 } },
        skillTree: { availableSp: 3, spentSp: 1, respecCount: 0, unlockedNodes: { street_instinct: true } },
        masterySkills: { hunting: 55, racing: 30 },
        workStats: { man: 110, int: 95, end: 120 }
      }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/city-activities')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        missionAgents: { missionCredits: 65, contracts: [{ id: 'c_1', tier: 'Easy', agent: 'Duke', titleEn: 'Harbor Run', titleAr: 'جولة المرفأ', progress: 1, target: 3, credits: 18, cash: 15000, accepted: true }] },
        dump: { poolSize: 19 },
        loanShark: { principal: 15000, maxLoan: 250000, dukeEnforcerHeat: false },
        hunting: { skill: 55 },
        racing: { racingPoints: 14, activeCarId: 'civic_e', ownedCars: { civic_e: true } }
      }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/syndicate-economy')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        trades: [{ id: 'tr-101', partnerId: 'p-2', status: 'open' }],
        bazaar: { open: true, listings: [{ id: 'bz-1', itemId: 'xanax', quantity: 2, unitPrice: 810000 }] },
        company: { id: 'co-1', name: 'Harbor Logistics', stars: 5, jobPts: 20 },
        companies: [{ id: 'co-2', name: 'Aegis Security', stars: 7 }],
        marriage: { spouseId: null, proposals: [] }
      }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/faction-empire')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        faction: { id: 'fac-1', nameEn: 'Iron Lotus', tag: 'ILTS', vaultBalance: 450000, respect: 1200, members: [] },
        directory: [{ id: 'fac-2', nameEn: 'Red Fang', nameAr: 'الناب الأحمر', tag: 'FANG', respect: 900 }],
        respectTree: { criminality: { crime_skill: 2 } },
        organizedCrime: { id: 'oc-77', heistId: 'armored_van', slots: {} },
        rankedWar: { ourScore: 14, theirScore: 9 },
        warCaches: { gold: 1 },
        loadout: { armorMitigationPct: 32, weaponMultiplier: 2.8, slots: { primary: 'ak', body: 'vest' } }
      }));
      return;
    }
    if (u.pathname === '/api/v1/game/bootstrap') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        release: {
          id: 'v150-live',
          version: 8,
          active: true,
          manifest: {
            schemaVersion: 1,
            branding: { name: { en: 'ZONE', ar: 'زون' }, tagline: { en: '', ar: '' }, accent: '#a3d900' },
            announcement: { enabled: false, text: { en: '', ar: '' } },
            modules: {},
            navigation: ['home', 'items', 'city', 'jobs', 'bank', 'gym', 'properties', 'education', 'crimes', 'missions', 'newspaper', 'jail', 'hospital', 'casino', 'hof', 'faction', 'elimination', 'attack', 'market'],
            pages: []
          }
        },
        content: {}
      }));
      return;
    }
    if (u.pathname === '/api/v1/gameplay' || u.pathname === '/api/v1/gameplay/action') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        player: { id: 'p-150', username: 'ShadowViper', level: 12, cash: 950000, bank_balance: 250000, energy: 100, max_energy: 150, nerve: 35, max_nerve: 45, happy: 500, max_happy: 2500, life: 500, max_life: 500, strength: 150, defense: 140, speed: 155, dexterity: 145, city: 'Zone City' },
        state: { version: 2, points: 50, merits: 6, prop: 'island', inv: { xanax: 2, glasses: 1, ak: 1, vest: 1 }, plushies: {}, eduDone: { bio: 1, hist: 1 }, skill: {}, cooldowns: { drugUntil: 0, medicalUntil: 0, boosterUntil: 0, overdoseCount: 0 }, addiction: 0, meritTree: {}, claimedHonors: {}, claimedMedals: {}, fac: { chain: 5, best: 10, respect: 500, ups: {} }, ctr: { crimes: 10, trains: 10, wins: 5, shifts: 2 }, claimed: {}, market: [], inmates: [], patients: [] },
        tornV2: { version: 'ZONE-TORN-148', cooldowns: { drugSeconds: 0, medicalSeconds: 0, boosterSeconds: 0, overdoseCount: 0 }, addiction: 0, vaultBalance: 50000, vaultCap: 1000000000, stocks: [], crimes2CatalogWithSkill: [] }
      }));
      return;
    }
    if (u.pathname === '/api/v1/foreign-market') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, travel: { status: 'home', city: 'Zone City', remainingSeconds: 0 }, destinations: [], inventory: [] }));
      return;
    }
    if (u.pathname === '/api/v1/faction-chain') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, chain: { count: 4, nextMilestone: 10, remainingSeconds: 210, best: 10, multiplier: 1.0 }, armory: {}, wall: { territoryId: 'ZC-046', attackerScore: 320, defenderScore: 410, targetScore: 1000 } }));
      return;
    }
    if (u.pathname === '/api/v1/runtime/config' || u.pathname === '/api/v1/releases/active') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, release: { version: 8, manifest: {} } }));
      return;
    }
    if (u.pathname === '/engine/theme.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end('/* published theme */');
      return;
    }
    if (u.pathname.startsWith('/api/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, events: [], players: [], patients: [], blocks: [], listings: [], operations: [], ranks: [] }));
      return;
    }

    const rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname).replace(/^\/+/, '');
    const abs = resolve(root, rel);
    if (existsSync(abs) && statSync(abs).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
      res.end(readBytes(rel));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  try {
    // 1) 4-Way Viewport / Theme / RTL Matrix: Header Budget, Above-the-Fold, Zero Stale Banners & Zero Overflow
    for (const cfg of [
      { name: 'Desktop Light EN', width: 1440, height: 900, lang: 'en', theme: 'light' },
      { name: 'Desktop Dark AR', width: 1440, height: 900, lang: 'ar', theme: 'dark' },
      { name: 'Mobile Light EN', width: 390, height: 844, lang: 'en', theme: 'light' },
      { name: 'Mobile Dark AR', width: 390, height: 844, lang: 'ar', theme: 'dark' }
    ]) {
      const context = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const txt = msg.text();
          if (!/favicon|webgl|gpu/i.test(txt)) errors.push(`console.error: ${txt}`);
        }
      });

      await page.goto(`http://127.0.0.1:${port}/?screen=home&lang=${cfg.lang}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#zone-torn-hud-strip', { timeout: 10000 });
      await page.waitForSelector('#ztl-hud-story-slot #zre-hud-story-pill', { timeout: 10000 });
      await page.evaluate((theme) => {
        document.documentElement.setAttribute('data-theme', theme);
      }, cfg.theme);
      await page.waitForTimeout(200);

      // Check 4 core native-first screens: home, city, gym, attack
      for (const scr of ['home', 'city', 'gym', 'attack']) {
        await page.evaluate((s) => {
          window.scrollTo(0, 0);
          if (window.__zoneGame && typeof window.__zoneGame.go === 'function') window.__zoneGame.go(s);
          window.scrollTo(0, 0);
        }, scr);
        await page.waitForTimeout(220);

        const metrics = await page.evaluate((activeScr) => {
          window.scrollTo(0, 0);
          const topbar = document.querySelector('.zone-topbar');
          const strip = document.getElementById('zone-torn-hud-strip');
          const tbRect = topbar.getBoundingClientRect();
          const stRect = strip ? strip.getBoundingClientRect() : null;
          const combinedHeaderH = stRect
            ? Math.max(tbRect.bottom, stRect.bottom) - Math.min(tbRect.top, stRect.top)
            : tbRect.height;

          const main = document.getElementById('zone-main');
          const heading = main.querySelector('.zone-page-heading');
          const headingTop = heading ? heading.getBoundingClientRect().top : main.getBoundingClientRect().top;

          const rpgSec = document.getElementById('zone-rpg-route-section');
          const tornSec = document.getElementById('zone-torn-route-section');
          const legacyRpgDeck = document.getElementById('zone-rpg-empire-deck');
          const legacyTornDeck = document.getElementById('zone-torn-ops-deck');
          const legacyBanner = document.getElementById('zre-mission-banner');
          const legacySideCard = document.getElementById('zre-sidebar-rank-card');

          // First visible native content child inside #zone-main (excluding page heading & tutorial)
          let nativeFirstRect = null;
          for (const ch of main.children) {
            if (
              ch.id === 'zig-home-arcade' ||
              ch.id === 'zone-ascension-hub' ||
              ch.id === 'ztl-attack-3d-stage' ||
              ch.id === 'zone-rpg-route-section' ||
              ch.id === 'zone-torn-route-section' ||
              ch.classList.contains('zone-mobile-tabbar') ||
              ch.classList.contains('zone-footer') ||
              ch.classList.contains('zone-page-heading') ||
              ch.classList.contains('zone-page-rule') ||
              ch.id === 'zwc-tutorial-card'
            ) {
              continue;
            }
            const r = ch.getBoundingClientRect();
            if (getComputedStyle(ch).display !== 'none' && r.height > 20) {
              nativeFirstRect = { top: r.top, bottom: r.bottom, height: r.height };
              break;
            }
          }

          const arcadeEl = document.getElementById('zig-home-arcade');
          const hubEl = document.getElementById('zone-ascension-hub');
          const arcadeRect = arcadeEl && getComputedStyle(arcadeEl).display !== 'none' ? arcadeEl.getBoundingClientRect().toJSON() : null;
          const hubRect = hubEl && getComputedStyle(hubEl).display !== 'none' ? hubEl.getBoundingClientRect().toJSON() : null;

          let cityMapRect = null;
          if (activeScr === 'city') {
            const mapEl =
              document.querySelector('#zone-main .zone-city-map-shell') ||
              document.getElementById('zone-city-map') ||
              document.querySelector('#zone-main [data-zone-city-view="1"] svg');
            if (mapEl) {
              const mr = mapEl.getBoundingClientRect();
              cityMapRect = { top: mr.top, bottom: mr.bottom, height: mr.height };
            }
          }

          const staleFeedback = document.querySelectorAll('.zre-feedback, .ztl-feedback').length;
          const hasFactionLeaveText = document.body.textContent.includes('faction.leave');

          return {
            combinedHeaderH,
            stripH: stRect ? stRect.height : 0,
            headingTop,
            nativeFirstRect,
            arcadeRect,
            hubRect,
            cityMapRect,
            rpgSecRect: rpgSec ? rpgSec.getBoundingClientRect().toJSON() : null,
            tornSecRect: tornSec ? tornSec.getBoundingClientRect().toJSON() : null,
            hasLegacyMonoliths: Boolean(legacyRpgDeck || legacyTornDeck || legacyBanner || legacySideCard),
            staleFeedback,
            hasFactionLeaveText,
            overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
          };
        }, scr);

        // (1) Header height budget <= 96px on Desktop AND 390x844 Mobile (>= 88% of 844px is pure game content)
        assert.ok(
          metrics.combinedHeaderH <= 96,
          `[${cfg.name} / ${scr}] Header height ${metrics.combinedHeaderH.toFixed(1)}px must be <= 96px`
        );
        if (cfg.height === 844) {
          const contentShare = (844 - metrics.combinedHeaderH) / 844;
          assert.ok(contentShare >= 0.88, `[${cfg.name} / ${scr}] Mobile game content share ${(contentShare * 100).toFixed(1)}% >= 88%`);
        }

        // (2) Native-first above-the-fold: route heading starts at top < 120px and ZERO injected decks above native content
        assert.ok(
          metrics.headingTop < 120,
          `[${cfg.name} / ${scr}] Native route content starts immediately below topbar (top=${metrics.headingTop.toFixed(1)}px < 120px)`
        );
        assert.equal(metrics.hasLegacyMonoliths, false, `[${cfg.name} / ${scr}] Zero legacy banner/card/god-deck elements`);
        assert.ok(metrics.nativeFirstRect, `[${cfg.name} / ${scr}] Native screen body is visible`);

        if (metrics.rpgSecRect && metrics.rpgSecRect.height > 0) {
          assert.ok(
            metrics.rpgSecRect.top >= metrics.nativeFirstRect.bottom - 2,
            `[${cfg.name} / ${scr}] #zone-rpg-route-section (${metrics.rpgSecRect.top}px) must sit BELOW native screen content (${metrics.nativeFirstRect.bottom}px)`
          );
        }
        if (metrics.tornSecRect && metrics.tornSecRect.height > 0) {
          assert.ok(
            metrics.tornSecRect.top >= metrics.nativeFirstRect.bottom - 2,
            `[${cfg.name} / ${scr}] #zone-torn-route-section (${metrics.tornSecRect.top}px) must sit BELOW native screen content (${metrics.nativeFirstRect.bottom}px)`
          );
        }

        // On home: Syndicate Arcade (#zig-home-arcade) MUST be mounted above #zone-ascension-hub
        if (scr === 'home') {
          assert.ok(metrics.arcadeRect && metrics.arcadeRect.height > 80, `[${cfg.name}] #zig-home-arcade visible at top of Home`);
          if (metrics.hubRect && metrics.hubRect.height > 40) {
            assert.ok(
              metrics.arcadeRect.top < metrics.hubRect.top,
              `[${cfg.name}] #zig-home-arcade (${metrics.arcadeRect.top}px) sits ABOVE #zone-ascension-hub (${metrics.hubRect.top}px)`
            );
          }
        }

        // On city: 3D Map container/canvas is immediately visible in the top half of the viewport, and Underworld/Airport sit below it
        if (scr === 'city') {
          assert.ok(metrics.cityMapRect && metrics.cityMapRect.height > 100, `[${cfg.name}] 3D City Map container visible`);
          assert.ok(
            metrics.cityMapRect.top < cfg.height * 0.5,
            `[${cfg.name}] 3D City Map starts in top half of viewport (top=${metrics.cityMapRect.top.toFixed(1)}px < ${cfg.height * 0.5}px)`
          );
          if (metrics.rpgSecRect) {
            assert.ok(metrics.rpgSecRect.top > metrics.cityMapRect.bottom, `[${cfg.name}] City Underworld Spots strictly below 3D Map`);
          }
          if (metrics.tornSecRect) {
            assert.ok(metrics.tornSecRect.top > metrics.cityMapRect.bottom, `[${cfg.name}] Airport/Museum strictly below 3D Map`);
          }
        }

        // On gym & attack: ZERO injected RPG or Torn sections
        if (scr === 'gym' || scr === 'attack') {
          assert.equal(metrics.rpgSecRect, null, `[${cfg.name} / ${scr}] Zero RPG section mounted`);
          assert.equal(metrics.tornSecRect, null, `[${cfg.name} / ${scr}] Zero Torn Ops section mounted`);
        }

        // (4) Zero stale banners on load, zero horizontal overflow
        assert.equal(metrics.staleFeedback, 0, `[${cfg.name} / ${scr}] Zero stale feedback banners on load`);
        assert.equal(metrics.hasFactionLeaveText, false, `[${cfg.name} / ${scr}] Zero "faction.leave" text`);
        assert.equal(metrics.overflowX, 0, `[${cfg.name} / ${scr}] Zero horizontal overflow`);
      }

      assert.equal(errors.length, 0, `[${cfg.name}] Zero console/page errors: ${errors.join('; ')}`);
      await context.close();
    }

    // 2) Strict 1-Route-1-Purpose Isolation Sweep across ALL 12 Gameplay Routes
    const isoCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const isoPage = await isoCtx.newPage();
    await isoPage.goto(`http://127.0.0.1:${port}/?screen=home&lang=en`, { waitUntil: 'domcontentloaded' });
    await isoPage.waitForSelector('#zone-torn-hud-strip', { timeout: 10000 });

    const ALL_CHECK_ROUTES = [
      'home', 'missions', 'education', 'gym', 'crimes', 'city',
      'bank', 'market', 'jobs', 'properties', 'items', 'casino', 'faction', 'attack'
    ];

    const routeMatrix = {};
    for (const r of ALL_CHECK_ROUTES) {
      await isoPage.evaluate((scr) => {
        if (window.__zoneGame && typeof window.__zoneGame.go === 'function') window.__zoneGame.go(scr);
      }, r);
      await isoPage.waitForTimeout(160);

      routeMatrix[r] = await isoPage.evaluate(() => {
        const main = document.getElementById('zone-main');
        const txt = main ? main.textContent : '';
        const arc = document.getElementById('zig-home-arcade');
        return {
          arcadeVisible: Boolean(arc && getComputedStyle(arc).display !== 'none' && arc.getBoundingClientRect().height > 80),
          storyCampaign: Boolean(main?.querySelector('[data-zre-feature="story-campaign"]')) || /Act I: Gutter of the Harbor/.test(txt),
          skillTree: Boolean(main?.querySelector('[data-zre-feature="skill-tree"]')) || /4-Branch Player Skill Tree/.test(txt),
          stocks: /Zone Stock Exchange/.test(txt),
          factionRespectTree: Boolean(main?.querySelector('[data-zre-feature="faction-respect-tree"]')) || /7-Branch Faction Respect Skill Tree/.test(txt),
          wheelsRacing: Boolean(main?.querySelector('[data-zre-feature="wheels-racing"]')) || /Wheel of Awesome/.test(txt),
          bazaarsTrades: Boolean(main?.querySelector('[data-zre-feature="bazaars-trades"]')) || /Direct 2-Player Safe Trade Escrow/.test(txt),
          companies: Boolean(main?.querySelector('[data-zre-feature="player-companies"]')) || /Player-Directed Companies/.test(txt)
        };
      });
    }

    const assertExclusiveRoute = (featureKey, ownerRoute, label) => {
      for (const r of ALL_CHECK_ROUTES) {
        if (r === ownerRoute) {
          assert.equal(routeMatrix[r][featureKey], true, `${label} MUST exist on '${ownerRoute}'`);
        } else {
          assert.equal(routeMatrix[r][featureKey], false, `${label} MUST NOT exist on '${r}' (strictly '${ownerRoute}' only)`);
        }
      }
    };

    assertExclusiveRoute('storyCampaign', 'missions', 'Story Campaign');
    assertExclusiveRoute('stocks', 'bank', 'Stock Exchange');
    assertExclusiveRoute('skillTree', 'education', '4-Branch Skill Tree');
    assertExclusiveRoute('factionRespectTree', 'faction', '7-Branch Faction Respect Tree');
    assertExclusiveRoute('wheelsRacing', 'casino', 'Spin Wheels & Street Racing');
    assertExclusiveRoute('bazaarsTrades', 'market', 'Bazaars & Safe Trades');
    assertExclusiveRoute('companies', 'jobs', 'Player-Directed Companies');

    assert.equal(routeMatrix.home.arcadeVisible, true, 'Syndicate Arcade (#zig-home-arcade) MUST be mounted on home');
    assert.equal(routeMatrix.casino.arcadeVisible, true, 'Syndicate Arcade (#zig-home-arcade) MUST be mounted on casino');
    for (const r of ALL_CHECK_ROUTES) {
      if (r !== 'home' && r !== 'casino') {
        assert.equal(routeMatrix[r].arcadeVisible, false, `Syndicate Arcade MUST NOT appear on '${r}'`);
      }
    }

    await isoCtx.close();
  } finally {
    await browser.close();
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close();
  }
});
