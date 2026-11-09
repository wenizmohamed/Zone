<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Territories\TerritoryService;

/** Human counterparties are reserved and settled under canonical paired player locks. */
final class PlayerCombatService
{
    private readonly ProgressionService $progression;
    private readonly ResourceService $resources;
    private readonly Ledger $ledger;
    public function __construct(private readonly Database $database, private readonly EventBus $events, private readonly ?\Closure $random = null, private readonly ?\Closure $clock = null, private readonly ?\Closure $rulesCaptured = null)
    {
        $this->progression = new ProgressionService($database, $events);
        $this->resources = new ResourceService($database);
        $this->ledger = new Ledger($database);
    }

    public function snapshot(string $playerId): array
    {
        return $this->locked($playerId, '', function () use ($playerId): array {
            $this->resources->regenerate($playerId);
            return $this->response($playerId, $this->load($playerId));
        });
    }

    public function opponents(string $playerId): array
    {
        $self = $this->snapshot($playerId)['player'];
        $rows = $this->database->fetchAll('SELECT p.id, p.username, p.level, p.life, p.max_life, p.strength, p.defense, p.speed, p.dexterity, p.city, m.faction_id, f.name_en AS faction_name FROM players p LEFT JOIN faction_members m ON m.player_id = p.id LEFT JOIN factions f ON f.id = m.faction_id WHERE p.id <> :id ORDER BY p.username, p.id LIMIT 200', ['id' => $playerId]);
        $selfReason = $this->unavailableReason($playerId);
        if ($selfReason === null && ($self['energy'] < 25 || $self['life'] < 1)) $selfReason = 'Not enough energy or life to attack.';
        $attackCooldownSeconds = 0;
        try {
            (new CooldownService($this->database))->assertReady($playerId, 'attack');
        } catch (CooldownException $error) {
            $attackCooldownSeconds = $error->retryAfter;
            $selfReason ??= 'Attack cooldown is active.';
        }
        $players = [];
        foreach ($rows as $row) {
            $reason = $selfReason ?? $this->unavailableReason($row['id']);
            if ($reason === null && (int) $row['life'] < 1) $reason = 'Opponent needs hospital recovery.';
            if ($reason === null && $row['city'] !== $self['city']) $reason = 'Opponent is in another city.';
            $players[] = ['id' => $row['id'], 'username' => $row['username'], 'level' => (int) $row['level'], 'life' => (int) $row['life'], 'max_life' => (int) $row['max_life'], 'strength' => (int) $row['strength'], 'defense' => (int) $row['defense'], 'speed' => (int) $row['speed'], 'dexterity' => (int) $row['dexterity'], 'totalStats' => (int) $row['strength'] + (int) $row['defense'] + (int) $row['speed'] + (int) $row['dexterity'], 'factionId' => $row['faction_id'], 'factionName' => $row['faction_name'], 'eligible' => $reason === null, 'reason' => $reason];
        }
        return ['players' => $players, 'energyCost' => 25, 'maxRounds' => 25, 'selfId' => $playerId, 'attackCooldownSeconds' => $attackCooldownSeconds];
    }

