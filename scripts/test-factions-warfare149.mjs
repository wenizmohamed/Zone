import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRelay, isPublicPath } from '../engine/bin/relay.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const php = join(repo, '.tools/php-8.5.10/php.exe');

async function unusedPort() {
  const srv = http.createServer();
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  const { port } = srv.address();
  await new Promise((r) => srv.close(r));
  return port;
}

function httpJson(port, path, { method = 'GET', headers = {}, body = null } = {}) {
  const rawBody = body === null ? '' : JSON.stringify(body);
  return new Promise((resolvePromise, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          accept: 'application/json',
          ...(rawBody ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(rawBody)) } : {}),
          ...headers,
        },
      },
      (res) => {
        let out = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          out += c;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = out ? JSON.parse(out) : {};
          } catch {
            parsed = { _raw: out };
          }
          resolvePromise({ status: res.statusCode, headers: res.headers, json: parsed });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(12000, () => req.destroy(new Error(`HTTP timeout on ${method} ${path}`)));
    req.end(rawBody);
  });
}

function runPhpEval(dbPath, code) {
  const script = `
    require ${JSON.stringify(join(repo, 'engine/bootstrap.php'))};
    $url = ${JSON.stringify('sqlite:' + dbPath)};
    $engine = zone_engine($url);
    $db = \\Zone\\Engine\\Core\\Persistence\\Database::connect($url);
    $events = new \\Zone\\Engine\\Core\\Events\\EventBus($db);
    ${code}
  `;
  const stdout = execFileSync(php, ['-r', script], {
    cwd: repo,
    env: { ...process.env, ZONE_DATABASE_URL: 'sqlite:' + dbPath, VERCEL: '' },
    windowsHide: true,
    encoding: 'utf8',
  });
  return JSON.parse(stdout.trim());
}

test('v149 Relay & api/index.php allowlist all 10 new RPG, Campaign, Activities, Economy & Faction Empire routes + PostgreSQL SQL safety', async () => {
  const routes149 = [
    '/api/v1/story-campaign',
    '/api/v1/story-campaign/action',
    '/api/v1/player-rpg',
    '/api/v1/player-rpg/action',
    '/api/v1/city-activities',
    '/api/v1/city-activities/action',
    '/api/v1/syndicate-economy',
    '/api/v1/syndicate-economy/action',
    '/api/v1/faction-empire',
    '/api/v1/faction-empire/action',
  ];

  for (const r of routes149) {
    assert.equal(isPublicPath(r), true, `Expected relay isPublicPath(${r}) === true`);
  }

  const apiIndexPhp = await readFile(join(repo, 'api/index.php'), 'utf8');
  for (const r of routes149) {
    const shortRoute = r.slice('/api/v1/'.length);
    assert.equal(
      apiIndexPhp.includes(`'${shortRoute}'`),
      true,
      `Expected api/index.php zone_proxy_public_path to allow '${shortRoute}'`,
    );
  }

  // PostgreSQL 16 compatibility scan across owned PHP files (inspect SQL queries for 2-arg MIN/MAX or duplicate :params)
  for (const rel of [
    'engine/modules/Gangs/FactionService.php',
    'engine/src/Core/Game/FactionEmpireService.php',
    'engine/src/Core/Game/LoadoutService.php',
  ]) {
    const src = await readFile(join(repo, rel), 'utf8');
    assert.doesNotMatch(src, /JSON_PRETTY_PRINT/, `${rel} must keep compact JSON`);
    const sqlMatches = src.match(/['"](?:SELECT|INSERT|UPDATE|DELETE)\b[^'"]+['"]/gis) ?? [];
    for (const sql of sqlMatches) {
      assert.doesNotMatch(sql, /\b(?:MIN|MAX)\s*\([^,)]+,[^)]+\)/i, `${rel} SQL must not use 2-arg SQLite MIN/MAX: ${sql}`);
      const params = [...sql.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]);
      assert.equal(params.length, new Set(params).size, `${rel} SQL must not duplicate named :param placeholders: ${sql}`);
    }
  }
});

