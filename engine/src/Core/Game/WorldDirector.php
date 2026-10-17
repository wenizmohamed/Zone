<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\PublishedRules;

/** Durable, bounded world simulation. HTTP reads never run this worker. */
final class WorldDirector
{
    private readonly EventBus $events;

    public function __construct(private readonly Database $database, ?EventBus $events = null)
    {
        $this->events = $events ?? new EventBus($database);
    }

    public static function normalizePolicy(array $policy): array
    {
        $defaults = ['enabled' => true, 'tickSeconds' => 60, 'findsPerTick' => 1, 'findQuantity' => 1,
            'findLifetimeSeconds' => 900, 'maxActiveFinds' => 24, 'supplyShift' => 2,
            'supplyCap' => 100, 'eventEveryTicks' => 5];
        $bounds = ['tickSeconds' => [30, 3600], 'findsPerTick' => [0, 3], 'findQuantity' => [1, 3],
            'findLifetimeSeconds' => [60, 86400], 'maxActiveFinds' => [1, 64], 'supplyShift' => [0, 20],
            'supplyCap' => [1, 1000], 'eventEveryTicks' => [1, 100]];
        $result = $defaults;
        $result['enabled'] = ($policy['enabled'] ?? true) === true;
        foreach ($bounds as $key => [$minimum, $maximum]) {
            $value = $policy[$key] ?? $defaults[$key];
            $result[$key] = is_int($value) ? max($minimum, min($maximum, $value)) : $defaults[$key];
        }
        return $result;
    }

    private function rules(): array
    {
        $projection = $this->database->driver() === 'pgsql' ? "manifest_json->'worldPolicy'" : "json_extract(manifest_json, '$.worldPolicy')";
        $row = $this->database->fetchOne("SELECT id, {$projection} AS policy FROM content_releases WHERE active = 1 LIMIT 1");
        return ['releaseId' => $row['id'] ?? 'foundation', 'policy' => self::normalizePolicy(
            $row === null || $row['policy'] === null ? [] : json_decode((string) $row['policy'], true, 64, JSON_THROW_ON_ERROR))];
    }

