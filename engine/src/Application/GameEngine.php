<?php

declare(strict_types=1);

namespace Zone\Engine\Application;

use RuntimeException;
use Zone\Engine\Core\Contracts\CacheStore;
use Zone\Engine\Core\Content\ContentManager;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\ResourceService;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;
use Zone\Engine\Core\Themes\ThemeRegistry;

final class GameEngine
{
    private readonly Ledger $ledger;
    private readonly ResourceService $resources;
    private readonly ContentManager $content;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ModuleRegistry $modules,
        private readonly ThemeRegistry $themes,
        private readonly ReleaseManager $releases,
        private readonly CacheStore $cache,
    ) {
        $this->ledger = new Ledger($database);
        $this->resources = new ResourceService($database);
        $this->content = new ContentManager($database, $events);
    }

    public function status(): array
    {
        $release = $this->releases->active();
        return [
            'engine' => 'ZONE Engine',
            'version' => '1.0.0',
            'php' => PHP_VERSION,
            'database' => $this->database->driver(),
            'cacheAdapter' => $this->cache->adapterName(),
            'redisPortReady' => true,
            'api' => 'v1',
            'serverAuthoritative' => true,
            'moduleCount' => count(array_filter($this->modules->all(), static fn (array $module): bool => $module['installed'])),
            'activeTheme' => array_values(array_filter($this->themes->all(), static fn (array $theme): bool => $theme['active']))[0]['id'] ?? null,
            'activeReleaseId' => $release['id'],
            'activeReleaseVersion' => $release['version'],
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
                'draft-preview-publish-rollback',
                'admin-content-crud',
                'admin-audit-log',
            ],
        ];
    }

    public function releaseDraft(): array
    {
        return $this->releases->draft();
    }

    public function saveReleaseDraft(array $manifest, string $actor): array
    {
        return $this->releases->saveDraft($manifest, $actor);
    }

    public function publishRelease(string $actor): array
    {
        return $this->releases->publish($actor);
    }

    public function activeRelease(): array
    {
        return $this->releases->active();
    }

    public function releaseHistory(): array
    {
        return $this->releases->releases();
    }

    public function activateRelease(string $releaseId, string $actor): array
    {
        return $this->releases->activate($releaseId, $actor);
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

    public function player(string $playerId = 'founder-player'): array
    {
        return $this->resources->regenerate($playerId);
    }

    public function crimes(): array
    {
        if (!$this->modules->isEnabled('crime')) {
            return [];
        }
        return array_map(static function (array $crime): array {
            unset($crime['success_basis_points'], $crime['enabled']);
            return $crime;
        }, $this->content->crimes());
    }

    public function adminCrimes(): array
    {
        return $this->content->crimes(true);
    }

    public function saveCrime(string $id, array $definition, string $actor): array
    {
        return $this->content->saveCrime($id, $definition, $actor);
    }

    public function adminAuditLog(int $limit = 100): array
    {
        return $this->content->auditLog($limit);
    }

    public function attemptCrime(string $crimeId, string $playerId = 'founder-player'): array
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

    public function achievements(string $playerId = 'founder-player'): array
    {
        return $this->database->fetchAll(
            'SELECT code, unlocked_at, source_event_id FROM achievements WHERE player_id = :player ORDER BY unlocked_at DESC',
            ['player' => $playerId],
        );
    }
}
