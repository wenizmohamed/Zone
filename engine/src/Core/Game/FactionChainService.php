<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

final class FactionChainService
{
    public const WINDOW_SECONDS = 300;
    public const MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

    private const META_PREFIX = 'faction-chain-v1:';

    private const ARMORY_ITEMS = [
        'smallkit' => [
            'nameEn' => 'First Aid Kit',
            'nameAr' => 'حقيبة إسعاف أولي',
            'kind' => 'medical',
            'life' => 250,
            'hospReduceSec' => 1800,
            'cooldownSec' => 900,
        ],
        'medkit' => [
            'nameEn' => 'Field Medkit',
            'nameAr' => 'حقيبة طبية ميدانية',
            'kind' => 'medical',
            'life' => 600,
            'hospReduceSec' => 3600,
            'cooldownSec' => 1800,
        ],
        'xanax' => [
            'nameEn' => 'Xanax (250E)',
            'nameAr' => 'زاناكس (+250 طاقة)',
            'kind' => 'drug',
            'energy' => 250,
            'cooldownSec' => 25200,
        ],
        'bloodbag' => [
            'nameEn' => 'Medical Blood Bag',
            'nameAr' => 'كيس دم طبي',
            'kind' => 'medical',
            'life' => 300,
            'hospReduceSec' => 3600,
            'cooldownSec' => 3600,
        ],
    ];

