import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const php = [
  resolve(root, '.tools/php-8.5.10/php.exe'),
  resolve(root, '../php-8.5.10/php.exe'),
  process.env.ZONE_TEST_PHP,
  'php',
].find(candidate => candidate === 'php' || (candidate && existsSync(candidate)));

function runPhpHarness(phpCode) {
  const dir = resolve(root, 'engine/var/asc151-' + randomUUID());
  mkdirSync(dir, { recursive: true });
  const scriptPath = resolve(dir, 'harness.php');
  writeFileSync(scriptPath, phpCode, 'utf8');
  try {
    const out = execFileSync(php, ['-d', 'opcache.enable=0', scriptPath], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        ZONE_REDIS_URL: '',
        REDIS_URL: '',
        DATABASE_URL: '',
        POSTGRES_URL: '',
        ZONE_EPHEMERAL_VERCEL_SQLITE: '',
      },
    });
    return JSON.parse(out.trim());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('v151 Minute-0 Origin Awakening: 4 bilingual origins, permanent cap boosts, Ledger items/cash, callsign uniqueness, and one-time lock', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\AscensionEngineService;
    use Zone\\Engine\\Core\\Game\\ProgressionService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $now = gmdate('c');

    foreach (['p-ghost', 'p-bruiser', 'p-banker', 'p-chemist'] as $idx => $pid) {
      $db->insertIgnore(
        'players',
        ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
        [$pid, 'Guest_' . $idx, 1, 0, 1000, 100, 45, 250, 500, 100, 45, 250, 500, $now, 15, 15, 15, 15, 0, 'Zone City', 0, null]
      );
    }

    $asc = new AscensionEngineService($db, $events);
    $prog = new ProgressionService($db, $events);
    $rejects = static function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    $snap0 = $asc->snapshot('p-ghost');
    $badCallsignErr = $rejects(fn() => $asc->act('p-ghost', 'origin.select', ['originId' => 'harbor_ghost', 'callsign' => '1bad!']));

    $bruiserInvBefore = $prog->snapshot('p-bruiser')['state']['inv'];
    $chemistInvBefore = $prog->snapshot('p-chemist')['state']['inv'];
    $ghostInvBefore = $prog->snapshot('p-ghost')['state']['inv'];

    $ghostRes = $asc->act('p-ghost', 'origin.select', ['originId' => 'harbor_ghost', 'callsign' => 'PierPhantom']);
    $reselectErr = $rejects(fn() => $asc->act('p-ghost', 'origin.select', ['originId' => 'cartel_bruiser']));
    $dupCallsignErr = $rejects(fn() => $asc->act('p-bruiser', 'origin.select', ['originId' => 'cartel_bruiser', 'callsign' => 'pierphantom']));

    $bruiserRes = $asc->act('p-bruiser', 'origin.select', ['originId' => 'cartel_bruiser']);
    $bankerRes = $asc->act('p-banker', 'origin.select', ['originId' => 'disgraced_banker']);
    $chemistRes = $asc->act('p-chemist', 'origin.select', ['originId' => 'street_chemist']);

    $ghostInv = $prog->snapshot('p-ghost')['state']['inv'];
    $bruiserInv = $prog->snapshot('p-bruiser')['state']['inv'];
    $chemistInv = $prog->snapshot('p-chemist')['state']['inv'];

    $ledgerCount = (int) ($db->fetchOne("SELECT COUNT(*) AS c FROM economy_ledger WHERE reason LIKE 'ascension.origin.%'")['c'] ?? 0);

    echo json_encode([
      'initialOriginChosen' => $snap0['originChosen'],
      'originCount' => count($snap0['origins']),
      'initialLunaMood' => $snap0['lunaOracle']['mood'],
      'badCallsignErr' => $badCallsignErr,
      'reselectErr' => $reselectErr,
      'dupCallsignErr' => $dupCallsignErr,
      'ghostUsername' => $ghostRes['player']['username'],
      'ghostCash' => $ghostRes['player']['cash'],
      'ghostKnife' => (int) ($ghostInv['knife'] ?? 0) - (int) ($ghostInvBefore['knife'] ?? 0),
      'ghostCrimeBonus' => $ghostRes['passiveBonuses']['crimeSuccessPct'],
      'ghostStealthBonus' => $ghostRes['passiveBonuses']['stealthPct'],
      'ghostDir1Claimable' => $ghostRes['activeDirective']['claimable'],
      'bruiserCash' => $bruiserRes['player']['cash'],
      'bruiserMaxLife' => $bruiserRes['player']['max_life'],
      'bruiserBat' => (int) ($bruiserInv['bat'] ?? 0) - (int) ($bruiserInvBefore['bat'] ?? 0),
      'bruiserKit' => (int) ($bruiserInv['smallkit'] ?? 0) - (int) ($bruiserInvBefore['smallkit'] ?? 0),
      'bruiserDmgBonus' => $bruiserRes['passiveBonuses']['combatDamagePct'],
      'bankerCash' => $bankerRes['player']['cash'],
      'bankerAprBonus' => $bankerRes['passiveBonuses']['bankAprPct'],
      'bankerFeeRed' => $bankerRes['passiveBonuses']['stockFeeReductionPct'],
      'chemistCash' => $chemistRes['player']['cash'],
      'chemistMaxEnergy' => $chemistRes['player']['max_energy'],
      'chemistKit' => (int) ($chemistInv['smallkit'] ?? 0) - (int) ($chemistInvBefore['smallkit'] ?? 0),
      'chemistDrink' => (int) ($chemistInv['drink'] ?? 0) - (int) ($chemistInvBefore['drink'] ?? 0),
      'chemistOdRed' => $chemistRes['passiveBonuses']['odRiskReductionPct'],
      'ledgerCount' => $ledgerCount,
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.initialOriginChosen, false);
  assert.equal(res.originCount, 4);
  assert.equal(res.initialLunaMood, 'awakening');
  assert.match(res.badCallsignErr, /Callsign must be 3-24/i);
  assert.match(res.reselectErr, /already been awakened/i);
  assert.match(res.dupCallsignErr, /already claimed/i);

  assert.equal(res.ghostUsername, 'PierPhantom');
  assert.equal(res.ghostCash, 5000); // 1000 + 4000
  assert.equal(res.ghostKnife, 1);
  assert.equal(res.ghostCrimeBonus, 8);
  assert.equal(res.ghostStealthBonus, 10);
  assert.equal(res.ghostDir1Claimable, true);

  assert.equal(res.bruiserCash, 4000); // 1000 + 3000
  assert.equal(res.bruiserMaxLife, 300); // 250 + 50
  assert.equal(res.bruiserBat, 1);
  assert.equal(res.bruiserKit, 1);
  assert.equal(res.bruiserDmgBonus, 10);

  assert.equal(res.bankerCash, 13000); // 1000 + 12000
  assert.equal(res.bankerAprBonus, 8);
  assert.equal(res.bankerFeeRed, 20);

  assert.equal(res.chemistCash, 4500); // 1000 + 3500
  assert.equal(res.chemistMaxEnergy, 110); // 100 + 10
  assert.equal(res.chemistKit, 2);
  assert.equal(res.chemistDrink, 2);
  assert.equal(res.chemistOdRed, 20);
  assert.ok(res.ledgerCount >= 9);
});

