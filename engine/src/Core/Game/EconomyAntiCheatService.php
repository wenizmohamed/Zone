<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Closure;
use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * ZONE v155 — Track 6: MMO Sink/Faucet Economy Equilibrium & Server-Authoritative Anti-Cheat Service.
 *
 * ============================================================================
 * INTEGRATION GUIDE FOR @integrator (v155)
 * ============================================================================
 * Autoloaded via `engine/bootstrap.php` under `Zone\Engine\Core\Game\EconomyAntiCheatService`
 * (also aliased to `Zone\Core\Game\EconomyAntiCheatService` when loaded).
 *
 * Constructor:
 *   new EconomyAntiCheatService(
 *       Database $database,
 *       ?Ledger $ledger = null,
 *       ?EventBus $events = null,
 *       ?Closure $clockMs = null,
 *   )
 *
 * Core Public Methods to Wire:
 *   1. `getEconomyHudState(int|string $playerId, ?int $nowMs = null): array`
 *      - Wire to `GET /api/v1/syndicate-economy` (merge under `'equilibriumHud'` or action `'economy.hud_state'`).
 *      - Returns rolling 24h player & global Faucets vs Sinks, live `faucetSinkRatio` vs `1.08 - 1.15`
 *        healthy band, 6-District Threat Radar telemetry + Next Objective waypoint, Era/Level-scaled
 *        Syndicate Sink quotes (`launder_heat`, `hone_weapon`, `bribe_wardens`), and active buffs.
 *
 *   2. `executeSyndicateSink(int|string $playerId, string $sinkKey, array $options = []): array`
 *      - Wire to `POST /api/v1/syndicate-economy/action` when `action === 'economy.sink'`
 *        (with `$sinkKey = (string) ($body['sinkKey'] ?? $body['id'] ?? '')`, `$options = $body`)
 *        or direct actions `'sink.launder_heat' | 'sink.hone_weapon' | 'sink.bribe_wardens'`.
 *      - Atomically validates optional anti-cheat envelope (`nonce`), debits cash inside
 *        `Database::playerTransaction`, writes sink entry to `economy_ledger`, applies district
 *        heat drop / `+6%` 2h weapon precision buff / `-50%` jail & hospital recovery, and
 *        returns updated `hudState`.
 *
 *   3. `validateActionEnvelope(int|string $playerId, string $actionKey, ?string $nonce = null, array $meta = []): array`
 *      - Server-authoritative anti-cheat & replay guard for mutation routes.
 *      - Rejects duplicate replay nonces, sustained sub-human macro bursts (`< 110ms` across `>= 6`
 *        mutations) without false-flagging normal human rapid clicks, and tampered negative/NaN/Inf
 *        quantities, logging violations to `security_audit_events`.
 *
 * Dual SQL Law (PostgreSQL 16 + SQLite):
 *   - 100% standard SQL (`CASE WHEN`, unique named PDO params per statement, idempotent
 *     `CREATE TABLE IF NOT EXISTS` & `CREATE INDEX IF NOT EXISTS`).
 * ============================================================================
 */
final class EconomyAntiCheatService
{
    public const HEALTHY_RATIO_MIN = 1.08;
    public const HEALTHY_RATIO_MAX = 1.15;
    public const HEALTHY_RATIO_TARGET = 1.115;
    public const INFLATION_ALERT_RATIO = 1.30;

    public const MACRO_BURST_MIN_MUTATIONS = 6;
    public const MACRO_BURST_INTERVAL_MS = 110;
    public const MACRO_BURST_WINDOW_MS = 5_000;
    public const NONCE_TTL_MS = 86_400_000; // 24h replay window
    public const ROLLING_WINDOW_SECONDS = 86_400; // 24h economy telemetry window

    public const HONE_WEAPON_PRECISION_BPS = 600; // +6.00% precision edge
    public const HONE_WEAPON_DURATION_MS = 7_200_000; // 2 hours
    public const LAUNDER_HEAT_DROP = 35;
    public const LAUNDER_SHIELD_DURATION_MS = 5_400_000; // 90 minutes
    public const BRIBE_WARDENS_RECOVERY_PCT = 50; // 50% faster jail/hospital recovery
    public const BRIBE_WARDENS_MIN_REDUCTION_MS = 600_000; // minimum 10m shaved off active timers
    public const BRIBE_WARDENS_RETAINER_MS = 7_200_000; // 2h retainer

    /**
     * Canonical 6 Zone City districts matching `territory_blocks.district_id` in Database.php.
     *
     * @var array<string, array{code: string, compass: string, angleDeg: int, radiusPct: int, nameEn: string, nameAr: string, route: string, baseHeat: int}>
     */
    public const DISTRICTS = [
        'north' => [
            'code' => 'NTH',
            'compass' => 'N',
            'angleDeg' => 0,
            'radiusPct' => 68,
            'nameEn' => 'North Harbor & Pier 4',
            'nameAr' => 'المرفأ الشمالي والرصيف ٤',
            'route' => 'crimes',
            'baseHeat' => 38,
        ],
        'fin' => [
            'code' => 'FIN',
            'compass' => 'NE',
            'angleDeg' => 60,
            'radiusPct' => 62,
            'nameEn' => 'Financial Citadel',
            'nameAr' => 'القلعة المالية',
            'route' => 'bank',
            'baseHeat' => 24,
        ],
        'res' => [
            'code' => 'RES',
            'compass' => 'SE',
            'angleDeg' => 125,
            'radiusPct' => 64,
            'nameEn' => 'East Safehouse Quarter',
            'nameAr' => 'حي المخابئ الشرقي',
            'route' => 'properties',
            'baseHeat' => 16,
        ],
        'red' => [
            'code' => 'RED',
            'compass' => 'S',
            'angleDeg' => 185,
            'radiusPct' => 72,
            'nameEn' => 'Crimson Foundry & Arena',
            'nameAr' => 'المسبك القرمزي والساحة',
            'route' => 'attack',
            'baseHeat' => 54,
        ],
        'west' => [
            'code' => 'WST',
            'compass' => 'SW',
            'angleDeg' => 245,
            'radiusPct' => 66,
            'nameEn' => 'West Neon Casino Strip',
            'nameAr' => 'شارع النيون والكازينو',
            'route' => 'casino',
            'baseHeat' => 32,
        ],
        'center' => [
            'code' => 'CTR',
            'compass' => 'NW',
            'angleDeg' => 305,
            'radiusPct' => 42,
            'nameEn' => 'Central Syndicate Plaza',
            'nameAr' => 'ساحة النقابة المركزية',
            'route' => 'city',
            'baseHeat' => 28,
        ],
    ];

