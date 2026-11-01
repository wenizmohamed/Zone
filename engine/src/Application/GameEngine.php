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

    public function territoryControlPercent(string $playerId = 'founder-player'): float
    {
        return (float) ($this->territories->snapshot($playerId)['summary']['controlPercent'] ?? 0.0);
    }

    public function territoryDailyRespectIncome(string $playerId = 'founder-player'): int
    {
        return (int) ($this->territories->snapshot($playerId)['summary']['dailyRespectIncome'] ?? 0);
    }

    public function territoryNeutralColor(): string
    {
        return (string) ($this->territories->snapshot('founder-player')['neutralColor'] ?? '#68717b');
    }

    public function playerFactionRole(string $playerId = 'founder-player'): ?string
    {
        $role = $this->territories->snapshot($playerId)['playerFactionRole'] ?? null;
        return is_string($role) && $role !== '' ? $role : null;
    }

    public function isTerritoriesModulePublished(): bool
    {
        return (bool) (\Zone\Engine\Core\Game\LoadoutService::publishedView($this->database, $this->events)['territoriesEnabled'] ?? false);
    }

    public function playerPoints(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['points'] ?? 0);
    }

    public function playerMerits(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['merits'] ?? 0);
    }

    public function playerActivePropertyId(string $playerId = 'founder-player'): string
    {
        return (string) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['prop'] ?? 'shack');
    }

    public function playerActiveJobId(string $playerId = 'founder-player'): string
    {
        return (string) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['job'] ?? 'grocer');
    }

    /** @return array<string, mixed> */
    public function playerLoadoutSummary(string $playerId = 'founder-player'): array
    {
        return (array) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['loadout'] ?? []);
    }

    public function playerCrimeXp(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['crimeXp'] ?? 0);
    }

    public function playerGymXp(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['gymXp'] ?? 0);
    }

    public function playerJobPoints(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['jobPts'] ?? 0);
    }

    public function playerOwnedPropertyCount(string $playerId = 'founder-player'): int
    {
        $owned = (array) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['ownedProperties'] ?? []);
        return count(array_filter($owned));
    }

    /** @return array<string, mixed> */
    public function playerOnboardingSummary(string $playerId = 'founder-player'): array
    {
        return (array) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['onboarding'] ?? []);
    }

    public function playerCrimeSuccessCount(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['ctr']['crimes'] ?? 0);
    }

    public function playerGymTrainCount(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['ctr']['trains'] ?? 0);
    }

    public function playerCombatWinCount(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['ctr']['wins'] ?? 0);
    }

    public function playerJobShiftCount(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['ctr']['shifts'] ?? 0);
    }

    public function playerMarketBuyCount(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['ctr']['buys'] ?? 0);
    }

    public function playerActiveMarketListingCount(string $playerId = 'founder-player'): int
    {
        return (new \Zone\Engine\Core\Game\PlayerMarketService($this->database, $this->events))->activeListingCount($playerId);
    }

    /** @return array<string, mixed> */
    public function playerHourlySearchMaterialUsage(string $playerId = 'founder-player'): array
    {
        return (new \Zone\Engine\Core\Game\MaterialLootService($this->database, $this->events))->hourlyUsage('search', $playerId);
    }

    public function playerInJail(string $playerId = 'founder-player'): bool
    {
        $until = (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['jailUntil'] ?? 0);
        return $until > (int) round(microtime(true) * 1000);
    }

    public function playerInHospital(string $playerId = 'founder-player'): bool
    {
        $until = (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['hospUntil'] ?? 0);
        return $until > (int) round(microtime(true) * 1000);
    }

    public function playerCompletedEducationCount(string $playerId = 'founder-player'): int
    {
        $done = (array) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['eduDone'] ?? []);
        return count(array_filter($done));
    }

    /** @return array<string, mixed> */
    public function worldHourlyMaterialUsage(): array
    {
        return (new \Zone\Engine\Core\Game\MaterialLootService($this->database, $this->events))->hourlyUsage('world', '*');
    }

    public function playerRespect(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['fac']['respect'] ?? 0);
    }

    public function playerBestChain(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['fac']['best'] ?? 0);
    }

    public function playerEquippedWeaponId(string $playerId = 'founder-player'): ?string
    {
        $id = (new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['loadout']['weaponId'] ?? null;
        return is_string($id) && $id !== '' ? $id : null;
    }

    public function playerEquippedArmorId(string $playerId = 'founder-player'): ?string
    {
        $id = (new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['loadout']['armorId'] ?? null;
        return is_string($id) && $id !== '' ? $id : null;
    }

    /** @return list<array<string, mixed>> */
    public function familyOperationDefinitions(): array
    {
        return (new \Zone\Engine\Core\Game\FamilyActivityService($this->database, $this->events))->definitions();
    }

    public function familyOperationDefinitionCount(): int
    {
        return count((new \Zone\Engine\Core\Game\FamilyActivityService($this->database, $this->events))->definitions());
    }

    /** @return array<string, mixed> */
    public function currentFamilySeason(): array
    {
        return (new \Zone\Engine\Core\Game\FamilyActivityService($this->database, $this->events))->currentSeason();
    }

    public function playerWeaponBonusPct(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['loadout']['weaponBonusPct'] ?? 0);
    }

    public function playerArmorMitigationPct(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['loadout']['armorMitigationPct'] ?? 0);
    }

    public function activeWorldFindCount(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\WorldDirector($this->database, $this->events))->snapshot($playerId)['activeFindCount'] ?? 0);
    }

    public function worldShopSupplyCount(): int
    {
        return count((new \Zone\Engine\Core\Game\WorldDirector($this->database, $this->events))->supply());
    }

    public function playerInmateCount(string $playerId = 'founder-player'): int
    {
        return count((array) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['inmates'] ?? []));
    }

    public function playerPatientCount(string $playerId = 'founder-player'): int
    {
        return count((array) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['patients'] ?? []));
    }

    public function playerSafehouseCount(string $playerId = 'founder-player'): int
    {
        return count((array) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['safehouses'] ?? []));
    }

    public function playerTravelStatus(string $playerId = 'founder-player'): string
    {
        return (string) ((new \Zone\Engine\Core\Game\TravelService($this->database, $this->events))->snapshot($playerId)['status'] ?? 'idle');
    }

    /** @return array<int, array{0:int,1:bool,2:bool}> */
    public function dailyStreakSchedule(): array
    {
        return \Zone\Engine\Core\Game\DailyService::streakSchedule();
    }

    public function dailyContractPoolCount(): int
    {
        return count(\Zone\Engine\Core\Game\DailyService::contractPool());
    }

    public function isDailyContractComplete(string $playerId = 'founder-player'): bool
    {
        return (bool) ($this->dailyContract($playerId)['complete'] ?? false);
    }

    public function isDailyContractClaimed(string $playerId = 'founder-player'): bool
    {
        return (bool) ($this->dailyContract($playerId)['claimed'] ?? false);
    }

    public function xpForLevel(int $level): int
    {
        return $this->leveling->totalXpForLevel($level);
    }

    public function levelForXp(int $xp): int
    {
        return $this->leveling->levelForXp($xp);
    }

    public function familyMemberCount(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\FamilyProgressionService($this->database, $this->events))->snapshot($playerId)['memberCount'] ?? 0);
    }

    public function familyRespectBalance(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\FamilyProgressionService($this->database, $this->events))->snapshot($playerId)['respect'] ?? 0);
    }

    public function eligiblePlayerCombatOpponentCount(string $playerId = 'founder-player'): int
    {
        return count(array_filter(
            (new \Zone\Engine\Core\Game\PlayerCombatService($this->database, $this->events))->opponents($playerId)['players'] ?? [],
            static fn (array $p): bool => !empty($p['eligible']),
        ));
    }

    public function cooldownRemainingSeconds(string $action, string $playerId = 'founder-player'): int
    {
        return $this->cooldowns->remainingSeconds($playerId, $action);
    }

    public function isActionReady(string $action, string $playerId = 'founder-player'): bool
    {
        return $this->cooldowns->remainingSeconds($playerId, $action) === 0;
    }

    public function canPlayerBuyFamilyUpgrade(string $playerId = 'founder-player'): bool
    {
        return (bool) ((new \Zone\Engine\Core\Game\FamilyProgressionService($this->database, $this->events))->snapshot($playerId)['permissions']['buyUpgrade'] ?? false);
    }

    public function isHospitalHealAvailable(string $playerId = 'founder-player'): bool
    {
        return (bool) ($this->hospitalQuote($playerId)['available'] ?? false);
    }

    public function hospitalHealCost(string $playerId = 'founder-player'): int
    {
        return (int) ($this->hospitalQuote($playerId)['cost'] ?? 0);
    }

    public function hospitalMissingLife(string $playerId = 'founder-player'): int
    {
        return (int) ($this->hospitalQuote($playerId)['missing'] ?? 0);
    }

    public function hospitalDiscountPct(string $playerId = 'founder-player'): float
    {
        return (float) ($this->hospitalQuote($playerId)['discountPct'] ?? 0.0);
    }

    public function highLowCurrentCard(string $playerId = 'founder-player'): int
    {
        return (int) ($this->highLowState($playerId)['card'] ?? 7);
    }

    public function highLowVersion(string $playerId = 'founder-player'): int
    {
        return (int) ($this->highLowState($playerId)['version'] ?? 1);
    }

    public function rateLimitRemainingHits(string $playerId = 'founder-player'): int
    {
        return (int) ($this->rateLimitStatus($playerId)['remainingHits'] ?? 0);
    }

    public function publishedItemCount(): int
    {
        return count((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['items'] ?? []);
    }

    public function publishedJobCount(): int
    {
        return count((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['jobs'] ?? []);
    }

    public function publishedGymCount(): int
    {
        return count((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['gyms'] ?? []);
    }

    public function publishedPropertyCount(): int
    {
        return count((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['properties'] ?? []);
    }

    public function publishedOpponentCount(): int
    {
        return count((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['opponents'] ?? []);
    }

    public function publishedCourseCount(): int
    {
        return count((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['courses'] ?? []);
    }

    public function publishedMissionCount(): int
    {
        return count((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['missions'] ?? []);
    }

    public function publishedUpgradeCount(): int
    {
        return count((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['upgrades'] ?? []);
    }

    public function publishedMarketCatalogCount(): int
    {
        return count((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['market'] ?? []);
    }

    public function publishedMaterialItemCount(): int
    {
        return count(array_filter(
            (new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['items'] ?? [],
            static fn (array $item): bool => ($item['type'] ?? '') === 'material',
        ));
    }

    public function publishedWeaponItemCount(): int
    {
        return count(array_filter(
            (new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['items'] ?? [],
            static fn (array $item): bool => ($item['type'] ?? '') === 'weapon',
        ));
    }

    public function publishedArmorItemCount(): int
    {
        return count(array_filter(
            (new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['items'] ?? [],
            static fn (array $item): bool => ($item['type'] ?? '') === 'armor',
        ));
    }

    public function publishedMedicalItemCount(): int
    {
        return count(array_filter(
            (new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['items'] ?? [],
            static fn (array $item): bool => ($item['type'] ?? '') === 'medical',
        ));
    }

    public function publishedBoosterItemCount(): int
    {
        return count(array_filter(
            (new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['items'] ?? [],
            static fn (array $item): bool => ($item['type'] ?? '') === 'booster',
        ));
    }

    public function publishedCrimeCount(): int
    {
        return count($this->crimes());
    }

    public function adminCrimeCount(): int
    {
        return count($this->adminCrimes());
    }

    public function disabledAdminCrimeCount(): int
    {
        return count(array_filter(
            $this->adminCrimes(),
            static fn (array $crime): bool => !(bool) ($crime['enabled'] ?? false),
        ));
    }

    public function disabledModuleCount(): int
    {
        return count(array_filter(
            $this->modules->all(),
            static fn (array $module): bool => (bool) ($module['installed'] ?? false) && !(bool) ($module['enabled'] ?? false),
        ));
    }

    public function configuredActionCooldownSeconds(string $action): int
    {
        return (int) ($this->cooldownSeconds[$action] ?? 0);
    }

    public function configuredCooldownActionCount(): int
    {
        return count($this->cooldownSeconds);
    }

    public function playerMissingEnergy(string $playerId = 'founder-player'): int
    {
        return max(0, $this->playerMaxEnergy($playerId) - $this->playerEnergy($playerId));
    }

    public function playerMissingNerve(string $playerId = 'founder-player'): int
    {
        return max(0, $this->playerMaxNerve($playerId) - $this->playerNerve($playerId));
    }

    public function playerMissingHappy(string $playerId = 'founder-player'): int
    {
        return max(0, $this->playerMaxHappy($playerId) - $this->playerHappy($playerId));
    }

    public function playerMissingLifePoints(string $playerId = 'founder-player'): int
    {
        return max(0, $this->playerMaxLife($playerId) - $this->playerLife($playerId));
    }

    public function playerBankSharePct(string $playerId = 'founder-player'): float
    {
        $netWorth = $this->playerNetWorth($playerId);
        return $netWorth > 0 ? round($this->playerBankBalance($playerId) / $netWorth * 100, 2) : 0.0;
    }

    public function playerEnergyPct(string $playerId = 'founder-player'): float
    {
        $max = $this->playerMaxEnergy($playerId);
        return $max > 0 ? round($this->playerEnergy($playerId) / $max * 100, 2) : 0.0;
    }

    public function playerNervePct(string $playerId = 'founder-player'): float
    {
        $max = $this->playerMaxNerve($playerId);
        return $max > 0 ? round($this->playerNerve($playerId) / $max * 100, 2) : 0.0;
    }

    public function playerHappyPct(string $playerId = 'founder-player'): float
    {
        $max = $this->playerMaxHappy($playerId);
        return $max > 0 ? round($this->playerHappy($playerId) / $max * 100, 2) : 0.0;
    }

    public function playerLifePct(string $playerId = 'founder-player'): float
    {
        $max = $this->playerMaxLife($playerId);
        return $max > 0 ? round($this->playerLife($playerId) / $max * 100, 2) : 0.0;
    }

    public function playerXpToNextLevel(string $playerId = 'founder-player'): int
    {
        $level = $this->playerLevel($playerId);
        return max(0, $this->xpForLevel($level + 1) - $this->playerXp($playerId));
    }

    public function playerStrengthSharePct(string $playerId = 'founder-player'): float
    {
        $total = $this->playerTotalCombatStats($playerId);
        return $total > 0 ? round($this->playerStrength($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerDefenseSharePct(string $playerId = 'founder-player'): float
    {
        $total = $this->playerTotalCombatStats($playerId);
        return $total > 0 ? round($this->playerDefense($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerSpeedSharePct(string $playerId = 'founder-player'): float
    {
        $total = $this->playerTotalCombatStats($playerId);
        return $total > 0 ? round($this->playerSpeed($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerDexteritySharePct(string $playerId = 'founder-player'): float
    {
        $total = $this->playerTotalCombatStats($playerId);
        return $total > 0 ? round($this->playerDexterity($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerDominantStat(string $playerId = 'founder-player'): string
    {
        $stats = [
            'strength' => $this->playerStrength($playerId),
            'defense' => $this->playerDefense($playerId),
            'speed' => $this->playerSpeed($playerId),
            'dexterity' => $this->playerDexterity($playerId),
        ];
        arsort($stats);
        return (string) array_key_first($stats);
    }

    public function playerEnergyRegenSecondsRemaining(string $playerId = 'founder-player'): int
    {
        $missing = $this->playerMissingEnergy($playerId);
        $interval = (int) ($this->resourceRegenIntervals()['energy'] ?? 120);
        return $missing * $interval;
    }

    public function playerNerveRegenSecondsRemaining(string $playerId = 'founder-player'): int
    {
        $missing = $this->playerMissingNerve($playerId);
        $interval = (int) ($this->resourceRegenIntervals()['nerve'] ?? 300);
        return $missing * $interval;
    }

    public function playerHappyRegenSecondsRemaining(string $playerId = 'founder-player'): int
    {
        $missing = $this->playerMissingHappy($playerId);
        $interval = (int) ($this->resourceRegenIntervals()['happy'] ?? 300);
        return $missing * $interval;
    }

    public function playerLifeRegenSecondsRemaining(string $playerId = 'founder-player'): int
    {
        $missing = $this->playerMissingLifePoints($playerId);
        $interval = (int) ($this->resourceRegenIntervals()['life'] ?? 300);
        return $missing * $interval;
    }

    public function isPlayerAtFullResources(string $playerId = 'founder-player'): bool
    {
        return $this->playerMissingEnergy($playerId) === 0
            && $this->playerMissingNerve($playerId) === 0
            && $this->playerMissingHappy($playerId) === 0
            && $this->playerMissingLifePoints($playerId) === 0;
    }

    public function playerActiveGymIndex(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['gym'] ?? 0);
    }

    public function playerActiveGymCost(string $playerId = 'founder-player'): int
    {
        $gyms = (new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['gyms'] ?? [];
        $idx = $this->playerActiveGymIndex($playerId);
        return (int) ($gyms[$idx]['e'] ?? 5);
    }

    public function playerAvailableGymSessions(string $playerId = 'founder-player'): int
    {
        $cost = max(1, $this->playerActiveGymCost($playerId));
        return intdiv($this->playerEnergy($playerId), $cost);
    }

    public function playerActiveCourseId(string $playerId = 'founder-player'): ?string
    {
        $id = (new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['activeCourseId'] ?? null;
        return is_string($id) && $id !== '' ? $id : null;
    }

    public function isPlayerEnrolledInCourse(string $playerId = 'founder-player'): bool
    {
        return $this->playerActiveCourseId($playerId) !== null;
    }

    public function playerActiveJobRankIndex(string $playerId = 'founder-player'): int
    {
        return (int) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['jobRank'] ?? 0);
    }

    public function playerActivePropertyHappyBonus(string $playerId = 'founder-player'): int
    {
        $activeId = $this->playerActivePropertyId($playerId);
        foreach ((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['properties'] ?? [] as $prop) {
            if (($prop['id'] ?? null) === $activeId) {
                return (int) ($prop['h'] ?? 0);
            }
        }
        return 0;
    }

    public function playerActivePropertyCost(string $playerId = 'founder-player'): int
    {
        $activeId = $this->playerActivePropertyId($playerId);
        foreach ((new \Zone\Engine\Core\Content\GameplayCatalog($this->database, $this->events))->active()['properties'] ?? [] as $prop) {
            if (($prop['id'] ?? null) === $activeId) {
                return (int) ($prop['cost'] ?? 0);
            }
        }
        return 0;
    }

    public function playerCompletedMissionCount(string $playerId = 'founder-player'): int
    {
        $done = (array) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['msnDone'] ?? []);
        return count(array_filter($done));
    }

    public function playerPurchasedUpgradeCount(string $playerId = 'founder-player'): int
    {
        $done = (array) ((new \Zone\Engine\Core\Game\ProgressionService($this->database, $this->events))->snapshot($playerId)['state']['upgDone'] ?? []);
        return count(array_filter($done));
    }

    public function playerTotalCareerActions(string $playerId = 'founder-player'): int
    {
        return $this->playerCrimeSuccessCount($playerId)
            + $this->playerGymTrainCount($playerId)
            + $this->playerCombatWinCount($playerId)
            + $this->playerJobShiftCount($playerId)
            + $this->playerMarketBuyCount($playerId);
    }

    public function playerHasEquippedWeapon(string $playerId = 'founder-player'): bool
    {
        $id = $this->playerEquippedWeaponId($playerId);
        return $id !== null && $id !== 'fists';
    }

    public function playerHasEquippedArmor(string $playerId = 'founder-player'): bool
    {
        return $this->playerEquippedArmorId($playerId) !== null;
    }

    public function playerIsIdle(string $playerId = 'founder-player'): bool
    {
        return !$this->isTraveling($playerId)
            && !$this->playerInJail($playerId)
            && !$this->playerInHospital($playerId)
            && !$this->hasActiveCombat($playerId);
    }

    public function playerHasFaction(string $playerId = 'founder-player'): bool
    {
        return $this->playerFactionId($playerId) !== null;
    }

    public function playerCourseCompletionPct(string $playerId = 'founder-player'): float
    {
        $total = $this->publishedCourseCount();
        return $total > 0 ? round($this->playerCompletedEducationCount($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerMissionCompletionPct(string $playerId = 'founder-player'): float
    {
        $total = $this->publishedMissionCount();
        return $total > 0 ? round($this->playerCompletedMissionCount($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerUpgradeCompletionPct(string $playerId = 'founder-player'): float
    {
        $total = $this->publishedUpgradeCount();
        return $total > 0 ? round($this->playerPurchasedUpgradeCount($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerPropertyOwnershipPct(string $playerId = 'founder-player'): float
    {
        $total = $this->publishedPropertyCount();
        return $total > 0 ? round($this->playerOwnedPropertyCount($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerGymUnlockRatioPct(string $playerId = 'founder-player'): float
    {
        $total = $this->publishedGymCount();
        return $total > 0 ? round(($this->playerActiveGymIndex($playerId) + 1) / $total * 100, 2) : 0.0;
    }

    public function playerCrimeSuccessSharePct(string $playerId = 'founder-player'): float
    {
        $total = $this->playerTotalCareerActions($playerId);
        return $total > 0 ? round($this->playerCrimeSuccessCount($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerGymTrainSharePct(string $playerId = 'founder-player'): float
    {
        $total = $this->playerTotalCareerActions($playerId);
        return $total > 0 ? round($this->playerGymTrainCount($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerCombatWinSharePct(string $playerId = 'founder-player'): float
    {
        $total = $this->playerTotalCareerActions($playerId);
        return $total > 0 ? round($this->playerCombatWinCount($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerJobShiftSharePct(string $playerId = 'founder-player'): float
    {
        $total = $this->playerTotalCareerActions($playerId);
        return $total > 0 ? round($this->playerJobShiftCount($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerMarketBuySharePct(string $playerId = 'founder-player'): float
    {
        $total = $this->playerTotalCareerActions($playerId);
        return $total > 0 ? round($this->playerMarketBuyCount($playerId) / $total * 100, 2) : 0.0;
    }

    public function playerHasOwnedProperties(string $playerId = 'founder-player'): bool
    {
        return $this->playerOwnedPropertyCount($playerId) > 0;
    }

    public function playerHasCompletedEducation(string $playerId = 'founder-player'): bool
    {
        return $this->playerCompletedEducationCount($playerId) > 0;
    }

    public function playerHasCompletedMissions(string $playerId = 'founder-player'): bool
    {
        return $this->playerCompletedMissionCount($playerId) > 0;
    }

    public function playerHasPurchasedUpgrades(string $playerId = 'founder-player'): bool
    {
        return $this->playerPurchasedUpgradeCount($playerId) > 0;
    }

    public function playerHasActiveMarketListings(string $playerId = 'founder-player'): bool
    {
        return $this->playerActiveMarketListingCount($playerId) > 0;
    }

    public function playerHasInmates(string $playerId = 'founder-player'): bool
    {
        return $this->playerInmateCount($playerId) > 0;
    }

    public function playerHasPatients(string $playerId = 'founder-player'): bool
    {
        return $this->playerPatientCount($playerId) > 0;
    }

    public function playerHasSafehouses(string $playerId = 'founder-player'): bool
    {
        return $this->playerSafehouseCount($playerId) > 0;
    }

    public function playerHasAchievements(string $playerId = 'founder-player'): bool
    {
        return $this->achievementCount($playerId) > 0;
    }

    public function playerHasOwnedItems(string $playerId = 'founder-player'): bool
    {
        return $this->ownedItemCount($playerId) > 0;
    }

    public function isCrimeModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('crime');
    }

    public function isGymModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('stats');
    }

    public function isBankModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('bank');
    }

    public function isHospitalModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('hospital');
    }

    public function isTravelModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('travel');
    }

    public function isCasinoModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('blackjack');
    }

    public function isCombatModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('kill');
    }

    public function isInventoryModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('inventory');
    }

    public function isMarketModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('blackmarket');
    }

    public function isGangsModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('gangs');
    }

    public function isTerritoriesModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('territories');
    }

    public function isPropertiesModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('properties');
    }

    public function isJailModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('jail');
    }

    public function isLeaderboardsModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('leaderboards');
    }

    public function isAchievementsModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('achievements');
    }

    public function isGangBankModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('gangbank');
    }

    public function isMailModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('mail');
    }

    public function isNewsModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('news');
    }

    public function isProfileModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('profile');
    }

    public function isSearchModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('search');
    }

    public function isBountiesModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('bounties');
    }

    public function isBulletsModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('bullets');
    }

    public function isCarsModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('cars');
    }

    public function isDetectivesModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('detectives');
    }

    public function isGarageModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('garage');
    }

    public function isPoliceChaseModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('policechase');
    }

    public function isTheftModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('theft');
    }

    public function isUsersOnlineModuleEnabled(): bool
    {
        return $this->isPublishedModuleEnabled('usersonline');
    }

    public function isTerminalThemeActive(): bool
    {
        return $this->activeThemeId() === 'terminal';
    }

    public function isZoneThemeActive(): bool
    {
        return $this->activeThemeId() === 'zone';
    }

    public function isPaperThemeActive(): bool
    {
        return $this->activeThemeId() === 'paper';
    }

    public function hasActiveRelease(): bool
    {
        return $this->activeReleaseVersion() >= 1;
    }

    public function hasPublishedCrimes(): bool
    {
        return $this->publishedCrimeCount() > 0;
    }

    public function hasPublishedModules(): bool
    {
        return $this->enabledModuleCount() > 0;
    }

    public function hasMediaBindings(): bool
    {
        return count($this->gameBootstrap()['mediaBindings'] ?? []) > 0;
    }

    public function hasPublishedItems(): bool
    {
        return $this->publishedItemCount() > 0;
    }

    public function hasPublishedJobs(): bool
    {
        return $this->publishedJobCount() > 0;
    }

    public function hasPublishedGyms(): bool
    {
        return $this->publishedGymCount() > 0;
    }

    public function hasPublishedProperties(): bool
    {
        return $this->publishedPropertyCount() > 0;
    }

    public function hasPublishedOpponents(): bool
    {
        return $this->publishedOpponentCount() > 0;
    }

    public function hasPublishedCourses(): bool
    {
        return $this->publishedCourseCount() > 0;
    }

    public function hasPublishedMissions(): bool
    {
        return $this->publishedMissionCount() > 0;
    }

    public function hasPublishedUpgrades(): bool
    {
        return $this->publishedUpgradeCount() > 0;
    }

    public function hasPublishedMarketCatalog(): bool
    {
        return $this->publishedMarketCatalogCount() > 0;
    }

    public function hasPublishedMaterials(): bool
    {
        return $this->publishedMaterialItemCount() > 0;
    }

    public function hasPublishedWeapons(): bool
    {
        return $this->publishedWeaponItemCount() > 0;
    }

    public function hasPublishedArmors(): bool
    {
        return $this->publishedArmorItemCount() > 0;
    }

    public function hasPublishedMedicalItems(): bool
    {
        return $this->publishedMedicalItemCount() > 0;
    }

    public function hasPublishedBoosters(): bool
    {
        return $this->publishedBoosterItemCount() > 0;
    }

    public function hasConfiguredCooldowns(): bool
    {
        return $this->configuredCooldownActionCount() > 0;
    }

    public function playerIsFullEnergy(string $playerId = 'founder-player'): bool
    {
        return $this->playerMissingEnergy($playerId) === 0;
    }

    public function playerIsFullNerve(string $playerId = 'founder-player'): bool
    {
        return $this->playerMissingNerve($playerId) === 0;
    }

    public function playerIsFullHappy(string $playerId = 'founder-player'): bool
    {
        return $this->playerMissingHappy($playerId) === 0;
    }

    public function playerIsFullLife(string $playerId = 'founder-player'): bool
    {
        return $this->playerMissingLifePoints($playerId) === 0;
    }

    public function playerHasBankBalance(string $playerId = 'founder-player'): bool
    {
        return $this->playerBankBalance($playerId) > 0;
    }

    public function playerHasCash(string $playerId = 'founder-player'): bool
    {
        return $this->playerCash($playerId) > 0;
    }

    public function playerHasPoints(string $playerId = 'founder-player'): bool
    {
        return $this->playerPoints($playerId) > 0;
    }

    public function playerHasMerits(string $playerId = 'founder-player'): bool
    {
        return $this->playerMerits($playerId) > 0;
    }

    public function playerHasCrimeXp(string $playerId = 'founder-player'): bool
    {
        return $this->playerCrimeXp($playerId) > 0;
    }

    public function playerHasGymXp(string $playerId = 'founder-player'): bool
    {
        return $this->playerGymXp($playerId) > 0;
    }

    public function playerHasJobPoints(string $playerId = 'founder-player'): bool
    {
        return $this->playerJobPoints($playerId) > 0;
    }

    public function playerHasRespect(string $playerId = 'founder-player'): bool
    {
        return $this->playerRespect($playerId) > 0;
    }

    public function playerHasBestChain(string $playerId = 'founder-player'): bool
    {
        return $this->playerBestChain($playerId) > 0;
    }

    public function playerHasCrimeSuccesses(string $playerId = 'founder-player'): bool
    {
        return $this->playerCrimeSuccessCount($playerId) > 0;
    }

    public function playerHasGymTrains(string $playerId = 'founder-player'): bool
    {
        return $this->playerGymTrainCount($playerId) > 0;
    }

    public function playerHasCombatWins(string $playerId = 'founder-player'): bool
    {
        return $this->playerCombatWinCount($playerId) > 0;
    }

    public function playerHasJobShifts(string $playerId = 'founder-player'): bool
    {
        return $this->playerJobShiftCount($playerId) > 0;
    }

    public function playerHasMarketBuys(string $playerId = 'founder-player'): bool
    {
        return $this->playerMarketBuyCount($playerId) > 0;
    }

    public function playerHasTotalCareerActions(string $playerId = 'founder-player'): bool
    {
        return $this->playerTotalCareerActions($playerId) > 0;
    }

    public function playerHasLoginStreak(string $playerId = 'founder-player'): bool
    {
        return $this->playerLoginStreak($playerId) > 0;
    }

    public function hasActiveFamilyOperations(): bool
    {
        return $this->activeFamilyOperationCount() > 0;
    }

    public function hasSoldMarketListings(): bool
    {
        return $this->soldMarketListingCount() > 0;
    }

    public function hasActiveEncounters(?string $playerId = null): bool
    {
        return $this->activeEncounterCount($playerId) > 0;
    }

    public function hasArrivedTravels(): bool
    {
        return $this->arrivedTravelCount() > 0;
    }

    public function hasMaterialLootAwarded(?string $source = null): bool
    {
        return $this->totalMaterialLootAwardedCount($source) > 0;
    }

    public function hasSecurityEvents(?string $playerId = null): bool
    {
        return $this->securityEventCount($playerId) > 0;
    }

    public function hasLedgerEntries(?string $playerId = null): bool
    {
        return $this->ledgerEntryCount($playerId) > 0;
    }

    public function hasEventLogs(?string $eventName = null): bool
    {
        return $this->eventLogCount($eventName) > 0;
    }

    public function hasReadyAssets(): bool
    {
        return $this->readyAssetCount() > 0;
    }

    public function hasUploadingAssets(): bool
    {
        return $this->uploadingAssetCount() > 0;
    }

    public function hasActiveWorldFinds(string $playerId = 'founder-player'): bool
    {
        return $this->activeWorldFindCount($playerId) > 0;
    }

    public function hasWorldShopSupply(): bool
    {
        return $this->worldShopSupplyCount() > 0;
    }

    public function hasOwnedTerritories(?string $factionId = null): bool
    {
        return $this->ownedTerritoryCount($factionId) > 0;
    }

    public function hasNeutralTerritories(): bool
    {
        return $this->neutralTerritoryCount() > 0;
    }

    public function hasContestedTerritories(): bool
    {
        return $this->contestedTerritoryCount() > 0;
    }

    public function hasLeaderboardRows(): bool
    {
        return $this->leaderboardRowCount() > 0;
    }

    public function hasFamilyUpgradeDefinitions(string $factionId = 'vipers'): bool
    {
        return $this->familyUpgradeCount($factionId) > 0;
    }

    public function hasFamilyOperationDefinitions(): bool
    {
        return $this->familyOperationDefinitionCount() > 0;
    }

    public function hasDailyContractPool(): bool
    {
        return $this->dailyContractPoolCount() > 0;
    }

    public function hasEligiblePlayerCombatOpponents(string $playerId = 'founder-player'): bool
    {
        return $this->eligiblePlayerCombatOpponentCount($playerId) > 0;
    }

    public function hasFamilyMembers(string $playerId = 'founder-player'): bool
    {
        return $this->familyMemberCount($playerId) > 0;
    }

    public function hasFamilyRespect(string $playerId = 'founder-player'): bool
    {
        return $this->familyRespectBalance($playerId) > 0;
    }

    public function hasHospitalMissingLife(string $playerId = 'founder-player'): bool
    {
        return $this->hospitalMissingLife($playerId) > 0;
    }

    public function hasHospitalDiscount(string $playerId = 'founder-player'): bool
    {
        return $this->hospitalDiscountPct($playerId) > 0.0;
    }

    public function hasRateLimitRemainingHits(string $playerId = 'founder-player'): bool
    {
        return $this->rateLimitRemainingHits($playerId) > 0;
    }

    public function hasDisabledModules(): bool
    {
        return $this->disabledModuleCount() > 0;
    }

    public function hasDisabledPublishedModules(): bool
    {
        return count($this->disabledPublishedModuleIds()) > 0;
    }

    public function hasDisabledAdminCrimes(): bool
    {
        return $this->disabledAdminCrimeCount() > 0;
    }

    public function hasAdminCrimes(): bool
    {
        return $this->adminCrimeCount() > 0;
    }

    public function hasInstalledThemes(): bool
    {
        return $this->installedThemeCount() > 0;
    }

    public function hasInstalledModules(): bool
    {
        return $this->installedModuleCount() > 0;
    }

    public function hasWorldTicks(): bool
    {
        return $this->worldTickCount() > 0;
    }

    public function hasOwnerPlaytestActions(): bool
    {
        return $this->ownerPlaytestActionCount() > 0;
    }

    public function hasDatabaseTables(): bool
    {
        return $this->tableCount() > 0;
    }

    public function hasCities(): bool
    {
        return $this->cityCount() > 0;
    }

    public function hasEditableCatalogCategories(): bool
    {
        return count($this->editableCatalogCategories()) > 0;
    }

    public function hasSupportedMediaTargetTypes(): bool
    {
        return count($this->supportedMediaTargetTypes()) > 0;
    }

    public function hasDailyStreakSchedule(): bool
    {
        return count($this->dailyStreakSchedule()) > 0;
    }

    public function hasResourceRegenIntervals(): bool
    {
        return count($this->resourceRegenIntervals()) > 0;
    }

    public function hasValidBrowserSessionLifetime(): bool
    {
        return $this->browserSessionLifetimeSeconds() > 0;
    }

    public function hasValidMaxUploadBytes(): bool
    {
        return $this->maxUploadBytes() > 0;
    }

    public function hasValidUploadChunkBytes(): bool
    {
        return $this->uploadChunkBytes() > 0;
    }

    public function hasValidCatalogDraftRevision(): bool
    {
        return $this->catalogDraftRevision() >= 1;
    }

    public function hasValidHighLowVersion(string $playerId = 'founder-player'): bool
    {
        return $this->highLowVersion($playerId) >= 1;
    }

    public function hasValidHighLowCard(string $playerId = 'founder-player'): bool
    {
        $card = $this->highLowCurrentCard($playerId);
        return $card >= 1 && $card <= 14;
    }

    public function playerHasWeaponBonus(string $playerId = 'founder-player'): bool
    {
        return $this->playerWeaponBonusPct($playerId) > 0;
    }

    public function playerHasArmorMitigation(string $playerId = 'founder-player'): bool
    {
        return $this->playerArmorMitigationPct($playerId) > 0;
    }

    public function playerHasActivePropertyCost(string $playerId = 'founder-player'): bool
    {
        return $this->playerActivePropertyCost($playerId) > 0;
    }

    public function playerHasActivePropertyHappyBonus(string $playerId = 'founder-player'): bool
    {
        return $this->playerActivePropertyHappyBonus($playerId) > 0;
    }

    public function playerHasAvailableGymSessions(string $playerId = 'founder-player'): bool
    {
        return $this->playerAvailableGymSessions($playerId) > 0;
    }

    public function playerHasEnergyRegenRemaining(string $playerId = 'founder-player'): bool
    {
        return $this->playerEnergyRegenSecondsRemaining($playerId) > 0;
    }

    public function playerHasNerveRegenRemaining(string $playerId = 'founder-player'): bool
    {
        return $this->playerNerveRegenSecondsRemaining($playerId) > 0;
    }

    public function playerHasHappyRegenRemaining(string $playerId = 'founder-player'): bool
    {
        return $this->playerHappyRegenSecondsRemaining($playerId) > 0;
    }

    public function playerHasLifeRegenRemaining(string $playerId = 'founder-player'): bool
    {
        return $this->playerLifeRegenSecondsRemaining($playerId) > 0;
    }

    public function playerHasXpToNextLevel(string $playerId = 'founder-player'): bool
    {
        return $this->playerXpToNextLevel($playerId) > 0;
    }

    public function playerHasActiveGymCost(string $playerId = 'founder-player'): bool
    {
        return $this->playerActiveGymCost($playerId) > 0;
    }

    public function playerHasHospitalHealCost(string $playerId = 'founder-player'): bool
    {
        return $this->hospitalHealCost($playerId) > 0;
    }

    public function playerHasTerritoryDailyRespectIncome(string $playerId = 'founder-player'): bool
    {
        return $this->territoryDailyRespectIncome($playerId) > 0;
    }

    public function playerHasTerritoryControl(string $playerId = 'founder-player'): bool
    {
        return $this->territoryControlPercent($playerId) > 0.0;
    }

    public function playerHasTotalCombatStats(string $playerId = 'founder-player'): bool
    {
        return $this->playerTotalCombatStats($playerId) > 0;
    }

    public function playerHasStrength(string $playerId = 'founder-player'): bool
    {
        return $this->playerStrength($playerId) > 0;
    }

    public function playerHasDefense(string $playerId = 'founder-player'): bool
    {
        return $this->playerDefense($playerId) > 0;
    }

    public function playerHasSpeed(string $playerId = 'founder-player'): bool
    {
        return $this->playerSpeed($playerId) > 0;
    }

    public function playerHasDexterity(string $playerId = 'founder-player'): bool
    {
        return $this->playerDexterity($playerId) > 0;
    }

    public function playerHasMaxLife(string $playerId = 'founder-player'): bool
    {
        return $this->playerMaxLife($playerId) > 0;
    }

    public function playerHasMaxEnergy(string $playerId = 'founder-player'): bool
    {
        return $this->playerMaxEnergy($playerId) > 0;
    }

    public function playerHasMaxNerve(string $playerId = 'founder-player'): bool
    {
        return $this->playerMaxNerve($playerId) > 0;
    }

    public function playerHasMaxHappy(string $playerId = 'founder-player'): bool
    {
        return $this->playerMaxHappy($playerId) > 0;
    }

    public function playerHasEnergy(string $playerId = 'founder-player'): bool
    {
        return $this->playerEnergy($playerId) > 0;
    }

    public function playerHasNerve(string $playerId = 'founder-player'): bool
    {
        return $this->playerNerve($playerId) > 0;
    }

    public function playerHasHappy(string $playerId = 'founder-player'): bool
    {
        return $this->playerHappy($playerId) > 0;
    }

    public function playerHasLife(string $playerId = 'founder-player'): bool
    {
        return $this->playerLife($playerId) > 0;
    }

    public function playerHasXp(string $playerId = 'founder-player'): bool
    {
        return $this->playerXp($playerId) > 0;
    }

    public function playerHasLevel(string $playerId = 'founder-player'): bool
    {
        return $this->playerLevel($playerId) >= 1;
    }

    public function playerHasNetWorth(string $playerId = 'founder-player'): bool
    {
        return $this->playerNetWorth($playerId) > 0;
    }

    public function playerHasMissingEnergy(string $playerId = 'founder-player'): bool
    {
        return $this->playerMissingEnergy($playerId) > 0;
    }

    public function playerHasMissingNerve(string $playerId = 'founder-player'): bool
    {
        return $this->playerMissingNerve($playerId) > 0;
    }

    public function playerHasMissingHappy(string $playerId = 'founder-player'): bool
    {
        return $this->playerMissingHappy($playerId) > 0;
    }

    public function playerHasMissingLifePoints(string $playerId = 'founder-player'): bool
    {
        return $this->playerMissingLifePoints($playerId) > 0;
    }

    public function playerHasActiveGymIndex(string $playerId = 'founder-player'): bool
    {
        return $this->playerActiveGymIndex($playerId) >= 0;
    }

    public function playerHasActiveJobRank(string $playerId = 'founder-player'): bool
    {
        return $this->playerActiveJobRankIndex($playerId) >= 0;
    }

    public function playerHasActiveProperty(string $playerId = 'founder-player'): bool
    {
        return $this->playerActivePropertyId($playerId) !== '';
    }

    public function playerHasActiveJob(string $playerId = 'founder-player'): bool
    {
        return $this->playerActiveJobId($playerId) !== '';
    }

    public function playerHasCity(string $playerId = 'founder-player'): bool
    {
        return $this->playerCity($playerId) !== '';
    }

    public function playerHasUsername(string $playerId = 'founder-player'): bool
    {
        return $this->playerUsername($playerId) !== '';
    }

    public function playerHasLastLoginDay(string $playerId = 'founder-player'): bool
    {
        return $this->playerLastLoginDay($playerId) !== null;
    }

    public function playerHasFactionRole(string $playerId = 'founder-player'): bool
    {
        return $this->playerFactionRole($playerId) !== null;
    }

    public function playerHasDominantStat(string $playerId = 'founder-player'): bool
    {
        return $this->playerDominantStat($playerId) !== '';
    }

    public function playerHasLoadoutSummary(string $playerId = 'founder-player'): bool
    {
        return count($this->playerLoadoutSummary($playerId)) > 0;
    }

    public function playerHasOnboardingSummary(string $playerId = 'founder-player'): bool
    {
        return count($this->playerOnboardingSummary($playerId)) > 0;
    }

    public function playerHasHourlySearchMaterialUsage(string $playerId = 'founder-player'): bool
    {
        return count($this->playerHourlySearchMaterialUsage($playerId)) > 0;
    }

    public function hasWorldHourlyMaterialUsage(): bool
    {
        return count($this->worldHourlyMaterialUsage()) > 0;
    }

    public function hasCurrentFamilySeason(): bool
    {
        return count($this->currentFamilySeason()) > 0;
    }

    public function hasPublishedRulesSummary(): bool
    {
        return count($this->publishedRulesSummary()) > 0;
    }

    public function hasConfiguredCacheAdapter(): bool
    {
        return $this->configuredCacheAdapter() !== '';
    }

    public function hasValidBrowserSessionCookieName(): bool
    {
        return $this->browserSessionCookieName() !== '';
    }

    public function hasValidTerritoryNeutralColor(): bool
    {
        return $this->territoryNeutralColor() !== '';
    }

    public function hasValidActiveReleaseId(): bool
    {
        $id = $this->activeReleaseId();
        return is_string($id) && $id !== '';
    }

    public function hasValidActiveThemeId(): bool
    {
        $id = $this->activeThemeId();
        return is_string($id) && $id !== '';
    }

    public function hasValidDatabaseDriver(): bool
    {
        return $this->databaseDriver() !== '';
    }

    public function hasEnabledCrimes(): bool
    {
        return $this->enabledCrimeCount() > 0;
    }

    public function hasFactions(): bool
    {
        return $this->factionCount() > 0;
    }

    public function hasTerritories(): bool
    {
        return $this->territoryCount() > 0;
    }

    public function hasActiveWars(): bool
    {
        return $this->activeWarsCount() > 0;
    }

    public function hasActiveWorldEvents(): bool
    {
        return $this->activeWorldEventCount() > 0;
    }

    public function hasMarketListings(): bool
    {
        return $this->marketListingCount() > 0;
    }

    public function hasClaimedAccounts(): bool
    {
        return $this->claimedAccountCount() > 0;
    }

    public function hasActiveSessions(): bool
    {
        return $this->activeSessionCount() > 0;
    }

    public function hasAuditEntries(): bool
    {
        return $this->auditEntryCount() > 0;
    }

    public function hasReleases(): bool
    {
        return $this->releaseCount() > 0;
    }

    public function hasTopCashAmount(): bool
    {
        return $this->topCashAmount() > 0;
    }

    public function hasTotalBankedCash(): bool
    {
        return $this->totalBankedCash() > 0;
    }

    public function hasInjuredPlayers(): bool
    {
        return $this->injuredPlayerCount() > 0;
    }

    public function hasActiveTravelers(): bool
    {
        return $this->activeTravelerCount() > 0;
    }

    public function hasActiveShopSupplies(): bool
    {
        return $this->activeShopSupplyCount() > 0;
    }

    public function hasTotalFamilyRespect(): bool
    {
        return $this->totalFamilyRespect() > 0;
    }

    public function hasRegisteredPlayers(): bool
    {
        return $this->registeredPlayerCount() > 0;
    }

    public function hasUnclaimedStreetFinds(): bool
    {
        return $this->unclaimedStreetFindCount() > 0;
    }

    public function hasValidCacheAdapterName(): bool
    {
        return $this->cacheAdapterName() !== '';
    }

    public function hasValidPlayerCombatMaxRounds(): bool
    {
        return $this->playerCombatMaxRounds() > 0;
    }

    public function playerHasUnreadNotifications(string $playerId = 'founder-player'): bool
    {
        return $this->unreadNotificationCount($playerId) > 0;
    }

    public function playerHasActiveCooldowns(string $playerId = 'founder-player'): bool
    {
        return $this->activeCooldownCount($playerId) > 0;
    }

    public function playerHasRank(string $playerId = 'founder-player'): bool
    {
        return $this->playerRank($playerId) !== null;
    }

    public function playerHasTravelStatus(string $playerId = 'founder-player'): bool
    {
        return $this->playerTravelStatus($playerId) !== '';
    }

    public function hasAuthoredCrimes(): bool
    {
        return $this->totalAuthoredCrimeCount() > 0;
    }

    public function isScreenEnabledInActiveRelease(string $screen): bool
    {
        return ($this->releases->active()['manifest']['modules'][$screen] ?? true) !== false;
    }

    public function defaultCooldownSeconds(string $action): int
    {
        return self::COOLDOWN_DEFAULTS[$action] ?? 0;
    }

    public function isKnownCooldownAction(string $action): bool
    {
        return array_key_exists($action, self::COOLDOWN_DEFAULTS);
    }

    /** @return list<string> */
    public function engineCapabilities(): array
    {
        return $this->status()['capabilities'];
    }

    public function hasEngineCapability(string $capability): bool
    {
        return in_array($capability, $this->engineCapabilities(), true);
    }

    public function isRedisPortReady(): bool
    {
        return (bool) ($this->status()['redisPortReady'] ?? false);
    }

    public function isServerAuthoritative(): bool
    {
        return (bool) ($this->status()['serverAuthoritative'] ?? false);
    }

    public function engineVersion(): string
    {
        return (string) ($this->status()['version'] ?? '1.0.0');
    }

    public function engineApiVersion(): string
    {
        return (string) ($this->status()['api'] ?? 'v1');
    }

    public function engineName(): string
    {
        return (string) ($this->status()['engine'] ?? 'ZONE Engine');
    }

    public function hasEngineCapabilities(): bool
    {
        return count($this->engineCapabilities()) > 0;
    }

    /** @return list<string> */
    public function knownCooldownActions(): array
    {
        return array_keys(self::COOLDOWN_DEFAULTS);
    }

    public function knownCooldownActionCount(): int
    {
        return count(self::COOLDOWN_DEFAULTS);
    }

    public function maxDefaultCooldownSeconds(): int
    {
        return max(self::COOLDOWN_DEFAULTS);
    }

    public function minDefaultCooldownSeconds(): int
    {
        return min(self::COOLDOWN_DEFAULTS);
    }

    public function effectiveCooldownSeconds(string $action): int
    {
        return $this->cooldownSeconds[$action] ?? $this->defaultCooldownSeconds($action);
    }

    public function hasEffectiveCooldown(string $action): bool
    {
        return $this->effectiveCooldownSeconds($action) > 0;
    }

    /** @return array<string, int> */
    public function effectiveCooldownMap(): array
    {
        return $this->cooldownSeconds;
    }

    public function maxEffectiveCooldownSeconds(): int
    {
        return max($this->cooldownSeconds ?: [0]);
    }

    public function minEffectiveCooldownSeconds(): int
    {
        return min($this->cooldownSeconds ?: [0]);
    }

    public function isActionCooldownZero(string $action): bool
    {
        return $this->effectiveCooldownSeconds($action) === 0;
    }

    public function zeroCooldownActionCount(): int
    {
        return count(array_filter($this->cooldownSeconds, static fn (int $s): bool => $s === 0));
    }

    public function positiveCooldownActionCount(): int
    {
        return count(array_filter($this->cooldownSeconds, static fn (int $s): bool => $s > 0));
    }

    public function totalDefaultCooldownSeconds(): int
    {
        return array_sum(self::COOLDOWN_DEFAULTS);
    }

    public function totalEffectiveCooldownSeconds(): int
    {
        return array_sum($this->cooldownSeconds);
    }

    /** @return array<string, mixed> */
    public function activeReleaseManifest(): array
    {
        return (array) ($this->releases->active()['manifest'] ?? []);
    }

    public function activeReleaseModuleCount(): int
    {
        return count($this->releases->active()['manifest']['modules'] ?? []);
    }

    public function enabledReleaseScreenCount(): int
    {
        return count(array_filter($this->releases->active()['manifest']['modules'] ?? [], static fn ($enabled): bool => $enabled !== false));
    }

    public function disabledReleaseScreenCount(): int
    {
        return count(array_filter($this->releases->active()['manifest']['modules'] ?? [], static fn ($enabled): bool => $enabled === false));
    }

    public function hasEnabledReleaseScreens(): bool
    {
        return $this->enabledReleaseScreenCount() > 0;
    }

    public function hasDisabledReleaseScreens(): bool
    {
        return $this->disabledReleaseScreenCount() > 0;
    }

    public function activeReleaseScreenRatioPct(): float
    {
        $total = $this->activeReleaseModuleCount();
        return $total > 0 ? round($this->enabledReleaseScreenCount() / $total * 100, 2) : 100.0;
    }

    public function activeReleaseHasModules(): bool
    {
        return $this->activeReleaseModuleCount() > 0;
    }

    /** @return list<string> */
    public function activeReleaseModuleNames(): array
    {
        return array_keys($this->activeReleaseManifest()['modules'] ?? []);
    }

    public function isKnownReleaseModule(string $module): bool
    {
        return in_array($module, $this->activeReleaseModuleNames(), true);
    }

    public function activeReleaseNotes(): string
    {
        return (string) ($this->releases->active()['notes'] ?? '');
    }

    public function hasActiveReleaseNotes(): bool
    {
        return $this->activeReleaseNotes() !== '';
    }

    public function activeReleaseThemeId(): string
    {
        return (string) ($this->activeReleaseManifest()['theme'] ?? 'noir-crime');
    }

    public function activeReleaseMediaBindingCount(): int
    {
        return count($this->activeReleaseManifest()['mediaBindings'] ?? []);
    }

    public function hasActiveReleaseMediaBindings(): bool
    {
        return $this->activeReleaseMediaBindingCount() > 0;
    }

    /** @return array<string, mixed> */
    public function activeReleaseWorldPolicy(): array
    {
        return (array) ($this->activeReleaseManifest()['worldPolicy'] ?? []);
    }

    public function isWorldPolicyEnabledInActiveRelease(): bool
    {
        return ($this->activeReleaseWorldPolicy()['enabled'] ?? true) !== false;
    }

    public function activeReleaseWorldTickSeconds(): int
    {
        return (int) ($this->activeReleaseWorldPolicy()['tickSeconds'] ?? 60);
    }

    public function activeReleasePublishedAt(): string
    {
        return (string) ($this->releases->active()['published_at'] ?? $this->releases->active()['created_at'] ?? '');
    }

    public function hasActiveReleasePublishedAt(): bool
    {
        return $this->activeReleasePublishedAt() !== '';
    }

    public function draftReleaseVersion(): int
    {
        return (int) ($this->releases->draft()['version'] ?? 1);
    }

    /** @return array<string, mixed> */
    public function draftReleaseManifest(): array
    {
        return (array) ($this->releases->draft()['manifest'] ?? []);
    }

    public function draftReleaseModuleCount(): int
    {
        return count($this->draftReleaseManifest()['modules'] ?? []);
    }

    public function draftReleaseThemeId(): string
    {
        return (string) ($this->draftReleaseManifest()['theme'] ?? 'noir-crime');
    }

    public function draftReleaseMediaBindingCount(): int
    {
        return count($this->draftReleaseManifest()['mediaBindings'] ?? []);
    }

    public function hasDraftReleaseMediaBindings(): bool
    {
        return $this->draftReleaseMediaBindingCount() > 0;
    }

    /** @return array<string, mixed> */
    public function draftReleaseWorldPolicy(): array
    {
        return (array) ($this->draftReleaseManifest()['worldPolicy'] ?? []);
    }

    public function isWorldPolicyEnabledInDraftRelease(): bool
    {
        return ($this->draftReleaseWorldPolicy()['enabled'] ?? true) !== false;
    }

    public function draftReleaseWorldTickSeconds(): int
    {
        return (int) ($this->draftReleaseWorldPolicy()['tickSeconds'] ?? 60);
    }

    public function isScreenEnabledInDraftRelease(string $screen): bool
    {
        return ($this->draftReleaseManifest()['modules'][$screen] ?? true) !== false;
    }

    public function draftReleaseEnabledScreenCount(): int
    {
        $modules = (array) ($this->draftReleaseManifest()['modules'] ?? []);
        return count(array_filter($modules, static fn ($enabled): bool => $enabled !== false));
    }

    public function draftReleaseDisabledScreenCount(): int
    {
        $modules = (array) ($this->draftReleaseManifest()['modules'] ?? []);
        return count(array_filter($modules, static fn ($enabled): bool => $enabled === false));
    }

    public function hasDraftReleaseEnabledScreens(): bool
    {
        return $this->draftReleaseEnabledScreenCount() > 0;
    }

    public function hasDraftReleaseDisabledScreens(): bool
    {
        return $this->draftReleaseDisabledScreenCount() > 0;
    }

    public function draftReleaseScreenRatioPct(): float
    {
        $total = $this->draftReleaseModuleCount();
        return $total > 0 ? round(($this->draftReleaseEnabledScreenCount() / $total) * 100.0, 2) : 0.0;
    }

    public function draftReleasePageCount(): int
    {
        return count((array) ($this->draftReleaseManifest()['pages'] ?? []));
    }

    public function hasDraftReleasePages(): bool
    {
        return $this->draftReleasePageCount() > 0;
    }

    public function activeReleasePageCount(): int
    {
        return count((array) ($this->activeReleaseManifest()['pages'] ?? []));
    }

    public function hasActiveReleasePages(): bool
    {
        return $this->activeReleasePageCount() > 0;
    }

    public function draftReleaseHasNotes(): bool
    {
        return trim((string) ($this->releases->draft()['notes'] ?? '')) !== '';
    }

    public function draftReleaseChannel(): string
    {
        return (string) ($this->releases->draft()['channel'] ?? 'production');
    }

    public function draftReleaseUpdatedBy(): string
    {
        return (string) ($this->releases->draft()['updatedBy'] ?? '');
    }

    public function draftReleaseUpdatedAt(): string
    {
        return (string) ($this->releases->draft()['updatedAt'] ?? '');
    }

    public function draftReleaseFingerprint(): string
    {
        return (string) ($this->releases->draft()['draftFingerprint'] ?? '');
    }

    public function hasDraftReleaseFingerprint(): bool
    {
        return strlen($this->draftReleaseFingerprint()) === 64;
    }

    public function publishedReleaseCount(): int
    {
        return $this->releases->releaseCount();
    }

    public function hasPublishedReleases(): bool
    {
        return $this->publishedReleaseCount() > 0;
    }

    /** @return list<string> */
    public function supportedReleaseScreenIds(): array
    {
        return ReleaseManager::supportedScreenIds();
    }

    /** @return list<string> */
    public function supportedReleaseBlockTypes(): array
    {
        return ReleaseManager::supportedBlockTypes();
    }

    public function hasReleaseFoundation(): bool
    {
        return $this->releases->hasFoundation();
    }

    public function isSupportedReleaseScreenId(string $screen): bool
    {
        return in_array($screen, $this->supportedReleaseScreenIds(), true);
    }

    public function isSupportedReleaseBlockType(string $type): bool
    {
        return in_array($type, $this->supportedReleaseBlockTypes(), true);
    }

    public function supportedReleaseScreenCount(): int
    {
        return count($this->supportedReleaseScreenIds());
    }

    public function supportedReleaseBlockTypeCount(): int
    {
        return count($this->supportedReleaseBlockTypes());
    }

    public function releaseFoundationThemeId(): string
    {
        return (string) ($this->releases->foundation()['theme'] ?? 'noir-crime');
    }

    public function releaseFoundationModuleCount(): int
    {
        return count((array) ($this->releases->foundation()['modules'] ?? []));
    }

    public function releaseFoundationPageCount(): int
    {
        return count((array) ($this->releases->foundation()['pages'] ?? []));
    }

    public function hasReleaseFoundationPages(): bool
    {
        return $this->releaseFoundationPageCount() > 0;
    }

    public function releaseFoundationHasWorldPolicy(): bool
    {
        return isset($this->releases->foundation()['worldPolicy']) && is_array($this->releases->foundation()['worldPolicy']);
    }

    public function releaseFoundationWorldTickSeconds(): int
    {
        return (int) ($this->releases->foundation()['worldPolicy']['tickSeconds'] ?? 60);
    }

    /** @return list<string> */
    public function installedThemeIds(): array
    {
        return $this->themes->installedThemeIds();
    }

    public function activeThemeVersion(): string
    {
        return (string) ($this->themes->activeTheme()['version'] ?? '1.0.0');
    }

    public function activeThemeDescription(): string
    {
        return (string) ($this->themes->activeTheme()['description'] ?? '');
    }

    public function isThemeInstalled(string $id): bool
    {
        return in_array($id, $this->installedThemeIds(), true);
    }

    public function activeThemePreviewColor(): string
    {
        return (string) ($this->themes->activeTheme()['preview'] ?? '#d7ff3f');
    }

    /** @return list<string> */
    public function enabledModuleIdList(): array
    {
        return $this->modules->enabledModuleIds();
    }

    public function enabledModuleIdCount(): int
    {
        return count($this->enabledModuleIdList());
    }

    public function isModuleEnabledById(string $id): bool
    {
        return $this->modules->isEnabled($id);
    }

    public function moduleRegistryTotalCount(): int
    {
        return (int) ($this->modules->summary()['total'] ?? 0);
    }

    public function moduleRegistryInstalledCount(): int
    {
        return (int) ($this->modules->summary()['installed'] ?? 0);
    }

    public function moduleRegistryEnabledCount(): int
    {
        return (int) ($this->modules->summary()['enabled'] ?? 0);
    }

    public function moduleRegistryDisabledCount(): int
    {
        return max(0, $this->moduleRegistryInstalledCount() - $this->moduleRegistryEnabledCount());
    }

    public function moduleRegistryUninstalledCount(): int
    {
        return max(0, $this->moduleRegistryTotalCount() - $this->moduleRegistryInstalledCount());
    }

    public function moduleRegistryEnabledRatioPct(): float
    {
        $total = $this->moduleRegistryTotalCount();
        return $total > 0 ? round(($this->moduleRegistryEnabledCount() / $total) * 100.0, 2) : 0.0;
    }

    public function hasUninstalledModules(): bool
    {
        return $this->moduleRegistryUninstalledCount() > 0;
    }

    public function activeTerritoryWarCount(): int
    {
        return $this->territories->activeWarsCount();
    }

    public function hasActiveTerritoryWars(): bool
    {
        return $this->activeTerritoryWarCount() > 0;
    }

    public function territoryBlockTotalCount(string $playerId = 'founder-player'): int
    {
        return count((array) ($this->territories->snapshot($playerId)['blocks'] ?? []));
    }

    public function hasTerritoryBlocks(string $playerId = 'founder-player'): bool
    {
        return $this->territoryBlockTotalCount($playerId) > 0;
    }

    public function territoryMapRevision(string $playerId = 'founder-player'): string
    {
        return (string) ($this->territories->snapshot($playerId)['revision'] ?? '');
    }

    public function territoryPlayerFactionRole(string $playerId = 'founder-player'): ?string
    {
        $val = $this->territories->snapshot($playerId)['playerRole'] ?? null;
        return is_string($val) && $val !== '' ? $val : null;
    }

    public function territoryFactionCount(string $playerId = 'founder-player'): int
    {
        return count((array) ($this->territories->snapshot($playerId)['factions'] ?? []));
    }

    public function hasTerritoryFactions(string $playerId = 'founder-player'): bool
    {
        return $this->territoryFactionCount($playerId) > 0;
    }

    public function territoryPlayerFactionId(string $playerId = 'founder-player'): ?string
    {
        $val = $this->territories->snapshot($playerId)['playerFactionId'] ?? null;
        return is_string($val) && $val !== '' ? $val : null;
    }

    public function isPlayerInTerritoryFaction(string $playerId = 'founder-player'): bool
    {
        return $this->territoryPlayerFactionId($playerId) !== null;
    }

    public function dailyContractId(string $playerId = 'founder-player'): string
    {
        return (string) ($this->dailyContract($playerId)['contract']['id'] ?? '');
    }

    public function dailyContractMetric(string $playerId = 'founder-player'): string
    {
        return (string) ($this->dailyContract($playerId)['contract']['metric'] ?? '');
    }

    public function dailyContractProgress(string $playerId = 'founder-player'): int
    {
        return (int) ($this->dailyContract($playerId)['progress'] ?? 0);
    }

    public function dailyContractTarget(string $playerId = 'founder-player'): int
    {
        return (int) ($this->dailyContract($playerId)['target'] ?? 0);
    }

    public function dailyContractProgressPct(string $playerId = 'founder-player'): int
    {
        return (int) ($this->dailyContract($playerId)['progressPct'] ?? 0);
    }

    public function dailyContractRemaining(string $playerId = 'founder-player'): int
    {
        return (int) ($this->dailyContract($playerId)['remaining'] ?? 0);
    }

    public function dailyContractRewardCash(string $playerId = 'founder-player'): int
    {
        return (int) ($this->dailyContract($playerId)['contract']['reward_cash'] ?? 0);
    }

    public function dailyContractRewardXp(string $playerId = 'founder-player'): int
    {
        return (int) ($this->dailyContract($playerId)['contract']['reward_xp'] ?? 0);
    }

    public function dailyContractDay(string $playerId = 'founder-player'): string
    {
        return (string) ($this->dailyContract($playerId)['contract']['day'] ?? '');
    }

    public function canClaimDailyContract(string $playerId = 'founder-player'): bool
    {
        $state = $this->dailyContract($playerId);
        return (bool) ($state['complete'] ?? false) && !(bool) ($state['claimed'] ?? false);
    }

    public function dailyContractTitleEn(string $playerId = 'founder-player'): string
    {
        return (string) ($this->dailyContract($playerId)['contract']['name_en'] ?? '');
    }

    public function dailyContractTitleAr(string $playerId = 'founder-player'): string
    {
        return (string) ($this->dailyContract($playerId)['contract']['name_ar'] ?? '');
    }

    public function dailyStreakDayRewardCash(int $day = 1): int
    {
        return (int) ($this->dailyStreakSchedule()[$day][0] ?? 0);
    }

    public function dailyStreakDayRefillsNerve(int $day = 1): bool
    {
        return (bool) ($this->dailyStreakSchedule()[$day][1] ?? false);
    }

    public function dailyStreakDayRefillsEnergy(int $day = 1): bool
    {
        return (bool) ($this->dailyStreakSchedule()[$day][2] ?? false);
    }

    public function dailyStreakDayCount(): int
    {
        return count($this->dailyStreakSchedule());
    }

    public function maxDailyStreakCashReward(): int
    {
        $rewards = array_map(static fn (array $row): int => (int) ($row[0] ?? 0), $this->dailyStreakSchedule());
        return $rewards === [] ? 0 : max($rewards);
    }

    public function minDailyStreakCashReward(): int
    {
        $rewards = array_map(static fn (array $row): int => (int) ($row[0] ?? 0), $this->dailyStreakSchedule());
        return $rewards === [] ? 0 : min($rewards);
    }

    public function totalDailyStreakCycleCashReward(): int
    {
        $rewards = array_map(static fn (array $row): int => (int) ($row[0] ?? 0), $this->dailyStreakSchedule());
        return array_sum($rewards);
    }

    public function isValidDailyStreakDay(int $day): bool
    {
        return isset($this->dailyStreakSchedule()[$day]);
    }

    /** @return list<string> */
    public function dailyContractPoolIds(): array
    {
        return array_map(
            static fn (array $contract): string => (string) ($contract['id'] ?? ''),
            \Zone\Engine\Core\Game\DailyService::contractPool(),
        );
    }

    public function isKnownDailyContractId(string $id): bool
    {
        return in_array($id, $this->dailyContractPoolIds(), true);
    }

    public function maxDailyContractRewardCash(): int
    {
        $rewards = array_map(
            static fn (array $contract): int => (int) ($contract['reward_cash'] ?? 0),
            \Zone\Engine\Core\Game\DailyService::contractPool(),
        );
        return $rewards === [] ? 0 : max($rewards);
    }

    public function minDailyContractRewardCash(): int
    {
        $rewards = array_map(
            static fn (array $contract): int => (int) ($contract['reward_cash'] ?? 0),
            \Zone\Engine\Core\Game\DailyService::contractPool(),
        );
        return $rewards === [] ? 0 : min($rewards);
    }

    public function dailyContractDefaultRewardXp(): int
    {
        $first = \Zone\Engine\Core\Game\DailyService::contractPool()[0] ?? [];
        return (int) ($first['reward_xp'] ?? 200);
    }

    /** @return list<string> */
    public function dailyContractPoolMetrics(): array
    {
        return array_map(
            static fn (array $contract): string => (string) ($contract['metric'] ?? ''),
            \Zone\Engine\Core\Game\DailyService::contractPool(),
        );
    }

    public function isKnownDailyContractMetric(string $metric): bool
    {
        return in_array($metric, $this->dailyContractPoolMetrics(), true);
    }

    public function totalDailyContractPoolRewardCash(): int
    {
        return array_sum(array_map(
            static fn (array $contract): int => (int) ($contract['reward_cash'] ?? 0),
            \Zone\Engine\Core\Game\DailyService::contractPool(),
        ));
    }

    public function totalDailyContractPoolRewardXp(): int
    {
        return array_sum(array_map(
            static fn (array $contract): int => (int) ($contract['reward_xp'] ?? 0),
            \Zone\Engine\Core\Game\DailyService::contractPool(),
        ));
    }

    public function maxDailyContractTarget(): int
    {
        $targets = array_map(
            static fn (array $contract): int => (int) ($contract['target'] ?? 0),
            \Zone\Engine\Core\Game\DailyService::contractPool(),
        );
        return $targets === [] ? 0 : max($targets);
    }

    public function minDailyContractTarget(): int
    {
        $targets = array_map(
            static fn (array $contract): int => (int) ($contract['target'] ?? 0),
            \Zone\Engine\Core\Game\DailyService::contractPool(),
        );
        return $targets === [] ? 0 : min($targets);
    }

    public function dailyContractTargetById(string $id): int
    {
        foreach (\Zone\Engine\Core\Game\DailyService::contractPool() as $contract) {
            if (($contract['id'] ?? '') === $id) {
                return (int) ($contract['target'] ?? 0);
            }
        }
        return 0;
    }

    public function dailyContractRewardCashById(string $id): int
    {
        foreach (\Zone\Engine\Core\Game\DailyService::contractPool() as $contract) {
            if (($contract['id'] ?? '') === $id) {
                return (int) ($contract['reward_cash'] ?? 0);
            }
        }
        return 0;
    }

    public function dailyContractRewardXpById(string $id): int
    {
        foreach (\Zone\Engine\Core\Game\DailyService::contractPool() as $contract) {
            if (($contract['id'] ?? '') === $id) {
                return (int) ($contract['reward_xp'] ?? 0);
            }
        }
        return 0;
    }

    public function dailyContractMetricById(string $id): string
    {
        foreach (\Zone\Engine\Core\Game\DailyService::contractPool() as $contract) {
            if (($contract['id'] ?? '') === $id) {
                return (string) ($contract['metric'] ?? '');
            }
        }
        return '';
    }

    public function dailyContractTitleEnById(string $id): string
    {
        foreach (\Zone\Engine\Core\Game\DailyService::contractPool() as $contract) {
            if (($contract['id'] ?? '') === $id) {
                return (string) ($contract['name_en'] ?? '');
            }
        }
        return '';
    }

    public function dailyContractTitleArById(string $id): string
    {
        foreach (\Zone\Engine\Core\Game\DailyService::contractPool() as $contract) {
            if (($contract['id'] ?? '') === $id) {
                return (string) ($contract['name_ar'] ?? '');
            }
        }
        return '';
    }

    public function playerNextStreakDay(string $playerId = 'founder-player'): int
    {
        $streak = $this->playerLoginStreak($playerId);
        return ($streak >= 1 && $streak <= 7) ? ($streak % 7) + 1 : 1;
    }

    public function playerNextStreakRewardCash(string $playerId = 'founder-player'): int
    {
        return $this->dailyStreakDayRewardCash($this->playerNextStreakDay($playerId));
    }

    public function isPlayerStreakClaimedToday(string $playerId = 'founder-player'): bool
    {
        return $this->playerLastLoginDay($playerId) === gmdate('Y-m-d');
    }

    /** @return list<int> */
    public function dailyStreakNerveRefillDays(): array
    {
        $days = [];
        foreach ($this->dailyStreakSchedule() as $day => $row) {
            if (!empty($row[1])) {
                $days[] = (int) $day;
            }
        }
        return $days;
    }

    /** @return list<int> */
    public function dailyStreakEnergyRefillDays(): array
    {
        $days = [];
        foreach ($this->dailyStreakSchedule() as $day => $row) {
            if (!empty($row[2])) {
                $days[] = (int) $day;
            }
        }
        return $days;
    }

    public function dailyStreakNerveRefillDayCount(): int
    {
        return count($this->dailyStreakNerveRefillDays());
    }

    public function dailyStreakEnergyRefillDayCount(): int
    {
        return count($this->dailyStreakEnergyRefillDays());
    }

    public function isFullRefillDailyStreakDay(int $day): bool
    {
        return $this->dailyStreakDayRefillsNerve($day) && $this->dailyStreakDayRefillsEnergy($day);
    }

    public function levelingXpCoefficient(): int
    {
        return LevelingService::XP_COEFFICIENT;
    }

    public function levelingNervePerLevel(): int
    {
        return LevelingService::NERVE_PER_LEVEL;
    }

    public function levelingEnergyPerLevel(): int
    {
        return LevelingService::ENERGY_PER_LEVEL;
    }

    public function levelingCashPerLevel(): int
    {
        return LevelingService::CASH_PER_LEVEL;
    }

    public function levelUpCashBonusForLevel(int $level): int
    {
        return max(0, $level) * LevelingService::CASH_PER_LEVEL;
    }

    public function levelUpTotalCashBonusBetweenLevels(int $fromLevel, int $toLevel): int
    {
        if ($toLevel <= $fromLevel) {
            return 0;
        }
        $total = 0;
        for ($l = max(1, $fromLevel) + 1; $l <= $toLevel; $l++) {
            $total += $this->levelUpCashBonusForLevel($l);
        }
        return $total;
    }

    public function levelUpNerveGrantBetweenLevels(int $fromLevel, int $toLevel): int
    {
        return max(0, $toLevel - max(1, $fromLevel)) * LevelingService::NERVE_PER_LEVEL;
    }

    public function levelUpEnergyGrantBetweenLevels(int $fromLevel, int $toLevel): int
    {
        return max(0, $toLevel - max(1, $fromLevel)) * LevelingService::ENERGY_PER_LEVEL;
    }

    public function playerLevelFloorProgressPct(string $playerId = 'founder-player'): float
    {
        $level = $this->playerLevel($playerId);
        $floorXp = $this->xpForLevel($level);
        $nextXp = $this->xpForLevel($level + 1);
        $span = max(1, $nextXp - $floorXp);
        $progress = max(0, $this->playerXp($playerId) - $floorXp);
        return min(100.0, round(($progress / $span) * 100.0, 2));
    }

    public function isPlayerAtOrAboveLevel(int $targetLevel, string $playerId = 'founder-player'): bool
    {
        return $this->playerLevel($playerId) >= $targetLevel;
    }

    public function isRateLimiterEnabled(string $playerId = 'founder-player'): bool
    {
        return (bool) ($this->rateLimitStatus($playerId)['enabled'] ?? false);
    }

    public function rateLimitMaxHits(string $playerId = 'founder-player'): int
    {
        return (int) ($this->rateLimitStatus($playerId)['max'] ?? 120);
    }

    public function rateLimitWindowSeconds(string $playerId = 'founder-player'): int
    {
        return (int) ($this->rateLimitStatus($playerId)['windowSeconds'] ?? 10);
    }

    public function rateLimitCurrentCount(string $playerId = 'founder-player'): int
    {
        return (int) ($this->rateLimitStatus($playerId)['count'] ?? 0);
    }

    public function resourceRegenIntervalForBar(string $bar): int
    {
        return (int) ($this->resourceRegenIntervals()[$bar] ?? 0);
    }

    /** @return list<string> */
    public function supportedRegenBars(): array
    {
        return array_keys($this->resourceRegenIntervals());
    }

    public function isSupportedRegenBar(string $bar): bool
    {
        return array_key_exists($bar, $this->resourceRegenIntervals());
    }

    public function totalRegenIntervalsSeconds(): int
    {
        return array_sum($this->resourceRegenIntervals());
    }

    public function maxRegenIntervalSeconds(): int
    {
        return max($this->resourceRegenIntervals());
    }

    public function minRegenIntervalSeconds(): int
    {
        return min($this->resourceRegenIntervals());
    }

    public function combatVersion(string $playerId = 'founder-player'): int
    {
        return (int) ((new CombatService($this->database, $this->events))->snapshot($playerId)['version'] ?? 1);
    }

    /** @return list<string> */
    public function supportedCombatActions(): array
    {
        return ['start', 'strike', 'finish'];
    }

    public function isSupportedCombatAction(string $action): bool
    {
        return in_array($action, $this->supportedCombatActions(), true);
    }

    /** @return list<string> */
    public function supportedCombatFinishes(): array
    {
        return ['mug', 'hosp', 'leave'];
    }

    public function isSupportedCombatFinish(string $approach): bool
    {
        return in_array($approach, $this->supportedCombatFinishes(), true);
    }

    public function playerCombatVersion(string $playerId = 'founder-player'): int
    {
        return (int) ((new PlayerCombatService($this->database, $this->events))->snapshot($playerId)['version'] ?? 1);
    }

    public function hasActivePlayerCombat(string $playerId = 'founder-player'): bool
    {
        return ((new PlayerCombatService($this->database, $this->events))->snapshot($playerId)['encounter'] ?? null) !== null;
    }

    public function hasIncomingPlayerCombat(string $playerId = 'founder-player'): bool
    {
        return ((new PlayerCombatService($this->database, $this->events))->snapshot($playerId)['incoming'] ?? null) !== null;
    }

    public function playerCombatEnergyCost(string $playerId = 'founder-player'): int
    {
        return (int) ((new PlayerCombatService($this->database, $this->events))->opponents($playerId)['energyCost'] ?? 25);
    }

    public function totalPlayerCombatOpponentCount(string $playerId = 'founder-player'): int
    {
        return count((array) ((new PlayerCombatService($this->database, $this->events))->opponents($playerId)['players'] ?? []));
    }

    /** @return list<string> */
    public function supportedPlayerMarketActions(): array
    {
        return ['list', 'buy', 'cancel'];
    }

    public function isSupportedPlayerMarketAction(string $action): bool
    {
        return in_array($action, $this->supportedPlayerMarketActions(), true);
    }

    public function playerMarketMaxActiveListings(): int
    {
        return 50;
    }

    public function playerMarketMaxUnitPrice(): int
    {
        return 1000000;
    }

    public function playerMarketInventoryVersion(string $playerId = 'founder-player'): int
    {
        return (int) ((new PlayerMarketService($this->database, $this->events))->snapshot($playerId)['inventoryVersion'] ?? 1);
    }

    /** @return list<string> */
    public function supportedFamilyOperationActions(): array
    {
        return ['create', 'join', 'leave', 'start', 'cancel', 'resolve'];
    }

    public function isSupportedFamilyOperationAction(string $action): bool
    {
        return in_array($action, $this->supportedFamilyOperationActions(), true);
    }

    /** @return list<string> */
    public function familyOperationIds(): array
    {
        return ['dock-intercept', 'warehouse-heist'];
    }

    public function isKnownFamilyOperationId(string $id): bool
    {
        return in_array($id, $this->familyOperationIds(), true);
    }

    public function familyCompetitionPointsForKind(string $kind): int
    {
        return match ($kind) {
            'player-hospitalize' => 10,
            'territory-assault' => 1,
            'operation' => 5,
            default => 0,
        };
    }

    /** @return list<string> */
    public function progressionOnboardingMissionSequence(): array
    {
        return ['c5', 't4', 's2', 'b1', 'w1'];
    }

    public function progressionOnboardingMissionCount(): int
    {
        return count($this->progressionOnboardingMissionSequence());
    }

    /** @return list<string> */
    public function supportedProgressionMetricIds(): array
    {
        return ['crimes', 'trains', 'wins', 'shifts', 'buys'];
    }

    public function isSupportedProgressionMetricId(string $metric): bool
    {
        return in_array($metric, $this->supportedProgressionMetricIds(), true);
    }

    public function progressionMaxEscrowDelta(): int
    {
        return 1000;
    }

    /** @return list<string> */
    public function supportedProgressionPenaltyTypes(): array
    {
        return ['jail', 'hosp'];
    }

    public function isSupportedProgressionPenaltyType(string $type): bool
    {
        return in_array($type, $this->supportedProgressionPenaltyTypes(), true);
    }

    public function progressionMaxPenaltySeconds(): int
    {
        return 86400;
    }

    public function progressionCombatChainWindowMs(): int
    {
        return 300000;
    }

    /** @return list<int> */
    public function progressionCombatChainMilestones(): array
    {
        return [10, 25, 50, 100, 250, 500];
    }

    /** @return list<string> */
    public function supportedTerritoryBenefitKeys(): array
    {
        return ['crime_bonus', 'gym_bonus', 'travel_discount', 'market_discount', 'medical_discount', 'defense'];
    }

    public function isSupportedTerritoryBenefitKey(string $key): bool
    {
        return in_array($key, $this->supportedTerritoryBenefitKeys(), true);
    }

    public function territoryWarDurationSeconds(): int
    {
        return 259200;
    }

    public function territoryFootholdSector(): int
    {
        return 7;
    }

    public function territoryReinforceControlGainBasisPoints(): int
    {
        return 1500;
    }

    public function assetLibraryMaxUploadBytes(): int
    {
        return AssetLibrary::MAX_UPLOAD_BYTES;
    }

    public function assetLibraryChunkBytes(): int
    {
        return AssetLibrary::CHUNK_BYTES;
    }

    /** @return list<string> */
    public function supportedAssetTransformKeys(): array
    {
        return ['scale', 'rotation', 'floorOffset', 'cameraTarget'];
    }

    public function isSupportedAssetTransformKey(string $key): bool
    {
        return in_array($key, $this->supportedAssetTransformKeys(), true);
    }

    public function assetWorkerMaxBatchLimit(): int
    {
        return 8;
    }

    public function assetUploadExpirationSeconds(): int
    {
        return 86400;
    }

    public function assetInspectionMaxAttempts(): int
    {
        return 3;
    }

    public function assetInspectionLeaseSeconds(): int
    {
        return 90;
    }

    public function assetWorkerHealthyWindowSeconds(): int
    {
        return 100;
    }

    public function assetMaxPendingUploadsPerActor(): int
    {
        return 10;
    }

    public function releaseManagerChannel(): string
    {
        return 'production';
    }

    public function releaseManagerSchemaVersion(): int
    {
        return 1;
    }

    public function releaseTextMaxByteLength(): int
    {
        return 12000;
    }

    public function releaseTextMaxCharLength(): int
    {
        return 4000;
    }

    public function releaseDefaultBrandingAccentColor(): string
    {
        return '#a3d900';
    }

    public function dailyStreakCycleTotalCash(): int
    {
        return 32500;
    }

    public function dailyStreakCashAmountForDay(int $day): int
    {
        return match ($day) {
            1 => 1000,
            2 => 1500,
            3 => 2500,
            4 => 3500,
            5 => 5000,
            6 => 7000,
            7 => 12000,
            default => 0,
        };
    }

    public function dailyStreakRefillsNerveForDay(int $day): bool
    {
        return in_array($day, [3, 7], true);
    }

    public function dailyStreakRefillsEnergyForDay(int $day): bool
    {
        return in_array($day, [5, 7], true);
    }

    public function dailyContractXpGrantAmount(): int
    {
        return 200;
    }

    public function levelingXpCoefficientValue(): int
    {
        return 50;
    }

    public function levelingNerveGrantPerLevel(): int
    {
        return 1;
    }

    public function levelingEnergyGrantPerLevel(): int
    {
        return 3;
    }

    public function levelingCashBonusPerLevelMultiplier(): int
    {
        return 250;
    }

    public function resourceRegenTickSecondsForBar(string $bar): int
    {
        return ResourceService::regenIntervalsSeconds()[$bar] ?? 0;
    }

    public function defaultCooldownActionSeconds(string $action): int
    {
        return self::COOLDOWN_DEFAULTS[$action] ?? 0;
    }

    /** @return list<string> */
    public function supportedDefaultCooldownActions(): array
    {
        return array_keys(self::COOLDOWN_DEFAULTS);
    }

    public function isSupportedDefaultCooldownAction(string $action): bool
    {
        return array_key_exists($action, self::COOLDOWN_DEFAULTS);
    }

    public function notificationMaxUnreadQueryLimit(): int
    {
        return 100;
    }

    public function ledgerMaxRecentEntriesLimit(): int
    {
        return 50;
    }

    public function combatNpcEncounterEnergyCost(): int
    {
        return 25;
    }

    public function combatNpcStalemateTurnLimit(): int
    {
        return 25;
    }

    public function combatNpcLostHospitalPenaltySeconds(): int
    {
        return 10;
    }

    public function combatNpcMaxTerritoryDefenseBonusBasisPoints(): int
    {
        return 2000;
    }

    public function combatNpcWinXpMultiplierPerLevel(): int
    {
        return 3;
    }

    public function playerCombatMaxRoundsLimit(): int
    {
        return 25;
    }

    public function playerCombatReservationSeconds(): int
    {
        return 900;
    }

    public function playerCombatOpponentQueryLimit(): int
    {
        return 200;
    }

    public function defaultActionRateLimitMax(): int
    {
        return 120;
    }

    public function defaultActionRateLimitWindowSeconds(): int
    {
        return 10;
    }

    public function worldDefaultTickSeconds(): int
    {
        return 60;
    }

    public function worldDefaultFindLifetimeSeconds(): int
    {
        return 900;
    }

    public function worldDefaultMaxActiveFinds(): int
    {
        return 24;
    }

    public function worldDefaultSupplyCap(): int
    {
        return 100;
    }

    public function worldDefaultEventEveryTicks(): int
    {
        return 5;
    }

    /** @return list<string> */
    public function worldSupportedFindLocationIds(): array
    {
        return ['market', 'gym', 'bank', 'hospital', 'jail', 'properties', 'crimes'];
    }

    public function isSupportedWorldFindLocationId(string $locationId): bool
    {
        return in_array($locationId, $this->worldSupportedFindLocationIds(), true);
    }

    public function worldMaterialItemMaxListCount(): int
    {
        return 32;
    }

    public function worldMaterialItemMaxIdLength(): int
    {
        return 80;
    }

    public function worldMaxMaterialIssuanceBudgetPerHour(): int
    {
        return 2_000_000_000;
    }

    /** @return list<string> */
    public function materialIssuanceSupportedSources(): array
    {
        return ['world', 'search'];
    }

    public function isSupportedMaterialIssuanceSource(string $source): bool
    {
        return in_array($source, $this->materialIssuanceSupportedSources(), true);
    }

    public function materialIssuanceMaxQuantity(): int
    {
        return 1000;
    }

    public function materialIssuanceMaxCorrelationIdLength(): int
    {
        return 100;
    }

    public function loadoutMaxArmorReductionCap(): float
    {
        return 0.95;
    }

    /** @return list<string> */
    public function crimeRuleDefaultKeys(): array
    {
        return [
            'required_item',
            'required_quantity',
            'consume_tool',
            'mastery_per_success',
            'chain_window_seconds',
            'chain_bonus_basis_points',
            'critical_failure_basis_points',
            'jail_seconds',
            'hospital_seconds',
        ];
    }

    public function isSupportedCrimeRuleKey(string $key): bool
    {
        return in_array($key, $this->crimeRuleDefaultKeys(), true);
    }

    public function crimeDefaultChainWindowSeconds(): int
    {
        return 300;
    }

    public function adminAuditLogMaxLimit(): int
    {
        return 250;
    }

    public function publishedRulesDisabledModuleCount(): int
    {
        return count((new PublishedRules($this->database))->disabledModuleIds());
    }

    /** @return list<string> */
    public function requiredThemeManifestFields(): array
    {
        return ['id', 'name', 'version', 'stylesheet'];
    }

    /** @return list<string> */
    public function requiredModuleManifestFields(): array
    {
        return ['id', 'name', 'version', 'class'];
    }

    public function themeDefaultPreviewHexColor(): string
    {
        return '#d7ff3f';
    }

    public function activeThemeByteLength(): int
    {
        return strlen($this->themes->activeStylesheet());
    }

    public function moduleVersionHistoryRowCount(): int
    {
        $row = $this->database->fetchOne('SELECT COUNT(*) AS total FROM module_version_history');
        return max(0, (int) ($row['total'] ?? 0));
    }

    public function eventBusMaxRecentLimit(): int
    {
        return 50;
    }

    public function eventBusDefaultRecentLimit(): int
    {
        return 10;
    }

    public function databaseSqliteBusyTimeoutMs(): int
    {
        return 5000;
    }

    public function databasePostgresDefaultPort(): int
    {
        return 5432;
    }

    public function databasePostgresConnectTimeoutSeconds(): int
    {
        return 10;
    }

    public function cacheDefaultTtlSeconds(): int
    {
        return 300;
    }

    public function cacheMinTtlSeconds(): int
    {
        return 1;
    }

    public function redisDefaultPort(): int
    {
        return 6379;
    }

    public function redisConnectTimeoutSeconds(): float
    {
        return 2.5;
    }

    /** @return list<string> */
    public function supportedCacheAdapterNames(): array
    {
        return ['memory', 'redis'];
    }

    public function gatewayKeyMinimumByteLength(): int
    {
        return 32;
    }

    public function draftFingerprintHexByteLength(): int
    {
        return 64;
    }

    public function routerMaxPathDecodePasses(): int
    {
        return 5;
    }

    public function databaseTableCount(): int
    {
        return $this->database->tableCount();
    }

    public function databaseInTransaction(): bool
    {
        return (bool) ($this->database->health()['inTransaction'] ?? false);
    }

    public function adminSessionLifetimeSeconds(): int
    {
        return 43200;
    }

    public function browserSessionCreationWindowSeconds(): int
    {
        return 3600;
    }

    public function browserSessionStartingGrantCash(): int
    {
        return 2500;
    }

    public function browserSessionStartingHappy(): int
    {
        return 100;
    }

    public function browserSessionMaxCreationPerHour(): int
    {
        return 10;
    }

    public function playerAccountMinPasswordCharacters(): int
    {
        return 15;
    }

    public function playerAccountMaxPasswordCharacters(): int
    {
        return 128;
    }

    public function playerAccountMaxPasswordBytes(): int
    {
        return 1024;
    }

    public function playerAccountAuthRateLimitWindowSeconds(): int
    {
        return 900;
    }

    public function defaultDemoPlayerId(): string
    {
        return 'founder-player';
    }

    public function defaultCooldownConfigMap(): array
    {
        return self::COOLDOWN_DEFAULTS;
    }

    public function defaultCooldownActionCount(): int
    {
        return count(self::COOLDOWN_DEFAULTS);
    }

    public function isConfiguredCooldownAction(string $action): bool
    {
        return isset($this->cooldownSeconds[$action]);
    }

    public function configuredCooldownSecondsForAction(string $action): int
    {
        return $this->cooldownSeconds[$action] ?? 0;
    }

    public function attackBaseEnergyCost(): int
    {
        return 25;
    }

    public function attackNpcBaseDefense(): int
    {
        return 150;
    }

    public function attackNpcDefensePerLevel(): int
    {
        return 45;
    }

    public function attackMinWinChanceBasisPoints(): int
    {
        return 500;
    }

    public function attackMaxWinChanceBasisPoints(): int
    {
        return 10000;
    }

    public function ledgerQueryMaxLimit(): int
    {
        return 100;
    }

    public function attackWinCashMinBase(): int
    {
        return 300;
    }

    public function attackWinCashMinPerLevel(): int
    {
        return 40;
    }

    public function attackWinCashMaxBase(): int
    {
        return 800;
    }

    public function attackWinCashMaxPerLevel(): int
    {
        return 90;
    }

    public function eventLogQueryMaxLimit(): int
    {
        return 100;
    }
}
