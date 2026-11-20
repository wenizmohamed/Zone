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
  const dir = resolve(root, 'engine/var/rpg149-' + randomUUID());
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

test('v149 StoryCampaignService exposes 5 Acts x 5 Chapters (25 bilingual EN/AR chapters), live objectives, sequential gates, and Cash/XP/SP/Merit claims', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\ProgressionService;
    use Zone\\Engine\\Core\\Game\\StoryCampaignService;
    use Zone\\Engine\\Core\\Game\\RankAndSkillTreeService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $now = gmdate('c');
    $db->insertIgnore(
      'players',
      ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
      ['story-rookie', 'HarborKid', 1, 0, 1500, 100, 45, 250, 500, 100, 45, 250, 500, $now, 15, 15, 15, 15, 0, 'Zone City', 0, null]
    );

    $prog = new ProgressionService($db, $events);
    $story = new StoryCampaignService($db, $events);
    $rpg = new RankAndSkillTreeService($db, $events);

    $rejects = static function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    $snap0 = $story->snapshot('story-rookie');
    $bilingualValid = true;
    foreach ($snap0['chapters'] as $ch) {
      if (trim($ch['titleEn']) === '' || trim($ch['titleAr']) === '' || trim($ch['dialogueEn']) === '' || trim($ch['dialogueAr']) === '') {
        $bilingualValid = false;
      }
    }

    // Cannot claim act1_ch1 before doing 1 crime; cannot skip to act1_ch2 or act5_ch1
    $earlyClaimErr = $rejects(fn() => $story->act('story-rookie', 'chapter.claim', ['chapterId' => 'act1_ch1']));
    $skipCh2Err = $rejects(fn() => $story->act('story-rookie', 'chapter.start', ['chapterId' => 'act1_ch2']));
    $act5GateErr = $rejects(fn() => $story->act('story-rookie', 'chapter.start', ['chapterId' => 'act5_ch1']));

    // Record 1 crime via authoritative ProgressionService -> act1_ch1 becomes claimable!
    $prog->recordCrime('story-rookie', 'searchforcash', true, 10);
    $snapReady = $story->snapshot('story-rookie');
    $claimed1 = $story->act('story-rookie', 'chapter.claim', ['chapterId' => 'act1_ch1']);
    $dupClaimErr = $rejects(fn() => $story->act('story-rookie', 'chapter.claim', ['chapterId' => 'act1_ch1']));
    $rpgAfter = $rpg->snapshot('story-rookie');

    echo json_encode([
      'actCount' => count($snap0['acts']),
      'chapterCount' => count($snap0['chapters']),
      'bilingualValid' => $bilingualValid,
      'initialHeadlineEn' => $snap0['banner']['headlineEn'],
      'earlyClaimErr' => $earlyClaimErr,
      'skipCh2Err' => $skipCh2Err,
      'act5GateErr' => $act5GateErr,
      'ch1ClaimableAfterCrime' => $snapReady['activeChapter']['claimable'],
      'cashAwarded' => $claimed1['result']['cashAwarded'],
      'xpAwarded' => $claimed1['result']['xpAwarded'],
      'spAwarded' => $claimed1['result']['spAwarded'],
      'meritsAwarded' => $claimed1['result']['meritsAwarded'],
      'leveledUpTo2' => $claimed1['player']['level'], // 120 XP >= 100 XP for Lv 2!
      'nextActiveChapter' => $claimed1['banner']['activeChapterId'],
      'dupClaimErr' => $dupClaimErr,
      'totalSpEarned' => $rpgAfter['skillTree']['totalSpEarned'], // 1 from Lv2 + 1 from Ch1 = 2 SP
      'meritsBalance' => $rpgAfter['player']['merits'], // 1 from Ch1 + 1 from Lv2 = 2 Merits
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.actCount, 5);
  assert.equal(res.chapterCount, 25);
  assert.equal(res.bilingualValid, true);
  assert.match(res.initialHeadlineEn, /Act I · Ch\.1: Dockside Blood/);
  assert.match(res.earlyClaimErr, /Complete all chapter objectives/i);
  assert.match(res.skipCh2Err, /Claim previous chapter/i);
  assert.match(res.act5GateErr, /Requires Player Level 25/i);
  assert.equal(res.ch1ClaimableAfterCrime, true);
  assert.equal(res.cashAwarded, 3500);
  assert.equal(res.xpAwarded, 120);
  assert.equal(res.spAwarded, 1);
  assert.equal(res.meritsAwarded, 1);
  assert.equal(res.leveledUpTo2, 2);
  assert.equal(res.nextActiveChapter, 'act1_ch2');
  assert.match(res.dupClaimErr, /already been claimed/i);
  assert.equal(res.totalSpEarned, 2);
  assert.equal(res.meritsBalance, 2);
});

