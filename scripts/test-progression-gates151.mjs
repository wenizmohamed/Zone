import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPublicPath } from '../engine/bin/relay.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const phpBin = resolve(root, '.tools/php-8.5.10/php.exe');

function runPhpHarness(phpCode) {
  const dir = mkdtempSync(join(tmpdir(), 'zone-prog151-'));
  const scriptPath = join(dir, 'harness.php');
  writeFileSync(scriptPath, phpCode, 'utf8');
  try {
    const stdout = execFileSync(phpBin, [scriptPath], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    return JSON.parse(stdout.trim());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function getFreePort() {
  const srv = http.createServer();
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  const { port } = srv.address();
  await new Promise((r) => srv.close(r));
  return port;
}

function httpRequest(port, path, { method = 'GET', headers = {}, body = null } = {}) {
  const payload = body !== null ? JSON.stringify(body) : '';
  return new Promise((resolveReq, rejectReq) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          Host: `127.0.0.1:${port}`,
          ...(body !== null
            ? {
                'Content-Type': 'application/json',
                'Content-Length': String(Buffer.byteLength(payload)),
                Origin: `http://127.0.0.1:${port}`,
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          raw += c;
        });
        res.on('end', () => {
          resolveReq({
            status: res.statusCode,
            headers: res.headers,
            raw,
            json: raw ? JSON.parse(raw) : null,
          });
        });
      },
    );
    req.on('error', rejectReq);
    req.setTimeout(10000, () => req.destroy(new Error('HTTP timeout')));
    req.end(payload);
  });
}