    /**
     * Voluntary high-prestige Syndicate Sinks (`game-economy-design`).
     * Base costs are tuned for Era I (Level 1) affordability and scale progressively by Era, Level,
     * high-net-worth brackets, and live server Faucet/Sink inflation stabilizer.
     *
     * @var array<string, array{id: string, baseCost: int, nameEn: string, nameAr: string, descEn: string, descAr: string, badgeEn: string, badgeAr: string, durationMs: int}>
     */
    public const SYNDICATE_SINKS = [
        'launder_heat' => [
            'id' => 'launder_heat',
            'baseCost' => 450,
            'nameEn' => 'Bribe & Launder District Heat',
            'nameAr' => 'رشوة وتبييض حرارة المقاطعة',
            'descEn' => 'Drops District Police Heat by -35 pts immediately and arms a 90m heat-suppression shield.',
            'descAr' => 'يخفض حرارة الشرطة في المقاطعة بمقدار 35 نقطة فوراً ويفعّل درع تهدئة لمدة 90 دقيقة.',
            'badgeEn' => '-35 Heat · 90m Shield',
            'badgeAr' => '-35 حرارة · درع 90د',
            'durationMs' => self::LAUNDER_SHIELD_DURATION_MS,
        ],
        'hone_weapon' => [
            'id' => 'hone_weapon',
            'baseCost' => 600,
            'nameEn' => 'Syndicate Precision Hone',
            'nameAr' => 'صقل السلاح التكتيكي الدقيق',
            'descEn' => 'Master gunsmith calibration granting +6% weapon precision & hit edge for 2 hours.',
            'descAr' => 'معايرة احترافية تمنح +6% دقة إصابة وتفوّقاً تكتيكياً للسلاح لمدة ساعتين.',
            'badgeEn' => '+6% Precision · 2h',
            'badgeAr' => '+6% دقة · ساعتان',
            'durationMs' => self::HONE_WEAPON_DURATION_MS,
        ],
        'bribe_wardens' => [
            'id' => 'bribe_wardens',
            'baseCost' => 500,
            'nameEn' => 'Bribe Wardens & Trauma Triage',
            'nameAr' => 'رشوة الحراس وتسريع الإخلاء الطبي',
            'descEn' => 'Cuts active Jail & Hospital recovery timers by 50% (min 10m) and arms a 2h rapid-release retainer.',
            'descAr' => 'يقلص وقت السجن والمستشفى الحالي بنسبة 50% (10 دقائق كحد أدنى) مع ضمان إخلاء سريع لساعتين.',
            'badgeEn' => '-50% Jail/Hosp · 2h',
            'badgeAr' => '-50% سجن/مستشفى · ساعتان',
            'durationMs' => self::BRIBE_WARDENS_RETAINER_MS,
        ],
    ];

    /**
     * Era progressive multipliers matching AscensionEngineService::ERAS (1..6).
     *
     * @var array<int, float>
     */
    private const ERA_SINK_MULTIPLIERS = [
        1 => 1.00,  // Lv 1-2: Gutter Rat
        2 => 1.85,  // Lv 3-6: Dockside Runner
        3 => 3.60,  // Lv 7-11: Street Enforcer
        4 => 7.20,  // Lv 12-14: District Capo
        5 => 15.50, // Lv 15-24: Cartel Baron
        6 => 34.00, // Lv 25+: City Sovereign
    ];

    /** @var list<string> */
    private const NON_FAUCET_TRANSFER_REASONS = [
        'bank.deposit',
        'bank.withdraw',
        'vault.deposit',
        'vault.withdraw',
        'trade.escrow',
        'trade.release',
    ];

    /** @var array<int, bool> */
    private static array $schemaEnsured = [];

    private readonly Ledger $ledger;
    private readonly EventBus $events;

    public function __construct(
        private readonly Database $database,
        ?Ledger $ledger = null,
        ?EventBus $events = null,
        private readonly ?Closure $clockMs = null,
    ) {
        $this->ledger = $ledger ?? new Ledger($database);
        $this->events = $events ?? new EventBus($database);
        $this->ensureSchema();
    }

    /**
     * Idempotent dual-driver (PostgreSQL 16 + SQLite) schema setup.
     */
    public function ensureSchema(): void
    {
        $dbKey = spl_object_id($this->database);
        if (!empty(self::$schemaEnsured[$dbKey])) {
            return;
        }

        $this->database->execute(
            'CREATE TABLE IF NOT EXISTS security_audit_events (
                id VARCHAR(40) PRIMARY KEY,
                player_id VARCHAR(100) NOT NULL,
                action_key VARCHAR(80) NOT NULL,
                flag_type VARCHAR(60) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                blocked INTEGER NOT NULL DEFAULT 1,
                nonce VARCHAR(128),
                cadence_ms INTEGER,
                details_json TEXT NOT NULL,
                created_at_ms BIGINT NOT NULL,
                created_at VARCHAR(40) NOT NULL
            )'
        );
        $this->database->execute(
            'CREATE INDEX IF NOT EXISTS idx_sec_audit_player_time ON security_audit_events(player_id, created_at_ms)'
        );

