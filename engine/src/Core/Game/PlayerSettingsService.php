<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Closure;
use InvalidArgumentException;
use JsonException;
use Throwable;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * ZONE v159 — Wave-3 Track 13: First-Class Player Settings Center, Global Audio Gate & PostgreSQL 16 ProfileStore
 * ===============================================================================================================
 * Canonical Namespace: `Zone\Engine\Core\Game\PlayerSettingsService`
 * Alias Registered:    `Zone\Core\Game\PlayerSettingsService`
 *
 * Skills Applied:
 *   - `skyrim-mcm`: Multi-page Mod Configuration Menu schema (`minMcmVersion: 7`) with Hungarian-notation control IDs
 *   - `config-snapshot-manager`: Versioned `current-working` / release snapshot pointer & JSON export/import workflow
 *   - `profilestore`: Session-locked player profile persistence with monotonically increasing revision counter
 *   - `dsp-cookbook` & `audio-engineering-patterns`: Calibrated Master, SFX, Music & Pier 4 Room Ambience gain stages
 *   - `game-controller-input-workflow`: Remappable keyboard hotkeys & Gamepad (`navigator.getGamepads`) polling settings
 *   - `psych-accessibility`: Colorblind filters, Reduced Motion, High-Contrast Ink & UI Text Scale (95% / 100% / 110%)
 *
 * @integrator Route Wiring Guide (`engine/router.php` + `GameEngine.php`):
 * -----------------------------------------------------------------------------------------
 * Constructor:
 *   `$settings = new PlayerSettingsService($this->database, $this->events);`
 *
 * Unified Router Dispatch:
 *   1. `GET /api/v1/settings` (or `settings.get`):
 *      `$settings->snapshot($playerId)`
 *   2. `POST /api/v1/settings/action` (`settings.get`, `settings.save`, `settings.reset`, `settings.import_snapshot`, `settings.export_snapshot`):
 *      `$settings->act($playerId, (string) ($body['action'] ?? 'settings.save'), $body)`
 *
 * Database Dual-Compatibility (PostgreSQL 16 + SQLite 3):
 *   - Idempotent `player_settings` DDL on construction.
 *   - Zero two-argument SQLite scalar `MAX` / `MIN` functions in SQL queries.
 *   - Strictly unique named PDO placeholders per SQL statement.
 */
final class PlayerSettingsService
{
    public const SCHEMA_VERSION = 2;
    public const DEFAULT_SNAPSHOT_ID = 'current-working';

    public const VALID_QUALITY_PRESETS = ['low', 'medium', 'high', 'ultra'];
    public const VALID_THEMES = ['dark', 'light'];
    public const VALID_LANGUAGES = ['en', 'ar'];
    public const VALID_COLORBLIND_MODES = ['standard', 'deuteranopia', 'protanopia', 'tritanopia'];
    public const VALID_TEXT_SCALES = [95, 100, 110];

    public const DEFAULT_KEYBINDS = [
        'mute' => 'M',
        'settings' => ',',
        'comms' => 'C',
        'home' => '1',
        'items' => '2',
        'city' => '3',
        'gym' => '4',
        'crimes' => '5',
        'attack' => '6',
    ];