test('v151 Server-Side Level Unlock Gates (Lv 2->15) reject Lv 1 with Torn-style messages and unlock progressively', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};

    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\ProgressionService;
    use Zone\\Engine\\Core\\Game\\CityActivitiesService;
    use Zone\\Engine\\Core\\Game\\TradeBazaarCompanyService;
    use Zone\\Engine\\Core\\Game\\ForeignMarketService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $engine = zone_engine('sqlite::memory:');

    $nowIso = gmdate('c');
    $today = gmdate('Y-m-d');
    $db->execute(
      "INSERT INTO players (id, username, level, xp, cash, energy, nerve, life, happy, max_energy, max_nerve, max_life, max_happy, resources_updated_at, strength, defense, speed, dexterity, bank_balance, city, login_streak, last_login_day)
       VALUES ('lv1-rookie', 'RookieOne', 1, 0, 5000000, 200, 50, 300, 500, 200, 50, 300, 500, :at, 50, 50, 50, 50, 0, 'Zone City', 1, :day)",
      ['at' => $nowIso, 'day' => $today],
    );
    $db->execute(
      "INSERT INTO players (id, username, level, xp, cash, energy, nerve, life, happy, max_energy, max_nerve, max_life, max_happy, resources_updated_at, strength, defense, speed, dexterity, bank_balance, city, login_streak, last_login_day)
       VALUES ('lv15-partner', 'PartnerFifteen', 15, 10500, 1000000, 150, 40, 500, 500, 150, 40, 500, 500, :at, 500, 500, 500, 500, 0, 'Zone City', 1, :day)",
      ['at' => $nowIso, 'day' => $today],
    );

    $prog = new ProgressionService($db, $events);
    $actSvc = new CityActivitiesService($db, $events, null, static fn(int $a, int $b): int => $a);
    $econSvc = new TradeBazaarCompanyService($db, $events);
    $fmSvc = new ForeignMarketService($db, $events);

    $pSnap = $prog->snapshot('lv1-rookie');
    $st = $pSnap['state'];
    $st['inv']['smallkit'] = 4;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'lv1-rookie'", ['s' => json_encode($st)]);
    $prog->snapshot('lv15-partner');

    $progAct = function (string $action, string $id) use ($prog): array {
      $s = $prog->snapshot('lv1-rookie');
      return $prog->act($action, $id, $s['state']['version'], 'lv1-rookie');
    };
    $rejects = function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    $sProg1 = $prog->snapshot('lv1-rookie');
    $sCity1 = $actSvc->snapshot('lv1-rookie');
    $sEcon1 = $econSvc->snapshot('lv1-rookie');
    $sFm1   = $fmSvc->snapshot('lv1-rookie');

    // All Lv 1 rejections
    $lv1Errors = [
      'dumpToss'    => $rejects(fn() => $actSvc->act('lv1-rookie', 'dump.toss', ['itemId' => 'smallkit', 'quantity' => 1])),
      'dumpSearch'  => $rejects(fn() => $actSvc->act('lv1-rookie', 'dump.search')),
      'wheelSpin'   => $rejects(fn() => $actSvc->act('lv1-rookie', 'wheel.spin', ['wheelId' => 'lame'])),
      'bazaarToggle'=> $rejects(fn() => $econSvc->act('lv1-rookie', 'bazaar.toggle', ['open' => true])),
      'tradeCreate' => $rejects(fn() => $econSvc->act('lv1-rookie', 'trade.create', ['partnerId' => 'lv15-partner'])),
      'agentAccept' => $rejects(fn() => $actSvc->act('lv1-rookie', 'agent.accept', ['slot' => 0])),
      'companyFound'=> $rejects(fn() => $econSvc->act('lv1-rookie', 'company.found', ['type' => 'tv_network', 'name' => 'Rookie Labs'])),
      'bankCd'      => $rejects(fn() => $progAct('torn.bankCd', '7d:10000')),
      'stockBuy'    => $rejects(fn() => $progAct('stock.buy', 'SYM:10')),
      'airportDep'  => $rejects(fn() => $fmSvc->act('depart', ['destination' => 'mexico'], 'lv1-rookie')),
    ];

    $setLvl = function (int $lvl) use ($db): void {
      $xp = 50 * $lvl * ($lvl - 1);
      $db->execute("UPDATE players SET level = :l, xp = :x, energy = 200 WHERE id = 'lv1-rookie'", ['l' => $lvl, 'x' => $xp]);
    };

    $setLvl(2);
    $dumpOk = $actSvc->act('lv1-rookie', 'dump.search');

    $setLvl(3);
    $wheelOk = $actSvc->act('lv1-rookie', 'wheel.spin', ['wheelId' => 'lame']);

    $setLvl(5);
    $bazaarOk = $econSvc->act('lv1-rookie', 'bazaar.toggle', ['open' => true]);
    $tradeOk  = $econSvc->act('lv1-rookie', 'trade.create', ['partnerId' => 'lv15-partner']);

    $setLvl(7);
    $agentOk = $actSvc->act('lv1-rookie', 'agent.accept', ['slot' => 0]);

    $setLvl(10);
    $bankCdOk  = $progAct('torn.bankCd', '7d:10000');
    $companyOk = $econSvc->act('lv1-rookie', 'company.found', ['type' => 'tv_network', 'name' => 'Rookie Cyber']);

    $setLvl(12);
    $stockOk = $progAct('stock.buy', 'SYM:10');

    $setLvl(15);
    $sFm15 = $fmSvc->snapshot('lv1-rookie');
    $departOk = $fmSvc->act('depart', ['destination' => 'mexico'], 'lv1-rookie');

    echo json_encode([
      'lv1GatesProg' => $sProg1['tornV2']['levelGates'],
      'hasCityGates' => isset($sCity1['levelGates']['dump']),
      'hasEconGates' => isset($sEcon1['levelGates']['bazaar']),
      'hasFmGates'   => isset($sFm1['levelGates']['foreignTravel']),
      'lv1Errors'    => $lv1Errors,
      'dumpOk'       => isset($dumpOk['result']),
      'wheelOk'      => isset($wheelOk['result']),
      'bazaarOpen'   => $bazaarOk['bazaar']['open'] ?? false,
      'tradeStatus'  => $tradeOk['result']['status'] ?? '',
      'agentStatus'  => $agentOk['result']['status'] ?? '',
      'bankCdTerm'   => $bankCdOk['result']['activeCd']['term'] ?? '',
      'companyStars' => $companyOk['result']['stars'] ?? 0,
      'stockShares'  => $stockOk['result']['ownedShares'] ?? 0,
      'lv15AllOpen'  => $sFm15['levelGates']['foreignTravel']['unlocked'] ?? false,
      'departDest'   => $departOk['result']['destination'] ?? '',
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.hasCityGates, true);
  assert.equal(res.hasEconGates, true);
  assert.equal(res.hasFmGates, true);
  for (const gate of Object.values(res.lv1GatesProg)) {
    assert.equal(gate.unlocked, false, `Gate ${gate.id} should be locked at Lv 1`);
  }

  assert.equal(res.lv1Errors.dumpToss, 'Locked: Reach Level 2 to unlock City Dump (Current: Lv 1).');
  assert.equal(res.lv1Errors.dumpSearch, 'Locked: Reach Level 2 to unlock City Dump (Current: Lv 1).');
  assert.equal(res.lv1Errors.wheelSpin, 'Locked: Reach Level 3 to unlock Daily Spin Wheels (Current: Lv 1).');
  assert.equal(res.lv1Errors.bazaarToggle, 'Locked: Reach Level 5 to unlock Personal Bazaars (Current: Lv 1).');
  assert.equal(res.lv1Errors.tradeCreate, 'Locked: Reach Level 5 to unlock 2-Player Direct Trades (Current: Lv 1).');
  assert.equal(res.lv1Errors.agentAccept, 'Locked: Reach Level 7 to unlock NPC Fixer Contracts (Current: Lv 1).');
  assert.equal(res.lv1Errors.companyFound, 'Locked: Reach Level 10 to unlock Player Companies (Current: Lv 1).');
  assert.equal(res.lv1Errors.bankCd, 'Locked: Reach Level 10 to unlock Bank Term CDs (Current: Lv 1).');
  assert.equal(res.lv1Errors.stockBuy, 'Locked: Reach Level 12 to unlock Stock Exchange (Current: Lv 1).');
  assert.equal(res.lv1Errors.airportDep, 'Locked: Reach Level 15 to unlock International Airport Flights (Current: Lv 1).');

  assert.equal(res.dumpOk, true);
  assert.equal(res.wheelOk, true);
  assert.equal(res.bazaarOpen, true);
  assert.equal(res.tradeStatus, 'open');
  assert.equal(res.agentStatus, 'accepted');
  assert.equal(res.bankCdTerm, '7d');
  assert.equal(res.companyStars, 1);
  assert.equal(res.stockShares, 10);
  assert.equal(res.lv15AllOpen, true);
  assert.equal(res.departDest, 'mexico');
});