test('v149 Act Finale enforces Syndicate/Directorate moral choice, 15E Boss Fight (5m Hospital on defeat, Relic + Gear + Title on victory)', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\ProgressionService;
    use Zone\\Engine\\Core\\Game\\StoryCampaignService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $prog = new ProgressionService($db, $events);
    $story = new StoryCampaignService($db, $events, static fn(int $min, int $max): int => (int) round(($min + $max) / 2));

    $rejects = static function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    // Fulfill Act I Ch 1..4 metrics for founder-player
    for ($i = 0; $i < 4; $i++) $prog->recordCrime('founder-player', 'searchforcash', true, 12);
    $prog->recordMetric('founder-player', 'trains', 3);
    $prog->recordMetric('founder-player', 'buys', 1);

    foreach (['act1_ch1', 'act1_ch2', 'act1_ch3', 'act1_ch4'] as $cid) {
      $story->act('founder-player', 'chapter.claim', ['chapterId' => $cid]);
    }

    // Choose Syndicate alignment in Act I Finale (act1_ch5)
    $choiceSyn = $story->act('founder-player', 'chapter.choice', ['chapterId' => 'act1_ch5', 'choice' => 'syndicate']);
    // Switch choice to Directorate before claiming to verify both branches work cleanly
    $choiceDir = $story->act('founder-player', 'chapter.choice', ['chapterId' => 'act1_ch5', 'choice' => 'directorate']);
    // Switch back to Syndicate as final pick
    $choiceFinal = $story->act('founder-player', 'chapter.choice', ['chapterId' => 'act1_ch5', 'choice' => 'syndicate']);

    // Force Boss Defeat first by setting player to 1 life & tiny stats
    $db->execute("UPDATE players SET life = 1, max_life = 250, strength = 1, defense = 1, speed = 1, dexterity = 1, energy = 100 WHERE id = 'founder-player'");
    $defeat = $story->act('founder-player', 'chapter.bossFight', ['chapterId' => 'act1_ch5']);
    $blockedWhileHosp = $rejects(fn() => $story->act('founder-player', 'chapter.bossFight', ['chapterId' => 'act1_ch5']));

    // Heal & restore strong stats + weapon to defeat Pier 4 Enforcer
    $prog->clearHospital('founder-player');
    $db->execute("UPDATE players SET life = 1500, max_life = 1500, strength = 350, defense = 300, speed = 320, dexterity = 280, energy = 100 WHERE id = 'founder-player'");
    $victory = $story->act('founder-player', 'chapter.bossFight', ['chapterId' => 'act1_ch5']);
    $rematchBlocked = $rejects(fn() => $story->act('founder-player', 'chapter.bossFight', ['chapterId' => 'act1_ch5']));

    // Claim Act I Finale
    $claimedFinale = $story->act('founder-player', 'chapter.claim', ['chapterId' => 'act1_ch5']);
    $gpState = $prog->snapshot('founder-player')['state'];

    echo json_encode([
      'synAlignment' => $choiceSyn['alignment'],
      'dirAlignment' => $choiceDir['alignment'],
      'dirBankApr' => $choiceDir['alignmentDetails']['bonuses']['bankAprPct'],
      'finalAlignment' => $choiceFinal['alignment'],
      'synCrimeBonus' => $choiceFinal['alignmentDetails']['bonuses']['crimeSuccessPct'],
      'synStealthBonus' => $choiceFinal['alignmentDetails']['bonuses']['stealthPct'],
      'chapterNpcIsString' => is_string($choiceFinal['activeChapter']['npc']),
      'chapterChoiceIsString' => $choiceFinal['activeChapter']['choice'] === 'syndicate',
      'defeatVictoryFlag' => $defeat['result']['victory'],
      'defeatEnergyAfter' => $defeat['player']['energy'],
      'defeatHospSeconds' => $defeat['result']['hospitalSeconds'],
      'blockedWhileHosp' => $blockedWhileHosp,
      'winVictoryFlag' => $victory['result']['victory'],
      'winEnergyAfter' => $victory['player']['energy'],
      'winRounds' => $victory['result']['roundsCount'],
      'rematchBlocked' => $rematchBlocked,
      'finaleSp' => $claimedFinale['result']['spAwarded'],
      'finaleMerits' => $claimedFinale['result']['meritsAwarded'],
      'relicId' => $claimedFinale['result']['relicAwarded']['id'] ?? '',
      'bonusItem' => $claimedFinale['result']['bonusItemId'],
      'ownsBonusItem' => (int) ($gpState['inv']['revolver_2'] ?? 0),
      'activeTitleEn' => $claimedFinale['activeTitle']['en'] ?? '',
      'nextChapterAfterAct1' => $claimedFinale['banner']['activeChapterId'],
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.synAlignment, 'syndicate');
  assert.equal(res.dirAlignment, 'directorate');
  assert.equal(res.dirBankApr, 3);
  assert.equal(res.finalAlignment, 'syndicate');
  assert.equal(res.synCrimeBonus, 3);
  assert.equal(res.synStealthBonus, 4);
  assert.equal(res.chapterNpcIsString, true);
  assert.equal(res.chapterChoiceIsString, true);
  assert.equal(res.defeatVictoryFlag, false);
  assert.equal(res.defeatEnergyAfter, 85);
  assert.equal(res.defeatHospSeconds, 300);
  assert.match(res.blockedWhileHosp, /leave jail or hospital/i);
  assert.equal(res.winVictoryFlag, true);
  assert.equal(res.winEnergyAfter, 85);
  assert.ok(res.winRounds >= 1);
  assert.match(res.rematchBlocked, /already been defeated/i);
  assert.equal(res.finaleSp, 3);
  assert.equal(res.finaleMerits, 2);
  assert.equal(res.relicId, 'harbor_brass_ledger');
  assert.equal(res.bonusItem, 'revolver_2');
  assert.ok(res.ownsBonusItem >= 1);
  assert.equal(res.activeTitleEn, 'Dockside Survivor');
  assert.equal(res.nextChapterAfterAct1, 'act2_ch1');
});

