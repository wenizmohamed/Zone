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
  const dir = resolve(root, 'engine/var/act149-' + randomUUID());
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

test('DailyService preserves 7-day streak & 4-contract pool while tracking Bonus & Weekly Milestone Contracts', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Economy\\Ledger;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\LevelingService;
    use Zone\\Engine\\Core\\Game\\DailyService;
    use Zone\\Engine\\Core\\Game\\ProgressionService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $ledger = new Ledger($db);
    $leveling = new LevelingService($db, $ledger, $events);
    (new ProgressionService($db, $events))->snapshot('founder-player');

    $clock = 1763600000;
    $daily = new DailyService($db, $ledger, $events, $leveling, fn(): int => $clock);

    $db->execute("UPDATE players SET last_login_day = NULL, login_streak = 0, cash = 10000 WHERE id = 'founder-player'");
    $login1 = $daily->registerLogin('founder-player', bin2hex(random_bytes(16)));
    $login1Dup = $daily->registerLogin('founder-player', bin2hex(random_bytes(16)));

    // Advance bonus contract & weekly milestone
    $bonusMetric = $daily->todayBonusContract()['metric'];
    $bonusTarget = $daily->todayBonusContract()['target'];
    $daily->recordProgress('founder-player', $bonusMetric, $bonusTarget);
    $daily->recordProgress('founder-player', 'crimes', 75);

    $stateBefore = $daily->contractState('founder-player');
    $bonusClaim = $daily->claimBonusContract('founder-player', bin2hex(random_bytes(16)));
    $weeklyClaim = $daily->claimWeeklyMilestone('founder-player', 'weekly-crime-lord', bin2hex(random_bytes(16)));
    $doubleWeeklyErr = '';
    try {
      $daily->claimWeeklyMilestone('founder-player', 'weekly-crime-lord', bin2hex(random_bytes(16)));
    } catch (Throwable $e) {
      $doubleWeeklyErr = $e->getMessage();
    }

    $prog = json_decode((string) $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'")['state_json'], true);

    echo json_encode([
      'poolCount' => count(DailyService::contractPool()),
      'bonusPoolCount' => count(DailyService::bonusContractPool()),
      'weeklyCount' => count(DailyService::weeklyMilestones()),
      'login1Cash' => $login1['rewardCash'] ?? 0,
      'login1Dup' => $login1Dup,
      'bonusComplete' => $stateBefore['bonusContract']['complete'],
      'bonusClaimCash' => $bonusClaim['rewardCash'],
      'weeklyClaimCash' => $weeklyClaim['rewardCash'],
      'weeklyClaimCredits' => $weeklyClaim['rewardCredits'],
      'missionCreditsAfter' => $prog['missionCredits'] ?? 0,
      'doubleWeeklyErr' => $doubleWeeklyErr,
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.poolCount, 4);
  assert.equal(res.bonusPoolCount, 6);
  assert.equal(res.weeklyCount, 4);
  assert.equal(res.login1Cash, 1000);
  assert.equal(res.login1Dup, null);
  assert.equal(res.bonusComplete, true);
  assert.ok(res.bonusClaimCash >= 7500);
  assert.equal(res.weeklyClaimCash, 35000);
  assert.equal(res.weeklyClaimCredits, 25);
  assert.ok(res.missionCreditsAfter >= 35);
  assert.match(res.doubleWeeklyErr, /already claimed/i);
});

test('CityActivitiesService: NPC Mission Agents, Armory Shop, City Dump toss+search, Loan Shark heat, Spin Wheels, Hunting & 5-Class Street Racing', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\CityActivitiesService;
    use Zone\\Engine\\Core\\Game\\ProgressionService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $prog = new ProgressionService($db, $events);
    $prog->snapshot('founder-player');

    $clock = 1763600000;
    $rollOverride = null;
    $svc = new CityActivitiesService(
      $db,
      $events,
      function () use (&$clock): int { return $clock; },
      function (int $min, int $max) use (&$rollOverride): int {
        if ($rollOverride !== null) {
          return max($min, min($max, $rollOverride));
        }
        return intdiv($min + $max, 2);
      }
    );

    $db->execute("UPDATE players SET level = 12, cash = 5000000, energy = 500, max_energy = 500 WHERE id = 'founder-player'");

    // 1. NPC Mission Agents: accept, progress metric, complete, refresh, buy rewards
    $snap0 = $svc->snapshot('founder-player');
    $contracts0 = $snap0['missionAgents']['contracts'];
    $c0 = $contracts0[0];
    $acc = $svc->act('founder-player', 'agent.accept', ['contractId' => $c0['id']]);

    // Advance the exact metric for c0
    $metric = $c0['metric'];
    $target = (int) $c0['target'];
    if ($metric === 'muggedCash') {
      (new \\Zone\\Engine\\Core\\Economy\\Ledger($db))->record('founder-player', 'cash', $target + 500, 5000000, 'combat.mug', bin2hex(random_bytes(16)));
    } else {
      $prog->recordMetric('founder-player', $metric, $target);
    }
    $comp = $svc->act('founder-player', 'agent.complete', ['contractId' => $c0['id']]);
    $refreshed = $svc->act('founder-player', 'agent.refresh');

    // Top up credits to test Armory Shop (xanax + skill_xp_book)
    $row = $db->fetchOne("SELECT state_json, version FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['missionCredits'] = 150;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);

    $buyXanax = $svc->act('founder-player', 'agent.buyReward', ['rewardId' => 'xanax']);
    $buyBook = $svc->act('founder-player', 'agent.buyReward', ['rewardId' => 'skill_xp_book', 'skill' => 'hunting']);

    // 2. City Dump: toss item -> unlocks dump_tosser honor + Merit, then search (5E)
    $prog->grantItem('founder-player', 'pistol', 2, null, 'test.seed');
    $toss = $svc->act('founder-player', 'dump.toss', ['itemId' => 'pistol', 'quantity' => 1]);
    $search = $svc->act('founder-player', 'dump.search');

    // 3. Duke's Loan Shark: borrow, advance >72h -> dukeEnforcerHeat: true, block extra borrow, repay -> clears heat
    $borrow = $svc->act('founder-player', 'loan.borrow', ['amount' => 100000]);
    $clock += 260000; // > 72h (259200s)
    $heatSnap = $svc->snapshot('founder-player');
    $overdueBorrowErr = '';
    try {
      $svc->act('founder-player', 'loan.borrow', ['amount' => 5000]);
    } catch (Throwable $e) {
      $overdueBorrowErr = $e->getMessage();
    }
    $repay = $svc->act('founder-player', 'loan.repay', ['amount' => $heatSnap['loanShark']['totalOwed']]);

    // 4. 3 Torn Spin Wheels (lame, mediocre, awesome + hospital slap check)
    $rollOverride = 1000; // cash jackpot slot
    $spinLame = $svc->act('founder-player', 'wheel.spin', ['wheel' => 'lame']);
    $spinMed = $svc->act('founder-player', 'wheel.spin', ['wheel' => 'mediocre']);
    $rollOverride = 5500; // Xanax / EDVD slot on awesome wheel
    $spinAwe = $svc->act('founder-player', 'wheel.spin', ['wheel' => 'awesome']);
    $clock += 10;
    $rollOverride = 9900; // 10m Hospital slap slot
    $spinSlap = $svc->act('founder-player', 'wheel.spin', ['wheel' => 'lame']);
    $prog->clearHospital('founder-player');
    $rollOverride = null;

    // 5. Harbor & Safari Hunting: master locked below 50, unlocked at >= 50
    // Current hunting skill is 25 from skill_xp_book
    $masterLockedErr = '';
    try {
      $svc->act('founder-player', 'hunt.expedition', ['mode' => 'master']);
    } catch (Throwable $e) {
      $masterLockedErr = $e->getMessage();
    }
    $huntBeg = $svc->act('founder-player', 'hunt.expedition', ['mode' => 'beginner']);
    // Raise hunting to 50 and run master expedition
    $rowH = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $stH = json_decode($rowH['state_json'], true);
    $stH['skill']['hunting'] = 52;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($stH)]);
    $rollOverride = 1000; // guaranteed clean kill & trophy drop
    $huntMaster = $svc->act('founder-player', 'hunt.expedition', ['mode' => 'master']);
    $rollOverride = null;

    // 6. Garage & 5-Class Street Racing League
    $db->execute("UPDATE players SET cash = 10000000, energy = 200 WHERE id = 'founder-player'");
    $buyCivic = $svc->act('founder-player', 'race.buyCar', ['carId' => 'civic_e']);
    $buyValkyrie = $svc->act('founder-player', 'race.buyCar', ['carId' => 'valkyrie_s']);
    $race1 = $svc->act('founder-player', 'race.enterTrack', ['trackId' => 'Zone GP']);
    $upgradeTurbo = $svc->act('founder-player', 'race.upgradeCar', ['carId' => 'valkyrie_s', 'upgradeId' => 'turbo']);

    echo json_encode([
      'contractCount' => count($contracts0),
      'tiers' => array_column($contracts0, 'tier'),
      'acceptedStatus' => $acc['result']['status'],
      'completedCredits' => $comp['result']['missionCreditsAwarded'],
      'refreshedCount' => $refreshed['result']['contractsGenerated'],
      'boughtXanax' => $buyXanax['result']['itemId'],
      'bookSkillLevel' => $buyBook['result']['skillLevel'],
      'tossHonor' => $toss['result']['firstTimeHonorAwarded'],
      'searchFound' => $search['result']['foundItemId'],
      'borrowed' => $borrow['result']['borrowed'],
      'heatActive' => $heatSnap['dukeEnforcerHeat'],
      'overdueBorrowErr' => $overdueBorrowErr,
      'repaidHeat' => $repay['dukeEnforcerHeat'],
      'repaidOwed' => $repay['loanShark']['totalOwed'],
      'spinLameCash' => $spinLame['result']['cashWon'],
      'spinMedCash' => $spinMed['result']['cashWon'],
      'spinAweItem' => $spinAwe['result']['itemWon']['itemId'] ?? null,
      'spinSlapHosp' => $spinSlap['result']['hospitalMinutes'],
      'masterLockedErr' => $masterLockedErr,
      'huntBegSkill' => $huntBeg['result']['huntingSkill'],
      'huntMasterTrophy' => $huntMaster['result']['trophyItemId'],
      'huntMasterProfit' => $huntMaster['result']['grossPayout'],
      'racePosition' => $race1['result']['position'],
      'raceLaps' => count($race1['result']['telemetry']),
      'raceStandingsCount' => count($race1['result']['standings']),
      'racePodiumCash' => $race1['result']['podiumCash'],
      'turboStage' => $upgradeTurbo['result']['stage'],
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.contractCount, 3);
  assert.deepEqual(res.tiers, ['Easy', 'Medium', 'Elite']);
  assert.equal(res.acceptedStatus, 'accepted');
  assert.ok(res.completedCredits >= 15 && res.completedCredits <= 75);
  assert.equal(res.refreshedCount, 3);
  assert.equal(res.boughtXanax, 'xanax');
  assert.equal(res.bookSkillLevel, 25);
  assert.equal(res.tossHonor, true);
  assert.ok(typeof res.searchFound === 'string' && res.searchFound.length > 0);
  assert.equal(res.borrowed, 100000);
  assert.equal(res.heatActive, true);
  assert.match(res.overdueBorrowErr, /overdue/i);
  assert.equal(res.repaidHeat, false);
  assert.equal(res.repaidOwed, 0);
  assert.equal(res.spinLameCash, 2500);
  assert.equal(res.spinMedCash, 75000);
  assert.equal(res.spinAweItem, 'xanax');
  assert.equal(res.spinSlapHosp, 10);
  assert.match(res.masterLockedErr, /Hunting Skill 50/);
  assert.ok(res.huntBegSkill >= 27);
  assert.ok(typeof res.huntMasterTrophy === 'string' && res.huntMasterTrophy.length > 0);
  assert.ok(res.huntMasterProfit > 20000);
  assert.equal(res.racePosition, 1);
  assert.equal(res.raceLaps, 6);
  assert.equal(res.raceStandingsCount, 8);
  assert.equal(res.racePodiumCash, 175000);
  assert.equal(res.turboStage, 1);
});