test('v151 6-Era Underworld Ascension Spine, Next Unlock radar (Lv 2..25), and Era Breakthrough Cash + 2 SP + 2 Merits + Title claims', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\AscensionEngineService;
    use Zone\\Engine\\Core\\Game\\RankAndSkillTreeService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $now = gmdate('c');
    $db->insertIgnore(
      'players',
      ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
      ['era-tester', 'EraRunner', 1, 50, 2000, 100, 45, 250, 500, 100, 45, 250, 500, $now, 15, 15, 15, 15, 0, 'Zone City', 0, null]
    );

    $asc = new AscensionEngineService($db, $events);
    $rpg = new RankAndSkillTreeService($db, $events);
    $rejects = static function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    $lv1Snap = $asc->snapshot('era-tester');
    $earlyEraErr = $rejects(fn() => $asc->act('era-tester', 'era.claimBreakthrough', ['eraIndex' => 1]));

    // Promote to Lv 2 (100 XP) -> Era 1 reaches 100% and nextUnlock advances to Lv 3 Casino!
    $db->execute("UPDATE players SET level = 2, xp = 100 WHERE id = 'era-tester'");
    $lv2Snap = $asc->snapshot('era-tester');
    $claimEra1 = $asc->act('era-tester', 'era.claimBreakthrough', ['eraIndex' => 1]);
    $dupEraErr = $rejects(fn() => $asc->act('era-tester', 'era.claimBreakthrough', ['eraIndex' => 1]));
    $rpgAfterEra1 = $rpg->snapshot('era-tester');

    // Check Era progression across Lv 4 (Era 2), Lv 8 (Era 3), Lv 13 (Era 4), Lv 16 (Era 5), Lv 26 (Era 6)
    $eraChecks = [];
    foreach ([
      [4, 700],
      [8, 2900],
      [13, 7900],
      [16, 12100],
      [26, 33000],
    ] as [$lv, $xpVal]) {
      $db->execute('UPDATE players SET level = :lv, xp = :xp WHERE id = :id', ['lv' => $lv, 'xp' => $xpVal, 'id' => 'era-tester']);
      $s = $asc->snapshot('era-tester');
      $eraChecks[] = [
        'level' => $lv,
        'eraIndex' => $s['eraIndex'],
        'eraNameEn' => $s['currentEra']['nameEn'],
        'safehouseEn' => $s['safehouseStage']['en'],
        'nextUnlockLevel' => $s['nextUnlock']['level'],
        'nextRoute' => $s['nextUnlock']['targetRoute'],
      ];
    }

    // At Lv 26, Era 6 (City Sovereign) is 100% claimable
    $claimEra6 = $asc->act('era-tester', 'era.claimBreakthrough', ['eraIndex' => 6]);

    echo json_encode([
      'eraCount' => count($lv1Snap['eras']),
      'lv1EraPct' => $lv1Snap['eraProgressPct'],
      'lv1NextGate' => $lv1Snap['nextUnlock']['level'],
      'lv1XpNeeded' => $lv1Snap['nextUnlock']['xpNeeded'],
      'earlyEraErr' => $earlyEraErr,
      'lv2EraPct' => $lv2Snap['eraProgressPct'],
      'lv2NextGate' => $lv2Snap['nextUnlock']['level'],
      'era1Cash' => $claimEra1['result']['cashAwarded'],
      'era1Sp' => $claimEra1['result']['spAwarded'],
      'era1Merits' => $claimEra1['result']['meritsAwarded'],
      'era1TitleEn' => $claimEra1['activeTitle']['en'],
      'dupEraErr' => $dupEraErr,
      'skillTreeTotalSp' => $rpgAfterEra1['skillTree']['totalSpEarned'], // 1 (Lv2) + 2 (Era1) = 3 SP
      'meritsAfterEra1' => $rpgAfterEra1['player']['merits'],
      'eraChecks' => $eraChecks,
      'era6Cash' => $claimEra6['result']['cashAwarded'],
      'era6TitleEn' => $claimEra6['activeTitle']['en'],
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.eraCount, 6);
  assert.equal(res.lv1EraPct, 50);
  assert.equal(res.lv1NextGate, 2);
  assert.equal(res.lv1XpNeeded, 50);
  assert.match(res.earlyEraErr, /Reach Level 2/i);
  assert.equal(res.lv2EraPct, 100);
  assert.equal(res.lv2NextGate, 3);
  assert.equal(res.era1Cash, 5000);
  assert.equal(res.era1Sp, 2);
  assert.equal(res.era1Merits, 2);
  assert.equal(res.era1TitleEn, 'Pier 4 Survivor');
  assert.match(res.dupEraErr, /already been claimed/i);
  assert.equal(res.skillTreeTotalSp, 3);
  assert.equal(res.meritsAfterEra1, 2);

  assert.deepEqual(
    res.eraChecks.map(e => [e.eraIndex, e.eraNameEn, e.safehouseEn, e.nextUnlockLevel]),
    [
      [2, 'Dockside Runner', 'Neon Alley Backroom', 5],
      [3, 'Street Enforcer', 'Fortified Harbor Flat', 10],
      [4, 'District Capo', 'Downtown War-Room', 15],
      [5, 'Cartel Baron', 'Skyline Penthouse Vault', 20],
      [6, 'City Sovereign', 'Sovereign Private Island Compound', 25],
    ],
  );
  assert.equal(res.era6Cash, 500000);
  assert.equal(res.era6TitleEn, 'Immortal Sovereign of Zone City');
});