test('v151 Crimes 2.0 Smooth Lv 1->50 Curve, Real Player XP Level-Up, Shadow/Origin/Lookout Boosts & Nemesis Heat Tax Skim', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};

    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\ProgressionService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $rollValue = 3000; // SUCCESS tier
    $svc = new ProgressionService($db, $events, null, function (int $min, int $max) use (&$rollValue): int {
      return max($min, min($max, $rollValue));
    });

    $nowIso = gmdate('c');
    $today = gmdate('Y-m-d');
    $db->execute(
      "INSERT INTO players (id, username, level, xp, cash, energy, nerve, life, happy, max_energy, max_nerve, max_life, max_happy, resources_updated_at, strength, defense, speed, dexterity, bank_balance, city, login_streak, last_login_day)
       VALUES ('crime-runner', 'ShadowKid', 1, 86, 1000, 100, 100, 250, 500, 100, 100, 250, 500, :at, 20, 20, 20, 20, 0, 'Zone City', 1, :day)",
      ['at' => $nowIso, 'day' => $today],
    );

    $snap0 = $svc->snapshot('crime-runner');
    $st0 = $snap0['state'];
    $st0['crimeXp'] = 0;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'crime-runner'", ['s' => json_encode($st0)]);

    $act = function (string $action, string $id) use ($svc): array {
      $s = $svc->snapshot('crime-runner');
      return $svc->act($action, $id, $s['state']['version'], 'crime-runner');
    };
    $rejects = function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    // 1) Tier gating at Lv 1 (crimeXp = 0): #1-#3 open, #4/#7/#10/#13 locked
    $locked4  = $rejects(fn() => $act('torn.crime2Execute', '4'));
    $locked7  = $rejects(fn() => $act('torn.crime2Execute', '7'));
    $locked10 = $rejects(fn() => $act('torn.crime2Execute', '10'));
    $locked13 = $rejects(fn() => $act('torn.crime2Execute', '13'));

    // 2) Execute #1 Search for Cash at Skill 0 (xp = 86 + 18 = 104 >= 100 -> promotes Lv 1 -> Lv 2!)
    $meritsBefore = (int) ($svc->snapshot('crime-runner')['state']['merits'] ?? 0);
    $c1Skill0 = $act('torn.crime2Execute', '1');

    // 3) Check Skill 100 scaling on #1 Search for Cash ($2,550 >= $2,400+) and #13 Arson at Lv 14 ($52,000 >= $48,000+)
    $db->execute("UPDATE players SET level = 14, xp = 9100, nerve = 100 WHERE id = 'crime-runner'");
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'crime-runner'");
    $st = json_decode($row['state_json'], true);
    $st['skill']['crime2_search_cash'] = 100;
    $st['skill']['crime2_arson'] = 100;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'crime-runner'", ['s' => json_encode($st)]);

    $rollValue = 3500;
    $c1Skill100 = $act('torn.crime2Execute', '1');
    $c13Skill100 = $act('torn.crime2Execute', '13');

    // 4) Wire Shadow nodes + harbor_ghost + lookout crew + Nemesis Heat Tax (6%)
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'crime-runner'");
    $st = json_decode($row['state_json'], true);
    $st['rpg']['unlockedNodes'] = [
      'street_instinct' => 1,
      'wiretapper' => 1,
      'master_burglar' => 1,
      'ghost_protocol' => 1,
    ];
    $st['ascension'] = [
      'originChosen' => true,
      'origin' => 'harbor_ghost',
      'crew' => ['lookout' => 2],
      'nemesis' => ['heatTaxPct' => 6, 'heatClearedUntil' => 0],
    ];
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'crime-runner'", ['s' => json_encode($st)]);

    $boostedWithTax = $act('torn.crime2Execute', '13');

    // Now clear Nemesis heat tax (confronted & defeated -> heatClearedUntil in future)
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'crime-runner'");
    $st = json_decode($row['state_json'], true);
    $st['ascension']['nemesis']['heatClearedUntil'] = time() + 43200;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'crime-runner'", ['s' => json_encode($st)]);

    $boostedTaxCleared = $act('torn.crime2Execute', '13');

    // Verify economy ledger reconciliation for crime-runner
    $finalPlayer = $svc->snapshot('crime-runner')['player'];
    $ledgerRows = $db->fetchAll("SELECT amount FROM economy_ledger WHERE player_id = 'crime-runner' AND asset = 'cash'");
    $ledgerSum = array_sum(array_map(fn($r) => (int) $r['amount'], $ledgerRows));

    echo json_encode([
      'locked4' => $locked4,
      'locked7' => $locked7,
      'locked10' => $locked10,
      'locked13' => $locked13,
      'c1Skill0Cash' => $c1Skill0['result']['cashDelta'],
      'c1PlayerXp' => $c1Skill0['result']['playerXpEarned'],
      'leveledUpTo' => $c1Skill0['player']['level'],
      'meritsDelta' => ((int) $c1Skill0['state']['merits']) - $meritsBefore,
      'c1Skill100Cash' => $c1Skill100['result']['cashDelta'],
      'c13Skill100Cash' => $c13Skill100['result']['cashDelta'],
      'livePerks' => $boostedWithTax['tornV2']['livePerks'],
      'boostedGross' => $boostedWithTax['result']['grossCash'],
      'nemesisSkimmed' => $boostedWithTax['result']['nemesisSkimmed'],
      'boostedNet' => $boostedWithTax['result']['cashDelta'],
      'clearedSkimmed' => $boostedTaxCleared['result']['nemesisSkimmed'],
      'clearedNet' => $boostedTaxCleared['result']['cashDelta'],
      'ledgerReconciles' => $finalPlayer['cash'] === (1000 + $ledgerSum),
    ], JSON_THROW_ON_ERROR);
  `);

  assert.match(res.locked4, /^Locked: Reach Level 3/);
  assert.match(res.locked7, /^Locked: Reach Level 6/);
  assert.match(res.locked10, /^Locked: Reach Level 10/);
  assert.match(res.locked13, /^Locked: Reach Level 14/);

  assert.equal(res.c1Skill0Cash, 450, '#1 Search for Cash awards $450 at Skill 0');
  assert.equal(res.c1PlayerXp, 18);
  assert.equal(res.leveledUpTo, 2, 'Successful crime awards real Player XP and promotes Lv 1 -> Lv 2');
  assert.equal(res.meritsDelta, 1, 'Level-up +1 merit grant is preserved in progression state');

  assert.ok(res.c1Skill100Cash >= 2400, `Expected Skill 100 #1 cash >= $2,400, got ${res.c1Skill100Cash}`);
  assert.ok(res.c13Skill100Cash >= 48000, `Expected Skill 100 #13 Arson cash >= $48,000, got ${res.c13Skill100Cash}`);

  assert.ok(res.livePerks.crimeSuccessPct >= 28, `Expected Shadow+Origin+Lookout crimeSuccessPct >= 28%, got ${res.livePerks.crimeSuccessPct}`);
  assert.ok(res.livePerks.crimeCashPct >= 12, `Expected crimeCashPct >= 12%, got ${res.livePerks.crimeCashPct}`);
  assert.ok(res.boostedGross > res.c13Skill100Cash, 'Shadow + Origin + Lookout increases gross crime cash');
  assert.ok(res.nemesisSkimmed > 0, 'Active Nemesis heatTaxPct skims street crime cash');
  assert.equal(res.boostedNet, res.boostedGross - res.nemesisSkimmed);
  assert.equal(res.clearedSkimmed, 0, 'Defeating Nemesis clears turf heat tax skim');
  assert.equal(res.clearedNet, res.boostedGross);
  assert.equal(res.ledgerReconciles, true, 'All crime & level-up payouts reconcile 100% with economy_ledger');
});

