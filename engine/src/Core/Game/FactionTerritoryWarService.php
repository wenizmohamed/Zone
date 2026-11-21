<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Closure;
use InvalidArgumentException;
use RuntimeException;
use Throwable;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * ZONE v157 — Track 9: 6-District Faction Territory Control, Synced Chain State & Raid Matchmaking
 * =================================================================================================
 * Canonical Namespace: `Zone\Engine\Core\Game\FactionTerritoryWarService`
 * Alias Registered:    `Zone\Core\Game\FactionTerritoryWarService`
 *
 * @integrator Route Wiring Guide (`engine/router.php` + `GameEngine.php`):
 * -----------------------------------------------------------------------------------------
 * Constructor:
 *   `$warNet = new FactionTerritoryWarService($this->database, $this->events);`
 *
 * Unified Router Dispatch:
 *   1. `GET /api/v1/faction-war?sinceSeq=0&district=center`:
 *      `$warNet->snapshot($playerId, isset($_GET['sinceSeq']) ? (int) $_GET['sinceSeq'] : null, (string) ($_GET['district'] ?? 'center'))`
 *   2. `POST /api/v1/faction-war/action` with `{"action": "...", ...}`:
 *      `$warNet->act($playerId, (string) ($body['action'] ?? ''), $body)`
 *
 * Direct Public Domain API Methods:
 *   - `ensureSchema(): void`
 *   - `snapshot(int|string $playerId, ?int $sinceSeq = null, string $district = 'center'): array`
 *   - `act(int|string $playerId, string $action, array $payload = []): array`
 *   - `findOrCreateMatch(int|string $playerId, array $payload = []): array`
 *   - `createRaidLobby(int|string $playerId, array $payload = []): array`
 *   - `joinRaidLobby(int|string $playerId, array $payload = []): array`
 *   - `assaultSector(int|string $playerId, array $payload = []): array`
 *   - `fortifySector(int|string $playerId, array $payload = []): array`
 *   - `resolveMatch(int|string $playerId, array $payload = []): array`
 *   - `static computeEloDelta(int $ratingA, int $ratingB, float $actualScoreA, int $kFactor = 32): array`
 *   - `static evaluateLagCompensatedChainWindow(float $serverNow, int $chainExpiresAt, ?float $clientTs = null, float $maxRewindSec = 0.35): array`
 *   - `static normalizeDistrictId(string $district): string`
 *
 * Database Dual-Compatibility (PostgreSQL 16 + SQLite 3):
 *   - Idempotent `CREATE TABLE IF NOT EXISTS` DDL for `faction_war_*` tables.
 *   - Zero 2-argument SQLite scalar `MAX(a,b)` / `MIN(a,b)` calls (`CASE WHEN` / PHP clamping).
 *   - Strictly unique named PDO `:params` per SQL statement.
 */
final class FactionTerritoryWarService
{
    public const ELO_DEFAULT = 1200;
    public const ELO_K_FACTOR = 32;
    public const MATCH_BAND_WIDTH = 220;
    public const MATCH_EXPAND_PER_MIN = 80;

    public const ASSAULT_ENERGY_COST = 15;
    public const ASSAULT_COOLDOWN_SEC = 8;
    public const FORTIFY_ENERGY_COST = 10;
    public const FORTIFY_COOLDOWN_SEC = 8;

    public const CHAIN_WINDOW_SEC = 300;
    public const LAG_COMPENSATION_MAX_SEC = 0.35;
    public const LOBBY_TTL_SEC = 1800;

    /** @var list<string> */
    public const RAID_SLOTS = ['vanguard', 'breacher', 'support'];

    /** @var array<string, array{id: string, nameEn: string, nameAr: string, color: string, baseElo: int}> */
    public const DEFAULT_FACTIONS = [
        'vipers' => [
            'id' => 'vipers',
            'nameEn' => 'Sand Vipers',
            'nameAr' => 'أفاعي الرمل',
            'color' => '#78d628',
            'baseElo' => 1240,
        ],
        'kings' => [
            'id' => 'kings',
            'nameEn' => 'Harbor Kings',
            'nameAr' => 'ملوك المرفأ',
            'color' => '#3d7cc9',
            'baseElo' => 1215,
        ],
        'night' => [
            'id' => 'night',
            'nameEn' => 'Night Market',
            'nameAr' => 'السوق الليلي',
            'color' => '#b8529e',
            'baseElo' => 1185,
        ],
        'oldguard' => [
            'id' => 'oldguard',
            'nameEn' => 'Old Guard',
            'nameAr' => 'الحرس القديم',
            'color' => '#d99332',
            'baseElo' => 1260,
        ],
    ];

    /**
     * Zone City's 6 Canonical Territory Districts (`wargame-map` topology).
     *
     * @var array<string, array{
     *   id: string,
     *   nameEn: string,
     *   nameAr: string,
     *   defaultOwner: string,
     *   hexQ: int,
     *   hexR: int,
     *   mapX: int,
     *   mapY: int,
     *   neighbors: list<string>,
     *   perkEn: string,
     *   perkAr: string,
     *   baseCash: int,
     *   baseXp: int
     * }>
     */
    public const DISTRICTS = [
        'north' => [
            'id' => 'north',
            'nameEn' => 'Northern Heights',
            'nameAr' => 'المرتفعات الشمالية',
            'defaultOwner' => 'oldguard',
            'hexQ' => 0,
            'hexR' => -1,
            'mapX' => 180,
            'mapY' => 54,
            'neighbors' => ['west', 'center', 'fin'],
            'perkEn' => '+8% Gym & Armor Supply',
            'perkAr' => '+8% تدريب النادي وإمداد الدروع',
            'baseCash' => 520,
            'baseXp' => 16,
        ],
        'west' => [
            'id' => 'west',
            'nameEn' => 'West Pier & Docks',
            'nameAr' => 'الرصيف الغربي والميناء',
            'defaultOwner' => 'kings',
            'hexQ' => -1,
            'hexR' => 0,
            'mapX' => 84,
            'mapY' => 114,
            'neighbors' => ['north', 'center', 'red'],
            'perkEn' => '+10% Contraband Corridor',
            'perkAr' => '+10% ممر التهريب البحري',
            'baseCash' => 560,
            'baseXp' => 17,
        ],
        'center' => [
            'id' => 'center',
            'nameEn' => 'Downtown Core',
            'nameAr' => 'قلب وسط المدينة',
            'defaultOwner' => 'vipers',
            'hexQ' => 0,
            'hexR' => 0,
            'mapX' => 180,
            'mapY' => 124,
            'neighbors' => ['north', 'west', 'fin', 'red', 'res'],
            'perkEn' => '+12% Syndicate Respect Flow',
            'perkAr' => '+12% تدفق احترام النقابة',
            'baseCash' => 680,
            'baseXp' => 21,
        ],
        'fin' => [
            'id' => 'fin',
            'nameEn' => 'Financial Spire',
            'nameAr' => 'الحي المالي',
            'defaultOwner' => 'oldguard',
            'hexQ' => 1,
            'hexR' => 0,
            'mapX' => 276,
            'mapY' => 114,
            'neighbors' => ['north', 'center', 'res'],
            'perkEn' => '+9% Vault & Market Cut',
            'perkAr' => '+9% عوائد الخزائن والسوق',
            'baseCash' => 640,
            'baseXp' => 19,
        ],
        'red' => [
            'id' => 'red',
            'nameEn' => 'Neon Red District',
            'nameAr' => 'حي النيون الأحمر',
            'defaultOwner' => 'night',
            'hexQ' => -1,
            'hexR' => 1,
            'mapX' => 116,
            'mapY' => 192,
            'neighbors' => ['west', 'center', 'res'],
            'perkEn' => '+10% Underworld Heist Cut',
            'perkAr' => '+10% حصة عمليات السوق الخفي',
            'baseCash' => 590,
            'baseXp' => 18,
        ],
        'res' => [
            'id' => 'res',
            'nameEn' => 'Residential Quarters',
            'nameAr' => 'الأحياء السكنية',
            'defaultOwner' => 'vipers',
            'hexQ' => 1,
            'hexR' => 1,
            'mapX' => 244,
            'mapY' => 192,
            'neighbors' => ['center', 'fin', 'red'],
            'perkEn' => '+10% Safehouse Recovery',
            'perkAr' => '+10% تعافي الملاجئ الآمنة',
            'baseCash' => 490,
            'baseXp' => 15,
        ],
    ];

