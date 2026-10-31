<?php
declare(strict_types=1);
namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\PublishedRules;
use Zone\Engine\Core\Territories\TerritoryService;

/** Persistent NPC rounds. The browser chooses a target and finish, never damage or rewards. */
final class CombatService
{
    private readonly ProgressionService $progression;
    private readonly ResourceService $resources;
    private readonly Ledger $ledger;
    public function __construct(private readonly Database $database, private readonly EventBus $events, private readonly ?\Closure $random = null)
    {
        $this->progression = new ProgressionService($database, $events);
        $this->resources = new ResourceService($database);
        $this->ledger = new Ledger($database);
    }

    public function snapshot(string $playerId): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $this->resources->regenerate($playerId);
            return $this->response($playerId, $this->load($playerId));
        });
    }

    public function act(string $action, string $opponentId, string $approach, int $expectedVersion, string $playerId): array
    {
        if (!in_array($action, ['start', 'strike', 'finish'], true) || $expectedVersion < 1) throw new InvalidArgumentException('Invalid combat action or version.');
        return $this->database->playerTransaction($playerId, function () use ($action, $opponentId, $approach, $expectedVersion, $playerId): array {
            $this->resources->regenerate($playerId);
            $stored = $this->load($playerId);
            if ($stored['version'] !== $expectedVersion) throw new RuntimeException('Combat state changed. Refresh and try again.');
            $encounter = $stored['encounter'];
            $player = $this->player($playerId);
            $correlationId = bin2hex(random_bytes(16));
            $result = null;
            if ($action === 'start') {
                $this->progression->assertAvailable($playerId);
                if ($encounter !== null && in_array($encounter['phase'], ['fighting', 'won'], true)) throw new RuntimeException('Finish the current encounter first.');
                (new CooldownService($this->database))->assertReady($playerId, 'attack');
                $progress = $this->progression->snapshot($playerId);
                $opponent = array_values(array_filter($progress['catalogs']['opponents'], static fn (array $row): bool => $row['id'] === $opponentId))[0] ?? null;
                if ($opponent === null) throw new InvalidArgumentException('Unknown opponent.');
                if ($player['energy'] < 25 || $player['life'] < 1) throw new RuntimeException('Not enough energy or life to attack.');
                $state = $progress['state'];
                $loadout = LoadoutService::resolve($state, $progress['catalogs']['items']);
                $defenseBonus = (new PublishedRules($this->database))->moduleEnabled('territories')
                    ? min(2000, (new TerritoryService($this->database, $this->events))->bonusBasisPoints($playerId, 'defense')) : 0;
                $encounter = ['id' => bin2hex(random_bytes(16)), 'opponentId' => $opponentId, 'opponent' => $opponent,
                    'enemyHp' => (int) $opponent['life'], 'enemyMaxHp' => (int) $opponent['life'], 'playerHp' => $player['life'], 'playerMaxHp' => $player['max_life'],
                    'startPlayerHp' => $player['life'], 'turn' => 0, 'phase' => 'fighting', 'log' => [], 'weaponMultiplier' => $loadout['weaponMultiplier'],
                    'weaponId' => $loadout['weaponId'], 'armorId' => $loadout['armorId'], 'armorReduction' => $loadout['armorReduction'], 'defenseMultiplier' => (!empty($state['eduDone']['comb']) ? 1.03 : 1.0) * (1 + $defenseBonus / 10000), 'territoryDefenseBasisPoints' => $defenseBonus];
                $this->database->execute('UPDATE players SET energy = energy - 25 WHERE id = :id', ['id' => $playerId]);
                $cooldown = $this->database->fetchOne("SELECT seconds FROM cooldown_config WHERE action = 'attack'");
                (new CooldownService($this->database))->arm($playerId, 'attack', (int) ($cooldown['seconds'] ?? 8));
            } elseif ($action === 'strike') {
                $this->progression->assertAvailable($playerId);
                if ($encounter === null || $encounter['phase'] !== 'fighting') throw new RuntimeException('No active fight to strike.');
                $opponent = $encounter['opponent'];
                $encounter['turn']++;
                $life = $player['life'];
                $enemyLife = $encounter['enemyHp'];
                $hitChance = (int) round($player['speed'] / max(1, $player['speed'] + $opponent['dex']) * 10000);
                $damage = $this->roll(1, 10000) <= $hitChance ? max(1, (int) round(120 * $encounter['weaponMultiplier'] * ($player['strength'] / max(1, $player['strength'] + $opponent['def'])) * $this->roll(80, 120) / 100)) : 0;
                $enemyLife = max(0, $enemyLife - $damage);
                $encounter['log'][] = ['n' => $encounter['turn'], 'side' => $damage > 0 ? 'opp' : null, 'actor' => 'player', 'd' => $damage, 'yl' => $life, 'ol' => $enemyLife];
                if ($enemyLife > 0) {
                    $hitChance = (int) round($opponent['spd'] / max(1, $opponent['spd'] + $player['dexterity']) * 10000);
                    $damage = $this->roll(1, 10000) <= $hitChance ? max(1, (int) round(120 * 1.4 * ($opponent['str'] / max(1, $opponent['str'] + $player['defense'] * $encounter['defenseMultiplier'])) * (1 - $encounter['armorReduction']) * $this->roll(80, 120) / 100)) : 0;
                    $life = max(0, $life - $damage);
                    $encounter['log'][] = ['n' => $encounter['turn'], 'side' => $damage > 0 ? 'you' : null, 'actor' => 'opponent', 'd' => $damage, 'yl' => $life, 'ol' => $enemyLife];
                }
                $encounter['enemyHp'] = $enemyLife;
                $encounter['playerHp'] = $life;
                $encounter['phase'] = $enemyLife === 0 ? 'won' : ($life === 0 ? 'lost' : ($encounter['turn'] >= 25 ? 'stalemate' : 'fighting'));
                $this->database->execute('UPDATE players SET life = :life WHERE id = :id', ['life' => $life, 'id' => $playerId]);
                if ($encounter['phase'] === 'lost') $this->progression->applyPenalty($playerId, 'hosp', 10);
            } else {
                if (!in_array($approach, ['mug', 'hosp', 'leave'], true)) throw new InvalidArgumentException('Invalid combat finish.');
                if ($encounter === null || ($encounter['phase'] === 'fighting' && $approach !== 'leave')) throw new RuntimeException('The encounter is not ready to finish.');
                if ($encounter['phase'] !== 'won' && $approach !== 'leave') throw new RuntimeException('Only a won encounter can award a finish.');
                $cash = 0; $xp = 0; $respect = 0;
                if ($encounter['phase'] === 'won') {
                    $opponent = $encounter['opponent'];
                    $cash = $approach === 'mug' ? (int) round($opponent['cash'] * $this->roll(500, 1200) / 10000) : 0;
                    $xp = (int) $opponent['lvl'] * 3;
                    $this->database->execute('UPDATE players SET cash = cash + :cash, xp = xp + :xp WHERE id = :id', ['cash' => $cash, 'xp' => $xp, 'id' => $playerId]);
                    if ($cash > 0) $this->ledger->record($playerId, 'cash', $cash, $player['cash'] + $cash, 'combat.mug', $correlationId);
                    $respect = $this->progression->recordCombatWin($playerId, (int) $opponent['lvl'], $approach);
                    $leveling = new LevelingService($this->database, $this->ledger, $this->events);
                    $leveling->sync($playerId, $correlationId);
                    (new DailyService($this->database, $this->ledger, $this->events, $leveling))->recordProgress($playerId, 'attack_wins', 1);
                }
                $damageDealt = array_sum(array_map(static fn (array $e): int => ($e['actor'] ?? '') === 'player' ? (int) ($e['d'] ?? 0) : 0, $encounter['log']));
                $damageTaken = array_sum(array_map(static fn (array $e): int => ($e['actor'] ?? '') === 'opponent' ? (int) ($e['d'] ?? 0) : 0, $encounter['log']));
                $result = ['approach' => $approach, 'outcome' => $encounter['phase'], 'opponentId' => $encounter['opponentId'], 'totalRounds' => $encounter['turn'], 'damageDealt' => $damageDealt, 'damageTaken' => $damageTaken, 'cashDelta' => $cash, 'respectDelta' => $respect, 'xp' => $xp, 'correlationId' => $correlationId];
                $encounter = null;
            }
            $stored = ['version' => $stored['version'] + 1, 'encounter' => $encounter];
            $this->database->execute('UPDATE combat_encounters SET state_json = :state, version = :version, updated_at = :updated WHERE player_id = :id', ['state' => json_encode($stored, JSON_THROW_ON_ERROR), 'version' => $stored['version'], 'updated' => gmdate('c'), 'id' => $playerId]);
            $this->events->publish(new DomainEvent('CombatAction', ['playerId' => $playerId, 'action' => $action, 'version' => $stored['version'], 'result' => $result, 'correlationId' => $correlationId]));
            return [...$this->response($playerId, $stored), 'result' => $result];
        });
    }

    private function load(string $playerId): array
    {
        $this->database->insertIgnore('combat_encounters', ['player_id', 'state_json', 'version', 'updated_at'], [$playerId, '{"encounter":null}', 1, gmdate('c')]);
        $row = $this->database->fetchOne('SELECT state_json, version FROM combat_encounters WHERE player_id = :id', ['id' => $playerId]);
        return [...json_decode((string) $row['state_json'], true, 64, JSON_THROW_ON_ERROR), 'version' => (int) $row['version']];
    }

    private function player(string $playerId): array
    {
        return $this->resources->normalize($this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]));
    }

    private function response(string $playerId, array $stored): array
    {
        if ($stored['encounter'] !== null) {
            $stored['encounter']['version'] = $stored['version'];
            $stored['encounter']['playerHp'] = $this->player($playerId)['life'];
            unset($stored['encounter']['weaponMultiplier'], $stored['encounter']['armorReduction'], $stored['encounter']['defenseMultiplier']);
        }
        return [...$stored, 'player' => $this->player($playerId)];
    }

    private function roll(int $min, int $max): int
    {
        return $this->random === null ? random_int($min, $max) : ($this->random)($min, $max);
    }

    public function hasActiveEncounter(string $playerId): bool
    {
        $row = $this->database->fetchOne('SELECT state_json FROM combat_encounters WHERE player_id = :id', ['id' => $playerId]);
        if ($row === null) return false;
        $phase = json_decode((string) $row['state_json'], true, 64, JSON_THROW_ON_ERROR)['encounter']['phase'] ?? '';
        return in_array($phase, ['fighting', 'won'], true);
    }

    public function activeEncounterCount(): int
    {
        $count = 0;
        foreach ($this->database->fetchAll('SELECT state_json FROM combat_encounters') as $row) {
            $phase = json_decode((string) $row['state_json'], true, 64, JSON_THROW_ON_ERROR)['encounter']['phase'] ?? '';
            if (in_array($phase, ['fighting', 'won'], true)) {
                $count++;
            }
        }
        return $count;
    }
}
