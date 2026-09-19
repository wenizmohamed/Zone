<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Application\GameEngine;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;
use Zone\Engine\Core\Security\AdminSession;
use Zone\Engine\Core\Themes\ThemeRegistry;
use Zone\Engine\Infrastructure\Cache\ArrayCacheStore;

$databasePath = dirname(__DIR__) . '/var/test-' . bin2hex(random_bytes(6)) . '.sqlite';
$passed = 0;
$failed = 0;

function check(bool $condition, string $message): void
{
    global $passed, $failed;
    if (!$condition) {
        $failed++;
        fwrite(STDERR, "FAIL: {$message}\n");
        return;
    }
    $passed++;
    fwrite(STDOUT, "PASS: {$message}\n");
}

function build_engine(string $databasePath): array
{
    $database = Database::connect('sqlite:' . $databasePath);
    $database->migrateAndSeed();
    $events = new EventBus($database);
    $modules = new ModuleRegistry($database, $events, dirname(__DIR__) . '/modules');
    $themes = new ThemeRegistry($database, dirname(__DIR__) . '/themes');
    $releases = new ReleaseManager($database, $events);
    $modules->discoverAndBoot();
    $themes->discover();
    return [new GameEngine($database, $events, $modules, $themes, $releases, new ArrayCacheStore()), $database];
}

