<?php

declare(strict_types=1);

namespace Zone\Engine\Application;

use RuntimeException;
use Zone\Engine\Core\Contracts\CacheStore;
use Zone\Engine\Core\Content\ContentManager;
use Zone\Engine\Core\Content\GameplayCatalog;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CooldownService;
use Zone\Engine\Core\Game\DailyService;
use Zone\Engine\Core\Game\LevelingService;
use Zone\Engine\Core\Game\NotificationService;
use Zone\Engine\Core\Game\RateLimiter;
use Zone\Engine\Core\Game\ResourceService;
use Zone\Engine\Core\Game\ProgressionService;
use Zone\Engine\Core\Game\CombatService;
use Zone\Engine\Core\Game\PlayerCombatService;
use Zone\Engine\Core\Game\PlayerMarketService;
use Zone\Engine\Core\Game\FamilyActivityService;
use Zone\Engine\Core\Game\FamilyCompetitionSubscriber;
use Zone\Engine\Core\Game\TravelService;
use Zone\Engine\Core\Game\WorldDirector;
use Zone\Engine\Core\Media\AssetLibrary;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;
use Zone\Engine\Core\Publishing\PublishedRules;
use Zone\Engine\Core\Territories\TerritoryService;
use Zone\Engine\Core\Themes\ThemeRegistry;

final class GameEngine
{
    private readonly Ledger $ledger;
    private readonly ResourceService $resources;
    private readonly ContentManager $content;
    private readonly CooldownService $cooldowns;
    private readonly RateLimiter $rateLimiter;
    private readonly LevelingService $leveling;
    private readonly DailyService $daily;
    private readonly NotificationService $notifications;
    private readonly TerritoryService $territories;

    /** @var array<string, int> Effective cooldown seconds per action (config over defaults). */
    private readonly array $cooldownSeconds;

