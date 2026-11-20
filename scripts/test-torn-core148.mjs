import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
  const dir = resolve(root, 'engine/var/torn148-' + randomUUID());
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
      },
    });
    return JSON.parse(out.trim());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('v148 Gameplay Catalog expands items (101), gyms (24), university courses (18), and working-stat jobs (12) while preserving indices 0..7', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    $cat = json_decode((string) file_get_contents(ZONE_ENGINE_ROOT . '/data/gameplay-catalog.json'), true, 64, JSON_THROW_ON_ERROR);
    \\Zone\\Engine\\Core\\Content\\GameplayDefinitionValidator::catalog($cat);
    echo json_encode([
      'itemCount' => count($cat['items']),
      'gymCount' => count($cat['gyms']),
      'courseCount' => count($cat['courses']),
      'jobCount' => count($cat['jobs']),
      'hasDrugs' => isset($cat['items']['xanax'], $cat['items']['ecstasy'], $cat['items']['vicodin'], $cat['items']['cannabis'], $cat['items']['lsd']),
      'hasBoostersMed' => isset($cat['items']['edvd'], $cat['items']['fhc'], $cat['items']['energydrink'], $cat['items']['lollipop'], $cat['items']['bloodbag'], $cat['items']['morphine'], $cat['items']['lawyer_card'], $cat['items']['flash_grenade'], $cat['items']['smoke_grenade'], $cat['items']['epinephrine']),
      'hasPlushies' => isset($cat['items']['plush_camel'], $cat['items']['plush_bear'], $cat['items']['plush_moose'], $cat['items']['plush_pharaoh'], $cat['items']['plush_falcon'], $cat['items']['plush_lion']),
      'hasFlowers' => isset($cat['items']['flower_orchid'], $cat['items']['flower_lotus'], $cat['items']['flower_cherry'], $cat['items']['flower_peony'], $cat['items']['flower_tribulus'], $cat['items']['flower_violet']),
      'hasEnhancers' => isset($cat['items']['glasses'], $cat['items']['high_speed_drive'], $cat['items']['paint_mask'], $cat['items']['mountain_bike'], $cat['items']['cut_throat_razor'], $cat['items']['duct_tape'], $cat['items']['flashlight'], $cat['items']['megaphone'], $cat['items']['latex_gloves'], $cat['items']['office_chair'], $cat['items']['magnifying_glass'], $cat['items']['ergonomic_keyboard'], $cat['items']['windproof_lighter']),
      'gym0' => $cat['gyms'][0],
      'gym7' => $cat['gyms'][7],
      'gym21Name' => $cat['gyms'][21]['name']['en'] ?? '',
      'gym23Name' => $cat['gyms'][23]['name']['en'] ?? '',
      'histCourse' => array_values(array_filter($cat['courses'], fn($c) => $c['id'] === 'hist'))[0] ?? null,
      'oilJob' => array_values(array_filter($cat['jobs'], fn($j) => $j['id'] === 'oil_rig'))[0] ?? null,
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.itemCount, 101);
  assert.equal(res.gymCount, 24);
  assert.equal(res.courseCount, 18);
  assert.equal(res.jobCount, 12);
  assert.equal(res.hasDrugs, true);
  assert.equal(res.hasBoostersMed, true);
  assert.equal(res.hasPlushies, true);
  assert.equal(res.hasFlowers, true);
  assert.equal(res.hasEnhancers, true);
  assert.deepEqual(res.gym0, { e: 5, xp: 0, cost: 10 });
  assert.deepEqual(res.gym7, { e: 10, xp: 2000, cost: 10000 });
  assert.match(res.gym21Name, /Balboa/);
  assert.match(res.gym23Name, /George/);
  assert.equal(res.histCourse?.id, 'hist');
  assert.ok(res.oilJob?.man > 0 && res.oilJob?.int > 0 && res.oilJob?.end > 0);
});