try {
    putenv('ZONE_ADMIN_USERNAME=omar');
    putenv('ZONE_ADMIN_PASSWORD_HASH=' . password_hash('production-test-password', PASSWORD_ARGON2ID));
    putenv('ZONE_ADMIN_SESSION_SECRET=zone-test-session-secret-at-least-thirty-two-characters');
    check(AdminSession::credentialsConfigured(), 'admin authentication requires an explicit username, password hash, and session secret');
    $adminToken = AdminSession::issueTokenForTest('omar', time() + 600, 'csrf-test-token');
    $decodedAdmin = AdminSession::decodeTokenForTest($adminToken);
    check($decodedAdmin !== null && $decodedAdmin['username'] === 'omar' && $decodedAdmin['csrf'] === 'csrf-test-token', 'signed admin session tokens preserve authenticated identity and CSRF state');
    check(AdminSession::decodeTokenForTest($adminToken . 'tampered') === null, 'tampered admin session tokens are rejected');

    [$engine, $database] = build_engine($databasePath);
    $status = $engine->status();
    check(version_compare(PHP_VERSION, '8.5.0', '>='), 'runtime is PHP 8.5 or newer');
    check($status['serverAuthoritative'] === true, 'engine reports server-authoritative execution');
    check($status['database'] === 'sqlite', 'local test adapter is SQLite');
    check($status['cacheAdapter'] === 'memory' && $status['redisPortReady'] === true, 'cache port runs in memory and exposes a Redis production adapter');
    check(count($engine->modules()) === 2, 'two independent modules discovered from manifests');
    check(count($engine->themes()) === 2, 'two independent themes discovered from manifests');
    check(count($engine->crimes()) === 3, 'Crime module exposes its catalog');
    check(count($engine->adminCrimes()) === 3, 'admin content service exposes enabled and disabled crime definitions');

    $createdCrime = $engine->saveCrime('dockyard-run', [
        'name_en' => 'Dockyard run',
        'name_ar' => 'عملية الميناء',
        'nerve_cost' => 8,
        'success_basis_points' => 6400,
        'cash_min' => 900,
        'cash_max' => 1900,
        'xp_reward' => 35,
        'enabled' => true,
    ], 'content-test');
    check($createdCrime['id'] === 'dockyard-run' && (float) $createdCrime['successRate'] === 64.0, 'admin creates a typed crime definition');
    check(count($engine->crimes()) === 4, 'enabled admin-created crime appears in the public engine catalog');
    $disabledCrime = $engine->saveCrime('dockyard-run', [...$createdCrime, 'enabled' => false], 'content-test');
    check($disabledCrime['enabled'] === false && count($engine->crimes()) === 3, 'admin can disable a crime without deleting its definition');
    check(count($engine->adminCrimes()) === 4, 'disabled crime remains available to the administrator');
    $crimeAudit = array_values(array_filter($engine->adminAuditLog(), static fn (array $entry): bool => $entry['target_type'] === 'crime'));
    $crimeAuditActions = array_column($crimeAudit, 'action');
    check(count($crimeAudit) === 2 && in_array('CrimeCreated', $crimeAuditActions, true) && in_array('CrimeUpdated', $crimeAuditActions, true), 'crime creation and update are preserved in the admin audit trail');
    $invalidCrimeRejected = false;
    try {
        $engine->saveCrime('bad crime', ['enabled' => true], 'content-test');
    } catch (InvalidArgumentException) {
        $invalidCrimeRejected = true;
    }
    check($invalidCrimeRejected, 'crime editor rejects invalid identifiers and incomplete definitions');

    $engine->changeModule('achievements', 'disable');
    [$engine, $database] = build_engine($databasePath);
    $database->execute('UPDATE crimes SET success_basis_points = 10000 WHERE id = :id', ['id' => 'pickpocket']);
    $first = $engine->attemptCrime('pickpocket');
    check($first['success'] === true, 'crime outcome is calculated by the PHP engine');
    check($first['serverProof']['clientSuppliedOutcomeFields'] === 0, 'client cannot supply outcome or reward fields');
    check(count($engine->ledger()) === 1, 'successful reward creates one economy ledger entry');
    check(count($engine->achievements()) === 0, 'disabled Achievement module does not react');

    $engine->changeModule('achievements', 'enable');
    [$engine, $database] = build_engine($databasePath);
    $database->execute('UPDATE crimes SET success_basis_points = 10000 WHERE id = :id', ['id' => 'pickpocket']);
    $second = $engine->attemptCrime('pickpocket');
    check($second['success'] === true, 'second server-authoritative crime succeeds under controlled test odds');
    check(count($engine->achievements()) === 1, 'enabled Achievement module reacts through CrimeSucceeded hook');
    $eventNames = array_column($engine->eventLog(), 'event_name');
    check(in_array('CrimeSucceeded', $eventNames, true), 'CrimeSucceeded event is persisted');
    check(in_array('AchievementUnlocked', $eventNames, true), 'subscriber publishes AchievementUnlocked without core edits');

    $engine->changeModule('crime', 'uninstall');
    [$engine] = build_engine($databasePath);
    check($engine->crimes() === [], 'uninstalled Crime module removes its API capability');
    $blocked = false;
    try {
        $engine->attemptCrime('pickpocket');
    } catch (RuntimeException) {
        $blocked = true;
    }
    check($blocked, 'disabled module action is rejected by the engine');
    $engine->changeModule('crime', 'install');

    $activated = $engine->activateTheme('terminal');
    check($activated['active'] === true, 'theme activates without changing gameplay code');
    check(str_contains($engine->activeThemeStylesheet(), '#42e8e0'), 'active theme stylesheet is resolved from its package');

    $releases = new ReleaseManager($database, new EventBus($database));
    $draft = $releases->draft();
    check($draft['manifest']['schemaVersion'] === 1, 'release manager creates a schema version 1 draft');
    $activeBeforePublish = $releases->active();
    check($activeBeforePublish['version'] === 0, 'unpublished engine exposes the immutable initial release');

    $invalidDraft = $draft['manifest'];
    $invalidDraft['pages'][] = [
        'id' => 'unsafe',
        'slug' => 'unsafe',
        'enabled' => true,
        'title' => ['en' => 'Unsafe', 'ar' => 'غير آمن'],
        'blocks' => [['id' => 'bad-block', 'type' => 'script', 'content' => ['en' => 'alert(1)', 'ar' => 'alert(1)']]],
    ];
    $invalidRejected = false;
    try {
        $releases->saveDraft($invalidDraft, 'test-admin');
    } catch (InvalidArgumentException) {
        $invalidRejected = true;
    }
    check($invalidRejected, 'release manager rejects unregistered builder block types');

    $firstDraft = $draft['manifest'];
    $firstDraft['branding']['name']['en'] = 'ZONE Alpha';
    $firstDraft['branding']['accent'] = '#9ed629';
    $releases->saveDraft($firstDraft, 'test-admin');
    check($releases->active()['manifest']['branding']['name']['en'] !== 'ZONE Alpha', 'saving a draft does not mutate the active game release');

    $releaseOne = $releases->publish('test-admin');
    check($releaseOne['version'] === 1, 'first publish creates release version 1');
    check($releases->active()['manifest']['branding']['name']['en'] === 'ZONE Alpha', 'published manifest becomes active');

    $secondDraft = $releaseOne['manifest'];
    $secondDraft['branding']['name']['en'] = 'ZONE Bravo';
    $releases->saveDraft($secondDraft, 'test-admin');
    $releaseTwo = $releases->publish('test-admin');
    check($releaseTwo['version'] === 2, 'second publish creates release version 2');
    check(count($releases->releases()) === 2, 'release history retains immutable versions');

    $restored = $releases->activate($releaseOne['id'], 'test-admin');
    check($restored['version'] === 1 && $releases->active()['version'] === 1, 'activating a prior release rolls the game back without deleting history');
    check(count($database->fetchAll("SELECT * FROM admin_audit_log WHERE target_type IN ('content-draft', 'content-release')")) === 5, 'draft and release mutations are recorded in the admin audit log');

    $applicationDraft = $engine->releaseDraft();
    $applicationActive = $engine->activeRelease();
    $applicationDraft['manifest']['branding']['name']['en'] = 'ZONE Application';
    $engine->saveReleaseDraft($applicationDraft['manifest'], 'application-test');
    check($engine->activeRelease()['id'] === $applicationActive['id'], 'application draft save preserves the active release');
    $applicationRelease = $engine->publishRelease('application-test');
    check($applicationRelease['version'] === 3, 'application layer publishes the next immutable release');
    check($engine->activeRelease()['manifest']['branding']['name']['en'] === 'ZONE Application', 'application layer exposes the newly active manifest');
    $engine->activateRelease($releaseOne['id'], 'application-test');
    check($engine->activeRelease()['version'] === 1, 'application layer can activate a prior release');
    check(count($engine->releaseHistory()) === 3, 'application layer exposes complete release history');

    $schema = (string) file_get_contents(dirname(__DIR__) . '/database/schema.postgresql.sql');
    foreach (['economy_ledger', 'event_log', 'jobs', 'notifications', 'assets', 'content_drafts', 'content_releases', 'admin_audit_log'] as $table) {
        check(str_contains($schema, "CREATE TABLE IF NOT EXISTS {$table}"), "PostgreSQL schema contains {$table}");
    }
} catch (Throwable $exception) {
    $failed++;
    fwrite(STDERR, 'FATAL: ' . $exception::class . ': ' . $exception->getMessage() . "\n" . $exception->getTraceAsString() . "\n");
} finally {
    foreach (glob($databasePath . '*') ?: [] as $file) {
        @unlink($file);
    }
}

fwrite(STDOUT, "\nRESULT: {$passed} passed, {$failed} failed\n");
exit($failed === 0 ? 0 : 1);