test('v151 Living Nemesis System: 5E Intel sweeps, 15E Showdown (Loss -> 5m Hospital + 60% Intel, Win -> Bounty + XP + Merit + Trophy + 12h Heat Clear + Scar/Grudge)', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\AscensionEngineService;
    use Zone\\Engine\\Core\\Game\\ProgressionService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $clockNow = 1763683200;
    $nowIso = gmdate('c', $clockNow);
    $db->insertIgnore(
      'players',
      ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
      ['nem-hunter', 'ViperStrike', 3, 350, 5000, 100, 45, 300, 500, 100, 45, 300, 500, $nowIso, 25, 25, 25, 25, 0, 'Zone City', 0, null]
    );

    $prog = new ProgressionService($db, $events);
    $asc = new AscensionEngineService(
      $db,
      $events,
      static fn(int $min, int $max): int => (int) round(($min + $max) / 2),
      static function () use (&$clockNow): int { return $clockNow; }
    );
    $rejects = static function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    $asc->act('nem-hunter', 'origin.select', ['originId' => 'cartel_bruiser']);
    $snap0 = $asc->snapshot('nem-hunter');
    $initialHeat = $snap0['nemesis']['heatTaxPct'];
    $prematureConfrontErr = $rejects(fn() => $asc->act('nem-hunter', 'nemesis.confront'));

    // Gather intel until 100% (30% per roll -> 4 sweeps = 100%)
    $sweeps = 0;
    while ($asc->snapshot('nem-hunter')['nemesis']['intel'] < 100) {
      $asc->act('nem-hunter', 'nemesis.gatherIntel');
      $sweeps++;
    }
    $snapExposed = $asc->snapshot('nem-hunter');
    $extraIntelErr = $rejects(fn() => $asc->act('nem-hunter', 'nemesis.gatherIntel'));

    // Force loss first (1 HP, 1 stats) -> 5m Hospital & Intel retained at 60%
    $db->execute("UPDATE players SET life = 1, strength = 1, defense = 1, speed = 1, dexterity = 1, energy = 100 WHERE id = 'nem-hunter'");
    $lossRes = $asc->act('nem-hunter', 'nemesis.confront');
    $hospBlockedErr = $rejects(fn() => $asc->act('nem-hunter', 'nemesis.gatherIntel'));

    // Heal & train strong stats, re-sweep from 60% -> 100% (just 2 sweeps!), then WIN Tier 1!
    $prog->clearHospital('nem-hunter');
    $db->execute("UPDATE players SET life = 350, strength = 60, defense = 55, speed = 60, dexterity = 55, energy = 100 WHERE id = 'nem-hunter'");
    while ($asc->snapshot('nem-hunter')['nemesis']['intel'] < 100) {
      $asc->act('nem-hunter', 'nemesis.gatherIntel');
    }
    $win1 = $asc->act('nem-hunter', 'nemesis.confront');

    // Verify 12h heat immunity active now, and restores after advancing clock > 12h
    $heatDuringClear = $win1['nemesis']['heatTaxPct'];
    $clockNow += 43205;
    $snapAfter12h = $asc->snapshot('nem-hunter');

    // Also defeat Tier 2 to confirm trophy progression ('revolver' -> 'shotgun')
    $db->execute("UPDATE players SET life = 500, max_life = 500, strength = 180, defense = 160, speed = 170, dexterity = 160, energy = 100 WHERE id = 'nem-hunter'");
    while ($asc->snapshot('nem-hunter')['nemesis']['intel'] < 100) {
      $asc->act('nem-hunter', 'nemesis.gatherIntel');
    }
    $win2 = $asc->act('nem-hunter', 'nemesis.confront');
    $invAfter = $prog->snapshot('nem-hunter')['state']['inv'];

    echo json_encode([
      'initialHeat' => $initialHeat,
      'prematureConfrontErr' => $prematureConfrontErr,
      'sweeps' => $sweeps,
      'exposedMood' => $snapExposed['lunaOracle']['mood'],
      'extraIntelErr' => $extraIntelErr,
      'lossVictory' => $lossRes['result']['victory'],
      'lossHospSec' => $lossRes['result']['hospitalSeconds'],
      'intelAfterLoss' => $lossRes['nemesis']['intel'],
      'hospBlockedErr' => $hospBlockedErr,
      'win1Victory' => $win1['result']['victory'],
      'win1Bounty' => $win1['result']['bountyCash'],
      'win1Trophy' => $win1['result']['trophyItemId'],
      'win1NewTier' => $win1['nemesis']['tier'],
      'win1ScarEn' => $win1['nemesis']['scarEn'],
      'win1MemoryEn' => $win1['nemesis']['lastMemoryEn'],
      'heatDuringClear' => $heatDuringClear,
      'heatAfter12h' => $snapAfter12h['nemesis']['heatTaxPct'],
      'win2Trophy' => $win2['result']['trophyItemId'],
      'ownsRevolver' => (int) ($invAfter['revolver'] ?? 0),
      'ownsShotgun' => (int) ($invAfter['shotgun'] ?? 0),
    ], JSON_THROW_ON_ERROR);
  `);

  assert.ok(res.initialHeat >= 2 && res.initialHeat <= 10);
  assert.match(res.prematureConfrontErr, /100% Nemesis Intel/i);
  assert.equal(res.sweeps, 4);
  assert.equal(res.exposedMood, 'nemesis_exposed');
  assert.match(res.extraIntelErr, /already at 100% Intel/i);

  assert.equal(res.lossVictory, false);
  assert.equal(res.lossHospSec, 300);
  assert.equal(res.intelAfterLoss, 60);
  assert.match(res.hospBlockedErr, /leave jail or hospital/i);

  assert.equal(res.win1Victory, true);
  assert.equal(res.win1Bounty, 8000);
  assert.equal(res.win1Trophy, 'revolver');
  assert.equal(res.win1NewTier, 2);
  assert.notEqual(res.win1ScarEn, 'Unscarred — Fresh Turf Feud');
  assert.match(res.win1MemoryEn, /hollow-points/i);
  assert.equal(res.heatDuringClear, 0);
  assert.ok(res.heatAfter12h >= 3);
  assert.equal(res.win2Trophy, 'shotgun');
  assert.equal(res.ownsRevolver, 1);
  assert.equal(res.ownsShotgun, 1);
});

test('v151 5-Slot Evolving Street Crew: progressive level locks, recruit signing bonus, 5m min accrual, 12h cap, and Rank 5 upgrades', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\AscensionEngineService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $clockNow = 1763690000;
    $nowIso = gmdate('c', $clockNow);
    $db->insertIgnore(
      'players',
      ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
      ['crew-boss', 'TurfCaptain', 1, 0, 200000, 100, 45, 250, 500, 100, 45, 250, 500, $nowIso, 20, 20, 20, 20, 0, 'Zone City', 0, null]
    );

    $asc = new AscensionEngineService(
      $db,
      $events,
      null,
      static function () use (&$clockNow): int { return $clockNow; }
    );
    $rejects = static function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    // Lv 1 cannot recruit Lv 12 consigliere yet
    $lockedConsigliereErr = $rejects(fn() => $asc->act('crew-boss', 'crew.recruit', ['slotId' => 'consigliere']));
    $emptyCollectErr = $rejects(fn() => $asc->act('crew-boss', 'crew.collectTribute'));

    // Recruit Lookout at Lv 1 ($1,500 cost, $150 signing bonus + $150/hr)
    $recLookout = $asc->act('crew-boss', 'crew.recruit', ['slotId' => 'lookout']);
    $signingTribute = $asc->act('crew-boss', 'crew.collectTribute');

    // Only 120s elapsed -> blocked by 5m (300s) minimum!
    $clockNow += 120;
    $tooSoonErr = $rejects(fn() => $asc->act('crew-boss', 'crew.collectTribute'));

    // Advance to 6h total (21,600s) at $150/hr -> exact $900 tribute!
    $clockNow += (21600 - 120);
    $sixHourTribute = $asc->act('crew-boss', 'crew.collectTribute');

    // Upgrade Lookout to Rank 2 ($300/hr), advance 20h (72,000s, capped at 12h = 43,200s) -> exact $3,600!
    $upg2 = $asc->act('crew-boss', 'crew.upgrade', ['slotId' => 'lookout']);
    $clockNow += 72000;
    $cappedTribute = $asc->act('crew-boss', 'crew.collectTribute');

    // Upgrade Lookout to max Rank 5 and verify Rank 6 is rejected
    $asc->act('crew-boss', 'crew.upgrade', ['slotId' => 'lookout']); // R3
    $asc->act('crew-boss', 'crew.upgrade', ['slotId' => 'lookout']); // R4
    $upg5 = $asc->act('crew-boss', 'crew.upgrade', ['slotId' => 'lookout']); // R5
    $maxRankErr = $rejects(fn() => $asc->act('crew-boss', 'crew.upgrade', ['slotId' => 'lookout']));

    echo json_encode([
      'lockedConsigliereErr' => $lockedConsigliereErr,
      'emptyCollectErr' => $emptyCollectErr,
      'recruitCost' => $recLookout['result']['costPaid'],
      'signingCollected' => $signingTribute['result']['cashAwarded'],
      'tooSoonErr' => $tooSoonErr,
      'sixHourCollected' => $sixHourTribute['result']['cashAwarded'],
      'rank2Hourly' => $upg2['result']['hourlyRate'],
      'cappedCollected' => $cappedTribute['result']['cashAwarded'],
      'cappedSeconds' => $cappedTribute['result']['cappedSeconds'],
      'rank5CrimeBonus' => $upg5['passiveBonuses']['crimeSuccessPct'],
      'maxRankErr' => $maxRankErr,
    ], JSON_THROW_ON_ERROR);
  `);

  assert.match(res.lockedConsigliereErr, /Reach Level 12/i);
  assert.match(res.emptyCollectErr, /Recruit at least one/i);
  assert.equal(res.recruitCost, 1500);
  assert.equal(res.signingCollected, 150);
  assert.match(res.tooSoonErr, /at least 5 minutes/i);
  assert.equal(res.sixHourCollected, 900);
  assert.equal(res.rank2Hourly, 300);
  assert.equal(res.cappedCollected, 3600);
  assert.equal(res.cappedSeconds, 43200);
  assert.equal(res.rank5CrimeBonus, 15); // 5 * +3%
  assert.match(res.maxRankErr, /maximum Rank 5/i);
});