test('Drugs, Cooldown Caps (Drug single-lock, Medical 6h, Booster 24h), Overdose & Rehab enforce real server rules', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\ProgressionService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $rollValue = 5000; // safe non-OD roll first
    $svc = new ProgressionService($db, $events, null, function (int $min, int $max) use (&$rollValue): int {
      return max($min, min($max, $rollValue));
    });

    $db->execute("UPDATE players SET cash = 50000000, energy = 100, happy = 400, life = 100, max_life = 1000 WHERE id = 'founder-player'");
    $act = function (string $action, string $id) use ($svc): array {
      $s = $svc->snapshot('founder-player');
      return $svc->act($action, $id, $s['state']['version'], 'founder-player');
    };
    $rejects = function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    // Buy Xanax & Ecstasy & EDVDs & Morphine
    $act('item.buy', 'xanax');
    $act('item.buy', 'xanax');
    $act('item.buy', 'ecstasy');
    for ($i = 0; $i < 5; $i++) $act('item.buy', 'edvd');
    for ($i = 0; $i < 5; $i++) $act('item.buy', 'morphine');

    // Use Xanax -> +250E, 7h drug CD, +3 addiction
    $x1 = $act('drug.use', 'xanax');
    // Second drug blocked by drugUntil via both drug.use AND item.use!
    $drugBlocked1 = $rejects(fn() => $act('drug.use', 'ecstasy'));
    $drugBlocked2 = $rejects(fn() => $act('item.use', 'ecstasy'));
    $hjBlocked = $rejects(fn() => $act('torn.happyJump', 'stack'));

    // Stack 4 EDVDs (4 * 6h = 24h booster cap), 5th EDVD must be rejected!
    for ($i = 0; $i < 4; $i++) $act('item.use', 'edvd');
    $boosterCapBlocked = $rejects(fn() => $act('item.use', 'edvd'));

    // Stack 4 Morphines (4 * 1.5h = 6h medical cap), 5th Morphine must be rejected!
    $db->execute("UPDATE players SET life = 100 WHERE id = 'founder-player'");
    for ($i = 0; $i < 4; $i++) {
      $db->execute("UPDATE players SET life = 100 WHERE id = 'founder-player'");
      $act('item.use', 'morphine');
    }
    $db->execute("UPDATE players SET life = 100 WHERE id = 'founder-player'");
    $medicalCapBlocked = $rejects(fn() => $act('item.use', 'morphine'));

    // Clear drugUntil & force Overdose (roll = 10 <= 250 bps)
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['cooldowns']['drugUntil'] = 0;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);
    $rollValue = 10;
    $od = $act('drug.use', 'xanax');

    // Clear hospital to visit Rehab
    $svc->clearHospital('founder-player');
    $cashBeforeRehab = $svc->snapshot('founder-player')['player']['cash'];
    $addictionBefore = $svc->snapshot('founder-player')['tornV2']['addiction'];
    $rehab = $act('torn.rehab', 'full');
    $rehabAgainBlocked = $rejects(fn() => $act('torn.rehab', 'full'));

    echo json_encode([
      'x1Energy' => $x1['player']['energy'],
      'x1DrugSeconds' => $x1['tornV2']['cooldowns']['drugSeconds'],
      'drugBlocked1' => $drugBlocked1,
      'drugBlocked2' => $drugBlocked2,
      'hjBlocked' => $hjBlocked,
      'boosterCapBlocked' => $boosterCapBlocked,
      'medicalCapBlocked' => $medicalCapBlocked,
      'odTriggered' => $od['result']['overdosed'],
      'odEnergy' => $od['player']['energy'],
      'odHospUntil' => $od['state']['hospUntil'] > 0,
      'odCount' => $od['state']['cooldowns']['overdoseCount'],
      'addictionBefore' => $addictionBefore,
      'rehabCostDelta' => $rehab['result']['cashDelta'],
      'expectedRehabCost' => -max(10000, $addictionBefore * 15000),
      'addictionAfter' => $rehab['tornV2']['addiction'],
      'rehabAgainBlocked' => $rehabAgainBlocked,
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.x1Energy, 350);
  assert.ok(res.x1DrugSeconds >= 25190 && res.x1DrugSeconds <= 25200);
  assert.match(res.drugBlocked1, /Drug cooldown active/);
  assert.match(res.drugBlocked2, /Drug cooldown active/);
  assert.match(res.hjBlocked, /Drug cooldown active/);
  assert.match(res.boosterCapBlocked, /Booster cooldown cap \(24h\)/);
  assert.match(res.medicalCapBlocked, /Medical cooldown cap \(6h\)/);
  assert.equal(res.odTriggered, true);
  assert.equal(res.odEnergy, 0);
  assert.equal(res.odHospUntil, true);
  assert.equal(res.odCount, 1);
  assert.equal(res.addictionBefore, 8); // +3 normal Xanax + 5 OD
  assert.equal(res.rehabCostDelta, res.expectedRehabCost);
  assert.equal(res.addictionAfter, 0);
  assert.match(res.rehabAgainBlocked, /no drug addiction/i);
});