test('TradeBazaarCompanyService: 2-Player Atomic Trade Escrow + Cancel, 0%-Tax Bazaar, 1-10 Star Companies & Marriage Property Sharing', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\ProgressionService;
    use Zone\\Engine\\Core\\Game\\TradeBazaarCompanyService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);

    $nowIso = gmdate('c');
    $db->insertIgnore(
      'players',
      ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
      ['partner-p2', 'PartnerTwo', 15, 7000, 2000000, 150, 50, 1500, 250, 150, 50, 1500, 250, $nowIso, 500, 500, 500, 500, 0, 'Zone City', 1, gmdate('Y-m-d')]
    );

    $prog = new ProgressionService($db, $events);
    $prog->snapshot('founder-player');
    $prog->snapshot('partner-p2');

    $db->execute("UPDATE players SET cash = 3000000, energy = 300, max_energy = 300 WHERE id = 'founder-player'");
    $prog->grantItem('founder-player', 'xanax', 3, null, 'test.seed');
    $prog->grantItem('partner-p2', 'edvd', 2, null, 'test.seed');

    $svc = new TradeBazaarCompanyService($db, $events);

    // 1A. Safe 2-Player Trade Escrow -> Atomic Swap
    $tCreate = $svc->act('founder-player', 'trade.create', ['partnerId' => 'partner-p2']);
    $tradeId = $tCreate['result']['id'];
    $svc->act('founder-player', 'trade.addCash', ['tradeId' => $tradeId, 'amount' => 250000]);
    $svc->act('founder-player', 'trade.addItem', ['tradeId' => $tradeId, 'itemId' => 'xanax', 'quantity' => 2]);
    // Founder accepts first, then partner adds item -> must reset founder's acceptance (anti-scam)
    $svc->act('founder-player', 'trade.accept', ['tradeId' => $tradeId]);
    $afterPartnerItem = $svc->act('partner-p2', 'trade.addItem', ['tradeId' => $tradeId, 'itemId' => 'edvd', 'quantity' => 1]);
    $antiScamReset = ($afterPartnerItem['result']['accepted']['founder-player'] === false);

    // Now both accept -> atomic settlement!
    $svc->act('founder-player', 'trade.accept', ['tradeId' => $tradeId]);
    $settled = $svc->act('partner-p2', 'trade.accept', ['tradeId' => $tradeId]);

    $p1SnapAfterTrade = $prog->snapshot('founder-player');
    $p2SnapAfterTrade = $prog->snapshot('partner-p2');

    // 1B. Trade Cancel -> Full Escrow Refund
    $tCancelCreate = $svc->act('founder-player', 'trade.create', ['partnerId' => 'partner-p2']);
    $cancelId = $tCancelCreate['result']['id'];
    $cashBeforeCancel = (int) $prog->snapshot('founder-player')['player']['cash'];
    $xanaxBeforeCancel = (int) ($prog->snapshot('founder-player')['state']['inv']['xanax'] ?? 0);
    $svc->act('founder-player', 'trade.addCash', ['tradeId' => $cancelId, 'amount' => 100000]);
    $svc->act('founder-player', 'trade.addItem', ['tradeId' => $cancelId, 'itemId' => 'xanax', 'quantity' => 1]);
    $svc->act('partner-p2', 'trade.cancel', ['tradeId' => $cancelId]);
    $cashAfterCancel = (int) $prog->snapshot('founder-player')['player']['cash'];
    $xanaxAfterCancel = (int) ($prog->snapshot('founder-player')['state']['inv']['xanax'] ?? 0);

    // 2. 0%-Tax Personal Bazaar: toggle, list, buy (100% proceeds to seller!), unlist
    $svc->act('founder-player', 'bazaar.toggle', ['open' => true, 'tagline' => 'Vincenzo Zero-Tax Vault']);
    $listed = $svc->act('founder-player', 'bazaar.listItem', ['itemId' => 'edvd', 'quantity' => 1, 'unitPrice' => 400000]);
    $listingId = $listed['result']['id'];
    $sellerCashBefore = (int) $prog->snapshot('founder-player')['player']['cash'];
    $buyerCashBefore = (int) $prog->snapshot('partner-p2')['player']['cash'];
    $bzBuy = $svc->act('partner-p2', 'bazaar.buy', ['listingId' => $listingId, 'quantity' => 1]);
    $sellerCashAfter = (int) $prog->snapshot('founder-player')['player']['cash'];
    $buyerCashAfter = (int) $prog->snapshot('partner-p2')['player']['cash'];

    // Test unlist refund
    $listed2 = $svc->act('founder-player', 'bazaar.listItem', ['itemId' => 'xanax', 'quantity' => 1, 'unitPrice' => 800000]);
    $unlisted = $svc->act('founder-player', 'bazaar.unlistItem', ['listingId' => $listed2['result']['id']]);

    // 3. Player-Directed Companies (1★-10★): found, manage, join, workShift, star upgrade & redeemSpecial
    $founded = $svc->act('founder-player', 'company.found', ['type' => 'adult_novelties', 'name' => 'Velvet Syndicate Corp']);
    $companyId = $founded['result']['id'];
    $svc->act('founder-player', 'company.manage', ['adBudget' => 50000, 'servicePrice' => 110]);
    $svc->act('partner-p2', 'company.join', ['companyId' => $companyId]);

    // Work shifts to advance stars & earn jobPts + working stats
    $shift1 = $svc->act('founder-player', 'company.workShift');
    $shift2 = $svc->act('partner-p2', 'company.workShift');

    // Boost company to 7★ to verify 7★ Adult Novelties Free EDVD special redemption
    $compDoc = json_decode((string) $db->fetchOne("SELECT value FROM engine_metadata WHERE name = 'player-companies-v1'")['value'], true);
    $compDoc['companies'][$companyId]['stars'] = 7;
    $compDoc['companies'][$companyId]['companyXp'] = 1200;
    $db->execute("UPDATE engine_metadata SET value = :v WHERE name = 'player-companies-v1'", ['v' => json_encode($compDoc)]);

    $edvdBeforeSpecial = (int) ($prog->snapshot('founder-player')['state']['inv']['edvd'] ?? 0);
    $redeem7 = $svc->act('founder-player', 'company.redeemSpecial', ['star' => 7]);
    $edvdAfterSpecial = (int) ($prog->snapshot('founder-player')['state']['inv']['edvd'] ?? 0);

    // 4. Marriage & Spouse Property Max-Happy Sharing + Divorce
    // Give founder-player active Private Island (5000 happy) while partner-p2 has Shack (250 happy)
    $rowP1 = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $stP1 = json_decode($rowP1['state_json'], true);
    $stP1['prop'] = 'island';
    $stP1['ownedProperties']['island'] = 1;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($stP1)]);
    $db->execute("UPDATE players SET max_happy = 5000 WHERE id = 'founder-player'");
    $db->execute("UPDATE players SET max_happy = 250 WHERE id = 'partner-p2'");

    $propMar = $svc->act('founder-player', 'marriage.propose', ['targetPlayerId' => 'PartnerTwo']);
    $accMar = $svc->act('partner-p2', 'marriage.accept', ['proposalId' => $propMar['result']['id']]);
    $p2MaxHappyMarried = (int) $db->fetchOne("SELECT max_happy FROM players WHERE id = 'partner-p2'")['max_happy'];

    $divorce = $svc->act('partner-p2', 'marriage.divorce');
    $p2MaxHappyDivorced = (int) $db->fetchOne("SELECT max_happy FROM players WHERE id = 'partner-p2'")['max_happy'];

    echo json_encode([
      'antiScamReset' => $antiScamReset,
      'tradeStatus' => $settled['result']['status'],
      'p1EdvdAfterTrade' => $p1SnapAfterTrade['state']['inv']['edvd'] ?? 0,
      'p2XanaxAfterTrade' => $p2SnapAfterTrade['state']['inv']['xanax'] ?? 0,
      'p2CashAfterTrade' => $p2SnapAfterTrade['player']['cash'],
      'cancelCashConserved' => $cashAfterCancel === $cashBeforeCancel,
      'cancelItemConserved' => $xanaxAfterCancel === $xanaxBeforeCancel,
      'bazaarTaxPaid' => $bzBuy['result']['taxPaid'],
      'sellerProceedsExact' => ($sellerCashAfter - $sellerCashBefore) === 400000,
      'buyerDebitExact' => ($buyerCashBefore - $buyerCashAfter) === 400000,
      'unlistRefunded' => $unlisted['result']['refundedQuantity'],
      'archetypeCount' => count($founded['companyArchetypes']),
      'shiftWage' => $shift1['result']['wagePaid'],
      'shiftStarsAfter2' => $shift2['result']['starsAfter'],
      'workStatsInt' => $shift1['result']['workStats']['int'],
      'edvdGainedFrom7Star' => $edvdAfterSpecial - $edvdBeforeSpecial,
      'p2MaxHappyMarried' => $p2MaxHappyMarried,
      'p2MaxHappyDivorced' => $p2MaxHappyDivorced,
      'divorceStatus' => $divorce['result']['status'],
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.antiScamReset, true);
  assert.equal(res.tradeStatus, 'completed');
  assert.equal(res.p1EdvdAfterTrade, 1);
  assert.equal(res.p2XanaxAfterTrade, 2);
  assert.equal(res.p2CashAfterTrade, 2250000);
  assert.equal(res.cancelCashConserved, true);
  assert.equal(res.cancelItemConserved, true);
  assert.equal(res.bazaarTaxPaid, 0);
  assert.equal(res.sellerProceedsExact, true);
  assert.equal(res.buyerDebitExact, true);
  assert.equal(res.unlistRefunded, 1);
  assert.equal(res.archetypeCount, 8);
  assert.ok(res.shiftWage > 5000);
  assert.ok(res.shiftStarsAfter2 >= 2);
  assert.ok(res.workStatsInt >= 14);
  assert.equal(res.edvdGainedFrom7Star, 1);
  assert.equal(res.p2MaxHappyMarried, 5000);
  assert.equal(res.p2MaxHappyDivorced, 250);
  assert.equal(res.divorceStatus, 'divorced');
});

