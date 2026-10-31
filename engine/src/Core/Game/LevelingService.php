<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Server-authoritative XP -> level progression (Retention Spec 3.1).
 *
 * Level is a pure function of accumulated xp: totalXp(L) = 50 * L * (L - 1).
 * After every xp gain the engine calls {@see sync()} which recomputes the level
 * and, when it has risen, applies the level-up grants: +1 max_nerve and
 * +3 max_energy per level crossed, a full refill of nerve+energy to the NEW
 * caps, and a cash bonus of level*250 per level. Only the server writes level,
 * caps, and the bonus; the client never supplies any of it.
 *
 * Grants are INCREMENTAL (added to the current caps), never a recompute from
 * scratch, so the inflated founder seed and any future max_* bonuses (e.g.
 * properties, P1) are preserved. The level column is treated as a floor and
 * only ever raised, so a seed that starts above its xp-derived level is never
 * demoted.
 */
final readonly class LevelingService
{
    /** Curve coefficient k in totalXp = k * L * (L - 1). Primary pace dial. */
    public const XP_COEFFICIENT = 50;
    /** Per-level cap grants and cash payout (Retention Spec 3.1). */
    public const NERVE_PER_LEVEL = 1;
    public const ENERGY_PER_LEVEL = 3;
    public const CASH_PER_LEVEL = 250;

    public function __construct(
        private Database $database,
        private Ledger $ledger,
        private EventBus $events,
    ) {
    }

    /** Total xp required to BE level $level. Level 1 requires 0. */
    public function totalXpForLevel(int $level): int
    {
        if ($level <= 1) {
            return 0;
        }
        return self::XP_COEFFICIENT * $level * ($level - 1);
    }

    /** Largest level L (>= 1) whose xp threshold has been reached by $xp. */
    public function levelForXp(int $xp): int
    {
        if ($xp <= 0) {
            return 1;
        }
        // Closed form from 50L^2 - 50L - xp <= 0, then corrected for float error.
        $level = (int) floor((self::XP_COEFFICIENT + sqrt(self::XP_COEFFICIENT ** 2 + 4 * self::XP_COEFFICIENT * $xp)) / (2 * self::XP_COEFFICIENT));
        if ($level < 1) {
            $level = 1;
        }
        while ($this->totalXpForLevel($level + 1) <= $xp) {
            $level++;
        }
        while ($level > 1 && $this->totalXpForLevel($level) > $xp) {
            $level--;
        }
        return $level;
    }

    /**
     * Recompute the player's level from its current xp and apply the level-up
     * grants if it rose. Joins the caller's transaction after its xp write, or
     * starts a locked transaction when called alone. Returns a summary when a
     * level was gained, or null when nothing changed.
     */
    public function sync(string $playerId, string $correlationId): ?array
    {
        return $this->database->playerTransaction($playerId, fn (): ?array => $this->syncLocked($playerId, $correlationId));
    }

    private function syncLocked(string $playerId, string $correlationId): ?array
    {
        $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($player === null) {
            return null;
        }
        $currentLevel = (int) $player['level'];
        $xp = (int) $player['xp'];
        $newLevel = $this->levelForXp($xp);
        if ($newLevel <= $currentLevel) {
            return null;
        }

        $levelsGained = $newLevel - $currentLevel;
        $newMaxNerve = (int) $player['max_nerve'] + $levelsGained * self::NERVE_PER_LEVEL;
        $newMaxEnergy = (int) $player['max_energy'] + $levelsGained * self::ENERGY_PER_LEVEL;

        $cashBonus = 0;
        for ($l = $currentLevel + 1; $l <= $newLevel; $l++) {
            $cashBonus += $l * self::CASH_PER_LEVEL;
        }
        $newCash = (int) $player['cash'] + $cashBonus;

        // Level-up refills nerve+energy to the NEW caps (the juicy moment).
        $this->database->execute(
            'UPDATE players SET level = :level, max_nerve = :maxNerve, max_energy = :maxEnergy, '
            . 'nerve = :nerve, energy = :energy, cash = :cash WHERE id = :id',
            [
                'id' => $playerId,
                'level' => $newLevel,
                'maxNerve' => $newMaxNerve,
                'maxEnergy' => $newMaxEnergy,
                'nerve' => $newMaxNerve,
                'energy' => $newMaxEnergy,
                'cash' => $newCash,
            ],
        );
        if ($cashBonus > 0) {
            $this->ledger->record($playerId, 'cash', $cashBonus, $newCash, 'levelup.bonus', $correlationId);
        }

        $event = new DomainEvent('PlayerLeveledUp', [
            'playerId' => $playerId,
            'fromLevel' => $currentLevel,
            'toLevel' => $newLevel,
            'levelsGained' => $levelsGained,
            'cashBonus' => $cashBonus,
            'maxNerve' => $newMaxNerve,
            'maxEnergy' => $newMaxEnergy,
            'correlationId' => $correlationId,
        ]);
        $this->events->publish($event);

        return [
            'fromLevel' => $currentLevel,
            'toLevel' => $newLevel,
            'levelsGained' => $levelsGained,
            'cashBonus' => $cashBonus,
            'maxNerve' => $newMaxNerve,
            'maxEnergy' => $newMaxEnergy,
            'nextLevelXp' => $this->totalXpForLevel($newLevel + 1),
        ];
    }

    public function xpProgressForPlayer(int $level, int $xp): array
    {
        $level = max(1, $level);
        $floorXp = $this->totalXpForLevel($level);
        $nextXp = $this->totalXpForLevel($level + 1);
        $span = max(1, $nextXp - $floorXp);
        return [
            'currentLevel' => $level,
            'currentXp' => $xp,
            'nextLevelXp' => $nextXp,
            'xpToNextLevel' => max(0, $nextXp - $xp),
            'progressPct' => (int) min(100, max(0, round(($xp - $floorXp) / $span * 100))),
        ];
    }
}
