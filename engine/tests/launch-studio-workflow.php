<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Application\GameEngine;
use Zone\Engine\Core\Content\GameplayDefinitionValidator;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CombatService;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;
use Zone\Engine\Core\Themes\ThemeRegistry;
use Zone\Engine\Infrastructure\Cache\ArrayCacheStore;

// No inherited production URL, external cache, owner grants or edited balances.
// This file-backed disposable database also proves a fresh engine connection.
$path = ZONE_ENGINE_ROOT . '/var/launch-studio-' . bin2hex(random_bytes(8)) . '.sqlite';
$url = 'sqlite:' . $path;
$passed = 0;
function studioProof(bool $ok, string $label): void {
    global $passed;
    if (!$ok) throw new RuntimeException('FAIL: ' . $label);
    $passed++; echo 'PASS: ' . $label . PHP_EOL;
}
function studioRejected(callable $action, string $message): void {
    try { $action(); }
    catch (InvalidArgumentException|RuntimeException $error) { studioProof(str_contains($error->getMessage(), $message), 'server rejects: ' . $message); return; }
    throw new RuntimeException('FAIL: expected server rejection: ' . $message);
}
function studioWorld(string $url): array {
    $database = Database::connect($url); $database->migrateAndSeed();
    $events = new EventBus($database);
    $modules = new ModuleRegistry($database, $events, ZONE_ENGINE_ROOT . '/modules');
    $themes = new ThemeRegistry($database, ZONE_ENGINE_ROOT . '/themes');
    $modules->discoverAndBoot(); $themes->discover();
    return [new GameEngine($database, $events, $modules, $themes, new ReleaseManager($database, $events), new ArrayCacheStore()), $database, $events];
}
function studioPlayerHistory(Database $database, array $players): array {
    return [
        'ledger' => array_values(array_filter($database->fetchAll('SELECT * FROM economy_ledger ORDER BY id'), static fn (array $row): bool => in_array($row['player_id'], $players, true))),
        'events' => array_values(array_filter($database->fetchAll('SELECT * FROM event_log ORDER BY id'), static fn (array $row): bool => in_array(json_decode($row['payload_json'], true, 64, JSON_THROW_ON_ERROR)['playerId'] ?? '', $players, true))),
    ];
}
function studioBuyAndEquip(GameEngine $engine, string $player, int $price): array {
    $before = $engine->gameplay($player);
    $bought = $engine->gameplayAction('item.buy', 'studio-baton', $before['state']['version'], $player);
    studioProof($bought['result']['cashDelta'] === -$price && $bought['player']['cash'] === $before['player']['cash'] - $price && $bought['state']['inv']['studio-baton'] === 1, 'ordinary player acquires authored weapon for the published server price ' . $price);
    $equipped = $engine->gameplayAction('item.equip', 'studio-baton', $bought['state']['version'], $player);
    studioProof($equipped['state']['equip'] === 'studio-baton', 'ordinary player equips the same authored item ID');
    return $bought;
}
function studioStartCombat(Database $database, EventBus $events, string $player, float $multiplier): array {
    $combat = new CombatService($database, $events);
    $before = $combat->snapshot($player);
    $combat->act('start', 'dockside-rookie', '', $before['version'], $player);
    $stored = json_decode($database->fetchOne('SELECT state_json FROM combat_encounters WHERE player_id = :id', ['id' => $player])['state_json'], true, 64, JSON_THROW_ON_ERROR);
    studioProof((float) $stored['encounter']['weaponMultiplier'] === $multiplier, 'server combat snapshots the authored damage multiplier ' . $multiplier);
    return $stored;
}

