<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Events;

use Zone\Engine\Core\Contracts\EventSubscriber;
use Zone\Engine\Core\Persistence\Database;

final class EventBus
{
    /** @var array<string, list<EventSubscriber>> */
    private array $subscribers = [];

    public function __construct(private readonly Database $database)
    {
    }

    public function subscribe(EventSubscriber $subscriber): void
    {
        $this->subscribers[$subscriber->eventName()][] = $subscriber;
    }

    public function publish(DomainEvent $event): void
    {
        $this->database->execute(
            'INSERT INTO event_log (id, event_name, payload_json, occurred_at) VALUES (:id, :name, :payload, :occurred_at)',
            [
                'id' => $event->id,
                'name' => $event->name,
                'payload' => json_encode($event->payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'occurred_at' => $event->occurredAt,
            ],
        );

        foreach ($this->subscribers[$event->name] ?? [] as $subscriber) {
            $subscriber->handle($event);
        }
    }

    public function summary(): array
    {
        $row = $this->database->fetchOne('SELECT COUNT(*) AS total FROM event_log');
        $subscriberCount = 0;
        foreach ($this->subscribers as $list) {
            $subscriberCount += count($list);
        }
        return [
            'persistedCount' => (int) ($row['total'] ?? 0),
            'subscribedEvents' => array_keys($this->subscribers),
            'subscriberCount' => $subscriberCount,
        ];
    }

    /** @return list<array<string, mixed>> */
    public function recentEvents(int $limit = 10): array
    {
        $safeLimit = max(1, min(50, $limit));
        return $this->database->fetchAll(
            "SELECT id, event_name, occurred_at FROM event_log ORDER BY occurred_at DESC LIMIT {$safeLimit}",
        );
    }
}