test('v149 Leveling 2.0 supports Hold-Level banking, partial & full level.promote, +20 max_life/+1 SP/+1 Merit grants, and 1->100 Roadmap', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Economy\\Ledger;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\LevelingService;
    use Zone\\Engine\\Core\\Game\\RankAndSkillTreeService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $ledger = new Ledger($db);
    $now = gmdate('c');

    $db->insertIgnore(
      'players',
      ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
      ['holder-15', 'LevelHolder', 1, 0, 0, 100, 45, 250, 500, 100, 45, 250, 500, $now, 100, 100, 100, 100, 0, 'Zone City', 0, null]
    );

    $rpg = new RankAndSkillTreeService($db, $events);
    $lvl = new LevelingService($db, $ledger, $events);

    // Enable Hold-Level
    $toggled = $rpg->act('holder-15', 'level.toggleHold', ['enabled' => true]);

    // Award 1,000 XP (enough for Level 5) -> sync must NOT raise players.level while held!
    $db->execute("UPDATE players SET xp = 1000, energy = 10, nerve = 5, life = 50 WHERE id = 'holder-15'");
    $syncHeld = $lvl->sync('holder-15', 'hold-sync-1');
    $snapHeld = $rpg->snapshot('holder-15');

    // Promote 2 levels first (Lv 1 -> Lv 3), then remaining levels (Lv 3 -> Lv 5)
    $promPart = $rpg->act('holder-15', 'level.promote', ['levels' => 2]);
    $promFull = $rpg->act('holder-15', 'level.promote');

    $noMoreErr = '';
    try { $rpg->act('holder-15', 'level.promote'); } catch (Throwable $e) { $noMoreErr = $e->getMessage(); }

    echo json_encode([
      'holdEnabled' => $toggled['leveling']['holdLevel'],
      'syncHeldFlag' => $syncHeld['held'] ?? false,
      'heldPlayerLevel' => $snapHeld['player']['level'],
      'heldPendingLevels' => $snapHeld['leveling']['pendingLevels'],
      'heldEligibleLevel' => $snapHeld['leveling']['eligibleLevel'],
      'partLevel' => $promPart['player']['level'],
      'partPending' => $promPart['leveling']['pendingLevels'],
      'finalLevel' => $promFull['player']['level'],
      'finalMaxNerve' => $promFull['player']['max_nerve'],
      'finalMaxEnergy' => $promFull['player']['max_energy'],
      'finalMaxLife' => $promFull['player']['max_life'],
      'finalLifeRefilled' => $promFull['player']['life'],
      'finalCash' => $promFull['player']['cash'], // (2+3+4+5)*250 = 3500
      'finalLevelSp' => $promFull['skillTree']['sources']['levels'], // 4 SP
      'finalMerits' => $promFull['player']['merits'], // 4 Merits
      'roadmapCount' => count($promFull['leveling']['roadmap']),
      'lv5Unlocked' => array_values(array_filter($promFull['leveling']['roadmap'], fn($m) => $m['level'] === 5))[0]['unlocked'] ?? false,
      'lv15Unlocked' => array_values(array_filter($promFull['leveling']['roadmap'], fn($m) => $m['level'] === 15))[0]['unlocked'] ?? true,
      'noMoreErr' => $noMoreErr,
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.holdEnabled, true);
  assert.equal(res.syncHeldFlag, true);
  assert.equal(res.heldPlayerLevel, 1);
  assert.equal(res.heldPendingLevels, 4);
  assert.equal(res.heldEligibleLevel, 5);
  assert.equal(res.partLevel, 3);
  assert.equal(res.partPending, 2);
  assert.equal(res.finalLevel, 5);
  assert.equal(res.finalMaxNerve, 49);
  assert.equal(res.finalMaxEnergy, 112);
  assert.equal(res.finalMaxLife, 330);
  assert.equal(res.finalLifeRefilled, 330);
  assert.equal(res.finalCash, 3500);
  assert.equal(res.finalLevelSp, 4);
  assert.equal(res.finalMerits, 4);
  assert.equal(res.roadmapCount, 12);
  assert.equal(res.lv5Unlocked, true);
  assert.equal(res.lv15Unlocked, false);
  assert.match(res.noMoreErr, /No pending level promotions/i);
});

