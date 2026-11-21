<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\PlayerSettingsService;
use Zone\Engine\Core\Persistence\Database;

$databasePath = dirname(__DIR__) . '/var/test-player-settings-' . bin2hex(random_bytes(6)) . '.sqlite';
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

try {
    check(version_compare(PHP_VERSION, '8.5.0', '>='), 'PHP 8.5+ runtime verified (' . PHP_VERSION . ')');
    check(
        class_exists(\Zone\Engine\Core\Game\PlayerSettingsService::class)
        && class_exists(\Zone\Core\Game\PlayerSettingsService::class),
        'Both Zone\\Engine\\Core\\Game and Zone\\Core\\Game PlayerSettingsService class names autoload cleanly',
    );

    $database = Database::connect('sqlite:' . $databasePath);
    $database->migrateAndSeed();
    $events = new EventBus($database);

    $virtualNow = 1_765_000_000;
    $service = new PlayerSettingsService(
        $database,
        $events,
        static function () use (&$virtualNow): float {
            return (float) $virtualNow;
        },
    );

    // =========================================================================
    // 1. Default Snapshot & MCM v7 Schema Initialization
    // =========================================================================
    $snap1 = $service->snapshot('founder-player');
    check(
        $snap1['ok'] === true
        && $snap1['playerId'] === 'founder-player'
        && $snap1['revision'] === 1
        && $snap1['snapshotId'] === 'current-working'
        && $snap1['settings']['audio']['masterMuted'] === false
        && $snap1['settings']['audio']['masterVolume'] === 75
        && $snap1['settings']['graphics']['qualityPreset'] === 'high'
        && $snap1['settings']['gameplay']['theme'] === 'dark'
        && $snap1['settings']['controls']['keybinds']['mute'] === 'M'
        && $snap1['settings']['accessibility']['colorblindMode'] === 'standard'
        && $snap1['mcm']['minMcmVersion'] === 7
        && count($snap1['mcm']['pages']) === 6,
        'Default snapshot initializes 6-tab settings, ProfileStore lock, and 6-page Skyrim MCM v7 schema',
    );

    // =========================================================================
    // 2. Partial Update via act("settings.save") & Bounds Clamping
    // =========================================================================
    $virtualNow += 15;
    $saved = $service->act('founder-player', 'settings.save', [
        'settings' => [
            'audio' => [
                'masterMuted' => true,
                'masterVolume' => 145, // clamps to 100
                'sfxVolume' => -20,    // clamps to 0
                'musicEnabled' => false,
                'ambienceVolume' => 40,
            ],
            'graphics' => [
                'qualityPreset' => 'ultra',
                'showFpsCounter' => true,
            ],
            'gameplay' => [
                'theme' => 'light',
                'language' => 'ar',
                'showTickerBulletin' => false,
            ],
            'controls' => [
                'keybinds' => [
                    'mute' => 'k',
                    'attack' => '9',
                ],
            ],
            'accessibility' => [
                'colorblindMode' => 'deuteranopia',
                'reducedMotion' => true,
                'highContrast' => true,
                'textScale' => 110,
            ],
        ],
    ]);

    check(
        $saved['ok'] === true
        && $saved['revision'] === 2
        && $saved['settings']['audio']['masterMuted'] === true
        && $saved['settings']['audio']['masterVolume'] === 100
        && $saved['settings']['audio']['sfxVolume'] === 0
        && $saved['settings']['audio']['musicEnabled'] === false
        && $saved['settings']['audio']['ambienceVolume'] === 40
        && $saved['settings']['graphics']['qualityPreset'] === 'ultra'
        && $saved['settings']['graphics']['showFpsCounter'] === true
        && $saved['settings']['gameplay']['theme'] === 'light'
        && $saved['settings']['gameplay']['language'] === 'ar'
        && $saved['settings']['gameplay']['showTickerBulletin'] === false
        && $saved['settings']['controls']['keybinds']['mute'] === 'K'
        && $saved['settings']['controls']['keybinds']['attack'] === '9'
        && $saved['settings']['accessibility']['colorblindMode'] === 'deuteranopia'
        && $saved['settings']['accessibility']['reducedMotion'] === true
        && $saved['settings']['accessibility']['highContrast'] === true
        && $saved['settings']['accessibility']['textScale'] === 110,
        'settings.save clamps volumes [0..100], uppercases keybinds, and persists all 6 tabs cleanly',
    );

    // =========================================================================
    // 3. Skyrim MCM Hungarian Flat Key Expansion Support
    // =========================================================================
    $mcmSaved = $service->act('founder-player', 'settings.save', [
        'bMasterMuted' => false,
        'fMasterVolume' => 62,
        'sQualityPreset' => 'medium',
        'iTextScale' => 95,
    ]);
    check(
        $mcmSaved['revision'] === 3
        && $mcmSaved['settings']['audio']['masterMuted'] === false
        && $mcmSaved['settings']['audio']['masterVolume'] === 62
        && $mcmSaved['settings']['graphics']['qualityPreset'] === 'medium'
        && $mcmSaved['settings']['accessibility']['textScale'] === 95,
        'Skyrim MCM Hungarian control IDs (bMasterMuted, fMasterVolume, sQualityPreset, iTextScale) map cleanly',
    );

    // =========================================================================
    // 4. Config Snapshot Export -> Reset -> Import Round-Trip
    // =========================================================================
    $exported = $service->act('founder-player', 'settings.export_snapshot');
    check(
        $exported['ok'] === true
        && isset($exported['snapshot']['meta']['checksum'])
        && $exported['snapshot']['settings']['audio']['masterVolume'] === 62,
        'settings.export_snapshot produces versioned config snapshot package with SHA-256 checksum',
    );

    $exportedJson = json_encode($exported['snapshot'], JSON_THROW_ON_ERROR);

    // Reset to defaults
    $resetSnap = $service->act('founder-player', 'settings.reset');
    check(
        $resetSnap['revision'] === 4
        && $resetSnap['settings']['audio']['masterVolume'] === 75
        && $resetSnap['settings']['gameplay']['language'] === 'en'
        && $resetSnap['settings']['accessibility']['colorblindMode'] === 'standard',
        'settings.reset restores canonical factory defaults and increments ProfileStore revision',
    );

    // Re-import exported JSON snapshot
    $importedSnap = $service->act('founder-player', 'settings.import_snapshot', [
        'json' => $exportedJson,
    ]);
    check(
        $importedSnap['revision'] === 5
        && $importedSnap['settings']['audio']['masterVolume'] === 62
        && $importedSnap['settings']['graphics']['qualityPreset'] === 'medium'
        && $importedSnap['settings']['gameplay']['language'] === 'ar'
        && $importedSnap['settings']['accessibility']['colorblindMode'] === 'deuteranopia'
        && $importedSnap['settings']['accessibility']['textScale'] === 95,
        'settings.import_snapshot round-trips exported JSON snapshot back into active ProfileStore state',
    );

    // Integer player ID support & persistence across fresh instance
    $freshService = new PlayerSettingsService($database, $events);
    $intSnap = $freshService->act(1042, 'settings.get');
    check(
        $intSnap['ok'] === true && $intSnap['playerId'] === '1042',
        'Numeric integer $playerId (1042) normalizes and persists cleanly',
    );

    // Invalid JSON import rejection
    $invalidRejected = false;
    try {
        $freshService->act('founder-player', 'settings.import_snapshot', ['json' => '{bad json']);
    } catch (InvalidArgumentException) {
        $invalidRejected = true;
    }
    check($invalidRejected, 'Malformed snapshot JSON is rejected with InvalidArgumentException');

    // SQL anti-pattern check on PlayerSettingsService.php
    $sourceCode = (string) file_get_contents(dirname(__DIR__) . '/src/Core/Game/PlayerSettingsService.php');
    check(
        preg_match('/\b(?:MAX|MIN)\s*\([^,]+,[^)]+\)/i', $sourceCode) === 0,
        'Zero 2-argument SQLite MAX(a,b)/MIN(a,b) scalar calls in PlayerSettingsService.php (PostgreSQL 16 safe)',
    );
} finally {
    if (is_file($databasePath)) {
        @unlink($databasePath);
    }
}

fwrite(STDOUT, "\nPlayerSettingsTest Summary: {$passed} passed, {$failed} failed.\n");
exit($failed > 0 ? 1 : 0);
