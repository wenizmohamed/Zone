<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/** Shared respect is earned or explicitly contributed, never inferred from legacy personal balances. */
final readonly class FamilyProgressionService
{
    public function __construct(private Database $database, private EventBus $events) {}

    public function snapshot(string $playerId): ?array
    {
        $membership = $this->database->fetchOne('SELECT m.faction_id, m.role, f.name_en, f.name_ar FROM faction_members m JOIN factions f ON f.id = m.faction_id WHERE m.player_id = :id AND f.enabled = 1', ['id' => $playerId]);
        if ($membership === null) return null;
        $id = (string) $membership['faction_id'];
        $this->database->insertIgnore('family_progression', ['faction_id', 'respect', 'upgrades_json', 'version', 'updated_at'], [$id, 0, '{}', 1, gmdate('c')]);
        $account = $this->database->fetchOne('SELECT * FROM family_progression WHERE faction_id = :id', ['id' => $id]);
        $ledger = $this->database->fetchAll('SELECT l.player_id, p.username, l.delta, l.balance, l.reason, l.created_at FROM family_respect_ledger l JOIN players p ON p.id = l.player_id WHERE l.faction_id = :id ORDER BY l.created_at DESC, l.id DESC LIMIT 20', ['id' => $id]);
        $contributions = $this->database->fetchAll('SELECT l.player_id, p.username, SUM(l.delta) AS respect FROM family_respect_ledger l JOIN players p ON p.id = l.player_id WHERE l.faction_id = :id AND l.delta > 0 GROUP BY l.player_id, p.username ORDER BY respect DESC, l.player_id', ['id' => $id]);
        $leadership = $this->database->fetchOne("SELECT COUNT(*) AS total FROM faction_members WHERE faction_id = :id AND role IN ('leader', 'officer')", ['id' => $id]);
        $membersCount = (int) $this->database->fetchOne('SELECT COUNT(*) AS total FROM faction_members WHERE faction_id = :id', ['id' => $id])['total'];
        $upgrades = json_decode($account['upgrades_json'], true, 512, JSON_THROW_ON_ERROR);
        $totalContributed = array_sum(array_map(static fn ($r): int => (int) $r['respect'], $contributions));
        return [
            'id' => $id, 'name' => ['en' => $membership['name_en'], 'ar' => $membership['name_ar']], 'role' => $membership['role'],
            'respect' => (int) $account['respect'], 'version' => (int) $account['version'], 'upgrades' => $upgrades,
            'memberCount' => $membersCount, 'upgradeCount' => count(array_filter($upgrades)),
            'permissions' => ['contribute' => true, 'buyUpgrade' => in_array($membership['role'], ['leader', 'officer'], true)],
            'leadershipMissing' => (int) $leadership['total'] === 0,
            'ledger' => array_map(static fn ($r) => ['playerId' => $r['player_id'], 'username' => $r['username'], 'delta' => (int) $r['delta'], 'balance' => (int) $r['balance'], 'reason' => $r['reason'], 'at' => $r['created_at']], $ledger),
            'contributions' => array_map(static fn ($r) => ['playerId' => $r['player_id'], 'username' => $r['username'], 'respect' => (int) $r['respect'], 'sharePct' => $totalContributed > 0 ? (int) round((int) $r['respect'] / $totalContributed * 100) : 0], $contributions),
        ];
    }

    /** Caller owns its player lock. Lock only the family account, never other player rows. */
    public function settle(string $playerId, int $delta, string $reason, string $correlationId, ?int $expectedVersion = null, ?string $upgradeId = null): array
    {
        $family = $this->snapshot($playerId);
        if ($family === null) throw new RuntimeException('Join a family before contributing or buying shared upgrades.');
        $id = $family['id'];
        $account = $this->database->fetchOne('SELECT * FROM family_progression WHERE faction_id = :id' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''), ['id' => $id]);
        if ($expectedVersion !== null && (int) $account['version'] !== $expectedVersion) throw new RuntimeException('Family state changed. Refresh and try again.');
        $upgrades = json_decode($account['upgrades_json'], true, 512, JSON_THROW_ON_ERROR);
        if ($upgradeId !== null) {
            if (!$family['permissions']['buyUpgrade']) throw new RuntimeException('Only a family leader or officer can buy shared upgrades.');
            if (!empty($upgrades[$upgradeId])) throw new RuntimeException('This shared upgrade is already owned.');
            $upgrades[$upgradeId] = 1;
        }
        $balance = (int) $account['respect'] + $delta;
        if ($balance < 0) throw new RuntimeException('Not enough shared family respect.');
        $this->database->execute('UPDATE family_progression SET respect = :respect, upgrades_json = :upgrades, version = version + 1, updated_at = :at WHERE faction_id = :id', ['respect' => $balance, 'upgrades' => json_encode($upgrades, JSON_THROW_ON_ERROR), 'at' => gmdate('c'), 'id' => $id]);
        $this->database->execute('INSERT INTO family_respect_ledger (id, faction_id, player_id, delta, balance, reason, correlation_id, created_at) VALUES (:id, :family, :player, :delta, :balance, :reason, :correlation, :at)', ['id' => bin2hex(random_bytes(16)), 'family' => $id, 'player' => $playerId, 'delta' => $delta, 'balance' => $balance, 'reason' => $reason, 'correlation' => $correlationId, 'at' => gmdate('c')]);
        $this->events->publish(new DomainEvent('FamilyRespectChanged', ['playerId' => $playerId, 'factionId' => $id, 'delta' => $delta, 'balance' => $balance, 'reason' => $reason, 'upgradeId' => $upgradeId, 'correlationId' => $correlationId]));
        return $this->snapshot($playerId);
    }

    public function factionRespect(string $factionId): int
    {
        $row = $this->database->fetchOne('SELECT respect FROM family_progression WHERE faction_id = :id', ['id' => $factionId]);
        return (int) ($row['respect'] ?? 0);
    }
}