test('v149 Torn 26-Rank Dual-Trigger Matrix evaluates all 4 trigger tracks (#1 -> #26 Invincible), claims promotions, and prevents rank demotion', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\RankAndSkillTreeService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $now = gmdate('c');

    $db->insertIgnore(
      'players',
      ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
      ['rank-climber', 'Climber', 1, 0, 1000, 100, 45, 250, 500, 100, 45, 250, 500, $now, 10, 10, 10, 10, 0, 'Zone City', 0, null]
    );

    $rpg = new RankAndSkillTreeService($db, $events);
    $s0 = $rpg->snapshot('rank-climber');
    $earlyErr = '';
    try { $rpg->act('rank-climber', 'rank.claimPromotion'); } catch (Throwable $e) { $earlyErr = $e->getMessage(); }

    // Set Level 16 (4 triggers: 2,6,11,16), Battle Stats 60,000 (4 triggers: 500,2.5k,10k,50k),
    // Networth $3,000,000 (3 triggers: 25k,250k,2.5M), Crimes 600 (3 triggers: 25,100,500) => 14 triggers => Rank #15 Professional!
    $db->execute("UPDATE players SET level = 16, strength = 15000, defense = 15000, speed = 15000, dexterity = 15000, cash = 500000, bank_balance = 2500000 WHERE id = 'rank-climber'");
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'rank-climber'");
    $st = json_decode($row['state_json'], true);
    $st['ctr']['crimes'] = 600;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'rank-climber'", ['s' => json_encode($st)]);

    $sMid = $rpg->snapshot('rank-climber');
    $claimedMid = $rpg->act('rank-climber', 'rank.claimPromotion');

    // Spend bank_balance down to $0 -> claimed Rank #15 must NOT demote!
    $db->execute("UPDATE players SET cash = 0, bank_balance = 0 WHERE id = 'rank-climber'");
    $sAfterSpend = $rpg->snapshot('rank-climber');

    // Max out triggers (25+ triggers) -> Rank #26 Invincible!
    $db->execute("UPDATE players SET level = 100, strength = 500000000, defense = 500000000, speed = 100000000, dexterity = 100000000, bank_balance = 30000000000 WHERE id = 'rank-climber'");
    $sMax = $rpg->snapshot('rank-climber');

    echo json_encode([
      'ladderSize' => count($s0['ranks']['ladder']),
      'rank1En' => $s0['ranks']['currentRank']['titleEn'],
      'rank1Ar' => $s0['ranks']['currentRank']['titleAr'],
      'earlyErr' => $earlyErr,
      'midTriggers' => $sMid['ranks']['totalTriggers'],
      'midRankIndex' => $sMid['ranks']['currentRankIndex'],
      'midRankEn' => $sMid['ranks']['currentRank']['titleEn'],
      'promotedRanks' => $claimedMid['result']['ranksPromoted'],
      'promotedCash' => $claimedMid['result']['cashAwarded'],
      'promotedSp' => $claimedMid['result']['spAwarded'],
      'promotedMerits' => $claimedMid['result']['meritsAwarded'],
      'nonDemotedRankIndex' => $sAfterSpend['ranks']['currentRankIndex'],
      'maxRankIndex' => $sMax['ranks']['currentRankIndex'],
      'maxRankEn' => $sMax['ranks']['currentRank']['titleEn'],
      'maxRankAr' => $sMax['ranks']['currentRank']['titleAr'],
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.ladderSize, 26);
  assert.equal(res.rank1En, 'Absolute Beginner');
  assert.equal(res.rank1Ar, 'مبتدئ مطلق');
  assert.match(res.earlyErr, /No unclaimed rank promotions/i);
  assert.equal(res.midTriggers, 14);
  assert.equal(res.midRankIndex, 15);
  assert.equal(res.midRankEn, 'Professional');
  assert.equal(res.promotedRanks, 14);
  assert.ok(res.promotedCash > 500000);
  assert.equal(res.promotedSp, 14);
  assert.equal(res.promotedMerits, 14);
  assert.equal(res.nonDemotedRankIndex, 15);
  assert.equal(res.maxRankIndex, 26);
  assert.equal(res.maxRankEn, 'Invincible');
  assert.equal(res.maxRankAr, 'لا يُقهر');
});

