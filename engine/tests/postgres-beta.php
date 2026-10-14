<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
use Zone\Engine\Core\Persistence\Database;
use Zone\Engine\Core\Publishing\PublishedRules;
use Zone\Engine\Core\Events\EventBus;
use Zone\Engine\Core\Game\ProgressionService;

// Opt-in only: this suite must never point at a live database or delete user data.
$url = getenv('ZONE_POSTGRES_TEST_URL') ?: '';
$target = parse_url($url);
if (!is_array($target) || !in_array($target['host'] ?? '', ['127.0.0.1', 'localhost'], true)
    || !preg_match('~^/zone_beta_smoke_[0-9a-z_]+$~D', $target['path'] ?? '')) throw new RuntimeException('A named disposable loopback PostgreSQL test database is required.');
$passed = 0;
function postgresProof(bool $ok, string $label): void { global $passed; if (!$ok) throw new RuntimeException('FAIL: ' . $label); $passed++; echo 'PASS: ' . $label . PHP_EOL; }
function postgresReject(callable $fn, ?string $expectedMessage = null): bool { try { $fn(); } catch (RuntimeException|InvalidArgumentException $error) { return $expectedMessage === null || $error->getMessage() === $expectedMessage; } return false; }
$database = Database::connect($url); $engine = zone_engine($url);
if (($argv[1] ?? '') === '--purchase-worker') {
    try {
        $engine->gameplayAction('item.buy', (string) getenv('ZONE_TEST_ITEM'), (int) getenv('ZONE_TEST_VERSION'), (string) getenv('ZONE_TEST_PLAYER'));
        echo "settled\n"; exit(0);
    } catch (RuntimeException $error) {
        if (str_contains(strtolower($error->getMessage()), 'changed')) { echo "stale\n"; exit(10); }
        throw $error;
    }
}
postgresProof($database->driver() === 'pgsql' && $engine->status()['database'] === 'pgsql', 'actual PostgreSQL boot, schema creation and foundation discovery succeed');
$fingerprint = $database->fetchOne("SELECT value FROM engine_metadata WHERE name = 'schema-fingerprint'")['value'];
$database->migrateAndSeed();
postgresProof($database->fetchOne("SELECT value FROM engine_metadata WHERE name = 'schema-fingerprint'")['value'] === $fingerprint, 'repeat boot retains its applied schema fingerprint');
$first = $engine->browserSessions()->create('postgres-smoke-' . bin2hex(random_bytes(6)));
$second = $engine->browserSessions()->create('postgres-other-' . bin2hex(random_bytes(6)));
$player = $first['playerId'];
postgresProof($engine->browserSessions()->resolve($first['token']) === $player && $player !== $second['playerId'], 'opaque browser sessions persist and resolve on PostgreSQL');
postgresProof($engine->gameplay($player)['player']['cash'] === 2500, 'novice state and starting grant are persisted');
$catalog = $engine->adminGameplayCatalog();
$itemId = 'pg-blade-' . substr($player, -8);
$engine->createGameplayCatalog('items', $itemId, ['type' => 'weapon', 'price' => 100, 'mult' => 1.4, 'model' => 'knife', 'image' => 'art/bio.jpg', 'name' => ['en' => 'PG Blade', 'ar' => 'نصل الاختبار']], $catalog['revision'], 'isolated-test');
postgresProof(!isset($engine->gameplay($player)['catalogs']['items'][$itemId]), 'unpublished owner content cannot enter gameplay');
$release = $engine->publishRelease('isolated-test');
postgresProof($release['version'] > 0 && isset($engine->gameplay($player)['catalogs']['items'][$itemId]), 'owner publication materializes immutable JSONB content');
postgresProof((new PublishedRules($database))->moduleEnabled('gangs'), 'lightweight JSONB gate projection reads the published module states');
$state = $engine->gameplay($player);
$bought = $engine->gameplayAction('item.buy', $itemId, $state['state']['version'], $player);
postgresProof($bought['player']['cash'] === 2400 && $bought['state']['inv'][$itemId] === 1, 'published purchase settles once under a PostgreSQL player row lock');
postgresProof(postgresReject(fn () => $engine->gameplayAction('item.buy', $itemId, $state['state']['version'], $player)), 'stale purchase cannot debit cash twice');
$equipped = $engine->gameplayAction('item.equip', $itemId, $bought['state']['version'], $player);
postgresProof($equipped['state']['equip'] === $itemId && $equipped['catalogs']['items'][$itemId]['model'] === 'knife', 'ownership is distinct from the fitted presentation model');
$engine->bankDeposit(100, $player);
postgresProof($engine->player($player)['cash'] === 2300 && $engine->player($player)['bank_balance'] === 100, 'bank transfer reconciles persisted cash and savings');
$joined = $engine->joinFaction('vipers', $player);
postgresProof($joined['map']['playerFactionRole'] === 'member' && in_array($engine->player($player)['username'], array_column($joined['map']['members'], 'username'), true), 'ordinary family recruitment and real roster work on PostgreSQL');
postgresProof(postgresReject(fn () => $engine->joinFaction('kings', $player)), 'existing membership cannot be switched through a second request');
$rows = array_values(array_filter($engine->leaderboards($player)['rows'], fn ($row) => $row['isCurrentPlayer']));
postgresProof(count($rows) === 1 && $rows[0]['liquidFunds'] === 2400 && $rows[0]['family']['id'] === 'vipers', 'PostgreSQL standings return real money and joined family');
$trained = $engine->trainGym('strength', 1, $player);
postgresProof($trained['player']['strength'] > 10 && $trained['player']['energy'] < 100, 'gym mutation changes authoritative stats and consumes energy');
postgresProof($engine->player($second['playerId'])['cash'] === 2500, 'another browser account remains untouched across all mutations');
$before = $engine->player($player)['cash'];
try { $database->playerTransaction($player, function () use ($database, $player): void { $database->execute('UPDATE players SET cash = 0 WHERE id = :id', ['id' => $player]); throw new RuntimeException('rollback probe'); }); } catch (RuntimeException) {}
postgresProof($engine->player($player)['cash'] === $before, 'failed PostgreSQL player transactions roll back rather than partially settling');
$racePlayer = $engine->browserSessions()->create('pg-race-' . bin2hex(random_bytes(6)))['playerId'];
$raceVersion = $engine->gameplay($racePlayer)['state']['version'];
$workers = [];
for ($i = 0; $i < 3; $i++) {
    $worker = proc_open([PHP_BINARY, '-d', 'extension=pdo_pgsql', __FILE__, '--purchase-worker'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, ZONE_REPOSITORY_ROOT, [...getenv(), 'ZONE_TEST_ITEM' => $itemId, 'ZONE_TEST_VERSION' => (string) $raceVersion, 'ZONE_TEST_PLAYER' => $racePlayer], ['bypass_shell' => true]);
    if (!is_resource($worker)) throw new RuntimeException('PostgreSQL concurrency worker could not start.');
    fclose($pipes[0]); $workers[] = [$worker, $pipes];
}
$settled = 0; $stale = 0;
foreach ($workers as [$worker, $pipes]) {
    $output = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]);
    $code = proc_close($worker);
    if ($code === 0 && trim($output) === 'settled') $settled++;
    elseif ($code === 10 && trim($output) === 'stale') $stale++;
    else throw new RuntimeException('PostgreSQL concurrency worker failed: ' . $output . $error);
}
postgresProof($settled === 1 && $stale === 2, 'three concurrent PostgreSQL purchases produce one settlement and two stale rejections');
$race = $engine->gameplay($racePlayer);
postgresProof($race['player']['cash'] === 2400 && $race['state']['inv'][$itemId] === 1, 'concurrent purchase balance and inventory reconcile without duplication');
$engine->changeModule('leaderboards', 'disable');
postgresProof((new PublishedRules($database))->moduleEnabled('leaderboards'), 'unpublished module changes do not affect the active PostgreSQL release');
$engine->publishRelease('isolated-test');
postgresProof(postgresReject(fn () => $engine->leaderboards($player)), 'published module disable gates the PostgreSQL gameplay route');
$engine->changeModule('leaderboards', 'enable'); $engine->publishRelease('isolated-test');
postgresProof(count($engine->leaderboards($player)['rows']) > 0, 'module can be re-enabled and published without changing the core');

