<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Closure;
use InvalidArgumentException;
use RuntimeException;
use Throwable;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * ZONE v159 — Track 16: 4-Stage Evolving 3D Syndicate Companion / Cyber-Drone & K9 System
 * =======================================================================================
 * Canonical Namespace: `Zone\Engine\Core\Game\SyndicateCompanionService`
 * Alias Registered:    `Zone\Core\Game\SyndicateCompanionService`
 *
 * Skills Applied (`C:/Users/user/.gemini/config/skills/`):
 *   - `guardian-evolution-system`: 50-level XP progression curve, 5 tier titles, personality & memory milestones.
 *   - `pet-rpg`: Multi-stage evolution thresholds, Care Score, Bond/Readiness stats, Guardian/Warrior/Balanced branch paths.
 *   - `digital-pet`: Interactive Feed/Calibrate, Pet/Pat, Readiness/Vitality loop, and mood response.
 *   - `hatch-pet-realistic`: Tight 92-94% viewport cell framing & locked silhouette identity metadata across stages.
 *   - `threejs-3d-modeler`: Procedural articulated 3D model descriptors (rotors, armor plates, wings, holo-feathers).
 *
 * @integrator Route Wiring Guide (`engine/router.php` + `GameEngine.php` + `api/index.php` + `engine/bin/relay.mjs`):
 * -----------------------------------------------------------------------------------------
 * Constructor:
 *   `$companions = new SyndicateCompanionService($this->database, $this->events);`
 *
 * Unified Router Dispatch:
 *   1. `GET /api/v1/companions` (or `companion.state`):
 *      `$companions->snapshot($playerId)`
 *   2. `POST /api/v1/companions/action` (`adopt_companion`, `switch_active`, `feed_maintain`, `train_drill`, `patrol_dispatch`):
 *      `$companions->act($playerId, (string) ($body['action'] ?? ''), $body)`
 *
 * Direct Public Domain API Methods:
 *   - `ensureSchema(): void`
 *   - `snapshot(int|string $playerId): array`
 *   - `act(int|string $playerId, string $action, array $payload = []): array`
 *   - `adoptCompanion(int|string $playerId, string $unitId, ?string $callsign = null, bool $setActive = true): array`
 *   - `switchActive(int|string $playerId, string $unitId): array`
 *   - `feedMaintain(int|string $playerId, ?string $unitId = null, string $careMode = 'standard'): array`
 *   - `trainDrill(int|string $playerId, ?string $unitId = null, string $drillType = 'tactical'): array`
 *   - `patrolDispatch(int|string $playerId, ?string $unitId = null, string $sector = 'center'): array`
 *   - `getCompanionModifiers(int|string $playerId): array`
 *   - `static resolveStageForXp(int $evolutionXp): array`
 *   - `static computeUnitModifiers(string $unitId, int $stage, int $bond = 50, int $readiness = 80): array`
 *
 * Database Dual-Compatibility (PostgreSQL 16 + SQLite 3):
 *   - Idempotent `player_companions` DDL on construction.
 *   - Zero 2-argument SQLite scalar `MAX(a,b)` / `MIN(a,b)` calls (`CASE WHEN` / PHP clamping only).
 *   - Strictly unique named PDO `:params` per SQL statement.
 */
final class SyndicateCompanionService
{
    public const DEFAULT_UNIT_ID = 'recon_drone';

    public const TRAIN_ENERGY_COST = 5;
    public const TRAIN_BASE_XP = 95;
    public const TRAIN_READINESS_COST = 8;

    public const FEED_BOND_GAIN = 14;
    public const FEED_READINESS_GAIN = 22;
    public const FEED_CARE_GAIN = 12;
    public const FEED_XP_GAIN = 20;

    public const PATROL_COOLDOWN_SEC = 180;
    public const PATROL_MIN_READINESS = 20;
    public const PATROL_READINESS_COST = 12;
    public const PATROL_XP_GAIN = 45;

    /**
     * 4-Stage Guardian/Companion Evolution System thresholds & metadata.
     *
     * @var array<int, array{
     *   stage: int,
     *   roman: string,
     *   code: string,
     *   nameEn: string,
     *   nameAr: string,
     *   minXp: int,
     *   nextXp: ?int,
     *   minLevel: int,
     *   maxLevel: int,
     *   guardianTierEn: string,
     *   guardianTierAr: string,
     *   scaleMultiplier: float,
     *   visualComplexity: string
     * }>
     */
    public const EVOLUTION_STAGES = [
        1 => [
            'stage' => 1,
            'roman' => 'I',
            'code' => 'prototype_pup',
            'nameEn' => 'Stage I: Prototype/Pup',
            'nameAr' => 'المرحلة ١: نموذج أولي / جرو',
            'minXp' => 0,
            'nextXp' => 100,
            'minLevel' => 1,
            'maxLevel' => 10,
            'guardianTierEn' => 'Awakening (Spark -> Companion)',
            'guardianTierAr' => 'اليقظة (شرارة ← مرافق)',
            'scaleMultiplier' => 1.00,
            'visualComplexity' => 'core_chassis',
        ],
        2 => [
            'stage' => 2,
            'roman' => 'II',
            'code' => 'street_scout',
            'nameEn' => 'Stage II: Street Scout',
            'nameAr' => 'المرحلة ٢: كشّاف الشوارع',
            'minXp' => 100,
            'nextXp' => 300,
            'minLevel' => 11,
            'maxLevel' => 24,
            'guardianTierEn' => 'Growth (Ally -> Advisor)',
            'guardianTierAr' => 'النمو (حليف ← مستشار)',
            'scaleMultiplier' => 1.22,
            'visualComplexity' => 'reinforced_ plating',
        ],
        3 => [
            'stage' => 3,
            'roman' => 'III',
            'code' => 'tactical_vanguard',
            'nameEn' => 'Stage III: Tactical Vanguard',
            'nameAr' => 'المرحلة ٣: طليعة تكتيكية',
            'minXp' => 300,
            'nextXp' => 600,
            'minLevel' => 25,
            'maxLevel' => 39,
            'guardianTierEn' => 'Mastery (Collaborator -> Archon)',
            'guardianTierAr' => 'الإتقان (شريك ← أركون)',
            'scaleMultiplier' => 1.48,
            'visualComplexity' => 'vanguard_artillery',
        ],
        4 => [
            'stage' => 4,
            'roman' => 'IV',
            'code' => 'sovereign_apex',
            'nameEn' => 'Stage IV: Sovereign Apex',
            'nameAr' => 'المرحلة ٤: الذروة السيادية',
            'minXp' => 600,
            'nextXp' => null,
            'minLevel' => 40,
            'maxLevel' => 50,
            'guardianTierEn' => 'Transcendence (Oracle -> Transcendent)',
            'guardianTierAr' => 'التسامي (عرّاف ← متعالٍ)',
            'scaleMultiplier' => 1.75,
            'visualComplexity' => 'sovereign_holo_halo',
        ],
    ];

