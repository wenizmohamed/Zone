<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Security\BrowserSessions;
use Zone\Engine\Core\Game\ProgressionService;
use Zone\Engine\Core\Game\PlayerMarketService;

$url = getenv('ZONE_DEPTH_TEST_URL') ?: 'sqlite:' . ZONE_ENGINE_ROOT . '/var/player-market-' . bin2hex(random_bytes(6)) . '.sqlite';
if (!str_starts_with($url, 'sqlite:')) {
    $parts = parse_url($url);
    if (($parts['host'] ?? '') !== '127.0.0.1' || !preg_match('~^/zone_beta_smoke_[a-z0-9_]+$~D', $parts['path'] ?? '')) throw new RuntimeException('Disposable local test database required.');
}
$db = Database::connect($url); $db->migrateAndSeed(); $events = new EventBus($db);
$service = new PlayerMarketService($db, $events);
if (($argv[1] ?? '') === '--market-worker') {
    echo "READY\n"; fflush(STDOUT);
    if (trim((string) fgets(STDIN)) !== 'GO') throw new RuntimeException('Market worker barrier was not released.');
    echo "ATTEMPTING\n"; fflush(STDOUT);
    try {
        $settled = $service->act($argv[2], $argv[3], (int) $argv[4], 0, (int) $argv[5], $argv[6]);
        echo json_encode(['status' => 'ok', 'actor' => $argv[6], 'result' => $settled['result']], JSON_THROW_ON_ERROR) . "\n";
    } catch (RuntimeException $error) {
        if (!str_contains($error->getMessage(), 'changed') && !str_contains($error->getMessage(), 'no longer available')) throw $error;
        echo json_encode(['status' => 'stale', 'actor' => $argv[6], 'message' => $error->getMessage()], JSON_THROW_ON_ERROR) . "\n";
    }
    exit(0);
}
$sessions = new BrowserSessions($db);
$seller = $sessions->create('seller-' . bin2hex(random_bytes(6)))['playerId'];
$buyer = $sessions->create('buyer-' . bin2hex(random_bytes(6)))['playerId'];
$count = 0;
function marketProof(bool $ok, string $name): void { global $count; if (!$ok) throw new RuntimeException('FAIL: ' . $name); $count++; echo 'PASS: ' . $name . PHP_EOL; }
function marketReject(callable $call, string $name): void { try { $call(); } catch (InvalidArgumentException|RuntimeException $e) { marketProof(true, $name); return; } throw new RuntimeException('FAIL: ' . $name); }
function marketRace(string $id, int $version, array $actions, array $lockIds): array {
    global $db, $url;
    $workers = [];
    // Initialize both children before taking participant locks, so schema
    // setup cannot be mistaken for waiting inside authoritative settlement.
    foreach ($actions as [$action, $actor]) {
        $worker = proc_open([PHP_BINARY, '-d', 'extension=pdo_pgsql', __FILE__, '--market-worker', $action, $id, '1', (string) $version, $actor], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, ZONE_REPOSITORY_ROOT, [...getenv(), 'ZONE_DEPTH_TEST_URL' => $url], ['bypass_shell' => true]);
        if (!is_resource($worker)) throw new RuntimeException('Market worker did not start.');
        stream_set_timeout($pipes[1], 10);
        if (trim((string) fgets($pipes[1])) !== 'READY') throw new RuntimeException('Market worker failed readiness: ' . stream_get_contents($pipes[2]));
        $workers[] = [$worker, $pipes];
    }
    $db->playersTransaction($lockIds, function () use ($workers, $actions): void {
        foreach ($workers as [$worker, $pipes]) { fwrite($pipes[0], "GO\n"); fflush($pipes[0]); }
        foreach ($workers as [$worker, $pipes]) if (trim((string) fgets($pipes[1])) !== 'ATTEMPTING') throw new RuntimeException('Market worker failed attempt barrier.');
        usleep(150000);
        foreach ($workers as [$worker]) if (!proc_get_status($worker)['running']) throw new RuntimeException('Market request did not wait on parent-held participant locks.');
        marketProof(true, 'both market requests attempt while participant locks are held (' . implode('/', array_column($actions, 0)) . ')');
    });
    $results = [];
    foreach ($workers as [$worker, $pipes]) {
        $line = (string) fgets($pipes[1]); $error = stream_get_contents($pipes[2]);
        foreach ($pipes as $pipe) fclose($pipe);
        $exit = proc_close($worker);
        if ($exit !== 0 || trim($line) === '') throw new RuntimeException('Market race worker failed: ' . $line . $error);
        $results[] = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
    }
    return $results;
}
$locked = $db->playersTransaction([$seller, $buyer, $seller], fn() => true);
marketProof($locked, 'two-player transaction handles canonical unique identities');
$progress = new ProgressionService($db, $events);
$progress->grantItem($seller, 'bat', 2);
$start = $progress->snapshot($seller);
$service = new PlayerMarketService($db, $events);
$state = $service->snapshot($seller);
$listed = $service->act('list', 'bat', 2, 125, $state['inventoryVersion'], $seller);
$id = $listed['result']['listingId'];
$listing = $db->fetchOne('SELECT * FROM player_market_listings WHERE id = :id', ['id' => $id]);
marketProof((int)$listing['quantity'] === 2 && $listing['state'] === 'active', 'listing is a real persistent two-item escrow');
marketProof($progress->snapshot($seller)['state']['inv']['bat'] === $start['state']['inv']['bat'] - 2, 'listing removes owned units once');
marketReject(fn() => $service->act('list', 'bat', 2, 125, $state['inventoryVersion'], $seller), 'stale list submission cannot escrow twice');
marketReject(fn() => $service->act('buy', $id, 1, 0, 1, $seller), 'seller cannot buy their own listing');
marketReject(fn() => $service->act('cancel', $id, 1, 0, 1, $buyer), 'another account cannot cancel escrow');
$beforeSeller = $progress->snapshot($seller); $beforeBuyer = $progress->snapshot($buyer);
$bought = $service->act('buy', $id, 1, 0, 1, $buyer);
$afterSeller = $progress->snapshot($seller); $afterBuyer = $progress->snapshot($buyer);
marketProof($afterSeller['player']['cash'] - $beforeSeller['player']['cash'] === 125 && $beforeBuyer['player']['cash'] - $afterBuyer['player']['cash'] === 125, 'purchase transfers exact cash between actual accounts');
marketProof(($afterBuyer['state']['inv']['bat'] ?? 0) === ($beforeBuyer['state']['inv']['bat'] ?? 0) + 1, 'purchased unit reaches only buyer inventory');
$listing = $db->fetchOne('SELECT * FROM player_market_listings WHERE id = :id', ['id' => $id]);
marketProof((int)$listing['quantity'] === 1 && (int)$listing['version'] === 2, 'partial purchase updates remaining stock and version');
marketReject(fn() => $service->act('buy', $id, 1, 0, 1, $buyer), 'duplicate buy with stale version cannot spend or grant again');
marketReject(fn() => $service->act('buy', $id, 2, 0, 2, $buyer), 'remaining quantity cannot be oversold');
$cancelled = $service->act('cancel', $id, 1, 0, 2, $seller);
marketProof($progress->snapshot($seller)['state']['inv']['bat'] === $start['state']['inv']['bat'] - 1, 'cancel returns only remaining escrow quantity');
marketReject(fn() => $service->act('cancel', $id, 1, 0, 3, $seller), 'cancelled escrow cannot refund twice');
marketReject(fn() => $service->act('buy', $id, 1, 0, 3, $buyer), 'cancelled listing cannot be bought');
foreach ([[0,125],[1,0],[1001,125],[1,1000001]] as [$qty,$price]) marketReject(fn() => $service->act('list', 'bat', $qty, $price, $service->snapshot($seller)['inventoryVersion'], $seller), 'invalid quantity/price rejected: ' . $qty . '/' . $price);
marketReject(fn() => $service->act('list', 'unknown-item', 1, 10, $service->snapshot($seller)['inventoryVersion'], $seller), 'unknown item cannot mint a listing');
marketReject(fn() => $service->act('list', 'bat', 1000, 10, $service->snapshot($seller)['inventoryVersion'], $seller), 'unowned quantity cannot enter escrow');
$progress->grantItem($seller, 'bat');
$next = $service->act('list', 'bat', 1, 1000000, $service->snapshot($seller)['inventoryVersion'], $seller)['result']['listingId'];
$cash = $progress->snapshot($buyer)['player']['cash'];
marketReject(fn() => $service->act('buy', $next, 1, 0, 1, $buyer), 'insufficient funds leave cash and listing intact');
marketProof($progress->snapshot($buyer)['player']['cash'] === $cash && (int)$db->fetchOne('SELECT quantity FROM player_market_listings WHERE id=:id',['id'=>$next])['quantity'] === 1, 'rejected purchase is fully rolled back');
$ledger = $db->fetchAll("SELECT player_id,amount FROM economy_ledger WHERE reason='player-market.buy' AND asset='cash' AND player_id IN (:seller, :buyer)", ['seller' => $seller, 'buyer' => $buyer]);
marketProof(count($ledger) === 2 && array_sum(array_column($ledger,'amount')) === 0, 'paired cash ledger conserves the player economy');
$secondBuyer = $sessions->create('second-buyer-' . bin2hex(random_bytes(6)))['playerId'];
$progress->snapshot($secondBuyer);
$progress->grantItem($seller, 'bat');
$last = $service->act('list', 'bat', 1, 77, $service->snapshot($seller)['inventoryVersion'], $seller)['result']['listingId'];
$before = [];
foreach ([$seller, $buyer, $secondBuyer] as $actor) $before[$actor] = $progress->snapshot($actor);
$race = marketRace($last, 1, [['buy', $buyer], ['buy', $secondBuyer]], [$seller, $buyer, $secondBuyer]);
$winners = array_values(array_filter($race, fn ($r) => $r['status'] === 'ok')); $losers = array_values(array_filter($race, fn ($r) => $r['status'] === 'stale'));
marketProof(count($winners) === 1 && count($losers) === 1, 'two distinct buyers racing the last unit produce one settlement and one stale receipt');
$winner = $winners[0]['actor']; $loser = $losers[0]['actor'];
$after = [];
foreach ([$seller, $buyer, $secondBuyer] as $actor) $after[$actor] = $progress->snapshot($actor);
marketProof($after[$seller]['player']['cash'] === $before[$seller]['player']['cash'] + 77 && $after[$winner]['player']['cash'] === $before[$winner]['player']['cash'] - 77 && $after[$loser]['player']['cash'] === $before[$loser]['player']['cash'], 'last-unit race charges only the winner and credits the real seller once');
marketProof(($after[$winner]['state']['inv']['bat'] ?? 0) === ($before[$winner]['state']['inv']['bat'] ?? 0) + 1 && ($after[$loser]['state']['inv']['bat'] ?? 0) === ($before[$loser]['state']['inv']['bat'] ?? 0), 'last-unit race grants exactly one actual unit and preserves losing buyer inventory');
$row = $db->fetchOne('SELECT * FROM player_market_listings WHERE id = :id', ['id' => $last]);
marketProof($row['state'] === 'sold' && (int) $row['quantity'] === 0 && (int) $row['version'] === 2, 'last-unit listing closes at the single next version');
$cashLedger = $db->fetchAll("SELECT amount FROM economy_ledger WHERE correlation_id = :correlation AND asset = 'cash' AND reason = 'player-market.buy'", ['correlation' => $winners[0]['result']['correlationId']]);
marketProof(count($cashLedger) === 2 && array_sum(array_column($cashLedger, 'amount')) === 0, 'last-unit settlement records one conserved pair of cash ledger entries');
$items = $db->fetchAll("SELECT amount FROM economy_ledger WHERE correlation_id = :correlation AND asset = 'item:bat'", ['correlation' => $winners[0]['result']['correlationId']]);
marketProof(count($items) === 1 && (int) $items[0]['amount'] === 1, 'last-unit winner has exactly one inventory ledger grant');