        $this->database->execute(
            'CREATE TABLE IF NOT EXISTS security_action_nonces (
                player_id VARCHAR(100) NOT NULL,
                nonce VARCHAR(128) NOT NULL,
                action_key VARCHAR(80) NOT NULL,
                created_at_ms BIGINT NOT NULL,
                expires_at_ms BIGINT NOT NULL,
                PRIMARY KEY (player_id, nonce)
            )'
        );
        $this->database->execute(
            'CREATE INDEX IF NOT EXISTS idx_sec_nonces_exp ON security_action_nonces(expires_at_ms)'
        );

        $this->database->execute(
            'CREATE TABLE IF NOT EXISTS security_mutation_cadence (
                id VARCHAR(40) PRIMARY KEY,
                player_id VARCHAR(100) NOT NULL,
                action_key VARCHAR(80) NOT NULL,
                occurred_at_ms BIGINT NOT NULL
            )'
        );
        $this->database->execute(
            'CREATE INDEX IF NOT EXISTS idx_sec_cadence_player_ms ON security_mutation_cadence(player_id, occurred_at_ms)'
        );

        $this->database->execute(
            'CREATE TABLE IF NOT EXISTS syndicate_sink_buffs (
                player_id VARCHAR(100) NOT NULL,
                sink_key VARCHAR(48) NOT NULL,
                district_id VARCHAR(32) NOT NULL DEFAULT \'center\',
                potency_bps INTEGER NOT NULL DEFAULT 0,
                heat_delta INTEGER NOT NULL DEFAULT 0,
                cost_cash BIGINT NOT NULL DEFAULT 0,
                activated_at_ms BIGINT NOT NULL,
                expires_at_ms BIGINT NOT NULL,
                metadata_json TEXT NOT NULL,
                PRIMARY KEY (player_id, sink_key)
            )'
        );

        self::$schemaEnsured[$dbKey] = true;
    }

    /**
     * Pure equilibrium math helper (`game-economy-design` 1.08 - 1.15 healthy band).
     *
     * When both 24h faucets and 24h sinks are zero on a fresh server boot, returns the
     * neutral baseline target (`1.115`) so new servers start in healthy equilibrium
     * instead of dividing by zero.
     *
     * @return array{
     *   faucets24h: int,
     *   sinks24h: int,
     *   netFlow24h: int,
     *   faucetSinkRatio: float,
     *   targetBandMin: float,
     *   targetBandMax: float,
     *   targetIdeal: float,
     *   inHealthyBand: bool,
     *   bandStatus: string,
     *   sinkPriceStabilizer: float
     * }
     */
    public static function computeEquilibriumMetrics(int $faucets24h, int $sinks24h): array
    {
        $safeFaucets = max(0, $faucets24h);
        $safeSinks = max(0, $sinks24h);

        if ($safeFaucets === 0 && $safeSinks === 0) {
            $ratio = self::HEALTHY_RATIO_TARGET;
        } elseif ($safeSinks === 0) {
            // Pure faucet inflow with zero sinks yet: softly bounded above alert threshold.
            $ratio = round(min(3.50, 1.35 + ($safeFaucets / 50_000)), 4);
        } else {
            $ratio = round($safeFaucets / $safeSinks, 4);
        }

        $inHealthyBand = $ratio >= self::HEALTHY_RATIO_MIN && $ratio <= self::HEALTHY_RATIO_MAX;

        if ($ratio < self::HEALTHY_RATIO_MIN) {
            $bandStatus = 'deflationary';
            // Deflation guard: ease voluntary sink prices slightly so players never feel over-sunk.
            $deficit = self::HEALTHY_RATIO_MIN - $ratio;
            $stabilizer = max(0.85, round(1.0 - ($deficit * 0.25), 4));
        } elseif ($inHealthyBand) {
            $bandStatus = 'healthy_equilibrium';
            $stabilizer = 1.0;
        } elseif ($ratio <= self::INFLATION_ALERT_RATIO) {
            $bandStatus = 'mild_inflation';
            $excess = $ratio - self::HEALTHY_RATIO_MAX;
            $stabilizer = min(1.20, round(1.0 + ($excess * 0.80), 4));
        } else {
            $bandStatus = 'hyperinflation_alert';
            $excess = $ratio - self::INFLATION_ALERT_RATIO;
            $stabilizer = min(1.45, round(1.20 + ($excess * 0.25), 4));
        }

        return [
            'faucets24h' => $safeFaucets,
            'sinks24h' => $safeSinks,
            'netFlow24h' => $safeFaucets - $safeSinks,
            'faucetSinkRatio' => $ratio,
            'targetBandMin' => self::HEALTHY_RATIO_MIN,
            'targetBandMax' => self::HEALTHY_RATIO_MAX,
            'targetIdeal' => self::HEALTHY_RATIO_TARGET,
            'inHealthyBand' => $inHealthyBand,
            'bandStatus' => $bandStatus,
            'sinkPriceStabilizer' => $stabilizer,
        ];
    }

    /**
     * Resolve Era index (1..6) from player level matching AscensionEngineService::ERAS.
     */
    public static function resolveEraForLevel(int $level): int
    {
        $lvl = max(1, $level);
        return match (true) {
            $lvl <= 2 => 1,
            $lvl <= 6 => 2,
            $lvl <= 11 => 3,
            $lvl <= 14 => 4,
            $lvl <= 24 => 5,
            default => 6,
        };
    }

    /**
     * Compute dynamic Era/Level & net-worth scaled Syndicate Sink price.
     *
     * Guarantees:
     * - Level 1 players pay accessible starter costs ($450 - $600) without hurting early progression.
     * - High-Era / high-wealth Barons & Sovereigns get meaningful prestige cash drains.
     */
    public static function calculateSinkPrice(
        string $sinkKey,
        int $playerLevel,
        int $netWorthCash = 0,
        float $equilibriumStabilizer = 1.0,
    ): int {
        $spec = self::SYNDICATE_SINKS[$sinkKey] ?? null;
        if ($spec === null) {
            throw new InvalidArgumentException("Unknown syndicate sink key: {$sinkKey}");
        }

        $lvl = max(1, $playerLevel);
        $era = self::resolveEraForLevel($lvl);
        $eraMult = self::ERA_SINK_MULTIPLIERS[$era] ?? 1.0;

        // Smooth intra-era level progression (+6% per level above 1).
        $levelCurve = 1.0 + (($lvl - 1) * 0.06);

        // Progressive wealth bracket surcharge only for wealthy players (>= $250k net worth),
        // leaving Level 1-5 street players completely untouched (1.0x).
        $safeWorth = max(0, $netWorthCash);
        $wealthSurcharge = 1.0;
        if ($safeWorth >= 5_000_000) {
            $wealthSurcharge = 1.45;
        } elseif ($safeWorth >= 1_000_000) {
            $wealthSurcharge = 1.25;
        } elseif ($safeWorth >= 250_000) {
            $wealthSurcharge = 1.12;
        }

        $clampedStabilizer = max(0.80, min(1.50, $equilibriumStabilizer));
        $rawPrice = (float) $spec['baseCost'] * $eraMult * $levelCurve * $wealthSurcharge * $clampedStabilizer;

        // Round cleanly to nearest $25 for crisp MMO UI presentation.
        return max(100, (int) (round($rawPrice / 25.0) * 25));
    }

    /**
     * Build complete HUD, Equilibrium, Syndicate Sinks & 6-District Threat Radar snapshot.
     *
     * @return array<string, mixed>
     */
    public function getEconomyHudState(int|string $playerId, ?int $nowMs = null): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $effectiveNowMs = $nowMs ?? $this->nowMs();
        $cutoffIso = gmdate('c', intdiv($effectiveNowMs, 1000) - self::ROLLING_WINDOW_SECONDS);

        $playerRow = $this->database->fetchOne(
            'SELECT id, username, level, cash, bank_balance, energy, max_energy, nerve, max_nerve, life, max_life, city
             FROM players WHERE id = :p_id',
            ['p_id' => $pid],
        );

        $level = max(1, (int) ($playerRow['level'] ?? 1));
        $cash = max(0, (int) ($playerRow['cash'] ?? 0));
        $bankBalance = max(0, (int) ($playerRow['bank_balance'] ?? 0));
        $netWorth = $cash + $bankBalance;
        $era = self::resolveEraForLevel($level);

        $globalFlows = $this->queryRolling24hFlows(null, $cutoffIso);
        $playerFlows = $this->queryRolling24hFlows($pid, $cutoffIso);

        $globalEq = self::computeEquilibriumMetrics($globalFlows['faucets'], $globalFlows['sinks']);
        $playerEq = self::computeEquilibriumMetrics($playerFlows['faucets'], $playerFlows['sinks']);

        $progression = $this->loadProgressionJson($pid);
        $activeBuffs = $this->loadActiveSinkBuffs($pid, $effectiveNowMs);
        $districts = $this->buildDistrictThreatRadar($pid, $playerRow ?? [], $progression, $activeBuffs, $effectiveNowMs);
        $waypoint = $this->resolveNextObjectiveWaypoint($playerRow ?? [], $progression, $districts, $effectiveNowMs);

        $sinksCatalog = [];
        foreach (self::SYNDICATE_SINKS as $sinkKey => $spec) {
            $price = self::calculateSinkPrice($sinkKey, $level, $netWorth, $globalEq['sinkPriceStabilizer']);
            $buff = $activeBuffs[$sinkKey] ?? null;
            $sinksCatalog[$sinkKey] = [
                'id' => $sinkKey,
                'nameEn' => $spec['nameEn'],
                'nameAr' => $spec['nameAr'],
                'descEn' => $spec['descEn'],
                'descAr' => $spec['descAr'],
                'badgeEn' => $spec['badgeEn'],
                'badgeAr' => $spec['badgeAr'],
                'costCash' => $price,
                'affordable' => $cash >= $price,
                'eraIndex' => $era,
                'activeBuff' => $buff,
            ];
        }

        return [
            'ok' => true,
            'serverTimeMs' => $effectiveNowMs,
            'player' => [
                'id' => $pid,
                'level' => $level,
                'eraIndex' => $era,
                'cash' => $cash,
                'bankBalance' => $bankBalance,
                'netWorth' => $netWorth,
                'city' => (string) ($playerRow['city'] ?? 'Zone City'),
                'inJail' => ((int) ($progression['jailUntil'] ?? 0)) > $effectiveNowMs,
                'jailRemainingSec' => max(0, (int) ceil((((int) ($progression['jailUntil'] ?? 0)) - $effectiveNowMs) / 1000)),
                'inHospital' => ((int) ($progression['hospUntil'] ?? 0)) > $effectiveNowMs,
                'hospitalRemainingSec' => max(0, (int) ceil((((int) ($progression['hospUntil'] ?? 0)) - $effectiveNowMs) / 1000)),
            ],
            'equilibrium' => [
                'global' => $globalEq,
                'player' => $playerEq,
                'healthyBand' => [
                    'min' => self::HEALTHY_RATIO_MIN,
                    'max' => self::HEALTHY_RATIO_MAX,
                    'ideal' => self::HEALTHY_RATIO_TARGET,
                ],
            ],
            'syndicateSinks' => $sinksCatalog,
            'activeBuffs' => $activeBuffs,
            'weaponPrecisionBonusBps' => isset($activeBuffs['hone_weapon']) ? self::HONE_WEAPON_PRECISION_BPS : 0,
            'radar' => [
                'districts' => $districts,
                'nextObjective' => $waypoint,
            ],
        ];
    }

    /**
     * Unified action dispatcher helper matching `AscensionEngineService::act` & `TacticalAiDirectorService::act`.
     * Supports: `'economy.hud_state'`, `'economy.sink'`, `'economy.validate_envelope'`,
     * `'launder_heat'`, `'hone_weapon'`, `'bribe_wardens'`.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function act(int|string $playerId, string $action, array $payload = []): array
    {
        $normalized = strtolower(trim($action));
        if ($normalized === 'economy.hud_state' || $normalized === 'hud_state' || $normalized === 'snapshot') {
            return $this->getEconomyHudState($playerId);
        }
        if ($normalized === 'economy.validate_envelope' || $normalized === 'validate_envelope') {
            $targetAction = (string) ($payload['actionKey'] ?? 'mutation');
            $nonce = isset($payload['nonce']) && is_string($payload['nonce']) ? $payload['nonce'] : null;
            return $this->validateActionEnvelope($playerId, $targetAction, $nonce, $payload);
        }
        if ($normalized === 'economy.sink' || str_starts_with($normalized, 'sink.')) {
            $sinkKey = str_starts_with($normalized, 'sink.')
                ? substr($normalized, 5)
                : (string) ($payload['sinkKey'] ?? $payload['id'] ?? '');
            return $this->executeSyndicateSink($playerId, $sinkKey, $payload);
        }
        if (isset(self::SYNDICATE_SINKS[$normalized])) {
            return $this->executeSyndicateSink($playerId, $normalized, $payload);
        }
        throw new InvalidArgumentException("Unsupported economy security action: {$action}");
    }

    /**
     * Execute a voluntary Era/Level-priced Syndicate Sink atomically inside a player transaction.
     *
     * Supported `$sinkKey` values:
     * - `launder_heat` (accepts `$options['districtId']`, defaults to highest-heat district)
     * - `hone_weapon` (`+6%` precision edge for 2 hours)
     * - `bribe_wardens` (`-50%` active jail/hospital timers + 2h rapid-recovery retainer)
     *
     * @param array<string, mixed> $options
     * @return array<string, mixed>
     */
    public function executeSyndicateSink(int|string $playerId, string $sinkKey, array $options = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $normalizedKey = strtolower(trim($sinkKey));
        if (str_starts_with($normalizedKey, 'sink.')) {
            $normalizedKey = substr($normalizedKey, 5);
        }
        if (!isset(self::SYNDICATE_SINKS[$normalizedKey])) {
            throw new InvalidArgumentException("Unsupported syndicate sink: {$sinkKey}");
        }

        $nonce = isset($options['nonce']) && is_string($options['nonce']) ? $options['nonce'] : null;
        $envelopeCheck = $this->validateActionEnvelope($pid, 'economy.sink.' . $normalizedKey, $nonce, $options);
        if (!$envelopeCheck['valid']) {
            throw new RuntimeException("Security guard rejected action ({$envelopeCheck['reasonCode']}): {$envelopeCheck['message']}");
        }

        $nowMs = $this->nowMs();
        $cutoffIso = gmdate('c', intdiv($nowMs, 1000) - self::ROLLING_WINDOW_SECONDS);

        $settlement = $this->database->playerTransaction($pid, function () use ($pid, $normalizedKey, $options, $nowMs, $cutoffIso): array {
            $playerRow = $this->database->fetchOne(
                'SELECT id, level, cash, bank_balance FROM players WHERE id = :p_id',
                ['p_id' => $pid],
            );
            if ($playerRow === null) {
                throw new RuntimeException("Unknown player: {$pid}");
            }

            $level = max(1, (int) $playerRow['level']);
            $cash = max(0, (int) $playerRow['cash']);
            $bank = max(0, (int) $playerRow['bank_balance']);
            $globalFlows = $this->queryRolling24hFlows(null, $cutoffIso);
            $globalEq = self::computeEquilibriumMetrics($globalFlows['faucets'], $globalFlows['sinks']);

            $cost = self::calculateSinkPrice($normalizedKey, $level, $cash + $bank, $globalEq['sinkPriceStabilizer']);
            if ($cash < $cost) {
                throw new RuntimeException("Insufficient liquid cash for Syndicate Sink (need \${$cost}, have \${$cash}).");
            }

            $debited = $this->database->execute(
                'UPDATE players SET cash = cash - :sink_cost WHERE id = :p_id AND cash >= :min_cash',
                [
                    'sink_cost' => $cost,
                    'p_id' => $pid,
                    'min_cash' => $cost,
                ],
            );
            if ($debited !== 1) {
                throw new RuntimeException('Cash balance changed concurrently; please retry Syndicate Sink.');
            }

            $balanceAfter = $cash - $cost;
            $correlationId = bin2hex(random_bytes(16));
            $this->ledger->record(
                $pid,
                'cash',
                -$cost,
                $balanceAfter,
                'syndicate.sink.' . $normalizedKey,
                $correlationId,
            );

            $spec = self::SYNDICATE_SINKS[$normalizedKey];
            $expiresAtMs = $nowMs + $spec['durationMs'];
            $requestedDistrict = strtolower(trim((string) ($options['districtId'] ?? '')));
            $targetDistrict = isset(self::DISTRICTS[$requestedDistrict]) ? $requestedDistrict : 'north';

            $potencyBps = 0;
            $heatDelta = 0;
            $effectSummary = [];

            [$progression, $progVersion, $hasProgressionRow] = $this->loadProgressionRowForUpdate($pid);

            if ($normalizedKey === 'launder_heat') {
                $heatDelta = -self::LAUNDER_HEAT_DROP;
                $potencyBps = 1500; // -15% heat accrual shield
                $districtHeatMap = is_array($progression['districtHeat'] ?? null) ? $progression['districtHeat'] : [];
                $currentHeat = isset($districtHeatMap[$targetDistrict])
                    ? (int) $districtHeatMap[$targetDistrict]
                    : self::DISTRICTS[$targetDistrict]['baseHeat'];
                $newHeat = max(0, $currentHeat - self::LAUNDER_HEAT_DROP);
                $districtHeatMap[$targetDistrict] = $newHeat;
                $progression['districtHeat'] = $districtHeatMap;
                $effectSummary = [
                    'districtId' => $targetDistrict,
                    'previousHeat' => $currentHeat,
                    'newHeat' => $newHeat,
                    'heatDropped' => $currentHeat - $newHeat,
                    'shieldDurationSec' => intdiv(self::LAUNDER_SHIELD_DURATION_MS, 1000),
                ];
            } elseif ($normalizedKey === 'hone_weapon') {
                $potencyBps = self::HONE_WEAPON_PRECISION_BPS;
                $progression['syndicateWeaponHone'] = [
                    'precisionBps' => self::HONE_WEAPON_PRECISION_BPS,
                    'expiresAtMs' => $expiresAtMs,
                ];
                $effectSummary = [
                    'precisionBonusPct' => 6,
                    'precisionBonusBps' => self::HONE_WEAPON_PRECISION_BPS,
                    'durationSec' => intdiv(self::HONE_WEAPON_DURATION_MS, 1000),
                ];
            } elseif ($normalizedKey === 'bribe_wardens') {
                $potencyBps = self::BRIBE_WARDENS_RECOVERY_PCT * 100;
                $jailUntil = max(0, (int) ($progression['jailUntil'] ?? 0));
                $hospUntil = max(0, (int) ($progression['hospUntil'] ?? 0));
                $jailSavedMs = 0;
                $hospSavedMs = 0;

                if ($jailUntil > $nowMs) {
                    $rem = $jailUntil - $nowMs;
                    $cut = max(self::BRIBE_WARDENS_MIN_REDUCTION_MS, intdiv($rem * self::BRIBE_WARDENS_RECOVERY_PCT, 100));
                    $jailSavedMs = min($rem, $cut);
                    $progression['jailUntil'] = $rem <= $cut ? 0 : ($jailUntil - $cut);
                }
                if ($hospUntil > $nowMs) {
                    $rem = $hospUntil - $nowMs;
                    $cut = max(self::BRIBE_WARDENS_MIN_REDUCTION_MS, intdiv($rem * self::BRIBE_WARDENS_RECOVERY_PCT, 100));
                    $hospSavedMs = min($rem, $cut);
                    $progression['hospUntil'] = $rem <= $cut ? 0 : ($hospUntil - $cut);
                }
                $progression['syndicateWardenRetainer'] = [
                    'recoveryReductionPct' => self::BRIBE_WARDENS_RECOVERY_PCT,
                    'expiresAtMs' => $expiresAtMs,
                ];
                $effectSummary = [
                    'jailSecondsReduced' => (int) ceil($jailSavedMs / 1000),
                    'hospitalSecondsReduced' => (int) ceil($hospSavedMs / 1000),
                    'retainerDurationSec' => intdiv(self::BRIBE_WARDENS_RETAINER_MS, 1000),
                ];
            }

            $this->saveProgressionRow($pid, $progression, $progVersion, $hasProgressionRow, $nowMs);
            $this->upsertSinkBuff(
                $pid,
                $normalizedKey,
                $targetDistrict,
                $potencyBps,
                $heatDelta,
                $cost,
                $nowMs,
                $expiresAtMs,
                $effectSummary,
            );

            $this->events->publish(new DomainEvent('SyndicateSinkExecuted', [
                'playerId' => $pid,
                'sinkKey' => $normalizedKey,
                'costCash' => $cost,
                'balanceAfter' => $balanceAfter,
                'districtId' => $targetDistrict,
                'effect' => $effectSummary,
                'correlationId' => $correlationId,
            ]));

            return [
                'sinkKey' => $normalizedKey,
                'costCash' => $cost,
                'balanceAfter' => $balanceAfter,
                'expiresAtMs' => $expiresAtMs,
                'correlationId' => $correlationId,
                'effect' => $effectSummary,
            ];
        });

        return [
            'ok' => true,
            'sink' => $settlement,
            'hudState' => $this->getEconomyHudState($pid, $nowMs),
        ];
    }

    /**
     * Server-Authoritative Anti-Cheat & Replay Guard (`anti-cheat` + `client-server`).
     *
     * Validates:
     *   1. Tampered negative / NaN / Infinite / fractional / overflow quantities in `$meta`.
     *   2. Duplicate replay nonces (`security_action_nonces`).
     *   3. Impossible sub-human macro cadence (`< 110ms` sustained burst across `>= 6` mutations)
     *      while NEVER false-flagging normal human rapid double/triple clicks or >=110ms clicking!
     *
     * @param array<string, mixed> $meta
     * @return array{
     *   valid: bool,
     *   ok: bool,
     *   allowed: bool,
     *   flagged: bool,
     *   reasonCode: string,
     *   flags: list<string>,
     *   cadenceAvgMs: ?float,
     *   auditEventId: ?string,
     *   message: string
     * }
     */
    public function validateActionEnvelope(
        int|string $playerId,
        string $actionKey,
        ?string $nonce = null,
        array $meta = [],
    ): array {
        $pid = $this->normalizePlayerId($playerId);
        $cleanAction = substr(preg_replace('/[^A-Za-z0-9._:-]/', '_', trim($actionKey)) ?: 'unknown_action', 0, 80);
        $nowMs = $this->nowMs();

        // 1. Inspect quantities & numeric payload fields for client-side tampering (NaN, Inf, negative, fractional).
        $tamperError = $this->detectTamperedQuantities($meta);
        if ($tamperError !== null) {
            $auditId = $this->logSecurityAuditEvent(
                $pid,
                $cleanAction,
                'tampered_quantity',
                'critical',
                true,
                $nonce,
                null,
                ['violation' => $tamperError, 'metaKeys' => array_keys($meta)],
                $nowMs,
            );
            return [
                'valid' => false,
                'ok' => false,
                'allowed' => false,
                'flagged' => true,
                'reasonCode' => 'TAMPERED_QUANTITY',
                'flags' => ['tampered_quantity'],
                'cadenceAvgMs' => null,
                'auditEventId' => $auditId,
                'message' => $tamperError,
            ];
        }

        // 2. Replay Nonce Verification (if nonce is supplied on envelope).
        if ($nonce !== null && $nonce !== '') {
            if (strlen($nonce) > 128 || preg_match('/[\x00-\x1f\x7f]/', $nonce) === 1) {
                $auditId = $this->logSecurityAuditEvent(
                    $pid,
                    $cleanAction,
                    'invalid_nonce_format',
                    'warn',
                    true,
                    substr($nonce, 0, 64),
                    null,
                    ['reason' => 'Nonce exceeds 128 chars or contains control bytes.'],
                    $nowMs,
                );
                return [
                    'valid' => false,
                    'ok' => false,
                    'allowed' => false,
                    'flagged' => true,
                    'reasonCode' => 'INVALID_NONCE',
                    'flags' => ['invalid_nonce_format'],
                    'cadenceAvgMs' => null,
                    'auditEventId' => $auditId,
                    'message' => 'Malformed action nonce.',
                ];
            }

            // Opportunistic expiry cleanup using unique named parameter.
            $this->database->execute(
                'DELETE FROM security_action_nonces WHERE expires_at_ms < :purge_before_ms',
                ['purge_before_ms' => $nowMs],
            );

            $existingNonce = $this->database->fetchOne(
                'SELECT action_key, created_at_ms FROM security_action_nonces
                 WHERE player_id = :n_pid AND nonce = :n_val AND expires_at_ms >= :n_now_ms',
                [
                    'n_pid' => $pid,
                    'n_val' => $nonce,
                    'n_now_ms' => $nowMs,
                ],
            );

            if ($existingNonce !== null) {
                $auditId = $this->logSecurityAuditEvent(
                    $pid,
                    $cleanAction,
                    'replay_nonce',
                    'high',
                    true,
                    $nonce,
                    null,
                    [
                        'originalAction' => $existingNonce['action_key'],
                        'originalCreatedAtMs' => (int) $existingNonce['created_at_ms'],
                    ],
                    $nowMs,
                );
                return [
                    'valid' => false,
                    'ok' => false,
                    'allowed' => false,
                    'flagged' => true,
                    'reasonCode' => 'REPLAY_NONCE',
                    'flags' => ['replay_nonce'],
                    'cadenceAvgMs' => null,
                    'auditEventId' => $auditId,
                    'message' => 'Duplicate action replay nonce rejected.',
                ];
            }

            $this->database->execute(
                'INSERT INTO security_action_nonces (player_id, nonce, action_key, created_at_ms, expires_at_ms)
                 VALUES (:ins_pid, :ins_nonce, :ins_action, :ins_created_ms, :ins_expires_ms)',
                [
                    'ins_pid' => $pid,
                    'ins_nonce' => $nonce,
                    'ins_action' => $cleanAction,
                    'ins_created_ms' => $nowMs,
                    'ins_expires_ms' => $nowMs + self::NONCE_TTL_MS,
                ],
            );
        }

        // 3. Sub-Human Macro Cadence Detection (< 110ms sustained burst across >= 6 mutations).
        // Normal human double/triple clicks (2..5 rapid clicks) or human rapid clicking (>= 110ms avg) pass cleanly.
        $readOnlyAction = !empty($meta['readOnly']);
        $cadenceAvgMs = null;
        if (!$readOnlyAction) {
            $windowStartMs = $nowMs - self::MACRO_BURST_WINDOW_MS;
            $this->database->execute(
                'DELETE FROM security_mutation_cadence WHERE player_id = :c_del_pid AND occurred_at_ms < :c_del_before',
                [
                    'c_del_pid' => $pid,
                    'c_del_before' => $windowStartMs - 10_000,
                ],
            );

            $this->database->execute(
                'INSERT INTO security_mutation_cadence (id, player_id, action_key, occurred_at_ms)
                 VALUES (:c_id, :c_pid, :c_action, :c_ms)',
                [
                    'c_id' => bin2hex(random_bytes(16)),
                    'c_pid' => $pid,
                    'c_action' => $cleanAction,
                    'c_ms' => $nowMs,
                ],
            );

            $limit = self::MACRO_BURST_MIN_MUTATIONS;
            $recentRows = $this->database->fetchAll(
                "SELECT occurred_at_ms FROM security_mutation_cadence
                 WHERE player_id = :q_pid AND occurred_at_ms >= :q_since_ms
                 ORDER BY occurred_at_ms DESC LIMIT {$limit}",
                [
                    'q_pid' => $pid,
                    'q_since_ms' => $windowStartMs,
                ],
            );

            if (count($recentRows) >= self::MACRO_BURST_MIN_MUTATIONS) {
                $timestamps = array_reverse(array_map(
                    static fn (array $r): int => (int) $r['occurred_at_ms'],
                    $recentRows,
                ));
                $intervals = [];
                $subHumanIntervals = 0;
                $maxInterval = 0;
                for ($i = 1, $n = count($timestamps); $i < $n; $i++) {
                    $delta = max(0, $timestamps[$i] - $timestamps[$i - 1]);
                    $intervals[] = $delta;
                    if ($delta < self::MACRO_BURST_INTERVAL_MS) {
                        $subHumanIntervals++;
                    }
                    if ($delta > $maxInterval) {
                        $maxInterval = $delta;
                    }
                }

                $intervalCount = count($intervals); // 5 intervals for 6 mutations
                $cadenceAvgMs = round(array_sum($intervals) / max(1, $intervalCount), 2);

                // Trigger ONLY when sustained across all >= 6 mutations:
                // average interval < 110ms, at least (N-1) intervals < 110ms, and no natural human pause (> 135ms).
                if (
                    $cadenceAvgMs < (float) self::MACRO_BURST_INTERVAL_MS
                    && $subHumanIntervals >= ($intervalCount - 1)
                    && $maxInterval <= 135
                ) {
                    $auditId = $this->logSecurityAuditEvent(
                        $pid,
                        $cleanAction,
                        'macro_cadence_burst',
                        'high',
                        true,
                        $nonce,
                        (int) round($cadenceAvgMs),
                        [
                            'mutationCount' => count($timestamps),
                            'intervalsMs' => $intervals,
                            'avgIntervalMs' => $cadenceAvgMs,
                            'thresholdMs' => self::MACRO_BURST_INTERVAL_MS,
                        ],
                        $nowMs,
                    );

                    return [
                        'valid' => false,
                        'ok' => false,
                        'allowed' => false,
                        'flagged' => true,
                        'reasonCode' => 'MACRO_CADENCE_BURST',
                        'flags' => ['macro_cadence_burst'],
                        'cadenceAvgMs' => $cadenceAvgMs,
                        'auditEventId' => $auditId,
                        'message' => 'Sub-human automated macro burst detected (<110ms sustained cadence).',
                    ];
                }
            }
        }

        return [
            'valid' => true,
            'ok' => true,
            'allowed' => true,
            'flagged' => false,
            'reasonCode' => 'OK',
            'flags' => [],
            'cadenceAvgMs' => $cadenceAvgMs,
            'auditEventId' => null,
            'message' => 'Action envelope verified.',
        ];
    }

    /**
     * Fetch recent security audit events for admin telemetry & automated verification.
     *
     * @return list<array<string, mixed>>
     */
    public function recentSecurityAuditEvents(int|string|null $playerId = null, int $limit = 25): array
    {
        $safeLimit = max(1, min(200, $limit));
        if ($playerId !== null && $playerId !== '') {
            $pid = $this->normalizePlayerId($playerId);
            $rows = $this->database->fetchAll(
                "SELECT id, player_id, action_key, flag_type, severity, blocked, nonce, cadence_ms, details_json, created_at_ms, created_at
                 FROM security_audit_events
                 WHERE player_id = :a_pid
                 ORDER BY created_at_ms DESC LIMIT {$safeLimit}",
                ['a_pid' => $pid],
            );
        } else {
            $rows = $this->database->fetchAll(
                "SELECT id, player_id, action_key, flag_type, severity, blocked, nonce, cadence_ms, details_json, created_at_ms, created_at
                 FROM security_audit_events
                 ORDER BY created_at_ms DESC LIMIT {$safeLimit}",
            );
        }

        return array_map(static function (array $row): array {
            $details = json_decode((string) ($row['details_json'] ?? '{}'), true);
            return [
                'id' => (string) $row['id'],
                'playerId' => (string) $row['player_id'],
                'actionKey' => (string) $row['action_key'],
                'flagType' => (string) $row['flag_type'],
                'severity' => (string) $row['severity'],
                'blocked' => ((int) $row['blocked']) === 1,
                'nonce' => $row['nonce'] !== null ? (string) $row['nonce'] : null,
                'cadenceMs' => $row['cadence_ms'] !== null ? (int) $row['cadence_ms'] : null,
                'details' => is_array($details) ? $details : [],
                'createdAtMs' => (int) $row['created_at_ms'],
                'createdAt' => (string) $row['created_at'],
            ];
        }, $rows);
    }

    /**
     * Query rolling 24h cash faucets & sinks from `economy_ledger` using standard CASE WHEN SQL
     * (PostgreSQL 16 + SQLite identical behavior). Excludes non-faucet self-transfers.
     *
     * @return array{faucets: int, sinks: int}
     */
    private function queryRolling24hFlows(?string $playerId, string $cutoffIso): array
    {
        $excluded = self::NON_FAUCET_TRANSFER_REASONS;
        $params = ['cutoff_iso' => $cutoffIso];
        $reasonPlaceholders = [];
        foreach ($excluded as $idx => $reason) {
            $key = 'ex_r_' . $idx;
            $reasonPlaceholders[] = ':' . $key;
            $params[$key] = $reason;
        }
        $notInClause = implode(', ', $reasonPlaceholders);

        $playerClause = '';
        if ($playerId !== null) {
            $playerClause = ' AND player_id = :flow_pid';
            $params['flow_pid'] = $playerId;
        }

        $sql = "SELECT
                    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_faucets,
                    COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS total_sinks
                FROM economy_ledger
                WHERE asset = 'cash'
                  AND created_at >= :cutoff_iso
                  AND reason NOT IN ({$notInClause}){$playerClause}";

        try {
            $row = $this->database->fetchOne($sql, $params);
        } catch (\Throwable) {
            return ['faucets' => 0, 'sinks' => 0];
        }

        return [
            'faucets' => max(0, (int) ($row['total_faucets'] ?? 0)),
            'sinks' => max(0, (int) ($row['total_sinks'] ?? 0)),
        ];
    }

    /**
     * @param array<string, mixed> $meta
     */
    private function detectTamperedQuantities(array $meta): ?string
    {
        $strictPositiveFields = ['quantity', 'qty', 'amount', 'bet', 'wager', 'sessions'];
        $nonNegativeFields = ['unitPrice', 'expectedPrice', 'price', 'cost'];

        foreach ($strictPositiveFields as $field) {
            if (!array_key_exists($field, $meta)) {
                continue;
            }
            $err = $this->validateWholeNumberValue($meta[$field], $field, 1, 1_000_000_000);
            if ($err !== null) {
                return $err;
            }
        }

        foreach ($nonNegativeFields as $field) {
            if (!array_key_exists($field, $meta)) {
                continue;
            }
            $err = $this->validateWholeNumberValue($meta[$field], $field, 0, 2_000_000_000);
            if ($err !== null) {
                return $err;
            }
        }

        if (isset($meta['quantities']) && is_array($meta['quantities'])) {
            foreach ($meta['quantities'] as $k => $val) {
                $err = $this->validateWholeNumberValue($val, 'quantities.' . (string) $k, 1, 1_000_000_000);
                if ($err !== null) {
                    return $err;
                }
            }
        }

        return null;
    }

    private function validateWholeNumberValue(mixed $value, string $field, int $min, int $max): ?string
    {
        if (is_float($value)) {
            if (is_nan($value) || is_infinite($value)) {
                return "Tampered non-finite float (NaN/Inf) in '{$field}'.";
            }
            if (floor($value) !== $value) {
                return "Tampered fractional float in integer field '{$field}'.";
            }
            $value = (int) $value;
        } elseif (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '' || preg_match('/^(?:nan|inf|-inf|infinity|-infinity)$/i', $trimmed) === 1) {
                return "Tampered NaN/Infinity string in '{$field}'.";
            }
            if (!preg_match('/^-?\d+$/D', $trimmed)) {
                return "Tampered non-integer value in '{$field}'.";
            }
            $value = (int) $trimmed;
        } elseif (!is_int($value)) {
            return "Invalid type for numeric field '{$field}'.";
        }

        if ($value < $min) {
            return "Tampered negative or sub-minimum value ({$value}) in '{$field}'.";
        }
        if ($value > $max) {
            return "Tampered overflow value ({$value}) in '{$field}'.";
        }

        return null;
    }

    /**
     * @param array<string, mixed> $details
     */
    private function logSecurityAuditEvent(
        string $playerId,
        string $actionKey,
        string $flagType,
        string $severity,
        bool $blocked,
        ?string $nonce,
        ?int $cadenceMs,
        array $details,
        int $nowMs,
    ): string {
        $id = bin2hex(random_bytes(16));
        $this->database->execute(
            'INSERT INTO security_audit_events
                (id, player_id, action_key, flag_type, severity, blocked, nonce, cadence_ms, details_json, created_at_ms, created_at)
             VALUES
                (:e_id, :e_pid, :e_action, :e_flag, :e_sev, :e_blocked, :e_nonce, :e_cadence, :e_details, :e_ms, :e_iso)',
            [
                'e_id' => $id,
                'e_pid' => $playerId,
                'e_action' => $actionKey,
                'e_flag' => $flagType,
                'e_sev' => $severity,
                'e_blocked' => $blocked ? 1 : 0,
                'e_nonce' => $nonce !== null ? substr($nonce, 0, 128) : null,
                'e_cadence' => $cadenceMs,
                'e_details' => json_encode($details, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
                'e_ms' => $nowMs,
                'e_iso' => gmdate('c', intdiv($nowMs, 1000)),
            ],
        );

        return $id;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function loadActiveSinkBuffs(string $playerId, int $nowMs): array
    {
        $rows = $this->database->fetchAll(
            'SELECT sink_key, district_id, potency_bps, heat_delta, cost_cash, activated_at_ms, expires_at_ms, metadata_json
             FROM syndicate_sink_buffs
             WHERE player_id = :b_pid AND expires_at_ms > :b_now_ms',
            [
                'b_pid' => $playerId,
                'b_now_ms' => $nowMs,
            ],
        );

        $buffs = [];
        foreach ($rows as $row) {
            $sinkKey = (string) $row['sink_key'];
            $expiresAtMs = (int) $row['expires_at_ms'];
            $meta = json_decode((string) ($row['metadata_json'] ?? '{}'), true);
            $buffs[$sinkKey] = [
                'sinkKey' => $sinkKey,
                'districtId' => (string) $row['district_id'],
                'potencyBps' => (int) $row['potency_bps'],
                'heatDelta' => (int) $row['heat_delta'],
                'costCash' => (int) $row['cost_cash'],
                'activatedAtMs' => (int) $row['activated_at_ms'],
                'expiresAtMs' => $expiresAtMs,
                'remainingSec' => max(0, (int) ceil(($expiresAtMs - $nowMs) / 1000)),
                'effect' => is_array($meta) ? $meta : [],
            ];
        }

        return $buffs;
    }

    /**
     * @param array<string, mixed> $metadata
     */
    private function upsertSinkBuff(
        string $playerId,
        string $sinkKey,
        string $districtId,
        int $potencyBps,
        int $heatDelta,
        int $costCash,
        int $activatedAtMs,
        int $expiresAtMs,
        array $metadata,
    ): void {
        $this->database->execute(
            'DELETE FROM syndicate_sink_buffs WHERE player_id = :d_pid AND sink_key = :d_sink',
            [
                'd_pid' => $playerId,
                'd_sink' => $sinkKey,
            ],
        );

        $this->database->execute(
            'INSERT INTO syndicate_sink_buffs
                (player_id, sink_key, district_id, potency_bps, heat_delta, cost_cash, activated_at_ms, expires_at_ms, metadata_json)
             VALUES
                (:i_pid, :i_sink, :i_dist, :i_potency, :i_heat, :i_cost, :i_act_ms, :i_exp_ms, :i_meta)',
            [
                'i_pid' => $playerId,
                'i_sink' => $sinkKey,
                'i_dist' => $districtId,
                'i_potency' => $potencyBps,
                'i_heat' => $heatDelta,
                'i_cost' => $costCash,
                'i_act_ms' => $activatedAtMs,
                'i_exp_ms' => $expiresAtMs,
                'i_meta' => json_encode($metadata, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
            ],
        );
    }

    /**
     * @param array<string, mixed> $playerRow
     * @param array<string, mixed> $progression
     * @param array<string, array<string, mixed>> $activeBuffs
     * @return list<array<string, mixed>>
     */
    private function buildDistrictThreatRadar(
        string $playerId,
        array $playerRow,
        array $progression,
        array $activeBuffs,
        int $nowMs,
    ): array {
        $contestedByDistrict = [];
        try {
            $rows = $this->database->fetchAll(
                "SELECT b.district_id,
                        COUNT(*) AS total_blocks,
                        SUM(CASE WHEN c.state = 'contested' THEN 1 ELSE 0 END) AS contested_blocks
                 FROM territory_blocks b
                 JOIN territory_control c ON c.territory_id = b.id
                 WHERE b.enabled = 1
                 GROUP BY b.district_id"
            );
            foreach ($rows as $r) {
                $contestedByDistrict[(string) $r['district_id']] = [
                    'totalBlocks' => (int) ($r['total_blocks'] ?? 20),
                    'contestedBlocks' => (int) ($r['contested_blocks'] ?? 0),
                ];
            }
        } catch (\Throwable) {
            // Pre-seed fallback: use deterministic district defaults.
        }

        $savedHeat = is_array($progression['districtHeat'] ?? null) ? $progression['districtHeat'] : [];
        $crimesCount = max(0, (int) ($progression['ctr']['crimes'] ?? 0));
        $winsCount = max(0, (int) ($progression['ctr']['wins'] ?? 0));
        $launderBuff = $activeBuffs['launder_heat'] ?? null;

        $out = [];
        foreach (self::DISTRICTS as $distId => $spec) {
            $warStats = $contestedByDistrict[$distId] ?? ['totalBlocks' => 20, 'contestedBlocks' => 0];
            $dynamicBump = ($distId === 'north' ? min(28, $crimesCount * 2) : 0)
                + ($distId === 'red' ? min(24, $winsCount * 3) : 0)
                + ($warStats['contestedBlocks'] * 6);

            $rawHeat = array_key_exists($distId, $savedHeat)
                ? (int) $savedHeat[$distId]
                : min(96, $spec['baseHeat'] + $dynamicBump);

            if ($launderBuff !== null && ($launderBuff['districtId'] ?? '') === $distId) {
                $rawHeat = min($rawHeat, max(0, $spec['baseHeat'] - 15));
            }
            $heat = max(0, min(100, $rawHeat));

            $threatTier = match (true) {
                $heat >= 70 => 'critical',
                $heat >= 45 => 'elevated',
                $heat >= 25 => 'guarded',
                default => 'calm',
            };

            $out[] = [
                'id' => $distId,
                'code' => $spec['code'],
                'compass' => $spec['compass'],
                'angleDeg' => $spec['angleDeg'],
                'radiusPct' => $spec['radiusPct'],
                'nameEn' => $spec['nameEn'],
                'nameAr' => $spec['nameAr'],
                'route' => $spec['route'],
                'heat' => $heat,
                'threatTier' => $threatTier,
                'contestedBlocks' => $warStats['contestedBlocks'],
                'totalBlocks' => $warStats['totalBlocks'],
                'shielded' => $launderBuff !== null && ($launderBuff['districtId'] ?? '') === $distId,
            ];
        }

        return $out;
    }

    /**
     * @param array<string, mixed> $playerRow
     * @param array<string, mixed> $progression
     * @param list<array<string, mixed>> $districts
     * @return array<string, mixed>
     */
    private function resolveNextObjectiveWaypoint(
        array $playerRow,
        array $progression,
        array $districts,
        int $nowMs,
    ): array {
        $inJail = ((int) ($progression['jailUntil'] ?? 0)) > $nowMs;
        $inHospital = ((int) ($progression['hospUntil'] ?? 0)) > $nowMs;
        $energy = (int) ($playerRow['energy'] ?? 100);
        $maxEnergy = max(1, (int) ($playerRow['max_energy'] ?? 100));
        $nerve = (int) ($playerRow['nerve'] ?? 45);
        $cash = (int) ($playerRow['cash'] ?? 0);
        $level = max(1, (int) ($playerRow['level'] ?? 1));

        if ($inJail || $inHospital) {
            return [
                'districtId' => 'center',
                'route' => $inJail ? 'jail' : 'hospital',
                'recommendedSink' => 'bribe_wardens',
                'labelEn' => $inJail ? 'Bribe Wardens or Post Bail to Exit Jail' : 'Bribe Wardens or Triage to Exit Hospital',
                'labelAr' => $inJail ? 'رشوة الحراس أو دفع الكفالة للخروج من السجن' : 'رشوة الحراس أو الإسعاف للخروج من المستشفى',
            ];
        }

        $hottest = $districts[0] ?? ['id' => 'north', 'heat' => 0];
        foreach ($districts as $d) {
            if ($d['heat'] > $hottest['heat']) {
                $hottest = $d;
            }
        }
        if ($hottest['heat'] >= 70) {
            return [
                'districtId' => $hottest['id'],
                'route' => $hottest['route'],
                'recommendedSink' => 'launder_heat',
                'labelEn' => "Cool Police Heat in {$hottest['nameEn']} ({$hottest['heat']}%)",
                'labelAr' => "تبييض حرارة الشرطة في {$hottest['nameAr']} ({$hottest['heat']}%)",
            ];
        }

        if ($cash >= 25_000 && $level >= 10) {
            return [
                'districtId' => 'fin',
                'route' => 'bank',
                'recommendedSink' => null,
                'labelEn' => 'Lock Unprotected Street Cash in Financial Citadel Vault',
                'labelAr' => 'تأمين النقد المكشوف في خزنة القلعة المالية',
            ];
        }

        if ($energy >= intdiv($maxEnergy * 7, 10)) {
            return [
                'districtId' => 'center',
                'route' => 'gym',
                'recommendedSink' => null,
                'labelEn' => 'Burn Charged Energy in Syndicate Gym',
                'labelAr' => 'استثمار الطاقة المشحونة في النادي الرياضي',
            ];
        }

        if ($nerve >= 5) {
            return [
                'districtId' => 'north',
                'route' => 'crimes',
                'recommendedSink' => null,
                'labelEn' => 'Run Pier 4 Contraband Operation in North Harbor',
                'labelAr' => 'تنفيذ عملية تهريب في المرفأ الشمالي والرصيف ٤',
            ];
        }

        return [
            'districtId' => 'red',
            'route' => 'attack',
            'recommendedSink' => 'hone_weapon',
            'labelEn' => 'Hone Weapon (+6%) & Scout Rivals in Crimson Arena',
            'labelAr' => 'صقل السلاح (+6%) واستطلاع الخصوم في الساحة القرمزية',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadProgressionJson(string $playerId): array
    {
        try {
            $row = $this->database->fetchOne(
                'SELECT state_json FROM player_progression WHERE player_id = :p_id',
                ['p_id' => $playerId],
            );
            if ($row !== null && isset($row['state_json'])) {
                $decoded = json_decode((string) $row['state_json'], true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        } catch (\Throwable) {
            // Table or row not initialized yet.
        }
        return [];
    }

    /**
     * @return array{0: array<string, mixed>, 1: int, 2: bool}
     */
    private function loadProgressionRowForUpdate(string $playerId): array
    {
        $row = $this->database->fetchOne(
            'SELECT state_json, version FROM player_progression WHERE player_id = :p_id',
            ['p_id' => $playerId],
        );
        if ($row === null) {
            return [[], 1, false];
        }
        $decoded = json_decode((string) ($row['state_json'] ?? '{}'), true);
        return [is_array($decoded) ? $decoded : [], max(1, (int) ($row['version'] ?? 1)), true];
    }

    /**
     * @param array<string, mixed> $state
     */
    private function saveProgressionRow(
        string $playerId,
        array $state,
        int $currentVersion,
        bool $exists,
        int $nowMs,
    ): void {
        $nextVersion = $exists ? ($currentVersion + 1) : 1;
        $state['version'] = $nextVersion;
        $json = json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $updatedIso = gmdate('c', intdiv($nowMs, 1000));

        if ($exists) {
            $this->database->execute(
                'UPDATE player_progression
                 SET state_json = :s_json, version = :s_ver, updated_at = :s_updated
                 WHERE player_id = :s_pid',
                [
                    's_json' => $json,
                    's_ver' => $nextVersion,
                    's_updated' => $updatedIso,
                    's_pid' => $playerId,
                ],
            );
            return;
        }

        $this->database->execute(
            'INSERT INTO player_progression (player_id, state_json, version, updated_at)
             VALUES (:i_pid, :i_json, :i_ver, :i_updated)',
            [
                'i_pid' => $playerId,
                'i_json' => $json,
                'i_ver' => $nextVersion,
                'i_updated' => $updatedIso,
            ],
        );
    }

    private function normalizePlayerId(int|string $playerId): string
    {
        $raw = is_int($playerId) ? (string) $playerId : trim($playerId);
        if ($raw === '' || strlen($raw) > 100) {
            throw new InvalidArgumentException('Player identifier must be 1..100 characters.');
        }
        return $raw;
    }

    private function nowMs(): int
    {
        if ($this->clockMs !== null) {
            return (int) ($this->clockMs)();
        }
        return (int) round(microtime(true) * 1000);
    }
}

if (!class_exists('Zone\\Core\\Game\\EconomyAntiCheatService', false)) {
    class_alias(EconomyAntiCheatService::class, 'Zone\\Core\\Game\\EconomyAntiCheatService');
}
