<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Closure;
use InvalidArgumentException;
use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Daily & weekly return hooks (Retention Spec 3.3 + v149 Expansion):
 * - 7-day login streak (idempotent per UTC day)
 * - Primary 4-contract rotating daily pool (preserved for full backward compatibility)
 * - Expanded 6-contract Syndicate Bonus Daily rotation (across market/shifts/activities/trades)
 * - 4 Weekly Milestone Contracts per ISO week awarding Cash + XP + Mission Credits
 */
final readonly class DailyService
{
    /**
     * 7-day login streak schedule. [cash, refill nerve?, refill energy?].
     * Day 7 loops back to Day 1 on the next day (Retention Spec 3.3).
     */
    private const STREAK_SCHEDULE = [
        1 => [1000, false, false],
        2 => [1500, false, false],
        3 => [2500, true, false],
        4 => [3500, false, false],
        5 => [5000, false, true],
        6 => [7000, false, false],
        7 => [12000, true, true],
    ];

    /**
     * Core rotating daily-contract pool. One is active per UTC day, chosen by the
     * epoch day index, so play is forced across every core system over a week.
     * Reward is 3,000-6,000 cash + 200 xp (Retention Spec 3.3).
     */
    private const CONTRACT_POOL = [
        ['id' => 'crime-spree', 'metric' => 'crimes', 'target' => 15, 'reward_cash' => 4000, 'reward_xp' => 200, 'name_en' => 'Commit 15 crimes', 'name_ar' => 'نفّذ 15 جريمة'],
        ['id' => 'gym-grind', 'metric' => 'stat_gain', 'target' => 40, 'reward_cash' => 3000, 'reward_xp' => 200, 'name_en' => 'Train 40 stat points', 'name_ar' => 'درّب 40 نقطة إحصائية'],
        ['id' => 'honest-work', 'metric' => 'job_cash', 'target' => 6000, 'reward_cash' => 5000, 'reward_xp' => 200, 'name_en' => 'Earn 6,000 from jobs', 'name_ar' => 'اكسب 6,000 من الوظائف'],
        ['id' => 'street-brawler', 'metric' => 'attack_wins', 'target' => 3, 'reward_cash' => 6000, 'reward_xp' => 200, 'name_en' => 'Win 3 attacks', 'name_ar' => 'افُز بـ3 هجمات'],
    ];

    /**
     * Expanded v149 rotating Syndicate Bonus Daily contracts across city activities,
     * bazaar/market commerce, hunting, street racing, and company shifts.
     */
    private const BONUS_CONTRACT_POOL = [
        ['id' => 'syndicate-procurement', 'metric' => 'buys', 'target' => 3, 'reward_cash' => 8500, 'reward_xp' => 250, 'reward_credits' => 10, 'name_en' => 'Purchase 3 items from shops or bazaars', 'name_ar' => 'اشترِ 3 عناصر من المتاجر أو البازارات'],
        ['id' => 'corporate-overtime', 'metric' => 'shifts', 'target' => 3, 'reward_cash' => 10000, 'reward_xp' => 280, 'reward_credits' => 12, 'name_en' => 'Complete 3 job or company work shifts', 'name_ar' => 'أنجز 3 ورديات عمل أو شركات'],
        ['id' => 'asphalt-contender', 'metric' => 'races', 'target' => 2, 'reward_cash' => 12000, 'reward_xp' => 300, 'reward_credits' => 15, 'name_en' => 'Compete in 2 street races at the Raceway', 'name_ar' => 'شارك في سباقَي شوارع في الحلبة'],
        ['id' => 'safari-tracker', 'metric' => 'hunts', 'target' => 2, 'reward_cash' => 11000, 'reward_xp' => 280, 'reward_credits' => 12, 'name_en' => 'Complete 2 Harbor or Safari hunting runs', 'name_ar' => 'أكمل رحلتَي صيد في المرفأ أو السفاري'],
        ['id' => 'dump-scavenger', 'metric' => 'dump_searches', 'target' => 3, 'reward_cash' => 7500, 'reward_xp' => 220, 'reward_credits' => 10, 'name_en' => 'Scavenge 3 finds in the City Dump', 'name_ar' => 'ابحث 3 مرات في مكب المدينة'],
        ['id' => 'escrow-broker', 'metric' => 'trades', 'target' => 1, 'reward_cash' => 14000, 'reward_xp' => 320, 'reward_credits' => 15, 'name_en' => 'Settle 1 safe player trade or bazaar deal', 'name_ar' => 'أتمم صفقة تبادل آمنة أو بيع بازار'],
    ];

    /**
     * Weekly Milestone Contracts active across each ISO week (Monday 00:00 UTC reset).
     */
    private const WEEKLY_MILESTONES = [
        ['id' => 'weekly-crime-lord', 'slot' => 1, 'metric' => 'crimes', 'target' => 75, 'reward_cash' => 35000, 'reward_xp' => 750, 'reward_credits' => 25, 'name_en' => 'Commit 75 street crimes this week', 'name_ar' => 'نفّذ 75 جريمة خلال هذا الأسبوع'],
        ['id' => 'weekly-iron-titan', 'slot' => 2, 'metric' => 'stat_gain', 'target' => 350, 'reward_cash' => 40000, 'reward_xp' => 850, 'reward_credits' => 30, 'name_en' => 'Gain 350 gym battle stats this week', 'name_ar' => 'اكسب 350 نقطة تدريب في النادي هذا الأسبوع'],
        ['id' => 'weekly-warhound', 'slot' => 3, 'metric' => 'attack_wins', 'target' => 15, 'reward_cash' => 55000, 'reward_xp' => 1000, 'reward_credits' => 40, 'name_en' => 'Win 15 combat encounters this week', 'name_ar' => 'افُز بـ15 مواجهة قتالية هذا الأسبوع'],
        ['id' => 'weekly-syndicate-earner', 'slot' => 4, 'metric' => 'job_cash', 'target' => 30000, 'reward_cash' => 45000, 'reward_xp' => 800, 'reward_credits' => 25, 'name_en' => 'Earn $30,000 from job or company shifts', 'name_ar' => 'اكسب 30,000$ من ورديات العمل أو الشركات'],
    ];

    public function __construct(
        private Database $database,
        private Ledger $ledger,
        private EventBus $events,
        private LevelingService $leveling,
        private ?Closure $clock = null,
    ) {
    }

    private function nowSeconds(): int
    {
        return $this->clock === null ? time() : (int) ($this->clock)();
    }

    private function today(): string
    {
        return gmdate('Y-m-d', $this->nowSeconds());
    }

    /** 8-char storage key (`B:YYMMDD`) fitting player_contract_progress.day VARCHAR(10). */
    private function bonusDayKey(): string
    {
        return 'B:' . gmdate('ymd', $this->nowSeconds());
    }

    public function currentIsoWeek(): string
    {
        return gmdate('o-\WW', $this->nowSeconds());
    }

    /** 7-char storage key (`WYYWW-S`) fitting player_contract_progress.day VARCHAR(10). */
    private function weeklySlotKey(int $slot): string
    {
        return sprintf('W%s-%d', gmdate('yW', $this->nowSeconds()), $slot);
    }

    // ------------------------------------------------------------------
    // Login streak
    // ------------------------------------------------------------------

    /**
     * Grant today's login-streak reward on the first call of a new UTC day.
     * Returns the streak block, or null when the player already claimed today.
     * Safe to call at the start of every gameplay action.
     */
    public function registerLogin(string $playerId, string $correlationId): ?array
    {
        return $this->database->playerTransaction($playerId, fn (): ?array => $this->registerLoginLocked($playerId, $correlationId));
    }

    private function registerLoginLocked(string $playerId, string $correlationId): ?array
    {
        $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($player === null) {
            return null;
        }
        $now = $this->nowSeconds();
        $today = gmdate('Y-m-d', $now);
        $lastDay = $player['last_login_day'] ?? null;
        if ($lastDay === $today) {
            return null;
        }

        $yesterday = gmdate('Y-m-d', $now - 86400);
        $prevStreak = (int) ($player['login_streak'] ?? 0);
        $streakDay = ($lastDay === $yesterday && $prevStreak >= 1)
            ? ($prevStreak % 7) + 1
            : 1;

        [$rewardCash, $refillNerve, $refillEnergy] = self::STREAK_SCHEDULE[$streakDay];
        $newCash = (int) $player['cash'] + $rewardCash;
        $nerveVal = $refillNerve ? (int) $player['max_nerve'] : (int) $player['nerve'];
        $energyVal = $refillEnergy ? (int) $player['max_energy'] : (int) $player['energy'];

        // Guarded update with distinct named parameters for PostgreSQL 16 strict PDO compatibility.
        $updated = $this->database->execute(
            'UPDATE players SET last_login_day = :today, login_streak = :streak, cash = :cash, nerve = :nerve, energy = :energy '
            . 'WHERE id = :id AND (last_login_day IS NULL OR last_login_day <> :today_guard)',
            [
                'today' => $today,
                'today_guard' => $today,
                'streak' => $streakDay,
                'cash' => $newCash,
                'nerve' => $nerveVal,
                'energy' => $energyVal,
                'id' => $playerId,
            ],
        );
        if ($updated === 0) {
            return null;
        }

        $this->ledger->record($playerId, 'cash', $rewardCash, $newCash, 'streak.reward', $correlationId);
        $event = new DomainEvent('LoginStreakClaimed', [
            'playerId' => $playerId,
            'streakDay' => $streakDay,
            'rewardCash' => $rewardCash,
            'nerveRefilled' => $refillNerve,
            'energyRefilled' => $refillEnergy,
            'correlationId' => $correlationId,
        ]);
        $this->events->publish($event);

        return [
            'streakDay' => $streakDay,
            'rewardCash' => $rewardCash,
            'nextDayRewardCash' => self::STREAK_SCHEDULE[($streakDay % 7) + 1][0],
            'nerveRefilled' => $refillNerve,
            'energyRefilled' => $refillEnergy,
        ];
    }

    // ------------------------------------------------------------------
    // Daily, Bonus & Weekly Milestone Contracts
    // ------------------------------------------------------------------

    /** The primary contract active for the current UTC day. */
    public function todayContract(): array
    {
        $index = intdiv($this->nowSeconds(), 86400) % count(self::CONTRACT_POOL);
        return [...self::CONTRACT_POOL[$index], 'day' => $this->today()];
    }

    /** The bonus Syndicate activity contract active for the current UTC day. */
    public function todayBonusContract(): array
    {
        $index = intdiv($this->nowSeconds(), 86400) % count(self::BONUS_CONTRACT_POOL);
        return [...self::BONUS_CONTRACT_POOL[$index], 'day' => $this->today()];
    }

    /**
     * Advance active daily, bonus daily, and weekly milestone contracts matching $metric.
     * Progress-only: never touches player balances, safe to call inside any action.
     */
    public function recordProgress(string $playerId, string $metric, int $amount): void
    {
        $this->database->playerTransaction($playerId, function () use ($playerId, $metric, $amount): void {
            $this->recordProgressLocked($playerId, $metric, $amount);
        });
    }

    private function recordProgressLocked(string $playerId, string $metric, int $amount): void
    {
        if ($amount <= 0) {
            return;
        }
        $contract = $this->todayContract();
        if ($contract['metric'] === $metric) {
            $this->incrementBucket($playerId, (string) $contract['day'], $amount);
        }

        $bonus = $this->todayBonusContract();
        if ($bonus['metric'] === $metric) {
            $this->incrementBucket($playerId, $this->bonusDayKey(), $amount);
        }

        foreach (self::WEEKLY_MILESTONES as $weekly) {
            if ($weekly['metric'] === $metric) {
                $this->incrementBucket($playerId, $this->weeklySlotKey((int) $weekly['slot']), $amount);
            }
        }
    }

    private function incrementBucket(string $playerId, string $bucketKey, int $amount): void
    {
        $updated = $this->database->execute(
            'UPDATE player_contract_progress SET progress = progress + :amount WHERE player_id = :player AND day = :day',
            ['amount' => $amount, 'player' => $playerId, 'day' => $bucketKey],
        );
        if ($updated === 0) {
            $this->database->insertIgnore(
                'player_contract_progress',
                ['player_id', 'day', 'progress', 'claimed'],
                [$playerId, $bucketKey, $amount, 0],
            );
        }
    }

    /** Today's contract with the player's progress, bonus contract, and weekly milestones. */
    public function contractState(string $playerId): array
    {
        $contract = $this->todayContract();
        $row = $this->database->fetchOne(
            'SELECT progress, claimed FROM player_contract_progress WHERE player_id = :player AND day = :day',
            ['player' => $playerId, 'day' => $contract['day']],
        );
        $progress = $row === null ? 0 : (int) $row['progress'];
        $claimed = $row !== null && (bool) $row['claimed'];
        $target = (int) $contract['target'];
        return [
            'contract' => $contract,
            'progress' => $progress,
            'target' => $target,
            'remaining' => max(0, $target - $progress),
            'progressPct' => (int) min(100, round($progress / max(1, $target) * 100)),
            'complete' => $progress >= $target,
            'claimed' => $claimed,
            'bonusContract' => $this->bonusContractState($playerId),
            'weeklyMilestones' => $this->weeklyState($playerId),
        ];
    }

    public function bonusContractState(string $playerId): array
    {
        $bonus = $this->todayBonusContract();
        $row = $this->database->fetchOne(
            'SELECT progress, claimed FROM player_contract_progress WHERE player_id = :player AND day = :day',
            ['player' => $playerId, 'day' => $this->bonusDayKey()],
        );
        $progress = $row === null ? 0 : (int) $row['progress'];
        $claimed = $row !== null && (bool) $row['claimed'];
        $target = (int) $bonus['target'];
        return [
            'contract' => $bonus,
            'progress' => $progress,
            'target' => $target,
            'remaining' => max(0, $target - $progress),
            'progressPct' => (int) min(100, round($progress / max(1, $target) * 100)),
            'complete' => $progress >= $target,
            'claimed' => $claimed,
        ];
    }

    /** @return array{week: string, contracts: list<array<string, mixed>>, completedCount: int, claimedCount: int} */
    public function weeklyState(string $playerId): array
    {
        $week = $this->currentIsoWeek();
        $contracts = [];
        $completedCount = 0;
        $claimedCount = 0;
        foreach (self::WEEKLY_MILESTONES as $def) {
            $slotKey = $this->weeklySlotKey((int) $def['slot']);
            $row = $this->database->fetchOne(
                'SELECT progress, claimed FROM player_contract_progress WHERE player_id = :player AND day = :day',
                ['player' => $playerId, 'day' => $slotKey],
            );
            $progress = $row === null ? 0 : (int) $row['progress'];
            $claimed = $row !== null && (bool) $row['claimed'];
            $target = (int) $def['target'];
            $complete = $progress >= $target;
            if ($complete) {
                $completedCount++;
            }
            if ($claimed) {
                $claimedCount++;
            }
            $contracts[] = [
                'id' => $def['id'],
                'week' => $week,
                'metric' => $def['metric'],
                'target' => $target,
                'progress' => $progress,
                'remaining' => max(0, $target - $progress),
                'progressPct' => (int) min(100, round($progress / max(1, $target) * 100)),
                'complete' => $complete,
                'claimed' => $claimed,
                'reward_cash' => (int) $def['reward_cash'],
                'reward_xp' => (int) $def['reward_xp'],
                'reward_credits' => (int) $def['reward_credits'],
                'name_en' => $def['name_en'],
                'name_ar' => $def['name_ar'],
            ];
        }
        return [
            'week' => $week,
            'contracts' => $contracts,
            'completedCount' => $completedCount,
            'claimedCount' => $claimedCount,
        ];
    }

    /**
     * Claim today's completed primary contract exactly once. Credits cash + xp, runs
     * level progression (the xp can cross a level threshold), and emits
     * DailyContractClaimed. Throws if incomplete or already claimed.
     */
    public function claimContract(string $playerId, string $correlationId): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $correlationId): array {
            $contract = $this->todayContract();
            $day = (string) $contract['day'];
            return $this->settleBucketClaim(
                $playerId,
                $day,
                $contract,
                'Daily contract',
                'contract.reward',
                'DailyContractClaimed',
                $correlationId,
            );
        });
    }

    /** Claim today's completed Syndicate Bonus Contract once per UTC day. */
    public function claimBonusContract(string $playerId, string $correlationId): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $correlationId): array {
            $bonus = $this->todayBonusContract();
            return $this->settleBucketClaim(
                $playerId,
                $this->bonusDayKey(),
                $bonus,
                'Bonus daily contract',
                'contract.bonus.reward',
                'BonusDailyContractClaimed',
                $correlationId,
            );
        });
    }

    /** Claim a completed Weekly Milestone Contract once per ISO week. */
    public function claimWeeklyMilestone(string $playerId, string $contractId, string $correlationId): array
    {
        $definition = null;
        foreach (self::WEEKLY_MILESTONES as $entry) {
            if ($entry['id'] === $contractId) {
                $definition = $entry;
                break;
            }
        }
        if ($definition === null) {
            throw new InvalidArgumentException("Unknown weekly milestone contract: {$contractId}");
        }

        return $this->database->playerTransaction($playerId, function () use ($playerId, $definition, $correlationId): array {
            return $this->settleBucketClaim(
                $playerId,
                $this->weeklySlotKey((int) $definition['slot']),
                $definition,
                'Weekly milestone contract',
                'contract.weekly.reward',
                'WeeklyMilestoneClaimed',
                $correlationId,
            );
        });
    }

    private function settleBucketClaim(
        string $playerId,
        string $bucketKey,
        array $contract,
        string $label,
        string $ledgerReason,
        string $eventName,
        string $correlationId,
    ): array {
        $row = $this->database->fetchOne(
            'SELECT progress, claimed FROM player_contract_progress WHERE player_id = :player AND day = :day',
            ['player' => $playerId, 'day' => $bucketKey],
        );
        $progress = $row === null ? 0 : (int) $row['progress'];
        $claimed = $row !== null && (bool) $row['claimed'];
        $target = (int) $contract['target'];
        if ($claimed) {
            throw new RuntimeException("{$label} already claimed.");
        }
        if ($progress < $target) {
            throw new RuntimeException("{$label} is not complete yet.");
        }

        $marked = $this->database->execute(
            'UPDATE player_contract_progress SET claimed = 1 WHERE player_id = :player AND day = :day AND claimed = 0',
            ['player' => $playerId, 'day' => $bucketKey],
        );
        if ($marked === 0) {
            throw new RuntimeException("{$label} already claimed.");
        }

        $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($player === null) {
            throw new RuntimeException("Unknown player: {$playerId}");
        }
        $rewardCash = (int) $contract['reward_cash'];
        $rewardXp = (int) $contract['reward_xp'];
        $rewardCredits = (int) ($contract['reward_credits'] ?? 0);
        $newCash = (int) $player['cash'] + $rewardCash;
        $newXp = (int) $player['xp'] + $rewardXp;
        $this->database->execute(
            'UPDATE players SET cash = :cash, xp = :xp WHERE id = :id',
            ['cash' => $newCash, 'xp' => $newXp, 'id' => $playerId],
        );
        $this->ledger->record($playerId, 'cash', $rewardCash, $newCash, $ledgerReason, $correlationId);

        if ($rewardCredits > 0) {
            $progRow = $this->database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
            if ($progRow !== null) {
                $state = json_decode((string) $progRow['state_json'], true, 512, JSON_THROW_ON_ERROR);
                $state['missionCredits'] = max(0, (int) ($state['missionCredits'] ?? 0)) + $rewardCredits;
                $nextVer = (int) $progRow['version'] + 1;
                $state['version'] = $nextVer;
                $this->database->execute(
                    'UPDATE player_progression SET state_json = :state, version = :version, updated_at = :updated WHERE player_id = :id',
                    [
                        'state' => json_encode($state, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        'version' => $nextVer,
                        'updated' => gmdate('c', $this->nowSeconds()),
                        'id' => $playerId,
                    ],
                );
                $this->ledger->record($playerId, 'mission_credits', $rewardCredits, (int) $state['missionCredits'], $ledgerReason, $correlationId);
            }
        }

        $levelUp = $this->leveling->sync($playerId, $correlationId);

        $eventPayload = [
            'playerId' => $playerId,
            'contractId' => $contract['id'],
            'rewardCash' => $rewardCash,
            'rewardXp' => $rewardXp,
            'correlationId' => $correlationId,
        ];
        if ($rewardCredits > 0) {
            $eventPayload['rewardCredits'] = $rewardCredits;
        }
        $this->events->publish(new DomainEvent($eventName, $eventPayload));

        $receipt = [
            'contractId' => $contract['id'],
            'rewardCash' => $rewardCash,
            'rewardXp' => $rewardXp,
            'levelUp' => $levelUp,
        ];
        if ($rewardCredits > 0) {
            $receipt['rewardCredits'] = $rewardCredits;
        }
        return $receipt;
    }

    /** @return array<int, array{0:int,1:bool,2:bool}> */
    public static function streakSchedule(): array
    {
        return self::STREAK_SCHEDULE;
    }

    /** @return list<array<string, int|string>> */
    public static function contractPool(): array
    {
        return self::CONTRACT_POOL;
    }

    /** @return list<array<string, int|string>> */
    public static function bonusContractPool(): array
    {
        return self::BONUS_CONTRACT_POOL;
    }

    /** @return list<array<string, int|string>> */
    public static function weeklyMilestones(): array
    {
        return self::WEEKLY_MILESTONES;
    }
}