    public function act(string $action, string $opponentId, string $approach, int $expectedVersion, string $playerId): array
    {
        if (!in_array($action, ['start', 'strike', 'finish'], true) || $expectedVersion < 1) throw new InvalidArgumentException('Invalid player combat action or version.');
        if ($action === 'start' && ($opponentId === '' || $opponentId === $playerId)) throw new InvalidArgumentException('Choose another player.');
        return $this->locked($playerId, $action === 'start' ? $opponentId : '', function () use ($action, $opponentId, $approach, $expectedVersion, $playerId): array {
            $stored = $this->load($playerId);
            if ($stored['version'] !== $expectedVersion) throw new RuntimeException('Combat state changed. Refresh and try again.');
            $encounter = $stored['encounter']; $result = null;
            $correlationId = bin2hex(random_bytes(16));
            if ($action === 'start') {
                if ($encounter !== null) throw new RuntimeException('Finish the current encounter first.');
                $this->available($playerId); $this->available($opponentId);
                foreach ([$playerId, $opponentId] as $id) {
                    if ($this->reservation($id) !== null || $this->npcBusy($id)) throw new RuntimeException('A player is already in an encounter.');
                }
                (new CooldownService($this->database))->assertReady($playerId, 'attack');
                $player = $this->player($playerId); $defender = $this->player($opponentId);
                if ($player['city'] !== $defender['city']) throw new RuntimeException('Opponent is in another city.');
                if ($player['energy'] < 25 || $player['life'] < 1 || $defender['life'] < 1) throw new RuntimeException('Not enough energy or life to attack.');
                $encounter = ['id' => bin2hex(random_bytes(16)), 'kind' => 'player', 'opponentId' => $opponentId, 'defenderId' => $opponentId,
                    'opponent' => ['id' => $opponentId, 'name' => $defender['username'], 'username' => $defender['username'], 'lvl' => $defender['level'], 'str' => $defender['strength'], 'def' => $defender['defense'], 'spd' => $defender['speed'], 'dex' => $defender['dexterity']],
                    'enemyHp' => $defender['life'], 'enemyMaxHp' => $defender['max_life'], 'playerHp' => $player['life'], 'playerMaxHp' => $player['max_life'], 'startPlayerHp' => $player['life'],
                    'expiresAt' => $this->now() + 900, 'turn' => 0, 'phase' => 'fighting', 'log' => []];
                foreach ([$playerId, $opponentId] as $id) $this->database->execute('INSERT INTO player_combat_locks (player_id, encounter_id, attacker_id, defender_id, expires_at) VALUES (:id, :encounter, :attacker, :defender, :expires)', ['id' => $id, 'encounter' => $encounter['id'], 'attacker' => $playerId, 'defender' => $opponentId, 'expires' => $encounter['expiresAt']]);
                $this->database->execute('UPDATE players SET energy = energy - 25 WHERE id = :id', ['id' => $playerId]);
                $cooldown = $this->database->fetchOne("SELECT seconds FROM cooldown_config WHERE action = 'attack'");
                (new CooldownService($this->database))->arm($playerId, 'attack', (int) ($cooldown['seconds'] ?? 8));
            } else {
                if ($encounter === null) throw new RuntimeException('No player encounter to resume.');
                $defenderId = $encounter['defenderId'];
                foreach ([$playerId, $defenderId] as $id) if (($this->reservation($id)['encounter_id'] ?? null) !== $encounter['id']) throw new RuntimeException('Encounter reservation expired. Refresh combat.');
                if ($action === 'strike') {
                    if ($encounter['phase'] !== 'fighting') throw new RuntimeException('No active fight to strike.');
                    $this->available($playerId); $this->available($defenderId);
                    $player = $this->player($playerId); $defender = $this->player($defenderId);
                    $rules = LoadoutService::publishedView($this->database, $this->events);
                    $attackerGear = $this->gear($playerId, $rules);
                    if ($this->rulesCaptured !== null) ($this->rulesCaptured)($rules);
                    $defenderGear = $this->gear($defenderId, $rules);
                    $encounter['turn']++;
                    $damage = $this->damage($player, $defender, $attackerGear, $defenderGear);
                    $defender['life'] = max(0, $defender['life'] - $damage);
                    $hitbox = ['Head', 'Heart', 'Throat', 'Chest', 'Stomach', 'Arm', 'Leg'][$encounter['turn'] % 7];
                    $ammoType = ['Standard', 'Hollow Point', 'Piercing', 'Tracer', 'Incendiary'][$encounter['turn'] % 5];
                    $encounter['log'][] = ['n' => $encounter['turn'], 'side' => $damage > 0 ? 'opp' : null, 'actor' => 'player', 'd' => $damage, 'yl' => $player['life'], 'ol' => $defender['life'], 'hitbox' => $hitbox, 'ammoType' => $ammoType];
                    if ($defender['life'] > 0) {
                        $damage = $this->damage($defender, $player, $defenderGear, $attackerGear);
                        $player['life'] = max(0, $player['life'] - $damage);
                        $encounter['log'][] = ['n' => $encounter['turn'], 'side' => $damage > 0 ? 'you' : null, 'actor' => 'opponent', 'd' => $damage, 'yl' => $player['life'], 'ol' => $defender['life'], 'hitbox' => $hitbox, 'ammoType' => 'Standard'];
                    }
                    foreach ([$player, $defender] as $row) $this->database->execute('UPDATE players SET life = :life WHERE id = :id', ['life' => $row['life'], 'id' => $row['id']]);
                    $encounter['enemyHp'] = $defender['life']; $encounter['playerHp'] = $player['life'];
                    $encounter['phase'] = $defender['life'] === 0 ? 'won' : ($player['life'] === 0 ? 'lost' : ($encounter['turn'] >= 25 ? 'stalemate' : 'fighting'));
                    if ($encounter['phase'] === 'lost') $this->progression->applyPenalty($playerId, 'hosp', 10);
                } else {
                    if (!in_array($approach, ['mug', 'hosp', 'leave'], true)) throw new InvalidArgumentException('Invalid combat finish.');
                    if ($encounter['phase'] !== 'won' && $approach !== 'leave') throw new RuntimeException('Only a won encounter can award a finish.');
                    $cash = 0; $xp = 0; $respect = 0;
                    if ($encounter['phase'] === 'won') {
                        $player = $this->player($playerId); $defender = $this->player($defenderId);
                        $cash = $approach === 'mug' ? min($defender['cash'], max(0, (int) round($defender['cash'] * $this->roll(500, 1200) / 10000))) : 0;
                        $xp = $defender['level'] * 3;
                        $this->database->execute('UPDATE players SET cash = cash + :cash, xp = xp + :xp WHERE id = :id', ['cash' => $cash, 'xp' => $xp, 'id' => $playerId]);
                        if ($cash > 0) {
                            $this->database->execute('UPDATE players SET cash = cash - :cash WHERE id = :id', ['cash' => $cash, 'id' => $defenderId]);
                            $this->ledger->record($defenderId, 'cash', -$cash, $defender['cash'] - $cash, 'player-combat.mug.debit', $correlationId);
                            $this->ledger->record($playerId, 'cash', $cash, $player['cash'] + $cash, 'player-combat.mug.credit', $correlationId);
                        }
                        $respect = $this->progression->recordCombatWin($playerId, $defender['level'], $approach);
                        $leveling = new LevelingService($this->database, $this->ledger, $this->events);
                        $leveling->sync($playerId, $correlationId);
                        (new DailyService($this->database, $this->ledger, $this->events, $leveling))->recordProgress($playerId, 'attack_wins', 1);
                        $this->progression->applyPenalty($defenderId, 'hosp', $approach === 'hosp' ? 10 : ($approach === 'mug' ? 5 : 2));
                    }
                    $modifiers = ['fair_fight' => 1.57, 'war' => 1.0, 'retaliation' => 1.0, 'group' => 1.0, 'overseas' => 1.0, 'chain' => 1.0, 'warlord' => 1.0];
                    $finishingHitEffects = [['name' => $approach === 'mug' ? 'plunder' : ($approach === 'hosp' ? 'stricken' : 'proficience'), 'value' => $approach === 'mug' ? 25 : ($approach === 'hosp' ? 30 : 15)]];
                    $result = ['playerId' => $playerId, 'defenderId' => $defenderId, 'opponentId' => $defenderId, 'encounterId' => $encounter['id'], 'approach' => $approach, 'outcome' => $encounter['phase'], 'totalRounds' => $encounter['turn'], 'cashDelta' => $cash, 'respectDelta' => $respect, 'xp' => $xp, 'modifiers' => $modifiers, 'finishing_hit_effects' => $finishingHitEffects, 'correlationId' => $correlationId];
                    $this->database->execute('DELETE FROM player_combat_locks WHERE encounter_id = :id', ['id' => $encounter['id']]);
                    $encounter = null;
                }
            }
            $stored = ['version' => $stored['version'] + 1, 'encounter' => $encounter];
            $this->save($playerId, $stored);
            $this->events->publish(new DomainEvent('PlayerCombatAction', ['playerId' => $playerId, 'action' => $action, 'version' => $stored['version'], 'correlationId' => $correlationId]));
            if ($result !== null) $this->events->publish(new DomainEvent('PlayerCombatResolved', $result));
            return [...$this->response($playerId, $stored), 'result' => $result];
        });
    }