test('v151 Mogul, Bio-Alchemist & Warlord Live Formulas apply real math across Bank, Stocks, Vault, Travel, Drugs, Meds & Combat', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};

    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\ProgressionService;
    use Zone\\Engine\\Core\\Game\\TornSystemsService;
    use Zone\\Engine\\Core\\Game\\ForeignMarketService;
    use Zone\\Engine\\Core\\Game\\CombatService;
    use Zone\\Engine\\Core\\Game\\PlayerCombatService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $prog = new ProgressionService($db, $events, null, static fn(int $min, int $max): int => $max);
    $fm = new ForeignMarketService($db, $events);

    $db->execute("UPDATE players SET level = 15, xp = 10500, cash = 10000000, life = 100, max_life = 800, strength = 8000, speed = 8000, dexterity = 8000, defense = 8000 WHERE id = 'founder-player'");
    $act = function (string $action, string $id) use ($prog): array {
      $s = $prog->snapshot('founder-player');
      return $prog->act($action, $id, $s['state']['version'], 'founder-player');
    };

    // Baseline (unperked) measurements
    $baseVaultCap = TornSystemsService::vaultCap($prog->snapshot('founder-player')['state']);
    $baseLuggage  = $fm->snapshot('founder-player')['luggage']['capacity'];
    $baseCd       = $act('torn.bankCd', '30d:100000')['result']['activeCd'];
    // Clear CD for perked comparison
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['activeCd'] = null;
    unset($st['tornState']['activeCd']);
    $st['inv']['xanax'] = 4;
    $st['inv']['bloodbag'] = 4;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);

    $act('stock.buy', 'SYM:200');
    $baseSell = $act('stock.sell', 'SYM:100')['result']; // 1% fee (100 bps)

    $baseXanax = $act('drug.use', 'xanax')['result'];
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['cooldowns']['drugUntil'] = 0;
    $st['addiction'] = 0;
    $st['cooldowns']['addiction'] = 0;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);
    $db->execute("UPDATE players SET life = 100 WHERE id = 'founder-player'");
    $baseBloodBag = $act('torn.bloodBag', 'use')['result'];

    // Unlock Mogul + Bio-Alchemist + Warlord nodes + Crew
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['cooldowns']['medicalUntil'] = 0;
    $st['cooldowns']['drugUntil'] = 0;
    $st['rpg']['unlockedNodes'] = [
      // Mogul
      'compound_ledger' => 1,
      'insider_tape' => 1,
      'offshore_vault' => 1,
      'airstrip_logistics' => 1,
      'tax_shelter' => 1,
      'central_banker' => 1,
      // Bio-Alchemist
      'micro_dosing' => 1,
      'pure_synthesis' => 1,
      'field_triage' => 1,
      'adrenal_surge' => 1,
      'bio_synthetic' => 1,
      // Warlord
      'iron_knuckles' => 1,
      'hollow_point_drill' => 1,
      'arterial_strike' => 1,
      'kevlar_weave' => 1,
      'blood_frenzy' => 1,
      'executioner' => 1,
    ];
    $st['ascension'] = [
      'originChosen' => true,
      'origin' => 'street_chemist',
      'crew' => [
        'consigliere' => 2,
        'chemist' => 2,
        'enforcer' => 2,
        'wheelman' => 3,
      ],
    ];
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);
    $db->execute("UPDATE players SET life = 100 WHERE id = 'founder-player'");

    $perkedVaultCap = TornSystemsService::vaultCap($prog->snapshot('founder-player')['state']);
    $perkedFmSnap   = $fm->snapshot('founder-player');
    $perkedLuggage  = $perkedFmSnap['luggage']['capacity'];
    $perkedCd       = $act('torn.bankCd', '30d:100000')['result']['activeCd'];
    $perkedSell     = $act('stock.sell', 'SYM:100')['result']; // 0.5% fee (50 bps)
    $perkedXanax    = $act('drug.use', 'xanax')['result'];
    $perkedBloodBag = $act('torn.bloodBag', 'use')['result'];

    // Combat live Warlord check ($random === null)
    $db->execute("DELETE FROM action_cooldowns WHERE player_id = 'founder-player'");
    $db->execute("UPDATE players SET life = 800, energy = 150 WHERE id = 'founder-player'");
    $firstOppId = (string) $prog->snapshot('founder-player')['catalogs']['opponents'][0]['id'];
    $combat = new CombatService($db, $events);
    $cSnap = $combat->snapshot('founder-player');
    $cStart = $combat->act('start', $firstOppId, 'mug', $cSnap['version'], 'founder-player');
    $v = $cStart['version'];
    $phase = $cStart['encounter']['phase'];
    while ($phase === 'fighting') {
      $step = $combat->act('strike', $firstOppId, 'mug', $v, 'founder-player');
      $v = $step['version'];
      $phase = $step['encounter']['phase'];
    }
    $cFinish = $combat->act('finish', $firstOppId, 'mug', $v, 'founder-player');

    // PvP Combat live Warlord check ($random === null)
    $nowIso = gmdate('c');
    $today = gmdate('Y-m-d');
    $db->execute(
      "INSERT INTO players (id, username, level, xp, cash, energy, nerve, life, happy, max_energy, max_nerve, max_life, max_happy, resources_updated_at, strength, defense, speed, dexterity, bank_balance, city, login_streak, last_login_day)
       VALUES ('pvp-dummy', 'RichTarget', 5, 1000, 200000, 100, 25, 150, 500, 100, 25, 150, 500, :at, 15, 15, 15, 15, 0, 'Zone City', 1, :day)",
      ['at' => $nowIso, 'day' => $today],
    );
    $prog->snapshot('pvp-dummy');
    $db->execute("DELETE FROM action_cooldowns WHERE player_id = 'founder-player'");
    $db->execute("UPDATE players SET energy = 150, life = 800 WHERE id = 'founder-player'");
    $pvp = new PlayerCombatService($db, $events);
    $pSnap = $pvp->snapshot('founder-player');
    $pStart = $pvp->act('start', 'pvp-dummy', 'mug', $pSnap['version'], 'founder-player');
    $pv = $pStart['version'];
    $pPhase = $pStart['encounter']['phase'];
    while ($pPhase === 'fighting') {
      $pStep = $pvp->act('strike', 'pvp-dummy', 'mug', $pv, 'founder-player');
      $pv = $pStep['version'];
      $pPhase = $pStep['encounter']['phase'];
    }
    $pFinish = $pvp->act('finish', 'pvp-dummy', 'mug', $pv, 'founder-player');

    echo json_encode([
      'baseVaultCap' => $baseVaultCap,
      'perkedVaultCap' => $perkedVaultCap,
      'baseLuggage' => $baseLuggage,
      'perkedLuggage' => $perkedLuggage,
      'mogulLuggageBonus' => $perkedFmSnap['luggage']['mogulBonus'],
      'wheelmanFlightDiscount' => $perkedFmSnap['perks']['wheelmanFlightDiscountPct'],
      'baseCdApr' => $baseCd['aprBps'],
      'perkedCdApr' => $perkedCd['aprBps'],
      'baseCdInterest' => $baseCd['interest'],
      'perkedCdInterest' => $perkedCd['interest'],
      'baseSellFee' => $baseSell['fee'],
      'perkedSellFee' => $perkedSell['fee'],
      'perkedFeeRateBps' => $perkedSell['feeRateBps'],
      'baseOdBps' => $baseXanax['effectiveOdBps'],
      'perkedOdBps' => $perkedXanax['effectiveOdBps'],
      'baseAddiction' => $baseXanax['addiction'],
      'perkedAddiction' => $perkedXanax['addiction'],
      'baseHeal' => $baseBloodBag['healAmount'],
      'perkedHeal' => $perkedBloodBag['healAmount'],
      'npcWarlordMod' => $cFinish['result']['modifiers']['warlord'],
      'npcPlunderEffect' => $cFinish['result']['finishing_hit_effects'][0]['value'],
      'pvpWarlordMod' => $pFinish['result']['modifiers']['warlord'],
      'pvpMugCash' => $pFinish['result']['cashDelta'],
      'pvpPlunderEffect' => $pFinish['result']['finishing_hit_effects'][0]['value'],
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.baseVaultCap, 1000000);
  assert.ok(res.perkedVaultCap >= 1250000, `Expected >= +25% vault cap ($1,250,000+), got ${res.perkedVaultCap}`);
  assert.equal(res.baseLuggage, 5);
  assert.equal(res.mogulLuggageBonus, 5, 'airstrip_logistics (+2) + central_banker (+3) = +5 luggage');
  assert.equal(res.perkedLuggage, 10);
  assert.equal(res.wheelmanFlightDiscount, 9);

  assert.ok(res.perkedCdApr > res.baseCdApr, 'Mogul + Consigliere boosts Bank CD APR');
  assert.ok(res.perkedCdInterest > res.baseCdInterest, 'Mogul + Consigliere boosts Bank CD payout interest');

  assert.equal(res.perkedFeeRateBps, 50, 'Mogul reduces Stock Exchange sell fee from 1% (100 bps) to 0.5% (50 bps)');
  assert.ok(res.perkedSellFee < res.baseSellFee);

  assert.equal(res.baseOdBps, 250);
  assert.ok(res.perkedOdBps >= 112 && res.perkedOdBps <= 113, `Bio-Alchemist + street_chemist + chemist reduces Xanax OD risk by -55% relative (250 -> 112..113 bps), got ${res.perkedOdBps}`);
  assert.equal(res.baseAddiction, 3);
  assert.ok(res.perkedAddiction < res.baseAddiction, 'Bio-Alchemist reduces drug addiction gain');

  assert.equal(res.baseHeal, 300);
  assert.ok(res.perkedHeal >= 405, `Expected >= +35% Blood Bag heal (405+), got ${res.perkedHeal}`);

  assert.ok(res.npcWarlordMod >= 1.28, `Expected Warlord+Enforcer NPC dmg mult >= 1.28, got ${res.npcWarlordMod}`);
  assert.ok(res.npcPlunderEffect >= 40, `Expected +15%+ Mug plunder effect (40+), got ${res.npcPlunderEffect}`);
  assert.ok(res.pvpWarlordMod >= 1.28, `Expected Warlord+Enforcer PvP dmg mult >= 1.28, got ${res.pvpWarlordMod}`);
  assert.ok(res.pvpMugCash > 0);
  assert.ok(res.pvpPlunderEffect >= 40);
});

