<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Zone\Engine\Core\Persistence\Database;

/**
 * Player notifications, written to the existing `notifications` table.
 *
 * P0 use is the cap-waste nudge (Retention Spec 3.3): when a regenerating bar
 * hits its max, drop a badge row so the client can manufacture the Torn FOMO
 * pull ("your nerve is full, you are wasting regen"). Nudges are de-duplicated:
 * at most one unread cap-waste row per bar exists at a time, so a bar that sits
 * capped over many regen ticks is not spammed.
 */
final readonly class NotificationService
{
    public function __construct(private Database $database)
    {
    }

    /**
     * Record a cap-waste nudge for $bar unless an unread one already exists.
     * Called on the tick where the bar transitions up to its max.
     */
    public function capWasteNudge(string $playerId, string $bar): void
    {
        $existing = $this->database->fetchOne(
            "SELECT id FROM notifications WHERE player_id = :player AND type = :type AND read_at IS NULL",
            ['player' => $playerId, 'type' => 'cap-waste:' . $bar],
        );
        if ($existing !== null) {
            return;
        }
        $payload = [
            'bar' => $bar,
            'message_en' => 'Your ' . $bar . ' is full and wasting.',
            'message_ar' => 'شريط ' . $this->barNameAr($bar) . ' ممتلئ ويُهدر.',
        ];
        $this->database->execute(
            'INSERT INTO notifications (id, player_id, type, payload_json, read_at, created_at) '
            . 'VALUES (:id, :player, :type, :payload, NULL, :created_at)',
            [
                'id' => bin2hex(random_bytes(16)),
                'player' => $playerId,
                'type' => 'cap-waste:' . $bar,
                'payload' => json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'created_at' => gmdate('c'),
            ],
        );
    }

    /** Unread notifications for a player, newest first. */
    public function unread(string $playerId, int $limit = 20): array
    {
        $limit = max(1, min(100, $limit));
        $rows = $this->database->fetchAll(
            "SELECT id, type, payload_json, created_at FROM notifications WHERE player_id = :player AND read_at IS NULL ORDER BY created_at DESC LIMIT {$limit}",
            ['player' => $playerId],
        );
        return array_map(static function (array $row): array {
            $row['payload'] = json_decode((string) $row['payload_json'], true, 32, JSON_THROW_ON_ERROR);
            unset($row['payload_json']);
            return $row;
        }, $rows);
    }

    private function barNameAr(string $bar): string
    {
        return match ($bar) {
            'nerve' => 'الأعصاب',
            'energy' => 'الطاقة',
            default => $bar,
        };
    }
}
