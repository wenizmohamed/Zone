<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Application\GameEngine;
use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Content\GameplayDefinitionValidator;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CombatService;
use Zone\Engine\Core\Game\ProgressionService;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;
use Zone\Engine\Core\Themes\ThemeRegistry;
use Zone\Engine\Infrastructure\Cache\ArrayCacheStore;

$passed = 0; $failed = 0;
function check(bool $condition, string $message): void {
    global $passed, $failed;
    if ($condition) { $passed++; fwrite(STDOUT, 'PASS: ' . $message . "\n"); }
    else { $failed++; fwrite(STDERR, 'FAIL: ' . $message . "\n"); }
}
function rejects(callable $action, string $message): void {
    try { $action(); check(false, $message); } catch (InvalidArgumentException|RuntimeException) { check(true, $message); }
}
try {
    $db = Database::connect('sqlite::memory:'); $db->migrateAndSeed();
    $events = new EventBus($db); $modules = new ModuleRegistry($db, $events, ZONE_ENGINE_ROOT . '/modules');
    $themes = new ThemeRegistry($db, ZONE_ENGINE_ROOT . '/themes'); $releases = new ReleaseManager($db, $events);
    $modules->discoverAndBoot(); $themes->discover();
    $engine = new GameEngine($db, $events, $modules, $themes, $releases, new ArrayCacheStore());
    $catalog = new GameplayCatalog($db, $events); $progress = new ProgressionService($db, $events);
    $baseline = $engine->publishRelease('authoring-test');
    $weapon = ['type' => 'weapon', 'price' => 321, 'mult' => 2.75, 'name' => ['en' => 'Harbor baton', 'ar' => 'عصا الميناء'], 'description' => ['en' => 'A balanced harbor weapon.', 'ar' => 'سلاح متوازن للميناء.'], 'image' => 'art/bio.jpg'];
    putenv('VERCEL=1');
    check(GameplayDefinitionValidator::definition('items', $weapon, true)['image'] === 'art/bio.jpg', 'Vercel validates a shipped image from the private CDN inventory');
    rejects(fn () => GameplayDefinitionValidator::definition('items', [...$weapon, 'image' => 'art/missing-shipped.jpg'], true), 'Vercel rejects an image missing from the shipped CDN inventory');
    rejects(fn () => \Zone\Engine\Core\Content\PackagedAssets::assertImage('art/bio.jpg', ZONE_ENGINE_ROOT . '/config/missing-inventory.json'), 'missing production asset inventory fails closed');
    putenv('VERCEL');
    check(GameplayDefinitionValidator::definition('items', [...$weapon, 'model' => 'knife'], true)['model'] === 'knife', 'authored weapon may reuse an existing fitted licensed 3D model');
    rejects(fn () => GameplayDefinitionValidator::definition('items', [...$weapon, 'model' => 'https://evil.test/model.glb'], true), 'model selection rejects arbitrary asset URLs and unregistered models');
    $created = $catalog->create('items', 'harbor-baton', $weapon, $catalog->draft()['revision'], 'omar');
    check($created['created']['id'] === 'harbor-baton' && $created['catalogs']['items']['harbor-baton'] === $weapon, 'new item saves canonical bilingual text and real image in draft');
    $modelled = $catalog->update('items', 'harbor-baton', ['model' => 'knife'], $catalog->draft()['revision'], 'omar');
    check($modelled['catalogs']['items']['harbor-baton']['model'] === 'knife', 'owner can attach a fitted model after creating a weapon');
    rejects(fn () => $catalog->update('items', 'smallkit', ['model' => 'knife'], $catalog->draft()['revision'], 'omar'), 'consumables cannot receive weapon-only model fields');
    check(!isset($catalog->active()['items']['harbor-baton']), 'new item remains absent from active release before publication');
    rejects(fn () => $progress->act('item.buy', 'harbor-baton', $progress->snapshot('founder-player')['state']['version'], 'founder-player'), 'unpublished item cannot be bought through real progression service');
    $revision = $catalog->draft()['revision']; $auditBefore = count($engine->adminAuditLog());
    rejects(fn () => $catalog->create('items', 'harbor-baton', $weapon, $revision, 'omar'), 'duplicate IDs cannot overwrite an existing draft entry');
    foreach (['bad id', '../evil', 'constructor', '__proto__', 'fists', 'x'] as $id) rejects(fn () => $catalog->create('items', $id, $weapon, $revision, 'omar'), 'invalid or reserved ID rejected: ' . $id);
    rejects(fn () => $catalog->create('items', 'stale-baton', $weapon, $revision - 1, 'omar'), 'stale admin revision cannot add content');
    foreach ([['mult' => INF], ['price' => -1], ['price' => '321'], ['mult' => 21], ['image' => 'javascript:alert(1)'], ['image' => 'art/../engine/bootstrap.php'], ['image' => 'art/no-such-art.jpg'], ['name' => ['en' => '<script>', 'ar' => 'اسم']], ['type' => 'armor', 'red' => .2], ['script' => 'alert(1)']] as $invalid) rejects(fn () => $catalog->create('items', 'invalid-baton', [...$weapon, ...$invalid], $revision, 'omar'), 'unsafe definition is rejected: ' . implode(',', array_keys($invalid)));
    check($catalog->draft()['revision'] === $revision && count($engine->adminAuditLog()) === $auditBefore, 'failed creations change neither revision nor audit log');
    $create = function (string $category, string $id, array $definition) use ($catalog): void { $catalog->create($category, $id, $definition, $catalog->draft()['revision'], 'omar'); };
    $create('missions', 'harbor-supply', ['ctr' => 'buys', 'n' => 1, 'cash' => 77, 'pts' => 3, 'name' => ['en' => 'Harbor supply', 'ar' => 'إمدادات الميناء']]);
    $create('courses', 'harbor-navigation', ['cost' => 123, 'mins' => 1, 'name' => ['en' => 'Harbor navigation', 'ar' => 'ملاحة الميناء']]);
    $create('properties', 'harbor-home', ['price' => 432, 'happy' => 777, 'name' => ['en' => 'Harbor home', 'ar' => 'منزل الميناء']]);
    $create('jobs', 'harbor-worker', ['pay' => 246, 'energy' => 5, 'lvl' => 1, 'name' => ['en' => 'Harbor worker', 'ar' => 'عامل الميناء']]);
    $create('opponents', 'harbor-guard', ['lvl' => 1, 'str' => 2, 'def' => 3, 'spd' => 4, 'dex' => 5, 'life' => 6, 'cash' => 7, 'name' => ['en' => 'Harbor guard', 'ar' => 'حارس الميناء']]);
    rejects(fn () => $catalog->create('missions', 'bad-counter', ['ctr' => 'clientWins', 'n' => 1, 'cash' => 0, 'pts' => 0, 'name' => ['en' => 'Invalid counter', 'ar' => 'عداد غير صالح']], $catalog->draft()['revision'], 'omar'), 'new missions cannot reference invented client counters');
    rejects(fn () => $catalog->create('courses', 'missing-duration', ['cost' => 1, 'name' => ['en' => 'Missing duration', 'ar' => 'مدة مفقودة']], $catalog->draft()['revision'], 'omar'), 'new courses require a typed server duration');
    rejects(fn () => $catalog->update('missions', 'harbor-supply', ['ctr' => 'wins'], $catalog->draft()['revision'], 'omar'), 'mission counter is immutable after creation');
    rejects(fn () => $catalog->update('items', 'harbor-baton', ['type' => 'material'], $catalog->draft()['revision'], 'omar'), 'item type is immutable after creation');
    check(GameplayDefinitionValidator::catalog($catalog->draft()['catalogs']) === $catalog->draft()['catalogs'], 'complete authored catalog passes typed release validation');
    $invalidManifest = $engine->releaseDraft()['manifest']; $invalidManifest['content']['gameplayCatalog'] = $catalog->draft()['catalogs'];
    $invalidManifest['content']['gameplayCatalog']['items']['harbor-baton']['price'] = -99;
    rejects(fn () => $engine->saveReleaseDraft($invalidManifest, 'omar'), 'release manifest rejects unsafe gameplay math outside the authoring route');
    $release = $engine->publishRelease('omar');
    check(isset($engine->gameBootstrap()['content']['gameplayCatalog']['items']['harbor-baton']) && $release['version'] === $baseline['version'] + 1, 'existing publish workflow exposes genuinely new definitions in game bootstrap');
    $snapshot = $progress->snapshot('founder-player'); $initialCash = $snapshot['player']['cash'];
    $bought = $progress->act('item.buy', 'harbor-baton', $snapshot['state']['version'], 'founder-player');
    check($bought['state']['inv']['harbor-baton'] === 1 && $bought['player']['cash'] === $initialCash - 321, 'server buys new item at authored price and persists inventory');
    rejects(fn () => $progress->act('item.sell', 'harbor-baton', $snapshot['state']['version'], 'founder-player'), 'new content actions retain stale player-state rejection');
    $equipped = $progress->act('item.equip', 'harbor-baton', $bought['state']['version'], 'founder-player');
    $mission = $progress->act('mission.claim', 'harbor-supply', $equipped['state']['version'], 'founder-player');
    check($mission['result']['cashDelta'] === 77 && $mission['state']['claimed']['harbor-supply'] === 1 && $mission['state']['points'] === $equipped['state']['points'] + 3, 'new mission enforces real counter and grants server rewards once');
    rejects(fn () => $progress->act('mission.claim', 'harbor-supply', $mission['state']['version'], 'founder-player'), 'new mission rejects duplicate reward claims');
    $course = $progress->act('course.enroll', 'harbor-navigation', $mission['state']['version'], 'founder-player');
    check($course['state']['edu']['id'] === 'harbor-navigation' && $course['state']['edu']['total'] === 60000 && $course['result']['cashDelta'] === -123, 'new course uses server enrollment cost and real duration');
    $property = $progress->act('property.buy', 'harbor-home', $course['state']['version'], 'founder-player');
    check($property['state']['prop'] === 'harbor-home' && $property['player']['max_happy'] === 777 && $property['result']['cashDelta'] === -432, 'new property sets authored server happiness cap and purchase cost');
    $job = $progress->act('job.take', 'harbor-worker', $property['state']['version'], 'founder-player');
    check($job['state']['job'] === 'harbor-worker', 'new job is accepted by real server level rules');
    $combat = new CombatService($db, $events); $fight = $combat->act('start', 'harbor-guard', '', $combat->snapshot('founder-player')['version'], 'founder-player');
    $storedFight = json_decode($db->fetchOne("SELECT state_json FROM combat_encounters WHERE player_id = 'founder-player'")['state_json'], true, 64, JSON_THROW_ON_ERROR);
    check($fight['encounter']['opponentId'] === 'harbor-guard' && $fight['encounter']['enemyMaxHp'] === 6 && $storedFight['encounter']['weaponMultiplier'] === 2.75, 'new NPC and equipped new weapon enter real server combat');
    $audits = $db->fetchAll("SELECT * FROM admin_audit_log WHERE action = 'GameplayCatalogCreated'");
    check(count($audits) === 6 && count(array_filter($audits, static fn (array $entry): bool => $entry['actor'] === 'omar' && strlen($entry['correlation_id']) === 32)) === 6, 'every created definition has attributable immutable audit correlation');
    $ledger = $db->fetchAll("SELECT * FROM economy_ledger WHERE asset = 'cash' AND reason IN ('item.buy','mission.claim','course.enroll','property.buy')");
    check(count($ledger) === 4, 'authored content actions preserve economy ledger contract');
    $itemReceipt = $db->fetchAll("SELECT * FROM economy_ledger WHERE asset = 'item:harbor-baton' AND correlation_id = :id", ['id' => $bought['result']['correlationId']]);
    check(count($itemReceipt) === 1 && (int) $itemReceipt[0]['amount'] === 1 && (int) $itemReceipt[0]['balance_after'] === 1, 'authored item purchase correlates its unit receipt with its cash debit');
    $releases->activate($baseline['id'], 'omar');
    check(!isset($catalog->active()['items']['harbor-baton']) && isset($catalog->draft()['catalogs']['items']['harbor-baton']), 'rollback restores prior live catalog while keeping authored draft');
    $rolledBack = $progress->snapshot('founder-player');
    check(($rolledBack['state']['inv']['harbor-baton'] ?? 0) === 1 && ($rolledBack['state']['ownedProperties']['harbor-home'] ?? 0) === 1 && isset($rolledBack['state']['claimed']['harbor-supply']), 'rollback preserves new inventory, owned property and claimed mission progress');
    $releases->activate($release['id'], 'omar');
    $restored = $progress->snapshot('founder-player');
    check($restored['player']['max_happy'] === 777 && isset($restored['catalogs']['items']['harbor-baton']), 'reactivating authored release restores catalog and owned-property rule');
} catch (Throwable $exception) { $failed++; fwrite(STDERR, 'FATAL: ' . $exception::class . ': ' . $exception->getMessage() . "\n" . $exception->getTraceAsString() . "\n"); }
fwrite(STDOUT, "\nRESULT: {$passed} passed, {$failed} failed\n");
exit($failed === 0 ? 0 : 1);