$keeperName = 'PgKeeper' . substr($player, -8);
$accountBefore = $engine->gameplay($player);
$ledgerBefore = (int) $database->fetchOne('SELECT COUNT(*) AS total FROM economy_ledger WHERE player_id = :id', ['id' => $player])['total'];
$claim = $engine->playerAccounts()->claim($first['token'], $keeperName, 'long isolated postgres password', 'pg-claim-' . $player);
postgresProof($claim['playerId'] === $player && $engine->playerAccounts()->status($claim['token'])['claimed'], 'PostgreSQL claiming retains the existing account and persists its credentials');
postgresProof(postgresReject(fn () => $engine->browserSessions()->resolve($first['token'])), 'PostgreSQL claim rotates and revokes the guest session');
$credentials = $database->fetchOne('SELECT password_hash, recovery_hash FROM player_credentials WHERE player_id = :id', ['id' => $player]);
postgresProof(password_verify('long isolated postgres password', $credentials['password_hash']) && $credentials['recovery_hash'] === hash('sha256', $claim['recoveryCode']), 'PostgreSQL stores password and backup hashes rather than plaintext');
$engine->browserSessions()->revoke($claim['token']);
$login = $engine->playerAccounts()->login(strtolower($keeperName), 'long isolated postgres password', 'pg-login-' . $player);
postgresProof($engine->browserSessions()->resolve($login['token']) === $player && $engine->player($player)['cash'] === $accountBefore['player']['cash'] && $engine->gameplay($player)['state']['equip'] === $itemId, 'PostgreSQL login restores saved money and equipped Admin-authored item without a starting grant');
postgresProof((int) $database->fetchOne('SELECT COUNT(*) AS total FROM economy_ledger WHERE player_id = :id', ['id' => $player])['total'] === $ledgerBefore, 'PostgreSQL claiming and sign-in add no money transactions, including after legitimate gym rewards');
$recover = $engine->playerAccounts()->recover($keeperName, $claim['recoveryCode'], 'new isolated postgres password', 'pg-recover-' . $player);
postgresProof($recover['recoveryCode'] !== $claim['recoveryCode'] && postgresReject(fn () => $engine->browserSessions()->resolve($login['token'])), 'PostgreSQL recovery rotates backup code and revokes all prior sessions');
postgresProof(postgresReject(fn () => $engine->playerAccounts()->recover($keeperName, $claim['recoveryCode'], 'replayed postgres password', 'pg-replay-' . $player)), 'PostgreSQL recovery cannot replay a consumed backup code');
postgresProof($engine->territoryMap($player)['playerFactionId'] === 'vipers' && $engine->player($second['playerId'])['cash'] === 2500, 'PostgreSQL account recovery preserves family and another player');

