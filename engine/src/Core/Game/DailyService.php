<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Daily return hooks (Retention Spec 3.3): the 7-day login streak and the
 * rotating daily contract. Every reward is computed and written server-side and
 * is idempotent per UTC day (guarded by players.last_login_day and by the
 * player_contract_progress.claimed flag) so a double request cannot double-pay.
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
     * Rotating daily-contract pool. One is active per UTC day, chosen by the
     * epoch day index, so play is forced across every core system over a week.
     * Reward is 3,000-6,000 cash + 200 xp (Retention Spec 3.3).
     */
    private const CONTRACT_POOL = [
        ['id' => 'crime-spree', 'metric' => 'crimes', 'target' => 15, 'reward_cash' => 4000, 'reward_xp' => 200, 'name_en' => 'Commit 15 crimes', 'name_ar' => 'نفّذ 15 جريمة'],
        ['id' => 'gym-grind', 'metric' => 'stat_gain', 'target' => 40, 'reward_cash' => 3000, 'reward_xp' => 200, 'name_en' => 'Train 40 stat points', 'name_ar' => 'درّب 40 نقطة إحصائية'],
        ['id' => 'honest-work', 'metric' => 'job_cash', 'target' => 6000, 'reward_cash' => 5000, 'reward_xp' => 200, 'name_en' => 'Earn 6,000 from jobs', 'name_ar' => 'اكسب 6,000 من الوظائف'],
        ['id' => 'street-brawler', 'metric' => 'attack_wins', 'target' => 3, 'reward_cash' => 6000, 'reward_xp' => 200, 'name_en' => 'Win 3 attacks', 'name_ar' => 'افُز بـ3 هجمات'],
    ];

    public function __construct(
        private Database $database,
        private Ledger $ledger,
        private EventBus $events,
        private LevelingService $leveling,
    ) {
    }

    private function today(): string
    {
        return gmdate('Y-m-d');
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
        $today = $this->today();
        $lastDay = $player['last_login_day'] ?? null;
        if ($lastDay === $today) {
            return null;
        }

        $yesterday = gmdate('Y-m-d', time() - 86400);
        $prevStreak = (int) ($player['login_streak'] ?? 0);
        $streakDay = ($lastDay === $yesterday && $prevStreak >= 1)
            ? ($prevStreak % 7) + 1
            : 1;

        [$rewardCash, $refillNerve, $refillEnergy] = self::STREAK_SCHEDULE[$streakDay];
        $newCash = (int) $player['cash'] + $rewardCash;
        $nerveVal = $refillNerve ? (int) $player['max_nerve'] : (int) $player['nerve'];
        $energyVal = $refillEnergy ? (int) $player['max_energy'] : (int) $player['energy'];

        // Guarded update: only the request that first flips last_login_day to
        // today wins, so a concurrent double request cannot double-pay.
        $updated = $this->database->execute(
            'UPDATE players SET last_login_day = :today, login_streak = :streak, cash = :cash, nerve = :nerve, energy = :energy '
            . 'WHERE id = :id AND (last_login_day IS NULL OR last_login_day <> :today)',
            [
                'today' => $today,
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
            'nerveRefilled' => $refillNerve,
            'energyRefilled' => $refillEnergy,
        ];
    }

    // ------------------------------------------------------------------
    // Daily contract
    // ------------------------------------------------------------------

    /** The contract active for the current UTC day. */
    public function todayContract(): array
    {
        $index = intdiv(time(), 86400) % count(self::CONTRACT_POOL);
        return [...self::CONTRACT_POOL[$index], 'day' => $this->today()];
    }

    /**
     * Advance today's contract for a metric the player just produced. A no-op
     * unless the metric matches the active contract. Progress-only: it never
     * touches player balances, so it is safe to call inside any action.
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
        if ($contract['metric'] !== $metric) {
            return;
        }
        $day = $contract['day'];
        $updated = $this->database->execute(
            'UPDATE player_contract_progress SET progress = progress + :amount WHERE player_id = :player AND day = :day',
            ['amount' => $amount, 'player' => $playerId, 'day' => $day],
        );
        if ($updated === 0) {
            $this->database->insertIgnore(
                'player_contract_progress',
                ['player_id', 'day', 'progress', 'claimed'],
                [$playerId, $day, $amount, 0],
            );
        }
    }

    /** Today's contract with the player's progress and claim state. */
    public function contractState(string $playerId): array
    {
        $contract = $this->todayContract();
        $row = $this->database->fetchOne(
            'SELECT progress, claimed FROM player_contract_progress WHERE player_id = :player AND day = :day',
            ['player' => $playerId, 'day' => $contract['day']],
        );
        $progress = $row === null ? 0 : (int) $row['progress'];
        $claimed = $row !== null && (bool) $row['claimed'];
        return [
            'contract' => $contract,
            'progress' => $progress,
            'target' => (int) $contract['target'],
            'complete' => $progress >= (int) $contract['target'],
            'claimed' => $claimed,
        ];
    }

    /**
     * Claim today's completed contract exactly once. Credits cash + xp, runs
     * level progression (the xp can cross a level threshold), and emits
     * DailyContractClaimed. Throws if incomplete or already claimed.
     */
    public function claimContract(string $playerId, string $correlationId): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $correlationId): array {
            $contract = $this->todayContract();
            $day = $contract['day'];
            $row = $this->database->fetchOne(
                'SELECT progress, claimed FROM player_contract_progress WHERE player_id = :player AND day = :day',
                ['player' => $playerId, 'day' => $day],
            );
            $progress = $row === null ? 0 : (int) $row['progress'];
            $claimed = $row !== null && (bool) $row['claimed'];
            $target = (int) $contract['target'];
            if ($claimed) {
                throw new RuntimeException('Daily contract already claimed today.');
            }
            if ($progress < $target) {
                throw new RuntimeException('Daily contract is not complete yet.');
            }

            // Mark claimed first, guarded, so a race cannot double-claim.
            $marked = $this->database->execute(
                'UPDATE player_contract_progress SET claimed = 1 WHERE player_id = :player AND day = :day AND claimed = 0',
                ['player' => $playerId, 'day' => $day],
            );
            if ($marked === 0) {
                throw new RuntimeException('Daily contract already claimed today.');
            }

            $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
            if ($player === null) {
                throw new RuntimeException("Unknown player: {$playerId}");
            }
            $rewardCash = (int) $contract['reward_cash'];
            $rewardXp = (int) $contract['reward_xp'];
            $newCash = (int) $player['cash'] + $rewardCash;
            $newXp = (int) $player['xp'] + $rewardXp;
            $this->database->execute(
                'UPDATE players SET cash = :cash, xp = :xp WHERE id = :id',
                ['cash' => $newCash, 'xp' => $newXp, 'id' => $playerId],
            );
            $this->ledger->record($playerId, 'cash', $rewardCash, $newCash, 'contract.reward', $correlationId);
            $levelUp = $this->leveling->sync($playerId, $correlationId);

            $event = new DomainEvent('DailyContractClaimed', [
                'playerId' => $playerId,
                'contractId' => $contract['id'],
                'rewardCash' => $rewardCash,
                'rewardXp' => $rewardXp,
                'correlationId' => $correlationId,
            ]);
            $this->events->publish($event);

            return [
                'contractId' => $contract['id'],
                'rewardCash' => $rewardCash,
                'rewardXp' => $rewardXp,
                'levelUp' => $levelUp,
            ];
        });
    }
}
