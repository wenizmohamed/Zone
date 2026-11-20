<?php

declare(strict_types=1);

namespace Zone\Modules\Gangs;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/** Server-owned recruitment, founding, rank hierarchy, and succession. */
final readonly class FactionService
{
    public const SEED_FACTIONS = ['vipers', 'kings', 'night', 'oldguard'];
    public const CREATE_COST_CASH = 1_000_000;
    public const ROLES = ['leader', 'co-leader', 'officer', 'enforcer', 'member'];
    private const META_PREFIX = 'fac-emp:';

    public function __construct(private Database $database, private EventBus $events) {}

    /** Caller holds the player's mutation lock; membership and its hook are atomic. */
    public function join(string $playerId, string $factionId): void
    {
        if (!preg_match('/^[a-z0-9-]{2,64}$/D', $factionId)) {
            throw new InvalidArgumentException('Unknown faction.');
        }
        $this->database->playerTransaction($playerId, function () use ($playerId, $factionId): void {
            // Serialize empty-family recruitment before counting members on PostgreSQL.
            // SQLite already owns its write lock through playerTransaction.
            $family = $this->database->fetchOne(
                'SELECT id FROM factions WHERE id = :id AND enabled = 1' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''),
                ['id' => $factionId],
            );
            if ($family === null) {
                throw new InvalidArgumentException('Unknown faction.');
            }
            if ($this->database->fetchOne('SELECT player_id FROM faction_members WHERE player_id = :id', ['id' => $playerId]) !== null) {
                throw new RuntimeException('You already belong to a family.');
            }
            $metaRow = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name', ['name' => self::META_PREFIX . $factionId]);
            if ($metaRow !== null && isset($metaRow['value'])) {
                $decoded = json_decode((string) $metaRow['value'], true);
                if (is_array($decoded) && array_key_exists('recruitmentOpen', $decoded) && $decoded['recruitmentOpen'] === false) {
                    throw new RuntimeException('This faction has closed open recruitment.');
                }
            }
            $members = (int) $this->database->fetchOne('SELECT COUNT(*) AS total FROM faction_members WHERE faction_id = :id', ['id' => $factionId])['total'];
            $role = $members === 0 ? 'leader' : 'member';
            $this->database->execute(
                'INSERT INTO faction_members (player_id, faction_id, role, joined_at) VALUES (:player, :faction, :role, :joined)',
                ['player' => $playerId, 'faction' => $factionId, 'role' => $role, 'joined' => gmdate('c')],
            );
            $this->events->publish(new DomainEvent('FactionJoined', [
                'playerId' => $playerId,
                'factionId' => $factionId,
                'role' => $role,
                'correlationId' => bin2hex(random_bytes(16)),
            ]));
        });
    }

    public function createFaction(
        string $playerId,
        string $nameEn,
        string $nameAr,
        string $tag,
        string $color = '#c93b2b',
        string $manifesto = '',
    ): array {
        $cleanNameEn = trim(preg_replace('/\s+/u', ' ', $nameEn) ?? '');
        $lenEn = self::utf8Len($cleanNameEn);
        if ($lenEn < 3 || $lenEn > 60) {
            throw new InvalidArgumentException('Faction English name must be between 3 and 60 characters.');
        }
        $cleanNameAr = trim(preg_replace('/\s+/u', ' ', $nameAr) ?? '');
        if ($cleanNameAr === '') {
            $cleanNameAr = $cleanNameEn;
        } else {
            $lenAr = self::utf8Len($cleanNameAr);
            if ($lenAr < 2 || $lenAr > 80) {
                throw new InvalidArgumentException('Faction Arabic name must be between 2 and 80 characters.');
            }
        }

        $cleanTag = strtoupper(trim($tag, " \t\n\r\0\x0B[]"));
        if (!preg_match('/^[A-Z0-9]{2,5}$/D', $cleanTag)) {
            throw new InvalidArgumentException('Faction tag must be 2 to 5 uppercase letters or digits.');
        }

        $cleanColor = strtolower(trim($color));
        if ($cleanColor === '') {
            $cleanColor = '#c93b2b';
        }
        if (!preg_match('/^#[0-9a-f]{6}$/D', $cleanColor)) {
            throw new InvalidArgumentException('Faction color must be a valid #RRGGBB hex color.');
        }

        $cleanManifesto = self::utf8Slice(trim($manifesto), 280);

        return $this->database->playerTransaction($playerId, function () use ($playerId, $cleanNameEn, $cleanNameAr, $cleanTag, $cleanColor, $cleanManifesto): array {
            $player = $this->database->fetchOne('SELECT id, username, cash FROM players WHERE id = :id', ['id' => $playerId]);
            if ($player === null) {
                throw new RuntimeException('Unknown player.');
            }
            if ($this->database->fetchOne('SELECT player_id FROM faction_members WHERE player_id = :id', ['id' => $playerId]) !== null) {
                throw new RuntimeException('Leave your current faction before founding a new empire.');
            }
            if ((int) $player['cash'] < self::CREATE_COST_CASH) {
                throw new RuntimeException('Founding a new Faction Empire requires $1,000,000 cash on hand.');
            }

            // Ensure name and [TAG] are unique across active factions.
            $existingName = $this->database->fetchOne(
                'SELECT id FROM factions WHERE enabled = 1 AND LOWER(name_en) = LOWER(:name)',
                ['name' => $cleanNameEn],
            );
            if ($existingName !== null) {
                throw new RuntimeException('An active faction already uses that name.');
            }

            $defaultTags = ['vipers' => 'VIPR', 'kings' => 'KING', 'night' => 'NGHT', 'oldguard' => 'OLDG'];
            foreach ($this->database->fetchAll('SELECT id FROM factions WHERE enabled = 1') as $fRow) {
                $fid = (string) $fRow['id'];
                $fTag = $defaultTags[$fid] ?? null;
                $mRow = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :name', ['name' => self::META_PREFIX . $fid]);
                if ($mRow !== null && isset($mRow['value'])) {
                    $mDec = json_decode((string) $mRow['value'], true);
                    if (is_array($mDec) && !empty($mDec['tag'])) {
                        $fTag = strtoupper((string) $mDec['tag']);
                    }
                }
                if ($fTag === $cleanTag) {
                    throw new RuntimeException('Faction tag [' . $cleanTag . '] is already claimed by another active syndicate.');
                }
            }

            $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $cleanNameEn) ?? '');
            $slug = trim($slug, '-');
            if ($slug === '') {
                $slug = strtolower($cleanTag);
            }
            $slug = substr($slug, 0, 24);
            $factionId = 'fac-' . $slug . '-' . bin2hex(random_bytes(3));
            $nowIso = gmdate('c');
            $correlationId = bin2hex(random_bytes(16));

            $newCash = (int) $player['cash'] - self::CREATE_COST_CASH;
            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $newCash, 'id' => $playerId]);
            (new Ledger($this->database))->record($playerId, 'cash', -self::CREATE_COST_CASH, $newCash, 'faction.create', $correlationId);

            $this->database->execute(
                'INSERT INTO factions (id, name_en, name_ar, color, enabled) VALUES (:id, :en, :ar, :color, 1)',
                ['id' => $factionId, 'en' => $cleanNameEn, 'ar' => $cleanNameAr, 'color' => $cleanColor],
            );
            $this->database->execute(
                "INSERT INTO faction_members (player_id, faction_id, role, joined_at) VALUES (:player, :faction, 'leader', :joined)",
                ['player' => $playerId, 'faction' => $factionId, 'joined' => $nowIso],
            );
            $this->database->insertIgnore(
                'family_progression',
                ['faction_id', 'respect', 'upgrades_json', 'version', 'updated_at'],
                [$factionId, 0, '{}', 1, $nowIso],
            );

            $metaKey = self::META_PREFIX . $factionId;
            $this->lockMetaKey($metaKey);
            $metaPayload = [
                'factionId' => $factionId,
                'tag' => $cleanTag,
                'manifesto' => $cleanManifesto !== '' ? $cleanManifesto : 'Sovereign syndicate operating in Zone City.',
                'recruitmentOpen' => true,
                'isPlayerCreated' => true,
                'createdBy' => $playerId,
                'createdAt' => $nowIso,
                'vaultCash' => 0,
                'vaultContributed' => [],
                'vaultLog' => [],
                'tree' => [],
                'activeOc' => null,
                'ocHistory' => [],
                'enlisted' => false,
                'activeWar' => null,
                'warHistory' => [],
                'warHitsByPlayer' => [],
                'caches' => ['bronze' => 0, 'silver' => 0, 'gold' => 0],
            ];
            $encoded = json_encode($metaPayload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $this->database->execute(
                'INSERT INTO engine_metadata (name, value) VALUES (:name, :val) ON CONFLICT (name) DO UPDATE SET value = :upd',
                ['name' => $metaKey, 'val' => $encoded, 'upd' => $encoded],
            );

            $this->events->publish(new DomainEvent('FactionCreated', [
                'playerId' => $playerId,
                'factionId' => $factionId,
                'nameEn' => $cleanNameEn,
                'nameAr' => $cleanNameAr,
                'tag' => $cleanTag,
                'color' => $cleanColor,
                'costCash' => self::CREATE_COST_CASH,
                'correlationId' => $correlationId,
            ]));
            $this->events->publish(new DomainEvent('FactionJoined', [
                'playerId' => $playerId,
                'factionId' => $factionId,
                'role' => 'leader',
                'correlationId' => $correlationId,
            ]));

            return [
                'factionId' => $factionId,
                'nameEn' => $cleanNameEn,
                'nameAr' => $cleanNameAr,
                'tag' => $cleanTag,
                'color' => $cleanColor,
                'manifesto' => $metaPayload['manifesto'],
                'role' => 'leader',
                'cashDelta' => -self::CREATE_COST_CASH,
                'correlationId' => $correlationId,
            ];
        });
    }

    public function leave(string $playerId): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $membership = $this->database->fetchOne(
                'SELECT faction_id, role FROM faction_members WHERE player_id = :id',
                ['id' => $playerId],
            );
            if ($membership === null) {
                throw new RuntimeException('You do not currently belong to a faction.');
            }
            $factionId = (string) $membership['faction_id'];
            $departingRole = (string) $membership['role'];

            $this->database->fetchOne(
                'SELECT id FROM factions WHERE id = :id' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''),
                ['id' => $factionId],
            );

            $activeOp = $this->database->fetchOne(
                "SELECT m.operation_id FROM family_operation_members m JOIN family_operations o ON o.id = m.operation_id WHERE m.player_id = :player AND o.state IN ('forming', 'running')",
                ['player' => $playerId],
            );
            if ($activeOp !== null) {
                throw new RuntimeException('Finish or leave your active family operation before leaving the faction.');
            }

            $this->database->execute('DELETE FROM faction_members WHERE player_id = :id', ['id' => $playerId]);

            $newLeaderId = null;
            $factionDisabled = false;
            $remaining = $this->database->fetchAll(
                "SELECT player_id, role, joined_at FROM faction_members WHERE faction_id = :faction
                 ORDER BY CASE role WHEN 'co-leader' THEN 1 WHEN 'officer' THEN 2 WHEN 'enforcer' THEN 3 ELSE 4 END ASC, joined_at ASC, player_id ASC",
                ['faction' => $factionId],
            );

            if ($remaining === []) {
                if (!in_array($factionId, self::SEED_FACTIONS, true)) {
                    $this->database->execute('UPDATE factions SET enabled = 0 WHERE id = :id', ['id' => $factionId]);
                    $this->database->execute(
                        "UPDATE territory_control SET faction_id = NULL, state = 'neutral', control_basis_points = 0, captured_at = NULL, version = version + 1, updated_at = :at WHERE faction_id = :faction",
                        ['at' => gmdate('c'), 'faction' => $factionId],
                    );
                    $factionDisabled = true;
                }
            } elseif ($departingRole === 'leader') {
                $existingLeader = array_values(array_filter($remaining, static fn (array $r): bool => $r['role'] === 'leader'));
                if ($existingLeader === []) {
                    $newLeaderId = (string) $remaining[0]['player_id'];
                    $this->database->execute(
                        "UPDATE faction_members SET role = 'leader' WHERE player_id = :id AND faction_id = :faction",
                        ['id' => $newLeaderId, 'faction' => $factionId],
                    );
                }
            }

            $correlationId = bin2hex(random_bytes(16));
            $this->events->publish(new DomainEvent('FactionLeft', [
                'playerId' => $playerId,
                'factionId' => $factionId,
                'previousRole' => $departingRole,
                'newLeaderId' => $newLeaderId,
                'factionDisabled' => $factionDisabled,
                'correlationId' => $correlationId,
            ]));

            return [
                'leftFactionId' => $factionId,
                'previousRole' => $departingRole,
                'newLeaderId' => $newLeaderId,
                'factionDisabled' => $factionDisabled,
                'correlationId' => $correlationId,
            ];
        });
    }

    public function setRole(string $actorId, string $targetPlayerId, string $role): array
    {
        $cleanRole = strtolower(trim($role));
        if (!in_array($cleanRole, ['co-leader', 'officer', 'enforcer', 'member', 'leader'], true)) {
            throw new InvalidArgumentException('Invalid faction role. Allowed roles: co-leader, officer, enforcer, member.');
        }
        if ($targetPlayerId === '') {
            throw new InvalidArgumentException('Target member ID is required.');
        }
        $ids = array_values(array_unique([$actorId, $targetPlayerId]));
        sort($ids, SORT_STRING);

        return $this->database->playersTransaction($ids, function () use ($actorId, $targetPlayerId, $cleanRole): array {
            $actor = $this->database->fetchOne('SELECT faction_id, role FROM faction_members WHERE player_id = :id', ['id' => $actorId]);
            if ($actor === null) {
                throw new RuntimeException('You do not belong to a faction.');
            }
            $factionId = (string) $actor['faction_id'];
            $actorRole = (string) $actor['role'];
            if (!in_array($actorRole, ['leader', 'co-leader'], true)) {
                throw new RuntimeException('Only the Faction Leader or Co-Leader can manage roster ranks.');
            }

            $this->database->fetchOne(
                'SELECT id FROM factions WHERE id = :id' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''),
                ['id' => $factionId],
            );

            $target = $this->database->fetchOne('SELECT faction_id, role FROM faction_members WHERE player_id = :id', ['id' => $targetPlayerId]);
            if ($target === null || (string) $target['faction_id'] !== $factionId) {
                throw new RuntimeException('Target player is not a member of your faction.');
            }
            $targetRole = (string) $target['role'];
            if ($actorId === $targetPlayerId && $actorRole === 'leader' && $cleanRole !== 'leader') {
                throw new RuntimeException('Promote another member to leader or leave the faction to transfer leadership.');
            }
            if ($actorRole === 'co-leader') {
                if (in_array($targetRole, ['leader', 'co-leader'], true) || in_array($cleanRole, ['leader', 'co-leader'], true)) {
                    throw new RuntimeException('Only the Faction Leader can appoint or modify Co-Leaders and Leaders.');
                }
            }

            if ($cleanRole === 'leader') {
                if ($actorRole !== 'leader') {
                    throw new RuntimeException('Only the current Faction Leader can transfer leadership.');
                }
                if ($actorId !== $targetPlayerId) {
                    $this->database->execute(
                        "UPDATE faction_members SET role = 'co-leader' WHERE player_id = :id AND faction_id = :faction",
                        ['id' => $actorId, 'faction' => $factionId],
                    );
                }
            }

            $this->database->execute(
                'UPDATE faction_members SET role = :role WHERE player_id = :id AND faction_id = :faction',
                ['role' => $cleanRole, 'id' => $targetPlayerId, 'faction' => $factionId],
            );

            $correlationId = bin2hex(random_bytes(16));
            $this->events->publish(new DomainEvent('FactionRoleChanged', [
                'factionId' => $factionId,
                'actorId' => $actorId,
                'targetPlayerId' => $targetPlayerId,
                'previousRole' => $targetRole,
                'newRole' => $cleanRole,
                'correlationId' => $correlationId,
            ]));

            return [
                'factionId' => $factionId,
                'targetPlayerId' => $targetPlayerId,
                'previousRole' => $targetRole,
                'role' => $cleanRole,
                'correlationId' => $correlationId,
            ];
        });
    }

    public function kick(string $actorId, string $targetPlayerId): array
    {
        if ($targetPlayerId === '' || $targetPlayerId === $actorId) {
            throw new InvalidArgumentException('Choose another faction member to kick.');
        }
        $ids = [$actorId, $targetPlayerId];
        sort($ids, SORT_STRING);

        return $this->database->playersTransaction($ids, function () use ($actorId, $targetPlayerId): array {
            $actor = $this->database->fetchOne('SELECT faction_id, role FROM faction_members WHERE player_id = :id', ['id' => $actorId]);
            if ($actor === null) {
                throw new RuntimeException('You do not belong to a faction.');
            }
            $factionId = (string) $actor['faction_id'];
            $actorRole = (string) $actor['role'];
            if (!in_array($actorRole, ['leader', 'co-leader'], true)) {
                throw new RuntimeException('Only the Faction Leader or Co-Leader can kick members.');
            }

            $this->database->fetchOne(
                'SELECT id FROM factions WHERE id = :id' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''),
                ['id' => $factionId],
            );

            $target = $this->database->fetchOne('SELECT faction_id, role FROM faction_members WHERE player_id = :id', ['id' => $targetPlayerId]);
            if ($target === null || (string) $target['faction_id'] !== $factionId) {
                throw new RuntimeException('Target player is not a member of your faction.');
            }
            $targetRole = (string) $target['role'];
            if ($targetRole === 'leader' || ($actorRole === 'co-leader' && $targetRole === 'co-leader')) {
                throw new RuntimeException('Cannot kick a member of equal or higher leadership rank.');
            }

            $activeOp = $this->database->fetchOne(
                "SELECT m.operation_id FROM family_operation_members m JOIN family_operations o ON o.id = m.operation_id WHERE m.player_id = :player AND o.state IN ('forming', 'running')",
                ['player' => $targetPlayerId],
            );
            if ($activeOp !== null) {
                throw new RuntimeException('Cannot kick a member currently committed to an active family operation.');
            }

            $this->database->execute(
                'DELETE FROM faction_members WHERE player_id = :id AND faction_id = :faction',
                ['id' => $targetPlayerId, 'faction' => $factionId],
            );

            $correlationId = bin2hex(random_bytes(16));
            $this->events->publish(new DomainEvent('FactionMemberKicked', [
                'factionId' => $factionId,
                'actorId' => $actorId,
                'targetPlayerId' => $targetPlayerId,
                'kickedRole' => $targetRole,
                'correlationId' => $correlationId,
            ]));

            return [
                'factionId' => $factionId,
                'kickedPlayerId' => $targetPlayerId,
                'kickedRole' => $targetRole,
                'correlationId' => $correlationId,
            ];
        });
    }

    public function memberCount(string $factionId): int
    {
        if (!preg_match('/^[a-z0-9-]{2,64}$/D', $factionId)) {
            return 0;
        }
        $row = $this->database->fetchOne('SELECT COUNT(*) AS total FROM faction_members WHERE faction_id = :id', ['id' => $factionId]);
        return (int) ($row['total'] ?? 0);
    }

    public function playerFactionId(string $playerId): ?string
    {
        $row = $this->database->fetchOne('SELECT faction_id FROM faction_members WHERE player_id = :id', ['id' => $playerId]);
        return isset($row['faction_id']) ? (string) $row['faction_id'] : null;
    }

    private static function utf8Len(string $text): int
    {
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        return is_array($chars) ? count($chars) : strlen($text);
    }

    private static function utf8Slice(string $text, int $maxChars): string
    {
        $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        return is_array($chars) ? implode('', array_slice($chars, 0, $maxChars)) : substr($text, 0, $maxChars);
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