$progress->grantItem($seller, 'bat');
$cancelRace = $service->act('list', 'bat', 1, 91, $service->snapshot($seller)['inventoryVersion'], $seller)['result']['listingId'];
$beforeSeller = $progress->snapshot($seller); $beforeBuyer = $progress->snapshot($secondBuyer);
$race = marketRace($cancelRace, 1, [['cancel', $seller], ['buy', $secondBuyer]], [$seller, $secondBuyer]);
$winners = array_values(array_filter($race, fn ($r) => $r['status'] === 'ok')); $losers = array_values(array_filter($race, fn ($r) => $r['status'] === 'stale'));
marketProof(count($winners) === 1 && count($losers) === 1, 'seller cancellation racing buyer purchase has one terminal settlement and one stale receipt');
$outcome = $winners[0]['result']['action'];
$afterSeller = $progress->snapshot($seller); $afterBuyer = $progress->snapshot($secondBuyer);
$row = $db->fetchOne('SELECT * FROM player_market_listings WHERE id = :id', ['id' => $cancelRace]);
marketProof(in_array($outcome, ['cancel', 'buy'], true) && $row['state'] === ($outcome === 'cancel' ? 'cancelled' : 'sold') && (int) $row['quantity'] === 0 && (int) $row['version'] === 2, 'cancel-versus-buy closes the same actual listing once');
$sellerUnits = ($afterSeller['state']['inv']['bat'] ?? 0) - ($beforeSeller['state']['inv']['bat'] ?? 0);
$buyerUnits = ($afterBuyer['state']['inv']['bat'] ?? 0) - ($beforeBuyer['state']['inv']['bat'] ?? 0);
marketProof($sellerUnits === ($outcome === 'cancel' ? 1 : 0) && $buyerUnits === ($outcome === 'buy' ? 1 : 0) && $sellerUnits + $buyerUnits === 1, 'escrow unit is either returned to seller or transferred to buyer, never both');
$sellerCash = $afterSeller['player']['cash'] - $beforeSeller['player']['cash']; $buyerCash = $afterBuyer['player']['cash'] - $beforeBuyer['player']['cash'];
marketProof($sellerCash === ($outcome === 'buy' ? 91 : 0) && $buyerCash === -$sellerCash, 'cancel-versus-buy preserves total cash with only the winning action effect');
$receiptItems = $db->fetchAll("SELECT player_id, amount FROM economy_ledger WHERE correlation_id = :correlation AND asset = 'item:bat'", ['correlation' => $winners[0]['result']['correlationId']]);
marketProof(count($receiptItems) === 1 && (int) $receiptItems[0]['amount'] === 1 && $receiptItems[0]['player_id'] === ($outcome === 'cancel' ? $seller : $secondBuyer), 'cancel-versus-buy emits one provenance-correct inventory receipt');
$eventCount = (int) $db->fetchOne("SELECT COUNT(*) AS total FROM event_log WHERE event_name = 'PlayerMarketSettled' AND CAST(payload_json AS TEXT) LIKE :listing", ['listing' => '%' . $cancelRace . '%'])['total'];
marketProof($eventCount === 2, 'cancel-versus-buy persists only listing creation and its one terminal settlement event');

echo 'PLAYER MARKET RESULT: ' . $count . ' passed, 0 failed (' . $db->driver() . ')' . PHP_EOL;
