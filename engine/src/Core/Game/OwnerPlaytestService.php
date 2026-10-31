<?php
declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Application\GameEngine;
use Zone\Engine\Core\Persistence\Database;

/**
 * Opt-in owner testing, never a privilege attached to a normal player.
 *
 * Each operation materializes a separate character in a nested transaction,
 * runs the real game services, captures their result and rolls the entire
 * savepoint back. Only a private sandbox snapshot and an owner audit record
 * survive. A sandbox character cannot enter player lists, accounts or trades.
 * The HTTP router must authorize the owner again on every request.
 */
final readonly class OwnerPlaytestService
{
    private const LIFETIME = 43200;
    private const MAX_OPERATIONS = 100;
    private const TABLES = ['player_progression', 'player_travel', 'combat_encounters', 'casino_high_low', 'player_contract_progress'];
    public const ACTIONS = [
        'item.buy', 'item.sell', 'item.equip', 'item.unequip', 'item.use', 'market.buy',
        'property.buy', 'course.enroll', 'gym.join', 'job.take', 'mission.claim',
        'gym.train', 'job.work', 'bank.deposit', 'bank.withdraw', 'crime.attempt',
        'hospital.heal', 'travel.start', 'casino.blackjack', 'casino.high-low',
        'combat.start', 'combat.strike', 'combat.finish', 'daily.login', 'daily.claim',
    ];

    public function __construct(private Database $database, private GameEngine $engine) {}

    public function status(string $sourcePlayerId): array
    {
        $row = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :key', ['key' => $this->key($sourcePlayerId)]);
        $session = $row === null || $row['value'] === '' ? null : json_decode($row['value'], true, 512, JSON_THROW_ON_ERROR);
        if (!$this->active($session)) return ['active' => false, 'mode' => 'player', 'capabilities' => self::ACTIONS];
        $capture = $this->simulate($session['snapshot'], static fn (): array => []);
        return $this->response($session, $capture);
    }

    public function start(string $sourcePlayerId, string $actor, string $idempotencyKey): array
    {
        $this->validateKey($idempotencyKey);
        return $this->locked($sourcePlayerId, function (?array $session) use ($sourcePlayerId, $actor, $idempotencyKey): array {
            if ($this->active($session)) {
                if (($session['startKey'] ?? '') === $idempotencyKey) return $session['startResponse'];
                throw new RuntimeException('Owner playtest is already active. Exit before starting a new sandbox.');
            }
            if (isset($session['usedStartKeys'][$idempotencyKey]) || ($session['startKey'] ?? '') === $idempotencyKey) throw new RuntimeException('Owner playtest idempotency key was already used for an ended session.');
            $usedStartKeys = $session['usedStartKeys'] ?? [];
            if (isset($session['startKey'])) $usedStartKeys[$session['startKey']] = true;
            if (count($usedStartKeys) > 100) $usedStartKeys = array_slice($usedStartKeys, -100, null, true);
            $source = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $sourcePlayerId]);
            if ($source === null) throw new RuntimeException('Unknown owner player.');
            $id = 'owner-playtest-' . bin2hex(random_bytes(12));
            $player = array_replace($source, [
                'id' => $id, 'username' => 'Owner Playtest', 'level' => 100, 'xp' => 0,
                'cash' => 1_000_000_000, 'bank_balance' => 0, 'city' => 'Zone City',
                'energy' => 1000, 'max_energy' => 1000, 'nerve' => 1000, 'max_nerve' => 1000,
                'life' => 5000, 'max_life' => 5000, 'happy' => 1000, 'max_happy' => 1000,
                'strength' => 1000, 'defense' => 1000, 'speed' => 1000, 'dexterity' => 1000,
                'login_streak' => 1, 'last_login_day' => gmdate('Y-m-d'), 'resources_updated_at' => gmdate('c'),
            ]);
            $snapshot = ['player' => $player, 'tables' => []];
            $capture = $this->simulate($snapshot, function (string $playerId): array {
                $state = $this->engine->gameplay($playerId);
                $progress = $state['state'];
                $correlation = bin2hex(random_bytes(16));
                $ledger = new \Zone\Engine\Core\Economy\Ledger($this->database);
                $ledger->record($playerId, 'cash', 1_000_000_000, 1_000_000_000, 'owner.playtest.provision', $correlation);
                foreach ($state['catalogs']['items'] as $itemId => $_) {
                    $delta = 3 - (int) ($progress['inv'][$itemId] ?? 0);
                    if ($delta !== 0) $ledger->record($playerId, 'item:' . $itemId, $delta, 3, 'owner.playtest.provision', $correlation);
                }
                $progress['inv'] = array_fill_keys(array_keys($state['catalogs']['items']), 3);
                $progress['equip'] = 'fists';
                $progress['gymXp'] = max(array_column($state['catalogs']['gyms'], 'xp'));
                $progress['crimeXp'] = 100000;
                $progress['points'] = 10000;
                $progress['merits'] = 100;
                foreach ($state['catalogs']['missions'] as $mission) $progress['ctr'][$mission['ctr']] = max($progress['ctr'][$mission['ctr']] ?? 0, $mission['n']);
                $this->database->execute('UPDATE player_progression SET state_json = :json WHERE player_id = :id', ['id' => $playerId, 'json' => json_encode($progress, JSON_THROW_ON_ERROR)]);
                return ['prepared' => true];
            });
            $session = ['active' => true, 'id' => bin2hex(random_bytes(16)), 'sourcePlayerId' => $sourcePlayerId,
                'version' => 1, 'expiresAt' => time() + self::LIFETIME, 'startKey' => $idempotencyKey,
                'snapshot' => $capture['snapshot'], 'operations' => [], 'usedStartKeys' => $usedStartKeys];
            $response = $this->response($session, $capture);
            $session['startResponse'] = $response;
            $this->save($sourcePlayerId, $session);
            $this->audit($actor, 'OwnerPlaytestStarted', $sourcePlayerId, $session, ['catalogUnits' => count($capture['gameplay']['catalogs']['items']), 'normalPlayerModified' => false]);
            return $response;
        });
    }

    public function act(string $sourcePlayerId, string $actor, array $payload): array
    {
        $key = $payload['idempotencyKey'] ?? '';
        $this->validateKey($key);
        $action = $payload['action'] ?? '';
        if (!is_string($action) || !in_array($action, self::ACTIONS, true)) throw new InvalidArgumentException('This action is not available in isolated Owner Playtest.');
        $version = $payload['expectedVersion'] ?? null;
        if (!is_int($version) || $version < 1) throw new InvalidArgumentException('A current owner playtest version is required.');
        $this->validateSessionId($payload['sessionId'] ?? null);
        $allowed = ['sessionId', 'idempotencyKey', 'expectedVersion', 'action', 'id', 'amount', 'stat', 'sessions', 'bet', 'direction', 'opponentId', 'approach', 'expectedPrice'];
        if (array_diff(array_keys($payload), $allowed) !== []) throw new InvalidArgumentException('Unknown owner playtest action fields.');
        $hashPayload = $payload; unset($hashPayload['idempotencyKey']); ksort($hashPayload);
        $hash = hash('sha256', json_encode($hashPayload, JSON_THROW_ON_ERROR));
        return $this->locked($sourcePlayerId, function (?array $session) use ($sourcePlayerId, $actor, $payload, $action, $key, $hash, $version): array {
            if (!$this->active($session)) throw new RuntimeException('Owner playtest is not active.');
            if (!hash_equals($session['id'], $payload['sessionId'])) throw new RuntimeException('Owner playtest state changed. Session identity does not match.');
            if (isset($session['operations'][$key])) {
                if (!hash_equals($session['operations'][$key]['hash'], $hash)) throw new RuntimeException('Owner playtest idempotency key was already used for another request.');
                return $session['operations'][$key]['response'];
            }
            if ($session['version'] !== $version) throw new RuntimeException('Owner playtest state changed. Refresh and try again.');
            if (count($session['operations']) >= self::MAX_OPERATIONS) throw new RuntimeException('Owner playtest session limit reached. Exit and start a new sandbox.');
            $capture = $this->simulate($session['snapshot'], fn (string $playerId): array => $this->dispatch($playerId, $action, $payload));
            $session['snapshot'] = $capture['snapshot'];
            $session['version']++;
            $response = $this->response($session, $capture);
            $session['operations'][$key] = ['hash' => $hash, 'response' => $response];
            $this->save($sourcePlayerId, $session);
            $this->audit($actor, 'OwnerPlaytestAction', $sourcePlayerId, $session, ['action' => $action, 'receipt' => $capture['receipt'], 'normalPlayerModified' => false]);
            return $response;
        });
    }

    public function end(string $sourcePlayerId, string $actor, string $sessionId, string $idempotencyKey): array
    {
        $this->validateSessionId($sessionId);
        $this->validateKey($idempotencyKey);
        return $this->locked($sourcePlayerId, function (?array $session) use ($sourcePlayerId, $actor, $sessionId, $idempotencyKey): array {
            if ($session === null || !hash_equals((string) ($session['id'] ?? ''), $sessionId)) throw new RuntimeException('Owner playtest state changed. Session identity does not match.');
            $result = ['active' => false, 'mode' => 'player', 'restoredPlayerId' => $sourcePlayerId];
            if (!($session['active'] ?? false)) return $result;
            $this->save($sourcePlayerId, ['active' => false, 'id' => $sessionId, 'startKey' => $session['startKey'], 'usedStartKeys' => $session['usedStartKeys'] ?? [], 'endKey' => $idempotencyKey]);
            $this->audit($actor, 'OwnerPlaytestEnded', $sourcePlayerId, $session, ['normalPlayerModified' => false]);
            return $result;
        });
    }

    private function dispatch(string $id, string $action, array $payload): array
    {
        $entry = $this->text($payload, 'id', 80);
        if (in_array($action, ['item.buy', 'item.sell', 'item.equip', 'item.unequip', 'item.use', 'market.buy', 'property.buy', 'course.enroll', 'gym.join', 'job.take', 'mission.claim'], true)) {
            if ($action === 'item.use') {
                $this->database->execute('UPDATE players SET life = 1, nerve = 1, energy = 1, happy = 1 WHERE id = :id', ['id' => $id]);
            }
            $state = $this->engine->gameplay($id);
            return $this->engine->gameplayAction($action, $entry, $state['state']['version'], $id,
                isset($payload['expectedPrice']) ? $this->integer($payload, 'expectedPrice', 0, 2_000_000_000) : null);
        }
        return match ($action) {
            'gym.train' => $this->engine->trainGym($this->text($payload, 'stat', 20), $this->integer($payload, 'sessions', 1, 10, 1), $id),
            'job.work' => $this->engine->workShift($id),
            'bank.deposit' => $this->engine->bankDeposit($this->integer($payload, 'amount', 1, 1_000_000_000), $id),
            'bank.withdraw' => $this->engine->bankWithdraw($this->integer($payload, 'amount', 1, 1_000_000_000), $id),
            'crime.attempt' => $this->engine->attemptCrime($entry, $id),
            'hospital.heal' => $this->heal($id),
            'travel.start' => $this->engine->travel($entry, $id),
            'casino.blackjack' => $this->engine->playBlackjack($this->integer($payload, 'bet', 1, 1_000_000), $id),
            'casino.high-low' => $this->engine->playHighLow($this->integer($payload, 'bet', 1, 1_000_000), $this->text($payload, 'direction', 20), $this->engine->highLowState($id)['version'], $id),
            'combat.start', 'combat.strike', 'combat.finish' => $this->engine->combatAction(substr($action, 7), $this->text($payload, 'opponentId', 80), $this->text($payload, 'approach', 20), $this->engine->combat($id)['version'], $id),
            'daily.login' => ['streak' => $this->engine->dailyLogin($id)],
            'daily.claim' => $this->engine->claimDailyContract($id),
        };
    }

    private function heal(string $id): array
    {
        $this->database->execute('UPDATE players SET life = 1 WHERE id = :id', ['id' => $id]);
        return $this->engine->hospitalHeal($id);
    }

    private function simulate(array $snapshot, callable $operation): array
    {
        $capture = null;
        $rollback = new RuntimeException('owner-playtest-savepoint-rollback');
        try {
            $this->database->transaction(function () use ($snapshot, $operation, &$capture, $rollback): never {
                $player = $snapshot['player']; $id = $player['id'];
                $this->database->insertIgnore('players', array_keys($player), array_values($player));
                foreach (self::TABLES as $table) foreach ($snapshot['tables'][$table] ?? [] as $row) $this->database->insertIgnore($table, array_keys($row), array_values($row));
                $this->database->execute('DELETE FROM action_cooldowns WHERE player_id = :id', ['id' => $id]);
                $result = $operation($id);
                $receipt = [
                    'ledger' => $this->database->fetchAll('SELECT asset, amount, balance_after, reason, correlation_id FROM economy_ledger WHERE player_id = :id ORDER BY created_at, id', ['id' => $id]),
                    'events' => $this->database->fetchAll("SELECT id, event_name, payload_json FROM event_log WHERE CAST(payload_json AS TEXT) LIKE :pattern ORDER BY occurred_at, id", ['pattern' => '%' . $id . '%']),
                ];
                $receipt['testingAdjustments'] = $this->advancePersonalTimers($id);
                // Resources are intentionally full in the labeled sandbox only.
                $this->database->execute('UPDATE players SET energy = max_energy, nerve = max_nerve, life = max_life, happy = max_happy, resources_updated_at = :at WHERE id = :id', ['id' => $id, 'at' => gmdate('c')]);
                $this->database->execute('DELETE FROM action_cooldowns WHERE player_id = :id', ['id' => $id]);
                $gameplay = $this->engine->gameplay($id);
                $rules = new \Zone\Engine\Core\Publishing\PublishedRules($this->database);
                $combat = $rules->moduleEnabled('kill') ? $this->engine->combat($id) : ['available' => false, 'module' => 'kill'];
                $highLow = $rules->moduleEnabled('blackjack') ? $this->engine->highLowState($id) : ['available' => false, 'module' => 'blackjack'];
                $daily = $this->engine->dailyContract($id);
                $notifications = $this->engine->notifications($id);
                $tables = [];
                foreach (self::TABLES as $table) $tables[$table] = $this->database->fetchAll('SELECT * FROM ' . $table . ' WHERE player_id = :id', ['id' => $id]);
                $capture = ['snapshot' => ['player' => $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $id]), 'tables' => $tables],
                    'gameplay' => $gameplay, 'combat' => $combat, 'highLow' => $highLow, 'dailyContract' => $daily,
                    'notifications' => $notifications, 'result' => $result, 'receipt' => $receipt];
                throw $rollback;
            });
        } catch (RuntimeException $error) {
            if ($error !== $rollback) throw $error;
        }
        if (!is_array($capture)) throw new RuntimeException('Owner playtest result could not be captured.');
        return $capture;
    }

    private function response(array $session, array $capture): array
    {
        return ['active' => true, 'mode' => 'owner-playtest', 'version' => $session['version'], 'sessionId' => $session['id'], 'expiresAt' => $session['expiresAt'],
            'operationsRemaining' => max(0, self::MAX_OPERATIONS - count($session['operations'] ?? [])), 'maxOperations' => self::MAX_OPERATIONS,
            'gameplay' => $capture['gameplay'], 'combat' => $capture['combat'], 'highLow' => $capture['highLow'], 'dailyContract' => $capture['dailyContract'],
            'notifications' => $capture['notifications'], 'result' => $capture['result'], 'receipt' => $capture['receipt'], 'capabilities' => self::ACTIONS,
            'rules' => ['resourcesRefill' => true, 'allCatalogItemsProvisioned' => true, 'progressionUnlocked' => true, 'timersAdvance' => true, 'penaltiesClear' => true, 'liveEconomyModified' => false, 'sharedMutationsAllowed' => false]];
    }

    /** Advance only temporary personal rows, never the server/world clock. */
    private function advancePersonalTimers(string $id): array
    {
        $adjusted = ['timers' => [], 'penalties' => [], 'resourcesRefill' => true, 'cooldownsClear' => true];
        $travel = $this->database->fetchOne('SELECT status FROM player_travel WHERE player_id = :id', ['id' => $id]);
        if (($travel['status'] ?? '') === 'traveling') {
            $this->database->execute('UPDATE player_travel SET arrives_at = :now WHERE player_id = :id', ['id' => $id, 'now' => gmdate('c')]);
            (new TravelService($this->database, new \Zone\Engine\Core\Events\EventBus($this->database)))->snapshot($id);
            $adjusted['timers'][] = 'travel';
        }
        $row = $this->database->fetchOne('SELECT state_json FROM player_progression WHERE player_id = :id', ['id' => $id]);
        if ($row !== null) {
            $state = json_decode($row['state_json'], true, 512, JSON_THROW_ON_ERROR);
            if ($state['edu'] !== null) { $state['edu']['until'] = time() * 1000; $adjusted['timers'][] = 'education'; }
            foreach (['jailUntil', 'hospUntil'] as $field) {
                if ($state[$field] > 0) { $adjusted['penalties'][] = $field; $state[$field] = 0; }
            }
            if ($adjusted['timers'] !== [] || $adjusted['penalties'] !== []) $this->database->execute('UPDATE player_progression SET state_json = :json WHERE player_id = :id', ['id' => $id, 'json' => json_encode($state, JSON_THROW_ON_ERROR)]);
        }
        return $adjusted;
    }

    private function locked(string $id, callable $callback): array
    {
        $key = $this->key($id);
        return $this->database->transaction(function () use ($key, $callback): array {
            $this->database->execute('INSERT INTO engine_metadata (name, value) VALUES (:key, :value) ON CONFLICT (name) DO NOTHING', ['key' => $key, 'value' => '']);
            $this->database->execute('UPDATE engine_metadata SET value = value WHERE name = :key', ['key' => $key]);
            $row = $this->database->fetchOne('SELECT value FROM engine_metadata WHERE name = :key', ['key' => $key]);
            return $callback($row['value'] === '' ? null : json_decode($row['value'], true, 512, JSON_THROW_ON_ERROR));
        });
    }

    private function save(string $id, array $session): void
    {
        // Stored idempotent responses must retain whole-valued floats too, so
        // replay returns the exact same typed authoritative loadout receipt.
        $this->database->execute('UPDATE engine_metadata SET value = :json WHERE name = :key', ['key' => $this->key($id), 'json' => json_encode($session, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION)]);
    }

    private function audit(string $actor, string $action, string $sourceId, array $session, array $details): void
    {
        $this->database->execute('INSERT INTO admin_audit_log (id, actor, action, target_type, target_id, previous_json, next_json, correlation_id, created_at) VALUES (:id, :actor, :action, :type, :target, NULL, :next, :correlation, :at)',
            ['id' => bin2hex(random_bytes(16)), 'actor' => $actor, 'action' => $action, 'type' => 'owner-playtest', 'target' => $sourceId,
                'next' => json_encode(['sessionId' => $session['id'], 'version' => $session['version'], ...$details], JSON_THROW_ON_ERROR), 'correlation' => bin2hex(random_bytes(16)), 'at' => gmdate('c')]);
    }

    private function key(string $id): string { return 'owner-playtest:' . hash('sha256', $id); }
    private function active(?array $session): bool { return $session !== null && ($session['active'] ?? false) && ($session['expiresAt'] ?? 0) > time(); }
    private function validateKey(mixed $key): void { if (!is_string($key) || !preg_match('/^[A-Za-z0-9_-]{16,80}$/D', $key)) throw new InvalidArgumentException('A 16 to 80 character owner playtest idempotency key is required.'); }
    private function validateSessionId(mixed $id): void { if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/D', $id)) throw new InvalidArgumentException('A valid owner playtest sessionId is required.'); }
    private function text(array $payload, string $key, int $max): string { $value = $payload[$key] ?? ''; if (!is_string($value) || strlen($value) > $max) throw new InvalidArgumentException('Invalid owner playtest ' . $key . '.'); return $value; }
    private function integer(array $payload, string $key, int $minimum, int $maximum, ?int $default = null): int { $value = $payload[$key] ?? $default; if (!is_int($value) || $value < $minimum || $value > $maximum) throw new InvalidArgumentException('Invalid owner playtest ' . $key . '.'); return $value; }
}
