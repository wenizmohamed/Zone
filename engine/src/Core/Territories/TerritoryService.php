<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Territories;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

final class TerritoryService
{
    private const NEUTRAL_COLOR = '#68717b';

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
    ) {
    }

    public function snapshot(string $playerId): array
    {
        $factions = $this->database->fetchAll(
            'SELECT id, name_en, name_ar, color FROM factions WHERE enabled = 1 ORDER BY id',
        );
        $factionById = [];
        foreach ($factions as $faction) {
            $factionById[(string) $faction['id']] = $faction;
        }
        $membership = $this->database->fetchOne(
            'SELECT faction_id, role FROM faction_members WHERE player_id = :player',
            ['player' => $playerId],
        );
        $playerFactionId = $membership === null ? null : (string) $membership['faction_id'];

        $rows = $this->database->fetchAll(
            'SELECT b.*, c.faction_id, c.state, c.control_basis_points, c.version, c.captured_at, c.updated_at
             FROM territory_blocks b
             JOIN territory_control c ON c.territory_id = b.id
             WHERE b.enabled = 1
             ORDER BY b.id',
        );
        $ownedIds = [];
        foreach ($rows as $row) {
            if ($playerFactionId !== null && (string) ($row['faction_id'] ?? '') === $playerFactionId) {
                $ownedIds[(string) $row['id']] = true;
            }
        }
        $activeWars = [];
        foreach ($this->database->fetchAll("SELECT * FROM territory_wars WHERE state = 'active'") as $war) {
            $activeWars[(string) $war['territory_id']] = $war;
        }

        $blocks = [];
        foreach ($rows as $row) {
            $neighbors = $this->decodeJsonArray($row['neighbors_json']);
            $ownerId = $row['faction_id'] === null ? null : (string) $row['faction_id'];
            $owner = $ownerId === null ? null : ($factionById[$ownerId] ?? null);
            $eligibility = $this->eligibility($row, $neighbors, $ownedIds, $playerFactionId);
            $blocks[] = [
                'id' => (string) $row['id'],
                'districtId' => (string) $row['district_id'],
                'name' => ['en' => (string) $row['name_en'], 'ar' => (string) $row['name_ar']],
                'polygon' => $this->decodeJsonArray($row['polygon_json']),
                'centroid' => $this->decodeJsonArray($row['centroid_json']),
                'neighbors' => $neighbors,
                'sector' => (int) $row['sector'],
                'size' => (int) $row['size_tier'],
                'density' => (int) $row['density_tier'],
                'slots' => (int) $row['wall_slots'],
                'dailyRespect' => (int) $row['daily_respect'],
                'benefits' => [[
                    'key' => (string) $row['benefit_key'],
                    'name' => ['en' => (string) $row['benefit_name_en'], 'ar' => (string) $row['benefit_name_ar']],
                    'value' => (int) $row['benefit_value'],
                    'unit' => (string) $row['benefit_unit'],
                ]],
                'ownerFactionId' => $ownerId,
                'ownerName' => $owner === null ? ['en' => 'Unclaimed', 'ar' => 'غير مملوك'] : ['en' => (string) $owner['name_en'], 'ar' => (string) $owner['name_ar']],
                'ownerColor' => $owner === null ? self::NEUTRAL_COLOR : (string) $owner['color'],
                'state' => (string) $row['state'],
                'control' => (int) round((int) $row['control_basis_points'] / 100),
                'version' => (int) $row['version'],
                'capturedAt' => $row['captured_at'],
                'updatedAt' => (string) $row['updated_at'],
                'action' => $eligibility['action'],
                'actionReason' => $eligibility['reason'],
                'activeWar' => isset($activeWars[(string) $row['id']]) ? $this->normalizeWar($activeWars[(string) $row['id']]) : null,
            ];
        }

        $owned = count($ownedIds);
        $contested = count(array_filter($blocks, static fn (array $block): bool => $block['state'] === 'contested'));
        $revision = hash('sha256', json_encode(array_map(
            static fn (array $block): array => [$block['id'], $block['ownerFactionId'], $block['state'], $block['control'], $block['version']],
            $blocks,
        ), JSON_THROW_ON_ERROR));

        return [
            'revision' => $revision,
            'playerFactionId' => $playerFactionId,
            'playerFactionRole' => $membership['role'] ?? null,
            'neutralColor' => self::NEUTRAL_COLOR,
            'factions' => array_map(static fn (array $faction): array => [
                'id' => (string) $faction['id'],
                'name' => ['en' => (string) $faction['name_en'], 'ar' => (string) $faction['name_ar']],
                'color' => (string) $faction['color'],
            ], $factions),
            'blocks' => $blocks,
            'summary' => [
                'total' => count($blocks),
                'ownedByPlayerFaction' => $owned,
                'neutral' => count(array_filter($blocks, static fn (array $block): bool => $block['ownerFactionId'] === null)),
                'contested' => $contested,
                'controlPercent' => count($blocks) === 0 ? 0 : round($owned / count($blocks) * 100, 1),
            ],
        ];
    }

    public function act(string $territoryId, string $action, int $expectedVersion, string $playerId): array
    {
        if (!in_array($action, ['claim', 'assault', 'reinforce'], true)) {
            throw new InvalidArgumentException('Unknown territory action.');
        }

        $membership = $this->database->fetchOne(
            'SELECT faction_id, role FROM faction_members WHERE player_id = :player',
            ['player' => $playerId],
        );
        if ($membership === null) {
            throw new RuntimeException('Join a faction before controlling territory.');
        }
        $factionId = (string) $membership['faction_id'];

        $event = $this->database->transaction(function (Database $database) use ($territoryId, $action, $expectedVersion, $playerId, $factionId): DomainEvent {
            $row = $database->fetchOne(
                'SELECT b.*, c.faction_id, c.state, c.control_basis_points, c.version
                 FROM territory_blocks b JOIN territory_control c ON c.territory_id = b.id
                 WHERE b.id = :id AND b.enabled = 1',
                ['id' => $territoryId],
            );
            if ($row === null) {
                throw new InvalidArgumentException('Unknown territory block.');
            }
            if ((int) $row['version'] !== $expectedVersion) {
                throw new RuntimeException('Territory state changed. Refresh the map and try again.');
            }

            $neighbors = $this->decodeJsonArray($row['neighbors_json']);
            $ownedRows = $database->fetchAll(
                "SELECT territory_id FROM territory_control WHERE faction_id = :faction AND state IN ('owned', 'contested')",
                ['faction' => $factionId],
            );
            $ownedIds = array_fill_keys(array_map(static fn (array $owned): string => (string) $owned['territory_id'], $ownedRows), true);
            $eligibility = $this->eligibility($row, $neighbors, $ownedIds, $factionId);
            if ($eligibility['action'] !== $action) {
                throw new RuntimeException((string) $eligibility['reason']);
            }

            $now = gmdate('c');
            $nextVersion = (int) $row['version'] + 1;
            $previousOwner = $row['faction_id'] === null ? null : (string) $row['faction_id'];
            if ($action === 'claim') {
                $affected = $database->execute(
                    "UPDATE territory_control SET faction_id = :faction, state = 'owned', control_basis_points = 10000, version = :next, captured_at = :captured, updated_at = :updated WHERE territory_id = :id AND version = :expected AND faction_id IS NULL",
                    ['faction' => $factionId, 'next' => $nextVersion, 'captured' => $now, 'updated' => $now, 'id' => $territoryId, 'expected' => $expectedVersion],
                );
                if ($affected !== 1) {
                    throw new RuntimeException('Territory state changed. Refresh the map and try again.');
                }
            } elseif ($action === 'assault') {
                $affected = $database->execute(
                    "UPDATE territory_control SET state = 'contested', control_basis_points = 5000, version = :next, updated_at = :updated WHERE territory_id = :id AND version = :expected AND faction_id = :defender",
                    ['next' => $nextVersion, 'updated' => $now, 'id' => $territoryId, 'expected' => $expectedVersion, 'defender' => $previousOwner],
                );
                if ($affected !== 1 || $previousOwner === null) {
                    throw new RuntimeException('Territory state changed. Refresh the map and try again.');
                }
                $database->insertIgnore(
                    'territory_wars',
                    ['id', 'territory_id', 'attacker_faction_id', 'defender_faction_id', 'attacker_score', 'defender_score', 'target_score', 'state', 'started_at', 'ends_at'],
                    [bin2hex(random_bytes(16)), $territoryId, $factionId, $previousOwner, 0, 0, (int) $row['wall_slots'] * 50000, 'active', $now, gmdate('c', time() + 72 * 3600)],
                );
            } else {
                $newControl = min(10000, (int) $row['control_basis_points'] + 1500);
                $affected = $database->execute(
                    "UPDATE territory_control SET state = 'owned', control_basis_points = :control, version = :next, updated_at = :updated WHERE territory_id = :id AND version = :expected AND faction_id = :faction",
                    ['control' => $newControl, 'next' => $nextVersion, 'updated' => $now, 'id' => $territoryId, 'expected' => $expectedVersion, 'faction' => $factionId],
                );
                if ($affected !== 1) {
                    throw new RuntimeException('Territory state changed. Refresh the map and try again.');
                }
            }

            $event = new DomainEvent('TerritoryControlChanged', [
                'territoryId' => $territoryId,
                'action' => $action,
                'playerId' => $playerId,
                'factionId' => $factionId,
                'previousOwnerFactionId' => $previousOwner,
                'version' => $nextVersion,
            ]);
            $this->events->publish($event);
            return $event;
        });

        return [
            'action' => $action,
            'territoryId' => $territoryId,
            'eventId' => $event->id,
            'map' => $this->snapshot($playerId),
        ];
    }

    public function adminCatalog(string $playerId): array
    {
        return $this->snapshot($playerId);
    }

    /** Sum a live faction's owned-block advantage for a server calculation. */
    public function bonusBasisPoints(string $playerId, string $benefitKey): int
    {
        $row = $this->database->fetchOne(
            "SELECT COALESCE(SUM(b.benefit_value), 0) AS bonus
             FROM faction_members m
             JOIN territory_control c ON c.faction_id = m.faction_id AND c.state = 'owned'
             JOIN territory_blocks b ON b.id = c.territory_id AND b.enabled = 1
             WHERE m.player_id = :player AND b.benefit_key = :benefit",
            ['player' => $playerId, 'benefit' => $benefitKey],
        );
        return max(0, (int) ($row['bonus'] ?? 0));
    }

    public function setOwnership(string $territoryId, ?string $factionId, string $actor): array
    {
        if ($factionId !== null && $this->database->fetchOne('SELECT id FROM factions WHERE id = :id AND enabled = 1', ['id' => $factionId]) === null) {
            throw new InvalidArgumentException('Unknown faction.');
        }
        $current = $this->database->fetchOne('SELECT * FROM territory_control WHERE territory_id = :id', ['id' => $territoryId]);
        if ($current === null) {
            throw new InvalidArgumentException('Unknown territory block.');
        }
        $now = gmdate('c');
        $nextVersion = (int) $current['version'] + 1;
        $this->database->execute(
            'UPDATE territory_control SET faction_id = :faction, state = :state, control_basis_points = :control, version = :version, captured_at = :captured, updated_at = :updated WHERE territory_id = :id',
            ['faction' => $factionId, 'state' => $factionId === null ? 'neutral' : 'owned', 'control' => $factionId === null ? 0 : 10000, 'version' => $nextVersion, 'captured' => $factionId === null ? null : $now, 'updated' => $now, 'id' => $territoryId],
        );
        $correlationId = bin2hex(random_bytes(16));
        $this->database->insertIgnore(
            'admin_audit_log',
            ['id', 'actor', 'action', 'target_type', 'target_id', 'previous_json', 'next_json', 'correlation_id', 'created_at'],
            [bin2hex(random_bytes(16)), $actor, 'territory.ownership.set', 'territory', $territoryId, json_encode($current, JSON_THROW_ON_ERROR), json_encode(['factionId' => $factionId, 'version' => $nextVersion], JSON_THROW_ON_ERROR), $correlationId, $now],
        );
        $this->events->publish(new DomainEvent('TerritoryOwnershipOverridden', ['territoryId' => $territoryId, 'factionId' => $factionId, 'actor' => $actor, 'correlationId' => $correlationId]));
        return $this->snapshot('founder-player');
    }

    /** @param array<string, bool> $ownedIds */
    private function eligibility(array $row, array $neighbors, array $ownedIds, ?string $playerFactionId): array
    {
        if ($playerFactionId === null) {
            return ['action' => null, 'reason' => 'Join a faction to control territory.'];
        }
        $ownerId = $row['faction_id'] === null ? null : (string) $row['faction_id'];
        if ($ownerId === $playerFactionId) {
            return ['action' => 'reinforce', 'reason' => 'Reinforce this faction block.'];
        }
        $hasLand = count($ownedIds) > 0;
        $isAdjacent = count(array_filter($neighbors, static fn (string $id): bool => isset($ownedIds[$id]))) > 0;
        if (!$hasLand && (int) $row['sector'] !== 7) {
            return ['action' => null, 'reason' => 'A first foothold must be claimed in outer Sector 7.'];
        }
        if ($hasLand && !$isAdjacent) {
            return ['action' => null, 'reason' => 'Control an adjacent block before expanding here.'];
        }
        if ($ownerId === null) {
            return ['action' => 'claim', 'reason' => 'This neutral block is connected to your territory.'];
        }
        if ((string) $row['state'] === 'contested') {
            return ['action' => null, 'reason' => 'A territory war is already active on this block.'];
        }
        return ['action' => 'assault', 'reason' => 'This rival block borders your territory.'];
    }

    private function decodeJsonArray(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        $decoded = json_decode((string) $value, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($decoded)) {
            throw new RuntimeException('Invalid territory JSON payload.');
        }
        return $decoded;
    }

    private function normalizeWar(array $war): array
    {
        return [
            'id' => (string) $war['id'],
            'attackerFactionId' => (string) $war['attacker_faction_id'],
            'defenderFactionId' => (string) $war['defender_faction_id'],
            'attackerScore' => (int) $war['attacker_score'],
            'defenderScore' => (int) $war['defender_score'],
            'targetScore' => (int) $war['target_score'],
            'startedAt' => (string) $war['started_at'],
            'endsAt' => (string) $war['ends_at'],
        ];
    }
}