    /** Called by the persistent worker only. One committed tick per interval. */
    public function tick(): array
    {
        $rules = $this->rules(); $policy = $rules['policy']; $now = time();
        if (!$policy['enabled']) return ['status' => 'disabled', 'createdFinds' => 0];
        $bucket = intdiv($now, $policy['tickSeconds']);
        // Release changes do not generate another tick in the same interval.
        $tickId = hash('sha256', 'zone-world:' . $policy['tickSeconds'] . ':' . $bucket);
        $catalog = (new GameplayCatalog($this->database, $this->events))->active();
        return $this->database->transaction(function () use ($rules, $policy, $now, $bucket, $tickId, $catalog): array {
            $inserted = $this->database->execute('INSERT INTO world_ticks (id,release_id,tick_at) VALUES (:id,:release,:at) ON CONFLICT (id) DO NOTHING', ['id' => $tickId, 'release' => $rules['releaseId'], 'at' => $now]);
            if ($inserted === 0) return ['status' => 'already-ticked', 'tickId' => $tickId, 'createdFinds' => 0];
            if ($this->database->driver() === 'pgsql') $this->database->fetchOne('SELECT pg_advisory_xact_lock(90120261008)');
            $materials = array_keys(array_filter($catalog['items'] ?? [], static fn (array $item): bool => ($item['type'] ?? '') === 'material'));
            sort($materials, SORT_STRING);
            $active = (int) $this->database->fetchOne('SELECT COUNT(*) AS total FROM world_finds WHERE expires_at > :now AND claimed_by IS NULL', ['now' => $now])['total'];
            $created = 0; $locations = ['market', 'gym', 'bank', 'hospital', 'jail', 'properties', 'crimes'];
            for ($slot = 0; $slot < $policy['findsPerTick'] && $active + $created < $policy['maxActiveFinds'] && $materials !== []; $slot++) {
                $id = hash('sha256', $tickId . ':find:' . $slot);
                $choice = hexdec(substr($id, 0, 6));
                $this->database->execute('INSERT INTO world_finds (id,item_id,quantity,location_id,created_at,expires_at) VALUES (:id,:item,:quantity,:location,:at,:expires)', [
                    'id' => $id, 'item' => $materials[$choice % count($materials)], 'quantity' => $policy['findQuantity'],
                    'location' => $locations[$choice % count($locations)], 'at' => $now, 'expires' => $now + $policy['findLifetimeSeconds'],
                ]);
                $created++;
            }
            $listings = [];
            foreach ($catalog['market'] ?? [] as $listing) $listings[$listing['item']] = min($policy['supplyCap'], ($listings[$listing['item']] ?? 0) + (int) $listing['qty']);
            ksort($listings, SORT_STRING);
            foreach ($listings as $item => $base) {
                $this->database->insertIgnore('world_shop_supply', ['item_id', 'quantity', 'base_quantity', 'updated_at'], [$item, $base, $base, $now]);
                $current = $this->database->fetchOne('SELECT quantity,base_quantity FROM world_shop_supply WHERE item_id = :id' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''), ['id' => $item]);
                $delta = $policy['supplyShift'] === 0 ? 0 : hexdec(substr(hash('sha256', $tickId . ':' . $item), 0, 4)) % ($policy['supplyShift'] * 2 + 1) - $policy['supplyShift'];
                $quantity = max(0, min($policy['supplyCap'], (int) $current['quantity'] + $base - (int) $current['base_quantity'] + $delta));
                $this->database->execute('UPDATE world_shop_supply SET quantity=:quantity,base_quantity=:base,updated_at=:at WHERE item_id=:id', ['quantity' => $quantity, 'base' => $base, 'at' => $now, 'id' => $item]);
            }
            // Remove no-longer-published inventory from sale, without touching
            // any player's owned items or completed transactions.
            foreach ($this->database->fetchAll('SELECT item_id FROM world_shop_supply') as $row) {
                if (!array_key_exists($row['item_id'], $listings)) $this->database->execute('DELETE FROM world_shop_supply WHERE item_id=:id', ['id' => $row['item_id']]);
            }
            if ($bucket % $policy['eventEveryTicks'] === 0) {
                $eventId = hash('sha256', $tickId . ':underworld');
                $this->database->execute('INSERT INTO world_events (id,title_en,title_ar,body_en,body_ar,created_at,expires_at) VALUES (:id,:en,:ar,:bodyEn,:bodyAr,:at,:expires)', [
                    'id' => $eventId, 'en' => 'Word from the docks', 'ar' => 'خبر من الميناء',
                    'bodyEn' => 'A late shipment changed hands. Street dealers are counting fresh stock and the alleys have something worth finding.',
                    'bodyAr' => 'شحنة متأخرة بدّلت أصحابها. تجّار الشارع يعدّون البضاعة، والحارات فيها شي يستاهل تدور عليه.',
                    'at' => $now, 'expires' => $now + max(300, $policy['tickSeconds'] * $policy['eventEveryTicks']),
                ]);
            }
            $this->database->execute('DELETE FROM world_finds WHERE claimed_by IS NULL AND expires_at < :before', ['before' => $now - 86400]);
            $this->database->execute('DELETE FROM world_events WHERE expires_at < :before', ['before' => $now - 86400]);
            $this->events->publish(new DomainEvent('WorldTicked', ['tickId' => $tickId, 'releaseId' => $rules['releaseId'], 'createdFinds' => $created, 'shopCount' => count($listings)]));
            return ['status' => 'ticked', 'tickId' => $tickId, 'createdFinds' => $created, 'shopCount' => count($listings)];
        });
    }

    public function snapshot(string $playerId): array
    {
        if ($this->database->fetchOne('SELECT id FROM players WHERE id=:id', ['id' => $playerId]) === null) throw new InvalidArgumentException('Unknown player.');
        $rules = $this->rules(); $now = time();
        $finds = $rules['policy']['enabled'] ? $this->database->fetchAll('SELECT id,item_id,quantity,location_id,expires_at FROM world_finds WHERE expires_at>:now AND claimed_by IS NULL ORDER BY created_at DESC,id LIMIT 64', ['now' => $now]) : [];
        foreach ($finds as &$find) { $find['quantity'] = (int) $find['quantity']; $find['expires_at'] = (int) $find['expires_at']; } unset($find);
        return ['policy' => $rules['policy'], 'finds' => $finds, 'supply' => $this->supply(),
            'events' => $this->database->fetchAll('SELECT id,title_en,title_ar,body_en,body_ar,created_at,expires_at FROM world_events WHERE expires_at>:now ORDER BY created_at DESC LIMIT 10', ['now' => $now]),
            'lastTick' => $this->database->fetchOne('SELECT tick_at FROM world_ticks ORDER BY tick_at DESC LIMIT 1')['tick_at'] ?? null];
    }

    public function supply(): array
    {
        if (!$this->rules()['policy']['enabled']) return [];
        $stock = [];
        foreach ($this->database->fetchAll('SELECT item_id,quantity FROM world_shop_supply') as $row) $stock[$row['item_id']] = (int) $row['quantity'];
        return $stock;
    }

    /** Returns false until the worker has initialized this published listing. */
    public function purchaseStock(string $item): bool
    {
        return $this->database->transaction(function () use ($item): bool {
            if (!$this->rules()['policy']['enabled']) return false;
            if ($this->database->driver() === 'sqlite') $this->database->execute('UPDATE world_shop_supply SET quantity=quantity WHERE item_id=:id', ['id' => $item]);
            $row = $this->database->fetchOne('SELECT quantity FROM world_shop_supply WHERE item_id=:id' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''), ['id' => $item]);
            if ($row === null) return false;
            if ((int) $row['quantity'] < 1) throw new RuntimeException('This street shipment is sold out.');
            if ($this->database->execute('UPDATE world_shop_supply SET quantity=quantity-1 WHERE item_id=:id AND quantity>0', ['id' => $item]) !== 1) throw new RuntimeException('This street shipment was just sold out.');
            return true;
        });
    }

    public function claim(string $playerId, string $findId, string $idempotencyKey): array
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $findId) || !preg_match('/^[A-Za-z0-9_-]{12,100}$/D', $idempotencyKey)) throw new InvalidArgumentException('A valid find and idempotency key are required.');
        return $this->database->playerTransaction($playerId, function () use ($playerId, $findId, $idempotencyKey): array {
            $receipt = $this->database->fetchOne('SELECT find_id,receipt_json FROM world_find_claims WHERE player_id=:player AND idempotency_key=:key', ['player' => $playerId, 'key' => $idempotencyKey]);
            if ($receipt !== null) {
                if ($receipt['find_id'] !== $findId) throw new RuntimeException('This request key belongs to another find.');
                return [...json_decode($receipt['receipt_json'], true, 64, JSON_THROW_ON_ERROR), 'replayed' => true];
            }
            if (!$this->rules()['policy']['enabled']) throw new RuntimeException('Street finds are not active.');
            if (!(new PublishedRules($this->database))->moduleEnabled('inventory')) throw new RuntimeException('Inventory is disabled in the published release.');
            $progression = new ProgressionService($this->database, $this->events);
            $progression->assertAvailable($playerId);
            (new TravelService($this->database, $this->events))->assertAvailable($playerId);
            $find = $this->database->fetchOne('SELECT * FROM world_finds WHERE id=:id' . ($this->database->driver() === 'pgsql' ? ' FOR UPDATE' : ''), ['id' => $findId]);
            if ($find === null || $find['claimed_by'] !== null || (int) $find['expires_at'] <= time()) throw new RuntimeException('Someone got there first, or this street find expired.');
            $catalog = (new GameplayCatalog($this->database, $this->events))->active();
            if (($catalog['items'][$find['item_id']]['type'] ?? '') !== 'material') throw new RuntimeException('This find is no longer in the published item catalog.');
            $correlationId = bin2hex(random_bytes(16));
            $progression->grantItem($playerId, $find['item_id'], (int) $find['quantity'], $correlationId, 'world.street-find');
            $this->database->execute('UPDATE world_finds SET claimed_by=:player,claimed_at=:at WHERE id=:id', ['player' => $playerId, 'at' => time(), 'id' => $findId]);
            $result = ['findId' => $findId, 'itemId' => $find['item_id'], 'quantity' => (int) $find['quantity'], 'correlationId' => $correlationId, 'replayed' => false];
            $this->database->execute('INSERT INTO world_find_claims (player_id,idempotency_key,find_id,receipt_json,created_at) VALUES (:player,:key,:find,:receipt,:at)', [
                'player' => $playerId, 'key' => $idempotencyKey, 'find' => $findId, 'receipt' => json_encode($result, JSON_THROW_ON_ERROR), 'at' => time(),
            ]);
            $this->events->publish(new DomainEvent('StreetFindClaimed', ['playerId' => $playerId, ...$result]));
            return $result;
        });
    }
}
