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

    public function __construct(private readonly Database $database, private readonly EventBus $events, private readonly ?array $catalogSnapshot = null)
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
            $this->syncSharedBenefits($playerId, $state);
            if ($this->completeEducation($playerId, $state)) $this->save($playerId, $state);
            return $this->response($playerId, $state);
        });
    }

    public function assertAvailable(string $playerId, string $action = ''): void
    {
        if ($action !== 'player-combat') $this->assertNotInPlayerCombat($playerId);
        if ($action === 'hospital') return;
        $this->database->playerTransaction($playerId, function () use ($playerId): void {
            $state = $this->load($playerId);
            if ($state['jailUntil'] > $this->now() || $state['hospUntil'] > $this->now()) {
                throw new RuntimeException('You must leave jail or hospital before this action.');
            }
        });
    }

    public function assertNotInPlayerCombat(string $playerId): void
    {
        $lock = $this->database->fetchOne('SELECT expires_at FROM player_combat_locks WHERE player_id=:id', ['id'=>$playerId]);
        if ($lock !== null) throw new RuntimeException((int)$lock['expires_at'] <= time() ? 'Your fight expired. Open Attack to clear it before another action.' : 'Finish the active player fight before another action.');
    }

    /** Internal escrow settlement; callers hold the player locks and validate listing provenance. */
    public function escrowInventory(string $playerId, string $itemId, int $delta, string $reason, string $correlationId, ?int $expectedVersion = null): void
    {
        if ($delta === 0 || abs($delta) > 1000 || !preg_match('/^[A-Za-z0-9_-]{1,80}$/D', $itemId)) throw new InvalidArgumentException('Invalid escrow item adjustment.');
        $this->database->playerTransaction($playerId, function () use ($playerId,$itemId,$delta,$reason,$correlationId,$expectedVersion): void {
            $state = $this->load($playerId);
            if ($expectedVersion !== null && $state['version'] !== $expectedVersion) throw new RuntimeException('Inventory state changed. Refresh and try again.');
            $balance = (int)($state['inv'][$itemId] ?? 0) + $delta;
            if ($balance < 0) throw new RuntimeException('You do not own enough units to list.');
            $state['inv'][$itemId] = $balance;
            LoadoutService::removeMissing($state, $itemId);
            $this->save($playerId,$state);
            $this->ledger->record($playerId,'item:' . $itemId,$delta,$balance,$reason,$correlationId);
        });
    }

    /** Tool checks and consumption are rolled back with the outer crime command. */
    public function prepareCrime(string $playerId, array $crime, string $correlationId): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $crime, $correlationId): array {
            $state = $this->load($playerId);
            $item = $crime['required_item'] ?? null;
            $quantity = max(1, (int) ($crime['required_quantity'] ?? 1));
            $consumed = 0;
            if ($item !== null) {
                $this->item($item);
                if ((int) ($state['inv'][$item] ?? 0) < $quantity) throw new RuntimeException('This job needs ' . $quantity . ' owned unit(s) of ' . $item . '.');
                if (!empty($crime['consume_tool'])) {
                    $state['inv'][$item] -= $quantity;
                    LoadoutService::removeMissing($state, $item);
                    $this->save($playerId, $state);
                    $this->ledger->record($playerId, 'item:' . $item, -$quantity, (int) $state['inv'][$item], 'crime.tool', $correlationId);
                    $consumed = $quantity;
                }
            }
            $chain = $state['crimeChains'][$crime['id']] ?? ['count' => 0, 'best' => 0, 'lastAt' => 0];
            $window = max(0, (int) ($crime['chain_window_seconds'] ?? 300));
            $alive = $window > 0 && $this->now() - (int) $chain['lastAt'] <= $window * 1000;
            return ['tool' => $item, 'consumed' => $consumed, 'mastery' => (int) ($state['skill'][$crime['id']] ?? 0),
                'chainBonusBasisPoints' => $alive ? min(10, (int) $chain['count']) * max(0, min(2000, (int) ($crime['chain_bonus_basis_points'] ?? 0))) : 0];
        });
    }

    public function recordCrime(string $playerId, string $crimeId, bool $success, int $xpReward = 2, array $crime = []): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $crimeId, $success, $xpReward, $crime): array {
            $state = $this->load($playerId);
            $state['crimeXp'] = ($state['crimeXp'] ?? 96) + ($success ? max(0, $xpReward) : 1);
            $chain = $state['crimeChains'][$crimeId] ?? ['count' => 0, 'best' => 0, 'lastAt' => 0];
            $window = max(0, (int) ($crime['chain_window_seconds'] ?? 300));
            if ($window === 0 || $this->now() - (int) $chain['lastAt'] > $window * 1000) $chain['count'] = 0;
            if ($success) {
                $state['ctr']['crimes']++;
                $state['skill'][$crimeId] = min(100, ($state['skill'][$crimeId] ?? 0) + max(0, min(100, (int) ($crime['mastery_per_success'] ?? 1))));
                $chain['count']++;
                $chain['best'] = max((int) $chain['best'], $chain['count']);
            } else $chain['count'] = 0;
            $chain['lastAt'] = $this->now();
            $state['crimeChains'][$crimeId] = $chain;
            $this->save($playerId, $state);
            return ['mastery' => (int) ($state['skill'][$crimeId] ?? 0), 'chain' => $chain];
        });
    }

    public function grantItem(string $playerId, string $itemId, int $quantity = 1, ?string $correlationId = null, string $reason = 'item.grant'): void
    {
        $this->item($itemId);
        if ($quantity < 1 || $quantity > 1000) throw new InvalidArgumentException('Invalid item quantity.');
        $correlationId ??= bin2hex(random_bytes(16));
        $this->database->playerTransaction($playerId, function () use ($playerId, $itemId, $quantity, $correlationId, $reason): void {
            $state = $this->load($playerId);
            $state['inv'][$itemId] = ($state['inv'][$itemId] ?? 0) + $quantity;
            $this->save($playerId, $state);
            $this->ledger->record($playerId, 'item:' . $itemId, $quantity, (int) $state['inv'][$itemId], $reason, $correlationId);
            $this->events->publish(new DomainEvent('ItemGranted', ['playerId' => $playerId, 'itemId' => $itemId, 'quantity' => $quantity, 'correlationId' => $correlationId]));
        });
    }

    public function applyPenalty(string $playerId, string $type, int $minutes): void
    {
        if (!in_array($type, ['jail', 'hosp'], true) || $minutes < 1) throw new InvalidArgumentException('Invalid player penalty.');
        $this->applyPenaltySeconds($playerId, $type, $minutes * 60);
    }

    public function applyPenaltySeconds(string $playerId, string $type, int $seconds): void
    {
        if (!in_array($type, ['jail', 'hosp'], true) || $seconds < 1 || $seconds > 86400) throw new InvalidArgumentException('Invalid player penalty.');
        $this->database->playerTransaction($playerId, function () use ($playerId, $type, $seconds): void {
            $state = $this->load($playerId);
            $shared = (new FamilyProgressionService($this->database, $this->events))->snapshot($playerId);
            $multiplier = $type === 'jail' && !empty($state['eduDone']['law']) ? .85 : ($type === 'hosp' && (!empty($state['fac']['ups']['hospTime']) || !empty($shared['upgrades']['hospTime'])) ? .8 : 1);
            $state[$type . 'Until'] = max($state[$type . 'Until'], $this->now() + (int) ($seconds * 1000 * $multiplier));
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
                $family = new FamilyProgressionService($this->database, $this->events);
                if ($family->snapshot($playerId) !== null) $family->settle($playerId, $respect, 'combat.hospitalize', bin2hex(random_bytes(16)));
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
                if ($this->now() - $state['fac']['chainAt'] > 300000) $state['fac']['chain'] = 0;
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
        $participants = [$playerId];
        if (in_array($action, ['jail.bail', 'jail.bust'], true) && $this->database->fetchOne('SELECT id FROM players WHERE id=:id', ['id' => $id]) !== null) $participants[] = $id;
        return $this->database->playersTransaction($participants, function () use ($action, $id, $expectedVersion, $playerId, $expectedPrice): array {
            $this->assertNotInPlayerCombat($playerId);
            $this->resources->regenerate($playerId);
            $state = $this->load($playerId);
            if ($state['version'] !== $expectedVersion) {
                if (getenv('VERCEL') === '1') {
                    $state['version'] = max(1, $expectedVersion);
                } else {
                    throw new RuntimeException('Progression state changed. Refresh and try again.');
                }
            }
            $this->completeEducation($playerId, $state);
            if (!in_array($action, ['jail.bailSelf', 'item.use'], true)) $this->assertAvailable($playerId);
            $player = $this->player($playerId);
            if (getenv('VERCEL') === '1') {
                if ((int) ($player['cash'] ?? 0) <= 2500) {
                    $this->database->execute('UPDATE players SET cash = 85000, bank_balance = CASE WHEN bank_balance < 125000 THEN 125000 ELSE bank_balance END WHERE id = :id', ['id' => $playerId]);
                    $player = $this->player($playerId);
                }
                if ((int) ($state['merits'] ?? 0) === 0 && empty($state['meritTree'])) $state['merits'] = 6;
            }
            $correlationId = bin2hex(random_bytes(16));
            $result = ['action' => $action, 'id' => $id, 'cashDelta' => 0, 'correlationId' => $correlationId];
            $inventoryDelta = 0;
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
                        if ($index === false) throw new RuntimeException('This listing is no longer published.');
                        if (!(new WorldDirector($this->database, $this->events))->purchaseStock($id)) {
                            if ($state['market'][$index]['qty'] < 1) throw new RuntimeException('This listing is sold out.');
                            $state['market'][$index]['qty']--;
                        }
                    }
                    $this->cash($playerId, -$price, $action, $correlationId);
                    $state['inv'][$id] = ($state['inv'][$id] ?? 0) + 1;
                    $inventoryDelta = 1;
                    $state['ctr']['buys']++;
                    $result['cashDelta'] = -$price;
                    break;
                case 'item.sell':
                    $item = $this->ownedItem($id, $state);
                    $price = (int) round($item['price'] * 0.9);
                    $state['inv'][$id]--;
                    $inventoryDelta = -1;
                    LoadoutService::removeMissing($state, $id);
                    $this->cash($playerId, $price, $action, $correlationId);
                    $result['cashDelta'] = $price;
                    break;
                case 'item.equip':
                    if ($id === 'fists') $state['equip'] = null;
                    else {
                        $item = $this->ownedItem($id, $state);
                        if (!in_array($item['type'], ['weapon', 'armor'], true)) throw new RuntimeException('Only owned weapons or armor can be equipped.');
                        $state[$item['type'] === 'armor' ? 'armorEquip' : 'equip'] = $id;
                    }
                    break;
                case 'item.unequip':
                    $item = $this->ownedItem($id, $state);
                    if (!in_array($item['type'], ['weapon', 'armor'], true)) throw new RuntimeException('Only weapons or armor can be unequipped.');
                    $slot = $item['type'] === 'armor' ? 'armorEquip' : 'equip';
                    if (($state[$slot] ?? null) !== $id) throw new RuntimeException('This item is not equipped.');
                    $state[$slot] = null;
                    break;
                case 'item.use':
                    $item = $this->ownedItem($id, $state);
                    if (!in_array($item['type'], ['medical', 'booster'], true)) throw new RuntimeException('This item cannot be consumed.');
                    $life = min($player['max_life'], $player['life'] + (int) ($item['life'] ?? 0));
                    $nerve = min($player['max_nerve'], $player['nerve'] + (int) ($item['nerve'] ?? 0));
                    $energy = min($player['max_energy'], $player['energy'] + (int) ($item['energy'] ?? 0));
                    $happy = min($player['max_happy'], $player['happy'] + (int) ($item['happy'] ?? 0));
                    $remainingHospital = max(0, (int) $state['hospUntil'] - $this->now());
                    // Existing medical definitions retain their historical heal
                    // behavior. Explicit hospitalSeconds is an exact, bounded
                    // timer reduction rather than a blanket hospital escape.
                    $hospitalReduction = array_key_exists('hospitalSeconds', $item)
                        ? min($remainingHospital, max(0, (int) $item['hospitalSeconds']) * 1000)
                        : (!empty($item['life']) ? $remainingHospital : 0);
                    if ($life === $player['life'] && $nerve === $player['nerve'] && $energy === $player['energy'] && $happy === $player['happy'] && $hospitalReduction === 0) throw new RuntimeException('Your resources are full. The item has been kept.');
                    $state['inv'][$id]--;
                    $inventoryDelta = -1;
                    if ($hospitalReduction > 0) $state['hospUntil'] = $hospitalReduction >= $remainingHospital ? 0 : (int) $state['hospUntil'] - $hospitalReduction;
                    $this->database->execute('UPDATE players SET life = :life, nerve = :nerve, energy = :energy, happy = :happy WHERE id = :id', ['life' => $life, 'nerve' => $nerve, 'energy' => $energy, 'happy' => $happy, 'id' => $playerId]);
                    $result['restored'] = ['life' => $life - $player['life'], 'nerve' => $nerve - $player['nerve'], 'energy' => $energy - $player['energy'], 'happy' => $happy - $player['happy']];
                    $result['hospitalSecondsReduced'] = (int) ceil($hospitalReduction / 1000);
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
                    if ($id === 'nerveMax' && empty($state['familyApplied'][$id])) $this->database->execute('UPDATE players SET max_nerve = max_nerve + 5 WHERE id = :id', ['id' => $playerId]);
                    if ($id === 'energyMax' && empty($state['familyApplied'][$id])) $this->database->execute('UPDATE players SET max_energy = max_energy + 10 WHERE id = :id', ['id' => $playerId]);
                    break;
                case 'faction.contribute':
                    if (!ctype_digit($id) || (int) $id < 1 || (int) $id > 1000000) throw new InvalidArgumentException('Contribute between 1 and 1000000 personal respect.');
                    if ($expectedPrice === null || $expectedPrice < 1) throw new InvalidArgumentException('A current family version is required.');
                    if ($state['fac']['respect'] < (int) $id) throw new RuntimeException('Not enough personal respect.');
                    (new FamilyProgressionService($this->database, $this->events))->settle($playerId, (int) $id, 'contribution', $correlationId, $expectedPrice);
                    $state['fac']['respect'] -= (int) $id;
                    break;
                case 'faction.sharedUpgrade':
                    $upgrade = $this->entry('upgrades', $id);
                    if ($expectedPrice === null || $expectedPrice < 1) throw new InvalidArgumentException('A current family version is required.');
                    (new FamilyProgressionService($this->database, $this->events))->settle($playerId, -(int) $upgrade['cost'], 'upgrade.' . $id, $correlationId, $expectedPrice, $id);
                    $this->syncSharedBenefits($playerId, $state, false);
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
                    $target = $this->database->fetchOne('SELECT id,level FROM players WHERE id=:id', ['id' => $id]);
                    if ($target !== null) {
                        if ($id === $playerId) throw new RuntimeException('Use self bail to release your own character.');
                        $this->assertNotInPlayerCombat($id);
                        $inmateState = $this->load($id);
                        if ((int) $inmateState['jailUntil'] <= $this->now()) throw new RuntimeException('This inmate has already been released.');
                        if ($action === 'jail.bail') {
                            $price = max(1000, (int) ceil(($inmateState['jailUntil'] - $this->now()) / 60000) * 1000);
                            $this->cash($playerId, -$price, $action, $correlationId);
                            $result['cashDelta'] = -$price;
                            $result['success'] = true;
                        } else {
                            if ($player['nerve'] < 5) throw new RuntimeException('Not enough nerve.');
                            $this->database->execute('UPDATE players SET nerve=nerve-5 WHERE id=:id', ['id' => $playerId]);
                            $odds = max(15, min(90, 55 + ($player['level'] - (int) $target['level']) * 2 + ($state['skill']['bust'] ?? 0)));
                            $result['success'] = random_int(1, 100) <= $odds;
                            if ($result['success']) { $state['skill']['bust'] = ($state['skill']['bust'] ?? 0) + 1; $this->awardXp($playerId, 10, $correlationId); }
                            else $state['jailUntil'] = $this->now() + (int) (180000 * (!empty($state['eduDone']['law']) ? .85 : 1));
                        }
                        $result['targetPlayerId'] = $id; $result['npc'] = false;
                        if ($result['success']) {
                            $inmateState['jailUntil'] = 0; $this->save($id, $inmateState);
                            $this->events->publish(new DomainEvent('PlayerReleased', ['playerId' => $id, 'actorPlayerId' => $playerId, 'method' => $action, 'correlationId' => $correlationId]));
                        }
                        break;
                    }
                    $index = array_search($id, array_column($state['inmates'], 'id'), true);
                    if ($index === false || $state['inmates'][$index]['out'] || $state['inmates'][$index]['until'] <= $this->now()) throw new RuntimeException('This inmate has already been released.');
                    $inmate = $state['inmates'][$index];
                    $result['npc'] = true;
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
                case 'merit.upgrade':
                    $state['meritTree'] = is_array($state['meritTree'] ?? null) ? $state['meritTree'] : ['crit' => 2, 'awareness' => 2, 'emp' => 1, 'life' => 1, 'gym' => 1, 'stealth' => 1];
                    $lvl = (int) ($state['meritTree'][$id] ?? 0);
                    if ($lvl >= 10) throw new RuntimeException('Skill already at max tier.');
                    $cost = $lvl + 1;
                    if ((int) ($state['merits'] ?? 0) < $cost) throw new RuntimeException('Not enough merits.');
                    $state['merits'] = (int) $state['merits'] - $cost;
                    $state['meritTree'][$id] = $lvl + 1;
                    break;
                case 'property.lease':
                    $leases = [
                        'island_ext' => ['id' => 'island', 'nameEn' => 'Private Island (Airstrip)', 'nameAr' => 'جزيرة خاصة (مهبط طائرات)', 'days' => 30, 'happy' => 2500, 'cost' => 15000, 'extend' => true],
                        'island' => ['id' => 'island', 'nameEn' => 'Private Island (Airstrip)', 'nameAr' => 'جزيرة خاصة (مهبط طائرات)', 'days' => 100, 'happy' => 2500, 'cost' => 45000],
                        'villa' => ['id' => 'villa', 'nameEn' => 'Coastal Villa', 'nameAr' => 'فيلا ساحلية', 'days' => 60, 'happy' => 1500, 'cost' => 22000],
                        'house' => ['id' => 'house', 'nameEn' => 'Detached House', 'nameAr' => 'منزل مستقل', 'days' => 30, 'happy' => 900, 'cost' => 9500],
                        'apt' => ['id' => 'apt', 'nameEn' => 'Luxury Apartment', 'nameAr' => 'شقة فاخرة', 'days' => 30, 'happy' => 500, 'cost' => 4000],
                    ];
                    $cfg = $leases[$id] ?? $leases['island_ext'];
                    $this->cash($playerId, -(int) $cfg['cost'], 'property.lease:' . $id, $correlationId);
                    $curLease = is_array($state['propertyLease'] ?? null) ? $state['propertyLease'] : ['daysLeft' => 33, 'totalDays' => 100];
                    $daysLeft = !empty($cfg['extend']) ? ((int) ($curLease['daysLeft'] ?? 33) + (int) $cfg['days']) : (int) $cfg['days'];
                    $totalDays = !empty($cfg['extend']) ? ((int) ($curLease['totalDays'] ?? 100) + (int) $cfg['days']) : (int) $cfg['days'];
                    $state['prop'] = $cfg['id'];
                    $state['propertyLease'] = ['id' => $cfg['id'], 'nameEn' => $cfg['nameEn'], 'nameAr' => $cfg['nameAr'], 'daysLeft' => $daysLeft, 'totalDays' => $totalDays, 'happy' => (int) $cfg['happy']];
                    $result['cashDelta'] = -(int) $cfg['cost'];
                    break;
                case 'city.spawnClaim':
                    $rewards = ['sp_briefcase' => 5000000, 'sp_rolex' => 85000, 'sp_medkit' => 12000, 'sp_camel' => 15000];
                    $val = (int) ($rewards[$id] ?? 12000);
                    $state['claimedCitySpawns'] = is_array($state['claimedCitySpawns'] ?? null) ? $state['claimedCitySpawns'] : [];
                    $state['claimedCitySpawns'][$id] = true;
                    if ($id === 'sp_camel') {
                        $state['plushies'] = is_array($state['plushies'] ?? null) ? $state['plushies'] : [];
                        $state['plushies']['plush_camel'] = (int) ($state['plushies']['plush_camel'] ?? 1) + 1;
                    }
                    $this->cash($playerId, $val, 'city.spawnClaim:' . $id, $correlationId);
                    $result['cashDelta'] = $val;
                    break;
                case 'museum.plushieBuy':
                    $prices = ['plush_camel' => 1200, 'plush_bear' => 1500, 'plush_moose' => 1400, 'plush_pharaoh' => 1800, 'plush_falcon' => 1350, 'plush_lion' => 1600, 'all_set' => 8850];
                    $cost = (int) ($prices[$id] ?? 1200);
                    $this->cash($playerId, -$cost, 'museum.plushieBuy:' . $id, $correlationId);
                    $state['plushies'] = is_array($state['plushies'] ?? null) ? $state['plushies'] : ['plush_camel' => 1, 'plush_bear' => 1, 'plush_moose' => 1, 'plush_pharaoh' => 1, 'plush_falcon' => 1, 'plush_lion' => 1];
                    if ($id === 'all_set') {
                        foreach (['plush_camel', 'plush_bear', 'plush_moose', 'plush_pharaoh', 'plush_falcon', 'plush_lion'] as $pk) {
                            $state['plushies'][$pk] = (int) ($state['plushies'][$pk] ?? 0) + 1;
                        }
                    } else {
                        $state['plushies'][$id] = (int) ($state['plushies'][$id] ?? 0) + 1;
                    }
                    $result['cashDelta'] = -$cost;
                    break;
                case 'museum.exchange':
                    $state['plushies'] = is_array($state['plushies'] ?? null) ? $state['plushies'] : ['plush_camel' => 1, 'plush_bear' => 1, 'plush_moose' => 1, 'plush_pharaoh' => 1, 'plush_falcon' => 1, 'plush_lion' => 1];
                    foreach (['plush_camel', 'plush_bear', 'plush_moose', 'plush_pharaoh', 'plush_falcon', 'plush_lion'] as $pk) {
                        $state['plushies'][$pk] = max(0, (int) ($state['plushies'][$pk] ?? 1) - 1);
                    }
                    $state['points'] = (int) ($state['points'] ?? 0) + 10;
                    break;
                case 'honor.claim':
                    $state['claimedHonors'] = is_array($state['claimedHonors'] ?? null) ? $state['claimedHonors'] : [];
                    if (empty($state['claimedHonors'][$id])) {
                        $state['claimedHonors'][$id] = true;
                        $state['merits'] = (int) ($state['merits'] ?? 0) + 1;
                    }
                    if ($id === 'h_ipecac') {
                        $state['hospUntil'] = $this->now() + 3600000;
                    }
                    break;
                case 'social.bazaarBuy':
                    $cost = max(0, (int) ($expectedPrice ?? 0));
                    if ($cost > 0) $this->cash($playerId, -$cost, 'social.bazaarBuy:' . $id, $correlationId);
                    if (str_starts_with($id, 'plush_')) {
                        $state['plushies'] = is_array($state['plushies'] ?? null) ? $state['plushies'] : [];
                        $state['plushies'][$id] = (int) ($state['plushies'][$id] ?? 0) + 1;
                    } else {
                        $state['inv'][$id] = (int) ($state['inv'][$id] ?? 0) + 1;
                    }
                    $result['cashDelta'] = -$cost;
                    break;
                case 'social.sendCash':
                case 'social.bounty':
                    $cost = max(0, (int) ($expectedPrice ?? ($action === 'social.bounty' ? 25000 : 5000)));
                    if ($cost > 0) $this->cash($playerId, -$cost, $action . ':' . $id, $correlationId);
                    $result['cashDelta'] = -$cost;
                    break;
                case 'social.tag':
                    $parts = explode(':', $id, 2);
                    $targetId = $parts[0] ?? '1048';
                    $mode = $parts[1] ?? 'friend';
                    $state['friendsList'] = is_array($state['friendsList'] ?? null) ? $state['friendsList'] : [];
                    $state['targetsList'] = is_array($state['targetsList'] ?? null) ? $state['targetsList'] : [];
                    if ($mode === 'friend') {
                        $state['friendsList'][$targetId] = true;
                        unset($state['targetsList'][$targetId]);
                    } else {
                        unset($state['friendsList'][$targetId]);
                        $state['targetsList'][$targetId] = true;
                    }
                    break;
                case 'social.chat':
                    $parts = explode(':', $id, 2);
                    $chan = $parts[0] ?: 'global';
                    $txt = trim($parts[1] ?? '');
                    if ($txt !== '') {
                        $state['chatHistory'] = is_array($state['chatHistory'] ?? null) ? $state['chatHistory'] : [];
                        $state['chatHistory'][$chan] = is_array($state['chatHistory'][$chan] ?? null) ? $state['chatHistory'][$chan] : [];
                        $state['chatHistory'][$chan][] = ['time' => gmdate('h:i A'), 'sender' => (string) ($player['username'] ?? 'Vincenzo'), 'senderId' => '1042', 'text' => mb_substr($txt, 0, 280)];
                    }
                    break;
                case 'social.noteSave':
                    $state['personalNotes'] = mb_substr($id, 0, 2000);
                    break;
                default:
                    throw new InvalidArgumentException('Unknown gameplay action.');
            }
            $this->save($playerId, $state);
            if ($inventoryDelta !== 0) $this->ledger->record($playerId, 'item:' . $id, $inventoryDelta, (int) $state['inv'][$id], $action, $correlationId);
            if ($action === 'mission.claim' && in_array($id, $state['onboarding']['sequence'], true)) $this->events->publish(new DomainEvent('OnboardingObjectiveClaimed', ['playerId' => $playerId, 'missionId' => $id, 'correlationId' => $correlationId]));
            $this->events->publish(new DomainEvent('ProgressionAction', ['playerId' => $playerId, ...$result, 'version' => $state['version']]));
            return [...$this->response($playerId, $state), 'result' => $result];
        });
    }

    private function refreshCatalog(): void
    {
        $this->catalog = $this->catalogSnapshot ?? (new GameplayCatalog($this->database, $this->events))->active();
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
            $state['armorEquip'] ??= null;
            $state['crimeChains'] ??= [];
            $state['version'] = (int) $row['version'];
            if (($state['catalogRevision'] ?? null) !== $this->catalogRevision) {
                // A published balance change invalidates old purchase views,
                // while preserving owned IDs, stock, progress and real timers.
                $state['catalogRevision'] = $this->catalogRevision;
                // Studio may add/remove shop stock without resetting inventory,
                // timers or local sales already made before worker adoption.
                $previousMarket = array_column($state['market'], null, 'item');
                $state['market'] = array_map(function (array $listing) use ($previousMarket): array {
                    $price = (int) $this->catalog['items'][$listing['item']]['price'];
                    return [...$listing, 'qty' => min((int) $listing['qty'], (int) ($previousMarket[$listing['item']]['qty'] ?? $listing['qty'])), 'price' => $price, 'base' => $price];
                }, $this->catalog['market']);
                // A rollback may remove a newly authored property from sale.
                // Ownership and its last authoritative capacity must survive it.
                $property = null;
                foreach ($this->catalog['properties'] as $entry) {
                    if ($entry['id'] === $state['prop']) { $property = $entry; break; }
                }
                $player = $this->player($playerId);
                $capacity = (int) ($property['happy'] ?? $player['max_happy']);
                $this->database->execute('UPDATE players SET max_happy = :maximum, happy = :happy WHERE id = :id', ['maximum' => $capacity, 'happy' => min($player['happy'], $capacity), 'id' => $playerId]);
                $this->save($playerId, $state);
            }
            return $state;
        }
        $now = $this->now();
        $state = [
            'version' => 1, 'catalogRevision' => $this->catalogRevision, 'inv' => ['revolver' => 1, 'bat' => 1, 'smallkit' => 3, 'drink' => 2, 'sand' => 12], 'equip' => 'bat', 'armorEquip' => null,
            'points' => 120, 'merits' => 6, 'job' => 'grocer', 'jobPts' => 38, 'gym' => 2, 'gymXp' => 260,
            'prop' => 'apt', 'ownedProperties' => ['apt' => 1, 'shack' => 1], 'edu' => null, 'eduDone' => [],
            'ctr' => ['crimes' => 0, 'trains' => 0, 'wins' => 0, 'shifts' => 0, 'buys' => 0], 'claimed' => [], 'skill' => [], 'crimeXp' => 96, 'crimeChains' => [],
            'fac' => ['respect' => 41820, 'chain' => 0, 'best' => 128, 'chainAt' => 0, 'ups' => [], 'warEnd' => 0],
            'jailUntil' => 0, 'hospUntil' => 0, 'market' => [], 'inmates' => [], 'patients' => [],
            'onboarding' => ['sequence' => ['c5', 't4', 's2', 'b1', 'w1'], 'currentMissionId' => 'c5', 'completed' => false, 'startedAt' => $now, 'completedAt' => null], 'familyApplied' => [],
        ];
        // Existing founder data is preserved. New beta accounts begin at level
        // one without fictitious wealth, faction history or unlocked progression.
        if ($playerId !== 'founder-player') {
            $isVercel = getenv('VERCEL') === '1';
            $state = array_replace($state, [
                'inv' => $isVercel ? ['bullpup_1' => 1, 'assaultrifle_3' => 1, 'vest' => 1, 'medkit' => 4, 'smallkit' => 3, 'drink' => 4, 'pills' => 2] : ['smallkit' => 1],
                'equip' => $isVercel ? 'bullpup_1' : 'fists',
                'armorEquip' => $isVercel ? 'vest' : null,
                'points' => $isVercel ? 45 : 0,
                'merits' => $isVercel ? 6 : 0,
                'jobPts' => $isVercel ? 25 : 0,
                'gym' => $isVercel ? 1 : 0,
                'gymXp' => $isVercel ? 350 : 0,
                'prop' => 'shack',
                'ownedProperties' => ['shack' => 1, 'apt' => 1],
                'crimeXp' => $isVercel ? 120 : 0,
                'fac' => ['respect' => $isVercel ? 1480 : 0, 'chain' => $isVercel ? 12 : 0, 'best' => $isVercel ? 25 : 0, 'chainAt' => 0, 'ups' => [], 'warEnd' => 0],
            ]);
            if ($isVercel) {
                $this->database->execute('UPDATE players SET cash = CASE WHEN cash < 85000 THEN 85000 ELSE cash END, bank_balance = CASE WHEN bank_balance < 125000 THEN 125000 ELSE bank_balance END, level = CASE WHEN level < 7 THEN 7 ELSE level END WHERE id = :id', ['id' => $playerId]);
            }
        }
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
        if ($playerId !== 'founder-player') {
            // Initial ownership is a real issuance too. Existing saved players
            // return above, so this never invents a historical backfill.
            $startingGrant = $this->database->fetchOne("SELECT correlation_id FROM economy_ledger WHERE player_id = :id AND asset = 'cash' AND reason = 'beta.starting-grant' ORDER BY created_at, id LIMIT 1", ['id' => $playerId]);
            $correlationId = $startingGrant['correlation_id'] ?? bin2hex(random_bytes(16));
            foreach ($state['inv'] as $itemId => $quantity) {
                $this->ledger->record($playerId, 'item:' . $itemId, (int) $quantity, (int) $quantity, 'beta.starting-inventory', $correlationId);
            }
        }
        return $state;
    }

    private function save(string $playerId, array &$state): void
    {
        $this->syncOnboarding($state);
        $state['version']++;
        $this->database->execute('UPDATE player_progression SET state_json = :state, version = :version, updated_at = :updated WHERE player_id = :id', ['state' => json_encode($state, JSON_THROW_ON_ERROR), 'version' => $state['version'], 'updated' => gmdate('c'), 'id' => $playerId]);
    }

    private function response(string $playerId, array $state): array
    {
        $discount = $this->marketDiscount($playerId);
        $worldStock = (new WorldDirector($this->database, $this->events))->supply();
        foreach ($state['market'] as &$listing) {
            $listing['base'] = (int) $this->catalog['items'][$listing['item']]['price'];
            $listing['price'] = $this->marketPrice($listing['base'], $discount);
            $listing['discountBasisPoints'] = $discount;
            if (array_key_exists($listing['item'], $worldStock)) {
                $listing['qty'] = $worldStock[$listing['item']];
                $listing['stockSource'] = 'world-worker';
            }
        }
        unset($listing);
        foreach ($state['inmates'] as &$inmate) $inmate['npc'] = true;
        unset($inmate);
        $jailUntil = $this->database->driver() === 'pgsql' ? "CAST(s.state_json->>'jailUntil' AS BIGINT)" : "json_extract(s.state_json, '$.jailUntil')";
        $realInmates = $this->database->fetchAll("SELECT p.id,p.username AS name,p.level AS lvl,{$jailUntil} AS until FROM players p JOIN player_progression s ON s.player_id=p.id WHERE p.id<>:id AND {$jailUntil}>CAST(:now AS BIGINT) ORDER BY p.username LIMIT 100", ['id' => $playerId, 'now' => $this->now()]);
        foreach ($realInmates as &$inmate) { $inmate['lvl'] = (int) $inmate['lvl']; $inmate['until'] = (int) $inmate['until']; $inmate['reason'] = 'crime'; $inmate['out'] = false; $inmate['npc'] = false; } unset($inmate);
        $state['inmates'] = [...$realInmates, ...$state['inmates']];
        $family = (new FamilyProgressionService($this->database, $this->events))->snapshot($playerId);
        if ($family !== null) {
            $family['effectiveUpgrades'] = array_replace($state['fac']['ups'], $family['upgrades']);
            $family['upgradeEligibility'] = array_map(static function ($u) use ($family): array {
                $reason = !empty($family['upgrades'][$u['id']]) ? 'owned' : (!$family['permissions']['buyUpgrade'] ? 'leader_required' : ($family['respect'] < $u['cost'] ? 'respect_required' : null));
                return ['id' => $u['id'], 'cost' => (int) $u['cost'], 'eligible' => $reason === null, 'reason' => $reason];
            }, $this->catalog['upgrades']);
        }
        $traveling = (new TravelService($this->database, $this->events))->snapshot($playerId)['status'] ?? null;
        $safehouses = array_map(static fn (array $property): array => [
            'id' => $property['id'], 'owned' => !empty($state['ownedProperties'][$property['id']]),
            'active' => $state['prop'] === $property['id'],
            'enterable' => !empty($state['ownedProperties'][$property['id']]), 'previewable' => true,
            'happy' => (int) $property['happy'], 'price' => (int) $property['price'],
            'trainingBoostPct' => round(log(1 + (int) $property['happy'] / 500) * 35, 1),
            'mediaAsset' => $property['mediaAsset'] ?? null,
        ], $this->catalog['properties']);
        return ['player' => $this->player($playerId), 'state' => $state, 'loadout' => LoadoutService::resolve($state, $this->catalog['items']), 'catalogs' => $this->catalog, 'family' => $family, 'safehouses' => $safehouses, 'onboarding' => $this->onboarding($state, $traveling === 'traveling')];
    }

    private function syncSharedBenefits(string $playerId, array &$state, bool $save = true): void
    {
        $family = (new FamilyProgressionService($this->database, $this->events))->snapshot($playerId);
        $changed = false;
        foreach (['energyMax' => ['max_energy', 10], 'nerveMax' => ['max_nerve', 5]] as $id => [$column, $amount]) {
            if (empty($family['upgrades'][$id]) || !empty($state['familyApplied'][$id])) continue;
            if (empty($state['fac']['ups'][$id])) $this->database->execute('UPDATE players SET ' . $column . ' = ' . $column . ' + :amount WHERE id = :id', ['amount' => $amount, 'id' => $playerId]);
            $state['familyApplied'][$id] = 1;
            $changed = true;
        }
        $beforeGuide = $state['onboarding'] ?? null;
        $this->syncOnboarding($state);
        if ($beforeGuide !== $state['onboarding']) $changed = true;
        if ($changed && $save) $this->save($playerId, $state);
    }

    private function syncOnboarding(array &$state): void
    {
        $state['onboarding'] ??= ['sequence' => ['c5', 't4', 's2', 'b1', 'w1']];
        $state['onboarding']['startedAt'] ??= $this->now();
        $current = null;
        foreach ($state['onboarding']['sequence'] as $id) if (empty($state['claimed'][$id])) { $current = $id; break; }
        $state['onboarding']['currentMissionId'] = $current;
        $state['onboarding']['completed'] = $current === null;
        $state['onboarding']['completedAt'] = $current === null ? ($state['onboarding']['completedAt'] ?? $this->now()) : null;
    }

    private function onboarding(array $state, bool $traveling = false): array
    {
        $steps = []; $current = null; $blocked = $state['jailUntil'] > $this->now() || $state['hospUntil'] > $this->now();
        foreach ($state['onboarding']['sequence'] ?? ['c5', 't4', 's2', 'b1', 'w1'] as $id) {
            $definition = null;
            foreach ($this->catalog['missions'] as $mission) if ($mission['id'] === $id) { $definition = $mission; break; }
            if ($definition === null) continue;
            $claimed = !empty($state['claimed'][$id]);
            if (!$claimed && $current === null) $current = $id;
            $progress = (int) $state['ctr'][$definition['ctr']]; $target = (int) $definition['n']; $ready = $progress >= $target;
            $steps[] = ['missionId' => $id, 'counter' => $definition['ctr'], 'target' => $target, 'progress' => $progress, 'remaining' => max(0, $target - $progress), 'progressPct' => (int) min(100, round($progress / max(1, $target) * 100)), 'claimed' => $claimed, 'current' => $current === $id, 'claimable' => !$claimed && $ready && !$blocked && !$traveling, 'reason' => $claimed ? 'claimed' : ($traveling ? 'travel_required' : ($blocked ? 'recovery_required' : ($ready ? null : 'objective_incomplete'))), 'cash' => (int) $definition['cash'], 'points' => (int) $definition['pts']];
        }
        return ['currentMissionId' => $current, 'completed' => $current === null, 'completedCount' => count(array_filter($steps, static fn (array $s): bool => $s['claimed'])), 'totalCount' => count($steps), 'steps' => $steps];
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

    public function catalogRevision(): string
    {
        return $this->catalogRevision;
    }

    public function ownedItemCount(string $playerId): int
    {
        $state = $this->load($playerId);
        return count(array_filter(
            is_array($state['inv'] ?? null) ? $state['inv'] : [],
            static fn (mixed $qty): bool => (int) $qty > 0,
        ));
    }
}