test('Crimes 2.0 enforces exact Nerve (Skimmer 6N, Cracking 7N), rotating 15m modifiers, Enhancer boost, and 4-tier outcomes', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\ProgressionService;
    use Zone\\Engine\\Core\\Game\\TornSystemsService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $rollValue = 100; // UNIQUE_OUTCOME
    $svc = new ProgressionService($db, $events, null, function (int $min, int $max) use (&$rollValue): int {
      return max($min, min($max, $rollValue));
    });
    $act = function (string $action, string $id) use ($svc): array {
      $s = $svc->snapshot('founder-player');
      return $svc->act($action, $id, $s['state']['version'], 'founder-player');
    };
    $rejects = function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    $db->execute("UPDATE players SET cash = 200000, nerve = 5 WHERE id = 'founder-player'");
    // Skimmer needs 6N, Cracking needs 7N -> both must reject at 5N!
    $skimLowNerve = $rejects(fn() => $act('torn.skimmer', 'atm'));
    $crackLowNerve = $rejects(fn() => $act('torn.cracking', 'rig'));

    // Buy enhancer for Card Skimming ('duct_tape') and refill nerve to 40
    $act('item.buy', 'duct_tape');
    $db->execute("UPDATE players SET nerve = 40 WHERE id = 'founder-player'");

    // 1) UNIQUE_OUTCOME (roll = 100)
    $rollValue = 100;
    $u = $act('torn.skimmer', 'atm');

    // 2) SUCCESS (roll = 3500)
    $rollValue = 3500;
    $s = $act('torn.cracking', 'rig');

    // 3) FAIL (roll = 8500)
    $rollValue = 8500;
    $f = $act('torn.crime2Execute', '2');

    // 4) CRITICAL_FAIL (roll = 9999)
    $rollValue = 9999;
    $cf = $act('torn.crime2Execute', '2');

    // Verify rotating 15-minute window changes deterministic security/search modifiers
    $secW1 = TornSystemsService::shopliftingSecurity(1800000);
    $secW2 = TornSystemsService::shopliftingSecurity(1800000 + 900);
    $sfcW1 = TornSystemsService::searchForCashModifiers(1800000);
    $sfcW2 = TornSystemsService::searchForCashModifiers(1800000 + 900);

    echo json_encode([
      'skimLowNerve' => $skimLowNerve,
      'crackLowNerve' => $crackLowNerve,
      'uniqueTier' => $u['result']['crimeTier'],
      'uniqueNerve' => $u['result']['nerveSpent'],
      'uniqueEnhancer' => $u['result']['enhancerActive'],
      'uniqueLoot' => $u['result']['lootItem'],
      'ownedLsds' => $u['state']['inv']['lsd'] ?? 0,
      'successTier' => $s['result']['crimeTier'],
      'successNerve' => $s['result']['nerveSpent'],
      'failTier' => $f['result']['crimeTier'],
      'failCash' => $f['result']['cashDelta'],
      'critTier' => $cf['result']['crimeTier'],
      'critCash' => $cf['result']['cashDelta'],
      'critJailed' => $cf['state']['jailUntil'] > 0,
      'secRotates' => $secW1 !== $secW2,
      'sfcRotates' => $sfcW1 !== $sfcW2,
    ], JSON_THROW_ON_ERROR);
  `);

  assert.match(res.skimLowNerve, /need 6 Nerve/);
  assert.match(res.crackLowNerve, /need 7 Nerve/);
  assert.equal(res.uniqueTier, 'UNIQUE_OUTCOME');
  assert.equal(res.uniqueNerve, 6);
  assert.equal(res.uniqueEnhancer, true);
  assert.equal(res.uniqueLoot, 'lsd');
  assert.equal(res.ownedLsds, 1);
  assert.equal(res.successTier, 'SUCCESS');
  assert.equal(res.successNerve, 7);
  assert.equal(res.failTier, 'FAIL');
  assert.equal(res.failCash, 0);
  assert.equal(res.critTier, 'CRITICAL_FAIL');
  assert.equal(res.critCash, 0);
  assert.equal(res.critJailed, true);
  assert.equal(res.secRotates, true);
  assert.equal(res.sfcRotates, true);
});

test('Bank Term CDs, 8-Ticker Stock Exchange (with sell+rebuy cooldown guard), Property Vault & Island Staff conserve wealth', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\ProgressionService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $svc = new ProgressionService($db, new EventBus($db));
    $db->execute("UPDATE players SET cash = 5000000, bank_balance = 10000 WHERE id = 'founder-player'");

    $act = function (string $action, string $id) use ($svc): array {
      $s = $svc->snapshot('founder-player');
      return $svc->act($action, $id, $s['state']['version'], 'founder-player');
    };
    $rejects = function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    // Upgrade bank_interest merit twice (+10% CD interest)
    $act('merit.upgrade', 'bank_interest');
    $act('merit.upgrade', 'bank_interest');

    // Bank CD: min $5,000 enforced, deducts real principal, blocks second CD & early claim
    $cdTooSmall = $rejects(fn() => $act('torn.bankCd', '7d:1000'));
    $cdOpen = $act('torn.bankCd', '30d:200000');
    $cdDupBlocked = $rejects(fn() => $act('torn.bankCd', '7d:10000'));
    $cdEarlyBlocked = $rejects(fn() => $act('bank.claimCd', 'claim'));

    // Fast-forward maturity in DB and claim
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['activeCd']['maturesAt'] = 1;
    $st['tornState']['activeCd']['maturesAt'] = 1;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);
    $cdClaim = $act('bank.claimCd', 'claim');

    // Stock Exchange (INV-02): 8 tickers exposed; buying full 500sh block arms 7-day maturity lock (blocks 0ms arbitrage!),
    // matures after 7d, re-arms next 7d, and selling below blockShares resets blockReadyAt = 0!
    $stocksCount = count($cdClaim['tornV2']['stocks']);
    $divUnownedBlocked = $rejects(fn() => $act('torn.stockDividend', 'SYM'));
    $act('stock.buy', 'SYM:200');
    $divPartialBlocked = $rejects(fn() => $act('torn.stockDividend', 'SYM'));
    $act('stock.buy', 'SYM:300'); // crosses < 500 -> 500 shares => arms 7-day blockReadyAt!
    $divImmediateBlocked = $rejects(fn() => $act('torn.stockDividend', 'SYM'));
    // Fast-forward blockReadyAt to past to simulate 7-day maturity
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['stocks']['SYM']['blockReadyAt'] = 1;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);
    $divClaimed = $act('torn.stockDividend', 'SYM');
    $divRepeatBlocked = $rejects(fn() => $act('torn.stockDividend', 'SYM'));
    // Sell below blockShares -> resets blockReadyAt = 0, re-buying restarts full 7d maturity!
    $sold = $act('stock.sell', 'SYM:100'); // drops to 400 shares (< 500)
    $rebought = $act('stock.buy', 'SYM:100'); // back to 500 shares -> fresh 7d lock
    $divRebuyBlocked = $rejects(fn() => $act('torn.stockDividend', 'SYM'));

    // Property Vault (INV-05): 'apt' ($1M cap) -> switch to 'shack' ($0 cap): deposit blocked, but withdraw STILL allowed!
    $dep = $act('property.vaultDeposit', '300000');
    $overCap = $rejects(fn() => $act('property.vaultDeposit', '800000'));
    $wd = $act('property.vaultWithdraw', '100000'); // 200k left in vault
    $act('property.buy', 'shack'); // vaultCap drops to 0
    $shackBlocked = $rejects(fn() => $act('property.vaultDeposit', '1000'));
    $shackWithdrawAllowed = $act('property.vaultWithdraw', '50000'); // 150k left, NOT trapped!
    $staff = $act('torn.islandStaff', 'vault_guard');
    $shackUnlocked = $act('property.vaultDeposit', '50000'); // back to 200k

    // INV-01: Negative, zero, scientific notation, and >10^15 overflow inputs rejected cleanly
    $badInputs = [
      $rejects(fn() => $act('stock.buy', 'SYM:-100')),
      $rejects(fn() => $act('stock.buy', 'SYM:0')),
      $rejects(fn() => $act('stock.buy', 'SYM:1e9')),
      $rejects(fn() => $act('stock.buy', 'SYM:9999999999999999')),
      $rejects(fn() => $act('torn.bankCd', '7d:-50000')),
      $rejects(fn() => $act('torn.casinoPlay', 'slots:-5000')),
      $rejects(fn() => $act('torn.casinoPlay', 'slots:0')),
      $rejects(fn() => $act('property.vaultDeposit', '-1000')),
      $rejects(fn() => $act('property.vaultWithdraw', '0')),
    ];

    echo json_encode([
      'cdTooSmall' => $cdTooSmall,
      'cdCashDelta' => $cdOpen['result']['cashDelta'],
      'cdPayout' => $cdOpen['result']['activeCd']['payout'],
      'cdDupBlocked' => $cdDupBlocked,
      'cdEarlyBlocked' => $cdEarlyBlocked,
      'bankAfterClaim' => $cdClaim['player']['bank_balance'],
      'cdCleared' => $cdClaim['tornV2']['activeCd'] === null,
      'stocksCount' => $stocksCount,
      'divUnownedBlocked' => $divUnownedBlocked,
      'divPartialBlocked' => $divPartialBlocked,
      'divImmediateBlocked' => $divImmediateBlocked,
      'xanaxFromSym' => $divClaimed['state']['inv']['xanax'] ?? 0,
      'divRepeatBlocked' => $divRepeatBlocked,
      'sellFeeCharged' => $sold['result']['fee'] > 0,
      'resetOnDropBelowBlock' => $sold['result']['blockReadyAt'] === 0,
      'divRebuyBlocked' => $divRebuyBlocked,
      'vaultAfterWd' => $wd['tornV2']['vaultBalance'],
      'overCap' => $overCap,
      'shackBlocked' => $shackBlocked,
      'shackWithdrawVault' => $shackWithdrawAllowed['tornV2']['vaultBalance'],
      'guardCost' => $staff['result']['cashDelta'],
      'vaultAfterGuard' => $shackUnlocked['tornV2']['vaultBalance'],
      'allBadInputsRejected' => count(array_filter($badInputs, fn($msg) => $msg !== '')) === count($badInputs),
    ], JSON_THROW_ON_ERROR);
  `);

  assert.match(res.cdTooSmall, /between 5,000/);
  assert.equal(res.cdCashDelta, -200000);
  assert.equal(res.cdPayout, 236300);
  assert.match(res.cdDupBlocked, /already locked/);
  assert.match(res.cdEarlyBlocked, /not matured/);
  assert.equal(res.bankAfterClaim, 246300);
  assert.equal(res.cdCleared, true);
  assert.equal(res.stocksCount, 8);
  assert.match(res.divUnownedBlocked, /Own at least 500/);
  assert.match(res.divPartialBlocked, /Own at least 500/);
  assert.match(res.divImmediateBlocked, /maturing/);
  assert.equal(res.xanaxFromSym, 1);
  assert.match(res.divRepeatBlocked, /maturing/);
  assert.equal(res.sellFeeCharged, true);
  assert.equal(res.resetOnDropBelowBlock, true);
  assert.match(res.divRebuyBlocked, /maturing/);
  assert.equal(res.vaultAfterWd, 200000);
  assert.match(res.overCap, /capacity.*exceeded/i);
  assert.match(res.shackBlocked, /no Cash Vault/);
  assert.equal(res.shackWithdrawVault, 150000);
  assert.equal(res.guardCost, -95000);
  assert.equal(res.vaultAfterGuard, 200000);
  assert.equal(res.allBadInputsRejected, true);
});