    /**
     * 4 Syndicate Companion Units with Stage I..IV progression & 3D procedural rig descriptors.
     *
     * @var array<string, array<string, mixed>>
     */
    public const COMPANION_UNITS = [
        'recon_drone' => [
            'id' => 'recon_drone',
            'nameEn' => 'Aegis-IX Recon Drone',
            'nameAr' => 'درون الاستطلاع إيجيس-٩',
            'defaultCallsign' => 'AEGIS-09',
            'archetype' => 'ghost_operative',
            'accentTone' => 'sage',
            'specialtyEn' => '+Stealth & Vision-Cone Blind-Spot',
            'specialtyAr' => '+التخفي وتوسيع النقطة العمياء لمخروط الرؤية',
            'loreEn' => 'Quad-rotor acoustic-damped surveillance drone projecting counter-lidar blind spots across district roofs.',
            'loreAr' => 'درون استطلاع رباعي المراوح بكاتم صوتي يولّد نقاطاً عمياء ضد رادارات الحراسة فوق الأسطح.',
            'stageNamesEn' => [
                1 => 'Mk.I Micro-Quad Prototype',
                2 => 'Mk.II Alley Whisper Scout',
                3 => 'Mk.III Phantom Lidar Vanguard',
                4 => 'Mk.IV Sovereign Aegis Overwatch',
            ],
            'stageNamesAr' => [
                1 => 'طراز ١: درون مصغّر أولي',
                2 => 'طراز ٢: كشّاف الأزقة الصامت',
                3 => 'طراز ٣: طليعة الليدار الشبحية',
                4 => 'طراز ٤: المراقب السيادي إيجيس',
            ],
            'stageBonuses' => [
                1 => ['stealthPct' => 8, 'visionBlindSpotDeg' => 10, 'noiseReductionDb' => 3],
                2 => ['stealthPct' => 13, 'visionBlindSpotDeg' => 16, 'noiseReductionDb' => 5],
                3 => ['stealthPct' => 19, 'visionBlindSpotDeg' => 23, 'noiseReductionDb' => 8],
                4 => ['stealthPct' => 26, 'visionBlindSpotDeg' => 32, 'noiseReductionDb' => 12],
            ],
            'patrolLoot' => [
                'itemId' => 'encrypted_sector_telemetry',
                'nameEn' => 'Encrypted Sector Telemetry',
                'nameAr' => 'قياسات قطاع مشفّرة',
            ],
            'model3d' => [
                'style' => 'techno',
                'modelType' => 'prop',
                'framingHeightRatio' => 0.94,
                'parts' => ['carbon_chassis', 'quad_rotors', 'gimbal_optic_eye', 'shield_ring'],
                'primaryColor' => '#5c8e3e',
                'emissiveColor' => '#a6f292',
            ],
        ],
        'armored_k9' => [
            'id' => 'armored_k9',
            'nameEn' => 'Cerberus-K9 Cyber Hound',
            'nameAr' => 'الكلب المصفّح سيربيروس-K9',
            'defaultCallsign' => 'K9-VANGUARD',
            'archetype' => 'iron_enforcer',
            'accentTone' => 'crimson',
            'specialtyEn' => '+Combat Damage & Counter-Bleed',
            'specialtyAr' => '+ضرر الاشتباك ونزيف الرد المرتد',
            'loreEn' => 'Bionic Syndicate mastiff fitted with articulated Kevlar-titanium dorsal plates and hydraulic bite actuators.',
            'loreAr' => 'كلب حراسة سيبراني مزوّد بصفائح ظهر من الكيفلر والتيتانيوم وفك هيدروليكي مضاد للدروع.',
            'stageNamesEn' => [
                1 => 'Stage I: Scrapyard Cyber-Pup',
                2 => 'Stage II: Street Fang Tracker',
                3 => 'Stage III: Kevlar Juggernaut Hound',
                4 => 'Stage IV: Sovereign Cerberus Apex',
            ],
            'stageNamesAr' => [
                1 => 'المرحلة ١: جرو الخردة السيبراني',
                2 => 'المرحلة ٢: متعقّب الأنياب الميداني',
                3 => 'المرحلة ٣: كلب الكيفلر المدرّع',
                4 => 'المرحلة ٤: سيربيروس السيادي الأعلى',
            ],
            'stageBonuses' => [
                1 => ['combatDamagePct' => 7, 'counterBleedPct' => 6, 'armorMitigationPct' => 4],
                2 => ['combatDamagePct' => 12, 'counterBleedPct' => 10, 'armorMitigationPct' => 7],
                3 => ['combatDamagePct' => 18, 'counterBleedPct' => 15, 'armorMitigationPct' => 11],
                4 => ['combatDamagePct' => 25, 'counterBleedPct' => 22, 'armorMitigationPct' => 16],
            ],
            'patrolLoot' => [
                'itemId' => 'enforcer_tactical_cache',
                'nameEn' => 'Confiscated Enforcer Cache',
                'nameAr' => 'مخبأ عتاد منفّذين مصادَر',
            ],
            'model3d' => [
                'style' => 'scifi',
                'modelType' => 'enemy',
                'framingHeightRatio' => 0.93,
                'parts' => ['kevlar_spine_plates', 'cyber_jaw_visor', 'hydraulic_limbs', 'pulse_shoulders'],
                'primaryColor' => '#c44933',
                'emissiveColor' => '#ff9c8a',
            ],
        ],
        'smuggler_falcon' => [
            'id' => 'smuggler_falcon',
            'nameEn' => 'Horus-V Smuggler Falcon',
            'nameAr' => 'صقر التهريب حورس-٥',
            'defaultCallsign' => 'HORUS-V',
            'archetype' => 'chem_alchemist',
            'accentTone' => 'gold',
            'specialtyEn' => '+Travel Speed & Contraband Capacity',
            'specialtyAr' => '+سرعة التنقل وسعة المهربات',
            'loreEn' => 'High-altitude cyber-raptor gliding above customs checkpoints with micro-pressurized contraband cylinders.',
            'loreAr' => 'صقر سيبراني يحلّق فوق نقاط التفتيش الجمركية حاملاً كبسولات تهريب مضغوطة عالية القيمة.',
            'stageNamesEn' => [
                1 => 'Stage I: Harbor Fledgling Glider',
                2 => 'Stage II: Pier Corridor Couriers',
                3 => 'Stage III: Supersonic Airstrip Raptor',
                4 => 'Stage IV: Sovereign Horus Sky-Lord',
            ],
            'stageNamesAr' => [
                1 => 'المرحلة ١: فرخ الميناء الشراعي',
                2 => 'المرحلة ٢: رسول ممرات الرصيف',
                3 => 'المرحلة ٣: جارح المدرج فوق الصوتي',
                4 => 'المرحلة ٤: سيّد السماء حورس السيادي',
            ],
            'stageBonuses' => [
                1 => ['travelSpeedPct' => 8, 'contrabandCapacity' => 2, 'evasionPct' => 5],
                2 => ['travelSpeedPct' => 13, 'contrabandCapacity' => 4, 'evasionPct' => 9],
                3 => ['travelSpeedPct' => 19, 'contrabandCapacity' => 7, 'evasionPct' => 13],
                4 => ['travelSpeedPct' => 27, 'contrabandCapacity' => 11, 'evasionPct' => 19],
            ],
            'patrolLoot' => [
                'itemId' => 'contraband_airdrop_pod',
                'nameEn' => 'Sealed Contraband Airdrop Pod',
                'nameAr' => 'كبسولة إنزال مهربات مختومة',
            ],
            'model3d' => [
                'style' => 'lowpoly',
                'modelType' => 'prop',
                'framingHeightRatio' => 0.94,
                'parts' => ['swept_alloy_wings', 'articulated_primaries', 'cargo_talon_pods', 'thruster_tail'],
                'primaryColor' => '#d99a38',
                'emissiveColor' => '#f4cf78',
            ],
        ],
        'cyber_raven' => [
            'id' => 'cyber_raven',
            'nameEn' => 'Morrigan-X Cyber-Raven',
            'nameAr' => 'الغراب السيبراني مورغان-X',
            'defaultCallsign' => 'MORRIGAN-X',
            'archetype' => 'cartel_sovereign',
            'accentTone' => 'blue',
            'specialtyEn' => '+Bazaar Fee Reduction & Vault Hack',
            'specialtyAr' => '+خفض عمولة البازار واختراق الخزائن',
            'loreEn' => 'Quantum-feathered corvid unit trained to intercept bazaar brokerage relays and splice vault optical locks.',
            'loreAr' => 'وحدة غراب بريش هولوغرافي مدرّبة على اعتراض عمولات البازار وفك أقفال الخزائن البصرية.',
            'stageNamesEn' => [
                1 => 'Stage I: Wire-Tap Hatchling',
                2 => 'Stage II: Night-Market Splicer',
                3 => 'Stage III: Vault-Crypt Vanguard',
                4 => 'Stage IV: Sovereign Morrigan Oracle',
            ],
            'stageNamesAr' => [
                1 => 'المرحلة ١: فرخ التنصّت السلكي',
                2 => 'المرحلة ٢: مخترق السوق الليلي',
                3 => 'المرحلة ٣: طليعة تشفير الخزائن',
                4 => 'المرحلة ٤: عرّاف مورغان السيادي',
            ],
            'stageBonuses' => [
                1 => ['bazaarFeeReductionPct' => 6, 'vaultHackPct' => 8, 'mugYieldPct' => 5],
                2 => ['bazaarFeeReductionPct' => 10, 'vaultHackPct' => 13, 'mugYieldPct' => 9],
                3 => ['bazaarFeeReductionPct' => 15, 'vaultHackPct' => 19, 'mugYieldPct' => 14],
                4 => ['bazaarFeeReductionPct' => 22, 'vaultHackPct' => 27, 'mugYieldPct' => 20],
            ],
            'patrolLoot' => [
                'itemId' => 'siphoned_bazaar_ledger',
                'nameEn' => 'Siphoned Bazaar Brokerage Ledger',
                'nameAr' => 'دفتر وساطة بازار مسحوب',
            ],
            'model3d' => [
                'style' => 'techno',
                'modelType' => 'boss',
                'framingHeightRatio' => 0.94,
                'parts' => ['holo_feather_cloak', 'neural_crest', 'ocular_cipher_beam', 'emp_tail_fan'],
                'primaryColor' => '#4f85c9',
                'emissiveColor' => '#93c5fd',
            ],
        ],
    ];

