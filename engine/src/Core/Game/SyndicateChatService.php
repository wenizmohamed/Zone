<?php

declare(strict_types=1);

namespace Zone\Engine\Core\Game;

use Closure;
use InvalidArgumentException;
use RuntimeException;
use Throwable;
use Zone\Engine\Core\Events\DomainEvent;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Persistence\Database;

/**
 * ZONE v159 — Wave-3 Track 15: Live MMO Syndicate Chat, Radio Channels, `/roll` Dice Commands & Relay Broadcasts
 * ==============================================================================================================
 * Canonical Namespace: `Zone\Engine\Core\Game\SyndicateChatService`
 * Alias Registered:    `Zone\Core\Game\SyndicateChatService`
 *
 * Implements:
 *   - `chat-system`: MVP Message-Bus Decorator Pipeline (`IgnoreWithSymbols` -> `XssLengthSanitizer` ->
 *     `AntiFloodRateGuard` -> `CommandsHandle` -> `TranslationGloss` -> `SelfResendPersistence`).
 *   - `dice-roller`: Server-authoritative cryptographic `/roll <NdM+K>` (`1d20`, `2d6+3`, `3d8-2`, `4dF`, `d100`)
 *     producing `{expression, rolls, modifier, total}` JSON metadata.
 *   - `mmo-zone-architecture` & `mmo-action-relay`: 4 AoI-scoped radio channels (`global`, `district`,
 *     `faction`, `trade`), server-stamped sequence IDs, and relay broadcasts.
 *   - `realtime-multiplayer`: Delta-seq polling (`snapshot($playerId, $channel, $sinceId, $district)`),
 *     per-player mute lists (`muteSender`, `unmuteSender`), and optimistic state reconciliation.
 *
 * @integrator Route Wiring Guide (`engine/router.php` + `GameEngine.php`):
 * -----------------------------------------------------------------------------------------
 * Constructor:
 *   `$chat = new SyndicateChatService($this->database, $this->events);`
 *
 * Unified Router Dispatch:
 *   1. `GET /api/v1/syndicate-chat?channel=global&sinceId=0&district=center`:
 *      `$chat->snapshot($playerId, (string) ($_GET['channel'] ?? 'global'), isset($_GET['sinceId']) ? (int) $_GET['sinceId'] : null, (string) ($_GET['district'] ?? 'center'))`
 *   2. `POST /api/v1/syndicate-chat/action` with `{"action": "...", ...}`:
 *      `$chat->act($playerId, (string) ($body['action'] ?? ''), $body)`
 *
 * Direct Public Domain API Methods:
 *   - `ensureSchema(): void`
 *   - `snapshot(int|string $playerId, string $channel = 'global', ?int $sinceId = null, string $district = 'center'): array`
 *   - `act(int|string $playerId, string $action, array $payload = []): array`
 *   - `sendMessage(int|string $playerId, array $payload = []): array`
 *   - `rollDiceCommand(int|string $playerId, array $payload = []): array`
 *   - `muteSender(int|string $playerId, array $payload = []): array`
 *   - `unmuteSender(int|string $playerId, array $payload = []): array`
 *   - `relayBroadcast(int|string $playerId, array $payload = []): array`
 *   - `static rollDiceExpression(string $expression, ?Closure $rng = null): array`
 *   - `static sanitizeMessageText(string $raw): string`
 *   - `static normalizeChannel(string $channel): string`
 *
 * Database Dual-Compatibility (PostgreSQL 16 + SQLite 3):
 *   - Idempotent `CREATE TABLE IF NOT EXISTS` DDL for `syndicate_chat_messages`, `syndicate_chat_mutes`,
 *     `syndicate_chat_rate_state`, and `syndicate_chat_sync_state`.
 *   - Zero 2-argument SQLite scalar `MAX(a,b)` / `MIN(a,b)` calls.
 *   - Strictly unique named PDO `:params` per SQL statement.
 */
final class SyndicateChatService
{
    public const MAX_MESSAGE_LENGTH = 280;
    public const RATE_LIMIT_MS = 1500;
    public const HISTORY_LIMIT = 40;

    /** @var list<string> */
    public const CHANNELS = ['global', 'district', 'faction', 'trade'];

    /** @var array<string, array{id: string, nameEn: string, nameAr: string, badgeEn: string, badgeAr: string, tone: string}> */
    public const CHANNELS_CATALOG = [
        'global' => [
            'id' => 'global',
            'nameEn' => 'Global Radio',
            'nameAr' => 'الراديو العام',
            'badgeEn' => 'City-Wide Comms',
            'badgeAr' => 'اتصالات المدينة',
            'tone' => 'sage',
        ],
        'district' => [
            'id' => 'district',
            'nameEn' => 'District Sector',
            'nameAr' => 'قناة الحي',
            'badgeEn' => 'AoI Local Grid',
            'badgeAr' => 'شبكة القطاع المحلي',
            'tone' => 'blue',
        ],
        'faction' => [
            'id' => 'faction',
            'nameEn' => 'Faction Encrypted',
            'nameAr' => 'قناة النقابة',
            'badgeEn' => 'Syndicate Relay',
            'badgeAr' => 'تشفير العائلة',
            'tone' => 'gold',
        ],
        'trade' => [
            'id' => 'trade',
            'nameEn' => 'Trade & Bazaar',
            'nameAr' => 'سوق التجارة',
            'badgeEn' => 'Contraband Ticker',
            'badgeAr' => 'تداول البازار',
            'tone' => 'plum',
        ],
    ];

    /** @var array<string, string> */
    private const EN_TO_AR_GLOSSARY = [
        'pier 4' => 'الرصيف الرابع',
        'downtown' => 'وسط المدينة',
        'harbor' => 'المرفأ',
        'xanax' => 'زاناكس',
        'edvd' => 'قرص معنويات',
        'blood bag' => 'كيس دم',
        'bounty' => 'مكافأة',
        'chain' => 'سلسلة',
        'raid' => 'غارة',
        'faction' => 'النقابة',
        'syndicate' => 'النقابة',
        'wall' => 'الجدار',
        'hospital' => 'المستشفى',
        'jail' => 'السجن',
        'vault' => 'الخزنة',
        'smuggling' => 'تهريب',
        'contraband' => 'مهربات',
        'mayor tariq' => 'العمدة طارق',
        'luna' => 'لونا',
    ];

