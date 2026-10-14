<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Application\GameEngine;
use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\ProgressionService;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;
use Zone\Engine\Core\Themes\ThemeRegistry;
use Zone\Engine\Infrastructure\Cache\ArrayCacheStore;

$passed = 0;
function hardeningProof(bool $ok, string $label): void
{
    global $passed;
    if (!$ok) throw new RuntimeException('FAIL: ' . $label);
    $passed++;
    echo 'PASS: ' . $label . PHP_EOL;
}
function hardeningReject(callable $action, string $message): bool
{
    try { $action(); }
    catch (RuntimeException|InvalidArgumentException $error) { return $error->getMessage() === $message; }
    return false;
}
function receipts(Database $db, string $correlation): array
{
    return $db->fetchAll('SELECT asset, amount, balance_after, reason FROM economy_ledger WHERE correlation_id = :id ORDER BY asset', ['id' => $correlation]);
}
function savedPlayerState(Database $db): array
{
    return [
        $db->fetchOne("SELECT cash, nerve, life FROM players WHERE id = 'founder-player'"),
        $db->fetchOne("SELECT state_json, version FROM player_progression WHERE player_id = 'founder-player'"),
        $db->fetchOne('SELECT COUNT(*) AS total FROM economy_ledger'),
        $db->fetchOne('SELECT COUNT(*) AS total FROM event_log'),
    ];
}

