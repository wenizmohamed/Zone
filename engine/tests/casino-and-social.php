<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Zone\Engine\Core\Persistence\Database;

$isTempSqlite = !getenv('ZONE_DEPTH_TEST_URL');
$tempPath = ZONE_ENGINE_ROOT . '/var/casino-and-social-' . bin2hex(random_bytes(6)) . '.sqlite';
$url = getenv('ZONE_DEPTH_TEST_URL') ?: 'sqlite:' . $tempPath;
if (!str_starts_with($url, 'sqlite:')) {
    $target = parse_url($url);
    if (($target['host'] ?? '') !== '127.0.0.1' || !preg_match('~^/zone_beta_smoke_[a-z0-9_]+$~D', $target['path'] ?? '')) {
        throw new RuntimeException('Disposable loopback database required.');
    }
}

$engine = zone_engine($url);
$db = Database::connect($url);
$passed = 0;

function csAssert(bool $ok, string $label): void
{
    global $passed;
    if (!$ok) {
        throw new RuntimeException('FAIL: ' . $label);
    }
    ++$passed;
    echo 'PASS: ' . $label . PHP_EOL;
}

function csReject(callable $fn): bool
{
    try {
        $fn();
    } catch (RuntimeException|InvalidArgumentException $e) {
        if ($e instanceof PDOException) {
            throw $e;
        }
        return true;
    }
    return false;
}

function csNewOperative(string $tag, int $cash = 100000, int $power = 400): string
{
    global $engine, $db;
    $pid = $engine->browserSessions()->create($tag . '-' . bin2hex(random_bytes(5)))['playerId'];
    $uname = ucfirst($tag) . '_' . substr(bin2hex(random_bytes(3)), 0, 5);
    $db->execute(
        'UPDATE players SET username = :u, cash = :cash, energy = 100, max_energy = 100, life = 1500, max_life = 1500, strength = :p, defense = :p, speed = :p, dexterity = :p, resources_updated_at = :at WHERE id = :id',
        ['u' => $uname, 'cash' => $cash, 'p' => $power, 'at' => gmdate('c', time() + 3600), 'id' => $pid],
    );
    return $pid;
}