    /** @var array<string, string> */
    private const DISTRICT_ALIASES = [
        'pier_4' => 'west',
        'old_harbor' => 'west',
        'cargo_bay' => 'fin',
        'downtown' => 'center',
        'neon_alley' => 'red',
        'foundry' => 'north',
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
     * Idempotently ensures PostgreSQL 16 & SQLite 3 schema tables for 6-District Territory Wars.
     */
    public function ensureSchema(): void
    {
        $dbKey = spl_object_id($this->database);
        if (!empty(self::$schemaEnsured[$dbKey])) {
            return;
        }

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS faction_war_sync_state (
                scope VARCHAR(48) PRIMARY KEY,
                current_seq BIGINT NOT NULL DEFAULT 1,
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS faction_war_districts (
                district_id VARCHAR(48) PRIMARY KEY,
                owner_faction_id VARCHAR(80) NOT NULL,
                control_json TEXT NOT NULL,
                fortify_shield INTEGER NOT NULL DEFAULT 0,
                heat_level INTEGER NOT NULL DEFAULT 20,
                contested INTEGER NOT NULL DEFAULT 0,
                chain_count INTEGER NOT NULL DEFAULT 0,
                chain_expires_at BIGINT NOT NULL DEFAULT 0,
                seq INTEGER NOT NULL DEFAULT 1,
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS faction_elo_ratings (
                faction_id VARCHAR(80) PRIMARY KEY,
                elo_rating INTEGER NOT NULL DEFAULT 1200,
                mmr_band VARCHAR(32) NOT NULL DEFAULT 'Contender',
                wins INTEGER NOT NULL DEFAULT 0,
                losses INTEGER NOT NULL DEFAULT 0,
                matches_played INTEGER NOT NULL DEFAULT 0,
                win_streak INTEGER NOT NULL DEFAULT 0,
                seq INTEGER NOT NULL DEFAULT 1,
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS faction_raid_lobbies (
                lobby_id VARCHAR(64) PRIMARY KEY,
                faction_id VARCHAR(80) NOT NULL,
                opponent_faction_id VARCHAR(80) NOT NULL,
                district_id VARCHAR(48) NOT NULL,
                leader_player_id VARCHAR(64) NOT NULL,
                status VARCHAR(24) NOT NULL DEFAULT 'WAITING',
                match_elo_gap INTEGER NOT NULL DEFAULT 0,
                slots_json TEXT NOT NULL,
                seq INTEGER NOT NULL DEFAULT 1,
                expires_at BIGINT NOT NULL,
                created_at VARCHAR(40) NOT NULL,
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        $this->database->execute(
            'CREATE INDEX IF NOT EXISTS idx_faction_raid_lobbies_status ON faction_raid_lobbies (status, seq)'
        );

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS faction_war_player_state (
                player_id VARCHAR(64) PRIMARY KEY,
                faction_id VARCHAR(80),
                assault_cd_until BIGINT NOT NULL DEFAULT 0,
                fortify_cd_until BIGINT NOT NULL DEFAULT 0,
                raids_executed INTEGER NOT NULL DEFAULT 0,
                fortifies_executed INTEGER NOT NULL DEFAULT 0,
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        self::$schemaEnsured[$dbKey] = true;
    }

    public static function normalizeDistrictId(string $district): string
    {
        $clean = strtolower(trim($district));
        if (isset(self::DISTRICT_ALIASES[$clean])) {
            $clean = self::DISTRICT_ALIASES[$clean];
        }
        return isset(self::DISTRICTS[$clean]) ? $clean : 'center';
    }

    public static function resolveMmrBand(int $elo): string
    {
        if ($elo >= 1450) {
            return 'Apex';
        }
        if ($elo >= 1300) {
            return 'Vanguard';
        }
        if ($elo >= 1150) {
            return 'Contender';
        }
        return 'Initiate';
    }

    /**
     * Standard ELO rating delta calculator (`K=32` default).
     *
     * @return array{deltaA: int, deltaB: int, expectedA: float, nextRatingA: int, nextRatingB: int}
     */
    public static function computeEloDelta(
        int $ratingA,
        int $ratingB,
        float $actualScoreA,
        int $kFactor = self::ELO_K_FACTOR,
    ): array {
        $clampedScore = max(0.0, min(1.0, $actualScoreA));
        $k = max(8, min(64, $kFactor));
        $expectedA = 1.0 / (1.0 + (10.0 ** (($ratingB - $ratingA) / 400.0)));
        $deltaA = (int) round($k * ($clampedScore - $expectedA));
        $deltaB = -$deltaA;

        return [
            'deltaA' => $deltaA,
            'deltaB' => $deltaB,
            'expectedA' => round($expectedA, 4),
            'nextRatingA' => max(100, $ratingA + $deltaA),
            'nextRatingB' => max(100, $ratingB + $deltaB),
        ];
    }

    /**
     * Lag-compensated server validation for the 5-minute faction chain window (`lag-compensation`).
     * Rewinds at most `±0.35s` RTT to match what the client saw without trusting future or stale timestamps.
     *
     * @return array{active: bool, remainingSec: int, compensated: bool, rewindAppliedSec: float, effectiveTimestamp: float}
     */
    public static function evaluateLagCompensatedChainWindow(
        float $serverNow,
        int $chainExpiresAt,
        ?float $clientTs = null,
        float $maxRewindSec = self::LAG_COMPENSATION_MAX_SEC,
    ): array {
        $evalTs = $serverNow;
        $compensated = false;
        $rewindSec = 0.0;

        if ($clientTs !== null && $clientTs > 1_000_000_000.0) {
            $diff = $serverNow - $clientTs;
            if ($diff >= 0.0 && $diff <= $maxRewindSec) {
                $evalTs = $clientTs;
                $compensated = $diff > 0.001;
                $rewindSec = round($diff, 4);
            }
        }

        $active = $chainExpiresAt > 0 && $evalTs <= (float) $chainExpiresAt;
        $remaining = $active ? max(0, (int) ceil((float) $chainExpiresAt - $evalTs)) : 0;

        return [
            'active' => $active,
            'remainingSec' => $remaining,
            'compensated' => $compensated,
            'rewindAppliedSec' => $rewindSec,
            'effectiveTimestamp' => round($evalTs, 3),
        ];
    }

    /**
     * Unified state snapshot with optional `sinceSeq` delta compression (`state-sync`).
     *
     * @return array<string, mixed>
     */
    public function snapshot(int|string $playerId, ?int $sinceSeq = null, string $district = 'center'): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $cleanDistrict = self::normalizeDistrictId($district);
        $this->bootstrapWorldState();

        $player = $this->loadPlayer($pid);
        $playerFactionId = $this->resolvePlayerFactionId($pid);
        $nowFloat = $this->nowFloat();
        $nowSec = (int) floor($nowFloat);
        $currentSeq = $this->currentSyncSeq();

        $isDelta = $sinceSeq !== null && $sinceSeq > 0 && $sinceSeq <= $currentSeq;

        $districtRows = $isDelta
            ? $this->database->fetchAll(
                'SELECT district_id, owner_faction_id, control_json, fortify_shield, heat_level, contested, chain_count, chain_expires_at, seq, updated_at
                 FROM faction_war_districts
                 WHERE seq > :sinceSeq
                 ORDER BY district_id',
                ['sinceSeq' => $sinceSeq],
            )
            : $this->database->fetchAll(
                'SELECT district_id, owner_faction_id, control_json, fortify_shield, heat_level, contested, chain_count, chain_expires_at, seq, updated_at
                 FROM faction_war_districts
                 ORDER BY district_id'
            );

        $districts = [];
        foreach ($districtRows as $row) {
            $districts[] = $this->formatDistrictRow($row, $nowFloat);
        }

        $eloRows = $isDelta
            ? $this->database->fetchAll(
                'SELECT faction_id, elo_rating, mmr_band, wins, losses, matches_played, win_streak, seq, updated_at
                 FROM faction_elo_ratings
                 WHERE seq > :sinceSeq
                 ORDER BY elo_rating DESC, faction_id ASC',
                ['sinceSeq' => $sinceSeq],
            )
            : $this->database->fetchAll(
                'SELECT faction_id, elo_rating, mmr_band, wins, losses, matches_played, win_streak, seq, updated_at
                 FROM faction_elo_ratings
                 ORDER BY elo_rating DESC, faction_id ASC'
            );

        $eloStandings = [];
        foreach ($eloRows as $er) {
            $eloStandings[] = $this->formatEloRow($er);
        }

        $lobbyRows = $isDelta
            ? $this->database->fetchAll(
                'SELECT lobby_id, faction_id, opponent_faction_id, district_id, leader_player_id, status, match_elo_gap, slots_json, seq, expires_at, created_at, updated_at
                 FROM faction_raid_lobbies
                 WHERE seq > :sinceSeq
                 ORDER BY seq DESC
                 LIMIT 24',
                ['sinceSeq' => $sinceSeq],
            )
            : $this->database->fetchAll(
                'SELECT lobby_id, faction_id, opponent_faction_id, district_id, leader_player_id, status, match_elo_gap, slots_json, seq, expires_at, created_at, updated_at
                 FROM faction_raid_lobbies
                 WHERE expires_at >= :minExp
                 ORDER BY seq DESC
                 LIMIT 24',
                ['minExp' => $nowSec - 300],
            );

        $lobbies = [];
        foreach ($lobbyRows as $lr) {
            $lobbies[] = $this->formatLobbyRow($lr, $nowSec);
        }

        $pState = $this->loadPlayerWarState($pid, $playerFactionId, $nowSec);
        $chainSummary = $this->buildGlobalChainSummary($playerFactionId, $nowFloat);

        $changedKeys = [];
        if ($isDelta) {
            if ($districts !== []) {
                $changedKeys[] = 'districts';
            }
            if ($eloStandings !== []) {
                $changedKeys[] = 'eloStandings';
            }
            if ($lobbies !== []) {
                $changedKeys[] = 'lobbies';
            }
        } else {
            $changedKeys = ['districts', 'eloStandings', 'lobbies', 'chainSummary'];
        }

        return [
            'ok' => true,
            'route' => 'faction_war.state',
            'playerId' => $pid,
            'playerFactionId' => $playerFactionId,
            'selectedDistrict' => $cleanDistrict,
            'snapshotSeq' => $currentSeq,
            'sinceSeq' => $sinceSeq,
            'deltaCompressed' => $isDelta,
            'changedKeys' => $changedKeys,
            'allDistrictIds' => array_keys(self::DISTRICTS),
            'districts' => $districts,
            'eloStandings' => $eloStandings,
            'lobbies' => $lobbies,
            'chainSummary' => $chainSummary,
            'cooldowns' => [
                'assaultRemainingSec' => max(0, ((int) $pState['assault_cd_until']) - $nowSec),
                'fortifyRemainingSec' => max(0, ((int) $pState['fortify_cd_until']) - $nowSec),
                'assaultEnergyCost' => self::ASSAULT_ENERGY_COST,
                'fortifyEnergyCost' => self::FORTIFY_ENERGY_COST,
            ],
            'factionsCatalog' => array_values(self::DEFAULT_FACTIONS),
            'player' => $player,
            'serverTimestamp' => round($nowFloat, 3),
        ];
    }

    /**
     * Unified action dispatcher supporting `faction_war.*` and short action aliases.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function act(int|string $playerId, string $action, array $payload = []): array
    {
        $cleanAction = strtolower(trim($action));
        if ($cleanAction === '') {
            throw new InvalidArgumentException('Faction war action is required.');
        }

        $sinceSeq = isset($payload['sinceSeq']) && is_numeric($payload['sinceSeq'])
            ? (int) $payload['sinceSeq']
            : null;
        $district = is_string($payload['district'] ?? null) ? $payload['district'] : 'center';

        return match ($cleanAction) {
            'faction_war.state', 'state' => $this->snapshot($playerId, $sinceSeq, $district),
            'faction_war.matchmake', 'matchmake' => $this->findOrCreateMatch($playerId, $payload),
            'faction_war.create_raid_lobby', 'create_raid_lobby' => $this->createRaidLobby($playerId, $payload),
            'faction_war.join_raid_lobby', 'join_raid_lobby' => $this->joinRaidLobby($playerId, $payload),
            'faction_war.assault_sector', 'assault_sector' => $this->assaultSector($playerId, $payload),
            'faction_war.fortify_sector', 'fortify_sector' => $this->fortifySector($playerId, $payload),
            'faction_war.resolve_match', 'resolve_match' => $this->resolveMatch($playerId, $payload),
            default => throw new InvalidArgumentException("Unsupported faction war action: {$action}"),
        };
    }

    /**
     * ELO/MMR-rated Faction Matchmaking (`matchmaking`).
     * Pairs the player's syndicate with the closest eligible rival syndicate within skill bands (`K=32`).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function findOrCreateMatch(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $this->bootstrapWorldState();

        return $this->database->playerTransaction($pid, function () use ($pid, $payload): array {
            $player = $this->loadPlayer($pid);
            $factionId = $this->resolveFactionChoice($pid, $payload['factionId'] ?? null);
            $waitSec = max(0, min(600, (int) ($payload['waitSeconds'] ?? 0)));
            $bandWidth = self::MATCH_BAND_WIDTH + (int) floor(($waitSec / 60) * self::MATCH_EXPAND_PER_MIN);

            $ratings = $this->database->fetchAll(
                'SELECT faction_id, elo_rating, mmr_band, wins, losses, matches_played, win_streak, seq, updated_at
                 FROM faction_elo_ratings
                 ORDER BY faction_id'
            );

            $selfRating = self::ELO_DEFAULT;
            $rivals = [];
            foreach ($ratings as $r) {
                if ((string) $r['faction_id'] === $factionId) {
                    $selfRating = (int) $r['elo_rating'];
                } else {
                    $rivals[] = $r;
                }
            }

            if ($rivals === []) {
                throw new RuntimeException('No rival syndicates available for matchmaking.');
            }

            usort($rivals, static function (array $a, array $b) use ($selfRating): int {
                $diffA = abs(((int) $a['elo_rating']) - $selfRating);
                $diffB = abs(((int) $b['elo_rating']) - $selfRating);
                return $diffA <=> $diffB;
            });

            $chosen = $rivals[0];
            $inBand = false;
            foreach ($rivals as $cand) {
                if (abs(((int) $cand['elo_rating']) - $selfRating) <= $bandWidth) {
                    $chosen = $cand;
                    $inBand = true;
                    break;
                }
            }

            $oppId = (string) $chosen['faction_id'];
            $oppRating = (int) $chosen['elo_rating'];
            $eloGap = abs($selfRating - $oppRating);
            $winSim = self::computeEloDelta($selfRating, $oppRating, 1.0, self::ELO_K_FACTOR);
            $lossSim = self::computeEloDelta($selfRating, $oppRating, 0.0, self::ELO_K_FACTOR);

            // Recommend the highest-heat or opponent-held district for clash
            $oppDistrict = $this->database->fetchOne(
                'SELECT district_id FROM faction_war_districts WHERE owner_faction_id = :opp ORDER BY heat_level DESC, district_id ASC LIMIT 1',
                ['opp' => $oppId],
            );
            $recommendedDistrict = $oppDistrict !== null
                ? (string) $oppDistrict['district_id']
                : 'center';

            $this->events->publish(new DomainEvent('FactionWarMatchPaired', [
                'playerId' => $pid,
                'factionId' => $factionId,
                'opponentFactionId' => $oppId,
                'selfElo' => $selfRating,
                'opponentElo' => $oppRating,
                'eloGap' => $eloGap,
                'inSkillBand' => $inBand,
                'recommendedDistrict' => $recommendedDistrict,
            ]));

            return [
                'ok' => true,
                'route' => 'faction_war.matchmake',
                'playerId' => $pid,
                'match' => [
                    'factionId' => $factionId,
                    'factionNameEn' => self::DEFAULT_FACTIONS[$factionId]['nameEn'] ?? ucfirst($factionId),
                    'factionNameAr' => self::DEFAULT_FACTIONS[$factionId]['nameAr'] ?? $factionId,
                    'selfElo' => $selfRating,
                    'selfBand' => self::resolveMmrBand($selfRating),
                    'opponentFactionId' => $oppId,
                    'opponentNameEn' => self::DEFAULT_FACTIONS[$oppId]['nameEn'] ?? ucfirst($oppId),
                    'opponentNameAr' => self::DEFAULT_FACTIONS[$oppId]['nameAr'] ?? $oppId,
                    'opponentElo' => $oppRating,
                    'opponentBand' => self::resolveMmrBand($oppRating),
                    'eloGap' => $eloGap,
                    'bandWidth' => $bandWidth,
                    'withinSkillBand' => $inBand,
                    'kFactor' => self::ELO_K_FACTOR,
                    'expectedWinProb' => $winSim['expectedA'],
                    'projectedWinDelta' => $winSim['deltaA'],
                    'projectedLossDelta' => $lossSim['deltaA'],
                    'recommendedDistrict' => $recommendedDistrict,
                ],
                'player' => $player,
                'serverTimestamp' => round($this->nowFloat(), 3),
            ];
        });
    }

    /**
     * Create a 3-Slot Raid Lobby (`vanguard`, `breacher`, `support`) paired via ELO matchmaking (`lobby-system`).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function createRaidLobby(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $this->bootstrapWorldState();

        return $this->database->playerTransaction($pid, function () use ($pid, $payload): array {
            $player = $this->loadPlayer($pid);
            $factionId = $this->resolveFactionChoice($pid, $payload['factionId'] ?? null);
            $districtId = self::normalizeDistrictId(is_string($payload['district'] ?? null) ? $payload['district'] : 'center');
            $slotChoice = strtolower(trim((string) ($payload['slot'] ?? 'vanguard')));
            if (!in_array($slotChoice, self::RAID_SLOTS, true)) {
                $slotChoice = 'vanguard';
            }

            // Pair opponent via ELO
            $selfEloRow = $this->database->fetchOne(
                'SELECT elo_rating FROM faction_elo_ratings WHERE faction_id = :fid',
                ['fid' => $factionId],
            );
            $selfElo = (int) ($selfEloRow['elo_rating'] ?? self::ELO_DEFAULT);

            $requestedOpp = is_string($payload['opponentFactionId'] ?? null)
                ? strtolower(trim($payload['opponentFactionId']))
                : '';

            $rivalRows = $this->database->fetchAll(
                'SELECT faction_id, elo_rating FROM faction_elo_ratings WHERE faction_id != :fid ORDER BY faction_id',
                ['fid' => $factionId],
            );
            if ($rivalRows === []) {
                throw new RuntimeException('No rival faction available to raid.');
            }

            $oppRow = $rivalRows[0];
            if ($requestedOpp !== '' && $requestedOpp !== $factionId) {
                foreach ($rivalRows as $r) {
                    if ((string) $r['faction_id'] === $requestedOpp) {
                        $oppRow = $r;
                        break;
                    }
                }
            } else {
                usort($rivalRows, static fn (array $a, array $b): int => abs((int) $a['elo_rating'] - $selfElo) <=> abs((int) $b['elo_rating'] - $selfElo));
                $oppRow = $rivalRows[0];
            }

            $oppId = (string) $oppRow['faction_id'];
            $eloGap = abs($selfElo - (int) $oppRow['elo_rating']);

            $nowSec = $this->nowSec();
            $lobbyId = 'raid-' . bin2hex(random_bytes(6));

            $slots = [
                'vanguard' => null,
                'breacher' => null,
                'support' => null,
            ];
            $slots[$slotChoice] = [
                'playerId' => $pid,
                'username' => (string) $player['username'],
                'level' => (int) $player['level'],
                'isNpc' => false,
                'joinedAt' => $nowSec,
            ];

            $fillAlliedBots = !empty($payload['fillAlliedSquad']);
            if ($fillAlliedBots) {
                $npcNames = ['breacher' => 'Cipher_Ghost', 'support' => 'Med_Tariq', 'vanguard' => 'Vanguard_Rex'];
                foreach (self::RAID_SLOTS as $sKey) {
                    if ($slots[$sKey] === null) {
                        $slots[$sKey] = [
                            'playerId' => 'npc-' . $sKey,
                            'username' => $npcNames[$sKey],
                            'level' => max(1, (int) $player['level']),
                            'isNpc' => true,
                            'joinedAt' => $nowSec,
                        ];
                    }
                }
            }

            $filledCount = count(array_filter($slots, static fn (?array $s): bool => $s !== null));
            $status = $filledCount >= count(self::RAID_SLOTS) ? 'READY' : 'WAITING';
            $seq = $this->bumpSyncSeq($nowSec);

            $row = [
                'lobby_id' => $lobbyId,
                'faction_id' => $factionId,
                'opponent_faction_id' => $oppId,
                'district_id' => $districtId,
                'leader_player_id' => $pid,
                'status' => $status,
                'match_elo_gap' => $eloGap,
                'slots_json' => json_encode($slots, JSON_THROW_ON_ERROR),
                'seq' => $seq,
                'expires_at' => $nowSec + self::LOBBY_TTL_SEC,
                'created_at' => gmdate('c', $nowSec),
                'updated_at' => gmdate('c', $nowSec),
            ];

            $this->database->execute(
                'INSERT INTO faction_raid_lobbies (
                    lobby_id, faction_id, opponent_faction_id, district_id, leader_player_id,
                    status, match_elo_gap, slots_json, seq, expires_at, created_at, updated_at
                 ) VALUES (
                    :lid, :fid, :oid, :did, :leader,
                    :status, :gap, :slots, :seq, :exp, :created, :updated
                 )',
                [
                    'lid' => $row['lobby_id'],
                    'fid' => $row['faction_id'],
                    'oid' => $row['opponent_faction_id'],
                    'did' => $row['district_id'],
                    'leader' => $row['leader_player_id'],
                    'status' => $row['status'],
                    'gap' => $row['match_elo_gap'],
                    'slots' => $row['slots_json'],
                    'seq' => $row['seq'],
                    'exp' => $row['expires_at'],
                    'created' => $row['created_at'],
                    'updated' => $row['updated_at'],
                ],
            );

            $this->events->publish(new DomainEvent('FactionRaidLobbyCreated', [
                'lobbyId' => $lobbyId,
                'factionId' => $factionId,
                'opponentFactionId' => $oppId,
                'districtId' => $districtId,
                'leaderPlayerId' => $pid,
                'status' => $status,
                'seq' => $seq,
            ]));

            return [
                'ok' => true,
                'route' => 'faction_war.create_raid_lobby',
                'snapshotSeq' => $seq,
                'lobby' => $this->formatLobbyRow($row, $nowSec),
                'player' => $player,
                'serverTimestamp' => round($this->nowFloat(), 3),
            ];
        });
    }

    /**
     * Join an open slot inside a 3-Slot Raid Lobby (`vanguard`, `breacher`, `support`).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function joinRaidLobby(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $lobbyId = trim((string) ($payload['lobbyId'] ?? ''));
        if ($lobbyId === '') {
            throw new InvalidArgumentException('lobbyId is required to join a raid lobby.');
        }

        $this->bootstrapWorldState();

        return $this->database->playerTransaction($pid, function () use ($pid, $lobbyId, $payload): array {
            $player = $this->loadPlayer($pid);
            $nowSec = $this->nowSec();

            $row = $this->database->fetchOne(
                'SELECT lobby_id, faction_id, opponent_faction_id, district_id, leader_player_id, status, match_elo_gap, slots_json, seq, expires_at, created_at, updated_at
                 FROM faction_raid_lobbies
                 WHERE lobby_id = :lid',
                ['lid' => $lobbyId],
            );
            if ($row === null) {
                throw new RuntimeException("Raid lobby not found: {$lobbyId}");
            }
            if ((string) $row['status'] === 'RESOLVED') {
                throw new RuntimeException('Raid lobby is already resolved.');
            }
            if ((int) $row['expires_at'] < $nowSec) {
                throw new RuntimeException('Raid lobby has expired.');
            }

            $slots = json_decode((string) $row['slots_json'], true);
            if (!is_array($slots)) {
                $slots = ['vanguard' => null, 'breacher' => null, 'support' => null];
            }

            // Prevent duplicate player presence by moving or keeping slot cleanly
            foreach (self::RAID_SLOTS as $k) {
                if (isset($slots[$k]['playerId']) && (string) $slots[$k]['playerId'] === $pid) {
                    $slots[$k] = null;
                }
            }

            $requestedSlot = strtolower(trim((string) ($payload['slot'] ?? '')));
            $targetSlot = null;
            if ($requestedSlot !== '' && in_array($requestedSlot, self::RAID_SLOTS, true) && $slots[$requestedSlot] === null) {
                $targetSlot = $requestedSlot;
            } else {
                foreach (self::RAID_SLOTS as $k) {
                    if ($slots[$k] === null) {
                        $targetSlot = $k;
                        break;
                    }
                }
            }

            if ($targetSlot === null) {
                throw new RuntimeException('All 3 raid lobby slots are already filled.');
            }

            $slots[$targetSlot] = [
                'playerId' => $pid,
                'username' => (string) $player['username'],
                'level' => (int) $player['level'],
                'isNpc' => false,
                'joinedAt' => $nowSec,
            ];

            $filledCount = count(array_filter($slots, static fn (?array $s): bool => $s !== null));
            $nextStatus = $filledCount >= count(self::RAID_SLOTS) ? 'READY' : 'WAITING';
            $seq = $this->bumpSyncSeq($nowSec);
            $updatedAt = gmdate('c', $nowSec);

            $this->database->execute(
                'UPDATE faction_raid_lobbies
                 SET slots_json = :slots, status = :status, seq = :seq, updated_at = :updated
                 WHERE lobby_id = :lid',
                [
                    'slots' => json_encode($slots, JSON_THROW_ON_ERROR),
                    'status' => $nextStatus,
                    'seq' => $seq,
                    'updated' => $updatedAt,
                    'lid' => $lobbyId,
                ],
            );

            $row['slots_json'] = json_encode($slots, JSON_THROW_ON_ERROR);
            $row['status'] = $nextStatus;
            $row['seq'] = $seq;
            $row['updated_at'] = $updatedAt;

            $this->events->publish(new DomainEvent('FactionRaidLobbyJoined', [
                'lobbyId' => $lobbyId,
                'playerId' => $pid,
                'slot' => $targetSlot,
                'status' => $nextStatus,
                'seq' => $seq,
            ]));

            return [
                'ok' => true,
                'route' => 'faction_war.join_raid_lobby',
                'snapshotSeq' => $seq,
                'assignedSlot' => $targetSlot,
                'lobby' => $this->formatLobbyRow($row, $nowSec),
                'player' => $player,
                'serverTimestamp' => round($this->nowFloat(), 3),
            ];
        });
    }

    /**
     * Server-Authoritative Sector Assault (`assault_sector`).
     * Enforces 15 Energy + 8s cooldown, lag-compensated chain window validation,
     * shifts district territory control %, and settles cash/XP + optional lobby ELO clash.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function assaultSector(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $districtId = self::normalizeDistrictId(is_string($payload['district'] ?? null) ? $payload['district'] : 'center');
        $this->bootstrapWorldState();

        return $this->database->playerTransaction($pid, function () use ($pid, $districtId, $payload): array {
            $this->resources->regenerate($pid);
            $player = $this->loadPlayer($pid);
            $nowFloat = $this->nowFloat();
            $nowSec = (int) floor($nowFloat);

            $factionId = $this->resolveFactionChoice($pid, $payload['factionId'] ?? null);
            $pState = $this->loadPlayerWarState($pid, $factionId, $nowSec);

            $cdRem = max(0, ((int) $pState['assault_cd_until']) - $nowSec);
            if ($cdRem > 0) {
                throw new CooldownException('faction_war.assault_sector', $cdRem);
            }
            if ($this->clock === null) {
                $this->cooldowns->assertReady($pid, 'faction_war.assault_sector');
            }

            if ((int) $player['energy'] < self::ASSAULT_ENERGY_COST) {
                throw new RuntimeException(sprintf(
                    'Insufficient Energy for sector assault (%dE required, %dE available).',
                    self::ASSAULT_ENERGY_COST,
                    (int) $player['energy'],
                ));
            }

            $distRow = $this->database->fetchOne(
                'SELECT district_id, owner_faction_id, control_json, fortify_shield, heat_level, contested, chain_count, chain_expires_at, seq, updated_at
                 FROM faction_war_districts
                 WHERE district_id = :did',
                ['did' => $districtId],
            );
            if ($distRow === null) {
                throw new RuntimeException("District not found: {$districtId}");
            }

            $clientTs = isset($payload['clientPhaseTs']) && is_numeric($payload['clientPhaseTs'])
                ? (float) $payload['clientPhaseTs']
                : null;
            $chainWindow = self::evaluateLagCompensatedChainWindow(
                $nowFloat,
                (int) $distRow['chain_expires_at'],
                $clientTs,
                self::LAG_COMPENSATION_MAX_SEC,
            );

            $prevOwner = (string) $distRow['owner_faction_id'];
            $control = $this->decodeControlMap((string) $distRow['control_json'], $prevOwner);
            $shield = max(0, min(100, (int) $distRow['fortify_shield']));

            // Squad multiplier if an active READY lobby targets this district
            $squadBonus = 0;
            $activeLobby = null;
            $lobbyId = is_string($payload['lobbyId'] ?? null) ? trim($payload['lobbyId']) : '';
            if ($lobbyId !== '') {
                $lRow = $this->database->fetchOne(
                    'SELECT lobby_id, faction_id, opponent_faction_id, district_id, leader_player_id, status, match_elo_gap, slots_json, seq, expires_at, created_at, updated_at
                     FROM faction_raid_lobbies
                     WHERE lobby_id = :lid',
                    ['lid' => $lobbyId],
                );
                if ($lRow !== null && (string) $lRow['status'] !== 'RESOLVED' && (string) $lRow['district_id'] === $districtId) {
                    $slots = json_decode((string) $lRow['slots_json'], true);
                    $filled = is_array($slots) ? count(array_filter($slots, static fn ($s): bool => $s !== null)) : 0;
                    $squadBonus = $filled * 3;
                    $activeLobby = $lRow;
                }
            }

            $level = max(1, (int) $player['level']);
            $rawPush = 10 + min(8, intdiv($level, 3)) + $squadBonus + ($chainWindow['active'] ? min(6, (int) $distRow['chain_count']) : 0);

            $shieldAbsorbed = min($shield, $rawPush);
            $nextShield = max(0, $shield - $shieldAbsorbed);
            $influenceShift = max(4, $rawPush - intdiv($shieldAbsorbed, 2));

            $control = $this->shiftFactionInfluence($control, $factionId, $influenceShift);
            $nextOwner = $this->resolveTopOwner($control, $prevOwner);
            $captured = $nextOwner !== $prevOwner && $nextOwner === $factionId;

            $nextChainCount = $chainWindow['active'] ? ((int) $distRow['chain_count'] + 1) : 1;
            $nextChainExpires = $nowSec + self::CHAIN_WINDOW_SEC;
            $nextHeat = max(10, min(100, (int) $distRow['heat_level'] + ($captured ? 18 : 9)));
            $contested = ($control[$nextOwner] ?? 0) < 55 ? 1 : 0;

            $distSpec = self::DISTRICTS[$districtId];
            $chainMult = min(2.0, 1.0 + ($nextChainCount * 0.04));
            $cashAwarded = max(150, (int) round(($distSpec['baseCash'] + ($level * 48) + ($captured ? 600 : 0)) * $chainMult));
            $xpAwarded = max(10, (int) round(($distSpec['baseXp'] + min(24, $level)) * $chainMult));

            $nextEnergy = max(0, (int) $player['energy'] - self::ASSAULT_ENERGY_COST);
            $nextCash = (int) $player['cash'] + $cashAwarded;
            $nextXp = (int) $player['xp'] + $xpAwarded;
            $correlationId = bin2hex(random_bytes(16));

            $this->database->execute(
                'UPDATE players SET energy = :nextEnergy, cash = :nextCash, xp = :nextXp WHERE id = :pid',
                [
                    'nextEnergy' => $nextEnergy,
                    'nextCash' => $nextCash,
                    'nextXp' => $nextXp,
                    'pid' => $pid,
                ],
            );

            $this->ledger->record($pid, 'cash', $cashAwarded, $nextCash, 'faction_war.assault_sector', $correlationId);
            $levelUp = $this->leveling->sync($pid, $correlationId);

            $seq = $this->bumpSyncSeq($nowSec);
            $updatedAt = gmdate('c', $nowSec);

            $updatedDist = [
                'district_id' => $districtId,
                'owner_faction_id' => $nextOwner,
                'control_json' => json_encode($control, JSON_THROW_ON_ERROR),
                'fortify_shield' => $nextShield,
                'heat_level' => $nextHeat,
                'contested' => $contested,
                'chain_count' => $nextChainCount,
                'chain_expires_at' => $nextChainExpires,
                'seq' => $seq,
                'updated_at' => $updatedAt,
            ];

            $this->database->execute(
                'UPDATE faction_war_districts
                 SET owner_faction_id = :owner, control_json = :ctrl, fortify_shield = :shield,
                     heat_level = :heat, contested = :cont, chain_count = :ccount,
                     chain_expires_at = :cexp, seq = :seq, updated_at = :updated
                 WHERE district_id = :did',
                [
                    'owner' => $updatedDist['owner_faction_id'],
                    'ctrl' => $updatedDist['control_json'],
                    'shield' => $updatedDist['fortify_shield'],
                    'heat' => $updatedDist['heat_level'],
                    'cont' => $updatedDist['contested'],
                    'ccount' => $updatedDist['chain_count'],
                    'cexp' => $updatedDist['chain_expires_at'],
                    'seq' => $updatedDist['seq'],
                    'updated' => $updatedDist['updated_at'],
                    'did' => $districtId,
                ],
            );

            $cooldownUntil = $nowSec + self::ASSAULT_COOLDOWN_SEC;
            $this->savePlayerWarState(
                $pid,
                $factionId,
                $cooldownUntil,
                (int) $pState['fortify_cd_until'],
                (int) $pState['raids_executed'] + 1,
                (int) $pState['fortifies_executed'],
                $nowSec,
            );

            if ($this->clock === null) {
                $this->cooldowns->arm($pid, 'faction_war.assault_sector', self::ASSAULT_COOLDOWN_SEC);
            }

            // If sector flipped ownership during an assault, settle ELO delta cleanly (K=32)
            $eloUpdate = null;
            if ($captured && $prevOwner !== $factionId) {
                $eloUpdate = $this->applyFactionEloOutcome($factionId, $prevOwner, 1.0, $seq, $nowSec);
                if ($activeLobby !== null) {
                    $this->database->execute(
                        "UPDATE faction_raid_lobbies SET status = 'ACTIVE', seq = :seq, updated_at = :updated WHERE lobby_id = :lid",
                        ['seq' => $seq, 'updated' => $updatedAt, 'lid' => (string) $activeLobby['lobby_id']],
                    );
                }
            }

            $this->events->publish(new DomainEvent('FactionSectorAssaulted', [
                'playerId' => $pid,
                'factionId' => $factionId,
                'districtId' => $districtId,
                'previousOwner' => $prevOwner,
                'ownerAfter' => $nextOwner,
                'captured' => $captured,
                'influenceShift' => $influenceShift,
                'chainCount' => $nextChainCount,
                'lagCompensated' => $chainWindow['compensated'],
                'cashAwarded' => $cashAwarded,
                'xpAwarded' => $xpAwarded,
                'seq' => $seq,
                'correlationId' => $correlationId,
            ]));

            $freshPlayer = $this->loadPlayer($pid);

            return [
                'ok' => true,
                'route' => 'faction_war.assault_sector',
                'snapshotSeq' => $seq,
                'result' => [
                    'districtId' => $districtId,
                    'attackingFactionId' => $factionId,
                    'previousOwner' => $prevOwner,
                    'ownerAfter' => $nextOwner,
                    'captured' => $captured,
                    'influenceShift' => $influenceShift,
                    'shieldAbsorbed' => $shieldAbsorbed,
                    'shieldRemaining' => $nextShield,
                    'chainCount' => $nextChainCount,
                    'chainWindow' => $chainWindow,
                    'energySpent' => self::ASSAULT_ENERGY_COST,
                    'cashAwarded' => $cashAwarded,
                    'xpAwarded' => $xpAwarded,
                    'cooldownSeconds' => self::ASSAULT_COOLDOWN_SEC,
                    'levelUp' => $levelUp,
                    'eloUpdate' => $eloUpdate,
                    'summaryEn' => $captured
                        ? sprintf('Sector Captured! %s seized %s (+$%s · +%d XP).', self::DEFAULT_FACTIONS[$factionId]['nameEn'] ?? $factionId, $distSpec['nameEn'], number_format($cashAwarded), $xpAwarded)
                        : sprintf('Sector Assaulted! +%d%% control push in %s (+$%s · +%d XP).', $influenceShift, $distSpec['nameEn'], number_format($cashAwarded), $xpAwarded),
                    'summaryAr' => $captured
                        ? sprintf('تمت السيطرة على القطاع! استولت %s على %s (+$%s · +%d خبرة).', self::DEFAULT_FACTIONS[$factionId]['nameAr'] ?? $factionId, $distSpec['nameAr'], number_format($cashAwarded), $xpAwarded)
                        : sprintf('هجوم ناجح على القطاع! +%d%% نفوذ في %s (+$%s · +%d خبرة).', $influenceShift, $distSpec['nameAr'], number_format($cashAwarded), $xpAwarded),
                    'serverProof' => [
                        'correlationId' => $correlationId,
                        'clientOutcomeIgnored' => true,
                    ],
                ],
                'district' => $this->formatDistrictRow($updatedDist, $nowFloat),
                'player' => $freshPlayer,
                'serverTimestamp' => round($nowFloat, 3),
            ];
        });
    }

    /**
     * Server-Authoritative Sector Fortification (`fortify_sector`).
     * Enforces 10 Energy + 8s cooldown, bolsters fortify_shield & defender control %, and extends chain timer.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function fortifySector(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $districtId = self::normalizeDistrictId(is_string($payload['district'] ?? null) ? $payload['district'] : 'center');
        $this->bootstrapWorldState();

        return $this->database->playerTransaction($pid, function () use ($pid, $districtId, $payload): array {
            $this->resources->regenerate($pid);
            $player = $this->loadPlayer($pid);
            $nowFloat = $this->nowFloat();
            $nowSec = (int) floor($nowFloat);

            $factionId = $this->resolveFactionChoice($pid, $payload['factionId'] ?? null);
            $pState = $this->loadPlayerWarState($pid, $factionId, $nowSec);

            $cdRem = max(0, ((int) $pState['fortify_cd_until']) - $nowSec);
            if ($cdRem > 0) {
                throw new CooldownException('faction_war.fortify_sector', $cdRem);
            }
            if ($this->clock === null) {
                $this->cooldowns->assertReady($pid, 'faction_war.fortify_sector');
            }

            if ((int) $player['energy'] < self::FORTIFY_ENERGY_COST) {
                throw new RuntimeException(sprintf(
                    'Insufficient Energy to fortify sector (%dE required, %dE available).',
                    self::FORTIFY_ENERGY_COST,
                    (int) $player['energy'],
                ));
            }

            $distRow = $this->database->fetchOne(
                'SELECT district_id, owner_faction_id, control_json, fortify_shield, heat_level, contested, chain_count, chain_expires_at, seq, updated_at
                 FROM faction_war_districts
                 WHERE district_id = :did',
                ['did' => $districtId],
            );
            if ($distRow === null) {
                throw new RuntimeException("District not found: {$districtId}");
            }

            $shieldGain = 16;
            $nextShield = min(100, max(0, (int) $distRow['fortify_shield'] + $shieldGain));
            $prevOwner = (string) $distRow['owner_faction_id'];
            $control = $this->decodeControlMap((string) $distRow['control_json'], $prevOwner);
            $control = $this->shiftFactionInfluence($control, $factionId, 8);
            $nextOwner = $this->resolveTopOwner($control, $prevOwner);
            $nextHeat = max(8, (int) $distRow['heat_level'] - 6);
            $contested = ($control[$nextOwner] ?? 0) < 55 ? 1 : 0;

            $chainWindow = self::evaluateLagCompensatedChainWindow($nowFloat, (int) $distRow['chain_expires_at'], null);
            $nextChainCount = $chainWindow['active'] ? ((int) $distRow['chain_count'] + 1) : max(1, (int) $distRow['chain_count']);
            $nextChainExpires = $nowSec + self::CHAIN_WINDOW_SEC;

            $distSpec = self::DISTRICTS[$districtId];
            $level = max(1, (int) $player['level']);
            $cashAwarded = max(110, (int) round(($distSpec['baseCash'] * 0.72) + ($level * 30)));
            $xpAwarded = max(8, (int) round(($distSpec['baseXp'] * 0.8) + min(16, $level)));

            $nextEnergy = max(0, (int) $player['energy'] - self::FORTIFY_ENERGY_COST);
            $nextCash = (int) $player['cash'] + $cashAwarded;
            $nextXp = (int) $player['xp'] + $xpAwarded;
            $correlationId = bin2hex(random_bytes(16));

            $this->database->execute(
                'UPDATE players SET energy = :nextEnergy, cash = :nextCash, xp = :nextXp WHERE id = :pid',
                [
                    'nextEnergy' => $nextEnergy,
                    'nextCash' => $nextCash,
                    'nextXp' => $nextXp,
                    'pid' => $pid,
                ],
            );

            $this->ledger->record($pid, 'cash', $cashAwarded, $nextCash, 'faction_war.fortify_sector', $correlationId);
            $levelUp = $this->leveling->sync($pid, $correlationId);

            $seq = $this->bumpSyncSeq($nowSec);
            $updatedAt = gmdate('c', $nowSec);

            $updatedDist = [
                'district_id' => $districtId,
                'owner_faction_id' => $nextOwner,
                'control_json' => json_encode($control, JSON_THROW_ON_ERROR),
                'fortify_shield' => $nextShield,
                'heat_level' => $nextHeat,
                'contested' => $contested,
                'chain_count' => $nextChainCount,
                'chain_expires_at' => $nextChainExpires,
                'seq' => $seq,
                'updated_at' => $updatedAt,
            ];

            $this->database->execute(
                'UPDATE faction_war_districts
                 SET owner_faction_id = :owner, control_json = :ctrl, fortify_shield = :shield,
                     heat_level = :heat, contested = :cont, chain_count = :ccount,
                     chain_expires_at = :cexp, seq = :seq, updated_at = :updated
                 WHERE district_id = :did',
                [
                    'owner' => $updatedDist['owner_faction_id'],
                    'ctrl' => $updatedDist['control_json'],
                    'shield' => $updatedDist['fortify_shield'],
                    'heat' => $updatedDist['heat_level'],
                    'cont' => $updatedDist['contested'],
                    'ccount' => $updatedDist['chain_count'],
                    'cexp' => $updatedDist['chain_expires_at'],
                    'seq' => $updatedDist['seq'],
                    'updated' => $updatedDist['updated_at'],
                    'did' => $districtId,
                ],
            );

            $cooldownUntil = $nowSec + self::FORTIFY_COOLDOWN_SEC;
            $this->savePlayerWarState(
                $pid,
                $factionId,
                (int) $pState['assault_cd_until'],
                $cooldownUntil,
                (int) $pState['raids_executed'],
                (int) $pState['fortifies_executed'] + 1,
                $nowSec,
            );

            if ($this->clock === null) {
                $this->cooldowns->arm($pid, 'faction_war.fortify_sector', self::FORTIFY_COOLDOWN_SEC);
            }

            $this->events->publish(new DomainEvent('FactionSectorFortified', [
                'playerId' => $pid,
                'factionId' => $factionId,
                'districtId' => $districtId,
                'fortifyShield' => $nextShield,
                'ownerAfter' => $nextOwner,
                'cashAwarded' => $cashAwarded,
                'xpAwarded' => $xpAwarded,
                'seq' => $seq,
                'correlationId' => $correlationId,
            ]));

            $freshPlayer = $this->loadPlayer($pid);

            return [
                'ok' => true,
                'route' => 'faction_war.fortify_sector',
                'snapshotSeq' => $seq,
                'result' => [
                    'districtId' => $districtId,
                    'factionId' => $factionId,
                    'fortifyShield' => $nextShield,
                    'shieldGain' => $shieldGain,
                    'ownerAfter' => $nextOwner,
                    'energySpent' => self::FORTIFY_ENERGY_COST,
                    'cashAwarded' => $cashAwarded,
                    'xpAwarded' => $xpAwarded,
                    'cooldownSeconds' => self::FORTIFY_COOLDOWN_SEC,
                    'levelUp' => $levelUp,
                    'summaryEn' => sprintf('Sector Fortified! %s shield raised to %d%% (+$%s · +%d XP).', $distSpec['nameEn'], $nextShield, number_format($cashAwarded), $xpAwarded),
                    'summaryAr' => sprintf('تم تحصين القطاع! ارتفع درع %s إلى %d%% (+$%s · +%d خبرة).', $distSpec['nameAr'], $nextShield, number_format($cashAwarded), $xpAwarded),
                ],
                'district' => $this->formatDistrictRow($updatedDist, $nowFloat),
                'player' => $freshPlayer,
                'serverTimestamp' => round($nowFloat, 3),
            ];
        });
    }

    /**
     * Server-Authoritative Raid Match Resolution (`resolve_match`).
     * Adjudicates match victor from district control + raid squad strength and applies `K=32` ELO delta.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function resolveMatch(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $lobbyId = trim((string) ($payload['lobbyId'] ?? ''));
        if ($lobbyId === '') {
            throw new InvalidArgumentException('lobbyId is required to resolve a raid match.');
        }

        $this->bootstrapWorldState();

        return $this->database->playerTransaction($pid, function () use ($pid, $lobbyId): array {
            $player = $this->loadPlayer($pid);
            $nowSec = $this->nowSec();

            $lobby = $this->database->fetchOne(
                'SELECT lobby_id, faction_id, opponent_faction_id, district_id, leader_player_id, status, match_elo_gap, slots_json, seq, expires_at, created_at, updated_at
                 FROM faction_raid_lobbies
                 WHERE lobby_id = :lid',
                ['lid' => $lobbyId],
            );
            if ($lobby === null) {
                throw new RuntimeException("Raid lobby not found: {$lobbyId}");
            }
            if ((string) $lobby['status'] === 'RESOLVED') {
                throw new RuntimeException('Raid match is already resolved.');
            }

            $attFaction = (string) $lobby['faction_id'];
            $defFaction = (string) $lobby['opponent_faction_id'];
            $districtId = (string) $lobby['district_id'];
            $slots = json_decode((string) $lobby['slots_json'], true);
            $filled = is_array($slots) ? count(array_filter($slots, static fn ($s): bool => $s !== null)) : 1;

            $distRow = $this->database->fetchOne(
                'SELECT district_id, owner_faction_id, control_json, fortify_shield, heat_level, contested, chain_count, chain_expires_at, seq, updated_at
                 FROM faction_war_districts
                 WHERE district_id = :did',
                ['did' => $districtId],
            );
            $control = $distRow !== null
                ? $this->decodeControlMap((string) $distRow['control_json'], (string) $distRow['owner_faction_id'])
                : [$attFaction => 40, $defFaction => 40];

            $attScore = ($control[$attFaction] ?? 20) + ($filled * 14) + min(15, (int) floor(((int) $player['level']) / 2));
            $defScore = ($control[$defFaction] ?? 20) + ($distRow !== null ? intdiv((int) $distRow['fortify_shield'], 3) : 10);
            $rollEdge = $this->roll(-6, 8);
            $attackerWon = ($attScore + $rollEdge) >= $defScore;
            $actualScore = $attackerWon ? 1.0 : 0.0;

            $seq = $this->bumpSyncSeq($nowSec);
            $eloUpdate = $this->applyFactionEloOutcome($attFaction, $defFaction, $actualScore, $seq, $nowSec);

            $updatedAt = gmdate('c', $nowSec);
            $this->database->execute(
                "UPDATE faction_raid_lobbies SET status = 'RESOLVED', seq = :seq, updated_at = :updated WHERE lobby_id = :lid",
                ['seq' => $seq, 'updated' => $updatedAt, 'lid' => $lobbyId],
            );

            $cashAwarded = $attackerWon ? 1200 : 350;
            $nextCash = (int) $player['cash'] + $cashAwarded;
            $correlationId = bin2hex(random_bytes(16));
            $this->database->execute(
                'UPDATE players SET cash = :nextCash WHERE id = :pid',
                ['nextCash' => $nextCash, 'pid' => $pid],
            );
            $this->ledger->record($pid, 'cash', $cashAwarded, $nextCash, 'faction_war.match_resolved', $correlationId);

            $lobby['status'] = 'RESOLVED';
            $lobby['seq'] = $seq;
            $lobby['updated_at'] = $updatedAt;

            $this->events->publish(new DomainEvent('FactionWarMatchResolved', [
                'lobbyId' => $lobbyId,
                'attackerFactionId' => $attFaction,
                'defenderFactionId' => $defFaction,
                'districtId' => $districtId,
                'attackerWon' => $attackerWon,
                'eloUpdate' => $eloUpdate,
                'cashAwarded' => $cashAwarded,
                'seq' => $seq,
            ]));

            return [
                'ok' => true,
                'route' => 'faction_war.resolve_match',
                'snapshotSeq' => $seq,
                'result' => [
                    'lobbyId' => $lobbyId,
                    'districtId' => $districtId,
                    'attackerFactionId' => $attFaction,
                    'defenderFactionId' => $defFaction,
                    'attackerWon' => $attackerWon,
                    'winnerFactionId' => $attackerWon ? $attFaction : $defFaction,
                    'cashAwarded' => $cashAwarded,
                    'eloUpdate' => $eloUpdate,
                ],
                'lobby' => $this->formatLobbyRow($lobby, $nowSec),
                'player' => $this->loadPlayer($pid),
                'serverTimestamp' => round($this->nowFloat(), 3),
            ];
        });
    }

    private function bootstrapWorldState(): void
    {
        $nowSec = $this->nowSec();
        $nowIso = gmdate('c', $nowSec);

        $this->database->transaction(function () use ($nowSec, $nowIso): void {
            $sync = $this->database->fetchOne("SELECT scope FROM faction_war_sync_state WHERE scope = 'global'");
            if ($sync === null) {
                $this->database->insertIgnore(
                    'faction_war_sync_state',
                    ['scope', 'current_seq', 'updated_at'],
                    ['global', 1, $nowIso],
                );
            }

            foreach (self::DEFAULT_FACTIONS as $fid => $spec) {
                $this->database->insertIgnore(
                    'faction_elo_ratings',
                    ['faction_id', 'elo_rating', 'mmr_band', 'wins', 'losses', 'matches_played', 'win_streak', 'seq', 'updated_at'],
                    [$fid, $spec['baseElo'], self::resolveMmrBand($spec['baseElo']), 0, 0, 0, 0, 1, $nowIso],
                );
            }

            foreach (self::DISTRICTS as $did => $spec) {
                $owner = $spec['defaultOwner'];
                $control = $this->initialControlDistribution($owner);
                $this->database->insertIgnore(
                    'faction_war_districts',
                    ['district_id', 'owner_faction_id', 'control_json', 'fortify_shield', 'heat_level', 'contested', 'chain_count', 'chain_expires_at', 'seq', 'updated_at'],
                    [$did, $owner, json_encode($control, JSON_THROW_ON_ERROR), 24, 22, 0, 0, 0, 1, $nowIso],
                );
            }
        });
    }

    /**
     * @return array<string, int>
     */
    private function initialControlDistribution(string $owner): array
    {
        $map = [];
        $others = [];
        foreach (array_keys(self::DEFAULT_FACTIONS) as $fid) {
            if ($fid === $owner) {
                $map[$fid] = 58;
            } else {
                $others[] = $fid;
            }
        }
        $shares = [18, 14, 10];
        foreach ($others as $idx => $fid) {
            $map[$fid] = $shares[$idx] ?? 10;
        }
        return $map;
    }

    /**
     * @return array<string, int>
     */
    private function decodeControlMap(string $json, string $fallbackOwner): array
    {
        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            return $this->initialControlDistribution($fallbackOwner);
        }
        $clean = [];
        $sum = 0;
        foreach (array_keys(self::DEFAULT_FACTIONS) as $fid) {
            $v = max(0, min(100, (int) ($decoded[$fid] ?? 0)));
            $clean[$fid] = $v;
            $sum += $v;
        }
        if ($sum <= 0) {
            return $this->initialControlDistribution($fallbackOwner);
        }
        return $clean;
    }

    /**
     * @param array<string, int> $control
     * @return array<string, int>
     */
    private function shiftFactionInfluence(array $control, string $targetFaction, int $delta): array
    {
        if (!isset($control[$targetFaction])) {
            $control[$targetFaction] = 0;
        }

        $remainingTake = $delta;
        $rivals = array_keys($control);
        usort($rivals, static fn (string $a, string $b): int => $control[$b] <=> $control[$a]);

        $taken = 0;
        foreach ($rivals as $fid) {
            if ($fid === $targetFaction || $remainingTake <= 0) {
                continue;
            }
            $avail = max(0, $control[$fid] - 2);
            $pull = min($avail, $remainingTake);
            $control[$fid] -= $pull;
            $taken += $pull;
            $remainingTake -= $pull;
        }

        $control[$targetFaction] = min(94, $control[$targetFaction] + $taken);
        // Re-balance remainder to 100
        $sum = array_sum($control);
        if ($sum !== 100) {
            $control[$targetFaction] = max(0, min(100, $control[$targetFaction] + (100 - $sum)));
        }
        return $control;
    }

    /**
     * @param array<string, int> $control
     */
    private function resolveTopOwner(array $control, string $currentOwner): string
    {
        $bestOwner = $currentOwner;
        $bestVal = $control[$currentOwner] ?? 0;
        foreach ($control as $fid => $val) {
            if ($val > $bestVal) {
                $bestVal = $val;
                $bestOwner = $fid;
            }
        }
        return $bestOwner;
    }

    /**
     * @return array<string, mixed>
     */
    private function applyFactionEloOutcome(
        string $factionA,
        string $factionB,
        float $scoreA,
        int $seq,
        int $nowSec,
    ): array {
        $rowA = $this->database->fetchOne(
            'SELECT faction_id, elo_rating, wins, losses, matches_played, win_streak FROM faction_elo_ratings WHERE faction_id = :fa',
            ['fa' => $factionA],
        );
        $rowB = $this->database->fetchOne(
            'SELECT faction_id, elo_rating, wins, losses, matches_played, win_streak FROM faction_elo_ratings WHERE faction_id = :fb',
            ['fb' => $factionB],
        );

        $ratingA = (int) ($rowA['elo_rating'] ?? self::ELO_DEFAULT);
        $ratingB = (int) ($rowB['elo_rating'] ?? self::ELO_DEFAULT);
        $calc = self::computeEloDelta($ratingA, $ratingB, $scoreA, self::ELO_K_FACTOR);

        $aWon = $scoreA >= 0.5;
        $updatedAt = gmdate('c', $nowSec);

        $this->database->execute(
            'UPDATE faction_elo_ratings
             SET elo_rating = :elo, mmr_band = :band, wins = :wins, losses = :losses,
                 matches_played = :mp, win_streak = :ws, seq = :seq, updated_at = :updated
             WHERE faction_id = :fid',
            [
                'elo' => $calc['nextRatingA'],
                'band' => self::resolveMmrBand($calc['nextRatingA']),
                'wins' => (int) ($rowA['wins'] ?? 0) + ($aWon ? 1 : 0),
                'losses' => (int) ($rowA['losses'] ?? 0) + ($aWon ? 0 : 1),
                'mp' => (int) ($rowA['matches_played'] ?? 0) + 1,
                'ws' => $aWon ? ((int) ($rowA['win_streak'] ?? 0) + 1) : 0,
                'seq' => $seq,
                'updated' => $updatedAt,
                'fid' => $factionA,
            ],
        );

        $this->database->execute(
            'UPDATE faction_elo_ratings
             SET elo_rating = :elo, mmr_band = :band, wins = :wins, losses = :losses,
                 matches_played = :mp, win_streak = :ws, seq = :seq, updated_at = :updated
             WHERE faction_id = :fid',
            [
                'elo' => $calc['nextRatingB'],
                'band' => self::resolveMmrBand($calc['nextRatingB']),
                'wins' => (int) ($rowB['wins'] ?? 0) + ($aWon ? 0 : 1),
                'losses' => (int) ($rowB['losses'] ?? 0) + ($aWon ? 1 : 0),
                'mp' => (int) ($rowB['matches_played'] ?? 0) + 1,
                'ws' => $aWon ? 0 : ((int) ($rowB['win_streak'] ?? 0) + 1),
                'seq' => $seq,
                'updated' => $updatedAt,
                'fid' => $factionB,
            ],
        );

        return [
            'factionA' => $factionA,
            'factionB' => $factionB,
            'ratingABefore' => $ratingA,
            'ratingAAfter' => $calc['nextRatingA'],
            'deltaA' => $calc['deltaA'],
            'ratingBBefore' => $ratingB,
            'ratingBAfter' => $calc['nextRatingB'],
            'deltaB' => $calc['deltaB'],
            'kFactor' => self::ELO_K_FACTOR,
        ];
    }

    private function bumpSyncSeq(int $nowSec): int
    {
        $updatedAt = gmdate('c', $nowSec);
        $this->database->execute(
            "UPDATE faction_war_sync_state SET current_seq = current_seq + 1, updated_at = :upd WHERE scope = 'global'",
            ['upd' => $updatedAt],
        );
        return $this->currentSyncSeq();
    }

    private function currentSyncSeq(): int
    {
        $row = $this->database->fetchOne("SELECT current_seq FROM faction_war_sync_state WHERE scope = 'global'");
        return max(1, (int) ($row['current_seq'] ?? 1));
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatDistrictRow(array $row, float $nowFloat): array
    {
        $did = (string) $row['district_id'];
        $spec = self::DISTRICTS[$did] ?? self::DISTRICTS['center'];
        $owner = (string) $row['owner_faction_id'];
        $control = $this->decodeControlMap((string) $row['control_json'], $owner);
        $ownerMeta = self::DEFAULT_FACTIONS[$owner] ?? ['nameEn' => ucfirst($owner), 'nameAr' => $owner, 'color' => '#d99332'];
        $chainWin = self::evaluateLagCompensatedChainWindow($nowFloat, (int) $row['chain_expires_at'], null);

        return [
            'id' => $did,
            'nameEn' => $spec['nameEn'],
            'nameAr' => $spec['nameAr'],
            'hexQ' => $spec['hexQ'],
            'hexR' => $spec['hexR'],
            'mapX' => $spec['mapX'],
            'mapY' => $spec['mapY'],
            'neighbors' => $spec['neighbors'],
            'perkEn' => $spec['perkEn'],
            'perkAr' => $spec['perkAr'],
            'ownerFactionId' => $owner,
            'ownerNameEn' => $ownerMeta['nameEn'],
            'ownerNameAr' => $ownerMeta['nameAr'],
            'ownerColor' => $ownerMeta['color'],
            'ownerControlPct' => (int) ($control[$owner] ?? 0),
            'controlMap' => $control,
            'fortifyShield' => (int) $row['fortify_shield'],
            'heatLevel' => (int) $row['heat_level'],
            'contested' => ((int) $row['contested']) === 1,
            'chainCount' => $chainWin['active'] ? (int) $row['chain_count'] : 0,
            'chainActive' => $chainWin['active'],
            'chainExpiresAt' => (int) $row['chain_expires_at'],
            'chainRemainingSec' => $chainWin['remainingSec'],
            'seq' => (int) $row['seq'],
            'updatedAt' => (string) $row['updated_at'],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatEloRow(array $row): array
    {
        $fid = (string) $row['faction_id'];
        $spec = self::DEFAULT_FACTIONS[$fid] ?? ['nameEn' => ucfirst($fid), 'nameAr' => $fid, 'color' => '#d99332'];
        return [
            'factionId' => $fid,
            'nameEn' => $spec['nameEn'],
            'nameAr' => $spec['nameAr'],
            'color' => $spec['color'],
            'eloRating' => (int) $row['elo_rating'],
            'mmrBand' => (string) $row['mmr_band'],
            'wins' => (int) $row['wins'],
            'losses' => (int) $row['losses'],
            'matchesPlayed' => (int) $row['matches_played'],
            'winStreak' => (int) $row['win_streak'],
            'seq' => (int) $row['seq'],
            'updatedAt' => (string) $row['updated_at'],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatLobbyRow(array $row, int $nowSec): array
    {
        $slots = json_decode((string) $row['slots_json'], true);
        if (!is_array($slots)) {
            $slots = ['vanguard' => null, 'breacher' => null, 'support' => null];
        }
        $filled = count(array_filter($slots, static fn ($s): bool => $s !== null));
        $fid = (string) $row['faction_id'];
        $oid = (string) $row['opponent_faction_id'];

        return [
            'lobbyId' => (string) $row['lobby_id'],
            'factionId' => $fid,
            'factionNameEn' => self::DEFAULT_FACTIONS[$fid]['nameEn'] ?? ucfirst($fid),
            'factionNameAr' => self::DEFAULT_FACTIONS[$fid]['nameAr'] ?? $fid,
            'opponentFactionId' => $oid,
            'opponentNameEn' => self::DEFAULT_FACTIONS[$oid]['nameEn'] ?? ucfirst($oid),
            'opponentNameAr' => self::DEFAULT_FACTIONS[$oid]['nameAr'] ?? $oid,
            'districtId' => (string) $row['district_id'],
            'leaderPlayerId' => (string) $row['leader_player_id'],
            'status' => (string) $row['status'],
            'matchEloGap' => (int) $row['match_elo_gap'],
            'slots' => $slots,
            'filledSlots' => $filled,
            'maxSlots' => count(self::RAID_SLOTS),
            'seq' => (int) $row['seq'],
            'expiresInSec' => max(0, ((int) $row['expires_at']) - $nowSec),
            'createdAt' => (string) $row['created_at'],
            'updatedAt' => (string) $row['updated_at'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildGlobalChainSummary(string $playerFactionId, float $nowFloat): array
    {
        $rows = $this->database->fetchAll(
            'SELECT district_id, owner_faction_id, chain_count, chain_expires_at FROM faction_war_districts ORDER BY chain_expires_at DESC'
        );
        $bestCount = 0;
        $bestExpires = 0;
        $activeDistrict = 'center';
        foreach ($rows as $r) {
            $exp = (int) $r['chain_expires_at'];
            $cnt = (int) $r['chain_count'];
            if ($exp > $bestExpires && $cnt > 0) {
                $bestExpires = $exp;
                $bestCount = $cnt;
                $activeDistrict = (string) $r['district_id'];
            }
        }
        $win = self::evaluateLagCompensatedChainWindow($nowFloat, $bestExpires, null);

        return [
            'factionId' => $playerFactionId,
            'count' => $win['active'] ? $bestCount : 0,
            'active' => $win['active'],
            'districtId' => $activeDistrict,
            'remainingSec' => $win['remainingSec'],
            'expiresAt' => $bestExpires,
            'multiplier' => round(min(2.0, 1.0 + (($win['active'] ? $bestCount : 0) * 0.04)), 2),
            'lagCompensationWindowMs' => (int) round(self::LAG_COMPENSATION_MAX_SEC * 1000),
        ];
    }

    private function resolvePlayerFactionId(string $playerId): string
    {
        try {
            $row = $this->database->fetchOne(
                'SELECT faction_id FROM faction_members WHERE player_id = :pid',
                ['pid' => $playerId],
            );
            if ($row !== null && is_string($row['faction_id'] ?? null) && $row['faction_id'] !== '') {
                return (string) $row['faction_id'];
            }
        } catch (Throwable) {
            // Standalone unit fixtures without faction_members fall back to player war state or vipers.
        }

        $pRow = $this->database->fetchOne(
            'SELECT faction_id FROM faction_war_player_state WHERE player_id = :pid',
            ['pid' => $playerId],
        );
        if ($pRow !== null && is_string($pRow['faction_id'] ?? null) && $pRow['faction_id'] !== '') {
            return (string) $pRow['faction_id'];
        }

        return 'vipers';
    }

    private function resolveFactionChoice(string $playerId, mixed $requestedFaction): string
    {
        $resolved = $this->resolvePlayerFactionId($playerId);
        if (is_string($requestedFaction)) {
            $clean = strtolower(trim($requestedFaction));
            if (isset(self::DEFAULT_FACTIONS[$clean])) {
                return $clean;
            }
        }
        return $resolved;
    }

    /**
     * @return array<string, mixed>
     */
    private function loadPlayerWarState(string $playerId, string $factionId, int $nowSec): array
    {
        $row = $this->database->fetchOne(
            'SELECT player_id, faction_id, assault_cd_until, fortify_cd_until, raids_executed, fortifies_executed, updated_at
             FROM faction_war_player_state
             WHERE player_id = :pid',
            ['pid' => $playerId],
        );
        if ($row !== null) {
            return $row;
        }

        $fresh = [
            'player_id' => $playerId,
            'faction_id' => $factionId,
            'assault_cd_until' => 0,
            'fortify_cd_until' => 0,
            'raids_executed' => 0,
            'fortifies_executed' => 0,
            'updated_at' => gmdate('c', $nowSec),
        ];
        $this->savePlayerWarState($playerId, $factionId, 0, 0, 0, 0, $nowSec);
        return $fresh;
    }

    private function savePlayerWarState(
        string $playerId,
        string $factionId,
        int $assaultCdUntil,
        int $fortifyCdUntil,
        int $raidsExecuted,
        int $fortifiesExecuted,
        int $nowSec,
    ): void {
        $this->database->execute(
            'INSERT INTO faction_war_player_state (
                player_id, faction_id, assault_cd_until, fortify_cd_until, raids_executed, fortifies_executed, updated_at
             ) VALUES (
                :pid, :fid, :acd, :fcd, :raids, :forts, :updated
             )
             ON CONFLICT (player_id) DO UPDATE SET
                faction_id = EXCLUDED.faction_id,
                assault_cd_until = EXCLUDED.assault_cd_until,
                fortify_cd_until = EXCLUDED.fortify_cd_until,
                raids_executed = EXCLUDED.raids_executed,
                fortifies_executed = EXCLUDED.fortifies_executed,
                updated_at = EXCLUDED.updated_at',
            [
                'pid' => $playerId,
                'fid' => $factionId,
                'acd' => $assaultCdUntil,
                'fcd' => $fortifyCdUntil,
                'raids' => $raidsExecuted,
                'forts' => $fortifiesExecuted,
                'updated' => gmdate('c', $nowSec),
            ],
        );
    }

    private function normalizePlayerId(int|string $playerId): string
    {
        $clean = trim((string) $playerId);
        if ($clean === '' || strlen($clean) > 64 || !preg_match('/^[A-Za-z0-9_-]+$/D', $clean)) {
            throw new InvalidArgumentException('Invalid player identifier for Faction Territory War Service.');
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

if (!class_exists('Zone\\Core\\Game\\FactionTerritoryWarService', false)) {
    class_alias(FactionTerritoryWarService::class, 'Zone\\Core\\Game\\FactionTerritoryWarService');
}