test('Points Building, Museum Set Exchange (History course gate), Merit Upgrade/Reset, Remaining Stubs & Economy Ledger Reconciliation', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\ProgressionService;

    putenv('ZONE_EPHEMERAL_VERCEL_SQLITE=1');
    putenv('ZONE_LEDGER_SECRET=torn148-cookie-test-secret-key-32bytes');

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $roll = 2000; // deterministic win for casino/race/oc
    $svc = new ProgressionService($db, new EventBus($db), null, function (int $min, int $max) use (&$roll): int {
      return max($min, min($max, $roll));
    });

    $initialCash = 2000000;
    $db->execute("UPDATE players SET cash = :c, energy = 20, nerve = 5, life = 250, max_life = 250 WHERE id = 'founder-player'", ['c' => $initialCash]);
    // Record initial cash adjustment so ledger reconciles from starting DB state
    $baseRow = $svc->snapshot('founder-player');

    $act = function (string $action, string $id, ?int $price = null) use ($svc): array {
      $s = $svc->snapshot('founder-player');
      return $svc->act($action, $id, $s['state']['version'], 'founder-player', $price);
    };
    $rejects = function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    // 1) Points Building refills (25 pts each, 1/day)
    $re = $act('points.refillEnergy', 'refill');
    $reDup = $rejects(fn() => $act('points.refillEnergy', 'refill'));
    $rn = $act('points.refillNerve', 'refill');

    // 2) Museum requires 'hist' course & full 6-piece set
    $museumLocked = $rejects(fn() => $act('museum.exchange', 'plushies'));
    $act('course.enroll', 'hist');
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['edu']['until'] = 1;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);
    $svc->snapshot('founder-player'); // completes 'hist'

    $museumIncomplete = $rejects(fn() => $act('museum.exchange', 'plushies'));
    $act('museum.plushieBuy', 'all_set');
    $ptsBeforeMuseum = $svc->snapshot('founder-player')['state']['points'];
    $mus = $act('museum.exchange', 'plushies');
    $museumEmptyAgain = $rejects(fn() => $act('torn.museumExchange', 'plushies'));

    // Also test Flower set exchange
    foreach (['flower_orchid', 'flower_lotus', 'flower_cherry', 'flower_peony', 'flower_tribulus', 'flower_violet'] as $fl) {
      $act('item.buy', $fl);
    }
    $musFlowers = $act('torn.museumExchange', 'flowers');

    // 3) Merits 20-key upgrade & reset (1st free, 2nd requires 250 pts)
    $maxNerve0 = $svc->snapshot('founder-player')['player']['max_nerve'];
    $act('merit.upgrade', 'nerve_bar'); // cost 1
    $act('merit.upgrade', 'nerve_bar'); // cost 2 (total 3 spent, +2 max_nerve)
    $act('merit.upgrade', 'rifles');    // cost 1 (total 4 spent)
    $maxNerveUp = $svc->snapshot('founder-player')['player']['max_nerve'];
    $mReset1 = $act('merit.reset', 'all');
    $maxNerveReset = $svc->snapshot('founder-player')['player']['max_nerve'];
    $act('merit.upgrade', 'stealth');
    $mReset2Blocked = $rejects(fn() => $act('merit.reset', 'all')); // < 250 pts

    // 4) Remaining former stubs now enforce real costs/items/timers
    $RollLose = 9000;
    $roll = $RollLose;
    $casinoLose = $act('torn.casinoPlay', 'slots:5000');
    $race1 = $act('torn.racewayRun', 'track1'); // -$25,000 license + 10E
    $book1 = $act('torn.readBook', 'b_gym');    // -50 pts
    $bookDup = $rejects(fn() => $act('torn.readBook', 'b_crime'));

    // Blood bag draw requires bio or med
    $bbNoCourse = $rejects(fn() => $act('torn.bloodBag', 'draw'));
    $act('course.enroll', 'med');
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['edu']['until'] = 1;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);
    $svc->snapshot('founder-player');
    $bbDraw = $act('torn.bloodBag', 'draw');

    // Lawyer card requires jail + owned lawyer_card
    $act('item.buy', 'lawyer_card');
    $svc->applyPenalty('founder-player', 'jail', 10);
    $lcUsed = $act('torn.lawyerCard', 'release');
    $svc->applyPenalty('founder-player', 'jail', 5);
    $lcEmptyBlocked = $rejects(fn() => $act('torn.lawyerCard', 'release'));
    $act('jail.bailSelf', 'self');

    // Exploit gates closed: social.bazaarBuy cannot pass 0 price, torn.eduMajor & torn.bountyClaim blocked
    $eduBypassBlocked = $rejects(fn() => $act('torn.eduMajor', 'lead'));
    $bountyBypassBlocked = $rejects(fn() => $act('torn.bountyClaim', '1'));
    $bazaarBuy = $act('social.bazaarBuy', 'lollipop', 0); // charges at least catalog price (900), never 0!

    // Economy ledger cash reconciliation from baseRow + cold-boot cookie round-trip hydration (INV-06)
    $act('property.vaultDeposit', '123456');
    $act('stock.buy', 'TCT:50');
    $act('torn.bankCd', '7d:25000');
    $finalSnap = $svc->snapshot('founder-player');
    $ledgerRows = $db->fetchAll("SELECT amount FROM economy_ledger WHERE player_id = 'founder-player' AND asset = 'cash'");
    $ledgerSum = array_sum(array_map(fn($r) => (int) $r['amount'], $ledgerRows));
    $cookieVal = (string) ($GLOBALS['__zone_ledger_cookie'] ?? '');
    $cookieLen = strlen($cookieVal);

    // Cold-boot hydration into a brand-new SQLite DB using only zone_player_ledger cookie
    $_COOKIE['zone_player_ledger'] = $cookieVal;
    $coldDb = Database::connect('sqlite::memory:');
    $coldDb->migrateAndSeed();
    $coldSvc = new ProgressionService($coldDb, new EventBus($coldDb));
    $coldSnap = $coldSvc->snapshot('founder-player');

    echo json_encode([
      'refilledEnergy' => $re['player']['energy'],
      'reDup' => $reDup,
      'refilledNerve' => $rn['player']['nerve'],
      'museumLocked' => $museumLocked,
      'museumIncomplete' => $museumIncomplete,
      'ptsGainPlushies' => $mus['state']['points'] - $ptsBeforeMuseum,
      'musCashDelta' => $mus['result']['cashDelta'],
      'museumEmptyAgain' => $museumEmptyAgain,
      'ptsGainFlowers' => $musFlowers['result']['pointsAwarded'],
      'maxNerveDeltaUp' => $maxNerveUp - $maxNerve0,
      'maxNerveDeltaReset' => $maxNerveReset - $maxNerve0,
      'meritsRefunded' => $mReset1['result']['meritsRefunded'],
      'mReset2Blocked' => $mReset2Blocked,
      'casinoLoseDelta' => $casinoLose['result']['cashDelta'],
      'raceLicenseFee' => $race1['result']['licenseFee'],
      'bookPtsSpent' => $book1['result']['pointsSpent'],
      'bookDup' => $bookDup,
      'bbNoCourse' => $bbNoCourse,
      'bbGranted' => $bbDraw['state']['inv']['bloodbag'] ?? 0,
      'lcReleased' => $lcUsed['state']['jailUntil'] === 0,
      'lcEmptyBlocked' => $lcEmptyBlocked,
      'eduBypassBlocked' => $eduBypassBlocked,
      'bountyBypassBlocked' => $bountyBypassBlocked,
      'bazaarMinCharged' => $bazaarBuy['result']['cashDelta'],
      'ledgerMatchesWallet' => $finalSnap['player']['cash'] === ($initialCash + $ledgerSum),
      'cookieLen' => $cookieLen,
      'coldHydratedVault' => $coldSnap['tornV2']['vaultBalance'],
      'coldHydratedCdPrincipal' => $coldSnap['tornV2']['activeCd']['principal'] ?? 0,
      'coldHydratedTctShares' => $coldSnap['state']['stocks']['TCT']['shares'] ?? 0,
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.refilledEnergy, 150);
  assert.match(res.reDup, /already used today/);
  assert.ok(res.refilledNerve >= 25);
  assert.match(res.museumLocked, /Complete History \(hist\)/);
  assert.match(res.museumIncomplete, /Complete all 6 Plushies/);
  assert.equal(res.ptsGainPlushies, 10);
  assert.equal(res.musCashDelta, 0);
  assert.match(res.museumEmptyAgain, /Complete all 6 Plushies/);
  assert.equal(res.ptsGainFlowers, 10);
  assert.equal(res.maxNerveDeltaUp, 2);
  assert.equal(res.maxNerveDeltaReset, 0);
  assert.equal(res.meritsRefunded, 4);
  assert.match(res.mReset2Blocked, /Need 250 Points/);
  assert.equal(res.casinoLoseDelta, -5000);
  assert.equal(res.raceLicenseFee, 25000);
  assert.equal(res.bookPtsSpent, 50);
  assert.match(res.bookDup, /already reading/);
  assert.match(res.bbNoCourse, /Biology.*Emergency Medicine/);
  assert.equal(res.bbGranted, 1);
  assert.equal(res.lcReleased, true);
  assert.match(res.lcEmptyBlocked, /do not own a Lawyer/);
  assert.match(res.eduBypassBlocked, /course\.enroll/);
  assert.match(res.bountyBypassBlocked, /escrow/);
  assert.equal(res.bazaarMinCharged, -900);
  assert.equal(res.ledgerMatchesWallet, true);
  assert.ok(res.cookieLen > 100 && res.cookieLen < 3500, `Expected compact ledger cookie < 3500 bytes, got ${res.cookieLen}`);
  assert.equal(res.coldHydratedVault, 123456);
  assert.equal(res.coldHydratedCdPrincipal, 25000);
  assert.equal(res.coldHydratedTctShares, 50);
});