try {
    $db = Database::connect('sqlite::memory:');
    $db->migrateAndSeed();
    $events = new EventBus($db);
    $modules = new ModuleRegistry($db, $events, ZONE_ENGINE_ROOT . '/modules');
    $themes = new ThemeRegistry($db, ZONE_ENGINE_ROOT . '/themes');
    $releases = new ReleaseManager($db, $events);
    $modules->discoverAndBoot();
    $themes->discover();
    $engine = new GameEngine($db, $events, $modules, $themes, $releases, new ArrayCacheStore());
    $progress = new ProgressionService($db, $events);
    $initial = $progress->snapshot('founder-player');

    $buy = $progress->act('item.buy', 'drink', $initial['state']['version'], 'founder-player');
    $receipt = receipts($db, $buy['result']['correlationId']);
    hardeningProof(count($receipt) === 2 && $receipt[0]['asset'] === 'cash' && (int) $receipt[0]['amount'] === -990 && $receipt[1]['asset'] === 'item:drink' && (int) $receipt[1]['amount'] === 1 && (int) $receipt[1]['balance_after'] === $buy['state']['inv']['drink'], 'purchase records exact cash debit and unit grant under one correlation');
    $cashBefore = $buy['player']['cash'];
    $ledgerBefore = $db->fetchOne('SELECT COUNT(*) AS total FROM economy_ledger');
    hardeningProof(hardeningReject(fn () => $progress->act('item.buy', 'drink', $initial['state']['version'], 'founder-player'), 'Progression state changed. Refresh and try again.'), 'stale purchase cannot repeat a wallet or inventory settlement');
    hardeningProof($db->fetchOne('SELECT COUNT(*) AS total FROM economy_ledger') === $ledgerBefore && $progress->snapshot('founder-player')['player']['cash'] === $cashBefore, 'stale purchase emits no additional receipts');

    $market = $progress->act('market.buy', 'drink', $buy['state']['version'], 'founder-player', 990);
    $receipt = receipts($db, $market['result']['correlationId']);
    hardeningProof(count($receipt) === 2 && $receipt[1]['asset'] === 'item:drink' && $receipt[1]['reason'] === 'market.buy' && (int) $receipt[1]['amount'] === 1, 'merchant purchase traces the same unit grant with merchant provenance');

    $sell = $progress->act('item.sell', 'bat', $market['state']['version'], 'founder-player');
    $receipt = receipts($db, $sell['result']['correlationId']);
    hardeningProof(count($receipt) === 2 && (int) $receipt[0]['amount'] === $sell['result']['cashDelta'] && $receipt[1]['asset'] === 'item:bat' && (int) $receipt[1]['amount'] === -1 && (int) $receipt[1]['balance_after'] === 0, 'sale traces the cash credit and removal of the last owned unit');
    hardeningProof($sell['state']['equip'] === null, 'last-unit sale still clears equipped ownership');

    $db->execute("UPDATE players SET nerve = 1 WHERE id = 'founder-player'");
    $use = $progress->act('item.use', 'drink', $sell['state']['version'], 'founder-player');
    $receipt = receipts($db, $use['result']['correlationId']);
    hardeningProof(count($receipt) === 1 && $receipt[0]['asset'] === 'item:drink' && (int) $receipt[0]['amount'] === -1 && (int) $receipt[0]['balance_after'] === $use['state']['inv']['drink'] && $use['player']['nerve'] === 5, 'consumption records the unit sink with the authoritative resource effect');
    $db->execute("UPDATE players SET nerve = max_nerve, life = max_life WHERE id = 'founder-player'");
    $before = savedPlayerState($db);
    hardeningProof(hardeningReject(fn () => $progress->act('item.use', 'drink', $use['state']['version'], 'founder-player'), 'Your resources are full. The item has been kept.'), 'ineffective consumable is rejected');
    hardeningProof(savedPlayerState($db) === $before, 'ineffective consumable changes no unit, resource, receipt or version');

    $correlation = bin2hex(random_bytes(16));
    $beforeUnits = $progress->snapshot('founder-player')['state']['inv']['sand'];
    $progress->grantItem('founder-player', 'sand', 3, $correlation, 'crime.loot');
    $receipt = receipts($db, $correlation);
    $event = $db->fetchOne("SELECT payload_json FROM event_log WHERE event_name = 'ItemGranted' ORDER BY occurred_at DESC, id DESC LIMIT 1");
    hardeningProof(count($receipt) === 1 && (int) $receipt[0]['amount'] === 3 && (int) $receipt[0]['balance_after'] === $beforeUnits + 3 && $receipt[0]['reason'] === 'crime.loot', 'trusted grants trace exact units and originating action reason');
    hardeningProof(json_decode($event['payload_json'], true, 64, JSON_THROW_ON_ERROR)['correlationId'] === $correlation, 'grant event and inventory receipt share originating correlation');

    $db->execute("CREATE TRIGGER hardening_fail_item_receipt BEFORE INSERT ON economy_ledger WHEN NEW.asset LIKE 'item:%' BEGIN SELECT RAISE(ABORT, 'inventory receipt fault'); END");
    $before = savedPlayerState($db);
    $version = $progress->snapshot('founder-player')['state']['version'];
    $fault = false;
    try { $progress->act('item.buy', 'drink', $version, 'founder-player'); }
    catch (Throwable $error) { $fault = str_contains($error->getMessage(), 'inventory receipt fault'); }
    hardeningProof($fault && savedPlayerState($db) === $before, 'receipt failure rolls back purchase money, units, stock/version, cash receipt and event');
    $fault = false;
    try { $progress->grantItem('founder-player', 'sand', 2); }
    catch (Throwable $error) { $fault = str_contains($error->getMessage(), 'inventory receipt fault'); }
    hardeningProof($fault && savedPlayerState($db) === $before, 'receipt failure rolls back trusted grant and its event');
    $db->execute('DROP TRIGGER hardening_fail_item_receipt');
    $db->execute("CREATE TRIGGER hardening_fail_item_event BEFORE INSERT ON event_log WHEN NEW.event_name = 'ProgressionAction' BEGIN SELECT RAISE(ABORT, 'inventory event fault'); END");
    $before = savedPlayerState($db);
    $fault = false;
    try { $progress->act('item.sell', 'drink', $version, 'founder-player'); }
    catch (Throwable $error) { $fault = str_contains($error->getMessage(), 'inventory event fault'); }
    hardeningProof($fault && savedPlayerState($db) === $before, 'event failure rolls back sale cash, unit sink and both receipts');
    $db->execute('DROP TRIGGER hardening_fail_item_event');

    $draftA = $engine->releaseDraft();
    $draftB = $engine->releaseDraft();
    hardeningProof(preg_match('/^[a-f0-9]{64}$/D', $draftA['draftFingerprint']) === 1 && $draftA['draftFingerprint'] === $draftB['draftFingerprint'], 'draft response exposes a stable opaque owner-configuration fingerprint');
    $manifestA = $draftA['manifest'];
    $manifestA['brand']['name'] = 'Accepted owner edit';
    $saved = $engine->saveReleaseDraft($manifestA, 'first-owner-tab', $draftA['draftFingerprint']);
    hardeningProof($saved['draftFingerprint'] !== $draftA['draftFingerprint'] && $saved['manifest']['brand']['name'] === 'Accepted owner edit', 'current fingerprint saves a validated draft and returns its new fingerprint');
    $manifestB = $draftB['manifest'];
    $manifestB['brand']['name'] = 'Stale owner edit';
    $beforeAudit = $db->fetchOne('SELECT COUNT(*) AS total FROM admin_audit_log');
    $beforeEvents = $db->fetchOne('SELECT COUNT(*) AS total FROM event_log');
    hardeningProof(hardeningReject(fn () => $engine->saveReleaseDraft($manifestB, 'second-owner-tab', $draftB['draftFingerprint']), 'Release draft changed. Refresh and try again.'), 'stale owner save cannot overwrite another saved edit');
    hardeningProof($engine->releaseDraft()['manifest'] === $saved['manifest'] && $db->fetchOne('SELECT COUNT(*) AS total FROM admin_audit_log') === $beforeAudit && $db->fetchOne('SELECT COUNT(*) AS total FROM event_log') === $beforeEvents, 'stale save writes no draft, audit or event');
    hardeningProof(hardeningReject(fn () => $engine->publishRelease('second-owner-tab', $draftB['draftFingerprint']), 'Release draft changed. Refresh and try again.'), 'stale owner publish cannot publish a configuration it did not review');
    hardeningProof($engine->releaseHistory() === [] && $engine->activeRelease()['id'] === 'foundation-default', 'stale publish changes neither release history nor active pointer');
    foreach (['', 'wrong', str_repeat('F', 64), str_repeat('a', 63)] as $bad) {
        hardeningProof(hardeningReject(fn () => $engine->saveReleaseDraft($manifestB, 'owner', $bad), 'A valid release draft fingerprint is required.'), 'malformed fingerprint rejected before draft mutation');
    }
    $catalog = new GameplayCatalog($db, $events);
    $catalogDraft = $catalog->draft();
    $beforeCatalog = $engine->releaseDraft();
    $catalog->update('items', 'drink', ['price' => 991], $catalogDraft['revision'], 'catalog-owner');
    hardeningProof($engine->releaseDraft()['draftFingerprint'] !== $beforeCatalog['draftFingerprint'] && hardeningReject(fn () => $engine->publishRelease('old-content-tab', $beforeCatalog['draftFingerprint']), 'Release draft changed. Refresh and try again.'), 'concurrent catalog edit invalidates a stale publication preview');
    $beforeModule = $engine->releaseDraft();
    $engine->changeModule('crime', 'disable');
    hardeningProof($engine->releaseDraft()['draftFingerprint'] !== $beforeModule['draftFingerprint'], 'module lifecycle changes invalidate stale owner configuration');
    $beforeTheme = $engine->releaseDraft();
    $engine->activateTheme('terminal');
    hardeningProof($engine->releaseDraft()['draftFingerprint'] !== $beforeTheme['draftFingerprint'], 'theme activation invalidates stale owner configuration');
    $beforeCrime = $engine->releaseDraft();
    $crime = $engine->adminCrimes()[0];
    $engine->saveCrime($crime['id'], [...$crime, 'cash_min' => 0], 'crime-owner');
    hardeningProof($engine->releaseDraft()['draftFingerprint'] !== $beforeCrime['draftFingerprint'], 'crime balance changes invalidate stale owner configuration');
    $beforeGameplay = $engine->releaseDraft();
    $current = $progress->snapshot('founder-player');
    $progress->act('item.buy', 'drink', $current['state']['version'], 'founder-player');
    hardeningProof($engine->releaseDraft()['draftFingerprint'] === $beforeGameplay['draftFingerprint'], 'ordinary gameplay wallet and inventory changes do not invalidate owner drafts');
    $current = $engine->releaseDraft();
    $published = $engine->publishRelease('current-owner-tab', $current['draftFingerprint']);
    hardeningProof($published['version'] === 1 && $published['manifest']['brand']['name'] === 'Accepted owner edit' && $published['manifest']['content']['gameplayCatalog']['items']['drink']['price'] === 991, 'fresh publish activates exactly reviewed owner configuration with catalog rules');
    hardeningProof($engine->releaseDraft()['draftFingerprint'] !== $current['draftFingerprint'], 'publishing returns a new saved content fingerprint so a stale publish cannot replay');
    hardeningProof(hardeningReject(fn () => $engine->publishRelease('replay-owner-tab', $current['draftFingerprint']), 'Release draft changed. Refresh and try again.') && count($engine->releaseHistory()) === 1, 'repeated publish with pre-publication fingerprint cannot create a duplicate release');
    $next = $engine->releaseDraft();
    $second = $engine->publishRelease('current-owner-tab', $next['draftFingerprint']);
    hardeningProof($second['version'] === 2 && $engine->releaseDraft()['draftFingerprint'] !== $next['draftFingerprint'], 'every publication changes its guard even when content and second-resolution timestamps are identical');
    hardeningProof(hardeningReject(fn () => $engine->publishRelease('replay-owner-tab', $next['draftFingerprint']), 'Release draft changed. Refresh and try again.') && count($engine->releaseHistory()) === 2, 'second-release request replay also cannot create a duplicate immutable version');
    $beforeRollback = $engine->releaseDraft();
    $engine->activateRelease($published['id'], 'rollback-owner');
    hardeningProof($engine->releaseDraft()['draftFingerprint'] !== $beforeRollback['draftFingerprint'] && hardeningReject(fn () => $engine->publishRelease('old-active-tab', $beforeRollback['draftFingerprint']), 'Release draft changed. Refresh and try again.'), 'rollback invalidates stale publication guards without changing owner draft content');
    echo 'BETA ENGINE HARDENING RESULT: ' . $passed . ' passed, 0 failed (sqlite::memory:)' . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, $error::class . ': ' . $error->getMessage() . PHP_EOL . $error->getTraceAsString() . PHP_EOL);
    exit(1);
}
