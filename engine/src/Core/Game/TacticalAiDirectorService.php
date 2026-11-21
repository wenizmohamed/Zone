<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Closure;
use InvalidArgumentException;
use RuntimeException;
use Throwable;
use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * ZONE v155 — Track 4: Utility AI Nemesis Stances & Perception Stealth Heists Director
 * =====================================================================================
 * Canonical Namespace: `Zone\Engine\Core\Game\TacticalAiDirectorService`
 * Alias Registered:    `Zone\Core\Game\TacticalAiDirectorService`
 *
 * @integrator Route Wiring Guide (`engine/router.php` + `GameEngine.php` + `api/index.php`):
 * -----------------------------------------------------------------------------------------
 * Constructor:
 *   `$director = new TacticalAiDirectorService($this->database, $this->events);`
 *
 * Unified Router Dispatch (matches `AscensionEngineService` 1:1):
 *   1. `tactical.state` (`GET /api/v1/tactical?district=pier_4` or `POST` action `tactical.state`):
 *      `$director->snapshot($playerId, (string) ($_GET['district'] ?? $body['district'] ?? 'pier_4'))`
 *   2. `tactical.stealth_breach` (`POST /api/v1/tactical/action` with `{"action":"tactical.stealth_breach", ...}`):
 *      `$director->act($playerId, 'tactical.stealth_breach', $body)`
 *      (or direct: `$director->executeStealthBreach($playerId, $body)`)
 *   3. `tactical.maneuver` (`POST /api/v1/tactical/action` with `{"action":"tactical.maneuver","maneuver":"counter_parry", ...}`):
 *      `$director->act($playerId, 'tactical.maneuver', $body)`
 *      (or direct: `$director->executeCounterManeuver($playerId, (string) ($body['maneuver'] ?? ''), $body)`)
 *
 * Direct Public Domain API Methods:
 *   - `snapshot(int|string $playerId, string $district = 'pier_4'): array`
 *   - `act(int|string $playerId, string $action, array $payload = []): array`
 *   - `getStealthState(int|string $playerId, string $district = 'pier_4'): array`
 *   - `executeStealthBreach(int|string $playerId, array $payload = []): array`
 *   - `getTacticalEncounter(int|string $playerId, array $context = []): array`
 *   - `executeCounterManeuver(int|string $playerId, string $maneuver, array $context = []): array`
 *
 * Database Dual-Compatibility (PostgreSQL 16 + SQLite 3):
 *   - Idempotent `stealth_windows` & `tactical_encounters` DDL on construction.
 *   - Zero 2-argument SQLite scalar `MAX(a,b)` / `MIN(a,b)` functions (`CASE WHEN` only).
 *   - Strictly unique named PDO placeholders per SQL statement.
 */
final class TacticalAiDirectorService
{
    public const STEALTH_BREACH_NERVE_COST = 3;
    public const STEALTH_BREACH_COOLDOWN_SEC = 12;
    public const NOISE_DECAY_INTERVAL_SEC = 4;
    public const LAG_COMPENSATION_MAX_SEC = 0.35;

    public const MANEUVER_ENERGY_COST = 5;
    public const MANEUVER_COOLDOWN_SEC = 6;
    public const MAX_RIVAL_STIMS = 2;

    public const THREAT_CLEAR = 'CLEAR';
    public const THREAT_SUSPICIOUS = 'SUSPICIOUS';
    public const THREAT_HUNTED = 'HUNTED';

    /**
     * 6-District Perception Cone & Acoustic Baseline Profiles (`perception-system`).
     *
     * @var array<string, array{id: string, nameEn: string, nameAr: string, visionAngleDeg: float, sweepHz: float, ambientNoise: int, baseCash: int, baseXp: int}>
     */
    public const DISTRICTS = [
        'pier_4' => [
            'id' => 'pier_4',
            'nameEn' => 'Pier 4 Docks',
            'nameAr' => 'أرصفة الميناء ٤',
            'visionAngleDeg' => 58.0,
            'sweepHz' => 0.16,
            'ambientNoise' => 10,
            'baseCash' => 320,
            'baseXp' => 12,
        ],
        'neon_alley' => [
            'id' => 'neon_alley',
            'nameEn' => 'Neon Alley',
            'nameAr' => 'زقاق النيون',
            'visionAngleDeg' => 64.0,
            'sweepHz' => 0.20,
            'ambientNoise' => 16,
            'baseCash' => 380,
            'baseXp' => 14,
        ],
        'foundry' => [
            'id' => 'foundry',
            'nameEn' => 'Industrial Foundry',
            'nameAr' => 'المسبك الصناعي',
            'visionAngleDeg' => 52.0,
            'sweepHz' => 0.14,
            'ambientNoise' => 20,
            'baseCash' => 410,
            'baseXp' => 15,
        ],
        'old_harbor' => [
            'id' => 'old_harbor',
            'nameEn' => 'Harbor Warehouses',
            'nameAr' => 'مستودعات المرفأ',
            'visionAngleDeg' => 60.0,
            'sweepHz' => 0.18,
            'ambientNoise' => 12,
            'baseCash' => 350,
            'baseXp' => 13,
        ],
        'downtown' => [
            'id' => 'downtown',
            'nameEn' => 'Downtown Vault Corridor',
            'nameAr' => 'ممر خزائن وسط المدينة',
            'visionAngleDeg' => 72.0,
            'sweepHz' => 0.24,
            'ambientNoise' => 8,
            'baseCash' => 520,
            'baseXp' => 18,
        ],
        'cargo_bay' => [
            'id' => 'cargo_bay',
            'nameEn' => 'Pier 4 Cargo Bay',
            'nameAr' => 'رصيف الشحن الرابع',
            'visionAngleDeg' => 66.0,
            'sweepHz' => 0.21,
            'ambientNoise' => 14,
            'baseCash' => 450,
            'baseXp' => 16,
        ],
    ];

    /** @var array<string, array{mode: string, bonusPct: int, noiseDelta: int, nameEn: string, nameAr: string}> */
    public const CRIME_ENHANCERS = [
        'lockpick' => ['mode' => 'stealth', 'bonusPct' => 8, 'noiseDelta' => -6, 'nameEn' => 'Precision Lockpick Set', 'nameAr' => 'عدة فتح أقفال دقيقة'],
        'hacking_rig' => ['mode' => 'stealth', 'bonusPct' => 10, 'noiseDelta' => -8, 'nameEn' => 'Encrypted Cyberdeck', 'nameAr' => 'وحدة اختراق مشفرة'],
        'keycard' => ['mode' => 'stealth', 'bonusPct' => 9, 'noiseDelta' => -7, 'nameEn' => 'Cloned Vault Keycard', 'nameAr' => 'بطاقة خزنة مستنسخة'],
        'latex_gloves' => ['mode' => 'stealth', 'bonusPct' => 5, 'noiseDelta' => -4, 'nameEn' => 'Nitrile Ghost Gloves', 'nameAr' => 'قفازات تخفٍ صامتة'],
        'flashlight' => ['mode' => 'stealth', 'bonusPct' => 5, 'noiseDelta' => -3, 'nameEn' => 'UV Tactical Torch', 'nameAr' => 'كشاف تكتيكي خافت'],
        'skimmer' => ['mode' => 'stealth', 'bonusPct' => 7, 'noiseDelta' => -5, 'nameEn' => 'RFID Optical Skimmer', 'nameAr' => 'ناسخ بصري صامت'],
        'cut_throat_razor' => ['mode' => 'stealth', 'bonusPct' => 6, 'noiseDelta' => -4, 'nameEn' => 'Pocket Bypass Razor', 'nameAr' => 'شفرة قطع صامتة'],
        'drill' => ['mode' => 'loud', 'bonusPct' => 12, 'noiseDelta' => 26, 'nameEn' => 'Thermal Diamond Drill', 'nameAr' => 'مثقاب حراري ماسي'],
        'crowbar' => ['mode' => 'loud', 'bonusPct' => 8, 'noiseDelta' => 22, 'nameEn' => 'Forged Steel Crowbar', 'nameAr' => 'عتلة فولاذية ثقيلة'],
        'megaphone' => ['mode' => 'loud', 'bonusPct' => 6, 'noiseDelta' => 30, 'nameEn' => 'Shockwave Bullhorn', 'nameAr' => 'مكبر إرباك صوتي'],
    ];

    /**
     * 4 Utility AI Stances & Exact Counter-Maneuver Mapping (`utility-ai` + `behavior-trees` + `fsm`).
     *
     * @var array<string, array{
     *   id: string,
     *   counter: string,
     *   curvePrimary: string,
     *   nameEn: string,
     *   nameAr: string,
     *   telegraphEn: string,
     *   telegraphAr: string
     * }>
     */
    public const AI_STANCES = [
        'berserk_rush' => [
            'id' => 'berserk_rush',
            'counter' => 'counter_parry',
            'curvePrimary' => 'quadratic',
            'nameEn' => 'Berserk Rush',
            'nameAr' => 'اندفاع دموي شرس',
            'telegraphEn' => 'Rival lowers shoulder for a reckless close-quarters blitz!',
            'telegraphAr' => 'الخصم يندفع للأمام بهجوم قريب متهور لاختراق دفاعك!',
        ],
        'ballistic_guard' => [
            'id' => 'ballistic_guard',
            'counter' => 'armor_pierce',
            'curvePrimary' => 'linear',
            'nameEn' => 'Ballistic Guard',
            'nameAr' => 'تحصّن باليستي',
            'telegraphEn' => 'Rival braces behind reinforced Kevlar plating to absorb standard rounds.',
            'telegraphAr' => 'الخصم يتحصن خلف درع كيفلر مقوّى لامتصاص الطلقات العادية.',
        ],
        'flank_ambush' => [
            'id' => 'flank_ambush',
            'counter' => 'suppress_fire',
            'curvePrimary' => 'logistic',
            'nameEn' => 'Flank Ambush',
            'nameAr' => 'كمين التفافي خفي',
            'telegraphEn' => 'Rival slips into district smoke shadows to line up a flanking crossfire.',
            'telegraphAr' => 'الخصم يتسلل عبر دخان الزقاق للإطباق عليك من الخاصرة.',
        ],
        'stim_inject' => [
            'id' => 'stim_inject',
            'counter' => 'rush_interrupt',
            'curvePrimary' => 'logistic',
            'nameEn' => 'Stim Inject',
            'nameAr' => 'حقن منشط إسعافي',
            'telegraphEn' => 'Critical HP! Rival uncaps a combat trauma auto-injector to restore health.',
            'telegraphAr' => 'صحة حرجة! الخصم يجهز حاقن إسعاف قتالي لاستعادة صحته.',
        ],
    ];