    /** Hint reads contain identities only. Recheck after acquiring locks before any stats or writes. */
    private function participants(string $actor, string $target): array
    {
        $ids = [$actor]; if ($target !== '') $ids[] = $target;
        $row = $this->database->fetchOne('SELECT state_json FROM player_combat_encounters WHERE player_id = :id', ['id' => $actor]);
        $state = $row === null ? [] : json_decode($row['state_json'], true, 64, JSON_THROW_ON_ERROR);
        if (!empty($state['encounter']['defenderId'])) $ids[] = $state['encounter']['defenderId'];
        foreach (array_unique($ids) as $id) {
            $lock = $this->database->fetchOne('SELECT attacker_id, defender_id FROM player_combat_locks WHERE player_id = :id', ['id' => $id]);
            if ($lock !== null) { $ids[] = $lock['attacker_id']; $ids[] = $lock['defender_id']; }
        }
        $ids = array_values(array_unique($ids)); sort($ids, SORT_STRING); return $ids;
    }
    private function locked(string $actor, string $target, callable $callback): array
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $ids = $this->participants($actor, $target);
            $result = $this->database->playersTransaction($ids, function () use ($actor, $target, $ids, $callback): array {
                if (array_diff($this->participants($actor, $target), $ids)) return ['retryInternalLocks' => true];
                $this->expire($ids);
                return $callback();
            });
            if (!isset($result['retryInternalLocks'])) return $result;
        }
        throw new RuntimeException('Combat changed while acquiring player locks. Refresh and retry.');
    }
    private function expire(array $ids): void
    {
        foreach ($ids as $id) {
            $lock = $this->database->fetchOne('SELECT * FROM player_combat_locks WHERE player_id = :id', ['id' => $id]);
            if ($lock === null || (int) $lock['expires_at'] > $this->now()) continue;
            $stored = $this->load($lock['attacker_id']);
            if (($stored['encounter']['id'] ?? null) === $lock['encounter_id']) {
                foreach ([$lock['attacker_id'], $lock['defender_id']] as $participant) if ($this->player($participant)['life'] < 1) $this->progression->applyPenalty($participant, 'hosp', 2);
                $this->save($lock['attacker_id'], ['version' => $stored['version'] + 1, 'encounter' => null]);
                $this->events->publish(new DomainEvent('PlayerCombatExpired', ['playerId' => $lock['attacker_id'], 'defenderId' => $lock['defender_id'], 'encounterId' => $lock['encounter_id']]));
            }
            $this->database->execute('DELETE FROM player_combat_locks WHERE encounter_id = :id', ['id' => $lock['encounter_id']]);
        }
    }
    private function available(string $id): void
    {
        if ($this->database->fetchOne('SELECT id FROM players WHERE id = :id', ['id' => $id]) === null) throw new InvalidArgumentException('Unknown player opponent.');
        $this->progression->assertAvailable($id, 'player-combat');
        (new TravelService($this->database, $this->events))->assertAvailable($id);
        $this->resources->regenerate($id);
    }
    private function unavailableReason(string $id): ?string
    {
        if ($this->reservation($id) !== null || $this->npcBusy($id)) return 'Player is already in an encounter.';
        $row = $this->database->fetchOne('SELECT state_json FROM player_progression WHERE player_id = :id', ['id' => $id]);
        $state = $row === null ? [] : json_decode($row['state_json'], true, 64, JSON_THROW_ON_ERROR);
        if (max((int) ($state['jailUntil'] ?? 0), (int) ($state['hospUntil'] ?? 0)) > $this->now() * 1000) return 'Player is in jail or hospital.';
        $travel = $this->database->fetchOne('SELECT status, arrives_at FROM player_travel WHERE player_id = :id', ['id' => $id]);
        return $travel !== null && $travel['status'] === 'traveling' && strtotime($travel['arrives_at']) > $this->now() ? 'Player is traveling.' : null;
    }
    private function npcBusy(string $id): bool
    {
        $row = $this->database->fetchOne('SELECT state_json FROM combat_encounters WHERE player_id = :id', ['id' => $id]);
        return $row !== null && in_array(json_decode($row['state_json'], true, 64, JSON_THROW_ON_ERROR)['encounter']['phase'] ?? '', ['fighting', 'won'], true);
    }
    private function reservation(string $id): ?array
    {
        return $this->database->fetchOne('SELECT * FROM player_combat_locks WHERE player_id = :id AND expires_at > :now', ['id' => $id, 'now' => $this->now()]);
    }
    private function gear(string $id, array $rules): array
    {
        $progress = $this->progression->snapshot($id); $state = $progress['state'];
        $loadout = LoadoutService::resolve($state, $rules['items']);
        $territory = $rules['territoriesEnabled'] ? min(2000, (new TerritoryService($this->database, $this->events))->bonusBasisPoints($id, 'defense')) : 0;
        return ['weapon' => $loadout['weaponMultiplier'], 'armor' => $loadout['armorReduction'], 'defense' => (!empty($state['eduDone']['comb']) ? 1.03 : 1.0) * (1 + $territory / 10000)];
    }
    private function damage(array $actor, array $target, array $actorGear, array $targetGear): int
    {
        $chance = (int) round($actor['speed'] / max(1, $actor['speed'] + $target['dexterity']) * 10000);
        if ($this->roll(1, 10000) > $chance) return 0;
        return max(1, (int) round(120 * $actorGear['weapon'] * $actor['strength'] / max(1, $actor['strength'] + $target['defense'] * $targetGear['defense']) * (1 - $targetGear['armor']) * $this->roll(80, 120) / 100));
    }
    private function player(string $id): array
    {
        $row = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $id]);
        if ($row === null) throw new InvalidArgumentException('Unknown player.');
        return $this->resources->normalize($row);
    }
    private function load(string $id): array
    {
        $this->database->insertIgnore('player_combat_encounters', ['player_id', 'state_json', 'version', 'updated_at'], [$id, '{"encounter":null}', 1, gmdate('c')]);
        $row = $this->database->fetchOne('SELECT state_json, version FROM player_combat_encounters WHERE player_id = :id', ['id' => $id]);
        return [...json_decode($row['state_json'], true, 64, JSON_THROW_ON_ERROR), 'version' => (int) $row['version']];
    }
    private function save(string $id, array $stored): void
    {
        $this->database->execute('UPDATE player_combat_encounters SET state_json = :state, version = :version, updated_at = :updated WHERE player_id = :id', ['state' => json_encode($stored, JSON_THROW_ON_ERROR), 'version' => $stored['version'], 'updated' => gmdate('c'), 'id' => $id]);
    }
    private function response(string $id, array $stored): array
    {
        if ($stored['encounter'] !== null) {
            $stored['encounter']['version'] = $stored['version'];
            $stored['encounter']['playerHp'] = $this->player($id)['life'];
            $stored['encounter']['enemyHp'] = $this->player($stored['encounter']['defenderId'])['life'];
        }
        $lock = $this->reservation($id); $incoming = null;
        if ($lock !== null && $lock['defender_id'] === $id) $incoming = ['encounterId' => $lock['encounter_id'], 'attackerId' => $lock['attacker_id'], 'attackerName' => $this->player($lock['attacker_id'])['username'], 'expiresAt' => (int) $lock['expires_at']];
        return [...$stored, 'player' => $this->player($id), 'incoming' => $incoming];
    }
    private function roll(int $min, int $max): int { return $this->random === null ? random_int($min, $max) : ($this->random)($min, $max); }
    private function now(): int { return $this->clock === null ? time() : ($this->clock)(); }
}