test('v151 Luna Encrypted Syndicate Handler & Full 12-Step Guided Ascension Directive Chain (#1..#12)', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\AscensionEngineService;
    use Zone\\Engine\\Core\\Game\\ProgressionService;
    use Zone\\Engine\\Core\\Game\\CityActivitiesService;
    use Zone\\Engine\\Core\\Game\\TradeBazaarCompanyService;
    use Zone\\Engine\\Core\\Game\\ForeignMarketService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $nowIso = gmdate('c');
    $db->insertIgnore(
      'players',
      ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
      ['luna-op', 'LunaRunner', 1, 0, 50000, 100, 45, 300, 500, 100, 45, 300, 500, $nowIso, 75, 70, 75, 70, 0, 'Zone City', 0, null]
    );

    $prog = new ProgressionService($db, $events);
    $city = new CityActivitiesService($db, $events, null, static fn(int $a, int $b): int => $a);
    $trade = new TradeBazaarCompanyService($db, $events);
    $foreign = new ForeignMarketService($db, $events);
    $asc = new AscensionEngineService(
      $db,
      $events,
      static fn(int $min, int $max): int => (int) round(($min + $max) / 2)
    );

    $s0 = $asc->snapshot('luna-op');
    $bilingualAll = true;
    foreach ($s0['directives'] as $d) {
      if (trim($d['titleEn']) === '' || trim($d['titleAr']) === '' || trim($d['targetRoute']) === '') {
        $bilingualAll = false;
      }
    }

    // #1 Choose Origin
    $asc->act('luna-op', 'origin.select', ['originId' => 'harbor_ghost']);
    $c1 = $asc->act('luna-op', 'luna.claimDirective');

    // #2 First Crime
    $prog->recordCrime('luna-op', 'searchforcash', true, 12);
    $c2 = $asc->act('luna-op', 'luna.claimDirective');

    // #3 First Gym Session
    $prog->recordMetric('luna-op', 'trains', 1);
    $c3 = $asc->act('luna-op', 'luna.claimDirective');

    // #4 Reach Lv 2 (already Lv 2 from directive XP!) & Scavenge Dump
    $city->act('luna-op', 'dump.search');
    $c4 = $asc->act('luna-op', 'luna.claimDirective');

    // #5 Recruit Lookout
    $asc->act('luna-op', 'crew.recruit', ['slotId' => 'lookout']);
    $c5 = $asc->act('luna-op', 'luna.claimDirective');

    // #6 Reach Lv 3 (already Lv 3 from XP!) & Spin Wheel
    $city->act('luna-op', 'wheel.spin', ['wheelId' => 'lame']);
    $prog->clearHospital('luna-op');
    $c6 = $asc->act('luna-op', 'luna.claimDirective');

    // #7 Gather 100% Nemesis Intel
    while ($asc->snapshot('luna-op')['nemesis']['intel'] < 100) {
      $asc->act('luna-op', 'nemesis.gatherIntel');
    }
    $c7 = $asc->act('luna-op', 'luna.claimDirective');

    // #8 Defeat First Nemesis
    $db->execute("UPDATE players SET energy = 100, life = 300 WHERE id = 'luna-op'");
    $asc->act('luna-op', 'nemesis.confront');
    $c8 = $asc->act('luna-op', 'luna.claimDirective');

    // #9 Reach Lv 5 & Open Market/Bazaar
    $db->execute("UPDATE players SET level = 5, xp = 1050 WHERE id = 'luna-op'");
    $trade->act('luna-op', 'bazaar.toggle', ['open' => true]);
    $c9 = $asc->act('luna-op', 'luna.claimDirective');

    // #10 Reach Lv 10 & Lock Bank/Vault
    $db->execute("UPDATE players SET level = 10, xp = 4500, bank_balance = 25000 WHERE id = 'luna-op'");
    $c10 = $asc->act('luna-op', 'luna.claimDirective');

    // #11 Reach Lv 12 & Join/Found Faction
    $db->execute("UPDATE players SET level = 12, xp = 6600 WHERE id = 'luna-op'");
    $db->insertIgnore('faction_members', ['player_id', 'faction_id', 'role', 'joined_at'], ['luna-op', 'night', 'member', $nowIso]);
    $c11 = $asc->act('luna-op', 'luna.claimDirective');

    // #12 Reach Lv 15 & Board First International Flight
    $db->execute("UPDATE players SET level = 15, xp = 10500, cash = 100000 WHERE id = 'luna-op'");
    $foreign->act('depart', ['destination' => 'mexico'], 'luna-op');
    $c12 = $asc->act('luna-op', 'luna.claimDirective');

    echo json_encode([
      'persona' => $s0['lunaOracle']['persona'],
      'directivesCount' => count($s0['directives']),
      'bilingualAll' => $bilingualAll,
      'nextAfter1' => $c1['directiveIndex'],
      'nextAfter4' => $c4['directiveIndex'],
      'levelAtStep5' => $c4['player']['level'],
      'nextAfter8' => $c8['directiveIndex'],
      'allCompleted' => $c12['lunaOracle']['allDirectivesCompleted'],
      'completedCount' => $c12['lunaOracle']['directivesCompletedCount'],
      'finalLevel' => $c12['player']['level'],
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.persona, 'Luna · Syndicate Architect');
  assert.equal(res.directivesCount, 12);
  assert.equal(res.bilingualAll, true);
  assert.equal(res.nextAfter1, 2);
  assert.equal(res.nextAfter4, 5);
  assert.ok(res.levelAtStep5 >= 2);
  assert.equal(res.nextAfter8, 9);
  assert.equal(res.allCompleted, true);
  assert.equal(res.completedCount, 12);
  assert.ok(res.finalLevel >= 15);
});

test('v151 AscensionEngineService passes strict PostgreSQL 16 SQL audit (0 SQLite 2-arg MIN/MAX, 0 duplicate PDO :params)', () => {
  const phpSource = readFileSync(resolve(root, 'engine/src/Core/Game/AscensionEngineService.php'), 'utf8');

  // Extract single/double quoted SQL strings starting with SELECT / UPDATE / INSERT / DELETE
  const sqlLiterals = [...phpSource.matchAll(/['"](\s*(?:SELECT|UPDATE|INSERT|DELETE)\b[^'"]*)['"]/gi)].map(m => m[1]);
  assert.ok(sqlLiterals.length >= 8, 'Expected SQL queries inside AscensionEngineService.php');

  for (const sql of sqlLiterals) {
    assert.doesNotMatch(sql, /\b(?:MIN|MAX)\s*\([^,)]+,[^)]+\)/i, `SQLite 2-arg MIN/MAX forbidden in PG16: ${sql}`);
    const placeholders = [...sql.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1]);
    const unique = new Set(placeholders);
    assert.equal(unique.size, placeholders.length, `Duplicate named PDO placeholder in SQL: ${sql}`);
  }
});