    /**
     * 4 Player Tactical Counter-Maneuvers.
     *
     * @var array<string, array{id: string, countersStance: string, nameEn: string, nameAr: string, descEn: string, descAr: string, sfxCue: string}>
     */
    public const COUNTER_MANEUVERS = [
        'counter_parry' => [
            'id' => 'counter_parry',
            'countersStance' => 'berserk_rush',
            'nameEn' => 'Counter Parry',
            'nameAr' => 'صدّ وهجوم مرتد',
            'descEn' => 'Deflects Berserk Rush momentum into a 1.65x riposte.',
            'descAr' => 'يعكس اندفاع الخصم المتهور إلى ضربة مرتدة مضاعفة.',
            'sfxCue' => 'blade_slash',
        ],
        'armor_pierce' => [
            'id' => 'armor_pierce',
            'countersStance' => 'ballistic_guard',
            'nameEn' => 'Armor Pierce',
            'nameAr' => 'طلقة خارقة للدروع',
            'descEn' => 'Shatters Ballistic Guard Kevlar posture for full penetration.',
            'descAr' => 'يخترق التحصن الباليستي ويكسر صفائح الدرع مباشرة.',
            'sfxCue' => 'gunshot_rifle',
        ],
        'suppress_fire' => [
            'id' => 'suppress_fire',
            'countersStance' => 'flank_ambush',
            'nameEn' => 'Suppress Fire',
            'nameAr' => 'نيران قمعية كثيفة',
            'descEn' => 'Pins Flank Ambush in the open and denies shadow evasion.',
            'descAr' => 'يحاصر كمين الالتفاف ويجبر الخصم على التراجع مكشوفاً.',
            'sfxCue' => 'gunshot_pistol',
        ],
        'rush_interrupt' => [
            'id' => 'rush_interrupt',
            'countersStance' => 'stim_inject',
            'nameEn' => 'Rush Interrupt',
            'nameAr' => 'اقتحام قاطع للإسعاف',
            'descEn' => 'Smashes Stim Inject mid-syringe, canceling heal & burning the dose.',
            'descAr' => 'يحطم حاقن المنشط قبل استخدامه ويلغي شفاء الخصم.',
            'sfxCue' => 'heavy_bag_impact',
        ],
    ];

    /** @var array<int, bool> */
    private static array $schemaEnsured = [];