test('PostgreSQL 16 SQL compatibility audit across DailyService, CityActivitiesService & TradeBazaarCompanyService', () => {
  const files = [
    resolve(root, 'engine/src/Core/Game/DailyService.php'),
    resolve(root, 'engine/src/Core/Game/CityActivitiesService.php'),
    resolve(root, 'engine/src/Core/Game/TradeBazaarCompanyService.php'),
  ];

  for (const file of files) {
    const src = readFileSync(file, 'utf8');

    // Ensure zero SQLite-only 2-arg MIN(a,b)/MAX(a,b) and zero duplicate named :param placeholders inside SQL queries
    const sqlLiterals = [...src.matchAll(/['"](?:SELECT|INSERT|UPDATE|DELETE)\b[^'"]*['"]/gi)].map(m => m[0]);
    assert.ok(sqlLiterals.length > 0, `Expected SQL queries in ${file}`);
    for (const sql of sqlLiterals) {
      assert.doesNotMatch(sql, /\b(MIN|MAX)\s*\([^)]+,[^)]+\)/i, `2-arg SQL MIN/MAX forbidden in ${file}: ${sql}`);
      const params = [...sql.matchAll(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(m => m[1]);
      const unique = new Set(params);
      assert.equal(params.length, unique.size, `Duplicate named PDO placeholder in ${file}: ${sql}`);
    }
  }
});