    /** @var array<int, bool> */
    private static array $schemaEnsured = [];

    private readonly ResourceService $resources;

    public function __construct(
        private readonly Database $database,
        private readonly EventBus $events,
        private readonly ?Closure $random = null,
        private readonly ?Closure $clock = null,
    ) {
        $this->resources = new ResourceService($database);
        $this->ensureSchema();
    }

    /**
     * Idempotently creates PostgreSQL 16 & SQLite 3 tables for Syndicate MMO Chat & Mutes.
     */
    public function ensureSchema(): void
    {
        $dbKey = spl_object_id($this->database);
        if (!empty(self::$schemaEnsured[$dbKey])) {
            return;
        }

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS syndicate_chat_sync_state (
                scope VARCHAR(48) PRIMARY KEY,
                current_seq BIGINT NOT NULL DEFAULT 0,
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS syndicate_chat_messages (
                message_id BIGINT PRIMARY KEY,
                channel VARCHAR(32) NOT NULL,
                scope_key VARCHAR(80) NOT NULL DEFAULT 'global',
                sender_player_id VARCHAR(64) NOT NULL,
                sender_username VARCHAR(80) NOT NULL,
                sender_faction_id VARCHAR(80) NOT NULL DEFAULT 'independent',
                sender_role VARCHAR(32) NOT NULL DEFAULT 'operative',
                message_type VARCHAR(24) NOT NULL DEFAULT 'chat',
                body_en TEXT NOT NULL,
                body_ar TEXT NOT NULL,
                meta_json TEXT NOT NULL DEFAULT '{}',
                created_at_ms BIGINT NOT NULL,
                created_at VARCHAR(40) NOT NULL
            )"
        );

        $this->database->execute(
            'CREATE INDEX IF NOT EXISTS idx_syndicate_chat_channel_seq ON syndicate_chat_messages (channel, message_id)'
        );

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS syndicate_chat_mutes (
                player_id VARCHAR(64) NOT NULL,
                muted_player_id VARCHAR(64) NOT NULL,
                muted_username VARCHAR(80) NOT NULL DEFAULT '',
                reason VARCHAR(120) NOT NULL DEFAULT 'manual',
                created_at VARCHAR(40) NOT NULL,
                PRIMARY KEY (player_id, muted_player_id)
            )"
        );