test('v149 4-Branch Skill Tree (24 nodes + 4 Capstones) enforces prerequisites, applies/reverses permanent caps on Respec (1st free, 2nd 100 pts), and trains Working Stats', () => {
  const res = runPhpHarness(`<?php
    declare(strict_types=1);
    require ${JSON.stringify(resolve(root, 'engine/bootstrap.php'))};
    use Zone\\Engine\\Core\\Persistence\\Database;
    use Zone\\Engine\\Core\\Events\\EventBus;
    use Zone\\Engine\\Core\\Game\\RankAndSkillTreeService;

    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $rpg = new RankAndSkillTreeService($db, $events);

    // Raise founder-player to Level 22 so they have 21 Level SP (2 full branches = 20 SP + 1 SP spare)
    $db->execute("UPDATE players SET level = 22, max_nerve = 60, nerve = 60, max_energy = 150, energy = 150, max_life = 2000, life = 2000 WHERE id = 'founder-player'");

    $rejects = static function (callable $fn): string {
      try { $fn(); return ''; } catch (Throwable $e) { return $e->getMessage(); }
    };

    $s0 = $rpg->snapshot('founder-player');

    // Prerequisite check: cannot unlock silent_footsteps or ghost_protocol out of order!
    $prereqErr1 = $rejects(fn() => $rpg->act('founder-player', 'skillTree.unlock', ['nodeId' => 'silent_footsteps']));
    $prereqErr2 = $rejects(fn() => $rpg->act('founder-player', 'skillTree.unlock', ['nodeId' => 'ghost_protocol']));

    // Unlock full Shadow Mastermind branch (10 SP) + full Warlord Enforcer branch (10 SP) = 20 SP
    foreach (['street_instinct', 'silent_footsteps', 'wiretapper', 'master_burglar', 'nerve_overclock', 'ghost_protocol'] as $nid) {
      $rpg->act('founder-player', 'skillTree.unlock', ['nodeId' => $nid]);
    }
    foreach (['iron_knuckles', 'hollow_point_drill', 'arterial_strike', 'kevlar_weave', 'blood_frenzy', 'executioner'] as $nid) {
      $rpg->act('founder-player', 'skillTree.unlock', ['nodeId' => $nid]);
    }

    $sUnlocked = $rpg->snapshot('founder-player');
    // Only 1 SP left (21 - 20 = 1), so duplicate unlock fails
    $dupUnlockErr = $rejects(fn() => $rpg->act('founder-player', 'skillTree.unlock', ['nodeId' => 'ghost_protocol']));

    // 1st Respec is FREE (0 Points) and reverses +5 max_nerve and +250 max_life!
    $pointsBeforeRespec1 = $sUnlocked['player']['points'];
    $respec1 = $rpg->act('founder-player', 'skillTree.respec');

    // Unlock Bio-Alchemist branch (10 SP, +10 max_energy)
    foreach (['micro_dosing', 'pure_synthesis', 'field_triage', 'endorphin_lock', 'adrenal_surge', 'bio_synthetic'] as $nid) {
      $rpg->act('founder-player', 'skillTree.unlock', ['nodeId' => $nid]);
    }
    $sAlch = $rpg->snapshot('founder-player');

    // Set points = 50 -> 2nd Respec must reject (< 100 Points), then set points = 150 -> charges 100 Points!
    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['points'] = 50;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);
    $respecNoPtsErr = $rejects(fn() => $rpg->act('founder-player', 'skillTree.respec'));

    $row = $db->fetchOne("SELECT state_json FROM player_progression WHERE player_id = 'founder-player'");
    $st = json_decode($row['state_json'], true);
    $st['points'] = 150;
    $db->execute("UPDATE player_progression SET state_json = :s WHERE player_id = 'founder-player'", ['s' => json_encode($st)]);
    $respec2 = $rpg->act('founder-player', 'skillTree.respec');

    // Train Working Stats via 10 Energy (man) and 5 Job Points (int)
    $trainEnergy = $rpg->act('founder-player', 'workStats.train', ['stat' => 'man', 'costType' => 'energy']);
    $trainJobPts = $rpg->act('founder-player', 'workStats.train', ['stat' => 'int', 'costType' => 'jobPts']);

    echo json_encode([
      'branchCount' => count($s0['skillTree']['branches']),
      'totalNodesCount' => $s0['skillTree']['totalNodesCount'],
      'masteryKeys' => array_keys($s0['masterySkills']),
      'prereqErr1' => $prereqErr1,
      'prereqErr2' => $prereqErr2,
      'shadowCrimeBonus' => $sUnlocked['skillTree']['bonuses']['crimeSuccessPct'],
      'shadowStealthBonus' => $sUnlocked['skillTree']['bonuses']['stealthPct'],
      'warlordDmgBonus' => $sUnlocked['skillTree']['bonuses']['combatDamagePct'],
      'warlordMugBonus' => $sUnlocked['skillTree']['bonuses']['mugPlunderPct'],
      'maxNerveAfterUnlock' => $sUnlocked['player']['max_nerve'], // 60 + 5 = 65
      'maxLifeAfterUnlock' => $sUnlocked['player']['max_life'],   // 2000 + 250 = 2250
      'spentSp20' => $sUnlocked['skillTree']['spentSp'],
      'availableSp1' => $sUnlocked['skillTree']['availableSp'],
      'hasRankAlias' => isset($sUnlocked['rank']['breakdown']['level']) && isset($sUnlocked['skillTree']['unlockedNodes']['ghost_protocol']),
      'dupUnlockErr' => $dupUnlockErr,
      'respec1Cost' => $respec1['result']['pointsCost'],
      'respecCountAfter1' => $respec1['skillTree']['respecCount'],
      'pointsUnchangedOnFree' => $respec1['player']['points'] === $pointsBeforeRespec1,
      'maxNerveRestored' => $respec1['player']['max_nerve'],
      'maxLifeRestored' => $respec1['player']['max_life'],
      'alchOdReduction' => $sAlch['skillTree']['bonuses']['odRiskReductionPct'],
      'alchMedHeal' => $sAlch['skillTree']['bonuses']['medHealPct'],
      'alchReviveSave' => $sAlch['skillTree']['bonuses']['reviveEnergyReduction'],
      'alchMaxEnergy' => $sAlch['player']['max_energy'], // 150 + 10 = 160
      'respecNoPtsErr' => $respecNoPtsErr,
      'respec2Cost' => $respec2['result']['pointsCost'],
      'pointsAfterRespec2' => $respec2['player']['points'], // 150 - 100 = 50
      'maxEnergyRestored' => $respec2['player']['max_energy'], // 150
      'trainEnergySpent' => $trainEnergy['result']['energySpent'],
      'trainManVal' => $trainEnergy['workStats']['man'],
      'trainJobPtsSpent' => $trainJobPts['result']['jobPtsSpent'],
      'trainIntVal' => $trainJobPts['workStats']['int'],
    ], JSON_THROW_ON_ERROR);
  `);

  assert.equal(res.branchCount, 4);
  assert.equal(res.totalNodesCount, 24);
  assert.deepEqual(res.masteryKeys, [
    'hunting', 'racing', 'reviving', 'busting', 'smuggling', 'forging', 'hacking', 'weapon_mastery', 'crime_mastery',
  ]);
  assert.match(res.prereqErr1, /Unlock prerequisite node/i);
  assert.match(res.prereqErr2, /Unlock prerequisite node/i);
  assert.equal(res.shadowCrimeBonus, 15);
  assert.equal(res.shadowStealthBonus, 20);
  assert.equal(res.warlordDmgBonus, 18);
  assert.equal(res.warlordMugBonus, 15);
  assert.equal(res.maxNerveAfterUnlock, 65);
  assert.equal(res.maxLifeAfterUnlock, 2250);
  assert.equal(res.spentSp20, 20);
  assert.equal(res.availableSp1, 1);
  assert.equal(res.hasRankAlias, true);
  assert.match(res.dupUnlockErr, /already unlocked/i);
  assert.equal(res.respec1Cost, 0);
  assert.equal(res.respecCountAfter1, 1);
  assert.equal(res.pointsUnchangedOnFree, true);
  assert.equal(res.maxNerveRestored, 60);
  assert.equal(res.maxLifeRestored, 2000);
  assert.equal(res.alchOdReduction, 35);
  assert.equal(res.alchMedHeal, 20);
  assert.equal(res.alchReviveSave, 5);
  assert.equal(res.alchMaxEnergy, 160);
  assert.match(res.respecNoPtsErr, /Need 100 Points/i);
  assert.equal(res.respec2Cost, 100);
  assert.equal(res.pointsAfterRespec2, 50);
  assert.equal(res.maxEnergyRestored, 150);
  assert.equal(res.trainEnergySpent, 10);
  assert.ok(res.trainManVal >= 12);
  assert.equal(res.trainJobPtsSpent, 5);
  assert.ok(res.trainIntVal >= 12);
});

test('v149 RPG Core PHP files maintain 100% PostgreSQL 16 SQL compatibility (zero 2-arg MIN/MAX or duplicate named placeholders)', () => {
  const files = [
    'engine/src/Core/Game/LevelingService.php',
    'engine/src/Core/Game/StoryCampaignService.php',
    'engine/src/Core/Game/RankAndSkillTreeService.php',
  ];

  for (const rel of files) {
    const src = readFileSync(resolve(root, rel), 'utf8');
    // Match SQL strings starting with SELECT / UPDATE / INSERT / DELETE
    const sqlMatches = [...src.matchAll(/['"]((?:SELECT|UPDATE|INSERT|DELETE)\b[^'"]*)['"]/gi)];
    for (const m of sqlMatches) {
      const sql = m[1];
      assert.doesNotMatch(sql, /\b(?:MIN|MAX)\s*\([^,)]+,/i, `2-arg SQLite MIN/MAX forbidden in ${rel}: ${sql}`);
      const params = [...sql.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(p => p[1]);
      const unique = new Set(params);
      assert.equal(params.length, unique.size, `Duplicate named placeholder forbidden in ${rel}: ${sql}`);
    }
  }
});