    private readonly Ledger $ledger;
    private readonly ResourceService $resources;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?\Closure $clock = null,
    ) {
        $this->ledger = new Ledger($database);
        $this->resources = new ResourceService($database);
    }

    public static function multiplierForCount(int $count): float
    {
        if ($count <= 0) {
            return 1.0;
        }
        if ($count < 10) {
            return round(1.0 + ($count * 0.02), 2);
        }
        if ($count < 25) {
            return 1.25;
        }
        if ($count < 50) {
            return 1.35;
        }
        if ($count < 100) {
            return 1.45;
        }
        if ($count < 250) {
            return 1.55;
        }
        if ($count < 500) {
            return 1.70;
        }
        if ($count < 1000) {
            return 1.85;
        }
        return 2.0;
    }

    public static function milestoneRespectBonus(int $milestone): int
    {
        return match ($milestone) {
            10 => 25,
            25 => 60,
            50 => 125,
            100 => 250,
            250 => 600,
            500 => 1250,
            1000 => 3000,
            default => 0,
        };
    }

    public function liveMultiplierForPlayer(string $playerId): float
    {
        $membership = $this->playerFaction($playerId);
        if ($membership === null) {
            return 1.0;
        }
        $state = $this->loadFactionState((string) $membership['faction_id']);
        return self::multiplierForCount((int) $state['count']);
    }

    public function hasRetaliationBonus(string $attackerId, string $defenderId): bool
    {
        if ($attackerId === '' || $defenderId === '' || $attackerId === $defenderId) {
            return false;
        }
        $attFaction = $this->playerFaction($attackerId);
        if ($attFaction === null) {
            return false;
        }
        $attFactionId = (string) $attFaction['faction_id'];
        $defFaction = $this->playerFaction($defenderId);
        if ($defFaction !== null && (string) $defFaction['faction_id'] === $attFactionId) {
            return false;
        }

        $now = $this->now();
        $state = $this->loadFactionState($attFactionId);
        $retaliations = is_array($state['retaliationAgainst'] ?? null) ? $state['retaliationAgainst'] : [];
        if (isset($retaliations[$defenderId]) && (int) $retaliations[$defenderId] >= $now) {
            return true;
        }

        $cutoffIso = gmdate('c', $now - self::WINDOW_SECONDS);
        $rows = $this->database->fetchAll(
            "SELECT payload_json, occurred_at FROM event_log WHERE event_name = 'PlayerCombatResolved' AND occurred_at >= :cutoff ORDER BY occurred_at DESC LIMIT 30",
            ['cutoff' => $cutoffIso],
        );
        foreach ($rows as $row) {
            $payload = json_decode((string) ($row['payload_json'] ?? ''), true);
            if (!is_array($payload)) {
                continue;
            }
            if (($payload['playerId'] ?? '') !== $defenderId
                || ($payload['outcome'] ?? '') !== 'won'
                || ($payload['approach'] ?? '') !== 'hosp') {
                continue;
            }
            $victimId = (string) ($payload['defenderId'] ?? $payload['opponentId'] ?? '');
            if ($victimId === '') {
                continue;
            }
            $victimFaction = $this->playerFaction($victimId);
            if ($victimFaction !== null && (string) $victimFaction['faction_id'] === $attFactionId) {
                return true;
            }
        }

        return false;
    }

    public function recordRetaliationWindow(string $hospitalizerId, string $victimId): void
    {
        $victimFaction = $this->playerFaction($victimId);
        if ($victimFaction === null) {
            return;
        }
        $victimFactionId = (string) $victimFaction['faction_id'];
        $hospFaction = $this->playerFaction($hospitalizerId);
        if ($hospFaction !== null && (string) $hospFaction['faction_id'] === $victimFactionId) {
            return;
        }

        $now = $this->now();
        $this->database->transaction(function () use ($victimFactionId, $hospitalizerId, $now): void {
            $this->lockMetaKey(self::META_PREFIX . $victimFactionId);
            $state = $this->loadFactionState($victimFactionId);
            $retaliations = is_array($state['retaliationAgainst'] ?? null) ? $state['retaliationAgainst'] : [];
            foreach ($retaliations as $pid => $exp) {
                if ((int) $exp <= $now) {
                    unset($retaliations[$pid]);
                }
            }
            $retaliations[$hospitalizerId] = $now + self::WINDOW_SECONDS;
            $state['retaliationAgainst'] = $retaliations;
            $this->saveFactionState($victimFactionId, $state);
        });
    }

    public function recordHit(
        string $playerId,
        string $approach,
        string $targetName = 'Opponent',
        float $fairFight = 1.0,
        ?string $defenderId = null,
    ): ?array {
        if ($defenderId !== null && $defenderId !== '' && $approach === 'hosp') {
            $this->recordRetaliationWindow($playerId, $defenderId);
        }
        if (!in_array($approach, ['hosp', 'leave'], true)) {
            return null;
        }
        $membership = $this->playerFaction($playerId);
        if ($membership === null) {
            return null;
        }

        $factionId = (string) $membership['faction_id'];
        $playerRow = $this->database->fetchOne('SELECT username, level FROM players WHERE id = :id', ['id' => $playerId]);
        $username = (string) ($playerRow['username'] ?? 'Operative');
        $now = $this->now();

        return $this->database->transaction(function () use ($factionId, $playerId, $username, $approach, $targetName, $fairFight, $now): array {
            $this->lockMetaKey(self::META_PREFIX . $factionId);
            $state = $this->loadFactionState($factionId);
            $state['count'] = (int) $state['count'] + 1;
            $state['best'] = max((int) $state['best'], $state['count']);
            $state['expiresAt'] = $now + self::WINDOW_SECONDS;

            $milestoneBonus = 0;
            $reached = is_array($state['milestonesReached'] ?? null) ? $state['milestonesReached'] : [];
            if (in_array($state['count'], self::MILESTONES, true) && !in_array($state['count'], $reached, true)) {
                $milestoneBonus = self::milestoneRespectBonus($state['count']);
                $reached[] = $state['count'];
                $state['milestonesReached'] = array_values(array_unique(array_map('intval', $reached)));
                if ($milestoneBonus > 0) {
                    (new FamilyProgressionService($this->database, $this->events))->settle(
                        $playerId,
                        $milestoneBonus,
                        'chain.milestone.' . $state['count'],
                        bin2hex(random_bytes(16)),
                    );
                }
            }

            $multiplier = self::multiplierForCount($state['count']);
            $hitEntry = [
                'count' => $state['count'],
                'playerId' => $playerId,
                'username' => $username,
                'targetName' => $targetName,
                'approach' => $approach,
                'fairFight' => round($fairFight, 2),
                'multiplier' => $multiplier,
                'milestoneBonus' => $milestoneBonus,
                'at' => gmdate('c', $now),
            ];
            $recentHits = is_array($state['recentHits'] ?? null) ? $state['recentHits'] : [];
            array_unshift($recentHits, $hitEntry);
            $state['recentHits'] = array_slice($recentHits, 0, 15);
            $this->saveFactionState($factionId, $state);

            $this->events->publish(new DomainEvent('FactionChainHit', [
                'factionId' => $factionId,
                'playerId' => $playerId,
                'username' => $username,
                'count' => $state['count'],
                'best' => $state['best'],
                'expiresAt' => $state['expiresAt'],
                'multiplier' => $multiplier,
                'milestoneBonus' => $milestoneBonus,
            ]));

            return [
                'factionId' => $factionId,
                'count' => $state['count'],
                'best' => $state['best'],
                'multiplier' => $multiplier,
                'expiresAt' => $state['expiresAt'],
                'remainingSeconds' => self::WINDOW_SECONDS,
                'milestoneBonusRespect' => $milestoneBonus,
            ];
        });
    }

    public function snapshot(string $playerId): array
    {
        $player = $this->requirePlayer($playerId);
        $membership = $this->playerFaction($playerId);
        $now = $this->now();

        if ($membership === null) {
            return [
                'hasFaction' => false,
                'factionId' => null,
                'factionName' => null,
                'role' => null,
                'chain' => $this->formatChainPayload($this->defaultFactionState('unaffiliated'), $now),
                'armory' => [
                    'items' => $this->formatArmoryItems($this->defaultArmoryStock(), []),
                    'stock' => $this->defaultArmoryStock(),
                    'recentLog' => [],
                ],
                'wall' => $this->formatWallPayload($this->defaultWallState('vipers'), $playerId),
                'player' => $player,
                'serverTime' => gmdate('c', $now),
            ];
        }

        $factionId = (string) $membership['faction_id'];
        $state = $this->loadFactionState($factionId);
        $progState = $this->loadProgressionArray($playerId);
        $inv = is_array($progState['inv'] ?? null) ? $progState['inv'] : [];

        return [
            'hasFaction' => true,
            'factionId' => $factionId,
            'factionName' => [
                'en' => (string) $membership['name_en'],
                'ar' => (string) $membership['name_ar'],
            ],
            'role' => (string) $membership['role'],
            'chain' => $this->formatChainPayload($state, $now),
            'armory' => [
                'items' => $this->formatArmoryItems($state['armory'], $inv),
                'stock' => $state['armory'],
                'recentLog' => array_slice(is_array($state['armoryLog'] ?? null) ? $state['armoryLog'] : [], 0, 12),
            ],
            'wall' => $this->formatWallPayload($state['wall'], $playerId),
            'player' => $player,
            'serverTime' => gmdate('c', $now),
        ];
    }

    public function act(string $action, array $payload, string $playerId): array
    {
        $cleanAction = strtolower(trim($action));
        if ($cleanAction === 'armory.withdraw' || $cleanAction === 'armory.lend') {
            $cleanAction = 'armory.use';
        }
        if (!in_array($cleanAction, ['wall.join', 'wall.assault', 'armory.deposit', 'armory.use'], true)) {
            throw new InvalidArgumentException('Unsupported faction chain action: ' . $action);
        }

        return $this->database->playerTransaction($playerId, function () use ($cleanAction, $payload, $playerId): array {
            $this->resources->regenerate($playerId);
            (new TravelService($this->database, $this->events, $this->clock))->assertAvailable($playerId);
            $progression = new ProgressionService($this->database, $this->events);
            $progression->assertNotInPlayerCombat($playerId);
            if (!in_array($cleanAction, ['armory.use'], true)) {
                $progression->assertAvailable($playerId, 'faction');
            }

            $membership = $this->playerFaction($playerId);
            if ($membership === null) {
                throw new RuntimeException('Join a faction before using shared faction chain, armory, or territory wall actions.');
            }
            $factionId = (string) $membership['faction_id'];
            $player = $this->requirePlayer($playerId);
            $this->lockMetaKey(self::META_PREFIX . $factionId);
            $state = $this->loadFactionState($factionId);
            $now = $this->now();
            $correlationId = bin2hex(random_bytes(16));
            $actionResult = ['action' => $cleanAction, 'correlationId' => $correlationId];

            if ($cleanAction === 'armory.deposit') {
                $itemId = strtolower(trim((string) ($payload['itemId'] ?? $payload['id'] ?? '')));
                if (!isset(self::ARMORY_ITEMS[$itemId])) {
                    throw new InvalidArgumentException('Only medical kits, blood bags, and Xanax may be deposited into the Faction Armory.');
                }
                $quantity = $this->parseQuantity($payload['quantity'] ?? null, 50);
                $progRow = $this->loadProgressionRow($playerId);
                $progState = $progRow['state'];
                $owned = (int) ($progState['inv'][$itemId] ?? 0);
                if ($owned < $quantity) {
                    throw new RuntimeException('You do not own enough ' . self::ARMORY_ITEMS[$itemId]['nameEn'] . ' to deposit.');
                }
                $progState['inv'][$itemId] = $owned - $quantity;
                LoadoutService::removeMissing($progState, $itemId);
                $this->saveProgressionRow($playerId, $progState, $progRow['version'] + 1);
                $this->ledger->record($playerId, 'item:' . $itemId, -$quantity, (int) $progState['inv'][$itemId], 'faction.armory.deposit', $correlationId);

                $state['armory'][$itemId] = (int) ($state['armory'][$itemId] ?? 0) + $quantity;
                $this->prependArmoryLog($state, [
                    'type' => 'deposit',
                    'playerId' => $playerId,
                    'username' => (string) $player['username'],
                    'itemId' => $itemId,
                    'quantity' => $quantity,
                    'at' => gmdate('c', $now),
                ]);
                $this->saveFactionState($factionId, $state);
                $actionResult['itemId'] = $itemId;
                $actionResult['quantity'] = $quantity;
                $actionResult['armoryStockAfter'] = $state['armory'][$itemId];
            } elseif ($cleanAction === 'armory.use') {
                $itemId = strtolower(trim((string) ($payload['itemId'] ?? $payload['id'] ?? '')));
                if (!isset(self::ARMORY_ITEMS[$itemId])) {
                    throw new InvalidArgumentException('Unknown Faction Armory supply item.');
                }
                $available = (int) ($state['armory'][$itemId] ?? 0);
                if ($available < 1) {
                    throw new RuntimeException('Faction Armory is out of ' . self::ARMORY_ITEMS[$itemId]['nameEn'] . '.');
                }
                $spec = self::ARMORY_ITEMS[$itemId];
                $progRow = $this->loadProgressionRow($playerId);
                $progState = $progRow['state'];
                if ((int) ($progState['jailUntil'] ?? 0) > $now * 1000) {
                    throw new RuntimeException('Cannot draw Faction Armory supplies while in jail.');
                }
                $progState['cooldowns'] = is_array($progState['cooldowns'] ?? null)
                    ? $progState['cooldowns']
                    : ['drugUntil' => 0, 'medicalUntil' => 0, 'boosterUntil' => 0, 'overdoseCount' => 0];
                $nowMs = $now * 1000;

                if ($spec['kind'] === 'drug') {
                    if ((int) ($progState['cooldowns']['drugUntil'] ?? 0) > $nowMs) {
                        throw new RuntimeException('Drug cooldown is active. Wait before taking Armory Xanax.');
                    }
                    $progState['cooldowns']['drugUntil'] = $nowMs + ((int) $spec['cooldownSec'] * 1000);
                    $progState['addiction'] = (int) ($progState['addiction'] ?? 0) + 2;
                    $progState['tornState'] = is_array($progState['tornState'] ?? null) ? $progState['tornState'] : [];
                    $progState['tornState']['addiction'] = $progState['addiction'];
                    $newEnergy = min(1000, (int) $player['energy'] + (int) $spec['energy']);
                    $this->database->execute('UPDATE players SET energy = :energy WHERE id = :id', ['energy' => $newEnergy, 'id' => $playerId]);
                    $actionResult['energyRestored'] = $newEnergy - (int) $player['energy'];
                } else {
                    $medRemainingMs = max(0, (int) ($progState['cooldowns']['medicalUntil'] ?? 0) - $nowMs);
                    if ($medRemainingMs >= 21600 * 1000) {
                        throw new RuntimeException('Medical cooldown cap (6h) reached.');
                    }
                    $hospRemainingMs = max(0, (int) ($progState['hospUntil'] ?? 0) - $nowMs);
                    $newLife = min((int) $player['max_life'], (int) $player['life'] + (int) $spec['life']);
                    $hospReduceMs = min($hospRemainingMs, (int) $spec['hospReduceSec'] * 1000);
                    if ($newLife === (int) $player['life'] && $hospReduceMs === 0) {
                        throw new RuntimeException('Your Life is already full and you are not hospitalized.');
                    }
                    $progState['cooldowns']['medicalUntil'] = max($nowMs, (int) ($progState['cooldowns']['medicalUntil'] ?? 0)) + ((int) $spec['cooldownSec'] * 1000);
                    if ($hospReduceMs > 0) {
                        $progState['hospUntil'] = $hospReduceMs >= $hospRemainingMs ? 0 : (int) $progState['hospUntil'] - $hospReduceMs;
                    }
                    $this->database->execute('UPDATE players SET life = :life WHERE id = :id', ['life' => $newLife, 'id' => $playerId]);
                    $actionResult['lifeRestored'] = $newLife - (int) $player['life'];
                    $actionResult['hospitalSecondsReduced'] = (int) ceil($hospReduceMs / 1000);
                }

                $this->saveProgressionRow($playerId, $progState, $progRow['version'] + 1);
                $state['armory'][$itemId] = $available - 1;
                $this->prependArmoryLog($state, [
                    'type' => 'use',
                    'playerId' => $playerId,
                    'username' => (string) $player['username'],
                    'itemId' => $itemId,
                    'quantity' => 1,
                    'at' => gmdate('c', $now),
                ]);
                $this->saveFactionState($factionId, $state);
                $actionResult['itemId'] = $itemId;
                $actionResult['armoryStockAfter'] = $state['armory'][$itemId];
            } elseif ($cleanAction === 'wall.join') {
                if ((int) $player['energy'] < 5) {
                    throw new RuntimeException('Need 5 Energy to take a position on the Territory Wall.');
                }
                if ((int) $player['life'] < 1) {
                    throw new RuntimeException('Recover Life before joining the Territory Wall.');
                }
                $territoryId = isset($payload['territoryId']) && is_string($payload['territoryId']) && preg_match('/^ZC-\d{3}$/', $payload['territoryId'])
                    ? $payload['territoryId']
                    : (string) ($state['wall']['territoryId'] ?? 'ZC-046');
                $state['wall']['territoryId'] = $territoryId;

                $this->database->execute('UPDATE players SET energy = energy - 5 WHERE id = :id', ['id' => $playerId]);
                $slots = is_array($state['wall']['slots'] ?? null) ? $state['wall']['slots'] : [];
                $slots = array_values(array_filter($slots, static fn (array $s): bool => ($s['playerId'] ?? '') !== $playerId));
                array_unshift($slots, [
                    'playerId' => $playerId,
                    'username' => (string) $player['username'],
                    'level' => (int) $player['level'],
                    'side' => 'attacker',
                    'joinedAt' => gmdate('c', $now),
                ]);
                $state['wall']['slots'] = array_slice($slots, 0, 15);
                $state['wall']['attackerScore'] = min(
                    (int) ($state['wall']['targetScore'] ?? 1000),
                    (int) ($state['wall']['attackerScore'] ?? 240) + 25,
                );
                $this->saveFactionState($factionId, $state);
                (new FamilyProgressionService($this->database, $this->events))->settle($playerId, 5, 'wall.join', $correlationId);
                $actionResult['energySpent'] = 5;
                $actionResult['scoreDelta'] = 25;
                $actionResult['respectAwarded'] = 5;
            } elseif ($cleanAction === 'wall.assault') {
                if ((int) $player['energy'] < 25) {
                    throw new RuntimeException('Need 25 Energy to launch a Territory Wall assault.');
                }
                if ((int) $player['life'] < 1) {
                    throw new RuntimeException('Recover Life before assaulting the Territory Wall.');
                }
                $totalStats = max(10, (int) $player['strength'] + (int) $player['defense'] + (int) $player['speed'] + (int) $player['dexterity']);
                $chainMult = self::multiplierForCount((int) $state['count']);
                $push = max(40, min(200, (int) round((40 + log10($totalStats) * 22) * $chainMult)));
                $rivalPush = random_int(8, 28);

                $this->database->execute('UPDATE players SET energy = energy - 25, xp = xp + 15 WHERE id = :id', ['id' => $playerId]);
                (new LevelingService($this->database, $this->ledger, $this->events))->sync($playerId, $correlationId);

                $targetScore = (int) ($state['wall']['targetScore'] ?? 1000);
                $newAttScore = (int) ($state['wall']['attackerScore'] ?? 240) + $push;
                $newDefScore = max(0, (int) ($state['wall']['defenderScore'] ?? 200) + $rivalPush - (int) round($push * 0.35));
                $captured = false;
                $respectAwarded = 12;

                if ($newAttScore >= $targetScore) {
                    $captured = true;
                    $respectAwarded += 100;
                    $state['wall']['captures'] = (int) ($state['wall']['captures'] ?? 0) + 1;
                    $state['wall']['lastCapturedAt'] = gmdate('c', $now);
                    $newAttScore = 300;
                    $newDefScore = 200;
                }
                $state['wall']['attackerScore'] = $newAttScore;
                $state['wall']['defenderScore'] = $newDefScore;
                if ((int) $state['count'] > 0 && (int) $state['expiresAt'] >= $now) {
                    $state['expiresAt'] = $now + self::WINDOW_SECONDS;
                }
                $this->saveFactionState($factionId, $state);
                (new FamilyProgressionService($this->database, $this->events))->settle($playerId, $respectAwarded, 'wall.assault', $correlationId);

                $actionResult['energySpent'] = 25;
                $actionResult['scoreDelta'] = $push;
                $actionResult['captured'] = $captured;
                $actionResult['respectAwarded'] = $respectAwarded;
            }

            $this->events->publish(new DomainEvent('FactionChainAction', [
                'factionId' => $factionId,
                'playerId' => $playerId,
                ...$actionResult,
            ]));

            return [
                ...$this->snapshot($playerId),
                'result' => $actionResult,
            ];
        });
    }

    private function playerFaction(string $playerId): ?array
    {
        return $this->database->fetchOne(
            'SELECT m.faction_id, m.role, f.name_en, f.name_ar, f.color FROM faction_members m JOIN factions f ON f.id = m.faction_id WHERE m.player_id = :id AND f.enabled = 1',
            ['id' => $playerId],
        );
    }

    private function requirePlayer(string $playerId): array
    {
        $row = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($row === null) {
            throw new RuntimeException('Unknown player: ' . $playerId);
        }
        return $this->resources->normalize($row);
    }

    private function defaultArmoryStock(): array
    {
        return [
            'smallkit' => 10,
            'medkit' => 6,
            'xanax' => 2,
            'bloodbag' => 4,
        ];
    }

    private function defaultWallState(string $factionId): array
    {
        return [
            'territoryId' => 'ZC-046',
            'rivalFactionId' => $factionId === 'kings' ? 'vipers' : 'kings',
            'attackerScore' => 240,
            'defenderScore' => 200,
            'targetScore' => 1000,
            'captures' => 0,
            'lastCapturedAt' => null,
            'slots' => [],
        ];
    }

    private function defaultFactionState(string $factionId): array
    {
        return [
            'factionId' => $factionId,
            'count' => 0,
            'best' => 0,
            'expiresAt' => 0,
            'milestonesReached' => [],
            'recentHits' => [],
            'retaliationAgainst' => [],
            'armory' => $this->defaultArmoryStock(),
            'armoryLog' => [],
            'wall' => $this->defaultWallState($factionId),
        ];
    }

    private function loadFactionState(string $factionId): array
    {
        $key = self::META_PREFIX . $factionId;
        $row = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name', ['name' => $key]);
        $defaults = $this->defaultFactionState($factionId);
        if ($row === null || !isset($row['value'])) {
            return $defaults;
        }
        $decoded = json_decode((string) $row['value'], true);
        if (!is_array($decoded)) {
            return $defaults;
        }
        $state = array_replace($defaults, $decoded);
        $state['armory'] = array_replace($this->defaultArmoryStock(), is_array($decoded['armory'] ?? null) ? $decoded['armory'] : []);
        $state['wall'] = array_replace($this->defaultWallState($factionId), is_array($decoded['wall'] ?? null) ? $decoded['wall'] : []);

        $now = $this->now();
        if ((int) $state['count'] > 0 && (int) $state['expiresAt'] > 0 && $now >= (int) $state['expiresAt']) {
            $state['count'] = 0;
            $state['expiresAt'] = 0;
            $state['milestonesReached'] = [];
        }
        return $state;
    }

    private function saveFactionState(string $factionId, array $state): void
    {
        $key = self::META_PREFIX . $factionId;
        $encoded = json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $this->database->execute(
            'INSERT INTO engine_metadata (name, value) VALUES (:name, :value) ON CONFLICT (name) DO UPDATE SET value = :updated',
            ['name' => $key, 'value' => $encoded, 'updated' => $encoded],
        );
    }

    private function formatChainPayload(array $state, int $now): array
    {
        $count = max(0, (int) ($state['count'] ?? 0));
        $expiresAt = max(0, (int) ($state['expiresAt'] ?? 0));
        $remaining = ($count > 0 && $expiresAt > $now) ? ($expiresAt - $now) : 0;
        if ($remaining === 0 && $count > 0) {
            $count = 0;
            $expiresAt = 0;
        }
        $nextMilestone = 1000;
        $prevMilestone = 0;
        foreach (self::MILESTONES as $m) {
            if ($count < $m) {
                $nextMilestone = $m;
                break;
            }
            $prevMilestone = $m;
        }
        $span = max(1, $nextMilestone - $prevMilestone);
        $progressPct = $count >= 1000 ? 100 : (int) min(100, max(0, round(($count - $prevMilestone) / $span * 100)));

        return [
            'count' => $count,
            'best' => max($count, (int) ($state['best'] ?? 0)),
            'multiplier' => self::multiplierForCount($count),
            'active' => $count > 0 && $remaining > 0,
            'expiresAt' => $expiresAt,
            'remainingSeconds' => $remaining,
            'windowSeconds' => self::WINDOW_SECONDS,
            'milestones' => self::MILESTONES,
            'nextMilestone' => $nextMilestone,
            'nextMilestoneBonusRespect' => self::milestoneRespectBonus($nextMilestone),
            'progressToNextPct' => $progressPct,
            'milestonesReached' => array_values(is_array($state['milestonesReached'] ?? null) ? $state['milestonesReached'] : []),
            'recentHits' => array_slice(is_array($state['recentHits'] ?? null) ? $state['recentHits'] : [], 0, 10),
        ];
    }

    /**
     * @param array<string, int> $stock
     * @param array<string, int> $playerInv
     * @return list<array<string, mixed>>
     */
    private function formatArmoryItems(array $stock, array $playerInv): array
    {
        $items = [];
        foreach (self::ARMORY_ITEMS as $id => $spec) {
            $items[] = [
                'id' => $id,
                'nameEn' => $spec['nameEn'],
                'nameAr' => $spec['nameAr'],
                'kind' => $spec['kind'],
                'armoryQty' => max(0, (int) ($stock[$id] ?? 0)),
                'playerOwnedQty' => max(0, (int) ($playerInv[$id] ?? 0)),
                'cooldownSeconds' => (int) $spec['cooldownSec'],
            ];
        }
        return $items;
    }

    private function formatWallPayload(array $wall, string $playerId): array
    {
        $att = max(0, (int) ($wall['attackerScore'] ?? 240));
        $def = max(0, (int) ($wall['defenderScore'] ?? 200));
        $target = max(100, (int) ($wall['targetScore'] ?? 1000));
        $tugPct = ($att + $def) > 0 ? round($att / ($att + $def) * 100, 1) : 50.0;
        $slots = is_array($wall['slots'] ?? null) ? array_values($wall['slots']) : [];
        $joined = false;
        foreach ($slots as $s) {
            if (($s['playerId'] ?? '') === $playerId) {
                $joined = true;
                break;
            }
        }
        return [
            'territoryId' => (string) ($wall['territoryId'] ?? 'ZC-046'),
            'rivalFactionId' => (string) ($wall['rivalFactionId'] ?? 'kings'),
            'attackerScore' => $att,
            'defenderScore' => $def,
            'targetScore' => $target,
            'controlPct' => $tugPct,
            'barPct' => round(min(100.0, ($att / $target) * 100), 1),
            'captures' => (int) ($wall['captures'] ?? 0),
            'lastCapturedAt' => $wall['lastCapturedAt'] ?? null,
            'slots' => $slots,
            'joined' => $joined,
        ];
    }

    private function prependArmoryLog(array &$state, array $entry): void
    {
        $log = is_array($state['armoryLog'] ?? null) ? $state['armoryLog'] : [];
        array_unshift($log, $entry);
        $state['armoryLog'] = array_slice($log, 0, 20);
    }

    private function loadProgressionArray(string $playerId): array
    {
        return $this->loadProgressionRow($playerId)['state'];
    }

    /** @return array{state: array<string, mixed>, version: int} */
    private function loadProgressionRow(string $playerId): array
    {
        (new ProgressionService($this->database, $this->events))->snapshot($playerId);
        $row = $this->database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
        if ($row === null) {
            throw new RuntimeException('Progression state missing for player: ' . $playerId);
        }
        return [
            'state' => json_decode((string) $row['state_json'], true, 512, JSON_THROW_ON_ERROR),
            'version' => (int) $row['version'],
        ];
    }

    private function saveProgressionRow(string $playerId, array $state, int $version): void
    {
        $state['version'] = $version;
        $this->database->execute(
            'UPDATE player_progression SET state_json = :state, version = :version, updated_at = :updated WHERE player_id = :id',
            [
                'state' => json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'version' => $version,
                'updated' => gmdate('c', $this->now()),
                'id' => $playerId,
            ],
        );
    }

    private function now(): int
    {
        return $this->clock === null ? time() : (int) ($this->clock)();
    }

    private function parseQuantity(mixed $raw, int $max): int
    {
        if ($raw === null) {
            return 1;
        }
        if (is_int($raw)) {
            $qty = $raw;
        } elseif (is_string($raw) && preg_match('/^\d+$/', trim($raw)) === 1) {
            $qty = (int) trim($raw);
        } else {
            throw new InvalidArgumentException(sprintf('Armory deposit quantity must be a whole integer between 1 and %d.', $max));
        }
        if ($qty < 1 || $qty > $max) {
            throw new InvalidArgumentException(sprintf('Armory deposit quantity must be between 1 and %d.', $max));
        }
        return $qty;
    }

    private function lockMetaKey(string $name, string $defaultRaw = '{}'): void
    {
        $this->database->insertIgnore('engine_metadata', ['name', 'value'], [$name, $defaultRaw]);
        if ($this->database->driver() === 'sqlite') {
            $this->database->execute('UPDATE engine_metadata SET value = value WHERE name = :name', ['name' => $name]);
        } else {
            $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name FOR UPDATE', ['name' => $name]);
        }
    }
}
