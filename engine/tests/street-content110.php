<?php

declare(strict_types=1);

namespace Zone\Engine\Application {
    // Deterministic branch coverage in this test process only. Production PHP
    // and the separate browser/router process retain their real random rolls.
    function random_int(int $minimum, int $maximum): int
    {
        $queue = &$GLOBALS['street110Rolls'];
        if (!is_array($queue) || $queue === []) return \random_int($minimum, $maximum);
        $value = array_shift($queue);
        if ($value < $minimum || $value > $maximum) throw new \RuntimeException('Invalid deterministic street110 test roll.');
        return $value;
    }
}

namespace {
    require dirname(__DIR__) . '/bootstrap.php';

    use Zone\Engine\Core\Persistence\Database;

    // No environment-supplied database URL is accepted. Every run creates an
    // independently named SQLite database below the repository's test area.
    $url = 'sqlite:' . ZONE_ENGINE_ROOT . '/var/street-content110-' . bin2hex(random_bytes(6)) . '.sqlite';
    $engine = zone_engine($url);
    $db = Database::connect($url);
    // Fast rule tests, not claims about real-world timing or rendered journeys.
    $db->execute('UPDATE cooldown_config SET seconds=0');
    $engine = zone_engine($url);
    $pack = json_decode(file_get_contents(ZONE_ENGINE_ROOT . '/data/content-packs/street-foundations110.json'), true, 512, JSON_THROW_ON_ERROR);
    $passed = 0;

    function streetProof(bool $valid, string $label): void {
        global $passed;
        if (!$valid) throw new RuntimeException('FAIL: ' . $label);
        $passed++; echo 'PASS: ' . $label . PHP_EOL;
    }
    function streetReject(callable $callback): bool {
        try { $callback(); } catch (RuntimeException|InvalidArgumentException) { return true; }
        return false;
    }
    function streetAct(string $player, string $action, string $id): array {
        global $engine;
        return $engine->gameplayAction($action, $id, $engine->gameplay($player)['state']['version'], $player);
    }
    function streetAttempt(string $player, string $crime, array $rolls): array {
        global $engine;
        $GLOBALS['street110Rolls'] = $rolls;
        $result = $engine->attemptCrime($crime, $player);
        streetProof($GLOBALS['street110Rolls'] === [], 'actual crime consumes the expected server-rule random branches: ' . $crime);
        return $result;
    }
    function streetStored(string $player): array {
        global $db;
        return [
            $db->fetchOne('SELECT cash,bank_balance,level,xp,nerve,life FROM players WHERE id=:id', ['id' => $player]),
            $db->fetchOne('SELECT version,state_json FROM player_progression WHERE player_id=:id', ['id' => $player]),
            $db->fetchAll('SELECT asset,amount,balance_after,reason FROM economy_ledger WHERE player_id=:id ORDER BY id', ['id' => $player]),
        ];
    }
    function streetDefinitions(array $crimes): array {
        $result = [];
        foreach ($crimes as $crime) $result[$crime['id']] = $crime;
        return $result;
    }

    $actor = $engine->browserSessions()->create('street110-' . bin2hex(random_bytes(7)))['playerId'];
    $initial = $engine->gameplay($actor);
    $before = streetStored($actor);
    $original = $engine->activeRelease();
    $legacyCrimes = streetDefinitions($original['manifest']['content']['crimes']);
    $legacyCatalog = $original['manifest']['content']['gameplayCatalog'];
    streetProof(count($legacyCrimes) === 31 && $initial['player']['cash'] === 2500 && $initial['player']['level'] === 1 && $initial['state']['inv'] === ['smallkit' => 1], 'fresh ordinary novice and all 31 legacy routes form the baseline');

    foreach ([...$pack['items'], ...$pack['materialIssuanceCandidate']['items']] as $id => $definition) {
        $engine->createGameplayCatalog('items', $id, $definition, $engine->adminGameplayCatalog()['revision'], 'street110-isolation');
    }
    foreach ($pack['crimes'] as $id => $definition) $engine->saveCrime($id, $definition, 'street110-isolation');
    foreach ($pack['crimePatches'] as $id => $patch) $engine->saveCrime($id, $patch, 'street110-isolation');
    $catalog = $engine->adminGameplayCatalog();
    $engine->saveShopCatalog([...$catalog['catalogs']['market'], ...$pack['marketAdditions']], $catalog['revision'], 'street110-isolation');
    streetProof($engine->activeRelease()['id'] === $original['id'] && count($engine->crimes()) === 31 && streetStored($actor) === $before, 'draft additions do not leak or reset an existing ordinary account');

    $draft = $engine->releaseDraft();
    $release = $engine->publishRelease('street110-isolation', $draft['draftFingerprint']);
    $candidate = streetDefinitions($release['manifest']['content']['crimes']);
    foreach ($legacyCrimes as $id => $old) {
        $next = $candidate[$id];
        foreach (array_keys($pack['crimePatches'][$id] ?? []) as $field) { unset($old[$field], $next[$field]); }
        streetProof($old === $next, 'legacy route retained except its exact proposed chain patch: ' . $id);
    }
    foreach (['smallkit', 'medkit', 'pills'] as $id) streetProof($legacyCatalog['items'][$id] === $release['manifest']['content']['gameplayCatalog']['items'][$id], 'legacy full-clear medicine preserved: ' . $id);
    streetProof(array_slice($release['manifest']['content']['gameplayCatalog']['market'], 0, count($legacyCatalog['market'])) === $legacyCatalog['market'], 'all existing NPC shop rows and prices retained');
    streetProof(count($engine->crimes()) === 34 && streetStored($actor) === $before, 'deliberate isolated publication adds three jobs without changing saved player data');
    streetProof(!isset($release['manifest']['worldPolicy']['materialItemIds']), 'creating cheap material alone does not opt into a future loot policy');