    /**
     * Guardian 50-Level Milestone Titles (`guardian-evolution-system`).
     *
     * @var array<int, string>
     */
    private const GUARDIAN_TITLES = [
        1 => 'Spark',
        5 => 'Apprentice',
        10 => 'Companion',
        15 => 'Guide',
        20 => 'Mentor',
        25 => 'Collaborator',
        30 => 'Master',
        35 => 'Sage',
        40 => 'Oracle',
        45 => 'Legend',
        50 => 'Transcendent',
    ];

    /** @var array<int, bool> */
    private static array $schemaEnsured = [];

    private readonly ResourceService $resources;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?Closure $clock = null,
    ) {
        $this->resources = new ResourceService($database);
        $this->ensureSchema();
    }

    /**
     * Idempotently creates the dual PG16 + SQLite `player_companions` schema table.
     */
    public function ensureSchema(): void
    {
        $dbKey = spl_object_id($this->database);
        if (!empty(self::$schemaEnsured[$dbKey])) {
            return;
        }

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS player_companions (
                id VARCHAR(96) PRIMARY KEY,
                player_id VARCHAR(64) NOT NULL,
                unit_id VARCHAR(48) NOT NULL,
                callsign VARCHAR(64) NOT NULL,
                stage INTEGER NOT NULL DEFAULT 1,
                level INTEGER NOT NULL DEFAULT 1,
                evolution_xp INTEGER NOT NULL DEFAULT 0,
                bond INTEGER NOT NULL DEFAULT 40,
                readiness INTEGER NOT NULL DEFAULT 85,
                care_score INTEGER NOT NULL DEFAULT 50,
                evolution_path VARCHAR(32) NOT NULL DEFAULT 'balanced',
                is_active INTEGER NOT NULL DEFAULT 0,
                patrol_count INTEGER NOT NULL DEFAULT 0,
                drill_count INTEGER NOT NULL DEFAULT 0,
                last_fed_at INTEGER NOT NULL DEFAULT 0,
                last_drill_at INTEGER NOT NULL DEFAULT 0,
                patrol_cooldown_until INTEGER NOT NULL DEFAULT 0,
                memories_json TEXT NOT NULL,
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        self::$schemaEnsured[$dbKey] = true;
    }

    /**
     * Returns full server-authoritative Syndicate Companion roster, active companion 3D spec, and modifiers.
     *
     * @return array<string, mixed>
     */
    public function snapshot(int|string $playerId): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $player = $this->loadPlayer($pid);
        $rows = $this->ensureStarterCompanionAndLoadAll($pid);
        $nowSec = $this->nowSec();

        $ownedByUnit = [];
        $activeUnitId = self::DEFAULT_UNIT_ID;
        foreach ($rows as $row) {
            $uid = (string) $row['unit_id'];
            $ownedByUnit[$uid] = $row;
            if ((int) ($row['is_active'] ?? 0) === 1) {
                $activeUnitId = $uid;
            }
        }

        if (!isset($ownedByUnit[$activeUnitId]) && $ownedByUnit !== []) {
            $activeUnitId = (string) array_key_first($ownedByUnit);
        }

        $roster = [];
        $activeCompanion = null;
        foreach (self::COMPANION_UNITS as $uid => $spec) {
            $row = $ownedByUnit[$uid] ?? null;
            $view = $this->buildCompanionUnitView($uid, $spec, $row, $nowSec);
            $roster[] = $view;
            if ($uid === $activeUnitId) {
                $activeCompanion = $view;
            }
        }

        if ($activeCompanion === null) {
            $activeCompanion = $roster[0];
        }

        return [
            'ok' => true,
            'playerId' => $pid,
            'player' => [
                'id' => $pid,
                'username' => (string) ($player['username'] ?? 'Operative'),
                'level' => (int) ($player['level'] ?? 1),
                'city' => (string) ($player['city'] ?? 'Zone City'),
                'cash' => (int) ($player['cash'] ?? 0),
                'energy' => (int) ($player['energy'] ?? 0),
                'maxEnergy' => (int) ($player['max_energy'] ?? 100),
            ],
            'activeUnitId' => $activeUnitId,
            'activeCompanion' => $activeCompanion,
            'modifiers' => $activeCompanion['modifiers'],
            'roster' => $roster,
            'stagesCatalog' => array_values(self::EVOLUTION_STAGES),
            'rules' => [
                'trainEnergyCost' => self::TRAIN_ENERGY_COST,
                'trainBaseXp' => self::TRAIN_BASE_XP,
                'patrolCooldownSec' => self::PATROL_COOLDOWN_SEC,
                'patrolMinReadiness' => self::PATROL_MIN_READINESS,
            ],
            'serverNowSec' => $nowSec,
        ];
    }

    /**
     * Unified router action dispatcher (`adopt_companion`, `switch_active`, `feed_maintain`, `train_drill`, `patrol_dispatch`).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function act(int|string $playerId, string $action, array $payload = []): array
    {
        $cleanAction = strtolower(trim($action));
        $unitId = isset($payload['unitId']) && $payload['unitId'] !== ''
            ? (string) $payload['unitId']
            : (isset($payload['unit']) && $payload['unit'] !== '' ? (string) $payload['unit'] : null);

        return match ($cleanAction) {
            '', 'state', 'snapshot', 'companion.state' => $this->snapshot($playerId),
            'adopt_companion', 'companion.adopt', 'adopt' => $this->adoptCompanion(
                $playerId,
                (string) ($unitId ?? ''),
                isset($payload['callsign']) && $payload['callsign'] !== '' ? (string) $payload['callsign'] : null,
                isset($payload['setActive']) ? (bool) $payload['setActive'] : true,
            ),
            'switch_active', 'companion.switch', 'switch' => $this->switchActive(
                $playerId,
                (string) ($unitId ?? ''),
            ),
            'feed_maintain', 'companion.feed', 'feed', 'calibrate' => $this->feedMaintain(
                $playerId,
                $unitId,
                (string) ($payload['careMode'] ?? 'standard'),
            ),
            'train_drill', 'companion.train', 'train' => $this->trainDrill(
                $playerId,
                $unitId,
                (string) ($payload['drillType'] ?? 'tactical'),
            ),
            'patrol_dispatch', 'companion.patrol', 'patrol' => $this->patrolDispatch(
                $playerId,
                $unitId,
                (string) ($payload['sector'] ?? 'center'),
            ),
            default => throw new InvalidArgumentException("Unsupported companion action: {$action}"),
        };
    }

    /**
     * Adopts one of the 4 Syndicate Companion units (`recon_drone`, `armored_k9`, `smuggler_falcon`, `cyber_raven`).
     *
     * @return array<string, mixed>
     */
    public function adoptCompanion(
        int|string $playerId,
        string $unitId,
        ?string $callsign = null,
        bool $setActive = true,
    ): array {
        $pid = $this->normalizePlayerId($playerId);
        $cleanUnitId = $this->validateUnitId($unitId);
        $spec = self::COMPANION_UNITS[$cleanUnitId];
        $cleanCallsign = $this->sanitizeCallsign($callsign, (string) $spec['defaultCallsign']);

        return $this->database->transaction(function () use ($pid, $cleanUnitId, $spec, $cleanCallsign, $setActive): array {
            $this->loadPlayer($pid);
            $this->ensureStarterCompanionAndLoadAll($pid);
            $nowSec = $this->nowSec();
            $nowIso = gmdate('c', $nowSec);
            $rowId = $pid . ':' . $cleanUnitId;

            $existing = $this->database->fetchOne(
                'SELECT * FROM player_companions WHERE id = :rowId',
                ['rowId' => $rowId],
            );

            $alreadyOwned = $existing !== null;
            if (!$alreadyOwned) {
                $initialMemories = [
                    [
                        'type' => 'adoption',
                        'stage' => 1,
                        'textEn' => "Commissioned {$spec['nameEn']} ({$cleanCallsign}) at Stage I.",
                        'textAr' => "تم اعتماد «{$spec['nameAr']}» ({$cleanCallsign}) في المرحلة الأولى.",
                        'ts' => $nowSec,
                    ],
                ];
                $this->database->insertIgnore(
                    'player_companions',
                    [
                        'id',
                        'player_id',
                        'unit_id',
                        'callsign',
                        'stage',
                        'level',
                        'evolution_xp',
                        'bond',
                        'readiness',
                        'care_score',
                        'evolution_path',
                        'is_active',
                        'patrol_count',
                        'drill_count',
                        'last_fed_at',
                        'last_drill_at',
                        'patrol_cooldown_until',
                        'memories_json',
                        'updated_at',
                    ],
                    [
                        $rowId,
                        $pid,
                        $cleanUnitId,
                        $cleanCallsign,
                        1,
                        1,
                        0,
                        45,
                        90,
                        55,
                        'balanced',
                        0,
                        0,
                        0,
                        $nowSec,
                        0,
                        0,
                        json_encode($initialMemories, JSON_THROW_ON_ERROR),
                        $nowIso,
                    ],
                );
            } else {
                $this->database->execute(
                    'UPDATE player_companions SET callsign = :callsign, updated_at = :updatedAt WHERE id = :rowId',
                    [
                        'callsign' => $cleanCallsign,
                        'updatedAt' => $nowIso,
                        'rowId' => $rowId,
                    ],
                );
            }

            if ($setActive) {
                $this->setActiveUnitInternal($pid, $cleanUnitId, $nowIso);
            }

            $this->events->publish(new DomainEvent('SyndicateCompanionAdopted', [
                'playerId' => $pid,
                'unitId' => $cleanUnitId,
                'callsign' => $cleanCallsign,
                'alreadyOwned' => $alreadyOwned,
                'isActive' => $setActive,
            ]));

            $snap = $this->snapshot($pid);
            $snap['route'] = 'companion.adopt';
            $snap['result'] = [
                'action' => 'adopt_companion',
                'unitId' => $cleanUnitId,
                'callsign' => $cleanCallsign,
                'alreadyOwned' => $alreadyOwned,
                'sfxCue' => 'equip_snap',
                'summaryEn' => "{$spec['nameEn']} ({$cleanCallsign}) commissioned and ready for Syndicate deployment.",
                'summaryAr' => "تم اعتماد «{$spec['nameAr']}» ({$cleanCallsign}) وتجهيزه للعمليات الميدانية.",
            ];
            return $snap;
        });
    }

    /**
     * Switches the player's active companion among adopted Syndicate units.
     *
     * @return array<string, mixed>
     */
    public function switchActive(int|string $playerId, string $unitId): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $cleanUnitId = $this->validateUnitId($unitId);
        $spec = self::COMPANION_UNITS[$cleanUnitId];

        return $this->database->transaction(function () use ($pid, $cleanUnitId, $spec): array {
            $this->loadPlayer($pid);
            $this->ensureStarterCompanionAndLoadAll($pid);
            $rowId = $pid . ':' . $cleanUnitId;
            $existing = $this->database->fetchOne(
                'SELECT * FROM player_companions WHERE id = :rowId',
                ['rowId' => $rowId],
            );
            if ($existing === null) {
                throw new InvalidArgumentException("Companion unit '{$cleanUnitId}' must be adopted before switching active.");
            }

            $nowIso = gmdate('c', $this->nowSec());
            $this->setActiveUnitInternal($pid, $cleanUnitId, $nowIso);

            $this->events->publish(new DomainEvent('SyndicateCompanionSwitched', [
                'playerId' => $pid,
                'unitId' => $cleanUnitId,
            ]));

            $snap = $this->snapshot($pid);
            $snap['route'] = 'companion.switch';
            $snap['result'] = [
                'action' => 'switch_active',
                'unitId' => $cleanUnitId,
                'sfxCue' => 'equip_snap',
                'summaryEn' => "Active companion switched to {$spec['nameEn']} ({$spec['specialtyEn']}).",
                'summaryAr' => "تم تبديل المرافق النشط إلى «{$spec['nameAr']}» ({$spec['specialtyAr']}).",
            ];
            return $snap;
        });
    }

    /**
     * Feeds / calibrates the target (or active) companion (`+$Bond & Readiness`, `+CareScore`, `+20 EvolutionXP`).
     *
     * @return array<string, mixed>
     */
    public function feedMaintain(
        int|string $playerId,
        ?string $unitId = null,
        string $careMode = 'standard',
    ): array {
        $pid = $this->normalizePlayerId($playerId);

        return $this->database->transaction(function () use ($pid, $unitId, $careMode): array {
            $this->loadPlayer($pid);
            $row = $this->resolveTargetCompanionRow($pid, $unitId);
            $uid = (string) $row['unit_id'];
            $spec = self::COMPANION_UNITS[$uid];
            $nowSec = $this->nowSec();
            $nowIso = gmdate('c', $nowSec);

            $oldStage = (int) $row['stage'];
            $oldBond = (int) $row['bond'];
            $oldReadiness = (int) $row['readiness'];
            $oldCare = (int) $row['care_score'];
            $oldXp = (int) $row['evolution_xp'];

            $newBond = min(100, $oldBond + self::FEED_BOND_GAIN);
            $newReadiness = min(100, $oldReadiness + self::FEED_READINESS_GAIN);
            $newCare = min(100, $oldCare + self::FEED_CARE_GAIN);
            $newXp = $oldXp + self::FEED_XP_GAIN;

            $stageInfo = self::resolveStageForXp($newXp);
            $newStage = $stageInfo['stage'];
            $newLevel = $stageInfo['level'];
            $evolved = $newStage > $oldStage;
            $evoPath = $this->resolveEvolutionPath($newCare, (int) $row['drill_count']);

            $memories = $this->decodeMemories((string) $row['memories_json']);
            if ($evolved) {
                $memories[] = [
                    'type' => 'evolution',
                    'stage' => $newStage,
                    'textEn' => "Evolved to {$stageInfo['nameEn']} after maintenance calibration!",
                    'textAr' => "تطوّر إلى «{$stageInfo['nameAr']}» بعد المعايرة والعناية!",
                    'ts' => $nowSec,
                ];
            } elseif ($newBond >= 80 && $oldBond < 80) {
                $memories[] = [
                    'type' => 'bond_milestone',
                    'stage' => $newStage,
                    'textEn' => "High neural bond synchronization (80%+) achieved with operative.",
                    'textAr' => "تم بلوغ ترابط عصبي عالٍ (80%+) مع العميل.",
                    'ts' => $nowSec,
                ];
            }

            $this->database->execute(
                'UPDATE player_companions
                 SET stage = :nextStage,
                     level = :nextLevel,
                     evolution_xp = :nextXp,
                     bond = :nextBond,
                     readiness = :nextReadiness,
                     care_score = :nextCare,
                     evolution_path = :nextPath,
                     last_fed_at = :fedAt,
                     memories_json = :memJson,
                     updated_at = :updatedAt
                 WHERE id = :rowId',
                [
                    'nextStage' => $newStage,
                    'nextLevel' => $newLevel,
                    'nextXp' => $newXp,
                    'nextBond' => $newBond,
                    'nextReadiness' => $newReadiness,
                    'nextCare' => $newCare,
                    'nextPath' => $evoPath,
                    'fedAt' => $nowSec,
                    'memJson' => json_encode(array_slice($memories, -12), JSON_THROW_ON_ERROR),
                    'updatedAt' => $nowIso,
                    'rowId' => (string) $row['id'],
                ],
            );

            $this->events->publish(new DomainEvent('SyndicateCompanionMaintained', [
                'playerId' => $pid,
                'unitId' => $uid,
                'careMode' => $careMode,
                'bond' => $newBond,
                'readiness' => $newReadiness,
                'evolutionXp' => $newXp,
                'stage' => $newStage,
                'evolved' => $evolved,
            ]));

            $snap = $this->snapshot($pid);
            $snap['route'] = 'companion.feed';
            $snap['result'] = [
                'action' => 'feed_maintain',
                'unitId' => $uid,
                'careMode' => $careMode,
                'bondGain' => $newBond - $oldBond,
                'readinessGain' => $newReadiness - $oldReadiness,
                'xpGain' => self::FEED_XP_GAIN,
                'previousStage' => $oldStage,
                'newStage' => $newStage,
                'evolved' => $evolved,
                'sfxCue' => $evolved ? 'era_breakthrough' : 'equip_snap',
                'summaryEn' => "{$spec['nameEn']} calibrated: Bond {$newBond}% (+". ($newBond - $oldBond) . "%), Readiness {$newReadiness}% (+" . ($newReadiness - $oldReadiness) . "%)."
                    . ($evolved ? " Evolved to {$stageInfo['nameEn']}!" : ''),
                'summaryAr' => "تمت معايرة «{$spec['nameAr']}»: الترابط {$newBond}%، الجاهزية {$newReadiness}%."
                    . ($evolved ? " تطوّر إلى «{$stageInfo['nameAr']}»!" : ''),
            ];
            return $snap;
        });
    }

    /**
     * Runs a tactical training drill (`5E`, `+$EvolutionXP`, auto-evolves across Stage I..IV thresholds).
     *
     * @return array<string, mixed>
     */
    public function trainDrill(
        int|string $playerId,
        ?string $unitId = null,
        string $drillType = 'tactical',
    ): array {
        $pid = $this->normalizePlayerId($playerId);

        return $this->database->transaction(function () use ($pid, $unitId, $drillType): array {
            $player = $this->loadPlayer($pid);
            $currentEnergy = (int) ($player['energy'] ?? 0);
            if ($currentEnergy < self::TRAIN_ENERGY_COST) {
                throw new InvalidArgumentException(
                    'Insufficient Energy for Companion Train Drill (' . $currentEnergy . '/' . self::TRAIN_ENERGY_COST . 'E required).'
                );
            }

            $row = $this->resolveTargetCompanionRow($pid, $unitId);
            $uid = (string) $row['unit_id'];
            $spec = self::COMPANION_UNITS[$uid];
            $nowSec = $this->nowSec();
            $nowIso = gmdate('c', $nowSec);

            $oldStage = (int) $row['stage'];
            $oldLevel = (int) $row['level'];
            $oldXp = (int) $row['evolution_xp'];
            $oldBond = (int) $row['bond'];
            $oldReadiness = (int) $row['readiness'];
            $oldDrills = (int) $row['drill_count'];

            // Deduct 5 Energy from player
            $nextEnergy = $currentEnergy - self::TRAIN_ENERGY_COST;
            $this->database->execute(
                'UPDATE players SET energy = :nextEnergy WHERE id = :pid',
                [
                    'nextEnergy' => $nextEnergy,
                    'pid' => $pid,
                ],
            );

            // Bond & readiness amplify drill XP gain (base 95 + up to 25 bonus = 100..120 XP per drill)
            $bondBonusXp = (int) round(($oldBond / 100) * 15) + ($oldReadiness >= 60 ? 10 : 0);
            $xpGain = self::TRAIN_BASE_XP + $bondBonusXp;
            $newXp = $oldXp + $xpGain;
            $newBond = min(100, $oldBond + 6);
            $newReadiness = max(10, $oldReadiness - self::TRAIN_READINESS_COST);
            $newDrills = $oldDrills + 1;

            $stageInfo = self::resolveStageForXp($newXp);
            $newStage = $stageInfo['stage'];
            $newLevel = $stageInfo['level'];
            $evolved = $newStage > $oldStage;
            $evoPath = $this->resolveEvolutionPath((int) $row['care_score'], $newDrills);

            $memories = $this->decodeMemories((string) $row['memories_json']);
            if ($evolved) {
                $stageUnitTitleEn = $spec['stageNamesEn'][$newStage] ?? $stageInfo['nameEn'];
                $stageUnitTitleAr = $spec['stageNamesAr'][$newStage] ?? $stageInfo['nameAr'];
                $memories[] = [
                    'type' => 'evolution',
                    'stage' => $newStage,
                    'textEn' => "Breakthrough to {$stageInfo['nameEn']} ({$stageUnitTitleEn}) at {$newXp} XP!",
                    'textAr' => "اختراق المرحلة إلى «{$stageInfo['nameAr']}» ({$stageUnitTitleAr}) عند {$newXp} XP!",
                    'ts' => $nowSec,
                ];
            }

            $this->database->execute(
                'UPDATE player_companions
                 SET stage = :nextStage,
                     level = :nextLevel,
                     evolution_xp = :nextXp,
                     bond = :nextBond,
                     readiness = :nextReadiness,
                     drill_count = :nextDrills,
                     evolution_path = :nextPath,
                     last_drill_at = :drillAt,
                     memories_json = :memJson,
                     updated_at = :updatedAt
                 WHERE id = :rowId',
                [
                    'nextStage' => $newStage,
                    'nextLevel' => $newLevel,
                    'nextXp' => $newXp,
                    'nextBond' => $newBond,
                    'nextReadiness' => $newReadiness,
                    'nextDrills' => $newDrills,
                    'nextPath' => $evoPath,
                    'drillAt' => $nowSec,
                    'memJson' => json_encode(array_slice($memories, -12), JSON_THROW_ON_ERROR),
                    'updatedAt' => $nowIso,
                    'rowId' => (string) $row['id'],
                ],
            );

            if ($evolved) {
                $this->events->publish(new DomainEvent('SyndicateCompanionEvolved', [
                    'playerId' => $pid,
                    'unitId' => $uid,
                    'previousStage' => $oldStage,
                    'newStage' => $newStage,
                    'previousLevel' => $oldLevel,
                    'newLevel' => $newLevel,
                    'evolutionXp' => $newXp,
                ]));
            }

            $this->events->publish(new DomainEvent('SyndicateCompanionDrilled', [
                'playerId' => $pid,
                'unitId' => $uid,
                'drillType' => $drillType,
                'energySpent' => self::TRAIN_ENERGY_COST,
                'xpGain' => $xpGain,
                'evolutionXp' => $newXp,
                'stage' => $newStage,
                'evolved' => $evolved,
            ]));

            $snap = $this->snapshot($pid);
            $snap['route'] = 'companion.train';
            $snap['result'] = [
                'action' => 'train_drill',
                'unitId' => $uid,
                'drillType' => $drillType,
                'energySpent' => self::TRAIN_ENERGY_COST,
                'xpGain' => $xpGain,
                'evolutionXp' => $newXp,
                'previousStage' => $oldStage,
                'newStage' => $newStage,
                'previousLevel' => $oldLevel,
                'newLevel' => $newLevel,
                'evolved' => $evolved,
                'sfxCue' => $evolved ? 'era_breakthrough' : 'xp_gain',
                'summaryEn' => "{$spec['nameEn']} completed {$drillType} drill (-" . self::TRAIN_ENERGY_COST . "E, +{$xpGain} Evolution XP)."
                    . ($evolved ? " Evolved to {$stageInfo['nameEn']}!" : ''),
                'summaryAr' => "أكمل «{$spec['nameAr']}» التدريب التكتيكي (-" . self::TRAIN_ENERGY_COST . " طاقة، +{$xpGain} خبرة تطور)."
                    . ($evolved ? " تطوّر إلى «{$stageInfo['nameAr']}»!" : ''),
            ];
            return $snap;
        });
    }

    /**
     * Dispatches the companion on a cooldown-gated Syndicate sector patrol for passive cash, intel & evolution XP.
     *
     * @return array<string, mixed>
     */
    public function patrolDispatch(
        int|string $playerId,
        ?string $unitId = null,
        string $sector = 'center',
    ): array {
        $pid = $this->normalizePlayerId($playerId);
        $cleanSector = strtolower(trim($sector));
        if (!in_array($cleanSector, ['north', 'west', 'center', 'fin', 'red', 'res'], true)) {
            $cleanSector = 'center';
        }

        return $this->database->transaction(function () use ($pid, $unitId, $cleanSector): array {
            $player = $this->loadPlayer($pid);
            $row = $this->resolveTargetCompanionRow($pid, $unitId);
            $uid = (string) $row['unit_id'];
            $spec = self::COMPANION_UNITS[$uid];
            $nowSec = $this->nowSec();
            $nowIso = gmdate('c', $nowSec);

            $cooldownUntil = (int) $row['patrol_cooldown_until'];
            if ($nowSec < $cooldownUntil) {
                $rem = $cooldownUntil - $nowSec;
                throw new InvalidArgumentException(
                    "Companion patrol dispatch is on cooldown ({$rem}s remaining)."
                );
            }

            $oldReadiness = (int) $row['readiness'];
            if ($oldReadiness < self::PATROL_MIN_READINESS) {
                throw new InvalidArgumentException(
                    'Companion Readiness too low for patrol dispatch (' . $oldReadiness . '% < ' . self::PATROL_MIN_READINESS . '%). Feed/Calibrate first.'
                );
            }

            $oldStage = (int) $row['stage'];
            $oldBond = (int) $row['bond'];
            $oldXp = (int) $row['evolution_xp'];
            $oldPatrols = (int) $row['patrol_count'];

            $cashEarned = 500 + ($oldStage * 320) + ($oldBond * 5);
            $playerXpEarned = 20 + ($oldStage * 12);
            $companionXpGain = self::PATROL_XP_GAIN;
            $newXp = $oldXp + $companionXpGain;
            $newBond = min(100, $oldBond + 5);
            $newReadiness = max(0, $oldReadiness - self::PATROL_READINESS_COST);
            $newPatrols = $oldPatrols + 1;
            $nextCooldownUntil = $nowSec + self::PATROL_COOLDOWN_SEC;

            $stageInfo = self::resolveStageForXp($newXp);
            $newStage = $stageInfo['stage'];
            $newLevel = $stageInfo['level'];
            $evolved = $newStage > $oldStage;

            // Credit player cash + XP
            $nextCash = (int) ($player['cash'] ?? 0) + $cashEarned;
            $nextPlayerXp = (int) ($player['xp'] ?? 0) + $playerXpEarned;
            $this->database->execute(
                'UPDATE players SET cash = :nextCash, xp = :nextXp WHERE id = :pid',
                [
                    'nextCash' => $nextCash,
                    'nextXp' => $nextPlayerXp,
                    'pid' => $pid,
                ],
            );

            $lootSpec = $spec['patrolLoot'];
            $memories = $this->decodeMemories((string) $row['memories_json']);
            $memories[] = [
                'type' => 'patrol',
                'stage' => $newStage,
                'textEn' => "Patrol in Sector " . strtoupper($cleanSector) . " recovered {$lootSpec['nameEn']} (+\${$cashEarned}).",
                'textAr' => "استعادت الدورية في قطاع " . strtoupper($cleanSector) . " «{$lootSpec['nameAr']}» (+\${$cashEarned}).",
                'ts' => $nowSec,
            ];

            $this->database->execute(
                'UPDATE player_companions
                 SET stage = :nextStage,
                     level = :nextLevel,
                     evolution_xp = :nextXp,
                     bond = :nextBond,
                     readiness = :nextReadiness,
                     patrol_count = :nextPatrols,
                     patrol_cooldown_until = :cooldownUntil,
                     memories_json = :memJson,
                     updated_at = :updatedAt
                 WHERE id = :rowId',
                [
                    'nextStage' => $newStage,
                    'nextLevel' => $newLevel,
                    'nextXp' => $newXp,
                    'nextBond' => $newBond,
                    'nextReadiness' => $newReadiness,
                    'nextPatrols' => $newPatrols,
                    'cooldownUntil' => $nextCooldownUntil,
                    'memJson' => json_encode(array_slice($memories, -12), JSON_THROW_ON_ERROR),
                    'updatedAt' => $nowIso,
                    'rowId' => (string) $row['id'],
                ],
            );

            $this->events->publish(new DomainEvent('SyndicateCompanionPatrolCompleted', [
                'playerId' => $pid,
                'unitId' => $uid,
                'sector' => $cleanSector,
                'cashEarned' => $cashEarned,
                'playerXpEarned' => $playerXpEarned,
                'companionXpGain' => $companionXpGain,
                'lootItemId' => $lootSpec['itemId'],
                'cooldownUntil' => $nextCooldownUntil,
                'evolved' => $evolved,
            ]));

            $snap = $this->snapshot($pid);
            $snap['route'] = 'companion.patrol';
            $snap['result'] = [
                'action' => 'patrol_dispatch',
                'unitId' => $uid,
                'sector' => $cleanSector,
                'cashEarned' => $cashEarned,
                'playerXpEarned' => $playerXpEarned,
                'xpGain' => $companionXpGain,
                'loot' => [
                    'itemId' => $lootSpec['itemId'],
                    'nameEn' => $lootSpec['nameEn'],
                    'nameAr' => $lootSpec['nameAr'],
                ],
                'cooldownSec' => self::PATROL_COOLDOWN_SEC,
                'cooldownUntil' => $nextCooldownUntil,
                'previousStage' => $oldStage,
                'newStage' => $newStage,
                'evolved' => $evolved,
                'sfxCue' => $evolved ? 'era_breakthrough' : 'cash_payout',
                'summaryEn' => "{$spec['nameEn']} returned from Sector " . strtoupper($cleanSector) . " patrol: +\${$cashEarned}, +{$playerXpEarned} XP, {$lootSpec['nameEn']}!",
                'summaryAr' => "عاد «{$spec['nameAr']}» من دورية القطاع " . strtoupper($cleanSector) . ": +\${$cashEarned}، +{$playerXpEarned} XP، «{$lootSpec['nameAr']}»!",
            ];
            return $snap;
        });
    }

    /**
     * Returns the active companion's combat, stealth, travel, and bazaar modifiers for downstream engine systems.
     *
     * @return array<string, int>
     */
    public function getCompanionModifiers(int|string $playerId): array
    {
        $snap = $this->snapshot($playerId);
        return is_array($snap['modifiers'] ?? null)
            ? $snap['modifiers']
            : self::emptyModifiers();
    }

    /**
     * Pure deterministic resolver mapping `evolutionXp` -> Stage (I..IV), Guardian Level (1..50), Title & Progress.
     *
     * @return array<string, mixed>
     */
    public static function resolveStageForXp(int $evolutionXp): array
    {
        $xp = max(0, $evolutionXp);
        $stageNum = 1;
        if ($xp >= 600) {
            $stageNum = 4;
        } elseif ($xp >= 300) {
            $stageNum = 3;
        } elseif ($xp >= 100) {
            $stageNum = 2;
        }

        $spec = self::EVOLUTION_STAGES[$stageNum];
        $minXp = $spec['minXp'];
        $nextXp = $spec['nextXp'];

        if ($nextXp === null) {
            $progressPct = 100;
            $level = min(50, 40 + intdiv($xp - 600, 40));
        } else {
            $span = max(1, $nextXp - $minXp);
            $into = max(0, $xp - $minXp);
            $progressPct = min(100, (int) round(($into / $span) * 100));
            $lvlSpan = max(1, $spec['maxLevel'] - $spec['minLevel']);
            $level = $spec['minLevel'] + min($lvlSpan, (int) floor(($into / $span) * ($lvlSpan + 1)));
        }

        $guardianTitle = 'Spark';
        foreach (self::GUARDIAN_TITLES as $milestoneLvl => $title) {
            if ($level >= $milestoneLvl) {
                $guardianTitle = $title;
            }
        }

        return [
            'stage' => $stageNum,
            'roman' => $spec['roman'],
            'code' => $spec['code'],
            'nameEn' => $spec['nameEn'],
            'nameAr' => $spec['nameAr'],
            'level' => $level,
            'guardianTitle' => $guardianTitle,
            'guardianTierEn' => $spec['guardianTierEn'],
            'guardianTierAr' => $spec['guardianTierAr'],
            'currentXp' => $xp,
            'stageMinXp' => $minXp,
            'nextStageXp' => $nextXp,
            'progressPct' => $progressPct,
            'scaleMultiplier' => $spec['scaleMultiplier'],
            'visualComplexity' => $spec['visualComplexity'],
        ];
    }

    /**
     * Pure deterministic calculator for a companion unit's active modifiers at Stage I..IV & Bond/Readiness levels.
     *
     * @return array<string, int>
     */
    public static function computeUnitModifiers(
        string $unitId,
        int $stage,
        int $bond = 50,
        int $readiness = 80,
    ): array {
        $out = self::emptyModifiers();
        if (!isset(self::COMPANION_UNITS[$unitId])) {
            return $out;
        }

        $clampedStage = max(1, min(4, $stage));
        $spec = self::COMPANION_UNITS[$unitId];
        $baseBonuses = $spec['stageBonuses'][$clampedStage] ?? $spec['stageBonuses'][1];

        // High bond (>=75) & readiness (>=60) grant up to +15% synergy amplification
        $synergyFactor = 1.0;
        if ($bond >= 75) {
            $synergyFactor += 0.08;
        }
        if ($readiness >= 60) {
            $synergyFactor += 0.07;
        } elseif ($readiness < 20) {
            $synergyFactor -= 0.15;
        }

        foreach ($baseBonuses as $key => $val) {
            $out[$key] = max(1, (int) round(((int) $val) * $synergyFactor));
        }

        return $out;
    }

    /**
     * @return array<string, int>
     */
    private static function emptyModifiers(): array
    {
        return [
            'stealthPct' => 0,
            'visionBlindSpotDeg' => 0,
            'noiseReductionDb' => 0,
            'combatDamagePct' => 0,
            'counterBleedPct' => 0,
            'armorMitigationPct' => 0,
            'travelSpeedPct' => 0,
            'contrabandCapacity' => 0,
            'evasionPct' => 0,
            'bazaarFeeReductionPct' => 0,
            'vaultHackPct' => 0,
            'mugYieldPct' => 0,
        ];
    }

    /**
     * @param array<string, mixed> $spec
     * @param ?array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function buildCompanionUnitView(
        string $unitId,
        array $spec,
        ?array $row,
        int $nowSec,
    ): array {
        $adopted = $row !== null;
        $xp = $adopted ? (int) $row['evolution_xp'] : 0;
        $stageInfo = self::resolveStageForXp($xp);
        $stage = $stageInfo['stage'];
        $bond = $adopted ? (int) $row['bond'] : 40;
        $readiness = $adopted ? (int) $row['readiness'] : 85;
        $careScore = $adopted ? (int) $row['care_score'] : 50;
        $cooldownUntil = $adopted ? (int) $row['patrol_cooldown_until'] : 0;
        $cooldownRemainingSec = max(0, $cooldownUntil - $nowSec);
        $modifiers = self::computeUnitModifiers($unitId, $stage, $bond, $readiness);

        return [
            'unitId' => $unitId,
            'adopted' => $adopted,
            'isActive' => $adopted && ((int) ($row['is_active'] ?? 0) === 1),
            'callsign' => $adopted ? (string) $row['callsign'] : (string) $spec['defaultCallsign'],
            'nameEn' => $spec['nameEn'],
            'nameAr' => $spec['nameAr'],
            'stageTitleEn' => $spec['stageNamesEn'][$stage] ?? $stageInfo['nameEn'],
            'stageTitleAr' => $spec['stageNamesAr'][$stage] ?? $stageInfo['nameAr'],
            'archetype' => $spec['archetype'],
            'accentTone' => $spec['accentTone'],
            'specialtyEn' => $spec['specialtyEn'],
            'specialtyAr' => $spec['specialtyAr'],
            'loreEn' => $spec['loreEn'],
            'loreAr' => $spec['loreAr'],
            'stage' => $stage,
            'stageRoman' => $stageInfo['roman'],
            'stageNameEn' => $stageInfo['nameEn'],
            'stageNameAr' => $stageInfo['nameAr'],
            'level' => $stageInfo['level'],
            'guardianTitle' => $stageInfo['guardianTitle'],
            'guardianTierEn' => $stageInfo['guardianTierEn'],
            'guardianTierAr' => $stageInfo['guardianTierAr'],
            'evolutionXp' => $xp,
            'stageMinXp' => $stageInfo['stageMinXp'],
            'nextStageXp' => $stageInfo['nextStageXp'],
            'evolutionProgressPct' => $stageInfo['progressPct'],
            'bond' => $bond,
            'readiness' => $readiness,
            'careScore' => $careScore,
            'evolutionPath' => $adopted ? (string) $row['evolution_path'] : 'balanced',
            'patrolCount' => $adopted ? (int) $row['patrol_count'] : 0,
            'drillCount' => $adopted ? (int) $row['drill_count'] : 0,
            'patrolCooldownUntil' => $cooldownUntil,
            'patrolCooldownRemainingSec' => $cooldownRemainingSec,
            'patrolReady' => $adopted && $cooldownRemainingSec === 0 && $readiness >= self::PATROL_MIN_READINESS,
            'modifiers' => $modifiers,
            'patrolLoot' => $spec['patrolLoot'],
            'model3d' => array_merge($spec['model3d'], [
                'stage' => $stage,
                'scaleMultiplier' => $stageInfo['scaleMultiplier'],
                'visualComplexity' => $stageInfo['visualComplexity'],
            ]),
            'memories' => $adopted ? $this->decodeMemories((string) $row['memories_json']) : [],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function ensureStarterCompanionAndLoadAll(string $playerId): array
    {
        $rows = $this->database->fetchAll(
            'SELECT * FROM player_companions WHERE player_id = :pid ORDER BY unit_id ASC',
            ['pid' => $playerId],
        );
        if ($rows !== []) {
            return $rows;
        }

        $nowSec = $this->nowSec();
        $nowIso = gmdate('c', $nowSec);
        $starterSpec = self::COMPANION_UNITS[self::DEFAULT_UNIT_ID];
        $starterMemories = [
            [
                'type' => 'adoption',
                'stage' => 1,
                'textEn' => "Starter Syndicate unit {$starterSpec['nameEn']} paired with operative.",
                'textAr' => "تم إقران وحدة الاستطلاع الأساسية «{$starterSpec['nameAr']}» مع العميل.",
                'ts' => $nowSec,
            ],
        ];

        $this->database->insertIgnore(
            'player_companions',
            [
                'id',
                'player_id',
                'unit_id',
                'callsign',
                'stage',
                'level',
                'evolution_xp',
                'bond',
                'readiness',
                'care_score',
                'evolution_path',
                'is_active',
                'patrol_count',
                'drill_count',
                'last_fed_at',
                'last_drill_at',
                'patrol_cooldown_until',
                'memories_json',
                'updated_at',
            ],
            [
                $playerId . ':' . self::DEFAULT_UNIT_ID,
                $playerId,
                self::DEFAULT_UNIT_ID,
                $starterSpec['defaultCallsign'],
                1,
                1,
                0,
                45,
                90,
                55,
                'balanced',
                1,
                0,
                0,
                $nowSec,
                0,
                0,
                json_encode($starterMemories, JSON_THROW_ON_ERROR),
                $nowIso,
            ],
        );

        return $this->database->fetchAll(
            'SELECT * FROM player_companions WHERE player_id = :pid ORDER BY unit_id ASC',
            ['pid' => $playerId],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveTargetCompanionRow(string $playerId, ?string $unitId): array
    {
        $rows = $this->ensureStarterCompanionAndLoadAll($playerId);
        if ($unitId !== null && trim($unitId) !== '') {
            $cleanId = $this->validateUnitId($unitId);
            foreach ($rows as $row) {
                if ((string) $row['unit_id'] === $cleanId) {
                    return $row;
                }
            }
            throw new InvalidArgumentException("Companion unit '{$cleanId}' has not been adopted yet.");
        }

        foreach ($rows as $row) {
            if ((int) ($row['is_active'] ?? 0) === 1) {
                return $row;
            }
        }

        return $rows[0];
    }

    private function setActiveUnitInternal(string $playerId, string $activeUnitId, string $nowIso): void
    {
        $this->database->execute(
            'UPDATE player_companions
             SET is_active = CASE WHEN unit_id = :activeUnit THEN 1 ELSE 0 END,
                 updated_at = :updatedAt
             WHERE player_id = :pid',
            [
                'activeUnit' => $activeUnitId,
                'updatedAt' => $nowIso,
                'pid' => $playerId,
            ],
        );
    }

    private function resolveEvolutionPath(int $careScore, int $drillCount): string
    {
        if ($careScore >= 75 && $drillCount <= 3) {
            return 'guardian';
        }
        if ($drillCount >= 4 && $careScore < 70) {
            return 'warrior';
        }
        return 'balanced';
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function decodeMemories(string $json): array
    {
        try {
            $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
            return is_array($decoded) ? array_values($decoded) : [];
        } catch (Throwable) {
            return [];
        }
    }

    private function validateUnitId(string $unitId): string
    {
        $clean = strtolower(trim($unitId));
        if (!isset(self::COMPANION_UNITS[$clean])) {
            throw new InvalidArgumentException("Unknown Syndicate companion unit: {$unitId}");
        }
        return $clean;
    }

    private function sanitizeCallsign(?string $callsign, string $fallback): string
    {
        $raw = trim((string) ($callsign ?? ''));
        if ($raw === '') {
            return $fallback;
        }
        $clean = preg_replace('/[^A-Za-z0-9 _-]/u', '', $raw);
        $clean = trim((string) $clean);
        return $clean !== '' ? substr($clean, 0, 32) : $fallback;
    }

    private function normalizePlayerId(int|string $playerId): string
    {
        $clean = trim((string) $playerId);
        if ($clean === '' || strlen($clean) > 64 || !preg_match('/^[A-Za-z0-9_-]+$/D', $clean)) {
            throw new InvalidArgumentException('Invalid player identifier for SyndicateCompanionService.');
        }
        return $clean;
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

    private function nowSec(): int
    {
        if ($this->clock !== null) {
            return (int) floor((float) ($this->clock)());
        }
        return time();
    }
}

if (!class_exists('Zone\\Core\\Game\\SyndicateCompanionService', false)) {
    class_alias(SyndicateCompanionService::class, 'Zone\\Core\\Game\\SyndicateCompanionService');
}