test('v149 Player-Created Factions ($1M), Directory, Ranks, Succession, Vault & 7-Branch Respect Skill Tree (28 Upgrades)', async () => {
  const fixture = await mkdtemp(join(repo, 'engine/var/test-fac-emp149-'));
  const dbPath = join(fixture, 'fac149.sqlite');
  try {
    const out = runPhpEval(
      dbPath,
      `
      $mk = function (string $name, int $cash = 2000000) use ($engine, $db): string {
          $id = $engine->browserSessions()->create($name . '-' . bin2hex(random_bytes(5)))['playerId'];
          $db->execute(
              'UPDATE players SET username = :u, cash = :c, energy = 150, max_energy = 150, nerve = 50, max_nerve = 50, life = 500, max_life = 500, resources_updated_at = :at WHERE id = :id',
              ['u' => $name, 'c' => $cash, 'at' => gmdate('c', time() + 3600), 'id' => $id]
          );
          return $id;
      };

      $founder = $mk('DonCorleone', 2500000);
      $coLead = $mk('Consigliere', 500000);
      $officer = $mk('Capo', 500000);
      $enforcer = $mk('MuscleGuy', 500000);
      $soloTemp = $mk('TempBoss', 1500000);

      $svc = new \\Zone\\Engine\\Core\\Game\\FactionEmpireService($db, $events);

      // 1. Found player-created faction for $1,000,000
      $created = $svc->act($founder, 'faction.create', [
          'nameEn' => 'Crimson Sovereign',
          'nameAr' => 'السيادة القرمزية',
          'tag' => 'CRIM',
          'color' => '#b91c1c',
          'manifesto' => 'Blood, bullion, and harbor supremacy.',
      ]);
      $factionId = $created['faction']['id'];

      // Duplicate tag rejection
      $dupTagBlocked = false;
      try {
          $svc->act($soloTemp, 'faction.create', [
              'nameEn' => 'Another Syndicate',
              'nameAr' => 'نقابة أخرى',
              'tag' => '[CRIM]',
              'color' => '#2563eb',
          ]);
      } catch (\\RuntimeException $e) {
          $dupTagBlocked = str_contains($e->getMessage(), 'CRIM');
      }

      // 2. Join + Roster Roles + Vault Deposit & Leader/Co-Leader Vault Grant
      $svc->act($coLead, 'faction.join', ['factionId' => $factionId]);
      $svc->act($officer, 'faction.join', ['factionId' => $factionId]);
      $svc->act($enforcer, 'faction.join', ['factionId' => $factionId]);

      $svc->act($founder, 'faction.setRole', ['targetPlayerId' => $coLead, 'role' => 'co-leader']);
      $svc->act($founder, 'faction.setRole', ['targetPlayerId' => $officer, 'role' => 'officer']);
      $svc->act($coLead, 'faction.setRole', ['targetPlayerId' => $enforcer, 'role' => 'enforcer']);

      $svc->act($founder, 'faction.vaultDeposit', ['amount' => 300000]);
      $svc->act($coLead, 'faction.vaultDeposit', ['amount' => 100000]);

      $officerGrantBlocked = false;
      try {
          $svc->act($officer, 'faction.vaultGrant', ['targetPlayerId' => $enforcer, 'amount' => 50000]);
      } catch (\\RuntimeException) {
          $officerGrantBlocked = true;
      }
      $afterGrant = $svc->act($coLead, 'faction.vaultGrant', ['targetPlayerId' => $enforcer, 'amount' => 150000]);

      // 3. 7-Branch Respect Skill Tree (28 upgrades, max tier 5, canonical + UI short aliases)
      $db->execute('UPDATE family_progression SET respect = 5000 WHERE faction_id = :id', ['id' => $factionId]);
      $svc->act($officer, 'tree.upgrade', ['branch' => 'criminality', 'nodeId' => 'max_nerve']);
      $svc->act($officer, 'tree.upgrade', ['branch' => 'criminality', 'nodeId' => 'crim_skill']);
      $svc->act($officer, 'tree.upgrade', ['branch' => 'fortitude', 'nodeId' => 'max_life']);
      $svc->act($founder, 'tree.upgrade', ['branch' => 'steadfast', 'nodeId' => 'str_gym_gain']);
      $svc->act($founder, 'tree.upgrade', ['branch' => 'excursion', 'nodeId' => 'travel_luggage']);
      $treeSnap = $svc->snapshot($founder);

      // Kick enforcer & verify leadership succession when founder leaves
      $svc->act($founder, 'faction.kick', ['targetPlayerId' => $enforcer]);
      $leaveRes = $svc->act($founder, 'faction.leave');
      $afterSuccession = $svc->snapshot($coLead);

      // Empty player-created faction disables cleanly on final member leave
      $tempCreated = $svc->act($soloTemp, 'faction.create', [
          'nameEn' => 'Ghost Cell',
          'nameAr' => 'خلية الأشباح',
          'tag' => 'GHST',
          'color' => '#111827',
      ]);
      $tempLeave = $svc->act($soloTemp, 'faction.leave');

      echo json_encode([
          'founderCashAfterCreate' => $created['player']['cash'],
          'tagFormatted' => $created['faction']['tagFormatted'],
          'directoryCount' => count($created['directory']),
          'dupTagBlocked' => $dupTagBlocked,
          'officerGrantBlocked' => $officerGrantBlocked,
          'vaultCashAfterGrant' => $afterGrant['faction']['vaultCash'],
          'enforcerCashAfterGrant' => (int) $db->fetchOne('SELECT cash FROM players WHERE id = :id', ['id' => $enforcer])['cash'],
          'branchCount' => count($treeSnap['respectTree']['branches']),
          'totalNodes' => $treeSnap['respectTree']['totalNodes'],
          'unlockedTiers' => $treeSnap['respectTree']['totalUpgradesUnlocked'],
          'founderMaxNerve' => $treeSnap['player']['max_nerve'],
          'founderMaxLife' => $treeSnap['player']['max_life'],
          'respectLedgerEntries' => count($treeSnap['faction']['respectLedger']),
          'newLeaderId' => $leaveRes['result']['newLeaderId'],
          'coLeadRoleAfterSuccession' => $afterSuccession['faction']['role'],
          'founderMaxNerveAfterLeave' => (int) $db->fetchOne('SELECT max_nerve FROM players WHERE id = :id', ['id' => $founder])['max_nerve'],
          'tempFactionDisabled' => $tempLeave['result']['factionDisabled'],
      ]);
      `,
    );

    assert.equal(out.founderCashAfterCreate, 1500000);
    assert.equal(out.tagFormatted, '[CRIM]');
    assert.ok(out.directoryCount >= 5, 'Directory lists 4 seed factions + player-created faction');
    assert.equal(out.dupTagBlocked, true);
    assert.equal(out.officerGrantBlocked, true);
    assert.equal(out.vaultCashAfterGrant, 250000);
    assert.equal(out.enforcerCashAfterGrant, 650000);
    assert.equal(out.branchCount, 7);
    assert.equal(out.totalNodes, 28);
    assert.equal(out.unlockedTiers, 5);
    assert.equal(out.founderMaxNerve, 52, '+2 Max Nerve applied from criminality.max_nerve Tier 1');
    assert.equal(out.founderMaxLife, 550, '+50 Max Life applied from fortitude.max_life Tier 1');
    assert.equal(out.respectLedgerEntries, 5);
    assert.equal(out.coLeadRoleAfterSuccession, 'leader');
    assert.equal(out.founderMaxNerveAfterLeave, 50, 'Leaving faction cleanly removes faction max_nerve bonus');
    assert.equal(out.tempFactionDisabled, true);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('v149 4-Role Crew OCs (Human + 20% NPC Fillers), 48h Ranked Wars, RW Bonus Weapons & 9-Slot Tactical Loadout', async () => {
  const fixture = await mkdtemp(join(repo, 'engine/var/test-war-oc149-'));
  const dbPath = join(fixture, 'war149.sqlite');
  try {
    const out = runPhpEval(
      dbPath,
      `
      $clock = time();
      $mk = function (string $name, int $cash = 2000000) use ($engine, $db, &$clock): string {
          $id = $engine->browserSessions()->create($name . '-' . bin2hex(random_bytes(5)))['playerId'];
          $db->execute(
              'UPDATE players SET username = :u, cash = :c, strength = 4500, defense = 4200, speed = 4600, dexterity = 4400, energy = 500, max_energy = 150, nerve = 50, max_nerve = 50, life = 1200, max_life = 1500, resources_updated_at = :at WHERE id = :id',
              ['u' => $name, 'c' => $cash, 'at' => gmdate('c', $clock + 7200), 'id' => $id]
          );
          return $id;
      };

      $svc = new \\Zone\\Engine\\Core\\Game\\FactionEmpireService(
          $db,
          $events,
          static function () use (&$clock): int { return $clock; },
          static fn (int $min, int $max): int => $max
      );

      $leader = $mk('WarBoss', 3000000);
      $hacker = $mk('ZeroCool', 500000);
      $rivalTarget = $mk('KingDefender', 500000);
      $engine->joinFaction('kings', $rivalTarget);
      $db->execute('UPDATE players SET strength = 50, defense = 50, speed = 50, dexterity = 50, life = 250, max_life = 250 WHERE id = :id', ['id' => $rivalTarget]);

      $svc->act($leader, 'faction.create', [
          'nameEn' => 'Apex Legion',
          'nameAr' => 'فيلق القمة',
          'tag' => 'APEX',
          'color' => '#ca8a04',
      ]);
      $factionId = $svc->snapshot($leader)['faction']['id'];
      $svc->act($hacker, 'faction.join', ['factionId' => $factionId]);

      // 1. 4-Role Crew OC: 2 real humans + 2 NPC fillers (2 x 20% = 40% NPC cut)
      $svc->act($leader, 'oc.create', ['heistId' => 'embassy_black_box']);
      $svc->act($leader, 'oc.claimSlot', ['slot' => 'mastermind']);
      $svc->act($hacker, 'oc.claimSlot', ['slot' => 'hacker']);
      $svc->act($leader, 'oc.claimSlot', ['slot' => 'muscle', 'npc' => true]);
      $svc->act($leader, 'oc.claimSlot', ['slot' => 'driver', 'npc' => true]);

      $earlyBlocked = false;
      try {
          $svc->act($leader, 'oc.execute');
      } catch (\\RuntimeException $e) {
          $earlyBlocked = str_contains($e->getMessage(), 'planning');
      }

      $clock += 305; // Advance past 300s Embassy Black-Box planning window
      $hackerCashBefore = (int) $db->fetchOne('SELECT cash FROM players WHERE id = :id', ['id' => $hacker])['cash'];
      $ocExec = $svc->act($leader, 'oc.execute', ['vaultSplitPct' => 50]);
      $hackerCashAfter = (int) $db->fetchOne('SELECT cash FROM players WHERE id = :id', ['id' => $hacker])['cash'];

      // 2. Scheduled 48h Ranked War + Live PvP Hit Integration + Assaults -> Victory & Caches
      $svc->act($leader, 'war.enlist');
      $warStart = $svc->act($leader, 'war.challenge', ['rivalFactionId' => 'kings', 'targetLead' => 250]);

      // Score real PvP hit via GameEngine::playerCombatAction
      $pvpSnap = $engine->playerCombat($leader);
      $pvpFight = $engine->playerCombatAction('start', $rivalTarget, '', $pvpSnap['version'], $leader);
      while ($pvpFight['encounter']['phase'] === 'fighting') {
          $pvpFight = $engine->playerCombatAction('strike', '', '', $pvpFight['version'], $leader);
      }
      $pvpFinish = $engine->playerCombatAction('finish', '', 'hosp', $pvpFight['version'], $leader);

      // Complete Ranked War via war.assault until victory
      $warWon = false;
      $assaultRuns = 0;
      while (!$warWon && $assaultRuns < 8) {
          $assaultRuns++;
          $aRes = $svc->act($leader, 'war.assault');
          $warWon = (bool) ($aRes['result']['warWon'] ?? false);
      }

      $afterWarSnap = $svc->snapshot($leader);
      $claimGold = $svc->act($leader, 'war.claimCache', ['cacheType' => 'gold']);
      $bonusWeapon = $claimGold['result']['bonusWeapon'];
      // UI button sends tier:'gold' — verify fallback claims next available cache (silver)
      $claimFallback = $svc->act($leader, 'war.claimCache', ['tier' => 'gold']);
      $fallbackTier = $claimFallback['result']['cacheType'];

      // 3. 9-Slot Loadout Paperdoll: buy full 5-piece Tactical Armor + equip RW Bonus Weapon + Secondary + Melee + Temporary
      $prog = new \\Zone\\Engine\\Core\\Game\\ProgressionService($db, $events);
      $prog->grantItem($leader, 'revolver_5', 1);
      $prog->grantItem($leader, 'knife', 1);
      $prog->grantItem($leader, 'flash_grenade', 2);

      $svc->act($leader, 'loadout.buyTacticalArmor', ['pieceId' => 'full_set']);
      $svc->act($leader, 'loadout.equipSlot', ['slot' => 'primary', 'itemId' => $bonusWeapon['id']]);
      $svc->act($leader, 'loadout.equipSlot', ['slot' => 'secondary', 'itemId' => 'revolver_5']);
      $svc->act($leader, 'loadout.equipSlot', ['slot' => 'melee', 'itemId' => 'knife']);
      $svc->act($leader, 'loadout.equipSlot', ['slot' => 'temporary', 'itemId' => 'flash_grenade']);

      $finalSnap = $svc->snapshot($leader);

      echo json_encode([
          'heistCount' => count($finalSnap['organizedCrimes']['definitions']),
          'earlyBlocked' => $earlyBlocked,
          'ocGrossCash' => $ocExec['result']['grossCash'],
          'ocNpcCutCash' => $ocExec['result']['npcCutCash'],
          'ocVaultAdded' => $ocExec['result']['vaultCashAdded'],
          'hackerPayout' => $hackerCashAfter - $hackerCashBefore,
          'warDurationSec' => $warStart['result']['endsAt'] - $warStart['result']['startedAt'],
          'pvpScoredWarPoints' => $pvpFinish['result']['rankedWar']['warPointsScored'] ?? 0,
          'warWon' => $warWon,
          'warHistoryCount' => count($afterWarSnap['rankedWar']['warHistory']),
          'bonusWeaponRarity' => $bonusWeapon['rarity'],
          'bonusWeaponPerk' => $bonusWeapon['perk'],
          'fallbackTier' => $fallbackTier,
          'equippedSlotsCount' => $finalSnap['loadout']['equippedSlotsCount'],
          'armorReduction' => $finalSnap['loadout']['armorReduction'],
          'weaponMultiplier' => $finalSnap['loadout']['weaponMultiplier'],
          'weaponPerksCount' => count($finalSnap['loadout']['weaponPerks']),
      ]);
      `,
    );

    assert.equal(out.heistCount, 5);
    assert.equal(out.earlyBlocked, true);
    assert.equal(out.ocGrossCash, 680000);
    assert.equal(out.ocNpcCutCash, 272000, '2 NPC fillers deduct 40% (20% each)');
    assert.equal(out.ocVaultAdded, 204000, '50% of $408k net goes to Faction Vault');
    assert.equal(out.hackerPayout, 102000, 'Remaining $204k split evenly across 2 human crew members');
    assert.equal(out.warDurationSec, 172800, '48h Ranked War window');
    assert.ok(out.pvpScoredWarPoints >= 50, 'PvP hospitalize automatically scores Ranked War points');
    assert.equal(out.warWon, true);
    assert.equal(out.warHistoryCount, 1);
    assert.ok(['orange', 'red'].includes(out.bonusWeaponRarity));
    assert.ok(['plunder', 'warlord', 'execute', 'bloodlust'].includes(out.bonusWeaponPerk));
    assert.equal(out.fallbackTier, 'silver', 'UI war-cache button falls back to silver when gold cache is 0');
    assert.equal(out.equippedSlotsCount, 9, 'All 4 weapon slots + 5 armor slots equipped');
    assert.equal(out.armorReduction, 0.68, '5-piece tactical armor combines to 68% mitigation');
    assert.ok(out.weaponMultiplier > 2.0);
    assert.equal(out.weaponPerksCount, 1);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('v149 Live HTTP + Node Relay E2E for /api/v1/faction-empire & /api/v1/faction-empire/action', async () => {
  const fixture = await mkdtemp(join(repo, 'engine/var/test-http-fac149-'));
  const key = randomBytes(32).toString('hex');
  const publicHost = 'zone-v149.test';
  const enginePort = await unusedPort();

  const phpChild = spawn(php, ['-S', `127.0.0.1:${enginePort}`, join(repo, 'engine/router.php')], {
    cwd: repo,
    env: {
      ...process.env,
      VERCEL: '',
      ZONE_DATABASE_URL: `sqlite:${join(fixture, 'http149.sqlite')}`,
      ZONE_PLAYER_SESSIONS: '1',
      ZONE_ENGINE_RELAY_KEY: key,
      ZONE_ENGINE_PUBLIC_HOSTS: publicHost,
    },
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  const relay = createRelay({ key, publicHosts: [publicHost], upstreamPort: enginePort });
  relay.listen(0, '127.0.0.1');
  await once(relay, 'listening');
  const relayPort = relay.address().port;

  const baseHeaders = {
    'x-zone-relay-key': key,
    'x-zone-client-host': publicHost,
    'x-zone-client-proto': 'https',
    'x-zone-client-ip': '198.51.100.42',
    origin: `https://${publicHost}`,
  };

  try {
    let booted = false;
    for (let i = 0; i < 80; i++) {
      try {
        const h = await httpJson(enginePort, '/api/v1/health', { headers: { host: publicHost } });
        if (h.status === 200) {
          booted = true;
          break;
        }
      } catch {
        // wait for PHP built-in server + SQLite seed
      }
      await new Promise((r) => setTimeout(r, 75));
    }
    assert.equal(booted, true, 'Isolated PHP engine should boot and complete schema migration');

    const sess = await httpJson(relayPort, '/api/v1/auth/session', {
      method: 'POST',
      headers: baseHeaders,
      body: {},
    });
    assert.equal(sess.status, 201);
    const cookie = sess.headers['set-cookie'][0].split(';')[0];
    const authHeaders = { ...baseHeaders, cookie };

    const getEmp = await httpJson(relayPort, '/api/v1/faction-empire', { headers: authHeaders });
    assert.equal(getEmp.status, 200);
    assert.equal(getEmp.json.ok, true);
    assert.equal(getEmp.json.respectTree.branches.length, 7);
    assert.equal(getEmp.json.organizedCrimes.definitions.length, 5);
    assert.ok(getEmp.json.directory.length >= 4);
    assert.equal(typeof (getEmp.json.loadout.slots.primary ?? ''), 'string');

    const joinRes = await httpJson(relayPort, '/api/v1/faction-empire/action', {
      method: 'POST',
      headers: authHeaders,
      body: { action: 'faction.join', factionId: 'vipers' },
    });
    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.json.hasFaction, true);
    assert.equal(joinRes.json.faction.id, 'vipers');
    assert.ok(Array.isArray(joinRes.json.faction.members), 'UI alias faction.members exposed');
    assert.equal(typeof joinRes.json.faction.vaultBalance, 'number', 'UI alias faction.vaultBalance exposed');

    // Verify ALL 5 v149 GET snapshot routes + POST action routes through Relay -> PHP Router -> GameEngine
    for (const getRoute of [
      '/api/v1/story-campaign',
      '/api/v1/player-rpg',
      '/api/v1/city-activities',
      '/api/v1/syndicate-economy',
      '/api/v1/faction-empire',
    ]) {
      const snap = await httpJson(relayPort, getRoute, { headers: authHeaders });
      assert.equal(snap.status, 200, `Expected 200 on GET ${getRoute}, got ${snap.status}: ${JSON.stringify(snap.json)}`);
      assert.ok(snap.json && typeof snap.json === 'object' && !snap.json.error, `Expected valid JSON object on GET ${getRoute}`);
    }

    const storyAct = await httpJson(relayPort, '/api/v1/story-campaign/action', {
      method: 'POST',
      headers: authHeaders,
      body: { action: 'chapter.start', chapterId: 'act1_ch1' },
    });
    assert.equal(storyAct.status, 200, `story-campaign/action failed: ${JSON.stringify(storyAct.json)}`);

    const rpgAct = await httpJson(relayPort, '/api/v1/player-rpg/action', {
      method: 'POST',
      headers: authHeaders,
      body: { action: 'level.toggleHold', enabled: true },
    });
    assert.equal(rpgAct.status, 200, `player-rpg/action failed: ${JSON.stringify(rpgAct.json)}`);

    // v151 level gates require Lv 2 for City Dump and Lv 5 for Personal Bazaars
    execFileSync(
      php,
      [
        '-r',
        'require $argv[1]; $db = Zone\\Engine\\Core\\Persistence\\Database::connect("sqlite:" . $argv[2]); $db->execute("UPDATE players SET level = 5, xp = 1000 WHERE id = :id", ["id" => $argv[3]]);',
        join(repo, 'engine/bootstrap.php'),
        join(fixture, 'http149.sqlite'),
        sess.json.playerId,
      ],
      { cwd: repo, windowsHide: true },
    );

    const cityAct = await httpJson(relayPort, '/api/v1/city-activities/action', {
      method: 'POST',
      headers: authHeaders,
      body: { action: 'dump.search' },
    });
    assert.equal(cityAct.status, 200, `city-activities/action failed: ${JSON.stringify(cityAct.json)}`);

    const econAct = await httpJson(relayPort, '/api/v1/syndicate-economy/action', {
      method: 'POST',
      headers: authHeaders,
      body: { action: 'bazaar.toggle', open: true, tagline: 'Open 24/7' },
    });
    assert.equal(econAct.status, 200, `syndicate-economy/action failed: ${JSON.stringify(econAct.json)}`);
  } finally {
    relay.close();
    relay.closeIdleConnections();
    phpChild.kill();
    await new Promise((r) => setTimeout(r, 150));
    await rm(fixture, { recursive: true, force: true });
  }
});
