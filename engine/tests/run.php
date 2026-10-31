<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Application\GameEngine;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CooldownException;
use Zone\Engine\Core\Game\CooldownService;
use Zone\Engine\Core\Game\LevelingService;
use Zone\Engine\Core\Game\RateLimiter;
use Zone\Engine\Core\Game\RateLimitException;
use Zone\Engine\Core\Game\ResourceService;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;
use Zone\Engine\Core\Security\RequestGuard;
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
    [$engine, $database] = build_engine($databasePath);
    $status = $engine->status();
    check(version_compare(PHP_VERSION, '8.5.0', '>='), 'runtime is PHP 8.5 or newer');
    check($status['serverAuthoritative'] === true, 'engine reports server-authoritative execution');
    check($status['database'] === 'sqlite', 'local test adapter is SQLite');
    check($status['cacheAdapter'] === 'memory' && $status['redisPortReady'] === true, 'cache port runs in memory and exposes a Redis production adapter');
    check(count($engine->modules()) >= 27, 'all ported OpenPBBG modules discovered from manifests (>=27)');
    check(count($engine->themes()) === 2, 'two independent themes discovered from manifests');
    check(count($engine->crimes()) === 31, 'Crime module exposes its catalog');
    check(count($engine->adminCrimes()) === 31, 'admin content service exposes enabled and disabled crime definitions');

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
    check(count($engine->crimes()) === 31, 'unpublished admin-created crime stays outside the public engine catalog');
    $disabledCrime = $engine->saveCrime('dockyard-run', [...$createdCrime, 'enabled' => false], 'content-test');
    check($disabledCrime['enabled'] === false && count($engine->crimes()) === 31, 'admin can disable a crime without deleting its definition');
    check(count($engine->adminCrimes()) === 32, 'disabled crime remains available to the administrator');
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
    $database->execute('UPDATE crimes SET success_basis_points = 10000 WHERE id = :id', ['id' => 'searchforcash']);
    $engine->publishRelease('fixture');
    [$engine, $database] = build_engine($databasePath);
    $first = $engine->attemptCrime('searchforcash');
    check($first['success'] === true, 'crime outcome is calculated by the PHP engine');
    check($first['serverProof']['clientSuppliedOutcomeFields'] === 0, 'client cannot supply outcome or reward fields');
    check(count(array_filter($engine->ledger(), static fn (array $entry): bool => $entry['asset'] === 'cash')) === 1, 'successful reward creates one cash economy ledger entry');
    $lootLedger = $database->fetchAll("SELECT amount, reason FROM economy_ledger WHERE asset = 'item:sand' AND correlation_id = :id", ['id' => $first['serverProof']['correlationId']]);
    check($first['loot'] === null ? $lootLedger === [] : (count($lootLedger) === 1 && (int) $lootLedger[0]['amount'] === 1 && $lootLedger[0]['reason'] === 'crime.loot'), 'crime loot records its inventory provenance under the action correlation only when awarded');
    check(count($engine->achievements()) === 0, 'disabled Achievement module does not react');

    $engine->changeModule('achievements', 'enable');
    $engine->publishRelease('fixture');
    [$engine, $database] = build_engine($databasePath);
    $database->execute('UPDATE crimes SET success_basis_points = 10000 WHERE id = :id', ['id' => 'searchforcash']);
    // Reset the anti-hammer cooldown armed by the first attempt: this back-to-back
    // call exists to exercise the achievement subscriber, not the cooldown gate.
    $database->execute('DELETE FROM action_cooldowns WHERE player_id = :id', ['id' => 'founder-player']);
    $second = $engine->attemptCrime('searchforcash');
    check($second['success'] === true, 'second server-authoritative crime succeeds under controlled test odds');
    check(count($engine->achievements()) === 1, 'enabled Achievement module reacts through CrimeSucceeded hook');
    $eventNames = array_column($engine->eventLog(100), 'event_name');
    check(in_array('CrimeSucceeded', $eventNames, true), 'CrimeSucceeded event is persisted');
    check(in_array('AchievementUnlocked', $eventNames, true), 'subscriber publishes AchievementUnlocked without core edits');

    $engine->changeModule('crime', 'uninstall');
    $engine->publishRelease('fixture');
    [$engine] = build_engine($databasePath);
    check($engine->crimes() === [], 'uninstalled Crime module removes its API capability');
    $blocked = false;
    try {
        $engine->attemptCrime('searchforcash');
    } catch (RuntimeException) {
        $blocked = true;
    }
    check($blocked, 'disabled module action is rejected by the engine');
    $engine->changeModule('crime', 'install');

    $activated = $engine->activateTheme('terminal');
    check($activated['active'] === true, 'theme selection updates the admin draft');
    check(!str_contains($engine->activeThemeStylesheet(), '#42e8e0'), 'unpublished theme selection preserves active CSS');
    $engine->publishRelease('fixture');
    check(str_contains($engine->activeThemeStylesheet(), '#42e8e0'), 'active theme stylesheet is resolved from its package');

    $releases = new ReleaseManager($database, new EventBus($database));
    $draft = $releases->draft();
    check($draft['manifest']['schemaVersion'] === 1, 'release manager creates a schema version 1 draft');
    $activeBeforePublish = $releases->active();
    check($activeBeforePublish['version'] === 4, 'fixture publishes precede release manager tests');
    $auditBefore = count($database->fetchAll("SELECT * FROM admin_audit_log WHERE target_type IN ('content-draft', 'content-release')"));

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
    check($releaseOne['version'] === 5, 'publish creates the next version after fixture releases');
    check($releases->active()['manifest']['branding']['name']['en'] === 'ZONE Alpha', 'published manifest becomes active');

    $secondDraft = $releaseOne['manifest'];
    $secondDraft['branding']['name']['en'] = 'ZONE Bravo';
    $releases->saveDraft($secondDraft, 'test-admin');
    $releaseTwo = $releases->publish('test-admin');
    check($releaseTwo['version'] === 6, 'second publication increments the release version');
    check(count($releases->releases()) === 6, 'release history retains immutable versions');

    $restored = $releases->activate($releaseOne['id'], 'test-admin');
    check($restored['version'] === 5 && $releases->active()['version'] === 5, 'activating a prior release rolls the game back without deleting history');
    check(count($database->fetchAll("SELECT * FROM admin_audit_log WHERE target_type IN ('content-draft', 'content-release')")) === $auditBefore + 5, 'draft and release mutations are recorded in the admin audit log');

    $applicationDraft = $engine->releaseDraft();
    $applicationActive = $engine->activeRelease();
    $applicationDraft['manifest']['branding']['name']['en'] = 'ZONE Application';
    $engine->saveReleaseDraft($applicationDraft['manifest'], 'application-test');
    check($engine->activeRelease()['id'] === $applicationActive['id'], 'application draft save preserves the active release');
    $applicationRelease = $engine->publishRelease('application-test');
    check($applicationRelease['version'] === 7, 'application layer publishes the next immutable release');
    check($engine->activeRelease()['manifest']['branding']['name']['en'] === 'ZONE Application', 'application layer exposes the newly active manifest');
    check(count($applicationRelease['manifest']['content']['crimes']) === 32, 'published release snapshots the complete admin crime catalogue');
    check(count($applicationRelease['manifest']['content']['engineModules']) >= 27, 'published release snapshots the full ported module state (>=27)');
    $bootstrap = $engine->gameBootstrap();
    check($bootstrap['release']['id'] === $applicationRelease['id'] && count($bootstrap['content']['crimes']) === 32, 'game bootstrap exposes the active published content snapshot');
    $engine->activateRelease($releaseOne['id'], 'application-test');
    check($engine->activeRelease()['version'] === 5, 'application layer can activate a prior release');
    check(count($engine->releaseHistory()) === 7, 'application layer exposes complete release history');

    // --- Ported gameplay systems: server-authoritative, ledger + events ---
    [$engine, $database] = build_engine($databasePath);
    $before = $engine->player();
    $gym = $engine->trainGym('strength', 1);
    check($gym['player']['strength'] > $before['strength'], 'gym training increases strength server-side');
    check($gym['player']['energy'] === $before['energy'] - 5, 'gym training spends its selected gym cost of 5 energy per session');
    check(in_array('GymTrained', array_column($engine->eventLog(100), 'event_name'), true), 'GymTrained event is persisted');

    [$engine, $database] = build_engine($databasePath);
    $p0 = $engine->player();
    $totalBefore = (int) $p0['cash'] + (int) $p0['bank_balance'];
    $dep = $engine->bankDeposit(10000);
    check($dep['player']['bank_balance'] === (int) $p0['bank_balance'] + 10000, 'bank deposit credits the bank balance');
    check($dep['player']['cash'] === (int) $p0['cash'] - 10000, 'bank deposit debits cash on hand');
    $wd = $engine->bankWithdraw(4000);
    $totalAfter = (int) $wd['player']['cash'] + (int) $wd['player']['bank_balance'];
    check($totalBefore === $totalAfter, 'bank transfers conserve total wealth');
    $overdrawn = false;
    try { $engine->bankWithdraw(999999999); } catch (RuntimeException) { $overdrawn = true; }
    check($overdrawn, 'bank rejects withdrawing more than the balance');

    [$engine, $database] = build_engine($databasePath);
    $database->execute('UPDATE players SET life = 100 WHERE id = :id', ['id' => 'founder-player']);
    $heal = $engine->hospitalHeal();
    check($heal['player']['life'] === $heal['player']['max_life'], 'hospital restores life to maximum');
    check($heal['cost']['cash'] > 0, 'hospital charges for treatment');
    check(in_array('HospitalHealed', array_column($engine->eventLog(100), 'event_name'), true), 'HospitalHealed event is persisted');

    [$engine, $database] = build_engine($databasePath);
    $t0 = $engine->player();
    $trip = $engine->travel('Dubai');
    check($trip['player']['city'] === $t0['city'] && $trip['travel']['status'] === 'traveling', 'travel keeps the origin city until server-clock arrival');
    check($trip['player']['cash'] === (int) $t0['cash'] - 2500, 'travel charges the fare');
    $badCity = false;
    try { $engine->travel('Atlantis'); } catch (RuntimeException) { $badCity = true; }
    check($badCity, 'travel rejects an unknown destination');
    $database->execute('UPDATE player_travel SET arrives_at = :past WHERE player_id = :id', ['past' => gmdate('c', time() - 1), 'id' => 'founder-player']);
    check($engine->player()['city'] === 'Dubai', 'arrival settles the destination through a fresh player read');

    [$engine, $database] = build_engine($databasePath);
    $c0 = (int) $engine->player()['cash'];
    $bj = $engine->playBlackjack(1000);
    check(in_array($bj['result'], ['win', 'lose', 'push'], true), 'blackjack returns a server-decided result');
    $expected = $c0 + $bj['delta'];
    check((int) $bj['player']['cash'] === $expected, 'blackjack settles cash by the server-decided delta');
    check(in_array('BlackjackPlayed', array_column($engine->eventLog(100), 'event_name'), true), 'BlackjackPlayed event is persisted');

    [$engine, $database] = build_engine($databasePath);
    $engine->changeModule('stats', 'disable');
    $engine->publishRelease('fixture');
    [$engine] = build_engine($databasePath);
    $gymBlocked = false;
    try { $engine->trainGym('strength', 1); } catch (RuntimeException) { $gymBlocked = true; }
    check($gymBlocked, 'disabling the Stats module blocks gym training');

    [$engine, $database] = build_engine($databasePath);
    $j0 = $engine->player();
    $job = $engine->workShift();
    check($job['player']['energy'] === $j0['energy'] - 15, 'job shift spends the selected grocer job cost of 15 energy');
    check($job['reward']['cash'] > 0, 'job shift pays the selected job wage');
    check($job['player']['cash'] === (int) $j0['cash'] + $job['reward']['cash'], 'job wage credits cash on hand');
    check($job['player']['xp'] > (int) $j0['xp'], 'job shift grants experience');
    check(in_array('JobShiftWorked', array_column($engine->eventLog(100), 'event_name'), true), 'JobShiftWorked event is persisted');
    check(count(array_filter($engine->ledger(), static fn (array $e): bool => $e['reason'] === 'job.wage')) === 1, 'job wage writes a job.wage ledger entry');
    $jobBroke = false;
    $database->execute('UPDATE players SET energy = 5 WHERE id = :id', ['id' => 'founder-player']);
    // Clear the job cooldown from the successful shift above so this rejection is
    // driven by the energy gate under test, not the cooldown.
    $database->execute('DELETE FROM action_cooldowns WHERE player_id = :id', ['id' => 'founder-player']);
    try { $engine->workShift(); } catch (RuntimeException) { $jobBroke = true; }
    check($jobBroke, 'job shift is rejected without enough energy');

    // --- ATTACK: server rolls win/lose from player stats, gated on the 'kill' module ---
    [$engine, $database] = build_engine($databasePath);
    // Overwhelming stats force the server roll to a guaranteed win (mirrors the crime 100% test).
    $database->execute('UPDATE players SET strength = 1000000000, speed = 1000000000, dexterity = 1000000000, energy = 150 WHERE id = :id', ['id' => 'founder-player']);
    $a0 = $engine->player();
    $atk = $engine->attackNpc();
    check(in_array($atk['result'], ['win', 'lose'], true), 'attack returns a server-decided result');
    check($atk['player']['energy'] === $a0['energy'] - 25, 'attack spends exactly 25 energy');
    check($atk['serverProof']['clientSuppliedOutcomeFields'] === 0, 'client cannot supply attack outcome or reward fields');
    check($atk['result'] === 'win', 'overwhelming combat stats guarantee a server-rolled win');
    check($atk['player']['cash'] === (int) $a0['cash'] + $atk['reward']['cash'], 'winning attack settles cash by the server-decided mug reward');
    check($atk['reward']['cash'] > 0 && $atk['player']['xp'] > (int) $a0['xp'], 'winning attack grants cash and xp');
    check(in_array('PlayerAttacked', array_column($engine->eventLog(100), 'event_name'), true), 'PlayerAttacked event is persisted');
    check(count(array_filter($engine->ledger(), static fn (array $e): bool => $e['reason'] === 'attack.mug')) === 1, 'winning attack writes an attack.mug ledger entry');

    [$engine, $database] = build_engine($databasePath);
    $engine->changeModule('kill', 'disable');
    $engine->publishRelease('fixture');
    [$engine] = build_engine($databasePath);
    $attackBlocked = false;
    try { $engine->attackNpc(); } catch (RuntimeException) { $attackBlocked = true; }
    check($attackBlocked, 'disabling the Attack/Kill module blocks attacks');
    $engine->changeModule('kill', 'install');
    $engine->changeModule('stats', 'enable');
    $engine->publishRelease('fixture');

    // ============================================================
    // SECURITY HARDENING (P0-1 admin auth, P0-2 player identity,
    // P0-3 server-clock cooldowns + rate limits, strict input validation)
    // ============================================================

    // --- P0-1: admin/mutation routes are no longer publicly writable ---
    $publiclyWritable = true;
    try {
        // Tokenless client with NO Origin header (curl/bot/server-to-server).
        RequestGuard::authorizeAdmin([], null);
    } catch (RuntimeException) {
        $publiclyWritable = false;
    }
    check(!$publiclyWritable, 'EXPLOIT CLOSED: header-less client can no longer write to admin routes');
    check(
        RequestGuard::authorizeAdmin(['HTTP_ORIGIN' => 'https://zone.example', 'HTTP_HOST' => 'zone.example', 'HTTPS' => 'on'], null) === 'admin-panel',
        'demo mode still allows the same-origin admin panel (browser sends Origin)',
    );
    $crossOriginBlocked = false;
    try {
        RequestGuard::authorizeAdmin(['HTTP_ORIGIN' => 'https://evil.example', 'HTTP_HOST' => 'zone.example'], null);
    } catch (RuntimeException) {
        $crossOriginBlocked = true;
    }
    check($crossOriginBlocked, 'demo mode rejects a cross-origin admin request');
    foreach ([
        'different port' => ['HTTP_ORIGIN' => 'http://127.0.0.1:4286', 'HTTP_HOST' => '127.0.0.1:4285'],
        'different scheme' => ['HTTP_ORIGIN' => 'https://zone.example', 'HTTP_HOST' => 'zone.example'],
        'forged forwarding header' => ['HTTP_ORIGIN' => 'https://zone.example', 'HTTP_HOST' => 'zone.example', 'HTTP_X_FORWARDED_PROTO' => 'https'],
        'origin credentials' => ['HTTP_ORIGIN' => 'http://user@zone.example', 'HTTP_HOST' => 'zone.example'],
        'origin path' => ['HTTP_ORIGIN' => 'http://zone.example/path', 'HTTP_HOST' => 'zone.example'],
        'null origin' => ['HTTP_ORIGIN' => 'null', 'HTTP_HOST' => 'zone.example'],
    ] as $reason => $request) {
        $rejected = false;
        try { RequestGuard::authorizeAdmin($request, null); } catch (RuntimeException) { $rejected = true; }
        check($rejected, 'same-origin guard rejects ' . $reason);
    }
    foreach ([
        'local explicit port' => ['HTTP_ORIGIN' => 'http://127.0.0.1:4285', 'HTTP_HOST' => '127.0.0.1:4285'],
        'equivalent default port and host case' => ['HTTP_ORIGIN' => 'https://ZONE.example:443', 'HTTP_HOST' => 'zone.example', 'HTTPS' => 'on'],
        'IPv6 host' => ['HTTP_ORIGIN' => 'http://[::1]:4285', 'HTTP_HOST' => '[::1]:4285'],
    ] as $reason => $request) {
        check(RequestGuard::authorizeAdmin($request, null) === 'admin-panel', 'same-origin guard accepts ' . $reason);
    }
    check(RequestGuard::authorizeAdmin(['HTTP_ORIGIN' => 'https://zone.example', 'HTTP_HOST' => 'zone.example', 'HTTP_X_FORWARDED_PROTO' => 'https'], null, true) === 'admin-panel', 'explicit trusted proxy contract preserves original HTTPS scheme');
    $proxyMismatchBlocked = false;
    try { RequestGuard::authorizeAdmin(['HTTP_ORIGIN' => 'http://zone.example', 'HTTP_HOST' => 'zone.example', 'HTTP_X_FORWARDED_PROTO' => 'https'], null, true); } catch (RuntimeException) { $proxyMismatchBlocked = true; }
    check($proxyMismatchBlocked, 'trusted proxy still rejects a different origin scheme');
    $tokenMissingBlocked = false;
    try {
        RequestGuard::authorizeAdmin(['HTTP_ORIGIN' => 'https://zone.example', 'HTTP_HOST' => 'zone.example'], 'super-secret');
    } catch (RuntimeException) {
        $tokenMissingBlocked = true;
    }
    check($tokenMissingBlocked, 'production mode rejects an admin request with no token even from same origin');
    $wrongTokenBlocked = false;
    try {
        RequestGuard::authorizeAdmin(['HTTP_X_ZONE_ADMIN_TOKEN' => 'nope'], 'super-secret');
    } catch (RuntimeException) {
        $wrongTokenBlocked = true;
    }
    check($wrongTokenBlocked, 'production mode rejects a wrong admin token');
    check(
        RequestGuard::authorizeAdmin(['HTTP_X_ZONE_ADMIN_TOKEN' => 'super-secret'], 'super-secret') === 'admin-token',
        'production mode accepts the correct admin token',
    );

    // --- P0-2: player identity is resolved server-side, not trusted from the header ---
    check(RequestGuard::resolvePlayerId([], null) === 'founder-player', 'demo mode defaults to the demo player when no header is sent');
    check(
        RequestGuard::resolvePlayerId(['HTTP_X_ZONE_PLAYER_ID' => 'founder-player'], null) === 'founder-player',
        'demo mode accepts the demo player id',
    );
    $impersonationBlocked = false;
    try {
        // Attacker sets the header to a victim's id to act as / read their account.
        RequestGuard::resolvePlayerId(['HTTP_X_ZONE_PLAYER_ID' => 'victim-account'], null);
    } catch (RuntimeException) {
        $impersonationBlocked = true;
    }
    check($impersonationBlocked, 'EXPLOIT CLOSED: demo mode blocks assuming another player via X-Zone-Player-Id');
    $secret = 'player-hmac-secret';
    $goodToken = RequestGuard::signPlayer('agent-007', $secret);
    check(
        RequestGuard::resolvePlayerId(['HTTP_X_ZONE_PLAYER_ID' => 'agent-007', 'HTTP_X_ZONE_PLAYER_TOKEN' => $goodToken], $secret) === 'agent-007',
        'production mode accepts a valid HMAC-signed player identity',
    );
    $forgedBlocked = false;
    try {
        RequestGuard::resolvePlayerId(['HTTP_X_ZONE_PLAYER_ID' => 'agent-007', 'HTTP_X_ZONE_PLAYER_TOKEN' => 'forged'], $secret);
    } catch (RuntimeException) {
        $forgedBlocked = true;
    }
    check($forgedBlocked, 'EXPLOIT CLOSED: production mode rejects a forged player token');
    $badIdBlocked = false;
    try {
        RequestGuard::resolvePlayerId(['HTTP_X_ZONE_PLAYER_ID' => 'DROP TABLE players', 'HTTP_X_ZONE_PLAYER_TOKEN' => 'x'], $secret);
    } catch (InvalidArgumentException) {
        $badIdBlocked = true;
    }
    check($badIdBlocked, 'malformed player identifiers are rejected before any query');

    // --- Strict input validation (no silent (int) casts of client values) ---
    check(RequestGuard::positiveInt(['amount' => 500], 'amount') === 500, 'positiveInt accepts a valid integer');
    check(RequestGuard::positiveInt(['amount' => '500'], 'amount') === 500, 'positiveInt accepts a numeric string');
    check(RequestGuard::nonNegativeInt(['expectedPrice' => 0], 'expectedPrice') === 0, 'quoted price accepts a genuine zero price');
    foreach ([true, -1, 0.5] as $invalidPrice) {
        $rejected = false;
        try { RequestGuard::nonNegativeInt(['expectedPrice' => $invalidPrice], 'expectedPrice'); } catch (InvalidArgumentException) { $rejected = true; }
        check($rejected, 'quoted price rejects invalid value ' . json_encode($invalidPrice));
    }
    foreach ([['amount' => 0], ['amount' => -5], ['amount' => 'lots'], ['amount' => 5.5], []] as $badBody) {
        $rejected = false;
        try { RequestGuard::positiveInt($badBody, 'amount'); } catch (InvalidArgumentException) { $rejected = true; }
        check($rejected, 'positiveInt rejects invalid amount ' . json_encode($badBody));
    }
    check(RequestGuard::boundedInt(['sessions' => 99], 'sessions', 1, 10, 1) === 10, 'boundedInt clamps an out-of-range value');
    check(RequestGuard::boundedInt([], 'sessions', 1, 10, 1) === 1, 'boundedInt falls back to the default when absent');

    // --- P0-3: server-clock cooldown service ---
    $cooldowns = new CooldownService($database);
    $cooldowns->assertReady('cd-probe', 'crime'); // no row yet -> ready
    $cooldowns->arm('cd-probe', 'crime', 30);
    $cooldownEnforced = false;
    try { $cooldowns->assertReady('cd-probe', 'crime'); } catch (CooldownException) { $cooldownEnforced = true; }
    check($cooldownEnforced, 'CooldownService enforces a server-clock cooldown after arming');
    $cooldowns->assertReady('cd-probe', 'gym'); // different action -> independent, still ready
    check(true, 'cooldowns are tracked per action, not globally');

    // --- P0-3: per-player rate limiter ---
    $limiter = new RateLimiter($database, 3, 10);
    $limiter->hit('rl-probe');
    $limiter->hit('rl-probe');
    $limiter->hit('rl-probe');
    $rateEnforced = false;
    try { $limiter->hit('rl-probe'); } catch (RateLimitException) { $rateEnforced = true; }
    check($rateEnforced, 'RateLimiter blocks the 4th action inside the window');

    // --- P0-3: cooldown is actually WIRED into the engine action path ---
    [$engine, $database] = build_engine($databasePath);
    $database->execute('DELETE FROM action_cooldowns');
    $database->execute('DELETE FROM action_rate_limits');
    $database->execute('UPDATE players SET nerve = 50 WHERE id = :id', ['id' => 'founder-player']);
    $engine->attemptCrime('searchforcash'); // arms the crime cooldown
    $engineHammerBlocked = false;
    try { $engine->attemptCrime('searchforcash'); } catch (CooldownException) { $engineHammerBlocked = true; }
    check($engineHammerBlocked, 'EXPLOIT CLOSED: crime endpoint enforces a server-clock cooldown (anti-hammer)');

    // --- P0-3: rate limit is actually WIRED into the engine action path ---
    putenv('ZONE_RATE_LIMIT_MAX=1');
    [$engine, $database] = build_engine($databasePath);
    $database->execute('DELETE FROM action_rate_limits');
    $database->execute('DELETE FROM action_cooldowns');
    $database->execute('UPDATE players SET cash = 100000 WHERE id = :id', ['id' => 'founder-player']);
    $engine->bankDeposit(1);
    $engineRateBlocked = false;
    try { $engine->bankDeposit(1); } catch (RateLimitException) { $engineRateBlocked = true; }
    check($engineRateBlocked, 'EXPLOIT CLOSED: GameEngine enforces the per-player action rate limit');
    putenv('ZONE_RATE_LIMIT_MAX');
    [$engine, $database] = build_engine($databasePath);

    $schema = (string) file_get_contents(dirname(__DIR__) . '/database/schema.postgresql.sql');
    foreach (['action_cooldowns', 'action_rate_limits', 'economy_ledger', 'event_log', 'jobs', 'notifications', 'assets', 'content_drafts', 'content_releases', 'admin_audit_log'] as $table) {
        check(str_contains($schema, "CREATE TABLE IF NOT EXISTS {$table}"), "PostgreSQL schema contains {$table}");
    }

    // ============================================================
    // RETENTION FLOOR (P0): xp->level, crime gate+rebalance,
    // daily hooks (streak/contract/cap-nudge), cooldown config
    // ============================================================

    // --- P0 level curve: pure function of xp, totalXp(L) = 50*L*(L-1) ---
    [$engine, $database] = build_engine($databasePath);
    $leveling = new LevelingService($database, new Ledger($database), new EventBus($database));
    check($leveling->totalXpForLevel(1) === 0, 'level curve: level 1 requires 0 xp');
    check($leveling->totalXpForLevel(5) === 1000, 'level curve: level 5 requires 1000 xp (50*L*(L-1))');
    check($leveling->totalXpForLevel(16) === 12000, 'level curve: level 16 requires 12000 xp');
    check($leveling->levelForXp(0) === 1, 'level curve: 0 xp resolves to level 1');
    check($leveling->levelForXp(999) === 4, 'level curve: 999 xp resolves to level 4');
    check($leveling->levelForXp(1000) === 5, 'level curve: 1000 xp resolves to level 5 exactly on the threshold');

    // --- P0 xp advances level AND level-up raises caps + pays out ---
    $database->insertIgnore(
        'players',
        ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
        ['level-test', 'Rookie', 1, 0, 0, 100, 45, 250, 1000, 100, 45, 250, 1000, gmdate('c'), 10, 10, 10, 10, 0, 'Zone City', 0, null],
    );
    $database->execute('UPDATE players SET xp = 1000 WHERE id = :id', ['id' => 'level-test']);
    $levelUp = $leveling->sync('level-test', 'lvl-' . bin2hex(random_bytes(6)));
    $lp = $database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => 'level-test']);
    check($levelUp !== null && (int) $lp['level'] === 5, 'gaining xp across totalXp(L) advances level by the number of thresholds crossed (1->5)');
    check((int) $lp['max_nerve'] === 49 && (int) $lp['max_energy'] === 112, 'level-up raises max nerve/energy to the Section 3.1 values (49/112 at L5)');
    check((int) $lp['nerve'] === 49 && (int) $lp['energy'] === 112, 'level-up refills nerve and energy to the new caps');
    check((int) $lp['cash'] === 3500, 'level-up pays level*250 per level crossed (2+3+4+5 = 3500)');
    check($database->fetchOne("SELECT id FROM event_log WHERE event_name = 'PlayerLeveledUp'") !== null, 'PlayerLeveledUp event is persisted');
    $levelBonus = array_values(array_filter($engine->ledger(50), static fn (array $e): bool => $e['reason'] === 'levelup.bonus'));
    check(count($levelBonus) >= 1 && (int) $levelBonus[0]['amount'] === 3500, 'level-up writes a levelup.bonus ledger entry for the exact payout');
    // No double-count: syncing again at the same xp is a no-op.
    check($leveling->sync('level-test', 'lvl-noop') === null, 'level sync is a no-op when xp has not crossed a new threshold');

    // --- P0 crime gate: below level_required is rejected, mutates nothing ---
    [$engine, $database] = build_engine($databasePath);
    $database->execute('DELETE FROM action_cooldowns');
    $database->execute("UPDATE players SET level = 12, nerve = 50, last_login_day = :t WHERE id = :id", ['t' => gmdate('Y-m-d'), 'id' => 'founder-player']);
    $lockedBefore = $engine->player('founder-player');
    $gateBlocked = false;
    try { $engine->attemptCrime('burglary'); } catch (InvalidArgumentException) { $gateBlocked = true; }
    check($gateBlocked, 'crime below its level_required (Burglary L16 vs player L12) is rejected with 422');
    $lockedAfter = $engine->player('founder-player');
    check((int) $lockedBefore['nerve'] === (int) $lockedAfter['nerve'] && (int) $lockedBefore['cash'] === (int) $lockedAfter['cash'], 'a level-gated crime mutates nothing');
    $database->execute('DELETE FROM action_cooldowns');
    $categoryBlocked = false;
    try { $engine->attemptCrime('cardskimming'); } catch (InvalidArgumentException $error) { $categoryBlocked = str_starts_with($error->getMessage(), 'Earn more crime experience'); }
    check($categoryBlocked, 'original crime tiers enforce their category XP prerequisite');
    $progressFixture = $engine->gameplay()['state'];
    $progressFixture['crimeXp'] = 300;
    $database->execute("UPDATE player_progression SET state_json = :state WHERE player_id = 'founder-player'", ['state' => json_encode($progressFixture)]);
    $gateAllowed = true;
    try { $engine->attemptCrime('cardskimming'); } catch (InvalidArgumentException) { $gateAllowed = false; }
    check($gateAllowed, 'a crime at exactly the required level (Card Skimming L12 vs player L12) is allowed');

    // --- P0 crime rebalance: cash-per-nerve monotonic (Graffiti trap killed) ---
    $order = ['searchforcash', 'bootlegging', 'graffiti', 'shoplifting', 'pickpocketing', 'cardskimming', 'burglary'];
    $prevRatio = 0.0;
    $monotonic = true;
    foreach ($order as $cid) {
        $c = $database->fetchOne('SELECT * FROM crimes WHERE id = :id', ['id' => $cid]);
        $ev = (((int) $c['cash_min'] + (int) $c['cash_max']) / 2) * ((int) $c['success_basis_points'] / 10000) / (int) $c['nerve_cost'];
        if ($ev <= $prevRatio) {
            $monotonic = false;
        }
        $prevRatio = $ev;
    }
    check($monotonic, 'crime cash-per-nerve EV is strictly monotonic across all 7 tiers (no-brainer + Graffiti trap removed)');
    check((int) $database->fetchOne('SELECT level_required FROM crimes WHERE id = :id', ['id' => 'burglary'])['level_required'] === 16, 'Burglary is gated at level 16');
    check((int) $database->fetchOne('SELECT level_required FROM crimes WHERE id = :id', ['id' => 'searchforcash'])['level_required'] === 1, 'Search for Cash is available from level 1');
    check(count($engine->crimes()) === 31, 'crime catalog preserves 7 tiers and 24 existing variants');
    $publicBurglary = array_values(array_filter($engine->crimes(), static fn (array $c): bool => $c['id'] === 'burglary'))[0];
    check((int) ($publicBurglary['level_required'] ?? 0) === 16, 'public crime catalog exposes level_required for client lock badges');
    check($publicBurglary['category'] === 'burg' && $publicBurglary['crime_xp_required'] === 2200, 'original crime catalog preserves category identity and XP threshold');
    check(!isset($publicBurglary['success_basis_points']), 'public crime catalog still hides success_basis_points');

    // --- P0 login streak pays, is idempotent, advances and resets ---
    [$engine, $database] = build_engine($databasePath);
    $database->execute("UPDATE players SET last_login_day = NULL, login_streak = 0, cash = 5000 WHERE id = :id", ['id' => 'founder-player']);
    $cashBefore = (int) $engine->player('founder-player')['cash'];
    $s1 = $engine->dailyLogin('founder-player');
    check($s1 !== null && $s1['streakDay'] === 1 && $s1['rewardCash'] === 1000, 'first login of a new UTC day pays streak day 1 (1000)');
    check((int) $engine->player('founder-player')['cash'] === $cashBefore + 1000, 'streak reward credits cash on hand');
    check($engine->dailyLogin('founder-player') === null, 'a second login the same UTC day grants no streak reward (idempotent)');
    check($database->fetchOne("SELECT id FROM event_log WHERE event_name = 'LoginStreakClaimed'") !== null, 'LoginStreakClaimed event is persisted');
    check(count(array_filter($engine->ledger(50), static fn (array $e): bool => $e['reason'] === 'streak.reward')) >= 1, 'streak reward writes a streak.reward ledger entry');
    $yesterday = gmdate('Y-m-d', time() - 86400);
    $database->execute("UPDATE players SET last_login_day = :y, login_streak = 1 WHERE id = :id", ['y' => $yesterday, 'id' => 'founder-player']);
    $s2 = $engine->dailyLogin('founder-player');
    check($s2 !== null && $s2['streakDay'] === 2 && $s2['rewardCash'] === 1500, 'a consecutive UTC day advances the streak to day 2');
    $database->execute("UPDATE players SET last_login_day = :y, login_streak = 2, nerve = 5 WHERE id = :id", ['y' => $yesterday, 'id' => 'founder-player']);
    $s3 = $engine->dailyLogin('founder-player');
    $p3 = $engine->player('founder-player');
    check($s3['streakDay'] === 3 && (int) $p3['nerve'] === (int) $p3['max_nerve'], 'streak day 3 refills nerve to max');
    $twoDaysAgo = gmdate('Y-m-d', time() - 2 * 86400);
    $database->execute("UPDATE players SET last_login_day = :d, login_streak = 5 WHERE id = :id", ['d' => $twoDaysAgo, 'id' => 'founder-player']);
    $sReset = $engine->dailyLogin('founder-player');
    check($sReset !== null && $sReset['streakDay'] === 1, 'a missed UTC day resets the streak to day 1');

    // --- P0 daily contract: progress advances, completes, and claims once ---
    [$engine, $database] = build_engine($databasePath);
    $database->execute("DELETE FROM player_contract_progress WHERE player_id = :id", ['id' => 'founder-player']);
    $cs = $engine->dailyContract('founder-player');
    check($cs['progress'] === 0 && $cs['complete'] === false && isset($cs['contract']['metric']), 'daily contract starts at zero progress');
    $claimEarly = false;
    try { $engine->claimDailyContract('founder-player'); } catch (RuntimeException) { $claimEarly = true; }
    check($claimEarly, 'an incomplete daily contract cannot be claimed');
    // A matching action advances progress through the real action path.
    $metric = $cs['contract']['metric'];
    $database->execute("DELETE FROM action_cooldowns WHERE player_id = :id", ['id' => 'founder-player']);
    $database->execute("UPDATE players SET nerve = 50, energy = 150, cash = 100000, last_login_day = :t WHERE id = :id", ['t' => gmdate('Y-m-d'), 'id' => 'founder-player']);
    if ($metric === 'crimes') {
        $engine->attemptCrime('searchforcash');
    } elseif ($metric === 'stat_gain') {
        $engine->trainGym('strength', 1);
    } elseif ($metric === 'job_cash') {
        $engine->workShift();
    } else {
        $database->execute("UPDATE players SET strength = 1000000000, speed = 1000000000, dexterity = 1000000000, energy = 150 WHERE id = :id", ['id' => 'founder-player']);
        $engine->attackNpc('founder-player');
    }
    check($engine->dailyContract('founder-player')['progress'] > 0, 'a matching action advances daily-contract progress server-side');
    // Force completion and claim.
    $database->execute("DELETE FROM player_contract_progress WHERE player_id = :id", ['id' => 'founder-player']);
    $target = (int) $cs['target'];
    $database->insertIgnore('player_contract_progress', ['player_id', 'day', 'progress', 'claimed'], ['founder-player', $cs['contract']['day'], $target, 0]);
    check($engine->dailyContract('founder-player')['complete'] === true, 'daily contract reports complete once progress reaches the target');
    $rewardCash = (int) $cs['contract']['reward_cash'];
    $rewardXp = (int) $cs['contract']['reward_xp'];
    // Pin to the L12 xp floor so the +200 xp reward cannot cross a level
    // threshold (a level-up would add its own cash bonus and skew the delta).
    $database->execute("UPDATE players SET level = 12, xp = 6600 WHERE id = :id", ['id' => 'founder-player']);
    $pcBefore = $engine->player('founder-player');
    $claim = $engine->claimDailyContract('founder-player');
    $pcAfter = $engine->player('founder-player');
    check($claim['rewardCash'] === $rewardCash && (int) $pcAfter['cash'] === (int) $pcBefore['cash'] + $rewardCash, 'claiming a completed daily contract pays its cash reward');
    check((int) $pcAfter['xp'] === (int) $pcBefore['xp'] + $rewardXp, 'claiming a completed daily contract grants its xp reward');
    check($database->fetchOne("SELECT id FROM event_log WHERE event_name = 'DailyContractClaimed'") !== null, 'DailyContractClaimed event is persisted');
    $doubleClaim = false;
    try { $engine->claimDailyContract('founder-player'); } catch (RuntimeException) { $doubleClaim = true; }
    check($doubleClaim, 'a daily contract cannot be claimed twice in one UTC day');

    // --- P0 cap-waste nudge: capped bars write a notification (deduped) ---
    [$engine, $database] = build_engine($databasePath);
    $database->execute("DELETE FROM notifications WHERE player_id = :id", ['id' => 'founder-player']);
    $past = gmdate('c', time() - 100 * 60);
    $database->execute("UPDATE players SET energy = 149, nerve = 49, max_energy = 150, max_nerve = 50, resources_updated_at = :past WHERE id = :id", ['past' => $past, 'id' => 'founder-player']);
    $engine->player('founder-player');
    $nudgeTypes = array_column($engine->notifications('founder-player'), 'type');
    check(in_array('cap-waste:energy', $nudgeTypes, true) && in_array('cap-waste:nerve', $nudgeTypes, true), 'a bar that regenerates to max writes a cap-waste nudge to notifications');
    $database->execute("UPDATE players SET energy = 149, resources_updated_at = :past WHERE id = :id", ['past' => gmdate('c', time() - 100 * 60), 'id' => 'founder-player']);
    $engine->player('founder-player');
    check(count(array_filter($engine->notifications('founder-player'), static fn (array $n): bool => $n['type'] === 'cap-waste:energy')) === 1, 'the cap-waste nudge is de-duplicated while still unread');

    // --- P0 cooldown values live in a config table AND the engine reads them ---
    [$engine, $database] = build_engine($databasePath);
    check(count($database->fetchAll('SELECT action, seconds FROM cooldown_config')) === 9, 'cooldown_config seeds all 9 action cooldowns');
    check((int) $database->fetchOne('SELECT seconds FROM cooldown_config WHERE action = :a', ['a' => 'crime'])['seconds'] === 5, 'crime cooldown lives in config at 5s (moved out of engine code)');
    check((int) $database->fetchOne('SELECT seconds FROM cooldown_config WHERE action = :a', ['a' => 'bank'])['seconds'] === 0, 'bank cooldown config is 0 (balance-gated)');
    check((int) $database->fetchOne('SELECT seconds FROM cooldown_config WHERE action = :a', ['a' => 'territory'])['seconds'] === 1, 'territory cooldown lives in config at 1s');
    $database->execute("UPDATE cooldown_config SET seconds = 0 WHERE action = 'crime'");
    [$engine, $database] = build_engine($databasePath);
    $database->execute('DELETE FROM action_cooldowns');
    $database->execute("UPDATE players SET level = 12, nerve = 50, last_login_day = :t WHERE id = :id", ['t' => gmdate('Y-m-d'), 'id' => 'founder-player']);
    $engine->attemptCrime('searchforcash');
    $configHonored = true;
    try { $engine->attemptCrime('searchforcash'); } catch (CooldownException) { $configHonored = false; }
    check($configHonored, 'the engine reads cooldowns from config: setting crime=0 removes the anti-hammer floor');

    // --- Server-authoritative faction territory map ---
    [$engine, $database] = build_engine($databasePath);
    $territoryMap = $engine->territoryMap('founder-player');
    $territoryBlocks = $territoryMap['blocks'] ?? [];
    $territoryById = array_column($territoryBlocks, null, 'id');
    $factionById = array_column($territoryMap['factions'] ?? [], null, 'id');

    check(count($territoryBlocks) === 120 && ($territoryMap['summary']['total'] ?? null) === 120, 'territory map exposes all 120 capturable city blocks');
    check(count($territoryById) === 120 && isset($territoryById['ZC-001'], $territoryById['ZC-120']), 'territory block IDs are unique and span ZC-001 through ZC-120');
    check(($territoryMap['playerFactionId'] ?? null) === 'vipers' && ($territoryMap['playerFactionRole'] ?? null) === 'leader', 'territory snapshot derives the player faction and role server-side');
    check(($territoryMap['neutralColor'] ?? null) === '#68717b', 'territory snapshot publishes the canonical grey neutral color');
    check(($factionById['vipers']['color'] ?? null) === '#78d628', 'the player faction has the canonical green territory color');

    $factionColors = array_column($territoryMap['factions'] ?? [], 'color');
    check(count($factionColors) >= 4 && count(array_unique($factionColors)) === count($factionColors), 'every seeded faction has a distinct ownership color');

    $neutralBlocks = array_values(array_filter($territoryBlocks, static fn (array $block): bool => ($block['ownerFactionId'] ?? null) === null));
    $ownedBlocks = array_values(array_filter($territoryBlocks, static fn (array $block): bool => ($block['ownerFactionId'] ?? null) !== null));
    check(count($neutralBlocks) > 0 && count($ownedBlocks) > 0, 'territory seed contains both neutral and faction-controlled blocks');
    check(count(array_filter($neutralBlocks, static fn (array $block): bool => ($block['state'] ?? null) === 'neutral' && ($block['ownerColor'] ?? null) === '#68717b')) === count($neutralBlocks), 'every neutral block is grey and has neutral state');
    check(count(array_filter($ownedBlocks, static function (array $block) use ($factionById): bool {
        $ownerId = $block['ownerFactionId'] ?? null;
        return is_string($ownerId)
            && isset($factionById[$ownerId])
            && ($block['ownerColor'] ?? null) === $factionById[$ownerId]['color']
            && in_array($block['state'] ?? null, ['owned', 'contested'], true);
    })) === count($ownedBlocks), 'every controlled block uses its owner faction color and a controlled state');

    $topologyValid = true;
    $topologyReciprocal = true;
    $blockDetailsValid = true;
    $benefitKeys = [];
    foreach ($territoryBlocks as $block) {
        $blockId = (string) ($block['id'] ?? '');
        $neighbors = $block['neighbors'] ?? null;
        $polygon = $block['polygon'] ?? null;
        $centroid = $block['centroid'] ?? null;
        $benefits = $block['benefits'] ?? null;
        if (!is_array($neighbors) || $neighbors === [] || count($neighbors) !== count(array_unique($neighbors)) || in_array($blockId, $neighbors, true)) {
            $topologyValid = false;
        } else {
            foreach ($neighbors as $neighborId) {
                if (!isset($territoryById[$neighborId])) {
                    $topologyValid = false;
                    continue;
                }
                if (!in_array($blockId, $territoryById[$neighborId]['neighbors'] ?? [], true)) {
                    $topologyReciprocal = false;
                }
            }
        }
        $name = $block['name'] ?? [];
        if (!is_array($polygon) || count($polygon) < 4 || !is_array($centroid) || count($centroid) !== 2
            || trim((string) ($name['en'] ?? '')) === '' || trim((string) ($name['ar'] ?? '')) === ''
            || (int) ($block['sector'] ?? 0) < 1 || (int) ($block['sector'] ?? 0) > 7
            || (int) ($block['size'] ?? 0) < 1 || (int) ($block['density'] ?? 0) < 1
            || (int) ($block['slots'] ?? 0) < 5 || (int) ($block['dailyRespect'] ?? 0) <= 0
            || (int) ($block['version'] ?? 0) < 1) {
            $blockDetailsValid = false;
        }
        if (!is_array($benefits) || $benefits === []) {
            $blockDetailsValid = false;
            continue;
        }
        foreach ($benefits as $benefit) {
            $benefitName = $benefit['name'] ?? [];
            if (trim((string) ($benefit['key'] ?? '')) === ''
                || trim((string) ($benefitName['en'] ?? '')) === ''
                || trim((string) ($benefitName['ar'] ?? '')) === ''
                || !is_numeric($benefit['value'] ?? null) || (float) ($benefit['value'] ?? 0) <= 0
                || trim((string) ($benefit['unit'] ?? '')) === '') {
                $blockDetailsValid = false;
            }
            $benefitKeys[] = (string) ($benefit['key'] ?? '');
        }
    }
    check($topologyValid, 'every territory block has explicit, unique neighbors that reference real blocks');
    check($topologyReciprocal, 'territory adjacency is reciprocal in both directions');
    check($blockDetailsValid, 'every territory block exposes bilingual names, geometry, sector stats, version, respect, slots, and typed benefits');
    check(count(array_unique($benefitKeys)) >= 8, 'territory blocks provide a varied city-wide benefit catalog');

    $reachable = [];
    $queue = isset($territoryBlocks[0]['id']) ? [(string) $territoryBlocks[0]['id']] : [];
    while ($queue !== []) {
        $blockId = array_shift($queue);
        if (isset($reachable[$blockId]) || !isset($territoryById[$blockId])) {
            continue;
        }
        $reachable[$blockId] = true;
        foreach ($territoryById[$blockId]['neighbors'] as $neighborId) {
            if (!isset($reachable[$neighborId])) {
                $queue[] = $neighborId;
            }
        }
    }
    check(count($reachable) === 120, 'all 120 territory blocks form one connected adjacency graph');

    $claimable = null;
    foreach ($territoryBlocks as $block) {
        if (($block['ownerFactionId'] ?? null) === null && ($block['action'] ?? null) === 'claim') {
            $claimable = $block;
            break;
        }
    }
    check($claimable !== null, 'the server exposes at least one neutral block adjacent to the player faction as claimable');
    if ($claimable !== null) {
        $claimId = (string) $claimable['id'];
        $claimVersion = (int) $claimable['version'];
        $revisionBeforeClaim = (string) $territoryMap['revision'];
        $database->execute('DELETE FROM action_cooldowns WHERE player_id = :id', ['id' => 'founder-player']);
        $database->execute('DELETE FROM action_rate_limits WHERE player_id = :id', ['id' => 'founder-player']);
        $claimResult = $engine->actTerritory($claimId, 'claim', $claimVersion, 'founder-player');
        $claimedById = array_column($claimResult['map']['blocks'] ?? [], null, 'id');
        $claimed = $claimedById[$claimId] ?? [];
        check(($claimResult['action'] ?? null) === 'claim' && ($claimResult['territoryId'] ?? null) === $claimId, 'server accepts a valid adjacent neutral territory claim');
        check(($claimed['ownerFactionId'] ?? null) === 'vipers' && ($claimed['ownerColor'] ?? null) === '#78d628' && ($claimed['state'] ?? null) === 'owned', 'claim derives ownership from server membership and turns the block player-faction green');
        check(($claimed['version'] ?? null) === $claimVersion + 1 && ($claimResult['map']['revision'] ?? null) !== $revisionBeforeClaim, 'claim atomically increments the territory version and map revision');

        $storedClaim = $database->fetchOne('SELECT faction_id, state, version FROM territory_control WHERE territory_id = :id', ['id' => $claimId]);
        check(($storedClaim['faction_id'] ?? null) === 'vipers' && ($storedClaim['state'] ?? null) === 'owned' && (int) ($storedClaim['version'] ?? 0) === $claimVersion + 1, 'claimed ownership and version are persisted in territory_control');
        $claimEvent = $database->fetchOne("SELECT id FROM event_log WHERE event_name = 'TerritoryControlChanged' ORDER BY occurred_at DESC LIMIT 1");
        check($claimEvent !== null, 'valid territory claim persists a TerritoryControlChanged domain event');

        $database->execute('DELETE FROM action_cooldowns WHERE player_id = :id', ['id' => 'founder-player']);
        $database->execute('DELETE FROM action_rate_limits WHERE player_id = :id', ['id' => 'founder-player']);
        $staleRejected = false;
        try {
            $engine->actTerritory($claimId, 'claim', $claimVersion, 'founder-player');
        } catch (RuntimeException $exception) {
            $staleRejected = str_starts_with($exception->getMessage(), 'Territory state changed.');
        }
        $storedAfterStale = $database->fetchOne('SELECT faction_id, state, version FROM territory_control WHERE territory_id = :id', ['id' => $claimId]);
        check($staleRejected, 'territory command rejects a stale expectedVersion');
        check(($storedAfterStale['faction_id'] ?? null) === 'vipers' && (int) ($storedAfterStale['version'] ?? 0) === $claimVersion + 1, 'stale territory command cannot mutate persisted ownership or version');

        $postClaimMap = $engine->territoryMap('founder-player');
        $nonAdjacent = null;
        foreach ($postClaimMap['blocks'] as $block) {
            if (($block['ownerFactionId'] ?? null) === null
                && ($block['action'] ?? null) === null
                && str_starts_with((string) ($block['actionReason'] ?? ''), 'Control an adjacent block')) {
                $nonAdjacent = $block;
                break;
            }
        }
        check($nonAdjacent !== null, 'the server marks distant neutral blocks as nonadjacent and ineligible');
        if ($nonAdjacent !== null) {
            $database->execute('DELETE FROM action_cooldowns WHERE player_id = :id', ['id' => 'founder-player']);
            $database->execute('DELETE FROM action_rate_limits WHERE player_id = :id', ['id' => 'founder-player']);
            $nonAdjacentRejected = false;
            try {
                $engine->actTerritory((string) $nonAdjacent['id'], 'claim', (int) $nonAdjacent['version'], 'founder-player');
            } catch (RuntimeException $exception) {
                $nonAdjacentRejected = str_starts_with($exception->getMessage(), 'Control an adjacent block');
            }
            $storedNonAdjacent = $database->fetchOne('SELECT faction_id, state, version FROM territory_control WHERE territory_id = :id', ['id' => $nonAdjacent['id']]);
            check($nonAdjacentRejected, 'server rejects a claim that is not adjacent to player-faction territory');
            check(($storedNonAdjacent['faction_id'] ?? null) === null && ($storedNonAdjacent['state'] ?? null) === 'neutral' && (int) ($storedNonAdjacent['version'] ?? 0) === (int) $nonAdjacent['version'], 'rejected nonadjacent claim leaves the territory state unchanged');
        }

        [$reloadedEngine] = build_engine($databasePath);
        $reloadedById = array_column($reloadedEngine->territoryMap('founder-player')['blocks'] ?? [], null, 'id');
        check(($reloadedById[$claimId]['ownerFactionId'] ?? null) === 'vipers' && ($reloadedById[$claimId]['version'] ?? null) === $claimVersion + 1, 'claimed territory survives a fresh engine instance and database reseed pass');
    }

    // Frequent polling must not restart the slower resource clocks.
    $clock = 1800000000; // Divisible by each 60/180/300-second cadence.
    $database->execute('UPDATE players SET energy = 0, nerve = 0, happy = 0, life = 0, resources_updated_at = :ts WHERE id = :id', ['ts' => gmdate('c', $clock), 'id' => 'founder-player']);
    $resources = new ResourceService($database, null, static function () use (&$clock): int { return $clock; });
    for ($minute = 1; $minute <= 15; $minute++) {
        $clock += 60;
        $regenerated = $resources->regenerate('founder-player');
    }
    check($regenerated['energy'] === 5 && $regenerated['nerve'] === 3 && $regenerated['happy'] === 5 && $regenerated['life'] === 15, 'one-minute player polling preserves all four resource regeneration cadences');
    $unchanged = $resources->regenerate('founder-player');
    check($unchanged === $regenerated, 'polling the same resource tick cannot double-credit regeneration');
    $clock += 59;
    $resources->regenerate('founder-player');
    $clock++;
    $fractional = $resources->regenerate('founder-player');
    check($fractional['life'] === 16, 'sub-minute polling retains time toward the next resource tick');

    // An active war must remain contested when its defending faction reinforces.
    $database->execute('UPDATE faction_members SET faction_id = :id WHERE player_id = :player', ['id' => 'kings', 'player' => 'founder-player']);
    $database->execute("UPDATE territory_control SET faction_id = 'kings', state = 'contested' WHERE territory_id = 'ZC-056'");
    $warId = bin2hex(random_bytes(16));
    $database->insertIgnore('territory_wars', ['id', 'territory_id', 'attacker_faction_id', 'defender_faction_id', 'target_score', 'state', 'started_at', 'ends_at'], [$warId, 'ZC-056', 'vipers', 'kings', 100000, 'active', gmdate('c'), gmdate('c', time() + 3600)]);
    $database->execute('DELETE FROM action_cooldowns');
    $beforeReinforce = $database->fetchOne('SELECT version FROM territory_control WHERE territory_id = :id', ['id' => 'ZC-056']);
    $reinforced = $engine->actTerritory('ZC-056', 'reinforce', (int) $beforeReinforce['version']);
    $reinforcedBlock = array_column($reinforced['map']['blocks'], null, 'id')['ZC-056'];
    check($reinforcedBlock['state'] === 'contested' && $reinforcedBlock['activeWar'] !== null, 'reinforcement cannot clear contested state while its territory war is active');
    $engine->setTerritoryOwnership('ZC-056', null, 'regression-test');
    $overridden = array_column($engine->territoryMap()['blocks'], null, 'id')['ZC-056'];
    check($overridden['state'] === 'neutral' && $overridden['activeWar'] === null, 'admin ownership override resolves any active war on the reassigned block');

    // Fault injection must roll back ownership together with its required audit.
    $beforeFault = $database->fetchOne('SELECT * FROM territory_control WHERE territory_id = :id', ['id' => 'ZC-057']);
    $database->execute("CREATE TRIGGER fail_territory_audit BEFORE INSERT ON admin_audit_log WHEN NEW.action = 'territory.ownership.set' BEGIN SELECT RAISE(ABORT, 'test audit failure'); END");
    $faultRejected = false;
    try { $engine->setTerritoryOwnership('ZC-057', 'night', 'regression-test'); } catch (Throwable $exception) { $faultRejected = str_contains($exception->getMessage(), 'test audit failure'); }
    $database->execute('DROP TRIGGER fail_territory_audit');
    $afterFault = $database->fetchOne('SELECT * FROM territory_control WHERE territory_id = :id', ['id' => 'ZC-057']);
    check($faultRejected && $afterFault === $beforeFault, 'ownership update rolls back when its audit insert fails');

    // Higher/lower owns its current card on the server and settles one wager.
    $database->execute('DELETE FROM action_cooldowns');
    $database->execute('DELETE FROM action_rate_limits');
    $initialCard = $engine->highLowState();
    check($initialCard === ['card' => 7, 'version' => 1], 'higher/lower initializes a persistent server-owned seven');
    foreach (['higher', 'lower'] as $direction) {
        $database->execute('DELETE FROM action_cooldowns');
        $cardBefore = $engine->highLowState();
        $cashBefore = (int) $database->fetchOne('SELECT cash FROM players WHERE id = :id', ['id' => 'founder-player'])['cash'];
        $round = $engine->playHighLow(100, $direction, $cardBefore['version']);
        $expected = $round['card'] === $cardBefore['card'] ? 'push' : (($direction === 'higher' ? $round['card'] > $cardBefore['card'] : $round['card'] < $cardBefore['card']) ? 'win' : 'lose');
        $expectedDelta = $expected === 'push' ? 0 : ($expected === 'win' ? 100 : -100);
        check($round['previousCard'] === $cardBefore['card'] && $round['card'] >= 2 && $round['card'] <= 14 && $round['result'] === $expected && $round['delta'] === $expectedDelta, "higher/lower {$direction} evaluates the drawn rank against the stored card with ace high");
        check($round['player']['cash'] === $cashBefore + $expectedDelta && $engine->highLowState() === ['card' => $round['card'], 'version' => $cardBefore['version'] + 1], "higher/lower {$direction} atomically persists the wallet and next card");
        $roundLedger = $database->fetchAll('SELECT amount, reason FROM economy_ledger WHERE correlation_id = :id', ['id' => $round['serverProof']['correlationId']]);
        check($expectedDelta === 0 ? $roundLedger === [] : count($roundLedger) === 1 && (int) $roundLedger[0]['amount'] === $expectedDelta && $roundLedger[0]['reason'] === 'casino.high-low', "higher/lower {$direction} records its exact settlement in the economy ledger");
    }
    $cardAfter = $engine->highLowState();
    $cooldownRejected = false;
    try { $engine->playHighLow(100, 'higher', $cardAfter['version']); } catch (CooldownException) { $cooldownRejected = true; }
    check($cooldownRejected && $engine->highLowState() === $cardAfter, 'higher/lower rejects an immediate repeated bet without advancing the round');
    $database->execute('DELETE FROM action_cooldowns');
    $cashBeforeStale = (int) $database->fetchOne('SELECT cash FROM players WHERE id = :id', ['id' => 'founder-player'])['cash'];
    $attemptsBeforeStale = (int) $database->fetchOne("SELECT count FROM action_rate_limits WHERE player_id = 'founder-player'")['count'];
    $staleRoundRejected = false;
    try { $engine->playHighLow(100, 'higher', $initialCard['version']); } catch (RuntimeException $exception) { $staleRoundRejected = str_starts_with($exception->getMessage(), 'Casino round changed.'); }
    $cashAfterStale = (int) $database->fetchOne('SELECT cash FROM players WHERE id = :id', ['id' => 'founder-player'])['cash'];
    check($staleRoundRejected && $engine->highLowState() === $cardAfter && $cashAfterStale === $cashBeforeStale, 'a stale higher/lower tab cannot wager against a newer server card');
    $attemptsAfterStale = (int) $database->fetchOne("SELECT count FROM action_rate_limits WHERE player_id = 'founder-player'")['count'];
    check($attemptsAfterStale === $attemptsBeforeStale + 1, 'rejected gameplay attempts remain counted after their mutation transaction rolls back');
    $invalidBetsRejected = 0;
    foreach ([[0, 'higher'], [-100, 'lower'], [100, 'sideways']] as [$badBet, $badDirection]) {
        try { $engine->playHighLow($badBet, $badDirection, $cardAfter['version']); } catch (InvalidArgumentException) { $invalidBetsRejected++; }
    }
    check($invalidBetsRejected === 3 && $engine->highLowState() === $cardAfter, 'higher/lower rejects invalid amounts and directions before changing its round');
    $insufficientRejected = false;
    try { $engine->playHighLow(PHP_INT_MAX, 'lower', $cardAfter['version']); } catch (RuntimeException $exception) { $insufficientRejected = str_contains($exception->getMessage(), 'Not enough cash'); }
    check($insufficientRejected && $engine->highLowState() === $cardAfter, 'higher/lower cannot wager more than the server wallet');
    [$reloadedEngine] = build_engine($databasePath);
    check($reloadedEngine->highLowState() === $cardAfter, 'higher/lower keeps its current card across fresh engine instances');
    $cashBeforeFault = (int) $database->fetchOne('SELECT cash FROM players WHERE id = :id', ['id' => 'founder-player'])['cash'];
    $ledgerBeforeFault = (int) $database->fetchOne('SELECT COUNT(*) AS total FROM economy_ledger')['total'];
    $database->execute("CREATE TRIGGER fail_casino_event BEFORE INSERT ON event_log WHEN NEW.event_name = 'HighLowPlayed' BEGIN SELECT RAISE(ABORT, 'test casino event failure'); END");
    $casinoFault = false;
    try { $engine->playHighLow(100, 'higher', $cardAfter['version']); } catch (Throwable $exception) { $casinoFault = str_contains($exception->getMessage(), 'test casino event failure'); }
    $database->execute('DROP TRIGGER fail_casino_event');
    $cashAfterFault = (int) $database->fetchOne('SELECT cash FROM players WHERE id = :id', ['id' => 'founder-player'])['cash'];
    $ledgerAfterFault = (int) $database->fetchOne('SELECT COUNT(*) AS total FROM economy_ledger')['total'];
    check($casinoFault && $cashAfterFault === $cashBeforeFault && $ledgerAfterFault === $ledgerBeforeFault && $engine->highLowState() === $cardAfter, 'higher/lower rolls back card, wallet, and ledger together when event persistence fails');
    check($database->fetchOne("SELECT player_id FROM action_cooldowns WHERE player_id = 'founder-player' AND action = 'blackjack'") === null, 'a rolled-back higher/lower round does not arm a cooldown');
    check(str_contains($schema, 'CREATE TABLE IF NOT EXISTS casino_high_low'), 'PostgreSQL schema persists higher/lower round state');

    // --- Both schemas carry the new retention structures ---
    foreach (['cooldown_config', 'player_contract_progress', 'factions', 'faction_members', 'territory_blocks', 'territory_control', 'territory_wars'] as $table) {
        check(str_contains($schema, "CREATE TABLE IF NOT EXISTS {$table}"), "PostgreSQL schema contains {$table}");
    }
    check(str_contains($schema, 'level_required'), 'PostgreSQL schema adds crimes.level_required');
    check(str_contains($schema, 'login_streak') && str_contains($schema, 'last_login_day'), 'PostgreSQL schema adds player streak columns');
    $sqliteSchema = (string) file_get_contents(dirname(__DIR__) . '/database/schema.sqlite.sql');
    check(str_contains($sqliteSchema, 'CREATE TABLE IF NOT EXISTS casino_high_low'), 'SQLite schema persists higher/lower round state');
    foreach (['cooldown_config', 'player_contract_progress', 'factions', 'faction_members', 'territory_blocks', 'territory_control', 'territory_wars'] as $table) {
        check(str_contains($sqliteSchema, "CREATE TABLE IF NOT EXISTS {$table}"), "SQLite schema contains {$table}");
    }
    check(str_contains($sqliteSchema, 'level_required'), 'SQLite schema adds crimes.level_required');

    // --- Authoritative telemetry fields on crime, gym, bank, and hospital ---
    $database->execute('DELETE FROM action_cooldowns');
    $database->execute("UPDATE players SET nerve = 20, energy = 100, cash = 5000, bank_balance = 5000 WHERE id = 'founder-player'");
    $crimeTelemetry = $engine->attemptCrime('searchforcash', 'founder-player');
    check(isset($crimeTelemetry['successThresholdBasisPoints'], $crimeTelemetry['territoryBonusBasisPoints']) && $crimeTelemetry['successThresholdBasisPoints'] > 0, 'crime receipt exposes successThresholdBasisPoints and territoryBonusBasisPoints');
    $database->execute('DELETE FROM action_cooldowns');
    $gymTelemetry = $engine->trainGym('strength', 1, 'founder-player');
    check(isset($gymTelemetry['gainPerEnergy']) && $gymTelemetry['gainPerEnergy'] > 0, 'gym training receipt exposes gainPerEnergy');
    $database->execute('DELETE FROM action_cooldowns');
    $bankTelemetry = $engine->bankDeposit(1000, 'founder-player');
    check(isset($bankTelemetry['vaultSharePct']) && $bankTelemetry['vaultSharePct'] >= 0 && $bankTelemetry['vaultSharePct'] <= 100, 'bank transfer receipt exposes vaultSharePct');
    $hospQuote = $engine->hospitalQuote('founder-player');
    check(isset($hospQuote['discountPct']) && is_float($hospQuote['discountPct']), 'hospitalQuote exposes discountPct');

    // --- Wave 9 (zone-beta127): Combat, PvP, Family Activity & Player Market telemetry ---
    $database->execute('DELETE FROM action_cooldowns');
    $database->execute('DELETE FROM action_rate_limits');
    $database->execute("UPDATE players SET life = 250, max_life = 250, energy = 150, strength = 10000000, speed = 10000000, defense = 10000000, dexterity = 10000000 WHERE id = 'founder-player'");
    $combatSnap = $engine->combat('founder-player');
    $firstNpcId = $engine->gameplay('founder-player')['catalogs']['opponents'][0]['id'];
    $combatStarted = $engine->combatAction('start', $firstNpcId, 'mug', (int) $combatSnap['version'], 'founder-player');
    $combatStruck = $engine->combatAction('strike', $firstNpcId, 'mug', (int) $combatStarted['version'], 'founder-player');
    $combatFinished = $engine->combatAction('finish', $firstNpcId, 'mug', (int) $combatStruck['version'], 'founder-player');
    check(isset($combatFinished['result']['damageDealt'], $combatFinished['result']['damageTaken']) && $combatFinished['result']['damageDealt'] > 0, 'NPC combat finish receipt exposes damageDealt and damageTaken');

    $pvpOpps = $engine->playerCombatOpponents('founder-player');
    check(!empty($pvpOpps['players']) && isset($pvpOpps['players'][0]['powerRatioPct']) && $pvpOpps['players'][0]['powerRatioPct'] > 0, 'playerCombatOpponents exposes powerRatioPct on opponent rows');

    $database->execute("UPDATE faction_members SET faction_id = 'vipers', role = 'leader' WHERE player_id = 'founder-player'");
    $famBefore = $engine->familyActivities('founder-player');
    check(!empty($famBefore['competition']['ranks']) && isset($famBefore['competition']['ranks'][0]['scorePerMember']), 'family competition ranks expose scorePerMember');
    $famCreated = $engine->familyActivityAction('create', 'dock-intercept', 1, 'founder-player');
    $famJoined = $engine->familyActivityAction('join', (string) $famCreated['operations'][0]['id'], (int) $famCreated['operations'][0]['version'], 'founder-player');
    check(($famCreated['operations'][0]['fillPct'] ?? null) === 0 && ($famJoined['operations'][0]['fillPct'] ?? null) === 50 && ($famJoined['operations'][0]['slotsRemaining'] ?? null) === 1, 'family operation exposes fillPct and slotsRemaining');
    $engine->familyActivityAction('cancel', (string) $famJoined['operations'][0]['id'], (int) $famJoined['operations'][0]['version'], 'founder-player');

    $progForMarket = new \Zone\Engine\Core\Game\ProgressionService($database, new EventBus($database));
    $progForMarket->grantItem('founder-player', 'medkit', 2, 'wave9-test', 'test.seed');
    $marketVer = (int) $engine->gameplay('founder-player')['state']['version'];
    $marketListed = $engine->playerMarketAction('list', 'medkit', 2, 350, $marketVer, 'founder-player');
    check(!empty($marketListed['listings']) && ($marketListed['listings'][0]['totalPrice'] ?? null) === 700, 'player market listings expose totalPrice (quantity * unitPrice)');

    // --- Wave 10 (zone-beta128): WorldDirector, LeaderboardService, TerritoryService & OwnerPlaytestService telemetry ---
    $engine->world()->tick();
    $worldSnap = $engine->world()->snapshot('founder-player');
    check(isset($worldSnap['activeFindCount']) && is_int($worldSnap['activeFindCount']) && (empty($worldSnap['finds']) || isset($worldSnap['finds'][0]['remainingSeconds'])), 'WorldDirector snapshot exposes activeFindCount and remainingSeconds on finds');
    $lbSnap = $engine->leaderboards('founder-player');
    check(!empty($lbSnap['rows']) && isset($lbSnap['rows'][0]['powerTier'], $lbSnap['rows'][0]['vsLeaderPct']) && $lbSnap['rows'][0]['vsLeaderPct'] === 100, 'LeaderboardService snapshot exposes powerTier and vsLeaderPct');
    $terrSnap = $engine->territoryMap('founder-player');
    check(isset($terrSnap['summary']['dailyRespectIncome']) && $terrSnap['summary']['dailyRespectIncome'] > 0, 'TerritoryService summary exposes dailyRespectIncome for owned blocks');
    $playtestStarted = $engine->ownerPlaytest()->start('founder-player', 'wave10-owner', str_repeat('w', 24));
    check(($playtestStarted['operationsRemaining'] ?? null) === 100 && ($playtestStarted['maxOperations'] ?? null) === 100, 'OwnerPlaytestService response exposes operationsRemaining and maxOperations');
    $engine->ownerPlaytest()->end('founder-player', 'wave10-owner', (string) $playtestStarted['sessionId'], str_repeat('x', 24));

    // --- Wave 11 (zone-beta129): DailyService, TravelService & ProgressionService telemetry ---
    $database->execute("UPDATE players SET last_login_day = NULL, login_streak = 0 WHERE id = 'founder-player'");
    $streakWave11 = $engine->dailyLogin('founder-player');
    check(($streakWave11['nextDayRewardCash'] ?? null) === 1500, 'DailyService login streak receipt exposes nextDayRewardCash');
    $contractWave11 = $engine->dailyContract('founder-player');
    check(isset($contractWave11['remaining'], $contractWave11['progressPct']) && is_int($contractWave11['progressPct']), 'DailyService contractState exposes remaining and progressPct');
    $gpWave11 = $engine->gameplay('founder-player');
    check(!empty($gpWave11['safehouses']) && isset($gpWave11['safehouses'][0]['trainingBoostPct'], $gpWave11['safehouses'][0]['happy']), 'ProgressionService safehouses expose happy and trainingBoostPct');
    check(isset($gpWave11['onboarding']['completedCount'], $gpWave11['onboarding']['totalCount']) && isset($gpWave11['onboarding']['steps'][0]['progressPct']), 'ProgressionService onboarding exposes completedCount, totalCount and step progressPct');
    $database->execute('DELETE FROM action_cooldowns');
    $database->execute("UPDATE players SET city = 'Zone City', cash = 50000 WHERE id = 'founder-player'");
    $database->execute("DELETE FROM player_travel WHERE player_id = 'founder-player'");
    $tripWave11 = $engine->travel('Riyadh', 'founder-player');
    check(isset($tripWave11['travel']['totalSeconds'], $tripWave11['travel']['progressPct']) && $tripWave11['travel']['totalSeconds'] > 0, 'TravelService snapshot exposes totalSeconds and progressPct');

    // --- Wave 12 (zone-beta130): FamilyProgressionService & LoadoutService telemetry ---
    $database->execute("UPDATE player_travel SET status = 'arrived', arrives_at = :past WHERE player_id = 'founder-player'", ['past' => gmdate('c', time() - 60)]);
    $database->execute("UPDATE players SET city = 'Zone City' WHERE id = 'founder-player'");
    $gpWave12 = $engine->gameplay('founder-player');
    check(isset($gpWave12['loadout']['weaponBonusPct'], $gpWave12['loadout']['armorMitigationPct']) && $gpWave12['loadout']['weaponBonusPct'] >= 0, 'LoadoutService resolve exposes weaponBonusPct and armorMitigationPct');
    check(isset($gpWave12['family']['memberCount'], $gpWave12['family']['upgradeCount']) && $gpWave12['family']['memberCount'] >= 1, 'FamilyProgressionService snapshot exposes memberCount and upgradeCount');
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