    /** @var array<int, bool> */
    private static array $schemaEnsured = [];

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?Closure $clock = null,
    ) {
        $this->ensureSchema();
    }

    public function ensureSchema(): void
    {
        $dbKey = spl_object_id($this->database);
        if (!empty(self::$schemaEnsured[$dbKey])) {
            return;
        }

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS player_settings (
                player_id VARCHAR(64) PRIMARY KEY,
                settings_json TEXT NOT NULL,
                schema_version INTEGER NOT NULL DEFAULT 1,
                snapshot_id VARCHAR(64) NOT NULL DEFAULT 'current-working',
                revision INTEGER NOT NULL DEFAULT 1,
                session_lock_id VARCHAR(64) NOT NULL DEFAULT '',
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        self::$schemaEnsured[$dbKey] = true;
    }

    /**
     * Canonical default 6-tab settings dictionary.
     *
     * @return array<string, mixed>
     */
    public static function defaultSettings(): array
    {
        return [
            'audio' => [
                'masterMuted' => false,
                'masterVolume' => 75,
                'sfxVolume' => 85,
                'musicEnabled' => false,
                'musicVolume' => 70,
                'ambienceVolume' => 0,
                'uiClicks' => false,
            ],
            'graphics' => [
                'qualityPreset' => 'high',
                'dynamicResScaler' => true,
                'particleDensity' => 80,
                'shadowsAndRim' => true,
                'showFpsCounter' => false,
            ],
            'gameplay' => [
                'theme' => 'dark',
                'language' => 'en',
                'highStakesConfirm' => true,
                'autoRecordReplays' => true,
                'showTickerBulletin' => true,
            ],
            'controls' => [
                'gamepadEnabled' => true,
                'allowBareHotkeys' => true,
                'keybinds' => self::DEFAULT_KEYBINDS,
            ],
            'accessibility' => [
                'colorblindMode' => 'standard',
                'reducedMotion' => false,
                'highContrast' => false,
                'textScale' => 100,
            ],
        ];
    }

    /**
     * Skyrim MCM Helper v7 compatible multi-page configuration descriptor (`skyrim-mcm` skill).
     *
     * @return array<string, mixed>
     */
    public static function mcmSchema(): array
    {
        return [
            'modName' => 'ZonePlayerSettings',
            'displayName' => 'ZONE Player Settings Center',
            'minMcmVersion' => 7,
            'pages' => [
                [
                    'pageId' => 'audio',
                    'pageDisplayName' => 'Audio & DSP Mixer',
                    'pageDisplayNameAr' => 'الصوت ومازج الإشارة الرقمية',
                    'content' => [
                        ['type' => 'toggle', 'id' => 'bMasterMuted', 'path' => 'audio.masterMuted', 'text' => 'Global Master Mute'],
                        ['type' => 'slider', 'id' => 'fMasterVolume', 'path' => 'audio.masterVolume', 'text' => 'Master Volume', 'min' => 0, 'max' => 100, 'step' => 1],
                        ['type' => 'slider', 'id' => 'fSfxVolume', 'path' => 'audio.sfxVolume', 'text' => 'Tactical SFX Volume', 'min' => 0, 'max' => 100, 'step' => 1],
                        ['type' => 'toggle', 'id' => 'bMusicEnabled', 'path' => 'audio.musicEnabled', 'text' => 'Adaptive Noir Music'],
                        ['type' => 'slider', 'id' => 'fMusicVolume', 'path' => 'audio.musicVolume', 'text' => 'Noir Music Stem Volume', 'min' => 0, 'max' => 100, 'step' => 1],
                        ['type' => 'slider', 'id' => 'fAmbienceVolume', 'path' => 'audio.ambienceVolume', 'text' => 'Pier 4 / City Room Ambience', 'min' => 0, 'max' => 100, 'step' => 1],
                        ['type' => 'toggle', 'id' => 'bUiClicks', 'path' => 'audio.uiClicks', 'text' => 'UI Navigation Clicks'],
                    ],
                ],
                [
                    'pageId' => 'graphics',
                    'pageDisplayName' => '3D Graphics & Performance',
                    'pageDisplayNameAr' => 'الرسومات ثلاثية الأبعاد والأداء',
                    'content' => [
                        ['type' => 'dropdown', 'id' => 'sQualityPreset', 'path' => 'graphics.qualityPreset', 'text' => '3D Quality Preset', 'options' => self::VALID_QUALITY_PRESETS],
                        ['type' => 'toggle', 'id' => 'bDynamicResScaler', 'path' => 'graphics.dynamicResScaler', 'text' => 'Dynamic Resolution Scaler (Auto 60fps Target)'],
                        ['type' => 'slider', 'id' => 'fParticleDensity', 'path' => 'graphics.particleDensity', 'text' => 'Particle & Gouache FX Density', 'min' => 0, 'max' => 100, 'step' => 5],
                        ['type' => 'toggle', 'id' => 'bShadowsAndRim', 'path' => 'graphics.shadowsAndRim', 'text' => 'Realtime Shadows & Rim Shaders'],
                        ['type' => 'toggle', 'id' => 'bShowFpsCounter', 'path' => 'graphics.showFpsCounter', 'text' => 'Live FPS & Draw-Call Counter Overlay'],
                    ],
                ],
                [
                    'pageId' => 'gameplay',
                    'pageDisplayName' => 'Gameplay & Safety',
                    'pageDisplayNameAr' => 'أسلوب اللعب والأمان',
                    'content' => [
                        ['type' => 'dropdown', 'id' => 'sTheme', 'path' => 'gameplay.theme', 'text' => 'Visual Theme', 'options' => self::VALID_THEMES],
                        ['type' => 'dropdown', 'id' => 'sLanguage', 'path' => 'gameplay.language', 'text' => 'Interface Language', 'options' => self::VALID_LANGUAGES],
                        ['type' => 'toggle', 'id' => 'bHighStakesConfirm', 'path' => 'gameplay.highStakesConfirm', 'text' => 'High-Stakes Spend Confirmation (> $50,000 / Merits)'],
                        ['type' => 'toggle', 'id' => 'bAutoRecordReplays', 'path' => 'gameplay.autoRecordReplays', 'text' => 'Auto-Record Combat Replays'],
                        ['type' => 'toggle', 'id' => 'bShowTickerBulletin', 'path' => 'gameplay.showTickerBulletin', 'text' => 'Show Syndicate Ticker Bulletin'],
                    ],
                ],
                [
                    'pageId' => 'controls',
                    'pageDisplayName' => 'Controls & Gamepad',
                    'pageDisplayNameAr' => 'التحكم وذراع الألعاب',
                    'content' => [
                        ['type' => 'toggle', 'id' => 'bGamepadEnabled', 'path' => 'controls.gamepadEnabled', 'text' => 'Enable Gamepad Polling (navigator.getGamepads)'],
                        ['type' => 'toggle', 'id' => 'bAllowBareHotkeys', 'path' => 'controls.allowBareHotkeys', 'text' => 'Single-Key Quick Hotkeys Outside Inputs'],
                        ['type' => 'keymap', 'id' => 'sKeyMute', 'path' => 'controls.keybinds.mute', 'text' => 'Global Mute Toggle'],
                        ['type' => 'keymap', 'id' => 'sKeySettings', 'path' => 'controls.keybinds.settings', 'text' => 'Open Settings Modal'],
                        ['type' => 'keymap', 'id' => 'sKeyComms', 'path' => 'controls.keybinds.comms', 'text' => 'Syndicate Comms'],
                        ['type' => 'keymap', 'id' => 'sKeyHome', 'path' => 'controls.keybinds.home', 'text' => 'Home Screen'],
                        ['type' => 'keymap', 'id' => 'sKeyItems', 'path' => 'controls.keybinds.items', 'text' => 'Items & Loadout'],
                        ['type' => 'keymap', 'id' => 'sKeyCity', 'path' => 'controls.keybinds.city', 'text' => 'City Map'],
                        ['type' => 'keymap', 'id' => 'sKeyGym', 'path' => 'controls.keybinds.gym', 'text' => 'Iron Pit Gym'],
                        ['type' => 'keymap', 'id' => 'sKeyCrimes', 'path' => 'controls.keybinds.crimes', 'text' => 'Crimes & Heists'],
                        ['type' => 'keymap', 'id' => 'sKeyAttack', 'path' => 'controls.keybinds.attack', 'text' => 'Combat Arena'],
                    ],
                ],
                [
                    'pageId' => 'accessibility',
                    'pageDisplayName' => 'Accessibility',
                    'pageDisplayNameAr' => 'إمكانية الوصول الشامل',
                    'content' => [
                        ['type' => 'dropdown', 'id' => 'sColorblindMode', 'path' => 'accessibility.colorblindMode', 'text' => 'Colorblind Filter', 'options' => self::VALID_COLORBLIND_MODES],
                        ['type' => 'toggle', 'id' => 'bReducedMotion', 'path' => 'accessibility.reducedMotion', 'text' => 'Reduced Motion & Camera Shake'],
                        ['type' => 'toggle', 'id' => 'bHighContrast', 'path' => 'accessibility.highContrast', 'text' => 'High-Contrast Fountain Ink'],
                        ['type' => 'dropdown', 'id' => 'iTextScale', 'path' => 'accessibility.textScale', 'text' => 'UI Text Scale (%)', 'options' => self::VALID_TEXT_SCALES],
                    ],
                ],
                [
                    'pageId' => 'cloud',
                    'pageDisplayName' => 'Cloud Sync & Config Snapshots',
                    'pageDisplayNameAr' => 'المزامنة السحابية ولقطات الإعدادات',
                    'content' => [],
                ],
            ],
        ];
    }

    /**
     * Deeply validates and normalizes incoming settings against defaults & allowed bounds.
     * Supports both nested category structure (`audio.masterMuted`) and flat MCM Hungarian keys (`bMasterMuted`).
     *
     * @param array<string, mixed> $input
     * @param array<string, mixed>|null $base
     * @return array<string, mixed>
     */
    public static function sanitizeSettings(array $input, ?array $base = null): array
    {
        $defaults = self::defaultSettings();
        $cur = is_array($base) ? self::mergeDefaults($defaults, $base) : $defaults;

        // If caller passed a wrapped payload like ['settings' => [...]], unwrap automatically
        if (isset($input['settings']) && is_array($input['settings']) && !isset($input['audio']) && !isset($input['graphics'])) {
            $input = $input['settings'];
        }

        // Map optional Skyrim MCM Hungarian flat keys if supplied
        $input = self::expandMcmFlatKeys($input);

        // 1. Audio & DSP Mixer
        if (isset($input['audio']) && is_array($input['audio'])) {
            $a = $input['audio'];
            if (array_key_exists('masterMuted', $a)) {
                $cur['audio']['masterMuted'] = self::toBool($a['masterMuted']);
            }
            if (array_key_exists('masterVolume', $a)) {
                $cur['audio']['masterVolume'] = self::clampInt($a['masterVolume'], 0, 100, $cur['audio']['masterVolume']);
            }
            if (array_key_exists('sfxVolume', $a)) {
                $cur['audio']['sfxVolume'] = self::clampInt($a['sfxVolume'], 0, 100, $cur['audio']['sfxVolume']);
            }
            if (array_key_exists('musicEnabled', $a)) {
                $cur['audio']['musicEnabled'] = self::toBool($a['musicEnabled']);
            }
            if (array_key_exists('musicVolume', $a)) {
                $cur['audio']['musicVolume'] = self::clampInt($a['musicVolume'], 0, 100, $cur['audio']['musicVolume']);
            }
            if (array_key_exists('ambienceVolume', $a)) {
                $cur['audio']['ambienceVolume'] = self::clampInt($a['ambienceVolume'], 0, 100, $cur['audio']['ambienceVolume']);
            }
            if (array_key_exists('uiClicks', $a)) {
                $cur['audio']['uiClicks'] = self::toBool($a['uiClicks']);
            }
        }

        // 2. 3D Graphics & Performance
        if (isset($input['graphics']) && is_array($input['graphics'])) {
            $g = $input['graphics'];
            if (isset($g['qualityPreset']) && is_string($g['qualityPreset'])) {
                $preset = strtolower(trim($g['qualityPreset']));
                if (in_array($preset, self::VALID_QUALITY_PRESETS, true)) {
                    $cur['graphics']['qualityPreset'] = $preset;
                }
            }
            if (array_key_exists('dynamicResScaler', $g)) {
                $cur['graphics']['dynamicResScaler'] = self::toBool($g['dynamicResScaler']);
            }
            if (array_key_exists('particleDensity', $g)) {
                $cur['graphics']['particleDensity'] = self::clampInt($g['particleDensity'], 0, 100, $cur['graphics']['particleDensity']);
            }
            if (array_key_exists('shadowsAndRim', $g)) {
                $cur['graphics']['shadowsAndRim'] = self::toBool($g['shadowsAndRim']);
            }
            if (array_key_exists('showFpsCounter', $g)) {
                $cur['graphics']['showFpsCounter'] = self::toBool($g['showFpsCounter']);
            }
        }

        // 3. Gameplay & Safety
        if (isset($input['gameplay']) && is_array($input['gameplay'])) {
            $gp = $input['gameplay'];
            if (isset($gp['theme']) && is_string($gp['theme'])) {
                $th = strtolower(trim($gp['theme']));
                if (in_array($th, self::VALID_THEMES, true)) {
                    $cur['gameplay']['theme'] = $th;
                }
            }
            if (isset($gp['language']) && is_string($gp['language'])) {
                $lang = strtolower(trim($gp['language']));
                if (in_array($lang, self::VALID_LANGUAGES, true)) {
                    $cur['gameplay']['language'] = $lang;
                }
            }
            if (array_key_exists('highStakesConfirm', $gp)) {
                $cur['gameplay']['highStakesConfirm'] = self::toBool($gp['highStakesConfirm']);
            }
            if (array_key_exists('autoRecordReplays', $gp)) {
                $cur['gameplay']['autoRecordReplays'] = self::toBool($gp['autoRecordReplays']);
            }
            if (array_key_exists('showTickerBulletin', $gp)) {
                $cur['gameplay']['showTickerBulletin'] = self::toBool($gp['showTickerBulletin']);
            }
        }

        // 4. Controls & Gamepad
        if (isset($input['controls']) && is_array($input['controls'])) {
            $c = $input['controls'];
            if (array_key_exists('gamepadEnabled', $c)) {
                $cur['controls']['gamepadEnabled'] = self::toBool($c['gamepadEnabled']);
            }
            if (array_key_exists('allowBareHotkeys', $c)) {
                $cur['controls']['allowBareHotkeys'] = self::toBool($c['allowBareHotkeys']);
            }
            if (isset($c['keybinds']) && is_array($c['keybinds'])) {
                foreach (self::DEFAULT_KEYBINDS as $actionKey => $defaultKey) {
                    if (isset($c['keybinds'][$actionKey]) && is_scalar($c['keybinds'][$actionKey])) {
                        $cleanBind = self::sanitizeKeybind((string) $c['keybinds'][$actionKey], $defaultKey);
                        $cur['controls']['keybinds'][$actionKey] = $cleanBind;
                    }
                }
            }
        }

        // 5. Accessibility
        if (isset($input['accessibility']) && is_array($input['accessibility'])) {
            $acc = $input['accessibility'];
            if (isset($acc['colorblindMode']) && is_string($acc['colorblindMode'])) {
                $cb = strtolower(trim($acc['colorblindMode']));
                if (in_array($cb, self::VALID_COLORBLIND_MODES, true)) {
                    $cur['accessibility']['colorblindMode'] = $cb;
                }
            }
            if (array_key_exists('reducedMotion', $acc)) {
                $cur['accessibility']['reducedMotion'] = self::toBool($acc['reducedMotion']);
            }
            if (array_key_exists('highContrast', $acc)) {
                $cur['accessibility']['highContrast'] = self::toBool($acc['highContrast']);
            }
            if (array_key_exists('textScale', $acc)) {
                $scale = (int) $acc['textScale'];
                if (in_array($scale, self::VALID_TEXT_SCALES, true)) {
                    $cur['accessibility']['textScale'] = $scale;
                }
            }
        }

        return $cur;
    }

    /**
     * Read-only or initialized ProfileStore snapshot for `$playerId`.
     *
     * @return array<string, mixed>
     */
    public function snapshot(int|string $playerId): array
    {
        $cleanId = $this->normalizePlayerId($playerId);
        $row = $this->loadOrCreateRow($cleanId);
        return $this->formatSnapshotResponse($cleanId, $row);
    }

    /**
     * Save partial or full settings update into PostgreSQL 16 / SQLite ProfileStore.
     *
     * @param array<string, mixed> $patch
     * @return array<string, mixed>
     */
    public function save(int|string $playerId, array $patch, ?string $snapshotId = null): array
    {
        $cleanId = $this->normalizePlayerId($playerId);
        $nowIso = gmdate('c', $this->nowSec());

        $updatedRow = $this->database->playerTransaction($cleanId, function () use ($cleanId, $patch, $snapshotId, $nowIso): array {
            $existing = $this->loadOrCreateRow($cleanId);
            $currentSettings = $this->decodeSettingsJson((string) ($existing['settings_json'] ?? ''));
            $nextSettings = self::sanitizeSettings($patch, $currentSettings);
            $nextRevision = ((int) ($existing['revision'] ?? 1)) + 1;
            $nextSnapshotId = $snapshotId !== null && trim($snapshotId) !== ''
                ? $this->sanitizeSnapshotId($snapshotId)
                : (string) ($existing['snapshot_id'] ?? self::DEFAULT_SNAPSHOT_ID);
            $lockId = 'ps_' . substr(hash('sha256', $cleanId . ':' . $nextRevision . ':' . $nowIso), 0, 16);
            $encoded = json_encode($nextSettings, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);

            $this->database->execute(
                'UPDATE player_settings
                 SET settings_json = :sjson,
                     schema_version = :sver,
                     snapshot_id = :snapId,
                     revision = :rev,
                     session_lock_id = :lockId,
                     updated_at = :updAt
                 WHERE player_id = :pid',
                [
                    'sjson' => $encoded,
                    'sver' => self::SCHEMA_VERSION,
                    'snapId' => $nextSnapshotId,
                    'rev' => $nextRevision,
                    'lockId' => $lockId,
                    'updAt' => $nowIso,
                    'pid' => $cleanId,
                ],
            );

            $this->events->publish(new DomainEvent('PlayerSettingsUpdated', [
                'playerId' => $cleanId,
                'revision' => $nextRevision,
                'snapshotId' => $nextSnapshotId,
                'masterMuted' => (bool) $nextSettings['audio']['masterMuted'],
                'qualityPreset' => (string) $nextSettings['graphics']['qualityPreset'],
                'theme' => (string) $nextSettings['gameplay']['theme'],
                'language' => (string) $nextSettings['gameplay']['language'],
            ]));

            return [
                'player_id' => $cleanId,
                'settings_json' => $encoded,
                'schema_version' => self::SCHEMA_VERSION,
                'snapshot_id' => $nextSnapshotId,
                'revision' => $nextRevision,
                'session_lock_id' => $lockId,
                'updated_at' => $nowIso,
            ];
        });

        return $this->formatSnapshotResponse($cleanId, $updatedRow);
    }

    /**
     * Reset a player's settings back to canonical factory defaults.
     *
     * @return array<string, mixed>
     */
    public function reset(int|string $playerId): array
    {
        $cleanId = $this->normalizePlayerId($playerId);
        $defaults = self::defaultSettings();
        $nowIso = gmdate('c', $this->nowSec());

        $updatedRow = $this->database->playerTransaction($cleanId, function () use ($cleanId, $defaults, $nowIso): array {
            $existing = $this->loadOrCreateRow($cleanId);
            $nextRevision = ((int) ($existing['revision'] ?? 1)) + 1;
            $lockId = 'ps_reset_' . substr(hash('sha256', $cleanId . ':' . $nextRevision), 0, 12);
            $encoded = json_encode($defaults, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);

            $this->database->execute(
                'UPDATE player_settings
                 SET settings_json = :sjson,
                     schema_version = :sver,
                     snapshot_id = :snapId,
                     revision = :rev,
                     session_lock_id = :lockId,
                     updated_at = :updAt
                 WHERE player_id = :pid',
                [
                    'sjson' => $encoded,
                    'sver' => self::SCHEMA_VERSION,
                    'snapId' => self::DEFAULT_SNAPSHOT_ID,
                    'rev' => $nextRevision,
                    'lockId' => $lockId,
                    'updAt' => $nowIso,
                    'pid' => $cleanId,
                ],
            );

            $this->events->publish(new DomainEvent('PlayerSettingsReset', [
                'playerId' => $cleanId,
                'revision' => $nextRevision,
            ]));

            return [
                'player_id' => $cleanId,
                'settings_json' => $encoded,
                'schema_version' => self::SCHEMA_VERSION,
                'snapshot_id' => self::DEFAULT_SNAPSHOT_ID,
                'revision' => $nextRevision,
                'session_lock_id' => $lockId,
                'updated_at' => $nowIso,
            ];
        });

        return $this->formatSnapshotResponse($cleanId, $updatedRow);
    }

    /**
     * Export portable config snapshot package (`config-snapshot-manager` workflow).
     *
     * @return array<string, mixed>
     */
    public function exportSnapshot(int|string $playerId): array
    {
        $snap = $this->snapshot($playerId);
        $checksum = hash('sha256', json_encode($snap['settings'], JSON_THROW_ON_ERROR));

        return [
            'ok' => true,
            'playerId' => $snap['playerId'],
            'snapshot' => [
                'meta' => [
                    'id' => $snap['snapshotId'],
                    'version' => '159.0',
                    'schemaVersion' => self::SCHEMA_VERSION,
                    'status' => 'exported',
                    'basedOn' => self::DEFAULT_SNAPSHOT_ID,
                    'playerId' => $snap['playerId'],
                    'revision' => $snap['revision'],
                    'checksum' => $checksum,
                    'exportedAt' => gmdate('c', $this->nowSec()),
                ],
                'settings' => $snap['settings'],
            ],
        ];
    }

    /**
     * Import and activate a JSON or array config snapshot (`config-snapshot-manager` workflow).
     *
     * @param array<string, mixed>|string $snapshotPayload
     * @return array<string, mixed>
     */
    public function importSnapshot(int|string $playerId, array|string $snapshotPayload): array
    {
        if (is_string($snapshotPayload)) {
            $trimmed = trim($snapshotPayload);
            if ($trimmed === '') {
                throw new InvalidArgumentException('Config snapshot JSON cannot be empty.');
            }
            try {
                $decoded = json_decode($trimmed, true, 64, JSON_THROW_ON_ERROR);
            } catch (JsonException $e) {
                throw new InvalidArgumentException('Invalid config snapshot JSON: ' . $e->getMessage(), 0, $e);
            }
            if (!is_array($decoded)) {
                throw new InvalidArgumentException('Config snapshot JSON must decode to an object.');
            }
            $snapshotPayload = $decoded;
        }

        // Unwrap `snapshot` envelope if present
        $inner = isset($snapshotPayload['snapshot']) && is_array($snapshotPayload['snapshot'])
            ? $snapshotPayload['snapshot']
            : $snapshotPayload;

        $meta = isset($inner['meta']) && is_array($inner['meta']) ? $inner['meta'] : [];
        $settingsData = isset($inner['settings']) && is_array($inner['settings'])
            ? $inner['settings']
            : $inner;

        if (
            !isset($settingsData['audio'])
            && !isset($settingsData['graphics'])
            && !isset($settingsData['gameplay'])
            && !isset($settingsData['controls'])
            && !isset($settingsData['accessibility'])
            && !$this->hasMcmKeys($settingsData)
        ) {
            throw new InvalidArgumentException('Imported snapshot does not contain recognized ZONE player settings keys.');
        }

        $snapshotId = isset($meta['id']) && is_string($meta['id']) && trim($meta['id']) !== ''
            ? $this->sanitizeSnapshotId($meta['id'])
            : 'imported-' . substr(hash('sha256', json_encode($settingsData, JSON_THROW_ON_ERROR)), 0, 8);

        // Validate against defaults strictly (replacing all fields with sanitized imported state)
        $cleanSettings = self::sanitizeSettings($settingsData, self::defaultSettings());
        return $this->save($playerId, $cleanSettings, $snapshotId);
    }

    /**
     * Unified action dispatcher for `/api/v1/settings/action`.
     *
     * Supports:
     *   - `settings.get` / `get` / `snapshot`
     *   - `settings.save` / `save` / `update`
     *   - `settings.reset` / `reset`
     *   - `settings.import_snapshot` / `import_snapshot` / `import`
     *   - `settings.export_snapshot` / `export_snapshot` / `export`
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function act(int|string $playerId, string $action, array $payload = []): array
    {
        $norm = strtolower(trim($action));
        if ($norm === '' || $norm === 'settings.get' || $norm === 'get' || $norm === 'snapshot') {
            return $this->snapshot($playerId);
        }

        if ($norm === 'settings.save' || $norm === 'save' || $norm === 'update') {
            $patch = isset($payload['settings']) && is_array($payload['settings'])
                ? $payload['settings']
                : $payload;
            $snapId = isset($payload['snapshotId']) && is_string($payload['snapshotId'])
                ? $payload['snapshotId']
                : null;
            return $this->save($playerId, $patch, $snapId);
        }

        if ($norm === 'settings.reset' || $norm === 'reset') {
            return $this->reset($playerId);
        }

        if ($norm === 'settings.export_snapshot' || $norm === 'export_snapshot' || $norm === 'export') {
            return $this->exportSnapshot($playerId);
        }

        if ($norm === 'settings.import_snapshot' || $norm === 'import_snapshot' || $norm === 'import') {
            $rawSnap = $payload['snapshot'] ?? $payload['json'] ?? $payload['settings'] ?? $payload;
            if (!is_array($rawSnap) && !is_string($rawSnap)) {
                throw new InvalidArgumentException('settings.import_snapshot requires a snapshot object or JSON string.');
            }
            return $this->importSnapshot($playerId, $rawSnap);
        }

        throw new InvalidArgumentException("Unsupported player settings action: {$action}");
    }

    /**
     * @return array<string, mixed>
     */
    private function loadOrCreateRow(string $playerId): array
    {
        $row = $this->database->fetchOne(
            'SELECT player_id, settings_json, schema_version, snapshot_id, revision, session_lock_id, updated_at
             FROM player_settings
             WHERE player_id = :pid',
            ['pid' => $playerId],
        );

        if ($row !== null) {
            if ((int) ($row['schema_version'] ?? 1) < self::SCHEMA_VERSION) {
                $migrated = $this->decodeSettingsJson((string) ($row['settings_json'] ?? ''));
                $migrated['audio']['musicEnabled'] = false;
                $migrated['audio']['ambienceVolume'] = 0;
                $migrated['audio']['uiClicks'] = false;
                $encodedMigrated = json_encode($migrated, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
                $nowIso = gmdate('c', $this->nowSec());
                try {
                    $this->database->execute(
                        'UPDATE player_settings
                         SET settings_json = :sjson,
                             schema_version = :sver,
                             updated_at = :updAt
                         WHERE player_id = :pid',
                        [
                            'sjson' => $encodedMigrated,
                            'sver' => self::SCHEMA_VERSION,
                            'updAt' => $nowIso,
                            'pid' => $playerId,
                        ],
                    );
                } catch (Throwable) {
                }
                $row['settings_json'] = $encodedMigrated;
                $row['schema_version'] = self::SCHEMA_VERSION;
                $row['updated_at'] = $nowIso;
            }
            return $row;
        }

        $defaults = self::defaultSettings();
        $encoded = json_encode($defaults, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        $nowIso = gmdate('c', $this->nowSec());
        $lockId = 'ps_init_' . substr(hash('sha256', $playerId . ':' . $nowIso), 0, 12);

        try {
            $this->database->execute(
                'INSERT INTO player_settings (player_id, settings_json, schema_version, snapshot_id, revision, session_lock_id, updated_at)
                 VALUES (:pid, :sjson, :sver, :snapId, :rev, :lockId, :updAt)',
                [
                    'pid' => $playerId,
                    'sjson' => $encoded,
                    'sver' => self::SCHEMA_VERSION,
                    'snapId' => self::DEFAULT_SNAPSHOT_ID,
                    'rev' => 1,
                    'lockId' => $lockId,
                    'updAt' => $nowIso,
                ],
            );
        } catch (Throwable) {
            $retry = $this->database->fetchOne(
                'SELECT player_id, settings_json, schema_version, snapshot_id, revision, session_lock_id, updated_at
                 FROM player_settings
                 WHERE player_id = :pid',
                ['pid' => $playerId],
            );
            if ($retry !== null) {
                return $retry;
            }
        }

        return [
            'player_id' => $playerId,
            'settings_json' => $encoded,
            'schema_version' => self::SCHEMA_VERSION,
            'snapshot_id' => self::DEFAULT_SNAPSHOT_ID,
            'revision' => 1,
            'session_lock_id' => $lockId,
            'updated_at' => $nowIso,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatSnapshotResponse(string $playerId, array $row): array
    {
        $settings = $this->decodeSettingsJson((string) ($row['settings_json'] ?? ''));
        $rawRev = (int) ($row['revision'] ?? 1);
        $revision = $rawRev >= 1 ? $rawRev : 1;
        $snapshotId = (string) ($row['snapshot_id'] ?? self::DEFAULT_SNAPSHOT_ID);
        $lockId = (string) ($row['session_lock_id'] ?? '');
        $updatedAt = (string) ($row['updated_at'] ?? gmdate('c', $this->nowSec()));

        return [
            'ok' => true,
            'playerId' => $playerId,
            'schemaVersion' => self::SCHEMA_VERSION,
            'snapshotId' => $snapshotId,
            'revision' => $revision,
            'updatedAt' => $updatedAt,
            'settings' => $settings,
            'profileStore' => [
                'sessionActive' => true,
                'sessionLockId' => $lockId,
                'revision' => $revision,
                'autosaveMode' => 'immediate_transactional',
            ],
            'configPointer' => [
                'current' => $snapshotId,
                'registryVersion' => '159.0',
            ],
            'mcm' => self::mcmSchema(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeSettingsJson(string $rawJson): array
    {
        if (trim($rawJson) === '') {
            return self::defaultSettings();
        }
        try {
            $decoded = json_decode($rawJson, true, 32, JSON_THROW_ON_ERROR);
            if (!is_array($decoded)) {
                return self::defaultSettings();
            }
            return self::sanitizeSettings($decoded, self::defaultSettings());
        } catch (Throwable) {
            return self::defaultSettings();
        }
    }

    /**
     * @param array<string, mixed> $defaults
     * @param array<string, mixed> $existing
     * @return array<string, mixed>
     */
    private static function mergeDefaults(array $defaults, array $existing): array
    {
        $out = $defaults;
        foreach ($defaults as $cat => $fields) {
            if (!isset($existing[$cat]) || !is_array($existing[$cat]) || !is_array($fields)) {
                continue;
            }
            foreach ($fields as $k => $v) {
                if (!array_key_exists($k, $existing[$cat])) {
                    continue;
                }
                if (is_array($v) && is_array($existing[$cat][$k])) {
                    $out[$cat][$k] = array_merge($v, $existing[$cat][$k]);
                } else {
                    $out[$cat][$k] = $existing[$cat][$k];
                }
            }
        }
        return $out;
    }

    /**
     * Expands Skyrim MCM Hungarian control IDs (`bMasterMuted`, `fMasterVolume`, etc.) into nested categories.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    private static function expandMcmFlatKeys(array $input): array
    {
        $map = [
            'bMasterMuted' => ['audio', 'masterMuted'],
            'fMasterVolume' => ['audio', 'masterVolume'],
            'fSfxVolume' => ['audio', 'sfxVolume'],
            'bMusicEnabled' => ['audio', 'musicEnabled'],
            'fMusicVolume' => ['audio', 'musicVolume'],
            'fAmbienceVolume' => ['audio', 'ambienceVolume'],
            'bUiClicks' => ['audio', 'uiClicks'],
            'sQualityPreset' => ['graphics', 'qualityPreset'],
            'bDynamicResScaler' => ['graphics', 'dynamicResScaler'],
            'fParticleDensity' => ['graphics', 'particleDensity'],
            'bShadowsAndRim' => ['graphics', 'shadowsAndRim'],
            'bShowFpsCounter' => ['graphics', 'showFpsCounter'],
            'sTheme' => ['gameplay', 'theme'],
            'sLanguage' => ['gameplay', 'language'],
            'bHighStakesConfirm' => ['gameplay', 'highStakesConfirm'],
            'bAutoRecordReplays' => ['gameplay', 'autoRecordReplays'],
            'bShowTickerBulletin' => ['gameplay', 'showTickerBulletin'],
            'bGamepadEnabled' => ['controls', 'gamepadEnabled'],
            'bAllowBareHotkeys' => ['controls', 'allowBareHotkeys'],
            'sColorblindMode' => ['accessibility', 'colorblindMode'],
            'bReducedMotion' => ['accessibility', 'reducedMotion'],
            'bHighContrast' => ['accessibility', 'highContrast'],
            'iTextScale' => ['accessibility', 'textScale'],
        ];

        foreach ($map as $mcmKey => [$cat, $field]) {
            if (array_key_exists($mcmKey, $input)) {
                if (!isset($input[$cat]) || !is_array($input[$cat])) {
                    $input[$cat] = [];
                }
                if (!array_key_exists($field, $input[$cat])) {
                    $input[$cat][$field] = $input[$mcmKey];
                }
            }
        }

        return $input;
    }

    /**
     * @param array<string, mixed> $data
     */
    private function hasMcmKeys(array $data): bool
    {
        foreach (['bMasterMuted', 'fMasterVolume', 'sQualityPreset', 'sTheme', 'sColorblindMode'] as $k) {
            if (array_key_exists($k, $data)) {
                return true;
            }
        }
        return false;
    }

    private static function toBool(mixed $val): bool
    {
        if (is_bool($val)) {
            return $val;
        }
        if (is_int($val) || is_float($val)) {
            return ((int) $val) !== 0;
        }
        if (is_string($val)) {
            $norm = strtolower(trim($val));
            if (in_array($norm, ['1', 'true', 'yes', 'on'], true)) {
                return true;
            }
            if (in_array($norm, ['0', 'false', 'no', 'off', ''], true)) {
                return false;
            }
        }
        return (bool) $val;
    }

    private static function clampInt(mixed $val, int $min, int $max, int $fallback): int
    {
        if (!is_numeric($val)) {
            return $fallback;
        }
        $n = (int) round((float) $val);
        if ($n < $min) {
            return $min;
        }
        if ($n > $max) {
            return $max;
        }
        return $n;
    }

    private static function sanitizeKeybind(string $raw, string $fallback): string
    {
        $trimmed = trim($raw);
        if ($trimmed === '') {
            return $fallback;
        }
        if ($trimmed === ',' || $trimmed === '.' || $trimmed === '/' || $trimmed === ';') {
            return $trimmed;
        }
        $clean = preg_replace('/[^A-Za-z0-9_+,-]/', '', $trimmed);
        if ($clean === null || $clean === '') {
            return $fallback;
        }
        return strtoupper(substr($clean, 0, 16));
    }

    private function sanitizeSnapshotId(string $raw): string
    {
        $clean = preg_replace('/[^a-zA-Z0-9._-]/', '-', trim($raw));
        if ($clean === null || $clean === '') {
            return self::DEFAULT_SNAPSHOT_ID;
        }
        return substr(strtolower($clean), 0, 64);
    }

    private function normalizePlayerId(int|string $playerId): string
    {
        $clean = trim((string) $playerId);
        if ($clean === '' || strlen($clean) > 64 || !preg_match('/^[A-Za-z0-9_-]+$/D', $clean)) {
            throw new InvalidArgumentException('Invalid player identifier for PlayerSettingsService.');
        }
        return $clean;
    }

    private function nowSec(): int
    {
        if ($this->clock !== null) {
            return (int) floor((float) ($this->clock)());
        }
        return time();
    }
}

if (!class_exists('Zone\\Core\\Game\\PlayerSettingsService', false)) {
    class_alias(PlayerSettingsService::class, 'Zone\\Core\\Game\\PlayerSettingsService');
}