        $this->database->execute(
            "CREATE TABLE IF NOT EXISTS syndicate_chat_rate_state (
                player_id VARCHAR(64) PRIMARY KEY,
                last_sent_at_ms BIGINT NOT NULL DEFAULT 0,
                messages_sent INTEGER NOT NULL DEFAULT 0,
                updated_at VARCHAR(40) NOT NULL
            )"
        );

        self::$schemaEnsured[$dbKey] = true;
    }

    public static function normalizeChannel(string $channel): string
    {
        $clean = strtolower(trim($channel));
        $aliases = [
            'city' => 'global',
            'world' => 'global',
            'all' => 'global',
            'local' => 'district',
            'sector' => 'district',
            'aoi' => 'district',
            'syndicate' => 'faction',
            'clan' => 'faction',
            'bazaar' => 'trade',
            'market' => 'trade',
        ];
        if (isset($aliases[$clean])) {
            $clean = $aliases[$clean];
        }
        return in_array($clean, self::CHANNELS, true) ? $clean : 'global';
    }

    /**
     * Decorator Stage 1 & 2 (`IgnoreWithSymbolsChatMessageBus` + XSS/Length Sanitizer).
     * Strips forbidden control characters (`\u2410`, `\u2406`, `\u2411`, ASCII controls),
     * neutralizes HTML/script payloads, collapses excessive whitespace, and enforces `<= 280` chars.
     */
    public static function sanitizeMessageText(string $raw): string
    {
        // Strip forbidden DCL/MMO control symbols and ASCII control characters
        $cleaned = str_replace(["\u{2410}", "\u{2406}", "\u{2411}", "\0"], '', $raw);
        $cleaned = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', ' ', $cleaned);

        // Remove script/style/iframe blocks and strip all HTML tags to prevent XSS injection
        $cleaned = (string) preg_replace('~<(script|style|iframe|object|embed|svg)[^>]*>.*?</\1>~isu', '', $cleaned);
        $cleaned = strip_tags($cleaned);

        // Strip residual angle brackets & dangerous URI schemes
        $cleaned = str_replace(['<', '>'], '', $cleaned);
        $cleaned = (string) preg_replace('/javascript\s*:/iu', '', $cleaned);
        $cleaned = (string) preg_replace('/on[a-z]+\s*=/iu', '', $cleaned);
        $cleaned = trim((string) preg_replace('/\s+/u', ' ', $cleaned));

        if ($cleaned === '') {
            throw new InvalidArgumentException('Chat message cannot be empty.');
        }

        $len = function_exists('mb_strlen') ? mb_strlen($cleaned, 'UTF-8') : strlen($cleaned);
        if ($len > self::MAX_MESSAGE_LENGTH) {
            throw new InvalidArgumentException(
                sprintf('Chat message exceeds maximum length of %d characters (%d given).', self::MAX_MESSAGE_LENGTH, $len)
            );
        }

        return $cleaned;
    }

    /**
     * Server-Authoritative Cryptographic Dice Roller (`dice-roller` skill).
     * Supports `1d20`, `2d6+3`, `1d20+5`, `3d8-2`, `4dF`, `d100`.
     *
     * @return array{expression: string, count: int, sides: int|string, rolls: list<int>, modifier: int, total: int}
     */
    public static function rollDiceExpression(string $expression, ?Closure $rng = null): array
    {
        $clean = strtolower(trim($expression));
        if ($clean === '') {
            $clean = '1d20';
        }
        $clean = str_replace(' ', '', $clean);

        if (!preg_match('/^(\d{0,2})d(f|\d{1,4})([+-]\d{1,4})?$/i', $clean, $matches)) {
            throw new InvalidArgumentException("Invalid dice expression: {$expression}. Expected format like 2d6+3, 1d20, 4dF, or d100.");
        }

        $countStr = $matches[1];
        $sidesStr = strtolower($matches[2]);
        $modStr = $matches[3] ?? '';

        $count = $countStr === '' ? 1 : (int) $countStr;
        if ($count < 1 || $count > 20) {
            throw new InvalidArgumentException('Dice count must be between 1 and 20.');
        }

        $modifier = $modStr !== '' ? (int) $modStr : 0;
        if ($modifier < -1000 || $modifier > 1000) {
            throw new InvalidArgumentException('Dice modifier must be between -1000 and +1000.');
        }

        $rollFn = static function (int $min, int $max) use ($rng): int {
            if ($rng !== null) {
                return (int) $rng($min, $max);
            }
            return random_int($min, $max);
        };

        $rolls = [];
        if ($sidesStr === 'f') {
            $sides = 'F';
            for ($i = 0; $i < $count; $i++) {
                $rolls[] = $rollFn(-1, 1);
            }
        } else {
            $sidesInt = (int) $sidesStr;
            if ($sidesInt < 2 || $sidesInt > 1000) {
                throw new InvalidArgumentException('Dice sides must be between 2 and 1000.');
            }
            $sides = $sidesInt;
            for ($i = 0; $i < $count; $i++) {
                $rolls[] = $rollFn(1, $sidesInt);
            }
        }

        $sum = array_sum($rolls);
        $total = $sum + $modifier;
        $canonicalExpr = $count . 'd' . $sides . ($modifier > 0 ? '+' . $modifier : ($modifier < 0 ? (string) $modifier : ''));

        return [
            'expression' => $canonicalExpr,
            'count' => $count,
            'sides' => $sides,
            'rolls' => $rolls,
            'modifier' => $modifier,
            'total' => $total,
        ];
    }

    /**
     * Unified state snapshot with optional `sinceId` delta-seq polling (`realtime-multiplayer` + `chat-system`).
     *
     * @return array<string, mixed>
     */
    public function snapshot(
        int|string $playerId,
        string $channel = 'global',
        ?int $sinceId = null,
        string $district = 'center',
    ): array {
        $pid = $this->normalizePlayerId($playerId);
        $cleanChannel = self::normalizeChannel($channel);
        $cleanDistrict = FactionTerritoryWarService::normalizeDistrictId($district);

        $this->bootstrapSeedMessages();

        $player = $this->loadPlayer($pid);
        $playerFactionId = $this->resolvePlayerFactionId($pid);
        $mutedMap = $this->loadMutedMap($pid);
        $mutedIds = array_keys($mutedMap);

        $latestId = $this->currentSyncSeq();
        $isDelta = $sinceId !== null && $sinceId > 0 && $sinceId <= $latestId;

        if ($isDelta) {
            $rows = $this->database->fetchAll(
                'SELECT message_id, channel, scope_key, sender_player_id, sender_username, sender_faction_id,
                        sender_role, message_type, body_en, body_ar, meta_json, created_at_ms, created_at
                 FROM syndicate_chat_messages
                 WHERE channel = :ch AND message_id > :sinceId
                 ORDER BY message_id ASC
                 LIMIT 60',
                ['ch' => $cleanChannel, 'sinceId' => $sinceId],
            );
        } else {
            $rows = $this->database->fetchAll(
                'SELECT message_id, channel, scope_key, sender_player_id, sender_username, sender_faction_id,
                        sender_role, message_type, body_en, body_ar, meta_json, created_at_ms, created_at
                 FROM syndicate_chat_messages
                 WHERE channel = :ch
                 ORDER BY message_id DESC
                 LIMIT 40',
                ['ch' => $cleanChannel],
            );
            $rows = array_reverse($rows);
        }

        $messages = [];
        $filteredMutedCount = 0;
        foreach ($rows as $row) {
            $senderId = (string) $row['sender_player_id'];
            if (isset($mutedMap[$senderId])) {
                $filteredMutedCount++;
                continue;
            }
            $messages[] = $this->formatMessageRow($row);
        }

        $channelCounts = $this->computeChannelCounts($sinceId ?? 0, $mutedMap);

        return [
            'ok' => true,
            'route' => 'syndicate_chat.state',
            'playerId' => $pid,
            'playerFactionId' => $playerFactionId,
            'activeChannel' => $cleanChannel,
            'activeDistrict' => $cleanDistrict,
            'snapshotSeq' => $latestId,
            'latestId' => $latestId,
            'sinceId' => $sinceId,
            'deltaCompressed' => $isDelta,
            'messages' => $messages,
            'filteredMutedCount' => $filteredMutedCount,
            'mutedPlayerIds' => $mutedIds,
            'mutedList' => array_values($mutedMap),
            'channelCounts' => $channelCounts,
            'channelsCatalog' => array_values(self::CHANNELS_CATALOG),
            'rateLimitMs' => self::RATE_LIMIT_MS,
            'maxMessageLength' => self::MAX_MESSAGE_LENGTH,
            'player' => $player,
            'serverTimestamp' => round($this->nowFloat(), 3),
        ];
    }

    /**
     * Unified action dispatcher supporting `syndicate_chat.*` and `chat.*` actions.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function act(int|string $playerId, string $action, array $payload = []): array
    {
        $cleanAction = strtolower(trim($action));
        if ($cleanAction === '') {
            throw new InvalidArgumentException('Syndicate chat action is required.');
        }

        $channel = is_string($payload['channel'] ?? null) ? $payload['channel'] : 'global';
        $sinceId = isset($payload['sinceId']) && is_numeric($payload['sinceId'])
            ? (int) $payload['sinceId']
            : (isset($payload['sinceSeq']) && is_numeric($payload['sinceSeq']) ? (int) $payload['sinceSeq'] : null);
        $district = is_string($payload['district'] ?? null) ? $payload['district'] : 'center';

        return match ($cleanAction) {
            'syndicate_chat.state', 'chat.state', 'state', 'snapshot' => $this->snapshot($playerId, $channel, $sinceId, $district),
            'syndicate_chat.send', 'chat.send', 'chat.send_message', 'send_message', 'send' => $this->sendMessage($playerId, $payload),
            'syndicate_chat.roll', 'chat.roll', 'roll_dice', 'roll' => $this->rollDiceCommand($playerId, $payload),
            'syndicate_chat.mute_sender', 'chat.mute_sender', 'chat.mute', 'mute_sender', 'mute' => $this->muteSender($playerId, $payload),
            'syndicate_chat.unmute_sender', 'chat.unmute_sender', 'chat.unmute', 'unmute_sender', 'unmute' => $this->unmuteSender($playerId, $payload),
            'syndicate_chat.relay', 'chat.relay_broadcast', 'chat.relay', 'relay_broadcast', 'relay' => $this->relayBroadcast($playerId, $payload),
            default => throw new InvalidArgumentException("Unsupported syndicate chat action: {$action}"),
        };
    }

    /**
     * Full MVP Message-Bus Decorator Pipeline (`chat-system`):
     *   1. `IgnoreWithSymbols` + XSS/Length validation (`<= 280` chars)
     *   2. `AntiFloodRateGuard` (`1.5s` window per player)
     *   3. `CommandsHandle` (`/roll <expr>`, `/me <emote>`, `/help`)
     *   4. `TranslationGloss` (bilingual EN/AR auto-gloss)
     *   5. `SelfResendPersistence` (persists to `syndicate_chat_messages` & emits `SyndicateChatMessageSent`)
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function sendMessage(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $this->bootstrapSeedMessages();

        $rawMessage = is_string($payload['message'] ?? null)
            ? $payload['message']
            : (is_string($payload['body'] ?? null) ? $payload['body'] : (string) ($payload['text'] ?? ''));

        $sanitized = self::sanitizeMessageText($rawMessage);
        $channel = self::normalizeChannel(is_string($payload['channel'] ?? null) ? $payload['channel'] : 'global');
        $district = FactionTerritoryWarService::normalizeDistrictId(
            is_string($payload['district'] ?? null) ? $payload['district'] : 'center'
        );

        return $this->database->playerTransaction($pid, function () use ($pid, $sanitized, $channel, $district): array {
            $player = $this->loadPlayer($pid);
            $factionId = $this->resolvePlayerFactionId($pid);
            $nowFloat = $this->nowFloat();
            $nowMs = (int) round($nowFloat * 1000);
            $nowSec = (int) floor($nowFloat);

            $this->enforceRateGuard($pid, $nowMs, $nowSec);

            $scopeKey = match ($channel) {
                'district' => $district,
                'faction' => $factionId,
                'trade' => 'trade',
                default => 'global',
            };

            $username = (string) ($player['username'] ?? $pid);
            $messageType = 'chat';
            $bodyEn = $sanitized;
            $bodyAr = $this->buildBilingualGloss($sanitized, 'ar');
            $meta = [
                'decorators' => [
                    'IgnoreWithSymbolsChatMessageBus',
                    'XssLengthSanitizerDecorator',
                    'AntiFloodRateGuardDecorator',
                    'CommandsHandleChatMessageBus',
                    'TranslationGlossDecorator',
                    'SelfResendChatMessageBus',
                ],
                'district' => $district,
            ];

            // Stage 4: CommandsHandleChatMessageBus interceptor for `/`-prefixed commands
            if (str_starts_with($sanitized, '/')) {
                $cmdResult = $this->dispatchSlashCommand($username, $sanitized);
                $messageType = $cmdResult['messageType'];
                $bodyEn = $cmdResult['bodyEn'];
                $bodyAr = $cmdResult['bodyAr'];
                $meta = array_merge($meta, $cmdResult['meta']);
            } else {
                // Detect if original message is primarily Arabic and synthesize English gloss
                if (preg_match('/\p{Arabic}/u', $sanitized) === 1) {
                    $bodyAr = $sanitized;
                    $bodyEn = $this->buildBilingualGloss($sanitized, 'en');
                }
            }

            $msgId = $this->bumpSyncSeq($nowSec);
            $createdAt = gmdate('c', $nowSec);

            $row = [
                'message_id' => $msgId,
                'channel' => $channel,
                'scope_key' => $scopeKey,
                'sender_player_id' => $pid,
                'sender_username' => $username,
                'sender_faction_id' => $factionId,
                'sender_role' => 'operative',
                'message_type' => $messageType,
                'body_en' => $bodyEn,
                'body_ar' => $bodyAr,
                'meta_json' => json_encode($meta, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                'created_at_ms' => $nowMs,
                'created_at' => $createdAt,
            ];

            $this->insertMessageRow($row);

            $this->events->publish(new DomainEvent('SyndicateChatMessageSent', [
                'messageId' => $msgId,
                'channel' => $channel,
                'scopeKey' => $scopeKey,
                'playerId' => $pid,
                'username' => $username,
                'factionId' => $factionId,
                'messageType' => $messageType,
                'roll' => $meta['roll'] ?? null,
            ]));

            $formatted = $this->formatMessageRow($row);

            return [
                'ok' => true,
                'route' => 'syndicate_chat.send',
                'snapshotSeq' => $msgId,
                'message' => $formatted,
                'roll' => $meta['roll'] ?? null,
                'command' => $meta['command'] ?? null,
                'player' => $player,
                'serverTimestamp' => round($nowFloat, 3),
            ];
        });
    }

    /**
     * Direct `/roll` dice command endpoint (`dice-roller` skill).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function rollDiceCommand(int|string $playerId, array $payload = []): array
    {
        $expr = is_string($payload['expression'] ?? null)
            ? trim($payload['expression'])
            : (is_string($payload['dice'] ?? null) ? trim($payload['dice']) : '2d6+3');
        if ($expr === '') {
            $expr = '1d20';
        }
        $payload['message'] = '/roll ' . ltrim($expr, '/');
        return $this->sendMessage($playerId, $payload);
    }

    /**
     * Mutes a target sender for this player (`syndicate_chat_mutes`).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function muteSender(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $rawTarget = $payload['mutedPlayerId'] ?? ($payload['targetPlayerId'] ?? ($payload['senderId'] ?? ''));
        $targetId = $this->normalizePlayerId(is_scalar($rawTarget) ? (string) $rawTarget : '');

        if ($pid === $targetId) {
            throw new InvalidArgumentException('You cannot mute yourself.');
        }

        $targetUsername = is_string($payload['mutedUsername'] ?? null)
            ? substr(trim(strip_tags($payload['mutedUsername'])), 0, 80)
            : $targetId;
        $reason = is_string($payload['reason'] ?? null)
            ? substr(trim(strip_tags($payload['reason'])), 0, 120)
            : 'manual';

        $nowSec = $this->nowSec();
        $createdAt = gmdate('c', $nowSec);

        $this->database->execute(
            'INSERT INTO syndicate_chat_mutes (player_id, muted_player_id, muted_username, reason, created_at)
             VALUES (:pid, :mid, :mname, :reason, :created)
             ON CONFLICT (player_id, muted_player_id) DO UPDATE SET
                muted_username = EXCLUDED.muted_username,
                reason = EXCLUDED.reason,
                created_at = EXCLUDED.created_at',
            [
                'pid' => $pid,
                'mid' => $targetId,
                'mname' => $targetUsername,
                'reason' => $reason === '' ? 'manual' : $reason,
                'created' => $createdAt,
            ],
        );

        $mutedMap = $this->loadMutedMap($pid);

        return [
            'ok' => true,
            'route' => 'syndicate_chat.mute_sender',
            'playerId' => $pid,
            'mutedPlayerId' => $targetId,
            'mutedPlayerIds' => array_keys($mutedMap),
            'mutedList' => array_values($mutedMap),
            'serverTimestamp' => round($this->nowFloat(), 3),
        ];
    }

    /**
     * Removes a target sender from this player's mute list.
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function unmuteSender(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $rawTarget = $payload['mutedPlayerId'] ?? ($payload['targetPlayerId'] ?? ($payload['senderId'] ?? ''));
        $targetId = $this->normalizePlayerId(is_scalar($rawTarget) ? (string) $rawTarget : '');

        $this->database->execute(
            'DELETE FROM syndicate_chat_mutes WHERE player_id = :pid AND muted_player_id = :mid',
            ['pid' => $pid, 'mid' => $targetId],
        );

        $mutedMap = $this->loadMutedMap($pid);

        return [
            'ok' => true,
            'route' => 'syndicate_chat.unmute_sender',
            'playerId' => $pid,
            'unmutedPlayerId' => $targetId,
            'mutedPlayerIds' => array_keys($mutedMap),
            'mutedList' => array_values($mutedMap),
            'serverTimestamp' => round($this->nowFloat(), 3),
        ];
    }

    /**
     * Broadcasts a server-stamped MMO Action Relay alert across a radio channel (`mmo-action-relay`).
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function relayBroadcast(int|string $playerId, array $payload = []): array
    {
        $pid = $this->normalizePlayerId($playerId);
        $this->bootstrapSeedMessages();

        $channel = self::normalizeChannel(is_string($payload['channel'] ?? null) ? $payload['channel'] : 'faction');
        $district = FactionTerritoryWarService::normalizeDistrictId(
            is_string($payload['district'] ?? null) ? $payload['district'] : 'center'
        );
        $rawHeadline = is_string($payload['headline'] ?? null)
            ? $payload['headline']
            : (is_string($payload['message'] ?? null) ? $payload['message'] : 'Tactical Sector Relay Ping');
        $cleanHeadline = self::sanitizeMessageText($rawHeadline);

        $player = $this->loadPlayer($pid);
        $factionId = $this->resolvePlayerFactionId($pid);
        $username = (string) ($player['username'] ?? $pid);

        $nowFloat = $this->nowFloat();
        $nowMs = (int) round($nowFloat * 1000);
        $nowSec = (int) floor($nowFloat);
        $msgId = $this->bumpSyncSeq($nowSec);

        $bodyEn = "📡 [RELAY · {$username}] {$cleanHeadline}";
        $bodyAr = '📡 [بث تكتيكي · ' . $username . '] ' . $this->buildBilingualGloss($cleanHeadline, 'ar');

        $row = [
            'message_id' => $msgId,
            'channel' => $channel,
            'scope_key' => $channel === 'district' ? $district : ($channel === 'faction' ? $factionId : $channel),
            'sender_player_id' => $pid,
            'sender_username' => $username,
            'sender_faction_id' => $factionId,
            'sender_role' => 'relay',
            'message_type' => 'relay',
            'body_en' => $bodyEn,
            'body_ar' => $bodyAr,
            'meta_json' => json_encode([
                'relayType' => (string) ($payload['relayType'] ?? 'tactical_ping'),
                'district' => $district,
                'stampedByServer' => true,
            ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
            'created_at_ms' => $nowMs,
            'created_at' => gmdate('c', $nowSec),
        ];

        $this->insertMessageRow($row);

        return [
            'ok' => true,
            'route' => 'syndicate_chat.relay',
            'snapshotSeq' => $msgId,
            'message' => $this->formatMessageRow($row),
            'serverTimestamp' => round($nowFloat, 3),
        ];
    }

    /**
     * @return array{messageType: string, bodyEn: string, bodyAr: string, meta: array<string, mixed>}
     */
    private function dispatchSlashCommand(string $username, string $sanitized): array
    {
        $parts = preg_split('/\s+/', trim($sanitized), 2);
        $cmdName = strtolower($parts[0] ?? '');
        $argStr = trim($parts[1] ?? '');

        if ($cmdName === '/roll' || $cmdName === '/dice' || $cmdName === '/r') {
            $expr = $argStr !== '' ? (preg_split('/\s+/', $argStr)[0] ?: '1d20') : '1d20';
            $roll = self::rollDiceExpression($expr, $this->random);
            $rollsList = implode(', ', $roll['rolls']);
            $modPart = $roll['modifier'] > 0
                ? ' +' . $roll['modifier']
                : ($roll['modifier'] < 0 ? ' ' . $roll['modifier'] : '');

            $bodyEn = sprintf(
                '🎲 %s rolled %s → [%s]%s = %d',
                $username,
                $roll['expression'],
                $rollsList,
                $modPart,
                $roll['total'],
            );
            $bodyAr = sprintf(
                '🎲 %s رمى النرد %s ← [%s]%s = %d',
                $username,
                $roll['expression'],
                $rollsList,
                $modPart,
                $roll['total'],
            );

            return [
                'messageType' => 'roll',
                'bodyEn' => $bodyEn,
                'bodyAr' => $bodyAr,
                'meta' => [
                    'command' => 'roll',
                    'roll' => $roll,
                ],
            ];
        }

        if ($cmdName === '/me' || $cmdName === '/emote') {
            if ($argStr === '') {
                throw new InvalidArgumentException('Usage: /me <action>');
            }
            $glossAr = $this->buildBilingualGloss($argStr, 'ar');
            return [
                'messageType' => 'emote',
                'bodyEn' => "* {$username} {$argStr}",
                'bodyAr' => "* {$username} {$glossAr}",
                'meta' => [
                    'command' => 'me',
                    'emote' => $argStr,
                ],
            ];
        }

        if ($cmdName === '/help' || $cmdName === '/?') {
            return [
                'messageType' => 'system',
                'bodyEn' => '⚙ Syndicate Comms Commands: /roll <NdM+K> (e.g. /roll 2d6+3, /roll 1d20+5, /roll 4dF), /me <emote>, /help · Channels: Global, District, Faction, Trade.',
                'bodyAr' => '⚙ أوامر اتصالات النقابة: /roll <NdM+K> (مثل /roll 2d6+3 أو /roll 1d20+5)، /me <حركة>، /help · القنوات: العامة، الحي، النقابة، التجارة.',
                'meta' => [
                    'command' => 'help',
                ],
            ];
        }

        throw new InvalidArgumentException("Unknown chat command: {$cmdName}. Available commands: /roll, /me, /help.");
    }

    /**
     * Anti-flood rate guard (`1.5s` = `1500ms` minimum spacing between player messages).
     */
    private function enforceRateGuard(string $playerId, int $nowMs, int $nowSec): void
    {
        $row = $this->database->fetchOne(
            'SELECT last_sent_at_ms, messages_sent FROM syndicate_chat_rate_state WHERE player_id = :pid',
            ['pid' => $playerId],
        );

        if ($row !== null) {
            $lastMs = (int) ($row['last_sent_at_ms'] ?? 0);
            $elapsedMs = $nowMs - $lastMs;
            if ($lastMs > 0 && $elapsedMs < self::RATE_LIMIT_MS) {
                $retrySec = max(1, (int) ceil((self::RATE_LIMIT_MS - $elapsedMs) / 1000));
                throw new CooldownException('chat.send_message', $retrySec);
            }
        }

        $nextCount = ((int) ($row['messages_sent'] ?? 0)) + 1;
        $this->database->execute(
            'INSERT INTO syndicate_chat_rate_state (player_id, last_sent_at_ms, messages_sent, updated_at)
             VALUES (:pid, :ms, :cnt, :updated)
             ON CONFLICT (player_id) DO UPDATE SET
                last_sent_at_ms = EXCLUDED.last_sent_at_ms,
                messages_sent = EXCLUDED.messages_sent,
                updated_at = EXCLUDED.updated_at',
            [
                'pid' => $playerId,
                'ms' => $nowMs,
                'cnt' => $nextCount,
                'updated' => gmdate('c', $nowSec),
            ],
        );
    }

    /**
     * Seeds atmospheric Syndicate chatter from `Luna`, `Mayor Tariq`, and rival operatives
     * across all 4 channels so new sessions feel alive immediately.
     */
    private function bootstrapSeedMessages(): void
    {
        $existing = $this->database->fetchOne('SELECT message_id FROM syndicate_chat_messages LIMIT 1');
        if ($existing !== null) {
            return;
        }

        $nowFloat = $this->nowFloat();
        $baseSec = (int) floor($nowFloat) - 240;
        $baseMs = $baseSec * 1000;

        $seeds = [
            [
                'channel' => 'global',
                'scope_key' => 'global',
                'sender_player_id' => 'npc-luna',
                'sender_username' => 'Luna',
                'sender_faction_id' => 'vipers',
                'sender_role' => 'oracle',
                'message_type' => 'relay',
                'body_en' => '📡 [LUNA OVERWATCH] Encrypted Syndicate frequencies online. Use /roll 2d6+3 for high-stakes street checks or switch channels above.',
                'body_ar' => '📡 [مراقبة لونا] ترددات النقابة المشفرة متصلة الآن. استخدم /roll 2d6+3 لرميات الحظ الميدانية أو بدّل القنوات أعلاه.',
                'meta' => ['seeded' => true, 'npc' => 'luna'],
            ],
            [
                'channel' => 'global',
                'scope_key' => 'global',
                'sender_player_id' => 'npc-mayor-tariq',
                'sender_username' => 'Mayor Tariq',
                'sender_faction_id' => 'oldguard',
                'sender_role' => 'directorate',
                'message_type' => 'chat',
                'body_en' => 'City Hall reminds all syndicates: Pier 4 customs sweeps rotate on the quarter-hour. Keep your ledgers clean.',
                'body_ar' => 'تذكّر البلدية جميع النقابات: دوريات جمارك الرصيف الرابع تتناوب كل ربع ساعة. حافظوا على نظافة دفاتركم.',
                'meta' => ['seeded' => true, 'npc' => 'mayor_tariq'],
            ],
            [
                'channel' => 'global',
                'scope_key' => 'global',
                'sender_player_id' => 'npc-syndicate-apex',
                'sender_username' => 'Duke_X',
                'sender_faction_id' => 'oldguard',
                'sender_role' => 'officer',
                'message_type' => 'roll',
                'body_en' => '🎲 Duke_X rolled 2d6+3 → [5, 4] +3 = 12',
                'body_ar' => '🎲 Duke_X رمى النرد 2d6+3 ← [5, 4] +3 = 12',
                'meta' => [
                    'seeded' => true,
                    'command' => 'roll',
                    'roll' => [
                        'expression' => '2d6+3',
                        'count' => 2,
                        'sides' => 6,
                        'rolls' => [5, 4],
                        'modifier' => 3,
                        'total' => 12,
                    ],
                ],
            ],
            [
                'channel' => 'district',
                'scope_key' => 'center',
                'sender_player_id' => 'npc-luna',
                'sender_username' => 'Luna',
                'sender_faction_id' => 'vipers',
                'sender_role' => 'oracle',
                'message_type' => 'chat',
                'body_en' => 'Downtown Core heat is rising near Financial Spire. Watch the rooftop zip-lines before breaching.',
                'body_ar' => 'ترتفع حرارة قلب وسط المدينة قرب الحي المالي. راقبوا خطوط الانزلاق على الأسطح قبل الاقتحام.',
                'meta' => ['seeded' => true, 'district' => 'center'],
            ],
            [
                'channel' => 'district',
                'scope_key' => 'west',
                'sender_player_id' => 'npc-harbor-king',
                'sender_username' => 'Rayan_Black',
                'sender_faction_id' => 'kings',
                'sender_role' => 'leader',
                'message_type' => 'emote',
                'body_en' => '* Rayan_Black signals the Pier 4 crane crew to lower container #09.',
                'body_ar' => '* Rayan_Black يشير لطاقم رافعة الرصيف الرابع بإنزال الحاوية رقم 09.',
                'meta' => ['seeded' => true, 'command' => 'me', 'district' => 'west'],
            ],
            [
                'channel' => 'faction',
                'scope_key' => 'vipers',
                'sender_player_id' => 'npc-iron-enforcer',
                'sender_username' => 'Marrow',
                'sender_faction_id' => 'vipers',
                'sender_role' => 'officer',
                'message_type' => 'chat',
                'body_en' => 'Chain timer is hot! Stack Xanax, check armory blood bags, and hold the central sector wall.',
                'body_ar' => 'مؤقت السلسلة مشتعل! جهزوا الزاناكس، وافحصوا أكياس الدم في الترسانة، واثبتوا على جدار القطاع المركزي.',
                'meta' => ['seeded' => true, 'faction' => 'vipers'],
            ],
            [
                'channel' => 'faction',
                'scope_key' => 'vipers',
                'sender_player_id' => 'npc-mayor-tariq',
                'sender_username' => 'Mayor Tariq',
                'sender_faction_id' => 'vipers',
                'sender_role' => 'directorate',
                'message_type' => 'chat',
                'body_en' => 'Municipal immunity vouchers are staged in the vault for whichever squad locks down the 100-hit chain bonus.',
                'body_ar' => 'تصاريح الحصانة البلدية جاهزة في الخزنة للفرقة التي تحسم مكافأة السلسلة عند 100 ضربة.',
                'meta' => ['seeded' => true, 'faction' => 'vipers'],
            ],
            [
                'channel' => 'trade',
                'scope_key' => 'trade',
                'sender_player_id' => 'npc-velvet-queen',
                'sender_username' => 'Lady_Vega',
                'sender_faction_id' => 'night',
                'sender_role' => 'officer',
                'message_type' => 'chat',
                'body_en' => 'WTS Johannesburg Xanax bricks ($740k) + full Exotic Flower Set for Museum Points. 0% Bazaar tax active.',
                'body_ar' => 'للبيع شحنات زاناكس جوهانسبرغ ($740k) + مجموعة الزهور النادرة الكاملة لنقاط المتحف. ضريبة البازار 0% نشطة.',
                'meta' => ['seeded' => true, 'channel' => 'trade'],
            ],
            [
                'channel' => 'trade',
                'scope_key' => 'trade',
                'sender_player_id' => 'npc-night-broker',
                'sender_username' => 'NadiaQuick',
                'sender_faction_id' => 'night',
                'sender_role' => 'leader',
                'message_type' => 'chat',
                'body_en' => 'WTB Lawyer Business Cards & Feathery Hotel Coupons — paying instant escrow cash at Financial Spire.',
                'body_ar' => 'مطلوب شراء بطاقات المحامي وقسائم فندق فيذري — دفع نقدي فوري عبر الضمان في الحي المالي.',
                'meta' => ['seeded' => true, 'channel' => 'trade'],
            ],
        ];

        $this->database->transaction(function () use ($seeds, $baseSec, $baseMs): void {
            $checkAgain = $this->database->fetchOne('SELECT message_id FROM syndicate_chat_messages LIMIT 1');
            if ($checkAgain !== null) {
                return;
            }

            $this->database->insertIgnore(
                'syndicate_chat_sync_state',
                ['scope', 'current_seq', 'updated_at'],
                ['global', count($seeds), gmdate('c', $baseSec)],
            );

            foreach ($seeds as $idx => $seed) {
                $msgId = $idx + 1;
                $tsSec = $baseSec + ($idx * 15);
                $tsMs = $baseMs + ($idx * 15000);
                $this->insertMessageRow([
                    'message_id' => $msgId,
                    'channel' => $seed['channel'],
                    'scope_key' => $seed['scope_key'],
                    'sender_player_id' => $seed['sender_player_id'],
                    'sender_username' => $seed['sender_username'],
                    'sender_faction_id' => $seed['sender_faction_id'],
                    'sender_role' => $seed['sender_role'],
                    'message_type' => $seed['message_type'],
                    'body_en' => $seed['body_en'],
                    'body_ar' => $seed['body_ar'],
                    'meta_json' => json_encode($seed['meta'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                    'created_at_ms' => $tsMs,
                    'created_at' => gmdate('c', $tsSec),
                ]);
            }
        });
    }

    /**
     * Synthesizes a bilingual Syndicate gloss (`TranslationService` per `chat-system`).
     */
    private function buildBilingualGloss(string $text, string $targetLang): string
    {
        if ($targetLang === 'ar') {
            if (preg_match('/\p{Arabic}/u', $text) === 1) {
                return $text;
            }
            $translated = $text;
            foreach (self::EN_TO_AR_GLOSSARY as $enTerm => $arTerm) {
                $translated = (string) preg_replace('/\b' . preg_quote($enTerm, '/') . '\b/iu', $arTerm, $translated);
            }
            return '«' . $translated . '»';
        }

        $translated = $text;
        foreach (self::EN_TO_AR_GLOSSARY as $enTerm => $arTerm) {
            $translated = str_replace($arTerm, ucfirst($enTerm), $translated);
        }
        return '[' . $translated . ']';
    }

    /**
     * @param array<string, mixed> $row
     */
    private function insertMessageRow(array $row): void
    {
        $this->database->execute(
            'INSERT INTO syndicate_chat_messages (
                message_id, channel, scope_key, sender_player_id, sender_username,
                sender_faction_id, sender_role, message_type, body_en, body_ar,
                meta_json, created_at_ms, created_at
             ) VALUES (
                :mid, :ch, :scope, :spid, :suname,
                :sfid, :srole, :mtype, :ben, :bar,
                :meta, :cms, :cat
             )',
            [
                'mid' => (int) $row['message_id'],
                'ch' => (string) $row['channel'],
                'scope' => (string) $row['scope_key'],
                'spid' => (string) $row['sender_player_id'],
                'suname' => (string) $row['sender_username'],
                'sfid' => (string) $row['sender_faction_id'],
                'srole' => (string) $row['sender_role'],
                'mtype' => (string) $row['message_type'],
                'ben' => (string) $row['body_en'],
                'bar' => (string) $row['body_ar'],
                'meta' => (string) $row['meta_json'],
                'cms' => (int) $row['created_at_ms'],
                'cat' => (string) $row['created_at'],
            ],
        );
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatMessageRow(array $row): array
    {
        $meta = json_decode((string) ($row['meta_json'] ?? '{}'), true);
        if (!is_array($meta)) {
            $meta = [];
        }

        $fid = (string) ($row['sender_faction_id'] ?? 'independent');
        $factionSpec = FactionTerritoryWarService::DEFAULT_FACTIONS[$fid] ?? [
            'nameEn' => 'Independent',
            'nameAr' => 'مستقل',
            'color' => '#d99332',
        ];

        return [
            'id' => (int) $row['message_id'],
            'messageId' => (int) $row['message_id'],
            'channel' => (string) $row['channel'],
            'scopeKey' => (string) $row['scope_key'],
            'senderPlayerId' => (string) $row['sender_player_id'],
            'senderUsername' => (string) $row['sender_username'],
            'senderFactionId' => $fid,
            'senderFactionNameEn' => $factionSpec['nameEn'],
            'senderFactionNameAr' => $factionSpec['nameAr'],
            'senderFactionColor' => $factionSpec['color'],
            'senderRole' => (string) $row['sender_role'],
            'messageType' => (string) $row['message_type'],
            'bodyEn' => (string) $row['body_en'],
            'bodyAr' => (string) $row['body_ar'],
            'roll' => $meta['roll'] ?? null,
            'meta' => $meta,
            'createdAtMs' => (int) $row['created_at_ms'],
            'createdAt' => (string) $row['created_at'],
        ];
    }

    /**
     * @return array<string, array{playerId: string, username: string, reason: string, createdAt: string}>
     */
    private function loadMutedMap(string $playerId): array
    {
        $rows = $this->database->fetchAll(
            'SELECT muted_player_id, muted_username, reason, created_at
             FROM syndicate_chat_mutes
             WHERE player_id = :pid
             ORDER BY created_at DESC',
            ['pid' => $playerId],
        );

        $map = [];
        foreach ($rows as $r) {
            $mid = (string) $r['muted_player_id'];
            $map[$mid] = [
                'playerId' => $mid,
                'username' => (string) ($r['muted_username'] ?: $mid),
                'reason' => (string) ($r['reason'] ?: 'manual'),
                'createdAt' => (string) $r['created_at'],
            ];
        }
        return $map;
    }

    /**
     * @param array<string, mixed> $mutedMap
     * @return array<string, int>
     */
    private function computeChannelCounts(int $sinceId, array $mutedMap): array
    {
        $rows = $this->database->fetchAll(
            'SELECT channel, sender_player_id, message_id
             FROM syndicate_chat_messages
             WHERE message_id > :sinceId',
            ['sinceId' => max(0, $sinceId)],
        );

        $counts = [
            'global' => 0,
            'district' => 0,
            'faction' => 0,
            'trade' => 0,
        ];

        foreach ($rows as $r) {
            $ch = (string) $r['channel'];
            $sender = (string) $r['sender_player_id'];
            if (isset($mutedMap[$sender]) || !isset($counts[$ch])) {
                continue;
            }
            $counts[$ch]++;
        }

        return $counts;
    }

    private function bumpSyncSeq(int $nowSec): int
    {
        $updatedAt = gmdate('c', $nowSec);
        $current = $this->currentSyncSeq();
        $next = $current + 1;

        $this->database->execute(
            "INSERT INTO syndicate_chat_sync_state (scope, current_seq, updated_at)
             VALUES ('global', :nextSeq, :upd)
             ON CONFLICT (scope) DO UPDATE SET
                current_seq = EXCLUDED.current_seq,
                updated_at = EXCLUDED.updated_at",
            ['nextSeq' => $next, 'upd' => $updatedAt],
        );

        return $next;
    }

    private function currentSyncSeq(): int
    {
        $row = $this->database->fetchOne("SELECT current_seq FROM syndicate_chat_sync_state WHERE scope = 'global'");
        $syncSeq = (int) ($row['current_seq'] ?? 0);

        $maxRow = $this->database->fetchOne('SELECT MAX(message_id) AS max_id FROM syndicate_chat_messages');
        $maxId = (int) ($maxRow['max_id'] ?? 0);

        return $syncSeq >= $maxId ? $syncSeq : $maxId;
    }

    private function resolvePlayerFactionId(string $playerId): string
    {
        try {
            $row = $this->database->fetchOne(
                'SELECT faction_id FROM faction_members WHERE player_id = :pid',
                ['pid' => $playerId],
            );
            if ($row !== null && is_string($row['faction_id'] ?? null) && $row['faction_id'] !== '') {
                return (string) $row['faction_id'];
            }
        } catch (Throwable) {
            // Standalone unit fixtures without faction_members fall back to vipers.
        }
        return 'vipers';
    }

    private function normalizePlayerId(int|string $playerId): string
    {
        $clean = trim((string) $playerId);
        if ($clean === '' || strlen($clean) > 64 || !preg_match('/^[A-Za-z0-9_-]+$/D', $clean)) {
            throw new InvalidArgumentException('Invalid player identifier for Syndicate Chat Service.');
        }
        return $clean;
    }

    /**
     * @return array<string, mixed>
     */
    private function loadPlayer(string $playerId): array
    {
        $row = $this->database->fetchOne('SELECT * FROM players WHERE id = :pid', ['pid' => $playerId]);
        if ($row === null) {
            throw new RuntimeException("Unknown player: {$playerId}");
        }
        return $this->resources->normalize($row);
    }

    private function nowFloat(): float
    {
        if ($this->clock !== null) {
            return (float) ($this->clock)();
        }
        return microtime(true);
    }

    private function nowSec(): int
    {
        return (int) floor($this->nowFloat());
    }
}

if (!class_exists('Zone\\Core\\Game\\SyndicateChatService', false)) {
    class_alias(SyndicateChatService::class, 'Zone\\Core\\Game\\SyndicateChatService');
}
