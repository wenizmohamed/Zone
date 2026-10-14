<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/** Real rosters, server clocks and atomic cooperative settlements. */
final readonly class FamilyActivityService
{
    public function __construct(private Database $database, private EventBus $events) {}

    public function definitions(): array
    {
        return [
            ['id' => 'dock-intercept', 'name' => ['en' => 'Dock intercept', 'ar' => 'اعتراض شحنة الميناء'], 'requiredMembers' => 2, 'energyCost' => 10, 'cashReward' => 1200, 'respectReward' => 20, 'durationSeconds' => 300, 'cooldownSeconds' => 300],
            ['id' => 'warehouse-heist', 'name' => ['en' => 'Warehouse heist', 'ar' => 'عملية المستودع'], 'requiredMembers' => 3, 'energyCost' => 15, 'cashReward' => 3000, 'respectReward' => 45, 'durationSeconds' => 300, 'cooldownSeconds' => 300],
        ];
    }

    /** Reads never resolve an operation or acquire another participant's lock. */
    public function snapshot(string $playerId): array
    {
        $player = $this->player($playerId);
        $family = $this->membership($playerId);
        $operations = [];
        $cooldown = 0;
        $active = false;
        if ($family !== null) {
            $rows = $this->database->fetchAll('SELECT * FROM family_operations WHERE faction_id = :family ORDER BY created_at DESC, id DESC LIMIT 20', ['family' => $family['id']]);
            foreach ($rows as $row) {
                $operations[] = $this->operationView($row, $playerId, $family, $player);
                if (in_array($row['state'], ['forming', 'running'], true)) $active = true;
                if ($row['completed_at'] !== null) $cooldown = max($cooldown, ((int) strtotime($row['completed_at']) + 300) * 1000);
            }
        }
        $createReason = $family === null ? 'family_required' : ($family['role'] !== 'leader' ? 'leader_required' : ($active ? 'operation_active' : ($cooldown > time() * 1000 ? 'cooldown' : '')));
        return ['serverNow' => time() * 1000, 'family' => $family, 'definitions' => $this->definitions(), 'operations' => $operations, 'createReason' => $createReason,
            'permissions' => ['create' => $createReason === ''],
            'cooldownUntil' => $cooldown, 'competition' => $this->competition($family['id'] ?? null)];
    }

    /** For create, operationId names a server definition and expectedVersion is 1. */
    public function act(string $action, string $operationId, int $expectedVersion, string $playerId): array
    {
        if (!in_array($action, ['create', 'join', 'leave', 'start', 'cancel', 'resolve'], true) || $expectedVersion < 1) throw new InvalidArgumentException('Invalid family operation action or version.');
        $rosterAction = in_array($action, ['start', 'cancel', 'resolve'], true);
        $discovered = $rosterAction ? $this->participants($operationId) : [];
        $creator = $action !== 'create' ? $this->database->fetchOne('SELECT created_by FROM family_operations WHERE id = :id', ['id' => $operationId]) : null;
        // The creator can be outside the paid roster. Every roster action must
        // include that persistent player reference before locking shared rows,
        // including join/leave whose version update touches the same operation.
        $ids = array_values(array_unique([$playerId, ...array_column($discovered, 'player_id'), ...($creator === null ? [] : [$creator['created_by']])]));
        sort($ids, SORT_STRING);
        return $this->database->playersTransaction($ids, function () use ($action, $operationId, $expectedVersion, $playerId, $discovered, $creator, $rosterAction): array {
            $family = $this->membership($playerId);
            if ($family === null) throw new RuntimeException('Join a family before taking part in family operations.');
            $operation = null;
            if ($action !== 'create') {
                $operation = $this->database->fetchOne('SELECT * FROM family_operations WHERE id = :id' . $this->lock(), ['id' => $operationId]);
                if ($operation === null || $operation['faction_id'] !== $family['id']) throw new RuntimeException('This operation does not belong to your family.');
                if ($creator === null || $operation['created_by'] !== $creator['created_by']) throw new RuntimeException('Operation creator changed. Refresh and try again.');
                if ((int) $operation['version'] !== $expectedVersion) throw new RuntimeException('Operation changed. Refresh and try again.');
                if (!in_array($operation['state'], ['forming', 'running'], true)) throw new RuntimeException('This operation has already ended.');
            }
            // All player locks precede family/operation locks. Never acquire a
            // newly discovered participant here: a changed roster must retry.
            $this->database->fetchOne('SELECT id FROM factions WHERE id = :id' . $this->lock(), ['id' => $family['id']]);
            $members = $operation === null ? [] : $this->participants($operationId);
            if (in_array($action, ['start', 'cancel', 'resolve'], true) && array_column($members, 'player_id') !== array_column($discovered, 'player_id')) throw new RuntimeException('Operation roster changed. Refresh and try again.');
            $leader = $family['role'] === 'leader';
            $correlation = bin2hex(random_bytes(16));
            $result = ['action' => $action, 'operationId' => $operationId];
            if ($action === 'create') {
                if (!$leader) throw new RuntimeException('Only the family leader can create an operation.');
                if ($expectedVersion !== 1) throw new RuntimeException('Operation changed. Refresh and try again.');
                $definition = $this->definition($operationId);
                $this->assertCreationReady($family['id']);
                $operationId = bin2hex(random_bytes(16));
                $this->database->execute("INSERT INTO family_operations (id, faction_id, definition_id, state, version, created_by, created_at, ready_at, completed_at) VALUES (:id, :family, :definition, 'forming', 1, :actor, :at, 0, NULL)", ['id' => $operationId, 'family' => $family['id'], 'definition' => $definition['id'], 'actor' => $playerId, 'at' => gmdate('c')]);
                $result['operationId'] = $operationId;
            } else {
                $definition = $this->definition($operation['definition_id']);
                $joined = array_values(array_filter($members, static fn ($m) => $m['player_id'] === $playerId))[0] ?? null;
                if ($action === 'join') {
                    if ($operation['state'] !== 'forming') throw new RuntimeException('This operation has already started.');
                    if ($joined !== null) throw new RuntimeException('You have already joined this operation.');
                    if (count($members) >= $definition['requiredMembers']) throw new RuntimeException('This operation roster is full.');
                    if ($this->database->fetchOne("SELECT m.player_id FROM family_operation_members m JOIN family_operations o ON o.id = m.operation_id WHERE m.player_id = :player AND o.state IN ('forming', 'running')", ['player' => $playerId]) !== null) throw new RuntimeException('Finish or leave your current operation first.');
                    (new ProgressionService($this->database, $this->events))->assertAvailable($playerId);
                    (new TravelService($this->database, $this->events))->assertAvailable($playerId);
                    $player = (new ResourceService($this->database))->regenerate($playerId);
                    if ($player['energy'] < $definition['energyCost']) throw new RuntimeException('Not enough energy to join this operation.');
                    $this->database->execute('UPDATE players SET energy = energy - :cost WHERE id = :id', ['cost' => $definition['energyCost'], 'id' => $playerId]);
                    $this->database->execute('INSERT INTO family_operation_members (operation_id, player_id, energy_cost, joined_at) VALUES (:operation, :player, :cost, :at)', ['operation' => $operationId, 'player' => $playerId, 'cost' => $definition['energyCost'], 'at' => gmdate('c')]);
                    (new Ledger($this->database))->record($playerId, 'energy', -$definition['energyCost'], $player['energy'] - $definition['energyCost'], 'family.operation.join', $correlation);
                    $result['energyDelta'] = -(int) $definition['energyCost'];
                } elseif ($action === 'leave') {
                    if ($operation['state'] !== 'forming' || $joined === null) throw new RuntimeException('Only a registered participant can leave before the operation starts.');
                    $this->refund($joined, $correlation);
                    $result['energyDelta'] = (int) $joined['energy_cost'];
                    $this->database->execute('DELETE FROM family_operation_members WHERE operation_id = :operation AND player_id = :player', ['operation' => $operationId, 'player' => $playerId]);
                } elseif ($action === 'cancel') {
                    if (!$leader || $operation['state'] !== 'forming') throw new RuntimeException('Only the leader can cancel a forming operation.');
                    foreach ($members as $member) $this->refund($member, $correlation);
                    $result['energyRefunds'] = array_map(static fn ($member) => ['playerId' => $member['player_id'], 'energy' => (int) $member['energy_cost']], $members);
                    $this->database->execute("UPDATE family_operations SET state = 'cancelled', completed_at = :at WHERE id = :id", ['at' => gmdate('c'), 'id' => $operationId]);
                } elseif ($action === 'start') {
                    if (!$leader || $operation['state'] !== 'forming') throw new RuntimeException('Only the leader can start a forming operation.');
                    if (count($members) !== $definition['requiredMembers']) throw new RuntimeException('Recruit the required number of real family members first.');
                    $this->assertRoster($members, $family['id']);
                    foreach ($members as $member) {
                        (new ProgressionService($this->database, $this->events))->assertAvailable($member['player_id']);
                        (new TravelService($this->database, $this->events))->assertAvailable($member['player_id']);
                    }
                    $this->database->execute("UPDATE family_operations SET state = 'running', ready_at = :ready WHERE id = :id", ['ready' => (time() + $definition['durationSeconds']) * 1000, 'id' => $operationId]);
                } else {
                    if ($operation['state'] !== 'running' || (int) $operation['ready_at'] > time() * 1000) throw new RuntimeException('This operation is not ready to resolve.');
                    if (count($members) !== $definition['requiredMembers']) throw new RuntimeException('Operation roster changed. Refresh and try again.');
                    $this->assertRoster($members, $family['id']);
                    $share = intdiv($definition['cashReward'], count($members));
                    foreach ($members as $member) {
                        $this->database->execute('UPDATE players SET cash = cash + :share WHERE id = :id', ['share' => $share, 'id' => $member['player_id']]);
                        $balance = (int) $this->player($member['player_id'])['cash'];
                        (new Ledger($this->database))->record($member['player_id'], 'cash', $share, $balance, 'family.operation.reward', $correlation);
                    }
                    (new FamilyProgressionService($this->database, $this->events))->settle($playerId, $definition['respectReward'], 'operation.' . $definition['id'], $correlation);
                    $this->database->execute("UPDATE family_operations SET state = 'completed', completed_at = :at WHERE id = :id", ['at' => gmdate('c'), 'id' => $operationId]);
                    $this->recordCompetition($playerId, 'operation', $operationId);
                    $result += ['cashPerMember' => $share, 'respectDelta' => $definition['respectReward'], 'participants' => array_column($members, 'player_id')];
                    $this->events->publish(new DomainEvent('OperationResolved', ['playerId' => $playerId, 'operationId' => $operationId, 'factionId' => $family['id'], 'correlationId' => $operationId, 'cashPerMember' => $share, 'respectDelta' => $definition['respectReward']]));
                }
                $this->database->execute('UPDATE family_operations SET version = version + 1 WHERE id = :id', ['id' => $operationId]);
            }
            return $this->snapshot($playerId) + ['result' => $result, 'player' => (new ResourceService($this->database))->normalize($this->player($playerId))];
        });
    }

    /** Called by successful authoritative mechanics, never from a score POST. */
    public function recordCompetition(string $playerId, string $kind, string $correlationId): void
    {
        $points = ['player-hospitalize' => 10, 'territory-assault' => 1, 'operation' => 5];
        if (!isset($points[$kind]) || $correlationId === '') throw new InvalidArgumentException('Invalid competition contribution.');
        $this->database->playerTransaction($playerId, function () use ($playerId, $kind, $correlationId, $points): void {
            $family = $this->membership($playerId);
            if ($family === null) return;
            $season = $this->season();
            $id = hash('sha256', $kind . ':' . $correlationId);
            $verb = $this->database->driver() === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT';
            $suffix = $this->database->driver() === 'pgsql' ? ' ON CONFLICT DO NOTHING' : '';
            $inserted = $this->database->execute("{$verb} INTO family_competition_events (id, season_id, faction_id, player_id, kind, score, created_at) VALUES (:id, :season, :family, :player, :kind, :score, :at){$suffix}", ['id' => $id, 'season' => $season['seasonId'], 'family' => $family['id'], 'player' => $playerId, 'kind' => $kind, 'score' => $points[$kind], 'at' => gmdate('c')]);
            if ($inserted === 0) return;
            $this->database->insertIgnore('family_competition_scores', ['season_id', 'faction_id', 'score', 'version', 'updated_at'], [$season['seasonId'], $family['id'], 0, 1, gmdate('c')]);
            $this->database->execute('UPDATE family_competition_scores SET score = score + :score, version = version + 1, updated_at = :at WHERE season_id = :season AND faction_id = :family', ['score' => $points[$kind], 'at' => gmdate('c'), 'season' => $season['seasonId'], 'family' => $family['id']]);
        });
    }

    private function competition(?string $familyId): array
    {
        $season = $this->season();
        $rows = $this->database->fetchAll('SELECT f.id, f.name_en, f.name_ar, f.color, COALESCE(s.score, 0) AS score, COALESCE(s.version, 1) AS version, (SELECT COUNT(*) FROM faction_members m WHERE m.faction_id = f.id) AS members FROM factions f LEFT JOIN family_competition_scores s ON s.faction_id = f.id AND s.season_id = :season WHERE f.enabled = 1 ORDER BY score DESC, f.id', ['season' => $season['seasonId']]);
        $rank = 0; $previous = null;
        $ranks = [];
        foreach ($rows as $index => $row) {
            if ($previous !== (int) $row['score']) $rank = $index + 1;
            $previous = (int) $row['score'];
            $ranks[] = ['rank' => $rank, 'factionId' => $row['id'], 'name' => ['en' => $row['name_en'], 'ar' => $row['name_ar']], 'color' => $row['color'], 'memberCount' => (int) $row['members'], 'score' => $previous, 'version' => (int) $row['version']];
        }
        return $season + ['status' => 'active', 'serverNow' => time() * 1000, 'ownFactionId' => $familyId, 'ranks' => $ranks, 'scoring' => ['player-hospitalize' => 10, 'territory-assault' => 1, 'operation' => 5]];
    }

    private function season(): array
    {
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $start = $now->modify('monday this week')->setTime(0, 0);
        return ['seasonId' => $start->format('o-\WW'), 'startsAt' => $start->getTimestamp() * 1000, 'endsAt' => $start->modify('+7 days')->getTimestamp() * 1000];
    }

    private function operationView(array $row, string $playerId, array $family, array $player): array
    {
        $definition = $this->definition($row['definition_id']);
        $members = $this->participants($row['id']);
        $joined = in_array($playerId, array_column($members, 'player_id'), true);
        $forming = $row['state'] === 'forming'; $leader = $family['role'] === 'leader';
        $joinReason = $this->participationReason($playerId);
        if ($joinReason === '' && (int) $player['energy'] < $definition['energyCost']) $joinReason = 'Not enough energy to join this operation.';
        $rosterReady = count($members) === $definition['requiredMembers'];
        foreach ($members as $member) if (($this->membership($member['player_id'])['id'] ?? null) !== $family['id'] || $this->participationReason($member['player_id']) !== '') $rosterReady = false;
        $reason = '';
        if ($forming) {
            $reason = match ($joinReason) {
                'Finish or clear your player fight before joining an operation.' => 'busy',
                'You must leave jail before this action.' => 'jailed',
                'You must leave jail or hospital before this action.' => 'hospital',
                'You are traveling. Wait for arrival before this action.' => 'traveling',
                'Not enough energy to join this operation.' => 'energy_required',
                default => count($members) < $definition['requiredMembers'] ? 'members_required' : '',
            };
        }
        return ['id' => $row['id'], 'definitionId' => $row['definition_id'], 'name' => $definition['name'], 'state' => $row['state'], 'version' => (int) $row['version'], 'createdBy' => $row['created_by'], 'createdAt' => $row['created_at'], 'readyAt' => (int) $row['ready_at'], 'completedAt' => $row['completed_at'],
            'requiredMembers' => $definition['requiredMembers'], 'energyCost' => $definition['energyCost'], 'cashReward' => $definition['cashReward'], 'respectReward' => $definition['respectReward'], 'payoutPerMember' => intdiv($definition['cashReward'], $definition['requiredMembers']),
            'participants' => array_map(static fn ($m) => ['playerId' => $m['player_id'], 'username' => $m['username'], 'energyCost' => (int) $m['energy_cost'], 'joinedAt' => $m['joined_at']], $members),
            'joinReason' => $joinReason, 'reason' => $reason,
            'permissions' => ['join' => $forming && !$joined && count($members) < $definition['requiredMembers'] && $joinReason === '', 'leave' => $forming && $joined, 'start' => $forming && $leader && $rosterReady, 'cancel' => $forming && $leader, 'resolve' => $row['state'] === 'running' && (int) $row['ready_at'] <= time() * 1000]];
    }

    private function participationReason(string $playerId): string
    {
        if ($this->database->fetchOne('SELECT player_id FROM player_combat_locks WHERE player_id = :id', ['id' => $playerId]) !== null) return 'Finish or clear your player fight before joining an operation.';
        $saved = $this->database->fetchOne('SELECT state_json FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
        $state = $saved === null ? [] : json_decode($saved['state_json'], true, 512, JSON_THROW_ON_ERROR);
        if ((int) ($state['jailUntil'] ?? 0) > time() * 1000) return 'You must leave jail before this action.';
        if ((int) ($state['hospUntil'] ?? 0) > time() * 1000) return 'You must leave jail or hospital before this action.';
        $travel = $this->database->fetchOne('SELECT status, arrives_at FROM player_travel WHERE player_id = :id', ['id' => $playerId]);
        if ($travel !== null && $travel['status'] === 'traveling' && (int) strtotime($travel['arrives_at']) > time()) return 'You are traveling. Wait for arrival before this action.';
        return '';
    }

    private function participants(string $id): array
    {
        return $this->database->fetchAll('SELECT m.*, p.username FROM family_operation_members m JOIN players p ON p.id = m.player_id WHERE m.operation_id = :id ORDER BY m.player_id', ['id' => $id]);
    }

    private function membership(string $playerId): ?array
    {
        $row = $this->database->fetchOne('SELECT m.faction_id, m.role, f.name_en, f.name_ar FROM faction_members m JOIN factions f ON f.id = m.faction_id WHERE m.player_id = :id AND f.enabled = 1', ['id' => $playerId]);
        return $row === null ? null : ['id' => $row['faction_id'], 'role' => $row['role'], 'name' => ['en' => $row['name_en'], 'ar' => $row['name_ar']]];
    }

    private function player(string $id): array
    {
        return $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $id]) ?? throw new RuntimeException('Unknown player.');
    }

    private function definition(string $id): array
    {
        foreach ($this->definitions() as $definition) if ($definition['id'] === $id) return $definition;
        throw new InvalidArgumentException('Unknown family operation definition.');
    }

    private function lock(): string { return $this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''; }

    private function assertCreationReady(string $family): void
    {
        if ($this->database->fetchOne("SELECT id FROM family_operations WHERE faction_id = :family AND state IN ('forming', 'running')", ['family' => $family]) !== null) throw new RuntimeException('Finish or cancel the active family operation first.');
        $latest = $this->database->fetchOne('SELECT completed_at FROM family_operations WHERE faction_id = :family AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1', ['family' => $family]);
        if ($latest !== null && (int) strtotime($latest['completed_at']) + 300 > time()) throw new RuntimeException('Your family operation cooldown is still active.');
    }

    private function assertRoster(array $members, string $family): void
    {
        foreach ($members as $member) if (($this->membership($member['player_id'])['id'] ?? null) !== $family) throw new RuntimeException('An operation participant is no longer in this family.');
    }

    private function refund(array $member, string $correlation): void
    {
        // Refund the exact committed amount, including over-cap energy earned
        // while forming; applying a cap here would silently confiscate it.
        $cost = (int) $member['energy_cost'];
        $this->database->execute('UPDATE players SET energy = energy + :cost WHERE id = :id', ['cost' => $cost, 'id' => $member['player_id']]);
        (new Ledger($this->database))->record($member['player_id'], 'energy', $cost, (int) $this->player($member['player_id'])['energy'], 'family.operation.refund', $correlation);
    }
}
