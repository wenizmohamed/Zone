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
use Zone\Engine\Core\Content\GameplayCatalog;

/** Server-owned progression. Prices, rewards and clocks never come from the browser. */
final class ProgressionService
{
    private array $catalog;
    private string $catalogRevision;
    private readonly ResourceService $resources;
    private readonly Ledger $ledger;

    public function __construct(private readonly Database $database, private readonly EventBus $events)
    {
        $this->refreshCatalog();
        $this->resources = new ResourceService($database);
        $this->ledger = new Ledger($database);
    }

    public function snapshot(string $playerId): array
    {
        $this->refreshCatalog();
        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $this->resources->regenerate($playerId);
            $state = $this->load($playerId);
            if ($this->completeEducation($playerId, $state)) $this->save($playerId, $state);
            return $this->response($playerId, $state);
        });
    }

    public function assertAvailable(string $playerId, string $action = ''): void
    {
        if ($action === 'hospital') return;
        $this->database->playerTransaction($playerId, function () use ($playerId): void {
            $state = $this->load($playerId);
            if ($state['jailUntil'] > $this->now() || $state['hospUntil'] > $this->now()) {
                throw new RuntimeException('You must leave jail or hospital before this action.');
            }
        });
    }

    public function recordCrime(string $playerId, string $crimeId, bool $success, int $xpReward = 2): void
    {
        $this->database->playerTransaction($playerId, function () use ($playerId, $crimeId, $success, $xpReward): void {
            $state = $this->load($playerId);
            $state['crimeXp'] = ($state['crimeXp'] ?? 96) + ($success ? max(0, $xpReward) : 1);
            if ($success) {
                $state['ctr']['crimes']++;
                $state['skill'][$crimeId] = min(100, ($state['skill'][$crimeId] ?? 0) + 1);
            }
            $this->save($playerId, $state);
        });
    }

    public function grantItem(string $playerId, string $itemId, int $quantity = 1): void
    {
        $this->item($itemId);
        if ($quantity < 1 || $quantity > 1000) throw new InvalidArgumentException('Invalid item quantity.');
        $this->database->playerTransaction($playerId, function () use ($playerId, $itemId, $quantity): void {
            $state = $this->load($playerId);
            $state['inv'][$itemId] = ($state['inv'][$itemId] ?? 0) + $quantity;
            $this->save($playerId, $state);
            $this->events->publish(new DomainEvent('ItemGranted', ['playerId' => $playerId, 'itemId' => $itemId, 'quantity' => $quantity]));
        });
    }

    public function applyPenalty(string $playerId, string $type, int $minutes): void
    {
        if (!in_array($type, ['jail', 'hosp'], true) || $minutes < 1) throw new InvalidArgumentException('Invalid player penalty.');
        $this->database->playerTransaction($playerId, function () use ($playerId, $type, $minutes): void {
            $state = $this->load($playerId);
            $multiplier = $type === 'jail' && !empty($state['eduDone']['law']) ? .85 : ($type === 'hosp' && !empty($state['fac']['ups']['hospTime']) ? .8 : 1);
            $state[$type . 'Until'] = max($state[$type . 'Until'], $this->now() + (int) ($minutes * 60000 * $multiplier));
            $this->save($playerId, $state);
        });
    }

    public function clearHospital(string $playerId): void
    {
        $this->database->playerTransaction($playerId, function () use ($playerId): void {
            $state = $this->load($playerId);
            if ($state['hospUntil'] === 0) return;
            $state['hospUntil'] = 0;
            $this->save($playerId, $state);
        });
    }

    public function recordCombatWin(string $playerId, int $opponentLevel, string $approach): int
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $opponentLevel, $approach): int {
            $state = $this->load($playerId);
            $state['ctr']['wins']++;
            $respect = 0;
            if ($approach === 'hosp') {
                if ($this->now() - $state['fac']['chainAt'] > 300000) $state['fac']['chain'] = 0;
                $state['fac']['chain']++;
                $state['fac']['chainAt'] = $this->now();
                $state['fac']['best'] = max($state['fac']['best'], $state['fac']['chain']);
                $respect = 25 + $opponentLevel;
                if (in_array($state['fac']['chain'], [10, 25, 50, 100, 250, 500], true)) $respect += $state['fac']['chain'] * 40;
                $state['fac']['respect'] += $respect;
            }
            $this->save($playerId, $state);
            return $respect;
        });
    }

    /** Called only by successful engine actions, inside their player transaction. */
    public function recordMetric(string $playerId, string $metric, int $amount = 1): void
    {
        if (!in_array($metric, ['crimes', 'trains', 'wins', 'shifts', 'buys'], true) || $amount < 1) return;
        $this->database->playerTransaction($playerId, function () use ($playerId, $metric, $amount): void {
            $state = $this->load($playerId);
            $state['ctr'][$metric] += $amount;
            if ($metric === 'trains') $state['gymXp'] += $amount * 10;
            if ($metric === 'shifts') $state['jobPts'] += $amount;
            if ($metric === 'wins') {
                $state['fac']['respect'] += $amount * 25;
                $state['fac']['chain'] += $amount;
                $state['fac']['best'] = max($state['fac']['best'], $state['fac']['chain']);
                $state['fac']['chainAt'] = $this->now();
            }
            $this->save($playerId, $state);
        });
    }

    public function act(string $action, string $id, int $expectedVersion, string $playerId, ?int $expectedPrice = null): array
    {
        $this->refreshCatalog();
        if ($expectedVersion < 1) throw new InvalidArgumentException('A current progression version is required.');
        return $this->database->playerTransaction($playerId, function () use ($action, $id, $expectedVersion, $playerId, $expectedPrice): array {
            $this->resources->regenerate($playerId);
            $state = $this->load($playerId);
            if ($state['version'] !== $expectedVersion) throw new RuntimeException('Progression state changed. Refresh and try again.');
            $this->completeEducation($playerId, $state);
            if (!in_array($action, ['jail.bailSelf', 'item.use'], true)) $this->assertAvailable($playerId);
            $player = $this->player($playerId);
            $correlationId = bin2hex(random_bytes(16));
            $result = ['action' => $action, 'id' => $id, 'cashDelta' => 0, 'correlationId' => $correlationId];
            switch ($action) {
                case 'item.buy':
                case 'market.buy':
                    $item = $this->item($id);
                    $price = (int) $item['price'];
                    if ($action === 'market.buy') {
                        $price = $this->marketPrice($price, $this->marketDiscount($playerId));
                        if ($expectedPrice === null || $expectedPrice < 0) throw new InvalidArgumentException('A current market price is required.');
                        if ($price !== $expectedPrice) throw new RuntimeException('The market price changed. Refresh and try again.');
                        $index = array_search($id, array_column($state['market'], 'item'), true);
                        if ($index === false || $state['market'][$index]['qty'] < 1) throw new RuntimeException('This listing is sold out.');
                        $state['market'][$index]['qty']--;
                    }
                    $this->cash($playerId, -$price, $action, $correlationId);
                    $state['inv'][$id] = ($state['inv'][$id] ?? 0) + 1;
                    $state['ctr']['buys']++;
                    $result['cashDelta'] = -$price;
                    break;
                case 'item.sell':
                    $item = $this->ownedItem($id, $state);
                    $price = (int) round($item['price'] * 0.9);
                    $state['inv'][$id]--;
                    if ($state['inv'][$id] === 0 && $state['equip'] === $id) $state['equip'] = null;
                    $this->cash($playerId, $price, $action, $correlationId);
                    $result['cashDelta'] = $price;
                    break;
                case 'item.equip':
                    if ($id === 'fists') $state['equip'] = null;
                    else {
                        $item = $this->ownedItem($id, $state);
                        if ($item['type'] !== 'weapon') throw new RuntimeException('Only owned weapons can be equipped.');
                        $state['equip'] = $id;
                    }
                    break;
                case 'item.use':
                    $item = $this->ownedItem($id, $state);
                    if (!in_array($item['type'], ['medical', 'booster'], true)) throw new RuntimeException('This item cannot be consumed.');
                    $life = min($player['max_life'], $player['life'] + (int) ($item['life'] ?? 0));
                    $nerve = min($player['max_nerve'], $player['nerve'] + (int) ($item['nerve'] ?? 0));
                    $clearsHospital = !empty($item['life']) && $state['hospUntil'] > $this->now();
                    if ($life === $player['life'] && $nerve === $player['nerve'] && !$clearsHospital) throw new RuntimeException('Your resources are full. The item has been kept.');
                    $state['inv'][$id]--;
                    if (!empty($item['life'])) $state['hospUntil'] = 0;
                    $this->database->execute('UPDATE players SET life = :life, nerve = :nerve WHERE id = :id', ['life' => $life, 'nerve' => $nerve, 'id' => $playerId]);
                    $result['restored'] = ['life' => $life - $player['life'], 'nerve' => $nerve - $player['nerve']];
                    break;
                case 'property.buy':
                    $property = $this->entry('properties', $id);
                    if ($state['prop'] === $id) throw new RuntimeException('You already live at this property.');
                    $price = !empty($state['ownedProperties'][$id]) ? 0 : (int) $property['price'];
                    $this->cash($playerId, -$price, $action, $correlationId);
                    $state['ownedProperties'][$id] = 1;
                    $state['prop'] = $id;
                    $this->database->execute('UPDATE players SET max_happy = :maximum, happy = :happy WHERE id = :id', ['maximum' => $property['happy'], 'happy' => min($player['happy'], $property['happy']), 'id' => $playerId]);
                    $result['cashDelta'] = -$price;
                    break;
                case 'course.enroll':
                    $course = $this->entry('courses', $id);
                    if ($state['edu'] !== null || !empty($state['eduDone'][$id])) throw new RuntimeException('A course is already active or completed.');
                    $this->cash($playerId, -(int) $course['cost'], $action, $correlationId);
                    $total = (int) $course['mins'] * 60000;
                    $state['edu'] = ['id' => $id, 'until' => $this->now() + $total, 'total' => $total];
                    $result['cashDelta'] = -(int) $course['cost'];
                    break;
                case 'gym.join':
                    if (!ctype_digit($id) || !isset($this->catalog['gyms'][(int) $id])) throw new InvalidArgumentException('Unknown gym.');
                    $gym = $this->catalog['gyms'][(int) $id];
                    if ($state['gym'] === (int) $id) throw new RuntimeException('You are already a member of this gym.');
                    if ($state['gymXp'] < $gym['xp']) throw new RuntimeException('Train more to unlock this gym.');
                    $this->cash($playerId, -(int) $gym['cost'], $action, $correlationId);
                    $state['gym'] = (int) $id;
                    $result['cashDelta'] = -(int) $gym['cost'];
                    break;
                case 'job.take':
                    $job = $this->entry('jobs', $id);
                    if ($player['level'] < $job['lvl']) throw new RuntimeException('Your level is too low for this job.');
                    $state['job'] = $id;
                    break;
                case 'mission.claim':
                    $mission = $this->entry('missions', $id);
                    if (!empty($state['claimed'][$id])) throw new RuntimeException('This mission reward has already been claimed.');
                    if ($state['ctr'][$mission['ctr']] < $mission['n']) throw new RuntimeException('Complete the mission before claiming its reward.');
                    $this->cash($playerId, (int) $mission['cash'], $action, $correlationId);
                    $state['points'] += (int) $mission['pts'];
                    $state['claimed'][$id] = 1;
                    $result['cashDelta'] = (int) $mission['cash'];
                    break;
                case 'faction.upgrade':
                    $upgrade = $this->entry('upgrades', $id);
                    if (!empty($state['fac']['ups'][$id])) throw new RuntimeException('This upgrade is already owned.');
                    if ($state['fac']['respect'] < $upgrade['cost']) throw new RuntimeException('Not enough respect.');
                    $state['fac']['respect'] -= $upgrade['cost'];
                    $state['fac']['ups'][$id] = 1;
                    if ($id === 'nerveMax') $this->database->execute('UPDATE players SET max_nerve = max_nerve + 5 WHERE id = :id', ['id' => $playerId]);
                    if ($id === 'energyMax') $this->database->execute('UPDATE players SET max_energy = max_energy + 10 WHERE id = :id', ['id' => $playerId]);
                    break;
                case 'jail.bailSelf':
                    if ($state['jailUntil'] <= $this->now()) throw new RuntimeException('You are not in jail.');
                    $price = max(1000, (int) ceil(($state['jailUntil'] - $this->now()) / 60000) * 1000);
                    $this->cash($playerId, -$price, $action, $correlationId);
                    $state['jailUntil'] = 0;
                    $result['cashDelta'] = -$price;
                    break;
                case 'jail.bail':
                case 'jail.bust':
                    $index = array_search($id, array_column($state['inmates'], 'id'), true);
                    if ($index === false || $state['inmates'][$index]['out'] || $state['inmates'][$index]['until'] <= $this->now()) throw new RuntimeException('This inmate has already been released.');
                    $inmate = $state['inmates'][$index];
                    if ($action === 'jail.bail') {
                        $price = max(1, (int) ceil(($inmate['until'] - $this->now()) / 60000)) * 100 * $inmate['lvl'];
                        $this->cash($playerId, -$price, $action, $correlationId);
                        $result['cashDelta'] = -$price;
                        $result['success'] = true;
                    } else {
                        if ($player['nerve'] < 5) throw new RuntimeException('Not enough nerve.');
                        $this->database->execute('UPDATE players SET nerve = nerve - 5 WHERE id = :id', ['id' => $playerId]);
                        $odds = max(15, min(90, 55 + ($player['level'] - $inmate['lvl']) * 2 + ($state['skill']['bust'] ?? 0)));
                        $result['success'] = random_int(1, 100) <= $odds;
                        if ($result['success']) {
                            $state['skill']['bust'] = ($state['skill']['bust'] ?? 0) + 1;
                            $this->awardXp($playerId, 10, $correlationId);
                        } else $state['jailUntil'] = $this->now() + (int) (180000 * (!empty($state['eduDone']['law']) ? .85 : 1));
                    }
                    if ($result['success']) $state['inmates'][$index]['out'] = true;
                    break;
                case 'hospital.revive':
                    $index = array_search($id, array_column($state['patients'], 'id'), true);
                    if ($index === false || $state['patients'][$index]['until'] <= $this->now()) throw new RuntimeException('This patient has already recovered.');
                    if ($player['energy'] < 75) throw new RuntimeException('Not enough energy.');
                    $this->database->execute('UPDATE players SET energy = energy - 75 WHERE id = :id', ['id' => $playerId]);
                    $state['patients'][$index]['until'] = 0;
                    $this->awardXp($playerId, 15, $correlationId);
                    break;
                default:
                    throw new InvalidArgumentException('Unknown gameplay action.');
            }
            $this->save($playerId, $state);
            $this->events->publish(new DomainEvent('ProgressionAction', ['playerId' => $playerId, ...$result, 'version' => $state['version']]));
            return [...$this->response($playerId, $state), 'result' => $result];
        });
    }

    private function refreshCatalog(): void
    {
        $this->catalog = (new GameplayCatalog($this->database, $this->events))->active();
        $this->catalogRevision = hash('sha256', json_encode($this->catalog, JSON_THROW_ON_ERROR));
    }

    private function now(): int { return (int) floor(microtime(true) * 1000); }

    private function player(string $id): array
    {
        $row = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $id]);
        if ($row === null) throw new RuntimeException('Unknown player.');
        return $this->resources->normalize($row);
    }

    private function item(string $id): array
    {
        return $this->catalog['items'][$id] ?? throw new InvalidArgumentException('Unknown item.');
    }

    private function ownedItem(string $id, array $state): array
    {
        $item = $this->item($id);
        if (($state['inv'][$id] ?? 0) < 1) throw new RuntimeException('You do not own this item.');
        return $item;
    }

    private function entry(string $catalog, string $id): array
    {
        foreach ($this->catalog[$catalog] as $row) if ($row['id'] === $id) return $row;
        throw new InvalidArgumentException('Unknown ' . $catalog . ' entry.');
    }

    private function cash(string $playerId, int $delta, string $reason, string $correlationId): void
    {
        $balance = $this->player($playerId)['cash'] + $delta;
        if ($balance < 0) throw new RuntimeException('Not enough cash.');
        if ($delta === 0) return;
        $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['cash' => $balance, 'id' => $playerId]);
        $this->ledger->record($playerId, 'cash', $delta, $balance, $reason, $correlationId);
    }

    private function awardXp(string $playerId, int $xp, string $correlationId): void
    {
        $this->database->execute('UPDATE players SET xp = xp + :xp WHERE id = :id', ['xp' => $xp, 'id' => $playerId]);
        (new LevelingService($this->database, $this->ledger, $this->events))->sync($playerId, $correlationId);
    }

    private function completeEducation(string $playerId, array &$state): bool
    {
        if ($state['edu'] === null || $state['edu']['until'] > $this->now()) return false;
        $id = $state['edu']['id'];
        if (empty($state['eduDone'][$id]) && $id === 'bio') $this->database->execute('UPDATE players SET max_life = max_life + 50 WHERE id = :id', ['id' => $playerId]);
        $state['eduDone'][$id] = 1;
        $state['edu'] = null;
        $this->events->publish(new DomainEvent('EducationCompleted', ['playerId' => $playerId, 'courseId' => $id]));
        return true;
    }

    private function load(string $playerId): array
    {
        $row = $this->database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
        if ($row !== null) {
            $state = json_decode($row['state_json'], true, 512, JSON_THROW_ON_ERROR);
            $state['version'] = (int) $row['version'];
            if (($state['catalogRevision'] ?? null) !== $this->catalogRevision) {
                // A published balance change invalidates old purchase views,
                // while preserving owned IDs, stock, progress and real timers.
                $state['catalogRevision'] = $this->catalogRevision;
                $property = $this->entry('properties', $state['prop']);
                $player = $this->player($playerId);
                $this->database->execute('UPDATE players SET max_happy = :maximum, happy = :happy WHERE id = :id', ['maximum' => $property['happy'], 'happy' => min($player['happy'], $property['happy']), 'id' => $playerId]);
                $this->save($playerId, $state);
            }
            return $state;
        }
        $now = $this->now();
        $state = [
            'version' => 1, 'catalogRevision' => $this->catalogRevision, 'inv' => ['revolver' => 1, 'bat' => 1, 'smallkit' => 3, 'drink' => 2, 'sand' => 12], 'equip' => 'bat',
            'points' => 120, 'merits' => 6, 'job' => 'grocer', 'jobPts' => 38, 'gym' => 2, 'gymXp' => 260,
            'prop' => 'apt', 'ownedProperties' => ['apt' => 1, 'shack' => 1], 'edu' => null, 'eduDone' => [],
            'ctr' => ['crimes' => 0, 'trains' => 0, 'wins' => 0, 'shifts' => 0, 'buys' => 0], 'claimed' => [], 'skill' => [], 'crimeXp' => 96,
            'fac' => ['respect' => 41820, 'chain' => 0, 'best' => 128, 'chainAt' => 0, 'ups' => [], 'warEnd' => 0],
            'jailUntil' => 0, 'hospUntil' => 0, 'market' => [], 'inmates' => [], 'patients' => [],
        ];
        foreach ($this->catalog['market'] as $listing) {
            $price = $this->catalog['items'][$listing['item']]['price'];
            $state['market'][] = [...$listing, 'price' => $price, 'base' => $price];
        }
        foreach (['Marrow', 'Silas', 'Duke_X', 'Tariq', 'Lady_Vega', 'K1ng', 'Sami', 'Noor'] as $index => $name) {
            $state['inmates'][] = ['id' => 'inmate-' . $index, 'name' => $name, 'lvl' => 5 + $index * 4, 'until' => $now + ($index * 7 + 3) * 60000, 'reason' => ['crime', 'bust', 'shop', 'graf'][$index % 4], 'out' => false];
        }
        foreach (['Omar_Z', 'Rayan_Black', 'Dmitri', 'Layla_R', 'Silas', 'BigSal', 'Kaya_V'] as $index => $name) {
            $state['patients'][] = ['id' => 'patient-' . $index, 'name' => $name, 'lvl' => 8 + $index * 5, 'until' => $now + ($index * 9 + 5) * 60000, 'reason' => ['attack', 'crime', 'od'][$index % 3], 'who' => ['BigSal', 'NadiaQuick', 'Duke_X'][$index % 3]];
        }
        $this->database->insertIgnore('player_progression', ['player_id', 'state_json', 'version', 'updated_at'], [$playerId, json_encode($state, JSON_THROW_ON_ERROR), 1, gmdate('c')]);
        return $state;
    }

    private function save(string $playerId, array &$state): void
    {
        $state['version']++;
        $this->database->execute('UPDATE player_progression SET state_json = :state, version = :version, updated_at = :updated WHERE player_id = :id', ['state' => json_encode($state, JSON_THROW_ON_ERROR), 'version' => $state['version'], 'updated' => gmdate('c'), 'id' => $playerId]);
    }

    private function response(string $playerId, array $state): array
    {
        $discount = $this->marketDiscount($playerId);
        foreach ($state['market'] as &$listing) {
            $listing['base'] = (int) $this->catalog['items'][$listing['item']]['price'];
            $listing['price'] = $this->marketPrice($listing['base'], $discount);
            $listing['discountBasisPoints'] = $discount;
        }
        unset($listing);
        return ['player' => $this->player($playerId), 'state' => $state, 'catalogs' => $this->catalog];
    }

    private function marketDiscount(string $playerId): int
    {
        if (!(new PublishedRules($this->database))->moduleEnabled('territories')) return 0;
        // Keep the merchant discount below the 10% resale spread.
        return min(800, (new TerritoryService($this->database, $this->events))->bonusBasisPoints($playerId, 'market_discount'));
    }

    private function marketPrice(int $base, int $discount): int
    {
        return max(1, (int) ceil($base * (10000 - $discount) / 10000));
    }
}