try {
    [$engine, $db, $events] = studioWorld($url);
    $initialRelease = $engine->publishRelease('isolated-studio-operator');
    $sessionA = $engine->browserSessions()->create('isolated-studio-player-a');
    $playerA = $engine->browserSessions()->resolve($sessionA['token']);
    $beforeA = $engine->gameplay($playerA);
    studioProof($playerA !== 'founder-player' && $beforeA['player']['level'] === 1 && $beforeA['player']['cash'] === 2500 && !isset($beforeA['state']['inv']['studio-baton']), 'fresh ordinary player starts with real novice resources, not owner playtest grants');

    $item = ['type' => 'weapon', 'price' => 321, 'mult' => 2.75, 'name' => ['en' => 'Studio baton', 'ar' => 'عصا الاستوديو'], 'description' => ['en' => 'A fitted baton for dockside training.', 'ar' => 'عصا مناسبة للتدريب قرب الميناء.'], 'image' => 'assets/weapons/thumbnails/bat.png', 'model' => 'bat'];
    studioProof(is_file(ZONE_REPOSITORY_ROOT . '/' . $item['image']) && filesize(ZONE_REPOSITORY_ROOT . '/' . $item['image']) > 0, 'selected baton thumbnail is a nonempty shipped image, not an invented upload');
    $draftCatalog = $engine->createGameplayCatalog('items', 'studio-baton', $item, $engine->adminGameplayCatalog()['revision'], 'isolated-studio-operator');
    studioProof($draftCatalog['catalogs']['items']['studio-baton'] === $item, 'save retains English, Arabic, shipped image and registered fitted model in the draft');
    studioRejected(fn () => GameplayDefinitionValidator::definition('items', [...$item, 'model' => 'https://invalid.example/baton.glb'], true), 'Unknown model');
    $crime = ['name_en' => 'Studio dock search', 'name_ar' => 'تفتيش ميناء الاستوديو', 'nerve_cost' => 1, 'success_basis_points' => 10000, 'cash_min' => 77, 'cash_max' => 77, 'xp_reward' => 0, 'level_required' => 1, 'enabled' => true];
    $savedCrime = $engine->saveCrime('studio-dock-search', $crime, 'isolated-studio-operator');
    studioProof($savedCrime['name_en'] === $crime['name_en'] && $savedCrime['name_ar'] === $crime['name_ar'] && $savedCrime['successRate'] === 100, 'crime save retains both languages and canonical server probability');
    $gatedCrime = [...$crime, 'name_en' => 'Experienced dock search', 'name_ar' => 'تفتيش الميناء للخبراء', 'level_required' => 7];
    $engine->saveCrime('studio-level-gate', $gatedCrime, 'isolated-studio-operator');
    $editedGate = $engine->saveCrime('studio-level-gate', [...$gatedCrime, 'cash_min' => 88, 'cash_max' => 88], 'isolated-studio-operator');
    studioProof($editedGate['level_required'] === 7 && $editedGate['cash_max'] === 88, 'crime reward edit with the corrected Studio payload preserves its server level prerequisite');
    studioProof(!isset($engine->gameBootstrap()['content']['gameplayCatalog']['items']['studio-baton']) && !in_array('studio-dock-search', array_column($engine->crimes(), 'id'), true), 'both drafts remain absent from public bootstrap and crime catalog');
    studioRejected(fn () => $engine->gameplayAction('item.buy', 'studio-baton', $engine->gameplay($playerA)['state']['version'], $playerA), 'Unknown item');
    studioRejected(fn () => $engine->attemptCrime('studio-dock-search', $playerA), 'Unknown crime');

    // Match the existing Studio's manifestWithRuntimeContent save contract.
    // This proves data available to preview, not rendered/browser acceptance.
    $draft = $engine->releaseDraft(); $preview = $draft['manifest'];
    $preview['content']['gameplayCatalog'] = $engine->adminGameplayCatalog()['catalogs'];
    $preview['content']['crimes'] = $engine->adminCrimes();
    $engine->saveReleaseDraft($preview, 'isolated-studio-operator', $draft['draftFingerprint']);
    $previewed = $engine->releaseDraft()['manifest'];
    studioProof($previewed['content']['gameplayCatalog']['items']['studio-baton']['name']['ar'] === $item['name']['ar'] && $previewed['content']['gameplayCatalog']['items']['studio-baton']['model'] === 'bat' && in_array('studio-dock-search', array_column($previewed['content']['crimes'], 'id'), true), 'saved preview manifest includes real draft definitions and selected media');
    studioProof($engine->activeRelease()['id'] === $initialRelease['id'] && !isset($engine->gameplay($playerA)['catalogs']['items']['studio-baton']), 'preview save does not publish or alter the ordinary player catalog');
    $releaseOne = $engine->publishRelease('isolated-studio-operator', $engine->releaseDraft()['draftFingerprint']);
    studioProof($releaseOne['version'] === $initialRelease['version'] + 1 && $releaseOne['publishedBy'] === 'isolated-studio-operator', 'publish creates an attributable immutable content release');

    // Reload through a new database connection before a normal player uses it.
    [$engine, $db, $events] = studioWorld($url);
    studioProof($engine->browserSessions()->resolve($sessionA['token']) === $playerA && $engine->activeRelease()['id'] === $releaseOne['id'], 'ordinary session and published identity survive a fresh engine connection');
    $beforeGate = $db->fetchOne('SELECT cash, nerve FROM players WHERE id = :id', ['id' => $playerA]);
    studioRejected(fn () => $engine->attemptCrime('studio-level-gate', $playerA), 'level 7');
    studioProof($db->fetchOne('SELECT cash, nerve FROM players WHERE id = :id', ['id' => $playerA]) === $beforeGate, 'published preserved level gate rejects the novice without spending nerve or awarding cash');
    $crimeOne = $engine->attemptCrime('studio-dock-search', $playerA);
    $crimeReceipt = $db->fetchOne("SELECT amount FROM economy_ledger WHERE player_id = :player AND reason = 'crime.reward' AND correlation_id = :id", ['player' => $playerA, 'id' => $crimeOne['serverProof']['correlationId']]);
    $loginReceipt = $db->fetchAll("SELECT amount FROM economy_ledger WHERE player_id = :player AND reason = 'streak.reward'", ['player' => $playerA]);
    studioProof($crimeOne['success'] && $crimeOne['reward']['cash'] === 77 && $crimeOne['cost']['nerve'] === 1 && (int) $crimeReceipt['amount'] === 77, 'published crime pays exact configured cash and consumes real nerve');
    studioProof(count($loginReceipt) === 1 && (int) $loginReceipt[0]['amount'] === 1000 && $crimeOne['player']['cash'] === $beforeA['player']['cash'] + 77 + 1000, 'first-action login reward is separately recorded and is not mistaken for the authored crime payout');
    $buyOne = studioBuyAndEquip($engine, $playerA, 321);
    $fightOne = studioStartCombat($db, $events, $playerA, 2.75);
    $purchaseLedger = $db->fetchAll('SELECT * FROM economy_ledger WHERE correlation_id = :id ORDER BY asset', ['id' => $buyOne['result']['correlationId']]);
    studioProof(count($purchaseLedger) === 2 && $purchaseLedger[0]['asset'] === 'cash' && (int) $purchaseLedger[0]['amount'] === -321 && $purchaseLedger[1]['asset'] === 'item:studio-baton' && (int) $purchaseLedger[1]['amount'] === 1, 'item receipt and cash debit share one real economic correlation');

    $engine->saveGameplayCatalog('items', 'studio-baton', ['price' => 429, 'mult' => 3.25, 'name' => ['en' => 'Revised studio baton', 'ar' => 'عصا الاستوديو المعدلة']], $engine->adminGameplayCatalog()['revision'], 'isolated-studio-operator');
    $engine->saveCrime('studio-dock-search', [...$crime, 'cash_min' => 123, 'cash_max' => 123], 'isolated-studio-operator');
    studioProof($engine->gameplay($playerA)['catalogs']['items']['studio-baton']['price'] === 321 && array_values(array_filter($engine->crimes(), static fn (array $row): bool => $row['id'] === 'studio-dock-search'))[0]['cash_min'] === 77, 'saved reward and price edits do not leak before a second publish');
    $releaseTwo = $engine->publishRelease('isolated-studio-operator', $engine->releaseDraft()['draftFingerprint']);
    $sessionB = $engine->browserSessions()->create('isolated-studio-player-b');
    $playerB = $engine->browserSessions()->resolve($sessionB['token']);
    studioProof($playerB !== $playerA && $engine->gameplay($playerB)['player']['cash'] === 2500, 'second actual player session is distinct with no owner grants');
    $crimeTwo = $engine->attemptCrime('studio-dock-search', $playerB);
    studioProof($crimeTwo['reward']['cash'] === 123, 'newly published crime revision uses its revised reward');
    studioBuyAndEquip($engine, $playerB, 429);
    $fightTwo = studioStartCombat($db, $events, $playerB, 3.25);
    $historyBefore = studioPlayerHistory($db, [$playerA, $playerB]);
    $engine->activateRelease($releaseOne['id'], 'isolated-studio-operator');
    studioProof(studioPlayerHistory($db, [$playerA, $playerB]) === $historyBefore, 'content rollback preserves every existing player ledger and event row byte-for-byte');
    studioProof($engine->activeRelease()['id'] === $releaseOne['id'] && $engine->gameplay($playerB)['catalogs']['items']['studio-baton']['price'] === 321 && $engine->gameplay($playerB)['catalogs']['items']['studio-baton']['name']['ar'] === 'عصا الاستوديو', 'rollback restores prior exact price and bilingual definitions');
    studioProof($engine->gameplay($playerA)['state']['inv']['studio-baton'] === 1 && $engine->gameplay($playerB)['state']['inv']['studio-baton'] === 1 && $engine->gameplay($playerB)['state']['equip'] === 'studio-baton', 'rollback does not erase either player inventory or equipped identity');
    $storedOne = json_decode($db->fetchOne('SELECT state_json FROM combat_encounters WHERE player_id = :id', ['id' => $playerA])['state_json'], true, 64, JSON_THROW_ON_ERROR);
    $storedTwo = json_decode($db->fetchOne('SELECT state_json FROM combat_encounters WHERE player_id = :id', ['id' => $playerB])['state_json'], true, 64, JSON_THROW_ON_ERROR);
    studioProof($storedOne === $fightOne && $storedTwo === $fightTwo, 'release changes and rollback do not retroactively rewrite already-started combat rules');
    [$engine, $db, $events] = studioWorld($url);
    studioProof($engine->activeRelease()['id'] === $releaseOne['id'] && studioPlayerHistory($db, [$playerA, $playerB]) === $historyBefore && $engine->gameplay($playerB)['state']['inv']['studio-baton'] === 1, 'fresh connection retains rollback, complete history and acquired inventory');
    $sessionC = $engine->browserSessions()->create('isolated-studio-player-c');
    $playerC = $engine->browserSessions()->resolve($sessionC['token']);
    studioProof($engine->attemptCrime('studio-dock-search', $playerC)['reward']['cash'] === 77, 'new normal gameplay after rollback executes the restored crime reward');
    studioBuyAndEquip($engine, $playerC, 321);
    $operatorAudit = array_filter($engine->adminAuditLog(250), static fn (array $row): bool => $row['actor'] === 'isolated-studio-operator');
    studioProof(count(array_filter($operatorAudit, static fn (array $row): bool => $row['action'] === 'ReleasePublished')) === 3 && count(array_filter($operatorAudit, static fn (array $row): bool => $row['action'] === 'ReleaseActivated' && $row['target_id'] === $releaseOne['id'])) === 1, 'publish and rollback retain attributable operator release audit history');
    studioProof(count($engine->releaseHistory()) === 3 && isset($engine->adminGameplayCatalog()['catalogs']['items']['studio-baton']) && $engine->adminGameplayCatalog()['catalogs']['items']['studio-baton']['price'] === 429, 'rollback preserves newer release and draft for deliberate review/republication');
    echo 'CAPABILITY LIMIT: registered shipped image/model selection, not arbitrary upload. Browser rendering and PostgreSQL are separate gates.' . PHP_EOL;
    echo 'CAPABILITY GAP: action history currently lacks an immutable content-release identity; correlations and saved release history are retained, but are not a rules-version stamp.' . PHP_EOL;
    echo 'DISPOSABLE DATABASE: ' . $path . PHP_EOL;
    echo 'LAUNCH STUDIO RESULT: ' . $passed . ' passed, 0 failed (file-backed sqlite)' . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL . $error->getTraceAsString() . PHP_EOL);
    fwrite(STDERR, 'DISPOSABLE DATABASE: ' . $path . PHP_EOL);
    exit(1);
}