    /**
     * Fallback server-clock cooldown floors, in seconds, per state-changing
     * action. The authoritative values live in the cooldown_config table
     * (seeded from these); this const is only the defensive default if a row is
     * missing. These are anti-hammer floors; the real resource gates
     * (nerve/energy/cash) still apply. Bank stays at 0 (balance-gated) so a
     * deposit-then-withdraw flow is not blocked; the rate limiter still covers it.
     */
    private const COOLDOWN_DEFAULTS = [
        'crime' => 5,
        'attack' => 8,
        'gym' => 3,
        'job' => 10,
        'blackjack' => 3,
        'travel' => 15,
        'hospital' => 5,
        'bank' => 0,
        'territory' => 1,
    ];

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ModuleRegistry $modules,
        private readonly ThemeRegistry $themes,
        private readonly ReleaseManager $releases,
        private readonly CacheStore $cache,
    ) {
        $this->ledger = new Ledger($database);
        $this->notifications = new NotificationService($database);
        $this->resources = new ResourceService($database, $this->notifications);
        $this->content = new ContentManager($database, $events);
        $this->cooldowns = new CooldownService($database);
        $this->leveling = new LevelingService($database, $this->ledger, $events);
        $this->daily = new DailyService($database, $this->ledger, $events, $this->leveling);
        $this->territories = new TerritoryService($database, $events);
        $events->subscribe(new FamilyCompetitionSubscriber($database,$events,'PlayerCombatResolved'));
        $events->subscribe(new FamilyCompetitionSubscriber($database,$events,'TerritoryControlChanged'));
        if (!$this->releases->hasFoundation()) $this->releases->initializeContent($this->runtimeContent());
        $this->cooldownSeconds = $this->loadCooldownConfig();
        $rateMaxRaw = getenv('ZONE_RATE_LIMIT_MAX');
        $rateWindowRaw = getenv('ZONE_RATE_LIMIT_WINDOW');
        $this->rateLimiter = new RateLimiter(
            $database,
            $rateMaxRaw === false ? 120 : (int) $rateMaxRaw,
            $rateWindowRaw === false ? 10 : max(1, (int) $rateWindowRaw),
        );
    }

    /**
     * Load the per-action cooldown durations from the cooldown_config table,
     * layered over the code defaults so a missing row can never leave an action
     * uncovered. Defensive against a pre-migration construction.
     */
    private function loadCooldownConfig(): array
    {
        $seconds = self::COOLDOWN_DEFAULTS;
        try {
            foreach ($this->database->fetchAll('SELECT action, seconds FROM cooldown_config') as $row) {
                $seconds[(string) $row['action']] = (int) $row['seconds'];
            }
        } catch (\Throwable) {
            // Table not present yet (pre-migration); fall back to defaults.
        }
        return $seconds;
    }

    /**
     * Check the per-action cooldown while holding the player's mutation lock.
     * recordActionAttempt commits the rate-limit attempt before this transaction.
     */
    private function guardAction(string $playerId, string $action): void
    {
        $this->cooldowns->assertReady($playerId, $action);
        (new TravelService($this->database, $this->events))->assertAvailable($playerId);
        (new ProgressionService($this->database, $this->events))->assertAvailable($playerId, $action);
    }

    private function recordActionAttempt(string $playerId, bool $allowPlayerCombat = false): void
    {
        // Count rejected attempts too. Commit this before the gameplay
        // transaction so a cooldown or validation rollback cannot erase it.
        $this->database->playerTransaction($playerId, function () use ($playerId,$allowPlayerCombat): void {
            if (!$allowPlayerCombat) (new ProgressionService($this->database,$this->events))->assertNotInPlayerCombat($playerId);
            $this->rateLimiter->hit($playerId);
        });
    }

    private function armCooldown(string $playerId, string $action): void
    {
        $this->cooldowns->arm($playerId, $action, $this->cooldownSeconds[$action] ?? 0);
    }

    public function leaderboards(string $playerId): array
    {
        $this->requireModule('leaderboards');
        return (new \Zone\Modules\Leaderboards\LeaderboardService($this->database))->snapshot($playerId);
    }

    public function status(): array
    {
        $release = $this->releases->activeSummary();
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
            'activeTheme' => $release['activeTheme'],
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
                'territory-graph-and-adjacency',
                'server-authoritative-faction-control',
                'territory-benefits-and-wars',
            ],
        ];
    }

    public function releaseDraft(): array
    {
        return $this->releases->draft();
    }

    public function saveReleaseDraft(array $manifest, string $actor, ?string $expectedFingerprint = null): array
    {
        return $this->releases->saveDraft($manifest, $actor, $expectedFingerprint);
    }

    public function publishRelease(string $actor, ?string $expectedFingerprint = null): array
    {
        return $this->releases->configurationTransaction(function () use ($actor, $expectedFingerprint): array {
            $this->releases->assertDraftFingerprint($expectedFingerprint);
            $draft = $this->releases->draft();
            $draft['manifest']['content'] = $this->runtimeContent();
            $this->releases->saveDraft($draft['manifest'], $actor);
            return $this->releases->publish($actor);
        });
    }

    public function activeRelease(): array
    {
        return $this->releases->active();
    }

    public function gameBootstrap(): array
    {
        $release = $this->releases->active();
        $content = $release['manifest']['content'] ?? null;
        if (!is_array($content)) {
            $content = $this->releases->foundation()['content'] ?? [];
        }

        return [
            'release' => $release,
            'content' => $content,
            'mediaBindings' => $release['manifest']['mediaBindings'] ?? [],
            'mediaAssets' => $release['manifest']['mediaAssets'] ?? [],
            'worldPolicy' => WorldDirector::normalizePolicy($release['manifest']['worldPolicy'] ?? []),
        ];
    }

    public function assets(): AssetLibrary
    {
        return new AssetLibrary($this->database);
    }

    public function world(): WorldDirector
    {
        return new WorldDirector($this->database, $this->events);
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
        return $this->releases->configurationTransaction(function () use ($id, $action): array {
            $module = $this->modules->changeState($id, $action);
            $this->events->publish(new DomainEvent('ModuleStateChanged', ['moduleId' => $id, 'action' => $action]));
            return $module;
        });
    }

    public function activateTheme(string $id): array
    {
        return $this->releases->configurationTransaction(function () use ($id): array {
            $theme = $this->themes->activate($id);
            $this->events->publish(new DomainEvent('ThemeActivated', ['themeId' => $id]));
            return $theme;
        });
    }

    public function activeThemeStylesheet(): string
    {
        return $this->themes->activeStylesheet($this->publishedContent()['activeTheme'] ?? null);
    }

    public function player(string $playerId = 'founder-player'): array
    {
        (new TravelService($this->database, $this->events))->snapshot($playerId);
        return $this->resources->regenerate($playerId);
    }

    public function crimes(): array
    {
        if (!$this->publishedModuleEnabled('crime')) {
            return [];
        }
        return array_map(static function (array $crime): array {
            unset($crime['success_basis_points'], $crime['enabled']);
            return $crime;
        }, array_values(array_filter($this->publishedContent()['crimes'] ?? [], static fn (array $crime): bool => (bool) ($crime['enabled'] ?? false))));
    }

    public function adminCrimes(): array
    {
        return $this->enrichedCrimeDefinitions();
    }

    public function saveCrime(string $id, array $definition, string $actor): array
    {
        return $this->releases->configurationTransaction(function () use ($id, $definition, $actor): array {
            $saved = $this->content->saveCrime($id, $definition, $actor);
            foreach ($this->enrichedCrimeDefinitions() as $crime) {
                if ($crime['id'] === $id) return [...$crime, 'correlationId' => $saved['correlationId']];
            }
            throw new RuntimeException('Saved crime definition could not be loaded for preview.');
        });
    }

    public function adminAuditLog(int $limit = 100, bool $includeSnapshots = true): array
    {
        return $this->content->auditLog($limit, $includeSnapshots);
    }

    public function adminGameplayCatalog(): array
    {
        return (new GameplayCatalog($this->database, $this->events))->draft();
    }

    public function saveGameplayCatalog(string $category, string $id, array $changes, int $expectedRevision, string $actor): array
    {
        return (new GameplayCatalog($this->database, $this->events))->update($category, $id, $changes, $expectedRevision, $actor);
    }

    public function saveShopCatalog(array $listings, int $expectedRevision, string $actor): array
    {
        return (new GameplayCatalog($this->database, $this->events))->updateMarket($listings, $expectedRevision, $actor);
    }

    public function createGameplayCatalog(string $category, string $id, array $definition, int $expectedRevision, string $actor): array
    {
        return (new GameplayCatalog($this->database, $this->events))->create($category, $id, $definition, $expectedRevision, $actor);
    }

    public function browserSessions(): \Zone\Engine\Core\Security\BrowserSessions
    {
        return new \Zone\Engine\Core\Security\BrowserSessions($this->database);
    }

    public function playerAccounts(): \Zone\Engine\Core\Security\PlayerAccounts
    {
        return new \Zone\Engine\Core\Security\PlayerAccounts($this->database);
    }

    /** HTTP callers are owner-authorized by the router before obtaining this service. */
    public function ownerPlaytest(): \Zone\Engine\Core\Game\OwnerPlaytestService
    {
        return new \Zone\Engine\Core\Game\OwnerPlaytestService($this->database, $this);
    }

    public function attemptCrime(string $crimeId, string $playerId = 'founder-player'): array
    {
        if (!$this->publishedModuleEnabled('crime')) {
            throw new RuntimeException('Crime module is disabled. Re-enable it from the module manager.');
        }
        $this->recordActionAttempt($playerId);
        $materialLoot = new \Zone\Engine\Core\Game\MaterialLootService($this->database, $this->events);
        $published = $materialLoot->publishedContext();
        return $this->database->playerTransaction($playerId, function () use ($crimeId, $playerId, $materialLoot, $published): array {
            $this->resources->regenerate($playerId);
            $this->guardAction($playerId, 'crime');
            $streak = $this->daily->registerLogin($playerId, bin2hex(random_bytes(16)));
            $crime = array_values(array_filter($published['crimes'], static fn (array $crime): bool => $crime['id'] === $crimeId && (bool) ($crime['enabled'] ?? false)))[0] ?? null;
            if ($crime === null) {
                throw new RuntimeException("Unknown crime: {$crimeId}");
            }
            $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
            if ($player === null) {
                throw new RuntimeException("Unknown player: {$playerId}");
            }
            $levelRequired = (int) ($crime['level_required'] ?? 1);
            if ((int) $player['level'] < $levelRequired) {
                throw new \InvalidArgumentException("This crime unlocks at level {$levelRequired}.");
            }
            $progression = new ProgressionService($this->database, $this->events, $published['catalog']);
            $progress = $progression->snapshot($playerId)['state'];
            if (($progress['crimeXp'] ?? 0) < (int) ($crime['crime_xp_required'] ?? 0)) {
                throw new \InvalidArgumentException('Earn more crime experience to unlock this category.');
            }
            $nerveCost = (int) $crime['nerve_cost'];
            if ((int) $player['nerve'] < $nerveCost) {
                throw new RuntimeException('Not enough nerve for this crime.');
            }

            $correlationId = bin2hex(random_bytes(16));
            $preparation = $progression->prepareCrime($playerId, $crime, $correlationId);
            $roll = random_int(1, 10000);
            $territoryBonusBp = min(1500, $this->territoryBonus($playerId, 'crime_bonus'));
            $successThreshold = min(10000, (int) $crime['success_basis_points'] + $territoryBonusBp);
            if (isset($crime['failure'])) {
                $successThreshold = min(9700, $successThreshold + (int) round(((int) $player['level'] - 1) * 40 + ($progress['skill'][$crimeId] ?? 0) * 15));
            }
            $success = $roll <= $successThreshold;
            $cashReward = $success ? random_int((int) $crime['cash_min'], (int) $crime['cash_max']) : 0;
            if ($cashReward > 0) $cashReward += (int) floor($cashReward * $preparation['chainBonusBasisPoints'] / 10000);
            $xpReward = $success ? (int) $crime['xp_reward'] : 0;
            $newCash = (int) $player['cash'] + $cashReward;
            $newXp = (int) $player['xp'] + $xpReward;
            $newNerve = (int) $player['nerve'] - $nerveCost;

            $this->database->execute(
                'UPDATE players SET cash = :cash, xp = :xp, nerve = :nerve WHERE id = :id',
                ['id' => $playerId, 'cash' => $newCash, 'xp' => $newXp, 'nerve' => $newNerve],
            );
            if ($cashReward > 0) {
                $this->ledger->record($playerId, 'cash', $cashReward, $newCash, 'crime.reward', $correlationId);
            }
            $levelUp = $this->leveling->sync($playerId, $correlationId);
            $this->armCooldown($playerId, 'crime');
            $this->daily->recordProgress($playerId, 'crimes', 1);
            $crimeProgress = $progression->recordCrime($playerId, $crimeId, $success, $xpReward, $crime);
            $loot = null; $lootRollWon = null; $lootStatus = 'not-rolled';
            if ($success && ($crime['category'] ?? null) === 'search') $lootRollWon = random_int(1, 100) <= 12;
            if ($lootRollWon === false) $lootStatus = 'missed';
            if ($lootRollWon === true) {
                $issued = $materialLoot->issue('search', $correlationId, $playerId, 1, hexdec(substr($correlationId, 0, 6)),
                    static function (array $receipt) use ($progression, $playerId, $correlationId): void { $progression->grantItem($playerId, $receipt['itemId'], $receipt['quantity'], $correlationId, 'crime.loot'); }, $published);
                $lootStatus = $issued['status'];
                if ($lootStatus === 'awarded') $loot = ['itemId' => $issued['itemId'], 'quantity' => $issued['quantity']];
            }
            $penalty = null;
            $critical = !$success && random_int(1, 10000) <= (int) ($crime['critical_failure_basis_points'] ?? 0);
            if ($critical) {
                $jail = (int) ($crime['jail_seconds'] ?? 0); $hospital = (int) ($crime['hospital_seconds'] ?? 0);
                if ($jail > 0 || $hospital > 0) {
                    $type = $jail > 0 && ($hospital === 0 || random_int(0, 1) === 0) ? 'jail' : 'hosp';
                    $seconds = $type === 'jail' ? $jail : $hospital;
                    $progression->applyPenaltySeconds($playerId, $type, $seconds);
                    $penalty = ['type' => $type, 'seconds' => $seconds, 'minutes' => (int) ceil($seconds / 60)];
                }
            } elseif (!$success && (int) ($crime['jail_seconds'] ?? 0) === 0 && (int) ($crime['hospital_seconds'] ?? 0) === 0 && isset($crime['failure'], $crime['penalty_minutes']) && in_array($crime['failure'], ['jail', 'hosp'], true)) {
                // Old authored variants retain their original consequences.
                $critical = true;
                $progression->applyPenalty($playerId, (string) $crime['failure'], (int) $crime['penalty_minutes']);
                $penalty = ['type' => $crime['failure'], 'minutes' => (int) $crime['penalty_minutes']];
            }
            $outcome = $success ? 'success' : ($critical ? 'critical_failure' : 'failure');
            $narrative = match ($outcome) {
                'success' => ['en' => 'Clean hands, dirty money. Your contact counts the take and the street remembers your work.', 'ar' => 'شغل نظيف وفلوس وسخة. رجالك يعدّون الغلة، والشارع يحفظ اسمك.'],
                'critical_failure' => ($penalty['type'] ?? '') === 'jail'
                    ? ['en' => 'The lookout missed the blue lights. The cuffs close before you reach the corner.', 'ar' => 'المراقب تأخر عن التحذير. الأصفاد سبقتك قبل ما توصل الزاوية.']
                    : ['en' => 'The job turned violent. Your crew gets you to a hospital bed instead of the payday.', 'ar' => 'الشغلة انقلبت عنف. رجالك وصلوك سرير المستشفى بدل الغلة.'],
                default => ['en' => 'Bad timing. You walk away empty-handed before the street gets loud.', 'ar' => 'التوقيت خانك. انسحبت بإيد فاضية قبل ما تعلى الأصوات.'],
            };

            $eventName = $success ? 'CrimeSucceeded' : 'CrimeFailed';
            $event = new DomainEvent($eventName, [
                'playerId' => $playerId,
                'crimeId' => $crimeId,
                'nerveSpent' => $nerveCost,
                'cashReward' => $cashReward,
                'xpReward' => $xpReward,
                'roll' => $roll,
                'successThreshold' => $successThreshold,
                'territoryBonusBasisPoints' => $territoryBonusBp,
                'outcome' => $outcome, 'penalty' => $penalty, 'toolConsumed' => $preparation['consumed'],
                'mastery' => $crimeProgress['mastery'], 'chain' => $crimeProgress['chain'],
                'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);

            return [
                'success' => $success,
                'outcome' => $outcome, 'narrative' => $narrative,
                'crime' => ['id' => $crimeId, 'name_en' => $crime['name_en'], 'name_ar' => $crime['name_ar']],
                'cost' => ['nerve' => $nerveCost],
                'reward' => ['cash' => $cashReward, 'xp' => $xpReward],
                'penalty' => $penalty,
                'tool' => ['id' => $preparation['tool'], 'consumed' => $preparation['consumed']],
                'mastery' => $crimeProgress['mastery'], 'chain' => $crimeProgress['chain'],
                'chainBonusBasisPoints' => $preparation['chainBonusBasisPoints'],
                'successThresholdBasisPoints' => $successThreshold,
                'territoryBonusBasisPoints' => $territoryBonusBp,
                'loot' => $loot, 'lootRollWon' => $lootRollWon, 'lootStatus' => $lootStatus,
                'levelUp' => $levelUp,
                'streak' => $streak,
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

    private function requirePlayer(string $playerId): array
    {
        $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($player === null) {
            throw new RuntimeException("Unknown player: {$playerId}");
        }
        return $player;
    }

    private function requireModule(string $id): void
    {
        if (!$this->publishedModuleEnabled($id)) {
            throw new RuntimeException("Module {$id} is disabled. Re-enable it from the module manager.");
        }
    }

    private const GYM_STATS = ['strength', 'defense', 'speed', 'dexterity'];

    private function publishedContent(): array
    {
        return $this->releases->active()['manifest']['content'] ?? $this->releases->foundation()['content'] ?? [];
    }

    private function publishedModuleEnabled(string $id): bool
    {
        return (new PublishedRules($this->database))->moduleEnabled($id);
    }

    private function territoryBonus(string $playerId, string $key): int
    {
        return $this->publishedModuleEnabled('territories') ? $this->territories->bonusBasisPoints($playerId, $key) : 0;
    }

    public function gameplay(string $playerId = 'founder-player'): array
    {
        $travel = (new TravelService($this->database, $this->events))->snapshot($playerId);
        return [...(new ProgressionService($this->database, $this->events))->snapshot($playerId), 'travel' => $travel, 'hospitalQuote' => $this->hospitalQuote($playerId), 'cooldowns' => $this->actionCooldowns($playerId)];
    }

    /** Server-clock expiries survive reloads and reflect the configured action durations. */
    public function actionCooldowns(string $playerId): array
    {
        $now = time(); $actions = [];
        foreach ($this->database->fetchAll('SELECT action, available_at FROM action_cooldowns WHERE player_id = :id', ['id' => $playerId]) as $row) {
            $availableAt = strtotime((string) $row['available_at']) ?: $now;
            $actions[$row['action']] = ['availableAt' => gmdate('c', $availableAt), 'availableAtEpoch' => $availableAt, 'remainingSeconds' => max(0, $availableAt - $now)];
        }
        return ['serverTime' => gmdate('c', $now), 'serverTimeEpoch' => $now, 'actions' => $actions];
    }

    public function gameplayAction(string $action, string $id, int $expectedVersion, string $playerId = 'founder-player', ?int $expectedPrice = null): array
    {
        $this->recordActionAttempt($playerId);
        $screen = match (strtok($action, '.')) {
            'item' => 'items', 'market' => 'market', 'property' => 'properties', 'gym' => 'gym',
            'course' => 'education', 'job' => 'jobs', 'mission' => 'missions', 'faction' => 'faction',
            'jail' => 'jail', 'hospital' => 'hospital', default => null,
        };
        if ($screen !== null) $this->requireScreen($screen);
        $module = match (strtok($action, '.')) {
            'item' => 'inventory', 'market' => 'blackmarket', 'property' => 'properties',
            'gym' => 'stats', 'jail' => 'jail', 'hospital' => 'hospital', 'faction' => 'gangs', default => null,
        };
        if ($module !== null) {
            $this->requireModule($module);
        }
        $participants = [$playerId];
        if (in_array($action, ['jail.bail', 'jail.bust'], true) && $this->database->fetchOne('SELECT id FROM players WHERE id=:id', ['id' => $id]) !== null) $participants[] = $id;
        return $this->database->playersTransaction($participants, function () use ($action, $id, $expectedVersion, $playerId, $expectedPrice): array {
            (new TravelService($this->database, $this->events))->assertAvailable($playerId);
            return (new ProgressionService($this->database, $this->events))->act($action, $id, $expectedVersion, $playerId, $expectedPrice);
        });
    }

    private function requireScreen(string $screen): void
    {
        if (($this->releases->active()['manifest']['modules'][$screen] ?? true) === false) {
            throw new RuntimeException("Module {$screen} is disabled in the active release.");
        }
    }

    public function combat(string $playerId = 'founder-player'): array
    {
        $this->requireModule('kill');
        return (new CombatService($this->database, $this->events))->snapshot($playerId);
    }

    public function combatAction(string $action, string $opponentId, string $approach, int $expectedVersion, string $playerId = 'founder-player'): array
    {
        $this->requireModule('kill');
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($action, $opponentId, $approach, $expectedVersion, $playerId): array {
            if ($action !== 'finish') (new TravelService($this->database, $this->events))->assertAvailable($playerId);
            return (new CombatService($this->database, $this->events))->act($action, $opponentId, $approach, $expectedVersion, $playerId);
        });
    }

    public function trainGym(string $stat, int $sessions = 1, string $playerId = 'founder-player'): array
    {
        $this->requireModule('stats');
        if (!in_array($stat, self::GYM_STATS, true)) {
            throw new RuntimeException('Unknown gym stat: ' . $stat);
        }
        $sessions = max(1, min(10, $sessions));
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($stat, $sessions, $playerId): array {
            $this->resources->regenerate($playerId);
            $this->guardAction($playerId, 'gym');
            $streak = $this->daily->registerLogin($playerId, bin2hex(random_bytes(16)));
            $player = $this->requirePlayer($playerId);
            $progress = (new ProgressionService($this->database, $this->events))->snapshot($playerId);
            $gymIndex = (int) $progress['state']['gym'];
            $gym = $progress['catalogs']['gyms'][$gymIndex];
            $energyCost = (int) $gym['e'] * $sessions;
            if ((int) $player['energy'] < $energyCost) {
                throw new RuntimeException('Not enough energy to train.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $happy = (int) $player['happy'];
            $happyMultiplier = 1 + log(1 + $happy / 500) * .35;
            $gainPerSession = $gym['e'] * 1.2 * (1 + $gymIndex * .3) * $happyMultiplier
                * (!empty($progress['state']['fac']['ups']['gymBoost']) || !empty($progress['family']['upgrades']['gymBoost']) ? 1.1 : 1)
                * (!empty($progress['state']['eduDone']['fit']) ? 1.05 : 1)
                * max(.35, 1 - (int) $player[$stat] / 60000);
            $baseGain = 0;
            for ($i = 0; $i < $sessions; $i++) {
                $baseGain += max(1, (int) round($gainPerSession * random_int(90, 110) / 100));
            }
            $territoryBonusBp = min(2000, $this->territoryBonus($playerId, 'gym_bonus'));
            $gain = max(1, (int) round($baseGain * (10000 + $territoryBonusBp) / 10000));
            $newStat = (int) $player[$stat] + $gain;
            $newEnergy = (int) $player['energy'] - $energyCost;
            $newXp = (int) $player['xp'] + $gain;
            $this->database->execute(
                "UPDATE players SET {$stat} = :stat, energy = :energy, xp = :xp WHERE id = :id",
                ['id' => $playerId, 'stat' => $newStat, 'energy' => $newEnergy, 'xp' => $newXp],
            );
            $levelUp = $this->leveling->sync($playerId, $correlationId);
            $this->armCooldown($playerId, 'gym');
            (new ProgressionService($this->database, $this->events))->recordMetric($playerId, 'trains', $sessions);
            $this->daily->recordProgress($playerId, 'stat_gain', $gain);
            $event = new DomainEvent('GymTrained', [
                'playerId' => $playerId, 'stat' => $stat, 'gain' => $gain,
                'baseGain' => $baseGain, 'territoryBonusBasisPoints' => $territoryBonusBp,
                'sessions' => $sessions, 'energySpent' => $energyCost, 'correlationId' => $correlationId,
                'happiness' => ['value' => $happy, 'multiplier' => $happyMultiplier],
            ]);
            $this->events->publish($event);
            return [
                'trained' => $stat, 'gain' => $gain, 'baseGain' => $baseGain, 'gainPerEnergy' => round($gain / max(1, $energyCost), 2), 'territoryBonusBasisPoints' => $territoryBonusBp, 'sessions' => $sessions,
                'cost' => ['energy' => $energyCost],
                'happiness' => ['value' => $happy, 'multiplier' => $happyMultiplier],
                'levelUp' => $levelUp, 'streak' => $streak,
                'serverProof' => ['eventId' => $event->id, 'correlationId' => $correlationId, 'calculatedBy' => 'PHP ' . PHP_VERSION],
                'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            ];
        });
    }

    public function bankDeposit(int $amount, string $playerId = 'founder-player'): array
    {
        return $this->bankMove('deposit', $amount, $playerId);
    }

    public function bankWithdraw(int $amount, string $playerId = 'founder-player'): array
    {
        return $this->bankMove('withdraw', $amount, $playerId);
    }

    private function bankMove(string $direction, int $amount, string $playerId): array
    {
        $this->requireModule('bank');
        if ($amount <= 0) {
            throw new RuntimeException('Amount must be positive.');
        }
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($direction, $amount, $playerId): array {
            $this->guardAction($playerId, 'bank');
            $player = $this->requirePlayer($playerId);
            $cash = (int) $player['cash'];
            $bank = (int) $player['bank_balance'];
            $correlationId = bin2hex(random_bytes(16));
            if ($direction === 'deposit') {
                if ($cash < $amount) {
                    throw new RuntimeException('Not enough cash on hand to deposit.');
                }
                $cash -= $amount; $bank += $amount;
            } else {
                if ($bank < $amount) {
                    throw new RuntimeException('Not enough balance in the bank to withdraw.');
                }
                $bank -= $amount; $cash += $amount;
            }
            $this->database->execute(
                'UPDATE players SET cash = :cash, bank_balance = :bank WHERE id = :id',
                ['id' => $playerId, 'cash' => $cash, 'bank' => $bank],
            );
            $this->ledger->record($playerId, 'cash', $direction === 'deposit' ? -$amount : $amount, $cash, 'bank.' . $direction, $correlationId);
            $this->ledger->record($playerId, 'bank', $direction === 'deposit' ? $amount : -$amount, $bank, 'bank.' . $direction, $correlationId);
            $event = new DomainEvent('BankTransfer', ['playerId' => $playerId, 'direction' => $direction, 'amount' => $amount, 'correlationId' => $correlationId]);
            $this->events->publish($event);
            return [
                'direction' => $direction, 'amount' => $amount,
                'vaultSharePct' => ($cash + $bank) > 0 ? (int) round($bank / ($cash + $bank) * 100) : 0,
                'serverProof' => ['eventId' => $event->id, 'correlationId' => $correlationId, 'calculatedBy' => 'PHP ' . PHP_VERSION],
                'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            ];
        });
    }

    public function hospitalQuote(string $playerId = 'founder-player'): array
    {
        $snapshot = (new ProgressionService($this->database, $this->events))->snapshot($playerId);
        $player = $snapshot['player'];
        $missing = max(0, (int) $player['max_life'] - (int) $player['life']);
        $hospitalized = $snapshot['state']['hospUntil'] > (int) floor(microtime(true) * 1000);
        $discount = min(5000, $this->territoryBonus($playerId, 'medical_discount'));
        $baseCost = max($hospitalized ? 500 : 0, $missing * 3);
        return ['cost' => (int) ceil($baseCost * (10000 - $discount) / 10000), 'baseCost' => $baseCost, 'missing' => $missing,
            'hospitalized' => $hospitalized, 'available' => $missing > 0 || $hospitalized, 'territoryDiscountBasisPoints' => $discount, 'discountPct' => round($discount / 100, 1)];
    }

    public function playerCombat(string $playerId): array
    {
        $this->requireScreen('attack'); $this->requireModule('kill');
        return (new PlayerCombatService($this->database,$this->events))->snapshot($playerId);
    }

    public function playerCombatOpponents(string $playerId): array
    {
        $this->requireScreen('attack'); $this->requireModule('kill');
        return (new PlayerCombatService($this->database,$this->events))->opponents($playerId);
    }

    public function playerCombatAction(string $action,string $opponentId,string $approach,int $expectedVersion,string $playerId): array
    {
        $this->requireScreen('attack'); $this->requireModule('kill'); $this->recordActionAttempt($playerId,true);
        return (new PlayerCombatService($this->database,$this->events))->act($action,$opponentId,$approach,$expectedVersion,$playerId);
    }

    public function playerMarket(string $playerId): array
    {
        $this->requireScreen('market'); $this->requireModule('blackmarket');
        return (new PlayerMarketService($this->database,$this->events))->snapshot($playerId);
    }

    public function playerMarketAction(string $action,string $id,int $quantity,int $unitPrice,int $expectedVersion,string $playerId): array
    {
        $this->requireScreen('market'); $this->requireModule('blackmarket'); $this->recordActionAttempt($playerId);
        return (new PlayerMarketService($this->database,$this->events))->act($action,$id,$quantity,$unitPrice,$expectedVersion,$playerId);
    }

    public function familyActivities(string $playerId): array
    {
        $this->requireScreen('faction'); $this->requireModule('gangs');
        return (new FamilyActivityService($this->database,$this->events))->snapshot($playerId);
    }

    public function familyActivityAction(string $action,string $id,int $expectedVersion,string $playerId): array
    {
        $this->requireScreen('faction'); $this->requireModule('gangs'); $this->recordActionAttempt($playerId);
        return (new FamilyActivityService($this->database,$this->events))->act($action,$id,$expectedVersion,$playerId);
    }

    public function hospitalHeal(string $playerId = 'founder-player'): array
    {
        $this->requireModule('hospital');
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $this->resources->regenerate($playerId);
            $this->guardAction($playerId, 'hospital');
            $player = $this->requirePlayer($playerId);
            $quote = $this->hospitalQuote($playerId);
            $player = $this->requirePlayer($playerId);
            $missing = $quote['missing'];
            if (!$quote['available']) {
                throw new RuntimeException('You are already at full life.');
            }
            $cost = $quote['cost'];
            if ((int) $player['cash'] < $cost) {
                throw new RuntimeException('Not enough cash to pay for treatment.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $newCash = (int) $player['cash'] - $cost;
            $this->database->execute(
                'UPDATE players SET cash = :cash, life = :life WHERE id = :id',
                ['id' => $playerId, 'cash' => $newCash, 'life' => (int) $player['max_life']],
            );
            $this->ledger->record($playerId, 'cash', -$cost, $newCash, 'hospital.heal', $correlationId);
            (new ProgressionService($this->database, $this->events))->clearHospital($playerId);
            $this->armCooldown($playerId, 'hospital');
            $event = new DomainEvent('HospitalHealed', ['playerId' => $playerId, 'restored' => $missing, 'cost' => $cost, 'correlationId' => $correlationId]);
            $this->events->publish($event);
            return [
                'restored' => $missing, 'cost' => ['cash' => $cost], 'territoryDiscountBasisPoints' => $quote['territoryDiscountBasisPoints'],
                'serverProof' => ['eventId' => $event->id, 'correlationId' => $correlationId, 'calculatedBy' => 'PHP ' . PHP_VERSION],
                'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            ];
        });
    }

    private const CITIES = ['Zone City', 'Riyadh', 'Dubai', 'Cairo', 'Beirut', 'Istanbul'];

    public function cities(): array
    {
        return self::CITIES;
    }

    public function travelState(string $playerId = 'founder-player'): array
    {
        $travel = (new TravelService($this->database, $this->events))->snapshot($playerId);
        return ['player' => $this->player($playerId), 'travel' => $travel];
    }

    public function travel(string $city, string $playerId = 'founder-player'): array
    {
        $this->requireModule('travel');
        if (!in_array($city, self::CITIES, true)) {
            throw new RuntimeException('Unknown destination: ' . $city);
        }
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($city, $playerId): array {
            $this->guardAction($playerId, 'travel');
            $player = $this->requirePlayer($playerId);
            if ($player['city'] === $city) {
                throw new RuntimeException('You are already in ' . $city . '.');
            }
            $territoryBonusBp = min(5000, $this->territoryBonus($playerId, 'travel_discount'));
            $fare = 2500;
            $travelSeconds = max(60, (int) round(1800 * (10000 - $territoryBonusBp) / 10000));
            if ((int) $player['cash'] < $fare) {
                throw new RuntimeException('Not enough cash for the fare.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $newCash = (int) $player['cash'] - $fare;
            $this->database->execute(
                'UPDATE players SET cash = :cash WHERE id = :id',
                ['id' => $playerId, 'cash' => $newCash],
            );
            $trip = (new TravelService($this->database, $this->events))->depart($playerId, (string) $player['city'], $city, $travelSeconds);
            $this->ledger->record($playerId, 'cash', -$fare, $newCash, 'travel.fare', $correlationId);
            $this->armCooldown($playerId, 'travel');
            $event = new DomainEvent('PlayerTraveled', ['playerId' => $playerId, 'city' => $city, 'fare' => $fare, 'travelSeconds' => $travelSeconds, 'territoryBonusBasisPoints' => $territoryBonusBp, 'correlationId' => $correlationId]);
            $this->events->publish($event);
            return [
                'city' => $city, 'fare' => $fare, 'travelSeconds' => $travelSeconds, 'territoryBonusBasisPoints' => $territoryBonusBp,
                'travel' => $trip,
                'serverProof' => ['eventId' => $event->id, 'correlationId' => $correlationId, 'calculatedBy' => 'PHP ' . PHP_VERSION],
                'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            ];
        });
    }

    public function playBlackjack(int $bet, string $playerId = 'founder-player'): array
    {
        $this->requireModule('blackjack');
        if ($bet <= 0) {
            throw new RuntimeException('Bet must be positive.');
        }
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($bet, $playerId): array {
            $this->guardAction($playerId, 'blackjack');
            $player = $this->requirePlayer($playerId);
            if ((int) $player['cash'] < $bet) {
                throw new RuntimeException('Not enough cash for that bet.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $playerHand = random_int(16, 21);
            $dealerHand = random_int(16, 21);
            $won = $playerHand > $dealerHand;
            $push = $playerHand === $dealerHand;
            $delta = $push ? 0 : ($won ? $bet : -$bet);
            $newCash = (int) $player['cash'] + $delta;
            $this->database->execute('UPDATE players SET cash = :cash WHERE id = :id', ['id' => $playerId, 'cash' => $newCash]);
            if ($delta !== 0) {
                $this->ledger->record($playerId, 'cash', $delta, $newCash, 'casino.blackjack', $correlationId);
            }
            $this->armCooldown($playerId, 'blackjack');
            $event = new DomainEvent('BlackjackPlayed', ['playerId' => $playerId, 'bet' => $bet, 'delta' => $delta, 'playerHand' => $playerHand, 'dealerHand' => $dealerHand, 'correlationId' => $correlationId]);
            $this->events->publish($event);
            return [
                'result' => $push ? 'push' : ($won ? 'win' : 'lose'),
                'bet' => $bet,
                'netRoiPct' => $push ? 0 : ($won ? 100 : -100),
                'playerHand' => $playerHand, 'dealerHand' => $dealerHand, 'delta' => $delta,
                'serverProof' => ['eventId' => $event->id, 'correlationId' => $correlationId, 'calculatedBy' => 'PHP ' . PHP_VERSION],
                'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            ];
        });
    }

    public function highLowState(string $playerId = 'founder-player'): array
    {
        $this->requireModule('blackjack');
        $this->requirePlayer($playerId);
        $this->database->insertIgnore('casino_high_low', ['player_id', 'current_card', 'version', 'updated_at'], [$playerId, 7, 1, gmdate('c')]);
        $state = $this->database->fetchOne('SELECT current_card, version FROM casino_high_low WHERE player_id = :id', ['id' => $playerId]);
        return ['card' => (int) $state['current_card'], 'version' => (int) $state['version']];
    }

    public function playHighLow(int $bet, string $direction, int $expectedVersion, string $playerId = 'founder-player'): array
    {
        if ($bet <= 0 || $expectedVersion <= 0 || !in_array($direction, ['higher', 'lower'], true)) {
            throw new \InvalidArgumentException('Choose higher or lower and a positive bet.');
        }
        $this->highLowState($playerId);
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($bet, $direction, $expectedVersion, $playerId): array {
            $player = $this->requirePlayer($playerId);
            $this->guardAction($playerId, 'blackjack');
            if ((int) $player['cash'] < $bet) {
                throw new RuntimeException('Not enough cash for that bet.');
            }
            $state = $this->database->fetchOne('SELECT current_card, version FROM casino_high_low WHERE player_id = :id', ['id' => $playerId]);
            if ((int) $state['version'] !== $expectedVersion) {
                throw new RuntimeException('Casino round changed. Refresh the game and try again.');
            }
            $previousCard = (int) $state['current_card'];
            $card = random_int(2, 14);
            $push = $card === $previousCard;
            $won = $direction === 'higher' ? $card > $previousCard : $card < $previousCard;
            $delta = $push ? 0 : ($won ? $bet : -$bet);
            $correlationId = bin2hex(random_bytes(16));
            $affected = $this->database->execute(
                'UPDATE casino_high_low SET current_card = :card, version = version + 1, updated_at = :updated WHERE player_id = :id AND version = :version',
                ['card' => $card, 'updated' => gmdate('c'), 'id' => $playerId, 'version' => (int) $state['version']],
            );
            if ($affected !== 1) {
                throw new RuntimeException('Casino round changed. Refresh the game and try again.');
            }
            $this->database->execute('UPDATE players SET cash = cash + :delta WHERE id = :id', ['delta' => $delta, 'id' => $playerId]);
            $settledPlayer = $this->requirePlayer($playerId);
            if ($delta !== 0) {
                $this->ledger->record($playerId, 'cash', $delta, (int) $settledPlayer['cash'], 'casino.high-low', $correlationId);
            }
            $this->armCooldown($playerId, 'blackjack');
            $result = $push ? 'push' : ($won ? 'win' : 'lose');
            $event = new DomainEvent('HighLowPlayed', [
                'playerId' => $playerId, 'bet' => $bet, 'direction' => $direction,
                'previousCard' => $previousCard, 'card' => $card, 'result' => $result,
                'delta' => $delta, 'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);
            return [
                'previousCard' => $previousCard, 'card' => $card, 'version' => (int) $state['version'] + 1,
                'bet' => $bet, 'direction' => $direction,
                'higherOddsPct' => (int) round((14 - $card) / 13 * 100),
                'lowerOddsPct' => (int) round(($card - 2) / 13 * 100),
                'result' => $result, 'delta' => $delta,
                'serverProof' => ['eventId' => $event->id, 'correlationId' => $correlationId, 'calculatedBy' => 'PHP ' . PHP_VERSION, 'clientSuppliedOutcomeFields' => 0],
                'player' => $this->resources->normalize($settledPlayer),
            ];
        });
    }

    public function workShift(string $playerId = 'founder-player'): array
    {
        $this->requireScreen('jobs');
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $this->resources->regenerate($playerId);
            $this->guardAction($playerId, 'job');
            $streak = $this->daily->registerLogin($playerId, bin2hex(random_bytes(16)));
            $player = $this->requirePlayer($playerId);
            $progress = (new ProgressionService($this->database, $this->events))->snapshot($playerId);
            $job = array_values(array_filter($progress['catalogs']['jobs'], static fn (array $job): bool => $job['id'] === $progress['state']['job']))[0] ?? null;
            if ($job === null || (int) $player['level'] < (int) $job['lvl']) throw new RuntimeException('Your selected job is not available at this level.');
            $energyCost = (int) $job['energy'];
            if ((int) $player['energy'] < $energyCost) {
                throw new RuntimeException('Not enough energy to work a shift.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $level = (int) $player['level'];
            $wage = (int) round($job['pay'] * (!empty($progress['state']['eduDone']['biz']) ? 1.1 : 1));
            $xpReward = 5 + $level;
            $newCash = (int) $player['cash'] + $wage;
            $newXp = (int) $player['xp'] + $xpReward;
            $newEnergy = (int) $player['energy'] - $energyCost;
            $this->database->execute(
                'UPDATE players SET cash = :cash, xp = :xp, energy = :energy WHERE id = :id',
                ['id' => $playerId, 'cash' => $newCash, 'xp' => $newXp, 'energy' => $newEnergy],
            );
            $this->ledger->record($playerId, 'cash', $wage, $newCash, 'job.wage', $correlationId);
            $levelUp = $this->leveling->sync($playerId, $correlationId);
            $this->armCooldown($playerId, 'job');
            (new ProgressionService($this->database, $this->events))->recordMetric($playerId, 'shifts');
            $this->daily->recordProgress($playerId, 'job_cash', $wage);
            $event = new DomainEvent('JobShiftWorked', [
                'playerId' => $playerId, 'level' => $level, 'wage' => $wage,
                'xpReward' => $xpReward, 'energySpent' => $energyCost, 'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);
            return [
                'shift' => 'worked', 'jobId' => $job['id'], 'reward' => ['cash' => $wage, 'xp' => $xpReward], 'cost' => ['energy' => $energyCost],
                'cashPerEnergy' => round($wage / max(1, $energyCost), 2),
                'educationBonusApplied' => !empty($progress['state']['eduDone']['biz']),
                'cooldowns' => $this->actionCooldowns($playerId),
                'levelUp' => $levelUp, 'streak' => $streak,
                'serverProof' => ['eventId' => $event->id, 'correlationId' => $correlationId, 'calculatedBy' => 'PHP ' . PHP_VERSION, 'clientSuppliedOutcomeFields' => 0],
                'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            ];
        });
    }

    // --- ATTACK: gated on the existing 'kill' module (modules/Kill, "Attack / Kill"). ---
    public function attackNpc(string $playerId = 'founder-player'): array
    {
        $this->requireModule('kill');
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($playerId): array {
            $this->resources->regenerate($playerId);
            $this->guardAction($playerId, 'attack');
            $streak = $this->daily->registerLogin($playerId, bin2hex(random_bytes(16)));
            $player = $this->requirePlayer($playerId);
            $energyCost = 25;
            if ((int) $player['energy'] < $energyCost) {
                throw new RuntimeException('Not enough energy to attack.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $level = (int) $player['level'];
            // Server rolls the outcome from the player's own combat stats. No client input.
            $offense = (int) $player['strength'] + (int) $player['speed'] + (int) $player['dexterity'];
            $npcDefense = 150 + $level * 45;
            $winChanceBp = (int) min(10000, max(500, (int) round($offense / max(1, $offense + $npcDefense) * 10000)));
            $roll = random_int(1, 10000);
            $win = $roll <= $winChanceBp;
            $cashReward = $win ? random_int(300 + $level * 40, 800 + $level * 90) : 0;
            $xpReward = $win ? 15 + $level * 2 : 0;
            $newCash = (int) $player['cash'] + $cashReward;
            $newXp = (int) $player['xp'] + $xpReward;
            $newEnergy = (int) $player['energy'] - $energyCost;
            $this->database->execute(
                'UPDATE players SET cash = :cash, xp = :xp, energy = :energy WHERE id = :id',
                ['id' => $playerId, 'cash' => $newCash, 'xp' => $newXp, 'energy' => $newEnergy],
            );
            if ($cashReward > 0) {
                $this->ledger->record($playerId, 'cash', $cashReward, $newCash, 'attack.mug', $correlationId);
            }
            $levelUp = $this->leveling->sync($playerId, $correlationId);
            $this->armCooldown($playerId, 'attack');
            if ($win) {
                $this->daily->recordProgress($playerId, 'attack_wins', 1);
                (new ProgressionService($this->database, $this->events))->recordMetric($playerId, 'wins');
            }
            $event = new DomainEvent('PlayerAttacked', [
                'playerId' => $playerId, 'result' => $win ? 'win' : 'lose',
                'cashReward' => $cashReward, 'xpReward' => $xpReward, 'energySpent' => $energyCost,
                'roll' => $roll, 'winChanceBasisPoints' => $winChanceBp, 'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);
            return [
                'result' => $win ? 'win' : 'lose',
                'reward' => ['cash' => $cashReward, 'xp' => $xpReward], 'cost' => ['energy' => $energyCost],
                'roll' => $roll, 'winChanceBasisPoints' => $winChanceBp,
                'winChancePct' => round($winChanceBp / 100, 1),
                'npcDefense' => $npcDefense,
                'levelUp' => $levelUp, 'streak' => $streak,
                'serverProof' => ['eventId' => $event->id, 'correlationId' => $correlationId, 'calculatedBy' => 'PHP ' . PHP_VERSION, 'clientSuppliedOutcomeFields' => 0],
                'player' => $this->resources->normalize($this->requirePlayer($playerId)),
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

    // --- Daily return hooks (Retention Spec 3.3) ---

    /**
     * Claim today's login-streak reward (idempotent per UTC day). Returns the
     * streak block, or null if already claimed today.
     */
    public function dailyLogin(string $playerId = 'founder-player'): ?array
    {
        $this->resources->regenerate($playerId);
        return $this->daily->registerLogin($playerId, bin2hex(random_bytes(16)));
    }

    /** Today's rotating contract with the player's progress and claim state. */
    public function dailyContract(string $playerId = 'founder-player'): array
    {
        return $this->daily->contractState($playerId);
    }

    /** Claim today's completed contract (cash + xp). Throws if incomplete/claimed. */
    public function claimDailyContract(string $playerId = 'founder-player'): array
    {
        return $this->daily->claimContract($playerId, bin2hex(random_bytes(16)));
    }

    /** Unread notifications for the badge (e.g. cap-waste nudges). */
    public function notifications(string $playerId = 'founder-player'): array
    {
        return $this->notifications->unread($playerId);
    }

    /** Public, server-authored city topology merged with live ownership state. */
    public function territoryMap(string $playerId = 'founder-player'): array
    {
        $this->requireModule('territories');
        return $this->territories->snapshot($playerId);
    }

    /**
     * Execute a territory command without trusting any client-supplied owner,
     * faction, reward, control percentage, or outcome.
     */
    public function actTerritory(
        string $territoryId,
        string $action,
        int $expectedVersion,
        string $playerId = 'founder-player',
    ): array {
        $this->requireModule('territories');
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($territoryId, $action, $expectedVersion, $playerId): array {
            $this->resources->regenerate($playerId);
            $this->guardAction($playerId, 'territory');
            $result = $this->territories->act($territoryId, $action, $expectedVersion, $playerId);
            $this->armCooldown($playerId, 'territory');
            return [...$result, 'player' => $this->resources->normalize($this->requirePlayer($playerId))];
        });
    }

    public function adminTerritories(string $playerId = 'founder-player'): array
    {
        $this->requireModule('territories');
        return $this->territories->adminCatalog($playerId);
    }

    public function joinFaction(string $factionId, string $playerId = 'founder-player'): array
    {
        $this->requireModule('gangs');
        $this->requireModule('territories');
        $this->recordActionAttempt($playerId);
        return $this->database->playerTransaction($playerId, function () use ($playerId, $factionId): array {
            $this->guardAction($playerId, 'faction.join');
            (new \Zone\Modules\Gangs\FactionService($this->database, $this->events))->join($playerId, $factionId);
            return ['map' => $this->territories->snapshot($playerId)];
        });
    }

    public function setTerritoryOwnership(string $territoryId, ?string $factionId, string $actor): array
    {
        $this->requireModule('territories');
        return $this->territories->setOwnership($territoryId, $factionId, $actor);
    }

    /** Studio preview and release capture must share retained variant metadata. */
    private function enrichedCrimeDefinitions(): array
    {
        $variants = array_column(json_decode((string) file_get_contents(ZONE_ENGINE_ROOT . '/data/crimes.json'), true, 64, JSON_THROW_ON_ERROR), null, 'id');
        foreach (['searchforcash' => ['search', 0], 'bootlegging' => ['boot', 150], 'graffiti' => ['graf', 30], 'shoplifting' => ['shop', 80], 'pickpocketing' => ['pick', 120], 'cardskimming' => ['skim', 300], 'burglary' => ['burg', 2200]] as $id => [$category, $requiredXp]) {
            $variants[$id] = ['category' => $category, 'crime_xp_required' => $requiredXp];
        }
        return array_map(static fn (array $crime): array => [...($variants[$crime['id']] ?? []), ...$crime], $this->content->crimes(true));
    }

    private function runtimeContent(): array
    {
        $themes = $this->themes->all();
        return [
            'crimes' => $this->enrichedCrimeDefinitions(),
            'gameplayCatalog' => (new GameplayCatalog($this->database, $this->events))->draft()['catalogs'],
            'engineModules' => $this->modules->all(),
            'themes' => $themes,
            'activeTheme' => array_values(array_filter($themes, static fn (array $theme): bool => $theme['active']))[0]['id'] ?? null,
            'territoryDefinitions' => $this->territories->snapshot('founder-player'),
            'capturedAt' => gmdate('c'),
        ];
    }

    /** @return array<string, int> */
    public function cooldownConfig(): array
    {
        return $this->cooldownSeconds;
    }

    /** @return array{maxHits: int, windowSeconds: int, currentHits: int, remainingHits: int} */
    public function rateLimitStatus(string $playerId = 'founder-player'): array
    {
        return $this->rateLimiter->status($playerId);
    }

    public function unreadNotificationCount(string $playerId = 'founder-player'): int
    {
        return $this->notifications->unreadCount($playerId);
    }

    /** @return array<string, int> */
    public function moduleDiagnostics(string $playerId = 'founder-player'): array
    {
        return [
            'enabledCrimes' => \Zone\Modules\Crime\CrimeModule::enabledCrimeCount($this->database),
            'factions' => \Zone\Modules\Gangs\GangsModule::factionCount($this->database),
            'territories' => \Zone\Modules\Territories\TerritoriesModule::territoryCount($this->database),
            'topCash' => \Zone\Modules\Leaderboards\LeaderboardsModule::topCashAmount($this->database),
            'totalBankedCash' => \Zone\Modules\Bank\BankModule::totalBankedCash($this->database),
            'injuredPlayers' => \Zone\Modules\Hospital\HospitalModule::injuredPlayerCount($this->database),
            'activeTravelers' => \Zone\Modules\Travel\TravelModule::activeTravelerCount($this->database),
            'activeShopSupplies' => \Zone\Modules\BlackMarket\BlackMarketModule::activeSupplyCount($this->database),
            'totalFamilyRespect' => \Zone\Modules\GangBank\GangBankModule::totalFamilyRespect($this->database),
            'marketListings' => \Zone\Modules\Inventory\InventoryModule::marketListingCount($this->database),
            'unreadNotifications' => \Zone\Modules\Mail\MailModule::unreadNotificationCount($this->database, $playerId),
            'activeWorldEvents' => \Zone\Modules\News\NewsModule::activeWorldEventCount($this->database),
            'registeredPlayers' => \Zone\Modules\Profile\ProfileModule::playerCount($this->database),
            'unclaimedStreetFinds' => \Zone\Modules\Search\SearchModule::unclaimedStreetFindCount($this->database),
            'activeSessions' => \Zone\Modules\UsersOnline\UsersOnlineModule::activeSessionCount($this->database),
        ];
    }

    public function activeCooldownCount(string $playerId = 'founder-player'): int
    {
        return count($this->cooldowns->activeCooldowns($playerId));
    }

    public function isTraveling(string $playerId = 'founder-player'): bool
    {
        return (new TravelService($this->database, $this->events))->isTraveling($playerId);
    }

    public function hasActiveCombat(string $playerId = 'founder-player'): bool
    {
        return (new CombatService($this->database, $this->events))->hasActiveEncounter($playerId);
    }

    public function playerRank(string $playerId = 'founder-player'): ?int
    {
        return (new \Zone\Modules\Leaderboards\LeaderboardService($this->database))->playerRank($playerId);
    }

    public function playerFactionId(string $playerId = 'founder-player'): ?string
    {
        return (new \Zone\Modules\Gangs\FactionService($this->database, $this->events))->playerFactionId($playerId);
    }

    public function enabledCrimeCount(): int
    {
        return \Zone\Modules\Crime\CrimeModule::enabledCrimeCount($this->database);
    }

    public function factionCount(): int
    {
        return \Zone\Modules\Gangs\GangsModule::factionCount($this->database);
    }

    public function territoryCount(): int
    {
        return \Zone\Modules\Territories\TerritoriesModule::territoryCount($this->database);
    }

    public function activeWarsCount(): int
    {
        $row = $this->database->fetchOne("SELECT COUNT(*) AS total FROM territory_wars WHERE state IN ('declared', 'active', 'contested')");
        return (int) ($row['total'] ?? 0);
    }

    public function activeWorldEventCount(): int
    {
        return \Zone\Modules\News\NewsModule::activeWorldEventCount($this->database);
    }

    public function marketListingCount(): int
    {
        return \Zone\Modules\Inventory\InventoryModule::marketListingCount($this->database);
    }

    public function claimedAccountCount(): int
    {
        $row = $this->database->fetchOne('SELECT COUNT(*) AS total FROM player_credentials');
        return (int) ($row['total'] ?? 0);
    }

    public function activeSessionCount(): int
    {
        return \Zone\Modules\UsersOnline\UsersOnlineModule::activeSessionCount($this->database);
    }

    public function auditEntryCount(): int
    {
        return $this->content->auditEntryCount();
    }

    public function releaseCount(): int
    {
        return count($this->releases->releases());
    }

    public function topCashAmount(): int
    {
        return \Zone\Modules\Leaderboards\LeaderboardsModule::topCashAmount($this->database);
    }

    public function totalBankedCash(): int
    {
        return \Zone\Modules\Bank\BankModule::totalBankedCash($this->database);
    }

    public function injuredPlayerCount(): int
    {
        return \Zone\Modules\Hospital\HospitalModule::injuredPlayerCount($this->database);
    }

    public function activeTravelerCount(): int
    {
        return \Zone\Modules\Travel\TravelModule::activeTravelerCount($this->database);
    }

    public function activeShopSupplyCount(): int
    {
        return \Zone\Modules\BlackMarket\BlackMarketModule::activeSupplyCount($this->database);
    }

    public function totalFamilyRespect(): int
    {
        return \Zone\Modules\GangBank\GangBankModule::totalFamilyRespect($this->database);
    }

    public function registeredPlayerCount(): int
    {
        return \Zone\Modules\Profile\ProfileModule::playerCount($this->database);
    }

    public function unclaimedStreetFindCount(): int
    {
        return \Zone\Modules\Search\SearchModule::unclaimedStreetFindCount($this->database);
    }

    public function installedModuleCount(): int
    {
        return count(array_filter($this->modules->all(), static fn (array $module): bool => (bool) ($module['installed'] ?? false)));
    }

    public function enabledModuleCount(): int
    {
        return count(array_filter($this->modules->all(), static fn (array $module): bool => (bool) ($module['installed'] ?? false) && (bool) ($module['enabled'] ?? false)));
    }

    public function installedThemeCount(): int
    {
        return count($this->themes->installedThemeIds());
    }

    public function activeThemeId(): ?string
    {
        return $this->releases->activeSummary()['activeTheme'] ?? null;
    }

    public function activeReleaseId(): ?string
    {
        return $this->releases->activeSummary()['id'] ?? null;
    }

    public function activeReleaseVersion(): int
    {
        return (int) ($this->releases->activeSummary()['version'] ?? 0);
    }

    public function databaseDriver(): string
    {
        return $this->database->driver();
    }

    public function cacheAdapterName(): string
    {
        return $this->cache->adapterName();
    }

    public function worldTickCount(): int
    {
        return $this->world()->tickCount();
    }

    public function ownedTerritoryCount(?string $factionId = null): int
    {
        return $this->territories->ownedBlockCount($factionId);
    }

    public function uploadingAssetCount(): int
    {
        return $this->assets()->uploadingCount();
    }

    public function readyAssetCount(): int
    {
        return (int) ($this->assets()->health()['readyAssets'] ?? 0);
    }

    public function tableCount(): int
    {
        return $this->database->tableCount();
    }

    public function isPlaytestActive(string $playerId = 'founder-player'): bool
    {
        return $this->ownerPlaytest()->isSessionActive($playerId);
    }

    public function leaderboardRowCount(): int
    {
        return (new \Zone\Modules\Leaderboards\LeaderboardService($this->database))->rowCount();
    }

    public function activeFamilyOperationCount(): int
    {
        return (new FamilyActivityService($this->database, $this->events))->activeOperationCount();
    }

    public function soldMarketListingCount(): int
    {
        return (new PlayerMarketService($this->database, $this->events))->soldListingCount();
    }

    public function activeEncounterCount(?string $playerId = null): int
    {
        return (new CombatService($this->database, $this->events))->activeEncounterCount($playerId);
    }

    public function playerCombatMaxRounds(): int
    {
        return PlayerCombatService::maxRounds();
    }

    public function familyUpgradeCount(string $factionId = 'vipers'): int
    {
        return (new \Zone\Engine\Core\Game\FamilyProgressionService($this->database, $this->events))->upgradeCount($factionId);
    }

    /** @return array<string, int> */
    public function resourceRegenIntervals(): array
    {
        return ResourceService::regenIntervalsSeconds();
    }

    /** @return array{level: int, nerve: int, energy: int, cash: int} */
    public function levelUpGrants(int $level): array
    {
        return LevelingService::grantsForLevel($level);
    }

    /** @return list<array<string, mixed>> */
    public function dailyContractPool(): array
    {
        return DailyService::contractPool();
    }

    public function arrivedTravelCount(): int
    {
        return (new TravelService($this->database, $this->events))->arrivedCount();
    }

    public function ownedItemCount(string $playerId = 'founder-player'): int
    {
        return (new ProgressionService($this->database, $this->events))->ownedItemCount($playerId);
    }

    public function totalMaterialLootAwardedCount(?string $source = null): int
    {
        return (new \Zone\Engine\Core\Game\MaterialLootService($this->database, $this->events))->totalAwardedCount($source);
    }

    /** @return list<string> */
    public function editableCatalogCategories(): array
    {
        return GameplayCatalog::editableCategories();
    }

    /** @return list<string> */
    public function supportedMediaTargetTypes(): array
    {
        return \Zone\Engine\Core\Content\MediaReferences::supportedTargetTypes();
    }

    public function isModelExtension(string $extension): bool
    {
        return \Zone\Engine\Core\Media\AssetInspector::isModelExtension($extension);
    }

    public function isAllowedBundleMemberExtension(string $memberPath): bool
    {
        return \Zone\Engine\Core\Media\SafeBundle::isAllowedMemberExtension($memberPath);
    }

    public function hasPackagedImage(string $relativePath): bool
    {
        return \Zone\Engine\Core\Content\PackagedAssets::hasImage($relativePath);
    }

    public function securityEventCount(?string $playerId = null): int
    {
        return $this->playerAccounts()->securityEventCount($playerId);
    }

    public function purgeExpiredBrowserSessions(): int
    {
        return $this->browserSessions()->purgeExpired();
    }

    public function markAllNotificationsRead(string $playerId = 'founder-player'): int
    {
        return $this->notifications->markAllRead($playerId);
    }

    public function resetRateLimit(string $playerId = 'founder-player'): int
    {
        return $this->rateLimiter->reset($playerId);
    }

    public function cityCount(): int
    {
        return count(self::CITIES);
    }

    public function isSupportedCity(string $city): bool
    {
        return in_array($city, self::CITIES, true);
    }

    public function ledgerEntryCount(?string $playerId = null): int
    {
        if ($playerId !== null && $playerId !== '') {
            $row = $this->database->fetchOne('SELECT COUNT(*) AS c FROM economy_ledger WHERE player_id = :player', ['player' => $playerId]);
            return (int) ($row['c'] ?? 0);
        }
        $row = $this->database->fetchOne('SELECT COUNT(*) AS c FROM economy_ledger');
        return (int) ($row['c'] ?? 0);
    }

    public function eventLogCount(?string $eventName = null): int
    {
        if ($eventName !== null && $eventName !== '') {
            $row = $this->database->fetchOne('SELECT COUNT(*) AS c FROM event_log WHERE event_name = :name', ['name' => $eventName]);
            return (int) ($row['c'] ?? 0);
        }
        $row = $this->database->fetchOne('SELECT COUNT(*) AS c FROM event_log');
        return (int) ($row['c'] ?? 0);
    }

    public function achievementCount(string $playerId = 'founder-player'): int
    {
        $row = $this->database->fetchOne('SELECT COUNT(*) AS c FROM achievements WHERE player_id = :player', ['player' => $playerId]);
        return (int) ($row['c'] ?? 0);
    }

    public function playerCash(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['cash'];
    }

    public function playerLevel(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['level'];
    }

    /** @return array<string, int> */
    public function configuredCooldownSeconds(): array
    {
        return $this->cooldownSeconds;
    }

    public function totalAuthoredCrimeCount(): int
    {
        return count($this->adminCrimes());
    }

    public function playerEnergy(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['energy'];
    }

    public function playerNerve(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['nerve'];
    }

    public function playerLife(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['life'];
    }

    /** @return list<string> */
    public function gymStats(): array
    {
        return self::GYM_STATS;
    }

    public function isSupportedGymStat(string $stat): bool
    {
        return in_array($stat, self::GYM_STATS, true);
    }

    public function playerBankBalance(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['bank_balance'];
    }

    public function playerXp(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['xp'];
    }

    public function playerCity(string $playerId = 'founder-player'): string
    {
        return (string) $this->requirePlayer($playerId)['city'];
    }

    public function playerHappy(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['happy'];
    }

    public function playerStrength(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['strength'];
    }

    public function playerDefense(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['defense'];
    }

    public function playerSpeed(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['speed'];
    }

    public function playerDexterity(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['dexterity'];
    }

    public function playerMaxLife(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['max_life'];
    }

    public function playerMaxEnergy(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['max_energy'];
    }

    public function playerMaxNerve(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['max_nerve'];
    }

    public function playerMaxHappy(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['max_happy'];
    }

    public function playerTotalCombatStats(string $playerId = 'founder-player'): int
    {
        $p = $this->requirePlayer($playerId);
        return (int) $p['strength'] + (int) $p['defense'] + (int) $p['speed'] + (int) $p['dexterity'];
    }

    public function isValidPlayerId(string $playerId): bool
    {
        return \Zone\Engine\Core\Security\RequestGuard::isValidPlayerId($playerId);
    }

    public function configuredCacheAdapter(): string
    {
        return \Zone\Engine\Infrastructure\Cache\CacheFactory::configuredAdapter();
    }

    public function maxUploadBytes(): int
    {
        return \Zone\Engine\Core\Media\AssetLibrary::MAX_UPLOAD_BYTES;
    }

    public function uploadChunkBytes(): int
    {
        return \Zone\Engine\Core\Media\AssetLibrary::CHUNK_BYTES;
    }

    public function catalogDraftRevision(): int
    {
        return (int) ($this->adminGameplayCatalog()['revision'] ?? 1);
    }

    /** @return array{totalModules: int, enabledCount: int, disabledCount: int} */
    public function publishedRulesSummary(): array
    {
        return (new \Zone\Engine\Core\Publishing\PublishedRules($this->database))->summary();
    }

    /** @return list<string> */
    public function disabledPublishedModuleIds(): array
    {
        return (new \Zone\Engine\Core\Publishing\PublishedRules($this->database))->disabledModuleIds();
    }

    public function isPublishedModuleEnabled(string $moduleId): bool
    {
        return (new \Zone\Engine\Core\Publishing\PublishedRules($this->database))->moduleEnabled($moduleId);
    }

    public function browserSessionCookieName(): string
    {
        return \Zone\Engine\Core\Security\BrowserSessions::COOKIE;
    }

    public function browserSessionLifetimeSeconds(): int
    {
        return \Zone\Engine\Core\Security\BrowserSessions::LIFETIME;
    }

    /** @return list<string> */
    public function ownerPlaytestActions(): array
    {
        return \Zone\Engine\Core\Game\OwnerPlaytestService::ACTIONS;
    }

    public function ownerPlaytestActionCount(): int
    {
        return count(\Zone\Engine\Core\Game\OwnerPlaytestService::ACTIONS);
    }

    public function isSupportedOwnerPlaytestAction(string $action): bool
    {
        return in_array($action, \Zone\Engine\Core\Game\OwnerPlaytestService::ACTIONS, true);
    }

    /**
     * @param array<string, mixed> $policy
     * @return array<string, mixed>
     */
    public function normalizeWorldPolicy(array $policy = []): array
    {
        return \Zone\Engine\Core\Game\WorldDirector::normalizePolicy($policy);
    }

    public function playerUsername(string $playerId = 'founder-player'): string
    {
        return (string) $this->requirePlayer($playerId)['username'];
    }

    public function playerLoginStreak(string $playerId = 'founder-player'): int
    {
        return (int) $this->requirePlayer($playerId)['login_streak'];
    }

    public function playerLastLoginDay(string $playerId = 'founder-player'): ?string
    {
        $day = $this->requirePlayer($playerId)['last_login_day'] ?? null;
        return is_string($day) && $day !== '' ? $day : null;
    }

    public function playerNetWorth(string $playerId = 'founder-player'): int
    {
        return $this->playerCash($playerId) + $this->playerBankBalance($playerId);
    }

    public function neutralTerritoryCount(): int
    {
        return (int) ($this->territories->snapshot('founder-player')['summary']['neutral'] ?? 0);
    }

    public function contestedTerritoryCount(): int
    {
        return (int) ($this->territories->snapshot('founder-player')['summary']['contested'] ?? 0);
    }
}