    streetProof(streetReject(fn () => $engine->attemptCrime('dockside-collection', $actor)) && streetStored($actor) === $before, 'missing bat rejects without resource or economic settlement');
    streetAct($actor, 'item.buy', 'bat');
    streetAct($actor, 'item.buy', 'clinic-wrap');
    streetAct($actor, 'item.buy', 'street-trauma-pack');
    $supplies = $engine->gameplay($actor);
    streetProof($supplies['player']['cash'] === 1100 && $supplies['state']['inv']['bat'] === 1 && ($supplies['state']['equip'] ?? 'fists') !== 'bat', 'ordinary purchases charge exact candidate prices and leave bat unequipped');
    $noEffect = streetStored($actor);
    streetProof(streetReject(fn () => streetAct($actor, 'item.use', 'clinic-wrap')) && streetStored($actor) === $noEffect, 'timer-only medicine with no effect retains its owned unit');
    $locked = streetStored($actor);
    streetProof(streetReject(fn () => $engine->attemptCrime('canal-crate', $actor)) && streetStored($actor) === $locked, 'level-two optional route does not bypass novice access gates');

    $first = streetAttempt($actor, 'dockside-collection', [1, 260]);
    $second = streetAttempt($actor, 'dockside-collection', [1, 260]);
    streetProof($first['reward']['cash'] === 260 && $second['reward']['cash'] === 261 && $second['chainBonusBasisPoints'] === 50 && $second['mastery'] === 4 && $second['tool']['consumed'] === 0, 'owned unequipped bat earns configured mastery and the exact second-success chain bonus');
    $failed = streetAttempt($actor, 'dockside-collection', [10000, 1]);
    streetProof($failed['outcome'] === 'critical_failure' && $failed['reward']['cash'] === 0 && $failed['penalty']['type'] === 'jail' && $failed['penalty']['seconds'] === 60 && $engine->gameplay($actor)['state']['inv']['bat'] === 1, 'actual bat rules jail on the critical branch and never consume the weapon');
    $jailed = streetStored($actor);
    streetProof(streetReject(fn () => streetAct($actor, 'item.use', 'clinic-wrap')) && streetStored($actor) === $jailed, 'hospital-timer medicine cannot release jail');
    streetAct($actor, 'jail.bailSelf', 'self');

    $attempts = 0;
    while ($engine->gameplay($actor)['player']['level'] < 2 && $attempts++ < 18) streetAttempt($actor, 'searchforcash', [1, 160, 100]);
    streetProof($engine->gameplay($actor)['player']['level'] >= 2, 'ordinary accepted starter actions reach level two without staff XP or balance provisioning');
    streetAct($actor, 'item.buy', 'knife');
    $hospital = streetAttempt($actor, 'canal-crate', [10000, 1]);
    $hospitalState = $engine->gameplay($actor);
    streetProof($hospital['penalty']['type'] === 'hosp' && $hospital['penalty']['seconds'] === 120 && $hospitalState['state']['inv']['knife'] === 1, 'actual knife route applies its own hospital consequence and retains the knife');
    $until = $hospitalState['state']['hospUntil'];
    $wrap = streetAct($actor, 'item.use', 'clinic-wrap');
    streetProof($wrap['result']['hospitalSecondsReduced'] === 60 && $wrap['state']['hospUntil'] === $until - 60000 && $wrap['player']['life'] === $hospitalState['player']['life'], 'Clinic Wrap cuts exactly sixty seconds and restores no Life');
    $packResult = streetAct($actor, 'item.use', 'street-trauma-pack');
    streetProof($packResult['state']['hospUntil'] === 0 && $packResult['result']['hospitalSecondsReduced'] <= 60 && $packResult['state']['inv']['clinic-wrap'] === 0 && $packResult['state']['inv']['street-trauma-pack'] === 0, 'bounded trauma recovery consumes actual supplies and does not create negative hospital time');

    $sand = $legacyCatalog['items']['sand']['price'];
    $freight = $pack['crimes']['freight-decoy'];
    streetProof($freight['cash_max'] <= round($sand * .92) && $freight['chain_bonus_basis_points'] === 0 && $freight['consume_tool'] === true, 'sand-converter maximum never exceeds the currently cheapest discounted buy price');
    streetProof($pack['materialIssuanceCandidate']['items']['copper-scrap']['price'] === 40 && (int) round(40 * .9) === 36 && $pack['materialIssuanceCandidate']['worldPolicyPatch']['findValueBudgetPerHour'] === 360, 'separate cheap-material proposal has a recorded ten-unit hourly World value ceiling');
    $reopened = zone_engine($url)->gameplay($actor);
    streetProof($reopened['state']['inv'] === $packResult['state']['inv'] && $reopened['player']['cash'] === $packResult['player']['cash'] && $reopened['player']['level'] >= 2, 'return construction preserves real purchases, earned levels, recovery and remaining balance');

    echo "street-content110: {$passed} passed, 0 failed. Isolated SQLite, deterministic branch rolls, zero test cooldowns; no production or browser claim." . PHP_EOL;
}
