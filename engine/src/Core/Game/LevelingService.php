<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use RuntimeException;
use Zone\Engine\Core\Economy\Ledger;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * Server-authoritative XP -> level progression (Retention Spec 3.1 + v149 Leveling 2.0).
 *
 * Level is a pure function of accumulated xp: totalXp(L) = 50 * L * (L - 1).
 * After every xp gain the engine calls {@see sync()} which recomputes the level
 * and, when it has risen (and Hold-Level is not active), applies the level-up
 * grants: +1 max_nerve, +3 max_energy, and +20 max_life per level crossed, a full
 * refill of nerve+energy+life to the NEW caps, +1 Skill Point & +1 Merit per level,
 * and a cash bonus of level*250 per level.
 *
 * When Hold-Level (state['rpg']['holdLevel'] === true) is enabled by the player,
 * syncLocked banks pending levels without raising players.level until the player
 * explicitly invokes level.promote via RankAndSkillTreeService.
 */
final readonly class LevelingService
{
    /** Curve coefficient k in totalXp = k * L * (L - 1). Primary pace dial. */
    public const XP_COEFFICIENT = 50;
    /** Per-level cap grants and cash payout (Retention Spec 3.1 + v149 RPG). */
    public const NERVE_PER_LEVEL = 1;
    public const ENERGY_PER_LEVEL = 3;
    public const LIFE_PER_LEVEL = 20;
    public const CASH_PER_LEVEL = 250;
    public const SP_PER_LEVEL = 1;
    public const MERITS_PER_LEVEL = 1;

    /** @var list<array{level: int, id: string, titleEn: string, titleAr: string, descEn: string, descAr: string}> */
    public const UNLOCK_ROADMAP = [
        [
            'level' => 1,
            'id' => 'harbor_origin',
            'titleEn' => 'Harbor Docks & Street Crimes',
            'titleAr' => 'أرصفة الميناءوجرائم الشوارع',
            'descEn' => 'Act I campaign, starter crimes, starter gym, and grocer jobs.',
            'descAr' => 'بداية الفصل الأول والجرائم الأساسية والنادي الأول.',
        ],
        [
            'level' => 2,
            'id' => 'city_dump_mail',
            'titleEn' => 'City Dump & Mail',
            'titleAr' => 'مكب المدينة والبريد المشفر',
            'descEn' => 'Scavenge discarded contraband at the City Dump and unlock syndicate mail.',
            'descAr' => 'التنقيب في مكب المدينة عن الغنائم وفتح مراسلات النقابة.',
        ],
        [
            'level' => 3,
            'id' => 'casino_spin_wheels',
            'titleEn' => 'Casino & Spin Wheels',
            'titleAr' => 'الكازينو وعجلات الحظ اليومية',
            'descEn' => 'Full Casino floor plus Lame, Mediocre, and Awesome daily Spin Wheels.',
            'descAr' => 'فتح صالات الكازينو وعجلات الحظ الثلاث اليومية.',
        ],
        [
            'level' => 5,
            'id' => 'market_bazaars_act2',
            'titleEn' => 'Item Market & Bazaars',
            'titleAr' => 'سوق الأدوات والبازارات الشخصية',
            'descEn' => 'Open 0%-tax Personal Bazaars, Item Market trading, and Act II: Mayor Tariq\'s Shadow Ledger.',
            'descAr' => 'فتح البازارات الشخصية بدون ضريبة وسوق الأدوات والفصل الثاني مع العمدة طارق.',
        ],
        [
            'level' => 7,
            'id' => 'bounties_mission_agents',
            'titleEn' => 'Bounties & NPC Mission Agents',
            'titleAr' => 'نظام المكافآت ووكلاء المهام',
            'descEn' => 'Place/claim hit contracts and run tiered contracts for Duke, Layla, Tariq & Vega.',
            'descAr' => 'وضع المكافآت على الرؤوس وتنفيذ عقود وكلاء المهام للحصول على رصيد الترسانة.',
        ],
        [
            'level' => 10,
            'id' => 'companies_vaults_act3',
            'titleEn' => 'Player Companies & Vaults',
            'titleAr' => 'شركات اللاعبين والخزائن المحصنة',
            'descEn' => 'Found or join 1★-10★ Player Companies, Property Vaults, and Act III: Cartel Airlift.',
            'descAr' => 'تأسيس أو الانضمام لشركات اللاعبين وخزائن العقارات والفصل الثالث.',
        ],
        [
            'level' => 12,
            'id' => 'factions_ranked_wars',
            'titleEn' => 'Faction Founding & Ranked Wars',
            'titleAr' => 'تأسيس العائلات وحروب التصنيف',
            'descEn' => 'Found custom Factions, 7-branch Respect Trees, 4-role Crew OCs, and 48h Ranked Wars.',
            'descAr' => 'تأسيس العائلات وشجرة الاحترام والجرائم المنظمة وحروب التصنيف.',
        ],
        [
            'level' => 15,
            'id' => 'airport_smuggling_act4',
            'titleEn' => 'International Airport & Smuggling',
            'titleAr' => 'المطار الدولي والتهريب الخارجي',
            'descEn' => 'Fly international smuggling routes for plushies/flowers/arms and enter Act IV: 120 Blocks.',
            'descAr' => 'السفر الدولي عبر المطار لتهريب البضائع النادرة وبدء الفصل الرابع.',
        ],
        [
            'level' => 20,
            'id' => 'specialist_gyms',
            'titleEn' => 'Specialist Gyms',
            'titleAr' => 'الأندية الرياضية التخصصية',
            'descEn' => 'Access heavyweight and specialist high-gain combat gyms.',
            'descAr' => 'فتح الأندية التخصصية المتقدمة لمضاعفة مكاسب القوة القتالية.',
        ],
        [
            'level' => 25,
            'id' => 'act5_endgame_caches',
            'titleEn' => 'Act V Endgame & RW Caches',
            'titleAr' => 'نهاية الفصل الخامس وصناديق الحروب',
            'descEn' => 'Challenge Act V: The Sovereign Crown and unlock Gold Ranked War Bonus Weapon Caches.',
            'descAr' => 'فتح الفصل الخامس الأخير وصناديق الأسلحة النادرة لحروب التصنيف.',
        ],
        [
            'level' => 50,
            'id' => 'syndicate_inner_circle',
            'titleEn' => 'Syndicate Inner Circle',
            'titleAr' => 'الدائرة العليا للنقابة',
            'descEn' => 'High-table syndicate privileges, offshore sovereign banking, and elite underworld status.',
            'descAr' => 'امتيازات المجلس الأعلى للنقابة والحسابات السيادية النخبوية.',
        ],
        [
            'level' => 100,
            'id' => 'immortal_sovereign',
            'titleEn' => 'Immortal Sovereign',
            'titleAr' => 'السيادة الخالدة لمدينة الزون',
            'descEn' => 'Apex Level 100 pinnacle of Zone City — maximum nerve, energy, life, and Skill Point mastery.',
            'descAr' => 'قمة المستوى 100 والسيادة المطلقة على مدينة الزون.',
        ],
    ];

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
     * grants if it rose (or bank pending levels if Hold-Level is enabled).
     */
    public function sync(string $playerId, string $correlationId): ?array
    {
        return $this->database->playerTransaction($playerId, fn (): ?array => $this->syncLocked($playerId, $correlationId));
    }

    /**
     * Explicitly promote banked pending levels (even when holdLevel is active).
     */
    public function promote(string $playerId, string $correlationId, ?int $maxLevels = null): array
    {
        return $this->database->playerTransaction($playerId, function () use ($playerId, $correlationId, $maxLevels): array {
            $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
            if ($player === null) {
                throw new RuntimeException('Unknown player.');
            }
            $currentLevel = (int) $player['level'];
            $xp = (int) $player['xp'];
            $eligibleLevel = min(100, $this->levelForXp($xp));
            if ($eligibleLevel <= $currentLevel) {
                throw new RuntimeException('No pending level promotions available. Earn more XP first.');
            }
            $targetLevel = $maxLevels !== null && $maxLevels > 0
                ? min($eligibleLevel, $currentLevel + $maxLevels)
                : $eligibleLevel;

            $progRow = $this->database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
            return $this->applyPromotionLocked($player, $targetLevel, $eligibleLevel, $correlationId, $progRow);
        });
    }

    private function syncLocked(string $playerId, string $correlationId): ?array
    {
        $player = $this->database->fetchOne('SELECT * FROM players WHERE id = :id', ['id' => $playerId]);
        if ($player === null) {
            return null;
        }
        $currentLevel = (int) $player['level'];
        $xp = (int) $player['xp'];
        $eligibleLevel = min(100, $this->levelForXp($xp));
        if ($eligibleLevel <= $currentLevel) {
            return null;
        }

        $progRow = $this->database->fetchOne('SELECT state_json, version FROM player_progression WHERE player_id = :id', ['id' => $playerId]);
        if ($progRow !== null) {
            $state = json_decode((string) $progRow['state_json'], true, 512, JSON_THROW_ON_ERROR);
            if (!empty($state['rpg']['holdLevel'])) {
                $pendingLevels = $eligibleLevel - $currentLevel;
                $prevPending = (int) ($state['rpg']['pendingLevels'] ?? 0);
                $state['rpg'] = is_array($state['rpg'] ?? null) ? $state['rpg'] : [];
                $state['rpg']['pendingLevels'] = $pendingLevels;
                $state['rpg']['eligibleLevel'] = $eligibleLevel;
                if ($pendingLevels !== $prevPending) {
                    $this->database->execute(
                        'UPDATE player_progression SET state_json = :state, updated_at = :updated WHERE player_id = :id',
                        [
                            'state' => json_encode($state, JSON_THROW_ON_ERROR),
                            'updated' => gmdate('c'),
                            'id' => $playerId,
                        ],
                    );
                }
                return [
                    'held' => true,
                    'fromLevel' => $currentLevel,
                    'toLevel' => $currentLevel,
                    'eligibleLevel' => $eligibleLevel,
                    'pendingLevels' => $pendingLevels,
                    'levelsGained' => 0,
                    'cashBonus' => 0,
                    'skillPointsGained' => 0,
                    'meritsGained' => 0,
                    'maxNerve' => (int) $player['max_nerve'],
                    'maxEnergy' => (int) $player['max_energy'],
                    'maxLife' => (int) $player['max_life'],
                    'nextLevelXp' => $this->totalXpForLevel($eligibleLevel + 1),
                ];
            }
        }

        return $this->applyPromotionLocked($player, $eligibleLevel, $eligibleLevel, $correlationId, $progRow);
    }

    private function applyPromotionLocked(
        array $player,
        int $newLevel,
        int $eligibleLevel,
        string $correlationId,
        ?array $progRow,
    ): array {
        $playerId = (string) $player['id'];
        $currentLevel = (int) $player['level'];
        $levelsGained = $newLevel - $currentLevel;

        $newMaxNerve = (int) $player['max_nerve'] + $levelsGained * self::NERVE_PER_LEVEL;
        $newMaxEnergy = (int) $player['max_energy'] + $levelsGained * self::ENERGY_PER_LEVEL;
        $newMaxLife = (int) $player['max_life'] + $levelsGained * self::LIFE_PER_LEVEL;
        $newLife = max((int) $player['life'], $newMaxLife);

        $cashBonus = 0;
        for ($l = $currentLevel + 1; $l <= $newLevel; $l++) {
            $cashBonus += $l * self::CASH_PER_LEVEL;
        }
        $newCash = (int) $player['cash'] + $cashBonus;

        // Level-up refills nerve, energy, and life to the NEW caps.
        $this->database->execute(
            'UPDATE players SET level = :level, max_nerve = :maxNerve, max_energy = :maxEnergy, max_life = :maxLife, '
            . 'nerve = :nerve, energy = :energy, life = :life, cash = :cash WHERE id = :id',
            [
                'id' => $playerId,
                'level' => $newLevel,
                'maxNerve' => $newMaxNerve,
                'maxEnergy' => $newMaxEnergy,
                'maxLife' => $newMaxLife,
                'nerve' => $newMaxNerve,
                'energy' => $newMaxEnergy,
                'life' => $newLife,
                'cash' => $newCash,
            ],
        );

        if ($cashBonus > 0) {
            $this->ledger->record($playerId, 'cash', $cashBonus, $newCash, 'levelup.bonus', $correlationId);
        }

        $spGained = $levelsGained * self::SP_PER_LEVEL;
        $meritsGained = $levelsGained * self::MERITS_PER_LEVEL;

        if ($progRow !== null) {
            $state = json_decode((string) $progRow['state_json'], true, 512, JSON_THROW_ON_ERROR);
            $rpg = is_array($state['rpg'] ?? null) ? $state['rpg'] : [];
            $syncedMeritLevel = max($currentLevel, (int) ($rpg['syncedMeritLevel'] ?? $currentLevel));
            $uncreditedMeritLevels = max(0, $newLevel - $syncedMeritLevel);
            if ($uncreditedMeritLevels > 0) {
                $state['merits'] = (int) ($state['merits'] ?? 0) + ($uncreditedMeritLevels * self::MERITS_PER_LEVEL);
            }
            $rpg['syncedMeritLevel'] = max($syncedMeritLevel, $newLevel);
            $rpg['levelSpEarned'] = max(0, $newLevel - 1) * self::SP_PER_LEVEL;
            $rpg['eligibleLevel'] = max($newLevel, $eligibleLevel);
            $rpg['pendingLevels'] = max(0, $eligibleLevel - $newLevel);
            $rpg['bonusLifeFromLevels'] = (int) ($rpg['bonusLifeFromLevels'] ?? 0) + ($levelsGained * self::LIFE_PER_LEVEL);
            $state['rpg'] = $rpg;

            $this->database->execute(
                'UPDATE player_progression SET state_json = :state, updated_at = :updated WHERE player_id = :id',
                [
                    'state' => json_encode($state, JSON_THROW_ON_ERROR),
                    'updated' => gmdate('c'),
                    'id' => $playerId,
                ],
            );
        }

        $event = new DomainEvent('PlayerLeveledUp', [
            'playerId' => $playerId,
            'fromLevel' => $currentLevel,
            'toLevel' => $newLevel,
            'levelsGained' => $levelsGained,
            'cashBonus' => $cashBonus,
            'skillPointsGained' => $spGained,
            'meritsGained' => $meritsGained,
            'maxNerve' => $newMaxNerve,
            'maxEnergy' => $newMaxEnergy,
            'maxLife' => $newMaxLife,
            'correlationId' => $correlationId,
        ]);
        $this->events->publish($event);

        return [
            'held' => false,
            'fromLevel' => $currentLevel,
            'toLevel' => $newLevel,
            'eligibleLevel' => max($newLevel, $eligibleLevel),
            'pendingLevels' => max(0, $eligibleLevel - $newLevel),
            'levelsGained' => $levelsGained,
            'cashBonus' => $cashBonus,
            'skillPointsGained' => $spGained,
            'meritsGained' => $meritsGained,
            'maxNerve' => $newMaxNerve,
            'maxEnergy' => $newMaxEnergy,
            'maxLife' => $newMaxLife,
            'nextLevelXp' => $this->totalXpForLevel($newLevel + 1),
        ];
    }

    public function xpProgressForPlayer(int $level, int $xp, bool $holdLevel = false): array
    {
        $level = max(1, $level);
        $eligibleLevel = min(100, $this->levelForXp($xp));
        $pendingLevels = max(0, $eligibleLevel - $level);
        $floorXp = $this->totalXpForLevel($level);
        $nextXp = $this->totalXpForLevel($level + 1);
        $span = max(1, $nextXp - $floorXp);
        return [
            'currentLevel' => $level,
            'currentXp' => $xp,
            'eligibleLevel' => $eligibleLevel,
            'pendingLevels' => $pendingLevels,
            'holdLevel' => $holdLevel,
            'nextLevelXp' => $nextXp,
            'xpToNextLevel' => max(0, $nextXp - $xp),
            'progressPct' => (int) min(100, max(0, round(($xp - $floorXp) / $span * 100))),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function roadmapForLevel(int $playerLevel): array
    {
        $safeLevel = max(1, $playerLevel);
        return array_map(static fn (array $milestone): array => [
            ...$milestone,
            'title' => ['en' => $milestone['titleEn'], 'ar' => $milestone['titleAr']],
            'description' => ['en' => $milestone['descEn'], 'ar' => $milestone['descAr']],
            'unlocked' => $safeLevel >= $milestone['level'],
            'levelsRemaining' => max(0, $milestone['level'] - $safeLevel),
        ], self::UNLOCK_ROADMAP);
    }

    /** @return array{level: int, nerve: int, energy: int, life: int, cash: int, skillPoints: int, merits: int} */
    public static function grantsForLevel(int $level): array
    {
        $safeLevel = max(1, $level);
        return [
            'level' => $safeLevel,
            'nerve' => self::NERVE_PER_LEVEL,
            'energy' => self::ENERGY_PER_LEVEL,
            'life' => self::LIFE_PER_LEVEL,
            'cash' => $safeLevel * self::CASH_PER_LEVEL,
            'skillPoints' => self::SP_PER_LEVEL,
            'merits' => self::MERITS_PER_LEVEL,
        ];
    }
}
