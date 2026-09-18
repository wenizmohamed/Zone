<?php

declare(strict_types=1);

namespace Zone\Engine\Application;

use RuntimeException;
use Zone\Engine\Core\Contracts\CacheStore;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\ResourceService;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Themes\ThemeRegistry;

final class GameEngine
{
    private readonly Ledger $ledger;
    private readonly ResourceService $resources;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ModuleRegistry $modules,
        private readonly ThemeRegistry $themes,
        private readonly CacheStore $cache,
    ) {
        $this->ledger = new Ledger($database);
        $this->resources = new ResourceService($database);
    }

    public function status(): array
    {
        return [
            'engine' => 'ZONE Engine',
            'version' => '0.1.0-foundation',
            'php' => PHP_VERSION,
            'database' => $this->database->driver(),
            'cacheAdapter' => $this->cache->adapterName(),
            'redisPortReady' => true,
            'api' => 'v1',
            'serverAuthoritative' => true,
            'moduleCount' => count(array_filter($this->modules->all(), static fn (array $module): bool => $module['installed'])),
            'activeTheme' => array_values(array_filter($this->themes->all(), static fn (array $theme): bool => $theme['active']))[0]['id'] ?? null,
            'capabilities' => [
                'module-discovery',
                'module-install-enable-disable-uninstall',
                'domain-events',
                'theme-switching',
                'resource-regeneration',
                'economy-ledger',
                'api-first-gameplay',
                'postgresql-schema',
                'redis-cache-port',
            ],
        ];
    }

    public function modules(): array
    {
        return $this->modules->all();
    }

    public function themes(): array
    {
        return $this->themes->all();
    }

    public function changeModule(string $id, string $action): array
    {
        $module = $this->modules->changeState($id, $action);
        $this->events->publish(new DomainEvent('ModuleStateChanged', ['moduleId' => $id, 'action' => $action]));
        return $module;
    }

    public function activateTheme(string $id): array
    {
        $theme = $this->themes->activate($id);
        $this->events->publish(new DomainEvent('ThemeActivated', ['themeId' => $id]));
        return $theme;
    }

    public function activeThemeStylesheet(): string
    {
        return $this->themes->activeStylesheet();
    }

    public function player(string $playerId = 'demo-player'): array
    {
        return $this->resources->regenerate($playerId);
    }

    public function crimes(): array
    {
        if (!$this->modules->isEnabled('crime')) {
            return [];
        }
        return array_map(static function (array $crime): array {
            foreach (['nerve_cost', 'success_basis_points', 'cash_min', 'cash_max', 'xp_reward'] as $field) {
                $crime[$field] = (int) $crime[$field];
            }
            $crime['successRate'] = $crime['success_basis_points'] / 100;
            unset($crime['success_basis_points'], $crime['enabled']);
            return $crime;
        }, $this->database->fetchAll('SELECT * FROM crimes WHERE enabled = 1 ORDER BY nerve_cost'));
    }

    public function attemptCrime(string $crimeId, string $playerId = 'demo-player'): array
    {
        if (!$this->modules->isEnabled('crime')) {
            throw new RuntimeException('Crime module is disabled. Re-enable it from the module manager.');
        }
        $this->resources->regenerate($playerId);

        return $this->database->transaction(function () use ($crimeId, $playerId): array {
            $crime = $this->database->fetchOne('SELECT * FROM crimes WHERE id = :id AND enabled = 1', ['id' => $crimeId]);
            if ($crime === null) {
                throw new RuntimeException("Unknown crime: {$crimeId}");
            }
            $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
            if ($player === null) {
                throw new RuntimeException("Unknown player: {$playerId}");
            }
            $nerveCost = (int) $crime['nerve_cost'];
            if ((int) $player['nerve'] < $nerveCost) {
                throw new RuntimeException('Not enough nerve for this crime.');
            }

            $correlationId = bin2hex(random_bytes(16));
            $roll = random_int(1, 10000);
            $success = $roll <= (int) $crime['success_basis_points'];
            $cashReward = $success ? random_int((int) $crime['cash_min'], (int) $crime['cash_max']) : 0;
            $xpReward = $success ? (int) $crime['xp_reward'] : 0;
            $newCash = (int) $player['cash'] + $cashReward;
            $newXp = (int) $player['xp'] + $xpReward;
            $newNerve = (int) $player['nerve'] - $nerveCost;

            $this->database->execute(
                'UPDATE players SET cash = :cash, xp = :xp, nerve = :nerve, resources_updated_at = :updated WHERE id = :id',
                ['id' => $playerId, 'cash' => $newCash, 'xp' => $newXp, 'nerve' => $newNerve, 'updated' => gmdate('c')],
            );
            if ($cashReward > 0) {
                $this->ledger->record($playerId, 'cash', $cashReward, $newCash, 'crime.reward', $correlationId);
            }

            $eventName = $success ? 'CrimeSucceeded' : 'CrimeFailed';
            $event = new DomainEvent($eventName, [
                'playerId' => $playerId,
                'crimeId' => $crimeId,
                'nerveSpent' => $nerveCost,
                'cashReward' => $cashReward,
                'xpReward' => $xpReward,
                'roll' => $roll,
                'successThreshold' => (int) $crime['success_basis_points'],
                'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);

            return [
                'success' => $success,
                'crime' => ['id' => $crimeId, 'name_en' => $crime['name_en'], 'name_ar' => $crime['name_ar']],
                'cost' => ['nerve' => $nerveCost],
                'reward' => ['cash' => $cashReward, 'xp' => $xpReward],
                'serverProof' => [
                    'eventId' => $event->id,
                    'correlationId' => $correlationId,
                    'calculatedBy' => 'PHP ' . PHP_VERSION,
                    'clientSuppliedOutcomeFields' => 0,
                ],
                'player' => $this->resources->normalize($this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId])),
            ];
        });
    }

    public function ledger(int $limit = 20): array
    {
        $limit = max(1, min(100, $limit));
        return $this->database->fetchAll("SELECT * FROM economy_ledger ORDER BY created_at DESC LIMIT {$limit}");
    }

    public function eventLog(int $limit = 30): array
    {
        $limit = max(1, min(100, $limit));
        $rows = $this->database->fetchAll("SELECT * FROM event_log ORDER BY occurred_at DESC LIMIT {$limit}");
        return array_map(static function (array $row): array {
            $row['payload'] = json_decode($row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
            unset($row['payload_json']);
            return $row;
        }, $rows);
    }

    public function achievements(string $playerId = 'demo-player'): array
    {
        return $this->database->fetchAll(
            'SELECT code, unlocked_at, source_event_id FROM achievements WHERE player_id = :player ORDER BY unlocked_at DESC',
            ['player' => $playerId],
        );
    }
}