test('v151 HTTP Routes (/api/v1/ascension & /api/v1/ascension/action), Relay/Proxy Allowlist & PostgreSQL 16 Safety Audit', async () => {
  // 1) Relay publicPaths allowlist check
  assert.equal(isPublicPath('/api/v1/ascension'), true, 'relay.mjs allows /api/v1/ascension');
  assert.equal(isPublicPath('/api/v1/ascension/action'), true, 'relay.mjs allows /api/v1/ascension/action');

  // 2) api/index.php zone_proxy_public_path check
  const apiIndexSrc = readFileSync(resolve(root, 'api/index.php'), 'utf8');
  assert.match(apiIndexSrc, /'ascension',\s*'ascension\/action'/, 'api/index.php allows ascension & ascension/action');

  // 3) Live PHP HTTP router test with ephemeral ledger cookie sync & compact JSON verification
  const tmpDir = mkdtempSync(join(tmpdir(), 'zone-http151-'));
  const sqliteFile = join(tmpDir, 'http151.sqlite');
  const port = await getFreePort();
  const child = spawn(phpBin, ['-S', `127.0.0.1:${port}`, resolve(root, 'engine/router.php')], {
    cwd: root,
    env: {
      ...process.env,
      VERCEL: '',
      ZONE_DATABASE_URL: `sqlite:${sqliteFile}`,
      ZONE_PLAYER_SESSIONS: '1',
      ZONE_EPHEMERAL_VERCEL_SQLITE: '1',
      ZONE_LEDGER_SECRET: 'v151-ephemeral-ledger-test-secret-32b',
    },
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  try {
    for (let i = 0; i < 60; i++) {
      try {
        const h = await httpRequest(port, '/api/v1/health');
        if (h.status === 200) break;
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    const sessRes = await httpRequest(port, '/api/v1/auth/session', { method: 'POST', body: {} });
    assert.equal(sessRes.status, 201);
    const sessionCookie = sessRes.headers['set-cookie']
      .find((c) => c.startsWith('zone_player_session='))
      .split(';')[0];

    const getAsc = await httpRequest(port, '/api/v1/ascension', {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(getAsc.status, 200);
    assert.equal(getAsc.raw.includes('\n  '), false, 'router.php emits compact single-line JSON');
    assert.equal(getAsc.json.originChosen, false);
    assert.equal(Array.isArray(getAsc.json.origins), true);
    assert.equal(getAsc.json.origins.length, 4);

    const postAsc = await httpRequest(port, '/api/v1/ascension/action', {
      method: 'POST',
      headers: { Cookie: sessionCookie },
      body: { action: 'origin.select', originId: 'harbor_ghost', callsign: 'HarborShade' },
    });
    assert.equal(postAsc.status, 200);
    assert.equal(postAsc.json.originChosen, true);
    assert.equal(postAsc.json.origin, 'harbor_ghost');
    const setCookies = postAsc.headers['set-cookie'] ?? [];
    assert.equal(
      setCookies.some((c) => c.startsWith('zone_player_ledger=')),
      true,
      'POST /api/v1/ascension/action syncs zone_player_ledger cookie via syncEphemeralLedger',
    );

    const gpRes = await httpRequest(port, '/api/v1/gameplay', {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(gpRes.status, 200);
    assert.equal(gpRes.json.levelGates.dump.unlocked, true, 'Ephemeral Lv 7 session has Lv 2 Dump unlocked');
    assert.equal(gpRes.json.levelGates.companies.unlocked, false, 'Ephemeral Lv 7 session has Lv 10 Companies locked');
    assert.equal(gpRes.json.levelGates.foreignTravel.unlocked, false, 'Ephemeral Lv 7 session has Lv 15 Airport locked');
    assert.equal(gpRes.json.tornV2.livePerks.originId, 'harbor_ghost');
    assert.equal(gpRes.json.tornV2.livePerks.crimeSuccessPct, 8);
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 80));
    rmSync(tmpDir, { recursive: true, force: true });
  }

  // 4) Strict PostgreSQL 16 SQL & Router Compact JSON Static Audit across owned PHP files
  const ownedPhpFiles = [
    'engine/src/Core/Game/TornSystemsService.php',
    'engine/src/Core/Game/ForeignMarketService.php',
    'engine/src/Core/Game/CityActivitiesService.php',
    'engine/src/Core/Game/TradeBazaarCompanyService.php',
    'engine/src/Core/Game/PlayerCombatService.php',
    'engine/src/Core/Game/CombatService.php',
    'engine/src/Application/GameEngine.php',
    'engine/router.php',
    'api/index.php',
  ];

  for (const relPath of ownedPhpFiles) {
    const src = readFileSync(resolve(root, relPath), 'utf8');
    if (relPath === 'engine/router.php') {
      assert.equal(src.includes('JSON_PRETTY_PRINT'), false, 'engine/router.php must never use JSON_PRETTY_PRINT');
    }

    const sqlRegex = /(?:execute|fetchOne|fetchAll)\s*\(\s*(['"])([\s\S]*?)\1/g;
    let m;
    while ((m = sqlRegex.exec(src)) !== null) {
      const sql = m[2];
      assert.doesNotMatch(
        sql,
        /\b(?:MIN|MAX)\s*\([^,]+,[^)]+\)/i,
        `${relPath} contains SQLite-only 2-arg MIN/MAX in SQL: ${sql}`,
      );
      const params = [...sql.matchAll(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((p) => p[1]);
      const unique = new Set(params);
      assert.equal(
        params.length,
        unique.size,
        `${relPath} contains duplicate named PDO :param placeholder in SQL: ${sql}`,
      );
    }
  }
});
