<?php

declare(strict_types=1);

namespace Zone\Modules\Achievements;

use Zone\Engine\Core\Contracts\EventSubscriber;
use Zone\Engine\Core\Contracts\GameModule;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

final class AchievementsModule implements GameModule
{
    public function boot(EventBus $events, Database $database): void
    {
        $events->subscribe(new FirstCrimeSubscriber($database, $events));
    }
}

final readonly class FirstCrimeSubscriber implements EventSubscriber
{
    public function __construct(private Database $database, private EventBus $events)
    {
    }

    public function eventName(): string
    {
        return 'CrimeSucceeded';
    }

    public function handle(DomainEvent $event): void
    {
        $playerId = (string) ($event->payload['playerId'] ?? '');
        if ($playerId === '') {
            return;
        }
        $existing = $this->database->fetchOne(
            'SELECT code FROM achievements WHERE player_id = :player AND code = :code',
            ['player' => $playerId, 'code' => 'first-score'],
        );
        if ($existing !== null) {
            return;
        }
        $this->database->execute(
            'INSERT INTO achievements (player_id, code, unlocked_at, source_event_id) VALUES (:player, :code, :unlocked, :source)',
            ['player' => $playerId, 'code' => 'first-score', 'unlocked' => gmdate('c'), 'source' => $event->id],
        );
        $this->events->publish(new DomainEvent('AchievementUnlocked', [
            'playerId' => $playerId,
            'code' => 'first-score',
            'triggeredBy' => $event->id,
        ]));
    }
}
