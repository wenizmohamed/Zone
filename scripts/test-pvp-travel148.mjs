import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
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

test('v148 Relay allowlists all 8 new PvP, Hospital, Profile, Events, Foreign Travel & Faction Chain routes', () => {
  const newRoutes = [
    '/api/v1/hospital/patients',
    '/api/v1/hospital/revive-player',
    '/api/v1/player-profile',
    '/api/v1/events-feed',
    '/api/v1/foreign-market',
    '/api/v1/foreign-market/action',
    '/api/v1/faction-chain',
    '/api/v1/faction-chain/action',
  ];
  for (const r of newRoutes) {
    assert.equal(isPublicPath(r), true, `Expected relay isPublicPath(${r}) === true`);
  }
});

test('v148 Fair Fight math, Stealth masking, Retaliation 1.5x, Overseas 1.25x & Shared Faction Chain 5m timer', async () => {
  const fixture = await mkdtemp(join(repo, 'engine/var/test-pvp148-'));
  const dbPath = join(fixture, 'pvp148.sqlite');
  try {
    const out = runPhpEval(
      dbPath,
      `
      $mk = function (string $name, int $str, int $def, int $spd, int $dex, int $cash = 100000) use ($engine, $db): string {
          $id = $engine->browserSessions()->create($name . '-' . bin2hex(random_bytes(5)))['playerId'];
          $db->execute(
              'UPDATE players SET username = :u, strength = :s, defense = :d, speed = :sp, dexterity = :dx, cash = :c, energy = 150, max_energy = 150, life = 500, max_life = 500, resources_updated_at = :at WHERE id = :id',
              ['u' => $name, 's' => $str, 'd' => $def, 'sp' => $spd, 'dx' => $dex, 'c' => $cash, 'at' => gmdate('c', time() + 3600), 'id' => $id]
          );
          return $id;
      };

      $clock = 1763600000;
      $combat = new \\Zone\\Engine\\Core\\Game\\PlayerCombatService(
          $db,
          $events,
          static fn (int $min, int $max): int => $min,
          static function () use (&$clock): int { return $clock; }
      );
      $chainSvc = new \\Zone\\Engine\\Core\\Game\\FactionChainService(
          $db,
          $events,
          static function () use (&$clock): int { return $clock; }
      );

      // 1. Fair Fight exact formula: 1 + (8/3) * (defTotal / attTotal), clamped [1.0, 3.0]
      // Attacker total = 4000, Defender total = 750 -> 1 + (8/3)*(750/4000) = 1.50
      $attA = $mk('ViperAlpha', 1500, 500, 1000, 1000);
      $defA = $mk('Target750', 200, 150, 200, 200);
      $engine->joinFaction('vipers', $attA);
      $s = $combat->snapshot($attA);
      $s = $combat->act('start', $defA, '', $s['version'], $attA);
      while ($s['encounter']['phase'] === 'fighting') {
          $s = $combat->act('strike', '', '', $s['version'], $attA);
      }
      $fin1 = $combat->act('finish', '', 'hosp', $s['version'], $attA);

      // 2. Retaliation 1.5x: Rival (kings) hospitalizes ViperAlpha, then ViperBravo retaliates within 300s!
      $rival = $mk('KingRival', 5000, 5000, 5000, 5000);
      $viperBravo = $mk('ViperBravo', 12000, 12000, 12000, 25000);
      $engine->joinFaction('kings', $rival);
      $engine->joinFaction('vipers', $viperBravo);

      $db->execute('DELETE FROM action_cooldowns');
      $sr = $combat->snapshot($rival);
      $sr = $combat->act('start', $attA, '', $sr['version'], $rival);
      while ($sr['encounter']['phase'] === 'fighting') {
          $sr = $combat->act('strike', '', '', $sr['version'], $rival);
      }
      $combat->act('finish', '', 'hosp', $sr['version'], $rival);

      // Move both ViperBravo and KingRival overseas to 'johannesburg' to ALSO verify overseas 1.25x + stealth + retaliation 1.5x + shared chain count=2!
      $db->execute("UPDATE players SET city = 'johannesburg', life = 500 WHERE id IN (:a, :b)", ['a' => $viperBravo, 'b' => $rival]);
      (new \\Zone\\Engine\\Core\\Game\\ProgressionService($db, $events))->clearHospital($rival);
      $progB = $db->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $viperBravo]);
      $stB = json_decode($progB['state_json'], true);
      $stB['meritTree']['stealth'] = 10;
      $db->execute('UPDATE player_progression SET state_json = :s WHERE player_id = :id', ['s' => json_encode($stB), 'id' => $viperBravo]);

      $clock += 120; // Still inside 300s chain & retaliation window!
      $db->execute('DELETE FROM action_cooldowns');
      $sb = $combat->snapshot($viperBravo);
      $sb = $combat->act('start', $rival, '', $sb['version'], $viperBravo);
      while ($sb['encounter']['phase'] === 'fighting') {
          $sb = $combat->act('strike', '', '', $sb['version'], $viperBravo);
      }
      $fin2 = $combat->act('finish', '', 'hosp', $sb['version'], $viperBravo);

      // Push chain to milestone 10 via 8 more quick hits (3..10)
      $milestoneHit = null;
      for ($i = 3; $i <= 10; $i++) {
          $clock += 10;
          $milestoneHit = $chainSvc->recordHit($viperBravo, 'leave', 'Dummy_' . $i, 2.0);
      }
      $chainActive = $chainSvc->snapshot($viperBravo)['chain'];

      // Advance clock past 300s expiry -> chain count resets to 0 while best stays 10!
      $clock += 305;
      $chainExpired = $chainSvc->snapshot($viperBravo)['chain'];

      // Check Stealth masking on defender's events feed & profile!
      $social = new \\Zone\\Engine\\Core\\Game\\SyndicateSocialService($db, $events);
      $rivalFeed = $social->eventsFeed($rival);
      $rivalProfileViewedByRival = $social->playerProfile($rival, $rival);

      echo json_encode([
          'fin1Modifiers' => $fin1['result']['modifiers'],
          'fin2Result' => $fin2['result'],
          'milestoneHit' => $milestoneHit,
          'chainActive' => $chainActive,
          'chainExpired' => $chainExpired,
          'rivalFeed' => $rivalFeed['events'],
          'rivalRecentAttacks' => $rivalProfileViewedByRival['profile']['recentAttacks'],
      ]);
      `,
    );

    assert.equal(out.fin1Modifiers.fair_fight, 1.5, 'Exact Fair Fight 1 + (8/3)*(750/4000) = 1.50');
    assert.equal(out.fin1Modifiers.overseas, 1.0, 'Home city overseas multiplier is 1.0');
    assert.equal(out.fin2Result.modifiers.retaliation, 1.5, 'Retaliation within 5m grants 1.5x');
    assert.equal(out.fin2Result.modifiers.overseas, 1.25, 'Overseas fight in Johannesburg grants 1.25x');
    assert.equal(out.fin2Result.modifiers.chain, 1.04, 'Second shared faction hit advances chain multiplier to 1.04x');
    assert.equal(out.fin2Result.stealthed, true, 'High dexterity + stealth merit rolls stealthed = true');
    assert.equal(out.fin2Result.attackerDisplayName, 'Someone', 'Stealthed hit displays Someone');

    const hospFeed = out.rivalFeed.find((e) => e.type === 'hospitalized');
    assert.ok(hospFeed, 'Hospitalized event recorded in defender events-feed');
    assert.match(hospFeed.messageEn, /^Someone /, 'Defender events-feed masks stealthed attacker as Someone');
    assert.ok(!hospFeed.messageEn.includes('ViperBravo'), 'Defender events-feed never leaks stealthed attacker username');

    const maskedAttack = out.rivalRecentAttacks.find((a) => a.stealthed === true);
    assert.ok(maskedAttack, 'Profile recentAttacks records stealthed attack');
    assert.equal(maskedAttack.attackerName, 'Someone', 'Profile recentAttacks masks stealthed attackerName');
    assert.equal(maskedAttack.attackerId, null, 'Profile recentAttacks masks stealthed attackerId');

    assert.equal(out.milestoneHit.count, 10, 'Shared faction chain reaches milestone 10');
    assert.equal(out.milestoneHit.multiplier, 1.25, 'Chain 10 unlocks 1.25x multiplier');
    assert.equal(out.milestoneHit.milestoneBonusRespect, 25, 'Milestone 10 awards +25 bonus family respect');
    assert.equal(out.chainActive.active, true, 'Chain active within 300s window');
    assert.equal(out.chainExpired.count, 0, 'Chain resets to 0 after 5m expiry');
    assert.equal(out.chainExpired.best, 10, 'Chain preserves best=10 after expiry');
  } finally {
    await rm(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('v148 Live HTTP + Relay E2E: Bounty auto-settlement on PvP hosp, Hospital Revive (25E/75E), Profiles, Events Feed, 11-City Foreign Travel & Faction Armory/Wall', async () => {
  const fixture = await mkdtemp(join(repo, 'engine/var/test-http148-'));
  const dbPath = join(fixture, 'http148.sqlite');
  const relayKey = randomBytes(32).toString('hex');
  const publicHost = 'zone148.test';
  const enginePort = await unusedPort();

  const phpProc = spawn(php, ['-S', `127.0.0.1:${enginePort}`, join(repo, 'engine/router.php')], {
    cwd: repo,
    env: {
      ...process.env,
      VERCEL: '',
      ZONE_DATABASE_URL: `sqlite:${dbPath}`,
      ZONE_PLAYER_SESSIONS: '1',
      ZONE_ENGINE_RELAY_KEY: relayKey,
      ZONE_ENGINE_PUBLIC_HOSTS: publicHost,
    },
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  const relayServer = createRelay({ key: relayKey, publicHosts: [publicHost], upstreamPort: enginePort });
  relayServer.listen(0, '127.0.0.1');
  await once(relayServer, 'listening');
  const relayPort = relayServer.address().port;

  try {
    // Wait for PHP server health
    for (let i = 0; i < 60; i++) {
      try {
        const h = await httpJson(enginePort, '/api/v1/health', { headers: { host: publicHost } });
        if (h.status === 200) break;
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    const relayHeaders = (cookie = '') => ({
      'x-zone-relay-key': relayKey,
      'x-zone-client-host': publicHost,
      'x-zone-client-proto': 'https',
      'x-zone-client-ip': '198.51.100.42',
      origin: `https://${publicHost}`,
      ...(cookie ? { cookie } : {}),
    });

    async function createPlayer(ipSuffix) {
      const res = await httpJson(relayPort, '/api/v1/auth/session', {
        method: 'POST',
        headers: {
          ...relayHeaders(),
          'x-zone-client-ip': `198.51.100.${ipSuffix}`,
        },
        body: {},
      });
      assert.equal(res.status, 201);
      const cookie = res.headers['set-cookie'].find((c) => c.startsWith('zone_player_session=')).split(';')[0];
      return { id: res.json.playerId, cookie };
    }

    const funder = await createPlayer(11);
    const target = await createPlayer(12);
    const hunter = await createPlayer(13);
    const medic = await createPlayer(14);

    // Seed clean battle stats & cash via authoritative DB setup for deterministic PvP + travel test
    runPhpEval(
      dbPath,
      `
      $db->execute("UPDATE players SET username = 'FunderA', level = 15, xp = 10500, cash = 200000, energy = 150, life = 500, max_life = 500, resources_updated_at = :at WHERE id = :id", ['at' => gmdate('c', time() + 3600), 'id' => ${JSON.stringify(funder.id)}]);
      $db->execute("UPDATE players SET username = 'TargetB', cash = 50000, energy = 100, life = 200, max_life = 400, strength = 20, defense = 20, speed = 20, dexterity = 20, resources_updated_at = :at WHERE id = :id", ['at' => gmdate('c', time() + 3600), 'id' => ${JSON.stringify(target.id)}]);
      $db->execute("UPDATE players SET username = 'HunterC', cash = 10000, energy = 150, life = 800, max_life = 800, strength = 25000, defense = 25000, speed = 25000, dexterity = 25000, resources_updated_at = :at WHERE id = :id", ['at' => gmdate('c', time() + 3600), 'id' => ${JSON.stringify(hunter.id)}]);
      $db->execute("UPDATE players SET username = 'MedicD', level = 15, xp = 10500, cash = 5000000, energy = 150, max_energy = 150, life = 500, max_life = 500, resources_updated_at = :at WHERE id = :id", ['at' => gmdate('c', time() + 3600), 'id' => ${JSON.stringify(medic.id)}]);
      $engine->gameplay(${JSON.stringify(medic.id)});
      $mRow = $db->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => ${JSON.stringify(medic.id)}]);
      $mState = json_decode($mRow['state_json'], true);
      $mState['eduDone']['bio'] = 1;
      $mState['inv']['smallkit'] = 4;
      $db->execute('UPDATE player_progression SET state_json = :s WHERE player_id = :id', ['s' => json_encode($mState), 'id' => ${JSON.stringify(medic.id)}]);
      echo json_encode(['ok' => true]);
      `,
    );

    // 1. Place $25,000 escrowed bounty via place_bounty alias
    const placeRes = await httpJson(relayPort, '/api/v1/social/action', {
      method: 'POST',
      headers: relayHeaders(funder.cookie),
      body: { action: 'place_bounty', target: 'TargetB', rewardCash: 25000, reason: 'Syndicate betrayal' },
    });
    assert.equal(placeRes.status, 200);
    assert.equal(placeRes.json.player.cash, 175000, 'Escrow deducts $25,000 from FunderA immediately');

    // 1b. INV-08 guard: winning PvP with 'leave' does NOT settle escrowed bounties; only 'hosp' settles!
    let pvpSnapLeave = (await httpJson(relayPort, '/api/v1/player-combat', { headers: relayHeaders(hunter.cookie) })).json;
    let leaveFight = await httpJson(relayPort, '/api/v1/player-combat/action', {
      method: 'POST',
      headers: relayHeaders(hunter.cookie),
      body: { action: 'start', opponentId: target.id, approach: '', expectedVersion: pvpSnapLeave.version },
    });
    assert.equal(leaveFight.status, 200);
    while (leaveFight.json.encounter?.phase === 'fighting') {
      leaveFight = await httpJson(relayPort, '/api/v1/player-combat/action', {
        method: 'POST',
        headers: relayHeaders(hunter.cookie),
        body: { action: 'strike', opponentId: '', approach: '', expectedVersion: leaveFight.json.version },
      });
      assert.equal(leaveFight.status, 200);
    }
    const leaveFinish = await httpJson(relayPort, '/api/v1/player-combat/action', {
      method: 'POST',
      headers: relayHeaders(hunter.cookie),
      body: { action: 'finish', opponentId: '', approach: 'leave', expectedVersion: leaveFight.json.version },
    });
    assert.equal(leaveFinish.status, 200);
    assert.equal(leaveFinish.json.result.bountyCashAwarded ?? 0, 0, 'PvP leave finish must NOT claim active bounties');
    assert.equal(leaveFinish.json.player.cash, 10000, 'HunterC cash unchanged on leave finish');

    // Clear attack cooldown & 2m street-recovery timer on TargetB for the real 'hosp' takedown!
    runPhpEval(
      dbPath,
      `
      $db->execute('DELETE FROM action_cooldowns');
      (new \\Zone\\Engine\\Core\\Game\\ProgressionService($db, $events))->clearHospital(${JSON.stringify(target.id)});
      $db->execute("UPDATE players SET life = 200, energy = 150 WHERE id IN (:t, :h)", ['t' => ${JSON.stringify(target.id)}, 'h' => ${JSON.stringify(hunter.id)}]);
      echo json_encode(['ok' => true]);
      `,
    );

    // 2. HunterC joins vipers, attacks TargetB, and hospitalizes -> auto-claims $25,000 bounty + starts shared Faction Chain!
    await httpJson(relayPort, '/api/v1/factions/join', {
      method: 'POST',
      headers: relayHeaders(hunter.cookie),
      body: { factionId: 'vipers' },
    });
    await httpJson(relayPort, '/api/v1/factions/join', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { factionId: 'vipers' },
    });

    let pvpSnap = (await httpJson(relayPort, '/api/v1/player-combat', { headers: relayHeaders(hunter.cookie) })).json;
    let actRes = await httpJson(relayPort, '/api/v1/player-combat/action', {
      method: 'POST',
      headers: relayHeaders(hunter.cookie),
      body: { action: 'start', opponentId: target.id, approach: '', expectedVersion: pvpSnap.version },
    });
    assert.equal(actRes.status, 200);
    while (actRes.json.encounter?.phase === 'fighting') {
      actRes = await httpJson(relayPort, '/api/v1/player-combat/action', {
        method: 'POST',
        headers: relayHeaders(hunter.cookie),
        body: { action: 'strike', opponentId: '', approach: '', expectedVersion: actRes.json.version },
      });
      assert.equal(actRes.status, 200);
    }
    assert.equal(actRes.json.encounter.phase, 'won');

    const hospFinish = await httpJson(relayPort, '/api/v1/player-combat/action', {
      method: 'POST',
      headers: relayHeaders(hunter.cookie),
      body: { action: 'finish', opponentId: '', approach: 'hosp', expectedVersion: actRes.json.version },
    });
    assert.equal(hospFinish.status, 200);
    assert.equal(hospFinish.json.result.bountyCashAwarded, 25000, 'PvP hosp auto-claims $25,000 escrowed bounty');
    assert.equal(hospFinish.json.result.bountiesClaimed.length, 1);
    assert.equal(hospFinish.json.player.cash, 35000, 'HunterC cash increases from $10,000 to $35,000');

    // 3. Check Player Profile (TargetB shows Status === 'Hospital')
    const profHosp = await httpJson(relayPort, `/api/v1/player-profile?id=${encodeURIComponent(target.id)}`, {
      headers: relayHeaders(medic.cookie),
    });
    assert.equal(profHosp.status, 200);
    assert.equal(profHosp.json.profile.username, 'TargetB');
    assert.equal(profHosp.json.profile.status, 'Hospital');
    assert.ok(profHosp.json.profile.recentAttacks.length >= 1, 'Player profile exposes recentAttacks from event_log');

    // 4. Hospital Patients & Real Player Revive (MedicD has bio -> 25E cost; HunterC without bio -> 75E cost)
    const wardHunter = await httpJson(relayPort, '/api/v1/hospital/patients', { headers: relayHeaders(hunter.cookie) });
    assert.equal(wardHunter.status, 200);
    assert.equal(wardHunter.json.energyCost, 75, 'Non-med-educated player pays 75E to revive');

    const wardMedic = await httpJson(relayPort, '/api/v1/hospital/patients', { headers: relayHeaders(medic.cookie) });
    assert.equal(wardMedic.status, 200);
    assert.equal(wardMedic.json.energyCost, 25, 'Bio-educated player pays 25E to revive');
    assert.ok(wardMedic.json.patients.some((p) => p.id === target.id && p.npc === false), 'TargetB listed in real hospital patients');

    // INV-04 guard: cross-city revive rejected until both players are in the same city!
    runPhpEval(
      dbPath,
      `
      $db->execute("UPDATE players SET city = 'dubai' WHERE id = :id", ['id' => ${JSON.stringify(medic.id)}]);
      echo json_encode(['ok' => true]);
      `,
    );
    const crossCityRevive = await httpJson(relayPort, '/api/v1/hospital/revive-player', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { targetPlayerId: target.id },
    });
    assert.equal(crossCityRevive.status, 400, 'Cross-city revive rejected when reviver is not in patient city');
    runPhpEval(
      dbPath,
      `
      $db->execute("UPDATE players SET city = 'Zone City' WHERE id = :id", ['id' => ${JSON.stringify(medic.id)}]);
      echo json_encode(['ok' => true]);
      `,
    );

    const reviveRes = await httpJson(relayPort, '/api/v1/hospital/revive-player', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { targetPlayerId: target.id },
    });
    assert.equal(reviveRes.status, 200);
    assert.equal(reviveRes.json.energySpent, 25);
    assert.equal(reviveRes.json.reviveSkill, 1);
    assert.equal(reviveRes.json.targetLifeAfter, 100, 'Restores 25% of TargetB max_life (400 * 0.25 = 100)');
    assert.equal(reviveRes.json.player.energy, 125, 'MedicD energy reduced from 150 to 125');

    const profAfterRevive = await httpJson(relayPort, `/api/v1/player-profile?id=${encodeURIComponent(target.id)}`, {
      headers: relayHeaders(medic.cookie),
    });
    assert.equal(profAfterRevive.json.profile.status, 'Okay', 'TargetB status restored to Okay after revive');

    // 5. TargetB Events Feed contains bounty_placed, hospitalized, bounty_claimed, revived
    const feedTarget = await httpJson(relayPort, '/api/v1/events-feed', { headers: relayHeaders(target.cookie) });
    assert.equal(feedTarget.status, 200);
    const feedTypes = new Set(feedTarget.json.events.map((e) => e.type));
    for (const expectedType of ['bounty_placed', 'hospitalized', 'bounty_claimed', 'revived']) {
      assert.ok(feedTypes.has(expectedType), `Expected TargetB events-feed to include ${expectedType}`);
    }

    // 6. Shared Faction Chain, Armory & Territory Wall via /api/v1/faction-chain
    const chainSnap = await httpJson(relayPort, '/api/v1/faction-chain', { headers: relayHeaders(medic.cookie) });
    assert.equal(chainSnap.status, 200);
    assert.equal(chainSnap.json.factionId, 'vipers');
    assert.ok(chainSnap.json.chain.count >= 1, 'MedicD sees shared vipers chain started by HunterC');

    const depArmory = await httpJson(relayPort, '/api/v1/faction-chain/action', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { action: 'armory.deposit', itemId: 'smallkit', quantity: 2 },
    });
    assert.equal(depArmory.status, 200);
    assert.equal(depArmory.json.armory.stock.smallkit, 12, 'Shared armory smallkit stock increments from 10 to 12');

    const wallJoin = await httpJson(relayPort, '/api/v1/faction-chain/action', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { action: 'wall.join' },
    });
    assert.equal(wallJoin.status, 200);
    assert.equal(wallJoin.json.wall.joined, true);
    assert.equal(wallJoin.json.result.energySpent, 5);

    // 7. 11-City Foreign Travel & Smuggling Market: depart -> in-flight block -> arrive -> buy within capacity -> return!
    const fmInit = await httpJson(relayPort, '/api/v1/foreign-market', { headers: relayHeaders(medic.cookie) });
    assert.equal(fmInit.status, 200);
    assert.equal(fmInit.json.hubs.length, 11, 'Exposes all 11 Torn foreign travel hubs');
    const jnb = fmInit.json.hubs.find((h) => h.id === 'johannesburg');
    assert.equal(jnb.fare, 35000);
    assert.equal(jnb.items.find((i) => i.id === 'xanax').price, 740000, 'Johannesburg sells Xanax at $740,000');

    // Reject buying while in Zone City
    const buyHome = await httpJson(relayPort, '/api/v1/foreign-market/action', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { action: 'buy', itemId: 'xanax', quantity: 1 },
    });
    assert.equal(buyHome.status, 400);

    // Depart to Johannesburg
    const departRes = await httpJson(relayPort, '/api/v1/foreign-market/action', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { action: 'depart', destination: 'johannesburg' },
    });
    assert.equal(departRes.status, 200);
    assert.equal(departRes.json.travel.status, 'traveling');
    assert.equal(departRes.json.result.farePaid, 35000);
    assert.equal(departRes.json.result.flightSeconds, 720);

    // Reject buying while mid-flight
    const buyMidFlight = await httpJson(relayPort, '/api/v1/foreign-market/action', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { action: 'buy', itemId: 'xanax', quantity: 1 },
    });
    assert.equal(buyMidFlight.status, 400);

    // Fast-forward arrival timestamp on server DB to simulate landing
    runPhpEval(
      dbPath,
      `
      $db->execute("UPDATE player_travel SET arrives_at = :past WHERE player_id = :id", ['past' => gmdate('c', time() - 5), 'id' => ${JSON.stringify(medic.id)}]);
      echo json_encode(['ok' => true]);
      `,
    );

    const landed = await httpJson(relayPort, '/api/v1/foreign-market', { headers: relayHeaders(medic.cookie) });
    assert.equal(landed.json.isAbroad, true);
    assert.equal(landed.json.activeHubId, 'johannesburg');
    assert.equal(landed.json.luggage.capacity, 5, 'Base travel capacity is 5');

    // INV-09 guard: negative, zero, and float quantities fail with 422 before touching stock or cash
    for (const badQty of [-2, 0, 1.5, '1.5']) {
      const badBuy = await httpJson(relayPort, '/api/v1/foreign-market/action', {
        method: 'POST',
        headers: relayHeaders(medic.cookie),
        body: { action: 'buy', itemId: 'xanax', quantity: badQty },
      });
      assert.equal(badBuy.status, 422, `Expected 422 for invalid foreign-market quantity=${JSON.stringify(badQty)}`);
    }

    // Buy 4 Xanax + 2 Plush Lions = 6 > 5 -> second buy exceeding capacity rejected!
    const buyXanax = await httpJson(relayPort, '/api/v1/foreign-market/action', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { action: 'buy', itemId: 'xanax', quantity: 4 },
    });
    assert.equal(buyXanax.status, 200);
    assert.equal(buyXanax.json.luggage.used, 4);
    assert.equal(buyXanax.json.result.stockRemaining, 11, 'Global Xanax stock depletes from 15 to 11');

    const buyOverCap = await httpJson(relayPort, '/api/v1/foreign-market/action', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { action: 'buy', itemId: 'plush_lion', quantity: 2 },
    });
    assert.equal(buyOverCap.status, 400, 'Rejects exceeding 5-item luggage capacity');

    // Another player sees the depleted global Xanax stock (11)
    const otherMarket = await httpJson(relayPort, '/api/v1/foreign-market', { headers: relayHeaders(funder.cookie) });
    const otherJnbXanax = otherMarket.json.hubs.find((h) => h.id === 'johannesburg').items.find((i) => i.id === 'xanax');
    assert.equal(otherJnbXanax.stock, 11, 'Global foreign market stock is shared across all players');

    // Return flight back to Zone City
    const returnRes = await httpJson(relayPort, '/api/v1/foreign-market/action', {
      method: 'POST',
      headers: relayHeaders(medic.cookie),
      body: { action: 'return' },
    });
    assert.equal(returnRes.status, 200);
    assert.equal(returnRes.json.travel.destination, 'Zone City');
    assert.equal(returnRes.json.result.farePaid, 0);

    // 8. Private Island + Suitcase -> 19 capacity, $0 fare, -30% flight time + Zurich Rehab!
    runPhpEval(
      dbPath,
      `
      $engine->gameplay(${JSON.stringify(funder.id)});
      $fRow = $db->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => ${JSON.stringify(funder.id)}]);
      $fState = json_decode($fRow['state_json'], true);
      $fState['prop'] = 'island';
      $fState['tornState']['suitcase'] = true;
      $fState['addiction'] = 4;
      $fState['tornState']['addiction'] = 4;
      $db->execute('UPDATE player_progression SET state_json = :s WHERE player_id = :id', ['s' => json_encode($fState), 'id' => ${JSON.stringify(funder.id)}]);
      echo json_encode(['ok' => true]);
      `,
    );

    const islandSnap = await httpJson(relayPort, '/api/v1/foreign-market', { headers: relayHeaders(funder.cookie) });
    assert.equal(islandSnap.json.luggage.capacity, 19, 'Base 5 + 10 Private Island + 4 Suitcase = 19 capacity');
    const zurichHub = islandSnap.json.hubs.find((h) => h.id === 'zurich');
    assert.equal(zurichHub.fare, 0, 'Private Island Airstrip waives airfare');
    assert.equal(zurichHub.flightSeconds, 336, 'Private Island Airstrip cuts 480s Zurich flight by 30% to 336s');

    const flyZurich = await httpJson(relayPort, '/api/v1/foreign-market/action', {
      method: 'POST',
      headers: relayHeaders(funder.cookie),
      body: { action: 'depart', destination: 'zurich' },
    });
    assert.equal(flyZurich.status, 200);
    assert.equal(flyZurich.json.result.farePaid, 0);

    runPhpEval(
      dbPath,
      `
      $db->execute("UPDATE player_travel SET arrives_at = :past WHERE player_id = :id", ['past' => gmdate('c', time() - 5), 'id' => ${JSON.stringify(funder.id)}]);
      echo json_encode(['ok' => true]);
      `,
    );

    const rehabRes = await httpJson(relayPort, '/api/v1/foreign-market/action', {
      method: 'POST',
      headers: relayHeaders(funder.cookie),
      body: { action: 'rehab' },
    });
    assert.equal(rehabRes.status, 200);
    assert.equal(rehabRes.json.result.clearedAddiction, 4);
    assert.equal(rehabRes.json.rehabClinic.addiction, 0, 'Zurich Rehab clears addiction to 0');

    // 9. INV-08 escrow retention: placing >40 bounties never evicts active escrowed contracts!
    const retentionOut = runPhpEval(
      dbPath,
      `
      $db->execute("UPDATE players SET cash = 50000000 WHERE id = :id", ['id' => ${JSON.stringify(hunter.id)}]);
      $social = new \\Zone\\Engine\\Core\\Game\\SyndicateSocialService($db, $events);
      $firstId = null;
      for ($i = 1; $i <= 42; $i++) {
          $res = $social->placeBounty(${JSON.stringify(hunter.id)}, 'TargetB', 5000, 'Retention check #' . $i);
          if ($firstId === null) {
              $firstId = $res['bounty']['id'];
          }
      }
      $row = $db->fetchOne("SELECT value FROM engine_metadata WHERE name = 'syndicate-bounties-v1'");
      $all = json_decode((string) $row['value'], true);
      $activeIds = array_map(static fn (array $b): string => $b['id'], array_filter($all, static fn (array $b): bool => ($b['status'] ?? '') === 'active'));
      echo json_encode([
          'activeCount' => count($activeIds),
          'firstStillActive' => in_array($firstId, $activeIds, true),
      ]);
      `,
    );
    assert.ok(retentionOut.activeCount >= 42, 'All 42+ active escrowed bounties remain active without array_slice(40) eviction');
    assert.equal(retentionOut.firstStillActive, true, 'Oldest active escrowed bounty was NOT silently evicted');

    // 10. INV-04 ephemeral ledger cookie refresh (<3.5KB) on placeBounty + sendCash + PvP finish!
    const cookieCheck = runPhpEval(
      dbPath,
      `
      putenv('ZONE_EPHEMERAL_VERCEL_SQLITE=1');
      putenv('ZONE_PLAYER_SESSIONS=1');
      putenv('ZONE_LEDGER_SECRET=ephemeral-ledger-secret-key-32-chars-minimum');
      $db->execute("UPDATE players SET cash = 200000 WHERE id = :id", ['id' => ${JSON.stringify(funder.id)}]);
      $social = new \\Zone\\Engine\\Core\\Game\\SyndicateSocialService($db, $events);
      $social->sendCash(${JSON.stringify(funder.id)}, 'TargetB', 15000, 'Wire test');
      $cookieAfterWire = (string) ($GLOBALS['__zone_ledger_cookie'] ?? '');

      // Hydrate into a brand-new SQLite database to prove cash survives cold-start roundtrip!
      $coldDb = \\Zone\\Engine\\Core\\Persistence\\Database::connect('sqlite::memory:');
      $coldDb->migrateAndSeed();
      $coldEvents = new \\Zone\\Engine\\Core\\Events\\EventBus($coldDb);
      $coldRow = $db->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => ${JSON.stringify(funder.id)}]);
      $coldDb->insertIgnore('players', ['id','username','level','xp','cash','energy','nerve','life','happy','max_energy','max_nerve','max_life','max_happy','resources_updated_at','strength','defense','speed','dexterity','bank_balance','city','login_streak','last_login_day'], [
          $coldRow['id'], $coldRow['username'], 1, 0, 85000, 100, 15, 500, 250, 100, 15, 500, 250, gmdate('c'), 10, 10, 10, 10, 125000, 'Zone City', 1, gmdate('Y-m-d')
      ]);
      $_COOKIE['zone_player_ledger'] = $cookieAfterWire;
      $hydrated = (new \\Zone\\Engine\\Core\\Game\\ProgressionService($coldDb, $coldEvents))->snapshot(${JSON.stringify(funder.id)});
      echo json_encode([
          'cookieBytes' => strlen($cookieAfterWire),
          'hydratedCash' => $hydrated['player']['cash'],
      ]);
      `,
    );
    assert.ok(cookieCheck.cookieBytes > 40 && cookieCheck.cookieBytes <= 3500, `Ledger cookie must be <= 3500 bytes, got ${cookieCheck.cookieBytes}`);
    assert.equal(cookieCheck.hydratedCash, 185000, 'Ephemeral zone_player_ledger cookie preserves post-wire cash ($185,000) across cold-start SQLite');
  } finally {
    relayServer.closeAllConnections();
    await new Promise((r) => relayServer.close(r));
    phpProc.kill();
    await rm(fixture, { recursive: true, force: true, maxRetries: 15, retryDelay: 100 });
  }
});