// Separate fixtures extend the actual PostgreSQL journal contract without
// changing the cash/equipment assumptions used by the account checks above.
$journalPlayer = $engine->browserSessions()->create('pg-journal-' . bin2hex(random_bytes(6)))['playerId'];
$journal = new ProgressionService($database, new EventBus($database));
$journalState = $journal->snapshot($journalPlayer);
$starting = $database->fetchAll("SELECT asset, amount, correlation_id FROM economy_ledger WHERE player_id = :id AND reason IN ('beta.starting-grant', 'beta.starting-inventory') ORDER BY asset", ['id' => $journalPlayer]);
postgresProof(count($starting) === 2 && $starting[0]['asset'] === 'cash' && $starting[1]['asset'] === 'item:smallkit' && (int) $starting[1]['amount'] === 1 && $starting[0]['correlation_id'] === $starting[1]['correlation_id'], 'PostgreSQL starter money and item issuance share one provenance correlation');
$journalBought = $journal->act('item.buy', 'drink', $journalState['state']['version'], $journalPlayer);
$receipt = $database->fetchAll('SELECT asset, amount, balance_after FROM economy_ledger WHERE correlation_id = :id ORDER BY asset', ['id' => $journalBought['result']['correlationId']]);
postgresProof(count($receipt) === 2 && $receipt[0]['asset'] === 'cash' && (int) $receipt[0]['amount'] === -990 && $receipt[1]['asset'] === 'item:drink' && (int) $receipt[1]['amount'] === 1 && (int) $receipt[1]['balance_after'] === 1, 'PostgreSQL item purchase correlates its cash debit and exact unit issuance');
$journalSold = $journal->act('item.sell', 'drink', $journalBought['state']['version'], $journalPlayer);
$receipt = $database->fetchAll('SELECT asset, amount, balance_after FROM economy_ledger WHERE correlation_id = :id ORDER BY asset', ['id' => $journalSold['result']['correlationId']]);
postgresProof(count($receipt) === 2 && (int) $receipt[0]['amount'] === $journalSold['result']['cashDelta'] && $receipt[1]['asset'] === 'item:drink' && (int) $receipt[1]['amount'] === -1 && (int) $receipt[1]['balance_after'] === 0, 'PostgreSQL sale correlates the cash credit and exact unit sink');
$database->execute('UPDATE players SET life = 1 WHERE id = :id', ['id' => $journalPlayer]);
$journalUsed = $journal->act('item.use', 'smallkit', $journalSold['state']['version'], $journalPlayer);
$receipt = $database->fetchAll('SELECT asset, amount, balance_after FROM economy_ledger WHERE correlation_id = :id', ['id' => $journalUsed['result']['correlationId']]);
postgresProof(count($receipt) === 1 && $receipt[0]['asset'] === 'item:smallkit' && (int) $receipt[0]['amount'] === -1 && (int) $receipt[0]['balance_after'] === 0 && $journalUsed['player']['life'] > 1, 'PostgreSQL consumption records its sink alongside the authoritative healing');
$grantCorrelation = bin2hex(random_bytes(16));
$journal->grantItem($journalPlayer, 'sand', 4, $grantCorrelation, 'crime.loot');
$receipt = $database->fetchAll('SELECT asset, amount, balance_after, reason FROM economy_ledger WHERE correlation_id = :id', ['id' => $grantCorrelation]);
postgresProof(count($receipt) === 1 && $receipt[0]['asset'] === 'item:sand' && (int) $receipt[0]['amount'] === 4 && (int) $receipt[0]['balance_after'] === 4 && $receipt[0]['reason'] === 'crime.loot', 'PostgreSQL trusted grant preserves exact units and action provenance');
$journalAgain = (new ProgressionService($database, new EventBus($database)))->snapshot($journalPlayer);
postgresProof($journalAgain['state']['inv']['sand'] === 4 && $journalAgain['state']['inv']['smallkit'] === 0 && (int) $database->fetchOne("SELECT COUNT(*) AS total FROM economy_ledger WHERE player_id = :id AND reason = 'beta.starting-inventory'", ['id' => $journalPlayer])['total'] === 1, 'PostgreSQL reload retains inventory sinks/grants without a second starter issuance');
$reviewed = $engine->releaseDraft();
$edited = $reviewed['manifest']; $edited['brand']['name'] = 'PostgreSQL reviewed owner ' . substr($journalPlayer, -8);
$savedDraft = $engine->saveReleaseDraft($edited, 'pg-reviewed-owner', $reviewed['draftFingerprint']);
postgresProof($savedDraft['draftFingerprint'] !== $reviewed['draftFingerprint'], 'PostgreSQL owner draft save advances its reviewed configuration fingerprint');
$historyBefore = count($engine->releaseHistory());
$auditBefore = (int) $database->fetchOne('SELECT COUNT(*) AS total FROM admin_audit_log')['total'];
postgresProof(postgresReject(fn () => $engine->saveReleaseDraft($reviewed['manifest'], 'pg-stale-owner', $reviewed['draftFingerprint']), 'Release draft changed. Refresh and try again.'), 'PostgreSQL stale owner draft cannot overwrite a concurrent saved edit');
postgresProof(postgresReject(fn () => $engine->publishRelease('pg-stale-owner', $reviewed['draftFingerprint']), 'Release draft changed. Refresh and try again.'), 'PostgreSQL stale publication cannot activate unreviewed configuration');
postgresProof(count($engine->releaseHistory()) === $historyBefore && (int) $database->fetchOne('SELECT COUNT(*) AS total FROM admin_audit_log')['total'] === $auditBefore && $engine->releaseDraft()['manifest']['brand']['name'] === $edited['brand']['name'], 'PostgreSQL stale writes preserve release history, owner audit and winning draft');
$reviewedRelease = $engine->publishRelease('pg-reviewed-owner', $savedDraft['draftFingerprint']);
postgresProof($reviewedRelease['manifest']['brand']['name'] === $edited['brand']['name'] && postgresReject(fn () => $engine->publishRelease('pg-replay-owner', $savedDraft['draftFingerprint']), 'Release draft changed. Refresh and try again.') && count($engine->releaseHistory()) === $historyBefore + 1, 'PostgreSQL reviewed publish creates one release and rejects its request replay');
echo "POSTGRES BETA RESULT: {$passed} passed, 0 failed\n";