    private readonly Ledger $ledger;
    private readonly ResourceService $resources;
    private readonly LevelingService $leveling;
    private readonly CooldownService $cooldowns;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?Closure $random = null,
        private readonly ?Closure $clock = null,
    ) {
        $this->ledger = new Ledger($database);
        $this->resources = new ResourceService($database);
        $this->leveling = new LevelingService($database, $this->ledger, $events);
        $this->cooldowns = new CooldownService($database);
        $this->ensureSchema();
    }

    /**
     * Idempotently ensures PostgreSQL 16 & SQLite 3 schema tables (`stealth_windows`, `tactical_encounters`).
     */
    public function ensureSchema(): void
    {
        $dbKey = spl_object_id($this->database);
        if (!empty(self::$schemaEnsured[$dbKey])) {
            return;
        }

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS stealth_windows (
                player_id VARCHAR(64) NOT NULL,
                district_id VARCHAR(48) NOT NULL,
                noise_level INTEGER NOT NULL DEFAULT 0,
                threat_tier VARCHAR(24) NOT NULL DEFAULT 'CLEAR',
                clean_streak INTEGER NOT NULL DEFAULT 0,
                breaches_total INTEGER NOT NULL DEFAULT 0,
                alerts_total INTEGER NOT NULL DEFAULT 0,
                cooldown_until BIGINT NOT NULL DEFAULT 0,
                last_decay_at BIGINT NOT NULL DEFAULT 0,
                updated_at VARCHAR(40) NOT NULL,
                PRIMARY KEY (player_id, district_id)
            )"
        );

        $this->database->execute(
            'CREATE INDEX IF NOT EXISTS idx_stealth_windows_player ON stealth_windows (player_id)'
        );

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS tactical_encounters (
                player_id VARCHAR(64) PRIMARY KEY,
                nemesis_id VARCHAR(64) NOT NULL,
                nemesis_name_en VARCHAR(120) NOT NULL,
                nemesis_name_ar VARCHAR(120) NOT NULL,
                rival_hp INTEGER NOT NULL,
                rival_max_hp INTEGER NOT NULL,
                district_id VARCHAR(48) NOT NULL DEFAULT 'pier_4',
                district_heat INTEGER NOT NULL DEFAULT 20,
                active_stance VARCHAR(32) NOT NULL DEFAULT 'ballistic_guard',
                fsm_state VARCHAR(32) NOT NULL DEFAULT 'ENGAGED',
                bt_node VARCHAR(80) NOT NULL DEFAULT 'RootSelector>UtilitySelector>ballistic_guard',
                turn_count INTEGER NOT NULL DEFAULT 0,
                combo_chain INTEGER NOT NULL DEFAULT 0,
                stims_remaining INTEGER NOT NULL DEFAULT 2,
                cooldown_until BIGINT NOT NULL DEFAULT 0,
                scores_json TEXT NOT NULL,
                log_json TEXT NOT NULL,
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        self::$schemaEnsured[$dbKey] = true;
    }

    /**
     * Unified read snapshot returning both Perception Stealth state & Utility AI Encounter state.
     * Wire to `GET /api/v1/tactical` or action `tactical.state`.
     *
     * @return array<string, mixed>
     */
    public function snapshot(int|string $playerId, string $district = 'pier_4'): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $cleanDistrict = self::normalizeDistrictId($district);

        return [
            'ok' => true,
            'route' => 'tactical.state',
            'playerId' => $pid,
            'district' => $cleanDistrict,
            'stealth' => $this->getStealthState($pid, $cleanDistrict),
            'encounter' => $this->getTacticalEncounter($pid, ['district' => $cleanDistrict]),
            'maneuverCatalog' => array_values(self::COUNTER_MANEUVERS),
            'stanceCatalog' => array_values(self::AI_STANCES),
            'districtsCatalog' => array_values(self::DISTRICTS),
        ];
    }

    /**
     * Unified action dispatcher supporting `tactical.state`, `tactical.stealth_breach`, and `tactical.maneuver`.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function act(int|string $playerId, string $action, array $payload = []): array
    {
        $cleanAction = strtolower(trim($action));
        if ($cleanAction === '') {
            throw new InvalidArgumentException('Tactical action is required.');
        }

        $district = is_string($payload['district'] ?? null) ? $payload['district'] : 'pier_4';

        return match ($cleanAction) {
            'tactical.state', 'state' => $this->snapshot($playerId, $district),
            'tactical.stealth_breach', 'stealth_breach' => $this->executeStealthBreach($playerId, $payload),
            'tactical.maneuver', 'maneuver' => $this->executeCounterManeuver(
                $playerId,
                is_string($payload['maneuver'] ?? null) ? $payload['maneuver'] : '',
                $payload,
            ),
            default => throw new InvalidArgumentException("Unsupported tactical director action: {$action}"),
        };
    }

    /**
     * Perception Stealth Engine — Read & Decay Guard Vision Cone + Acoustic State (`perception-system` + `fsm`).
     *
     * @return array<string, mixed>
     */
    public function getStealthState(int|string $playerId, string $district = 'pier_4'): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $distId = self::normalizeDistrictId($district);
        $this->ensureProgressionBootstrapped($pid);

        return $this->database->playerTransaction($pid, function () use ($pid, $distId): array {
            $this->resources->regenerate($pid);
            $player = $this->loadPlayer($pid);
            [$progState] = $this->loadProgressionSafe($pid);
            $nowFloat = $this->nowFloat();
            $nowSec = (int) floor($nowFloat);

            $row = $this->loadAndDecayStealthWindow($pid, $distId, $nowSec);
            $cone = self::computeGuardVisionCone($distId, $nowFloat, (int) $row['noise_level']);
            $ownedEnhancers = $this->resolveOwnedCrimeEnhancers($progState);
            $passive = AscensionEngineService::computePassiveBonuses($progState, $nowSec);

            $cooldownRemaining = max(0, ((int) $row['cooldown_until']) - $nowSec);

            return $this->formatStealthView(
                $pid,
                $player,
                $distId,
                $row,
                $cone,
                $ownedEnhancers,
                (int) ($passive['stealthPct'] ?? 0),
                $cooldownRemaining,
                $nowFloat,
            );
        });
    }

    /**
     * Perception Stealth Engine — Server-Validated Timed Blind-Spot Heist Breach (`tactical.stealth_breach`).
     *
     * Grants verified `+15%` to `+35%` clean-breach XP & cash bonus multipliers when executed inside the
     * guard's blind-spot window while not HUNTED, gated by nerve cost (`3N`) and server cooldown (`12s`).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function executeStealthBreach(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $distId = self::normalizeDistrictId(is_string($payload['district'] ?? null) ? $payload['district'] : 'pier_4');
        $approachRaw = strtolower(trim((string) ($payload['approach'] ?? 'stealth')));
        $approach = in_array($approachRaw, ['stealth', 'loud'], true) ? $approachRaw : 'stealth';
        $requestedEnhancer = isset($payload['enhancerId']) && is_string($payload['enhancerId'])
            ? strtolower(trim($payload['enhancerId']))
            : '';

        $this->ensureProgressionBootstrapped($pid);

        return $this->database->playerTransaction($pid, function () use ($pid, $distId, $approach, $requestedEnhancer, $payload): array {
            $this->resources->regenerate($pid);
            $player = $this->loadPlayer($pid);
            [$progState, $progVersion] = $this->loadProgressionSafe($pid);
            $nowFloat = $this->nowFloat();
            $nowSec = (int) floor($nowFloat);
            $nowMs = $nowSec * 1000;

            $this->assertOperativeFree($progState, $nowMs);

            $row = $this->loadAndDecayStealthWindow($pid, $distId, $nowSec);
            $cooldownRem = max(0, ((int) $row['cooldown_until']) - $nowSec);
            if ($cooldownRem > 0) {
                throw new CooldownException('tactical.stealth_breach', $cooldownRem);
            }
            if ($this->clock === null) {
                $this->cooldowns->assertReady($pid, 'tactical.stealth_breach');
            }

            if ((int) $player['nerve'] < self::STEALTH_BREACH_NERVE_COST) {
                throw new RuntimeException(sprintf(
                    'Insufficient Nerve for stealth breach (%dN required, %dN available).',
                    self::STEALTH_BREACH_NERVE_COST,
                    (int) $player['nerve'],
                ));
            }

            // Lag-compensated server timestamp validation (rewinds at most ±0.35s RTT; never trusts client outcome booleans)
            $evalTimestamp = $nowFloat;
            if (isset($payload['clientPhaseTs']) && is_numeric($payload['clientPhaseTs'])) {
                $clientTs = (float) $payload['clientPhaseTs'];
                if ($clientTs > 1_000_000_000.0 && abs($nowFloat - $clientTs) <= self::LAG_COMPENSATION_MAX_SEC) {
                    $evalTimestamp = $clientTs;
                }
            }

            $noiseBefore = (int) $row['noise_level'];
            $threatBefore = self::resolveThreatTier($noiseBefore);
            $cone = self::computeGuardVisionCone($distId, $evalTimestamp, $noiseBefore);
            $inBlindSpot = (bool) $cone['inBlindSpot'];

            $ownedEnhancers = $this->resolveOwnedCrimeEnhancers($progState);
            $activeEnhancer = null;
            if ($requestedEnhancer !== '' && isset($ownedEnhancers[$requestedEnhancer])) {
                $activeEnhancer = $ownedEnhancers[$requestedEnhancer];
            } else {
                foreach ($ownedEnhancers as $enhSpec) {
                    if ($enhSpec['mode'] === $approach) {
                        $activeEnhancer = $enhSpec;
                        break;
                    }
                }
            }

            $passive = AscensionEngineService::computePassiveBonuses($progState, $nowSec);
            $passiveStealthPct = max(0, (int) ($passive['stealthPct'] ?? 0));

            $distSpec = self::DISTRICTS[$distId];
            $level = max(1, (int) $player['level']);
            $baseCash = (int) $distSpec['baseCash'] + ($level * 42);
            $baseXp = (int) $distSpec['baseXp'] + min(26, $level * 2);

            $cleanBreach = false;
            $bonusPct = 0;
            $bonusMultiplier = 1.0;
            $cashAwarded = 0;
            $xpAwarded = 0;
            $hpPenalty = 0;
            $cleanStreak = (int) $row['clean_streak'];
            $breachesTotal = (int) $row['breaches_total'];
            $alertsTotal = (int) $row['alerts_total'];

            if ($approach === 'stealth') {
                if ($inBlindSpot && $threatBefore !== self::THREAT_HUNTED) {
                    $cleanBreach = true;
                    $enhBonus = ($activeEnhancer !== null && $activeEnhancer['mode'] === 'stealth')
                        ? (int) $activeEnhancer['bonusPct']
                        : 0;
                    $quietBonus = $noiseBefore <= 20 ? 5 : ($noiseBefore <= 34 ? 2 : 0);
                    $streakBonus = min(6, $cleanStreak * 2);
                    $originBonus = min(4, intdiv($passiveStealthPct, 3));

                    // Verified clean-breach multiplier strictly clamped inside [+15%, +35%]
                    $bonusPct = max(15, min(35, 15 + $enhBonus + $quietBonus + $streakBonus + $originBonus));
                    $bonusMultiplier = round(1.0 + ($bonusPct / 100.0), 2);

                    $variance = $this->roll(95, 106) / 100.0;
                    $cashAwarded = max(120, (int) round($baseCash * $bonusMultiplier * $variance));
                    $xpAwarded = max(8, (int) round($baseXp * $bonusMultiplier));

                    $enhNoise = ($activeEnhancer !== null && $activeEnhancer['mode'] === 'stealth')
                        ? (int) $activeEnhancer['noiseDelta']
                        : 0;
                    $noiseAfter = max(0, min(100, $noiseBefore + max(4, 12 + $enhNoise)));
                    $cleanStreak++;
                    $breachesTotal++;
                    $outcomeCode = 'clean_ghost_breach';
                    $summaryEn = sprintf(
                        'Ghost Breach in Blind Spot! +%d%% Stealth Synergy · +$%s · +%d XP.',
                        $bonusPct,
                        number_format($cashAwarded),
                        $xpAwarded,
                    );
                    $summaryAr = sprintf(
                        'اختراق صامت في النقطة العمياء! مكافأة تخفٍ +%d%% · +$%s · +%d خبرة.',
                        $bonusPct,
                        number_format($cashAwarded),
                        $xpAwarded,
                    );
                } else {
                    // Caught inside guard spotlight cone or attempted stealth while HUNTED
                    $cleanBreach = false;
                    $bonusPct = 0;
                    $bonusMultiplier = 1.0;
                    $cashAwarded = 0;
                    $xpAwarded = 2;
                    $hpPenalty = max(1, min((int) $player['life'] - 1, (int) round(((int) $player['max_life']) * 0.04)));
                    $noiseAfter = max(0, min(100, $noiseBefore + 28));
                    $cleanStreak = 0;
                    $alertsTotal++;
                    $outcomeCode = $threatBefore === self::THREAT_HUNTED ? 'hunted_lockdown_spotted' : 'vision_cone_spotted';
                    $summaryEn = $threatBefore === self::THREAT_HUNTED
                        ? 'District is HUNTED! Guards locked the vault lane — wait for acoustic heat to cool or breach Loud.'
                        : 'Caught in Guard Vision Cone! Spotlight grazed you — time your breach inside the BLIND SPOT window.';
                    $summaryAr = $threatBefore === self::THREAT_HUNTED
                        ? 'المنطقة في حالة مطاردة قصوى! الحراس أغلقوا الممر — انتظر انخفاض الضوضاء أو نفّذ اقتحاماً صاخباً.'
                        : 'كشفك مخروط رؤية الحارس! أصبت بنيران تمشيط خفيفة — نفّذ الاختراق داخل النقطة العمياء.';
                }
            } else {
                // Loud forced breach (`approach === 'loud'`)
                $hasLoudTool = $activeEnhancer !== null && $activeEnhancer['mode'] === 'loud';
                if ($inBlindSpot && $hasLoudTool && $threatBefore !== self::THREAT_HUNTED) {
                    $cleanBreach = true;
                    $bonusPct = max(15, min(25, 15 + intdiv((int) $activeEnhancer['bonusPct'], 2)));
                    $bonusMultiplier = round(1.0 + ($bonusPct / 100.0), 2);
                } else {
                    $bonusPct = 0;
                    $bonusMultiplier = $threatBefore === self::THREAT_HUNTED ? 0.65 : 0.92;
                }

                $cashAwarded = max(60, (int) round($baseCash * $bonusMultiplier));
                $xpAwarded = max(5, (int) round($baseXp * max(0.8, $bonusMultiplier)));
                $toolNoise = $hasLoudTool ? (int) $activeEnhancer['noiseDelta'] : 28;
                $noiseAfter = max(0, min(100, $noiseBefore + max(20, $toolNoise)));
                $cleanStreak = 0;
                $breachesTotal++;
                if (!$inBlindSpot) {
                    $hpPenalty = max(0, min((int) $player['life'] - 1, (int) round(((int) $player['max_life']) * 0.03)));
                    $alertsTotal++;
                }
                $outcomeCode = $cleanBreach ? 'ambush_shock_breach' : 'loud_forced_breach';
                $summaryEn = sprintf(
                    'Loud Breach executed (%s)! +$%s · +%d XP · Noise spiked to %d/100.',
                    $hasLoudTool ? $activeEnhancer['nameEn'] : 'Forced Entry',
                    number_format($cashAwarded),
                    $xpAwarded,
                    $noiseAfter,
                );
                $summaryAr = sprintf(
                    'تم تنفيذ اقتحام صاخب! +$%s · +%d خبرة · ارتفعت الضوضاء إلى %d/100.',
                    number_format($cashAwarded),
                    $xpAwarded,
                    $noiseAfter,
                );
            }

            $threatAfter = self::resolveThreatTier($noiseAfter);
            $nextNerve = max(0, (int) $player['nerve'] - self::STEALTH_BREACH_NERVE_COST);
            $nextLife = max(1, (int) $player['life'] - $hpPenalty);
            $nextCash = (int) $player['cash'] + $cashAwarded;
            $nextXp = (int) $player['xp'] + $xpAwarded;
            $cooldownUntil = $nowSec + self::STEALTH_BREACH_COOLDOWN_SEC;
            $correlationId = bin2hex(random_bytes(16));

            $this->database->execute(
                'UPDATE players SET nerve = :nextNerve, life = :nextLife, cash = :nextCash, xp = :nextXp WHERE id = :pid',
                [
                    'nextNerve' => $nextNerve,
                    'nextLife' => $nextLife,
                    'nextCash' => $nextCash,
                    'nextXp' => $nextXp,
                    'pid' => $pid,
                ],
            );

            if ($cashAwarded > 0) {
                $this->ledger->record($pid, 'cash', $cashAwarded, $nextCash, 'tactical.stealth_breach', $correlationId);
            }

            $levelUp = null;
            if ($xpAwarded > 0) {
                $levelUp = $this->leveling->sync($pid, $correlationId);
            }

            $updatedRow = [
                'player_id' => $pid,
                'district_id' => $distId,
                'noise_level' => $noiseAfter,
                'threat_tier' => $threatAfter,
                'clean_streak' => $cleanStreak,
                'breaches_total' => $breachesTotal,
                'alerts_total' => $alertsTotal,
                'cooldown_until' => $cooldownUntil,
                'last_decay_at' => $nowSec,
                'updated_at' => gmdate('c', $nowSec),
            ];
            $this->upsertStealthWindow($updatedRow);

            if ($this->clock === null) {
                $this->cooldowns->arm($pid, 'tactical.stealth_breach', self::STEALTH_BREACH_COOLDOWN_SEC);
            }

            if ($progVersion > 0) {
                $progState['tactical'] = is_array($progState['tactical'] ?? null) ? $progState['tactical'] : [];
                $progState['tactical']['lastStealthBreach'] = [
                    'district' => $distId,
                    'cleanBreach' => $cleanBreach,
                    'bonusPct' => $bonusPct,
                    'at' => $nowSec,
                ];
                if ($cleanBreach && $bonusPct >= 15) {
                    $progState['tactical']['stealthBuff'] = [
                        'bonusPct' => $bonusPct,
                        'expiresAt' => $nowSec + 300,
                    ];
                }
                $this->saveProgressionSafe($pid, $progState, $progVersion, $nowSec);
            }

            $this->events->publish(new DomainEvent('StealthBreachExecuted', [
                'playerId' => $pid,
                'district' => $distId,
                'approach' => $approach,
                'inBlindSpot' => $inBlindSpot,
                'cleanBreach' => $cleanBreach,
                'bonusPct' => $bonusPct,
                'cashAwarded' => $cashAwarded,
                'xpAwarded' => $xpAwarded,
                'noiseBefore' => $noiseBefore,
                'noiseAfter' => $noiseAfter,
                'threatTier' => $threatAfter,
                'correlationId' => $correlationId,
            ]));

            $freshPlayer = $this->loadPlayer($pid);
            $freshCone = self::computeGuardVisionCone($distId, $nowFloat, $noiseAfter);

            return [
                'ok' => true,
                'route' => 'tactical.stealth_breach',
                'result' => [
                    'outcome' => $outcomeCode,
                    'approach' => $approach,
                    'inBlindSpot' => $inBlindSpot,
                    'cleanBreach' => $cleanBreach,
                    'bonusPct' => $bonusPct,
                    'bonusMultiplier' => $bonusMultiplier,
                    'enhancerUsed' => $activeEnhancer['id'] ?? null,
                    'nerveSpent' => self::STEALTH_BREACH_NERVE_COST,
                    'cashAwarded' => $cashAwarded,
                    'xpAwarded' => $xpAwarded,
                    'hpPenalty' => $hpPenalty,
                    'noiseBefore' => $noiseBefore,
                    'noiseAfter' => $noiseAfter,
                    'threatBefore' => $threatBefore,
                    'threatAfter' => $threatAfter,
                    'cooldownSeconds' => self::STEALTH_BREACH_COOLDOWN_SEC,
                    'levelUp' => $levelUp,
                    'summaryEn' => $summaryEn,
                    'summaryAr' => $summaryAr,
                    'serverProof' => [
                        'correlationId' => $correlationId,
                        'clientSuppliedOutcomeFields' => 0,
                    ],
                ],
                'player' => $freshPlayer,
                'stealth' => $this->formatStealthView(
                    $pid,
                    $freshPlayer,
                    $distId,
                    $updatedRow,
                    $freshCone,
                    $ownedEnhancers,
                    $passiveStealthPct,
                    self::STEALTH_BREACH_COOLDOWN_SEC,
                    $nowFloat,
                ),
            ];
        });
    }

    /**
     * Utility AI Combat & Nemesis Director — Get Scored Encounter & Enemy Intent (`utility-ai` + `behavior-trees`).
     *
     * @param array<string, mixed> $context
     * @return array<string, mixed>
     */
    public function getTacticalEncounter(int|string $playerId, array $context = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $this->ensureProgressionBootstrapped($pid);

        return $this->database->playerTransaction($pid, function () use ($pid, $context): array {
            $this->resources->regenerate($pid);
            $player = $this->loadPlayer($pid);
            [$progState] = $this->loadProgressionSafe($pid);
            $nowSec = $this->nowSec();

            $encounterRow = $this->loadOrCreateEncounter($pid, $player, $progState, $nowSec, $context);
            $blackboard = $this->buildBlackboard($pid, $player, $progState, $encounterRow, $nowSec);
            $scored = self::scoreUtilityStances($blackboard);

            // Sync active telegraphed stance when starting fresh or recovering from NEUTRALIZED
            if ((int) $encounterRow['rival_hp'] <= 0) {
                $encounterRow['rival_hp'] = (int) $encounterRow['rival_max_hp'];
                $encounterRow['stims_remaining'] = self::MAX_RIVAL_STIMS;
                $encounterRow['turn_count'] = 0;
                $encounterRow['combo_chain'] = 0;
                $blackboard = $this->buildBlackboard($pid, $player, $progState, $encounterRow, $nowSec);
                $scored = self::scoreUtilityStances($blackboard);
            }

            $encounterRow['active_stance'] = $scored['selectedStance'];
            $encounterRow['fsm_state'] = $scored['fsmState'];
            $encounterRow['bt_node'] = $scored['btNode'];
            $encounterRow['district_heat'] = (int) round($blackboard['districtHeat']);
            $encounterRow['scores_json'] = json_encode($scored['scores'], JSON_THROW_ON_ERROR);
            $encounterRow['updated_at'] = gmdate('c', $nowSec);
            $this->upsertEncounterRow($encounterRow);

            return $this->formatEncounterView($player, $encounterRow, $blackboard, $scored, $nowSec);
        });
    }

    /**
     * Utility AI Combat & Nemesis Director — Execute Atomic Counter-Maneuver (`tactical.maneuver`).
     *
     * Settles tactical exchanges atomically (`5E` cost, `6s` server cooldown, zero trust in client numbers),
     * applying counter-stance crits/mitigation, updating HP/XP/cash ledgers, and re-scoring the Nemesis's
     * next-turn Utility AI intent immediately.
     *
     * @param array<string, mixed> $context
     * @return array<string, mixed>
     */
    public function executeCounterManeuver(int|string $playerId, string $maneuver, array $context = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $cleanManeuver = strtolower(trim($maneuver));
        if (!isset(self::COUNTER_MANEUVERS[$cleanManeuver])) {
            throw new InvalidArgumentException(sprintf(
                'Invalid counter maneuver "%s". Expected one of: %s.',
                $maneuver,
                implode(', ', array_keys(self::COUNTER_MANEUVERS)),
            ));
        }

        $this->ensureProgressionBootstrapped($pid);

        return $this->database->playerTransaction($pid, function () use ($pid, $cleanManeuver, $context): array {
            $this->resources->regenerate($pid);
            $player = $this->loadPlayer($pid);
            [$progState] = $this->loadProgressionSafe($pid);
            $nowSec = $this->nowSec();
            $nowMs = $nowSec * 1000;

            $this->assertOperativeFree($progState, $nowMs);

            $encounterRow = $this->loadOrCreateEncounter($pid, $player, $progState, $nowSec, $context);
            $cooldownRem = max(0, ((int) $encounterRow['cooldown_until']) - $nowSec);
            if ($cooldownRem > 0) {
                throw new CooldownException('tactical.maneuver', $cooldownRem);
            }
            if ($this->clock === null) {
                $this->cooldowns->assertReady($pid, 'tactical.maneuver');
            }

            if ((int) $player['energy'] < self::MANEUVER_ENERGY_COST) {
                throw new RuntimeException(sprintf(
                    'Insufficient Energy for tactical maneuver (%dE required, %dE available).',
                    self::MANEUVER_ENERGY_COST,
                    (int) $player['energy'],
                ));
            }
            if ((int) $player['life'] < 1) {
                throw new RuntimeException('Recover Life before engaging in tactical combat.');
            }

            if ((int) $encounterRow['rival_hp'] <= 0) {
                $encounterRow['rival_hp'] = (int) $encounterRow['rival_max_hp'];
                $encounterRow['stims_remaining'] = self::MAX_RIVAL_STIMS;
                $encounterRow['turn_count'] = 0;
                $encounterRow['combo_chain'] = 0;
                $freshBoard = $this->buildBlackboard($pid, $player, $progState, $encounterRow, $nowSec);
                $freshScored = self::scoreUtilityStances($freshBoard);
                $encounterRow['active_stance'] = $freshScored['selectedStance'];
            }

            $lockedStance = (string) $encounterRow['active_stance'];
            if (!isset(self::AI_STANCES[$lockedStance])) {
                $lockedStance = 'ballistic_guard';
            }

            $stanceSpec = self::AI_STANCES[$lockedStance];
            $maneuverSpec = self::COUNTER_MANEUVERS[$cleanManeuver];
            $isPerfectCounter = $stanceSpec['counter'] === $cleanManeuver;

            $loadout = $this->resolveServerLoadout($progState);
            $weaponMult = max(1.0, (float) ($loadout['weaponMultiplier'] ?? 1.0));
            $armorRed = min(0.85, max(0.0, (float) ($loadout['armorReduction'] ?? 0.0)));

            $level = max(1, (int) $player['level']);
            $playerStr = max(10.0, (float) $player['strength']) * $weaponMult;
            $playerDef = max(10.0, (float) $player['defense']);
            $rivalMaxHp = max(100, (int) $encounterRow['rival_max_hp']);
            $rivalHpBefore = max(1, (int) $encounterRow['rival_hp']);
            $stimsBefore = max(0, (int) $encounterRow['stims_remaining']);
            $comboBefore = max(0, (int) $encounterRow['combo_chain']);

            $variance = $this->roll(94, 108) / 100.0;
            $basePlayerDmg = max(18, (int) round((22.0 + sqrt($playerStr) * 2.8 + ($rivalMaxHp * 0.11)) * $variance));
            $baseRivalDmg = max(8, (int) round((14.0 + ($level * 3.5) + ($rivalMaxHp * 0.045)) * (1.0 - $armorRed * 0.65)));

            $rivalHeal = 0;
            $stimsAfter = $stimsBefore;

            if ($isPerfectCounter) {
                $comboAfter = $comboBefore + 1;
                $comboMult = min(2.10, 1.65 + min(3, $comboBefore) * 0.12);
                $damageDealt = max(28, (int) round($basePlayerDmg * $comboMult));
                $damageTaken = max(2, (int) round($baseRivalDmg * 0.28));
                if ($lockedStance === 'stim_inject' && $stimsBefore > 0) {
                    // Interrupt smashes the rival's syringe before it heals!
                    $stimsAfter = $stimsBefore - 1;
                }
            } else {
                $comboAfter = 0;
                $stanceMitigation = $lockedStance === 'ballistic_guard' ? 0.52 : ($lockedStance === 'flank_ambush' ? 0.78 : 0.92);
                $stanceOffense = $lockedStance === 'berserk_rush' ? 1.38 : ($lockedStance === 'flank_ambush' ? 1.25 : 0.95);
                $damageDealt = max(10, (int) round($basePlayerDmg * $stanceMitigation));
                $damageTaken = max(5, (int) round($baseRivalDmg * $stanceOffense));

                if ($lockedStance === 'stim_inject' && $stimsBefore > 0) {
                    $rivalHeal = max(20, (int) round($rivalMaxHp * 0.22));
                    $stimsAfter = $stimsBefore - 1;
                    $damageTaken = max(3, (int) round($baseRivalDmg * 0.55));
                }
            }

            $rivalHpAfter = max(0, min($rivalMaxHp, $rivalHpBefore - $damageDealt + $rivalHeal));
            $victory = $rivalHpAfter === 0;
            if ($victory) {
                $damageTaken = (int) floor($damageTaken * 0.5);
            }

            $playerHpAfter = max(1, (int) $player['life'] - $damageTaken);
            $nextEnergy = max(0, (int) $player['energy'] - self::MANEUVER_ENERGY_COST);

            $cashAwarded = 0;
            $xpAwarded = 0;
            if ($victory) {
                $cashAwarded = 1200 + ($level * 220) + ($isPerfectCounter ? 450 : 0);
                $xpAwarded = 36 + ($level * 4) + ($isPerfectCounter ? 12 : 0);
                $ledgerReason = 'tactical.nemesis_takedown';
            } elseif ($isPerfectCounter) {
                $cashAwarded = 160 + ($level * 35) + min(240, $comboAfter * 55);
                $xpAwarded = 10 + min(18, $level + $comboAfter * 2);
                $ledgerReason = 'tactical.counter_bonus';
            } else {
                $cashAwarded = 0;
                $xpAwarded = 4;
                $ledgerReason = '';
            }

            $nextCash = (int) $player['cash'] + $cashAwarded;
            $nextXp = (int) $player['xp'] + $xpAwarded;
            $correlationId = bin2hex(random_bytes(16));

            $this->database->execute(
                'UPDATE players SET energy = :nextEnergy, life = :nextLife, cash = :nextCash, xp = :nextXp WHERE id = :pid',
                [
                    'nextEnergy' => $nextEnergy,
                    'nextLife' => $playerHpAfter,
                    'nextCash' => $nextCash,
                    'nextXp' => $nextXp,
                    'pid' => $pid,
                ],
            );

            if ($cashAwarded > 0 && $ledgerReason !== '') {
                $this->ledger->record($pid, 'cash', $cashAwarded, $nextCash, $ledgerReason, $correlationId);
            }

            $levelUp = null;
            if ($xpAwarded > 0) {
                $levelUp = $this->leveling->sync($pid, $correlationId);
            }

            if ($victory) {
                // Cool down district acoustic heat using portable ANSI CASE WHEN (zero 2-arg MAX/MIN!)
                $this->database->execute(
                    "UPDATE stealth_windows
                     SET noise_level = CASE WHEN noise_level > 20 THEN noise_level - 20 ELSE 0 END,
                         threat_tier = CASE
                             WHEN (CASE WHEN noise_level > 20 THEN noise_level - 20 ELSE 0 END) >= 70 THEN 'HUNTED'
                             WHEN (CASE WHEN noise_level > 20 THEN noise_level - 20 ELSE 0 END) >= 35 THEN 'SUSPICIOUS'
                             ELSE 'CLEAR'
                         END,
                         updated_at = :upd
                     WHERE player_id = :pid AND district_id = :dist",
                    [
                        'upd' => gmdate('c', $nowSec),
                        'pid' => $pid,
                        'dist' => (string) $encounterRow['district_id'],
                    ],
                );
            }

            $freshPlayer = $this->loadPlayer($pid);
            $turnAfter = ((int) $encounterRow['turn_count']) + 1;
            $cooldownUntil = $nowSec + self::MANEUVER_COOLDOWN_SEC;

            $encounterRow['rival_hp'] = $rivalHpAfter;
            $encounterRow['stims_remaining'] = $stimsAfter;
            $encounterRow['turn_count'] = $turnAfter;
            $encounterRow['combo_chain'] = $comboAfter;
            $encounterRow['cooldown_until'] = $cooldownUntil;

            // Score the NEXT turn's Utility AI stance immediately against updated HP%/Heat!
            $nextBlackboard = $this->buildBlackboard($pid, $freshPlayer, $progState, $encounterRow, $nowSec);
            $nextScored = self::scoreUtilityStances($nextBlackboard);

            $encounterRow['active_stance'] = $victory ? $lockedStance : $nextScored['selectedStance'];
            $encounterRow['fsm_state'] = $victory ? 'NEUTRALIZED' : $nextScored['fsmState'];
            $encounterRow['bt_node'] = $victory ? 'RootSelector>TerminalVictory' : $nextScored['btNode'];
            $encounterRow['district_heat'] = (int) round($nextBlackboard['districtHeat']);
            $encounterRow['scores_json'] = json_encode($nextScored['scores'], JSON_THROW_ON_ERROR);

            $prevLog = json_decode((string) ($encounterRow['log_json'] ?? '[]'), true);
            $logEntries = is_array($prevLog) ? $prevLog : [];
            $outcomeKey = $victory
                ? 'nemesis_neutralized'
                : ($isPerfectCounter ? 'perfect_counter' : 'glancing_exchange');

            $summaryEn = $victory
                ? sprintf(
                    'NEMESIS NEUTRALIZED! %s shattered %s for %d DMG · +$%s · +%d XP!',
                    $maneuverSpec['nameEn'],
                    $stanceSpec['nameEn'],
                    $damageDealt,
                    number_format($cashAwarded),
                    $xpAwarded,
                )
                : ($isPerfectCounter
                    ? sprintf(
                        'PERFECT COUNTER (x%d)! %s crushed %s · %d DMG dealt, %d DMG taken · +$%s · +%d XP.',
                        $comboAfter,
                        $maneuverSpec['nameEn'],
                        $stanceSpec['nameEn'],
                        $damageDealt,
                        $damageTaken,
                        number_format($cashAwarded),
                        $xpAwarded,
                    )
                    : sprintf(
                        'Off-stance exchange: %s vs %s · %d DMG dealt, %d DMG taken%s.',
                        $maneuverSpec['nameEn'],
                        $stanceSpec['nameEn'],
                        $damageDealt,
                        $damageTaken,
                        $rivalHeal > 0 ? " (Rival healed +{$rivalHeal} HP!)" : '',
                    ));

            $summaryAr = $victory
                ? sprintf(
                    'تم تحييد الخصم! حركة «%s» حطمت «%s» بضرر %d · +$%s · +%d خبرة!',
                    $maneuverSpec['nameAr'],
                    $stanceSpec['nameAr'],
                    $damageDealt,
                    number_format($cashAwarded),
                    $xpAwarded,
                )
                : ($isPerfectCounter
                    ? sprintf(
                        'رد تكتيكي مثالي (سلسلة x%d)! «%s» كسرت «%s» · ضرر %d · +$%s · +%d خبرة.',
                        $comboAfter,
                        $maneuverSpec['nameAr'],
                        $stanceSpec['nameAr'],
                        $damageDealt,
                        number_format($cashAwarded),
                        $xpAwarded,
                    )
                    : sprintf(
                        'اشتباك غير مضاد: «%s» ضد «%s» · ألحقت %d ضرراً وتلقيت %d%s.',
                        $maneuverSpec['nameAr'],
                        $stanceSpec['nameAr'],
                        $damageDealt,
                        $damageTaken,
                        $rivalHeal > 0 ? " (استعاد الخصم +{$rivalHeal} صحة!)" : '',
                    ));

            array_unshift($logEntries, [
                'turn' => $turnAfter,
                'maneuver' => $cleanManeuver,
                'counteredStance' => $lockedStance,
                'stanceFaced' => $lockedStance,
                'perfectCounter' => $isPerfectCounter,
                'outcome' => $outcomeKey,
                'damageDealt' => $damageDealt,
                'damageTaken' => $damageTaken,
                'rivalHeal' => $rivalHeal,
                'cashAwarded' => $cashAwarded,
                'xpAwarded' => $xpAwarded,
                'at' => $nowSec,
            ]);
            $encounterRow['log_json'] = json_encode(array_slice($logEntries, 0, 8), JSON_THROW_ON_ERROR);
            $encounterRow['updated_at'] = gmdate('c', $nowSec);
            $this->upsertEncounterRow($encounterRow);

            if ($this->clock === null) {
                $this->cooldowns->arm($pid, 'tactical.maneuver', self::MANEUVER_COOLDOWN_SEC);
            }

            $this->events->publish(new DomainEvent('TacticalManeuverResolved', [
                'playerId' => $pid,
                'maneuver' => $cleanManeuver,
                'stanceFaced' => $lockedStance,
                'perfectCounter' => $isPerfectCounter,
                'victory' => $victory,
                'damageDealt' => $damageDealt,
                'damageTaken' => $damageTaken,
                'cashAwarded' => $cashAwarded,
                'xpAwarded' => $xpAwarded,
                'nextStance' => $encounterRow['active_stance'],
                'correlationId' => $correlationId,
            ]));

            return [
                'ok' => true,
                'route' => 'tactical.maneuver',
                'result' => [
                    'outcome' => $outcomeKey,
                    'maneuver' => $cleanManeuver,
                    'stanceFaced' => $lockedStance,
                    'expectedCounter' => $stanceSpec['counter'],
                    'perfectCounter' => $isPerfectCounter,
                    'victory' => $victory,
                    'comboChain' => $comboAfter,
                    'energySpent' => self::MANEUVER_ENERGY_COST,
                    'damageDealt' => $damageDealt,
                    'damageTaken' => $damageTaken,
                    'rivalHeal' => $rivalHeal,
                    'rivalHpBefore' => $rivalHpBefore,
                    'rivalHpAfter' => $rivalHpAfter,
                    'playerHpAfter' => $playerHpAfter,
                    'cashAwarded' => $cashAwarded,
                    'xpAwarded' => $xpAwarded,
                    'nextEnemyIntent' => $encounterRow['active_stance'],
                    'sfxCue' => $maneuverSpec['sfxCue'],
                    'cooldownSeconds' => self::MANEUVER_COOLDOWN_SEC,
                    'levelUp' => $levelUp,
                    'summaryEn' => $summaryEn,
                    'summaryAr' => $summaryAr,
                    'serverProof' => [
                        'correlationId' => $correlationId,
                        'clientSuppliedOutcomeFields' => 0,
                    ],
                ],
                'player' => $freshPlayer,
                'encounter' => $this->formatEncounterView($freshPlayer, $encounterRow, $nextBlackboard, $nextScored, $nowSec),
            ];
        });
    }

    /**
     * Pure Normalized Utility AI Response Curve Evaluator (`utility-ai` skill).
     *
     * Maps normalized input `$x` in `[0.0, 1.0]` -> utility score in `[0.0, 1.0]` using:
     *   - `'linear'`:    `clamp(slope * x + intercept, 0, 1)`
     *   - `'quadratic'`: `clamp(x ^ exponent, 0, 1)` (or `1 - (1 - x)^exponent` when `invert = true`)
     *   - `'logistic'`:  normalized S-curve `1 / (1 + e^(-steepness * (x - midpoint)))`
     *
     * @param array{slope?: float, intercept?: float, exponent?: float, steepness?: float, midpoint?: float, invert?: bool} $params
     */
    public static function evaluateResponseCurve(string $curveType, float $x, array $params = []): float
    {
        $clampedX = max(0.0, min(1.0, $x));
        $invert = !empty($params['invert']);
        $u = $invert ? (1.0 - $clampedX) : $clampedX;

        $raw = match (strtolower(trim($curveType))) {
            'linear' => ((float) ($params['slope'] ?? 1.0)) * $u + ((float) ($params['intercept'] ?? 0.0)),
            'quadratic' => $u ** max(0.25, (float) ($params['exponent'] ?? 2.0)),
            'logistic' => (static function (float $val, float $k, float $mid): float {
                $minVal = 1.0 / (1.0 + exp(-$k * (0.0 - $mid)));
                $maxVal = 1.0 / (1.0 + exp(-$k * (1.0 - $mid)));
                $sig = 1.0 / (1.0 + exp(-$k * ($val - $mid)));
                $span = max(1e-6, $maxVal - $minVal);
                return ($sig - $minVal) / $span;
            })(
                $u,
                max(0.5, (float) ($params['steepness'] ?? 10.0)),
                max(0.05, min(0.95, (float) ($params['midpoint'] ?? 0.5))),
            ),
            default => throw new InvalidArgumentException("Unsupported Utility AI curve type: {$curveType}"),
        };

        return round(max(0.0, min(1.0, $raw)), 4);
    }

    /**
     * Scores all 4 Nemesis AI stances from an authoritative combat Blackboard (`utility-ai` + `behavior-trees` + `fsm`).
     *
     * @param array{
     *   playerHpPct: float,
     *   rivalHpPct: float,
     *   weaponClass: string,
     *   districtHeat: float,
     *   stimsRemaining?: int,
     *   turnCount?: int
     * } $blackboard
     * @return array{
     *   selectedStance: string,
     *   expectedCounter: string,
     *   fsmState: string,
     *   btNode: string,
     *   scores: array<string, float>,
     *   breakdown: list<array<string, mixed>>
     * }
     */
    public static function scoreUtilityStances(array $blackboard): array
    {
        $playerHpPct = max(0.0, min(1.0, (float) ($blackboard['playerHpPct'] ?? 1.0)));
        $rivalHpPct = max(0.0, min(1.0, (float) ($blackboard['rivalHpPct'] ?? 1.0)));
        $weaponClass = strtolower(trim((string) ($blackboard['weaponClass'] ?? 'unarmed')));
        $heatNorm = max(0.0, min(1.0, ((float) ($blackboard['districtHeat'] ?? 20.0)) / 100.0));
        $stimsRem = max(0, (int) ($blackboard['stimsRemaining'] ?? self::MAX_RIVAL_STIMS));

        $isHeavyFirearm = in_array($weaponClass, ['rifle', 'sniper', 'shotgun', 'smg'], true);
        $isLongRange = in_array($weaponClass, ['sniper', 'rifle'], true);
        $isCloseLight = in_array($weaponClass, ['melee', 'pistol', 'unarmed'], true);

        // 1. berserk_rush: Quadratic bloodlust as Player HP% drops + gap-close bias vs long-range rifles/snipers
        $playerVulnerability = self::evaluateResponseCurve('quadratic', 1.0 - $playerHpPct, ['exponent' => 1.85]);
        $rivalConfidence = self::evaluateResponseCurve('linear', $rivalHpPct, ['slope' => 0.85, 'intercept' => 0.15]);
        $gapCloseBonus = $isLongRange ? 0.16 : 0.0;
        $berserkScore = min(
            0.99,
            round((0.58 * $playerVulnerability) + (0.26 * $rivalConfidence) + $gapCloseBonus, 4),
        );

        // 2. ballistic_guard: Linear firearm-suppression response when player brings heavy ballistics & Rival has solid HP
        $rivalHealthy = self::evaluateResponseCurve('linear', $rivalHpPct, ['slope' => 0.70, 'intercept' => 0.25]);
        $calmHeat = self::evaluateResponseCurve('linear', 1.0 - $heatNorm, ['slope' => 0.65, 'intercept' => 0.20]);
        $firearmThreat = $isHeavyFirearm ? 0.36 : 0.08;
        $ballisticScore = min(
            0.99,
            round((0.36 * $rivalHealthy) + (0.24 * $calmHeat) + $firearmThreat, 4),
        );

        // 3. flank_ambush: Logistic district-heat shadow escalation + kiting advantage vs melee/pistols
        $heatShadow = self::evaluateResponseCurve('logistic', $heatNorm, ['steepness' => 9.5, 'midpoint' => 0.52]);
        $playerHealthy = self::evaluateResponseCurve('linear', $playerHpPct, ['slope' => 0.80, 'intercept' => 0.15]);
        $kiteBonus = $isCloseLight ? 0.18 : 0.04;
        $flankScore = min(
            0.99,
            round((0.56 * $heatShadow) + (0.24 * $playerHealthy) + $kiteBonus, 4),
        );

        // 4. stim_inject: Steep Logistic emergency triage curve when Rival HP% < 36%, gated by BT HasStimsDecorator
        $rivalCritNeed = self::evaluateResponseCurve('logistic', 1.0 - $rivalHpPct, ['steepness' => 13.5, 'midpoint' => 0.66]);
        $stimGate = $stimsRem > 0 ? 1.0 : 0.04;
        $stimScore = min(
            0.99,
            round($stimGate * ((0.88 * $rivalCritNeed) + 0.10), 4),
        );

        $scores = [
            'berserk_rush' => $berserkScore,
            'ballistic_guard' => $ballisticScore,
            'flank_ambush' => $flankScore,
            'stim_inject' => $stimScore,
        ];

        $selectedStance = 'ballistic_guard';
        $bestScore = -1.0;
        foreach ($scores as $stanceId => $scoreVal) {
            if ($scoreVal > $bestScore) {
                $bestScore = $scoreVal;
                $selectedStance = $stanceId;
            }
        }

        $fsmState = match (true) {
            $rivalHpPct <= 0.0 => 'NEUTRALIZED',
            $rivalHpPct <= 0.36 && $stimsRem > 0 => 'DESPERATE',
            $playerHpPct <= 0.35 || $heatNorm >= 0.70 => 'ENRAGED',
            default => 'ENGAGED',
        };

        $btNode = match ($selectedStance) {
            'stim_inject' => 'RootSelector>HasStimsDecorator>Sequence[stim_inject]',
            'berserk_rush' => 'RootSelector>UtilitySelector>Sequence[berserk_rush]',
            'flank_ambush' => 'RootSelector>UtilitySelector>Sequence[flank_ambush]',
            default => 'RootSelector>UtilitySelector>Sequence[ballistic_guard]',
        };

        $breakdown = [];
        foreach (self::AI_STANCES as $sid => $spec) {
            $sc = $scores[$sid];
            $breakdown[] = [
                'id' => $sid,
                'nameEn' => $spec['nameEn'],
                'nameAr' => $spec['nameAr'],
                'counter' => $spec['counter'],
                'curvePrimary' => $spec['curvePrimary'],
                'score' => $sc,
                'scorePct' => (int) round($sc * 100),
                'isSelected' => $sid === $selectedStance,
            ];
        }

        return [
            'selectedStance' => $selectedStance,
            'expectedCounter' => self::AI_STANCES[$selectedStance]['counter'],
            'fsmState' => $fsmState,
            'btNode' => $btNode,
            'scores' => $scores,
            'breakdown' => $breakdown,
        ];
    }

    /**
     * Deterministic Time-Phased 3D Guard Vision Cone Calculator (`perception-system`).
     *
     * @return array{
     *   districtId: string,
     *   visionAngleDeg: float,
     *   effectiveConeDeg: float,
     *   sweepHz: float,
     *   phase: float,
     *   guardYawDeg: float,
     *   inBlindSpot: bool,
     *   blindSpotWindows: list<array{start: float, end: float}>,
     *   nextBlindSpotInSec: float
     * }
     */
    public static function computeGuardVisionCone(string $district, float $timestampSec, int $noiseLevel = 0): array
    {
        $distId = self::normalizeDistrictId($district);
        $spec = self::DISTRICTS[$distId];
        $baseAngle = (float) $spec['visionAngleDeg'];
        $sweepHz = (float) $spec['sweepHz'];

        $threat = self::resolveThreatTier($noiseLevel);
        $alertWidenDeg = match ($threat) {
            self::THREAT_HUNTED => 16.0,
            self::THREAT_SUSPICIOUS => 8.0,
            default => 0.0,
        };
        $effectiveConeDeg = min(110.0, $baseAngle + $alertWidenDeg);

        $rawPhase = fmod(max(0.0, $timestampSec) * $sweepHz, 1.0);
        if ($rawPhase < 0.0) {
            $rawPhase += 1.0;
        }

        // Guard sweeps sinusoidally across [-90 deg, +90 deg]. Vault corridor sits at 0 deg center.
        // At phase windows [0.17..0.33] and [0.67..0.83], the guard looks far away (> 61 deg off-axis), exposing the BLIND SPOT!
        $guardYawDeg = round(sin($rawPhase * 2.0 * M_PI) * 90.0, 2);

        $w1Start = 0.17;
        $w1End = 0.33;
        $w2Start = 0.67;
        $w2End = 0.83;

        // Higher alert narrows the safe blind-spot margin slightly
        $marginShrink = $threat === self::THREAT_HUNTED ? 0.035 : ($threat === self::THREAT_SUSPICIOUS ? 0.015 : 0.0);
        $s1 = $w1Start + $marginShrink;
        $e1 = $w1End - $marginShrink;
        $s2 = $w2Start + $marginShrink;
        $e2 = $w2End - $marginShrink;

        $inBlindSpot = ($rawPhase >= $s1 && $rawPhase <= $e1) || ($rawPhase >= $s2 && $rawPhase <= $e2);

        $nextPhaseDelta = 0.0;
        if (!$inBlindSpot) {
            if ($rawPhase < $s1) {
                $nextPhaseDelta = $s1 - $rawPhase;
            } elseif ($rawPhase < $s2) {
                $nextPhaseDelta = $s2 - $rawPhase;
            } else {
                $nextPhaseDelta = (1.0 - $rawPhase) + $s1;
            }
        }
        $nextBlindSpotSec = $inBlindSpot ? 0.0 : round($nextPhaseDelta / max(0.05, $sweepHz), 2);

        return [
            'districtId' => $distId,
            'visionAngleDeg' => $baseAngle,
            'effectiveConeDeg' => $effectiveConeDeg,
            'sweepHz' => $sweepHz,
            'phase' => round($rawPhase, 4),
            'guardYawDeg' => $guardYawDeg,
            'inBlindSpot' => $inBlindSpot,
            'blindSpotWindows' => [
                ['start' => round($s1, 3), 'end' => round($e1, 3)],
                ['start' => round($s2, 3), 'end' => round($e2, 3)],
            ],
            'nextBlindSpotInSec' => $nextBlindSpotSec,
        ];
    }

    public static function resolveThreatTier(int $noiseLevel): string
    {
        $n = max(0, min(100, $noiseLevel));
        if ($n >= 70) {
            return self::THREAT_HUNTED;
        }
        if ($n >= 35) {
            return self::THREAT_SUSPICIOUS;
        }
        return self::THREAT_CLEAR;
    }

    public static function normalizeDistrictId(string $district): string
    {
        $clean = strtolower(trim($district));
        $aliases = [
            'pier4' => 'pier_4',
            'pier-4' => 'pier_4',
            'harbor' => 'pier_4',
            'docks' => 'pier_4',
            'west' => 'pier_4',
            'red' => 'neon_alley',
            'alley' => 'neon_alley',
            'north' => 'foundry',
            'fin' => 'downtown',
            'center' => 'downtown',
            'res' => 'old_harbor',
        ];
        if (isset($aliases[$clean])) {
            $clean = $aliases[$clean];
        }
        return isset(self::DISTRICTS[$clean]) ? $clean : 'pier_4';
    }

    /**
     * Classifies an item ID into `godot-genre-shooter` weapon archetypes.
     */
    public static function classifyWeaponArchetype(?string $weaponId): string
    {
        $w = strtolower(trim((string) $weaponId));
        if ($w === '' || $w === 'fists' || $w === 'none') {
            return 'unarmed';
        }
        if (str_contains($w, 'sniper') || str_contains($w, 'dragunov') || str_contains($w, 'mosin')) {
            return 'sniper';
        }
        if (str_contains($w, 'shotgun') || str_contains($w, 'sawed')) {
            return 'shotgun';
        }
        if (str_contains($w, 'smg') || str_contains($w, 'uzi') || str_contains($w, 'mp5')) {
            return 'smg';
        }
        if (str_contains($w, 'ak') || str_contains($w, 'rifle') || str_contains($w, 'bullpup') || str_contains($w, 'm4')) {
            return 'rifle';
        }
        if (str_contains($w, 'pistol') || str_contains($w, 'revolver') || str_contains($w, 'magnum') || str_contains($w, 'glock')) {
            return 'pistol';
        }
        if (str_contains($w, 'knife') || str_contains($w, 'bat') || str_contains($w, 'katana') || str_contains($w, 'razor') || str_contains($w, 'melee')) {
            return 'melee';
        }
        return 'rifle';
    }

    /**
     * @return array<string, mixed>
     */
    private function loadAndDecayStealthWindow(string $playerId, string $districtId, int $nowSec): array
    {
        $row = $this->database->fetchOne(
            'SELECT player_id, district_id, noise_level, threat_tier, clean_streak, breaches_total, alerts_total, cooldown_until, last_decay_at, updated_at
             FROM stealth_windows
             WHERE player_id = :pid AND district_id = :dist',
            ['pid' => $playerId, 'dist' => $districtId],
        );

        $ambient = self::DISTRICTS[$districtId]['ambientNoise'];
        if ($row === null) {
            $fresh = [
                'player_id' => $playerId,
                'district_id' => $districtId,
                'noise_level' => $ambient,
                'threat_tier' => self::resolveThreatTier($ambient),
                'clean_streak' => 0,
                'breaches_total' => 0,
                'alerts_total' => 0,
                'cooldown_until' => 0,
                'last_decay_at' => $nowSec,
                'updated_at' => gmdate('c', $nowSec),
            ];
            $this->upsertStealthWindow($fresh);
            return $fresh;
        }

        $lastDecay = (int) ($row['last_decay_at'] ?? $nowSec);
        $elapsed = max(0, $nowSec - $lastDecay);
        $decaySteps = intdiv($elapsed, self::NOISE_DECAY_INTERVAL_SEC);
        $currentNoise = max(0, min(100, (int) ($row['noise_level'] ?? 0)));

        if ($decaySteps > 0 && $currentNoise > 0) {
            $nextNoise = max(0, $currentNoise - $decaySteps);
            $nextTier = self::resolveThreatTier($nextNoise);
            $row['noise_level'] = $nextNoise;
            $row['threat_tier'] = $nextTier;
            $row['last_decay_at'] = $lastDecay + ($decaySteps * self::NOISE_DECAY_INTERVAL_SEC);
            $row['updated_at'] = gmdate('c', $nowSec);
            $this->upsertStealthWindow($row);
        } else {
            $row['noise_level'] = $currentNoise;
            $row['threat_tier'] = self::resolveThreatTier($currentNoise);
        }

        return $row;
    }

    /**
     * @param array<string, mixed> $row
     */
    private function upsertStealthWindow(array $row): void
    {
        $this->database->execute(
            'INSERT INTO stealth_windows (
                player_id, district_id, noise_level, threat_tier, clean_streak,
                breaches_total, alerts_total, cooldown_until, last_decay_at, updated_at
             ) VALUES (
                :pid, :dist, :noise, :tier, :streak,
                :breaches, :alerts, :cd, :decayAt, :updated
             )
             ON CONFLICT (player_id, district_id) DO UPDATE SET
                noise_level = EXCLUDED.noise_level,
                threat_tier = EXCLUDED.threat_tier,
                clean_streak = EXCLUDED.clean_streak,
                breaches_total = EXCLUDED.breaches_total,
                alerts_total = EXCLUDED.alerts_total,
                cooldown_until = EXCLUDED.cooldown_until,
                last_decay_at = EXCLUDED.last_decay_at,
                updated_at = EXCLUDED.updated_at',
            [
                'pid' => (string) $row['player_id'],
                'dist' => (string) $row['district_id'],
                'noise' => (int) $row['noise_level'],
                'tier' => (string) $row['threat_tier'],
                'streak' => (int) $row['clean_streak'],
                'breaches' => (int) $row['breaches_total'],
                'alerts' => (int) $row['alerts_total'],
                'cd' => (int) $row['cooldown_until'],
                'decayAt' => (int) $row['last_decay_at'],
                'updated' => (string) $row['updated_at'],
            ],
        );
    }

    /**
     * @param array<string, mixed> $player
     * @param array<string, mixed> $progState
     * @param array<string, mixed> $context
     * @return array<string, mixed>
     */
    private function loadOrCreateEncounter(
        string $playerId,
        array $player,
        array $progState,
        int $nowSec,
        array $context = [],
    ): array {
        $row = $this->database->fetchOne(
            'SELECT player_id, nemesis_id, nemesis_name_en, nemesis_name_ar, rival_hp, rival_max_hp,
                    district_id, district_heat, active_stance, fsm_state, bt_node,
                    turn_count, combo_chain, stims_remaining, cooldown_until, scores_json, log_json, updated_at
             FROM tactical_encounters
             WHERE player_id = :pid',
            ['pid' => $playerId],
        );

        $nemMeta = $this->extractNemesisMeta($playerId, $player, $progState);
        if ($row !== null) {
            if (isset($context['district']) && is_string($context['district']) && trim($context['district']) !== '') {
                $row['district_id'] = self::normalizeDistrictId($context['district']);
            }
            return $row;
        }

        $distId = isset($context['district']) && is_string($context['district'])
            ? self::normalizeDistrictId($context['district'])
            : $nemMeta['districtId'];

        $fresh = [
            'player_id' => $playerId,
            'nemesis_id' => $nemMeta['id'],
            'nemesis_name_en' => $nemMeta['nameEn'],
            'nemesis_name_ar' => $nemMeta['nameAr'],
            'rival_hp' => $nemMeta['maxHp'],
            'rival_max_hp' => $nemMeta['maxHp'],
            'district_id' => $distId,
            'district_heat' => $nemMeta['districtHeat'],
            'active_stance' => 'ballistic_guard',
            'fsm_state' => 'ENGAGED',
            'bt_node' => 'RootSelector>UtilitySelector>Sequence[ballistic_guard]',
            'turn_count' => 0,
            'combo_chain' => 0,
            'stims_remaining' => self::MAX_RIVAL_STIMS,
            'cooldown_until' => 0,
            'scores_json' => '{}',
            'log_json' => '[]',
            'updated_at' => gmdate('c', $nowSec),
        ];

        $board = $this->buildBlackboard($playerId, $player, $progState, $fresh, $nowSec);
        $scored = self::scoreUtilityStances($board);
        $fresh['active_stance'] = $scored['selectedStance'];
        $fresh['fsm_state'] = $scored['fsmState'];
        $fresh['bt_node'] = $scored['btNode'];
        $fresh['district_heat'] = (int) round($board['districtHeat']);
        $fresh['scores_json'] = json_encode($scored['scores'], JSON_THROW_ON_ERROR);

        $this->upsertEncounterRow($fresh);
        return $fresh;
    }

    /**
     * @param array<string, mixed> $row
     */
    private function upsertEncounterRow(array $row): void
    {
        $this->database->execute(
            'INSERT INTO tactical_encounters (
                player_id, nemesis_id, nemesis_name_en, nemesis_name_ar, rival_hp, rival_max_hp,
                district_id, district_heat, active_stance, fsm_state, bt_node,
                turn_count, combo_chain, stims_remaining, cooldown_until, scores_json, log_json, updated_at
             ) VALUES (
                :pid, :nemId, :nameEn, :nameAr, :rHp, :rMaxHp,
                :dist, :heat, :stance, :fsm, :bt,
                :turns, :combo, :stims, :cd, :scores, :logs, :updated
             )
             ON CONFLICT (player_id) DO UPDATE SET
                nemesis_id = EXCLUDED.nemesis_id,
                nemesis_name_en = EXCLUDED.nemesis_name_en,
                nemesis_name_ar = EXCLUDED.nemesis_name_ar,
                rival_hp = EXCLUDED.rival_hp,
                rival_max_hp = EXCLUDED.rival_max_hp,
                district_id = EXCLUDED.district_id,
                district_heat = EXCLUDED.district_heat,
                active_stance = EXCLUDED.active_stance,
                fsm_state = EXCLUDED.fsm_state,
                bt_node = EXCLUDED.bt_node,
                turn_count = EXCLUDED.turn_count,
                combo_chain = EXCLUDED.combo_chain,
                stims_remaining = EXCLUDED.stims_remaining,
                cooldown_until = EXCLUDED.cooldown_until,
                scores_json = EXCLUDED.scores_json,
                log_json = EXCLUDED.log_json,
                updated_at = EXCLUDED.updated_at',
            [
                'pid' => (string) $row['player_id'],
                'nemId' => (string) $row['nemesis_id'],
                'nameEn' => (string) $row['nemesis_name_en'],
                'nameAr' => (string) $row['nemesis_name_ar'],
                'rHp' => (int) $row['rival_hp'],
                'rMaxHp' => (int) $row['rival_max_hp'],
                'dist' => (string) $row['district_id'],
                'heat' => (int) $row['district_heat'],
                'stance' => (string) $row['active_stance'],
                'fsm' => (string) $row['fsm_state'],
                'bt' => (string) $row['bt_node'],
                'turns' => (int) $row['turn_count'],
                'combo' => (int) $row['combo_chain'],
                'stims' => (int) $row['stims_remaining'],
                'cd' => (int) $row['cooldown_until'],
                'scores' => (string) $row['scores_json'],
                'logs' => (string) $row['log_json'],
                'updated' => (string) $row['updated_at'],
            ],
        );
    }

    /**
     * @param array<string, mixed> $player
     * @param array<string, mixed> $progState
     * @param array<string, mixed> $encounterRow
     * @return array{playerHpPct: float, rivalHpPct: float, weaponId: ?string, weaponClass: string, districtHeat: float, stimsRemaining: int, turnCount: int}
     */
    private function buildBlackboard(
        string $playerId,
        array $player,
        array $progState,
        array $encounterRow,
        int $nowSec,
    ): array {
        $playerHpPct = round(max(0.0, min(1.0, ((int) $player['life']) / max(1, (int) $player['max_life']))), 4);
        $rivalHpPct = round(max(0.0, min(1.0, ((int) $encounterRow['rival_hp']) / max(1, (int) $encounterRow['rival_max_hp']))), 4);

        $loadout = $this->resolveServerLoadout($progState);
        $weaponId = isset($loadout['weaponId']) && is_string($loadout['weaponId']) ? $loadout['weaponId'] : null;
        $weaponClass = self::classifyWeaponArchetype($weaponId);

        $distId = self::normalizeDistrictId((string) ($encounterRow['district_id'] ?? 'pier_4'));
        $stealthRow = $this->loadAndDecayStealthWindow($playerId, $distId, $nowSec);
        $nem = is_array($progState['ascension']['nemesis'] ?? null) ? $progState['ascension']['nemesis'] : [];
        $nemTaxHeat = max(0, min(10, (int) ($nem['heatTaxPct'] ?? 3))) * 5;
        $districtHeat = max(0.0, min(100.0, (float) ($nemTaxHeat + ((int) $stealthRow['noise_level']) * 0.65)));

        return [
            'playerHpPct' => $playerHpPct,
            'rivalHpPct' => $rivalHpPct,
            'weaponId' => $weaponId,
            'weaponClass' => $weaponClass,
            'districtHeat' => round($districtHeat, 2),
            'stimsRemaining' => max(0, (int) ($encounterRow['stims_remaining'] ?? 0)),
            'turnCount' => max(0, (int) ($encounterRow['turn_count'] ?? 0)),
        ];
    }

    /**
     * @param array<string, mixed> $player
     * @param array<string, mixed> $row
     * @param array<string, mixed> $cone
     * @param array<string, array<string, mixed>> $ownedEnhancers
     * @return array<string, mixed>
     */
    private function formatStealthView(
        string $playerId,
        array $player,
        string $districtId,
        array $row,
        array $cone,
        array $ownedEnhancers,
        int $passiveStealthPct,
        int $cooldownRemaining,
        float $nowFloat,
    ): array {
        $distSpec = self::DISTRICTS[$districtId];
        $noise = (int) $row['noise_level'];
        $tier = self::resolveThreatTier($noise);

        return [
            'playerId' => $playerId,
            'districtId' => $districtId,
            'districtNameEn' => $distSpec['nameEn'],
            'districtNameAr' => $distSpec['nameAr'],
            'noiseLevel' => $noise,
            'threatTier' => $tier,
            'cleanStreak' => (int) $row['clean_streak'],
            'breachesTotal' => (int) $row['breaches_total'],
            'alertsTotal' => (int) $row['alerts_total'],
            'visionCone' => $cone,
            'visionAngleDeg' => $cone['effectiveConeDeg'],
            'sweepHz' => $cone['sweepHz'],
            'blindSpotWindow' => [
                'active' => $cone['inBlindSpot'],
                'windows' => $cone['blindSpotWindows'],
                'nextInSec' => $cone['nextBlindSpotInSec'],
                'bonusRangePct' => [15, 35],
            ],
            'ownedEnhancers' => array_values($ownedEnhancers),
            'passiveStealthPct' => $passiveStealthPct,
            'nerveCost' => self::STEALTH_BREACH_NERVE_COST,
            'playerNerve' => (int) $player['nerve'],
            'cooldownRemainingSec' => $cooldownRemaining,
            'serverTimestamp' => round($nowFloat, 3),
        ];
    }

    /**
     * @param array<string, mixed> $player
     * @param array<string, mixed> $row
     * @param array<string, mixed> $blackboard
     * @param array<string, mixed> $scored
     * @return array<string, mixed>
     */
    private function formatEncounterView(
        array $player,
        array $row,
        array $blackboard,
        array $scored,
        int $nowSec,
    ): array {
        $activeStance = (string) ($row['active_stance'] ?? $scored['selectedStance']);
        $stanceSpec = self::AI_STANCES[$activeStance] ?? self::AI_STANCES['ballistic_guard'];
        $counterId = $stanceSpec['counter'];
        $counterSpec = self::COUNTER_MANEUVERS[$counterId];
        $cooldownRem = max(0, ((int) ($row['cooldown_until'] ?? 0)) - $nowSec);

        $logs = json_decode((string) ($row['log_json'] ?? '[]'), true);

        return [
            'nemesisId' => (string) $row['nemesis_id'],
            'nemesisNameEn' => (string) $row['nemesis_name_en'],
            'nemesisNameAr' => (string) $row['nemesis_name_ar'],
            'districtId' => (string) $row['district_id'],
            'districtHeat' => (int) $row['district_heat'],
            'rivalHp' => (int) $row['rival_hp'],
            'rivalMaxHp' => (int) $row['rival_max_hp'],
            'rivalHpPct' => (int) round($blackboard['rivalHpPct'] * 100),
            'playerHp' => (int) $player['life'],
            'playerMaxHp' => (int) $player['max_life'],
            'playerHpPct' => (int) round($blackboard['playerHpPct'] * 100),
            'playerEnergy' => (int) $player['energy'],
            'energyCost' => self::MANEUVER_ENERGY_COST,
            'equippedWeaponId' => $blackboard['weaponId'] ?? 'fists',
            'equippedWeaponClass' => $blackboard['weaponClass'],
            'stimsRemaining' => (int) $row['stims_remaining'],
            'turnCount' => (int) $row['turn_count'],
            'comboChain' => (int) $row['combo_chain'],
            'fsmState' => (string) $row['fsm_state'],
            'btNode' => (string) $row['bt_node'],
            'enemyIntent' => [
                'stanceId' => $stanceSpec['id'],
                'nameEn' => $stanceSpec['nameEn'],
                'nameAr' => $stanceSpec['nameAr'],
                'telegraphEn' => $stanceSpec['telegraphEn'],
                'telegraphAr' => $stanceSpec['telegraphAr'],
                'curvePrimary' => $stanceSpec['curvePrimary'],
                'recommendedCounter' => $counterId,
                'recommendedCounterEn' => $counterSpec['nameEn'],
                'recommendedCounterAr' => $counterSpec['nameAr'],
            ],
            'utilityScores' => $scored['scores'],
            'utilityBreakdown' => $scored['breakdown'],
            'maneuvers' => array_values(self::COUNTER_MANEUVERS),
            'cooldownRemainingSec' => $cooldownRem,
            'recentLog' => is_array($logs) ? $logs : [],
        ];
    }

    /**
     * @param array<string, mixed> $progState
     * @return array<string, array<string, mixed>>
     */
    private function resolveOwnedCrimeEnhancers(array $progState): array
    {
        $inv = is_array($progState['inv'] ?? null) ? $progState['inv'] : [];
        $owned = [];
        foreach (self::CRIME_ENHANCERS as $enhId => $spec) {
            if ((int) ($inv[$enhId] ?? 0) >= 1) {
                $owned[$enhId] = ['id' => $enhId, ...$spec];
            }
        }
        return $owned;
    }

    /**
     * @param array<string, mixed> $progState
     * @return array<string, mixed>
     */
    private function resolveServerLoadout(array $progState): array
    {
        try {
            $catalog = (new GameplayCatalog($this->database, $this->events))->active();
            return LoadoutService::resolve($progState, $catalog['items'] ?? []);
        } catch (Throwable) {
            $equip = is_string($progState['equip'] ?? null) ? $progState['equip'] : null;
            return [
                'weaponId' => $equip,
                'armorId' => is_string($progState['armorEquip'] ?? null) ? $progState['armorEquip'] : null,
                'weaponMultiplier' => 1.0,
                'armorReduction' => 0.0,
            ];
        }
    }

    /**
     * @param array<string, mixed> $player
     * @param array<string, mixed> $progState
     * @return array{id: string, nameEn: string, nameAr: string, districtId: string, districtHeat: int, maxHp: int}
     */
    private function extractNemesisMeta(string $playerId, array $player, array $progState): array
    {
        $nem = is_array($progState['ascension']['nemesis'] ?? null) ? $progState['ascension']['nemesis'] : [];
        $level = max(1, (int) $player['level']);
        $tier = max(1, min(10, (int) ($nem['tier'] ?? max(1, intdiv($level + 2, 3)))));
        $maxHp = 160 + ($tier * 75) + ($level * 18);

        $seed = hash('sha256', 'zone-tactical-nemesis:' . $playerId);
        $fallbacks = [
            ['id' => 'nem-razor', 'en' => 'Malik "Razor" Vance', 'ar' => 'مالك "الموس" فانس', 'dist' => 'pier_4'],
            ['id' => 'nem-kouri', 'en' => 'Soraia "Hollow-Point" Kouri', 'ar' => 'ثريا "الرصاصة" خوري', 'dist' => 'neon_alley'],
            ['id' => 'nem-petrov', 'en' => 'Drago "Dock-Breaker" Petrov', 'ar' => 'دراغو "محطم الأرصفة" بتروف', 'dist' => 'foundry'],
            ['id' => 'nem-costa', 'en' => 'Valeria "Glass-Eye" Costa', 'ar' => 'فاليريا "العين الزجاجية" كوستا', 'dist' => 'downtown'],
        ];
        $pick = $fallbacks[hexdec(substr($seed, 0, 6)) % count($fallbacks)];

        return [
            'id' => is_string($nem['id'] ?? null) && $nem['id'] !== '' ? $nem['id'] : $pick['id'],
            'nameEn' => is_string($nem['nameEn'] ?? null) && $nem['nameEn'] !== '' ? $nem['nameEn'] : $pick['en'],
            'nameAr' => is_string($nem['nameAr'] ?? null) && $nem['nameAr'] !== '' ? $nem['nameAr'] : $pick['ar'],
            'districtId' => self::normalizeDistrictId((string) ($nem['districtId'] ?? $pick['dist'])),
            'districtHeat' => max(12, min(95, ((int) ($nem['heatTaxPct'] ?? 4)) * 7)),
            'maxHp' => $maxHp,
        ];
    }

    private function normalizePlayerId(int|string $playerId): string
    {
        $clean = trim((string) $playerId);
        if ($clean === '' || strlen($clean) > 64 || !preg_match('/^[A-Za-z0-9_-]+$/D', $clean)) {
            throw new InvalidArgumentException('Invalid player identifier for Tactical AI Director.');
        }
        return $clean;
    }

    private function ensureProgressionBootstrapped(string $playerId): void
    {
        try {
            $exists = $this->database->fetchOne('SELECT player_id FROM player_progression WHERE player_id = :pid', ['pid' => $playerId]);
            if ($exists === null) {
                (new ProgressionService($this->database, $this->events))->snapshot($playerId);
            }
        } catch (Throwable) {
            // Lightweight unit tests without progression fixtures fall back cleanly to default empty state.
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function loadPlayer(string $playerId): array
    {
        $row = $this->database->fetchOne('SELECT * FROM players WHERE id = :pid', ['pid' => $playerId]);
        if ($row === null) {
            throw new RuntimeException("Unknown player: {$playerId}");
        }
        return $this->resources->normalize($row);
    }

    /**
     * @return array{0: array<string, mixed>, 1: int}
     */
    private function loadProgressionSafe(string $playerId): array
    {
        try {
            $row = $this->database->fetchOne(
                'SELECT state_json, version FROM player_progression WHERE player_id = :pid',
                ['pid' => $playerId],
            );
            if ($row === null) {
                return [[], 0];
            }
            $decoded = json_decode((string) $row['state_json'], true, 512, JSON_THROW_ON_ERROR);
            return [is_array($decoded) ? $decoded : [], (int) ($row['version'] ?? 1)];
        } catch (Throwable) {
            return [[], 0];
        }
    }

    /**
     * @param array<string, mixed> $state
     */
    private function saveProgressionSafe(string $playerId, array &$state, int &$version, int $nowSec): void
    {
        if ($version <= 0) {
            return;
        }
        $version++;
        $state['version'] = $version;
        $this->database->execute(
            'UPDATE player_progression SET state_json = :stateJson, version = :nextVer, updated_at = :updatedAt WHERE player_id = :pid',
            [
                'stateJson' => json_encode($state, JSON_THROW_ON_ERROR),
                'nextVer' => $version,
                'updatedAt' => gmdate('c', $nowSec),
                'pid' => $playerId,
            ],
        );
    }

    /**
     * @param array<string, mixed> $state
     */
    private function assertOperativeFree(array $state, int $nowMs): void
    {
        if ((int) ($state['jailUntil'] ?? 0) > $nowMs || (int) ($state['hospUntil'] ?? 0) > $nowMs) {
            throw new RuntimeException('Leave Jail or Hospital before executing tactical operations.');
        }
    }

    private function roll(int $min, int $max): int
    {
        if ($this->random !== null) {
            return (int) ($this->random)($min, $max);
        }
        return random_int($min, $max);
    }

    private function nowFloat(): float
    {
        if ($this->clock !== null) {
            return (float) ($this->clock)();
        }
        return microtime(true);
    }

    private function nowSec(): int
    {
        return (int) floor($this->nowFloat());
    }
}

if (!class_exists('Zone\\Core\\Game\\TacticalAiDirectorService', false)) {
    class_alias(TacticalAiDirectorService::class, 'Zone\\Core\\Game\\TacticalAiDirectorService');
}
