<?php

declare(strict_types=1);

namespace Zone\Engine\Application;

use RuntimeException;
use Zone\Engine\Core\Contracts\CacheStore;
use Zone\Engine\Core\Content\ContentManager;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CooldownService;
use Zone\Engine\Core\Game\DailyService;
use Zone\Engine\Core\Game\LevelingService;
use Zone\Engine\Core\Game\NotificationService;
use Zone\Engine\Core\Game\RateLimiter;
use Zone\Engine\Core\Game\ResourceService;
use Zone\Engine\Core\Modules\ModuleRegistry;
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\ReleaseManager;
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
     * Pre-flight guard for every state-changing gameplay action: enforce the
     * per-player rate limit first, then the per-action server-clock cooldown.
     * Runs after the module-enabled check and any input validation, before any
     * mutation. Throws RateLimitException / CooldownException (both -> HTTP 429).
     */
    private function guardAction(string $playerId, string $action): void
    {
        $this->rateLimiter->hit($playerId);
        $this->cooldowns->assertReady($playerId, $action);
    }

    private function armCooldown(string $playerId, string $action): void
    {
        $this->cooldowns->arm($playerId, $action, $this->cooldownSeconds[$action] ?? 0);
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

    public function saveReleaseDraft(array $manifest, string $actor): array
    {
        return $this->releases->saveDraft($manifest, $actor);
    }

    public function publishRelease(string $actor): array
    {
        $draft = $this->releases->draft();
        $draft['manifest']['content'] = $this->runtimeContent();
        $this->releases->saveDraft($draft['manifest'], $actor);
        return $this->releases->publish($actor);
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
            $content = $this->runtimeContent();
        }

        return [
            'release' => $release,
            'content' => $content,
        ];
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
        $this->guardAction($playerId, 'crime');
        $streak = $this->daily->registerLogin($playerId, bin2hex(random_bytes(16)));

        return $this->database->transaction(function () use ($crimeId, $playerId, $streak): array {
            $crime = $this->database->fetchOne('SELECT * FROM crimes WHERE id = :id AND enabled = 1', ['id' => $crimeId]);
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
            $nerveCost = (int) $crime['nerve_cost'];
            if ((int) $player['nerve'] < $nerveCost) {
                throw new RuntimeException('Not enough nerve for this crime.');
            }

            $correlationId = bin2hex(random_bytes(16));
            $roll = random_int(1, 10000);
            $territoryBonusBp = min(1500, $this->territories->bonusBasisPoints($playerId, 'crime_bonus'));
            $successThreshold = min(10000, (int) $crime['success_basis_points'] + $territoryBonusBp);
            $success = $roll <= $successThreshold;
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
            $levelUp = $this->leveling->sync($playerId, $correlationId);
            $this->armCooldown($playerId, 'crime');
            $this->daily->recordProgress($playerId, 'crimes', 1);

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
                'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);

            return [
                'success' => $success,
                'crime' => ['id' => $crimeId, 'name_en' => $crime['name_en'], 'name_ar' => $crime['name_ar']],
                'cost' => ['nerve' => $nerveCost],
                'reward' => ['cash' => $cashReward, 'xp' => $xpReward],
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
        if (!$this->modules->isEnabled($id)) {
            throw new RuntimeException("Module {$id} is disabled. Re-enable it from the module manager.");
        }
    }

    private const GYM_STATS = ['strength', 'defense', 'speed', 'dexterity'];

    public function trainGym(string $stat, int $sessions = 1, string $playerId = 'founder-player'): array
    {
        $this->requireModule('stats');
        if (!in_array($stat, self::GYM_STATS, true)) {
            throw new RuntimeException('Unknown gym stat: ' . $stat);
        }
        $sessions = max(1, min(10, $sessions));
        $this->resources->regenerate($playerId);
        $this->guardAction($playerId, 'gym');
        $streak = $this->daily->registerLogin($playerId, bin2hex(random_bytes(16)));
        return $this->database->transaction(function () use ($stat, $sessions, $playerId, $streak): array {
            $player = $this->requirePlayer($playerId);
            $energyCost = 10 * $sessions;
            if ((int) $player['energy'] < $energyCost) {
                throw new RuntimeException('Not enough energy to train.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $happy = (int) $player['happy'];
            $gainPerSession = max(1, (int) floor(5 + $happy / 250));
            $baseGain = 0;
            for ($i = 0; $i < $sessions; $i++) {
                $baseGain += $gainPerSession + random_int(0, 3);
            }
            $territoryBonusBp = min(2000, $this->territories->bonusBasisPoints($playerId, 'gym_bonus'));
            $gain = max(1, (int) round($baseGain * (10000 + $territoryBonusBp) / 10000));
            $newStat = (int) $player[$stat] + $gain;
            $newEnergy = (int) $player['energy'] - $energyCost;
            $newXp = (int) $player['xp'] + $gain;
            $this->database->execute(
                "UPDATE players SET {$stat} = :stat, energy = :energy, xp = :xp, resources_updated_at = :updated WHERE id = :id",
                ['id' => $playerId, 'stat' => $newStat, 'energy' => $newEnergy, 'xp' => $newXp, 'updated' => gmdate('c')],
            );
            $levelUp = $this->leveling->sync($playerId, $correlationId);
            $this->armCooldown($playerId, 'gym');
            $this->daily->recordProgress($playerId, 'stat_gain', $gain);
            $event = new DomainEvent('GymTrained', [
                'playerId' => $playerId, 'stat' => $stat, 'gain' => $gain,
                'baseGain' => $baseGain, 'territoryBonusBasisPoints' => $territoryBonusBp,
                'sessions' => $sessions, 'energySpent' => $energyCost, 'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);
            return [
                'trained' => $stat, 'gain' => $gain, 'baseGain' => $baseGain, 'territoryBonusBasisPoints' => $territoryBonusBp, 'sessions' => $sessions,
                'cost' => ['energy' => $energyCost],
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
        $this->guardAction($playerId, 'bank');
        return $this->database->transaction(function () use ($direction, $amount, $playerId): array {
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
                'serverProof' => ['eventId' => $event->id, 'correlationId' => $correlationId, 'calculatedBy' => 'PHP ' . PHP_VERSION],
                'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            ];
        });
    }

    public function hospitalHeal(string $playerId = 'founder-player'): array
    {
        $this->requireModule('hospital');
        $this->resources->regenerate($playerId);
        $this->guardAction($playerId, 'hospital');
        return $this->database->transaction(function () use ($playerId): array {
            $player = $this->requirePlayer($playerId);
            $missing = (int) $player['max_life'] - (int) $player['life'];
            if ($missing <= 0) {
                throw new RuntimeException('You are already at full life.');
            }
            $cost = $missing * 3;
            if ((int) $player['cash'] < $cost) {
                throw new RuntimeException('Not enough cash to pay for treatment.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $newCash = (int) $player['cash'] - $cost;
            $this->database->execute(
                'UPDATE players SET cash = :cash, life = :life, resources_updated_at = :updated WHERE id = :id',
                ['id' => $playerId, 'cash' => $newCash, 'life' => (int) $player['max_life'], 'updated' => gmdate('c')],
            );
            $this->ledger->record($playerId, 'cash', -$cost, $newCash, 'hospital.heal', $correlationId);
            $this->armCooldown($playerId, 'hospital');
            $event = new DomainEvent('HospitalHealed', ['playerId' => $playerId, 'restored' => $missing, 'cost' => $cost, 'correlationId' => $correlationId]);
            $this->events->publish($event);
            return [
                'restored' => $missing, 'cost' => ['cash' => $cost],
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

    public function travel(string $city, string $playerId = 'founder-player'): array
    {
        $this->requireModule('travel');
        if (!in_array($city, self::CITIES, true)) {
            throw new RuntimeException('Unknown destination: ' . $city);
        }
        $this->guardAction($playerId, 'travel');
        return $this->database->transaction(function () use ($city, $playerId): array {
            $player = $this->requirePlayer($playerId);
            if ($player['city'] === $city) {
                throw new RuntimeException('You are already in ' . $city . '.');
            }
            $territoryBonusBp = min(5000, $this->territories->bonusBasisPoints($playerId, 'travel_discount'));
            $fare = 2500;
            $travelSeconds = max(60, (int) round(1800 * (10000 - $territoryBonusBp) / 10000));
            if ((int) $player['cash'] < $fare) {
                throw new RuntimeException('Not enough cash for the fare.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $newCash = (int) $player['cash'] - $fare;
            $this->database->execute(
                'UPDATE players SET cash = :cash, city = :city WHERE id = :id',
                ['id' => $playerId, 'cash' => $newCash, 'city' => $city],
            );
            $this->ledger->record($playerId, 'cash', -$fare, $newCash, 'travel.fare', $correlationId);
            $this->armCooldown($playerId, 'travel');
            $event = new DomainEvent('PlayerTraveled', ['playerId' => $playerId, 'city' => $city, 'fare' => $fare, 'travelSeconds' => $travelSeconds, 'territoryBonusBasisPoints' => $territoryBonusBp, 'correlationId' => $correlationId]);
            $this->events->publish($event);
            return [
                'city' => $city, 'fare' => $fare, 'travelSeconds' => $travelSeconds, 'territoryBonusBasisPoints' => $territoryBonusBp,
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
        $this->guardAction($playerId, 'blackjack');
        return $this->database->transaction(function () use ($bet, $playerId): array {
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
                'playerHand' => $playerHand, 'dealerHand' => $dealerHand, 'delta' => $delta,
                'serverProof' => ['eventId' => $event->id, 'correlationId' => $correlationId, 'calculatedBy' => 'PHP ' . PHP_VERSION],
                'player' => $this->resources->normalize($this->requirePlayer($playerId)),
            ];
        });
    }

    public function workShift(string $playerId = 'founder-player'): array
    {
        $this->resources->regenerate($playerId);
        $this->guardAction($playerId, 'job');
        $streak = $this->daily->registerLogin($playerId, bin2hex(random_bytes(16)));
        return $this->database->transaction(function () use ($playerId, $streak): array {
            $player = $this->requirePlayer($playerId);
            $energyCost = 20;
            if ((int) $player['energy'] < $energyCost) {
                throw new RuntimeException('Not enough energy to work a shift.');
            }
            $correlationId = bin2hex(random_bytes(16));
            $level = (int) $player['level'];
            $wage = 200 + $level * 60 + random_int(0, 40 + $level * 10);
            $xpReward = 5 + $level;
            $newCash = (int) $player['cash'] + $wage;
            $newXp = (int) $player['xp'] + $xpReward;
            $newEnergy = (int) $player['energy'] - $energyCost;
            $this->database->execute(
                'UPDATE players SET cash = :cash, xp = :xp, energy = :energy, resources_updated_at = :updated WHERE id = :id',
                ['id' => $playerId, 'cash' => $newCash, 'xp' => $newXp, 'energy' => $newEnergy, 'updated' => gmdate('c')],
            );
            $this->ledger->record($playerId, 'cash', $wage, $newCash, 'job.wage', $correlationId);
            $levelUp = $this->leveling->sync($playerId, $correlationId);
            $this->armCooldown($playerId, 'job');
            $this->daily->recordProgress($playerId, 'job_cash', $wage);
            $event = new DomainEvent('JobShiftWorked', [
                'playerId' => $playerId, 'level' => $level, 'wage' => $wage,
                'xpReward' => $xpReward, 'energySpent' => $energyCost, 'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);
            return [
                'shift' => 'worked', 'reward' => ['cash' => $wage, 'xp' => $xpReward], 'cost' => ['energy' => $energyCost],
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
        $this->resources->regenerate($playerId);
        $this->guardAction($playerId, 'attack');
        $streak = $this->daily->registerLogin($playerId, bin2hex(random_bytes(16)));
        return $this->database->transaction(function () use ($playerId, $streak): array {
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
                'UPDATE players SET cash = :cash, xp = :xp, energy = :energy, resources_updated_at = :updated WHERE id = :id',
                ['id' => $playerId, 'cash' => $newCash, 'xp' => $newXp, 'energy' => $newEnergy, 'updated' => gmdate('c')],
            );
            if ($cashReward > 0) {
                $this->ledger->record($playerId, 'cash', $cashReward, $newCash, 'attack.mug', $correlationId);
            }
            $levelUp = $this->leveling->sync($playerId, $correlationId);
            $this->armCooldown($playerId, 'attack');
            if ($win) {
                $this->daily->recordProgress($playerId, 'attack_wins', 1);
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
        $this->guardAction($playerId, 'territory');
        $result = $this->territories->act($territoryId, $action, $expectedVersion, $playerId);
        $this->armCooldown($playerId, 'territory');
        return $result;
    }

    public function adminTerritories(string $playerId = 'founder-player'): array
    {
        $this->requireModule('territories');
        return $this->territories->adminCatalog($playerId);
    }

    public function setTerritoryOwnership(string $territoryId, ?string $factionId, string $actor): array
    {
        $this->requireModule('territories');
        return $this->territories->setOwnership($territoryId, $factionId, $actor);
    }

    private function runtimeContent(): array
    {
        $themes = $this->themes->all();
        return [
            'crimes' => $this->content->crimes(true),
            'engineModules' => $this->modules->all(),
            'themes' => $themes,
            'activeTheme' => array_values(array_filter($themes, static fn (array $theme): bool => $theme['active']))[0]['id'] ?? null,
            'territoryDefinitions' => $this->territories->snapshot('founder-player'),
            'capturedAt' => gmdate('c'),
        ];
    }
}