try {
    $pA = csNewOperative('Alpha', 150000, 350);
    $pB = csNewOperative('Bravo', 120000, 220);
    $pC = csNewOperative('Hunter', 90000, 3500);

    // 0. Legacy 1-arg Blackjack compatibility
    $cashBBefore = (int) $engine->player($pB)['cash'];
    $legacyBj = $engine->playBlackjack(500, $pB);
    csAssert(in_array($legacyBj['result'], ['win', 'lose', 'push'], true) && (int) $legacyBj['player']['cash'] === $cashBBefore + (int) $legacyBj['delta'], 'Legacy 1-arg playBlackjack settles 52-card shoe and matches cash delta');

    // 1. Interactive Blackjack 21 (deal -> stand)
    $cashBefore = (int) $engine->player($pA)['cash'];
    $deal = $engine->playBlackjack(2000, $pA, 'deal');
    csAssert(in_array($deal['status'], ['playing', 'settled'], true), 'Interactive Blackjack deal returns playing or natural settled status');
    if ($deal['status'] === 'playing') {
        csAssert((int) $deal['player']['cash'] === $cashBefore - 2000, 'Blackjack deal escrows ante immediately');
        csAssert(!empty($deal['dealerCards'][1]['hidden']), 'Dealer hole card is hidden on server during active hand');
        $settled = $engine->playBlackjack(2000, $pA, 'stand');
        csAssert($settled['status'] === 'settled' && in_array($settled['result'], ['win', 'lose', 'push'], true), 'Standing settles interactive Blackjack hand');
        csAssert(empty($settled['dealerCards'][1]['hidden']), 'Dealer hole card is revealed after settlement');
        csAssert((int) $settled['player']['cash'] === $cashBefore + (int) $settled['delta'], 'Settled Blackjack cash matches net delta');
    } else {
        csAssert((int) $deal['player']['cash'] === $cashBefore + (int) $deal['delta'], 'Natural 21 deal settles cash accurately');
    }

    // 2. European Roulette
    $cashBeforeRoulette = (int) $engine->player($pA)['cash'];
    $spin = $engine->playRoulette(1500, 'red', null, $pA);
    csAssert($spin['pocket'] >= 0 && $spin['pocket'] <= 36, 'European Roulette spins pocket 0..36');
    csAssert(in_array($spin['color'], ['red', 'black', 'green'], true), 'Roulette pocket maps to canonical color');
    csAssert((int) $spin['player']['cash'] === $cashBeforeRoulette + (int) $spin['delta'], 'Roulette settles player cash authoritatively');
    csAssert(count($spin['recentSpins']) >= 1, 'Roulette records recent spins history');

    // 3. Progressive Jackpot Slots
    $slotsInit = $engine->slotsState($pA);
    $cashBeforeSlots = (int) $engine->player($pA)['cash'];
    $slotSpin = $engine->playSlots(1000, $pA);
    csAssert(count($slotSpin['reels']) === 3, 'Slots returns 3 server-rolled reels');
    csAssert((int) $slotSpin['player']['cash'] === $cashBeforeSlots + (int) $slotSpin['delta'], 'Slots settles cash accurately');
    csAssert($slotSpin['hitJackpot'] || (int) $slotSpin['jackpotPool'] > (int) $slotsInit['jackpotPool'], 'Slots increments progressive jackpot pool on non-jackpot spin');

    // 4. Shared Cross-Player Syndicate Chat & Direct Mail
    $msgToken = 'Wire check ' . bin2hex(random_bytes(4));
    $engine->socialAction(['action' => 'chat.send', 'channel' => 'global', 'message' => $msgToken], $pA);
    $snapB = $engine->socialSnapshot($pB);
    $globalTexts = array_column($snapB['chat']['global'], 'text');
    csAssert(in_array($msgToken, $globalTexts, true), 'Player B receives Player A live Global Chat message from shared server log');

    $nameB = (string) $engine->player($pB)['username'];
    $mailRes = $engine->socialAction([
        'action' => 'mail.send',
        'recipient' => $nameB,
        'subject' => 'Harbor Coordinates',
        'body' => 'Meet at Pier 9 at midnight.',
    ], $pA);
    $inboxB = $engine->socialSnapshot($pB)['mail'];
    $foundMail = array_values(array_filter($inboxB['inbox'], static fn (array $m): bool => $m['id'] === $mailRes['mailId']));
    csAssert(count($foundMail) === 1 && $foundMail[0]['read'] === false, 'Player B receives unread Direct Mail from Player A');
    $afterRead = $engine->socialAction(['action' => 'mail.read', 'mailId' => $mailRes['mailId']], $pB)['social']['mail'];
    $foundAfterRead = array_values(array_filter($afterRead['inbox'], static fn (array $m): bool => $m['id'] === $mailRes['mailId']));
    csAssert($foundAfterRead[0]['read'] === true, 'Player B marks Direct Mail dispatch as read');

    // 5. Shared City Bounty Escrow + Hunter Takedown Claim
    $cashABeforeBounty = (int) $engine->player($pA)['cash'];
    $placed = $engine->socialAction([
        'action' => 'bounty.place',
        'target' => $nameB,
        'rewardCash' => 15000,
        'reason' => 'Stolen shipment',
    ], $pA);
    $bountyId = (string) $placed['bounty']['id'];
    csAssert((int) $placed['player']['cash'] === $cashABeforeBounty - 15000, 'Placing a bounty escrows $15,000 from funder immediately');
    csAssert(csReject(static fn () => $engine->socialAction(['action' => 'bounty.claim', 'bountyId' => $bountyId], $pA)), 'Funder cannot self-claim their own bounty escrow');
    csAssert(csReject(static fn () => $engine->socialAction(['action' => 'bounty.claim', 'bountyId' => $bountyId], $pB)), 'Target cannot self-claim a bounty on themselves');

    $cashCBefore = (int) $engine->player($pC)['cash'];
    $claimed = $engine->socialAction(['action' => 'bounty.claim', 'bountyId' => $bountyId], $pC);
    csAssert($claimed['outcome'] === 'claimed' && $claimed['won'] === true, 'High-power Hunter claims active bounty contract');
    csAssert((int) $claimed['player']['cash'] === $cashCBefore + 15000, 'Hunter receives full $15,000 escrowed bounty reward');
    csAssert((int) $claimed['player']['energy'] === 85, 'Hunting a bounty spends 15 Energy');
    $chronicleCats = array_column($claimed['social']['chronicle'], 'category');
    csAssert(in_array('HITLIST', $chronicleCats, true), 'City Chronicle records live HITLIST takedown headline');

    echo 'CASINO AND SOCIAL RESULT: ' . $passed . ' passed, 0 failed (' . $db->driver() . ')' . PHP_EOL;
} finally {
    unset($engine, $db);
    if ($isTempSqlite && is_file($tempPath)) {
        @unlink($tempPath);
    }
}
