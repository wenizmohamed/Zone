<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\CooldownException;
use Zone\Engine\Core\Game\SyndicateChatService;
use Zone\Engine\Core\Persistence\Database;

$databasePath = dirname(__DIR__) . '/var/test-syndicate-chat-' . bin2hex(random_bytes(6)) . '.sqlite';
$passed = 0;
$failed = 0;

function check(bool $condition, string $message): void
{
    global $passed, $failed;
    if (!$condition) {
        $failed++;
        fwrite(STDERR, "FAIL: {$message}\n");
        return;
    }
    $passed++;
    fwrite(STDOUT, "PASS: {$message}\n");
}

try {
    check(version_compare(PHP_VERSION, '8.5.0', '>='), 'PHP 8.5+ runtime verified (' . PHP_VERSION . ')');
    check(
        class_exists(\Zone\Engine\Core\Game\SyndicateChatService::class)
        && class_exists(\Zone\Core\Game\SyndicateChatService::class),
        'Both Zone\\Engine\\Core\\Game and Zone\\Core\\Game SyndicateChatService namespaces autoload cleanly',
    );

    // =========================================================================
    // 1. Dice Roller Skill Math (`/roll 2d6+3`, `1d20+5`, `3d8-2`, `4dF`, `d100`)
    // =========================================================================
    $detRoll = SyndicateChatService::rollDiceExpression(
        '2d6+3',
        static fn (int $min, int $max): int => 4,
    );
    check(
        $detRoll['expression'] === '2d6+3'
        && $detRoll['rolls'] === [4, 4]
        && $detRoll['modifier'] === 3
        && $detRoll['total'] === 11,
        'Cryptographic /roll 2d6+3 evaluates individual rolls [4, 4], modifier +3, and total 11',
    );

    $fudgeRoll = SyndicateChatService::rollDiceExpression(
        '4dF',
        static fn (int $min, int $max): int => 1,
    );
    check(
        $fudgeRoll['expression'] === '4dF'
        && count($fudgeRoll['rolls']) === 4
        && $fudgeRoll['total'] === 4,
        'Fudge dice expression 4dF supported per dice-roller skill',
    );

    $d100Roll = SyndicateChatService::rollDiceExpression('d100');
    check(
        $d100Roll['expression'] === '1d100'
        && $d100Roll['total'] >= 1
        && $d100Roll['total'] <= 100,
        'Percentile d100 roll evaluates within 1..100 bounds',
    );

    // =========================================================================
    // 2. Decorator Pipeline: Control-Char, XSS & Length (<= 280) Sanitization
    // =========================================================================
    $xssCleaned = SyndicateChatService::sanitizeMessageText(
        "Hello \u{2410}\u{2406}<script>alert('xss')</script> <b>Pier 4</b> javascript:void(0) onerror=hack()"
    );
    check(
        !str_contains($xssCleaned, '<script')
        && !str_contains($xssCleaned, 'javascript:')
        && !str_contains($xssCleaned, 'onerror=')
        && !str_contains($xssCleaned, "\u{2410}")
        && str_contains($xssCleaned, 'Pier 4'),
        'Message sanitizer strips forbidden control chars, <script> tags, and XSS attributes while preserving text',
    );

    $tooLongRejected = false;
    try {
        SyndicateChatService::sanitizeMessageText(str_repeat('A', 281));
    } catch (InvalidArgumentException) {
        $tooLongRejected = true;
    }
    check($tooLongRejected, 'Message sanitizer rejects payloads exceeding 280 characters');

    // =========================================================================
    // 3. Database Integration: Seeded Chatter (Luna, Mayor Tariq, Rivals), 4 Channels & Delta Sync
    // =========================================================================
    $database = Database::connect('sqlite:' . $databasePath);
    $database->migrateAndSeed();
    $events = new EventBus($database);

    $virtualClock = 1_700_000_000.0;
    $chatService = new SyndicateChatService(
        $database,
        $events,
        static fn (int $min, int $max): int => 5,
        static function () use (&$virtualClock): float {
            return $virtualClock;
        },
    );

    $snapGlobal = $chatService->snapshot('founder-player', 'global');
    $sendersGlobal = array_column($snapGlobal['messages'], 'senderUsername');
    check(
        $snapGlobal['ok'] === true
        && $snapGlobal['deltaCompressed'] === false
        && in_array('Luna', $sendersGlobal, true)
        && in_array('Mayor Tariq', $sendersGlobal, true)
        && count($snapGlobal['channelsCatalog']) === 4,
        'Initial global snapshot seeds atmospheric chatter from Luna, Mayor Tariq, and rival operatives across 4 channels',
    );

    // Verify delta-seq polling returns 0 messages when nothing new was posted
    $baseSeq = (int) $snapGlobal['latestId'];
    $deltaEmpty = $chatService->snapshot('founder-player', 'global', $baseSeq);
    check(
        $deltaEmpty['deltaCompressed'] === true
        && count($deltaEmpty['messages']) === 0,
        'Delta-seq polling (sinceId = latestId) transmits zero redundant unchanged messages',
    );

    // =========================================================================
    // 4. Send Message, Anti-Flood 1.5s Rate Guard, /roll, /me, /help & int|string $playerId
    // =========================================================================
    $sendRes = $chatService->act('founder-player', 'send_message', [
        'channel' => 'global',
        'message' => 'Pier 4 Xanax convoy ready for Downtown raid!',
    ]);
    check(
        $sendRes['ok'] === true
        && $sendRes['message']['messageType'] === 'chat'
        && str_contains($sendRes['message']['bodyAr'], 'الرصيف الرابع')
        && str_contains($sendRes['message']['bodyAr'], 'زاناكس'),
        'Sending a message runs TranslationGloss decorator and produces bilingual EN + AR gloss',
    );

    // Immediate second message within 1.5s triggers Anti-Flood Rate Guard (CooldownException)
    $floodBlocked = false;
    try {
        $chatService->sendMessage('founder-player', [
            'channel' => 'global',
            'message' => 'Spam message 200ms later',
        ]);
    } catch (CooldownException $cdEx) {
        $floodBlocked = $cdEx->action === 'chat.send_message' && $cdEx->retryAfter >= 1;
    }
    check($floodBlocked, 'Anti-flood 1.5s rate guard blocks rapid-fire chat spam with CooldownException');

    // Advance virtual clock by 2.0s and test /roll 2d6+3 command
    $virtualClock += 2.0;
    $rollCmdRes = $chatService->sendMessage('founder-player', [
        'channel' => 'faction',
        'message' => '/roll 2d6+3',
    ]);
    check(
        $rollCmdRes['ok'] === true
        && $rollCmdRes['message']['messageType'] === 'roll'
        && $rollCmdRes['roll']['expression'] === '2d6+3'
        && $rollCmdRes['roll']['rolls'] === [5, 5]
        && $rollCmdRes['roll']['total'] === 13,
        'Slash command /roll 2d6+3 dispatches through CommandsHandleChatMessageBus and records server-authoritative dice roll',
    );

    // Advance clock and test /me emote command with integer $playerId
    $database->insertIgnore(
        'players',
        ['id', 'username', 'level', 'xp', 'cash', 'energy', 'nerve', 'life', 'happy', 'max_energy', 'max_nerve', 'max_life', 'max_happy', 'resources_updated_at', 'strength', 'defense', 'speed', 'dexterity', 'bank_balance', 'city', 'login_streak', 'last_login_day'],
        ['77', 'Operative77', 12, 3200, 50000, 100, 45, 900, 500, 100, 45, 900, 500, gmdate('c'), 250, 250, 250, 250, 0, 'Zone City', 1, gmdate('Y-m-d')],
    );
    $emoteRes = $chatService->sendMessage(77, [
        'channel' => 'district',
        'district' => 'west',
        'message' => '/me secures the Pier 4 crane controls.',
    ]);
    check(
        $emoteRes['ok'] === true
        && $emoteRes['message']['messageType'] === 'emote'
        && $emoteRes['message']['senderPlayerId'] === '77'
        && str_starts_with($emoteRes['message']['bodyEn'], '* Operative77'),
        'Slash command /me works with integer $playerId (77) and formats emote message',
    );

    // Test /help command
    $virtualClock += 2.0;
    $helpRes = $chatService->sendMessage('founder-player', [
        'channel' => 'global',
        'message' => '/help',
    ]);
    check(
        $helpRes['ok'] === true
        && $helpRes['message']['messageType'] === 'system'
        && str_contains($helpRes['message']['bodyEn'], '/roll'),
        'Slash command /help outputs system command reference',
    );

    // Delta snapshot after new messages returns only messages > $baseSeq
    $deltaNew = $chatService->snapshot('founder-player', 'global', $baseSeq);
    check(
        $deltaNew['deltaCompressed'] === true
        && count($deltaNew['messages']) === 2,
        'Delta-seq snapshot returns only the 2 newly added global messages since baseSeq',
    );

    // =========================================================================
    // 5. Per-Player Mute List (`mute_sender` & `unmute_sender`) & Relay Broadcast
    // =========================================================================
    $muteRes = $chatService->act('founder-player', 'mute_sender', [
        'mutedPlayerId' => 'npc-mayor-tariq',
        'mutedUsername' => 'Mayor Tariq',
    ]);
    $snapAfterMute = $chatService->snapshot('founder-player', 'global');
    $sendersAfterMute = array_column($snapAfterMute['messages'], 'senderPlayerId');
    check(
        $muteRes['ok'] === true
        && in_array('npc-mayor-tariq', $muteRes['mutedPlayerIds'], true)
        && !in_array('npc-mayor-tariq', $sendersAfterMute, true)
        && $snapAfterMute['filteredMutedCount'] >= 1,
        'Muting a sender persists to syndicate_chat_mutes and filters their messages from player snapshots',
    );

    $unmuteRes = $chatService->act('founder-player', 'unmute_sender', [
        'mutedPlayerId' => 'npc-mayor-tariq',
    ]);
    $snapAfterUnmute = $chatService->snapshot('founder-player', 'global');
    $sendersAfterUnmute = array_column($snapAfterUnmute['messages'], 'senderPlayerId');
    check(
        $unmuteRes['ok'] === true
        && !in_array('npc-mayor-tariq', $unmuteRes['mutedPlayerIds'], true)
        && in_array('npc-mayor-tariq', $sendersAfterUnmute, true),
        'Unmuting a sender restores their messages in subsequent snapshots',
    );

    $relayRes = $chatService->relayBroadcast('founder-player', [
        'channel' => 'faction',
        'district' => 'center',
        'headline' => 'Chain hit #50 reached in Downtown Core!',
    ]);
    check(
        $relayRes['ok'] === true
        && $relayRes['message']['messageType'] === 'relay'
        && str_contains($relayRes['message']['bodyEn'], '[RELAY'),
        'MMO Action Relay broadcast stamps server relay message into target channel',
    );

    // =========================================================================
    // 6. Static SQL Dual-Law Audit + Frontend UI Contract Audit
    // =========================================================================
    $serviceSource = (string) file_get_contents(dirname(__DIR__) . '/src/Core/Game/SyndicateChatService.php');
    $codeWithoutComments = '';
    foreach (token_get_all($serviceSource) as $tok) {
        if (is_array($tok) && in_array($tok[0], [T_COMMENT, T_DOC_COMMENT], true)) {
            continue;
        }
        $codeWithoutComments .= is_array($tok) ? $tok[1] : $tok;
    }
    check(
        preg_match('/\b(?:MAX|MIN)\s*\([^,)]+,[^)]+\)/', $codeWithoutComments) !== 1,
        'SQL Dual Law: Zero 2-argument SQLite scalar MAX(a,b)/MIN(a,b) calls in SQL',
    );

    preg_match_all('/(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE)[\s\S]*?(?:\'\s*,|"\s*,|\'\s*\)|"\s*\))/', $codeWithoutComments, $sqlBlocks);
    $duplicateParamFound = false;
    foreach ($sqlBlocks[0] as $sqlBlock) {
        if (preg_match_all('/:[a-zA-Z_][a-zA-Z0-9_]*/', $sqlBlock, $pMatches)) {
            $counts = array_count_values($pMatches[0]);
            foreach ($counts as $cnt) {
                if ($cnt > 1) {
                    $duplicateParamFound = true;
                }
            }
        }
    }
    check(!$duplicateParamFound, 'SQL Dual Law: Every SQL statement uses strictly unique named PDO parameters');

    $jsSource = (string) file_get_contents(dirname(__DIR__, 2) . '/assets/ui/zone-chat-system.js');
    $cssSource = (string) file_get_contents(dirname(__DIR__, 2) . '/assets/ui/zone-chat-system.css');
    check(
        str_contains($jsSource, 'window.ZoneChatSystem')
        && str_contains($jsSource, 'ztl-hud-inner')
        && str_contains($jsSource, 'zcs-dice-badge')
        && str_contains($jsSource, 'toggle-msg-gloss')
        && str_contains($jsSource, 'mute-player')
        && str_contains($cssSource, '#ztl-hud-inner #zcs-hud-chat-btn'),
        'Frontend assets/ui/zone-chat-system.{js,css} dock inline inside #ztl-hud-inner and expose 4-channel drawer, /roll dice badges, EN/AR gloss toggle & mute controls',
    );
    check(
        !str_contains($cssSource, 'bottom: 20px') && !str_contains($cssSource, 'bottom: 16px'),
        'Zero floating bottom-fixed chat widgets (strictly inline #ztl-hud-inner pill + slide-over drawer)',
    );
} finally {
    foreach (['', '-wal', '-shm'] as $suffix) {
        $file = $databasePath . $suffix;
        if (is_file($file)) {
            @unlink($file);
        }
    }
}

fwrite(STDOUT, "\nSyndicateChatTest Summary: {$passed} passed, {$failed} failed.\n");
exit($failed > 0 ? 1 : 0);
